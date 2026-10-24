// Extra wall openings for bat-kubiqueitor.
// Adds two customer-facing Extras: plain opening and opening with metal frame.
// Loaded after interior-systems.js so it can also cut interior cladding and BOM surface areas.

(function(){
  const OPENING_TYPES=['opening','openingFrame'];
  const APERTURE_TYPES=['window','door','opening','openingFrame'];
  const CORNER_POST_WIDTH=.13;
  const CORNER_CLEARANCE=CORNER_POST_WIDTH/2;
  const OPENING_VERTICAL_CLEARANCE=.08;

  DATA.extras.opening={name:'Vano',icon:'fa-vector-square',max:8};
  DATA.extras.openingFrame={name:'Vano con marco metálico',icon:'fa-border-all',max:8};
  if(!Number.isFinite(Number(state.counts.opening))) state.counts.opening=0;
  if(!Number.isFinite(Number(state.counts.openingFrame))) state.counts.openingFrame=0;

  MOUNTED_FACE_TYPES.opening={defaultFace:'A',gap:1.00,padding:CORNER_CLEARANCE,height:'opening',label:'Vano'};
  MOUNTED_FACE_TYPES.openingFrame={defaultFace:'A',gap:1.00,padding:CORNER_CLEARANCE,height:'opening',label:'Vano con marco metálico'};

  OBJECT_DIMENSIONS.opening={
    fields:[
      {key:'width',label:'Ancho',min:.50,max:12.10,step:.05},
      {key:'height',label:'Alto',min:.50,max:2.80,step:.05}
    ],
    defaults:()=>({width:.90,height:2.10,depth:.20})
  };
  OBJECT_DIMENSIONS.openingFrame={
    fields:[
      {key:'width',label:'Ancho',min:.50,max:12.10,step:.05},
      {key:'height',label:'Alto',min:.50,max:2.80,step:.05}
    ],
    defaults:()=>({width:.90,height:2.10,depth:.20})
  };

  function openingFaceLength(face,c=DATA.containers[state.container]){
    return (face==='A'||face==='B')?c.length:c.width;
  }

  function openingMaxHeight(c=DATA.containers[state.container]){
    return Math.max(.50,Math.min(2.80,c.height-(OPENING_VERTICAL_CLEARANCE*2)));
  }

  function openingMaxWidthAt(type,index,layoutOverride=null){
    const c=DATA.containers[state.container];
    const p=layoutOverride||actualLayout(type,index);
    const face=p?.face||MOUNTED_FACE_TYPES[type]?.defaultFace||'A';
    const faceLength=openingFaceLength(face,c);
    const center=Math.abs(Number(p?.x)||0);
    const halfClear=Math.max(.25,faceLength/2-CORNER_CLEARANCE);
    return Math.max(.50,Math.min(faceLength-(CORNER_CLEARANCE*2),2*(halfClear-center)));
  }

  function openingFitsCornerPosts(type,index,candidate,dims=null){
    const d=dims||objectDimensions(type,index);
    const maxWidth=openingMaxWidthAt(type,index,candidate);
    return (Number(d.width)||.90)<=maxWidth+.001;
  }

  const ensureLayoutStateBeforeOpenings=ensureLayoutState;
  ensureLayoutState=function(){
    ensureLayoutStateBeforeOpenings();
    OPENING_TYPES.forEach(type=>{ if(!Array.isArray(state.layout[type])) state.layout[type]=[]; });
  };

  const typeLabelBeforeOpenings=typeLabel;
  typeLabel=function(type){
    if(type==='opening') return 'Vano';
    if(type==='openingFrame') return 'Vano con marco metálico';
    return typeLabelBeforeOpenings(type);
  };

  function apertureHalfWidth(type,index,dimsOverride=null){
    if(type==='electrical') return .085;
    const d=dimsOverride||objectDimensions(type,index);
    return Math.max(.10,(Number(d.width)||.20)/2);
  }

  function apertureCollisionAllowed(type,index,candidate,dimsOverride=null){
    if(!APERTURE_TYPES.includes(type)) return true;
    const face=candidate.face||mountedFace(type,index);
    const half=apertureHalfWidth(type,index,dimsOverride);
    for(const otherType of APERTURE_TYPES){
      for(let i=0;i<(state.counts[otherType]||0);i++){
        if(otherType===type&&i===index) continue;
        const other=actualLayout(otherType,i);
        if(other.face!==face) continue;
        const otherHalf=apertureHalfWidth(otherType,i);
        if(Math.abs((Number(other.x)||0)-(Number(candidate.x)||0))<half+otherHalf+.08) return false;
      }
    }
    return true;
  }

  const validCandidateBeforeOpenings=validCandidate;
  validCandidate=function(type,index,candidate){
    if(OPENING_TYPES.includes(type)){
      const dims=objectDimensions(type,index);
      if(!openingFitsCornerPosts(type,index,candidate,dims)) return false;
      if((Number(dims.height)||0)>openingMaxHeight()+.001) return false;
      return apertureCollisionAllowed(type,index,candidate,dims);
    }
    if(!validCandidateBeforeOpenings(type,index,candidate)) return false;
    return apertureCollisionAllowed(type,index,candidate);
  };

  const dimensionChangeAllowedBeforeOpenings=dimensionChangeAllowed;
  dimensionChangeAllowed=function(type,index,next){
    if(OPENING_TYPES.includes(type)){
      const p=actualLayout(type,index);
      if((Number(next.height)||0)>openingMaxHeight()+.001) return false;
      if(!openingFitsCornerPosts(type,index,p,next)) return false;
      return apertureCollisionAllowed(type,index,p,next);
    }
    if(!dimensionChangeAllowedBeforeOpenings(type,index,next)) return false;
    if(!APERTURE_TYPES.includes(type)) return true;
    return apertureCollisionAllowed(type,index,actualLayout(type,index),next);
  };

  const updateSelectedDimensionBeforeOpeningLimits=updateSelectedDimension;
  updateSelectedDimension=function(key,value){
    if(selectedEditable&&OPENING_TYPES.includes(selectedEditable.type)){
      const parsed=Number(value);
      if(Number.isFinite(parsed)){
        if(key==='width') value=Math.min(parsed,openingMaxWidthAt(selectedEditable.type,selectedEditable.index));
        if(key==='height') value=Math.min(parsed,openingMaxHeight());
      }
    }
    return updateSelectedDimensionBeforeOpeningLimits(key,value);
  };

  const renderDimensionEditorBeforeOpeningLimits=renderDimensionEditor;
  renderDimensionEditor=function(type,index){
    renderDimensionEditorBeforeOpeningLimits(type,index);
    document.getElementById('opening-corner-limit-note')?.remove();
    if(!OPENING_TYPES.includes(type)) return;
    const editor=document.getElementById('dimension-editor');
    if(!editor||editor.classList.contains('hidden')) return;
    const inputs=[...editor.querySelectorAll('input[type="number"]')];
    const widthInput=inputs.find(input=>(input.closest('label')?.textContent||'').includes('Ancho'));
    const heightInput=inputs.find(input=>(input.closest('label')?.textContent||'').includes('Alto'));
    const maxWidth=openingMaxWidthAt(type,index),maxHeight=openingMaxHeight();
    if(widthInput){
      widthInput.max=maxWidth.toFixed(2);
      widthInput.title=`Máximo entre corner posts: ${maxWidth.toFixed(2)} m`;
    }
    if(heightInput){
      heightInput.max=maxHeight.toFixed(2);
      heightInput.title=`Altura máxima disponible: ${maxHeight.toFixed(2)} m`;
    }
    const note=document.createElement('div');
    note.id='opening-corner-limit-note';
    note.className='mt-2 text-[9px] text-sky-300 font-bold';
    note.textContent=`Máximo actual: ${maxWidth.toFixed(2)} m ancho × ${maxHeight.toFixed(2)} m alto · respetando estructura del contenedor`;
    editor.appendChild(note);
  };

  const hideEditorPanelBeforeOpeningLimits=hideEditorPanel;
  hideEditorPanel=function(){
    document.getElementById('opening-corner-limit-note')?.remove();
    return hideEditorPanelBeforeOpeningLimits();
  };

  function openingVerticalBounds(c,dims){
    const bottom=OPENING_VERTICAL_CLEARANCE;
    const height=Math.min(Number(dims.height)||2.10,openingMaxHeight(c));
    const top=bottom+height;
    return {bottom,top,centerY:(bottom+top)/2,height};
  }

  const windowsForFaceBeforeOpenings=windowsForFace;
  windowsForFace=function(face,c){
    const openings=windowsForFaceBeforeOpenings(face,c);
    for(const type of OPENING_TYPES){
      for(let i=0;i<(state.counts[type]||0);i++){
        const layout=actualLayout(type,i);
        if((layout.face||'A')!==face) continue;
        const dims=objectDimensions(type,i),v=openingVerticalBounds(c,dims);
        openings.push({
          index:i,
          type,
          center:Number(layout.x)||0,
          width:Math.max(.20,Number(dims.width)||.90)+.025,
          bottom:v.bottom-.005,
          top:v.top+.005
        });
      }
    }
    return openings;
  };

  function createOpeningObject(type,index){
    const dims=objectDimensions(type,index),g=new THREE.Group();
    const width=Number(dims.width)||.90,height=Math.min(Number(dims.height)||2.10,openingMaxHeight()),depth=.20;
    const recess=mat(0x111827,{roughness:.96,metalness:0});
    const voidPanel=box(Math.max(.18,width-.035),Math.max(.18,height-.035),.055,recess,0,0,-.075);
    voidPanel.name='wall-opening-void';
    voidPanel.userData.wallOpeningVoid=true;
    voidPanel.renderOrder=30;
    g.add(voidPanel);
    if(type==='openingFrame'){
      const steel=mat(0x64748b,{roughness:.30,metalness:.78});
      const t=.055;
      const left=box(t,height,depth,steel,-width/2+t/2,0,0);
      const right=box(t,height,depth,steel,width/2-t/2,0,0);
      const top=box(width,t,depth,steel,0,height/2-t/2,0);
      left.name=right.name=top.name='opening-metal-frame';
      g.add(left,right,top);
    }
    const hit=new THREE.Mesh(
      new THREE.BoxGeometry(Math.max(.20,width-.04),Math.max(.20,height-.04),.028),
      new THREE.MeshBasicMaterial({color:0xf59e0b,transparent:true,opacity:.002,depthWrite:false,side:THREE.DoubleSide})
    );
    hit.userData.openingHitbox=true;
    g.add(hit);
    g.userData.wallOpeningType=type;
    return g;
  }

  function positionOpeningObject(obj,type,index,layout,c){
    const dims=objectDimensions(type,index),v=openingVerticalBounds(c,dims),face=layout.face||'A';
    obj.rotation.y=mountedRotation(face);
    if(face==='A') obj.position.set(layout.x,v.centerY,c.width/2);
    else if(face==='B') obj.position.set(layout.x,v.centerY,-c.width/2);
    else if(face==='C') obj.position.set(c.length/2,v.centerY,layout.x);
    else obj.position.set(-c.length/2,v.centerY,layout.x);
  }

  const positionMountedObjectBeforeOpenings=positionMountedObject;
  positionMountedObject=function(obj,type,layout,c){
    if(OPENING_TYPES.includes(type)){
      const index=obj?.userData?.editor?.index;
      return positionOpeningObject(obj,type,Number.isInteger(index)?index:0,layout,c);
    }
    return positionMountedObjectBeforeOpenings(obj,type,layout,c);
  };

  const mountedParametricPositionBeforeOpenings=mountedParametricPosition;
  mountedParametricPosition=function(obj,type,layout,c,dims){
    if(OPENING_TYPES.includes(type)){
      const index=obj?.userData?.editor?.index;
      return positionOpeningObject(obj,type,Number.isInteger(index)?index:0,layout,c);
    }
    return mountedParametricPositionBeforeOpenings(obj,type,layout,c,dims);
  };

  const openMountedFacePickerBeforeOpenings=openMountedFacePicker;
  openMountedFacePicker=function(type){
    openMountedFacePickerBeforeOpenings(type);
    if(!OPENING_TYPES.includes(type)) return;
    const title=document.getElementById('mounted-face-title'),desc=document.getElementById('mounted-face-desc');
    if(title) title.textContent=type==='opening'?'¿En qué cara irá el vano?':'¿En qué cara irá el vano con marco metálico?';
    if(desc) desc.textContent='Selecciona una pared A, B, C o D.';
  };

  if(typeof actualOpeningAreaForFaces==='function'){
    const actualOpeningAreaForFacesBeforeExtras=actualOpeningAreaForFaces;
    actualOpeningAreaForFaces=function(type,faces){
      let area=actualOpeningAreaForFacesBeforeExtras(type,faces);
      if(type!=='window') return area;
      for(const openingType of OPENING_TYPES){
        for(let i=0;i<(state.counts[openingType]||0);i++){
          const p=actualLayout(openingType,i),d=objectDimensions(openingType,i);
          if(faces.includes(p.face)) area+=(Number(d.width)||.90)*Math.min(Number(d.height)||2.10,openingMaxHeight());
        }
      }
      return area;
    };
  }

  if(typeof addInteriorCladdingVisuals==='function'){
    addInteriorCladdingVisuals=function(){
      if(!containerGroup) return;
      const s=ensureInteriorSystem(),c=DATA.containers[state.container],L=c.length,W=c.width,H=c.height;
      const lining=interiorSystemMaterial(),g=new THREE.Group();
      g.name='interior-cladding-system';
      const th=.018;
      if(s.faces.B) addSegmentedWall(g,{axisLength:L-.30,axisMin:-L/2+.15,axisMax:L/2-.15,yMin:.15,yMax:H-.15,thickness:th,position:-W/2+.082,axis:'x',material:lining,openings:windowsForFace('B',c)});
      if(s.faces.A&&!state.cutaway) addSegmentedWall(g,{axisLength:L-.30,axisMin:-L/2+.15,axisMax:L/2-.15,yMin:.15,yMax:H-.15,thickness:th,position:W/2-.082,axis:'x',material:lining,openings:windowsForFace('A',c)});
      if(s.faces.D) addSegmentedWall(g,{axisLength:W-.30,axisMin:-W/2+.15,axisMax:W/2-.15,yMin:.15,yMax:H-.15,thickness:th,position:-L/2+.095,axis:'z',material:lining,openings:windowsForFace('D',c)});
      if(s.faces.C) addSegmentedWall(g,{axisLength:W-.30,axisMin:-W/2+.15,axisMax:W/2-.15,yMin:.15,yMax:H-.15,thickness:th,position:L/2-.095,axis:'z',material:lining,openings:windowsForFace('C',c)});
      if(s.faces.E&&!state.cutaway) g.add(box(L-.30,th,W-.30,lining,0,H-.085,0));
      containerGroup.add(g);
    };
  }

  const rebuild3DBeforeOpeningExtras=rebuild3D;
  rebuild3D=function(){
    const previousSelection=selectedEditable&&OPENING_TYPES.includes(selectedEditable.type)?{...selectedEditable}:null;
    rebuild3DBeforeOpeningExtras();
    if(!containerGroup) return;
    ensureLayoutState(); ensureDimensionState();
    const c=DATA.containers[state.container];
    for(const type of OPENING_TYPES){
      for(let i=0;i<(state.counts[type]||0);i++){
        const p=actualLayout(type,i),obj=createOpeningObject(type,i);
        registerEditable(obj,type,i,{axis:(p.face==='A'||p.face==='B')?'x':'z',surface:mountedSurface(p.face),face:p.face});
        positionOpeningObject(obj,type,i,p,c);
        containerGroup.add(obj);
      }
    }
    if(previousSelection){
      const root=editableObjects.find(o=>o.userData.editor?.type===previousSelection.type&&o.userData.editor?.index===previousSelection.index);
      if(root){ selectedEditable=previousSelection; addSelectionOutline(root); showEditorPanel(root); }
    }
  };

  function bootOpeningExtras(){
    ensureLayoutState(); ensureDimensionState();
    if(typeof renderExtras==='function') renderExtras();
    renderAll();
  }

  if(document.readyState==='loading') window.addEventListener('DOMContentLoaded',()=>setTimeout(bootOpeningExtras,30),{once:true});
  else setTimeout(bootOpeningExtras,30);
})();