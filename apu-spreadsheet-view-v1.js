/* Vista planilla APU · BAT-Kubiqueitor. Los datos se toman del maestro actual. */
(function(root){
'use strict';
if(root.BAT_APU_SPREADSHEET)return;
const n=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
const pos=v=>Math.max(0,n(v));
const dec=v=>new Intl.NumberFormat('es-CL',{maximumFractionDigits:4}).format(n(v));
const money=v=>new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(n(v));
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&#39;'}[c]));
const roles={master:'MO01',helper:'MO02',specialist:'MO03',plumber:'MO04',electrician:'MO05',welder:'MO06',painter:'MO07'};
let chosen='excel:P01',query='',simulated={},simpleMode=true;
const master=()=>typeof getApuMaster==='function'?getApuMaster():null;
const settings=()=>typeof getApuExcelSettings==='function'?getApuExcelSettings():null;
const breakdown=id=>typeof getApuExcelBreakdown==='function'?getApuExcelBreakdown(id):null;
const name=a=>String(a?.name||'').replace(/^P\d{2}\s*·\s*/,'');
function projectQty(id){
 try{if(typeof buildBOM==='function')return buildBOM().reduce((v,r)=>v+(r.apuId===id?pos(r.qty):0),0);}catch(e){}
 return 0;
}
function model(apu,m,s,b,measured){
 const rows=[],resources=m?.resources||{},crew=s?.crews?.[apu.id];
 const add=(type,code,label,unit,qty,waste,yieldFactor,price,note,index=null,resourceId=null)=>{
  const base=pos(qty),lost=pos(waste),factor=Math.max(.0001,n(yieldFactor,1));
  const amount=base*(1+lost/100)/factor;
  rows.push({type,code,label,unit,base,waste:lost,yieldFactor:factor,amount,price:pos(price),
   subtotal:amount*pos(price),total:amount*pos(measured),note,index,resourceId});
 };
 (apu.components||[]).forEach((c,i)=>{
  const r=resources[c.resourceId];
  if(r?.type==='labor'&&crew)return;
  const type=!r?'Revisar':r.type==='labor'?'Mano de obra':r.type==='equipment'?'Equipo':'Material';
  add(type,r?.code||'?',r?.name||'Recurso faltante',r?.unit||'un',c.qty,c.waste,c.yield,r?.price,
    'Consumo por '+(apu.unit||'unidad')+'; incluye el porcentaje de merma.',i,c.resourceId);
 });
 if(crew){
  const productivity=Math.max(.0001,n(crew.yield,1)),social=1+pos(s.socialCharges)/100;
  const labor=(role,people)=>{
   if(pos(people)===0)return;
   const code=roles[role]||'MO01',resource=resources['excel:'+code]||{};
   add('Mano de obra',code,resource.name||role,'jornada',pos(people)/productivity,0,1,
     pos(s.wages?.[role]??s.wages?.master)*social,
     'Jornadas = '+dec(people)+' personas ÷ '+dec(productivity)+' '+(apu.unit||'un')+'/día. Incluye cargas sociales.');
  };
  labor(crew.role||'master',crew.masters);
  labor('helper',crew.helpers);
 }
 if(pos(b.tools)>0)add('Equipo','HM','Herramientas menores','glb',1,0,1,b.tools,
   'Costo equivalente a '+dec(pos(s?.toolsPct))+'% de la mano de obra.');
 const sums={materials:pos(b.materials),labor:pos(b.labor),equipment:pos(b.equipment)+pos(b.tools),
  direct:pos(b.direct),overhead:pos(b.overhead),profit:pos(b.profit),net:pos(b.net),
  tax:pos(b.tax),gross:pos(b.gross)};
 return {rows,sums,variance:Math.abs(rows.reduce((v,r)=>v+r.subtotal,0)-sums.direct),
 missing:rows.some(r=>r.type==='Revisar'||(r.type==='Material'&&r.price<=0))};
}
const css='.bat-w-simple-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.bat-w-simple-hero{background:#0f172a;color:#fff;padding:17px 19px;border-radius:13px}.bat-w-simple-hero strong{font-size:28px;display:block;margin:4px 0}.bat-w-simple-group{background:#fff;border:1px solid #dbe4ed;border-radius:12px;padding:12px}.bat-w-simple-line{display:flex;align-items:start;justify-content:space-between;gap:12px;padding:9px 0;border-bottom:1px solid #edf2f7;font-size:12px}.bat-w-simple-line:last-child{border-bottom:0}.bat-w-simple-price{font-size:17px;font-weight:850;white-space:nowrap}.bat-w-action{background:#0f172a;color:#fff;border:0;border-radius:9px;padding:10px 14px;font-size:12px;font-weight:800;cursor:pointer}.bat-w-action:focus-visible{outline:2px solid #f59e0b;outline-offset:2px}@media(max-width:700px){.bat-w-simple-grid{grid-template-columns:1fr}}.bat-worksheet{display:grid;grid-template-columns:235px minmax(0,1fr);gap:12px}.bat-worksheet>aside,.bat-worksheet>section{min-width:0}.bat-w-sheet{overflow:auto;border:1px solid #cbd5e1;border-radius:12px}.bat-w-table{border-collapse:separate;border-spacing:0;width:100%;min-width:1450px;font-size:11px;font-variant-numeric:tabular-nums}.bat-w-table th{background:#102d48;color:white;text-align:left;padding:10px 7px;border-right:1px solid #8ca1b6}.bat-w-table td{padding:8px 7px;border-bottom:1px solid #e2e8f0;border-right:1px solid #dbe3eb;vertical-align:middle}.bat-w-table tbody tr:nth-child(2n){background:#f8fafc}.bat-w-table td:first-child{position:sticky;left:0;background:#e9f0f7;font-weight:800}.bat-w-table th:first-child{position:sticky;left:0;z-index:1}.bat-w-num{text-align:right;white-space:nowrap}.bat-w-input{width:75px;border:1px solid #94a3b8;border-radius:7px;padding:6px 4px;font-size:11px;text-align:right}.bat-w-list{max-height:550px;overflow:auto;border:1px solid #cbd5e1;border-radius:9px}.bat-w-choice{padding:9px 10px;text-align:left;width:100%;background:#fff;border:0;border-bottom:1px solid #edf2f7;cursor:pointer;font-size:12px}.bat-w-choice[aria-current=true]{background:#fff7ed;border-left:3px solid #f59e0b}.bat-w-card{border:1px solid #cbd5e1;border-radius:10px;padding:10px}.bat-w-cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.bat-w-card small{display:block;color:#64748b}.bat-w-card strong{font-size:17px}.bat-w-button{border:1px solid #cbd5e1;border-radius:8px;padding:6px 9px;font-size:11px;font-weight:750;background:#fff;cursor:pointer}.bat-w-hint{font-size:11px;color:#475569;line-height:1.6}.bat-w-warning{background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:10px;font-size:12px}@media(max-width:900px){.bat-worksheet{grid-template-columns:1fr}.bat-w-list{max-height:160px}.bat-w-cards{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:500px){.bat-w-cards{grid-template-columns:1fr}}';
function choices(m){
 return Object.values(m?.apus||{}).filter(a=>a.excelCode&&(!query||[a.name,a.excelCode,a.group].join(' ').toLowerCase().includes(query.toLowerCase())))
  .sort((a,b)=>a.excelCode.localeCompare(b.excelCode,undefined,{numeric:true}))
  .map(a=>'<button class="bat-w-choice" data-apu="'+esc(a.id)+'" aria-current="'+(chosen===a.id)+'"><b>'+esc(a.excelCode)+'</b> · '+esc(name(a))+'<div style="color:#64748b;font-size:10px">'+esc(a.group||'')+'</div></button>').join('')||'<div style="padding:10px">Sin resultados.</div>';
}
function render(){
 const target=document.getElementById('bat-w-root'),m=master();if(!target||!m)return;
 if(!m.apus[chosen])chosen=m.apus['excel:P01']?'excel:P01':Object.keys(m.apus)[0];
 const a=m.apus[chosen],s=settings(),b=breakdown(chosen);
 if(!a||!b||!s){target.innerHTML='Cargando costos APU…';return;}
 const actual=projectQty(chosen),isSimulation=Object.hasOwn(simulated,chosen),measured=isSimulation?simulated[chosen]:actual;
 const data=model(a,m,s,b,measured),t=data.sums,code=a.excelCode||chosen;
 const item=r=>{
  const editable=r.index!==null;
  const cell=(field,value)=>editable?'<input class="bat-w-input" type="number" min="0" step=".001" data-row="'+r.index+'" data-field="'+field+'" value="'+value+'" aria-label="'+esc(field+' de '+r.label)+'">':dec(value);
  return '<tr><td>'+esc(code)+'</td><td>'+esc(r.type)+'</td><td>'+esc(r.code)+'</td><td style="min-width:220px">'+esc(r.label)+'</td>'+
   '<td>'+esc(r.unit)+'</td><td class="bat-w-num">'+cell('qty',r.base)+'</td><td class="bat-w-num">'+cell('waste',r.waste)+'</td>'+
   '<td class="bat-w-num"><b>'+dec(r.amount)+'</b></td><td class="bat-w-num">'+money(r.price)+
    (r.resourceId?'<button type="button" class="bat-w-button" style="display:block;margin-top:3px" data-price="'+esc(r.resourceId)+'">Editar</button>':'')+
    '</td><td class="bat-w-num"><b>'+money(r.subtotal)+'</b></td><td class="bat-w-num">'+(measured?dec(measured):'—')+'</td>'+
    '<td class="bat-w-num">'+(measured?dec(r.total):'—')+'</td><td style="min-width:230px">'+esc(r.note)+'</td></tr>';
 };
 const totalRow=(label,val,color)=>'<tr style="background:'+color+';font-weight:800"><td></td><td colspan="8">'+esc(label)+'</td><td class="bat-w-num">'+money(val)+'</td><td colspan="3"></td></tr>';
 const card=(label,val)=>'<div class="bat-w-card"><small>'+label+'</small><strong>'+money(val)+'</strong></div>';
 const group=(title,types)=>{
  const filtered=data.rows.filter(r=>types.includes(r.type));
  return '<div class="bat-w-simple-group"><h4 style="font-size:13px;font-weight:900;margin-bottom:7px">'+esc(title)+'</h4>'+
   (filtered.length?filtered.map(r=>'<div class="bat-w-simple-line"><div><b>'+esc(r.label)+'</b><div class="bat-w-hint">'+esc(r.code)+' · '+dec(r.amount)+' '+esc(r.unit)+' por '+esc(a.unit||'unidad')+'</div></div><b style="white-space:nowrap">'+money(r.subtotal)+'</b></div>').join(''):'<p class="bat-w-hint">No hay recursos en esta categoría.</p>')+'</div>';
 };
 const easyMarkup='<div class="bat-w-simple-hero"><div style="font-size:12px;color:#cbd5e1">2. Precio de este trabajo, sin IVA</div><strong>'+money(t.net)+' <span style="font-size:12px;color:#cbd5e1">/ '+esc(a.unit||'unidad')+'</span></strong>'+
  '<div style="font-size:12px;color:#cbd5e1">Precio final con IVA: <b style="color:#fff">'+money(t.gross)+'</b> por '+esc(a.unit||'unidad')+'</div></div>'+
  (measured>0?'<div class="bat-w-simple-group" style="background:#eff6ff;margin-top:10px"><div class="bat-w-hint">Precio neto por '+dec(measured)+' '+esc(a.unit||'un')+' de este trabajo</div><div class="bat-w-simple-price">'+money(t.net*measured)+'</div><p class="bat-w-hint">'+(isSimulation?'Simulación: no cambia el proyecto 3D.':'Metrado obtenido del modelo 3D.')+'</p></div>':'')+
  '<h4 style="font-size:14px;font-weight:900;margin:16px 0 8px">3. ¿Qué incluye el precio?</h4>'+
  '<div class="bat-w-simple-grid">'+group('Materiales',['Material','Revisar'])+group('Mano de obra',['Mano de obra'])+group('Equipos y herramientas',['Equipo'])+
  '<div class="bat-w-simple-group" style="background:#f8fafc"><h4 style="font-size:13px;font-weight:900;margin-bottom:8px">Resumen del precio</h4>'+
  [['Materiales',t.materials],['Instalación',t.labor],['Herramientas/equipos',t.equipment],['Gastos generales',t.overhead],['Utilidad',t.profit]].map(pair=>'<div class="bat-w-simple-line"><span>'+esc(pair[0])+'</span><b>'+money(pair[1])+'</b></div>').join('')+
  '<div class="bat-w-simple-line" style="font-weight:900;color:#047857"><span>Precio neto</span><b>'+money(t.net)+'</b></div></div></div>'+
  '<div style="background:#f8fafc;border-radius:10px;padding:12px;margin-top:12px" class="bat-w-hint">Los precios son referenciales. Cambiar el metrado de arriba solo simula un valor; para cambiar materiales, mermas o rendimientos entra en «Planilla técnica».</div>';
 target.innerHTML='<div class="bat-worksheet"><aside><div style="padding:12px;background:#f1f5f9"><b>Selecciona una partida</b><input id="bat-w-search" value="'+esc(query)+'" placeholder="Buscar P01, WC, piso…" style="margin-top:8px;width:100%;padding:8px;border:1px solid #cbd5e1;border-radius:8px"></div><div class="bat-w-list" id="bat-w-list">'+choices(m)+'</div></aside>'+
 '<section><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:10px"><div><b style="color:#b45309;font-size:12px">'+esc(code)+' · ANÁLISIS DE PRECIO UNITARIO</b><h3 style="font-size:18px;font-weight:900;margin:6px 0">'+esc(name(a))+'</h3><div class="bat-w-hint">Precio por '+esc(a.unit||'unidad')+' · Maestro APU del proyecto</div></div>'+
 '<div style="display:flex;align-items:center;gap:9px;flex-wrap:wrap"><button type="button" class="bat-w-action" data-toggle-mode>'+ (simpleMode?'Ver planilla técnica':'Volver a vista simple') +'</button></div></div>'+ 
 (simpleMode?'':'<div class="bat-w-hint" style="background:#eff6ff;border-radius:8px;padding:10px;margin-bottom:10px"><b>Cómo leerlo:</b> cantidad con pérdida = cantidad base × (1 + merma %). Subtotal = cantidad con pérdida × precio del recurso. La mano de obra se convierte en jornadas según rendimiento de la cuadrilla.</div>')+
 '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px"><label style="font-size:12px"><b>4. ¿Cuántas unidades necesitas?</b> <input id="bat-w-meter" type="number" min="0" step=".01" value="'+measured+'" style="width:98px;border:1px solid #94a3b8;border-radius:6px;padding:7px"></label><span class="bat-w-hint">'+(isSimulation?'Simulación: no cambia el diseño.':actual>0?'Obtenido del modelo 3D.':'No está incluida en el modelo; puedes simularla.')+'</span>'+
 (isSimulation?'<button class="bat-w-button" id="bat-w-reset">Restaurar metrado 3D</button>':'')+'</div>'+
 (data.missing?'<div class="bat-w-warning">Hay recursos sin valor. Revisa sus precios antes de enviar una cotización.</div>':'')+
 (data.variance>3?'<div class="bat-w-warning">El subtotal de recursos difiere del costo directo '+money(data.variance)+'. Revisar rendimiento y cuadrilla.</div>':'')+
 (simpleMode?easyMarkup:'')+'<div class="bat-w-sheet" style="'+(simpleMode?'display:none':'')+'" tabindex="0" role="region" aria-label="Planilla de precios unitarios"><table class="bat-w-table">'+
 '<thead><tr><th>Partida</th><th>Tipo</th><th>Cód. recurso</th><th>Descripción</th><th>Unidad</th><th>Cantidad base</th><th>Pérdida %</th><th>Cantidad con pérdida</th><th>Precio unitario neto</th><th>Subtotal neto</th><th>Metrado partida</th><th>Cantidad total obra</th><th>Nota / base de cálculo</th></tr></thead><tbody>'+
 data.rows.map(item).join('')+
 totalRow('COSTO DIRECTO',t.direct,'#e2e8f0')+
 totalRow('Gastos generales',t.overhead,'#f1f5f9')+
 totalRow('Utilidad',t.profit,'#f1f5f9')+
 totalRow('PRECIO UNITARIO NETO ('+esc(a.unit||'un')+')',t.net,'#dcfce7')+
 totalRow('PRECIO UNITARIO CON IVA ('+esc(a.unit||'un')+')',t.gross,'#bbf7d0')+
 '</tbody></table></div>'+
 '<div class="bat-w-cards" style="margin-top:12px;'+(simpleMode?'display:none':'')+'">'+card('Materiales',t.materials)+card('Mano de obra',t.labor)+card('Equipos y herramientas',t.equipment)+card('Costo directo',t.direct)+card('Precio de venta neto',t.net)+card('Precio con IVA',t.gross)+'</div>'+
 (measured>0?'<div class="bat-w-card" style="margin-top:10px;background:#eff6ff"><small>Precio neto de esta partida × '+dec(measured)+' '+esc(a.unit||'un')+'</small><strong>'+money(t.net*measured)+'</strong></div>':'')+
 (simpleMode?'':'<div class="bat-w-hint" style="margin-top:12px">Las cantidades se pueden editar en la tabla. Cambiar un precio maestro modifica todos los APU donde aparece. Los valores son referenciales y requieren validación técnica y actualización de proveedor.</div>')+
 (simpleMode?'':'<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:10px;flex-wrap:wrap"><button class="bat-w-button" data-technical="partidas">Ver cuadrilla y estructura</button><button class="bat-w-button" data-technical="recursos">Maestro de precios</button></div>')+
 '</section></div>';
}
function show(){
 if(!ensure())return;
 for(const id of ['apu-view-partidas','apu-view-recursos','apu-view-excel-editor'])document.getElementById(id)?.classList.add('hidden');
 document.getElementById('apu-view-spreadsheet').classList.remove('hidden');
 document.querySelectorAll('#apu-master-modal .apu-tab').forEach(t=>t.classList.remove('active'));
 document.getElementById('apu-tab-spreadsheet')?.classList.add('active');
 render();
}
function ensure(){
 const modal=document.getElementById('apu-master-modal');if(!modal)return false;
 if(!document.getElementById('bat-w-style')){const st=document.createElement('style');st.id='bat-w-style';st.textContent=css;document.head.appendChild(st);}
 let panel=document.getElementById('apu-view-spreadsheet');
 if(!panel){panel=document.createElement('section');panel.id='apu-view-spreadsheet';panel.className='hidden';panel.innerHTML='<div id="bat-w-root"></div>';modal.querySelector('.modal-body')?.appendChild(panel);}
 if(!document.getElementById('apu-tab-spreadsheet')){
  const btn=document.createElement('button');btn.className='apu-tab';btn.id='apu-tab-spreadsheet';btn.textContent='APU · Planilla';btn.onclick=show;modal.querySelector('.px-5.py-3.border-b')?.prepend(btn);
 }
 const host=document.getElementById('bat-w-root');
 if(host&&!host.dataset.events){
  host.dataset.events='1';
  host.addEventListener('input',ev=>{if(ev.target.id==='bat-w-search'){query=ev.target.value;host.querySelector('#bat-w-list').innerHTML=choices(master());}});
  host.addEventListener('change',ev=>{
   const el=ev.target;
   if(el.id==='bat-w-meter'){simulated[chosen]=pos(el.value);render();return;}
   if(!el.dataset.field)return;
   const value=Number(el.value);if(!Number.isFinite(value)||value<0){root.alert('Ingresa una cantidad válida.');render();return;}
   root.updateApuComponent?.(chosen,Number(el.dataset.row),el.dataset.field,value);render();
  });
  host.addEventListener('click',ev=>{
   const btn=ev.target.closest('button');if(!btn)return;
   if(btn.hasAttribute('data-toggle-mode')){simpleMode=!simpleMode;render();return;}
   if(btn.dataset.apu){chosen=btn.dataset.apu;render();return;}
   if(btn.id==='bat-w-reset'){delete simulated[chosen];render();return;}
   if(btn.dataset.technical){root.showApuTab?.(btn.dataset.technical);return;}
   if(btn.dataset.price){
    const id=btn.dataset.price,r=master()?.resources?.[id];if(!r)return;
    const raw=root.prompt('Precio neto por '+r.unit+' de '+r.name+'. Este cambio afectará todos los APU que usen el recurso.',Math.round(pos(r.price)).toString());
    if(raw===null)return;const val=Number(raw);
    if(!Number.isFinite(val)||val<0){root.alert('Precio inválido.');return;}
    if(!root.confirm('¿Actualizar el precio maestro de este recurso en todos los APU?'))return;
    root.updateApuResourcePrice?.(id,val);render();
   }
  });
 }
 return true;
}
function init(){
 if(!ensure()||!master()?.apus?.['excel:P01']||!breakdown('excel:P01')||typeof root.openApuMaster!=='function'||typeof root.showApuTab!=='function')return false;
 if(!root.openApuMaster.__spreadsheet){
  const old=root.openApuMaster;root.openApuMaster=function(){const r=old.apply(this,arguments);show();return r;};root.openApuMaster.__spreadsheet=true;
 }
 if(!root.showApuTab.__spreadsheet){
  const old=root.showApuTab;root.showApuTab=function(){document.getElementById('apu-view-spreadsheet')?.classList.add('hidden');document.getElementById('apu-tab-spreadsheet')?.classList.remove('active');return old.apply(this,arguments);};root.showApuTab.__spreadsheet=true;
 }
 const excel=document.getElementById('apu-tab-excel-editor');
 if(excel&&!excel.dataset.spreadsheet){excel.dataset.spreadsheet='1';excel.addEventListener('click',()=>{document.getElementById('apu-view-spreadsheet')?.classList.add('hidden');document.getElementById('apu-tab-spreadsheet')?.classList.remove('active');});}
 return true;
}
root.BAT_APU_SPREADSHEET={version:1,model,show};
if(typeof module==='object'&&module.exports)module.exports={model};
if(typeof document!=='undefined'){let tries=0;const timer=setInterval(()=>{tries++;if(init()||tries>160)clearInterval(timer);},100);}
})(typeof window!=='undefined'?window:globalThis);
