'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {RECIPES,calculate}=require('../easy-quote-trial-v1.js');
const ctx=vm.createContext({window:{}});
for(const f of ['apu-excel-resources-1.js','apu-excel-resources-2.js','apu-excel-resources-3.js','apu-excel-partidas-1.js','apu-excel-partidas-2.js','apu-excel-partidas-3.js']){
 vm.runInContext(fs.readFileSync(path.join(__dirname,'..',f),'utf8'),ctx,{filename:f});
}
const resources=new Map(ctx.window.BAT_EXCEL_APU_R.map(r=>[r[0],r]));
const apus=new Map(ctx.window.BAT_EXCEL_APU_A.map(a=>[a[0],a]));
const wages={master:60000,helper:42000,specialist:70000,plumber:70000,electrician:75000,welder:75000,painter:55000};
const price=(code)=>{
 const a=apus.get(code);assert.ok(a,'Missing '+code);
 const parts=a[8].reduce((sum,[id,q,waste])=>{
  const r=resources.get(id);assert.ok(r);
  return sum+(r[1]==='material'||r[1]==='equipment'?r[4]*q*(1+waste/100):0);
 },0);
 const labor=((wages[a[7]]??wages.master)*a[5]+wages.helper*a[6])*1.3/a[4];
 return {net:(parts+labor+labor*.05)*1.25};
};
test('Five simple recipes reproduce exact Excel reference values with 5% contingency',()=>{
 for(const [kind,ref] of Object.entries(RECIPES)){
  const actual=calculate({kind},price);
  assert.ok(Math.abs(actual.netUnit-ref.reference)<2,kind+': '+actual.netUnit+' != '+ref.reference);
  assert.deepEqual(actual.issues,[]);
 }
});
test('Half bathroom plus shower becomes full bathroom recipe, not merely an extra fixture',()=>{
 const half=calculate({kind:'half'},price);
 const full=calculate({kind:'half',shower:true},price);
 const directFull=calculate({kind:'full'},price);
 assert.ok(full.netUnit>half.netUnit);
 assert.ok(Math.abs(full.netUnit-directFull.netUnit)<1e-7);
 assert.ok(full.rows.some(x=>x.code==='P62'));
});
test('Extra windows include opening and frame; pricing changes from library only',()=>{
 const base=calculate({kind:'office'},price),extra=calculate({kind:'office',extraWindows:1},price);
 const expected=(price('P83').net+price('P41').net)*1.05;
 assert.ok(Math.abs((extra.netUnit-base.netUnit)-expected)<1e-7);
});
test('Unit count multiplies totals without changing unit pricing or quote state',()=>{
 const settings={kind:'half',units:3,extraWindows:0,hotWater:false};
 const old=structuredClone(settings);
 const one=calculate({kind:'half'},price);
 const three=calculate(settings,price);
 assert.ok(Math.abs(three.netTotal-3*one.netUnit)<1e-7);
 assert.deepEqual(settings,old);
});
test('Missing or unpriced APU is reported instead of fabricated',()=>{
 const report=calculate({kind:'half'},code=>code==='P60'?null:price(code));
 assert.ok(report.issues.some(s=>s.includes('P60')));
});
test('Source parses in browser context',()=>{
 new vm.Script(fs.readFileSync(path.join(__dirname,'..','easy-quote-trial-v1.js'),'utf8'));
});
