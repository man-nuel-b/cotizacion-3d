// BAT-Cubikeitor · APU Engine V2
// Read-only pricing layer over Core V2 quantities. Never replaces buildBOM/calculate/render/editor globals.
(function(){
  if(window.BAT_APU_ENGINE_V2) return;

  const clone=value=>JSON.parse(JSON.stringify(value));
  const n=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
  const MAP={
    'surface.grateado.m2':{apuId:'excel:P44',code:'P44',name:'Preparación de superficie y anticorrosivo',unit:'m²'},
    'surface.paint.m2':{apuId:'excel:P45',code:'P45',name:'Pintura exterior',unit:'m²'}
  };

  let last={items:[],direct:0,net:0,gross:0,ready:false};

  function breakdown(apuId){
    try{
      if(typeof window.getApuExcelBreakdown==='function') return window.getApuExcelBreakdown(apuId);
    }catch(error){console.warn('[BAT APU V2] breakdown',apuId,error);}
    return null;
  }

  function calculate(){
    const core=window.BAT_CORE_V2;
    if(!core) return clone(last);
    const quantities=core.getQuantities();
    const items=[];
    let direct=0,net=0,gross=0;

    Object.entries(MAP).forEach(([quantityKey,definition])=>{
      const qty=Math.max(0,n(quantities[quantityKey]));
      if(qty<=0)return;
      const b=breakdown(definition.apuId);
      const directUnit=Math.max(0,n(b?.direct));
      const netUnit=Math.max(0,n(b?.net));
      const grossUnit=Math.max(0,n(b?.gross));
      const item={
        ...definition,
        quantityKey,
        qty,
        directUnit,
        netUnit,
        grossUnit,
        directSubtotal:qty*directUnit,
        netSubtotal:qty*netUnit,
        grossSubtotal:qty*grossUnit,
        pricingReady:Boolean(b?.apu)
      };
      direct+=item.directSubtotal;
      net+=item.netSubtotal;
      gross+=item.grossSubtotal;
      items.push(item);
    });

    last={
      items,
      direct,
      net,
      gross,
      ready:items.every(item=>item.pricingReady),
      revision:core.store.read()?.meta?.revision||0
    };
    return clone(last);
  }

  function boot(){
    const core=window.BAT_CORE_V2;
    if(!core){setTimeout(boot,50);return;}
    core.quantityEvents.on('quantities:changed',calculate);
    core.events.on('project:changed',()=>setTimeout(calculate,0));
    const timer=setInterval(()=>{
      calculate();
      if(typeof window.getApuExcelBreakdown==='function') clearInterval(timer);
    },250);

    window.BAT_APU_ENGINE_V2={
      version:2,
      mapping:clone(MAP),
      calculate,
      get:()=>clone(last),
      getSurfaceItems:()=>clone(last.items)
    };
    calculate();
    console.info('[BAT APU V2] active — no legacy overrides');
  }

  boot();
})();