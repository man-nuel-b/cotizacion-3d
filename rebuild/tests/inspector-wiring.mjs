import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const base=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const html=readFileSync(path.join(base,'index.html'),'utf8');
const ui=readFileSync(path.join(base,'container-editor-ui.js'),'utf8');

test('Inspector: controles presentes una sola vez para evitar duplicar propiedades',()=>{
 const matches=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);
 assert.equal(matches.length,new Set(matches).size,'Los ID HTML deben ser únicos');
 for(const id of ['selection-inspector','close-inspector','open-inspector','inspector-body',
   'inspector-heading-target','inspector-subtitle','inspector-footer','inspector-feedback',
   'inspector-opening-bars','inspector-opening-bars-label',
   'props-form','part-face-a','part-face-b','btn-add-interior-door','btn-junction-t',
   'btn-junction-l','bFitPartitionFree','prop-apply','prop-delete']) {
    assert.ok(matches.includes(id),`Falta control ${id}`);
 }
});

test('Inspector: el editor mueve nodos originales y evita reconstruir inputs',()=>{
 assert.match(ui, /\$\('inspector-body'\)\.appendChild\(form\)/);
 assert.match(ui, /form\.replaceChildren\(geometry, materials, options, junctions\)/);
 assert.match(ui, /\$\('inspector-actions'\)\.appendChild\(actionButtons\)/);
 assert.match(ui, /syncInspector\(selection\)/);
 assert.match(ui, /inspectorDismissedKey = null/);
 assert.match(ui, /\$\('inspector-opening-bars'\)\.addEventListener\('change'/);
 assert.match(ui, /api\.selectEntity\('interiorDoor', door.id\)/);
});

test('Inspector: modo compacto y acciones visibles sin alterar modelos/JSON',()=>{
 assert.match(html, /@media\(max-height:650px\)/);
 assert.match(html, /#inspector-footer\{/);
 assert.match(html, /grid-template-areas:/);
 assert.match(html, /id="selection-inspector"[^>]+hidden/);
});
