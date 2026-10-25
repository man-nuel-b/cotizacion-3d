// Direct 3D editor layer. Loaded after app.js.

const CONTAINER_FACES={
  A:{label:'Cara A',description:'Lado donde está la persona de referencia',color:'#f59e0b'},
  B:{label:'Cara B',description:'Lado opuesto a la persona',color:'#38bdf8'},
  C:{label:'Cara C',description:'Extremo de las puertas originales',color:'#22c55e'},
  D:{label:'Cara D',description:'Extremo contrario a las puertas originales',color:'#a78bfa'}
};

let editableObjects=[];
let selectedEditable=null;
let draggingEditable=null;
let dragStartState=null;
let editorRaycaster=null;
let editorPointer=null;
let dragPlane=null;
let dragMoved=false;
let editorInstalled=false;
let faceLabelsVisible=true;

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
function windowFace(index){ ensureLayoutState(); return state.layout.window[index]?.face||'B'; }
function faceDimension(face,c){ return (face==='A'||face==='B')?c.length:c.width; }

function electricalTypeDefaultHeight(type,c){
  if(type==='switch') return 1.10;
  if(type==='acPoint') return Math.min(2.15,c.height-.18);
  if(type==='light') return c.height-.10;
  return .35;
}
function electricalTypeLabel(type){
  return ({outlet:'Enchufe doble',switch:'Interruptor',light:'Luminaria LED',acPoint:'Punto A/C'})[type]||'Punto eléctrico';
}
function ensureElectricalStateForEditor(){
  if(!state.electrical||typeof state.electrical!=='object') state.electrical={version:1,points:[]};
  if(!Array.isArray(state.electrical.points)) state.electrical.points=[];
  const desired=Math.max(0,Math.round(Number(state.counts?.electrical)||0));
  while(state.electrical.points.length<desired){
    state.electrical.points.push({id:`EL-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`,type:'outlet',circuit:'Enchufes',face:null,position:null,height:null});
  }
  if(state.electrical.points.length>desired) state.electrical.points=state.electrical.points.slice(0,desired);
  return state.electrical;
}
function electricalLayout(index){
  const c=DATA.containers[state.container],e=ensureElectricalStateForEditor(),point=e.points[index];
  if(!point) return {face:'B',x:0,y:.35,z:0};
  if(point.type==='light'){
    const x=Number.isFinite(point.position?.x)?point.position.x:slotPosition(index,Math.max(1,e.points.filter(p=>p.type==='light').length),c.length,.7);
    const z=Number.isFinite(point.position?.z)?point.position.z:0;
    return {face:'ceiling',x,z,y:c.height-.10};
  }
  const face=['A','B','C','D'].includes(point.face)?point.face:'B';
  const dim=faceDimension(face,c);
  const same=e.points.filter(p=>p.type!=='light'&&(['A','B','C','D'].includes(p.face)?p.face:'B')===face);
  const localIndex=Math.max(0,same.indexOf(point));
  const x=Number.isFinite(point.position?.x)?point.position.x:defaultWallX(localIndex,Math.max(1,same.length),dim,.42);
  const y=Number.isFinite(point.height)?point.height:electricalTypeDefaultHeight(point.type,c);
  return {face,x,y,z:0};
}
function writeElectricalLayout(index,candidate){
  const point=ensureElectricalStateForEditor().points[index]; if(!point) return;
  if(point.type==='light'){
    point.face='ceiling'; point.position={x:candidate.x,z:candidate.z}; point.height=null;
  }else{
    point.face=candidate.face; point.position={x:candidate.x}; point.height=candidate.y;
  }
}

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
  if(type==='electrical') return electricalLayout(index);
  if(type==='window'){
    const face=windowFace(index),dim=faceDimension(face,c);
    const stored=state.layout?.window?.[index];
    const fallbackOffset=(face==='A'||face==='B')?defaultWallX(index,state.counts.window||0,dim,.9):0;
    return {face,x:Number.isFinite(stored?.x)?stored.x:fallbackOffset};
  }
  if(type==='door') return layoutValue(type,index,{x:defaultWallX(index,state.counts.door||0,c.length,1)});
  if(type==='partition') return layoutValue(type,index,{x:-c.length/2+((index+1)*c.length/((state.counts.partition||0)+1))});
  if(type==='ac') return layoutValue(type,index,{x:defaultWallX(index,state.counts.ac||0,c.length,1)});
  if(['wc','sink','shower'].includes(type)) return layoutValue(type,index,sanitaryFallbacks(c)[type][index]||{x:0,z:0});
  return {x:0,z:0};
}

function validCandidate(type,index,candidate){
  const c=DATA.containers[state.container];
  if(type==='electrical'){
    const point=ensureElectricalStateForEditor().points[index]; if(!point) return false;
    if(point.type==='light'){
      return candidate.x>=-c.length/2+.18&&candidate.x<=c.length/2-.18&&candidate.z>=-c.width/2+.18&&candidate.z<=c.width/2-.18;
    }
    const dim=faceDimension(candidate.face||'B',c),limit=dim/2-.16;
    return candidate.x>=-limit&&candidate.x<=limit&&candidate.y>=.16&&candidate.y<=c.height-.16;
  }
  if(type==='window'){
    const face=candidate.face||windowFace(index),dim=faceDimension(face,c),limit=dim/2-.7;
    if(candidate.x<-limit||candidate.x>limit) return false;
    for(let i=0;i<(state.counts.window||0);i++){
      if(i===index) continue;
      const other=actualLayout('window',i);
      if(other.face===face&&Math.abs(other.x-candidate.x)<1.22) return false;
    }
    return true;
  }
  const wallRules={door:{minX:-c.length/2+.58,maxX:c.length/2-.58,gap:1.02},partition:{minX:-c.length/2+.55,maxX:c.length/2-.55,gap:.45},ac:{minX:-c.length/2+.55,maxX:c.length/2-.55,gap:.95}};
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

function typeLabel(type,index){
  if(type==='electrical') return electricalTypeLabel(ensureElectricalStateForEditor().points[index]?.type);
  return ({window:'Ventana termopanel',door:'Puerta peatonal',partition:'División interior',wc:'WC',sink:'Lavamanos',shower:'Ducha',ac:'Aire acondicionado'})[type]||type;
}
function editorPositionLabel(type,pos){
  if(type==='electrical') return pos.face==='ceiling'?`Cielo · X ${pos.x.toFixed(2)} m · Z ${pos.z.toFixed(2)} m`:`Cara ${pos.face} · ${pos.x.toFixed(2)} m · altura ${pos.y.toFixed(2)} m`;
  if(type==='window') return `Cara ${pos.face} · posición ${pos.x.toFixed(2)} m`;
  return ['wc','sink','shower'].includes(type)?`X ${pos.x.toFixed(2)} m · Z ${pos.z.toFixed(2)} m`:`X ${pos.x.toFixed(2)} m`;
}
function showEditorPanel(root){
  const panel=document.getElementById('object-editor'); if(!panel||!root) return;
  const meta=root.userData.editor,pos=actualLayout(meta.type,meta.index),electricalPoint=meta.type==='electrical'?ensureElectricalStateForEditor().points[meta.index]:null;
  document.getElementById('editor-title').textContent=typeLabel(meta.type,meta.index);
  document.getElementById('editor-subtitle').textContent=`Elemento ${meta.index+1} · ${editorPositionLabel(meta.type,pos)}`;
  const faceEditor=document.getElementById('window-face-editor');
  const wallElectrical=meta.type==='electrical'&&electricalPoint?.type!=='light';
  if(faceEditor){
    faceEditor.classList.toggle('hidden',meta.type!=='window'&&!wallElectrical);
    if(meta.type==='window'||wallElectrical) faceEditor.querySelectorAll('[data-face]').forEach(btn=>btn.classList.toggle('active-face',btn.dataset.face===pos.face));
  }
  const heightEditor=document.getElementById('electrical-height-editor');
  if(heightEditor) heightEditor.classList.toggle('hidden',!wallElectrical);
  panel.classList.remove('hidden');
}
function hideEditorPanel(){ document.getElementById('object-editor')?.classList.add('hidden'); }
function selectEditable(root){
  if(!root){ selectedEditable=null; clearSelectionHelpers(); hideEditorPanel(); return; }
  const meta=root.userData.editor; selectedEditable={type:meta.type,index:meta.index}; addSelectionOutline(root); showEditorPanel(root);
}
function deleteSelectedObject(){
  if(!selectedEditable) return; const {type,index}=selectedEditable;
  if(type==='electrical'){
    const e=ensureElectricalStateForEditor(); if(!e.points[index]) return;
    pushHistory(); e.points.splice(index,1); state.counts.electrical=e.points.length; selectedEditable=null; hideEditorPanel(); renderAll(); toast('Punto eléctrico eliminado'); return;
  }
  if(!(state.counts[type]>0)) return;
  pushHistory(); state.counts[type]--; ensureLayoutState(); state.layout[type].splice(index,1); selectedEditable=null; hideEditorPanel(); renderAll(); toast(`${typeLabel(type,index)} eliminado`);
}
function nudgeSelected(dx=0,dz=0,dy=0){
  if(!selectedEditable) return; const {type,index}=selectedEditable,current=actualLayout(type,index);
  if(type==='electrical'){
    const point=ensureElectricalStateForEditor().points[index]; if(!point) return;
    const candidate={...current};
    if(point.type==='light'){
      candidate.x=Math.round((candidate.x+dx)*100)/100; candidate.z=Math.round((candidate.z+dz)*100)/100;
    }else{
      candidate.x=Math.round((candidate.x+dx)*100)/100; candidate.y=Math.round((candidate.y+dy)*100)/100;
    }
    if(!validCandidate(type,index,candidate)) return toast('Esa posición no es válida');
    pushHistory(); writeElectricalLayout(index,candidate); renderAll(); toast('Posición ajustada'); return;
  }
  const candidate={...current,x:Math.round((current.x+dx)*100)/100}; if(['wc','sink','shower'].includes(type)) candidate.z=Math.round(((current.z||0)+dz)*100)/100;
  if(!validCandidate(type,index,candidate)) return toast('Esa posición no es válida');
  pushHistory(); ensureLayoutState(); state.layout[type][index]=candidate; renderAll(); toast('Posición ajustada');
}
function resetSelectedPosition(){
  if(!selectedEditable) return; const {type,index}=selectedEditable; pushHistory();
  if(type==='electrical'){
    const point=ensureElectricalStateForEditor().points[index]; if(point){point.face=null;point.position=null;point.height=null;} renderAll(); toast('Posición automática restaurada'); return;
  }
  ensureLayoutState(); if(type==='window') state.layout.window[index]={face:windowFace(index)}; else state.layout[type][index]=undefined;
  renderAll(); toast('Posición automática restaurada');
}

function positionWindowObject(obj,layout,c){
  const face=layout.face||'B'; obj.rotation.y=0;
  if(face==='A'){ obj.position.set(layout.x,c.height*.60,c.width/2+.075); obj.rotation.y=Math.PI; }
  else if(face==='B'){ obj.position.set(layout.x,c.height*.60,-c.width/2-.075); }
  else if(face==='C'){ obj.position.set(c.length/2+.075,c.height*.60,layout.x); obj.rotation.y=-Math.PI/2; }
  else { obj.position.set(-c.length/2-.075,c.height*.60,layout.x); obj.rotation.y=Math.PI/2; }
}
function createElectricalOutlet(){
  const g=new THREE.Group(),shell=mat(0xf8fafc,{roughness:.3}),dark=mat(0x334155,{roughness:.55});
  g.add(box(.14,.09,.026,shell)); [-.032,.032].forEach(x=>{const h=new THREE.Mesh(new THREE.CircleGeometry(.009,14),dark);h.position.set(x,0,.0145);g.add(h);}); return g;
}
function createElectricalSwitch(){
  const g=new THREE.Group(); g.add(box(.09,.13,.027,mat(0xf8fafc,{roughness:.3}))); const rocker=box(.052,.07,.013,mat(0xe2e8f0,{roughness:.38})); rocker.position.z=.020; rocker.rotation.x=-.08; g.add(rocker); return g;
}
function createElectricalAcPoint(){
  const g=createElectricalOutlet(),badge=box(.045,.022,.014,mat(0x38bdf8,{emissive:0x0c4a6e,emissiveIntensity:.18})); badge.position.set(.043,.028,.022); g.add(badge); return g;
}
function createElectricalLight(){
  const g=new THREE.Group(),rim=new THREE.Mesh(new THREE.CylinderGeometry(.105,.105,.018,24),mat(0xffffff,{emissive:0xffe7a3,emissiveIntensity:.36})); rim.rotation.x=Math.PI/2; g.add(rim); return g;
}
function positionElectricalObject(obj,layout,c){
  obj.rotation.set(0,0,0);
  if(layout.face==='ceiling'){obj.position.set(layout.x,c.height-.10,layout.z);return;}
  const inset=.062;
  if(layout.face==='A'){obj.position.set(layout.x,layout.y,c.width/2-inset);obj.rotation.y=Math.PI;}
  else if(layout.face==='B'){obj.position.set(layout.x,layout.y,-c.width/2+inset);}
  else if(layout.face==='C'){obj.position.set(c.length/2-inset,layout.y,layout.x);obj.rotation.y=-Math.PI/2;}
  else{obj.position.set(-c.length/2+inset,layout.y,layout.x);obj.rotation.y=Math.PI/2;}
}

function createFaceSprite(letter,description,color){
  const canvas=document.createElement('canvas'); canvas.width=640; canvas.height=180; const ctx=canvas.getContext('2d');
  ctx.fillStyle='rgba(15,23,42,.90)'; ctx.beginPath(); ctx.roundRect(5,5,630,170,28); ctx.fill();
  ctx.strokeStyle=color; ctx.lineWidth=6; ctx.stroke();
  ctx.fillStyle=color; ctx.font='900 76px Inter, Arial'; ctx.textAlign='left'; ctx.textBaseline='middle'; ctx.fillText(letter,32,90);
  ctx.fillStyle='#ffffff'; ctx.font='800 28px Inter, Arial'; ctx.fillText(`CARA ${letter}`,135,66);
  ctx.fillStyle='#cbd5e1'; ctx.font='500 21px Inter, Arial'; ctx.fillText(description,135,110);
  const texture=new THREE.CanvasTexture(canvas); if('encoding' in texture) texture.encoding=THREE.sRGBEncoding;
  const material=new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:false}); const sprite=new THREE.Sprite(material); sprite.scale.set(2.6,.73,1); sprite.renderOrder=998; sprite.userData.faceLabel=true; return sprite;
}
function addFaceLabels(parent,c){
  if(!faceLabelsVisible) return;
  const y=Math.min(c.height*.72,2.05);
  const labels=[
    ['A',CONTAINER_FACES.A.description,CONTAINER_FACES.A.color,[0,y,c.width/2+.72]],
    ['B',CONTAINER_FACES.B.description,CONTAINER_FACES.B.color,[0,y,-c.width/2-.72]],
    ['C',CONTAINER_FACES.C.description,CONTAINER_FACES.C.color,[c.length/2+.78,y,0]],
    ['D',CONTAINER_FACES.D.description,CONTAINER_FACES.D.color,[-c.length/2-.78,y,0]]
  ];
  labels.forEach(([letter,desc,color,pos])=>{ const sprite=createFaceSprite(letter,desc,color); sprite.position.set(...pos); parent.add(sprite); });
}
function addCargoDoorDetails(parent,c){
  const dark=mat(0x172033,{roughness:.38,metalness:.6}); const steel=mat(0x94a3b8,{roughness:.22,metalness:.8}); const x=c.length/2+.075;
  parent.add(box(.025,c.height-.34,.035,dark,x,c.height/2,0));
  [-c.width*.23,c.width*.23].forEach(z=>{
    const rod=cylinder(.022,.022,c.height*.72,12,steel); rod.position.set(x+.045,c.height*.48,z); parent.add(rod);
    const handle=box(.035,.035,.28,steel,x+.065,c.height*.42,z+.10); parent.add(handle);
  });
  [-c.width*.42,c.width*.42].forEach(z=>parent.add(box(.03,c.height-.35,.03,dark,x,c.height/2,z)));
}

rebuild3D=function(){
  if(!containerGroup) return;
  ensureLayoutState(); ensureElectricalStateForEditor(); clearInvalidLayoutEntries(); disposeGroup(containerGroup); editableObjects=[];
  const c=DATA.containers[state.container],extColor=new THREE.Color(state.exteriorColor);
  const materials={exterior:mat(extColor,{roughness:.58,metalness:.2}),interior:mat(state.finish==='sanitary'?0xf8fafc:0xf1f5f9,{roughness:state.finish==='sanitary'?.32:.82}),frame:mat(new THREE.Color(extColor).multiplyScalar(.55),{roughness:.42,metalness:.48}),floor:createFloorMaterial()};
  containerGroup.add(createContainerShell(c,materials)); addCargoDoorDetails(containerGroup,c);
  for(let i=0;i<(state.counts.window||0);i++){
    const p=actualLayout('window',i),obj=createWindow(); positionWindowObject(obj,p,c); containerGroup.add(obj);
    const surface=p.face==='A'?'faceA':p.face==='B'?'faceB':p.face==='C'?'faceC':'faceD';
    registerEditable(obj,'window',i,{axis:(p.face==='A'||p.face==='B')?'x':'z',surface,face:p.face});
  }
  for(let i=0;i<(state.counts.door||0);i++){ const p=actualLayout('door',i),obj=createDoor(); addGroup(containerGroup,obj,p.x,1.06,c.width/2+.07,0); registerEditable(obj,'door',i,{axis:'x',surface:'front'}); }
  for(let i=0;i<(state.counts.partition||0);i++){ const p=actualLayout('partition',i),obj=createPartition(c.width-.2,c.height-.15); addGroup(containerGroup,obj,p.x,.08,0); registerEditable(obj,'partition',i,{axis:'x',surface:'floor'}); }
  for(const type of ['wc','sink','shower']) for(let i=0;i<(state.counts[type]||0);i++){
    const p=actualLayout(type,i),obj=type==='wc'?createWC():type==='sink'?createSink():createShower(); addGroup(containerGroup,obj,p.x,.08,p.z,type==='sink'?Math.PI:0); registerEditable(obj,type,i,{axis:'xz',surface:'floor'});
  }
  for(let i=0;i<(state.counts.ac||0);i++){ const p=actualLayout('ac',i),indoor=createSplitAC(); addGroup(containerGroup,indoor,p.x,c.height-.42,-c.width/2+.17); registerEditable(indoor,'ac',i,{axis:'x',surface:'rear'}); addGroup(containerGroup,createCondenser(),p.x,.08,c.width/2+.28); }
  ensureElectricalStateForEditor().points.forEach((point,i)=>{
    const p=actualLayout('electrical',i),obj=point.type==='switch'?createElectricalSwitch():point.type==='acPoint'?createElectricalAcPoint():point.type==='light'?createElectricalLight():createElectricalOutlet();
    positionElectricalObject(obj,p,c); containerGroup.add(obj);
    const surface=p.face==='ceiling'?'ceiling':p.face==='A'?'faceA':p.face==='B'?'faceB':p.face==='C'?'faceC':'faceD';
    registerEditable(obj,'electrical',i,{axis:p.face==='ceiling'?'xz':'xy',surface,face:p.face});
  });
  const legacyLightCount=state.electrical?.points?.some(p=>p.type==='light')?0:Math.max(1,Math.ceil((state.counts.electrical||0)/3));
  for(let i=0;i<legacyLightCount;i++) addGroup(containerGroup,createCeilingLight(),slotPosition(i,legacyLightCount,c.length,.7),c.height-.1,0);
  addFurnishings(containerGroup,c);
  if(state.showPeople) addGroup(containerGroup,createHuman(),c.length*.28,.08,c.width/2+.75,-Math.PI/2);
  addFaceLabels(containerGroup,c);
  controls?.target.set(0,c.height*.45,0); updateLighting();
  if(selectedEditable){ const root=editableObjects.find(o=>o.userData.editor?.type===selectedEditable.type&&o.userData.editor?.index===selectedEditable.index); if(root){addSelectionOutline(root);showEditorPanel(root);}else{selectedEditable=null;hideEditorPanel();} }
};

function editableRootFromIntersection(object){ let node=object; while(node){if(node.userData?.editor)return node;if(node.userData?.editorRoot)return node.userData.editorRoot;node=node.parent;} return null; }
function pointerNDC(event){ const rect=renderer.domElement.getBoundingClientRect(); editorPointer.x=((event.clientX-rect.left)/rect.width)*2-1; editorPointer.y=-((event.clientY-rect.top)/rect.height)*2+1; }
function hitEditable(event){ pointerNDC(event); editorRaycaster.setFromCamera(editorPointer,camera); const hits=editorRaycaster.intersectObjects(editableObjects,true); return hits.length?editableRootFromIntersection(hits[0].object):null; }
function planeForEditable(root){
  const meta=root.userData.editor,c=DATA.containers[state.container];
  if(meta.surface==='faceA') return new THREE.Plane(new THREE.Vector3(0,0,1),-(c.width/2+.075));
  if(meta.surface==='faceB') return new THREE.Plane(new THREE.Vector3(0,0,1),c.width/2+.075);
  if(meta.surface==='faceC') return new THREE.Plane(new THREE.Vector3(1,0,0),-(c.length/2+.075));
  if(meta.surface==='faceD') return new THREE.Plane(new THREE.Vector3(1,0,0),c.length/2+.075);
  if(meta.surface==='ceiling') return new THREE.Plane(new THREE.Vector3(0,1,0),-(c.height-.10));
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
  const {type,index}=draggingEditable.userData.editor,current=actualLayout(type,index);
  let candidate={...current};
  if(type==='electrical'){
    const electricalPoint=ensureElectricalStateForEditor().points[index]; if(!electricalPoint) return;
    if(electricalPoint.type==='light'){
      candidate.x=Math.round(point.x*20)/20; candidate.z=Math.round(point.z*20)/20;
    }else{
      candidate.x=Math.round(((current.face==='A'||current.face==='B')?point.x:point.z)*20)/20;
      candidate.y=Math.round(point.y*20)/20;
    }
  }else if(type==='window'){
    candidate.x=Math.round(((current.face==='A'||current.face==='B')?point.x:point.z)*20)/20;
  }else{
    candidate.x=Math.round(point.x*20)/20; if(['wc','sink','shower'].includes(type)) candidate.z=Math.round(point.z*20)/20;
  }
  if(!validCandidate(type,index,candidate)) return;
  dragMoved=true;
  if(type==='electrical'){
    writeElectricalLayout(index,candidate); positionElectricalObject(draggingEditable,candidate,DATA.containers[state.container]);
  }else{
    ensureLayoutState(); state.layout[type][index]=candidate;
    if(type==='window') positionWindowObject(draggingEditable,candidate,DATA.containers[state.container]);
    else{ draggingEditable.position.x=candidate.x; if(['wc','sink','shower'].includes(type)) draggingEditable.position.z=candidate.z; }
  }
  const subtitle=document.getElementById('editor-subtitle'); if(subtitle) subtitle.textContent=`Elemento ${index+1} · ${editorPositionLabel(type,candidate)}`;
}
function onEditorPointerUp(event){
  if(!draggingEditable) return; controls.enabled=true; renderer.domElement.releasePointerCapture?.(event.pointerId);
  if(dragMoved&&dragStartState){history.push(dragStartState);if(history.length>40)history.shift();future=[];toast('Posición actualizada');}
  draggingEditable=null;dragPlane=null;dragStartState=null;renderAll();
}

function configureCameraForView(view){
  if(!camera||!controls) return;
  if(view==='interior'){camera.fov=60;controls.enablePan=false;controls.minDistance=.55;controls.maxDistance=4.8;controls.rotateSpeed=.55;controls.zoomSpeed=.8;}
  else{camera.fov=42;controls.enablePan=true;controls.minDistance=1.2;controls.maxDistance=32;controls.rotateSpeed=1;controls.zoomSpeed=1;}
  camera.updateProjectionMatrix();
}
setView=function(view,animateIt=true){
  if(!camera||!controls) return;
  const c=DATA.containers[state.container],span=Math.max(c.length,6); currentView=view;
  const needsCutaway=view==='cutaway'||view==='top'; if(state.cutaway!==needsCutaway){state.cutaway=needsCutaway;rebuild3D();}
  configureCameraForView(view); let pos,target,label;
  if(view==='exterior'){pos=[span*.68,c.height*2.2,span*.72];target=[0,c.height*.44,0];label='Exterior';}
  else if(view==='cutaway'){pos=[span*.62,c.height*1.7,c.width*2.55];target=[0,c.height*.42,0];label='Corte 3D';}
  else if(view==='interior'){const eye=clamp(c.height*.56,1.48,1.62),startX=-c.length/2+.82,lookDistance=c.length>8?2.7:2.15;pos=[startX,eye,.08];target=[Math.min(c.length/2-.75,startX+lookDistance),eye-.08,-.03];label='Interior · altura persona';}
  else{pos=[.01,span*1.22,.01];target=[0,0,0];label='Planta';}
  const mode=document.getElementById('scene-mode-label'); if(mode) mode.textContent=label;
  if(animateIt) animateCamera(pos,target,view==='interior'?650:520); else{camera.position.set(...pos);controls.target.set(...target);camera.lookAt(controls.target);controls.update();}
};
function zoomCamera(direction){
  if(!camera||!controls) return; const offset=camera.position.clone().sub(controls.target),distance=offset.length(),interior=currentView==='interior',min=interior?.65:1.3,max=interior?4.6:Math.max(9,DATA.containers[state.container].length*1.9),factor=direction>0?.78:1.28,next=clamp(distance*factor,min,max);
  if(Math.abs(next-distance)<.01)return; const newPos=controls.target.clone().add(offset.normalize().multiplyScalar(next)); animateCamera(newPos.toArray(),controls.target.toArray(),220);
}
function focusFace(face){
  if(!camera||!controls) return; const c=DATA.containers[state.container],span=Math.max(c.length,6);
  if(state.cutaway){state.cutaway=false;rebuild3D();} currentView='exterior'; configureCameraForView('exterior');
  let pos; if(face==='A')pos=[0,c.height*.9,Math.max(5,span*.62)]; else if(face==='B')pos=[0,c.height*.9,-Math.max(5,span*.62)]; else if(face==='C')pos=[Math.max(5,c.length*.62),c.height*.9,0]; else pos=[-Math.max(5,c.length*.62),c.height*.9,0];
  const mode=document.getElementById('scene-mode-label'); if(mode)mode.textContent=`Cara ${face}`; animateCamera(pos,[0,c.height*.48,0],520);
}

function findAvailableWindowOffset(face,excludeIndex=null){
  const c=DATA.containers[state.container],dim=faceDimension(face,c),limit=dim/2-.72,others=[];
  for(let i=0;i<(state.counts.window||0);i++){ if(i===excludeIndex)continue; const p=actualLayout('window',i); if(p.face===face)others.push(p.x); }
  const candidates=[0]; for(let d=.25;d<=limit+.001;d+=.15){candidates.push(Number(d.toFixed(2)),Number((-d).toFixed(2)));}
  return candidates.find(v=>Math.abs(v)<=limit&&others.every(o=>Math.abs(o-v)>=1.22))??null;
}
function openWindowFacePicker(){
  installFaceUI(); const modal=document.getElementById('window-face-modal'); modal?.classList.remove('hidden'); modal?.classList.add('flex');
}
function closeWindowFacePicker(){ const modal=document.getElementById('window-face-modal'); modal?.classList.add('hidden'); modal?.classList.remove('flex'); }
function addWindowToFace(face){
  const max=DATA.extras.window.max; if((state.counts.window||0)>=max){closeWindowFacePicker();return toast('Llegaste al máximo de ventanas');}
  const offset=findAvailableWindowOffset(face); if(offset===null)return toast(`No queda espacio suficiente en la cara ${face}`);
  pushHistory(); ensureLayoutState(); const index=state.counts.window||0; state.counts.window=index+1; state.layout.window[index]={face,x:offset};
  closeWindowFacePicker(); renderAll(); focusFace(face); toast(`Ventana agregada en cara ${face}`);
}
function changeSelectedWindowFace(face){
  if(!selectedEditable) return;
  const {type,index}=selectedEditable;
  if(type==='electrical'){
    const e=ensureElectricalStateForEditor(),point=e.points[index]; if(!point||point.type==='light') return;
    const current=actualLayout('electrical',index),dim=faceDimension(face,DATA.containers[state.container]);
    pushHistory(); point.face=face; point.position={x:clamp(current.x,-dim/2+.16,dim/2-.16)}; point.height=clamp(current.y,.16,DATA.containers[state.container].height-.16); renderAll(); focusFace(face); toast(`Punto eléctrico movido a cara ${face}`); return;
  }
  if(type!=='window') return; const offset=findAvailableWindowOffset(face,index); if(offset===null)return toast(`No queda espacio suficiente en la cara ${face}`);
  pushHistory(); ensureLayoutState(); state.layout.window[index]={face,x:offset}; renderAll(); focusFace(face); toast(`Ventana movida a cara ${face}`);
}
function toggleFaceLabels(){ faceLabelsVisible=!faceLabelsVisible; rebuild3D(); const btn=document.getElementById('face-label-toggle'); if(btn)btn.classList.toggle('opacity-50',!faceLabelsVisible); }

const originalAdjustCount=adjustCount;
adjustCount=function(key,delta){
  if(key==='window'&&delta>0){openWindowFacePicker();return;}
  if(key==='window'&&delta<0){
    if((state.counts.window||0)<=0)return; pushHistory(); ensureLayoutState(); state.counts.window--; state.layout.window.splice(state.counts.window,1); selectedEditable=null; renderAll(); return;
  }
  originalAdjustCount(key,delta);
};

function installZoomControls(){
  if(document.getElementById('zoom-controls'))return; const viewer=document.querySelector('.viewer-wrap'); if(!viewer)return;
  const controlsBox=document.createElement('div');controlsBox.id='zoom-controls';controlsBox.className='zoom-control-stack';controlsBox.innerHTML=`<button class="zoom-control-btn" onclick="zoomCamera(1)" title="Acercar diseño" aria-label="Acercar diseño"><i class="fa-solid fa-plus"></i></button><button class="zoom-control-btn" onclick="zoomCamera(-1)" title="Alejar diseño" aria-label="Alejar diseño"><i class="fa-solid fa-minus"></i></button>`;viewer.appendChild(controlsBox);
}
function installFaceUI(){
  if(!document.getElementById('face-ui-style')){
    const style=document.createElement('style');style.id='face-ui-style';style.textContent=`
      .zoom-control-stack{position:absolute;z-index:19;right:16px;top:50%;transform:translateY(-50%);display:grid;gap:8px}.zoom-control-btn{width:44px;height:44px;border-radius:14px;border:1px solid rgba(148,163,184,.28);background:rgba(15,23,42,.86);color:#fff;display:grid;place-items:center;box-shadow:0 10px 28px rgba(2,6,23,.24);backdrop-filter:blur(12px);font-size:15px;transition:.16s ease}.zoom-control-btn:hover{background:#f59e0b;color:#0f172a;border-color:#fbbf24;transform:scale(1.05)}.zoom-control-btn:active{transform:scale(.96)}
      .face-card{border:1px solid #e2e8f0;border-radius:16px;padding:14px;text-align:left;background:white;transition:.16s ease}.face-card:hover{transform:translateY(-2px);border-color:#f59e0b;box-shadow:0 10px 28px rgba(15,23,42,.09)}.face-letter{width:42px;height:42px;border-radius:13px;display:grid;place-items:center;color:#0f172a;font-weight:900;font-size:18px}.face-mini{display:grid;grid-template-columns:42px 1fr;gap:12px;align-items:center}.face-editor-row button{border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.07);border-radius:9px;padding:7px 0;font-size:11px;font-weight:800}.face-editor-row button.active-face{background:#f59e0b;color:#0f172a;border-color:#fbbf24}
      .presentation-mode .zoom-control-stack{right:24px}@media(max-width:820px){.zoom-control-stack{right:10px;top:auto;bottom:78px;transform:none}.zoom-control-btn{width:40px;height:40px;border-radius:12px}.presentation-mode .zoom-control-stack{right:12px;bottom:76px}}
    `;document.head.appendChild(style);
  }
  if(!document.getElementById('window-face-modal')){
    const modal=document.createElement('div');modal.id='window-face-modal';modal.className='fixed inset-0 z-[80] hidden items-center justify-center p-4';modal.style.background='rgba(2,6,23,.72)';modal.style.backdropFilter='blur(6px)';
    modal.innerHTML=`<div class="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden"><div class="p-5 border-b flex items-start justify-between gap-4"><div><div class="text-[10px] font-black uppercase tracking-widest text-amber-600">Ubicación obligatoria</div><h3 class="font-black text-xl mt-1">¿En qué cara se instalará la ventana?</h3><p class="text-sm text-slate-500 mt-1">Selecciona A, B, C o D. La ventana quedará asociada a esa cara.</p></div><button onclick="closeWindowFacePicker()" class="w-9 h-9 rounded-full bg-slate-100"><i class="fa-solid fa-xmark"></i></button></div><div class="p-5 grid sm:grid-cols-2 gap-3">${Object.entries(CONTAINER_FACES).map(([key,f])=>`<button class="face-card" onclick="addWindowToFace('${key}')"><div class="face-mini"><span class="face-letter" style="background:${f.color}">${key}</span><span><strong class="block text-sm">${f.label}</strong><small class="block text-slate-500 mt-1">${f.description}</small></span></div></button>`).join('')}</div><div class="px-5 pb-5 text-xs text-slate-500"><strong>Convención:</strong> A = persona · B = opuesta · C = puertas originales · D = extremo contrario.</div></div>`;
    document.body.appendChild(modal);
  }
  const toolbar=document.querySelector('.viewer-toolbar');
  if(toolbar&&!document.getElementById('face-label-toggle')){
    const btn=document.createElement('button');btn.id='face-label-toggle';btn.className='viewer-pill rounded-xl px-3 py-2 text-xs font-semibold';btn.onclick=toggleFaceLabels;btn.innerHTML='<i class="fa-solid fa-compass mr-1"></i> Caras A-D';toolbar.appendChild(btn);
  }
  const panel=document.getElementById('object-editor');
  if(panel&&!document.getElementById('window-face-editor')){
    const faceEditor=document.createElement('div');faceEditor.id='window-face-editor';faceEditor.className='hidden mt-3 rounded-xl bg-white/5 border border-white/10 p-3';faceEditor.innerHTML=`<div class="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-2">Cara de instalación</div><div class="face-editor-row grid grid-cols-4 gap-1.5">${['A','B','C','D'].map(f=>`<button data-face="${f}" onclick="changeSelectedWindowFace('${f}')">${f}</button>`).join('')}</div>`;
    const deleteBtn=panel.querySelector('button[onclick*="deleteSelectedObject"]'); if(deleteBtn)panel.insertBefore(faceEditor,deleteBtn); else panel.appendChild(faceEditor);
  }
  if(panel&&!document.getElementById('electrical-height-editor')){
    const heightEditor=document.createElement('div');heightEditor.id='electrical-height-editor';heightEditor.className='hidden mt-2 grid grid-cols-2 gap-2';heightEditor.innerHTML=`<button onclick="nudgeSelected(0,0,.05)" class="rounded-lg bg-white/10 py-2 text-[11px]"><i class="fa-solid fa-arrow-up mr-1"></i> Subir 5 cm</button><button onclick="nudgeSelected(0,0,-.05)" class="rounded-lg bg-white/10 py-2 text-[11px]"><i class="fa-solid fa-arrow-down mr-1"></i> Bajar 5 cm</button>`; const deleteBtn=panel.querySelector('button[onclick*="deleteSelectedObject"]'); if(deleteBtn)panel.insertBefore(heightEditor,deleteBtn); else panel.appendChild(heightEditor);
  }
}

function installDirectEditor(){
  if(editorInstalled||!renderer?.domElement)return; editorInstalled=true;ensureLayoutState();ensureElectricalStateForEditor();editorRaycaster=new THREE.Raycaster();editorPointer=new THREE.Vector2();
  const canvas=renderer.domElement;canvas.addEventListener('pointerdown',onEditorPointerDown);canvas.addEventListener('pointermove',onEditorPointerMove);canvas.addEventListener('pointerup',onEditorPointerUp);canvas.addEventListener('pointercancel',onEditorPointerUp);
  window.addEventListener('keydown',event=>{
    if(!selectedEditable||['INPUT','TEXTAREA'].includes(document.activeElement?.tagName))return;const step=event.shiftKey?.2:.05;
    if(event.key==='Delete'||event.key==='Backspace'){event.preventDefault();deleteSelectedObject();}
    else if(event.key==='ArrowLeft'){event.preventDefault();nudgeSelected(-step,0,0);}
    else if(event.key==='ArrowRight'){event.preventDefault();nudgeSelected(step,0,0);}
    else if(event.key==='ArrowUp'&&selectedEditable.type==='electrical'){event.preventDefault();const point=ensureElectricalStateForEditor().points[selectedEditable.index];if(point?.type==='light')nudgeSelected(0,-step,0);else nudgeSelected(0,0,step);}
    else if(event.key==='ArrowDown'&&selectedEditable.type==='electrical'){event.preventDefault();const point=ensureElectricalStateForEditor().points[selectedEditable.index];if(point?.type==='light')nudgeSelected(0,step,0);else nudgeSelected(0,0,-step);}
    else if(event.key==='ArrowUp'&&['wc','sink','shower'].includes(selectedEditable.type)){event.preventDefault();nudgeSelected(0,-step,0);}
    else if(event.key==='ArrowDown'&&['wc','sink','shower'].includes(selectedEditable.type)){event.preventDefault();nudgeSelected(0,step,0);}
  });
  installZoomControls();installFaceUI();rebuild3D();
}

window.addEventListener('DOMContentLoaded',()=>setTimeout(installDirectEditor,0));
