import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(root, 'container-engine.js'), 'utf8');
const start = src.indexOf('function setWallHidden(w, hide) {');
const end = src.indexOf('\nfunction applyXray(', start);
const fn = vm.runInNewContext(src.slice(start, end) + '\nsetWallHidden');

function wall(roof = false) {
  return { roof, hidden: false,
    group: { visible: true, children: [
      { kind: 'panel', visible: true },
      { kind: 'window', visible: true },
      { kind: 'door', visible: true }
    ] },
    mat: { transparent: false, opacity: 1, depthWrite: true } };
}

test('Ver interior oculta el grupo completo: paredes, puertas y ventanas sin mallas flotantes', () => {
  const w = wall();
  fn(w, true);
  assert.equal(w.hidden, true);
  assert.equal(w.group.visible, false);
  assert.equal(w.mat.opacity, 1, 'No deja paneles de fachada fantasma');
  assert.equal(w.mat.transparent, false);
  for (const item of w.group.children) assert.equal(item.visible, true, 'No altera el diseño de los componentes');
  fn(w, false);
  assert.equal(w.group.visible, true);
  assert.equal(w.hidden, false);
});

test('Cubierta y paredes comparten el mismo modo de ocultación reversible', () => {
  const roof = wall(true), w = wall();
  fn(roof, true); fn(w, true);
  assert.equal(roof.group.visible, false); assert.equal(w.group.visible, false);
  fn(roof, false); fn(w, false);
  assert.equal(roof.group.visible, true); assert.equal(w.group.visible, true);
});

test('El modo de corte no desplaza paneles ni modifica la geometría/cubicación', () => {
  const w = wall();
  w.group.position = { x: 2, y: 0, z: 1 };
  const before = JSON.stringify(w.group.position);
  fn(w, true); fn(w, false);
  assert.equal(JSON.stringify(w.group.position), before);
  assert.match(src, /getCutawayWallState\(\)/);
});


test('Raycast ignora mallas ocultas por grupo padre en modo Ver interior', () => {
  const ui = fs.readFileSync(path.join(root, 'container-editor-ui.js'), 'utf8');
  assert.match(ui, /function isSceneVisible\(node\)/);
  assert.match(ui, /for \(let current = node; current; current = current\.parent\)/);
  assert.match(ui, /FACES\[node\.userData\.wallFace\] && isSceneVisible\(node\)/);
  assert.match(ui, /if \(!isSceneVisible\(node\)\) continue/);
});
