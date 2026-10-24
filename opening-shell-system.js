// True shell openings for bat-kubiqueitor.
// Cuts real apertures in the container shell and adds door/window opening variants.
(function(){
  if(window.BAT_KUBIQUEITOR_OPENING_SHELL?.version>=1) return;

  const DOOR_OPENINGS=['opening','openingFrame'];
  const WINDOW_OPENINGS=['windowOpening','windowOpeningFrame'];
  const ALL_OPENINGS=[...DOOR_OPENINGS,...WINDOW_OPENINGS];
  const ALL_APERTURES=['window','door',...ALL_OPENINGS];
  const CLEARANCE=.08;
  const WINDOW_SILL=.95;
  let installed=false;

  function clampLocal(v,min,max){return Math.min(max,Math.max(min,v));}
  function isFrameType(type){return type==='openingFrame'||type==='windowOpeningFrame';}
  function isWindowOpening(type){return WINDOW_OPENINGS.includes(type);}

  function openingBounds(type,index,c){
    const d=objectDimensions(type,index)||{};
    const height=Math.max(.30,Number(d.height)||(isWindowOpening(type)?1.05:2.10));
    let bottom=isWindowOpening(type)?WINDOW_SILL:CLEARANCE;
    bottom=Math.min(bottom,Math.max(CLEARANCE,c.height-height-CLEARANCE));
    const top=Math.min(c.height-CLEARANCE,bottom+height);
    return {bottom,top,height:top-bottom,centerY:(bottom+top)/2};
  }

  function apertureFor(type,index,face,c){
    const p=actualLayout(type,index)||{};
    if((p.face||MOUNTED_FACE_TYPES[type]?.defaultFace||'A')!==face) return null;
    const d=objectDimensions(type,index)||{};
    const width=Math.max(.20,Number(d.width)||(type==='window'?1.20:type==='door'?.98:isWindowOpening(type)?1.20:.90));
    let bottom,top;
    if(type==='window'){
      const h=Math.max(.20,Number(d.height)||1.05),half=h/2;
      const center=clampLocal(c.height*.60,half+.15,c.height-half-.15);
      bottom=center-half;top=center+half;
    }else if(type==='door'){
      bottom=.02;top=Math.min(c.height-CLEARANCE,bottom+Math.max(.30,Number(d.height)||2.08));
    }else{
      const v=openingBounds(type,index,c);bottom=v.bottom;top=v.top;
    }
    return {type,index,center:Number(p.x)||0,width,left:(Number(p.x)||0)-width/2,right:(Number(p.x)||0)+width/2,bottom,top};
  }

  function aperturesForFace(face,c){
    const list=[];
    ALL_APERTURES.forEach(type=>{
      for(let i=0;i<(state.counts[type]||0);i++){
        const a=apertureFor(type,i,face,c);if(a) list.push(a);
      }
    });
    return list;
  }

  function mergeIntervals(intervals,min,max){
    const cleaned=intervals.map(([a,b])=>[Math.max(min,a),Math.min(max,b)]).filter(([a,b])=>b-a>.001).sort((a,b)=>a[0]-b[0]);
    const out=[];
    cleaned.forEach(pair=>{const last=out[out.length-1];if(!last||pair[0]>last[1]+.001)out.push(pair.slice());else last[1]=Math.max(last[1],pair[1]);});
    return out;
  }

  function addWallWithCuts(parent,{axis,axisMin,axisMax,yMin,yMax,position,thickness,material,openings}){
    const boundaries=[axisMin,axisMax];
    openings.forEach(o=>{boundaries.push(clampLocal(o.left,axisMin,axisMax));boundaries.push(clampLocal(o.right,axisMin,axisMax));});
    const xs=[...new Set(boundaries.map(v=>Number(v.toFixed(4))))].sort((a,b)=>a-b);
    for(let i=0;i<xs.length-1;i++){
      const a=xs[i],b=xs[i+1];if(b-a<.002)continue;
      const mid=(a+b)/2;
      const blocked=mergeIntervals(openings.filter(o=>mid>o.left+.0005&&mid<o.right-.0005).map(o=>[o.bottom,o.top]),yMin,yMax);
      let cursor=yMin;
      const addSegment=(low,high)=>{if(high-low<.002)return;const h=high-low,y=(low+high)/2,w=b-a,xz=(a+b)/2;if(axis==='x')parent.add(box(w,h,thickness,material,xz,y,position));else parent.add(box(thickness,h,w,material,position,y,xz));};
      blocked.forEach(([low,high])=>{addSegment(cursor,low);cursor=Math.max(cursor,high);});
      addSegment(cursor,yMax);
    }
  }

  function addRibWithCuts(parent,{x,z,thickness,depth,material,yMin,yMax,openings}){
    const blocked=mergeIntervals(openings.filter(o=>x>o.left-.015&&x<o.right+.015).map(o=>[o.bottom,o.top]),yMin,yMax);
    let cursor=yMin;
    const add=(low,high)=>{if(high-low<.01)return;parent.add(box(thickness,high-low,depth,material,x,(low+high)/2,z));};
    blocked.forEach(([low,high])=>{add(cursor,low);cursor=Math.max(cursor,high);});add(cursor,yMax);
  }

  function buildCutShell(c,materials){
    const g=new THREE.Group(),L=c.length,W=c.width,H=c.height,{exterior,interior,frame,floor}=materials,postW=.13,yMin=.08,yMax=H-.08;
    g.add(box(L,.14,W,floor,0,.02,0));
    [-L/2,L/2].forEach(x=>[-W/2,W/2].forEach(z=>g.add(box(postW,H+.12,postW,frame,x,H/2,z))));
    g.add(box(L,.11,.12,frame,0,.07,-W/2));g.add(box(L,.11,.12,frame,0,.07,W/2));g.add(box(L,.11,.12,frame,0,H-.03,-W/2));g.add(box(L,.11,.12,frame,0,H-.03,W/2));
    const faces={A:aperturesForFace('A',c),B:aperturesForFace('B',c),C:aperturesForFace('C',c),D:aperturesForFace('D',c)};
    addWallWithCuts(g,{axis:'x',axisMin:-L/2+.10,axisMax:L/2-.10,yMin,yMax,position:-W/2,thickness:.055,material:exterior,openings:faces.B});
    if(!state.cutaway)addWallWithCuts(g,{axis:'x',axisMin:-L/2+.10,axisMax:L/2-.10,yMin,yMax,position:W/2,thickness:.045,material:exterior,openings:faces.A});
    addWallWithCuts(g,{axis:'z',axisMin:-W/2+.09,axisMax:W/2-.09,yMin,yMax,position:L/2,thickness:.075,material:exterior,openings:faces.C});
    addWallWithCuts(g,{axis:'z',axisMin:-W/2+.09,axisMax:W/2-.09,yMin,yMax,position:-L/2,thickness:.075,material:exterior,openings:faces.D});
    addWallWithCuts(g,{axis:'x',axisMin:-L/2+.14,axisMax:L/2-.14,yMin:.14,yMax:H-.14,position:-W/2+.055,thickness:.018,material:interior,openings:faces.B});
    if(!state.cutaway)g.add(box(L-.12,.07,W-.12,exterior,0,H,0));else g.add(box(L-.24,.06,.08,frame,0,H-.02,W/2));
    const ribMat=mat(new THREE.Color(state.exteriorColor).multiplyScalar(.78),{roughness:.62,metalness:.2}),spacing=.32,count=Math.floor((L-.3)/spacing);
    for(let i=0;i<=count;i++){const x=-L/2+.18+i*spacing;addRibWithCuts(g,{x,z:-W/2-.038,thickness:.028,depth:.022,material:ribMat,yMin:.13,yMax:H-.12,openings:faces.B});if(!state.cutaway)addRibWithCuts(g,{x,z:W/2+.038,thickness:.028,depth:.022,material:ribMat,yMin:.13,yMax:H-.12,openings:faces.A});}
    const blockMat=mat(0x172033,{roughness:.45,metalness:.55});[-L/2,L/2].forEach(x=>[-W/2,W/2].forEach(z=>[.08,H-.08].forEach(y=>g.add(box(.23,.15,.23,blockMat,x,y,z)))));
    return g;
  }

  function createOpeningDetail(type,index,c){
    const d=objectDimensions(type,index)||{},width=Math.max(.30,Number(d.width)||(isWindowOpening(type)?1.20:.90)),v=openingBounds(type,index,c),g=new THREE.Group();g.userData.trueOpeningDetail=true;
    if(isFrameType(type)){
      const steel=mat(0xa8b3c2,{roughness:.26,metalness:.88}),t=.07,depth=.17;
      const addFrame=(w,h,d,x,y,z)=>{const m=box(w,h,d,steel,x,y,z);m.name='opening-metal-frame';g.add(m);};
      addFrame(t,v.height,depth,-width/2+t/2,0,0);addFrame(t,v.height,depth,width/2-t/2,0,0);addFrame(width,t,depth,0,v.height/2-t/2,0);if(isWindowOpening(type))addFrame(width,t,depth,0,-v.height/2+t/2,0);
    }
    const hit=new THREE.Mesh(new THREE.BoxGeometry(Math.max(.20,width-.03),Math.max(.20,v.height-.03),.035),new THREE.MeshBasicMaterial({transparent:true,opacity:.001,depthWrite:false,side:THREE.DoubleSide}));hit.userData.openingHitbox=true;g.add(hit);return{group:g,bounds:v};
  }

  function positionOpeningDetail(group,type,index,bounds,c){
    const p=actualLayout(type,index)||{},face=p.face||'A';group.rotation.y=mountedRotation(face);const offset=Number(p.x)||0,y=bounds.centerY;
    if(face==='A')group.position.set(offset,y,c.width/2);else if(face==='B')group.position.set(offset,y,-c.width/2);else if(face==='C')group.position.set(c.length/2,y,offset);else group.position.set(-c.length/2,y,offset);return face;
  }

  function rebuildOpeningDetails(){
    if(!containerGroup)return;
    [...containerGroup.children].filter(c=>c?.userData?.trueOpeningDetail).forEach(c=>containerGroup.remove(c));
    if(Array.isArray(editableObjects))editableObjects=editableObjects.filter(root=>!ALL_OPENINGS.includes(root?.userData?.editor?.type));
    const c=DATA.containers[state.container];
    ALL_OPENINGS.forEach(type=>{for(let i=0;i<(state.counts[type]||0);i++){const{group,bounds}=createOpeningDetail(type,i,c),face=positionOpeningDetail(group,type,i,bounds,c);containerGroup.add(group);registerEditable(group,type,i,{axis:(face==='A'||face==='B')?'x':'z',surface:mountedSurface(face),face});}});
  }

  function installTypes(){
    DATA.extras.opening={name:'Vano',icon:'fa-vector-square',max:8};
    DATA.extras.openingFrame={name:'Vano con marco metálico',icon:'fa-border-all',max:8};
    DATA.extras.windowOpening={name:'Vano de ventana',icon:'fa-table-cells-large',max:8};
    DATA.extras.windowOpeningFrame={name:'Vano de ventana con marco',icon:'fa-window-restore',max:8};
    ALL_OPENINGS.forEach(type=>{if(!Number.isFinite(Number(state.counts[type])))state.counts[type]=0;});
    MOUNTED_FACE_TYPES.windowOpening={defaultFace:'A',gap:1.30,padding:.15,height:'windowOpening',label:'Vano de ventana'};
    MOUNTED_FACE_TYPES.windowOpeningFrame={defaultFace:'A',gap:1.30,padding:.15,height:'windowOpening',label:'Vano de ventana con marco'};
    const windowFields=(OBJECT_DIMENSIONS.window?.fields||[]).map(field=>({...field}));
    const windowDefaults=OBJECT_DIMENSIONS.window?.defaults||(()=>({width:1.20,height:1.05,depth:.10}));
    OBJECT_DIMENSIONS.windowOpening={fields:windowFields.map(field=>({...field})),defaults:c=>({...windowDefaults(c),depth:.20})};
    OBJECT_DIMENSIONS.windowOpeningFrame={fields:windowFields.map(field=>({...field})),defaults:c=>({...windowDefaults(c),depth:.20})};
    const oldEnsure=ensureLayoutState;ensureLayoutState=function(){oldEnsure();ALL_OPENINGS.forEach(type=>{if(!Array.isArray(state.layout[type]))state.layout[type]=[];});};ensureLayoutState();ensureDimensionState();
    const oldLabel=typeLabel;typeLabel=function(type){const labels={opening:'Vano',openingFrame:'Vano con marco metálico',windowOpening:'Vano de ventana',windowOpeningFrame:'Vano de ventana con marco'};return labels[type]||oldLabel(type);};
    const oldValid=validCandidate;validCandidate=function(type,index,candidate){if(!ALL_OPENINGS.includes(type))return oldValid(type,index,candidate);const c=DATA.containers[state.container],face=candidate.face||mountedFace(type,index),dim=mountedFaceDimension(face,c),d=objectDimensions(type,index)||{},half=(Number(d.width)||.90)/2;if(candidate.x-half<-dim/2+CLEARANCE||candidate.x+half>dim/2-CLEARANCE)return false;for(const otherType of ALL_APERTURES){for(let i=0;i<(state.counts[otherType]||0);i++){if(otherType===type&&i===index)continue;const op=actualLayout(otherType,i)||{};if((op.face||MOUNTED_FACE_TYPES[otherType]?.defaultFace)!==face)continue;const od=objectDimensions(otherType,i)||{},oh=(Number(od.width)||(otherType==='window'?1.20:.98))/2;if(Math.abs((Number(op.x)||0)-candidate.x)<half+oh+.08)return false;}}return true;};
    const oldDimAllowed=dimensionChangeAllowed;dimensionChangeAllowed=function(type,index,next){if(!ALL_OPENINGS.includes(type))return oldDimAllowed(type,index,next);const p=actualLayout(type,index)||{},c=DATA.containers[state.container],face=p.face||'A',dim=mountedFaceDimension(face,c),half=(Number(next.width)||.90)/2;if(Math.abs(Number(p.x)||0)+half>dim/2-CLEARANCE)return false;const h=Number(next.height)||1;if(isWindowOpening(type)){if(WINDOW_SILL+h>c.height-CLEARANCE)return false;}else if(CLEARANCE+h>c.height-CLEARANCE)return false;return true;};
    const oldPicker=openMountedFacePicker;openMountedFacePicker=function(type){oldPicker(type);if(!ALL_OPENINGS.includes(type))return;const title=document.getElementById('mounted-face-title'),desc=document.getElementById('mounted-face-desc');if(title)title.textContent=`¿En qué cara irá ${typeLabel(type).toLowerCase()}?`;if(desc)desc.textContent=isWindowOpening(type)?'Selecciona A, B, C o D. Después podrás editar ancho y alto igual que una ventana termopanel.':'Selecciona A, B, C o D. El hueco comenzará desde el nivel de piso.';};
  }

  function install(){if(installed)return;installTypes();createContainerShell=buildCutShell;const baseRebuild=rebuild3D;rebuild3D=function(){baseRebuild();rebuildOpeningDetails();};installed=true;window.BAT_KUBIQUEITOR_OPENING_SHELL={version:1,types:[...ALL_OPENINGS]};rebuild3D();}

  let tries=0;const timer=setInterval(()=>{tries++;const ready=Boolean(window.BAT_KUBIQUEITOR_FINAL_SCENE_COMPOSER?.version>=16&&DATA?.extras?.opening&&DATA?.extras?.openingFrame&&typeof createContainerShell==='function'&&typeof objectDimensions==='function'&&typeof actualLayout==='function'&&typeof mountedRotation==='function'&&typeof registerEditable==='function');if(ready){clearInterval(timer);install();return;}if(tries>=200){clearInterval(timer);console.error('bat-kubiqueitor: opening-shell-system no pudo instalarse');}},80);
})();