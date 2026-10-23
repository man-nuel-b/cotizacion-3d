// Realistic parametric shipping-container shell for bat-kubiqueitor.
// Single authority for the container shell. Windows/vanos are supplied through windowsForFace().
(function(){
  if(window.BAT_KUBIQUEITOR_CONTAINER_REALISM) return;
  if(typeof THREE==='undefined'||typeof createContainerShell!=='function'||typeof box!=='function'||typeof mat!=='function') return;

  const originalCreateContainerShell=createContainerShell;
  const INTERIOR_SHELL_COLOR=0xf1f5f9;

  function tone(color,factor){ return new THREE.Color(color).multiplyScalar(factor); }
  function metal(color,roughness=.56,metalness=.34){
    return new THREE.MeshStandardMaterial({
      color:color instanceof THREE.Color?color:new THREE.Color(color),
      roughness,metalness,envMapIntensity:.45
    });
  }
  function addBox(g,w,h,d,material,x=0,y=0,z=0,name=''){
    const mesh=box(w,h,d,material,x,y,z);
    if(name) mesh.name=name;
    g.add(mesh);
    return mesh;
  }

  function wallOpenings(face,c){
    if(typeof windowsForFace!=='function') return [];
    try{return windowsForFace(face,c)||[];}catch(e){return [];}
  }
  function openingRect(open){
    const center=Number(open.center)||0,width=Math.max(.05,Number(open.width)||0);
    const bottom=Number.isFinite(Number(open.bottom))?Number(open.bottom):.10;
    const top=Number.isFinite(Number(open.top))?Number(open.top):999;
    return {x1:center-width/2-.018,x2:center+width/2+.018,y1:bottom-.018,y2:top+.018};
  }
  function subtractRect(rect,cut){
    const ix1=Math.max(rect.x1,cut.x1),ix2=Math.min(rect.x2,cut.x2),iy1=Math.max(rect.y1,cut.y1),iy2=Math.min(rect.y2,cut.y2);
    if(ix1>=ix2||iy1>=iy2) return [rect];
    const out=[];
    if(rect.x1<ix1) out.push({x1:rect.x1,x2:ix1,y1:rect.y1,y2:rect.y2});
    if(ix2<rect.x2) out.push({x1:ix2,x2:rect.x2,y1:rect.y1,y2:rect.y2});
    if(rect.y1<iy1) out.push({x1:ix1,x2:ix2,y1:rect.y1,y2:iy1});
    if(iy2<rect.y2) out.push({x1:ix1,x2:ix2,y1:iy2,y2:rect.y2});
    return out.filter(r=>r.x2-r.x1>.025&&r.y2-r.y1>.025);
  }
  function subtractOpenings(rect,openings){
    let parts=[rect];
    openings.forEach(open=>{parts=parts.flatMap(part=>subtractRect(part,openingRect(open)));});
    return parts;
  }
  function verticalIntervals(y1,y2,axisValue,openings){
    let parts=[{x1:axisValue-.001,x2:axisValue+.001,y1,y2}];
    openings.forEach(open=>{parts=parts.flatMap(part=>subtractRect(part,openingRect(open)));});
    return parts.map(p=>[p.y1,p.y2]).filter(([a,b])=>b-a>.035);
  }

  function addExteriorLongSkin(g,face,c,material){
    if(state.cutaway&&face==='A') return;
    const L=c.length,H=c.height,W=c.width;
    const z=face==='A'?W/2:-W/2;
    const rect={x1:-L/2+.10,x2:L/2-.10,y1:.09,y2:H-.09};
    subtractOpenings(rect,wallOpenings(face,c)).forEach(r=>{
      addBox(g,r.x2-r.x1,r.y2-r.y1,.046,material,(r.x1+r.x2)/2,(r.y1+r.y2)/2,z,`container-wall-${face}`);
    });
  }
  function addExteriorEndSkin(g,face,c,material){
    const L=c.length,H=c.height,W=c.width;
    const x=face==='C'?L/2:-L/2;
    const rect={x1:-W/2+.10,x2:W/2-.10,y1:.09,y2:H-.09};
    subtractOpenings(rect,wallOpenings(face,c)).forEach(r=>{
      addBox(g,.064,r.y2-r.y1,r.x2-r.x1,material,x,(r.y1+r.y2)/2,(r.x1+r.x2)/2,`container-end-${face}`);
    });
  }

  function addInteriorLongSkin(g,face,c,material){
    if(state.cutaway&&face==='A') return;
    const L=c.length,H=c.height,W=c.width,z=face==='A'?W/2-.071:-W/2+.071;
    const rect={x1:-L/2+.15,x2:L/2-.15,y1:.15,y2:H-.15};
    subtractOpenings(rect,wallOpenings(face,c)).forEach(r=>{
      addBox(g,r.x2-r.x1,r.y2-r.y1,.012,material,(r.x1+r.x2)/2,(r.y1+r.y2)/2,z,`container-interior-${face}`);
    });
  }
  function addInteriorEndSkin(g,face,c,material){
    const L=c.length,H=c.height,W=c.width,x=face==='C'?L/2-.079:-L/2+.079;
    const rect={x1:-W/2+.15,x2:W/2-.15,y1:.15,y2:H-.15};
    subtractOpenings(rect,wallOpenings(face,c)).forEach(r=>{
      addBox(g,.012,r.y2-r.y1,r.x2-r.x1,material,x,(r.y1+r.y2)/2,(r.x1+r.x2)/2,`container-interior-${face}`);
    });
  }
  function addUnifiedInteriorShell(g,c){
    const material=mat(INTERIOR_SHELL_COLOR,{roughness:.78,metalness:.01});
    addInteriorLongSkin(g,'A',c,material);
    addInteriorLongSkin(g,'B',c,material);
    addInteriorEndSkin(g,'C',c,material);
    addInteriorEndSkin(g,'D',c,material);
    if(!state.cutaway) addBox(g,c.length-.30,.012,c.width-.30,material,0,c.height-.073,0,'container-interior-E');
  }

  function addCornerCasting(g,x,y,z,frameMat,darkMat){
    const casting=new THREE.Group(); casting.name='container-corner-casting';
    addBox(casting,.225,.175,.225,frameMat,0,0,0);
    const sideHole=new THREE.Mesh(new THREE.CylinderGeometry(.044,.044,.006,18),darkMat);
    sideHole.rotation.z=Math.PI/2; sideHole.position.x=x>0?.114:-.114; casting.add(sideHole);
    const endHole=new THREE.Mesh(new THREE.CylinderGeometry(.044,.044,.006,18),darkMat);
    endHole.rotation.x=Math.PI/2; endHole.position.z=z>0?.114:-.114; casting.add(endHole);
    if(y>1){const topHole=new THREE.Mesh(new THREE.CylinderGeometry(.038,.038,.006,18),darkMat);topHole.position.y=.089;casting.add(topHole);}
    casting.position.set(x,y,z); g.add(casting);
  }

  function addLongCorrugation(g,L,H,z,side,baseColor,c){
    if(state.cutaway&&side==='A') return;
    const face=side,ribMat=metal(tone(baseColor,.82),.58,.31),highlightMat=metal(tone(baseColor,1.05),.52,.28);
    const openings=wallOpenings(face,c),spacing=.285,count=Math.floor((L-.34)/spacing),depth=.032,outward=side==='A'?1:-1;
    for(let i=0;i<=count;i++){
      const x=-L/2+.17+i*spacing;
      verticalIntervals(.15,H-.15,x,openings).forEach(([y1,y2])=>{
        const h=y2-y1,y=(y1+y2)/2;
        addBox(g,.034,h,depth,ribMat,x,y,z+outward*.038,'container-corrugation');
        if(i%3===1) addBox(g,.010,Math.max(.01,h-.02),.010,highlightMat,x+.020,y,z+outward*.057,'container-corrugation-highlight');
      });
    }
  }
  function addEndCorrugation(g,W,H,x,side,baseColor,c){
    const ribMat=metal(tone(baseColor,.80),.59,.33),highlightMat=metal(tone(baseColor,1.04),.52,.28);
    const openings=wallOpenings(side,c),spacing=.275,count=Math.floor((W-.32)/spacing),outward=side==='C'?1:-1;
    for(let i=0;i<=count;i++){
      const z=-W/2+.16+i*spacing;
      verticalIntervals(.15,H-.15,z,openings).forEach(([y1,y2])=>{
        const h=y2-y1,y=(y1+y2)/2;
        addBox(g,.032,h,.034,ribMat,x+outward*.041,y,z,'container-end-corrugation');
        if(i%3===0) addBox(g,.010,Math.max(.01,h-.02),.010,highlightMat,x+outward*.061,y,z+.018,'container-end-highlight');
      });
    }
  }
  function addRoofCorrugation(g,L,W,H,baseColor){
    if(state.cutaway) return;
    const roofBase=metal(tone(baseColor,.90),.64,.30),roofRib=metal(tone(baseColor,.72),.60,.37);
    addBox(g,L-.20,.045,W-.20,roofBase,0,H-.006,0,'container-roof');
    const spacing=.31,count=Math.floor((L-.34)/spacing);
    for(let i=0;i<=count;i++) addBox(g,.055,.035,W-.28,roofRib,-L/2+.17+i*spacing,H+.026,0,'container-roof-rib');
  }
  function addBaseDetails(g,L,W,frameMat,darkMat){
    addBox(g,L-.10,.145,.115,frameMat,0,.055,-W/2,'container-bottom-rail');
    addBox(g,L-.10,.145,.115,frameMat,0,.055,W/2,'container-bottom-rail');
    addBox(g,.115,.145,W-.10,frameMat,-L/2,.055,0,'container-bottom-end-rail');
    addBox(g,.115,.145,W-.10,frameMat,L/2,.055,0,'container-bottom-end-rail');
    const crossSpacing=.48,count=Math.floor((L-.50)/crossSpacing);
    for(let i=0;i<=count;i++) addBox(g,.055,.075,W-.24,darkMat,-L/2+.25+i*crossSpacing,-.018,0,'container-crossmember');
    if(L<8){[-.62,.62].forEach(offset=>{const p=new THREE.Mesh(new THREE.BoxGeometry(.34,.075,.012),darkMat);p.position.set(offset,.045,-W/2-.061);g.add(p);const p2=p.clone();p2.position.z=W/2+.061;g.add(p2);});}
  }
  function addTopRails(g,L,W,H,frameMat){
    addBox(g,L-.10,.105,.115,frameMat,0,H-.025,-W/2,'container-top-rail');
    if(!state.cutaway) addBox(g,L-.10,.105,.115,frameMat,0,H-.025,W/2,'container-top-rail');
    else addBox(g,L-.24,.065,.080,frameMat,0,H-.025,W/2,'container-cutaway-top-rail');
    addBox(g,.115,.105,W-.10,frameMat,-L/2,H-.025,0,'container-top-end-rail');
    addBox(g,.115,.105,W-.10,frameMat,L/2,H-.025,0,'container-top-end-rail');
  }
  function addCornerPosts(g,L,W,H,frameMat){
    const post=.145;[-L/2,L/2].forEach(x=>[-W/2,W/2].forEach(z=>addBox(g,post,H+.04,post,frameMat,x,H/2,z,'container-corner-post')));
  }
  function addWeldSeams(g,L,W,H,seamMat){
    [-W/2,W/2].forEach(z=>{if(state.cutaway&&z>0)return;addBox(g,L-.32,.010,.009,seamMat,0,.18,z+(z>0?.066:-.066),'container-weld-seam');addBox(g,L-.32,.010,.009,seamMat,0,H-.18,z+(z>0?.066:-.066),'container-weld-seam');});
  }

  function realisticContainerShell(c,materials){
    const g=new THREE.Group(); g.name='realistic-container-shell';
    const L=c.length,W=c.width,H=c.height,baseColor=new THREE.Color(state.exteriorColor);
    const exterior=metal(baseColor,.57,.31),frameMat=metal(tone(baseColor,.54),.43,.58),edgeMat=metal(tone(baseColor,.42),.39,.64),darkMat=metal(0x121923,.48,.58),seamMat=metal(tone(baseColor,.34),.50,.42);

    addBox(g,L,.14,W,materials.floor,0,.02,0,'container-floor-deck');
    addExteriorEndSkin(g,'D',c,exterior); addExteriorEndSkin(g,'C',c,exterior);
    addExteriorLongSkin(g,'B',c,exterior); addExteriorLongSkin(g,'A',c,exterior);
    addUnifiedInteriorShell(g,c);
    addBaseDetails(g,L,W,frameMat,darkMat); addTopRails(g,L,W,H,frameMat); addCornerPosts(g,L,W,H,edgeMat); addRoofCorrugation(g,L,W,H,baseColor);
    addLongCorrugation(g,L,H,-W/2,'B',baseColor,c); addLongCorrugation(g,L,H,W/2,'A',baseColor,c);
    addEndCorrugation(g,W,H,-L/2,'D',baseColor,c); addEndCorrugation(g,W,H,L/2,'C',baseColor,c);
    addWeldSeams(g,L,W,H,seamMat);
    [-L/2,L/2].forEach(x=>[-W/2,W/2].forEach(z=>{addCornerCasting(g,x,.085,z,edgeMat,darkMat);addCornerCasting(g,x,H-.075,z,edgeMat,darkMat);}));

    g.userData.realisticContainer=true; g.userData.interiorShellColor=INTERIOR_SHELL_COLOR;
    return g;
  }

  createContainerShell=realisticContainerShell;
  window.createContainerShell=createContainerShell;
  window.BAT_KUBIQUEITOR_CONTAINER_REALISM={version:3,legacy:originalCreateContainerShell,interiorColor:INTERIOR_SHELL_COLOR};

  if(typeof containerGroup!=='undefined'&&containerGroup&&typeof rebuild3D==='function'){
    try{rebuild3D();}catch(e){console.warn('Container realism rebuild skipped',e);}
  }
})();
