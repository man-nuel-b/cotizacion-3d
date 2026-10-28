// Face-aware mounted components: windows, pedestrian doors, AC units and electrical points.
// Loaded after editor.js and extends the A/B/C/D convention across all wall-mounted elements.

const MOUNTED_FACE_TYPES={
  window:{defaultFace:'B',gap:1.22,padding:.72,height:'window',label:'Ventana termopanel'},
  door:{defaultFace:'A',gap:1.02,padding:.58,height:'door',label:'Puerta peatonal'},
  ac:{defaultFace:'B',gap:.95,padding:.55,height:'ac',label:'Aire acondicionado'},
  electrical:{defaultFace:'A',gap:.22,padding:.16,height:'electrical',label:'Punto eléctrico'}
};
let pendingMountedType=null;

ensureLayoutState=function(){
  if(!state.layout) state.layout={};
  ['window','door','partition','wc','sink','shower','ac','electrical'].forEach(type=>{
    if(!Array.isArray(state.layout[type])) state.layout[type]=[];
  });
};

function isMountedFaceType(type){ return !!MOUNTED_FACE_TYPES[type]; }
function mountedFace(type,index){
  ensureLayoutState();
  return state.layout[type]?.[index]?.face||MOUNTED_FACE_TYPES[type]?.defaultFace||'A';
}
function mountedFaceDimension(face,c){ return (face==='A'||face==='B')?c.length:c.width; }

actualLayout=function(type,index){
  const c=DATA.containers[state.container];
  if(isMountedFaceType(type)){
    const face=mountedFace(type,index),cfg=MOUNTED_FACE_TYPES[type],stored=state.layout?.[type]?.[index];
    const dim=mountedFaceDimension(face,c);
    const fallback=defaultWallX(index,state.counts[type]||0,dim,cfg.padding);
    return {face,x:Number.isFinite(stored?.x)?stored.x:fallback};
  }
  if(type==='partition') return layoutValue(type,index,{x:-c.length/2+((index+1)*c.length/((state.counts.partition||0)+1))});
  if(['wc','sink','shower'].includes(type)) return layoutValue(type,index,sanitaryFallbacks(c)[type][index]||{x:0,z:0});
  return {x:0,z:0};
};

validCandidate=function(type,index,candidate){
  const c=DATA.containers[state.container];
  if(isMountedFaceType(type)){
    const cfg=MOUNTED_FACE_TYPES[type],face=candidate.face||mountedFace(type,index),dim=mountedFaceDimension(face,c),limit=dim/2-cfg.padding;
    if(candidate.x<-limit||candidate.x>limit) return false;
    for(let i=0;i<(state.counts[type]||0);i++){
      if(i===index) continue;
      const other=actualLayout(type,i);
      if(other.face===face&&Math.abs(other.x-candidate.x)<cfg.gap) return false;
    }
    if(type==='window'||type==='door'){
      const otherType=type==='window'?'door':'window';
      const halfWidth=type==='window'?.60:.49;
      const otherHalf=otherType==='window'?.60:.49;
      for(let i=0;i<(state.counts[otherType]||0);i++){
        const other=actualLayout(otherType,i);
        if(other.face===face&&Math.abs(other.x-candidate.x)<halfWidth+otherHalf+.10) return false;
      }
    }
    return true;
  }
  if(type==='partition'){
    if(candidate.x<-c.length/2+.55||candidate.x>c.length/2-.55) return false;
    for(let i=0;i<(state.counts.partition||0);i++){ if(i!==index&&Math.abs(actualLayout('partition',i).x-candidate.x)<.45) return false; }
  }
  if(['wc','sink','shower'].includes(type)){
    if(candidate.x<-c.length/2+.48||candidate.x>c.length/2-.48||candidate.z<-c.width/2+.38||candidate.z>c.width/2-.38) return false;
    for(const otherType of ['wc','sink','shower']) for(let i=0;i<(state.counts[otherType]||0);i++){
      if(otherType===type&&i===index) continue;
      const other=actualLayout(otherType,i); if(Math.hypot(other.x-candidate.x,other.z-candidate.z)<.68) return false;
    }
  }
  return true;
};

typeLabel=function(type){
  return ({window:'Ventana termopanel',door:'Puerta peatonal',partition:'División interior',wc:'WC',sink:'Lavamanos',shower:'Ducha',ac:'Aire acondicionado',electrical:'Punto eléctrico'})[type]||type;
};
editorPositionLabel=function(type,pos){
  if(isMountedFaceType(type)) return `Cara ${pos.face} · posición ${pos.x.toFixed(2)} m`;
  return ['wc','sink','shower'].includes(type)?`X ${pos.x.toFixed(2)} m · Z ${pos.z.toFixed(2)} m`:`X ${pos.x.toFixed(2)} m`;
};

showEditorPanel=function(root){
  const panel=document.getElementById('object-editor'); if(!panel||!root) return;
  const meta=root.userData.editor,pos=actualLayout(meta.type,meta.index);
  document.getElementById('editor-title').textContent=typeLabel(meta.type);
  document.getElementById('editor-subtitle').textContent=`Elemento ${meta.index+1} · ${editorPositionLabel(meta.type,pos)}`;
  panel.classList.remove('hidden');
};

resetSelectedPosition=function(){
  if(!selectedEditable) return;
  const {type,index}=selectedEditable; pushHistory(); ensureLayoutState();
  if(isMountedFaceType(type)) state.layout[type][index]={face:mountedFace(type,index)};
  else state.layout[type][index]=undefined;
  renderAll(); toast('Posición automática restaurada');
};

function mountedSurface(face){ return face==='A'?'faceA':face==='B'?'faceB':face==='C'?'faceC':'faceD'; }
function mountedRotation(face){ return face==='A'?Math.PI:face==='B'?0:face==='C'?-Math.PI/2:Math.PI/2; }

function positionMountedObject(obj,type,layout,c){
  const face=layout.face||MOUNTED_FACE_TYPES[type].defaultFace;
  const y=type==='window'?c.height*.60:type==='door'?1.06:type==='ac'?c.height-.42:.40;
  let inset;
  if(type==='window') inset=.075;
  else if(type==='door') inset=.07;
  else if(type==='ac') inset=-.17;
  else inset=-.075;
  obj.rotation.y=mountedRotation(face);
  if(face==='A') obj.position.set(layout.x,y,c.width/2+inset);
  else if(face==='B') obj.position.set(layout.x,y,-c.width/2-inset);
  else if(face==='C') obj.position.set(c.length/2+inset,y,layout.x);
  else obj.position.set(-c.length/2-inset,y,layout.x);
}

function positionCondenser(obj,layout,c){
  const face=layout.face||'B'; obj.rotation.y=mountedRotation(face);
  if(face==='A') obj.position.set(layout.x,.08,c.width/2+.28);
  else if(face==='B') obj.position.set(layout.x,.08,-c.width/2-.28);
  else if(face==='C') obj.position.set(c.length/2+.28,.08,layout.x);
  else obj.position.set(-c.length/2-.28,.08,layout.x);
}

function createElectricalPoint(){
  const g=new THREE.Group();
  const plate=mat(0xf8fafc,{roughness:.32});
  const dark=mat(0x334155,{roughness:.45});
  g.add(box(.17,.12,.025,plate,0,0,0));
  const h1=cylinder(.012,.012,.012,12,dark); h1.rotation.x=Math.PI/2; h1.position.set(-.035,.012,.018); g.add(h1);
  const h2=cylinder(.012,.012,.012,12,dark); h2.rotation.x=Math.PI/2; h2.position.set(.035,.012,.018); g.add(h2);
  const ground=box(.045,.012,.012,dark,0,-.035,.018); g.add(ground);
  return g;
}

rebuild3D=function(){
  if(!containerGroup) return;
  ensureLayoutState(); clearInvalidLayoutEntries(); disposeGroup(containerGroup); editableObjects=[];
  const c=DATA.containers[state.container],extColor=new THREE.Color(state.exteriorColor);
  const materials={exterior:mat(extColor,{roughness:.58,metalness:.2}),interior:mat(state.finish==='sanitary'?0xf8fafc:0xf1f5f9,{roughness:state.finish==='sanitary'?.32:.82}),frame:mat(new THREE.Color(extColor).multiplyScalar(.55),{roughness:.42,metalness:.48}),floor:createFloorMaterial()};
  containerGroup.add(createContainerShell(c,materials)); addCargoDoorDetails(containerGroup,c);

  for(const type of ['window','door']) for(let i=0;i<(state.counts[type]||0);i++){
    const p=actualLayout(type,i),obj=type==='window'?createWindow():createDoor();
    positionMountedObject(obj,type,p,c); containerGroup.add(obj);
    registerEditable(obj,type,i,{axis:(p.face==='A'||p.face==='B')?'x':'z',surface:mountedSurface(p.face),face:p.face});
  }
  for(let i=0;i<(state.counts.partition||0);i++){
    const p=actualLayout('partition',i),obj=createPartition(c.width-.2,c.height-.15); addGroup(containerGroup,obj,p.x,.08,0); registerEditable(obj,'partition',i,{axis:'x',surface:'floor'});
  }
  for(const type of ['wc','sink','shower']) for(let i=0;i<(state.counts[type]||0);i++){
    const p=actualLayout(type,i),obj=type==='wc'?createWC():type==='sink'?createSink():createShower(); addGroup(containerGroup,obj,p.x,.08,p.z,type==='sink'?Math.PI:0); registerEditable(obj,type,i,{axis:'xz',surface:'floor'});
  }
  for(let i=0;i<(state.counts.ac||0);i++){
    const p=actualLayout('ac',i),indoor=createSplitAC(),outdoor=createCondenser();
    positionMountedObject(indoor,'ac',p,c); positionCondenser(outdoor,p,c); containerGroup.add(indoor,outdoor);
    registerEditable(indoor,'ac',i,{axis:(p.face==='A'||p.face==='B')?'x':'z',surface:mountedSurface(p.face),face:p.face});
  }
  for(let i=0;i<(state.counts.electrical||0);i++){
    const p=actualLayout('electrical',i),obj=createElectricalPoint(); positionMountedObject(obj,'electrical',p,c); containerGroup.add(obj);
    registerEditable(obj,'electrical',i,{axis:(p.face==='A'||p.face==='B')?'x':'z',surface:mountedSurface(p.face),face:p.face});
  }

  const lightCount=Math.max(1,Math.ceil((state.counts.electrical||0)/3)); for(let i=0;i<lightCount;i++) addGroup(containerGroup,createCeilingLight(),slotPosition(i,lightCount,c.length,.7),c.height-.1,0);
  addFurnishings(containerGroup,c);
  if(state.showPeople) addGroup(containerGroup,createHuman(),c.length*.28,.08,c.width/2+.75,-Math.PI/2);
  addFaceLabels(containerGroup,c);
  controls?.target.set(0,c.height*.45,0); updateLighting();
  if(selectedEditable){ const root=editableObjects.find(o=>o.userData.editor?.type===selectedEditable.type&&o.userData.editor?.index===selectedEditable.index); if(root){addSelectionOutline(root);showEditorPanel(root);}else{selectedEditable=null;hideEditorPanel();} }
};

onEditorPointerMove=function(event){
  if(!draggingEditable) return; pointerNDC(event); editorRaycaster.setFromCamera(editorPointer,camera);
  const point=new THREE.Vector3(); if(!editorRaycaster.ray.intersectPlane(dragPlane,point)) return;
  const {type,index}=draggingEditable.userData.editor,current=actualLayout(type,index); let candidate={...current};
  if(isMountedFaceType(type)) candidate.x=Math.round(((current.face==='A'||current.face==='B')?point.x:point.z)*20)/20;
  else{ candidate.x=Math.round(point.x*20)/20; if(['wc','sink','shower'].includes(type)) candidate.z=Math.round(point.z*20)/20; }
  if(!validCandidate(type,index,candidate)) return;
  dragMoved=true; ensureLayoutState(); state.layout[type][index]=candidate;
  if(isMountedFaceType(type)) positionMountedObject(draggingEditable,type,candidate,DATA.containers[state.container]);
  else{ draggingEditable.position.x=candidate.x; if(['wc','sink','shower'].includes(type)) draggingEditable.position.z=candidate.z; }
  const subtitle=document.getElementById('editor-subtitle'); if(subtitle) subtitle.textContent=`Elemento ${index+1} · ${editorPositionLabel(type,candidate)}`;
};

function findAvailableMountedOffset(type,face,excludeIndex=null){
  const c=DATA.containers[state.container],cfg=MOUNTED_FACE_TYPES[type],dim=mountedFaceDimension(face,c),limit=dim/2-cfg.padding;
  const step=type==='electrical'?.12:.15,candidates=[0];
  for(let d=step;d<=limit+.001;d+=step){candidates.push(Number(d.toFixed(2)),Number((-d).toFixed(2)));}
  for(const x of candidates){
    if(Math.abs(x)>limit) continue;
    if(validCandidate(type,excludeIndex??(state.counts[type]||0),{face,x})) return x;
  }
  return null;
}

function openMountedFacePicker(type){
  pendingMountedType=type; installFaceUI();
  const modal=document.getElementById('mounted-face-modal');
  const title=document.getElementById('mounted-face-title'),desc=document.getElementById('mounted-face-desc');
  if(title) title.textContent=`¿En qué cara se instalará ${type==='ac'?'el':'la'} ${typeLabel(type).toLowerCase()}?`;
  if(desc) desc.textContent=`Selecciona A, B, C o D. ${typeLabel(type)} quedará asociado a esa cara.`;
  modal?.classList.remove('hidden'); modal?.classList.add('flex');
}
function closeMountedFacePicker(){ const modal=document.getElementById('mounted-face-modal'); modal?.classList.add('hidden'); modal?.classList.remove('flex'); pendingMountedType=null; }
function addMountedToFace(face){
  const type=pendingMountedType; if(!type||!isMountedFaceType(type)) return;
  const max=DATA.extras[type].max;
  if((state.counts[type]||0)>=max){closeMountedFacePicker();return toast(`Llegaste al máximo de ${typeLabel(type).toLowerCase()}`);}
  const offset=findAvailableMountedOffset(type,face);
  if(offset===null) return toast(`No queda espacio suficiente en la cara ${face}`);
  pushHistory(); ensureLayoutState(); const index=state.counts[type]||0; state.counts[type]=index+1; state.layout[type][index]={face,x:offset};
  closeMountedFacePicker(); renderAll(); focusFace(face); toast(`${typeLabel(type)} agregado en cara ${face}`);
}
function changeSelectedMountedFace(face){
  if(!selectedEditable||!isMountedFaceType(selectedEditable.type)) return;
  const {type,index}=selectedEditable,offset=findAvailableMountedOffset(type,face,index);
  if(offset===null) return toast(`No queda espacio suficiente en la cara ${face}`);
  pushHistory(); ensureLayoutState(); state.layout[type][index]={face,x:offset}; renderAll(); focusFace(face); toast(`${typeLabel(type)} movido a cara ${face}`);
}

adjustCount=function(key,delta){
  if(isMountedFaceType(key)&&delta>0){openMountedFacePicker(key);return;}
  if(isMountedFaceType(key)&&delta<0){
    if((state.counts[key]||0)<=0) return;
    pushHistory(); ensureLayoutState(); state.counts[key]--; state.layout[key].splice(state.counts[key],1); selectedEditable=null; renderAll(); return;
  }
  originalAdjustCount(key,delta);
};

installFaceUI=function(){
  if(!document.getElementById('face-ui-style')){
    const style=document.createElement('style'); style.id='face-ui-style'; style.textContent=`
      .zoom-control-stack{position:absolute;z-index:19;right:16px;top:50%;transform:translateY(-50%);display:grid;gap:8px}.zoom-control-btn{width:44px;height:44px;border-radius:14px;border:1px solid rgba(148,163,184,.28);background:rgba(15,23,42,.86);color:#fff;display:grid;place-items:center;box-shadow:0 10px 28px rgba(2,6,23,.24);backdrop-filter:blur(12px);font-size:15px;transition:.16s ease}.zoom-control-btn:hover{background:#f59e0b;color:#0f172a;border-color:#fbbf24;transform:scale(1.05)}.zoom-control-btn:active{transform:scale(.96)}
      .face-card{border:1px solid #e2e8f0;border-radius:16px;padding:14px;text-align:left;background:white;transition:.16s ease}.face-card:hover{transform:translateY(-2px);border-color:#f59e0b;box-shadow:0 10px 28px rgba(15,23,42,.09)}.face-letter{width:42px;height:42px;border-radius:13px;display:grid;place-items:center;color:#0f172a;font-weight:900;font-size:18px}.face-mini{display:grid;grid-template-columns:42px 1fr;gap:12px;align-items:center}
      .presentation-mode .zoom-control-stack{right:24px}@media(max-width:820px){.zoom-control-stack{right:10px;top:auto;bottom:78px;transform:none}.zoom-control-btn{width:40px;height:40px;border-radius:12px}.presentation-mode .zoom-control-stack{right:12px;bottom:76px}}
    `; document.head.appendChild(style);
  }
  const old=document.getElementById('window-face-modal'); if(old) old.remove();
  if(!document.getElementById('mounted-face-modal')){
    const modal=document.createElement('div'); modal.id='mounted-face-modal'; modal.className='fixed inset-0 z-[80] hidden items-center justify-center p-4'; modal.style.background='rgba(2,6,23,.72)'; modal.style.backdropFilter='blur(6px)';
    modal.innerHTML=`<div class="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden"><div class="p-5 border-b flex items-start justify-between gap-4"><div><div class="text-[10px] font-black uppercase tracking-widest text-amber-600">Ubicación obligatoria</div><h3 id="mounted-face-title" class="font-black text-xl mt-1">¿En qué cara se instalará?</h3><p id="mounted-face-desc" class="text-sm text-slate-500 mt-1">Selecciona A, B, C o D.</p></div><button onclick="closeMountedFacePicker()" class="w-9 h-9 rounded-full bg-slate-100"><i class="fa-solid fa-xmark"></i></button></div><div class="p-5 grid sm:grid-cols-2 gap-3">${Object.entries(CONTAINER_FACES).map(([key,f])=>`<button class="face-card" onclick="addMountedToFace('${key}')"><div class="face-mini"><span class="face-letter" style="background:${f.color}">${key}</span><span><strong class="block text-sm">${f.label}</strong><small class="block text-slate-500 mt-1">${f.description}</small></span></div></button>`).join('')}</div><div class="px-5 pb-5 text-xs text-slate-500"><strong>Convención:</strong> A = persona · B = opuesta · C = puertas originales · D = extremo contrario.</div></div>`;
    document.body.appendChild(modal);
  }
  const toolbar=document.querySelector('.viewer-toolbar');
  if(toolbar&&!document.getElementById('face-label-toggle')){
    const btn=document.createElement('button'); btn.id='face-label-toggle'; btn.className='viewer-pill rounded-xl px-3 py-2 text-xs font-semibold'; btn.onclick=toggleFaceLabels; btn.innerHTML='<i class="fa-solid fa-compass mr-1"></i> Caras A-D'; toolbar.appendChild(btn);
  }
  // The direct-editor-controller is the single owner of A/B/C/D controls inside object-editor.
  // Do not recreate mounted-face-editor/window-face-editor here.
};
