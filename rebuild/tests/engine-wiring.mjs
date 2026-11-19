import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const code = name => fs.readFileSync(path.join(root, name), 'utf8');
const engine = code('container-engine.js');
const ui = code('container-editor-ui.js');
const html = code('index.html');

test('IDs HTML presentes para controles requeridos por motor e interfaz', () => {
  const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]));
  const used = new Set([...(engine + ui).matchAll(/\$\('([^']+)'\)/g)].map(m => m[1]));
  assert.deepEqual([...used].filter(id => !ids.has(id)), []);
});

test('Esquineros, muros compartidos y materiales de GPU están integrados en rutas reales', () => {
  const section = engine.slice(engine.indexOf('function validateOpening('), engine.indexOf('/* ============ Puertas y ventanas'));
  assert.match(section, /validateOpeningCornerClearance\(/);
  assert.match(section, /validateOpeningAgainstSharedWalls\(/);
  assert.match(engine, /addSharedWall\(/);
  assert.match(engine, /removeSharedWall\(/);
  assert.match(engine, /sharedWalls: cleanSharedWalls/);
  assert.match(engine, /persistentTextures = \[paintTex, woodTex, hazardTex, scene\.environment\]/);
  assert.match(engine, /const ctx = createDisposalContext\(persistentTextures\)/);
  assert.match(ui, /api\.addSharedWall\(/);
  assert.match(ui, /\['Descuento muros compartidos:'/);
});


test('autoSpan enlazado desde UI, alta, edición, rotación, cambio de dimensiones e importación', () => {
  assert.match(engine, /resolvePartitionGeometry/);
  assert.match(engine, /projectedPartitions = state\.partitions\.map/);
  assert.match(engine, /addPartition\(/);
  assert.match(engine, /updatePartition\(/);
  assert.match(engine, /rotatePartition\(/);
  assert.match(engine, /autoSpan: p\.autoSpan === undefined \? false : p\.autoSpan/);
  assert.match(ui, /\$\('partition-fit'\)/);
  assert.match(ui, /\$\('add-parametric-partition'\)/);
  assert.match(ui, /totalPartitionBothFacesAreaM2/);
});


test('Giro mantiene medida manual, ofrece ajuste explícito y reporta errores de colisión', () => {
  assert.match(engine, /resolveRotatedPartition\(current, state, profileThicknessFor\(\)/);
  assert.match(engine, /rotatePartition\(id, \{ fitToWalls = false \} = \{\}\)/);
  assert.match(engine, /code: 'ROTATION_NEEDS_FIT'/);
  assert.match(engine, /code: 'ROTATION_BLOCKED'/);
  assert.match(engine, /const error = partitionSpecificationError\(candidate\) \|\| partitionError\(candidate\) \|\| partitionDoorError\(candidate\)/);
  assert.match(ui, /rotatePartition\(selected.id, \{ fitToWalls: true \}\)/);
  assert.match(ui, /\$\('btn-rotate-fit'\)/);
  assert.match(html, /id="rotation-help"/);
});

test('Proyectos JSON v3 aceptan respaldos previos v1 y v2', () => {
  assert.match(ui, /version: 3/);
  assert.match(ui, /\[1, 2, 3\]\.includes\(data.version\)/);
  assert.match(ui, /api\.setState\(data.state\)/);
});


test('Tabiques del catálogo también disponen de giro y centrado explícito', () => {
  assert.match(ui, /Girar y centrar ensamblaje/);
  assert.match(ui, /api\.updateObject\(selected.id, \{\s*rot:/);
  assert.match(ui, /x: 0, z: 0/);
  assert.match(ui, /item\?\.visual/);
});


test('Creación de tabique activa vista interior para hacer visible su orientación', () => {
  assert.match(ui, /if \(result.ok && !state.seeInside\)/);
  assert.match(ui, /api\.setSeeInside\(true\)/);
  assert.match(ui, /\$\('xray'\)\.checked = true/);
});


test('V4.4: se conectan materiales por cara, aislación y puertas entre UI y motor', () => {
  assert.match(html, /id="partition-finishes-box"/);
  for (const id of ['part-face-a', 'part-face-b', 'part-insulation',
    'part-insulation-code', 'part-door-code', 'btn-add-interior-door']) {
    assert.match(html, new RegExp(`id="${id}"`));
    assert.match(ui, new RegExp(`\\$\\('${id}'\\)`));
  }
  for (const name of ['addInteriorDoor', 'updateInteriorDoor', 'removeInteriorDoor']) {
    assert.match(engine, new RegExp(name + '\\('));
  }
  assert.match(engine, /const doors = state\.interiorDoors\.filter/);
  assert.match(engine, /leaf\.userData\.interiorDoorId = d\.id/);
  assert.match(engine, /const matA = materialFor\(p\.faceALining\)/);
  assert.match(engine, /const matB = materialFor\(p\.faceBLining\)/);
  assert.match(engine, /if \(p\.hasInsulation\)/);
  assert.match(engine, /interiorDoors: cleanInteriorDoors/);
  assert.match(ui, /api\.updateInteriorDoor\(selection\.id, params\)/);
  assert.match(ui, /api\.removeInteriorDoor\(selection\.id\)/);
  assert.match(ui, /interiorDoorsCount/);
});


test('La creación desde UI busca un vano libre y el alta manual conserva colisiones estrictas', () => {
  assert.match(ui, /autoSpan: true, autoPlace: true/);
  assert.match(engine, /function freePartitionCenters\(/);
  assert.match(engine, /if \(error && autoPlace\)/);
  assert.match(engine, /No hay un espacio libre adecuado/);
});

test('BAT V4.5: uniones ortogonales conectadas a motor y editor sin invadir elementos', () => {
  for (const id of ['partition-junction-box', 'part-junction-side', 'part-junction-end',
    'btn-junction-t', 'btn-junction-l']) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(engine, /classifyPartitionJunction/);
  assert.match(engine, /junctionBranchProposal/);
  assert.match(engine, /addPartitionJunction/);
  assert.match(ui, /api\.addPartitionJunction/);
  assert.match(ui, /partitionTJunctionsCount/);
  assert.match(ui, /partitionLJunctionsCount/);
});


test('BAT V4.6: vista previa de arrastre, imán y conexión T/L están conectadas a motor y UI', () => {
  const src = fs.readFileSync(path.join(root, 'container-engine.js'), 'utf8');
  const ui = fs.readFileSync(path.join(root, 'container-editor-ui.js'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(src, /previewPartitionMove\(/);
  assert.match(src, /movePartition\(/);
  assert.match(src, /partitionGroupId = p\.id/);
  assert.match(ui, /api\.previewPartitionMove\(/);
  assert.match(ui, /api\.movePartition\(/);
  assert.match(ui, /setPointerCapture/);
  assert.match(html, /id="partition-magnet"/);
});


test('Piso baño: conectores API, panel y JSON legado están presentes', () => {
  assert.match(engine, /setBathFloor\(\{ code, length, width \}/);
  assert.match(engine, /clearBathFloor\(\)/);
  assert.match(engine, /bathFloor: cleanBathFloor/);
  assert.match(engine, /validateBathFloor\(state\.bathFloor, nextRef/);
  const ui = fs.readFileSync(path.join(root, 'container-editor-ui.js'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  for (const name of ['bath-floor-code', 'bath-floor-length', 'bath-floor-width', 'bath-floor-apply', 'bath-floor-clear']) {
    assert.ok(html.includes('id="' + name + '"'));
    assert.ok(ui.includes("$('" + name + "')"));
  }
});
