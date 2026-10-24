// Partition collision integration for shared occupied volumes.
// Keeps partition geometry and editor behavior intact; only rejects moves/sizes that cross an occupied structure.
(function(){
  if(window.BAT_KUBIQUEITOR_PARTITION_OBSTACLE_COLLISION) return;

  const CLEARANCE=.035;
  let installed=false;

  function finite(value,fallback=0){
    const n=Number(value);
    return Number.isFinite(n)?n:fallback;
  }

  function orientationBounds(orientation){
    if(typeof partitionInteriorBounds==='function') return partitionInteriorBounds(orientation);
    const c=DATA.containers[state.container];
    return orientation===PARTITION_ORIENTATION.LONG
      ? {min:-c.length/2+.055,max:c.length/2-.055}
      : {min:-c.width/2+.060,max:c.width/2-.040};
  }

  function partitionVolume(index,override={}){
    const currentLayout=actualLayout('partition',index);
    const currentDims=objectDimensions('partition',index);
    const orientation=override.orientation||currentLayout.orientation;
    const dims={...currentDims,...(override.dimensions||{})};
    const thickness=Math.max(.01,finite(dims.thickness,.075));
    const length=Math.max(.01,finite(dims.length,.30));
    const elevation=Math.max(0,finite(dims.elevation,0));
    const height=Math.max(.01,finite(dims.height,1));
    const stored=state.layout?.partition?.[index]||{};
    const bounds=orientationBounds(orientation);
    const defaultAxis=(bounds.min+bounds.max)/2;
    const axisCenter=Number.isFinite(Number(override.axisCenter))
      ? Number(override.axisCenter)
      : (orientation===currentLayout.orientation&&Number.isFinite(Number(stored.axisCenter))?Number(stored.axisCenter):defaultAxis);
    const x=Number.isFinite(Number(override.x))?Number(override.x):(orientation===currentLayout.orientation?finite(currentLayout.x):0);
    const z=Number.isFinite(Number(override.z))?Number(override.z):(orientation===currentLayout.orientation?finite(currentLayout.z):0);

    if(orientation===PARTITION_ORIENTATION.LONG){
      return {
        id:`partition:${index}`,type:'partition',label:`Tabique ${index+1}`,index,
        minX:axisCenter-length/2,maxX:axisCenter+length/2,
        minZ:z-thickness/2,maxZ:z+thickness/2,
        minY:.08+elevation,maxY:.08+elevation+height
      };
    }
    return {
      id:`partition:${index}`,type:'partition',label:`Tabique ${index+1}`,index,
      minX:x-thickness/2,maxX:x+thickness/2,
      minZ:axisCenter-length/2,maxZ:axisCenter+length/2,
      minY:.08+elevation,maxY:.08+elevation+height
    };
  }

  function collisionFor(index,override={}){
    if(typeof window.getSpatialOccupancyVolumes!=='function'||typeof window.spatialVolumesOverlap!=='function') return null;
    const candidate=partitionVolume(index,override);
    const volumes=window.getSpatialOccupancyVolumes();
    return volumes.find(volume=>volume?.blocking!==false&&window.spatialVolumesOverlap(candidate,volume,CLEARANCE))||null;
  }

  function collisionMessage(volume){
    return `El tabique chocaría con ${volume?.label||'otro elemento'}`;
  }

  function proposedDimensions(index,key,value){
    const parsed=Number(value);
    if(!Number.isFinite(parsed)) return null;
    const p=actualLayout('partition',index),c=DATA.containers[state.container];
    const current=objectDimensions('partition',index),next={...current};
    if(key==='length') next.length=clamp(parsed,.30,partitionFullLength(p.orientation));
    else if(key==='height') next.height=clamp(parsed,.30,Math.max(.30,c.height-.06-current.elevation));
    else if(key==='thickness') next.thickness=clamp(parsed,.05,.20);
    else if(key==='elevation') next.elevation=clamp(parsed,0,Math.max(0,c.height-.06-current.height));
    else return null;
    return next;
  }

  function install(){
    if(installed) return true;
    const ready=typeof state!=='undefined'&&typeof validCandidate==='function'&&
      typeof updatePartitionDimension==='function'&&typeof changePartitionOrientation==='function'&&
      typeof updatePartitionPosition==='function'&&typeof anchorPartitionToFace==='function'&&
      typeof onEditorPointerMove==='function'&&typeof perpendicularPositionBounds==='function'&&
      typeof partitionFullLength==='function'&&typeof actualLayout==='function'&&
      typeof objectDimensions==='function'&&typeof window.getSpatialOccupancyVolumes==='function';
    if(!ready) return false;

    const validCandidateBeforeObstacle=validCandidate;
    validCandidate=function(type,index,candidate){
      if(!validCandidateBeforeObstacle(type,index,candidate)) return false;
      if(type!=='partition') return true;
      const p=actualLayout('partition',index);
      const override={orientation:candidate?.orientation||p.orientation};
      if(Number.isFinite(Number(candidate?.x))) override.x=Number(candidate.x);
      if(Number.isFinite(Number(candidate?.z))) override.z=Number(candidate.z);
      return !collisionFor(index,override);
    };

    const updatePositionBeforeObstacle=updatePartitionPosition;
    updatePartitionPosition=function(value){
      if(selectedEditable?.type!=='partition') return updatePositionBeforeObstacle(value);
      const index=selectedEditable.index,p=actualLayout('partition',index),d=objectDimensions('partition',index);
      const parsed=Number(value);
      if(!Number.isFinite(parsed)) return updatePositionBeforeObstacle(value);
      const b=perpendicularPositionBounds(p.orientation,d.thickness);
      const distance=clamp(parsed,0,Math.max(0,b.max-b.min));
      const coord=b.min+distance;
      const override=p.orientation===PARTITION_ORIENTATION.LONG?{z:coord}:{x:coord};
      const hit=collisionFor(index,override);
      if(hit) return toast(collisionMessage(hit));
      return updatePositionBeforeObstacle(value);
    };

    const updateDimensionBeforeObstacle=updatePartitionDimension;
    updatePartitionDimension=function(key,value){
      if(selectedEditable?.type!=='partition') return updateDimensionBeforeObstacle(key,value);
      const index=selectedEditable.index,next=proposedDimensions(index,key,value);
      if(!next) return updateDimensionBeforeObstacle(key,value);
      const override={dimensions:next};
      if(key==='length'&&typeof currentPartitionAnchor==='function'&&typeof anchoredAxisCenter==='function'){
        const anchor=currentPartitionAnchor(index);
        if(anchor) override.axisCenter=anchoredAxisCenter(anchor,next.length);
      }
      const hit=collisionFor(index,override);
      if(hit) return toast(collisionMessage(hit));
      return updateDimensionBeforeObstacle(key,value);
    };

    const changeOrientationBeforeObstacle=changePartitionOrientation;
    changePartitionOrientation=function(orientation){
      if(selectedEditable?.type!=='partition') return changeOrientationBeforeObstacle(orientation);
      const index=selectedEditable.index,current=actualLayout('partition',index);
      if(current.orientation===orientation) return changeOrientationBeforeObstacle(orientation);
      const b=orientationBounds(orientation);
      const dims={...objectDimensions('partition',index),length:partitionFullLength(orientation)};
      const hit=collisionFor(index,{orientation,dimensions:dims,axisCenter:(b.min+b.max)/2,x:0,z:0});
      if(hit) return toast(collisionMessage(hit));
      return changeOrientationBeforeObstacle(orientation);
    };

    const anchorBeforeObstacle=anchorPartitionToFace;
    anchorPartitionToFace=function(face,options){
      if(selectedEditable?.type!=='partition'||!['A','B','C','D'].includes(face)) return anchorBeforeObstacle(face,options);
      const index=selectedEditable.index,before=actualLayout('partition',index),dims=objectDimensions('partition',index);
      const config=partitionAnchorConfig(face),nextLength=clamp(dims.length,.30,partitionFullLength(config.orientation));
      const b=perpendicularPositionBounds(config.orientation,dims.thickness);
      const previousPerp=before.orientation===PARTITION_ORIENTATION.LONG?before.z:before.x;
      const coord=clamp(previousPerp,b.min,b.max);
      const override={
        orientation:config.orientation,
        dimensions:{...dims,length:nextLength},
        axisCenter:anchoredAxisCenter(face,nextLength),
        x:config.orientation===PARTITION_ORIENTATION.LONG?0:coord,
        z:config.orientation===PARTITION_ORIENTATION.LONG?coord:0
      };
      const hit=collisionFor(index,override);
      if(hit) return toast(collisionMessage(hit));
      return anchorBeforeObstacle(face,options);
    };

    if(typeof restorePartitionFullSpan==='function'){
      const restoreBeforeObstacle=restorePartitionFullSpan;
      restorePartitionFullSpan=function(){
        if(selectedEditable?.type!=='partition') return restoreBeforeObstacle();
        const index=selectedEditable.index,p=actualLayout('partition',index),b=orientationBounds(p.orientation);
        const dims={...objectDimensions('partition',index),length:b.max-b.min};
        const hit=collisionFor(index,{dimensions:dims,axisCenter:(b.min+b.max)/2});
        if(hit) return toast(collisionMessage(hit));
        return restoreBeforeObstacle();
      };
    }

    const pointerMoveBeforeObstacle=onEditorPointerMove;
    onEditorPointerMove=function(event){
      if(draggingEditable?.userData.editor?.type!=='partition') return pointerMoveBeforeObstacle(event);
      pointerNDC(event);
      editorRaycaster.setFromCamera(editorPointer,camera);
      const point=new THREE.Vector3();
      if(!editorRaycaster.ray.intersectPlane(dragPlane,point)) return;
      const index=draggingEditable.userData.editor.index,p=actualLayout('partition',index),d=objectDimensions('partition',index);
      const b=perpendicularPositionBounds(p.orientation,d.thickness);
      const raw=p.orientation===PARTITION_ORIENTATION.LONG?point.z:point.x;
      const coord=Math.round(clamp(raw,b.min,b.max)*20)/20;
      const override=p.orientation===PARTITION_ORIENTATION.LONG?{z:coord}:{x:coord};
      if(collisionFor(index,override)) return;
      return pointerMoveBeforeObstacle(event);
    };

    const canvas=renderer?.domElement;
    if(canvas){
      canvas.removeEventListener('pointermove',pointerMoveBeforeObstacle);
      canvas.removeEventListener('pointermove',onEditorPointerMove);
      canvas.addEventListener('pointermove',onEditorPointerMove);
    }

    window.partitionOccupiedVolume=partitionVolume;
    window.partitionObstacleCollision=collisionFor;
    window.BAT_KUBIQUEITOR_PARTITION_OBSTACLE_COLLISION={version:1,partitionVolume,collisionFor};
    installed=true;
    return true;
  }

  if(install()) return;
  let attempts=0;
  const timer=setInterval(()=>{
    attempts++;
    if(install()){clearInterval(timer);return;}
    if(attempts>=200){clearInterval(timer);console.error('bat-kubiqueitor: partition obstacle collision no pudo instalarse');}
  },60);
})();
