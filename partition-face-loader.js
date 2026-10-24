// Final 3D composition loader.
// Waits for the complete feature chain, then installs the partition face system last
// and composes bathroom modules + selected floor after every complete scene rebuild.
(function(){
  if(window.BAT_KUBIQUEITOR_PARTITION_FACE_LOADER) return;
  window.BAT_KUBIQUEITOR_PARTITION_FACE_LOADER=true;

  function asset(name){
    return typeof finalVersionedAsset==='function'
      ? finalVersionedAsset(name)
      : `${name}?v=20261024-mod01`;
  }

  function loadOnce(selector,name,datasetKey,onload){
    const existing=document.querySelector(selector);
    if(existing){
      if(existing.dataset.loaded==='true'){ onload?.(); return; }
      existing.addEventListener('load',()=>onload?.(),{once:true});
      return;
    }
    const script=document.createElement('script');
    script.src=asset(name);
    script.dataset[datasetKey]='true';
    script.addEventListener('load',()=>{script.dataset.loaded='true';onload?.();},{once:true});
    document.body.appendChild(script);
  }

  function loadOrientationControls(){
    loadOnce('script[data-object-orientation-controls]','object-orientation-controls.js','objectOrientationControls');
  }

  function installFinalSceneComposer(){
    if(window.BAT_KUBIQUEITOR_FINAL_SCENE_COMPOSER) return;
    if(typeof rebuild3D!=='function') return;
    const baseRebuild=rebuild3D;
    rebuild3D=function(){
      baseRebuild();
      window.BAT_KUBIQUEITOR_MODULE_PRESETS?.syncScene?.();
      if(typeof window.renderFloorFinishVisual==='function') window.renderFloorFinishVisual();
    };
    window.BAT_KUBIQUEITOR_FINAL_SCENE_COMPOSER={version:1};
    rebuild3D();
  }

  function loadPartitionFaces(){
    if(window.BAT_KUBIQUEITOR_PARTITION_FACES){
      loadOrientationControls();
      installFinalSceneComposer();
      return;
    }
    loadOnce('script[data-partition-face-finishes]','partition-face-finishes.js','partitionFaceFinishes',()=>{
      loadOrientationControls();
      installFinalSceneComposer();
    });
  }

  function dependenciesReady(){
    return Boolean(
      window.BAT_KUBIQUEITOR_PARTITION_DUPLICATE &&
      window.BAT_KUBIQUEITOR_PRODUCTION_SUITE &&
      window.BAT_KUBIQUEITOR_MODULE_PRESETS &&
      window.BAT_KUBIQUEITOR_FLOOR_FINISHES &&
      typeof rebuild3D==='function'
    );
  }

  let tries=0;
  const timer=setInterval(()=>{
    tries++;
    if(dependenciesReady()){
      clearInterval(timer);
      loadPartitionFaces();
      return;
    }
    if(tries>=150) clearInterval(timer);
  },80);
})();