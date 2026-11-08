'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const core=require('../extras-state-core.js');

test('Deleting first electrical point preserves exact following identities and indexes',()=>{
  const project={counts:{electrical:3},electrical:{version:1,points:[
    {id:'A',type:'outlet'}, {id:'B',type:'light'}, {id:'C',type:'switch'}]},
    layout:{electrical:[{face:'A',x:0},{face:'B',x:.5},{face:'D',x:1}]},
    dimensions:{electrical:[{height:1},{height:2},{height:3}]}
  };
  const removed=core.removeAt(project,'electrical',0);
  assert.equal(removed.ok,true);
  assert.equal(project.counts.electrical,2);
  assert.deepEqual(project.electrical.points.map(p=>p.id),['B','C']);
  assert.deepEqual(project.electrical.points.map(p=>p.type),['light','switch']);
  assert.deepEqual(project.layout.electrical.map(p=>p.face),['B','D']);
  assert.deepEqual(project.dimensions.electrical.map(d=>d.height),[2,3]);
  assert.equal(core.removeAt(project,'electrical',9).ok,false);
  assert.equal(project.counts.electrical,2);
});
test('Deleting typed electrical point from card removes matching layout and not last unrelated point',()=>{
  const project={counts:{electrical:3},electrical:{points:[
    {id:'a',type:'outlet'},{id:'b',type:'light'},{id:'c',type:'switch'}]},
    layout:{electrical:[{x:1},{x:2},{x:3}]},dimensions:{electrical:[{v:1},{v:2},{v:3}]}};
  assert.equal(core.removeElectricalType(project,'light').ok,true);
  assert.deepEqual(project.electrical.points.map(p=>p.type),['outlet','switch']);
  assert.deepEqual(project.layout.electrical.map(p=>p.x),[1,3]);
  assert.deepEqual(project.dimensions.electrical.map(p=>p.v),[1,3]);
  assert.equal(project.counts.electrical,2);
});
test('Adding electrical points writes typed point and matching legacy count exactly once',()=>{
  const state={counts:{electrical:0},electrical:{points:[]}};
  assert.equal(core.addElectricalPoint(state,{id:'id-7',type:'light'},24).ok,true);
  assert.equal(core.addElectricalPoint(state,{id:'id-8',type:'switch'},24).ok,true);
  assert.equal(state.counts.electrical,2);
  assert.deepEqual(state.electrical.points.map(p=>p.id),['id-7','id-8']);
  assert.equal(core.addElectricalPoint(state,{type:'outlet'},2).ok,false);
  assert.equal(state.counts.electrical,2);
});
test('Never silently truncate valid electrical points when legacy count becomes inconsistent',()=>{
  const state={counts:{electrical:1},electrical:{points:[
    {id:'A',type:'outlet'},{id:'B',type:'switch'}]}};
  const original=JSON.stringify(state);
  assert.equal(core.reconcileElectrical(state).ok,false);
  assert.equal(core.removeAt(state,'electrical',0).ok,false);
  assert.equal(JSON.stringify(state),original);
});
test('Shared mounted insertion only after a valid face choice; delete keeps indexed dimensions aligned',()=>{
  const state={counts:{window:0},layout:{window:[]},dimensions:{window:[]}};
  assert.equal(core.addMountedAt(state,'window','Q',0,4).ok,false);
  assert.equal(state.counts.window,0);
  assert.equal(core.addMountedAt(state,'window','A',0,4).ok,true);
  assert.equal(core.addMountedAt(state,'window','B',1,4).ok,true);
  state.dimensions.window=[{width:1.2},{width:1.5}];
  assert.equal(core.removeAt(state,'window',0).ok,true);
  assert.equal(state.counts.window,1);
  assert.equal(state.layout.window[0].face,'B');
  assert.equal(state.dimensions.window[0].width,1.5);
});
test('Partition area uses actual dimensions, supports mixed nominal and custom cuts',()=>{
  const c={width:2.44,height:2.89};
  const s={counts:{partition:2},dimensions:{partition:[{length:1.2,height:2.0},{}]}};
  assert.equal(Math.round(core.partitionArea(s,c)*1000)/1000,9.452);
});
test('Bath module fixture mapping includes both preset types without double counting standalone fixtures',()=>{
  const s={bathroomModules:[{kind:'full'},{kind:'half'}],counts:{wc:1,sink:1,shower:0}};
  assert.deepEqual(core.bathroomFixtures(s),{wc:2,sink:2,shower:1});
});
