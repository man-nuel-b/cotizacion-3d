'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const State=require('../core/project-state');
const Bridge=require('../core/model-cost-bridge');
const Catalog=require('../core/catalog');

test('25 aberturas -> una revisión y un presupuesto consistente por cambio',()=>{
 const store=Bridge.createStore();
 const observed=[];
 store.subscribe((state,action,projection)=>{
  assert.equal(state.revision,projection.revision);
  assert.equal(projection.quote.lines.find(row=>row.code==='WINDOW').qty,state.openings.length);
  assert.equal(projection.bom.metrics.openingArea,Math.round(state.openings.length*.16*.6*1000)/1000);
  assert.equal(projection.quote.total,projection.quote.net+projection.quote.vat);
  observed.push(projection.revision);
 });
 for(let i=0;i<25;i++){
  store.dispatch({type:'opening/add',kind:'window',face:'A',width:.16,height:.6,bottom:1,offset:-2.75+i*.23});
 }
 assert.equal(store.getState().openings.length,25);
 assert.equal(store.getProjection().quote.lines.find(row=>row.code==='WINDOW').qty,25);
 assert.deepEqual(observed,Array.from({length:25},(_,i)=>i+1));
 const beforeState=store.getState(),beforeProjection=store.getProjection();
 assert.throws(()=>store.dispatch({type:'opening/add',kind:'window',face:'A',width:1,height:1,bottom:1,offset:0}),/superpuestas/);
 assert.deepEqual(store.getState(),beforeState);
 assert.deepEqual(store.getProjection(),beforeProjection);
 assert.equal(observed.length,25,'notificar solo acciones válidas');
});
test('Tabiques cruzados X/Z se rechazan con espesores reales',()=>{
 const store=Bridge.createStore();
 store.dispatch({type:'partition/add',orientation:'x',length:3,height:2.4,x:0,z:0,thickness:.12});
 const before=store.getState(),beforeProjection=store.getProjection();
 assert.throws(()=>store.dispatch({type:'partition/add',orientation:'z',length:1.5,height:2,x:0,z:0,thickness:.08}),/superpuestos/);
 assert.deepEqual(store.getState(),before);
 assert.deepEqual(store.getProjection(),beforeProjection);
 store.dispatch({type:'partition/add',orientation:'z',length:.6,height:2,x:2,z:.5,thickness:.08});
 assert.equal(store.getState().partitions.length,2);
 assert.equal(store.getProjection().bom.metrics.partitionArea,Math.round((3*2.4+.6*2)*1000)/1000);
 const second=store.getState(),priorCost=store.getProjection().quote.total;
 assert.throws(()=>store.dispatch({type:'partition/move',id:second.partitions[1].id,x:0,z:0}),/superpuestos/);
 assert.equal(store.getProjection().quote.total,priorCost);
 assert.deepEqual(store.getState(),second);
});
test('20 tabiques distribuidos en paralelo tienen áreas y costos estables',()=>{
 const store=Bridge.createStore();
 for(let i=0;i<20;i++)
  store.dispatch({type:'partition/add',orientation:'x',length:1,height:2,x:0,z:-.95+i*.1,thickness:.05});
 const projected=store.getProjection();
 assert.equal(store.getState().partitions.length,20);
 assert.equal(projected.bom.metrics.partitionArea,40);
 assert.equal(projected.bom.lines.find(x=>x.code==='PARTITION').qty,80);
 assert.ok(Number.isSafeInteger(projected.quote.total));
 assert.equal(projected.revision,20);
});
test('Cambios de precio rápidos conservan siempre la última revisión',()=>{
 const store=Bridge.createStore();
 for(let i=0;i<75;i++){
  const state=store.dispatch({type:'pricing/update',key:'transport',value:i*1234});
  const projection=store.getProjection();
  assert.equal(projection.revision,state.revision);
  assert.equal(projection.quote.transport,i*1234);
 }
 assert.equal(store.getProjection().quote.transport,74*1234);
 assert.equal(store.getState().revision,75);
});
test('Fallo en derivación APU/BOM anula la acción sin modificar el estado',()=>{
 const store=State.createStore(State.defaults(),{
  derive:project=>{
   if(project.partitions.length>0)throw new Error('APU ausente');
   return {revision:project.revision,ready:true};
  }
 });
 const before=store.getState(),derived=store.getProjection();
 let notified=0;
 store.subscribe(()=>notified++);
 assert.throws(()=>store.dispatch({type:'partition/add',length:1,height:2,x:0,z:0}),/APU ausente/);
 assert.deepEqual(store.getState(),before);
 assert.deepEqual(store.getProjection(),derived);
 assert.equal(notified,0);
});
test('No se admite catálogo de precios incompleto ni estado de lectura mutable',()=>{
 assert.throws(()=>Bridge.createStore(State.defaults(),{...Catalog,WINDOW:null}),/inválido/);
 const store=Bridge.createStore();
 const snap=store.getProjection();
 snap.quote.total=-5;snap.bom.lines[0].qty=-1;
 assert.notEqual(store.getProjection().quote.total,-5);
 assert.ok(store.getProjection().bom.lines[0].qty>0);
 assert.throws(()=>store.dispatch({type:'partition/add',orientation:'z',length:4,height:2,x:0,z:0,thickness:.08}),/fuera/);
});

test('Texto numérico vacío y tipos objeto no se convierten en precios cero',()=>{
 for(const invalid of ['   ',[],{},'0x20']){
  const store=Bridge.createStore();
  const before=store.getState(),projection=store.getProjection();
  assert.throws(()=>store.dispatch({type:'pricing/update',key:'transport',value:invalid}),/inválido/);
  assert.deepEqual(store.getState(),before);
  assert.deepEqual(store.getProjection(),projection);
  assert.throws(()=>Bridge.createStore(State.defaults(),{...Catalog,FLOOR:invalid}),/inválido/);
 }
});

test('Los formularios HTML envían texto decimal válido sin alterar el BOM',()=>{
 const store=Bridge.createStore();
 const updated=store.dispatch({type:'opening/add',kind:'window',face:'A',width:'1.20',height:'1.10',offset:'-0.25',bottom:'0.90'});
 assert.equal(updated.openings.length,1);
 assert.equal(updated.openings[0].offset,-.25);
 const after=store.dispatch({type:'pricing/update',key:'transport',value:'125000'});
 assert.equal(after.pricing.transport,125000);
 assert.equal(store.getProjection().quote.transport,125000);
 assert.equal(store.getProjection().bom.lines.find(r=>r.code==='WINDOW').qty,1);
});
