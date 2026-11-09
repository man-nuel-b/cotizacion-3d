/* Cubikeitor — versioned, lossless project snapshots and integrity checks.
   3D geometry/materials are derived from this canonical project state after reopen.
   No network, DOM or storage writes occur in this module. */
(function(root){
  'use strict';
  const KEY='modular-config-v4';
  const FALLBACK_KEYS=['modular-config-v3','modular-config-v2'];
  const FORMAT='cubikeitor-project';
  const VERSION=4;
  const isRecord=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
  const assert=(condition,message)=>{if(!condition)throw new Error(message);};
  function copyJSON(source){
    const encoded=JSON.stringify(source);
    assert(typeof encoded==='string','El proyecto no contiene un estado válido.');
    // Reject exotic prototype fields instead of passing them into application state.
    return JSON.parse(encoded,(key,value)=>
      ['__proto__','prototype','constructor'].includes(key)?undefined:value);
  }
  function id(){
    const rand=Math.random().toString(36).slice(2,12).toUpperCase();
    return 'BK-'+Date.now().toString(36).toUpperCase()+'-'+rand;
  }
  function ensureMeta(project){
    assert(isRecord(project),'El proyecto no es un objeto válido.');
    if(!isRecord(project.projectMeta))project.projectMeta={};
    if(typeof project.projectMeta.id!=='string'||!project.projectMeta.id.trim())
      project.projectMeta.id=id();
    if(!Number.isSafeInteger(project.projectMeta.revision)||project.projectMeta.revision<0)
      project.projectMeta.revision=0;
    return project.projectMeta.id;
  }
  function positiveOptional(object,fields,label){
    for(const name of fields){
      if(object[name]===undefined||object[name]===null)continue;
      const n=Number(object[name]);
      assert(Number.isFinite(n)&&n>0&&n<100000,
        'Dimensión inválida en '+label+': '+name);
    }
  }
  function finiteOptional(object,fields,label){
    for(const name of fields){
      if(object[name]===undefined||object[name]===null)continue;
      const n=Number(object[name]);
      assert(Number.isFinite(n)&&Math.abs(n)<100000,
        'Coordenada inválida en '+label+': '+name);
    }
  }
  function normalize(source,defaults,catalog){
    assert(isRecord(source),'El archivo no contiene un proyecto válido.');
    assert(isRecord(defaults)&&isRecord(defaults.counts),
      'No está disponible la configuración básica del editor.');
    const incoming=copyJSON(source),base=copyJSON(defaults);
    // Never overwrite the required structure with null, arrays or primitives.
    assert(!('counts' in incoming)||isRecord(incoming.counts),'Contadores del proyecto dañados.');
    assert(!('customer' in incoming)||isRecord(incoming.customer),'Datos del cliente dañados.');
    const result={...base,...incoming,
      counts:{...base.counts,...(incoming.counts||{})},
      customer:{...base.customer,...(incoming.customer||{})}};
    if(catalog){
      for(const key of ['container','solution','finish']){
        if(catalog[key==='container'?'containers':key==='solution'?'solutions':'finishes']){
          const available=catalog[key==='container'?'containers':key==='solution'?'solutions':'finishes'];
          assert(Object.prototype.hasOwnProperty.call(available,result[key]),
            'La configuración '+key+' ya no existe en este catálogo. No se reemplazó el proyecto.');
        }
      }
    }
    for(const [key,value] of Object.entries(result.counts)){
      assert(Number.isSafeInteger(value)&&value>=0&&value<=10000,
        'Cantidad inválida para '+key+'. No se reemplazó el proyecto.');
    }
    for(const name of ['layout','dimensions']){
      if(result[name]===undefined||result[name]===null){result[name]={};continue;}
      assert(isRecord(result[name]),'La estructura '+name+' del proyecto está dañada.');
      for(const [type,list] of Object.entries(result[name])){
        assert(Array.isArray(list),'La lista '+name+'.'+type+' está dañada.');
        assert(list.length<=10000,'Hay demasiados elementos '+name+'.'+type);
        for(const item of list){
          assert(item===null||isRecord(item),'Un elemento de '+name+'.'+type+' está dañado.');
          if(!item)continue;
          const label=name+'.'+type;
          if(name==='dimensions'){
            positiveOptional(item,['width','length','height','depth','thickness','size'],label);
            finiteOptional(item,['rotation','angle','offset','x','y','z'],label);
          }else{
            finiteOptional(item,['x','y','z','rotation','offset'],label);
            if(item.face!==undefined&&item.face!==null)
              assert(typeof item.face==='string'&&item.face.length<=50,'Cara inválida en '+label);
          }
        }
      }
    }
    if(result.bathroomModules===undefined||result.bathroomModules===null)
      result.bathroomModules=[];
    assert(Array.isArray(result.bathroomModules)&&result.bathroomModules.length<=10000,
      'La lista de baños prearmados está dañada.');
    for(const module of result.bathroomModules){
      assert(isRecord(module)&&['full','half'].includes(module.kind),
        'Existe un baño prearmado con tipo inválido.');
      assert(Number.isFinite(Number(module.x))&&Number.isFinite(Number(module.z))
        &&module.x!==null&&module.z!==null,'Un baño prearmado no tiene ubicación válida.');
      if(module.rotation!==undefined)
        finiteOptional(module,['rotation'],'baño prearmado');
    }
    if(result.electrical!==undefined&&result.electrical!==null){
      assert(isRecord(result.electrical),'La instalación eléctrica está dañada.');
      if(result.electrical.points!==undefined){
        assert(Array.isArray(result.electrical.points),'Los puntos eléctricos están dañados.');
        assert(result.electrical.points.length<=10000,
          'La cantidad de puntos eléctricos supera el máximo de almacenamiento.');
        for(const point of result.electrical.points){
          assert(isRecord(point),'Uno de los puntos eléctricos está dañado.');
          if(point.type!==undefined)
            assert(typeof point.type==='string','Tipo de punto eléctrico inválido.');
          if(point.id!==undefined)
            assert(typeof point.id==='string','Identificador eléctrico inválido.');
        }
        assert(result.electrical.points.length<=(result.counts.electrical||0),
          'Los puntos eléctricos y su contador no coinciden. No se borró ningún punto.');
      }
    }
    ensureMeta(result);
    return result;
  }
  // Accidental corruption detector, NOT an authentication or security hash.
  function digest(string){
    let hash=2166136261;
    for(let i=0;i<string.length;i++){
      hash^=string.charCodeAt(i);
      hash=Math.imul(hash,16777619);
    }
    return (hash>>>0).toString(16).padStart(8,'0');
  }
  function encode(source,defaults,catalog){
    const project=normalize(source,defaults,catalog);
    const payload=JSON.stringify(project);
    return {project,serialized:JSON.stringify({
      format:FORMAT,version:VERSION,savedAt:new Date().toISOString(),
      integrity:digest(payload),project
    })};
  }
  function decode(serialized,defaults,catalog){
    assert(typeof serialized==='string'&&serialized.trim(),'No se encontró una copia del proyecto.');
    const saved=copyJSON(JSON.parse(serialized));
    assert(isRecord(saved),'El respaldo no es un objeto.');
    if(saved.format!==undefined||saved.project!==undefined){
      assert(saved.format===FORMAT&&saved.version===VERSION,
        'El formato del respaldo no es compatible.');
      assert(isRecord(saved.project),'El respaldo no tiene datos de proyecto.');
      assert(digest(JSON.stringify(saved.project))===saved.integrity,
        'La copia del proyecto está incompleta o dañada.');
      return {project:normalize(saved.project,defaults,catalog),format:'v4'};
    }
    return {project:normalize(saved,defaults,catalog),format:'legacy'};
  }
  function recover(storage,defaults,catalog){
    const errors=[];
    for(const key of [KEY,...FALLBACK_KEYS]){
      let raw;
      try{raw=storage.getItem(key);}catch(error){
        errors.push({key,message:'No se pudo leer el almacenamiento local.'});continue;
      }
      if(!raw)continue;
      try{return {...decode(raw,defaults,catalog),key,errors};}
      catch(error){errors.push({key,message:String(error.message||error)});}
    }
    return {project:null,key:null,format:null,errors};
  }
  const api={version:VERSION,key:KEY,fallbackKeys:FALLBACK_KEYS,id,ensureMeta,
    normalize,encode,decode,recover};
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.BAT_CUBIKEITOR_PROJECT_PERSISTENCE=api;
})(typeof window==='undefined'?globalThis:window);
