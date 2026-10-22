// Direct 3D editor layer. Loaded after app.js.

let editableObjects=[];
let selectedEditable=null;
let draggingEditable=null;
let dragStartState=null;
let editorRaycaster=null;
let editorPointer=null;
let dragPlane=null;
let dragMoved=false;
let editorInstalled=false;

function ensureLayoutState(){
  if(!state.layout) state.layout={};
  ['window','door','partition','wc','sink','shower','ac'].forEach(type=>{
    if(!Array.isArray(state.layout[type])) state.layout[type]=[];
  });
}
function layoutValue(type,index,fallback){ ensureLayoutState(); return {...fallback,...(state.layout[type][index]||{})}; }
function clearInvalidLayoutEntries(){ ensureLayoutState(); Object.keys(state.layout).forEach(type=>{ state.layout[type]=state.layout[type].slice(0,state.counts[type]||0); }); }
function registerEditable(group,type,index,config={}){ group.userData.editor={type,index,...config}; group.traverse(obj=>{obj.userData.editorRoot=group;}); editableObjects.push(group); return group; }

function clearSelectionHelpers(){
  editableObjects.forEach(root=>{
    root.children.filter(child=>child.userData?.selectionHelper).forEach(helper=>{
      root.remove(helper); helper.geometry?.dispose?.(); helper.material?.dispose?.();
    });
  });
}
function addSelectionOutline(group){
  clearSelectionHelpers(); if(!group) return;
  const bounds=new THREE.Box3().setFromObject(group); if(bounds.isEmpty()) return;
  const size=new THREE.Vector3(),center=new THREE.Vector3(); bounds.getSize(size); bounds.getCenter(center);
  const localCenter=group.worldToLocal(center.clone());
  const geo=new THREE.BoxGeometry(Math.max(.12,size.x+.08),Math.max(.12,size.y+.08),Math.max(.12,size.z+.08));
  const edges=new THREE.EdgesGeometry(geo); geo.dispose();
  const line=new THREE.LineSegments(edges,new THREE.LineBasicMaterial({color:0xf59e0b,depthTest:false,transparent:true,opacity:.98}));
  line.position.copy(localCenter); line.renderOrder=999; line.userData.selectionHelper=true; group.add(line);
}
function defaultWallX(index,count,length,padding=.9){ return slotPosition(index,count,length,padding); }
function sanitaryFallbacks(c){
  const list=[]; for(let i=0;i<(state.counts.wc||0);i++) list.push(['wc',i]); for(let i=0;i<(state.counts.sink||0);i++) list.push(['sink',i]); for(let i=0;i<(state.counts.shower||0);i++) list.push(['shower',i]);
  const cols=Math.max(1,Math.min(c.length>8?5:3,Math.ceil(Math.sqrt(list.length||1))));
  const result={wc:[],sink:[],shower:[]};
  list.forEach(([type,index],globalIndex)=>{
    const row=Math.floor(globalIndex/cols),col=globalIndex%cols;
    result[type][index]={x:clamp(-c.length*.28+col*1.05,-c.length/2+.65,c.length/2-.65),z:clamp(-.55+row*.95,-c.width/2+.46,c.width/2-.46)};
  });
  return result;
}
function actualLayout(type,index){
  const c=DATA.containers[state.container];
  if(type==='window') return layoutValue(type,index,{x:defaultWallX(index,state.counts.window||0,c.length,.9)});
  if(type==='door') return layoutValue(type,index,{x:defaultWallX(index,state.counts.door||0,c.length,1)});
  if(type==='partition') return layoutValue(type,index,{x:-c.length/2+((index+1)*c.length/((state.counts.partition||0)+1))});
  if(type==='ac') return layoutValue(type,index,{x:defaultWallX(index,state.counts.ac||0,c.length,1)});
  if(['wc','sink','shower'].includes(type)) return layoutValue(type,index,sanitaryFallbacks(c)[type][index]||{x:0,z:0});
  return {x:0,z:0};
}
function validCandidate(type,index,candidate){
  const c=DATA.containers[state.container];
  const wallRules={window:{minX:-c.length/2+.72,maxX:c.length/2-.72,gap:1.22},door:{minX:-c.length/2+.58,maxX:c.length/2-.58,gap:1.02},partition:{minX:-c.length/2+.55,maxX:c.length/2-.55,gap:.45},ac:{minX:-c.length/2+.55,maxX:c.length/2-.55,gap:.95}};
  const rule=wallRules[type];
  if(rule){
    if(candidate.x<rule.minX||candidate.x>rule.maxX) return false;
    for(let i=0;i<(state.counts[type]||0);i++){ if(i===index) continue; if(Math.abs(actualLayout(type,i).x-candidate.x)<rule.gap) return false; }
  }
  if(['wc','sink','shower'].includes(type)){
    if(candidate.x<-c.length/2+.48||candidate.x>c.length/2-.48||candidate.z<-c.width/2+.38||candidate.z>c.width/2-.38) return false;
    for(const otherType of ['wc','sink','shower']) for(let i=0;i<(state.counts[otherType]||0);i++){
      if(otherType===type&&i===index) continue;
      const other=actualLayout(otherType,i); if(Math.hypot(other.x-candidate.x,other.z-candidate.z)<.68) return false;
    }
  }
  return true;
}
function typeLabel(type){ return ({window:'Ventana termopanel',door:'Puerta peatonal',partition:'División interior',wc:'WC',sink:'Lavamanos',shower:'Ducha',ac:'Aire acondicionado'})[type]||type; }
function editorPositionLabel(type,pos){ return ['wc','sink','shower'].includes(type)?`X ${pos.x.toFixed(2)} m · Z ${pos.z.toFixed(2)} m`:`X ${pos.x.toFixed(2)} m`; }
function showEditorPanel(root){
  const panel=document.getElementById('object-editor'); if(!panel||!root) return;
  const meta=root.userData.editor,pos=actualLayout(meta.type,meta.index);
  document.getElementById('editor-title').textContent=typeLabel(meta.type);
  document.getElementById('editor-subtitle').textContent=`Elemento ${meta.index+1} · ${editorPositionLabel(meta.type,pos)}`;
  panel.classList.remove('hidden');
}
function hideEditorPanel(){ document.getElementById('object-editor')?.classList.add('hidden'); }
function selectEditable(root){
  if(!root){ selectedEditable=null; clearSelectionHelpers(); hideEditorPanel(); return; }
  const meta=root.userData.editor; selectedEditable={type:meta.type,index:meta.index}; addSelectionOutline(root); showEditorPanel(root);
}
function deleteSelectedObject(){
  if(!selectedEditable) return; const {type,index}=selectedEditable; if(!(state.counts[type]>0)) return;
  pushHistory(); state.counts[type]--; ensureLayoutState(); state.layout[type].splice(index,1); selectedEditable=null; hideEditorPanel(); renderAll(); toast(`${typeLabel(type)} eliminado`);
}
function nudgeSelected(dx=0,dz=0){
  if(!selectedEditable) return; const {type,index}=selectedEditable,current=actualLayout(type,index);
  const candidate={...current,x:Math.round((current.x+dx)*100)/100}; if(['wc','sink','shower'].includes(type)) candidate.z=Math.round(((current.z||0)+dz)*100)/100;
  if(!validCandidate(type,index,candidate)) return toast('Esa posición no es válida');
  pushHistory(); ensureLayoutState(); state.layout[type][index]=candidate; renderAll(); toast('Posición ajustada');
}
function resetSelectedPosition(){
  if(!selectedEditable) return; const {type,index}=selectedEditable; pushHistory(); ensureLayoutState(); state.layout[type][index]=undefined; renderAll(); toast('Posición automática restaurada');
}

rebuild3D=function(){
  if(!containerGroup) return;
  ensureLayoutState(); clearInvalidLayoutEntries(); disposeGroup(containerGroup); editableObjects=[];
  const c=DATA.containers[state.container],extColor=new THREE.Color(state.exteriorColor);
  const materials={exterior:mat(extColor,{roughness:.58,metalness:.2}),interior:mat(state.finish==='sanitary'?0xf8fafc:0xf1f5f9,{roughness:state.finish==='sanitary'?.32:.82}),frame:mat(new THREE.Color(extColor).multiplyScalar(.55),{roughness:.42,metalness:.48}),floor:createFloorMaterial()};
  containerGroup.add(createContainerShell(c,materials));
  for(let i=0;i<(state.counts.window||0);i++){ const p=actualLayout('window',i),obj=createWindow(); addGroup(containerGroup,obj,p.x,c.height*.60,-c.width/2-.075,0); registerEditable(obj,'window',i,{axis:'x',surface:'rear'}); }
  for(let i=0;i<(state.counts.door||0);i++){ const p=actualLayout('door',i),obj=createDoor(); addGroup(containerGroup,obj,p.x,1.06,c.width/2+.07,0); registerEditable(obj,'door',i,{axis:'x',surface:'front'}); }
  for(let i=0;i<(state.counts.partition||0);i++){ const p=actualLayout('partition',i),obj=createPartition(c.width-.2,c.height-.15); addGroup(containerGroup,obj,p.x,.08,0); registerEditable(obj,'partition',i,{axis:'x',surface:'floor'}); }
  for(const type of ['wc','sink','shower']) for(let i=0;i<(state.counts[type]||0);i++){
    const p=actualLayout(type,i),obj=type==='wc'?createWC():type==='sink'?createSink():createShower(); addGroup(containerGroup,obj,p.x,.08,p.z,type==='sink'?Math.PI:0); registerEditable(obj,type,i,{axis:'xz',surface:'floor'});
  }
  for(let i=0;i<(state.counts.ac||0);i++){ const p=actualLayout('ac',i),indoor=createSplitAC(); addGroup(containerGroup,indoor,p.x,c.height-.42,-c.width/2+.17); registerEditable(indoor,'ac',i,{axis:'x',surface:'rear'}); addGroup(containerGroup,createCondenser(),p.x,.08,c.width/2+.28); }
  const lightCount=Math.max(1,Math.ceil((state.counts.electrical||0)/3)); for(let i=0;i<lightCount;i++) addGroup(containerGroup,createCeilingLight(),slotPosition(i,lightCount,c.length,.7),c.height-.1,0);
  addFurnishings(containerGroup,c);
  if(state.showPeople) addGroup(containerGroup,createHuman(),c.length*.28,.08,state.cutaway?c.width*.24:c.width/2+.75,state.cutaway?Math.PI:-Math.PI/2);
  controls?.target.set(0,c.height*.45,0); updateLighting();
  if(selectedEditable){ const root=editableObjects.find(o=>o.userData.editor?.type===selectedEditable.type&&o.userData.editor?.index===selectedEditable.index); if(root){addSelectionOutline(root);showEditorPanel(root);}else{selectedEditable=null;hideEditorPanel();} }
};

function editableRootFromIntersection(object){ let node=object; while(node){if(node.userData?.editor)return node;if(node.userData?.editorRoot)return node.userData.editorRoot;node=node.parent;} return null; }
function pointerNDC(event){ const rect=renderer.domElement.getBoundingClientRect(); editorPointer.x=((event.clientX-rect.left)/rect.width)*2-1; editorPointer.y=-((event.clientY-rect.top)/rect.height)*2+1; }
function hitEditable(event){ pointerNDC(event); editorRaycaster.setFromCamera(editorPointer,camera); const hits=editorRaycaster.intersectObjects(editableObjects,true); return hits.length?editableRootFromIntersection(hits[0].object):null; }
function planeForEditable(root){
  const meta=root.userData.editor,c=DATA.containers[state.container];
  if(meta.axis==='xz'||meta.surface==='floor') return new THREE.Plane(new THREE.Vector3(0,1,0),-.08);
  if(meta.surface==='front') return new THREE.Plane(new THREE.Vector3(0,0,1),-(c.width/2+.07));
  if(meta.surface==='rear') return new THREE.Plane(new THREE.Vector3(0,0,1),c.width/2-.07);
  return new THREE.Plane(new THREE.Vector3(0,1,0),-.08);
}
function onEditorPointerDown(event){
  if(event.button!==0||isPresentation) return; const root=hitEditable(event); if(!root){selectEditable(null);return;}
  selectEditable(root); draggingEditable=root; dragPlane=planeForEditable(root); dragMoved=false; dragStartState=clone(state); controls.enabled=false; renderer.domElement.setPointerCapture?.(event.pointerId); event.preventDefault();
}
function onEditorPointerMove(event){
  if(!draggingEditable) return; pointerNDC(event); editorRaycaster.setFromCamera(editorPointer,camera);
  const point=new THREE.Vector3(); if(!editorRaycaster.ray.intersectPlane(dragPlane,point)) return;
  const {type,index}=draggingEditable.userData.editor,current=actualLayout(type,index); const candidate={...current,x:Math.round(point.x*20)/20};
  if(['wc','sink','shower'].includes(type)) candidate.z=Math.round(point.z*20)/20; if(!validCandidate(type,index,candidate)) return;
  dragMoved=true; ensureLayoutState(); state.layout[type][index]=candidate; draggingEditable.position.x=candidate.x; if(['wc','sink','shower'].includes(type)) draggingEditable.position.z=candidate.z;
  const subtitle=document.getElementById('editor-subtitle'); if(subtitle) subtitle.textContent=`Elemento ${index+1} · ${editorPositionLabel(type,candidate)}`;
}
function onEditorPointerUp(event){
  if(!draggingEditable) return; controls.enabled=true; renderer.domElement.releasePointerCapture?.(event.pointerId);
  if(dragMoved&&dragStartState){history.push(dragStartState);if(history.length>40)history.shift();future=[];toast('Posición actualizada');}
  draggingEditable=null;dragPlane=null;dragStartState=null;renderAll();
}

// --- Vista interior comercial y controles de acercamiento ---
function configureCameraForView(view){
  if(!camera||!controls) return;
  if(view==='interior'){
    camera.fov=60;
    controls.enablePan=false;
    controls.minDistance=.55;
    controls.maxDistance=4.8;
    controls.rotateSpeed=.55;
    controls.zoomSpeed=.8;
  }else{
    camera.fov=42;
    controls.enablePan=true;
    controls.minDistance=1.2;
    controls.maxDistance=32;
    controls.rotateSpeed=1;
    controls.zoomSpeed=1;
  }
  camera.updateProjectionMatrix();
}

setView=function(view,animateIt=true){
  if(!camera||!controls) return;
  const c=DATA.containers[state.container],span=Math.max(c.length,6); currentView=view;
  const needsCutaway=view==='cutaway'||view==='top';
  if(state.cutaway!==needsCutaway){state.cutaway=needsCutaway;rebuild3D();}
  configureCameraForView(view);
  let pos,target,label;
  if(view==='exterior'){
    pos=[span*.68,c.height*2.2,span*.72]; target=[0,c.height*.44,0]; label='Exterior';
  }else if(view==='cutaway'){
    pos=[span*.62,c.height*1.7,c.width*2.55]; target=[0,c.height*.42,0]; label='Corte 3D';
  }else if(view==='interior'){
    const eye=clamp(c.height*.56,1.48,1.62);
    const startX=-c.length/2+.82;
    const lookDistance=c.length>8?2.7:2.15;
    pos=[startX,eye,.08];
    target=[Math.min(c.length/2-.75,startX+lookDistance),eye-.08,-.03];
    label='Interior · altura persona';
  }else{
    pos=[.01,span*1.22,.01]; target=[0,0,0]; label='Planta';
  }
  const mode=document.getElementById('scene-mode-label'); if(mode) mode.textContent=label;
  if(animateIt) animateCamera(pos,target,view==='interior'?650:520);
  else{camera.position.set(...pos);controls.target.set(...target);camera.lookAt(controls.target);controls.update();}
};

function zoomCamera(direction){
  if(!camera||!controls) return;
  const offset=camera.position.clone().sub(controls.target);
  const distance=offset.length();
  const interior=currentView==='interior';
  const min=interior?.65:1.3;
  const max=interior?4.6:Math.max(9,DATA.containers[state.container].length*1.9);
  const factor=direction>0?.78:1.28;
  const next=clamp(distance*factor,min,max);
  if(Math.abs(next-distance)<.01) return;
  const newPos=controls.target.clone().add(offset.normalize().multiplyScalar(next));
  animateCamera(newPos.toArray(),controls.target.toArray(),220);
}

function installZoomControls(){
  if(document.getElementById('zoom-controls')) return;
  const viewer=document.querySelector('.viewer-wrap'); if(!viewer) return;
  const controlsBox=document.createElement('div');
  controlsBox.id='zoom-controls'; controlsBox.className='zoom-control-stack';
  controlsBox.innerHTML=`
    <button class="zoom-control-btn" onclick="zoomCamera(1)" title="Acercar diseño" aria-label="Acercar diseño"><i class="fa-solid fa-plus"></i></button>
    <button class="zoom-control-btn" onclick="zoomCamera(-1)" title="Alejar diseño" aria-label="Alejar diseño"><i class="fa-solid fa-minus"></i></button>`;
  viewer.appendChild(controlsBox);

  if(!document.getElementById('zoom-controls-style')){
    const style=document.createElement('style'); style.id='zoom-controls-style';
    style.textContent=`
      .zoom-control-stack{position:absolute;z-index:19;right:16px;top:50%;transform:translateY(-50%);display:grid;gap:8px}
      .zoom-control-btn{width:44px;height:44px;border-radius:14px;border:1px solid rgba(148,163,184,.28);background:rgba(15,23,42,.86);color:#fff;display:grid;place-items:center;box-shadow:0 10px 28px rgba(2,6,23,.24);backdrop-filter:blur(12px);font-size:15px;transition:.16s ease}
      .zoom-control-btn:hover{background:#f59e0b;color:#0f172a;border-color:#fbbf24;transform:scale(1.05)}
      .zoom-control-btn:active{transform:scale(.96)}
      .presentation-mode .zoom-control-stack{right:24px}
      @media(max-width:820px){.zoom-control-stack{right:10px;top:auto;bottom:78px;transform:none}.zoom-control-btn{width:40px;height:40px;border-radius:12px}.presentation-mode .zoom-control-stack{right:12px;bottom:76px}}
    `;
    document.head.appendChild(style);
  }
}

function installDirectEditor(){
  if(editorInstalled||!renderer?.domElement) return;
  editorInstalled=true; ensureLayoutState(); editorRaycaster=new THREE.Raycaster(); editorPointer=new THREE.Vector2();
  const canvas=renderer.domElement;
  canvas.addEventListener('pointerdown',onEditorPointerDown); canvas.addEventListener('pointermove',onEditorPointerMove); canvas.addEventListener('pointerup',onEditorPointerUp); canvas.addEventListener('pointercancel',onEditorPointerUp);
  window.addEventListener('keydown',event=>{
    if(!selectedEditable||['INPUT','TEXTAREA'].includes(document.activeElement?.tagName)) return;
    const step=event.shiftKey?.2:.05;
    if(event.key==='Delete'||event.key==='Backspace'){event.preventDefault();deleteSelectedObject();}
    else if(event.key==='ArrowLeft'){event.preventDefault();nudgeSelected(-step,0);}
    else if(event.key==='ArrowRight'){event.preventDefault();nudgeSelected(step,0);}
    else if(event.key==='ArrowUp'&&['wc','sink','shower'].includes(selectedEditable.type)){event.preventDefault();nudgeSelected(0,-step);}
    else if(event.key==='ArrowDown'&&['wc','sink','shower'].includes(selectedEditable.type)){event.preventDefault();nudgeSelected(0,step);}
  });
  installZoomControls(); rebuild3D();
}

window.addEventListener('DOMContentLoaded',()=>setTimeout(installDirectEditor,0));