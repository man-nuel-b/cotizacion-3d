/* Deterministic metric takeoff from parametric state. Quantities not vendor prices. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.BatMaterials=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const round=(x,d=3)=>Math.round((x+Number.EPSILON)*10**d)/10**d;
function takeoff(state){
 const c=state.project.container,wallGross=2*(c.length+c.width)*c.height,baseArea=c.length*c.width;
 const openingArea=state.openings.reduce((n,o)=>n+o.width*o.height,0);
 if(openingArea>wallGross)throw new Error('Aberturas mayores que superficie disponible');
 const partitionArea=state.partitions.reduce((n,p)=>n+p.length*p.height,0);
 const lines=[
  {code:'FLOOR',name:'Sistema de piso',unit:'m²',qty:round(baseArea)},
  {code:'ROOF',name:'Cubierta',unit:'m²',qty:round(baseArea)},
  {code:'WALL',name:'Revestimiento exterior neto',unit:'m²',qty:round(wallGross-openingArea)},
  {code:'PARTITION',name:'Tabiquería interior, ambas caras',unit:'m²',qty:round(partitionArea*2)},
  {code:'WINDOW',name:'Ventanas',unit:'un',qty:state.openings.filter(x=>x.kind==='window').length},
  {code:'DOOR',name:'Puertas exteriores',unit:'un',qty:state.openings.filter(x=>x.kind==='door').length}
 ];
 return {lines,metrics:{floorArea:round(baseArea),grossWallArea:round(wallGross),openingArea:round(openingArea),netWallArea:round(wallGross-openingArea),partitionArea:round(partitionArea)}};
}
return Object.freeze({takeoff});
});