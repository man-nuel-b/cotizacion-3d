// BAT-Cubikeitor · Surface System V2
// Owns surface selections only. No render/BOM/editor global overrides.
(function(){
  if(window.BAT_SURFACE_SYSTEM_V2) return;

  function boot(){
    const core=window.BAT_CORE_V2;
    if(!core){setTimeout(boot,40);return;}

    const FACES=['A','B','C','D','E'];
    const TYPES=['paint','grateado'];

    function validate(type,face){
      if(!TYPES.includes(type))throw new Error(`Unknown surface treatment: ${type}`);
      if(!FACES.includes(face))throw new Error(`Unknown face: ${face}`);
    }

    function selectedArea(project,type){
      const selection=project.surfaces?.[type]||{};
      return FACES.reduce((total,face)=>{
        if(!selection[face])return total;
        const metric=project.geometry?.faces?.[face];
        if(!metric)return total;
        // Wall treatments use net area after openings. Roof uses gross roof area.
        return total+(face==='E'?Number(metric.grossArea||0):Number(metric.netArea||0));
      },0);
    }

    core.registerQuantity('surface.paint.m2',project=>selectedArea(project,'paint'));
    core.registerQuantity('surface.grateado.m2',project=>selectedArea(project,'grateado'));

    function setFace(type,face,enabled){
      validate(type,face);
      core.store.patch(project=>{
        project.surfaces=project.surfaces||{};
        project.surfaces[type]=project.surfaces[type]||{};
        project.surfaces[type][face]=Boolean(enabled);
      },{source:`surface:${type}`});
    }

    function toggleFace(type,face){
      validate(type,face);
      const current=Boolean(core.store.read()?.surfaces?.[type]?.[face]);
      setFace(type,face,!current);
      return !current;
    }

    function setFaces(type,faces){
      if(!TYPES.includes(type))throw new Error(`Unknown surface treatment: ${type}`);
      const selected=new Set((faces||[]).filter(face=>FACES.includes(face)));
      core.store.patch(project=>{
        project.surfaces=project.surfaces||{};
        project.surfaces[type]=Object.fromEntries(FACES.map(face=>[face,selected.has(face)]));
      },{source:`surface:${type}`});
    }

    function clear(type){setFaces(type,[]);}
    function snapshot(){
      const project=core.store.get();
      const quantities=core.getQuantities();
      return {
        paint:{faces:{...project.surfaces.paint},m2:Number(quantities['surface.paint.m2']||0)},
        grateado:{faces:{...project.surfaces.grateado},m2:Number(quantities['surface.grateado.m2']||0)}
      };
    }

    window.BAT_SURFACE_SYSTEM_V2={
      version:2,
      faces:FACES.slice(),
      types:TYPES.slice(),
      setFace,
      toggleFace,
      setFaces,
      clear,
      snapshot,
      selectedArea
    };
    console.info('[BAT Surface V2] active — isolated from wall editor');
  }

  boot();
})();