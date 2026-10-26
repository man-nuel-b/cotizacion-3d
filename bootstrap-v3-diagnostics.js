// BAT-Cubikeitor · bootstrap v3 diagnostics
// Visible only with ?v3diag=1. Read-only.
(function(){
  const params=new URLSearchParams(location.search);
  if(params.get('v3diag')!=='1'||window.BAT_BOOTSTRAP_V3_DIAGNOSTICS)return;

  const esc=value=>String(value??'').replace(/[&<>\"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));

  function boot(){
    const bootstrap=window.BAT_BOOTSTRAP_V3;
    if(!bootstrap){setTimeout(boot,50);return;}

    const style=document.createElement('style');
    style.textContent=`#bat-v3-diag{position:fixed;right:16px;bottom:16px;z-index:10000;width:min(430px,calc(100vw - 32px));max-height:80vh;overflow:auto;background:#0f172a;color:#fff;border:1px solid rgba(245,158,11,.55);border-radius:18px;box-shadow:0 24px 70px rgba(2,6,23,.48);font-family:Inter,sans-serif}#bat-v3-diag .head{padding:12px 14px;border-bottom:1px solid rgba(255,255,255,.1);display:flex;justify-content:space-between;gap:10px}#bat-v3-diag .body{padding:12px 14px}#bat-v3-diag .card{padding:9px 10px;margin-top:8px;border:1px solid rgba(255,255,255,.1);border-radius:12px;background:rgba(255,255,255,.04)}#bat-v3-diag .row{display:flex;justify-content:space-between;gap:10px;font-size:10px;margin-top:4px}#bat-v3-diag .ok{color:#86efac}#bat-v3-diag .warn{color:#fbbf24}#bat-v3-diag .bad{color:#fca5a5}#bat-v3-diag .muted{color:#94a3b8}#bat-v3-diag button{background:rgba(255,255,255,.08);border-radius:8px;padding:5px 8px;font-size:10px;font-weight:800}`;
    document.head.appendChild(style);

    const root=document.createElement('div');root.id='bat-v3-diag';
    root.innerHTML='<div class="head"><div><div style="font-size:9px;font-weight:900;color:#fbbf24;letter-spacing:.08em">DIAGNÓSTICO V3</div><div style="font-size:13px;font-weight:900;margin-top:2px">Arranque determinista</div></div><button data-close>×</button></div><div class="body" data-body></div>';
    document.body.appendChild(root);
    root.querySelector('[data-close]').onclick=()=>root.remove();

    function render(){
      if(!document.body.contains(root))return;
      const d=bootstrap.diagnostics();
      const moduleRows=d.modules.map(m=>`<div class="row"><span>${esc(m.name)}</span><strong class="${m.state==='ready'?'ok':m.state==='error'?'bad':'warn'}">${esc(m.state)}</strong></div>`).join('');
      const ownershipRows=d.ownership.length?d.ownership.map(x=>`<div class="row"><span>${esc(x.function)}</span><strong class="warn">${esc(x.module)}</strong></div>`).join(''):'<div class="muted" style="font-size:10px">Sin reemplazos detectados todavía.</div>';
      const criticalRows=Object.entries(d.critical||{}).map(([name,x])=>`<div class="row"><span>${esc(name)}</span><strong class="${x.exists?'ok':'bad'}">${x.exists?'OK':'FALTA'}</strong></div>`).join('');
      const errors=d.errors.length?d.errors.map(e=>`<div class="row"><span>${esc(e.module)}</span><strong class="bad">${esc(e.message)}</strong></div>`).join(''):'<div class="ok" style="font-size:10px">Sin errores de bootstrap.</div>';
      root.querySelector('[data-body]').innerHTML=`
        <div class="card"><div class="row"><span>Estado</span><strong class="${d.phase==='ready'?'ok':d.phase==='error'?'bad':'warn'}">${esc(d.phase)}</strong></div><div class="row"><span>Módulos</span><strong>${d.modules.length}</strong></div></div>
        <div class="card"><div style="font-size:10px;font-weight:900">Funciones críticas</div>${criticalRows}</div>
        <div class="card"><div style="font-size:10px;font-weight:900">Quién reemplazó funciones</div>${ownershipRows}</div>
        <div class="card"><div style="font-size:10px;font-weight:900">Carga de módulos</div>${moduleRows}</div>
        <div class="card"><div style="font-size:10px;font-weight:900">Errores</div>${errors}</div>
        <div class="muted" style="font-size:9px;line-height:1.45;margin-top:9px">Prueba paredes primero: ventana → mover → cambiar cara → dimensiones → eliminar; luego puerta y tabique. Este panel es solo lectura.</div>`;
    }

    bootstrap.events.addEventListener('module-status',render);
    bootstrap.events.addEventListener('critical-global-changed',render);
    bootstrap.events.addEventListener('bootstrap-ready',render);
    bootstrap.events.addEventListener('bootstrap-error',render);
    const timer=setInterval(render,500);
    window.addEventListener('beforeunload',()=>clearInterval(timer),{once:true});
    window.BAT_BOOTSTRAP_V3_DIAGNOSTICS={version:1,render};
    render();
  }

  boot();
})();
