// Wall snapping for interior partitions.
// Loaded after partition-transform.js.
// Important UX rule: snapping to A/B/C/D NEVER changes the chosen orientation.

const PARTITION_WALL_SNAP=.14;

function partitionMovementBounds(index){
  const c=DATA.containers[state.container];
  const p=actualLayout('partition',index);
  const d=objectDimensions('partition',index);
  const halfT=(d.thickness||.075)/2;

  if(p.orientation===PARTITION_ORIENTATION.LONG){
    // Long wall runs X and moves sideways in Z, between B/A.
    const minWall=-c.width/2+.060;
    const maxWall=c.width/2-.040;
    return {axis:'z',minCenter:minWall+halfT,maxCenter:maxWall-halfT,minWall,maxWall,nearLabel:'B',farLabel:'A'};
  }

  // Cross wall runs Z and moves along X, between D/C.
  const minWall=-c.length/2+.055;
  const maxWall=c.length/2-.055;
  return {axis:'x',minCenter:minWall+halfT,maxCenter:maxWall-halfT,minWall,maxWall,nearLabel:'D',farLabel:'C'};
}

function partitionAlongAxisBounds(index){
  const p=actualLayout('partition',index);
  const c=DATA.containers[state.container];
  if(p.orientation===PARTITION_ORIENTATION.LONG){
    return {min:-c.length/2+.055,max:c.length/2-.055,nearLabel:'D',farLabel:'C'};
  }
  return {min:-c.width/2+.060,max:c.width/2-.040,nearLabel:'B',farLabel:'A'};
}

function partitionCenterCoordinate(index){
  const p=actualLayout('partition',index);
  return p.orientation===PARTITION_ORIENTATION.LONG?p.z:p.x;
}

function partitionAxisCenter(index){
  const b=partitionAlongAxisBounds(index);
  const stored=state.layout?.partition?.[index]?.axisCenter;
  return Number.isFinite(stored)?stored:(b.min+b.max)/2;
}

function setPartitionAxisCenter(index,center){
  ensureLayoutState();
  const d=objectDimensions('partition',index);
  const b=partitionAlongAxisBounds(index);
  const half=Math.min((d.length||.30)/2,(b.max-b.min)/2);
  const next=clamp(center,b.min+half,b.max-half);
  state.layout.partition[index]={...state.layout.partition[index],axisCenter:next};
  return next;
}

function partitionGapFromNearWall(index){
  const d=objectDimensions('partition',index);
  const halfT=(d.thickness||.075)/2;
  const b=partitionMovementBounds(index);
  return Math.max(0,partitionCenterCoordinate(index)-halfT-b.minWall);
}

function partitionGapFromFarWall(index){
  const d=objectDimensions('partition',index);
  const halfT=(d.thickness||.075)/2;
  const b=partitionMovementBounds(index);
  return Math.max(0,b.maxWall-(partitionCenterCoordinate(index)+halfT));
}

function snapPartitionCenterToWalls(index,coord){
  const b=partitionMovementBounds(index);
  let next=clamp(coord,b.minCenter,b.maxCenter);
  if(Math.abs(next-b.minCenter)<=PARTITION_WALL_SNAP) next=b.minCenter;
  if(Math.abs(next-b.maxCenter)<=PARTITION_WALL_SNAP) next=b.maxCenter;
  return next;
}

function setPartitionCenterCoordinate(index,coord){
  ensureLayoutState();
  const p=actualLayout('partition',index);
  const next=snapPartitionCenterToWalls(index,coord);
  if(p.orientation===PARTITION_ORIENTATION.LONG){
    state.layout.partition[index]={...state.layout.partition[index],orientation:p.orientation,x:0,z:next};
  }else{
    state.layout.partition[index]={...state.layout.partition[index],orientation:p.orientation,x:next,z:0};
  }
  return next;
}

function partitionTouchesFace(index,face,tolerance=.02){
  const p=actualLayout('partition',index);
  const d=objectDimensions('partition',index);
  const move=partitionMovementBounds(index);
  const axis=partitionAlongAxisBounds(index);
  const coord=partitionCenterCoordinate(index);
  const axisCenter=partitionAxisCenter(index);
  const halfLength=(d.length||.30)/2;

  if(p.orientation===PARTITION_ORIENTATION.LONG){
    if(face==='A') return Math.abs(coord-move.maxCenter)<=tolerance;
    if(face==='B') return Math.abs(coord-move.minCenter)<=tolerance;
    if(face==='C') return Math.abs((axisCenter+halfLength)-axis.max)<=tolerance;
    if(face==='D') return Math.abs((axisCenter-halfLength)-axis.min)<=tolerance;
  }else{
    if(face==='C') return Math.abs(coord-move.maxCenter)<=tolerance;
    if(face==='D') return Math.abs(coord-move.minCenter)<=tolerance;
    if(face==='A') return Math.abs((axisCenter+halfLength)-axis.max)<=tolerance;
    if(face==='B') return Math.abs((axisCenter-halfLength)-axis.min)<=tolerance;
  }
  return false;
}

function snapPartitionToFace(face){
  if(!selectedEditable||selectedEditable.type!=='partition'||!['A','B','C','D'].includes(face)) return;
  const {index}=selectedEditable;
  const p=actualLayout('partition',index);
  const d=objectDimensions('partition',index);

  pushHistory();
  ensureLayoutState();
  ensureDimensionState();

  // Keep orientation and all dimensions exactly as selected by the user.
  state.dimensions.partition[index]={...state.dimensions.partition[index],...d};
  state.layout.partition[index]={...state.layout.partition[index],orientation:p.orientation,joints:[]};

  const move=partitionMovementBounds(index);
  const axis=partitionAlongAxisBounds(index);
  const halfLength=(d.length||.30)/2;

  if(p.orientation===PARTITION_ORIENTATION.LONG){
    if(face==='A') setPartitionCenterCoordinate(index,move.maxCenter);
    else if(face==='B') setPartitionCenterCoordinate(index,move.minCenter);
    else if(face==='C') setPartitionAxisCenter(index,axis.max-halfLength);
    else if(face==='D') setPartitionAxisCenter(index,axis.min+halfLength);
  }else{
    if(face==='C') setPartitionCenterCoordinate(index,move.maxCenter);
    else if(face==='D') setPartitionCenterCoordinate(index,move.minCenter);
    else if(face==='A') setPartitionAxisCenter(index,axis.max-halfLength);
    else if(face==='B') setPartitionAxisCenter(index,axis.min+halfLength);
  }

  if(typeof normalizePartitionInsideContainer==='function') normalizePartitionInsideContainer(index);
  renderAll();
  toast(`Tabique ${partitionOrientationLabel(p.orientation).toLowerCase()} pegado a pared ${face}`);
}

function stickPartitionToWall(side){
  if(!selectedEditable||selectedEditable.type!=='partition') return;
  const {index}=selectedEditable;
  const b=partitionMovementBounds(index);
  return snapPartitionToFace(side==='far'?b.farLabel:b.nearLabel);
}

// Numeric position continues to control the perpendicular separation.
updatePartitionPosition=function(value){
  if(!selectedEditable||selectedEditable.type!=='partition') return;
  const {index}=selectedEditable;
  const parsed=Number(value);
  if(!Number.isFinite(parsed)) return toast('Ingresa una distancia válida');

  const b=partitionMovementBounds(index);
  const d=objectDimensions('partition',index);
  const halfT=(d.thickness||.075)/2;
  const maxGap=Math.max(0,b.maxWall-b.minWall-(d.thickness||.075));
  const gap=clamp(parsed,0,maxGap);
  const center=b.minWall+halfT+gap;

  pushHistory();
  setPartitionCenterCoordinate(index,center);
  renderAll();
  toast(gap<=.001?`Tabique pegado a pared ${b.nearLabel}`:`Separación: ${gap.toFixed(2)} m`);
};

const validCandidateBeforeWallSnap=validCandidate;
validCandidate=function(type,index,candidate){
  if(type!=='partition') return validCandidateBeforeWallSnap(type,index,candidate);
  const p=actualLayout('partition',index),b=partitionMovementBounds(index);
  const coord=p.orientation===PARTITION_ORIENTATION.LONG
    ? (Number.isFinite(candidate.z)?candidate.z:p.z)
    : (Number.isFinite(candidate.x)?candidate.x:p.x);
  return coord>=b.minCenter-.001&&coord<=b.maxCenter+.001;
};

function renderPartitionWallControls(index){
  const block=document.getElementById('partition-layout-editor');
  if(!block) return;
  const b=partitionMovementBounds(index),d=objectDimensions('partition',index);
  const input=document.getElementById('partition-position-input');
  const label=document.getElementById('partition-position-label');
  const maxGap=Math.max(0,b.maxWall-b.minWall-(d.thickness||.075));

  if(label) label.textContent=`Separación desde pared ${b.nearLabel}`;
  if(input){
    input.min='0';
    input.max=maxGap.toFixed(2);
    input.step='0.05';
    input.value=partitionGapFromNearWall(index).toFixed(2);
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
    <div class="partition-wall-title">PEGAR TABIQUE A PARED</div>
    <div id="partition-wall-buttons" class="partition-wall-grid">
      ${['A','B','C','D'].map(face=>`
        <button type="button" class="partition-wall-face-btn ${partitionTouchesFace(index,face)?'active':''}" onclick="snapPartitionToFace('${face}')" title="Pegar tabique a pared ${face} sin cambiar orientación">
          <span class="partition-wall-letter" style="--face-color:${colors[face]}">${face}</span>
          <span>Pared ${face}</span>
        </button>`).join('')}
    </div>
    <div class="partition-wall-help">Mantiene la orientación actual · solo mueve el tabique hasta tocar la pared elegida</div>`;

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

const showEditorPanelBeforeWallSnap=showEditorPanel;
showEditorPanel=function(root){
  showEditorPanelBeforeWallSnap(root);
  if(root?.userData.editor?.type==='partition') renderPartitionWallControls(root.userData.editor.index);
};

const pointerMoveBeforeWallSnap=onEditorPointerMove;
onEditorPointerMove=function(event){
  if(draggingEditable?.userData.editor?.type!=='partition') return pointerMoveBeforeWallSnap(event);
  pointerNDC(event);
  editorRaycaster.setFromCamera(editorPointer,camera);
  const point=new THREE.Vector3();
  if(!editorRaycaster.ray.intersectPlane(dragPlane,point)) return;

  const {index}=draggingEditable.userData.editor;
  const p=actualLayout('partition',index),b=partitionMovementBounds(index);
  let coord=p.orientation===PARTITION_ORIENTATION.LONG?point.z:point.x;
  coord=Math.round(coord*100)/100;
  coord=snapPartitionCenterToWalls(index,coord);

  dragMoved=true;
  setPartitionCenterCoordinate(index,coord);

  if(p.orientation===PARTITION_ORIENTATION.LONG) draggingEditable.position.z=coord;
  else draggingEditable.position.x=coord;

  const subtitle=document.getElementById('editor-subtitle');
  const gap=partitionGapFromNearWall(index);
  if(subtitle) subtitle.textContent=`Elemento ${index+1} · ${partitionOrientationLabel(p.orientation)} · pared ${b.nearLabel}: ${gap.toFixed(2)} m`;
  const input=document.getElementById('partition-position-input');
  if(input) input.value=gap.toFixed(2);
};

function reconnectPartitionWallPointerMove(){
  const canvas=renderer?.domElement;
  if(!canvas) return;
  canvas.removeEventListener('pointermove',pointerMoveBeforeWallSnap);
  canvas.removeEventListener('pointermove',onEditorPointerMove);
  canvas.addEventListener('pointermove',onEditorPointerMove);
}

function bootPartitionWallSnap(){
  reconnectPartitionWallPointerMove();
  if(selectedEditable?.type==='partition') renderPartitionWallControls(selectedEditable.index);
}

if(document.readyState==='loading'){
  window.addEventListener('DOMContentLoaded',()=>setTimeout(bootPartitionWallSnap,460));
}else{
  setTimeout(bootPartitionWallSnap,460);
}
