// Direct face selection for bat-kubiqueitor.
// Compact A/B/C/D wall markers plus E=ceiling and F=floor markers.

// Extend the face convention without changing wall-mounted element behavior.
CONTAINER_FACES.E={label:'Cara E',description:'Techo del contenedor',color:'#f43f5e'};
CONTAINER_FACES.F={label:'Cara F',description:'Piso del contenedor',color:'#14b8a6'};

let faceTagObjects=[];
let faceSelectionActive=false;
let faceSelectionRaycaster=null;
let faceSelectionPointer=null;

function createFaceLetterSprite(face,active=false){
  const canvas=document.createElement('canvas');
  canvas.width=256;
  canvas.height=256;
  const ctx=canvas.getContext('2d');
  const color=CONTAINER_FACES[face]?.color||'#f59e0b';

  ctx.clearRect(0,0,256,256);
  ctx.beginPath();
  ctx.arc(128,128,active?92:78,0,Math.PI*2);
  ctx.fillStyle=active?'rgba(15,23,42,.96)':'rgba(15,23,42,.86)';
  ctx.fill();
  ctx.lineWidth=active?16:11;
  ctx.strokeStyle=color;
  ctx.stroke();

  ctx.fillStyle='#ffffff';
  ctx.font=`900 ${active?118:104}px Inter, Arial`;
  ctx.textAlign='center';
  ctx.textBaseline='middle';
  ctx.fillText(face,128,134);

  const texture=new THREE.CanvasTexture(canvas);
  if('encoding' in texture) texture.encoding=THREE.sRGBEncoding;
  texture.needsUpdate=true;

  const material=new THREE.SpriteMaterial({
    map:texture,
    transparent:true,
    depthTest:true,
    depthWrite:false,
    opacity:active?1:.92
  });
  const sprite=new THREE.Sprite(material);
  const scale=active?.78:.56;
  sprite.scale.set(scale,scale,1);
  sprite.renderOrder=700;
  sprite.userData.containerFace=face;
  sprite.userData.faceTag=true;
  sprite.userData.faceSelectable=active;
  return sprite;
}

function placeFaceLetter(sprite,face,c){
  const y=Math.min(c.height*.83,c.height-.32);
  const offset=.18;
  if(face==='A') sprite.position.set(0,y,c.width/2+offset);
  else if(face==='B') sprite.position.set(0,y,-c.width/2-offset);
  else if(face==='C') sprite.position.set(c.length/2+offset,y,0);
  else if(face==='D') sprite.position.set(-c.length/2-offset,y,0);
  else if(face==='E') sprite.position.set(0,c.height+offset,0);
  else sprite.position.set(0,.16,0); // F = piso, visible desde interior/planta.
}

// A-F are always visible. Only A-D are selectable for wall-mounted elements.
addFaceLabels=function(parent,c){
  faceTagObjects=[];
  ['A','B','C','D','E','F'].forEach(face=>{
    const selectable=faceSelectionActive&&['A','B','C','D'].includes(face);
    const sprite=createFaceLetterSprite(face,selectable);
    placeFaceLetter(sprite,face,c);
    parent.add(sprite);
    if(['A','B','C','D'].includes(face)) faceTagObjects.push(sprite);
  });
};

function removeFacePickerModals(){
  document.getElementById('mounted-face-modal')?.remove();
  document.getElementById('window-face-modal')?.remove();
}

function removeOrientationToolbarButton(){
  document.getElementById('face-label-toggle')?.remove();
}

function removeObjectMovementButtons(){
  const panel=document.getElementById('object-editor');
  if(!panel) return;

  const buttons=[...panel.querySelectorAll('button')];
  const removable=new Set();

  buttons.forEach(btn=>{
    const action=btn.getAttribute('onclick')||'';
    if(action.includes('nudgeSelected(')||action.includes('resetSelectedPosition()')){
      const row=btn.parentElement;
      if(row&&row!==panel) removable.add(row);
      else btn.remove();
    }
  });

  removable.forEach(row=>row.remove());
}

const installFaceUIBeforeDirectLabels=installFaceUI;
installFaceUI=function(){
  installFaceUIBeforeDirectLabels();
  removeFacePickerModals();
  removeOrientationToolbarButton();
  removeObjectMovementButtons();
};

// Kept only for compatibility with older calls. Face markers stay visible.
toggleFaceLabels=function(){
  faceLabelsVisible=true;
  removeOrientationToolbarButton();
  rebuild3D();
};

function beginDirectFaceSelection(type){
  pendingMountedType=type;
  faceSelectionActive=true;
  faceLabelsVisible=true;
  removeFacePickerModals();
  removeOrientationToolbarButton();
  removeObjectMovementButtons();

  if(typeof interactionMode!=='undefined'&&interactionMode==='explore'&&typeof setInteractionMode==='function'){
    setInteractionMode('edit');
  }

  if(state.cutaway){
    state.cutaway=false;
    currentView='exterior';
  }
  rebuild3D();
  toast(`Selecciona A, B, C o D en el modelo para ubicar ${typeLabel(type).toLowerCase()}`);
}

openMountedFacePicker=function(type){
  if(!isMountedFaceType(type)) return;
  beginDirectFaceSelection(type);
};

closeMountedFacePicker=function(){
  pendingMountedType=null;
  faceSelectionActive=false;
  removeFacePickerModals();
  removeOrientationToolbarButton();
  removeObjectMovementButtons();
  rebuild3D();
};

addMountedToFace=function(face){
  const type=pendingMountedType;
  if(!type||!isMountedFaceType(type)||!['A','B','C','D'].includes(face)) return;
  const max=DATA.extras[type].max;
  if((state.counts[type]||0)>=max){
    pendingMountedType=null;
    faceSelectionActive=false;
    rebuild3D();
    return toast(`Llegaste al máximo de ${typeLabel(type).toLowerCase()}`);
  }

  const offset=findAvailableMountedOffset(type,face);
  if(offset===null) return toast(`No queda espacio suficiente en la cara ${face}`);

  pushHistory();
  ensureLayoutState();
  const index=state.counts[type]||0;
  state.counts[type]=index+1;
  state.layout[type][index]={face,x:offset};
  pendingMountedType=null;
  faceSelectionActive=false;
  renderAll();
  focusFace(face);
  toast(`${typeLabel(type)} agregado en cara ${face}`);
};

function hitFaceTag(event){
  if(!renderer?.domElement||!camera||!faceTagObjects.length) return null;
  const rect=renderer.domElement.getBoundingClientRect();
  faceSelectionPointer.x=((event.clientX-rect.left)/rect.width)*2-1;
  faceSelectionPointer.y=-((event.clientY-rect.top)/rect.height)*2+1;
  faceSelectionRaycaster.setFromCamera(faceSelectionPointer,camera);
  const hits=faceSelectionRaycaster.intersectObjects(faceTagObjects,false);
  return hits.find(hit=>hit.object?.userData?.faceSelectable)?.object||null;
}

function onDirectFacePointerDown(event){
  if(!faceSelectionActive||!pendingMountedType) return;
  const tag=hitFaceTag(event);
  if(!tag) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation?.();
  addMountedToFace(tag.userData.containerFace);
}

function onDirectFacePointerMove(event){
  const canvas=renderer?.domElement;
  if(!canvas||!faceSelectionActive) return;
  const tag=hitFaceTag(event);
  canvas.style.cursor=tag?'pointer':'grab';
}

let directFaceSelectionInstalled=false;
function installDirectFaceSelection(){
  if(directFaceSelectionInstalled) return;
  directFaceSelectionInstalled=true;

  faceSelectionRaycaster=new THREE.Raycaster();
  faceSelectionPointer=new THREE.Vector2();
  installFaceUI();
  removeFacePickerModals();
  removeOrientationToolbarButton();
  removeObjectMovementButtons();

  const canvas=renderer?.domElement;
  if(canvas){
    canvas.addEventListener('pointerdown',onDirectFacePointerDown,true);
    canvas.addEventListener('pointermove',onDirectFacePointerMove,true);
  }

  window.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&faceSelectionActive){
      event.preventDefault();
      closeMountedFacePicker();
      toast('Selección de cara cancelada');
    }
  });

  rebuild3D();
}

if(document.readyState==='loading'){
  window.addEventListener('DOMContentLoaded',()=>setTimeout(installDirectFaceSelection,80));
}else{
  setTimeout(installDirectFaceSelection,80);
}
