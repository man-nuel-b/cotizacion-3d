import test from 'node:test';
import assert from 'node:assert/strict';
import { createDisposalContext, disposeHierarchy, disposeMaterial, disposeTexture } from '../resource-disposal.js';
const resource = (extra = {}) => ({ ...extra, n: 0, dispose() { this.n++; } });

test('Limpieza recursiva: una geometría/material/mapa compartidos se liberan una vez', () => {
  const staticTexture = resource({ isTexture: true });
  const clonedTexture = resource({ isTexture: true });
  const normalMap = resource({ isTexture: true });
  const mat = resource({ map: clonedTexture, normalMap, envMap: staticTexture });
  const geo = resource();
  const group = {
    traverse(fn) {
      fn({ geometry: geo, material: [mat, mat] });
      fn({ geometry: geo, material: mat });
    }
  };
  const ctx = createDisposalContext([staticTexture]);
  disposeHierarchy(group, ctx);
  disposeMaterial(mat, ctx);
  disposeTexture(clonedTexture, ctx);
  assert.equal(geo.n, 1);
  assert.equal(mat.n, 1);
  assert.equal(clonedTexture.n, 1);
  assert.equal(normalMap.n, 1);
  assert.equal(staticTexture.n, 0);
});

test('Ciclo independiente puede liberar nuevos recursos, no los persistentes', () => {
  const staticTexture = resource({ isTexture: true });
  const cloneOne = resource({ isTexture: true });
  const cloneTwo = resource({ isTexture: true });
  const ctx1 = createDisposalContext([staticTexture]);
  disposeTexture(cloneOne, ctx1);
  disposeTexture(cloneOne, ctx1);
  const ctx2 = createDisposalContext([staticTexture]);
  disposeTexture(cloneTwo, ctx2);
  disposeTexture(staticTexture, ctx2);
  assert.equal(cloneOne.n, 1);
  assert.equal(cloneTwo.n, 1);
  assert.equal(staticTexture.n, 0);
});
