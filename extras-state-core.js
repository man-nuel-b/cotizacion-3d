/* Cubikeitor — shared state operations for Extras.
   The canonical project state is the source of truth. This module does NOT render,
   save, price, or mutate DOM. Callers own pushHistory() and renderAll(). */
(function(root){
  'use strict';
  function count(project,type){
    const value=Number(project?.counts?.[type]);
    return Number.isSafeInteger(value)&&value>0?value:0;
  }
  function ensureCollections(project){
    if(!project.counts||typeof project.counts!=='object')project.counts={};
    if(!project.layout||typeof project.layout!=='object')project.layout={};
    if(!project.dimensions||typeof project.dimensions!=='object')project.dimensions={};
  }
  function legacyPoint(index){
    return {id:'EL-legacy-'+index+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8),
      type:'outlet',circuit:'Enchufes',face:null,position:null,height:null};
  }
  function reconcileElectrical(project){
    if(!project||typeof project!=='object')return {ok:false,reason:'Proyecto inválido'};
    const expected=count(project,'electrical');
    const current=Array.isArray(project.electrical?.points)?project.electrical.points:[];
    // Fail without ANY changes if a legacy counter would destroy typed points.
    if(current.length>expected)
      return {ok:false,reason:'Los puntos eléctricos superan el contador; revisar antes de modificar para evitar perder datos.'};
    ensureCollections(project);
    if(!project.electrical||typeof project.electrical!=='object')project.electrical={version:1,points:[]};
    if(!Array.isArray(project.electrical.points))project.electrical.points=[];
    const points=project.electrical.points;
    while(points.length<expected)points.push(legacyPoint(points.length));
    return {ok:true,points};
  }
  function addMountedAt(project,type,face,x,max){
    if(!project||!type||!['A','B','C','D'].includes(face)||!Number.isFinite(Number(x)))
      return {ok:false,reason:'Ubicación de montaje inválida'};
    const old=count(project,type),limit=Number(max);
    if(!Number.isSafeInteger(limit)||old>=limit)
      return {ok:false,reason:'Se alcanzó el máximo de componentes'};
    // Puntos añadidos en una cara deben existir de inmediato en el modelo técnico,
    // sin esperar un MutationObserver que pueda renderizar la cubicación tarde.
    const electrical=type==='electrical'?reconcileElectrical(project):null;
    if(electrical&&!electrical.ok)return electrical;
    ensureCollections(project);
    if(!Array.isArray(project.layout[type]))project.layout[type]=[];
    project.layout[type][old]={face,x:Number(x)};
    project.counts[type]=old+1;
    if(electrical)electrical.points.push({
      ...legacyPoint(old),type:'outlet',circuit:'Enchufes',face,position:null,height:null
    });
    return {ok:true,type,index:old,face};
  }
  function removeAt(project,type,index){
    if(!project||!type||!Number.isInteger(index))return {ok:false,reason:'Índice inválido'};
    const original=count(project,type);
    if(original===0||index<0||index>=original)return {ok:false,reason:'El componente no existe'};
    if(type==='electrical'){
      const check=reconcileElectrical(project);
      if(!check.ok)return check;
      check.points.splice(index,1);
    }
    ensureCollections(project);
    const layout=project.layout[type];
    if(Array.isArray(layout))layout.splice(index,1);
    const dimensions=project.dimensions[type];
    if(Array.isArray(dimensions))dimensions.splice(index,1);
    project.counts[type]=original-1;
    return {ok:true,index,type,remaining:project.counts[type]};
  }
  function removeElectricalType(project,type){
    const check=reconcileElectrical(project);
    if(!check.ok)return check;
    const index=check.points.map(x=>x?.type||'outlet').lastIndexOf(type);
    if(index<0)return {ok:false,reason:'No existe un punto eléctrico del tipo seleccionado'};
    return removeAt(project,'electrical',index);
  }
  function addElectricalPoint(project,point,max=24){
    const check=reconcileElectrical(project);
    if(!check.ok)return check;
    const old=count(project,'electrical');
    if(!Number.isInteger(max)||max<1||old>=max)return {ok:false,reason:'Se alcanzó el máximo de puntos eléctricos'};
    const allowed=['outlet','switch','light','acPoint'];
    if(!point||!allowed.includes(point.type))return {ok:false,reason:'Tipo de punto eléctrico no válido'};
    const p={...point,id:point.id||legacyPoint(old).id};
    check.points.push(p);
    project.counts.electrical=old+1;
    return {ok:true,index:old,type:p.type};
  }
  function partitionArea(project,container,dimensionProvider){
    const width=Number(container?.width)||0,height=Number(container?.height)||0;
    if(width<=0||height<=0)return 0;
    let area=0;
    for(let index=0;index<count(project,'partition');index++){
      let fromProvider=null;
      try{fromProvider=typeof dimensionProvider==='function'?dimensionProvider('partition',index):null;}catch(_){}
      const stored=project?.dimensions?.partition?.[index]||{};
      const dims={...stored,...(fromProvider&&typeof fromProvider==='object'?fromProvider:{})};
      const length=Number(dims.length??dims.width??width);
      const h=Number(dims.height??height);
      if(Number.isFinite(length)&&Number.isFinite(h)&&length>0&&h>0)area+=length*h;
    }
    return area;
  }
  function bathroomFixtures(project){
    const result={wc:0,sink:0,shower:0};
    if(!Array.isArray(project?.bathroomModules))return result;
    for(const bathroom of project.bathroomModules){
      if(bathroom?.kind==='full'){result.wc++;result.sink++;result.shower++;}
      else if(bathroom?.kind==='half'){result.wc++;result.sink++;}
    }
    return result;
  }
  const api={version:1,count,reconcileElectrical,addMountedAt,removeAt,removeElectricalType,
    addElectricalPoint,partitionArea,bathroomFixtures};
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.BAT_CUBIKEITOR_EXTRAS_STATE_CORE=api;
})(typeof window==='undefined'?globalThis:window);
