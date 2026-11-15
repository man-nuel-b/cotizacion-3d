/* BAT V2: strict APU catalog gateway. No implicit zero-cost fallback. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.BatApuCatalog=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
function text(value,label){
 if(typeof value!=='string'||!value.trim())throw new TypeError('Dato APU obligatorio: '+label);
 return value.trim();
}
function numeric(value,label,{zero=true,max=1e12}={}){
 if(value===null||value===undefined||value===''||typeof value==='boolean')
  throw new RangeError('Celda APU vacía: '+label);
 const n=Number(value);
 if(!Number.isFinite(n)||n<0||(!zero&&n===0)||n>max)
  throw new RangeError('Valor APU inválido: '+label);
 return n;
}
function importCatalog(input){
 if(!input||!Array.isArray(input.resources)||!Array.isArray(input.partidas))
  throw new TypeError('Catálogo APU sin recursos o partidas');
 if(input.resources.length>5000||input.partidas.length>2000)
  throw new RangeError('Catálogo APU demasiado grande');
 const resources=new Map(),partidas=new Map();
 for(const [i,r] of input.resources.entries()){
  if(!r||typeof r!=='object')throw new TypeError('Recurso APU inválido '+i);
  const code=text(r.code,'recurso código '+i);
  if(resources.has(code))throw new Error('Recurso APU duplicado: '+code);
  const priceClp=numeric(r.priceClp,code+' precio');
  resources.set(code,{code,name:text(r.name,code+' nombre'),unit:text(r.unit,code+' unidad'),
   priceClp,validatedPrice:priceClp>0});
 }
 for(const [i,p] of input.partidas.entries()){
  if(!p||typeof p!=='object')throw new TypeError('Partida APU inválida '+i);
  const code=text(p.code,'partida código '+i);
  if(partidas.has(code))throw new Error('Partida APU duplicada: '+code);
  if(!Array.isArray(p.components)||p.components.length===0)
   throw new TypeError('Partida APU sin componentes: '+code);
  if(p.components.length>500)throw new RangeError('Exceso de componentes: '+code);
  const components=p.components.map((entry,j)=>{
   if(!entry||typeof entry!=='object')throw new TypeError('Insumo APU inválido: '+code);
   const resourceCode=text(entry.resourceCode,code+' insumo '+j);
   if(!resources.has(resourceCode))throw new Error('Recurso APU desconocido: '+resourceCode);
   return {resourceCode,quantity:numeric(entry.quantity,code+' cantidad', {zero:false}),
    wastePct:numeric(entry.wastePct===undefined?0:entry.wastePct,code+' merma',{max:100}),
    yield:numeric(entry.yield===undefined?1:entry.yield,code+' rendimiento',{zero:false,max:1e7})};
  });
  partidas.set(code,{code,name:text(p.name,code+' nombre'),unit:text(p.unit,code+' unidad'),components});
 }
 // Return plain JSON-compatible dictionaries safe to serialize into a project snapshot.
 return {
  resources:Object.fromEntries(resources),
  partidas:Object.fromEntries(partidas)
 };
}
function costPartida(catalog,code){
 if(!catalog||!catalog.partidas||!catalog.resources)throw new Error('Catálogo APU inválido');
 const partida=catalog.partidas[code];
 if(!partida||!Array.isArray(partida.components))throw new Error('Partida APU desconocida: '+code);
 let sum=0;
 for(const component of partida.components){
  const res=catalog.resources[component.resourceCode];
  if(!res||!res.validatedPrice)throw new Error('Insumo sin precio validado: '+component.resourceCode);
  const amount=res.priceClp*component.quantity*(1+component.wastePct/100)/component.yield;
  if(!Number.isFinite(amount)||amount<0)throw new RangeError('Costo APU desbordado: '+code);
  sum+=amount;
 }
 if(!Number.isFinite(sum)||sum>Number.MAX_SAFE_INTEGER)
  throw new RangeError('Total APU fuera de rango: '+code);
 return Math.round(sum);
}
return Object.freeze({importCatalog,costPartida});
});