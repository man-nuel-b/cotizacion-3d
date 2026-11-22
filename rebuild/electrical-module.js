import * as THREE from 'three';
import { ELECTRICAL_PROFILES, ELECTRICAL_POINT_SIZES, defaultElectricalConfig,
  sanitizeElectricalConfig, validateElectricalPoint, electricalPointWorld, snapElectricalCoordinate } from './electrical-project-config.js?v=4.19';
export { ELECTRICAL_PROFILES, defaultElectricalConfig, sanitizeElectricalConfig } from './electrical-project-config.js?v=4.19';

// Estimador paramétrico preliminar: no sustituye proyecto SEC ni cálculo de cargas.
export const DEFAULT_ELECTRICAL_PRICES = Object.freeze({
  board_kit:45000,outlet_point:12500,light_point:14000,switch_point:11000,
  conduit_meter:1800,cable_meter:1450,labor_hour:18000
});
const number = (v, fallback, min, max) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};
export function calculateElectricalTakeoff(params, prices={}) {
  const width=number(params.width,3,1,200), length=number(params.length,4,1,300);
  const height=number(params.wallHeight,2.6,2,25), rooms=Math.round(number(params.rooms,1,1,200));
  const profile=ELECTRICAL_PROFILES[params.profile] || ELECTRICAL_PROFILES.estandar;
  const p=Object.fromEntries(Object.keys(DEFAULT_ELECTRICAL_PRICES).map(k=>[k,number(prices[k],DEFAULT_ELECTRICAL_PRICES[k],0,1e9)]));
  const outlets=rooms*profile.outletsPerRoom,lights=rooms*profile.lightsPerRoom,switches=rooms*profile.switchesPerRoom;
  const totalPoints=outlets+lights+switches, drop=Math.max(1.1,height-.3);
  const baseRun=2*(width+length)*.85+totalPoints*drop*.6;
  const conduitMeters=Number((baseRun*1.1).toFixed(1));
  const cableMeters=Number((baseRun*profile.cableFactor*profile.circuits*.5).toFixed(1));
  const rows=[
    ['EL-TAB','Tablero y protecciones (base)','un',1,'board_kit'],
    ['EL-ENCH','Punto de enchufe (referencial)','pto',outlets,'outlet_point'],
    ['EL-LUMI','Punto de iluminación (referencial)','pto',lights,'light_point'],
    ['EL-INT','Punto interruptor (referencial)','pto',switches,'switch_point'],
    ['EL-COND','Canalización estimada','m',conduitMeters,'conduit_meter'],
    ['EL-CABL','Conductores estimados','m',cableMeters,'cable_meter']
  ];
  const bom=rows.map(([code,name,unit,qty,priceKey])=>({code,name,unit,qty,unitPrice:p[priceKey],subtotal:Math.round(qty*p[priceKey])}));
  const materialsNet=bom.reduce((a,b)=>a+b.subtotal,0);
  const laborHours=Number((totalPoints*profile.laborHoursPerPoint+2.5).toFixed(1));
  const laborNet=Math.round(laborHours*p.labor_hour);
  return {profile:profile.label,summary:{circuits:profile.circuits,outlets,lights,switches,totalPoints,conduitMeters,cableMeters,laborHours},
    bom,apu:{materialsNet,laborHours,laborNet,totalNet:materialsNet+laborNet},
    warning:'Estimación preliminar, sin validación normativa, cargas, secciones, trazado real ni IVA. Revisar solapamiento entre kits por punto y metrados independientes antes de cotizar.'};
}
function instances(geometry,material,points) {
  if (!points.length) return null;
  const mesh=new THREE.InstancedMesh(geometry,material,points.length);
  const dummy=new THREE.Object3D();
  points.forEach((pos,i)=>{dummy.position.set(...pos);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});
  mesh.instanceMatrix.needsUpdate=true;mesh.frustumCulled=false;
  return mesh;
}
export function buildElectrical3DGroup(params) {
  const width=number(params.width,3,1,200),length=number(params.length,4,1,300);
  const height=number(params.wallHeight,2.6,2,25),rooms=Math.round(number(params.rooms,1,1,200));
  const floor=number(params.floor,0,0,2), p=ELECTRICAL_PROFILES[params.profile]||ELECTRICAL_PROFILES.estandar;
  const group=new THREE.Group();group.name='electrical_layer';
  const clearance=.10;
  const board=new THREE.Mesh(new THREE.BoxGeometry(.35,.45,.06),new THREE.MeshStandardMaterial({color:0xd97706}));
  // Tablero automático adosado a la cara C, alejado del esquinero ISO.
  // La mitad del ancho (0.175 m) ya no atraviesa el extremo x=-L/2.
  board.position.set(-length/2+0.48,floor+Math.min(1.5,height-0.35),-width/2+Math.max(clearance,0.08));
  group.add(board);
  const lightCount=rooms*p.lightsPerRoom;
  const lights=instances(new THREE.BoxGeometry(.38,.045,.18),new THREE.MeshStandardMaterial({color:0xffe8a5,emissive:0xffbb33,emissiveIntensity:.22}),
    Array.from({length:lightCount},(_,i)=>[-length/2+(i+.5)/lightCount*length,floor+height-.08,0]));
  if(lights)group.add(lights);
  const outletCount=rooms*p.outletsPerRoom;
  const outlets=instances(new THREE.BoxGeometry(.05,.12,.12),new THREE.MeshStandardMaterial({color:0x38bdf8}),
    Array.from({length:outletCount},(_,i)=>[-length/2+((Math.floor(i/2)+.5)/Math.ceil(outletCount/2))*length,floor+.4,(i%2?1:-1)*(width/2-clearance)]));
  if(outlets)group.add(outlets);
  const switchCount=rooms*p.switchesPerRoom;
  const switches=instances(new THREE.BoxGeometry(.05,.11,.09),new THREE.MeshStandardMaterial({color:0x7dd3a7}),
    Array.from({length:switchCount},(_,i)=>[-length/2+(i+.5)/switchCount*length,floor+1.1,-width/2+clearance]));
  if(switches)group.add(switches);
  return group;
}
export function disposeElectricalGroup(group) {
  if(!group)return;
  group.traverse(obj=>{if(obj.isMesh){obj.geometry?.dispose();if(Array.isArray(obj.material))obj.material.forEach(m=>m.dispose());else obj.material?.dispose();}});
}
export function installElectricalUI({scene,state,FLOOR,camera,renderer,controls}) {
  const $=id=>document.getElementById(id);
  if(!$('electrical-tools'))return ()=>{};
  const profile=$('electric-profile'),rooms=$('electric-rooms'),toggle=$('electric-show');
  const summary=$('electric-summary'),cost=$('electric-cost'),notice=$('electric-notice'),bom=$('electric-bom');
  const manualType=$('electric-manual-type'),place=$('electric-place'),cancel=$('electric-cancel');
  const mountSelect=$('electric-mount'),faceSelect=$('electric-face'),partitionSelect=$('electric-partition');
  const uInput=$('electric-u-mm'),vInput=$('electric-v-mm'),snapSelect=$('electric-snap-mm');
  const exactSave=$('electric-apply-exact'),duplicate=$('electric-duplicate'),cancelEdit=$('electric-cancel-edit');
  const status=$('electric-placement-status'),manualList=$('electric-manual-list'),clear=$('electric-clear-manual');
  const canvas=renderer.domElement;
  const formatter=new Intl.NumberFormat('es-CL',{maximumFractionDigits:0});
  const labels={outlet:'Enchufe',switch:'Interruptor',light:'Luminaria',board:'Tablero'};
  const codes={outlet:'EL-ENCH',switch:'EL-INT',light:'EL-LUMI',board:'EL-TAB'};
  const counter={outlet:'outlets',switch:'switches',light:'lights'};
  const limits={outlet:[.11,.12],switch:[.11,.12],light:[.35,.15],board:[.35,.45]};
  let signature='',layer=null,manualLayer=null,points=[],nextId=1,active=null,down=null,originalControls=true,editingId=null,ghost=null;
  let loadedConfig=null;
  function loadConfig() {
    const conf=state.electrical??defaultElectricalConfig();
    if(conf===loadedConfig)return;
    profile.value=conf.profile||'estandar';
    rooms.value=conf.rooms||1;
    toggle.checked=conf.show!==false;
    points=Array.isArray(conf.points)?conf.points.map(p=>({...p})):[];
    nextId=Math.max(0,...points.map(p=>Number(String(p.id).replace(/^el-/,'')).valueOf()||0))+1;
    if(editingId&&!points.some(p=>p.id===editingId))editingId=null;
    loadedConfig=conf;
    signature='';
  }
  function saveConfig() {
    const count=Number(rooms.value);
    if(!Number.isInteger(count)||count<1||count>200)return;
    state.electrical={profile:profile.value,rooms:count,show:toggle.checked,
      points:points.map(p=>({...p}))};
    loadedConfig=state.electrical;
  }
  const params=()=>({width:state.W,length:state.L,wallHeight:state.H,rooms:rooms.value,profile:profile.value,floor:FLOOR});
  const position=p=>electricalPointWorld(p,state,FLOOR);
  const bounds=p=>!validateElectricalPoint(p,state,state.openings||[],
    state.partitions||[],[],state.interiorDoors||[]);
  const collisions=p=>Boolean(validateElectricalPoint(p,state,state.openings||[],
    state.partitions||[],points.filter(q=>q.id!==p.id),state.interiorDoors||[]));
  function addManualLayer() {
    if(manualLayer){scene.remove(manualLayer);disposeElectricalGroup(manualLayer);}
    manualLayer=new THREE.Group();
    manualLayer.name='manual_electrical_layer';
    const colors={outlet:0x38bdf8,switch:0x7dd3a7,light:0xffe08a,board:0xf59e0b};
    for(const p of points){
      const [w,h]=limits[p.type], depth=.06,ceiling=(p.mount==='ceiling');
      const geometry=new THREE.BoxGeometry(w,ceiling ? .045 : h,ceiling ? h : depth);
      const material=new THREE.MeshStandardMaterial({color:colors[p.type],emissive:p.type==='light'?0x775500:0,emissiveIntensity:.2});
      const mesh=new THREE.Mesh(geometry,material);
      const pos=position(p);if(!pos){geometry.dispose();material.dispose();continue;}
      mesh.position.set(...pos);
      const host=p.mount==='partition'?(state.partitions||[]).find(x=>x.id===p.partitionId):null;
      if((p.mount==='wall'||!p.mount)&&(p.face==='B'||p.face==='D')||
         (p.mount==='partition'&&host?.axis==='z'))mesh.rotation.y=Math.PI/2;
      mesh.name='electrical_'+p.id;
      mesh.userData.electricalPointId=p.id;
      manualLayer.add(mesh);
    }
    manualLayer.visible=toggle.checked;
    scene.add(manualLayer);
  }
  function setMode(id=null) {
    if(active)leaveMode();
    if(mountSelect.value==='partition'&&!partitionSelect.value){
      status.textContent='Primero selecciona un tabique interior.';return;
    }
    if(mountSelect.value==='ceiling'&&manualType.value!=='light'){
      status.textContent='En cielo solo se permiten luminarias.';return;
    }
    active={id,type:id?points.find(p=>p.id===id)?.type:manualType.value,mount:mountSelect.value};
    if(!active.type){active=null;return;}
    originalControls=controls.enabled;controls.enabled=false;
    place.textContent=id?'Mover punto seleccionado':'Ubicando punto…';
    cancel.hidden=false;
    status.textContent='Haz clic o arrastra sobre la superficie. Vista previa verde: válido; roja: conflicto. Esc cancela.';
    canvas.style.cursor='crosshair';
  }
  function leaveMode() {
    if(!active)return;
    active=null;down=null;controls.enabled=originalControls;
    place.textContent='Ubicar/arrastrar en 3D';cancel.hidden=true;
    canvas.style.cursor='';
    if(ghost){scene.remove(ghost);ghost.geometry.dispose();ghost.material.dispose();ghost=null;}
  }
  function syncMountControls(){
    const mount=mountSelect.value;
    $('electric-partition-label').hidden=mount!=='partition';
    $('electric-face-label').hidden=mount==='ceiling';
    const oldFace=faceSelect.value,faces=mount==='partition'?['A','B']:['A','B','C','D'];
    faceSelect.replaceChildren(...faces.map(face=>new Option('Cara '+face,face)));
    if(faces.includes(oldFace))faceSelect.value=oldFace;
    $('electric-v-label').firstChild.textContent=mount==='ceiling'
      ?'Distancia V desde el lateral (mm)':'Altura desde el piso terminado (mm)';
    const oldPartition=partitionSelect.value;
    partitionSelect.replaceChildren(...(state.partitions||[]).map(p=>
      new Option(p.id+' · eje '+p.axis.toUpperCase()+' · '+p.length.toFixed(2)+' m',p.id)));
    if((state.partitions||[]).some(p=>p.id===oldPartition))partitionSelect.value=oldPartition;
    if(mount==='ceiling'&&manualType.value!=='light'){
      manualType.value='light';
      status.textContent='El cielo admite únicamente luminarias.';
    }
  }
  function showPointInForm(p){
    editingId=p.id;manualType.value=p.type;
    mountSelect.value=p.mount||'wall';syncMountControls();
    if(p.mount!=='ceiling')faceSelect.value=p.face;
    if(p.mount==='partition')partitionSelect.value=p.partitionId;
    uInput.value=String(Math.round(p.u*1000));vInput.value=String(Math.round(p.v*1000));
    exactSave.textContent='Guardar cambios de '+p.id;
    duplicate.disabled=false;cancelEdit.hidden=false;
    status.textContent='Editando '+labels[p.type]+' '+p.id+'. Ajusta U y V en mm y guarda.';
  }
  function stopEdit(){
    editingId=null;exactSave.textContent='Guardar coordenadas exactas';
    duplicate.disabled=true;cancelEdit.hidden=true;
  }
  function savePoint(candidate,message){
    const draft=editingId&&candidate.id===editingId
      ?points.map(p=>p.id===editingId?candidate:p):[...points,candidate];
    let checked;
    try{
      checked=sanitizeElectricalConfig({profile:profile.value,rooms:Number(rooms.value),
        show:toggle.checked,points:draft},state,state.openings||[],
        state.partitions||[],state.interiorDoors||[]);
    }catch(error){status.textContent=error.message;return false;}
    points=checked.points;
    nextId=Math.max(nextId,Number(candidate.id.replace(/^el-/,''))+1);
    stopEdit();saveConfig();signature='';update();status.textContent=message;
    return true;
  }
  function formCandidate(){
    if(!uInput.value.trim()||!vInput.value.trim())throw Error('Escribe U y V en milímetros.');
    const mount=mountSelect.value;
    const point={id:editingId||'el-'+nextId,type:manualType.value,
      mount,face:mount==='ceiling'?'roof':faceSelect.value,
      u:Number(uInput.value)/1000,v:Number(vInput.value)/1000};
    if(mount==='partition')point.partitionId=partitionSelect.value;
    return point;
  }
  function raySurface(event){
    const rect=canvas.getBoundingClientRect();
    if(!rect.width||!rect.height)return null;
    const ndc=new THREE.Vector2(((event.clientX-rect.left)/rect.width)*2-1,
      -((event.clientY-rect.top)/rect.height)*2+1);
    const raycaster=new THREE.Raycaster();raycaster.setFromCamera(ndc,camera);
    const ray=raycaster.ray,candidates=[],mount=active?.mount||mountSelect.value;
    const hitPlane=(axis,value,fn)=>{
      const dir=ray.direction[axis];if(Math.abs(dir)<1e-8)return;
      const t=(value-ray.origin[axis])/dir;if(t<=0)return;
      const pt=ray.at(t,new THREE.Vector3()),hit=fn(pt);
      if(hit)candidates.push({...hit,t});
    };
    if(mount==='wall'){
      for(const [face,axis,value] of [
        ['A','z',state.W/2-.08],['B','x',state.L/2-.08],
        ['C','z',-state.W/2+.08],['D','x',-state.L/2+.08]
      ])hitPlane(axis,value,pt=>{
        const along=face==='A'?pt.x:face==='B'?-pt.z:face==='C'?-pt.x:pt.z;
        const span=(face==='A'||face==='C')?state.L:state.W;
        if(Math.abs(along)>span/2||pt.y<FLOOR||pt.y>FLOOR+state.H)return null;
        return {mount:'wall',face,u:along+span/2,v:pt.y-FLOOR};
      });
    }else if(mount==='partition'){
      const p=(state.partitions||[]).find(x=>x.id===partitionSelect.value);
      if(!p)return null;
      const side=faceSelect.value==='A'?1:-1;
      const axis=p.axis==='x'?'z':'x',center=p.axis==='x'?p.cz:p.cx;
      hitPlane(axis,center+side*(p.thickness/2+.02),pt=>{
        const along=(p.axis==='x'?pt.x-p.cx:pt.z-p.cz)+p.length/2;
        if(along<0||along>p.length||pt.y<FLOOR||pt.y>FLOOR+p.height)return null;
        return {mount:'partition',partitionId:p.id,face:faceSelect.value,u:along,v:pt.y-FLOOR};
      });
    }else if(mount==='ceiling'){
      hitPlane('y',FLOOR+state.H-.055,pt=>{
        if(Math.abs(pt.x)>state.L/2||Math.abs(pt.z)>state.W/2)return null;
        return {mount:'ceiling',face:'roof',u:pt.x+state.L/2,v:pt.z+state.W/2};
      });
    }
    candidates.sort((a,b)=>a.t-b.t);
    return candidates[0]||null;
  }
  function disposePreview(){
    if(!ghost)return;
    scene.remove(ghost);ghost.geometry.dispose();ghost.material.dispose();ghost=null;
  }
  function pointerCandidate(event){
    if(!active)return null;
    const hit=raySurface(event);
    if(!hit){disposePreview();return null;}
    const step=Number(snapSelect.value);
    let point;
    try{
      point={id:active.id||'el-'+nextId,type:active.type,mount:hit.mount,face:hit.face,
        u:snapElectricalCoordinate(hit.u,step),v:snapElectricalCoordinate(hit.v,step)};
    }catch{return null;}
    if(hit.partitionId)point.partitionId=hit.partitionId;
    const issue=validateElectricalPoint(point,state,state.openings||[],state.partitions||[],
      points.filter(p=>p.id!==point.id),state.interiorDoors||[]);
    const pos=position(point);
    if(pos){
      if(!ghost){
        ghost=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),
          new THREE.MeshBasicMaterial({color:0x00b981,transparent:true,opacity:.62,depthTest:false}));
        ghost.renderOrder=100;ghost.name='electrical_precision_preview';scene.add(ghost);
      }
      const [w,h]=limits[point.type],ceiling=point.mount==='ceiling';
      ghost.scale.set(w,ceiling ? .045 : h,ceiling ? h : .06);
      ghost.position.set(...pos);ghost.rotation.set(0,0,0);
      const host=point.mount==='partition'?(state.partitions||[]).find(p=>p.id===point.partitionId):null;
      if((point.mount==='wall'&&(point.face==='B'||point.face==='D'))||
         (point.mount==='partition'&&host?.axis==='z'))ghost.rotation.y=Math.PI/2;
      ghost.material.color.setHex(issue?0xff4757:0x00b981);
    }
    return {point,issue};
  }
  function renderManualList() {
    manualList.replaceChildren();
    for(const p of points){
      const div=document.createElement('div');div.className='entry';
      const label=document.createElement('span');
      const host=p.mount==='partition'?'tabique '+p.partitionId+' lado '+p.face:
        p.mount==='ceiling'?'cielo':'muro '+p.face;
      label.textContent=labels[p.type]+' '+p.id+' · '+host+
        ' · U '+Math.round(p.u*1000)+' mm / V '+Math.round(p.v*1000)+' mm';
      const edit=document.createElement('button');edit.textContent='Editar';edit.type='button';
      edit.addEventListener('click',()=>{leaveMode();showPointInForm(p);});
      const move=document.createElement('button');move.textContent='Mover 3D';move.type='button';
      move.addEventListener('click',()=>{showPointInForm(p);setMode(p.id);});
      const remove=document.createElement('button');remove.textContent='Quitar';remove.type='button';
      remove.className='alt';
      remove.addEventListener('click',()=>{
        if(active?.id===p.id)leaveMode();
        if(editingId===p.id)stopEdit();
        points=points.filter(x=>x.id!==p.id);
        saveConfig();signature='';update();
        status.textContent='Punto '+p.id+' eliminado.';
      });
      div.append(label,edit,move,remove);manualList.append(div);
    }
  }
  function update(){
    loadConfig();
    // Nunca borrar silenciosamente puntos: el motor impide modificaciones incompatibles.
    const current=JSON.stringify([state.L,state.W,state.H,state.type,
      state.openings,state.partitions,state.interiorDoors,rooms.value,profile.value,points]);
    if(current===signature)return;
    signature=current;
    try{sanitizeElectricalConfig(state.electrical,state,state.openings||[],
      state.partitions||[],state.interiorDoors||[]);}
    catch(error){status.textContent='Revisar punto eléctrico: '+error.message;}
    syncMountControls();
    const data=calculateElectricalTakeoff(params());
    const replacement=buildElectrical3DGroup(params());
    // Al existir puntos precisos, ocultar las sugerencias 3D automáticas para no aparentar ubicaciones contratadas.
    replacement.visible=toggle.checked&&points.length===0;scene.add(replacement);
    if(layer){scene.remove(layer);disposeElectricalGroup(layer);}
    layer=replacement;
    addManualLayer();
    const manualCounts={outlet:0,switch:0,light:0,board:0};
    points.forEach(p=>manualCounts[p.type]++);
    for(const item of data.bom){
      const type=Object.keys(codes).find(k=>codes[k]===item.code);
      if(!type)continue;
      const more=manualCounts[type];
      item.qty+=more;
      item.subtotal=Math.round(item.qty*item.unitPrice);
    }
    const materialsNet=data.bom.reduce((a,i)=>a+i.subtotal,0);
    const manualPoints=manualCounts.outlet+manualCounts.switch+manualCounts.light;
    const laborHours=Number((data.apu.laborHours+manualPoints*(ELECTRICAL_PROFILES[profile.value]||ELECTRICAL_PROFILES.estandar).laborHoursPerPoint+manualCounts.board*2.5).toFixed(1));
    const laborPrice=DEFAULT_ELECTRICAL_PRICES.labor_hour;
    const laborNet=Math.round(laborHours*laborPrice);
    summary.textContent=`${data.summary.outlets+manualCounts.outlet} enchufes · ${data.summary.lights+manualCounts.light} luces · ${data.summary.switches+manualCounts.switch} interruptores · ${data.summary.circuits} circuitos estimados (${points.length} puntos manuales)`;
    cost.textContent=`Materiales: $${formatter.format(materialsNet)} · Mano de obra: $${formatter.format(laborNet)} · Total neto estimado: $${formatter.format(materialsNet+laborNet)} CLP`;
    bom.replaceChildren(...data.bom.map(item=>{
      const tr=document.createElement('tr');
      [item.code,item.name,`${item.qty} ${item.unit}`,`$${formatter.format(item.subtotal)}`].forEach(t=>{const td=document.createElement('td');td.textContent=t;tr.appendChild(td);});
      return tr;
    }));
    notice.textContent=data.warning+' Las sugerencias automáticas se ocultan del 3D al colocar puntos precisos, pero permanecen en la estimación base. Los puntos manuales se suman por separado; su ubicación NO calcula rutas reales de cables o ductos. APU sujeto a revisión.';
    renderManualList();
  }
  function onDown(e){
    if(!active||e.button!==0)return;
    down={x:e.clientX,y:e.clientY};
    e.stopImmediatePropagation();e.preventDefault();
    try{canvas.setPointerCapture(e.pointerId);}catch{}
    pointerCandidate(e);
  }
  function onMove(e){
    if(!active)return;
    e.stopImmediatePropagation();
    const result=pointerCandidate(e);
    if(down&&result?.issue)status.textContent=result.issue;
  }
  function onUp(e){
    if(!active||e.button!==0)return;
    e.stopImmediatePropagation();e.preventDefault();
    if(!down)return;
    down=null;
    const result=pointerCandidate(e);
    if(!result){status.textContent='Apunta a una superficie válida del montaje seleccionado.';return;}
    if(result.issue){status.textContent=result.issue;return;}
    const p=result.point;
    if(savePoint(p,'Punto '+p.id+' ubicado correctamente: U '+Math.round(p.u*1000)+
      ' mm, V '+Math.round(p.v*1000)+' mm.')){
      if(p.mount==='wall')faceSelect.value=p.face;
      leaveMode();
    }
  }
  function onKey(e){if(e.key==='Escape'&&active){leaveMode();status.textContent='Ubicación cancelada.';}}
  mountSelect.addEventListener('change',()=>{
    leaveMode();syncMountControls();
    if(mountSelect.value==='ceiling')vInput.value=String(Math.round(state.W*500));
  });
  manualType.addEventListener('change',()=>{
    if(mountSelect.value==='ceiling'&&manualType.value!=='light'){
      mountSelect.value='wall';syncMountControls();
      status.textContent='El elemento seleccionado se instalará en un muro. Solo luminarias van al cielo.';
    }
  });
  exactSave.addEventListener('click',()=>{
    leaveMode();
    try{
      const p=formCandidate();
      savePoint(p,'Coordenadas exactas guardadas: U '+Math.round(p.u*1000)+
        ' mm, V '+Math.round(p.v*1000)+' mm.');
    }catch(error){status.textContent=error.message;}
  });
  duplicate.addEventListener('click',()=>{
    const original=points.find(p=>p.id===editingId);if(!original)return;
    const id='el-'+nextId;
    for(const offset of [.30,-.30,.50,-.50]){
      const p={...original,id,u:snapElectricalCoordinate(original.u+offset,1)};
      const issue=validateElectricalPoint(p,state,state.openings||[],state.partitions||[],points,state.interiorDoors||[]);
      if(!issue){savePoint(p,'Punto duplicado '+id+' a U '+Math.round(p.u*1000)+' mm.');return;}
    }
    status.textContent='No hay espacio libre cerca para duplicar este punto.';
  });
  cancelEdit.addEventListener('click',()=>{
    leaveMode();stopEdit();status.textContent='Edición finalizada.';
  });
  place.addEventListener('click',()=>setMode(editingId));
  cancel.addEventListener('click',()=>{leaveMode();status.textContent='Ubicación cancelada.';});
  clear.addEventListener('click',()=>{
    leaveMode();stopEdit();points=[];saveConfig();signature='';update();
    status.textContent='Puntos manuales eliminados.';
  });
  profile.addEventListener('change',()=>{saveConfig();signature='';update();});
  rooms.addEventListener('input',()=>{saveConfig();signature='';update();});
  toggle.addEventListener('change',()=>{
    saveConfig();
    if(layer)layer.visible=toggle.checked&&points.length===0;
    if(manualLayer)manualLayer.visible=toggle.checked;
  });
  canvas.addEventListener('pointerdown',onDown,true);
  canvas.addEventListener('pointermove',onMove,true);
  canvas.addEventListener('pointerup',onUp,true);
  document.addEventListener('keydown',onKey);
  update();
  return update;
}
