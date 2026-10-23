// Final authority for mounted placement of openings and other wall extras.
// Prevents merged/overlapping openings and removes redundant rebuilds after face selection.
(function(){
  if(window.BAT_KUBIQUEITOR_OPENING_PLACEMENT_FIX) return;

  const OPENING_TYPES=['opening','openingFrame'];
  const APERTURE_TYPES=['window','door','opening','openingFrame'];
  const MIN_WALL_STRIP=.22;
  let installed=false;

  function ready(){
    return typeof state!=='undefined'&&typeof DATA!=='undefined'&&
      typeof actualLayout==='function'&&typeof objectDimensions==='function'&&
      typeof isMountedFaceType==='function'&&typeof mountedFaceDimension==='function'&&
      typeof renderAll==='function'&&typeof selectEditable==='function'&&
      typeof ensureLayoutState==='function'&&typeof pushHistory==='function';
  }

  function halfWidth(type,index){
    if(type==='electrical') return .085;
    try{
      const d=objectDimensions(type,index)||{};
      return Math.max(.10,(Number(d.width)||.20)/2);
    }catch(e){
      const fallback={window:.60,door:.49,opening:.45,openingFrame:.45,ac:.46};
      return fallback[type]||.12;
    }
  }

  function apertureAllowed(type,index,face,x){
    if(!APERTURE_TYPES.includes(type)) return true;
    const mine=halfWidth(type,index);
    for(const otherType of APERTURE_TYPES){
      for(let i=0;i<(state.counts?.[otherType]||0);i++){
        if(otherType===type&&i===index) continue;
        const other=actualLayout(otherType,i);
        if(other?.face!==face) continue;
        const distance=Math.abs((Number(other.x)||0)-x);
        if(distance<mine+halfWidth(otherType,i)+MIN_WALL_STRIP) return false;
      }
    }
    return true;
  }

  function withinWall(type,index,face,x){
    const c=DATA.containers[state.container];
    const dim=mountedFaceDimension(face,c);
    const margin=Math.max(.08,Number(MOUNTED_FACE_TYPES?.[type]?.padding)||.08);
    return Math.abs(x)+halfWidth(type,index)<=dim/2-margin+.001;
  }

  function candidateOffsets(type,index,face){
    const c=DATA.containers[state.container];
    const dim=mountedFaceDimension(face,c);
    const half=halfWidth(type,index);
    const margin=Math.max(.08,Number(MOUNTED_FACE_TYPES?.[type]?.padding)||.08);
    const limit=Math.max(0,dim/2-margin-half);
    const step=.05;
    const values=[0];
    for(let d=step;d<=limit+.001;d+=step){
      const rounded=Number(d.toFixed(2));
      values.push(rounded,-rounded);
    }
    return values;
  }

  function findOffset(type,face,index){
    const original=state.layout?.[type]?.[index];
    if(original&&original.face===face&&Number.isFinite(Number(original.x))){
      const x=Number(original.x);
      if(withinWall(type,index,face,x)&&apertureAllowed(type,index,face,x)) return x;
    }
    for(const x of candidateOffsets(type,index,face)){
      if(withinWall(type,index,face,x)&&apertureAllowed(type,index,face,x)) return x;
    }
    return null;
  }

  function selectMounted(type,index){
    if(!Array.isArray(editableObjects)) return;
    const root=editableObjects.find(obj=>obj?.userData?.editor?.type===type&&obj.userData.editor.index===index);
    if(root) selectEditable(root);
  }

  function preserveWorkingView(){
    return {
      view:typeof currentView!=='undefined'?currentView:null,
      cutaway:Boolean(state.cutaway)
    };
  }

  function restoreWorkingView(saved){
    if(!saved) return;
    if(saved.view&&typeof currentView!=='undefined') currentView=saved.view;
    state.cutaway=saved.cutaway;
  }

  function repairExistingOpenings(){
    ensureLayoutState();
    let changed=false;
    for(const type of OPENING_TYPES){
      for(let i=0;i<(state.counts?.[type]||0);i++){
        const current=actualLayout(type,i);
        const face=current.face||MOUNTED_FACE_TYPES[type].defaultFace;
        const x=Number(current.x)||0;
        if(withinWall(type,i,face,x)&&apertureAllowed(type,i,face,x)) continue;
        const next=findOffset(type,face,i);
        if(next===null) continue;
        state.layout[type][i]={...(state.layout[type][i]||{}),face,x:next};
        changed=true;
      }
    }
    return changed;
  }

  function install(){
    if(installed||!ready()) return false;
    installed=true;

    const legacyFind=typeof findAvailableMountedOffset==='function'?findAvailableMountedOffset:null;
    findAvailableMountedOffset=function(type,face,excludeIndex=null){
      if(OPENING_TYPES.includes(type)){
        const index=Number.isInteger(excludeIndex)?excludeIndex:(state.counts?.[type]||0);
        return findOffset(type,face,index);
      }
      return legacyFind?legacyFind(type,face,excludeIndex):null;
    };

    addMountedToFace=function(face){
      const type=typeof pendingMountedType!=='undefined'?pendingMountedType:null;
      if(!type||!isMountedFaceType(type)||!['A','B','C','D'].includes(face)) return;
      const max=DATA.extras[type]?.max??8;
      if((state.counts[type]||0)>=max){
        pendingMountedType=null;
        if(typeof faceSelectionActive!=='undefined') faceSelectionActive=false;
        if(typeof faceSelectionOriginView!=='undefined') faceSelectionOriginView=null;
        return toast(`Llegaste al máximo de ${typeLabel(type).toLowerCase()}`);
      }

      const index=state.counts[type]||0;
      const offset=OPENING_TYPES.includes(type)?findOffset(type,face,index):findAvailableMountedOffset(type,face,index);
      if(offset===null) return toast(`No queda espacio suficiente en la cara ${face}`);

      const savedView=preserveWorkingView();
      pushHistory();
      ensureLayoutState();
      state.counts[type]=index+1;
      state.layout[type][index]={face,x:offset};

      pendingMountedType=null;
      if(typeof faceSelectionActive!=='undefined') faceSelectionActive=false;
      if(typeof faceSelectionOriginView!=='undefined') faceSelectionOriginView=null;

      restoreWorkingView(savedView);
      renderAll();
      restoreWorkingView(savedView);
      requestAnimationFrame(()=>selectMounted(type,index));
      toast(`${typeLabel(type)} agregado en cara ${face}`);
    };

    if(typeof changeSelectedMountedFace==='function'){
      changeSelectedMountedFace=function(face){
        if(!selectedEditable||!isMountedFaceType(selectedEditable.type)||!['A','B','C','D'].includes(face)) return;
        const {type,index}=selectedEditable;
        const offset=OPENING_TYPES.includes(type)?findOffset(type,face,index):findAvailableMountedOffset(type,face,index);
        if(offset===null) return toast(`No queda espacio suficiente en la cara ${face}`);
        const savedView=preserveWorkingView();
        pushHistory();
        ensureLayoutState();
        state.layout[type][index]={...(state.layout[type][index]||{}),face,x:offset};
        restoreWorkingView(savedView);
        renderAll();
        restoreWorkingView(savedView);
        requestAnimationFrame(()=>selectMounted(type,index));
        toast(`${typeLabel(type)} movido a cara ${face}`);
      };
    }

    const repaired=repairExistingOpenings();
    if(repaired) renderAll();

    window.BAT_KUBIQUEITOR_OPENING_PLACEMENT_FIX={version:1,minWallStrip:MIN_WALL_STRIP};
    return true;
  }

  if(!install()){
    let tries=0;
    const timer=setInterval(()=>{tries++;if(install()||tries>320)clearInterval(timer);},60);
  }
})();
