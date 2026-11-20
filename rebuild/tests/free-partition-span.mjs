import test from 'node:test';
import assert from 'node:assert/strict';
import { computeFreePartitionSpan, classifyPartitionJunction, checkPartitionCollisions,
  validatePartitionInsideContainer } from '../construction-integrity.js';

const dims = { L: 6, W: 2.4, H: 2.5 };
const close = (a,b,where='') => assert.ok(Math.abs(a-b)<1e-8, `${where}: ${a} != ${b}`);
const p = (id, axis, cx, cz, length, thickness = .1) => ({id, axis, cx, cz, length, thickness, height: 2.3,
  autoSpan:false, faceALining:null, faceBLining:null, hasInsulation:false, insulationCode:null });
const measure = (spec, ps=[], objects=[], doors=[], pad=.015) =>
  computeFreePartitionSpan(spec, dims, ps, objects, doors, .05, pad);

test('Tramo vacío eje X: usa límites interiores con perfiles y centra', () => {
  const q = measure({ axis:'x', cx:1.2, cz:0, thickness:.1 });
  close(q.freeMin,-2.92); close(q.freeMax,2.92); close(q.freeLengthM,5.84);
  close(q.recommendedCenter,0); assert.equal(q.fitsDoors,true);
});
test('Tramo vacío eje Z: recorre realmente la dimensión W', () => {
  const q = measure({ axis:'z', cx:0, cz:0, thickness:.1 });
  close(q.freeMin,-1.12);close(q.freeMax,1.12);close(q.freeLengthM,2.24);
});
test('Tabique perpendicular: alcanza cara sin cruzar y produce una T real',()=>{
  const host = p('host','z',0,0,2.24);
  const spec = { axis:'x', cx:1, cz:0, thickness:.1, partitionId:'branch' };
  const q = measure(spec,[host]);
  close(q.freeMin,.05);close(q.freeMax,2.92);close(q.freeLengthM,2.87);
  const branch = p('branch','x',q.recommendedCenter,0,q.freeLengthM);
  assert.equal(validatePartitionInsideContainer(branch,dims,.05),null);
  assert.equal(checkPartitionCollisions(branch,[host]),null);
  assert.equal(classifyPartitionJunction(host,branch).type,'T');
});
test('Dos tabiques perpendiculares: intervalo queda entre las caras físicas',()=>{
  const ps = [p('left','z',0,0,2.24),p('right','z',2,0,2.24)];
  const q = measure({axis:'x',cx:1,cz:0,thickness:.1},ps);
  close(q.freeMin,.05);close(q.freeMax,1.95);close(q.freeLengthM,1.9);
});
test('Tabique paralelo: se reserva holgura sin solapamiento longitudinal',()=>{
  const q = measure({axis:'x',cx:1,cz:0,thickness:.1},[p('p','x',-1,0,1)]);
  close(q.freeMin,-.485);close(q.freeMax,2.92);
});
test('Tabique paralelo en carril distinto no limita el intervalo',()=>{
  const q=measure({axis:'x',cx:0,cz:0,thickness:.1},[p('p','x',-1,.65,1)]);
  close(q.freeLengthM,5.84);
});
test('Objeto con giro 90 grados: no confunde grados con radianes ni usa proyección incorrecta',()=>{
  const obj={id:'furniture',x:1,z:0,y:0,w:1.2,d:.4,h:1.1,rot:90};
  const quarter=measure({axis:'x',cx:-1,cz:0,thickness:.1},[],[obj]);
  const zero=measure({axis:'x',cx:-1,cz:0,thickness:.1},[],[{...obj,rot:0}]);
  assert.ok(quarter.freeMax > zero.freeMax+0.3);
  close(quarter.freeMax,.785);
});
test('Objeto rotado 45 grados fuera de la franja no bloquea: clipping OBB',()=>{
  const obj={id:'desk',x:1,z:.85,y:0,w:.5,d:.5,h:1.2,rot:45};
  const q=measure({axis:'x',cx:0,cz:0,thickness:.1},[],[obj]);
  close(q.freeLengthM,5.84);
});
test('Centro dentro de un obstáculo: no elige una bahía ajena de forma silenciosa',()=>{
  const host=p('host','z',0,0,2.24);
  const q=measure({axis:'x',cx:0,cz:0,thickness:.1},[host]);
  assert.equal(q.freeLengthM,0);
  assert.match(q.blockedBy,/perpendicular/);
});
test('Se excluye el tabique propio por ID y no se altera el arreglo recibido',()=>{
  const original=p('own','x',0,0,1.5);
  const saved=structuredClone(original);
  const q=measure({axis:'x',cx:0,cz:0,thickness:.1,partitionId:'own'},[original]);
  close(q.freeLengthM,5.84); assert.deepEqual(original,saved);
});
test('Una puerta asociada exige holgura mínima en el intervalo',()=>{
  const ps=[p('a','z',0,0,2.24),p('b','z',1.1,0,2.24)];
  const door={id:'d',partitionId:'branch',w:1.0};
  const q=measure({axis:'x',cx:.55,cz:0,thickness:.1,partitionId:'branch'},ps,[],[door]);
  close(q.freeLengthM,1);
  assert.equal(q.fitsDoors,false);close(q.requiredMinDoorLengthM,1.16);
});
test('Eje, coordenadas, dimensiones y opciones inválidas se rechazan',()=>{
  assert.throws(()=>measure({axis:'y',cx:0,cz:0,thickness:.1}),/Eje/);
  assert.throws(()=>measure({axis:'x',cx:0,cz:0,thickness:NaN}),/inválidos/);
  assert.throws(()=>measure({axis:'x',cx:20,cz:0,thickness:.1}),/fuera/);
  assert.throws(()=>measure({axis:'x',cx:0,cz:0,thickness:.1},[],[],[],-.1),/inválidos/);
});
