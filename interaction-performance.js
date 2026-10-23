// Fast interaction layer: extras appear without forced camera changes and dragging stays direct.
(function(){
  if(window.BAT_KUBIQUEITOR_INTERACTION_PERFORMANCE) return;
  let installed=false;

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
    const quarter=Math.round(rotation/90)%2!==0;
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

  function installNoAutoCameraJump(){
    if(typeof addMountedToFace==='function'){
      const baseAdd=addMountedToFace;
      addMountedToFace=function(face){
        const type=typeof pendingMountedType!=='undefined'?pendingMountedType:null;
        const before=type?Number(state.counts?.[type])||0:0;
        const baseFocus=typeof focusFace==='function'?focusFace:null;
        if(baseFocus) focusFace=function(){};
        try{return baseAdd(face);}
        finally{
          if(baseFocus) focusFace=baseFocus;
          if(type&&(Number(state.counts?.[type])||0)>before){
            const index=(Number(state.counts[type])||1)-1;
            selectRoot(type,index);
            refreshCutawayPresentation();
          }
        }
      };
    }

    if(typeof changeSelectedMountedFace==='function'){
      const baseChange=changeSelectedMountedFace;
      changeSelectedMountedFace=function(face){
        const selected=selectedEditable?{...selectedEditable}:null;
        const baseFocus=typeof focusFace==='function'?focusFace:null;
        if(baseFocus) focusFace=function(){};
        try{return baseChange(face);}
        finally{
          if(baseFocus) focusFace=baseFocus;
          if(selected) selectRoot(selected.type,selected.index);
          refreshCutawayPresentation();
        }
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

      // Partitions keep their specialized snapping/joint logic.
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

      if(!moved||!meta) return;

      // Only geometry that changes openings, joints or a secondary outdoor unit needs a scene rebuild.
      const needsGeometryRefresh=new Set(['window','door','opening','openingFrame','partition','ac']);
      if(needsGeometryRefresh.has(meta.type)){
        rebuild3D();
        selectRoot(meta.type,meta.index);
        refreshCutawayPresentation();
      }
      // WC, lavamanos, ducha and electrical points are already in their final position.
      // No renderAll() here: moving an object does not change price, quantities or the wizard UI.
    };

    canvas.addEventListener('pointermove',onEditorPointerMove);
    canvas.addEventListener('pointerup',onEditorPointerUp);
    canvas.addEventListener('pointercancel',onEditorPointerUp);
  }

  function install(){
    if(installed||!ready()) return false;
    installed=true;
    installNoAutoCameraJump();
    installFastDrag();
    window.BAT_KUBIQUEITOR_INTERACTION_PERFORMANCE={version:1};
    return true;
  }

  if(!install()){
    let tries=0;
    const timer=setInterval(()=>{tries++;if(install()||tries>300)clearInterval(timer);},60);
  }
})();
