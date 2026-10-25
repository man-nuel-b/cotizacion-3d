// Electrical stage 2: isolated 3D visualization only.
// Does not register electrical objects in the direct editor and does not mutate project state.
(function(){
  if(window.BAT_KUBIQUEITOR_ELECTRICAL_VISUAL_STAGE2) return;

  const VERSION=1;
  let installed=false;
  let wrappedRebuild=null;

  function electricalPoints(){
    const points=state?.electrical?.points;
    return Array.isArray(points)?points:[];
  }

  function makeMaterial(color,opts={}){
    return new THREE.MeshStandardMaterial({color,roughness:.38,metalness:.06,...opts});
  }

  function box(w,h,d,material){
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);
    mesh.castShadow=true;
    mesh.receiveShadow=true;
    mesh.userData.electricalVisual=true;
    mesh.userData.ignoreEditor=true;
    return mesh;
  }

  function createOutlet(){
    const g=new THREE.Group();
    const shell=makeMaterial(0xf8fafc);
    const dark=makeMaterial(0x334155,{roughness:.55});
    g.add(box(.14,.09,.026,shell));
    [-.032,.032].forEach(x=>{
      const hole=new THREE.Mesh(new THREE.CircleGeometry(.009,14),dark);
      hole.position.set(x,0,.0145);
      hole.userData.electricalVisual=true;
      hole.userData.ignoreEditor=true;
      g.add(hole);
    });
    return g;
  }

  function createSwitch(){
    const g=new THREE.Group();
    g.add(box(.09,.13,.027,makeMaterial(0xf8fafc)));
    const rocker=box(.052,.07,.013,makeMaterial(0xe2e8f0));
    rocker.position.z=.020;
    rocker.rotation.x=-.08;
    g.add(rocker);
    return g;
  }

  function createAcPoint(){
    const g=createOutlet();
    const badge=box(.045,.022,.014,makeMaterial(0x38bdf8,{emissive:0x0c4a6e,emissiveIntensity:.18}));
    badge.position.set(.043,.028,.022);
    g.add(badge);
    return g;
  }

  function createLightMarker(){
    const g=new THREE.Group();
    const rim=new THREE.Mesh(
      new THREE.CylinderGeometry(.105,.105,.018,24),
      makeMaterial(0xffffff,{emissive:0xffe7a3,emissiveIntensity:.36})
    );
    rim.rotation.x=Math.PI/2;
    rim.userData.electricalVisual=true;
    rim.userData.ignoreEditor=true;
    g.add(rim);
    const center=new THREE.Mesh(
      new THREE.CylinderGeometry(.062,.062,.021,24),
      makeMaterial(0xfff7d6,{emissive:0xffc84a,emissiveIntensity:.58})
    );
    center.rotation.x=Math.PI/2;
    center.position.z=.003;
    center.userData.electricalVisual=true;
    center.userData.ignoreEditor=true;
    g.add(center);
    return g;
  }

  function tagGroup(group,point){
    group.userData.electricalVisual=true;
    group.userData.ignoreEditor=true;
    group.userData.electricalPointId=point.id||null;
    group.traverse(obj=>{
      obj.userData.electricalVisual=true;
      obj.userData.ignoreEditor=true;
      obj.userData.electricalPointId=point.id||null;
    });
    return group;
  }

  function fallbackPlacement(point,index,typeIndex,typeCount,c){
    if(point.type==='light'){
      const usable=Math.max(.5,c.length-1.4);
      const x=typeCount<=1?0:-usable/2+(usable/(typeCount-1))*typeIndex;
      return {face:'ceiling',x,y:c.height-.075,z:0};
    }

    const defaultHeight=point.type==='switch'?1.10:point.type==='acPoint'?2.15:.35;
    const storedFace=['A','B','C','D'].includes(point.face)?point.face:null;
    const face=storedFace||(typeIndex%2===0?'B':'A');
    const alongLong=face==='A'||face==='B';
    const dim=alongLong?c.length:c.width;
    const usable=Math.max(.45,dim-1.2);
    const slot=typeCount<=1?0:-usable/2+(usable/(typeCount-1))*typeIndex;
    const x=Number.isFinite(point.position?.x)?point.position.x:slot;
    const y=Number.isFinite(point.height)?point.height:defaultHeight;
    return {face,x,y,z:0};
  }

  function placeWallObject(obj,p,c){
    const inset=.064;
    obj.rotation.set(0,0,0);
    if(p.face==='A'){
      obj.position.set(p.x,p.y,c.width/2-inset);
      obj.rotation.y=Math.PI;
    }else if(p.face==='B'){
      obj.position.set(p.x,p.y,-c.width/2+inset);
    }else if(p.face==='C'){
      obj.position.set(c.length/2-inset,p.y,p.x);
      obj.rotation.y=-Math.PI/2;
    }else{
      obj.position.set(-c.length/2+inset,p.y,p.x);
      obj.rotation.y=Math.PI/2;
    }
  }

  function disposeOwnRoot(root){
    root.traverse(obj=>{
      obj.geometry?.dispose?.();
      if(Array.isArray(obj.material)) obj.material.forEach(m=>m?.dispose?.());
      else obj.material?.dispose?.();
    });
  }

  function removePreviousVisuals(){
    if(!containerGroup) return;
    const old=containerGroup.children.filter(child=>child.userData?.electricalStage2Root);
    old.forEach(root=>{
      containerGroup.remove(root);
      disposeOwnRoot(root);
    });
  }

  function renderVisuals(){
    if(typeof THREE==='undefined'||typeof state==='undefined'||typeof DATA==='undefined'||!containerGroup) return false;
    removePreviousVisuals();
    const points=electricalPoints();
    if(!points.length) return true;

    const c=DATA.containers[state.container];
    if(!c) return false;

    const root=new THREE.Group();
    root.name='electricalVisualStage2Root';
    root.userData.electricalStage2Root=true;
    root.userData.ignoreEditor=true;

    const groups={outlet:[],switch:[],light:[],acPoint:[]};
    points.forEach((point,index)=>{
      const key=groups[point.type]?point.type:'outlet';
      groups[key].push({point,index});
    });

    Object.entries(groups).forEach(([type,list])=>{
      list.forEach((entry,typeIndex)=>{
        const point=entry.point;
        const p=fallbackPlacement(point,entry.index,typeIndex,list.length,c);
        let obj;
        if(type==='switch') obj=createSwitch();
        else if(type==='acPoint') obj=createAcPoint();
        else if(type==='light') obj=createLightMarker();
        else obj=createOutlet();
        tagGroup(obj,point);
        if(type==='light') obj.position.set(p.x,p.y,p.z);
        else placeWallObject(obj,p,c);
        root.add(obj);
      });
    });

    containerGroup.add(root);
    return true;
  }

  function install(){
    if(installed) return true;
    if(typeof rebuild3D!=='function'||typeof THREE==='undefined'||typeof state==='undefined') return false;
    wrappedRebuild=rebuild3D;
    rebuild3D=function(){
      const result=wrappedRebuild.apply(this,arguments);
      try{ renderVisuals(); }catch(error){ console.warn('[Electrical stage 2] visual render skipped',error); }
      return result;
    };
    installed=true;
    renderVisuals();
    window.BAT_KUBIQUEITOR_ELECTRICAL_VISUAL_STAGE2={
      version:VERSION,
      refresh:renderVisuals,
      uninstall:function(){
        if(installed&&rebuild3D!==wrappedRebuild) rebuild3D=wrappedRebuild;
        installed=false;
        removePreviousVisuals();
      }
    };
    return true;
  }

  function boot(attempt=0){
    if(window.BAT_KUBIQUEITOR_ELECTRICAL_UI_STAGE1&&install()) return;
    if(attempt<20) setTimeout(()=>boot(attempt+1),150);
  }

  setTimeout(()=>boot(),120);
})();
