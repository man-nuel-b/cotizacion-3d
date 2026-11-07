'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const rules=require('../construction-apu-rules-v1.js');
const pricing=require('../pricing-integrity-v1.js');
function project(solution,extras={}){
  const defaults={
    office:{window:2,door:1,partition:0,wc:0,sink:0,shower:0,ac:1,electrical:4},
    officeBath:{window:2,door:2,partition:1,wc:1,sink:1,shower:0,ac:1,electrical:5},
    bathrooms:{window:1,door:1,partition:2,wc:3,sink:2,shower:0,ac:0,electrical:3}
  };
  return {container:'20hc',solution,counts:{...defaults[solution]},constructionRules:{enabled:true,...extras}};
}
test('Existing projects opt out: no extra line items without activation',()=>{
 const s={...project('officeBath'),constructionRules:undefined};
 const p=rules.derive(s);
 assert.equal(p.enabled,false);assert.deepEqual(p.items,[]);assert.equal(p.routingMode,'parametric');
});
test('Office + one bathroom: WC/hand basin, water and 50/110 drains once',()=>{
 const p=rules.derive(project('officeBath'));
 const quantities=Object.fromEntries(p.items.map(x=>[x.code,x.qty]));
 assert.deepEqual([quantities.P64,quantities.P65,quantities.P66],[2,1,1]);
 assert.equal(quantities.P63,undefined);assert.equal(quantities.P73,undefined);
 assert.equal(p.routingMode,'apu-points');
});
test('Office + two bathrooms: two WC and wash basins increase quantity exactly',()=>{
 const s=project('officeBath');s.counts.wc=2;s.counts.sink=2;
 const quantities=Object.fromEntries(rules.derive(s).items.map(x=>[x.code,x.qty]));
 assert.deepEqual([quantities.P64,quantities.P65,quantities.P66],[4,2,2]);
});
test('Sanitary battery: select electrical obligations once and no unrequested heater',()=>{
 const s=project('bathrooms',{board:true,ground:true,declaration:true,extractorCount:2});
 const quantities=Object.fromEntries(rules.derive(s).items.map(x=>[x.code,x.qty]));
 assert.deepEqual([quantities.P64,quantities.P65,quantities.P66,quantities.P67,quantities.P73,quantities.P74,quantities.P76],[5,2,3,2,1,1,1]);
 assert.equal(quantities.P63,undefined);
});
test('Half bathroom prefabricated module adds exactly one WC and one basin',()=>{
 const s=project('office');s.bathroomModules=[{kind:'half'}];
 const c=rules.countsFor(s);
 assert.deepEqual([c.wc,c.sink,c.shower],[1,1,0]);
});
test('Wet partition replaces P12 by P13 without increasing total area',()=>{
 const s=project('officeBath',{wetPartitions:1}),snapshot=rules.derive(s);
 const master={apus:{'excel:P13':{name:'Zona humeda',unit:'m²'}}};
 const breakdown=()=>({net:100,direct:80,labor:30,materials:50});
 const base=[{key:'excel-apu:P12',excelCode:'P12',apuId:'excel:P12',qty:4,unitCost:80,subtotal:320,directUnitCost:60,directSubtotal:240,excelApu:true}];
 const plan={...snapshot,wetPartitionArea:2};
 const updated=rules.enhanceBOM(base,s,master,breakdown,plan);
 const dry=updated.find(x=>x.excelCode==='P12'),wet=updated.find(x=>x.excelCode==='P13');
 assert.equal(dry.qty,2);assert.equal(wet.qty,2);assert.equal(dry.qty+wet.qty,4);
});
test('Existing sanitary module direct line is replaced by one fully installed APU',()=>{
 const s=project('officeBath');s.bathroomModules=[{kind:'half'}];s.constructionRules={enabled:true};
 const p=rules.derive(s);
 const master={apus:{'excel:P60':{name:'WC',unit:'un'},'excel:P61':{name:'Lavamanos',unit:'un'}}};
 const breakdown=code=>({net:code.endsWith('P60')?200:150,direct:100,labor:30,materials:70});
 const old=[{key:'module-wc',qty:1,subtotal:80,unitCost:80},{key:'module-sink',qty:1,subtotal:75,unitCost:75}];
 const out=rules.enhanceBOM(old,s,master,breakdown,{...p,wetPartitionArea:0});
 assert.ok(!out.some(x=>x.key.startsWith('module-')));
 assert.ok(out.some(x=>x.excelCode==='P60'&&x.qty===1));
 assert.ok(out.some(x=>x.excelCode==='P61'&&x.qty===1));
});
test('JS syntax check for all new integration files',()=>{
 for(const f of ['construction-apu-rules-v1.js','apu-excel-method-v1.js','interior-production-v1.js','summary-panel-toggle.js']){
   new vm.Script(fs.readFileSync(path.join(__dirname,'..',f),'utf8'),{filename:f});
 }
});
