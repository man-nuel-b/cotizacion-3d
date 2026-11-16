'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const State=require('../core/project-state');
const Bridge=require('../core/model-cost-bridge');
const Visual=require('../container-visual');
test('the user reference container is the canonical 12.03 × 2.35 × 2.39 m starting module',()=>{
 const c=State.defaults().project.container;
 assert.deepEqual(c,{length:12.03,width:2.35,height:2.39,color:'#7d8388',type:'maritimo'});
 assert.equal(Visual.FLOOR,.14);
 assert.deepEqual(Object.keys(Visual.FACES).sort(),['A','B','C','D']);
 assert.deepEqual(Visual.FACES.A.normal,[0,0,-1]);
 assert.deepEqual(Visual.FACES.B.normal,[0,0,1]);
 assert.deepEqual(Visual.FACES.C.normal,[-1,0,0]);
 assert.deepEqual(Visual.FACES.D.normal,[1,0,0]);
});
test('finish color is validated in the central state without repricing the existing BOM',()=>{
 const store=Bridge.createStore(),quoteBefore=store.getProjection().quote.total;
 const updated=store.dispatch({type:'container/color',color:'#445566'});
 assert.equal(updated.project.container.color,'#445566');
 assert.equal(store.getProjection().quote.total,quoteBefore);
 assert.equal(updated.revision,1);
 const before=store.getState();
 for(const invalid of ['red',null,'#FFF','<img>','#gggggg']){
  assert.throws(()=>store.dispatch({type:'container/color',color:invalid}),/Color/);
  assert.deepEqual(store.getState(),before);
 }
 const resized=store.dispatch({type:'container/resize',length:10,width:2.35,height:2.39});
 assert.equal(resized.project.container.color,'#445566');
 assert.equal(store.getProjection().revision,resized.revision);
});
test('legacy projects without color remain valid and render with a default finish',()=>{
 const old=State.defaults();delete old.project.container.color;
 assert.doesNotThrow(()=>State.check(old));
 assert.equal(Bridge.createStore(old).getProjection().revision,0);
});
