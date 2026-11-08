/* BAT-Kubiqueitor · Planificación eléctrica conceptual por circuitos.
 * NO realiza cálculo de corriente, sección, caída de tensión ni dimensionamiento SEC.
 * No inventa precios ni agrega partidas APU: solo mide y alerta.
 */
(function(root){
'use strict';
if(root.BAT_KUBIQUEITOR_ELECTRICAL_CORE)return;
const DEFAULTS=Object.freeze([
 {id:'L1',kind:'lighting',name:'Iluminación 1'},
 {id:'E1',kind:'outlets',name:'Enchufes generales 1'},
 {id:'F1',kind:'power',name:'Fuerza / equipos 1'}
]);
const KIND={light:'lighting',switch:'lighting',outlet:'outlets',acPoint:'power'};
const r2=x=>Math.round(x*100)/100;
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const n=(x,f=0)=>Number.isFinite(Number(x))?Number(x):f;
const clone=x=>JSON.parse(JSON.stringify(x));
function canonicalKind(type){return KIND[type]||null;}
function baseCircuit(kind){return kind==='lighting'?'L1':kind==='power'?'F1':'E1';}
function initialCircuits(){return clone(DEFAULTS);}
function compatible(type,circuit){return Boolean(circuit&&circuit.kind===canonicalKind(type));}
function boardPosition(board,container){
 const L=n(container?.length),W=n(container?.width),H=n(container?.height),face=['A','B','C','D'].includes(board?.face)?board.face:'A';
 const span=face==='A'||face==='B'?L:W;
 const x=Math.min(span/2-.15,Math.max(-span/2+.15,n(board?.x,-span/2+.4)));
 const y=Math.min(H-.2,Math.max(.5,n(board?.height,1.55)));
 return {face,x,y,world:face==='A'?{x,y,z:W/2-.09}:face==='B'?{x,y,z:-W/2+.09}:face==='C'?{x:L/2-.09,y,z:x}:{x:-L/2+.09,y,z:x}};
}
function pointWorld(layout,container){
 const L=n(container?.length),W=n(container?.width),H=n(container?.height);
 if(!layout)return null;
 const face=layout.face;
 if(face==='ceiling'){
  if(!finite(layout.x)||!finite(layout.z))return null;
  return {x:layout.x,y:H-.12,z:layout.z};
 }
 if(!['A','B','C','D'].includes(face)||!finite(layout.x))return null;
 const y=finite(layout.y)?layout.y:1;
 if(face==='A')return {x:layout.x,y,z:W/2-.09};
 if(face==='B')return {x:layout.x,y,z:-W/2+.09};
 if(face==='C')return {x:L/2-.09,y,z:layout.x};
 return {x:-L/2+.09,y,z:layout.x};
}
// SOLO trayectoria esquemática por cielo; no es canalización ejecutiva.
function referencePath(board,point,container){
 const start=boardPosition(board,container).world,end=pointWorld(point,container);
 if(!end)return null;
 const roof=n(container?.height)-.18;
 const vertices=[
  {...start},{x:start.x,y:roof,z:start.z},
  {x:end.x,y:roof,z:start.z},{x:end.x,y:roof,z:end.z},{...end}
 ];
 let length=0;
 for(let i=1;i<vertices.length;i++){
  const a=vertices[i-1],b=vertices[i];
  length+=Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z);
 }
 return {vertices,length:r2(length)};
}
function inspect(model,container,positions=[]){
 const e=model?.electrical||{},points=Array.isArray(e.points)?e.points:[],circuits=Array.isArray(e.circuits)&&e.circuits.length?e.circuits:initialCircuits();
 const issues=[],routes=[],summary=[],known=new Map(circuits.map(c=>[c.id,c]));
 const ids=new Set(points.map(p=>p?.id).filter(Boolean));
 const byId=new Map(points.filter(p=>p?.id).map(p=>[p.id,p]));
 const add=(code,message,severity='warning')=>issues.push({code,message,severity});
 if(points.length!==Math.max(0,Math.round(n(model?.counts?.electrical))))
  add('COUNT_MISMATCH','La cantidad de puntos del editor no coincide con el circuito.','error');
 if(points.length&&!Boolean(model?.constructionRules?.enabled&&model.constructionRules.board))
  add('BOARD_NOT_PRICED','Confirmar tablero P73 y protecciones: no están incluidos como partida aprobada.');
 if(points.length&&!Boolean(model?.constructionRules?.enabled&&model.constructionRules.ground))
  add('GROUND_NOT_PRICED','Confirmar puesta a tierra y unión equipotencial P74.');
 if(points.length)add('ENGINEERING_PENDING','Circuitos y rutas son preliminares. Un instalador autorizado SEC debe validar protecciones, secciones, demanda, caída de tensión, zonas húmedas y TE-1 según corresponda.');
 if(points.length&&(n(model?.counts?.shower)>0||n(model?.counts?.wc)>0))
  add('WET_AREA_REVIEW','Verificar ubicación de mecanismos y luminarias respecto de zonas húmedas y duchas según RIC N°11.');
 points.forEach((point,index)=>{
  if(!canonicalKind(point?.type)){add('UNKNOWN_POINT','Punto '+(index+1)+' tiene tipo no reconocido.','error');return;}
  const circuitId=point.circuitId||baseCircuit(canonicalKind(point.type));
  const c=known.get(circuitId);
  if(!c||!compatible(point.type,c))add('CIRCUIT_MISMATCH','Punto '+(index+1)+' ('+point.type+') no tiene un circuito compatible.','error');
  if(point.type==='switch'){
   if(!point.linkedLightId)add('SWITCH_NOT_LINKED','Interruptor '+(index+1)+' no tiene luminaria asociada.','error');
   else if(!ids.has(point.linkedLightId)||byId.get(point.linkedLightId)?.type!=='light')
    add('SWITCH_TARGET_INVALID','Interruptor '+(index+1)+' apunta a una luminaria inexistente.','error');
   else if((byId.get(point.linkedLightId).circuitId||'L1')!==circuitId)
    add('SWITCH_CIRCUIT_DIFFERENT','Interruptor '+(index+1)+' y luminaria controlada están en distintos circuitos.','error');
  }else if(!finite(point.designWatts)||point.designWatts<=0){
   add('LOAD_PENDING','Potencia de diseño pendiente para '+(point.type==='light'?'luminaria':point.type==='outlet'?'enchufe':'punto de fuerza')+' '+(index+1)+'.');
  }
  const route=referencePath(e.board,positions[index],container);
  if(route)routes.push({...route,index,pointId:point.id||String(index),circuitId,kind:canonicalKind(point.type)});
  else add('ROUTE_MISSING','No se pudo estimar la ruta del punto eléctrico '+(index+1)+'.');
 });
 for(const circuit of circuits){
  const assigned=points.filter(p=>(p.circuitId||baseCircuit(canonicalKind(p.type)))===circuit.id);
  const w=assigned.reduce((sum,p)=>sum+(p.type==='switch'?0:finite(p.designWatts)&&p.designWatts>0?p.designWatts:0),0);
  const unknown=assigned.filter(p=>p.type!=='switch'&&(!finite(p.designWatts)||p.designWatts<=0)).length;
  const length=r2(routes.filter(r=>r.circuitId===circuit.id).reduce((sum,r)=>sum+r.length,0));
  summary.push({id:circuit.id,kind:circuit.kind,name:String(circuit.name||circuit.id),points:assigned.length,estimatedW:r2(w),unconfirmedLoads:unknown,routeMeters:length});
 }
 const totalMeters=r2(routes.reduce((sum,r)=>sum+r.length,0));
 // P70 incluye conjunto luminaria+interruptor hasta 6 m; P71 8 m y P72 10 m.
 // Estas distancias son geometría conceptual, NO ampliaciones de APU calculadas.
 const ranges={lighting:6,outlets:8,power:10};
 for(const r of routes){
  if(r.length>ranges[r.kind]+.01){
   add('LENGTH_EXCEEDS_APU','Recorrido esquemático '+r.length+' m (punto '+(r.index+1)+') supera referencia '+ranges[r.kind]+' m del APU. Medir e incorporar adicionales, sin duplicar tramo incluido.');
  }
 }
 return {
  version:1,points:points.length,circuits:summary,routes,totalMeters,
  issues,errors:issues.filter(i=>i.severity==='error'),
  warnings:issues.filter(i=>i.severity!=='error'),
  readyForFinalQuote:points.length===0,
  disclaimer:'Pre-diseño de circuitos para cubicación. No es proyecto, plano ejecutivo ni certificación SEC.'
 };
}
const api=Object.freeze({version:1,initialCircuits,canonicalKind,baseCircuit,compatible,boardPosition,pointWorld,referencePath,inspect});
root.BAT_KUBIQUEITOR_ELECTRICAL_CORE=api;
if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
