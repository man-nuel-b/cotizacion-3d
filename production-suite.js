// Production tools for bat-kubiqueitor.
// Full technical functionality without owning wizard navigation, floor, BOM or calculate().
(function(){
  if(window.BAT_KUBIQUEITOR_PRODUCTION_SUITE) return;
  const VERSION='20261024-3';
  const PROJECT_LIBRARY_KEY='bat-kubiqueitor-projects-v1';

  function ready(){
    return typeof state!=='undefined'&&typeof DATA!=='undefined'&&typeof THREE!=='undefined'&&typeof rebuild3D==='function'&&typeof renderAll==='function';
  }

  function ensureState(){
    if(!Array.isArray(state.interiorDoors)) state.interiorDoors=[];
    if(!state.projectMeta||typeof state.projectMeta!=='object') state.projectMeta={id:null,revision:0,title:''};
    if(!state.production||typeof state.production!=='object') state.production={};
    if(typeof state.production.showFraming!=='boolean') state.production.showFraming=false;
    if(typeof state.production.showSystems!=='boolean') state.production.showSystems=false;
    if(typeof state.production.autoPlumbing!=='boolean') state.production.autoPlumbing=true;
    if(typeof state.production.autoElectrical!=='boolean') state.production.autoElectrical=true;
    return state.production;
  }

  function interiorDoor(index){ensureState();return state.interiorDoors[index]||null;}
  function normalizedDoor(index){
    if(typeof objectDimensions!=='function')return null;
    const d=objectDimensions('partition',index),stored=interiorDoor(index);if(!stored)return null;
    const maxWidth=Math.max(.60,d.length-.16),width=clamp(Number(stored.width)||.82,.60,Math.min(1.20,maxWidth)),height=clamp(Number(stored.height)||2.05,1.70,Math.max(1.70,d.height-.04)),limit=Math.max(0,d.length/2-width/2-.06),offset=clamp(Number(stored.offset)||0,-limit,limit);
    return{width,height,offset};
  }

  window.addInteriorDoorToSelectedPartition=function(){
    if(!selectedEditable||selectedEditable.type!=='partition')return toast('Selecciona un tabique interior');
    const i=selectedEditable.index,d=objectDimensions('partition',i);if(d.length<.78||d.height<1.78)return toast('El tabique es demasiado pequeño para una puerta');
    pushHistory();ensureState();state.interiorDoors[i]={width:Math.min(.82,d.length-.16),height:Math.min(2.05,d.height-.04),offset:0};renderAll();toast('Puerta interior agregada');
  };
  window.removeInteriorDoorFromSelectedPartition=function(){if(!selectedEditable||selectedEditable.type!=='partition')return;pushHistory();state.interiorDoors[selectedEditable.index]=null;renderAll();toast('Puerta interior eliminada');};
  window.updateInteriorDoor=function(key,value){
    if(!selectedEditable||selectedEditable.type!=='partition')return;const i=selectedEditable.index,current=normalizedDoor(i),v=Number(value);if(!current||!Number.isFinite(v))return;pushHistory();state.interiorDoors[i]={...current,[key]:v};state.interiorDoors[i]=normalizedDoor(i);renderAll();
  };

  function createPartitionWithOpening(index,d){
    const door=normalizedDoor(index);if(!door||typeof createParametricPartition!=='function')return createParametricPartition(d.length,d.height,d.thickness);
    const g=new THREE.Group(),wall=typeof interiorSystemMaterial==='function'?interiorSystemMaterial():mat(0xeeeae2,{roughness:.72}),trim=mat(0xcbd5e1,{roughness:.42,metalness:.2}),leaf=mat(0x8b6f47,{roughness:.62,metalness:.02});
    const start=-d.length/2,end=d.length/2,a=door.offset-door.width/2,b=door.offset+door.width/2,left=Math.max(0,a-start),right=Math.max(0,end-b);
    if(left>.015)g.add(box(d.thickness,d.height,left,wall,0,d.height/2,start+left/2));
    if(right>.015)g.add(box(d.thickness,d.height,right,wall,0,d.height/2,b+right/2));
    const header=Math.max(.02,d.height-door.height);if(header>.015)g.add(box(d.thickness,header,door.width,wall,0,door.height+header/2,door.offset));
    const jamb=.035;g.add(box(d.thickness+.02,door.height,jamb,trim,0,door.height/2,a));g.add(box(d.thickness+.02,door.height,jamb,trim,0,door.height/2,b));g.add(box(d.thickness+.02,jamb,door.width+jamb*2,trim,0,door.height,door.offset));
    const doorLeaf=box(.035,door.height-.045,door.width-.06,leaf,d.thickness/2+.027,(door.height-.045)/2,door.offset);g.add(doorLeaf);g.userData.interiorDoor=true;return g;
  }

  if(typeof rebuildParametricPartitions==='function'){
    rebuildParametricPartitions=function(){
      if(!containerGroup)return;ensureLayoutState();ensureDimensionState();ensureState();if(typeof normalizeAllPartitionsInsideContainer==='function')normalizeAllPartitionsInsideContainer();
      const old=editableObjects.filter(root=>root.userData.editor?.type==='partition');old.forEach(root=>typeof disposePartitionRoot==='function'?disposePartitionRoot(root):containerGroup.remove(root));editableObjects=editableObjects.filter(root=>root.userData.editor?.type!=='partition');
      for(let i=0;i<(state.counts.partition||0);i++){
        const p=actualLayout('partition',i),d=objectDimensions('partition',i),layout=state.layout.partition[i]||{},axisCenter=Number.isFinite(layout.axisCenter)?layout.axisCenter:0,obj=createPartitionWithOpening(i,d),y=.08+(d.elevation||0);
        if(p.orientation===PARTITION_ORIENTATION.LONG){addGroup(containerGroup,obj,axisCenter,y,p.z,Math.PI/2);registerEditable(obj,'partition',i,{axis:'z',surface:'floor',orientation:p.orientation});}
        else{addGroup(containerGroup,obj,p.x,y,axisCenter,0);registerEditable(obj,'partition',i,{axis:'x',surface:'floor',orientation:p.orientation});}
      }
      if(selectedEditable?.type==='partition'){
        const root=editableObjects.find(o=>o.userData.editor?.type==='partition'&&o.userData.editor?.index===selectedEditable.index);if(root){addSelectionOutline(root);showEditorPanel(root);}
      }
    };
  }

  function renderPartitionDoorEditor(index){
    const panel=document.getElementById('object-editor');if(!panel)return;let root=document.getElementById('partition-door-editor');
    if(!root){root=document.createElement('div');root.id='partition-door-editor';root.className='mt-3 rounded-xl border border-white/10 bg-white/5 p-3';panel.appendChild(root);}
    const door=normalizedDoor(index);
    if(!door){root.innerHTML=`<div class="text-[10px] font-black tracking-widest text-amber-400">PUERTA INTERIOR</div><button type="button" onclick="addInteriorDoorToSelectedPartition()" class="mt-2 w-full rounded-lg bg-amber-500 text-slate-950 py-2 text-xs font-black"><i class="fa-solid fa-door-open mr-1"></i> Agregar puerta</button>`;return;}
    root.innerHTML=`<div class="flex items-center justify-between"><div class="text-[10px] font-black tracking-widest text-amber-400">PUERTA INTERIOR</div><button type="button" onclick="removeInteriorDoorFromSelectedPartition()" class="text-[10px] text-red-300">Eliminar</button></div><div class="grid grid-cols-3 gap-2 mt-2"><label class="text-[9px] text-slate-400">Ancho<input type="number" min=".60" max="1.20" step=".05" value="${door.width.toFixed(2)}" onchange="updateInteriorDoor('width',this.value)" class="mt-1 w-full rounded-lg bg-white/10 px-2 py-1.5 text-white"></label><label class="text-[9px] text-slate-400">Alto<input type="number" min="1.70" step=".05" value="${door.height.toFixed(2)}" onchange="updateInteriorDoor('height',this.value)" class="mt-1 w-full rounded-lg bg-white/10 px-2 py-1.5 text-white"></label><label class="text-[9px] text-slate-400">Posición<input type="number" step=".05" value="${door.offset.toFixed(2)}" onchange="updateInteriorDoor('offset',this.value)" class="mt-1 w-full rounded-lg bg-white/10 px-2 py-1.5 text-white"></label></div>`;
  }

  if(typeof showEditorPanel==='function'){
    const showEditorPanelBeforeProduction=showEditorPanel;
    showEditorPanel=function(root){showEditorPanelBeforeProduction(root);document.getElementById('partition-door-editor')?.remove();if(root?.userData.editor?.type==='partition')renderPartitionDoorEditor(root.userData.editor.index);};
  }

  function plumbingMetrics(){
    const c=DATA.containers[state.container],mainZ=-c.width/2+.22;let branch=0,wet=0,hot=0;
    for(const type of ['wc','sink','shower'])for(let i=0;i<(state.counts[type]||0);i++){let p={x:0,z:0};try{p=actualLayout(type,i)||p;}catch(e){}branch+=Math.abs((p.z||0)-mainZ)+.35;wet++;if(type!=='wc')hot++;}
    return{coldPoints:wet,hotPoints:hot,drains:wet,coldMeters:wet?c.length+branch:0,hotMeters:hot?c.length+branch*.65:0,drainMeters:wet?c.length+branch:0};
  }
  function electricalMetrics(){const points=state.counts.electrical||0,lights=Math.max(1,Math.ceil(points/3));return{points,lights,switches:points?Math.max(1,Math.ceil(lights/2)):0,panel:points?1:0};}

  function addFramingVisuals(){
    ensureState();if(!state.production.showFraming||!containerGroup)return;const c=DATA.containers[state.container],g=new THREE.Group(),m=mat(0xcbd5e1,{roughness:.45,metalness:.25});g.name='production-framing';
    const z1=-c.width/2+.12,z2=c.width/2-.12;for(let x=-c.length/2+.2;x<=c.length/2-.2;x+=.6){g.add(box(.035,c.height-.25,.035,m,x,c.height/2,z1));g.add(box(.035,c.height-.25,.035,m,x,c.height/2,z2));}containerGroup.add(g);
  }
  function addSystemsVisuals(){
    ensureState();if(!state.production.showSystems||!containerGroup)return;const c=DATA.containers[state.container],g=new THREE.Group();g.name='production-systems';const blue=mat(0x2563eb,{roughness:.35}),red=mat(0xdc2626,{roughness:.35}),gray=mat(0x64748b,{roughness:.55}),yellow=mat(0xf59e0b,{roughness:.45}),pm=plumbingMetrics();
    if(pm.coldPoints){const z=-c.width/2+.22;g.add(box(c.length-.35,.028,.028,blue,0,.20,z));g.add(box(c.length-.35,.05,.05,gray,0,.11,z+.08));if(pm.hotPoints)g.add(box(c.length-.35,.028,.028,red,0,.25,z+.05));}
    if(electricalMetrics().points){const z=c.width/2-.18;g.add(box(c.length-.35,.025,.025,yellow,0,c.height-.24,z));}containerGroup.add(g);
  }
  window.toggleConstructionView=function(){ensureState();state.production.showFraming=!state.production.showFraming;rebuild3D();updateToolbar();};
  window.toggleSystemsView=function(){ensureState();state.production.showSystems=!state.production.showSystems;rebuild3D();updateToolbar();};

  const rebuildBeforeProduction=rebuild3D;
  rebuild3D=function(){rebuildBeforeProduction();addFramingVisuals();addSystemsVisuals();};

  function renderSystemsConfig(){
    const extras=document.getElementById('extras-list');if(!extras)return;let root=document.getElementById('production-systems-config');if(!root){root=document.createElement('div');root.id='production-systems-config';root.className='mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3';extras.insertAdjacentElement('afterend',root);}const p=plumbingMetrics(),e=electricalMetrics();
    root.innerHTML=`<div class="text-[10px] font-black uppercase tracking-widest text-amber-600">Instalaciones</div><div class="grid grid-cols-2 gap-2 mt-2"><div class="rounded-xl bg-white border p-2"><div class="text-[10px] font-black">Sanitario</div><div class="text-[9px] text-slate-500 mt-1">${p.coldPoints} AF · ${p.hotPoints} AC · ${p.drains} desagües</div></div><div class="rounded-xl bg-white border p-2"><div class="text-[10px] font-black">Eléctrico</div><div class="text-[9px] text-slate-500 mt-1">${e.points} puntos · ${e.lights} luminarias</div></div></div><div class="grid grid-cols-2 gap-2 mt-2"><button type="button" onclick="toggleConstructionView()" class="rounded-xl border bg-white py-2 text-[10px] font-black">${state.production.showFraming?'Ocultar estructura':'Ver estructura'}</button><button type="button" onclick="toggleSystemsView()" class="rounded-xl border bg-white py-2 text-[10px] font-black">${state.production.showSystems?'Ocultar recorridos':'Ver instalaciones'}</button></div>`;
  }

  function installToolbar(){
    const toolbar=document.querySelector('.viewer-toolbar');if(!toolbar||document.getElementById('production-toolbar'))return;const wrap=document.createElement('div');wrap.id='production-toolbar';wrap.className='inline-flex gap-1';wrap.innerHTML=`<button id="production-framing-btn" class="viewer-pill rounded-xl px-3 py-2 text-xs font-semibold" onclick="toggleConstructionView()"><i class="fa-solid fa-screwdriver-wrench mr-1"></i> Estructura</button><button id="production-systems-btn" class="viewer-pill rounded-xl px-3 py-2 text-xs font-semibold" onclick="toggleSystemsView()"><i class="fa-solid fa-route mr-1"></i> Instalaciones</button>`;toolbar.insertBefore(wrap,toolbar.querySelector('.presentation-trigger')||null);updateToolbar();
  }
  function updateToolbar(){document.getElementById('production-framing-btn')?.classList.toggle('interaction-active',Boolean(state.production?.showFraming));document.getElementById('production-systems-btn')?.classList.toggle('interaction-active',Boolean(state.production?.showSystems));}

  function projectLibrary(){try{const parsed=JSON.parse(localStorage.getItem(PROJECT_LIBRARY_KEY)||'[]');return Array.isArray(parsed)?parsed:[];}catch(e){return[];}}
  function writeProjectLibrary(items){localStorage.setItem(PROJECT_LIBRARY_KEY,JSON.stringify(items));}
  function projectTitle(){const c=state.customer||{};return(c.company||c.name||state.projectMeta?.title||DATA.solutions[state.solution]?.name||'Proyecto modular').trim();}
  function makeProjectId(){return`BK-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2,5).toUpperCase()}`;}
  saveProject=function(){ensureState();const library=projectLibrary();let id=state.projectMeta.id||makeProjectId(),entry=library.find(p=>p.id===id);if(!entry){entry={id,title:projectTitle(),createdAt:new Date().toISOString(),updatedAt:null,revisions:[]};library.unshift(entry);}const revision=(entry.revisions?.length||0)+1;state.projectMeta={id,revision,title:projectTitle()};const snapshot={revision,savedAt:new Date().toISOString(),state:clone(state),view:currentView};entry.title=projectTitle();entry.updatedAt=snapshot.savedAt;entry.revisions=entry.revisions||[];entry.revisions.push(snapshot);if(entry.revisions.length>20)entry.revisions.shift();writeProjectLibrary(library);localStorage.setItem('modular-config-v3',JSON.stringify(state));toast(`Proyecto guardado · versión ${revision}`);};

  function renderQuoteTechnicalSpecs(){const quote=document.getElementById('quote-print');if(!quote)return;const p=plumbingMetrics(),e=electricalMetrics();let root=document.getElementById('production-quote-specs');if(!root){root=document.createElement('div');root.id='production-quote-specs';root.className='mt-6 rounded-xl border p-4';quote.insertBefore(root,quote.querySelector('.mt-7.pt-4')||null);}const floor=window.BAT_KUBIQUEITOR_FLOOR_FINISHES?.floors?.[state.floorFinish]?.name||'Por definir';root.innerHTML=`<div class="text-[11px] font-black uppercase text-slate-400 mb-2">Especificación técnica</div><div class="grid md:grid-cols-2 gap-x-6 gap-y-2 text-xs"><div><strong>Piso:</strong> ${floor}</div><div><strong>Tabiques:</strong> ${state.counts.partition||0}</div><div><strong>Sanitario:</strong> ${p.coldPoints} AF · ${p.hotPoints} AC · ${p.drains} desagües</div><div><strong>Electricidad:</strong> ${e.points} puntos · ${e.lights} luminarias</div></div>`;}
  if(typeof openQuote==='function'){const before=openQuote;openQuote=function(){before();renderQuoteTechnicalSpecs();};}

  const renderAllBeforeProduction=renderAll;
  renderAll=function(){ensureState();renderAllBeforeProduction();renderSystemsConfig();installToolbar();updateToolbar();};

  function install(){if(!ready())return false;ensureState();installToolbar();renderSystemsConfig();if(!document.getElementById('production-suite-style')){const s=document.createElement('style');s.id='production-suite-style';s.textContent='#production-toolbar .interaction-active{background:#f59e0b!important;color:#0f172a!important;border-color:#f59e0b!important}@media(max-width:900px){#production-toolbar{display:none}}';document.head.appendChild(s);}window.BAT_KUBIQUEITOR_PRODUCTION_SUITE={version:VERSION,installed:true};return true;}
  function boot(attempt=0){if(install())return;if(attempt<30)setTimeout(()=>boot(attempt+1),100);}
  if(document.readyState==='loading')window.addEventListener('DOMContentLoaded',()=>boot(),{once:true});else boot();
})();