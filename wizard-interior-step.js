// Dedicated Interior wizard step for bat-kubiqueitor.
// Converts the 4-step flow into: Uso -> Base -> Interior -> Extras -> Cotizar.

(function(){
  let installed=false;

  function loadPartitionDuplicateLayer(){
    if(document.querySelector('script[data-partition-duplicate]')) return;
    const script=document.createElement('script');
    script.src=(typeof finalVersionedAsset==='function'?finalVersionedAsset('partition-duplicate.js'):'partition-duplicate.js?v=20261022-9');
    script.dataset.partitionDuplicate='true';
    document.body.appendChild(script);
  }

  function loadOpeningExtrasLayer(){
    if(document.querySelector('script[data-opening-extras]')){
      setTimeout(loadPartitionDuplicateLayer,20);
      return;
    }
    const script=document.createElement('script');
    script.src=(typeof finalVersionedAsset==='function'?finalVersionedAsset('openings-extras.js'):'openings-extras.js?v=20261022-9');
    script.dataset.openingExtras='true';
    script.addEventListener('load',()=>setTimeout(loadPartitionDuplicateLayer,20),{once:true});
    document.body.appendChild(script);
  }

  function installFiveStepNavigation(){
    if(installed){
      setTimeout(loadOpeningExtrasLayer,20);
      return true;
    }

    const panel=document.querySelector('.config-panel');
    const existingChips=panel?[...panel.querySelectorAll('.step-chip')]:[];
    const existingInterior=panel?.querySelector('.wizard-step[data-step="3"] h2');
    if(existingChips.length===5&&(existingInterior?.textContent||'').includes('Terminación interior')){
      installed=true;
      setTimeout(loadOpeningExtrasLayer,20);
      return true;
    }

    const step1=panel?.querySelector('.wizard-step[data-step="1"]');
    const step2=panel?.querySelector('.wizard-step[data-step="2"]');
    const extras=panel?.querySelector('.wizard-step[data-step="3"]');
    const quote=panel?.querySelector('.wizard-step[data-step="4"]');
    const finishList=document.getElementById('finish-list');
    if(!panel||!step1||!step2||!extras||!quote||!finishList) return false;

    installed=true;

    const chipsWrap=panel.querySelector('.step-chip')?.parentElement;
    if(chipsWrap){
      chipsWrap.className='grid grid-cols-5 gap-1';
      chipsWrap.innerHTML=`
        <button class="step-chip active border rounded-xl py-2 text-[10px] font-bold" onclick="goStep(1)">1. Uso</button>
        <button class="step-chip border rounded-xl py-2 text-[10px] font-bold text-slate-500" onclick="goStep(2)">2. Base</button>
        <button class="step-chip border rounded-xl py-2 text-[10px] font-bold text-slate-500" onclick="goStep(3)">3. Interior</button>
        <button class="step-chip border rounded-xl py-2 text-[10px] font-bold text-slate-500" onclick="goStep(4)">4. Extras</button>
        <button class="step-chip border rounded-xl py-2 text-[10px] font-bold text-slate-500" onclick="goStep(5)">5. Cotizar</button>`;
    }

    const baseDescription=step2.querySelector('p');
    if(baseDescription) baseDescription.textContent='Elige el tamaño del módulo y su color exterior.';

    const finishLabel=[...step2.querySelectorAll('label')].find(el=>(el.textContent||'').includes('Terminación interior'));
    const baseActions=[...step2.querySelectorAll('div')].find(el=>el.classList.contains('flex')&&el.classList.contains('gap-2')&&el.classList.contains('mt-5'));
    if(baseActions){
      baseActions.innerHTML=`
        <button onclick="goStep(1)" class="w-1/3 bg-slate-100 py-3 rounded-xl font-bold text-sm">Atrás</button>
        <button onclick="goStep(3)" class="flex-1 bg-slate-950 text-white py-3 rounded-xl font-bold text-sm">Definir interior <i class="fa-solid fa-arrow-right ml-1"></i></button>`;
    }

    const interior=document.createElement('section');
    interior.dataset.step='3';
    interior.className='wizard-step hidden';
    interior.innerHTML=`
      <div class="text-[11px] font-black uppercase tracking-widest text-amber-600">Paso 3</div>
      <h2 class="text-xl font-black mt-1">Terminación interior</h2>
      <p class="text-sm text-slate-500 mt-1 mb-4">Define revestimiento, aislación y terminaciones antes de agregar puertas, ventanas y equipamiento.</p>
      <div id="interior-step-content"></div>
      <div class="flex gap-2 mt-5">
        <button onclick="goStep(2)" class="w-1/3 bg-slate-100 py-3 rounded-xl font-bold text-sm">Atrás</button>
        <button onclick="goStep(4)" class="flex-1 bg-slate-950 text-white py-3 rounded-xl font-bold text-sm">Agregar extras <i class="fa-solid fa-arrow-right ml-1"></i></button>
      </div>`;
    extras.parentElement.insertBefore(interior,extras);

    const content=interior.querySelector('#interior-step-content');
    if(finishLabel){
      finishLabel.textContent='Nivel de terminación';
      finishLabel.className='block text-xs font-bold text-slate-600 mb-2';
      content.appendChild(finishLabel);
    }
    content.appendChild(finishList);

    if(typeof renderInteriorSystemUI==='function') renderInteriorSystemUI();
    const interiorConfig=document.getElementById('interior-system-config');
    if(interiorConfig) content.appendChild(interiorConfig);

    extras.dataset.step='4';
    const extrasEyebrow=extras.querySelector('.text-amber-600');
    if(extrasEyebrow) extrasEyebrow.textContent='Paso 4';
    const extrasDescription=extras.querySelector('p');
    if(extrasDescription) extrasDescription.textContent='Agrega puertas, ventanas, vanos, divisiones, climatización y equipamiento al diseño.';
    const extrasActions=[...extras.querySelectorAll('div')].find(el=>el.classList.contains('flex')&&el.classList.contains('gap-2')&&el.classList.contains('mt-5'));
    if(extrasActions){
      extrasActions.innerHTML=`
        <button onclick="goStep(3)" class="w-1/3 bg-slate-100 py-3 rounded-xl font-bold text-sm">Atrás</button>
        <button onclick="goStep(5)" class="flex-1 bg-amber-500 text-slate-950 py-3 rounded-xl font-black text-sm">Cotizar</button>`;
    }

    quote.dataset.step='5';
    const quoteEyebrow=quote.querySelector('.text-amber-600');
    if(quoteEyebrow) quoteEyebrow.textContent='Paso 5';
    const quoteBack=[...quote.querySelectorAll('button')].find(btn=>(btn.textContent||'').includes('Volver a editar'));
    if(quoteBack) quoteBack.setAttribute('onclick','goStep(4)');

    const summaryQuote=[...document.querySelectorAll('.summary-panel button')].find(btn=>(btn.textContent||'').includes('Cotizar este diseño'));
    if(summaryQuote) summaryQuote.setAttribute('onclick','goStep(5)');

    goStep=function(step){
      state.step=clamp(Number(step)||1,1,5);
      document.querySelectorAll('.wizard-step').forEach(el=>el.classList.toggle('hidden',Number(el.dataset.step)!==state.step));
      document.querySelectorAll('.step-chip').forEach((el,idx)=>{
        const active=idx+1===state.step;
        el.classList.toggle('active',active);
        el.classList.toggle('text-slate-500',!active);
      });
      if(state.step===3&&typeof renderInteriorSystemUI==='function'){
        renderInteriorSystemUI();
        const cfg=document.getElementById('interior-system-config');
        const target=document.getElementById('interior-step-content');
        if(cfg&&target&&cfg.parentElement!==target) target.appendChild(cfg);
      }
      if(window.innerWidth<821) document.querySelector('.config-panel')?.scrollIntoView({behavior:'smooth',block:'start'});
    };

    if(!document.getElementById('five-step-wizard-style')){
      const style=document.createElement('style');
      style.id='five-step-wizard-style';
      style.textContent=`
        #interior-step-content #finish-list{margin-top:0!important}
        #interior-step-content #interior-system-config{margin-top:14px!important;background:#f8fafc}
        @media(max-width:420px){.step-chip{font-size:8px!important;padding-left:2px!important;padding-right:2px!important}}
      `;
      document.head.appendChild(style);
    }

    goStep(state.step>=1&&state.step<=5?state.step:1);
    setTimeout(loadOpeningExtrasLayer,20);
    return true;
  }

  function boot(){
    if(installFiveStepNavigation()) return;
    let attempts=0;
    const timer=setInterval(()=>{
      attempts++;
      if(installFiveStepNavigation()||attempts>30) clearInterval(timer);
    },100);
  }

  if(document.readyState==='loading') window.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
