// Preset modules layer: grouped sanitary layouts that move as one unit.
// Intentionally isolated from editor.js so existing single-object editing stays stable.
(function(){
  if(window.BAT_KUBIQUEITOR_MODULE_PRESETS) return;

  const PRESETS={
    full:{
      name:'Baño completo',
      icon:'fa-bath',
      desc:'WC + lavamanos + ducha',
      width:2.02,
      depth:1.12,
      fixtures:[
        {type:'wc',x:-.66,z:.08,ry:0},
        {type:'sink',x:0,z:.16,ry:Math.PI},
        {type:'shower',x:.64,z:-.02,ry:0}
      ],
      components:{wc:1,sink:1,shower:1}
    },
    half:{
      name:'Medio baño',
      icon:'fa-toilet',
      desc:'WC + lavamanos',
      width:1.38,
      depth:1.02,
      fixtures:[
        {type:'wc',x:-.34,z:.08,ry:0},
        {type:'sink',x:.34,z:.16,ry:Math.PI}
      ],
      components:{wc:1,sink:1,shower:0}
    }
  };

  const MAX_MODULES=6;
  let moduleRoots=[];
  let selectedModuleIndex=null;
  let draggingModule=null;
  let dragStartState=null;
  let dragOffset=null;
  let raycaster=null;
  let pointer=null;
  let floorPlane=null;
  let installed=false;

  function ensureModuleState(){
    if(!Array.isArray(state.bathroomModules)) state.bathroomModules=[];
  }
  function moduleCount(kind){
    ensureModuleState();
    return state.bathroomModules.filter(m=>m.kind===kind).length;
  }
  function presetFor(entry){ return PRESETS[entry?.kind]||PRESETS.half; }
  function round5(v){ return Math.round(v*20)/20; }

  function defaultModulePosition(kind){
    ensureModuleState();
    const c=DATA.containers[state.container],p=PRESETS[kind];
    const candidates=[];
    for(let x=-c.length/2+p.width/2+.18;x<=c.length/2-p.width/2-.18;x+=.25){
      candidates.push({x:round5(x),z:round5(-c.width/2+p.depth/2+.14)});
      candidates.push({x:round5(x),z:round5(c.width/2-p.depth/2-.14)});
    }
    candidates.push({x:0,z:0});
    return candidates.find(pos=>validModuleCandidate(kind,pos,null))||{x:0,z:0};
  }

  function boundsFor(kind,pos,pad=0){
    const p=PRESETS[kind];
    return {
      minX:pos.x-p.width/2-pad,maxX:pos.x+p.width/2+pad,
      minZ:pos.z-p.depth/2-pad,maxZ:pos.z+p.depth/2+pad
    };
  }
  function boxesOverlap(a,b){
    return a.minX<b.maxX&&a.maxX>b.minX&&a.minZ<b.maxZ&&a.maxZ>b.minZ;
  }
  function validModuleCandidate(kind,pos,excludeIndex){
    const c=DATA.containers[state.container],p=PRESETS[kind];
    if(pos.x-p.width/2<-c.length/2+.12||pos.x+p.width/2>c.length/2-.12) return false;
    if(pos.z-p.depth/2<-c.width/2+.10||pos.z+p.depth/2>c.width/2-.10) return false;
    const candidate=boundsFor(kind,pos,.08);
    ensureModuleState();
    for(let i=0;i<state.bathroomModules.length;i++){
      if(i===excludeIndex) continue;
      const other=state.bathroomModules[i],op={x:Number(other.x)||0,z:Number(other.z)||0};
      if(boxesOverlap(candidate,boundsFor(other.kind,op,.08))) return false;
    }
    // Keep a safety gap from independently placed sanitary fixtures.
    if(typeof actualLayout==='function'){
      for(const type of ['wc','sink','shower']){
        for(let i=0;i<(state.counts[type]||0);i++){
          const o=actualLayout(type,i);
          if(o&&o.x>=candidate.minX-.35&&o.x<=candidate.maxX+.35&&o.z>=candidate.minZ-.35&&o.z<=candidate.maxZ+.35) return false;
        }
      }
    }
    return true;
  }

  function createFixture(type){
    if(type==='wc') return createWC();
    if(type==='sink') return createSink();
    return createShower();
  }
  function createModuleGroup(entry,index){
    const p=presetFor(entry),g=new THREE.Group();
    p.fixtures.forEach(f=>{
      const obj=createFixture(f.type);
      obj.position.set(f.x,.08,f.z);
      obj.rotation.y=f.ry||0;
      g.add(obj);
    });
    // Very subtle footprint helps communicate that the set is one movable module.
    const footprint=new THREE.Mesh(
      new THREE.PlaneGeometry(p.width,p.depth),
      new THREE.MeshBasicMaterial({color:0xf59e0b,transparent:true,opacity:.055,depthWrite:false,side:THREE.DoubleSide})
    );
    footprint.rotation.x=-Math.PI/2; footprint.position.y=.012; footprint.userData.moduleFootprint=true; g.add(footprint);
    g.position.set(Number(entry.x)||0,0,Number(entry.z)||0);
    g.userData.bathroomModuleIndex=index;
    g.traverse(o=>o.userData.bathroomModuleRoot=g);
    return g;
  }

  function clearModuleSelectionHelpers(){
    moduleRoots.forEach(root=>{
      root.children.filter(c=>c.userData?.moduleSelectionHelper).forEach(h=>{
        root.remove(h); h.geometry?.dispose?.(); h.material?.dispose?.();
      });
    });
  }
  function showModuleOutline(root){
    clearModuleSelectionHelpers();
    if(!root) return;
    const idx=root.userData.bathroomModuleIndex,entry=state.bathroomModules[idx],p=presetFor(entry);
    const geo=new THREE.BoxGeometry(p.width+.08,.09,p.depth+.08),edges=new THREE.EdgesGeometry(geo);geo.dispose();
    const line=new THREE.LineSegments(edges,new THREE.LineBasicMaterial({color:0xf59e0b,depthTest:false,transparent:true,opacity:1}));
    line.position.y=.06;line.renderOrder=1001;line.userData.moduleSelectionHelper=true;root.add(line);
  }

  function updateModulePanel(){
    const panel=document.getElementById('module-editor');
    if(!panel) return;
    if(selectedModuleIndex===null||!state.bathroomModules[selectedModuleIndex]){ panel.classList.add('hidden'); return; }
    const m=state.bathroomModules[selectedModuleIndex],p=presetFor(m);
    document.getElementById('module-editor-title').textContent=p.name;
    document.getElementById('module-editor-subtitle').textContent=`X ${(Number(m.x)||0).toFixed(2)} m · Z ${(Number(m.z)||0).toFixed(2)} m`;
    panel.classList.remove('hidden');
  }
  function selectModule(index){
    selectedModuleIndex=Number.isInteger(index)?index:null;
    const root=selectedModuleIndex===null?null:moduleRoots.find(r=>r.userData.bathroomModuleIndex===selectedModuleIndex);
    showModuleOutline(root); updateModulePanel();
  }

  window.addBathroomModule=function(kind){
    if(!PRESETS[kind]) return;
    ensureModuleState();
    if(state.bathroomModules.length>=MAX_MODULES) return toast(`Máximo ${MAX_MODULES} módulos prearmados`);
    const pos=defaultModulePosition(kind);
    if(!validModuleCandidate(kind,pos,null)) return toast('No queda espacio suficiente para insertar este módulo');
    pushHistory();
    state.bathroomModules.push({kind,x:pos.x,z:pos.z});
    selectedModuleIndex=state.bathroomModules.length-1;
    renderAll();
    toast(`${PRESETS[kind].name} agregado`);
  };
  window.removeBathroomModule=function(kind){
    ensureModuleState();
    let index=-1;
    for(let i=state.bathroomModules.length-1;i>=0;i--) if(state.bathroomModules[i].kind===kind){index=i;break;}
    if(index<0) return;
    pushHistory(); state.bathroomModules.splice(index,1); selectedModuleIndex=null; renderAll();
  };
  window.deleteSelectedBathroomModule=function(){
    ensureModuleState();
    if(selectedModuleIndex===null||!state.bathroomModules[selectedModuleIndex]) return;
    const name=presetFor(state.bathroomModules[selectedModuleIndex]).name;
    pushHistory(); state.bathroomModules.splice(selectedModuleIndex,1); selectedModuleIndex=null; renderAll(); toast(`${name} eliminado`);
  };
  window.nudgeBathroomModule=function(dx,dz){
    ensureModuleState();
    if(selectedModuleIndex===null) return;
    const m=state.bathroomModules[selectedModuleIndex],candidate={x:round5((Number(m.x)||0)+dx),z:round5((Number(m.z)||0)+dz)};
    if(!validModuleCandidate(m.kind,candidate,selectedModuleIndex)) return toast('Esa posición no es válida');
    pushHistory(); m.x=candidate.x;m.z=candidate.z;renderAll();
  };

  const originalRenderExtras=renderExtras;
  renderExtras=function(){
    originalRenderExtras(); ensureModuleState();
    const root=document.getElementById('extras-list'); if(!root) return;
    const section=document.createElement('div');
    section.className='mb-4 rounded-2xl border border-amber-200 bg-amber-50/60 p-3';
    section.innerHTML=`
      <div class="flex items-start gap-2 mb-3"><div class="w-9 h-9 rounded-xl bg-amber-500 text-slate-950 grid place-items-center"><i class="fa-solid fa-object-group"></i></div><div><div class="font-black text-sm">Módulos prearmados</div><div class="text-[10px] text-slate-500 mt-0.5">Inserta un diseño completo y muévelo como una sola unidad.</div></div></div>
      ${Object.entries(PRESETS).map(([key,p])=>`<div class="bg-white border border-amber-100 rounded-xl p-3 flex items-center gap-3 mb-2 last:mb-0"><div class="w-9 h-9 rounded-xl bg-slate-100 text-slate-600 grid place-items-center"><i class="fa-solid ${p.icon}"></i></div><div class="flex-1 min-w-0"><div class="font-bold text-sm">${p.name}</div><div class="text-[10px] text-slate-400">${p.desc} · ${p.width.toFixed(2)} × ${p.depth.toFixed(2)} m</div></div><button class="counter-btn" onclick="removeBathroomModule('${key}')">−</button><div class="w-6 text-center font-black">${moduleCount(key)}</div><button class="counter-btn" onclick="addBathroomModule('${key}')">+</button></div>`).join('')}`;
    root.prepend(section);
  };

  const originalRebuild3D=rebuild3D;
  rebuild3D=function(){
    originalRebuild3D(); ensureModuleState(); moduleRoots=[];
    state.bathroomModules.forEach((entry,index)=>{
      const root=createModuleGroup(entry,index); containerGroup.add(root); moduleRoots.push(root);
    });
    if(selectedModuleIndex!==null){
      const root=moduleRoots.find(r=>r.userData.bathroomModuleIndex===selectedModuleIndex);
      if(root) showModuleOutline(root); else selectedModuleIndex=null;
    }
    updateModulePanel();
  };

  // Add preset component material costs to the existing BOM without changing individual counters.
  const originalBuildBOM=buildBOM;
  buildBOM=function(){
    const items=originalBuildBOM(); ensureModuleState();
    const totals={wc:0,sink:0,shower:0};
    state.bathroomModules.forEach(m=>{
      const comp=presetFor(m).components;
      Object.keys(totals).forEach(k=>totals[k]+=comp[k]||0);
    });
    Object.entries(totals).forEach(([key,qty])=>{
      if(!qty) return;
      const cat=DATA.catalog[key];
      items.push({key:`module-${key}`,name:`${cat.name} · módulos`,qty,unit:cat.unit,unitCost:cat.cost,subtotal:qty*cat.cost});
    });
    return items;
  };
  const originalCalculate=calculate;
  calculate=function(){
    const base=originalCalculate(); ensureModuleState();
    let moduleLabor=0;
    state.bathroomModules.forEach(m=>{
      const comp=presetFor(m).components;
      Object.entries(comp).forEach(([key,qty])=>moduleLabor+=(DATA.labor[key]||0)*qty);
    });
    if(!moduleLabor) return base;
    const labor=base.labor+moduleLabor;
    const direct=base.materials+labor+state.transport;
    const net=direct*(1+state.margin/100),taxAmount=net*(state.tax/100),total=net+taxAmount;
    return {...base,labor,direct,net,taxAmount,total};
  };

  const originalRenderSummary=renderSummary;
  renderSummary=function(){
    originalRenderSummary(); ensureModuleState();
    if(!state.bathroomModules.length) return;
    const root=document.getElementById('summary-items'); if(!root) return;
    const rows=Object.entries(PRESETS).map(([key,p])=>[p,moduleCount(key)]).filter(([,n])=>n>0).map(([p,n])=>`<div class="flex justify-between gap-3"><span class="text-slate-500"><i class="fa-solid ${p.icon} w-4 text-center mr-1 text-amber-500"></i>${p.name}</span><strong>${n}</strong></div>`).join('');
    root.insertAdjacentHTML('afterbegin',rows);
  };

  function rootFromObject(object){
    let n=object;
    while(n){ if(Number.isInteger(n.userData?.bathroomModuleIndex)) return n; if(n.userData?.bathroomModuleRoot) return n.userData.bathroomModuleRoot; n=n.parent; }
    return null;
  }
  function setPointer(event){
    const rect=renderer.domElement.getBoundingClientRect();
    pointer.x=((event.clientX-rect.left)/rect.width)*2-1;
    pointer.y=-((event.clientY-rect.top)/rect.height)*2+1;
  }
  function hitModule(event){
    if(!moduleRoots.length) return null;
    setPointer(event);raycaster.setFromCamera(pointer,camera);
    const hits=raycaster.intersectObjects(moduleRoots,true);
    return hits.length?rootFromObject(hits[0].object):null;
  }
  function onPointerDown(event){
    if(event.button!==0||isPresentation) return;
    const root=hitModule(event); if(!root) return;
    event.preventDefault(); event.stopPropagation();
    const index=root.userData.bathroomModuleIndex,entry=state.bathroomModules[index];
    selectModule(index); draggingModule=root; dragStartState=clone(state); controls.enabled=false;
    setPointer(event);raycaster.setFromCamera(pointer,camera);const point=new THREE.Vector3();floorPlane.set(new THREE.Vector3(0,1,0),0);
    if(raycaster.ray.intersectPlane(floorPlane,point)) dragOffset={x:(Number(entry.x)||0)-point.x,z:(Number(entry.z)||0)-point.z}; else dragOffset={x:0,z:0};
    renderer.domElement.setPointerCapture?.(event.pointerId);
  }
  function onPointerMove(event){
    if(!draggingModule) return;
    event.preventDefault(); setPointer(event);raycaster.setFromCamera(pointer,camera);const point=new THREE.Vector3();
    if(!raycaster.ray.intersectPlane(floorPlane,point)) return;
    const index=draggingModule.userData.bathroomModuleIndex,m=state.bathroomModules[index];
    const candidate={x:round5(point.x+dragOffset.x),z:round5(point.z+dragOffset.z)};
    if(!validModuleCandidate(m.kind,candidate,index)) return;
    m.x=candidate.x;m.z=candidate.z;draggingModule.position.x=candidate.x;draggingModule.position.z=candidate.z;updateModulePanel();
  }
  function onPointerUp(event){
    if(!draggingModule) return;
    controls.enabled=true;renderer.domElement.releasePointerCapture?.(event.pointerId);
    const changed=JSON.stringify(dragStartState?.bathroomModules||[])!==JSON.stringify(state.bathroomModules||[]);
    if(changed&&dragStartState){history.push(dragStartState);if(history.length>40)history.shift();future=[];toast('Módulo reubicado');}
    draggingModule=null;dragStartState=null;dragOffset=null;renderAll();
  }

  function installPanel(){
    if(document.getElementById('module-editor')) return;
    const viewer=document.querySelector('.viewer-wrap'); if(!viewer) return;
    const panel=document.createElement('div');panel.id='module-editor';panel.className='hidden absolute z-20 left-4 top-20 w-72 rounded-2xl border border-amber-400/30 bg-slate-950/92 text-white shadow-2xl backdrop-blur-xl p-4';
    panel.innerHTML=`<div class="flex items-start justify-between gap-3"><div><div class="text-[10px] font-black uppercase tracking-widest text-amber-400">Módulo prearmado</div><div id="module-editor-title" class="font-black text-sm mt-1">Baño</div><div id="module-editor-subtitle" class="text-[11px] text-slate-400 mt-0.5">X 0.00 m · Z 0.00 m</div></div><button onclick="selectedModuleIndex=null;document.getElementById('module-editor').classList.add('hidden');rebuild3D()" class="w-7 h-7 rounded-lg bg-white/10"><i class="fa-solid fa-xmark"></i></button></div><div class="mt-3 rounded-xl bg-white/5 border border-white/10 p-3 text-[11px] text-slate-300">Arrastra cualquier artefacto del conjunto para mover el módulo completo. Las distancias internas permanecen fijas.</div><div class="grid grid-cols-3 gap-2 mt-3"><button onclick="nudgeBathroomModule(-.05,0)" class="rounded-lg bg-white/10 py-2"><i class="fa-solid fa-arrow-left"></i></button><button onclick="nudgeBathroomModule(0,-.05)" class="rounded-lg bg-white/10 py-2"><i class="fa-solid fa-arrow-up"></i></button><button onclick="nudgeBathroomModule(.05,0)" class="rounded-lg bg-white/10 py-2"><i class="fa-solid fa-arrow-right"></i></button></div><button onclick="nudgeBathroomModule(0,.05)" class="mt-2 w-full rounded-lg bg-white/10 py-2 text-[11px]"><i class="fa-solid fa-arrow-down mr-1"></i> Frente</button><button onclick="deleteSelectedBathroomModule()" class="mt-3 w-full rounded-xl bg-red-500/15 border border-red-400/20 text-red-200 py-2 text-xs font-bold"><i class="fa-solid fa-trash mr-1"></i> Eliminar módulo</button>`;
    viewer.appendChild(panel);
  }

  function install(){
    if(installed||!renderer?.domElement) return false; installed=true;
    ensureModuleState();raycaster=new THREE.Raycaster();pointer=new THREE.Vector2();floorPlane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
    installPanel();
    const canvas=renderer.domElement;
    canvas.addEventListener('pointerdown',onPointerDown,true);
    canvas.addEventListener('pointermove',onPointerMove,true);
    canvas.addEventListener('pointerup',onPointerUp,true);
    canvas.addEventListener('pointercancel',onPointerUp,true);
    rebuild3D();
    window.BAT_KUBIQUEITOR_MODULE_PRESETS={version:1,presets:PRESETS};
    return true;
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(install,40),{once:true});
  else setTimeout(install,40);
})();
