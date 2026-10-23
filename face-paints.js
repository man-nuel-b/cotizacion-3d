// Customer-facing orientation cleanup + Explore/Edit controls for bat-kubiqueitor.
// The actual A/B/C/D markers and direct selection live in face-select.js.

const APP_ASSET_VERSION='20261023-38';
function versionedAsset(name){ return `${name}?v=${APP_ASSET_VERSION}`; }

function simplifyOrientationCopy(){
  document.querySelectorAll('span').forEach(el=>{
    const text=(el.textContent||'').trim();
    if(text==='V5 · Caras A-D') el.textContent='Editor 3D';
    if(text==='Diseña, ubica por cara y cotiza en una sola conversación') el.textContent='Diseña y cotiza en una sola conversación';
  });
  document.querySelectorAll('p').forEach(el=>{
    const text=(el.textContent||'').replace(/\s+/g,' ').trim();
    if(text.includes('Los elementos de muro te pedirán la cara A, B, C o D')) el.textContent='Agrega ventanas, puertas, climatización y equipamiento al diseño.';
  });
  document.querySelectorAll('.bg-amber-50').forEach(el=>{
    const text=(el.textContent||'').replace(/\s+/g,' ').trim();
    if(text.includes('A = persona')&&text.includes('C = puertas originales')) el.remove();
  });
  const help=document.querySelector('.viewer-help .text-slate-400');
  if(help) help.textContent='Arrastra el fondo para girar · usa + / − para acercar y alejar.';
  document.querySelectorAll('.summary-panel .bg-emerald-50').forEach(el=>{
    const text=(el.textContent||'').replace(/\s+/g,' ').trim();
    if(text.includes('Ubicación por cara')) el.remove();
  });
  document.getElementById('mounted-face-modal')?.remove();
  document.getElementById('window-face-modal')?.remove();
}

let interactionMode='edit';
function editorCanvas(){ return renderer?.domElement||document.querySelector('#canvas-container canvas'); }
function detachEditorPointerEvents(){
  const canvas=editorCanvas(); if(!canvas) return;
  canvas.removeEventListener('pointerdown',onEditorPointerDown);
  canvas.removeEventListener('pointermove',onEditorPointerMove);
  canvas.removeEventListener('pointerup',onEditorPointerUp);
  canvas.removeEventListener('pointercancel',onEditorPointerUp);
}
function attachEditorPointerEvents(){
  const canvas=editorCanvas(); if(!canvas) return;
  detachEditorPointerEvents();
  canvas.addEventListener('pointerdown',onEditorPointerDown);
  canvas.addEventListener('pointermove',onEditorPointerMove);
  canvas.addEventListener('pointerup',onEditorPointerUp);
  canvas.addEventListener('pointercancel',onEditorPointerUp);
}
function updateInteractionModeUI(){
  const exploreBtn=document.getElementById('explore-mode-btn');
  const editBtn=document.getElementById('edit-mode-btn');
  const badge=document.querySelector('.scene-badge span:first-child');
  const exploring=interactionMode==='explore';
  exploreBtn?.classList.toggle('interaction-active',exploring);
  editBtn?.classList.toggle('interaction-active',!exploring);
  exploreBtn?.setAttribute('aria-pressed',String(exploring));
  editBtn?.setAttribute('aria-pressed',String(!exploring));
  if(badge) badge.innerHTML=exploring?'<i class="fa-solid fa-eye text-sky-400"></i> Explorando':'<i class="fa-solid fa-pen-ruler text-amber-400"></i> Edición activa';
  const canvas=editorCanvas(); if(canvas) canvas.style.cursor=exploring?'grab':'';
}
function setInteractionMode(mode){
  if(mode!=='explore'&&mode!=='edit') return;
  interactionMode=mode;
  if(mode==='explore'){
    detachEditorPointerEvents(); draggingEditable=null; dragPlane=null; dragStartState=null; dragMoved=false;
    if(controls) controls.enabled=true;
    if(typeof selectEditable==='function') selectEditable(null); else hideEditorPanel?.();
    toast('Modo Explorar: objetos bloqueados');
  }else{
    attachEditorPointerEvents(); if(controls) controls.enabled=true; toast('Edición reanudada');
  }
  updateInteractionModeUI();
}
function installInteractionModeControls(){
  const toolbar=document.querySelector('.viewer-toolbar');
  if(!toolbar||document.getElementById('interaction-mode-controls')) return;
  const group=document.createElement('div');
  group.id='interaction-mode-controls'; group.className='interaction-mode-controls';
  group.innerHTML=`<button id="explore-mode-btn" type="button" class="interaction-mode-btn" onclick="setInteractionMode('explore')" aria-pressed="false" title="Bloquea los objetos para recorrer el diseño"><i class="fa-solid fa-eye mr-1"></i> Explorar</button><button id="edit-mode-btn" type="button" class="interaction-mode-btn interaction-active" onclick="setInteractionMode('edit')" aria-pressed="true" title="Vuelve a permitir seleccionar y mover objetos"><i class="fa-solid fa-pen-ruler mr-1"></i> Reanudar edición</button>`;
  const presentationBtn=toolbar.querySelector('.presentation-trigger');
  if(presentationBtn) toolbar.insertBefore(group,presentationBtn); else toolbar.appendChild(group);
  if(!document.getElementById('interaction-mode-style')){
    const style=document.createElement('style'); style.id='interaction-mode-style';
    style.textContent=`.interaction-mode-controls{display:inline-flex;gap:3px;padding:3px;border-radius:13px;background:rgba(15,23,42,.78);border:1px solid rgba(148,163,184,.28);backdrop-filter:blur(12px);box-shadow:0 8px 24px rgba(2,6,23,.18)}.interaction-mode-btn{border:0;border-radius:9px;padding:6px 9px;color:#cbd5e1;background:transparent;font-size:11px;font-weight:750;white-space:nowrap;transition:.15s ease}.interaction-mode-btn:hover{color:white;background:rgba(255,255,255,.08)}.interaction-mode-btn.interaction-active{background:#f59e0b;color:#0f172a;box-shadow:0 3px 10px rgba(245,158,11,.18)}@media(max-width:820px){.interaction-mode-btn{padding:6px 8px;font-size:10px}.interaction-mode-controls{order:20}}`;
    document.head.appendChild(style);
  }
  updateInteractionModeUI();
}
function loadPartitionBoundsFixLayer(){
  if(document.querySelector('script[data-partition-bounds-fix]')) return;
  const script=document.createElement('script'); script.src=versionedAsset('partition-bounds-fix.js'); script.dataset.partitionBoundsFix='true'; document.body.appendChild(script);
}
function loadPartitionJointsLayer(){
  if(document.querySelector('script[data-partition-joints]')){ setTimeout(loadPartitionBoundsFixLayer,20); return; }
  const script=document.createElement('script'); script.src=versionedAsset('partition-joints.js'); script.dataset.partitionJoints='true'; script.addEventListener('load',()=>setTimeout(loadPartitionBoundsFixLayer,20),{once:true}); document.body.appendChild(script);
}
function loadPartitionLayer(){
  if(document.querySelector('script[data-partition-layout]')){ setTimeout(loadPartitionJointsLayer,20); return; }
  const script=document.createElement('script'); script.src=versionedAsset('partition-layout.js'); script.dataset.partitionLayout='true'; script.addEventListener('load',()=>setTimeout(loadPartitionJointsLayer,20),{once:true}); document.body.appendChild(script);
}
function loadFurnitureLayer(){
  if(document.querySelector('script[data-furniture-toggle]')){ setTimeout(loadPartitionLayer,20); return; }
  const script=document.createElement('script'); script.src=versionedAsset('furniture-toggle.js'); script.dataset.furnitureToggle='true'; script.addEventListener('load',()=>setTimeout(loadPartitionLayer,20),{once:true}); document.body.appendChild(script);
}
function loadDimensionPanelLayer(){
  if(document.querySelector('script[data-dimension-panel]')){ setTimeout(loadFurnitureLayer,20); return; }
  const script=document.createElement('script'); script.src=versionedAsset('dimension-panel.js'); script.dataset.dimensionPanel='true'; script.addEventListener('load',()=>setTimeout(loadFurnitureLayer,20),{once:true}); document.body.appendChild(script);
}
function loadDimensionsLayer(){
  if(document.querySelector('script[data-dimensions]')){ setTimeout(loadDimensionPanelLayer,20); return; }
  const script=document.createElement('script'); script.src=versionedAsset('dimensions.js'); script.dataset.dimensions='true'; script.addEventListener('load',()=>setTimeout(loadDimensionPanelLayer,20),{once:true}); document.body.appendChild(script);
}
function bootOrientationUI(){
  simplifyOrientationCopy(); installInteractionModeControls();
  if(!document.querySelector('script[data-face-select]')){
    const script=document.createElement('script'); script.src=versionedAsset('face-select.js'); script.dataset.faceSelect='true'; script.addEventListener('load',()=>setTimeout(loadDimensionsLayer,20),{once:true}); document.body.appendChild(script);
  }else setTimeout(loadDimensionsLayer,20);
}
if(document.readyState==='loading') window.addEventListener('DOMContentLoaded',()=>setTimeout(bootOrientationUI,40)); else setTimeout(bootOrientationUI,40);
