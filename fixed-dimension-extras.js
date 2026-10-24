// Standard-size extras: preserve physical dimensions for render/collision while disabling manual size editing.
(function(){
  if(window.BAT_KUBIQUEITOR_FIXED_DIMENSION_EXTRAS?.version>=2) return;

  const FIXED_TYPES=new Set(['wc','sink','shower','ac']);
  let wrapped=false;

  function applySchemas(){
    if(typeof OBJECT_DIMENSIONS==='undefined') return false;
    FIXED_TYPES.forEach(type=>{
      const schema=OBJECT_DIMENSIONS[type];
      if(!schema) return;
      schema.fixed=true;
      schema.fields=[];
    });
    return true;
  }

  function installGuards(){
    if(wrapped) return true;
    if(typeof dimensionsEditable!=='function'||typeof renderDimensionEditor!=='function') return false;

    const baseDimensionsEditable=dimensionsEditable;
    dimensionsEditable=function(type){
      if(FIXED_TYPES.has(type)) return false;
      return baseDimensionsEditable(type);
    };

    const baseRenderDimensionEditor=renderDimensionEditor;
    renderDimensionEditor=function(type,index){
      if(FIXED_TYPES.has(type)){
        document.getElementById('dimension-editor')?.classList.add('hidden');
        return;
      }
      return baseRenderDimensionEditor(type,index);
    };

    wrapped=true;
    return true;
  }

  function enforce(){
    const ready=applySchemas();
    installGuards();
    if(typeof selectedEditable!=='undefined'&&selectedEditable&&FIXED_TYPES.has(selectedEditable.type)){
      document.getElementById('dimension-editor')?.classList.add('hidden');
    }
    return ready&&wrapped;
  }

  enforce();

  // Legacy layers load asynchronously. Re-assert during boot so a late schema
  // cannot re-enable dimensions for standard products.
  let tries=0;
  const timer=setInterval(()=>{
    tries++;
    enforce();
    if(tries>=60) clearInterval(timer);
  },250);

  window.BAT_KUBIQUEITOR_FIXED_DIMENSION_EXTRAS={version:2,types:[...FIXED_TYPES],enforce};
})();
