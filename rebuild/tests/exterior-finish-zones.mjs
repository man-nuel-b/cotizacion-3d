import test from 'node:test';
import assert from 'node:assert/strict';
import { validateExteriorZone, sanitizeExteriorZones, exteriorTakeoffForFace } from '../exterior-finish-zones.js';

const state=() => ({
  L: 6, W: 2.4, H: 2.5, openings: [], sharedWalls: [],
  finishes: { walls: { A: null, B: null, C: null, D: null },
    interiorWalls: { A: null, B: null, C: null, D: null }, exteriorZones: [] }
});
const zone=(attrs={}) => ({
  id:'ext-1',face:'A',code:'P59',u:0,v:0,width:3,height:2,orientation:'horizontal',...attrs
});

test('6 m² de madera horizontal o vertical equivalen a 3 × 2 m',()=>{
  const s=state();
  assert.equal(validateExteriorZone(zone(),s),null);
  assert.equal(validateExteriorZone(zone({orientation:'vertical'}),s),null);
  s.finishes.exteriorZones.push(zone({orientation:'vertical'}));
  const q=exteriorTakeoffForFace(s,'A',15);
  assert.equal(q.zonesAreaM2,6);
  assert.equal(q.byCodeM2.P59,6);
  assert.equal(q.totalCoveredM2,6);
  assert.equal(q.zones[0].orientation,'vertical');
  assert.equal(q.zones[0].areaM2,6);
});

test('Revestimiento parcial descuenta base de fachada sin doble contabilización',()=>{
  const s=state();s.finishes.walls.A='P52';
  s.finishes.exteriorZones.push(zone({code:'P54'}));
  const q=exteriorTakeoffForFace(s,'A',15);
  assert.equal(q.byCodeM2.P54,6);
  assert.equal(q.byCodeM2.P52,9);
  assert.equal(q.totalCoveredM2,15);
  assert.equal(q.baseAreaM2,9);
});

test('Rechaza vanos, contactos, superposiciones, exceder el muro y material interior',()=>{
  const s=state();
  assert.match(validateExteriorZone(zone({code:'P35'}),s),/exterior/i);
  assert.match(validateExteriorZone(zone({width:7}),s),/no cabe/i);
  assert.match(validateExteriorZone(zone({orientation:'diagonal'}),s),/orientación/i);
  s.openings=[{face:'A',u:1,v:.6,w:1,h:1,type:'window'}];
  assert.match(validateExteriorZone(zone(),s),/vano/);
  s.openings=[];
  s.sharedWalls=[{face:'A',u:1,v:0,w:1,h:2}];
  assert.match(validateExteriorZone(zone(),s),/compartido/);
  s.sharedWalls=[];
  s.finishes.exteriorZones=[zone()];
  assert.match(validateExteriorZone(zone({id:'ext-2',u:2}),s),/superpone/);
  assert.equal(validateExteriorZone(zone({id:'ext-2',u:3}),s),null);
});

test('Importar JSON conserva orientación y rechaza IDs duplicados / datos corruptos',()=>{
  const s=state();
  const cleaned=sanitizeExteriorZones([zone({orientation:'vertical'})],s);
  assert.deepEqual(cleaned,[zone({orientation:'vertical'})]);
  assert.throws(()=>sanitizeExteriorZones([zone(),zone()],s),/duplicado/);
  assert.throws(()=>sanitizeExteriorZones([zone({width:99})],s),/no cabe/);
  assert.throws(()=>sanitizeExteriorZones([zone({code:'P30'})],s),/exterior/);
  assert.throws(()=>sanitizeExteriorZones(new Array(101).fill(zone()),s),/100/);
});
