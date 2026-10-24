// Final 3D composition loader.
// Accepts only the real progressive partition renderer and keeps it authoritative.
(function(){
  if(window.BAT_KUBIQUEITOR_PARTITION_FACE_LOADER?.version>=12) return;
  window.BAT_KUBIQUEITOR_PARTITION_FACE_LOADER={version:12};

  const ASSET_VERSION='20261024-mod02-12';
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

    containerGroup.traverse(hinge=>{
      if(hinge?.name!=='interior-door-hinge') return;
      const leaf=hinge.children.find(child=>child?.name==='interior-door-leaf');
      if(!leaf?.geometry) return;

      const knobs=hinge.children.filter(child=>child?.isMesh&&child.geometry?.type==='SphereGeometry');
      knobs.forEach(knob=>{
        hinge.remove(knob);
        knob.geometry?.dispose?.();
        knob.material?.dispose?.();
      });

      const oldDetails=[];
      leaf.traverse(child=>{
        if(child?.name==='interior-door-handle-front'||child?.name==='interior-door-handle-back') oldDetails.push(child);
      });
      oldDetails.forEach(obj=>leaf.remove(obj));

      leaf.geometry.computeBoundingBox();
      const size=new THREE.Vector3();
      leaf.geometry.boundingBox.getSize(size);

      const handleWidth=.028;
      const handleHeight=.10;
      const handleDepth=.008;
      const handleGeo=new THREE.BoxGeometry(handleDepth,handleHeight,handleWidth);
      const handleMat=new THREE.MeshStandardMaterial({color:0x2f2f2f,roughness:.65,metalness:.20});
      const handleY=.02;
      const handleZ=Math.max(.10,size.z/2-.10);
      const faceOffset=size.x/2+handleDepth/2-.002;

      const frontHandle=new THREE.Mesh(handleGeo,handleMat.clone());
      frontHandle.name='interior-door-handle-front';
      frontHandle.position.set(faceOffset,handleY,handleZ);

      const backHandle=new THREE.Mesh(handleGeo,handleMat.clone());
      backHandle.name='interior-door-handle-back';
      backHandle.position.set(-faceOffset,handleY,handleZ);

      leaf.add(frontHandle);
      leaf.add(backHandle);
    });
  }

  function isProgressiveRenderer(candidate){
    if(window.BAT_KUBIQUEITOR_PARTITION_FACES?.version!==4) return false;
    if(typeof candidate!=='function') return false;
    try{
      const source=Function.prototype.toString.call(candidate);
      return source.includes('buildPartition')&&
        source.includes('disposePartitionRoot')&&
        source.includes('registerEditable');
    }catch{
      return false;
    }
  }

  function captureAuthoritativeRenderer(){
    if(!isProgressiveRenderer(rebuildParametricPartitions)) return false;
    authoritativePartitionRenderer=rebuildParametricPartitions;
    authoritativePartitionRenderer.__batKubiqueitorProgressivePartitionRenderer=12;
    window.BAT_KUBIQUEITOR_AUTHORITATIVE_PARTITION_RENDERER=authoritativePartitionRenderer;
    return true;
  }

  function restoreAuthoritativeRenderer(){
    const renderer=window.BAT_KUBIQUEITOR_AUTHORITATIVE_PARTITION_RENDERER||authoritativePartitionRenderer;
    if(!isProgressiveRenderer(renderer)) return false;
    if(rebuildParametricPartitions!==renderer) rebuildParametricPartitions=renderer;
    return true;
  }

  function rebuildAuthoritativePartitions(){
    if(!restoreAuthoritativeRenderer()) return false;
    rebuildParametricPartitions();
    return true;
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
    window.BAT_KUBIQUEITOR_FINAL_SCENE_COMPOSER={version:12};
    rebuild3D();
  }

  function waitForRealProgressiveRenderer(){
    let attempts=0;
    const timer=setInterval(()=>{
      attempts++;
      if(captureAuthoritativeRenderer()){
        clearInterval(timer);
        loadOrientationControls();
        installFinalSceneComposer();
        return;
      }
      if(attempts>=180){
        clearInterval(timer);
        console.error('bat-kubiqueitor: partition-face-finishes cargó pero el renderer progresivo real no quedó instalado');
      }
    },80);
  }

  function forceFreshPartitionFaces(){
    migrateInteriorDoorState();

    const old=document.querySelector('script[data-partition-face-finishes]');
    if(old) old.remove();
    window.BAT_KUBIQUEITOR_PARTITION_FACES=null;
    window.BAT_KUBIQUEITOR_AUTHORITATIVE_PARTITION_RENDERER=null;
    authoritativePartitionRenderer=null;

    const script=document.createElement('script');
    script.src=asset('partition-face-finishes.js');
    script.dataset.partitionFaceFinishes='true';
    script.addEventListener('load',()=>{
      script.dataset.loaded='true';
      waitForRealProgressiveRenderer();
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
      typeof rebuild3D==='function'&&
      typeof rebuildParametricPartitions==='function'
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