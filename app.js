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
  transparentRoof: true,
  night: false,
  customer: { name: '', company: '', phone: '', email: '' }
};

let state = clone(DEFAULT_STATE);
let history = [];
let future = [];
let scene, camera, renderer, controls, containerGroup, ambientLight, keyLight, fillLight;

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

function setCustomer(key, value) {
  state.customer[key] = value;
}

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
  const root = document.getElementById('color-list');
  root.innerHTML = DATA.colors.map(color => `<button onclick="selectColor('${color}')" aria-label="Elegir color ${color}" class="w-9 h-9 rounded-full border-2 ${state.exteriorColor === color ? 'border-amber-500 ring-2 ring-amber-200' : 'border-white'} shadow" style="background:${color}"></button>`).join('');
}

function renderExtras() {
  const root = document.getElementById('extras-list');
  root.innerHTML = Object.entries(DATA.extras).map(([key, item]) => `
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
  camera = new THREE.PerspectiveCamera(45, host.clientWidth / host.clientHeight, 0.1, 1000);
  camera.position.set(9, 6, 10);
  renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(host.clientWidth, host.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  host.appendChild(renderer.domElement);

  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.minDistance = 3;
  controls.maxDistance = 28;

  ambientLight = new THREE.AmbientLight(0xffffff, 0.72);
  scene.add(ambientLight);
  keyLight = new THREE.DirectionalLight(0xffffff, 1.0);
  keyLight.position.set(8, 14, 10); keyLight.castShadow = true; scene.add(keyLight);
  fillLight = new THREE.DirectionalLight(0xbfd7ff, 0.35);
  fillLight.position.set(-10, 8, -10); scene.add(fillLight);

  const grid = new THREE.GridHelper(40, 40, 0x475569, 0x1e293b);
  grid.position.y = -0.08; scene.add(grid);
  containerGroup = new THREE.Group(); scene.add(containerGroup);
  rebuild3D();
  setView('exterior');
  animate();

  window.addEventListener('resize', () => {
    const rect = host.getBoundingClientRect();
    camera.aspect = rect.width / rect.height;
    camera.updateProjectionMatrix();
    renderer.setSize(rect.width, rect.height);
  });
}

function disposeGroup(group) {
  while (group.children.length) {
    const child = group.children.pop();
    child.traverse?.(obj => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach(m => m.dispose?.());
      }
    });
  }
}

function meshBox(w, h, d, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m;
}

function rebuild3D() {
  if (!containerGroup) return;
  disposeGroup(containerGroup);
  const c = DATA.containers[state.container];
  const L = c.length, W = c.width, H = c.height;
  const ext = new THREE.Color(state.exteriorColor);
  const wallMat = new THREE.MeshStandardMaterial({ color: ext, roughness: .55, metalness: .18 });
  const translucentMat = new THREE.MeshStandardMaterial({ color: ext, roughness: .45, metalness: .1, transparent: true, opacity: .24, side: THREE.DoubleSide });
  const floorMat = new THREE.MeshStandardMaterial({ color: state.finish === 'sanitary' ? 0xcbd5e1 : 0x8b6f47, roughness: .78 });
  const insideMat = new THREE.MeshStandardMaterial({ color: state.finish === 'sanitary' ? 0xf8fafc : 0xf1f5f9, roughness: .85 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x172033, roughness: .45, metalness: .35 });
  const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x93c5fd, transparent: true, opacity: .45, roughness: .05, metalness: 0 });
  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .35 });
  const accentMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: .35 });

  containerGroup.add(meshBox(L, .14, W, floorMat, 0, .02, 0));
  containerGroup.add(meshBox(.09, H, W, wallMat, -L / 2, H / 2, 0));
  containerGroup.add(meshBox(.09, H, W, wallMat, L / 2, H / 2, 0));
  containerGroup.add(meshBox(L, H, .08, wallMat, 0, H / 2, -W / 2));
  containerGroup.add(meshBox(L, H, .06, translucentMat, 0, H / 2, W / 2));
  if (!state.transparentRoof) containerGroup.add(meshBox(L, .08, W, wallMat, 0, H, 0));
  else containerGroup.add(meshBox(L, .05, W, translucentMat, 0, H, 0));

  const ribs = Math.max(6, Math.floor(L / .45));
  for (let i = 1; i < ribs; i++) {
    const x = -L / 2 + (L / ribs) * i;
    containerGroup.add(meshBox(.025, H * .92, .035, darkMat, x, H * .5, -W / 2 - .05));
  }

  const winCount = state.counts.window || 0;
  for (let i = 0; i < winCount; i++) {
    const x = slotPosition(i, winCount, L, .85);
    const frame = meshBox(1.18, 1.02, .1, darkMat, x, H * .58, -W / 2 - .09);
    const glass = meshBox(1.04, .88, .03, glassMat, x, H * .58, -W / 2 - .15);
    containerGroup.add(frame, glass);
  }

  const doorCount = state.counts.door || 0;
  for (let i = 0; i < doorCount; i++) {
    const x = slotPosition(i, doorCount, L, .95);
    containerGroup.add(meshBox(.9, 2.02, .11, darkMat, x, 1.05, W / 2 + .08));
    const handle = meshBox(.05, .05, .08, accentMat, x + .28, 1.03, W / 2 + .17);
    containerGroup.add(handle);
  }

  const partitions = state.counts.partition || 0;
  for (let i = 0; i < partitions; i++) {
    const x = -L / 2 + ((i + 1) * L / (partitions + 1));
    const wall = meshBox(.08, H - .16, W - .18, insideMat, x, (H - .16) / 2 + .08, 0);
    containerGroup.add(wall);
  }

  const acCount = state.counts.ac || 0;
  for (let i = 0; i < acCount; i++) {
    const x = slotPosition(i, acCount, L, 1.0);
    containerGroup.add(meshBox(.9, .3, .2, accentMat, x, H - .38, -W / 2 + .16));
  }

  const sanitary = [];
  for (let i = 0; i < (state.counts.wc || 0); i++) sanitary.push('wc');
  for (let i = 0; i < (state.counts.sink || 0); i++) sanitary.push('sink');
  for (let i = 0; i < (state.counts.shower || 0); i++) sanitary.push('shower');
  sanitary.forEach((type, i) => {
    const cols = Math.max(1, Math.min(4, Math.ceil(Math.sqrt(sanitary.length))));
    const row = Math.floor(i / cols), col = i % cols;
    const startX = -Math.min(L * .32, cols * .75);
    const x = clamp(startX + col * 1.15, -L / 2 + .7, L / 2 - .7);
    const z = clamp(-.65 + row * 1.05, -W / 2 + .45, W / 2 - .45);
    if (type === 'wc') {
      const base = meshBox(.42, .42, .58, whiteMat, x, .23, z);
      const tank = meshBox(.42, .48, .18, whiteMat, x, .57, z + .18);
      containerGroup.add(base, tank);
    } else if (type === 'sink') {
      const basin = meshBox(.58, .16, .42, whiteMat, x, .78, z);
      const pedestal = meshBox(.18, .68, .18, whiteMat, x, .38, z);
      containerGroup.add(basin, pedestal);
    } else {
      const tray = meshBox(.78, .06, .78, whiteMat, x, .07, z);
      const screen = meshBox(.04, 1.85, .78, glassMat, x + .38, .98, z);
      containerGroup.add(tray, screen);
    }
  });

  const lightCount = Math.max(1, Math.ceil((state.counts.electrical || 0) / 3));
  const emissiveMat = new THREE.MeshStandardMaterial({ color: 0xfffbeb, emissive: 0xffd166, emissiveIntensity: state.night ? 1.3 : .35 });
  for (let i = 0; i < lightCount; i++) {
    const x = slotPosition(i, lightCount, L, .7);
    containerGroup.add(meshBox(.5, .035, .14, emissiveMat, x, H - .08, 0));
  }

  controls.target.set(0, H * .45, 0);
  updateLighting();
}

function slotPosition(index, count, length, padding = .8) {
  if (count <= 1) return 0;
  const usable = Math.max(.1, length - padding * 2);
  return -usable / 2 + (usable / (count - 1)) * index;
}

function setView(view) {
  if (!camera || !controls) return;
  const c = DATA.containers[state.container];
  const span = Math.max(c.length, 6);
  if (view === 'exterior') camera.position.set(span * .72, c.height * 2.25, span * .78);
  if (view === 'interior') camera.position.set(0, c.height * .58, c.width * .25);
  if (view === 'top') camera.position.set(.01, span * 1.3, .01);
  controls.target.set(0, c.height * .42, 0);
  camera.lookAt(controls.target);
  controls.update();
}

function toggleRoof() { mutate(() => { state.transparentRoof = !state.transparentRoof; }); }
function toggleDayNight() { mutate(() => { state.night = !state.night; }); }

function updateLighting() {
  if (!scene) return;
  if (state.night) {
    scene.background = new THREE.Color(0x020617);
    ambientLight.intensity = .22;
    keyLight.intensity = .32;
    fillLight.intensity = .18;
    document.getElementById('day-icon')?.classList.replace('fa-sun', 'fa-moon');
  } else {
    scene.background = new THREE.Color(0x0f172a);
    ambientLight.intensity = .72;
    keyLight.intensity = 1;
    fillLight.intensity = .35;
    document.getElementById('day-icon')?.classList.replace('fa-moon', 'fa-sun');
  }
}

function animate() {
  requestAnimationFrame(animate);
  controls?.update();
  if (renderer && scene && camera) renderer.render(scene, camera);
}

function openCompanyMode() {
  renderCompanyMode();
  showModal('company-modal');
}

function openQuote() {
  const t = calculate();
  const solution = DATA.solutions[state.solution];
  const container = DATA.containers[state.container];
  document.getElementById('quote-number').textContent = `COT-${new Date().toISOString().slice(2,10).replaceAll('-', '')}-${String(Date.now()).slice(-4)}`;
  document.getElementById('quote-date').textContent = new Date().toLocaleDateString('es-CL', { year: 'numeric', month: 'long', day: '2-digit' });
  const c = state.customer;
  document.getElementById('quote-customer').innerHTML = [c.name || 'Cliente por definir', c.company, c.phone, c.email].filter(Boolean).map(x => `<div>${escapeHtml(x)}</div>`).join('');
  document.getElementById('quote-project').innerHTML = `<div><strong>${solution.name}</strong></div><div>${container.name}</div><div>${container.length.toFixed(2)} × ${container.width.toFixed(2)} × ${container.height.toFixed(2)} m</div><div>Terminación ${DATA.finishes[state.finish].name}</div>`;
  document.getElementById('quote-total').textContent = money(t.total);
  document.getElementById('quote-items').innerHTML = Object.entries(DATA.extras).filter(([key]) => state.counts[key] > 0).map(([key, item]) => `<div class="flex justify-between gap-4 border-b border-slate-100 pb-1"><span>${item.name}</span><strong>${state.counts[key]}</strong></div>`).join('');
  try {
    renderer.render(scene, camera);
    document.getElementById('quote-render').src = renderer.domElement.toDataURL('image/jpeg', .9);
  } catch (e) {
    document.getElementById('quote-render').removeAttribute('src');
  }
  showModal('quote-modal');
}

function shareWhatsApp() {
  const t = calculate();
  const solution = DATA.solutions[state.solution];
  const container = DATA.containers[state.container];
  const extras = Object.entries(DATA.extras).filter(([key]) => state.counts[key] > 0).map(([key, item]) => `${item.name}: ${state.counts[key]}`).join('\n');
  const text = `Proyecto modular\n${solution.name} - ${container.short}\n${extras}\nTotal estimado: ${money(t.total)} IVA incluido\n\nValor referencial sujeto a validación técnica.`;
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
}

function saveProject() {
  localStorage.setItem('modular-config-v2', JSON.stringify(state));
  toast('Proyecto guardado en este navegador');
}

function loadProject() {
  try {
    const raw = localStorage.getItem('modular-config-v2');
    if (!raw) return false;
    const loaded = JSON.parse(raw);
    state = { ...clone(DEFAULT_STATE), ...loaded, counts: { ...DEFAULT_STATE.counts, ...(loaded.counts || {}) }, customer: { ...DEFAULT_STATE.customer, ...(loaded.customer || {}) } };
    return true;
  } catch { return false; }
}

function resetProject() {
  if (!confirm('¿Reiniciar el proyecto actual?')) return;
  pushHistory();
  state = clone(DEFAULT_STATE);
  renderAll();
  toast('Proyecto reiniciado');
}

function showModal(id) {
  const el = document.getElementById(id);
  el.classList.remove('hidden');
  el.classList.add('flex');
}
function closeModal(id) {
  const el = document.getElementById(id);
  el.classList.add('hidden');
  el.classList.remove('flex');
}

function toast(message) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => el.classList.remove('show'), 2200);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[c]));
}

window.addEventListener('DOMContentLoaded', () => {
  loadProject();
  init3D();
  renderAll();
});
