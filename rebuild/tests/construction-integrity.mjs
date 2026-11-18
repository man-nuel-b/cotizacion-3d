import test from 'node:test';
import assert from 'node:assert/strict';
import {
  interiorClearance, objectAABB, partitionAABB, aabbOverlap,
  validateObjectInsideContainer, validatePartitionInsideContainer,
  checkObjectCollisions, checkPartitionCollisions,
  reinforcementCodeFor, withOpeningReinforcement, computeWallTakeoff
} from '../construction-integrity.js';

const dims = { L: 6, W: 2.4, H: 2.5 };
const panel = 0.05;
const object = (id, x, z, y = 0, rot = 0) =>
  ({ id, x, z, y, rot, w: 0.6, h: 1, d: 0.4 });
const partition = (id, axis, cx = 0, cz = 0) =>
  ({ id, axis, cx, cz, length: 1.6, thickness: 0.1, height: 2.3 });

test('Las holguras consideran el panel y una cota mínima de 8 cm', () => {
  assert.equal(interiorClearance(0.04), 0.08);
  assert.equal(interiorClearance(0.075), 0.095);
  assert.throws(() => interiorClearance(-0.1));
});

test('Límites interiores estrictos y alturas respecto a piso terminado', () => {
  assert.equal(validateObjectInsideContainer(object('a', 0, 0), dims, panel), null);
  assert.match(validateObjectInsideContainer(object('a', 2.7, 0), dims, panel), /perfil/);
  assert.match(validateObjectInsideContainer(object('a', 0, 0, -0.01), dims, panel), /piso/);
  assert.match(validateObjectInsideContainer(object('a', 0, 0, 2), dims, panel), /altura/);
  const p = partition('p', 'x', 2.4, 0);
  assert.match(validatePartitionInsideContainer(p, dims, panel), /perfil/);
});

test('La rotación 90° intercambia AABB sin alterar longitud ni espesor', () => {
  const alongX = partitionAABB(partition('p', 'x'));
  const alongZ = partitionAABB(partition('p', 'z'));
  assert.equal(alongX.rx, alongZ.rz);
  assert.equal(alongX.rz, alongZ.rx);
  assert.equal(objectAABB(object('o', 0, 0, 0, 90)).rx, 0.2);
});

test('Solapamiento se valida en X, Z y Y y entre tipos distintos', () => {
  const a = object('a', 0, 0);
  const b = object('b', 0, 0);
  assert.match(checkObjectCollisions(b, [a]), /superpone/);
  assert.equal(checkObjectCollisions(object('b', 0, 0, 1.3), [a]), null);
  assert.equal(checkObjectCollisions(object('b', 1.5, 0), [a]), null);
  const wall = partition('p', 'x');
  assert.match(checkObjectCollisions(a, [], [wall]), /tabique/);
  assert.match(checkPartitionCollisions(wall, [], [a]), /objeto/);
  assert.match(checkPartitionCollisions(partition('p2', 'z'), [wall]), /tabique/);
  assert.equal(aabbOverlap(objectAABB(a), objectAABB(object('b', 2, 1))), false);
});

test('P90 ventana y P91 puerta se vinculan y no son tarifas certificadas', () => {
  assert.equal(reinforcementCodeFor('window'), 'P90');
  assert.equal(reinforcementCodeFor('door'), 'P91');
  assert.deepEqual(withOpeningReinforcement({ type: 'door', id: 1 }),
    { type: 'door', id: 1, reinforcementCode: 'P91' });
  assert.throws(() => withOpeningReinforcement({ type: 'other' }));
});

test('Cubicación neta resta todos los vanos sin duplicar el refuerzo', () => {
  const s = {
    ...dims,
    openings: [
      withOpeningReinforcement({ id: 1, face: 'A', type: 'door', w: 0.9, h: 2 }),
      withOpeningReinforcement({ id: 2, face: 'A', type: 'window', w: 1.2, h: 1 }),
      withOpeningReinforcement({ id: 3, face: 'C', type: 'window', w: 1, h: 0.6 })
    ],
    finishes: { walls: { A: 'P34', B: null, C: 'P30', D: null } }
  };
  const q = computeWallTakeoff(s);
  assert.equal(q.walls.A.grossAreaM2, 15);
  assert.equal(q.walls.A.openingsAreaM2, 3);
  assert.equal(q.walls.A.netAreaM2, 12);
  assert.equal(q.walls.A.liningAreaM2, 12);
  assert.equal(q.walls.C.netAreaM2, 14.4);
  assert.equal(q.walls.B.netAreaM2, 6);
  assert.equal(q.walls.B.liningAreaM2, 0);
  assert.equal(q.reinforcement.P90.openings, 2);
  assert.equal(q.reinforcement.P91.openings, 1);
  assert.equal(q.reinforcement.P90.estimatedLinearM, 7.6);
  assert.equal(q.reinforcement.P91.estimatedLinearM, 5.8);
  assert.equal(q.status, 'preliminary');
});