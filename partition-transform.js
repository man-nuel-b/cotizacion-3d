// Physical partition sizing and vertical elevation.
// Loaded after partition-dimensions-enhanced.js.

const objectDimensionsBeforePartitionTransform=objectDimensions;
objectDimensions=function(type,index){
  const dims=objectDimensionsBeforePartitionTransform(type,index);
  if(type!=='partition') return dims;
  ensureDimensionState();
  const c=DATA.containers[state.container];
  const stored=state.dimensions.partition[index]||{};
  const elevation=clamp(Number.isFinite(stored.elevation)?stored.elevation:0,0,Math.max(0,c.height-1.06));
  const maxHeight=Math.max(.30,c.height-.06-elevation);
  return {
    ...dims,
    elevation:Math.round(elevation*100)/100,
    height:Math.round(clamp(Number(dims.height)||1,.30,maxHeight)*100)/100
  };
};

OBJECT_DIMENSIONS.partition={
  fields:[
    {key:'length',label:'Largo',min:.30,max:12.00,step:.05},
    {key:'height',label:'Alto',min:.30,max:2.85,step:.05},
    {key:'thickness',label:'Espesor',min:.05,max:.20,step:.005},
    {key:'elevation',label:'Altura desde piso',min:0,max:2.40,step:.05}
  ],
  defaults:()=>({
    length:partitionFullLength(PARTITION_ORIENTATION.CROSS),
    height:Math.max(.30,DATA.containers[state.container].height-.15),
    thickness:.075,
    elevation:0
  })
};

updatePartitionDimension=function(key,value){
  if(!selectedEditable||selectedEditable.type!=='partition') return;
  const {index}=selectedEditable;
  const p=actualLayout('partition',index),c=DATA.containers[state.container];
  const parsed=Number(value);
  if(!Number.isFinite(parsed)) return toast('Ingresa una medida válida');

  const current=objectDimensions('partition',index);
  const next={...current};

  if(key==='length'){
    next.length=clamp(parsed,.30,partitionFullLength(p.orientation));
  }else if(key==='height'){
    next.height=clamp(parsed,.30,Math.max(.30,c.height-.06-current.elevation));
  }else if(key==='thickness'){
    next.thickness=clamp(parsed,.05,.20);
  }else if(key==='elevation'){
    next.elevation=clamp(parsed,0,Math.max(0,c.height-.06-current.height));
  }else return;

  next.length=Math.round(next.length*100)/100;
  next.height=Math.round(next.height*100)/100;
  next.thickness=Math.round(next.thickness*1000)/1000;
  next.elevation=Math.round((next.elevation||0)*100)/100;

  pushHistory();
  ensureDimensionState();
  state.dimensions.partition[index]=next;
  if(typeof normalizePartitionInsideContainer==='function') normalizePartitionInsideContainer(index);
  renderAll();

  const labels={length:'Largo',height:'Alto',thickness:'Espesor',elevation:'Altura desde piso'};
  const decimals=key==='thickness'?3:2;
  toast(`${labels[key]}: ${next[key].toFixed(decimals)} m`);
};

renderDimensionEditor=function(type,index){
  if(type!=='partition'){
    if(typeof renderDimensionEditorBeforePartition==='function') return renderDimensionEditorBeforePartition(type,index);
    return;
  }
  const editor=document.getElementById('dimension-editor');
  if(!editor) return;

  const p=actualLayout('partition',index),d=objectDimensions('partition',index),c=DATA.containers[state.container];
  const maxHeight=Math.max(.30,c.height-.06-d.elevation);
  const maxElevation=Math.max(0,c.height-.06-d.height);
  editor.classList.remove('hidden');

  const heading=editor.querySelector('.text-slate-400');
  if(heading) heading.textContent='DIMENSIONES DEL TABIQUE';
  const help=editor.querySelector('.text-slate-500');
  if(help) help.textContent='Escribe las medidas y el muro cambia inmediatamente en el 3D';

  const fields=editor.querySelector('[data-dimension-fields]');
  if(!fields) return;
  fields.className='grid grid-cols-2 gap-2';
  fields.innerHTML=`
    <label class="dimension-field"><span>Largo</span><div class="dimension-input-wrap"><input class="dimension-input-prominent" type="number" inputmode="decimal" min="0.30" max="${partitionFullLength(p.orientation).toFixed(2)}" step="0.05" value="${d.length.toFixed(2)}" onchange="updatePartitionDimension('length',this.value)"><small>m</small></div></label>
    <label class="dimension-field"><span>Alto</span><div class="dimension-input-wrap"><input class="dimension-input-prominent" type="number" inputmode="decimal" min="0.30" max="${maxHeight.toFixed(2)}" step="0.05" value="${d.height.toFixed(2)}" onchange="updatePartitionDimension('height',this.value)"><small>m</small></div></label>
    <label class="dimension-field"><span>Espesor</span><div class="dimension-input-wrap"><input class="dimension-input-prominent" type="number" inputmode="decimal" min="0.05" max="0.20" step="0.005" value="${d.thickness.toFixed(3)}" onchange="updatePartitionDimension('thickness',this.value)"><small>m</small></div></label>
    <label class="dimension-field"><span>Altura desde piso</span><div class="dimension-input-wrap"><input class="dimension-input-prominent" type="number" inputmode="decimal" min="0" max="${maxElevation.toFixed(2)}" step="0.05" value="${d.elevation.toFixed(2)}" onchange="updatePartitionDimension('elevation',this.value)"><small>m</small></div></label>`;
};

function movePartitionDimensionEditorToTop(){
  const panel=document.getElementById('object-editor');
  const editor=document.getElementById('dimension-editor');
  if(!panel||!editor) return;
  const header=panel.firstElementChild;
  if(header&&header.nextElementSibling!==editor) header.insertAdjacentElement('afterend',editor);
  editor.classList.add('partition-dimensions-top');
}

function installPartitionDimensionTopStyle(){
  if(document.getElementById('partition-dimensions-top-style')) return;
  const style=document.createElement('style');
  style.id='partition-dimensions-top-style';
  style.textContent=`
    #dimension-editor.partition-dimensions-top{margin-top:12px!important;padding:12px!important;background:rgba(245,158,11,.075)!important;border-color:rgba(245,158,11,.32)!important}
    #dimension-editor.partition-dimensions-top [data-dimension-fields]{margin-top:9px}
    #dimension-editor.partition-dimensions-top .dimension-field>span{font-size:10px!important;font-weight:800!important;color:#e2e8f0!important;display:block;margin-bottom:5px}
    #dimension-editor.partition-dimensions-top input{background:rgba(15,23,42,.75)!important;border:1px solid rgba(245,158,11,.24)!important;color:#fff!important;font-weight:800!important}
  `;
  document.head.appendChild(style);
}

if(typeof dimensionSummaryText==='function'){
  const dimensionSummaryTextBeforePartitionTransform=dimensionSummaryText;
  dimensionSummaryText=function(type,index){
    if(type!=='partition') return dimensionSummaryTextBeforePartitionTransform(type,index);
    const d=objectDimensions('partition',index);
    return `${d.length.toFixed(2)} × ${d.height.toFixed(2)} m · desde piso ${d.elevation.toFixed(2)} m`;
  };
}

// Final partition builder: dimensions directly define geometry, elevation defines vertical position.
rebuildParametricPartitions=function(){
  if(!containerGroup) return;
  ensureLayoutState();
  ensureDimensionState();
  if(typeof normalizeAllPartitionsInsideContainer==='function') normalizeAllPartitionsInsideContainer();

  const oldPartitions=editableObjects.filter(root=>root.userData.editor?.type==='partition');
  oldPartitions.forEach(disposePartitionRoot);
  editableObjects=editableObjects.filter(root=>root.userData.editor?.type!=='partition');

  for(let i=0;i<(state.counts.partition||0);i++){
    const p=actualLayout('partition',i),d=objectDimensions('partition',i),layout=state.layout.partition[i]||{};
    const axisCenter=Number.isFinite(layout.axisCenter)?layout.axisCenter:0;
    const obj=createParametricPartition(d.length,d.height,d.thickness);
    const y=.08+d.elevation;

    if(p.orientation===PARTITION_ORIENTATION.LONG){
      addGroup(containerGroup,obj,axisCenter,y,p.z,Math.PI/2);
      registerEditable(obj,'partition',i,{axis:'z',surface:'floor',orientation:p.orientation});
    }else{
      addGroup(containerGroup,obj,p.x,y,axisCenter,0);
      registerEditable(obj,'partition',i,{axis:'x',surface:'floor',orientation:p.orientation});
    }
  }

  if(selectedEditable?.type==='partition'){
    const root=editableObjects.find(o=>o.userData.editor?.type==='partition'&&o.userData.editor?.index===selectedEditable.index);
    if(root){
      addSelectionOutline(root);
      showEditorPanel(root);
    }
  }
};

const showEditorPanelBeforePartitionTransform=showEditorPanel;
showEditorPanel=function(root){
  showEditorPanelBeforePartitionTransform(root);
  if(root?.userData.editor?.type==='partition'){
    movePartitionDimensionEditorToTop();
    renderDimensionEditor('partition',root.userData.editor.index);
  }else{
    document.getElementById('dimension-editor')?.classList.remove('partition-dimensions-top');
  }
};

const resetSelectedDimensionsBeforePartitionTransform=resetSelectedDimensions;
resetSelectedDimensions=function(){
  if(selectedEditable?.type!=='partition') return resetSelectedDimensionsBeforePartitionTransform();
  const {index}=selectedEditable,p=actualLayout('partition',index),c=DATA.containers[state.container];
  pushHistory();
  ensureDimensionState();
  state.dimensions.partition[index]={
    length:partitionFullLength(p.orientation),
    height:c.height-.15,
    thickness:.075,
    elevation:0
  };
  renderAll();
  toast('Tabique restaurado a tamaño completo');
};

function bootPartitionTransform(){
  installPartitionDimensionTopStyle();
  if(typeof installDimensionEditor==='function') installDimensionEditor();
  if(selectedEditable?.type==='partition') movePartitionDimensionEditorToTop();
  rebuild3D();
}

if(document.readyState==='loading'){
  window.addEventListener('DOMContentLoaded',()=>setTimeout(bootPartitionTransform,420));
}else{
  setTimeout(bootPartitionTransform,420);
}
