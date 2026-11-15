'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const State=require('../core/project-state');
const Materials=require('../core/materials');
const Pricing=require('../core/pricing');
const Catalog=require('../core/catalog');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
test('invalid blank/null/NaN geometry inputs are rejected atomically',()=>{
 const store=State.createStore(),initial=store.getState();
 for(const width of [null,'',false,'wat',NaN]){
  assert.throws(()=>store.dispatch({type:'opening/add',kind:'window',face:'A',width,height:1}),/inválido/);
  assert.deepEqual(store.getState(),initial);
 }
 for(const length of [null,'',false,NaN]){
  assert.throws(()=>store.dispatch({type:'container/resize',length,width:2,height:2}),/inválido/);
  assert.deepEqual(store.getState(),initial);
 }
});
test('openings on same face cannot overlap; other faces stay independent',()=>{
 const store=State.createStore();
 store.dispatch({type:'opening/add',kind:'window',face:'A',width:1,height:1,offset:0});
 const before=store.getState();
 assert.throws(()=>store.dispatch({type:'opening/add',kind:'door',face:'A',width:1,height:2,offset:.25}),/superpuestas/);
 assert.deepEqual(store.getState(),before);
 store.dispatch({type:'opening/add',kind:'window',face:'B',width:1,height:1,offset:0});
 assert.equal(store.getState().openings.length,2);
});
test('face C and D offsets enforce short-face boundaries',()=>{
 const store=State.createStore();
 store.dispatch({type:'opening/add',kind:'window',face:'C',width:.7,height:1,offset:.8});
 assert.equal(store.getState().openings[0].offset,.8);
 const before=store.getState();
 assert.throws(()=>store.dispatch({type:'opening/add',kind:'window',face:'D',width:1.5,height:1,offset:1}),/fuera/);
 assert.deepEqual(store.getState(),before);
 const source=read('main.js');
 assert.match(source,/long\?0:o\.offset/);
 assert.match(source,/offset:\$\('opening-offset'\)\.value/);
});
test('moving an opening recalculates store synchronously without changing BOM count',()=>{
 const store=State.createStore();
 store.dispatch({type:'opening/add',kind:'window',face:'A',width:1,height:1,offset:0});
 const id=store.getState().openings[0].id;
 const prior=Pricing.calculate(Materials.takeoff(store.getState()),Catalog,store.getState().pricing);
 let calls=0;
 store.subscribe(()=>calls++);
 store.dispatch({type:'opening/move',id,face:'C',offset:.2});
 assert.equal(calls,1);
 assert.equal(store.getState().openings[0].face,'C');
 assert.equal(Pricing.calculate(Materials.takeoff(store.getState()),Catalog,store.getState().pricing).total,prior.total);
});
test('partitions cannot escape container bounds, including on import',()=>{
 const store=State.createStore(),before=store.getState();
 assert.throws(()=>store.dispatch({type:'partition/add',length:4,height:2,x:2,z:0}),/fuera/);
 assert.deepEqual(store.getState(),before);
 const corrupt=store.getState();
 corrupt.partitions=[{id:'p1',length:2,height:2,x:0,z:10}];
 assert.throws(()=>store.dispatch({type:'project/replace',project:corrupt}),/fuera/);
 assert.deepEqual(store.getState(),before);
});
test('partition collision is rejected without mutating revision or BOM',()=>{
 const store=State.createStore();
 store.dispatch({type:'partition/add',length:2,height:2,x:0,z:0});
 const before=store.getState();
 const bomBefore=Materials.takeoff(before);
 assert.throws(()=>store.dispatch({type:'partition/add',length:1,height:2,x:.3,z:0}),/superpuestos/);
 assert.deepEqual(store.getState(),before);
 assert.deepEqual(Materials.takeoff(store.getState()),bomBefore);
 store.dispatch({type:'partition/add',length:1,height:2,x:0,z:.3});
 assert.equal(store.getState().partitions.length,2);
});

test('numeric quotes reject absent/null/blank pricing and BOM inputs',()=>{
 const state=State.defaults(),bom=Materials.takeoff(state);
 for(const invalid of [null,undefined,'',false,NaN,Infinity]){
  assert.throws(()=>Pricing.calculate(bom,{...Catalog,FLOOR:invalid},state.pricing),/inválido/);
  assert.throws(()=>Pricing.calculate({...bom,lines:[{...bom.lines[0],qty:invalid}]},Catalog,state.pricing),/inválido/);
  assert.throws(()=>State.createStore().dispatch({type:'pricing/update',key:'transport',value:invalid}),/inválido/);
 }
});
test('project loading rejects duplicate ids or invalid price structure',()=>{
 const store=State.createStore();
 const project=store.getState();
 project.openings=[
  {id:'duplicate',kind:'window',face:'A',offset:-1,width:.5,height:.5},
  {id:'duplicate',kind:'door',face:'B',offset:1,width:.5,height:1}
 ];
 assert.throws(()=>store.dispatch({type:'project/replace',project}),/duplicado/);
 project.openings=[];
 project.pricing=null;
 assert.throws(()=>store.dispatch({type:'project/replace',project}),/Precios/);
});
test('every successful change synchronizes BOM and price from same revision',()=>{
 const store=State.createStore(),observed=[];
 store.subscribe(state=>{
  const takeoff=Materials.takeoff(state),quote=Pricing.calculate(takeoff,Catalog,state.pricing);
  observed.push({revision:state.revision,windowCount:takeoff.lines.find(x=>x.code==='WINDOW').qty,total:quote.total});
 });
 for(let i=0;i<6;i++)store.dispatch({type:'opening/add',kind:'window',face:'A',width:.2,height:.5,offset:-2+i*.7});
 assert.deepEqual(observed.map(x=>x.revision),[1,2,3,4,5,6]);
 assert.deepEqual(observed.map(x=>x.windowCount),[1,2,3,4,5,6]);
 assert.equal(observed.every(x=>Number.isFinite(x.total)),true);
});
