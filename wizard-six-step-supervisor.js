// Keeps the commercial wizard in the approved six-step order even when legacy layers load later.
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
    return labels.length===6 &&
      labels[2]?.includes('Piso') &&
      labels[3]?.includes('Paredes') &&
      labels[4]?.includes('Extras') &&
      labels[5]?.includes('Cotizar');
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
        if(typeof goStep==='function'&&typeof state!=='undefined') goStep(Math.min(Math.max(Number(state.step)||1,1),6));
      },30);
    },{once:true});
    script.addEventListener('error',()=>{loading=false;},{once:true});
    document.body.appendChild(script);
  }

  let ticks=0;
  const timer=setInterval(()=>{
    ticks++;
    const legacyReady=Boolean(window.BAT_KUBIQUEITOR_PRODUCTION_SUITE);
    if((legacyReady||ticks>40)&&!isCorrect()) loadApprovedWizard();
    if(isCorrect()&&ticks>120) clearInterval(timer);
    if(ticks>240) clearInterval(timer);
  },100);
})();
