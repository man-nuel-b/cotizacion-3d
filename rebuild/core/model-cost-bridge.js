/* BAT V2: synchronous state -> BOM -> price projection, computed before commit. */
(function(root,factory){
 const api=factory(root);
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.BatModelCostBridge=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
'use strict';
const load=(name,file)=>root[name]||(typeof require==='function'?require(file):null);
const State=load('BatProjectState','./project-state');
const Materials=load('BatMaterials','./materials');
const Pricing=load('BatPricing','./pricing');
const Catalog=load('BatCatalog','./catalog');
if(!State||!Materials||!Pricing||!Catalog)throw new Error('No se pudo inicializar el motor BOM/Costos');
function createStore(initial=State.defaults(),priceBook=Catalog){
 const prices=JSON.parse(JSON.stringify(priceBook));
 const derive=state=>{
  const bom=Materials.takeoff(state);
  const quote=Pricing.calculate(bom,prices,state.pricing);
  if(!Number.isSafeInteger(quote.total)||!Number.isSafeInteger(quote.net))
   throw new RangeError('Total fuera de rango seguro para CLP');
  return {revision:state.revision,bom,quote};
 };
 return State.createStore(initial,{derive});
}
return Object.freeze({version:1,createStore});
});