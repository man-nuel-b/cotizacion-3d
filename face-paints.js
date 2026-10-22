// Visual orientation and interaction modes for bat-kubiqueitor.
// A/B/C/D remain available internally, while customer-facing guidance stays simple.

function createPaintedFace(face,c){
  const group=new THREE.Group();
  const color=new THREE.Color(CONTAINER_FACES[face].color);
  const isLong=face==='A'||face==='B';
  const width=(isLong?c.length:c.width)*.965;
  const height=c.height*.82;

  const fillMaterial=new THREE.MeshBasicMaterial({
    color,
    transparent:true,
    opacity:.16,
    side:THREE.DoubleSide,
    depthWrite:false,
    polygonOffset:true,
    polygonOffsetFactor:-2,
    polygonOffsetUnits:-2
  });

  const geometry=new THREE.PlaneGeometry(width,height);
  const fill=new THREE.Mesh(geometry,fillMaterial);
  fill.renderOrder=105;
  fill.userData.facePaint=true;
  fill.userData.containerFace=face;

  const edges=new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry),
    new THREE.LineBasicMaterial({
      color,
      transparent:true,
      opacity:.56,
      depthTest:true
    })
  );
  edges.renderOrder=106;
  edges.userData.facePaint=true;
  edges.userData.containerFace=face;

  group.add(fill,edges);
  group.userData.facePaint=true;
  group.userData.containerFace=face;

  const y=c.height*.51;
  const offset=.088;
  if(face==='A'){
    group.position.set(0,y,c.width/2+offset);
    group.rotation.y=Math.PI;
  }else if(face==='B'){
    group.position.set(0,y,-c.width/2-offset);
  }else if(face==='C'){
    group.position.set(c.length/2+offset,y,0);
    group.rotation.y=-Math.PI/2;
  }else{
    group.position.set(-c.length/2-offset,y,0);
    group.rotation.y=Math.PI/2;
  }

  return group;
}

// Keep the legacy function name used by editor.js and faces-mounted.js,
// but render only subtle painted surfaces instead of floating labels.
addFaceLabels=function(parent,c){
  if(!faceLabelsVisible) return;
  ['A','B','C','D'].forEach(face=>parent.add(createPaintedFace(face,c)));
};

toggleFaceLabels=function(){
  faceLabelsVisible=!faceLabelsVisible;
  rebuild3D();
  const btn=document.getElementById('face-label-toggle');
  if(btn){
    btn.classList.toggle('opacity-50',!faceLabelsVisible);
    btn.innerHTML='<i class="fa-solid fa-compass mr-1"></i> Orientación';
    btn.title=faceLabelsVisible?'Ocultar guía visual':'Mostrar guía visual';
  }
};

function refreshOrientationButton(){
  const btn=document.getElementById('face-label-toggle');
  if(!btn) return;
  btn.innerHTML='<i class="fa-solid fa-compass mr-1"></i> Orientación';
  btn.title='Mostrar u ocultar una guía visual de orientación';
}

function simplifyOrientationCopy(){
  document.querySelectorAll('span').forEach(el=>{
    const text=(el.textContent||'').trim();
    if(text==='V5 · Caras A-D') el.textContent='Editor 3D';
    if(text==='Diseña, ubica por cara y cotiza en una sola conversación') el.textContent='Diseña y cotiza en una sola conversación';
  });

  document.querySelectorAll('p').forEach(el=>{
    const text=(el.textContent||'').replace(/\s+/g,' ').trim();
    if(text.includes('Los elementos de muro te pedirán la cara A, B, C o D')){
      el.textContent='Agrega ventanas, puertas, climatización y equipamiento al diseño.';
    }
  });

  // Remove the visible legend explaining what A/B/C/D mean.
  document.querySelectorAll('.bg-amber-50').forEach(el=>{
    const text=(el.textContent||'').replace(/\s+/g,' ').trim();
    if(text.includes('A = persona')&&text.includes('C = puertas originales')) el.remove();
  });

  const help=document.querySelector('.viewer-help .text-slate-400');
  if(help&&help.textContent.includes('Caras A-D')){
    help.textContent='Arrastra el fondo para girar · usa + / − para acercar y alejar.';
  }

  document.querySelectorAll('.summary-panel .bg-emerald-50').forEach(el=>{
    const text=(el.textContent||'').replace(/\s+/g,' ').trim();
    if(text.includes('Ubicación por cara')) el.remove();
  });

  // Keep A/B/C/D as the actual selector, but remove the teaching paragraph beneath it.
  document.querySelectorAll('#window-face-modal div, #mounted-face-modal div').forEach(el=>{
    const text=(el.textContent||'').replace(/\s+/g,' ').trim();
    if(el.children.length===0&&text.startsWith('Convención:')&&text.includes('puertas originales')) el.remove();
  });
}

// ----------------------
// Explore / Edit modes
// ----------------------
let interactionMode='edit';

function editorCanvas(){
  return renderer?.domElement||document.querySelector('#canvas-container canvas');
}

function detachEditorPointerEvents(){
  const canvas=editorCanvas();
  if(!canvas) return;
  canvas.removeEventListener('pointerdown',onEditorPointerDown);
  canvas.removeEventListener('pointermove',onEditorPointerMove);
  canvas.removeEventListener('pointerup',onEditorPointerUp);
  canvas.removeEventListener('pointercancel',onEditorPointerUp);
}

function attachEditorPointerEvents(){
  const canvas=editorCanvas();
  if(!canvas) return;
  // Remove first so repeated mode changes can never duplicate handlers.
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

  if(exploreBtn){
    exploreBtn.classList.toggle('interaction-active',exploring);
    exploreBtn.setAttribute('aria-pressed',String(exploring));
  }
  if(editBtn){
    editBtn.classList.toggle('interaction-active',!exploring);
    editBtn.setAttribute('aria-pressed',String(!exploring));
  }
  if(badge){
    badge.innerHTML=exploring
      ? '<i class="fa-solid fa-eye text-sky-400"></i> Explorando'
      : '<i class="fa-solid fa-pen-ruler text-amber-400"></i> Edición activa';
  }

  const canvas=editorCanvas();
  if(canvas) canvas.style.cursor=exploring?'grab':'';
}

function setInteractionMode(mode){
  if(mode!=='explore'&&mode!=='edit') return;
  interactionMode=mode;

  if(mode==='explore'){
    detachEditorPointerEvents();
    draggingEditable=null;
    dragPlane=null;
    dragStartState=null;
    dragMoved=false;
    if(controls) controls.enabled=true;
    if(typeof selectEditable==='function') selectEditable(null);
    else if(typeof hideEditorPanel==='function') hideEditorPanel();
    toast('Modo Explorar: objetos bloqueados');
  }else{
    attachEditorPointerEvents();
    if(controls) controls.enabled=true;
    toast('Edición reanudada');
  }

  updateInteractionModeUI();
}

function installInteractionModeControls(){
  const toolbar=document.querySelector('.viewer-toolbar');
  if(!toolbar||document.getElementById('interaction-mode-controls')) return;

  const group=document.createElement('div');
  group.id='interaction-mode-controls';
  group.className='interaction-mode-controls';
  group.innerHTML=`
    <button id="explore-mode-btn" type="button" class="interaction-mode-btn" onclick="setInteractionMode('explore')" title="Bloquea objetos y permite recorrer el diseño" aria-pressed="false">
      <i class="fa-solid fa-eye mr-1"></i> Explorar
    </button>
    <button id="edit-mode-btn" type="button" class="interaction-mode-btn interaction-active" onclick="setInteractionMode('edit')" title="Permite volver a seleccionar y mover objetos" aria-pressed="true">
      <i class="fa-solid fa-pen-ruler mr-1"></i> Reanudar edición
    </button>`;

  const presentationBtn=toolbar.querySelector('.presentation-trigger');
  if(presentationBtn) toolbar.insertBefore(group,presentationBtn);
  else toolbar.appendChild(group);

  if(!document.getElementById('interaction-mode-style')){
    const style=document.createElement('style');
    style.id='interaction-mode-style';
    style.textContent=`
      .interaction-mode-controls{display:inline-flex;gap:3px;padding:3px;border-radius:13px;background:rgba(15,23,42,.78);border:1px solid rgba(148,163,184,.28);backdrop-filter:blur(12px);box-shadow:0 8px 24px rgba(2,6,23,.18)}
      .interaction-mode-btn{border:0;border-radius:9px;padding:6px 9px;color:#cbd5e1;background:transparent;font-size:11px;font-weight:750;white-space:nowrap;transition:.15s ease}
      .interaction-mode-btn:hover{color:white;background:rgba(255,255,255,.08)}
      .interaction-mode-btn.interaction-active{background:#f59e0b;color:#0f172a;box-shadow:0 3px 10px rgba(245,158,11,.18)}
      @media(max-width:820px){.interaction-mode-btn{padding:6px 8px;font-size:10px}.interaction-mode-controls{order:20}}
    `;
    document.head.appendChild(style);
  }
  updateInteractionModeUI();
}

window.addEventListener('DOMContentLoaded',()=>{
  setTimeout(()=>{
    simplifyOrientationCopy();
    refreshOrientationButton();
    installInteractionModeControls();
    if(typeof rebuild3D==='function') rebuild3D();
  },40);
});
