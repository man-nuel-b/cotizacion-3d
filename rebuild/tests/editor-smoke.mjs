import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../');
const mime={'.html':'text/html;charset=utf-8','.js':'application/javascript;charset=utf-8','.mjs':'application/javascript;charset=utf-8'};
const localThree=path.join(repo,'rebuild/node_modules/three');
const server=http.createServer((req,res)=>{
 try {
  const decoded=decodeURIComponent(new URL(req.url,'http://local/').pathname);
  const file=path.resolve(repo,'.'+decoded);
  if(!file.startsWith(repo+path.sep))throw Error('outside repo');
  const data=fs.readFileSync(file);
  res.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream','cache-control':'no-store'});
  res.end(data);
 }catch(err){res.writeHead(404);res.end('Not found: '+err.message);}
});
async function prepare(){
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,args:[
  '--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--disable-dev-shm-usage','--no-sandbox'
 ]});
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 const errors=[];page.on('pageerror',error=>errors.push(String(error?.stack||error)));
 page.on('console',message=>{if(message.type()==='error')errors.push('console: '+message.text());});
 await page.route('https://cdn.jsdelivr.net/npm/three@0.160.0/**',async route=>{
  try{
   const key=route.request().url().split('/three@0.160.0/')[1].split('?')[0];
   const file=path.resolve(localThree,key);
   if(!file.startsWith(localThree+path.sep))throw Error('file path');
   const body=fs.readFileSync(file);
   await route.fulfill({status:200,contentType:'application/javascript',body});
  }catch(err){errors.push('Three CDN mapping: '+err.message);await route.abort();}
 });
 await page.goto('http://127.0.0.1:'+server.address().port+'/rebuild/index.html',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>Boolean(window.Container3D)&&document.querySelectorAll('.catalog-item').length>=60,
  null,{timeout:45000});
 return {browser,page,errors};
}
function close({browser}){return browser?.close();}
test('BAT V2: catálogo 60 partidas, selección de objetos, edición y exportación', {timeout:180000},async()=>{
 let fixture;
 try{
  fixture=await prepare();const {page,errors}=fixture;
  assert.equal(await page.locator('.catalog-item').count(),60);
  assert.equal(await page.locator('#catalog-family option').count(),9);
  await page.locator('#catalog-search').fill('inodoro');
  assert.equal(await page.locator('.catalog-item').count(),1);
  await page.locator('#catalog-search').fill('');
  await page.locator('.catalog-item[data-code="P60"]').click();
  assert.match(await page.locator('#scene-hint').innerText(),/P60/);
  await page.locator('#view canvas').click({position:{x:720,y:450}});
  await page.waitForFunction(()=>window.Container3D.getState().objects.length===1,{timeout:10000});
  let state=await page.evaluate(()=>window.Container3D.getState());
  assert.equal(state.objects[0].code,'P60');
  assert.equal(await page.locator('#props-form').isVisible(),true);
  assert.equal(await page.locator('#prop-x').count(),1,'X input must survive label update');
  await page.locator('#prop-x').fill('0');
  await page.locator('#prop-z').fill('0');
  await page.locator('#prop-w').fill('0.45');
  await page.locator('#prop-rot').fill('15');
  await page.locator('#prop-apply').click();
  state=await page.evaluate(()=>window.Container3D.getState());
  assert.equal(state.objects[0].w,.45);
  assert.equal(state.objects[0].rot,15);
  await page.locator('#catalog-search').fill('P01');
  await page.locator('.catalog-item[data-code="P01"]').click();
  await page.locator('#view canvas').click({position:{x:720,y:450}});
  state=await page.evaluate(()=>window.Container3D.getState());
  assert.equal(state.finishes.floor,'P01');
  assert.equal(state.objects.length,1);
  assert.equal(await page.locator('#scene-hint').innerText().then(x=>x.includes('aplicado')),true);
  await page.locator('#catalog-search').fill('P83');
  await page.locator('.catalog-item[data-code="P83"]').click();
  await page.locator('#view canvas').click({position:{x:690,y:470}});
  state=await page.evaluate(()=>window.Container3D.getState());
  assert.equal(state.openings.length,1,'Window is placed via surface click');
  assert.equal(state.openings[0].catalogCode,'P83');
  assert.equal(state.openings[0].type,'window');
  const rendered=await page.evaluate(()=>{
   const group=window.Container3D.getEntityMeshes()[0];
   let meshes=0;group?.traverse(x=>{if(x.isMesh)meshes++;});
   return meshes;
  });
  assert.ok(rendered>8,'WC geometry must contain actual meshes');
  assert.deepEqual(errors,[],errors.join('\n'));
 }finally{if(fixture)await close(fixture);await new Promise(resolve=>server.close(resolve));}
});
test('BAT V2: three model types, safe dimensions, save & import', {timeout:180000},async()=>{
 let fixture;
 try{
  fixture=await prepare();const {page,errors}=fixture;
  for(const type of ['maritimo','reefer','modular']){
   await page.locator('[data-t="'+type+'"]').click();
   const value=await page.evaluate(()=>window.Container3D.getState().type);
   assert.equal(value,type);
  }
  let state=await page.evaluate(()=>window.Container3D.getState());
  assert.equal(state.L,5.95);
  const invalid=await page.evaluate(()=>window.Container3D.addObject('P60',99,0));
  assert.equal(invalid.ok,false);
  assert.equal((await page.evaluate(()=>window.Container3D.getState())).objects.length,0);
  const add=await page.evaluate(()=>window.Container3D.addObject('P60',0,0));
  assert.equal(add.ok,true);
  const before=await page.evaluate(()=>window.Container3D.getState());
  const invalidUpdate=await page.evaluate(id=>window.Container3D.updateObject(id,{w:NaN}),before.objects[0].id);
  assert.equal(invalidUpdate.ok,false);
  assert.deepEqual(await page.evaluate(()=>window.Container3D.getState()),before);
  const exported=await page.evaluate(()=>window.Container3D.getState());
  await page.locator('[data-t="reefer"]').click();
  // Page confirmation prompt intentionally dismisses first, and then accepts.
  let after=await page.evaluate(()=>window.Container3D.getState());
  assert.equal(after.type,'modular');
  const restored=await page.evaluate(data=>window.Container3D.setState(data),exported);
  assert.equal(restored.ok,true);
  assert.deepEqual(await page.evaluate(()=>window.Container3D.getState()),exported);
  assert.ok(await page.locator('#view canvas').count()===1);
  assert.deepEqual(errors,[],errors.join('\n'));
 }finally{if(fixture)await close(fixture);await new Promise(resolve=>server.close(resolve));}
});
