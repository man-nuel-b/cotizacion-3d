'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('All static local script references point to existing project files',()=>{
  for(const page of ['index.html','pruebas.html']){
    const html=read(page);
    const sources=[...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi)].map(x=>x[1]);
    for(const source of sources){
      if(/^(?:https?:|\/\/|data:)/.test(source))continue;
      assert.ok(fs.existsSync(path.join(root,source.split('?')[0])),page+': missing '+source);
    }
  }
});
test('Quote button never navigates to a non-existent six-step panel',()=>{
  const html=read('index.html');
  assert.match(html,/Cotizar este diseño<\/button>/);
  assert.match(html,/goStep\(document\.querySelector\('[^']*data-step=6[^']*'\) \? 6 : 4\)/);
  const wizard=read('wizard-interior-step.js');
  assert.match(wizard,/quote\.dataset\.step='6'/);
  assert.match(wizard,/goStep=function\(step\)/);
});
test('Restricted preview uses an authenticated dynamic script loader',()=>{
  const preview=read('pruebas.html');
  assert.match(preview,/const SCRIPTS=\[/);
  assert.match(preview,/await loadScript\(script\)/);
  assert.match(preview,/if\(!await authorized\(\)\)/);
});
