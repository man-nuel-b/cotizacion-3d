/* BAT V2 cloud sync protocol: transport-agnostic, explicit optimistic concurrency.
 * This module DOES NOT connect to Supabase. Adapter must enforce version checks
 * atomically on its backend (e.g. RPC with WHERE version = expectedVersion).
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.BatCloudSync=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const copy=value=>JSON.parse(JSON.stringify(value));
function create({getSnapshot,writeRemote,readRemote,applyRemote,initialVersion=null}={}){
 if(typeof getSnapshot!=='function'||typeof writeRemote!=='function')
  throw new TypeError('Faltan las funciones de estado o escritura remota');
 if(initialVersion!==null&&(!Number.isSafeInteger(initialVersion)||initialVersion<1))
  throw new RangeError('Versión remota inválida');
 let remoteVersion=initialVersion;
 let inFlight=null;
 function checkedSnapshot(){
  const project=copy(getSnapshot());
  if(!project||!Number.isSafeInteger(project.revision)||project.revision<0)
   throw new Error('El proyecto no tiene una revisión válida');
  return project;
 }
 function save(){
  if(inFlight)return inFlight;
  const job=(async()=>{
   let cycles=0,wasSaved=false;
   do{
    if(++cycles>1000)throw new Error('Demasiados cambios durante el guardado; inténtalo nuevamente');
    const snapshot=checkedSnapshot(),revision=snapshot.revision;
    // Only one network write may be active, and each must enforce a remote CAS.
    const result=await writeRemote({
     project:snapshot,
     expectedVersion:remoteVersion,
     revision
    });
    const version=result?.version;
    if(!Number.isSafeInteger(version)||version<1||
      (remoteVersion!==null&&version<=remoteVersion))
     throw new Error('Guardado remoto no confirmado con versión incrementada');
    remoteVersion=version;
    wasSaved=true;
    // Continue until edits made while awaiting the write are included.
    // The stored project is never replaced by an older server response.
    if(checkedSnapshot().revision===revision)break;
   }while(true);
   return wasSaved;
  })();
  inFlight=job;
  void job.then(()=>{if(inFlight===job)inFlight=null;},()=>{if(inFlight===job)inFlight=null;});
  return job;
 }
 async function load(){
  if(!readRemote||!applyRemote)throw new Error('La lectura remota no está configurada');
  if(inFlight)throw new Error('No se puede abrir otro proyecto durante un guardado');
  const before=JSON.stringify(checkedSnapshot());
  const result=await readRemote();
  if(inFlight||JSON.stringify(checkedSnapshot())!==before)
   throw new Error('El diseño cambió durante la descarga; no se aplicaron datos obsoletos');
  const version=result?.version;
  if(!Number.isSafeInteger(version)||version<1)
   throw new Error('La nube no proporcionó versión válida');
  if(remoteVersion!==null&&version<remoteVersion)
   throw new Error('La nube devolvió una versión obsoleta');
  if(!result?.project)throw new Error('La nube devolvió un proyecto vacío');
  // The caller is responsible for validating/importing the remote snapshot
  // atomically before it replaces local state.
  await applyRemote(copy(result.project));
  remoteVersion=version;
  return true;
 }
 return Object.freeze({
  save,load,getVersion:()=>remoteVersion,isSaving:()=>inFlight!==null
 });
}
return Object.freeze({version:1,create});
});