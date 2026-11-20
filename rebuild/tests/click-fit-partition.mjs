import test from 'node:test';
import assert from 'node:assert/strict';
import { computeFreePartitionSpan, classifyPartitionJunction,
  checkPartitionCollisions, validatePartitionInsideContainer } from '../construction-integrity.js';

const dims = { L: 6, W: 2.4, H: 2.5 };
const opts = direction => ({ direction });
const spec = (axis, cx, cz) => ({ axis, cx, cz, thickness: .1 });
const measure = (s, partitions = [], objects = [], direction = 'both') =>
  computeFreePartitionSpan(s, dims, partitions, objects, [], .05, .015, opts(direction));
const near = (a, b) => assert.ok(Math.abs(a-b) < 1e-8, `${a} !== ${b}`);

test('Clic en tramo libre: both se ajusta a límites y centra en X', () => {
  const q = measure(spec('x', 1.25, 0));
  near(q.freeMin, -2.92); near(q.freeMax, 2.92);
  near(q.recommendedCenter, 0); near(q.freeLengthM, 5.84);
  assert.equal(q.direction, 'both');
});

test('Crecimiento positivo se inicia exactamente en el clic y llega a la pared útil', () => {
  const q = measure(spec('x', .72, 0), [], [], 'positive');
  near(q.freeMin, .72); near(q.freeMax, 2.92);
  near(q.freeLengthM, 2.2); near(q.recommendedCenter, 1.82);
});

test('Crecimiento negativo termina exactamente en el clic', () => {
  const q = measure(spec('x', .72, 0), [], [], 'negative');
  near(q.freeMin, -2.92); near(q.freeMax, .72);
  near(q.freeLengthM, 3.64); near(q.recommendedCenter, -1.1);
});

test('Eje Z: en positivo respeta el ancho W, no la longitud L', () => {
  const q = measure(spec('z', .2, .1), [], [], 'positive');
  near(q.freeMin, .1); near(q.freeMax, 1.12); near(q.freeLengthM, 1.02);
});

test('Tabique perpendicular limita el tramo en T, sin atravesar anfitrión', () => {
  const host = {id:'host',axis:'z',cx:0,cz:0,length:2.24,thickness:.1,height:2.3};
  const q = measure(spec('x', .5, 0), [host], [], 'both');
  near(q.freeMin, .05); near(q.freeMax, 2.92);
  const branch = { id:'branch',axis:'x',cx:q.recommendedCenter,cz:0,
    length:q.freeLengthM,thickness:.1,height:2.3};
  assert.equal(validatePartitionInsideContainer(branch,dims,.05), null);
  assert.equal(checkPartitionCollisions(branch, [host]), null);
  assert.equal(classifyPartitionJunction(host,branch)?.type, 'T');
});

test('Clic dentro de un obstáculo indica bloqueo, no crea vano ajeno', () => {
  const host = {id:'host',axis:'z',cx:0,cz:0,length:2.24,thickness:.1,height:2.3};
  const q = measure(spec('x',0,0),[host]);
  near(q.freeLengthM,0); assert.equal(q.blockedBy,'tabique perpendicular');
});

test('Dirección no reconocida y coordenadas NaN fallan expresamente', () => {
  assert.throws(() => measure(spec('x',0,0),[],[],'diagonal'),/Dirección inválida/);
  assert.throws(() => measure(spec('x',NaN,0)),/inválidos/);
});
