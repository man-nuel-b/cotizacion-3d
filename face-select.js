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

// A-F sprites remain interactive; this accessible A-D menu is a reliable fallback
// for touch screens, small labels, camera occlusion and keyboard users.
function ensureDirectFaceChoices(){
  let panel=document.getElementById('bat-direct-face-choices');
  if(panel)return panel;
  const host=document.querySelector('.viewer-wrap')||document.getElementById('canvas-container')?.parentElement;
  if(!host)return null;
  if(!document.getElementById('bat-direct-face-choices-style')){
    const style=document.createElement('style');
    style.id='bat-direct-face-choices-style';
    style.textContent=[
      '#bat-direct-face-choices{position:absolute;top:82px;left:14px;right:14px;max-width:390px;z-index:85;padding:14px;border:2px solid #fbbf24;border-radius:16px;color:#fff;background:rgba(15,23,42,.96);box-shadow:0 18px 42px rgba(0,0,0,.38);font-family:Inter,system-ui,sans-serif;pointer-events:auto}',
      '#bat-direct-face-choices[hidden]{display:none!important}',
      '#bat-direct-face-choices .bat-face-buttons{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:12px 0}',
      '#bat-direct-face-choices button[data-face-choice]{min-height:48px;border:1px solid #fbbf24;border-radius:10px;background:#f59e0b;color:#111827;font-size:14px;font-weight:800;cursor:pointer;touch-action:manipulation}',
      '#bat-direct-face-choices button[data-face-choice]:focus-visible,#bat-direct-face-choices button[data-cancel-face]:focus-visible{outline:3px solid #fff;outline-offset:2px}',
      '#bat-direct-face-choices button[data-face-choice]:hover{background:#fbbf24}',
      '#bat-direct-face-choices button[data-cancel-face]{background:transparent;border:1px solid #64748b;border-radius:8px;padding:6px 10px;color:#e2e8f0;font-size:12px;cursor:pointer}',
      '#bat-direct-face-error:not(:empty){margin-top:8px;color:#fecaca;font-size:12px;line-height:1.4}',
      '@media(max-width:820px){#bat-direct-face-choices{top:72px;left:8px;right:8px;max-width:none;padding:12px}}'
    ].join('');
    document.head.appendChild(style);
  }
  panel=document.createElement('section');
  panel.id='bat-direct-face-choices';panel.hidden=true;
  panel.setAttribute('role','group');panel.setAttribute('aria-label','Elegir cara para instalar un componente');
  panel.innerHTML='<div style="display:flex;align-items:center;justify-content:space-between;gap:8px"><strong id="bat-face-choice-title" style="font-size:14px">Selecciona una cara</strong><button type="button" data-cancel-face>Cancelar</button></div>'+
    '<p style="font-size:12px;color:#cbd5e1;margin-top:5px">Elige la cara del módulo para instalar el elemento. También puedes pulsar una letra en el modelo 3D.</p>'+
    '<div class="bat-face-buttons"><button type="button" data-face-choice="A">Cara A</button><button type="button" data-face-choice="B">Cara B</button><button type="button" data-face-choice="C">Cara C</button><button type="button" data-face-choice="D">Cara D</button></div>'+
    '<p id="bat-direct-face-error" role="status" aria-live="polite"></p>';
  panel.addEventListener('pointerdown',event=>event.stopPropagation());
  panel.addEventListener('click',event=>{
    const face=event.target.closest('button[data-face-choice]')?.dataset.faceChoice;
    if(face){event.stopPropagation();addMountedToFace(face);return;}
    if(event.target.closest('button[data-cancel-face]')){
      event.stopPropagation();closeMountedFacePicker();toast('Selección de cara cancelada');
    }
  });
  host.appendChild(panel);
  return panel;
}
function syncDirectFaceChoices(){
  const panel=ensureDirectFaceChoices();
  if(!panel)return;
  const visible=Boolean(faceSelectionActive&&pendingMountedType);
  panel.hidden=!visible;
  if(!visible)return;
  const title=panel.querySelector('#bat-face-choice-title');
  if(title)title.textContent='¿En qué cara irá '+typeLabel(pendingMountedType).toLowerCase()+'?';
  const feedback=panel.querySelector('#bat-direct-face-error');
  if(feedback)feedback.textContent='';
}
function directFaceChoiceError(message){
  const feedback=document.getElementById('bat-direct-face-error');
  if(feedback)feedback.textContent=message;
}

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
  syncDirectFaceChoices();
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
  syncDirectFaceChoices();
  rebuild3D();
};

addMountedToFace=function(face){
  const type=pendingMountedType;
  if(!type||!isMountedFaceType(type)||!['A','B','C','D'].includes(face)) return;
  const max=DATA.extras[type].max;
  if((state.counts[type]||0)>=max){
    pendingMountedType=null;
    faceSelectionActive=false;
    syncDirectFaceChoices();
    rebuild3D();
    return toast(`Llegaste al máximo de ${typeLabel(type).toLowerCase()}`);
  }

  const offset=findAvailableMountedOffset(type,face);
  if(offset===null){
    directFaceChoiceError(`No queda espacio suficiente en la cara ${face}. Prueba otra cara o mueve los elementos existentes.`);
    return toast(`No queda espacio suficiente en la cara ${face}`);
  }

  pushHistory();
  ensureLayoutState();
  const index=state.counts[type]||0;
  state.counts[type]=index+1;
  state.layout[type][index]={face,x:offset};
  pendingMountedType=null;
  faceSelectionActive=false;
  syncDirectFaceChoices();
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
  ensureDirectFaceChoices();
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
