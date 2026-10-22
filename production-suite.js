// Production Suite for bat-kubiqueitor.
// Consolidates interior doors, constructive visualization, systems, parametric BOM,
// professional quote details and versioned local project library.

(function(){
  const SUITE_VERSION='20261022-1';
  const PROJECT_LIBRARY_KEY='bat-kubiqueitor-projects-v1';
  const COST_LABELS={
    interiorDoor:'Puerta interior (unidad)',
    interiorDoorLabor:'Mano de obra puerta interior (unidad)',
    pexMeter:'Tubería agua PEX / equivalente (m)',
    drainMeter:'Tubería desagüe PVC (m)',
    switch:'Interruptor (unidad)',
    panel:'Tablero eléctrico (unidad)',
    ceilingLight:'Luminaria interior (unidad)'
  };

  function suiteReady(){
    return typeof state!=='undefined'&&typeof DATA!=='undefined'&&typeof THREE!=='undefined'&&
      typeof rebuild3D==='function'&&typeof renderAll==='function'&&typeof ensureInteriorSystem==='function'&&
      typeof rebuildParametricPartitions==='function'&&typeof objectDimensions==='function'&&
      typeof PARTITION_ORIENTATION!=='undefined'&&typeof createParametricPartition==='function';
  }

  function ensureProductionState(){
    ensureInteriorSystem();
    if(!Array.isArray(state.interiorDoors)) state.interiorDoors=[];
    if(!state.customCosts||typeof state.customCosts!=='object') state.customCosts={};
    Object.keys(COST_LABELS).forEach(key=>{
      if(!Number.isFinite(Number(state.customCosts[key]))) state.customCosts[key]=0;
    });
    if(!state.projectMeta||typeof state.projectMeta!=='object') state.projectMeta={id:null,revision:0,title:''};
    if(!state.production||typeof state.production!=='object') state.production={};
    if(typeof state.production.showFraming!=='boolean') state.production.showFraming=false;
    if(typeof state.production.showSystems!=='boolean') state.production.showSystems=false;
    if(typeof state.production.autoPlumbing!=='boolean') state.production.autoPlumbing=true;
    if(typeof state.production.autoElectrical!=='boolean') state.production.autoElectrical=true;
    const preset=DATA.finishes[state.finish]||DATA.finishes.standard;
    if(!['vinyl','floating'].includes(state.interiorSystem.flooring)) state.interiorSystem.flooring=preset.flooring;
    if(!['gypsum','osb','pvc'].includes(state.interiorSystem.ceilingLining)) state.interiorSystem.ceilingLining=state.interiorSystem.lining;
    return state.production;
  }

  function ensureFiveStepWizard(){
    const panel=document.querySelector('.config-panel');
    if(!panel) return false;
    const chips=[...panel.querySelectorAll('.step-chip')];
    const existingInterior=panel.querySelector('.wizard-step[data-step="3"] h2')?.textContent?.includes('Terminación interior');
    if(chips.length===5&&existingInterior) return true;

    const step1=panel.querySelector('.wizard-step[data-step="1"]');
    const step2=panel.querySelector('.wizard-step[data-step="2"]');
    const old3=panel.querySelector('.wizard-step[data-step="3"]');
    const old4=panel.querySelector('.wizard-step[data-step="4"]');
    const finishList=document.getElementById('finish-list');
    if(!step1||!step2||!old3||!old4||!finishList) return false;

    const chipWrap=chips[0]?.parentElement;
    if(chipWrap){
      chipWrap.className='grid grid-cols-5 gap-1';
      chipWrap.innerHTML=`
        <button class="step-chip active border rounded-xl py-2 text-[10px] font-bold" onclick="goStep(1)">1. Uso</button>
        <button class="step-chip border rounded-xl py-2 text-[10px] font-bold text-slate-500" onclick="goStep(2)">2. Base</button>
        <button class="step-chip border rounded-xl py-2 text-[10px] font-bold text-slate-500" onclick="goStep(3)">3. Interior</button>
        <button class="step-chip border rounded-xl py-2 text-[10px] font-bold text-slate-500" onclick="goStep(4)">4. Extras</button>
        <button class="step-chip border rounded-xl py-2 text-[10px] font-bold text-slate-500" onclick="goStep(5)">5. Cotizar</button>`;
    }

    const baseDesc=step2.querySelector('p');
    if(baseDesc) baseDesc.textContent='Elige el tamaño del módulo y su color exterior.';
    const finishLabel=[...step2.querySelectorAll('label')].find(el=>(el.textContent||'').includes('Terminación interior'));
    const baseActions=[...step2.querySelectorAll('div.flex')].find(el=>el.classList.contains('mt-5'));
    if(baseActions) baseActions.innerHTML=`<button onclick="goStep(1)" class="w-1/3 bg-slate-100 py-3 rounded-xl font-bold text-sm">Atrás</button><button onclick="goStep(3)" class="flex-1 bg-slate-950 text-white py-3 rounded-xl font-bold text-sm">Definir interior</button>`;

    const interior=document.createElement('section');
    interior.dataset.step='3';
    interior.className='wizard-step hidden';
    interior.innerHTML=`
      <div class="text-[11px] font-black uppercase tracking-widest text-amber-600">Paso 3</div>
      <h2 class="text-xl font-black mt-1">Terminación interior</h2>
      <p class="text-sm text-slate-500 mt-1 mb-4">Define el sistema constructivo de las caras A–F antes de agregar equipamiento.</p>
      <div id="production-interior-content"></div>
      <div class="flex gap-2 mt-5"><button onclick="goStep(2)" class="w-1/3 bg-slate-100 py-3 rounded-xl font-bold text-sm">Atrás</button><button onclick="goStep(4)" class="flex-1 bg-slate-950 text-white py-3 rounded-xl font-bold text-sm">Agregar extras</button></div>`;
    old3.parentElement.insertBefore(interior,old3);
    const content=interior.querySelector('#production-interior-content');
    if(finishLabel){ finishLabel.textContent='Nivel de terminación'; finishLabel.className='block text-xs font-bold text-slate-600 mb-2'; content.appendChild(finishLabel); }
    content.appendChild(finishList);
    if(typeof renderInteriorSystemUI==='function') renderInteriorSystemUI();
    const config=document.getElementById('interior-system-config');
    if(config) content.appendChild(config);

    old3.dataset.step='4';
    const e3=old3.querySelector('.text-amber-600'); if(e3) e3.textContent='Paso 4';
    const d3=old3.querySelector('p'); if(d3) d3.textContent='Agrega puertas, ventanas, divisiones, climatización y equipamiento.';
    const a3=[...old3.querySelectorAll('div.flex')].find(el=>el.classList.contains('mt-5'));
    if(a3) a3.innerHTML=`<button onclick="goStep(3)" class="w-1/3 bg-slate-100 py-3 rounded-xl font-bold text-sm">Atrás</button><button onclick="goStep(5)" class="flex-1 bg-amber-500 text-slate-950 py-3 rounded-xl font-black text-sm">Cotizar</button>`;

    old4.dataset.step='5';
    const e4=old4.querySelector('.text-amber-600'); if(e4) e4.textContent='Paso 5';
    const back=[...old4.querySelectorAll('button')].find(b=>(b.textContent||'').includes('Volver a editar')); if(back) back.setAttribute('onclick','goStep(4)');
    const summaryQuote=[...document.querySelectorAll('.summary-panel button')].find(b=>(b.textContent||'').includes('Cotizar este diseño')); if(summaryQuote) summaryQuote.setAttribute('onclick','goStep(5)');

    goStep=function(step){
      state.step=clamp(Number(step)||1,1,5);
      document.querySelectorAll('.wizard-step').forEach(el=>el.classList.toggle('hidden',Number(el.dataset.step)!==state.step));
      document.querySelectorAll('.step-chip').forEach((el,idx)=>{
        const active=idx+1===state.step;
        el.classList.toggle('active',active);
        el.classList.toggle('text-slate-500',!active);
      });
      if(state.step===3&&typeof renderInteriorSystemUI==='function'){
        renderInteriorSystemUI();
        const target=document.getElementById('production-interior-content');
        const cfg=document.getElementById('interior-system-config');
        if(target&&cfg&&cfg.parentElement!==target) target.appendChild(cfg);
      }
      if(window.innerWidth<821) document.querySelector('.config-panel')?.scrollIntoView({behavior:'smooth',block:'start'});
    };
    goStep(Math.min(state.step||1,5));
    return true;
  }

  function interiorDoor(index){
    ensureProductionState();
    return state.interiorDoors[index]||null;
  }

  function normalizedDoor(index){
    const d=objectDimensions('partition',index);
    const stored=interiorDoor(index);
    if(!stored) return null;
    const maxWidth=Math.max(.60,d.length-.16);
    const width=clamp(Number(stored.width)||.82,.60,Math.min(1.20,maxWidth));
    const height=clamp(Number(stored.height)||2.05,1.70,Math.max(1.70,d.height-.04));
    const limit=Math.max(0,d.length/2-width/2-.06);
    const offset=clamp(Number(stored.offset)||0,-limit,limit);
    return {width,height,offset};
  }

  window.addInteriorDoorToSelectedPartition=function(){
    if(!selectedEditable||selectedEditable.type!=='partition') return toast('Selecciona un tabique interior');
    const index=selectedEditable.index,d=objectDimensions('partition',index);
    if(d.length<.78||d.height<1.78) return toast('El tabique es demasiado pequeño para una puerta');
    pushHistory(); ensureProductionState();
    state.interiorDoors[index]={width:Math.min(.82,d.length-.16),height:Math.min(2.05,d.height-.04),offset:0};
    renderAll(); toast('Puerta interior agregada al tabique');
  };

  window.removeInteriorDoorFromSelectedPartition=function(){
    if(!selectedEditable||selectedEditable.type!=='partition') return;
    pushHistory(); state.interiorDoors[selectedEditable.index]=null; renderAll(); toast('Puerta interior eliminada');
  };

  window.updateInteriorDoor=function(key,value){
    if(!selectedEditable||selectedEditable.type!=='partition') return;
    const index=selectedEditable.index,current=normalizedDoor(index); if(!current) return;
    const parsed=Number(value); if(!Number.isFinite(parsed)) return;
    pushHistory();
    const next={...current,[key]:parsed};
    state.interiorDoors[index]=next;
    const safe=normalizedDoor(index); state.interiorDoors[index]=safe;
    renderAll();
  };

  function createPartitionWithOpening(index,d){
    const door=normalizedDoor(index);
    if(!door) return createParametricPartition(d.length,d.height,d.thickness);
    const g=new THREE.Group();
    const wall=(typeof interiorSystemMaterial==='function')?interiorSystemMaterial():mat(0xeeeae2,{roughness:.72});
    const trim=mat(0xcbd5e1,{roughness:.42,metalness:.2});
    const leaf=mat(0x8b6f47,{roughness:.62,metalness:.02});
    const start=-d.length/2,end=d.length/2;
    const openingStart=door.offset-door.width/2,openingEnd=door.offset+door.width/2;
    const leftLen=Math.max(0,openingStart-start),rightLen=Math.max(0,end-openingEnd);
    if(leftLen>.015) g.add(box(d.thickness,d.height,leftLen,wall,0,d.height/2,start+leftLen/2));
    if(rightLen>.015) g.add(box(d.thickness,d.height,rightLen,wall,0,d.height/2,openingEnd+rightLen/2));
    const headerH=Math.max(.02,d.height-door.height);
    if(headerH>.015) g.add(box(d.thickness,headerH,door.width,wall,0,door.height+headerH/2,door.offset));
    const jamb=.035;
    g.add(box(d.thickness+.02,door.height,jamb,trim,0,door.height/2,openingStart));
    g.add(box(d.thickness+.02,door.height,jamb,trim,0,door.height/2,openingEnd));
    g.add(box(d.thickness+.02,jamb,door.width+jamb*2,trim,0,door.height,door.offset));
    g.add(box(.035,door.height-.045,door.width-.06,leaf,d.thickness/2+.027,(door.height-.045)/2,door.offset));
    const handle=mat(0x475569,{roughness:.25,metalness:.7});
    g.add(sphere(.025,handle,14,10));
    const knob=g.children[g.children.length-1]; knob.position.set(d.thickness/2+.06,door.height*.52,door.offset+door.width*.32);
    g.userData.interiorDoor=true;
    return g;
  }

  const rebuildParametricPartitionsBeforeProduction=rebuildParametricPartitions;
  rebuildParametricPartitions=function(){
    if(!containerGroup) return;
    ensureLayoutState(); ensureDimensionState(); ensureProductionState();
    if(typeof normalizeAllPartitionsInsideContainer==='function') normalizeAllPartitionsInsideContainer();
    const old=editableObjects.filter(root=>root.userData.editor?.type==='partition');
    old.forEach(root=>typeof disposePartitionRoot==='function'?disposePartitionRoot(root):containerGroup.remove(root));
    editableObjects=editableObjects.filter(root=>root.userData.editor?.type!=='partition');
    for(let i=0;i<(state.counts.partition||0);i++){
      const p=actualLayout('partition',i),d=objectDimensions('partition',i),layout=state.layout.partition[i]||{};
      const axisCenter=Number.isFinite(layout.axisCenter)?layout.axisCenter:0;
      const obj=createPartitionWithOpening(i,d),y=.08+(d.elevation||0);
      if(p.orientation===PARTITION_ORIENTATION.LONG){
        addGroup(containerGroup,obj,axisCenter,y,p.z,Math.PI/2);
        registerEditable(obj,'partition',i,{axis:'z',surface:'floor',orientation:p.orientation});
      }else{
        addGroup(containerGroup,obj,p.x,y,axisCenter,0);
        registerEditable(obj,'partition',i,{axis:'x',surface:'floor',orientation:p.orientation});
      }
    }
    if(selectedEditable?.type==='partition'){
      const root=editableObjects.find(o=>o.userData.editor?.type==='partition'&&o.userData.editor?.index===selectedEditable.index);
      if(root){ addSelectionOutline(root); showEditorPanel(root); }
    }
  };

  function renderPartitionDoorEditor(index){
    const panel=document.getElementById('object-editor'); if(!panel) return;
    let root=document.getElementById('partition-door-editor');
    if(!root){ root=document.createElement('div'); root.id='partition-door-editor'; root.className='mt-3 rounded-xl border border-white/10 bg-white/5 p-3'; panel.appendChild(root); }
    const door=normalizedDoor(index);
    if(!door){
      root.innerHTML=`<div class="text-[10px] font-black tracking-widest text-amber-400">PUERTA INTERIOR</div><button type="button" onclick="addInteriorDoorToSelectedPartition()" class="mt-2 w-full rounded-lg bg-amber-500 text-slate-950 py-2 text-xs font-black"><i class="fa-solid fa-door-open mr-1"></i> Agregar puerta al tabique</button>`;
      return;
    }
    root.innerHTML=`
      <div class="flex items-center justify-between"><div class="text-[10px] font-black tracking-widest text-amber-400">PUERTA INTERIOR</div><button onclick="removeInteriorDoorFromSelectedPartition()" class="text-[10px] text-red-300">Eliminar</button></div>
      <div class="grid grid-cols-3 gap-2 mt-2">
        <label class="text-[9px] text-slate-400">Ancho<input type="number" min=".60" max="1.20" step=".05" value="${door.width.toFixed(2)}" onchange="updateInteriorDoor('width',this.value)" class="mt-1 w-full rounded-lg bg-slate-900 border border-white/10 px-2 py-1.5 text-white text-xs"></label>
        <label class="text-[9px] text-slate-400">Alto<input type="number" min="1.70" max="2.40" step=".05" value="${door.height.toFixed(2)}" onchange="updateInteriorDoor('height',this.value)" class="mt-1 w-full rounded-lg bg-slate-900 border border-white/10 px-2 py-1.5 text-white text-xs"></label>
        <label class="text-[9px] text-slate-400">Posición<input type="number" step=".05" value="${door.offset.toFixed(2)}" onchange="updateInteriorDoor('offset',this.value)" class="mt-1 w-full rounded-lg bg-slate-900 border border-white/10 px-2 py-1.5 text-white text-xs"></label>
      </div>`;
  }

  const showEditorPanelBeforeProduction=showEditorPanel;
  showEditorPanel=function(root){
    showEditorPanelBeforeProduction(root);
    const editor=document.getElementById('partition-door-editor');
    if(root?.userData.editor?.type==='partition') renderPartitionDoorEditor(root.userData.editor.index);
    else editor?.remove();
  };

  const deleteSelectedObjectBeforeProduction=deleteSelectedObject;
  deleteSelectedObject=function(){
    if(selectedEditable?.type==='partition'){
      ensureProductionState();
      state.interiorDoors.splice(selectedEditable.index,1);
    }
    return deleteSelectedObjectBeforeProduction();
  };

  function floorMaterialForProduction(){
    ensureProductionState();
    const key=state.interiorSystem.flooring;
    const canvas=document.createElement('canvas'); canvas.width=canvas.height=256; const ctx=canvas.getContext('2d');
    if(key==='floating'){
      ctx.fillStyle='#b98c62'; ctx.fillRect(0,0,256,256);
      ctx.strokeStyle='rgba(80,45,25,.28)'; ctx.lineWidth=3;
      for(let y=0;y<256;y+=42){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(256,y); ctx.stroke(); }
      for(let y=0;y<256;y+=84){ for(let x=(y/84)%2?64:0;x<256;x+=128){ ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x,y+42); ctx.stroke(); } }
    }else{
      ctx.fillStyle='#dbe3e8'; ctx.fillRect(0,0,256,256);
      ctx.strokeStyle='rgba(100,116,139,.18)'; ctx.lineWidth=2;
      for(let x=0;x<=256;x+=64){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,256);ctx.stroke();}
      for(let y=0;y<=256;y+=64){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(256,y);ctx.stroke();}
    }
    const texture=new THREE.CanvasTexture(canvas); texture.wrapS=texture.wrapT=THREE.RepeatWrapping; texture.repeat.set(5,2);
    return new THREE.MeshStandardMaterial({map:texture,roughness:.72,metalness:.01});
  }

  createFloorMaterial=function(){ return floorMaterialForProduction(); };

  window.selectInteriorFlooring=function(key){
    if(!['vinyl','floating'].includes(key)) return;
    pushHistory(); ensureProductionState(); state.interiorSystem.flooring=key; renderAll();
  };
  window.selectCeilingLining=function(key){
    if(!['gypsum','osb','pvc'].includes(key)) return;
    pushHistory(); ensureProductionState(); state.interiorSystem.ceilingLining=key; renderAll();
  };
  window.toggleConstructionView=function(){
    ensureProductionState(); state.production.showFraming=!state.production.showFraming; rebuild3D(); updateProductionToolbar();
  };
  window.toggleSystemsView=function(){
    ensureProductionState(); state.production.showSystems=!state.production.showSystems; rebuild3D(); updateProductionToolbar();
  };

  function renderProductionInteriorExtensions(){
    ensureProductionState();
    const root=document.getElementById('interior-system-config'); if(!root) return;
    let ext=document.getElementById('production-interior-extension');
    if(!ext){ ext=document.createElement('div'); ext.id='production-interior-extension'; ext.className='mt-3 pt-3 border-t border-slate-200'; root.appendChild(ext); }
    const s=state.interiorSystem;
    ext.innerHTML=`
      <div class="text-[10px] font-black text-slate-500 mb-2">Piso · cara F</div>
      <div class="grid grid-cols-2 gap-1.5">
        <button onclick="selectInteriorFlooring('vinyl')" class="interior-mini-choice ${s.flooring==='vinyl'?'active':''}">Vinílico</button>
        <button onclick="selectInteriorFlooring('floating')" class="interior-mini-choice ${s.flooring==='floating'?'active':''}">Flotante</button>
      </div>
      <div class="text-[10px] font-black text-slate-500 mt-3 mb-2">Cielo · cara E</div>
      <div class="grid grid-cols-3 gap-1.5">
        ${['gypsum','osb','pvc'].map(key=>`<button onclick="selectCeilingLining('${key}')" class="interior-mini-choice ${s.ceilingLining===key?'active':''}">${INTERIOR_SYSTEMS.lining[key].name}</button>`).join('')}
      </div>
      <button onclick="toggleConstructionView()" class="mt-3 w-full rounded-xl border border-slate-300 bg-white py-2 text-[10px] font-black text-slate-700"><i class="fa-solid fa-screwdriver-wrench mr-1"></i> ${state.production.showFraming?'Ocultar estructura Metalcon':'Ver estructura Metalcon'}</button>`;
  }

  const renderInteriorSystemUIBeforeProduction=renderInteriorSystemUI;
  renderInteriorSystemUI=function(){ renderInteriorSystemUIBeforeProduction(); renderProductionInteriorExtensions(); };

  function addConstructiveFramingVisuals(){
    ensureProductionState(); if(!state.production.showFraming||!containerGroup) return;
    const existing=containerGroup.getObjectByName('interior-cladding-system'); if(existing) existing.visible=false;
    const c=DATA.containers[state.container],faces=selectedInteriorFaces();
    const g=new THREE.Group(); g.name='production-framing';
    const steel=mat(0x94a3b8,{roughness:.28,metalness:.75});
    const H=c.height-.24,L=c.length-.24,W=c.width-.24;
    function longWall(z){
      for(let x=-L/2;x<=L/2+.01;x+=.60) g.add(box(.045,H,.045,steel,x,H/2+.08,z));
      g.add(box(L,.045,.045,steel,0,.11,z)); g.add(box(L,.045,.045,steel,0,c.height-.11,z));
    }
    function endWall(x){
      for(let z=-W/2;z<=W/2+.01;z+=.60) g.add(box(.045,H,.045,steel,x,H/2+.08,z));
      g.add(box(.045,.045,W,steel,x,.11,0)); g.add(box(.045,.045,W,steel,x,c.height-.11,0));
    }
    if(faces.includes('A')) longWall(c.width/2-.13);
    if(faces.includes('B')) longWall(-c.width/2+.13);
    if(faces.includes('C')) endWall(c.length/2-.13);
    if(faces.includes('D')) endWall(-c.length/2+.13);
    if(faces.includes('E')) for(let x=-L/2;x<=L/2+.01;x+=.60) g.add(box(.045,.045,W,steel,x,c.height-.13,0));
    if(faces.includes('F')) for(let x=-L/2;x<=L/2+.01;x+=.60) g.add(box(.045,.045,W,steel,x,.13,0));
    containerGroup.add(g);
  }

  function plumbingMetrics(){
    const c=DATA.containers[state.container],mainZ=-c.width/2+.22;
    let branch=0;
    for(const type of ['wc','sink','shower']) for(let i=0;i<(state.counts[type]||0);i++){
      const p=actualLayout(type,i); branch+=Math.abs((p.z||0)-mainZ)+.35;
    }
    const wet=(state.counts.wc||0)+(state.counts.sink||0)+(state.counts.shower||0);
    const hot=(state.counts.sink||0)+(state.counts.shower||0);
    return {
      coldPoints:wet,hotPoints:hot,drains:wet,
      coldMeters:wet?c.length+branch:0,
      hotMeters:hot?c.length+branch*.65:0,
      drainMeters:wet?c.length+branch:0
    };
  }

  function electricalMetrics(){
    const points=state.counts.electrical||0;
    const lights=Math.max(1,Math.ceil(points/3));
    return {points,lights,switches:Math.max(1,Math.ceil(lights/2)),panel:points>0?1:0};
  }

  function addSystemsVisuals(){
    ensureProductionState(); if(!state.production.showSystems||!containerGroup) return;
    const c=DATA.containers[state.container],g=new THREE.Group(); g.name='production-systems';
    const blue=mat(0x2563eb,{roughness:.35,metalness:.15}),red=mat(0xdc2626,{roughness:.35,metalness:.15}),gray=mat(0x64748b,{roughness:.55}),yellow=mat(0xf59e0b,{roughness:.45});
    const pm=plumbingMetrics();
    if(pm.coldPoints){
      const z=-c.width/2+.22; g.add(box(c.length-.35,.028,.028,blue,0,.20,z)); g.add(box(c.length-.35,.05,.05,gray,0,.11,z+.08));
      if(pm.hotPoints) g.add(box(c.length-.35,.028,.028,red,0,.25,z+.05));
      for(const type of ['wc','sink','shower']) for(let i=0;i<(state.counts[type]||0);i++){
        const p=actualLayout(type,i),dz=(p.z||0)-z,mid=z+dz/2;
        g.add(box(.025,.025,Math.max(.03,Math.abs(dz)),blue,p.x,.20,mid));
        g.add(box(.045,.045,Math.max(.03,Math.abs(dz)),gray,p.x,.11,mid+.08));
        if(type!=='wc') g.add(box(.025,.025,Math.max(.03,Math.abs(dz)),red,p.x,.25,mid+.05));
      }
    }
    const em=electricalMetrics();
    if(em.points){
      const z=c.width/2-.18; g.add(box(c.length-.35,.025,.025,yellow,0,c.height-.24,z));
      g.add(box(.12,.48,.36,mat(0x334155,{roughness:.35,metalness:.55}),-c.length/2+.25,c.height*.56,z-.02));
    }
    containerGroup.add(g);
  }

  const rebuild3DBeforeProduction=rebuild3D;
  rebuild3D=function(){ rebuild3DBeforeProduction(); addConstructiveFramingVisuals(); addSystemsVisuals(); };

  function internalDoorOpeningArea(){
    let area=0;
    for(let i=0;i<(state.counts.partition||0);i++){
      const door=normalizedDoor(i); if(!door) continue;
      const d=objectDimensions('partition',i); area+=door.width*Math.min(door.height,d.height);
    }
    return area;
  }

  function productionItem(key,name,qty,unit,unitCost,category,pending=false){
    return {key,name,qty:Number(qty)||0,unit,unitCost:Number(unitCost)||0,category,pendingCost:pending&&(Number(unitCost)||0)<=0};
  }

  function aggregateItems(items){
    const map=new Map();
    items.filter(i=>i.qty>0).forEach(item=>{
      const id=`${item.key}|${item.name}|${item.unitCost}|${item.category}`;
      if(map.has(id)) map.get(id).qty+=item.qty; else map.set(id,{...item});
    });
    return [...map.values()].map(i=>({...i,qty:Math.ceil(i.qty*100)/100,subtotal:i.qty*i.unitCost}));
  }

  const buildBOMBeforeProduction=buildBOM;
  buildBOM=function(){
    ensureProductionState();
    const s=state.interiorSystem,c=DATA.containers[state.container],faces=selectedInteriorFaces(),wallFaces=faces.filter(f=>'ABCD'.includes(f));
    const wallLiningKey=s.lining,ceilingKey=s.ceilingLining,floorKey=s.flooring,insKey=s.insulation;
    const wallGross=selectedWallArea(c,wallFaces);
    const wallOpen=actualOpeningAreaForFaces('window',wallFaces)+actualOpeningAreaForFaces('door',wallFaces);
    const wallNet=Math.max(0,wallGross-wallOpen);
    const pm=actualPartitionMetrics();
    const partitionDoorArea=internalDoorOpeningArea();
    const partitionOneSideNet=Math.max(0,pm.oneSideArea-partitionDoorArea);
    const wallLiningArea=wallNet+(s.partitions?partitionOneSideNet*2:0);
    const ceilingArea=faces.includes('E')?c.length*c.width:0;
    const floorArea=faces.includes('F')?c.length*c.width:0;
    const insulationArea=wallNet+ceilingArea+floorArea+(s.partitions?partitionOneSideNet:0);
    const waste=1.10;
    const items=[];
    items.push(productionItem('structure',`Estructura contenedor ${c.short}`,1,'unidad',c.baseCost,'Estructura'));
    if(wallLiningArea>0){ const cat=DATA.catalog[wallLiningKey]; items.push(productionItem(wallLiningKey,cat.name,Math.ceil(wallLiningArea*waste/cat.coverage),cat.unit,cat.cost,'Revestimientos')); }
    if(ceilingArea>0){ const cat=DATA.catalog[ceilingKey]; items.push(productionItem(ceilingKey,`${cat.name} · cielo`,Math.ceil(ceilingArea*waste/cat.coverage),cat.unit,cat.cost,'Revestimientos')); }
    if(insulationArea>0){ const cat=DATA.catalog[insKey]; items.push(productionItem(insKey,cat.name,Math.ceil(insulationArea*waste/cat.coverage),cat.unit,cat.cost,'Aislación')); }
    if(floorArea>0){ const cat=DATA.catalog[floorKey]; items.push(productionItem(floorKey,cat.name,Math.ceil(floorArea*waste/cat.coverage),cat.unit,cat.cost,'Piso')); }

    const doorFrameExtra=state.interiorDoors.reduce((sum,d,i)=>{ const n=d&&normalizedDoor(i); return sum+(n?(n.height*2+n.width):0); },0);
    const studLinear=selectedWallFrameLinearMeters(c,faces)+(Math.ceil(pm.totalLength/.60)+(state.counts.partition||0))*c.height+doorFrameExtra;
    const trackLinear=selectedTrackLinearMeters(c,faces)+pm.totalLength*2+doorFrameExtra*.35;
    const studs=Math.ceil(studLinear/3),tracks=Math.ceil(trackLinear/3);
    if(studs) items.push(productionItem('stud',DATA.catalog.stud.name,studs,DATA.catalog.stud.unit,DATA.catalog.stud.cost,'Perfilería'));
    if(tracks) items.push(productionItem('track',DATA.catalog.track.name,tracks,DATA.catalog.track.unit,DATA.catalog.track.cost,'Perfilería'));
    const liningSheets=items.filter(i=>['gypsum','osb','pvc'].includes(i.key)).reduce((a,i)=>a+i.qty,0);
    const screwBoxes=Math.max(1,Math.ceil((liningSheets+studs+tracks)/20));
    items.push(productionItem('screws',DATA.catalog.screws.name,screwBoxes,DATA.catalog.screws.unit,DATA.catalog.screws.cost,'Fijaciones'));
    const exteriorArea=2*(c.length*c.height)+2*(c.width*c.height)+c.length*c.width;
    const paintQty=Math.max(1,Math.ceil((exteriorArea*2)/DATA.catalog.paint.coverage));
    items.push(productionItem('paint',DATA.catalog.paint.name,paintQty,DATA.catalog.paint.unit,DATA.catalog.paint.cost,'Exterior'));

    ['window','door','wc','sink','shower','ac','electrical'].forEach(key=>{
      const qty=state.counts[key]||0;if(!qty) return; const cat=DATA.catalog[key];
      const category=['wc','sink','shower'].includes(key)?'Sanitario':key==='electrical'?'Electricidad':key==='ac'?'Climatización':'Aberturas';
      items.push(productionItem(key,cat.name,qty,cat.unit,cat.cost,category));
    });

    const interiorDoorQty=state.interiorDoors.filter(Boolean).length;
    if(interiorDoorQty) items.push(productionItem('interiorDoor','Puerta interior para tabique',interiorDoorQty,'unidad',state.customCosts.interiorDoor,'Tabiquería',true));
    const plumbing=plumbingMetrics();
    if(plumbing.coldMeters) items.push(productionItem('pexCold','Tubería agua fría',Math.ceil(plumbing.coldMeters*10)/10,'m',state.customCosts.pexMeter,'Sanitario',true));
    if(plumbing.hotMeters) items.push(productionItem('pexHot','Tubería agua caliente',Math.ceil(plumbing.hotMeters*10)/10,'m',state.customCosts.pexMeter,'Sanitario',true));
    if(plumbing.drainMeters) items.push(productionItem('drainPipe','Tubería desagüe PVC',Math.ceil(plumbing.drainMeters*10)/10,'m',state.customCosts.drainMeter,'Sanitario',true));
    const electrical=electricalMetrics();
    if(electrical.switches) items.push(productionItem('switch','Interruptor',electrical.switches,'unidad',state.customCosts.switch,'Electricidad',true));
    if(electrical.panel) items.push(productionItem('panel','Tablero eléctrico',electrical.panel,'unidad',state.customCosts.panel,'Electricidad',true));
    if(electrical.lights) items.push(productionItem('ceilingLight','Luminaria interior',electrical.lights,'unidad',state.customCosts.ceilingLight,'Electricidad',true));
    return aggregateItems(items);
  };

  calculate=function(){
    ensureProductionState();
    const bom=buildBOM(),materials=bom.reduce((sum,item)=>sum+item.subtotal,0);
    const baseLabor=state.container==='40hc'?DATA.labor.base40:DATA.labor.base20;
    const labor=baseLabor+Object.entries(state.counts).reduce((sum,[key,qty])=>sum+((DATA.labor[key]||0)*qty),0)+(state.interiorDoors.filter(Boolean).length*(Number(state.customCosts.interiorDoorLabor)||0));
    const direct=materials+labor+(Number(state.transport)||0),net=direct*(1+(Number(state.margin)||0)/100),taxAmount=net*((Number(state.tax)||0)/100),total=net+taxAmount;
    return {bom,materials,labor,direct,net,taxAmount,total};
  };

  function budgetByCategory(){
    const t=calculate(),cats={};
    t.bom.forEach(item=>{cats[item.category||'Otros']=(cats[item.category||'Otros']||0)+item.subtotal;});
    return {t,cats,pending:t.bom.filter(i=>i.pendingCost)};
  }

  window.updateCustomCost=function(key,value){
    if(!(key in COST_LABELS)) return; const n=Math.max(0,Number(value)||0); state.customCosts[key]=n; renderAll();
  };

  function renderProfessionalBudget(){
    const modal=document.getElementById('company-modal'); if(!modal) return;
    ensureProductionState(); const {t,cats,pending}=budgetByCategory();
    let root=document.getElementById('production-budget-panel');
    if(!root){ root=document.createElement('div'); root.id='production-budget-panel'; root.className='mb-5'; const table=modal.querySelector('.overflow-x-auto'); table?.insertAdjacentElement('beforebegin',root); }
    root.innerHTML=`
      <div class="grid md:grid-cols-3 gap-3 mb-4">
        <div class="rounded-xl border bg-white p-3"><div class="text-[10px] font-black text-slate-400 uppercase">Materiales por especialidad</div>${Object.entries(cats).map(([k,v])=>`<div class="flex justify-between text-[11px] mt-1"><span>${k}</span><strong>${money(v)}</strong></div>`).join('')}</div>
        <div class="rounded-xl border bg-white p-3"><div class="text-[10px] font-black text-slate-400 uppercase">Composición de venta</div><div class="flex justify-between text-[11px] mt-1"><span>Costo directo</span><strong>${money(t.direct)}</strong></div><div class="flex justify-between text-[11px] mt-1"><span>Margen</span><strong>${money(t.net-t.direct)}</strong></div><div class="flex justify-between text-[11px] mt-1"><span>IVA</span><strong>${money(t.taxAmount)}</strong></div></div>
        <div class="rounded-xl border ${pending.length?'border-amber-300 bg-amber-50':'border-emerald-200 bg-emerald-50'} p-3"><div class="text-[10px] font-black uppercase ${pending.length?'text-amber-700':'text-emerald-700'}">${pending.length?'Costos por completar':'Costos completos'}</div><div class="text-[11px] mt-1">${pending.length?`${pending.length} ítems todavía están en $0 y no se inventaron precios.`:'Todos los ítems técnicos tienen precio.'}</div></div>
      </div>
      <div class="rounded-xl border p-3 bg-slate-50"><div class="text-[10px] font-black uppercase text-slate-500 mb-2">Precios técnicos editables</div><div class="grid md:grid-cols-2 gap-2">${Object.entries(COST_LABELS).map(([key,label])=>`<label class="text-[10px] font-bold text-slate-600">${label}<input type="number" min="0" step="100" value="${Number(state.customCosts[key])||0}" onchange="updateCustomCost('${key}',this.value)" class="mt-1 w-full rounded-lg border bg-white px-2 py-2 text-xs"></label>`).join('')}</div></div>`;
  }

  if(typeof renderCompanyMode==='function'){
    const renderCompanyModeBeforeProduction=renderCompanyMode;
    renderCompanyMode=function(){ renderCompanyModeBeforeProduction(); renderProfessionalBudget(); };
  }

  function renderSystemsConfig(){
    ensureProductionState();
    const extras=document.getElementById('extras-list'); if(!extras) return;
    let root=document.getElementById('production-systems-config');
    if(!root){ root=document.createElement('div'); root.id='production-systems-config'; root.className='mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3'; extras.insertAdjacentElement('afterend',root); }
    const p=plumbingMetrics(),e=electricalMetrics();
    root.innerHTML=`<div class="text-[10px] font-black uppercase tracking-widest text-amber-600">Instalaciones automáticas</div><div class="grid grid-cols-2 gap-2 mt-2"><div class="rounded-xl bg-white border p-2"><div class="text-[10px] font-black">Sanitario</div><div class="text-[9px] text-slate-500 mt-1">${p.coldPoints} agua fría · ${p.hotPoints} agua caliente · ${p.drains} desagües</div></div><div class="rounded-xl bg-white border p-2"><div class="text-[10px] font-black">Eléctrico</div><div class="text-[9px] text-slate-500 mt-1">${e.points} puntos · ${e.lights} luminarias · ${e.switches} interruptores</div></div></div><button onclick="toggleSystemsView()" class="mt-2 w-full rounded-xl border bg-white py-2 text-[10px] font-black">${state.production.showSystems?'Ocultar recorridos':'Ver recorridos de instalaciones'}</button>`;
  }

  function renderQuoteTechnicalSpecs(){
    const quote=document.getElementById('quote-print'); if(!quote) return;
    ensureProductionState(); const p=plumbingMetrics(),e=electricalMetrics(),faces=selectedInteriorFaces();
    let root=document.getElementById('production-quote-specs');
    if(!root){ root=document.createElement('div'); root.id='production-quote-specs'; root.className='mt-6 rounded-xl border p-4'; const footer=quote.querySelector('.mt-7.pt-4'); quote.insertBefore(root,footer||null); }
    root.innerHTML=`<div class="text-[11px] font-black uppercase text-slate-400 mb-2">Especificación técnica</div><div class="grid md:grid-cols-2 gap-x-6 gap-y-2 text-xs"><div><strong>Sistema interior:</strong> Metalcon · caras ${faces.join(', ')||'sin seleccionar'}</div><div><strong>Muros:</strong> ${INTERIOR_SYSTEMS.lining[state.interiorSystem.lining].name}</div><div><strong>Cielo E:</strong> ${state.interiorSystem.faces.E?INTERIOR_SYSTEMS.lining[state.interiorSystem.ceilingLining].name:'Sin terminación'}</div><div><strong>Piso F:</strong> ${state.interiorSystem.faces.F?(state.interiorSystem.flooring==='vinyl'?'Vinílico':'Flotante'):'Sin terminación'}</div><div><strong>Tabiques:</strong> ${state.counts.partition||0} · puertas interiores ${state.interiorDoors.filter(Boolean).length}</div><div><strong>Sanitario:</strong> ${p.coldPoints} AF · ${p.hotPoints} AC · ${p.drains} desagües</div><div><strong>Electricidad:</strong> ${e.points} puntos · ${e.lights} luminarias</div><div><strong>Aislación:</strong> ${INTERIOR_SYSTEMS.insulation[state.interiorSystem.insulation].name}</div></div>`;
  }

  if(typeof openQuote==='function'){
    const openQuoteBeforeProduction=openQuote;
    openQuote=function(){ openQuoteBeforeProduction(); renderQuoteTechnicalSpecs(); };
  }

  function projectLibrary(){
    try{ const raw=localStorage.getItem(PROJECT_LIBRARY_KEY); const parsed=raw?JSON.parse(raw):[]; return Array.isArray(parsed)?parsed:[]; }catch(e){ return []; }
  }
  function writeProjectLibrary(items){ localStorage.setItem(PROJECT_LIBRARY_KEY,JSON.stringify(items)); }
  function projectTitle(){
    const c=state.customer||{}; return (c.company||c.name||state.projectMeta.title||DATA.solutions[state.solution]?.name||'Proyecto modular').trim();
  }
  function makeProjectId(){ return `BK-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2,5).toUpperCase()}`; }

  saveProject=function(){
    ensureProductionState();
    const library=projectLibrary();
    let id=state.projectMeta.id||makeProjectId(),entry=library.find(p=>p.id===id);
    if(!entry){ entry={id,title:projectTitle(),createdAt:new Date().toISOString(),updatedAt:null,revisions:[]}; library.unshift(entry); }
    const revision=(entry.revisions?.length||0)+1;
    state.projectMeta={...state.projectMeta,id,revision,title:projectTitle()};
    const snapshot={revision,savedAt:new Date().toISOString(),state:clone(state),view:currentView};
    entry.title=projectTitle(); entry.updatedAt=snapshot.savedAt; entry.revisions=entry.revisions||[]; entry.revisions.push(snapshot); if(entry.revisions.length>20) entry.revisions.shift();
    writeProjectLibrary(library);
    localStorage.setItem('modular-config-v3',JSON.stringify(state));
    toast(`Proyecto guardado · versión ${revision}`);
    renderProjectLibraryModal();
  };

  window.openProjectLibrary=function(){ ensureProjectLibraryModal(); renderProjectLibraryModal(); showModal('project-library-modal'); };
  window.loadLibraryProject=function(id){
    const entry=projectLibrary().find(p=>p.id===id); if(!entry?.revisions?.length) return;
    const snap=entry.revisions[entry.revisions.length-1]; state={...clone(DEFAULT_STATE),...clone(snap.state),counts:{...DEFAULT_STATE.counts,...(snap.state.counts||{})},customer:{...DEFAULT_STATE.customer,...(snap.state.customer||{})}};
    ensureProductionState(); closeModal('project-library-modal'); renderAll(); setView(snap.view||'exterior'); toast(`Proyecto abierto · versión ${snap.revision}`);
  };
  window.duplicateLibraryProject=function(id){
    const entry=projectLibrary().find(p=>p.id===id); if(!entry?.revisions?.length) return;
    const snap=entry.revisions[entry.revisions.length-1]; state=clone(snap.state); ensureProductionState(); state.projectMeta={id:null,revision:0,title:`${entry.title} copia`}; renderAll(); saveProject();
  };
  window.deleteLibraryProject=function(id){
    if(!confirm('¿Eliminar este proyecto guardado?')) return;
    writeProjectLibrary(projectLibrary().filter(p=>p.id!==id)); renderProjectLibraryModal();
  };

  function ensureProjectLibraryModal(){
    if(document.getElementById('project-library-modal')) return;
    const modal=document.createElement('div'); modal.id='project-library-modal'; modal.className='fixed inset-0 z-50 modal-backdrop hidden items-center justify-center p-4';
    modal.innerHTML=`<div class="modal-panel bg-white w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col"><div class="px-5 py-4 border-b flex items-center justify-between"><div><h3 class="font-black text-lg">Proyectos guardados</h3><p class="text-xs text-slate-500">Cada guardado crea una versión del proyecto.</p></div><button onclick="closeModal('project-library-modal')" class="w-9 h-9 rounded-full bg-slate-100"><i class="fa-solid fa-xmark"></i></button></div><div id="project-library-list" class="modal-body p-5 space-y-3"></div></div>`;
    document.body.appendChild(modal);
  }
  function renderProjectLibraryModal(){
    ensureProjectLibraryModal(); const root=document.getElementById('project-library-list'); if(!root) return; const items=projectLibrary();
    root.innerHTML=items.length?items.map(p=>`<div class="rounded-xl border p-3 flex flex-col md:flex-row md:items-center gap-3 justify-between"><div><div class="font-black text-sm">${escapeHtml(p.title)}</div><div class="text-[10px] text-slate-500">${p.id} · ${p.revisions?.length||0} versiones · ${p.updatedAt?new Date(p.updatedAt).toLocaleString('es-CL'):''}</div></div><div class="flex gap-2"><button onclick="loadLibraryProject('${p.id}')" class="px-3 py-2 rounded-lg bg-slate-950 text-white text-xs font-bold">Abrir</button><button onclick="duplicateLibraryProject('${p.id}')" class="px-3 py-2 rounded-lg bg-slate-100 text-xs font-bold">Duplicar</button><button onclick="deleteLibraryProject('${p.id}')" class="px-3 py-2 rounded-lg bg-red-50 text-red-700 text-xs font-bold">Eliminar</button></div></div>`).join(''):'<div class="text-sm text-slate-500">Todavía no hay proyectos guardados.</div>';
  }

  function installProjectButton(){
    if(document.getElementById('project-library-btn')) return;
    const save=[...document.querySelectorAll('button')].find(b=>(b.textContent||'').includes('Guardar')); if(!save) return;
    const btn=document.createElement('button'); btn.id='project-library-btn'; btn.onclick=openProjectLibrary; btn.className='hidden md:inline-flex px-3 py-2 rounded-lg bg-slate-900 text-xs font-semibold'; btn.innerHTML='<i class="fa-solid fa-folder-open text-amber-400 mr-1"></i> Proyectos';
    save.insertAdjacentElement('afterend',btn);
  }

  function installProductionToolbar(){
    const toolbar=document.querySelector('.viewer-toolbar'); if(!toolbar||document.getElementById('production-toolbar')) return;
    const wrap=document.createElement('div'); wrap.id='production-toolbar'; wrap.className='inline-flex gap-1'; wrap.innerHTML=`<button id="production-framing-btn" class="viewer-pill rounded-xl px-3 py-2 text-xs font-semibold" onclick="toggleConstructionView()"><i class="fa-solid fa-screwdriver-wrench mr-1"></i> Estructura</button><button id="production-systems-btn" class="viewer-pill rounded-xl px-3 py-2 text-xs font-semibold" onclick="toggleSystemsView()"><i class="fa-solid fa-route mr-1"></i> Instalaciones</button>`;
    const presentation=toolbar.querySelector('.presentation-trigger'); toolbar.insertBefore(wrap,presentation||null); updateProductionToolbar();
  }
  function updateProductionToolbar(){
    ensureProductionState(); document.getElementById('production-framing-btn')?.classList.toggle('interaction-active',state.production.showFraming); document.getElementById('production-systems-btn')?.classList.toggle('interaction-active',state.production.showSystems);
  }

  const renderAllBeforeProduction=renderAll;
  renderAll=function(){
    ensureProductionState(); renderAllBeforeProduction(); renderProductionInteriorExtensions(); renderSystemsConfig(); renderProfessionalBudget(); installProductionToolbar(); installProjectButton(); updateProductionToolbar();
  };

  function installStyles(){
    if(document.getElementById('production-suite-style')) return;
    const style=document.createElement('style'); style.id='production-suite-style'; style.textContent=`
      #production-interior-extension .interior-mini-choice{min-height:38px}
      #production-toolbar .interaction-active{background:#f59e0b!important;color:#0f172a!important;border-color:#f59e0b!important}
      @media(max-width:900px){#production-toolbar{display:none}}
    `; document.head.appendChild(style);
  }

  let installed=false;
  function installSuite(){
    if(installed||!suiteReady()) return false; installed=true;
    ensureProductionState(); ensureFiveStepWizard(); installStyles(); installProjectButton(); installProductionToolbar(); renderInteriorSystemUI(); renderSystemsConfig(); renderAll();
    window.BAT_KUBIQUEITOR_PRODUCTION_SUITE={version:SUITE_VERSION,installed:true};
    return true;
  }

  function boot(){
    if(installSuite()) return;
    let tries=0; const timer=setInterval(()=>{ tries++; if(installSuite()||tries>100) clearInterval(timer); },120);
  }
  if(document.readyState==='loading') window.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
})();
