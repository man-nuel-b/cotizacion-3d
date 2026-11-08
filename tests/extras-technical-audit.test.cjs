'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const bridge=require('../supabase-3d-bom-bridge.js');
const data={containers:{'20hc':{length:6.06,width:2.44,height:2.89}},finishes:{standard:{lining:'gypsum',flooring:'vinyl'}}};
const qty=(p,code)=>p.items.find(i=>i.code===code)?.quantity||0;

// These are desired behaviors; currently fail to record production defects.
test('EXTRA defect: partition BOM reflects edited 3D length and height',()=>{
  const p=bridge.buildPlan({
    container:'20hc',finish:'standard',
    counts:{partition:1},
    dimensions:{partition:[{length:1.2,height:2.0}]}
  },data);
  assert.equal(qty(p,'MOD-TABIQUE'),2.4,
    'Edited 1.20 m x 2.00 m tabique should consume 2.40 m2, not nominal whole-container area');
});

test('EXTRA defect: preassembled full bathroom contributes its fixtures to Supabase BOM',()=>{
  const p=bridge.buildPlan({
    container:'20hc',finish:'standard',
    counts:{wc:0,sink:0,shower:0},
    bathroomModules:[{kind:'full',x:0,z:0,rotation:0}]
  },data);
  assert.equal(qty(p,'MOD-WC'),1,'Full bathroom includes one WC');
  assert.equal(qty(p,'MOD-LAV'),1,'Full bathroom includes one washbasin');
  assert.equal(qty(p,'MOD-DUCHA'),1,'Full bathroom includes one shower');
});
