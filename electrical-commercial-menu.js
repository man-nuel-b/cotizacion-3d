// Commercial electrical catalog compatibility layer.
// Keeps the legacy `electrical` key for saved projects/BOM while the user-facing
// workflow is owned by the dedicated Electricidad panel (Enchufe/Interruptor/Luminaria).
(function(){
  if(window.BAT_KUBIQUEITOR_ELECTRICAL_COMMERCIAL_MENU?.version>=1) return;

  function applyCommercialNames(){
    if(typeof DATA==='undefined') return false;
    if(DATA.extras?.electrical) DATA.extras.electrical.name='Enchufe';
    if(DATA.catalog?.electrical){
      DATA.catalog.electrical.name='Material enchufe';
      DATA.catalog.electrical.unit='unidad';
    }
    return true;
  }

  function removeLegacyElectricalCounter(){
    const root=document.getElementById('extras-list');
    if(!root) return false;
    const button=[...root.querySelectorAll('button')].find(btn=>(btn.getAttribute('onclick')||'').includes("adjustCount('electrical'"));
    if(button?.parentElement) button.parentElement.remove();
    return true;
  }

  function installRenderOwner(){
    if(typeof renderExtras!=='function') return false;
    if(!renderExtras.__electricalCommercialMenu){
      const baseRenderExtras=renderExtras;
      const wrapped=function(...args){
        const result=baseRenderExtras(...args);
        removeLegacyElectricalCounter();
        return result;
      };
      wrapped.__electricalCommercialMenu=true;
      renderExtras=wrapped;
    }
    return true;
  }

  function install(){
    if(!applyCommercialNames()) return false;
    if(!installRenderOwner()) return false;
    removeLegacyElectricalCounter();
    if(typeof renderSummary==='function') renderSummary();
    window.BAT_KUBIQUEITOR_ELECTRICAL_COMMERCIAL_MENU={version:1};
    return true;
  }

  let tries=0;
  const timer=setInterval(()=>{
    tries++;
    if(install()||tries>=120) clearInterval(timer);
  },80);
})();
