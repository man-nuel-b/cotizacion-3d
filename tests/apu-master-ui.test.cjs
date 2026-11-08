'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.join(__dirname,'..');
test('Maestro APU button opens latest dynamically overridden function and worksheet default',()=>{
 const s=fs.readFileSync(path.join(root,'apu-price-master.js'),'utf8');
 assert.match(s,/btn\.onclick=\(\)=>window\.openApuMaster\(\)/);
 assert.match(s,/window\.BAT_APU_SPREADSHEET\?\.show\?\.\(\)/);
 assert.match(s,/restoreGenericApu/);
 new vm.Script(s,{filename:'apu-price-master.js'});
});
test('Preview loader refreshes APU view script',()=>{
 const s=fs.readFileSync(path.join(root,'pruebas.html'),'utf8');
 assert.ok(s.includes('summary-panel-toggle.js?v=20261108-extrascore02'), 'Live project loader must be current');
});

test('Simple APU first: full worksheet remains accessible by a toggle',()=>{
 const src=fs.readFileSync(path.join(root,'apu-spreadsheet-view-v1.js'),'utf8');
 assert.match(src,/simpleMode=true/);
 assert.match(src,/data-toggle-mode/);
 assert.match(src,/easyMarkup/);
 assert.match(src,/Ver planilla técnica/);
 assert.match(src,/Volver a vista simple/);
 new vm.Script(src,{filename:'apu-spreadsheet-view-v1.js'});
});
