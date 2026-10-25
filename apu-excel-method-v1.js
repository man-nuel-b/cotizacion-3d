// BAT-Cubikeitor · APU methodology aligned with APU_Contenedores_Chile_v2.xlsx
// Adds crew productivity, social charges, minor tools, overhead, profit and VAT
// without changing 3D/editor behavior.
(function(){
  if(window.BAT_KUBIQUEITOR_APU_EXCEL_METHOD) return;

  const STORAGE_KEY='bat-cubikeitor-apu-excel-method-v1';
  const DEFAULTS={
    socialCharges:30,
    toolsPct:5,
    overheadPct:15,
    profitPct:10,
    taxPct:19,
    wages:{master:60000,helper:42000,specialist:70000,plumber:70000,electrician:75000,welder:75000,painter:55000},
    crews:{
      window:{yield:2,masters:1,helpers:1,role:'welder'},
      door:{yield:1,masters:1,helpers:1,role:'welder'},
      partition:{yield:15,masters:1,helpers:1,role:'master',measurement:'partitionArea',unit:'m²'},
      wc:{yield:4,masters:1,helpers:.5,role:'plumber'},
      sink:{yield:5,masters:1,helpers:.5,role:'plumber'},
      shower:{yield:3,masters:1,helpers:1,role:'plumber'},
      ac:{yield:2,masters:1,helpers:1,role:'specialist'},
      electrical:{yield:10,masters:1,helpers:.5,role:'electrician'},
      opening:{yield:3,masters:1,helpers:1,role:'welder'},
      openingFrame:{yield:12,masters:1,helpers:1,role:'welder'}
    }
  };

  const n=(v,f=0)=>{const x=Number(v);return Number.isFinite(x)?x:f;};
  const pct=v=>Math.max(0,n(v))/100;
  const clone=v=>JSON.parse(JSON.stringify(v));
  const money=v=>new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(Math.round(n(v))).replace('CLP','$');
  const esc=t=>String(t??'').replace(/[&<>\'\"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[ch]));

  function mergeDeep(base,saved){
    const out=clone(base);
    Object.entries(saved||{}).forEach(([k,v])=>{
      if(v&&typeof v==='object'&&!Array.isArray(v)&&out[k]&&typeof out[k]==='object') out[k]=mergeDeep(out[k],v);
      else out[k]=v;
    });
    return out;
  }
  function readSettings(){try{return mergeDeep(DEFAULTS,JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}'));}catch(e){return clone(DEFAULTS);}}
  let settings=readSettings();
  const save=()=>localStorage.setItem(STORAGE_KEY,JSON.stringify(settings));

  function master(){try{return typeof getApuMaster==='function'?getApuMaster():null;}catch(e){return null;}}
  function resourcePrice(r){return Math.max(0,n(r?.price));}
  function componentDirect(component,resources){
    const r=resources?.[component.resourceId];
    if(!r)return {type:'missing',cost:0};
    const amount=Math.max(0,n(component.qty))*(1+pct(component.waste))/Math.max(.0001,n(component.yield,1));
    return {type:r.type||'material',cost:resourcePrice(r)*amount,resource:r,amount};
  }

  function crewFor(id){return settings.crews[id]||null;}
  function crewLabor(id){
    const c=crewFor(id);if(!c)return null;
    const productivity=Math.max(.0001,n(c.yield,1));
    const roleWage=Math.max(0,n(settings.wages[c.role]??settings.wages.master));
    const helperWage=Math.max(0,n(settings.wages.helper));
    const baseDaily=roleWage*Math.max(0,n(c.masters))+helperWage*Math.max(0,n(c.helpers));
    return (baseDaily*(1+pct(settings.socialCharges)))/productivity;
  }

  function apuBreakdown(id){
    const m=master(),apu=m?.apus?.[id];
    if(!apu)return {id,direct:0,net:0,gross:0,materials:0,labor:0,equipment:0,tools:0,overhead:0,profit:0};
    let materials=0,laborComponents=0,equipment=0;
    (apu.components||[]).forEach(c=>{
      const x=componentDirect(c,m.resources||{});
      if(x.type==='labor')laborComponents+=x.cost;
      else if(x.type==='equipment')equipment+=x.cost;
      else materials+=x.cost;
    });
    const calculatedCrewLabor=crewLabor(id);
    const labor=calculatedCrewLabor===null?laborComponents:calculatedCrewLabor;
    const tools=labor*pct(settings.toolsPct);
    const direct=materials+labor+equipment+tools;
    const overhead=direct*pct(settings.overheadPct);
    const profit=direct*pct(settings.profitPct);
    const net=direct+overhead+profit;
    const tax=net*pct(settings.taxPct);
    return {id,materials,labor,equipment,tools,direct,overhead,profit,net,tax,gross:net+tax,apu};
  }

  function projectQty(id,fallback){
    const c=crewFor(id);
    if(c?.measurement==='partitionArea'&&typeof getPartitionCostMetrics==='function'){
      const p=getPartitionCostMetrics();return Math.max(0,n(p?.singleFaceArea));
    }
    return Math.max(0,n(fallback));
  }

  function enhanceBom(base){
    if(!Array.isArray(base))return base;
    return base.map(item=>{
      if(!item?.apuId)return item;
      const b=apuBreakdown(item.apuId),qty=projectQty(item.apuId,item.qty),crew=crewFor(item.apuId);
      return {...item,qty,unit:crew?.unit||item.unit,unitCost:b.net,subtotal:qty*b.net,directUnitCost:b.direct,directSubtotal:qty*b.direct,apuBreakdown:b,excelApu:true};
    });
  }

  function installPricing(){
    if(typeof buildBOM!=='function'||typeof calculate!=='function'||typeof getApuMaster!=='function')return false;
    if(!buildBOM.__batExcelApu){
      const before=buildBOM;
      buildBOM=function(){return enhanceBom(before.apply(this,arguments));};
      buildBOM.__batExcelApu=true;
    }
    calculate=function(){
      const bom=buildBOM();
      let apuDirect=0,nonApuDirect=0;
      bom.forEach(item=>{if(item?.excelApu)apuDirect+=n(item.directSubtotal);else nonApuDirect+=n(item.subtotal);});
      const baseLabor=state.container==='40hc'?n(DATA.labor?.base40):n(DATA.labor?.base20);
      const managed=new Set(['window','door','partition','wc','sink','shower','ac','electrical','opening','openingFrame']);
      const unmanagedLabor=Object.entries(state.counts||{}).reduce((s,[k,q])=>managed.has(k)?s:s+n(DATA.labor?.[k])*n(q),0);
      const floorLabor=typeof getFloorLaborCost==='function'?n(getFloorLaborCost()):0;
      const bathroomLabor=typeof getBathroomModuleLaborCost==='function'?n(getBathroomModuleLaborCost()):0;
      const externalLabor=baseLabor+unmanagedLabor+floorLabor+bathroomLabor;
      const transport=Math.max(0,n(state.transport));
      const direct=apuDirect+nonApuDirect+externalLabor+transport;
      const overhead=direct*pct(settings.overheadPct);
      const profit=direct*pct(settings.profitPct);
      const net=direct+overhead+profit;
      const taxAmount=net*pct(settings.taxPct);
      const total=net+taxAmount;
      const materials=apuDirect+nonApuDirect;
      return {bom,materials,labor:externalLabor,direct,overhead,profit,net,taxAmount,total,transport,apuDirect,nonApuDirect,method:'excel-apu-v1'};
    };
    window.getApuExcelBreakdown=apuBreakdown;
    window.getApuExcelSettings=()=>clone(settings);
    return true;
  }

  function field(label,key,value,suffix='%',step='1'){
    return `<label class="text-[10px] font-bold text-slate-600">${label}<div class="mt-1 flex items-center"><input data-apu-param="${key}" type="number" min="0" step="${step}" value="${n(value)}" class="w-full border rounded-lg px-2 py-1.5 text-xs"><span class="ml-1 text-[10px] text-slate-400">${suffix}</span></div></label>`;
  }
  function ensureParametersPanel(){
    const modal=document.getElementById('apu-master-modal');if(!modal)return;
    const partidas=document.getElementById('apu-view-partidas');if(!partidas||document.getElementById('apu-excel-parameters'))return;
    const box=document.createElement('div');box.id='apu-excel-parameters';box.className='mb-4 rounded-2xl border border-amber-200 bg-amber-50/60 p-4';
    box.innerHTML=`<div class="flex items-start justify-between gap-3"><div><div class="text-[10px] font-black uppercase tracking-widest text-amber-700">Metodología APU empresa</div><div class="text-xs text-slate-600 mt-1">Basada en APU_Contenedores_Chile_v2.xlsx: jornal + cargas, rendimiento, herramientas, GG, utilidad e IVA.</div></div><span class="rounded-full bg-emerald-100 text-emerald-700 text-[9px] font-black px-2 py-1">ACTIVA</span></div><div class="grid grid-cols-2 md:grid-cols-5 gap-2 mt-3">${field('Cargas sociales','socialCharges',settings.socialCharges)}${field('Herramientas','toolsPct',settings.toolsPct)}${field('Gastos generales','overheadPct',settings.overheadPct)}${field('Utilidad','profitPct',settings.profitPct)}${field('IVA','taxPct',settings.taxPct)}</div><div class="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">${field('Jornal maestro','wages.master',settings.wages.master,'$/día','1000')}${field('Jornal ayudante','wages.helper',settings.wages.helper,'$/día','1000')}${field('Jornal especialista','wages.specialist',settings.wages.specialist,'$/día','1000')}${field('Jornal electricista','wages.electrician',settings.wages.electrician,'$/día','1000')}</div>`;
    partidas.prepend(box);
    box.querySelectorAll('[data-apu-param]').forEach(input=>input.addEventListener('change',()=>{
      const key=input.dataset.apuParam,val=Math.max(0,n(input.value));
      if(key.startsWith('wages.'))settings.wages[key.split('.')[1]]=val;else settings[key]=val;
      save();syncCompanyInputs();try{renderAll();}catch(e){};renderCrewEditors();
    }));
  }

  function renderCrewEditors(){
    const root=document.getElementById('apu-partidas');if(!root)return;
    [...root.children].forEach((card,index)=>{
      const m=master(),apus=Object.values(m?.apus||{}).sort((a,b)=>(a.group||'').localeCompare(b.group||'')||(a.name||'').localeCompare(b.name||''));
      const apu=apus[index];if(!apu)return;
      let crew=crewFor(apu.id);if(!crew)return;
      let editor=card.querySelector('.apu-excel-crew');
      if(!editor){editor=document.createElement('div');editor.className='apu-excel-crew px-3 py-2 border-b bg-amber-50/40';card.querySelector('.p-3.bg-slate-50')?.insertAdjacentElement('afterend',editor);}
      const b=apuBreakdown(apu.id);
      editor.innerHTML=`<div class="grid grid-cols-2 md:grid-cols-6 gap-2 items-end"><label class="text-[9px] font-bold text-slate-500">Rendimiento<input data-c="yield" type="number" min=".01" step=".1" value="${n(crew.yield,1)}" class="mt-1 w-full border rounded-lg px-2 py-1.5 text-xs"></label><label class="text-[9px] font-bold text-slate-500">Maestros<input data-c="masters" type="number" min="0" step=".5" value="${n(crew.masters)}" class="mt-1 w-full border rounded-lg px-2 py-1.5 text-xs"></label><label class="text-[9px] font-bold text-slate-500">Ayudantes<input data-c="helpers" type="number" min="0" step=".5" value="${n(crew.helpers)}" class="mt-1 w-full border rounded-lg px-2 py-1.5 text-xs"></label><label class="text-[9px] font-bold text-slate-500">Especialidad<select data-c="role" class="mt-1 w-full border rounded-lg px-2 py-1.5 text-xs"><option value="master" ${crew.role==='master'?'selected':''}>Maestro</option><option value="specialist" ${crew.role==='specialist'?'selected':''}>Especialista</option><option value="plumber" ${crew.role==='plumber'?'selected':''}>Gasfíter</option><option value="electrician" ${crew.role==='electrician'?'selected':''}>Electricista</option><option value="welder" ${crew.role==='welder'?'selected':''}>Soldador</option><option value="painter" ${crew.role==='painter'?'selected':''}>Pintor</option></select></label><div class="md:col-span-2 rounded-lg bg-white border px-2 py-1.5"><div class="text-[9px] text-slate-400">PU neto metodología Excel</div><div class="text-xs font-black">${money(b.net)} <span class="font-normal text-slate-400">· directo ${money(b.direct)}</span></div></div></div>`;
      editor.querySelectorAll('[data-c]').forEach(el=>el.addEventListener('change',()=>{const k=el.dataset.c;crew[k]=k==='role'?el.value:Math.max(0,n(el.value));settings.crews[apu.id]=crew;save();try{renderAll();}catch(e){};renderCrewEditors();}));
    });
  }

  function syncCompanyInputs(){
    const margin=document.getElementById('margin-input'),tax=document.getElementById('tax-input');
    if(margin){margin.value=n(settings.profitPct);margin.onchange=()=>{settings.profitPct=Math.max(0,n(margin.value));save();try{renderAll();}catch(e){}};const label=margin.closest('label');if(label&&label.firstChild)label.firstChild.textContent='Utilidad APU (%)';}
    if(tax){tax.value=n(settings.taxPct);tax.onchange=()=>{settings.taxPct=Math.max(0,n(tax.value));save();try{renderAll();}catch(e){}};}
  }

  function updateMetricLabels(){
    const marginEl=document.getElementById('admin-margin-amount');if(marginEl){const card=marginEl.parentElement;const label=card?.querySelector('.text-slate-500');if(label)label.textContent='Utilidad';const sub=card?.querySelector('.text-slate-400');if(sub)sub.textContent='Según metodología APU';}
  }

  function installUiHooks(){
    if(typeof openApuMaster==='function'&&!openApuMaster.__excelWrapped){const before=openApuMaster;openApuMaster=function(){before.apply(this,arguments);setTimeout(()=>{ensureParametersPanel();renderCrewEditors();},20);};openApuMaster.__excelWrapped=true;}
    if(typeof renderCompanyMode==='function'&&!renderCompanyMode.__excelWrapped){const before=renderCompanyMode;renderCompanyMode=function(){const r=before.apply(this,arguments);syncCompanyInputs();updateMetricLabels();return r;};renderCompanyMode.__excelWrapped=true;}
    ensureParametersPanel();renderCrewEditors();syncCompanyInputs();updateMetricLabels();
  }

  let tries=0;
  const timer=setInterval(()=>{
    tries++;
    if(window.BAT_KUBIQUEITOR_APU_MASTER&&installPricing()){
      installUiHooks();
      window.BAT_KUBIQUEITOR_APU_EXCEL_METHOD={version:1,settings:()=>clone(settings),breakdown:apuBreakdown};
      try{renderAll();}catch(e){}
      clearInterval(timer);
    }else if(tries>120)clearInterval(timer);
  },100);
})();