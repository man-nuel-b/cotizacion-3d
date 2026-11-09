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
 function mockRecords(){
   try{return JSON.parse(localStorage.getItem('__cubikeitor_mock_cloud_projects')||'[]');}
   catch(_){return [];}
 }
 function setMockRecords(records){
   localStorage.setItem('__cubikeitor_mock_cloud_projects',JSON.stringify(records));
 }
 function query(table){
   const filters={};let mode='select',values=null,limit=null;
   function execute(){
     if(table==='organization_members')
       return {data:[{organization_id:org,role:'owner'}],error:null};
     if(table!=='projects')return {data:data(table),error:null};
     let rows=mockRecords();
     const matches=p=>Object.entries(filters).every(([key,value])=>p[key]===value);
     if(mode==='insert'){
       const newRow={
         ...JSON.parse(JSON.stringify(values)),
         id:'00000000-0000-4000-8000-'+String(rows.length+1).padStart(12,'0'),
         status:'draft',version:values.version||1,
         updated_at:new Date().toISOString()
       };
       rows.push(newRow);setMockRecords(rows);
       return {data:[newRow],error:null};
     }
     if(mode==='update'){
       const touched=rows.filter(matches);
       for(const row of touched){
         Object.assign(row,JSON.parse(JSON.stringify(values)),{updated_at:new Date().toISOString()});
       }
       if(touched.length)setMockRecords(rows);
       return {data:touched,error:null};
     }
     rows=rows.filter(matches);
     return {data:limit===null?rows:rows.slice(0,limit),error:null};
   }
   return {
     select(){return this;},
     eq(key,value){filters[key]=value;return this;},
     in(){return this;},
     order(){return this;},
     limit(n){limit=n;return this;},
     update(payload){mode='update';values=payload;return this;},
     insert(payload){mode='insert';values=payload;return this;},
     maybeSingle(){const x=execute();return Promise.resolve({...x,data:x.data[0]||null});},
     single(){const x=execute();return Promise.resolve({...x,data:x.data[0]||null});},
     then(resolve,reject){return Promise.resolve(execute()).then(resolve,reject);}
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
      assert.equal(await choicePanel.evaluate(el=>el.parentElement===document.body),true,
        'The face chooser must remain outside scrollable 3D scene containers');
      assert.equal(await choicePanel.evaluate(el=>getComputedStyle(el).position),'fixed',
        'A-D chooser must stay fixed while Extras and the 3D scene rerender');
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
      await page.waitForFunction(()=>{const p=document.getElementById('bat-direct-face-choices');
        return p&&!p.hidden;},null,{timeout:45000});
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
      // Auditoría del panel único: las variantes también deben instalarse desde el menú principal.
      const hiddenExtras=await page.evaluate(()=>({
        all:Object.keys(DATA.extras),
        quick:Array.from(document.querySelectorAll('button[data-live-add]')).map(x=>x.dataset.liveAdd),
        detail:Boolean(document.getElementById('bat-live-old-extras')),
        count:state.counts
      }));
      console.log('ALL_EXTRAS_AUDIT',JSON.stringify(extrasAudit));
      console.log('ALL_EXTRAS_COVERAGE',JSON.stringify(hiddenExtras));
      assert.deepEqual(hiddenExtras.all.filter(k=>!hiddenExtras.quick.includes(k)),[],
        'Todos los Extras del catálogo deben estar disponibles en el panel rápido');
      const legacyAudit=[];
      const legacyToggle=page.locator('#bat-live-old-extras summary');
      if(await legacyToggle.count() && !(await page.locator('#bat-live-old-extras').evaluate(el=>el.open))){
        await legacyToggle.click();
      }
      for(const item of [
        {key:'ac',face:'D'},{key:'opening',face:'D'},
        {key:'windowOpening',face:'A'},{key:'windowOpeningFrame',face:'B'}
      ]){
        const row={key:item.key};
        try{
          const btn=page.locator('#bat-live-controls button[data-live-add="'+item.key+'"]');
          row.button=await btn.count();
          if(!row.button)throw new Error('Extra no disponible en el panel unificado');
          const before=await page.evaluate(key=>state.counts[key]||0,item.key);
          await btn.click({timeout:6000});
          const choices=page.locator('#bat-direct-face-choices');
          row.choices=await choices.isVisible();
          if(row.choices)await choices.locator('button[data-face-choice="'+item.face+'"]').click({timeout:6000});
          await page.waitForTimeout(250);
          row.result=await page.evaluate(key=>({
            count:state.counts[key]||0,
            objects:editableObjects.filter(x=>x.userData?.editor?.type===key).length
          }),item.key);
          row.ok=row.result.count===before+1&&row.result.objects>=row.result.count;
          if(!row.ok)row.problem='Extra count or 3D geometry mismatch';
        }catch(error){row.ok=false;row.problem=String(error).slice(0,500)}
        legacyAudit.push(row);
      }
      console.log('UNIFIED_EXTRAS_VARIANTS_AUDIT',JSON.stringify(legacyAudit));
      assert.deepEqual(legacyAudit.filter(x=>!x.ok).map(x=>x.key+':'+x.problem),[],
        'Todas las variantes del catálogo deben funcionar desde el único panel Extras');
      const technicalTools=await page.evaluate(()=>({
        legacyVisible:[...document.querySelectorAll('#extras-list > [data-legacy-extra-key]')]
          .filter(el=>getComputedStyle(el).display!=='none').length,
        bathrooms:Boolean(document.querySelector('[data-bathroom-module-section]')),
        electrical:Boolean(document.getElementById('electrical-stage1-panel')),
        circuit:Boolean(document.getElementById('bat-electrical-circuits')),
        detailsOpen:Boolean(document.getElementById('bat-live-old-extras')?.open)
      }));
      console.log('EXTRAS_TECHNICAL_TOOLS',JSON.stringify(technicalTools));
      assert.equal(technicalTools.legacyVisible,0,'Los contadores antiguos duplicados deben estar ocultos');
      assert.equal(technicalTools.bathrooms,true,'Los baños prearmados no deben desaparecer');
      assert.equal(technicalTools.electrical,true,'Los controles eléctricos tipificados deben continuar accesibles');
      assert.equal(technicalTools.circuit,true,'La asignación de circuitos no debe desaparecer');
      const electricalDeletion=await page.evaluate(()=>{
        const ui=window.BAT_KUBIQUEITOR_ELECTRICAL_UI_STAGE1;
        if(!ui)return {issue:'Electrical UI not initialized'};
        ui.add('light');
        ui.add('switch');
        const before=state.electrical?.points?.map(x=>x.type);
        const beforeCount=state.counts.electrical;
        selectedEditable={type:'electrical',index:0};
        deleteSelectedObject();
        const immediate=state.electrical?.points?.map(x=>x.type);
        return {before,beforeCount,afterCount:state.counts.electrical,immediate,expected:before.slice(1)};
      });
      await page.waitForTimeout(400);
      electricalDeletion.after=await page.evaluate(()=>({
        count:state.counts.electrical,
        types:state.electrical?.points?.map(x=>x.type),
        objects:editableObjects.filter(x=>x.userData?.editor?.type==='electrical').length
      }));
      electricalDeletion.correct=JSON.stringify(electricalDeletion.after.types)===JSON.stringify(electricalDeletion.expected);
      console.log('ELECTRICAL_DELETE_AUDIT',JSON.stringify(electricalDeletion));
      assert.equal(electricalDeletion.correct,true,
        'Eliminar un punto eléctrico debe preservar la identidad y tipo de los restantes');
      const afterDelete=electricalDeletion.after.types.slice();
      const afterUndo=await page.evaluate(()=>{undo();return state.electrical?.points?.map(p=>p.type)});
      assert.deepEqual(afterUndo,electricalDeletion.before,'Deshacer debe recuperar los puntos eléctricos originales');
      const afterRedo=await page.evaluate(()=>{redo();return state.electrical?.points?.map(p=>p.type)});
      assert.deepEqual(afterRedo,afterDelete,'Rehacer debe restaurar exactamente el borrado anterior');
      const pricePanel=await page.evaluate(()=>({
        text:document.getElementById('bat-live-price')?.textContent?.slice(0,750),
        source:'live-project-client-v1.js legacy calculate()'
      }));
      console.log('EXTRAS_PRICE_PANEL_AUDIT',JSON.stringify(pricePanel));
      assert.ok(!/Último cambio:\\s*[+−-]?\\s*\\$/.test(pricePanel.text||''),
        'No se deben presentar incrementos de precios de prueba como importes comerciales');
      const editAudit=await page.evaluate(()=>{
        const types=['window','door','openingFrame','windowOpening','windowOpeningFrame',
          'partition','wc','sink','shower','ac','electrical'];
        return types.map(type=>{
          try{
            const obj=editableObjects.find(x=>x.userData?.editor?.type===type);
            if(!obj)return {type,error:'Sin objeto editable registrado'};
            selectEditable(obj);
            const editor=document.getElementById('object-editor');
            const dims=document.getElementById('dimension-editor');
            return {type,index:obj.userData.editor.index,
              selected:selectedEditable?.type,
              editorVisible:!!editor&&!editor.classList.contains('hidden'),
              dimensionVisible:!!dims&&!dims.classList.contains('hidden'),
              dimensionInputs:dims?.querySelectorAll('input').length||0,
              selectedFace:actualLayout(type,obj.userData.editor.index)?.face||null};
          }catch(error){return {type,error:String(error)}}
        });
      });
      console.log('EXTRAS_EDIT_AUDIT',JSON.stringify(editAudit));
      const editableTypes=['window','door','openingFrame','windowOpening','windowOpeningFrame','partition','sink','shower','ac'];
      assert.deepEqual(editAudit.filter(x=>editableTypes.includes(x.type)
        &&(x.error||!x.editorVisible||!x.dimensionVisible)).map(x=>x.type),[],
        'Los componentes paramétricos deben abrir un editor con dimensiones');
      const collisionAudit=await page.evaluate(()=>{
        const windowPos=actualLayout('window',0),dims=objectDimensions('window',0);
        return {windowPos,width:dims.width,
          openingFrameCanOverlap:validCandidate('openingFrame',state.counts.openingFrame||0,{face:windowPos.face,x:windowPos.x}),
          windowCanOverlap:validCandidate('window',state.counts.window||0,{face:windowPos.face,x:windowPos.x})};
      });
      console.log('EXTRAS_COLLISION_AUDIT',JSON.stringify(collisionAudit));
      assert.equal(collisionAudit.windowCanOverlap,false,'Ventanas no deben solaparse');
      assert.equal(collisionAudit.openingFrameCanOverlap,false,'Vano y ventana no deben solaparse');
      
      // El panel único también debe permitir quitar sin borrar otros objetos.
      const beforeRemove=await page.evaluate(()=>({
        count:state.counts.window,
        ids:state.layout.window.map(p=>p.face),
        objectCount:editableObjects.filter(x=>x.userData?.editor?.type==='window').length
      }));
      const minus=page.locator('#bat-live-controls button[data-live-remove="window"]');
      assert.equal(await minus.isDisabled(),false,'Debe existir el botón quitar para las ventanas instaladas');
      await minus.click();
      await page.waitForFunction(n=>state.counts.window===n-1,beforeRemove.count,{timeout:7000});
      const afterRemove=await page.evaluate(()=>({
        count:state.counts.window,
        faces:state.layout.window.map(p=>p.face),
        objectCount:editableObjects.filter(x=>x.userData?.editor?.type==='window').length
      }));
      assert.equal(afterRemove.count,beforeRemove.count-1,'Quitar debe decrementar exactamente un objeto');
      assert.deepEqual(afterRemove.faces,beforeRemove.ids.slice(0,-1),'Quitar debe conservar las caras previas');
      assert.equal(afterRemove.objectCount,afterRemove.count,'La escena 3D debe actualizarse');
      await page.evaluate(()=>undo());
      assert.equal(await page.evaluate(()=>state.counts.window),beforeRemove.count,'Deshacer debe restaurar la ventana');
      await page.evaluate(()=>redo());
      assert.equal(await page.evaluate(()=>state.counts.window),afterRemove.count,'Rehacer debe volver a quitarla');
      console.log('EXTRAS_UNIFIED_REMOVE',JSON.stringify({beforeRemove,afterRemove}));

      const failed=extrasAudit.filter(x=>!x.ok);
      assert.deepEqual(failed.map(x=>({key:x.key,problem:x.problem})),[],
        'Los extras deben actualizar contador, geometría y flujo previsto');

      // Prueba de recuperación real: guardar una configuración compleja y recargar toda la aplicación.
      const beforeReload=await page.evaluate(()=>{
        const all=Object.keys(DATA.extras);
        const fresh=clone(DEFAULT_STATE);
        for(const key of all)fresh.counts[key]=0;
        fresh.counts.window=1;fresh.counts.door=1;fresh.counts.partition=1;
        fresh.counts.wc=1;fresh.counts.sink=1;fresh.counts.electrical=2;
        fresh.layout={
          window:[{face:'A',x:-1.35}],
          door:[{face:'B',x:.65}],
          partition:[{orientation:PARTITION_ORIENTATION.CROSS,x:.75,z:0}],
          wc:[{x:-2.1,z:.75}],sink:[{x:-1.05,z:.7}],
          electrical:[{face:'A',x:1.2},{face:'D',x:-.2}]
        };
        fresh.dimensions={
          window:[{width:1.35,height:1.1}],
          door:[{width:.95,height:2.15}],
          partition:[{length:1.75,height:2.3,thickness:.075}],
          sink:[{width:.62,height:.9,depth:.52}]
        };
        fresh.electrical={version:1,points:[
          {id:'EL-SAVE-A',type:'outlet',circuit:'Enchufes',face:'A',position:{x:1.2,z:0},height:1.1},
          {id:'EL-SAVE-B',type:'light',circuit:'Iluminación',face:'D',position:{x:-.2,z:0},height:2.4}
        ]};
        fresh.bathroomModules=[{kind:'full',x:1.5,z:-.3,rotation:90}];
        fresh.interiorSystem={...(state.interiorSystem||{}),lining:'plywood'};
        fresh.projectMeta={id:'BK-ROUNDTRIP-3D',revision:4,title:'Prueba de recuperación'};
        fresh.customer={...fresh.customer,name:'Prueba guardar y abrir'};
        state=fresh;
        renderAll();
        const saved=persistLocalProject({silent:true});
        const snap=window.BAT_CUBIKEITOR_PROJECT_PERSISTENCE.encode(state,DEFAULT_STATE,DATA);
        const plan=window.BAT_CUBIKEITOR_3D_SUPABASE.buildPlan(state,DATA);
        return {
          saved,
          projectMeta:state.projectMeta,
          critical:{
            counts:state.counts,layout:state.layout,dimensions:state.dimensions,
            bathroomModules:state.bathroomModules,electrical:state.electrical,
            interiorSystem:state.interiorSystem,customer:state.customer
          },
          plan:plan.items.map(i=>({code:i.code,quantity:i.quantity})),
          storageValid:localStorage.getItem('modular-config-v4')!==null,
          renderedWindows:editableObjects.filter(x=>x.userData?.editor?.type==='window').length
        };
      });
      assert.equal(beforeReload.saved,true,'complete local snapshot must be saved');
      assert.equal(beforeReload.storageValid,true,'v4 backup must exist');
      assert.equal(beforeReload.renderedWindows,1,'3D must render saved window before reload');
      await page.reload({waitUntil:'domcontentloaded'});
      await page.waitForFunction(()=>document.body.classList.contains('bat-preview-ready')
        &&document.querySelector('#canvas-container canvas')
        &&typeof state!=='undefined'&&state.projectMeta?.id==='BK-ROUNDTRIP-3D',
        null,{timeout:50000});
      await page.waitForFunction(()=>window.BAT_CUBIKEITOR_3D_SUPABASE?.buildPlan
        &&editableObjects.filter(x=>x.userData?.editor?.type==='window').length===1,
        null,{timeout:50000});
      const afterReload=await page.evaluate(()=>{
        const plan=window.BAT_CUBIKEITOR_3D_SUPABASE.buildPlan(state,DATA);
        return {
          projectMeta:state.projectMeta,
          critical:{
            counts:state.counts,layout:state.layout,dimensions:state.dimensions,
            bathroomModules:state.bathroomModules,electrical:state.electrical,
            interiorSystem:state.interiorSystem,customer:state.customer
          },
          plan:plan.items.map(i=>({code:i.code,quantity:i.quantity})),
          renderedWindows:editableObjects.filter(x=>x.userData?.editor?.type==='window').length,
          renderedDoors:editableObjects.filter(x=>x.userData?.editor?.type==='door').length,
          renderedPartitions:editableObjects.filter(x=>x.userData?.editor?.type==='partition').length
        };
      });
      assert.deepEqual(afterReload.critical,beforeReload.critical,
        'All positions, dimensions, bathroom modules and electrical identities must survive full reload');
      assert.deepEqual(afterReload.plan,beforeReload.plan,
        'Technical material quantities must match before and after reopening');
      assert.equal(afterReload.projectMeta.id,beforeReload.projectMeta.id,
        'Project identity must remain stable when reopened');
      assert.equal(afterReload.renderedWindows,1);
      assert.equal(afterReload.renderedDoors,1);
      assert.equal(afterReload.renderedPartitions,1);
      console.log('PROJECT_LOCAL_ROUNDTRIP_SUCCESS',JSON.stringify({
        before:beforeReload.critical.counts,after:afterReload.critical.counts,
        id:afterReload.projectMeta.id,materials:afterReload.plan.length
      }));

      // Simular la nube con registros ficticios: nunca se envían datos reales a Supabase.
      await page.waitForFunction(()=>window.BAT_KUBIQUEITOR_SUPABASE_CLOUD?.version===3,
        null,{timeout:30000});
      const cloudRoundtrip=await page.evaluate(async()=>{
        const api=window.BAT_KUBIQUEITOR_SUPABASE_CLOUD;
        const first=await api.save();
        const projectsBefore=JSON.parse(localStorage.getItem('__cubikeitor_mock_cloud_projects')||'[]');
        const originalRemote=projectsBefore[0]?.id;
        const originalLocal=state.projectMeta.id;
        const copy=api.copyProject();
        const second=await api.save();
        const projectsAfter=JSON.parse(localStorage.getItem('__cubikeitor_mock_cloud_projects')||'[]');
        const copyRemote=api.getLinkedId();
        const reopened=await api.openProject(originalRemote);
        const recovered=JSON.parse(JSON.stringify(state));
        return {
          first,second,reopened,copy,
          originalRemote,copyRemote,originalLocal,
          projectCount:projectsAfter.length,
          restoredId:recovered.projectMeta.id,
          restoredLayout:recovered.layout,
          restoredDimensions:recovered.dimensions,
          restoredElectrical:recovered.electrical,
          restoredBathrooms:recovered.bathroomModules,
          originalRemoteVersion:projectsAfter[0].version,
          copyVersion:projectsAfter[1].version
        };
      });
      assert.equal(cloudRoundtrip.first,true,'First cloud save must be confirmed');
      assert.equal(cloudRoundtrip.second,true,'Save as new copy must be confirmed');
      assert.equal(cloudRoundtrip.projectCount,2,'Copy action must INSERT, never overwrite original record');
      assert.notEqual(cloudRoundtrip.originalRemote,cloudRoundtrip.copyRemote);
      assert.notEqual(cloudRoundtrip.copy.current,cloudRoundtrip.copy.previous);
      assert.equal(cloudRoundtrip.reopened,true,'Original cloud project must reopen successfully');
      assert.equal(cloudRoundtrip.restoredId,cloudRoundtrip.originalLocal);
      assert.deepEqual(cloudRoundtrip.restoredLayout,beforeReload.critical.layout);
      assert.deepEqual(cloudRoundtrip.restoredDimensions,beforeReload.critical.dimensions);
      assert.deepEqual(cloudRoundtrip.restoredElectrical,beforeReload.critical.electrical);
      assert.deepEqual(cloudRoundtrip.restoredBathrooms,beforeReload.critical.bathroomModules);
      const conflict=await page.evaluate(async()=>{
        const api=window.BAT_KUBIQUEITOR_SUPABASE_CLOUD;
        const rows=JSON.parse(localStorage.getItem('__cubikeitor_mock_cloud_projects'));
        const previousVersion=rows[0].version;
        rows[0].version=previousVersion+1; // Simula guardado en otra sesión.
        rows[0].name='Revisión de otro usuario';
        localStorage.setItem('__cubikeitor_mock_cloud_projects',JSON.stringify(rows));
        state.customer.name='Cambio local que no puede pisar otro guardado';
        const saved=await api.save();
        const after=JSON.parse(localStorage.getItem('__cubikeitor_mock_cloud_projects'));
        return {saved,version:after[0].version,name:after[0].name,
          localVersion:localStorage.getItem('modular-config-v4')!==null};
      });
      assert.equal(conflict.saved,false,'Optimistic lock must block stale cloud overwrite');
      assert.equal(conflict.name,'Revisión de otro usuario');
      assert.equal(conflict.localVersion,true,'Conflicted edits must remain recoverable locally');
      const corruptCloud=await page.evaluate(async()=>{
        const api=window.BAT_KUBIQUEITOR_SUPABASE_CLOUD;
        const rows=JSON.parse(localStorage.getItem('__cubikeitor_mock_cloud_projects'));
        rows[0].project_state.counts.window='valor-dañado';
        localStorage.setItem('__cubikeitor_mock_cloud_projects',JSON.stringify(rows));
        const before=JSON.stringify(state);
        const localBefore=localStorage.getItem('modular-config-v4');
        const opened=await api.openProject(rows[0].id);
        return {opened,keptState:JSON.stringify(state)===before,
          keptLocal:localStorage.getItem('modular-config-v4')===localBefore};
      });
      assert.equal(corruptCloud.opened,false,'Corrupt cloud payload must be rejected');
      assert.equal(corruptCloud.keptState,true,'Invalid cloud load must not replace current state');
      assert.equal(corruptCloud.keptLocal,true,'Invalid cloud load must not overwrite local recovery');
      console.log('PROJECT_CLOUD_RECOVERY_SUCCESS',JSON.stringify({
        copies:cloudRoundtrip.projectCount,
        originalRestored:cloudRoundtrip.reopened,
        versionConflictBlocked:!conflict.saved,
        corruptPayloadBlocked:!corruptCloud.opened
      }));

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
