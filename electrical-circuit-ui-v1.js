/* BAT-Kubiqueitor · editor de circuitos eléctrico preliminar.
 * Edita el mismo proyecto que alimenta el 3D. No dimensiona protecciones.
 */
(function(root){
'use strict';
if(root.BAT_KUBIQUEITOR_ELECTRICAL_CIRCUITS_UI)return;
const core=()=>root.BAT_KUBIQUEITOR_ELECTRICAL_CORE;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&#39;'}[c]));
const types={light:'Luminaria LED',switch:'Interruptor',outlet:'Enchufe doble',acPoint:'Fuerza A/C'};
let routesVisible=false,lastGroup=null,lastParent=null;
const styleText='.bat-ec{border:1px solid #cbd5e1;background:#f8fafc;border-radius:14px;padding:13px;margin:12px 0;font-size:12px;color:#0f172a}.bat-ec h3{font-size:15px;font-weight:900}.bat-ec p{color:#64748b;font-size:11px;line-height:1.5;margin:8px 0}.bat-ec table{width:100%;border-collapse:collapse;background:white;margin:8px 0}.bat-ec th,.bat-ec td{text-align:left;border-bottom:1px solid #e2e8f0;padding:7px 5px;font-size:11px}.bat-ec input,.bat-ec select{width:100%;padding:7px;border:1px solid #cbd5e1;border-radius:7px;background:#fff;color:#0f172a;font-size:11px}.bat-ec button{padding:9px;background:#0f172a;color:white;border-radius:9px;font-weight:800;font-size:11px}.bat-ec .warnings{border:1px solid #fcd34d;border-radius:9px;background:#fffbeb;padding:10px;color:#92400e}.bat-ec .warnings li{margin-left:17px;list-style:disc;margin-top:4px}.bat-ec .scroll{max-height:320px;overflow:auto}.bat-ec .fields{display:grid;grid-template-columns:1fr 1fr;gap:10px}@media(max-width:700px){.bat-ec .fields{grid-template-columns:1fr}}';
function ensure(){
 if(typeof state==='undefined'||typeof ensureElectricalStateForEditor!=='function')return null;
 const e=ensureElectricalStateForEditor();
 if(!Array.isArray(e.circuits)||!e.circuits.length)e.circuits=core().initialCircuits();
 if(!e.board||typeof e.board!=='object')e.board={face:'A',x:0,height:1.55};
 e.points.forEach(p=>{if(!p.circuitId)p.circuitId=core().baseCircuit(core().canonicalKind(p.type));});
 return e;
}
function snapshot(){
 const e=ensure();if(!e)return null;
 const c=DATA.containers[state.container];
 const positions=e.points.map((p,i)=>{try{return actualLayout('electrical',i);}catch(_){return null;}});
 return core().inspect(state,c,positions);
}
function render(){
 const box=document.getElementById('bat-electrical-circuits'),e=ensure();if(!box||!e)return false;
 const report=snapshot(),lights=e.points.filter(p=>p.type==='light');
 const rows=e.points.map((p,i)=>{
  const options=e.circuits.filter(c=>core().compatible(p.type,c)).map(c=>'<option value="'+esc(c.id)+'" '+(p.circuitId===c.id?'selected':'')+'>'+esc(c.name)+'</option>').join('');
  const lightsOptions='<option value="">Sin asignar</option>'+lights.map(l=>'<option value="'+esc(l.id)+'" '+(p.linkedLightId===l.id?'selected':'')+'>Luminaria '+(e.points.indexOf(l)+1)+'</option>').join('');
  const field=p.type==='switch'?'<select data-point="'+i+'" data-field="linkedLightId">'+lightsOptions+'</select>':
   '<input type="number" min="0.1" max="100000" step="1" placeholder="W pendiente" data-point="'+i+'" data-field="designWatts" value="'+(typeof p.designWatts==='number'&&Number.isFinite(p.designWatts)?p.designWatts:'')+'">';
  return '<tr><td>'+esc(types[p.type]||'Punto')+' '+(i+1)+'</td><td><select data-point="'+i+'" data-field="circuitId">'+options+'</select></td><td>'+field+'</td></tr>';
 }).join('');
 const summary=report.circuits.map(c=>'<tr><td>'+esc(c.name)+'</td><td>'+c.points+'</td><td>'+c.estimatedW+' W'+(c.unconfirmedLoads?' · '+c.unconfirmedLoads+' pendientes':'')+'</td></tr>').join('');
 const board=e.board;
 box.innerHTML='<h3><i class="fa-solid fa-bolt"></i> Circuitos eléctricos · Prediseño</h3>'+
  '<p>Los puntos eléctricos ya se pueden mover en el 3D. Aquí se asignan a circuitos y se vinculan interruptores con luminarias. Las rutas son únicamente esquemáticas.</p>'+
  '<div class="scroll"><table><thead><tr><th>Punto</th><th>Circuito</th><th>Vínculo / potencia</th></tr></thead><tbody>'+rows+'</tbody></table></div>'+
  '<strong>Resumen de circuitos</strong><table><thead><tr><th>Circuito</th><th>Puntos</th><th>Potencia declarada</th></tr></thead><tbody>'+summary+'</tbody></table>'+
  '<div class="fields"><label>Posición del tablero · cara<select data-board="face">'+['A','B','C','D'].map(f=>'<option '+(board.face===f?'selected':'')+'>'+f+'</option>').join('')+'</select></label>'+
  '<label>Posición horizontal del tablero (m)<input data-board="x" type="number" step="0.05" value="'+esc(board.x)+'"></label></div>'+
  '<p><strong>'+report.totalMeters.toLocaleString('es-CL')+' m</strong> de recorrido esquemático total. No es metraje de instalación ni se suma como APU adicional.</p>'+
  '<div style="display:flex;gap:8px;flex-wrap:wrap;margin:10px 0"><button type="button" data-route-toggle>'+(routesVisible?'Ocultar':'Mostrar')+' rutas 3D referenciales</button><button type="button" data-technical>Tablero y tierra P73/P74</button></div>'+
  '<div class="warnings"><b>'+report.errors.length+' errores de vínculo; '+report.warnings.length+' observaciones técnicas</b><ul>'+
  report.issues.slice(0,10).map(x=>'<li>'+esc(x.message)+'</li>').join('')+
  (report.issues.length>10?'<li>Hay '+(report.issues.length-10)+' observaciones adicionales.</li>':'')+'</ul></div>'+
  '<p>La instalación definitiva debe ser revisada por un instalador autorizado SEC. No se calculan automáticamente secciones de cables, protecciones ni circuitos de zonas húmedas.</p>';
 return true;
}
function change(fn){
 if(typeof pushHistory==='function')pushHistory();
 fn();
 if(typeof renderAll==='function')renderAll();
 render();
}
function handleChange(t){
 const e=ensure();if(!e)return;
 if(t.dataset.point!==undefined){
  const i=Number(t.dataset.point),p=e.points[i];if(!p)return;
  const field=t.dataset.field;
  if(field==='circuitId'){
   const c=e.circuits.find(x=>x.id===t.value);
   if(!core().compatible(p.type,c))return;
   change(()=>{p.circuitId=c.id;if(p.type==='switch')p.linkedLightId='';});
  }else if(field==='linkedLightId'){
   if(t.value&&!e.points.some(x=>x.id===t.value&&x.type==='light'))return;
   change(()=>{p.linkedLightId=t.value;});
  }else if(field==='designWatts'){
   const watts=t.value.trim()===''?null:Number(t.value);
   if(watts!==null&&(!Number.isFinite(watts)||watts<=0||watts>100000)){root.alert('Ingresa una potencia válida o déjala pendiente.');render();return;}
   change(()=>{p.designWatts=watts;});
  }
 }else if(t.dataset.board){
  const field=t.dataset.board;
  if(field==='face'){
   if(!['A','B','C','D'].includes(t.value))return;
   change(()=>{e.board.face=t.value;});
  }else if(field==='x'){
   const v=Number(t.value),c=DATA.containers[state.container],span=['A','B'].includes(e.board.face)?c.length:c.width;
   if(!Number.isFinite(v)||Math.abs(v)>span/2-.15){root.alert('Posición fuera de la cara.');render();return;}
   change(()=>{e.board.x=v;});
  }
 }
}
function removeRoutes(){
 if(lastGroup&&lastParent){lastParent.remove(lastGroup);lastGroup.traverse(o=>{o.geometry?.dispose?.();o.material?.dispose?.();});}
 lastGroup=null;lastParent=null;
}
function draw(){
 removeRoutes();
 if(!routesVisible||typeof THREE==='undefined'||typeof containerGroup==='undefined'||!containerGroup)return;
 const report=snapshot();if(!report)return;
 const group=new THREE.Group();group.name='circuitos-esquema-no-ejecutivo';
 const colors={L1:0xeab308,E1:0x38bdf8,F1:0xf97316};
 for(const route of report.routes){
  const geometry=new THREE.BufferGeometry().setFromPoints(route.vertices.map(v=>new THREE.Vector3(v.x,v.y,v.z)));
  const material=new THREE.LineBasicMaterial({color:colors[route.circuitId]||0x22c55e,opacity:.85,transparent:true});
  const line=new THREE.Line(geometry,material);line.userData.referenceOnly=true;group.add(line);
 }
 containerGroup.add(group);lastParent=containerGroup;lastGroup=group;
}
function install(){
 if(!core()||typeof renderAll!=='function'||typeof state==='undefined'||typeof ensureElectricalStateForEditor!=='function')return false;
 const anchor=document.getElementById('electrical-stage1-panel');if(!anchor)return false;
 if(!document.getElementById('bat-electrical-circuits-css')){
  const style=document.createElement('style');style.id='bat-electrical-circuits-css';style.textContent=styleText;document.head.appendChild(style);
 }
 if(!document.getElementById('bat-electrical-circuits')){
  const panel=document.createElement('section');panel.id='bat-electrical-circuits';panel.className='bat-ec';anchor.insertAdjacentElement('afterend',panel);
  panel.addEventListener('change',ev=>{const t=ev.target;if(t.matches('[data-point],[data-board]'))handleChange(t);});
  panel.addEventListener('click',ev=>{
   if(ev.target.closest('[data-route-toggle]')){routesVisible=!routesVisible;draw();render();}
   if(ev.target.closest('[data-technical]')){
    if(root.BAT_KUBIQUEITOR_CONSTRUCTION_RULES?.open)root.BAT_KUBIQUEITOR_CONSTRUCTION_RULES.open();
    else root.alert('Abre Reglas constructivas para configurar tablero P73 y puesta a tierra P74.');
   }
  });
 }
 if(!renderAll.__batElectricalCircuitsWrapped){
  const previous=renderAll;
  const wrapped=function(){const result=previous.apply(this,arguments);draw();render();return result;};
  wrapped.__batElectricalCircuitsWrapped=true;renderAll=wrapped;
 }
 root.BAT_KUBIQUEITOR_ELECTRICAL_CIRCUITS_UI={version:1,snapshot,refresh:render,draw};
 render();draw();return true;
}
if(typeof document!=='undefined'){let tries=0;const timer=setInterval(()=>{if(install()||++tries>180)clearInterval(timer);},100);}
})(typeof window!=='undefined'?window:globalThis);
