// Shift multi-selection + grouped copy/paste for bat-kubiqueitor.
// Keeps the existing single-object editor intact and adds an independent selection set.

(function(){
  const COPY_STEP=.30;
  const SEARCH_STEPS=28;
  let multiSelection=[];
  let clipboard=[];
  let pasteCount=0;

  function keyOf(meta){ return `${meta.type}:${meta.index}`; }
  function has(meta){ const key=keyOf(meta); return multiSelection.some(item=>keyOf(item)===key); }
  function rootFor(meta){ return editableObjects.find(root=>root.userData.editor?.type===meta.type&&root.userData.editor?.index===meta.index)||null; }

  function addMultiOutline(root){
    if(!root) return;
    root.children.filter(child=>child.userData?.multiSelectionHelper).forEach(child=>root.remove(child));
    const bounds=new THREE.Box3().setFromObject(root); if(bounds.isEmpty()) return;
    const size=new THREE.Vector3(),center=new THREE.Vector3(); bounds.getSize(size); bounds.getCenter(center);
    const localCenter=root.worldToLocal(center.clone());
    const geo=new THREE.BoxGeometry(Math.max(.12,size.x+.11),Math.max(.12,size.y+.11),Math.max(.12,size.z+.11));
    const edges=new THREE.EdgesGeometry(geo); geo.dispose();
    const line=new THREE.LineSegments(edges,new THREE.LineBasicMaterial({color:0x38bdf8,depthTest:false,transparent:true,opacity:1}));
    line.position.copy(localCenter); line.renderOrder=1000; line.userData.multiSelectionHelper=true; root.add(line);
  }

  function clearMultiOutlines(){
    editableObjects.forEach(root=>{
      root.children.filter(child=>child.userData?.multiSelectionHelper).forEach(helper=>{
        root.remove(helper); helper.geometry?.dispose?.(); helper.material?.dispose?.();
      });
    });
  }

  function renderMultiOutlines(){
    clearMultiOutlines();
    multiSelection=multiSelection.filter(meta=>!!rootFor(meta));
    multiSelection.forEach(meta=>addMultiOutline(rootFor(meta)));
    renderGroupPanel();
  }

  function renderGroupPanel(){
    let panel=document.getElementById('multi-selection-panel');
    if(!multiSelection.length){ panel?.remove(); return; }
    if(!panel){
      panel=document.createElement('div');
      panel.id='multi-selection-panel';
      panel.className='absolute z-30 right-4 top-20 rounded-2xl bg-slate-950/92 border border-sky-400/30 text-white shadow-2xl backdrop-blur-xl p-3 w-56';
      document.querySelector('.viewer-wrap')?.appendChild(panel);
    }
    panel.innerHTML=`
      <div class="flex items-center justify-between gap-2"><div><div class="text-[9px] uppercase tracking-widest font-black text-sky-400">Selección múltiple</div><div class="text-sm font-black mt-0.5">${multiSelection.length} objeto${multiSelection.length===1?'':'s'}</div></div><button onclick="clearMultiSelection()" class="w-7 h-7 rounded-lg bg-white/10"><i class="fa-solid fa-xmark"></i></button></div>
      <div class="grid grid-cols-2 gap-2 mt-3"><button onclick="copyMultiSelection()" class="rounded-lg bg-sky-500 text-slate-950 py-2 text-xs font-black"><i class="fa-solid fa-copy mr-1"></i> Copiar</button><button onclick="duplicateMultiSelection()" class="rounded-lg bg-white/10 py-2 text-xs font-bold">Duplicar</button></div>
      <button onclick="deleteMultiSelection()" class="mt-2 w-full rounded-lg bg-red-500/15 border border-red-400/20 text-red-200 py-2 text-xs font-bold"><i class="fa-solid fa-trash mr-1"></i> Eliminar selección</button>
      <div class="text-[9px] text-slate-400 mt-2 text-center">Clic primero · Shift + clic para sumar/quitar · Ctrl+C / Ctrl+V · Ctrl+D</div>`;
  }

  window.clearMultiSelection=function(){
    multiSelection=[];
    clearMultiOutlines();
    renderGroupPanel();
  };

  function toggleMeta(meta){
    const key=keyOf(meta),idx=multiSelection.findIndex(item=>keyOf(item)===key);
    if(idx>=0) multiSelection.splice(idx,1); else multiSelection.push({type:meta.type,index:meta.index});
    renderMultiOutlines();
  }

  function snapshotObject(meta){
    ensureLayoutState();
    if(typeof ensureDimensionState==='function') ensureDimensionState();
    const layout=clone(state.layout?.[meta.type]?.[meta.index]||actualLayout(meta.type,meta.index)||{});
    const dimensions=(typeof objectDimensions==='function'&&typeof supportsDimensions==='function'&&supportsDimensions(meta.type))?clone(objectDimensions(meta.type,meta.index)):null;
    const extra={};
    if(meta.type==='partition'&&Array.isArray(state.interiorDoors)&&state.interiorDoors[meta.index]) extra.interiorDoor=clone(state.interiorDoors[meta.index]);
    return {type:meta.type,layout,dimensions,extra};
  }

  function withProvisionalDimensions(type,index,dims,fn){
    if(!dims||typeof ensureDimensionState!=='function'||typeof supportsDimensions!=='function'||!supportsDimensions(type)) return fn();
    ensureDimensionState();
    if(!Array.isArray(state.dimensions[type])) state.dimensions[type]=[];
    const arr=state.dimensions[type],oldLength=arr.length,previous=arr[index],had=index<oldLength;
    arr[index]=clone(dims);
    try{return fn();}
    finally{
      if(had) arr[index]=previous;
      arr.length=oldLength;
    }
  }

  function partitionCoordinateFree(orientation,value){
    for(let i=0;i<(state.counts.partition||0);i++){
      const p=actualLayout('partition',i);
      if(p.orientation!==orientation) continue;
      const other=orientation===PARTITION_ORIENTATION.LONG?(Number(p.z)||0):(Number(p.x)||0);
      if(Math.abs(other-value)<.18) return false;
    }
    return true;
  }

  function candidateFor(snapshot,attempt){
    const type=snapshot.type,c=DATA.containers[state.container],layout=clone(snapshot.layout||{});
    const start=Math.max(1,attempt);

    if(type==='partition'){
      const orientation=layout.orientation||PARTITION_ORIENTATION.CROSS;
      layout.orientation=orientation;
      const dims=snapshot.dimensions||{};
      const bounds=typeof perpendicularPositionBounds==='function'?perpendicularPositionBounds(orientation,dims.thickness||.075):null;
      const base=orientation===PARTITION_ORIENTATION.LONG?(Number(layout.z)||0):(Number(layout.x)||0);
      for(let step=start;step<start+SEARCH_STEPS;step++){
        const distance=COPY_STEP*step;
        for(const sign of [1,-1]){
          const value=Math.round((base+distance*sign)*20)/20;
          if(bounds&&(value<bounds.min||value>bounds.max)) continue;
          if(!partitionCoordinateFree(orientation,value)) continue;
          const candidate={...layout,joints:[]};
          if(orientation===PARTITION_ORIENTATION.LONG) candidate.z=value; else candidate.x=value;
          return candidate;
        }
      }
      return null;
    }

    if(typeof isMountedFaceType==='function'&&isMountedFaceType(type)){
      const face=layout.face||MOUNTED_FACE_TYPES[type]?.defaultFace||'A';
      const fakeIndex=state.counts[type]||0;
      return withProvisionalDimensions(type,fakeIndex,snapshot.dimensions,()=>{
        for(let step=start;step<start+SEARCH_STEPS;step++){
          const distance=COPY_STEP*step;
          for(const sign of [1,-1]){
            const candidate={...layout,face,x:Math.round(((Number(layout.x)||0)+distance*sign)*20)/20};
            if(typeof validCandidate!=='function'||validCandidate(type,fakeIndex,candidate)) return candidate;
          }
        }
        return null;
      });
    }

    if(['wc','sink','shower'].includes(type)){
      const fakeIndex=state.counts[type]||0;
      return withProvisionalDimensions(type,fakeIndex,snapshot.dimensions,()=>{
        for(let step=start;step<start+SEARCH_STEPS;step++){
          const distance=COPY_STEP*step;
          const variants=[
            {...layout,x:(Number(layout.x)||0)+distance,z:Number(layout.z)||0},
            {...layout,x:(Number(layout.x)||0)-distance,z:Number(layout.z)||0},
            {...layout,x:Number(layout.x)||0,z:(Number(layout.z)||0)+distance},
            {...layout,x:Number(layout.x)||0,z:(Number(layout.z)||0)-distance}
          ];
          const found=variants.find(candidate=>typeof validCandidate!=='function'||validCandidate(type,fakeIndex,candidate));
          if(found) return found;
        }
        return null;
      });
    }

    for(let step=start;step<start+SEARCH_STEPS;step++){
      const distance=COPY_STEP*step;
      const candidate={...layout,x:clamp((Number(layout.x)||0)+distance,-c.length/2+.15,c.length/2-.15)};
      if(typeof validCandidate!=='function'||validCandidate(type,state.counts[type]||0,candidate)) return candidate;
    }
    return null;
  }

  function insertSnapshot(snapshot,attempt){
    const type=snapshot.type,max=DATA.extras[type]?.max;
    if(Number.isFinite(max)&&(state.counts[type]||0)>=max) return null;
    const candidate=candidateFor(snapshot,attempt);
    if(!candidate) return null;
    const index=state.counts[type]||0;
    state.counts[type]=index+1;
    ensureLayoutState();
    state.layout[type][index]=candidate;
    if(snapshot.dimensions&&typeof ensureDimensionState==='function'){
      ensureDimensionState();
      if(!Array.isArray(state.dimensions[type])) state.dimensions[type]=[];
      state.dimensions[type][index]=clone(snapshot.dimensions);
    }
    if(type==='partition'){
      if(Array.isArray(state.interiorDoors)) state.interiorDoors[index]=snapshot.extra?.interiorDoor?clone(snapshot.extra.interiorDoor):null;
      if(typeof normalizePartitionInsideContainer==='function') normalizePartitionInsideContainer(index);
    }
    return {type,index};
  }

  function selectionPriceImpact(meta){
    if(!meta||typeof calculate!=='function'||!state.counts||!(state.counts[meta.type]>0)) return null;
    const originalState=state;
    try{
      const currentTotal=Number(calculate()?.total)||0;
      const scenario=clone(state);
      scenario.counts[meta.type]=Math.max(0,(scenario.counts[meta.type]||0)-1);
      if(Array.isArray(scenario.layout?.[meta.type])) scenario.layout[meta.type].splice(meta.index,1);
      if(Array.isArray(scenario.dimensions?.[meta.type])) scenario.dimensions[meta.type].splice(meta.index,1);
      if(meta.type==='partition'){
        if(Array.isArray(scenario.partitionSpecs)) scenario.partitionSpecs.splice(meta.index,1);
        if(Array.isArray(scenario.interiorDoors)) scenario.interiorDoors.splice(meta.index,1);
        if(Array.isArray(scenario.interiorDoorBehavior)) scenario.interiorDoorBehavior.splice(meta.index,1);
      }
      state=scenario;
      const withoutTotal=Number(calculate()?.total)||0;
      return Math.max(0,currentTotal-withoutTotal);
    }catch(e){
      return null;
    }finally{
      state=originalState;
    }
  }

  function renderSingleSelectionTools(root){
    const panel=document.getElementById('object-editor');
    if(!panel) return;
    let block=document.getElementById('selected-object-productivity');
    const meta=root?.userData?.editor;
    if(!meta){ block?.remove(); return; }
    if(!block){
      block=document.createElement('div');
      block.id='selected-object-productivity';
      block.className='mt-3 rounded-xl border border-white/10 bg-white/5 p-3';
      const deleteBtn=panel.querySelector('button[onclick*="deleteSelectedObject"]');
      if(deleteBtn) panel.insertBefore(block,deleteBtn); else panel.appendChild(block);
    }
    const impact=selectionPriceImpact(meta);
    const duplicateButton=meta.type==='partition'
      ? ''
      : `<button type="button" onclick="duplicateSelectedObject()" class="mt-2 w-full rounded-lg bg-amber-500 text-slate-950 py-2 text-xs font-black"><i class="fa-solid fa-copy mr-1"></i> Duplicar <span class="opacity-60">Ctrl+D</span></button>`;
    block.innerHTML=`
      <div class="flex items-end justify-between gap-3"><div><div class="text-[9px] uppercase tracking-widest text-slate-400 font-black">Impacto estimado en venta</div><div class="text-[9px] text-slate-500 mt-1">Incluye configuración actual, margen e IVA.</div></div><div class="text-right font-black text-amber-300 text-base">${impact===null?'—':money(impact)}</div></div>
      ${duplicateButton}`;
  }

  window.copyMultiSelection=function(){
    const source=multiSelection.length?multiSelection:(selectedEditable?[selectedEditable]:[]);
    if(!source.length) return toast('Selecciona uno o más objetos');
    clipboard=source.map(snapshotObject);
    pasteCount=0;
    toast(`${clipboard.length} objeto${clipboard.length===1?'':'s'} copiado${clipboard.length===1?'':'s'}`);
  };

  window.pasteMultiSelection=function(){
    if(!clipboard.length) return toast('Primero copia uno o más objetos');
    const before=clone(state),historyLength=history.length,futureBefore=clone(future);
    pasteCount++;
    pushHistory();
    const created=[];
    clipboard.forEach(snapshot=>{
      const item=insertSnapshot(snapshot,pasteCount);
      if(item) created.push(item);
    });
    if(created.length!==clipboard.length){
      state=before;
      history=history.slice(0,historyLength);
      future=futureBefore;
      renderAll();
      return toast('No hay espacio suficiente para pegar el grupo completo');
    }
    multiSelection=created;
    selectedEditable=created[created.length-1];
    renderAll();
    setTimeout(renderMultiOutlines,0);
    toast(`${created.length} objeto${created.length===1?'':'s'} pegado${created.length===1?'':'s'}`);
  };

  window.duplicateMultiSelection=function(){
    copyMultiSelection();
    pasteMultiSelection();
  };

  window.duplicateSelectedObject=function(){
    if(multiSelection.length>1) return duplicateMultiSelection();
    if(!selectedEditable) return toast('Selecciona un objeto para duplicar');
    if(selectedEditable.type==='partition'&&typeof window.duplicateSelectedPartition==='function') return window.duplicateSelectedPartition();

    const before=clone(state),historyLength=history.length,futureBefore=clone(future);
    const snapshot=snapshotObject(selectedEditable);
    pushHistory();
    const created=insertSnapshot(snapshot,1);
    if(!created){
      state=before;
      history=history.slice(0,historyLength);
      future=futureBefore;
      renderAll();
      return toast('No hay espacio suficiente para duplicar este objeto');
    }
    multiSelection=[];
    selectedEditable=created;
    renderAll();
    const label=typeof typeLabel==='function'?typeLabel(created.type):'Objeto';
    toast(`${label} duplicado`);
  };

  window.deleteMultiSelection=function(){
    if(!multiSelection.length) return;
    pushHistory();
    const grouped={};
    multiSelection.forEach(meta=>{ (grouped[meta.type]||(grouped[meta.type]=[])).push(meta.index); });
    Object.entries(grouped).forEach(([type,indexes])=>{
      indexes.sort((a,b)=>b-a).forEach(index=>{
        state.layout?.[type]?.splice(index,1);
        state.dimensions?.[type]?.splice?.(index,1);
        if(type==='partition'&&Array.isArray(state.interiorDoors)) state.interiorDoors.splice(index,1);
      });
      state.counts[type]=Math.max(0,(state.counts[type]||0)-indexes.length);
    });
    selectedEditable=null;
    multiSelection=[];
    hideEditorPanel();
    renderAll();
    toast('Selección eliminada');
  };

  const deleteSelectedObjectBeforeMulti=deleteSelectedObject;
  deleteSelectedObject=function(){
    if(multiSelection.length>1) return deleteMultiSelection();
    multiSelection=[];
    return deleteSelectedObjectBeforeMulti();
  };

  const showEditorPanelBeforeProductivity=showEditorPanel;
  showEditorPanel=function(root){
    showEditorPanelBeforeProductivity(root);
    renderSingleSelectionTools(root);
  };

  const pointerDownBeforeMulti=onEditorPointerDown;
  onEditorPointerDown=function(event){
    if(event.button!==0||isPresentation) return;
    if(event.shiftKey){
      const root=hitEditable(event);
      if(!root) return;
      const meta=root.userData.editor;
      if(!multiSelection.length&&selectedEditable&&keyOf(selectedEditable)!==keyOf(meta)){
        multiSelection.push({type:selectedEditable.type,index:selectedEditable.index});
      }
      toggleMeta(meta);
      selectedEditable={type:meta.type,index:meta.index};
      showEditorPanel(root);
      controls.enabled=true;
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    clearMultiSelection();
    return pointerDownBeforeMulti(event);
  };

  function reconnectPointerDown(){
    const canvas=renderer?.domElement;
    if(!canvas) return;
    canvas.removeEventListener('pointerdown',pointerDownBeforeMulti);
    canvas.removeEventListener('pointerdown',onEditorPointerDown);
    canvas.addEventListener('pointerdown',onEditorPointerDown);
  }

  const rebuild3DBeforeMulti=rebuild3D;
  rebuild3D=function(){
    rebuild3DBeforeMulti();
    setTimeout(renderMultiOutlines,0);
  };

  document.addEventListener('keydown',event=>{
    const target=event.target;
    if(target?.closest?.('input,textarea,select,[contenteditable="true"]')) return;
    const key=event.key.toLowerCase();
    if((event.ctrlKey||event.metaKey)&&key==='d'&&(multiSelection.length||selectedEditable)){
      event.preventDefault(); event.stopImmediatePropagation(); duplicateSelectedObject();
    }else if((event.ctrlKey||event.metaKey)&&key==='c'&&(multiSelection.length||selectedEditable)){
      event.preventDefault(); event.stopImmediatePropagation(); copyMultiSelection();
    }else if((event.ctrlKey||event.metaKey)&&key==='v'&&clipboard.length){
      event.preventDefault(); event.stopImmediatePropagation(); pasteMultiSelection();
    }else if((key==='delete'||key==='backspace')&&multiSelection.length>1){
      event.preventDefault(); event.stopImmediatePropagation(); deleteMultiSelection();
    }
  },true);

  function boot(){
    if(typeof renderer==='undefined'||!renderer?.domElement||typeof hitEditable!=='function') return false;
    reconnectPointerDown();
    if(selectedEditable){
      const root=rootFor(selectedEditable);
      if(root) renderSingleSelectionTools(root);
    }
    window.BAT_KUBIQUEITOR_MULTI_SELECT=true;
    return true;
  }

  if(!boot()){
    let tries=0;
    const timer=setInterval(()=>{ tries++; if(boot()||tries>80) clearInterval(timer); },100);
  }
})();
