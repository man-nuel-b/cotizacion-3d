// BAT-Cubikeitor · Project commercial metrics v3
// Read-only metric layer: does not modify 3D state, geometry or editor behavior.
(function(){
  if(window.BAT_KUBIQUEITOR_PROJECT_METRICS) return;

  const CLP_METRICS = new Intl.NumberFormat('es-CL', { style:'currency', currency:'CLP', maximumFractionDigits:0 });
  const DECIMAL_METRICS = new Intl.NumberFormat('es-CL', { minimumFractionDigits:2, maximumFractionDigits:2 });

  function money(value){
    return CLP_METRICS.format(Math.round(Number(value)||0)).replace('CLP','$');
  }

  function projectMetrics(){
    try{
      const container = DATA?.containers?.[state?.container];
      if(!container) return { area:0, total:0, valuePerM2:0 };
      const area = Math.max(0, Number(container.length)||0) * Math.max(0, Number(container.width)||0);
      const calc = typeof calculate === 'function' ? calculate() : null;
      const materials = Math.max(0, Number(calc?.materials)||0);
      const labor = Math.max(0, Number(calc?.labor)||0);
      const transport = Math.max(0, Number(state?.transport)||0);
      const direct = Math.max(0, Number(calc?.direct)||0);
      const net = Math.max(0, Number(calc?.net)||0);
      const taxAmount = Math.max(0, Number(calc?.taxAmount)||0);
      const total = Math.max(0, Number(calc?.total)||0);
      const marginAmount = Math.max(0, net - direct);
      const marginPct = Math.max(0, Number(state?.margin)||0);
      const taxPct = Math.max(0, Number(state?.tax)||0);
      const valuePerM2 = area > 0 ? total / area : 0;
      return { area, materials, labor, transport, direct, marginAmount, marginPct, net, taxAmount, taxPct, total, valuePerM2, container };
    }catch(error){
      console.warn('[BAT Metrics] calculation', error);
      return { area:0, total:0, valuePerM2:0 };
    }
  }

  function ensureCustomerMetrics(){
    const card = document.querySelector('.summary-panel .price-card');
    if(!card) return null;
    let root = document.getElementById('project-commercial-metrics');
    if(root) return root;
    root = document.createElement('div');
    root.id = 'project-commercial-metrics';
    root.className = 'mt-3 pt-3 border-t border-slate-700 grid grid-cols-2 gap-2';
    root.innerHTML = `
      <div class="rounded-xl bg-white/5 border border-white/10 p-2.5">
        <div class="text-[10px] uppercase tracking-wide text-slate-400 font-bold">Superficie</div>
        <div id="project-area-customer" class="text-sm font-black text-white mt-0.5">—</div>
      </div>
      <div class="rounded-xl bg-white/5 border border-white/10 p-2.5">
        <div class="text-[10px] uppercase tracking-wide text-slate-400 font-bold">Valor por m²</div>
        <div id="project-m2-customer" class="text-sm font-black text-amber-300 mt-0.5">—</div>
      </div>`;
    card.appendChild(root);
    return root;
  }

  function metricCard(id,label,sub=''){
    const card=document.createElement('div');
    card.className='rounded-xl bg-slate-50 border p-3';
    card.innerHTML=`<div class="text-[11px] text-slate-500">${label}</div><div id="${id}" class="font-black text-lg">—</div>${sub?`<div class="text-[10px] text-slate-400 mt-0.5">${sub}</div>`:''}`;
    return card;
  }

  function ensureCompanySections(){
    const modalBody=document.querySelector('#company-modal .modal-body');
    const totalEl=document.getElementById('admin-total');
    const resultsGrid=totalEl?.parentElement?.parentElement;
    const marginInput=document.getElementById('margin-input');
    const paramsGrid=marginInput?.closest('.grid');
    if(!modalBody||!resultsGrid||!paramsGrid) return;

    if(!document.getElementById('company-results-section')){
      const section=document.createElement('section');
      section.id='company-results-section';
      section.className='rounded-2xl border border-slate-200 bg-white p-4 mb-5';
      section.innerHTML='<div class="flex items-start justify-between gap-3 mb-3"><div><div class="text-[10px] font-black uppercase tracking-widest text-amber-600">Resultados calculados</div><h4 class="font-black text-sm mt-1">Costos y venta del proyecto</h4><p class="text-[11px] text-slate-500 mt-0.5">Se actualizan automáticamente según el modelo, materiales y A.P.U.</p></div><span class="text-[10px] font-bold text-slate-400 bg-slate-100 rounded-full px-2 py-1">AUTOMÁTICO</span></div>';
      resultsGrid.parentNode.insertBefore(section,resultsGrid);
      resultsGrid.classList.remove('mb-5');
      section.appendChild(resultsGrid);
    }

    if(!document.getElementById('company-parameters-section')){
      const section=document.createElement('section');
      section.id='company-parameters-section';
      section.className='rounded-2xl border border-amber-200 bg-amber-50/40 p-4 mb-5';
      section.innerHTML='<div class="flex items-start justify-between gap-3 mb-3"><div><div class="text-[10px] font-black uppercase tracking-widest text-amber-700">Parámetros configurables</div><h4 class="font-black text-sm mt-1">Variables comerciales</h4><p class="text-[11px] text-slate-500 mt-0.5">Estos valores los define la empresa y afectan el precio final.</p></div><span class="text-[10px] font-bold text-amber-700 bg-amber-100 rounded-full px-2 py-1">EDITABLE</span></div>';
      paramsGrid.parentNode.insertBefore(section,paramsGrid);
      paramsGrid.classList.remove('mb-5');
      section.appendChild(paramsGrid);
      const transportLabel=document.getElementById('transport-input')?.closest('label');
      if(transportLabel && !transportLabel.querySelector('[data-company-help]')) transportLabel.insertAdjacentHTML('beforeend','<div data-company-help class="text-[10px] font-normal text-slate-500 mt-1">Costo específico de traslado para esta cotización.</div>');
      const marginLabel=document.getElementById('margin-input')?.closest('label');
      if(marginLabel && !marginLabel.querySelector('[data-company-help]')) marginLabel.insertAdjacentHTML('beforeend','<div data-company-help class="text-[10px] font-normal text-slate-500 mt-1">Porcentaje aplicado sobre el costo directo.</div>');
      const taxLabel=document.getElementById('tax-input')?.closest('label');
      if(taxLabel && !taxLabel.querySelector('[data-company-help]')) taxLabel.insertAdjacentHTML('beforeend','<div data-company-help class="text-[10px] font-normal text-slate-500 mt-1">Impuesto aplicado a la venta.</div>');
    }

    const bomTable=document.getElementById('bom-table')?.closest('.overflow-x-auto');
    if(bomTable && !document.getElementById('company-bom-heading')){
      const heading=document.createElement('div');
      heading.id='company-bom-heading';
      heading.className='mb-3 mt-1';
      heading.innerHTML='<div class="text-[10px] font-black uppercase tracking-widest text-slate-400">Cubicación y costos</div><h4 class="font-black text-sm mt-1">Detalle de materiales y partidas</h4>';
      bomTable.parentNode.insertBefore(heading,bomTable);
    }
  }

  function ensureCompanyMetrics(){
    ensureCompanySections();
    const totalEl = document.getElementById('admin-total');
    const grid = totalEl?.parentElement?.parentElement;
    if(!grid) return;
    const defs=[
      ['admin-project-area','Superficie construida'],
      ['admin-project-m2','Precio de venta por m²'],
      ['admin-transport-breakdown','Transporte'],
      ['admin-margin-amount','Margen en pesos','Aplicado sobre costo directo'],
      ['admin-net-sale','Neto de venta','Antes de IVA'],
      ['admin-tax-amount','IVA'],
      ['admin-final-sale','Precio final','IVA incluido']
    ];
    defs.forEach(([id,label,sub])=>{ if(!document.getElementById(id)) grid.appendChild(metricCard(id,label,sub)); });
  }

  function renderMetrics(){
    const m = projectMetrics();
    ensureCustomerMetrics();
    ensureCompanyMetrics();
    const areaText = m.area > 0 ? `${DECIMAL_METRICS.format(m.area)} m²` : '—';
    const valueText = m.valuePerM2 > 0 ? `${money(m.valuePerM2)}/m²` : '—';

    const values={
      'project-area-customer':areaText,
      'project-m2-customer':valueText,
      'admin-project-area':areaText,
      'admin-project-m2':valueText,
      'admin-transport-breakdown':money(m.transport),
      'admin-margin-amount':`${money(m.marginAmount)} (${DECIMAL_METRICS.format(m.marginPct)}%)`,
      'admin-net-sale':money(m.net),
      'admin-tax-amount':`${money(m.taxAmount)} (${DECIMAL_METRICS.format(m.taxPct)}%)`,
      'admin-final-sale':money(m.total)
    };
    Object.entries(values).forEach(([id,value])=>{const el=document.getElementById(id);if(el)el.textContent=value;});
  }

  function hookRenderers(){
    if(typeof window.renderSummary === 'function' && !window.renderSummary.__batMetricsWrapped){
      const original = window.renderSummary;
      const wrapped = function(){ const result = original.apply(this, arguments); renderMetrics(); return result; };
      wrapped.__batMetricsWrapped = true;
      window.renderSummary = wrapped;
    }
    if(typeof window.renderCompanyMode === 'function' && !window.renderCompanyMode.__batMetricsWrapped){
      const original = window.renderCompanyMode;
      const wrapped = function(){ const result = original.apply(this, arguments); renderMetrics(); return result; };
      wrapped.__batMetricsWrapped = true;
      window.renderCompanyMode = wrapped;
    }
  }

  function init(){
    hookRenderers();
    renderMetrics();
    window.getProjectMetrics = projectMetrics;
    window.renderProjectMetrics = renderMetrics;
    window.BAT_KUBIQUEITOR_PROJECT_METRICS = { version:3, get:projectMetrics, render:renderMetrics };
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(init, 80), { once:true });
  else setTimeout(init, 80);
})();