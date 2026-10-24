// Construction-first wall UX for bat-kubiqueitor.
// Scope: wall system only (A-E). Floor is owned by floor-finishes.js.
(function(){
  if(typeof ensureInteriorSystem!=='function') return;

  const MODEL_VERSION=3;
  const FACES=['A','B','C','D','E'];
  const FACE_HELP={A:'Pared A',B:'Pared B',C:'Extremo puertas originales',D:'Extremo opuesto',E:'Cielo'};

  function normalizeLayerDependencies(){
    const s=ensureInteriorSystem();
    if(s.dependencyRuleVersion!==MODEL_VERSION){
      // Preserve existing choices. Only initialize missing booleans.
      FACES.forEach(face=>{
        if(typeof s.framingFaces[face]!=='boolean') s.framingFaces[face]=true;
        if(typeof s.insulationFaces[face]!=='boolean') s.insulationFaces[face]=Boolean(s.framingFaces[face]);
        if(typeof s.liningFaces[face]!=='boolean') s.liningFaces[face]=Boolean(s.framingFaces[face]);
      });
      s.dependencyRuleVersion=MODEL_VERSION;
      if(!['framing','insulation','lining','assembly'].includes(s.previewLayer)) s.previewLayer='assembly';
    }

    FACES.forEach(face=>{
      if(!s.framingFaces[face]){
        s.insulationFaces[face]=false;
        s.liningFaces[face]=false;
      }
    });
    s.faces=s.liningFaces;
    s.ceiling=Boolean(s.liningFaces.E);
    return s;
  }

  function layerMap(layer){
    const s=normalizeLayerDependencies();
    if(layer==='framing') return s.framingFaces;
    if(layer==='insulation') return s.insulationFaces;
    return s.liningFaces;
  }

  function hasAnyFraming(){return FACES.some(face=>normalizeLayerDependencies().framingFaces[face]);}
  window.normalizeInteriorLayerDependencies=normalizeLayerDependencies;

  window.toggleInteriorLayerFace=function(layer,face){
    if(!FACES.includes(face)) return;
    const s=normalizeLayerDependencies(),map=layerMap(layer);
    if(layer!=='framing'&&!s.framingFaces[face]) return toast(`Primero instala tabiquería en la cara ${face}`);
    pushHistory();
    map[face]=!map[face];
    if(layer==='framing'&&!map[face]){s.insulationFaces[face]=false;s.liningFaces[face]=false;}
    s.previewLayer=layer;s.faces=s.liningFaces;s.ceiling=Boolean(s.liningFaces.E);renderAll();
  };

  window.setInteriorLayerFaces=function(layer,value){
    const s=normalizeLayerDependencies(),map=layerMap(layer);
    if(layer!=='framing'&&value&&!hasAnyFraming()) return toast('Primero instala tabiquería en al menos una cara');
    pushHistory();
    if(layer==='framing'){
      FACES.forEach(face=>{map[face]=Boolean(value);if(!value){s.insulationFaces[face]=false;s.liningFaces[face]=false;}});
    }else{
      FACES.forEach(face=>{map[face]=Boolean(value)&&Boolean(s.framingFaces[face]);});
    }
    s.previewLayer=layer;s.faces=s.liningFaces;s.ceiling=Boolean(s.liningFaces.E);renderAll();
  };

  if(typeof selectInteriorFraming==='function'){
    const base=selectInteriorFraming;
    selectInteriorFraming=function(key){normalizeLayerDependencies().previewLayer='framing';return base(key);};
  }
  if(typeof selectInteriorInsulation==='function'){
    const base=selectInteriorInsulation;
    selectInteriorInsulation=function(key){if(!hasAnyFraming())return toast('Primero instala tabiquería en al menos una cara');normalizeLayerDependencies().previewLayer='insulation';return base(key);};
  }
  if(typeof selectInteriorLining==='function'){
    const base=selectInteriorLining;
    selectInteriorLining=function(key){if(!hasAnyFraming())return toast('Primero instala tabiquería en al menos una cara');normalizeLayerDependencies().previewLayer='lining';return base(key);};
  }

  function materialOptions(layer){
    const s=normalizeLayerDependencies(),systems=INTERIOR_SYSTEMS[layer]||{},selected=s[layer];
    const locked=layer!=='framing'&&!hasAnyFraming();
    const fn=layer==='framing'?'selectInteriorFraming':layer==='insulation'?'selectInteriorInsulation':'selectInteriorLining';
    return `<div class="interior-material-grid">${Object.entries(systems).map(([key,item])=>`<button type="button" ${locked?'disabled':''} onclick="${fn}('${key}')" class="interior-material-card ${selected===key?'active':''} ${locked?'locked':''}"><span class="interior-material-icon"><i class="fa-solid ${item.icon}"></i></span><span class="interior-material-copy"><strong>${item.name}</strong><small>${locked?'Primero instala tabiquería':(item.desc||'')}</small></span><i class="fa-solid ${selected===key?'fa-circle-check':'fa-circle'} interior-material-check"></i></button>`).join('')}</div>`;
  }

  function faceSelector(layer){
    const s=normalizeLayerDependencies(),map=layerMap(layer),dependent=layer!=='framing';
    const framedCount=FACES.filter(face=>s.framingFaces[face]).length,activeCount=FACES.filter(face=>map[face]).length;
    return `<div class="interior-faces-row"><div class="interior-faces-head"><span>Aplicar en</span><small>${activeCount}/${dependent?framedCount:5}</small></div>${dependent?'<div class="dependency-note"><i class="fa-solid fa-lock"></i> Solo se habilitan caras con tabiquería.</div>':''}<div class="interior-face-buttons">${FACES.map(face=>{const available=!dependent||Boolean(s.framingFaces[face]);return `<button type="button" ${available?`onclick="toggleInteriorLayerFace('${layer}','${face}')"`:'disabled'} title="${available?FACE_HELP[face]:`Primero instala tabiquería en ${face}`}" class="layer-face ${map[face]?'active':''} ${available?'':'locked'}" style="--face-color:${INTERIOR_FACE_COLORS[face]}"><strong>${face}</strong><span>${face==='E'?'Cielo':'Cara'}</span></button>`;}).join('')}</div><div class="interior-face-actions"><button type="button" onclick="setInteriorLayerFaces('${layer}',true)">${dependent?'Todas con tabiquería':'Todas A-E'}</button><button type="button" onclick="setInteriorLayerFaces('${layer}',false)">Ninguna</button></div></div>`;
  }

  function layerBlock(number,layer,title,subtitle,icon){return `<section class="construction-layer-card"><div class="construction-layer-header"><span class="construction-layer-number">${number}</span><span class="construction-layer-main-icon"><i class="fa-solid ${icon}"></i></span><div><h3>${title}</h3><p>${subtitle}</p></div></div><div class="construction-layer-body"><div class="construction-label">Material / sistema</div>${materialOptions(layer)}${faceSelector(layer)}</div></section>`;}

  function configurationSummary(){
    const s=normalizeLayerDependencies();
    const summary=(layer,key)=>{const faces=FACES.filter(face=>layerMap(layer)[face]);const item=INTERIOR_SYSTEMS[layer]?.[s[key]];return `${item?.name||s[key]} · ${faces.length?faces.join(', '):'sin instalar'}`;};
    return `<div class="interior-summary-card"><div><i class="fa-solid fa-list-check"></i><strong>Resumen constructivo</strong></div><p><b>Tabiquería:</b> ${summary('framing','framing')}</p><p><b>Aislación:</b> ${summary('insulation','insulation')}</p><p><b>Revestimiento:</b> ${summary('lining','lining')}</p></div>`;
  }

  window.renderInteriorSystemUI=function(){
    const finishList=document.getElementById('finish-list');if(!finishList)return;
    normalizeLayerDependencies();
    let root=document.getElementById('interior-system-config');
    if(!root){root=document.createElement('div');root.id='interior-system-config';finishList.insertAdjacentElement('afterend',root);}
    finishList.classList.add('hidden');
    root.className='mt-1';
    root.innerHTML=`<div class="construction-flow-note"><i class="fa-solid fa-circle-info"></i><span><b>Orden:</b> Tabiquería → Aislación → Revestimiento.</span></div>${layerBlock(1,'framing','Tabiquería','Selecciona Metalcon o madera y luego las caras.','fa-grip-lines-vertical')}${layerBlock(2,'insulation','Aislación','Solo se instala sobre caras con tabiquería.','fa-temperature-half')}${layerBlock(3,'lining','Revestimiento interior','Solo se instala sobre caras con tabiquería.','fa-layer-group')}${configurationSummary()}<div class="partition-finish-row"><span><i class="fa-solid fa-grip-lines-vertical"></i><span><strong>Divisiones interiores</strong><small>Usar el sistema de revestimiento en tabiques interiores.</small></span></span><button type="button" onclick="toggleInteriorOption('partitions')" class="partition-finish-toggle ${normalizeLayerDependencies().partitions?'active':''}">${normalizeLayerDependencies().partitions?'Sí':'No'}</button></div>`;
    window.BAT_KUBIQUEITOR_SIX_STEP_WIZARD?.sync?.();
  };

  if(!document.getElementById('interior-layered-style')){
    const style=document.createElement('style');style.id='interior-layered-style';style.textContent=`.construction-flow-note{display:flex;gap:8px;align-items:flex-start;background:#eff6ff;border:1px solid #bfdbfe;color:#1e40af;border-radius:12px;padding:10px;font-size:10px;line-height:1.4;margin-bottom:10px}.construction-layer-card{border:1px solid #e2e8f0;border-radius:15px;background:#fff;overflow:hidden;margin-bottom:10px}.construction-layer-header{display:grid;grid-template-columns:24px 34px 1fr;gap:8px;align-items:center;padding:11px 12px;background:#f8fafc;border-bottom:1px solid #e2e8f0}.construction-layer-number{width:24px;height:24px;border-radius:50%;display:grid;place-items:center;background:#0f172a;color:#fff;font-size:10px;font-weight:900}.construction-layer-main-icon{width:34px;height:34px;border-radius:9px;display:grid;place-items:center;background:#fff;border:1px solid #e2e8f0;color:#f59e0b}.construction-layer-header h3{font-size:13px;font-weight:900;color:#0f172a;margin:0}.construction-layer-header p{font-size:9px;color:#64748b;margin:2px 0 0}.construction-layer-body{padding:11px}.construction-label{font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:#64748b;font-weight:900;margin-bottom:6px}.interior-material-grid{display:grid;gap:6px}.interior-material-card{display:grid;grid-template-columns:32px 1fr 18px;gap:8px;align-items:center;text-align:left;border:1px solid #e2e8f0;background:#fff;border-radius:11px;padding:8px}.interior-material-card.active{border-color:#f59e0b;background:#fffbeb}.interior-material-card.locked{opacity:.45;cursor:not-allowed}.interior-material-icon{width:32px;height:32px;border-radius:8px;background:#f1f5f9;display:grid;place-items:center;color:#475569}.interior-material-card.active .interior-material-icon{background:#f59e0b;color:#0f172a}.interior-material-copy{display:flex;flex-direction:column}.interior-material-copy strong{font-size:10px;color:#0f172a}.interior-material-copy small{font-size:8px;color:#94a3b8}.interior-material-check{font-size:12px;color:#cbd5e1}.interior-material-card.active .interior-material-check{color:#f59e0b}.interior-faces-row{margin-top:10px;padding-top:9px;border-top:1px dashed #e2e8f0}.interior-faces-head{display:flex;justify-content:space-between;margin-bottom:6px}.interior-faces-head span{font-size:9px;text-transform:uppercase;color:#64748b;font-weight:900}.interior-faces-head small{font-size:8px;color:#94a3b8}.dependency-note{display:flex;gap:5px;align-items:center;margin-bottom:7px;padding:6px 7px;border-radius:8px;background:#fff7ed;color:#9a3412;font-size:8px;font-weight:800}.interior-face-buttons{display:grid;grid-template-columns:repeat(5,1fr);gap:5px}.layer-face{border:1px solid #e2e8f0;border-radius:9px;background:#fff;padding:6px 2px;display:flex;flex-direction:column;align-items:center}.layer-face strong{font-size:11px;color:#64748b}.layer-face span{font-size:7px;color:#94a3b8}.layer-face.active{border-color:var(--face-color);box-shadow:0 0 0 1px var(--face-color)}.layer-face.active strong{color:var(--face-color)}.layer-face.locked{opacity:.32;cursor:not-allowed}.interior-face-actions{display:flex;gap:5px;margin-top:5px}.interior-face-actions button{border:0;background:#f1f5f9;color:#64748b;border-radius:7px;padding:5px 8px;font-size:8px;font-weight:800}.interior-summary-card{background:#0f172a;color:#fff;border-radius:13px;padding:11px;margin-top:10px}.interior-summary-card>div{display:flex;gap:7px;align-items:center;color:#fbbf24;font-size:10px}.interior-summary-card p{font-size:9px;color:#cbd5e1;margin:5px 0 0}.interior-summary-card b{color:#fff}.partition-finish-row{margin-top:9px;border:1px solid #e2e8f0;border-radius:12px;padding:10px;display:flex;justify-content:space-between;gap:10px;align-items:center}.partition-finish-row>span{display:flex;gap:8px;color:#64748b}.partition-finish-row strong{display:block;font-size:10px;color:#0f172a}.partition-finish-row small{display:block;font-size:8px;color:#94a3b8}`;document.head.appendChild(style);
  }

  normalizeLayerDependencies();
  window.BAT_KUBIQUEITOR_INTERIOR_UX={version:MODEL_VERSION};
  if(typeof renderInteriorSystemUI==='function') renderInteriorSystemUI();
})();
