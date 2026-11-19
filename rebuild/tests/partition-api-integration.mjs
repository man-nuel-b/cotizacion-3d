import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  interiorClearance, resolvePartitionGeometry, resolveRotatedPartition,
  validatePartitionInsideContainer, checkPartitionCollisions,
  validateInteriorDoor, validatePartitionSpecification, computeWallTakeoff,
  validateSharedWallRegion
} from '../construction-integrity.js';
import { CATALOG, CATALOG_BY_CODE } from '../container-catalog.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'container-engine.js'), 'utf8');
const start = source.indexOf('const api = {');
const end = source.indexOf('\n};\n\nwindow.Container3D = api;', start);
assert.ok(start >= 0 && end > start, 'Se pudo recuperar la API real del motor');
const apiCode = source.slice(start, end + 3);

function fixture() {
  const state = {
    type: 'maritimo', L: 6, W: 2.4, H: 2.5, color: '#999999', openings: [],
    partitions: [], interiorDoors: [], objects: [], services: [], sharedWalls: [],
    finishes: { floor: null, ceiling: null, skirting: null,
      walls: { A: null, B: null, C: null, D: null } },
    seeInside: true, nextId: 1
  };
  const T = { maritimo: { dims: [6, 2.4, 2.5], color: '#999999' },
    reefer: { dims: [6, 2.4, 2.5], color: '#eeeeee' },
    modular: { dims: [6, 2.4, 2.5], color: '#cccccc' } };
  const panel = .05;
  const partitionDoorError = (p, doors = state.interiorDoors) => {
    for (const d of doors) if (d.partitionId === p.id) {
      const issue = validateInteriorDoor(d, p, doors);
      if (issue) return issue;
    }
    return null;
  };
  let buildCount = 0;
  const ctx = {
    state, TYPES: T, profileCfg: { WALL: panel }, owned: [], objectGroups: [],
    editor: { refresh() {} }, selectedEntity: null,
    build() { buildCount++; },
    frameCamera() {}, syncPanel() {}, applyXray() {},
    renderer: { info: { memory: { geometries: 0, textures: 0 } } },
    camera: { position: { set() {} } }, controls: { target: { set() {} }, update() {} },
    get buildCount() { return buildCount; },
    profileThicknessFor() { return panel; },
    fittedPartition(p, ref = state) { return resolvePartitionGeometry(p, ref, panel); },
    partitionSpecificationError: validatePartitionSpecification,
    partitionDoorError,
    partitionError(p, ref = state) {
      return validatePartitionInsideContainer(p, ref, panel) ||
        checkPartitionCollisions(p, ref.partitions || state.partitions, ref.objects || state.objects);
    },
    objectError() { return null; },
    validateOpening() { return null; },
    validDimensions(L, W, H) { return L >= 2 && L <= 25 && W >= 1 && W <= 5 && H >= 1.8 && H <= 5; },
    markChanged() { buildCount++; return { ok: true }; },
    CATALOG, CATALOG_BY_CODE, interiorClearance, resolvePartitionGeometry,
    resolveRotatedPartition, validateInteriorDoor, validatePartitionSpecification,
    computeWallTakeoff, validateSharedWallRegion,
    SAMPLES: { maritimo: [], reefer: [], modular: [] },
    console
  };
  vm.runInNewContext(apiCode + '\n globalThis.testAPI = api;', ctx, { filename: 'engine-api-under-test.js' });
  return { api: ctx.testAPI, state, ctx };
}

const good = (result) => assert.equal(result.ok, true, result.error);

test('API real: crear tabique, activar capas y añadir puerta recalcula superficies y estado', () => {
  const { api } = fixture();
  const added = api.addPartition({ axis: 'x', length: 3, height: 2.4, thickness: .1,
    faceALining: 'P30', faceBLining: 'P34', hasInsulation: true, insulationCode: 'P21' });
  good(added);
  const door = api.addInteriorDoor({ partitionId: added.id });
  good(door);
  const st = api.getState();
  assert.equal(st.partitions[0].faceALining, 'P30');
  assert.equal(st.partitions[0].faceBLining, 'P34');
  assert.equal(st.partitions[0].hasInsulation, true);
  assert.equal(st.interiorDoors.length, 1);
  const takeoff = api.getConstructionTakeoff();
  assert.equal(takeoff.interiorDoorsCount, 1);
  assert.ok(Math.abs(takeoff.totalPartitionLiningAreaM2 - 11.2) < 1e-8);
  assert.ok(Math.abs(takeoff.totalPartitionInsulationAreaM2 - 5.6) < 1e-8);
  assert.equal(takeoff.interiorDoorsByCode.P81, 1);
});

test('API real: editar puerta y quitar revestimiento de una cara cambia las superficies', () => {
  const { api } = fixture();
  const wall = api.addPartition({ axis: 'x', length: 3, height: 2.4, thickness: .1,
    faceALining: 'P30', faceBLining: 'P30' });
  good(wall);
  const door = api.addInteriorDoor({ partitionId: wall.id, u: .5, w: .7, h: 2, catalogCode: 'P80' });
  good(door);
  good(api.updateInteriorDoor(door.id, { u: 1.1, w: .8, catalogCode: 'P81' }));
  good(api.updatePartition(wall.id, { faceBLining: null, hasInsulation: true, insulationCode: 'P22' }));
  const q = api.getConstructionTakeoff();
  assert.ok(Math.abs(q.totalPartitionLiningAreaM2 - 5.6) < 1e-9);
  assert.ok(Math.abs(q.totalPartitionInsulationAreaM2 - 5.6) < 1e-9);
  assert.equal(q.interiorDoorsByCode.P80, undefined);
  assert.equal(q.interiorDoorsByCode.P81, 1);
});

test('API real: rechazo de acortamiento, giro o redimensionado que dejaría la puerta fuera', () => {
  const { api } = fixture();
  const wall = api.addPartition({ axis: 'x', height: 2.4, thickness: .1, autoSpan: true });
  good(wall);
  const door = api.addInteriorDoor({ partitionId: wall.id, u: 4.5, w: .8, h: 2 });
  good(door);
  const original = api.getState();
  assert.equal(api.updatePartition(wall.id, { autoSpan: false, length: 3 }).ok, false);
  assert.equal(api.rotatePartition(wall.id).ok, false);
  assert.equal(api.setDimensions(4, 2.4, 2.5).ok, false);
  assert.deepEqual(api.getState(), original);
});

test('API real: eliminar tabique elimina sus puertas asociadas', () => {
  const { api } = fixture();
  const wall = api.addPartition({ axis: 'x', length: 3, height: 2.4, thickness: .1 });
  good(wall);
  good(api.addInteriorDoor({ partitionId: wall.id }));
  good(api.removePartition(wall.id));
  assert.equal(api.getState().interiorDoors.length, 0);
  assert.equal(api.getState().partitions.length, 0);
});

test('API real: JSON legado sin interiorDoors ni propiedades nuevas importa sin alterar medidas', () => {
  const { api } = fixture();
  const legacy = api.getState();
  legacy.partitions = [{ id: 'partition-2', axis: 'x', length: 1.3,
    height: 2.2, thickness: .03, cx: .2, cz: .2 }];
  delete legacy.interiorDoors;
  legacy.nextId = 3;
  const result = api.setState(legacy);
  good(result);
  const imported = api.getState();
  assert.equal(imported.partitions[0].length, 1.3);
  assert.equal(imported.partitions[0].thickness, .03);
  assert.equal(imported.partitions[0].faceALining, null);
  assert.equal(imported.partitions[0].hasInsulation, false);
  assert.deepEqual(JSON.parse(JSON.stringify(imported.interiorDoors)), []);
});

test('API real: JSON v3 con tabiques y puertas se importa y exporta sin cambios', () => {
  const f1 = fixture();
  const wall = f1.api.addPartition({ axis: 'x', length: 3, height: 2.4, thickness: .1,
    faceALining: 'P30', faceBLining: 'P31', hasInsulation: true, insulationCode: 'P20' });
  good(wall);
  good(f1.api.addInteriorDoor({ partitionId: wall.id }));
  const saved = f1.api.getState();
  const f2 = fixture();
  good(f2.api.setState(saved));
  assert.deepEqual(JSON.parse(JSON.stringify(f2.api.getState())), JSON.parse(JSON.stringify(saved)));
});

test('API real: importar una puerta huérfana falla sin corromper el proyecto original', () => {
  const { api } = fixture();
  const prior = api.getState();
  const invalid = structuredClone(prior);
  invalid.interiorDoors = [{ id: 'idoor-1', partitionId: 'partition-x', u: 0.1, w: .8, h: 2, catalogCode: 'P81' }];
  const res = api.setState(invalid);
  assert.equal(res.ok, false);
  assert.match(res.error, /anfitrión/);
  assert.deepEqual(api.getState(), prior);
});

test('API real: no acepta aislación incompatible ni puerta que invada otra', () => {
  const { api } = fixture();
  const invalid = api.addPartition({ axis: 'x', length: 3, height: 2.4, thickness: .06,
    faceALining: 'P30', faceBLining: 'P30', hasInsulation: true, insulationCode: 'P20' });
  assert.equal(invalid.ok, false);
  assert.match(invalid.error, /espesor/);
  const wall = api.addPartition({ axis: 'x', length: 4, height: 2.4, thickness: .1 });
  good(wall);
  good(api.addInteriorDoor({ partitionId: wall.id, u: .4 }));
  const another = api.addInteriorDoor({ partitionId: wall.id, u: 1.1 });
  assert.equal(another.ok, false);
  assert.match(another.error, /solapadas/);
});
