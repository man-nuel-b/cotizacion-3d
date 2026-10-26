// Bidirectional collision guard for floor fixtures vs interior partitions.
// Reuses the authoritative partition volume exported by partition-obstacle-collision.js.
(function(){
  if(window.BAT_KUBIQUEITOR_INTERIOR_FIXTURE_COLLISION) return;

  const TYPES=new Set(['wc','sink','shower']);
  const CLEARANCE=.04;
  let installed=false;

  function finite(value,fallback=0){
    const n=Number(value);
    return Number.isFinite(n)?n:fallback;
  }

  function fixtureVolume(type,index,candidate=null,dimsOverride=null){
    if(!TYPES.has(type)||typeof objectDimensions!=='function'||typeof actualLayout!=='function') return null;
    const pos=candidate||actualLayout(type,index)||{x:0,z:0};
    const dims=dimsOverride||objectDimensions(type,index)||{};
    const width=Math.max(.10,finite(dims.width,.50));
    const depth=Math.max(.10,finite(dims.depth,.50));
    const height=Math.max(.10,finite(dims.height,.80));
    const x=finite(pos.x),z=finite(pos.z);
    return {
      id:`fixture:${type}:${index}`,
      type,
      index,
      label:type==='wc'?'WC':type==='sink'?'Lavamanos':'Ducha',
      minX:x-width/2,maxX:x+width/2,
      minZ:z-depth/2,maxZ:z+depth/2,
      minY:.08,maxY:.08+height,
      blocking:true
    };
  }

  function overlaps(a,b,clearance=CLEARANCE){
    if(typeof window.spatialVolumesOverlap==='function') return window.spatialVolumesOverlap(a,b,clearance);
    if(!a||!b) return false;
    return a.minX-clearance<b.maxX&&a.maxX+clearance>b.minX&&
      a.minZ-clearance<b.maxZ&&a.maxZ+clearance>b.minZ&&
      a.minY-clearance<b.maxY&&a.maxY+clearance>b.minY;
  }

  function partitionHit(type,index,candidate=null,dimsOverride=null){
    const fixture=fixtureVolume(type,index,candidate,dimsOverride);
    if(!fixture||typeof window.partitionOccupiedVolume!=='function') return null;
    const count=Math.max(0,Number(state?.counts?.partition)||0);
    for(let i=0;i<count;i++){
      const partition=window.partitionOccupiedVolume(i);
      if(partition&&overlaps(fixture,partition,CLEARANCE)) return partition;
    }
    return null;
  }

  function install(){
    if(installed) return true;
    const ready=typeof state!=='undefined'&&typeof validCandidate==='function'&&
      typeof actualLayout==='function'&&typeof objectDimensions==='function'&&
      typeof window.partitionOccupiedVolume==='function';
    if(!ready) return false;

    const validBefore=validCandidate;
    validCandidate=function(type,index,candidate){
      if(!validBefore(type,index,candidate)) return false;
      if(!TYPES.has(type)) return true;
      return !partitionHit(type,index,candidate);
    };

    if(typeof dimensionChangeAllowed==='function'){
      const dimensionsBefore=dimensionChangeAllowed;
      dimensionChangeAllowed=function(type,index,next){
        if(!dimensionsBefore(type,index,next)) return false;
        if(!TYPES.has(type)) return true;
        return !partitionHit(type,index,actualLayout(type,index),next);
      };
    }

    window.fixturePartitionCollision=partitionHit;
    window.BAT_KUBIQUEITOR_INTERIOR_FIXTURE_COLLISION={
      version:1,
      fixtureVolume,
      partitionHit
    };
    installed=true;
    return true;
  }

  if(install()) return;
  let attempts=0;
  const timer=setInterval(()=>{
    attempts++;
    if(install()){clearInterval(timer);return;}
    if(attempts>=200){
      clearInterval(timer);
      console.error('bat-kubiqueitor: fixture/partition collision no pudo instalarse');
    }
  },60);
})();
