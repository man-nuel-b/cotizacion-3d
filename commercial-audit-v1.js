// BAT-Kubiqueitor · Auditoría comercial · Diagnóstico sin alterar precios
(function commercialAudit(root) {
  'use strict';
  const TYPE_ALIASES={windowOpening:'window',doorOpening:'door',electricalLight:'electrical',electricalOutlet:'electrical',electricalPower:'electrical'};
  const COUNT_TYPES=['window','door','partition','wc','sink','shower','ac','electrical'];
  const num=x=>typeof x==='number'?x:Number(x);
  const finite=x=>Number.isFinite(num(x));
  const round=x=>Math.round(x*100)/100;
  const mappedType=type=>TYPE_ALIASES[type]||type;
  function analyze(totals,state,data){
    const errors=[],warnings=[],checks=[],details={};
    const add=(list,code,message,extra)=>list.push({code,message,...(extra||{})});
    if(!totals||!Array.isArray(totals.bom)){add(errors,'NO_BOM','No hay una cubicación válida.');return{ok:false,errors,warnings,checks,details};}
    const bom=totals.bom,counts=state?.counts||{},catalogLabor=data?.labor||{};
    const legacyKeys=new Set(),apuTypes=new Set();
    let apuLabor=0,apuOverhead=0,apuProfit=0;
    for(const [index,item] of bom.entries()){
      const qty=num(item?.qty),cost=num(item?.unitCost),subtotal=num(item?.subtotal);
      if(!finite(qty)||qty<0)add(errors,'INVALID_QTY',`Partida ${index+1}: cantidad inválida.`);
      if(!finite(cost)||cost<0)add(errors,'INVALID_UNIT_COST',`Partida ${index+1}: costo unitario inválido.`);
      if(!finite(subtotal)||subtotal<0)add(errors,'INVALID_SUBTOTAL',`Partida ${index+1}: subtotal inválido.`);
      if(finite(qty)&&finite(cost)&&finite(subtotal)&&Math.abs(qty*cost-subtotal)>Math.max(2,.003*Math.abs(subtotal)))add(warnings,'ROW_MISMATCH',`Partida ${index+1}: cantidad × costo no coincide con subtotal.`);
      if(qty>0&&(!finite(cost)||cost===0||item?.pendingCost))add(warnings,'PRICE_PENDING',`Partida ${index+1}: precio pendiente o igual a $0.`);
      if(COUNT_TYPES.includes(item?.key))legacyKeys.add(item.key);
      if(item?.excelApu&&item?.apuBreakdown){
        const type=mappedType(item.sourceObject);
        if(COUNT_TYPES.includes(type))apuTypes.add(type);
        apuLabor+=(finite(qty)?qty:0)*(finite(item.apuBreakdown.labor)?num(item.apuBreakdown.labor):0);
        apuOverhead+=(finite(qty)?qty:0)*(finite(item.apuBreakdown.overhead)?num(item.apuBreakdown.overhead):0);
        apuProfit+=(finite(qty)?qty:0)*(finite(item.apuBreakdown.profit)?num(item.apuBreakdown.profit):0);
      }
    }
    const duplicates=[...apuTypes].filter(type=>legacyKeys.has(type));
    if(duplicates.length)add(errors,'DUPLICATED_MATERIAL',`Partidas genéricas y APU de los mismos elementos: ${duplicates.join(', ')}. Revisa si están cobradas dos veces.`,{types:duplicates});
    const overlapping=[...apuTypes].filter(type=>num(counts[type])>0&&finite(catalogLabor[type])&&num(catalogLabor[type])>0);
    const exposure=overlapping.reduce((sum,type)=>sum+num(catalogLabor[type])*Math.max(0,num(counts[type])),0);
    if(overlapping.length&&apuLabor>0)add(warnings,'LABOR_OVERLAP',`El APU incluye mano de obra y el cálculo base cobra mano de obra por ${overlapping.join(', ')}. Posible duplicación: hasta $${Math.round(exposure).toLocaleString('es-CL')} de mano de obra base por revisar.`,{types:overlapping,legacyLaborExposure:round(exposure)});
    const subtotalSum=bom.reduce((s,item)=>s+(finite(item?.subtotal)?num(item.subtotal):0),0);
    const directFromComponents=num(totals.materials)+num(totals.labor)+num(state?.transport||0);
    const direct=num(totals.direct),net=num(totals.net),taxAmount=num(totals.taxAmount),total=num(totals.total);
    for(const [key,value] of Object.entries({materials:totals.materials,labor:totals.labor,direct:totals.direct,net:totals.net,taxAmount:totals.taxAmount,total:totals.total})){
      if(!finite(value)||num(value)<0)add(errors,'INVALID_TOTAL',`El campo financiero ${key} no es un monto válido.`);
    }
    if(finite(direct)&&finite(directFromComponents)&&Math.abs(direct-directFromComponents)>2)add(errors,'DIRECT_MISMATCH',`Costo directo inconsistente: declarado $${Math.round(direct).toLocaleString('es-CL')}; componentes $${Math.round(directFromComponents).toLocaleString('es-CL')}.`);
    const markup=num(state?.margin||0),tax=num(state?.tax||0);
    if(!finite(markup)||markup<0||markup>200)add(errors,'INVALID_MARKUP','Porcentaje de recargo comercial fuera de rango.');
    if(!finite(tax)||tax<0||tax>100)add(errors,'INVALID_TAX','Tasa de IVA inválida.');
    if(finite(direct)&&finite(net)&&finite(markup)&&Math.abs(net-direct*(1+markup/100))>2)add(errors,'NET_MISMATCH','El precio neto no coincide con el costo directo y el recargo configurado.');
    if(finite(net)&&finite(taxAmount)&&finite(tax)&&Math.abs(taxAmount-net*tax/100)>2)add(errors,'TAX_MISMATCH','El monto IVA no coincide con la tasa configurada.');
    if(finite(net)&&finite(taxAmount)&&finite(total)&&Math.abs(total-(net+taxAmount))>2)add(errors,'GROSS_MISMATCH','Precio total no coincide con precio neto más IVA.');
    if(apuProfit>0&&markup>0)add(warnings,'MULTIPLE_PROFIT_LAYERS','Los APU contienen utilidad interna y además existe un recargo comercial global. Confirmar política de margen antes de ofertar.');
    if(apuOverhead>0)add(checks,'APU_OVERHEAD',`Gastos generales identificados en APU: $${Math.round(apuOverhead).toLocaleString('es-CL')}.`);
    if(markup>0)add(checks,'MARKUP','El porcentaje comercial es recargo sobre costo, no margen sobre venta.');
    if(!root?.BAT_KUBIQUEITOR_SUPABASE_CLOUD?.getSession?.()?.user)add(warnings,'CLOUD_UNVERIFIED','No se confirma una sesión de respaldo en nube; conserva también un respaldo local.');
    add(checks,'BOM_SIZE',`${bom.length} partidas inspeccionadas.`);
    add(checks,'TOTAL_BOM',`Suma de subtotales: $${Math.round(subtotalSum).toLocaleString('es-CL')}.`);
    details.apuTypes=[...apuTypes];details.apuLabor=round(apuLabor);details.apuOverhead=round(apuOverhead);details.apuProfit=round(apuProfit);
    details.legacyLaborExposure=round(exposure);details.subtotalSum=round(subtotalSum);details.directFromComponents=finite(directFromComponents)?round(directFromComponents):null;
    return{ok:errors.length===0&&warnings.every(w=>!['LABOR_OVERLAP','MULTIPLE_PROFIT_LAYERS','PRICE_PENDING'].includes(w.code)),errors,warnings,checks,details};
  }
  function snapshot(){
    if(typeof calculate!=='function'||typeof state==='undefined'||typeof DATA==='undefined')throw new Error('El motor de precios aún no está disponible');
    return analyze(calculate(),state,DATA);
  }
  const esc=t=>String(t).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function mount(){
    if(typeof document==='undefined')return false;
    const company=document.getElementById('company-modal'),header=company?.querySelector('.px-5.py-4.border-b');
    if(!header)return false;
    if(!document.getElementById('commercial-audit-button')){
      const btn=document.createElement('button');btn.type='button';btn.id='commercial-audit-button';
      btn.className='px-3 py-2 rounded-xl border border-amber-400 text-amber-800 bg-amber-50 text-xs font-bold';btn.textContent='Auditar costos';btn.addEventListener('click',show);
      const close=header.querySelector('button:last-of-type');if(close)header.insertBefore(btn,close);else header.appendChild(btn);
    }
    return true;
  }
  function show(){
    let result;try{result=snapshot();}catch(e){root.alert?.(e.message);return;}
    let modal=document.getElementById('commercial-audit-modal');
    if(!modal){
      modal=document.createElement('div');modal.id='commercial-audit-modal';
      modal.className='fixed inset-0 z-[80] hidden items-center justify-center p-4';modal.style.background='rgba(2,6,23,.7)';
      modal.innerHTML='<section class="bg-white rounded-2xl p-5 max-w-3xl w-full max-h-[86vh] overflow-y-auto text-slate-900"><div class="flex justify-between gap-3 mb-4"><h3 class="font-black text-lg">Auditoría de presupuesto</h3><button type="button" data-close class="text-sm font-bold">Cerrar ×</button></div><div data-audit-result></div><div class="mt-4"><button type="button" data-export class="bg-slate-900 text-white rounded-xl px-3 py-2 text-xs font-bold">Exportar diagnóstico JSON</button></div></section>';
      modal.querySelector('[data-close]').addEventListener('click',()=>{modal.classList.add('hidden');modal.classList.remove('flex');});
      modal.addEventListener('click',e=>{if(e.target===modal){modal.classList.add('hidden');modal.classList.remove('flex');}});
      document.body.appendChild(modal);
    }
    const group=(label,entries,cls)=>entries.length?`<div class="mb-3 border rounded-xl p-3 ${cls}"><b class="text-sm">${label} (${entries.length})</b><ul class="list-disc pl-5 mt-2 text-xs space-y-1">${entries.map(x=>`<li>${esc(x.message)}</li>`).join('')}</ul></div>`:'';
    modal.querySelector('[data-audit-result]').innerHTML=`<p class="text-sm font-bold mb-3">${result.ok?'Sin bloqueos detectados; requiere revisión profesional final.':'REVISAR ANTES DE ENVIAR UNA OFERTA'}</p>`+group('Errores',result.errors,'bg-red-50 border-red-200 text-red-800')+group('Advertencias',result.warnings,'bg-amber-50 border-amber-200 text-amber-800')+group('Comprobaciones',result.checks,'bg-slate-50 border-slate-200 text-slate-700');
    modal.querySelector('[data-export]').onclick=()=>{
      const blob=new Blob([JSON.stringify({schema:1,generatedAt:new Date().toISOString(),report:result},null,2)],{type:'application/json'});
      const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='bat-kubiqueitor-auditoria.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    };
    modal.classList.remove('hidden');modal.classList.add('flex');
  }
  const api={version:1,analyze,takeSnapshot:snapshot,show};
  root.BAT_KUBIQUEITOR_COMMERCIAL_AUDIT=api;
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(typeof document!=='undefined'){
    let attempts=0;const retry=setInterval(()=>{if(mount()||++attempts>60)clearInterval(retry);},250);
  }
})(typeof window!=='undefined'?window:globalThis);
