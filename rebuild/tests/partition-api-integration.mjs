import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  interiorClearance, resolvePartitionGeometry, resolveRotatedPartition,
  validatePartitionInsideContainer, checkPartitionCollisions,
  validateInteriorDoor, validatePartitionSpecification, computeWallTakeoff, withOpeningReinforcement,
  validateSharedWallRegion, classifyPartitionJunction, computePartitionJunctions,
  checkJunctionAgainstDoors, resolveMagneticPartitionMove, computeFreePartitionSpan, validateBathFloor, detectRectangularRoomAt
} from '../construction-integrity.js';
import { CATALOG, CATALOG_BY_CODE } from '../container-catalog.js';
import { defaultElectricalConfig, sanitizeElectricalConfig } from '../electrical-project-config.js';
import { validateExteriorZone, sanitizeExteriorZones } from '../exterior-finish-zones.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'container-engine.js'), 'utf8');
const start = source.indexOf('const api = {');
const end = source.indexOf('\n};\n\nwindow.Container3D = api;', start);
assert.ok(start >= 0 && end > start, 'Se pudo recuperar la API real del motor');
const apiCode = source.slice(start, end + 3);

function fixture() {
  const state = {
    type: 'maritimo', L: 6, W: 2.4, H: 2.5, color: '#999999', openings: [],
    partitions: [], interiorDoors: [], objects: [], services: [], sharedWalls: [], bathFloor: null, floorDirection: 'length',
    electrical: defaultElectricalConfig(),
    finishes: { floor: null, ceiling: null, skirting: null,
      walls: { A: null, B: null, C: null, D: null },
      interiorWalls: { A: null, B: null, C: null, D: null }, exteriorZones: [] },
    seeInside: true, nextId: 1
  };
  const T = { maritimo: { dims: [6, 2.4, 2.5], color: '#999999', R: .046, T: .004 },
    reefer: { dims: [6, 2.4, 2.5], color: '#eeeeee', R: .046, T: .004 },
    modular: { dims: [6, 2.4, 2.5], color: '#cccccc', R: .046, T: .004 } };
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
    FACES: { A: { long: true }, B: { long: false }, C: { long: true }, D: { long: false } },
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
        checkPartitionCollisions(p, ref.partitions || state.partitions, ref.objects || state.objects,
          ref.interiorDoors || state.interiorDoors);
    },
    objectError() { return null; },
    validateOpening() { return null; },
    validDimensions(L, W, H) { return L >= 2 && L <= 25 && W >= 1 && W <= 5 && H >= 1.8 && H <= 5; },
    markChanged() { buildCount++; return { ok: true }; },
    CATALOG, CATALOG_BY_CODE, defaultElectricalConfig, sanitizeElectricalConfig, validateExteriorZone, sanitizeExteriorZones,
    interiorClearance, resolvePartitionGeometry,
    resolveRotatedPartition, validateInteriorDoor, validatePartitionSpecification,
    computeWallTakeoff, withOpeningReinforcement, validateSharedWallRegion, validateBathFloor, detectRectangularRoomAt, classifyPartitionJunction,
    computePartitionJunctions, checkJunctionAgainstDoors, resolveMagneticPartitionMove, computeFreePartitionSpan,
    SAMPLES: { maritimo: [], reefer: [], modular: [] },
    console
  };
  const helperStart = source.indexOf('function freePartitionCenters(');
  const helperEnd = source.indexOf('\nfunction partitionSpecificationError(', helperStart);
  assert.ok(helperStart >= 0 && helperEnd > helperStart);
  const helperCode = source.slice(helperStart, helperEnd);
  const exteriorStart = source.indexOf('function exteriorZonesError(');
  const exteriorEnd = source.indexOf('\nfunction fittedPartition(', exteriorStart);
  assert.ok(exteriorStart >= 0 && exteriorEnd > exteriorStart);
  const exteriorCode = source.slice(exteriorStart, exteriorEnd);
  vm.runInNewContext(exteriorCode + '\n' + helperCode + '\n' + apiCode + '\n globalThis.testAPI = api;', ctx,
    { filename: 'engine-api-under-test.js' });
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


test('API real: segundo tabique autoPlace ocupa otra bahía libre sin superponerse', () => {
  const { api } = fixture();
  const props = { axis: 'z', height: 2.3, thickness: .1, autoSpan: true, autoPlace: true };
  const first = api.addPartition(props); good(first);
  const second = api.addPartition(props); good(second);
  const third = api.addPartition(props); good(third);
  const partitions = api.getState().partitions;
  assert.equal(partitions.length, 3);
  assert.equal(partitions[0].cx, 0);
  assert.ok(Math.abs(partitions[1].cx) >= .65);
  assert.ok(Math.abs(partitions[2].cx - partitions[1].cx) >= .65);
  assert.equal(second.autoPlaced, true);
  assert.equal(third.autoPlaced, true);
  assert.equal(checkPartitionCollisions(partitions[2], partitions.slice(0, 2)), null);
});

test('API real: creación manual en la misma posición se sigue rechazando', () => {
  const { api } = fixture();
  const props = { axis: 'z', height: 2.3, thickness: .1, autoSpan: true };
  good(api.addPartition(props));
  const before = api.getState();
  const second = api.addPartition(props);
  assert.equal(second.ok, false);
  assert.match(second.error, /superpone/);
  assert.deepEqual(api.getState(), before);
});

test('API real: si el contenedor está ocupado autoPlace no inserta ni rompe el estado', () => {
  const { api } = fixture();
  const props = { axis: 'z', height: 2.3, thickness: .1, autoSpan: true, autoPlace: true };
  let count = 0;
  for (let i = 0; i < 20; i++) {
    const result = api.addPartition(props);
    if (!result.ok) {
      assert.match(result.error, /espacio libre/);
      break;
    }
    count++;
  }
  assert.ok(count >= 3 && count < 20);
  assert.equal(api.getState().partitions.length, count);
});

test('API real: la búsqueda de posición libre también respeta objetos que bloquean una bahía', () => {
  const { api, state } = fixture();
  const props = { axis: 'z', height: 2.3, thickness: .1, autoSpan: true, autoPlace: true };
  good(api.addPartition(props));
  state.objects.push({ id: 'obj-test', code: 'P60', x: 1.45, z: 0, y: 0, w: .8, d: .8, h: 1, rot: 0 });
  const next = api.addPartition(props); good(next);
  assert.ok(next.cx < -0.65, 'Debe seleccionar una bahía distinta de aquella ocupada por mobiliario');
});


test('API real: una T se crea desde tabique seleccionado y llega al paramento útil', () => {
  const { api } = fixture();
  const first = api.addPartition({ axis: 'z', height: 2.3, thickness: .1, autoSpan: true });
  good(first);
  const joined = api.addPartitionJunction({ hostId: first.id, type: 'T', side: 1 });
  good(joined);
  const st = api.getState();
  assert.equal(st.partitions.length, 2);
  assert.equal(st.partitions[1].axis, 'x');
  assert.equal(st.partitions[1].autoSpan, false);
  assert.equal(st.partitions[1].cx > 0, true);
  assert.equal(classifyPartitionJunction(st.partitions[0], st.partitions[1])?.type, 'T');
  assert.equal(api.getConstructionTakeoff().partitionTJunctionsCount, 1);
  const second = api.addPartitionJunction({ hostId: first.id, type: 'T', side: -1 });
  good(second);
  assert.equal(api.getConstructionTakeoff().partitionTJunctionsCount, 2);
  const exported = api.getState();
  assert.ok(exported.partitions.length === 3);
  const result = api.setState(exported);
  good(result);
  assert.equal(api.getConstructionTakeoff().partitionTJunctionsCount, 2);
});

test('API real: L en tabique manual; no sobreposición ni hueco de puerta en la unión', () => {
  const { api } = fixture();
  const host = api.addPartition({ axis: 'z', length: 1.5, cx: -.8, cz: -.2,
    height: 2.3, thickness: .1, autoSpan: false });
  good(host);
  const l = api.addPartitionJunction({ hostId: host.id, type: 'L', side: 1, endpoint: 1 });
  good(l);
  const s = api.getState();
  assert.equal(classifyPartitionJunction(s.partitions[0], s.partitions[1])?.type, 'L');
  assert.equal(api.getConstructionTakeoff().partitionLJunctionsCount, 1);
  const forbidden = api.addInteriorDoor({ partitionId: host.id, u: .08, w: .4, h: 2 });
  assert.equal(forbidden.ok, false);
  assert.match(forbidden.error, /vano|puerta/i);
});

test('API real: un intento L sobre autoSpan se rechaza con explicación útil', () => {
  const { api } = fixture();
  const host = api.addPartition({ axis: 'z', height: 2.3, thickness: .1, autoSpan: true });
  good(host);
  const r = api.addPartitionJunction({ hostId: host.id, type: 'L' });
  assert.equal(r.ok, false);
  assert.match(r.error, /desactiva autoSpan/);
});

test('API real: la rama T se detiene ante el siguiente tabique paralelo, sin atravesarlo', () => {
  const { api } = fixture();
  const left = api.addPartition({ axis: 'z', length: 2, height: 2.3,
    thickness: .1, cx: -1.1, cz: 0, autoSpan: false });
  good(left);
  const right = api.addPartition({ axis: 'z', length: 2, height: 2.3,
    thickness: .1, cx: 1.1, cz: 0, autoSpan: false });
  good(right);
  const branch = api.addPartitionJunction({ hostId: left.id, type: 'T', side: 1 });
  good(branch);
  const takeoff = api.getConstructionTakeoff();
  assert.equal(takeoff.partitionTJunctionsCount, 2, 'Contacto correcto con ambos tabiques anfitriones');
  const state = api.getState();
  assert.ok(state.partitions[2].length < 2.2, 'La rama se detiene antes del siguiente muro');
  const saved = api.getState();
  saved.partitions[2].cx -= 0.15; // moverla hacia dentro del tabique anfitrión
  const rejected = api.setState(saved);
  assert.equal(rejected.ok, false, 'Rechaza proyecto importado con intersección ilegal');
  assert.equal(api.getConstructionTakeoff().partitionTJunctionsCount, 2,
    'Mantiene intacto el proyecto anterior si importación es inválida');
});


test('API real: vista previa y arrastre con imán actualizan coordenada y cubicación sin cambiar medida', () => {
  const { api, state } = fixture();
  const r = api.addPartition({ axis: 'x', length: 1, height: 2.3, thickness: .1 });
  good(r);
  const before = api.getConstructionTakeoff().totalPartitionOneFaceAreaM2;
  const preview = api.previewPartitionMove(r.id, { cx: 2.4, cz: 0, snap: true });
  good(preview);
  assert.ok(Math.abs(preview.candidate.cx - 2.42) < 1e-8);
  assert.equal(state.partitions[0].cx, 0, 'No se modifica el estado durante la vista previa');
  good(api.movePartition(r.id, { cx: 2.4, cz: 0, snap: true }));
  assert.ok(Math.abs(state.partitions[0].cx - 2.42) < 1e-8);
  assert.equal(state.partitions[0].length, 1);
  assert.equal(api.getConstructionTakeoff().totalPartitionOneFaceAreaM2, before);
  good(api.movePartition(r.id, { cx: 2, cz: .1, snap: false }));
  assert.equal(state.partitions[0].cx, 2);
});

test('API real: autoSpan permanece fijado al eje longitudinal al arrastrar', () => {
  const { api, state } = fixture();
  const r = api.addPartition({ axis: 'z', height: 2.3, thickness: .1, autoSpan: true });
  good(r);
  good(api.movePartition(r.id, { cx: 1.1, cz: .5, snap: true }));
  assert.equal(state.partitions[0].cz, 0);
  assert.equal(state.partitions[0].cx, 1.1);
});

test('API real: mover un tabique sobre otro se rechaza sin alterar estado', () => {
  const { api, state } = fixture();
  const a = api.addPartition({ axis: 'z', height: 2.3, thickness: .1, autoSpan: true, cx: -1 });
  const b = api.addPartition({ axis: 'z', height: 2.3, thickness: .1, autoSpan: true, cx: 1 });
  good(a); good(b);
  const invalid = api.movePartition(b.id, { cx: -1, cz: 0, snap: true });
  assert.equal(invalid.ok, false);
  assert.equal(state.partitions.find(p => p.id === b.id).cx, 1);
});


test('API real: piso de baño separado y remanente evita doble cubicación por partida', () => {
  const { api } = fixture();
  const result = api.setBathFloor({ code: 'P05', length: 2.0, width: 1.2 });
  good(result);
  assert.equal(result.bathAreaM2, 2.4);
  assert.ok(Math.abs(result.remainingAreaM2 - 12) < 1e-8);
  assert.deepEqual(JSON.parse(JSON.stringify(api.getState().bathFloor)),
    { code: 'P05', length: 2, width: 1.2 });
  const t = api.getConstructionTakeoff();
  assert.ok(Math.abs(t.floorAreaM2 - 14.4) < 1e-8);
  assert.ok(Math.abs(t.bathFloorAreaM2 - 2.4) < 1e-8);
  assert.ok(Math.abs(t.remainingFloorAreaM2 - 12) < 1e-8);
  assert.ok(Math.abs(t.floorByCodeM2.P05 - 2.4) < 1e-8);
  good(api.setFinish('P01'));
  const afterFinish = api.getConstructionTakeoff();
  assert.ok(Math.abs(afterFinish.floorByCodeM2.P01 - 12) < 1e-9);
  assert.equal(afterFinish.floorByCodeM2.P05, 2.4);
  assert.ok(Math.abs(Object.values(afterFinish.floorByCodeM2).reduce((a,b)=>a+b,0) - 14.4) < 1e-8);
});

test('API real: código erróneo y cotas fuera del área útil no cambian el proyecto', () => {
  const { api } = fixture();
  const before = api.getState();
  assert.equal(api.setBathFloor({ code: 'P08', length: 2, width: 1 }).ok, false);
  assert.equal(api.setBathFloor({ code: 'P30', length: 2, width: 1 }).ok, false);
  assert.equal(api.setBathFloor({ code: 'P05', length: 6, width: 1 }).ok, false);
  assert.equal(api.setBathFloor({ code: 'P05', length: Number.NaN, width: 1 }).ok, false);
  assert.equal(api.setBathFloor({ code: 'P05', length: 2, width: -1 }).ok, false);
  assert.deepEqual(api.getState(), before);
});

test('API real: cambio de dimensiones rechaza piso de baño incompatible sin mutación parcial', () => {
  const { api } = fixture();
  good(api.setBathFloor({ code: 'P06', length: 4.5, width: 2.1 }));
  const before = api.getState();
  const bad = api.setDimensions(4.2, 2.4, 2.5);
  assert.equal(bad.ok, false);
  assert.match(bad.error, /Piso de baño incompatible/);
  assert.deepEqual(api.getState(), before);
  good(api.setDimensions(5, 2.4, 2.5));
});

test('API real: quitar y cambiar tipo de contenedor limpian piso de baño', () => {
  const { api } = fixture();
  good(api.setBathFloor({ code: 'P05', length: 2, width: 1 }));
  const cleared = api.clearBathFloor();
  good(cleared);
  assert.ok(Math.abs(cleared.remainingAreaM2 - 14.4) < 1e-8);
  assert.equal(api.getConstructionTakeoff().bathFloor, null);
  good(api.setBathFloor({ code: 'P06', length: 2, width: 1 }));
  good(api.setType('modular'));
  assert.equal(api.getState().bathFloor, null);
});

test('API real: exportar e importar piso de baño y JSON legado sin campo', () => {
  const first = fixture();
  good(first.api.setBathFloor({ code: 'P05', length: 2, width: 1.2 }));
  const saved = first.api.getState();
  const second = fixture();
  good(second.api.setState(saved));
  assert.deepEqual(JSON.parse(JSON.stringify(second.api.getState())), JSON.parse(JSON.stringify(saved)));
  const legacy = structuredClone(saved);
  delete legacy.bathFloor;
  good(second.api.setState(legacy));
  assert.equal(second.api.getState().bathFloor, null);
});

test('API real: importar piso de baño inválido restaura el estado y los materiales anteriores', () => {
  const { api } = fixture();
  good(api.setBathFloor({ code: 'P05', length: 1.5, width: 1.2 }));
  const before = api.getState();
  for (const candidate of [
    { code: 'P30', length: 1, width: 1 },
    { code: 'P06', length: 12, width: 1 },
    { code: 'P05', length: null, width: 1 },
    'bad data'
  ]) {
    const bad = structuredClone(before);
    bad.bathFloor = candidate;
    assert.equal(api.setState(bad).ok, false);
    assert.deepEqual(api.getState(), before);
  }
});

test('API V4.8: asigna piso P06 al recinto por clic 3D y guarda coordenadas', () => {
  const {api,state,ctx}=fixture();
  const p=api.addPartition({axis:'z',cx:1,cz:0,height:2.3,thickness:.1,autoSpan:true});
  good(p);
  const result=api.applyBathFloorAt({code:'P06',x:2,z:0,mode:'room'});
  good(result);
  assert.equal(result.bathFloor.code,'P06');
  assert.ok(result.bathFloor.cx>1);
  assert.ok(result.bathFloor.length>1);
  assert.ok(ctx.buildCount>1);
  const t=api.getConstructionTakeoff();
  assert.equal(t.bathFloor.positioned,true);
  assert.ok(t.floorByCodeM2.P06>0);
  assert.ok(Math.abs(t.bathFloorAreaM2+t.remainingFloorAreaM2-14.4)<1e-8);
  assert.deepEqual(api.getState().bathFloor,state.bathFloor);
});

test('API V4.8: rechaza una zona manual que atraviesa un tabique y no altera estado', () => {
  const {api}=fixture();
  good(api.addPartition({axis:'z',cx:1,cz:0,height:2.3,thickness:.1,autoSpan:true}));
  const prior=api.getState();
  const invalid=api.applyBathFloorAt({code:'P06',x:1,z:0,mode:'manual',length:1,width:1});
  assert.equal(invalid.ok,false);
  assert.match(invalid.error,/tabique/);
  assert.deepEqual(api.getState(),prior);
});

test('API V4.8: un piso localizado sobrevive JSON v3 y al quitarlo desaparece', () => {
  const {api}=fixture();
  good(api.addPartition({axis:'z',cx:1,cz:0,height:2.3,thickness:.1,autoSpan:true}));
  good(api.applyBathFloorAt({code:'P05',x:2,z:0,mode:'room'}));
  const snapshot=api.getState();
  const copy=fixture();
  good(copy.api.setState(snapshot));
  assert.deepEqual(JSON.parse(JSON.stringify(copy.api.getState().bathFloor)),JSON.parse(JSON.stringify(snapshot.bathFloor)));
  good(copy.api.clearBathFloor());
  assert.equal(copy.api.getState().bathFloor,null);
});

test('API V4.8: zona manual funciona sin tabiques, pero el recinto automático exige cierre', () => {
  const {api}=fixture();
  assert.match(api.applyBathFloorAt({code:'P06',x:0,z:0,mode:'room'}).error,/tabiques/);
  const placed=api.applyBathFloorAt({code:'P06',x:0,z:0,mode:'manual',length:1.6,width:1.2});
  good(placed);
  assert.equal(placed.bathFloor.cx,0);
  assert.equal(placed.bathFloor.cz,0);
  assert.equal(placed.bathFloor.length,1.6);
});


test('API V4.9: cambiar orientación es seguro y mantiene estado y cubicación', () => {
  const { api, state } = fixture();
  const initial = api.getConstructionTakeoff().floorAreaM2;
  const invalid = api.setFloorDirection('diagonal');
  assert.equal(invalid.ok, false);
  assert.equal(state.floorDirection, 'length');
  assert.equal(api.setFloorDirection('width').ok, true);
  assert.equal(state.floorDirection, 'width');
  assert.equal(api.getConstructionTakeoff().floorAreaM2, initial);
  assert.equal(api.setFloorDirection('length').ok, true);
  assert.equal(api.getState().floorDirection, 'length');
});

test('API V4.9: JSON restaura dirección; respaldos anteriores usan length; valores inválidos se rechazan sin cambios', () => {
  const { api, state } = fixture();
  assert.equal(api.setFloorDirection('width').ok, true);
  const saved = api.getState();
  assert.equal(api.setState(saved).ok, true);
  assert.equal(api.getState().floorDirection, 'width');
  const legacy = structuredClone(saved);
  delete legacy.floorDirection;
  assert.equal(api.setState(legacy).ok, true);
  assert.equal(state.floorDirection, 'length');
  const bad = structuredClone(saved);
  bad.floorDirection = 'other';
  const result = api.setState(bad);
  assert.equal(result.ok, false);
  assert.match(result.error, /Orientación del piso/);
  assert.equal(state.floorDirection, 'length');
  assert.equal(api.setFloorDirection('width').ok, true);
  assert.equal(api.setType('maritimo').ok, true);
  assert.equal(state.floorDirection, 'length');
});

test('API V4.9.2: ajuste libre es una acción expresa y conserva el estado JSON', () => {
  const {api, state}=fixture();
  const wall=api.addPartition({axis:'x',length:1.2,cx:1,cz:0,height:2.3,thickness:.1});
  good(wall);
  const before=api.getState();
  const preview=api.getPartitionFreeSpan(wall.id);good(preview);
  assert.ok(Math.abs(preview.span.freeLengthM-5.84)<1e-8);
  assert.deepEqual(api.getState(),before);
  const result=api.fitPartitionToFreeSpace(wall.id);good(result);
  const after=api.getState();
  assert.ok(Math.abs(after.partitions[0].length-5.84)<1e-8);
  assert.equal(after.partitions[0].cx,0);
  assert.equal(after.partitions[0].autoSpan,false);
  assert.equal(api.getConstructionTakeoff().totalPartitionBothFacesAreaM2 > 20,true);
});

test('API V4.9.2: ajuste termina en la cara de otro tabique, sin atravesarlo',()=>{
  const {api}=fixture();
  good(api.addPartition({axis:'z',autoSpan:true,thickness:.1,height:2.3}));
  const branch=api.addPartition({axis:'x',length:1.1,cx:1,cz:0,thickness:.1,height:2.3});good(branch);
  const res=api.fitPartitionToFreeSpace(branch.id);good(res);
  assert.ok(Math.abs(res.partition.length-2.87)<1e-8);
  assert.ok(Math.abs(res.span.freeMin-.05)<1e-8);
  const s=api.getState();
  assert.equal(classifyPartitionJunction(s.partitions[0],s.partitions[1]).type,'T');
});

test('API V4.9.2: conserva posición global de la puerta cuando ajusta el tramo',()=>{
  const {api}=fixture();
  const wall=api.addPartition({axis:'x',length:2,cx:.5,height:2.3,thickness:.1});good(wall);
  const door=api.addInteriorDoor({partitionId:wall.id,u:.5,w:.7,h:2,catalogCode:'P80'});good(door);
  const original=api.getState();
  const absolute=original.partitions[0].cx-original.partitions[0].length/2+original.interiorDoors[0].u;
  const result=api.fitPartitionToFreeSpace(wall.id);good(result);
  const s=api.getState();
  const now=s.partitions[0].cx-s.partitions[0].length/2+s.interiorDoors[0].u;
  assert.ok(Math.abs(now-absolute)<1e-8);
  assert.ok(Math.abs(s.partitions[0].length-5.84)<1e-8);
  assert.deepEqual(JSON.parse(JSON.stringify(s.interiorDoors)).map(d=>d.catalogCode),['P80']);
});

test('API V4.9.2: ID inexistente y especificación inválida no alteran el estado',()=>{
  const {api}=fixture();
  const w=api.addPartition({axis:'x',length:1,cx:0,height:2.3,thickness:.1});good(w);
  const original=api.getState();
  assert.equal(api.fitPartitionToFreeSpace('no-such-wall').ok,false);
  assert.equal(api.getPartitionFreeSpan({axis:'x',cx:NaN,cz:0,thickness:.1}).ok,false);
  assert.deepEqual(api.getState(),original);
});

test('V4.9.3 API: alta sin largo aplica tramo libre en eje Z y conserva coordenada transversal', () => {
  const { api } = fixture();
  const r = api.addPartition({ axis:'z', cx:1, cz:.4, thickness:.1, height:2.3 });
  good(r);
  assert.equal(r.autoFitted, true);
  assert.ok(Math.abs(r.partition.length-2.24) < 1e-8);
  assert.equal(r.partition.cx,1);
  assert.ok(Math.abs(r.partition.cz) < 1e-8);
  assert.equal(r.partition.autoSpan,false);
});

test('V4.9.3 API: largo manual explícito mantiene V4.9.2, salvo autoFit explícito', () => {
  const { api } = fixture();
  const manual = api.addPartition({axis:'x',cx:.5,cz:0,thickness:.1,height:2.3,length:1.2});
  good(manual); assert.equal(manual.autoFitted,false);assert.equal(manual.partition.length,1.2);
  const other = api.addPartition({axis:'x',cx:1.9,cz:.5,thickness:.1,height:2.3,length:.5,autoFit:true});
  good(other);assert.equal(other.autoFitted,true);
  assert.ok(other.partition.length>2);
});

test('V4.9.3 API: clic a un lado de anfitrión crea unión T válida', () => {
  const { api } = fixture();
  good(api.addPartition({axis:'z',autoSpan:true,thickness:.1,height:2.3}));
  const branch = api.addPartition({axis:'x',cx:1,cz:0,autoFit:true,thickness:.1,height:2.3});
  good(branch);
  assert.ok(Math.abs(branch.partition.length-2.87) < 1e-8);
  assert.equal(api.getConstructionTakeoff().partitionTJunctionsCount,1);
});

test('V4.9.3 API: clic dentro de tabique existente rechaza sin alterar estado', () => {
  const { api } = fixture();
  good(api.addPartition({axis:'z',autoSpan:true,thickness:.1,height:2.3}));
  const before=api.getState();
  const result=api.addPartition({axis:'x',cx:0,cz:0,autoFit:true,thickness:.1,height:2.3});
  assert.equal(result.ok,false);
  assert.match(result.error,/ocupado/);
  assert.deepEqual(api.getState(),before);
});

test('V4.9.3 API: positivo y negativo respetan clic, no se centran por ambos lados', () => {
  const a=fixture(),b=fixture();
  const positive=a.api.addPartition({axis:'x',cx:1,cz:0,height:2.3,thickness:.1,autoFit:true,fitDirection:'positive'});
  const negative=b.api.addPartition({axis:'x',cx:1,cz:0,height:2.3,thickness:.1,autoFit:true,fitDirection:'negative'});
  good(positive);good(negative);
  assert.ok(Math.abs(positive.partition.length-1.92) < 1e-8);
  assert.ok(Math.abs(negative.partition.length-3.92) < 1e-8);
  assert.ok(Math.abs((positive.partition.cx-positive.partition.length/2)-1)<1e-8);
  assert.ok(Math.abs((negative.partition.cx+negative.partition.length/2)-1)<1e-8);
});

test('V4.9.3 API: modos incompatibles e invalidaciones no alteran estado', () => {
  const {api}=fixture();
  const before=api.getState();
  for (const args of [
    {axis:'z',autoSpan:true,autoFit:true},
    {axis:'x',autoFit:true,autoPlace:true},
    {axis:'x',autoFit:true,fitDirection:'up'},
    {axis:'x',cx:100,autoFit:true},
    {axis:'z',cz:0,autoFit:'yes'}
  ]) assert.equal(api.addPartition(args).ok,false,JSON.stringify(args));
  assert.deepEqual(api.getState(),before);
});

test('API V4.17.2: setFinish acepta revestimientos exteriores e interiores en capas diferentes', () => {
  const { api, state } = fixture();
  good(api.setFinish('P54', 'A'));
  assert.equal(state.finishes.walls.A, 'P54');
  good(api.setFinish('P35', 'A'));
  assert.equal(state.finishes.interiorWalls.A, 'P35');
  assert.equal(state.finishes.walls.A, 'P54', 'El cambio interior no borra la fachada');
  good(api.setWallLining('B', 'P52'));
  assert.equal(state.finishes.walls.B, 'P52');
  good(api.setWallLining('B', 'P30'));
  assert.equal(state.finishes.interiorWalls.B, 'P30');
  assert.equal(state.finishes.walls.B, 'P52');
  const wrong = api.setFinish('P70', 'B');
  assert.equal(wrong.ok, false, 'Una luminaria no debe aceptarse como acabado');
});

test('API V4.18: agregar 6 m² de madera vertical y medirlos sin duplicar revestimiento base',()=>{
  const {api}=fixture();
  good(api.setFinish('P52','A'));
  const added=api.addExteriorFinishZone({face:'A',code:'P59',areaM2:6,width:3,u:0,v:0,orientation:'vertical'});
  good(added);
  assert.equal(added.areaM2,6);
  assert.equal(added.zone.height,2);
  assert.equal(api.getState().finishes.exteriorZones[0].orientation,'vertical');
  const area=api.getConstructionTakeoff().walls.A;
  assert.equal(area.exteriorZonesAreaM2,6);
  assert.equal(area.exteriorByCodeM2.P59,6);
  assert.equal(area.exteriorByCodeM2.P52,6*2.5-6);
  const collides=api.addExteriorFinishZone({face:'A',code:'P54',areaM2:2,width:1,u:1,v:0});
  assert.equal(collides.ok,false);
  const vertical=api.updateExteriorFinishZone(added.id,{orientation:'horizontal'});
  good(vertical);
  assert.equal(api.getState().finishes.exteriorZones[0].orientation,'horizontal');
  const snapshot=api.getState();
  const copy=fixture();
  good(copy.api.setState(snapshot));
  assert.equal(copy.api.getState().finishes.exteriorZones[0].width,3);
  assert.equal(copy.api.getState().finishes.exteriorZones[0].orientation,'horizontal');
  good(api.removeExteriorFinishZone(added.id));
  assert.equal(api.getConstructionTakeoff().walls.A.exteriorZonesAreaM2,0);
});

test('API V4.18: evita vanos sobre paños exteriores y rechaza JSON inválido',()=>{
  const {api}=fixture();
  good(api.addExteriorFinishZone({face:'A',code:'P54',areaM2:6,width:3,u:0,v:0}));
  const opening=api.addOpening({type:'window',face:'A',w:1,h:1,u:1,v:.5});
  assert.equal(opening.ok,false);
  const initial=api.getState();
  const bad=structuredClone(initial);
  bad.finishes.exteriorZones[0].width=80;
  const imported=api.setState(bad);
  assert.equal(imported.ok,false);
  assert.deepEqual(api.getState(),initial);
});
