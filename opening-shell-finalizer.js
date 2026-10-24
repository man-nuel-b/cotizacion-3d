// Final ownership pass for shell openings.
// Removes legacy opening overlays after each rebuild so only true shell apertures remain.
(function(){
  if(window.BAT_KUBIQUEITOR_OPENING_SHELL_FINALIZER) return;
  window.BAT_KUBIQUEITOR_OPENING_SHELL_FINALIZER={version:1};

  const TYPES=['opening','openingFrame','windowOpening','windowOpeningFrame'];

  function removeLegacyOpeningVisuals(){
    if(typeof containerGroup==='undefined'||!containerGroup) return;

    [...containerGroup.children].forEach(child=>{
      if(child?.userData?.finalOpeningVisual){
        containerGroup.remove(child);
      }
    });

    if(Array.isArray(editableObjects)){
      const currentRoots=new Set(containerGroup.children);
      editableObjects=editableObjects.filter(root=>{
        const type=root?.userData?.editor?.type;
        if(!TYPES.includes(type)) return true;
        if(root?.userData?.trueOpeningDetail) return true;
        return currentRoots.has(root)&&!root?.userData?.finalOpeningVisual;
      });
    }
  }

  function install(){
    if(!window.BAT_KUBIQUEITOR_OPENING_SHELL||typeof rebuild3D!=='function') return false;
    const baseRebuild=rebuild3D;
    rebuild3D=function(){
      baseRebuild();
      removeLegacyOpeningVisuals();
    };
    removeLegacyOpeningVisuals();
    rebuild3D();
    return true;
  }

  let tries=0;
  const timer=setInterval(()=>{
    tries++;
    if(install()){clearInterval(timer);return;}
    if(tries>=180){clearInterval(timer);console.error('bat-kubiqueitor: opening-shell-finalizer no pudo instalarse');}
  },80);
})();