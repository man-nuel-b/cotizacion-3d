// Final 3D composition loader.
// Makes the progressive partition renderer authoritative after every full scene rebuild.
(function(){
  if(window.BAT_KUBIQUEITOR_PARTITION_FACE_LOADER) return;
  window.BAT_KUBIQUEITOR_PARTITION_FACE_LOADER=true;

  function asset(name){return `${name}?v=20261024-mod02-07`;}

  function loadOnce(selector,name,datasetKey,onload){
    const existing=document.querySelector(selector);
    if(existing){
      if(existing.dataset.loaded==='true'||existing.readyState==='complete'){onload?.();return;}
      existing.addEventListener('load',()=>onload?.(),{once:true});
      return;
    }
    const script=document.createElement('script');
    script.src=asset(name);script.dataset[datasetKey]='true';
    script.addEventListener('load',()=>{script.dataset.loaded='true';onload?.();},{once:true});
    document.body.appendChild(script);
  }

  function migrateInteriorDoorState(){
    if(!Array.isArray(window.state?.interiorDoors)) return;
    state.interiorDoors.forEach(door=>{
      if(!door||typeof door!=='object') return;
      if(typeof door.enabled!=='boolean') door.enabled=true;
    });
  }

  function loadOrientationControls(){loadOnce('script[data-object-orientation-controls]','object-orientation-controls.js','objectOrientationControls');}

  function emphasizePartitionDoor(){
    if(!window.containerGroup) return;
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

  function rebuildAuthoritativePartitions(){
    if(typeof rebuildParametricPartitions!=='function') return;
    rebuildParametricPartitions();
  }

  function installFinalSceneComposer(){
    if(window.BAT_KUBIQUEITOR_FINAL_SCENE_COMPOSER?.version>=4) return;
    if(typeof rebuild3D!=='function') return;
    const baseRebuild=rebuild3D;
    rebuild3D=function(){
      baseRebuild();
      // editor.js / production-suite may draw a legacy partition first. Replace it here,
      // after the full scene exists, with the progressive per-partition renderer.
      rebuildAuthoritativePartitions();
      window.BAT_KUBIQUEITOR_MODULE_PRESETS?.syncScene?.();
      if(typeof window.renderFloorFinishVisual==='function') window.renderFloorFinishVisual();
      emphasizePartitionDoor();
    };
    window.BAT_KUBIQUEITOR_FINAL_SCENE_COMPOSER={version:4};
    rebuild3D();
  }

  function loadPartitionFaces(){
    migrateInteriorDoorState();
    if(window.BAT_KUBIQUEITOR_PARTITION_FACES){loadOrientationControls();installFinalSceneComposer();return;}
    loadOnce('script[data-partition-face-finishes]','partition-face-finishes.js','partitionFaceFinishes',()=>{
      loadOrientationControls();
      installFinalSceneComposer();
    });
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
    if(dependenciesReady()){clearInterval(timer);loadPartitionFaces();return;}
    if(tries>=150) clearInterval(timer);
  },80);
})();