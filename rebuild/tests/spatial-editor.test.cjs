'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const State=require('../core/project-state');
const Spatial=require('../core/spatial');
const Materials=require('../core/materials');
const Pricing=require('../core/pricing');
const Catalog=require('../core/catalog');

function quote(store){
 const state=store.getState();
 return Pricing.calculate(Materials.takeoff(state),Catalog,state.pricing);
}
test('Each wall face maps correctly from metre coordinates',()=>{
 const c=State.defaults().project.container;
 assert.equal(Spatial.faceFromPoint({x:0,y:1,z:-c.width/2},c),'A');
 assert.equal(Spatial.faceFromPoint({x:0,y:1,z:c.width/2},c),'B');
 assert.equal(Spatial.faceFromPoint({x:-c.length/2,y:1,z:0},c),'C');
 assert.equal(Spatial.faceFromPoint({x:c.length/2,y:1,z:0},c),'D');
 assert.throws(()=>Spatial.faceFromPoint({x:0,y:1,z:0},c),/pared/);
});
test('Pointer placement clamps inward and snaps horizontal and vertical coordinates',()=>{
 const c=State.defaults().project.container;
 const a=Spatial.placementFromHit({x:c.length/2,y:2.1,z:c.width/2-.03},c,{kind:'window',width:1.2,height:1});
 assert.equal(a.face,'D');
 assert.ok(Math.abs(a.offset)+.6<c.width/2);
 assert.ok(a.bottom>=0&&a.bottom+1<c.height);
 assert.ok(Number.isFinite(a.bottom)&&Math.abs(a.bottom*20-Math.round(a.bottom*20))<1e-8);
 const b=Spatial.placementFromHit({x:0,y:1.3,z:-c.width/2},c,{kind:'door',width:.9,height:2});
 assert.deepEqual(b,{face:'A',offset:0,bottom:0});
 assert.throws(()=>Spatial.placementFromHit({x:0,y:1,z:0},c,{kind:'window',width:1,height:1}),/pared/);
 assert.throws(()=>Spatial.placementFromHit({x:0,y:1,z:-c.width/2},c,{kind:'window',width:14,height:1}),/no cabe/);
});
test('Two openings at same horizontal position may coexist only when vertically separate',()=>{
 const store=State.createStore();
 store.dispatch({type:'opening/add',kind:'window',face:'A',width:.8,height:.5,bottom:1.6,offset:0});
 store.dispatch({type:'opening/add',kind:'window',face:'A',width:.8,height:.5,bottom:.6,offset:0});
 const before=store.getState();
 assert.throws(()=>store.dispatch({type:'opening/add',kind:'door',face:'A',width:.8,height:2,bottom:0,offset:0}),/superpuestas/);
 assert.deepEqual(store.getState(),before);
});
test('Click placement, geometry edits and BOM costs share one revision',()=>{
 const store=State.createStore();
 const c=store.getState().project.container;
 const placement=Spatial.placementFromHit({x:1,y:1.3,z:c.width/2},c,{kind:'window',width:1.2,height:1});
 const before=quote(store);
 const next=store.dispatch({type:'opening/add',kind:'window',width:1.2,height:1,...placement});
 const line=Materials.takeoff(next).lines.find(x=>x.code==='WINDOW');
 assert.equal(next.revision,1);
 assert.equal(line.qty,1);
 assert.ok(quote(store).total!==before.total);
 const id=next.openings[0].id,priorQuote=quote(store);
 store.dispatch({type:'opening/move',id,face:'C',offset:.2,bottom:1});
 assert.equal(quote(store).total,priorQuote.total,'position must not change quantities');
 assert.equal(store.getState().openings[0].face,'C');
});
test('Invalid move is atomic and cannot desynchronize quote',()=>{
 const store=State.createStore();
 store.dispatch({type:'opening/add',kind:'window',face:'A',width:1,height:1,bottom:1});
 const before=store.getState(),total=quote(store).total;
 assert.throws(()=>store.dispatch({type:'opening/move',id:before.openings[0].id,face:'C',offset:10}),/fuera/);
 assert.deepEqual(store.getState(),before);
 assert.equal(quote(store).total,total);
});
test('Imported legacy opening without bottom is supported at floor elevation',()=>{
 const project=State.defaults();
 project.openings.push({id:'old-opening',kind:'window',face:'B',width:1,height:1,offset:0});
 const store=State.createStore(project);
 assert.equal(store.getState().openings[0].bottom,undefined);
 assert.doesNotThrow(()=>Materials.takeoff(store.getState()));
});
