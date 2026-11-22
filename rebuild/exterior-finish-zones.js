// Paños exteriores medidos por superficie real. Sin precios, sin DOM, sin Three.js.
// Coordenadas de cada cara: u horizontal desde el extremo de la cara, v desde piso.
import { CATALOG_BY_CODE } from './container-catalog.js';

export const EXTERIOR_ORIENTATIONS = Object.freeze(['horizontal', 'vertical']);
const EPS = 1e-7;
const valid = Number.isFinite;
const intersects = (a, b) =>
  a.u < b.u + b.width - EPS && a.u + a.width > b.u + EPS &&
  a.v < b.v + b.height - EPS && a.v + a.height > b.v + EPS;

export function validateExteriorZone(zone, state, ignoreId = null) {
  if (!zone || typeof zone !== 'object' || Array.isArray(zone)) return 'Paño exterior inválido';
  if (!['A', 'B', 'C', 'D'].includes(zone.face)) return 'Selecciona una cara A, B, C o D';
  if (CATALOG_BY_CODE[zone.code]?.mode !== 'wall-exterior-finish') {
    return 'Selecciona una partida de revestimiento exterior';
  }
  if (!EXTERIOR_ORIENTATIONS.includes(zone.orientation)) return 'Orientación inválida (horizontal o vertical)';
  const { u, v, width, height } = zone;
  if (![u, v, width, height, state?.L, state?.W, state?.H].every(valid)) {
    return 'Dimensiones del paño exterior inválidas';
  }
  if (width <= 0 || height <= 0 || width * height < .01 - EPS) {
    return 'El paño debe tener una superficie mínima de 0,01 m²';
  }
  const span = ['A', 'C'].includes(zone.face) ? state.L : state.W;
  if (u < -EPS || v < -EPS || u + width > span + EPS || v + height > state.H + EPS) {
    return 'El paño no cabe en el muro: revisa m², ancho y posición';
  }
  const obstacles = [
    ...(state.openings || []).filter(x => x.face === zone.face)
      .map(x => ({ u: x.u, v: x.v, width: x.w, height: x.h, type: 'vano' })),
    ...(state.sharedWalls || []).filter(x => x.face === zone.face)
      .map(x => ({ u: x.u, v: x.v, width: x.w, height: x.h, type: 'muro compartido' }))
  ];
  for (const obstacle of obstacles) {
    if (intersects(zone, obstacle)) return 'El paño invade un ' + obstacle.type + '; divide o desplaza el revestimiento';
  }
  for (const placed of state.finishes?.exteriorZones || []) {
    if (ignoreId !== null && placed.id === ignoreId) continue;
    if (placed.face === zone.face && intersects(zone, placed)) {
      return 'El paño se superpone con otro revestimiento exterior en la cara ' + zone.face;
    }
  }
  return null;
}

export function sanitizeExteriorZones(raw, state) {
  if (!Array.isArray(raw) || raw.length > 100) throw Error('Lista de paños exteriores inválida (máximo 100)');
  const cleaned = [];
  const ids = new Set();
  for (const item of raw) {
    if (!item || typeof item !== 'object' || typeof item.id !== 'string' ||
        !/^ext-[1-9]\d*$/.test(item.id) || ids.has(item.id)) throw Error('ID de paño exterior inválido o duplicado');
    ids.add(item.id);
    // Nunca almacenar areaM2 independientemente: siempre deriva de ancho × alto.
    const zone = {
      id: item.id, face: String(item.face), code: String(item.code),
      u: Number(item.u), v: Number(item.v), width: Number(item.width),
      height: Number(item.height), orientation: item.orientation
    };
    const error = validateExteriorZone(zone, {
      ...state, finishes: { ...(state.finishes || {}), exteriorZones: cleaned }
    });
    if (error) throw Error('Paño ' + zone.id + ': ' + error);
    cleaned.push(zone);
  }
  return cleaned;
}

export function exteriorTakeoffForFace(state, face, netWallAreaM2) {
  const baseCode = state.finishes?.walls?.[face] || null;
  const zones = (state.finishes?.exteriorZones || []).filter(z => z.face === face);
  const areas = {};
  let zonesM2 = 0;
  for (const zone of zones) {
    const issue = validateExteriorZone(zone, state, zone.id);
    if (issue) throw Error('Cubicación exterior: ' + issue);
    const areaM2 = zone.width * zone.height;
    zonesM2 += areaM2;
    areas[zone.code] = (areas[zone.code] || 0) + areaM2;
  }
  const baseAreaM2 = Math.max(0, netWallAreaM2 - zonesM2);
  if (zonesM2 > netWallAreaM2 + EPS) throw Error('Paños exteriores superan el área neta del muro');
  if (baseCode && baseAreaM2 > EPS) areas[baseCode] = (areas[baseCode] || 0) + baseAreaM2;
  return {
    baseCode, baseAreaM2: baseCode ? baseAreaM2 : 0,
    zonesAreaM2: zonesM2, totalCoveredM2: zonesM2 + (baseCode ? baseAreaM2 : 0),
    byCodeM2: areas,
    zones: zones.map(z => ({ ...z, areaM2: z.width * z.height }))
  };
}
