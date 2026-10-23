// Loads per-partition finishes after the complete partition tool chain is installed.
// One render authority only. Interaction/per-placement fixes load last so no earlier
// module can replace the optimized drag or mounted placement behavior.
(function(){
  if(window.BAT_KUBIQUEITOR_PARTITION_FACE_LOADER) return;
  window.BAT_KUBIQUEITOR_PARTITION_FACE_LOADER=true;

  function asset(name){
    return typeof finalVersionedAsset==='function'?finalVersionedAsset(name):`${name}?v=20261023-43`;
  }

  function loadScriptOnce(attr,name,onReady){
    const selector=`script[${attr}]`;
    const existing=document.querySelector(selector);
    if(existing){
      if(existing.dataset.loaded==='true') setTimeout(()=>onReady?.(),0);
      else if(onReady) existing.addEventListener('load',onReady,{once:true});
      return;
    }
    const script=document.createElement('script');
    script.src=asset(name);
    script.setAttribute(attr,'true');
    script.addEventListener('load',()=>{script.dataset.loaded='true';onReady?.();},{once:true});
    document.body.appendChild(script);
  }

  function loadOpeningPlacementFix(){
    loadScriptOnce('data-opening-placement-fix','opening-placement-fix.js',()=>{});
  }
  function loadInteractionPerformance(){
    loadScriptOnce('data-interaction-performance','interaction-performance.js',loadOpeningPlacementFix);
  }
  function loadCutawayWorkspace(){
    loadScriptOnce('data-cutaway-workspace','cutaway-workspace.js',loadInteractionPerformance);
  }
  function loadStateIntegrity(){
    loadScriptOnce('data-partition-state-integrity','partition-state-integrity.js',loadCutawayWorkspace);
  }
  function loadInteriorDoorExtra(){
    loadScriptOnce('data-interior-door-extra','interior-door-extra.js',loadStateIntegrity);
  }
  function loadOrientationControls(){
    loadScriptOnce('data-object-orientation-controls','object-orientation-controls.js',loadInteriorDoorExtra);
  }
  function continueAfterPartitionFaces(){
    setTimeout(loadOrientationControls,0);
  }

  let tries=0;
  const timer=setInterval(()=>{
    tries++;
    if(window.BAT_KUBIQUEITOR_PARTITION_FACES){
      clearInterval(timer);
      continueAfterPartitionFaces();
      return;
    }
    if(window.BAT_KUBIQUEITOR_PARTITION_DUPLICATE && typeof finalVersionedAsset==='function'){
      clearInterval(timer);
      loadScriptOnce('data-partition-face-finishes','partition-face-finishes.js',continueAfterPartitionFaces);
      return;
    }
    if(tries>200) clearInterval(timer);
  },80);
})();
