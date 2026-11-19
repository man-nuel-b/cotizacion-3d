import test from 'node:test';
import assert from 'node:assert/strict';
import {
  interiorClearance, objectAABB, partitionAABB, aabbOverlap,
  resolvePartitionGeometry, resolveRotatedPartition, sanitizeAndClampPartition,
  validateObjectInsideContainer, validatePartitionInsideContainer,
  validateOpeningCornerClearance,
  checkObjectCollisions, checkPartitionCollisions,
  reinforcementCodeFor, withOpeningReinforcement,
  computeWallTakeoff, computeSharedWallDeduction
} from '../construction-integrity.js';

const dims = { L: 6, W: 2.4, H: 2.5 };
const panel = 0.05;
const object = (id, x, z, y = 0, rot = 0) => ({ id, x, z, y, rot, w: 0.6, h: 1, d: 0.4 });
const partition = (id, axis, cx = 0, cz = 0) => ({ id, axis, cx, cz, length: 1.6, thickness: 0.1, height: 2.3 });

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

test('Validación de holgura respecto a esquineros estructurales ISO', () => {
  assert.equal(validateOpeningCornerClearance({ u: 0.5, w: 1.2 }, 6.0), null);
  assert.match(validateOpeningCornerClearance({ u: 0.05, w: 1.2 }, 6.0), /esquinero/);
  assert.match(validateOpeningCornerClearance({ u: 4.8, w: 1.15 }, 6.0), /esquinero/);
});

test('La rotación 90° intercambia AABB sin alterar longitud ni espesor', () => {
  const alongX = partitionAABB(partition('p', 'x'));
  const alongZ = partitionAABB(partition('p', 'z'));
  assert.equal(alongX.rx, alongZ.rz);
  assert.equal(alongX.rz, alongZ.rx);
  assert.ok(Math.abs(objectAABB(object('o', 0, 0, 0, 90)).rx - 0.2) < 1e-9);
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
  assert.deepEqual(withOpeningReinforcement({ type: 'door', id: 1 }), { type: 'door', id: 1, reinforcementCode: 'P91' });
  assert.throws(() => withOpeningReinforcement({ type: 'other' }));
});

test('Descuento geométrico paramétrico de muros compartidos en doble ancho y L', () => {
  const m1 = { L: 12, W: 2.4, H: 2.5 };
  const m2 = { L: 12, W: 2.4, H: 2.5 };
  assert.equal(computeSharedWallDeduction(m1, m2, 'double'), 60);
  assert.equal(computeSharedWallDeduction(m1, m2, 'lshape'), 12);
});

test('Cubicación neta resta todos los vanos sin duplicar el refuerzo', () => {
  const s = {
    ...dims,
    openings: [
      withOpeningReinforcement({ id: 1, face: 'A', type: 'door', w: 0.9, h: 2, v: 0 }),
      withOpeningReinforcement({ id: 2, face: 'A', type: 'window', w: 1.2, h: 1, v: 1 }),
      withOpeningReinforcement({ id: 3, face: 'C', type: 'window', w: 1, h: 0.6, v: 1.2 })
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
  assert.ok(Math.abs(q.reinforcement.P90.estimatedLinearM - 7.6) < 1e-9);
  assert.equal(q.reinforcement.P91.estimatedLinearM, 5.8);
  assert.equal(q.status, 'preliminary');
});

test('El descuento de contacto descuenta por cara sin alterar otras caras ni duplicar totales', () => {
  const s = {
    ...dims,
    openings: [{ id: 1, type: 'window', face: 'A', u: 0.5, v: 1.0, w: 1.0, h: 0.8 }],
    sharedWalls: [
      { id: 'shared-2', face: 'A', u: 2.0, v: 0, w: 2.0, h: 2.5 },
      { id: 'shared-3', face: 'B', u: 0.2, v: 0, w: 1.0, h: 2.5 }
    ],
    finishes: { walls: { A: 'P34', B: 'P30', C: null, D: null } }
  };
  const q = computeWallTakeoff(s);
  assert.equal(q.sharedDeductionM2, 7.5);
  assert.equal(q.walls.A.sharedDeductionM2, 5);
  assert.equal(q.walls.A.netAreaM2, 9.2);
  assert.equal(q.walls.A.liningAreaM2, 9.2);
  assert.equal(q.walls.B.netAreaM2, 3.5);
  assert.equal(q.walls.C.netAreaM2, 15);
  assert.equal(q.walls.C.liningAreaM2, 0);
  assert.ok(Math.abs(q.totalNetWallAreaM2 -
    Object.values(q.walls).reduce((sum, face) => sum + face.netAreaM2, 0)) < 1e-9);
  assert.ok(Math.abs(q.totalGrossWallAreaM2 - q.totalOpeningsAreaM2 -
    q.sharedDeductionM2 - q.totalNetWallAreaM2) < 1e-9);
  assert.ok(Math.abs(q.skirtingLinearM - (2 * (dims.L + dims.W) - 3)) < 1e-9);
});

test('No se permite descontar dos veces ni cubrir un vano con una zona compartida', async () => {
  const { validateSharedWallRegion, validateOpeningAgainstSharedWalls } =
    await import('../construction-integrity.js');
  const opening = { id: 1, face: 'A', u: 1, v: 0.6, w: 1, h: 1 };
  const shared = { id: 'shared-2', face: 'A', u: 0.5, v: 0.5, w: 1, h: 1 };
  const ref = { ...dims, openings: [opening], sharedWalls: [] };
  assert.match(validateSharedWallRegion(shared, ref), /abertura/);
  assert.match(validateOpeningAgainstSharedWalls(opening, [shared]), /compartido/);
  const a = { id: 'shared-3', face: 'C', u: 0, v: 0, w: 2, h: 2.5 };
  const b = { id: 'shared-4', face: 'C', u: 1, v: 0, w: 2, h: 2.5 };
  assert.match(validateSharedWallRegion(b, { ...ref, sharedWalls: [a] }), /superpone/);
  assert.match(validateSharedWallRegion({ ...a, w: 8 }, ref), /límites/);
  assert.equal(validateSharedWallRegion(a, ref), null);
  assert.throws(() => computeWallTakeoff({ ...ref, sharedWalls: [a, b], finishes: { walls: {} } }), /superpone/);
  assert.throws(() => computeWallTakeoff({ ...ref, sharedWalls: [a, a], finishes: { walls: {} } }), /duplicado/);
});

test('Descuento de contacto tiene dimensiones acotadas y no acepta layouts desconocidos', () => {
  assert.throws(() => computeSharedWallDeduction({ L: 1, W: 1, H: 2 }, { L: -1, W: 1, H: 2 }, 'double'));
  assert.throws(() => computeSharedWallDeduction({ L: 1, W: 1, H: 2 }, { L: 1, W: 1, H: 2 }, 'other'));
});

test('SAT reconoce libertad de colocación con dos objetos diagonales sin contacto real', async () => {
  const { orientedOverlap } = await import('../construction-integrity.js');
  const a = { id: 'a', x: 0, z: 0, y: 0, h: 2, w: 1.6, d: 0.1, rot: 45 };
  const b = { ...a, id: 'b', x: 0.2, z: -1.2 };
  assert.equal(aabbOverlap(objectAABB(a), objectAABB(b)), true);
  assert.equal(orientedOverlap(a, b), false);
  assert.equal(checkObjectCollisions(b, [a]), null);
  assert.equal(orientedOverlap(a, { ...a, id: 'c', x: 0.02, z: 0.02 }), true);
});


test('autoSpan se extiende exactamente entre paramentos del eje Z y X', () => {
  const z = resolvePartitionGeometry({ id: 'z', axis: 'z', height: 2.3, length: 1,
    thickness: .1, cx: .2, cz: .5, autoSpan: true }, dims, panel);
  assert.equal(z.length, 2.4 - 2 * interiorClearance(panel));
  assert.equal(z.cz, 0);
  assert.equal(z.cx, .2);
  assert.equal(validatePartitionInsideContainer(z, dims, panel), null);
  assert.equal(partitionAABB(z).length, z.length);
  assert.equal(partitionAABB(z).rz, z.length / 2);

  const x = resolvePartitionGeometry({ ...z, axis: 'x', length: .5 }, dims, panel);
  assert.equal(x.length, 6 - 2 * interiorClearance(panel));
  assert.equal(x.cx, 0);
  assert.equal(x.cz, 0);
  assert.equal(validatePartitionInsideContainer(x, dims, panel), null);
  assert.equal(partitionAABB(x).rx, x.length / 2);
});

test('tabiques manuales antiguos no cambian medida, altura ni centro', () => {
  const old = { id: 'legacy', axis: 'x', length: 1.4, height: 2.2,
    thickness: .1, cx: .3, cz: .2 };
  const copy = structuredClone(old);
  const resolved = resolvePartitionGeometry(old, dims, panel);
  assert.deepEqual(old, copy);
  assert.deepEqual({ length: resolved.length, height: resolved.height,
    cx: resolved.cx, cz: resolved.cz, autoSpan: resolved.autoSpan },
    { length: 1.4, height: 2.2, cx: .3, cz: .2, autoSpan: false });
  assert.equal(validatePartitionInsideContainer(resolved, dims, panel), null);
  const oversize = { ...old, length: 99 };
  assert.equal(resolvePartitionGeometry(oversize, dims, panel).length, 99);
  assert.match(validatePartitionInsideContainer(oversize, dims, panel), /perfil/);
});

test('autoSpan no normaliza ejes inválidos ni oculta errores y rechaza geometría desincronizada', () => {
  const base = { axis: 'z', length: 0.2, height: 2.4, thickness: .1,
    cx: 0, cz: 0, autoSpan: true };
  assert.ok(Math.abs(sanitizeAndClampPartition(base, dims, panel).length - 2.24) < 1e-9);
  assert.match(validatePartitionInsideContainer(base, dims, panel), /sincronizada/);
  assert.throws(() => resolvePartitionGeometry({ ...base, axis: 'diagonal' }, dims, panel));
  assert.throws(() => resolvePartitionGeometry({ ...base, autoSpan: 'true' }, dims, panel));
  assert.throws(() => resolvePartitionGeometry({ ...base, cx: NaN }, dims, panel));
});

test('cubicación de tabiques usa la longitud materializada y mantiene muros exteriores separados', () => {
  const fitted = resolvePartitionGeometry({ axis: 'z', length: .8, height: 2.3,
    thickness: .1, cx: 0, cz: 0, autoSpan: true, id: 'tabique' }, dims, panel);
  const state = { ...dims, partitions: [fitted], openings: [],
    finishes: { walls: { A: null, B: null, C: null, D: null } } };
  const takeoff = computeWallTakeoff(state);
  assert.equal(takeoff.partitions.length, 1);
  assert.equal(takeoff.partitions[0].lengthM, fitted.length);
  assert.ok(Math.abs(takeoff.totalPartitionOneFaceAreaM2 - fitted.length * 2.3) < 1e-9);
  assert.ok(Math.abs(takeoff.totalPartitionBothFacesAreaM2 - fitted.length * 2.3 * 2) < 1e-9);
  assert.equal(takeoff.totalGrossWallAreaM2, 42);
});


test('Giro manual 90° respeta largo y centro sin alterar el diseño original', () => {
  const original = { id: 'r1', axis: 'x', cx: .05, cz: .1,
    length: 1.4, height: 2.3, thickness: .1, autoSpan: false };
  const before = structuredClone(original);
  const rotated = resolveRotatedPartition(original, dims, panel);
  assert.deepEqual(original, before);
  assert.equal(rotated.axis, 'z');
  assert.equal(rotated.length, 1.4);
  assert.equal(rotated.cx, .05);
  assert.equal(rotated.cz, .1);
  assert.equal(rotated.autoSpan, false);
  assert.equal(validatePartitionInsideContainer(rotated, dims, panel), null);
});

test('Giro manual sobredimensionado se rechaza; ajuste expreso gira con nueva luz útil', () => {
  const original = { id: 'r2', axis: 'x', cx: 0, cz: 0,
    length: 4.2, height: 2.3, thickness: .1, autoSpan: false };
  assert.equal(validatePartitionInsideContainer(original, dims, panel), null);
  const manual = resolveRotatedPartition(original, dims, panel);
  assert.match(validatePartitionInsideContainer(manual, dims, panel), /perfil/);
  const fitted = resolveRotatedPartition(original, dims, panel, { autoSpan: true });
  assert.equal(fitted.axis, 'z');
  assert.equal(fitted.autoSpan, true);
  assert.ok(Math.abs(fitted.length - (dims.W - 2 * interiorClearance(panel))) < 1e-9);
  assert.equal(validatePartitionInsideContainer(fitted, dims, panel), null);
  assert.equal(original.length, 4.2);
  assert.equal(original.autoSpan, false);
});

test('Giro autoSpan actualiza ambos ejes sin perder geometría ni área', () => {
  const original = resolvePartitionGeometry({
    id: 'r3', axis: 'z', cx: 0.25, cz: 0, length: 1,
    thickness: .1, height: 2.3, autoSpan: true
  }, dims, panel);
  const turned = resolveRotatedPartition(original, dims, panel);
  assert.equal(turned.axis, 'x');
  assert.equal(turned.cx, 0);
  assert.equal(turned.cz, 0);
  assert.equal(turned.autoSpan, true);
  assert.ok(Math.abs(turned.length - (dims.L - 2 * interiorClearance(panel))) < 1e-9);
  assert.equal(validatePartitionInsideContainer(turned, dims, panel), null);
  const restored = resolveRotatedPartition(turned, dims, panel);
  assert.equal(restored.axis, 'z');
  assert.equal(restored.length, original.length);
  assert.equal(restored.autoSpan, true);
  assert.equal(validatePartitionInsideContainer(restored, dims, panel), null);
});

test('Giro de tabique sigue respetando las colisiones con objetos', () => {
  const original = { id: 'r4', axis: 'x', cx: 0, cz: .4,
    length: 1.4, height: 2.3, thickness: .1, autoSpan: false };
  const sofa = { id: 'sofa', x: 0, z: -.05, y: 0, w: .6, d: .6, h: 1.0, rot: 0 };
  assert.equal(checkPartitionCollisions(original, [], [sofa]), null);
  const turned = resolveRotatedPartition(original, dims, panel);
  assert.match(checkPartitionCollisions(turned, [], [sofa]), /objeto/);
});
