/* BAT-Kubiqueitor — prueba comercial guiada.
   NO modifica el modelo 3D ni el maestro APU, y NO crea cotizaciones.
   Recetas de la hoja Modulos, Excel APU_Contenedores_Chile_v2.
*/
(function(root){
  'use strict';
  if(root.BAT_EASY_QUOTE_TRIAL)return;
  const CONTINGENCY=.05;
  const RECIPES={
    half:{name:'Medio baño',short:'WC y lavamanos',reference:2141172.281449406,
      items:{P47:1.8,P37:1.8,P05:1.8,P13:5.08,P17:5.88,P16:1.8,P46:12.76,P42:1,P84:1,P80:1,P60:1,P61:1,P64:2,P66:1,P65:1,P67:1,P70:1,P71:1,P68:1}},
    full:{name:'Baño completo',short:'WC, lavamanos y ducha',reference:3531675.799847295,
      items:{P47:3.525,P37:6.885,P05:3.525,P36:3.36,P13:4.24,P17:8.88,P16:3.525,P46:16.645,P42:1,P84:1,P80:1,P60:1,P61:1,P62:1,P63:1,P64:5,P66:1,P65:2,P67:1,P70:1,P71:1,P72:1,P68:1}},
    battery:{name:'Batería sanitaria',short:'Dos baños completos y conexiones de batería',reference:9144355.392914614,
      items:{'MOD-BC':2,P80:-2,P40:2,P82:2,P73:1,P74:1,P76:1}},
    office:{name:'Oficina habilitada',short:'Aislación, pisos, electricidad y climatización',reference:7883122.737065462,
      items:{P44:56.765,P45:56.765,P47:13.865,P01:13.865,P08:16.5,P14:35.31,P16:13.865,P46:49.175,P41:2,P83:2,P40:1,P82:1,P70:4,P71:6,P72:1,P75:1,P73:1,P74:1,P76:1}},
    studio:{name:'Studio habitable',short:'Habilitación interior con baño y kitchenette',reference:10898405.436004246,
      items:{P44:56.765,P45:56.765,P47:13.865,P02:9.635,P05:4.23,P08:12.9,P37:7.59,P36:3.36,P13:4.24,P17:10.32,P14:15.39,P16:13.865,P46:48.055,P41:2,P83:2,P42:1,P84:1,P40:1,P82:1,P80:1,P60:1,P61:1,P62:1,P63:1,P64:7,P66:1,P65:3,P69:1,P67:1,P68:1,P70:5,P71:7,P72:3,P75:1,P73:1,P74:1,P76:1}}
  };
  const integer=(v,min,max)=>Math.min(max,Math.max(min,Math.floor(Number.isFinite(Number(v))?Number(v):min)));
  const number=(v)=>Number.isFinite(Number(v))?Number(v):NaN;
  const money=n=>new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(n);
  const quantity=n=>new Intl.NumberFormat('es-CL',{maximumFractionDigits:3}).format(n);
  const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&#39;'}[ch]));
  const currentState={kind:'half',shower:false,hotWater:false,extraWindows:0,units:1};
  function normalize(values={}){
    const kind=RECIPES[values.kind]?values.kind:'half';
    return {kind,shower:kind==='half'&&values.shower===true,
      hotWater:kind==='half'&&values.shower!==true&&values.hotWater===true,
      extraWindows:integer(values.extraWindows,0,3),units:integer(values.units,1,6)};
  }
  // Pure function: prices are provided by the currently loaded Excel APU engine.
  function calculate(values,priceOf,taxPct=19){
    const o=normalize(values),baseKind=o.kind==='half'&&o.shower?'full':o.kind;
    const selected=RECIPES[baseKind],rows=[],issues=[],byCode=new Map();
    function unitPrice(code){
      try{
        const p=priceOf(code);
        if(!p||!Number.isFinite(Number(p.net))||Number(p.net)<=0){issues.push('APU '+code+' sin precio válido');return 0;}
        if(p.unpriced===true)issues.push('El APU '+code+' contiene recursos sin precio');
        return Number(p.net);
      }catch(e){issues.push('No se pudo cargar el APU '+code);return 0;}
    }
    function add(code,amount,why=''){
      if(!Number.isFinite(amount)||amount===0)return;
      if(code==='MOD-BC'){
        const fullPrice=calculate({kind:'full',units:1,extraWindows:0},priceOf,taxPct);
        if(fullPrice.issues.length)issues.push(...fullPrice.issues);
        rows.push({code,description:'Baño completo prearmado (con 5 % de imprevistos)',qty:amount,unit:'módulo',
          price:fullPrice.netUnit,subtotal:amount*fullPrice.netUnit,why:'Agrupación de la hoja Modulos del Excel'});
        return;
      }
      const raw=unitPrice(code),id=code;
      const prev=byCode.get(id);
      if(prev){prev.qty+=amount;prev.subtotal=prev.qty*prev.price;return;}
      const row={code:id,qty:amount,price:raw,subtotal:amount*raw,why,description:id,unit:'partida'};
      rows.push(row);byCode.set(id,row);
    }
    for(const [code,count] of Object.entries(selected.items))add(code,count,'Receta original del Excel');
    if(o.hotWater){add('P63',1,'Termo adicional solicitado');add('P64',1,'Punto de alimentación adicional para agua caliente');add('P72',1,'Punto eléctrico dedicado al termo');}
    if(o.extraWindows){
      const wide=['office','studio'].includes(baseKind);
      add(wide?'P83':'P84',o.extraWindows,'Ventanas adicionales solicitadas');
      add(wide?'P41':'P42',o.extraWindows,'Abertura y refuerzo de las ventanas adicionales');
    }
    const baseNet=rows.reduce((sum,row)=>sum+row.subtotal,0);
    const contingency=baseNet*CONTINGENCY;
    const netUnit=baseNet+contingency;
    const tax=netUnit*Math.max(0,Math.min(100,Number(taxPct)||0))/100;
    const baselineKind=RECIPES[o.kind];
    const warnings=[
      'Simulación de habilitación: no incluye el contenedor, flete ni grúa.',
      'Precios referenciales; requieren revisión de proveedor, seguridad eléctrica y alcance constructivo.',
      'Las ventanas del Excel deben homologarse con la especificación termopanel ofertada.',
      'La simulación no cambia el diseño 3D ni los presupuestos guardados.'
    ];
    if(o.shower)warnings.unshift('Al agregar ducha se usa la receta completa del baño con ducha: cambian superficies, instalaciones, termo y electricidad.');
    if(o.hotWater)warnings.unshift('La incorporación del termo es una hipótesis de prueba: verificar red de agua caliente y protecciones antes de ofertar.');
    if(baseKind==='battery')warnings.push('La batería reproduce la agrupación y el tratamiento de imprevistos de la hoja Modulos, sujetos a revisión del alcance.');
    return {options:o,baseKind,selected,rows,issues:[...new Set(issues)],warnings,contingencyPct:5,
      baseNet,contingency,netUnit,taxUnit:tax,grossUnit:netUnit+tax,
      netTotal:netUnit*o.units,grossTotal:(netUnit+tax)*o.units,
      referenceNet:baselineKind.reference,taxPct:Math.max(0,Math.min(100,Number(taxPct)||0))};
  }
  const styling='.bat-trial-mask{position:fixed;inset:0;z-index:115;background:rgba(15,23,42,.75);display:flex;align-items:center;justify-content:center;padding:12px}.bat-trial-panel{background:white;color:#0f172a;border-radius:18px;width:min(920px,100%);max-height:94vh;overflow:auto;box-shadow:0 30px 80px #0006}.bat-trial-inner{padding:22px}.bat-trial-grid{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(265px,.9fr);gap:20px}.bat-trial-pick{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.bat-trial-opt{display:block;text-align:left;background:white;border:1px solid #cbd5e1;border-radius:12px;padding:12px;cursor:pointer;min-height:74px;font-size:13px}.bat-trial-opt[aria-pressed=true]{background:#fffbeb;border:2px solid #f59e0b}.bat-trial-btn{cursor:pointer;border:1px solid #cbd5e1;border-radius:10px;padding:9px 12px;font-size:12px;font-weight:750;background:#fff;color:#0f172a}.bat-trial-input{width:70px;padding:10px 8px;border:1px solid #94a3b8;border-radius:8px;font-size:16px;text-align:center}.bat-trial-prices{background:#0f172a;color:#fff;border-radius:15px;padding:18px}.bat-trial-prices strong{display:block;font-size:28px;line-height:1.3}.bat-trial-muted{font-size:12px;color:#64748b;line-height:1.55}.bat-trial-alert{padding:10px;border-radius:10px;background:#fffbeb;border:1px solid #fcd34d;color:#92400e;font-size:12px}.bat-trial-list{font-size:12px;border-collapse:collapse;width:100%}.bat-trial-list td{border-bottom:1px solid #e2e8f0;padding:7px 5px}.bat-trial-line{display:flex;justify-content:space-between;gap:10px;margin:9px 0;font-size:13px}.bat-trial-toggle{display:flex;align-items:center;gap:8px;padding:11px;border:1px solid #e2e8f0;border-radius:10px;font-size:13px;margin:8px 0;cursor:pointer}.bat-trial-toggle input{height:17px;width:17px;accent-color:#f59e0b}.bat-trial-chip{display:inline-block;padding:5px 9px;background:#fef3c7;color:#92400e;border-radius:999px;font-size:11px;font-weight:750}.bat-trial-head{display:flex;justify-content:space-between;align-items:start;gap:12px;border-bottom:1px solid #e2e8f0;padding:16px 22px}.bat-trial-split{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.bat-trial-hidden{display:none!important}@media(max-width:720px){.bat-trial-grid{grid-template-columns:1fr}.bat-trial-pick{grid-template-columns:1fr}.bat-trial-inner{padding:14px}.bat-trial-head{padding:14px}}';
  const sourcePrice=code=>{
    if(typeof getApuExcelBreakdown!=='function'||typeof getApuMaster!=='function')return null;
    const id='excel:'+code,b=getApuExcelBreakdown(id),master=getApuMaster();
    if(!b||!master?.apus?.[id])return null;
    const unpriced=(master.apus[id]?.components||[]).some(c=>{
      const r=master.resources?.[c.resourceId];return !r||!Number.isFinite(Number(r.price))||Number(r.price)<=0;
    });
    return {net:b.net,unpriced};
  };
  let modal=null;
  function taxRate(){try{return typeof getApuExcelSettings==='function'?getApuExcelSettings()?.taxPct??19:19;}catch(e){return 19;}}
  function preview(){
    const result=calculate(currentState,sourcePrice,taxRate()),o=result.options;
    const baseline=calculate({kind:o.kind},sourcePrice,taxRate());
    const difference=result.netTotal-baseline.netUnit*o.units;
    const choices=Object.entries(RECIPES).map(([id,p])=>'<button type="button" class="bat-trial-opt" data-kind="'+id+'" aria-pressed="'+String(o.kind===id)+'"><strong>'+esc(p.name)+'</strong><div class="bat-trial-muted">'+esc(p.short)+'</div></button>').join('');
    const toggle=(id,label,desc,checked,disabled=false)=>'<label class="bat-trial-toggle" style="'+(disabled?'opacity:.6':'')+'"><input type="checkbox" data-option="'+id+'" '+(checked?'checked':'')+(disabled?' disabled':'')+'><span><strong>'+esc(label)+'</strong><span class="bat-trial-muted" style="display:block">'+esc(desc)+'</span></span></label>';
    const details=result.rows.map(r=>'<tr><td><b>'+esc(r.code)+'</b></td><td>'+esc(r.description)+'</td><td style="text-align:right;white-space:nowrap">'+quantity(r.qty)+'</td><td style="text-align:right;white-space:nowrap">'+money(r.subtotal)+'</td></tr>').join('');
    const left='<div><div style="font-weight:850;font-size:14px;margin-bottom:8px">1. Elige qué quieres cotizar</div><div class="bat-trial-pick">'+choices+'</div>'+
      '<div style="font-weight:850;font-size:14px;margin-top:18px">2. Personaliza (opcional)</div>'+
      (o.kind==='half'?toggle('shower','¿Agregar ducha?','Cambia al baño completo de tu Excel',o.shower):'')+
      (o.kind==='half'&&!o.shower?toggle('hotWater','¿Agregar termo eléctrico?','Suma termo, conexión y punto eléctrico para probar el costo',o.hotWater):'')+
      '<div class="bat-trial-toggle"><label for="bat-trial-windows"><strong>Ventanas adicionales</strong><span class="bat-trial-muted" style="display:block">Cada una incluye vano y marco previstos en el Excel</span></label><div class="bat-trial-split" style="margin-left:auto"><button class="bat-trial-btn" type="button" data-step="extraWindows:-1" aria-label="Quitar ventana">−</button><input id="bat-trial-windows" class="bat-trial-input" type="number" min="0" max="3" value="'+o.extraWindows+'" data-number="extraWindows"><button class="bat-trial-btn" type="button" data-step="extraWindows:1" aria-label="Agregar ventana">+</button></div></div>'+
      '<div class="bat-trial-toggle"><label for="bat-trial-units"><strong>¿Cuántos módulos?</strong><span class="bat-trial-muted" style="display:block">Multiplica el presupuesto del módulo seleccionado</span></label><div class="bat-trial-split" style="margin-left:auto"><button class="bat-trial-btn" type="button" data-step="units:-1" aria-label="Restar módulo">−</button><input id="bat-trial-units" class="bat-trial-input" type="number" min="1" max="6" value="'+o.units+'" data-number="units"><button class="bat-trial-btn" type="button" data-step="units:1" aria-label="Sumar módulo">+</button></div></div>'+
      '</div>';
    const title=result.selected.name+(o.kind==='half'&&o.shower?' (con ducha)':'');
    const right='<div><div class="bat-trial-prices"><div style="font-size:12px;color:#cbd5e1">3. Precio estimado de '+esc(title)+'</div><strong>'+money(result.netTotal)+'</strong><div style="font-size:13px;color:#e2e8f0">Neto · '+o.units+' módulo(s)</div><div style="border-top:1px solid #475569;margin:12px 0"></div><div class="bat-trial-line"><span>IVA incluido</span><b>'+money(result.grossTotal)+'</b></div></div>'+
      '<div style="border:1px solid #e2e8f0;border-radius:12px;padding:14px;margin-top:10px"><div class="bat-trial-line"><span>APU de construcción</span><b>'+money(result.baseNet*o.units)+'</b></div><div class="bat-trial-line"><span>Imprevistos 5 % (Excel)</span><b>'+money(result.contingency*o.units)+'</b></div><div class="bat-trial-line" style="border-top:1px solid #e2e8f0;padding-top:10px"><strong>Variación por tus cambios</strong><strong style="color:'+(difference>=0?'#b45309':'#047857')+'">'+(difference>=0?'+':'−')+money(Math.abs(difference))+'</strong></div></div>'+
      (result.issues.length?'<div class="bat-trial-alert" style="margin-top:10px"><b>Revisar precios faltantes:</b> '+esc(result.issues.join(' · '))+'</div>':'')+
      '<div class="bat-trial-alert" style="margin-top:10px">PRUEBA · Valores referenciales. No constituye una oferta comercial. No incluye contenedor, flete ni grúa; requiere validar ventanas, instalaciones y alcance.</div>'+
      '<details style="margin-top:12px"><summary class="bat-trial-btn" style="cursor:pointer">Ver '+result.rows.length+' partidas APU utilizadas</summary><div style="max-height:250px;overflow:auto;margin-top:8px"><table class="bat-trial-list"><thead><tr><td>APU</td><td>Concepto</td><td>Cant.</td><td>Precio neto</td></tr></thead><tbody>'+details+'</tbody></table></div></details>'+
      '<div style="margin-top:12px" class="bat-trial-muted"><b>Referencia original del Excel:</b> '+money(result.referenceNet)+' netos para 1 módulo sin modificaciones. Si tus precios maestros cambiaron, el valor actual puede diferir.</div>'+
      '</div>';
    modal.querySelector('[data-trial-body]').innerHTML='<div class="bat-trial-grid">'+left+right+'</div>';
    modal.querySelector('[data-trial-status]').textContent=result.issues.length?'Faltan precios en la biblioteca':'Calculado con tu maestro APU';
  }
  function buildModal(){
    if(modal)return;
    const style=document.createElement('style');style.textContent=styling;style.id='bat-guided-trial-style';document.head.appendChild(style);
    modal=document.createElement('div');modal.id='bat-guided-trial-modal';modal.className='bat-trial-mask bat-trial-hidden';modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-label','Prueba guiada de presupuesto');
    modal.innerHTML='<div class="bat-trial-panel"><div class="bat-trial-head"><div><span class="bat-trial-chip">Demostración sin guardar</span><h2 style="font-weight:900;font-size:20px;margin-top:7px">Prueba: cotizar sin saber APU</h2><p class="bat-trial-muted">Selecciona un módulo, marca lo que necesita el cliente y mira cómo cambia el precio.</p></div><button class="bat-trial-btn" type="button" data-close-trial>Cerrar</button></div><div class="bat-trial-inner"><div data-trial-body></div><p class="bat-trial-muted" style="margin-top:15px"><span data-trial-status></span> · Ninguna opción de esta prueba modifica tu modelo 3D, tus proyectos o los precios guardados.</p></div></div>';
    document.body.appendChild(modal);
    modal.addEventListener('click',e=>{
      const target=e.target;
      if(target===modal||target.closest('[data-close-trial]')){close();return;}
      const choice=target.closest('[data-kind]');
      if(choice){currentState.kind=choice.dataset.kind;currentState.shower=false;currentState.hotWater=false;currentState.extraWindows=0;currentState.units=1;preview();return;}
      const btn=target.closest('[data-step]');
      if(btn){const [field,step]=btn.dataset.step.split(':');const max=field==='units'?6:3,min=field==='units'?1:0;currentState[field]=integer(Number(currentState[field])+Number(step),min,max);preview();}
    });
    modal.addEventListener('change',e=>{
      if(e.target.dataset.option){currentState[e.target.dataset.option]=e.target.checked;if(e.target.dataset.option==='shower'&&e.target.checked)currentState.hotWater=false;preview();return;}
      if(e.target.dataset.number){const field=e.target.dataset.number;currentState[field]=integer(e.target.value,field==='units'?1:0,field==='units'?6:3);preview();}
    });
  }
  function open(){
    if(!document.getElementById('app-shell'))return;
    if(typeof getApuExcelBreakdown!=='function'||typeof getApuMaster!=='function'){root.alert('Aún se está cargando la biblioteca APU. Reintenta en unos segundos.');return;}
    buildModal();modal.classList.remove('bat-trial-hidden');preview();
  }
  function close(){modal?.classList.add('bat-trial-hidden');}
  function injectButton(){
    const company=document.querySelector('.topbar button[onclick="openCompanyMode()"]');
    if(company&&!document.getElementById('bat-guided-trial-open')){
      const btn=document.createElement('button');btn.type='button';btn.id='bat-guided-trial-open';btn.textContent='Probar cotización fácil';btn.title='Simular costos APU sin guardar ni modificar el 3D';
      btn.className='px-3 py-2 rounded-lg bg-amber-500 text-slate-950 text-xs font-bold';
      btn.style.whiteSpace='nowrap';btn.addEventListener('click',open);company.parentElement.insertBefore(btn,company);
    }
    const firstStep=document.getElementById('solution-list')?.parentElement;
    if(firstStep&&!document.getElementById('bat-guided-trial-step1')){
      const btn=document.createElement('button');btn.type='button';btn.id='bat-guided-trial-step1';
      btn.textContent='Probar cotización sencilla (sin guardar)';btn.className='mt-3 w-full border border-amber-400 bg-amber-50 rounded-xl p-3 text-xs font-bold text-amber-900';
      btn.addEventListener('click',open);
      firstStep.insertBefore(btn,document.getElementById('solution-list').nextSibling);
    }
    return Boolean(company||firstStep);
  }
  root.BAT_EASY_QUOTE_TRIAL={version:1,recipes:RECIPES,normalize,calculate,open,close};
  if(typeof module==='object'&&module.exports)module.exports={RECIPES,normalize,calculate};
  if(typeof document!=='undefined'){let tries=0;const timer=setInterval(()=>{tries++;if(injectButton()||tries>90)clearInterval(timer);},200);}
})(typeof window!=='undefined'?window:globalThis);
