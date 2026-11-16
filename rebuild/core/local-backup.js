/* BAT-CUBIKEITOR V2: local-only backup, not a Supabase adapter.
 * No credentials or APU data are added by this module.
 * Restoration is always explicit; it never overwrites startup state.
 */
(function(root,factory){
 const api=factory(root);
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.BatLocalBackup=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
'use strict';
const State=root.BatProjectState||(typeof require==='function'?require('./project-state'):null);
const DEFAULT_KEY='bat-cubikeitor-v2:project-backup:v1';
// Shared proxy domains such as raw.githack.com serve code from many authors
// under one origin. Do not put potentially sensitive project data in their storage.
function trustedOrigin(hostname,protocol){
 const host=String(hostname||'').toLowerCase();
 const scheme=String(protocol||'').toLowerCase();
 if((host==='localhost'||host==='127.0.0.1')&&
   (scheme==='http:'||scheme==='https:'))return true;
 return host==='man-nuel-b.github.io'&&scheme==='https:';
}
function create({storage,key=DEFAULT_KEY,now=()=>new Date().toISOString()}={}){
 if(!State?.check)throw new Error('Validador de proyecto no disponible');
 if(!storage||typeof storage.setItem!=='function'||typeof storage.getItem!=='function')
  throw new TypeError('Almacenamiento local no disponible');
 function save(project){
  const checked=State.check(project);
  const envelope={kind:'BAT_CUBIKEITOR_V2_BACKUP',version:1,savedAt:now(),project:checked};
  storage.setItem(key,JSON.stringify(envelope));
  return {savedAt:envelope.savedAt,revision:checked.revision};
 }
 function read(){
  const raw=storage.getItem(key);
  if(raw===null)return null;
  let backup;
  try{backup=JSON.parse(raw);}catch(_error){throw new Error('La copia local está dañada (JSON inválido)');}
  if(!backup||backup.kind!=='BAT_CUBIKEITOR_V2_BACKUP'||backup.version!==1||
    typeof backup.savedAt!=='string'||!backup.savedAt)
   throw new Error('La copia local tiene formato incompatible');
  const project=State.check(backup.project);
  return {savedAt:backup.savedAt,revision:project.revision,project};
 }
 function info(){
  const saved=read();
  return saved?{savedAt:saved.savedAt,revision:saved.revision}:null;
 }
 return Object.freeze({save,read,info,clear:()=>storage.removeItem(key),key});
}
return Object.freeze({create,DEFAULT_KEY,trustedOrigin});
});