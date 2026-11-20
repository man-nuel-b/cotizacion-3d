import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.mjs': 'application/javascript; charset=utf-8' };
const localThree = path.join(repo, 'rebuild/node_modules/three');

async function prepare() {
  const server = http.createServer((req, res) => {
    try {
      const decoded = decodeURIComponent(new URL(req.url, 'http://local/').pathname);
      const file = path.resolve(repo, '.' + decoded);
      if (!file.startsWith(repo + path.sep)) throw Error('outside repo');
      const data = fs.readFileSync(file);
      res.writeHead(200, { 'content-type': mime[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(data);
    } catch (err) { res.writeHead(404); res.end('Not found: ' + err.message); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--disable-dev-shm-usage', '--no-sandbox']
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(String(error?.stack || error)));
  page.on('console', message => { if (message.type() === 'error') errors.push('console: ' + message.text()); });
  await page.route('https://cdn.jsdelivr.net/npm/three@0.160.0/**', async route => {
    try {
      const key = route.request().url().split('/three@0.160.0/')[1].split('?')[0];
      const file = path.resolve(localThree, key);
      if (!file.startsWith(localThree + path.sep)) throw Error('file path');
      const body = fs.readFileSync(file);
      await route.fulfill({ status: 200, contentType: 'application/javascript', body });
    } catch (err) { errors.push('Three CDN mapping: ' + err.message); await route.abort(); }
  });
  await page.goto('http://127.0.0.1:' + server.address().port + '/rebuild/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.Container3D) && document.querySelectorAll('.catalog-item').length >= 60,
    null, { timeout: 45000 });
  return { server, browser, page, errors };
}

async function close({ server, browser }) {
  if (browser) await browser.close();
  if (server) await new Promise(resolve => server.close(resolve));
}

test('BAT V2: catálogo 60 partidas, selección de objetos, edición y exportación', { timeout: 180000 }, async () => {
  let fixture;
  try {
    fixture = await prepare(); const { page, errors } = fixture;
    assert.equal(await page.locator('.catalog-item').count(), 60);
    assert.equal(await page.locator('#catalog-family option').count(), 9);
    await page.locator('#catalog-search').fill('inodoro');
    assert.equal(await page.locator('.catalog-item').count(), 1);
    await page.locator('#catalog-search').fill('');

    await page.locator('.catalog-item[data-code="P60"]').click();
    assert.match(await page.locator('#scene-hint').innerText(), /P60/);
    await page.locator('#view canvas').click({ position: { x: 720, y: 450 } });
    await page.waitForFunction(() => window.Container3D.getState().objects.length === 1, { timeout: 10000 });
    let state = await page.evaluate(() => window.Container3D.getState());
    assert.equal(state.objects[0].code, 'P60');
    assert.equal(await page.locator('#props-form').isVisible(), true);
    assert.equal(await page.locator('#prop-x').count(), 1, 'X input must survive label update');
    await page.locator('#prop-x').fill('0');
    await page.locator('#prop-z').fill('0');
    await page.locator('#prop-w').fill('0.45');
    await page.locator('#prop-rot').fill('15');
    await page.locator('#prop-apply').click();
    state = await page.evaluate(() => window.Container3D.getState());
    assert.equal(state.objects[0].w, .45);
    assert.equal(state.objects[0].rot, 15);

    await page.locator('#catalog-search').fill('P01');
    await page.locator('.catalog-item[data-code="P01"]').click();
    await page.locator('#view canvas').click({ position: { x: 720, y: 450 } });
    state = await page.evaluate(() => window.Container3D.getState());
    assert.equal(state.finishes.floor, 'P01');
    assert.equal(state.objects.length, 1);
    assert.equal(await page.locator('#scene-hint').innerText().then(x => x.includes('aplicado')), true);

    await page.locator('#catalog-search').fill('P83');
    await page.locator('.catalog-item[data-code="P83"]').click();
    await page.locator('#view canvas').click({ position: { x: 690, y: 470 } });
    state = await page.evaluate(() => window.Container3D.getState());
    assert.equal(state.openings.length, 1, 'Window is placed via surface click');
    assert.equal(state.openings[0].catalogCode, 'P83');
    assert.equal(state.openings[0].type, 'window');

    const rendered = await page.evaluate(() => {
      const group = window.Container3D.getEntityMeshes()[0];
      let meshes = 0; group?.traverse(x => { if (x.isMesh) meshes++; });
      return meshes;
    });
    assert.ok(rendered >= 6, 'El WC debe existir como un modelo 3D compuesto por varias mallas');
    assert.deepEqual(errors, [], errors.join('\n'));
  } finally { if (fixture) await close(fixture); }
});

test('BAT V2: selector HTML aplica revestimientos y trasdosados sin raycast', { timeout: 180000 }, async () => {
  let fixture;
  try {
    fixture = await prepare();
    const { page, errors } = fixture;
    await page.locator('.catalog-item[data-code="P34"]').click();
    await page.locator('#wall-finish-face').selectOption('B');
    await page.locator('#apply-wall-finish').click();
    let state = await page.evaluate(() => window.Container3D.getState());
    assert.equal(state.finishes.walls.B, 'P34', 'La cara B debe recibir el revestimiento');
    assert.equal(state.finishes.walls.A, null);

    await page.locator('.catalog-item[data-code="P17"]').click();
    assert.equal(await page.locator('#wall-finish-controls').isVisible(), true);
    assert.match(await page.locator('#apply-wall-finish').innerText(), /trasdosado/i);
    await page.locator('#wall-finish-face').selectOption('C');
    await page.locator('#apply-wall-finish').click();
    state = await page.evaluate(() => window.Container3D.getState());
    assert.equal(state.objects.filter(o => o.code === 'P17').length, 1);
    assert.equal(state.finishes.walls.C, null, 'P17 no debe registrarse como una pintura de muro');
    assert.ok(state.objects.some(o => o.code === 'P17' && o.z < 0), 'P17 debe adosarse a la cara C');
    assert.deepEqual(errors, [], errors.join('\n'));
  } finally { if (fixture) await close(fixture); }
});

test('BAT V2 reforzado: esquineros, zona compartida, cubicación por cara y JSON compatible', { timeout: 180000 }, async () => {
  let fixture;
  try {
    fixture = await prepare();
    const { page, errors } = fixture;
    const nearCorner = await page.evaluate(() => window.Container3D.addOpening({
      type: 'window', face: 'A', w: 1.2, h: 1, u: 0.05, v: 0.9, bars: false
    }));
    assert.equal(nearCorner.ok, false);
    assert.match(nearCorner.error, /esquinero/);
    const valid = await page.evaluate(() => window.Container3D.addOpening({
      type: 'window', face: 'A', w: 1.2, h: 1, u: 1.0, v: 0.9, bars: false
    }));
    assert.equal(valid.ok, true);
    await page.locator('#shared-wall-config summary').click();
    await page.locator('#shared-face').selectOption('A');
    await page.locator('#shared-u').fill('3');
    await page.locator('#shared-v').fill('0');
    await page.locator('#shared-w').fill('1.6');
    await page.locator('#shared-h').fill('2.3');
    await page.locator('#shared-add').click();
    const state = await page.evaluate(() => window.Container3D.getState());
    assert.equal(state.sharedWalls.length, 1);
    const t = await page.evaluate(() => window.Container3D.getConstructionTakeoff());
    assert.ok(Math.abs(t.walls.A.sharedDeductionM2 - 3.68) < 1e-8);
    assert.ok(Math.abs(t.totalNetWallAreaM2 -
      Object.values(t.walls).reduce((sum, x) => sum + x.netAreaM2, 0)) < 1e-8);
    assert.match(await page.locator('#takeoff-summary').innerText(), /3.68/);
    const conflicts = await page.evaluate(() => ({
      opening: window.Container3D.addOpening({
        type: 'door', face: 'A', u: 3.4, v: 0, w: 0.8, h: 2, bars: false
      }),
      region: window.Container3D.addSharedWall({ face: 'A', u: 3.5, v: 0, w: 1, h: 2.3 })
    }));
    assert.equal(conflicts.opening.ok, false);
    assert.equal(conflicts.region.ok, false);
    const save = await page.evaluate(() => window.Container3D.getState());
    assert.equal((await page.evaluate(s => window.Container3D.setState(s), save)).ok, true);
    const restored = await page.evaluate(() => window.Container3D.getState());
    assert.deepEqual(restored, save);
    const importedLegacy = structuredClone(save);
    delete importedLegacy.sharedWalls;
    assert.equal((await page.evaluate(s => window.Container3D.setState(s), importedLegacy)).ok, true);
    assert.equal((await page.evaluate(() => window.Container3D.getState())).sharedWalls.length, 0);
    assert.deepEqual(errors, [], errors.join('\n'));
  } finally { if (fixture) await close(fixture); }
});

test('BAT V2 reforzado: reconstrucciones no acumulan geometrías ni texturas', { timeout: 180000 }, async () => {
  let fixture;
  try {
    fixture = await prepare();
    const { page, errors } = fixture;
    const initial = await page.evaluate(() => window.Container3D.getRenderStats());
    for (let i = 0; i < 10; i++) {
      const r = await page.evaluate(i => window.Container3D.setFinish(i % 2 ? 'P34' : 'P30', 'A'), i);
      assert.equal(r.ok, true);
    }
    await page.waitForTimeout(500);
    const final = await page.evaluate(() => window.Container3D.getRenderStats());
    // Refleja el conteo aproximado de recursos Three.js, no el consumo GPU exacto.
    assert.ok(final.geometries < initial.geometries + 100, JSON.stringify({ initial, final }));
    assert.ok(final.textures < initial.textures + 30, JSON.stringify({ initial, final }));
    assert.deepEqual(errors, [], errors.join('\n'));
  } finally { if (fixture) await close(fixture); }
});

test('BAT V4.2: autoSpan alternable, giro, redimensionamiento, cubicación y JSON retrocompatible', { timeout: 180000 }, async () => {
  let fixture;
  try {
    fixture = await prepare();
    const { page, errors } = fixture;
    const original = await page.evaluate(() => window.Container3D.addPartition({
      axis: 'z', length: 1.4, height: 2.3, thickness: .1, cx: 0, cz: .1
    }));
    assert.equal(original.ok, true);
    let state = await page.evaluate(() => window.Container3D.getState());
    assert.equal(state.partitions[0].autoSpan, false);
    assert.equal(state.partitions[0].length, 1.4);
    assert.equal(state.partitions[0].cz, .1);

    assert.equal(await page.locator('#partition-fit-label').isVisible(), true);
    await page.locator('#partition-fit').check();
    state = await page.evaluate(() => window.Container3D.getState());
    let margin = await page.evaluate(() => window.Container3D.getInteriorClearance());
    assert.equal(state.partitions[0].autoSpan, true);
    assert.ok(Math.abs(state.partitions[0].length - (state.W - 2 * margin)) < 1e-8);
    assert.equal(state.partitions[0].cz, 0);
    assert.equal(await page.locator('#prop-w').getAttribute('readonly'), '');

    await page.locator('#btn-rotate-partition').click();
    state = await page.evaluate(() => window.Container3D.getState());
    assert.equal(state.partitions[0].axis, 'x');
    assert.ok(Math.abs(state.partitions[0].length - (state.L - 2 * margin)) < 1e-8);
    assert.equal(state.partitions[0].cx, 0);

    const resized = await page.evaluate(() => window.Container3D.setDimensions(7, 2.6, 2.5));
    assert.equal(resized.ok, true);
    state = await page.evaluate(() => window.Container3D.getState());
    margin = await page.evaluate(() => window.Container3D.getInteriorClearance());
    assert.ok(Math.abs(state.partitions[0].length - (7 - 2 * margin)) < 1e-8);
    const area = await page.evaluate(() => window.Container3D.getConstructionTakeoff());
    assert.ok(Math.abs(area.totalPartitionBothFacesAreaM2 - 2 * state.partitions[0].length * 2.3) < 1e-8);
    assert.match(await page.locator('#takeoff-summary').innerText(), /Tabiques interiores/);

    const json = structuredClone(state);
    assert.equal((await page.evaluate(s => window.Container3D.setState(s), json)).ok, true);
    assert.deepEqual(await page.evaluate(() => window.Container3D.getState()), json);

    const legacy = structuredClone(state);
    delete legacy.partitions[0].autoSpan;
    assert.equal((await page.evaluate(s => window.Container3D.setState(s), legacy)).ok, true);
    const restored = await page.evaluate(() => window.Container3D.getState());
    assert.equal(restored.partitions[0].autoSpan, false);
    assert.equal(restored.partitions[0].length, json.partitions[0].length);

    assert.deepEqual(errors, [], errors.join('\n'));
  } finally { if (fixture) await close(fixture); }
});


test('BAT V4.3: giro manual conservador, botón de ajuste expreso y JSON v2 importable', { timeout: 180000 }, async () => {
  let fixture;
  try {
    fixture = await prepare();
    const { page, errors } = fixture;
    let added = await page.evaluate(() => window.Container3D.addPartition({
      axis: 'x', length: 4.2, height: 2.2, thickness: .1, cx: 0, cz: 0, autoSpan: false
    }));
    assert.equal(added.ok, true);
    assert.equal(await page.locator('#btn-rotate-fit').isVisible(), true);
    await page.locator('#btn-rotate-partition').click();
    let state = await page.evaluate(() => window.Container3D.getState());
    assert.equal(state.partitions[0].axis, 'x', 'El giro inválido no cambia el estado');
    assert.equal(state.partitions[0].length, 4.2);
    assert.match(await page.locator('#scene-hint').innerText(), /no cabe/i);
    await page.locator('#btn-rotate-fit').click();
    state = await page.evaluate(() => window.Container3D.getState());
    assert.equal(state.partitions[0].axis, 'z');
    assert.equal(state.partitions[0].autoSpan, true);
    assert.ok(state.partitions[0].length < 2.35);
    assert.match(await page.locator('#scene-hint').innerText(), /ajustado/i);
    assert.equal(await page.locator('#btn-rotate-fit').isVisible(), false);

    const saved = { schema: 'BAT-CUBIKEITOR-V2', version: 2, state };
    page.once('dialog', dialog => dialog.accept());
    await page.locator('#import-project-file').setInputFiles({
      name: 'respaldo-v2.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(saved))
    });
    await page.waitForFunction(() => document.querySelector('#scene-hint').textContent.includes('importado'));
    assert.deepEqual(await page.evaluate(() => window.Container3D.getState()), state);
    assert.deepEqual(errors, [], errors.join('\n'));
  } finally { if (fixture) await close(fixture); }
});


test('BAT V4.3: ensamblaje P12 se gira y centra sin atravesar muros', { timeout: 180000 }, async () => {
  let fixture;
  try {
    fixture = await prepare();
    const { page, errors } = fixture;
    const added = await page.evaluate(() => window.Container3D.addObject('P12', 0, .8));
    assert.equal(added.ok, true);
    assert.equal(await page.locator('#btn-rotate-fit').isVisible(), true);
    assert.match(await page.locator('#btn-rotate-fit').innerText(), /centrar/i);
    await page.locator('#btn-rotate-partition').click();
    let state = await page.evaluate(() => window.Container3D.getState());
    assert.equal(state.objects[0].rot, 0, 'El motor no debe aceptar un giro fuera de los límites');
    await page.locator('#btn-rotate-fit').click();
    state = await page.evaluate(() => window.Container3D.getState());
    assert.equal(state.objects[0].rot, 90);
    assert.equal(state.objects[0].x, 0);
    assert.equal(state.objects[0].z, 0);
    assert.deepEqual(errors, [], errors.join('\n'));
  } finally { if (fixture) await close(fixture); }
});


test('BAT V4.3: botón de tabique paramétrico muestra el interior y el botón de giro', { timeout: 180000 }, async () => {
  let fixture;
  try {
    fixture = await prepare();
    const { page, errors } = fixture;
    await page.locator('#add-parametric-partition').click();
    const state = await page.evaluate(() => window.Container3D.getState());
    assert.equal(state.partitions.length, 1);
    assert.equal(state.seeInside, true);
    assert.equal(await page.locator('#xray').isChecked(), true);
    assert.equal(await page.locator('#btn-rotate-partition').isVisible(), true);
    assert.deepEqual(errors, [], errors.join('\n'));
  } finally { if (fixture) await close(fixture); }
});

test('BAT V4.4: editor aplica revestimientos A/B y aislación por tabique y descuenta puerta', { timeout: 180000 }, async () => {
  let fixture;
  try {
    fixture = await prepare();
    const { page, errors } = fixture;
    await page.locator('#add-parametric-partition').click();
    assert.equal(await page.locator('#partition-finishes-box').isVisible(), true);
    await page.locator('#part-face-a').selectOption('P30');
    await page.locator('#part-face-b').selectOption('P34');
    await page.locator('#part-insulation').check();
    await page.locator('#part-insulation-code').selectOption('P21');
    let state = await page.evaluate(() => window.Container3D.getState());
    assert.equal(state.partitions[0].faceALining, 'P30');
    assert.equal(state.partitions[0].faceBLining, 'P34');
    assert.equal(state.partitions[0].hasInsulation, true);
    assert.equal(state.partitions[0].insulationCode, 'P21');

    await page.locator('#btn-add-interior-door').click();
    state = await page.evaluate(() => window.Container3D.getState());
    assert.equal(state.interiorDoors.length, 1);
    assert.equal(state.interiorDoors[0].catalogCode, 'P81');
    assert.equal(await page.locator('#properties-title').innerText(), 'Puerta del tabique');
    assert.equal(await page.locator('#partition-finishes-box').isVisible(), false);
    const before = await page.evaluate(() => window.Container3D.getConstructionTakeoff());
    assert.equal(before.interiorDoorsCount, 1);
    assert.equal(before.partitions[0].doorsCount, 1);
    assert.ok(before.totalPartitionLiningAreaM2 > 0);
    assert.ok(before.totalPartitionInsulationAreaM2 > 0);
    assert.ok(before.totalPartitionLiningAreaM2 < 2 * state.partitions[0].length * state.partitions[0].height);
    await page.locator('#prop-w').fill('0.65');
    await page.locator('#prop-apply').click();
    const after = await page.evaluate(() => window.Container3D.getConstructionTakeoff());
    assert.ok(after.totalPartitionLiningAreaM2 > before.totalPartitionLiningAreaM2);
    assert.ok(after.totalPartitionInsulationAreaM2 > before.totalPartitionInsulationAreaM2);
    assert.match(await page.locator('#takeoff-summary').innerText(), /Placas en tabiques/);
    assert.deepEqual(errors, [], errors.join('\n'));
  } finally { if (fixture) await close(fixture); }
});

test('BAT V4.4: las puertas persisten en JSON v3 y se eliminan con su tabique', { timeout: 180000 }, async () => {
  let fixture;
  try {
    fixture = await prepare();
    const { page, errors } = fixture;
    const added = await page.evaluate(() => window.Container3D.addPartition({
      axis: 'x', length: 3, height: 2.3, thickness: 0.1,
      faceALining: 'P30', faceBLining: null, hasInsulation: true, insulationCode: 'P20'
    }));
    assert.equal(added.ok, true);
    const created = await page.evaluate(id => window.Container3D.addInteriorDoor({ partitionId: id }), added.id);
    assert.equal(created.ok, true);
    const backup = await page.evaluate(() => window.Container3D.getState());
    await page.evaluate(() => window.Container3D.removePartition(window.Container3D.getState().partitions[0].id));
    assert.equal(await page.evaluate(() => window.Container3D.getState().interiorDoors.length), 0);
    const project = { schema: 'BAT-CUBIKEITOR-V2', version: 3, state: backup };
    page.once('dialog', dialog => dialog.accept());
    await page.locator('#import-project-file').setInputFiles({
      name: 'respaldo-v3.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(project))
    });
    await page.waitForFunction(() => document.querySelector('#scene-hint').textContent.includes('importado'));
    assert.deepEqual(await page.evaluate(() => window.Container3D.getState()), backup);
    assert.deepEqual(errors, [], errors.join('\n'));
  } finally { if (fixture) await close(fixture); }
});


test('BAT V4.4.1: catálogo se desarma tras un solo objeto o ensamble', { timeout: 180000 }, async () => {
  let fixture;
  try {
    fixture = await prepare();
    const { page, errors } = fixture;
    const canvas = page.locator('#view canvas');

    await page.locator('.catalog-item[data-code="P60"]').click();
    assert.match(await page.locator('.catalog-item[data-code="P60"]').getAttribute('class'), /active/);
    await canvas.click({ position: { x: 720, y: 450 } });
    await page.waitForFunction(() => window.Container3D.getState().objects.length === 1);
    assert.doesNotMatch(await page.locator('.catalog-item[data-code="P60"]').getAttribute('class'), /active/, 'Catálogo debe quedar desarmado');
    await canvas.click({ position: { x: 720, y: 450 } });
    assert.equal((await page.evaluate(() => window.Container3D.getState())).objects.length, 1, 'El segundo clic no debe duplicar P60');

    await page.evaluate(() => {
      const id = window.Container3D.getState().objects[0].id;
      window.Container3D.removeObject(id);
    });
    await page.locator('.catalog-item[data-code="P12"]').click();
    await canvas.click({ position: { x: 720, y: 450 } });
    await page.waitForFunction(() => window.Container3D.getState().objects.some(o => o.code === 'P12'));
    assert.doesNotMatch(await page.locator('.catalog-item[data-code="P12"]').getAttribute('class'), /active/);
    await canvas.click({ position: { x: 720, y: 450 } });
    const added = await page.evaluate(() => window.Container3D.getState().objects.filter(o => o.code === 'P12').length);
    assert.equal(added, 1, 'El segundo clic no debe duplicar el ensamble P12');
    assert.deepEqual(errors, [], errors.join('\n'));
  } finally { if (fixture) await close(fixture); }
});

// Regresión visual/geométrica: la cubierta no debe aparecer desplazada al costado.
test('BAT V4.4.2: cubierta centrada y oculta al entrar, para los tres tipos de contenedor', { timeout: 180000 }, async () => {
  let fixture;
  try {
    fixture = await prepare();
    const { page, errors } = fixture;
    for (const kind of ['maritimo', 'reefer', 'modular']) {
      const metrics = await page.evaluate(kind => {
        window.Container3D.setType(kind);
        return { state: window.Container3D.getState(), roof: window.Container3D.getRoofBounds() };
      }, kind);
      const { state, roof } = metrics;
      assert.ok(roof && roof.visible, `Cubierta visible al iniciar ${kind}`);
      const epsilon = 0.015;
      assert.ok(Math.abs((roof.minZ + roof.maxZ) / 2) < epsilon, `${kind}: cubierta centrada en Z`);
      assert.ok(Math.abs((roof.minX + roof.maxX) / 2) < epsilon, `${kind}: cubierta centrada en X`);
      assert.ok(roof.minZ >= -state.W / 2 - epsilon && roof.maxZ <= state.W / 2 + epsilon,
        `${kind}: cubierta contenida entre las caras laterales`);
      assert.ok(roof.minX >= -state.L / 2 - epsilon && roof.maxX <= state.L / 2 + epsilon,
        `${kind}: cubierta contenida entre los extremos`);

      await page.evaluate(() => window.Container3D.setSeeInside(true));
      assert.equal(await page.evaluate(() => window.Container3D.getRoofBounds().visible), false,
        `${kind}: la cubierta se oculta en modo interior`);
      await page.evaluate(() => window.Container3D.setSeeInside(false));
      assert.equal(await page.evaluate(() => window.Container3D.getRoofBounds().visible), true,
        `${kind}: la cubierta reaparece al salir del modo interior`);
    }
    assert.deepEqual(errors, [], errors.join('\n'));
  } finally { if (fixture) await close(fixture); }
});


test('UI: crear tres tabiques consecutivos los reparte en bahías libres sin superposición', { timeout: 180000 }, async () => {
  let fixture;
  try {
    fixture = await prepare();
    const { page, errors } = fixture;
    const btn = page.locator('#add-parametric-partition');
    for (let count = 1; count <= 3; count++) {
      await btn.click();
      await page.waitForFunction(expected => window.Container3D.getState().partitions.length === expected,
        count, { timeout: 25000 });
    }
    const state = await page.evaluate(() => window.Container3D.getState());
    assert.equal(state.partitions.length, 3);
    assert.equal(state.partitions[0].cx, 0);
    assert.ok(Math.abs(state.partitions[1].cx - state.partitions[0].cx) >= 0.65);
    assert.ok(Math.abs(state.partitions[2].cx - state.partitions[1].cx) >= 0.65);
    assert.equal(state.partitions.every(p => p.axis === 'z' && p.autoSpan === true), true);
    assert.match(await page.locator('#scene-hint').innerText(), /espacio libre/i);
    assert.deepEqual(errors, [], errors.join('\n'));
  } finally { if (fixture) await close(fixture); }
});

test('BAT V4.5: botones T/L crean ramas ortogonales y actualizan cubicación', { timeout: 180000 }, async () => {
  let fixture;
  try {
    fixture = await prepare();
    const { page, errors } = fixture;
    await page.locator('#add-parametric-partition').click();
    await page.waitForFunction(() => window.Container3D.getState().partitions.length === 1);
    assert.equal(await page.locator('#partition-junction-box').isVisible(), true);
    await page.locator('#part-junction-side').selectOption('1');
    await page.locator('#btn-junction-t').click();
    let result = await page.evaluate(() => ({
      state: window.Container3D.getState(), takeoff: window.Container3D.getConstructionTakeoff()
    }));
    assert.equal(result.state.partitions.length, 2);
    assert.equal(result.takeoff.partitionTJunctionsCount, 1);
    assert.equal(result.state.partitions[1].axis, 'x');
    assert.match(await page.locator('#scene-hint').innerText(), /Unión T creada/);

    // Seleccionar anfitrión otra vez, pues la API selecciona la nueva rama.
    const hostId = result.state.partitions[0].id;
    await page.evaluate(id => window.Container3D.selectEntity('partition', id), hostId);
    await page.locator('#part-junction-side').selectOption('-1');
    await page.locator('#btn-junction-t').click();
    result = await page.evaluate(() => ({
      state: window.Container3D.getState(), takeoff: window.Container3D.getConstructionTakeoff()
    }));
    assert.equal(result.state.partitions.length, 3);
    assert.equal(result.takeoff.partitionTJunctionsCount, 2);

    // Una L requiere una división parcial, no el modo autoSpan.
    const l = await page.evaluate(() => {
      window.Container3D.setType('modular');
      return window.Container3D.addPartition({ axis: 'z', length: 1.5,
        height: 2.3, thickness: .1, cx: -.8, cz: -.2, autoSpan: false });
    });
    assert.equal(l.ok, true, l.error);
    await page.locator('#part-junction-side').selectOption('1');
    await page.locator('#part-junction-end').selectOption('1');
    await page.locator('#btn-junction-l').click();
    result = await page.evaluate(() => ({
      state: window.Container3D.getState(), takeoff: window.Container3D.getConstructionTakeoff()
    }));
    assert.equal(result.takeoff.partitionLJunctionsCount, 1);
    assert.equal(result.state.partitions.length, 2);
    assert.deepEqual(errors, [], errors.join('\n'));
  } finally { if (fixture) await close(fixture); }
});


test('BAT V4.6: arrastrar tabique con mouse modifica el modelo y respeta autoSpan', { timeout: 180000 }, async () => {
  let fixture;
  try {
    fixture = await prepare();
    const { page, errors } = fixture;
    const created = await page.evaluate(() => {
      const api = window.Container3D;
      api.setType('modular');
      api.setSeeInside(true);
      const result = api.addPartition({ axis: 'z', length: 2.24, height: 2.3,
        thickness: .1, autoSpan: true });
      const p = api.getState().partitions[0];
      return { result, point: api.getScreenPoint(p.cx, .14 + p.height * .55, p.cz) };
    });
    assert.equal(created.result.ok, true, created.result.error);
    assert.equal(created.point.visible, true);
    const start = created.point;
    const before = await page.evaluate(() => window.Container3D.getState().partitions[0]);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + 85, start.y, { steps: 10 });
    await page.mouse.up();
    const after = await page.evaluate(() => window.Container3D.getState().partitions[0]);
    assert.notEqual(after.cx, before.cx, 'Arrastrar el tabique debe desplazarlo en X');
    assert.equal(after.cz, 0, 'autoSpan eje Z bloquea el desplazamiento longitudinal');
    assert.equal(after.length, before.length);
    assert.equal(await page.locator('#partition-magnet').isChecked(), true);
    assert.deepEqual(errors, [], errors.join('\n'));
  } finally { if (fixture) await close(fixture); }
});

test('BAT V4.6: imán une una rama al tabique anfitrión sin atravesarlo', { timeout: 180000 }, async () => {
  let fixture;
  try {
    fixture = await prepare();
    const { page, errors } = fixture;
    const results = await page.evaluate(() => {
      const api = window.Container3D;
      api.setType('modular');
      const host = api.addPartition({ axis: 'z', height: 2.3, thickness: .1, autoSpan: true });
      const branch = api.addPartition({ axis: 'x', height: 2.3, thickness: .1,
        length: 1.2, cx: .75, cz: 0, autoSpan: false });
      if (!host.ok || !branch.ok) return { host, branch };
      const preview = api.previewPartitionMove(branch.id, { cx: .75, cz: 0, snap: true });
      const moved = api.movePartition(branch.id, { cx: .75, cz: 0, snap: true });
      return { host, branch, preview, moved, state: api.getState(), t: api.getConstructionTakeoff() };
    });
    assert.equal(results.host.ok, true, results.host.error);
    assert.equal(results.branch.ok, true, results.branch.error);
    assert.equal(results.preview.ok, true, results.preview.error);
    assert.match(results.preview.snappedTo, /Unión con/);
    assert.equal(results.moved.ok, true, results.moved.error);
    assert.equal(results.t.partitionTJunctionsCount, 1);
    assert.deepEqual(errors, [], errors.join('\n'));
  } finally { if (fixture) await close(fixture); }
});


test('UI: piso de baño, área restante, rechazo de dimensiones y borrado', { timeout: 180000 }, async () => {
  let fixture;
  try {
    fixture = await prepare();
    const { page, errors } = fixture;
    await page.locator('#bath-floor-config summary').click();
    await page.locator('#bath-floor-code').selectOption('P05');
    await page.locator('#bath-floor-length').fill('2');
    await page.locator('#bath-floor-width').fill('1.2');
    await page.locator('#bath-floor-apply').click();
    let actual = await page.evaluate(() => ({
      state: window.Container3D.getState(), area: window.Container3D.getConstructionTakeoff()
    }));
    assert.equal(actual.state.bathFloor.code, 'P05');
    assert.ok(Math.abs(actual.area.bathFloorAreaM2 - 2.4) < 1e-8);
    assert.ok(Math.abs(actual.area.floorAreaM2 - actual.area.remainingFloorAreaM2 - 2.4) < 1e-8);
    assert.match(await page.locator('#takeoff-summary').innerText(), /Piso general restante/);
    await page.locator('#bath-floor-length').fill('100');
    await page.locator('#bath-floor-apply').click();
    assert.match(await page.locator('#bath-floor-message').innerText(), /exceden/);
    assert.equal((await page.evaluate(() => window.Container3D.getState())).bathFloor.length, 2);
    await page.locator('#bath-floor-clear').click();
    actual = await page.evaluate(() => ({ state: window.Container3D.getState(), area: window.Container3D.getConstructionTakeoff() }));
    assert.equal(actual.state.bathFloor, null);
    assert.equal(actual.area.remainingFloorAreaM2, actual.area.floorAreaM2);
    assert.deepEqual(errors, [], errors.join('\n'));
  } finally { if (fixture) await close(fixture); }
});

test('V4.8: clic sobre recinto rectangular aplica P06 visible en el piso 3D, sin doble cubicación', { timeout: 180000 }, async () => {
  let fixture;
  try {
    fixture = await prepare();
    const {page,errors} = fixture;
    const made = await page.evaluate(() => window.Container3D.addPartition({
      axis:'z',cx:2,cz:0,height:2.3,thickness:.1,autoSpan:true
    }));
    assert.equal(made.ok,true,made.error);
    await page.locator('#bath-floor-config summary').click();
    await page.locator('#bath-floor-code').selectOption('P06');
    await page.locator('#bath-floor-select-room').click();
    assert.match(await page.locator('#scene-hint').innerText(),/clic dentro del baño/i);
    const screen = await page.evaluate(() => window.Container3D.getScreenPoint(0,.148,0));
    assert.equal(screen.visible,true);
    await page.mouse.click(screen.x,screen.y);
    await page.waitForFunction(() => window.Container3D.getState().bathFloor?.cx !== undefined);
    let actual = await page.evaluate(() => ({
      state:window.Container3D.getState(),bounds:window.Container3D.getBathFloorBounds(),
      quantities:window.Container3D.getConstructionTakeoff()
    }));
    assert.equal(actual.state.bathFloor.code,'P06');
    assert.ok(actual.bounds && actual.bounds.maxY > .14);
    assert.equal(actual.bounds.code,'P06');
    assert.ok(Math.abs((actual.bounds.maxX-actual.bounds.minX)-actual.state.bathFloor.length)<1e-6);
    assert.ok(Math.abs((actual.bounds.maxZ-actual.bounds.minZ)-actual.state.bathFloor.width)<1e-6);
    assert.ok(Math.abs(actual.quantities.bathFloorAreaM2+actual.quantities.remainingFloorAreaM2-
      actual.quantities.floorAreaM2)<1e-8);
    // A new general finish must not erase the localized bath tiles.
    const general = await page.evaluate(() => window.Container3D.setFinish('P01'));
    assert.equal(general.ok,true,general.error);
    actual = await page.evaluate(() => ({
      state:window.Container3D.getState(),bounds:window.Container3D.getBathFloorBounds()
    }));
    assert.equal(actual.state.finishes.floor,'P01');
    assert.equal(actual.bounds.code,'P06');
    await page.locator('#bath-floor-clear').click();
    assert.equal(await page.evaluate(() => window.Container3D.getBathFloorBounds()),null);
    assert.equal(await page.evaluate(() => window.Container3D.getState().bathFloor),null);
    assert.deepEqual(errors,[],errors.join('\n'));
  } finally { if (fixture) await close(fixture); }
});

test('V4.8: reserva anterior sin posición se puede importar y colocar manualmente mediante clic', { timeout: 180000 }, async () => {
  let fixture;
  try {
    fixture=await prepare();const {page,errors}=fixture;
    const legacy=await page.evaluate(() => window.Container3D.setBathFloor({code:'P05',length:1.5,width:1.1}));
    assert.equal(legacy.ok,true,legacy.error);
    assert.equal(await page.evaluate(() => window.Container3D.getBathFloorBounds()),null);
    await page.locator('#bath-floor-config summary').click();
    await page.locator('#bath-floor-length').fill('1.5');
    await page.locator('#bath-floor-width').fill('1.1');
    await page.locator('#bath-floor-place-rect').click();
    const screen=await page.evaluate(() => window.Container3D.getScreenPoint(0,.148,0));
    await page.mouse.click(screen.x,screen.y);
    await page.waitForFunction(()=>window.Container3D.getState().bathFloor?.cx!==undefined);
    const actual=await page.evaluate(() => ({
      b:window.Container3D.getBathFloorBounds(),state:window.Container3D.getState()
    }));
    assert.ok(actual.b);
    assert.equal(actual.b.code,'P05');
    assert.ok(Math.abs(actual.state.bathFloor.length-1.5)<1e-8);
    assert.ok(Math.abs(actual.state.bathFloor.width-1.1)<1e-8);
    assert.deepEqual(errors,[],errors.join('\n'));
  } finally { if (fixture) await close(fixture); }
});


test('V4.9 piso longitudinal/transversal rota la textura real sin cambiar áreas ni romper JSON', { timeout: 180000 }, async () => {
  let f;
  try {
    f = await prepare();
    const { page, errors } = f;
    assert.equal(await page.locator('#floor-direction').inputValue(), 'length');
    await page.locator('.catalog-item[data-code="P01"]').click();
    // El catálogo aplica la terminación al pulsar el suelo, nunca coloca un objeto nuevo.
    await page.locator('#view canvas').click({ position: { x: 720, y: 450 } });
    await page.waitForFunction(() => window.Container3D.getState().finishes.floor === 'P01');
    const initial = await page.evaluate(() => ({
      state: window.Container3D.getState(),
      floor: window.Container3D.getFloorSurfaceInfo(),
      area: window.Container3D.getConstructionTakeoff().floorAreaM2
    }));
    assert.equal(initial.floor.general.hasTexture, true);
    assert.equal(initial.floor.general.rotationRadians, 0);
    await page.locator('#floor-direction').selectOption('width');
    const turned = await page.evaluate(() => ({
      state: window.Container3D.getState(),
      floor: window.Container3D.getFloorSurfaceInfo(),
      area: window.Container3D.getConstructionTakeoff().floorAreaM2
    }));
    assert.equal(turned.state.floorDirection, 'width');
    assert.ok(Math.abs(turned.floor.general.rotationRadians - Math.PI / 2) < 1e-7);
    assert.equal(turned.area, initial.area);
    assert.match(await page.locator('#takeoff-summary').innerText(), /a lo ancho/);
    // El importador restablece el selector y vuelve a girar la textura.
    const restore = await page.evaluate(() => {
      const data = window.Container3D.getState();
      window.Container3D.setFloorDirection('length');
      return window.Container3D.setState(data);
    });
    assert.equal(restore.ok, true);
    assert.equal(await page.locator('#floor-direction').inputValue(), 'width');
    const angle = await page.evaluate(() => window.Container3D.getFloorSurfaceInfo().general.rotationRadians);
    assert.ok(Math.abs(angle - Math.PI / 2) < 1e-7);
    assert.deepEqual(errors, [], errors.join('\n'));
  } finally { if (f) await close(f); }
});


test('V4.9.1: fachada cortada no deja puerta/ventana superpuesta y se restaura al salir', { timeout: 180000 }, async () => {
  let fixture;
  try {
    fixture = await prepare();
    const { page, errors } = fixture;
    const before = await page.evaluate(() => {
      const api = window.Container3D;
      const created = api.addOpening({ type: 'window', face: 'A', w: 1.5, h: 1.0, u: 5, v: 1.1 });
      if (!created.ok) throw Error(created.error);
      api.setView([3, 3, 8], [0, 0, 0]);
      return api.getCutawayWallState();
    });
    const faceA = before.find(w => w.face === 'A');
    assert.equal(faceA.visible, true);
    assert.ok(faceA.openings > 0);
    assert.ok(faceA.visibleOpenings > 0);
    const cut = await page.evaluate(() => {
      window.Container3D.setSeeInside(true);
      return window.Container3D.getCutawayWallState();
    });
    const near = cut.find(w => w.face === 'A');
    assert.equal(near.hidden, true);
    assert.equal(near.visible, false);
    assert.ok(near.openings > 0);
    assert.equal(near.visibleOpenings, 0,
      'No pueden quedar aberturas visibles en una fachada retirada');
    assert.ok(cut.some(w => w.visible), 'Paredes lejanas permanecen visibles');
    const restored = await page.evaluate(() => {
      window.Container3D.setSeeInside(false);
      return window.Container3D.getCutawayWallState();
    });
    assert.equal(restored.every(w => w.visible && !w.hidden), true);
    assert.ok(restored.find(w => w.face === 'A').visibleOpenings > 0);
    assert.deepEqual(errors, [], errors.join('\n'));
  } finally { if (fixture) await close(fixture); }
});

test('V4.9.2 navegador: botón ajustar al espacio libre genera encuentro T sin cruzar', { timeout: 180000 }, async () => {
  let fixture;
  try {
    fixture = await prepare();
    const { page, errors } = fixture;
    const results = await page.evaluate(() => {
      const api=window.Container3D;
      api.setType('maritimo');
      const size=api.setDimensions(6,2.4,2.5);
      if (!size.ok) return { error:size.error };
      const wall=api.addPartition({axis:'z',autoSpan:true,thickness:.1,height:2.3});
      const branch=api.addPartition({axis:'x',length:1.1,cx:1,cz:0,thickness:.1,height:2.3});
      return {wall,branch};
    });
    assert.equal(results.error,undefined,results.error);
    assert.equal(results.wall.ok,true,results.wall.error);
    assert.equal(results.branch.ok,true,results.branch.error);
    await page.locator('#bFitPartitionFree').click();
    const state=await page.evaluate(()=>window.Container3D.getState());
    assert.equal(state.partitions.length,2);
    const fitted=state.partitions.find(p=>p.id===results.branch.id);
    assert.ok(Math.abs(fitted.length-2.87)<1e-6);
    assert.equal(fitted.autoSpan,false);
    assert.match(await page.locator('#scene-hint').innerText(), /ajustado al espacio libre/i);
    assert.deepEqual(errors,[],errors.join('\n'));
  } finally { if(fixture) await close(fixture); }
});

test('V4.9.3 UI: clic sobre el piso crea un único tabique ajustado al tramo libre',
  { timeout: 180000 }, async () => {
  let fixture;
  try {
    fixture = await prepare();
    const { page, errors } = fixture;
    await page.evaluate(() => {
      const api = window.Container3D;
      api.setType('modular');
      api.setSeeInside(true);
      api.setView([0, 9, 0.03], [0, 0, 0]);
    });
    await page.locator('#new-partition-click-mode summary').click();
    await page.locator('#new-partition-axis').selectOption('x');
    await page.locator('#new-partition-direction').selectOption('both');
    await page.locator('#place-fitted-partition').click();
    assert.match(await page.locator('#scene-hint').innerText(), /haz clic en el piso/i);
    const point = await page.evaluate(() => window.Container3D.getScreenPoint(0, .148, 0));
    assert.equal(point.visible, true);
    await page.mouse.click(point.x, point.y);
    await page.waitForFunction(() => window.Container3D.getState().partitions.length === 1);
    const state = await page.evaluate(() => window.Container3D.getState());
    assert.equal(state.partitions[0].axis, 'x');
    assert.equal(state.partitions[0].autoSpan, false);
    assert.ok(state.partitions[0].length > state.L-0.3);
    assert.match(await page.locator('#scene-hint').innerText(), /Tabique agregado.*m/i);
    await page.mouse.click(point.x, point.y);
    assert.equal(await page.evaluate(() => window.Container3D.getState().partitions.length),1,
      'Modo de colocación se desarma después del primer clic válido');
    assert.deepEqual(errors, [], errors.join('\n'));
  } finally { if (fixture) await close(fixture); }
});

test('V4.9.3 UI: clic en tabique ocupado se rechaza, y Esc cancela modo de creación',
  { timeout: 180000 }, async () => {
  let fixture;
  try {
    fixture = await prepare();
    const { page, errors } = fixture;
    const created = await page.evaluate(() => {
      const api = window.Container3D;
      api.setType('modular');
      api.setSeeInside(true);
      api.setView([0, 9, 0.03], [0, 0, 0]);
      return api.addPartition({axis:'z',autoSpan:true,thickness:.1,height:2.3});
    });
    assert.equal(created.ok,true,created.error);
    await page.locator('#new-partition-click-mode summary').click();
    await page.locator('#new-partition-axis').selectOption('x');
    await page.locator('#place-fitted-partition').click();
    const occupied = await page.evaluate(() => window.Container3D.getScreenPoint(0, .148, 0));
    await page.mouse.click(occupied.x, occupied.y);
    assert.equal(await page.evaluate(() => window.Container3D.getState().partitions.length),1);
    assert.match(await page.locator('#scene-hint').innerText(),/ocupado/i);
    await page.keyboard.press('Escape');
    assert.match(await page.locator('#scene-hint').innerText(),/cancelada/i);
    assert.deepEqual(errors, [], errors.join('\n'));
  } finally { if (fixture) await close(fixture); }
});

test('V4.10: seleccionar tabique abre ficha contextual con geometría, capas, uniones y acciones', { timeout: 180000 }, async () => {
  let fixture;
  try {
    fixture = await prepare();
    const { page, errors } = fixture;
    await page.setViewportSize({ width: 1522, height: 455 });
    const added = await page.evaluate(() => window.Container3D.addPartition({
      axis: 'z', autoSpan: true, thickness: .1, height: 2.3
    }));
    assert.equal(added.ok, true, JSON.stringify(added));
    assert.equal(await page.locator('#selection-inspector').isVisible(), true);
    for (const id of ['inspector-geometry', 'partition-finishes-box', 'inspector-options',
      'partition-junction-box', 'prop-apply', 'part-face-a', 'part-face-b',
      'part-insulation', 'btn-junction-t', 'btn-junction-l', 'btn-rotate-partition', 'prop-delete']) {
      assert.equal(await page.locator('#' + id).isVisible(), true, id + ' debe verse en inspector');
    }
    const layout = await page.evaluate(() => {
      const drawer = document.querySelector('#selection-inspector').getBoundingClientRect();
      const body = document.querySelector('#inspector-body');
      return { right: drawer.right, width: drawer.width, scroll: body.scrollHeight - body.clientHeight };
    });
    assert.ok(layout.width >= 600 && layout.right <= 1522, 'Ficha contextual amplia dentro de pantalla');
    assert.ok(layout.scroll <= 25, 'En ventana baja el editor reduce el desplazamiento vertical');

    await page.locator('#part-face-a').selectOption('P30');
    assert.equal(await page.evaluate(() => window.Container3D.getState().partitions[0].faceALining), 'P30');
    await page.locator('#btn-add-interior-door').click();
    const state = await page.evaluate(() => window.Container3D.getState());
    assert.equal(state.interiorDoors.length, 1);
    // El motor selecciona automáticamente la nueva puerta. Al volver al tabique
    // aparecen todas sus puertas vinculadas para editarlas desde la ficha.
    await page.evaluate(id => window.Container3D.selectEntity('partition', id), added.id);
    assert.equal(await page.locator('#inspector-partition-doors button').count(), 1);
    await page.locator('#inspector-partition-doors button').click();
    assert.equal(await page.locator('#selection-inspector').isVisible(), true);
    assert.match(await page.locator('#properties-title').innerText(), /puerta/i);

    await page.locator('#close-inspector').click();
    assert.equal(await page.locator('#selection-inspector').isVisible(), false);
    assert.equal(await page.locator('#open-inspector').isVisible(), true);
    await page.locator('#open-inspector').click();
    assert.equal(await page.locator('#selection-inspector').isVisible(), true);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#selection-inspector').isVisible(), false);
    assert.deepEqual(errors, [], errors.join('\n'));
  } finally { if (fixture) await close(fixture); }
});

test('V4.10: selección de ventana muestra barrotes y conserva un único formulario editable', { timeout: 180000 }, async () => {
  let fixture;
  try {
    fixture = await prepare();
    const { page, errors } = fixture;
    const made = await page.evaluate(() => {
      const api = window.Container3D;
      const r = api.addOpening({ type: 'window', face: 'A', u: 2, v: .85, w: 1.2, h: .9, bars: false });
      if (r.ok) api.selectEntity('opening', r.id);
      return r;
    });
    assert.equal(made.ok, true, JSON.stringify(made));
    assert.equal(await page.locator('#selection-inspector').isVisible(), true);
    assert.equal(await page.locator('#inspector-opening-bars-label').isVisible(), true);
    assert.equal(await page.locator('#prop-w').count(), 1, 'No debe duplicar inputs de propiedades');
    await page.locator('#inspector-opening-bars').check();
    const changed = await page.evaluate(() => window.Container3D.getState().openings[0].bars);
    assert.equal(changed, true);
    assert.deepEqual(errors, [], errors.join('\n'));
  } finally { if (fixture) await close(fixture); }
});
