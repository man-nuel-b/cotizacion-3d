// BAT-Cubikeitor · Supabase cloud integration v2
// Keeps localStorage as a fallback and adds authenticated cloud save/open.
(function(){
  if(window.BAT_KUBIQUEITOR_SUPABASE_CLOUD) return;

  const SUPABASE_URL='https://whnxaepqfrsgjfzfyppt.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY='sb_publishable_Y3QHA9vbc2J7HE90PxAnzA_-BzmYgmR';
  const SDK_URL='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/dist/umd/supabase.min.js';
  const CURRENT_PROJECT_KEY='bat-cubikeitor-cloud-project-id-v1';
  const localSave=window.saveProject;
  let client=null;
  let session=null;
  let organizationId=null;
  let currentProjectId=null;
  let sdkPromise=null;

  function esc(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#039;'}[c]));}
  function notify(message){if(typeof window.toast==='function') window.toast(message); else console.info(message);}
  function getCurrentProjectId(){try{return localStorage.getItem(CURRENT_PROJECT_KEY)||null;}catch(e){return null;}}
  function setCurrentProjectId(id){currentProjectId=id||null;try{if(id)localStorage.setItem(CURRENT_PROJECT_KEY,id);else localStorage.removeItem(CURRENT_PROJECT_KEY);}catch(e){}}
  function projectName(){
    const solution=(window.DATA||typeof DATA!=='undefined'?DATA:null)?.solutions?.[state?.solution]?.name||'Proyecto modular';
    const customer=state?.customer?.company||state?.customer?.name;
    return customer?`${solution} · ${customer}`:solution;
  }

  function validateNewPassword(password){
    if(password.length<12)return 'La contraseña debe tener al menos 12 caracteres.';
    if(!/[a-z]/.test(password))return 'Agrega al menos una letra minúscula.';
    if(!/[A-Z]/.test(password))return 'Agrega al menos una letra mayúscula.';
    if(!/[0-9]/.test(password))return 'Agrega al menos un número.';
    if(!/[^A-Za-z0-9]/.test(password))return 'Agrega al menos un símbolo.';
    return null;
  }

  function loadSdk(){
    if(window.supabase?.createClient) return Promise.resolve(window.supabase);
    if(sdkPromise) return sdkPromise;
    sdkPromise=new Promise((resolve,reject)=>{
      const existing=document.querySelector('script[data-bat-supabase-sdk]');
      if(existing){existing.addEventListener('load',()=>resolve(window.supabase),{once:true});existing.addEventListener('error',reject,{once:true});return;}
      const script=document.createElement('script');
      script.src=SDK_URL;script.async=true;script.crossOrigin='anonymous';script.dataset.batSupabaseSdk='true';
      script.onload=()=>window.supabase?.createClient?resolve(window.supabase):reject(new Error('Supabase SDK no disponible'));
      script.onerror=()=>reject(new Error('No se pudo cargar Supabase SDK'));
      document.head.appendChild(script);
    });
    return sdkPromise;
  }

  function addStyles(){
    if(document.getElementById('bat-cloud-style')) return;
    const style=document.createElement('style');style.id='bat-cloud-style';style.textContent=`
      #bat-cloud-button{display:inline-flex;align-items:center;gap:6px;padding:8px 11px;border:1px solid rgba(100,116,139,.65);border-radius:9px;background:#0f172a;color:#fff;font-size:12px;font-weight:700}
      #bat-cloud-button[data-online="true"]{border-color:rgba(16,185,129,.55)}
      #bat-cloud-button .cloud-dot{width:7px;height:7px;border-radius:999px;background:#64748b}
      #bat-cloud-button[data-online="true"] .cloud-dot{background:#10b981;box-shadow:0 0 0 3px rgba(16,185,129,.13)}
      #bat-cloud-modal{position:fixed;inset:0;z-index:80;background:rgba(2,6,23,.72);backdrop-filter:blur(8px);display:none;align-items:center;justify-content:center;padding:16px}
      #bat-cloud-modal.open{display:flex}
      .bat-cloud-card{width:min(620px,100%);max-height:90vh;overflow:auto;background:white;border-radius:20px;box-shadow:0 30px 90px rgba(2,6,23,.35)}
      .bat-cloud-project{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px;border:1px solid #e2e8f0;border-radius:13px;background:#fff}
      .bat-cloud-project:hover{border-color:#f59e0b;background:#fffbeb}
    `;document.head.appendChild(style);
  }

  function injectUi(){
    addStyles();
    if(!document.getElementById('bat-cloud-button')){
      const actions=document.querySelector('.topbar .no-presentation');
      if(actions){
        const btn=document.createElement('button');btn.id='bat-cloud-button';btn.type='button';btn.dataset.online='false';btn.innerHTML='<span class="cloud-dot"></span><i class="fa-solid fa-cloud"></i><span class="hidden lg:inline">Nube</span>';
        btn.addEventListener('click',openCloudModal);actions.insertBefore(btn,actions.lastElementChild||null);
      }
    }
    if(!document.getElementById('bat-cloud-modal')){
      const modal=document.createElement('div');modal.id='bat-cloud-modal';modal.innerHTML=`
        <div class="bat-cloud-card">
          <div class="flex items-center justify-between px-5 py-4 border-b"><div><div class="text-[11px] font-black uppercase tracking-widest text-amber-600">BAT-Cubikeitor Cloud</div><h3 class="font-black text-lg">Proyectos en la nube</h3></div><button id="bat-cloud-close" class="w-9 h-9 rounded-full bg-slate-100"><i class="fa-solid fa-xmark"></i></button></div>
          <div class="p-5">
            <div id="bat-cloud-signed-out">
              <p class="text-sm text-slate-500 mb-4">Inicia sesión para guardar y abrir proyectos desde cualquier equipo. El guardado local seguirá funcionando como respaldo.</p>
              <div class="grid gap-3"><input id="bat-auth-name" class="border rounded-xl px-3 py-2.5 text-sm" placeholder="Nombre (para crear cuenta)"><input id="bat-auth-email" type="email" class="border rounded-xl px-3 py-2.5 text-sm" placeholder="Correo"><input id="bat-auth-password" type="password" autocomplete="current-password" class="border rounded-xl px-3 py-2.5 text-sm" placeholder="Contraseña"></div>
              <div class="mt-2 rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5 text-[11px] text-slate-600"><strong>Para cuentas nuevas:</strong> mínimo 12 caracteres, con mayúscula, minúscula, número y símbolo.</div>
              <div class="grid sm:grid-cols-2 gap-2 mt-4"><button id="bat-sign-in" class="bg-slate-950 text-white rounded-xl py-3 text-sm font-bold">Iniciar sesión</button><button id="bat-sign-up" class="bg-amber-500 text-slate-950 rounded-xl py-3 text-sm font-black">Crear cuenta</button></div>
              <div id="bat-auth-message" class="text-xs text-slate-500 mt-3"></div>
            </div>
            <div id="bat-cloud-signed-in" class="hidden">
              <div class="flex flex-wrap items-center justify-between gap-3 mb-4"><div><div class="text-xs text-slate-500">Sesión</div><div id="bat-cloud-user" class="font-bold text-sm"></div></div><div class="flex gap-2"><button id="bat-cloud-new" class="border rounded-xl px-3 py-2 text-xs font-bold">Nuevo proyecto</button><button id="bat-sign-out" class="border rounded-xl px-3 py-2 text-xs font-bold text-red-600">Salir</button></div></div>
              <button id="bat-cloud-save-now" class="w-full bg-emerald-600 text-white rounded-xl py-3 text-sm font-black"><i class="fa-solid fa-cloud-arrow-up mr-1"></i> Guardar proyecto actual en la nube</button>
              <div class="flex items-center justify-between mt-6 mb-2"><h4 class="font-black text-sm">Mis proyectos</h4><button id="bat-cloud-refresh" class="text-xs font-bold text-slate-500"><i class="fa-solid fa-rotate"></i> Actualizar</button></div>
              <div id="bat-cloud-projects" class="grid gap-2"></div>
            </div>
          </div>
        </div>`;
      document.body.appendChild(modal);
      modal.addEventListener('click',e=>{if(e.target===modal)closeCloudModal();});
      document.getElementById('bat-cloud-close').onclick=closeCloudModal;
      document.getElementById('bat-sign-in').onclick=signIn;
      document.getElementById('bat-sign-up').onclick=signUp;
      document.getElementById('bat-sign-out').onclick=signOut;
      document.getElementById('bat-cloud-save-now').onclick=saveCloudProject;
      document.getElementById('bat-cloud-refresh').onclick=refreshCloudProjects;
      document.getElementById('bat-cloud-new').onclick=()=>{setCurrentProjectId(null);notify('Nuevo proyecto en la nube: el próximo guardado creará una copia nueva');refreshCloudProjects();};
    }
  }

  function setAuthMessage(message,isError=false){const el=document.getElementById('bat-auth-message');if(!el)return;el.textContent=message||'';el.className=`text-xs mt-3 ${isError?'text-red-600':'text-slate-500'}`;}
  function updateUi(){
    const online=Boolean(session?.user);const button=document.getElementById('bat-cloud-button');if(button)button.dataset.online=String(online);
    document.getElementById('bat-cloud-signed-out')?.classList.toggle('hidden',online);
    document.getElementById('bat-cloud-signed-in')?.classList.toggle('hidden',!online);
    const user=document.getElementById('bat-cloud-user');if(user)user.textContent=session?.user?.email||'';
  }
  function openCloudModal(){injectUi();document.getElementById('bat-cloud-modal')?.classList.add('open');updateUi();if(session?.user)refreshCloudProjects();}
  function closeCloudModal(){document.getElementById('bat-cloud-modal')?.classList.remove('open');}

  async function initializeMembership(){
    if(!session?.user)return null;
    const {data:membership,error}=await client.from('organization_members').select('organization_id,role').eq('user_id',session.user.id).maybeSingle();
    if(error)throw error;
    if(membership?.organization_id){organizationId=membership.organization_id;return organizationId;}
    throw new Error('Tu cuenta aún no tiene acceso a una organización. Solicita acceso al administrador.');
  }

  async function signIn(){
    try{setAuthMessage('Ingresando…');const email=document.getElementById('bat-auth-email').value.trim();const password=document.getElementById('bat-auth-password').value;
      const {data,error}=await client.auth.signInWithPassword({email,password});if(error)throw error;session=data.session;await initializeMembership();updateUi();setAuthMessage('');notify('Sesión iniciada');refreshCloudProjects();
    }catch(error){setAuthMessage(error.message||'No se pudo iniciar sesión',true);}
  }
  async function signUp(){
    try{setAuthMessage('Creando cuenta…');const fullName=document.getElementById('bat-auth-name').value.trim();const email=document.getElementById('bat-auth-email').value.trim();const password=document.getElementById('bat-auth-password').value;
      const passwordError=validateNewPassword(password);if(passwordError)throw new Error(passwordError);
      const {data,error}=await client.auth.signUp({email,password,options:{data:{full_name:fullName},emailRedirectTo:'https://man-nuel-b.github.io/cotizacion-3d/'}});if(error)throw error;
      if(data.session){session=data.session;await initializeMembership();updateUi();notify('Cuenta creada');refreshCloudProjects();setAuthMessage('');}
      else setAuthMessage('Cuenta creada. Revisa tu correo para confirmar y luego inicia sesión.');
    }catch(error){setAuthMessage(error.message||'No se pudo crear la cuenta',true);}
  }
  async function signOut(){await client.auth.signOut();session=null;organizationId=null;updateUi();notify('Sesión cerrada');}

  function mergeLoadedState(loaded){
    state={...clone(DEFAULT_STATE),...loaded,counts:{...DEFAULT_STATE.counts,...(loaded?.counts||{})},customer:{...DEFAULT_STATE.customer,...(loaded?.customer||{})}};
    history=[];future=[];renderAll();setView('exterior',false);
  }

  async function saveCloudProject(){
    if(!session?.user){openCloudModal();notify('Inicia sesión para guardar en la nube');return false;}
    try{
      if(!organizationId)await initializeMembership();
      const payload={organization_id:organizationId,name:projectName(),container_type:state.container,solution_type:state.solution,project_state:clone(state),updated_by:session.user.id};
      const id=currentProjectId||getCurrentProjectId();
      let result;
      if(id) result=await client.from('projects').update(payload).eq('id',id).select('id').single();
      else result=await client.from('projects').insert({...payload,created_by:session.user.id}).select('id').single();
      if(result.error)throw result.error;
      setCurrentProjectId(result.data.id);notify('Proyecto guardado en la nube');refreshCloudProjects();return true;
    }catch(error){console.error('[BAT Cloud] save',error);notify(`Nube: ${error.message||'error al guardar'}`);return false;}
  }

  async function refreshCloudProjects(){
    const root=document.getElementById('bat-cloud-projects');if(!root||!session?.user)return;
    root.innerHTML='<div class="text-xs text-slate-400 py-3">Cargando…</div>';
    try{if(!organizationId)await initializeMembership();const {data,error}=await client.from('projects').select('id,name,status,container_type,solution_type,updated_at').eq('organization_id',organizationId).order('updated_at',{ascending:false}).limit(30);if(error)throw error;
      if(!data?.length){root.innerHTML='<div class="text-xs text-slate-400 py-3">Aún no hay proyectos guardados en la nube.</div>';return;}
      root.innerHTML=data.map(p=>`<button class="bat-cloud-project text-left" data-project-id="${esc(p.id)}"><span class="min-w-0"><span class="block font-bold text-sm truncate">${esc(p.name)}</span><span class="block text-[11px] text-slate-500">${esc(p.container_type||'')} · ${new Date(p.updated_at).toLocaleString('es-CL')}</span></span><i class="fa-solid fa-folder-open text-amber-500"></i></button>`).join('');
      root.querySelectorAll('[data-project-id]').forEach(btn=>btn.addEventListener('click',()=>openCloudProject(btn.dataset.projectId)));
    }catch(error){root.innerHTML=`<div class="text-xs text-red-600 py-3">${esc(error.message||'No se pudieron cargar los proyectos')}</div>`;}
  }

  async function openCloudProject(id){
    try{const {data,error}=await client.from('projects').select('id,project_state').eq('id',id).single();if(error)throw error;if(!data?.project_state)throw new Error('Proyecto sin estado guardado');
      mergeLoadedState(data.project_state);setCurrentProjectId(data.id);try{localStorage.setItem('modular-config-v3',JSON.stringify(state));}catch(e){}closeCloudModal();notify('Proyecto abierto desde la nube');
    }catch(error){notify(`Nube: ${error.message||'error al abrir proyecto'}`);}
  }

  async function init(){
    try{injectUi();const sdk=await loadSdk();client=sdk.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});currentProjectId=getCurrentProjectId();
      const {data}=await client.auth.getSession();session=data.session||null;if(session?.user){try{await initializeMembership();}catch(error){console.warn('[BAT Cloud] membership',error.message);}}
      client.auth.onAuthStateChange(async(_event,newSession)=>{session=newSession;organizationId=null;if(session?.user){try{await initializeMembership();}catch(error){console.warn('[BAT Cloud] membership',error.message);}}updateUi();});
      updateUi();
      window.BAT_KUBIQUEITOR_SUPABASE_CLOUD={version:2,client,save:saveCloudProject,open:openCloudModal,refresh:refreshCloudProjects,getSession:()=>session};
      window.saveProject=async function(){if(typeof localSave==='function')localSave();if(session?.user)await saveCloudProject();};
    }catch(error){console.error('[BAT Cloud] init',error);window.BAT_KUBIQUEITOR_SUPABASE_CLOUD={version:2,error:error.message};}
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,100),{once:true});else setTimeout(init,100);
})();