/* BAT v2: one canonical, serializable project state. No DOM or Three.js dependency. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.BatProjectState=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const deepCopy=value=>JSON.parse(JSON.stringify(value));
const id=()=> 'item-'+Math.random().toString(36).slice(2,10);
const defaults=()=>({schemaVersion:1,project:{name:'Proyecto modular',container:{length:6.06,width:2.44,height:2.59}},openings:[],partitions:[],pricing:{transport:0,overheadPct:15,profitPct:10,taxPct:19,contingencyPct:0},revision:0});
function positive(value,label){const n=Number(value);if(!Number.isFinite(n)||n<=0||n>1000)throw new RangeError(label+' inválido');return n;}
function nonnegative(value,label){const n=Number(value);if(!Number.isFinite(n)||n<0||n>1e9)throw new RangeError(label+' inválido');return n;}
function check(state){
 if(!state||state.schemaVersion!==1||!state.project||!state.project.container)throw new Error('Versión de proyecto incompatible');
 const {length,width,height}=state.project.container;positive(length,'Longitud');positive(width,'Ancho');positive(height,'Alto');
 if(!Array.isArray(state.openings)||!Array.isArray(state.partitions))throw new Error('Elementos inválidos');
 for(const o of state.openings){
  if(!['window','door'].includes(o.kind)||!['A','B','C','D'].includes(o.face))throw new Error('Abertura inválida');
  positive(o.width,'Ancho abertura');positive(o.height,'Alto abertura');
  const max=['A','B'].includes(o.face)?length:width;
  if(Math.abs(o.offset)+o.width/2>max/2+1e-8||o.height>height)throw new RangeError('Abertura fuera del contenedor');
 }
 for(const p of state.partitions){
  positive(p.length,'Largo tabique');positive(p.height,'Alto tabique');
  if(p.height>height)throw new RangeError('Tabique fuera del contenedor');
  if(!Number.isFinite(p.x)||!Number.isFinite(p.z))throw new Error('Posición inválida');
 }
 for(const [key,v] of Object.entries(state.pricing)){nonnegative(v,key);if(key.endsWith('Pct')&&v>100)throw new RangeError('Porcentaje fuera de rango');}
 return state;
}
function reduce(state,action){
 const next=deepCopy(state);
 switch(action.type){
  case 'project/rename': next.project.name=String(action.name||'').slice(0,120);break;
  case 'container/resize': next.project.container={length:positive(action.length,'Longitud'),width:positive(action.width,'Ancho'),height:positive(action.height,'Alto')};break;
  case 'opening/add': next.openings.push({id:id(),kind:action.kind,face:action.face,width:Number(action.width),height:Number(action.height),offset:Number(action.offset||0)});break;
  case 'opening/remove': next.openings=next.openings.filter(o=>o.id!==action.id);break;
  case 'partition/add': next.partitions.push({id:id(),length:Number(action.length),height:Number(action.height),x:Number(action.x||0),z:Number(action.z||0)});break;
  case 'partition/remove': next.partitions=next.partitions.filter(p=>p.id!==action.id);break;
  case 'pricing/update': if(!Object.prototype.hasOwnProperty.call(next.pricing,action.key))throw new Error('Campo de precio desconocido');next.pricing[action.key]=Number(action.value);break;
  case 'project/replace': return check(deepCopy(action.project));
  default: throw new Error('Acción no admitida: '+action.type);
 }
 next.revision=state.revision+1;
 return check(next);
}
function createStore(initial=defaults()){
 let state=check(deepCopy(initial));const listeners=new Set();
 return Object.freeze({getState:()=>deepCopy(state),dispatch(action){const updated=reduce(state,action);state=updated;for(const listener of listeners)listener(deepCopy(state),action);return deepCopy(state);},subscribe(listener){listeners.add(listener);return()=>listeners.delete(listener);}});
}
return Object.freeze({defaults,check,reduce,createStore});
});