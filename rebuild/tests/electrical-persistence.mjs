import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultElectricalConfig, sanitizeElectricalConfig, validateElectricalPoint,
  snapElectricalCoordinate, electricalPointWorld } from '../electrical-project-config.js';

const dims={L:12.03,W:2.35,H:2.39};
const point={id:'el-3',type:'outlet',face:'A',u:2,v:1.1};

test('Configuración eléctrica mantiene valores canónicos para proyectos antiguos',()=>{
  assert.deepEqual(sanitizeElectricalConfig(undefined,dims),defaultElectricalConfig());
  assert.deepEqual(sanitizeElectricalConfig(null,dims),defaultElectricalConfig());
});

test('Config eléctrica exportable admite perfil, visibilidad y puntos manuales',()=>{
  const data={profile:'basico',rooms:3,show:false,points:[point]};
  const saved=sanitizeElectricalConfig(JSON.parse(JSON.stringify(data)),dims);
  assert.deepEqual(saved,data);
  assert.notEqual(saved.points[0],point);
});

test('La importación eléctrica rechaza entradas inválidas sin alterarlas',()=>{
  const config=(points)=>({profile:'estandar',rooms:1,show:true,points});
  assert.throws(()=>sanitizeElectricalConfig({...config([]),rooms:0},dims),/recintos/i);
  assert.throws(()=>sanitizeElectricalConfig({...config([]),show:'false'},dims),/Visibilidad/);
  assert.throws(()=>sanitizeElectricalConfig(config([{...point,u:0}]),dims),/márgenes/);
  assert.throws(()=>sanitizeElectricalConfig(config([{...point,id:'el-0'}]),dims),/Identificador/);
  assert.throws(()=>sanitizeElectricalConfig(config([point,{...point}]),dims),/Identificador/);
  assert.throws(()=>sanitizeElectricalConfig(config([point,{...point,id:'el-4',u:2.05}]),dims),/solapados/);
  assert.throws(()=>sanitizeElectricalConfig(config([point]),dims,[{face:'A',u:1.8,v:1,w:1,h:1}]),/abertura/);
});

test('Puntos eléctricos verifican dimensiones del contenedor',()=>{
  assert.throws(()=>sanitizeElectricalConfig(
    {profile:'estandar',rooms:1,show:true,points:[{...point,u:11}]},{L:5,W:2.35,H:2.39}
  ),/márgenes/);
});

const host={id:'partition-1',axis:'x',cx:0,cz:0,length:3,height:2.3,thickness:.1};
const dims3={...dims,partitions:[host],interiorDoors:[]};
test('V4.19: ajustes magnéticos conservan precisión milimétrica',()=>{
  assert.equal(snapElectricalCoordinate(1.2344,1),1.234);
  assert.equal(snapElectricalCoordinate(1.236,10),1.24);
  assert.equal(snapElectricalCoordinate(1.236,50),1.25);
  assert.equal(snapElectricalCoordinate(1.236,100),1.2);
  assert.throws(()=>snapElectricalCoordinate(1.2,3),/magnético/);
});
test('V4.19: enchufe sobre tabique y luminaria en cielo mantienen coordenadas en JSON',()=>{
  const partition={id:'el-1',type:'outlet',mount:'partition',partitionId:host.id,face:'A',u:1.5,v:.4};
  const ceiling={id:'el-2',type:'light',mount:'ceiling',face:'roof',u:6,v:1.2};
  const raw={profile:'estandar',rooms:1,show:true,points:[partition,ceiling]};
  assert.deepEqual(sanitizeElectricalConfig(raw,dims3),raw);
  const partitionPosition=electricalPointWorld(partition,dims3,.14);
  assert.ok(Math.abs(partitionPosition[0])<1e-9);
  assert.ok(partitionPosition[2]>host.cz);
  const roofPosition=electricalPointWorld(ceiling,dims3,.14);
  assert.equal(roofPosition[1],.14+dims3.H-.045);
});
test('V4.19: rechaza cielo con enchufe, tabique sin anfitrión, puertas y superposiciones',()=>{
  const p={id:'el-1',type:'outlet',mount:'partition',partitionId:host.id,face:'A',u:1.5,v:.4};
  const c={id:'el-2',type:'light',mount:'ceiling',face:'roof',u:6,v:1.2};
  assert.equal(validateElectricalPoint(p,dims3),null);
  assert.equal(validateElectricalPoint(c,dims3),null);
  assert.match(validateElectricalPoint({...c,type:'outlet'},dims3),/Solo luminarias/);
  assert.match(validateElectricalPoint({...p,partitionId:'missing'},dims3),/inexistente/);
  assert.match(validateElectricalPoint({...p,u:0},dims3),/márgenes/);
  const door={partitionId:host.id,u:1,w:1,h:2};
  assert.match(validateElectricalPoint(p,dims3,[],[host],[],[door]),/puerta/);
  assert.match(validateElectricalPoint({...p,id:'el-3',u:1.52},dims3,[],[host],[p],[]),/solapados/);
  assert.equal(validateElectricalPoint({...p,id:'el-3',face:'B'},dims3,[],[host],[p],[]),null);
});
test('V4.19: JSON de muro legado sigue intacto; configuración inválida no modifica original',()=>{
  const legacy={profile:'estandar',rooms:1,show:true,points:[point]};
  assert.deepEqual(sanitizeElectricalConfig(legacy,dims),legacy);
  const raw={profile:'estandar',rooms:1,show:true,
    points:[{id:'el-1',type:'outlet',mount:'partition',partitionId:host.id,face:'A',u:1.2,v:.4}]};
  assert.throws(()=>sanitizeElectricalConfig(raw,dims,[],[]),/inexistente/);
  assert.equal(raw.points[0].u,1.2);
});
