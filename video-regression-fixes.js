// Final regression fixes derived from the 2026-10-23 screen recording.
// Goals: counters and 3D stay in sync, new partitions distribute sensibly,
// face-picking owns the click, hidden interior objects are not selectable from Exterior,
// mounted extras appear immediately, and Interior starts from a safe camera position.
(function(){
  if(window.BAT_KUBIQUEITOR_VIDEO_REGRESSION_FIXES) return;

  const INTERIOR_ONLY_TYPES=new Set(['partition','wc','sink','shower']);
  let installed=false;
  let syncToken=0;

  function ready(){
    return typeof state!=='undefined' && typeof adjustCount==='function' &&
      typeof rebuild3D==='function' && typeof hitEditable==='function' &&
      typeof setView==='function' && typeof DATA!=='undefined' &&
      window.BAT_KUBIQUEITOR_SINGLE_CLICK_EXTRAS;
  }

  function count(type){ return Math.max(0,Number(state.counts?.[type])||0); }

  function ensurePartitionSlots(){
    if(typeof ensureLayoutState==='function') ensureLayoutState();
    if(!state.layout) state.layout={};
    if(!Array.isArray(state.layout.partition)) state.layout.partition=[];
  }

  function distributeAutomaticPartitions(){
    ensurePartitionSlots();
    const total=count('partition');
    if(!total) return;
    const c=DATA.containers[state.container];
    for(let i=0;i<total;i++){
      const current=state.layout.partition[i]||{};
      const manuallyPlaced=Boolean(current._userPlaced||current.anchorFace||Number.isFinite(current.axisCenter));
      if(manuallyPlaced) continue;
      const x=-c.length/2+((i+1)*c.length/(total+1));
      state.layout.partition[i]={
        ...current,
        orientation:'cross',
        x:Number(x.toFixed(3)),
        z:0,
        anchorFace:null,
        joints:Array.isArray(current.joints)?current.joints:[],
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

  function selectNewest(type){
    if(!type||!Array.isArray(editableObjects)||typeof selectEditable!=='function') return;
    const index=count(type)-1;
    if(index<0) return;
    const root=editableObjects.find(obj=>obj?.userData?.editor?.type===type&&obj.userData.editor.index===index);
    if(root) selectEditable(root);
  }

  function schedule3DSync({selectType=null}={}){
    const token=++syncToken;
    requestAnimationFrame(()=>{
      if(token!==syncToken) return;
      const saved=preserveCamera();
      rebuild3D();
      restoreCamera(saved);
      if(selectType) selectNewest(selectType);
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
    const modal=document.getElementById('mounted-face-modal');
    modal?.classList.add('hidden'); modal?.classList.remove('flex');
    const old=document.getElementById('window-face-modal');
    old?.classList.add('hidden'); old?.classList.remove('flex');
  }

  function safeInteriorCamera(){
    if(!camera||!controls) return;
    const c=DATA.containers[state.container];
    const candidates=[];
    const zCandidates=[0,-c.width*.18,c.width*.18];
    for(let i=0;i<9;i++){
      const x=-c.length/2+.72+i*Math.max(.38,(c.length-1.44)/8);
      for(const z of zCandidates) candidates.push({x,z});
    }
    const obstacles=[];
    for(const type of ['wc','sink','shower']){
      for(let i=0;i<count(type);i++){
        try{
          const p=actualLayout(type,i),d=objectDimensions(type,i)||{};
          obstacles.push({kind:'point',x:p.x,z:p.z,r:Math.max(.42,(Number(d.width)||.5)/2,(Number(d.depth)||.5)/2)+.34});
        }catch(e){}
      }
    }
    for(let i=0;i<count('partition');i++){
      try{
        const p=actualLayout('partition',i);
        obstacles.push(p.orientation==='long'
          ? {kind:'long',z:Number(p.z)||0}
          : {kind:'cross',x:Number(p.x)||0});
      }catch(e){}
    }

    let best=candidates[0],bestClear=-Infinity;
    for(const candidate of candidates){
      let clear=Infinity;
      for(const o of obstacles){
        let d=Infinity;
        if(o.kind==='point') d=Math.hypot(candidate.x-o.x,candidate.z-o.z)-o.r;
        else if(o.kind==='cross') d=Math.abs(candidate.x-o.x)-.28;
        else if(o.kind==='long') d=Math.abs(candidate.z-o.z)-.28;
        clear=Math.min(clear,d);
      }
      const wallClear=Math.min(candidate.z+c.width/2,c.width/2-candidate.z)-.18;
      clear=Math.min(clear,wallClear);
      if(clear>bestClear){bestClear=clear;best=candidate;}
    }

    const eye=clamp(c.height*.56,1.48,1.64);
    const rightSpace=c.length/2-best.x;
    const dir=rightSpace>c.length*.30?1:-1;
    const lookX=clamp(best.x+dir*Math.min(2.3,c.length*.34),-c.length/2+.55,c.length/2-.55);
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

    // Counter and visible 3D must change together. This fixes the recording's 0→1→2→3
    // counter updates while Cutaway visually stayed empty until a view change.
    const baseAdjustCount=adjustCount;
    adjustCount=function(key,delta){
      const before=count(key);
      const result=baseAdjustCount(key,delta);
      const after=count(key);
      if(after===before) return result; // mounted + only enters face-pick mode here.

      if(key==='partition'&&after>before) distributeAutomaticPartitions();
      schedule3DSync({selectType:after>before?key:null});
      return result;
    };

    // Mounted extras change count only after A/B/C/D is selected, so force the same
    // final synchronization there as well.
    if(typeof addMountedToFace==='function'){
      const baseAddMountedToFace=addMountedToFace;
      addMountedToFace=function(face){
        let type=null,before=0;
        try{type=pendingMountedType;before=type?count(type):0;}catch(e){}
        const result=baseAddMountedToFace(face);
        if(type&&count(type)>before) schedule3DSync({selectType:type});
        return result;
      };
    }

    // While A/B/C/D is being chosen, no object behind the wall is allowed to steal the click.
    const baseHitEditable=hitEditable;
    hitEditable=function(event){
      if(faceSelectionIsActive()) return null;
      const root=baseHitEditable(event);
      if(!root) return null;
      const meta=root.userData?.editor;
      if(currentView==='exterior'&&INTERIOR_ONLY_TYPES.has(meta?.type)) return null;
      return root;
    };

    // Leaving the current view cancels any half-finished face-pick transaction.
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

    // Repair already-created automatic partitions from older sessions.
    distributeAutomaticPartitions();
    schedule3DSync();

    window.BAT_KUBIQUEITOR_VIDEO_REGRESSION_FIXES={version:2};
    return true;
  }

  if(!install()){
    let tries=0;
    const timer=setInterval(()=>{tries++;if(install()||tries>360)clearInterval(timer);},50);
  }
})();
