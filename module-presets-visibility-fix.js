// Visibility/discoverability patch for preset bathroom modules.
// Keeps the core module system untouched and only improves initial placement.
(function(){
  if(window.BAT_KUBIQUEITOR_MODULE_VISIBILITY_FIX) return;

  function presetSize(kind){
    if(kind==='full') return {width:2.02,depth:1.12};
    if(kind==='half') return {width:1.38,depth:1.02};
    return null;
  }

  function canCenterModule(module,index){
    if(!module||!state||!DATA?.containers?.[state.container]) return false;
    const size=presetSize(module.kind); if(!size) return false;
    const c=DATA.containers[state.container];
    const rotation=((Number(module.rotation)||0)%360+360)%360;
    const swap=rotation===90||rotation===270;
    const width=swap?size.depth:size.width;
    const depth=swap?size.width:size.depth;
    if(width>c.length-.24||depth>c.width-.20) return false;

    // Avoid forcing a centered position when the user already has sanitary fixtures
    // or another preset module occupying the middle of the container.
    if((state.counts?.wc||0)||(state.counts?.sink||0)||(state.counts?.shower||0)) return false;
    for(let i=0;i<(state.bathroomModules||[]).length;i++){
      if(i===index) continue;
      const other=state.bathroomModules[i];
      if(Math.abs(Number(other.x)||0)<1.25&&Math.abs(Number(other.z)||0)<.95) return false;
    }
    return true;
  }

  function centerFirstAutoPlacedModule(){
    if(!Array.isArray(state?.bathroomModules)||state.bathroomModules.length!==1) return false;
    const m=state.bathroomModules[0];
    const size=presetSize(m.kind); if(!size||!canCenterModule(m,0)) return false;
    const c=DATA.containers[state.container];
    const expectedX=-c.length/2+size.width/2+.18;
    const expectedZ=-c.width/2+size.depth/2+.14;
    const looksAutoPlaced=Math.abs((Number(m.x)||0)-expectedX)<.35&&Math.abs((Number(m.z)||0)-expectedZ)<.35;
    if(!looksAutoPlaced) return false;
    m.x=0;m.z=0;
    if(typeof renderAll==='function') renderAll();
    return true;
  }

  function install(){
    if(typeof window.addBathroomModule!=='function') return false;
    const baseAdd=window.addBathroomModule;
    window.addBathroomModule=function(kind){
      const before=Array.isArray(state?.bathroomModules)?state.bathroomModules.length:0;
      baseAdd(kind);
      const after=Array.isArray(state?.bathroomModules)?state.bathroomModules.length:0;
      if(after===before+1&&after===1){
        const m=state.bathroomModules[0];
        if(canCenterModule(m,0)){
          m.x=0;m.z=0;
          if(typeof renderAll==='function') renderAll();
        }
      }
    };
    centerFirstAutoPlacedModule();
    window.BAT_KUBIQUEITOR_MODULE_VISIBILITY_FIX={version:1};
    return true;
  }

  let attempts=0;
  const timer=setInterval(()=>{
    attempts++;
    if(install()||attempts>20) clearInterval(timer);
  },50);
})();
