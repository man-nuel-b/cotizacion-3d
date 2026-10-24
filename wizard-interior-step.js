// Stable six-step wizard for bat-kubiqueitor.
// Single responsibility: navigation and deterministic loading of the full editor feature chain.
(function(){
  if(window.BAT_KUBIQUEITOR_SIX_STEP_WIZARD) return;

  const VERSION=5;
  let installed=false;

  function asset(name){
    return typeof finalVersionedAsset==='function'
      ? finalVersionedAsset(name)
      : `${name}?v=20261024-mod01`;
  }

  function loadScriptOnce(selector,name,datasetKey,onload){
    const existing=document.querySelector(selector);
    if(existing){
      if(existing.dataset.loaded==='true'||existing.readyState==='complete'){
        onload?.();
        return;
      }
      existing.addEventListener('load',()=>onload?.(),{once:true});
      return;
    }
    const script=document.createElement('script');
    script.src=asset(name);
    script.dataset[datasetKey]='true';
    script.addEventListener('load',()=>{
      script.dataset.loaded='true';
      onload?.();
    },{once:true});
    document.body.appendChild(script);
  }

  function moveControlsToDedicatedSteps(){
    const floorTarget=document.getElementById('floor-step-content');
    const wallTarget=document.getElementById('wall-step-content');
    const floor=document.getElementById('floor-finish-selector');
    const finish=document.getElementById('finish-list');
    const interior=document.getElementById('interior-system-config');
    if(floorTarget&&floor&&floor.parentElement!==floorTarget)floorTarget.appendChild(floor);
    if(wallTarget&&finish&&finish.parentElement!==wallTarget)wallTarget.appendChild(finish);
    if(wallTarget&&interior&&interior.parentElement!==wallTarget)wallTarget.appendChild(interior);
  }

  function renderWallControls(){
    if(typeof window.renderInteriorSystemUI==='function'){
      window.renderInteriorSystemUI();
      moveControlsToDedicatedSteps();
      return true;
    }
    return false;
  }

  function loadFeatureChain(){
    loadScriptOnce('script[data-interior-systems]','interior-systems.js','interiorSystems',()=>{
      loadScriptOnce('script[data-opening-extras]','openings-extras.js','openingExtras',()=>{
        loadScriptOnce('script[data-partition-duplicate]','partition-duplicate.js','partitionDuplicate',()=>{
          loadScriptOnce('script[data-interior-ux]','interior-ux.js','interiorUx',()=>{
            renderWallControls();
            loadScriptOnce('script[data-production-suite]','production-suite.js','productionSuite');
          });
        });
      });
    });
  }

  function ensureWallFeatureChain(){
    if(renderWallControls())return;
    loadFeatureChain();
    let tries=0;
    const timer=setInterval(()=>{
      tries++;
      if(renderWallControls()||tries>40)clearInterval(timer);
    },100);
  }

  function installStyles(){
    if(document.getElementById('six-step-wizard-style'))return;
    const style=document.createElement('style');
    style.id='six-step-wizard-style';
    style.textContent=`
      #floor-step-content #floor-finish-selector{margin-top:0!important}
      #wall-step-content #finish-list{margin-top:0!important}
      #wall-step-content #interior-system-config{margin-top:0!important}
      #floor-step-content .option-card,#wall-step-content .option-card{background:#fff}
      @media(max-width:460px){.step-chip{font-size:7px!important;padding-left:1px!important;padding-right:1px!important}}
    `;
    document.head.appendChild(style);
  }

  function install(){
    if(installed)return true;
    const panel=document.querySelector('.config-panel');
    const step1=panel?.querySelector('.wizard-step[data-step="1"]');
    const step2=panel?.querySelector('.wizard-step[data-step="2"]');
    let extras=panel?.querySelector('.wizard-step[data-step="3"]');
    let quote=panel?.querySelector('.wizard-step[data-step="4"]');
    const finish=document.getElementById('finish-list');
    if(!panel||!step1||!step2||!extras||!quote||!finish)return false;

    const existingFloor=panel.querySelector('.wizard-step[data-step="3"] #floor-step-content');
    const existingWalls=panel.querySelector('.wizard-step[data-step="4"] #wall-step-content');

    if(!existingFloor||!existingWalls){
      const chips=panel.querySelector('.step-chip')?.parentElement;
      if(chips){
        chips.className='grid grid-cols-6 gap-1';
        chips.innerHTML=`
          <button class="step-chip active border rounded-xl py-2 text-[9px] font-bold" onclick="goStep(1)">1. Uso</button>
          <button class="step-chip border rounded-xl py-2 text-[9px] font-bold text-slate-500" onclick="goStep(2)">2. Base</button>
          <button class="step-chip border rounded-xl py-2 text-[9px] font-bold text-slate-500" onclick="goStep(3)">3. Piso</button>
          <button class="step-chip border rounded-xl py-2 text-[9px] font-bold text-slate-500" onclick="goStep(4)">4. Paredes</button>
          <button class="step-chip border rounded-xl py-2 text-[9px] font-bold text-slate-500" onclick="goStep(5)">5. Extras</button>
          <button class="step-chip border rounded-xl py-2 text-[9px] font-bold text-slate-500" onclick="goStep(6)">6. Cotizar</button>`;
      }

      const finishLabel=[...step2.querySelectorAll('label')].find(el=>(el.textContent||'').includes('Terminación interior'));
      finishLabel?.remove();
      const baseDescription=step2.querySelector('p');
      if(baseDescription)baseDescription.textContent='Elige el tamaño del módulo y su color exterior.';
      const baseActions=[...step2.querySelectorAll('.flex.gap-2.mt-5')][0];
      if(baseActions)baseActions.innerHTML=`<button onclick="goStep(1)" class="w-1/3 bg-slate-100 py-3 rounded-xl font-bold text-sm">Atrás</button><button onclick="goStep(3)" class="flex-1 bg-slate-950 text-white py-3 rounded-xl font-bold text-sm">Elegir piso <i class="fa-solid fa-arrow-right ml-1"></i></button>`;

      const floorStep=document.createElement('section');
      floorStep.dataset.step='3';floorStep.className='wizard-step hidden';
      floorStep.innerHTML=`<div class="text-[11px] font-black uppercase tracking-widest text-amber-600">Paso 3</div><h2 class="text-xl font-black mt-1">Piso</h2><p class="text-sm text-slate-500 mt-1 mb-4">Selecciona el sistema de piso y su terminación visible.</p><div id="floor-step-content"></div><div class="flex gap-2 mt-5"><button onclick="goStep(2)" class="w-1/3 bg-slate-100 py-3 rounded-xl font-bold text-sm">Atrás</button><button onclick="goStep(4)" class="flex-1 bg-slate-950 text-white py-3 rounded-xl font-bold text-sm">Paredes <i class="fa-solid fa-arrow-right ml-1"></i></button></div>`;

      const wallStep=document.createElement('section');
      wallStep.dataset.step='4';wallStep.className='wizard-step hidden';
      wallStep.innerHTML=`<div class="text-[11px] font-black uppercase tracking-widest text-amber-600">Paso 4</div><h2 class="text-xl font-black mt-1">Paredes</h2><p class="text-sm text-slate-500 mt-1 mb-4">Define tabiquería, aislación y revestimientos interiores.</p><div id="wall-step-content"></div><div class="flex gap-2 mt-5"><button onclick="goStep(3)" class="w-1/3 bg-slate-100 py-3 rounded-xl font-bold text-sm">Atrás</button><button onclick="goStep(5)" class="flex-1 bg-slate-950 text-white py-3 rounded-xl font-bold text-sm">Extras <i class="fa-solid fa-arrow-right ml-1"></i></button></div>`;

      extras.parentElement.insertBefore(floorStep,extras);
      extras.parentElement.insertBefore(wallStep,extras);
      extras.dataset.step='5';
      extras.querySelector('.text-amber-600')?.replaceChildren(document.createTextNode('Paso 5'));
      const extrasDescription=extras.querySelector('p');
      if(extrasDescription)extrasDescription.textContent='Agrega puertas, ventanas, vanos, divisiones, climatización y equipamiento.';
      const extrasActions=[...extras.querySelectorAll('.flex.gap-2.mt-5')][0];
      if(extrasActions)extrasActions.innerHTML=`<button onclick="goStep(4)" class="w-1/3 bg-slate-100 py-3 rounded-xl font-bold text-sm">Atrás</button><button onclick="goStep(6)" class="flex-1 bg-amber-500 text-slate-950 py-3 rounded-xl font-black text-sm">Cotizar</button>`;

      quote.dataset.step='6';
      quote.querySelector('.text-amber-600')?.replaceChildren(document.createTextNode('Paso 6'));
      const quoteBack=[...quote.querySelectorAll('button')].find(btn=>(btn.textContent||'').includes('Volver a editar'));
      quoteBack?.setAttribute('onclick','goStep(5)');
      const summaryQuote=[...document.querySelectorAll('.summary-panel button')].find(btn=>(btn.textContent||'').includes('Cotizar este diseño'));
      summaryQuote?.setAttribute('onclick','goStep(6)');
    }

    goStep=function(step){
      state.step=clamp(Number(step)||1,1,6);
      document.querySelectorAll('.wizard-step').forEach(el=>el.classList.toggle('hidden',Number(el.dataset.step)!==state.step));
      document.querySelectorAll('.step-chip').forEach((el,idx)=>{const active=idx+1===state.step;el.classList.toggle('active',active);el.classList.toggle('text-slate-500',!active);});
      if(state.step===3&&typeof window.renderFloorFinishUI==='function')window.renderFloorFinishUI();
      if(state.step===4)ensureWallFeatureChain();
      moveControlsToDedicatedSteps();
      if(window.innerWidth<821)document.querySelector('.config-panel')?.scrollIntoView({behavior:'smooth',block:'start'});
    };

    installStyles();installed=true;
    window.BAT_KUBIQUEITOR_SIX_STEP_WIZARD={version:VERSION,sync:moveControlsToDedicatedSteps,ensureWalls:ensureWallFeatureChain};
    moveControlsToDedicatedSteps();goStep(Math.min(Math.max(Number(state.step)||1,1),6));loadFeatureChain();return true;
  }

  function boot(attempt=0){if(install())return;if(attempt<20)setTimeout(()=>boot(attempt+1),100);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>boot(),{once:true});else boot();
})();