// Makes Cutaway the authoritative live workspace for interior construction.
(function(){
  if(window.BAT_KUBIQUEITOR_CUTAWAY_WORKSPACE) return;

  const INTERIOR_TYPES=['partition','wc','sink','shower'];
  let installed=false;
  let syncing=false;

  function ready(){
    return typeof state!=='undefined'&&typeof currentView!=='undefined'&&
      typeof rebuild3D==='function'&&typeof renderAll==='function'&&
      typeof adjustCount==='function'&&typeof editableObjects!=='undefined';
  }

  function isCutaway(){ return currentView==='cutaway'; }

  function expected(type){ return Math.max(0,Number(state.counts?.[type])||0); }
  function actual(type){
    if(!Array.isArray(editableObjects)) return 0;
    return editableObjects.filter(root=>root?.userData?.editor?.type===type).length;
  }

  function workspaceOutOfSync(){
    return INTERIOR_TYPES.some(type=>actual(type)!==expected(type));
  }

  function preserveCamera(){
    return {
      position:camera?.position?.clone?.()||null,
      target:controls?.target?.clone?.()||null,
      fov:camera?.fov
    };
  }

  function restoreCamera(saved){
    if(!saved||!camera||!controls) return;
    if(saved.position) camera.position.copy(saved.position);
    if(saved.target) controls.target.copy(saved.target);
    if(Number.isFinite(saved.fov)&&camera.fov!==saved.fov){camera.fov=saved.fov;camera.updateProjectionMatrix();}
    camera.lookAt(controls.target);
    controls.update();
  }

  function selectNewest(type){
    const index=expected(type)-1;
    if(index<0||typeof selectEditable!=='function') return;
    const root=editableObjects.find(obj=>obj?.userData?.editor?.type===type&&obj.userData.editor.index===index);
    if(root) selectEditable(root);
  }

  function hardSyncCutaway({selectType=null,force=false}={}){
    if(syncing||!isCutaway()) return;
    if(!force&&!workspaceOutOfSync()){
      if(selectType) selectNewest(selectType);
      return;
    }

    syncing=true;
    const saved=preserveCamera();
    try{
      // Cutaway is a working state, not a transient camera preset.
      state.cutaway=true;

      // Rebuild through the FINAL rebuild3D chain so sanitary rotation, openings,
      // material layers and door behavior are all reapplied in one authoritative pass.
      rebuild3D();

      // Partitions have their own parametric renderer. Run it once more after the
      // complete scene rebuild so no later wrapper can leave the new partition stale.
      if(typeof rebuildParametricPartitions==='function') rebuildParametricPartitions();

      // Reapply optional visual construction layers when available.
      window.renderInteriorMaterialLayers?.();
      window.renderFramingVisuals?.();

      restoreCamera(saved);
      if(selectType) selectNewest(selectType);
    }finally{
      syncing=false;
    }
  }

  function scheduleVerification(selectType=null){
    requestAnimationFrame(()=>{
      if(!isCutaway()) return;
      if(workspaceOutOfSync()) hardSyncCutaway({selectType,force:true});
      else if(selectType) selectNewest(selectType);
    });
  }

  function install(){
    if(installed||!ready()) return false;
    installed=true;

    const baseAdjustCount=adjustCount;
    adjustCount=function(key,delta){
      const before=expected(key);
      const result=baseAdjustCount(key,delta);
      if(!isCutaway()) return result;

      const after=expected(key);
      const added=Number(delta)>0&&after>before;
      const interiorType=INTERIOR_TYPES.includes(key)?key:null;

      // Immediate synchronous pass, then one verification frame. This is intentional:
      // Cutaway is where the user builds the project live with the client.
      hardSyncCutaway({selectType:added?interiorType:null,force:true});
      scheduleVerification(added?interiorType:null);
      return result;
    };

    const baseRenderAll=renderAll;
    renderAll=function(...args){
      const result=baseRenderAll.apply(this,args);
      if(isCutaway()) scheduleVerification();
      return result;
    };

    // Keep the current Cutaway scene healthy even when a project is loaded/undone.
    const baseUndo=typeof undo==='function'?undo:null;
    if(baseUndo){
      undo=function(...args){const r=baseUndo.apply(this,args);if(isCutaway()) scheduleVerification();return r;};
    }
    const baseRedo=typeof redo==='function'?redo:null;
    if(baseRedo){
      redo=function(...args){const r=baseRedo.apply(this,args);if(isCutaway()) scheduleVerification();return r;};
    }

    window.syncCutawayWorkspace=function(){ hardSyncCutaway({force:true}); };
    window.BAT_KUBIQUEITOR_CUTAWAY_WORKSPACE={
      version:1,
      expected,
      actual,
      sync:window.syncCutawayWorkspace
    };

    if(isCutaway()) hardSyncCutaway({force:true});
    return true;
  }

  if(!install()){
    let tries=0;
    const timer=setInterval(()=>{tries++;if(install()||tries>260) clearInterval(timer);},80);
  }
})();
