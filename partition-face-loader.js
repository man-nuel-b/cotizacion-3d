// Loads per-partition finishes only after the complete partition tool chain is installed.
(function(){
  if(window.BAT_KUBIQUEITOR_PARTITION_FACE_LOADER) return;
  window.BAT_KUBIQUEITOR_PARTITION_FACE_LOADER=true;

  function asset(name){
    return typeof finalVersionedAsset==='function'?finalVersionedAsset(name):`${name}?v=20261023-36`;
  }

  function loadLiveRefresh(){
    if(document.querySelector('script[data-partition-live-refresh]')) return;
    const script=document.createElement('script');
    script.src=asset('partition-live-refresh.js');
    script.dataset.partitionLiveRefresh='true';
    document.body.appendChild(script);
  }

  function loadStateIntegrity(){
    const existing=document.querySelector('script[data-partition-state-integrity]');
    if(existing){
      if(window.BAT_KUBIQUEITOR_PARTITION_STATE_INTEGRITY) setTimeout(loadLiveRefresh,20);
      else existing.addEventListener('load',()=>setTimeout(loadLiveRefresh,20),{once:true});
      return;
    }
    const script=document.createElement('script');
    script.src=asset('partition-state-integrity.js');
    script.dataset.partitionStateIntegrity='true';
    script.addEventListener('load',()=>setTimeout(loadLiveRefresh,20),{once:true});
    document.body.appendChild(script);
  }

  function loadInteriorDoorExtra(){
    const existing=document.querySelector('script[data-interior-door-extra]');
    if(existing){
      if(window.BAT_KUBIQUEITOR_INTERIOR_DOOR_EXTRA) setTimeout(loadStateIntegrity,20);
      else existing.addEventListener('load',()=>setTimeout(loadStateIntegrity,20),{once:true});
      return;
    }
    const script=document.createElement('script');
    script.src=asset('interior-door-extra.js');
    script.dataset.interiorDoorExtra='true';
    script.addEventListener('load',()=>setTimeout(loadStateIntegrity,20),{once:true});
    document.body.appendChild(script);
  }

  function loadOrientationControls(){
    const existing=document.querySelector('script[data-object-orientation-controls]');
    if(existing){
      if(window.BAT_KUBIQUEITOR_OBJECT_ORIENTATION) setTimeout(loadInteriorDoorExtra,20);
      else existing.addEventListener('load',()=>setTimeout(loadInteriorDoorExtra,20),{once:true});
      return;
    }
    const script=document.createElement('script');
    script.src=asset('object-orientation-controls.js');
    script.dataset.objectOrientationControls='true';
    script.addEventListener('load',()=>setTimeout(loadInteriorDoorExtra,20),{once:true});
    document.body.appendChild(script);
  }

  let tries=0;
  const timer=setInterval(()=>{
    tries++;
    if(window.BAT_KUBIQUEITOR_PARTITION_FACES){
      clearInterval(timer);
      setTimeout(loadOrientationControls,20);
      return;
    }
    if(window.BAT_KUBIQUEITOR_PARTITION_DUPLICATE && typeof finalVersionedAsset==='function'){
      clearInterval(timer);
      const script=document.createElement('script');
      script.src=finalVersionedAsset('partition-face-finishes.js');
      script.dataset.partitionFaceFinishes='true';
      script.addEventListener('load',()=>setTimeout(loadOrientationControls,20),{once:true});
      document.body.appendChild(script);
      return;
    }
    if(tries>200) clearInterval(timer);
  },80);
})();
