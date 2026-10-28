// Duplicate/copy-paste workflow for interior partitions.
// Loaded after partition transform, wall anchoring and interior systems.

(function(){
  let partitionClipboard=null;
  const COPY_OFFSET=.35;
  const PRODUCTIVITY_ASSET_VERSION='20261028-critical-1';
  const productivityAsset=name=>`${name}?v=${PRODUCTIVITY_ASSET_VERSION}`;

  function loadFinalProductivityTools(){
    if(!document.querySelector('script[data-framing-visuals]')){
      const framing=document.createElement('script');
      framing.src=productivityAsset('framing-visuals.js');
      framing.dataset.framingVisuals='true';
      document.body.appendChild(framing);
    }
    if(!document.querySelector('script[data-apu-price-master]')){
      const apu=document.createElement('script');
      apu.src=productivityAsset('apu-price-master.js');
      apu.dataset.apuPriceMaster='true';
      document.body.appendChild(apu);
    }
    if(!document.querySelector('script[data-multi-select-copy]')){
      const multi=document.createElement('script');
      multi.src=productivityAsset('multi-select-copy.js');
      multi.dataset.multiSelectCopy='true';
      document.body.appendChild(multi);
    }
  }

  function ready(){
    return typeof state!=='undefined'&&typeof DATA!=='undefined'&&typeof actualLayout==='function'&&
      typeof objectDimensions==='function'&&typeof ensureLayoutState==='function'&&
      typeof ensureDimensionState==='function'&&typeof renderAll==='function'&&
      typeof PARTITION_ORIENTATION!=='undefined';
  }

  function snapshotPartition(index){
    ensureLayoutState();
    ensureDimensionState();
    const p=actualLayout('partition',index);
    const stored=state.layout.partition[index]||{};
    const dims=objectDimensions('partition',index);
    return {
      layout:{
        ...clone(stored),
        orientation:p.orientation,
        x:Number.isFinite(p.x)?p.x:0,
        z:Number.isFinite(p.z)?p.z:0,
        axisCenter:Number.isFinite(stored.axisCenter)?stored.axisCenter:0,
        anchorFace:stored.anchorFace||null,
        joints:[]
      },
      dimensions:clone(dims),
      interiorDoor:Array.isArray(state.interiorDoors)&&state.interiorDoors[index]?clone(state.interiorDoors[index]):null
    };
  }

  function partitionPerpCoordinate(layout){
    return layout.orientation===PARTITION_ORIENTATION.LONG?(Number(layout.z)||0):(Number(layout.x)||0);
  }

  function availableBounds(layout,dims){
    if(typeof perpendicularPositionBounds==='function') return perpendicularPositionBounds(layout.orientation,dims.thickness||.075);
    const c=DATA.containers[state.container],half=(dims.thickness||.075)/2;
    if(layout.orientation===PARTITION_ORIENTATION.LONG) return {min:-c.width/2+.08+half,max:c.width/2-.08-half};
    return {min:-c.length/2+.08+half,max:c.length/2-.08-half};
  }

  function coordinateIsFree(orientation,coord){
    for(let i=0;i<(state.counts.partition||0);i++){
      const p=actualLayout('partition',i);
      if(p.orientation!==orientation) continue;
      const other=orientation===PARTITION_ORIENTATION.LONG?(Number(p.z)||0):(Number(p.x)||0);
      if(Math.abs(other-coord)<.18) return false;
    }
    return true;
  }

  function shiftedCoordinate(layout,dims,pasteNumber=1){
    const b=availableBounds(layout,dims),base=partitionPerpCoordinate(layout);
    const distances=[];
    for(let n=Math.max(1,pasteNumber);n<=Math.max(1,pasteNumber)+8;n++) distances.push(COPY_OFFSET*n);
    for(const distance of distances){
      for(const sign of [1,-1]){
        const value=Math.round((base+distance*sign)*20)/20;
        if(value<b.min||value>b.max) continue;
        if(coordinateIsFree(layout.orientation,value)) return value;
      }
    }
    return null;
  }

  function insertPartition(snapshot,pasteNumber=1){
    if(!snapshot) return;
    const max=DATA.extras.partition?.max||6;
    if((state.counts.partition||0)>=max) return toast(`Llegaste al máximo de ${max} divisiones interiores`);

    const nextLayout=clone(snapshot.layout),nextDims=clone(snapshot.dimensions);
    const coord=shiftedCoordinate(nextLayout,nextDims,pasteNumber);
    if(coord===null) return toast('No queda espacio libre para duplicar este tabique');

    pushHistory();
    ensureLayoutState();
    ensureDimensionState();
    const newIndex=state.counts.partition||0;
    state.counts.partition=newIndex+1;

    nextLayout.joints=[];
    if(nextLayout.orientation===PARTITION_ORIENTATION.LONG){
      nextLayout.z=coord;
      if(!Number.isFinite(nextLayout.x)) nextLayout.x=0;
    }else{
      nextLayout.x=coord;
      if(!Number.isFinite(nextLayout.z)) nextLayout.z=0;
    }
    state.layout.partition[newIndex]=nextLayout;
    state.dimensions.partition[newIndex]=nextDims;

    if(Array.isArray(state.interiorDoors)) state.interiorDoors[newIndex]=snapshot.interiorDoor?clone(snapshot.interiorDoor):null;
    if(typeof normalizePartitionInsideContainer==='function') normalizePartitionInsideContainer(newIndex);

    selectedEditable={type:'partition',index:newIndex};
    renderAll();
    toast('División interior duplicada');
  }

  window.copySelectedPartition=function(){
    if(!selectedEditable||selectedEditable.type!=='partition') return toast('Selecciona una división interior');
    partitionClipboard=snapshotPartition(selectedEditable.index);
    partitionClipboard.pasteCount=0;
    toast('División copiada · usa Ctrl+V para pegar');
  };

  window.pasteCopiedPartition=function(){
    if(!partitionClipboard) return toast('Primero copia una división interior');
    partitionClipboard.pasteCount=(partitionClipboard.pasteCount||0)+1;
    insertPartition(partitionClipboard,partitionClipboard.pasteCount);
  };

  window.duplicateSelectedPartition=function(){
    if(!selectedEditable||selectedEditable.type!=='partition') return toast('Selecciona una división interior');
    insertPartition(snapshotPartition(selectedEditable.index),1);
  };

  function renderDuplicateButton(root){
    const panel=document.getElementById('object-editor');
    if(!panel) return;
    let action=document.getElementById('partition-duplicate-action');
    if(root?.userData.editor?.type!=='partition'){
      action?.remove();
      return;
    }
    if(!action){
      action=document.createElement('div');
      action.id='partition-duplicate-action';
      action.className='mt-3 grid grid-cols-2 gap-2';
      const deleteBtn=panel.querySelector('button[onclick*="deleteSelectedObject"]');
      if(deleteBtn) panel.insertBefore(action,deleteBtn); else panel.appendChild(action);
    }
    action.innerHTML=`
      <button type="button" onclick="duplicateSelectedPartition()" class="rounded-xl bg-amber-500 text-slate-950 py-2 text-xs font-black"><i class="fa-solid fa-copy mr-1"></i> Duplicar</button>
      <button type="button" onclick="copySelectedPartition()" class="rounded-xl bg-white/10 border border-white/10 text-slate-100 py-2 text-xs font-bold"><i class="fa-regular fa-copy mr-1"></i> Copiar</button>
      <div class="col-span-2 text-[9px] text-slate-500 text-center">Ctrl+C · Ctrl+V</div>`;
  }

  const showEditorPanelBeforeDuplicate=showEditorPanel;
  showEditorPanel=function(root){
    showEditorPanelBeforeDuplicate(root);
    renderDuplicateButton(root);
  };

  document.addEventListener('keydown',event=>{
    const target=event.target;
    if(target?.closest?.('input,textarea,select,[contenteditable="true"]')) return;
    if(!(event.ctrlKey||event.metaKey)) return;
    const key=event.key.toLowerCase();
    if(key==='c'&&selectedEditable?.type==='partition'){
      event.preventDefault();
      copySelectedPartition();
    }else if(key==='v'&&partitionClipboard){
      event.preventDefault();
      pasteCopiedPartition();
    }
  });

  function boot(){
    if(!ready()) return false;
    if(selectedEditable?.type==='partition'){
      const root=editableObjects.find(o=>o.userData.editor?.type==='partition'&&o.userData.editor?.index===selectedEditable.index);
      if(root) renderDuplicateButton(root);
    }
    window.BAT_KUBIQUEITOR_PARTITION_DUPLICATE=true;
    setTimeout(loadFinalProductivityTools,20);
    return true;
  }

  if(!boot()){
    let tries=0;
    const timer=setInterval(()=>{
      tries++;
      if(boot()||tries>60) clearInterval(timer);
    },100);
  }
})();