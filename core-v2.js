// BAT-Cubikeitor Core V2
// Safe parallel architecture: does not replace legacy globals or editor functions.
(function(){
  if(window.BAT_CORE_V2) return;

  const VERSION='2.0.1-foundation';
  const deepClone=value=>JSON.parse(JSON.stringify(value));
  const number=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
  const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));

  class EventBus{
    constructor(){this.listeners=new Map();}
    on(type,handler){
      if(!this.listeners.has(type)) this.listeners.set(type,new Set());
      this.listeners.get(type).add(handler);
      return ()=>this.off(type,handler);
    }
    off(type,handler){this.listeners.get(type)?.delete(handler);}
    emit(type,payload){
      (this.listeners.get(type)||[]).forEach(handler=>{
        try{handler(payload);}catch(error){console.warn('[BAT Core V2] event handler',type,error);}
      });
    }
  }

  const DEFAULT_PROJECT={
    schemaVersion:2,
    source:'legacy-adapter',
    container:{type:'20hc',length:0,width:0,height:0},
    solution:'custom',
    finish:'standard',
    exteriorColor:'#1e3a8a',
    customer:{name:'',company:'',phone:'',email:''},
    commercial:{marginPct:25,transport:0,taxPct:19},
    components:{
      window:[],door:[],partition:[],wc:[],sink:[],shower:[],ac:[],electrical:[]
    },
    surfaces:{
      paint:{A:false,B:false,C:false,D:false,E:false},
      grateado:{A:false,B:false,C:false,D:false,E:false}
    },
    geometry:{faces:{},floorArea:0,roofArea:0,wallGrossArea:0,wallNetArea:0},
    meta:{revision:0,updatedAt:null}
  };

  class ProjectStore{
    constructor(initial){this.state=deepClone(initial);this.bus=new EventBus();}
    get(){return deepClone(this.state);}
    read(){return this.state;}
    replace(next,{source='unknown',silent=false}={}){
      const previous=this.state;
      this.state=deepClone(next);
      this.state.meta=this.state.meta||{};
      this.state.meta.revision=number(previous?.meta?.revision,0)+1;
      this.state.meta.updatedAt=new Date().toISOString();
      this.state.meta.source=source;
      if(!silent)this.bus.emit('project:changed',{state:this.get(),source});
    }
    patch(mutator,{source='unknown'}={}){
      const next=this.get();
      mutator(next);
      this.replace(next,{source});
    }
    on(type,handler){return this.bus.on(type,handler);}
  }

  const store=new ProjectStore(DEFAULT_PROJECT);
  const quantities=new Map();
  const quantityBus=new EventBus();
  let lastQuantities={};

  function registerQuantity(key,calculator){
    if(typeof calculator!=='function') throw new Error('Quantity calculator must be a function');
    quantities.set(key,calculator);
    if(store.read()?.meta?.revision) calculateQuantities(store.read());
  }

  function calculateQuantities(project=store.read()){
    const result={};
    quantities.forEach((calculator,key)=>{
      try{result[key]=calculator(project);}catch(error){console.warn('[BAT Core V2] quantity',key,error);result[key]=null;}
    });
    lastQuantities=result;
    quantityBus.emit('quantities:changed',{quantities:deepClone(result),revision:project.meta?.revision||0});
    return deepClone(result);
  }

  function defaultDimensions(type){
    if(type==='window')return {width:1.20,height:1.05};
    if(type==='door')return {width:.98,height:2.08};
    return {};
  }

  function readLegacyDimensions(type,index){
    try{
      if(typeof objectDimensions==='function'){
        const dims=objectDimensions(type,index)||{};
        return Object.fromEntries(Object.entries(dims).map(([key,value])=>[key,number(value,value)]));
      }
    }catch(e){}
    return defaultDimensions(type);
  }

  function readLegacyLayout(type,index){
    try{
      if(typeof actualLayout==='function'){
        const layout=actualLayout(type,index)||{};
        return {face:layout.face||null,x:number(layout.x,0),z:number(layout.z,0)};
      }
    }catch(e){}
    try{
      const item=state?.layout?.[type]?.[index];
      if(item)return {face:item.face||null,x:number(item.x,0),z:number(item.z,0)};
    }catch(e){}
    return {face:null,x:0,z:0};
  }

  function componentArray(type,count){
    const total=Math.max(0,Math.floor(number(count,0)));
    return Array.from({length:total},(_,index)=>({
      id:`${type}-${index+1}`,
      type,
      index,
      ...readLegacyLayout(type,index),
      dimensions:readLegacyDimensions(type,index)
    }));
  }

  function faceArea(face,c){
    if(face==='A'||face==='B')return c.length*c.height;
    if(face==='C'||face==='D')return c.width*c.height;
    if(face==='E')return c.length*c.width;
    return 0;
  }

  function openingAreaForFace(project,face){
    let total=0;
    ['window','door'].forEach(type=>{
      project.components[type].forEach(item=>{
        if(item.face&&item.face!==face)return;
        if(!item.face)return;
        total+=Math.max(0,number(item.dimensions?.width,defaultDimensions(type).width))*Math.max(0,number(item.dimensions?.height,defaultDimensions(type).height));
      });
    });
    return total;
  }

  function deriveGeometry(project){
    const c=project.container;
    const faces={};
    ['A','B','C','D','E'].forEach(face=>{
      const gross=faceArea(face,c);
      const openings=face==='E'?0:openingAreaForFace(project,face);
      faces[face]={grossArea:gross,openingArea:openings,netArea:Math.max(0,gross-openings)};
    });
    const wallGross=faces.A.grossArea+faces.B.grossArea+faces.C.grossArea+faces.D.grossArea;
    const wallNet=faces.A.netArea+faces.B.netArea+faces.C.netArea+faces.D.netArea;
    return {faces,floorArea:c.length*c.width,roofArea:faces.E.grossArea,wallGrossArea:wallGross,wallNetArea:wallNet};
  }

  function legacySnapshot(){
    try{
      if(typeof state==='undefined'||typeof DATA==='undefined')return null;
      const c=DATA?.containers?.[state.container];
      if(!c)return null;
      const current=store.read();
      const next=deepClone(DEFAULT_PROJECT);
      // Domains already migrated to V2 remain owned by V2 and survive legacy synchronization.
      next.surfaces=deepClone(current?.surfaces||next.surfaces);
      next.container={type:state.container,length:number(c.length),width:number(c.width),height:number(c.height)};
      next.solution=state.solution||'custom';
      next.finish=state.finish||'standard';
      next.exteriorColor=state.exteriorColor||'#1e3a8a';
      next.customer={...next.customer,...deepClone(state.customer||{})};
      next.commercial={marginPct:number(state.margin,25),transport:Math.max(0,number(state.transport,0)),taxPct:clamp(number(state.tax,19),0,100)};
      Object.keys(next.components).forEach(type=>{next.components[type]=componentArray(type,state.counts?.[type]);});
      if(state.surfaces){
        const legacySurfaces=deepClone(state.surfaces);
        next.surfaces={...next.surfaces,...legacySurfaces};
      }
      next.geometry=deriveGeometry(next);
      return next;
    }catch(error){console.warn('[BAT Core V2] legacy snapshot',error);return null;}
  }

  function stableFingerprint(project){
    if(!project)return '';
    const copy=deepClone(project);
    delete copy.meta;
    return JSON.stringify(copy);
  }

  let lastLegacyFingerprint='';
  function syncFromLegacy({force=false}={}){
    const snapshot=legacySnapshot();
    if(!snapshot)return false;
    const fingerprint=stableFingerprint(snapshot);
    if(!force&&fingerprint===lastLegacyFingerprint)return false;
    lastLegacyFingerprint=fingerprint;
    store.replace(snapshot,{source:'legacy-adapter'});
    return true;
  }

  // Base quantities. New systems register additional calculators instead of wrapping global functions.
  registerQuantity('floor.m2',project=>project.geometry.floorArea);
  registerQuantity('roof.m2',project=>project.geometry.roofArea);
  registerQuantity('walls.gross.m2',project=>project.geometry.wallGrossArea);
  registerQuantity('walls.net.m2',project=>project.geometry.wallNetArea);
  registerQuantity('openings.window.units',project=>project.components.window.length);
  registerQuantity('openings.door.units',project=>project.components.door.length);
  registerQuantity('partitions.units',project=>project.components.partition.length);
  registerQuantity('sanitary.wc.units',project=>project.components.wc.length);
  registerQuantity('sanitary.sink.units',project=>project.components.sink.length);
  registerQuantity('sanitary.shower.units',project=>project.components.shower.length);
  registerQuantity('hvac.ac.units',project=>project.components.ac.length);
  registerQuantity('electrical.points.units',project=>project.components.electrical.length);

  // Central reaction: project changes recalculate quantities. Feature modules never wrap render/calculate functions.
  store.on('project:changed',()=>calculateQuantities(store.read()));

  // Passive compatibility bridge. It reads the legacy model; it never replaces or calls editor/render globals.
  const syncTimer=setInterval(()=>syncFromLegacy(),250);
  window.addEventListener('beforeunload',()=>clearInterval(syncTimer),{once:true});

  window.BAT_CORE_V2={
    version:VERSION,
    architecture:'parallel-safe',
    store,
    events:store.bus,
    quantityEvents:quantityBus,
    registerQuantity,
    calculateQuantities,
    getQuantities:()=>deepClone(lastQuantities),
    syncFromLegacy,
    legacySnapshot,
    deriveGeometry,
    diagnostics(){
      const project=store.get();
      return {
        version:VERSION,
        revision:project.meta?.revision||0,
        source:project.meta?.source||project.source,
        container:project.container.type,
        componentCounts:Object.fromEntries(Object.entries(project.components).map(([key,list])=>[key,list.length])),
        geometry:deepClone(project.geometry),
        quantities:deepClone(lastQuantities),
        prohibitedOverrides:[]
      };
    }
  };

  syncFromLegacy({force:true});
  console.info('[BAT Core V2] foundation active — legacy functions untouched');
})();