// Per-partition construction system: numbered faces, optional insulation,
// independent mandatory linings and one interior door per partition.
(function(){
  if(window.BAT_KUBIQUEITOR_PARTITION_FACES) return;

  function ready(){
    return typeof THREE!=='undefined'&&typeof state!=='undefined'&&typeof DATA!=='undefined'&&
      typeof actualLayout==='function'&&typeof objectDimensions==='function'&&
      typeof registerEditable==='function'&&typeof addGroup==='function'&&
      typeof ensureInteriorSystem==='function'&&typeof rebuildParametricPartitions==='function'&&
      typeof renderAll==='function'&&typeof mat==='function'&&typeof box==='function';
  }

  const DEFAULT_DOOR={enabled:false,width:.80,height:2.00,offset:0};

  if(!DATA.catalog.interiorDoor){
    DATA.catalog.interiorDoor={name:'Puerta interior instalada',unit:'unidad',cost:0};
  }

  function liningMaterial(key){
    if(key==='fibrocement') return mat(0xb8bbb8,{roughness:.86,metalness:.01});
    if(key==='plywood') return mat(0xc78b4f,{roughness:.72,metalness:.01});
    if(key==='osb') return mat(0xb47b48,{roughness:.82,metalness:.01});
    if(key==='pvc') return mat(0xf7fafc,{roughness:.26,metalness:.02});
    return mat(0xeee9df,{roughness:.76,metalness:.01});
  }

  function insulationMaterial(key){
    if(key==='eps') return mat(0xe8f1f2,{roughness:.9,metalness:0});
    if(key==='mineralwool') return mat(0x929875,{roughness:.98,metalness:0});
    return mat(0xe6b94b,{roughness:.98,metalness:0});
  }

  function framingMaterial(){
    const s=ensureInteriorSystem();
    return s.framing==='wood'
      ? mat(0xa66b34,{roughness:.76,metalness:.01})
      : mat(0xb8c1ca,{roughness:.30,metalness:.72});
  }

  function ensurePartitionSpecs(){
    if(!Array.isArray(state.partitionSpecs)) state.partitionSpecs=[];
    if(!Array.isArray(state.interiorDoors)) state.interiorDoors=[];
    const s=ensureInteriorSystem();
    const count=state.counts.partition||0;
    for(let i=0;i<count;i++){
      const current=state.partitionSpecs[i]||{};
      state.partitionSpecs[i]={
        insulationEnabled:Boolean(current.insulationEnabled),
        insulation:INTERIOR_SYSTEMS.insulation[current.insulation]?current.insulation:s.insulation,
        face1:INTERIOR_SYSTEMS.lining[current.face1]?current.face1:s.lining,
        face2:INTERIOR_SYSTEMS.lining[current.face2]?current.face2:s.lining
      };
      const door=state.interiorDoors[i]||{};
      state.interiorDoors[i]={
        enabled:Boolean(door.enabled),
        width:Number.isFinite(Number(door.width))?Number(door.width):DEFAULT_DOOR.width,
        height:Number.isFinite(Number(door.height))?Number(door.height):DEFAULT_DOOR.height,
        offset:Number.isFinite(Number(door.offset))?Number(door.offset):0
      };
    }
    state.partitionSpecs=state.partitionSpecs.slice(0,count);
    state.interiorDoors=state.interiorDoors.slice(0,count);
    return state.partitionSpecs;
  }

  function partitionSpec(index){
    ensurePartitionSpecs();
    return state.partitionSpecs[index];
  }

  function partitionDoor(index){
    ensurePartitionSpecs();
    return state.interiorDoors[index];
  }

  function safeDoor(index,dims){
    const door={...partitionDoor(index)};
    const maxW=Math.max(.60,dims.length-.24);
    const maxH=Math.max(.80,dims.height-.08);
    door.width=Math.min(Math.max(.60,door.width),Math.min(1.20,maxW));
    door.height=Math.min(Math.max(1.70,door.height),Math.min(2.30,maxH));
    const maxOffset=Math.max(0,(dims.length-door.width)/2-.08);
    door.offset=Math.min(maxOffset,Math.max(-maxOffset,door.offset));
    return door;
  }

  function doorRect(index,dims){
    const door=safeDoor(index,dims);
    if(!door.enabled) return null;
    return {
      z1:door.offset-door.width/2,
      z2:door.offset+door.width/2,
      y1:0,
      y2:door.height,
      width:door.width,
      height:door.height,
      offset:door.offset
    };
  }

  function subtractDoor(rect,door){
    if(!door) return [rect];
    const iz1=Math.max(rect.z1,door.z1),iz2=Math.min(rect.z2,door.z2),iy1=Math.max(rect.y1,door.y1),iy2=Math.min(rect.y2,door.y2);
    if(iz1>=iz2||iy1>=iy2) return [rect];
    const out=[];
    if(rect.z1<iz1) out.push({z1:rect.z1,z2:iz1,y1:rect.y1,y2:rect.y2});
    if(iz2<rect.z2) out.push({z1:iz2,z2:rect.z2,y1:rect.y1,y2:rect.y2});
    if(iy2<rect.y2) out.push({z1:iz1,z2:iz2,y1:iy2,y2:rect.y2});
    return out.filter(r=>r.z2-r.z1>.035&&r.y2-r.y1>.035);
  }

  function addLayerSegments(group,length,height,x,thickness,material,door,name,faceCode){
    const rect={z1:-length/2,z2:length/2,y1:0,y2:height};
    subtractDoor(rect,door).forEach(r=>{
      const mesh=box(thickness,r.y2-r.y1,r.z2-r.z1,material,x,(r.y1+r.y2)/2,(r.z1+r.z2)/2);
      mesh.name=name;
      mesh.userData.partitionFace=faceCode;
      group.add(mesh);
    });
  }

  function addFraming(group,index,dims,door){
    const material=framingMaterial();
    const s=ensureInteriorSystem();
    const studFace=s.framing==='wood'?.05:.04;
    const depth=Math.max(.04,dims.thickness-.026);
    const half=dims.length/2;
    group.add(box(depth,studFace,dims.length,material,0,studFace/2,0));
    group.add(box(depth,studFace,dims.length,material,0,dims.height-studFace/2,0));

    const blocked=z=>door&&z>door.z1-studFace&&z<door.z2+studFace;
    for(let z=-half;z<=half+.001;z+=.60){
      const p=Math.min(z,half);
      if(!blocked(p)) group.add(box(depth,dims.height-studFace*2,studFace,material,0,dims.height/2,p));
    }
    if(door){
      const left=door.z1-studFace/2,right=door.z2+studFace/2;
      group.add(box(depth,dims.height-studFace*2,studFace,material,0,dims.height/2,left));
      group.add(box(depth,dims.height-studFace*2,studFace,material,0,dims.height/2,right));
      if(door.y2<dims.height-.05){
        group.add(box(depth,studFace,door.width+studFace*2,material,0,door.y2+studFace/2,door.offset));
      }
    }
  }

  function addInsulation(group,index,dims,door){
    const spec=partitionSpec(index);
    if(!spec.insulationEnabled) return;
    const material=insulationMaterial(spec.insulation);
    addLayerSegments(group,dims.length,dims.height,0,Math.max(.018,dims.thickness*.42),material,door,'partition-insulation',`${index+1}.I`);
  }

  function addDoorObject(group,index,dims,door){
    if(!door) return;
    const frame=mat(0x334155,{roughness:.38,metalness:.55});
    const leaf=mat(0xd6c4a7,{roughness:.62,metalness:.02});
    const handle=mat(0xbfc6ce,{roughness:.16,metalness:.88});
    const jamb=.045;
    group.add(box(dims.thickness+.035,door.height,jamb,frame,0,door.height/2,door.z1));
    group.add(box(dims.thickness+.035,door.height,jamb,frame,0,door.height/2,door.z2));
    group.add(box(dims.thickness+.035,jamb,door.width+jamb*2,frame,0,door.height,door.offset));
    const leafMesh=box(.035,door.height-.07,door.width-.08,leaf,.004,(door.height-.07)/2,door.offset);
    leafMesh.name='interior-door-leaf';
    group.add(leafMesh);
    const knob=new THREE.Mesh(new THREE.SphereGeometry(.035,14,10),handle);
    knob.position.set(.026,door.height*.50,door.offset+door.width*.32);
    group.add(knob);
  }

  function createFaceLabel(text,color){
    const canvas=document.createElement('canvas');
    canvas.width=320; canvas.height=150;
    const ctx=canvas.getContext('2d');
    ctx.fillStyle='rgba(15,23,42,.90)';
    ctx.beginPath(); ctx.roundRect(5,5,310,140,24); ctx.fill();
    ctx.strokeStyle=color; ctx.lineWidth=6; ctx.stroke();
    ctx.fillStyle='#fff'; ctx.font='900 52px Inter, Arial'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(text,160,62);
    ctx.fillStyle='#cbd5e1'; ctx.font='700 20px Inter, Arial'; ctx.fillText('CARA TABIQUE',160,106);
    const texture=new THREE.CanvasTexture(canvas);
    if('encoding' in texture) texture.encoding=THREE.sRGBEncoding;
    const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:false}));
    sprite.scale.set(1.20,.56,1); sprite.renderOrder=997;
    sprite.userData.partitionFaceLabel=text;
    return sprite;
  }

  function buildPartition(index,dims){
    const spec=partitionSpec(index),door=doorRect(index,dims);
    const group=new THREE.Group();
    group.name=`partition-${index+1}`;
    group.userData.partitionNumber=index+1;

    addFraming(group,index,dims,door);
    addInsulation(group,index,dims,door);

    const liningT=.018;
    const faceOffset=dims.thickness/2+liningT/2+.003;
    addLayerSegments(group,dims.length,dims.height,faceOffset,liningT,liningMaterial(spec.face1),door,'partition-lining-face-1',`${index+1}.1`);
    addLayerSegments(group,dims.length,dims.height,-faceOffset,liningT,liningMaterial(spec.face2),door,'partition-lining-face-2',`${index+1}.2`);
    addDoorObject(group,index,dims,door);

    const y=Math.min(dims.height-.18,1.72);
    const label1=createFaceLabel(`${index+1}.1`,'#f59e0b');
    label1.position.set(faceOffset+.10,y,0); group.add(label1);
    const label2=createFaceLabel(`${index+1}.2`,'#38bdf8');
    label2.position.set(-faceOffset-.10,y,0); group.add(label2);

    return group;
  }

  // Final partition renderer. Keeps all positioning/anchoring logic from the existing system.
  rebuildParametricPartitions=function(){
    if(!containerGroup) return;
    ensurePartitionSpecs();
    ensureLayoutState();
    ensureDimensionState();
    if(typeof normalizeAllPartitionsInsideContainer==='function') normalizeAllPartitionsInsideContainer();

    const old=editableObjects.filter(root=>root.userData.editor?.type==='partition');
    old.forEach(disposePartitionRoot);
    editableObjects=editableObjects.filter(root=>root.userData.editor?.type!=='partition');

    for(let i=0;i<(state.counts.partition||0);i++){
      const p=actualLayout('partition',i),d=objectDimensions('partition',i),layout=state.layout.partition[i]||{};
      const axisCenter=Number.isFinite(layout.axisCenter)?layout.axisCenter:0;
      const obj=buildPartition(i,d);
      const y=.08+(d.elevation||0);
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
      if(root){addSelectionOutline(root);showEditorPanel(root);}
    }
  };

  function liningOptions(selected){
    return Object.entries(INTERIOR_SYSTEMS.lining).map(([key,item])=>`<option value="${key}" ${key===selected?'selected':''}>${item.name}</option>`).join('');
  }
  function insulationOptions(selected){
    return Object.entries(INTERIOR_SYSTEMS.insulation).map(([key,item])=>`<option value="${key}" ${key===selected?'selected':''}>${item.name}</option>`).join('');
  }

  function ensureEditor(){
    const panel=document.getElementById('object-editor');
    if(!panel) return null;
    let block=document.getElementById('partition-face-system-editor');
    if(block) return block;
    block=document.createElement('div');
    block.id='partition-face-system-editor';
    block.className='hidden mt-3 rounded-xl border border-white/10 bg-white/5 p-3';
    const deleteBtn=panel.querySelector('button[onclick*="deleteSelectedObject"]');
    if(deleteBtn) panel.insertBefore(block,deleteBtn); else panel.appendChild(block);
    if(!document.getElementById('partition-face-system-style')){
      const style=document.createElement('style');
      style.id='partition-face-system-style';
      style.textContent=`
        .partition-face-card{border:1px solid rgba(255,255,255,.12);background:rgba(15,23,42,.58);border-radius:12px;padding:10px}.partition-face-code{font-weight:950;font-size:14px;color:#fbbf24}.partition-face-code.blue{color:#7dd3fc}.partition-face-select{width:100%;margin-top:7px;background:#0f172a;border:1px solid rgba(255,255,255,.15);border-radius:9px;padding:7px;color:white;font-size:11px;font-weight:700}.partition-switch{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 10px;border-radius:10px;background:rgba(255,255,255,.05);font-size:11px;font-weight:800}.partition-door-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.partition-door-grid label{font-size:9px;color:#94a3b8;font-weight:800}.partition-door-grid input{width:100%;margin-top:4px;background:#0f172a;border:1px solid rgba(255,255,255,.14);border-radius:8px;padding:6px;color:#fff;font-size:11px}
      `;
      document.head.appendChild(style);
    }
    return block;
  }

  window.setPartitionFaceLining=function(index,side,key){
    if(!INTERIOR_SYSTEMS.lining[key]) return;
    pushHistory();
    const spec=partitionSpec(index);
    if(side===1) spec.face1=key; else spec.face2=key;
    renderAll();
    toast(`Tabique ${index+1}.${side}: ${INTERIOR_SYSTEMS.lining[key].name}`);
  };

  window.togglePartitionInsulation=function(index){
    pushHistory();
    const spec=partitionSpec(index);
    spec.insulationEnabled=!spec.insulationEnabled;
    renderAll();
    toast(spec.insulationEnabled?`Aislación activada en Tabique ${index+1}`:`Tabique ${index+1} sin aislación`);
  };

  window.setPartitionInsulation=function(index,key){
    if(!INTERIOR_SYSTEMS.insulation[key]) return;
    pushHistory(); partitionSpec(index).insulation=key; renderAll();
  };

  window.togglePartitionInteriorDoor=function(index){
    pushHistory();
    const door=partitionDoor(index);
    door.enabled=!door.enabled;
    renderAll();
    toast(door.enabled?`Puerta interior agregada al Tabique ${index+1}`:`Puerta interior retirada del Tabique ${index+1}`);
  };

  window.updatePartitionInteriorDoor=function(index,key,value){
    const parsed=Number(value); if(!Number.isFinite(parsed)) return;
    pushHistory();
    const door=partitionDoor(index),dims=objectDimensions('partition',index);
    if(key==='width') door.width=clamp(parsed,.60,Math.min(1.20,dims.length-.24));
    else if(key==='height') door.height=clamp(parsed,1.70,Math.min(2.30,dims.height-.08));
    else if(key==='offset'){
      const max=Math.max(0,(dims.length-door.width)/2-.08);
      door.offset=clamp(parsed,-max,max);
    }
    renderAll();
  };

  function renderEditor(index){
    const block=ensureEditor(); if(!block) return;
    const spec=partitionSpec(index),door=safeDoor(index,objectDimensions('partition',index));
    const number=index+1;
    block.classList.remove('hidden');
    block.innerHTML=`
      <div class="text-[10px] uppercase tracking-widest text-slate-400 font-black">Tabique ${number} · terminaciones</div>
      <div class="text-[10px] text-slate-500 mt-1">Cada cara se reviste de forma independiente. El revestimiento es obligatorio.</div>
      <div class="grid grid-cols-2 gap-2 mt-3">
        <div class="partition-face-card"><div class="partition-face-code">${number}.1</div><div class="text-[9px] text-slate-400">Cara 1</div><select class="partition-face-select" onchange="setPartitionFaceLining(${index},1,this.value)">${liningOptions(spec.face1)}</select></div>
        <div class="partition-face-card"><div class="partition-face-code blue">${number}.2</div><div class="text-[9px] text-slate-400">Cara 2</div><select class="partition-face-select" onchange="setPartitionFaceLining(${index},2,this.value)">${liningOptions(spec.face2)}</select></div>
      </div>
      <div class="partition-switch mt-3"><span><i class="fa-solid fa-temperature-half mr-1 text-sky-300"></i>Aislación opcional</span><button type="button" onclick="togglePartitionInsulation(${index})" class="rounded-lg px-2 py-1 ${spec.insulationEnabled?'bg-emerald-500 text-slate-950':'bg-white/10 text-slate-300'}">${spec.insulationEnabled?'Sí':'No'}</button></div>
      ${spec.insulationEnabled?`<select class="partition-face-select" onchange="setPartitionInsulation(${index},this.value)">${insulationOptions(spec.insulation)}</select>`:''}
      <div class="partition-switch mt-3"><span><i class="fa-solid fa-door-open mr-1 text-amber-300"></i>Puerta interior</span><button type="button" onclick="togglePartitionInteriorDoor(${index})" class="rounded-lg px-2 py-1 ${door.enabled?'bg-amber-500 text-slate-950':'bg-white/10 text-slate-300'}">${door.enabled?'Instalada':'Sin puerta'}</button></div>
      ${door.enabled?`<div class="partition-door-grid mt-2"><label>Ancho<input type="number" min=".60" max="1.20" step=".05" value="${door.width.toFixed(2)}" onchange="updatePartitionInteriorDoor(${index},'width',this.value)"></label><label>Alto<input type="number" min="1.70" max="2.30" step=".05" value="${door.height.toFixed(2)}" onchange="updatePartitionInteriorDoor(${index},'height',this.value)"></label><label>Posición<input type="number" step=".05" value="${door.offset.toFixed(2)}" onchange="updatePartitionInteriorDoor(${index},'offset',this.value)"></label></div>`:''}`;
  }

  const showEditorBefore=showEditorPanel;
  showEditorPanel=function(root){
    showEditorBefore(root);
    const block=ensureEditor();
    if(root?.userData.editor?.type==='partition'){
      const index=root.userData.editor.index;
      renderEditor(index);
      const title=document.getElementById('editor-title');
      if(title) title.textContent=`Tabique ${index+1}`;
    }else block?.classList.add('hidden');
  };

  const hideEditorBefore=hideEditorPanel;
  hideEditorPanel=function(){
    document.getElementById('partition-face-system-editor')?.classList.add('hidden');
    return hideEditorBefore();
  };

  const deleteBefore=deleteSelectedObject;
  deleteSelectedObject=function(){
    if(selectedEditable?.type!=='partition') return deleteBefore();
    const index=selectedEditable.index;
    ensurePartitionSpecs();
    state.partitionSpecs.splice(index,1);
    state.interiorDoors.splice(index,1);
    return deleteBefore();
  };

  if(typeof duplicateSelectedPartition==='function'){
    const duplicateBefore=duplicateSelectedPartition;
    window.duplicateSelectedPartition=function(){
      if(selectedEditable?.type!=='partition') return duplicateBefore();
      const source=selectedEditable.index,oldCount=state.counts.partition||0;
      const spec=clone(partitionSpec(source)),door=clone(partitionDoor(source));
      duplicateBefore();
      if((state.counts.partition||0)>oldCount){
        const newIndex=(state.counts.partition||1)-1;
        ensurePartitionSpecs(); state.partitionSpecs[newIndex]=spec; state.interiorDoors[newIndex]=door; renderAll();
      }
    };
  }

  function adjustPartitionBOM(){
    if(typeof buildBOM!=='function'||window.BAT_KUBIQUEITOR_PARTITION_FACE_BOM) return;
    const before=buildBOM;
    buildBOM=function(){
      const items=before();
      ensurePartitionSpecs();
      const s=ensureInteriorSystem();
      const legacyLining=DATA.catalog[s.lining],legacyIns=DATA.catalog[s.insulation];
      let legacyTwoSideArea=0,legacyInsArea=0;
      const liningAreas={},insAreas={};
      let doorCount=0;

      for(let i=0;i<(state.counts.partition||0);i++){
        const d=objectDimensions('partition',i),spec=partitionSpec(i),door=doorRect(i,d);
        const gross=d.length*d.height,opening=door?door.width*door.height:0,net=Math.max(0,gross-opening);
        legacyTwoSideArea+=gross*2; legacyInsArea+=gross;
        liningAreas[spec.face1]=(liningAreas[spec.face1]||0)+net;
        liningAreas[spec.face2]=(liningAreas[spec.face2]||0)+net;
        if(spec.insulationEnabled) insAreas[spec.insulation]=(insAreas[spec.insulation]||0)+net;
        if(door) doorCount++;
      }

      function areaQty(item,area){
        if(!item||area<=0) return 0;
        const raw=(area*1.10)/Math.max(.0001,Number(item.coverage)||1);
        return item.unit==='m²'?Math.ceil(raw*100)/100:Math.ceil(raw);
      }

      const legacyLiningQty=areaQty(legacyLining,legacyTwoSideArea);
      const legacyInsQty=areaQty(legacyIns,legacyInsArea);
      const oldL=items.find(x=>x.key===s.lining);
      if(oldL){oldL.qty=Math.max(0,Number(oldL.qty)-legacyLiningQty);oldL.subtotal=oldL.qty*oldL.unitCost;}
      const oldI=items.find(x=>x.key===s.insulation);
      if(oldI){oldI.qty=Math.max(0,Number(oldI.qty)-legacyInsQty);oldI.subtotal=oldI.qty*oldI.unitCost;}

      Object.entries(liningAreas).forEach(([key,area])=>{
        const item=DATA.catalog[key],qty=areaQty(item,area); if(!qty) return;
        items.push({key:`partition-${key}`,name:`${item.name} · divisiones`,qty,unit:item.unit,unitCost:item.cost,subtotal:qty*item.cost});
      });
      Object.entries(insAreas).forEach(([key,area])=>{
        const item=DATA.catalog[key],qty=areaQty(item,area); if(!qty) return;
        items.push({key:`partition-insulation-${key}`,name:`${item.name} · divisiones`,qty,unit:item.unit,unitCost:item.cost,subtotal:qty*item.cost});
      });
      if(doorCount){
        const item=DATA.catalog.interiorDoor;
        items.push({key:'interiorDoor',name:item.name,qty:doorCount,unit:item.unit,unitCost:item.cost,subtotal:doorCount*item.cost});
      }
      return items.filter(item=>Number(item.qty)>0);
    };
    window.BAT_KUBIQUEITOR_PARTITION_FACE_BOM=true;
  }

  function install(){
    if(!ready()) return false;
    ensurePartitionSpecs();
    adjustPartitionBOM();
    window.partitionSpec=partitionSpec;
    window.partitionDoor=partitionDoor;
    window.BAT_KUBIQUEITOR_PARTITION_FACES={version:1};
    rebuild3D();
    return true;
  }

  if(!install()){
    let tries=0;
    const timer=setInterval(()=>{tries++;if(install()||tries>140) clearInterval(timer);},80);
  }
})();
