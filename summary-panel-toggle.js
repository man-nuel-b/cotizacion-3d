// Collapsible project-summary panel + clearer base-material sections.
(function(){
  if(window.BAT_KUBIQUEITOR_SUMMARY_TOGGLE) return;

  const STORAGE_KEY='bat-kubiqueitor-summary-collapsed-v1';

  function addStyles(){
    if(document.getElementById('summary-panel-toggle-style')) return;
    const style=document.createElement('style');
    style.id='summary-panel-toggle-style';
    style.textContent=`
      .main-grid{transition:grid-template-columns .22s ease}
      .summary-panel{transition:opacity .18s ease,transform .22s ease}
      .summary-panel-collapsed .main-grid{grid-template-columns:360px minmax(0,1fr) 0px}
      .summary-panel-collapsed .summary-panel{display:none!important}
      #summary-panel-toggle{position:absolute;right:0;top:50%;z-index:28;transform:translateY(-50%);display:inline-flex;align-items:center;gap:7px;padding:10px 11px 10px 10px;border:1px solid rgba(245,158,11,.45);border-right:0;border-radius:13px 0 0 13px;background:rgba(15,23,42,.92);color:#fff;backdrop-filter:blur(12px);box-shadow:0 10px 28px rgba(2,6,23,.28);font-size:10px;font-weight:850;letter-spacing:.01em;cursor:pointer;transition:.16s ease;white-space:nowrap}
      #summary-panel-toggle:hover{background:rgba(30,41,59,.98);padding-right:14px}
      #summary-panel-toggle i{color:#f59e0b;font-size:12px}
      .summary-panel-collapsed #summary-panel-toggle{background:rgba(245,158,11,.95);color:#0f172a;border-color:#f59e0b}
      .summary-panel-collapsed #summary-panel-toggle i{color:#0f172a}
      .presentation-mode #summary-panel-toggle{display:none!important}

      #base-finish-sections{display:grid;gap:12px;margin-top:20px}
      .base-material-section{border:1px solid #e2e8f0;border-radius:16px;padding:12px;background:#f8fafc}
      .base-material-section-header{display:flex;align-items:flex-start;gap:10px;margin-bottom:10px}
      .base-material-section-icon{width:34px;height:34px;border-radius:11px;display:grid;place-items:center;background:#0f172a;color:#f59e0b;flex:0 0 auto}
      .base-material-section-title{font-size:12px;font-weight:900;color:#0f172a;line-height:1.1}
      .base-material-section-subtitle{font-size:10px;color:#64748b;margin-top:3px;line-height:1.35}
      #wall-finish-section #finish-list{margin-top:0!important}
      #floor-finish-section #floor-finish-selector{margin-top:0!important}
      #floor-finish-section #floor-finish-selector>div:first-child{display:none!important}
      #floor-finish-section #floor-finish-selector>div.grid{gap:8px}
      #floor-finish-section .option-card,#wall-finish-section .option-card{background:#fff}

      @media(max-width:1180px){.summary-panel-collapsed .main-grid{grid-template-columns:330px minmax(0,1fr)}.summary-panel-collapsed .summary-panel{display:none!important}}
      @media(max-width:820px){.summary-panel-collapsed .main-grid{display:block}.summary-panel-collapsed .summary-panel{display:none!important}#summary-panel-toggle{top:auto;bottom:78px;transform:none;padding:9px 10px}}
    `;
    document.head.appendChild(style);
  }

  function createSection(id,icon,title,subtitle){
    const section=document.createElement('div');
    section.id=id;section.className='base-material-section';
    section.innerHTML=`<div class="base-material-section-header"><div class="base-material-section-icon"><i class="fa-solid ${icon}"></i></div><div><div class="base-material-section-title">${title}</div><div class="base-material-section-subtitle">${subtitle}</div></div></div>`;
    return section;
  }

  function arrangeBaseSections(){
    const finishList=document.getElementById('finish-list');
    if(!finishList) return;
    const step=finishList.closest('[data-step="2"]');
    if(!step) return;

    let sections=document.getElementById('base-finish-sections');
    if(!sections){
      sections=document.createElement('div');
      sections.id='base-finish-sections';

      const oldLabel=finishList.previousElementSibling;
      if(oldLabel&&oldLabel.tagName==='LABEL'){
        oldLabel.parentNode.insertBefore(sections,oldLabel);
        oldLabel.remove();
      }else finishList.parentNode.insertBefore(sections,finishList);

      const walls=createSection('wall-finish-section','fa-border-all','Paredes interiores','Elige el revestimiento y nivel de terminación de los muros.');
      walls.appendChild(finishList);
      sections.appendChild(walls);
    }

    const selector=document.getElementById('floor-finish-selector');
    if(selector){
      let floorSection=document.getElementById('floor-finish-section');
      if(!floorSection){
        floorSection=createSection('floor-finish-section','fa-layer-group','Piso','Selecciona el acabado visible del piso de manera independiente a los muros.');
        sections.appendChild(floorSection);
      }
      if(selector.parentElement!==floorSection) floorSection.appendChild(selector);
    }
  }

  function persistedState(){try{const raw=localStorage.getItem(STORAGE_KEY);if(raw==='1')return true;if(raw==='0')return false;}catch(e){}return window.innerWidth<=1180;}
  function saveState(collapsed){try{localStorage.setItem(STORAGE_KEY,collapsed?'1':'0');}catch(e){}}
  function triggerViewportResize(){requestAnimationFrame(()=>window.dispatchEvent(new Event('resize')));setTimeout(()=>window.dispatchEvent(new Event('resize')),260);}
  function updateButton(collapsed){const btn=document.getElementById('summary-panel-toggle');if(!btn)return;btn.setAttribute('aria-expanded',String(!collapsed));btn.setAttribute('title',collapsed?'Mostrar resumen del proyecto':'Ocultar resumen y ampliar el modelo 3D');btn.innerHTML=collapsed?'<i class="fa-solid fa-chevron-left"></i><span>Resumen</span>':'<span>Ocultar</span><i class="fa-solid fa-chevron-right"></i>';}
  function setSummaryCollapsed(collapsed,{persist=true}={}){const shell=document.getElementById('app-shell');if(!shell)return;shell.classList.toggle('summary-panel-collapsed',Boolean(collapsed));updateButton(Boolean(collapsed));if(persist)saveState(Boolean(collapsed));triggerViewportResize();}

  function loadSixStepSupervisor(){
    if(window.BAT_KUBIQUEITOR_SIX_STEP_SUPERVISOR||document.querySelector('script[data-six-step-supervisor]')) return;
    const script=document.createElement('script');
    script.src='wizard-six-step-supervisor.js?v=20261023-41';
    script.dataset.sixStepSupervisor='true';
    document.body.appendChild(script);
  }

  function install(){
    const viewer=document.querySelector('.viewer-wrap'),summary=document.querySelector('.summary-panel'),shell=document.getElementById('app-shell');
    if(!viewer||!summary||!shell)return false;
    addStyles();arrangeBaseSections();
    if(!document.getElementById('summary-panel-toggle')){
      const button=document.createElement('button');button.id='summary-panel-toggle';button.type='button';button.setAttribute('aria-controls','project-summary-panel');summary.id=summary.id||'project-summary-panel';button.addEventListener('click',()=>setSummaryCollapsed(!shell.classList.contains('summary-panel-collapsed')));viewer.appendChild(button);
    }
    const observerTarget=document.querySelector('[data-step="2"]');
    if(observerTarget&&!observerTarget.dataset.baseSectionObserver){
      observerTarget.dataset.baseSectionObserver='1';
      new MutationObserver(()=>arrangeBaseSections()).observe(observerTarget,{childList:true,subtree:true});
    }
    setInterval(arrangeBaseSections,500);
    setSummaryCollapsed(persistedState(),{persist:false});
    window.setSummaryPanelCollapsed=setSummaryCollapsed;
    window.toggleSummaryPanel=function(){setSummaryCollapsed(!shell.classList.contains('summary-panel-collapsed'));};
    window.BAT_KUBIQUEITOR_SUMMARY_TOGGLE={version:4};
    setTimeout(loadSixStepSupervisor,40);
    return true;
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install,30),{once:true});else setTimeout(install,30);
})();
