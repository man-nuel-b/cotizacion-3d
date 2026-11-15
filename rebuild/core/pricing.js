/* One financial engine. CLP integer rounding at line and tax boundaries. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.BatPricing=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const roundCLP=n=>Math.round((n+Number.EPSILON));
const assertNum=(value,label)=>{
 if((typeof value!=='number'&&typeof value!=='string')||
    (typeof value==='string'&&!/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value.trim())))
  throw new RangeError('Valor financiero inválido: '+label);
 const n=Number(value);
 if(!Number.isFinite(n)||n<0)throw new RangeError('Valor financiero inválido: '+label);
 return n;
};
function calculate(takeoff,priceBook,settings){
 if(!takeoff||!Array.isArray(takeoff.lines))throw new Error('BOM inválido');
 const priced=takeoff.lines.map(line=>{
  const price=assertNum(priceBook?.[line.code],'precio '+line.code);
  const qty=assertNum(line.qty,'cantidad '+line.code);
  return {...line,unitCost:price,subtotal:roundCLP(qty*price)};
 });
 const materials=priced.reduce((sum,line)=>sum+line.subtotal,0);
 const transport=roundCLP(assertNum(settings.transport,'transporte'));
 const direct=materials+transport;
 const overhead=roundCLP(direct*assertNum(settings.overheadPct,'gastos generales')/100);
 const profit=roundCLP(direct*assertNum(settings.profitPct,'utilidad')/100);
 const contingency=roundCLP((direct+overhead+profit)*assertNum(settings.contingencyPct,'imprevistos')/100);
 const net=direct+overhead+profit+contingency;
 const vat=roundCLP(net*assertNum(settings.taxPct,'IVA')/100);
 return {lines:priced,materials,transport,direct,overhead,profit,contingency,net,vat,total:net+vat,currency:'CLP',status:'estimación referencial'};
}
return Object.freeze({calculate,roundCLP});
});