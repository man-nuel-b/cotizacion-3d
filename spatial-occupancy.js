// Shared spatial occupancy registry for bat-kubiqueitor.
// Extras expose occupied volumes here so construction elements can avoid crossing them.
(function(){
  if(window.BAT_KUBIQUEITOR_SPATIAL_OCCUPANCY) return;

  const providers=new Map();

  function finite(value,fallback=0){
    const n=Number(value);
    return Number.isFinite(n)?n:fallback;
  }

  function normalizeVolume(volume){
    if(!volume) return null;
    const out={
      id:String(volume.id||''),
      type:String(volume.type||'object'),
      label:String(volume.label||'Objeto'),
      index:Number.isFinite(Number(volume.index))?Number(volume.index):null,
      minX:finite(volume.minX),maxX:finite(volume.maxX),
      minY:finite(volume.minY),maxY:finite(volume.maxY),
      minZ:finite(volume.minZ),maxZ:finite(volume.maxZ),
      blocking:volume.blocking!==false,
      source:volume.source||null
    };
    if(out.minX>out.maxX)[out.minX,out.maxX]=[out.maxX,out.minX];
    if(out.minY>out.maxY)[out.minY,out.maxY]=[out.maxY,out.minY];
    if(out.minZ>out.maxZ)[out.minZ,out.maxZ]=[out.maxZ,out.minZ];
    return out;
  }

  function registerProvider(id,provider){
    if(!id||typeof provider!=='function') return false;
    providers.set(String(id),provider);
    return true;
  }

  function unregisterProvider(id){ providers.delete(String(id)); }

  function volumes(){
    const all=[];
    providers.forEach((provider,id)=>{
      try{
        const result=provider();
        if(!Array.isArray(result)) return;
        result.forEach(item=>{
          const normalized=normalizeVolume({...item,source:item?.source||id});
          if(normalized) all.push(normalized);
        });
      }catch(error){
        console.warn(`bat-kubiqueitor: occupancy provider ${id} failed`,error);
      }
    });
    return all;
  }

  function overlaps(a,b,clearance=0){
    if(!a||!b) return false;
    const gap=Math.max(0,finite(clearance));
    return a.minX-gap<b.maxX&&a.maxX+gap>b.minX&&
      a.minZ-gap<b.maxZ&&a.maxZ+gap>b.minZ&&
      a.minY-gap<b.maxY&&a.maxY+gap>b.minY;
  }

  registerProvider('bathroom-modules',()=>{
    const api=window.BAT_KUBIQUEITOR_MODULE_PRESETS;
    const presets=api?.presets;
    if(!presets||!Array.isArray(window.state?.bathroomModules)&&typeof state==='undefined') return [];
    if(typeof state==='undefined'||!Array.isArray(state.bathroomModules)) return [];
    return state.bathroomModules.map((entry,index)=>{
      const preset=presets[entry.kind]||presets.half;
      if(!preset) return null;
      const rotation=((Math.round(finite(entry.rotation)/90)*90)%360+360)%360;
      const swap=rotation%180===90;
      const width=swap?preset.depth:preset.width;
      const depth=swap?preset.width:preset.depth;
      const x=finite(entry.x),z=finite(entry.z);
      return {
        id:`bathroom-module:${index}`,
        type:'bathroomModule',
        label:preset.name||'Módulo de baño',
        index,
        minX:x-width/2,maxX:x+width/2,
        minZ:z-depth/2,maxZ:z+depth/2,
        minY:.10,maxY:2.40,
        blocking:true
      };
    }).filter(Boolean);
  });

  registerProvider('floor-fixtures',()=>{
    if(typeof state==='undefined'||typeof actualLayout!=='function'||typeof objectDimensions!=='function') return [];
    const result=[];
    ['wc','sink','shower'].forEach(type=>{
      for(let index=0;index<(state.counts?.[type]||0);index++){
        const pos=actualLayout(type,index),dims=objectDimensions(type,index);
        if(!pos||!dims) continue;
        const width=Math.max(.10,finite(dims.width,.50));
        const depth=Math.max(.10,finite(dims.depth,.50));
        const height=Math.max(.10,finite(dims.height,.80));
        const x=finite(pos.x),z=finite(pos.z);
        result.push({
          id:`fixture:${type}:${index}`,
          type,label:type==='wc'?'WC':type==='sink'?'Lavamanos':'Ducha',index,
          minX:x-width/2,maxX:x+width/2,
          minZ:z-depth/2,maxZ:z+depth/2,
          minY:.08,maxY:.08+height,
          blocking:true
        });
      }
    });
    return result;
  });

  window.registerSpatialOccupancyProvider=registerProvider;
  window.unregisterSpatialOccupancyProvider=unregisterProvider;
  window.getSpatialOccupancyVolumes=volumes;
  window.spatialVolumesOverlap=overlaps;
  window.BAT_KUBIQUEITOR_SPATIAL_OCCUPANCY={version:1,registerProvider,unregisterProvider,volumes,overlaps};
})();
