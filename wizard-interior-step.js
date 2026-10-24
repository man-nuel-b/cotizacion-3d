// Dedicated six-step wizard for bat-kubiqueitor.
// Flow: Uso -> Base -> Piso -> Paredes -> Extras -> Cotizar.

(function(){
  let installed=false;

  function loadInteriorUXLayer(){
    if(document.querySelector('script[data-interior-ux]')) return;
    const script=document.createElement('script');
    script.src=(typeof finalVersionedAsset==='function'?finalVersionedAsset('interior-ux.js'):'interior-ux.js?v=20261023-40');
    script.dataset.interiorUx='true';
    document.body.appendChild(script);
  }

  function loadPartitionDuplicateLayer(){
    if(document.querySelector('script[data-partition-duplicate]')){ setTimeout(loadInteriorUXLayer,20); return; }
    const script=document.createElement('script');
    script.src=(typeof finalVersionedAsset==='function'?finalVersionedAsset('partition-duplicate.js'):'partition-duplicate.js?v=20261023-40');
    script.dataset.partitionDuplicate='true';
    script.addEventListener('load',()=>setTimeout(loadInteriorUXLayer,20),{once:true});
    document.body.appendChild(script);
  }

  function loadOpeningExtrasLayer(){
    if(document.querySelector('script[data-opening-extras]')){ setTimeout(loadPartitionDuplicateLayer,20); return; }
    const script=document.createElement('script');
    script.src=(typeof finalVersionedAsset==='function'?finalVersionedAsset('openings-extras.js'):'openings-extras.js?v=20261023-40');
    script.dataset.openingExtras='true';
    script.addEventListener('load',()=>setTimeout(loadPartitionDuplicateLayer,20),{once:true});
    document.body.appendChild(script);
  }

  function unwrapLegacyFinishSections(){
    const finishList=document.getElementById('finish-list');
    const floorSelector=document.getElementById('floor-finish-selector');
    const legacy=document.getElementById('base-finish-sections');
    if(!legacy) return;
    const parent=legacy.parentElement;
    if(parent){
      if(finishList) parent.insertBefore(finishList,legacy);
      if(floorSelector) parent.insertBefore(floorSelector,legacy);
    }
    legacy.remove();
  }

  function syncDedicatedSteps(){
    const floorTarget=document.getElementById('floor-step-content');
    const wallTarget=document.getElementById('wall-step-content');
    const floorSelector=document.getElementById('floor-finish-selector');
    const finishList=document.getElementById('finish-list');
    const interiorConfig=document.getElementById('interior-system-config');

    if(floorTarget&&floorSelector&&floorSelector.parentElement!==floorTarget) floorTarget.appendChild(floorSelector);
    if(wallTarget&&finishList&&finishList.parentElement!==wallTarget) wallTarget.appendChild(finishList);
    if(wallTarget&&interiorConfig&&interiorConfig.parentElement!==wallTarget) wallTarget.appendChild(interiorConfig);
  }

  function installSixStepNavigation(){
    if(installed){ syncDedicatedSteps(); setTimeout(loadOpeningExtrasLayer,20); return true; }

    const panel=document.querySelector('.config-panel');
    const step1=panel?.querySelector('.wizard-step[data-step="1"]');
    const step2=panel?.querySelector('.wizard-step[data-step="2"]');
    const originalExtras=panel?.querySelector('.wizard-step[data-step="3"]');
    const originalQuote=panel?.querySelector('.wizard-step[data-step="4"]');
    const finishList=document.getElementById('finish-list');
    if(!panel||!step1||!step2||!originalExtras||!originalQuote||!finishList) return false;

    installed=true;
    unwrapLegacyFinishSections();

    const chipsWrap=panel.querySelector('.step-chip')?.parentElement;
    if(chipsWrap){
      chipsWrap.className='grid grid-cols-6 gap-1';
      chipsWrap.innerHTML=`
        <button class="step-chip active border rounded-xl py-2 text-[9px] font-bold" onclick="goStep(1)">1. Uso</button>
        <button class="step-chip border rounded-xl py-2 text-[9px] font-bold text-slate-500" onclick="goStep(2)">2. Base</button>
        <button class="step-chip border rounded-xl py-2 text-[9px] font-bold text-slate-500" onclick="goStep(3)">3. Piso</button>
        <button class="step-chip border rounded-xl py-2 text-[9px] font-bold text-slate-500" onclick="goStep(4)">4. Paredes</button>
        <button class="step-chip border rounded-xl py-2 text-[9px] font-bold text-slate-500" onclick="goStep(5)">5. Extras</button>
        <button class="step-chip border rounded-xl py-2 text-[9px] font-bold text-slate-500" onclick="goStep(6)">6. Cotizar</button>`;
    }

    const baseDescription=step2.querySelector('p');
    if(baseDescription) baseDescription.textContent='Elige el tamaño del módulo y su color exterior.';

    const oldFinishLabel=[...step2.querySelectorAll('label')].find(el=>(el.textContent||'').includes('Terminación interior'));
    if(oldFinishLabel) oldFinishLabel.remove();

    const baseActions=[...step2.querySelectorAll('div')].find(el=>el.classList.contains('flex')&&el.classList.contains('gap-2')&&el.classList.contains('mt-5'));
    if(baseActions){
      baseActions.innerHTML=`
        <button onclick="goStep(1)" class="w-1/3 bg-slate-100 py-3 rounded-xl font-bold text-sm">Atrás</button>
        <button onclick="goStep(3)" class="flex-1 bg-slate-950 text-white py-3 rounded-xl font-bold text-sm">Elegir piso <i class="fa-solid fa-arrow-right ml-1"></i></button>`;
    }

    const floorStep=document.createElement('section');
    floorStep.dataset.step='3';
    floorStep.className='wizard-step hidden';
    floorStep.innerHTML=`
      <div class="text-[11px] font-black uppercase tracking-widest text-amber-600">Paso 3</div>
      <h2 class="text-xl font-black mt-1">Elige el piso</h2>
      <p class="text-sm text-slate-500 mt-1 mb-4">Selecciona el acabado visible del piso. El cambio se refleja en el modelo 3D y en la cotización.</p>
      <div id="floor-step-content"></div>
      <div class="flex gap-2 mt-5">
        <button onclick="goStep(2)" class="w-1/3 bg-slate-100 py-3 rounded-xl font-bold text-sm">Atrás</button>
        <button onclick="goStep(4)" class="flex-1 bg-slate-950 text-white py-3 rounded-xl font-bold text-sm">Definir paredes <i class="fa-solid fa-arrow-right ml-1"></i></button>
      </div>`;

    const wallStep=document.createElement('section');
    wallStep.dataset.step='4';
    wallStep.className='wizard-step hidden';
    wallStep.innerHTML=`
      <div class="text-[11px] font-black uppercase tracking-widest text-amber-600">Paso 4</div>
      <h2 class="text-xl font-black mt-1">Define las paredes</h2>
      <p class="text-sm text-slate-500 mt-1 mb-4">Elige el revestimiento interior y ajusta la solución constructiva de los muros.</p>
      <div id="wall-step-content"></div>
      <div class="flex gap-2 mt-5">
        <button onclick="goStep(3)" class="w-1/3 bg-slate-100 py-3 rounded-xl font-bold text-sm">Atrás</button>
        <button onclick="goStep(5)" class="flex-1 bg-slate-950 text-white py-3 rounded-xl font-bold text-sm">Agregar extras <i class="fa-solid fa-arrow-right ml-1"></i></button>
      </div>`;

    originalExtras.parentElement.insertBefore(floorStep,originalExtras);
    originalExtras.parentElement.insertBefore(wallStep,originalExtras);

    originalExtras.dataset.step='5';
    const extrasEyebrow=originalExtras.querySelector('.text-amber-600');
    if(extrasEyebrow) extrasEyebrow.textContent='Paso 5';
    const extrasDescription=originalExtras.querySelector('p');
    if(extrasDescription) extrasDescription.textContent='Agrega puertas, ventanas, vanos, divisiones, climatización y equipamiento al diseño.';
    const extrasActions=[...originalExtras.querySelectorAll('div')].find(el=>el.classList.contains('flex')&&el.classList.contains('gap-2')&&el.classList.contains('mt-5'));
    if(extrasActions){
      extrasActions.innerHTML=`
        <button onclick="goStep(4)" class="w-1/3 bg-slate-100 py-3 rounded-xl font-bold text-sm">Atrás</button>
        <button onclick="goStep(6)" class="flex-1 bg-amber-500 text-slate-950 py-3 rounded-xl font-black text-sm">Cotizar</button>`;
    }

    originalQuote.dataset.step='6';
    const quoteEyebrow=originalQuote.querySelector('.text-amber-600');
    if(quoteEyebrow) quoteEyebrow.textContent='Paso 6';
    const quoteBack=[...originalQuote.querySelectorAll('button')].find(btn=>(btn.textContent||'').includes('Volver a editar'));
    if(quoteBack) quoteBack.setAttribute('onclick','goStep(5)');

    const summaryQuote=[...document.querySelectorAll('.summary-panel button')].find(btn=>(btn.textContent||'').includes('Cotizar este diseño'));
    if(summaryQuote) summaryQuote.setAttribute('onclick','goStep(6)');

    if(typeof renderInteriorSystemUI==='function') renderInteriorSystemUI();
    syncDedicatedSteps();

    goStep=function(step){
      state.step=clamp(Number(step)||1,1,6);
      document.querySelectorAll('.wizard-step').forEach(el=>el.classList.toggle('hidden',Number(el.dataset.step)!==state.step));
      document.querySelectorAll('.step-chip').forEach((el,idx)=>{
        const active=idx+1===state.step;
        el.classList.toggle('active',active);
        el.classList.toggle('text-slate-500',!active);
      });
      if(state.step===3){
        if(typeof window.BAT_KUBIQUEITOR_FLOOR_FINISHES!=='undefined'&&typeof renderAll==='function') renderAll();
        setTimeout(syncDedicatedSteps,0);
      }
      if(state.step===4){
        if(typeof renderInteriorSystemUI==='function') renderInteriorSystemUI();
        setTimeout(syncDedicatedSteps,0);
      }
      if(window.innerWidth<821) document.querySelector('.config-panel')?.scrollIntoView({behavior:'smooth',block:'start'});
    };

    if(!document.getElementById('six-step-wizard-style')){
      const style=document.createElement('style');
      style.id='six-step-wizard-style';
      style.textContent=`
        #floor-step-content #floor-finish-selector{margin-top:0!important}
        #wall-step-content #finish-list{margin-top:0!important}
        #wall-step-content #interior-system-config{margin-top:14px!important;background:transparent!important}
        #floor-step-content .option-card,#wall-step-content .option-card{background:#fff}
        @media(max-width:460px){.step-chip{font-size:7px!important;padding-left:1px!important;padding-right:1px!important}}
      `;
      document.head.appendChild(style);
    }

    const observer=new MutationObserver(()=>syncDedicatedSteps());
    observer.observe(panel,{childList:true,subtree:true});
    setInterval(syncDedicatedSteps,400);

    goStep(state.step>=1&&state.step<=6?state.step:1);
    setTimeout(loadOpeningExtrasLayer,20);
    return true;
  }

  function boot(){
    if(installSixStepNavigation()) return;
    let attempts=0;
    const timer=setInterval(()=>{
      attempts++;
      if(installSixStepNavigation()||attempts>40) clearInterval(timer);
    },100);
  }

  if(document.readyState==='loading') window.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
