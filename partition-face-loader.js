// Final 3D composition loader.
// Keeps the progressive partition renderer authoritative and applies final scene guardrails.
(function(){
  if(window.BAT_KUBIQUEITOR_PARTITION_FACE_LOADER?.version>=16) return;
  window.BAT_KUBIQUEITOR_PARTITION_FACE_LOADER={version:16};

  const ASSET_VERSION='20261024-mod02-16';
  let authoritativePartitionRenderer=null;
  let composerInstalled=false;
  let viewWrapperInstalled=false;

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

  function normalizeInteriorObjectsInsideContainer(){
    if(typeof state==='undefined'||typeof objectDimensions!=='function'||typeof actualLayout!=='function') return;
    const c=DATA.containers[state.container];
    if(!c) return;
    if(!state.layout) state.layout={};
    const margin=.08;

    ['wc','sink','shower'].forEach(type=>{
      if(!Array.isArray(state.layout[type])) state.layout[type]=[];
      for(let i=0;i<(state.counts[type]||0);i++){
        const dims=objectDimensions(type,i)||{};
        const pos=actualLayout(type,i)||{x:0,z:0};
        const halfW=Math.max(.05,(Number(dims.width)||.40)/2);
        const halfD=Math.max(.05,(Number(dims.depth)||.40)/2);
        const minX=-c.length/2+margin+halfW;
        const maxX=c.length/2-margin-halfW;
        const minZ=-c.width/2+margin+halfD;
        const maxZ=c.width/2-margin-halfD;
        const nextX=Math.min(Math.max(Number(pos.x)||0,minX),maxX);
        const nextZ=Math.min(Math.max(Number(pos.z)||0,minZ),maxZ);
        const existing=state.layout[type][i]||{};
        if(Math.abs(nextX-(Number(pos.x)||0))>.0001||Math.abs(nextZ-(Number(pos.z)||0))>.0001){
          state.layout[type][i]={...existing,x:nextX,z:nextZ};
        }
      }
    });
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

      const handleWidth=.028,handleHeight=.10,handleDepth=.008;
      const handleGeo=new THREE.BoxGeometry(handleDepth,handleHeight,handleWidth);
      const handleMat=new THREE.MeshStandardMaterial({color:0x2f2f2f,roughness:.65,metalness:.20});
      const handleY=.02,handleZ=Math.max(.10,size.z/2-.10),faceOffset=size.x/2+handleDepth/2-.002;

      const frontHandle=new THREE.Mesh(handleGeo,handleMat.clone());
      frontHandle.name='interior-door-handle-front';
      frontHandle.position.set(faceOffset,handleY,handleZ);
      const backHandle=new THREE.Mesh(handleGeo,handleMat.clone());
      backHandle.name='interior-door-handle-back';
      backHandle.position.set(-faceOffset,handleY,handleZ);
      leaf.add(frontHandle,backHandle);
    });
  }

  function disposeRoot(root){
    root?.traverse?.(obj=>{
      obj.geometry?.dispose?.();
      if(Array.isArray(obj.material)) obj.material.forEach(m=>m?.dispose?.());
      else obj.material?.dispose?.();
    });
    root?.parent?.remove?.(root);
  }

  function openingFaceRotation(face){
    if(typeof mountedRotation==='function') return mountedRotation(face);
    if(face==='A') return Math.PI;
    if(face==='B') return 0;
    if(face==='C') return -Math.PI/2;
    return Math.PI/2;
  }

  function createFinalOpening(type,index){
    const dims=objectDimensions(type,index)||{};
    const width=Math.max(.50,Number(dims.width)||.90);
    const height=Math.max(.50,Number(dims.height)||2.10);
    const g=new THREE.Group();
    g.name=`final-${type}-${index+1}`;
    g.userData.finalOpeningVisual=true;

    const recess=new THREE.MeshStandardMaterial({color:0x111827,roughness:.96,metalness:0});
    const voidPanel=new THREE.Mesh(new THREE.BoxGeometry(Math.max(.18,width-.035),Math.max(.18,height-.035),.055),recess);
    voidPanel.position.z=-.075;
    voidPanel.name='wall-opening-void';
    g.add(voidPanel);

    if(type==='openingFrame'){
      const steel=new THREE.MeshStandardMaterial({color:0x64748b,roughness:.30,metalness:.78});
      const t=.055,depth=.20;
      const make=(w,h,d,x,y,z)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),steel);m.position.set(x,y,z);m.name='opening-metal-frame';return m;};
      g.add(
        make(t,height,depth,-width/2+t/2,0,0),
        make(t,height,depth,width/2-t/2,0,0),
        make(width,t,depth,0,height/2-t/2,0)
      );
    }

    const hit=new THREE.Mesh(
      new THREE.BoxGeometry(Math.max(.20,width-.04),Math.max(.20,height-.04),.028),
      new THREE.MeshBasicMaterial({color:0xf59e0b,transparent:true,opacity:.002,depthWrite:false,side:THREE.DoubleSide})
    );
    hit.userData.openingHitbox=true;
    g.add(hit);
    return {group:g,width,height};
  }

  function rebuildFinalOpenings(){
    if(typeof containerGroup==='undefined'||!containerGroup||typeof objectDimensions!=='function'||typeof actualLayout!=='function') return;
    const openingTypes=['opening','openingFrame'];

    if(Array.isArray(editableObjects)){
      const stale=editableObjects.filter(root=>openingTypes.includes(root?.userData?.editor?.type));
      stale.forEach(disposeRoot);
      editableObjects=editableObjects.filter(root=>!openingTypes.includes(root?.userData?.editor?.type));
    }
    [...containerGroup.children].filter(child=>child?.userData?.finalOpeningVisual).forEach(disposeRoot);

    const c=DATA.containers[state.container];
    openingTypes.forEach(type=>{
      for(let i=0;i<(state.counts[type]||0);i++){
        const layout=actualLayout(type,i)||{};
        const face=layout.face||'A';
        const {group,height}=createFinalOpening(type,i);
        const y=.08+height/2;
        group.rotation.y=openingFaceRotation(face);
        if(face==='A') group.position.set(Number(layout.x)||0,y,c.width/2+.005);
        else if(face==='B') group.position.set(Number(layout.x)||0,y,-c.width/2-.005);
        else if(face==='C') group.position.set(c.length/2+.005,y,Number(layout.x)||0);
        else group.position.set(-c.length/2-.005,y,Number(layout.x)||0);
        containerGroup.add(group);
        if(typeof registerEditable==='function'){
          const axis=(face==='A'||face==='B')?'x':'z';
          registerEditable(group,type,i,{axis,surface:face==='A'?'faceA':face==='B'?'faceB':face==='C'?'faceC':'faceD',face});
        }
      }
    });
  }

  function syncInteriorConstructionVisibility(){
    if(typeof containerGroup==='undefined'||!containerGroup) return;
    const show=currentView!=='exterior';
    containerGroup.traverse(obj=>{
      if(obj?.userData?.partitionFaceLabel) obj.visible=show;
    });
  }

  function installViewVisibilityRule(){
    if(viewWrapperInstalled||typeof setView!=='function') return;
    const baseSetView=setView;
    setView=function(view,...args){
      const result=baseSetView(view,...args);
      requestAnimationFrame(syncInteriorConstructionVisibility);
      return result;
    };
    viewWrapperInstalled=true;
  }

  function isProgressiveRenderer(candidate){
    if(window.BAT_KUBIQUEITOR_PARTITION_FACES?.version!==4) return false;
    if(typeof candidate!=='function') return false;
    try{
      const source=Function.prototype.toString.call(candidate);
      return source.includes('buildPartition')&&source.includes('disposePartitionRoot')&&source.includes('registerEditable');
    }catch{return false;}
  }

  function captureAuthoritativeRenderer(){
    if(!isProgressiveRenderer(rebuildParametricPartitions)) return false;
    authoritativePartitionRenderer=rebuildParametricPartitions;
    authoritativePartitionRenderer.__batKubiqueitorProgressivePartitionRenderer=16;
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
    if(composerInstalled||typeof rebuild3D!=='function') return;
    const baseRebuild=rebuild3D;
    rebuild3D=function(){
      normalizeInteriorObjectsInsideContainer();
      baseRebuild();
      rebuildAuthoritativePartitions();
      rebuildFinalOpenings();
      window.BAT_KUBIQUEITOR_MODULE_PRESETS?.syncScene?.();
      if(typeof window.renderFloorFinishVisual==='function') window.renderFloorFinishVisual();
      emphasizePartitionDoor();
      syncInteriorConstructionVisibility();
    };
    composerInstalled=true;
    window.BAT_KUBIQUEITOR_FINAL_SCENE_COMPOSER={version:16};
    installViewVisibilityRule();
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
    script.addEventListener('load',()=>{script.dataset.loaded='true';waitForRealProgressiveRenderer();},{once:true});
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
      typeof rebuildParametricPartitions==='function'&&
      typeof objectDimensions==='function'&&
      typeof actualLayout==='function'
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
      console.error('bat-kubiqueitor: dependencias finales no estuvieron listas a tiempo');
    }
  },80);
})();