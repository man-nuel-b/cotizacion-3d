'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {parse}=require('../ai-command-core-v1.js');
const {stage}=require('../ai-command-executor-v1.js');
const fake={
 state:{counts:{window:2,door:1,partition:0,openingFrame:0},container:'20hc'},
 DATA:{extras:{window:{max:8},door:{max:6},partition:{max:6},openingFrame:{max:8}}},
 schemas:{
 window:{fields:[{key:'width',min:.4,max:2.4},{key:'height',min:.4,max:1.8}]},
 door:{fields:[{key:'width',min:.7,max:1.6},{key:'height',min:1.8,max:2.5}]},
 partition:{fields:[{key:'length',min:.3,max:12},{key:'height',min:.3,max:2.85},{key:'thickness',min:.05,max:.2}]},
 openingFrame:{fields:[{key:'width',min:.7,max:1.6},{key:'height',min:1.8,max:2.5}]}
 },
 container:{length:6.06,width:2.44,height:2.89}
};
test('Commands interpret dimensions in centimetres, facing, and counts',()=>{
 const r=parse('Agrega 2 ventanas de 120 x 100 cm en cara A');
 assert.equal(r.ok,true,JSON.stringify(r.errors));
 assert.equal(r.actions.length,1);
 assert.equal(r.actions[0].type,'window');
 assert.equal(r.actions[0].quantity,2);
 assert.equal(r.actions[0].face,'A');
 assert.equal(r.actions[0].width,1.2);
 assert.equal(r.actions[0].height,1);
 assert.equal(stage(r,fake).changes.length,1);
});
test('Partitions keep length, height, thickness, and orientation',()=>{
 const r=parse('Crea un tabique longitudinal de 2,20 metros de largo y 2,40 metros de alto y espesor 75 mm');
 assert.equal(r.ok,true,JSON.stringify(r.errors));
 assert.equal(r.actions[0].kind,'addPartition');
 assert.equal(r.actions[0].length,2.2);
 assert.equal(r.actions[0].height,2.4);
 assert.equal(r.actions[0].thickness,.075);
 assert.equal(r.actions[0].orientation,'long');
 assert.equal(stage(r,fake).changes.length,1);
});
test('Never guess face or unsupported materials',()=>{
 assert.equal(parse('agrega una ventana').ok,false);
 assert.equal(parse('agrega una ventana de 120 x 100 cm').ok,false);
 assert.equal(parse('pon un revestimiento de mármol').ok,false);
});
test('Changes are atomic: invalid instructions discard all actions',()=>{
 const r=parse('Agrega una ventana en cara A; Agrega una ventana sin ubicación');
 assert.equal(r.ok,false);assert.equal(r.actions.length,0);
});
test('Preview catches count and dimensions errors without mutating state',()=>{
 const env=structuredClone(fake);
 assert.throws(()=>stage(parse('Agrega 4 ventanas en cara A'),env),/máximo/i);
 assert.throws(()=>stage(parse('Agrega una ventana de 300 x 100 cm en cara A'),env),/fuera de rango/i);
 assert.deepEqual(env,fake);
});
test('Remove requires explicit last item and never removes below zero',()=>{
 assert.equal(parse('quita la ventana').ok,false);
 const r=parse('quita la última ventana');
 assert.equal(r.ok,true);
 const env=structuredClone(fake);
 assert.equal(stage(r,env).changes[0].kind,'removeLast');
 env.state.counts.window=0;
 assert.throws(()=>stage(r,env),/no hay/i);
});
test('Exterior quotes and core editor remain unmodified; scripts parse in JS',()=>{
 for(const name of ['ai-command-core-v1.js','ai-command-executor-v1.js','ai-assistant-ui-v1.js']){
  new vm.Script(fs.readFileSync(path.join(__dirname,'..',name),'utf8'),{filename:name});
 }
 const ui=fs.readFileSync(path.join(__dirname,'..','ai-assistant-ui-v1.js'),'utf8');
 assert.match(ui,/Confirmar cambios en 3D/);
 assert.match(ui,/approve/);
 const engine=fs.readFileSync(path.join(__dirname,'..','ai-command-executor-v1.js'),'utf8');
 assert.match(engine,/pushHistory\(\)/);
 assert.match(engine,/state=original/);
 assert.doesNotMatch(engine,/localStorage\.setItem|fetch\(|apiKey|OPENAI_API_KEY/);
});
