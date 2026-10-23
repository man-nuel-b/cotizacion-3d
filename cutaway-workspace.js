// Cutaway is the authoritative live workspace for project editing.
// Performance rule: verify only after structural/count changes, not after every renderAll().
(function(){
  if(window.BAT_KUBIQUEITOR_CUTAWAY_WORKSPACE) return;

  const WORKSPACE_TYPES=['window','door','partition','wc','sink','shower','ac','electrical','opening','openingFrame'];
  const MOUNTED_TYPES=['window','door','ac','electrical','opening','openingFrame'];
  let installed=false;
  let syncing=false;
  let verifyToken=0;

  function ready(){
    return typeof state!=='undefined'&&typeof currentView!=='undefined'&&
      typeof rebuild3D==='function'&&typeof renderAll==='function'&&
      typeof editableObjects!=='undefined';
  }
  function isCutaway(){return currentView==='cutaway';}
  function expected(type){return Math.max(0,Number(state.counts?.[type])||0);}
  function actual(type){return Array.isArray(editableObjects)?editableObjects.filter(root=>root?.userData?.editor?.type===type).length:0;}
  function relevantTypes(){return WORKSPACE_TYPES.filter(type=>Number.isFinite(Number(state.counts?.[type]))||DATA?.extras?.[type]);}
  function workspaceOutOfSync(){return relevantTypes().some(type=>actual(type)!==expected(type));}

  function preserveCamera(){return {position:camera?.position?.clone?.()||null,target:controls?.target?.clone?.()||null,fov:camera?.fov};}
  function restoreCamera(saved){
    if(!saved||!camera||!controls)return;
    if(saved.position)camera.position.copy(saved.position);
    if(saved.target)controls.target.copy(saved.target);
    if(Number.isFinite(saved.fov)&&camera.fov!==saved.fov){camera.fov=saved.fov;camera.updateProjectionMatrix();}
    camera.lookAt(controls.target);controls.update();
  }

  function selectNewest(type){
    if(!type||typeof selectEditable!=='function')return;
    const index=expected(type)-1;if(index<0)return;
    const root=editableObjects.find(obj=>obj?.userData?.editor?.type===type&&obj.userData.editor.index===index);
    if(root)selectEditable(root);
  }

  function updatePartitionFaceLabels(){
    if(!Array.isArray(editableObjects))return;
    editableObjects.forEach(root=>{
      const meta=root?.userData?.editor;
      if(meta?.type!=='partition')return;
      const selected=selectedEditable?.type==='partition'&&selectedEditable.index===meta.index;
      root.traverse(obj=>{
        if(!obj?.userData?.partitionFaceLabel)return;
        obj.visible=selected;
        if(obj.isSprite)obj.scale.set(.82,.38,1);
      });
    });
  }

  function ghostRemovedWallObjects(){
    if(!isCutaway()||!Array.isArray(editableObjects))return;
    editableObjects.forEach(root=>{
      const meta=root?.userData?.editor;
      if(!meta||!MOUNTED_TYPES.includes(meta.type))return;
      let face=meta.face;
      try{face=actualLayout(meta.type,meta.index)?.face||face;}catch(e){}
      if(face!=='A')return;
      root.traverse(obj=>{
        if(!obj?.isMesh||!obj.material)return;
        const materials=Array.isArray(obj.material)?obj.material:[obj.material];
        materials.forEach(material=>{
          material.transparent=true;
          material.opacity=Math.min(Number.isFinite(material.opacity)?material.opacity:1,.38);
          material.depthWrite=false;
          material.needsUpdate=true;
        });
      });
      root.userData.cutawayGhost=true;
    });
  }

  function refreshCutawayPresentation(){
    if(!isCutaway())return;
    ghostRemovedWallObjects();
    updatePartitionFaceLabels();
  }

  function hardSyncCutaway({selectType=null,force=false}={}){
    if(syncing||!isCutaway())return;
    if(!force&&!workspaceOutOfSync()){
      if(selectType)selectNewest(selectType);
      refreshCutawayPresentation();
      return;
    }
    syncing=true;
    const saved=preserveCamera();
    try{
      state.cutaway=true;
      rebuild3D();
      restoreCamera(saved);
      if(selectType)selectNewest(selectType);
      refreshCutawayPresentation();
    }finally{syncing=false;}
  }

  function scheduleVerification(selectType=null){
    const token=++verifyToken;
    requestAnimationFrame(()=>{
      if(token!==verifyToken||!isCutaway())return;
      if(workspaceOutOfSync())hardSyncCutaway({selectType,force:true});
      else{
        if(selectType)selectNewest(selectType);
        refreshCutawayPresentation();
      }
    });
  }

  function install(){
    if(installed||!ready())return false;
    installed=true;

    // Do NOT wrap renderAll. Normal UI refreshes and object movement must not trigger
    // another Cutaway verification/rebuild. Count-changing actions below are enough.
    const baseAdjustCount=typeof adjustCount==='function'?adjustCount:null;
    if(baseAdjustCount){
      adjustCount=function(key,delta){
        const before=expected(key),result=baseAdjustCount(key,delta);
        if(isCutaway()){
          const added=Number(delta)>0&&expected(key)>before;
          scheduleVerification(added?key:null);
        }
        return result;
      };
    }

    if(typeof selectEditable==='function'){
      const baseSelectEditable=selectEditable;
      selectEditable=function(root){
        const result=baseSelectEditable(root);
        if(isCutaway())updatePartitionFaceLabels();
        return result;
      };
    }

    const baseUndo=typeof undo==='function'?undo:null;
    if(baseUndo)undo=function(...args){const r=baseUndo.apply(this,args);if(isCutaway())scheduleVerification();return r;};
    const baseRedo=typeof redo==='function'?redo:null;
    if(baseRedo)redo=function(...args){const r=baseRedo.apply(this,args);if(isCutaway())scheduleVerification();return r;};

    window.syncCutawayWorkspace=function(){hardSyncCutaway({force:true});};
    window.refreshCutawayPresentation=refreshCutawayPresentation;
    window.BAT_KUBIQUEITOR_CUTAWAY_WORKSPACE={version:4,expected,actual,sync:window.syncCutawayWorkspace,refresh:refreshCutawayPresentation};
    if(isCutaway())scheduleVerification();
    return true;
  }

  if(!install()){
    let tries=0;
    const timer=setInterval(()=>{tries++;if(install()||tries>260)clearInterval(timer);},80);
  }
})();
