/* Three original container definitions provided in contenedores-3-tipos(1).html.
 * Shared by state validation and visual rendering; no pricing/APU bindings. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.BatContainerTypes=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const defs={
 maritimo:{
  id:'maritimo',label:'Marítimo',description:'Acero corrugado, esquineros ISO y barras de cierre. Estándar 40 pies.',
  dims:[12.03,2.35,2.39],color:'#7d8388',
  period:.076,ridge:.036,sheet:.004,flatInner:false,roughness:.62,metalness:.4,
  floor:'wood',frameColor:null,decoration:{D:'doors'}
 },
 reefer:{
  id:'reefer',label:'Reefer',description:'Refrigerado: paneles blancos aislados con juntas verticales y equipo de frío azul.',
  dims:[12.19,2.44,2.5],color:'#eef0ef',
  period:1,ridge:0,sheet:.075,flatInner:true,roughness:.45,metalness:.15,
  floor:'alu',frameColor:null,seam:.55,decoration:{D:'machine',C:'doors'}
 },
 modular:{
  id:'modular',label:'Modular',description:'Desmontable tipo oficina/bodega: panel sándwich con nervado fino y marco claro. Ventanas con barrotes.',
  dims:[5.95,2.43,2.5],color:'#c3c8cb',
  period:.06,ridge:.006,sheet:.044,flatInner:true,roughness:.55,metalness:.2,
  floor:'vinyl',frameColor:'#f2f4f5',decoration:{}
 }
};
const byId=Object.freeze(Object.fromEntries(Object.entries(defs).map(([id,c])=>[
 id,Object.freeze({...c,dims:Object.freeze(c.dims.slice()),decoration:Object.freeze({...c.decoration})})
])));
const all=Object.freeze(Object.values(byId));
const get=id=>byId[id]||null;
return Object.freeze({byId,all,get,defaultId:'maritimo'});
});