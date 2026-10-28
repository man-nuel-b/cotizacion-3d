// BAT-Cubikeitor · Core V2 manual test panel
// Enabled only with ?v2test=1. Does not modify legacy editor/render functions.
(function(){
  if(window.BAT_CORE_V2_TEST_PANEL) return;
  const params=new URLSearchParams(location.search);
  if(params.get('v2test')!=='1') return;

  const money=value=>new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(Math.round(Number(value)||0)).replace('CLP','$');
  const m2=value=>`${(Number(value)||0).toFixed(2)} m²`;
  const esc=value=>String(value??'').replace(/[&<>\"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));

  function boot(){
    const core=window.BAT_CORE_V2,surface=window.BAT_SURFACE_SYSTEM_V2;
    if(!core||!surface){setTimeout(boot,80);return;}

    const style=document.createElement('style');
    style.textContent=`#bat-v2-test{position:fixed;right:18px;bottom:18px;z-index:9999;width:min(390px,calc(100vw - 36px));max-height:78vh;overflow:auto;background:#0f172a;color:#fff;border:1px solid rgba(245,158,11,.55);border-radius:18px;box-shadow:0 24px 70px rgba(2,6,23,.45);font-family:Inter,sans-serif}#bat-v2-test .h{padding:13px 14px;border-bottom:1px solid rgba(255,255,255,.1);display:flex;align-items:center;justify-content:space-between}#bat-v2-test .b{padding:14px}#bat-v2-test .faces{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-top:7px}#bat-v2-test button.f{border:1px solid rgba(255,255,255,.15);border-radius:9px;padding:7px 0;font-size:11px;font-weight:800;background:rgba(255,255,255,.06)}#bat-v2-test button.f.on{background:#f59e0b;color:#0f172a;border-color:#f59e0b}#bat-v2-test .card{border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:10px;margin-top:9px;background:rgba(255,255,255,.04)}#bat-v2-test .r{display:flex;justify-content:space-between;gap:12px;font-size:11px;margin-top:5px}#bat-v2-test .ok{color:#86efac}#bat-v2-test .bad{color:#fca5a5}#bat-v2-test .muted{color:#94a3b8}#bat-v2-test .close{width:28px;height:28px;border-radius:8px;background:rgba(255,255,255,.08)};`;
    document.head.appendChild(style);

    const root=document.createElement('div');root.id='bat-v2-test';
    root.innerHTML='<div class="h"><div><div style="font-size:10px;font-weight:900;color:#fbbf24;letter-spacing:.08em">PRUEBA ARQUITECTURA V2</div><div style="font-size:13px;font-weight:900;margin-top:2px">Superficies aisladas de paredes</div></div><button class="close" title="Cerrar">×</button></div><div class="b"><div id="bat-v2-body"></div></div>';
    document.body.appendChild(root);
    root.querySelector('.close').onclick=()=>root.remove();

    function facesHtml(type,state){return ['A','B','C','D','E'].map(face=>`<button class="f ${state?.[face]?'on':''}" data-type="${type}" data-face="${face}">${face}</button>`).join('');}

    function render(){
      const snapshot=surface.snapshot();
      const apu=window.BAT_APU_ENGINE_V2?.calculate?.()||{items:[],ready:false};
      const guard=window.BAT_CORE_V2_GUARD?.run?.()||{ok:false,checks:[],pending:true};
      const project=core.store.get();
      const body=document.getElementById('bat-v2-body');if(!body)return;
      const apuRows=(apu.items||[]).map(item=>`<div class="r"><span>${esc(item.code)} · ${esc(item.name)}</span><strong>${m2(item.qty)}</strong></div><div class="r muted"><span>PU neto</span><span>${item.pricingReady?money(item.netUnit):'cargando APU…'}</span></div><div class="r"><span>Subtotal neto</span><strong>${item.pricingReady?money(item.netSubtotal):'—'}</strong></div>`).join('')||'<div class="muted" style="font-size:11px">Selecciona caras para generar P44/P45.</div>';
      const checkRows=(guard.checks||[]).map(c=>`<div class="r"><span>${esc(c.name||'check')}</span><strong class="${c.ok?'ok':'bad'}">${c.ok?'OK':'FALLA'}</strong></div>`).join('');
      body.innerHTML=`
        <div class="card"><div style="font-size:11px;font-weight:900">Pintura exterior · P45</div><div class="faces">${facesHtml('paint',snapshot.paint.faces)}</div><div class="r"><span>Área seleccionada</span><strong>${m2(snapshot.paint.m2)}</strong></div></div>
        <div class="card"><div style="font-size:11px;font-weight:900">Grateado / preparación · P44</div><div class="faces">${facesHtml('grateado',snapshot.grateado.faces)}</div><div class="r"><span>Área seleccionada</span><strong>${m2(snapshot.grateado.m2)}</strong></div></div>
        <div class="card"><div style="font-size:11px;font-weight:900">APU V2</div>${apuRows}<div class="r" style="border-top:1px solid rgba(255,255,255,.1);padding-top:7px"><span>Total neto superficies</span><strong>${apu.ready?money(apu.net):'—'}</strong></div></div>
        <div class="card"><div class="r"><span>Contenedor</span><strong>${esc(project.container.type)}</strong></div><div class="r"><span>Pared neta V2</span><strong>${m2(project.geometry.wallNetArea)}</strong></div><div class="r"><span>Regresión</span><strong class="${guard.ok?'ok':'bad'}">${guard.ok?'SIN ALERTAS':'REVISAR'}</strong></div>${checkRows}</div>
        <div class="muted" style="font-size:10px;line-height:1.45;margin-top:10px">Prueba recomendada: agrega/mueve una ventana o puerta en el editor normal y confirma que sigue funcionando. Después selecciona caras aquí. Este panel no llama ni reemplaza funciones de paredes.</div>`;
      body.querySelectorAll('[data-type][data-face]').forEach(btn=>btn.addEventListener('click',()=>{surface.toggleFace(btn.dataset.type,btn.dataset.face);render();}));
    }

    core.events.on('project:changed',()=>setTimeout(render,0));
    core.quantityEvents.on('quantities:changed',()=>setTimeout(render,0));
    const timer=setInterval(render,1000);
    window.addEventListener('beforeunload',()=>clearInterval(timer),{once:true});
    window.BAT_CORE_V2_TEST_PANEL={version:2,render};
    render();
  }

  boot();
})();