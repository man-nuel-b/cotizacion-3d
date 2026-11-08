'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.resolve(__dirname,'..');
const wizard=fs.readFileSync(path.join(root,'wizard-interior-step.js'),'utf8');
const start=wizard.indexOf('  function loadVerified(');
const end=wizard.indexOf('  function moveControlsToDedicatedSteps',start);
assert.ok(start>=0&&end>start,'Verified loader source must exist');
const fnSource=wizard.slice(start,end);

function fixture(existing=null){
  let created=0,removed=0,timerActive=true,tick=null,loadedCount=0;
  const messages=[];
  function script(){
    return {dataset:{},listeners:{},
      addEventListener(type,fn){this.listeners[type]=fn;},
      remove(){removed++}};
  }
  const document={
    querySelector(){return existing;},
    createElement(){created++;return script();},
    body:{appendChild(s){existing=s;}}
  };
  const context={
    document,
    asset(name){return name+'?v=test';},
    console:{warn(v){messages.push('WARN:'+v);},error(v){messages.push('ERROR:'+v);}},
    setInterval(fn){tick=fn;timerActive=true;return 42;},
    clearInterval(){timerActive=false;}
  };
  vm.runInNewContext(fnSource+';globalThis.verified=loadVerified;',context);
  function startLoading(readiness){
    context.verified('script[data-openings]','openings-extras.js','openingExtras',readiness,()=>loadedCount++);
  }
  return {startLoading,step(times=1){for(let i=0;i<times&&timerActive;i++)tick?.();},
    get loadedCount(){return loadedCount;},
    get created(){return created;},get removed(){return removed;},
    get active(){return timerActive;},get messages(){return messages;}};
}

test('Delayed 3D opening module becomes ready after the former 180-attempt deadline',()=>{
  let ready=false;
  const f=fixture();
  f.startLoading(()=>ready);
  assert.equal(f.created,1);
  f.step(240);
  assert.equal(f.loadedCount,0,'must continue waiting after old premature timeout');
  assert.equal(f.active,true);
  ready=true;
  f.step();
  assert.equal(f.loadedCount,1,'must continue chain when module actually initializes');
  assert.equal(f.active,false,'must stop polling after successful installation');
  f.step(3);
  assert.equal(f.loadedCount,1,'chain only continues once');
});

test('Existing loading script is never removed or evaluated a second time',()=>{
  let ready=false;
  const f=fixture({dataset:{},addEventListener(){},remove(){throw Error('must not remove')}});
  f.startLoading(()=>ready);
  assert.equal(f.created,0,'should reuse script');
  assert.equal(f.removed,0,'no destructive reloads');
  f.step(30);
  ready=true;
  f.step();
  assert.equal(f.loadedCount,1);
});

test('3D readiness chain has bounded fallback beyond the prior 13-second timeouts',()=>{
 const engine=fs.readFileSync(path.join(root,'wall-module-engine.js'),'utf8');
 const partitions=fs.readFileSync(path.join(root,'partition-face-loader.js'),'utf8');
 const openings=fs.readFileSync(path.join(root,'openings-extras.js'),'utf8');
 assert.match(engine,/attempts>=1000/);
 assert.match(partitions,/tries>=750/);
 assert.match(partitions,/attempts>=750/);
 assert.match(openings,/attempts>=1000/);
});
