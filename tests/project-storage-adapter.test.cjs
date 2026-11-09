'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const core=require('../project-persistence-core.js');
const app=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
const start=app.indexOf('let projectAutosaveEnabled=false,projectAutosaveTimer=null;');
const end=app.indexOf('function resetProject()',start);
assert.ok(start>=0&&end>start,'local project persistence adapter must be present');
const src=app.slice(start,end);
const defaults={
  container:'20hc',solution:'office',finish:'standard',
  counts:{window:0,electrical:0},customer:{name:''}
};
const data={
  containers:{'20hc':{length:6.06,width:2.44,height:2.89}},
  solutions:{office:{name:'Oficina'}},finishes:{standard:{name:'Estándar'}}
};
const testProject=()=>({
  ...defaults,counts:{window:1,electrical:0},
  layout:{window:[{face:'B',x:1.1}]},
  dimensions:{window:[{width:1.2,height:1.05}]},
  customer:{name:'Respaldo anterior'},projectMeta:{id:'BK-RESTORE-TEST',revision:0}
});
function setup(seed={},denied=false){
 const files=new Map(Object.entries(seed));
 const notices=[],errors=[];
 const store={
   getItem(key){return files.get(key)||null;},
   setItem(key,value){if(denied)throw Error('Storage blocked');writes++;files.set(key,String(value));},
   removeItem(key){files.delete(key)}
 };
 let timeoutFn,timerSchedules=0,writes=0;
 const context={
   window:{BAT_CUBIKEITOR_PROJECT_PERSISTENCE:core},
   localStorage:store,DEFAULT_STATE:defaults,DATA:data,
   state:testProject(),
   console:{error(...args){errors.push(args)},warn(...args){errors.push(args)}},
   toast(msg){notices.push(msg)},
   clearTimeout(){},setTimeout(fn){timerSchedules++;timeoutFn=fn;return 1}
 };
 vm.runInNewContext(src+'\nthis.adapter={saveProject,loadProject,scheduleProjectAutosave,flushProjectAutosave,local:()=>persistLocalProject({silent:true}),enabled:()=>projectAutosaveEnabled};',context);
 return {files,notices,errors,context,adapter:context.adapter,runTimer(){timeoutFn?.()},
   get timerSchedules(){return timerSchedules;},get writes(){return writes;}};
}
test('Damaged v4 is quarantined before restoring legacy and cannot silently disappear',()=>{
 const validLegacy=JSON.stringify(testProject()),damaged='{"format":"cubikeitor-project","project":"broken"}';
 const x=setup({'modular-config-v4':damaged,'modular-config-v3':validLegacy});
 assert.equal(x.adapter.loadProject(),true);
 assert.equal(x.context.state.layout.window[0].x,1.1);
 assert.equal(x.files.get('modular-config-damaged-v4'),damaged);
 assert.equal(x.adapter.local(),true);
 assert.notEqual(x.files.get('modular-config-v4'),damaged);
 assert.equal(x.files.get('modular-config-damaged-v4'),damaged);
});
test('All invalid backups block autosave so editing does not destroy the recoverable original',()=>{
 const damaged='{broken-raw';
 const x=setup({'modular-config-v4':damaged,'modular-config-v3':'{broken'});
 assert.equal(x.adapter.loadProject(),false);
 assert.equal(x.adapter.enabled(),false);
 x.adapter.scheduleProjectAutosave();
 x.runTimer();
 assert.equal(x.files.get('modular-config-v4'),damaged);
 assert.equal(x.files.get('modular-config-damaged-v4'),damaged);
});
test('Storage quota/security failures are reported and never claimed as saved',()=>{
 const x=setup({},true);
 assert.equal(x.adapter.saveProject(),false);
 assert.equal(x.notices.some(t=>t.includes('No se pudo guardar')),true);
 assert.equal(x.files.size,0);
});
test('Cloud global handler replacement cannot hijack local autosave',()=>{
 const x=setup({});
 x.context.window.saveProject=()=>{throw Error('MUST NOT write to cloud');};
 x.adapter.scheduleProjectAutosave(); // not enabled yet
 x.adapter.saveProject();
 x.adapter.scheduleProjectAutosave();
 x.runTimer();
 const snapshot=core.decode(x.files.get('modular-config-v4'),defaults,data);
 assert.equal(snapshot.project.layout.window[0].face,'B');
});

test('Rapid 3D rerenders cannot postpone autosave indefinitely',()=>{
 const x=setup();
 assert.equal(x.adapter.saveProject(),true);
 x.context.state.customer.name='Nueva ubicación y materiales';
 for(let i=0;i<25;i++)x.adapter.scheduleProjectAutosave();
 assert.equal(x.timerSchedules,1,'repeated renders must share a single pending save');
 x.runTimer();
 const reloaded=core.decode(x.files.get('modular-config-v4'),defaults,data).project;
 assert.equal(reloaded.customer.name,'Nueva ubicación y materiales');
 const writes=x.writes;
 for(let i=0;i<25;i++)x.adapter.scheduleProjectAutosave();
 x.runTimer();
 assert.equal(x.writes,writes,'unchanged 3D state must not produce redundant storage writes');
});
