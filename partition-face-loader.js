// Loads per-partition finishes only after the complete partition tool chain is installed.
(function(){
  if(window.BAT_KUBIQUEITOR_PARTITION_FACE_LOADER) return;
  window.BAT_KUBIQUEITOR_PARTITION_FACE_LOADER=true;

  function loadOrientationControls(){
    if(document.querySelector('script[data-object-orientation-controls]')) return;
    const script=document.createElement('script');
    script.src=typeof finalVersionedAsset==='function'?finalVersionedAsset('object-orientation-controls.js'):'object-orientation-controls.js?v=20261023-30';
    script.dataset.objectOrientationControls='true';
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
