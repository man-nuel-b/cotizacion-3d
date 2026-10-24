// Robust preset bathroom modules: grouped room + fixtures that move and rotate as one unit.
(function(){
  if(window.BAT_KUBIQUEITOR_MODULE_PRESETS) return;

  const PRESETS={
    full:{name:'Baño completo',icon:'fa-bath',desc:'WC + lavamanos + ducha',width:2.02,depth:1.12,fixtures:[{type:'wc',x:-.66,z:.08,ry:0},{type:'sink',x:0,z:.16,ry:Math.PI},{type:'shower',x:.64,z:-.02,ry:0}],components:{wc:1,sink:1,shower:1}},
    half:{name:'Medio baño',icon:'fa-toilet',desc:'WC + lavamanos',width:1.38,depth:1.02,fixtures:[{type:'wc',x:-.34,z:.08,ry:0},{type:'sink',x:.34,z:.16,ry:Math.PI}],components:{wc:1,sink:1,shower:0}}
  };
  const MAX_MODULES=6;
  let moduleRoots=[],selectedModuleIndex=null,draggingModule=null,dragStartState=null,dragOffset=null,raycaster=null,pointer=null,floorPlane=null,installed=false;

  function ensureState(){
    if(!Array.isArray(state.bathroomModules)) state.bathroomModules=[];
    state.bathroomModules.forEach(m=>{if(!Number.isFinite(Number(m.rotation)))m.rotation=0;});
  }
  const presetFor=m=>PRESETS[m?.kind]||PRESETS.half;
  const round5=v=>Math.round(v*20)/20;
  function normRot(v){let r=Math.round((Number(v)||0)/90)*90%360;return r<0?r+360:r;}
  function sizeFor(kind,rotation=0){const p=PRESETS[kind],swap=normRot(rotation)%180===90;return {width:swap?p.depth:p.width,depth:swap?p.width:p.depth};}
  function boundsFor(kind,pos,pad=0,rotation=0){const d=sizeFor(kind,rotation);return {minX:pos.x-d.width/2-pad,maxX:pos.x+d.width/2+pad,minZ:pos.z-d.depth/2-pad,maxZ:pos.z+d.depth/2+pad};}
  const overlap=(a,b)=>a.minX<b.maxX&&a.maxX>b.minX&&a.minZ<b.maxZ&&a.maxZ>b.minZ;

  function valid(kind,pos,exclude=null,rotation=0){
    const c=DATA.containers[state.container],d=sizeFor(kind,rotation);
    if(pos.x-d.width/2<-c.length/2+.12||pos.x+d.width/2>c.length/2-.12)return false;
    if(pos.z-d.depth/2<-c.width/2+.10||pos.z+d.depth/2>c.width/2-.10)return false;
    const candidate=boundsFor(kind,pos,.08,rotation);ensureState();
    for(let i=0;i<state.bathroomModules.length;i++){
      if(i===exclude)continue;const o=state.bathroomModules[i];
      if(overlap(candidate,boundsFor(o.kind,{x:Number(o.x)||0,z:Number(o.z)||0},.08,o.rotation||0)))return false;
    }
    if(typeof actualLayout==='function')for(const type of ['wc','sink','shower'])for(let i=0;i<(state.counts?.[type]||0);i++){
      const o=actualLayout(type,i);if(o&&o.x>=candidate.minX-.35&&o.x<=candidate.maxX+.35&&o.z>=candidate.minZ-.35&&o.z<=candidate.maxZ+.35)return false;
    }
    return true;
  }

  function defaultPos(kind){
    ensureState();
    if(valid(kind,{x:0,z:0},null,0))return {x:0,z:0};
    const c=DATA.containers[state.container],d=sizeFor(kind,0),list=[];
    for(let x=-c.length/2+d.width/2+.18;x<=c.length/2-d.width/2-.18;x+=.25){
      list.push({x:round5(x),z:round5(-c.width/2+d.depth/2+.14)});list.push({x:round5(x),z:round5(c.width/2-d.depth/2-.14)});
    }
    return list.find(p=>valid(kind,p,null,0))||null;
  }

  function material(color,opts={}){return typeof mat==='function'?mat(color,opts):new THREE.MeshStandardMaterial({color,...opts});}
  function cube(w,h,d,m,x=0,y=0,z=0){
    if(typeof box==='function')return box(w,h,d,m,x,y,z);
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;return mesh;
  }
  function safeFixture(type){try{if(type==='wc'&&typeof createWC==='function')return createWC();if(type==='sink'&&typeof createSink==='function')return createSink();if(type==='shower'&&typeof createShower==='function')return createShower();}catch(e){console.error('fixture',type,e);}return null;}

  function addRoomShell(g,p,index){
    const wallT=.075,h=2.28,doorW=Math.min(.80,p.width-.34),doorH=2.02;
    const wall=material(0xf4f7fa,{roughness:.72,metalness:.02}),frame=material(0x94a3b8,{roughness:.28,metalness:.65}),floor=material(0xd7dce2,{roughness:.88,metalness:.01});
    const fl=cube(p.width-.06,.035,p.depth-.06,floor,0,.10,0);fl.name=`B${index+1}.P`;g.add(fl);
    g.add(cube(p.width,h,wallT,wall,0,.10+h/2,-p.depth/2+wallT/2));
    g.add(cube(wallT,h,p.depth,wall,-p.width/2+wallT/2,.10+h/2,0));
    g.add(cube(wallT,h,p.depth,wall,p.width/2-wallT/2,.10+h/2,0));
    const side=(p.width-doorW)/2;
    if(side>.03){g.add(cube(side,h,wallT,wall,-(doorW/2+side/2),.10+h/2,p.depth/2-wallT/2));g.add(cube(side,h,wallT,wall,(doorW/2+side/2),.10+h/2,p.depth/2-wallT/2));}
    if(h-doorH>.04)g.add(cube(doorW,h-doorH,wallT,wall,0,.10+doorH+(h-doorH)/2,p.depth/2-wallT/2));
    const jamb=.045;g.add(cube(jamb,doorH,.055,frame,-doorW/2,.10+doorH/2,p.depth/2+.012));g.add(cube(jamb,doorH,.055,frame,doorW/2,.10+doorH/2,p.depth/2+.012));g.add(cube(doorW+jamb*2,jamb,.055,frame,0,.10+doorH,p.depth/2+.012));
  }

  function createModuleGroup(entry,index){
    const p=presetFor(entry),g=new THREE.Group();addRoomShell(g,p,index);
    p.fixtures.forEach(f=>{const obj=safeFixture(f.type);if(!obj)return;obj.position.set(f.x,.12,f.z);obj.rotation.y=f.ry||0;g.add(obj);});
    g.position.set(Number(entry.x)||0,0,Number(entry.z)||0);g.rotation.y=THREE.MathUtils.degToRad(normRot(entry.rotation));
    g.userData.bathroomModuleIndex=index;g.userData.bathroomPresetRoot=true;g.traverse(o=>o.userData.bathroomModuleRoot=g);return g;
  }

  function sceneRoots(){return (containerGroup?.children||[]).filter(o=>o.userData?.bathroomPresetRoot);}
  function syncScene(){
    if(!containerGroup)return;ensureState();
    const existing=sceneRoots();
    existing.forEach(r=>{const i=r.userData.bathroomModuleIndex;if(i>=state.bathroomModules.length){containerGroup.remove(r);return;}const m=state.bathroomModules[i];r.position.set(Number(m.x)||0,0,Number(m.z)||0);r.rotation.y=THREE.MathUtils.degToRad(normRot(m.rotation));});
    for(let i=0;i<state.bathroomModules.length;i++)if(!sceneRoots().some(r=>r.userData.bathroomModuleIndex===i))containerGroup.add(createModuleGroup(state.bathroomModules[i],i));
    moduleRoots=sceneRoots();
  }

  function moduleCount(kind){ensureState();return state.bathroomModules.filter(m=>m.kind===kind).length;}
  window.addBathroomModule=function(kind){
    if(!PRESETS[kind])return;ensureState();if(state.bathroomModules.length>=MAX_MODULES)return toast(`Máximo ${MAX_MODULES} módulos prearmados`);
    const p=defaultPos(kind);if(!p)return toast('No queda espacio suficiente para insertar este módulo');pushHistory();state.bathroomModules.push({kind,x:p.x,z:p.z,rotation:0});selectedModuleIndex=state.bathroomModules.length-1;renderAll();setTimeout(syncScene,0);toast(`${PRESETS[kind].name} agregado`);
  };
  window.removeBathroomModule=function(kind){ensureState();let i=-1;for(let n=state.bathroomModules.length-1;n>=0;n--)if(state.bathroomModules[n].kind===kind){i=n;break;}if(i<0)return;pushHistory();state.bathroomModules.splice(i,1);selectedModuleIndex=null;renderAll();setTimeout(syncScene,0);};
  window.deleteSelectedBathroomModule=function(){if(selectedModuleIndex===null)return;ensureState();if(!state.bathroomModules[selectedModuleIndex])return;pushHistory();state.bathroomModules.splice(selectedModuleIndex,1);selectedModuleIndex=null;renderAll();setTimeout(syncScene,0);};
  window.nudgeBathroomModule=function(dx,dz){if(selectedModuleIndex===null)return;const m=state.bathroomModules[selectedModuleIndex],p={x:round5((Number(m.x)||0)+dx),z:round5((Number(m.z)||0)+dz)};if(!valid(m.kind,p,selectedModuleIndex,m.rotation||0))return toast('Esa posición no es válida');pushHistory();m.x=p.x;m.z=p.z;renderAll();setTimeout(syncScene,0);};
  window.rotateSelectedBathroomModule=function(dir=1){if(selectedModuleIndex===null)return;const m=state.bathroomModules[selectedModuleIndex],next=normRot((m.rotation||0)+(dir>=0?90:-90)),p={x:Number(m.x)||0,z:Number(m.z)||0};if(!valid(m.kind,p,selectedModuleIndex,next))return toast('No hay espacio suficiente para girar el módulo aquí');pushHistory();m.rotation=next;renderAll();setTimeout(syncScene,0);};

  const baseExtras=renderExtras;
  renderExtras=function(){baseExtras();ensureState();const root=document.getElementById('extras-list');if(!root)return;const section=document.createElement('div');section.className='mb-4 rounded-2xl border border-amber-200 bg-amber-50/60 p-3';section.innerHTML=`<div class="flex items-start gap-2 mb-3"><div class="w-9 h-9 rounded-xl bg-amber-500 text-slate-950 grid place-items-center"><i class="fa-solid fa-object-group"></i></div><div><div class="font-black text-sm">Módulos prearmados</div><div class="text-[10px] text-slate-500 mt-0.5">Recintos completos que se mueven y giran como una unidad.</div></div></div>${Object.entries(PRESETS).map(([key,p])=>`<div class="bg-white border border-amber-100 rounded-xl p-3 flex items-center gap-3 mb-2"><div class="w-9 h-9 rounded-xl bg-slate-100 text-slate-600 grid place-items-center"><i class="fa-solid ${p.icon}"></i></div><div class="flex-1 min-w-0"><div class="font-bold text-sm">${p.name}</div><div class="text-[10px] text-slate-400">${p.desc} · ${p.width.toFixed(2)} × ${p.depth.toFixed(2)} m</div></div><button class="counter-btn" onclick="removeBathroomModule('${key}')">−</button><div class="w-6 text-center font-black">${moduleCount(key)}</div><button class="counter-btn" onclick="addBathroomModule('${key}')">+</button></div>`).join('')}`;root.prepend(section);};

  const baseBOM=buildBOM;
  buildBOM=function(){const items=baseBOM();ensureState();const totals={wc:0,sink:0,shower:0};state.bathroomModules.forEach(m=>{const c=presetFor(m).components;Object.keys(totals).forEach(k=>totals[k]+=c[k]||0);});Object.entries(totals).forEach(([k,q])=>{if(!q)return;const c=DATA.catalog[k];items.push({key:`module-${k}`,name:`${c.name} · módulos`,qty:q,unit:c.unit,unitCost:c.cost,subtotal:q*c.cost});});return items;};
  const baseCalc=calculate;
  calculate=function(){const base=baseCalc();ensureState();let extra=0;state.bathroomModules.forEach(m=>Object.entries(presetFor(m).components).forEach(([k,q])=>extra+=(DATA.labor[k]||0)*q));if(!extra)return base;const labor=base.labor+extra,direct=base.materials+labor+state.transport,net=direct*(1+state.margin/100),taxAmount=net*(state.tax/100);return {...base,labor,direct,net,taxAmount,total:net+taxAmount};};

  function rootFromObject(o){let n=o;while(n){if(n.userData?.bathroomPresetRoot)return n;if(n.userData?.bathroomModuleRoot)return n.userData.bathroomModuleRoot;n=n.parent;}return null;}
  function setPointer(e){const r=renderer.domElement.getBoundingClientRect();pointer.x=((e.clientX-r.left)/r.width)*2-1;pointer.y=-((e.clientY-r.top)/r.height)*2+1;}
  function hit(e){syncScene();setPointer(e);raycaster.setFromCamera(pointer,camera);const h=raycaster.intersectObjects(moduleRoots,true);return h.length?rootFromObject(h[0].object):null;}
  function onDown(e){if(e.button!==0||isPresentation)return;const root=hit(e);if(!root)return;e.preventDefault();e.stopPropagation();const i=root.userData.bathroomModuleIndex,m=state.bathroomModules[i];selectedModuleIndex=i;draggingModule=root;dragStartState=clone(state);controls.enabled=false;setPointer(e);raycaster.setFromCamera(pointer,camera);const pt=new THREE.Vector3();floorPlane.set(new THREE.Vector3(0,1,0),0);dragOffset=raycaster.ray.intersectPlane(floorPlane,pt)?{x:(Number(m.x)||0)-pt.x,z:(Number(m.z)||0)-pt.z}:{x:0,z:0};renderer.domElement.setPointerCapture?.(e.pointerId);}
  function onMove(e){if(!draggingModule)return;e.preventDefault();setPointer(e);raycaster.setFromCamera(pointer,camera);const pt=new THREE.Vector3();if(!raycaster.ray.intersectPlane(floorPlane,pt))return;const i=draggingModule.userData.bathroomModuleIndex,m=state.bathroomModules[i],p={x:round5(pt.x+dragOffset.x),z:round5(pt.z+dragOffset.z)};if(!valid(m.kind,p,i,m.rotation||0))return;m.x=p.x;m.z=p.z;draggingModule.position.x=p.x;draggingModule.position.z=p.z;}
  function onUp(e){if(!draggingModule)return;controls.enabled=true;renderer.domElement.releasePointerCapture?.(e.pointerId);const changed=JSON.stringify(dragStartState?.bathroomModules||[])!==JSON.stringify(state.bathroomModules||[]);if(changed&&dragStartState){history.push(dragStartState);if(history.length>40)history.shift();future=[];}draggingModule=null;dragStartState=null;dragOffset=null;syncScene();}

  function install(){if(installed||!renderer?.domElement)return false;installed=true;ensureState();raycaster=new THREE.Raycaster();pointer=new THREE.Vector2();floorPlane=new THREE.Plane(new THREE.Vector3(0,1,0),0);const c=renderer.domElement;c.addEventListener('pointerdown',onDown,true);c.addEventListener('pointermove',onMove,true);c.addEventListener('pointerup',onUp,true);c.addEventListener('pointercancel',onUp,true);setInterval(syncScene,250);setTimeout(syncScene,0);window.BAT_KUBIQUEITOR_MODULE_PRESETS={version:3,presets:PRESETS,syncScene};return true;}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install,80),{once:true});else setTimeout(install,80);
})();
