'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const State=require('../core/project-state');
const Materials=require('../core/materials');
const Pricing=require('../core/pricing');
const Catalog=require('../core/catalog');
test('immutable store with one state drives BOM and quote',()=>{
 const store=State.createStore();const first=store.getState();const original=Materials.takeoff(first),base=Pricing.calculate(original,Catalog,first.pricing);
 store.dispatch({type:'opening/add',kind:'window',face:'A',width:1.2,height:1.1});
 const second=store.getState(),bom=Materials.takeoff(second),quote=Pricing.calculate(bom,Catalog,second.pricing);
 assert.equal(first.openings.length,0);assert.equal(second.openings.length,1);
 assert.equal(bom.metrics.openingArea,1.32);
 assert.equal(bom.metrics.netWallArea,Math.round((original.metrics.netWallArea-1.32)*1000)/1000);
 assert.notEqual(quote.total,base.total);
 assert.equal(quote.lines.find(x=>x.code==='WINDOW').qty,1);
});
test('invalid container and opening boundaries fail atomically',()=>{
 const store=State.createStore();const before=store.getState();
 assert.throws(()=>store.dispatch({type:'opening/add',kind:'window',face:'A',width:50,height:2}),/fuera/);
 assert.throws(()=>store.dispatch({type:'container/resize',length:0,width:2,height:2}),/inválido/);
 assert.deepEqual(store.getState(),before);
});
test('CLP rounding, VAT and aggregation are deterministic',()=>{
 const s=State.defaults(),b=Materials.takeoff(s),a=Pricing.calculate(b,Catalog,s.pricing);
 assert.equal(a.total,a.net+a.vat);assert.equal(a.direct,a.materials+a.transport);
 assert.equal(a.materials,a.lines.reduce((v,l)=>v+l.subtotal,0));
 assert.equal(Pricing.calculate(b,Catalog,s.pricing).total,a.total);
});
test('price book missing entries must fail, never silently become zero',()=>{
 const s=State.defaults();assert.throws(()=>Pricing.calculate(Materials.takeoff(s),{},s.pricing),/inválido/);
});
test('project replacement is validated and maintains source integrity',()=>{
 const store=State.createStore();const snapshot=store.getState();snapshot.project.container.width=2.7;
 store.dispatch({type:'project/replace',project:snapshot});
 assert.equal(store.getState().project.container.width,2.7);
 snapshot.project.container.width=0;assert.equal(store.getState().project.container.width,2.7);
});
test('subscriptions receive each committed change once',()=>{
 const store=State.createStore();let count=0;const stop=store.subscribe(()=>count++);
 store.dispatch({type:'pricing/update',key:'transport',value:100000});
 stop();store.dispatch({type:'pricing/update',key:'transport',value:50000});
 assert.equal(count,1);assert.equal(store.getState().pricing.transport,50000);
});