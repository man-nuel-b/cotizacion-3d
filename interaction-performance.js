// Fast interaction layer: one render per add, direct dragging, live wall openings and clean labels.
(function(){
  if(window.BAT_KUBIQUEITOR_INTERACTION_PERFORMANCE) return;
  let installed=false;
  let shellRefreshTimer=null;
  let lastShellRefresh=0;

  const OPENING_TYPES=new Set(['window','door','opening','openingFrame']);

  function ready(){
    return typeof THREE!=='undefined'&&typeof state!=='undefined'&&typeof renderer!=='undefined'&&renderer&&
      typeof onEditorPointerMove==='function'&&typeof onEditorPointerUp==='function'&&
      typeof actualLayout==='function'&&typeof ensureLayoutState==='function'&&
      typeof rebuild3D==='function'&&window.BAT_KUBIQUEITOR_CUTAWAY_WORKSPACE;
  }

  function currentCanvas(){ return renderer?.domElement||document.querySelector('#canvas-container canvas'); }
  function step(value,size=.02){ return Math.round((Number(value)||0)/size)*size; }

  function mountedHalfWidth(type,index){
    if(type==='electrical') return .09;
    try{
      const d=typeof objectDimensions==='function'?objectDimensions(type,index):null;
      const w=Number(d?.width);
      if(Number.isFinite(w)&&w>0) return w/2;
    }catch(e){}
    const fallbacks={window:.60,door:.49,ac:.46,opening:.45,openingFrame:.45};
    return fallbacks[type]||.12;
  }

  function clampMounted(type,index,candidate){
    const c=DATA.containers[state.container];
    const face=candidate.face||(typeof mountedFace==='function'?mountedFace(type,index):'A');
    const span=(face==='A'||face==='B')?c.length:c.width;
    const half=mountedHalfWidth(type,index);
    const limit=Math.max(0,span/2-half-.08);
    return {...candidate,face,x:clamp(Number(candidate.x)||0,-limit,limit)};
  }

  function clampSanitary(type,index,candidate){
    const c=DATA.containers[state.container];
    let width=.65,depth=.65,rotation=0;
    try{
      const d=objectDimensions(type,index)||{};
      width=Math.max(.20,Number(d.width)||width);
      depth=Math.max(.20,Number(d.depth)||depth);
      rotation=Number(state.layout?.[type]?.[index]?.rotation)||0;
    }catch(e){}
    const quarter=Math.abs(Math.round(rotation/90))%2===1;
    const halfX=(quarter?depth:width)/2+.06;
    const halfZ=(quarter?width:depth)/2+.06;
    return {
      ...candidate,
      x:clamp(Number(candidate.x)||0,-c.length/2+halfX,c.length/2-halfX),
      z:clamp(Number(candidate.z)||0,-c.width/2+halfZ,c.width/2-halfZ)
    };
  }

  function refreshCutawayPresentation(){
    try{ window.BAT_KUBIQUEITOR_CUTAWAY_WORKSPACE?.refresh?.(); }catch(e){}
  }

  function selectRoot(type,index){
    if(typeof selectEditable!=='function'||!Array.isArray(editableObjects)) return;
    const root=editableObjects.find(obj=>obj?.userData?.editor?.type===type&&obj.userData.editor.index===index);
    if(root) selectEditable(root);
  }

  function disposeTree(root){
    if(!root) return;
    root.traverse?.(obj=>{
      obj.geometry?.dispose?.();
      const mats=obj.material?(Array.isArray(obj.material)?obj.material:[obj.material]):[];
      mats.forEach(m=>{
        if(!m) return;
        Object.values(m).forEach(v=>{if(v?.isTexture)v.dispose?.();});
        m.dispose?.();
      });
    });
  }

  // Rebuild only the shipping-container shell while dragging an opening.
  // The selected object itself is NOT recreated, so pointer capture remains smooth.
  function refreshContainerShellOnly(){
    shellRefreshTimer=null;
    lastShellRefresh=performance.now();
    if(!containerGroup||typeof createContainerShell!=='function') return;
    const old=containerGroup.getObjectByName?.('realistic-container-shell');
    if(!old) return;
    const c=DATA.containers[state.container],extColor=new THREE.Color(state.exteriorColor);
    const materials={
      exterior:mat(extColor,{roughness:.58,metalness:.2}),
      interior:mat(state.finish==='sanitary'?0xf8fafc:0xf1f5f9,{roughness:state.finish==='sanitary'?.32:.82}),
      frame:mat(new THREE.Color(extColor).multiplyScalar(.55),{roughness:.42,metalness:.48}),
      floor:createFloorMaterial()
    };
    const next=createContainerShell(c,materials);
    old.parent?.remove(old);
    disposeTree(old);
    containerGroup.add(next);
  }

  function scheduleShellRefresh(){
    const elapsed=performance.now()-lastShellRefresh;
    if(elapsed>=90){
      refreshContainerShellOnly();
      return;
    }
    if(shellRefreshTimer) return;
    shellRefreshTimer=setTimeout(refreshContainerShellOnly,Math.max(12,90-elapsed));
  }

  function cancelShellRefresh(){
    if(shellRefreshTimer){clearTimeout(shellRefreshTimer);shellRefreshTimer=null;}
  }

  function applyPartitionLabelVisibility(){
    if(!Array.isArray(editableObjects)) return;
    const selectedPartition=selectedEditable?.type==='partition'?selectedEditable.index:-1;
    editableObjects.forEach(root=>{
      const meta=root?.userData?.editor;
      if(meta?.type!=='partition') return;
      const show=meta.index===selectedPartition;
      root.traverse(obj=>{
        if(!obj?.userData?.partitionFaceLabel) return;
        obj.visible=show;
        if(obj.material){
          obj.material.depthTest=true;
          obj.material.depthWrite=false;
          obj.material.needsUpdate=true;
        }
        if(obj.isSprite) obj.scale.set(.84,.39,1);
      });
    });
  }

  function installCleanPartitionLabels(){
    if(typeof selectEditable==='function'){
      const baseSelect=selectEditable;
      selectEditable=function(root){
        const result=baseSelect(root);
        applyPartitionLabelVisibility();
        return result;
      };
    }

    if(typeof addSelectionOutline==='function'){
      const baseOutline=addSelectionOutline;
      addSelectionOutline=function(group){
        const hidden=[];
        group?.traverse?.(obj=>{
          if(obj?.userData?.partitionFaceLabel&&obj.visible){hidden.push(obj);obj.visible=false;}
        });
        const result=baseOutline(group);
        hidden.forEach(obj=>obj.visible=true);
        return result;
      };
    }

    const baseRebuild=rebuild3D;
    rebuild3D=function(...args){
      const result=baseRebuild.apply(this,args);
      applyPartitionLabelVisibility();
      return result;
    };

    applyPartitionLabelVisibility();
  }

  // Replace the older add flow completely. The old version could rebuild 3–4 times
  // in Cutaway. This version changes state, renders ONCE, then selects the new object.
  function installFastMountedAdd(){
    if(typeof addMountedToFace==='function'){
      addMountedToFace=function(face){
        const type=typeof pendingMountedType!=='undefined'?pendingMountedType:null;
        if(!type||typeof isMountedFaceType!=='function'||!isMountedFaceType(type)||!['A','B','C','D'].includes(face)) return;
        const max=DATA.extras[type]?.max||0;
        if((state.counts[type]||0)>=max){
          pendingMountedType=null;
          if(typeof faceSelectionActive!=='undefined') faceSelectionActive=false;
          if(typeof faceSelectionOriginView!=='undefined') faceSelectionOriginView=null;
          return toast(`Llegaste al máximo de ${typeLabel(type).toLowerCase()}`);
        }
        const offset=findAvailableMountedOffset(type,face);
        if(offset===null) return toast(`No queda espacio suficiente en la cara ${face}`);

        const keepCutaway=currentView==='cutaway'||state.cutaway===true||
          (typeof faceSelectionOriginView!=='undefined'&&faceSelectionOriginView==='cutaway');
        pushHistory();
        ensureLayoutState();
        const index=state.counts[type]||0;
        state.counts[type]=index+1;
        state.layout[type][index]={face,x:offset};
        pendingMountedType=null;
        if(typeof faceSelectionActive!=='undefined') faceSelectionActive=false;
        if(typeof faceSelectionOriginView!=='undefined') faceSelectionOriginView=null;
        if(keepCutaway){state.cutaway=true;currentView='cutaway';}

        renderAll();
        selectRoot(type,index);
        refreshCutawayPresentation();
        toast(`${typeLabel(type)} agregado en cara ${face}`);
      };
    }

    if(typeof changeSelectedMountedFace==='function'){
      changeSelectedMountedFace=function(face){
        if(!selectedEditable||typeof isMountedFaceType!=='function'||!isMountedFaceType(selectedEditable.type)) return;
        const {type,index}=selectedEditable;
        const offset=findAvailableMountedOffset(type,face,index);
        if(offset===null) return toast(`No queda espacio suficiente en la cara ${face}`);
        const keepCutaway=currentView==='cutaway'||state.cutaway===true;
        pushHistory();
        ensureLayoutState();
        state.layout[type][index]={...(state.layout[type][index]||{}),face,x:offset};
        if(keepCutaway){state.cutaway=true;currentView='cutaway';}
        renderAll();
        selectRoot(type,index);
        refreshCutawayPresentation();
        toast(`${typeLabel(type)} movido a cara ${face}`);
      };
    }
  }

  function installFastDrag(){
    const canvas=currentCanvas();
    if(!canvas) return;
    const oldMove=onEditorPointerMove;
    const oldUp=onEditorPointerUp;
    canvas.removeEventListener('pointermove',oldMove);
    canvas.removeEventListener('pointerup',oldUp);
    canvas.removeEventListener('pointercancel',oldUp);

    onEditorPointerMove=function(event){
      if(!draggingEditable) return;
      const meta=draggingEditable.userData?.editor;
      if(!meta) return oldMove(event);
      const {type,index}=meta;

      // Partitions keep their specialized snapping/joint behavior.
      if(type==='partition') return oldMove(event);

      pointerNDC(event);
      editorRaycaster.setFromCamera(editorPointer,camera);
      const point=new THREE.Vector3();
      if(!editorRaycaster.ray.intersectPlane(dragPlane,point)) return;
      const current=actualLayout(type,index);
      let candidate={...current};

      if(typeof isMountedFaceType==='function'&&isMountedFaceType(type)){
        candidate.x=step((current.face==='A'||current.face==='B')?point.x:point.z,.02);
        candidate=clampMounted(type,index,candidate);
      }else if(['wc','sink','shower'].includes(type)){
        candidate.x=step(point.x,.02);
        candidate.z=step(point.z,.02);
        candidate=clampSanitary(type,index,candidate);
      }else{
        return oldMove(event);
      }

      dragMoved=true;
      ensureLayoutState();
      state.layout[type][index]={...(state.layout[type][index]||{}),...candidate};

      if(typeof isMountedFaceType==='function'&&isMountedFaceType(type)){
        positionMountedObject(draggingEditable,type,candidate,DATA.containers[state.container]);
        if(OPENING_TYPES.has(type)) scheduleShellRefresh();
      }else{
        draggingEditable.position.x=candidate.x;
        draggingEditable.position.z=candidate.z;
      }

      const subtitle=document.getElementById('editor-subtitle');
      if(subtitle) subtitle.textContent=`Elemento ${index+1} · ${editorPositionLabel(type,candidate)}`;
    };

    onEditorPointerUp=function(event){
      if(!draggingEditable) return;
      const meta=draggingEditable.userData?.editor?{...draggingEditable.userData.editor}:null;
      const moved=Boolean(dragMoved);

      controls.enabled=true;
      renderer.domElement.releasePointerCapture?.(event.pointerId);
      if(moved&&dragStartState){
        history.push(dragStartState);
        if(history.length>40) history.shift();
        future=[];
        toast('Posición actualizada');
      }

      draggingEditable=null;
      dragPlane=null;
      dragStartState=null;
      dragMoved=false;
      cancelShellRefresh();

      if(!moved||!meta) return;

      // Final precise rebuild only when geometry actually depends on the moved object.
      if(OPENING_TYPES.has(meta.type)||meta.type==='partition'||meta.type==='ac'){
        rebuild3D();
        selectRoot(meta.type,meta.index);
        refreshCutawayPresentation();
      }
      // WC, lavamanos, ducha and electrical points already remain at their final coordinates.
    };

    canvas.addEventListener('pointermove',onEditorPointerMove);
    canvas.addEventListener('pointerup',onEditorPointerUp);
    canvas.addEventListener('pointercancel',onEditorPointerUp);
  }

  function updateEditorCopy(){
    const panel=document.getElementById('object-editor');
    const info=panel?.querySelector('.mt-3.rounded-xl.bg-white\/5');
    if(info) info.textContent='Arrastra el elemento libremente. El sistema lo mantiene dentro de los límites del contenedor.';
  }

  function install(){
    if(installed||!ready()) return false;
    installed=true;
    installCleanPartitionLabels();
    installFastMountedAdd();
    installFastDrag();
    updateEditorCopy();
    window.BAT_KUBIQUEITOR_INTERACTION_PERFORMANCE={version:2,refreshShell:refreshContainerShellOnly,labels:applyPartitionLabelVisibility};
    return true;
  }

  if(!install()){
    let tries=0;
    const timer=setInterval(()=>{tries++;if(install()||tries>300)clearInterval(timer);},60);
  }
})();
