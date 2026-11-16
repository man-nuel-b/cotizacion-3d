'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Backup=require('../core/local-backup');
const State=require('../core/project-state');
function memoryStorage(){
 const map=new Map();
 return {getItem:key=>map.has(key)?map.get(key):null,
  setItem:(key,value)=>{map.set(key,String(value));},
  removeItem:key=>map.delete(key),map};
}
test('respaldo local guarda solo el estado validado y permite restauración explícita',()=>{
 const storage=memoryStorage(),backup=Backup.create({storage,now:()=> '2026-11-15T23:00:00.000Z'});
 const original=State.defaults();
 assert.equal(backup.info(),null);
 assert.equal(backup.read(),null);
 const saved=backup.save(original);
 assert.deepEqual(saved,{savedAt:'2026-11-15T23:00:00.000Z',revision:0});
 const restored=backup.read();
 assert.deepEqual(restored.project,original);
 restored.project.project.name='Mutación en memoria';
 assert.equal(backup.read().project.project.name,'Proyecto modular');
 assert.equal(storage.map.size,1);
 const envelope=JSON.parse(storage.map.get(Backup.DEFAULT_KEY));
 assert.equal(envelope.project.openings.length,0);
 assert.equal(Object.hasOwn(envelope,'apu'),false);
 assert.equal(Object.hasOwn(envelope,'credentials'),false);
 backup.clear();
 assert.equal(backup.read(),null);
});
test('un respaldo dañado o con dimensiones inválidas es rechazado sin importar estado',()=>{
 const storage=memoryStorage(),backup=Backup.create({storage});
 storage.setItem(backup.key,'{texto corrupto');
 assert.throws(()=>backup.read(),/dañada/);
 storage.setItem(backup.key,JSON.stringify({kind:'BAT_CUBIKEITOR_V2_BACKUP',version:1,savedAt:'hoy',project:{}}));
 assert.throws(()=>backup.read(),/incompatible/);
 const invalid=State.defaults();invalid.project.container.length=0;
 assert.throws(()=>backup.save(invalid),/inválido/);
});
test('errores por cuota o privacidad se propagan al llamador sin modificar proyecto',()=>{
 const storage={getItem:()=>null,setItem:()=>{throw new Error('QuotaExceededError');},removeItem:()=>{}};
 const backup=Backup.create({storage});
 const state=State.defaults();
 assert.throws(()=>backup.save(state),/QuotaExceededError/);
 assert.deepEqual(state,State.defaults());
});
