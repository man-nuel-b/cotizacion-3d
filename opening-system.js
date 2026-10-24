// Unified opening system for bat-kubiqueitor.
// Single owner for opening types, wall cuts, frames, collisions, editing and selection persistence.
(function(){
  if(window.BAT_KUBIQUEITOR_OPENING_SYSTEM?.version>=1) return;

  const DOOR_OPENINGS=['opening','openingFrame'];
  const WINDOW_OPENINGS=['windowOpening','windowOpeningFrame'];
  const TYPES=[...DOOR_OPENINGS,...WINDOW_OPENINGS];
  const APERTURE_TYPES=['window','door',...TYPES];
  const CLEARANCE=.08;
  const WINDOW_SILL=.95;
  let installed=false;
  let lastSelection=null;

  const isOpeningType=type=>TYPES.includes(type);
  const isWindowOpening=type=>WINDOW_OPENINGS.includes(type);
  const isFrameType=type=>type==='openingFrame'||type==='windowOpeningFrame';
  const clampLocal=(v,min,max)=>Math.min(max,Math.max(min,v));

  function faceLength(face,c=DATA.containers[state.container]){
    return (face==='A'||face==='B')?c.length:c.width;
  }

  function openingBounds(type,index,c=DATA.containers[state.container]){
    const dims=objectDimensions(type,index)||{};
    const height=Math.max(.30,Number(dims.height)||(isWindowOpening(type)?1.05:2.10));
    let bottom=isWindowOpening(type)?WINDOW_SILL:CLEARANCE;
    bottom=Math.min(bottom,Math.max(CLEARANCE,c.height-height-CLEARANCE));
    const top=Math.min(c.height-CLEARANCE,bottom+height);
    return {bottom,top,height:top-bottom,centerY:(bottom+top)/2};
  }

  function openingMaxHeight(type,c=DATA.containers[state.container]){
    return isWindowOpening(type)
      ? Math.max(.40,Math.min(1.80,c.height-WINDOW_SILL-CLEARANCE))
      : Math.max(.50,Math.min(2.80,c.height-(CLEARANCE*2)));
  }

  function openingMaxWidthAt(type,index,layoutOverride=null){
    const c=DATA.containers[state.container];
    const p=layoutOverride||actualLayout(type,index)||{};
    const face=p.face||MOUNTED_FACE_TYPES[type]?.defaultFace||'A';
    const length=faceLength(face,c);
    const center=Math.abs(Number(p.x)||0);
    const halfClear=Math.max(.25,length/2-CLEARANCE);
    const structuralMax=Math.max(.40,2*(halfClear-center));
    const schemaMax=Math.max(.40,Number(OBJECT_DIMENSIONS[type]?.fields?.find(f=>f.key==='width')?.max)||structuralMax);
    return Math.min(structuralMax,schemaMax);
  }

  function apertureHalfWidth(type,index,dimsOverride=null){
    const dims=dimsOverride||objectDimensions(type,index)||{};
    return Math.max(.10,(Number(dims.width)||(type==='window'?1.20:type==='door'?.98:.90))/2);
  }

  function apertureCollisionAllowed(type,index,candidate,dimsOverride=null){
    const face=candidate.face||mountedFace(type,index)||MOUNTED_FACE_TYPES[type]?.defaultFace||'A';
    const half=apertureHalfWidth(type,index,dimsOverride);
    for(const otherType of APERTURE_TYPES){
      for(let i=0;i<(state.counts[otherType]||0);i++){
        if(otherType===type&&i===index) continue;
        const other=actualLayout(otherType,i)||{};
        const otherFace=other.face||MOUNTED_FACE_TYPES[otherType]?.defaultFace||'A';
        if(otherFace!==face) continue;
        const otherHalf=apertureHalfWidth(otherType,i);
        if(Math.abs((Number(other.x)||0)-(Number(candidate.x)||0))<half+otherHalf+.08) return false;
      }
    }
    return true;
  }

  function apertureFor(type,index,face,c){
    const layout=actualLayout(type,index)||{};
    const actualFace=layout.face||MOUNTED_FACE_TYPES[type]?.defaultFace||'A';
    if(actualFace!==face) return null;
    const dims=objectDimensions(type,index)||{};
    const width=Math.max(.20,Number(dims.width)||(type==='window'?1.20:type==='door'?.98:isWindowOpening(type)?1.20:.90));
    let bottom,top;
    if(type==='window'){
      const h=Math.max(.20,Number(dims.height)||1.05),half=h/2;
      const center=clampLocal(c.height*.60,half+.15,c.height-half-.15);
      bottom=center-half;top=center+half;
    }else if(type==='door'){
      bottom=.02;top=Math.min(c.height-CLEARANCE,bottom+Math.max(.30,Number(dims.height)||2.08));
    }else{
      const b=openingBounds(type,index,c);bottom=b.bottom;top=b.top;
    }
    const center=Number(layout.x)||0;
    return {type,index,center,width,left:center-width/2,right:center+width/2,bottom,top};
  }

  function aperturesForFace(face,c){
    const out=[];
    APERTURE_TYPES.forEach(type=>{
      for(let i=0;i<(state.counts[type]||0);i++){
        const aperture=apertureFor(type,i,face,c);
        if(aperture) out.push(aperture);
      }
    });
    return out;
  }

  function mergeIntervals(intervals,min,max){
    const cleaned=intervals
      .map(([a,b])=>[Math.max(min,a),Math.min(max,b)])
      .filter(([a,b])=>b-a>.001)
      .sort((a,b)=>a[0]-b[0]);
    const out=[];
    cleaned.forEach(pair=>{
      const last=out[out.length-1];
      if(!last||pair[0]>last[1]+.001) out.push(pair.slice());
      else last[1]=Math.max(last[1],pair[1]);
    });
    return out;
  }

  function addWallWithCuts(parent,{axis,axisMin,axisMax,yMin,yMax,position,thickness,material,openings}){
    const boundaries=[axisMin,axisMax];
    openings.forEach(o=>{
      boundaries.push(clampLocal(o.left,axisMin,axisMax));
      boundaries.push(clampLocal(o.right,axisMin,axisMax));
    });
    const positions=[...new Set(boundaries.map(v=>Number(v.toFixed(4))))].sort((a,b)=>a-b);
    for(let i=0;i<positions.length-1;i++){
      const a=positions[i],b=positions[i+1];
      if(b-a<.002) continue;
      const mid=(a+b)/2;
      const blocked=mergeIntervals(
        openings.filter(o=>mid>o.left+.0005&&mid<o.right-.0005).map(o=>[o.bottom,o.top]),
        yMin,yMax
      );
      let cursor=yMin;
      const addSegment=(low,high)=>{
        if(high-low<.002) return;
        const h=high-low,y=(low+high)/2,w=b-a,coord=(a+b)/2;
        if(axis==='x') parent.add(box(w,h,thickness,material,coord,y,position));
        else parent.add(box(thickness,h,w,material,position,y,coord));
      };
      blocked.forEach(([low,high])=>{addSegment(cursor,low);cursor=Math.max(cursor,high);});
      addSegment(cursor,yMax);
    }
  }

  function addRibWithCuts(parent,{x,z,thickness,depth,material,yMin,yMax,openings}){
    const blocked=mergeIntervals(
      openings.filter(o=>x>o.left-.015&&x<o.right+.015).map(o=>[o.bottom,o.top]),
      yMin,yMax
    );
    let cursor=yMin;
    const add=(low,high)=>{
      if(high-low<.01) return;
      parent.add(box(thickness,high-low,depth,material,x,(low+high)/2,z));
    };
    blocked.forEach(([low,high])=>{add(cursor,low);cursor=Math.max(cursor,high);});
    add(cursor,yMax);
  }

  function buildShell(c,materials){
    const g=new THREE.Group();
    const L=c.length,W=c.width,H=c.height;
    const {exterior,interior,frame,floor}=materials;
    const yMin=.08,yMax=H-.08,postW=.13;
    const faces={A:aperturesForFace('A',c),B:aperturesForFace('B',c),C:aperturesForFace('C',c),D:aperturesForFace('D',c)};

    g.add(box(L,.14,W,floor,0,.02,0));
    [-L/2,L/2].forEach(x=>[-W/2,W/2].forEach(z=>g.add(box(postW,H+.12,postW,frame,x,H/2,z))));
    g.add(box(L,.11,.12,frame,0,.07,-W/2));
    g.add(box(L,.11,.12,frame,0,.07,W/2));
    g.add(box(L,.11,.12,frame,0,H-.03,-W/2));
    g.add(box(L,.11,.12,frame,0,H-.03,W/2));

    addWallWithCuts(g,{axis:'x',axisMin:-L/2+.10,axisMax:L/2-.10,yMin,yMax,position:-W/2,thickness:.055,material:exterior,openings:faces.B});
    if(!state.cutaway) addWallWithCuts(g,{axis:'x',axisMin:-L/2+.10,axisMax:L/2-.10,yMin,yMax,position:W/2,thickness:.045,material:exterior,openings:faces.A});
    addWallWithCuts(g,{axis:'z',axisMin:-W/2+.09,axisMax:W/2-.09,yMin,yMax,position:L/2,thickness:.075,material:exterior,openings:faces.C});
    addWallWithCuts(g,{axis:'z',axisMin:-W/2+.09,axisMax:W/2-.09,yMin,yMax,position:-L/2,thickness:.075,material:exterior,openings:faces.D});
    addWallWithCuts(g,{axis:'x',axisMin:-L/2+.14,axisMax:L/2-.14,yMin:.14,yMax:H-.14,position:-W/2+.055,thickness:.018,material:interior,openings:faces.B});

    if(!state.cutaway) g.add(box(L-.12,.07,W-.12,exterior,0,H,0));
    else g.add(box(L-.24,.06,.08,frame,0,H-.02,W/2));

    const ribMat=mat(new THREE.Color(state.exteriorColor).multiplyScalar(.78),{roughness:.62,metalness:.2});
    const spacing=.32,count=Math.floor((L-.3)/spacing);
    for(let i=0;i<=count;i++){
      const x=-L/2+.18+i*spacing;
      addRibWithCuts(g,{x,z:-W/2-.038,thickness:.028,depth:.022,material:ribMat,yMin:.13,yMax:H-.12,openings:faces.B});
      if(!state.cutaway) addRibWithCuts(g,{x,z:W/2+.038,thickness:.028,depth:.022,material:ribMat,yMin:.13,yMax:H-.12,openings:faces.A});
    }

    const blockMat=mat(0x172033,{roughness:.45,metalness:.55});
    [-L/2,L/2].forEach(x=>[-W/2,W/2].forEach(z=>[.08,H-.08].forEach(y=>g.add(box(.23,.15,.23,blockMat,x,y,z)))));
    return g;
  }

  function createOpeningDetail(type,index,c){
    const dims=objectDimensions(type,index)||{};
    const width=Math.max(.30,Number(dims.width)||(isWindowOpening(type)?1.20:.90));
    const bounds=openingBounds(type,index,c);
    const g=new THREE.Group();
    g.userData.openingSystemRoot=true;

    if(isFrameType(type)){
      const steel=mat(0xa8b3c2,{roughness:.26,metalness:.88});
      const t=.07,depth=.17;
      const addFrame=(w,h,d,x,y,z)=>{const m=box(w,h,d,steel,x,y,z);m.name='opening-metal-frame';g.add(m);};
      addFrame(t,bounds.height,depth,-width/2+t/2,0,0);
      addFrame(t,bounds.height,depth,width/2-t/2,0,0);
      addFrame(width,t,depth,0,bounds.height/2-t/2,0);
      if(isWindowOpening(type)) addFrame(width,t,depth,0,-bounds.height/2+t/2,0);
    }

    const hit=new THREE.Mesh(
      new THREE.BoxGeometry(Math.max(.20,width-.02),Math.max(.20,bounds.height-.02),.08),
      new THREE.MeshBasicMaterial({transparent:true,opacity:.004,depthWrite:false,depthTest:false,side:THREE.DoubleSide})
    );
    hit.userData.openingHitbox=true;
    hit.renderOrder=1000;
    g.add(hit);
    return {group:g,bounds};
  }

  function positionOpeningDetail(group,type,index,bounds,c){
    const layout=actualLayout(type,index)||{};
    const face=layout.face||MOUNTED_FACE_TYPES[type]?.defaultFace||'A';
    const offset=Number(layout.x)||0;
    group.rotation.y=mountedRotation(face);
    if(face==='A') group.position.set(offset,bounds.centerY,c.width/2);
    else if(face==='B') group.position.set(offset,bounds.centerY,-c.width/2);
    else if(face==='C') group.position.set(c.length/2,bounds.centerY,offset);
    else group.position.set(-c.length/2,bounds.centerY,offset);
    return face;
  }

  function rebuildOpeningDetails(){
    if(!containerGroup) return;
    [...containerGroup.children].filter(child=>child?.userData?.openingSystemRoot).forEach(child=>containerGroup.remove(child));
    if(Array.isArray(editableObjects)) editableObjects=editableObjects.filter(root=>!isOpeningType(root?.userData?.editor?.type));

    const c=DATA.containers[state.container];
    TYPES.forEach(type=>{
      for(let i=0;i<(state.counts[type]||0);i++){
        const {group,bounds}=createOpeningDetail(type,i,c);
        const face=positionOpeningDetail(group,type,i,bounds,c);
        registerEditable(group,type,i,{axis:(face==='A'||face==='B')?'x':'z',surface:mountedSurface(face),face});
        containerGroup.add(group);
      }
    });
  }

  function restoreSelection(selection){
    if(!selection||!Array.isArray(editableObjects)) return;
    const root=editableObjects.find(obj=>obj?.userData?.editor?.type===selection.type&&obj?.userData?.editor?.index===selection.index);
    if(!root) return;
    selectedEditable={type:selection.type,index:selection.index};
    lastSelection={...selectedEditable};
    addSelectionOutline(root);
    showEditorPanel(root);
  }

  function installDefinitions(){
    DATA.extras.opening={name:'Vano',icon:'fa-vector-square',max:8};
    DATA.extras.openingFrame={name:'Vano con marco metálico',icon:'fa-border-all',max:8};
    DATA.extras.windowOpening={name:'Vano de ventana',icon:'fa-table-cells-large',max:8};
    DATA.extras.windowOpeningFrame={name:'Vano de ventana con marco',icon:'fa-window-restore',max:8};

    MOUNTED_FACE_TYPES.opening={defaultFace:'A',gap:1.00,padding:CLEARANCE,height:'opening',label:'Vano'};
    MOUNTED_FACE_TYPES.openingFrame={defaultFace:'A',gap:1.00,padding:CLEARANCE,height:'opening',label:'Vano con marco metálico'};
    MOUNTED_FACE_TYPES.windowOpening={defaultFace:'A',gap:1.30,padding:CLEARANCE,height:'windowOpening',label:'Vano de ventana'};
    MOUNTED_FACE_TYPES.windowOpeningFrame={defaultFace:'A',gap:1.30,padding:CLEARANCE,height:'windowOpening',label:'Vano de ventana con marco'};

    const windowFields=(OBJECT_DIMENSIONS.window?.fields||[
      {key:'width',label:'Ancho',min:.40,max:2.40,step:.05},
      {key:'height',label:'Alto',min:.40,max:1.80,step:.05}
    ]).map(field=>({...field}));
    const windowDefaults=OBJECT_DIMENSIONS.window?.defaults||(()=>({width:1.20,height:1.05,depth:.10}));

    const doorFields=[
      {key:'width',label:'Ancho',min:.50,max:12.10,step:.05},
      {key:'height',label:'Alto',min:.50,max:2.80,step:.05}
    ];
    OBJECT_DIMENSIONS.opening={fields:doorFields.map(field=>({...field})),defaults:()=>({width:.90,height:2.10,depth:.20})};
    OBJECT_DIMENSIONS.openingFrame={fields:doorFields.map(field=>({...field})),defaults:()=>({width:.90,height:2.10,depth:.20})};
    OBJECT_DIMENSIONS.windowOpening={fields:windowFields.map(field=>({...field})),defaults:c=>({...windowDefaults(c),depth:.20})};
    OBJECT_DIMENSIONS.windowOpeningFrame={fields:windowFields.map(field=>({...field})),defaults:c=>({...windowDefaults(c),depth:.20})};

    TYPES.forEach(type=>{if(!Number.isFinite(Number(state.counts[type]))) state.counts[type]=0;});

    const baseEnsureLayout=ensureLayoutState;
    ensureLayoutState=function(){
      baseEnsureLayout();
      TYPES.forEach(type=>{if(!Array.isArray(state.layout[type])) state.layout[type]=[];});
    };
    ensureLayoutState();
    ensureDimensionState();

    const baseTypeLabel=typeLabel;
    typeLabel=function(type){
      const labels={opening:'Vano',openingFrame:'Vano con marco metálico',windowOpening:'Vano de ventana',windowOpeningFrame:'Vano de ventana con marco'};
      return labels[type]||baseTypeLabel(type);
    };
  }

  function installValidation(){
    const baseValidCandidate=validCandidate;
    validCandidate=function(type,index,candidate){
      if(!isOpeningType(type)) return baseValidCandidate(type,index,candidate);
      const c=DATA.containers[state.container];
      const face=candidate.face||mountedFace(type,index)||MOUNTED_FACE_TYPES[type]?.defaultFace||'A';
      const dim=faceLength(face,c);
      const dims=objectDimensions(type,index)||{};
      const half=(Number(dims.width)||.90)/2;
      if(candidate.x-half<-dim/2+CLEARANCE||candidate.x+half>dim/2-CLEARANCE) return false;
      if((Number(dims.height)||0)>openingMaxHeight(type,c)+.001) return false;
      return apertureCollisionAllowed(type,index,{...candidate,face},dims);
    };

    const baseDimensionAllowed=dimensionChangeAllowed;
    dimensionChangeAllowed=function(type,index,next){
      if(!isOpeningType(type)) return baseDimensionAllowed(type,index,next);
      const p=actualLayout(type,index)||{};
      const face=p.face||MOUNTED_FACE_TYPES[type]?.defaultFace||'A';
      const c=DATA.containers[state.container];
      const half=(Number(next.width)||.90)/2;
      if(Math.abs(Number(p.x)||0)+half>faceLength(face,c)/2-CLEARANCE) return false;
      if((Number(next.height)||0)>openingMaxHeight(type,c)+.001) return false;
      return apertureCollisionAllowed(type,index,{...p,face},next);
    };

    const baseUpdateDimension=updateSelectedDimension;
    updateSelectedDimension=function(key,value){
      if(selectedEditable&&isOpeningType(selectedEditable.type)){
        const parsed=Number(value);
        if(Number.isFinite(parsed)){
          if(key==='width') value=Math.min(parsed,openingMaxWidthAt(selectedEditable.type,selectedEditable.index));
          if(key==='height') value=Math.min(parsed,openingMaxHeight(selectedEditable.type));
        }
      }
      return baseUpdateDimension(key,value);
    };
  }

  function installEditor(){
    const baseShowEditor=showEditorPanel;
    showEditorPanel=function(root){
      baseShowEditor(root);
      const meta=root?.userData?.editor;
      if(!meta||!isOpeningType(meta.type)) return;
      lastSelection={type:meta.type,index:meta.index};
      document.getElementById('object-editor')?.classList.remove('hidden');
      renderDimensionEditor(meta.type,meta.index);
      document.getElementById('dimension-editor')?.classList.remove('hidden');
    };

    const baseSelectEditable=selectEditable;
    selectEditable=function(root){
      const meta=root?.userData?.editor;
      if(meta&&isOpeningType(meta.type)) lastSelection={type:meta.type,index:meta.index};
      else if(!root) lastSelection=null;
      return baseSelectEditable(root);
    };

    const baseRenderDimensionEditor=renderDimensionEditor;
    renderDimensionEditor=function(type,index){
      baseRenderDimensionEditor(type,index);
      document.getElementById('opening-limit-note')?.remove();
      if(!isOpeningType(type)) return;
      const editor=document.getElementById('dimension-editor');
      if(!editor||editor.classList.contains('hidden')) return;
      const note=document.createElement('div');
      note.id='opening-limit-note';
      note.className='mt-2 text-[9px] text-sky-300 font-bold';
      note.textContent=`Máximo actual: ${openingMaxWidthAt(type,index).toFixed(2)} m ancho × ${openingMaxHeight(type).toFixed(2)} m alto`;
      editor.appendChild(note);
    };
  }

  function installFacePicker(){
    const baseOpenMountedFacePicker=openMountedFacePicker;
    openMountedFacePicker=function(type){
      baseOpenMountedFacePicker(type);
      if(!isOpeningType(type)) return;
      const title=document.getElementById('mounted-face-title');
      const desc=document.getElementById('mounted-face-desc');
      if(title) title.textContent=`¿En qué cara irá ${typeLabel(type).toLowerCase()}?`;
      if(desc) desc.textContent=isWindowOpening(type)
        ? 'Selecciona A, B, C o D. Después podrás editar ancho y alto igual que una ventana termopanel.'
        : 'Selecciona A, B, C o D. El vano comenzará desde el nivel de piso.';
    };
  }

  function installSurfaceAreaIntegration(){
    if(typeof windowsForFace==='function'){
      const baseWindowsForFace=windowsForFace;
      windowsForFace=function(face,c){
        const list=baseWindowsForFace(face,c);
        TYPES.forEach(type=>{
          for(let i=0;i<(state.counts[type]||0);i++){
            const aperture=apertureFor(type,i,face,c);
            if(aperture) list.push({...aperture});
          }
        });
        return list;
      };
    }

    if(typeof actualOpeningAreaForFaces==='function'){
      const baseArea=actualOpeningAreaForFaces;
      actualOpeningAreaForFaces=function(type,faces){
        let area=baseArea(type,faces);
        if(type!=='window') return area;
        TYPES.forEach(openingType=>{
          for(let i=0;i<(state.counts[openingType]||0);i++){
            const p=actualLayout(openingType,i)||{};
            if(!faces.includes(p.face||MOUNTED_FACE_TYPES[openingType]?.defaultFace||'A')) continue;
            const d=objectDimensions(openingType,i)||{};
            area+=(Number(d.width)||.90)*(Number(d.height)||(isWindowOpening(openingType)?1.05:2.10));
          }
        });
        return area;
      };
    }
  }

  function installRebuild(){
    createContainerShell=buildShell;
    const baseRebuild=rebuild3D;
    rebuild3D=function(){
      const selection=(selectedEditable&&isOpeningType(selectedEditable.type))?{...selectedEditable}:(lastSelection?{...lastSelection}:null);
      baseRebuild();
      rebuildOpeningDetails();
      if(selection) restoreSelection(selection);
    };
  }

  function install(){
    if(installed) return true;
    const ready=Boolean(
      window.BAT_KUBIQUEITOR_FINAL_SCENE_COMPOSER?.version>=16&&
      typeof DATA!=='undefined'&&typeof MOUNTED_FACE_TYPES!=='undefined'&&typeof OBJECT_DIMENSIONS!=='undefined'&&
      typeof ensureLayoutState==='function'&&typeof ensureDimensionState==='function'&&
      typeof actualLayout==='function'&&typeof mountedFace==='function'&&typeof mountedRotation==='function'&&typeof mountedSurface==='function'&&
      typeof registerEditable==='function'&&typeof showEditorPanel==='function'&&typeof renderDimensionEditor==='function'&&
      typeof selectEditable==='function'&&typeof rebuild3D==='function'&&typeof createContainerShell==='function'
    );
    if(!ready) return false;

    installDefinitions();
    installValidation();
    installEditor();
    installFacePicker();
    installSurfaceAreaIntegration();
    installRebuild();
    installed=true;
    window.BAT_KUBIQUEITOR_OPENING_SYSTEM={version:1,types:[...TYPES]};
    if(typeof renderAll==='function') renderAll(); else rebuild3D();
    return true;
  }

  let tries=0;
  const timer=setInterval(()=>{
    tries++;
    if(install()){clearInterval(timer);return;}
    if(tries>=200){clearInterval(timer);console.error('bat-kubiqueitor: opening-system no pudo instalarse');}
  },80);
})();
