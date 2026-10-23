// Progressive project start for bat-kubiqueitor.
// New projects begin with only the shipping container. Objects are added deliberately by the user.
(function(){
  if(window.BAT_KUBIQUEITOR_PROGRESSIVE_START) return;
  if(typeof DATA==='undefined'||typeof DEFAULT_STATE==='undefined'||typeof state==='undefined') return;

  const EMPTY_COUNTS={
    window:0,
    door:0,
    partition:0,
    wc:0,
    sink:0,
    shower:0,
    ac:0,
    electrical:0
  };

  // Preserve the old preset quantities as recommendations for a future assistant/suggestion UI,
  // but never auto-place them in the model.
  Object.values(DATA.solutions||{}).forEach(solution=>{
    if(!solution) return;
    if(!solution.recommendedCounts) solution.recommendedCounts={...(solution.counts||{})};
    solution.counts={...EMPTY_COUNTS};
  });

  // A new project opens as a clean 20 HC container with no added objects or decorative furniture.
  DEFAULT_STATE.solution='custom';
  DEFAULT_STATE.container='20hc';
  DEFAULT_STATE.finish='standard';
  DEFAULT_STATE.counts={...EMPTY_COUNTS};
  DEFAULT_STATE.showPeople=false;
  DEFAULT_STATE.showFurniture=false;

  // The initial state was cloned before this file loaded. Only replace it when there is no
  // saved user project, so Guardar/Cargar continues to work as expected.
  let hasSavedProject=false;
  try{
    hasSavedProject=Boolean(
      localStorage.getItem('modular-config-v3')||
      localStorage.getItem('modular-config-v2')
    );
  }catch(e){}

  if(!hasSavedProject){
    state=clone(DEFAULT_STATE);
  }

  // No solution type is allowed to inject presentation furniture automatically.
  // Furniture can still be shown later through the existing furniture control/workflow.
  if(typeof addFurnishings==='function'){
    const baseAddFurnishings=addFurnishings;
    addFurnishings=function(parent,c){
      if(state.showFurniture===false) return;
      return baseAddFurnishings(parent,c);
    };
  }

  // The legacy renderer always generated one ceiling lamp even with zero electrical points.
  // Return an empty group until the first electrical point is intentionally added.
  if(typeof createCeilingLight==='function'){
    const baseCreateCeilingLight=createCeilingLight;
    createCeilingLight=function(length=.65){
      if((state.counts?.electrical||0)<=0) return new THREE.Group();
      return baseCreateCeilingLight(length);
    };
  }

  window.EMPTY_PROJECT_COUNTS={...EMPTY_COUNTS};
  window.BAT_KUBIQUEITOR_PROGRESSIVE_START={version:2};
})();
