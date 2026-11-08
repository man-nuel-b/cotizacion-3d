'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const routing=require('../electrical-routing-engine-v2.js');
const c={length:6.06,width:2.44,height:2.89};
const board={face:'A',x:0,height:1.55,width:.42,cabinetHeight:.55,depth:.14,modules:12};
test('Tablero parametrizable respeta limites del contenedor',()=>{
 assert.equal(routing.validateBoard(board,c).ok,true);
 assert.equal(routing.validateBoard({...board,x:4},c).ok,false);
 assert.equal(routing.validateBoard({...board,cabinetHeight:3},c).ok,false);
 assert.equal(routing.validateBoard({...board,modules:3},c).ok,false);
});
test('Canalización solo acepta valores previstos y no asigna secciones ni protecciones',()=>{
 assert.equal(routing.validateConduit({material:'emt',diameterMm:20,preference:'shortest',additionalPct:8}).ok,true);
 assert.equal(routing.validateConduit({material:'unknown'}).ok,false);
 assert.equal(routing.validateConduit({diameterMm:900}).ok,false);
});
test('Canalización por cara y cielo tiene tramos ortogonales medibles',()=>{
 const p=routing.routeOne(board,{face:'ceiling',x:1,z:-.3},c,{material:'pvc',diameterMm:20});
 assert.equal(p.ok,true,JSON.stringify(p.errors));
 assert.ok(p.routeMeters>0);
 for(const seg of p.segments){
  const changed=['x','y','z'].filter(k=>Math.abs(seg.a[k]-seg.b[k])>.0001);
  assert.ok(changed.length<=1,'un tramo debe seguir un solo eje');
 }
});
test('Tramos comunes de un mismo circuito se miden solo una vez',()=>{
 const one=routing.routeOne(board,{face:'B',x:0,y:.35},c);
 const two=routing.routeOne(board,{face:'B',x:1,y:.35},c);
 const routes=[{...one,circuitId:'E1'},{...two,circuitId:'E1'}];
 const report=routing.mergeSegments(routes);
 const raw=one.routeMeters+two.routeMeters;
 assert.ok(report.totalMeters>0);
 assert.ok(report.totalMeters<raw,'los tramos compartidos no se duplican');
 const distinct=routing.mergeSegments([{...one,circuitId:'E1'},{...two,circuitId:'F1'}]);
 assert.ok(distinct.totalMeters>=report.totalMeters);
});
test('Plan usa proyecto existente y no inventa precios',()=>{
 const model={electrical:{board,conduit:{material:'emt',diameterMm:20,preference:'shortest',additionalPct:10},
  circuits:[{id:'L1',kind:'lighting',name:'Luz 1'},{id:'E1',kind:'outlets',name:'Enchufes 1'}],
  points:[{id:'L',type:'light',circuitId:'L1'},{id:'E',type:'outlet',circuitId:'E1'}]}};
 const result=routing.buildPlan(model,c,[{face:'ceiling',x:0,z:0},{face:'A',x:1,y:.35}]);
 assert.equal(result.routes.length,2);
 assert.equal(result.conduit.diameterMm,20);
 assert.ok(result.referenceAllowanceMeters>=result.netConduitMeters);
 assert.equal(result.hasPendingReview,true);
 assert.equal(result.unitPrice,undefined);
});
test('Modulos de 3D son JavaScript valido y no reemplazan el APU',()=>{
 for(const name of ['electrical-routing-engine-v2.js','electrical-routing-ui-v2.js']){
  new vm.Script(fs.readFileSync(path.join(__dirname,'..',name),'utf8'));
 }
 const ui=fs.readFileSync(path.join(__dirname,'..','electrical-routing-ui-v2.js'),'utf8');
 assert.doesNotMatch(ui,/buildBOM\s*=|calculate\s*=|API_KEY/);
 assert.match(ui,/pushHistory/);
});
