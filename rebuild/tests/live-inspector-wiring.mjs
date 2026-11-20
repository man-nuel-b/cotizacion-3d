import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const base = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(path.join(base, 'index.html'), 'utf8');
const ui = readFileSync(path.join(base, 'container-editor-ui.js'), 'utf8');
const engine = readFileSync(path.join(base, 'container-engine.js'), 'utf8');

test('V4.11: Inspector acoplado reserva espacio visual real para el modelo', () => {
  assert.match(html, /body\.inspector-docked #view\{right:/);
  assert.match(html, /body\.inspector-docked #panel\{display:none/);
  assert.match(html, /#selection-inspector\[data-layout="assembly"\]/);
  assert.match(ui, /document\.body\.classList\.toggle\('inspector-docked', docked\)/);
  assert.match(engine, /ResizeObserver\(resizeSceneToViewport\)\.observe\(view\)/);
  assert.match(engine, /camera\.aspect = width \/ height/);
});

test('V4.11: geometría se aplica mediante APIs validadas en input sin pulsar guardar', () => {
  assert.match(ui, /function applyLiveControl\(el\)/);
  assert.match(ui, /apiUpdateForSelection\(selected, \{ \[prop\]: value \}\)/);
  assert.match(ui, /input\.addEventListener\('input'/);
  assert.match(ui, /input\.addEventListener\('change'/);
  assert.match(ui, /lastLiveUndo = \{ kind:selected\.kind/);
  assert.match(ui, /el\.setAttribute\('aria-invalid', 'true'\)/);
  assert.match(ui, /focused\.node\.value = focused\.value/);
});

test('V4.11: panel integra catálogo con opción de ocultarlo y muestra cubicación', () => {
  assert.match(html, /id="toggle-catalog-inspector"/);
  assert.match(html, /id="inspector-undo"/);
  assert.match(html, /id="inspector-live-metrics"/);
  assert.match(ui, /totalPartitionBothFacesAreaM2\.toFixed\(2\)/);
  assert.match(ui, /\$\('inspector-undo'\)\.addEventListener\('click'/);
});
