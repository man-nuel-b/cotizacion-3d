// Standard-size extras: keep physical dimensions for render/collision, hide manual dimension editing.
(function(){
  if(window.BAT_KUBIQUEITOR_FIXED_DIMENSION_EXTRAS) return;

  const FIXED_TYPES=['wc','sink','shower','ac'];

  function applyFixedDimensionPolicy(){
    if(typeof OBJECT_DIMENSIONS==='undefined') return false;

    FIXED_TYPES.forEach(type=>{
      const schema=OBJECT_DIMENSIONS[type];
      if(!schema) return;
      schema.fixed=true;
      schema.fields=[];
    });

    if(typeof selectedEditable!=='undefined'&&selectedEditable&&FIXED_TYPES.includes(selectedEditable.type)){
      document.getElementById('dimension-editor')?.classList.add('hidden');
    }

    window.BAT_KUBIQUEITOR_FIXED_DIMENSION_EXTRAS={version:1,types:[...FIXED_TYPES]};
    return true;
  }

  if(!applyFixedDimensionPolicy()){
    let tries=0;
    const timer=setInterval(()=>{
      tries++;
      if(applyFixedDimensionPolicy()||tries>80) clearInterval(timer);
    },100);
  }
})();
