'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const bridge=require('../supabase-3d-bom-bridge.js');

const DATA={
  containers:{'20hc':{name:'20 HC',length:6.06,width:2.44,height:2.89}},
  finishes:{standard:{lining:'gypsum',flooring:'vinyl'},sanitary:{lining:'pvc',flooring:'vinyl'}}
};
const baseline=()=>({
  container:'20hc',finish:'standard',
  counts:{window:2,door:1,partition:1,wc:1,sink:1,shower:0,electrical:4,ac:0}
});
const pick=(plan,code)=>plan.items.find(item=>item.code===code)?.quantity;

test('state: windows/doors/sanitary/electrical drive individual component counts',()=>{
  const p=bridge.buildPlan(baseline(),DATA);
  assert.equal(pick(p,'MOD-VENTANA'),2);
  assert.equal(pick(p,'MOD-PUERTA-EXT'),1);
  assert.equal(pick(p,'MOD-WC'),1);
  assert.equal(pick(p,'MOD-LAV'),1);
  assert.equal(pick(p,'MOD-ENCHUFE'),4);
});
test('geometry: one tabique uses one-face area; floor + outer wall exclude openings',()=>{
  const p=bridge.buildPlan(baseline(),DATA);
  assert.equal(pick(p,'MOD-TABIQUE'),7.052);
  assert.equal(pick(p,'MOD-PISO'),14.786);
  assert.equal(pick(p,'MOD-AIS-MURO'),44.84);
  assert.equal(pick(p,'MOD-REV-MURO'),44.84);
});
test('3D edits: counts update live and geometry edits flag non-nominal windows',()=>{
  const s=baseline();
  s.counts.window=3;
  const p=bridge.buildPlan(s,DATA,(type,i)=>type==='window'&&i===2?{width:1.5,height:1.1}:null);
  assert.equal(pick(p,'MOD-VENTANA'),3);
  assert.ok(p.warnings.some(msg=>msg.includes('medidas diferentes')));
  assert.equal(pick(p,'MOD-AIS-MURO'),43.19);
});
test('electrical: typed points correctly map light and outlet; special circuits not invented',()=>{
  const s=baseline();
  s.counts.electrical=4;
  s.electrical={points:[{type:'light'},{type:'outlet'},{type:'switch'},{type:'acPoint'}]};
  const p=bridge.buildPlan(s,DATA);
  assert.equal(pick(p,'MOD-LUZ'),1);
  assert.equal(pick(p,'MOD-ENCHUFE'),1);
  assert.ok(p.warnings.some(msg=>msg.includes('especiales')));
});
test('finish mismatch: sanitary PVC does not claim gypsum recipe',()=>{
  const s=baseline();s.finish='sanitary';
  const p=bridge.buildPlan(s,DATA);
  assert.equal(pick(p,'MOD-REV-MURO'),undefined);
  assert.ok(p.warnings.some(msg=>msg.includes('no coincide')));
});
test('aggregate: same material in multiple components summed once, with waste',()=>{
  const p={items:[{code:'MOD-VENTANA',quantity:2},{code:'MOD-PUERTA-EXT',quantity:1}],warnings:[]};
  const rows=[
    {component_code:'MOD-VENTANA',material_sku:'EST-001',material_name:'Perfil',material_unit:'m',net_quantity_per_component:4.4,estimated_quantity_with_waste:4.62,technical_status:'pending'},
    {component_code:'MOD-PUERTA-EXT',material_sku:'EST-001',material_name:'Perfil',material_unit:'m',net_quantity_per_component:5.1,estimated_quantity_with_waste:5.355,technical_status:'pending'}
  ];
  const r=bridge.aggregate(p,rows,[]);
  assert.equal(r.lines.length,1);
  assert.equal(r.lines[0].net,13.9);
  assert.equal(r.lines[0].withWaste,14.595);
  assert.deepEqual(r.unpricedComponents,['MOD-VENTANA','MOD-PUERTA-EXT']);
  assert.equal(r.complete,false);
});
test('aggregate: missing BOM flagged; never marks commercial quote complete',()=>{
  const r=bridge.aggregate({items:[{code:'NOT-IN-BOM',quantity:1}],warnings:[]},[],[]);
  assert.deepEqual(r.missingComponents,['NOT-IN-BOM']);
  assert.equal(r.complete,false);
  assert.equal(r.apuSubtotalNet,0);
});
test('guard: preview loads bridge after authorization; public landing stays suspended',()=>{
  const preview=fs.readFileSync(path.join(__dirname,'..','pruebas.html'),'utf8');
  const landing=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
  assert.ok(preview.includes('window.BAT_CUBIKEITOR_PREVIEW_CLIENT=client;'));
  assert.match(preview,/supabase-3d-bom-bridge\.js\?v=20261108-extrascore01/);
  const idxAuth=preview.indexOf('window.BAT_CUBIKEITOR_PREVIEW_CLIENT=client;');
  const idxLoad=preview.indexOf('for(const script of SCRIPTS)await loadScript(script)');
  assert.ok(idxAuth>=0&&idxLoad>idxAuth);
  const source=fs.readFileSync(path.join(__dirname,'..','supabase-3d-bom-bridge.js'),'utf8');
  assert.match(source,/getElementById\('bom-table'\)/);
  assert.match(source,/cells\[3\]\.textContent='No validado'/);
  assert.match(source,/openQuote=function\(\)/);
  assert.match(source,/Sin precios confirmados/);
  assert.match(landing,/temporalmente no disponible|Acceso suspendido/i);
});
