// Makes Extras +/- controls deterministic: one click = one action.
// Mounted items still follow the intended flow: + once -> choose A/B/C/D once -> object appears.
(function(){
  if(window.BAT_KUBIQUEITOR_SINGLE_CLICK_EXTRAS) return;

  const LOCK_MS=320;
  const locks=new Map();
  let installed=false;

  function ready(){
    return typeof adjustCount==='function'&&document.getElementById('extras-list');
  }

  function normalizeButtons(){
    const root=document.getElementById('extras-list');
    if(!root) return;
    root.querySelectorAll('button.counter-btn').forEach(btn=>{
      btn.type='button';
      if(btn.dataset.extraKey) return;
      const action=btn.getAttribute('onclick')||'';
      const match=action.match(/adjustCount\(\s*['\"]([^'\"]+)['\"]\s*,\s*(-?\d+)\s*\)/);
      if(!match) return;
      btn.dataset.extraKey=match[1];
      btn.dataset.extraDelta=String(Number(match[2])||0);
      btn.removeAttribute('onclick');
    });
  }

  function typeName(key){
    try{return DATA?.extras?.[key]?.name||key;}catch(e){return key;}
  }

  function removePrompt(){
    document.getElementById('mounted-single-click-prompt')?.remove();
  }

  function showFacePrompt(key){
    removePrompt();
    const viewer=document.querySelector('.viewer-wrap');
    if(!viewer) return;
    const prompt=document.createElement('div');
    prompt.id='mounted-single-click-prompt';
    prompt.innerHTML=`<i class="fa-solid fa-hand-pointer"></i><span>Selecciona <b>A, B, C o D</b> para instalar ${typeName(key).toLowerCase()}</span>`;
    viewer.appendChild(prompt);
  }

  function addStyle(){
    if(document.getElementById('single-click-extras-style')) return;
    const style=document.createElement('style');
    style.id='single-click-extras-style';
    style.textContent=`
      #mounted-single-click-prompt{position:absolute;left:50%;top:138px;transform:translateX(-50%);z-index:26;display:flex;align-items:center;gap:8px;padding:9px 13px;border-radius:12px;background:rgba(15,23,42,.94);border:1px solid rgba(245,158,11,.55);color:#fff;box-shadow:0 12px 30px rgba(2,6,23,.28);font-size:11px;font-weight:750;pointer-events:none;animation:singleClickPromptIn .16s ease-out}
      #mounted-single-click-prompt i,#mounted-single-click-prompt b{color:#fbbf24}
      @keyframes singleClickPromptIn{from{opacity:0;transform:translate(-50%,-6px)}to{opacity:1;transform:translate(-50%,0)}}
      .counter-btn[data-single-click-busy="true"]{pointer-events:none;opacity:.58}
    `;
    document.head.appendChild(style);
  }

  function runAction(btn){
    const key=btn.dataset.extraKey;
    const delta=Number(btn.dataset.extraDelta)||0;
    if(!key||!delta) return;

    const lockKey=`${key}:${delta}`;
    const now=performance.now();
    const last=locks.get(lockKey)||0;
    if(now-last<LOCK_MS) return;
    locks.set(lockKey,now);

    btn.dataset.singleClickBusy='true';
    try{
      adjustCount(key,delta);
      if(delta>0&&typeof isMountedFaceType==='function'&&isMountedFaceType(key)){
        showFacePrompt(key);
      }else if(delta<0){
        removePrompt();
      }
    }finally{
      setTimeout(()=>{delete btn.dataset.singleClickBusy;},140);
    }
  }

  function install(){
    if(installed||!ready()) return false;
    installed=true;
    addStyle();
    const root=document.getElementById('extras-list');
    normalizeButtons();

    // renderExtras replaces root.innerHTML, so keep normalizing new buttons.
    const observer=new MutationObserver(normalizeButtons);
    observer.observe(root,{childList:true,subtree:true});

    root.addEventListener('click',event=>{
      const btn=event.target.closest?.('button.counter-btn');
      if(!btn||!root.contains(btn)) return;
      normalizeButtons();
      if(!btn.dataset.extraKey) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      runAction(btn);
    },true);

    root.addEventListener('dblclick',event=>{
      const btn=event.target.closest?.('button.counter-btn');
      if(!btn||!root.contains(btn)) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
    },true);

    if(typeof addMountedToFace==='function'){
      const baseAddMounted=addMountedToFace;
      addMountedToFace=function(face){
        const result=baseAddMounted(face);
        removePrompt();
        return result;
      };
    }
    if(typeof closeMountedFacePicker==='function'){
      const baseClose=closeMountedFacePicker;
      closeMountedFacePicker=function(...args){removePrompt();return baseClose.apply(this,args);};
    }

    window.BAT_KUBIQUEITOR_SINGLE_CLICK_EXTRAS={version:1,lockMs:LOCK_MS};
    return true;
  }

  if(!install()){
    let tries=0;
    const timer=setInterval(()=>{tries++;if(install()||tries>320)clearInterval(timer);},50);
  }
})();
