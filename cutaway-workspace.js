// Cutaway is the authoritative live workspace for project editing.
(function(){
  if(window.BAT_KUBIQUEITOR_CUTAWAY_WORKSPACE) return;

  const WORKSPACE_TYPES=['window','door','partition','wc','sink','shower','ac','electrical','opening','openingFrame'];
  let installed=false;
  let syncing=false;
  let verifyToken=0;

  function ready(){
    return typeof state!=='undefined'&&typeof currentView!=='undefined'&&
      typeof rebuild3D==='function'&&typeof renderAll==='function'&&
      typeof editableObjects!=='undefined';
  }

  function isCutaway(){ return currentView==='cutaway'; }
  function expected(type){ return Math.max(0,Number(state.counts?.[type])||0); }
  function actual(type){
    if(!Array.isArray(editableObjects)) return 0;
    return editableObjects.filter(root=>root?.userData?.editor?.type===type).length;
  }
  function relevantTypes(){
    return WORKSPACE_TYPES.filter(type=>Number.isFinite(Number(state.counts?.[type]))||DATA?.extras?.[type]);
  }
  function workspaceOutOfSync(){
    return relevantTypes().some(type=>actual(type)!==expected(type));
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
    if(!type||typeof selectEditable!=='function') return;
    const index=expected(type)-1;
    if(index<0) return;
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
      state.cutaway=true;
      rebuild3D();
      restoreCamera(saved);
      if(selectType) selectNewest(selectType);
    }finally{
      syncing=false;
    }
  }

  function scheduleVerification(selectType=null){
    const token=++verifyToken;
    requestAnimationFrame(()=>{
      if(token!==verifyToken||!isCutaway()) return;
      if(workspaceOutOfSync()) hardSyncCutaway({selectType,force:true});
      else if(selectType) selectNewest(selectType);
    });
  }

  function install(){
    if(installed||!ready()) return false;
    installed=true;

    // One post-render verification only. Do not rebuild partitions separately here:
    // the final rebuild3D chain already owns all scene geometry.
    const baseRenderAll=renderAll;
    renderAll=function(...args){
      const result=baseRenderAll.apply(this,args);
      if(isCutaway()) scheduleVerification();
      return result;
    };

    const baseAdjustCount=typeof adjustCount==='function'?adjustCount:null;
    if(baseAdjustCount){
      adjustCount=function(key,delta){
        const before=expected(key);
        const result=baseAdjustCount(key,delta);
        if(isCutaway()){
          const added=Number(delta)>0&&expected(key)>before;
          scheduleVerification(added?key:null);
        }
        return result;
      };
    }

    const baseUndo=typeof undo==='function'?undo:null;
    if(baseUndo) undo=function(...args){const r=baseUndo.apply(this,args);if(isCutaway())scheduleVerification();return r;};
    const baseRedo=typeof redo==='function'?redo:null;
    if(baseRedo) redo=function(...args){const r=baseRedo.apply(this,args);if(isCutaway())scheduleVerification();return r;};

    window.syncCutawayWorkspace=function(){hardSyncCutaway({force:true});};
    window.BAT_KUBIQUEITOR_CUTAWAY_WORKSPACE={version:2,expected,actual,sync:window.syncCutawayWorkspace};
    if(isCutaway()) scheduleVerification();
    return true;
  }

  if(!install()){
    let tries=0;
    const timer=setInterval(()=>{tries++;if(install()||tries>260)clearInterval(timer);},80);
  }
})();
