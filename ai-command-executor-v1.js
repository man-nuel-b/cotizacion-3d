/* BAT-Kubiqueitor: motor de acciones del asistente fase 1.
   No llama IA externa. Ordenes verificadas y transacción única deshacible.
*/
(function(root){
 'use strict';
 if(root.BAT_KUBIQUEITOR_AI_EXECUTOR)return;
 const types=new Set(['window','door','openingFrame','partition']);
 const number=x=>Number.isFinite(Number(x))?Number(x):NaN;
 const copy=x=>JSON.parse(JSON.stringify(x));
 function stage(plan,environment){
   if(!plan?.ok||!Array.isArray(plan.actions)||!plan.actions.length)throw Error('No hay órdenes válidas para aplicar.');
   const {state,DATA,schemas,container}=environment;
   if(!state||!DATA||!container||!schemas)throw Error('Motor 3D no disponible.');
   const counts={...state.counts},changes=[],warnings=[];
   for(const action of plan.actions){
     if(action.kind==='setLining'){
       if(!['plywood','osb','gypsum','pvc','fibrocement'].includes(action.lining))throw Error('Revestimiento desconocido.');
       changes.push(action);warnings.push('Revisar precio, APU e instalación del revestimiento antes de emitir una oferta.');continue;
     }
     if(!types.has(action.type))throw Error('Elemento no permitido: '+action.type);
     if(action.kind==='removeLast'){
       if(!(counts[action.type]>0))throw Error('No hay más elementos '+action.type+' para quitar.');
       counts[action.type]--;changes.push(action);continue;
     }
     if(!['addMounted','addPartition'].includes(action.kind))throw Error('Acción no permitida.');
     if(!Number.isInteger(action.quantity)||action.quantity<1||action.quantity>4)throw Error('Cantidad inválida.');
     const meta=DATA.extras?.[action.type];
     if(!meta||!Number.isFinite(meta.max))throw Error('El editor de '+action.type+' todavía no está cargado.');
     if(counts[action.type]+action.quantity>meta.max)throw Error('Se excede el máximo de '+action.type+'.');
     if(action.kind==='addMounted'&&!['A','B','C','D'].includes(action.face))throw Error('Indica una cara A–D.');
     if(action.kind==='addMounted'&&!schemas[action.type])throw Error('Aún no hay dimensiones disponibles para '+action.type+'.');
     if(action.kind==='addPartition'&&action.type!=='partition')throw Error('Acción de tabique inválida.');
     const schema=schemas[action.type];
     for(const [key,value] of Object.entries(action.kind==='addPartition'?
       {length:action.length,height:action.height,thickness:action.thickness}:{width:action.width,height:action.height})){
       if(value===null||value===undefined)continue;
       const f=schema?.fields?.find(x=>x.key===key);
       if(!f||!Number.isFinite(number(value))||number(value)<f.min-1e-6||number(value)>f.max+1e-6)
         throw Error('Medida '+key+' fuera de rango para '+action.type+'.');
       if(key==='height'&&value>container.height-.06)throw Error('Altura incompatible con el contenedor.');
     }
     counts[action.type]+=action.quantity;changes.push(action);
   }
   return {changes,warnings};
 }
 function apply(plan){
   if(typeof state==='undefined'||typeof DATA==='undefined'||typeof renderAll!=='function'||typeof pushHistory!=='function')throw Error('Editor no disponible.');
   const c=DATA.containers[state.container];
   const pre=stage(plan,{state,DATA,schemas:typeof OBJECT_DIMENSIONS!=='undefined'?OBJECT_DIMENSIONS:null,container:c});
   if(typeof ensureLayoutState!=='function'||typeof ensureDimensionState!=='function'||typeof objectDimensions!=='function'||typeof validCandidate!=='function')throw Error('Esperando controles del editor.');
   const original=state,working=copy(state);
   state=working;
   try{
     ensureLayoutState();ensureDimensionState();
     for(const action of pre.changes){
       const type=action.type;
       if(action.kind==='setLining'){
         if(typeof INTERIOR_SYSTEMS==='undefined'||!INTERIOR_SYSTEMS.lining[action.lining])throw Error('No se ha cargado la terminación interior.');
         if(typeof ensureInteriorSystem!=='function')throw Error('Sistema interior no disponible.');
         ensureInteriorSystem();state.interiorSystem.lining=action.lining;continue;
       }
       if(action.kind==='removeLast'){
         if(!(state.counts[type]>0))throw Error('No existe un '+type+' para quitar.');
         state.counts[type]--;state.layout?.[type]?.splice(state.counts[type],1);
         state.dimensions?.[type]?.splice(state.counts[type],1);
         continue;
       }
       for(let i=0;i<action.quantity;i++){
         const idx=state.counts[type]||0;
         state.layout[type]=state.layout[type]||[];
         state.dimensions[type]=state.dimensions[type]||[];
         if(action.kind==='addMounted'){
           if(typeof MOUNTED_FACE_TYPES==='undefined'||!MOUNTED_FACE_TYPES[type]||
             typeof findAvailableMountedOffset!=='function')throw Error('El editor de la cara todavía no está listo para '+type+'.');
           const current=objectDimensions(type,idx);
           const dims={...current};
           if(action.width!==null)dims.width=action.width;
           if(action.height!==null)dims.height=action.height;
           state.dimensions[type][idx]=dims;
           // El índice nuevo aún no forma parte de counts. Se comprueba contra los existentes.
           const offset=findAvailableMountedOffset(type,action.face);
           if(offset===null)throw Error('No hay espacio suficiente en la cara '+action.face+' para '+type+'.');
           if(typeof dimensionChangeAllowed==='function'){
             // La validación requiere una disposición temporal del elemento nuevo.
             state.counts[type]=idx+1;state.layout[type][idx]={face:action.face,x:offset};
             if(!dimensionChangeAllowed(type,idx,dims))throw Error('Las dimensiones no caben en la cara '+action.face+'.');
           }else{state.counts[type]=idx+1;state.layout[type][idx]={face:action.face,x:offset};}
         }else{
           if(typeof partitionFullLength!=='function'||typeof actualLayout!=='function')throw Error('El editor de tabiques aún no está disponible.');
           const orientation=action.orientation==='long'?'long':'cross';
           const maxLen=partitionFullLength(orientation);
           if(action.length!==null&&action.length>maxLen+.0001)throw Error('El tabique no cabe: longitud máxima '+maxLen.toFixed(2)+' m.');
           const length=action.length??maxLen;
           const height=action.height??(c.height-.15);
           if(height>c.height-.06)throw Error('El tabique supera la altura útil.');
           state.counts.partition=idx+1;
           const d=objectDimensions('partition',idx);
           state.dimensions.partition[idx]={...d,length,height,thickness:action.thickness??d.thickness};
           // Posición automática segura. No se desplaza un tabique existente.
           let found=null;
           const edge=orientation==='long'?c.width/2-.24:c.length/2-.24;
           for(let distance=0;distance<=Math.max(0,edge);distance+=.15){
             for(const sign of distance===0?[1]:[1,-1]){
               const coord=Number((distance*sign).toFixed(2));
               const layout={orientation,x:orientation==='cross'?coord:0,z:orientation==='long'?coord:0};
               if(validCandidate('partition',idx,layout)){found=layout;break;}
             }
             if(found)break;
           }
           if(!found)throw Error('No encontré una posición libre para el nuevo tabique.');
           state.layout.partition[idx]=found;
           if(typeof normalizePartitionInsideContainer==='function')normalizePartitionInsideContainer(idx);
         }
       }
     }
     // Validate that pricing is calculable before committing the state.
     if(typeof calculate==='function'){
       const totals=calculate();
       if(!Number.isFinite(Number(totals?.total)))throw Error('No se pudo recalcular el presupuesto.');
     }
   }catch(error){state=original;throw error;}
   state=original;
   pushHistory();
   state=working;
   if(typeof renderAll==='function')renderAll();
   const result={applied:pre.changes.length,notes:pre.warnings};
   return result;
 }
 root.BAT_KUBIQUEITOR_AI_EXECUTOR={version:1,stage,apply};
 if(typeof module==='object'&&module.exports)module.exports={stage};
})(typeof window!=='undefined'?window:globalThis);
