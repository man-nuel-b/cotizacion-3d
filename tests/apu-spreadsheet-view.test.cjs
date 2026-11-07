'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {model}=require('../apu-spreadsheet-view-v1.js');
test('Worksheet shows separate materials, crew and tools equal to canonical direct APU',()=>{
 const apu={id:'excel:P01',unit:'m²',components:[
  {resourceId:'excel:M001',qty:1,waste:5,yield:1},
  {resourceId:'excel:M004',qty:1,waste:10,yield:1}]};
 const master={resources:{
  'excel:M001':{code:'M001',name:'Vinilico',unit:'m²',type:'material',price:17638},
  'excel:M004':{code:'M004',name:'Membrana',unit:'m²',type:'material',price:758}}};
 const settings={socialCharges:30,toolsPct:5,crews:{'excel:P01':{role:'specialist',yield:25,masters:1,helpers:1}},wages:{specialist:70000,helper:42000,master:60000}};
 const materials=17638*1.05+758*1.1;
 const labor=(70000+42000)*1.3/25,tools=labor*.05,direct=materials+labor+tools;
 const b={materials,labor,tools,equipment:0,direct,overhead:direct*.15,profit:direct*.10,net:direct*1.25,tax:direct*1.25*.19,gross:direct*1.25*1.19};
 const view=model(apu,master,settings,b,12);
 assert.equal(view.rows.length,5);
 assert.equal(view.rows.filter(x=>x.type==='Material').length,2);
 assert.equal(view.rows.filter(x=>x.type==='Mano de obra').length,2);
 assert.equal(view.rows.filter(x=>x.type==='Equipo').length,1);
 assert.ok(view.variance<.001);
 assert.equal(view.rows[0].amount,1.05);
 assert.equal(view.rows[0].total,12.6);
 assert.equal(view.missing,false);
});
test('Worksheet identifies unpriced resources without hiding them',()=>{
 const view=model({id:'excel:P70',unit:'un',components:[{resourceId:'excel:M999',qty:1,waste:0,yield:1}]},{resources:{}},{crews:{}},{materials:0,labor:0,tools:0,equipment:0,direct:0},1);
 assert.equal(view.missing,true);assert.equal(view.rows[0].type,'Revisar');
});
test('Spreadsheet code parses without browser globals',()=>{
 new vm.Script(fs.readFileSync(path.join(__dirname,'..','apu-spreadsheet-view-v1.js'),'utf8'));
});
