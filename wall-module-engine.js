// Capability-based wall module engine for bat-kubiqueitor.
// One registry owns wall-mounted capabilities; renderers consume the same aperture source.
(function(){
  if(window.BAT_KUBIQUEITOR_WALL_MODULE_ENGINE) return;

  const registry=new Map();
  let hooksInstalled=false;
  let labelsInstalled=false;
  let placementInstalled=false;
  let validationInstalled=false;
  let surfaceInstalled=false;
  let rebuildInstalled=false;

  const cloneFields=fields=>(fields||[]).map(field=>({...field}));
  const bool=v=>Boolean(v);
  const isManagedOpening=def=>def?.render==='opening';

  function normalizeDefinition(input){
    const base=input?.extends?registry.get(input.extends):null;
    const merged={
      ...(base||{}),
      ...(input||{}),
      placement:{...(base?.placement||{}),...(input?.placement||{})},
      aperture:{...(base?.aperture||{}),...(input?.aperture||{})},
      capabilities:{...(base?.capabilities||{}),...(input?.capabilities||{})}
    };
    merged.type=input.type;
    merged.label=input.label||base?.label||input.type;
    merged.render=input.render||base?.render||'native';
    merged.capabilities={
      placement:merged.capabilities.placement!==false,
      dimensions:merged.capabilities.dimensions!==false,
      collision:merged.capabilities.collision!==false,
      wallCut:bool(merged.capabilities.wallCut),
      framingCut:bool(merged.capabilities.framingCut),
      insulationCut:bool(merged.capabilities.insulationCut),
      liningCut:bool(merged.capabilities.liningCut),
      frame:bool(merged.capabilities.frame),
      glass:bool(merged.capabilities.glass),
      leaf:bool(merged.capabilities.leaf),
      editor:merged.capabilities.editor!==false,
      bom:merged.capabilities.bom!==false
    };
    return merged;
  }

  function syncLegacyDefinition(def){
    if(typeof MOUNTED_FACE_TYPES!=='undefined'&&def.capabilities.placement){
      MOUNTED_FACE_TYPES[def.type]={
        defaultFace:def.placement.defaultFace||'A',
        gap:Number(def.placement.gap)||.20,
        padding:Number(def.placement.padding)||.12,
        height:def.aperture.kind||def.type,
        label:def.label
      };
    }
    if(typeof DATA!=='undefined'&&def.extra){
      DATA.extras[def.type]={name:def.label,icon:def.icon||'fa-cube',max:Number(def.max)||8};
    }
    if(typeof state!=='undefined'){
      state.counts=state.counts||{};
      if(!Number.isFinite(Number(state.counts[def.type]))) state.counts[def.type]=0;
      state.layout=state.layout||{};
      if(!Array.isArray(state.layout[def.type])) state.layout[def.type]=[];
    }
    if(typeof OBJECT_DIMENSIONS!=='undefined'&&def.dimensions){
      OBJECT_DIMENSIONS[def.type]={fields:cloneFields(def.dimensions.fields),defaults:def.dimensions.defaults};
      try{ensureDimensionState?.();}catch(e){}
    }
  }

  function registerWallModule(input){
    if(!input?.type) throw new Error('wall module requires type');
    const def=normalizeDefinition(input);
    registry.set(def.type,def);
    syncLegacyDefinition(def);
    return def;
  }

  function definition(type){return registry.get(type)||null;}
  function allDefinitions(){return [...registry.values()];}
  function openingDefinitions(){return allDefinitions().filter(def=>def.capabilities.wallCut||def.capabilities.framingCut||def.capabilities.liningCut);}
  function renderedOpeningDefinitions(){return allDefinitions().filter(isManagedOpening);}
  function dimensionsOf(type,index){try{return objectDimensions(type,index)||{};}catch(e){return {};}}
  function layoutOf(type,index){try{return actualLayout(type,index)||{};}catch(e){return {};}}
  function faceSpan(face,c){return (face==='A'||face==='B')?c.length:c.width;}

  function apertureBounds(def,type,index,c){
    const dims=dimensionsOf(type,index);
    const height=Math.max(.20,Number(dims.height)||Number(def.aperture.defaultHeight)||1);
    const kind=def.aperture.kind||'window';
    let bottom=.08;
    if(kind==='window') bottom=Number(def.aperture.sill);
    if(!Number.isFinite(bottom)) bottom=kind==='window' ? .95 : .08;
    if(kind==='window'&&def.aperture.centerRatio){
      const half=height/2;
      const center=Math.min(c.height-half-.12,Math.max(half+.12,c.height*Number(def.aperture.centerRatio)));
      bottom=center-half;
    }
    bottom=Math.max(.02,Math.min(bottom,Math.max(.02,c.height-height-.08)));
    const top=Math.min(c.height-.08,bottom+height);
    return {bottom,top,height:Math.max(.02,top-bottom),centerY:(bottom+top)/2};
  }

  function apertureFor(type,index,face,c=DATA.containers[state.container]){
    const def=definition(type);
    if(!def) return null;
    if(!(def.capabilities.wallCut||def.capabilities.framingCut||def.capabilities.liningCut)) return null;
    const layout=layoutOf(type,index);
    const actualFace=layout.face||def.placement.defaultFace||'A';
    if(actualFace!==face) return null;
    const dims=dimensionsOf(type,index);
    const width=Math.max(.10,Number(dims.width)||Number(def.aperture.defaultWidth)||.90);
    const bounds=apertureBounds(def,type,index,c);
    const center=Number(layout.x)||0;
    return {type,index,center,width,left:center-width/2,right:center+width/2,...bounds};
  }

  function aperturesForFace(face,c=DATA.containers[state.container],capability='wallCut'){
    const list=[];
    allDefinitions().forEach(def=>{
      if(!def.capabilities[capability]) return;
      for(let i=0;i<(state.counts?.[def.type]||0);i++){
        const aperture=apertureFor(def.type,i,face,c);
        if(aperture) list.push(aperture);
      }
    });
    return list;
  }

  function mergeIntervals(intervals,min,max){
    const cleaned=intervals.map(([a,b])=>[Math.max(min,a),Math.min(max,b)]).filter(([a,b])=>b-a>.001).sort((a,b)=>a[0]-b[0]);
    const result=[];
    cleaned.forEach(pair=>{
      const last=result[result.length-1];
      if(!last||pair[0]>last[1]+.001) result.push(pair.slice());
      else last[1]=Math.max(last[1],pair[1]);
    });
    return result;
  }

  function addWallWithCuts(parent,{axis,axisMin,axisMax,yMin,yMax,position,thickness,material,openings}){
    const boundaries=[axisMin,axisMax];
    openings.forEach(open=>{boundaries.push(Math.max(axisMin,Math.min(axisMax,open.left)));boundaries.push(Math.max(axisMin,Math.min(axisMax,open.right)));});
    const points=[...new Set(boundaries.map(v=>Number(v.toFixed(4))))].sort((a,b)=>a-b);
    for(let i=0;i<points.length-1;i++){
      const a=points[i],b=points[i+1];if(b-a<.002) continue;
      const mid=(a+b)/2;
      const blocked=mergeIntervals(openings.filter(open=>mid>open.left+.0005&&mid<open.right-.0005).map(open=>[open.bottom,open.top]),yMin,yMax);
      let cursor=yMin;
      const addSegment=(low,high)=>{
        if(high-low<.002)return;
        const size=b-a,center=(a+b)/2,height=high-low,y=(low+high)/2;
        if(axis==='x')parent.add(box(size,height,thickness,material,center,y,position));
        else parent.add(box(thickness,height,size,material,position,y,center));
      };
      blocked.forEach(([low,high])=>{addSegment(cursor,low);cursor=Math.max(cursor,high);});
      addSegment(cursor,yMax);
    }
  }

  function addRibWithCuts(parent,{x,z,material,yMin,yMax,openings}){
    const blocked=mergeIntervals(openings.filter(open=>x>open.left-.015&&x<open.right+.015).map(open=>[open.bottom,open.top]),yMin,yMax);
    let cursor=yMin;
    const add=(low,high)=>{if(high-low>.01)parent.add(box(.028,high-low,.022,material,x,(low+high)/2,z));};
    blocked.forEach(([low,high])=>{add(cursor,low);cursor=Math.max(cursor,high);});add(cursor,yMax);
  }

  function createCutShell(c,materials){
    const g=new THREE.Group(),L=c.length,W=c.width,H=c.height,{exterior,interior,frame,floor}=materials,yMin=.08,yMax=H-.08,postW=.13;
    const faces={A:aperturesForFace('A',c,'wallCut'),B:aperturesForFace('B',c,'wallCut'),C:aperturesForFace('C',c,'wallCut'),D:aperturesForFace('D',c,'wallCut')};
    g.add(box(L,.14,W,floor,0,.02,0));
    [-L/2,L/2].forEach(x=>[-W/2,W/2].forEach(z=>g.add(box(postW,H+.12,postW,frame,x,H/2,z))));
    g.add(box(L,.11,.12,frame,0,.07,-W/2));g.add(box(L,.11,.12,frame,0,.07,W/2));g.add(box(L,.11,.12,frame,0,H-.03,-W/2));g.add(box(L,.11,.12,frame,0,H-.03,W/2));
    addWallWithCuts(g,{axis:'x',axisMin:-L/2+.10,axisMax:L/2-.10,yMin,yMax,position:-W/2,thickness:.055,material:exterior,openings:faces.B});
    if(!state.cutaway)addWallWithCuts(g,{axis:'x',axisMin:-L/2+.10,axisMax:L/2-.10,yMin,yMax,position:W/2,thickness:.045,material:exterior,openings:faces.A});
    addWallWithCuts(g,{axis:'z',axisMin:-W/2+.09,axisMax:W/2-.09,yMin,yMax,position:L/2,thickness:.075,material:exterior,openings:faces.C});
    addWallWithCuts(g,{axis:'z',axisMin:-W/2+.09,axisMax:W/2-.09,yMin,yMax,position:-L/2,thickness:.075,material:exterior,openings:faces.D});
    addWallWithCuts(g,{axis:'x',axisMin:-L/2+.14,axisMax:L/2-.14,yMin:.14,yMax:H-.14,position:-W/2+.055,thickness:.018,material:interior,openings:faces.B});
    if(!state.cutaway)g.add(box(L-.12,.07,W-.12,exterior,0,H,0));else g.add(box(L-.24,.06,.08,frame,0,H-.02,W/2));
    const ribMat=mat(new THREE.Color(state.exteriorColor).multiplyScalar(.78),{roughness:.62,metalness:.2}),spacing=.32,count=Math.floor((L-.3)/spacing);
    for(let i=0;i<=count;i++){
      const x=-L/2+.18+i*spacing;
      addRibWithCuts(g,{x,z:-W/2-.038,material:ribMat,yMin:.13,yMax:H-.12,openings:faces.B});
      if(!state.cutaway)addRibWithCuts(g,{x,z:W/2+.038,material:ribMat,yMin:.13,yMax:H-.12,openings:faces.A});
    }
    const blockMat=mat(0x172033,{roughness:.45,metalness:.55});
    [-L/2,L/2].forEach(x=>[-W/2,W/2].forEach(z=>[.08,H-.08].forEach(y=>g.add(box(.23,.15,.23,blockMat,x,y,z)))));
    return g;
  }

  function installCoreDefinitions(){
    if(registry.has('window'))return;
    const windowSchema=typeof OBJECT_DIMENSIONS!=='undefined'?OBJECT_DIMENSIONS.window:null,doorSchema=typeof OBJECT_DIMENSIONS!=='undefined'?OBJECT_DIMENSIONS.door:null;
    registerWallModule({type:'window',label:'Ventana termopanel',render:'native',placement:{defaultFace:'B',gap:1.22,padding:.72,inset:.075},aperture:{kind:'window',centerRatio:.60,defaultWidth:1.20,defaultHeight:1.05},capabilities:{wallCut:true,framingCut:true,insulationCut:true,liningCut:true,frame:true,glass:true,editor:true,bom:true},dimensions:windowSchema?{fields:windowSchema.fields,defaults:windowSchema.defaults}:null});
    registerWallModule({type:'door',label:'Puerta peatonal',render:'native',placement:{defaultFace:'A',gap:1.02,padding:.58,inset:.07},aperture:{kind:'door',defaultWidth:.98,defaultHeight:2.08},capabilities:{wallCut:true,framingCut:true,insulationCut:true,liningCut:true,frame:true,leaf:true,editor:true,bom:true},dimensions:doorSchema?{fields:doorSchema.fields,defaults:doorSchema.defaults}:null});
    registerWallModule({type:'ac',label:'Aire acondicionado',render:'native',placement:{defaultFace:'B',gap:.95,padding:.55,inset:-.17},capabilities:{placement:true,dimensions:true,collision:true,editor:true,bom:true}});
    registerWallModule({type:'electrical',label:'Punto eléctrico',render:'native',placement:{defaultFace:'A',gap:.22,padding:.16,inset:-.075},capabilities:{placement:true,dimensions:false,collision:true,editor:true,bom:true}});
  }

  function installLabels(){if(labelsInstalled||typeof typeLabel!=='function')return;const base=typeLabel;typeLabel=function(type){return definition(type)?.label||base(type);};labelsInstalled=true;}

  function modulePosition(group,type,index,c=DATA.containers[state.container]){
    const def=definition(type),layout=layoutOf(type,index),face=layout.face||def?.placement.defaultFace||'A',bounds=apertureBounds(def,type,index,c),offset=Number(layout.x)||0,inset=Number(def?.placement.inset)||0;
    group.rotation.y=mountedRotation(face);
    if(face==='A')group.position.set(offset,bounds.centerY,c.width/2+inset);
    else if(face==='B')group.position.set(offset,bounds.centerY,-c.width/2-inset);
    else if(face==='C')group.position.set(c.length/2+inset,bounds.centerY,offset);
    else group.position.set(-c.length/2-inset,bounds.centerY,offset);
    return face;
  }

  function installPlacement(){
    if(placementInstalled||typeof positionMountedObject!=='function')return;
    const base=positionMountedObject;
    positionMountedObject=function(obj,type,layout,c){
      const def=definition(type);
      if(isManagedOpening(def)){
        const index=Number.isInteger(obj?.userData?.editor?.index)?obj.userData.editor.index:Math.max(0,(state.counts?.[type]||1)-1);
        return modulePosition(obj,type,index,c);
      }
      return base(obj,type,layout,c);
    };
    if(typeof mountedParametricPosition==='function'){
      const baseParametric=mountedParametricPosition;
      mountedParametricPosition=function(obj,type,layout,c,dims){
        const def=definition(type);
        if(isManagedOpening(def)){
          const index=Number.isInteger(obj?.userData?.editor?.index)?obj.userData.editor.index:Math.max(0,(state.counts?.[type]||1)-1);
          return modulePosition(obj,type,index,c);
        }
        return baseParametric(obj,type,layout,c,dims);
      };
    }
    placementInstalled=true;
  }

  function apertureCollisionAllowed(type,index,candidate,dimsOverride=null){
    const def=definition(type);if(!def)return true;
    const face=candidate.face||layoutOf(type,index).face||def.placement.defaultFace||'A',dims=dimsOverride||dimensionsOf(type,index),half=Math.max(.05,(Number(dims.width)||Number(def.aperture.defaultWidth)||.90)/2),c=DATA.containers[state.container];
    if(Math.abs(Number(candidate.x)||0)+half>faceSpan(face,c)/2-.08)return false;
    for(const otherDef of openingDefinitions())for(let i=0;i<(state.counts?.[otherDef.type]||0);i++){
      if(otherDef.type===type&&i===index)continue;
      const other=layoutOf(otherDef.type,i),otherFace=other.face||otherDef.placement.defaultFace||'A';if(otherFace!==face)continue;
      const otherDims=dimensionsOf(otherDef.type,i),otherHalf=Math.max(.05,(Number(otherDims.width)||Number(otherDef.aperture.defaultWidth)||.90)/2);
      if(Math.abs((Number(other.x)||0)-(Number(candidate.x)||0))<half+otherHalf+.08)return false;
    }
    return true;
  }

  function installValidation(){
    if(validationInstalled||typeof validCandidate!=='function')return;
    const baseValid=validCandidate;
    validCandidate=function(type,index,candidate){
      const def=definition(type);
      if(!def||!isManagedOpening(def)){
        if(!baseValid(type,index,candidate))return false;
        if(def&&(def.capabilities.wallCut||def.capabilities.framingCut))return apertureCollisionAllowed(type,index,candidate);
        return true;
      }
      return apertureCollisionAllowed(type,index,candidate);
    };
    if(typeof dimensionChangeAllowed==='function'){
      const baseDimAllowed=dimensionChangeAllowed;
      dimensionChangeAllowed=function(type,index,next){
        const def=definition(type);if(!def||!isManagedOpening(def))return baseDimAllowed(type,index,next);
        const p=layoutOf(type,index),face=p.face||def.placement.defaultFace||'A',c=DATA.containers[state.container],height=Number(next.height)||apertureBounds(def,type,index,c).height;
        if((def.aperture.kind||'window')==='window'){
          const sill=Number(def.aperture.sill);if(Number.isFinite(sill)&&sill+height>c.height-.08)return false;
        }else if(.08+height>c.height-.08)return false;
        return apertureCollisionAllowed(type,index,{...p,face},next);
      };
    }
    validationInstalled=true;
  }

  function installSurfaceProviders(){
    if(surfaceInstalled)return;
    if(typeof windowsForFace==='function'){
      const baseWindows=windowsForFace;
      windowsForFace=function(face,c){
        const list=baseWindows(face,c)||[];
        renderedOpeningDefinitions().forEach(def=>{
          if(!def.capabilities.framingCut&&!def.capabilities.liningCut&&!def.capabilities.insulationCut)return;
          for(let i=0;i<(state.counts?.[def.type]||0);i++){const aperture=apertureFor(def.type,i,face,c);if(aperture)list.push(aperture);}
        });
        return list;
      };
    }
    if(typeof addInteriorCladdingVisuals==='function'&&typeof ensureInteriorSystem==='function'&&typeof interiorSystemMaterial==='function'){
      addInteriorCladdingVisuals=function(){
        if(!containerGroup)return;
        const s=ensureInteriorSystem(),c=DATA.containers[state.container],L=c.length,W=c.width,H=c.height,lining=interiorSystemMaterial(),g=new THREE.Group(),th=.018;
        g.name='interior-cladding-system';
        if(s.liningFaces?.B??s.faces?.B)addWallWithCuts(g,{axis:'x',axisMin:-L/2+.15,axisMax:L/2-.15,yMin:.15,yMax:H-.15,position:-W/2+.082,thickness:th,material:lining,openings:aperturesForFace('B',c,'liningCut')});
        if((s.liningFaces?.A??s.faces?.A)&&!state.cutaway)addWallWithCuts(g,{axis:'x',axisMin:-L/2+.15,axisMax:L/2-.15,yMin:.15,yMax:H-.15,position:W/2-.082,thickness:th,material:lining,openings:aperturesForFace('A',c,'liningCut')});
        if(s.liningFaces?.D??s.faces?.D)addWallWithCuts(g,{axis:'z',axisMin:-W/2+.15,axisMax:W/2-.15,yMin:.15,yMax:H-.15,position:-L/2+.095,thickness:th,material:lining,openings:aperturesForFace('D',c,'liningCut')});
        if(s.liningFaces?.C??s.faces?.C)addWallWithCuts(g,{axis:'z',axisMin:-W/2+.15,axisMax:W/2-.15,yMin:.15,yMax:H-.15,position:L/2-.095,thickness:th,material:lining,openings:aperturesForFace('C',c,'liningCut')});
        if((s.liningFaces?.E??s.faces?.E)&&!state.cutaway)g.add(box(L-.30,th,W-.30,lining,0,H-.085,0));
        containerGroup.add(g);
      };
    }
    if(typeof actualOpeningAreaForFaces==='function'){
      const baseArea=actualOpeningAreaForFaces;
      actualOpeningAreaForFaces=function(type,faces){
        let area=baseArea(type,faces);if(type!=='window')return area;
        renderedOpeningDefinitions().forEach(def=>{if(!def.capabilities.bom)return;for(let i=0;i<(state.counts?.[def.type]||0);i++){
          const p=layoutOf(def.type,i),face=p.face||def.placement.defaultFace||'A';if(!faces.includes(face))continue;
          const d=dimensionsOf(def.type,i);area+=(Number(d.width)||def.aperture.defaultWidth||.90)*(Number(d.height)||def.aperture.defaultHeight||1);
        }});
        return area;
      };
    }
    surfaceInstalled=true;
  }

  function createManagedOpening(def,type,index,c){
    const dims=dimensionsOf(type,index),width=Math.max(.20,Number(dims.width)||def.aperture.defaultWidth||.90),bounds=apertureBounds(def,type,index,c),g=new THREE.Group();
    g.userData.wallModuleRoot=true;g.userData.wallModuleType=type;
    if(def.capabilities.frame){
      const steel=mat(0x94a3b8,{roughness:.28,metalness:.86}),t=.065,depth=.17;
      const addFrame=(w,h,d,x,y,z)=>{const mesh=box(w,h,d,steel,x,y,z);mesh.name='wall-module-frame';g.add(mesh);};
      addFrame(t,bounds.height,depth,-width/2+t/2,0,0);addFrame(t,bounds.height,depth,width/2-t/2,0,0);addFrame(width,t,depth,0,bounds.height/2-t/2,0);
      if((def.aperture.kind||'window')==='window')addFrame(width,t,depth,0,-bounds.height/2+t/2,0);
    }
    const hit=new THREE.Mesh(new THREE.BoxGeometry(Math.max(.18,width-.02),Math.max(.18,bounds.height-.02),.07),new THREE.MeshBasicMaterial({transparent:true,opacity:.004,depthWrite:false,depthTest:false,side:THREE.DoubleSide}));
    hit.userData.openingHitbox=true;hit.renderOrder=1000;g.add(hit);return g;
  }

  function disposeRoot(root){root?.traverse?.(obj=>{obj.geometry?.dispose?.();if(Array.isArray(obj.material))obj.material.forEach(m=>m?.dispose?.());else obj.material?.dispose?.();});root?.parent?.remove?.(root);}

  function removeLegacyManagedVisuals(){
    if(!containerGroup)return;
    const managedTypes=new Set(renderedOpeningDefinitions().map(def=>def.type));
    [...containerGroup.children].forEach(child=>{const type=child?.userData?.editor?.type;if(child?.userData?.finalOpeningVisual||child?.userData?.wallOpeningType||(type&&managedTypes.has(type)))disposeRoot(child);});
    if(Array.isArray(editableObjects))editableObjects=editableObjects.filter(root=>!managedTypes.has(root?.userData?.editor?.type));
  }

  function rebuildManagedOpenings(){
    if(!containerGroup)return;removeLegacyManagedVisuals();const c=DATA.containers[state.container];
    renderedOpeningDefinitions().forEach(def=>{for(let i=0;i<(state.counts?.[def.type]||0);i++){
      const group=createManagedOpening(def,def.type,i,c);group.userData.editor={type:def.type,index:i};
      const face=modulePosition(group,def.type,i,c);registerEditable(group,def.type,i,{axis:(face==='A'||face==='B')?'x':'z',surface:mountedSurface(face),face});containerGroup.add(group);
    }});
  }

  function restoreSelection(selection){
    if(!selection||!Array.isArray(editableObjects))return;
    const root=editableObjects.find(obj=>obj?.userData?.editor?.type===selection.type&&obj?.userData?.editor?.index===selection.index);if(!root)return;
    selectedEditable={type:selection.type,index:selection.index};addSelectionOutline(root);showEditorPanel(root);
  }

  function installRebuild(){
    if(rebuildInstalled||typeof rebuild3D!=='function')return;
    createContainerShell=createCutShell;
    const baseRebuild=rebuild3D;
    rebuild3D=function(){
      const selected=selectedEditable&&isManagedOpening(definition(selectedEditable.type))?{...selectedEditable}:null;
      baseRebuild();rebuildManagedOpenings();if(selected)restoreSelection(selected);
    };
    rebuildInstalled=true;
  }

  function installHooks(){
    if(hooksInstalled)return true;
    const ready=Boolean(typeof THREE!=='undefined'&&typeof DATA!=='undefined'&&typeof state!=='undefined'&&typeof MOUNTED_FACE_TYPES!=='undefined'&&typeof OBJECT_DIMENSIONS!=='undefined'&&typeof actualLayout==='function'&&typeof objectDimensions==='function'&&typeof mountedRotation==='function'&&typeof mountedSurface==='function'&&typeof registerEditable==='function'&&typeof rebuild3D==='function'&&typeof createContainerShell==='function'&&window.BAT_KUBIQUEITOR_FINAL_SCENE_COMPOSER?.version>=16);
    if(!ready)return false;
    installCoreDefinitions();installLabels();installPlacement();installValidation();installSurfaceProviders();installRebuild();hooksInstalled=true;window.BAT_KUBIQUEITOR_WALL_MODULE_ENGINE.version=1;rebuild3D();return true;
  }

  window.BAT_KUBIQUEITOR_WALL_MODULE_ENGINE={version:0,register:registerWallModule,get:definition,all:allDefinitions,apertureFor,aperturesForFace};
  window.registerWallModule=registerWallModule;
  window.wallModuleDefinition=definition;
  window.wallModuleAperturesForFace=aperturesForFace;

  let attempts=0;
  const timer=setInterval(()=>{
    attempts++;
    try{
      if(typeof MOUNTED_FACE_TYPES!=='undefined'&&typeof OBJECT_DIMENSIONS!=='undefined')installCoreDefinitions();
      allDefinitions().forEach(syncLegacyDefinition);installLabels();installPlacement();installValidation();
      if(installHooks()){clearInterval(timer);return;}
    }catch(error){console.error('bat-kubiqueitor: wall-module-engine',error);clearInterval(timer);}
    if(attempts>=220){clearInterval(timer);console.error('bat-kubiqueitor: wall-module-engine no pudo instalarse');}
  },60);
})();
