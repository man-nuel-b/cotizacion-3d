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
 assert.match(s,/summary-panel-toggle\.js\?v=20261107-apu-ui03/);
});
