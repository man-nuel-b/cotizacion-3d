// BAT-Cubikeitor · platform contracts v3
// New modules register here instead of replacing globals from app.js.
(function(){
  if(window.BAT_PLATFORM_V3) return;

  const bus=new EventTarget();
  const modules=new Map();
  const domains=new Map();

  const clone=value=>{
    try{return structuredClone(value);}catch(e){return JSON.parse(JSON.stringify(value));}
  };

  function emit(type,detail={}){bus.dispatchEvent(new CustomEvent(type,{detail}));}
  function on(type,handler,options){bus.addEventListener(type,handler,options);return ()=>bus.removeEventListener(type,handler,options);}

  function registerModule(definition){
    if(!definition?.id)throw new Error('BAT Platform V3: module id is required');
    if(modules.has(definition.id))throw new Error(`BAT Platform V3: duplicate module ${definition.id}`);
    const entry=Object.freeze({id:definition.id,version:definition.version||1,domain:definition.domain||'general',dependsOn:[...(definition.dependsOn||[])],capabilities:[...(definition.capabilities||[])]});
    modules.set(entry.id,entry);
    emit('module:registered',entry);
    return entry;
  }

  function registerDomain(name,api){
    if(!name)throw new Error('BAT Platform V3: domain name is required');
    if(domains.has(name))throw new Error(`BAT Platform V3: duplicate domain ${name}`);
    domains.set(name,api);
    emit('domain:registered',{name});
    return api;
  }

  function getDomain(name){return domains.get(name)||null;}

  function legacySnapshot(){
    try{
      if(typeof state==='undefined'||typeof DATA==='undefined')return null;
      const container=DATA.containers?.[state.container];
      return clone({
        container:{type:state.container,length:Number(container?.length)||0,width:Number(container?.width)||0,height:Number(container?.height)||0},
        solution:state.solution,
        finish:state.finish,
        exteriorColor:state.exteriorColor,
        counts:state.counts||{},
        layout:state.layout||{},
        dimensions:state.dimensions||{},
        electrical:state.electrical||null,
        customer:state.customer||{},
        commercial:{margin:Number(state.margin)||0,transport:Number(state.transport)||0,tax:Number(state.tax)||0}
      });
    }catch(error){console.warn('[BAT Platform V3] snapshot',error);return null;}
  }

  const api={
    version:3,
    bus,
    modules,
    domains,
    on,
    emit,
    registerModule,
    registerDomain,
    getDomain,
    legacySnapshot,
    diagnostics(){return {version:3,modules:[...modules.values()].map(x=>({...x})),domains:[...domains.keys()],legacyReadable:Boolean(legacySnapshot())};}
  };

  window.BAT_PLATFORM_V3=api;
  registerModule({id:'platform-v3',version:3,domain:'core',capabilities:['events','module-registry','domain-registry','legacy-readonly-adapter']});
  console.info('[BAT Platform V3] contracts ready');
})();
