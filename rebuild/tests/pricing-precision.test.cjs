'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Pricing=require('../core/pricing');
const State=require('../core/project-state');
test('CLP prices round each invoice line to whole pesos, never cents',()=>{
 const settings={...State.defaults().pricing,overheadPct:0,profitPct:0,taxPct:19,contingencyPct:0};
 const bom={lines:[{code:'A',name:'A',unit:'m²',qty:.25},{code:'B',name:'B',unit:'m²',qty:.25}]};
 const result=Pricing.calculate(bom,{A:10,B:10},settings);
 assert.deepEqual(result.lines.map(x=>x.subtotal),[3,3]);
 assert.equal(result.materials,6);
 assert.equal(result.vat,1);
 assert.equal(result.total,7);
 assert.equal(result.total,result.net+result.vat);
 assert.equal(Number.isSafeInteger(result.total),true);
});
test('floating point geometry quantities cannot result in NaN or fractional totals',()=>{
 const qty=.1+.2;
 const settings=State.defaults().pricing;
 const result=Pricing.calculate({lines:[{code:'A',name:'A',unit:'m²',qty}]},{A:10000},settings);
 assert.equal(result.lines[0].subtotal,3000);
 assert.equal(Number.isSafeInteger(result.total),true);
 assert.equal(result.total,result.net+result.vat);
});
test('invalid numeric cells and divide-by-zero outputs fail before any quote',()=>{
 const s=State.defaults().pricing;
 for(const bad of [null,undefined,'',NaN,Infinity,-Infinity,{},false]){
  assert.throws(()=>Pricing.calculate({lines:[{code:'A',name:'A',unit:'m²',qty:bad}]},{A:100},s),/inválido/);
 }
 assert.throws(()=>Pricing.calculate({lines:[{code:'A',name:'A',unit:'m²',qty:1}]},{A:0/0},s),/inválido/);
});
