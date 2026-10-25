// Electrical stage 1: isolated UI + project data only.
// IMPORTANT: this module does not patch rebuild3D, renderAll, editor handlers or Three.js.
(function(){
  if(window.BAT_KUBIQUEITOR_ELECTRICAL_UI_STAGE1) return;

  const VERSION=1;
  const TYPES={
    outlet:{name:'Enchufe doble',icon:'fa-plug',circuit:'Enchufes'},
    switch:{name:'Interruptor',icon:'fa-toggle-on',circuit:'Iluminación'},
    light:{name:'Luminaria LED',icon:'fa-lightbulb',circuit:'Iluminación'},
    acPoint:{name:'Punto A/C',icon:'fa-snowflake',circuit:'Climatización'}
  };

  let observer=null;
  let refreshQueued=false;

  function uid(){
    return 'EL-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7);
  }

  function totalLegacy(){
    return Math.max(0,Math.round(Number(state?.counts?.electrical)||0));
  }

  function defaultPoint(type='outlet'){
    const def=TYPES[type]||TYPES.outlet;
    return {
      id:uid(),
      type:TYPES[type]?type:'outlet',
      circuit:def.circuit,
      face:null,
      position:null,
      height:null
    };
  }

  function ensureElectricalState(){
    if(!state.electrical || typeof state.electrical!=='object'){
      state.electrical={version:1,points:[]};
    }
    if(!Array.isArray(state.electrical.points)) state.electrical.points=[];
    if(!state.electrical.version) state.electrical.version=1;
    return state.electrical;
  }

  function reconcileWithLegacyCount(){
    const e=ensureElectricalState();
    const desired=totalLegacy();
    while(e.points.length<desired) e.points.push(defaultPoint('outlet'));
    if(e.points.length>desired) e.points=e.points.slice(0,desired);
    return e;
  }

  function countsByType(){
    const counts={outlet:0,switch:0,light:0,acPoint:0};
    reconcileWithLegacyCount().points.forEach(p=>{
      if(Object.prototype.hasOwnProperty.call(counts,p.type)) counts[p.type]++;
      else counts.outlet++;
    });
    return counts;
  }

  function syncLegacyTotal(){
    const e=ensureElectricalState();
    if(!state.counts) state.counts={};
    state.counts.electrical=e.points.length;
  }

  function commitChange(fn){
    if(typeof pushHistory==='function') pushHistory();
    fn();
    syncLegacyTotal();
    if(typeof renderAll==='function') renderAll();
    queueRefresh();
  }

  function add(type){
    if(!TYPES[type]) return;
    const max=Number(DATA?.extras?.electrical?.max)||24;
    const e=reconcileWithLegacyCount();
    if(e.points.length>=max){
      if(typeof toast==='function') toast('Máximo '+max+' puntos eléctricos');
      return;
    }
    commitChange(()=>ensureElectricalState().points.push(defaultPoint(type)));
    if(typeof toast==='function') toast(TYPES[type].name+' agregado');
  }

  function remove(type){
    if(!TYPES[type]) return;
    const e=reconcileWithLegacyCount();
    let idx=-1;
    for(let i=e.points.length-1;i>=0;i--){
      if(e.points[i].type===type){idx=i;break;}
    }
    if(idx<0) return;
    commitChange(()=>ensureElectricalState().points.splice(idx,1));
    if(typeof toast==='function') toast(TYPES[type].name+' eliminado');
  }

  function addStyles(){
    if(document.getElementById('electrical-stage1-style')) return;
    const style=document.createElement('style');
    style.id='electrical-stage1-style';
    style.textContent=`
      #electrical-stage1-panel{margin-top:14px;border:1px solid #e2e8f0;border-radius:16px;background:linear-gradient(180deg,#fff,#f8fafc);padding:14px;box-shadow:0 8px 22px rgba(15,23,42,.04)}
      .el1-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}
      .el1-kicker{font-size:10px;line-height:1;text-transform:uppercase;letter-spacing:.12em;font-weight:900;color:#d97706}
      .el1-title{font-size:14px;font-weight:900;color:#0f172a;margin-top:5px}
      .el1-sub{font-size:10px;color:#64748b;margin-top:4px;line-height:1.35}
      .el1-total{min-width:38px;height:38px;border-radius:12px;background:#0f172a;color:#fff;display:grid;place-items:center;font-size:14px;font-weight:900}
      .el1-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}
      .el1-item{border:1px solid #e2e8f0;background:#fff;border-radius:12px;padding:9px}
      .el1-item-top{display:flex;gap:7px;align-items:center;font-size:10px;font-weight:900;color:#334155;min-height:28px}
      .el1-item-top i{width:18px;text-align:center;color:#d97706}
      .el1-controls{display:grid;grid-template-columns:32px 1fr 32px;gap:5px;align-items:center;margin-top:7px}
      .el1-btn{height:30px;border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;font-size:11px;font-weight:900;color:#334155;cursor:pointer}
      .el1-btn:hover{border-color:#f59e0b;background:#fffbeb}
      .el1-count{text-align:center;font-size:13px;font-weight:900;color:#0f172a}
      .el1-footer{margin-top:10px;padding-top:9px;border-top:1px solid #e2e8f0;display:flex;gap:7px;align-items:flex-start;color:#64748b;font-size:9px;line-height:1.4}
      .el1-footer i{color:#16a34a;margin-top:1px}
    `;
    document.head.appendChild(style);
  }

  function panelHtml(){
    const counts=countsByType();
    const total=Object.values(counts).reduce((a,b)=>a+b,0);
    const cards=Object.entries(TYPES).map(([key,def])=>`
      <div class="el1-item">
        <div class="el1-item-top"><i class="fa-solid ${def.icon}"></i><span>${def.name}</span></div>
        <div class="el1-controls">
          <button type="button" class="el1-btn" data-el-action="remove" data-el-type="${key}" aria-label="Quitar ${def.name}">−</button>
          <div class="el1-count">${counts[key]}</div>
          <button type="button" class="el1-btn" data-el-action="add" data-el-type="${key}" aria-label="Agregar ${def.name}">+</button>
        </div>
      </div>`).join('');
    return `
      <div class="el1-head">
        <div><div class="el1-kicker">Instalación eléctrica</div><div class="el1-title">Puntos eléctricos</div><div class="el1-sub">Define qué tipo de puntos tendrá el contenedor. El total sigue conectado a la cotización actual.</div></div>
        <div class="el1-total" title="Total de puntos eléctricos">${total}</div>
      </div>
      <div class="el1-grid">${cards}</div>
      <div class="el1-footer"><i class="fa-solid fa-circle-check"></i><span>Etapa segura: todavía no modifica el modelo 3D ni el editor. Las posiciones se agregarán en la siguiente etapa.</span></div>`;
  }

  function ensurePanel(){
    const extras=document.getElementById('extras-list');
    if(!extras) return null;
    let panel=document.getElementById('electrical-stage1-panel');
    if(!panel){
      panel=document.createElement('div');
      panel.id='electrical-stage1-panel';
      extras.insertAdjacentElement('afterend',panel);
      panel.addEventListener('click',event=>{
        const btn=event.target.closest('[data-el-action]');
        if(!btn) return;
        const type=btn.dataset.elType;
        if(btn.dataset.elAction==='add') add(type);
        if(btn.dataset.elAction==='remove') remove(type);
      });
    }
    return panel;
  }

  function renderPanel(){
    if(typeof state==='undefined' || typeof DATA==='undefined') return false;
    addStyles();
    reconcileWithLegacyCount();
    const panel=ensurePanel();
    if(!panel) return false;
    panel.innerHTML=panelHtml();
    return true;
  }

  function queueRefresh(){
    if(refreshQueued) return;
    refreshQueued=true;
    requestAnimationFrame(()=>{
      refreshQueued=false;
      renderPanel();
    });
  }

  function observeExtras(){
    const extras=document.getElementById('extras-list');
    if(!extras || observer) return;
    observer=new MutationObserver(()=>queueRefresh());
    observer.observe(extras,{childList:true,subtree:true,characterData:true});
  }

  function install(){
    if(typeof state==='undefined' || typeof DATA==='undefined') return false;
    addStyles();
    renderPanel();
    observeExtras();
    window.BAT_KUBIQUEITOR_ELECTRICAL_UI_STAGE1={
      version:VERSION,
      add,
      remove,
      refresh:renderPanel,
      getState:()=>JSON.parse(JSON.stringify(ensureElectricalState()))
    };
    return true;
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',()=>setTimeout(install,120),{once:true});
  }else{
    setTimeout(install,120);
  }
})();
