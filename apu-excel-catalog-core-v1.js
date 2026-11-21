// BAT-Cubikeitor · cargador biblioteca APU Excel
(function(){
  if(window.BAT_KUBIQUEITOR_EXCEL_APU_CATALOG) return;
  const METHOD_KEY='bat-cubikeitor-apu-excel-method-v1';

  function buildSeed(){
    const R=window.BAT_EXCEL_APU_R||[],A=window.BAT_EXCEL_APU_A||[];
    if(R.length<123||A.length<60)return null;
    // Bundled source is JavaScript arrays, not a live Google Sheets/CSV feed.
    // Fail closed on malformed cells: a missing price must never become $0.
    const requiredText=(value,label)=>{
      if(typeof value!=='string'||!value.trim())throw new Error('Dato APU obligatorio: '+label);
      return value.trim();
    };
    const finite=(value,label,allowZero=true)=>{
      if(value===null||value===undefined||value==='')throw new Error('Celda APU vacía: '+label);
      const n=Number(value);
      if(!Number.isFinite(n)||n<0||(!allowZero&&n===0))throw new Error('Valor APU inválido: '+label);
      return n;
    };
    const resources=Object.create(null);
    R.forEach(([code,type,name,unit,price],index)=>{
      const key=requiredText(code,'recurso código '+index);
      const id=`excel:${key}`;
      if(resources[id])throw new Error('Recurso APU duplicado: '+key);
      resources[id]={id,type:requiredText(type,key+' tipo'),source:'excel',sourceKey:key,code:key,
        name:requiredText(name,key+' nombre'),unit:requiredText(unit,key+' unidad'),price:finite(price,key+' precio')};
    });
    const apus={},crews={};
    A.forEach(([code,name,unit,group,yieldPerDay,masters,helpers,role,parts],index)=>{
      const key=requiredText(code,'partida código '+index),id=`excel:${key}`;
      if(apus[id])throw new Error('Partida APU duplicada: '+key);
      if(!Array.isArray(parts))throw new Error('Partida sin recursos: '+key);
      const components=parts.map(([resourceCode,qty,waste],i)=>{
        const resourceId=`excel:${requiredText(resourceCode,key+' recurso '+i)}`;
        if(!resources[resourceId])throw new Error('Referencia APU desconocida: '+resourceId);
        return {resourceId,qty:finite(qty,key+' cantidad '+i),waste:finite(waste,key+' merma '+i),yield:1};
      });
      apus[id]={id,name:`${key} · ${requiredText(name,key+' nombre')}`,
        unit:requiredText(unit,key+' unidad'),group:requiredText(group,key+' grupo'),measurement:'manual',
        components,excelCode:key,source:'APU_Contenedores_Chile_v2.xlsx'};
      crews[id]={yield:finite(yieldPerDay,key+' rendimiento',false),
        masters:finite(masters,key+' maestros'),helpers:finite(helpers,key+' ayudantes'),
        role:requiredText(role,key+' oficio'),unit:requiredText(unit,key+' unidad')};
    });
    return {resources,apus,crews};
  }

  function mergeCrews(crews){
    try{
      const saved=JSON.parse(localStorage.getItem(METHOD_KEY)||'{}');
      if(!saved.crews||typeof saved.crews!=='object')saved.crews={};
      let changed=false;
      Object.entries(crews).forEach(([id,crew])=>{
        if(!saved.crews[id]){saved.crews[id]=crew;changed=true;}
      });
      if(changed)localStorage.setItem(METHOD_KEY,JSON.stringify(saved));
    }catch(e){console.warn('[BAT APU Excel] crews',e);}
  }

  function mergeCatalog(){
    let seed;
    try{seed=buildSeed();}catch(error){
      console.error('[BAT APU Excel] catálogo rechazado',error);
      window.BAT_KUBIQUEITOR_EXCEL_APU_CATALOG={version:2,error:error.message,valid:false};
      return 'invalid';
    }
    if(!seed||typeof getApuMaster!=='function'||typeof importApuMaster!=='function')return false;
    let current;
    try{current=getApuMaster();}catch(e){return false;}
    if(!current?.resources||!current?.apus)return false;
    let changed=false;
    Object.entries(seed.resources).forEach(([id,item])=>{
      if(!current.resources[id]){current.resources[id]=item;changed=true;}
    });
    Object.entries(seed.apus).forEach(([id,item])=>{
      if(!current.apus[id]){current.apus[id]=item;changed=true;}
    });
    mergeCrews(seed.crews);
    if(changed){
      try{
        const file=new File([JSON.stringify(current)],'bat-cubikeitor-apu-excel-catalog.json',{type:'application/json'});
        importApuMaster({files:[file],value:'seed'});
      }catch(e){console.warn('[BAT APU Excel] import',e);}
    }
    window.BAT_KUBIQUEITOR_EXCEL_APU_CATALOG={
      version:1,source:'APU_Contenedores_Chile_v2.xlsx',
      partidas:Object.keys(seed.apus).length,recursos:Object.keys(seed.resources).length
    };
    return true;
  }

  let tries=0;
  const timer=setInterval(()=>{
    tries++;
    if(mergeCatalog()||tries>120)clearInterval(timer);
  },100);
})();
