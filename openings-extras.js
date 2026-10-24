// WallModule variants for customer-facing openings.
// Each extra inherits a working base object and only removes features.
(function(){
  if(window.BAT_KUBIQUEITOR_OPENING_VARIANTS?.version>=2) return;

  function install(){
    if(typeof window.registerWallVariant!=='function'||typeof window.wallModuleDefinition!=='function') return false;
    if(!window.wallModuleDefinition('window')||!window.wallModuleDefinition('door')) return false;

    window.registerWallVariant({
      type:'opening',
      label:'Vano',
      icon:'fa-vector-square',
      max:8,
      extra:true,
      extends:'door',
      without:['visual.leaf','visual.frame']
    });

    window.registerWallVariant({
      type:'openingFrame',
      label:'Vano con marco metálico',
      icon:'fa-border-all',
      max:8,
      extra:true,
      extends:'door',
      without:['visual.leaf']
    });

    window.registerWallVariant({
      type:'windowOpening',
      label:'Vano de ventana',
      icon:'fa-table-cells-large',
      max:8,
      extra:true,
      extends:'window',
      without:['visual.glass','visual.frame']
    });

    window.registerWallVariant({
      type:'windowOpeningFrame',
      label:'Vano de ventana con marco',
      icon:'fa-window-restore',
      max:8,
      extra:true,
      extends:'window',
      without:['visual.glass']
    });

    window.BAT_KUBIQUEITOR_OPENING_VARIANTS={version:2,types:['opening','openingFrame','windowOpening','windowOpeningFrame']};
    try{ensureDimensionState?.();ensureLayoutState?.();renderAll?.();}catch(e){}
    return true;
  }

  if(install()) return;
  let attempts=0;
  const timer=setInterval(()=>{
    attempts++;
    if(install()){clearInterval(timer);return;}
    if(attempts>=180){clearInterval(timer);console.error('bat-kubiqueitor: opening variants no pudieron registrarse');}
  },60);
})();
