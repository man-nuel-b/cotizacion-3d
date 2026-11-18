// Núcleo geométrico puro: sin Three.js ni DOM. Cotas en metros.
// Son restricciones preliminares, NO sustituyen cálculo estructural ni planos de taller.
export const OPENING_REINFORCEMENT = Object.freeze({ window: 'P90', door: 'P91' });
export const REINFORCEMENT_META = Object.freeze({
  P90: Object.freeze({ description: 'Refuerzo perimetral de ventana (provisional)', reviewRequired: true }),
  P91: Object.freeze({ description: 'Refuerzo perimetral de puerta (provisional)', reviewRequired: true })
});

const finite = Number.isFinite;
export function interiorClearance(panelThickness) {
  if (!finite(panelThickness) || panelThickness < 0) throw Error('Espesor estructural inválido');
  // Holgura mínima de 8 cm; aumenta si el perfil ocupa mayor espesor.
  return Math.max(0.08, panelThickness + 0.02);
}

export function objectAABB(obj) {
  const angle = (obj.rot || 0) * Math.PI / 180;
  const c = Math.abs(Math.cos(angle));
  const s = Math.abs(Math.sin(angle));
  return {
    x: obj.x, z: obj.z, y0: obj.y, y1: obj.y + obj.h,
    rx: (c * obj.w + s * obj.d) / 2,
    rz: (s * obj.w + c * obj.d) / 2
  };
}

export function partitionAABB(p) {
  return {
    x: p.cx, z: p.cz, y0: 0, y1: p.height,
    rx: p.axis === 'x' ? p.length / 2 : p.thickness / 2,
    rz: p.axis === 'z' ? p.length / 2 : p.thickness / 2
  };
}

export function aabbOverlap(a, b, clearance = 0.01) {
  return Math.abs(a.x - b.x) < a.rx + b.rx + clearance &&
    Math.abs(a.z - b.z) < a.rz + b.rz + clearance &&
    a.y0 < b.y1 && b.y0 < a.y1;
}

export function validateObjectInsideContainer(obj, ref, panelThickness) {
  if (![obj.x, obj.y, obj.z, obj.w, obj.h, obj.d, obj.rot].every(finite) ||
    obj.w <= 0.02 || obj.h <= 0.02 || obj.d <= 0.008)
    return 'Dimensiones o coordenadas del objeto inválidas';
  const box = objectAABB(obj);
  const margin = interiorClearance(panelThickness);
  if (Math.abs(box.x) + box.rx > ref.L / 2 - margin + 1e-8 ||
      Math.abs(box.z) + box.rz > ref.W / 2 - margin + 1e-8)
    return 'El objeto invade el perfil estructural o excede los límites interiores del contenedor';
  if (box.y0 < 0 || box.y1 > ref.H + 1e-8)
    return 'El objeto supera la altura útil o está bajo el piso terminado';
  return null;
}

export function validatePartitionInsideContainer(p, ref, panelThickness) {
  if (!['x', 'z'].includes(p.axis) ||
    ![p.cx, p.cz, p.length, p.height, p.thickness].every(finite) ||
    p.length <= 0 || p.height <= 0 || p.thickness <= 0 || p.height > ref.H)
    return 'Dimensiones o eje del tabique inválidos';
  const box = partitionAABB(p);
  const margin = interiorClearance(panelThickness);
  if (Math.abs(box.x) + box.rx > ref.L / 2 - margin + 1e-8 ||
      Math.abs(box.z) + box.rz > ref.W / 2 - margin + 1e-8)
    return 'El tabique invade el perfil estructural o excede los límites interiores';
  return null;
}

export function checkObjectCollisions(candidate, objects = [], partitions = []) {
  const box = objectAABB(candidate);
  for (const other of objects) {
    if (other.id === candidate.id) continue;
    if (aabbOverlap(box, objectAABB(other)))
      return 'El elemento se superpone físicamente con otro objeto';
  }
  for (const partition of partitions) {
    if (aabbOverlap(box, partitionAABB(partition)))
      return 'El elemento se superpone con un tabique interior';
  }
  return null;
}

export function checkPartitionCollisions(candidate, partitions = [], objects = []) {
  const box = partitionAABB(candidate);
  for (const other of partitions) {
    if (other.id === candidate.id) continue;
    if (aabbOverlap(box, partitionAABB(other)))
      return 'El tabique se superpone con otro tabique';
  }
  for (const obj of objects) {
    if (aabbOverlap(box, objectAABB(obj)))
      return 'El tabique se superpone con un objeto existente';
  }
  return null;
}

export function reinforcementCodeFor(type) {
  return OPENING_REINFORCEMENT[type] || null;
}
export function withOpeningReinforcement(opening) {
  const code = reinforcementCodeFor(opening.type);
  if (!code) throw Error('Tipo de vano inválido');
  return { ...opening, reinforcementCode: code };
}

export function computeWallTakeoff(state) {
  const walls = {};
  const reinforcement = {
    P90: { code: 'P90', openings: 0, estimatedLinearM: 0, provisional: true },
    P91: { code: 'P91', openings: 0, estimatedLinearM: 0, provisional: true }
  };
  let totalGrossWallAreaM2 = 0, totalOpeningsAreaM2 = 0;
  for (const face of ['A', 'B', 'C', 'D']) {
    // H corresponde a altura útil desde piso terminado; no incluye el zócalo inferior.
    const span = face === 'A' || face === 'C' ? state.L : state.W;
    const gross = span * state.H;
    const openings = state.openings.filter(o => o.face === face);
    const deducted = openings.reduce((sum, o) => sum + o.w * o.h, 0);
    const net = Math.max(0, gross - deducted);
    walls[face] = {
      face, grossAreaM2: gross, openingsAreaM2: deducted,
      netAreaM2: net, liningCode: state.finishes.walls[face] || null,
      liningAreaM2: state.finishes.walls[face] ? net : 0
    };
    totalGrossWallAreaM2 += gross;
    totalOpeningsAreaM2 += deducted;
    for (const op of openings) {
      const code = reinforcementCodeFor(op.type);
      if (!code) continue;
      reinforcement[code].openings += 1;
      // Perímetro geométrico teórico. No incluye traslapes, uniones ni anclajes.
      reinforcement[code].estimatedLinearM += 2 * (op.w + op.h);
    }
  }
  return {
    walls, reinforcement, totalGrossWallAreaM2, totalOpeningsAreaM2,
    totalNetWallAreaM2: totalGrossWallAreaM2 - totalOpeningsAreaM2,
    status: 'preliminary',
    warning: 'Cubicación geométrica preliminar; P90/P91 y sus secciones requieren validación técnica. No representa BOM certificado ni precios.'
  };
}
