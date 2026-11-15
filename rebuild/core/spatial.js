/* Pure BAT V2 geometry placement: meters, origin at container centre. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.BatSpatial=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const finite=(value,label)=>{
 if((typeof value!=='number'&&typeof value!=='string')||
    (typeof value==='string'&&!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value.trim())))
  throw new RangeError(label+' inválido');
 const n=Number(value);
 if(!Number.isFinite(n))throw new RangeError(label+' inválido');
 return n;
};
const snap=(value,grid=.05)=>{
 const v=finite(value,'Coordenada'),step=finite(grid,'Cuadrícula');
 if(step<.001||step>1)throw new RangeError('Cuadrícula fuera de rango');
 return Math.round(Math.round(v/step)*step*1000)/1000;
};
const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
function faceFromPoint(point,container,tolerance=.15){
 const x=finite(point?.x,'X'),z=finite(point?.z,'Z');
 const halfL=finite(container?.length,'Longitud')/2;
 const halfW=finite(container?.width,'Ancho')/2;
 const tol=finite(tolerance,'Tolerancia');
 if(halfL<=0||halfW<=0||tol<0||tol>.5||
    Math.abs(x)>halfL+tol||Math.abs(z)>halfW+tol)
  throw new RangeError('Punto fuera de los límites del contenedor');
 const dx=Math.abs(Math.abs(x)-halfL),dz=Math.abs(Math.abs(z)-halfW);
 if(Math.min(dx,dz)>tol)throw new RangeError('Selecciona una pared exterior');
 return dx<dz?(x<0?'C':'D'):(z<0?'A':'B');
}
function placementFromHit(point,container,{kind,width,height}){
 if(!['window','door'].includes(kind))throw new Error('Tipo de abertura no válido');
 const w=finite(width,'Ancho'),h=finite(height,'Alto');
 const c=container,maximumHeight=finite(c?.height,'Altura');
 const y=finite(point?.y,'Altura');
 if(maximumHeight<=0||y<0||y>maximumHeight)
  throw new RangeError('La altura seleccionada está fuera del contenedor');
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
// For a future drag tool: return a valid snapped center without mutating state.
function fitPartitionCenter(partition,container,grid=.05){
 const length=finite(partition?.length,'Largo tabique');
 const thickness=finite(partition?.thickness??.08,'Espesor tabique');
 const orientation=partition?.orientation??'x';
 const L=finite(container?.length,'Longitud');
 const W=finite(container?.width,'Ancho');
 grid=finite(grid,'Cuadrícula');
 if(grid<.001||grid>1)throw new RangeError('Cuadrícula fuera de rango');
 if(length<=0||thickness<.04||thickness>.3||L<=0||W<=0||
   !['x','z'].includes(orientation))
  throw new RangeError('Geometría del tabique inválida');
 const hx=(orientation==='x'?length:thickness)/2;
 const hz=(orientation==='z'?length:thickness)/2;
 if(hx>L/2||hz>W/2)throw new RangeError('Tabique demasiado grande para el contenedor');
 const xLimit=Math.floor((L/2-hx+1e-9)/grid)*grid;
 const zLimit=Math.floor((W/2-hz+1e-9)/grid)*grid;
 if(xLimit<0||zLimit<0)throw new RangeError('Tabique fuera de rango');
 const x=snap(clamp(snap(finite(partition.x,'X'),grid),-xLimit,xLimit),grid);
 const z=snap(clamp(snap(finite(partition.z,'Z'),grid),-zLimit,zLimit),grid);
 return Object.freeze({x,z});
}
return Object.freeze({snap,faceFromPoint,placementFromHit,fitPartitionCenter});
});