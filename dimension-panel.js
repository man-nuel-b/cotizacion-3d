// Prominent dimension UI for bat-kubiqueitor.
// Loaded after dimensions.js.

function dimensionSummaryText(type,index){
  if(typeof supportsDimensions!=='function'||!supportsDimensions(type)) return '';
  const dims=objectDimensions(type,index);
  if(type==='window'||type==='door'||type==='partition'||type==='ac'){
    return `${Number(dims.width).toFixed(2)} m × ${Number(dims.height).toFixed(2)} m`;
  }
  if(type==='wc'||type==='sink'){
    return `${Number(dims.width).toFixed(2)} m × ${Number(dims.depth).toFixed(2)} m`;
  }
  if(type==='shower'){
    return `${Number(dims.width).toFixed(2)} m × ${Number(dims.depth).toFixed(2)} m × ${Number(dims.height).toFixed(2)} m`;
  }
  return '';
}

function dimensionSummaryLabels(type){
  if(type==='window'||type==='door'||type==='partition'||type==='ac') return 'ANCHO × ALTO';
  if(type==='wc'||type==='sink') return 'ANCHO × FONDO';
  if(type==='shower') return 'ANCHO × FONDO × ALTO';
  return 'MEDIDAS';
}

function ensureDimensionSummary(){
  const panel=document.getElementById('object-editor');
  const subtitle=document.getElementById('editor-subtitle');
  if(!panel||!subtitle) return null;
  let summary=document.getElementById('dimension-summary');
  if(!summary){
    summary=document.createElement('div');
    summary.id='dimension-summary';
    summary.className='hidden dimension-summary-card';
    subtitle.insertAdjacentElement('afterend',summary);
  }
  return summary;
}

function moveDimensionEditorUp(){
  const panel=document.getElementById('object-editor');
  const editor=document.getElementById('dimension-editor');
  if(!panel||!editor) return;
  const faceEditor=document.getElementById('mounted-face-editor');
  if(faceEditor&&editor.nextElementSibling!==faceEditor){
    panel.insertBefore(editor,faceEditor);
    return;
  }
  const deleteBtn=panel.querySelector('button[onclick*="deleteSelectedObject"]');
  if(!faceEditor&&deleteBtn&&editor.nextElementSibling!==deleteBtn) panel.insertBefore(editor,deleteBtn);
}

function renderProminentDimensionSummary(type,index){
  const summary=ensureDimensionSummary();
  if(!summary) return;
  if(typeof supportsDimensions!=='function'||!supportsDimensions(type)){
    summary.classList.add('hidden');
    return;
  }
  summary.classList.remove('hidden');
  summary.innerHTML=`
    <div class="dimension-summary-label">${dimensionSummaryLabels(type)}</div>
    <div class="dimension-summary-value">${dimensionSummaryText(type,index)}</div>`;
}

function enhanceDimensionFields(type,index){
  const editor=document.getElementById('dimension-editor');
  if(!editor) return;
  moveDimensionEditorUp();

  const heading=editor.querySelector('.text-slate-400');
  if(heading) heading.textContent='DIMENSIONES';
  const help=editor.querySelector('.text-slate-500');
  if(help) help.textContent='Modifica las medidas reales del objeto';

  editor.querySelectorAll('.dimension-field').forEach(field=>{
    const label=field.querySelector(':scope > span');
    const input=field.querySelector('input');
    if(label) label.classList.add('dimension-field-label-prominent');
    if(input) input.classList.add('dimension-input-prominent');
  });
}

const prominentPanelShowBefore=showEditorPanel;
showEditorPanel=function(root){
  prominentPanelShowBefore(root);
  if(!root) return;
  const meta=root.userData.editor;
  if(typeof installDimensionEditor==='function') installDimensionEditor();
  if(typeof renderDimensionEditor==='function') renderDimensionEditor(meta.type,meta.index);
  renderProminentDimensionSummary(meta.type,meta.index);
  enhanceDimensionFields(meta.type,meta.index);
};

const prominentUpdateDimensionBefore=updateSelectedDimension;
updateSelectedDimension=function(key,value){
  prominentUpdateDimensionBefore(key,value);
  if(selectedEditable){
    const {type,index}=selectedEditable;
    setTimeout(()=>{
      renderProminentDimensionSummary(type,index);
      enhanceDimensionFields(type,index);
    },0);
  }
};

const prominentResetDimensionsBefore=resetSelectedDimensions;
resetSelectedDimensions=function(){
  prominentResetDimensionsBefore();
  if(selectedEditable){
    const {type,index}=selectedEditable;
    setTimeout(()=>{
      renderProminentDimensionSummary(type,index);
      enhanceDimensionFields(type,index);
    },0);
  }
};

const prominentHidePanelBefore=hideEditorPanel;
hideEditorPanel=function(){
  prominentHidePanelBefore();
  document.getElementById('dimension-summary')?.classList.add('hidden');
};

function installProminentDimensionStyles(){
  if(document.getElementById('prominent-dimension-style')) return;
  const style=document.createElement('style');
  style.id='prominent-dimension-style';
  style.textContent=`
    .dimension-summary-card{margin-top:10px;padding:10px 12px;border-radius:12px;background:rgba(245,158,11,.10);border:1px solid rgba(245,158,11,.28)}
    .dimension-summary-label{font-size:9px;font-weight:900;letter-spacing:.13em;color:#fbbf24;margin-bottom:3px}
    .dimension-summary-value{font-size:18px;line-height:1.15;font-weight:900;color:#fff;font-variant-numeric:tabular-nums}
    #dimension-editor{margin-top:10px!important;background:rgba(255,255,255,.055)!important;border-color:rgba(245,158,11,.22)!important}
    .dimension-field-label-prominent{font-size:11px!important;color:#e2e8f0!important}
    .dimension-input-prominent{font-size:15px!important;padding:10px 8px!important;font-variant-numeric:tabular-nums}
  `;
  document.head.appendChild(style);
}

function bootProminentDimensions(){
  installProminentDimensionStyles();
  if(typeof installDimensionEditor==='function') installDimensionEditor();
  moveDimensionEditorUp();
}

if(document.readyState==='loading'){
  window.addEventListener('DOMContentLoaded',()=>setTimeout(bootProminentDimensions,150));
}else{
  setTimeout(bootProminentDimensions,150);
}
