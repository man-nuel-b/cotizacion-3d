import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const ui = readFileSync(new URL('../container-editor-ui.js', import.meta.url), 'utf8');
const engine = readFileSync(new URL('../container-engine.js', import.meta.url), 'utf8');

test('V4.17: acceso directo a las seis superficies desde el panel', () => {
  for (const selector of ['floor:general', 'roof:main', 'wall:A', 'wall:B', 'wall:C', 'wall:D']) {
    assert.ok(html.includes('data-edit-surface="' + selector + '"'), selector);
  }
  assert.match(html, /class="surface-shortcuts"/);
  assert.match(ui, /querySelectorAll\('\[data-edit-surface\]'\)/);
  assert.match(ui, /api\.selectEntity\(kind, id\)/);
  assert.match(ui, /inspectorDismissedKey = null;/);
  assert.match(ui, /refreshProperties\(\);/);
  assert.match(ui, /floorMaterialSelect\.focus/);
  assert.match(ui, /surfaceMaterialSelect\.focus/);
});

test('V4.17: motor valida IDs de superficies y el inspector posee sus controles', () => {
  assert.match(engine, /kind === 'floor' && id !== 'general'/);
  assert.match(engine, /kind === 'roof' && id !== 'main'/);
  assert.match(engine, /kind === 'wall' && !FACES\[id\]/);
  assert.match(ui, /floorMaterialSelect\.addEventListener\('change'/);
  assert.match(ui, /floorDirectionSelect\.addEventListener\('change'/);
  assert.match(ui, /surfaceMaterialSelect\.addEventListener\('change'/);
});
