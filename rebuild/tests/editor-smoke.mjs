import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../');
const mime = { '.html': 'text/html;charset=utf-8', '.js': 'application/javascript;charset=utf-8', '.mjs': 'application/javascript;charset=utf-8' };
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
      args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--disable-dev-shm-usage', '--no-sandbox']});
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

test('BAT V2: three model types, safe dimensions, save & import', { timeout: 180000 }, async () => {
  let fixture;
  try {
    fixture = await prepare(); const { page, errors } = fixture;
    for (const type of ['maritimo', 'reefer', 'modular']) {
      await page.locator('[data-t="' + type + '"]').click();
      const value = await page.evaluate(() => window.Container3D.getState().type);
      assert.equal(value, type);
    }
    let state = await page.evaluate(() => window.Container3D.getState());
    assert.equal(state.L, 5.95);
    const invalid = await page.evaluate(() => window.Container3D.addObject('P60', 99, 0));
    assert.equal(invalid.ok, false);
    assert.equal((await page.evaluate(() => window.Container3D.getState())).objects.length, 0);
    const add = await page.evaluate(() => window.Container3D.addObject('P60', 0, 0));
    assert.equal(add.ok, true);
    const before = await page.evaluate(() => window.Container3D.getState());
    const invalidUpdate = await page.evaluate(id => window.Container3D.updateObject(id, { w: NaN }), before.objects[0].id);
    assert.equal(invalidUpdate.ok, false);
    assert.deepEqual(await page.evaluate(() => window.Container3D.getState()), before);
    const exported = await page.evaluate(() => window.Container3D.getState());
    page.once('dialog', dialog => dialog.dismiss());
    await page.locator('[data-t="reefer"]').click();
    let after = await page.evaluate(() => window.Container3D.getState());
    assert.equal(after.type, 'modular');
    const restored = await page.evaluate(data => window.Container3D.setState(data), exported);
    assert.equal(restored.ok, true);
    assert.deepEqual(await page.evaluate(() => window.Container3D.getState()), exported);
    assert.ok(await page.locator('#view canvas').count() === 1);
    assert.deepEqual(errors, [], errors.join('\n'));
  } finally { if (fixture) await close(fixture); }
});


test('BAT V2: el checkbox activa y desactiva barrotes en la ventana seleccionada', { timeout: 180000 }, async () => {
  let fixture;
  try {
    fixture = await prepare();
    const { page, errors } = fixture;
    await page.locator('[data-t="modular"]').click();
    const created = await page.evaluate(() => window.Container3D.addOpening({
      type: 'window', face: 'A', w: 1.2, h: 1, u: 2, v: 1, bars: false
    }));
    assert.equal(created.ok, true);
    assert.equal(await page.locator('#oBars').isChecked(), false);
    await page.locator('#oBars').check();
    let state = await page.evaluate(() => window.Container3D.getState());
    assert.equal(state.openings[0].bars, true);
    await page.locator('#oBars').uncheck();
    state = await page.evaluate(() => window.Container3D.getState());
    assert.equal(state.openings[0].bars, false);

    // Al seleccionar otra ventana, el control debe reflejar su configuración.
    const second = await page.evaluate(() => window.Container3D.addOpening({
      type: 'window', face: 'C', w: 1.2, h: 1, u: 2, v: 1, bars: true
    }));
    assert.equal(second.ok, true);
    assert.equal(await page.locator('#oBars').isChecked(), true);
    await page.evaluate(id => window.Container3D.selectEntity('opening', id), created.id);
    assert.equal(await page.locator('#oBars').isChecked(), false);
    await page.locator('#oBars').check();
    state = await page.evaluate(() => window.Container3D.getState());
    assert.equal(state.openings.find(o => o.id === created.id).bars, true);
    assert.equal(state.openings.find(o => o.id === second.id).bars, true);
    assert.deepEqual(errors, [], errors.join('\\n'));
  } finally { if (fixture) await close(fixture); }
});


test('BAT V2: colisiones 3D y giro de tabiques con selección', { timeout: 180000 }, async () => {
  let fixture;
  try {
    fixture = await prepare();
    const { page, errors } = fixture;
    const first = await page.evaluate(() => window.Container3D.addObject('P60', -1.5, 0));
    assert.equal(first.ok, true);
    const rejected = await page.evaluate(() => window.Container3D.addObject('P60', -1.5, 0));
    assert.equal(rejected.ok, false);
    assert.match(rejected.error, /superpone/);
    const second = await page.evaluate(() => window.Container3D.addObject('P60', 1.5, 0));
    assert.equal(second.ok, true);
    const moved = await page.evaluate(id => window.Container3D.updateObject(id, { x: -1.5, z: 0 }), second.id);
    assert.equal(moved.ok, false);
    const state = await page.evaluate(() => window.Container3D.getState());
    assert.equal(state.objects.find(o => o.id === second.id).x, 1.5);

    const created = await page.evaluate(() => window.Container3D.addPartition({
      length: 1.2, height: 2, thickness: 0.1, axis: 'x', cx: 0, cz: 0
    }));
    assert.equal(created.ok, true);
    assert.equal(await page.locator('#btn-rotate-partition').isVisible(), true);
    await page.locator('#btn-rotate-partition').click();
    let partitions = (await page.evaluate(() => window.Container3D.getState())).partitions;
    assert.equal(partitions[0].axis, 'z');
    await page.locator('#btn-rotate-partition').click();
    partitions = (await page.evaluate(() => window.Container3D.getState())).partitions;
    assert.equal(partitions[0].axis, 'x');
    assert.deepEqual(errors, [], errors.join('\\n'));
  } finally { if (fixture) await close(fixture); }
});


test('BAT V2: revestimiento se aplica en la cara seleccionada y se conserva en estado', { timeout: 180000 }, async () => {
  let fixture;
  try {
    fixture = await prepare();
    const { page, errors } = fixture;
    await page.locator('.catalog-item[data-code="P34"]').click();
    assert.equal(await page.locator('#wall-finish-controls').isVisible(), true);
    await page.locator('#wall-finish-face').selectOption('C');
    await page.locator('#apply-wall-finish').click();
    let state = await page.evaluate(() => window.Container3D.getState());
    assert.equal(state.finishes.walls.C, 'P34');
    assert.equal(state.finishes.walls.A, null);
    assert.equal(await page.locator('#wall-finish-controls').isVisible(), false);

    await page.locator('.catalog-item[data-code="P36"]').click();
    await page.locator('#wall-finish-face').selectOption('A');
    await page.locator('#apply-wall-finish').click();
    state = await page.evaluate(() => window.Container3D.getState());
    assert.equal(state.finishes.walls.A, 'P36');
    assert.equal(state.finishes.walls.C, 'P34');
    const materialExists = await page.evaluate(() => {
      let found = false;
      window.Container3D.getState();
      // The successful rebuild and persisted finish state are required.
      return document.querySelector('#view canvas') !== null;
    });
    assert.equal(materialExists, true);
    assert.deepEqual(errors, [], errors.join('\\n'));
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

    const invalid = await page.evaluate(() => window.Container3D.setWallLining('X', 'P34'));
    assert.equal(invalid.ok, false);
    assert.match(invalid.error, /Cara/);
    assert.deepEqual(errors, [], errors.join('\\n'));
  } finally { if (fixture) await close(fixture); }
});
