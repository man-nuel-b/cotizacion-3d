/* BAT-Kubiqueitor · Reglas constructivas APU, modo opt-in por proyecto.
 * Nunca agrega partidas opcionales sin decisión explícita.
 * Precios y rendimientos proceden exclusivamente del maestro Excel actual.
 */
(function(root){
  'use strict';
  const num=(value,fallback=0)=>{const x=Number(value);return Number.isFinite(x)?x:fallback;};
  const qty=value=>Math.max(0,num(value));
  const integer=value=>Math.max(0,Math.floor(qty(value)));
  const round2=value=>Math.round(qty(value)*100)/100;
  const TYPES=['wc','sink','shower'];
  const OPTIONAL=['P13','P36','P37','P63','P64','P65','P66','P67','P68','P69','P73','P74','P76'];
  const MODULES={
    half:{wc:1,sink:1,shower:0},
    full:{wc:1,sink:1,shower:1}
  };

  function countsFor(state){
    const counts={...state?.counts},modules={wc:0,sink:0,shower:0};
    for(const m of (Array.isArray(state?.bathroomModules)?state.bathroomModules:[])){
      const preset=MODULES[m?.kind];
      if(!preset)continue;
      for(const k of TYPES)modules[k]+=preset[k];
    }
    return {wc:integer(counts.wc)+modules.wc,sink:integer(counts.sink)+modules.sink,
      shower:integer(counts.shower)+modules.shower,partitions:integer(counts.partition),
      electrical:integer(counts.electrical),modules};
  }
  function optionsFor(state){
    const o=state?.constructionRules||{};
    return {enabled:o.enabled===true,contingencyPct:round2(o.contingencyPct),wetPartitions:integer(o.wetPartitions),waterproofM2:round2(o.waterproofM2),
      ceramicM2:round2(o.ceramicM2),waterHeaterCount:integer(o.waterHeaterCount),
      extractorCount:integer(o.extractorCount),bathroomKitCount:integer(o.bathroomKitCount),
      kitchenetteCount:integer(o.kitchenetteCount),board:o.board===true,ground:o.ground===true,
      declaration:o.declaration===true,pointOverride:o.pointOverride===''||o.pointOverride==null?null:integer(o.pointOverride)};
  }
  function derive(state){
    const o=optionsFor(state),c=countsFor(state),warnings=[],items=[];
    if(!o.enabled)return {enabled:false,items,warnings,counts:c,options:o,routingMode:'parametric'};
    const add=(code,quantity,reason)=>{if(qty(quantity)>0)items.push({code,qty:round2(quantity),reason});};
    const bathrooms=c.wc+c.sink+c.shower>0;
    if(o.wetPartitions>c.partitions)warnings.push('Tabiques húmedos mayores que tabiques del modelo: revisar P13.');
    add('P36',o.ceramicM2,'Revestimiento cerámico en muro, superficie aprobada');
    add('P37',o.waterproofM2,'Impermeabilización, superficie aprobada');
    add('P63',o.waterHeaterCount,'Termo eléctrico solicitado');
    const cold=c.wc+c.sink+c.shower+o.kitchenetteCount;
    const hot=o.waterHeaterCount>0?c.sink+c.shower+o.kitchenetteCount:0;
    const water=o.pointOverride===null?cold+hot:o.pointOverride;
    add('P64',water,'Puntos de alimentación PPR, hasta 3 m por punto');
    add('P65',c.sink+c.shower+o.kitchenetteCount,'Desagües PVC 50 mm, hasta 2 m por punto');
    add('P66',c.wc,'Desagües WC PVC 110 mm, hasta 3 m por punto');
    add('P67',o.extractorCount,'Extractor de aire confirmado');
    add('P68',o.bathroomKitCount,'Accesorios de baño confirmados');
    add('P69',o.kitchenetteCount,'Kitchenette instalada');
    add('P73',o.board?1:0,'Tablero general propio');
    add('P74',o.ground?1:0,'Puesta a tierra del tablero');
    add('P76',o.declaration?1:0,'Declaración TE-1, según alcance eléctrico');
    if(bathrooms&&o.waterproofM2===0)warnings.push('Zona húmeda: falta definir área real de impermeabilización P37.');
    if(bathrooms&&c.partitions>0&&o.wetPartitions===0)warnings.push('Verificar si algún tabique requiere solución húmeda P13.');
    if(bathrooms&&o.extractorCount===0)warnings.push('Verificar ventilación del baño (P67) con el proyecto técnico.');
    if(c.electrical>0&&!o.board)warnings.push('Comprobar si existe tablero compartido; P73 no está presupuestado.');
    if(c.electrical>0&&!o.ground)warnings.push('Comprobar puesta a tierra P74 del módulo.');
    if(o.waterHeaterCount>0)warnings.push('Verificar punto de fuerza P72, temperatura y recorrido hidráulico del termo.');
    if((c.wc||c.sink||c.shower)&&o.kitchenetteCount<0)warnings.push('Cantidad inválida de kitchenette.');
    if(c.modules.wc||c.modules.sink||c.modules.shower)warnings.push('Validar estructura, muros y tabiques de módulos sanitarios prefabricados: los APU de artefactos no los incluyen.');
    if(water>0)warnings.push('Los P64-P66 cubren tramos máximos indicados en el Excel. Medir extensiones, pendiente, conexiones y empalmes antes de emitir oferta final.');
    return {enabled:true,items,warnings,counts:c,options:o,routingMode:'apu-points',referenceScope:'precios netos sin contenedor ni flete'};
  }
  function apuItem(code,quantity,reason,master,breakdown){
    const apu=master?.apus?.['excel:'+code];if(!apu||quantity<=0)return null;
    const b=breakdown('excel:'+code);
    if(!b)return null;
    return {key:'excel-rule:'+code,apuId:'excel:'+code,excelCode:code,
      name:apu.name||code,qty:round2(quantity),unit:apu.unit||'un',
      unitCost:qty(b.net),subtotal:round2(quantity)*qty(b.net),
      directUnitCost:qty(b.direct),directSubtotal:round2(quantity)*qty(b.direct),
      apuBreakdown:b,excelApu:true,modelMapped:true,ruleMapped:true,
      sourceObject:'constructionRules',ruleReason:reason};
  }
  function mergeItem(bom,item){
    const old=bom.find(x=>x?.excelCode===item.excelCode&&x?.excelApu);
    if(!old){bom.push(item);return;}
    old.qty=round2(qty(old.qty)+item.qty);
    old.subtotal=old.qty*qty(old.unitCost);
    old.directSubtotal=old.qty*qty(old.directUnitCost);
    old.ruleMapped=true;
  }
  function runtimePlan(state){
    const plan=derive(state);
    if(!plan.enabled)return plan;
    const existing=typeof getPartitionCostMetrics==='function'?getPartitionCostMetrics():null;
    // Geometría neta por partición; el orden de selección es editable desde el panel.
    const c=typeof DATA!=='undefined'?DATA.containers?.[state.container]:null;
    const areas=[];
    for(let i=0;i<plan.counts.partitions;i++){
      let dims={length:c?.width||2.44,height:c?.height||2.4};
      try{if(typeof objectDimensions==='function')dims={...dims,...objectDimensions('partition',i)};}catch(e){}
      const gross=Math.max(0,num(dims.length,dims.width||2.44))*Math.max(0,num(dims.height,2.4));
      const door=state?.interiorDoors?.[i];
      const doorArea=door&&door.enabled!==false?Math.min(gross,qty(door.width||.82)*qty(door.height||2.05)):0;
      areas.push(Math.max(0,gross-doorArea));
    }
    const actual=Math.max(0,qty(existing?.singleFaceArea)-qty(existing?.doorOpeningArea));
    const expected=areas.reduce((a,b)=>a+b,0);
    plan.wetPartitionArea=round2(areas.slice(0,Math.min(plan.options.wetPartitions,areas.length)).reduce((a,b)=>a+b,0));
    plan.partitionArea=round2(actual||expected);
    if(actual&&expected&&Math.abs(actual-expected)>0.25)plan.warnings.push('Diferencia en cubicación de tabiques; revisar medidas y puertas.');
    return plan;
  }
  function enhanceBOM(base,state,master,breakdown,plan){
    if(!plan?.enabled)return Array.isArray(base)?base:[];
    if(!Array.isArray(base))return[];
    const bom=base.filter(item=>!['module-wc','module-sink','module-shower'].includes(item?.key)).map(x=>({...x}));
    const filtered=bom.find(x=>x?.excelCode==='P12');
    if(filtered&&plan.wetPartitionArea>0){
      const wet=Math.min(qty(filtered.qty),plan.wetPartitionArea);
      filtered.qty=round2(qty(filtered.qty)-wet);
      filtered.subtotal=filtered.qty*qty(filtered.unitCost);
      filtered.directSubtotal=filtered.qty*qty(filtered.directUnitCost);
      if(filtered.qty===0)bom.splice(bom.indexOf(filtered),1);
      const p13=apuItem('P13',wet,'Tabique húmedo seleccionado',master,breakdown);
      if(p13)mergeItem(bom,p13);else plan.warnings.push('No se puede valorar P13: falta APU o desglose.');
    }
    for(const type of TYPES){
      const n=plan.counts.modules[type];if(n>0){
        const code={wc:'P60',sink:'P61',shower:'P62'}[type];
        const item=apuItem(code,n,'Artefactos de módulo sanitario prefabricado',master,breakdown);
        if(item)mergeItem(bom,item);else plan.warnings.push('No se puede valorar '+code+' de módulo prefabricado.');
      }
    }
    for(const row of plan.items){
      const item=apuItem(row.code,row.qty,row.reason,master,breakdown);
      if(item)mergeItem(bom,item);else plan.warnings.push('APU '+row.code+' no disponible en el maestro de precios.');
    }
    return bom;
  }
  function install(){
    if(typeof document==='undefined')return false;
    if(typeof buildBOM!=='function'||typeof renderCompanyMode!=='function'||typeof getApuMaster!=='function'||typeof getApuExcelBreakdown!=='function')return false;
    if(!buildBOM.__batConstructionRules){
      const old=buildBOM;
      buildBOM=function(){
        const bom=old.apply(this,arguments),plan=runtimePlan(state);
        return enhanceBOM(bom,state,getApuMaster(),getApuExcelBreakdown,plan);
      };
      buildBOM.__batConstructionRules=true;
    }
    mountPanel();
    return true;
  }
  function esc(t){return String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function setOption(key,value){
    if(typeof state==='undefined')return;
    if(typeof pushHistory==='function')pushHistory();
    state.constructionRules={...(state.constructionRules||{}),[key]:value};
    if(typeof renderAll==='function')renderAll();
    renderPanel();
  }
  const configs=[
    ['contingencyPct','Imprevistos (% adicional neto)','number',.5],
    ['wetPartitions','Tabiques húmedos P13','number',1],
    ['waterproofM2','Impermeabilización P37 (m²)','number',.1],
    ['ceramicM2','Cerámica en muro P36 (m²)','number',.1],
    ['waterHeaterCount','Termos P63','number',1],
    ['extractorCount','Extractores P67','number',1],
    ['bathroomKitCount','Kits accesorios P68','number',1],
    ['kitchenetteCount','Kitchenettes P69','number',1],
    ['board','Tablero propio P73','checkbox'],
    ['ground','Puesta a tierra P74','checkbox'],
    ['declaration','Declaración TE-1 P76','checkbox']
  ];
  function ensurePanel(){
    let modal=document.getElementById('construction-rules-modal');
    if(modal)return modal;
    modal=document.createElement('div');
    modal.id='construction-rules-modal';
    modal.className='fixed inset-0 z-[91] modal-backdrop hidden items-center justify-center p-4';
    modal.innerHTML='<div class="modal-panel bg-white w-full max-w-3xl rounded-2xl shadow-2xl flex flex-col" style="max-height:94vh"><div class="px-5 py-4 border-b flex items-center justify-between"><div><h3 class="font-black text-lg">Reglas constructivas APU</h3><p class="text-xs text-slate-500">Se activan por proyecto. No modifican cotizaciones anteriores automáticamente.</p></div><button id="close-construction-rules" type="button" class="px-3 py-2 rounded-lg bg-slate-100">Cerrar</button></div><div class="modal-body overflow-auto p-5" id="construction-rules-body"></div></div>';
    document.body.appendChild(modal);
    modal.querySelector('#close-construction-rules').onclick=()=>{modal.classList.add('hidden');modal.classList.remove('flex');};
    return modal;
  }
  function renderPanel(){
    const modal=ensurePanel(),root=modal.querySelector('#construction-rules-body');
    const p=runtimePlan(state),o=p.options,c=p.counts;
    const field=([key,label,type,step])=>'<label class="block text-xs font-semibold text-slate-700">'+
      (type==='checkbox'?'<span class="flex gap-2 items-center"><input type="checkbox" data-rule="'+key+'" '+(o[key]?'checked':'')+'>'+esc(label)+'</span>':
       esc(label)+'<input type="number" min="0" step="'+step+'" data-rule="'+key+'" value="'+o[key]+'" class="block mt-1 w-full border rounded-lg px-3 py-2">')+'</label>';
    root.innerHTML='<label class="flex gap-3 p-3 rounded-xl border bg-amber-50 items-center text-sm font-black"><input type="checkbox" data-rule="enabled" '+(o.enabled?'checked':'')+'> Activar cubicación APU Excel para este proyecto</label>'+
      '<p class="text-xs text-slate-600 mt-3">Artefactos detectados en el 3D: '+c.wc+' WC, '+c.sink+' lavamanos, '+c.shower+' duchas. Los P64–P66 reemplazan al tendido paramétrico para evitar doble cobro. Verificar recorridos superiores a los máximos de cada punto.</p>'+
      '<div class="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">'+configs.map(field).join('')+'</div>'+
      '<p class="text-xs text-slate-500 mt-3">Los primeros N tabiques se consideran húmedos. Confirma su ubicación y dimensiones. Los m² de cerámica e impermeabilización deben medirse, no se inventan.</p>'+
      '<div class="border rounded-xl mt-4 p-3"><b class="text-sm">Partidas calculadas (precio según maestro APU)</b><div class="text-xs text-slate-600 mt-2">'+(p.items.length?p.items.map(x=>esc(x.code)+' × '+x.qty).join(' · '):'Sin partidas opcionales activadas')+'</div></div>'+
      (p.warnings.length?'<div class="rounded-xl mt-3 p-3 bg-amber-50 text-xs"><b>Puntos pendientes:</b><ul class="list-disc pl-5 mt-2">'+p.warnings.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul></div>':'');
    root.querySelectorAll('[data-rule]').forEach(el=>el.onchange=()=>{
      const key=el.dataset.rule, value=el.type==='checkbox'?el.checked:Math.max(0,num(el.value));
      setOption(key,value);
    });
  }
  function mountPanel(){
    const head=document.getElementById('company-modal')?.querySelector('.px-5.py-4.border-b');
    if(!head||document.getElementById('construction-rules-button'))return;
    const btn=document.createElement('button');
    btn.id='construction-rules-button';btn.type='button';btn.textContent='Reglas APU';
    btn.className='px-3 py-2 rounded-xl border border-amber-400 bg-amber-50 font-bold text-amber-900 text-xs';
    btn.onclick=()=>{renderPanel();const modal=ensurePanel();modal.classList.remove('hidden');modal.classList.add('flex');};
    head.insertBefore(btn,head.querySelector('button:last-of-type')||null);
  }
  const api={version:1,optional:OPTIONAL,derive,countsFor,optionsFor,enhanceBOM,routingMode:()=>typeof state==='undefined'?'parametric':derive(state).routingMode,
    snapshot:()=>typeof state==='undefined'?null:runtimePlan(state),open:()=>{renderPanel();const modal=ensurePanel();modal.classList.remove('hidden');modal.classList.add('flex');}};
  root.BAT_KUBIQUEITOR_CONSTRUCTION_RULES=api;
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(typeof document!=='undefined'){let retries=0;const timer=setInterval(()=>{retries++;if(install()||retries>160)clearInterval(timer);},100);}
})(typeof window!=='undefined'?window:globalThis);
