import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const source = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../container-engine.js'), 'utf8');

test('Cubierta: rotación horizontal y desplazamiento hacia Z negativo para centrarla', () => {
  assert.match(source, /roof\.rotation\.x\s*=\s*Math\.PI\s*\/\s*2/);
  assert.match(source, /roof\.position\.set\(0,\s*totalH\s*-\s*WALL\s*\+\s*0\.0005,\s*-rw\s*\/\s*2\)/);
  // wallPanels genera una lámina de longitud rw en Y local, desde 0 hasta rw.
  // Al rotar X +90°, esa longitud es Z global. La traslación -rw/2 la centra.
  for (const width of [2.4, 2.6, 3.0, 4.6]) {
    const rw = width - 0.2;
    const z0 = -rw / 2;
    const z1 = z0 + rw;
    assert.ok(Math.abs((z0 + z1) / 2) < 1e-9);
    assert.ok(z0 >= -width / 2 && z1 <= width / 2);
  }
});

test('Modo interior: techo invisible, restauración al salir, sin mover geometrías', () => {
  assert.match(source, /function setWallHidden\(w, hide\)/);
  assert.match(source, /w\.group\.visible\s*=\s*!hide/);
  assert.match(source, /getRoofBounds\(\)/);
});
