'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Apu=require('../core/apu-catalog');
const valid=()=>({
 resources:[
  {code:'MAT-01',name:'Plancha',unit:'m²',priceClp:14500},
  {code:'MO-01',name:'Instalación',unit:'h',priceClp:8500}
 ],
 partidas:[{code:'TAB-01',name:'Tabique',unit:'m²',
  components:[
   {resourceCode:'MAT-01',quantity:1,wastePct:10,yield:1},
   {resourceCode:'MO-01',quantity:.5,wastePct:0,yield:1}
  ]}]
});
test('APU import preserves deterministic material and labor unit costs',()=>{
 const catalog=Apu.importCatalog(valid());
 assert.equal(Apu.costPartida(catalog,'TAB-01'),20200);
 const again=Apu.importCatalog(valid());
 assert.deepEqual(catalog,again);
});
test('null, blank, NaN, malformed and negative prices fail before quoting',()=>{
 for(const price of [null,undefined,'','   ',[],{},false,'12,5','0x10','CLP 2000',NaN,Infinity,-5]){
  const data=valid();data.resources[0].priceClp=price;
  assert.throws(()=>Apu.importCatalog(data),/APU/);
 }
});
test('zero or missing labor price cannot silently create a commercial quote',()=>{
 const data=valid();data.resources[1].priceClp=0;
 const catalog=Apu.importCatalog(data);
 assert.throws(()=>Apu.costPartida(catalog,'TAB-01'),/sin precio validado/);
});
test('zero or invalid yields, unknown references, and empty partidas fail',()=>{
 const badYield=valid();badYield.partidas[0].components[0].yield=0;
 assert.throws(()=>Apu.importCatalog(badYield),/APU/);
 const missing=valid();missing.partidas[0].components[0].resourceCode='NO-EXISTE';
 assert.throws(()=>Apu.importCatalog(missing),/desconocido/);
 const empty=valid();empty.partidas[0].components=[];
 assert.throws(()=>Apu.importCatalog(empty),/sin componentes/);
});
test('valid percentages and unit counts reject extreme overflow',()=>{
 const data=valid();data.partidas[0].components[0].wastePct=101;
 assert.throws(()=>Apu.importCatalog(data),/APU/);
 const high=valid();high.resources[0].priceClp=1e12;
 high.partidas[0].components[0].quantity=1e12;
 const catalog=Apu.importCatalog(high);
 assert.throws(()=>Apu.costPartida(catalog,'TAB-01'),/rango/);
});
