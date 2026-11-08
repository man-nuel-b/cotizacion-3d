/* BAT-Kubiqueitor | Canalizaciones parametricas orientadas por caras A/B/C/D.
 * Prediseno comercial. Tramos estan sobre los muros y el cielo, y se
 * fusionan por circuito para no duplicar una canalizacion compartida.
 * NO es calculo normativo, ni red electrica ejecutiva, ni APU adicional.
 */
(function(root){
'use strict';
if(root.BAT_KUBIQUEITOR_ROUTING_ENGINE)return;
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const round=v=>Math.round(v*10000)/10000;
const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
const round2=v=>Math.round(v*100)/100;
const validFace=f=>['A','B','C','D'].includes(f);
const xyz=p=>({x:round(p.x),y:round(p.y),z:round(p.z)});
const same=(a,b)=>Math.abs(a.x-b.x)<.0001&&Math.abs(a.y-b.y)<.0001&&Math.abs(a.z-b.z)<.0001;
const length=(a,b)=>Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z);
function boardDefaults(){return {face:'A',x:0,height:1.55,width:.42,cabinetHeight:.55,depth:.14,modules:12};}
function conduitDefaults(){return {material:'emt',diameterMm:20,preference:'shortest',additionalPct:0};}
function validateBoard(b,c){
 const r={...boardDefaults(),...(b||{})};
 const errors=[];
 if(!validFace(r.face))errors.push('Cara de tablero invalida.');
 const L=Number(c?.length),W=Number(c?.width),H=Number(c?.height);
 if(![L,W,H].every(x=>Number.isFinite(x)&&x>1))errors.push('Dimensiones del modulo invalidas.');
 if(errors.length)return {ok:false,errors};
 const span=['A','B'].includes(r.face)?L:W;
 for(const k of ['x','height','width','cabinetHeight','depth'])if(!finite(r[k]))errors.push('Valor invalido de tablero: '+k);
 if(Number.isInteger(r.modules)===false||r.modules<4||r.modules>72)errors.push('Modulos del tablero fuera de rango.');
 if(errors.length)return {ok:false,errors};
 if(r.width<.25||r.width>.90||r.cabinetHeight<.35||r.cabinetHeight>1.15||r.depth<.08||r.depth>.30)
  errors.push('Tamaño del tablero fuera de rango.');
 if(Math.abs(r.x)+r.width/2>span/2-.08)errors.push('Tablero sobrepasa borde de muro.');
 if(r.height-r.cabinetHeight/2<.1||r.height+r.cabinetHeight/2>H-.08)errors.push('Altura del tablero no cabe en el muro.');
 return {ok:errors.length===0,board:r,errors};
}
function validateConduit(input){
 const d={...conduitDefaults(),...(input||{})},errors=[];
 if(!['emt','pvc'].includes(d.material))errors.push('Material de canalizacion desconocido.');
 if(![16,20,25,32,40].includes(d.diameterMm))errors.push('Diametro nominal no soportado.');
 if(!['shortest','clockwise','counterclockwise'].includes(d.preference))errors.push('Preferencia de trazado invalida.');
 if(!finite(d.additionalPct)||d.additionalPct<0||d.additionalPct>30)errors.push('Porcentaje adicional fuera de rango.');
 return {ok:errors.length===0,conduit:d,errors};
}
function facePoint(face,offset,c){
 const L=c.length/2-.09,W=c.width/2-.09;
 if(face==='A')return {x:clamp(offset,-L,L),z:W};
 if(face==='B')return {x:clamp(offset,-L,L),z:-W};
 if(face==='C')return {x:L,z:clamp(offset,-W,W)};
 return {x:-L,z:clamp(offset,-W,W)};
}
function perimeterIndex(face,offset,c){
 const L=c.length-.18,W=c.width-.18,halfL=L/2,halfW=W/2;
 const p=facePoint(face,offset,c);
 if(face==='A')return p.x+halfL;
 if(face==='C')return L+(halfW-p.z);
 if(face==='B')return L+W+(halfL-p.x);
 return 2*L+W+(p.z+halfW);
}
function fromPerimeter(s,c){
 const L=c.length-.18,W=c.width-.18,P=2*(L+W);
 let t=((s%P)+P)%P;
 if(t<=L)return {x:-L/2+t,z:W/2};
 t-=L;
 if(t<=W)return {x:L/2,z:W/2-t};
 t-=W;
 if(t<=L)return {x:L/2-t,z:-W/2};
 t-=L;return {x:-L/2,z:-W/2+t};
}
function perimeterWalk(start,end,c,preference='shortest'){
 const L=c.length-.18,W=c.width-.18,P=2*(L+W),s=perimeterIndex(start.face,start.x,c),e=perimeterIndex(end.face,end.x,c);
 let cw=(e-s+P)%P,ccw=P-cw;
 if(preference==='clockwise')ccw=Infinity;
 if(preference==='counterclockwise')cw=Infinity;
 const clockwise=cw<=ccw,step=clockwise?1:-1;
 let distance=clockwise?cw:ccw;
 const corners=[0,L,L+W,2*L+W,P];
 const stops=[];
 for(const t of corners){
  const delta=clockwise?(t-s+P)%P:(s-t+P)%P;
  if(delta>.0001&&delta<distance-.0001)stops.push({delta,t});
 }
 stops.sort((a,b)=>a.delta-b.delta);
 const vertices=[fromPerimeter(s,c),...stops.map(x=>fromPerimeter(x.t,c)),fromPerimeter(e,c)];
 return {vertices,distance:round2(distance),direction:clockwise?'clockwise':'counterclockwise'};
}
function pointOnBoundary(pos,c){
 if(!pos||!finite(pos.x)||!finite(pos.z))return null;
 const faces=['A','B','C','D'],choices=faces.map(face=>{
  const p=face==='A'?{face,x:pos.x,dist:Math.abs((c.width/2-.09)-pos.z)}:
   face==='B'?{face,x:pos.x,dist:Math.abs((-c.width/2+.09)-pos.z)}:
   face==='C'?{face,x:pos.z,dist:Math.abs((c.length/2-.09)-pos.x)}:
   {face,x:pos.z,dist:Math.abs((-c.length/2+.09)-pos.x)};
  return p;
 });
 choices.sort((a,b)=>a.dist-b.dist);
 return choices[0];
}
function simplify(vertices){
 const v=vertices.map(xyz).filter((p,i,a)=>i===0||!same(p,a[i-1]));
 for(let i=v.length-2;i>0;i--){
  const a=v[i-1],b=v[i],c=v[i+1];
  const x1=b.x-a.x,y1=b.y-a.y,z1=b.z-a.z;
  const x2=c.x-b.x,y2=c.y-b.y,z2=c.z-b.z;
  const cross=Math.hypot(y1*z2-z1*y2,z1*x2-x1*z2,x1*y2-y1*x2);
  const dot=x1*x2+y1*y2+z1*z2;
  if(cross<.00001&&dot>=0)v.splice(i,1);
 }
 return v;
}
function routeOne(board,point,c,opts={}){
 const v=validateBoard(board,c),conduit=validateConduit(opts);
 if(!v.ok||!conduit.ok)return {ok:false,errors:[...v.errors,...conduit.errors]};
 if(!point)return {ok:false,errors:['Punto sin posicion editable']};
 const roof=c.height-.18;
 const startFace={face:v.board.face,x:v.board.x};
 let endFace;
 if(point.face==='ceiling'){
  if(!finite(point.x)||!finite(point.z))return {ok:false,errors:['Luminaria sin posicion']};
  endFace=pointOnBoundary(point,c);
 }else if(validFace(point.face)&&finite(point.x))endFace={face:point.face,x:point.x};
 else return {ok:false,errors:['Cara o posicion del punto no valida']};
 const path=perimeterWalk(startFace,endFace,c,conduit.conduit.preference);
 const start=facePoint(startFace.face,startFace.x,c);
 const end=facePoint(endFace.face,endFace.x,c);
 const boardY=v.board.height;
 const finishY=point.face==='ceiling'?c.height-.12:finite(point.y)?point.y:1;
 const verts=[{...start,y:boardY},{...start,y:roof},
  ...path.vertices.map(p=>({...p,y:roof}))];
 if(point.face==='ceiling'){
  // Advance in orthogonal segments over the ceiling, then finish at luminaire.
  verts.push({x:point.x,y:roof,z:end.z},{x:point.x,y:roof,z:point.z},{x:point.x,y:finishY,z:point.z});
 }else verts.push({...end,y:finishY});
 const vertices=simplify(verts);
 const segments=[];
 for(let i=1;i<vertices.length;i++)segments.push({a:vertices[i-1],b:vertices[i]});
 return {ok:true,vertices,segments,routeMeters:round2(segments.reduce((sum,s)=>sum+length(s.a,s.b),0)),direction:path.direction,errors:[]};
}
function axisSegment(s,circuitId){
 const a=s.a,b=s.b,axes=['x','y','z'],diff=axes.filter(k=>Math.abs(a[k]-b[k])>.0001);
 if(diff.length!==1)return null;
 const axis=diff[0],fixed=axes.filter(k=>k!==axis);
 const key=[circuitId,axis,...fixed.map(k=>round(a[k]))].join('|');
 return {key,axis,fixed:Object.fromEntries(fixed.map(k=>[k,round(a[k])])),start:round(Math.min(a[axis],b[axis])),end:round(Math.max(a[axis],b[axis])),circuitId};
}
function mergeSegments(routes){
 const groups=new Map(),invalid=[];
 for(const r of routes)for(const seg of r.segments){
  const item=axisSegment(seg,r.circuitId);
  if(!item){invalid.push(seg);continue;}
  if(!groups.has(item.key))groups.set(item.key,[]);
  groups.get(item.key).push(item);
 }
 const merged=[];
 for(const entries of groups.values()){
  entries.sort((a,b)=>a.start-b.start);
  let cur={...entries[0]};
  for(const item of entries.slice(1)){
   if(item.start<=cur.end+.0001)cur.end=Math.max(cur.end,item.end);
   else{merged.push(cur);cur={...item};}
  }
  merged.push(cur);
 }
 const segments=merged.map(m=>{
  const a={...m.fixed,[m.axis]:m.start},b={...m.fixed,[m.axis]:m.end};
  return {a,b,length:round2(m.end-m.start),circuitId:m.circuitId};
 });
 return {segments,totalMeters:round2(segments.reduce((sum,x)=>sum+x.length,0)),invalidSegments:invalid.length};
}
function buildPlan(model,container,positions=[]){
 const e=model?.electrical||{},points=Array.isArray(e.points)?e.points:[],
  circuits=Array.isArray(e.circuits)&&e.circuits.length?e.circuits:[{id:'L1',kind:'lighting'},{id:'E1',kind:'outlets'},{id:'F1',kind:'power'}];
 const board=validateBoard(e.board,container),conduit=validateConduit(e.conduit),errors=[...board.errors,...conduit.errors];
 const routes=[];
 if(board.ok&&conduit.ok){
  points.forEach((p,i)=>{
   const path=routeOne(board.board,positions[i],container,conduit.conduit);
   if(!path.ok){errors.push('Punto '+(i+1)+': '+path.errors.join(', '));return;}
   const circuitId=p?.circuitId||(p?.type==='switch'||p?.type==='light'?'L1':p?.type==='acPoint'?'F1':'E1');
   routes.push({...path,index:i,pointId:p?.id||String(i),circuitId});
  });
 }
 const shared=mergeSegments(routes);
 if(shared.invalidSegments)errors.push('Hay tramos no ortogonales pendientes de trazar.');
 const perCircuit=circuits.map(c=>({id:c.id,name:String(c.name||c.id),
  meters:round2(shared.segments.filter(s=>s.circuitId===c.id).reduce((sum,s)=>sum+s.length,0)),
  points:points.filter(p=>(p?.circuitId||(p?.type==='light'||p?.type==='switch'?'L1':p?.type==='acPoint'?'F1':'E1'))===c.id).length}));
 const pct=conduit.ok?conduit.conduit.additionalPct:0;
 return {version:2,board:board.board||null,conduit:conduit.conduit||null,routes,
  sharedSegments:shared.segments,individualMeters:round2(routes.reduce((sum,r)=>sum+r.routeMeters,0)),
  netConduitMeters:shared.totalMeters,referenceAllowanceMeters:round2(shared.totalMeters*(1+pct/100)),
  perCircuit,errors,hasPendingReview:points.length>0,
  disclaimer:'Medicion preliminar de recorrido superficial ortogonal. No es metraje de ejecucion ni presupuesto adicional; homologar con un instalador autorizado SEC.'};
}
const api=Object.freeze({version:2,boardDefaults,conduitDefaults,validateBoard,validateConduit,facePoint,perimeterWalk,routeOne,mergeSegments,buildPlan});
root.BAT_KUBIQUEITOR_ROUTING_ENGINE=api;
if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
