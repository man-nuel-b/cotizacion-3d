/* Cubikeitor: puente de cubicación 3D -> BOM y APU verificados de Supabase.
   Sólo se carga en pruebas.html después de validar el acceso. No reemplaza la ingeniería. */
(function(root){
  'use strict';
  function num(x){var n=Number(x);return Number.isFinite(n)?n:0;}
  function positive(x){return Math.max(0,num(x));}
  function qty(x){return Math.max(0,Math.floor(num(x)));}
  function round(x){return Math.round((num(x)+Number.EPSILON)*1000)/1000;}
  function escapeHtml(x){return String(x==null?'':x).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function buildPlan(project,data,dimensionProvider){
    var state=project||{},c=data&&data.containers&&data.containers[state.container];
    var items=[],warnings=[],counts=state.counts||{},finish=data&&data.finishes&&data.finishes[state.finish]||{};
    function add(code,amount,label){
      if(Number.isFinite(amount)&&amount>0)items.push({code:code,quantity:round(amount),label:label});
    }
    function count(key){return qty(counts[key]);}
    function getDimension(type,index,baseWidth,baseHeight){
      var value=null;
      try{value=typeof dimensionProvider==='function'?dimensionProvider(type,index):null;}catch(e){}
      value=value||state.layout&&state.layout[type]&&state.layout[type][index]||{};
      return {width:positive(value.width)||baseWidth,height:positive(value.height)||baseHeight};
    }
    function openings(type,baseWidth,baseHeight){
      var sum=0,changed=false;
      for(var i=0;i<count(type);i++){
        var d=getDimension(type,i,baseWidth,baseHeight);
        sum+=d.width*d.height;
        if(Math.abs(d.width-baseWidth)>.015||Math.abs(d.height-baseHeight)>.015)changed=true;
      }
      if(changed)warnings.push('Hay '+(type==='window'?'ventanas':'puertas')+' con medidas diferentes a la receta estándar: actualizar el refuerzo y la ficha técnica antes de presupuestar.');
      return sum;
    }
    add('MOD-VENTANA',count('window'),'Ventanas');
    add('MOD-PUERTA-EXT',count('door'),'Puertas exteriores');
    add('MOD-WC',count('wc'),'Inodoros');
    add('MOD-LAV',count('sink'),'Lavamanos');
    add('MOD-DUCHA',count('shower'),'Duchas');
    var electrical=Array.isArray(state.electrical&&state.electrical.points)?state.electrical.points:null;
    if(electrical&&electrical.length===count('electrical')){
      var outlets=0,lights=0,unmapped=0;
      electrical.forEach(function(point){
        var type=point&&point.type||'outlet';
        if(type==='outlet')outlets++;
        else if(type==='light')lights++;
        else unmapped++;
      });
      add('MOD-ENCHUFE',outlets,'Enchufes');
      add('MOD-LUZ',lights,'Luminarias');
      if(unmapped)warnings.push(unmapped+' puntos eléctricos especiales o interruptores sin APU individual: requieren revisión del circuito.');
    }else{
      add('MOD-ENCHUFE',count('electrical'),'Puntos eléctricos (supuesto: enchufes)');
      if(count('electrical'))warnings.push('Sin clasificación detallada de puntos eléctricos; se usa provisionalmente la receta de enchufe.');
    }
    if(c){
      var length=positive(c.length),width=positive(c.width),height=positive(c.height);
      var grossWall=2*(length+width)*height;
      var openArea=openings('window',1.2,1.0)+openings('door',.9,2.1);
      var outsideWall=Math.max(0,grossWall-openArea);
      var partitionArea=count('partition')*width*height;
      add('MOD-TABIQUE',partitionArea,'Tabiques interiores (m² cara única)');
      add('MOD-AIS-MURO',outsideWall,'Aislación de muros exteriores (m²)');
      if((state.interiorSystem&&state.interiorSystem.lining||finish.lining)==='gypsum'){
        add('MOD-REV-MURO',outsideWall,'Revestimiento de muros exteriores (m²)');
      }else if(outsideWall>0){
        warnings.push('El revestimiento interior seleccionado no coincide con la receta yeso-cartón del catálogo.');
      }
      var floorFinish=state.floorSystem&&state.floorSystem.finish||finish.flooring;
      if(floorFinish==='vinyl')add('MOD-PISO',length*width,'Piso OSB + vinílico (m²)');
      else warnings.push('El piso seleccionado no cuenta con una receta técnica equivalente en el catálogo.');
      warnings.push('Muros, tabiques y piso usan geometría nominal; verificar altura libre, refuerzos, vanos, terminaciones y redes reales.');
    }else warnings.push('Contenedor sin geometría válida: no se calcularon superficies.');
    if(count('ac'))warnings.push(count('ac')+' equipos de aire acondicionado fuera del catálogo APU verificado.');
    if(count('opening')||count('openingFrame'))warnings.push('Vanos especiales requieren partidas de corte y refuerzo propias.');
    warnings.push('No se incluyen costo del contenedor base, transporte, montaje general, indirectos, utilidad ni IVA.');
    return {items:items,warnings:warnings,container:state.container||null};
  }
  function aggregate(plan,bomRows,apuRows){
    var grouped=Object.create(null),byCode=Object.create(null),apu=Object.create(null),missing=[],unpriced=[];
    (Array.isArray(bomRows)?bomRows:[]).forEach(function(r){(byCode[r.component_code]||(byCode[r.component_code]=[])).push(r);});
    (Array.isArray(apuRows)?apuRows:[]).forEach(function(r){apu[r.code]=r;});
    var selected=plan&&Array.isArray(plan.items)?plan.items:[];
    selected.forEach(function(item){
      var lines=byCode[item.code],summary=apu[item.code];
      if(!lines||!lines.length){missing.push(item.code);return;}
      if(!summary||!summary.ready_for_direct_cost||!Number.isFinite(Number(summary.direct_cost_net_clp)))unpriced.push(item.code);
      lines.forEach(function(r){
        var net=num(r.net_quantity_per_component)*item.quantity;
        var withWaste=num(r.estimated_quantity_with_waste)*item.quantity;
        var id=String(r.material_sku)+'::'+String(r.material_unit);
        if(!grouped[id])grouped[id]={sku:r.material_sku,name:r.material_name,unit:r.material_unit,net:0,withWaste:0,reviewRequired:false};
        grouped[id].net+=net;grouped[id].withWaste+=withWaste;
        if(r.technical_status!=='validated')grouped[id].reviewRequired=true;
      });
    });
    var lines=Object.keys(grouped).map(function(k){var r=grouped[k];r.net=round(r.net);r.withWaste=round(r.withWaste);return r;})
      .sort(function(a,b){return String(a.sku).localeCompare(String(b.sku));});
    var apuSubtotal=selected.reduce(function(sum,item){var r=apu[item.code];return sum+(r&&r.ready_for_direct_cost?num(r.direct_cost_net_clp)*item.quantity:0);},0);
    return {lines:lines,missingComponents:missing,unpricedComponents:unpriced,
      apuSubtotalNet:round(apuSubtotal),isPartial:true,complete:false,
      selectedComponents:selected.length,coveredComponents:selected.length-missing.length,
      warnings:(plan&&plan.warnings||[]).slice()};
  }
  var api={buildPlan:buildPlan,aggregate:aggregate};
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(!root||!root.document)return;
  if(root.BAT_CUBIKEITOR_3D_SUPABASE)return;
  var doc=root.document,client=root.BAT_CUBIKEITOR_PREVIEW_CLIENT;
  var cache={bom:null,apu:null,org:null,error:null,loading:false,lastLoaded:null};
  var panel=null;
  function snapshot(){
    var dimensions=function(type,index){
      if(typeof objectDimensions==='function')return objectDimensions(type,index);
      return null;
    };
    return buildPlan(typeof state==='undefined'?{}:state,typeof DATA==='undefined'?{}:DATA,dimensions);
  }
  function mount(){
    if(panel&&doc.contains(panel))return;
    var step=doc.querySelector('.wizard-step[data-step="3"]');if(!step)return;
    panel=doc.createElement('section');panel.id='bat-supabase-bom';
    panel.setAttribute('aria-label','Cubicación del modelo 3D');
    panel.style.cssText='margin-top:16px;border:1px solid #cbd5e1;border-radius:15px;padding:14px;background:#f8fafc;color:#0f172a';
    panel.innerHTML='<div style="display:flex;align-items:center;justify-content:space-between;gap:10px"><b style="font-size:14px">Cubicación desde Supabase</b><button type="button" id="bat-bom-reload" style="font-size:11px;color:#92400e;text-decoration:underline">Actualizar</button></div><div id="bat-bom-status" role="status" aria-live="polite" style="font-size:11px;color:#64748b;margin-top:8px">Conectando con el catálogo…</div><div id="bat-bom-content"></div>';
    var nav=step.querySelector('div.flex.gap-2.mt-5');if(nav)step.insertBefore(panel,nav);else step.appendChild(panel);
    panel.querySelector('#bat-bom-reload').addEventListener('click',load);
  }
  function maskUnverifiedPrices(){
    var ids=['customer-total','admin-materials','admin-labor','admin-direct','admin-total'];
    ids.forEach(function(id){var el=doc.getElementById(id);if(el){el.textContent='Sin costo validado';el.classList.remove('price-pop');}});
    // El panel Empresa heredado muestra valores unitarios de demostración en una tabla.
    // Conservar nombres y cantidades, pero ocultar todas las columnas de importes.
    var table=doc.getElementById('bom-table');
    if(table&&table.querySelectorAll){
      table.querySelectorAll('tr').forEach(function(row){
        var cells=row.querySelectorAll('td');
        if(cells.length>=5){cells[3].textContent='No validado';cells[4].textContent='No validado';}
      });
    }
  }
  function render(){
    mount();maskUnverifiedPrices();
    if(!panel)return;
    var status=panel.querySelector('#bat-bom-status'),content=panel.querySelector('#bat-bom-content');
    if(!status||!content)return;
    if(cache.error){status.textContent='No fue posible consultar Supabase: '+cache.error;content.textContent='No se mostrará ningún precio sin datos verificados.';return;}
    if(!cache.bom||!cache.apu){status.textContent=cache.loading?'Leyendo materiales y APU desde Supabase…':'Sin datos remotos. Pulsa Actualizar.';content.textContent='';return;}
    var plan=snapshot(),result=aggregate(plan,cache.bom,cache.apu);
    status.textContent='Modelo 3D conectado · '+result.coveredComponents+'/'+result.selectedComponents+' recetas con materiales · '+result.lines.length+' materiales distintos';
    var parts='<div style="font-size:12px;font-weight:700;color:#9a3412;margin:10px 0">Costos pendientes de validación · no emitir presupuesto definitivo</div>';
    if(result.missingComponents.length)parts+='<p style="font-size:11px;color:#b91c1c">Recetas faltantes: '+escapeHtml(result.missingComponents.join(', '))+'</p>';
    if(result.unpricedComponents.length)parts+='<p style="font-size:11px;color:#64748b">APU sin costos directos completos: '+result.unpricedComponents.length+'</p>';
    parts+='<details style="margin-top:10px"><summary style="cursor:pointer;font-weight:700;font-size:12px">Ver cubicación de materiales ('+result.lines.length+')</summary><div style="max-height:230px;overflow:auto;margin-top:8px">';
    result.lines.forEach(function(r){
      parts+='<div style="display:flex;justify-content:space-between;gap:8px;border-bottom:1px solid #e2e8f0;padding:5px 0;font-size:11px"><span>'+escapeHtml(r.name)+' <small style="color:#64748b">('+escapeHtml(r.sku)+')</small></span><b style="white-space:nowrap">'+r.withWaste.toLocaleString('es-CL',{maximumFractionDigits:3})+' '+escapeHtml(r.unit)+'</b></div>';
    });
    parts+='</div></details><p style="font-size:10px;color:#64748b;margin-top:7px">Cantidades con merma de referencia. No constituyen lista de compra ni precios comprobados.</p>';
    if(result.warnings.length)parts+='<details style="margin-top:8px"><summary style="font-size:11px;cursor:pointer;color:#92400e">Advertencias y alcance ('+result.warnings.length+')</summary><ul style="font-size:10px;padding:5px 0 0 16px;list-style:disc;color:#92400e">'+result.warnings.map(function(w){return '<li>'+escapeHtml(w)+'</li>';}).join('')+'</ul></details>';
    content.innerHTML=parts;
    root.BAT_CUBIKEITOR_3D_SUPABASE.lastResult=result;
  }
  async function load(){
    if(cache.loading)return;
    if(!client){cache.error='Sesión de pruebas no disponible';render();return;}
    cache.loading=true;cache.error=null;render();
    try{
      var userResult=await client.auth.getUser();
      if(userResult.error||!userResult.data||!userResult.data.user)throw new Error('La sesión no está autenticada.');
      var member=await client.from('organization_members').select('organization_id,role')
        .eq('user_id',userResult.data.user.id).in('role',['owner','admin']).limit(1).maybeSingle();
      if(member.error||!member.data)throw new Error('No hay membresía de administración autorizada.');
      var org=member.data.organization_id;
      var responses=await Promise.all([
        client.from('component_reference_bom').select('component_code,material_sku,material_name,material_unit,net_quantity_per_component,estimated_quantity_with_waste,technical_status').eq('organization_id',org),
        client.from('apu_component_cost_summary').select('code,ready_for_direct_cost,direct_cost_net_clp,readiness_state').eq('organization_id',org)
      ]);
      if(responses[0].error)throw responses[0].error;
      if(responses[1].error)throw responses[1].error;
      if(!Array.isArray(responses[0].data)||!Array.isArray(responses[1].data)||!responses[1].data.length)throw new Error('No se recibió el catálogo autorizado.');
      cache.bom=responses[0].data;cache.apu=responses[1].data;cache.org=org;cache.lastLoaded=Date.now();
    }catch(e){cache.error=e&&e.message||'Error de red';cache.bom=null;cache.apu=null;cache.org=null;}
    finally{cache.loading=false;render();}
  }
  function install(){
    mount();
    if(typeof renderSummary==='function'){
      var previousSummary=renderSummary;
      renderSummary=function(){var out=previousSummary.apply(this,arguments);maskUnverifiedPrices();return out;};
    }
    if(typeof renderCompanyMode==='function'){
      var previousCompany=renderCompanyMode;
      renderCompanyMode=function(){var out=previousCompany.apply(this,arguments);maskUnverifiedPrices();return out;};
    }
    if(typeof renderAll==='function'){
      var previousRenderAll=renderAll;
      renderAll=function(){var out=previousRenderAll.apply(this,arguments);render();return out;};
    }
    if(typeof openQuote==='function'){
      openQuote=function(){root.alert('Cotización comercial deshabilitada: los precios locales del prototipo no han sido verificados. Usa la cubicación Supabase y valida todos los APU antes de emitir un documento con importes.');};
    }
    if(typeof shareWhatsApp==='function'){
      shareWhatsApp=function(){
        var p=snapshot(),s=typeof state!=='undefined'?state:{},base=typeof DATA!=='undefined'&&DATA.containers&&DATA.containers[s.container];
        var lines=p.items.map(function(i){return i.label+': '+i.quantity;});
        var msg='Hola, solicito cotización técnica de Cubikeitor.\nContenedor: '+(base?base.name:s.container||'Por definir')+
          '\n'+lines.join('\n')+'\nSin precios confirmados. Cantidades referenciales sujetas a revisión técnica.';
        root.open('https://wa.me/?text='+encodeURIComponent(msg),'_blank','noopener');
      };
    }
    render();load();
  }
  root.BAT_CUBIKEITOR_3D_SUPABASE={version:1,buildPlan:buildPlan,aggregate:aggregate,reload:load,snapshot:snapshot,
    lastResult:null,getState:function(){return {connected:Boolean(cache.bom&&cache.apu),error:cache.error,organizationId:cache.org};}};
  if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
})(typeof window==='undefined'?globalThis:window);
