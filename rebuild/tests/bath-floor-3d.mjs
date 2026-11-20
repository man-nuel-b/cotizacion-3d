import test from 'node:test';
import assert from 'node:assert/strict';
import {
  interiorClearance, detectRectangularRoomAt, validateBathFloor, computeWallTakeoff
} from '../construction-integrity.js';

const dimensions = {L:6, W:2.4, H:2.5};
const panelThickness = .05;
const partition = (id,cx,axis='z',length=2.24,cz=0) =>
  ({id,axis,cx,cz,length,height:2.3,thickness:.1,autoSpan:axis==='z'});
const ref = (...parts) => ({...dimensions, partitions:parts});
const near = (v,expected) => assert.ok(Math.abs(v-expected)<1e-7, `${v} vs ${expected}`);

test('Selección automática reconoce los recintos rectangulares a ambos lados del tabique', () => {
  const container=ref(partition('p',1));
  const right=detectRectangularRoomAt({x:2,z:0},container,panelThickness);
  assert.equal(right.ok,true,right.error);
  near(right.length,1.87);
  near(right.width,2.24);
  near(right.cx,1.985);
  near(right.cz,0);
  const left=detectRectangularRoomAt({x:-2,z:0},container,panelThickness);
  assert.equal(left.ok,true,left.error);
  near(left.length,3.87);
  assert.notEqual(right.areaM2,left.areaM2);
  assert.equal(validateBathFloor({code:'P06',...right},container,panelThickness),null);
});

test('Dos tabiques delimitan tres áreas independientes y el clic elige la correcta', () => {
  const container=ref(partition('a',-1),partition('b',1));
  const cells=[-2,0,2].map(x=>detectRectangularRoomAt({x,z:0},container,panelThickness));
  assert.ok(cells.every(c=>c.ok),cells.map(c=>c.error).join(','));
  near(cells[1].length,1.9);
  assert.equal(cells[1].cx,0);
  assert.ok(cells[0].cx<cells[1].cx && cells[2].cx>cells[1].cx);
});

test('No inventa recintos donde no hay paredes o existe un tabique aislado y abierto', () => {
  assert.match(detectRectangularRoomAt({x:0,z:0},ref(),panelThickness).error,/tabiques/i);
  const freeStanding=ref(partition('a',0,'z',1.2));
  assert.match(detectRectangularRoomAt({x:1,z:0},freeStanding,panelThickness).error, /irregular|abierta/i);
});

test('Rechaza clics sobre el tabique y fuera del interior útil', () => {
  const c=ref(partition('a',1));
  assert.match(detectRectangularRoomAt({x:1,z:0},c,panelThickness).error,/tabique/i);
  assert.match(detectRectangularRoomAt({x:3.1,z:0},c,panelThickness).error,/piso útil/i);
});

test('Piso con coordenadas no puede atravesar un tabique ni invadir los perfiles', () => {
  const c=ref(partition('a',1));
  const correct={code:'P06',length:1.87,width:2.24,cx:1.985,cz:0};
  assert.equal(validateBathFloor(correct,c,panelThickness),null);
  assert.match(validateBathFloor({...correct,cx:.95},c,panelThickness),/superpone|perfil/i);
  assert.match(validateBathFloor({...correct,cx:2.6},c,panelThickness),/perfil/i);
  assert.match(validateBathFloor({...correct,cz:undefined},c,panelThickness),/coordenadas/i);
  assert.match(validateBathFloor({code:'P06',length:1,width:1,cx:1},c,panelThickness),/X y Centro Z/i);
});

test('El baño legado sin coordenadas mantiene la reserva de área y no cambia su fórmula', () => {
  const c={...ref(),bathFloor:{code:'P05',length:2,width:1.2},finishes:{floor:'P01'}};
  assert.equal(validateBathFloor(c.bathFloor,c,panelThickness),null);
  const t=computeWallTakeoff(c);
  near(t.bathFloorAreaM2,2.4);
  near(t.remainingFloorAreaM2,12);
  near(t.floorByCodeM2.P05,2.4);
  near(t.floorByCodeM2.P01,12);
  assert.equal(t.bathFloor.positioned,false);
});

test('El baño seleccionado en planta guarda posición y mantiene el mismo desglose por partidas', () => {
  const c={...ref(partition('p',1)),finishes:{floor:'P01'}};
  const room=detectRectangularRoomAt({x:2,z:0},c,panelThickness);
  c.bathFloor={code:'P06',length:room.length,width:room.width,cx:room.cx,cz:room.cz};
  const out=computeWallTakeoff(c);
  assert.equal(out.bathFloor.positioned,true);
  near(out.bathFloorAreaM2,room.areaM2);
  near(out.floorByCodeM2.P06+out.floorByCodeM2.P01,14.4);
  const exported=JSON.parse(JSON.stringify(c));
  assert.deepEqual(exported.bathFloor,c.bathFloor);
});
