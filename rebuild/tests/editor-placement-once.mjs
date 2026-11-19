/**
 * Pruebas sin navegador de la ruta real placement() de container-editor-ui.js.
 * Se evalúa la función original (no una copia reimplementada) con un motor/escena simulados.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const dir = path.dirname(fileURLToPath(import.meta.url));
const ui = fs.readFileSync(path.join(dir, '../container-editor-ui.js'), 'utf8');
const start = ui.indexOf('  function placement(code, ray) {');
const end = ui.indexOf('\n  function setLabel(', start);
assert.ok(start !== -1 && end > start, 'Se debe poder extraer placement() del editor real');
const actualPlacementSource = ui.slice(start, end);

function fixture(item, addResult = { ok: true }) {
  const calls = [];
  const messages = [];
  const sandbox = {
    pendingCode: item.code,
    CATALOG_BY_CODE: { [item.code]: item },
    state: { L: 6, W: 2.4, H: 2.5 },
    FLOOR: 0.04,
    api: {
      getInteriorClearance: () => 0.08,
      getWallThickness: () => 0.06,
      addObject(code, x, z, y, rot) {
        calls.push({ code, x, z, y, rot });
        return addResult;
      },
    },
    clamp: (v, min, max) => Math.min(Math.max(v, min), max),
    wallHit: () => item.visual === 'wall-lining' ? { face: 'A', point: { x: 0, z: 1.2 } } : null,
    floorHit: () => ({ x: 0, z: 0 }),
    clearPending() { sandbox.pendingCode = null; },
    hint(message, error = false) { messages.push({ message, error }); },
  };
  const placement = vm.runInNewContext(`${actualPlacementSource}\nplacement`, sandbox);
  return { sandbox, calls, messages, placement };
}

test('P60 object: luego de un clic exitoso se desarma y el clic siguiente no duplica', () => {
  const f = fixture({ code: 'P60', mode: 'object', visual: 'toilet', size: [0.4, 0.78, 0.68] });
  f.placement('P60', {});
  assert.equal(f.calls.length, 1);
  assert.equal(f.sandbox.pendingCode, null);
  assert.match(f.messages.at(-1).message, /agregado/);
  // Incluso si un callback antiguo intenta colocar el código ya desarmado.
  f.placement('P60', {});
  assert.equal(f.calls.length, 1);
});

test('P12 wall-object: la colocación de un ensamblaje es de un solo uso', () => {
  const f = fixture({ code: 'P12', mode: 'wall-object', visual: 'partition', size: [1.6, 2.3, 0.12] });
  f.placement('P12', {});
  f.placement('P12', {});
  assert.equal(f.calls.length, 1);
  assert.equal(f.sandbox.pendingCode, null);
});

test('P14 trasdosado wall-object: también desarma tras un éxito', () => {
  const f = fixture({ code: 'P14', mode: 'wall-object', visual: 'wall-lining', size: [1.6, 2.3, 0.12] });
  f.placement('P14', {});
  f.placement('P14', {});
  assert.equal(f.calls.length, 1);
  assert.equal(f.sandbox.pendingCode, null);
});

test('Si el motor rechaza la inserción, se conserva el código para reintentar', () => {
  const f = fixture({ code: 'P60', mode: 'object', visual: 'toilet', size: [0.4, 0.78, 0.68] }, { ok: false, error: 'Colisión detectada' });
  f.placement('P60', {});
  assert.equal(f.calls.length, 1);
  assert.equal(f.sandbox.pendingCode, 'P60');
  assert.deepEqual(f.messages.map(x => x.error), [true]);
  f.placement('P60', {});
  assert.equal(f.calls.length, 2, 'Debe poder volver a intentar tras un error');
});

test('No se colocan códigos antiguos ni llamadas sin partida armada', () => {
  const f = fixture({ code: 'P60', mode: 'object', visual: 'toilet', size: [0.4, 0.78, 0.68] });
  f.placement('P12', {});
  f.placement('', {});
  assert.equal(f.calls.length, 0);
  assert.equal(f.sandbox.pendingCode, 'P60');
});
