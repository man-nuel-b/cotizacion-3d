// Customer-friendly Interior UX for bat-kubiqueitor.
// Keeps the technical A-F system and BOM underneath, but presents a simple decision flow.
(function(){
  if(typeof renderInteriorSystemUI!=='function'||typeof ensureInteriorSystem!=='function') return;

  const PACKAGE_META={
    basic:{title:'Práctico',subtitle:'Resistente y económico',icon:'fa-hammer',detail:'OSB · aislación EPS · piso flotante'},
    standard:{title:'Oficina',subtitle:'Terminación limpia y confortable',icon:'fa-building',detail:'Yeso-cartón · lana de vidrio · piso vinílico'},
    sanitary:{title:'Lavable',subtitle:'Para baños y zonas húmedas',icon:'fa-droplet',detail:'PVC lavable · EPS · piso vinílico'}
  };
  const FLOOR_NAMES={vinyl:'Vinílico',floating:'Flotante'};

  function ensureUXState(){
    const s=ensureInteriorSystem();
    if(typeof s.advancedOpen!=='boolean') s.advancedOpen=false;
    return s;
  }

  function facesOn(faces){
    const s=ensureUXState();
    return faces.filter(face=>s.faces[face]).length;
  }

  window.setInteriorSurfaceGroup=function(group){
    const groups={walls:['A','B','C','D'],ceiling:['E'],floor:['F']};
    const faces=groups[group]; if(!faces) return;
    const s=ensureUXState();
    const allOn=faces.every(face=>s.faces[face]);
    pushHistory();
    faces.forEach(face=>s.faces[face]=!allOn);
    s.ceiling=s.faces.E;
    renderAll();
    const label=group==='walls'?'Paredes':group==='ceiling'?'Cielo':'Piso';
    toast(`${label}: ${!allOn?'incluido':'sin terminación interior'}`);
  };

  window.toggleInteriorAdvanced=function(){
    const s=ensureUXState();
    s.advancedOpen=!s.advancedOpen;
    renderInteriorSystemUI();
  };

  function packageCard(key){
    const meta=PACKAGE_META[key]||{title:DATA.finishes[key]?.name||key,subtitle:'',icon:'fa-layer-group',detail:''};
    const active=state.finish===key;
    return `<button type="button" onclick="selectFinish('${key}')" class="interior-package ${active?'active':''}">
      <span class="interior-package-icon"><i class="fa-solid ${meta.icon}"></i></span>
      <span class="interior-package-copy"><strong>${meta.title}</strong><small>${meta.subtitle}</small><em>${meta.detail}</em></span>
      <span class="interior-package-check"><i class="fa-solid ${active?'fa-circle-check':'fa-circle'}"></i></span>
    </button>`;
  }

  function surfaceCard(group,title,desc,icon,faces){
    const count=facesOn(faces),active=count===faces.length,partial=count>0&&!active;
    const status=faces.length===1?(active?'Incluido':'No incluido'):(active?'Todas':partial?`${count} de ${faces.length}`:'Ninguna');
    return `<button type="button" onclick="setInteriorSurfaceGroup('${group}')" class="interior-surface ${active||partial?'active':''} ${partial?'partial':''}">
      <span class="interior-surface-icon"><i class="fa-solid ${icon}"></i></span>
      <span><strong>${title}</strong><small>${desc}</small></span>
      <em>${status}</em>
    </button>`;
  }

  function summaryText(){
    const s=ensureUXState();
    const walls=['A','B','C','D'].filter(face=>s.faces[face]);
    const lining=INTERIOR_SYSTEMS.lining[s.lining]?.name||s.lining;
    const insulation=INTERIOR_SYSTEMS.insulation[s.insulation]?.name||s.insulation;
    const floor=FLOOR_NAMES[DATA.finishes[state.finish]?.flooring]||DATA.finishes[state.finish]?.flooring||'—';
    const parts=[];
    if(walls.length) parts.push(`${walls.length===4?'4 paredes':`Paredes ${walls.join(', ')}`} · ${lining}`);
    if(s.faces.E) parts.push('Cielo');
    if(s.faces.F) parts.push(`Piso ${floor}`);
    return {main:parts.join(' · ')||'Sin terminaciones seleccionadas',secondary:`Aislación: ${insulation}`};
  }

  function enhanceWizardCopy(){
    const step=document.querySelector('.wizard-step[data-step="3"]');
    if(!step) return;
    const title=step.querySelector('h2');
    const desc=step.querySelector('p');
    const label=[...step.querySelectorAll('label')].find(el=>(el.textContent||'').includes('Nivel de terminación'));
    if(title) title.textContent='Diseña el interior';
    if(desc) desc.textContent='Elige una opción rápida. Después puedes ajustar paredes, cielo y piso si lo necesitas.';
    if(label) label.textContent='1. Elige una opción rápida';
  }

  const renderInteriorSystemUIBeforeUX=renderInteriorSystemUI;
  renderInteriorSystemUI=function(){
    const s=ensureUXState();
    const finishList=document.getElementById('finish-list');
    if(!finishList) return;

    // Let the original layer create its root/style, then replace only the customer-facing markup.
    renderInteriorSystemUIBeforeUX();
    enhanceWizardCopy();

    finishList.className='grid gap-2';
    finishList.innerHTML=['basic','standard','sanitary'].filter(key=>DATA.finishes[key]).map(packageCard).join('');

    const root=document.getElementById('interior-system-config');
    if(!root) return;
    root.className='mt-4';
    const summary=summaryText();
    root.innerHTML=`
      <div class="interior-simple-section">
        <div class="interior-section-heading"><span>2</span><div><strong>¿Dónde quieres terminación?</strong><small>Activa solo las superficies que llevará el módulo.</small></div></div>
        <div class="interior-surface-grid">
          ${surfaceCard('walls','Paredes','Caras A, B, C y D','fa-border-all',['A','B','C','D'])}
          ${surfaceCard('ceiling','Cielo','Cara E','fa-up-long',['E'])}
          ${surfaceCard('floor','Piso','Cara F','fa-layer-group',['F'])}
        </div>
      </div>

      <div class="interior-result-card">
        <div class="interior-result-icon"><i class="fa-solid fa-circle-check"></i></div>
        <div><span>Así queda configurado</span><strong>${summary.main}</strong><small>${summary.secondary}</small></div>
      </div>

      <button type="button" onclick="toggleInteriorAdvanced()" class="interior-advanced-trigger">
        <span><i class="fa-solid fa-sliders mr-2"></i>Personalizar detalles</span>
        <i class="fa-solid ${s.advancedOpen?'fa-chevron-up':'fa-chevron-down'}"></i>
      </button>

      ${s.advancedOpen?`<div class="interior-advanced-panel">
        <div class="interior-advanced-block">
          <div class="interior-advanced-title">Ajuste por cara</div>
          <div class="interior-face-grid customer-clear">
            ${['A','B','C','D','E','F'].map(face=>`<button type="button" onclick="toggleInteriorFace('${face}')" class="interior-face-choice ${s.faces[face]?'active':''}" style="--face-color:${INTERIOR_FACE_COLORS[face]}"><strong>${face}</strong><span>${INTERIOR_FACE_LABELS[face]}</span></button>`).join('')}
          </div>
        </div>

        <div class="interior-advanced-block">
          <div class="interior-advanced-title">Terminación de paredes</div>
          <div class="grid gap-1.5">
            ${Object.entries(INTERIOR_SYSTEMS.lining).map(([key,item])=>`<button type="button" onclick="selectInteriorLining('${key}')" class="interior-choice ${s.lining===key?'active':''}"><span><i class="fa-solid ${item.icon} mr-2"></i><strong>${item.name}</strong></span><small>${item.desc}</small></button>`).join('')}
          </div>
        </div>

        <div class="interior-advanced-block">
          <div class="interior-advanced-title">Aislación</div>
          <div class="grid grid-cols-2 gap-1.5">
            ${Object.entries(INTERIOR_SYSTEMS.insulation).map(([key,item])=>`<button type="button" onclick="selectInteriorInsulation('${key}')" class="interior-mini-choice ${s.insulation===key?'active':''}"><i class="fa-solid ${item.icon}"></i><span>${item.name}</span></button>`).join('')}
          </div>
        </div>

        <button type="button" onclick="toggleInteriorOption('partitions')" class="interior-toggle w-full ${s.partitions?'active':''}">
          <span><i class="fa-solid fa-grip-lines-vertical mr-2"></i>Revestir divisiones interiores</span>
          <strong>${s.partitions?'Sí':'No'}</strong>
        </button>
      </div>`:''}`;

    if(!document.getElementById('interior-ux-style')){
      const style=document.createElement('style');
      style.id='interior-ux-style';
      style.textContent=`
        #interior-step-content #finish-list{margin-top:0!important}.interior-package{width:100%;display:grid;grid-template-columns:42px 1fr 24px;gap:10px;align-items:center;text-align:left;border:1px solid #e2e8f0;border-radius:14px;background:#fff;padding:11px;transition:.15s ease}.interior-package:hover{border-color:#cbd5e1;transform:translateY(-1px)}.interior-package.active{border-color:#f59e0b;background:#fffbeb;box-shadow:0 0 0 1px rgba(245,158,11,.16)}.interior-package-icon{width:42px;height:42px;border-radius:12px;display:grid;place-items:center;background:#f1f5f9;color:#475569}.interior-package.active .interior-package-icon{background:#f59e0b;color:#0f172a}.interior-package-copy{display:flex;flex-direction:column;min-width:0}.interior-package-copy strong{font-size:12px;color:#0f172a}.interior-package-copy small{font-size:10px;color:#64748b;margin-top:1px}.interior-package-copy em{font-style:normal;font-size:9px;color:#94a3b8;margin-top:3px}.interior-package-check{color:#cbd5e1;text-align:center}.interior-package.active .interior-package-check{color:#f59e0b}
        .interior-simple-section{border-top:1px solid #e2e8f0;padding-top:14px;margin-top:14px}.interior-section-heading{display:flex;gap:9px;align-items:flex-start;margin-bottom:9px}.interior-section-heading>span{width:22px;height:22px;border-radius:50%;background:#0f172a;color:#fff;display:grid;place-items:center;font-size:10px;font-weight:900;flex:0 0 22px}.interior-section-heading strong{display:block;font-size:12px;color:#0f172a}.interior-section-heading small{display:block;font-size:9px;color:#94a3b8;margin-top:1px}.interior-surface-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.interior-surface{position:relative;display:flex;flex-direction:column;align-items:flex-start;min-height:92px;border:1px solid #e2e8f0;background:#fff;border-radius:12px;padding:9px;text-align:left}.interior-surface.active{border-color:#38bdf8;background:#f0f9ff;box-shadow:0 0 0 1px rgba(56,189,248,.12)}.interior-surface.partial{border-style:dashed}.interior-surface-icon{width:28px;height:28px;border-radius:8px;display:grid;place-items:center;background:#f1f5f9;color:#475569;margin-bottom:7px}.interior-surface.active .interior-surface-icon{background:#0ea5e9;color:#fff}.interior-surface strong{display:block;font-size:10px;color:#0f172a}.interior-surface small{display:block;font-size:8px;color:#94a3b8;margin-top:1px}.interior-surface em{font-style:normal;font-size:8px;font-weight:800;color:#0284c7;margin-top:auto;padding-top:5px}
        .interior-result-card{margin-top:12px;border-radius:13px;background:#0f172a;color:#fff;padding:11px;display:flex;gap:9px;align-items:flex-start}.interior-result-icon{color:#34d399;margin-top:1px}.interior-result-card span{display:block;font-size:8px;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8;font-weight:800}.interior-result-card strong{display:block;font-size:10px;margin-top:2px}.interior-result-card small{display:block;font-size:9px;color:#cbd5e1;margin-top:2px}.interior-advanced-trigger{margin-top:10px;width:100%;display:flex;align-items:center;justify-content:space-between;border:1px solid #e2e8f0;background:#fff;border-radius:11px;padding:9px 10px;color:#475569;font-size:10px;font-weight:800}.interior-advanced-panel{margin-top:7px;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc;padding:10px}.interior-advanced-block+.interior-advanced-block{margin-top:12px;padding-top:12px;border-top:1px solid #e2e8f0}.interior-advanced-title{font-size:9px;text-transform:uppercase;letter-spacing:.07em;font-weight:900;color:#64748b;margin-bottom:6px}.interior-toggle{display:flex!important;align-items:center!important;justify-content:space-between!important;margin-top:12px!important}
        @media(max-width:420px){.interior-surface-grid{grid-template-columns:1fr}.interior-surface{min-height:70px;display:grid;grid-template-columns:34px 1fr auto;align-items:center}.interior-surface-icon{margin-bottom:0}.interior-surface em{margin:0;padding:0}}
      `;
      document.head.appendChild(style);
    }
  };

  function boot(){ensureUXState();renderInteriorSystemUI();enhanceWizardCopy();}
  if(document.readyState==='loading') window.addEventListener('DOMContentLoaded',()=>setTimeout(boot,30),{once:true});
  else setTimeout(boot,30);
})();
