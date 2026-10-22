// Persistent A.P.U. price master for bat-kubiqueitor.
// Existing catalog/labor/container prices become editable master rates used by calculate()/buildBOM().

(function(){
  const STORAGE_KEY='bat-kubiqueitor-apu-master-v1';
  const DEFAULTS={catalog:{},labor:{},containers:{}};

  Object.entries(DATA.catalog||{}).forEach(([key,item])=>DEFAULTS.catalog[key]=Number(item.cost)||0);
  Object.entries(DATA.labor||{}).forEach(([key,value])=>DEFAULTS.labor[key]=Number(value)||0);
  Object.entries(DATA.containers||{}).forEach(([key,item])=>DEFAULTS.containers[key]=Number(item.baseCost)||0);

  const LABOR_NAMES={
    base20:'Habilitación base contenedor 20 pies',
    base40:'Habilitación base contenedor 40 pies',
    window:'Mano de obra instalación ventana',
    door:'Mano de obra instalación puerta exterior',
    partition:'Mano de obra división interior',
    wc:'Mano de obra instalación WC',
    sink:'Mano de obra instalación lavamanos',
    shower:'Mano de obra instalación ducha',
    ac:'Mano de obra instalación aire acondicionado',
    electrical:'Mano de obra punto eléctrico'
  };

  function readMaster(){
    try{
      const saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}');
      return {
        catalog:{...DEFAULTS.catalog,...(saved.catalog||{})},
        labor:{...DEFAULTS.labor,...(saved.labor||{})},
        containers:{...DEFAULTS.containers,...(saved.containers||{})}
      };
    }catch(e){
      return clone(DEFAULTS);
    }
  }

  let master=readMaster();

  function saveMaster(){
    localStorage.setItem(STORAGE_KEY,JSON.stringify(master));
  }

  function applyMaster(){
    Object.entries(master.catalog).forEach(([key,value])=>{
      if(DATA.catalog[key]) DATA.catalog[key].cost=Math.max(0,Number(value)||0);
    });
    Object.entries(master.labor).forEach(([key,value])=>{
      if(Object.prototype.hasOwnProperty.call(DATA.labor,key)) DATA.labor[key]=Math.max(0,Number(value)||0);
    });
    Object.entries(master.containers).forEach(([key,value])=>{
      if(DATA.containers[key]) DATA.containers[key].baseCost=Math.max(0,Number(value)||0);
    });
  }

  function unitForCatalog(item){
    return item.unit||'unidad';
  }

  function rows(){
    const result=[];
    Object.entries(DATA.containers).forEach(([key,item])=>result.push({section:'Contenedores',group:'containers',key,name:`Contenedor ${item.short}`,unit:'unidad',value:master.containers[key]||0}));
    Object.entries(DATA.catalog).forEach(([key,item])=>result.push({section:'Materiales y equipos',group:'catalog',key,name:item.name||key,unit:unitForCatalog(item),value:master.catalog[key]||0}));
    Object.entries(DATA.labor).forEach(([key,value])=>result.push({section:'Mano de obra',group:'labor',key,name:LABOR_NAMES[key]||key,unit:key.startsWith('base')?'proyecto':'unidad',value:master.labor[key]||0}));
    return result;
  }

  function esc(text){
    return String(text??'').replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[ch]));
  }

  window.updateApuMasterPrice=function(group,key,value){
    if(!master[group]||!Object.prototype.hasOwnProperty.call(master[group],key)) return;
    const parsed=Math.max(0,Number(value)||0);
    master[group][key]=parsed;
    saveMaster();
    applyMaster();
    if(typeof renderAll==='function') renderAll();
    const input=document.querySelector(`[data-apu-price="${group}:${key}"]`);
    if(input) input.value=Math.round(parsed);
    const status=document.getElementById('apu-master-status');
    if(status) status.textContent='Precios actualizados';
  };

  window.resetApuMaster=function(){
    if(!confirm('¿Restaurar todos los precios originales del configurador?')) return;
    master=clone(DEFAULTS);
    saveMaster();
    applyMaster();
    renderApuMasterRows();
    if(typeof renderAll==='function') renderAll();
    toast('Maestro A.P.U. restaurado');
  };

  window.filterApuMaster=function(value){
    const q=String(value||'').trim().toLowerCase();
    document.querySelectorAll('#apu-master-body tr[data-search]').forEach(row=>{
      row.classList.toggle('hidden',q&&!row.dataset.search.includes(q));
    });
  };

  function ensureModal(){
    if(document.getElementById('apu-master-modal')) return;
    const modal=document.createElement('div');
    modal.id='apu-master-modal';
    modal.className='fixed inset-0 z-[70] modal-backdrop hidden items-center justify-center p-4';
    modal.innerHTML=`
      <div class="modal-panel bg-white w-full max-w-6xl rounded-2xl shadow-2xl flex flex-col" style="max-height:92vh">
        <div class="px-5 py-4 border-b flex items-center justify-between gap-3">
          <div><h3 class="font-black text-lg">Maestro de precios A.P.U.</h3><p class="text-xs text-slate-500">Estos valores alimentan directamente la cubicación y el presupuesto.</p></div>
          <button onclick="closeModal('apu-master-modal')" class="w-9 h-9 rounded-full bg-slate-100 shrink-0"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="px-5 py-3 border-b flex flex-col md:flex-row gap-2 md:items-center">
          <div class="relative flex-1"><i class="fa-solid fa-magnifying-glass absolute left-3 top-3 text-slate-400 text-xs"></i><input oninput="filterApuMaster(this.value)" class="w-full border rounded-xl pl-9 pr-3 py-2.5 text-sm" placeholder="Buscar material, equipo o mano de obra"></div>
          <div id="apu-master-status" class="text-[11px] text-emerald-700 font-bold md:w-40">Guardado local automático</div>
          <button onclick="resetApuMaster()" class="rounded-xl bg-slate-100 px-3 py-2.5 text-xs font-bold">Restaurar originales</button>
        </div>
        <div class="modal-body overflow-auto p-5">
          <div class="overflow-x-auto rounded-xl border">
            <table class="table-clean w-full text-xs">
              <thead class="sticky top-0 bg-white z-10"><tr><th>Grupo</th><th>Código</th><th>Descripción</th><th>Unidad</th><th style="min-width:170px">Precio unitario CLP</th></tr></thead>
              <tbody id="apu-master-body"></tbody>
            </table>
          </div>
        </div>
      </div>`;
    document.body.appendChild(modal);
  }

  function renderApuMasterRows(){
    ensureModal();
    const body=document.getElementById('apu-master-body');
    if(!body) return;
    body.innerHTML=rows().map(row=>{
      const search=`${row.section} ${row.key} ${row.name} ${row.unit}`.toLowerCase();
      return `<tr data-search="${esc(search)}"><td><span class="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold">${esc(row.section)}</span></td><td class="font-mono text-[10px] text-slate-500">${esc(row.key)}</td><td class="font-semibold">${esc(row.name)}</td><td>${esc(row.unit)}</td><td><div class="flex items-center border rounded-lg overflow-hidden bg-white"><span class="px-2 text-slate-400 font-bold">$</span><input data-apu-price="${row.group}:${row.key}" type="number" min="0" step="100" value="${Math.round(row.value)}" onchange="updateApuMasterPrice('${row.group}','${row.key}',this.value)" class="w-full min-w-[110px] px-2 py-2 outline-none font-bold text-right"></div></td></tr>`;
    }).join('');
  }

  window.openApuMaster=function(){
    renderApuMasterRows();
    showModal('apu-master-modal');
  };

  function installButton(){
    const modal=document.getElementById('company-modal');
    if(!modal||document.getElementById('apu-master-open-btn')) return;
    const header=modal.querySelector('.px-5.py-4.border-b');
    const close=header?.querySelector('button[onclick*="closeModal"]');
    if(!header||!close) return;
    const btn=document.createElement('button');
    btn.id='apu-master-open-btn';
    btn.type='button';
    btn.onclick=openApuMaster;
    btn.className='ml-auto mr-2 rounded-xl bg-amber-500 text-slate-950 px-3 py-2 text-xs font-black';
    btn.innerHTML='<i class="fa-solid fa-table-list mr-1"></i> Maestro A.P.U.';
    header.insertBefore(btn,close);
  }

  applyMaster();

  const renderAllBeforeApuMaster=renderAll;
  renderAll=function(){
    applyMaster();
    renderAllBeforeApuMaster();
    installButton();
  };

  if(document.readyState==='loading') window.addEventListener('DOMContentLoaded',()=>{ensureModal();installButton();renderAll();},{once:true});
  else {ensureModal();installButton();renderAll();}
})();
