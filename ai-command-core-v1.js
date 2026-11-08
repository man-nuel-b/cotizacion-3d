/* BAT-Kubiqueitor / Asistente de diseño — fase 1.
   Intérprete local de órdenes en español. NO es un modelo generativo.
   Estricto: las órdenes ambiguas NO producen cambios al proyecto.
*/
(function(root){
 'use strict';
 if(root.BAT_KUBIQUEITOR_AI_COMMAND_CORE)return;
 const VERBS='agrega|anade|crea|coloca|instala|incorpora|pon|cambia|reemplaza|quita|elimina|borra';
 const NAMES={un:1,una:1,uno:1,dos:2,tres:3,cuatro:4};
 const normalizeText=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
 const num=x=>Number(String(x).replace(',','.'));
 const r3=x=>Math.round(x*1000)/1000;
 function unitMeters(value,unit,kind,notes){
   let u=(unit||'').toLowerCase(),v=num(value);
   if(!Number.isFinite(v)||v<=0)throw Error('Las dimensiones deben ser positivas.');
   if(!u){u=kind==='thickness'&&v>=10?'mm':v>=20?'cm':'m';notes.push('Se interpretó '+value+' como '+(u==='cm'?'centímetros':u==='mm'?'milímetros':'metros')+'.');}
   return r3(v*(u==='mm'?.001:u==='cm'?.01:1));
 }
 function scanNamed(s,name,notes){
   const f='(?:\\d+(?:[.,]\\d+)?)';
   const first=new RegExp('\\b'+name+'\\s*(?:de|:|=)?\\s*('+f+')\\s*(mm|cm|metros?|m)?\\b','i');
   const second=new RegExp('('+f+')\\s*(mm|cm|metros?|m)?\\s*(?:de\\s+)?'+name+'\\b','i');
   const m=s.match(first)||s.match(second);
   return m?unitMeters(m[1],m[2],name==='espesor'?'thickness':'length',notes):null;
 }
 function dimensions(s,kind,notes){
   const pair=s.match(/(\d+(?:[.,]\d+)?)\s*(mm|cm|metros?|m)?\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(mm|cm|metros?|m)?\b/i);
   let first=null,second=null;
   if(pair){
     const common=pair[4]||pair[2]||'';
     first=unitMeters(pair[1],pair[2]||common,'length',notes);
     second=unitMeters(pair[3],pair[4]||common,'length',notes);
   }
   const low=scanNamed(s,kind==='partition'?'largo':'ancho',notes);
   const high=scanNamed(s,'alto',notes);
   const thickness=kind==='partition'?scanNamed(s,'espesor',notes):null;
   return {width:low??first,height:high??second,thickness};
 }
 function count(s,type){
   const part=type==='window'?'ventanas?':type==='door'?'puertas?':type==='partition'?'tabiques?': 'vanos?';
   const m=s.match(new RegExp('\\b(un|una|uno|dos|tres|cuatro|[1-9])\\s+(?:\\w+\\s+)?(?:'+part+')\\b','i'));
   if(!m)return 1;
   const v=NAMES[m[1]]||Number(m[1]);
   if(!Number.isInteger(v)||v<1||v>4)throw Error('En esta primera fase agrega de 1 a 4 elementos por orden.');
   return v;
 }
 function face(s){
   const m=s.match(/\b(?:cara|muro|pared)\s*([abcd])\b/i);
   return m?m[1].toUpperCase():null;
 }
 function setLining(s){
   if(/\b(terciado|plywood|madera)\b/.test(s))return {key:'plywood',label:'Terciado (madera)',pending:true};
   if(/\bosb\b/.test(s))return {key:'osb',label:'OSB',pending:true};
   if(/\bpvc\b/.test(s))return {key:'pvc',label:'PVC',pending:true};
   if(/\b(fibrocemento)\b/.test(s))return {key:'fibrocement',label:'Fibrocemento',pending:true};
   if(/\b(volcanita|yeso|carton)\b/.test(s))return {key:'gypsum',label:'Volcanita / yeso-cartón',pending:false};
   return null;
 }
 function parseOne(input){
   const s=normalizeText(input).replace(/\s+/g,' '),notes=[];
   const verb=s.match(new RegExp('^(?:por favor\\s+)?('+VERBS+')\\b'));
   if(!verb)throw Error('Escribe una orden como «Agrega 2 ventanas en cara A».');
   const remove=/^(quita|elimina|borra)$/.test(verb[1]),replace=/^(cambia|reemplaza)$/.test(verb[1]);
   const words=[
     {type:'partition',match:/\b(tabique|tabiques|division interior|muro divisorio)\b/.test(s)},
     {type:'openingFrame',match:/\b(vano|vanos)\b/.test(s)},
     {type:'window',match:/\b(ventana|ventanas|ventanal|ventanales)\b/.test(s)},
     {type:'door',match:/\b(puerta|puertas)\b/.test(s)},
     {type:'lining',match:/\b(revestimiento|forro|terminacion|paneles?)\b/.test(s)}
   ].filter(x=>x.match);
   // "Vano de ventana" is not the same as a ready-installed window.
   const filtered=words.some(x=>x.type==='openingFrame')?words.filter(x=>x.type!=='window'):words;
   if(filtered.length!==1)throw Error('No pude distinguir un único elemento. Escribe una instrucción por línea.');
   const type=filtered[0].type;
   if(type==='lining'){
     if(remove)throw Error('Para quitar un revestimiento, usa el editor manual de caras.');
     if(/\b(cara\s*[abcde]|pared\s*(?:del|de)|muro\s*(?:del|de)|solo|unica|fondo|frontal|lateral)\b/.test(s)){
       throw Error('La fase 1 cambia el revestimiento general. Para una pared específica usa el editor manual por cara.');
     }
     const lining=setLining(s);
     if(!lining)throw Error('Material no disponible en el catálogo. Regístralo como material a pedido; no se inventará su apariencia ni precio.');
     notes.push('El cambio de revestimiento se visualiza, pero el APU correspondiente debe verificarse antes de cotizar.');
     if(lining.key==='plywood'&&!/terciado|plywood/.test(s))notes.push('Se propone terciado referencial como representación de «madera», sujeto a confirmación.');
     return {action:{kind:'setLining',lining:lining.key,label:'Cambiar revestimiento general a '+lining.label,pendingCost:true},notes};
   }
   if(replace)throw Error('Para editar elementos ya colocados, selecciónalos en el 3D y usa el editor de medidas.');
   if(remove){
     if(!/\b(ultima|ultimo)\b/.test(s))throw Error('Por seguridad, indica «quita la última ventana/puerta/tabique».');
     return {action:{kind:'removeLast',type,label:'Quitar último elemento: '+({window:'ventana',door:'puerta',partition:'tabique',openingFrame:'vano con marco'}[type])},notes};
   }
   if(type==='openingFrame'&&!/\bcon\s+marco\b/.test(s)){
     throw Error('Especifica «vano con marco»; el vano sin refuerzo se debe revisar técnicamente.');
   }
   const quantity=count(s,type);
   const d=dimensions(s,type==='partition'?'partition':'mounted',notes);
   const given=(d.width!==null||d.height!==null);
   if(given&&(d.width===null||d.height===null))throw Error('Para fijar medidas indica ancho y alto (o largo y alto para tabiques).');
   if(type==='partition'){
     const orientation=/\blongitudinal\b|\ba lo largo\b/.test(s)?'long':/\btransversal\b|\ba lo ancho\b/.test(s)?'cross':'cross';
     if(!/\blongitudinal\b|\ba lo largo\b|\btransversal\b|\ba lo ancho\b/.test(s))notes.push('Orientación propuesta: transversal. Puedes cambiarla después en el editor.');
     if(quantity>2)throw Error('Por seguridad, agrega como máximo dos tabiques por orden.');
     const label='Agregar '+quantity+' tabique(s) '+(orientation==='long'?'longitudinal(es)':'transversal(es)')+
       (given?', '+d.width+' × '+d.height+' m':' con medidas predeterminadas');
     return {action:{kind:'addPartition',type:'partition',quantity,orientation,length:d.width,height:d.height,thickness:d.thickness,label},notes};
   }
   if(d.thickness!==null)throw Error('El espesor solo puede cambiarse por esta vía para tabiques.');
   const f=face(s);
   if(!f)throw Error('Indica una cara A, B, C o D para colocar '+({window:'la ventana',door:'la puerta',openingFrame:'el vano'}[type])+'.');
   if(quantity>4)throw Error('Solo se permiten hasta 4 elementos por orden.');
   if(!given)notes.push('Se usarán las dimensiones actuales predeterminadas del editor 3D.');
   const item=type==='window'?'ventana(s)':type==='door'?'puerta(s)':'vano(s) con marco';
   return {action:{kind:'addMounted',type,quantity,face:f,width:d.width,height:d.height,label:'Agregar '+quantity+' '+item+' en cara '+f+(given?', '+d.width+' × '+d.height+' m':'')},notes};
 }
 function parse(source){
   const text=String(source||'').trim(),errors=[],actions=[],notes=[];
   if(!text)return {ok:false,actions,errors:['Escribe una instrucción para el diseño.'],notes};
   if(text.length>1000)return {ok:false,actions,errors:['Máximo 1.000 caracteres por solicitud.'],notes};
   const split=text.replace(/\s+(?:y\s+)?(?=(?:agrega|añade|anade|crea|coloca|instala|incorpora|pon|cambia|reemplaza|quita|elimina|borra)\b)/gi,'\n').split(/[\n;]+/).map(x=>x.trim()).filter(Boolean);
   if(split.length>5)return {ok:false,actions,errors:['Puedes enviar hasta 5 instrucciones por vez.'],notes};
   split.forEach((part,index)=>{
     try{const item=parseOne(part);actions.push(item.action);notes.push(...item.notes);}
     catch(error){errors.push('Instrucción '+(index+1)+': '+error.message);}
   });
   return {ok:errors.length===0&&actions.length>0,actions:errors.length?[]:actions,errors,notes:[...new Set(notes)]};
 }
 const api=Object.freeze({version:1,parse,normalizeRequest:parseOne});
 root.BAT_KUBIQUEITOR_AI_COMMAND_CORE=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
