// Construction-first Interior UX for bat-kubiqueitor.
// Flujo: Tabiquería -> Aislación -> Revestimiento interior, cada uno con caras A-E independientes.
(function(){
  if(typeof renderInteriorSystemUI!=='function'||typeof ensureInteriorSystem!=='function') return;

  const FACE_HELP={A:'Pared A',B:'Pared B',C:'Extremo puertas originales',D:'Extremo opuesto',E:'Cielo'};

  function layerMap(layer){
    const s=ensureInteriorSystem();
    if(layer==='framing') return s.framingFaces;
    if(layer==='insulation') return s.insulationFaces;
    return s.liningFaces;
  }

  function materialOptions(layer){
    const systems=INTERIOR_SYSTEMS[layer]||{};
    const selected=ensureInteriorSystem()[layer];
    const fn=layer==='framing'?'selectInteriorFraming':layer==='insulation'?'selectInteriorInsulation':'selectInteriorLining';
    return `<div class="interior-material-grid">${Object.entries(systems).map(([key,item])=>`
      <button type="button" onclick="${fn}('${key}')" class="interior-material-card ${selected===key?'active':''}">
        <span class="interior-material-icon"><i class="fa-solid ${item.icon}"></i></span>
        <span class="interior-material-copy"><strong>${item.name}</strong><small>${item.desc||''}</small></span>
        <i class="fa-solid ${selected===key?'fa-circle-check':'fa-circle'} interior-material-check"></i>
      </button>`).join('')}</div>`;
  }

  function faceSelector(layer){
    const map=layerMap(layer);
    const activeCount=['A','B','C','D','E'].filter(face=>map[face]).length;
    return `<div class="interior-faces-row">
      <div class="interior-faces-head"><span>Aplicar en</span><small>${activeCount}/5 caras</small></div>
      <div class="interior-face-buttons">
        ${['A','B','C','D','E'].map(face=>`<button type="button" title="${FACE_HELP[face]}" onclick="toggleInteriorLayerFace('${layer}','${face}')" class="layer-face ${map[face]?'active':''}" style="--face-color:${INTERIOR_FACE_COLORS[face]}"><strong>${face}</strong><span>${face==='E'?'Cielo':'Cara'}</span></button>`).join('')}
      </div>
      <div class="interior-face-actions"><button type="button" onclick="setInteriorLayerFaces('${layer}',true)">Todas A–E</button><button type="button" onclick="setInteriorLayerFaces('${layer}',false)">Ninguna</button></div>
    </div>`;
  }

  function layerBlock(number,layer,title,subtitle,icon){
    return `<section class="construction-layer-card">
      <div class="construction-layer-header">
        <span class="construction-layer-number">${number}</span>
        <span class="construction-layer-main-icon"><i class="fa-solid ${icon}"></i></span>
        <div><h3>${title}</h3><p>${subtitle}</p></div>
      </div>
      <div class="construction-layer-body">
        <div class="construction-label">Material / sistema</div>
        ${materialOptions(layer)}
        ${faceSelector(layer)}
      </div>
    </section>`;
  }

  function configurationSummary(){
    const s=ensureInteriorSystem();
    const line=(layer,key)=>{
      const map=layerMap(layer),faces=['A','B','C','D','E'].filter(f=>map[f]);
      const item=INTERIOR_SYSTEMS[layer]?.[s[key]];
      return `${item?.name||s[key]} · ${faces.length?faces.join(', '):'sin caras'}`;
    };
    return `<div class="interior-summary-card">
      <div><i class="fa-solid fa-list-check"></i><strong>Resumen constructivo</strong></div>
      <p><b>Tabiquería:</b> ${line('framing','framing')}</p>
      <p><b>Aislación:</b> ${line('insulation','insulation')}</p>
      <p><b>Revestimiento:</b> ${line('lining','lining')}</p>
    </div>`;
  }

  function updateWizardCopy(){
    const step=document.querySelector('.wizard-step[data-step="3"]');
    if(!step) return;
    const title=step.querySelector('h2'),desc=step.querySelector('p');
    if(title) title.textContent='Sistema interior';
    if(desc) desc.textContent='Configura cada capa constructiva y selecciona exactamente en qué caras A–E se aplicará.';
    const finishLabel=[...step.querySelectorAll('label')].find(el=>(el.textContent||'').includes('Nivel de terminación')||(el.textContent||'').includes('Elige una opción rápida'));
    if(finishLabel) finishLabel.classList.add('hidden');
    const finishList=document.getElementById('finish-list');
    if(finishList) finishList.classList.add('hidden');
  }

  const renderInteriorBeforeLayerUX=renderInteriorSystemUI;
  renderInteriorSystemUI=function(){
    renderInteriorBeforeLayerUX();
    const root=document.getElementById('interior-system-config');
    if(!root) return;
    updateWizardCopy();
    root.className='mt-1';
    root.innerHTML=`
      <div class="construction-flow-note"><i class="fa-solid fa-circle-info"></i><span>Cada etapa se configura por separado. Puedes usar distintas caras para tabiquería, aislación y revestimiento.</span></div>
      ${layerBlock(1,'framing','Tabiquería','Elige la estructura que soportará el sistema interior.','fa-grip-lines-vertical')}
      ${layerBlock(2,'insulation','Aislación','Selecciona el aislante térmico/acústico y dónde instalarlo.','fa-temperature-half')}
      ${layerBlock(3,'lining','Revestimiento interior','Define la terminación visible de muros y cielo.','fa-layer-group')}
      ${configurationSummary()}
      <div class="partition-finish-row"><span><i class="fa-solid fa-grip-lines-vertical"></i><span><strong>Divisiones interiores</strong><small>Aplicar el revestimiento seleccionado a los tabiques interiores.</small></span></span><button type="button" onclick="toggleInteriorOption('partitions')" class="partition-finish-toggle ${ensureInteriorSystem().partitions?'active':''}">${ensureInteriorSystem().partitions?'Sí':'No'}</button></div>`;

    if(!document.getElementById('interior-layered-style')){
      const style=document.createElement('style');
      style.id='interior-layered-style';
      style.textContent=`
        #interior-step-content #finish-list{display:none!important}.construction-flow-note{display:flex;gap:8px;align-items:flex-start;background:#eff6ff;border:1px solid #bfdbfe;color:#1e40af;border-radius:12px;padding:10px;font-size:10px;line-height:1.35;margin-bottom:10px}.construction-flow-note i{margin-top:2px}.construction-layer-card{border:1px solid #e2e8f0;border-radius:15px;background:#fff;overflow:hidden;margin-bottom:10px}.construction-layer-header{display:grid;grid-template-columns:24px 34px 1fr;gap:8px;align-items:center;padding:11px 12px;background:#f8fafc;border-bottom:1px solid #e2e8f0}.construction-layer-number{width:24px;height:24px;border-radius:50%;display:grid;place-items:center;background:#0f172a;color:white;font-size:10px;font-weight:900}.construction-layer-main-icon{width:34px;height:34px;border-radius:9px;display:grid;place-items:center;background:#fff;border:1px solid #e2e8f0;color:#f59e0b}.construction-layer-header h3{font-size:13px;font-weight:900;color:#0f172a;margin:0}.construction-layer-header p{font-size:9px;color:#64748b;margin:2px 0 0}.construction-layer-body{padding:11px}.construction-label{font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:#64748b;font-weight:900;margin-bottom:6px}.interior-material-grid{display:grid;grid-template-columns:1fr;gap:6px}.interior-material-card{display:grid;grid-template-columns:32px 1fr 18px;gap:8px;align-items:center;text-align:left;border:1px solid #e2e8f0;background:white;border-radius:11px;padding:8px}.interior-material-card.active{border-color:#f59e0b;background:#fffbeb;box-shadow:0 0 0 1px rgba(245,158,11,.12)}.interior-material-icon{width:32px;height:32px;border-radius:8px;background:#f1f5f9;display:grid;place-items:center;color:#475569}.interior-material-card.active .interior-material-icon{background:#f59e0b;color:#0f172a}.interior-material-copy{display:flex;flex-direction:column;min-width:0}.interior-material-copy strong{font-size:10px;color:#0f172a}.interior-material-copy small{font-size:8px;color:#94a3b8;margin-top:1px}.interior-material-check{font-size:12px;color:#cbd5e1}.interior-material-card.active .interior-material-check{color:#f59e0b}.interior-faces-row{margin-top:10px;padding-top:9px;border-top:1px dashed #e2e8f0}.interior-faces-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}.interior-faces-head span{font-size:9px;text-transform:uppercase;letter-spacing:.07em;color:#64748b;font-weight:900}.interior-faces-head small{font-size:8px;color:#94a3b8}.interior-face-buttons{display:grid;grid-template-columns:repeat(5,1fr);gap:5px}.layer-face{border:1px solid #e2e8f0;border-radius:9px;background:#fff;padding:6px 2px;display:flex;flex-direction:column;align-items:center}.layer-face strong{font-size:11px;color:#64748b}.layer-face span{font-size:7px;color:#94a3b8;margin-top:1px}.layer-face.active{border-color:var(--face-color);background:color-mix(in srgb,var(--face-color) 8%,white);box-shadow:0 0 0 1px var(--face-color)}.layer-face.active strong{color:var(--face-color)}.interior-face-actions{display:flex;gap:5px;margin-top:5px}.interior-face-actions button{border:0;background:#f1f5f9;color:#64748b;border-radius:7px;padding:5px 8px;font-size:8px;font-weight:800}.interior-summary-card{background:#0f172a;color:#fff;border-radius:13px;padding:11px;margin-top:10px}.interior-summary-card>div{display:flex;align-items:center;gap:7px;color:#fbbf24;font-size:10px}.interior-summary-card p{font-size:9px;color:#cbd5e1;margin:5px 0 0;line-height:1.35}.interior-summary-card b{color:#fff}.partition-finish-row{margin-top:9px;border:1px solid #e2e8f0;border-radius:12px;padding:10px;display:flex;justify-content:space-between;gap:10px;align-items:center;background:#fff}.partition-finish-row>span{display:flex;gap:8px;align-items:flex-start;color:#64748b}.partition-finish-row strong{display:block;font-size:10px;color:#0f172a}.partition-finish-row small{display:block;font-size:8px;color:#94a3b8;margin-top:1px}.partition-finish-toggle{border:1px solid #e2e8f0;background:#f1f5f9;color:#64748b;border-radius:9px;padding:7px 11px;font-size:9px;font-weight:900}.partition-finish-toggle.active{background:#f59e0b;border-color:#f59e0b;color:#0f172a}@media(max-width:420px){.interior-face-buttons{gap:3px}.layer-face{padding:6px 1px}.construction-layer-body{padding:9px}}
      `;
      document.head.appendChild(style);
    }
  };

  function boot(){ensureInteriorSystem();renderInteriorSystemUI();updateWizardCopy();}
  if(document.readyState==='loading') window.addEventListener('DOMContentLoaded',()=>setTimeout(boot,40),{once:true});
  else setTimeout(boot,40);
})();
