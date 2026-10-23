// Loads per-partition finishes only after the complete partition tool chain is installed.
(function(){
  if(window.BAT_KUBIQUEITOR_PARTITION_FACE_LOADER) return;
  window.BAT_KUBIQUEITOR_PARTITION_FACE_LOADER=true;
  let tries=0;
  const timer=setInterval(()=>{
    tries++;
    if(window.BAT_KUBIQUEITOR_PARTITION_FACES){ clearInterval(timer); return; }
    if(window.BAT_KUBIQUEITOR_PARTITION_DUPLICATE && typeof finalVersionedAsset==='function'){
      clearInterval(timer);
      const script=document.createElement('script');
      script.src=finalVersionedAsset('partition-face-finishes.js');
      script.dataset.partitionFaceFinishes='true';
      document.body.appendChild(script);
      return;
    }
    if(tries>200) clearInterval(timer);
  },80);
})();
