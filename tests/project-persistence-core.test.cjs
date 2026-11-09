'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const core=require('../project-persistence-core.js');
const bom=require('../supabase-3d-bom-bridge.js');
const defaults={
  step:1,container:'20hc',solution:'office',finish:'standard',
  counts:{window:0,door:0,partition:0,wc:0,sink:0,shower:0,electrical:0},
  customer:{name:'',company:'',email:''}
};
const catalog={
  containers:{'20hc':{length:6.06,width:2.44,height:2.89}},
  solutions:{office:{name:'Oficina'}},
  finishes:{standard:{name:'Estándar',lining:'gypsum'}}
};
function project(){
  return {
    container:'20hc',solution:'office',finish:'standard',
    customer:{name:'Cliente prueba',email:'prueba@example.invalid'},
    counts:{window:2,door:1,partition:1,wc:1,sink:1,shower:0,electrical:3},
    layout:{
      window:[{face:'A',x:-1.4},{face:'D',x:.25}],
      door:[{face:'B',x:0.5}],
      partition:[{orientation:'long',x:0,z:.2}],
      wc:[{x:-.3,z:.7}],
      sink:[{x:.8,z:.7}],
      electrical:[{face:'A',x:1},{face:'B',x:0},{face:'C',x:-.3}]
    },
    dimensions:{
      window:[{width:1.15,height:.95},{width:.80,height:1.2}],
      door:[{width:.9,height:2.10}],
      partition:[{length:2.0,height:2.25,thickness:.075}],
      sink:[{width:.60,depth:.50}]
    },
    electrical:{version:1,points:[
      {id:'EL-A',type:'outlet',circuit:'Enchufes',face:'A',position:{x:1,z:-.5}},
      {id:'EL-B',type:'light',circuit:'Iluminación',face:'B',position:{x:0,z:0}},
      {id:'EL-C',type:'switch',circuit:'Iluminación',face:'C',position:{x:-.3,z:0}}
    ]},
    bathroomModules:[{kind:'full',x:1.35,z:-.35,rotation:90}],
    interiorSystem:{lining:'plywood',insulation:'rockwool'},
    interiorDoors:[{id:'door-interior',enabled:true,x:2.1,z:.15}],
    customNewModule:{futureMetadata:{text:'Conservar datos nuevos',array:[1,2,3]}},
    projectMeta:{id:'BK-PERSIST-EXAMPLE',revision:3,title:'Prueba guardado'}
  };
}
function build(p){return bom.buildPlan(p,catalog);}
function quantities(plan){
 return plan.items.map(x=>({code:x.code,quantity:x.quantity})).sort((a,b)=>a.code.localeCompare(b.code));
}
test('Complete 3D project saves and reopens losslessly, preserving positions and every relevant dimension',()=>{
 const original=project(),before=JSON.parse(JSON.stringify(original));
 const saved=core.encode(original,defaults,catalog);
 const restored=core.decode(saved.serialized,defaults,catalog);
 assert.equal(restored.format,'v4');
 assert.deepEqual(restored.project.layout,original.layout);
 assert.deepEqual(restored.project.dimensions,original.dimensions);
 assert.deepEqual(restored.project.bathroomModules,original.bathroomModules);
 assert.deepEqual(restored.project.electrical,original.electrical);
 assert.deepEqual(restored.project.interiorDoors,original.interiorDoors);
 assert.deepEqual(restored.project.interiorSystem,original.interiorSystem);
 assert.deepEqual(restored.project.customNewModule,original.customNewModule);
 assert.equal(restored.project.projectMeta.id,original.projectMeta.id);
 assert.deepEqual(original,before,'saving must never mutate the original state');
 const after=core.encode(restored.project,defaults,catalog);
 assert.equal(JSON.parse(after.serialized).integrity,JSON.parse(saved.serialized).integrity,
   'project state integrity must remain unchanged after reopen');
});
test('Actual Supabase BOM/cubicación stays identical after reopening the 3D project',()=>{
 const initial=project();
 const restored=core.decode(core.encode(initial,defaults,catalog).serialized,defaults,catalog).project;
 assert.deepEqual(quantities(build(restored)),quantities(build(initial)));
 const item=build(restored).items.find(x=>x.code==='MOD-TABIQUE');
 assert.equal(item?.quantity,4.5,'partition surface must reflect 2.0m x 2.25m');
 const wc=build(restored).items.find(x=>x.code==='MOD-WC');
 assert.equal(wc?.quantity,2,'standalone WC plus one from complete bathroom');
});
test('Version 4 detects accidental corruption without replacing valid older backup',()=>{
 const value=project(),good=core.encode(value,defaults,catalog);
 const altered=JSON.parse(good.serialized);altered.project.layout.window[0].x=2;
 const storage=new Map([[core.key,JSON.stringify(altered)],
   ['modular-config-v3',JSON.stringify(value)]]);
 const result=core.recover({getItem:k=>storage.get(k)||null},defaults,catalog);
 assert.equal(result.key,'modular-config-v3');
 assert.equal(result.format,'legacy');
 assert.equal(result.errors.length,1);
 assert.equal(result.project.layout.window[0].x,-1.4);
 assert.equal(JSON.parse(storage.get(core.key)).project.layout.window[0].x,2,
   'damaged original must not be silently overwritten');
});
test('Invalid count, electrical mismatch and bathroom coordinates fail closed',()=>{
 const p=project();
 p.counts.window=-1;
 assert.throws(()=>core.normalize(p,defaults,catalog),/Cantidad inválida/);
 p.counts.window=2;p.counts.electrical=2;
 assert.throws(()=>core.normalize(p,defaults,catalog),/puntos eléctricos y su contador/);
 p.counts.electrical=3;p.bathroomModules[0].x=null;
 assert.throws(()=>core.normalize(p,defaults,catalog),/ubicación válida/);
});
test('Legacy v2 restores with defaults and retains future or custom metadata',()=>{
 const old={solution:'office',container:'20hc',finish:'standard',counts:{window:1},
   layout:{window:[{face:'B',x:.85}]},dimensions:{window:[{width:1.3,height:.9}]},
   extraFutureData:{hello:'world'}};
 const storage=new Map([['modular-config-v2',JSON.stringify(old)]]);
 const result=core.recover({getItem:k=>storage.get(k)||null},defaults,catalog);
 assert.equal(result.key,'modular-config-v2');
 assert.deepEqual(result.project.layout.window,old.layout.window);
 assert.deepEqual(result.project.dimensions.window,old.dimensions.window);
 assert.equal(result.project.extraFutureData.hello,'world');
 assert.equal(result.project.counts.door,0);
 assert.ok(result.project.projectMeta.id.startsWith('BK-'));
});
test('Stable project identity across saves and unique identity for a copy',()=>{
 const value=project();delete value.projectMeta;
 const first=core.encode(value,defaults,catalog);
 const second=core.encode(first.project,defaults,catalog);
 assert.equal(first.project.projectMeta.id,second.project.projectMeta.id);
 assert.notEqual(core.id(),first.project.projectMeta.id);
});
test('Invalid stored projects never overwrite or silently fall back to empty project',()=>{
 const storage=new Map([[core.key,'{"format":"cubikeitor-project","version":4}'],
   ['modular-config-v3','{bad JSON']]);
 const snapshot=JSON.stringify([...storage]);
 const result=core.recover({getItem:k=>storage.get(k)||null},defaults,catalog);
 assert.equal(result.project,null);
 assert.equal(result.errors.length,2);
 assert.equal(JSON.stringify([...storage]),snapshot);
});
