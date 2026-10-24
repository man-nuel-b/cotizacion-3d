// WallModule variants for customer-facing openings.
// Definitions only: rendering, cuts, editing and collisions belong to wall-module-engine.js.
(function(){
  if(window.BAT_KUBIQUEITOR_OPENING_VARIANTS?.version>=1) return;

  function install(){
    if(typeof window.registerWallModule!=='function'||typeof OBJECT_DIMENSIONS==='undefined'||!OBJECT_DIMENSIONS.window) return false;

    const windowFields=(OBJECT_DIMENSIONS.window.fields||[]).map(field=>({...field}));
    const windowDefaults=OBJECT_DIMENSIONS.window.defaults||(()=>({width:1.20,height:1.05,depth:.10}));
    const doorOpeningFields=[
      {key:'width',label:'Ancho',min:.50,max:12.10,step:.05},
      {key:'height',label:'Alto',min:.50,max:2.80,step:.05}
    ];

    const commonCuts={
      placement:true,
      dimensions:true,
      collision:true,
      wallCut:true,
      framingCut:true,
      insulationCut:true,
      liningCut:true,
      editor:true,
      bom:true
    };

    window.registerWallModule({
      type:'opening',
      label:'Vano',
      icon:'fa-vector-square',
      max:8,
      extra:true,
      render:'opening',
      placement:{defaultFace:'A',gap:1.00,padding:.08,inset:0},
      aperture:{kind:'door',defaultWidth:.90,defaultHeight:2.10},
      dimensions:{fields:doorOpeningFields,defaults:()=>({width:.90,height:2.10,depth:.20})},
      capabilities:{...commonCuts,frame:false,glass:false,leaf:false}
    });

    window.registerWallModule({
      type:'openingFrame',
      label:'Vano con marco metálico',
      icon:'fa-border-all',
      max:8,
      extra:true,
      render:'opening',
      placement:{defaultFace:'A',gap:1.00,padding:.08,inset:0},
      aperture:{kind:'door',defaultWidth:.90,defaultHeight:2.10},
      dimensions:{fields:doorOpeningFields,defaults:()=>({width:.90,height:2.10,depth:.20})},
      capabilities:{...commonCuts,frame:true,glass:false,leaf:false}
    });

    window.registerWallModule({
      type:'windowOpening',
      label:'Vano de ventana',
      icon:'fa-table-cells-large',
      max:8,
      extra:true,
      render:'opening',
      placement:{defaultFace:'B',gap:1.22,padding:.08,inset:0},
      aperture:{kind:'window',centerRatio:.60,defaultWidth:1.20,defaultHeight:1.05},
      dimensions:{fields:windowFields,defaults:c=>({...windowDefaults(c),depth:.20})},
      capabilities:{...commonCuts,frame:false,glass:false,leaf:false}
    });

    window.registerWallModule({
      type:'windowOpeningFrame',
      label:'Vano de ventana con marco',
      icon:'fa-window-restore',
      max:8,
      extra:true,
      render:'opening',
      placement:{defaultFace:'B',gap:1.22,padding:.08,inset:0},
      aperture:{kind:'window',centerRatio:.60,defaultWidth:1.20,defaultHeight:1.05},
      dimensions:{fields:windowFields,defaults:c=>({...windowDefaults(c),depth:.20})},
      capabilities:{...commonCuts,frame:true,glass:false,leaf:false}
    });

    window.BAT_KUBIQUEITOR_OPENING_VARIANTS={version:1,types:['opening','openingFrame','windowOpening','windowOpeningFrame']};
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
