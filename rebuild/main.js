/* BAT-CUBIKEITOR V2: UI and Three.js are projections of canonical store state. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const store=BatProjectState.createStore();
const money=n=>Math.round(n).toLocaleString('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0});
let renderer=null,scene=null,camera=null,controls=null,model=null,shellMesh=null;
let openingMeshes=[],selectedOpeningId=null,selectedPartitionId=null,placementArmed=false;
let lastQuote=null,pressStart=null;
const raycaster=typeof THREE!=='undefined'?new THREE.Raycaster():null;
const pointer=new (typeof THREE!=='undefined'?THREE.Vector2:class{})();
function message(text,isError=false){
 const el=$('message');el.textContent=text;el.classList.toggle('error',isError);
}
function dispatch(action){
 try{
  const updated=store.dispatch(action);
  message('Cambios validados. Modelo, materiales y presupuesto sincronizados.');
  return updated;
 }catch(error){message(error.message||'Acción rechazada',true);return null;}
}
function disposeModel(){
 if(!model)return;
 scene.remove(model);
 const geometries=new Set(),materials=new Set();
 model.traverse(obj=>{
  if(obj.geometry)geometries.add(obj.geometry);
  if(obj.material)(Array.isArray(obj.material)?obj.material:[obj.material]).forEach(m=>materials.add(m));
 });
 geometries.forEach(g=>g.dispose?.());materials.forEach(m=>m.dispose?.());
 model=null;shellMesh=null;openingMeshes=[];
}
function geometry3D(state){
 if(!scene)return;
 disposeModel();
 model=new THREE.Group();scene.add(model);
 const c=state.project.container;
 const shell=new THREE.Mesh(new THREE.BoxGeometry(c.length,c.height,c.width),
   new THREE.MeshStandardMaterial({color:0x475569,transparent:true,opacity:.27,side:THREE.DoubleSide,depthWrite:false}));
 shell.position.y=c.height/2;
 shell.name='container-shell';shellMesh=shell;model.add(shell);
 const edges=new THREE.LineSegments(new THREE.EdgesGeometry(shell.geometry),
   new THREE.LineBasicMaterial({color:0xfbbf24}));
 edges.position.copy(shell.position);model.add(edges);
 for(const o of state.openings){
  const highlighted=o.id===selectedOpeningId;
  const material=new THREE.MeshStandardMaterial({
   color:highlighted?0xfbbf24:(o.kind==='window'?0x38bdf8:0xc084fc),
   transparent:true,opacity:highlighted?1:.85,side:THREE.DoubleSide,depthTest:false
  });
  const plane=new THREE.Mesh(new THREE.PlaneGeometry(o.width,o.height),material);
  plane.name='opening-'+o.id;plane.userData.openingId=o.id;
  const long=['A','B'].includes(o.face);
  plane.position.set(long?o.offset:0,(o.bottom??0)+o.height/2,long?0:o.offset);
  if(o.face==='A')plane.position.z=-c.width/2-.01;
  if(o.face==='B')plane.position.z=c.width/2+.01;
  if(o.face==='C'){plane.position.x=-c.length/2-.01;plane.rotation.y=Math.PI/2;}
  if(o.face==='D'){plane.position.x=c.length/2+.01;plane.rotation.y=Math.PI/2;}
  model.add(plane);openingMeshes.push(plane);
 }
 for(const p of state.partitions){
  const wall=new THREE.Mesh(new THREE.BoxGeometry(p.length,p.height,.08),
   new THREE.MeshStandardMaterial({color:p.id===selectedPartitionId?0xfbbf24:0x22c55e,transparent:true,opacity:.78}));
  wall.name='partition-'+p.id;
  wall.position.set(p.x,p.height/2,p.z);model.add(wall);
 }
 controls?.target.set(0,c.height/2,0);
 controls?.update();
}
function pointerToRay(event){
 const rect=renderer.domElement.getBoundingClientRect();
 if(!rect.width||!rect.height)throw new Error('El visor todavía no está listo');
 pointer.set(((event.clientX-rect.left)/rect.width)*2-1,-((event.clientY-rect.top)/rect.height)*2+1);
 raycaster.setFromCamera(pointer,camera);
}
function chooseOpening(id){
 selectedOpeningId=id;selectedPartitionId=null;placementArmed=false;
 const state=store.getState(),opening=state.openings.find(o=>o.id===id);
 if(opening){
  $('kind').value=opening.kind;$('face').value=opening.face;
  $('opening-width').value=opening.width;$('opening-height').value=opening.height;
  $('opening-offset').value=opening.offset;$('opening-bottom').value=opening.bottom??0;
  message('Abertura seleccionada. Haz clic en otra pared para moverla.');
 }
 update(state);
}
function onViewerClick(event){
 if(!scene||!raycaster||!shellMesh)return;
 try{
  pointerToRay(event);
  if(!placementArmed){
   const selectedHit=raycaster.intersectObjects(openingMeshes,false)[0];
   if(selectedHit?.object?.userData?.openingId){
    chooseOpening(selectedHit.object.userData.openingId);
    return;
   }
  }
  if(!placementArmed&&!selectedOpeningId){
   message('Elige una ventana o puerta y pulsa «Elegir cara y posición», o selecciona una abertura existente.');return;
  }
  const hit=raycaster.intersectObject(shellMesh,false)[0];
  if(!hit){message('Haz clic sobre una pared del contenedor.',true);return;}
  const state=store.getState();
  const existing=selectedOpeningId?state.openings.find(o=>o.id===selectedOpeningId):null;
  if(selectedOpeningId&&!existing){selectedOpeningId=null;message('El objeto seleccionado ya no existe.',true);return;}
  const kind=existing?.kind||$('kind').value;
  const width=existing?.width??$('opening-width').value;
  const height=existing?.height??$('opening-height').value;
  const placement=BatSpatial.placementFromHit(hit.point,state.project.container,{kind,width,height});
  const action=existing?{type:'opening/move',id:existing.id,...placement}:
   {type:'opening/add',kind,width,height,...placement};
  const next=dispatch(action);
  if(!next)return;
  selectedOpeningId=existing?.id||next.openings[next.openings.length-1].id;
  selectedPartitionId=null;placementArmed=false;
  $('face').value=placement.face;$('opening-offset').value=placement.offset;$('opening-bottom').value=placement.bottom;
  message('Abertura '+(existing?'movida':'agregada')+' en cara '+placement.face+'. BOM y presupuesto actualizados.');
  update(next);
 }catch(error){message(error.message||'No fue posible colocar el objeto',true);}
}
function init3D(){
 if(typeof THREE==='undefined'){message('No se pudo cargar Three.js; comprueba tu conexión.',true);return;}
 try{
  const container=$('canvas');
  scene=new THREE.Scene();scene.background=new THREE.Color(0x101c30);
  camera=new THREE.PerspectiveCamera(45,1,.1,150);camera.position.set(9,7,9);
  renderer=new THREE.WebGLRenderer({antialias:true});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));container.appendChild(renderer.domElement);
  scene.add(new THREE.HemisphereLight(0xffffff,0x64748b,1.8));
  const light=new THREE.DirectionalLight(0xffffff,1.6);light.position.set(8,12,6);scene.add(light);
  if(THREE.OrbitControls){controls=new THREE.OrbitControls(camera,renderer.domElement);controls.enableDamping=true;}
  const resize=()=>{
   const rect=container.getBoundingClientRect();
   const w=Math.max(rect.width,300),h=Math.max(rect.height,350);
   renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();
  };
  if(typeof ResizeObserver!=='undefined')new ResizeObserver(resize).observe(container);
  else window.addEventListener('resize',resize);
  resize();
  const canvas=renderer.domElement;
  canvas.addEventListener('pointerdown',event=>{
   pressStart=event.button===0?{x:event.clientX,y:event.clientY}:null;
  });
  canvas.addEventListener('pointerup',event=>{
   if(!pressStart)return;
   const distance=Math.hypot(event.clientX-pressStart.x,event.clientY-pressStart.y);
   pressStart=null;
   if(distance<7)onViewerClick(event);
  });
  canvas.addEventListener('pointercancel',()=>{pressStart=null;});
  function frame(){requestAnimationFrame(frame);controls?.update();renderer.render(scene,camera);}frame();
 }catch(error){
  scene=null;renderer=null;message('El navegador no pudo iniciar WebGL: '+error.message,true);
 }
}
function selectPartition(p){
 selectedPartitionId=p.id;selectedOpeningId=null;placementArmed=false;
 $('partition-x').value=p.x;$('partition-z').value=p.z;
 message('Tabique seleccionado. Ajusta X y Z y pulsa «Mover tabique elegido».');
 update(store.getState());
}
function update(state){
 const c=state.project.container;
 $('revision').textContent='Revisión '+state.revision;
 $('project-name').value=state.project.name;
 for(const key of ['length','width','height'])$(key).value=c[key];
 $('transport').value=state.pricing.transport;
 if(selectedOpeningId&&!state.openings.some(o=>o.id===selectedOpeningId))selectedOpeningId=null;
 if(selectedPartitionId&&!state.partitions.some(p=>p.id===selectedPartitionId))selectedPartitionId=null;
 const bom=BatMaterials.takeoff(state),quote=BatPricing.calculate(bom,BatCatalog,state.pricing);
 lastQuote=quote;
 $('bom').replaceChildren();
 for(const line of quote.lines){
  const tr=document.createElement('tr');
  for(const val of [line.name,line.qty+' '+line.unit,money(line.subtotal)]){
   const td=document.createElement('td');td.textContent=val;tr.appendChild(td);
  }
  $('bom').appendChild(tr);
 }
 $('total').textContent=money(quote.total);
 $('net-vat').textContent='Neto '+money(quote.net)+' · IVA '+money(quote.vat);
 $('metrics').textContent='Piso '+bom.metrics.floorArea+' m² · muros netos '+bom.metrics.netWallArea+' m²';
 $('items').replaceChildren();
 for(const item of [...state.openings,...state.partitions]){
  const row=document.createElement('div');row.className='actions';
  const select=document.createElement('button');select.type='button';
  select.textContent=item.kind?
   (item.kind==='window'?'Ventana':'Puerta')+' · cara '+item.face+' · '+(item.bottom??0)+' m desde piso':
   'Tabique · X '+item.x+' · Z '+item.z;
  select.addEventListener('click',()=>item.kind?chooseOpening(item.id):selectPartition(item));
  const remove=document.createElement('button');remove.type='button';remove.textContent='Eliminar';
  remove.addEventListener('click',()=>{
   if(item.kind)selectedOpeningId=null;else selectedPartitionId=null;
   dispatch({type:item.kind?'opening/remove':'partition/remove',id:item.id});
  });
  row.append(select,remove);$('items').appendChild(row);
 }
 const selected=state.openings.find(o=>o.id===selectedOpeningId);
 $('selected-info').textContent=placementArmed?'Haz clic en una pared para colocar el elemento':
  selected?'Seleccionada: '+(selected.kind==='window'?'ventana':'puerta')+' · cara '+selected.face+
    '. Haz clic en otra pared para moverla.':
  selectedPartitionId?'Tabique seleccionado: edita X y Z en la sección 3.':'Sin objeto seleccionado';
 $('remove-selected').disabled=!selectedOpeningId&&!selectedPartitionId;
 $('move-partition').disabled=!selectedPartitionId;
 $('arm-placement').textContent=placementArmed?'Cancelar colocación 3D':'Elegir cara y posición en el visor 3D';
 $('viewer-hint').textContent=placementArmed?'Haz clic sobre una pared para colocar una abertura':
  selectedOpeningId?'Haz clic sobre una pared para mover la abertura seleccionada':
  'Arrastra para girar · rueda para acercar · selecciona una abertura para moverla';
 geometry3D(state);
}
function bind(){
 $('resize').addEventListener('click',()=>dispatch({type:'container/resize',length:$('length').value,width:$('width').value,height:$('height').value}));
 $('project-name').addEventListener('change',()=>dispatch({type:'project/rename',name:$('project-name').value}));
 $('kind').addEventListener('change',()=>{$('opening-bottom').value=$('kind').value==='door'?0:.9;});
 $('add-opening').addEventListener('click',()=>{
  const next=dispatch({type:'opening/add',kind:$('kind').value,face:$('face').value,
   width:$('opening-width').value,height:$('opening-height').value,
   offset:$('opening-offset').value,bottom:$('opening-bottom').value});
  if(next){selectedOpeningId=next.openings[next.openings.length-1].id;selectedPartitionId=null;placementArmed=false;update(next);}
 });
 $('arm-placement').addEventListener('click',()=>{
  placementArmed=!placementArmed;selectedOpeningId=null;selectedPartitionId=null;update(store.getState());
 });
 $('clear-selection').addEventListener('click',()=>{
  placementArmed=false;selectedOpeningId=null;selectedPartitionId=null;update(store.getState());
 });
 $('remove-selected').addEventListener('click',()=>{
  if(selectedOpeningId){const id=selectedOpeningId;selectedOpeningId=null;dispatch({type:'opening/remove',id});}
  else if(selectedPartitionId){const id=selectedPartitionId;selectedPartitionId=null;dispatch({type:'partition/remove',id});}
 });
 $('add-partition').addEventListener('click',()=>{
  const next=dispatch({type:'partition/add',length:$('partition-length').value,height:$('partition-height').value,
   x:$('partition-x').value,z:$('partition-z').value});
  if(next){selectedPartitionId=next.partitions[next.partitions.length-1].id;selectedOpeningId=null;update(next);}
 });
 $('move-partition').addEventListener('click',()=>{
  if(!selectedPartitionId)return;
  dispatch({type:'partition/move',id:selectedPartitionId,x:$('partition-x').value,z:$('partition-z').value});
 });
 $('transport').addEventListener('change',()=>dispatch({type:'pricing/update',key:'transport',value:$('transport').value}));
 $('export').addEventListener('click',()=>{
  const blob=new Blob([JSON.stringify(store.getState(),null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download='bat-cubikeitor-v2.json';link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
 });
 $('import').addEventListener('change',async event=>{
  const file=event.target.files?.[0];if(!file)return;
  try{const parsed=JSON.parse(await file.text());const next=dispatch({type:'project/replace',project:parsed});
   if(next){selectedOpeningId=null;selectedPartitionId=null;placementArmed=false;update(next);}
  }catch(error){message('Archivo inválido: '+error.message,true);}
  event.target.value='';
 });
}
function start(){
 init3D();bind();store.subscribe(update);update(store.getState());
 window.BAT_V2=Object.freeze({getState:()=>store.getState(),getQuote:()=>JSON.parse(JSON.stringify(lastQuote))});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();