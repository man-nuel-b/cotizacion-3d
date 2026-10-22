const CLP = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });

const DATA = {
  solutions: {
    office: { name: 'Oficina', icon: 'fa-briefcase', desc: 'Espacio de trabajo cómodo y climatizado.', container: '20hc', counts: { window: 2, door: 1, partition: 0, wc: 0, sink: 0, shower: 0, ac: 1, electrical: 4 }, finish: 'standard' },
    officeBath: { name: 'Oficina + baño', icon: 'fa-building', desc: 'Oficina operativa con servicio higiénico interior.', container: '20hc', counts: { window: 2, door: 2, partition: 1, wc: 1, sink: 1, shower: 0, ac: 1, electrical: 5 }, finish: 'standard' },
    bathrooms: { name: 'Batería de baños', icon: 'fa-restroom', desc: 'Módulo sanitario con múltiples artefactos.', container: '20hc', counts: { window: 1, door: 1, partition: 2, wc: 3, sink: 2, shower: 0, ac: 0, electrical: 3 }, finish: 'sanitary' },
    locker: { name: 'Camarín', icon: 'fa-shirt', desc: 'Vestidores, duchas y servicios higiénicos.', container: '40hc', counts: { window: 2, door: 2, partition: 3, wc: 2, sink: 2, shower: 2, ac: 1, electrical: 8 }, finish: 'sanitary' },
    dining: { name: 'Comedor', icon: 'fa-utensils', desc: 'Espacio amplio para alimentación y descanso.', container: '40hc', counts: { window: 4, door: 2, partition: 1, wc: 0, sink: 1, shower: 0, ac: 2, electrical: 10 }, finish: 'standard' },
    warehouse: { name: 'Bodega', icon: 'fa-boxes-stacked', desc: 'Almacenamiento seguro con habilitación básica.', container: '20std', counts: { window: 1, door: 1, partition: 0, wc: 0, sink: 0, shower: 0, ac: 0, electrical: 2 }, finish: 'basic' },
    custom: { name: 'Proyecto personalizado', icon: 'fa-pen-ruler', desc: 'Parte desde una base y construye una solución especial.', container: '20hc', counts: { window: 1, door: 1, partition: 0, wc: 0, sink: 0, shower: 0, ac: 0, electrical: 2 }, finish: 'standard' }
  },
  containers: {
    '20std': { name: '20 pies estándar', short: '20 STD', length: 6.06, width: 2.44, height: 2.59, baseCost: 1800000, badge: 'Compacto' },
    '20hc': { name: '20 pies High Cube', short: '20 HC', length: 6.06, width: 2.44, height: 2.89, baseCost: 2050000, badge: 'Recomendado' },
    '40hc': { name: '40 pies High Cube', short: '40 HC', length: 12.19, width: 2.44, height: 2.89, baseCost: 3200000, badge: 'Gran capacidad' }
  },
  finishes: {
    basic: { name: 'Esencial', desc: 'Solución funcional y económica.', lining: 'osb', insulation: 'eps', flooring: 'floating' },
    standard: { name: 'Confort', desc: 'Aislación y terminaciones para uso diario.', lining: 'gypsum', insulation: 'glasswool', flooring: 'vinyl' },
    sanitary: { name: 'Sanitario', desc: 'Superficies lavables para zonas húmedas.', lining: 'pvc', insulation: 'eps', flooring: 'vinyl' }
  },
  colors: ['#1e3a8a', '#334155', '#14532d', '#f8fafc', '#991b1b', '#d97706'],
  extras: {
    window: { name: 'Ventana termopanel', icon: 'fa-window-maximize', max: 8 },
    door: { name: 'Puerta peatonal', icon: 'fa-door-open', max: 6 },
    partition: { name: 'División interior', icon: 'fa-grip-lines-vertical', max: 6 },
    wc: { name: 'WC completo', icon: 'fa-toilet', max: 8 },
    sink: { name: 'Lavamanos', icon: 'fa-sink', max: 8 },
    shower: { name: 'Ducha', icon: 'fa-shower', max: 8 },
    ac: { name: 'Aire acondicionado', icon: 'fa-wind', max: 4 },
    electrical: { name: 'Punto eléctrico', icon: 'fa-plug', max: 24 }
  },
  catalog: {
    gypsum: { name: 'Plancha yeso-cartón 12,5 mm', unit: 'plancha', coverage: 2.88, cost: 8990 },
    osb: { name: 'Plancha OSB estructural 9 mm', unit: 'plancha', coverage: 2.98, cost: 15950 },
    pvc: { name: 'Panel PVC lavable', unit: 'panel', coverage: 0.65, cost: 6990 },
    glasswool: { name: 'Lana de vidrio 50 mm', unit: 'rollo', coverage: 28.8, cost: 61750 },
    eps: { name: 'Aislación EPS 50 mm', unit: 'plancha', coverage: 0.5, cost: 2490 },
    vinyl: { name: 'Piso vinílico alto tráfico', unit: 'caja', coverage: 2.2, cost: 24990 },
    floating: { name: 'Piso fotolaminado 8 mm', unit: 'caja', coverage: 2.13, cost: 16990 },
    stud: { name: 'Perfil Metalcon montante 3 m', unit: 'unidad', cost: 4290 },
    track: { name: 'Perfil Metalcon canal 3 m', unit: 'unidad', cost: 3990 },
    screws: { name: 'Caja tornillos autoperforantes', unit: 'caja', cost: 13990 },
    paint: { name: 'Pintura / protección exterior', unit: 'galón', coverage: 28, cost: 38990 },
    window: { name: 'Ventana termopanel 100×100 cm', unit: 'unidad', cost: 129900 },
    door: { name: 'Puerta exterior aislada', unit: 'unidad', cost: 159900 },
    wc: { name: 'WC sanitario completo', unit: 'unidad', cost: 79900 },
    sink: { name: 'Lavamanos con grifería', unit: 'unidad', cost: 69900 },
    shower: { name: 'Kit ducha y receptáculo', unit: 'unidad', cost: 99900 },
    ac: { name: 'Split inverter 9.000 BTU', unit: 'unidad', cost: 289900 },
    electrical: { name: 'Material punto eléctrico', unit: 'punto', cost: 28000 }
  },
  labor: {
    base20: 650000,
    base40: 900000,
    window: 65000,
    door: 85000,
    partition: 150000,
    wc: 120000,
    sink: 90000,
    shower: 140000,
    ac: 180000,
    electrical: 35000
  }
};

const DEFAULT_STATE = {
  step: 1,
  solution: 'office',
  container: '20hc',
  finish: 'standard',
  exteriorColor: '#1e3a8a',
  counts: { ...DATA.solutions.office.counts },
  margin: 25,
  transport: 0,
  tax: 19,
  cutaway: false,
  night: false,
  showPeople: true,
  customer: { name: '', company: '', phone: '', email: '' }
};

let state = clone(DEFAULT_STATE);
let history = [];
let future = [];
let scene, camera, renderer, controls, containerGroup, environmentGroup;
let ambientLight, hemisphereLight, keyLight, fillLight;
let currentView = 'exterior';
let isPresentation = false;
let cameraAnim = null;

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function money(value) { return CLP.format(Math.round(Number(value) || 0)).replace('CLP', '$'); }
function clamp(n, min, max) { return Math.min(max, Math.max(min, n)); }

function pushHistory() {
  history.push(clone(state));
  if (history.length > 40) history.shift();
  future = [];
}
function mutate(fn, { history: useHistory = true } = {}) {
  if (useHistory) pushHistory();
  fn();
  renderAll();
}
function undo() {
  if (!history.length) return toast('No hay cambios para deshacer');
  future.push(clone(state));
  state = history.pop();
  renderAll();
}
function redo() {
  if (!future.length) return toast('No hay cambios para rehacer');
  history.push(clone(state));
  state = future.pop();
  renderAll();
}

function applySolution(key) {
  const preset = DATA.solutions[key];
  mutate(() => {
    state.solution = key;
    state.container = preset.container;
    state.counts = { ...preset.counts };
    state.finish = preset.finish;
  });
}
function selectContainer(key) { mutate(() => { state.container = key; }); }
function selectFinish(key) { mutate(() => { state.finish = key; }); }
function selectColor(color) { mutate(() => { state.exteriorColor = color; }); }
function adjustCount(key, delta) {
  const max = DATA.extras[key].max;
  mutate(() => { state.counts[key] = clamp((state.counts[key] || 0) + delta, 0, max); });
}
function setCustomer(key, value) { state.customer[key] = value; }
function updateAdminNumber(key, value) {
  const parsed = Number(value);
  mutate(() => {
    if (key === 'margin') state.margin = clamp(Number.isFinite(parsed) ? parsed : 25, 0, 200);
    if (key === 'transport') state.transport = Math.max(0, Number.isFinite(parsed) ? parsed : 0);
    if (key === 'tax') state.tax = clamp(Number.isFinite(parsed) ? parsed : 19, 0, 100);
  });
}

function goStep(step) {
  state.step = clamp(step, 1, 4);
  document.querySelectorAll('.wizard-step').forEach(el => el.classList.toggle('hidden', Number(el.dataset.step) !== state.step));
  document.querySelectorAll('.step-chip').forEach((el, idx) => el.classList.toggle('active', idx + 1 === state.step));
  if (window.innerWidth < 821) document.querySelector('.config-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function buildBOM() {
  const c = DATA.containers[state.container];
  const finish = DATA.finishes[state.finish];
  const wallGross = 2 * (c.length * c.height) + 2 * (c.width * c.height);
  const openings = state.counts.window * 1.2 + state.counts.door * 1.8;
  const partitionArea = state.counts.partition * c.width * c.height * 2;
  const liningArea = Math.max(0, wallGross - openings) + partitionArea;
  const insulationArea = Math.max(0, wallGross - openings) + (partitionArea / 2);
  const floorArea = c.length * c.width;
  const exteriorArea = wallGross + c.length * c.width;
  const lining = DATA.catalog[finish.lining];
  const insulation = DATA.catalog[finish.insulation];
  const flooring = DATA.catalog[finish.flooring];
  const waste = 1.1;

  const studs = Math.ceil(((2 * c.length + 2 * c.width) / 0.6) + state.counts.partition * (c.width / 0.6 + 1));
  const tracks = Math.ceil(((2 * (c.length + c.width)) + state.counts.partition * c.width * 2) / 3);
  const liningQty = Math.ceil((liningArea * waste) / lining.coverage);
  const insulationQty = Math.ceil((insulationArea * waste) / insulation.coverage);
  const floorQty = Math.ceil((floorArea * waste) / flooring.coverage);
  const screwBoxes = Math.max(1, Math.ceil((liningQty + studs + tracks) / 20));
  const paintQty = Math.max(1, Math.ceil((exteriorArea * 2) / DATA.catalog.paint.coverage));

  const items = [
    { key: 'structure', name: `Estructura contenedor ${c.short}`, qty: 1, unit: 'unidad', unitCost: c.baseCost },
    { key: finish.lining, name: lining.name, qty: liningQty, unit: lining.unit, unitCost: lining.cost },
    { key: finish.insulation, name: insulation.name, qty: insulationQty, unit: insulation.unit, unitCost: insulation.cost },
    { key: finish.flooring, name: flooring.name, qty: floorQty, unit: flooring.unit, unitCost: flooring.cost },
    { key: 'stud', name: DATA.catalog.stud.name, qty: studs, unit: DATA.catalog.stud.unit, unitCost: DATA.catalog.stud.cost },
    { key: 'track', name: DATA.catalog.track.name, qty: tracks, unit: DATA.catalog.track.unit, unitCost: DATA.catalog.track.cost },
    { key: 'screws', name: DATA.catalog.screws.name, qty: screwBoxes, unit: DATA.catalog.screws.unit, unitCost: DATA.catalog.screws.cost },
    { key: 'paint', name: DATA.catalog.paint.name, qty: paintQty, unit: DATA.catalog.paint.unit, unitCost: DATA.catalog.paint.cost }
  ];
  ['window', 'door', 'wc', 'sink', 'shower', 'ac', 'electrical'].forEach(key => {
    const qty = state.counts[key] || 0;
    if (qty > 0) {
      const item = DATA.catalog[key];
      items.push({ key, name: item.name, qty, unit: item.unit, unitCost: item.cost });
    }
  });
  return items.map(item => ({ ...item, subtotal: item.qty * item.unitCost }));
}

function calculate() {
  const bom = buildBOM();
  const materials = bom.reduce((sum, item) => sum + item.subtotal, 0);
  const baseLabor = state.container === '40hc' ? DATA.labor.base40 : DATA.labor.base20;
  const labor = baseLabor + Object.entries(state.counts).reduce((sum, [key, qty]) => sum + ((DATA.labor[key] || 0) * qty), 0);
  const direct = materials + labor + state.transport;
  const net = direct * (1 + state.margin / 100);
  const taxAmount = net * (state.tax / 100);
  const total = net + taxAmount;
  return { bom, materials, labor, direct, net, taxAmount, total };
}

function renderSolutions() {
  const root = document.getElementById('solution-list');
  root.innerHTML = Object.entries(DATA.solutions).map(([key, item]) => `
    <button onclick="applySolution('${key}')" class="option-card ${state.solution === key ? 'active' : ''} border rounded-xl p-3 text-left flex gap-3 items-center">
      <div class="w-10 h-10 rounded-xl ${state.solution === key ? 'bg-amber-500 text-slate-950' : 'bg-slate-100 text-slate-600'} grid place-items-center shrink-0"><i class="fa-solid ${item.icon}"></i></div>
      <div class="min-w-0"><div class="font-black text-sm text-slate-900">${item.name}</div><div class="text-[11px] text-slate-500 mt-0.5">${item.desc}</div></div>
      ${state.solution === key ? '<i class="fa-solid fa-circle-check text-amber-500 ml-auto"></i>' : ''}
    </button>`).join('');
}
function renderContainers() {
  const root = document.getElementById('container-list');
  root.innerHTML = Object.entries(DATA.containers).map(([key, item]) => `
    <button onclick="selectContainer('${key}')" class="option-card ${state.container === key ? 'active' : ''} border rounded-xl p-3 text-left">
      <div class="flex justify-between gap-3"><div><div class="font-black text-sm">${item.name}</div><div class="text-[11px] text-slate-500 mt-1">${item.length.toFixed(1)} × ${item.width.toFixed(2)} × ${item.height.toFixed(2)} m</div></div><span class="text-[10px] px-2 py-1 h-fit rounded-full bg-slate-100 text-slate-600 font-bold">${item.badge}</span></div>
    </button>`).join('');
}
function renderFinishes() {
  const root = document.getElementById('finish-list');
  root.innerHTML = Object.entries(DATA.finishes).map(([key, item]) => `
    <button onclick="selectFinish('${key}')" class="option-card ${state.finish === key ? 'active' : ''} border rounded-xl p-3 text-left">
      <div class="font-black text-sm">${item.name}</div><div class="text-[11px] text-slate-500 mt-0.5">${item.desc}</div>
    </button>`).join('');
}
function renderColors() {
  document.getElementById('color-list').innerHTML = DATA.colors.map(color => `<button onclick="selectColor('${color}')" aria-label="Elegir color ${color}" class="w-9 h-9 rounded-full border-2 ${state.exteriorColor === color ? 'border-amber-500 ring-2 ring-amber-200' : 'border-white'} shadow" style="background:${color}"></button>`).join('');
}
function renderExtras() {
  document.getElementById('extras-list').innerHTML = Object.entries(DATA.extras).map(([key, item]) => `
    <div class="border border-slate-200 rounded-xl p-3 flex items-center gap-3 bg-white">
      <div class="w-9 h-9 rounded-xl bg-slate-100 text-slate-600 grid place-items-center"><i class="fa-solid ${item.icon}"></i></div>
      <div class="flex-1"><div class="font-bold text-sm">${item.name}</div><div class="text-[10px] text-slate-400">Máx. ${item.max}</div></div>
      <button class="counter-btn" onclick="adjustCount('${key}', -1)">−</button>
      <div class="w-6 text-center font-black">${state.counts[key] || 0}</div>
      <button class="counter-btn" onclick="adjustCount('${key}', 1)">+</button>
    </div>`).join('');
}
function renderSummary() {
  const totals = calculate();
  const solution = DATA.solutions[state.solution];
  const container = DATA.containers[state.container];
  const totalEl = document.getElementById('customer-total');
  totalEl.textContent = money(totals.total);
  totalEl.classList.remove('price-pop'); void totalEl.offsetWidth; totalEl.classList.add('price-pop');
  document.getElementById('summary-container').textContent = container.short;
  document.getElementById('summary-solution').textContent = solution.name;
  document.getElementById('viewer-project-name').textContent = `${solution.name} · ${container.short}`;
  document.getElementById('viewer-dims').textContent = `${container.length.toFixed(2)} × ${container.width.toFixed(2)} × ${container.height.toFixed(2)} m · mobiliario referencial para escala`;

  const items = [];
  Object.entries(DATA.extras).forEach(([key, item]) => {
    const qty = state.counts[key] || 0;
    if (qty) items.push(`<div class="flex justify-between gap-3"><span class="text-slate-500"><i class="fa-solid ${item.icon} w-4 text-center mr-1"></i>${item.name}</span><strong>${qty}</strong></div>`);
  });
  items.push(`<div class="flex justify-between gap-3 pt-2 border-t"><span class="text-slate-500"><i class="fa-solid fa-layer-group w-4 text-center mr-1"></i>Terminación</span><strong>${DATA.finishes[state.finish].name}</strong></div>`);
  document.getElementById('summary-items').innerHTML = items.join('');
}
function renderCompanyMode() {
  const t = calculate();
  document.getElementById('admin-materials').textContent = money(t.materials);
  document.getElementById('admin-labor').textContent = money(t.labor);
  document.getElementById('admin-direct').textContent = money(t.direct);
  document.getElementById('admin-total').textContent = money(t.total);
  document.getElementById('margin-input').value = state.margin;
  document.getElementById('transport-input').value = state.transport;
  document.getElementById('tax-input').value = state.tax;
  document.getElementById('bom-table').innerHTML = t.bom.map(item => `<tr><td class="font-semibold">${item.name}</td><td>${item.qty}</td><td>${item.unit}</td><td>${money(item.unitCost)}</td><td class="font-bold">${money(item.subtotal)}</td></tr>`).join('');
}
function syncCustomerInputs() {
  ['name', 'company', 'phone', 'email'].forEach(key => {
    const el = document.getElementById(`customer-${key}`);
    if (el && el.value !== state.customer[key]) el.value = state.customer[key] || '';
  });
}
function renderAll() {
  renderSolutions();
  renderContainers();
  renderFinishes();
  renderColors();
  renderExtras();
  renderSummary();
  renderCompanyMode();
  syncCustomerInputs();
  goStep(state.step);
  rebuild3D();
}

function init3D() {
  const host = document.getElementById('canvas-container');
  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0b1220, 0.018);
  camera = new THREE.PerspectiveCamera(42, host.clientWidth / host.clientHeight, 0.05, 120);
  camera.position.set(9, 5.8, 10);
  renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(host.clientWidth, host.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  if ('outputEncoding' in renderer) renderer.outputEncoding = THREE.sRGBEncoding;
  if ('toneMapping' in renderer) { renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05; }
  host.appendChild(renderer.domElement);
  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.minDistance = 1.2;
  controls.maxDistance = 32;
  controls.maxPolarAngle = Math.PI * 0.49;
  ambientLight = new THREE.AmbientLight(0xffffff, 0.55);
  hemisphereLight = new THREE.HemisphereLight(0xdbeafe, 0x1e293b, 0.75);
  keyLight = new THREE.DirectionalLight(0xfff7ed, 1.25);
  keyLight.position.set(9, 15, 10);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.camera.near = 0.1;
  keyLight.shadow.camera.far = 50;
  keyLight.shadow.camera.left = -16;
  keyLight.shadow.camera.right = 16;
  keyLight.shadow.camera.top = 16;
  keyLight.shadow.camera.bottom = -16;
  fillLight = new THREE.DirectionalLight(0xbfd7ff, 0.34);
  fillLight.position.set(-10, 7, -10);
  scene.add(ambientLight, hemisphereLight, keyLight, fillLight);
  environmentGroup = new THREE.Group();
  scene.add(environmentGroup);
  buildEnvironment();
  containerGroup = new THREE.Group();
  scene.add(containerGroup);
  rebuild3D();
  setView('exterior', false);
  animate();
  window.addEventListener('resize', resizeRenderer);
}

function resizeRenderer() {
  const host = document.getElementById('canvas-container');
  if (!renderer || !camera || !host) return;
  const rect = host.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  camera.aspect = rect.width / rect.height;
  camera.updateProjectionMatrix();
  renderer.setSize(rect.width, rect.height);
}

function buildEnvironment() {
  disposeGroup(environmentGroup);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.94, metalness: 0.02 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.09;
  ground.receiveShadow = true;
  environmentGroup.add(ground);
  const pad = new THREE.Mesh(new THREE.PlaneGeometry(22, 9), new THREE.MeshStandardMaterial({ color: 0x273244, roughness: 0.88 }));
  pad.rotation.x = -Math.PI / 2;
  pad.position.y = -0.075;
  pad.receiveShadow = true;
  environmentGroup.add(pad);
  for (let i = -5; i <= 5; i++) {
    const line = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.008, 8.4), new THREE.MeshBasicMaterial({ color: 0x334155 }));
    line.position.set(i * 2, -0.065, 0);
    environmentGroup.add(line);
  }
}

function disposeGroup(group) {
  if (!group) return;
  while (group.children.length) {
    const child = group.children.pop();
    child.traverse?.(obj => {
      if (obj.geometry) obj.geometry.dispose?.();
      if (obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach(m => { Object.values(m).forEach(v => { if (v && v.isTexture) v.dispose?.(); }); m.dispose?.(); });
      }
    });
  }
}
function mat(color, opts = {}) { return new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.05, ...opts }); }
function box(w, h, d, material, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m; }
function cylinder(rt, rb, h, segments, material) { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, segments), material); m.castShadow = true; m.receiveShadow = true; return m; }
function sphere(r, material, width = 24, height = 16) { const m = new THREE.Mesh(new THREE.SphereGeometry(r, width, height), material); m.castShadow = true; m.receiveShadow = true; return m; }
function addGroup(parent, group, x = 0, y = 0, z = 0, ry = 0) { group.position.set(x, y, z); group.rotation.y = ry; parent.add(group); return group; }
function slotPosition(index, count, length, padding = .8) { if (count <= 1) return 0; const usable = Math.max(.1, length - padding * 2); return -usable / 2 + (usable / (count - 1)) * index; }

function createFloorMaterial() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (state.finish === 'sanitary') {
    ctx.fillStyle = '#cbd5e1'; ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 140; i++) { const v = 160 + Math.floor(Math.random() * 50); ctx.fillStyle = `rgba(${v},${v},${v},.22)`; ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2); }
  } else if (state.finish === 'basic') {
    ctx.fillStyle = '#6b7280'; ctx.fillRect(0, 0, 256, 256);
    for (let x = 0; x < 256; x += 32) { ctx.fillStyle = x % 64 === 0 ? '#737b86' : '#646b75'; ctx.fillRect(x, 0, 30, 256); }
  } else {
    ctx.fillStyle = '#8a6c46'; ctx.fillRect(0, 0, 256, 256);
    for (let x = 0; x < 256; x += 32) { ctx.fillStyle = x % 64 === 0 ? '#967751' : '#80613e'; ctx.fillRect(x, 0, 30, 256); ctx.fillStyle = 'rgba(30,20,10,.22)'; ctx.fillRect(x + 30, 0, 2, 256); }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(DATA.containers[state.container].length / 1.2, 2);
  if ('encoding' in texture) texture.encoding = THREE.sRGBEncoding;
  return new THREE.MeshStandardMaterial({ map: texture, roughness: 0.78, metalness: 0.01 });
}

function createContainerShell(c, materials) {
  const g = new THREE.Group();
  const { L, W, H } = { L: c.length, W: c.width, H: c.height };
  const { exterior, interior, frame, floor } = materials;
  g.add(box(L, .14, W, floor, 0, .02, 0));
  const postW = .13;
  [-L / 2, L / 2].forEach(x => [-W / 2, W / 2].forEach(z => { g.add(box(postW, H + .12, postW, frame, x, H / 2, z)); }));
  g.add(box(L, .11, .12, frame, 0, .07, -W / 2));
  g.add(box(L, .11, .12, frame, 0, .07, W / 2));
  g.add(box(L, .11, .12, frame, 0, H - .03, -W / 2));
  g.add(box(L, .11, .12, frame, 0, H - .03, W / 2));
  g.add(box(.075, H - .16, W - .18, exterior, -L / 2, H / 2, 0));
  g.add(box(.075, H - .16, W - .18, exterior, L / 2, H / 2, 0));
  g.add(box(L - .2, H - .16, .055, exterior, 0, H / 2, -W / 2));
  if (!state.cutaway) {
    g.add(box(L - .2, H - .16, .045, exterior, 0, H / 2, W / 2));
    g.add(box(L - .12, .07, W - .12, exterior, 0, H, 0));
  } else {
    g.add(box(L - .24, .06, .08, frame, 0, H - .02, W / 2));
  }
  g.add(box(L - .28, H - .28, .018, interior, 0, H / 2, -W / 2 + .055));
  const ribMat = mat(new THREE.Color(state.exteriorColor).multiplyScalar(.78), { roughness: .62, metalness: .2 });
  const spacing = .32;
  const count = Math.floor((L - .3) / spacing);
  for (let i = 0; i <= count; i++) {
    const x = -L / 2 + .18 + i * spacing;
    g.add(box(.028, H - .25, .022, ribMat, x, H / 2, -W / 2 - .038));
    if (!state.cutaway) g.add(box(.028, H - .25, .022, ribMat, x, H / 2, W / 2 + .038));
  }
  const blockMat = mat(0x172033, { roughness: .45, metalness: .55 });
  [-L / 2, L / 2].forEach(x => [-W / 2, W / 2].forEach(z => { [0.08, H - .08].forEach(y => g.add(box(.23, .15, .23, blockMat, x, y, z))); }));
  return g;
}

function createWindow(width = 1.2, height = 1.05) {
  const g = new THREE.Group();
  const frame = mat(0x273244, { roughness: .32, metalness: .45 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xa8d8ff, transparent: true, opacity: .42, roughness: .08, metalness: .04, side: THREE.DoubleSide });
  const t = .055;
  g.add(box(width, t, .09, frame, 0, height / 2, 0)); g.add(box(width, t, .09, frame, 0, -height / 2, 0));
  g.add(box(t, height, .09, frame, -width / 2, 0, 0)); g.add(box(t, height, .09, frame, width / 2, 0, 0));
  g.add(box(.035, height - .08, .08, frame, 0, 0, 0)); g.add(box(width - .11, height - .11, .025, glass, 0, 0, -.018));
  g.add(box(width + .08, .035, .16, frame, 0, -height / 2 - .04, -.015));
  return g;
}
function createDoor() {
  const g = new THREE.Group();
  const frame = mat(0x111827, { roughness: .38, metalness: .5 }); const panel = mat(0xe5e7eb, { roughness: .48, metalness: .15 }); const handleMat = mat(0xb6bdc7, { roughness: .18, metalness: .78 });
  g.add(box(.98, .06, .12, frame, 0, 1.04, 0)); g.add(box(.06, 2.08, .12, frame, -.49, 0, 0)); g.add(box(.06, 2.08, .12, frame, .49, 0, 0)); g.add(box(.86, 1.98, .055, panel, 0, -.01, .005));
  const handle = cylinder(.028, .028, .14, 14, handleMat); handle.rotation.z = Math.PI / 2; handle.position.set(.29, 0, .065); g.add(handle);
  const esc = cylinder(.055, .055, .016, 18, handleMat); esc.rotation.x = Math.PI / 2; esc.position.set(.25, 0, .06); g.add(esc); return g;
}
function createWC() {
  const g = new THREE.Group();
  const porcelain = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: .16, metalness: 0, clearcoat: .6, clearcoatRoughness: .22 }); const dark = mat(0x334155, { roughness: .4 });
  const points = [new THREE.Vector2(.13, 0), new THREE.Vector2(.18, .12), new THREE.Vector2(.22, .25), new THREE.Vector2(.32, .34), new THREE.Vector2(.34, .42), new THREE.Vector2(.29, .50)];
  const bowl = new THREE.Mesh(new THREE.LatheGeometry(points, 28), porcelain); bowl.scale.z = 1.24; bowl.castShadow = bowl.receiveShadow = true; g.add(bowl);
  const seat = new THREE.Mesh(new THREE.TorusGeometry(.29, .035, 10, 28), porcelain); seat.scale.z = .78; seat.rotation.x = Math.PI / 2; seat.position.y = .505; g.add(seat);
  const hole = new THREE.Mesh(new THREE.TorusGeometry(.19, .017, 8, 24), dark); hole.scale.z = .72; hole.rotation.x = Math.PI / 2; hole.position.y = .51; g.add(hole);
  g.add(box(.46, .48, .19, porcelain, 0, .66, .22));
  const button = cylinder(.025, .025, .012, 16, mat(0xb8c0ca, { metalness: .8, roughness: .18 })); button.position.set(.12, .91, .22); g.add(button); g.scale.set(.92, .92, .92); return g;
}
function createSink() {
  const g = new THREE.Group(); const porcelain = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: .15, clearcoat: .55, clearcoatRoughness: .2 }); const chrome = mat(0xcbd5e1, { roughness: .12, metalness: .9 });
  const pedestal = cylinder(.11, .15, .66, 22, porcelain); pedestal.position.y = .34; g.add(pedestal);
  const basin = new THREE.Mesh(new THREE.SphereGeometry(.34, 28, 16, 0, Math.PI * 2, 0, Math.PI * .55), porcelain); basin.scale.set(1.18, .45, .82); basin.position.y = .72; basin.rotation.x = Math.PI; g.add(basin);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(.31, .024, 10, 28), porcelain); rim.scale.z = .72; rim.rotation.x = Math.PI / 2; rim.position.y = .76; g.add(rim);
  const stem = cylinder(.018, .018, .24, 12, chrome); stem.position.set(0, .88, .16); g.add(stem); const spout = cylinder(.014, .014, .18, 12, chrome); spout.rotation.x = Math.PI / 2; spout.position.set(0, .99, .09); g.add(spout); return g;
}
function createShower() {
  const g = new THREE.Group(); const white = mat(0xf8fafc, { roughness: .26 }); const chrome = mat(0xcbd5e1, { roughness: .12, metalness: .92 }); const glass = new THREE.MeshPhysicalMaterial({ color: 0xcfe8ff, transparent: true, opacity: .28, roughness: .04, side: THREE.DoubleSide });
  g.add(box(.78, .055, .78, white, 0, .03, 0)); g.add(box(.018, 1.88, .78, glass, .39, .97, 0)); g.add(box(.78, 1.88, .018, glass, 0, .97, -.39));
  const pipe = cylinder(.016, .016, 1.55, 12, chrome); pipe.position.set(-.28, .98, -.31); g.add(pipe); const arm = cylinder(.014, .014, .23, 12, chrome); arm.rotation.z = Math.PI / 2; arm.position.set(-.18, 1.71, -.31); g.add(arm); const head = cylinder(.1, .1, .025, 20, chrome); head.rotation.z = Math.PI / 2; head.position.set(-.05, 1.71, -.31); g.add(head); return g;
}
function createSplitAC() {
  const g = new THREE.Group(); const shell = mat(0xf8fafc, { roughness: .25 }); const vent = mat(0x475569, { roughness: .42 });
  g.add(box(.92, .28, .19, shell, 0, 0, 0)); g.add(box(.78, .028, .025, vent, 0, -.1, .105)); for (let i = 0; i < 9; i++) g.add(box(.055, .016, .018, vent, -.32 + i * .08, -.105, .12)); g.add(box(.035, .012, .012, mat(0x22c55e, { emissive: 0x22c55e, emissiveIntensity: .8 }), .33, .04, .105)); return g;
}
function createCondenser() {
  const g = new THREE.Group(); const shell = mat(0xe5e7eb, { roughness: .35 }); const dark = mat(0x334155, { roughness: .35, metalness: .15 }); g.add(box(.62, .48, .24, shell, 0, .24, 0)); const fan = cylinder(.18, .18, .025, 28, dark); fan.rotation.x = Math.PI / 2; fan.position.set(0, .26, .13); g.add(fan); for (let i = 0; i < 7; i++) g.add(box(.42, .012, .012, dark, 0, .14 + i * .045, .145)); return g;
}
function createDeskUnit() {
  const g = new THREE.Group(); const wood = mat(0xa47b52, { roughness: .7 }); const metal = mat(0x334155, { roughness: .35, metalness: .55 }); const screenMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: .18, metalness: .1, emissive: 0x1e3a8a, emissiveIntensity: state.night ? .8 : .18 }); const chairMat = mat(0x1f2937, { roughness: .58 }); const chrome = mat(0x94a3b8, { roughness: .2, metalness: .8 });
  g.add(box(.95, .055, .52, wood, 0, .74, 0)); [-.39, .39].forEach(x => [-.19, .19].forEach(z => g.add(box(.035, .72, .035, metal, x, .37, z)))); g.add(box(.44, .29, .035, screenMat, 0, 1.03, -.12)); g.add(box(.045, .22, .035, metal, 0, .87, -.12)); g.add(box(.22, .025, .14, metal, 0, .77, -.12)); g.add(box(.36, .018, .14, mat(0x111827), 0, .79, .13));
  const chair = new THREE.Group(); chair.add(box(.42, .08, .42, chairMat, 0, .5, 0)); const back = box(.42, .55, .065, chairMat, 0, .79, .17); back.rotation.x = -.08; chair.add(back); const stem = cylinder(.025, .025, .42, 12, chrome); stem.position.y = .27; chair.add(stem); const base = cylinder(.23, .05, .035, 18, chrome); base.position.y = .06; chair.add(base); chair.position.set(0, 0, .72); chair.rotation.y = Math.PI; g.add(chair); return g;
}
function createDiningSet() {
  const g = new THREE.Group(); const top = mat(0xa47b52, { roughness: .65 }); const metal = mat(0x334155, { roughness: .35, metalness: .55 }); g.add(box(1.7, .07, .72, top, 0, .75, 0)); [-.7, .7].forEach(x => [-.26, .26].forEach(z => g.add(box(.04, .72, .04, metal, x, .37, z)))); [-.6, .6].forEach(z => { g.add(box(1.65, .08, .28, top, 0, .47, z)); [-.68, .68].forEach(x => g.add(box(.035, .44, .035, metal, x, .24, z))); }); return g;
}
function createLockerBank(count = 3) {
  const g = new THREE.Group(); const shell = mat(0x64748b, { roughness: .42, metalness: .35 }); const handle = mat(0x1e293b, { roughness: .35, metalness: .5 }); for (let i = 0; i < count; i++) { const x = (i - (count - 1) / 2) * .45; g.add(box(.42, 1.75, .42, shell, x, .875, 0)); g.add(box(.03, .16, .02, handle, x + .12, .96, .22)); for (let s = 0; s < 4; s++) g.add(box(.2, .012, .018, handle, x, 1.47 - s * .055, .225)); } return g;
}
function createRack() {
  const g = new THREE.Group(); const metal = mat(0x475569, { roughness: .36, metalness: .55 }); const shelf = mat(0x9a6f45, { roughness: .68 }); [-.8, .8].forEach(x => [-.28, .28].forEach(z => g.add(box(.035, 1.9, .035, metal, x, .95, z)))); [0.25, .78, 1.31, 1.84].forEach(y => g.add(box(1.7, .045, .66, shelf, 0, y, 0))); const boxMat = mat(0xb77938, { roughness: .8 }); g.add(box(.45, .32, .4, boxMat, -.45, .48, 0)); g.add(box(.55, .38, .44, boxMat, .38, 1.02, 0)); return g;
}
function createHuman() {
  const g = new THREE.Group(); const bodyMat = mat(0x334155, { roughness: .75 }); const skin = mat(0xc99570, { roughness: .65 }); const legs = mat(0x1e293b, { roughness: .75 }); const head = sphere(.115, skin, 20, 14); head.position.y = 1.68; g.add(head); const torso = cylinder(.16, .22, .62, 18, bodyMat); torso.position.y = 1.22; g.add(torso); [-.09, .09].forEach(x => { const leg = cylinder(.055, .06, .68, 12, legs); leg.position.set(x, .52, 0); g.add(leg); }); [-.24, .24].forEach(x => { const arm = cylinder(.04, .045, .58, 12, bodyMat); arm.position.set(x, 1.2, 0); arm.rotation.z = x < 0 ? -.08 : .08; g.add(arm); }); return g;
}
function createCeilingLight(length = .65) {
  const shell = mat(0xf8fafc, { roughness: .3 }); const glow = new THREE.MeshStandardMaterial({ color: 0xfffbeb, emissive: 0xffd166, emissiveIntensity: state.night ? 2.1 : .42, roughness: .28 }); const g = new THREE.Group(); g.add(box(length, .035, .16, shell, 0, 0, 0)); g.add(box(length - .08, .012, .11, glow, 0, -.025, 0)); return g;
}
function createPartition(width, height) {
  const g = new THREE.Group(); const wall = mat(state.finish === 'sanitary' ? 0xf8fafc : 0xe9edf2, { roughness: state.finish === 'sanitary' ? .32 : .78 }); const trim = mat(0xcbd5e1, { roughness: .45, metalness: .18 }); g.add(box(.075, height, width, wall, 0, height / 2, 0)); g.add(box(.09, .065, width, trim, 0, .04, 0)); g.add(box(.09, .055, width, trim, 0, height - .04, 0)); return g;
}

function addSanitaryObjects(parent, c) {
  const list = []; for (let i = 0; i < (state.counts.wc || 0); i++) list.push('wc'); for (let i = 0; i < (state.counts.sink || 0); i++) list.push('sink'); for (let i = 0; i < (state.counts.shower || 0); i++) list.push('shower');
  const cols = Math.max(1, Math.min(c.length > 8 ? 5 : 3, Math.ceil(Math.sqrt(list.length || 1))));
  list.forEach((type, i) => { const row = Math.floor(i / cols); const col = i % cols; const x = clamp(-c.length * .28 + col * 1.05, -c.length / 2 + .65, c.length / 2 - .65); const z = clamp(-.55 + row * .95, -c.width / 2 + .46, c.width / 2 - .46); const obj = type === 'wc' ? createWC() : type === 'sink' ? createSink() : createShower(); addGroup(parent, obj, x, .08, z, type === 'sink' ? Math.PI : 0); });
}
function addFurnishings(parent, c) {
  const key = state.solution;
  if (key === 'office' || key === 'officeBath' || key === 'custom') {
    const maxDesks = c.length > 8 ? 6 : 4; const deskCount = key === 'custom' ? Math.min(2, maxDesks) : Math.min(maxDesks, Math.max(2, Math.ceil((state.counts.electrical || 2) / 1.4))); const usableLength = state.counts.partition ? c.length * .62 : c.length * .82;
    for (let i = 0; i < deskCount; i++) { const row = i % 2; const col = Math.floor(i / 2); const cols = Math.ceil(deskCount / 2); const x = cols <= 1 ? 0 : -usableLength / 2 + .7 + col * ((usableLength - 1.4) / Math.max(1, cols - 1)); const z = row === 0 ? -.48 : .48; const desk = createDeskUnit(); desk.scale.set(.82, .82, .82); addGroup(parent, desk, x, .08, z, row === 0 ? 0 : Math.PI); }
  } else if (key === 'dining') {
    const sets = c.length > 8 ? 3 : 2; for (let i = 0; i < sets; i++) addGroup(parent, createDiningSet(), slotPosition(i, sets, c.length, 1.3), .08, 0, 0);
  } else if (key === 'locker') {
    const banks = c.length > 8 ? 4 : 2; for (let i = 0; i < banks; i++) addGroup(parent, createLockerBank(3), slotPosition(i, banks, c.length, 1.1), .08, -c.width / 2 + .28, 0); const benchMat = mat(0x9a6f45, { roughness: .72 }); const metal = mat(0x475569, { metalness: .5, roughness: .35 }); const bench = new THREE.Group(); bench.add(box(Math.min(4, c.length * .45), .08, .36, benchMat, 0, .48, 0)); [-1.3, 0, 1.3].forEach(x => bench.add(box(.04, .45, .04, metal, clamp(x, -c.length*.2, c.length*.2), .24, 0))); addGroup(parent, bench, 0, .08, .45);
  } else if (key === 'warehouse') {
    const racks = c.length > 8 ? 5 : 3; for (let i = 0; i < racks; i++) { const rack = createRack(); rack.scale.set(.78, .78, .78); addGroup(parent, rack, slotPosition(i, racks, c.length, 1.1), .08, -.65, 0); }
  }
}

function rebuild3D() {
  if (!containerGroup) return;
  disposeGroup(containerGroup);
  const c = DATA.containers[state.container];
  const extColor = new THREE.Color(state.exteriorColor);
  const materials = { exterior: mat(extColor, { roughness: .58, metalness: .2 }), interior: mat(state.finish === 'sanitary' ? 0xf8fafc : 0xf1f5f9, { roughness: state.finish === 'sanitary' ? .32 : .82 }), frame: mat(new THREE.Color(extColor).multiplyScalar(.55), { roughness: .42, metalness: .48 }), floor: createFloorMaterial() };
  containerGroup.add(createContainerShell(c, materials));
  const winCount = state.counts.window || 0; for (let i = 0; i < winCount; i++) addGroup(containerGroup, createWindow(), slotPosition(i, winCount, c.length, .9), c.height * .60, -c.width / 2 - .075, 0);
  const doorCount = state.counts.door || 0; for (let i = 0; i < doorCount; i++) addGroup(containerGroup, createDoor(), slotPosition(i, doorCount, c.length, 1.0), 1.06, c.width / 2 + .07, 0);
  const partitions = state.counts.partition || 0; for (let i = 0; i < partitions; i++) { const x = -c.length / 2 + ((i + 1) * c.length / (partitions + 1)); addGroup(containerGroup, createPartition(c.width - .2, c.height - .15), x, .08, 0); }
  addSanitaryObjects(containerGroup, c);
  const acCount = state.counts.ac || 0; for (let i = 0; i < acCount; i++) { const x = slotPosition(i, acCount, c.length, 1.0); addGroup(containerGroup, createSplitAC(), x, c.height - .42, -c.width / 2 + .17); addGroup(containerGroup, createCondenser(), x, .08, c.width / 2 + .28); }
  const lightCount = Math.max(1, Math.ceil((state.counts.electrical || 0) / 3)); for (let i = 0; i < lightCount; i++) addGroup(containerGroup, createCeilingLight(), slotPosition(i, lightCount, c.length, .7), c.height - .1, 0);
  addFurnishings(containerGroup, c);
  if (state.showPeople) addGroup(containerGroup, createHuman(), c.length * .28, .08, state.cutaway ? c.width * .24 : c.width / 2 + .75, state.cutaway ? Math.PI : -Math.PI / 2);
  controls?.target.set(0, c.height * .45, 0);
  updateLighting();
}

function animateCamera(position, target, duration = 520) {
  if (!camera || !controls) return;
  if (cameraAnim) cancelAnimationFrame(cameraAnim);
  const startPos = camera.position.clone(); const startTarget = controls.target.clone(); const start = performance.now(); const endPos = new THREE.Vector3(...position); const endTarget = new THREE.Vector3(...target);
  function tick(now) { const t = clamp((now - start) / duration, 0, 1); const eased = 1 - Math.pow(1 - t, 3); camera.position.lerpVectors(startPos, endPos, eased); controls.target.lerpVectors(startTarget, endTarget, eased); camera.lookAt(controls.target); controls.update(); if (t < 1) cameraAnim = requestAnimationFrame(tick); }
  cameraAnim = requestAnimationFrame(tick);
}
function setView(view, animateIt = true) {
  if (!camera || !controls) return;
  const c = DATA.containers[state.container]; const span = Math.max(c.length, 6); currentView = view; const needsCutaway = view === 'cutaway' || view === 'top'; if (state.cutaway !== needsCutaway) { state.cutaway = needsCutaway; rebuild3D(); }
  let pos, target, label;
  if (view === 'exterior') { pos = [span * .68, c.height * 2.2, span * .72]; target = [0, c.height * .44, 0]; label = 'Exterior'; }
  else if (view === 'cutaway') { pos = [span * .62, c.height * 1.7, c.width * 2.55]; target = [0, c.height * .42, 0]; label = 'Corte 3D'; }
  else if (view === 'interior') { pos = [-c.length * .18, c.height * .55, c.width * .12]; target = [c.length * .16, c.height * .52, -c.width * .28]; label = 'Interior'; }
  else { pos = [.01, span * 1.22, .01]; target = [0, 0, 0]; label = 'Planta'; }
  document.getElementById('scene-mode-label').textContent = label;
  if (animateIt) animateCamera(pos, target); else { camera.position.set(...pos); controls.target.set(...target); camera.lookAt(controls.target); controls.update(); }
}
function toggleDayNight() { mutate(() => { state.night = !state.night; }, { history: false }); }
function togglePeople() { mutate(() => { state.showPeople = !state.showPeople; }, { history: false }); const icon = document.getElementById('people-icon'); if (icon) icon.style.opacity = state.showPeople ? '1' : '.45'; }
function updateLighting() {
  if (!scene) return;
  const icon = document.getElementById('day-icon');
  if (state.night) { scene.background = new THREE.Color(0x020617); scene.fog.color.set(0x020617); ambientLight.intensity = .18; hemisphereLight.intensity = .28; keyLight.intensity = .28; fillLight.intensity = .12; if (renderer) renderer.toneMappingExposure = .88; if (icon) { icon.classList.remove('fa-sun'); icon.classList.add('fa-moon'); } }
  else { scene.background = new THREE.Color(0x0b1220); scene.fog.color.set(0x0b1220); ambientLight.intensity = .55; hemisphereLight.intensity = .75; keyLight.intensity = 1.25; fillLight.intensity = .34; if (renderer) renderer.toneMappingExposure = 1.05; if (icon) { icon.classList.remove('fa-moon'); icon.classList.add('fa-sun'); } }
}
function togglePresentation() {
  isPresentation = !isPresentation;
  document.getElementById('app-shell').classList.toggle('presentation-mode', isPresentation);
  document.body.classList.toggle('presentation-body', isPresentation);
  document.querySelector('.presentation-trigger').innerHTML = isPresentation ? '<i class="fa-solid fa-compress mr-1"></i> Salir' : '<i class="fa-solid fa-expand mr-1"></i> Presentación';
  setTimeout(() => { resizeRenderer(); if (isPresentation) setView('cutaway'); }, 120);
}
function animate() { requestAnimationFrame(animate); controls?.update(); if (renderer && scene && camera) renderer.render(scene, camera); }

function openCompanyMode() { renderCompanyMode(); showModal('company-modal'); }
function openQuote() {
  const t = calculate(); const solution = DATA.solutions[state.solution]; const container = DATA.containers[state.container];
  document.getElementById('quote-number').textContent = `COT-${new Date().toISOString().slice(2,10).replaceAll('-', '')}-${String(Date.now()).slice(-4)}`;
  document.getElementById('quote-date').textContent = new Date().toLocaleDateString('es-CL', { year: 'numeric', month: 'long', day: '2-digit' });
  const c = state.customer;
  document.getElementById('quote-customer').innerHTML = [c.name || 'Cliente por definir', c.company, c.phone, c.email].filter(Boolean).map(x => `<div>${escapeHtml(x)}</div>`).join('');
  document.getElementById('quote-project').innerHTML = `<div><strong>${solution.name}</strong></div><div>${container.name}</div><div>${container.length.toFixed(2)} × ${container.width.toFixed(2)} × ${container.height.toFixed(2)} m</div><div>Terminación ${DATA.finishes[state.finish].name}</div>`;
  document.getElementById('quote-total').textContent = money(t.total);
  document.getElementById('quote-items').innerHTML = Object.entries(DATA.extras).filter(([key]) => state.counts[key] > 0).map(([key, item]) => `<div class="flex justify-between gap-4 border-b border-slate-100 pb-1"><span>${item.name}</span><strong>${state.counts[key]}</strong></div>`).join('');
  try { renderer.render(scene, camera); document.getElementById('quote-render').src = renderer.domElement.toDataURL('image/jpeg', .9); } catch { document.getElementById('quote-render').removeAttribute('src'); }
  showModal('quote-modal');
}
function shareWhatsApp() {
  const t = calculate(); const solution = DATA.solutions[state.solution]; const container = DATA.containers[state.container]; const extras = Object.entries(DATA.extras).filter(([key]) => state.counts[key] > 0).map(([key, item]) => `${item.name}: ${state.counts[key]}`).join('\n'); const text = `Proyecto modular\n${solution.name} - ${container.short}\n${extras}\nTotal estimado: ${money(t.total)} IVA incluido\n\nValor referencial sujeto a validación técnica.`; window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
}
function saveProject() { localStorage.setItem('modular-config-v3', JSON.stringify(state)); toast('Proyecto guardado en este navegador'); }
function loadProject() {
  try { const raw = localStorage.getItem('modular-config-v3') || localStorage.getItem('modular-config-v2'); if (!raw) return false; const loaded = JSON.parse(raw); state = { ...clone(DEFAULT_STATE), ...loaded, counts: { ...DEFAULT_STATE.counts, ...(loaded.counts || {}) }, customer: { ...DEFAULT_STATE.customer, ...(loaded.customer || {}) } }; return true; } catch { return false; }
}
function resetProject() { if (!confirm('¿Reiniciar el proyecto actual?')) return; pushHistory(); state = clone(DEFAULT_STATE); currentView = 'exterior'; renderAll(); setView('exterior'); toast('Proyecto reiniciado'); }
function showModal(id) { const el = document.getElementById(id); el.classList.remove('hidden'); el.classList.add('flex'); }
function closeModal(id) { const el = document.getElementById(id); el.classList.add('hidden'); el.classList.remove('flex'); }
function toast(message) { const el = document.getElementById('toast'); el.textContent = message; el.classList.add('show'); clearTimeout(toast._timer); toast._timer = setTimeout(() => el.classList.remove('show'), 2200); }
function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[c])); }
window.addEventListener('DOMContentLoaded', () => { loadProject(); init3D(); renderAll(); });