import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultElectricalConfig, sanitizeElectricalConfig } from '../electrical-module.js';

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
