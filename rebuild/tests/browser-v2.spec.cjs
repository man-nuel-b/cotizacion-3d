'use strict';
/* Browser-level verification of V2 with local Three.js and no remote/cloud writes. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {createServer}=require('node:http');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'../..');
const three=fs.readFileSync(require.resolve('three/build/three.min.js'),'utf8');
const orbit=fs.readFileSync(path.join(path.dirname(require.resolve('three/package.json')),'examples/js/controls/OrbitControls.js'),'utf8');
function server(){
 return createServer((req,res)=>{
  try{
   const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname));
   if(!file.startsWith(root+path.sep))throw Error('outside-root');
   const body=fs.readFileSync(file);
   const ext=path.extname(file).toLowerCase();
   res.writeHead(200,{'Content-Type':ext==='.js'?'application/javascript':ext==='.html'?'text/html':'application/octet-stream'});
   res.end(body);
  }catch(error){res.writeHead(404);res.end('not found');}
 });
}
test('V2 browser: face click -> state -> 3D/BOM -> price, with validation rollback',{timeout:170000},async()=>{
 const http=server();
 await new Promise((resolve,reject)=>http.listen(0,'127.0.0.1',error=>error?reject(error):resolve()));
 let browser,page;
 try{
  browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage','--no-sandbox']});
  page=await browser.newPage({viewport:{width:1440,height:900}});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.stack||String(error)));
  await page.route('**/*',async route=>{
   const url=route.request().url();
   if(url.includes('cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js'))
    return route.fulfill({status:200,contentType:'application/javascript',body:three});
   if(url.includes('three@0.128.0/examples/js/controls/OrbitControls.js'))
    return route.fulfill({status:200,contentType:'application/javascript',body:orbit});
   if(url.startsWith('http://127.0.0.1:'))return route.continue();
   return route.abort();
  });
  await page.goto('http://127.0.0.1:'+http.address().port+'/rebuild/index.html',{waitUntil:'domcontentloaded'});
  try{
   await page.waitForFunction(()=>Boolean(window.BAT_V2)&&Boolean(document.querySelector('#canvas canvas')),null,{timeout:30000});
  }catch(error){
   const state=await page.evaluate(()=>({
    scripts:[...document.scripts].map(script=>script.src).filter(Boolean),
    message:document.querySelector('#message')?.textContent,
    canvasCount:document.querySelectorAll('#canvas canvas').length,
    hasApi:Boolean(window.BAT_V2),hasTypes:Boolean(window.BatContainerTypes)
   }));
   throw new Error('V2 failed to initialize: '+JSON.stringify({state,errors,pageError:String(error)}));
  }
  const initial=await page.evaluate(()=>({state:window.BAT_V2.getState(),quote:window.BAT_V2.getQuote()}));
  assert.equal(initial.state.openings.length,0);
  await page.locator('#arm-placement').click();
  const canvas=page.locator('#canvas canvas'),size=await canvas.boundingBox();
  assert.ok(size?.width>300&&size.height>300,'WebGL canvas has real dimensions');
  await canvas.click({position:{x:Math.round(size.width/2),y:Math.round(size.height/2)}});
  await page.waitForFunction(()=>window.BAT_V2.getState().openings.length===1,null,{timeout:12000});
  const result=await page.evaluate(()=>({state:window.BAT_V2.getState(),quote:window.BAT_V2.getQuote()}));
  assert.equal(result.state.revision,1,'one event must commit once');
  assert.ok(['A','B','C','D'].includes(result.state.openings[0].face));
  assert.ok(Number.isFinite(result.state.openings[0].bottom));
  assert.notEqual(result.quote.total,initial.quote.total,'BOM should reprice on geometry change');
  assert.equal(result.quote.lines.find(line=>line.code==='WINDOW').qty,1);
  assert.match(await page.locator('#selected-info').innerText(),/Seleccionada/);
  await page.locator('#add-opening').click();
  const same=await page.evaluate(()=>window.BAT_V2.getState());
  assert.equal(same.openings.length,1,'duplicate opening at same face must not be committed');
  assert.equal(same.revision,1,'invalid edits must preserve revision');
  assert.match(await page.locator('#message').innerText(),/superpuestas/);
  // Resizing through the panel must commit one revision and reprice the BOM.
  const priorRev=await page.evaluate(()=>window.BAT_V2.getRevision());
  await page.locator('#opening-width').fill('1.3');
  await page.locator('#update-opening').click();
  const resized=await page.evaluate(()=>({state:window.BAT_V2.getState(),quote:window.BAT_V2.getQuote()}));
  assert.equal(resized.state.openings[0].width,1.3);
  assert.equal(resized.state.revision,priorRev+1);
  assert.notEqual(resized.quote.total,result.quote.total);
  assert.match(await page.locator('#backup-status').innerText(),/Copia local guardada/);
  const priorResize=resized.state.revision;
  await page.locator('#opening-width').fill('0');
  await page.locator('#update-opening').click();
  assert.equal((await page.evaluate(()=>window.BAT_V2.getRevision())),priorResize);
  await page.locator('#add-partition').click();
  assert.equal((await page.evaluate(()=>window.BAT_V2.getState())).partitions.length,1);
  await page.locator('#partition-x').fill('7');
  await page.locator('#move-partition').click();
  const p=await page.evaluate(()=>window.BAT_V2.getState());
  assert.equal(p.partitions[0].x,0);
  assert.match(await page.locator('#message').innerText(),/fuera/);
  // Confirm the newly rotated partition is included in the same BOM and quote.
  const beforeRotated=await page.evaluate(()=>window.BAT_V2.getQuote().total);
  await page.locator('#partition-orientation').selectOption('z');
  await page.locator('#partition-length').fill('1');
  await page.locator('#partition-x').fill('2');
  await page.locator('#partition-z').fill('.3');
  await page.locator('#add-partition').click();
  const rotated=await page.evaluate(()=>({
   state:window.BAT_V2.getState(),quote:window.BAT_V2.getQuote(),
   bom:window.BAT_V2.getBOM(),revision:window.BAT_V2.getRevision()
  }));
  assert.equal(rotated.state.partitions.length,2);
  assert.equal(rotated.state.partitions[1].orientation,'z');
  assert.ok(rotated.quote.total>beforeRotated);
  assert.equal(rotated.state.revision,rotated.revision);
  assert.equal(rotated.bom.lines.find(line=>line.code==='PARTITION').qty,13.8);
  // Browse all 60 technical elements without mutating geometry or price.
  await page.waitForFunction(()=>Boolean(window.BAT_V2_CATALOG));
  const beforeCatalog=await page.evaluate(()=>({
   state:window.BAT_V2.getState(),quote:window.BAT_V2.getQuote()
  }));
  assert.equal(await page.evaluate(()=>window.BAT_V2_CATALOG.count()),60);
  assert.match(await page.locator('#catalog-count').innerText(),/60 de 60/);
  await page.locator('#catalog-family').selectOption('sanitarios');
  assert.match(await page.locator('#catalog-count').innerText(),/10 de 60/);
  await page.locator('#catalog-search').fill('Kitchenette 1,8 m');
  assert.match(await page.locator('#catalog-count').innerText(),/1 de 60/);
  await page.locator('#catalog-results .catalog-entry').first().click();
  assert.match(await page.locator('#catalog-detail').innerText(),/CAT-SAN-010/);
  assert.match(await page.locator('#catalog-detail').innerText(),/no coloca objetos 3D ni vincula costos o APU/i);
  const afterCatalog=await page.evaluate(()=>({
   state:window.BAT_V2.getState(),quote:window.BAT_V2.getQuote()
  }));
  assert.deepEqual(afterCatalog,beforeCatalog,'Browsing catalog cannot edit live model or costs');
  // Restore is explicit: reloading the page shows a clean project first.
  const backupState=await page.evaluate(()=>window.BAT_V2.getState());
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>Boolean(window.BAT_V2)&&Boolean(document.querySelector('#canvas canvas')));
  assert.equal((await page.evaluate(()=>window.BAT_V2.getState())).revision,0);
  assert.equal(await page.locator('#restore-local').isDisabled(),false);
  page.once('dialog',dialog=>dialog.accept());
  await page.locator('#restore-local').click();
  assert.deepEqual(await page.evaluate(()=>window.BAT_V2.getState()),backupState);
  // Explicit destruction and repeated reinit cannot duplicate renderer/listeners.
  await page.evaluate(()=>{window.BAT_V2.destroy();window.BAT_V2.reinit();window.BAT_V2.reinit();});
  await page.waitForFunction(()=>document.querySelectorAll('#canvas canvas').length===1);
  const revisionBeforeEdit=await page.evaluate(()=>window.BAT_V2.getRevision());
  await page.locator('#project-name').fill('Proyecto reabierto');
  await page.locator('#project-name').dispatchEvent('change');
  const afterEdit=await page.evaluate(()=>window.BAT_V2.getState());
  assert.equal(afterEdit.project.name,'Proyecto reabierto');
  assert.equal(afterEdit.revision,revisionBeforeEdit+1,'only one handler after reinitialization');
  // Corrupted backups must not permanently disable subsequent local saves.
  await page.evaluate(()=>localStorage.setItem('bat-cubikeitor-v2:project-backup:v1','{broken-json'));
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>Boolean(window.BAT_V2)&&Boolean(document.querySelector('#backup-status')));
  assert.match(await page.locator('#backup-status').innerText(),/Copia antigua inválida/);
  await page.locator('#project-name').fill('Copia recuperada');
  await page.locator('#project-name').dispatchEvent('change');
  assert.match(await page.locator('#backup-status').innerText(),/Copia local guardada/);
  assert.equal(await page.locator('#restore-local').isDisabled(),false);
  assert.deepEqual(errors,[],errors.join('\n'));
 }catch(error){
  if(page)await page.screenshot({path:'/tmp/bat-v2-browser-diagnostic.png',fullPage:true}).catch(()=>{});
  throw error;
 }finally{
  await browser?.close();
  await new Promise(resolve=>http.close(resolve));
 }
});
