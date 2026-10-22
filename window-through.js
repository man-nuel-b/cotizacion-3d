// Pass-through windows with real wall openings for bat-kubiqueitor.
// Loaded after dimensions, partitions and bounds layers.

function windowOpeningY(c,dims){
  const half=dims.height/2;
  return clamp(c.height*.60,half+.15,c.height-half-.15);
}

function windowsForFace(face,c){
  const openings=[];
  for(let i=0;i<(state.counts.window||0);i++){
    const layout=actualLayout('window',i);
    if((layout.face||'B')!==face) continue;
    const dims=objectDimensions('window',i);
    const y=windowOpeningY(c,dims);
    openings.push({
      index:i,
      center:Number(layout.x)||0,
      width:Math.max(.20,Number(dims.width)||1.20)+.025,
      bottom:y-(Number(dims.height)||1.05)/2-.015,
      top:y+(Number(dims.height)||1.05)/2+.015
    });
  }
  return openings;
}

function mergeIntervals(intervals,min,max){
  const normalized=intervals
    .map(([a,b])=>[clamp(a,min,max),clamp(b,min,max)])
    .filter(([a,b])=>b-a>.001)
    .sort((a,b)=>a[0]-b[0]);
  const merged=[];
  for(const interval of normalized){
    const last=merged[merged.length-1];
    if(!last||interval[0]>last[1]+.001) merged.push([...interval]);
    else last[1]=Math.max(last[1],interval[1]);
  }
  return merged;
}

function addSegmentedWall(parent,{axisLength,axisMin,axisMax,yMin,yMax,thickness,position,axis,material,openings=[]}){
  const cuts=[axisMin,axisMax];
  openings.forEach(o=>{
    cuts.push(clamp(o.center-o.width/2,axisMin,axisMax));
    cuts.push(clamp(o.center+o.width/2,axisMin,axisMax));
  });
  cuts.sort((a,b)=>a-b);
  const unique=cuts.filter((v,i)=>i===0||Math.abs(v-cuts[i-1])>.001);

  for(let ci=0;ci<unique.length-1;ci++){
    const a=unique[ci],b=unique[ci+1];
    if(b-a<.002) continue;
    const mid=(a+b)/2;
    const blocked=mergeIntervals(
      openings
        .filter(o=>mid>o.center-o.width/2+.0005&&mid<o.center+o.width/2-.0005)
        .map(o=>[o.bottom,o.top]),
      yMin,yMax
    );
    let cursor=yMin;
    const visible=[];
    blocked.forEach(([lo,hi])=>{
      if(lo>cursor+.002) visible.push([cursor,lo]);
      cursor=Math.max(cursor,hi);
    });
    if(cursor<yMax-.002) visible.push([cursor,yMax]);

    visible.forEach(([lo,hi])=>{
      const span=b-a,height=hi-lo,centerAxis=(a+b)/2,centerY=(lo+hi)/2;
      let slab;
      if(axis==='x') slab=box(span,height,thickness,material,centerAxis,centerY,position);
      else slab=box(thickness,height,span,material,position,centerY,centerAxis);
      parent.add(slab);
    });
  }
}

function openingContainsAxis(openings,value){
  return openings.some(o=>value>o.center-o.width/2&&value<o.center+o.width/2);
}

createContainerShell=function(c,materials){
  const g=new THREE.Group();
  const {L,W,H}={L:c.length,W:c.width,H:c.height};
  const {exterior,interior,frame,floor}=materials;
  const openingsA=windowsForFace('A',c);
  const openingsB=windowsForFace('B',c);
  const openingsC=windowsForFace('C',c);
  const openingsD=windowsForFace('D',c);

  g.add(box(L,.14,W,floor,0,.02,0));
  const postW=.13;
  [-L/2,L/2].forEach(x=>[-W/2,W/2].forEach(z=>g.add(box(postW,H+.12,postW,frame,x,H/2,z))));
  g.add(box(L,.11,.12,frame,0,.07,-W/2));
  g.add(box(L,.11,.12,frame,0,.07,W/2));
  g.add(box(L,.11,.12,frame,0,H-.03,-W/2));
  g.add(box(L,.11,.12,frame,0,H-.03,W/2));

  // End faces D (-X) and C (+X), split around window openings.
  addSegmentedWall(g,{axisLength:W-.18,axisMin:-W/2+.09,axisMax:W/2-.09,yMin:.08,yMax:H-.08,thickness:.075,position:-L/2,axis:'z',material:exterior,openings:openingsD});
  addSegmentedWall(g,{axisLength:W-.18,axisMin:-W/2+.09,axisMax:W/2-.09,yMin:.08,yMax:H-.08,thickness:.075,position:L/2,axis:'z',material:exterior,openings:openingsC});

  // Side B (-Z) and side A (+Z), split around window openings.
  addSegmentedWall(g,{axisLength:L-.2,axisMin:-L/2+.10,axisMax:L/2-.10,yMin:.08,yMax:H-.08,thickness:.055,position:-W/2,axis:'x',material:exterior,openings:openingsB});
  if(!state.cutaway){
    addSegmentedWall(g,{axisLength:L-.2,axisMin:-L/2+.10,axisMax:L/2-.10,yMin:.08,yMax:H-.08,thickness:.045,position:W/2,axis:'x',material:exterior,openings:openingsA});
    g.add(box(L-.12,.07,W-.12,exterior,0,H,0));
  }else{
    g.add(box(L-.24,.06,.08,frame,0,H-.02,W/2));
  }

  // Interior lining on B also receives the same opening so glass is visible from inside.
  addSegmentedWall(g,{axisLength:L-.28,axisMin:-L/2+.14,axisMax:L/2-.14,yMin:.14,yMax:H-.14,thickness:.018,position:-W/2+.055,axis:'x',material:interior,openings:openingsB});

  const ribMat=mat(new THREE.Color(state.exteriorColor).multiplyScalar(.78),{roughness:.62,metalness:.2});
  const spacing=.32;
  const count=Math.floor((L-.3)/spacing);
  for(let i=0;i<=count;i++){
    const x=-L/2+.18+i*spacing;
    if(!openingContainsAxis(openingsB,x)) g.add(box(.028,H-.25,.022,ribMat,x,H/2,-W/2-.038));
    if(!state.cutaway&&!openingContainsAxis(openingsA,x)) g.add(box(.028,H-.25,.022,ribMat,x,H/2,W/2+.038));
  }

  const blockMat=mat(0x172033,{roughness:.45,metalness:.55});
  [-L/2,L/2].forEach(x=>[-W/2,W/2].forEach(z=>[.08,H-.08].forEach(y=>g.add(box(.23,.15,.23,blockMat,x,y,z)))));
  return g;
};

createWindow=function(width=1.20,height=1.05){
  const g=new THREE.Group();
  const wallDepth=.20;
  const frame=mat(0x273244,{roughness:.30,metalness:.48});
  const trim=mat(0xe5e7eb,{roughness:.42,metalness:.10});
  const jamb=mat(state.finish==='sanitary'?0xf8fafc:0xf1f5f9,{roughness:.52,metalness:.02});
  const glass=new THREE.MeshPhysicalMaterial({
    color:0xb9ddf7,
    transparent:true,
    opacity:.34,
    roughness:.055,
    metalness:.02,
    clearcoat:.7,
    clearcoatRoughness:.08,
    side:THREE.DoubleSide
  });
  const t=.055;

  // Structural frame runs through the wall depth.
  g.add(box(width,t,wallDepth,frame,0,height/2,0));
  g.add(box(width,t,wallDepth,frame,0,-height/2,0));
  g.add(box(t,height,wallDepth,frame,-width/2,0,0));
  g.add(box(t,height,wallDepth,frame,width/2,0,0));
  g.add(box(.035,height-.08,wallDepth*.88,frame,0,0,0));

  // Glass sits in the middle so it is visible from both sides.
  g.add(box(width-.11,height-.11,.018,glass,0,0,0));

  // Interior/exterior finishing trims.
  [-1,1].forEach(side=>{
    const z=side*(wallDepth/2+.012);
    g.add(box(width+.07,.028,.025,trim,0,height/2+.025,z));
    g.add(box(width+.07,.028,.025,trim,0,-height/2-.025,z));
    g.add(box(.028,height+.07,.025,trim,-width/2-.025,0,z));
    g.add(box(.028,height+.07,.025,trim,width/2+.025,0,z));
  });

  // Reveal/jamb surfaces give the opening real depth when viewed from inside.
  g.add(box(.018,height-.07,wallDepth-.025,jamb,-width/2+.025,0,0));
  g.add(box(.018,height-.07,wallDepth-.025,jamb,width/2-.025,0,0));
  g.add(box(width-.06,.018,wallDepth-.025,jamb,0,height/2-.025,0));
  g.add(box(width-.06,.025,wallDepth+.04,jamb,0,-height/2+.02,0));

  g.userData.passThroughWindow=true;
  return g;
};

const fitObjectToDimensionsBeforePassThrough=fitObjectToDimensions;
fitObjectToDimensions=function(obj,type,dims){
  if(type!=='window') return fitObjectToDimensionsBeforePassThrough(obj,type,dims);
  if(!obj) return obj;
  obj.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(obj),size=new THREE.Vector3();
  bounds.getSize(size);
  if(size.x>0&&Number.isFinite(dims.width)) obj.scale.x*=dims.width/size.x;
  if(size.y>0&&Number.isFinite(dims.height)) obj.scale.y*=dims.height/size.y;
  // Keep the pass-through wall depth; only width and height are customer dimensions.
  obj.updateMatrixWorld(true);
  return obj;
};

const mountedParametricPositionBeforePassThrough=mountedParametricPosition;
mountedParametricPosition=function(obj,type,layout,c,dims){
  if(type!=='window') return mountedParametricPositionBeforePassThrough(obj,type,layout,c,dims);
  const face=layout.face||MOUNTED_FACE_TYPES.window.defaultFace;
  const y=windowOpeningY(c,dims);
  obj.rotation.y=mountedRotation(face);
  // Window is centered on the wall plane so the frame/reveals project to both interior and exterior.
  if(face==='A') obj.position.set(layout.x,y,c.width/2);
  else if(face==='B') obj.position.set(layout.x,y,-c.width/2);
  else if(face==='C') obj.position.set(c.length/2,y,layout.x);
  else obj.position.set(-c.length/2,y,layout.x);
};

function bootPassThroughWindows(){
  if(OBJECT_DIMENSIONS?.window?.defaults){
    OBJECT_DIMENSIONS.window.defaults=()=>({width:1.20,height:1.05,depth:.20});
  }
  rebuild3D();
}

if(document.readyState==='loading'){
  window.addEventListener('DOMContentLoaded',()=>setTimeout(bootPassThroughWindows,400));
}else{
  setTimeout(bootPassThroughWindows,400);
}
