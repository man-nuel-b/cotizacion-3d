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
export function installElectricalUI({scene,state,FLOOR}) {
  const $=id=>document.getElementById(id);
  const box=$('electrical-tools');
  if(!box)return ()=>{};
  const profile=$('electric-profile'),rooms=$('electric-rooms'),toggle=$('electric-show'),bom=$('electric-bom'),summary=$('electric-summary');
  const cost=$('electric-cost'),notice=$('electric-notice');
  const formatter=new Intl.NumberFormat('es-CL',{maximumFractionDigits:0});
  let signature='',layer=null;
  const params=()=>({width:state.W,length:state.L,wallHeight:state.H,rooms:rooms.value,profile:profile.value,floor:FLOOR});
  function update() {
    const current=JSON.stringify([state.L,state.W,state.H,rooms.value,profile.value]);
    if(current===signature)return;
    signature=current;
    const data=calculateElectricalTakeoff(params());
    const replacement=buildElectrical3DGroup(params());
    replacement.visible=toggle.checked;
    scene.add(replacement);
    if(layer){scene.remove(layer);disposeElectricalGroup(layer);}
    layer=replacement;
    summary.textContent=`${data.summary.outlets} enchufes · ${data.summary.lights} luces · ${data.summary.switches} interruptores · ${data.summary.circuits} circuitos estimados`;
    cost.textContent=`Materiales: $${formatter.format(data.apu.materialsNet)} · Mano de obra: $${formatter.format(data.apu.laborNet)} · Total neto estimado: $${formatter.format(data.apu.totalNet)} CLP`;
    bom.replaceChildren(...data.bom.map(item=>{
      const tr=document.createElement('tr');
      [item.code,item.name,`${item.qty} ${item.unit}`,`$${formatter.format(item.subtotal)}`].forEach(t=>{const td=document.createElement('td');td.textContent=t;tr.appendChild(td);});
      return tr;
    }));
    notice.textContent=data.warning;
  }
  const change=()=>{signature='';update();};
  profile.addEventListener('change',change);
  rooms.addEventListener('input',change);
  toggle.addEventListener('change',()=>{if(layer)layer.visible=toggle.checked;});
  update();
  return update;
}
