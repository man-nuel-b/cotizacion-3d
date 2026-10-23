// Pass-through windows with real wall openings for bat-kubiqueitor.
// This module describes openings and window geometry. It must NOT replace createContainerShell;
// container-realism.js is the single authority for the container shell.

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
      type:'window',
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

// Shared helper used by openings-extras and interior layers.
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
      const slab=axis==='x'
        ? box(span,height,thickness,material,centerAxis,centerY,position)
        : box(thickness,height,span,material,position,centerY,centerAxis);
      parent.add(slab);
    });
  }
}

function openingContainsAxis(openings,value){
  return openings.some(o=>value>o.center-o.width/2&&value<o.center+o.width/2);
}

function openingContainsPoint(openings,axisValue,yValue){
  return openings.some(o=>
    axisValue>o.center-o.width/2&&axisValue<o.center+o.width/2&&
    yValue>(Number.isFinite(Number(o.bottom))?Number(o.bottom):-.01)&&
    yValue<(Number.isFinite(Number(o.top))?Number(o.top):999)
  );
}

createWindow=function(width=1.20,height=1.05){
  const g=new THREE.Group();
  const wallDepth=.20;
  const frame=mat(0x273244,{roughness:.30,metalness:.48});
  const trim=mat(0xe5e7eb,{roughness:.42,metalness:.10});
  const jamb=mat(0xf1f5f9,{roughness:.52,metalness:.02});
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

  g.add(box(width,t,wallDepth,frame,0,height/2,0));
  g.add(box(width,t,wallDepth,frame,0,-height/2,0));
  g.add(box(t,height,wallDepth,frame,-width/2,0,0));
  g.add(box(t,height,wallDepth,frame,width/2,0,0));
  g.add(box(.035,height-.08,wallDepth*.88,frame,0,0,0));
  g.add(box(width-.11,height-.11,.018,glass,0,0,0));

  [-1,1].forEach(side=>{
    const z=side*(wallDepth/2+.012);
    g.add(box(width+.07,.028,.025,trim,0,height/2+.025,z));
    g.add(box(width+.07,.028,.025,trim,0,-height/2-.025,z));
    g.add(box(.028,height+.07,.025,trim,-width/2-.025,0,z));
    g.add(box(.028,height+.07,.025,trim,width/2+.025,0,z));
  });

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
  obj.updateMatrixWorld(true);
  return obj;
};

const mountedParametricPositionBeforePassThrough=mountedParametricPosition;
mountedParametricPosition=function(obj,type,layout,c,dims){
  if(type!=='window') return mountedParametricPositionBeforePassThrough(obj,type,layout,c,dims);
  const face=layout.face||MOUNTED_FACE_TYPES.window.defaultFace;
  const y=windowOpeningY(c,dims);
  obj.rotation.y=mountedRotation(face);
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
