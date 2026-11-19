import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateInteriorDoor, validatePartitionSpecification, computeWallTakeoff,
  resolvePartitionGeometry, interiorClearance
} from '../construction-integrity.js';

const ref = { L: 6, W: 2.4, H: 2.5 };
const p = ({ id = 'partition-1', axis = 'x', length = 3, height = 2.4, thickness = 0.1,
  cx = 0, cz = 0, autoSpan = false, faceALining = null, faceBLining = null,
  hasInsulation = false, insulationCode = null } = {}) =>
  ({ id, axis, length, height, thickness, cx, cz, autoSpan,
    faceALining, faceBLining, hasInsulation, insulationCode });
const d = (data = {}) => ({ id: 'idoor-2', partitionId: 'partition-1', u: 1.05,
  w: .8, h: 2, catalogCode: 'P81', ...data });
const state = (partition, interiorDoors = []) => ({ ...ref, openings: [], sharedWalls: [],
  finishes: { walls: {} }, partitions: [partition], interiorDoors });
const equalArea = (a,b) => assert.ok(Math.abs(a-b) < 1e-9, `${a} != ${b}`);

test('Una puerta interior resta su superficie de ambas caras, aislación y revestimientos', () => {
  const wall = p({ faceALining: 'P30', faceBLining: 'P34', hasInsulation: true, insulationCode: 'P21' });
  const q = computeWallTakeoff(state(wall, [d()]));
  const oneFace = 3 * 2.4 - .8 * 2;
  equalArea(q.partitions[0].oneFaceAreaM2, oneFace);
  equalArea(q.partitions[0].doorsAreaM2, 1.6);
  equalArea(q.partitions[0].bothFacesAreaM2, oneFace * 2);
  equalArea(q.totalPartitionLiningAreaM2, oneFace * 2);
  equalArea(q.totalPartitionInsulationAreaM2, oneFace);
  equalArea(q.partitionLiningByCodeM2.P30, oneFace);
  equalArea(q.partitionLiningByCodeM2.P34, oneFace);
  equalArea(q.partitionInsulationByCodeM2.P21, oneFace);
  assert.equal(q.interiorDoorsCount, 1);
  assert.deepEqual(q.interiorDoorsByCode, { P81: 1 });
});

test('Sin revestir una cara se excluye exclusivamente esa placa de la medición', () => {
  const q = computeWallTakeoff(state(p({ faceALining: 'P31', faceBLining: null, hasInsulation: false })));
  equalArea(q.totalPartitionLiningAreaM2, 7.2);
  equalArea(q.partitions[0].faceALiningAreaM2, 7.2);
  assert.equal(q.partitions[0].faceBLiningAreaM2, 0);
  assert.equal(q.totalPartitionInsulationAreaM2, 0);
  assert.deepEqual(q.partitionInsulationByCodeM2, {});
});

test('Dos tabiques agrupan correctamente áreas por material y puertas por código', () => {
  const first = p({ faceALining: 'P30', faceBLining: 'P30', hasInsulation: true, insulationCode: 'P20' });
  const second = p({ id: 'partition-9', length: 1.6, height: 2, faceALining: 'P30', faceBLining: null,
    hasInsulation: true, insulationCode: 'P21' });
  const q = computeWallTakeoff({ ...state(first, [d()]), partitions: [first, second] });
  equalArea(q.partitionLiningByCodeM2.P30, 2 * (7.2 - 1.6) + 3.2);
  equalArea(q.partitionInsulationByCodeM2.P20, 5.6);
  equalArea(q.partitionInsulationByCodeM2.P21, 3.2);
});

test('Puerta inválida: sin anfitrión, fuera de límites, con dintel insuficiente o código incorrecto', () => {
  const host = p();
  assert.match(validateInteriorDoor(d(), null), /anfitrión/);
  assert.match(validateInteriorDoor(d({ u: 0.02 }), host), /margen/);
  assert.match(validateInteriorDoor(d({ u: 2.5 }), host), /margen/);
  assert.match(validateInteriorDoor(d({ h: 2.38 }), host), /dintel/);
  assert.match(validateInteriorDoor(d({ catalogCode: 'P83' }), host), /partida/i);
  assert.match(validateInteriorDoor(d({ w: NaN }), host), /dimensiones/i);
});

test('Puertas dentro de un tabique requieren separación mínima y no se duplican en cubicación', () => {
  const host = p({ length: 4 });
  const first = d({ u: 0.4 });
  const second = d({ id: 'idoor-3', u: 1.15 });
  assert.match(validateInteriorDoor(second, host, [first]), /solapadas/);
  assert.throws(() => computeWallTakeoff(state(host, [first, { ...first }])), /duplicada/);
  const valid = d({ id: 'idoor-3', u: 2.0 });
  assert.equal(validateInteriorDoor(valid, host, [first]), null);
});

test('La cubicación no acepta puertas sin tabique anfitrión ni geometría inválida', () => {
  assert.throws(() => computeWallTakeoff(state(p(), [d({ partitionId: 'partition-missing' })])), /anfitrión/);
  assert.throws(() => computeWallTakeoff(state(p(), [d({ h: -1 })])), /inválida/);
});

test('Configurar capas rechaza códigos no compatibles y espesores físicamente insuficientes', () => {
  assert.equal(validatePartitionSpecification(p({ faceALining: 'P30', faceBLining: 'P34' })), null);
  assert.match(validatePartitionSpecification(p({ faceALining: 'P85' })), /[Rr]evestimiento/);
  assert.match(validatePartitionSpecification(p({ hasInsulation: true, insulationCode: 'P85' })), /[Aa]islación/);
  assert.match(validatePartitionSpecification(p({ hasInsulation: false, insulationCode: 'P20' })), /[Aa]islación/);
  assert.match(validatePartitionSpecification(p({ thickness: .05, faceALining: 'P30', faceBLining: 'P31', hasInsulation: true, insulationCode: 'P20' })), /espesor/);
});

test('Sin autoSpan la geometría manual y sus propiedades constructivas se conservan', () => {
  const old = p({ length: 1.2, cx: .2, cz: .3 });
  const fitted = resolvePartitionGeometry(old, ref, .05);
  assert.deepEqual(fitted, old);
  assert.equal(fitted.length, 1.2);
  const span = resolvePartitionGeometry({ ...old, axis: 'z', autoSpan: true }, ref, .05);
  equalArea(span.length, ref.W - 2 * interiorClearance(.05));
  assert.equal(span.faceALining, null);
  assert.equal(span.hasInsulation, false);
});
