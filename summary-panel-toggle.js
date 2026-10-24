// Collapsible project-summary panel only. Wizard layout is managed elsewhere.
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
      @media(max-width:1180px){.summary-panel-collapsed .main-grid{grid-template-columns:330px minmax(0,1fr)}.summary-panel-collapsed .summary-panel{display:none!important}}
      @media(max-width:820px){.summary-panel-collapsed .main-grid{display:block}.summary-panel-collapsed .summary-panel{display:none!important}#summary-panel-toggle{top:auto;bottom:78px;transform:none;padding:9px 10px}}
    `;
    document.head.appendChild(style);
  }

  function persistedState(){try{const raw=localStorage.getItem(STORAGE_KEY);if(raw==='1')return true;if(raw==='0')return false;}catch(e){}return window.innerWidth<=1180;}
  function saveState(collapsed){try{localStorage.setItem(STORAGE_KEY,collapsed?'1':'0');}catch(e){}}
  function triggerViewportResize(){requestAnimationFrame(()=>window.dispatchEvent(new Event('resize')));setTimeout(()=>window.dispatchEvent(new Event('resize')),260);}
  function updateButton(collapsed){const btn=document.getElementById('summary-panel-toggle');if(!btn)return;btn.setAttribute('aria-expanded',String(!collapsed));btn.setAttribute('title',collapsed?'Mostrar resumen del proyecto':'Ocultar resumen y ampliar el modelo 3D');btn.innerHTML=collapsed?'<i class="fa-solid fa-chevron-left"></i><span>Resumen</span>':'<span>Ocultar</span><i class="fa-solid fa-chevron-right"></i>';}
  function setSummaryCollapsed(collapsed,{persist=true}={}){const shell=document.getElementById('app-shell');if(!shell)return;shell.classList.toggle('summary-panel-collapsed',Boolean(collapsed));updateButton(Boolean(collapsed));if(persist)saveState(Boolean(collapsed));triggerViewportResize();}

  function install(){
    const viewer=document.querySelector('.viewer-wrap'),summary=document.querySelector('.summary-panel'),shell=document.getElementById('app-shell');
    if(!viewer||!summary||!shell)return false;
    addStyles();
    if(!document.getElementById('summary-panel-toggle')){
      const button=document.createElement('button');button.id='summary-panel-toggle';button.type='button';button.setAttribute('aria-controls','project-summary-panel');summary.id=summary.id||'project-summary-panel';button.addEventListener('click',()=>setSummaryCollapsed(!shell.classList.contains('summary-panel-collapsed')));viewer.appendChild(button);
    }
    setSummaryCollapsed(persistedState(),{persist:false});
    window.setSummaryPanelCollapsed=setSummaryCollapsed;
    window.toggleSummaryPanel=function(){setSummaryCollapsed(!shell.classList.contains('summary-panel-collapsed'));};
    window.BAT_KUBIQUEITOR_SUMMARY_TOGGLE={version:7};
    return true;
  }

  function loadScriptOnce(src,datasetKey){
    if(document.querySelector(`script[data-${datasetKey}]`)) return;
    const script=document.createElement('script');
    script.src=src;
    script.setAttribute(`data-${datasetKey}`,'true');
    document.body.appendChild(script);
  }

  function loadWallModuleEngine(){
    if(!window.BAT_KUBIQUEITOR_WALL_MODULE_ENGINE) loadScriptOnce('wall-module-engine.js?v=20261024-refactor03','wall-module-engine');
    loadScriptOnce('direct-editor-controller.js?v=20261024-refactor04','direct-editor-controller');
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{setTimeout(install,30);setTimeout(loadWallModuleEngine,40);},{once:true});
  else{setTimeout(install,30);setTimeout(loadWallModuleEngine,40);}
})();
