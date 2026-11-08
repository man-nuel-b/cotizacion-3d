'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const api=require('../electrical-circuit-core-v1.js');
const container={length:6.06,width:2.44,height:2.89};
const points=[
 {id:'L-1',type:'light',circuitId:'L1',designWatts:24},
 {id:'I-1',type:'switch',circuitId:'L1',linkedLightId:'L-1'},
 {id:'E-1',type:'outlet',circuitId:'E1',designWatts:120},
 {id:'F-1',type:'acPoint',circuitId:'F1',designWatts:900}
];
const positions=[
 {face:'ceiling',x:0,z:0},
 {face:'A',x:-.5,y:1.1},
 {face:'A',x:.5,y:.35},
 {face:'B',x:0,y:2.1}
];
test('Circuit groups classify points and sum declared watts, excluding switch',()=>{
 const model={counts:{electrical:4},electrical:{points},constructionRules:{enabled:true,board:true,ground:true}};
 const r=api.inspect(model,container,positions);
 assert.equal(r.errors.length,0);
 assert.equal(r.circuits.find(x=>x.id==='L1').estimatedW,24);
 assert.equal(r.circuits.find(x=>x.id==='E1').estimatedW,120);
 assert.equal(r.circuits.find(x=>x.id==='F1').estimatedW,900);
 assert.equal(r.routes.length,4);
 assert.ok(r.totalMeters>0);
 assert.ok(r.warnings.some(x=>x.code==='ENGINEERING_PENDING'));
});
test('Switch without light causes explicit error; no guessed connection',()=>{
 const model={counts:{electrical:2},electrical:{points:[{id:'L',type:'light'},{id:'S',type:'switch'}]}};
 const r=api.inspect(model,container,[positions[0],positions[1]]);
 assert.ok(r.errors.some(x=>x.code==='SWITCH_NOT_LINKED'));
 assert.ok(r.warnings.some(x=>x.code==='LOAD_PENDING'));
 assert.equal(r.readyForFinalQuote,false);
});
test('Invalid circuit and switch target raise error',()=>{
 const model={counts:{electrical:2},electrical:{points:[{id:'L',type:'light',circuitId:'L1',designWatts:10},{id:'S',type:'switch',circuitId:'E1',linkedLightId:'absent'}]}};
 const r=api.inspect(model,container,[positions[0],positions[1]]);
 assert.ok(r.errors.some(x=>x.code==='CIRCUIT_MISMATCH'));
 assert.ok(r.errors.some(x=>x.code==='SWITCH_TARGET_INVALID'));
});
test('Conceptual route returns monotonic nonnegative length and never prices copper',()=>{
 const a=api.referencePath({face:'A',x:0,height:1.55},positions[2],container);
 assert.ok(a.length>0);
 assert.ok(a.vertices.length>=2);
 assert.equal(typeof a.materialCost,'undefined');
});
test('Existing manual editor and APU core remain intact',()=>{
 const js=fs.readFileSync(path.join(__dirname,'..','electrical-circuit-ui-v1.js'),'utf8');
 new vm.Script(js);
 const core=fs.readFileSync(path.join(__dirname,'..','electrical-circuit-core-v1.js'),'utf8');
 new vm.Script(core);
 assert.match(js,/renderAll/);
 assert.doesNotMatch(js,/function calculate|buildBOM\s*=|API_KEY|service_role/);
 assert.match(core,/No es proyecto, plano ejecutivo ni certificación SEC/);
});
