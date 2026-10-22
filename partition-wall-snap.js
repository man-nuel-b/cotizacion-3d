// Interior partition anchoring.
// The selected face is the START of the partition and the partition grows PERPENDICULARLY into the container.
// Face convention: A/B = long side walls, C/D = end walls.

function partitionAnchorConfig(face){
  if(face==='A') return {orientation:PARTITION_ORIENTATION.CROSS,side:'far'};
  if(face==='B') return {orientation:PARTITION_ORIENTATION.CROSS,side:'near'};
  if(face==='C') return {orientation:PARTITION_ORIENTATION.LONG,side:'far'};
  return {orientation:PARTITION_ORIENTATION.LONG,side:'near'}; // D
}

function partitionAnchorBounds(orientation){
  return partitionInteriorBounds(orientation);
}

function partitionAxisCenter(index){
  const p=actualLayout('partition',index);
  const b=partitionAnchorBounds(p.orientation);
  const stored=state.layout?.partition?.[index]?.axisCenter;
  return Number.isFinite(stored)?stored:(b.min+b.max)/2;
}

function anchoredAxisCenter(face,length){
  const config=partitionAnchorConfig(face);
  const b=partitionAnchorBounds(config.orientation);
  const safeLength=clamp(Number(length)||.30,.30,b.max-b.min);
  return config.side==='near'?b.min+safeLength/2:b.max-safeLength/2;
}

function currentPartitionAnchor(index){
  const face=state.layout?.partition?.[index]?.anchorFace;
  return ['A','B','C','D'].includes(face)?face:null;
}

function perpendicularPositionBounds(orientation,thickness=.075){
  const c=DATA.containers[state.container];
  const halfT=(thickness||.075)/2;
  if(orientation===PARTITION_ORIENTATION.LONG){
    return {min:-c.width/2+.060+halfT,max:c.width/2-.040-halfT,from:'B',to:'A'};
  }
  return {min:-c.length/2+.055+halfT,max:c.length/2-.055-halfT,from:'D',to:'C'};
}

function setPerpendicularPosition(index,value){
  ensureLayoutState();
  const p=actualLayout('partition',index),d=objectDimensions('partition',index);
  const b=perpendicularPositionBounds(p.orientation,d.thickness);
  const coord=clamp(Number(value)||0,b.min,b.max);
  if(p.orientation===PARTITION_ORIENTATION.LONG){
    state.layout.partition[index]={...state.layout.partition[index],x:0,z:coord};
  }else{
    state.layout.partition[index]={...state.layout.partition[index],x:coord,z:0};
  }
  return coord;
}

function perpendicularPosition(index){
  const p=actualLayout('partition',index);
  return p.orientation===PARTITION_ORIENTATION.LONG?p.z:p.x;
}

function anchorPartitionToFace(face,{history=true,notify=true}={}){
  if(!selectedEditable||selectedEditable.type!=='partition'||!['A','B','C','D'].includes(face)) return;
  const index=selectedEditable.index;
  const before=actualLayout('partition',index);
  const dims=objectDimensions('partition',index);
  const config=partitionAnchorConfig(face);
  const c=DATA.containers[state.container];

  if(history) pushHistory();
  ensureLayoutState();
  ensureDimensionState();

  // Preserve vertical dimensions and thickness. Length is only clamped if the new axis is shorter.
  const maxLength=partitionFullLength(config.orientation);
  const nextLength=clamp(dims.length,.30,maxLength);
  state.dimensions.partition[index]={
    ...state.dimensions.partition[index],
    ...dims,
    length:nextLength,
    height:clamp(dims.height,.30,Math.max(.30,c.height-.06-(dims.elevation||0))),
    thickness:dims.thickness||.075,
    elevation:dims.elevation||0
  };

  // Preserve approximately the same location along the selected wall when possible.
  const previousPerp=before.orientation===PARTITION_ORIENTATION.LONG?before.z:before.x;
  state.layout.partition[index]={
    ...state.layout.partition[index],
    orientation:config.orientation,
    x:0,
    z:0,
    axisCenter:anchoredAxisCenter(face,nextLength),
    anchorFace:face,
    joints:[]
  };
  setPerpendicularPosition(index,previousPerp);

  if(typeof normalizePartitionInsideContainer==='function') normalizePartitionInsideContainer(index);
  renderAll();
  if(notify) toast(`Tabique iniciado perpendicularmente desde pared ${face}`);
}

// Backward-compatible function name used by the four UI buttons.
function snapPartitionToFace(face){
  return anchorPartitionToFace(face);
}

// Keep the anchored end fixed when Largo changes.
const updatePartitionDimensionBeforeWallAnchor=updatePartitionDimension;
updatePartitionDimension=function(key,value){
  const index=selectedEditable?.type==='partition'?selectedEditable.index:null;
  const anchor=index!==null?currentPartitionAnchor(index):null;
  updatePartitionDimensionBeforeWallAnchor(key,value);
  if(index===null||!anchor) return;

  ensureLayoutState();
  if(key==='length'){
    const d=objectDimensions('partition',index);
    state.layout.partition[index]={
      ...state.layout.partition[index],
      axisCenter:anchoredAxisCenter(anchor,d.length),
      anchorFace:anchor
    };
    if(typeof normalizePartitionInsideContainer==='function') normalizePartitionInsideContainer(index);
    renderAll();
  }
};

// If orientation is changed manually, the previous wall anchor no longer describes the geometry.
const changePartitionOrientationBeforeWallAnchor=changePartitionOrientation;
changePartitionOrientation=function(orientation){
  if(selectedEditable?.type==='partition'){
    ensureLayoutState();
    state.layout.partition[selectedEditable.index]={...state.layout.partition[selectedEditable.index],anchorFace:null};
  }
  return changePartitionOrientationBeforeWallAnchor(orientation);
};

// Numeric position controls where along the source wall the perpendicular partition starts.
updatePartitionPosition=function(value){
  if(!selectedEditable||selectedEditable.type!=='partition') return;
  const index=selectedEditable.index;
  const p=actualLayout('partition',index),d=objectDimensions('partition',index);
  const b=perpendicularPositionBounds(p.orientation,d.thickness);
  const parsed=Number(value);
  if(!Number.isFinite(parsed)) return toast('Ingresa una ubicación válida');
  const maxDistance=Math.max(0,b.max-b.min);
  const distance=clamp(parsed,0,maxDistance);
  pushHistory();
  setPerpendicularPosition(index,b.min+distance);
  renderAll();
  toast(`Ubicación desde pared ${b.from}: ${distance.toFixed(2)} m`);
};

function renderPartitionWallControls(index){
  const block=document.getElementById('partition-layout-editor');
  if(!block) return;
  const p=actualLayout('partition',index),d=objectDimensions('partition',index);
  const b=perpendicularPositionBounds(p.orientation,d.thickness);
  const input=document.getElementById('partition-position-input');
  const label=document.getElementById('partition-position-label');
  const distance=clamp(perpendicularPosition(index)-b.min,0,b.max-b.min);
  const anchor=currentPartitionAnchor(index);

  if(label) label.textContent=`Ubicación desde pared ${b.from}`;
  if(input){
    input.min='0';
    input.max=(b.max-b.min).toFixed(2);
    input.step='0.05';
    input.value=distance.toFixed(2);
  }

  let wrap=document.getElementById('partition-wall-snap-wrap');
  if(!wrap){
    wrap=document.createElement('div');
    wrap.id='partition-wall-snap-wrap';
    wrap.className='mt-3';
    const field=block.querySelector('.partition-position-field');
    field?.insertAdjacentElement('afterend',wrap);
  }

  const colors={A:'#f59e0b',B:'#38bdf8',C:'#22c55e',D:'#a78bfa'};
  wrap.innerHTML=`
    <div class="partition-wall-title">INICIAR TABIQUE DESDE PARED</div>
    <div id="partition-wall-buttons" class="partition-wall-grid">
      ${['A','B','C','D'].map(face=>`
        <button type="button" class="partition-wall-face-btn ${anchor===face?'active':''}" onclick="anchorPartitionToFace('${face}')" title="Iniciar tabique perpendicular desde pared ${face}">
          <span class="partition-wall-letter" style="--face-color:${colors[face]}">${face}</span>
          <span>Desde ${face}</span>
        </button>`).join('')}
    </div>
    <div class="partition-wall-help">La pared elegida queda como inicio fijo. El tabique sale perpendicular y el Largo crece hacia el interior.</div>`;

  if(!document.getElementById('partition-wall-style')){
    const style=document.createElement('style');
    style.id='partition-wall-style';
    style.textContent=`
      .partition-wall-title{font-size:9px;font-weight:900;letter-spacing:.12em;color:#94a3b8;margin-bottom:7px}
      .partition-wall-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px}
      .partition-wall-face-btn{display:flex;align-items:center;justify-content:flex-start;gap:8px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.055);color:#e2e8f0;border-radius:10px;padding:8px 9px;font-size:10px;font-weight:850;transition:.15s ease}
      .partition-wall-face-btn:hover{background:rgba(245,158,11,.12);border-color:rgba(245,158,11,.35)}
      .partition-wall-face-btn.active{background:rgba(245,158,11,.16);border-color:#f59e0b;color:#fff}
      .partition-wall-letter{width:25px;height:25px;border-radius:8px;display:grid;place-items:center;background:color-mix(in srgb,var(--face-color) 24%,transparent);border:1px solid var(--face-color);color:var(--face-color);font-size:12px;font-weight:950}
      .partition-wall-help{font-size:9px;color:#64748b;margin-top:7px;line-height:1.35}
    `;
    document.head.appendChild(style);
  }
}

const showEditorPanelBeforeWallAnchor=showEditorPanel;
showEditorPanel=function(root){
  showEditorPanelBeforeWallAnchor(root);
  if(root?.userData.editor?.type==='partition') renderPartitionWallControls(root.userData.editor.index);
};

// Dragging moves the perpendicular partition along its source wall, without breaking its wall anchor.
const pointerMoveBeforeWallAnchor=onEditorPointerMove;
onEditorPointerMove=function(event){
  if(draggingEditable?.userData.editor?.type!=='partition') return pointerMoveBeforeWallAnchor(event);
  pointerNDC(event);
  editorRaycaster.setFromCamera(editorPointer,camera);
  const point=new THREE.Vector3();
  if(!editorRaycaster.ray.intersectPlane(dragPlane,point)) return;

  const index=draggingEditable.userData.editor.index;
  const p=actualLayout('partition',index),d=objectDimensions('partition',index);
  const b=perpendicularPositionBounds(p.orientation,d.thickness);
  const raw=p.orientation===PARTITION_ORIENTATION.LONG?point.z:point.x;
  const coord=Math.round(clamp(raw,b.min,b.max)*20)/20;

  dragMoved=true;
  setPerpendicularPosition(index,coord);
  if(p.orientation===PARTITION_ORIENTATION.LONG) draggingEditable.position.z=coord;
  else draggingEditable.position.x=coord;

  const distance=coord-b.min;
  const input=document.getElementById('partition-position-input');
  if(input) input.value=distance.toFixed(2);
};

function reconnectPartitionWallPointerMove(){
  const canvas=renderer?.domElement;
  if(!canvas) return;
  canvas.removeEventListener('pointermove',pointerMoveBeforeWallAnchor);
  canvas.removeEventListener('pointermove',onEditorPointerMove);
  canvas.addEventListener('pointermove',onEditorPointerMove);
}

function bootPartitionWallAnchor(){
  reconnectPartitionWallPointerMove();
  if(selectedEditable?.type==='partition') renderPartitionWallControls(selectedEditable.index);
}

if(document.readyState==='loading'){
  window.addEventListener('DOMContentLoaded',()=>setTimeout(bootPartitionWallAnchor,460));
}else{
  setTimeout(bootPartitionWallAnchor,460);
}
