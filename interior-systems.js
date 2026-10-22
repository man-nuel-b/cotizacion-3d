// Configurable interior framing, insulation and cladding for bat-kubiqueitor.
// Faces: A/B/C/D = walls, E = ceiling, F = floor.
// Uses only prices already present in DATA.catalog.

const INTERIOR_SYSTEMS={
  lining:{
    gypsum:{name:'Yeso-cartón',desc:'Terminación lisa para oficinas y espacios secos',icon:'fa-layer-group'},
    osb:{name:'OSB',desc:'Terminación resistente y práctica',icon:'fa-border-all'},
    pvc:{name:'PVC lavable',desc:'Ideal para baños, camarines y zonas húmedas',icon:'fa-droplet'}
  },
  insulation:{
    glasswool:{name:'Lana de vidrio',desc:'Aislación térmica y acústica',icon:'fa-temperature-half'},
    eps:{name:'EPS',desc:'Aislación liviana y económica',icon:'fa-snowflake'}
  }
};

const INTERIOR_FACE_LABELS={A:'Pared A',B:'Pared B',C:'Pared C',D:'Pared D',E:'Techo',F:'Piso'};
const INTERIOR_FACE_COLORS={A:'#f59e0b',B:'#38bdf8',C:'#22c55e',D:'#a78bfa',E:'#f43f5e',F:'#14b8a6'};

function ensureInteriorSystem(){
  const preset=DATA.finishes[state.finish]||DATA.finishes.standard;
  if(!state.interiorSystem) state.interiorSystem={};
  if(!INTERIOR_SYSTEMS.lining[state.interiorSystem.lining]) state.interiorSystem.lining=preset.lining;
  if(!INTERIOR_SYSTEMS.insulation[state.interiorSystem.insulation]) state.interiorSystem.insulation=preset.insulation;
  if(typeof state.interiorSystem.partitions!=='boolean') state.interiorSystem.partitions=true;
  if(!state.interiorSystem.faces||typeof state.interiorSystem.faces!=='object'){
    state.interiorSystem.faces={A:true,B:true,C:true,D:true,E:true,F:true};
  }
  ['A','B','C','D','E','F'].forEach(face=>{
    if(typeof state.interiorSystem.faces[face]!=='boolean') state.interiorSystem.faces[face]=true;
  });
  state.interiorSystem.ceiling=state.interiorSystem.faces.E;
  return state.interiorSystem;
}

function syncInteriorPreset(finishKey){
  const preset=DATA.finishes[finishKey];
  if(!preset) return;
  ensureInteriorSystem();
  state.interiorSystem.lining=preset.lining;
  state.interiorSystem.insulation=preset.insulation;
}

function selectedInteriorFaces(){
  const s=ensureInteriorSystem();
  return ['A','B','C','D','E','F'].filter(face=>s.faces[face]);
}

function selectInteriorLining(key){
  if(!INTERIOR_SYSTEMS.lining[key]) return;
  pushHistory();
  ensureInteriorSystem();
  state.interiorSystem.lining=key;
  renderAll();
  toast(`Revestimiento interior: ${INTERIOR_SYSTEMS.lining[key].name}`);
}

function selectInteriorInsulation(key){
  if(!INTERIOR_SYSTEMS.insulation[key]) return;
  pushHistory();
  ensureInteriorSystem();
  state.interiorSystem.insulation=key;
  renderAll();
  toast(`Aislación interior: ${INTERIOR_SYSTEMS.insulation[key].name}`);
}

function toggleInteriorFace(face){
  if(!['A','B','C','D','E','F'].includes(face)) return;
  pushHistory();
  ensureInteriorSystem();
  state.interiorSystem.faces[face]=!state.interiorSystem.faces[face];
  state.interiorSystem.ceiling=state.interiorSystem.faces.E;
  renderAll();
  toast(`${INTERIOR_FACE_LABELS[face]}: ${state.interiorSystem.faces[face]?'con sistema interior':'sin sistema interior'}`);
}

function toggleInteriorOption(key){
  ensureInteriorSystem();
  if(key==='ceiling') return toggleInteriorFace('E');
  if(key!=='partitions') return;
  pushHistory();
  state.interiorSystem.partitions=!state.interiorSystem.partitions;
  renderAll();
}

// Keep finish preset and the detailed interior system synchronized in one render.
selectFinish=function(key){
  if(!DATA.finishes[key]) return;
  pushHistory();
  state.finish=key;
  syncInteriorPreset(key);
  renderAll();
};

// Applying a solution used to change state.finish without updating a previously
// initialized interiorSystem. Rebuild both states together to avoid stale 3D/BOM.
applySolution=function(key){
  const preset=DATA.solutions[key];
  if(!preset) return;
  pushHistory();
  state.solution=key;
  state.container=preset.container;
  state.counts={...preset.counts};
  state.finish=preset.finish;
  syncInteriorPreset(preset.finish);
  renderAll();
};

function interiorSystemMaterial(){
  ensureInteriorSystem();
  if(state.interiorSystem.lining==='osb') return mat(0xb9824d,{roughness:.78,metalness:.01});
  if(state.interiorSystem.lining==='pvc') return mat(0xf8fafc,{roughness:.24,metalness:.02});
  return mat(0xeeeae2,{roughness:.72,metalness:.01});
}

function addInteriorCladdingVisuals(){
  if(!containerGroup) return;
  const s=ensureInteriorSystem();
  const c=DATA.containers[state.container],L=c.length,W=c.width,H=c.height;
  const lining=interiorSystemMaterial();
  const g=new THREE.Group();
  g.name='interior-cladding-system';
  const inset=.082,th=.018;

  if(s.faces.B) g.add(box(L-.30,H-.30,th,lining,0,H/2,-W/2+inset));
  if(s.faces.A&&!state.cutaway) g.add(box(L-.30,H-.30,th,lining,0,H/2,W/2-inset));
  if(s.faces.D) g.add(box(th,H-.30,W-.30,lining,-L/2+.095,H/2,0));
  if(s.faces.C) g.add(box(th,H-.30,W-.30,lining,L/2-.095,H/2,0));
  if(s.faces.E&&!state.cutaway) g.add(box(L-.30,th,W-.30,lining,0,H-.085,0));

  if(s.faces.F){
    const floorFinish=createFloorMaterial();
    g.add(box(L-.30,th,W-.30,floorFinish,0,.095,0));
  }
  containerGroup.add(g);
}

const createParametricPartitionBeforeInteriorSystem=createParametricPartition;
createParametricPartition=function(length,height,thickness=.075){
  ensureInteriorSystem();
  if(state.interiorSystem.partitions===false) return createParametricPartitionBeforeInteriorSystem(length,height,thickness);
  const g=new THREE.Group();
  const wall=interiorSystemMaterial();
  const trim=mat(0xcbd5e1,{roughness:.45,metalness:.18});
  g.add(box(thickness,height,length,wall,0,height/2,0));
  g.add(box(thickness+.015,.065,length,trim,0,.04,0));
  g.add(box(thickness+.015,.055,length,trim,0,height-.04,0));
  return g;
};

const rebuild3DBeforeInteriorSystem=rebuild3D;
rebuild3D=function(){
  rebuild3DBeforeInteriorSystem();
  addInteriorCladdingVisuals();
};

function actualOpeningAreaForFaces(type,faces){
  let area=0;
  const count=state.counts[type]||0;
  for(let i=0;i<count;i++){
    let d=null,p=null;
    try{ d=typeof objectDimensions==='function'?objectDimensions(type,i):null; }catch(e){}
    try{ p=typeof actualLayout==='function'?actualLayout(type,i):null; }catch(e){}
    const face=p?.face||(type==='window'?'B':'A');
    if(!faces.includes(face)) continue;
    if(type==='window') area+=(d?.width||1.20)*(d?.height||1.05);
    else area+=(d?.width||.98)*(d?.height||2.08);
  }
  return area;
}

function actualPartitionMetrics(){
  let oneSideArea=0,totalLength=0;
  for(let i=0;i<(state.counts.partition||0);i++){
    let d=null;
    try{ d=typeof objectDimensions==='function'?objectDimensions('partition',i):null; }catch(e){}
    const c=DATA.containers[state.container];
    const length=d?.length||c.width;
    const height=d?.height||c.height;
    totalLength+=length;
    oneSideArea+=length*height;
  }
  return {oneSideArea,totalLength};
}

function selectedWallArea(c,faces){
  let area=0;
  if(faces.includes('A')) area+=c.length*c.height;
  if(faces.includes('B')) area+=c.length*c.height;
  if(faces.includes('C')) area+=c.width*c.height;
  if(faces.includes('D')) area+=c.width*c.height;
  return area;
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
  if(faces.includes('A')) linear+=c.length*2;
  if(faces.includes('B')) linear+=c.length*2;
  if(faces.includes('C')) linear+=c.width*2;
  if(faces.includes('D')) linear+=c.width*2;
  if(faces.includes('E')) linear+=2*(c.length+c.width);
  return linear;
}

buildBOM=function(){
  const s=ensureInteriorSystem();
  const c=DATA.containers[state.container];
  const faces=selectedInteriorFaces();
  const wallFaces=faces.filter(face=>['A','B','C','D'].includes(face));
  const liningKey=s.lining;
  const insulationKey=s.insulation;
  const flooringKey=DATA.finishes[state.finish].flooring;
  const lining=DATA.catalog[liningKey];
  const insulation=DATA.catalog[insulationKey];
  const flooring=DATA.catalog[flooringKey];

  const wallGross=selectedWallArea(c,wallFaces);
  const openings=actualOpeningAreaForFaces('window',wallFaces)+actualOpeningAreaForFaces('door',wallFaces);
  const wallNet=Math.max(0,wallGross-openings);
  const partitions=actualPartitionMetrics();
  const ceilingArea=faces.includes('E')?c.length*c.width:0;
  const floorArea=faces.includes('F')?c.length*c.width:0;
  const partitionLiningArea=s.partitions?partitions.oneSideArea*2:0;
  const partitionInsulationArea=s.partitions?partitions.oneSideArea:0;
  const liningArea=wallNet+ceilingArea+partitionLiningArea;
  const insulationArea=wallNet+ceilingArea+floorArea+partitionInsulationArea;
  const fullWallGross=2*(c.length*c.height)+2*(c.width*c.height);
  const exteriorArea=fullWallGross+c.length*c.width;
  const waste=1.10;

  const partitionStudLinear=(Math.ceil(partitions.totalLength/.60)+(state.counts.partition||0))*c.height;
  const studLinear=selectedWallFrameLinearMeters(c,faces)+partitionStudLinear;
  const trackLinear=selectedTrackLinearMeters(c,faces)+partitions.totalLength*2;
  const studs=Math.ceil(studLinear/3);
  const tracks=Math.ceil(trackLinear/3);
  const liningQty=liningArea>0?Math.ceil((liningArea*waste)/lining.coverage):0;
  const insulationQty=insulationArea>0?Math.ceil((insulationArea*waste)/insulation.coverage):0;
  const floorQty=floorArea>0?Math.ceil((floorArea*waste)/flooring.coverage):0;
  const screwBoxes=(liningQty+studs+tracks)>0?Math.max(1,Math.ceil((liningQty+studs+tracks)/20)):0;
  const paintQty=Math.max(1,Math.ceil((exteriorArea*2)/DATA.catalog.paint.coverage));

  const items=[
    {key:'structure',name:`Estructura contenedor ${c.short}`,qty:1,unit:'unidad',unitCost:c.baseCost},
    {key:liningKey,name:lining.name,qty:liningQty,unit:lining.unit,unitCost:lining.cost},
    {key:insulationKey,name:insulation.name,qty:insulationQty,unit:insulation.unit,unitCost:insulation.cost},
    {key:flooringKey,name:flooring.name,qty:floorQty,unit:flooring.unit,unitCost:flooring.cost},
    {key:'stud',name:DATA.catalog.stud.name,qty:studs,unit:DATA.catalog.stud.unit,unitCost:DATA.catalog.stud.cost},
    {key:'track',name:DATA.catalog.track.name,qty:tracks,unit:DATA.catalog.track.unit,unitCost:DATA.catalog.track.cost},
    {key:'screws',name:DATA.catalog.screws.name,qty:screwBoxes,unit:DATA.catalog.screws.unit,unitCost:DATA.catalog.screws.cost},
    {key:'paint',name:DATA.catalog.paint.name,qty:paintQty,unit:DATA.catalog.paint.unit,unitCost:DATA.catalog.paint.cost}
  ].filter(item=>item.key==='structure'||item.qty>0);

  ['window','door','wc','sink','shower','ac','electrical'].forEach(key=>{
    const qty=state.counts[key]||0;
    if(qty>0){
      const item=DATA.catalog[key];
      items.push({key,name:item.name,qty,unit:item.unit,unitCost:item.cost});
    }
  });
  return items.map(item=>({...item,subtotal:item.qty*item.unitCost}));
};

function renderInteriorSystemUI(){
  const s=ensureInteriorSystem();
  const finishList=document.getElementById('finish-list');
  if(!finishList) return;
  let root=document.getElementById('interior-system-config');
  if(!root){
    root=document.createElement('div');
    root.id='interior-system-config';
    root.className='mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3';
    finishList.insertAdjacentElement('afterend',root);
  }
  root.innerHTML=`
    <div class="flex items-start justify-between gap-2 mb-3">
      <div><div class="text-[10px] uppercase tracking-widest text-amber-600 font-black">Sistema interior</div><div class="text-xs font-black text-slate-800 mt-0.5">Tabiquería + revestimiento</div></div>
      <span class="text-[9px] font-black rounded-full bg-slate-900 text-white px-2 py-1">METALCON</span>
    </div>

    <div class="text-[10px] font-bold text-slate-500 mb-1.5">Caras con tabiquería / revestimiento</div>
    <div class="interior-face-grid">
      ${['A','B','C','D','E','F'].map(face=>`<button type="button" onclick="toggleInteriorFace('${face}')" class="interior-face-choice ${s.faces[face]?'active':''}" style="--face-color:${INTERIOR_FACE_COLORS[face]}"><strong>${face}</strong><span>${INTERIOR_FACE_LABELS[face]}</span></button>`).join('')}
    </div>

    <div class="text-[10px] font-bold text-slate-500 mt-3 mb-1.5">Revestimiento interior</div>
    <div class="grid gap-1.5">
      ${Object.entries(INTERIOR_SYSTEMS.lining).map(([key,item])=>`<button type="button" onclick="selectInteriorLining('${key}')" class="interior-choice ${s.lining===key?'active':''}"><span><i class="fa-solid ${item.icon} mr-2"></i><strong>${item.name}</strong></span><small>${item.desc}</small></button>`).join('')}
    </div>

    <div class="text-[10px] font-bold text-slate-500 mt-3 mb-1.5">Aislación interior</div>
    <div class="grid grid-cols-2 gap-1.5">
      ${Object.entries(INTERIOR_SYSTEMS.insulation).map(([key,item])=>`<button type="button" onclick="selectInteriorInsulation('${key}')" class="interior-mini-choice ${s.insulation===key?'active':''}"><i class="fa-solid ${item.icon}"></i><span>${item.name}</span></button>`).join('')}
    </div>

    <button type="button" onclick="toggleInteriorOption('partitions')" class="interior-toggle w-full mt-3 ${s.partitions?'active':''}"><i class="fa-solid fa-grip-lines-vertical mr-1"></i> Revestir divisiones interiores</button>
    <div class="text-[9px] text-slate-500 mt-2 leading-relaxed">A–D corresponden a paredes · E al techo · F al piso. La cubicación usa solo las caras activas.</div>`;

  if(!document.getElementById('interior-system-style')){
    const style=document.createElement('style');
    style.id='interior-system-style';
    style.textContent=`
      .interior-face-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
      .interior-face-choice{display:flex;align-items:center;gap:7px;padding:7px;border:1px solid #e2e8f0;background:#fff;border-radius:10px;color:#475569;text-align:left;transition:.15s ease}
      .interior-face-choice strong{display:grid;place-items:center;width:24px;height:24px;flex:0 0 24px;border-radius:7px;border:1px solid var(--face-color);color:var(--face-color);font-size:11px}
      .interior-face-choice span{font-size:9px;font-weight:850;line-height:1.1}
      .interior-face-choice.active{border-color:var(--face-color);box-shadow:0 0 0 1px var(--face-color);color:#0f172a;background:#fff}
      .interior-choice,.interior-mini-choice,.interior-toggle{border:1px solid #e2e8f0;background:#fff;border-radius:10px;color:#475569;transition:.15s ease}
      .interior-choice{display:flex;flex-direction:column;align-items:flex-start;padding:9px 10px;text-align:left;font-size:11px}.interior-choice small{font-size:9px;color:#94a3b8;margin-top:2px}
      .interior-mini-choice,.interior-toggle{padding:9px 7px;font-size:10px;font-weight:800}.interior-mini-choice{display:flex;align-items:center;justify-content:center;gap:6px}
      .interior-choice.active,.interior-mini-choice.active,.interior-toggle.active{border-color:#f59e0b;background:#fffbeb;color:#92400e;box-shadow:0 0 0 1px rgba(245,158,11,.08)}
    `;
    document.head.appendChild(style);
  }
}

const renderAllBeforeInteriorSystem=renderAll;
renderAll=function(){
  ensureInteriorSystem();
  renderAllBeforeInteriorSystem();
  renderInteriorSystemUI();
};

function bootInteriorSystems(){
  ensureInteriorSystem();
  renderInteriorSystemUI();
  rebuild3D();
}

if(document.readyState==='loading') window.addEventListener('DOMContentLoaded',()=>setTimeout(bootInteriorSystems,500));
else setTimeout(bootInteriorSystems,500);