// Intelligent interior partition layout for bat-kubiqueitor.
// Loaded after dimensions / dimension-panel / furniture layers.

const PARTITION_ORIENTATION={
  CROSS:'cross',     // runs across container width; moves along container length
  LONG:'long'       // runs along container length; moves across container width
};

function partitionFullLength(orientation){
  const c=DATA.containers[state.container];
  return orientation===PARTITION_ORIENTATION.LONG
    ? Math.max(.40,c.length-.14)
    : Math.max(.40,c.width-.14);
}

function ensurePartitionLayoutEntry(index){
  ensureLayoutState();
  const c=DATA.containers[state.container];
  const current=state.layout.partition[index]||{};
  const orientation=current.orientation===PARTITION_ORIENTATION.LONG?PARTITION_ORIENTATION.LONG:PARTITION_ORIENTATION.CROSS;
  if(orientation===PARTITION_ORIENTATION.CROSS){
    const fallback=-c.length/2+((index+1)*c.length/((state.counts.partition||0)+1));
    state.layout.partition[index]={...current,orientation,x:Number.isFinite(current.x)?current.x:fallback,z:0};
  }else{
    state.layout.partition[index]={...current,orientation,x:0,z:Number.isFinite(current.z)?current.z:0};
  }
  return state.layout.partition[index];
}

const actualLayoutBeforePartition=actualLayout;
actualLayout=function(type,index){
  if(type!=='partition') return actualLayoutBeforePartition(type,index);
  const entry=ensurePartitionLayoutEntry(index);
  return {orientation:entry.orientation,x:entry.x||0,z:entry.z||0};
};

// Reconfigure the partition dimension model: LENGTH + HEIGHT.
OBJECT_DIMENSIONS.partition={
  fields:[
    {key:'length',label:'Largo',min:.30,max:12.00,step:.05},
    {key:'height',label:'Alto',min:1.00,max:2.85,step:.05}
  ],
  defaults:()=>({length:partitionFullLength(PARTITION_ORIENTATION.CROSS),height:Math.max(1,DATA.containers[state.container].height-.15),thickness:.075})
};

const objectDimensionsBeforePartition=objectDimensions;
objectDimensions=function(type,index){
  if(type!=='partition') return objectDimensionsBeforePartition(type,index);
  ensureDimensionState();
  const layout=actualLayout('partition',index);
  const c=DATA.containers[state.container];
  const stored=state.dimensions.partition[index]||{};
  const legacyLength=Number.isFinite(stored.width)?stored.width:undefined;
  const maxLength=partitionFullLength(layout.orientation);
  return {
    length:clamp(Number.isFinite(stored.length)?stored.length:(legacyLength||maxLength),.30,maxLength),
    height:clamp(Number.isFinite(stored.height)?stored.height:c.height-.15,1,c.height-.06),
    thickness:Number.isFinite(stored.thickness)?stored.thickness:.075
  };
};

function createParametricPartition(length,height,thickness=.075){
  const g=new THREE.Group();
  const wall=mat(state.finish==='sanitary'?0xf8fafc:0xe9edf2,{roughness:state.finish==='sanitary'?.32:.78});
  const trim=mat(0xcbd5e1,{roughness:.45,metalness:.18});
  g.add(box(thickness,height,length,wall,0,height/2,0));
  g.add(box(thickness+.015,.065,length,trim,0,.04,0));
  g.add(box(thickness+.015,.055,length,trim,0,height-.04,0));
  return g;
}

function partitionPositionDistance(index){
  const c=DATA.containers[state.container],p=actualLayout('partition',index);
  return p.orientation===PARTITION_ORIENTATION.LONG
    ? clamp(p.z+c.width/2,0,c.width)
    : clamp(p.x+c.length/2,0,c.length);
}

function partitionPositionLabel(index){
  const p=actualLayout('partition',index);
  return p.orientation===PARTITION_ORIENTATION.LONG?'Distancia desde cara B':'Distancia desde extremo D';
}

function partitionOrientationLabel(orientation){
  return orientation===PARTITION_ORIENTATION.LONG?'A lo largo':'A lo ancho';
}

function changePartitionOrientation(orientation){
  if(!selectedEditable||selectedEditable.type!=='partition') return;
  if(![PARTITION_ORIENTATION.CROSS,PARTITION_ORIENTATION.LONG].includes(orientation)) return;
  const {index}=selectedEditable,current=actualLayout('partition',index);
  if(current.orientation===orientation) return;
  pushHistory();
  ensureLayoutState(); ensureDimensionState();
  state.layout.partition[index]=orientation===PARTITION_ORIENTATION.LONG
    ? {orientation,x:0,z:0}
    : {orientation,x:0,z:0};
  state.dimensions.partition[index]={
    length:partitionFullLength(orientation),
    height:objectDimensions('partition',index).height,
    thickness:.075
  };
  renderAll();
  toast(`Tabique ${partitionOrientationLabel(orientation).toLowerCase()}`);
}

function updatePartitionPosition(value){
  if(!selectedEditable||selectedEditable.type!=='partition') return;
  const {index}=selectedEditable,c=DATA.containers[state.container],p=actualLayout('partition',index);
  const parsed=Number(value);
  if(!Number.isFinite(parsed)) return toast('Ingresa una distancia válida');
  pushHistory();
  ensureLayoutState();
  if(p.orientation===PARTITION_ORIENTATION.LONG){
    const distance=clamp(parsed,.08,c.width-.08);
    state.layout.partition[index]={...state.layout.partition[index],orientation:p.orientation,x:0,z:distance-c.width/2};
  }else{
    const distance=clamp(parsed,.08,c.length-.08);
    state.layout.partition[index]={...state.layout.partition[index],orientation:p.orientation,x:distance-c.length/2,z:0};
  }
  renderAll();
  toast('Ubicación del tabique actualizada');
}

function updatePartitionDimension(key,value){
  if(!selectedEditable||selectedEditable.type!=='partition') return;
  const {index}=selectedEditable,p=actualLayout('partition',index),c=DATA.containers[state.container];
  const current=objectDimensions('partition',index),parsed=Number(value);
  if(!Number.isFinite(parsed)) return toast('Ingresa una medida válida');
  const next={...current};
  if(key==='length') next.length=clamp(parsed,.30,partitionFullLength(p.orientation));
  else if(key==='height') next.height=clamp(parsed,1,c.height-.06);
  else return;
  next[key]=Math.round(next[key]*100)/100;
  pushHistory();
  ensureDimensionState();
  state.dimensions.partition[index]=next;
  renderAll();
  toast(`${key==='length'?'Largo':'Alto'}: ${next[key].toFixed(2)} m`);
}

const updateSelectedDimensionBeforePartition=updateSelectedDimension;
updateSelectedDimension=function(key,value){
  if(selectedEditable?.type==='partition') return updatePartitionDimension(key,value);
  return updateSelectedDimensionBeforePartition(key,value);
};

const resetSelectedDimensionsBeforePartition=resetSelectedDimensions;
resetSelectedDimensions=function(){
  if(selectedEditable?.type!=='partition') return resetSelectedDimensionsBeforePartition();
  const {index}=selectedEditable,p=actualLayout('partition',index),c=DATA.containers[state.container];
  pushHistory(); ensureDimensionState();
  state.dimensions.partition[index]={length:partitionFullLength(p.orientation),height:c.height-.15,thickness:.075};
  renderAll();
  toast('Medidas del tabique restauradas');
};

const renderDimensionEditorBeforePartition=renderDimensionEditor;
renderDimensionEditor=function(type,index){
  if(type!=='partition') return renderDimensionEditorBeforePartition(type,index);
  const editor=document.getElementById('dimension-editor'); if(!editor) return;
  const p=actualLayout('partition',index),dims=objectDimensions('partition',index),c=DATA.containers[state.container];
  editor.classList.remove('hidden');
  const fields=editor.querySelector('[data-dimension-fields]');
  fields.innerHTML=`
    <label class="dimension-field"><span>Largo</span><div class="dimension-input-wrap"><input class="dimension-input-prominent" type="number" inputmode="decimal" min="0.30" max="${partitionFullLength(p.orientation).toFixed(2)}" step="0.05" value="${dims.length.toFixed(2)}" onchange="updatePartitionDimension('length',this.value)"><small>m</small></div></label>
    <label class="dimension-field"><span>Alto</span><div class="dimension-input-wrap"><input class="dimension-input-prominent" type="number" inputmode="decimal" min="1.00" max="${(c.height-.06).toFixed(2)}" step="0.05" value="${dims.height.toFixed(2)}" onchange="updatePartitionDimension('height',this.value)"><small>m</small></div></label>`;
};

if(typeof dimensionSummaryText==='function'){
  const dimensionSummaryTextBeforePartition=dimensionSummaryText;
  dimensionSummaryText=function(type,index){
    if(type!=='partition') return dimensionSummaryTextBeforePartition(type,index);
    const d=objectDimensions('partition',index);
    return `${d.length.toFixed(2)} m × ${d.height.toFixed(2)} m`;
  };
}
if(typeof dimensionSummaryLabels==='function'){
  const dimensionSummaryLabelsBeforePartition=dimensionSummaryLabels;
  dimensionSummaryLabels=function(type){
    if(type!=='partition') return dimensionSummaryLabelsBeforePartition(type);
    return 'LARGO × ALTO';
  };
}

function ensurePartitionEditor(){
  const panel=document.getElementById('object-editor');
  if(!panel) return null;
  let block=document.getElementById('partition-layout-editor');
  if(block) return block;
  block=document.createElement('div');
  block.id='partition-layout-editor';
  block.className='hidden mt-3 rounded-xl bg-white/5 border border-white/10 p-3';
  block.innerHTML=`
    <div class="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-2">Orientación del tabique</div>
    <div class="partition-orientation-grid">
      <button type="button" data-partition-orientation="cross" onclick="changePartitionOrientation('cross')"><i class="fa-solid fa-arrows-left-right"></i><span>A lo ancho</span></button>
      <button type="button" data-partition-orientation="long" onclick="changePartitionOrientation('long')"><i class="fa-solid fa-arrows-up-down"></i><span>A lo largo</span></button>
    </div>
    <label class="partition-position-field mt-3 block">
      <span id="partition-position-label">Distancia</span>
      <div class="dimension-input-wrap"><input id="partition-position-input" type="number" inputmode="decimal" min="0" step="0.05" onchange="updatePartitionPosition(this.value)"><small>m</small></div>
    </label>`;
  const dimensions=document.getElementById('dimension-editor');
  if(dimensions) panel.insertBefore(block,dimensions); else panel.appendChild(block);

  if(!document.getElementById('partition-layout-style')){
    const style=document.createElement('style'); style.id='partition-layout-style';
    style.textContent=`
      .partition-orientation-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.partition-orientation-grid button{display:flex;align-items:center;justify-content:center;gap:7px;padding:10px 6px;border-radius:10px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.07);color:#cbd5e1;font-size:11px;font-weight:800}.partition-orientation-grid button.active{background:#f59e0b;color:#0f172a;border-color:#fbbf24}.partition-position-field>span{display:block;font-size:10px;font-weight:800;color:#cbd5e1;margin-bottom:5px}`;
    document.head.appendChild(style);
  }
  return block;
}

function renderPartitionEditor(index){
  const block=ensurePartitionEditor(); if(!block) return;
  const p=actualLayout('partition',index),c=DATA.containers[state.container];
  block.classList.remove('hidden');
  block.querySelectorAll('[data-partition-orientation]').forEach(btn=>btn.classList.toggle('active',btn.dataset.partitionOrientation===p.orientation));
  const label=document.getElementById('partition-position-label'); if(label) label.textContent=partitionPositionLabel(index);
  const input=document.getElementById('partition-position-input');
  if(input){
    input.max=(p.orientation===PARTITION_ORIENTATION.LONG?c.width:c.length).toFixed(2);
    input.value=partitionPositionDistance(index).toFixed(2);
  }
}

const showEditorPanelBeforePartition=showEditorPanel;
showEditorPanel=function(root){
  showEditorPanelBeforePartition(root);
  const block=ensurePartitionEditor();
  if(!root){ block?.classList.add('hidden'); return; }
  const meta=root.userData.editor;
  if(meta.type==='partition'){
    renderPartitionEditor(meta.index);
    renderDimensionEditor('partition',meta.index);
    const subtitle=document.getElementById('editor-subtitle');
    const p=actualLayout('partition',meta.index);
    if(subtitle) subtitle.textContent=`Elemento ${meta.index+1} · ${partitionOrientationLabel(p.orientation)} · ${partitionPositionLabel(meta.index)} ${partitionPositionDistance(meta.index).toFixed(2)} m`;
  }else block?.classList.add('hidden');
};

const hideEditorPanelBeforePartition=hideEditorPanel;
hideEditorPanel=function(){
  hideEditorPanelBeforePartition();
  document.getElementById('partition-layout-editor')?.classList.add('hidden');
};

function disposePartitionRoot(root){
  root.traverse(obj=>{
    obj.geometry?.dispose?.();
    if(Array.isArray(obj.material)) obj.material.forEach(m=>m?.dispose?.());
    else obj.material?.dispose?.();
  });
  root.parent?.remove(root);
}

function rebuildParametricPartitions(){
  if(!containerGroup) return;
  ensureLayoutState(); ensureDimensionState();

  const oldPartitions=editableObjects.filter(root=>root.userData.editor?.type==='partition');
  oldPartitions.forEach(disposePartitionRoot);
  editableObjects=editableObjects.filter(root=>root.userData.editor?.type!=='partition');

  for(let i=0;i<(state.counts.partition||0);i++){
    const p=actualLayout('partition',i),d=objectDimensions('partition',i);
    const obj=createParametricPartition(d.length,d.height,d.thickness);
    if(p.orientation===PARTITION_ORIENTATION.LONG){
      addGroup(containerGroup,obj,0,.08,p.z,Math.PI/2);
      registerEditable(obj,'partition',i,{axis:'z',surface:'floor',orientation:p.orientation});
    }else{
      addGroup(containerGroup,obj,p.x,.08,0,0);
      registerEditable(obj,'partition',i,{axis:'x',surface:'floor',orientation:p.orientation});
    }
  }

  if(selectedEditable?.type==='partition'){
    const root=editableObjects.find(o=>o.userData.editor?.type==='partition'&&o.userData.editor?.index===selectedEditable.index);
    if(root){ addSelectionOutline(root); showEditorPanel(root); }
  }
}

const rebuild3DBeforePartition=rebuild3D;
rebuild3D=function(){
  rebuild3DBeforePartition();
  rebuildParametricPartitions();
};

const validCandidateBeforePartition=validCandidate;
validCandidate=function(type,index,candidate){
  if(type!=='partition') return validCandidateBeforePartition(type,index,candidate);
  const c=DATA.containers[state.container],p=actualLayout('partition',index),orientation=candidate.orientation||p.orientation;
  if(orientation===PARTITION_ORIENTATION.LONG){
    const z=Number.isFinite(candidate.z)?candidate.z:p.z;
    return z>=-c.width/2+.08&&z<=c.width/2-.08;
  }
  const x=Number.isFinite(candidate.x)?candidate.x:p.x;
  return x>=-c.length/2+.08&&x<=c.length/2-.08;
};

const nudgeSelectedBeforePartition=nudgeSelected;
nudgeSelected=function(dx=0,dz=0){
  if(selectedEditable?.type!=='partition') return nudgeSelectedBeforePartition(dx,dz);
  const {index}=selectedEditable,p=actualLayout('partition',index),candidate={...p};
  if(p.orientation===PARTITION_ORIENTATION.LONG) candidate.z=Math.round((p.z+dx)*100)/100;
  else candidate.x=Math.round((p.x+dx)*100)/100;
  if(!validCandidate('partition',index,candidate)) return toast('El tabique llegó al límite interior');
  pushHistory(); ensureLayoutState(); state.layout.partition[index]=candidate; renderAll();
};

const pointerMoveBeforePartition=onEditorPointerMove;
onEditorPointerMove=function(event){
  if(draggingEditable?.userData.editor?.type!=='partition') return pointerMoveBeforePartition(event);
  pointerNDC(event); editorRaycaster.setFromCamera(editorPointer,camera);
  const point=new THREE.Vector3(); if(!editorRaycaster.ray.intersectPlane(dragPlane,point)) return;
  const {index}=draggingEditable.userData.editor,p=actualLayout('partition',index),candidate={...p};
  if(p.orientation===PARTITION_ORIENTATION.LONG) candidate.z=Math.round(point.z*20)/20;
  else candidate.x=Math.round(point.x*20)/20;
  if(!validCandidate('partition',index,candidate)) return;
  dragMoved=true; ensureLayoutState(); state.layout.partition[index]=candidate;
  if(p.orientation===PARTITION_ORIENTATION.LONG) draggingEditable.position.z=candidate.z;
  else draggingEditable.position.x=candidate.x;
  const subtitle=document.getElementById('editor-subtitle');
  if(subtitle) subtitle.textContent=`Elemento ${index+1} · ${partitionOrientationLabel(p.orientation)} · ${partitionPositionLabel(index)} ${partitionPositionDistance(index).toFixed(2)} m`;
  const input=document.getElementById('partition-position-input'); if(input) input.value=partitionPositionDistance(index).toFixed(2);
};

function reconnectPartitionPointerMove(){
  const canvas=renderer?.domElement; if(!canvas) return;
  canvas.removeEventListener('pointermove',pointerMoveBeforePartition);
  canvas.removeEventListener('pointermove',onEditorPointerMove);
  canvas.addEventListener('pointermove',onEditorPointerMove);
}

function bootPartitionLayout(){
  ensurePartitionEditor();
  reconnectPartitionPointerMove();
  rebuild3D();
}

if(document.readyState==='loading') window.addEventListener('DOMContentLoaded',()=>setTimeout(bootPartitionLayout,220));
else setTimeout(bootPartitionLayout,220);
