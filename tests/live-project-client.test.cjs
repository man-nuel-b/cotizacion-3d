'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {summarize,catalogActions}=require('../live-project-client-v1.js');
test('Live project displays canonical current totals, not a separate template quote',()=>{
 const totals={total:1234567,net:1037451,bom:[
  {key:'structure',qty:1,unitCost:200000,subtotal:200000},
  {key:'excel-apu:P83',qty:1,unitCost:54000,subtotal:54000,excelApu:true},
  {key:'apu:openingFrame',qty:1,unitCost:0,subtotal:0,pendingCost:true}
 ]};
 const result=summarize(totals,{counts:{window:2,door:1}}, {errors:[{code:'PRICE_PENDING'}],warnings:[]});
 assert.equal(result.total,1234567);
 assert.equal(result.excelLines,1);
 assert.equal(result.problems,1);
 assert.equal(result.errors,1);
 assert.equal(result.count,3);
});
test('Action buttons reflect current scene counts and configured maxima',()=>{
 const result=catalogActions({counts:{window:4,openingFrame:1}},{extras:{window:{max:8},openingFrame:{max:3}}});
 assert.equal(result.find(x=>x.key==='window').count,4);
 assert.equal(result.find(x=>x.key==='openingFrame').max,3);
 assert.equal(result.find(x=>x.key==='openingFrame').count,1);
});
test('Live client module contains no independent quote recipe or master writes',()=>{
 const code=fs.readFileSync(path.join(__dirname,'..','live-project-client-v1.js'),'utf8');
 assert.match(code,/typeof calculate==='function'/);
 assert.match(code,/adjustCount\(key,1\)/);
 assert.doesNotMatch(code,/localStorage\.setItem/);
 assert.doesNotMatch(code,/RECIPES|referenceNet/);
 new vm.Script(code);
});

test('Wood lining appears in client action menu and selected state is maintained',()=>{
 const result=catalogActions({counts:{},interiorSystem:{lining:'plywood'}},{extras:{}});
 const wood=result.find(x=>x.key==='woodLining');
 assert.ok(wood);assert.equal(wood.count,1);assert.equal(wood.max,1);
});
test('Wood finish cannot be represented as a validated full APU with zero cost',()=>{
 const src=fs.readFileSync(path.join(__dirname,'..','live-project-client-v1.js'),'utf8');
 assert.match(src,/woodSelected\?1:0/);
 assert.match(src,/selectInteriorLining\(next\)/);
 assert.match(src,/falta|validado|verificar|Verificar/i);
});

test('Unified Extras UI offers an indexed remove action for each catalog component',()=>{
 const src=fs.readFileSync(path.join(__dirname,'..','live-project-client-v1.js'),'utf8');
 const app=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
 assert.match(src,/data-live-remove/);
 assert.match(src,/core\.canRemoveAt\(state,key,total-1\)/);
 assert.match(src,/core\.removeAt\(state,key,total-1\)/);
 assert.match(src,/pushHistory\(\)/);
 assert.match(src,/renderAll\(\)/);
 assert.match(src,/Herramientas técnicas: módulos prearmados/);
 assert.match(app,/data-legacy-extra-key/);
});
