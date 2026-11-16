/* Presentation mapping of catalog entries. No side effects, prices or geometry actions.
 * This describes FUTURE placement capability and does not attach APUs to objects.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.BatCatalogUiMap=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const specs={
 'floor-finish':{title:'Terminación de piso',surface:'piso',mode:'superficie'},
 'linear-finish':{title:'Terminación lineal',surface:'perímetro',mode:'lineal'},
 'partition-system':{title:'Estructura de tabique',surface:'tabique',mode:'sistema'},
 'insulation':{title:'Aislación',surface:'muro / cielo / piso',mode:'capa'},
 'wall-finish':{title:'Revestimiento',surface:'muro / tabique',mode:'capa'},
 'opening-work':{title:'Trabajo estructural de vano',surface:'pared',mode:'trabajo técnico'},
 'surface-treatment':{title:'Tratamiento de superficie',surface:'superficie',mode:'superficie'},
 'composite-system':{title:'Solución constructiva',surface:'muro / tabique / cielo',mode:'sistema'},
 'sanitary-object':{title:'Artefacto sanitario / kitchenette',surface:'recinto',mode:'objeto'},
 'equipment':{title:'Equipo instalado',surface:'recinto',mode:'objeto'},
 'utility-point':{title:'Punto sanitario',surface:'instalación',mode:'punto'},
 'electrical-point':{title:'Punto eléctrico',surface:'instalación',mode:'punto'},
 'administrative-service':{title:'Gestión administrativa',surface:'proyecto',mode:'servicio'},
 'opening-door':{title:'Puerta',surface:'vano',mode:'objeto'},
 'opening-window':{title:'Ventana',surface:'vano',mode:'objeto'}
};
const byMode=Object.freeze(Object.fromEntries(Object.entries(specs).map(([key,data])=>
 [key,Object.freeze({...data,canPlaceIn3D:false,autoCalculate:false,apuLinked:false})])));
function describe(item){
 if(!item||typeof item!=='object')throw new TypeError('Elemento técnico no válido');
 const metadata=byMode[item.uiMode];
 if(!metadata)throw new Error('Tipo de presentación desconocido: '+item.uiMode);
 return metadata;
}
return Object.freeze({byMode,describe});
});