// Complete dimension controls for interior partitions.
// Loaded after partition bounds so each partition can edit size as well as position.

const objectDimensionsBeforePartitionEnhancement=objectDimensions;
objectDimensions=function(type,index){
  const dims=objectDimensionsBeforePartitionEnhancement(type,index);
  if(type!=='partition') return dims;
  return {
    ...dims,
    length:Math.round(clamp(Number(dims.length)||.30,.30,partitionFullLength(actualLayout('partition',index).orientation))*100)/100,
    height:Math.round(clamp(Number(dims.height)||1,1,DATA.containers[state.container].height-.06)*100)/100,
    thickness:Math.round(clamp(Number(dims.thickness)||.075,.05,.20)*1000)/1000
  };
};

OBJECT_DIMENSIONS.partition={
  fields:[
    {key:'length',label:'Largo',min:.30,max:12.00,step:.05},
    {key:'height',label:'Alto',min:1.00,max:2.85,step:.05},
    {key:'thickness',label:'Espesor',min:.05,max:.20,step:.005}
  ],
  defaults:()=>({
    length:partitionFullLength(PARTITION_ORIENTATION.CROSS),
    height:Math.max(1,DATA.containers[state.container].height-.15),
    thickness:.075
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
  if(key==='length') next.length=clamp(parsed,.30,partitionFullLength(p.orientation));
  else if(key==='height') next.height=clamp(parsed,1,c.height-.06);
  else if(key==='thickness') next.thickness=clamp(parsed,.05,.20);
  else return;

  next.length=Math.round(next.length*100)/100;
  next.height=Math.round(next.height*100)/100;
  next.thickness=Math.round(next.thickness*1000)/1000;

  pushHistory();
  ensureDimensionState();
  state.dimensions.partition[index]=next;
  if(typeof normalizePartitionInsideContainer==='function') normalizePartitionInsideContainer(index);
  renderAll();

  const labels={length:'Largo',height:'Alto',thickness:'Espesor'};
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
  const p=actualLayout('partition',index),dims=objectDimensions('partition',index),c=DATA.containers[state.container];
  editor.classList.remove('hidden');
  const heading=editor.querySelector('.text-slate-400');
  if(heading) heading.textContent='DIMENSIONES DEL TABIQUE';
  const help=editor.querySelector('.text-slate-500');
  if(help) help.textContent='Ajusta tamaño real además de su ubicación';
  const fields=editor.querySelector('[data-dimension-fields]');
  if(!fields) return;
  fields.className='grid grid-cols-2 gap-2';
  fields.innerHTML=`
    <label class="dimension-field"><span>Largo</span><div class="dimension-input-wrap"><input class="dimension-input-prominent" type="number" inputmode="decimal" min="0.30" max="${partitionFullLength(p.orientation).toFixed(2)}" step="0.05" value="${dims.length.toFixed(2)}" onchange="updatePartitionDimension('length',this.value)"><small>m</small></div></label>
    <label class="dimension-field"><span>Alto</span><div class="dimension-input-wrap"><input class="dimension-input-prominent" type="number" inputmode="decimal" min="1.00" max="${(c.height-.06).toFixed(2)}" step="0.05" value="${dims.height.toFixed(2)}" onchange="updatePartitionDimension('height',this.value)"><small>m</small></div></label>
    <label class="dimension-field col-span-2"><span>Espesor</span><div class="dimension-input-wrap"><input class="dimension-input-prominent" type="number" inputmode="decimal" min="0.05" max="0.20" step="0.005" value="${dims.thickness.toFixed(3)}" onchange="updatePartitionDimension('thickness',this.value)"><small>m</small></div></label>`;
};

if(typeof dimensionSummaryText==='function'){
  const dimensionSummaryTextBeforePartitionEnhancement=dimensionSummaryText;
  dimensionSummaryText=function(type,index){
    if(type!=='partition') return dimensionSummaryTextBeforePartitionEnhancement(type,index);
    const d=objectDimensions('partition',index);
    return `${d.length.toFixed(2)} m × ${d.height.toFixed(2)} m × ${d.thickness.toFixed(3)} m`;
  };
}

if(typeof dimensionSummaryLabels==='function'){
  const dimensionSummaryLabelsBeforePartitionEnhancement=dimensionSummaryLabels;
  dimensionSummaryLabels=function(type){
    if(type!=='partition') return dimensionSummaryLabelsBeforePartitionEnhancement(type);
    return 'LARGO × ALTO × ESPESOR';
  };
}

const showEditorPanelBeforePartitionEnhancement=showEditorPanel;
showEditorPanel=function(root){
  showEditorPanelBeforePartitionEnhancement(root);
  if(root?.userData.editor?.type==='partition'){
    const index=root.userData.editor.index;
    renderDimensionEditor('partition',index);
    if(typeof renderProminentDimensionSummary==='function') renderProminentDimensionSummary('partition',index);
  }
};

function bootEnhancedPartitionDimensions(){
  if(typeof installDimensionEditor==='function') installDimensionEditor();
  if(selectedEditable?.type==='partition'){
    renderDimensionEditor('partition',selectedEditable.index);
    if(typeof renderProminentDimensionSummary==='function') renderProminentDimensionSummary('partition',selectedEditable.index);
  }
  rebuild3D();
}

if(document.readyState==='loading'){
  window.addEventListener('DOMContentLoaded',()=>setTimeout(bootEnhancedPartitionDimensions,380));
}else{
  setTimeout(bootEnhancedPartitionDimensions,380);
}
