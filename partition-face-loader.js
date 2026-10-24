// Final 3D composition loader.
// Keeps the progressive partition renderer authoritative even if later modules replace it.
(function(){
  if(window.BAT_KUBIQUEITOR_PARTITION_FACE_LOADER?.version>=10) return;
  window.BAT_KUBIQUEITOR_PARTITION_FACE_LOADER={version:10};

  const ASSET_VERSION='20261024-mod02-10';
  let authoritativePartitionRenderer=null;
  let composerInstalled=false;

  function asset(name){return `${name}?v=${ASSET_VERSION}`;}

  function loadOnce(selector,name,datasetKey,onload){
    const existing=document.querySelector(selector);
    if(existing){
      if(existing.dataset.loaded==='true'||existing.readyState==='complete'){onload?.();return;}
      existing.addEventListener('load',()=>onload?.(),{once:true});
      return;
    }
    const script=document.createElement('script');
    script.src=asset(name);
    script.dataset[datasetKey]='true';
    script.addEventListener('load',()=>{script.dataset.loaded='true';onload?.();},{once:true});
    script.addEventListener('error',()=>console.error(`bat-kubiqueitor: no se pudo cargar ${name}`),{once:true});
    document.body.appendChild(script);
  }

  function migrateInteriorDoorState(){
    if(typeof state==='undefined'||!Array.isArray(state.interiorDoors)) return;
    state.interiorDoors.forEach(door=>{
      if(!door||typeof door!=='object') return;
      if(typeof door.enabled!=='boolean') door.enabled=true;
    });
  }

  function loadOrientationControls(){
    loadOnce('script[data-object-orientation-controls]','object-orientation-controls.js','objectOrientationControls');
  }

  function emphasizePartitionDoor(){
    if(typeof containerGroup==='undefined'||!containerGroup) return;
    containerGroup.traverse(obj=>{
      if(obj?.name==='interior-door-leaf'&&obj.material){
        obj.material=obj.material.clone();
        obj.material.color.setHex(0xf59e0b);
        obj.material.emissive?.setHex?.(0x3b1a00);
        obj.material.emissiveIntensity=.12;
        obj.material.roughness=.35;
        obj.material.metalness=.03;
      }
    });
  }

  function captureAuthoritativeRenderer(){
    if(typeof rebuildParametricPartitions!=='function') return false;
    authoritativePartitionRenderer=rebuildParametricPartitions;
    window.BAT_KUBIQUEITOR_AUTHORITATIVE_PARTITION_RENDERER=authoritativePartitionRenderer;
    return true;
  }

  function restoreAuthoritativeRenderer(){
    const renderer=window.BAT_KUBIQUEITOR_AUTHORITATIVE_PARTITION_RENDERER||authoritativePartitionRenderer;
    if(typeof renderer!=='function') return false;
    if(rebuildParametricPartitions!==renderer) rebuildParametricPartitions=renderer;
    return true;
  }

  function rebuildAuthoritativePartitions(){
    if(!restoreAuthoritativeRenderer()) return;
    rebuildParametricPartitions();
  }

  function installFinalSceneComposer(){
    if(composerInstalled) return;
    if(typeof rebuild3D!=='function') return;
    const baseRebuild=rebuild3D;
    rebuild3D=function(){
      baseRebuild();
      rebuildAuthoritativePartitions();
      window.BAT_KUBIQUEITOR_MODULE_PRESETS?.syncScene?.();
      if(typeof window.renderFloorFinishVisual==='function') window.renderFloorFinishVisual();
      emphasizePartitionDoor();
    };
    composerInstalled=true;
    window.BAT_KUBIQUEITOR_FINAL_SCENE_COMPOSER={version:10};
    rebuild3D();
  }

  function forceFreshPartitionFaces(){
    migrateInteriorDoorState();

    // The old loaded flag is not enough: production-suite may have replaced the renderer
    // after partition-face-finishes executed. Clear the marker and install a fresh copy now,
    // after all production dependencies are ready.
    const old=document.querySelector('script[data-partition-face-finishes]');
    if(old) old.remove();
    window.BAT_KUBIQUEITOR_PARTITION_FACES=null;

    const script=document.createElement('script');
    script.src=asset('partition-face-finishes.js');
    script.dataset.partitionFaceFinishes='true';
    script.addEventListener('load',()=>{
      script.dataset.loaded='true';
      if(!captureAuthoritativeRenderer()){
        console.error('bat-kubiqueitor: el renderer progresivo de divisiones no quedó instalado');
        return;
      }
      loadOrientationControls();
      installFinalSceneComposer();
    },{once:true});
    script.addEventListener('error',()=>console.error('bat-kubiqueitor: no se pudo reinstalar partition-face-finishes.js'),{once:true});
    document.body.appendChild(script);
  }

  function dependenciesReady(){
    return Boolean(
      window.BAT_KUBIQUEITOR_PARTITION_DUPLICATE&&
      window.BAT_KUBIQUEITOR_PRODUCTION_SUITE&&
      window.BAT_KUBIQUEITOR_MODULE_PRESETS&&
      window.BAT_KUBIQUEITOR_FLOOR_FINISHES&&
      typeof rebuild3D==='function'
    );
  }

  let tries=0;
  const timer=setInterval(()=>{
    tries++;
    if(dependenciesReady()){
      clearInterval(timer);
      forceFreshPartitionFaces();
      return;
    }
    if(tries>=180){
      clearInterval(timer);
      console.error('bat-kubiqueitor: dependencias de divisiones no estuvieron listas a tiempo');
    }
  },80);
})();