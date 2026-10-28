// Professional A.P.U. master for bat-kubiqueitor.
// Final pricing engine: preserves external BOM contributions and adds their labor explicitly.
(function(){
  if(window.BAT_KUBIQUEITOR_APU_MASTER) return;
  const STORAGE_KEY='bat-kubiqueitor-apu-master-v2';
  const LEGACY_KEY='bat-kubiqueitor-apu-master-v1';
  const MANAGED_APUS=['window','door','partition','wc','sink','shower','ac','electrical','opening','openingFrame'];
  const LABOR_NAMES={base20:'Habilitación base contenedor 20 pies',base40:'Habilitación base contenedor 40 pies',window:'Instalación ventana',door:'Instalación puerta exterior',partition:'Montaje división interior',wc:'Instalación WC',sink:'Instalación lavamanos',shower:'Instalación ducha',ac:'Instalación aire acondicionado',electrical:'Ejecución punto eléctrico'};

  const esc=text=>String(text??'').replace(/[&<>\'\"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[ch]));
  const n=(value,fallback=0)=>{const x=Number(value);return Number.isFinite(x)?x:fallback;};
  const resourceId=(group,key)=>`${group}:${key}`;

  function baseResources(){
    const out={};
    Object.entries(DATA.catalog||{}).forEach(([key,item])=>out[resourceId('catalog',key)]={id:resourceId('catalog',key),type:'material',source:'catalog',sourceKey:key,code:`MAT-${key.toUpperCase()}`,name:item.name||key,unit:item.unit||'unidad',price:n(item.cost)});
    Object.entries(DATA.labor||{}).forEach(([key,value])=>out[resourceId('labor',key)]={id:resourceId('labor',key),type:'labor',source:'labor',sourceKey:key,code:`MO-${key.toUpperCase()}`,name:LABOR_NAMES[key]||key,unit:key.startsWith('base')?'proyecto':'unidad',price:n(value)});
    Object.entries(DATA.containers||{}).forEach(([key,item])=>out[resourceId('container',key)]={id:resourceId('container',key),type:'material',source:'container',sourceKey:key,code:`CONT-${key.toUpperCase()}`,name:`Contenedor ${item.short}`,unit:'unidad',price:n(item.baseCost)});
    [
      ['custom:opening_cut_labor','labor','MO-VANO','Corte y preparación de vano','m²',0],
      ['custom:opening_cut_consumables','material','MAT-VANO','Consumibles de corte de vano','m²',0],
      ['custom:steel_frame_profile','material','MAT-MARCO','Perfil metálico para marco de vano','m',0],
      ['custom:steel_frame_labor','labor','MO-MARCO','Fabricación e instalación marco metálico','m',0],
      ['custom:welding_consumables','material','MAT-SOLD','Soldadura y consumibles de marco','m',0]
    ].forEach(([id,type,code,name,unit,price])=>out[id]={id,type,source:'custom',sourceKey:null,code,name,unit,price});
    return out;
  }

  function defaultApus(){
    const fixed=(id,name,unit,components,group='Equipamiento')=>({id,name,unit,group,measurement:'count',components});
    return {
      window:fixed('window','Ventana termopanel instalada','unidad',[{resourceId:'catalog:window',qty:1,waste:0,yield:1},{resourceId:'labor:window',qty:1,waste:0,yield:1}],'Aberturas'),
      door:fixed('door','Puerta exterior instalada','unidad',[{resourceId:'catalog:door',qty:1,waste:0,yield:1},{resourceId:'labor:door',qty:1,waste:0,yield:1}],'Aberturas'),
      partition:fixed('partition','Montaje división interior','unidad',[{resourceId:'labor:partition',qty:1,waste:0,yield:1}],'Tabiquería'),
      wc:fixed('wc','WC completo instalado','unidad',[{resourceId:'catalog:wc',qty:1,waste:0,yield:1},{resourceId:'labor:wc',qty:1,waste:0,yield:1}],'Sanitario'),
      sink:fixed('sink','Lavamanos instalado','unidad',[{resourceId:'catalog:sink',qty:1,waste:0,yield:1},{resourceId:'labor:sink',qty:1,waste:0,yield:1}],'Sanitario'),
      shower:fixed('shower','Ducha instalada','unidad',[{resourceId:'catalog:shower',qty:1,waste:0,yield:1},{resourceId:'labor:shower',qty:1,waste:0,yield:1}],'Sanitario'),
      ac:fixed('ac','Aire acondicionado instalado','unidad',[{resourceId:'catalog:ac',qty:1,waste:0,yield:1},{resourceId:'labor:ac',qty:1,waste:0,yield:1}],'Climatización'),
      electrical:fixed('electrical','Punto eléctrico ejecutado','punto',[{resourceId:'catalog:electrical',qty:1,waste:0,yield:1},{resourceId:'labor:electrical',qty:1,waste:0,yield:1}],'Electricidad'),
      opening:{id:'opening',name:'Vano simple',unit:'m²',group:'Aberturas',measurement:'openingArea',components:[{resourceId:'custom:opening_cut_labor',qty:1,waste:0,yield:1},{resourceId:'custom:opening_cut_consumables',qty:1,waste:0,yield:1}]},
      openingFrame:{id:'openingFrame',name:'Vano con marco metálico',unit:'m',group:'Aberturas',measurement:'openingFramePerimeter',components:[{resourceId:'custom:steel_frame_profile',qty:1,waste:10,yield:1},{resourceId:'custom:steel_frame_labor',qty:1,waste:0,yield:1},{resourceId:'custom:welding_consumables',qty:1,waste:5,yield:1}]}
    };
  }

  function migrateLegacy(resources){
    try{
      const legacy=JSON.parse(localStorage.getItem(LEGACY_KEY)||'{}');
      Object.entries(legacy.catalog||{}).forEach(([k,v])=>{if(resources[`catalog:${k}`])resources[`catalog:${k}`].price=Math.max(0,n(v));});
      Object.entries(legacy.labor||{}).forEach(([k,v])=>{if(resources[`labor:${k}`])resources[`labor:${k}`].price=Math.max(0,n(v));});
      Object.entries(legacy.containers||{}).forEach(([k,v])=>{if(resources[`container:${k}`])resources[`container:${k}`].price=Math.max(0,n(v));});
    }catch(e){}
  }
  function readMaster(){
    const defaults={resources:baseResources(),apus:defaultApus()};migrateLegacy(defaults.resources);
    try{
      const saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}'),resources={...defaults.resources},apus={...defaults.apus};
      Object.entries(saved.resources||{}).forEach(([id,item])=>resources[id]={...(resources[id]||{}),...item,id});
      Object.entries(saved.apus||{}).forEach(([id,item])=>apus[id]={...(apus[id]||{}),...item,id,components:Array.isArray(item.components)?item.components:(apus[id]?.components||[])});
      return{resources,apus};
    }catch(e){return defaults;}
  }
  let master=readMaster();
  const saveMaster=()=>localStorage.setItem(STORAGE_KEY,JSON.stringify(master));

  function applyResourcePrices(){
    Object.values(master.resources).forEach(r=>{
      const price=Math.max(0,n(r.price));
      if(r.source==='catalog'&&DATA.catalog[r.sourceKey])DATA.catalog[r.sourceKey].cost=price;
      else if(r.source==='labor'&&Object.prototype.hasOwnProperty.call(DATA.labor,r.sourceKey))DATA.labor[r.sourceKey]=price;
      else if(r.source==='container'&&DATA.containers[r.sourceKey])DATA.containers[r.sourceKey].baseCost=price;
    });
  }
  function componentCost(c){const r=master.resources[c.resourceId];if(!r)return 0;return n(r.price)*Math.max(0,n(c.qty))*(1+Math.max(0,n(c.waste))/100)/Math.max(.0001,n(c.yield,1));}
  function apuUnitPrice(id){const apu=master.apus[id];return apu?apu.components.reduce((sum,c)=>sum+componentCost(c),0):0;}
  function openingMeasurement(type,mode){let total=0;for(let i=0;i<(state.counts[type]||0);i++){let d={width:.9,height:2.1};try{d={...d,...objectDimensions(type,i)};}catch(e){}const w=Math.max(0,n(d.width,.9)),h=Math.max(0,n(d.height,2.1));total+=mode==='openingFramePerimeter'?(w+2*h):(w*h);}return total;}
  function apuProjectQty(id){const apu=master.apus[id];if(!apu)return 0;if(apu.measurement==='openingArea')return openingMeasurement('opening','openingArea');if(apu.measurement==='openingFramePerimeter')return openingMeasurement('openingFrame','openingFramePerimeter');return Math.max(0,n(state.counts[id]));}
  function pendingResourcesForApu(id){const apu=master.apus[id];return apu?apu.components.map(c=>master.resources[c.resourceId]).filter(r=>r&&n(r.price)<=0):[];}

  window.getApuMaster=()=>clone(master);window.getApuUnitPrice=apuUnitPrice;window.getApuProjectQty=apuProjectQty;

  function appendExternalBOMItems(target,items){
    if(!Array.isArray(items)) return;
    items.forEach(item=>{
      const qty=n(item?.qty);
      if(!item||qty<=0) return;
      const unitCost=n(item.unitCost);
      const subtotal=Number.isFinite(Number(item.subtotal))?Number(item.subtotal):qty*unitCost;
      const normalized={...item,qty,unitCost,subtotal};
      const existing=target.find(row=>row.key===normalized.key);
      if(existing){
        existing.qty=n(existing.qty)+qty;
        existing.subtotal=n(existing.subtotal)+subtotal;
      }else target.push(normalized);
    });
  }

  const buildBOMBeforeApu=buildBOM;
  buildBOM=function(){
    applyResourcePrices();
    const base=buildBOMBeforeApu();
    const legacyFloorKey=DATA.finishes?.[state.finish]?.flooring||null;
    const useDedicatedFloor=typeof window.getFloorBOMItems==='function';
    const filtered=base.filter(item=>{
      if(['window','door','wc','sink','shower','ac','electrical'].includes(item.key)) return false;
      if(useDedicatedFloor&&legacyFloorKey&&item.key===legacyFloorKey) return false;
      return true;
    });

    if(useDedicatedFloor) appendExternalBOMItems(filtered,window.getFloorBOMItems());
    if(typeof window.getBathroomModuleBOMItems==='function') appendExternalBOMItems(filtered,window.getBathroomModuleBOMItems());

    for(const id of MANAGED_APUS){
      const qty=apuProjectQty(id);if(qty<=0)continue;const apu=master.apus[id];if(!apu)continue;const unitCost=apuUnitPrice(id);
      filtered.push({key:`apu:${id}`,apuId:id,name:`A.P.U. · ${apu.name}`,qty:Math.ceil(qty*100)/100,unit:apu.unit,unitCost,subtotal:qty*unitCost,pendingCost:pendingResourcesForApu(id).length>0});
    }
    return filtered;
  };

  calculate=function(){
    applyResourcePrices();
    const bom=buildBOM(),materials=bom.reduce((sum,item)=>sum+n(item.subtotal),0);
    const baseLabor=state.container==='40hc'?n(DATA.labor.base40):n(DATA.labor.base20);
    const unmanagedLabor=Object.entries(state.counts||{}).reduce((sum,[key,qty])=>MANAGED_APUS.includes(key)?sum:sum+n(DATA.labor[key])*n(qty),0);
    const floorLabor=typeof window.getFloorLaborCost==='function'?n(window.getFloorLaborCost()):0;
    const bathroomModuleLabor=typeof window.getBathroomModuleLaborCost==='function'?n(window.getBathroomModuleLaborCost()):0;
    const labor=baseLabor+unmanagedLabor+floorLabor+bathroomModuleLabor;
    const direct=materials+labor+n(state.transport),net=direct*(1+n(state.margin)/100),taxAmount=net*(n(state.tax)/100);
    return{bom,materials,labor,direct,net,taxAmount,total:net+taxAmount};
  };

  const resourceRows=()=>Object.values(master.resources).sort((a,b)=>(a.type||'').localeCompare(b.type||'')||(a.name||'').localeCompare(b.name||''));
  const apuRows=()=>Object.values(master.apus).sort((a,b)=>(a.group||'').localeCompare(b.group||'')||(a.name||'').localeCompare(b.name||''));
  const typeLabel=type=>type==='labor'?'Mano de obra':type==='equipment'?'Equipo':'Material';

  window.updateApuResourcePrice=function(id,value){const r=master.resources[id];if(!r)return;r.price=Math.max(0,n(value));saveMaster();applyResourcePrices();renderResourceRows();renderPartidas();renderAll();};
  window.updateApuResourceField=function(id,key,value){const r=master.resources[id];if(!r||r.source!=='custom'||!['code','name','unit','type'].includes(key))return;r[key]=String(value||'').trim()||(key==='type'?'material':'—');saveMaster();renderResourceRows();renderPartidas();};
  window.updateApuComponent=function(apuId,index,key,value){const c=master.apus[apuId]?.components?.[index];if(!c)return;if(key==='resourceId')c.resourceId=String(value);else c[key]=Math.max(key==='yield'?.0001:0,n(value,key==='yield'?1:0));saveMaster();renderPartidas();renderAll();};
  window.addApuComponent=function(apuId){const apu=master.apus[apuId],first=Object.keys(master.resources)[0];if(!apu||!first)return;apu.components.push({resourceId:first,qty:1,waste:0,yield:1});saveMaster();renderPartidas();};
  window.removeApuComponent=function(apuId,index){const apu=master.apus[apuId];if(!apu)return;apu.components.splice(index,1);saveMaster();renderPartidas();renderAll();};
  window.addCustomApuResource=function(){const id=`custom:user_${Date.now().toString(36)}`;master.resources[id]={id,type:'material',source:'custom',sourceKey:null,code:'NUEVO',name:'Nuevo recurso',unit:'unidad',price:0};saveMaster();renderResourceRows();};
  window.addCustomApuPartida=function(){const id=`custom_partida_${Date.now().toString(36)}`;master.apus[id]={id,name:'Nueva partida',unit:'unidad',group:'Personalizadas',measurement:'manual',components:[]};saveMaster();renderPartidas();};
  window.updateApuPartidaField=function(id,key,value){const apu=master.apus[id];if(!apu||!['name','unit','group'].includes(key))return;apu[key]=String(value||'').trim()||'—';saveMaster();renderPartidas();};
  window.deleteCustomApuPartida=function(id){if(!id.startsWith('custom_partida_'))return;delete master.apus[id];saveMaster();renderPartidas();};
  window.resetApuMaster=function(){if(!confirm('¿Restaurar el Maestro A.P.U. a sus valores iniciales?'))return;master={resources:baseResources(),apus:defaultApus()};migrateLegacy(master.resources);saveMaster();applyResourcePrices();renderResourceRows();renderPartidas();renderAll();toast('Maestro A.P.U. restaurado');};
  window.exportApuMaster=function(){const blob=new Blob([JSON.stringify(master,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`bat-kubiqueitor-apu-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500);};
  window.importApuMaster=function(input){const file=input?.files?.[0];if(!file)return;const reader=new FileReader();reader.onload=()=>{try{const parsed=JSON.parse(reader.result);if(!parsed.resources||!parsed.apus)throw new Error();master={resources:parsed.resources,apus:parsed.apus};saveMaster();applyResourcePrices();renderResourceRows();renderPartidas();renderAll();toast('Maestro A.P.U. importado');}catch(e){toast('No se pudo importar el archivo A.P.U.');}input.value='';};reader.readAsText(file);};

  function ensureModal(){
    if(document.getElementById('apu-master-modal'))return;
    const modal=document.createElement('div');modal.id='apu-master-modal';modal.className='fixed inset-0 z-[70] modal-backdrop hidden items-center justify-center p-4';
    modal.innerHTML=`<div class="modal-panel bg-white w-full max-w-7xl rounded-2xl shadow-2xl flex flex-col" style="max-height:94vh"><div class="px-5 py-4 border-b flex items-center gap-3"><div><h3 class="font-black text-lg">Maestro A.P.U.</h3><p class="text-xs text-slate-500">Recursos, rendimientos y análisis de precios unitarios.</p></div><div class="ml-auto flex gap-2"><button onclick="exportApuMaster()" class="rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold">Exportar</button><label class="rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold cursor-pointer">Importar<input type="file" accept="application/json,.json" class="hidden" onchange="importApuMaster(this)"></label><button onclick="closeModal('apu-master-modal')" class="w-9 h-9 rounded-full bg-slate-100"><i class="fa-solid fa-xmark"></i></button></div></div><div class="px-5 py-3 border-b flex gap-2"><button id="apu-tab-partidas" onclick="showApuTab('partidas')" class="apu-tab active">Partidas A.P.U.</button><button id="apu-tab-recursos" onclick="showApuTab('recursos')" class="apu-tab">Maestro de recursos</button><button onclick="resetApuMaster()" class="ml-auto rounded-xl text-xs font-bold text-red-700 bg-red-50 px-3 py-2">Restaurar</button></div><div class="modal-body overflow-auto p-5"><section id="apu-view-partidas"><div class="flex items-center justify-between mb-3"><div class="text-xs text-slate-500">Costo unitario = Σ precio × consumo × (1 + desperdicio) ÷ rendimiento.</div><button onclick="addCustomApuPartida()" class="rounded-xl bg-slate-950 text-white px-3 py-2 text-xs font-bold">+ Nueva partida</button></div><div id="apu-partidas" class="space-y-3"></div></section><section id="apu-view-recursos" class="hidden"><div class="flex items-center justify-between mb-3"><input id="apu-resource-search" oninput="renderApuResources()" class="border rounded-xl px-3 py-2 text-sm w-full max-w-md" placeholder="Buscar recurso"><button onclick="addCustomApuResource()" class="ml-2 rounded-xl bg-slate-950 text-white px-3 py-2 text-xs font-bold">+ Recurso</button></div><div class="overflow-x-auto rounded-xl border"><table class="table-clean w-full text-xs"><thead><tr><th>Tipo</th><th>Código</th><th>Recurso</th><th>Unidad</th><th>Precio CLP</th></tr></thead><tbody id="apu-resource-body"></tbody></table></div></section></div></div>`;document.body.appendChild(modal);
    if(!document.getElementById('apu-v3-style')){const s=document.createElement('style');s.id='apu-v3-style';s.textContent='.apu-tab{border:1px solid #e2e8f0;border-radius:10px;padding:8px 12px;font-size:11px;font-weight:800;background:#fff;color:#64748b}.apu-tab.active{background:#0f172a;color:#fff;border-color:#0f172a}.apu-card{border:1px solid #e2e8f0;border-radius:14px;background:#fff;overflow:hidden}.apu-component-grid{display:grid;grid-template-columns:minmax(180px,2fr) repeat(3,minmax(80px,.7fr)) 36px;gap:6px;align-items:center}@media(max-width:820px){.apu-component-grid{grid-template-columns:1fr 1fr}.apu-component-grid .apu-resource-select{grid-column:1/-1}}';document.head.appendChild(s);}
  }
  window.showApuTab=function(tab){const p=tab==='partidas';document.getElementById('apu-view-partidas')?.classList.toggle('hidden',!p);document.getElementById('apu-view-recursos')?.classList.toggle('hidden',p);document.getElementById('apu-tab-partidas')?.classList.toggle('active',p);document.getElementById('apu-tab-recursos')?.classList.toggle('active',!p);};
  window.renderApuResources=()=>renderResourceRows();
  function renderResourceRows(){ensureModal();const body=document.getElementById('apu-resource-body');if(!body)return;const q=(document.getElementById('apu-resource-search')?.value||'').trim().toLowerCase();body.innerHTML=resourceRows().filter(r=>!q||`${r.type} ${r.code} ${r.name} ${r.unit}`.toLowerCase().includes(q)).map(r=>{const custom=r.source==='custom',field=(key,value,cls='')=>custom?`<input value="${esc(value)}" onchange="updateApuResourceField('${esc(r.id)}','${key}',this.value)" class="border rounded-lg px-2 py-1.5 ${cls}">`:esc(value);return `<tr><td>${custom?`<select onchange="updateApuResourceField('${esc(r.id)}','type',this.value)" class="border rounded-lg px-2 py-1.5"><option value="material" ${r.type==='material'?'selected':''}>Material</option><option value="labor" ${r.type==='labor'?'selected':''}>Mano de obra</option><option value="equipment" ${r.type==='equipment'?'selected':''}>Equipo</option></select>`:`<b>${typeLabel(r.type)}</b>`}</td><td>${field('code',r.code,'w-28')}</td><td>${field('name',r.name,'min-w-[220px]')}</td><td>${field('unit',r.unit,'w-24')}</td><td><input type="number" min="0" step="100" value="${Math.round(n(r.price))}" onchange="updateApuResourcePrice('${esc(r.id)}',this.value)" class="border rounded-lg px-2 py-1.5 w-32 text-right font-bold"></td></tr>`;}).join('');}
  const resourceOptions=selected=>resourceRows().map(r=>`<option value="${esc(r.id)}" ${r.id===selected?'selected':''}>${esc(r.code)} · ${esc(r.name)}</option>`).join('');
  function projectMeasureText(apu){if(apu.measurement==='openingArea')return `${apuProjectQty(apu.id).toFixed(2)} m² en el proyecto`;if(apu.measurement==='openingFramePerimeter')return `${apuProjectQty(apu.id).toFixed(2)} m en el proyecto`;if(MANAGED_APUS.includes(apu.id))return `${apuProjectQty(apu.id)} ${apu.unit} en el proyecto`;return 'Partida manual';}
  function renderPartidas(){ensureModal();const root=document.getElementById('apu-partidas');if(!root)return;root.innerHTML=apuRows().map(apu=>{const custom=apu.id.startsWith('custom_partida_'),unitCost=apuUnitPrice(apu.id),pending=pendingResourcesForApu(apu.id),name=custom?`<input value="${esc(apu.name)}" onchange="updateApuPartidaField('${apu.id}','name',this.value)" class="border rounded-lg px-2 py-1.5 font-black">`:`<div class="font-black text-sm">${esc(apu.name)}</div>`;return `<div class="apu-card"><div class="p-3 bg-slate-50 border-b flex items-start gap-3"><div class="flex-1">${name}<div class="text-[10px] text-slate-500 mt-1">${esc(apu.group)} · ${projectMeasureText(apu)}</div></div><div class="text-right"><div class="text-[9px] uppercase text-slate-400 font-bold">Precio unitario</div><div class="font-black text-lg">${money(unitCost)}</div><div class="text-[9px] ${pending.length?'text-amber-600':'text-emerald-600'}">${pending.length?`${pending.length} recurso(s) en $0`:'Completo'}</div></div></div><div class="p-3">${apu.components.map((c,i)=>`<div class="apu-component-grid mb-1.5"><select class="apu-resource-select border rounded-lg px-2 py-2 text-xs" onchange="updateApuComponent('${apu.id}',${i},'resourceId',this.value)">${resourceOptions(c.resourceId)}</select><input type="number" min="0" step=".01" value="${n(c.qty)}" onchange="updateApuComponent('${apu.id}',${i},'qty',this.value)" class="border rounded-lg px-2 py-2 text-xs"><input type="number" min="0" step="1" value="${n(c.waste)}" onchange="updateApuComponent('${apu.id}',${i},'waste',this.value)" class="border rounded-lg px-2 py-2 text-xs"><input type="number" min=".01" step=".01" value="${n(c.yield,1)}" onchange="updateApuComponent('${apu.id}',${i},'yield',this.value)" class="border rounded-lg px-2 py-2 text-xs"><button onclick="removeApuComponent('${apu.id}',${i})" class="rounded-lg bg-red-50 text-red-600 h-9"><i class="fa-solid fa-xmark"></i></button></div>`).join('')}<button onclick="addApuComponent('${apu.id}')" class="mt-2 rounded-lg bg-slate-100 px-3 py-2 text-[10px] font-bold">+ Agregar insumo</button></div></div>`;}).join('');}
  window.openApuMaster=function(){ensureModal();renderResourceRows();renderPartidas();showApuTab('partidas');showModal('apu-master-modal');};
  function installButton(){const modal=document.getElementById('company-modal');if(!modal||document.getElementById('apu-master-open-btn'))return;const header=modal.querySelector('.px-5.py-4.border-b'),close=header?.querySelector('button[onclick*="closeModal"]');if(!header||!close)return;const btn=document.createElement('button');btn.id='apu-master-open-btn';btn.type='button';btn.onclick=openApuMaster;btn.className='ml-auto mr-2 rounded-xl bg-amber-500 text-slate-950 px-3 py-2 text-xs font-black';btn.innerHTML='<i class="fa-solid fa-calculator mr-1"></i> Maestro A.P.U.';header.insertBefore(btn,close);}
  function updateCompanyLabels(){const box=document.getElementById('admin-materials')?.parentElement?.querySelector('.text-slate-500');if(box)box.textContent='Cubicación + partidas A.P.U.';document.querySelectorAll('#bom-table tr').forEach(row=>{if(row.textContent?.includes('A.P.U. ·'))row.classList.add('bg-amber-50');});}

  applyResourcePrices();
  const renderAllBeforeApu=renderAll;renderAll=function(){applyResourcePrices();renderAllBeforeApu();installButton();updateCompanyLabels();};
  window.BAT_KUBIQUEITOR_APU_MASTER={version:4};
  if(document.readyState==='loading')window.addEventListener('DOMContentLoaded',()=>{ensureModal();installButton();renderAll();},{once:true});else{ensureModal();installButton();renderAll();}
})();