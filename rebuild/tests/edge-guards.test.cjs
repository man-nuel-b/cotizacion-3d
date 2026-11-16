'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const State=require('../core/project-state');
const Spatial=require('../core/spatial');
const Pricing=require('../core/pricing');
const Catalog=require('../core/catalog');
const Materials=require('../core/materials');

test('Rechaza puntos fuera de las caras y alturas fuera del contenedor',()=>{
 const c=State.defaults().project.container;
 assert.throws(()=>Spatial.faceFromPoint({x:100,z:-c.width/2},c),/fuera/);
 assert.throws(()=>Spatial.faceFromPoint({x:0,z:0},c),/pared/);
 assert.throws(()=>Spatial.placementFromHit({x:0,y:3,z:-c.width/2},c,{kind:'window',width:1,height:1}),/fuera/);
 assert.throws(()=>Spatial.placementFromHit({x:0,y:-1,z:-c.width/2},c,{kind:'window',width:1,height:1}),/fuera/);
 assert.throws(()=>Spatial.snap([],0.05),/inválido/);
 assert.throws(()=>Spatial.snap('  ',0.05),/inválido/);
 assert.throws(()=>Spatial.snap(1,0),/rango/);
});
test('Arrastre futuro X/Z ajusta al interior sin geometría negativa ni colapsada',()=>{
 const c=State.defaults().project.container;
 const p=Spatial.fitPartitionCenter({x:100,z:-100,length:2,thickness:.1,orientation:'x'},c);
 assert.ok(p.x<=c.length/2-1&&p.x>=-c.length/2+1);
 assert.ok(p.z<=c.width/2-.05&&p.z>=-c.width/2+.05);
 const cross=Spatial.fitPartitionCenter({x:-100,z:100,length:1,thickness:.08,orientation:'z'},c);
 assert.ok(cross.x>=-c.length/2+.04-1e-9);
 assert.ok(cross.z<=c.width/2-.5+1e-9);
 assert.throws(()=>Spatial.fitPartitionCenter({x:0,z:0,length:30,thickness:.1,orientation:'x'},c),/demasiado grande/);
 assert.throws(()=>Spatial.fitPartitionCenter({x:0,z:0,length:1,thickness:0,orientation:'x'},c),/inválida/);
 assert.throws(()=>Spatial.fitPartitionCenter({x:0,z:0,length:1,thickness:.08,orientation:'z'},c,0),/rango/);
});
test('Cálculos CLP rechazan overflow, incluso cuando líneas son individualmente seguras',()=>{
 const settings=State.defaults().pricing;
 assert.throws(()=>Pricing.calculate({lines:[{code:'FLOOR',qty:1e12}]},{FLOOR:1e10},settings),/rango/);
 const large={lines:[{code:'A',qty:1},{code:'B',qty:1}]};
 assert.throws(()=>Pricing.calculate(large,{A:6e15,B:6e15},settings),/rango/);
 assert.throws(()=>Pricing.roundCLP(Infinity),/rango/);
 assert.throws(()=>Pricing.roundCLP(Number.MAX_SAFE_INTEGER+1),/rango/);
});
test('Entradas numéricas normales conservan IVA y BOM en CLP',()=>{
 const state=State.defaults();
 const bom=Materials.takeoff(state);
 const quote=Pricing.calculate(bom,Catalog,state.pricing);
 assert.equal(quote.total,quote.net+quote.vat);
 assert.ok(Number.isSafeInteger(quote.total));
 assert.deepEqual(Pricing.calculate(bom,Catalog,state.pricing),quote);
});
