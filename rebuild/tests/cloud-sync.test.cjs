'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Cloud=require('../core/cloud-sync');
const State=require('../core/project-state');
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};
test('Three rapid edits while cloud write is pending save latest revision in strict order',async()=>{
 const store=State.createStore(),writes=[];
 const gate=deferred();
 let remote={version:1,project:store.getState()};
 const sync=Cloud.create({
  getSnapshot:()=>store.getState(),initialVersion:1,
  writeRemote:async request=>{
   writes.push({revision:request.revision,expectedVersion:request.expectedVersion});
   if(writes.length===1)await gate.promise;
   if(request.expectedVersion!==remote.version)throw new Error('conflict');
   remote={version:remote.version+1,project:request.project};
   return {version:remote.version};
  }
 });
 const first=sync.save(),second=sync.save();
 assert.equal(first,second,'parallel calls share the same in-flight queue');
 assert.equal(sync.isSaving(),true);
 for(let i=0;i<3;i++)store.dispatch({type:'pricing/update',key:'transport',value:100+i});
 gate.resolve();
 assert.equal(await first,true);
 assert.equal(sync.isSaving(),false);
 assert.deepEqual(writes,[{revision:0,expectedVersion:1},{revision:3,expectedVersion:2}]);
 assert.equal(remote.project.pricing.transport,102);
 assert.equal(remote.project.revision,3);
 assert.equal(sync.getVersion(),3);
});
test('An imported project with the same revision still triggers a second save',async()=>{
 const store=State.createStore(),gate=deferred(),written=[];
 let version=1;
 const sync=Cloud.create({
  getSnapshot:()=>store.getState(),initialVersion:1,
  writeRemote:async input=>{
   written.push(input.project.project.name);
   if(written.length===1)await gate.promise;
   assert.equal(input.expectedVersion,version);
   return {version:++version};
  }
 });
 const saving=sync.save();
 const replacement=store.getState();
 replacement.project.name='Proyecto importado';
 store.dispatch({type:'project/replace',project:replacement});
 gate.resolve();
 await saving;
 assert.deepEqual(written,['Proyecto modular','Proyecto importado']);
 assert.equal(sync.getVersion(),3);
});
test('Optimistic version conflict prevents silent overwrite and preserves state',async()=>{
 const store=State.createStore(),before=store.getState();
 const sync=Cloud.create({
  getSnapshot:()=>store.getState(),initialVersion:3,
  writeRemote:async({expectedVersion})=>{
   assert.equal(expectedVersion,3);
   throw new Error('conflict: version changed');
  }
 });
 await assert.rejects(sync.save(),/conflict/);
 assert.deepEqual(store.getState(),before);
 assert.equal(sync.getVersion(),3);
 assert.equal(sync.isSaving(),false);
});
test('Opening stale cloud data while local work changes never overwrites local edits',async()=>{
 const store=State.createStore(),gate=deferred();let applied=false;
 const sync=Cloud.create({
  getSnapshot:()=>store.getState(),
  writeRemote:async()=>({version:1}),
  readRemote:async()=>{await gate.promise;return {project:State.defaults(),version:4};},
  applyRemote:remote=>{applied=true;store.dispatch({type:'project/replace',project:remote});}
 });
 const loading=sync.load();
 store.dispatch({type:'project/rename',name:'Edición no guardada'});
 gate.resolve();
 await assert.rejects(loading,/cambió durante la descarga/);
 assert.equal(applied,false);
 assert.equal(store.getState().project.name,'Edición no guardada');
});
test('Cloud loading rejects invalid version and unauthenticated adapter behavior',async()=>{
 const store=State.createStore();
 const sync=Cloud.create({
  getSnapshot:()=>store.getState(),
  writeRemote:async()=>({version:1}),
  readRemote:async()=>({project:State.defaults(),version:null}),
  applyRemote:remote=>store.dispatch({type:'project/replace',project:remote})
 });
 await assert.rejects(sync.load(),/versión válida/);
 assert.equal(store.getState().revision,0);
});
test('Remote opens are blocked during save',async()=>{
 const store=State.createStore(),gate=deferred();
 const sync=Cloud.create({
  getSnapshot:()=>store.getState(),initialVersion:1,
  writeRemote:async()=>{await gate.promise;return {version:2};},
  readRemote:async()=>({version:2,project:State.defaults()}),
  applyRemote:remote=>store.dispatch({type:'project/replace',project:remote})
 });
 const saving=sync.save();
 await assert.rejects(sync.load(),/durante un guardado/);
 gate.resolve();
 await saving;
});

test('Carga remota bloquea simultáneamente guardados y segundas cargas',async()=>{
 const store=State.createStore(),gate=deferred();
 let reads=0,applied=0;
 const sync=Cloud.create({
  getSnapshot:()=>store.getState(),initialVersion:1,
  writeRemote:async()=>{throw Error('No debió guardar');},
  readRemote:async()=>{reads++;await gate.promise;return {version:2,project:State.defaults()};},
  applyRemote:p=>{applied++;store.dispatch({type:'project/replace',project:p});}
 });
 const opening=sync.load();
 assert.equal(sync.isLoading(),true);
 await assert.rejects(sync.save(),/mientras se abre/);
 await assert.rejects(sync.load(),/carga remota en curso/);
 assert.equal(reads,1);
 assert.equal(applied,0);
 gate.resolve();
 assert.equal(await opening,true);
 assert.equal(sync.isLoading(),false);
 assert.equal(sync.getVersion(),2);
 assert.equal(applied,1);
});
test('Una carga fallida libera el bloqueo para poder reintentar',async()=>{
 const store=State.createStore();
 let calls=0;
 const sync=Cloud.create({
  getSnapshot:()=>store.getState(),initialVersion:1,
  writeRemote:async()=>({version:2}),
  readRemote:async()=>{calls++;if(calls===1)throw Error('network offline');return {version:2,project:State.defaults()};},
  applyRemote:p=>store.dispatch({type:'project/replace',project:p})
 });
 await assert.rejects(sync.load(),/network offline/);
 assert.equal(sync.isLoading(),false);
 assert.equal(await sync.load(),true);
 assert.equal(sync.getVersion(),2);
});
test('Error de validación al aplicar un proyecto remoto conserva la versión anterior',async()=>{
 const store=State.createStore(),before=store.getState();
 const bad=State.defaults();bad.project.container.length=0;
 const sync=Cloud.create({
  getSnapshot:()=>store.getState(),initialVersion:4,
  writeRemote:async()=>({version:5}),
  readRemote:async()=>({version:5,project:bad}),
  applyRemote:p=>store.dispatch({type:'project/replace',project:p})
 });
 await assert.rejects(sync.load(),/inválido/);
 assert.deepEqual(store.getState(),before);
 assert.equal(sync.getVersion(),4);
 assert.equal(sync.isLoading(),false);
});

test('Adaptador de aplicación asíncrono no puede sustituir el proyecto mientras carga',async()=>{
 const store=State.createStore(),before=store.getState();
 let reads=0,applies=0;
 const sync=Cloud.create({
  getSnapshot:()=>store.getState(),initialVersion:1,
  writeRemote:async()=>({version:2}),
  readRemote:async()=>{reads++;return {version:2,project:State.defaults()};},
  applyRemote:async p=>{applies++;store.dispatch({type:'project/replace',project:p});}
 });
 await assert.rejects(sync.load(),/síncrona y atómica/);
 assert.equal(reads,0);
 assert.equal(applies,0);
 assert.deepEqual(store.getState(),before);
 assert.equal(sync.isLoading(),false);
});
