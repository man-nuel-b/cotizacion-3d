// Final regression fixes derived from the 2026-10-23 screen recording.
// Goals: counters and 3D stay in sync, new partitions distribute sensibly,
// face-picking owns the click, hidden interior objects are not selectable from Exterior,
// and Interior starts from a safer camera position.
(function(){
  if(window.BAT_KUBIQUEITOR_VIDEO_REGRESSION_FIXES) return;

  let installed=false;
  let syncToken=0;

  function ready(){
    return typeof state!=='undefined' && typeof adjustCount==='function' &&
      typeof rebuild3D==='function' && typeof hitEditable==='function' &&
      typeof setView==='function' && typeof DATA!=='undefined';
  }

  function partitionCount(){ return Math.max(0,Number(state.counts?.partition)||0); }

  function ensurePartitionSlots(){
    if(typeof ensureLayoutState==='function') ensureLayoutState();
    if(!state.layout) state.layout={};
    if(!Array.isArray(state.layout.partition)) state.layout.partition=[];
  }

  function distributeAutomaticPartitions(){
    ensurePartitionSlots();
    const count=partitionCount();
    if(!count) return;
    const c=DATA.containers[state.container];
    for(let i=0;i<count;i++){
      const current=state.layout.partition[i]||{};
      const manuallyPlaced=Boolean(current._userPlaced||current.anchorFace||Number.isFinite(current.axisCenter));
      if(manuallyPlaced) continue;
      const x=-c.length/2+((i+1)*c.length/(count+1));
      state.layout.partition[i]={
        ...current,
        orientation:'cross',
        x:Number(x.toFixed(3)),
        z:0,
        _autoPlaced:true
      };
    }
  }

  function markPartitionUserPlaced(index){
    ensurePartitionSlots();
    if(!Number.isInteger(index)||index<0) return;
    state.layout.partition[index]={...(state.layout.partition[index]||{}),_userPlaced:true,_autoPlaced:false};
  }

  function preserveCamera(){
    return {
      position:camera?.position?.clone?.()||null,
      target:controls?.target?.clone?.()||null,
      view:typeof currentView!=='undefined'?currentView:null,
      cutaway:Boolean(state.cutaway)
    };
  }

  function restoreCamera(saved){
    if(!saved) return;
    if(saved.view&&typeof currentView!=='undefined') currentView=saved.view;
    state.cutaway=saved.cutaway;
    if(camera&&saved.position) camera.position.copy(saved.position);
    if(controls&&saved.target){
      controls.target.copy(saved.target);
      camera?.lookAt?.(controls.target);
      controls.update?.();
    }
  }

  function schedule3DSync({selectType=null}={}){
    const token=++syncToken;
    requestAnimationFrame(()=>{
      if(token!==syncToken) return;
      const saved=preserveCamera();
      rebuild3D();
      restoreCamera(saved);
      if(selectType&&Array.isArray(editableObjects)){
        const index=Math.max(0,(Number(state.counts?.[selectType])||1)-1);
        const root=editableObjects.find(obj=>obj?.userData?.editor?.type===selectType&&obj.userData.editor.index===index);
        if(root&&typeof selectEditable==='function') selectEditable(root);
      }
      window.refreshCutawayPresentation?.();
    });
  }

  function faceSelectionIsActive(){
    try{
      return Boolean((typeof faceSelectionActive!=='undefined'&&faceSelectionActive) ||
        (typeof pendingMountedType!=='undefined'&&pendingMountedType));
    }catch(e){return false;}
  }

  function cancelFaceSelectionSilent(){
    try{ if(typeof pendingMountedType!=='undefined') pendingMountedType=null; }catch(e){}
    try{ if(typeof faceSelectionActive!=='undefined') faceSelectionActive=false; }catch(e){}
    try{ if(typeof faceSelectionOriginView!=='undefined') faceSelectionOriginView=null; }catch(e){}
    document.getElementById('mounted-single-click-prompt')?.remove();
    document.getElementById('mounted-face-modal')?.classList.add('hidden');
  }

  function safeInteriorCamera(){
    if(!camera||!controls) return;
    const c=DATA.containers[state.container];
    const candidates=[];
    const zCandidates=[0,-c.width*.18,c.width*.18];
    for(let i=0;i<7;i++){
      const x=-c.length/2+.75+i*Math.max(.45,(c.length-1.5)/6);
      for(const z of zCandidates) candidates.push({x,z});
    }
    const obstacles=[];
    for(const type of ['wc','sink','shower']){
      for(let i=0;i<(state.counts?.[type]||0);i++){
        try{
          const p=actualLayout(type,i),d=objectDimensions(type,i)||{};
          obstacles.push({x:p.x,z:p.z,r:Math.max(.42,(Number(d.width)||.5)/2,(Number(d.depth)||.5)/2)+.28});
        }catch(e){}
      }
    }
    let best=candidates[0],bestClear=-Infinity;
    for(const candidate of candidates){
      let clear=Infinity;
      for(const o of obstacles) clear=Math.min(clear,Math.hypot(candidate.x-o.x,candidate.z-o.z)-o.r);
      const wallClear=Math.min(candidate.z+c.width/2,c.width/2-candidate.z)-.16;
      clear=Math.min(clear,wallClear);
      if(clear>bestClear){bestClear=clear;best=candidate;}
    }
    const eye=clamp(c.height*.56,1.48,1.64);
    const lookX=Math.min(c.length/2-.65,best.x+Math.min(2.3,c.length*.34));
    camera.position.set(best.x,eye,best.z);
    controls.target.set(lookX,eye-.06,best.z*.35);
    camera.lookAt(controls.target);
    controls.update();
  }

  function install(){
    if(installed||!ready()) return false;
    installed=true;

    // User-driven partition placement should never be redistributed later.
    if(typeof setPerpendicularPosition==='function'){
      const baseSetPerpendicularPosition=setPerpendicularPosition;
      setPerpendicularPosition=function(index,value){
        const result=baseSetPerpendicularPosition(index,value);
        markPartitionUserPlaced(index);
        return result;
      };
    }
    if(typeof updatePartitionPosition==='function'){
      const baseUpdatePartitionPosition=updatePartitionPosition;
      updatePartitionPosition=function(value){
        const index=selectedEditable?.type==='partition'?selectedEditable.index:null;
        const result=baseUpdatePartitionPosition(value);
        if(index!==null) markPartitionUserPlaced(index);
        return result;
      };
    }
    if(typeof changePartitionOrientation==='function'){
      const baseChangePartitionOrientation=changePartitionOrientation;
      changePartitionOrientation=function(orientation){
        const index=selectedEditable?.type==='partition'?selectedEditable.index:null;
        const result=baseChangePartitionOrientation(orientation);
        if(index!==null) markPartitionUserPlaced(index);
        return result;
      };
    }

    // The counter changing before the 3D was the clearest bug in the video.
    const baseAdjustCount=adjustCount;
    adjustCount=function(key,delta){
      const before=Number(state.counts?.[key])||0;
      const result=baseAdjustCount(key,delta);
      const after=Number(state.counts?.[key])||0;
      if(after===before) return result; // mounted + only enters face-pick mode here.

      if(key==='partition'&&after>before) distributeAutomaticPartitions();
      schedule3DSync({selectType:after>before?key:null});
      return result;
    };

    // While A/B/C/D is being chosen, no object behind the wall is allowed to steal the click.
    const baseHitEditable=hitEditable;
    hitEditable=function(event){
      if(faceSelectionIsActive()) return null;
      const root=baseHitEditable(event);
      if(!root) return null;
      const meta=root.userData?.editor;
      if(currentView==='exterior'&&meta?.type==='partition') return null;
      return root;
    };

    // Leaving the working view cancels any half-finished face-pick transaction.
    const baseSetView=setView;
    setView=function(view,animateIt=true){
      if(faceSelectionIsActive()) cancelFaceSelectionSilent();
      const result=baseSetView(view,animateIt);
      if(view==='interior'){
        if(typeof cameraAnim!=='undefined'&&cameraAnim) cancelAnimationFrame(cameraAnim);
        cameraAnim=null;
        safeInteriorCamera();
      }
      return result;
    };

    if(typeof setInteractionMode==='function'){
      const baseSetInteractionMode=setInteractionMode;
      setInteractionMode=function(mode){
        if(mode==='explore'&&faceSelectionIsActive()) cancelFaceSelectionSilent();
        return baseSetInteractionMode(mode);
      };
    }

    // Repair already-created automatic partitions from an older session.
    distributeAutomaticPartitions();
    schedule3DSync();

    window.BAT_KUBIQUEITOR_VIDEO_REGRESSION_FIXES={version:1};
    return true;
  }

  if(!install()){
    let tries=0;
    const timer=setInterval(()=>{tries++;if(install()||tries>360)clearInterval(timer);},50);
  }
})();
