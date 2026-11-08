/* BAT-Kubiqueitor: constructor frente al cliente, conectado al proyecto real. */
(function(root){
 'use strict';
 if(root.BAT_KUBIQUEITOR_LIVE_PROJECT)return;
 const ACTIONS=[
  {key:'woodLining',label:'Revestimiento madera',icon:'fa-tree',help:'Terciado en muros; costo por validar'},
  {key:'window',label:'Ventana',icon:'fa-window-maximize',help:'Elige la cara del contenedor'},
  {key:'door',label:'Puerta',icon:'fa-door-open',help:'Nuevo acceso peatonal'},
  {key:'openingFrame',label:'Vano con marco',icon:'fa-vector-square',help:'Abertura sin puerta ni vidrio'},
  {key:'opening',label:'Vano simple',icon:'fa-square-dashed',help:'Abertura sin marco'},
  {key:'windowOpening',label:'Vano de ventana',icon:'fa-border-all',help:'Vano sin carpintería'},
  {key:'windowOpeningFrame',label:'Vano de ventana con marco',icon:'fa-border-none',help:'Refuerzo de vano'},
  {key:'ac',label:'Aire acondicionado',icon:'fa-snowflake',help:'Elige la cara de instalación'},
  {key:'partition',label:'Tabique',icon:'fa-grip-lines-vertical',help:'División interior'},
  {key:'wc',label:'WC',icon:'fa-toilet',help:'Agregar sanitario'},
  {key:'sink',label:'Lavamanos',icon:'fa-sink',help:'Agregar artefacto'},
  {key:'shower',label:'Ducha',icon:'fa-shower',help:'Agregar área húmeda'},
  {key:'electrical',label:'Punto eléctrico',icon:'fa-plug',help:'Agregar punto'}
 ];
 const n=v=>{const x=Number(v);return Number.isFinite(x)?x:0;};
 const money=v=>new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(n(v));
 const esc=t=>String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&#39;'}[c]));
 let lastTotal=null,lastChange=null,openingRequestToken=0;
 const CSS='.bat-live-controls{padding:13px;background:#fffbeb;border:1px solid #fcd34d;border-radius:14px;margin:12px 0}.bat-live-tools{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}.bat-live-tool{background:#fff;border:1px solid #e2e8f0;border-radius:11px;padding:10px;text-align:left;cursor:pointer;min-height:66px;display:flex;align-items:flex-start;gap:8px;color:#0f172a}.bat-live-tool:hover,.bat-live-tool:focus-visible{border-color:#f59e0b;background:#fff9ed}.bat-live-tool:disabled{opacity:.5;cursor:not-allowed}.bat-live-tool i{color:#b45309;font-size:15px;margin-top:2px}.bat-live-tool b{font-size:12px;display:block}.bat-live-tool small{font-size:10px;color:#64748b;display:block;margin-top:2px}.bat-live-help{font-size:11px;color:#64748b;line-height:1.55}.bat-live-price{border:1px solid #e2e8f0;border-radius:12px;padding:12px;margin-top:12px;background:#fff}.bat-live-price strong{font-size:21px;font-weight:900;color:#0f172a}.bat-live-delta{display:inline-block;margin-top:5px;border-radius:999px;background:#fef3c7;padding:3px 8px;font-size:11px;color:#92400e;font-weight:750}.bat-live-qa{margin-top:9px;font-size:11px;border:1px solid #fcd34d;background:#fffbeb;color:#92400e;border-radius:9px;padding:9px}.bat-live-qa button{display:block;text-decoration:underline;font-weight:850;margin-top:6px}.bat-live-go{background:#f59e0b;color:#0f172a;border:0;border-radius:10px;padding:9px 12px;font-size:12px;font-weight:900;white-space:nowrap}.presentation-mode .bat-live-go{display:none!important}@media(max-width:700px){.bat-live-tool{padding:8px;min-height:62px}.bat-live-go{padding:7px;font-size:11px}}';
 function catalogActions(project,data){
  return ACTIONS.map(a=>({...a,
   count:a.key==='woodLining'?(project?.interiorSystem?.lining==='plywood'?1:0):Math.max(0,Math.floor(n(project?.counts?.[a.key]))),
   max:a.key==='woodLining'?1:Math.max(0,Math.floor(n(data?.extras?.[a.key]?.max||8)))}));
 }
 function summarize(totals,project,audit){
  const bom=Array.isArray(totals?.bom)?totals.bom:[];
  const problems=bom.filter(i=>n(i.qty)>0&&(i.pendingCost||n(i.unitCost)<=0||Boolean(i.specificationMismatch)));
  return {total:n(totals?.total),net:n(totals?.net),lines:bom.length,
   excelLines:bom.filter(i=>i.excelApu).length,problems:problems.length,
   errors:Math.max(0,audit?.errors?.length||0),warnings:Math.max(0,audit?.warnings?.length||0),
   count:catalogActions(project,{extras:{}}).reduce((s,a)=>s+a.count,0)};
 }
 function readAudit(){
  try{return root.BAT_KUBIQUEITOR_COMMERCIAL_AUDIT?.takeSnapshot?.()||null;}catch(e){return null;}
 }
 function refresh(){
  const card=document.getElementById('bat-live-price');
  if(!card)return;
  let totals=null;try{if(typeof calculate==='function')totals=calculate();}catch(e){}
  if(!totals)return;
  const report=readAudit(),data=summarize(totals,typeof state!=='undefined'?state:null,report);
  if(lastTotal!==null&&Math.abs(data.total-lastTotal)>.5)lastChange=data.total-lastTotal;
  lastTotal=data.total;
  const woodSelected=typeof state!=='undefined'&&state?.interiorSystem?.lining==='plywood';
  const issueCount=(report?data.errors:data.problems)+(woodSelected?1:0);
  // El motor Excel local contiene importes de demostración. No mostrar variaciones monetarias
  // hasta que los APU de Supabase estén completos, vigentes y técnicamente validados.
  const difference=lastChange===null?'':'<div class="bat-live-delta">Diseño actualizado · sin precio verificado</div>';
  card.innerHTML='<div class="bat-live-help"><b>Presupuesto conectado al diseño 3D</b></div>'+ 
   difference+'<p class="bat-live-help" style="margin-top:7px">'+data.lines+' partidas de costo, '+data.excelLines+' APU del Excel. No es una cotización definitiva.</p>'+
   (issueCount?
    '<div class="bat-live-qa"><b>Revisión pendiente: '+issueCount+' incidencia(s)</b><div>'+(woodSelected?'Revestimiento de madera: verificar material, fijaciones y APU completo de instalación; el acabado visual no equivale a un precio validado. ':'')+'Hay costos, especificaciones o partidas por validar.</div><button type="button" data-live-audit>Revisar antes de entregar</button></div>':
    '<div class="bat-live-qa">Sin incidencias adicionales en este cálculo preliminar. APU y precios reales pendientes de aprobación; no emitir cotización.</div>');
  const e=document.getElementById('bat-live-controls');
  if(e&&typeof DATA!=='undefined'){
   const entries=catalogActions(state,DATA);
   e.querySelectorAll('[data-live-add]').forEach(btn=>{
    const d=entries.find(x=>x.key===btn.dataset.liveAdd);
    if(!d)return;
    btn.disabled=d.key==='woodLining'?false:d.count>=d.max;
    const x=btn.querySelector('[data-live-count]');if(x)x.textContent=d.key==='woodLining'?(d.count?'Seleccionado · clic para quitar':'Aún no seleccionado'):'En proyecto: '+d.count;
   });
  }
 }
 function add(key){
  if(typeof DATA==='undefined'||typeof state==='undefined')return;
  if(key==='woodLining'){
   if(typeof selectInteriorLining!=='function'){
    root.alert('El editor de revestimientos interiores todavía no está disponible.');return;
   }
   const current=state?.interiorSystem?.lining;
   const fallback=DATA.finishes?.[state.finish]?.lining||'gypsum';
   const next=current==='plywood'?fallback:'plywood';
   selectInteriorLining(next);
   if(next==='plywood'){
    root.alert('Se aplicó visualmente el revestimiento terciado al 3D. La madera aún no tiene precio de material ni APU de instalación validado. No emitas una cotización definitiva hasta definirlos.');
   }
   return;
  }
  const action=ACTIONS.find(a=>a.key===key),config=DATA.extras?.[key];if(!action||!config){root.alert('El editor de este elemento todavía no está disponible.');return;}
  if(n(state.counts?.[key])>=n(config.max)){root.alert('Alcanzaste la cantidad máxima permitida.');return;}
  if(key==='openingFrame'){
   const request=++openingRequestToken;
   const button=document.querySelector('button[data-live-add="openingFrame"]');
   const status=button?.querySelector('[data-live-count]');
   if(status)status.textContent='Preparando editor 3D…';
   const ready=()=>Boolean(root.BAT_KUBIQUEITOR_OPENING_VARIANTS?.version>=2
     &&root.BAT_KUBIQUEITOR_WALL_MODULE_ENGINE?.version>=1
     &&root.wallModuleDefinition?.('openingFrame')
     &&DATA.extras?.openingFrame
     &&typeof MOUNTED_FACE_TYPES!=='undefined'&&MOUNTED_FACE_TYPES.openingFrame
     &&typeof openMountedFacePicker==='function');
   const check=(attempt=0)=>{
     // A different choice cancels an older request without opening a surprise dialog.
     if(request!==openingRequestToken)return;
     if(ready()){
       if(n(state.counts?.openingFrame)<n(DATA.extras.openingFrame.max))
         openMountedFacePicker('openingFrame');
       else if(typeof toast==='function')toast('Se alcanzó el máximo de vanos.');
       refresh();return;
     }
     if(attempt>=100){
       if(typeof toast==='function')
         toast('El editor de vanos no pudo inicializarse. Comprueba la conexión y recarga el proyecto.');
       refresh();return;
     }
     root.setTimeout(()=>check(attempt+1),150);
   };
   check();return;
  }
  // Elegir otro extra cancela cualquier apertura de vano todavía pendiente.
  openingRequestToken++;
  if(typeof adjustCount!=='function'){root.alert('El editor 3D todavía no está listo.');return;}
  adjustCount(key,1);
 }
 function start(){
  // La interfaz puede tener 4 o 6 pasos; abrir el que contiene los Extras reales.
  const extrasStep=document.getElementById('extras-list')?.closest('.wizard-step');
  if(typeof goStep==='function')goStep(Number(extrasStep?.dataset?.step)||3);
  root.setSummaryPanelCollapsed?.(false);
  document.getElementById('bat-live-controls')?.scrollIntoView?.({behavior:'smooth',block:'nearest'});
  refresh();
 }
 function install(){
  const shell=document.getElementById('app-shell'),extrasRoot=document.getElementById('extras-list');
  const step=extrasRoot?.closest('.wizard-step')||document.querySelector('.wizard-step[data-step="3"]');
  if(!shell||!step||typeof renderSummary!=='function'||typeof calculate!=='function')return false;
  if(!document.getElementById('bat-live-style')){const style=document.createElement('style');style.id='bat-live-style';style.textContent=CSS;document.head.appendChild(style);}
  if(!document.getElementById('bat-live-controls')){
   const box=document.createElement('section');box.id='bat-live-controls';box.className='bat-live-controls';
   box.innerHTML='<div style="font-weight:900;font-size:14px">Diseña con tu cliente</div>'+
    '<p class="bat-live-help">Agrega lo que te pida. Luego selecciona la pieza en el 3D para cambiar su posición o tamaño. El presupuesto del proyecto real se recalcula automáticamente.</p>'+
    '<div class="bat-live-tools">'+ACTIONS.map(a=>'<button class="bat-live-tool" type="button" data-live-add="'+a.key+'"><i class="fa-solid '+a.icon+'" aria-hidden="true"></i><span><b>+ '+esc(a.label)+'</b><small>'+esc(a.help)+'</small><small data-live-count>En proyecto: 0</small></span></button>').join('')+'</div>'+
    '<p class="bat-live-help" style="margin-top:8px">Los vanos con marco y las especificaciones especiales pueden necesitar revisión del costo de corte y refuerzo.</p>';
   // extras-list puede estar anidado, y los pasos se renumeran en el asistente de 6 etapas.
   // insertBefore sólo acepta un nodo hijo DIRECTO del elemento step.
   let anchor=extrasRoot;
   while(anchor&&anchor.parentElement!==step)anchor=anchor.parentElement;
   step.insertBefore(box,anchor||step.firstChild);
   const oldExtras=document.getElementById('extras-list');
   if(oldExtras&&!document.getElementById('bat-live-old-extras')){
    const details=document.createElement('details');details.id='bat-live-old-extras';details.style.marginTop='12px';
    const title=document.createElement('summary');title.textContent='Ver controles anteriores y quitar elementos';title.className='bat-live-help';title.style.cursor='pointer';title.style.fontWeight='800';
    oldExtras.parentNode.insertBefore(details,oldExtras);details.appendChild(title);details.appendChild(oldExtras);
   }
   box.addEventListener('click',event=>{const b=event.target.closest('button[data-live-add]');if(b&&!b.disabled)add(b.dataset.liveAdd);});
  }
  if(!document.getElementById('bat-live-goto')){
   const company=document.querySelector('.topbar button[onclick="openCompanyMode()"]');
   if(company){
    const button=document.createElement('button');button.id='bat-live-goto';button.className='bat-live-go';button.type='button';
    button.textContent='Diseñar con cliente';button.addEventListener('click',start);
    company.parentNode.insertBefore(button,company);
   }
  }
  const existing=document.querySelector('.summary-panel .price-card');
  if(existing&&!document.getElementById('bat-live-price')){
   const box=document.createElement('div');box.id='bat-live-price';box.className='bat-live-price';existing.insertAdjacentElement('afterend',box);
   box.addEventListener('click',e=>{if(e.target.closest('[data-live-audit]'))root.BAT_KUBIQUEITOR_COMMERCIAL_AUDIT?.show?.();});
  }
  if(!renderSummary.__liveProjectWrapped){
   const before=renderSummary;const patched=function(){const r=before.apply(this,arguments);refresh();return r;};
   patched.__liveProjectWrapped=true;renderSummary=patched;
  }
  root.BAT_KUBIQUEITOR_LIVE_PROJECT={version:2,add,start,refresh,summarize,catalogActions};
  refresh();return true;
 }
 if(typeof module==='object'&&module.exports)module.exports={summarize,catalogActions};
 if(typeof document!=='undefined'){
  let tries=0;const timer=setInterval(()=>{tries++;if(install()||tries>150)clearInterval(timer);},100);
 }
})(typeof window!=='undefined'?window:globalThis);
