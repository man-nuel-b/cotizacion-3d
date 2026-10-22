// Smart L/T joints for interior partitions.
// Loaded after partition-layout.js.

const PARTITION_SNAP_TOLERANCE=.16;

function partitionAxisRange(index){
  const c=DATA.containers[state.container];
  const p=actualLayout('partition',index),d=objectDimensions('partition',index);
  const layout=state.layout.partition[index]||{};
  const half=d.length/2;
  if(p.orientation===PARTITION_ORIENTATION.LONG){
    const center=Number.isFinite(layout.axisCenter)?layout.axisCenter:0;
    return {orientation:p.orientation,start:center-half,end:center+half,perp:p.z,containerStart:-c.length/2+.07,containerEnd:c.length/2-.07};
  }
  const center=Number.isFinite(layout.axisCenter)?layout.axisCenter:0;
  return {orientation:p.orientation,start:center-half,end:center+half,perp:p.x,containerStart:-c.width/2+.07,containerEnd:c.width/2-.07};
}

function setPartitionAxisRange(index,start,end){
  ensureLayoutState(); ensureDimensionState();
  const p=actualLayout('partition',index),c=DATA.containers[state.container];
  let min,max;
  if(p.orientation===PARTITION_ORIENTATION.LONG){ min=-c.length/2+.07; max=c.length/2-.07; }
  else{ min=-c.width/2+.07; max=c.width/2-.07; }
  start=clamp(start,min,max-.30); end=clamp(end,start+.30,max);
  const center=(start+end)/2,length=end-start;
  state.layout.partition[index]={...state.layout.partition[index],axisCenter:center};
  const current=objectDimensions('partition',index);
  state.dimensions.partition[index]={...current,length};
}

function perpendicularIntersection(aIndex,bIndex){
  const a=actualLayout('partition',aIndex),b=actualLayout('partition',bIndex);
  if(a.orientation===b.orientation) return null;
  // Coordinates of intersection in world X/Z.
  const cross=a.orientation===PARTITION_ORIENTATION.CROSS?a:b;
  const long=a.orientation===PARTITION_ORIENTATION.LONG?a:b;
  return {x:cross.x,z:long.z};
}

function axisCoordinateFor(index,point){
  const p=actualLayout('partition',index);
  return p.orientation===PARTITION_ORIENTATION.LONG?point.x:point.z;
}

function pointInsidePartitionSpan(index,point,padding=.03){
  const range=partitionAxisRange(index),coord=axisCoordinateFor(index,point);
  return coord>=range.start-padding&&coord<=range.end+padding;
}

function nearestJointCandidate(index,endpoint){
  const range=partitionAxisRange(index);
  const endpointCoord=endpoint==='start'?range.start:range.end;
  let best=null;
  for(let j=0;j<(state.counts.partition||0);j++){
    if(j===index) continue;
    const intersection=perpendicularIntersection(index,j);
    if(!intersection||!pointInsidePartitionSpan(j,intersection,.08)) continue;
    const coord=axisCoordinateFor(index,intersection);
    const distance=Math.abs(coord-endpointCoord);
    if(distance>PARTITION_SNAP_TOLERANCE) continue;
    if(!best||distance<best.distance) best={otherIndex:j,coord,distance,intersection};
  }
  return best;
}

function jointKind(index,otherIndex,coord){
  const other=partitionAxisRange(otherIndex);
  const otherCoord=axisCoordinateFor(otherIndex,perpendicularIntersection(index,otherIndex));
  const nearOtherStart=Math.abs(otherCoord-other.start)<PARTITION_SNAP_TOLERANCE;
  const nearOtherEnd=Math.abs(otherCoord-other.end)<PARTITION_SNAP_TOLERANCE;
  return (nearOtherStart||nearOtherEnd)?'L':'T';
}

function snapPartitionEndpoints(index,{silent=false}={}){
  const before=partitionAxisRange(index);
  let start=before.start,end=before.end;
  const startHit=nearestJointCandidate(index,'start');
  const endHit=nearestJointCandidate(index,'end');
  const joints=[];

  if(startHit){
    start=startHit.coord;
    joints.push({endpoint:'start',kind:jointKind(index,startHit.otherIndex,startHit.coord),otherIndex:startHit.otherIndex});
  }
  if(endHit){
    end=endHit.coord;
    joints.push({endpoint:'end',kind:jointKind(index,endHit.otherIndex,endHit.coord),otherIndex:endHit.otherIndex});
  }
  if(end-start<.30) return [];

  if(joints.length){
    setPartitionAxisRange(index,start,end);
    state.layout.partition[index]={...state.layout.partition[index],joints};
    if(!silent){
      const kinds=[...new Set(joints.map(j=>j.kind))].join('/');
      toast(`Tabique encajado en unión ${kinds}`);
    }
  }else if(state.layout.partition[index]?.joints){
    state.layout.partition[index]={...state.layout.partition[index],joints:[]};
  }
  return joints;
}

function snapAllPartitions({silent=true}={}){
  for(let pass=0;pass<2;pass++){
    for(let i=0;i<(state.counts.partition||0);i++) snapPartitionEndpoints(i,{silent});
  }
}

function partitionJointSummary(index){
  const joints=state.layout?.partition?.[index]?.joints||[];
  if(!joints.length) return 'Sin unión';
  const kinds=[...new Set(joints.map(j=>j.kind))];
  return `Unión ${kinds.join(' / ')}`;
}

function autoJoinSelectedPartition(){
  if(!selectedEditable||selectedEditable.type!=='partition') return;
  pushHistory();
  const joints=snapPartitionEndpoints(selectedEditable.index,{silent:true});
  renderAll();
  toast(joints.length?`${partitionJointSummary(selectedEditable.index)} ajustada`:'No hay otro tabique suficientemente cerca');
}

function restorePartitionFullSpan(){
  if(!selectedEditable||selectedEditable.type!=='partition') return;
  const {index}=selectedEditable,p=actualLayout('partition',index);
  pushHistory(); ensureLayoutState(); ensureDimensionState();
  const c=DATA.containers[state.container];
  const start=p.orientation===PARTITION_ORIENTATION.LONG?-c.length/2+.07:-c.width/2+.07;
  const end=p.orientation===PARTITION_ORIENTATION.LONG?c.length/2-.07:c.width/2-.07;
  setPartitionAxisRange(index,start,end);
  state.layout.partition[index]={...state.layout.partition[index],joints:[]};
  renderAll();
  toast('Tabique extendido entre límites interiores');
}

function ensureJointEditor(){
  const panel=document.getElementById('object-editor'); if(!panel) return null;
  let block=document.getElementById('partition-joint-editor');
  if(block) return block;
  block=document.createElement('div');
  block.id='partition-joint-editor';
  block.className='hidden mt-3 rounded-xl bg-white/5 border border-white/10 p-3';
  block.innerHTML=`
    <div class="flex items-center justify-between gap-2">
      <div><div class="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Uniones inteligentes</div><div id="partition-joint-status" class="text-[11px] text-slate-300 mt-1">Sin unión</div></div>
      <span class="partition-snap-badge">AUTO</span>
    </div>
    <div class="grid grid-cols-2 gap-2 mt-3">
      <button type="button" class="partition-joint-btn" onclick="autoJoinSelectedPartition()"><i class="fa-solid fa-magnet mr-1"></i> Encajar L/T</button>
      <button type="button" class="partition-joint-btn" onclick="restorePartitionFullSpan()"><i class="fa-solid fa-arrows-left-right-to-line mr-1"></i> Extender</button>
    </div>
    <div class="text-[10px] text-slate-500 mt-2">Al mover un tabique, sus extremos se ajustan automáticamente si quedan a menos de 16 cm de otro tabique perpendicular.</div>`;
  const dimensions=document.getElementById('dimension-editor');
  if(dimensions) panel.insertBefore(block,dimensions); else panel.appendChild(block);

  if(!document.getElementById('partition-joint-style')){
    const style=document.createElement('style'); style.id='partition-joint-style';
    style.textContent=`
      .partition-joint-btn{border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.07);color:#e2e8f0;border-radius:9px;padding:9px 7px;font-size:10px;font-weight:800}.partition-joint-btn:hover{background:rgba(245,158,11,.14);border-color:rgba(245,158,11,.35)}.partition-snap-badge{font-size:8px;font-weight:900;letter-spacing:.12em;padding:4px 6px;border-radius:999px;background:rgba(34,197,94,.12);color:#86efac;border:1px solid rgba(34,197,94,.22)}`;
    document.head.appendChild(style);
  }
  return block;
}

function renderJointEditor(index){
  const block=ensureJointEditor(); if(!block) return;
  block.classList.remove('hidden');
  const status=document.getElementById('partition-joint-status');
  if(status) status.textContent=partitionJointSummary(index);
}

const showEditorPanelBeforeJoints=showEditorPanel;
showEditorPanel=function(root){
  showEditorPanelBeforeJoints(root);
  const block=ensureJointEditor();
  if(root?.userData.editor?.type==='partition') renderJointEditor(root.userData.editor.index);
  else block?.classList.add('hidden');
};

const hideEditorPanelBeforeJoints=hideEditorPanel;
hideEditorPanel=function(){
  hideEditorPanelBeforeJoints();
  document.getElementById('partition-joint-editor')?.classList.add('hidden');
};

// Build partitions using an along-axis center so trimmed walls can meet cleanly.
rebuildParametricPartitions=function(){
  if(!containerGroup) return;
  ensureLayoutState(); ensureDimensionState();
  const oldPartitions=editableObjects.filter(root=>root.userData.editor?.type==='partition');
  oldPartitions.forEach(disposePartitionRoot);
  editableObjects=editableObjects.filter(root=>root.userData.editor?.type!=='partition');

  for(let i=0;i<(state.counts.partition||0);i++){
    const p=actualLayout('partition',i),d=objectDimensions('partition',i),layout=state.layout.partition[i]||{};
    const axisCenter=Number.isFinite(layout.axisCenter)?layout.axisCenter:0;
    const obj=createParametricPartition(d.length,d.height,d.thickness);
    if(p.orientation===PARTITION_ORIENTATION.LONG){
      addGroup(containerGroup,obj,axisCenter,.08,p.z,Math.PI/2);
      registerEditable(obj,'partition',i,{axis:'z',surface:'floor',orientation:p.orientation});
    }else{
      addGroup(containerGroup,obj,p.x,.08,axisCenter,0);
      registerEditable(obj,'partition',i,{axis:'x',surface:'floor',orientation:p.orientation});
    }
  }

  if(selectedEditable?.type==='partition'){
    const root=editableObjects.find(o=>o.userData.editor?.type==='partition'&&o.userData.editor?.index===selectedEditable.index);
    if(root){ addSelectionOutline(root); showEditorPanel(root); }
  }
};

// Keep full-span defaults when changing orientation; smart joints can trim afterwards.
const changePartitionOrientationBeforeJoints=changePartitionOrientation;
changePartitionOrientation=function(orientation){
  changePartitionOrientationBeforeJoints(orientation);
  if(selectedEditable?.type==='partition'){
    const i=selectedEditable.index;
    ensureLayoutState();
    state.layout.partition[i]={...state.layout.partition[i],axisCenter:0,joints:[]};
    renderAll();
  }
};

const updatePartitionDimensionBeforeJoints=updatePartitionDimension;
updatePartitionDimension=function(key,value){
  updatePartitionDimensionBeforeJoints(key,value);
  if(selectedEditable?.type==='partition'&&key==='length'){
    ensureLayoutState();
    state.layout.partition[selectedEditable.index]={...state.layout.partition[selectedEditable.index],joints:[]};
  }
};

// Auto-snap after drag finishes, preserving undo history from the drag itself.
const pointerUpBeforeJoints=onEditorPointerUp;
onEditorPointerUp=function(event){
  const wasPartition=draggingEditable?.userData.editor?.type==='partition';
  const partitionIndex=wasPartition?draggingEditable.userData.editor.index:null;
  pointerUpBeforeJoints(event);
  if(wasPartition&&partitionIndex!==null){
    const joints=snapPartitionEndpoints(partitionIndex,{silent:true});
    if(joints.length){
      renderAll();
      toast(`${partitionJointSummary(partitionIndex)} automática`);
    }
  }
};

function reconnectJointPointerUp(){
  const canvas=renderer?.domElement; if(!canvas) return;
  canvas.removeEventListener('pointerup',pointerUpBeforeJoints);
  canvas.removeEventListener('pointercancel',pointerUpBeforeJoints);
  canvas.removeEventListener('pointerup',onEditorPointerUp);
  canvas.removeEventListener('pointercancel',onEditorPointerUp);
  canvas.addEventListener('pointerup',onEditorPointerUp);
  canvas.addEventListener('pointercancel',onEditorPointerUp);
}

function bootPartitionJoints(){
  ensureJointEditor();
  reconnectJointPointerUp();
  snapAllPartitions({silent:true});
  rebuild3D();
}

if(document.readyState==='loading') window.addEventListener('DOMContentLoaded',()=>setTimeout(bootPartitionJoints,280));
else setTimeout(bootPartitionJoints,280);
