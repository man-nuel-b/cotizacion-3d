// Final live refresh for interior partitions.
// Ensures newly added/deleted partitions are visible immediately in the active 3D view.
(function(){
  if(window.BAT_KUBIQUEITOR_PARTITION_LIVE_REFRESH) return;

  let installed=false;
  let lastCount=-1;
  let refreshToken=0;

  function ready(){
    return typeof state!=='undefined'&&typeof renderAll==='function'&&
      typeof rebuildParametricPartitions==='function'&&
      typeof editableObjects!=='undefined'&&
      window.BAT_KUBIQUEITOR_PARTITION_FACES;
  }

  function partitionCount(){ return Math.max(0,Number(state.counts?.partition)||0); }

  function removeOldOverlay(root){
    ['interior-door-behavior-visual','interior-door-behavior-visual-live'].forEach(name=>{
      const old=root?.getObjectByName?.(name);
      if(!old) return;
      old.traverse(obj=>{
        obj.geometry?.dispose?.();
        if(Array.isArray(obj.material)) obj.material.forEach(m=>m?.dispose?.());
        else obj.material?.dispose?.();
      });
      old.parent?.remove(old);
    });
  }

  function doorMat(){
    return typeof mat==='function'?mat(0xd6c4a7,{roughness:.60,metalness:.02}):new THREE.MeshStandardMaterial({color:0xd6c4a7});
  }
  function metalMat(){
    return typeof mat==='function'?mat(0x94a3b8,{roughness:.22,metalness:.82}):new THREE.MeshStandardMaterial({color:0x94a3b8});
  }
  function addHandle(parent,x,y,z){
    const knob=new THREE.Mesh(new THREE.SphereGeometry(.035,14,10),metalMat());
    knob.position.set(x,y,z);
    parent.add(knob);
  }

  function doorBehavior(index){
    const current=state.interiorDoorBehavior?.[index]||{};
    return {
      kind:current.kind==='sliding'?'sliding':'swing',
      hinge:current.hinge==='right'?'right':'left',
      opensTo:Number(current.opensTo)===2?2:1,
      slide:current.slide==='right'?'right':'left'
    };
  }

  function addSwing(root,dims,door,behavior){
    const overlay=new THREE.Group();
    overlay.name='interior-door-behavior-visual-live';
    const hingeZ=behavior.hinge==='left'?door.offset-door.width/2:door.offset+door.width/2;
    const localDir=behavior.hinge==='left'?1:-1;
    const openSide=behavior.opensTo===1?1:-1;
    const pivot=new THREE.Group();
    pivot.position.set(openSide*(dims.thickness/2+.025),0,hingeZ);
    pivot.rotation.y=THREE.MathUtils.degToRad(67)*localDir*openSide;
    const leafWidth=Math.max(.48,door.width-.07),leafHeight=Math.max(1.60,door.height-.07);
    const leaf=box(.036,leafHeight,leafWidth,doorMat(),0,leafHeight/2,localDir*leafWidth/2);
    leaf.name='interior-door-open-leaf';
    pivot.add(leaf);
    addHandle(pivot,openSide*.024,leafHeight*.50,localDir*leafWidth*.80);
    overlay.add(pivot);
    root.add(overlay);
  }

  function addSliding(root,dims,door,behavior){
    const overlay=new THREE.Group();
    overlay.name='interior-door-behavior-visual-live';
    const dir=behavior.slide==='right'?1:-1;
    const leafWidth=Math.max(.48,door.width-.05),leafHeight=Math.max(1.60,door.height-.07);
    const limit=Math.max(0,dims.length/2-leafWidth/2-.04);
    const target=Math.max(-limit,Math.min(limit,door.offset+dir*door.width*.92));
    const faceX=dims.thickness/2+.035;
    const leaf=box(.036,leafHeight,leafWidth,doorMat(),faceX,leafHeight/2,target);
    leaf.name='interior-door-sliding-leaf';
    overlay.add(leaf);
    const railLength=Math.min(dims.length,door.width*2.15);
    overlay.add(box(.04,.045,railLength,metalMat(),faceX,door.height+.055,door.offset+dir*door.width*.42));
    addHandle(overlay,faceX+.024,leafHeight*.50,target-dir*leafWidth*.32);
    root.add(overlay);
  }

  function restoreDoorVisuals(){
    if(typeof partitionDoor!=='function'||typeof objectDimensions!=='function') return;
    editableObjects.forEach(root=>{
      const meta=root?.userData?.editor;
      if(meta?.type!=='partition') return;
      removeOldOverlay(root);
      let door=null,dims=null;
      try{door=partitionDoor(meta.index);dims=objectDimensions('partition',meta.index);}catch(e){return;}
      root.traverse(obj=>{ if(obj.name==='interior-door-leaf') obj.visible=!door?.enabled; });
      if(!door?.enabled||!dims) return;
      const safe={
        width:Math.min(Math.max(.60,Number(door.width)||.80),Math.max(.60,dims.length-.24)),
        height:Math.min(Math.max(1.70,Number(door.height)||2.00),Math.max(1.70,dims.height-.08)),
        offset:Number(door.offset)||0
      };
      const maxOffset=Math.max(0,(dims.length-safe.width)/2-.08);
      safe.offset=Math.max(-maxOffset,Math.min(maxOffset,safe.offset));
      const behavior=doorBehavior(meta.index);
      if(behavior.kind==='sliding') addSliding(root,dims,safe,behavior);
      else addSwing(root,dims,safe,behavior);
    });
  }

  function finalPartitionPass(){
    const token=++refreshToken;
    requestAnimationFrame(()=>{
      if(token!==refreshToken) return;
      requestAnimationFrame(()=>{
        if(token!==refreshToken||typeof rebuildParametricPartitions!=='function') return;
        rebuildParametricPartitions();
        restoreDoorVisuals();
      });
    });
  }

  function install(){
    if(installed||!ready()) return false;
    installed=true;
    lastCount=partitionCount();

    const baseRenderAll=renderAll;
    renderAll=function(...args){
      const before=lastCount;
      const result=baseRenderAll.apply(this,args);
      const after=partitionCount();
      lastCount=after;
      if(after!==before) finalPartitionPass();
      return result;
    };

    // Also repair an already-visible stale Cutaway scene when this module loads.
    finalPartitionPass();

    window.refreshPartitionsLive=finalPartitionPass;
    window.BAT_KUBIQUEITOR_PARTITION_LIVE_REFRESH={version:1};
    return true;
  }

  if(!install()){
    let tries=0;
    const timer=setInterval(()=>{tries++;if(install()||tries>240) clearInterval(timer);},80);
  }
})();
