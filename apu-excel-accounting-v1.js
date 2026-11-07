// BAT-Cubikeitor · accounting split for Excel-style APU methodology.
(function(){
  if(window.BAT_KUBIQUEITOR_APU_EXCEL_ACCOUNTING) return;
  const n=(v,f=0)=>{const x=Number(v);return Number.isFinite(x)?x:f;};

  function install(){
    if(!window.BAT_KUBIQUEITOR_APU_EXCEL_METHOD||typeof calculate!=='function')return false;
    if(calculate.__batExcelAccounting)return true;
    // Ya no se sobreescribe calculate(): el motor canonico separa todos los recursos.
    // El anterior wrapper cambiaba materiales y mano de obra SIN recalcular el costo directo.
    if(!window.BAT_KUBIQUEITOR_PRICING_INTEGRITY)return false;
    calculate.__batExcelAccounting=true;
    window.BAT_KUBIQUEITOR_APU_EXCEL_ACCOUNTING={version:1};
    try{if(typeof renderAll==='function')renderAll();}catch(e){}
    return true;
  }

  let tries=0;const timer=setInterval(()=>{tries++;if(install()||tries>120)clearInterval(timer);},100);
})();