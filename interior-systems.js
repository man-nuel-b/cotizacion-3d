// Layered interior system for bat-kubiqueitor.
// Tabiquería, aislación y revestimiento tienen material y caras A-E independientes.

// Recursos sin precio real conocido se incorporan en $0 para que el usuario los valore en Maestro A.P.U.
if(!DATA.catalog.woodFrame) DATA.catalog.woodFrame={name:'Madera estructural para tabiquería',unit:'m',cost:0};
if(!DATA.catalog.mineralwool) DATA.catalog.mineralwool={name:'Lana mineral',unit:'m²',coverage:1,cost:0};
if(!DATA.catalog.fibrocement) DATA.catalog.fibrocement={name:'Revestimiento fibrocemento',unit:'m²',coverage:1,cost:0};
if(!DATA.catalog.plywood) DATA.catalog.plywood={name:'Revestimiento terciado',unit:'m²',coverage:1,cost:0};

const INTERIOR_SYSTEMS={
  framing:{
    metalcon:{name:'Metalcon',desc:'Perfilería metálica galvanizada',icon:'fa-grip-lines-vertical'},
    wood:{name:'Madera',desc:'Estructura de madera para tabiquería',icon:'fa-tree'}
  },
  insulation:{
    glasswool:{name:'Fibra / lana de vidrio',desc:'Aislación térmica y acústica',icon:'fa-temperature-half'},
    eps:{name:'EPS',desc:'Poliestireno expandido',icon:'fa-snowflake'},
    mineralwool:{name:'Lana mineral',desc:'Precio a definir en Maestro A.P.U.',icon:'fa-shield-halved'}
  },
  lining:{
    gypsum:{name:'Volcanita / yeso-cartón',desc:'Terminación lisa para interiores secos',icon:'fa-layer-group'},
    fibrocement:{name:'Fibrocemento',desc:'Revestimiento resistente para zonas exigentes',icon:'fa-border-all'},
    plywood:{name:'Terciado',desc:'Revestimiento de madera',icon:'fa-tree'},
    osb:{name:'OSB',desc:'Terminación resistente y práctica',icon:'fa-table-cells-large'},
    pvc:{name:'PVC lavable',desc:'Para baños y zonas húmedas',icon:'fa-droplet'}
  }
};

const INTERIOR_FACE_LABELS={A:'Cara A',B:'Cara B',C:'Cara C',D:'Cara D',E:'Cielo',F:'Piso'};
const INTERIOR_FACE_COLORS={A:'#f59e0b',B:'#38bdf8',C:'#22c55e',D:'#a78bfa',E:'#f43f5e',F:'#14b8a6'};
const INTERIOR_LAYER_FACES=['A','B','C','D','E'];

function faceMapFromLegacy(legacy,includeFloor=false){
  const map={};
  INTERIOR_LAYER_FACES.forEach(face=>map[face]=legacy?.[face]!==false);
  if(includeFloor) map.F=legacy?.F!==false;
  return map;
}

function ensureInteriorSystem(){
  const preset=DATA.finishes[state.finish]||DATA.finishes.standard;
  if(!state.interiorSystem) state.interiorSystem={};
  const s=state.interiorSystem;
  const legacy=s.faces&&typeof s.faces==='object'?s.faces:null;

  if(!INTERIOR_SYSTEMS.framing[s.framing]) s.framing='metalcon';
  if(!INTERIOR_SYSTEMS.insulation[s.insulation]) s.insulation=preset.insulation;
  if(!INTERIOR_SYSTEMS.lining[s.lining]) s.lining=preset.lining;
  if(!s.framingFaces||typeof s.framingFaces!=='object') s.framingFaces=faceMapFromLegacy(legacy,false);
  if(!s.insulationFaces||typeof s.insulationFaces!=='object') s.insulationFaces=faceMapFromLegacy(legacy,false);
  if(!s.liningFaces||typeof s.liningFaces!=='object') s.liningFaces=faceMapFromLegacy(legacy,true);

  INTERIOR_LAYER_FACES.forEach(face=>{
    if(typeof s.framingFaces[face]!=='boolean') s.framingFaces[face]=true;
    if(typeof s.insulationFaces[face]!=='boolean') s.insulationFaces[face]=true;
    if(typeof s.liningFaces[face]!=='boolean') s.liningFaces[face]=true;
  });
  if(typeof s.liningFaces.F!=='boolean') s.liningFaces.F=true;
  if(typeof s.partitions!=='boolean') s.partitions=true;

  // Compatibilidad con capas anteriores que leen state.interiorSystem.faces.
  s.faces=s.liningFaces;
  s.ceiling=s.liningFaces.E;
  return s;
}

function syncInteriorPreset(finishKey){
  const preset=DATA.finishes[finishKey];
  if(!preset) return;
  const s=ensureInteriorSystem();
  s.lining=preset.lining;
  s.insulation=preset.insulation;
}

function selectedInteriorFaces(layer='lining'){
  const s=ensureInteriorSystem();
  const map=layer==='framing'?s.framingFaces:layer==='insulation'?s.insulationFaces:s.liningFaces;
  return Object.keys(map).filter(face=>map[face]);
}

function selectInteriorFraming(key){
  if(!INTERIOR_SYSTEMS.framing[key]) return;
  pushHistory(); ensureInteriorSystem(); state.interiorSystem.framing=key; renderAll();
  toast(`Tabiquería: ${INTERIOR_SYSTEMS.framing[key].name}`);
}
function selectInteriorLining(key){
  if(!INTERIOR_SYSTEMS.lining[key]) return;
  pushHistory(); ensureInteriorSystem(); state.interiorSystem.lining=key; renderAll();
  toast(`Revestimiento interior: ${INTERIOR_SYSTEMS.lining[key].name}`);
}
function selectInteriorInsulation(key){
  if(!INTERIOR_SYSTEMS.insulation[key]) return;
  pushHistory(); ensureInteriorSystem(); state.interiorSystem.insulation=key; renderAll();
  toast(`Aislación: ${INTERIOR_SYSTEMS.insulation[key].name}`);
}

function toggleInteriorLayerFace(layer,face){
  if(!INTERIOR_LAYER_FACES.includes(face)) return;
  const s=ensureInteriorSystem();
  const map=layer==='framing'?s.framingFaces:layer==='insulation'?s.insulationFaces:layer==='lining'?s.liningFaces:null;
  if(!map) return;
  pushHistory(); map[face]=!map[face]; s.faces=s.liningFaces; s.ceiling=s.liningFaces.E; renderAll();
}
function setInteriorLayerFaces(layer,value){
  const s=ensureInteriorSystem();
  const map=layer==='framing'?s.framingFaces:layer==='insulation'?s.insulationFaces:layer==='lining'?s.liningFaces:null;
  if(!map) return;
  pushHistory(); INTERIOR_LAYER_FACES.forEach(face=>map[face]=Boolean(value)); s.faces=s.liningFaces; s.ceiling=s.liningFaces.E; renderAll();
}

// Compatibilidad: el antiguo selector por cara activa/desactiva las tres capas juntas.
function toggleInteriorFace(face){
  if(!INTERIOR_LAYER_FACES.includes(face)) return;
  const s=ensureInteriorSystem(),next=!(s.framingFaces[face]||s.insulationFaces[face]||s.liningFaces[face]);
  pushHistory();
  s.framingFaces[face]=next; s.insulationFaces[face]=next; s.liningFaces[face]=next;
  s.faces=s.liningFaces; s.ceiling=s.liningFaces.E; renderAll();
}
function toggleInteriorOption(key){
  const s=ensureInteriorSystem(); if(key!=='partitions') return;
  pushHistory(); s.partitions=!s.partitions; renderAll();
}

selectFinish=function(key){
  if(!DATA.finishes[key]) return;
  pushHistory(); state.finish=key; syncInteriorPreset(key); renderAll();
};
applySolution=function(key){
  const preset=DATA.solutions[key]; if(!preset) return;
  pushHistory(); state.solution=key; state.container=preset.container; state.counts={...preset.counts}; state.finish=preset.finish;
  syncInteriorPreset(preset.finish); renderAll();
};

function interiorSystemMaterial(){
  const key=ensureInteriorSystem().lining;
  if(key==='osb') return mat(0xb9824d,{roughness:.78,metalness:.01});
  if(key==='plywood') return mat(0xc99458,{roughness:.72,metalness:.01});
  if(key==='fibrocement') return mat(0xb6b9b7,{roughness:.82,metalness:.01});
  if(key==='pvc') return mat(0xf8fafc,{roughness:.24,metalness:.02});
  return mat(0xeeeae2,{roughness:.72,metalness:.01});
}

function addInteriorCladdingVisuals(){
  if(!containerGroup) return;
  const s=ensureInteriorSystem(),c=DATA.containers[state.container],L=c.length,W=c.width,H=c.height;
  const lining=interiorSystemMaterial(),g=new THREE.Group(); g.name='interior-cladding-system'; const th=.018;
  if(s.liningFaces.B) g.add(box(L-.30,H-.30,th,lining,0,H/2,-W/2+.082));
  if(s.liningFaces.A&&!state.cutaway) g.add(box(L-.30,H-.30,th,lining,0,H/2,W/2-.082));
  if(s.liningFaces.D) g.add(box(th,H-.30,W-.30,lining,-L/2+.095,H/2,0));
  if(s.liningFaces.C) g.add(box(th,H-.30,W-.30,lining,L/2-.095,H/2,0));
  if(s.liningFaces.E&&!state.cutaway) g.add(box(L-.30,th,W-.30,lining,0,H-.085,0));
  if(s.liningFaces.F) g.add(box(L-.30,th,W-.30,createFloorMaterial(),0,.095,0));
  containerGroup.add(g);
}

const createParametricPartitionBeforeInteriorSystem=createParametricPartition;
createParametricPartition=function(length,height,thickness=.075){
  const s=ensureInteriorSystem();
  if(s.partitions===false) return createParametricPartitionBeforeInteriorSystem(length,height,thickness);
  const g=new THREE.Group(),wall=interiorSystemMaterial();
  const trim=s.framing==='wood'?mat(0x9a6a3a,{roughness:.72,metalness:.01}):mat(0xcbd5e1,{roughness:.45,metalness:.18});
  g.add(box(thickness,height,length,wall,0,height/2,0));
  g.add(box(thickness+.015,.065,length,trim,0,.04,0));
  g.add(box(thickness+.015,.055,length,trim,0,height-.04,0));
  return g;
};

const rebuild3DBeforeInteriorSystem=rebuild3D;
rebuild3D=function(){rebuild3DBeforeInteriorSystem();addInteriorCladdingVisuals();};

function actualOpeningAreaForFaces(type,faces){
  let area=0;
  for(let i=0;i<(state.counts[type]||0);i++){
    let d=null,p=null; try{d=objectDimensions(type,i);}catch(e){} try{p=actualLayout(type,i);}catch(e){}
    const face=p?.face||(type==='window'?'B':'A'); if(!faces.includes(face)) continue;
    area+=(type==='window'?(d?.width||1.20)*(d?.height||1.05):(d?.width||.98)*(d?.height||2.08));
  }
  return area;
}
function actualPartitionMetrics(){
  let oneSideArea=0,totalLength=0;
  for(let i=0;i<(state.counts.partition||0);i++){
    let d=null; try{d=objectDimensions('partition',i);}catch(e){}
    const c=DATA.containers[state.container],length=d?.length||c.width,height=d?.height||c.height;
    totalLength+=length; oneSideArea+=length*height;
  }
  return {oneSideArea,totalLength};
}
function selectedWallArea(c,faces){
  let area=0; if(faces.includes('A')) area+=c.length*c.height; if(faces.includes('B')) area+=c.length*c.height;
  if(faces.includes('C')) area+=c.width*c.height; if(faces.includes('D')) area+=c.width*c.height; return area;
}
function selectedWallFrameLinearMeters(c,faces){
  let linear=0;
  if(faces.includes('A')) linear+=(Math.ceil(c.length/.60)+1)*c.height;
  if(faces.includes('B')) linear+=(Math.ceil(c.length/.60)+1)*c.height;
  if(faces.includes('C')) linear+=(Math.ceil(c.width/.60)+1)*c.height;
  if(faces.includes('D')) linear+=(Math.ceil(c.width/.60)+1)*c.height;
  if(faces.includes('E')) linear+=(Math.ceil(c.width/.60)+1)*c.length;
  return linear;
}
function selectedTrackLinearMeters(c,faces){
  let linear=0;
  if(faces.includes('A')) linear+=c.length*2; if(faces.includes('B')) linear+=c.length*2;
  if(faces.includes('C')) linear+=c.width*2; if(faces.includes('D')) linear+=c.width*2;
  if(faces.includes('E')) linear+=2*(c.length+c.width); return linear;
}
function qtyForArea(item,area,waste=1.10){
  if(!item||area<=0) return 0;
  const coverage=Math.max(.0001,Number(item.coverage)||1),raw=(area*waste)/coverage;
  return item.unit==='m²'?Math.ceil(raw*100)/100:Math.ceil(raw);
}

buildBOM=function(){
  const s=ensureInteriorSystem(),c=DATA.containers[state.container];
  const framingFaces=selectedInteriorFaces('framing'),insulationFaces=selectedInteriorFaces('insulation'),liningFaces=selectedInteriorFaces('lining');
  const framingWalls=framingFaces.filter(f=>['A','B','C','D'].includes(f));
  const insulationWalls=insulationFaces.filter(f=>['A','B','C','D'].includes(f));
  const liningWalls=liningFaces.filter(f=>['A','B','C','D'].includes(f));
  const lining=DATA.catalog[s.lining],insulation=DATA.catalog[s.insulation],flooring=DATA.catalog[DATA.finishes[state.finish].flooring];

  const liningWallNet=Math.max(0,selectedWallArea(c,liningWalls)-actualOpeningAreaForFaces('window',liningWalls)-actualOpeningAreaForFaces('door',liningWalls));
  const insulationWallNet=Math.max(0,selectedWallArea(c,insulationWalls)-actualOpeningAreaForFaces('window',insulationWalls)-actualOpeningAreaForFaces('door',insulationWalls));
  const partitions=actualPartitionMetrics();
  const liningArea=liningWallNet+(liningFaces.includes('E')?c.length*c.width:0)+(s.partitions?partitions.oneSideArea*2:0);
  const insulationArea=insulationWallNet+(insulationFaces.includes('E')?c.length*c.width:0)+(s.partitions?partitions.oneSideArea:0);
  const floorArea=s.liningFaces.F?c.length*c.width:0;

  const partitionStudLinear=(Math.ceil(partitions.totalLength/.60)+(state.counts.partition||0))*c.height;
  const partitionTrackLinear=partitions.totalLength*2;
  const studLinear=selectedWallFrameLinearMeters(c,framingFaces)+partitionStudLinear;
  const trackLinear=selectedTrackLinearMeters(c,framingFaces)+partitionTrackLinear;
  const liningQty=qtyForArea(lining,liningArea),insulationQty=qtyForArea(insulation,insulationArea),floorQty=qtyForArea(flooring,floorArea);
  const frameItems=[];
  let frameCountForScrews=0;
  if(s.framing==='wood'){
    const woodLinear=Math.ceil((studLinear+trackLinear)*100)/100; frameCountForScrews=Math.ceil(woodLinear/3);
    if(woodLinear>0) frameItems.push({key:'woodFrame',name:DATA.catalog.woodFrame.name,qty:woodLinear,unit:DATA.catalog.woodFrame.unit,unitCost:DATA.catalog.woodFrame.cost});
  }else{
    const studs=Math.ceil(studLinear/3),tracks=Math.ceil(trackLinear/3); frameCountForScrews=studs+tracks;
    if(studs>0) frameItems.push({key:'stud',name:DATA.catalog.stud.name,qty:studs,unit:DATA.catalog.stud.unit,unitCost:DATA.catalog.stud.cost});
    if(tracks>0) frameItems.push({key:'track',name:DATA.catalog.track.name,qty:tracks,unit:DATA.catalog.track.unit,unitCost:DATA.catalog.track.cost});
  }
  const screwBoxes=(liningQty+frameCountForScrews)>0?Math.max(1,Math.ceil((liningQty+frameCountForScrews)/20)):0;
  const exteriorArea=2*(c.length*c.height)+2*(c.width*c.height)+c.length*c.width;
  const paintQty=Math.max(1,Math.ceil((exteriorArea*2)/DATA.catalog.paint.coverage));

  const items=[
    {key:'structure',name:`Estructura contenedor ${c.short}`,qty:1,unit:'unidad',unitCost:c.baseCost},
    ...frameItems,
    {key:s.insulation,name:insulation.name,qty:insulationQty,unit:insulation.unit,unitCost:insulation.cost},
    {key:s.lining,name:lining.name,qty:liningQty,unit:lining.unit,unitCost:lining.cost},
    {key:DATA.finishes[state.finish].flooring,name:flooring.name,qty:floorQty,unit:flooring.unit,unitCost:flooring.cost},
    {key:'screws',name:DATA.catalog.screws.name,qty:screwBoxes,unit:DATA.catalog.screws.unit,unitCost:DATA.catalog.screws.cost},
    {key:'paint',name:DATA.catalog.paint.name,qty:paintQty,unit:DATA.catalog.paint.unit,unitCost:DATA.catalog.paint.cost}
  ].filter(item=>item.key==='structure'||item.qty>0);
  ['window','door','wc','sink','shower','ac','electrical'].forEach(key=>{
    const qty=state.counts[key]||0;if(qty>0){const item=DATA.catalog[key];items.push({key,name:item.name,qty,unit:item.unit,unitCost:item.cost});}
  });
  return items.map(item=>({...item,subtotal:item.qty*item.unitCost}));
};

function renderInteriorSystemUI(){
  ensureInteriorSystem();
  const finishList=document.getElementById('finish-list'); if(!finishList) return;
  let root=document.getElementById('interior-system-config');
  if(!root){root=document.createElement('div');root.id='interior-system-config';root.className='mt-4';finishList.insertAdjacentElement('afterend',root);}
  root.innerHTML='<div class="text-xs text-slate-500">Cargando configuración interior por capas…</div>';
}

const renderAllBeforeInteriorSystem=renderAll;
renderAll=function(){ensureInteriorSystem();renderAllBeforeInteriorSystem();renderInteriorSystemUI();};
function bootInteriorSystems(){ensureInteriorSystem();renderInteriorSystemUI();rebuild3D();}
if(document.readyState==='loading') window.addEventListener('DOMContentLoaded',()=>setTimeout(bootInteriorSystems,500));
else setTimeout(bootInteriorSystems,500);
