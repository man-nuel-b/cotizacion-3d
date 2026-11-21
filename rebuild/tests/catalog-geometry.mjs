import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CATALOG, CATALOG_BY_CODE, FAMILIES } from '../container-catalog.js';
import { createObjectModel } from '../container-object-models.js';

test('todas las 70 partidas tienen un código único y una función de aplicación explícita', () => {
  assert.equal(CATALOG.length, 70);
  assert.equal(new Set(CATALOG.map(x => x.code)).size, 70);
  assert.equal(FAMILIES.length, 9);
  const families = new Set(FAMILIES.map(x => x.id));
  const modes = new Set(['object', 'wall-object', 'opening', 'floor', 'wall-exterior-finish', 'wall-interior-finish', 'ceiling', 'skirting', 'service']);
  for (const item of CATALOG) {
    assert.match(item.code, /^P\d{2}$/);
    assert.equal(CATALOG_BY_CODE[item.code], item);
    assert.ok(item.name.trim().length > 10, item.code);
    assert.ok(families.has(item.family), item.code);
    assert.ok(modes.has(item.mode), item.code);
    if (['object', 'wall-object', 'opening'].includes(item.mode)) {
      assert.equal(item.size.length, 3, item.code);
      assert.ok(item.size.every(x => Number.isFinite(x) && x > 0), item.code);
    }
  }
});

test('cada partida colocable como objeto crea geometría 3D finita y liberable', () => {
  let count = 0;
  for (const item of CATALOG.filter(x => ['object', 'wall-object'].includes(x.mode))) {
    const owned = [];
    const group = createObjectModel(THREE, item, mat => owned.push(mat));
    assert.ok(group instanceof THREE.Group, item.code);
    let meshes = 0;
    group.traverse(child => {
      if (!child.isMesh) return;
      meshes++;
      assert.ok(child.geometry?.attributes?.position?.count > 0, item.code);
      child.geometry.computeBoundingBox();
      const bounds = child.geometry.boundingBox;
      assert.ok([bounds.min.x, bounds.min.y, bounds.min.z, bounds.max.x, bounds.max.y, bounds.max.z].every(Number.isFinite), item.code);
    });
    assert.ok(meshes >= 1, item.code);
    assert.ok(owned.length >= 1, item.code);
    group.traverse(child => child.geometry?.dispose());
    for (const mat of owned) mat.dispose();
    count++;
  }
  assert.ok(count >= 25, 'Se deben renderizar las partidas físicas principales');
});

test('Los muros exteriores ofrecen P50–P59 y los interiores quedan separados', () => {
  const exterior = CATALOG.filter(item => item.mode === 'wall-exterior-finish');
  const interior = CATALOG.filter(item => item.mode === 'wall-interior-finish');
  for (let n = 50; n <= 59; n++) {
    const item = CATALOG_BY_CODE['P' + n];
    assert.equal(item?.mode, 'wall-exterior-finish');
    assert.equal(item.family, 'exteriores');
    assert.ok(exterior.includes(item));
    assert.ok(!interior.includes(item));
  }
  for (const code of ['P30','P31','P32','P33','P34','P35','P36','P37','P46']) {
    assert.equal(CATALOG_BY_CODE[code]?.mode, 'wall-interior-finish');
    assert.ok(!exterior.includes(CATALOG_BY_CODE[code]));
  }
  assert.equal(CATALOG_BY_CODE.P45.mode, 'wall-exterior-finish');
  assert.equal(new Set(CATALOG.map(item => item.code)).size, CATALOG.length);
});
