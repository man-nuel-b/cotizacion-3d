// Dedicated Electricity wizard step layered on top of the stable six-step wizard.
// Moves the existing electrical UI without changing pricing/state logic.
(function(){
  if(window.BAT_KUBIQUEITOR_ELECTRICITY_STEP) return;

  const VERSION=1;
  let installed=false;

  function panel(){return document.querySelector('.config-panel');}
  function chipsWrap(){return panel()?.querySelector('.step-chip')?.parentElement||null;}

  function moveElectricalPanel(){
    const target=document.getElementById('electricity-step-content');
    const electrical=document.getElementById('electrical-stage1-panel');
    if(target&&electrical&&electrical.parentElement!==target) target.appendChild(electrical);
    return Boolean(target&&electrical);
  }

  function rewriteChips(){
    const wrap=chipsWrap();
    if(!wrap) return false;
    wrap.className='grid grid-cols-7 gap-1';
    wrap.innerHTML=`
      <button class="step-chip border rounded-xl py-2 text-[9px] font-bold" onclick="goStep(1)">1. Uso</button>
      <button class="step-chip border rounded-xl py-2 text-[9px] font-bold text-slate-500" onclick="goStep(2)">2. Base</button>
      <button class="step-chip border rounded-xl py-2 text-[9px] font-bold text-slate-500" onclick="goStep(3)">3. Piso</button>
      <button class="step-chip border rounded-xl py-2 text-[9px] font-bold text-slate-500" onclick="goStep(4)">4. Paredes</button>
      <button class="step-chip border rounded-xl py-2 text-[9px] font-bold text-slate-500" onclick="goStep(5)">5. Electricidad</button>
      <button class="step-chip border rounded-xl py-2 text-[9px] font-bold text-slate-500" onclick="goStep(6)">6. Extras</button>
      <button class="step-chip border rounded-xl py-2 text-[9px] font-bold text-slate-500" onclick="goStep(7)">7. Cotizar</button>`;
    return true;
  }

  function ensureElectricityStep(){
    const root=panel();
    const walls=root?.querySelector('.wizard-step[data-step="4"]');
    let extras=[...root?.querySelectorAll('.wizard-step')||[]].find(el=>{
      const title=el.querySelector('h2')?.textContent||'';
      return /extra/i.test(title);
    });
    let quote=[...root?.querySelectorAll('.wizard-step')||[]].find(el=>{
      const title=el.querySelector('h2')?.textContent||'';
      return /cotiz|presupuesto|resumen/i.test(title);
    });
    if(!root||!walls||!extras||!quote) return false;

    let electricity=document.getElementById('electricity-wizard-step');
    if(!electricity){
      electricity=document.createElement('section');
      electricity.id='electricity-wizard-step';
      electricity.className='wizard-step hidden';
      electricity.dataset.step='5';
      electricity.innerHTML=`
        <div class="text-[11px] font-black uppercase tracking-widest text-amber-600">Paso 5</div>
        <h2 class="text-xl font-black mt-1">Electricidad</h2>
        <p class="text-sm text-slate-500 mt-1 mb-4">Define enchufes, interruptores, luminarias y puntos para aire acondicionado.</p>
        <div id="electricity-step-content"></div>
        <div class="flex gap-2 mt-5">
          <button onclick="goStep(4)" class="w-1/3 bg-slate-100 py-3 rounded-xl font-bold text-sm">Atrás</button>
          <button onclick="goStep(6)" class="flex-1 bg-slate-950 text-white py-3 rounded-xl font-bold text-sm">Extras <i class="fa-solid fa-arrow-right ml-1"></i></button>
        </div>`;
      extras.parentElement.insertBefore(electricity,extras);
    }

    extras.dataset.step='6';
    const extrasKicker=extras.querySelector('.text-amber-600');
    if(extrasKicker) extrasKicker.textContent='Paso 6';
    const extrasActions=[...extras.querySelectorAll('.flex.gap-2.mt-5')][0];
    if(extrasActions) extrasActions.innerHTML=`<button onclick="goStep(5)" class="w-1/3 bg-slate-100 py-3 rounded-xl font-bold text-sm">Atrás</button><button onclick="goStep(7)" class="flex-1 bg-amber-500 text-slate-950 py-3 rounded-xl font-black text-sm">Cotizar</button>`;

    quote.dataset.step='7';
    const quoteKicker=quote.querySelector('.text-amber-600');
    if(quoteKicker) quoteKicker.textContent='Paso 7';
    const quoteBack=[...quote.querySelectorAll('button')].find(btn=>(btn.textContent||'').includes('Volver a editar'));
    if(quoteBack) quoteBack.setAttribute('onclick','goStep(6)');
    const summaryQuote=[...document.querySelectorAll('.summary-panel button')].find(btn=>(btn.textContent||'').includes('Cotizar este diseño'));
    if(summaryQuote) summaryQuote.setAttribute('onclick','goStep(7)');

    const wallActions=[...walls.querySelectorAll('.flex.gap-2.mt-5')][0];
    if(wallActions) wallActions.innerHTML=`<button onclick="goStep(3)" class="w-1/3 bg-slate-100 py-3 rounded-xl font-bold text-sm">Atrás</button><button onclick="goStep(5)" class="flex-1 bg-slate-950 text-white py-3 rounded-xl font-bold text-sm">Electricidad <i class="fa-solid fa-arrow-right ml-1"></i></button>`;

    return true;
  }

  function installStyles(){
    if(document.getElementById('electricity-step-style')) return;
    const style=document.createElement('style');
    style.id='electricity-step-style';
    style.textContent=`
      #electricity-step-content #electrical-stage1-panel{margin-top:0!important}
      @media(max-width:520px){.config-panel .grid-cols-7{grid-template-columns:repeat(7,minmax(72px,1fr));overflow-x:auto;padding-bottom:4px}.config-panel .grid-cols-7 .step-chip{white-space:nowrap}}
    `;
    document.head.appendChild(style);
  }

  function installNavigation(){
    if(typeof window.goStep!=='function'||typeof state==='undefined') return false;
    const baseGoStep=window.goStep;
    window.goStep=function(step){
      const target=Math.min(Math.max(Number(step)||1,1),7);
      state.step=target;
      document.querySelectorAll('.wizard-step').forEach(el=>el.classList.toggle('hidden',Number(el.dataset.step)!==target));
      document.querySelectorAll('.step-chip').forEach((el,idx)=>{
        const active=idx+1===target;
        el.classList.toggle('active',active);
        el.classList.toggle('text-slate-500',!active);
      });
      if(target===3&&typeof window.renderFloorFinishUI==='function') window.renderFloorFinishUI();
      if(target===4&&typeof window.BAT_KUBIQUEITOR_SIX_STEP_WIZARD?.ensureWalls==='function') window.BAT_KUBIQUEITOR_SIX_STEP_WIZARD.ensureWalls();
      if(target===5){
        window.BAT_KUBIQUEITOR_ELECTRICAL_UI_STAGE1?.refresh?.();
        moveElectricalPanel();
      }
      if(target!==5&&typeof baseGoStep==='function'&&target<=4){
        // Base wizard owns the first four steps; DOM state above remains authoritative.
      }
      if(window.innerWidth<821) document.querySelector('.config-panel')?.scrollIntoView({behavior:'smooth',block:'start'});
    };
    return true;
  }

  function install(){
    if(installed){moveElectricalPanel();return true;}
    const root=panel();
    if(!root||typeof window.goStep!=='function'||typeof state==='undefined') return false;
    if(!ensureElectricityStep()) return false;
    rewriteChips();
    installStyles();
    installNavigation();
    moveElectricalPanel();
    installed=true;
    const current=Math.min(Math.max(Number(state.step)||1,1),7);
    window.goStep(current);
    return true;
  }

  let tries=0;
  const timer=setInterval(()=>{
    tries++;
    if(install()){
      moveElectricalPanel();
      if(document.getElementById('electrical-stage1-panel')) clearInterval(timer);
    }
    if(tries>160) clearInterval(timer);
  },100);

  window.BAT_KUBIQUEITOR_ELECTRICITY_STEP={version:VERSION,install,moveElectricalPanel};
})();
