// Parametric dimensions for bat-kubiqueitor.
// Loaded after face-select.js. Dimensions are stored per object in state.dimensions.

const OBJECT_DIMENSIONS={
  window:{
    fields:[
      {key:'width',label:'Ancho',min:.40,max:2.40,step:.05},
      {key:'height',label:'Alto',min:.40,max:1.80,step:.05}
    ],
    defaults:()=>({width:1.20,height:1.05,depth:.10})
  },
  door:{
    fields:[
      {key:'width',label:'Ancho',min:.70,max:1.60,step:.05},
      {key:'height',label:'Alto',min:1.80,max:2.50,step:.05}
    ],
    defaults:()=>({width:.98,height:2.08,depth:.12})
  },
  partition:{
    fields:[
      {key:'width',label:'Ancho',min:.60,max:2.34,step:.05},
      {key:'height',label:'Alto',min:1.00,max:2.80,step:.05}
    ],
    defaults:c=>({width:Math.max(.60,c.width-.20),height:Math.max(1,c.height-.15),depth:.075})
  },
  wc:{
    fields:[
      {key:'width',label:'Ancho',min:.45,max:.90,step:.05},
      {key:'depth',label:'Fondo',min:.55,max:1.00,step:.05}
    ],
    defaults:()=>({width:.63,height:.86,depth:.72})
  },
  sink:{
    fields:[
      {key:'width',label:'Ancho',min:.45,max:1.20,step:.05},
      {key:'depth',label:'Fondo',min:.35,max:.80,step:.05}
    ],
    defaults:()=>({width:.80,height:1.00,depth:.55})
  },
  shower:{
    fields:[
      {key:'width',label:'Ancho',min:.65,max:1.20,step:.05},
      {key:'depth',label:'Fondo',min:.65,max:1.20,step:.05},
      {key:'height',label:'Alto',min:1.70,max:2.40,step:.05}
    ],
    defaults:()=>({width:.78,height:1.88,depth:.78})
  },
  ac:{
    fields:[
      {key:'width',label:'Ancho',min:.60,max:1.40,step:.05},
      {key:'height',label:'Alto',min:.20,max:.45,step:.01}
    ],
    defaults:()=>({width:.92,height:.28,depth:.19})
  }
};

function supportsDimensions(type){ return !!OBJECT_DIMENSIONS[type]; }

function ensureDimensionState(){
  if(!state.dimensions) state.dimensions={};
  Object.keys(OBJECT_DIMENSIONS).forEach(type=>{
    if(!Array.isArray(state.dimensions[type])) state.dimensions[type]=[];
  });
}

function clearInvalidDimensionEntries(){
  ensureDimensionState();
  Object.keys(OBJECT_DIMENSIONS).forEach(type=>{
    state.dimensions[type]=state.dimensions[type].slice(0,state.counts[type]||0);
  });
}

function dimensionDefaults(type){
  const c=DATA.containers[state.container];
  return OBJECT_DIMENSIONS[type]?.defaults(c)||{};
}

function objectDimensions(type,index){
  if(!supportsDimensions(type)) return {};
  ensureDimensionState();
  return {...dimensionDefaults(type),...(state.dimensions[type][index]||{})};
}

function fitObjectToDimensions(obj,type,dims){
  if(!obj||!supportsDimensions(type)) return obj;
  obj.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(obj);
  const size=new THREE.Vector3();
  bounds.getSize(size);
  if(size.x>0&&Number.isFinite(dims.width)) obj.scale.x*=dims.width/size.x;
  if(size.y>0&&Number.isFinite(dims.height)) obj.scale.y*=dims.height/size.y;
  if(size.z>0&&Number.isFinite(dims.depth)) obj.scale.z*=dims.depth/size.z;
  obj.updateMatrixWorld(true);
  return obj;
}

function mountedParametricPosition(obj,type,layout,c,dims){
  const face=layout.face||MOUNTED_FACE_TYPES[type].defaultFace;
  let y=.40;
  if(type==='window'){
    const half=dims.height/2;
    y=clamp(c.height*.60,half+.15,c.height-half-.15);
  }else if(type==='door'){
    y=dims.height/2+.02;
  }else if(type==='ac'){
    y=c.height-dims.height/2-.16;
  }else if(type==='electrical') y=.40;

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

function dimensionField(type,key){
  return OBJECT_DIMENSIONS[type]?.fields.find(field=>field.key===key)||null;
}

function objectHalfWidth(type,index){
  if(type==='electrical') return .085;
  const d=objectDimensions(type,index);
  return (d.width||.20)/2;
}

function dimensionChangeAllowed(type,index,next){
  const c=DATA.containers[state.container];
  if(isMountedFaceType(type)){
    const p=actualLayout(type,index),face=p.face,faceDim=mountedFaceDimension(face,c);
    const half=(next.width||.20)/2;
    if(Math.abs(p.x)+half>faceDim/2-.08) return false;
    if((next.height||0)>c.height-.10) return false;

    for(let i=0;i<(state.counts[type]||0);i++){
      if(i===index) continue;
      const other=actualLayout(type,i);
      if(other.face!==face) continue;
      if(Math.abs(other.x-p.x)<half+objectHalfWidth(type,i)+.10) return false;
    }
    if(type==='window'||type==='door'){
      const otherType=type==='window'?'door':'window';
      for(let i=0;i<(state.counts[otherType]||0);i++){
        const other=actualLayout(otherType,i);
        if(other.face!==face) continue;
        if(Math.abs(other.x-p.x)<half+objectHalfWidth(otherType,i)+.10) return false;
      }
    }
    return true;
  }

  if(type==='partition'){
    return next.width<=c.width-.08&&next.height<=c.height-.06;
  }

  if(['wc','sink','shower'].includes(type)){
    const p=actualLayout(type,index),halfW=(next.width||.4)/2,halfD=(next.depth||.4)/2;
    if(p.x-halfW<-c.length/2+.08||p.x+halfW>c.length/2-.08) return false;
    if(p.z-halfD<-c.width/2+.08||p.z+halfD>c.width/2-.08) return false;

    for(const otherType of ['wc','sink','shower']){
      for(let i=0;i<(state.counts[otherType]||0);i++){
        if(otherType===type&&i===index) continue;
        const other=actualLayout(otherType,i),od=objectDimensions(otherType,i);
        const overlapX=Math.abs(other.x-p.x)<halfW+(od.width||.4)/2+.08;
        const overlapZ=Math.abs(other.z-p.z)<halfD+(od.depth||.4)/2+.08;
        if(overlapX&&overlapZ) return false;
      }
    }
    return true;
  }
  return true;
}

validCandidate=function(type,index,candidate){
  const c=DATA.containers[state.container];
  if(isMountedFaceType(type)){
    const face=candidate.face||mountedFace(type,index),faceDim=mountedFaceDimension(face,c);
    const half=type==='electrical'?.085:objectHalfWidth(type,index);
    if(candidate.x-half<-faceDim/2+.08||candidate.x+half>faceDim/2-.08) return false;

    for(let i=0;i<(state.counts[type]||0);i++){
      if(i===index) continue;
      const other=actualLayout(type,i);
      if(other.face===face&&Math.abs(other.x-candidate.x)<half+objectHalfWidth(type,i)+.10) return false;
    }
    if(type==='window'||type==='door'){
      const otherType=type==='window'?'door':'window';
      for(let i=0;i<(state.counts[otherType]||0);i++){
        const other=actualLayout(otherType,i);
        if(other.face===face&&Math.abs(other.x-candidate.x)<half+objectHalfWidth(otherType,i)+.10) return false;
      }
    }
    return true;
  }

  if(type==='partition'){
    if(candidate.x<-c.length/2+.15||candidate.x>c.length/2-.15) return false;
    for(let i=0;i<(state.counts.partition||0);i++){
      if(i!==index&&Math.abs(actualLayout('partition',i).x-candidate.x)<.25) return false;
    }
    return true;
  }

  if(['wc','sink','shower'].includes(type)){
    const d=objectDimensions(type,index),halfW=d.width/2,halfD=d.depth/2;
    if(candidate.x-halfW<-c.length/2+.08||candidate.x+halfW>c.length/2-.08||candidate.z-halfD<-c.width/2+.08||candidate.z+halfD>c.width/2-.08) return false;
    for(const otherType of ['wc','sink','shower']){
      for(let i=0;i<(state.counts[otherType]||0);i++){
        if(otherType===type&&i===index) continue;
        const other=actualLayout(otherType,i),od=objectDimensions(otherType,i);
        const overlapX=Math.abs(other.x-candidate.x)<halfW+od.width/2+.08;
        const overlapZ=Math.abs(other.z-candidate.z)<halfD+od.depth/2+.08;
        if(overlapX&&overlapZ) return false;
      }
    }
    return true;
  }
  return true;
};

function updateSelectedDimension(key,value){
  if(!selectedEditable||!supportsDimensions(selectedEditable.type)) return;
  const {type,index}=selectedEditable,field=dimensionField(type,key);
  if(!field) return;
  const parsed=Number(value);
  if(!Number.isFinite(parsed)) return toast('Ingresa una medida válida');

  const current=objectDimensions(type,index);
  let nextValue=clamp(parsed,field.min,field.max);
  const c=DATA.containers[state.container];
  if(key==='height') nextValue=Math.min(nextValue,c.height-.06);
  if(type==='partition'&&key==='width') nextValue=Math.min(nextValue,c.width-.08);
  nextValue=Math.round(nextValue*100)/100;
  const next={...current,[key]:nextValue};

  if(!dimensionChangeAllowed(type,index,next)){
    renderDimensionEditor(type,index);
    return toast('Esa medida no cabe en la posición actual');
  }

  pushHistory();
  ensureDimensionState();
  state.dimensions[type][index]=next;
  renderAll();
  toast(`${field.label}: ${nextValue.toFixed(2)} m`);
}

function resetSelectedDimensions(){
  if(!selectedEditable||!supportsDimensions(selectedEditable.type)) return;
  const {type,index}=selectedEditable;
  pushHistory();
  ensureDimensionState();
  state.dimensions[type][index]=undefined;
  renderAll();
  toast('Medidas originales restauradas');
}

function renderDimensionEditor(type,index){
  const editor=document.getElementById('dimension-editor');
  if(!editor) return;
  if(!supportsDimensions(type)){
    editor.classList.add('hidden');
    return;
  }

  const dims=objectDimensions(type,index),schema=OBJECT_DIMENSIONS[type];
  editor.classList.remove('hidden');
  const fields=editor.querySelector('[data-dimension-fields]');
  fields.innerHTML=schema.fields.map(field=>{
    let max=field.max;
    const c=DATA.containers[state.container];
    if(field.key==='height') max=Math.min(max,c.height-.06);
    if(type==='partition'&&field.key==='width') max=Math.min(max,c.width-.08);
    return `<label class="dimension-field"><span>${field.label}</span><div class="dimension-input-wrap"><input type="number" inputmode="decimal" min="${field.min}" max="${max.toFixed(2)}" step="${field.step}" value="${Number(dims[field.key]).toFixed(2)}" onchange="updateSelectedDimension('${field.key}',this.value)"><small>m</small></div></label>`;
  }).join('');
}

function installDimensionEditor(){
  const panel=document.getElementById('object-editor');
  if(!panel||document.getElementById('dimension-editor')) return;
  const editor=document.createElement('div');
  editor.id='dimension-editor';
  editor.className='hidden mt-3 rounded-xl bg-white/5 border border-white/10 p-3';
  editor.innerHTML=`
    <div class="flex items-center justify-between gap-2 mb-2">
      <div><div class="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Medidas del objeto</div><div class="text-[10px] text-slate-500 mt-0.5">Edita en metros</div></div>
      <button type="button" onclick="resetSelectedDimensions()" class="text-[10px] font-bold text-amber-300 hover:text-amber-200">Restaurar</button>
    </div>
    <div data-dimension-fields class="grid grid-cols-2 gap-2"></div>`;
  const deleteBtn=panel.querySelector('button[onclick*="deleteSelectedObject"]');
  if(deleteBtn) panel.insertBefore(editor,deleteBtn); else panel.appendChild(editor);

  if(!document.getElementById('dimension-editor-style')){
    const style=document.createElement('style');
    style.id='dimension-editor-style';
    style.textContent=`
      .dimension-field{display:block;min-width:0}.dimension-field>span{display:block;font-size:10px;font-weight:800;color:#cbd5e1;margin-bottom:4px}.dimension-input-wrap{display:flex;align-items:center;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.07);border-radius:9px;overflow:hidden}.dimension-input-wrap input{width:100%;min-width:0;background:transparent;border:0;outline:0;color:#fff;padding:8px 7px;font-size:12px;font-weight:800}.dimension-input-wrap small{padding:0 7px;color:#94a3b8;font-size:10px;font-weight:800}`;
    document.head.appendChild(style);
  }
}

const showEditorPanelBeforeDimensions=showEditorPanel;
showEditorPanel=function(root){
  showEditorPanelBeforeDimensions(root);
  if(!root) return;
  installDimensionEditor();
  const meta=root.userData.editor;
  renderDimensionEditor(meta.type,meta.index);
};

hideEditorPanel=(function(original){
  return function(){
    original();
    document.getElementById('dimension-editor')?.classList.add('hidden');
  };
})(hideEditorPanel);

deleteSelectedObject=function(){
  if(!selectedEditable) return;
  const {type,index}=selectedEditable;
  if(!(state.counts[type]>0)) return;
  pushHistory();
  state.counts[type]--;
  ensureLayoutState();
  state.layout[type]?.splice(index,1);
  ensureDimensionState();
  state.dimensions[type]?.splice(index,1);
  selectedEditable=null;
  hideEditorPanel();
  renderAll();
  toast(`${typeLabel(type)} eliminado`);
};

rebuild3D=function(){
  if(!containerGroup) return;
  ensureLayoutState();
  ensureDimensionState();
  clearInvalidLayoutEntries();
  clearInvalidDimensionEntries();
  disposeGroup(containerGroup);
  editableObjects=[];

  const c=DATA.containers[state.container],extColor=new THREE.Color(state.exteriorColor);
  const materials={
    exterior:mat(extColor,{roughness:.58,metalness:.2}),
    interior:mat(state.finish==='sanitary'?0xf8fafc:0xf1f5f9,{roughness:state.finish==='sanitary'?.32:.82}),
    frame:mat(new THREE.Color(extColor).multiplyScalar(.55),{roughness:.42,metalness:.48}),
    floor:createFloorMaterial()
  };
  containerGroup.add(createContainerShell(c,materials));
  addCargoDoorDetails(containerGroup,c);

  for(const type of ['window','door']){
    for(let i=0;i<(state.counts[type]||0);i++){
      const p=actualLayout(type,i),dims=objectDimensions(type,i);
      const obj=type==='window'?createWindow():createDoor();
      fitObjectToDimensions(obj,type,dims);
      mountedParametricPosition(obj,type,p,c,dims);
      containerGroup.add(obj);
      registerEditable(obj,type,i,{axis:(p.face==='A'||p.face==='B')?'x':'z',surface:mountedSurface(p.face),face:p.face});
    }
  }

  for(let i=0;i<(state.counts.partition||0);i++){
    const p=actualLayout('partition',i),dims=objectDimensions('partition',i);
    const obj=createPartition(c.width-.2,c.height-.15);
    fitObjectToDimensions(obj,'partition',dims);
    addGroup(containerGroup,obj,p.x,.08,0);
    registerEditable(obj,'partition',i,{axis:'x',surface:'floor'});
  }

  for(const type of ['wc','sink','shower']){
    for(let i=0;i<(state.counts[type]||0);i++){
      const p=actualLayout(type,i),dims=objectDimensions(type,i);
      const obj=type==='wc'?createWC():type==='sink'?createSink():createShower();
      fitObjectToDimensions(obj,type,dims);
      addGroup(containerGroup,obj,p.x,.08,p.z,type==='sink'?Math.PI:0);
      registerEditable(obj,type,i,{axis:'xz',surface:'floor'});
    }
  }

  for(let i=0;i<(state.counts.ac||0);i++){
    const p=actualLayout('ac',i),dims=objectDimensions('ac',i);
    const indoor=createSplitAC(),outdoor=createCondenser();
    fitObjectToDimensions(indoor,'ac',dims);
    mountedParametricPosition(indoor,'ac',p,c,dims);
    positionCondenser(outdoor,p,c);
    containerGroup.add(indoor,outdoor);
    registerEditable(indoor,'ac',i,{axis:(p.face==='A'||p.face==='B')?'x':'z',surface:mountedSurface(p.face),face:p.face});
  }

  for(let i=0;i<(state.counts.electrical||0);i++){
    const p=actualLayout('electrical',i),obj=createElectricalPoint();
    positionMountedObject(obj,'electrical',p,c);
    containerGroup.add(obj);
    registerEditable(obj,'electrical',i,{axis:(p.face==='A'||p.face==='B')?'x':'z',surface:mountedSurface(p.face),face:p.face});
  }

  const lightCount=Math.max(1,Math.ceil((state.counts.electrical||0)/3));
  for(let i=0;i<lightCount;i++) addGroup(containerGroup,createCeilingLight(),slotPosition(i,lightCount,c.length,.7),c.height-.1,0);

  addFurnishings(containerGroup,c);
  if(state.showPeople) addGroup(containerGroup,createHuman(),c.length*.28,.08,c.width/2+.75,-Math.PI/2);
  addFaceLabels(containerGroup,c);
  controls?.target.set(0,c.height*.45,0);
  updateLighting();

  if(selectedEditable){
    const root=editableObjects.find(o=>o.userData.editor?.type===selectedEditable.type&&o.userData.editor?.index===selectedEditable.index);
    if(root){ addSelectionOutline(root); showEditorPanel(root); }
    else{ selectedEditable=null; hideEditorPanel(); }
  }
};

function bootDimensionEditor(){
  ensureDimensionState();
  installDimensionEditor();
  rebuild3D();
}

if(document.readyState==='loading'){
  window.addEventListener('DOMContentLoaded',()=>setTimeout(bootDimensionEditor,120));
}else{
  setTimeout(bootDimensionEditor,120);
}
