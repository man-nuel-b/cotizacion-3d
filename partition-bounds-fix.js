// Hard interior bounds for partition geometry.
// This layer prevents transverse/longitudinal partitions from crossing the container skin.

function partitionInteriorBounds(orientation){
  const c=DATA.containers[state.container];
  if(orientation===PARTITION_ORIENTATION.LONG){
    return {min:-c.length/2+.055,max:c.length/2-.055};
  }
  return {min:-c.width/2+.060,max:c.width/2-.040};
}

partitionFullLength=function(orientation){
  const b=partitionInteriorBounds(orientation);
  return Math.max(.30,b.max-b.min);
};

partitionAxisRange=function(index){
  const p=actualLayout('partition',index),d=objectDimensions('partition',index);
  const layout=state.layout.partition[index]||{};
  const bounds=partitionInteriorBounds(p.orientation);
  const maxLength=bounds.max-bounds.min;
  const length=clamp(Number(d.length)||.30,.30,maxLength);
  const half=length/2;
  const requestedCenter=Number.isFinite(layout.axisCenter)?layout.axisCenter:(bounds.min+bounds.max)/2;
  const center=clamp(requestedCenter,bounds.min+half,bounds.max-half);
  return {orientation:p.orientation,start:center-half,end:center+half,perp:p.orientation===PARTITION_ORIENTATION.LONG?p.z:p.x,containerStart:bounds.min,containerEnd:bounds.max};
};

setPartitionAxisRange=function(index,start,end){
  ensureLayoutState(); ensureDimensionState();
  const p=actualLayout('partition',index),bounds=partitionInteriorBounds(p.orientation);
  start=clamp(Number(start),bounds.min,bounds.max-.30);
  end=clamp(Number(end),start+.30,bounds.max);
  const center=(start+end)/2,length=end-start;
  state.layout.partition[index]={...state.layout.partition[index],axisCenter:center};
  const current=objectDimensions('partition',index);
  state.dimensions.partition[index]={...current,length};
};

function normalizePartitionInsideContainer(index){
  ensureLayoutState(); ensureDimensionState();
  const p=actualLayout('partition',index),bounds=partitionInteriorBounds(p.orientation);
  const stored=state.dimensions.partition[index]||{},current=objectDimensions('partition',index);
  const maxLength=bounds.max-bounds.min,length=clamp(Number(current.length)||maxLength,.30,maxLength),half=length/2;
  const requestedCenter=Number.isFinite(state.layout.partition[index]?.axisCenter)?state.layout.partition[index].axisCenter:(bounds.min+bounds.max)/2;
  const center=clamp(requestedCenter,bounds.min+half,bounds.max-half);
  state.layout.partition[index]={...state.layout.partition[index],axisCenter:center};
  state.dimensions.partition[index]={...stored,...current,length};
}

function normalizeAllPartitionsInsideContainer(){
  for(let i=0;i<(state.counts.partition||0);i++) normalizePartitionInsideContainer(i);
}

const rebuildParametricPartitionsBeforeBoundsFix=rebuildParametricPartitions;
rebuildParametricPartitions=function(){ normalizeAllPartitionsInsideContainer(); return rebuildParametricPartitionsBeforeBoundsFix(); };

restorePartitionFullSpan=function(){
  if(!selectedEditable||selectedEditable.type!=='partition') return;
  const {index}=selectedEditable,p=actualLayout('partition',index);
  pushHistory();
  const bounds=partitionInteriorBounds(p.orientation);
  setPartitionAxisRange(index,bounds.min,bounds.max);
  state.layout.partition[index]={...state.layout.partition[index],joints:[]};
  renderAll(); toast('Tabique extendido hasta las caras interiores');
};

const updatePartitionDimensionBeforeBoundsFix=updatePartitionDimension;
updatePartitionDimension=function(key,value){
  updatePartitionDimensionBeforeBoundsFix(key,value);
  if(selectedEditable?.type==='partition') normalizePartitionInsideContainer(selectedEditable.index);
};

const changePartitionOrientationBeforeBoundsFix=changePartitionOrientation;
changePartitionOrientation=function(orientation){
  changePartitionOrientationBeforeBoundsFix(orientation);
  if(selectedEditable?.type==='partition'){
    const index=selectedEditable.index,bounds=partitionInteriorBounds(orientation);
    setPartitionAxisRange(index,bounds.min,bounds.max);
    state.layout.partition[index]={...state.layout.partition[index],joints:[]};
    renderAll();
  }
};

function loadInteriorViewLayer(){
  if(document.querySelector('script[data-interior-view]')) return;
  const script=document.createElement('script');
  script.src='interior-view.js';
  script.dataset.interiorView='true';
  document.body.appendChild(script);
}

function loadPassThroughWindowLayer(){
  if(document.querySelector('script[data-window-through]')){
    setTimeout(loadInteriorViewLayer,20);
    return;
  }
  const script=document.createElement('script');
  script.src='window-through.js';
  script.dataset.windowThrough='true';
  script.addEventListener('load',()=>setTimeout(loadInteriorViewLayer,20),{once:true});
  document.body.appendChild(script);
}

function bootPartitionBoundsFix(){
  normalizeAllPartitionsInsideContainer();
  rebuild3D();
  setTimeout(loadPassThroughWindowLayer,20);
}

if(document.readyState==='loading'){
  window.addEventListener('DOMContentLoaded',()=>setTimeout(bootPartitionBoundsFix,340));
}else{
  setTimeout(bootPartitionBoundsFix,340);
}
