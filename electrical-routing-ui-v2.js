/* BAT-Kubiqueitor | tablero paramétrico y canalización 3D preliminar.
   Conserva editor de puntos y circuitos existente. No suma costos adicionales.
*/
(function(root){
'use strict';
if(root.BAT_KUBIQUEITOR_ROUTING_UI)return;
const engine=()=>root.BAT_KUBIQUEITOR_ROUTING_ENGINE;
const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&#39;'}[ch]));
let visible=false,group=null,parent=null;
const styles='.bat-route-v2{margin-top:10px;background:#fff;border:1px solid #cbd5e1;border-radius:12px;padding:12px;font-size:12px;color:#0f172a}.bat-route-v2 h4{font-size:14px;font-weight:900}.bat-route-v2 p{font-size:11px;color:#64748b;line-height:1.5;margin:6px 0}.bat-route-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.bat-route-fields label{font-size:11px;font-weight:750}.bat-route-fields input,.bat-route-fields select{display:block;width:100%;padding:7px;margin-top:4px;background:white;border:1px solid #cbd5e1;border-radius:8px}.bat-route-v2 button{border-radius:9px;background:#0f172a;color:#fff;padding:9px 12px;font-weight:850}.bat-route-v2 .bat-route-warn{background:#fffbeb;border:1px solid #fcd34d;padding:9px;border-radius:9px;margin-top:9px;font-size:11px;color:#92400e}@media(max-width:650px){.bat-route-fields{grid-template-columns:1fr}}';
function electrical(){
 if(typeof state==='undefined'||typeof ensureElectricalStateForEditor!=='function')return null;
 const e=ensureElectricalStateForEditor();
 if(!e.board)e.board=engine().boardDefaults();
 if(!e.conduit)e.conduit=engine().conduitDefaults();
 return e;
}
function positions(e){
 return e.points.map((_,i)=>{try{return actualLayout('electrical',i);}catch(_){return null;}});
}
function snapshot(){
 const e=electrical();if(!e||typeof DATA==='undefined')return null;
 return engine().buildPlan(state,DATA.containers[state.container],positions(e));
}
function clean(){
 if(group&&parent){parent.remove(group);group.traverse(obj=>{obj.geometry?.dispose?.();obj.material?.dispose?.();});}
 group=null;parent=null;
}
function draw(){
 clean();
 if(!visible||typeof THREE==='undefined'||typeof containerGroup==='undefined'||!containerGroup)return;
 const plan=snapshot();if(!plan||!plan.board||plan.errors.length)return;
 const g=new THREE.Group();g.name='prediseno-canalizaciones-no-ejecutivo';
 const colors={L1:0xfacc15,E1:0x38bdf8,F1:0xfb923c};
 // One tube for each shared segment, avoiding duplicated geometry within circuit.
 for(const segment of plan.sharedSegments){
  if(segment.length<.005)continue;
  const a=new THREE.Vector3(segment.a.x,segment.a.y,segment.a.z);
  const b=new THREE.Vector3(segment.b.x,segment.b.y,segment.b.z);
  const vector=b.clone().sub(a);
  const geometry=new THREE.CylinderGeometry(.012,.012,vector.length(),7);
  const material=new THREE.MeshStandardMaterial({color:colors[segment.circuitId]||0x86efac,transparent:true,opacity:.85,roughness:.6});
  const tube=new THREE.Mesh(geometry,material);
  tube.position.copy(a).add(b).multiplyScalar(.5);
  tube.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),vector.normalize());
  tube.userData.electricalPreliminary=true;
  g.add(tube);
 }
 const board=plan.board,c=DATA.containers[state.container];
 const p=engine().facePoint(board.face,board.x,c);
 const cover=new THREE.Mesh(
  new THREE.BoxGeometry(board.width,board.cabinetHeight,board.depth),
  new THREE.MeshStandardMaterial({color:0xe2e8f0,metalness:.28,roughness:.36})
 );
 if(board.face==='A'||board.face==='B'){
  cover.position.set(p.x,board.height,p.z+(board.face==='A'?-board.depth/2:board.depth/2));
 }else{
  cover.rotation.y=Math.PI/2;
  cover.position.set(p.x+(board.face==='C'?-board.depth/2:board.depth/2),board.height,p.z);
 }
 cover.name='tablero-parametrico-referencial';cover.userData.electricalPreliminary=true;g.add(cover);
 containerGroup.add(g);parent=containerGroup;group=g;
}
function change(field,value){
 const e=electrical();if(!e)return;
 const boardField=['face','x','height','width','cabinetHeight','depth','modules'].includes(field);
 const current=boardField?{...engine().boardDefaults(),...e.board}:{...engine().conduitDefaults(),...e.conduit};
 let next=value;
 if(!['face','material','preference'].includes(field))next=Number(value);
 if(!Number.isFinite(next)&&typeof next==='number')return;
 const candidate={...current,[field]:next};
 const result=boardField?engine().validateBoard(candidate,DATA.containers[state.container]):engine().validateConduit(candidate);
 if(!result.ok){root.alert(result.errors.join(' '));render();return;}
 if(typeof pushHistory==='function')pushHistory();
 if(boardField)e.board=result.board;else e.conduit=result.conduit;
 draw();render();
 if(root.BAT_KUBIQUEITOR_ELECTRICAL_CIRCUITS_UI?.refresh)root.BAT_KUBIQUEITOR_ELECTRICAL_CIRCUITS_UI.refresh();
}
function render(){
 const target=document.getElementById('bat-electrical-routing-v2'),plan=snapshot();if(!target||!plan)return;
 const b=plan.board||engine().boardDefaults(),d=plan.conduit||engine().conduitDefaults();
 const select=(options,current)=>options.map(item=>'<option value="'+esc(item[0])+'" '+(item[0]===current?'selected':'')+'>'+esc(item[1])+'</option>').join('');
 const field=(key,label,value,min,max,step)=>'<label>'+label+'<input type="number" data-route-field="'+key+'" value="'+esc(value)+'" min="'+min+'" max="'+max+'" step="'+step+'"></label>';
 const boardFace='<label>Cara de tablero<select data-route-field="face">'+select([['A','A'],['B','B'],['C','C'],['D','D']],b.face)+'</select></label>';
 const circuitRows=plan.perCircuit.map(c=>'<div>'+esc(c.name)+': <b>'+c.meters.toFixed(2)+' m</b> <small>('+c.points+' puntos)</small></div>').join('');
 target.innerHTML='<h4><i class="fa-solid fa-diagram-project"></i> Tablero y canalizaciones</h4>'+
 '<p>Medición preliminar sobre muros y cielo. Los tramos comunes de un mismo circuito se contabilizan una sola vez. No incluye cables, curvas, cajas ni protecciones por inferencia.</p>'+
 '<div class="bat-route-fields">'+boardFace+field('x','Ubicación horizontal (m)',b.x,-12,12,.05)+field('height','Centro del tablero (m)',b.height,.5,3,.05)+field('width','Ancho del tablero (m)',b.width,.25,.90,.01)+field('cabinetHeight','Alto del tablero (m)',b.cabinetHeight,.35,1.15,.01)+field('depth','Fondo (m)',b.depth,.08,.30,.01)+field('modules','Capacidad nominal (módulos)',b.modules,4,72,1)+
 '<label>Canalización<select data-route-field="material">'+select([['emt','Metálica EMT (referencia)'],['pvc','PVC (referencia)']],d.material)+'</select></label>'+
 '<label>Diámetro nominal (mm)<select data-route-field="diameterMm">'+select([[16,'16'],[20,'20'],[25,'25'],[32,'32'],[40,'40']],d.diameterMm)+'</select></label>'+
 '<label>Sentido de trazado<select data-route-field="preference">'+select([['shortest','Más corto (referencial)'],['clockwise','Sentido horario'],['counterclockwise','Sentido antihorario']],d.preference)+'</select></label>'+
 field('additionalPct','Reserva referencial (%)',d.additionalPct,0,30,1)+'</div>'+
 '<p><b>'+plan.netConduitMeters.toFixed(2)+' m</b> de canalización no duplicada · <b>'+plan.individualMeters.toFixed(2)+' m</b> sumando recorridos independientes · <b>'+plan.referenceAllowanceMeters.toFixed(2)+' m</b> con reserva.</p>'+
 '<div style="line-height:1.6;margin:8px 0">'+circuitRows+'</div>'+
 '<button type="button" data-route-3d>'+ (visible?'Ocultar tablero y tubos 3D':'Mostrar tablero y tubos 3D')+'</button>'+
 '<div class="bat-route-warn">No es trazado eléctrico definitivo ni presupuesto de canalización. Los APU P70/P71/P72 ya contemplan longitudes máximas indicadas en el catálogo. Validar el trazado, cantidad de conductores, diámetros, protecciones, accesibilidad y normativa SEC antes de emitir una oferta final.'+
 (plan.errors.length?'<ul>'+plan.errors.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>':'')+'</div>';
}
function install(){
 if(!engine()||!root.BAT_KUBIQUEITOR_ELECTRICAL_CIRCUITS_UI||typeof renderAll!=='function')return false;
 const anchor=document.getElementById('bat-electrical-circuits');if(!anchor)return false;
 if(!document.getElementById('bat-electrical-routing-style')){
  const css=document.createElement('style');css.id='bat-electrical-routing-style';css.textContent=styles;document.head.appendChild(css);
 }
 if(!document.getElementById('bat-electrical-routing-v2')){
  const panel=document.createElement('div');panel.id='bat-electrical-routing-v2';panel.className='bat-route-v2';
  anchor.insertAdjacentElement('afterend',panel);
  panel.addEventListener('change',ev=>{const f=ev.target?.dataset?.routeField;if(f)change(f,ev.target.value);});
  panel.addEventListener('click',ev=>{
   if(ev.target?.closest?.('[data-route-3d]')){visible=!visible;draw();render();}
  });
 }
 // Wrap after other render hooks; never replace the original 3D rebuilding logic.
 if(!renderAll.__batRouteV2){
  const old=renderAll;
  const wrapped=function(){const result=old.apply(this,arguments);draw();render();return result;};
  wrapped.__batRouteV2=true;renderAll=wrapped;
 }
 root.BAT_KUBIQUEITOR_ROUTING_UI={version:2,draw,snapshot,refresh:render};
 render();return true;
}
if(typeof document!=='undefined'){
 let retries=0;const timer=setInterval(()=>{if(install()||++retries>200)clearInterval(timer);},100);
}
})(typeof window!=='undefined'?window:globalThis);
