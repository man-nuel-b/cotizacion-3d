// Wall snapping for interior partitions.
// Loaded after partition-transform.js.

const PARTITION_WALL_SNAP=.14;

function partitionMovementBounds(index){
  const c=DATA.containers[state.container];
  const p=actualLayout('partition',index);
  const d=objectDimensions('partition',index);
  const halfT=(d.thickness||.075)/2;

  if(p.orientation===PARTITION_ORIENTATION.LONG){
    // LONG partition moves across container width (Z), between side walls B/A.
    const minWall=-c.width/2+.060;
    const maxWall=c.width/2-.040;
    return {
      axis:'z',
      minCenter:minWall+halfT,
      maxCenter:maxWall-halfT,
      minWall,
      maxWall,
      nearLabel:'B',
      farLabel:'A'
    };
  }

  // CROSS partition moves along container length (X), between end walls D/C.
  const minWall=-c.length/2+.055;
  const maxWall=c.length/2-.055;
  return {
    axis:'x',
    minCenter:minWall+halfT,
    maxCenter:maxWall-halfT,
    minWall,
    maxWall,
    nearLabel:'D',
    farLabel:'C'
  };
}

function partitionCenterCoordinate(index){
  const p=actualLayout('partition',index);
  return p.orientation===PARTITION_ORIENTATION.LONG?p.z:p.x;
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

function stickPartitionToWall(side){
  if(!selectedEditable||selectedEditable.type!=='partition') return;
  const {index}=selectedEditable;
  const b=partitionMovementBounds(index);
  pushHistory();
  setPartitionCenterCoordinate(index,side==='far'?b.maxCenter:b.minCenter);
  renderAll();
  toast(`Tabique pegado a pared ${side==='far'?b.farLabel:b.nearLabel}`);
}

// Distance now means the real clear gap between the partition face and the near wall.
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

// Override bounds so the actual wall thickness can touch, but never cross, the container lining.
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
  const p=actualLayout('partition',index),b=partitionMovementBounds(index),d=objectDimensions('partition',index);
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

  let controls=document.getElementById('partition-wall-buttons');
  if(!controls){
    controls=document.createElement('div');
    controls.id='partition-wall-buttons';
    controls.className='grid grid-cols-2 gap-2 mt-2';
    const field=block.querySelector('.partition-position-field');
    field?.insertAdjacentElement('afterend',controls);
  }
  controls.innerHTML=`
    <button type="button" class="partition-wall-btn" onclick="stickPartitionToWall('near')"><i class="fa-solid fa-arrow-left-long"></i> Pegar a ${b.nearLabel}</button>
    <button type="button" class="partition-wall-btn" onclick="stickPartitionToWall('far')">Pegar a ${b.farLabel} <i class="fa-solid fa-arrow-right-long"></i></button>`;

  if(!document.getElementById('partition-wall-style')){
    const style=document.createElement('style');
    style.id='partition-wall-style';
    style.textContent=`
      .partition-wall-btn{border:1px solid rgba(245,158,11,.28);background:rgba(245,158,11,.09);color:#fde68a;border-radius:9px;padding:8px 6px;font-size:10px;font-weight:850;transition:.15s ease}
      .partition-wall-btn:hover{background:#f59e0b;color:#0f172a;border-color:#fbbf24}
    `;
    document.head.appendChild(style);
  }
}

const showEditorPanelBeforeWallSnap=showEditorPanel;
showEditorPanel=function(root){
  showEditorPanelBeforeWallSnap(root);
  if(root?.userData.editor?.type==='partition') renderPartitionWallControls(root.userData.editor.index);
};

// Dragging: allow the center to reach the exact inner-wall contact position and snap when close.
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
