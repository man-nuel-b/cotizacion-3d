// Keeps the commercial wizard in the approved seven-step order even when legacy layers load later.
(function(){
  if(window.BAT_KUBIQUEITOR_SIX_STEP_SUPERVISOR) return;
  window.BAT_KUBIQUEITOR_SIX_STEP_SUPERVISOR=true;

  let revision=0;
  let loading=false;

  function chipLabels(){
    return [...document.querySelectorAll('.config-panel .step-chip')].map(el=>(el.textContent||'').trim());
  }

  function isCorrect(){
    const labels=chipLabels();
    return labels.length===7 &&
      labels[2]?.includes('Piso') &&
      labels[3]?.includes('Paredes') &&
      labels[4]?.includes('Electricidad') &&
      labels[5]?.includes('Extras') &&
      labels[6]?.includes('Cotizar');
  }

  function loadApprovedWizard(){
    if(loading||isCorrect()) return;
    loading=true;
    revision++;
    const script=document.createElement('script');
    script.src=`wizard-interior-step.js?v=20261023-41-${revision}`;
    script.dataset.sixStepWizardOverride='true';
    script.addEventListener('load',()=>{
      loading=false;
      setTimeout(()=>{
        window.BAT_KUBIQUEITOR_ELECTRICITY_STEP?.install?.();
        if(typeof goStep==='function'&&typeof state!=='undefined') goStep(Math.min(Math.max(Number(state.step)||1,1),7));
      },30);
    },{once:true});
    script.addEventListener('error',()=>{loading=false;},{once:true});
    document.body.appendChild(script);
  }

  let ticks=0;
  const timer=setInterval(()=>{
    ticks++;
    const legacyReady=Boolean(window.BAT_KUBIQUEITOR_PRODUCTION_SUITE);
    if((legacyReady||ticks>40)&&!isCorrect()){
      if(window.BAT_KUBIQUEITOR_ELECTRICITY_STEP?.install?.()){
        if(isCorrect()&&ticks>120) clearInterval(timer);
        return;
      }
      loadApprovedWizard();
    }
    if(isCorrect()&&ticks>120) clearInterval(timer);
    if(ticks>240) clearInterval(timer);
  },100);
})();
