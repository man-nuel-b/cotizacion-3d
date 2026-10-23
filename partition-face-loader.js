// Loads per-partition finishes after the complete partition tool chain is installed.
// One render authority only. Video-regression fixes load last so no earlier module can
// replace the final count sync, face-pick priority, safer camera or placement behavior.
(function(){
  if(window.BAT_KUBIQUEITOR_PARTITION_FACE_LOADER) return;
  window.BAT_KUBIQUEITOR_PARTITION_FACE_LOADER=true;

  function asset(name){
    return typeof finalVersionedAsset==='function'?finalVersionedAsset(name):`${name}?v=20261023-46`;
  }

  function setExtrasReady(ready){
    const root=document.getElementById('extras-list');
    if(!root) return;
    root.style.pointerEvents=ready?'':'none';
    root.style.opacity=ready?'':'0.72';
    root.setAttribute('aria-busy',ready?'false':'true');
    let badge=document.getElementById('extras-editor-loading');
    if(!ready){
      if(!badge){
        badge=document.createElement('div');
        badge.id='extras-editor-loading';
        badge.className='mt-2 text-[10px] font-bold text-slate-500 flex items-center gap-2';
        badge.innerHTML='<i class="fa-solid fa-circle-notch fa-spin text-amber-500"></i><span>Preparando editor 3D…</span>';
        root.parentElement?.insertBefore(badge,root);
      }
    }else badge?.remove();
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

  function loadVideoRegressionFixes(){
    loadScriptOnce('data-video-regression-fixes','video-regression-fixes.js',()=>setExtrasReady(true));
  }
  function loadSingleClickExtras(){
    loadScriptOnce('data-single-click-extras','single-click-extras.js',loadVideoRegressionFixes);
  }
  function loadOpeningPlacementFix(){
    loadScriptOnce('data-opening-placement-fix','opening-placement-fix.js',loadSingleClickExtras);
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

  function boot(){
    setExtrasReady(false);
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
      if(tries>200){
        clearInterval(timer);
        setExtrasReady(true);
      }
    },80);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
