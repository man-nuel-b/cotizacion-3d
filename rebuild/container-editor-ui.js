import { CATALOG, CATALOG_BY_CODE, FAMILIES, findCatalog } from './container-catalog.js';
/* User interaction: catalog left, scene centre, properties right.
 * No external state backend, no APU cost integration.
 */
export function installEditor({THREE,renderer,camera,controls,root,api,state,FACES,FLOOR}){
 const $=id=>document.getElementById(id);
 const raycaster=new THREE.Raycaster(),mouse=new THREE.Vector2();
 let pendingCode=null,drag=null,pointerOrigin=null;
 const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
 const number=id=>Number(String($(id).value).replace(',','.'));
 function hint(message,error=false){
  const node=$('scene-hint');node.textContent=message;
  node.style.background=error?'rgba(140,41,38,.95)':'rgba(18,35,54,.91)';
 }
 function familyName(id){return FAMILIES.find(f=>f.id===id)?.name||id;}
 function modeLabel(item){
  return ({
   object:'Modelo 3D', 'wall-object':'Ensamble 3D',opening:'Abertura real',
   floor:'Aplicar al piso','wall-finish':'Aplicar a pared',
   ceiling:'Aplicar al cielo',skirting:'Zócalo perimetral',service:'Gestión sin geometría'
  })[item.mode]||item.mode;
 }
 for(const family of FAMILIES){
  const option=document.createElement('option');
  option.value=family.id;option.textContent=family.name;
  $('catalog-family').appendChild(option);
 }
 function renderCatalog(){
  const items=findCatalog($('catalog-search').value,$('catalog-family').value);
  const list=$('catalog-list');list.replaceChildren();
  $('catalog-count').textContent=items.length+' de '+CATALOG.length+' partidas';
  for(const item of items){
   const btn=document.createElement('button');
   btn.type='button';btn.className='catalog-item'+(pendingCode===item.code?' active':'');
   btn.dataset.code=item.code;
   const code=document.createElement('span');code.className='code';code.textContent=item.code;
   const copy=document.createElement('span');copy.className='item-copy';
   copy.textContent=item.name;
   const meta=document.createElement('small');meta.textContent=familyName(item.family)+' · '+modeLabel(item);
   copy.appendChild(meta);btn.append(code,copy);
   btn.addEventListener('click',()=>arm(item.code));list.appendChild(btn);
  }
 }
 function arm(code){
  const item=CATALOG_BY_CODE[code];if(!item)return;
  if(item.mode==='service'){
   const result=api.addService(code);if(!result.ok){hint(result.error,true);return;}
   pendingCode=null;hint(code+' · Servicio técnico incorporado al listado, sin objeto físico.');renderCatalog();return;
  }
  pendingCode=code;renderCatalog();
  const msg=item.mode==='floor'||item.mode==='ceiling'||item.mode==='skirting'?
   'Haz clic en el contenedor para aplicar la terminación':
   item.mode==='wall-finish'||item.mode==='opening'?
   'Haz clic en una de las paredes del contenedor para elegir la cara':
   'Haz clic dentro del contenedor para ubicar el objeto 3D';
  hint(item.code+' — '+msg);
  if(['object','wall-object','floor','ceiling','skirting'].includes(item.mode)){
   if(!state.seeInside){api.setSeeInside(true);$('xray').checked=true;}
  }
 }
 function clearPending(){
  pendingCode=null;renderCatalog();hint('Selecciona una partida del catálogo o un objeto del modelo para modificarlo.');
 }
 function rayFor(event){
  const bounds=renderer.domElement.getBoundingClientRect();
  if(!bounds.width||!bounds.height)return null;
  mouse.set(((event.clientX-bounds.left)/bounds.width)*2-1,
   -((event.clientY-bounds.top)/bounds.height)*2+1);
  raycaster.setFromCamera(mouse,camera);return raycaster;
 }
 function wallHit(ray){
  const box=new THREE.Box3(new THREE.Vector3(-state.L/2,FLOOR,-state.W/2),
   new THREE.Vector3(state.L/2,FLOOR+state.H,state.W/2));
  const pt=ray.ray.intersectBox(box,new THREE.Vector3());if(!pt)return null;
  const distance={
   A:Math.abs(pt.z-state.W/2),C:Math.abs(pt.z+state.W/2),
   B:Math.abs(pt.x-state.L/2),D:Math.abs(pt.x+state.L/2)
  };
  const face=Object.entries(distance).sort((a,b)=>a[1]-b[1])[0][0];
  return {face,point:pt};
 }
 function floorHit(ray){
  const plane=new THREE.Plane(new THREE.Vector3(0,1,0),-FLOOR-.008);
  const pt=ray.ray.intersectPlane(plane,new THREE.Vector3());
  if(pt&&Math.abs(pt.x)<=state.L/2+.2&&Math.abs(pt.z)<=state.W/2+.2)return pt;
  const hit=wallHit(ray);
  return hit?.point||null;
 }
 function sideU(face,p){
  if(face==='A')return p.x+state.L/2;
  if(face==='C')return state.L/2-p.x;
  if(face==='B')return state.W/2-p.z;
  return p.z+state.W/2;
 }
 function objectRayPick(ray){
  const hits=ray.intersectObjects(root.children,true);
  for(const hit of hits){
   const node=hit.object;
   if(node.userData.objectId)return {kind:'object',id:node.userData.objectId};
   if(node.userData.openingId!==undefined)return {kind:'opening',id:node.userData.openingId};
  }
  return null;
 }
 function placement(code,ray){
  const item=CATALOG_BY_CODE[code];if(!item)return;
  if(item.mode==='floor'||item.mode==='ceiling'||item.mode==='skirting'){
   const point=floorHit(ray);
   if(!point){hint('Haz clic sobre la superficie del contenedor.',true);return;}
   const result=api.setFinish(code);
   if(!result.ok){hint(result.error,true);return;}
   clearPending();
   hint(code+' aplicado a '+(item.mode==='ceiling'?'cielo':item.mode==='skirting'?'perímetro':'piso')+'.');
   return;
  }
  if(item.mode==='wall-finish'||item.mode==='opening'){
   const hit=wallHit(ray);
   if(!hit){hint('Gira el contenedor y haz clic directamente sobre una pared.',true);return;}
   const {face,point}=hit;
   if(item.mode==='wall-finish'){
    const result=api.setFinish(code,face);
    if(!result.ok){hint(result.error,true);return;}
    clearPending();hint(code+' aplicado en la cara '+face+'.');return;
   }
   const [w,h]=item.size,span=FACES[face].long?state.L:state.W;
   const u=clamp(sideU(face,point)-w/2,0,Math.max(0,span-w));
   const type=['cut-door','door-wood','door-mdf','door-steel'].includes(item.visual)?'door':'window';
   const v=type==='door'?0:clamp(point.y-FLOOR-h/2,0,Math.max(0,state.H-h));
   const result=api.addOpening({type,face,w,h,u,v,
     bars:type==='window'&&state.type==='modular',catalogCode:code});
   if(!result.ok){hint(code+': '+result.error,true);return;}
   clearPending();hint(code+' colocado en la cara '+face+'. Puedes editar sus medidas a la derecha.');
   return;
  }
  if(item.mode==='object'||item.mode==='wall-object'){
   const point=floorHit(ray);if(!point){hint('Haz clic en el piso o dentro del contenedor.',true);return;}
   const [w,h,d]=item.size;
   let rot=0,x=point.x,z=point.z;
   // Snap wall-mounted fixtures toward the selected wall.
   const wallFixtures=['extractor','water-heater','outlet','power','panel','grounding','aircon','bath-accessories'];
   if(wallFixtures.includes(item.visual)){
    const hit=wallHit(ray);
    if(hit){
     const side=hit.face;
     rot=side==='B'?90:side==='C'?180:side==='D'?-90:0;
     if(side==='A')z=state.W/2-.07-d/2;
     if(side==='C')z=-state.W/2+.07+d/2;
     if(side==='B')x=state.L/2-.07-d/2;
     if(side==='D')x=-state.L/2+.07+d/2;
    }
   }
   const rad=rot*Math.PI/180;
   const rx=(Math.abs(Math.cos(rad))*w+Math.abs(Math.sin(rad))*d)/2;
   const rz=(Math.abs(Math.sin(rad))*w+Math.abs(Math.cos(rad))*d)/2;
   x=clamp(x,-state.L/2+rx+.065,state.L/2-rx-.065);
   z=clamp(z,-state.W/2+rz+.065,state.W/2-rz-.065);
   const result=api.addObject(code,x,z,undefined,rot);
   if(!result.ok){hint(code+': '+result.error,true);return;}
   clearPending();hint(code+' agregado. Haz clic sobre él para moverlo o editarlo.');
   return;
  }
 }
 function setLabel(id,label){const node=$(id);if(node)node.textContent=label;}
 function setInputLabel(id,label){
  const node=$(id);if(!node)return;
  const labelNode=Array.from(node.childNodes).find(n=>n.nodeType===3);
  if(labelNode)labelNode.textContent=label;
  else node.insertBefore(document.createTextNode(label),node.firstChild);
 }
 function visible(id,show){$(id).hidden=!show;}
 function refreshProperties(){
  const selection=api.getSelected(),form=$('props-form');
  $('properties-empty').hidden=!!selection;form.hidden=!selection;
  if(!selection){setLabel('properties-title','Propiedades del elemento');return;}
  const opening=selection.kind==='opening';
  const obj=opening?state.openings.find(x=>x.id===selection.id):
   state.objects.find(x=>x.id===selection.id);
  if(!obj){form.hidden=true;return;}
  const item=CATALOG_BY_CODE[opening?obj.catalogCode:obj.code];
  setLabel('properties-title',opening?'Modificar abertura':'Modificar objeto 3D');
  $('prop-name').value=(item?.code||'—')+' · '+(item?.name||(opening?obj.type:'Objeto'));
  const values=opening?
   {x:obj.u,z:0,y:obj.v,rot:0,w:obj.w,h:obj.h,d:0}:
   {x:obj.x,z:obj.z,y:obj.y,rot:obj.rot,w:obj.w,h:obj.h,d:obj.d};
  for(const [k,value] of Object.entries(values))$('prop-'+k).value=value;
  setInputLabel('px-label',opening?'Distancia horizontal en cara (m)':'X (m)');
  setInputLabel('py-label','Altura desde piso (m)');
  visible('pz-label',!opening);visible('prot-label',!opening);
  visible('pd-label',!opening);visible('pface-label',opening);
  $('prop-face').value=opening?obj.face:'A';
 }
 function refreshPlaced(){
  const list=$('placed-list');list.replaceChildren();
  const active=api.getSelected();
  const entries=[
   ...state.objects.map(x=>({kind:'object',id:x.id,code:x.code})),
   ...state.openings.map(x=>({kind:'opening',id:x.id,code:x.catalogCode||'VANO'})),
   ...state.services.map(x=>({kind:'service',id:x.id,code:x.code}))
  ];
  for(const record of entries){
   const btn=document.createElement('button');btn.type='button';
   btn.className='placed-entry'+(active?.id===record.id&&active?.kind===record.kind?' selected':'');
   const label=CATALOG_BY_CODE[record.code]?.name||'Abertura manual';
   btn.textContent=record.code+' · '+label;
   btn.addEventListener('click',()=>{
    if(record.kind==='service')api.removeService(record.id);
    else api.selectEntity(record.kind,record.id);
   });
   if(record.kind==='service')btn.title='Quitar servicio administrativo del listado';
   list.appendChild(btn);
  }
 }
 function refresh(){refreshProperties();refreshPlaced();}
 $('catalog-search').addEventListener('input',renderCatalog);
 $('catalog-family').addEventListener('change',renderCatalog);
 $('cancel-placement').addEventListener('click',clearPending);
 $('prop-apply').addEventListener('click',()=>{
  const selection=api.getSelected();if(!selection)return;
  const isOpening=selection.kind==='opening';
  const w=number('prop-w'),h=number('prop-h');
  const params=isOpening?
   {u:number('prop-x'),v:number('prop-y'),w,h,face:$('prop-face').value}:
   {x:number('prop-x'),z:number('prop-z'),y:number('prop-y'),rot:number('prop-rot'),
    w,h,d:number('prop-d')};
  const result=isOpening?api.updateOpening(selection.id,params):api.updateObject(selection.id,params);
  if(!result.ok){hint(result.error,true);return;}
  hint('Cambios aplicados al elemento seleccionado.');
 });
 $('prop-delete').addEventListener('click',()=>{
  const selection=api.getSelected();if(!selection)return;
  if(selection.kind==='opening')api.removeOpening(selection.id);
  else api.removeObject(selection.id);
  hint('Elemento eliminado del proyecto.');
 });
 $('prop-duplicate').addEventListener('click',()=>{
  const selection=api.getSelected();if(!selection)return;
  const result=selection.kind==='opening'?api.duplicateOpening(selection.id):api.duplicateObject(selection.id);
  hint(result.ok?'Elemento duplicado.':'No se pudo duplicar: '+result.error,!result.ok);
 });
 $('save-project').addEventListener('click',()=>{
  const project={schema:'BAT-CUBIKEITOR-V2',version:1,exportedAt:new Date().toISOString(),
   state:api.getState()};
  const blob=new Blob([JSON.stringify(project,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download='bat-cubikeitor-v2.json';a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  hint('Proyecto exportado como JSON. Guarda este archivo como respaldo.');
 });
 $('import-project').addEventListener('click',()=>$('import-project-file').click());
 $('import-project-file').addEventListener('change',async event=>{
  const file=event.target.files?.[0];event.target.value='';if(!file)return;
  if(file.size>2_000_000){hint('Archivo demasiado grande.',true);return;}
  try{
   const data=JSON.parse(await file.text());
   if(data.schema!=='BAT-CUBIKEITOR-V2'||data.version!==1)throw Error('Formato de proyecto incompatible');
   if(!confirm('¿Reemplazar el diseño actual con el archivo seleccionado?'))return;
   const result=api.setState(data.state);
   if(!result.ok)throw Error(result.error);
   clearPending();hint('Proyecto importado correctamente.');
   // Also refresh original container sizing and description.
   for(const [id,key] of [['dL','L'],['dW','W'],['dH','H']])$(id).value=state[key];
   $('dC').value=state.color;
   $('xray').checked=state.seeInside;
   document.querySelectorAll('#seg button').forEach(b=>b.classList.toggle('on',b.dataset.t===state.type));
  }catch(err){hint('No se pudo importar: '+err.message,true);}
 });
 const canvas=renderer.domElement;
 canvas.addEventListener('pointerdown',event=>{
  pointerOrigin={x:event.clientX,y:event.clientY};
  if(pendingCode)return;
  const ray=rayFor(event);if(!ray)return;
  const hit=objectRayPick(ray);if(!hit)return;
  api.selectEntity(hit.kind,hit.id);
  if(hit.kind==='object'){
   const o=state.objects.find(x=>x.id===hit.id);
   if(!o)return;
   const plane=new THREE.Plane(new THREE.Vector3(0,1,0),-(FLOOR+o.y));
   const at=ray.ray.intersectPlane(plane,new THREE.Vector3());
   if(at){
    drag={id:o.id,x:o.x,z:o.z,startX:at.x,startZ:at.z,origClientX:event.clientX,
     origClientY:event.clientY,changed:false};
    controls.enabled=false;
   }
  }
 });
 canvas.addEventListener('pointermove',event=>{
  if(!drag||!pointerOrigin)return;
  if(Math.hypot(event.clientX-drag.origClientX,event.clientY-drag.origClientY)>4)
   drag.changed=true;
  if(!drag.changed)return;
  const o=state.objects.find(x=>x.id===drag.id),ray=rayFor(event);if(!o||!ray)return;
  const at=ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),-(FLOOR+o.y)),new THREE.Vector3());
  if(!at)return;
  const rot=o.rot*Math.PI/180;
  const rx=(Math.abs(Math.cos(rot))*o.w+Math.abs(Math.sin(rot))*o.d)/2;
  const rz=(Math.abs(Math.sin(rot))*o.w+Math.abs(Math.cos(rot))*o.d)/2;
  const x=clamp(drag.x+at.x-drag.startX,-state.L/2+rx+.06,state.L/2-rx-.06);
  const z=clamp(drag.z+at.z-drag.startZ,-state.W/2+rz+.06,state.W/2-rz-.06);
  drag.preview={x,z};
  const group=api.getEntityMeshes().find(n=>n.userData.objectId===drag.id);
  if(group)group.position.set(x,FLOOR+o.y,z);
 });
 function endDrag(event){
  controls.enabled=true;
  const prior=drag;drag=null;
  if(prior?.changed&&prior.preview){
   const result=api.updateObject(prior.id,prior.preview);
   if(!result.ok){api.selectEntity('object',prior.id);hint(result.error,true);}
   else hint('Objeto desplazado dentro del contenedor.');
   pointerOrigin=null;return true;
  }
  return false;
 }
 canvas.addEventListener('pointerup',event=>{
  if(endDrag(event))return;
  if(!pointerOrigin)return;
  const moved=Math.hypot(event.clientX-pointerOrigin.x,event.clientY-pointerOrigin.y)>7;
  pointerOrigin=null;
  if(moved||!pendingCode)return;
  const ray=rayFor(event);if(ray)placement(pendingCode,ray);
 });
 canvas.addEventListener('pointercancel',()=>{if(drag)api.selectEntity('object',drag.id);drag=null;controls.enabled=true;pointerOrigin=null;});
 window.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&pendingCode){clearPending();return;}
  if((event.key==='Delete'||event.key==='Backspace')&&
    !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)){
   const selection=api.getSelected();if(selection){
    if(selection.kind==='object')api.removeObject(selection.id);
    else api.removeOpening(selection.id);
   }
  }
 });
 renderCatalog();refresh();
 return Object.freeze({refresh,clearPending,getPending:()=>pendingCode});
}

