// BAT-Cubikeitor · deterministic bootstrap v3
// Goal: remove timing-based module orchestration and expose ownership of critical globals.
(function(){
  if(window.BAT_BOOTSTRAP_V3) return;

  const events=new EventTarget();
  const registry=new Map();
  const criticalNames=['renderAll','buildBOM','calculate','rebuild3D','showEditorPanel','positionMountedObject','mountedParametricPosition'];
  const status={phase:'created',startedAt:null,finishedAt:null,modules:[],errors:[],ownership:[]};

  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const now=()=>new Date().toISOString();

  function emit(type,detail={}){events.dispatchEvent(new CustomEvent(type,{detail}));}

  function mark(name,state,detail=''){
    const existing=status.modules.find(item=>item.name===name);
    const entry=existing||{name,state:'pending',startedAt:null,finishedAt:null,detail:''};
    if(!existing)status.modules.push(entry);
    entry.state=state;
    entry.detail=detail||entry.detail;
    if(state==='loading')entry.startedAt=now();
    if(state==='ready'||state==='error')entry.finishedAt=now();
    emit('module-status',{...entry});
    return entry;
  }

  function criticalSnapshot(){
    return Object.fromEntries(criticalNames.map(name=>[name,{exists:typeof globalThis[name]==='function',fn:globalThis[name]||null}]));
  }

  function recordOwnership(moduleKey,before,after){
    criticalNames.forEach(name=>{
      if(before[name]?.fn!==after[name]?.fn){
        const change={module:moduleKey,function:name,at:now(),beforeExists:Boolean(before[name]?.exists),afterExists:Boolean(after[name]?.exists)};
        status.ownership.push(change);
        emit('critical-global-changed',change);
      }
    });
  }

  function scriptExists(key){return document.querySelector(`script[data-bat-module="${key}"]`);}

  function loadScript(src,key){
    return new Promise((resolve,reject)=>{
      const existing=scriptExists(key);
      if(existing){
        if(existing.dataset.loaded==='1')return resolve(existing);
        existing.addEventListener('load',()=>resolve(existing),{once:true});
        existing.addEventListener('error',()=>reject(new Error(`No se pudo cargar ${src}`)),{once:true});
        return;
      }
      mark(key,'loading',src);
      const script=document.createElement('script');
      script.src=src;
      script.async=false;
      script.dataset.batModule=key;
      script.addEventListener('load',()=>{script.dataset.loaded='1';mark(key,'ready',src);resolve(script);},{once:true});
      script.addEventListener('error',()=>{const error=new Error(`No se pudo cargar ${src}`);mark(key,'error',error.message);status.errors.push({module:key,message:error.message});reject(error);},{once:true});
      document.body.appendChild(script);
    });
  }

  async function waitFor(name,test,{timeout=5000,interval=25,optional=false}={}){
    const start=performance.now();
    while(performance.now()-start<timeout){
      try{if(test())return true;}catch(e){}
      await sleep(interval);
    }
    const message=`${name} no confirmó disponibilidad en ${timeout} ms`;
    if(optional){console.warn('[BAT Bootstrap V3]',message);return false;}
    throw new Error(message);
  }

  async function loadModule(def){
    const before=criticalSnapshot();
    await loadScript(def.src,def.key);
    if(def.ready)await waitFor(def.key,def.ready,{timeout:def.timeout||5000,optional:Boolean(def.optionalReady)});
    const after=criticalSnapshot();
    recordOwnership(def.key,before,after);
    registry.set(def.key,{...def,loaded:true});
    return true;
  }

  const manifest=[
    {key:'platform-v3',src:'platform-v3.js?v=20261026-v3',ready:()=>Boolean(window.BAT_PLATFORM_V3),timeout:2000},
    {key:'wall-module-engine',src:'wall-module-engine.js?v=20261026-v3',ready:()=>Boolean(window.BAT_KUBIQUEITOR_WALL_MODULE_ENGINE),timeout:3000},
    {key:'wall-variant-registry',src:'wall-variant-registry.js?v=20261026-v3'},
    {key:'direct-editor-controller',src:'direct-editor-controller.js?v=20261026-v3',ready:()=>Boolean(window.BAT_KUBIQUEITOR_DIRECT_EDITOR_CONTROLLER),timeout:5000},
    {key:'spatial-occupancy',src:'spatial-occupancy.js?v=20261026-v3'},
    {key:'partition-obstacle-collision',src:'partition-obstacle-collision.js?v=20261026-v3'},
    {key:'electrical-ui-stage1',src:'electrical-ui-stage1.js?v=20261026-v3'},
    {key:'supabase-cloud',src:'supabase-cloud.js?v=20261026-v3'},
    {key:'project-metrics-v1',src:'project-metrics-v1.js?v=20261026-v3'},
    {key:'model-cost-bridge-v1',src:'model-cost-bridge-v1.js?v=20261026-v3'},
    {key:'apu-excel-resources-1',src:'apu-excel-resources-1.js?v=20261026-v3'},
    {key:'apu-excel-resources-2',src:'apu-excel-resources-2.js?v=20261026-v3'},
    {key:'apu-excel-resources-3',src:'apu-excel-resources-3.js?v=20261026-v3'},
    {key:'apu-excel-partidas-1',src:'apu-excel-partidas-1.js?v=20261026-v3'},
    {key:'apu-excel-partidas-2',src:'apu-excel-partidas-2.js?v=20261026-v3'},
    {key:'apu-excel-partidas-3',src:'apu-excel-partidas-3.js?v=20261026-v3'},
    {key:'apu-excel-catalog-core-v1',src:'apu-excel-catalog-core-v1.js?v=20261026-v3',ready:()=>Boolean(window.BAT_KUBIQUEITOR_EXCEL_APU_CATALOG),timeout:15000,optionalReady:true},
    {key:'apu-excel-method-v1',src:'apu-excel-method-v1.js?v=20261026-v3',ready:()=>typeof window.getApuExcelBreakdown==='function',timeout:15000,optionalReady:true},
    {key:'apu-excel-accounting-v1',src:'apu-excel-accounting-v1.js?v=20261026-v3'},
    {key:'apu-3d-mapping-v1',src:'apu-3d-mapping-v1.js?v=20261026-v3'},
    {key:'apu-surface-mapping-v1',src:'apu-surface-mapping-v1.js?v=20261026-v3'},
    {key:'apu-excel-editor-v1',src:'apu-excel-editor-v1.js?v=20261026-v3'},
    {key:'project-materials-list-v2',src:'project-materials-list-v2.js?v=20261026-v3'},
    {key:'project-material-plan-v1',src:'project-material-plan-v1.js?v=20261026-v3'},
    {key:'project-material-plan-filtered-v2',src:'project-material-plan-filtered-v2.js?v=20261026-v3'}
  ];

  async function start(){
    if(status.phase==='loading'||status.phase==='ready')return status;
    status.phase='loading';status.startedAt=now();emit('bootstrap-start',{manifest:manifest.map(x=>x.key)});
    try{
      await waitFor('legacy-app',()=>typeof window.renderAll==='function'&&typeof window.rebuild3D==='function',{timeout:8000});
      status.legacyCritical=criticalSnapshot();
      for(const def of manifest)await loadModule(def);
      // Some legacy UI modules intentionally defer DOM hookup. This single barrier is not used for dependency ordering.
      await sleep(250);
      status.phase='ready';status.finishedAt=now();status.critical=criticalSnapshot();
      document.documentElement.dataset.batReady='v3';
      emit('bootstrap-ready',{status});
      console.info('[BAT Bootstrap V3] ready',status);
    }catch(error){
      status.phase='error';status.finishedAt=now();status.errors.push({module:'bootstrap',message:error.message});
      emit('bootstrap-error',{error,status});
      console.error('[BAT Bootstrap V3] failed',error);
    }
    return status;
  }

  window.BAT_BOOTSTRAP_V3={
    version:3,
    events,
    registry,
    status,
    manifest:manifest.map(item=>({...item,ready:undefined})),
    start,
    diagnostics(){
      const critical=criticalSnapshot();
      return {
        phase:status.phase,
        startedAt:status.startedAt,
        finishedAt:status.finishedAt,
        modules:status.modules.map(x=>({...x})),
        errors:status.errors.map(x=>({...x})),
        ownership:status.ownership.map(x=>({...x})),
        critical:Object.fromEntries(Object.entries(critical).map(([name,value])=>[name,{exists:value.exists}]))
      };
    }
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>start(),{once:true});else start();
})();
