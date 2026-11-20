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
    x: obj.x,
    z: obj.z,
    y0: obj.y,
    y1: obj.y + obj.h,
    rx: (c * obj.w + s * obj.d) / 2,
    rz: (s * obj.w + c * obj.d) / 2
  };
}

export function partitionAABB(p, ref = null, panelThickness = null) {
  const q = ref ? resolvePartitionGeometry(p, ref, panelThickness) : p;
  const isXAxis = q.axis === 'x';
  return {
    x: q.cx,
    z: q.cz,
    y0: 0,
    y1: q.height,
    rx: isXAxis ? q.length / 2 : q.thickness / 2,
    rz: isXAxis ? q.thickness / 2 : q.length / 2,
    length: q.length,
    isXAxis
  };
}

export function aabbOverlap(a, b, clearance = 0.01) {
  return Math.abs(a.x - b.x) < a.rx + b.rx + clearance &&
    Math.abs(a.z - b.z) < a.rz + b.rz + clearance &&
    a.y0 < b.y1 && b.y0 < a.y1;
}

// SAT de rectángulos orientados (OBB en planta), con test vertical separado.
// AABB es la fase rápida; SAT evita rechazos falsos en mobiliario girado.
export function orientedOverlap(a, b, clearance = 0.01) {
  if (!aabbOverlap(objectAABB(a), objectAABB(b), clearance)) return false;
  const box = o => {
    const angle = (o.rot || 0) * Math.PI / 180;
    const c = Math.cos(angle), s = Math.sin(angle);
    return { x: o.x, z: o.z, ux: [c, -s], uz: [s, c], rw: o.w / 2, rd: o.d / 2 };
  };
  const A = box(a), B = box(b);
  const dx = B.x - A.x, dz = B.z - A.z;
  for (const axis of [A.ux, A.uz, B.ux, B.uz]) {
    const radius = r => r.rw * Math.abs(r.ux[0] * axis[0] + r.ux[1] * axis[1]) +
      r.rd * Math.abs(r.uz[0] * axis[0] + r.uz[1] * axis[1]);
    const distance = Math.abs(dx * axis[0] + dz * axis[1]);
    if (distance >= radius(A) + radius(B) + clearance) return false;
  }
  return true;
}
function partitionAsObject(p) {
  return {
    x: p.cx, z: p.cz, y: 0, w: p.length, d: p.thickness,
    h: p.height, rot: p.axis === 'z' ? 90 : 0
  };
}

export function validateObjectInsideContainer(obj, ref, panelThickness) {
  if (![obj.x, obj.y, obj.z, obj.w, obj.h, obj.d, obj.rot].every(finite) ||
      obj.w <= 0.02 || obj.h <= 0.02 || obj.d <= 0.008) {
    return 'Dimensiones o coordenadas del objeto inválidas';
  }
  const box = objectAABB(obj);
  const margin = interiorClearance(panelThickness);
  if (Math.abs(box.x) + box.rx > ref.L / 2 - margin + 1e-8 ||
      Math.abs(box.z) + box.rz > ref.W / 2 - margin + 1e-8) {
    return 'El objeto invade el perfil estructural o excede los límites interiores del contenedor';
  }
  if (box.y0 < 0 || box.y1 > ref.H + 1e-8) {
    return 'El objeto supera la altura útil o está bajo el piso terminado';
  }
  return null;
}

/**
 * Resuelve la geometría del tabique según una opción EXPRESA de autoajuste.
 * autoSpan=false/ausente conserva exactamente la longitud, posición y altura
 * del proyecto antiguo; nunca corrige datos inválidos de forma silenciosa.
 * autoSpan=true adopta la longitud útil completa del eje activo y centra el
 * tabique en ese eje para tocar ambos paramentos interiores (con holgura de
 * perfiles ya descontada). La posición sobre el otro eje se mantiene.
 * Es una aproximación geométrica, no una especificación estructural.
 */
export function resolvePartitionGeometry(p, ref, panelThickness) {
  if (!p || !['x', 'z'].includes(p.axis) ||
      ![ref?.L, ref?.W, ref?.H].every(n => finite(n) && n > 0) ||
      ![p.thickness, p.height, p.cx, p.cz].every(finite) ||
      p.thickness <= 0 || p.height <= 0) {
    throw Error('Dimensiones o eje del tabique inválidos');
  }
  if (p.autoSpan !== undefined && typeof p.autoSpan !== 'boolean') {
    throw Error('autoSpan debe ser booleano');
  }
  if (!p.autoSpan && (!finite(p.length) || p.length <= 0)) {
    throw Error('La longitud manual del tabique debe ser positiva');
  }
  const margin = interiorClearance(panelThickness);
  const usableL = ref.L - 2 * margin;
  const usableW = ref.W - 2 * margin;
  if (usableL <= 0 || usableW <= 0) throw Error('Espacio interior insuficiente para el tabique');
  if (!p.autoSpan) return { ...p, autoSpan: false };
  return {
    ...p,
    autoSpan: true,
    length: p.axis === 'x' ? usableL : usableW,
    cx: p.axis === 'x' ? 0 : p.cx,
    cz: p.axis === 'z' ? 0 : p.cz
  };
}

/**
 * Calcula el giro perpendicular de un tabique SIN modificar el original.
 * - Manual: conserva largo y centro; los límites se validan después.
 * - autoSpan: ajusta el largo al nuevo eje, como intervención explícita.
 * La comprobación de colisiones pertenece al motor y se realiza antes de guardar.
 */
export function resolveRotatedPartition(p, ref, panelThickness, { autoSpan = p?.autoSpan === true } = {}) {
  if (!p || !['x', 'z'].includes(p.axis) || typeof autoSpan !== 'boolean') {
    throw Error('Tabique o modo de rotación inválido');
  }
  return resolvePartitionGeometry({
    ...p,
    axis: p.axis === 'x' ? 'z' : 'x',
    autoSpan
  }, ref, panelThickness);
}

// Alias explícito para el código de integración inicial; no acota los datos
// manuales, pues hacerlo sin aviso modificaría diseños existentes.
export function sanitizeAndClampPartition(p, ref, panelThickness) {
  return resolvePartitionGeometry(p, ref, panelThickness);
}

export function validatePartitionInsideContainer(p, ref, panelThickness) {
  if (!p || !['x', 'z'].includes(p.axis) ||
      ![p.cx, p.cz, p.length, p.height, p.thickness].every(finite) ||
      p.length <= 0 || p.height <= 0 || p.thickness <= 0 || p.height > ref.H ||
      (p.autoSpan !== undefined && typeof p.autoSpan !== 'boolean')) {
    return 'Dimensiones o eje del tabique inválidos';
  }
  let resolved;
  try { resolved = resolvePartitionGeometry(p, ref, panelThickness); }
  catch (error) { return String(error.message || error); }
  // El estado persistido debe coincidir con la geometría que se dibuja.
  // Evita que la cubicación utilice longitud autoajustada mientras el 3D
  // y las colisiones conservan una longitud desactualizada.
  if (p.autoSpan === true &&
      (Math.abs(p.length - resolved.length) > 1e-7 ||
       Math.abs(p.cx - resolved.cx) > 1e-7 ||
       Math.abs(p.cz - resolved.cz) > 1e-7)) {
    return 'La geometría del tabique autoajustado no está sincronizada';
  }
  const box = partitionAABB(p);
  const margin = interiorClearance(panelThickness);
  if (Math.abs(box.x) + box.rx > ref.L / 2 - margin + 1e-8 ||
      Math.abs(box.z) + box.rz > ref.W / 2 - margin + 1e-8) {
    return 'El tabique invade el perfil estructural o excede los límites interiores';
  }
  return null;
}

export const FACES = Object.freeze(['A', 'B', 'C', 'D']);

// Aislamiento preliminar de esquineros, en metros. La verificación final
// de refuerzos debe realizarla un especialista según el tipo de contenedor.
export function validateOpeningCornerClearance(opening, span, cornerPostMargin = 0.14) {
  if (![opening.u, opening.w, span, cornerPostMargin].every(finite) ||
      opening.w <= 0 || span <= 0 || cornerPostMargin < 0) {
    return 'Dimensiones de abertura o margen de esquinero inválidos';
  }
  if (opening.u < cornerPostMargin - 1e-8 ||
      opening.u + opening.w > span - cornerPostMargin + 1e-8) {
    return 'La abertura y su refuerzo invaden la zona del esquinero estructural ISO';
  }
  return null;
}

export function rectanglesOverlap(a, b) {
  return a.u < b.u + b.w - 1e-8 && b.u < a.u + a.w - 1e-8 &&
    a.v < b.v + b.h - 1e-8 && b.v < a.v + a.h - 1e-8;
}

// Una zona compartida se registra en UNA cara del contenedor actual.
// Para modelos con varios contenedores cada superficie se registra en su
// propio modelo; no se descuenta dos veces de la misma cara.
export function validateSharedWallRegion(zone, state, excludeId = null) {
  if (!FACES.includes(zone?.face)) return 'Cara de muro compartido inválida';
  const { u, v, w, h } = zone;
  if (![u, v, w, h].every(finite) || w <= 0 || h <= 0) {
    return 'Posición o dimensiones de muro compartido inválidas';
  }
  const span = zone.face === 'A' || zone.face === 'C' ? state.L : state.W;
  if (u < 0 || v < 0 || u + w > span + 1e-8 || v + h > state.H + 1e-8) {
    return 'El muro compartido excede los límites de la cara seleccionada';
  }
  if ((state.openings || []).some(o => o.face === zone.face && rectanglesOverlap(o, zone))) {
    return 'El muro compartido no puede solaparse con una abertura';
  }
  if ((state.sharedWalls || []).some(other => other.id !== excludeId &&
      other.face === zone.face && rectanglesOverlap(other, zone))) {
    return 'La zona se superpone con otro muro compartido';
  }
  return null;
}

export function validateOpeningAgainstSharedWalls(opening, regions = []) {
  return regions.some(zone => zone.face === opening.face && rectanglesOverlap(opening, zone))
    ? 'La abertura se superpone con una zona de muro compartido' : null;
}

export function checkObjectCollisions(candidate, objects = [], partitions = []) {
  for (const other of objects) {
    if (other.id === candidate.id) continue;
    if (orientedOverlap(candidate, other)) {
      return 'El elemento se superpone físicamente con otro objeto';
    }
  }
  for (const partition of partitions) {
    if (orientedOverlap(candidate, partitionAsObject(partition))) {
      return 'El elemento se superpone con un tabique interior';
    }
  }
  return null;
}

/**
 * Encuentro constructivo de dos tabiques ortogonales (en planta).
 * Solo admite que el EXTREMO de una división llegue a una cara del tabique
 * anfitrión: ni solapamientos profundos ni cruces X. Las holguras son de
 * representación, no una especificación de uniones estructurales.
 *
 * Cara A = normal positiva del tabique (Z en eje X; X en eje Z).
 */
export function classifyPartitionJunction(a, b, tolerance = 0.003) {
  if (!a || !b || a.id === b.id || a.axis === b.axis ||
      !['x', 'z'].includes(a.axis) || !['x', 'z'].includes(b.axis) ||
      ![a.cx, a.cz, a.length, a.thickness, a.height,
        b.cx, b.cz, b.length, b.thickness, b.height, tolerance].every(finite) ||
      Math.min(a.length, b.length, a.thickness, b.thickness, a.height, b.height) <= 0 ||
      tolerance < 0 || Math.min(a.height, b.height) < 0.3) return null;

  function tryButt(host, branch) {
    const hostCross = host.axis === 'z' ? host.cx : host.cz;
    const branchLong = host.axis === 'z' ? branch.cx : branch.cz;
    const branchAlongHost = host.axis === 'z' ? branch.cz : branch.cx;
    const hostAlong = host.axis === 'z' ? host.cz : host.cx;
    const hostMin = hostAlong - host.length / 2;
    const hostMax = hostAlong + host.length / 2;
    const overlap = Math.min(hostMax, branchAlongHost + branch.thickness / 2) -
      Math.max(hostMin, branchAlongHost - branch.thickness / 2);
    // Una L puede contactar en el remate del tabique. Nunca basta el contacto
    // en un punto: debe quedar al menos media alma transversal de unión.
    if (overlap < Math.min(branch.thickness / 2, 0.03) - 1e-8) return null;
    const bMin = branchLong - branch.length / 2;
    const bMax = branchLong + branch.length / 2;
    const facePositive = hostCross + host.thickness / 2;
    const faceNegative = hostCross - host.thickness / 2;
    let side;
    if (Math.abs(bMin - facePositive) <= tolerance && bMax > facePositive + 0.05) side = 1;
    else if (Math.abs(bMax - faceNegative) <= tolerance && bMin < faceNegative - 0.05) side = -1;
    else return null;
    const atEnd = Math.min(Math.abs(branchAlongHost - hostMin),
      Math.abs(branchAlongHost - hostMax)) <= branch.thickness / 2 + 0.02;
    const hostU = host.axis === 'x' ? branchAlongHost - hostMin : hostMax - branchAlongHost;
    return {
      type: atEnd ? 'L' : 'T', hostId: host.id, branchId: branch.id,
      hostFace: side === 1 ? 'A' : 'B', side,
      hostU, contactWidthM: overlap,
      contactHeightM: Math.min(host.height, branch.height)
    };
  }
  return tryButt(a, b) || tryButt(b, a);
}

export function checkJunctionAgainstDoors(junction, doors = []) {
  if (!junction) return null;
  const halfWidth = junction.contactWidthM / 2;
  const start = junction.hostU - halfWidth;
  const end = junction.hostU + halfWidth;
  return doors.some(d => d.partitionId === junction.hostId &&
    start < d.u + d.w + 0.015 - 1e-8 && end > d.u - 0.015 + 1e-8)
    ? 'El encuentro T/L coincide con el vano de una puerta interior' : null;
}

export function computePartitionJunctions(partitions = [], doors = []) {
  if (!Array.isArray(partitions)) throw Error('Tabiques inválidos para encuentros');
  const junctions = [];
  for (let i = 0; i < partitions.length; i++) for (let j = i + 1; j < partitions.length; j++) {
    const junction = classifyPartitionJunction(partitions[i], partitions[j]);
    if (!junction) continue;
    const conflict = checkJunctionAgainstDoors(junction, doors);
    if (conflict) throw Error(conflict);
    junctions.push(junction);
  }
  return junctions;
}

export function checkPartitionCollisions(candidate, partitions = [], objects = [], interiorDoors = []) {
  for (const other of partitions) {
    if (other.id === candidate.id) continue;
    if (orientedOverlap(partitionAsObject(candidate), partitionAsObject(other))) {
      const joint = classifyPartitionJunction(candidate, other);
      if (!joint) return 'El tabique se superpone con otro tabique (cruce o invasión no admisible)';
      const doorError = checkJunctionAgainstDoors(joint, interiorDoors);
      if (doorError) return doorError;
    }
  }
  for (const obj of objects) {
    if (orientedOverlap(partitionAsObject(candidate), obj)) {
      return 'El tabique se superpone con un objeto existente';
    }
  }
  return null;
}


/**
 * Vista previa de desplazamiento con imán, SIN modificar el estado.
 * Mantiene longitud, orientación, altura y capas existentes. El ajuste solo
 * traslada el centro del tabique y se acepta si pasa las reglas T/L, objetos,
 * esquineros, puertas y límites interiores. No crea juntas estructurales.
 *
 * autoSpan=true: la coordenada del eje largo se mantiene fija; solo se puede
 * desplazar el tabique perpendicularmente (entre vanos a lo largo del módulo).
 */
export function resolveMagneticPartitionMove(p, position, ref, panelThickness, options = {}) {
  if (!p || !position || ![position.cx, position.cz].every(finite) ||
      !['x', 'z'].includes(p.axis) ||
      ![p.length, p.thickness, p.height, ref?.L, ref?.W].every(finite) ||
      Math.min(p.length, p.thickness, p.height, ref.L, ref.W) <= 0) {
    return { ok: false, error: 'Coordenadas o geometría del tabique inválidas' };
  }
  const partitions = options.partitions || [];
  const objects = options.objects || [];
  const interiorDoors = options.interiorDoors || [];
  const snap = options.snap !== false;
  const snapDistance = options.snapDistance ?? 0.18;
  if (!finite(snapDistance) || snapDistance < 0 || snapDistance > 0.5 ||
      !Array.isArray(partitions) || !Array.isArray(objects) || !Array.isArray(interiorDoors)) {
    return { ok: false, error: 'Opciones de ajuste magnético inválidas' };
  }
  const margin = interiorClearance(panelThickness);
  const longAxis = p.axis === 'x' ? 'cx' : 'cz';
  const crossAxis = p.axis === 'x' ? 'cz' : 'cx';
  const longDim = p.axis === 'x' ? ref.L : ref.W;
  const crossDim = p.axis === 'x' ? ref.W : ref.L;
  const limitLong = longDim / 2 - margin - p.length / 2;
  const limitCross = crossDim / 2 - margin - p.thickness / 2;
  if (limitLong < -1e-8 || limitCross < -1e-8) {
    return { ok: false, error: 'El tabique no cabe en los límites interiores' };
  }
  const cap = (v, max) => Math.min(max, Math.max(-max, v));
  const base = { ...p };
  base[longAxis] = p.autoSpan === true ? 0 : cap(position[longAxis], Math.max(0, limitLong));
  base[crossAxis] = cap(position[crossAxis], Math.max(0, limitCross));
  const check = candidate => validatePartitionInsideContainer(candidate, ref, panelThickness) ||
    validatePartitionSpecification(candidate) ||
    checkPartitionCollisions(candidate, partitions, objects, interiorDoors) ||
    interiorDoors.filter(d => d.partitionId === p.id)
      .map(d => validateInteriorDoor(d, candidate, interiorDoors)).find(Boolean) || null;
  const directError = check(base);
  if (!snap || p.autoSpan === true) {
    return directError ? { ok: false, error: directError } : { ok: true, candidate: base, snappedTo: null };
  }

  const proposals = [];
  const start = base[longAxis] - p.length / 2;
  const end = base[longAxis] + p.length / 2;
  const lowWall = -longDim / 2 + margin;
  const highWall = longDim / 2 - margin;
  const near = (endpoint, target, label) => {
    const delta = target - endpoint;
    if (Math.abs(delta) <= snapDistance + 1e-9) {
      const candidate = { ...base, [longAxis]: base[longAxis] + delta };
      // No se permite que el imán desplace el tabique fuera de los perfiles.
      if (Math.abs(candidate[longAxis]) <= limitLong + 1e-8) {
        proposals.push({ candidate, snappedTo: label, distance: Math.abs(delta) });
      }
    }
  };
  near(start, lowWall, p.axis === 'x' ? 'Pared interior X−' : 'Pared interior Z−');
  near(end, highWall, p.axis === 'x' ? 'Pared interior X+' : 'Pared interior Z+');

  for (const host of partitions) {
    if (host.id === p.id || host.axis === p.axis) continue;
    // El punto transversal de la rama debe contactar con un segmento del host,
    // no simplemente pasar cerca de su prolongación infinita.
    const hostAlong = p.axis === 'x' ? host.cz : host.cx;
    const hostMin = hostAlong - host.length / 2;
    const hostMax = hostAlong + host.length / 2;
    const contact = Math.min(hostMax, base[crossAxis] + p.thickness / 2) -
      Math.max(hostMin, base[crossAxis] - p.thickness / 2);
    // En una T mantenemos la coordenada transversal del usuario.
    // Si la rama se aproxima al extremo, también ofrecemos un imán en ambas
    // coordenadas para cerrar una esquina L sin dejar separaciones pequeñas.
    const crossTargets = contact >= Math.min(p.thickness / 2, 0.03) - 1e-8 ?
      [base[crossAxis]] : [hostMin, hostMax].filter(value =>
        Math.abs(value - base[crossAxis]) <= snapDistance + 1e-8 &&
        Math.abs(value) <= limitCross + 1e-8);
    const hostCross = p.axis === 'x' ? host.cx : host.cz;
    for (const transverse of crossTargets) {
      for (const [endpoint, target] of [
        [end, hostCross - host.thickness / 2],
        [start, hostCross + host.thickness / 2]
      ]) {
        const dl = target - endpoint;
        const dc = transverse - base[crossAxis];
        if (Math.abs(dl) > snapDistance + 1e-8 || Math.abs(dc) > snapDistance + 1e-8) continue;
        const candidate = { ...base,
          [longAxis]: base[longAxis] + dl,
          [crossAxis]: transverse };
        if (Math.abs(candidate[longAxis]) > limitLong + 1e-8) continue;
        proposals.push({ candidate, snappedTo: `Unión con ${host.id}`,
          distance: Math.hypot(dl, dc) });
      }
    }
  }
  proposals.sort((a, b) => a.distance - b.distance);
  for (const proposal of proposals) {
    if (check(proposal.candidate)) continue;
    // Una unión real requiere la coincidencia geométrica de testa con cara.
    // Las colisiones adyacentes siguen sujetas al validador normal.
    return { ok: true, candidate: proposal.candidate, snappedTo: proposal.snappedTo };
  }
  return directError ? { ok: false, error: directError } :
    { ok: true, candidate: base, snappedTo: null };
}

export function reinforcementCodeFor(type) {
  return OPENING_REINFORCEMENT[type] || null;
}

export function withOpeningReinforcement(opening) {
  const code = reinforcementCodeFor(opening.type);
  if (!code) throw Error('Tipo de vano inválido');
  return { ...opening, reinforcementCode: code };
}

// Estimación de proyecto para planificar un segundo contenedor. Esta función
// NO aplica el descuento al editor de un único módulo y requiere confirmar
// en terreno la longitud y la altura de contacto real.
export function computeSharedWallDeduction(primaryDims, secondaryDims, layout = 'single') {
  if (![primaryDims?.L, primaryDims?.W, primaryDims?.H,
        secondaryDims?.L, secondaryDims?.W, secondaryDims?.H]
      .every(n => finite(n) && n > 0)) throw Error('Dimensiones de módulos inválidas');
  if (!['single', 'double', 'lshape'].includes(layout)) throw Error('Distribución de módulos inválida');
  if (layout === 'double') return 2 * Math.min(primaryDims.L, secondaryDims.L) * Math.min(primaryDims.H, secondaryDims.H);
  if (layout === 'lshape') return 2 * Math.min(primaryDims.W, secondaryDims.W) * Math.min(primaryDims.H, secondaryDims.H);
  return 0;
}

// Catálogo de terminaciones y aislantes admitidos para tabiques independientes.
export const PARTITION_LINING_CODES = Object.freeze(['P30', 'P31', 'P32', 'P33', 'P34', 'P35']);
// P35 es espesor de representación aproximado; verificar ficha técnica.
export const PARTITION_LINING_THICKNESS_M = Object.freeze({ P30: .015, P31: .015, P32: .006, P33: .012, P34: .0095, P35: .008 });
export const PARTITION_INSULATION_CODES = Object.freeze(['P20', 'P21', 'P22']);

/** La coordenada u se mide desde el extremo inicial (-L/2) del tabique. */
export function validateInteriorDoor(door, partition, existingDoors = []) {
  if (!partition || !door || door.partitionId !== partition.id) return 'Tabique anfitrión inexistente para la puerta interior';
  if (!['P80', 'P81'].includes(door.catalogCode)) return 'Partida de puerta interior inválida';
  if (![door.u, door.w, door.h, partition.length, partition.height].every(finite) ||
      door.w < 0.35 || door.h < 1.2 || door.h >= partition.height - 0.05 + 1e-8) {
    return 'Dimensiones de la puerta interior o dintel inválidos';
  }
  const margin = 0.08;
  if (door.u < margin - 1e-8 || door.u + door.w > partition.length - margin + 1e-8) {
    return 'La puerta interior excede el largo útil del tabique (margen mínimo 8 cm)';
  }
  if (!Array.isArray(existingDoors)) return 'Lista de puertas interiores inválida';
  for (const other of existingDoors) {
    if (other.id === door.id || other.partitionId !== partition.id) continue;
    if (door.u < other.u + other.w + 0.05 - 1e-8 && other.u < door.u + door.w + 0.05 - 1e-8) {
      return 'Puertas interiores solapadas o separadas menos de 5 cm';
    }
  }
  return null;
}

export function validatePartitionSpecification(p) {
  if (!p || (p.faceALining != null && !PARTITION_LINING_CODES.includes(p.faceALining)) ||
      (p.faceBLining != null && !PARTITION_LINING_CODES.includes(p.faceBLining))) {
    return 'Revestimiento de tabique inválido';
  }
  if (typeof p.hasInsulation !== 'boolean' ||
      (p.hasInsulation && !PARTITION_INSULATION_CODES.includes(p.insulationCode)) ||
      (!p.hasInsulation && p.insulationCode != null)) {
    return 'Configuración de aislación de tabique inválida';
  }
  const plates = (PARTITION_LINING_THICKNESS_M[p.faceALining] || 0) +
    (PARTITION_LINING_THICKNESS_M[p.faceBLining] || 0);
  // Los proyectos legados sin capas pueden tener espesores inferiores a 35 mm.
  const requiredCore = p.hasInsulation ? 0.05 : (plates > 0 ? 0.01 : 0);
  if (!finite(p.thickness) || p.thickness + 1e-9 < plates + requiredCore) {
    return 'El espesor del tabique no permite alojar el núcleo y las capas seleccionadas';
  }
  return null;
}

/**
 * Reserva de superficie de piso para baño (sin coordenadas en planta).
 * La especificación de materiales y la ubicación física son etapas separadas.
 * Conserva floorAreaM2 bruto para compatibilidad con las versiones previas.
 */
export function validateBathFloor(bathFloor, containerDims, panelThickness = null) {
  if (bathFloor == null) return null;
  if (!bathFloor || typeof bathFloor !== 'object' || Array.isArray(bathFloor)) {
    return 'Configuración de piso de baño inválida';
  }
  const { length, width, code } = bathFloor;
  if (typeof code !== 'string' || !code.trim()) {
    return 'Selecciona una partida de piso para el baño';
  }
  if (![length, width].every(n => finite(n) && n > 0)) {
    return 'El largo y el ancho del baño deben ser números positivos';
  }
  if (!containerDims || ![containerDims.L, containerDims.W].every(n => finite(n) && n > 0)) {
    return 'Dimensiones del contenedor inválidas';
  }
  if (panelThickness !== null && (!finite(panelThickness) || panelThickness < 0)) {
    return 'Espesor estructural inválido';
  }
  const margin = panelThickness == null ? 0 : interiorClearance(panelThickness);
  const usableL = containerDims.L - 2 * margin;
  const usableW = containerDims.W - 2 * margin;
  if (usableL <= 0 || usableW <= 0 || length > usableL + 1e-8 || width > usableW + 1e-8) {
    return `Las dimensiones del baño (${length.toFixed(2)} × ${width.toFixed(2)} m) exceden el interior útil (${Math.max(0,usableL).toFixed(2)} × ${Math.max(0,usableW).toFixed(2)} m)`;
  }
  if (length * width > containerDims.L * containerDims.W + 1e-8) {
    return 'La superficie del baño supera el piso total';
  }
  return validateBathPlacement(bathFloor, containerDims, panelThickness);
}

/**
 * Detect a *rectangular* enclosure in plan view from the actual axis-aligned
 * footprints of interior partitions. A partition is considered a room boundary
 * even when it has a door: doors separate named rooms for finish selection.
 * Partial/open and nonrectangular regions are intentionally rejected.
 * The visible region is inside structural-clearance limits, not L×W gross.
 */
export function detectRectangularRoomAt(point, ref, panelThickness) {
  const failed = error => ({ ok: false, error });
  if (!point || ![point.x, point.z, ref?.L, ref?.W].every(finite)) {
    return failed('Haz clic en una posición válida del piso');
  }
  if (!Array.isArray(ref.partitions) || ref.partitions.length === 0) {
    return failed('Primero crea tabiques que delimiten el baño; también puedes ubicar una zona por clic');
  }
  const margin = interiorClearance(panelThickness);
  const minX = -ref.L / 2 + margin, maxX = ref.L / 2 - margin;
  const minZ = -ref.W / 2 + margin, maxZ = ref.W / 2 - margin;
  if (point.x <= minX || point.x >= maxX || point.z <= minZ || point.z >= maxZ) {
    return failed('Selecciona un punto dentro del piso útil del contenedor');
  }
  const xs = [minX, maxX], zs = [minZ, maxZ];
  const blockers = [];
  for (const p of ref.partitions) {
    if (!['x', 'z'].includes(p.axis) ||
        ![p.cx, p.cz, p.length, p.thickness].every(finite) ||
        p.length <= 0 || p.thickness <= 0) {
      return failed('Existe un tabique sin geometría válida para detectar recintos');
    }
    const b = partitionAABB(p);
    const x0 = Math.max(minX, b.x - b.rx), x1 = Math.min(maxX, b.x + b.rx);
    const z0 = Math.max(minZ, b.z - b.rz), z1 = Math.min(maxZ, b.z + b.rz);
    if (x1 <= x0 || z1 <= z0) continue;
    blockers.push({ x0, x1, z0, z1 });
    xs.push(x0, x1); zs.push(z0, z1);
  }
  const unique = values => values.sort((a,b)=>a-b).filter((v,i,arr)=>i===0||v-arr[i-1]>1e-7);
  const xEdges = unique(xs), zEdges = unique(zs);
  const nx = xEdges.length - 1, nz = zEdges.length - 1;
  if (nx < 1 || nz < 1 || nx * nz > 300000) {
    return failed('El plano es demasiado complejo para detectar automáticamente un recinto');
  }
  const locate = (value, edges) => {
    let lo=0, hi=edges.length-1;
    while (lo+1<hi) { const mid=(lo+hi)>>1; if (value < edges[mid]) hi=mid; else lo=mid; }
    return lo;
  };
  const blocked = new Uint8Array(nx*nz);
  for (let j=0;j<nz;j++) for(let i=0;i<nx;i++) {
    const x=(xEdges[i]+xEdges[i+1])/2, z=(zEdges[j]+zEdges[j+1])/2;
    if (blockers.some(b=> x>b.x0+1e-9 && x<b.x1-1e-9 && z>b.z0+1e-9 && z<b.z1-1e-9)) {
      blocked[j*nx+i]=1;
    }
  }
  const startI=locate(point.x,xEdges), startJ=locate(point.z,zEdges);
  const start=startJ*nx+startI;
  if (blocked[start]) return failed('Haz clic sobre el piso libre, no encima de un tabique');
  const visited=new Uint8Array(nx*nz), queue=[start];
  visited[start]=1;
  let minI=startI,maxI=startI,minJ=startJ,maxJ=startJ,area=0;
  for(let index=0;index<queue.length;index++) {
    const cell=queue[index],i=cell%nx,j=Math.floor(cell/nx);
    area+=(xEdges[i+1]-xEdges[i])*(zEdges[j+1]-zEdges[j]);
    minI=Math.min(minI,i);maxI=Math.max(maxI,i);
    minJ=Math.min(minJ,j);maxJ=Math.max(maxJ,j);
    for(const n of [i>0?cell-1:-1, i<nx-1?cell+1:-1,
                    j>0?cell-nx:-1,j<nz-1?cell+nx:-1]) {
      if(n>=0 && !blocked[n] && !visited[n]) {visited[n]=1;queue.push(n);}
    }
  }
  const x0=xEdges[minI], x1=xEdges[maxI+1], z0=zEdges[minJ], z1=zEdges[maxJ+1];
  const length=x1-x0,width=z1-z0,rectangleArea=length*width;
  if(length<0.4 || width<0.4) return failed('El recinto detectado es demasiado pequeño');
  if(Math.abs(rectangleArea-area)>Math.max(1e-5,rectangleArea*1e-5)) {
    return failed('El espacio tiene una forma abierta o irregular; delimita un recinto rectangular con tabiques o usa zona manual');
  }
  // Reject the entire container interior: that means the partitions do not
  // divide the area into closed rooms. Do not silently tile the whole module.
  if(Math.abs(rectangleArea-(maxX-minX)*(maxZ-minZ))<1e-5) {
    return failed('No se encontró un recinto separado: cierra el baño con tabiques antes de seleccionarlo');
  }
  return {ok:true, length, width, cx:(x0+x1)/2, cz:(z0+z1)/2, areaM2:rectangleArea};
}

/** Validate optional placement coordinates while preserving older area-only JSON. */
export function validateBathPlacement(bathFloor, ref, panelThickness) {
  if (bathFloor == null) return null;
  const hasX=Object.prototype.hasOwnProperty.call(bathFloor,'cx');
  const hasZ=Object.prototype.hasOwnProperty.call(bathFloor,'cz');
  if (hasX!==hasZ) return 'La ubicación del piso del baño necesita Centro X y Centro Z';
  if(!hasX) return null; // Legacy quantitative allocation, not drawn.
  if (![bathFloor.cx,bathFloor.cz].every(finite)) return 'Coordenadas del piso de baño inválidas';
  const margin = panelThickness == null ? 0 : interiorClearance(panelThickness);
  const lx=ref.L/2-margin, lz=ref.W/2-margin;
  const hx=bathFloor.length/2, hz=bathFloor.width/2;
  if(Math.abs(bathFloor.cx)+hx>lx+1e-8 || Math.abs(bathFloor.cz)+hz>lz+1e-8) {
    return 'El piso del baño invade perfiles o excede los límites interiores';
  }
  for(const p of ref.partitions||[]) {
    const b=partitionAABB(p);
    if(Math.abs(bathFloor.cx-b.x)<hx+b.rx-1e-8 &&
       Math.abs(bathFloor.cz-b.z)<hz+b.rz-1e-8) {
      return 'El piso del baño se superpone con un tabique; vuelve a seleccionar el recinto';
    }
  }
  return null;
}

export function computeWallTakeoff(state) {
  if (![state.L, state.W, state.H].every(n => finite(n) && n > 0)) {
    throw Error('Dimensiones del contenedor inválidas para cubicación');
  }
  // El único dato contable para paredes compartidas es state.sharedWalls.
  // Rechazamos regiones inválidas en vez de producir totales incoherentes.
  const regions = state.sharedWalls || [];
  const zoneIds = new Set();
  for (const zone of regions) {
    if (zoneIds.has(zone.id)) throw Error('ID duplicado en zona de contacto');
    zoneIds.add(zone.id);
    const issue = validateSharedWallRegion(zone, state, zone.id);
    if (issue) throw Error(issue);
  }
  const walls = {};
  const reinforcement = {
    P90: { code: 'P90', openings: 0, estimatedLinearM: 0, provisional: true },
    P91: { code: 'P91', openings: 0, estimatedLinearM: 0, provisional: true }
  };
  let totalGrossWallAreaM2 = 0;
  let totalOpeningsAreaM2 = 0;
  let sharedDeductionM2 = 0;
  let skirtingLinearM = 0;

  for (const face of FACES) {
    const span = face === 'A' || face === 'C' ? state.L : state.W;
    const gross = span * state.H;
    const openings = (state.openings || []).filter(o => o.face === face);
    const openingArea = openings.reduce((sum, o) => sum + o.w * o.h, 0);
    const sharedAreas = regions.filter(x => x.face === face);
    const shared = sharedAreas.reduce((sum, x) => sum + x.w * x.h, 0);
    const net = Math.max(0, gross - openingArea - shared);
    const finish = state.finishes?.walls?.[face] || null;
    walls[face] = {
      face, grossAreaM2: gross, openingsAreaM2: openingArea,
      sharedDeductionM2: shared, netAreaM2: net,
      liningCode: finish, liningAreaM2: finish ? net : 0
    };
    totalGrossWallAreaM2 += gross;
    totalOpeningsAreaM2 += openingArea;
    sharedDeductionM2 += shared;

    // Descontar tramos reales a nivel de piso, por cara: vanos de puerta
    // y paños compartidos. La validación impide que se superpongan.
    const doorWidth = openings.filter(o => o.type === 'door' && o.v <= 0.05)
      .reduce((sum, o) => sum + o.w, 0);
    const sharedBase = sharedAreas.filter(x => x.v <= 0.05)
      .reduce((sum, x) => sum + x.w, 0);
    skirtingLinearM += Math.max(0, span - doorWidth - sharedBase);

    for (const op of openings) {
      const code = reinforcementCodeFor(op.type);
      if (code) {
        reinforcement[code].openings++;
        reinforcement[code].estimatedLinearM += 2 * (op.w + op.h);
      }
    }
  }
  const totalNetWallAreaM2 = FACES.reduce((sum, face) => sum + walls[face].netAreaM2, 0);
  const interiorDoors = state.interiorDoors || [];
  if (!Array.isArray(interiorDoors)) throw Error('Puertas interiores inválidas en la cubicación');
  // Los encuentros se realizan cara contra testa: sin invasión física y sin
  // descontar arbitrariamente revestimientos continuos del anfitrión.
  const partitionJunctions = computePartitionJunctions(state.partitions || [], interiorDoors);
  const partitionTJunctionsCount = partitionJunctions.filter(j => j.type === 'T').length;
  const partitionLJunctionsCount = partitionJunctions.filter(j => j.type === 'L').length;
  const uniqueDoors = new Set();
  for (const d of interiorDoors) {
    if (uniqueDoors.has(d.id)) throw Error('Puerta interior duplicada');
    uniqueDoors.add(d.id);
    const host = (state.partitions || []).find(p => p.id === d.partitionId);
    const err = validateInteriorDoor(d, host, interiorDoors);
    if (err) throw Error('Puerta interior inválida en la cubicación: ' + err);
  }
  let totalPartitionLiningAreaM2 = 0;
  let totalPartitionInsulationAreaM2 = 0;
  const partitionLiningByCodeM2 = {};
  const partitionInsulationByCodeM2 = {};
  const interiorDoorsByCode = {};
  for (const d of interiorDoors) interiorDoorsByCode[d.catalogCode] = (interiorDoorsByCode[d.catalogCode] || 0) + 1;
  const partitions = (state.partitions || []).map(p => {
    if (![p.length, p.height].every(finite) || p.length <= 0 || p.height <= 0)
      throw Error('Tabique sin geometría válida en la cubicación');
    const specError = validatePartitionSpecification({
      ...p, faceALining: p.faceALining ?? null, faceBLining: p.faceBLining ?? null,
      hasInsulation: p.hasInsulation === true,
      insulationCode: p.hasInsulation === true ? (p.insulationCode || 'P20') : null
    });
    if (specError) throw Error(specError);
    const doors = interiorDoors.filter(d => d.partitionId === p.id);
    const doorsAreaM2 = doors.reduce((sum, d) => sum + d.w * d.h, 0);
    const grossOneFaceM2 = p.length * p.height;
    const oneFaceAreaM2 = grossOneFaceM2 - doorsAreaM2;
    if (oneFaceAreaM2 < -1e-8) throw Error('Las puertas exceden la superficie del tabique');
    const faceALining = p.faceALining || null;
    const faceBLining = p.faceBLining || null;
    const faceALiningAreaM2 = faceALining ? Math.max(0, oneFaceAreaM2) : 0;
    const faceBLiningAreaM2 = faceBLining ? Math.max(0, oneFaceAreaM2) : 0;
    const hasInsulation = p.hasInsulation === true;
    const insulationCode = hasInsulation ? (p.insulationCode || 'P20') : null;
    const insulationAreaM2 = hasInsulation ? Math.max(0, oneFaceAreaM2) : 0;
    if (faceALining) partitionLiningByCodeM2[faceALining] = (partitionLiningByCodeM2[faceALining] || 0) + faceALiningAreaM2;
    if (faceBLining) partitionLiningByCodeM2[faceBLining] = (partitionLiningByCodeM2[faceBLining] || 0) + faceBLiningAreaM2;
    if (insulationCode) partitionInsulationByCodeM2[insulationCode] = (partitionInsulationByCodeM2[insulationCode] || 0) + insulationAreaM2;
    totalPartitionLiningAreaM2 += faceALiningAreaM2 + faceBLiningAreaM2;
    totalPartitionInsulationAreaM2 += insulationAreaM2;
    return {
      id: p.id, axis: p.axis, autoSpan: p.autoSpan === true,
      lengthM: p.length, heightM: p.height, doorsCount: doors.length, doorsAreaM2,
      grossOneFaceM2, oneFaceAreaM2: Math.max(0, oneFaceAreaM2),
      bothFacesAreaM2: Math.max(0, oneFaceAreaM2) * 2,
      faceALining, faceALiningAreaM2, faceBLining, faceBLiningAreaM2,
      hasInsulation, insulationCode, insulationAreaM2
    };
  });
  const totalPartitionOneFaceAreaM2 = partitions.reduce((sum, p) => sum + p.oneFaceAreaM2, 0);
  const totalPartitionBothFacesAreaM2 = partitions.reduce((sum, p) => sum + p.bothFacesAreaM2, 0);
  const floorAreaM2 = state.L * state.W;
  // Asignación contable: el piso de baño consume superficie del piso general,
  // sin reducir el área bruta ni representar una ubicación inexistente en 3D.
  const rawBath = state.bathFloor ?? null;
  const bathIssue = validateBathFloor(rawBath, state);
  if (bathIssue) throw Error(bathIssue);
  const bathFloorAreaM2 = rawBath ? rawBath.length * rawBath.width : 0;
  const remainingFloorAreaM2 = Math.max(0, floorAreaM2 - bathFloorAreaM2);
  const bathFloor = rawBath ? {
    code: rawBath.code, lengthM: rawBath.length, widthM: rawBath.width,
    positioned: Number.isFinite(rawBath.cx) && Number.isFinite(rawBath.cz),
    cx: rawBath.cx ?? null, cz: rawBath.cz ?? null,
    areaM2: bathFloorAreaM2
  } : null;
  const generalFloorCode = state.finishes?.floor || null;
  const floorByCodeM2 = {};
  if (generalFloorCode && remainingFloorAreaM2 > 0) floorByCodeM2[generalFloorCode] = remainingFloorAreaM2;
  if (bathFloor && bathFloorAreaM2 > 0) {
    floorByCodeM2[bathFloor.code] = (floorByCodeM2[bathFloor.code] || 0) + bathFloorAreaM2;
  }
  return {
    walls, partitions, interiorDoorsCount: interiorDoors.length, interiorDoorsByCode,
    partitionJunctions, partitionTJunctionsCount, partitionLJunctionsCount,
    totalPartitionOneFaceAreaM2, totalPartitionBothFacesAreaM2,
    totalPartitionLiningAreaM2, totalPartitionInsulationAreaM2,
    partitionLiningByCodeM2, partitionInsulationByCodeM2,
    floorAreaM2, ceilingAreaM2: floorAreaM2, skirtingLinearM,
    bathFloor, bathFloorAreaM2, remainingFloorAreaM2, floorByCodeM2,
    reinforcement, totalGrossWallAreaM2, totalOpeningsAreaM2,
    sharedDeductionM2, totalNetWallAreaM2,
    status: 'preliminary',
    warning: 'Cubicación geométrica preliminar: superficies netas de placas y aislación de tabiques. Encuentros T/L de cara contra testa sin invasión; requiere definir anclajes y refuerzos en proyecto constructivo. No considera mermas, perfilería, fijaciones, dinteles estructurales, costos ni certificación estructural.'
  };
}
