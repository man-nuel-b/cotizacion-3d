// BAT-Cubikeitor · accounting split for Excel-style APU methodology.
(function(){
  if(window.BAT_KUBIQUEITOR_APU_EXCEL_ACCOUNTING) return;
  const n=(v,f=0)=>{const x=Number(v);return Number.isFinite(x)?x:f;};

  function install(){
    if(!window.BAT_KUBIQUEITOR_APU_EXCEL_METHOD||typeof calculate!=='function')return false;
    if(calculate.__batExcelAccounting)return true;
    const before=calculate;
    calculate=function(){
      const result=before.apply(this,arguments)||{};
      const bom=Array.isArray(result.bom)?result.bom:[];
      let apuMaterials=0,apuLabor=0,nonApuMaterials=0;
      bom.forEach(item=>{
        if(item?.excelApu&&item.apuBreakdown){
          const q=Math.max(0,n(item.qty));
          apuMaterials+=q*(n(item.apuBreakdown.materials)+n(item.apuBreakdown.equipment)+n(item.apuBreakdown.tools));
          apuLabor+=q*n(item.apuBreakdown.labor);
        }else nonApuMaterials+=n(item?.subtotal);
      });
      const externalLabor=Math.max(0,n(result.labor));
      return {...result,materials:nonApuMaterials+apuMaterials,labor:externalLabor+apuLabor,apuMaterials,apuLabor,nonApuMaterials};
    };
    calculate.__batExcelAccounting=true;
    window.BAT_KUBIQUEITOR_APU_EXCEL_ACCOUNTING={version:1};
    try{if(typeof renderAll==='function')renderAll();}catch(e){}
    return true;
  }

  let tries=0;const timer=setInterval(()=>{tries++;if(install()||tries>120)clearInterval(timer);},100);
})();