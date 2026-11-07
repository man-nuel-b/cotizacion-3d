'use strict';
const assert=require('node:assert/strict');
const test=require('node:test');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const pricing=require('../pricing-integrity-v1.js');
const item=(code,qty,b)=>({key:'excel-apu:'+code,excelCode:code,qty,unitCost:b.direct*1.25,subtotal:qty*b.direct*1.25,directSubtotal:qty*b.direct,excelApu:true,apuBreakdown:b});
const breakdown=(materials,labor,equipment=0,tools=0)=>({materials,labor,equipment,tools,direct:materials+labor+equipment+tools,overhead:(materials+labor+equipment+tools)*.15,profit:(materials+labor+equipment+tools)*.1});
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<.0001,`expected ${actual} ≈ ${expected}`);
test('Office: one exact direct-cost subtotal, one overhead, one profit, one VAT',()=>{
  const bom=[{key:'container',qty:1,unitCost:2050000,subtotal:2050000},item('P83',2,breakdown(80000,35000)),item('P47',14.79,breakdown(8000,3500))];
  const x=pricing.calculate({bom,externalLabor:650000,transport:85000,overheadPct:15,profitPct:10,taxPct:19});
  const direct=2050000+2*(80000+35000)+14.79*(8000+3500)+650000+85000;
  near(x.direct,direct);near(x.materials+x.labor+x.transport,x.direct);near(x.net,x.direct*1.25);near(x.total,x.net*1.19);
  near(x.apuLabor,2*35000+14.79*3500);near(x.externalLabor,650000);
});
test('Office+WC: fixtures and routing accounted for without overwriting labor',()=>{
  const bom=[item('P60',1,breakdown(96881,48533,0,2427)),{key:'routing-cold-ppr',qty:8,unitCost:1600,subtotal:12800},
  {key:'routing-plumber-labor',qty:.5,unitCost:91000,subtotal:45500,laborOnly:true,parametricRouting:true}];
  const x=pricing.calculate({bom,externalLabor:650000,transport:0,overheadPct:15,profitPct:10,taxPct:19});
  near(x.materials,96881+2427+12800);near(x.labor,48533+45500+650000);
  near(x.direct,x.materials+x.labor);near(x.overhead,x.direct*.15);near(x.profit,x.direct*.1);
});
test('Bateria sanitaria: APU labor not repeated as extra base labor',()=>{
 const bom=[item('P60',3,breakdown(95000,45000)),item('P61',2,breakdown(100000,47000)),item('P17',35,breakdown(12000,23000)),item('P35',35,breakdown(14000,10000))];
 const x=pricing.calculate({bom,externalLabor:650000,transport:120000,overheadPct:15,profitPct:10,taxPct:19});
 near(x.labor,3*45000+2*47000+35*23000+35*10000+650000);
 near(x.direct,x.materials+x.labor+x.transport);
});
test('Changing overhead and profit must update net without using stale state.margin',()=>{
 const bom=[item('P12',5,breakdown(13000,29000))];
 const a=pricing.calculate({bom,externalLabor:0,overheadPct:15,profitPct:10,taxPct:19});
 const b=pricing.calculate({bom,externalLabor:0,overheadPct:18,profitPct:15,taxPct:19});
 near(b.net,a.direct*1.33);assert.ok(b.total>a.total);
});
test('Invalid BOM quantity or subtotal cannot silently become zero',()=>{
 assert.throws(()=>pricing.calculate({bom:[{qty:-1,subtotal:2}]}),/invalidas/);
 assert.throws(()=>pricing.calculate({bom:[{qty:1,subtotal:NaN}]}),/invalidas/);
});
test('Static regression: overlays and duplicate price formulas removed',()=>{
 const method=fs.readFileSync(path.join(root,'apu-excel-method-v1.js'),'utf8');
 const interior=fs.readFileSync(path.join(root,'interior-production-v1.js'),'utf8');
 const account=fs.readFileSync(path.join(root,'apu-excel-accounting-v1.js'),'utf8');
 const mapping=fs.readFileSync(path.join(root,'apu-3d-mapping-v1.js'),'utf8');
 const surface=fs.readFileSync(path.join(root,'apu-surface-mapping-v1.js'),'utf8');
 assert.match(method,/floorAlreadyInApu\?0:/);
 assert.match(method,/BAT_KUBIQUEITOR_PRICING_INTEGRITY\.calculate/);
 assert.match(interior,/BAT_KUBIQUEITOR_PRICING_INTEGRITY\.calculate/);
 assert.doesNotMatch(interior,/direct\*\(1\+n\(state\.margin\)/);
 assert.doesNotMatch(account,/calculate=function\(/);
 assert.match(mapping,/singleFaceArea\)-n\(m\.doorOpeningArea\)/);
 assert.match(surface,/add\('P35',g\.wallNet/);
});
test('All project cost JS parses in Node (no execution)',()=>{
 for(const f of ['pricing-integrity-v1.js','apu-excel-method-v1.js','apu-excel-accounting-v1.js','apu-3d-mapping-v1.js','apu-surface-mapping-v1.js','interior-production-v1.js','commercial-audit-v1.js','summary-panel-toggle.js']){
  const src=fs.readFileSync(path.join(root,f),'utf8');new vm.Script(src,{filename:f});
 }
});
