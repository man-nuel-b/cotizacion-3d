// Electrical placement system for bat-kubiqueitor.
// UX: choose outlet / switch / light, click a valid wall or ceiling, then edit in 3D.
// Chilean design defaults are preliminary project defaults and must be validated by an authorized SEC installer.
(function(){
  if(window.BAT_KUBIQUEITOR_ELECTRICAL?.version>=1) return;

  const TYPES={
    outlet:{stateType:'electrical',label:'Enchufe',prefix:'E',surface:'wall',height:.30,circuit:'C2 Enchufes',conductor:'2,5 mm²'},
    switch:{stateType:'electricalSwitch',label:'Interruptor',prefix:'I',surface:'wall',height:1.10,circuit:'C1 Iluminación',conductor:'1,5 mm²'},
    light:{stateType:'electricalLight',label:'Luminaria',prefix:'L',surface:'ceiling',circuit:'C1 Iluminación',conductor:'1,5 mm²'}
  };
  const MAX_SWITCHES=24,MAX_LIGHTS=24;
  let placementMode=null;
  let raycaster=null,pointer=null,preview=null;
  let baseCreateCeilingLight=null;
  let installed=false;

  function ensureElectricalState(){
    if(!state.counts) state.counts={};
    if(!state.layout) state.layout={};
    if(!Number.isFinite(state.counts.electricalSwitch)) state.counts.electricalSwitch=0;
    if(!Number.isFinite(state.counts.electricalLight)) state.counts.electricalLight=0;
    if(!Array.isArray(state.layout.electrical)) state.layout.electrical=[];
    if(!Array.isArray(state.layout.electricalSwitch)) state.layout.electricalSwitch=[];
    if(!Array.isArray(state.layout.electricalLight)) state.layout.electricalLight=[];
    state.electricalDesign=state.electricalDesign||{
      standard:'Chile · SEC/RIC (diseño preliminar)',
      board:{id:'TG',differential:'30 mA'},
      circuits:{
        lighting:{id:'C1',name:'Iluminación',conductor:'1,5 mm²'},
        outlets:{id:'C2',name:'Enchufes',conductor:'2,5 mm²'}
      }
    };
  }

  function extendEditorTypes(){
    if(typeof MOUNTED_FACE_TYPES!=='undefined'&&!MOUNTED_FACE_TYPES.electricalSwitch){
      MOUNTED_FACE_TYPES.electricalSwitch={defaultFace:'A',gap:.18,padding:.16,height:'switch',label:'Interruptor'};
    }
    if(typeof typeLabel==='function'&&!typeLabel.__electricalPlacement){
      const base=typeLabel;
      const wrapped=function(type){
        if(type==='electrical') return 'Enchufe';
        if(type==='electricalSwitch') return 'Interruptor';
        if(type==='electricalLight') return 'Luminaria';
        return base(type);
      };
      wrapped.__electricalPlacement=true;
      typeLabel=wrapped;
    }
    if(typeof actualLayout==='function'&&!actualLayout.__electricalPlacement){
      const base=actualLayout;
      const wrapped=function(type,index){
        ensureElectricalState();
        if(type==='electricalLight'){
          const c=DATA.containers[state.container],stored=state.layout.electricalLight[index];
          const fallback={x:0,z:0};
          return {
            x:Number.isFinite(stored?.x)?stored.x:fallback.x,
            z:Number.isFinite(stored?.z)?stored.z:fallback.z,
            y:c.height-.06
          };
        }
        return base(type,index);
      };
      wrapped.__electricalPlacement=true;
      actualLayout=wrapped;
    }
    if(typeof validCandidate==='function'&&!validCandidate.__electricalPlacement){
      const base=validCandidate;
      const wrapped=function(type,index,candidate){
        if(type==='electricalLight'){
          const c=DATA.containers[state.container],margin=.18;
          if(candidate.x<-c.length/2+margin||candidate.x>c.length/2-margin||candidate.z<-c.width/2+margin||candidate.z>c.width/2-margin) return false;
          for(let i=0;i<(state.counts.electricalLight||0);i++){
            if(i===index) continue;
            const other=actualLayout('electricalLight',i);
            if(Math.hypot(other.x-candidate.x,other.z-candidate.z)<.28) return false;
          }
          return true;
        }
        return base(type,index,candidate);
      };
      wrapped.__electricalPlacement=true;
      validCandidate=wrapped;
    }
    if(typeof editorPositionLabel==='function'&&!editorPositionLabel.__electricalPlacement){
      const base=editorPositionLabel;
      const wrapped=function(type,pos){
        if(type==='electricalLight') return `Techo · X ${pos.x.toFixed(2)} m · Z ${pos.z.toFixed(2)} m`;
        return base(type,pos);
      };
      wrapped.__electricalPlacement=true;
      editorPositionLabel=wrapped;
    }
    if(typeof nudgeSelected==='function'&&!nudgeSelected.__electricalPlacement){
      const base=nudgeSelected;
      const wrapped=function(dx=0,dz=0){
        if(selectedEditable?.type!=='electricalLight') return base(dx,dz);
        const {index}=selectedEditable,current=actualLayout('electricalLight',index);
        const candidate={x:Math.round((current.x+dx)*100)/100,z:Math.round((current.z+dz)*100)/100};
        if(!validCandidate('electricalLight',index,candidate)) return toast('Esa posición no es válida');
        pushHistory();ensureElectricalState();state.layout.electricalLight[index]=candidate;renderAll();toast('Posición ajustada');
      };
      wrapped.__electricalPlacement=true;
      nudgeSelected=wrapped;
    }
    if(typeof resetSelectedPosition==='function'&&!resetSelectedPosition.__electricalPlacement){
      const base=resetSelectedPosition;
      const wrapped=function(){
        if(selectedEditable?.type!=='electricalLight') return base();
        pushHistory();ensureElectricalState();state.layout.electricalLight[selectedEditable.index]={x:0,z:0};renderAll();toast('Posición automática restaurada');
      };
      wrapped.__electricalPlacement=true;
      resetSelectedPosition=wrapped;
    }
    if(typeof onEditorPointerMove==='function'&&!onEditorPointerMove.__electricalPlacement){
      const base=onEditorPointerMove;
      const wrapped=function(event){
        if(draggingEditable?.userData?.editor?.type!=='electricalLight') return base(event);
        pointerNDC(event);editorRaycaster.setFromCamera(editorPointer,camera);
        const c=DATA.containers[state.container],plane=new THREE.Plane(new THREE.Vector3(0,1,0),-(c.height-.06));
        const point=new THREE.Vector3();if(!editorRaycaster.ray.intersectPlane(plane,point)) return;
        const index=draggingEditable.userData.editor.index,candidate={x:Math.round(point.x*20)/20,z:Math.round(point.z*20)/20};
        if(!validCandidate('electricalLight',index,candidate)) return;
        dragMoved=true;ensureElectricalState();state.layout.electricalLight[index]=candidate;draggingEditable.position.set(candidate.x,c.height-.06,candidate.z);
        const subtitle=document.getElementById('editor-subtitle');if(subtitle) subtitle.textContent=`Elemento ${index+1} · ${editorPositionLabel('electricalLight',candidate)}`;
      };
      wrapped.__electricalPlacement=true;
      onEditorPointerMove=wrapped;
    }
  }

  function makeSwitch(){
    const g=new THREE.Group();
    const plate=new THREE.MeshStandardMaterial({color:0xf8fafc,roughness:.34});
    const rocker=new THREE.MeshStandardMaterial({color:0xcbd5e1,roughness:.45});
    const p=new THREE.Mesh(new THREE.BoxGeometry(.10,.14,.025),plate);g.add(p);
    const r=new THREE.Mesh(new THREE.BoxGeometry(.045,.075,.018),rocker);r.position.z=.019;g.add(r);
    return g;
  }

  function makeBoard(){
    const g=new THREE.Group();g.userData.electricalSystemVisual=true;g.name='electrical-board-TG';
    const body=new THREE.MeshStandardMaterial({color:0xf8fafc,roughness:.42,metalness:.08});
    const dark=new THREE.MeshStandardMaterial({color:0x334155,roughness:.48});
    const box=new THREE.Mesh(new THREE.BoxGeometry(.38,.52,.10),body);g.add(box);
    for(let i=0;i<4;i++){const breaker=new THREE.Mesh(new THREE.BoxGeometry(.055,.11,.035),dark);breaker.position.set(-.09+i*.06,.04,.067);g.add(breaker);}
    return g;
  }

  function makeLabel(text){
    const canvas=document.createElement('canvas');canvas.width=256;canvas.height=128;
    const ctx=canvas.getContext('2d');ctx.fillStyle='rgba(15,23,42,.90)';ctx.beginPath();ctx.roundRect(8,8,240,112,24);ctx.fill();
    ctx.strokeStyle='#f59e0b';ctx.lineWidth=5;ctx.stroke();ctx.fillStyle='#fff';ctx.font='900 54px Inter,Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,128,66);
    const texture=new THREE.CanvasTexture(canvas);const material=new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:false});
    const sprite=new THREE.Sprite(material);sprite.scale.set(.42,.21,1);sprite.renderOrder=990;sprite.userData.electricalSystemVisual=true;return sprite;
  }

  function facePosition(face,offset,y,c,inset=-.085){
    if(face==='A') return {position:new THREE.Vector3(offset,y,c.width/2+inset),rotation:Math.PI};
    if(face==='B') return {position:new THREE.Vector3(offset,y,-c.width/2-inset),rotation:0};
    if(face==='C') return {position:new THREE.Vector3(c.length/2+inset,y,offset),rotation:-Math.PI/2};
    return {position:new THREE.Vector3(-c.length/2-inset,y,offset),rotation:Math.PI/2};
  }

  function endpointForMounted(type,index,height){
    const c=DATA.containers[state.container],layout=actualLayout(type,index),face=layout.face||'A';
    const p=facePosition(face,layout.x,height,c,-.035);return p.position;
  }

  function disposeElectricalVisuals(){
    if(!containerGroup) return;
    const roots=[];containerGroup.traverse(obj=>{if(obj?.userData?.electricalSystemVisual&&obj!==containerGroup) roots.push(obj);});
    const unique=roots.filter(obj=>!obj.parent?.userData?.electricalSystemVisual);
    unique.forEach(obj=>{
      obj.traverse?.(child=>{child.geometry?.dispose?.();if(Array.isArray(child.material))child.material.forEach(m=>m?.dispose?.());else child.material?.dispose?.();});
      obj.parent?.remove?.(obj);
    });
    [...containerGroup.children].filter(obj=>obj?.userData?.legacyAutoElectricalLight).forEach(obj=>containerGroup.remove(obj));
  }

  function addRoute(points,circuit){
    const geo=new THREE.BufferGeometry().setFromPoints(points);
    const mat=new THREE.LineBasicMaterial({color:circuit==='C1'?0xf59e0b:0x38bdf8,transparent:true,opacity:.75});
    const line=new THREE.Line(geo,mat);line.userData.electricalSystemVisual=true;line.name=`route-${circuit}`;containerGroup.add(line);
  }

  function routeFromBoard(boardPoint,target,circuit,c){
    const topY=c.height-.10;
    const p1=new THREE.Vector3(boardPoint.x,topY,boardPoint.z);
    const p2=new THREE.Vector3(target.x,topY,target.z);
    addRoute([boardPoint.clone(),p1,p2,target.clone()],circuit);
  }

  function syncScene(){
    if(!containerGroup||typeof registerEditable!=='function') return;
    ensureElectricalState();extendEditorTypes();disposeElectricalVisuals();
    const c=DATA.containers[state.container];

    // Remove the old automatically generated ceiling lights. Manual placement is authoritative now.
    [...containerGroup.children].filter(obj=>obj?.userData?.legacyAutoElectricalLight).forEach(obj=>containerGroup.remove(obj));

    const board=makeBoard();const boardPos=facePosition('A',-c.length/2+.36,1.55,c,-.055);board.position.copy(boardPos.position);board.rotation.y=boardPos.rotation;containerGroup.add(board);
    const boardLabel=makeLabel('TG');boardLabel.position.set(0,.38,.08);board.add(boardLabel);
    const boardPoint=board.position.clone();

    for(let i=0;i<(state.counts.electrical||0);i++){
      const p=endpointForMounted('electrical',i,TYPES.outlet.height);routeFromBoard(boardPoint,p,'C2',c);
      const label=makeLabel(`E${i+1}`);label.position.copy(p);label.position.y+=.16;containerGroup.add(label);
    }

    for(let i=0;i<(state.counts.electricalSwitch||0);i++){
      const layout=actualLayout('electricalSwitch',i),face=layout.face||'A',placement=facePosition(face,layout.x,TYPES.switch.height,c,-.075);
      const obj=makeSwitch();obj.userData.electricalSystemVisual=true;obj.position.copy(placement.position);obj.rotation.y=placement.rotation;containerGroup.add(obj);
      registerEditable(obj,'electricalSwitch',i,{axis:(face==='A'||face==='B')?'x':'z',surface:typeof mountedSurface==='function'?mountedSurface(face):'wall',face});
      const label=makeLabel(`I${i+1}`);label.position.copy(placement.position);label.position.y+=.18;containerGroup.add(label);
      routeFromBoard(boardPoint,placement.position,'C1',c);
    }

    for(let i=0;i<(state.counts.electricalLight||0);i++){
      const layout=actualLayout('electricalLight',i),light=baseCreateCeilingLight?baseCreateCeilingLight(.65):new THREE.Group();
      light.userData.electricalSystemVisual=true;light.name=`manual-light-${i+1}`;light.position.set(layout.x,c.height-.06,layout.z);containerGroup.add(light);
      registerEditable(light,'electricalLight',i,{axis:'xz',surface:'ceiling'});
      const label=makeLabel(`L${i+1}`);label.position.set(layout.x,c.height-.22,layout.z);containerGroup.add(label);
      routeFromBoard(boardPoint,light.position,'C1',c);
    }
  }

  function installLegacyLightSuppression(){
    if(typeof createCeilingLight!=='function'||createCeilingLight.__electricalManualMode) return false;
    baseCreateCeilingLight=createCeilingLight;
    const wrapped=function(...args){const g=baseCreateCeilingLight(...args);g.userData.legacyAutoElectricalLight=true;return g;};
    wrapped.__electricalManualMode=true;createCeilingLight=wrapped;return true;
  }

  function installRenderHook(){
    if(typeof renderAll!=='function'||renderAll.__electricalPlacement) return false;
    const base=renderAll;
    const wrapped=function(...args){const result=base(...args);requestAnimationFrame(syncScene);return result;};
    wrapped.__electricalPlacement=true;renderAll=wrapped;return true;
  }

  function nearestSurface(event,kind){
    const canvas=renderer?.domElement;if(!canvas||!camera) return null;
    const rect=canvas.getBoundingClientRect();pointer.x=((event.clientX-rect.left)/rect.width)*2-1;pointer.y=-((event.clientY-rect.top)/rect.height)*2+1;raycaster.setFromCamera(pointer,camera);
    const c=DATA.containers[state.container],ray=raycaster.ray,candidates=[];
    const add=(face,plane,valid)=>{const point=new THREE.Vector3();if(ray.intersectPlane(plane,point)&&valid(point)){candidates.push({face,point,distance:point.distanceTo(ray.origin)});}};
    if(kind==='ceiling'){
      add('E',new THREE.Plane(new THREE.Vector3(0,1,0),-c.height),p=>Math.abs(p.x)<=c.length/2-.18&&Math.abs(p.z)<=c.width/2-.18);
    }else{
      add('A',new THREE.Plane(new THREE.Vector3(0,0,1),-c.width/2),p=>Math.abs(p.x)<=c.length/2-.16&&p.y>=.05&&p.y<=c.height-.05);
      add('B',new THREE.Plane(new THREE.Vector3(0,0,-1),-c.width/2),p=>Math.abs(p.x)<=c.length/2-.16&&p.y>=.05&&p.y<=c.height-.05);
      add('C',new THREE.Plane(new THREE.Vector3(1,0,0),-c.length/2),p=>Math.abs(p.z)<=c.width/2-.16&&p.y>=.05&&p.y<=c.height-.05);
      add('D',new THREE.Plane(new THREE.Vector3(-1,0,0),-c.length/2),p=>Math.abs(p.z)<=c.width/2-.16&&p.y>=.05&&p.y<=c.height-.05);
    }
    candidates.sort((a,b)=>a.distance-b.distance);return candidates[0]||null;
  }

  function candidateFromHit(mode,hit){
    if(mode==='light') return {x:Math.round(hit.point.x*20)/20,z:Math.round(hit.point.z*20)/20};
    const offset=(hit.face==='A'||hit.face==='B')?hit.point.x:hit.point.z;
    return {face:hit.face,x:Math.round(offset*20)/20};
  }

  function setPreview(hit){
    if(!containerGroup) return;
    if(!preview){
      preview=new THREE.Mesh(new THREE.SphereGeometry(.055,16,12),new THREE.MeshBasicMaterial({color:0xf59e0b,transparent:true,opacity:.75,depthTest:false}));
      preview.renderOrder=999;containerGroup.add(preview);
    }
    if(!hit){preview.visible=false;return;}
    preview.visible=true;const c=DATA.containers[state.container];
    if(placementMode==='light') preview.position.set(hit.point.x,c.height-.06,hit.point.z);
    else{
      const cfg=TYPES[placementMode],candidate=candidateFromHit(placementMode,hit),p=facePosition(hit.face,candidate.x,cfg.height,c,-.09);preview.position.copy(p.position);
    }
  }

  function updatePlacementUI(){
    const panel=document.getElementById('electrical-placement-panel'),status=document.getElementById('electrical-placement-status');
    if(!panel||!status) return;
    panel.querySelectorAll('[data-electrical-mode]').forEach(btn=>btn.classList.toggle('ring-2',btn.dataset.electricalMode===placementMode));
    if(!placementMode) status.textContent='Elige un elemento y luego haz clic directamente en el modelo 3D.';
    else status.textContent=`COLOCANDO: ${TYPES[placementMode].label.toUpperCase()} · haz clic en ${TYPES[placementMode].surface==='ceiling'?'el techo':'una pared'} · ESC cancela`;
  }

  function cancelPlacement(){placementMode=null;if(preview)preview.visible=false;if(renderer?.domElement)renderer.domElement.style.cursor='grab';updatePlacementUI();}
  function startPlacement(mode){
    if(!TYPES[mode]) return;placementMode=mode;
    if(typeof interactionMode!=='undefined'&&interactionMode==='explore'&&typeof setInteractionMode==='function') setInteractionMode('edit');
    updatePlacementUI();toast(`Haz clic en ${TYPES[mode].surface==='ceiling'?'el techo':'una pared'} para ubicar ${TYPES[mode].label.toLowerCase()}`);
  }

  function addAtHit(mode,hit){
    ensureElectricalState();const cfg=TYPES[mode],candidate=candidateFromHit(mode,hit),type=cfg.stateType;
    if(type==='electrical'){
      const index=state.counts.electrical||0;if(index>=24)return toast('Llegaste al máximo de enchufes');
      if(!validCandidate('electrical',index,candidate)) return toast('Ese punto está demasiado cerca de otro elemento o del borde');
      pushHistory();state.counts.electrical=index+1;state.layout.electrical[index]=candidate;renderAll();toast(`E${index+1} agregado · ${cfg.circuit}`);return;
    }
    if(type==='electricalSwitch'){
      const index=state.counts.electricalSwitch||0;if(index>=MAX_SWITCHES)return toast('Llegaste al máximo de interruptores');
      if(!validCandidate(type,index,candidate)) return toast('Ese punto está demasiado cerca de otro elemento o del borde');
      pushHistory();state.counts.electricalSwitch=index+1;state.layout.electricalSwitch[index]=candidate;renderAll();toast(`I${index+1} agregado · ${cfg.circuit}`);return;
    }
    const index=state.counts.electricalLight||0;if(index>=MAX_LIGHTS)return toast('Llegaste al máximo de luminarias');
    if(!validCandidate(type,index,candidate)) return toast('Ese punto está demasiado cerca de otra luminaria o del borde');
    pushHistory();state.counts.electricalLight=index+1;state.layout.electricalLight[index]=candidate;renderAll();toast(`L${index+1} agregada · ${cfg.circuit}`);
  }

  function onPointerMove(event){
    if(!placementMode) return;const hit=nearestSurface(event,TYPES[placementMode].surface);setPreview(hit);if(renderer?.domElement)renderer.domElement.style.cursor=hit?'crosshair':'not-allowed';
  }
  function onPointerDown(event){
    if(!placementMode) return;const hit=nearestSurface(event,TYPES[placementMode].surface);if(!hit)return;
    event.preventDefault();event.stopPropagation();event.stopImmediatePropagation?.();addAtHit(placementMode,hit);
  }

  function installUI(){
    if(document.getElementById('electrical-placement-panel')) return true;
    const viewer=document.querySelector('.viewer-wrap');if(!viewer) return false;
    const panel=document.createElement('div');panel.id='electrical-placement-panel';panel.className='absolute z-30 right-4 top-20 w-72 rounded-2xl border border-amber-400/30 bg-slate-950/92 text-white shadow-2xl backdrop-blur-xl p-3 hidden';
    panel.innerHTML=`
      <div class="flex items-start justify-between gap-2"><div><div class="text-[10px] uppercase tracking-widest text-amber-400 font-black">Instalación eléctrica</div><div class="text-sm font-black mt-1">Colocación directa 3D</div></div><button type="button" data-electrical-close class="w-7 h-7 rounded-lg bg-white/10"><i class="fa-solid fa-xmark"></i></button></div>
      <div class="grid grid-cols-3 gap-2 mt-3">
        <button type="button" data-electrical-mode="outlet" class="rounded-xl bg-white/10 p-2 text-[10px] font-bold"><i class="fa-solid fa-plug block text-base text-sky-300 mb-1"></i>Enchufe</button>
        <button type="button" data-electrical-mode="switch" class="rounded-xl bg-white/10 p-2 text-[10px] font-bold"><i class="fa-solid fa-toggle-on block text-base text-amber-300 mb-1"></i>Interruptor</button>
        <button type="button" data-electrical-mode="light" class="rounded-xl bg-white/10 p-2 text-[10px] font-bold"><i class="fa-solid fa-lightbulb block text-base text-yellow-200 mb-1"></i>Luminaria</button>
      </div>
      <div id="electrical-placement-status" class="mt-3 rounded-xl bg-white/5 border border-white/10 p-2.5 text-[10px] text-slate-300 leading-relaxed"></div>
      <div class="mt-2 text-[9px] text-slate-500">TG + ID 30 mA · C1 iluminación · C2 enchufes. Diseño preliminar RIC; validar con instalador autorizado SEC.</div>`;
    viewer.appendChild(panel);
    panel.querySelector('[data-electrical-close]').addEventListener('click',()=>{cancelPlacement();panel.classList.add('hidden');});
    panel.querySelectorAll('[data-electrical-mode]').forEach(btn=>btn.addEventListener('click',()=>startPlacement(btn.dataset.electricalMode)));

    let toolbarBtn=document.getElementById('electrical-placement-toggle');
    if(!toolbarBtn){
      toolbarBtn=document.createElement('button');toolbarBtn.id='electrical-placement-toggle';toolbarBtn.type='button';toolbarBtn.className='viewer-pill rounded-xl px-3 py-2 text-xs font-semibold';toolbarBtn.innerHTML='<i class="fa-solid fa-bolt mr-1"></i> Electricidad';
      toolbarBtn.addEventListener('click',()=>{panel.classList.toggle('hidden');if(panel.classList.contains('hidden'))cancelPlacement();else updatePlacementUI();});
      document.querySelector('.viewer-toolbar')?.appendChild(toolbarBtn);
    }
    updatePlacementUI();return true;
  }

  function install(){
    if(installed) return true;
    if(typeof THREE==='undefined'||typeof state==='undefined'||typeof renderAll!=='function'||typeof actualLayout!=='function'||typeof registerEditable!=='function'||!renderer?.domElement) return false;
    installed=true;ensureElectricalState();extendEditorTypes();installLegacyLightSuppression();installRenderHook();raycaster=new THREE.Raycaster();pointer=new THREE.Vector2();installUI();
    renderer.domElement.addEventListener('pointermove',onPointerMove,true);renderer.domElement.addEventListener('pointerdown',onPointerDown,true);
    window.addEventListener('keydown',event=>{if(event.key==='Escape'&&placementMode){event.preventDefault();cancelPlacement();toast('Colocación eléctrica cancelada');}});
    window.BAT_KUBIQUEITOR_ELECTRICAL={version:1,syncScene,startPlacement,cancelPlacement};
    renderAll();return true;
  }

  let tries=0;const timer=setInterval(()=>{tries++;if(install()||tries>=180)clearInterval(timer);},80);
})();
