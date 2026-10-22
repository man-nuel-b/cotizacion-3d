// Shift multi-selection + grouped copy/paste for bat-kubiqueitor.
// Keeps the existing single-object editor intact and adds an independent selection set.

(function(){
  const COPY_STEP=.30;
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
      <div class="text-[9px] text-slate-400 mt-2 text-center">Shift + clic para sumar/quitar · Ctrl+C / Ctrl+V</div>`;
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

  function candidateFor(snapshot,attempt){
    const type=snapshot.type,c=DATA.containers[state.container],layout=clone(snapshot.layout||{}),distance=COPY_STEP*attempt;
    if(type==='partition'){
      const orientation=layout.orientation||actualLayout('partition',0)?.orientation||PARTITION_ORIENTATION.CROSS;
      layout.orientation=orientation;
      const dims=snapshot.dimensions||{};
      const bounds=typeof perpendicularPositionBounds==='function'?perpendicularPositionBounds(orientation,dims.thickness||.075):null;
      const base=orientation===PARTITION_ORIENTATION.LONG?(Number(layout.z)||0):(Number(layout.x)||0);
      for(const sign of [1,-1]){
        const value=Math.round((base+distance*sign)*20)/20;
        if(bounds&&(value<bounds.min||value>bounds.max)) continue;
        const candidate={...layout};
        if(orientation===PARTITION_ORIENTATION.LONG) candidate.z=value; else candidate.x=value;
        return candidate;
      }
      return null;
    }
    if(typeof isMountedFaceType==='function'&&isMountedFaceType(type)){
      const face=layout.face||MOUNTED_FACE_TYPES[type]?.defaultFace||'A';
      for(const sign of [1,-1]){
        const candidate={...layout,face,x:Math.round(((Number(layout.x)||0)+distance*sign)*20)/20};
        const fakeIndex=state.counts[type]||0;
        if(typeof validCandidate!=='function'||validCandidate(type,fakeIndex,candidate)) return candidate;
      }
      return null;
    }
    if(['wc','sink','shower'].includes(type)){
      const variants=[
        {...layout,x:(Number(layout.x)||0)+distance,z:Number(layout.z)||0},
        {...layout,x:(Number(layout.x)||0)-distance,z:Number(layout.z)||0},
        {...layout,x:Number(layout.x)||0,z:(Number(layout.z)||0)+distance},
        {...layout,x:Number(layout.x)||0,z:(Number(layout.z)||0)-distance}
      ];
      const fakeIndex=state.counts[type]||0;
      return variants.find(candidate=>typeof validCandidate!=='function'||validCandidate(type,fakeIndex,candidate))||null;
    }
    return {...layout,x:clamp((Number(layout.x)||0)+distance,-c.length/2+.15,c.length/2-.15)};
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

  window.copyMultiSelection=function(){
    const source=multiSelection.length?multiSelection:(selectedEditable?[selectedEditable]:[]);
    if(!source.length) return toast('Selecciona uno o más objetos');
    clipboard=source.map(snapshotObject);
    pasteCount=0;
    toast(`${clipboard.length} objeto${clipboard.length===1?'':'s'} copiado${clipboard.length===1?'':'s'}`);
  };

  window.pasteMultiSelection=function(){
    if(!clipboard.length) return toast('Primero copia uno o más objetos');
    pasteCount++;
    pushHistory();
    const created=[];
    clipboard.forEach((snapshot,idx)=>{
      const item=insertSnapshot(snapshot,pasteCount+Math.floor(idx/4));
      if(item) created.push(item);
    });
    if(!created.length){ history.pop(); return toast('No hay espacio para pegar la selección'); }
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

  const pointerDownBeforeMulti=onEditorPointerDown;
  onEditorPointerDown=function(event){
    if(event.button!==0||isPresentation) return;
    if(event.shiftKey){
      const root=hitEditable(event);
      if(!root) return;
      const meta=root.userData.editor;
      toggleMeta(meta);
      selectedEditable={type:meta.type,index:meta.index};
      showEditorPanel(root);
      controls.enabled=true;
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    const root=hitEditable(event);
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
    if(!(event.ctrlKey||event.metaKey)) return;
    const key=event.key.toLowerCase();
    if(key==='c'&&multiSelection.length>1){
      event.preventDefault(); event.stopImmediatePropagation(); copyMultiSelection();
    }else if(key==='v'&&clipboard.length){
      event.preventDefault(); event.stopImmediatePropagation(); pasteMultiSelection();
    }
  },true);

  function boot(){
    if(typeof renderer==='undefined'||!renderer?.domElement||typeof hitEditable!=='function') return false;
    reconnectPointerDown();
    window.BAT_KUBIQUEITOR_MULTI_SELECT=true;
    return true;
  }

  if(!boot()){
    let tries=0;
    const timer=setInterval(()=>{ tries++; if(boot()||tries>80) clearInterval(timer); },100);
  }
})();
