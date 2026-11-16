/* BAT-CUBIKEITOR V2: families of the standalone technical element registry.
   This is not an APU catalogue and carries no cost, supplier, or automatic BOM links. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.BatCatalogFamilies=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const definitions=[
  {id:'pisos',label:'Pisos y zócalos',description:'Terminaciones de pisos y perímetros'},
  {id:'tabiques',label:'Estructuras de tabiques',description:'Estructuras sin revestimiento'},
  {id:'aislaciones',label:'Aislaciones',description:'Aislación térmica y acústica'},
  {id:'revestimientos',label:'Revestimientos',description:'Terminaciones de muros y superficies'},
  {id:'estructura-contenedor',label:'Estructura del contenedor',description:'Cortes, refuerzos, preparación y pintura'},
  {id:'sistemas-completos',label:'Tabiques, muros y cielos completos',description:'Soluciones y tratamientos constructivos'},
  {id:'sanitarios',label:'Sanitarios y kitchenette',description:'Artefactos, puntos de red y equipamiento'},
  {id:'electricos',label:'Instalaciones eléctricas y climatización',description:'Puntos, tablero, equipos y declaración'},
  {id:'aberturas',label:'Puertas y ventanas',description:'Elementos instalados en vano'}
 ];
 const all=Object.freeze(definitions.map(f=>Object.freeze({...f})));
 const byId=Object.freeze(Object.fromEntries(all.map(f=>[f.id,f])));
 return Object.freeze({all,byId});
});