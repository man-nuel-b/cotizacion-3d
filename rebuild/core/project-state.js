/* BAT V2: validated, single source of truth for geometry, BOM and costs. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.BatProjectState=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const deepCopy=value=>{
 const json=JSON.stringify(value);
 if(typeof json!=='string')throw new TypeError('Estado no serializable');
 return JSON.parse(json);
};
let sequence=0;
const id=()=> 'item-'+Date.now().toString(36)+'-'+(++sequence).toString(36);
const defaults=()=>({schemaVersion:1,project:{name:'Proyecto modular',container:{length:6.06,width:2.44,height:2.59}},
 openings:[],partitions:[],pricing:{transport:0,overheadPct:15,profitPct:10,taxPct:19,contingencyPct:0},revision:0});
const finite=(value,label)=>{
 if(value===null||value===undefined||value===''||typeof value==='boolean')throw new RangeError(label+' inválido');
 const number=Number(value);
 if(!Number.isFinite(number))throw new RangeError(label+' inválido');
 return number;
};
const positive=(value,label)=>{const n=finite(value,label);if(n<=0||n>1000)throw new RangeError(label+' inválido');return n;};
const nonnegative=(value,label)=>{const n=finite(value,label);if(n<0||n>1e9)throw new RangeError(label+' inválido');return n;};
const overlaps=(a,b)=>Math.min(a[1],b[1])-Math.max(a[0],b[0])>1e-6;
function check(source){
 if(!source||typeof source!=='object'||Array.isArray(source)||source.schemaVersion!==1
   ||!source.project||!source.project.container)throw new Error('Versión de proyecto incompatible');
 const state=deepCopy(source),c=state.project.container;
 const length=positive(c.length,'Longitud'),width=positive(c.width,'Ancho'),height=positive(c.height,'Alto');
 if(!Array.isArray(state.openings)||!Array.isArray(state.partitions)
   ||state.openings.length>200||state.partitions.length>200)throw new Error('Elementos inválidos');
 if(!state.pricing||typeof state.pricing!=='object'||Array.isArray(state.pricing))throw new Error('Precios inválidos');
 if(!Number.isSafeInteger(state.revision)||state.revision<0)throw new Error('Revisión inválida');
 const identifiers=new Set(),byFace={A:[],B:[],C:[],D:[]};
 for(const o of state.openings){
  if(!o||!['window','door'].includes(o.kind)||!['A','B','C','D'].includes(o.face))throw new Error('Abertura inválida');
  if(typeof o.id!=='string'||!o.id||identifiers.has(o.id))throw new Error('Identificador duplicado o inválido');
  identifiers.add(o.id);
  const w=positive(o.width,'Ancho abertura'),h=positive(o.height,'Alto abertura');
  const offset=finite(o.offset,'Posición abertura'),max=['A','B'].includes(o.face)?length:width;
  if(Math.abs(offset)+w/2>max/2+1e-8||h>height+1e-8)throw new RangeError('Abertura fuera del contenedor');
  const interval=[offset-w/2,offset+w/2];
  if(byFace[o.face].some(other=>overlaps(other,interval)))
   throw new RangeError('Aberturas superpuestas en la misma cara');
  byFace[o.face].push(interval);
 }
 const occupiedPartitions=[];
 for(const p of state.partitions){
  if(!p||typeof p.id!=='string'||!p.id||identifiers.has(p.id))throw new Error('Identificador duplicado o inválido');
  identifiers.add(p.id);
  const span=positive(p.length,'Largo tabique'),h=positive(p.height,'Alto tabique');
  const x=finite(p.x,'X tabique'),z=finite(p.z,'Z tabique');
  if(h>height+1e-8||span>length+1e-8||Math.abs(x)+span/2>length/2+1e-8
    ||Math.abs(z)+.04>width/2+1e-8)throw new RangeError('Tabique fuera del contenedor');
  const bounds={x:[x-span/2,x+span/2],z:[z-.04,z+.04]};
  if(occupiedPartitions.some(other=>overlaps(bounds.x,other.x)&&overlaps(bounds.z,other.z)))
   throw new RangeError('Tabiques superpuestos');
  occupiedPartitions.push(bounds);
 }
 for(const [key,value] of Object.entries(state.pricing)){
  const n=nonnegative(value,key);
  if(key.endsWith('Pct')&&n>100)throw new RangeError('Porcentaje fuera de rango');
 }
 for(const key of Object.keys(defaults().pricing))
  if(!Object.prototype.hasOwnProperty.call(state.pricing,key))throw new Error('Precio obligatorio faltante: '+key);
 return state;
}
function reduce(state,action){
 if(!action||typeof action.type!=='string')throw new TypeError('Acción inválida');
 if(action.type==='project/replace')return check(action.project);
 const next=deepCopy(state);
 switch(action.type){
  case 'project/rename':next.project.name=String(action.name||'').slice(0,120);break;
  case 'container/resize':next.project.container={length:positive(action.length,'Longitud'),
   width:positive(action.width,'Ancho'),height:positive(action.height,'Alto')};break;
  case 'opening/add':next.openings.push({id:id(),kind:action.kind,face:action.face,
   width:positive(action.width,'Ancho abertura'),height:positive(action.height,'Alto abertura'),
   offset:action.offset===undefined?0:finite(action.offset,'Posición abertura')});break;
  case 'opening/remove':next.openings=next.openings.filter(o=>o.id!==action.id);break;
  case 'opening/move':{
   const o=next.openings.find(o=>o.id===action.id);if(!o)throw new Error('Abertura no encontrada');
   o.face=action.face===undefined?o.face:action.face;
   o.offset=action.offset===undefined?o.offset:finite(action.offset,'Posición abertura');break;
  }
  case 'partition/add':next.partitions.push({id:id(),length:positive(action.length,'Largo tabique'),
   height:positive(action.height,'Alto tabique'),x:action.x===undefined?0:finite(action.x,'X tabique'),
   z:action.z===undefined?0:finite(action.z,'Z tabique')});break;
  case 'partition/remove':next.partitions=next.partitions.filter(p=>p.id!==action.id);break;
  case 'partition/move':{
   const p=next.partitions.find(p=>p.id===action.id);if(!p)throw new Error('Tabique no encontrado');
   if(action.x!==undefined)p.x=finite(action.x,'X tabique');
   if(action.z!==undefined)p.z=finite(action.z,'Z tabique');break;
  }
  case 'pricing/update':
   if(!Object.prototype.hasOwnProperty.call(next.pricing,action.key))throw new Error('Campo de precio desconocido');
   next.pricing[action.key]=nonnegative(action.value,action.key);break;
  default:throw new Error('Acción no admitida: '+action.type);
 }
 next.revision=state.revision+1;
 return check(next);
}
function createStore(initial=defaults()){
 let state=check(initial);
 const listeners=new Set();
 return Object.freeze({
  getState:()=>deepCopy(state),
  dispatch(action){
   const updated=reduce(state,action);
   state=updated;
   for(const listener of listeners)listener(deepCopy(state),action);
   return deepCopy(state);
  },
  subscribe(listener){
   if(typeof listener!=='function')throw new TypeError('Suscriptor inválido');
   listeners.add(listener);return()=>listeners.delete(listener);
  }
 });
}
return Object.freeze({defaults,check,reduce,createStore});
});