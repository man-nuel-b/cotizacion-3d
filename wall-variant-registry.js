// Simple inheritance layer for wall-mounted extras.
// Rule: a variant inherits a working base object and only removes capabilities via `without`.
(function(){
  if(window.BAT_KUBIQUEITOR_WALL_VARIANT_REGISTRY) return;

  const PATH_MAP={
    'visual.frame':'frame',
    'visual.glass':'glass',
    'visual.leaf':'leaf',
    'cuts.shell':'wallCut',
    'cuts.framing':'framingCut',
    'cuts.insulation':'insulationCut',
    'cuts.lining':'liningCut',
    'editor.enabled':'editor',
    'editor':'editor',
    'collision':'collision',
    'dimensions':'dimensions',
    'placement':'placement',
    'commercial.bom':'bom',
    'bom':'bom'
  };

  function capabilityFor(path){
    if(PATH_MAP[path]) return PATH_MAP[path];
    const tail=String(path||'').split('.').pop();
    return ({frame:'frame',glass:'glass',leaf:'leaf',shell:'wallCut',framing:'framingCut',insulation:'insulationCut',lining:'liningCut',editor:'editor',collision:'collision',dimensions:'dimensions',placement:'placement',bom:'bom'})[tail]||null;
  }

  function registerVariant(input){
    if(typeof window.registerWallModule!=='function') throw new Error('WallModule engine not ready');
    if(!input?.type||!input?.extends) throw new Error('Wall variant requires type and extends');
    const base=window.wallModuleDefinition?.(input.extends);
    if(!base) throw new Error(`Wall variant base not found: ${input.extends}`);

    const capabilities={};
    (input.without||[]).forEach(path=>{
      const key=capabilityFor(path);
      if(key) capabilities[key]=false;
    });

    const dimensions=input.dimensions||base.dimensions;
    const placement=input.placement||base.placement;
    const aperture=input.aperture||base.aperture;

    return window.registerWallModule({
      ...input,
      extends:input.extends,
      render:input.render||'opening',
      placement,
      aperture,
      dimensions,
      capabilities
    });
  }

  window.registerWallVariant=registerVariant;
  window.BAT_KUBIQUEITOR_WALL_VARIANT_REGISTRY={version:1,register:registerVariant};
})();
