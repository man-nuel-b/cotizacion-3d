// Dedicated Electricity wizard step layered on top of the stable six-step wizard.
// Moves the existing electrical UI without changing pricing/state logic.
(function(){
  if(window.BAT_KUBIQUEITOR_ELECTRICITY_STEP?.version>=3) return;

  const VERSION=3;
  let installed=false;

  function panel(){return document.querySelector('.config-panel');}
  function chipsWrap(){return panel()?.querySelector('.step-chip')?.parentElement||null;}

  function moveElectricalPanel(){
    const target=document.getElementById('electricity-step-content');
    const electrical=document.getElementById('electrical-stage1-panel');
    if(target&&electrical&&electrical.parentElement!==target) target.appendChild(electrical);
    return Boolean(target&&electrical);
  }

  function stepChip(step,label){
    return `<button class="step-chip wizard-progress-chip${step===1?' active':''}" data-wizard-step="${step}" onclick="goStep(${step})" type="button"><span class="wizard-step-number">${step}</span><span class="wizard-step-label">${label}</span></button>`;
  }

  function rewriteChips(){
    const wrap=chipsWrap();
    if(!wrap) return false;
    wrap.className='wizard-progress-track';
    wrap.innerHTML=[
      stepChip(1,'Uso'),
      stepChip(2,'Base'),
      stepChip(3,'Piso'),
      stepChip(4,'Paredes'),
      stepChip(5,'Electricidad'),
      stepChip(6,'Extras'),
      stepChip(7,'Cotizar')
    ].join('');
    return true;
  }

  function ensureElectricityStep(){
    const root=panel();
    const walls=root?.querySelector('.wizard-step[data-step="4"]');
    const extras=root?.querySelector('.wizard-step[data-step="5"]');
    const quote=root?.querySelector('.wizard-step[data-step="6"]');
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
    let style=document.getElementById('electricity-step-style');
    if(!style){
      style=document.createElement('style');
      style.id='electricity-step-style';
      document.head.appendChild(style);
    }
    style.textContent=`
      #electricity-step-content #electrical-stage1-panel{margin-top:0!important}
      .wizard-progress-track{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:7px;align-items:stretch}
      .wizard-progress-chip{position:relative;min-width:0;height:64px;padding:8px 3px 7px;border:1px solid #e2e8f0;border-radius:15px;background:#fff;color:#64748b;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;transition:all .18s ease;box-shadow:0 1px 2px rgba(15,23,42,.02);cursor:pointer}
      .wizard-progress-chip:hover{border-color:#cbd5e1;background:#f8fafc;transform:translateY(-1px)}
      .wizard-step-number{width:22px;height:22px;border-radius:999px;display:grid;place-items:center;background:#f1f5f9;color:#475569;font-size:10px;line-height:1;font-weight:900;transition:all .18s ease}
      .wizard-step-label{display:block;width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:center;font-size:9px;line-height:1.05;font-weight:800;letter-spacing:-.01em}
      .wizard-progress-chip.active{border-color:#f59e0b;background:linear-gradient(180deg,#fffdf7,#fff7df);color:#92400e;box-shadow:0 5px 15px rgba(245,158,11,.13)}
      .wizard-progress-chip.active .wizard-step-number{background:#f59e0b;color:#111827;box-shadow:0 0 0 3px rgba(245,158,11,.14)}
      .wizard-progress-chip.active .wizard-step-label{color:#92400e;font-weight:900}
      .wizard-progress-chip[data-wizard-step="7"] .wizard-step-number{background:#0f172a;color:#fff}
      .wizard-progress-chip[data-wizard-step="7"].active{background:#0f172a;border-color:#0f172a;color:#fff;box-shadow:0 6px 18px rgba(15,23,42,.18)}
      .wizard-progress-chip[data-wizard-step="7"].active .wizard-step-number{background:#f59e0b;color:#111827}
      .wizard-progress-chip[data-wizard-step="7"].active .wizard-step-label{color:#fff}
      @media(max-width:520px){
        .wizard-progress-track{display:flex;overflow-x:auto;gap:7px;padding:1px 1px 5px;scrollbar-width:none}
        .wizard-progress-track::-webkit-scrollbar{display:none}
        .wizard-progress-chip{flex:0 0 72px;height:60px}
        .wizard-step-label{font-size:8px}
      }
    `;
  }

  function installNavigation(){
    if(typeof window.goStep!=='function'||typeof state==='undefined') return false;
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
    window.BAT_KUBIQUEITOR_ELECTRICITY_STEP={version:VERSION,install,moveElectricalPanel};
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