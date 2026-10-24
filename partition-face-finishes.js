// Per-partition progressive construction system.
// A partition starts as framing only; insulation and each face lining are added explicitly.
(function(){
  if(window.BAT_KUBIQUEITOR_PARTITION_FACES) return;

  function ready(){
    return typeof THREE!=='undefined'&&typeof state!=='undefined'&&typeof DATA!=='undefined'&&
      typeof actualLayout==='function'&&typeof objectDimensions==='function'&&
      typeof registerEditable==='function'&&typeof addGroup==='function'&&
      typeof ensureInteriorSystem==='function'&&typeof rebuildParametricPartitions==='function'&&
      typeof renderAll==='function'&&typeof mat==='function'&&typeof box==='function';
  }

  const MODEL_VERSION=4;
  const DEFAULT_DOOR={enabled:false,width:.80,height:2.00,offset:0};
  if(!DATA.catalog.interiorDoor) DATA.catalog.interiorDoor={name:'Puerta interior instalada',unit:'unidad',cost:0};

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
  function framingMaterial(key){
    return key==='wood'?mat(0xa66b34,{roughness:.76,metalness:.01}):mat(0xb8c1ca,{roughness:.30,metalness:.72});
  }

  function ensurePartitionSpecs(){
    if(!Array.isArray(state.partitionSpecs)) state.partitionSpecs=[];
    if(!Array.isArray(state.interiorDoors)) state.interiorDoors=[];
    const s=ensureInteriorSystem(),count=state.counts.partition||0;
    for(let i=0;i<count;i++){
      const current=state.partitionSpecs[i]||{};
      const migrated=current.layerModelVersion===MODEL_VERSION;
      state.partitionSpecs[i]={
        layerModelVersion:MODEL_VERSION,
        framing:INTERIOR_SYSTEMS.framing[current.framing]?current.framing:s.framing,
        insulationEnabled:migrated?Boolean(current.insulationEnabled):false,
        insulation:INTERIOR_SYSTEMS.insulation[current.insulation]?current.insulation:s.insulation,
        face1:migrated&&INTERIOR_SYSTEMS.lining[current.face1]?current.face1:null,
        face2:migrated&&INTERIOR_SYSTEMS.lining[current.face2]?current.face2:null
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
  function partitionSpec(index){ensurePartitionSpecs();return state.partitionSpecs[index];}
  function partitionDoor(index){ensurePartitionSpecs();return state.interiorDoors[index];}

  function safeDoor(index,dims){
    const door={...partitionDoor(index)},maxW=Math.max(.60,dims.length-.24),maxH=Math.max(.80,dims.height-.08);
    door.width=Math.min(Math.max(.60,door.width),Math.min(1.20,maxW));
    door.height=Math.min(Math.max(1.70,door.height),Math.min(2.30,maxH));
    const maxOffset=Math.max(0,(dims.length-door.width)/2-.08);
    door.offset=Math.min(maxOffset,Math.max(-maxOffset,door.offset));
    return door;
  }
  function doorRect(index,dims){
    const door=safeDoor(index,dims);if(!door.enabled)return null;
    return{z1:door.offset-door.width/2,z2:door.offset+door.width/2,y1:0,y2:door.height,width:door.width,height:door.height,offset:door.offset};
  }
  function subtractDoor(rect,door){
    if(!door)return[rect];
    const iz1=Math.max(rect.z1,door.z1),iz2=Math.min(rect.z2,door.z2),iy1=Math.max(rect.y1,door.y1),iy2=Math.min(rect.y2,door.y2);
    if(iz1>=iz2||iy1>=iy2)return[rect];
    const out=[];
    if(rect.z1<iz1)out.push({z1:rect.z1,z2:iz1,y1:rect.y1,y2:rect.y2});
    if(iz2<rect.z2)out.push({z1:iz2,z2:rect.z2,y1:rect.y1,y2:rect.y2});
    if(iy2<rect.y2)out.push({z1:iz1,z2:iz2,y1:iy2,y2:rect.y2});
    return out.filter(r=>r.z2-r.z1>.035&&r.y2-r.y1>.035);
  }
  function addLayerSegments(group,length,height,x,thickness,material,door,name,faceCode){
    const rect={z1:-length/2,z2:length/2,y1:0,y2:height};
    subtractDoor(rect,door).forEach(r=>{
      const mesh=box(thickness,r.y2-r.y1,r.z2-r.z1,material,x,(r.y1+r.y2)/2,(r.z1+r.z2)/2);
      mesh.name=name;mesh.userData.partitionFace=faceCode;group.add(mesh);
    });
  }

  function addFraming(group,index,dims,door){
    const spec=partitionSpec(index),material=framingMaterial(spec.framing),studFace=spec.framing==='wood'?.05:.04,depth=Math.max(.04,dims.thickness-.026),half=dims.length/2;
    group.add(box(depth,studFace,dims.length,material,0,studFace/2,0));
    group.add(box(depth,studFace,dims.length,material,0,dims.height-studFace/2,0));
    const blocked=z=>door&&z>door.z1-studFace&&z<door.z2+studFace;
    for(let z=-half;z<=half+.001;z+=.60){const p=Math.min(z,half);if(!blocked(p))group.add(box(depth,dims.height-studFace*2,studFace,material,0,dims.height/2,p));}
    if(door){
      const left=door.z1-studFace/2,right=door.z2+studFace/2;
      group.add(box(depth,dims.height-studFace*2,studFace,material,0,dims.height/2,left));
      group.add(box(depth,dims.height-studFace*2,studFace,material,0,dims.height/2,right));
      if(door.y2<dims.height-.05)group.add(box(depth,studFace,door.width+studFace*2,material,0,door.y2+studFace/2,door.offset));
    }
  }
  function addInsulation(group,index,dims,door){
    const spec=partitionSpec(index);if(!spec.insulationEnabled)return;
    addLayerSegments(group,dims.length,dims.height,0,Math.max(.018,dims.thickness*.42),insulationMaterial(spec.insulation),door,'partition-insulation',`${index+1}.I`);
  }
  function addDoorObject(group,index,dims,door){
    if(!door)return;
    const frame=mat(0x334155,{roughness:.38,metalness:.55}),leaf=mat(0xb58a67,{roughness:.58,metalness:.02}),handle=mat(0xd1d5db,{roughness:.14,metalness:.9}),jamb=.045;
    group.add(box(dims.thickness+.035,door.height,jamb,frame,0,door.height/2,door.z1));
    group.add(box(dims.thickness+.035,door.height,jamb,frame,0,door.height/2,door.z2));
    group.add(box(dims.thickness+.035,jamb,door.width+jamb*2,frame,0,door.height,door.offset));
    const leafW=Math.max(.20,door.width-.08),leafH=Math.max(.40,door.height-.07),pivot=new THREE.Group();
    pivot.name='interior-door-hinge';pivot.position.set(0,0,door.z1+jamb*.45);pivot.rotation.y=THREE.MathUtils.degToRad(-68);
    const leafMesh=box(.038,leafH,leafW,leaf,.012,leafH/2,leafW/2);leafMesh.name='interior-door-leaf';leafMesh.userData.openAngle=68;pivot.add(leafMesh);
    const knobFront=new THREE.Mesh(new THREE.SphereGeometry(.036,14,10),handle);knobFront.position.set(.038,door.height*.50,leafW*.82);pivot.add(knobFront);
    const knobBack=knobFront.clone();knobBack.position.x=-.014;pivot.add(knobBack);group.add(pivot);
  }

  function createFaceLabel(text,subtitle,color){
    const canvas=document.createElement('canvas');canvas.width=384;canvas.height=170;const ctx=canvas.getContext('2d');
    ctx.fillStyle='rgba(15,23,42,.96)';ctx.beginPath();ctx.roundRect(5,5,374,160,26);ctx.fill();ctx.strokeStyle=color;ctx.lineWidth=8;ctx.stroke();
    ctx.fillStyle=color;ctx.font='900 62px Inter, Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,192,68);
    ctx.fillStyle='#fff';ctx.font='800 24px Inter, Arial';ctx.fillText(subtitle,192,125);
    const texture=new THREE.CanvasTexture(canvas);if('encoding'in texture)texture.encoding=THREE.sRGBEncoding;
    const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:false,depthWrite:false}));
    sprite.scale.set(1.28,.57,1);sprite.renderOrder=9999;sprite.frustumCulled=false;sprite.userData.partitionFaceLabel=text;return sprite;
  }

  function buildPartition(index,dims){
    const spec=partitionSpec(index),door=doorRect(index,dims),group=new THREE.Group();group.name=`partition-${index+1}`;group.userData.partitionNumber=index+1;
    addFraming(group,index,dims,door);addInsulation(group,index,dims,door);
    const liningT=.018,faceOffset=dims.thickness/2+liningT/2+.003;
    if(spec.face1)addLayerSegments(group,dims.length,dims.height,faceOffset,liningT,liningMaterial(spec.face1),door,'partition-lining-face-1',`${index+1}.1`);
    if(spec.face2)addLayerSegments(group,dims.length,dims.height,-faceOffset,liningT,liningMaterial(spec.face2),door,'partition-lining-face-2',`${index+1}.2`);
    addDoorObject(group,index,dims,door);

    // Separate labels longitudinally as well as by face so they never overlap.
    const y=Math.min(dims.height-.12,1.78),zSpread=Math.min(Math.max(.28,dims.length*.24),.72);
    const label1=createFaceLabel(`${index+1}.1`,'CARA 1','#f59e0b');label1.position.set(faceOffset+.16,y,-zSpread);group.add(label1);
    const label2=createFaceLabel(`${index+1}.2`,'CARA 2','#38bdf8');label2.position.set(-faceOffset-.16,y,zSpread);group.add(label2);
    return group;
  }

  rebuildParametricPartitions=function(){
    if(!containerGroup)return;ensurePartitionSpecs();ensureLayoutState();ensureDimensionState();if(typeof normalizeAllPartitionsInsideContainer==='function')normalizeAllPartitionsInsideContainer();
    editableObjects.filter(root=>root.userData.editor?.type==='partition').forEach(disposePartitionRoot);
    editableObjects=editableObjects.filter(root=>root.userData.editor?.type!=='partition');
    for(let i=0;i<(state.counts.partition||0);i++){
      const p=actualLayout('partition',i),d=objectDimensions('partition',i),layout=state.layout.partition[i]||{},axisCenter=Number.isFinite(layout.axisCenter)?layout.axisCenter:0,obj=buildPartition(i,d),y=.08+(d.elevation||0);
      if(p.orientation===PARTITION_ORIENTATION.LONG){addGroup(containerGroup,obj,axisCenter,y,p.z,Math.PI/2);registerEditable(obj,'partition',i,{axis:'z',surface:'floor',orientation:p.orientation});}
      else{addGroup(containerGroup,obj,p.x,y,axisCenter,0);registerEditable(obj,'partition',i,{axis:'x',surface:'floor',orientation:p.orientation});}
    }
    if(selectedEditable?.type==='partition'){
      const root=editableObjects.find(o=>o.userData.editor?.type==='partition'&&o.userData.editor?.index===selectedEditable.index);if(root){addSelectionOutline(root);showEditorPanel(root);}
    }
  };

  const framingOptions=selected=>Object.entries(INTERIOR_SYSTEMS.framing).map(([key,item])=>`<option value="${key}" ${key===selected?'selected':''}>${item.name}</option>`).join('');
  const liningOptions=selected=>`<option value="" ${!selected?'selected':''}>Sin revestimiento</option>`+Object.entries(INTERIOR_SYSTEMS.lining).map(([key,item])=>`<option value="${key}" ${key===selected?'selected':''}>${item.name}</option>`).join('');
  const insulationOptions=selected=>Object.entries(INTERIOR_SYSTEMS.insulation).map(([key,item])=>`<option value="${key}" ${key===selected?'selected':''}>${item.name}</option>`).join('');

  function ensureEditor(){
    const panel=document.getElementById('object-editor');if(!panel)return null;let block=document.getElementById('partition-face-system-editor');if(block)return block;
    block=document.createElement('div');block.id='partition-face-system-editor';block.className='hidden mt-3 rounded-xl border border-white/10 bg-white/5 p-3';
    const deleteBtn=panel.querySelector('button[onclick*="deleteSelectedObject"]');if(deleteBtn)panel.insertBefore(block,deleteBtn);else panel.appendChild(block);
    if(!document.getElementById('partition-face-system-style')){
      const style=document.createElement('style');style.id='partition-face-system-style';style.textContent=`
        .partition-face-card{border:1px solid rgba(255,255,255,.12);background:rgba(15,23,42,.58);border-radius:12px;padding:10px}.partition-face-code{font-weight:950;font-size:14px;color:#fbbf24}.partition-face-code.blue{color:#7dd3fc}.partition-face-select{width:100%;margin-top:7px;background:#0f172a;border:1px solid rgba(255,255,255,.15);border-radius:9px;padding:7px;color:white;font-size:11px;font-weight:700}.partition-switch{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 10px;border-radius:10px;background:rgba(255,255,255,.05);font-size:11px;font-weight:800}.partition-system-label{font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8;font-weight:900;margin-top:10px}.partition-door-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.partition-door-grid label{font-size:9px;color:#94a3b8;font-weight:800}.partition-door-grid input{width:100%;margin-top:4px;background:#0f172a;border:1px solid rgba(255,255,255,.14);border-radius:8px;padding:6px;color:#fff;font-size:11px}.partition-construction-note{margin-top:8px;padding:8px 9px;border:1px solid rgba(56,189,248,.18);background:rgba(14,165,233,.07);border-radius:9px;color:#bae6fd;font-size:9px;line-height:1.4}`;document.head.appendChild(style);
    }
    return block;
  }

  window.setPartitionFraming=function(index,key){if(!INTERIOR_SYSTEMS.framing[key])return;pushHistory();partitionSpec(index).framing=key;renderAll();toast(`Tabique ${index+1}: ${INTERIOR_SYSTEMS.framing[key].name}`);};
  window.setPartitionFaceLining=function(index,side,key){
    if(key&& !INTERIOR_SYSTEMS.lining[key])return;pushHistory();const spec=partitionSpec(index);if(side===1)spec.face1=key||null;else spec.face2=key||null;renderAll();toast(key?`Tabique ${index+1}.${side}: ${INTERIOR_SYSTEMS.lining[key].name}`:`Tabique ${index+1}.${side}: sin revestimiento`);
  };
  window.togglePartitionInsulation=function(index){pushHistory();const spec=partitionSpec(index);spec.insulationEnabled=!spec.insulationEnabled;renderAll();toast(spec.insulationEnabled?`Aislación activada en Tabique ${index+1}`:`Tabique ${index+1} sin aislación`);};
  window.setPartitionInsulation=function(index,key){if(!INTERIOR_SYSTEMS.insulation[key])return;pushHistory();partitionSpec(index).insulation=key;renderAll();};
  window.togglePartitionInteriorDoor=function(index){pushHistory();const door=partitionDoor(index);door.enabled=!door.enabled;renderAll();toast(door.enabled?`Puerta interior agregada al Tabique ${index+1}`:`Puerta interior retirada del Tabique ${index+1}`);};
  window.updatePartitionInteriorDoor=function(index,key,value){const parsed=Number(value);if(!Number.isFinite(parsed))return;pushHistory();const door=partitionDoor(index),dims=objectDimensions('partition',index);if(key==='width')door.width=clamp(parsed,.60,Math.min(1.20,dims.length-.24));else if(key==='height')door.height=clamp(parsed,1.70,Math.min(2.30,dims.height-.08));else if(key==='offset'){const max=Math.max(0,(dims.length-door.width)/2-.08);door.offset=clamp(parsed,-max,max);}renderAll();};

  function renderEditor(index){
    const block=ensureEditor();if(!block)return;const spec=partitionSpec(index),door=safeDoor(index,objectDimensions('partition',index)),number=index+1;block.classList.remove('hidden');
    block.innerHTML=`
      <div class="text-[10px] uppercase tracking-widest text-slate-400 font-black">Tabique ${number} · sistema constructivo</div>
      <div class="partition-construction-note"><b>Secuencia:</b> primero estructura; después aislación y revestimientos según corresponda.</div>
      <div class="partition-system-label">1 · Tabiquería interior</div>
      <select class="partition-face-select" onchange="setPartitionFraming(${index},this.value)">${framingOptions(spec.framing)}</select>
      <div class="partition-system-label">2 · Aislación opcional</div>
      <div class="partition-switch"><span><i class="fa-solid fa-temperature-half mr-1 text-sky-300"></i>${spec.insulationEnabled?INTERIOR_SYSTEMS.insulation[spec.insulation].name:'Sin aislación'}</span><button type="button" onclick="togglePartitionInsulation(${index})" class="rounded-lg px-2 py-1 ${spec.insulationEnabled?'bg-emerald-500 text-slate-950':'bg-white/10 text-slate-300'}">${spec.insulationEnabled?'Sí':'No'}</button></div>
      ${spec.insulationEnabled?`<select class="partition-face-select" onchange="setPartitionInsulation(${index},this.value)">${insulationOptions(spec.insulation)}</select>`:''}
      <div class="partition-system-label">3 · Revestimiento por cara</div>
      <div class="grid grid-cols-2 gap-2 mt-2">
        <div class="partition-face-card"><div class="partition-face-code">${number}.1</div><div class="text-[9px] text-slate-400">Cara 1</div><select class="partition-face-select" onchange="setPartitionFaceLining(${index},1,this.value)">${liningOptions(spec.face1)}</select></div>
        <div class="partition-face-card"><div class="partition-face-code blue">${number}.2</div><div class="text-[9px] text-slate-400">Cara 2</div><select class="partition-face-select" onchange="setPartitionFaceLining(${index},2,this.value)">${liningOptions(spec.face2)}</select></div>
      </div>
      <div class="partition-system-label">4 · Abertura</div>
      <div class="partition-switch"><span><i class="fa-solid fa-door-open mr-1 text-amber-300"></i>Puerta interior</span><button type="button" onclick="togglePartitionInteriorDoor(${index})" class="rounded-lg px-2 py-1 ${door.enabled?'bg-amber-500 text-slate-950':'bg-white/10 text-slate-300'}">${door.enabled?'Instalada':'Sin puerta'}</button></div>
      ${door.enabled?`<div class="partition-door-grid mt-2"><label>Ancho<input type="number" min=".60" max="1.20" step=".05" value="${door.width.toFixed(2)}" onchange="updatePartitionInteriorDoor(${index},'width',this.value)"></label><label>Alto<input type="number" min="1.70" max="2.30" step=".05" value="${door.height.toFixed(2)}" onchange="updatePartitionInteriorDoor(${index},'height',this.value)"></label><label>Posición<input type="number" step=".05" value="${door.offset.toFixed(2)}" onchange="updatePartitionInteriorDoor(${index},'offset',this.value)"></label></div>`:''}`;
  }

  const showEditorBefore=showEditorPanel;
  showEditorPanel=function(root){showEditorBefore(root);const block=ensureEditor();if(root?.userData.editor?.type==='partition'){const index=root.userData.editor.index;renderEditor(index);const title=document.getElementById('editor-title');if(title)title.textContent=`Tabique ${index+1}`;}else block?.classList.add('hidden');};
  const hideEditorBefore=hideEditorPanel;hideEditorPanel=function(){document.getElementById('partition-face-system-editor')?.classList.add('hidden');return hideEditorBefore();};
  const deleteBefore=deleteSelectedObject;deleteSelectedObject=function(){if(selectedEditable?.type!=='partition')return deleteBefore();const index=selectedEditable.index;ensurePartitionSpecs();state.partitionSpecs.splice(index,1);state.interiorDoors.splice(index,1);return deleteBefore();};

  if(typeof duplicateSelectedPartition==='function'){
    const duplicateBefore=duplicateSelectedPartition;
    window.duplicateSelectedPartition=function(){if(selectedEditable?.type!=='partition')return duplicateBefore();const source=selectedEditable.index,oldCount=state.counts.partition||0,spec=clone(partitionSpec(source)),door=clone(partitionDoor(source));duplicateBefore();if((state.counts.partition||0)>oldCount){const newIndex=(state.counts.partition||1)-1;ensurePartitionSpecs();state.partitionSpecs[newIndex]=spec;state.interiorDoors[newIndex]=door;renderAll();}};
  }

  function adjustPartitionBOM(){
    if(typeof buildBOM!=='function'||window.BAT_KUBIQUEITOR_PARTITION_FACE_BOM)return;
    const before=buildBOM;
    buildBOM=function(){
      const items=before();ensurePartitionSpecs();const s=ensureInteriorSystem(),c=DATA.containers[state.container],legacyLining=DATA.catalog[s.lining],legacyIns=DATA.catalog[s.insulation];
      let legacyTwoSideArea=0,legacyInsArea=0,totalLength=0,doorCount=0,metalStudLinear=0,metalTrackLinear=0,woodLinear=0;
      const liningAreas={},insAreas={};
      for(let i=0;i<(state.counts.partition||0);i++){
        const d=objectDimensions('partition',i),spec=partitionSpec(i),door=doorRect(i,d),gross=d.length*d.height,opening=door?door.width*door.height:0,net=Math.max(0,gross-opening);
        legacyTwoSideArea+=gross*2;legacyInsArea+=gross;totalLength+=d.length;
        if(spec.face1)liningAreas[spec.face1]=(liningAreas[spec.face1]||0)+net;
        if(spec.face2)liningAreas[spec.face2]=(liningAreas[spec.face2]||0)+net;
        if(spec.insulationEnabled)insAreas[spec.insulation]=(insAreas[spec.insulation]||0)+net;
        if(door)doorCount++;
        let studs=(Math.ceil(d.length/.60)+1)*d.height,tracks=d.length*2;if(door)studs+=2*d.height+door.width;
        if(spec.framing==='wood')woodLinear+=studs+tracks;else{metalStudLinear+=studs;metalTrackLinear+=tracks;}
      }
      function areaQty(item,area){if(!item||area<=0)return 0;const raw=(area*1.10)/Math.max(.0001,Number(item.coverage)||1);return item.unit==='m²'?Math.ceil(raw*100)/100:Math.ceil(raw);}
      function reduceItem(key,qty){const item=items.find(x=>x.key===key);if(!item||qty<=0)return;item.qty=Math.max(0,Number(item.qty)-qty);item.subtotal=item.qty*item.unitCost;}

      // Legacy wall engine only included partition linings/insulation when its old global switch was active.
      if(s.partitions){reduceItem(s.lining,areaQty(legacyLining,legacyTwoSideArea));reduceItem(s.insulation,areaQty(legacyIns,legacyInsArea));}
      const legacyStudLinear=(Math.ceil(totalLength/.60)+(state.counts.partition||0))*c.height,legacyTrackLinear=totalLength*2;
      if(s.framing==='wood')reduceItem('woodFrame',Math.ceil((legacyStudLinear+legacyTrackLinear)*100)/100);else{reduceItem('stud',Math.ceil(legacyStudLinear/3));reduceItem('track',Math.ceil(legacyTrackLinear/3));}

      Object.entries(liningAreas).forEach(([key,area])=>{const item=DATA.catalog[key],qty=areaQty(item,area);if(qty)items.push({key:`partition-${key}`,name:`${item.name} · divisiones`,qty,unit:item.unit,unitCost:item.cost,subtotal:qty*item.cost,category:'Tabiquería'});});
      Object.entries(insAreas).forEach(([key,area])=>{const item=DATA.catalog[key],qty=areaQty(item,area);if(qty)items.push({key:`partition-insulation-${key}`,name:`${item.name} · divisiones`,qty,unit:item.unit,unitCost:item.cost,subtotal:qty*item.cost,category:'Tabiquería'});});
      if(metalStudLinear>0){const item=DATA.catalog.stud,qty=Math.ceil(metalStudLinear/3);items.push({key:'partition-stud',name:`${item.name} · divisiones`,qty,unit:item.unit,unitCost:item.cost,subtotal:qty*item.cost,category:'Tabiquería'});}
      if(metalTrackLinear>0){const item=DATA.catalog.track,qty=Math.ceil(metalTrackLinear/3);items.push({key:'partition-track',name:`${item.name} · divisiones`,qty,unit:item.unit,unitCost:item.cost,subtotal:qty*item.cost,category:'Tabiquería'});}
      if(woodLinear>0){const item=DATA.catalog.woodFrame,qty=Math.ceil(woodLinear*100)/100;items.push({key:'partition-woodFrame',name:`${item.name} · divisiones`,qty,unit:item.unit,unitCost:item.cost,subtotal:qty*item.cost,category:'Tabiquería'});}
      if(doorCount){const item=DATA.catalog.interiorDoor;items.push({key:'interiorDoor',name:item.name,qty:doorCount,unit:item.unit,unitCost:item.cost,subtotal:doorCount*item.cost,category:'Puertas'});}
      return items.filter(item=>Number(item.qty)>0);
    };
    window.BAT_KUBIQUEITOR_PARTITION_FACE_BOM=true;
  }

  function install(){
    if(!ready())return false;ensurePartitionSpecs();adjustPartitionBOM();window.partitionSpec=partitionSpec;window.partitionDoor=partitionDoor;window.BAT_KUBIQUEITOR_PARTITION_FACES={version:MODEL_VERSION};rebuild3D();return true;
  }
  if(!install()){let tries=0;const timer=setInterval(()=>{tries++;if(install()||tries>140)clearInterval(timer);},80);}
})();