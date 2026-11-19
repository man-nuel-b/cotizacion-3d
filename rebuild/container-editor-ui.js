import { CATALOG, CATALOG_BY_CODE, FAMILIES, findCatalog } from './container-catalog.js';

export function installEditor({ THREE, renderer, camera, controls, root, api, state, FACES, FLOOR, syncPanel }) {
  const $ = id => document.getElementById(id);
  const raycaster = new THREE.Raycaster(), mouse = new THREE.Vector2();
  let pendingCode = null, drag = null, pointerOrigin = null;

  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
  const number = id => Number(String($(id).value).replace(',', '.'));

  function hint(message, error = false) {
    const node = $('scene-hint');
    node.textContent = message;
    node.style.background = error ? 'rgba(140,41,38,.95)' : 'rgba(18,35,54,.92)';
  }

  function familyName(id) { return FAMILIES.find(f => f.id === id)?.name || id; }
  function modeLabel(item) {
    return ({
      object: 'Modelo 3D', 'wall-object': 'Ensamble 3D', opening: 'Abertura real',
      floor: 'Aplicar al piso', 'wall-finish': 'Aplicar a pared',
      ceiling: 'Aplicar al cielo', skirting: 'Zócalo perimetral', service: 'Gestión sin geometría'
    })[item.mode] || item.mode;
  }

  for (const family of FAMILIES) {
    const option = document.createElement('option');
    option.value = family.id; option.textContent = family.name;
    $('catalog-family').appendChild(option);
  }

  function renderCatalog() {
    const items = findCatalog($('catalog-search').value, $('catalog-family').value);
    const list = $('catalog-list'); list.replaceChildren();
    $('catalog-count').textContent = items.length + ' de ' + CATALOG.length + ' partidas';
    for (const item of items) {
      const btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'catalog-item' + (pendingCode === item.code ? ' active' : '');
      btn.dataset.code = item.code;
      const code = document.createElement('span'); code.className = 'code'; code.textContent = item.code;
      const copy = document.createElement('span'); copy.className = 'item-copy';
      copy.textContent = item.name;
      const meta = document.createElement('small'); meta.textContent = familyName(item.family) + ' · ' + modeLabel(item);
      copy.appendChild(meta); btn.append(code, copy);
      btn.addEventListener('click', () => arm(item.code)); list.appendChild(btn);
    }
  }

  function isWallApplication(item) {
    return item?.mode === 'wall-finish' ||
      (item?.mode === 'wall-object' && ['wall-lining', 'wet-lining'].includes(item.visual));
  }

  function arm(code) {
    const item = CATALOG_BY_CODE[code]; if (!item) return;
    if (item.mode === 'service') {
      const result = api.addService(code); if (!result.ok) { hint(result.error, true); return; }
      pendingCode = null; $('wall-finish-controls').hidden = true;
      hint(code + ': Servicio técnico incorporado al listado, sin objeto físico.'); renderCatalog();
      return;
    }
    pendingCode = code; renderCatalog();
    $('wall-finish-controls').hidden = !isWallApplication(item);
    $('apply-wall-finish').textContent = item.mode === 'wall-finish'
      ? 'Aplicar revestimiento a esta cara' : 'Instalar trasdosado en esta cara';
    $('wall-control-explain').textContent = item.mode === 'wall-finish'
      ? 'La terminación cubre la superficie del muro seleccionado.'
      : 'P14/P17 se instalará como un panel 3D de 1,60 m en la cara indicada.';

    const msg = item.mode === 'floor' || item.mode === 'ceiling' || item.mode === 'skirting' ?
      'Haz clic en el contenedor para aplicar la terminación' :
      isWallApplication(item) || item.mode === 'opening' ?
        'Haz clic en una de las paredes del contenedor para elegir la cara' :
        'Haz clic dentro del contenedor para ubicar el objeto 3D';
    hint(item.code + ': ' + msg);
    if (['object', 'wall-object', 'floor', 'ceiling', 'skirting'].includes(item.mode)) {
      if (!state.seeInside) { api.setSeeInside(true); $('xray').checked = true; }
    }
  }

  function clearPending() {
    pendingCode = null; renderCatalog(); $('wall-finish-controls').hidden = true;
    hint('Selecciona una partida del catálogo o un objeto del modelo para modificarlo.');
  }

  function rayFor(event) {
    const bounds = renderer.domElement.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return null;
    mouse.set(((event.clientX - bounds.left) / bounds.width) * 2 - 1,
      -((event.clientY - bounds.top) / bounds.height) * 2 + 1);
    raycaster.setFromCamera(mouse, camera); return raycaster;
  }

  function wallHit(ray) {
    const panels = [];
    root.traverse(node => {
      if (node.isMesh && node.userData.isPanel && !node.userData.isRoof && FACES[node.userData.wallFace]) {
        panels.push(node);
      }
    });
    root.updateMatrixWorld(true);
    const hits = ray.intersectObjects(panels, false);
    if (!hits.length) return null;
    const hit = hits[0];
    return { face: hit.object.userData.wallFace, point: hit.point, dist: hit.distance };
  }

  function floorHit(ray) {
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -FLOOR - .008);
    const pt = ray.ray.intersectPlane(plane, new THREE.Vector3());
    if (pt && Math.abs(pt.x) <= state.L / 2 + .2 && Math.abs(pt.z) <= state.W / 2 + .2) return pt;
    const hit = wallHit(ray);
    return hit?.point || null;
  }

  function sideU(face, p) {
    if (face === 'A') return p.x + state.L / 2;
    if (face === 'C') return state.L / 2 - p.x;
    if (face === 'B') return state.W / 2 - p.z;
    return p.z + state.W / 2;
  }

  function objectRayPick(ray) {
    const hits = ray.intersectObjects(root.children, true);
    for (const hit of hits) {
      const node = hit.object;
      if (node.userData.interiorDoorId) return { kind: 'interiorDoor', id: node.userData.interiorDoorId };
      if (node.userData.partitionId) return { kind: 'partition', id: node.userData.partitionId, hitY: hit.point.y };
      if (node.userData.objectId) return { kind: 'object', id: node.userData.objectId };
      if (node.userData.openingId !== undefined) return { kind: 'opening', id: node.userData.openingId };
    }
    return null;
  }

  function placement(code, ray) {
    // Protección contra eventos retrasados: solo la partida actualmente armada puede colocarse.
    if (!code || pendingCode !== code) return;
    const item = CATALOG_BY_CODE[code]; if (!item) return;

    if (item.mode === 'floor' || item.mode === 'ceiling' || item.mode === 'skirting') {
      const point = floorHit(ray);
      if (!point) { hint('Haz clic sobre la superficie del contenedor.', true); return; }
      const result = api.setFinish(code);
      if (!result.ok) { hint(result.error, true); return; }
      clearPending();
      hint(code + ' aplicado a ' + (item.mode === 'ceiling' ? 'cielo' : item.mode === 'skirting' ? 'perímetro' : 'piso') + '.');
      return;
    }

    if (item.mode === 'wall-finish' || item.mode === 'opening') {
      const hit = wallHit(ray);
      if (!hit) { hint('Gira el contenedor y haz clic directamente sobre una pared.', true); return; }
      const { face, point } = hit;
      if (item.mode === 'wall-finish') {
        const result = api.setFinish(code, face);
        if (!result.ok) { hint(result.error, true); return; }
        clearPending(); hint(code + ' aplicado en la cara ' + face + '.'); return;
      }
      const [w, h] = item.size, span = FACES[face].long ? state.L : state.W;
      if ($('strict-face-lock').checked && (point.y < FLOOR || point.y > FLOOR + state.H || sideU(face, point) < 0 || sideU(face, point) > span)) {
        hint('Colocación rechazada: selecciona una cara válida del contenedor.', true); return;
      }
      const u = clamp(sideU(face, point) - w / 2, 0, Math.max(0, span - w));
      const type = ['cut-door', 'door-wood', 'door-mdf', 'door-steel'].includes(item.visual) ? 'door' : 'window';
      const v = type === 'door' ? 0 : clamp(point.y - FLOOR - h / 2, 0, Math.max(0, state.H - h));
      const result = api.addOpening({
        type, face, w, h, u, v,
        bars: type === 'window' && $('oBars').checked, catalogCode: code
      });
      if (!result.ok) { hint(code + ': ' + result.error, true); return; }
      clearPending(); hint(code + ' colocado en la cara ' + face + '. Puedes editar sus medidas a la derecha.');
      return;
    }

    if (item.mode === 'object' || item.mode === 'wall-object') {
      const wallMounted = ['wall-lining', 'wet-lining'].includes(item.visual);
      const hit = wallHit(ray);
      const point = wallMounted ? hit?.point : floorHit(ray);
      if (!point) {
        hint(wallMounted ? 'Haz clic en una pared para instalar el trasdosado.' : 'Haz clic en el piso o dentro del contenedor.', true);
        return;
      }
      const [w, h, d] = item.size;
      let rot = 0, x = point.x, z = point.z;
      const wallThickness = api.getWallThickness ? api.getWallThickness() : 0.06;
      const wallFixtures = ['extractor', 'water-heater', 'outlet', 'power', 'panel', 'grounding', 'aircon', 'bath-accessories'];

      if (wallMounted || wallFixtures.includes(item.visual)) {
        if (hit) {
          const side = hit.face;
          rot = side === 'B' ? 90 : side === 'C' ? 180 : side === 'D' ? -90 : 0;
          const radTmp = rot * Math.PI / 180;
          const rxTmp = (Math.abs(Math.cos(radTmp)) * w + Math.abs(Math.sin(radTmp)) * d) / 2;
          const rzTmp = (Math.abs(Math.sin(radTmp)) * w + Math.abs(Math.cos(radTmp)) * d) / 2;
          const margin = wallThickness + 0.005;
          if (side === 'A') z = state.W / 2 - margin - rzTmp;
          if (side === 'C') z = -state.W / 2 + margin + rzTmp;
          if (side === 'B') x = state.L / 2 - margin - rxTmp;
          if (side === 'D') x = -state.L / 2 + margin + rxTmp;
        }
      }

      const rad = rot * Math.PI / 180;
      const rx = (Math.abs(Math.cos(rad)) * w + Math.abs(Math.sin(rad)) * d) / 2;
      const rz = (Math.abs(Math.sin(rad)) * w + Math.abs(Math.cos(rad)) * d) / 2;
      const clearance = api.getInteriorClearance();
      const xMin = -state.L / 2 + rx + clearance, xMax = state.L / 2 - rx - clearance;
      const zMin = -state.W / 2 + rz + clearance, zMax = state.W / 2 - rz - clearance;
      if (xMin > xMax || zMin > zMax) {
        hint('Colocación rechazada: el elemento no cabe en el contenedor.', true); return;
      }
      x = clamp(x, xMin, xMax);
      z = clamp(z, zMin, zMax);
      const result = api.addObject(code, x, z, undefined, rot);
      if (!result.ok) { hint(code + ': ' + result.error, true); return; }
      // Colocación de un solo uso para object y wall-object: un clic = una partida.
      clearPending();
      hint(code + ' agregado. Haz clic sobre él para moverlo o editarlo.');
      return;
    }
  }

  function setLabel(id, label) { const node = $(id); if (node) node.textContent = label; }
  function setInputLabel(id, label) {
    const node = $(id); if (!node) return;
    const labelNode = Array.from(node.childNodes).find(n => n.nodeType === 3);
    if (labelNode) labelNode.textContent = label;
    else node.insertBefore(document.createTextNode(label), node.firstChild);
  }
  function visible(id, show) { $(id).hidden = !show; }

  const bathFloorCodeSelect = $('bath-floor-code');
  for (const floor of CATALOG.filter(item => item.mode === 'floor')) {
    const option = document.createElement('option');
    option.value = floor.code;
    option.textContent = floor.code + ' · ' + floor.name;
    bathFloorCodeSelect.append(option);
  }
  bathFloorCodeSelect.value = 'P05';

  function refreshTakeoff() {
    const grid = $('takeoff-summary');
    if (!grid || !api.getConstructionTakeoff) return;
    const t = api.getConstructionTakeoff();
    if (state.bathFloor) {
      $('bath-floor-code').value = state.bathFloor.code;
      $('bath-floor-length').value = state.bathFloor.length;
      $('bath-floor-width').value = state.bathFloor.width;
    }
    grid.replaceChildren();

    const rows = [
      ['Muros netos totales:', `${t.totalNetWallAreaM2.toFixed(2)} m²`],
      ['Tabiques interiores (dos caras):', `${t.totalPartitionBothFacesAreaM2.toFixed(2)} m²`],
      ['Placas en tabiques (caras seleccionadas):', `${t.totalPartitionLiningAreaM2.toFixed(2)} m²`],
      ['Aislación de tabiques:', `${t.totalPartitionInsulationAreaM2.toFixed(2)} m²`],
      ['Puertas interiores:', `${t.interiorDoorsCount} un`],
      ['Uniones de tabiques en T / L:', `${t.partitionTJunctionsCount} / ${t.partitionLJunctionsCount} un`],
      ['Descuento por vanos:', `-${t.totalOpeningsAreaM2.toFixed(2)} m²`],
      ['Descuento muros compartidos:', `-${t.sharedDeductionM2.toFixed(2)} m²`],
      ['Piso total / Cielo:', `${t.floorAreaM2.toFixed(2)} m²`],
      ['Piso baño:', `${t.bathFloorAreaM2.toFixed(2)} m²${t.bathFloor ? ' · ' + t.bathFloor.code : ''}`],
      ['Piso general restante:', `${t.remainingFloorAreaM2.toFixed(2)} m²`],
      ...Object.entries(t.floorByCodeM2).sort().map(([code, area]) =>
        [`Piso ${code} asignado:`, `${area.toFixed(2)} m²`]),
      ['Zócalo perimetral:', `${t.skirtingLinearM.toFixed(2)} ml`],
      ['Refuerzo ventanas (P90):', `${t.reinforcement.P90.openings} un (${t.reinforcement.P90.estimatedLinearM.toFixed(2)} ml)`],
      ['Refuerzo puertas (P91):', `${t.reinforcement.P91.openings} un (${t.reinforcement.P91.estimatedLinearM.toFixed(2)} ml)`],
      ...Object.entries(t.partitionLiningByCodeM2).sort().map(([code, area]) =>
        [`Placas tabiques ${code}:`, `${area.toFixed(2)} m²`]),
      ...Object.entries(t.partitionInsulationByCodeM2).sort().map(([code, area]) =>
        [`Aislación tabiques ${code}:`, `${area.toFixed(2)} m²`]),
      ...Object.entries(t.interiorDoorsByCode).sort().map(([code, quantity]) =>
        [`Puertas tabiques ${code}:`, `${quantity} un`]),
      ...['A', 'B', 'C', 'D'].map(face => [
        `Cara ${face}: neto / revestimiento`,
        `${t.walls[face].netAreaM2.toFixed(2)} / ${t.walls[face].liningAreaM2.toFixed(2)} m²`
      ])
    ];

    for (const [label, val] of rows) {
      const spanL = document.createElement('span'); spanL.textContent = label;
      const spanV = document.createElement('strong'); spanV.textContent = val;
      grid.append(spanL, spanV);
    }

    const list = $('shared-list');
    if (list) {
      list.replaceChildren();
      for (const zone of (state.sharedWalls || [])) {
        const row = document.createElement('div');
        row.className = 'shared-entry';
        const description = document.createElement('span');
        description.textContent = `Cara ${zone.face}, desde ${zone.u.toFixed(2)} m, ${zone.w.toFixed(2)} × ${zone.h.toFixed(2)} m`;
        const remove = document.createElement('button');
        remove.type = 'button'; remove.className = 'alt';
        remove.textContent = 'Quitar';
        remove.setAttribute('aria-label', `Quitar zona compartida de cara ${zone.face}`);
        remove.addEventListener('click', () => {
          const result = api.removeSharedWall(zone.id);
          $('shared-message').textContent = result.ok ? 'Zona eliminada.' : result.error;
        });
        row.append(description, remove); list.appendChild(row);
      }
    }
  }

  function refreshProperties() {
    const selection = api.getSelected(), form = $('props-form');
    $('properties-empty').hidden = !!selection; form.hidden = !selection;
    const partition = selection?.kind === 'partition';
    $('partition-finishes-box').hidden = !partition;
    $('partition-junction-box').hidden = !partition;
    if (!selection) { setLabel('properties-title', 'Propiedades del elemento'); return; }

    const opening = selection.kind === 'opening';
    const interiorDoor = selection.kind === 'interiorDoor';
    const obj = opening ? state.openings.find(x => x.id === selection.id) :
      partition ? state.partitions.find(x => x.id === selection.id) :
        interiorDoor ? state.interiorDoors.find(x => x.id === selection.id) :
          state.objects.find(x => x.id === selection.id);
    if (!obj) { form.hidden = true; return; }

    const item = CATALOG_BY_CODE[opening || interiorDoor ? obj.catalogCode : obj.code];
    setLabel('properties-title', partition ? 'Tabique interior' : interiorDoor ? 'Puerta del tabique' :
      opening ? 'Modificar abertura' : 'Modificar objeto 3D');
    $('prop-name').value = partition ? 'Tabique interior · Eje ' + obj.axis.toUpperCase() :
      (item?.code || '-') + ' · ' + (item?.name || (opening ? obj.type : 'Objeto'));
    const wallObject = !opening && !partition && !interiorDoor &&
      ['metal-studs', 'wood-studs', 'partition', 'wet-partition', 'closure'].includes(item?.visual);
    $('btn-rotate-partition').hidden = !(partition || wallObject);
    $('btn-rotate-fit').hidden = !(partition || wallObject) || (partition && obj.autoSpan === true);
    $('btn-rotate-fit').textContent = partition ? 'Girar y ajustar a los muros' : 'Girar y centrar ensamblaje';
    $('rotation-help').hidden = !(partition || wallObject);
    $('rotation-help').textContent = partition
      ? 'El giro manual conserva largo y centro; si no cabe, usa el autoajuste expreso.'
      : 'Un tabique del catálogo es un objeto 3D independiente. Si no cabe al girar, puedes girarlo y centrarlo expresamente.';
    $('partition-fit-label').hidden = !partition;
    $('partition-fit-help').hidden = !partition;
    $('partition-magnet-label').hidden = !partition;
    $('partition-drag-help').hidden = !partition;
    $('partition-fit').checked = partition && obj.autoSpan === true;
    if (partition) {
      $('part-face-a').value = obj.faceALining || '';
      $('part-face-b').value = obj.faceBLining || '';
      $('part-insulation').checked = obj.hasInsulation === true;
      $('part-insulation-code').value = obj.insulationCode || 'P20';
      $('part-insulation-code').disabled = !obj.hasInsulation;
      const newAxis = obj.axis === 'z' ? 'X' : 'Z';
      $('part-junction-side').options[0].textContent = 'Lado positivo (+' + newAxis + ')';
      $('part-junction-side').options[1].textContent = 'Lado negativo (−' + newAxis + ')';
      $('junction-help').textContent = obj.autoSpan ?
        'T: crea una rama perpendicular sin atravesar el tabique. Para crear una L, desactiva autoSpan y acorta primero este tabique.' :
        'T: rama perpendicular al centro. L: rama perpendicular en el extremo indicado. Ambas llegan a otro muro o al perímetro sin invadirlo.';
    }
    $('prop-apply').hidden = false;
    $('prop-duplicate').hidden = partition || interiorDoor;
    $('prop-delete').hidden = false;
    for (const k of ['prop-w', 'prop-h']) $(k).closest('label').hidden = false;

    if (partition) {
      const values = { x: obj.cx, z: obj.cz, w: obj.length, h: obj.height, d: obj.thickness };
      for (const [k, value] of Object.entries(values)) $('prop-' + k).value = value;
      $('prop-w').readOnly = !!obj.autoSpan;
      $('prop-x').readOnly = !!obj.autoSpan && obj.axis === 'x';
      $('prop-z').readOnly = !!obj.autoSpan && obj.axis === 'z';
      setInputLabel('px-label', 'Centro X (m)');
      setInputLabel('pz-label', 'Centro Z (m)');
      setInputLabel('pw-label', 'Longitud del tabique (m)');
      setInputLabel('pd-label', 'Espesor del tabique (m)');
      visible('px-label', true); visible('pz-label', true);
      visible('py-label', false); visible('prot-label', false);
      visible('pd-label', true); visible('pface-label', false);
      return;
    }

    $('prop-w').readOnly = false;
    $('prop-x').readOnly = false;
    $('prop-z').readOnly = false;
    setInputLabel('pw-label', 'Ancho (m)');
    setInputLabel('pd-label', 'Fondo (m)');
    const values = interiorDoor ? { x: obj.u, z: 0, y: 0, rot: 0, w: obj.w, h: obj.h, d: 0 } :
      opening ? { x: obj.u, z: 0, y: obj.v, rot: 0, w: obj.w, h: obj.h, d: 0 } :
      { x: obj.x, z: obj.z, y: obj.y, rot: obj.rot, w: obj.w, h: obj.h, d: obj.d };
    for (const [k, value] of Object.entries(values)) $('prop-' + k).value = value;

    setInputLabel('px-label', interiorDoor ? 'Distancia desde extremo del tabique (m)' :
      opening ? 'Distancia horizontal en cara (m)' : 'X (m)');
    setInputLabel('py-label', 'Altura desde piso (m)');
    visible('px-label', true); visible('py-label', !interiorDoor);
    visible('pz-label', !opening && !interiorDoor); visible('prot-label', !opening && !interiorDoor);
    visible('pd-label', !opening && !interiorDoor); visible('pface-label', opening);
    $('prop-face').value = opening ? obj.face : 'A';
    if (interiorDoor) {
      setInputLabel('pw-label', 'Ancho de la puerta (m)');
      setInputLabel('pd-label', 'Espesor (m)');
      visible('py-label', false);
    }
    if (opening && obj.type === 'window') $('oBars').checked = obj.bars === true;
  }

  function refreshPlaced() {
    const list = $('placed-list'); list.replaceChildren();
    const active = api.getSelected();
    const entries = [
      ...state.partitions.map(x => ({ kind: 'partition', id: x.id, code: 'TABIQUE' })),
      ...state.interiorDoors.map(x => ({ kind: 'interiorDoor', id: x.id, code: x.catalogCode })),
      ...state.objects.map(x => ({ kind: 'object', id: x.id, code: x.code })),
      ...state.openings.map(x => ({ kind: 'opening', id: x.id, code: x.catalogCode || 'VANO' })),
      ...state.services.map(x => ({ kind: 'service', id: x.id, code: x.code }))
    ];
    for (const record of entries) {
      const btn = document.createElement('button'); btn.type = 'button';
      btn.className = 'placed-entry' + (active?.id === record.id && active?.kind === record.kind ? ' selected' : '');
      const label = record.kind === 'partition' ? 'Tabique interior (giro 90°)' :
        record.kind === 'interiorDoor' ? 'Puerta interior asociada al tabique' :
          CATALOG_BY_CODE[record.code]?.name || 'Abertura manual';
      btn.textContent = record.code + ' · ' + label;
      btn.addEventListener('click', () => {
        if (record.kind === 'service') { if (window.confirm('¿Quitar este servicio del proyecto?')) api.removeService(record.id); }
        else api.selectEntity(record.kind, record.id);
      });
      if (record.kind === 'service') btn.title = 'Quitar servicio (requiere confirmación)';
      list.appendChild(btn);
    }
  }

  function refresh() { refreshProperties(); refreshPlaced(); refreshTakeoff(); }

  $('catalog-search').addEventListener('input', renderCatalog);
  $('catalog-family').addEventListener('change', renderCatalog);
  $('cancel-placement').addEventListener('click', clearPending);
  $('bath-floor-apply').addEventListener('click', () => {
    const result = api.setBathFloor({
      code: $('bath-floor-code').value,
      length: number('bath-floor-length'),
      width: number('bath-floor-width')
    });
    $('bath-floor-message').textContent = result.ok ? result.alert : result.error;
    if (!result.ok) hint(result.error, true);
  });
  $('bath-floor-clear').addEventListener('click', () => {
    const result = api.clearBathFloor();
    $('bath-floor-message').textContent = result.alert;
  });
  $('shared-add').addEventListener('click', () => {
    const result = api.addSharedWall({
      face: $('shared-face').value, u: number('shared-u'), v: number('shared-v'),
      w: number('shared-w'), h: number('shared-h')
    });
    $('shared-message').textContent = result.ok
      ? 'Zona añadida. Comprueba la geometría real del contacto antes de presupuestar.'
      : result.error;
  });


  $('apply-wall-finish').addEventListener('click', () => {
    const item = CATALOG_BY_CODE[pendingCode];
    if (!isWallApplication(item)) {
      hint('Selecciona primero un revestimiento o trasdosado de muro del catálogo.', true); return;
    }
    const face = $('wall-finish-face').value;
    const result = api.setWallLining(face, item.code);
    if (!result.ok) { hint(result.error, true); return; }
    clearPending();
    hint(item.code + (item.mode === 'wall-finish' ? ' aplicado' : ' instalado') + ' correctamente en la cara ' + face + '.');
  });

  $('oBars').addEventListener('change', event => {
    const selected = api.getSelected();
    if (selected?.kind !== 'opening') return;
    const opening = state.openings.find(o => o.id === selected.id);
    if (!opening || opening.type !== 'window') return;
    const result = api.updateOpening(opening.id, { bars: event.target.checked });
    if (!result.ok) {
      event.target.checked = opening.bars === true;
      hint('No se pudieron actualizar los barrotes: ' + result.error, true);
      return;
    }
    hint(event.target.checked ? 'Barrotes agregados a la ventana seleccionada.' : 'Barrotes retirados de la ventana seleccionada.');
  });

  $('add-parametric-partition').addEventListener('click', () => {
    // Inserciones consecutivas buscan otro espacio libre, no el centro ocupado.
    const result = api.addPartition({ axis: 'z', length: Math.max(0.2, state.W - 2 * api.getInteriorClearance()),
      height: Math.min(2.3, state.H), thickness: 0.1, cx: 0, cz: 0,
      autoSpan: true, autoPlace: true });
    if (result.ok && !state.seeInside) {
      api.setSeeInside(true);
      $('xray').checked = true;
    }
    if (!result.ok) {
      hint('No se pudo crear el tabique: ' + result.error, true);
    } else if (result.autoPlaced) {
      const cross = result.axis === 'z' ? 'X' : 'Z';
      const position = result.axis === 'z' ? result.cx : result.cz;
      hint(`Nuevo tabique colocado en ${cross} = ${position.toFixed(2)} m, dentro de un espacio libre. Puedes moverlo desde Propiedades.`);
    } else {
      hint('Tabique creado entre paramentos. Selecciónalo para moverlo o añadir una puerta.');
    }
  });

  for (const type of ['T', 'L']) {
    $('btn-junction-' + type.toLowerCase()).addEventListener('click', () => {
      const selected = api.getSelected();
      if (selected?.kind !== 'partition') {
        hint('Selecciona primero el tabique anfitrión.', true);
        return;
      }
      const result = api.addPartitionJunction({
        hostId: selected.id, type,
        side: Number($('part-junction-side').value),
        endpoint: Number($('part-junction-end').value)
      });
      if (!result.ok) {
        hint('No se pudo crear la unión ' + type + ': ' + result.error, true);
      } else {
        hint('Unión ' + type + ' creada. La nueva rama queda seleccionada y puedes editar sus acabados o añadir una puerta.');
      }
    });
  }

  $('partition-fit').addEventListener('change', event => {
    const selected = api.getSelected();
    if (selected?.kind !== 'partition') return;
    const result = api.updatePartition(selected.id, { autoSpan: event.target.checked });
    if (!result.ok) {
      event.target.checked = !event.target.checked;
      hint('No se pudo ajustar el tabique: ' + result.error, true);
    } else hint(event.target.checked ? 'Tabique ajustado entre ambos paramentos.' :
      'Autoajuste desactivado. Las medidas actuales quedan editables.');
  });

  function applyPartitionFinishChange() {
    const selected = api.getSelected();
    if (selected?.kind !== 'partition') return;
    const result = api.updatePartition(selected.id, {
      faceALining: $('part-face-a').value || null,
      faceBLining: $('part-face-b').value || null,
      hasInsulation: $('part-insulation').checked,
      insulationCode: $('part-insulation').checked ? $('part-insulation-code').value : null
    });
    if (!result.ok) { hint('No se pudieron aplicar las capas: ' + result.error, true); refreshProperties(); }
    else hint('Capas actualizadas y superficies recalculadas.');
  }
  for (const id of ['part-face-a', 'part-face-b', 'part-insulation-code']) {
    $(id).addEventListener('change', applyPartitionFinishChange);
  }
  $('part-insulation').addEventListener('change', applyPartitionFinishChange);
  $('btn-add-interior-door').addEventListener('click', () => {
    const selected = api.getSelected();
    if (selected?.kind !== 'partition') return;
    const code = $('part-door-code').value;
    const result = api.addInteriorDoor({ partitionId: selected.id, catalogCode: code,
      w: code === 'P80' ? 0.7 : 0.8 });
    hint(result.ok ? 'Puerta añadida al tabique. Edita posición y medidas a la derecha.' :
      'No se pudo agregar la puerta: ' + result.error, !result.ok);
  });

  $('btn-rotate-partition').addEventListener('click', () => {
    const selected = api.getSelected();
    if (!selected) return;
    let result;
    if (selected.kind === 'partition') result = api.rotatePartition(selected.id);
    else if (selected.kind === 'object') {
      const wall = state.objects.find(o => o.id === selected.id);
      const item = wall && CATALOG_BY_CODE[wall.code];
      if (!['metal-studs', 'wood-studs', 'partition', 'wet-partition', 'closure'].includes(item?.visual)) return;
      result = api.updateObject(selected.id, { rot: ((wall.rot + 90) % 360 + 360) % 360 });
    } else return;
    hint(result.ok ? selected.kind === 'partition'
      ? `Tabique girado 90° al eje ${result.axis.toUpperCase()} (largo ${result.length.toFixed(2)} m).`
      : 'Ensamble girado 90°.' : result.error, !result.ok);
  });

  $('btn-rotate-fit').addEventListener('click', () => {
    const selected = api.getSelected();
    if (!selected) return;
    if (selected.kind === 'partition') {
      // Esta acción opta expresamente por el ajuste paramétrico en el nuevo eje.
      const result = api.rotatePartition(selected.id, { fitToWalls: true });
      hint(result.ok ? `Tabique girado al eje ${result.axis.toUpperCase()} y ajustado a ${result.length.toFixed(2)} m entre paramentos.` :
        result.error, !result.ok);
    } else if (selected.kind === 'object') {
      // Ensambles P10-P13/P15: centrar y girar es otra acción EXPRESA.
      // El motor rechaza automáticamente cualquier solapamiento o invasión.
      const wall = state.objects.find(o => o.id === selected.id);
      const item = wall && CATALOG_BY_CODE[wall.code];
      if (!['metal-studs', 'wood-studs', 'partition', 'wet-partition', 'closure'].includes(item?.visual)) return;
      const result = api.updateObject(selected.id, {
        rot: ((wall.rot + 90) % 360 + 360) % 360, x: 0, z: 0
      });
      hint(result.ok ? 'Ensamblaje girado 90° y centrado. Se conservaron sus medidas.' :
        'No se puede centrar y girar: ' + result.error, !result.ok);
    }
  });

  $('prop-apply').addEventListener('click', () => {
    const selection = api.getSelected(); if (!selection) return;
    const isOpening = selection.kind === 'opening';
    const isInteriorDoor = selection.kind === 'interiorDoor';
    const w = number('prop-w'), h = number('prop-h');
    const isPartition = selection.kind === 'partition';
    const params = isInteriorDoor ? { u: number('prop-x'), w, h } :
      isOpening ? { u: number('prop-x'), v: number('prop-y'), w, h, face: $('prop-face').value } :
      isPartition ?
        { cx: number('prop-x'), cz: number('prop-z'), length: w, height: h, thickness: number('prop-d') } :
        { x: number('prop-x'), z: number('prop-z'), y: number('prop-y'), rot: number('prop-rot'), w, h, d: number('prop-d') };
    const result = isInteriorDoor ? api.updateInteriorDoor(selection.id, params) :
      isOpening ? api.updateOpening(selection.id, params) :
      isPartition ? api.updatePartition(selection.id, params) : api.updateObject(selection.id, params);
    if (!result.ok) { hint(result.error, true); return; }
    hint('Cambios aplicados al elemento seleccionado.');
  });

  $('prop-delete').addEventListener('click', () => {
    const selection = api.getSelected(); if (!selection) return;
    if (selection.kind === 'opening') api.removeOpening(selection.id);
    else if (selection.kind === 'interiorDoor') api.removeInteriorDoor(selection.id);
    else if (selection.kind === 'partition') api.removePartition(selection.id);
    else api.removeObject(selection.id);
    hint('Elemento eliminado del proyecto.');
  });

  $('prop-duplicate').addEventListener('click', () => {
    const selection = api.getSelected(); if (!selection) return;
    if (selection.kind === 'interiorDoor' || selection.kind === 'partition') return;
    const result = selection.kind === 'opening' ? api.duplicateOpening(selection.id) : api.duplicateObject(selection.id);
    hint(result.ok ? 'Elemento duplicado.' : 'No se pudo duplicar: ' + result.error, !result.ok);
  });

  $('save-project').addEventListener('click', () => {
    const project = { schema: 'BAT-CUBIKEITOR-V2', version: 3, exportedAt: new Date().toISOString(), state: api.getState() };
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = 'bat-cubikeitor-v4-7.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    hint('Proyecto exportado como JSON. Guarda este archivo como respaldo.');
  });

  $('import-project').addEventListener('click', () => $('import-project-file').click());
  $('import-project-file').addEventListener('change', async event => {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
    if (file.size > 2_000_000) { hint('Archivo demasiado grande.', true); return; }
    try {
      const data = JSON.parse(await file.text());
      if (data.schema !== 'BAT-CUBIKEITOR-V2' || ![1, 2, 3].includes(data.version)) {
        throw Error('Formato de proyecto incompatible: se aceptan versiones 1, 2 y 3');
      }
      if (!confirm('¿Reemplazar el diseño actual con el archivo seleccionado?')) return;
      const result = api.setState(data.state);
      if (!result.ok) throw Error(result.error);
      clearPending();
      if (syncPanel) syncPanel();
      hint('Proyecto importado correctamente.');
    } catch (err) { hint('No se pudo importar: ' + err.message, true); }
  });

  const canvas = renderer.domElement;
  const planeAt = (ray, y) => ray.ray.intersectPlane(
    new THREE.Plane(new THREE.Vector3(0, 1, 0), -y), new THREE.Vector3());

  function restoreDrag() {
    if (drag?.kind === 'partition') {
      const group = root.children.find(n => n.userData.partitionGroupId === drag.id);
      if (group) group.position.set(drag.x, FLOOR, drag.z);
    }
    controls.enabled = true;
    if (drag?.pointerId !== undefined && canvas.hasPointerCapture?.(drag.pointerId)) {
      canvas.releasePointerCapture(drag.pointerId);
    }
    drag = null; pointerOrigin = null;
  }

  canvas.addEventListener('pointerdown', event => {
    if (event.button !== 0 || !event.isPrimary) return;
    pointerOrigin = { x: event.clientX, y: event.clientY };
    if (pendingCode) return;
    const ray = rayFor(event); if (!ray) return;
    const hit = objectRayPick(ray); if (!hit) return;
    api.selectEntity(hit.kind, hit.id);
    if (hit.kind === 'partition') {
      const p = state.partitions.find(x => x.id === hit.id);
      // Anclar el plano de arrastre a la altura real del clic evita que un
      // movimiento pequeño del mouse provoque saltos de varios metros.
      const planeY = Number.isFinite(hit.hitY) ? hit.hitY : FLOOR + (p?.height || 2) / 2;
      const at = planeAt(ray, planeY);
      if (!p || !at) return;
      drag = { kind: 'partition', id: p.id, x: p.cx, z: p.cz, planeY,
        startX: at.x, startZ: at.z, origClientX: event.clientX,
        origClientY: event.clientY, pointerId: event.pointerId, changed: false };
    } else if (hit.kind === 'object') {
      const o = state.objects.find(x => x.id === hit.id);
      const at = o && planeAt(ray, FLOOR + o.y);
      if (!o || !at) return;
      drag = { kind: 'object', id: o.id, x: o.x, z: o.z,
        startX: at.x, startZ: at.z, origClientX: event.clientX,
        origClientY: event.clientY, pointerId: event.pointerId, changed: false };
    }
    if (drag) {
      controls.enabled = false;
      canvas.setPointerCapture?.(event.pointerId);
    }
  });

  canvas.addEventListener('pointermove', event => {
    if (!drag || !pointerOrigin || event.pointerId !== drag.pointerId) return;
    if (Math.hypot(event.clientX - drag.origClientX, event.clientY - drag.origClientY) > 4) drag.changed = true;
    if (!drag.changed) return;
    const ray = rayFor(event); if (!ray) return;
    if (drag.kind === 'partition') {
      const at = planeAt(ray, drag.planeY); if (!at) return;
      const preview = api.previewPartitionMove(drag.id, {
        cx: drag.x + at.x - drag.startX,
        cz: drag.z + at.z - drag.startZ,
        snap: $('partition-magnet').checked
      });
      drag.preview = preview.ok ? preview : null;
      drag.invalid = preview.ok ? null : preview.error;
      const group = root.children.find(n => n.userData.partitionGroupId === drag.id);
      if (group) {
        group.position.set(preview.ok ? preview.candidate.cx : drag.x,
          FLOOR, preview.ok ? preview.candidate.cz : drag.z);
      }
      if (preview.ok && preview.snappedTo) hint('Imán: ' + preview.snappedTo + '. Suelta para confirmar.');
      else if (!preview.ok) hint('Posición no válida: ' + preview.error, true);
      return;
    }
    const o = state.objects.find(x => x.id === drag.id); if (!o) return;
    const at = planeAt(ray, FLOOR + o.y); if (!at) return;
    const rot = o.rot * Math.PI / 180;
    const rx = (Math.abs(Math.cos(rot)) * o.w + Math.abs(Math.sin(rot)) * o.d) / 2;
    const rz = (Math.abs(Math.sin(rot)) * o.w + Math.abs(Math.cos(rot)) * o.d) / 2;
    const margin = api.getInteriorClearance();
    const x = clamp(drag.x + at.x - drag.startX, -state.L / 2 + rx + margin, state.L / 2 - rx - margin);
    const z = clamp(drag.z + at.z - drag.startZ, -state.W / 2 + rz + margin, state.W / 2 - rz - margin);
    drag.preview = { x, z };
    const group = api.getEntityMeshes().find(n => n.userData.objectId === drag.id);
    if (group) group.position.set(x, FLOOR + o.y, z);
  });

  function endDrag(cancel = false) {
    if (!drag) { controls.enabled = true; return false; }
    const prior = drag;
    restoreDrag();
    if (prior.changed) {
      if (cancel) { api.selectEntity(prior.kind, prior.id); hint('Desplazamiento cancelado.'); return true; }
      if (prior.kind === 'partition') {
        if (!prior.preview) {
          api.selectEntity('partition', prior.id);
          hint(prior.invalid || 'No se encontró una posición libre válida.', true);
        } else {
          const c = prior.preview.candidate;
          const result = api.movePartition(prior.id, {
            cx: c.cx, cz: c.cz, snap: $('partition-magnet').checked
          });
          if (!result.ok) { api.selectEntity('partition', prior.id); hint(result.error, true); }
          else hint(result.snappedTo ? 'Tabique unido: ' + result.snappedTo + '.' :
            'Tabique desplazado. La posición y las cantidades están actualizadas.');
        }
      } else if (prior.preview) {
        const result = api.updateObject(prior.id, prior.preview);
        if (!result.ok) { api.selectEntity('object', prior.id); hint(result.error, true); }
        else hint('Objeto desplazado dentro del contenedor.');
      }
      return true;
    }
    return false;
  }

  canvas.addEventListener('pointerup', event => {
    if (drag && event.pointerId !== drag.pointerId) return;
    if (endDrag()) return;
    if (!pointerOrigin) return;
    const moved = Math.hypot(event.clientX - pointerOrigin.x, event.clientY - pointerOrigin.y) > 7;
    pointerOrigin = null;
    if (moved || !pendingCode) return;
    const ray = rayFor(event); if (ray) placement(pendingCode, ray);
  });

  canvas.addEventListener('pointercancel', () => { endDrag(true); pointerOrigin = null; });

  window.addEventListener('keydown', event => {
    if (event.key === 'Escape' && drag) { endDrag(true); return; }
    if (event.key === 'Escape' && pendingCode) { clearPending(); return; }
    if (event.key === 'Delete' &&
      !['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(document.activeElement?.tagName)) {
      const selection = api.getSelected(); if (selection) {
        if (selection.kind === 'object') api.removeObject(selection.id);
        else if (selection.kind === 'opening') api.removeOpening(selection.id);
        else if (selection.kind === 'partition') api.removePartition(selection.id);
        else if (selection.kind === 'interiorDoor') api.removeInteriorDoor(selection.id);
      }
    }
  });

  renderCatalog(); refresh();
  return Object.freeze({ refresh, clearPending, getPending: () => pendingCode });
}
