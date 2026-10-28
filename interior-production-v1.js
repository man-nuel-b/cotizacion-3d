// Integrated interior production rules for bat-kubiqueitor.
// Rotation-aware sanitary placement, partition/fixture collision, usability warnings,
// sanitary routing costs, and full local draft persistence.
(function(){
  if(window.BAT_KUBIQUEITOR_INTERIOR_PRODUCTION?.version>=1) return;

  const SANITARY=['wc','sink','shower'];
  const WINDOWS=['window','windowOpening','windowOpeningFrame'];
  const PHYSICAL_CLEARANCE=.04;
  const WALL_MARGIN=.06;
  const DRAFT_KEY='bat-kubiqueitor-interior-draft-v1';
  let installed=false;
  let draftReady=false;
  let draftTimer=null;

  const n=(value,fallback=0)=>{const parsed=Number(value);return Number.isFinite(parsed)?parsed:fallback;};
  const clampLocal=(value,min,max)=>Math.min(max,Math.max(min,value));
  const round2=value=>Math.round(n(value)*100)/100;
  const unique=items=>[...new Set(items.filter(Boolean))];

  function normalizeDeg(value){let d=Math.round(n(value))%360;if(d<0)d+=360;return d;}
  function fixtureRotation(type,index,override){
    if(Number.isFinite(Number(override))) return normalizeDeg(override);
    const stored=state?.layout?.[type]?.[index];
    return normalizeDeg(stored?.rotation||0);
  }
  function fixtureDims(type,index,overrideDims){
    let d={};try{d=objectDimensions(type,index)||{};}catch(e){}
    d={...d,...(overrideDims||{})};
    const width=Math.max(.10,n(d.width,.50)),depth=Math.max(.10,n(d.depth,.50)),height=Math.max(.10,n(d.height,.80));
    return {width,depth,height};
  }
  function fixtureWorldSize(type,index,rotation,overrideDims){
    const d=fixtureDims(type,index,overrideDims),deg=fixtureRotation(type,index,rotation),swap=deg%180===90;
    return {width:swap?d.depth:d.width,depth:swap?d.width:d.depth,height:d.height,rotation:deg};
  }
  function fixturePosition(type,index,override={}){
    let p={x:0,z:0};try{p=actualLayout(type,index)||p;}catch(e){}
    return {x:Number.isFinite(Number(override.x))?Number(override.x):n(p.x),z:Number.isFinite(Number(override.z))?Number(override.z):n(p.z)};
  }
  function fixtureVolume(type,index,override={}){
    const p=fixturePosition(type,index,override),s=fixtureWorldSize(type,index,override.rotation,override.dimensions);
    return {id:`fixture:${type}:${index}`,type,label:type==='wc'?'WC':type==='sink'?'Lavamanos':'Ducha',index,
      minX:p.x-s.width/2,maxX:p.x+s.width/2,minZ:p.z-s.depth/2,maxZ:p.z+s.depth/2,minY:.08,maxY:.08+s.height,
      x:p.x,z:p.z,width:s.width,depth:s.depth,height:s.height,rotation:s.rotation,blocking:true,source:'floor-fixtures'};
  }
  function overlap2D(a,b,clearance=0){
    const c=Math.max(0,n(clearance));
    return a.minX-c<b.maxX&&a.maxX+c>b.minX&&a.minZ-c<b.maxZ&&a.maxZ+c>b.minZ;
  }
  function overlap3D(a,b,clearance=0){
    return overlap2D(a,b,clearance)&&a.minY-clearance<b.maxY&&a.maxY+clearance>b.minY;
  }

  function partitionVolume(index){
    try{if(typeof window.partitionOccupiedVolume==='function') return window.partitionOccupiedVolume(index);}catch(e){}
    const c=DATA.containers[state.container],p=actualLayout('partition',index)||{},d=objectDimensions('partition',index)||{},stored=state.layout?.partition?.[index]||{};
    const orientation=p.orientation||'cross',length=Math.max(.20,n(d.length,n(d.width,c.width-.20))),height=Math.max(.20,n(d.height,c.height-.15)),thickness=Math.max(.03,n(d.thickness,.075)),elevation=Math.max(0,n(d.elevation));
    const axisCenter=n(stored.axisCenter,0);
    if(orientation==='long') return {id:`partition:${index}`,type:'partition',label:`Tabique ${index+1}`,index,minX:axisCenter-length/2,maxX:axisCenter+length/2,minZ:n(p.z)-thickness/2,maxZ:n(p.z)+thickness/2,minY:.08+elevation,maxY:.08+elevation+height};
    return {id:`partition:${index}`,type:'partition',label:`Tabique ${index+1}`,index,minX:n(p.x)-thickness/2,maxX:n(p.x)+thickness/2,minZ:axisCenter-length/2,maxZ:axisCenter+length/2,minY:.08+elevation,maxY:.08+elevation+height};
  }

  function externalOccupancies(){
    try{
      if(typeof window.getSpatialOccupancyVolumes!=='function') return [];
      return window.getSpatialOccupancyVolumes().filter(v=>v&&v.source!=='floor-fixtures'&&v.type!=='partition');
    }catch(e){return[];}
  }

  function fixtureIssue(type,index,override={}){
    const c=DATA.containers[state.container],candidate=fixtureVolume(type,index,override);
    if(candidate.minX<-c.length/2+WALL_MARGIN||candidate.maxX>c.length/2-WALL_MARGIN||candidate.minZ<-c.width/2+WALL_MARGIN||candidate.maxZ>c.width/2-WALL_MARGIN){
      return {kind:'wall',message:`${candidate.label} queda fuera del área interior útil`};
    }
    for(const otherType of SANITARY){
      for(let i=0;i<n(state.counts?.[otherType]);i++){
        if(otherType===type&&i===index) continue;
        const other=fixtureVolume(otherType,i);
        if(overlap2D(candidate,other,PHYSICAL_CLEARANCE)) return {kind:'fixture',message:`${candidate.label} chocaría con ${other.label} ${i+1}`};
      }
    }
    for(let i=0;i<n(state.counts?.partition);i++){
      const wall=partitionVolume(i);
      if(overlap3D(candidate,wall,.025)) return {kind:'partition',message:`${candidate.label} chocaría con Tabique ${i+1}`};
    }
    for(const volume of externalOccupancies()){
      if(volume?.blocking!==false&&overlap3D(candidate,volume,.025)) return {kind:'occupied',message:`${candidate.label} chocaría con ${volume.label||'otro elemento'}`};
    }
    return null;
  }

  function serviceVolume(type,index){
    const body=fixtureVolume(type,index),base=type==='sink'?180:0,deg=normalizeDeg(body.rotation+base);
    const front=type==='wc'?.55:type==='sink'?.45:.45,side=type==='wc'?.15:.10,back=.05;
    const zone={...body,minX:body.minX-side,maxX:body.maxX+side,minZ:body.minZ-side,maxZ:body.maxZ+side};
    if(deg===0){zone.minZ=body.minZ-back;zone.maxZ=body.maxZ+front;}
    else if(deg===180){zone.minZ=body.minZ-front;zone.maxZ=body.maxZ+back;}
    else if(deg===90){zone.minX=body.minX-back;zone.maxX=body.maxX+front;}
    else if(deg===270){zone.minX=body.minX-front;zone.maxX=body.maxX+back;}
    return zone;
  }

  function windowVolume(type,index){
    const c=DATA.containers[state.container],d=objectDimensions(type,index)||{},p=actualLayout(type,index)||{},face=p.face||MOUNTED_FACE_TYPES?.[type]?.defaultFace||'A';
    const width=Math.max(.20,n(d.width,1.20)),height=Math.max(.20,n(d.height,1.05)),half=height/2,centerY=clampLocal(c.height*.60,half+.15,c.height-half-.15),center=n(p.x),t=.14;
    if(face==='A') return {type,index,face,minX:center-width/2,maxX:center+width/2,minZ:c.width/2-t,maxZ:c.width/2+.02,minY:centerY-half,maxY:centerY+half};
    if(face==='B') return {type,index,face,minX:center-width/2,maxX:center+width/2,minZ:-c.width/2-.02,maxZ:-c.width/2+t,minY:centerY-half,maxY:centerY+half};
    if(face==='C') return {type,index,face,minX:c.length/2-t,maxX:c.length/2+.02,minZ:center-width/2,maxZ:center+width/2,minY:centerY-half,maxY:centerY+half};
    return {type,index,face,minX:-c.length/2-.02,maxX:-c.length/2+t,minZ:center-width/2,maxZ:center+width/2,minY:centerY-half,maxY:centerY+half};
  }

  function doorSwingWarnings(){
    const warnings=[];
    const doors=Array.isArray(state.interiorDoors)?state.interiorDoors:[],behaviors=Array.isArray(state.interiorDoorBehavior)?state.interiorDoorBehavior:[];
    doors.forEach((door,index)=>{
      if(!door||door.enabled===false) return;
      const behavior=behaviors[index]||{};
      if(behavior.kind==='sliding') return;
      let p,d;try{p=actualLayout('partition',index)||{};d=objectDimensions('partition',index)||{};}catch(e){return;}
      const stored=state.layout?.partition?.[index]||{},axisCenter=n(stored.axisCenter),width=Math.max(.60,n(door.width,.82)),offset=n(door.offset),orientation=p.orientation||'cross';
      const center=orientation==='long'?{x:axisCenter+offset,z:n(p.z)}:{x:n(p.x),z:axisCenter+offset};
      const swing={minX:center.x-width-.10,maxX:center.x+width+.10,minZ:center.z-width-.10,maxZ:center.z+width+.10,minY:0,maxY:Math.max(1.7,n(door.height,2.05))};
      SANITARY.forEach(type=>{for(let i=0;i<n(state.counts?.[type]);i++){const v=fixtureVolume(type,i);if(overlap2D(swing,v,.02)) warnings.push(`Puerta interior ${index+1}: el barrido puede interferir con ${v.label} ${i+1}. Considera invertir apertura o usar corredera.`);}});
    });
    return warnings;
  }

  function interiorReview(){
    const c=DATA.containers[state.container],errors=[],warnings=[];
    SANITARY.forEach(type=>{
      for(let i=0;i<n(state.counts?.[type]);i++){
        const issue=fixtureIssue(type,i);
        if(issue) errors.push(`${typeLabel(type)} ${i+1}: ${issue.message}.`);
        const body=fixtureVolume(type,i),zone=serviceVolume(type,i);
        if(zone.minX<-c.length/2+.03||zone.maxX>c.length/2-.03||zone.minZ<-c.width/2+.03||zone.maxZ>c.width/2-.03) warnings.push(`${body.label} ${i+1}: el espacio frontal de uso queda muy comprometido por un muro.`);
        for(let p=0;p<n(state.counts?.partition);p++){if(overlap3D(zone,partitionVolume(p),.01)) warnings.push(`${body.label} ${i+1}: su zona de uso invade el Tabique ${p+1}.`);}
        for(const otherType of SANITARY){for(let j=0;j<n(state.counts?.[otherType]);j++){if(otherType===type&&j===i)continue;const other=fixtureVolume(otherType,j);if(overlap2D(zone,other,.01)) warnings.push(`${body.label} ${i+1}: su espacio de uso queda ocupado por ${other.label} ${j+1}.`);}}
      }
    });

    WINDOWS.forEach(type=>{for(let i=0;i<n(state.counts?.[type]);i++){const w=windowVolume(type,i);for(let p=0;p<n(state.counts?.partition);p++){if(overlap3D(w,partitionVolume(p),.005)) warnings.push(`${typeLabel(type)} ${i+1}: un tabique llega a su área de apertura en la cara ${w.face}.`);}}});
    warnings.push(...doorSwingWarnings());

    const plumbing=sanitaryRoutingMetrics();
    return {errors:unique(errors),warnings:unique(warnings),plumbing};
  }

  function sanitaryRoutingMetrics(){
    const c=DATA.containers[state.container],mainZ=-c.width/2+.20;
    let wet=0,hot=0,wcCount=0,gray=0,coldBranches=0,hotBranches=0,wcBranches=0,grayBranches=0;
    SANITARY.forEach(type=>{
      for(let i=0;i<n(state.counts?.[type]);i++){
        const p=fixturePosition(type,i),branch=Math.abs(p.z-mainZ)+.35;
        wet++;coldBranches+=branch;
        if(type!=='wc'){hot++;hotBranches+=branch;gray++;grayBranches+=branch;}else{wcCount++;wcBranches+=branch;}
      }
    });
    const coldMeters=wet?c.length+coldBranches:0;
    const hotMeters=hot?Math.min(c.length,Math.max(1,c.length*.65))+hotBranches:0;
    const drain110Meters=wcCount?c.length+wcBranches:0;
    const drain50Meters=gray?c.length+grayBranches:0;
    return {wetPoints:wet,hotPoints:hot,wcPoints:wcCount,grayPoints:gray,coldMeters:round2(coldMeters),hotMeters:round2(hotMeters),drain110Meters:round2(drain110Meters),drain50Meters:round2(drain50Meters)};
  }

  function apuResource(code,fallback){
    const row=(window.BAT_EXCEL_APU_R||[]).find(item=>item?.[0]===code);
    return {code,name:row?.[2]||fallback.name,unit:row?.[3]||fallback.unit,cost:Math.max(0,n(row?.[4],fallback.cost))};
  }
  function halfMeterWaste(value){return Math.ceil(Math.max(0,n(value))*1.10*2)/2;}
  function sanitaryCostAdditions(){
    const m=sanitaryRoutingMetrics(),lines=[];
    const add=(key,resource,qty,category='Instalación sanitaria')=>{qty=Math.max(0,n(qty));if(qty<=0)return;lines.push({key,name:resource.name,qty:round2(qty),unit:resource.unit,unitCost:resource.cost,subtotal:qty*resource.cost,category,sourceCode:resource.code,parametricRouting:true});};
    const ppr=apuResource('M128',{name:'Tubería PPR 20 mm PN20',unit:'ml',cost:1596.638655});
    const hyd=apuResource('M129',{name:'Kit accesorios hidráulicos por punto',unit:'un',cost:3781.512605});
    const pvc110=apuResource('M132',{name:'Tubo PVC sanitario 110 mm',unit:'ml',cost:2521.008403});
    const pvc50=apuResource('M133',{name:'Tubo PVC sanitario 50 mm',unit:'ml',cost:1344.537815});
    const kit50=apuResource('M134',{name:'Kit accesorios PVC 50 mm por punto',unit:'un',cost:6302.521008});
    const kit110=apuResource('M147',{name:'Kit accesorios PVC 110 mm',unit:'un',cost:13865.546218});
    add('routing-cold-ppr',ppr,halfMeterWaste(m.coldMeters));
    add('routing-hot-ppr',ppr,halfMeterWaste(m.hotMeters));
    add('routing-hydraulic-fittings',hyd,m.wetPoints);
    add('routing-drain-110',pvc110,halfMeterWaste(m.drain110Meters));
    add('routing-drain-50',pvc50,halfMeterWaste(m.drain50Meters));
    add('routing-drain-kit-110',kit110,m.wcPoints);
    add('routing-drain-kit-50',kit50,m.grayPoints);

    const totalMeters=m.coldMeters+m.hotMeters+m.drain110Meters+m.drain50Meters;
    const baseline=m.wetPoints*2;
    const extraMeters=Math.max(0,totalMeters-baseline);
    const plumber=apuResource('MO04',{name:'Maestro gasfíter (instalaciones sanitarias)',unit:'jornada',cost:91000});
    const laborDays=extraMeters>0?Math.ceil((extraMeters/30)*4)/4:0;
    if(laborDays>0) lines.push({key:'routing-plumber-labor',name:'Tendido adicional de redes sanitarias',qty:laborDays,unit:'jornada',unitCost:plumber.cost,subtotal:laborDays*plumber.cost,category:'Mano de obra sanitaria',sourceCode:'MO04',laborOnly:true,parametricRouting:true});
    return {metrics:m,lines};
  }

  function installCostBridge(){
    if(typeof calculate!=='function'||calculate.__batInteriorProduction) return;
    const before=calculate;
    const wrapped=function(){
      const result=before.apply(this,arguments)||{};
      const addition=sanitaryCostAdditions(),bom=Array.isArray(result.bom)?result.bom.slice():[];
      const materialLines=addition.lines.filter(x=>!x.laborOnly),laborLines=addition.lines.filter(x=>x.laborOnly);
      bom.push(...addition.lines);
      const addedMaterials=materialLines.reduce((s,x)=>s+n(x.subtotal),0),addedLabor=laborLines.reduce((s,x)=>s+n(x.subtotal),0);
      const materials=n(result.materials)+addedMaterials,labor=n(result.labor)+addedLabor,direct=materials+labor+n(state.transport);
      const net=direct*(1+n(state.margin)/100),taxAmount=net*(n(state.tax)/100),total=net+taxAmount;
      return {...result,bom,materials,labor,direct,net,taxAmount,total,sanitaryRouting:addition.metrics,sanitaryRoutingMaterials:addedMaterials,sanitaryRoutingLabor:addedLabor};
    };
    wrapped.__batInteriorProduction=true;wrapped.__previous=before;calculate=wrapped;
  }

  function installPlacementRules(){
    if(typeof validCandidate==='function'&&!validCandidate.__batInteriorProduction){
      const before=validCandidate;
      const wrapped=function(type,index,candidate){
        if(!SANITARY.includes(type)) return before.apply(this,arguments);
        return !fixtureIssue(type,index,candidate||{});
      };
      wrapped.__batInteriorProduction=true;wrapped.__previous=before;validCandidate=wrapped;
    }
    if(typeof dimensionChangeAllowed==='function'&&!dimensionChangeAllowed.__batInteriorProduction){
      const before=dimensionChangeAllowed;
      const wrapped=function(type,index,next){
        if(!SANITARY.includes(type)) return before.apply(this,arguments);
        return !fixtureIssue(type,index,{dimensions:next});
      };
      wrapped.__batInteriorProduction=true;wrapped.__previous=before;dimensionChangeAllowed=wrapped;
    }
    if(typeof nudgeSelected==='function'&&!nudgeSelected.__batInteriorProduction){
      const before=nudgeSelected;
      const wrapped=function(dx=0,dz=0){
        if(!selectedEditable||!SANITARY.includes(selectedEditable.type)) return before.apply(this,arguments);
        const {type,index}=selectedEditable,p=fixturePosition(type,index),candidate={x:p.x+n(dx),z:p.z+n(dz)},issue=fixtureIssue(type,index,candidate);
        if(issue) return toast(issue.message);
        return before.apply(this,arguments);
      };
      wrapped.__batInteriorProduction=true;wrapped.__previous=before;nudgeSelected=wrapped;
    }
    if(typeof window.rotateSelectedSanitary==='function'&&!window.rotateSelectedSanitary.__batInteriorProduction){
      const before=window.rotateSelectedSanitary;
      const wrapped=function(delta){
        if(!selectedEditable||!SANITARY.includes(selectedEditable.type)) return before.apply(this,arguments);
        const {type,index}=selectedEditable,next=normalizeDeg(fixtureRotation(type,index)+n(delta)),issue=fixtureIssue(type,index,{rotation:next});
        if(issue) return toast(`${issue.message} · no se puede girar`);
        return before.apply(this,arguments);
      };
      wrapped.__batInteriorProduction=true;window.rotateSelectedSanitary=wrapped;
    }
    if(typeof window.setSelectedSanitaryRotation==='function'&&!window.setSelectedSanitaryRotation.__batInteriorProduction){
      const before=window.setSelectedSanitaryRotation;
      const wrapped=function(degrees){
        if(!selectedEditable||!SANITARY.includes(selectedEditable.type)) return before.apply(this,arguments);
        const {type,index}=selectedEditable,next=normalizeDeg(degrees),issue=fixtureIssue(type,index,{rotation:next});
        if(issue) return toast(`${issue.message} · no se puede girar`);
        return before.apply(this,arguments);
      };
      wrapped.__batInteriorProduction=true;window.setSelectedSanitaryRotation=wrapped;
    }
  }

  function removeInvalidDuplicatedPartition(previousSelection,oldCount){
    if(n(state.counts?.partition)<=oldCount) return;
    const index=n(state.counts.partition)-1,hit=typeof window.partitionObstacleCollision==='function'?window.partitionObstacleCollision(index):null;
    if(!hit) return;
    state.counts.partition=index;
    state.layout?.partition?.splice(index,1);state.dimensions?.partition?.splice(index,1);state.interiorDoors?.splice?.(index,1);state.interiorDoorBehavior?.splice?.(index,1);
    selectedEditable=previousSelection?{...previousSelection}:null;
    renderAll();toast(`No se pudo duplicar: el nuevo tabique chocaba con ${hit.label||'otro elemento'}`);
  }
  function installPartitionDuplicateGuard(){
    ['duplicateSelectedPartition','pasteCopiedPartition'].forEach(name=>{
      const fn=window[name];if(typeof fn!=='function'||fn.__batInteriorProduction)return;
      const wrapped=function(){const oldCount=n(state.counts?.partition),previous=selectedEditable?{...selectedEditable}:null,result=fn.apply(this,arguments);removeInvalidDuplicatedPartition(previous,oldCount);return result;};
      wrapped.__batInteriorProduction=true;window[name]=wrapped;
    });
  }

  function installRotatedOccupancyProvider(){
    if(typeof window.registerSpatialOccupancyProvider!=='function') return;
    window.registerSpatialOccupancyProvider('floor-fixtures',()=>{
      const result=[];SANITARY.forEach(type=>{for(let i=0;i<n(state.counts?.[type]);i++)result.push(fixtureVolume(type,i));});return result;
    });
  }

  function ensureReviewModal(){
    let modal=document.getElementById('interior-review-modal');if(modal)return modal;
    modal=document.createElement('div');modal.id='interior-review-modal';modal.className='fixed inset-0 z-[72] modal-backdrop hidden items-center justify-center p-4';
    modal.innerHTML='<div class="modal-panel bg-white w-full max-w-3xl rounded-2xl shadow-2xl flex flex-col"><div class="px-5 py-4 border-b flex justify-between"><div><h3 class="font-black text-lg">Asistente de distribución interior</h3><p class="text-xs text-slate-500">Colisiones, espacios de uso e instalaciones sanitarias.</p></div><button type="button" data-close class="w-9 h-9 rounded-full bg-slate-100"><i class="fa-solid fa-xmark"></i></button></div><div data-body class="modal-body p-5"></div></div>';
    modal.querySelector('[data-close]').addEventListener('click',()=>{modal.classList.add('hidden');modal.classList.remove('flex');});document.body.appendChild(modal);return modal;
  }
  function showInteriorReview(){
    const review=interiorReview(),modal=ensureReviewModal(),body=modal.querySelector('[data-body]'),m=review.plumbing,ok=!review.errors.length;
    const list=(items,kind)=>items.length?`<div class="rounded-xl border ${kind==='error'?'border-red-200 bg-red-50 text-red-800':'border-amber-200 bg-amber-50 text-amber-800'} p-4"><div class="text-xs font-black mb-2">${kind==='error'?'CORREGIR':'REVISAR'}</div>${items.map(x=>`<div class="text-xs mb-1">• ${x}</div>`).join('')}</div>`:'';
    body.innerHTML=`<div class="rounded-2xl border p-4 ${ok?'border-emerald-200 bg-emerald-50 text-emerald-800':'border-red-200 bg-red-50 text-red-800'}"><div class="font-black">${ok?'Distribución sin colisiones físicas':'Hay conflictos físicos en la distribución'}</div><div class="text-xs mt-1">${review.errors.length} error(es) · ${review.warnings.length} advertencia(s)</div></div><div class="grid gap-3 mt-3">${list(review.errors,'error')}${list(review.warnings,'warning')}<div class="rounded-xl border bg-slate-50 p-4"><div class="text-xs font-black text-slate-600">RECORRIDOS SANITARIOS</div><div class="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2 text-xs"><div>AF <b>${m.coldMeters.toFixed(2)} m</b></div><div>AC <b>${m.hotMeters.toFixed(2)} m</b></div><div>PVC 110 <b>${m.drain110Meters.toFixed(2)} m</b></div><div>PVC 50 <b>${m.drain50Meters.toFixed(2)} m</b></div></div></div></div>`;
    modal.classList.remove('hidden');modal.classList.add('flex');return review;
  }

  function renderInteriorPanel(){
    const anchor=document.getElementById('production-systems-config')||document.getElementById('extras-list');if(!anchor)return;
    let root=document.getElementById('interior-production-panel');if(!root){root=document.createElement('div');root.id='interior-production-panel';root.className='mt-3 rounded-2xl border border-slate-200 bg-white p-3';anchor.insertAdjacentElement('afterend',root);}
    const review=interiorReview(),m=review.plumbing,status=review.errors.length?'Requiere corrección':review.warnings.length?'Revisar distribución':'Distribución OK';
    root.innerHTML=`<div class="flex items-center justify-between gap-3"><div><div class="text-[10px] font-black uppercase tracking-widest text-amber-600">Asistente interior</div><div class="text-xs font-bold mt-1">${status}</div></div><div class="text-right text-[10px] text-slate-500">${review.errors.length} errores · ${review.warnings.length} avisos</div></div><div class="grid grid-cols-4 gap-1.5 mt-3 text-center"><div class="rounded-lg bg-slate-50 p-2"><div class="text-[9px] text-slate-400">AF</div><b class="text-[10px]">${m.coldMeters.toFixed(1)} m</b></div><div class="rounded-lg bg-slate-50 p-2"><div class="text-[9px] text-slate-400">AC</div><b class="text-[10px]">${m.hotMeters.toFixed(1)} m</b></div><div class="rounded-lg bg-slate-50 p-2"><div class="text-[9px] text-slate-400">PVC110</div><b class="text-[10px]">${m.drain110Meters.toFixed(1)} m</b></div><div class="rounded-lg bg-slate-50 p-2"><div class="text-[9px] text-slate-400">PVC50</div><b class="text-[10px]">${m.drain50Meters.toFixed(1)} m</b></div></div><button type="button" onclick="showInteriorReview()" class="mt-2 w-full rounded-xl bg-slate-950 text-white py-2 text-xs font-black"><i class="fa-solid fa-compass-drafting mr-1"></i> Revisar distribución</button>`;
  }

  function readDraft(){try{const raw=localStorage.getItem(DRAFT_KEY);return raw?JSON.parse(raw):null;}catch(e){return null;}}
  function saveDraft(){if(!draftReady)return;try{localStorage.setItem(DRAFT_KEY,JSON.stringify({savedAt:new Date().toISOString(),view:typeof currentView==='string'?currentView:'exterior',state:clone(state)}));updateDraftButton();}catch(e){}}
  function scheduleDraft(){if(!draftReady)return;clearTimeout(draftTimer);draftTimer=setTimeout(saveDraft,450);}
  function restoreDraft(){
    const snap=readDraft();if(!snap?.state)return toast('No hay un borrador recuperable');
    const saved=clone(snap.state);state={...clone(DEFAULT_STATE),...saved,counts:{...DEFAULT_STATE.counts,...(saved.counts||{})},customer:{...DEFAULT_STATE.customer,...(saved.customer||{})}};
    try{ensureLayoutState?.();ensureDimensionState?.();}catch(e){}
    renderAll();if(typeof setView==='function')setView(snap.view||'exterior');toast('Último borrador recuperado');
  }
  function updateDraftButton(){
    const btn=document.getElementById('interior-draft-btn');if(!btn)return;const snap=readDraft();btn.title=snap?.savedAt?`Borrador: ${new Date(snap.savedAt).toLocaleString('es-CL')}`:'Sin borrador guardado';
  }
  function installDraftButton(){
    const save=[...document.querySelectorAll('button')].find(b=>(b.textContent||'').trim().includes('Guardar'));if(!save||document.getElementById('interior-draft-btn'))return;
    const btn=document.createElement('button');btn.id='interior-draft-btn';btn.type='button';btn.className='hidden md:inline-flex px-3 py-2 rounded-lg bg-slate-900 text-xs font-semibold';btn.innerHTML='<i class="fa-solid fa-clock-rotate-left text-amber-400 mr-1"></i> Borrador';btn.addEventListener('click',restoreDraft);
    const projects=document.getElementById('project-library-btn');(projects||save).insertAdjacentElement('afterend',btn);updateDraftButton();
  }
  function installDraftPersistence(){
    installDraftButton();
    if(typeof renderAll==='function'&&!renderAll.__batInteriorDraft){const before=renderAll;const wrapped=function(){const result=before.apply(this,arguments);renderInteriorPanel();scheduleDraft();return result;};wrapped.__batInteriorDraft=true;renderAll=wrapped;}
    if(typeof saveProject==='function'&&!saveProject.__batInteriorDraft){const before=saveProject;const wrapped=function(){const result=before.apply(this,arguments);saveDraft();return result;};wrapped.__batInteriorDraft=true;saveProject=wrapped;}
    document.addEventListener('pointerup',scheduleDraft,{passive:true});document.addEventListener('change',scheduleDraft,true);
    draftReady=true;
  }

  function install(){
    if(installed)return true;
    const ready=typeof state!=='undefined'&&typeof DATA!=='undefined'&&typeof objectDimensions==='function'&&typeof actualLayout==='function'&&typeof renderAll==='function'&&typeof calculate==='function'&&window.BAT_KUBIQUEITOR_OBJECT_ORIENTATION&&window.BAT_KUBIQUEITOR_PARTITION_OBSTACLE_COLLISION;
    if(!ready)return false;
    installRotatedOccupancyProvider();installPlacementRules();installPartitionDuplicateGuard();installCostBridge();ensureReviewModal();renderInteriorPanel();installDraftPersistence();
    window.fixtureInteriorIssue=fixtureIssue;window.getInteriorProjectReview=interiorReview;window.getSanitaryRoutingMetrics=sanitaryRoutingMetrics;window.showInteriorReview=showInteriorReview;window.restoreInteriorDraft=restoreDraft;
    window.BAT_KUBIQUEITOR_INTERIOR_PRODUCTION={version:1,review:interiorReview,plumbing:sanitaryRoutingMetrics};installed=true;return true;
  }

  let tries=0;const timer=setInterval(()=>{tries++;if(install()){clearInterval(timer);return;}if(tries>=240){clearInterval(timer);console.error('bat-kubiqueitor: interior-production-v1 no pudo instalarse');}},100);
})();
