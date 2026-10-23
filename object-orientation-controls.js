// Rotation controls for sanitary fixtures + opening behavior for interior doors.
(function(){
  if(window.BAT_KUBIQUEITOR_OBJECT_ORIENTATION) return;

  const SANITARY_TYPES=['wc','sink','shower'];
  let installed=false;

  function ready(){
    return typeof THREE!=='undefined'&&typeof state!=='undefined'&&typeof DATA!=='undefined'&&
      typeof rebuild3D==='function'&&typeof renderAll==='function'&&typeof ensureLayoutState==='function'&&
      typeof showEditorPanel==='function'&&typeof hideEditorPanel==='function'&&
      window.BAT_KUBIQUEITOR_PARTITION_FACES;
  }

  function normalizeDeg(value){
    let d=Math.round(Number(value)||0)%360;
    if(d<0) d+=360;
    return d;
  }

  function sanitaryRotation(type,index){
    ensureLayoutState();
    const entry=state.layout?.[type]?.[index]||{};
    return normalizeDeg(entry.rotation||0);
  }

  function setSanitaryRotation(type,index,degrees){
    if(!SANITARY_TYPES.includes(type)) return;
    pushHistory();
    ensureLayoutState();
    const current=state.layout[type][index]||actualLayout(type,index)||{};
    state.layout[type][index]={...current,rotation:normalizeDeg(degrees)};
    renderAll();
    toast(`${typeLabel(type)} · ${normalizeDeg(degrees)}°`);
  }

  window.rotateSelectedSanitary=function(delta){
    if(!selectedEditable||!SANITARY_TYPES.includes(selectedEditable.type)) return;
    const {type,index}=selectedEditable;
    setSanitaryRotation(type,index,sanitaryRotation(type,index)+Number(delta||0));
  };

  window.setSelectedSanitaryRotation=function(degrees){
    if(!selectedEditable||!SANITARY_TYPES.includes(selectedEditable.type)) return;
    setSanitaryRotation(selectedEditable.type,selectedEditable.index,degrees);
  };

  function ensureDoorBehaviors(){
    if(!Array.isArray(state.interiorDoorBehavior)) state.interiorDoorBehavior=[];
    const count=state.counts?.partition||0;
    for(let i=0;i<count;i++){
      const current=state.interiorDoorBehavior[i]||{};
      state.interiorDoorBehavior[i]={
        kind:current.kind==='sliding'?'sliding':'swing',
        hinge:current.hinge==='right'?'right':'left',
        opensTo:Number(current.opensTo)===2?2:1,
        slide:current.slide==='right'?'right':'left'
      };
    }
    state.interiorDoorBehavior=state.interiorDoorBehavior.slice(0,count);
    return state.interiorDoorBehavior;
  }

  function doorBehavior(index){
    ensureDoorBehaviors();
    return state.interiorDoorBehavior[index];
  }

  window.setInteriorDoorBehavior=function(index,key,value){
    const behavior=doorBehavior(index);
    if(key==='kind'&&!['swing','sliding'].includes(value)) return;
    if(key==='hinge'&&!['left','right'].includes(value)) return;
    if(key==='opensTo'&&![1,2,'1','2'].includes(value)) return;
    if(key==='slide'&&!['left','right'].includes(value)) return;
    pushHistory();
    behavior[key]=key==='opensTo'?Number(value):value;
    renderAll();
    const labels={kind:'Tipo de puerta',hinge:'Bisagra',opensTo:'Sentido de apertura',slide:'Deslizamiento'};
    toast(`${labels[key]||'Puerta'} actualizado`);
  };

  function applySanitaryRotations(){
    if(!Array.isArray(editableObjects)) return;
    editableObjects.forEach(root=>{
      const meta=root?.userData?.editor;
      if(!meta||!SANITARY_TYPES.includes(meta.type)) return;
      const base=meta.type==='sink'?Math.PI:0;
      root.rotation.y=base+THREE.MathUtils.degToRad(sanitaryRotation(meta.type,meta.index));
    });
  }

  function clearDoorOverlay(root){
    const old=root?.getObjectByName?.('interior-door-behavior-visual');
    if(old){
      old.traverse(obj=>{obj.geometry?.dispose?.(); if(Array.isArray(obj.material)) obj.material.forEach(m=>m?.dispose?.()); else obj.material?.dispose?.();});
      old.parent?.remove(old);
    }
  }

  function makeDoorMaterial(){
    return typeof mat==='function'?mat(0xd6c4a7,{roughness:.60,metalness:.02}):new THREE.MeshStandardMaterial({color:0xd6c4a7,roughness:.60});
  }

  function makeMetal(){
    return typeof mat==='function'?mat(0x94a3b8,{roughness:.22,metalness:.82}):new THREE.MeshStandardMaterial({color:0x94a3b8,roughness:.22,metalness:.82});
  }

  function addHandle(parent,x,y,z){
    const knob=new THREE.Mesh(new THREE.SphereGeometry(.035,14,10),makeMetal());
    knob.position.set(x,y,z); parent.add(knob);
  }

  function addSwingDoorVisual(root,index,dims,door,behavior){
    const overlay=new THREE.Group(); overlay.name='interior-door-behavior-visual';
    const hingeZ=behavior.hinge==='left'?door.offset-door.width/2:door.offset+door.width/2;
    const localDir=behavior.hinge==='left'?1:-1;
    const openSide=behavior.opensTo===1?1:-1;
    const pivot=new THREE.Group();
    pivot.position.set(openSide*(dims.thickness/2+.025),0,hingeZ);
    const angle=THREE.MathUtils.degToRad(67)*localDir*openSide;
    pivot.rotation.y=angle;

    const leafWidth=Math.max(.48,door.width-.07),leafHeight=Math.max(1.60,door.height-.07);
    const leaf=box(.036,leafHeight,leafWidth,makeDoorMaterial(),0,leafHeight/2,localDir*leafWidth/2);
    leaf.name='interior-door-open-leaf'; pivot.add(leaf);
    addHandle(pivot,openSide*.024,leafHeight*.50,localDir*leafWidth*.80);
    overlay.add(pivot); root.add(overlay);
  }

  function addSlidingDoorVisual(root,index,dims,door,behavior){
    const overlay=new THREE.Group(); overlay.name='interior-door-behavior-visual';
    const dir=behavior.slide==='right'?1:-1;
    const leafWidth=Math.max(.48,door.width-.05),leafHeight=Math.max(1.60,door.height-.07);
    const limit=Math.max(0,dims.length/2-leafWidth/2-.04);
    const target=Math.max(-limit,Math.min(limit,door.offset+dir*door.width*.92));
    const faceX=dims.thickness/2+.035;
    const leaf=box(.036,leafHeight,leafWidth,makeDoorMaterial(),faceX,leafHeight/2,target);
    leaf.name='interior-door-sliding-leaf'; overlay.add(leaf);
    const railLength=Math.min(dims.length,door.width*2.15);
    overlay.add(box(.04,.045,railLength,makeMetal(),faceX,door.height+.055,door.offset+dir*door.width*.42));
    addHandle(overlay,faceX+.024,leafHeight*.50,target-dir*leafWidth*.32);
    root.add(overlay);
  }

  function applyInteriorDoorBehavior(){
    if(!Array.isArray(editableObjects)||typeof partitionDoor!=='function') return;
    ensureDoorBehaviors();
    editableObjects.forEach(root=>{
      const meta=root?.userData?.editor;
      if(meta?.type!=='partition') return;
      clearDoorOverlay(root);
      root.traverse(obj=>{
        if(obj.name==='interior-door-leaf') obj.visible=false;
      });
      let door=null,dims=null;
      try{door=partitionDoor(meta.index);dims=objectDimensions('partition',meta.index);}catch(e){return;}
      if(!door?.enabled||!dims) return;
      const safe={
        width:Math.min(Math.max(.60,Number(door.width)||.80),Math.max(.60,dims.length-.24)),
        height:Math.min(Math.max(1.70,Number(door.height)||2.00),Math.max(1.70,dims.height-.08)),
        offset:Number(door.offset)||0
      };
      const maxOffset=Math.max(0,(dims.length-safe.width)/2-.08);
      safe.offset=Math.max(-maxOffset,Math.min(maxOffset,safe.offset));
      const behavior=doorBehavior(meta.index);
      if(behavior.kind==='sliding') addSlidingDoorVisual(root,meta.index,dims,safe,behavior);
      else addSwingDoorVisual(root,meta.index,dims,safe,behavior);
    });
  }

  function ensureSanitaryEditor(){
    const panel=document.getElementById('object-editor'); if(!panel) return null;
    let block=document.getElementById('sanitary-rotation-editor');
    if(block) return block;
    block=document.createElement('div');
    block.id='sanitary-rotation-editor';
    block.className='hidden mt-3 rounded-xl border border-white/10 bg-white/5 p-3';
    const deleteBtn=panel.querySelector('button[onclick*="deleteSelectedObject"]');
    if(deleteBtn) panel.insertBefore(block,deleteBtn); else panel.appendChild(block);
    return block;
  }

  function renderSanitaryEditor(type,index){
    const block=ensureSanitaryEditor(); if(!block) return;
    if(!SANITARY_TYPES.includes(type)){block.classList.add('hidden');return;}
    const deg=sanitaryRotation(type,index);
    block.classList.remove('hidden');
    block.innerHTML=`
      <div class="text-[10px] uppercase tracking-widest text-slate-400 font-black">Orientación</div>
      <div class="text-[10px] text-slate-500 mt-1">Gira el artefacto para enfrentar el muro o pasillo correcto.</div>
      <div class="grid grid-cols-2 gap-2 mt-2">
        <button type="button" onclick="rotateSelectedSanitary(-90)" class="rounded-lg bg-white/10 py-2 text-xs font-bold"><i class="fa-solid fa-rotate-left mr-1"></i> −90°</button>
        <button type="button" onclick="rotateSelectedSanitary(90)" class="rounded-lg bg-amber-500 text-slate-950 py-2 text-xs font-black"><i class="fa-solid fa-rotate-right mr-1"></i> +90°</button>
      </div>
      <div class="grid grid-cols-4 gap-1.5 mt-2">${[0,90,180,270].map(v=>`<button type="button" onclick="setSelectedSanitaryRotation(${v})" class="rounded-lg py-1.5 text-[10px] font-bold ${deg===v?'bg-sky-400 text-slate-950':'bg-white/10 text-slate-200'}">${v}°</button>`).join('')}</div>`;
  }

  function enhancePartitionDoorEditor(index){
    const block=document.getElementById('partition-face-system-editor');
    if(!block||typeof partitionDoor!=='function') return;
    let door=null; try{door=partitionDoor(index);}catch(e){}
    if(!door?.enabled) return;
    const behavior=doorBehavior(index),number=index+1;
    const extra=document.createElement('div');
    extra.id='interior-door-behavior-editor';
    extra.className='mt-3 rounded-xl border border-amber-400/20 bg-amber-500/5 p-3';
    extra.innerHTML=`
      <div class="text-[10px] uppercase tracking-widest text-amber-300 font-black">Funcionamiento de puerta</div>
      <div class="grid grid-cols-2 gap-2 mt-2">
        <button type="button" onclick="setInteriorDoorBehavior(${index},'kind','swing')" class="rounded-lg py-2 text-[10px] font-black ${behavior.kind==='swing'?'bg-amber-500 text-slate-950':'bg-white/10 text-slate-200'}">Abatible</button>
        <button type="button" onclick="setInteriorDoorBehavior(${index},'kind','sliding')" class="rounded-lg py-2 text-[10px] font-black ${behavior.kind==='sliding'?'bg-amber-500 text-slate-950':'bg-white/10 text-slate-200'}">Corredera</button>
      </div>
      ${behavior.kind==='swing'?`
        <div class="text-[9px] text-slate-400 font-bold mt-3">Bisagra</div>
        <div class="grid grid-cols-2 gap-2 mt-1"><button type="button" onclick="setInteriorDoorBehavior(${index},'hinge','left')" class="rounded-lg py-2 text-[10px] font-bold ${behavior.hinge==='left'?'bg-sky-400 text-slate-950':'bg-white/10'}">Izquierda</button><button type="button" onclick="setInteriorDoorBehavior(${index},'hinge','right')" class="rounded-lg py-2 text-[10px] font-bold ${behavior.hinge==='right'?'bg-sky-400 text-slate-950':'bg-white/10'}">Derecha</button></div>
        <div class="text-[9px] text-slate-400 font-bold mt-3">Abre hacia</div>
        <div class="grid grid-cols-2 gap-2 mt-1"><button type="button" onclick="setInteriorDoorBehavior(${index},'opensTo',1)" class="rounded-lg py-2 text-[10px] font-bold ${behavior.opensTo===1?'bg-emerald-400 text-slate-950':'bg-white/10'}">Cara ${number}.1</button><button type="button" onclick="setInteriorDoorBehavior(${index},'opensTo',2)" class="rounded-lg py-2 text-[10px] font-bold ${behavior.opensTo===2?'bg-emerald-400 text-slate-950':'bg-white/10'}">Cara ${number}.2</button></div>`:`
        <div class="text-[9px] text-slate-400 font-bold mt-3">Corre hacia</div>
        <div class="grid grid-cols-2 gap-2 mt-1"><button type="button" onclick="setInteriorDoorBehavior(${index},'slide','left')" class="rounded-lg py-2 text-[10px] font-bold ${behavior.slide==='left'?'bg-sky-400 text-slate-950':'bg-white/10'}">Izquierda</button><button type="button" onclick="setInteriorDoorBehavior(${index},'slide','right')" class="rounded-lg py-2 text-[10px] font-bold ${behavior.slide==='right'?'bg-sky-400 text-slate-950':'bg-white/10'}">Derecha</button></div>`}`;
    block.appendChild(extra);
  }

  function install(){
    if(installed||!ready()) return false;
    installed=true;
    ensureDoorBehaviors();

    const rebuildBefore=rebuild3D;
    rebuild3D=function(){
      rebuildBefore();
      applySanitaryRotations();
      applyInteriorDoorBehavior();
    };

    const showBefore=showEditorPanel;
    showEditorPanel=function(root){
      showBefore(root);
      const meta=root?.userData?.editor;
      renderSanitaryEditor(meta?.type,meta?.index);
      document.getElementById('interior-door-behavior-editor')?.remove();
      if(meta?.type==='partition') enhancePartitionDoorEditor(meta.index);
    };

    const hideBefore=hideEditorPanel;
    hideEditorPanel=function(){
      document.getElementById('sanitary-rotation-editor')?.classList.add('hidden');
      document.getElementById('interior-door-behavior-editor')?.remove();
      return hideBefore();
    };

    const deleteBefore=deleteSelectedObject;
    deleteSelectedObject=function(){
      if(selectedEditable?.type==='partition'){
        ensureDoorBehaviors();
        state.interiorDoorBehavior.splice(selectedEditable.index,1);
      }
      return deleteBefore();
    };

    if(typeof window.duplicateSelectedPartition==='function'){
      const duplicateBefore=window.duplicateSelectedPartition;
      window.duplicateSelectedPartition=function(){
        if(selectedEditable?.type!=='partition') return duplicateBefore();
        const source=selectedEditable.index,oldCount=state.counts.partition||0,copy={...doorBehavior(source)};
        duplicateBefore();
        if((state.counts.partition||0)>oldCount){
          const index=(state.counts.partition||1)-1;
          ensureDoorBehaviors(); state.interiorDoorBehavior[index]=copy; renderAll();
        }
      };
    }

    window.BAT_KUBIQUEITOR_OBJECT_ORIENTATION={version:1};
    rebuild3D();
    return true;
  }

  if(!install()){
    let tries=0;
    const timer=setInterval(()=>{tries++;if(install()||tries>240) clearInterval(timer);},80);
  }
})();
