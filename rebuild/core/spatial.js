/* Pure BAT V2 geometry placement: meters, origin at container centre. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.BatSpatial=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const finite=(n,label)=>{if(n===null||n===undefined||n===''||!Number.isFinite(Number(n)))throw new RangeError(label+' inválido');return Number(n);};
const snap=(value,grid=.05)=>Math.round(Math.round(value/grid)*grid*1000)/1000;
const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
function faceFromPoint(point,container,tolerance=.15){
 const x=finite(point?.x,'X'),z=finite(point?.z,'Z');
 const halfL=finite(container?.length,'Longitud')/2;
 const halfW=finite(container?.width,'Ancho')/2;
 const dx=Math.abs(Math.abs(x)-halfL),dz=Math.abs(Math.abs(z)-halfW);
 if(Math.min(dx,dz)>tolerance)throw new RangeError('Selecciona una pared exterior');
 return dx<dz?(x<0?'C':'D'):(z<0?'A':'B');
}
function placementFromHit(point,container,{kind,width,height}){
 if(!['window','door'].includes(kind))throw new Error('Tipo de abertura no válido');
 const w=finite(width,'Ancho'),h=finite(height,'Alto');
 const c=container,maximumHeight=finite(c?.height,'Altura');
 const face=faceFromPoint(point,c);
 const span=['A','B'].includes(face)?finite(c.length,'Longitud'):finite(c.width,'Ancho');
 if(w<=0||h<=0||w>span-.02||h>maximumHeight-.02)
  throw new RangeError('La abertura no cabe en esa pared');
 const axis=['A','B'].includes(face)?finite(point.x,'X'):finite(point.z,'Z');
 const horizontalLimit=Math.floor(((span-w)/2-.01+1e-9)/.05)*.05;
 const offset=snap(clamp(snap(axis),-horizontalLimit,horizontalLimit));
 const verticalLimit=Math.floor((maximumHeight-h-.01+1e-9)/.05)*.05;
 const bottom=kind==='door'?0:snap(clamp(snap(finite(point.y,'Altura')-h/2),0,verticalLimit));
 return Object.freeze({face,offset,bottom});
}
return Object.freeze({snap,faceFromPoint,placementFromHit});
});