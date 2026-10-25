// Stage 02 · multicontenedor horizontal. Isolated from the existing object editor.
(function(){
  if(window.BAT_KUBIQUEITOR_MULTI_CONTAINER) return;

  const MAX_MODULES=4;
  const SNAP_DISTANCE=.42;
  const GAP=.04;
  const state2={enabled:false,selectedId:'M1',dragging:false,dragOffset:new THREE.Vector3(),modules:[{id:'M1',type:null,x:0,z:0,rotation:0,group:null}]};
  const raycaster=new THREE.Raycaster();
  const pointer=new THREE.Vector2();
  const plane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
  const hitPoint=new THREE.Vector3();
  let extraRoot=null;
  let panel=null;
  let originalRebuild=null;

  function moduleDef(type){ return DATA.containers[type]||DATA.containers[state.container]; }
  function normalizedRotation(r){ return Math.abs((((r%(Math.PI*2))+Math.PI*2)%(Math.PI*2))-Math.PI/2)<.001?Math.PI/2:0; }
  function footprint(m){
    const c=moduleDef(m.type||state.container);
    const quarter=Math.abs(Math.sin(normalizedRotation(m.rotation)))>.5;
    return {w:quarter?c.width:c.length,d:quarter?c.length:c.width};
  }
  function bounds(m){const f=footprint(m);return {minX:m.x-f.w/2,maxX:m.x+f.w/2,minZ:m.z-f.d/2,maxZ:m.z+f.d/2,w:f.w,d:f.d};}
  function moduleById(id){return state2.modules.find(m=>m.id===id)||null;}
  function nextId(){for(let i=1;i<=MAX_MODULES;i++){const id=`M${i}`;if(!moduleById(id))return id;}return null;}
  function colorMaterial(){const ext=new THREE.Color(state.exteriorColor);return {exterior:mat(ext,{roughness:.58,metalness:.2}),interior:mat(state.finish==='sanitary'?0xf8fafc:0xf1f5f9,{roughness:state.finish==='sanitary'?.32:.82}),frame:mat(ext.clone().multiplyScalar(.55),{roughness:.42,metalness:.48}),floor:createFloorMaterial()};}

  function ensureRoot(){
    if(!scene) return null;
    if(!extraRoot){extraRoot=new THREE.Group();extraRoot.name='multiContainerRoot';scene.add(extraRoot);}
    return extraRoot;
  }
  function clearExtras(){if(!extraRoot)return;disposeGroup(extraRoot);}
  function tagGroup(group,m){group.userData.moduleRoot=true;group.userData.moduleId=m.id;group.traverse(o=>{o.userData.moduleId=m.id;});}
  function buildSecondary(m){
    const c=moduleDef(m.type);
    const g=createContainerShell(c,colorMaterial());
    g.position.set(m.x,0,m.z);g.rotation.y=m.rotation||0;tagGroup(g,m);return g;
  }
  function syncM1(){
    const m=moduleById('M1');if(!m||!containerGroup)return;
    m.type=state.container;m.group=containerGroup;
    containerGroup.position.set(m.x,0,m.z);containerGroup.rotation.y=m.rotation||0;tagGroup(containerGroup,m);
  }
  function renderModules(){
    if(!containerGroup||!scene)return;
    syncM1();ensureRoot();clearExtras();
    state2.modules.filter(m=>m.id!=='M1').forEach(m=>{m.group=buildSecondary(m);extraRoot.add(m.group);});
    applySelectionVisual();updatePanel();
  }
  function applySelectionVisual(){
    state2.modules.forEach(m=>{
      if(!m.group)return;
      m.group.traverse(o=>{if(!o.isMesh)return;if(!o.userData.mcOriginalEmissive&&o.material&&o.material.emissive){o.userData.mcOriginalEmissive=o.material.emissive.clone();o.userData.mcOriginalEI=o.material.emissiveIntensity||0;}if(o.material&&o.material.emissive&&o.userData.mcOriginalEmissive){o.material.emissive.copy(o.userData.mcOriginalEmissive);o.material.emissiveIntensity=o.userData.mcOriginalEI||0;if(state2.enabled&&m.id===state2.selectedId){o.material.emissive.add(new THREE.Color(0x5a3a00));o.material.emissiveIntensity=Math.max(.18,o.material.emissiveIntensity||0);}}});
    });
  }

  function addStyles(){
    if(document.getElementById('mc-stage2-style'))return;
    const s=document.createElement('style');s.id='mc-stage2-style';s.textContent=`
      #mc-stage2-toggle{position:absolute;left:14px;bottom:18px;z-index:29;border:1px solid rgba(245,158,11,.48);border-radius:13px;padding:10px 12px;background:rgba(15,23,42,.92);color:#fff;font-size:11px;font-weight:850;box-shadow:0 10px 28px rgba(2,6,23,.3);backdrop-filter:blur(12px)}
      #mc-stage2-toggle.active{background:#f59e0b;color:#0f172a;border-color:#f59e0b}
      #mc-stage2-panel{position:absolute;left:14px;bottom:64px;z-index:29;width:284px;border:1px solid rgba(245,158,11,.34);border-radius:16px;background:rgba(15,23,42,.94);color:#fff;box-shadow:0 18px 40px rgba(2,6,23,.34);backdrop-filter:blur(14px);padding:13px;display:none}
      #mc-stage2-panel.open{display:block}.mc-row{display:flex;gap:7px;align-items:center}.mc-btn{border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.08);border-radius:10px;padding:8px 9px;font-size:10px;font-weight:800;color:#fff}.mc-btn:hover{background:rgba(255,255,255,.13)}.mc-btn.warn{color:#fecaca;border-color:rgba(248,113,113,.25);background:rgba(127,29,29,.18)}
      .mc-module{border:1px solid rgba(255,255,255,.1);border-radius:11px;padding:8px 9px;cursor:pointer;background:rgba(255,255,255,.045)}.mc-module.sel{border-color:#f59e0b;background:rgba(245,158,11,.13)}
      @media(max-width:820px){#mc-stage2-panel{left:10px;right:10px;bottom:68px;width:auto}#mc-stage2-toggle{left:10px;bottom:18px}}
    `;document.head.appendChild(s);
  }
  function installUi(){
    const viewer=document.querySelector('.viewer-wrap');if(!viewer)return false;addStyles();
    let toggle=document.getElementById('mc-stage2-toggle');
    if(!toggle){toggle=document.createElement('button');toggle.id='mc-stage2-toggle';toggle.type='button';toggle.innerHTML='<i class="fa-solid fa-cubes-stacked mr-1"></i> Multicontenedor';toggle.addEventListener('click',()=>setEnabled(!state2.enabled));viewer.appendChild(toggle);}
    panel=document.getElementById('mc-stage2-panel');
    if(!panel){panel=document.createElement('div');panel.id='mc-stage2-panel';viewer.appendChild(panel);}
    updatePanel();return true;
  }
  function setEnabled(v){state2.enabled=Boolean(v);const t=document.getElementById('mc-stage2-toggle');t?.classList.toggle('active',state2.enabled);panel?.classList.toggle('open',state2.enabled);if(controls)controls.enabled=!state2.dragging;applySelectionVisual();updatePanel();}
  function updatePanel(){
    if(!panel)return;const sel=moduleById(state2.selectedId)||state2.modules[0];const c=moduleDef(sel?.type||state.container);panel.innerHTML=`
      <div class="flex items-start justify-between gap-2"><div><div class="text-[10px] uppercase tracking-widest text-amber-400 font-black">Etapa 02</div><div class="font-black text-sm mt-1">Multicontenedor horizontal</div><div class="text-[10px] text-slate-400 mt-1">Selecciona y arrastra módulos. El snap alinea bordes automáticamente.</div></div><span class="text-[10px] font-black text-amber-300">${state2.modules.length}/${MAX_MODULES}</span></div>
      <div class="grid grid-cols-2 gap-2 mt-3">${state2.modules.map(m=>`<button class="mc-module ${m.id===state2.selectedId?'sel':''}" data-mcid="${m.id}"><div class="font-black text-xs">${m.id}</div><div class="text-[9px] text-slate-400">${moduleDef(m.type||state.container).short} · ${Math.round((m.rotation||0)*180/Math.PI)}°</div></button>`).join('')}</div>
      <div class="mc-row mt-3"><button class="mc-btn flex-1" data-mcadd ${state2.modules.length>=MAX_MODULES?'disabled':''}><i class="fa-solid fa-plus mr-1"></i>Agregar módulo</button><button class="mc-btn" data-mcrot><i class="fa-solid fa-rotate-right"></i> 90°</button></div>
      <div class="mc-row mt-2"><button class="mc-btn flex-1" data-mccenter><i class="fa-solid fa-crosshairs mr-1"></i>Centrar vista</button>${sel&&sel.id!=='M1'?'<button class="mc-btn warn" data-mcdel><i class="fa-solid fa-trash"></i></button>':''}</div>
      <div class="mt-3 pt-3 border-t border-white/10 text-[10px] text-slate-400">Seleccionado: <strong class="text-white">${sel?.id||'M1'}</strong> · ${c.length.toFixed(2)} × ${c.width.toFixed(2)} m</div>`;
    panel.querySelectorAll('[data-mcid]').forEach(b=>b.addEventListener('click',()=>selectModule(b.dataset.mcid)));
    panel.querySelector('[data-mcadd]')?.addEventListener('click',addModule);
    panel.querySelector('[data-mcrot]')?.addEventListener('click',rotateSelected);
    panel.querySelector('[data-mccenter]')?.addEventListener('click',fitModules);
    panel.querySelector('[data-mcdel]')?.addEventListener('click',deleteSelected);
  }
  function selectModule(id){if(moduleById(id)){state2.selectedId=id;applySelectionVisual();updatePanel();}}
  function addModule(){
    if(state2.modules.length>=MAX_MODULES)return toast?.('Máximo 4 módulos en esta etapa');
    const id=nextId();if(!id)return;const base=moduleById(state2.selectedId)||state2.modules[0];const bf=footprint(base);const type=state.container;const nf=footprint({type,rotation:0});
    const m={id,type,x:base.x+(bf.w+nf.w)/2+GAP,z:base.z,rotation:0,group:null};state2.modules.push(m);state2.selectedId=id;renderModules();fitModules();toast?.(`${id} agregado`);
  }
  function rotateSelected(){const m=moduleById(state2.selectedId);if(!m)return;m.rotation=normalizedRotation((m.rotation||0)+Math.PI/2);renderModules();}
  function deleteSelected(){const m=moduleById(state2.selectedId);if(!m||m.id==='M1')return;state2.modules=state2.modules.filter(x=>x!==m);state2.selectedId='M1';renderModules();}

  function pointerNdc(ev){const r=renderer.domElement.getBoundingClientRect();pointer.x=((ev.clientX-r.left)/r.width)*2-1;pointer.y=-((ev.clientY-r.top)/r.height)*2+1;raycaster.setFromCamera(pointer,camera);}
  function moduleFromObject(o){let n=o;while(n){if(n.userData?.moduleRoot)return moduleById(n.userData.moduleId);n=n.parent;}return null;}
  function pickModule(ev){pointerNdc(ev);const roots=state2.modules.map(m=>m.group).filter(Boolean);const hits=raycaster.intersectObjects(roots,true);for(const h of hits){const m=moduleFromObject(h.object);if(m)return m;}return null;}
  function groundPoint(ev){pointerNdc(ev);return raycaster.ray.intersectPlane(plane,hitPoint)?hitPoint:null;}
  function snapModule(m){
    let bestX=m.x,bestZ=m.z,bestDX=SNAP_DISTANCE+1,bestDZ=SNAP_DISTANCE+1;const fb=footprint(m);
    state2.modules.filter(o=>o!==m).forEach(o=>{const ob=bounds(o);const candidatesX=[ob.maxX+fb.w/2+GAP,ob.minX-fb.w/2-GAP,o.x];const candidatesZ=[ob.maxZ+fb.d/2+GAP,ob.minZ-fb.d/2-GAP,o.z];candidatesX.forEach(v=>{const d=Math.abs(m.x-v);if(d<bestDX){bestDX=d;bestX=v;}});candidatesZ.forEach(v=>{const d=Math.abs(m.z-v);if(d<bestDZ){bestDZ=d;bestZ=v;}});});
    if(bestDX<=SNAP_DISTANCE)m.x=bestX;if(bestDZ<=SNAP_DISTANCE)m.z=bestZ;
  }
  function onPointerDown(ev){if(!state2.enabled||!renderer)return;const m=pickModule(ev);if(!m)return;ev.preventDefault();ev.stopPropagation();selectModule(m.id);const p=groundPoint(ev);if(!p)return;state2.dragging=true;state2.dragOffset.set(m.x-p.x,0,m.z-p.z);if(controls)controls.enabled=false;}
  function onPointerMove(ev){if(!state2.enabled||!state2.dragging)return;const m=moduleById(state2.selectedId),p=groundPoint(ev);if(!m||!p)return;m.x=p.x+state2.dragOffset.x;m.z=p.z+state2.dragOffset.z;snapModule(m);if(m.group){m.group.position.x=m.x;m.group.position.z=m.z;} }
  function onPointerUp(){if(!state2.dragging)return;state2.dragging=false;if(controls)controls.enabled=true;updatePanel();}
  function installPointer(){if(!renderer?.domElement)return false;renderer.domElement.addEventListener('pointerdown',onPointerDown,true);window.addEventListener('pointermove',onPointerMove,true);window.addEventListener('pointerup',onPointerUp,true);return true;}

  function fitModules(){
    if(!camera||!controls||!state2.modules.length)return;const bs=state2.modules.map(bounds);const minX=Math.min(...bs.map(b=>b.minX)),maxX=Math.max(...bs.map(b=>b.maxX)),minZ=Math.min(...bs.map(b=>b.minZ)),maxZ=Math.max(...bs.map(b=>b.maxZ));const cx=(minX+maxX)/2,cz=(minZ+maxZ)/2,span=Math.max(maxX-minX,maxZ-minZ,6);animateCamera([cx+span*.7,Math.max(5,span*.65),cz+span*.75],[cx,1,cz],560);
  }
  function hookRebuild(){
    if(originalRebuild)return true;if(typeof rebuild3D!=='function')return false;originalRebuild=rebuild3D;rebuild3D=function(){originalRebuild();renderModules();};renderModules();return true;
  }
  function expose(){window.BAT_KUBIQUEITOR_MULTI_CONTAINER={version:1,state:state2,enable:()=>setEnabled(true),disable:()=>setEnabled(false),add:addModule,rotate:rotateSelected,fit:fitModules};}
  function boot(){const ok=installUi()&&hookRebuild()&&installPointer();if(!ok){setTimeout(boot,120);return;}expose();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,180),{once:true});else setTimeout(boot,180);
})();
