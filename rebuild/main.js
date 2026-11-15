/* BAT-CUBIKEITOR V2 app. All rendering derives exclusively from the store. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const store=BatProjectState.createStore();
const money=n=>Math.round(n).toLocaleString('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0});
let renderer,scene,camera,controls,model;
const parts=[];
function geometry3D(state){
 if(!scene)return;
 if(model){scene.remove(model);model.traverse(object=>{object.geometry?.dispose?.();if(object.material){(Array.isArray(object.material)?object.material:[object.material]).forEach(m=>m.dispose?.());}});}
 model=new THREE.Group();scene.add(model);
 const c=state.project.container;
 const shell=new THREE.Mesh(new THREE.BoxGeometry(c.length,c.height,c.width),new THREE.MeshStandardMaterial({color:0x475569,transparent:true,opacity:.30,side:THREE.DoubleSide,depthWrite:false}));
 shell.position.y=c.height/2;model.add(shell);
 const edges=new THREE.LineSegments(new THREE.EdgesGeometry(shell.geometry),new THREE.LineBasicMaterial({color:0xfbbf24}));edges.position.copy(shell.position);model.add(edges);
 const matWindow=new THREE.MeshStandardMaterial({color:0x38bdf8,transparent:true,opacity:.8,side:THREE.DoubleSide});
 const matDoor=new THREE.MeshStandardMaterial({color:0xc084fc,side:THREE.DoubleSide});
 for(const o of state.openings){
  const plane=new THREE.Mesh(new THREE.PlaneGeometry(o.width,o.height),o.kind==='window'?matWindow:matDoor);
  const long=['A','B'].includes(o.face);
  const offset=long?o.offset:0, other=long?0:o.offset;
  plane.position.set(offset,o.height/2,other);
  if(o.face==='A')plane.position.z=-c.width/2-.006;
  if(o.face==='B')plane.position.z=c.width/2+.006;
  if(o.face==='C'){plane.position.x=-c.length/2-.006;plane.rotation.y=Math.PI/2;}
  if(o.face==='D'){plane.position.x=c.length/2+.006;plane.rotation.y=Math.PI/2;}
  model.add(plane);
 }
 const wallMat=new THREE.MeshStandardMaterial({color:0x22c55e,transparent:true,opacity:.72});
 for(const p of state.partitions){const wall=new THREE.Mesh(new THREE.BoxGeometry(p.length,p.height,.08),wallMat);wall.position.set(p.x,p.height/2,p.z);model.add(wall);}
 if(controls){controls.target.set(0,c.height/2,0);controls.update();}
}
function init3D(){
 if(typeof THREE==='undefined'){message('No se pudo cargar Three.js; comprueba tu conexión.');return;}
 const container=$('canvas');scene=new THREE.Scene();scene.background=new THREE.Color(0x101c30);
 camera=new THREE.PerspectiveCamera(45,1,.1,150);camera.position.set(9,7,9);
 renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));container.appendChild(renderer.domElement);
 scene.add(new THREE.HemisphereLight(0xffffff,0x64748b,1.8));
 const light=new THREE.DirectionalLight(0xffffff,1.6);light.position.set(8,12,6);scene.add(light);
 if(THREE.OrbitControls){controls=new THREE.OrbitControls(camera,renderer.domElement);controls.enableDamping=true;}
 const resize=()=>{const rect=container.getBoundingClientRect();renderer.setSize(Math.max(rect.width,300),Math.max(rect.height,350));camera.aspect=Math.max(rect.width,300)/Math.max(rect.height,350);camera.updateProjectionMatrix();};
 if(typeof ResizeObserver!=='undefined')new ResizeObserver(resize).observe(container);else window.addEventListener('resize',resize);
 resize();function frame(){requestAnimationFrame(frame);controls?.update();renderer.render(scene,camera);}frame();
}
function message(text){$('message').textContent=text;}
function dispatch(action){try{store.dispatch(action);message('Cambios aplicados y presupuesto actualizado.');}catch(e){message(e.message);$('message').classList.add('error');}}
function update(state){
 $('revision').textContent='Revisión '+state.revision;
 const c=state.project.container;
 $('project-name').value=state.project.name;for(const key of ['length','width','height'])$(key).value=c[key];
 $('transport').value=state.pricing.transport;
 const bom=BatMaterials.takeoff(state),quote=BatPricing.calculate(bom,BatCatalog,state.pricing);
 $('bom').replaceChildren();
 for(const line of quote.lines){const tr=document.createElement('tr');for(const value of [line.name,line.qty+' '+line.unit,money(line.subtotal)]){const td=document.createElement('td');td.textContent=value;tr.appendChild(td);}$('bom').appendChild(tr);}
 $('total').textContent=money(quote.total);
 $('net-vat').textContent='Neto '+money(quote.net)+' · IVA '+money(quote.vat);
 $('metrics').textContent='Superficie '+bom.metrics.floorArea+' m² · muros netos '+bom.metrics.netWallArea+' m²';
 $('items').replaceChildren();
 for(const item of [...state.openings,...state.partitions]){
  const btn=document.createElement('button');btn.textContent='Eliminar '+(item.kind||'tabique')+' '+item.id;
  btn.addEventListener('click',()=>dispatch({type:item.kind?'opening/remove':'partition/remove',id:item.id}));
  $('items').appendChild(btn);
 }
 geometry3D(state);
}
function bind(){
 $('resize').addEventListener('click',()=>dispatch({type:'container/resize',length:$('length').value,width:$('width').value,height:$('height').value}));
 $('project-name').addEventListener('change',()=>dispatch({type:'project/rename',name:$('project-name').value}));
 $('add-opening').addEventListener('click',()=>dispatch({type:'opening/add',kind:$('kind').value,face:$('face').value,width:$('opening-width').value,height:$('opening-height').value}));
 $('add-partition').addEventListener('click',()=>dispatch({type:'partition/add',length:$('partition-length').value,height:$('partition-height').value,x:0,z:0}));
 $('transport').addEventListener('change',()=>dispatch({type:'pricing/update',key:'transport',value:$('transport').value}));
 $('export').addEventListener('click',()=>{const blob=new Blob([JSON.stringify(store.getState(),null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download='bat-cubikeitor-v2.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
 $('import').addEventListener('change',async event=>{const file=event.target.files?.[0];if(!file)return;try{const parsed=JSON.parse(await file.text());dispatch({type:'project/replace',project:parsed});}catch(e){message('Archivo inválido: '+e.message);}event.target.value='';});
}
function start(){init3D();bind();store.subscribe(update);update(store.getState());}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();