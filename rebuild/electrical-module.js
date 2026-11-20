import * as THREE from 'three';

// Estimador paramétrico preliminar: no sustituye proyecto SEC ni cálculo de cargas.
export const ELECTRICAL_PROFILES = Object.freeze({
  basico:{label:'Básico',circuits:2,outletsPerRoom:2,lightsPerRoom:1,switchesPerRoom:1,cableFactor:1.25,laborHoursPerPoint:.45},
  estandar:{label:'Estándar',circuits:3,outletsPerRoom:4,lightsPerRoom:2,switchesPerRoom:1,cableFactor:1.30,laborHoursPerPoint:.55},
  galpon_industrial:{label:'Galpón / taller',circuits:4,outletsPerRoom:3,lightsPerRoom:3,switchesPerRoom:1,cableFactor:1.35,laborHoursPerPoint:.65}
});
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
  board.position.set(-length/2+clearance,floor+1.5,-width/2+clearance);
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
  const status=$('electric-placement-status'),manualList=$('electric-manual-list'),clear=$('electric-clear-manual');
  const canvas=renderer.domElement;
  const formatter=new Intl.NumberFormat('es-CL',{maximumFractionDigits:0});
  const labels={outlet:'Enchufe',switch:'Interruptor',light:'Luminaria',board:'Tablero'};
  const codes={outlet:'EL-ENCH',switch:'EL-INT',light:'EL-LUMI',board:'EL-TAB'};
  const counter={outlet:'outlets',switch:'switches',light:'lights'};
  const limits={outlet:[.11,.12],switch:[.11,.12],light:[.35,.15],board:[.35,.45]};
  let signature='',layer=null,manualLayer=null,points=[],nextId=1,active=null,down=null,originalControls=true;
  const params=()=>({width:state.W,length:state.L,wallHeight:state.H,rooms:rooms.value,profile:profile.value,floor:FLOOR});
  const position=(p)=>{
    const len=(p.face==='A'||p.face==='C')?state.L:state.W;
    const along=p.u-len/2, y=FLOOR+p.v;
    const offset=.095;
    if(p.face==='A')return [along,y,state.W/2-offset];
    if(p.face==='B')return [state.L/2-offset,y,-along];
    if(p.face==='C')return [-along,y,-state.W/2+offset];
    return [-state.L/2+offset,y,along];
  };
  const bounds=(p)=>{
    const size=limits[p.type],span=(p.face==='A'||p.face==='C')?state.L:state.W;
    return p.u>=size[0]/2+.15 && p.u<=span-size[0]/2-.15 &&
      p.v>=size[1]/2+.10 && p.v<=state.H-size[1]/2-.10;
  };
  const collisions=(p)=>{
    const size=limits[p.type], pad=.055;
    for(const o of state.openings||[]){
      if(o.face!==p.face)continue;
      const x=p.u, y=p.v;
      if(x+size[0]/2+pad>o.u && x-size[0]/2-pad<o.u+o.w &&
         y+size[1]/2+pad>o.v && y-size[1]/2-pad<o.v+o.h)return true;
    }
    for(const q of points){
      if(q.id===p.id||q.face!==p.face)continue;
      const a=limits[q.type];
      if(Math.abs(p.u-q.u)<(size[0]+a[0])/2+.05 &&
         Math.abs(p.v-q.v)<(size[1]+a[1])/2+.05)return true;
    }
    return false;
  };
  function addManualLayer() {
    if(manualLayer){scene.remove(manualLayer);disposeElectricalGroup(manualLayer);}
    manualLayer=new THREE.Group();
    manualLayer.name='manual_electrical_layer';
    const colors={outlet:0x38bdf8,switch:0x7dd3a7,light:0xffe08a,board:0xf59e0b};
    for(const p of points){
      const [w,h]=limits[p.type], depth=.06;
      const geometry=new THREE.BoxGeometry(w,h,depth);
      const material=new THREE.MeshStandardMaterial({color:colors[p.type],emissive:p.type==='light'?0x775500:0,emissiveIntensity:.2});
      const mesh=new THREE.Mesh(geometry,material);
      mesh.position.set(...position(p));
      if(p.face==='B'||p.face==='D')mesh.rotation.y=Math.PI/2;
      manualLayer.add(mesh);
    }
    manualLayer.visible=toggle.checked;
    scene.add(manualLayer);
  }
  function setMode(id=null) {
    active={id,type:id?points.find(p=>p.id===id)?.type:manualType.value};
    if(!active.type){active=null;return;}
    originalControls=controls.enabled;
    controls.enabled=false;
    place.textContent=id?'Mover punto seleccionado':'Ubicando punto…';
    cancel.hidden=false;
    status.textContent='Haz clic sobre una pared válida del visor 3D. Esc para cancelar.';
    canvas.style.cursor='crosshair';
  }
  function leaveMode() {
    if(!active)return;
    active=null;controls.enabled=originalControls;
    place.textContent='Ubicar punto en muro 3D';cancel.hidden=true;
    canvas.style.cursor='';
  }
  function rayWall(event) {
    const rect=canvas.getBoundingClientRect();
    if(!rect.width||!rect.height)return null;
    const ndc=new THREE.Vector2(((event.clientX-rect.left)/rect.width)*2-1,
      -((event.clientY-rect.top)/rect.height)*2+1);
    const raycaster=new THREE.Raycaster();
    raycaster.setFromCamera(ndc,camera);
    const ray=raycaster.ray,candidates=[];
    const faces=[
      ['A','z',state.W/2-.08],['B','x',state.L/2-.08],
      ['C','z',-state.W/2+.08],['D','x',-state.L/2+.08]
    ];
    for(const [face,axis,value] of faces){
      const direction=axis==='x'?ray.direction.x:ray.direction.z;
      if(Math.abs(direction)<1e-8)continue;
      const t=(value-(axis==='x'?ray.origin.x:ray.origin.z))/direction;
      if(t<=0)continue;
      const pt=ray.at(t,new THREE.Vector3());
      if(pt.y<FLOOR||pt.y>FLOOR+state.H)continue;
      const along=face==='A'?pt.x:face==='B'?-pt.z:face==='C'?-pt.x:pt.z;
      const span=(face==='A'||face==='C')?state.L:state.W;
      if(Math.abs(along)>span/2)continue;
      candidates.push({face,u:along+span/2,v:pt.y-FLOOR,t});
    }
    candidates.sort((a,b)=>a.t-b.t);
    return candidates[0]||null;
  }
  function renderManualList() {
    manualList.replaceChildren();
    points.forEach(p=>{
      const div=document.createElement('div');div.className='entry';
      const label=document.createElement('span');
      label.textContent=labels[p.type]+' · cara '+p.face+' · '+p.u.toFixed(2)+' m / '+p.v.toFixed(2)+' m';
      const move=document.createElement('button');move.textContent='Mover';move.type='button';
      move.addEventListener('click',()=>setMode(p.id));
      const remove=document.createElement('button');remove.textContent='Quitar';remove.type='button';
      remove.className='alt';
      remove.addEventListener('click',()=>{
        if(active?.id===p.id)leaveMode();
        points=points.filter(x=>x.id!==p.id);
        signature='';update();
      });
      div.append(label,move,remove);manualList.append(div);
    });
  }
  function update(){
    // Revalidate manual placements after changes to the host geometry.
    const valid=points.filter(p=>bounds(p) && !(state.openings||[]).some(o=>o.face===p.face &&
      p.u+limits[p.type][0]/2+.055>o.u && p.u-limits[p.type][0]/2-.055<o.u+o.w &&
      p.v+limits[p.type][1]/2+.055>o.v && p.v-limits[p.type][1]/2-.055<o.v+o.h));
    if(valid.length!==points.length){
      points=valid;
      status.textContent='Se retiraron puntos incompatibles con la geometría o los vanos actuales.';
    }
    const current=JSON.stringify([state.L,state.W,state.H,state.type,state.openings,rooms.value,profile.value,points]);
    if(current===signature)return;
    signature=current;
    const data=calculateElectricalTakeoff(params());
    const replacement=buildElectrical3DGroup(params());
    replacement.visible=toggle.checked;scene.add(replacement);
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
    summary.textContent=\`\${data.summary.outlets+manualCounts.outlet} enchufes · \${data.summary.lights+manualCounts.light} luces · \${data.summary.switches+manualCounts.switch} interruptores · \${data.summary.circuits} circuitos estimados (\${points.length} puntos manuales)\`;
    cost.textContent=\`Materiales: $\${formatter.format(materialsNet)} · Mano de obra: $\${formatter.format(laborNet)} · Total neto estimado: $\${formatter.format(materialsNet+laborNet)} CLP\`;
    bom.replaceChildren(...data.bom.map(item=>{
      const tr=document.createElement('tr');
      [item.code,item.name,\`\${item.qty} \${item.unit}\`,\`$\${formatter.format(item.subtotal)}\`].forEach(t=>{const td=document.createElement('td');td.textContent=t;tr.appendChild(td);});
      return tr;
    }));
    notice.textContent=data.warning+' Los puntos manuales se suman a la base automática; su posición no modifica todavía el metrado de conductores ni canalizaciones.';
    renderManualList();
  }
  function onDown(e){
    if(!active||e.button!==0)return;
    down={x:e.clientX,y:e.clientY};
    e.stopImmediatePropagation();e.preventDefault();
  }
  function onUp(e){
    if(!active||e.button!==0)return;
    e.stopImmediatePropagation();e.preventDefault();
    if(!down||Math.hypot(e.clientX-down.x,e.clientY-down.y)>7){down=null;return;}
    down=null;
    const hit=rayWall(e);
    if(!hit){status.textContent='Apunta a una cara de pared dentro del volumen del contenedor.';return;}
    const candidate={...hit,type:active.type,id:active.id||'el-'+nextId};
    if(!bounds(candidate)){status.textContent='Posición fuera de los márgenes seguros del muro.';return;}
    if(collisions(candidate)){status.textContent='La posición invade una puerta, ventana u otro punto eléctrico.';return;}
    if(active.id){points=points.map(p=>p.id===active.id?candidate:p);}
    else{points.push(candidate);nextId++;}
    leaveMode();status.textContent='Punto ubicado correctamente. El modelo y BOM están actualizados.';
    signature='';update();
  }
  function onKey(e){if(e.key==='Escape'&&active){leaveMode();status.textContent='Ubicación cancelada.';}}
  place.addEventListener('click',()=>{leaveMode();setMode();});
  cancel.addEventListener('click',()=>{leaveMode();status.textContent='Ubicación cancelada.';});
  clear.addEventListener('click',()=>{leaveMode();points=[];signature='';update();status.textContent='Puntos manuales eliminados.';});
  profile.addEventListener('change',()=>{signature='';update();});
  rooms.addEventListener('input',()=>{signature='';update();});
  toggle.addEventListener('change',()=>{if(layer)layer.visible=toggle.checked;if(manualLayer)manualLayer.visible=toggle.checked;});
  canvas.addEventListener('pointerdown',onDown,true);
  canvas.addEventListener('pointerup',onUp,true);
  document.addEventListener('keydown',onKey);
  update();
  return update;
}
