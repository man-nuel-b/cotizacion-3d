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
      const choicePanel=page.locator('#bat-direct-face-choices');
      assert.equal(await choicePanel.isVisible(),true,'accessible selection panel must appear');
      assert.equal(await choicePanel.locator('button[data-face-choice]').count(),4,'all faces A-D should be available');
      assert.equal(await page.evaluate(()=>state.counts.window),initial.windows,'choose face before insertion');
      await choicePanel.locator('button[data-cancel-face]').click();
      assert.equal(await choicePanel.isVisible(),false,'cancel should hide the selector');
      assert.equal(await page.evaluate(()=>state.counts.window),initial.windows,'cancel must not create window');
      await addWindow.click({timeout:15000});
      assert.equal(await choicePanel.isVisible(),true,'selector must reopen');
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
        bomText:document.getElementById('bat-bom-content')?.textContent,
        selectionComplete:!faceSelectionActive
      }));
      assert.equal(after.windows,initial.windows+1);
      assert.equal(after.lastFace,'A');
      assert.ok(after.objects>=after.windows,'3D scene must have new window mesh');
      assert.equal(after.profile.quantity,(initial.profile?.quantity||0)+1);
      assert.ok(after.materials.withWaste>(initial.materials?.withWaste||0),'Supabase BOM must change');
      assert.ok(after.selectionComplete,'face picker must finish after clicking A marker');
      assert.match(after.panel||'',/Modelo 3D conectado/,'BOM must appear in the visible Extras step');
      assert.ok((after.bomText||'').includes('4,62'),'Visible BOM should include 4,62 m of reference steel with waste');
      // Simular móvil: el selector accesible no debe exigir precisión sobre letras 3D.
      await page.setViewportSize({width:390,height:844});
      await addWindow.click({timeout:15000});
      assert.equal(await choicePanel.isVisible(),true,'mobile panel should be visible');
      await choicePanel.locator('button[data-face-choice="B"]').click();
      await page.waitForFunction(n=>state.counts.window===n+2,initial.windows,{timeout:8000});
      const mobile=await page.evaluate(()=>({
        windows:state.counts.window,
        lastFace:state.layout.window[state.counts.window-1]?.face,
        objects:editableObjects.filter(x=>x.userData?.editor?.type==='window').length,
        bom:window.BAT_CUBIKEITOR_3D_SUPABASE.lastResult?.lines?.find(x=>x.sku==='EST-001')?.withWaste,
        panelVisible:!document.getElementById('bat-direct-face-choices')?.hidden
      }));
      assert.equal(mobile.windows,initial.windows+2);
      assert.equal(mobile.lastFace,'B');
      assert.ok(mobile.objects>=mobile.windows,'both windows must be present in 3D on mobile');
      assert.equal(mobile.bom,9.24,'two reference windows must recalculate 9.24 m of steel');
      assert.equal(mobile.panelVisible,false,'mobile choices should hide once inserted');
      console.log('BROWSER_MOBILE_SUCCESS',JSON.stringify(mobile));
      const openingSnapshot=await page.evaluate(()=>({
        openingFrame:DATA.extras?.openingFrame||null,
        variants:window.BAT_KUBIQUEITOR_OPENING_VARIANTS?.version||null,
        shell:window.BAT_KUBIQUEITOR_OPENING_SHELL?.version||null,
        engine:window.BAT_KUBIQUEITOR_WALL_MODULE_ENGINE?.version||null,
        definition:Boolean(window.wallModuleDefinition?.('openingFrame')),
        picker:typeof openMountedFacePicker
      }));
      console.log('BROWSER_OPENING_READINESS',JSON.stringify(openingSnapshot));
      assert.ok(openingSnapshot.openingFrame,'openingFrame must be registered in the catalog');
      const openingButton=page.locator('button[data-live-add="openingFrame"]');
      const dialogs=[];
      page.on('dialog',async dialog=>{dialogs.push(dialog.message());await dialog.accept();});
      await openingButton.click({timeout:10000});
      const openingChoice=page.locator('#bat-direct-face-choices');
      assert.ok(await openingChoice.isVisible(),'openingFrame should open A-D face choices; dialogs='+JSON.stringify(dialogs));
      assert.equal(dialogs.length,0,'No asynchronous initialization alert should appear');
      const initialOpenings=await page.evaluate(()=>state.counts.openingFrame||0);
      await openingChoice.locator('button[data-face-choice="C"]').click();
      await page.waitForFunction(n=>(state.counts.openingFrame||0)===n+1,initialOpenings,{timeout:8000});
      const openingPlaced=await page.evaluate(()=>({
        count:state.counts.openingFrame,
        lastFace:state.layout.openingFrame[state.counts.openingFrame-1]?.face,
        rendered:editableObjects.filter(x=>x.userData?.editor?.type==='openingFrame').length,
        panelHidden:document.getElementById('bat-direct-face-choices')?.hidden
      }));
      console.log('BROWSER_OPENING_PLACED',JSON.stringify(openingPlaced));
      assert.equal(openingPlaced.count,initialOpenings+1,'openingFrame count must increment exactly once');
      assert.equal(openingPlaced.lastFace,'C','opening must be inserted on chosen face C');
      assert.ok(openingPlaced.rendered>=openingPlaced.count,'opening needs actual editable 3D geometry');
      assert.equal(openingPlaced.panelHidden,true,'selector should close after opening insertion');

      // Auditoría exhaustiva del panel Extras; sesión y datos de proveedor simulados.
      const extrasAudit=[];
      for(const item of [
        {key:'door',face:'B'}, {key:'partition'}, {key:'wc'},
        {key:'sink'}, {key:'shower'}, {key:'electrical',face:'D'}, {key:'woodLining'}
      ]){
        const btn=page.locator('button[data-live-add="'+item.key+'"]');
        const result={key:item.key};
        try{
          result.button=await btn.count();
          if(result.button===0)throw new Error('No hay botón en panel de Extras');
          const before=await page.evaluate(key=>({
            count:state.counts[key]||0,
            wood:state.interiorSystem?.lining,
            elec:state.electrical?.points?.length,
            objects:editableObjects.filter(x=>x.userData?.editor?.type===key).length
          }),item.key);
          await btn.click({timeout:6000});
          const panel=page.locator('#bat-direct-face-choices');
          result.faceMenu=await panel.isVisible();
          if(item.face){
            if(!result.faceMenu)throw new Error('No aparece selector A-D');
            await panel.locator('button[data-face-choice="'+item.face+'"]').click({timeout:5000});
          }
          await page.waitForTimeout(200);
          const after=await page.evaluate(key=>({
            count:state.counts[key]||0,
            wood:state.interiorSystem?.lining,
            elec:state.electrical?.points?.length,
            objects:editableObjects.filter(x=>x.userData?.editor?.type===key).length,
            bomCodes:window.BAT_CUBIKEITOR_3D_SUPABASE.snapshot().items.map(x=>x.code),
            warnings:window.BAT_CUBIKEITOR_3D_SUPABASE.snapshot().warnings
          }),item.key);
          result.before=before;result.after=after;
          if(item.key==='woodLining'){
            result.ok=before.wood!==after.wood;
          }else{
            result.ok=after.count===before.count+1&&after.objects>=after.count;
          }
          if(item.key==='electrical')result.syncElectrical=after.elec===after.count;
          if(!result.ok)result.problem='Cantidad/objeto 3D no coinciden tras agregar';
        }catch(error){result.ok=false;result.problem=String(error).slice(0,400)}
        extrasAudit.push(result);
      }
      // Auditoría de funcionalidades que existen sólo en la lista heredada.
      const hiddenExtras=await page.evaluate(()=>({
        all:Object.keys(DATA.extras),
        quick:Array.from(document.querySelectorAll('button[data-live-add]')).map(x=>x.dataset.liveAdd),
        detail:Boolean(document.getElementById('bat-live-old-extras')),
        count:state.counts
      }));
      console.log('ALL_EXTRAS_AUDIT',JSON.stringify(extrasAudit));
      console.log('ALL_EXTRAS_COVERAGE',JSON.stringify(hiddenExtras));
      const failed=extrasAudit.filter(x=>!x.ok);
      assert.deepEqual(failed.map(x=>({key:x.key,problem:x.problem})),[],
        'Los extras deben actualizar contador, geometría y flujo previsto');
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
