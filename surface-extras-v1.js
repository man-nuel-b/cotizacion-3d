// BAT-Cubikeitor · Extras de superficie exterior por cara
// Solo administra estado/UI. No reemplaza buildBOM, calculate, renderAll ni el editor 3D.
(function(){
  if(window.BAT_KUBIQUEITOR_SURFACE_EXTRAS) return;

  const VERSION=1;
  const FACES=['A','B','C','D','E'];
  const EXTRA_DEFS={
    grateado:{label:'Grateado exterior',icon:'fa-screwdriver-wrench',apu:'P44',help:'Preparación mecánica / anticorrosiva de la superficie.'},
    pintura:{label:'Pintura exterior',icon:'fa-paint-roller',apu:'P45',help:'Terminación exterior sobre las caras seleccionadas.'}
  };

  function clone(v){return JSON.parse(JSON.stringify(v));}
  function ensureState(){
    if(!state.surfaceExtras||typeof state.surfaceExtras!=='object') state.surfaceExtras={};
    Object.keys(EXTRA_DEFS).forEach(key=>{
      const current=state.surfaceExtras[key];
      if(!current||typeof current!=='object') state.surfaceExtras[key]={faces:[]};
      if(!Array.isArray(state.surfaceExtras[key].faces)) state.surfaceExtras[key].faces=[];
      state.surfaceExtras[key].faces=[...new Set(state.surfaceExtras[key].faces.filter(face=>FACES.includes(face)))];
    });
    return state.surfaceExtras;
  }

  function selected(key,face){return ensureState()[key].faces.includes(face);}

  function toggleFace(key,face){
    if(!EXTRA_DEFS[key]||!FACES.includes(face)) return;
    if(typeof pushHistory==='function') pushHistory();
    const faces=ensureState()[key].faces;
    const idx=faces.indexOf(face);
    if(idx>=0) faces.splice(idx,1); else faces.push(face);
    try{if(typeof renderAll==='function') renderAll();}catch(e){}
    renderPanel();
    try{if(typeof toast==='function')toast(`${EXTRA_DEFS[key].label}: cara ${face} ${idx>=0?'quitada':'agregada'}`);}catch(e){}
  }

  function setAll(key,on){
    if(!EXTRA_DEFS[key]) return;
    if(typeof pushHistory==='function') pushHistory();
    ensureState()[key].faces=on?[...FACES]:[];
    try{if(typeof renderAll==='function') renderAll();}catch(e){}
    renderPanel();
  }

  function addStyles(){
    if(document.getElementById('surface-extras-style')) return;
    const s=document.createElement('style');
    s.id='surface-extras-style';
    s.textContent=`
      #surface-extras-panel{margin-top:14px;border:1px solid #e2e8f0;border-radius:16px;background:#fff;padding:14px;box-shadow:0 8px 22px rgba(15,23,42,.04)}
      .sex-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.sex-kicker{font-size:9px;text-transform:uppercase;letter-spacing:.12em;font-weight:900;color:#d97706}.sex-title{font-size:13px;font-weight:900;color:#0f172a;margin-top:4px}.sex-sub{font-size:9px;line-height:1.4;color:#64748b;margin-top:4px}
      .sex-card{margin-top:10px;border:1px solid #e2e8f0;border-radius:13px;padding:10px;background:#f8fafc}.sex-card-head{display:flex;align-items:center;gap:7px;font-size:10px;font-weight:900;color:#334155}.sex-card-head i{color:#d97706}.sex-help{font-size:8.5px;color:#64748b;margin-top:3px}
      .sex-faces{display:grid;grid-template-columns:repeat(5,1fr);gap:5px;margin-top:8px}.sex-face{height:31px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;color:#475569;font-size:10px;font-weight:900;cursor:pointer}.sex-face.active{background:#f59e0b;border-color:#f59e0b;color:#0f172a}.sex-actions{display:flex;gap:6px;margin-top:7px}.sex-mini{border:1px solid #e2e8f0;background:#fff;border-radius:8px;padding:5px 8px;font-size:8px;font-weight:800;color:#475569;cursor:pointer}.sex-legend{margin-top:10px;padding-top:8px;border-top:1px solid #e2e8f0;font-size:8.5px;line-height:1.45;color:#64748b}
    `;
    document.head.appendChild(s);
  }

  function card(key){
    const def=EXTRA_DEFS[key],faces=ensureState()[key].faces;
    return `<div class="sex-card"><div class="sex-card-head"><i class="fa-solid ${def.icon}"></i><span>${def.label}</span><span style="margin-left:auto;color:#94a3b8">${def.apu}</span></div><div class="sex-help">${def.help}</div><div class="sex-faces">${FACES.map(face=>`<button type="button" class="sex-face ${faces.includes(face)?'active':''}" data-surface-extra="${key}" data-face="${face}" title="Cara ${face}${face==='E'?' · techo':''}">${face}</button>`).join('')}</div><div class="sex-actions"><button type="button" class="sex-mini" data-surface-all="${key}" data-value="1">Todas</button><button type="button" class="sex-mini" data-surface-all="${key}" data-value="0">Ninguna</button></div></div>`;
  }

  function ensurePanel(){
    const extras=document.getElementById('extras-list');
    if(!extras) return null;
    let panel=document.getElementById('surface-extras-panel');
    if(!panel){
      panel=document.createElement('div');
      panel.id='surface-extras-panel';
      extras.insertAdjacentElement('afterend',panel);
      panel.addEventListener('click',event=>{
        const faceBtn=event.target.closest('[data-surface-extra]');
        if(faceBtn){toggleFace(faceBtn.dataset.surfaceExtra,faceBtn.dataset.face);return;}
        const allBtn=event.target.closest('[data-surface-all]');
        if(allBtn)setAll(allBtn.dataset.surfaceAll,allBtn.dataset.value==='1');
      });
    }
    return panel;
  }

  function renderPanel(){
    if(typeof state==='undefined') return false;
    addStyles();ensureState();
    const panel=ensurePanel();if(!panel)return false;
    panel.innerHTML=`<div class="sex-head"><div><div class="sex-kicker">Extras de superficie</div><div class="sex-title">Tratamiento exterior por cara</div><div class="sex-sub">Selecciona exactamente qué caras necesita el cliente. La cara E corresponde al techo.</div></div></div>${card('grateado')}${card('pintura')}<div class="sex-legend"><b>Caras:</b> A/B laterales largos · C/D testeros · E techo. La cubicación se calcula en m² y descuenta vanos de puertas/ventanas en A–D.</div>`;
    return true;
  }

  let observer=null;
  function observeExtras(){
    const extras=document.getElementById('extras-list');
    if(!extras||observer)return;
    observer=new MutationObserver(()=>renderPanel());
    observer.observe(extras,{childList:true,subtree:true,characterData:true});
  }

  function snapshot(){return clone(ensureState());}
  window.toggleSurfaceExtraFace=toggleFace;
  window.getSurfaceExtrasSnapshot=snapshot;
  window.BAT_KUBIQUEITOR_SURFACE_EXTRAS={version:VERSION,faces:FACES,definitions:EXTRA_DEFS,refresh:renderPanel,snapshot};

  let tries=0;const timer=setInterval(()=>{tries++;if(renderPanel()){observeExtras();clearInterval(timer);}else if(tries>120)clearInterval(timer);},100);
})();
