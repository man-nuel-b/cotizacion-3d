// Production tools for bat-kubiqueitor.
// This file deliberately does NOT own wizard navigation, floor, BOM or calculate().
(function(){
  if(window.BAT_KUBIQUEITOR_PRODUCTION_SUITE) return;
  const VERSION='20261024-2';
  const PROJECT_LIBRARY_KEY='bat-kubiqueitor-projects-v1';

  function ready(){
    return typeof state!=='undefined'&&typeof DATA!=='undefined'&&typeof THREE!=='undefined'&&typeof rebuild3D==='function'&&typeof renderAll==='function';
  }

  function ensureState(){
    if(!state.projectMeta||typeof state.projectMeta!=='object') state.projectMeta={id:null,revision:0,title:''};
    if(!state.production||typeof state.production!=='object') state.production={};
    if(typeof state.production.showFraming!=='boolean') state.production.showFraming=false;
    if(typeof state.production.showSystems!=='boolean') state.production.showSystems=false;
    return state.production;
  }

  function plumbingMetrics(){
    const c=DATA.containers[state.container],mainZ=-c.width/2+.22;
    let branch=0,wet=0,hot=0;
    for(const type of ['wc','sink','shower']){
      for(let i=0;i<(state.counts[type]||0);i++){
        let p={x:0,z:0};try{p=actualLayout(type,i)||p;}catch(e){}
        branch+=Math.abs((p.z||0)-mainZ)+.35;wet++;if(type!=='wc')hot++;
      }
    }
    return {coldPoints:wet,hotPoints:hot,drains:wet,coldMeters:wet?c.length+branch:0,hotMeters:hot?c.length+branch*.65:0,drainMeters:wet?c.length+branch:0};
  }

  function electricalMetrics(){
    const points=state.counts.electrical||0,lights=Math.max(1,Math.ceil(points/3));
    return {points,lights,switches:points?Math.max(1,Math.ceil(lights/2)):0,panel:points?1:0};
  }

  function addSystemsVisuals(){
    ensureState();
    if(!state.production.showSystems||!containerGroup) return;
    const c=DATA.containers[state.container],g=new THREE.Group();g.name='production-systems';
    const blue=mat(0x2563eb,{roughness:.35,metalness:.15}),red=mat(0xdc2626,{roughness:.35,metalness:.15}),gray=mat(0x64748b,{roughness:.55}),yellow=mat(0xf59e0b,{roughness:.45});
    const pm=plumbingMetrics();
    if(pm.coldPoints){
      const z=-c.width/2+.22;g.add(box(c.length-.35,.028,.028,blue,0,.20,z));g.add(box(c.length-.35,.05,.05,gray,0,.11,z+.08));
      if(pm.hotPoints) g.add(box(c.length-.35,.028,.028,red,0,.25,z+.05));
      for(const type of ['wc','sink','shower']) for(let i=0;i<(state.counts[type]||0);i++){
        let p={x:0,z:0};try{p=actualLayout(type,i)||p;}catch(e){}
        const dz=(p.z||0)-z,mid=z+dz/2,len=Math.max(.03,Math.abs(dz));
        g.add(box(.025,.025,len,blue,p.x,.20,mid));g.add(box(.045,.045,len,gray,p.x,.11,mid+.08));
        if(type!=='wc') g.add(box(.025,.025,len,red,p.x,.25,mid+.05));
      }
    }
    const em=electricalMetrics();
    if(em.points){const z=c.width/2-.18;g.add(box(c.length-.35,.025,.025,yellow,0,c.height-.24,z));}
    containerGroup.add(g);
  }

  window.toggleSystemsView=function(){ensureState();state.production.showSystems=!state.production.showSystems;rebuild3D();updateToolbar();};

  const rebuildBeforeProduction=rebuild3D;
  rebuild3D=function(){rebuildBeforeProduction();addSystemsVisuals();};

  function renderSystemsConfig(){
    const extras=document.getElementById('extras-list');if(!extras)return;
    let root=document.getElementById('production-systems-config');
    if(!root){root=document.createElement('div');root.id='production-systems-config';root.className='mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3';extras.insertAdjacentElement('afterend',root);}
    const p=plumbingMetrics(),e=electricalMetrics();
    root.innerHTML=`<div class="text-[10px] font-black uppercase tracking-widest text-amber-600">Instalaciones</div><div class="grid grid-cols-2 gap-2 mt-2"><div class="rounded-xl bg-white border p-2"><div class="text-[10px] font-black">Sanitario</div><div class="text-[9px] text-slate-500 mt-1">${p.coldPoints} AF · ${p.hotPoints} AC · ${p.drains} desagües</div></div><div class="rounded-xl bg-white border p-2"><div class="text-[10px] font-black">Eléctrico</div><div class="text-[9px] text-slate-500 mt-1">${e.points} puntos · ${e.lights} luminarias</div></div></div><button type="button" onclick="toggleSystemsView()" class="mt-2 w-full rounded-xl border bg-white py-2 text-[10px] font-black">${state.production.showSystems?'Ocultar recorridos':'Ver recorridos de instalaciones'}</button>`;
  }

  function installToolbar(){
    const toolbar=document.querySelector('.viewer-toolbar');if(!toolbar||document.getElementById('production-toolbar'))return;
    const wrap=document.createElement('div');wrap.id='production-toolbar';wrap.className='inline-flex gap-1';wrap.innerHTML=`<button id="production-systems-btn" class="viewer-pill rounded-xl px-3 py-2 text-xs font-semibold" onclick="toggleSystemsView()"><i class="fa-solid fa-route mr-1"></i> Instalaciones</button>`;
    toolbar.insertBefore(wrap,toolbar.querySelector('.presentation-trigger')||null);updateToolbar();
  }
  function updateToolbar(){document.getElementById('production-systems-btn')?.classList.toggle('interaction-active',Boolean(state.production?.showSystems));}

  function projectLibrary(){try{const parsed=JSON.parse(localStorage.getItem(PROJECT_LIBRARY_KEY)||'[]');return Array.isArray(parsed)?parsed:[];}catch(e){return [];}}
  function writeProjectLibrary(items){localStorage.setItem(PROJECT_LIBRARY_KEY,JSON.stringify(items));}
  function projectTitle(){const c=state.customer||{};return (c.company||c.name||state.projectMeta?.title||DATA.solutions[state.solution]?.name||'Proyecto modular').trim();}
  function makeProjectId(){return `BK-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2,5).toUpperCase()}`;}

  saveProject=function(){
    ensureState();const library=projectLibrary();let id=state.projectMeta.id||makeProjectId(),entry=library.find(p=>p.id===id);
    if(!entry){entry={id,title:projectTitle(),createdAt:new Date().toISOString(),updatedAt:null,revisions:[]};library.unshift(entry);}
    const revision=(entry.revisions?.length||0)+1;state.projectMeta={id,revision,title:projectTitle()};
    const snapshot={revision,savedAt:new Date().toISOString(),state:clone(state),view:currentView};entry.title=projectTitle();entry.updatedAt=snapshot.savedAt;entry.revisions=entry.revisions||[];entry.revisions.push(snapshot);if(entry.revisions.length>20)entry.revisions.shift();
    writeProjectLibrary(library);localStorage.setItem('modular-config-v3',JSON.stringify(state));toast(`Proyecto guardado · versión ${revision}`);renderProjectLibraryModal();
  };

  function ensureProjectLibraryModal(){
    if(document.getElementById('project-library-modal'))return;
    const modal=document.createElement('div');modal.id='project-library-modal';modal.className='fixed inset-0 z-50 modal-backdrop hidden items-center justify-center p-4';modal.innerHTML=`<div class="modal-panel bg-white w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col"><div class="px-5 py-4 border-b flex items-center justify-between"><div><h3 class="font-black text-lg">Proyectos guardados</h3><p class="text-xs text-slate-500">Cada guardado crea una versión.</p></div><button onclick="closeModal('project-library-modal')" class="w-9 h-9 rounded-full bg-slate-100"><i class="fa-solid fa-xmark"></i></button></div><div id="project-library-list" class="modal-body p-5 space-y-3"></div></div>`;document.body.appendChild(modal);
  }
  function renderProjectLibraryModal(){
    ensureProjectLibraryModal();const root=document.getElementById('project-library-list');if(!root)return;const items=projectLibrary();
    root.innerHTML=items.length?items.map(p=>`<div class="rounded-xl border p-3 flex items-center gap-3 justify-between"><div><div class="font-black text-sm">${escapeHtml(p.title)}</div><div class="text-[10px] text-slate-500">${p.id} · ${p.revisions?.length||0} versiones</div></div><div class="flex gap-2"><button onclick="loadLibraryProject('${p.id}')" class="px-3 py-2 rounded-lg bg-slate-950 text-white text-xs font-bold">Abrir</button><button onclick="deleteLibraryProject('${p.id}')" class="px-3 py-2 rounded-lg bg-red-50 text-red-700 text-xs font-bold">Eliminar</button></div></div>`).join(''):'<div class="text-sm text-slate-500">Todavía no hay proyectos guardados.</div>';
  }
  window.openProjectLibrary=function(){ensureProjectLibraryModal();renderProjectLibraryModal();showModal('project-library-modal');};
  window.loadLibraryProject=function(id){const entry=projectLibrary().find(p=>p.id===id),snap=entry?.revisions?.at?.(-1)||entry?.revisions?.[entry.revisions.length-1];if(!snap)return;state={...clone(DEFAULT_STATE),...clone(snap.state),counts:{...DEFAULT_STATE.counts,...(snap.state.counts||{})},customer:{...DEFAULT_STATE.customer,...(snap.state.customer||{})}};ensureState();closeModal('project-library-modal');renderAll();setView(snap.view||'exterior');toast(`Proyecto abierto · versión ${snap.revision}`);};
  window.deleteLibraryProject=function(id){if(!confirm('¿Eliminar este proyecto guardado?'))return;writeProjectLibrary(projectLibrary().filter(p=>p.id!==id));renderProjectLibraryModal();};

  function installProjectButton(){
    if(document.getElementById('project-library-btn'))return;const save=[...document.querySelectorAll('button')].find(b=>(b.textContent||'').includes('Guardar'));if(!save)return;
    const btn=document.createElement('button');btn.id='project-library-btn';btn.onclick=openProjectLibrary;btn.className='hidden md:inline-flex px-3 py-2 rounded-lg bg-slate-900 text-xs font-semibold';btn.innerHTML='<i class="fa-solid fa-folder-open text-amber-400 mr-1"></i> Proyectos';save.insertAdjacentElement('afterend',btn);
  }

  function renderQuoteTechnicalSpecs(){
    const quote=document.getElementById('quote-print');if(!quote)return;const p=plumbingMetrics(),e=electricalMetrics();
    let root=document.getElementById('production-quote-specs');if(!root){root=document.createElement('div');root.id='production-quote-specs';root.className='mt-6 rounded-xl border p-4';quote.insertBefore(root,quote.querySelector('.mt-7.pt-4')||null);}
    const floor=window.BAT_KUBIQUEITOR_FLOOR_FINISHES?.floors?.[state.floorFinish]?.name||'Por definir';
    root.innerHTML=`<div class="text-[11px] font-black uppercase text-slate-400 mb-2">Especificación técnica</div><div class="grid md:grid-cols-2 gap-x-6 gap-y-2 text-xs"><div><strong>Piso:</strong> ${floor}</div><div><strong>Tabiques:</strong> ${state.counts.partition||0}</div><div><strong>Sanitario:</strong> ${p.coldPoints} AF · ${p.hotPoints} AC · ${p.drains} desagües</div><div><strong>Electricidad:</strong> ${e.points} puntos · ${e.lights} luminarias</div></div>`;
  }
  if(typeof openQuote==='function'){const before=openQuote;openQuote=function(){before();renderQuoteTechnicalSpecs();};}

  const renderAllBeforeProduction=renderAll;
  renderAll=function(){ensureState();renderAllBeforeProduction();renderSystemsConfig();installToolbar();installProjectButton();updateToolbar();};

  function install(){
    if(!ready())return false;ensureState();installToolbar();installProjectButton();renderSystemsConfig();
    if(!document.getElementById('production-suite-style')){const s=document.createElement('style');s.id='production-suite-style';s.textContent='#production-toolbar .interaction-active{background:#f59e0b!important;color:#0f172a!important;border-color:#f59e0b!important}@media(max-width:900px){#production-toolbar{display:none}}';document.head.appendChild(s);}
    window.BAT_KUBIQUEITOR_PRODUCTION_SUITE={version:VERSION,installed:true};return true;
  }
  function boot(attempt=0){if(install())return;if(attempt<30)setTimeout(()=>boot(attempt+1),100);}
  if(document.readyState==='loading')window.addEventListener('DOMContentLoaded',()=>boot(),{once:true});else boot();
})();