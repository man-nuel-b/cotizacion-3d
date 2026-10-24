// Robust visual room shell for preset bathroom modules.
// Draws the physical bathroom enclosure from state.bathroomModules even if a fixture renderer fails.
(function(){
  if(window.BAT_KUBIQUEITOR_BATHROOM_ROOM_SHELL) return;

  const PRESET={
    full:{width:2.02,depth:1.12,fixtures:[{type:'wc',x:-.66,z:.08,ry:0},{type:'sink',x:0,z:.16,ry:Math.PI},{type:'shower',x:.64,z:-.02,ry:0}]},
    half:{width:1.38,depth:1.02,fixtures:[{type:'wc',x:-.34,z:.08,ry:0},{type:'sink',x:.34,z:.16,ry:Math.PI}]}
  };

  function safeMat(color,opts){
    if(typeof mat==='function') return mat(color,opts||{});
    return new THREE.MeshStandardMaterial({color,...(opts||{})});
  }
  function safeBox(w,h,d,material,x=0,y=0,z=0){
    if(typeof box==='function') return box(w,h,d,material,x,y,z);
    const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;return m;
  }

  function createFixtureSafe(type){
    try{
      if(type==='wc'&&typeof createWC==='function') return createWC();
      if(type==='sink'&&typeof createSink==='function') return createSink();
      if(type==='shower'&&typeof createShower==='function') return createShower();
    }catch(e){ console.error('Bathroom fixture render failed:',type,e); }
    return null;
  }

  function buildRoom(entry,index){
    const p=PRESET[entry.kind]||PRESET.half;
    const g=new THREE.Group();
    g.name=`bathroom-room-${index+1}`;
    g.userData.bathroomRoomShell=true;
    g.userData.bathroomModuleIndex=index;

    const wallT=.085;
    const height=2.28;
    const doorW=Math.min(.80,p.width-.34);
    const doorH=2.02;
    const wallMat=safeMat(0xf5f7fa,{roughness:.72,metalness:.02});
    const edgeMat=safeMat(0xb8c1ca,{roughness:.32,metalness:.6});
    const floorMat=safeMat(0xd9dde2,{roughness:.88,metalness:.01});

    // Sanitary floor layer, intentionally slightly raised so it is visible over the container floor.
    const floor=safeBox(p.width-.06,.035,p.depth-.06,floorMat,0,.10,0);
    floor.name=`B${index+1}.P`;
    g.add(floor);

    // Rear and side walls.
    g.add(safeBox(p.width,height,wallT,wallMat,0,.10+height/2,-p.depth/2+wallT/2));
    g.add(safeBox(wallT,height,p.depth,wallMat,-p.width/2+wallT/2,.10+height/2,0));
    g.add(safeBox(wallT,height,p.depth,wallMat,p.width/2-wallT/2,.10+height/2,0));

    // Front wall with centered door opening.
    const side=(p.width-doorW)/2;
    if(side>.03){
      g.add(safeBox(side,height,wallT,wallMat,-(doorW/2+side/2),.10+height/2,p.depth/2-wallT/2));
      g.add(safeBox(side,height,wallT,wallMat,(doorW/2+side/2),.10+height/2,p.depth/2-wallT/2));
    }
    if(height-doorH>.04) g.add(safeBox(doorW,height-doorH,wallT,wallMat,0,.10+doorH+(height-doorH)/2,p.depth/2-wallT/2));

    // Door frame for clear visual cue.
    const jamb=.045;
    g.add(safeBox(jamb,doorH,.055,edgeMat,-doorW/2,.10+doorH/2,p.depth/2+.012));
    g.add(safeBox(jamb,doorH,.055,edgeMat,doorW/2,.10+doorH/2,p.depth/2+.012));
    g.add(safeBox(doorW+jamb*2,jamb,.055,edgeMat,0,.10+doorH,p.depth/2+.012));

    // Add fixtures inside this guaranteed-visible enclosure only if the main module renderer did not.
    const mainRoot=(containerGroup?.children||[]).find(child=>child!==g&&child.userData?.bathroomModuleIndex===index&&!child.userData?.bathroomRoomShell);
    if(!mainRoot){
      p.fixtures.forEach(f=>{
        const obj=createFixtureSafe(f.type);if(!obj)return;
        obj.position.set(f.x,.12,f.z);obj.rotation.y=f.ry||0;g.add(obj);
      });
    }

    g.position.set(Number(entry.x)||0,0,Number(entry.z)||0);
    g.rotation.y=THREE.MathUtils.degToRad(Number(entry.rotation)||0);
    return g;
  }

  function addRoomShells(){
    if(!containerGroup||!Array.isArray(state?.bathroomModules)) return;
    [...containerGroup.children].filter(c=>c.userData?.bathroomRoomShell).forEach(c=>containerGroup.remove(c));
    state.bathroomModules.forEach((entry,index)=>containerGroup.add(buildRoom(entry,index)));
  }

  function install(){
    if(typeof rebuild3D!=='function'||typeof THREE==='undefined') return false;
    const previous=rebuild3D;
    rebuild3D=function(){
      let error=null;
      try{ previous(); }catch(e){ error=e; console.error('Base bathroom module renderer failed; room shell fallback applied.',e); }
      addRoomShells();
      if(error&&typeof toast==='function') toast('Se aplicó el render seguro del módulo sanitario');
    };
    addRoomShells();
    window.BAT_KUBIQUEITOR_BATHROOM_ROOM_SHELL={version:1};
    return true;
  }

  let tries=0;
  const timer=setInterval(()=>{tries++;if(install()||tries>40)clearInterval(timer);},50);
})();
