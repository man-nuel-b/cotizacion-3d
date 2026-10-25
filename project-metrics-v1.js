// BAT-Cubikeitor · Project commercial metrics v1
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
      const total = Math.max(0, Number(calc?.total)||0);
      const valuePerM2 = area > 0 ? total / area : 0;
      return { area, total, valuePerM2, container };
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

  function ensureCompanyMetrics(){
    const totalEl = document.getElementById('admin-total');
    const grid = totalEl?.parentElement?.parentElement;
    if(!grid) return;
    if(!document.getElementById('admin-project-area')){
      const card = document.createElement('div');
      card.className = 'rounded-xl bg-slate-50 border p-3';
      card.innerHTML = '<div class="text-[11px] text-slate-500">Superficie construida</div><div id="admin-project-area" class="font-black text-lg">—</div>';
      grid.appendChild(card);
    }
    if(!document.getElementById('admin-project-m2')){
      const card = document.createElement('div');
      card.className = 'rounded-xl bg-slate-50 border p-3';
      card.innerHTML = '<div class="text-[11px] text-slate-500">Precio de venta por m²</div><div id="admin-project-m2" class="font-black text-lg">—</div>';
      grid.appendChild(card);
    }
  }

  function renderMetrics(){
    const m = projectMetrics();
    ensureCustomerMetrics();
    ensureCompanyMetrics();
    const areaText = m.area > 0 ? `${DECIMAL_METRICS.format(m.area)} m²` : '—';
    const valueText = m.valuePerM2 > 0 ? `${money(m.valuePerM2)}/m²` : '—';
    const customerArea = document.getElementById('project-area-customer');
    const customerM2 = document.getElementById('project-m2-customer');
    const adminArea = document.getElementById('admin-project-area');
    const adminM2 = document.getElementById('admin-project-m2');
    if(customerArea) customerArea.textContent = areaText;
    if(customerM2) customerM2.textContent = valueText;
    if(adminArea) adminArea.textContent = areaText;
    if(adminM2) adminM2.textContent = valueText;
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
    window.BAT_KUBIQUEITOR_PROJECT_METRICS = { version:1, get:projectMetrics, render:renderMetrics };
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(init, 80), { once:true });
  else setTimeout(init, 80);
})();