// BAT-Cubikeitor · cargador biblioteca APU Excel
(function(){
  if(window.BAT_KUBIQUEITOR_EXCEL_APU_CATALOG) return;
  const METHOD_KEY='bat-cubikeitor-apu-excel-method-v1';

  function buildSeed(){
    const R=window.BAT_EXCEL_APU_R||[],A=window.BAT_EXCEL_APU_A||[];
    if(R.length<123||A.length<60)return null;
    const resources=Object.fromEntries(R.map(([code,type,name,unit,price])=>{
      const id=`excel:${code}`;
      return [id,{id,type,source:'excel',sourceKey:code,code,name,unit,price}];
    }));
    const apus={},crews={};
    A.forEach(([code,name,unit,group,yieldPerDay,masters,helpers,role,parts])=>{
      const id=`excel:${code}`;
      apus[id]={
        id,name:`${code} · ${name}`,unit,group,measurement:'manual',
        components:parts.map(([resourceCode,qty,waste])=>({resourceId:`excel:${resourceCode}`,qty,waste,yield:1})),
        excelCode:code,source:'APU_Contenedores_Chile_v2.xlsx'
      };
      crews[id]={yield:yieldPerDay,masters,helpers,role,unit};
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
    const seed=buildSeed();
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
