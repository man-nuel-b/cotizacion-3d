// Electrical installation module for a single configurable container.
// Keeps backward compatibility with state.counts.electrical and the current APU.
(function(){
  if(window.BAT_KUBIQUEITOR_ELECTRICAL_SYSTEM) return;

  const VERSION=1;
  const STEP=.10;
  const TYPES={
    outlet:{name:'Enchufe doble',icon:'fa-plug',circuit:'outlets',height:.35},
    switch:{name:'Interruptor',icon:'fa-toggle-on',circuit:'lighting',height:1.10},
    light:{name:'Luminaria LED',icon:'fa-lightbulb',circuit:'lighting',height:null},
    acPoint:{name:'Punto A/C',icon:'fa-snowflake',circuit:'ac',height:2.15}
  };

  let electricalRoot=null;
  let selectedId=null;
  let showRoutes=false;
  let originalRebuild=null;
  let installed=false;

  const uid=()=>`EL-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6)}`;
  const safeNumber=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;

  function containerDef(){return DATA.containers[state.container];}
  function defaultElectricalState(){
    return {
      version:1,
      points:[],
      board:{face:'D',offset:0,height:1.45},
      circuits:{
        lighting:{name:'Iluminación',breaker:10,cableSection:1.5},
        outlets:{name:'Enchufes',breaker:16,cableSection:2.5},
        ac:{name:'Climatización',breaker:16,cableSection:2.5}
      }
    };
  }

  function ensureState(){
    if(!state.electrical||typeof state.electrical!=='object') state.electrical=defaultElectricalState();
    if(!Array.isArray(state.electrical.points)) state.electrical.points=[];
    state.electrical.board={...defaultElectricalState().board,...(state.electrical.board||{})};
    state.electrical.circuits={...defaultElectricalState().circuits,...(state.electrical.circuits||{})};
    reconcileLegacyCount();
    return state.electrical;
  }

  function defaultPoint(type,index){
    const c=containerDef();
    const wallType=type!=='light';
    const face=wallType?(index%2===0?'A':'B'):'ceiling';
    const span=wallType?Math.max(.5,c.length-1.2):Math.max(.5,c.length-1.4);
    const cols=Math.max(1,Math.ceil(((state.counts?.electrical||1)+1)/2));
    const slot=(index%cols)+1;
    const x=-span/2+(slot*span/(cols+1));
    return {id:uid(),type,face,x,z:0,height:type==='light'?c.height-.08:TYPES[type].height,circuit:TYPES[type].circuit};
  }

  function autoTypeForIndex(index,total){
    if(total<=2) return 'outlet';
    const lights=Math.max(1,Math.round(total/3));
    if(index<lights) return 'light';
    if(index===lights) return 'switch';
    return 'outlet';
  }

  function reconcileLegacyCount(){
    const e=state.electrical;
    const desired=Math.max(0,Math.round(safeNumber(state.counts?.electrical,0)));
    if(e.points.length<desired){
      for(let i=e.points.length;i<desired;i++) e.points.push(defaultPoint(autoTypeForIndex(i,desired),i));
    }else if(e.points.length>desired){
      e.points=e.points.slice(0,desired);
      if(selectedId&&!e.points.some(p=>p.id===selectedId)) selectedId=e.points[0]?.id||null;
    }
  }

  function syncCount(){
    if(!state.counts) state.counts={};
    state.counts.electrical=state.electrical.points.length;
  }

  function selectedPoint(){return ensureState().points.find(p=>p.id===selectedId)||null;}

  function addPoint(type='outlet'){
    if(!TYPES[type]) return;
    ensureState();
    const max=DATA.extras?.electrical?.max||24;
    if(state.electrical.points.length>=max){toast?.(`Máximo ${max} puntos eléctricos`);return;}
    pushHistory?.();
    const point=defaultPoint(type,state.electrical.points.length);
    state.electrical.points.push(point);
    selectedId=point.id;
    syncCount();
    renderAll();
    toast?.(`${TYPES[type].name} agregado`);
  }

  function removeSelected(){
    const p=selectedPoint();if(!p)return;
    pushHistory?.();
    state.electrical.points=state.electrical.points.filter(x=>x.id!==p.id);
    selectedId=state.electrical.points[0]?.id||null;
    syncCount();
    renderAll();
    toast?.('Punto eléctrico eliminado');
  }

  function changeType(type){
    const p=selectedPoint();if(!p||!TYPES[type])return;
    pushHistory?.();
    p.type=type;p.circuit=TYPES[type].circuit;
    if(type==='light'){p.face='ceiling';p.height=containerDef().height-.08;if(!Number.isFinite(p.z))p.z=0;}
    else{if(p.face==='ceiling')p.face='A';p.height=TYPES[type].height;}
    renderAll();
  }

  function changeFace(face){
    const p=selectedPoint();if(!p||p.type==='light'||!['A','B','C','D'].includes(face))return;
    pushHistory?.();p.face=face;clampPoint(p);renderAll();
  }

  function clampPoint(p){
    const c=containerDef();
    if(p.type==='light'){
      p.x=clamp(safeNumber(p.x),-c.length/2+.35,c.length/2-.35);
      p.z=clamp(safeNumber(p.z),-c.width/2+.25,c.width/2-.25);
      p.height=c.height-.08;
      return;
    }
    const dim=(p.face==='A'||p.face==='B')?c.length:c.width;
    p.x=clamp(safeNumber(p.x),-dim/2+.25,dim/2-.25);
    p.height=clamp(safeNumber(p.height,TYPES[p.type]?.height||.35),.20,c.height-.20);
  }

  function nudge(axis,delta){
    const p=selectedPoint();if(!p)return;
    pushHistory?.();
    if(axis==='x')p.x=safeNumber(p.x)+delta;
    if(axis==='z'&&p.type==='light')p.z=safeNumber(p.z)+delta;
    if(axis==='height'&&p.type!=='light')p.height=safeNumber(p.height,TYPES[p.type]?.height||.35)+delta;
    clampPoint(p);renderAll();
  }

  function setSelected(id){selectedId=id;renderPanel();renderElectrical();}

  function makeMaterial(color,opts={}){return new THREE.MeshStandardMaterial({color,roughness:.45,metalness:.05,...opts});}
  function makeBox(w,h,d,color){return new THREE.Mesh(new THREE.BoxGeometry(w,h,d),makeMaterial(color));}

  function createOutlet(){
    const g=new THREE.Group();
    g.add(makeBox(.13,.085,.025,0xf8fafc));
    const dark=makeMaterial(0x334155);
    [-.03,.03].forEach(x=>{const dot=new THREE.Mesh(new THREE.CircleGeometry(.008,12),dark);dot.position.set(x,0,.014);g.add(dot);});
    return g;
  }
  function createSwitch(){
    const g=new THREE.Group();g.add(makeBox(.085,.12,.026,0xf8fafc));
    const key=makeBox(.047,.065,.012,0xe2e8f0);key.position.z=.019;g.add(key);return g;
  }
  function createLight(){
    const g=new THREE.Group();
    const body=new THREE.Mesh(new THREE.CylinderGeometry(.16,.16,.028,28),makeMaterial(0xffffff,{emissive:0xfff1bf,emissiveIntensity:.38}));
    body.rotation.x=Math.PI/2;g.add(body);return g;
  }
  function createAcPoint(){
    const g=createOutlet();const badge=makeBox(.045,.022,.012,0x38bdf8);badge.position.set(.04,.027,.021);g.add(badge);return g;
  }
  function createBoard(){
    const g=new THREE.Group();
    g.add(makeBox(.34,.46,.12,0xf1f5f9));
    const door=makeBox(.29,.40,.012,0xe2e8f0);door.position.z=.066;g.add(door);
    const stripe=makeBox(.20,.025,.014,0xf59e0b);stripe.position.set(0,.11,.074);g.add(stripe);
    g.userData.electricalBoard=true;return g;
  }

  function placeWallObject(obj,p,c){
    const y=p.height||.35;
    if(p.face==='A'){obj.position.set(p.x,y,c.width/2-.045);}
    else if(p.face==='B'){obj.position.set(p.x,y,-c.width/2+.045);obj.rotation.y=Math.PI;}
    else if(p.face==='C'){obj.position.set(c.length/2-.045,y,p.x);obj.rotation.y=-Math.PI/2;}
    else{obj.position.set(-c.length/2+.045,y,p.x);obj.rotation.y=Math.PI/2;}
  }

  function pointWorldPosition(p,c){
    if(p.type==='light')return new THREE.Vector3(p.x,c.height-.08,p.z||0);
    if(p.face==='A')return new THREE.Vector3(p.x,p.height,c.width/2-.04);
    if(p.face==='B')return new THREE.Vector3(p.x,p.height,-c.width/2+.04);
    if(p.face==='C')return new THREE.Vector3(c.length/2-.04,p.height,p.x);
    return new THREE.Vector3(-c.length/2+.04,p.height,p.x);
  }

  function boardPosition(c){return new THREE.Vector3(-c.length/2+.10,1.45,0);}

  function addRoute(root,from,to){
    const mid1=new THREE.Vector3(from.x,.12,from.z);
    const mid2=new THREE.Vector3(to.x,.12,to.z);
    const pts=[from.clone(),mid1,mid2,to.clone()];
    const geo=new THREE.BufferGeometry().setFromPoints(pts);
    const line=new THREE.Line(geo,new THREE.LineBasicMaterial({color:0xf59e0b,transparent:true,opacity:.72}));
    line.userData.electricalRoute=true;root.add(line);
  }

  function clearElectricalRoot(){
    if(!electricalRoot)return;
    electricalRoot.traverse(o=>{o.geometry?.dispose?.();if(Array.isArray(o.material))o.material.forEach(m=>m.dispose?.());else o.material?.dispose?.();});
    electricalRoot.remove(...electricalRoot.children);
  }

  function renderElectrical(){
    if(!containerGroup||!window.THREE)return;
    ensureState();
    if(!electricalRoot){electricalRoot=new THREE.Group();electricalRoot.name='electricalInstallationRoot';}
    if(electricalRoot.parent!==containerGroup)containerGroup.add(electricalRoot);
    clearElectricalRoot();
    const c=containerDef();
    const board=createBoard();board.position.copy(boardPosition(c));board.rotation.y=Math.PI/2;electricalRoot.add(board);
    state.electrical.points.forEach(p=>{
      clampPoint(p);
      let obj=p.type==='switch'?createSwitch():p.type==='light'?createLight():p.type==='acPoint'?createAcPoint():createOutlet();
      obj.userData.electricalPointId=p.id;
      obj.traverse(o=>{o.userData.electricalPointId=p.id;});
      if(p.type==='light')obj.position.set(p.x,c.height-.055,p.z||0);else placeWallObject(obj,p,c);
      if(p.id===selectedId){
        obj.traverse(o=>{if(o.isMesh&&o.material?.emissive){o.material.emissive.setHex(0x5a3a00);o.material.emissiveIntensity=.22;}});
      }
      electricalRoot.add(obj);
      if(showRoutes)addRoute(electricalRoot,boardPosition(c),pointWorldPosition(p,c));
    });
  }

  function calculateMaterials(){
    ensureState();
    const counts={outlet:0,switch:0,light:0,acPoint:0};
    state.electrical.points.forEach(p=>{if(counts[p.type]!==undefined)counts[p.type]++;});
    const c=containerDef();
    const board=boardPosition(c);
    let routeLength=0;
    state.electrical.points.forEach(p=>{
      const v=pointWorldPosition(p,c);
      routeLength+=Math.abs(v.x-board.x)+Math.abs(v.z-board.z)+Math.abs(v.y-.12)+Math.abs(board.y-.12);
    });
    const conduit=Math.ceil(routeLength*1.08);
    const cable15=Math.ceil(state.electrical.points.filter(p=>p.circuit==='lighting').length?routeLength*.42*1.12:0);
    const cable25=Math.ceil(state.electrical.points.filter(p=>p.circuit!=='lighting').length?routeLength*.58*1.12:0);
    return {
      ...counts,
      points:state.electrical.points.length,
      board:state.electrical.points.length?1:0,
      differential:state.electrical.points.length?1:0,
      boxes:counts.outlet+counts.switch+counts.acPoint,
      conduit,
      cable15,
      cable25
    };
  }

  function addStyles(){
    if(document.getElementById('electrical-system-style'))return;
    const s=document.createElement('style');s.id='electrical-system-style';s.textContent=`
      #electrical-system-panel{margin-top:14px;border:1px solid #e2e8f0;border-radius:16px;background:#fff;padding:14px}
      .el-add-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.el-add{border:1px solid #e2e8f0;border-radius:11px;padding:9px 8px;background:#f8fafc;font-size:11px;font-weight:800;text-align:left}.el-add:hover{border-color:#f59e0b;background:#fffbeb}
      .el-point-list{display:flex;gap:6px;overflow:auto;padding-bottom:3px}.el-chip{flex:0 0 auto;border:1px solid #e2e8f0;border-radius:999px;padding:6px 9px;font-size:10px;font-weight:800;background:#fff}.el-chip.active{border-color:#f59e0b;background:#fef3c7;color:#78350f}
      .el-mini{border:1px solid #e2e8f0;border-radius:9px;padding:7px 8px;background:#f8fafc;font-size:10px;font-weight:800}.el-mini.active{border-color:#f59e0b;background:#fef3c7}.el-danger{color:#b91c1c;background:#fef2f2;border-color:#fecaca}
      .el-stat{border-radius:10px;background:#f8fafc;padding:8px}.el-stat strong{display:block;font-size:12px;color:#0f172a}.el-stat span{font-size:9px;color:#64748b}
    `;document.head.appendChild(s);
  }

  function renderPanel(){
    const panel=document.getElementById('electrical-system-panel');if(!panel)return;
    const e=ensureState(),p=selectedPoint(),m=calculateMaterials();
    panel.innerHTML=`
      <div class="flex items-start justify-between gap-3"><div><div class="text-[10px] uppercase tracking-widest font-black text-amber-600">Instalación eléctrica</div><div class="text-sm font-black mt-1">Puntos y circuitos</div><div class="text-[10px] text-slate-500 mt-1">Agrega los puntos; el sistema mantiene el conteo conectado al A.P.U. actual.</div></div><span class="text-xs font-black text-slate-700">${e.points.length}</span></div>
      <div class="el-add-grid mt-3">
        ${Object.entries(TYPES).map(([k,v])=>`<button type="button" class="el-add" data-el-add="${k}"><i class="fa-solid ${v.icon} text-amber-500 mr-1"></i>${v.name}</button>`).join('')}
      </div>
      ${e.points.length?`<div class="mt-3"><div class="text-[9px] uppercase tracking-widest font-black text-slate-400 mb-2">Puntos instalados</div><div class="el-point-list">${e.points.map((x,i)=>`<button type="button" class="el-chip ${x.id===selectedId?'active':''}" data-el-select="${x.id}">${i+1}. ${TYPES[x.type]?.name||x.type}</button>`).join('')}</div></div>`:''}
      ${p?`<div class="mt-3 rounded-xl border border-slate-200 p-3 bg-slate-50/70">
        <div class="flex justify-between items-center"><strong class="text-xs">Editar ${TYPES[p.type]?.name||'punto'}</strong><button type="button" class="el-mini el-danger" data-el-delete><i class="fa-solid fa-trash"></i></button></div>
        <div class="grid grid-cols-4 gap-1 mt-2">${Object.entries(TYPES).map(([k,v])=>`<button type="button" class="el-mini ${p.type===k?'active':''}" data-el-type="${k}" title="${v.name}"><i class="fa-solid ${v.icon}"></i></button>`).join('')}</div>
        ${p.type!=='light'?`<div class="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-3 mb-1">Cara</div><div class="grid grid-cols-4 gap-1">${['A','B','C','D'].map(f=>`<button type="button" class="el-mini ${p.face===f?'active':''}" data-el-face="${f}">${f}</button>`).join('')}</div>`:''}
        <div class="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-3 mb-1">Posición</div>
        <div class="grid ${p.type==='light'?'grid-cols-4':'grid-cols-4'} gap-1">
          <button type="button" class="el-mini" data-el-nudge="x:-${STEP}"><i class="fa-solid fa-arrow-left"></i></button>
          <button type="button" class="el-mini" data-el-nudge="x:${STEP}"><i class="fa-solid fa-arrow-right"></i></button>
          ${p.type==='light'?`<button type="button" class="el-mini" data-el-nudge="z:-${STEP}"><i class="fa-solid fa-arrow-up"></i></button><button type="button" class="el-mini" data-el-nudge="z:${STEP}"><i class="fa-solid fa-arrow-down"></i></button>`:`<button type="button" class="el-mini" data-el-nudge="height:${STEP}"><i class="fa-solid fa-arrow-up"></i></button><button type="button" class="el-mini" data-el-nudge="height:-${STEP}"><i class="fa-solid fa-arrow-down"></i></button>`}
        </div>
        <div class="text-[10px] text-slate-500 mt-2">Circuito: <strong>${e.circuits[p.circuit]?.name||p.circuit}</strong>${p.type!=='light'?` · altura ${safeNumber(p.height).toFixed(2)} m`:''}</div>
      </div>`:''}
      <div class="grid grid-cols-3 gap-2 mt-3"><div class="el-stat"><strong>${m.conduit} m</strong><span>Conduit estimado</span></div><div class="el-stat"><strong>${m.cable15} m</strong><span>Cable 1,5 mm²</span></div><div class="el-stat"><strong>${m.cable25} m</strong><span>Cable 2,5 mm²</span></div></div>
      <button type="button" class="mt-3 w-full rounded-xl border border-slate-200 bg-slate-50 py-2 text-[10px] font-black" data-el-routes><i class="fa-solid fa-route mr-1 text-amber-500"></i>${showRoutes?'Ocultar':'Mostrar'} canalización técnica</button>`;

    panel.querySelectorAll('[data-el-add]').forEach(b=>b.addEventListener('click',()=>addPoint(b.dataset.elAdd)));
    panel.querySelectorAll('[data-el-select]').forEach(b=>b.addEventListener('click',()=>setSelected(b.dataset.elSelect)));
    panel.querySelectorAll('[data-el-type]').forEach(b=>b.addEventListener('click',()=>changeType(b.dataset.elType)));
    panel.querySelectorAll('[data-el-face]').forEach(b=>b.addEventListener('click',()=>changeFace(b.dataset.elFace)));
    panel.querySelectorAll('[data-el-nudge]').forEach(b=>b.addEventListener('click',()=>{const [axis,val]=b.dataset.elNudge.split(':');nudge(axis,Number(val));}));
    panel.querySelector('[data-el-delete]')?.addEventListener('click',removeSelected);
    panel.querySelector('[data-el-routes]')?.addEventListener('click',()=>{showRoutes=!showRoutes;renderElectrical();renderPanel();});
  }

  function installPanel(){
    addStyles();
    const step=document.querySelector('.wizard-step[data-step="5"]')||document.querySelector('.wizard-step[data-step="3"]');
    if(!step)return false;
    let panel=document.getElementById('electrical-system-panel');
    if(!panel){panel=document.createElement('div');panel.id='electrical-system-panel';const actions=[...step.querySelectorAll('.flex.gap-2.mt-5')][0];if(actions)step.insertBefore(panel,actions);else step.appendChild(panel);}
    renderPanel();return true;
  }

  function hookRebuild(){
    if(originalRebuild)return true;
    if(typeof rebuild3D!=='function')return false;
    originalRebuild=rebuild3D;
    rebuild3D=function(){originalRebuild();renderElectrical();renderPanel();};
    renderElectrical();return true;
  }

  function boot(attempt=0){
    if(installed)return;
    if(typeof state==='undefined'||typeof DATA==='undefined'||typeof THREE==='undefined'||!containerGroup){if(attempt<120)setTimeout(()=>boot(attempt+1),80);return;}
    ensureState();
    const okPanel=installPanel();const okRebuild=hookRebuild();
    if(!okPanel||!okRebuild){if(attempt<120)setTimeout(()=>boot(attempt+1),80);return;}
    if(!selectedId)selectedId=state.electrical.points[0]?.id||null;
    renderPanel();renderElectrical();installed=true;
    window.BAT_KUBIQUEITOR_ELECTRICAL_SYSTEM={version:VERSION,types:TYPES,add:addPoint,remove:removeSelected,materials:calculateMaterials,render:renderElectrical};
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>boot(),220),{once:true});
  else setTimeout(()=>boot(),220);
})();
