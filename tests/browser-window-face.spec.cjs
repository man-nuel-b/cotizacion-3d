'use strict';
/**
 * Browser smoke test of production scripts under a locally served pruebas.html.
 * Auth and Supabase responses are mocked: no real credentials or database writes.
 */
const test=require('node:test');
const assert=require('node:assert/strict');
const {createServer}=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');

const root=path.resolve(__dirname,'..');
const assets={
 three:fs.readFileSync(require.resolve('three/build/three.min.js'),'utf8'),
 orbit:fs.readFileSync(path.join(path.dirname(require.resolve('three/package.json')),'examples/js/controls/OrbitControls.js'),'utf8')
};
function mockSupabaseSdk(){
 const uid='11111111-1111-4111-8111-111111111111';
 const org='22222222-2222-4222-8222-222222222222';
 const user={id:uid,email:'prueba-automatizada@example.invalid'};
 function data(table){
  if(table==='organization_members')return [{organization_id:org,role:'owner'}];
  if(table==='component_reference_bom')return [
   {component_code:'MOD-VENTANA',material_sku:'EST-001',material_name:'Perfil ventana',material_unit:'m',net_quantity_per_component:4.4,estimated_quantity_with_waste:4.62,technical_status:'pending'},
   {component_code:'MOD-PUERTA-EXT',material_sku:'ABR-002',material_name:'Puerta',material_unit:'un',net_quantity_per_component:1,estimated_quantity_with_waste:1,technical_status:'pending'}
  ];
  if(table==='apu_component_cost_summary')return [
   {code:'MOD-VENTANA',ready_for_direct_cost:false,direct_cost_net_clp:null,readiness_state:'technical_review_required'},
   {code:'MOD-PUERTA-EXT',ready_for_direct_cost:false,direct_cost_net_clp:null,readiness_state:'technical_review_required'}
  ];
  return [];
 }
 function query(table){
   return {
     select(){return this;},eq(){return this;},in(){return this;},
     order(){return this;},limit(){return this;},
     maybeSingle(){
       if(table==='organization_members')return Promise.resolve({data:{organization_id:org,role:'owner'},error:null});
       return Promise.resolve({data:null,error:null});
     },
     single(){return Promise.resolve({data:null,error:null})},
     then(resolve,reject){return Promise.resolve({data:data(table),error:null}).then(resolve,reject)}
   };
 }
 window.supabase={createClient(){return {
  auth:{
   getUser:async()=>({data:{user},error:null}),
   getSession:async()=>({data:{session:{user}},error:null}),
   onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),
   signOut:async()=>({error:null})
  },
  from:query
 }}};
}
const mockSupabase='('+mockSupabaseSdk.toString()+')();';
function server(){
  return createServer((req,res)=>{
    try{
      const pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
      const file=path.resolve(root,'.'+pathname);
      if(!file.startsWith(root+path.sep)) {res.writeHead(403);res.end('forbidden');return;}
      const content=fs.readFileSync(file);
      const ext=path.extname(file).toLowerCase();
      res.writeHead(200,{'Content-Type':ext==='.js'?'application/javascript':ext==='.css'?'text/css':ext==='.html'?'text/html':'application/octet-stream'});
      res.end(content);
    }catch(e){res.writeHead(404);res.end('not found');}
  });
}
test('Real app browser: Ventana -> click face A marker on 3D -> BOM update', {timeout:160000},async()=>{
  const http=server();
  await new Promise((resolve,reject)=>http.listen(0,'127.0.0.1',error=>error?reject(error):resolve()));
  let browser;
  try{
    browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage','--no-sandbox']});
    const page=await browser.newPage({viewport:{width:1440,height:900}});
    const browserErrors=[];
    page.on('pageerror',error=>browserErrors.push(error.stack||String(error)));
    page.on('console',message=>{if(message.type()==='error')browserErrors.push(message.text())});
    await page.route('**/*',async route=>{
      const u=route.request().url();
      if(u.includes('cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js'))return route.fulfill({status:200,contentType:'application/javascript',body:assets.three});
      if(u.includes('three@0.128.0/examples/js/controls/OrbitControls.js'))return route.fulfill({status:200,contentType:'application/javascript',body:assets.orbit});
      if(u.includes('supabase-js@2.118.0/dist/umd/supabase.min.js'))return route.fulfill({status:200,contentType:'application/javascript',body:mockSupabase});
      if(u.includes('cdn.tailwindcss.com'))return route.fulfill({status:200,contentType:'application/javascript',body:'/* test layout stub */'});
      if(u.startsWith('http://127.0.0.1:'))return route.continue();
      return route.abort();
    });
    await page.goto('http://127.0.0.1:'+http.address().port+'/pruebas.html',{waitUntil:'domcontentloaded'});
    try{
      await page.waitForFunction(()=>document.body.classList.contains('bat-preview-ready')&&document.querySelector('#canvas-container canvas'),null,{timeout:45000});
      await page.waitForTimeout(11000);
      await page.waitForFunction(()=>document.querySelector('button[data-live-add="window"]')&&typeof adjustCount==='function'&&window.BAT_CUBIKEITOR_3D_SUPABASE?.getState().connected,null,{timeout:30000});
      await page.addStyleTag({content:'.hidden{display:none!important}.flex{display:flex!important}.wizard-step{display:block}.wizard-step.hidden{display:none!important}#mounted-face-modal{display:none}#mounted-face-modal.flex{display:flex!important}#mounted-face-modal.hidden{display:none!important}'});
      await page.evaluate(()=>goStep(Number(document.getElementById('extras-list')?.closest('.wizard-step')?.dataset.step)||3));
      const initial=await page.evaluate(()=>({
        windows:state.counts.window,
        objects:editableObjects.filter(x=>x.userData?.editor?.type==='window').length,
        profile:window.BAT_CUBIKEITOR_3D_SUPABASE.snapshot().items.find(x=>x.code==='MOD-VENTANA'),
        materials:window.BAT_CUBIKEITOR_3D_SUPABASE.lastResult?.lines?.find(x=>x.sku==='EST-001')
      }));
      assert.ok(initial.windows>=0,'Initial count must not be negative');
      assert.ok(initial.objects>=initial.windows,'Initial window meshes missing');
      const addWindow=page.locator('button[data-live-add="window"]');
      await addWindow.click({timeout:15000});
      await page.waitForFunction(()=>faceSelectionActive&&faceTagObjects.some(x=>x.userData?.containerFace==='A'&&x.userData?.faceSelectable),null,{timeout:8000});
      const before=await page.evaluate(()=>state.counts.window);
      assert.equal(before,initial.windows,'Must not insert before choosing a face on the 3D');
      const facePoint=await page.evaluate(()=>{
        const tag=faceTagObjects.find(x=>x.userData?.containerFace==='A'&&x.userData?.faceSelectable);
        camera.updateMatrixWorld();containerGroup.updateMatrixWorld(true);
        const pos=tag.getWorldPosition(new THREE.Vector3()).project(camera);
        const rect=renderer.domElement.getBoundingClientRect();
        return {x:rect.left+(pos.x+1)*rect.width/2,y:rect.top+(1-pos.y)*rect.height/2,width:rect.width,height:rect.height};
      });
      console.log('BROWSER_FACE_TARGET',JSON.stringify(facePoint));
      await page.mouse.click(facePoint.x,facePoint.y);
      await page.waitForFunction(n=>state.counts.window===n+1,initial.windows,{timeout:8000});
      const after=await page.evaluate(()=>({
        windows:state.counts.window,
        lastFace:state.layout.window[state.counts.window-1]?.face,
        objects:editableObjects.filter(x=>x.userData?.editor?.type==='window').length,
        profile:window.BAT_CUBIKEITOR_3D_SUPABASE.snapshot().items.find(x=>x.code==='MOD-VENTANA'),
        materials:window.BAT_CUBIKEITOR_3D_SUPABASE.lastResult?.lines?.find(x=>x.sku==='EST-001'),
        panel:document.getElementById('bat-bom-status')?.textContent,
        selectionComplete:!faceSelectionActive
      }));
      assert.equal(after.windows,initial.windows+1);
      assert.equal(after.lastFace,'A');
      assert.ok(after.objects>=after.windows,'3D scene must have new window mesh');
      assert.equal(after.profile.quantity,(initial.profile?.quantity||0)+1);
      assert.ok(after.materials.withWaste>(initial.materials?.withWaste||0),'Supabase BOM must change');
      assert.ok(after.selectionComplete,'face picker must finish after clicking A marker');
      console.log('BROWSER_SMOKE_SUCCESS',JSON.stringify({initial,after,nonFatalBrowserErrors:browserErrors.slice(0,10)}));
    }catch(e){
      try{await page.screenshot({path:'/tmp/cubikeitor-window-smoke.png',fullPage:true});}catch{}
      const runtime=await page.evaluate(()=>({
        gateOpen:document.body.classList.contains('bat-preview-ready'),
        has3D:Boolean(document.querySelector('#canvas-container canvas')),
        selector:Boolean(document.getElementById('mounted-face-modal')),
        bridgeLoaded:Boolean(window.BAT_CUBIKEITOR_3D_SUPABASE),
        bridgeState:window.BAT_CUBIKEITOR_3D_SUPABASE?.getState?.(),
        panel:Boolean(document.getElementById('bat-supabase-bom')),
        windowCount:typeof state!=='undefined'?state.counts.window:null,
        extrasPresent:Boolean(document.getElementById('extras-list')?.children.length),
        extrasStep:document.getElementById('extras-list')?.closest('.wizard-step')?.dataset.step,
        liveButton:Boolean(document.querySelector('button[data-live-add="window"]')),
        wizardSteps:Array.from(document.querySelectorAll('.wizard-step')).map(x=>x.dataset.step),
        editorInstalled:typeof editorInstalled!=='undefined'?editorInstalled:null
      })).catch(err=>({evaluationError:String(err)}));
      console.error('BROWSER_DIAGNOSTIC',JSON.stringify({error:String(e),errors:browserErrors.slice(0,8),runtime,pageTitle:await page.title()}));
      throw e;
    }finally{await page.close();}
  }finally{
    if(browser)await browser.close();
    await new Promise(resolve=>http.close(resolve));
  }
});
