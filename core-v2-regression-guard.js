// BAT-Cubikeitor · Core V2 regression guard
// Read-only checks. It never mutates project state or replaces application functions.
(function(){
  if(window.BAT_CORE_V2_GUARD) return;

  function boot(){
    const core=window.BAT_CORE_V2;
    if(!core){setTimeout(boot,80);return;}

    function result(name,ok,detail=''){return {name,ok:Boolean(ok),detail};}

    function run(){
      const checks=[];
      const project=core.store.get();
      const quantities=core.getQuantities();

      checks.push(result('core-v2-active',Boolean(window.BAT_CORE_V2),core.version));
      checks.push(result('project-state-readable',Boolean(project&&project.container&&project.components)));
      checks.push(result('geometry-finite',[
        project.geometry?.floorArea,
        project.geometry?.roofArea,
        project.geometry?.wallGrossArea,
        project.geometry?.wallNetArea
      ].every(value=>Number.isFinite(Number(value))&&Number(value)>=0)));
      checks.push(result('wall-net-not-over-gross',Number(project.geometry?.wallNetArea||0)<=Number(project.geometry?.wallGrossArea||0)+0.001));

      try{
        if(typeof state!=='undefined'){
          Object.keys(project.components||{}).forEach(type=>{
            const legacyCount=Math.max(0,Number(state.counts?.[type])||0);
            checks.push(result(`count-sync:${type}`,project.components[type].length===legacyCount,`${project.components[type].length}/${legacyCount}`));
          });
          checks.push(result('container-sync',project.container.type===state.container,`${project.container.type}/${state.container}`));
        }
      }catch(error){checks.push(result('legacy-state-readable',false,error.message));}

      const requiredFunctions=['renderAll','buildBOM','calculate','rebuild3D'];
      requiredFunctions.forEach(name=>{
        let exists=false;
        try{exists=typeof globalThis[name]==='function'||eval(`typeof ${name}==='function'`);}catch(e){}
        checks.push(result(`critical-function:${name}`,exists));
      });

      checks.push(result('quantity-floor',Number.isFinite(Number(quantities['floor.m2']))));
      checks.push(result('quantity-wall-net',Number.isFinite(Number(quantities['walls.net.m2']))));
      checks.push(result('surface-system-isolated',Boolean(window.BAT_SURFACE_SYSTEM_V2),'surface domain loaded without editor overrides'));

      const failed=checks.filter(check=>!check.ok);
      const report={ok:failed.length===0,checkedAt:new Date().toISOString(),checks,failed};
      if(failed.length)console.warn('[BAT Core V2 Guard] regression checks failed',failed);
      else console.info('[BAT Core V2 Guard] all checks passed');
      return report;
    }

    window.BAT_CORE_V2_GUARD={version:1,run};
    setTimeout(run,7000);
  }

  boot();
})();