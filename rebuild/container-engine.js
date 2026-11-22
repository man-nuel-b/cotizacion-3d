import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CATALOG, CATALOG_BY_CODE } from './container-catalog.js?v=4.18';
import { createObjectModel, makeFinishMaterial } from './container-object-models.js?v=4.18';
import { validateExteriorZone, sanitizeExteriorZones } from './exterior-finish-zones.js?v=4.18';
import { installEditor } from './container-editor-ui.js?v=4.18';
import { installElectricalUI, defaultElectricalConfig, sanitizeElectricalConfig } from './electrical-module.js';
import { createDisposalContext, disposeHierarchy, disposeMaterial, disposeTexture } from './resource-disposal.js';
import {
  interiorClearance, validateObjectInsideContainer, validatePartitionInsideContainer,
  resolvePartitionGeometry, resolveRotatedPartition, checkObjectCollisions, checkPartitionCollisions, reinforcementCodeFor,
  withOpeningReinforcement, computeWallTakeoff, validateOpeningCornerClearance,
  validateSharedWallRegion, validateOpeningAgainstSharedWalls,
  validateInteriorDoor, validatePartitionSpecification, PARTITION_LINING_THICKNESS_M,
  classifyPartitionJunction, computePartitionJunctions, checkJunctionAgainstDoors, resolveMagneticPartitionMove, computeFreePartitionSpan,
  validateBathFloor, detectRectangularRoomAt
} from './construction-integrity.js?v=4.18';

/* ============ Tipos de contenedor ============ */
const TYPES = {
  maritimo: {
    label: 'Contenedor marítimo',
    desc: 'Acero corrugado, esquineros ISO y barras de cierre. Estándar 40 pies.',
    dims: [12.03, 2.35, 2.39], color: '#7d8388',
    P: 0.076, R: 0.036, T: 0.004, flatInner: false,
    rough: 0.62, metal: 0.4, floor: 'wood', frameColor: null,
    deco: { B: 'doors' },
  },
  reefer: {
    label: 'Contenedor reefer',
    desc: 'Refrigerado: paneles blancos aislados con juntas verticales y equipo de frío azul en la cara B.',
    dims: [12.19, 2.44, 2.5], color: '#eef0ef',
    P: 1, R: 0, T: 0.075, flatInner: true,
    rough: 0.45, metal: 0.15, floor: 'alu', frameColor: null, seam: 0.55,
    deco: { B: 'machine', D: 'doors' },
  },
  modular: {
    label: 'Contenedor modular',
    desc: 'Desmontable tipo oficina/bodega: panel sándwich con nervado fino y marco claro. Ventanas con barrotes.',
    dims: [5.95, 2.43, 2.5], color: '#c3c8cb',
    P: 0.06, R: 0.006, T: 0.044, flatInner: true,
    rough: 0.55, metal: 0.2, floor: 'vinyl', frameColor: '#f2f4f5',
    deco: {},
  },
};

const FACES = {
  A: { n: [0, 0, 1], long: true },
  B: { n: [1, 0, 0], long: false },
  C: { n: [0, 0, -1], long: true },
  D: { n: [-1, 0, 0], long: false },
};
const FLOOR = 0.14;

// Perfil activo encapsulado en un objeto de configuración
const profileCfg = { P: 0.076, R: 0.036, T: 0.004, WALL: 0.04, Q: 0.019, V: [0, 0, 0.036, 0.036], FLAT_INNER: false };

function setProfile(c) {
  profileCfg.P = c.P;
  profileCfg.R = c.R;
  profileCfg.T = c.T;
  profileCfg.WALL = c.R + c.T;
  profileCfg.Q = c.P / 4;
  profileCfg.V = [0, 0, c.R, c.R];
  profileCfg.FLAT_INNER = c.flatInner;
}

/* ============ Escena, luces, render ============ */
const view = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(Math.max(1, view.clientWidth || innerWidth), Math.max(1, view.clientHeight || innerHeight));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
view.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const BG = 0xdfe3e8;
scene.background = new THREE.Color(BG);
scene.fog = new THREE.Fog(BG, 45, 130);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8f96, 0.55));
const sun = new THREE.DirectionalLight(0xfff1dd, 2.4);
sun.position.set(9, 15, 11);
sun.castShadow = true;
sun.shadow.mapSize.set(navigator.webdriver ? 512 : 2048, navigator.webdriver ? 512 : 2048);
sun.shadow.bias = -0.0005;
sun.shadow.normalBias = 0.07;
sun.shadow.radius = 3;
scene.add(sun);

function fitShadow() {
  const e = Math.hypot(state.L, state.W) / 2 + 2;
  Object.assign(sun.shadow.camera, { left: -e, right: e, top: e, bottom: -e, near: 1, far: 60 });
  sun.shadow.camera.updateProjectionMatrix();
}

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(300, 300),
  new THREE.MeshStandardMaterial({ color: 0xcfd3d8, roughness: 1, metalness: 0, envMapIntensity: 0.2 }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const camera = new THREE.PerspectiveCamera(40, Math.max(1, view.clientWidth || innerWidth) / Math.max(1, view.clientHeight || innerHeight), 0.1, 400);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI / 2 - 0.02;
controls.minDistance = 2;
controls.maxDistance = 70;

let cameraMoved = true;
controls.addEventListener('change', () => {
  cameraMoved = true;
  // Coalesce opacity updates while controls are damping; no calculation on a static camera.
});

function frameCamera() {
  const d = Math.max(state.L, 6) * 1.15;
  camera.position.set(d * 0.8, d * 0.38, d * 0.95);
  controls.target.set(0, (state.H + FLOOR) / 2, 0);
  controls.update();
  cameraMoved = true;
}

function resizeSceneToViewport() {
  const width = Math.max(1, view.clientWidth || innerWidth);
  const height = Math.max(1, view.clientHeight || innerHeight);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}
addEventListener('resize', resizeSceneToViewport);
// Cambiar del modo libre a inspector acoplado modifica el viewport sin cambiar
// el tamaño de la ventana. ResizeObserver mantiene cámara y canvas sincronizados.
if (typeof ResizeObserver !== 'undefined') new ResizeObserver(resizeSceneToViewport).observe(view);

/* ============ Texturas procedurales ============ */
function canvasTex(size, draw, srgb = true) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const paintTex = canvasTex(512, (g, s) => {
  g.fillStyle = '#ececec'; g.fillRect(0, 0, s, s);
  const img = g.getImageData(0, 0, s, s);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 22;
    img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
  for (let i = 0; i < 60; i++) {
    const x = Math.random() * s, w = 1 + Math.random() * 3, h = 40 + Math.random() * 300;
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, 'rgba(110,80,55,0.16)'); grd.addColorStop(1, 'rgba(110,80,55,0)');
    g.fillStyle = grd; g.fillRect(x, Math.random() * s, w, h);
  }
});

const woodTex = canvasTex(512, (g, s) => {
  const planks = 6, ph = s / planks;
  for (let i = 0; i < planks; i++) {
    g.fillStyle = `hsl(28,${38 + Math.random() * 10}%,${38 + Math.random() * 8}%)`;
    g.fillRect(0, i * ph, s, ph);
    for (let k = 0; k < 40; k++) {
      g.strokeStyle = `rgba(60,35,15,${Math.random() * 0.25})`;
      g.beginPath();
      const y = i * ph + Math.random() * ph;
      g.moveTo(0, y); g.lineTo(s, y + (Math.random() - 0.5) * 3); g.stroke();
    }
    g.fillStyle = 'rgba(30,18,8,.65)'; g.fillRect(0, i * ph, s, 2);
  }
});

const hazardTex = canvasTex(128, (g, s) => {
  g.fillStyle = '#f2c500'; g.fillRect(0, 0, s, s);
  g.fillStyle = '#18191b';
  for (let i = -s; i < s * 2; i += 32) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 16, 0); g.lineTo(i + 16 + s, s); g.lineTo(i + s, s); g.closePath(); g.fill();
  }
});

/* ============ Chapa (corrugada o lisa) ============ */
function dAt(x) {
  const { Q, V } = profileCfg;
  const k = Math.floor(x / Q + 1e-12);
  const t = (x - k * Q) / Q;
  const a = V[((k % 4) + 4) % 4], b = V[(((k + 1) % 4) + 4) % 4];
  return a + (b - a) * t;
}

function profile(x0, x1) {
  const pts = [[x0, dAt(x0)]];
  const { R, Q, V } = profileCfg;
  if (R === 0) return [[x0, 0], [x1, 0]];
  for (let k = Math.floor(x0 / Q) + 1; k * Q < x1 - 1e-9; k++) {
    const x = k * Q;
    if (x > x0 + 1e-9) pts.push([x, V[((k % 4) + 4) % 4]]);
  }
  pts.push([x1, dAt(x1)]);
  return pts;
}

function panel(xa, xb, ya, yb, lw, mat) {
  const { T, WALL, FLAT_INNER } = profileCfg;
  const pts = profile(xa, xb);
  const s = new THREE.Shape();
  s.moveTo(pts[0][0], pts[0][1] + T);
  for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1] + T);
  for (let i = pts.length - 1; i >= 0; i--) s.lineTo(pts[i][0], FLAT_INNER ? 0 : pts[i][1]);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: yb - ya, bevelEnabled: false, steps: 1 });
  g.rotateX(Math.PI / 2);
  g.translate(-lw / 2, yb, -WALL);
  const m = new THREE.Mesh(g, mat);
  m.castShadow = m.receiveShadow = true;
  m.userData.isPanel = true;
  return m;
}

function wallPanels(lw, h, cuts, mat, seam = null) {
  const group = new THREE.Group();
  const raw = [0, lw];
  cuts.forEach(c => raw.push(c.u0, c.u1));
  const xs = raw.filter(x => x >= -1e-9 && x <= lw + 1e-9).sort((a, b) => a - b);
  const ux = xs.filter((x, i) => i === 0 || x - xs[i - 1] > 1e-4);
  for (let i = 0; i < ux.length - 1; i++) {
    const xa = ux[i], xb = ux[i + 1];
    if (xb - xa < 1e-3) continue;
    const mid = (xa + xb) / 2;
    const blocked = cuts.filter(c => c.u0 <= mid && c.u1 >= mid)
      .map(c => [c.v0, c.v1]).sort((a, b) => a[0] - b[0]);
    let y = 0; const free = [];
    for (const [a, b] of blocked) {
      if (a > y + 1e-4) free.push([y, Math.min(a, h)]);
      y = Math.max(y, b);
    }
    if (y < h - 1e-4) free.push([y, h]);
    for (const [ya, yb] of free) if (yb - ya > 1e-3) group.add(panel(xa, xb, ya, yb, lw, mat));
  }
  if (seam) {
    for (let x = seam.every; x < lw - 0.2; x += seam.every) {
      if (cuts.some(c => x > c.u0 - 0.02 && x < c.u1 + 0.02)) continue;
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.007, h - 0.3, 0.006), seam.mat);
      s.position.set(x - lw / 2, h / 2, 0.0005);
      s.userData.seam = true;
      group.add(s);
    }
  }
  return group;
}

/* ============ Estado y construcción ============ */
const state = {
  type: 'maritimo',
  L: 12.03, W: 2.35, H: 2.39, color: '#7d8388',
  openings: [], partitions: [], interiorDoors: [], objects: [], services: [], sharedWalls: [],
  finishes: { floor: null, ceiling: null, skirting: null, walls: { A: null, B: null, C: null, D: null }, interiorWalls: { A: null, B: null, C: null, D: null }, exteriorZones: [] },
  bathFloor: null, floorDirection: 'length',
  electrical: defaultElectricalConfig(),
  seeInside: false, nextId: 1,
};

const root = new THREE.Group();
scene.add(root);
const objectsLayer = new THREE.Group();
root.add(objectsLayer);

let walls = [];
let owned = [];
let ownedTextures = [];
let ownedObjMaterials = [];
let objectGroups = [];
let selectedEntity = null;
let editor = null;

// Texturas compartidas con toda la escena: nunca deben liberarse al
// reconstruir un único grupo de mallas.
const persistentTextures = [paintTex, woodTex, hazardTex, scene.environment];
function mat(opts) { const m = new THREE.MeshStandardMaterial(opts); owned.push(m); return m; }
function clearRoot() {
  const ctx = createDisposalContext(persistentTextures);
  for (const child of [...root.children]) {
    if (child === objectsLayer) continue;
    root.remove(child);
    disposeHierarchy(child, ctx);
  }
  owned.forEach(m => disposeMaterial(m, ctx));
  ownedTextures.forEach(t => disposeTexture(t, ctx));
  owned = []; ownedTextures = []; walls = [];
}
function clearObjectsLayer() {
  const ctx = createDisposalContext(persistentTextures);
  for (const child of [...objectsLayer.children]) {
    objectsLayer.remove(child);
    disposeHierarchy(child, ctx);
  }
  ownedObjMaterials.forEach(m => disposeMaterial(m, ctx));
  ownedObjMaterials = []; objectGroups = [];
}

function box(w, h, d, material, x, y, z, parent, rounded = false) {
  const g = rounded ? new RoundedBoxGeometry(w, h, d, 2, 0.012) : new THREE.BoxGeometry(w, h, d);
  const m = new THREE.Mesh(g, material);
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  parent.add(m);
  return m;
}

function validateOpening(o, excludeId = null, ref = state) {
  const f = FACES[o.face];
  if (!f) return 'Cara inválida';
  if (o.reinforcementCode !== reinforcementCodeFor(o.type)) {
    return 'Falta refuerzo P90/P91 o el código no corresponde al tipo de vano';
  }
  if (![o.w, o.h, o.u, o.v].every(Number.isFinite) || !(o.w > 0 && o.h > 0)) return 'Dimensiones inválidas';
  const lw = f.long ? ref.L : ref.W;
  if (o.u < -1e-9 || o.u + o.w > lw + 1e-9 || o.v < -1e-9 || o.v + o.h > ref.H + 1e-9) {
    return 'Abertura fuera del contenedor';
  }
  if (o.catalogCode) {
    const item = CATALOG_BY_CODE[o.catalogCode];
    if (item?.mode !== 'opening') return 'Partida de vano no válida';
    const isDoorCatalog = ['cut-door', 'door-wood', 'door-mdf', 'door-steel'].includes(item.visual);
    if ((o.type === 'door') !== isDoorCatalog) return 'La partida no corresponde al tipo de abertura';
  }
  const cornerError = validateOpeningCornerClearance(o, lw);
  if (cornerError) return cornerError;
  const sharedError = validateOpeningAgainstSharedWalls(o, ref.sharedWalls || []);
  if (sharedError) return sharedError;
  for (const p of ref.openings || []) {
    if (p.id === excludeId || p.face !== o.face) continue;
    const sep = o.u + o.w <= p.u || p.u + p.w <= o.u || o.v + o.h <= p.v || p.v + p.h <= o.v;
    if (!sep) return 'Se superpone con otra abertura';
  }
  return null;
}

/* ============ Puertas y ventanas ============ */
function buildOpening(o, lw, m, parent) {
  const { WALL } = profileCfg;
  const g = new THREE.Group();
  const w = o.w, h = o.h, fb = 0.05, fd = Math.max(0.09, WALL + 0.03);
  const frameMat = selectedEntity?.kind === 'opening' && selectedEntity.id === o.id ? m.yellow : o.type === 'window' ? m.alu : m.frame;
  g.position.set(o.u + w / 2 - lw / 2, FLOOR + o.v + h / 2, -WALL / 2 + (fd - WALL) / 2);

  box(w + 2 * fb, fb, fd, frameMat, 0, h / 2 + fb / 2, 0, g);
  if (o.v > 0.01) box(w + 2 * fb, fb, fd, frameMat, 0, -h / 2 - fb / 2, 0, g);
  box(fb, h, fd, frameMat, -(w / 2 + fb / 2), 0, 0, g);
  box(fb, h, fd, frameMat, (w / 2 + fb / 2), 0, 0, g);

  const zFront = fd / 2;
  if (o.type === 'door') {
    const leaf = o.catalogCode === 'P80' ? m.wood : o.catalogCode === 'P81' ? m.light : m.door;
    box(w - 0.02, h - 0.02, 0.035, leaf, 0, 0, -0.012, g);
    box(w - 0.72, h - 0.8, 0.012, m.doorInset, 0, 0, 0.012, g);
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.14, 12), m.chrome);
    handle.rotation.z = Math.PI / 2;
    handle.position.set(w / 2 - 0.1, 0, 0.032);
    handle.castShadow = true;
    g.add(handle);
    for (const fy of [-0.35, 0.35]) box(0.04, 0.1, 0.02, m.chrome, -w / 2 + 0.02, fy * h, 0.02, g);
  } else {
    const glass = new THREE.Mesh(new THREE.BoxGeometry(w - 0.02, h - 0.02, 0.01), m.glass);
    glass.position.z = -0.01;
    g.add(glass);
    if (w > 1) box(0.035, h, 0.05, m.alu, 0, 0, 0, g);
    box(w + 0.1, 0.03, 0.14, m.alu, 0, -h / 2 - fb - 0.015, 0.03, g);
    if (o.bars) {
      const n = Math.max(2, Math.round(w / 0.12));
      for (let i = 1; i < n; i++) box(0.016, h, 0.016, m.bars, -w / 2 + (w * i) / n, 0, zFront + 0.012, g);
      box(w, 0.016, 0.016, m.bars, 0, -h * 0.25, zFront + 0.012, g);
      box(w, 0.016, 0.016, m.bars, 0, h * 0.25, zFront + 0.012, g);
    }
  }
  g.userData.openingId = o.id;
  g.traverse(child => { if (child.isMesh) child.userData.openingId = o.id; });
  parent.add(g);
}

function buildDoorsEnd(lw, totalH, m, parent, rods) {
  const half = lw / 2;
  const rodH = totalH - 0.32;
  for (const x of rods) {
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.0165, 0.0165, rodH, 14), m.chrome);
    rod.position.set(x, totalH / 2, 0.034);
    rod.castShadow = true;
    parent.add(rod);
    for (const f of [0.1, 0.36, 0.64, 0.9]) box(0.07, 0.05, 0.05, m.frame, x, totalH * f, 0.02, parent);
    box(0.14, 0.035, 0.035, m.chrome, x + (x < 0 ? 0.08 : -0.08), 1.05, 0.062, parent);
  }
  box(0.014, rodH, 0.012, m.dark, 0, totalH / 2, 0.006, parent);
  box(0.18, 0.14, 0.004, m.yellow, -half + 0.3, totalH - 0.5, 0.004, parent);
  box(0.05, rodH, 0.03, m.frame, -half + 0.06, totalH / 2, 0.012, parent);
  box(0.05, rodH, 0.03, m.frame, half - 0.06, totalH / 2, 0.012, parent);
}

function buildMachine(lw, totalH, m, parent) {
  const mw = lw - 0.36, mh = 1.25, fb = 0.07;
  const g = new THREE.Group();
  g.position.set(0, FLOOR + 0.08 + mh / 2, 0);
  parent.add(g);
  box(mw, mh, 0.06, m.dark, 0, 0, 0.03, g);
  box(mw, fb, 0.2, m.blue, 0, mh / 2 - fb / 2, 0.1, g);
  box(mw, fb, 0.2, m.blue, 0, -mh / 2 + fb / 2, 0.1, g);
  box(fb, mh, 0.2, m.blue, -mw / 2 + fb / 2, 0, 0.1, g);
  box(fb, mh, 0.2, m.blue, mw / 2 - fb / 2, 0, 0.1, g);
  const fx = -mw / 2 + 0.62, fy = 0.1;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.035, 12, 40), m.blue);
  ring.position.set(fx, fy, 0.1); ring.castShadow = true; g.add(ring);
  const disk = new THREE.Mesh(new THREE.CircleGeometry(0.34, 32), m.fanDark);
  disk.position.set(fx, fy, 0.065); g.add(disk);
  for (let i = 0; i < 7; i++) {
    const piv = new THREE.Group();
    piv.position.set(fx, fy, 0.09);
    piv.rotation.z = (i * Math.PI * 2) / 7;
    const bl = box(0.3, 0.09, 0.012, m.fanBlade, 0.19, 0, 0, piv);
    bl.rotation.x = 0.5;
    g.add(piv);
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.05, 20), m.chrome);
  hub.rotation.x = Math.PI / 2; hub.position.set(fx, fy, 0.1); g.add(hub);
  const grille = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.008, 8, 40), m.chrome);
  grille.position.set(fx, fy, 0.17); g.add(grille);
  box(0.7, 0.012, 0.012, m.chrome, fx, fy, 0.17, g);
  box(0.012, 0.7, 0.012, m.chrome, fx, fy, 0.17, g);
  const cx = mw / 2 - 0.36;
  box(0.42, 0.9, 0.05, m.light, cx, 0.05, 0.1, g);
  box(0.3, 0.2, 0.012, m.dark, cx, 0.3, 0.13, g);
  box(0.05, 0.03, 0.01, m.ledGreen, cx - 0.1, 0.1, 0.13, g);
  box(0.05, 0.03, 0.01, m.yellow, cx, 0.1, 0.13, g);
  box(0.05, 0.03, 0.01, m.ledGreen, cx + 0.1, 0.1, 0.13, g);
  box(0.3, 0.05, 0.012, m.dark, cx, -0.15, 0.13, g);

  const vent = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.03, 28), m.light);
  vent.rotation.x = Math.PI / 2; vent.position.set(-0.6, totalH - 0.4, 0.015); vent.castShadow = true; parent.add(vent);
  const vent2 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.035, 24), m.dark);
  vent2.rotation.x = Math.PI / 2; vent2.position.set(-0.6, totalH - 0.4, 0.02); parent.add(vent2);
  box(0.22, 0.22, 0.025, m.light, 0.45, totalH - 0.4, 0.012, parent, true);
  box(0.2, 0.2, 0.025, m.light, 0.8, totalH - 0.4, 0.012, parent, true);
  box(0.12, 0.12, 0.004, m.yellow, 0.95, totalH - 0.85, 0.004, parent);
  for (const s of [-1, 1]) box(0.3, 0.06, 0.01, m.hazard, s * (lw / 2 - 0.3), totalH - 0.08, 0.005, parent);
}

/* ============ Reconstrucción parcial de objetos 3D ============ */
function rebuildObjects() {
  clearObjectsLayer();
  for (const obj of state.objects) {
    const item = CATALOG_BY_CODE[obj.code];
    if (!item?.size) continue;
    const group = createObjectModel(THREE, item, m => ownedObjMaterials.push(m));
    group.userData.objectId = obj.id;
    group.position.set(obj.x, FLOOR + obj.y, obj.z);
    group.rotation.y = obj.rot * Math.PI / 180;
    group.scale.set(obj.w / item.size[0], obj.h / item.size[1], obj.d / item.size[2]);
    group.traverse(c => { if (c.isMesh) c.userData.objectId = obj.id; });
    objectsLayer.add(group);
    objectGroups.push(group);
    if (selectedEntity?.kind === 'object' && selectedEntity.id === obj.id) {
      objectsLayer.updateMatrixWorld(true);
      const helper = new THREE.BoxHelper(group, 0xe9a329);
      helper.userData.selectionHelper = true;
      objectsLayer.add(helper);
    }
  }
  editor?.refresh();
}

/* ============ Orientación de texturas de piso ============ */
function orientFloorMaterial(material, direction) {
  if (!material?.map) return;
  // El techo, los muros y los objetos nunca comparten estas instancias de mapa.
  // En la cara superior de BoxGeometry, U corresponde al largo (X) y V al ancho (Z).
  material.map.center.set(0.5, 0.5);
  material.map.rotation = direction === 'width' ? Math.PI / 2 : 0;
  material.map.needsUpdate = true;
}

/* ============ Construcción completa del contenedor ============ */
function build() {
  clearRoot();
  const cfg = TYPES[state.type];
  setProfile(cfg);
  const { WALL } = profileCfg;
  fitShadow();
  const { L, W, H } = state;
  const totalH = H + FLOOR;

  const paint = mat({ color: state.color, map: paintTex, roughness: cfg.rough, metalness: cfg.metal, envMapIntensity: 0.75 });
  const frame = cfg.frameColor
    ? mat({ color: cfg.frameColor, roughness: 0.5, metalness: 0.15, envMapIntensity: 0.7 })
    : mat({ color: new THREE.Color(state.color).multiplyScalar(0.72), map: paintTex, roughness: cfg.rough, metalness: cfg.metal + 0.05, envMapIntensity: 0.75 });

  const m = {
    frame,
    dark: mat({ color: 0x25282c, roughness: 0.7, metalness: 0.3 }),
    stud: mat({ color: 0x9aa3ad, roughness: 0.55, metalness: 0.7 }),
    insulation: mat({ color: 0xd9c69a, transparent: true, opacity: 0.65, roughness: 0.94, depthWrite: false }),
    chrome: mat({ color: 0xd9dde1, roughness: 0.25, metalness: 1, envMapIntensity: 1 }),
    yellow: mat({ color: 0xe8c11a, roughness: 0.5, metalness: 0 }),
    door: mat({ color: cfg.frameColor ? 0xdfe3e5 : 0x59636b, roughness: 0.55, metalness: 0.4, envMapIntensity: 0.7 }),
    doorInset: mat({ color: cfg.frameColor ? 0xcfd4d7 : 0x4c555c, roughness: 0.6, metalness: 0.4 }),
    alu: mat({ color: 0xe6e9ec, roughness: 0.35, metalness: 0.8 }),
    bars: mat({ color: cfg.frameColor ? 0x4b5258 : 0xdfe3e6, roughness: 0.4, metalness: 0.7 }),
    glass: mat({ color: 0xbfd8e6, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.28, envMapIntensity: 1.4 }),
    wood: mat({ color: 0xffffff, map: woodTex.clone(), roughness: 0.8, metalness: 0 }),
    floorAlu: mat({ color: 0xaab0b5, roughness: 0.4, metalness: 0.8 }),
    floorVinyl: mat({ color: 0xb9b5ab, roughness: 0.9, metalness: 0 }),
    part: mat({ color: 0xe9e4da, roughness: 0.9, metalness: 0 }),
    blue: mat({ color: 0x1f4fa8, roughness: 0.45, metalness: 0.3 }),
    light: mat({ color: 0xe3e6e8, roughness: 0.5, metalness: 0.1 }),
    fanDark: mat({ color: 0x0e1014, roughness: 0.8, metalness: 0.2 }),
    fanBlade: mat({ color: 0x1b2f63, roughness: 0.5, metalness: 0.3 }),
    ledGreen: mat({ color: 0x35c05a, roughness: 0.4, metalness: 0, emissive: 0x0f4d20 }),
    hazard: mat({ color: 0xffffff, map: hazardTex, roughness: 0.6, metalness: 0 }),
    seam: mat({ color: 0x8e9396, roughness: 0.6, metalness: 0.2 }),
  };
  m.glass.depthWrite = false;
  m.wood.map.needsUpdate = true; m.wood.map.repeat.set(L / 2, 1);
  ownedTextures.push(m.wood.map);

  let floorMat;
  if (state.finishes.floor) {
    floorMat = makeFinishMaterial(THREE, state.finishes.floor,
      matObj => owned.push(matObj), t => ownedTextures.push(t), Math.max(1, L / 2), Math.max(1, W));
  } else if (cfg.floor === 'wood') {
    // Copia independiente: la textura original también se usa en puertas/otros objetos.
    floorMat = m.wood.clone();
    owned.push(floorMat);
    floorMat.map = m.wood.map.clone();
    ownedTextures.push(floorMat.map);
  } else {
    floorMat = cfg.floor === 'alu' ? m.floorAlu : m.floorVinyl;
  }
  orientFloorMaterial(floorMat, state.floorDirection);
  const floorMesh = box(L - 2 * WALL - 0.02, 0.05, W - 2 * WALL - 0.02,
    floorMat, 0, FLOOR - 0.025, 0, root);
  floorMesh.userData.isGeneralFloor = true;

  // V4.8: draw the selected bathroom finish at its ACTUAL saved plan location.
  // A legacy bathFloor without cx/cz is an area-only reservation and remains
  // invisible until the user selects a room or places the rectangle on the floor.
  const bath = state.bathFloor;
  if (bath && Number.isFinite(bath.cx) && Number.isFinite(bath.cz)) {
    const bathMaterial = makeFinishMaterial(THREE, bath.code,
      material => owned.push(material), texture => ownedTextures.push(texture),
      Math.max(1, bath.length / 0.6), Math.max(1, bath.width / 0.6));
    orientFloorMaterial(bathMaterial, state.floorDirection);
    const finish = box(bath.length, 0.006, bath.width, bathMaterial,
      bath.cx, FLOOR + 0.004, bath.cz, root);
    finish.castShadow = false;
    finish.receiveShadow = true;
    finish.userData.isBathFloor = true;
    finish.userData.bathFloorCode = bath.code;
  }

  if (state.finishes.skirting) {
    const sk = mat({ color: 0xe4e8e8, roughness: .76, metalness: 0 });
    for (const side of [-1, 1]) {
      box(L - .17, .07, .013, sk, 0, FLOOR + .035, side * (W / 2 - WALL - .025), root);
      box(.013, .07, W - .15, sk, side * (L / 2 - WALL - .02), FLOOR + .035, 0, root);
    }
  }

  const e = 0.003;
  for (let x = -L / 2 + 0.35; x < L / 2 - 0.2; x += 0.6) box(0.1, 0.1, W - 0.2, m.dark, x, 0.05, 0, root);
  const castingMat = cfg.frameColor ? m.frame : m.dark;

  for (const s of [-1, 1]) {
    box(L, 0.14, 0.1, m.frame, 0, 0.07, s * (W / 2 - 0.05 + e), root);
    box(L, 0.09, 0.08, m.frame, 0, totalH - 0.045, s * (W / 2 - 0.04 + e), root);
    box(0.1, 0.14, W - 0.3, m.frame, s * (L / 2 - 0.05 + e), 0.07, 0, root);
    box(0.1, 0.1, W - 0.3, m.frame, s * (L / 2 - 0.05 + e), totalH - 0.05, 0, root);
    for (const t of [-1, 1]) {
      box(0.12, totalH, 0.12, m.frame, s * (L / 2 - 0.06 + e), totalH / 2, t * (W / 2 - 0.06 + e), root, true);
      for (const y of [0.065, totalH - 0.065]) {
        box(0.178, 0.13, 0.178, castingMat, s * (L / 2 - 0.089 + 0.006), y, t * (W / 2 - 0.089 + 0.006), root, true);
      }
    }
  }

  if (state.type !== 'modular') {
    for (const s of [-1, 1]) for (const x of [-1.9, 1.9]) box(0.36, 0.09, 0.11, m.dark, x, 0.07, s * (W / 2 - 0.05 + 0.006), root);
  }

  const seam = cfg.seam ? { every: cfg.seam, mat: m.seam } : null;
  for (const key of Object.keys(FACES)) {
    const f = FACES[key];
    const lw = f.long ? L : W;
    const half = f.long ? W / 2 : L / 2;
    const ops = state.openings.filter(o => o.face === key);
    const cuts = ops.map(o => ({ u0: o.u, u1: o.u + o.w, v0: FLOOR + o.v, v1: FLOOR + o.v + o.h }));
    const finishCode = state.finishes.walls[key];
    const wmat = finishCode ?
      makeFinishMaterial(THREE, finishCode, matObj => owned.push(matObj), t => ownedTextures.push(t), Math.max(1, lw / 1.2), Math.max(1, totalH / 1.2)) :
      paint.clone();
    if (!finishCode) owned.push(wmat);
    wmat.side = THREE.DoubleSide;
    const group = wallPanels(lw, totalH, cuts, wmat, seam);
    group.traverse(node => { if (node.isMesh && node.userData.isPanel) node.userData.wallFace = key; });
    // Paños exteriores parciales: la geometría visible coincide con ancho × alto.
    for (const zone of state.finishes.exteriorZones || []) {
      if (zone.face !== key) continue;
      const zoneMat = makeFinishMaterial(THREE, zone.code,
        material => owned.push(material), texture => ownedTextures.push(texture),
        Math.max(.2, zone.width / 1.2), Math.max(.2, zone.height / 1.2));
      if (zone.orientation === 'vertical' && zoneMat.map) {
        zoneMat.map.center.set(.5, .5);
        zoneMat.map.rotation = Math.PI / 2;
        zoneMat.map.needsUpdate = true;
      }
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(zone.width, zone.height), zoneMat);
      mesh.position.set(zone.u + zone.width / 2 - lw / 2,
        FLOOR + zone.v + zone.height / 2, Math.max(.02, profileCfg.R + .012));
      mesh.userData.exteriorZoneId = zone.id;
      mesh.userData.exteriorOrientation = zone.orientation;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    // Acabado interior independiente; conserva los mismos vanos y sigue al muro en raycast/corte.
    const interiorCode = state.finishes.interiorWalls?.[key];
    if (interiorCode) {
      const insideMat = makeFinishMaterial(THREE, interiorCode,
        material => owned.push(material), texture => ownedTextures.push(texture),
        Math.max(1, lw / 1.2), Math.max(1, totalH / 1.2));
      insideMat.side = THREE.DoubleSide;
      const innerPanels = wallPanels(lw, totalH, cuts, insideMat);
      innerPanels.position.z = -Math.max(0.016, profileCfg.WALL + 0.012);
      innerPanels.traverse(node => {
        if (node.isMesh) {
          node.userData.isPanel = false; // no interceptar selección de la cara externa
          node.userData.isInteriorFinish = true;
          node.castShadow = false;
        }
      });
      group.add(innerPanels);
    }
    group.rotation.y = Math.atan2(f.n[0], f.n[2]);
    group.position.set(f.n[0] * half, 0, f.n[2] * half);
    root.add(group);
    ops.forEach(o => buildOpening(o, lw, m, group));
    if (ops.length === 0) {
      const deco = cfg.deco[key];
      if (deco === 'doors') buildDoorsEnd(lw, totalH, m, group, state.type === 'reefer' ? [-0.95, -0.5, 0.5, 0.95] : [-0.9, -0.2, 0.2, 0.9]);
      if (deco === 'machine') buildMachine(lw, totalH, m, group);
    }
    walls.push({ group, mat: wmat, n: new THREE.Vector3(...f.n), half, hidden: false, roof: false, face: key });
  }

  const rmat = state.finishes.ceiling ?
    makeFinishMaterial(THREE, state.finishes.ceiling, matObj => owned.push(matObj), t => ownedTextures.push(t), Math.max(1, L / 1.2), Math.max(1, W / 1.2)) :
    paint.clone();
  if (!state.finishes.ceiling) owned.push(rmat);
  const rl = L - 0.2, rw = W - 0.2;
  const roof = wallPanels(rl, rw, [], rmat);
  roof.traverse(node => { if (node.isMesh && node.userData.isPanel) node.userData.isRoof = true; });
  roof.rotation.x = Math.PI / 2;
  // wallPanels ocupa Y local [0, rw]. Tras rotar 90° esa Y pasa al eje Z global.
  // Desplazar -rw/2 centra la cubierta dentro del ancho del contenedor.
  roof.position.set(0, totalH - WALL + 0.0005, -rw / 2);
  root.add(roof);
  walls.push({ group: roof, mat: rmat, n: new THREE.Vector3(0, 1, 0), half: 0, hidden: false, roof: true });

  // Tabiques reales: montantes, rieles, aislación opcional y placas independientes.
  // Los vanos se abren en las capas físicas, no solo en la fórmula de m².
  state.partitions.forEach(p => {
    const doors = state.interiorDoors.filter(d => d.partitionId === p.id).sort((a, b) => a.u - b.u);
    const pGroup = new THREE.Group();
    pGroup.position.set(p.cx, FLOOR, p.cz);
    pGroup.userData.partitionGroupId = p.id; // Permite previsualizar arrastre sin reconstruir WebGL.
    if (p.axis === 'z') pGroup.rotation.y = Math.PI / 2;
    root.add(pGroup);

    const segments = [];
    const gaps = [];
    let cursor = 0;
    for (const d of doors) {
      if (d.u > cursor + 1e-6) segments.push({ u0: cursor, u1: d.u, y0: 0, y1: p.height });
      if (p.height > d.h + 1e-6) segments.push({ u0: d.u, u1: d.u + d.w, y0: d.h, y1: p.height });
      gaps.push({ u0: d.u, u1: d.u + d.w, y1: d.h });
      cursor = d.u + d.w;
    }
    if (p.length > cursor + 1e-6) segments.push({ u0: cursor, u1: p.length, y0: 0, y1: p.height });
    const materialFor = code => code ? makeFinishMaterial(
      THREE, code, material => owned.push(material), texture => ownedTextures.push(texture),
      Math.max(1, p.length / 1.2), Math.max(1, p.height / 1.2)) : null;
    const matA = materialFor(p.faceALining);
    const matB = materialFor(p.faceBLining);
    const tA = PARTITION_LINING_THICKNESS_M[p.faceALining] || 0;
    const tB = PARTITION_LINING_THICKNESS_M[p.faceBLining] || 0;
    const coreWidth = p.thickness - tA - tB;
    const coreCenter = (tB - tA) / 2;
    for (const seg of segments) {
      const width = seg.u1 - seg.u0;
      const height = seg.y1 - seg.y0;
      if (width <= 1e-5 || height <= 1e-5) continue;
      const x = (seg.u0 + seg.u1) / 2 - p.length / 2;
      const y = (seg.y0 + seg.y1) / 2;
      if (p.hasInsulation) {
        const core = box(width, height, Math.min(0.05, coreWidth - 0.006), m.insulation, x, y, coreCenter, pGroup);
        core.userData.partitionId = p.id;
      }
      if (matA) {
        const plate = box(width, height, tA, matA, x, y, p.thickness / 2 - tA / 2, pGroup);
        plate.userData.partitionId = p.id;
      }
      if (matB) {
        const plate = box(width, height, tB, matB, x, y, -p.thickness / 2 + tB / 2, pGroup);
        plate.userData.partitionId = p.id;
      }
    }
    // Perfilería aparente si no hay revestimiento. No se cubre el espacio de la puerta.
    const railWidth = Math.min(0.04, coreWidth / 2);
    const top = box(p.length, railWidth, coreWidth, m.stud, 0, p.height - railWidth / 2, coreCenter, pGroup);
    top.userData.partitionId = p.id;
    cursor = 0;
    for (const d of doors) {
      if (d.u - cursor > 1e-6) {
        const rail = box(d.u - cursor, railWidth, coreWidth, m.stud,
          (cursor + d.u) / 2 - p.length / 2, railWidth / 2, coreCenter, pGroup);
        rail.userData.partitionId = p.id;
      }
      // Dintel y jambas de refuerzo: estimación visual, no cálculo estructural.
      const lintel = box(d.w + 0.05, railWidth, coreWidth, m.stud,
        d.u + d.w / 2 - p.length / 2, d.h + railWidth / 2, coreCenter, pGroup);
      lintel.userData.partitionId = p.id;
      for (const edge of [d.u, d.u + d.w]) {
        const jamb = box(railWidth, p.height, coreWidth, m.stud,
          edge - p.length / 2, p.height / 2, coreCenter, pGroup);
        jamb.userData.partitionId = p.id;
      }
      cursor = d.u + d.w;
    }
    if (p.length - cursor > 1e-6) {
      const rail = box(p.length - cursor, railWidth, coreWidth, m.stud,
        (cursor + p.length) / 2 - p.length / 2, railWidth / 2, coreCenter, pGroup);
      rail.userData.partitionId = p.id;
    }
    const studs = Math.max(1, Math.ceil(p.length / 0.4));
    for (let i = 0; i <= studs; i++) {
      const u = Math.min(p.length, i * p.length / studs);
      if (gaps.some(g => u > g.u0 + 1e-5 && u < g.u1 - 1e-5)) continue;
      const stud = box(railWidth, p.height, Math.min(coreWidth, 0.055), m.stud,
        u - p.length / 2, p.height / 2, coreCenter, pGroup);
      stud.userData.partitionId = p.id;
    }
    for (const d of doors) {
      const selected = selectedEntity?.kind === 'interiorDoor' && selectedEntity.id === d.id;
      const doorMaterial = selected ? m.yellow : d.catalogCode === 'P80' ? m.wood : m.door;
      const leaf = box(d.w - 0.04, d.h - 0.045, Math.min(0.035, coreWidth), doorMaterial,
        d.u + d.w / 2 - p.length / 2, d.h / 2, coreCenter, pGroup);
      leaf.userData.interiorDoorId = d.id;
      leaf.userData.partitionId = p.id;
    }
    if (selectedEntity?.kind === 'partition' && selectedEntity.id === p.id) {
      const helper = new THREE.BoxHelper(pGroup, 0xe9a329);
      helper.userData.selectionHelper = true;
      root.add(helper);
    }
  });

  rebuildObjects();
  applyXray(true);
}

/* ============ Modo "ver interior" ============ */
function setWallHidden(w, hide) {
  if (w.hidden === hide) return;
  w.hidden = hide;
  // CORTE REAL: una pared retirada debe ocultar su geometría COMPLETA,
  // incluidos los marcos, las ventanas, las puertas y las molduras que son
  // hijos del grupo. Antes solo se cambiaba la opacidad del revestimiento:
  // las aberturas seguían opacas y parecían tabiques superpuestos.
  // Este cambio no altera posiciones, colisiones ni vanos en el estado JSON.
  w.group.visible = !hide;
}

/** Diagnóstico para pruebas visuales y control del modo de corte. */
function getCutawayWallState() {
  return walls.filter(w => !w.roof).map(w => {
    let openings = 0, visibleOpenings = 0;
    w.group.traverse(node => {
      if (!node.isMesh || !node.userData.openingId) return;
      openings++;
      if (w.group.visible && node.visible) visibleOpenings++;
    });
    return { face: w.face, hidden: w.hidden === true, visible: w.group.visible,
      openings, visibleOpenings };
  });
}

function applyXray(force = false) {
  if (force) walls.forEach(w => { w.hidden = null; });
  const cam = camera.position;
  for (const w of walls) {
    let hide = false;
    if (state.seeInside) hide = w.roof ? true : cam.dot(w.n) > w.half + 0.01;
    setWallHidden(w, hide);
  }
}

/* ============ API pública ============ */
const SAMPLES = {
  maritimo: [
    { type: 'window', face: 'A', w: 1.2, h: 0.8, u: 4, v: 0.9 },
    { type: 'door', face: 'C', w: 0.9, h: 2.0, u: 1.2, v: 0 },
  ],
  reefer: [],
  modular: [
    { type: 'door', face: 'C', w: 0.9, h: 2.05, u: 0.8, v: 0 },
    { type: 'window', face: 'A', w: 1.2, h: 1.0, u: 2.4, v: 1.0, bars: true },
  ],
};

function finitePositive(n) { return Number.isFinite(n) && n > 0; }
function validDimensions(L, W, H) {
  return [L, W, H].every(finitePositive) && L >= 2 && L <= 25 && W >= 1 && W <= 5 && H >= 1.8 && H <= 5;
}

function profileThicknessFor(ref = state) {
  const cfg = TYPES[ref.type || state.type];
  return cfg.R + cfg.T;
}

function objectError(o, ref = state) {
  const entry = CATALOG_BY_CODE[o?.code];
  if (!entry || !['object', 'wall-object'].includes(entry.mode)) return 'Partida 3D no válida';
  if (o.w > 25 || o.h > 5 || o.d > 5) return 'Dimensiones inválidas';
  return validateObjectInsideContainer(o, ref, profileThicknessFor(ref)) ||
    checkObjectCollisions(o, ref.objects || state.objects, ref.partitions || state.partitions);
}

function partitionError(p, ref = state) {
  const geometryIssue = validatePartitionInsideContainer(p, ref, profileThicknessFor(ref)) ||
    checkPartitionCollisions(p, ref.partitions || state.partitions, ref.objects || state.objects);
  if (geometryIssue) return geometryIssue;
  // Keep a placed bathroom finish from being cut through by a new/moved wall.
  if (ref.bathFloor && Number.isFinite(ref.bathFloor.cx)) {
    const partitions = (ref.partitions || state.partitions).filter(w => w.id !== p.id).concat(p);
    return validateBathFloor(ref.bathFloor, { ...ref, partitions }, profileThicknessFor(ref));
  }
  return null;
}
function exteriorZonesError(ref = state) {
  try { sanitizeExteriorZones(ref.finishes?.exteriorZones || [], ref); return null; }
  catch (error) { return String(error.message || error); }
}
function fittedPartition(p, ref = state) {
  return resolvePartitionGeometry(p, ref, profileThicknessFor(ref));
}

/**
 * Sugerencias de posición para insertar otra división transversal/longitudinal.
 * Busca el punto medio de cada tramo libre entre tabiques paralelos, empezando
 * por los recintos más amplios. No modifica geometría ni obvia colisiones.
 * Los recintos menores a ~65 cm entre divisiones no se subdividen de forma
 * automática: la persona puede editar el centro manualmente si lo requiere.
 */
function freePartitionCenters(p, ref = state) {
  const alongX = p.axis === 'z';
  const crossWidth = alongX ? ref.L : ref.W;
  const margin = interiorClearance(profileThicknessFor(ref));
  const maxCenter = crossWidth / 2 - margin - p.thickness / 2;
  if (maxCenter <= 0) return [];
  const boundaries = [-maxCenter, maxCenter];
  const peers = (ref.partitions || []).filter(other => other.axis === p.axis);
  const occupied = peers.map(other => alongX ? other.cx : other.cz)
    .filter(value => Number.isFinite(value) && Math.abs(value) < maxCenter)
    .sort((a, b) => a - b);
  const cuts = [boundaries[0], ...occupied, boundaries[1]];
  const minSpace = 0.65;
  const bays = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    const left = cuts[i], right = cuts[i + 1];
    // Reservar espacio suficiente a cada lado, evitando crear un recinto
    // automático diminuto solo porque el grosor del tabique cabe.
    if (right - left < minSpace * 2 + p.thickness) continue;
    bays.push({ center: (left + right) / 2, width: right - left, left, right });
  }
  bays.sort((a, b) => b.width - a.width || b.center - a.center);
  const samples = [];
  for (const bay of bays) {
    // Primero centro de vano; después puntos laterales cuando hay mobiliario.
    const range = bay.width / 2 - minSpace - p.thickness / 2;
    for (const amount of [0, .5, -.5]) {
      const point = bay.center + amount * range;
      if (!samples.some(x => Math.abs(x - point) < 0.01)) samples.push(point);
    }
  }
  return samples.map(center => ({
    cx: alongX ? center : p.cx,
    cz: alongX ? p.cz : center
  }));
}

/**
 * Rama ortogonal de un tabique seleccionado. El extremo queda exactamente
 * a ras de la cara anfitriona, y se detiene ante el siguiente paramento real
 * si existe; no cruza tabiques, muebles ni puertas.
 */
function junctionBranchProposal(host, type, side, endpoint = 1, ref = state) {
  if (!host || !['x', 'z'].includes(host.axis)) throw Error('Tabique anfitrión inválido');
  if (!['T', 'L'].includes(type) || ![1, -1].includes(side) || ![1, -1].includes(endpoint)) {
    throw Error('Selecciona tipo de unión y dirección válidos');
  }
  if (type === 'L' && host.autoSpan) {
    throw Error('Para formar una L, desactiva autoSpan y acorta el tabique anfitrión desde Propiedades');
  }
  const newAxis = host.axis === 'x' ? 'z' : 'x';
  const along = host.axis === 'z' ? host.cz : host.cx;
  const cross = host.axis === 'z' ? host.cx : host.cz;
  const branchThickness = host.thickness;
  const attachAlong = type === 'T' ? along :
    along + endpoint * (host.length / 2 - branchThickness / 2);
  const start = cross + side * host.thickness / 2;
  const margin = interiorClearance(profileThicknessFor(ref));
  const span = newAxis === 'x' ? ref.L : ref.W;
  let farFace = side * (span / 2 - margin);
  // El segundo extremo se une al paramento más cercano y no lo atraviesa.
  for (const other of ref.partitions || []) {
    if (other.id === host.id || other.axis !== host.axis) continue;
    const otherAlong = other.axis === 'z' ? other.cz : other.cx;
    const otherCross = other.axis === 'z' ? other.cx : other.cz;
    if (Math.abs(attachAlong - otherAlong) > (other.length + branchThickness) / 2 - 1e-8) continue;
    const contact = otherCross - side * other.thickness / 2;
    const distance = side * (contact - start);
    if (distance > 0.45 && distance < side * (farFace - start) - 1e-8) farFace = contact;
  }
  const length = side * (farFace - start);
  if (length < 0.45) throw Error('No hay recorrido libre suficiente para la rama de tabique');
  const center = (start + farFace) / 2;
  const branch = {
    axis: newAxis, length, height: host.height, thickness: branchThickness,
    cx: newAxis === 'x' ? center : attachAlong,
    cz: newAxis === 'z' ? center : attachAlong,
    autoSpan: false,
    faceALining: host.faceALining || null,
    faceBLining: host.faceBLining || null,
    hasInsulation: host.hasInsulation === true,
    insulationCode: host.hasInsulation ? (host.insulationCode || 'P20') : null
  };
  const junction = classifyPartitionJunction(host, { ...branch, id: 'candidate-branch' });
  if (!junction || junction.hostId !== host.id || junction.type !== type) {
    throw Error('No es posible resolver una unión geométrica ' + type + ' en ese tabique');
  }
  return branch;
}

function partitionSpecificationError(p) {
  return validatePartitionSpecification(p);
}
function partitionDoorError(p, doors = state.interiorDoors) {
  for (const d of doors) {
    if (d.partitionId !== p.id) continue;
    const issue = validateInteriorDoor(d, p, doors);
    if (issue) return issue;
  }
  return null;
}

function defaultElevation(item) {
  const v = item.visual;
  if (v === 'light') return Math.max(0, state.H - item.size[1] - .08);
  if (v === 'aircon' || v === 'extractor') return Math.max(0, state.H - item.size[1] - .12);
  if (['outlet', 'power', 'panel', 'grounding'].includes(v)) return 1.05;
  if (v === 'water-heater') return .8;
  if (v === 'bath-accessories') return .75;
  return 0;
}

function markChanged(partialObjectsOnly = false) {
  if (partialObjectsOnly) rebuildObjects();
  else build();
  return { ok: true };
}

const api = {
  types: Object.keys(TYPES),
  catalog: CATALOG.map(({ code, name, family, mode }) => ({ code, name, family, mode })),
  getWallThickness() { return profileCfg.WALL; },
  getInteriorClearance() { return interiorClearance(profileThicknessFor()); },

  getConstructionTakeoff() { return computeWallTakeoff(state); },
  detectBathRoomAt(x, z) {
    return detectRectangularRoomAt({x,z}, state, profileThicknessFor());
  },
  getBathFloorBounds() {
    const mesh = root.children.find(child => child.userData.isBathFloor);
    if (!mesh) return null;
    const bounds = new THREE.Box3().setFromObject(mesh);
    return { code: mesh.userData.bathFloorCode,
      minX: bounds.min.x, maxX: bounds.max.x,
      minZ: bounds.min.z, maxZ: bounds.max.z,
      minY: bounds.min.y, maxY: bounds.max.y };
  },
  // Diagnóstico geométrico: permite verificar la posición real en coordenadas globales.
  getFloorSurfaceInfo() {
    // Información de diagnóstico y pruebas WebGL; no modifica el modelo.
    const info = mesh => {
      if (!mesh) return null;
      const texture = mesh.material?.map;
      return { code: mesh.userData.bathFloorCode || state.finishes.floor || null,
        hasTexture: !!texture, rotationRadians: texture?.rotation ?? null };
    };
    return {
      direction: state.floorDirection,
      general: info(root.children.find(c => c.userData.isGeneralFloor)),
      bathroom: info(root.children.find(c => c.userData.isBathFloor))
    };
  },
  getCutawayWallState() { return getCutawayWallState(); },
  getRoofBounds() {
    const roof = walls.find(w => w.roof);
    if (!roof) return null;
    const bounds = new THREE.Box3().setFromObject(roof.group);
    return {
      visible: roof.group.visible,
      minX: bounds.min.x, maxX: bounds.max.x,
      minY: bounds.min.y, maxY: bounds.max.y,
      minZ: bounds.min.z, maxZ: bounds.max.z
    };
  },
  getRenderStats() {
    return { geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures };
  },
  // Proyección utilizada por superposiciones 2D y pruebas del arrastre real.
  getScreenPoint(x, y, z) {
    if (![x, y, z].every(Number.isFinite)) return null;
    const projected = new THREE.Vector3(x, y, z).project(camera);
    const rect = renderer.domElement.getBoundingClientRect();
    return { x: rect.left + (projected.x + 1) * rect.width / 2,
      y: rect.top + (1 - projected.y) * rect.height / 2,
      visible: projected.z >= -1 && projected.z <= 1 };
  },

  setType(key, { samples = false } = {}) {
    const c = TYPES[key]; if (!c) return { ok: false, error: 'Tipo de contenedor inválido' };
    state.type = key; [state.L, state.W, state.H] = c.dims;
    state.color = c.color; state.openings = []; state.partitions = []; state.interiorDoors = []; state.services = []; state.sharedWalls = [];
    state.objects = [];
    state.finishes = { floor: null, ceiling: null, skirting: null, walls: { A: null, B: null, C: null, D: null }, interiorWalls: { A: null, B: null, C: null, D: null }, exteriorZones: [] };
    state.bathFloor = null;
    state.floorDirection = 'length';
    state.electrical = defaultElectricalConfig();
    state.nextId = 1; selectedEntity = null;
    if (samples) for (const x of SAMPLES[key]) {
      const sample = withOpeningReinforcement({ id: state.nextId, bars: false, ...x });
      if (!validateOpening(sample)) { state.nextId++; state.openings.push(sample); }
    }
    build(); frameCamera(); return { ok: true, dims: c.dims, color: c.color };
  },

  setDimensions(L, W, H) {
    if (!validDimensions(L, W, H)) return { ok: false, error: 'Dimensiones fuera de rango permitido' };
    const next = { L, W, H };
    const nextRef = { ...state, L, W, H };
    try { sanitizeElectricalConfig(state.electrical, nextRef, state.openings); }
    catch(error) { return {ok:false,error:'Puntos eléctricos incompatibles con estas dimensiones: '+error.message}; }
    const bathError = validateBathFloor(state.bathFloor, nextRef, profileThicknessFor(nextRef));
    if (bathError) return { ok: false, error: 'Piso de baño incompatible con las nuevas dimensiones: ' + bathError };
    if (state.openings.some(o => validateOpening(o, o.id, nextRef))) {
      return { ok: false, error: 'Algunas aberturas quedarían fuera o invadirían los esquineros' };
    }
    if (state.sharedWalls.some(zone => validateSharedWallRegion(zone, nextRef, zone.id))) {
      return { ok: false, error: 'Alguna zona compartida excedería los nuevos límites' };
    }
    const exteriorIssue = exteriorZonesError(nextRef);
    if (exteriorIssue) return { ok: false, error: 'Revestimientos exteriores incompatibles con las dimensiones: ' + exteriorIssue };
    // Proyectar todos los tabiques de autoajuste antes de modificar el estado.
    // Cualquier colisión bloquea el cambio COMPLETO de dimensiones.
    let projectedPartitions;
    try {
      projectedPartitions = state.partitions.map(p => fittedPartition(p, nextRef));
    } catch (error) {
      return { ok: false, error: String(error.message || error) };
    }
    const projectedRef = { ...nextRef, objects: state.objects, partitions: projectedPartitions };
    if (state.objects.some(o => objectError(o, projectedRef))) {
      return { ok: false, error: 'Algunos objetos no caben o colisionan con tabiques ajustados' };
    }
    if (projectedPartitions.some(p => partitionError(p, projectedRef))) {
      return { ok: false, error: 'Los tabiques no caben o se superponen tras ajustar las dimensiones' };
    }
    if (projectedPartitions.some(p => partitionDoorError(p))) {
      return { ok: false, error: 'Una puerta interior no cabría después de modificar las dimensiones' };
    }
    const projectedBathError = validateBathFloor(state.bathFloor, projectedRef, profileThicknessFor(projectedRef));
    if (projectedBathError) return { ok: false, error: 'Piso de baño incompatible con los nuevos tabiques: ' + projectedBathError };
    state.partitions = projectedPartitions;
    [state.L, state.W, state.H] = [L, W, H];
    return markChanged(false);
  },

  setBathFloor({ code, length, width, cx, cz } = {}) {
    if (CATALOG_BY_CODE[code]?.mode !== 'floor') {
      return { ok: false, error: 'Selecciona una partida válida de piso para el baño' };
    }
    const candidate = { code, length: Number(length), width: Number(width) };
    // Old JSON and old API calls without coordinates remain valid but are not drawn.
    if (cx !== undefined || cz !== undefined) {
      candidate.cx = Number(cx);
      candidate.cz = Number(cz);
    }
    const issue = validateBathFloor(candidate, state, profileThicknessFor());
    if (issue) return { ok: false, error: issue };
    const hadVisual = Boolean(state.bathFloor && Number.isFinite(state.bathFloor.cx));
    state.bathFloor = candidate;
    // Rebuild only when switching between or updating positioned finishes.
    if (Number.isFinite(candidate.cx) || hadVisual) build();
    else editor?.refresh();
    const bathAreaM2 = candidate.length * candidate.width;
    const remainingAreaM2 = Math.max(0, state.L * state.W - bathAreaM2);
    return { ok: true, bathFloor: { ...candidate }, bathAreaM2, remainingAreaM2,
      alert: `Baño: ${bathAreaM2.toFixed(2)} m² (${candidate.length.toFixed(2)} × ${candidate.width.toFixed(2)} m). Quedan ${remainingAreaM2.toFixed(2)} m² disponibles. ${Number.isFinite(candidate.cx) ? 'Piso visible en el visor 3D.' : 'Reserva de área sin ubicación 3D: usa Aplicar piso al recinto.'}` };
  },

  applyBathFloorAt({ code, x, z, mode = 'room', length, width } = {}) {
    if (CATALOG_BY_CODE[code]?.mode !== 'floor') {
      return { ok: false, error: 'Selecciona una partida válida para el piso del baño' };
    }
    if (![x,z].every(Number.isFinite)) return { ok: false, error: 'Selecciona una ubicación válida' };
    let rectangle;
    if (mode === 'room') {
      const room = this.detectBathRoomAt(x, z);
      if (!room.ok) return room;
      rectangle = room;
    } else if (mode === 'manual') {
      rectangle = { length: Number(length), width: Number(width), cx: x, cz: z };
    } else return { ok: false, error: 'Modo de selección de piso inválido' };
    return this.setBathFloor({ code, length: rectangle.length, width: rectangle.width,
      cx: rectangle.cx, cz: rectangle.cz });
  },

  clearBathFloor() {
    const hadVisual = Boolean(state.bathFloor && Number.isFinite(state.bathFloor.cx));
    state.bathFloor = null;
    if (hadVisual) build();
    else editor?.refresh();
    const remainingAreaM2 = state.L * state.W;
    return { ok: true, bathAreaM2: 0, remainingAreaM2,
      alert: `Piso de baño retirado. Quedan ${remainingAreaM2.toFixed(2)} m² disponibles para el piso general.` };
  },

  addOpening({ type = 'door', face = 'A', w, h, u, v = 0, bars = false, catalogCode = null }) {
    if (!['door', 'window'].includes(type) || typeof bars !== 'boolean' || (bars && type !== 'window')) {
      return { ok: false, error: 'Tipo o barrotes inválidos' };
    }
    if (catalogCode && CATALOG_BY_CODE[catalogCode]?.mode !== 'opening') {
      return { ok: false, error: 'Código de abertura inválido' };
    }
    const o = withOpeningReinforcement({ id: state.nextId, type, face, w, h, u, v, bars, catalogCode });
    const err = validateOpening(o); if (err) return { ok: false, error: err };
    const zoneIssue = exteriorZonesError({ ...state, openings: [...state.openings, o] });
    if (zoneIssue) return { ok: false, error: 'El vano invade un revestimiento exterior: ' + zoneIssue };
    state.nextId++; state.openings.push(o); selectedEntity = { kind: 'opening', id: o.id };
    build(); return { ok: true, id: o.id };
  },

  updateOpening(id, delta = {}) {
    const old = state.openings.find(o => o.id === id); if (!old) return { ok: false, error: 'Abertura no encontrada' };
    const kind = delta.type ?? old.type;
    if (delta.reinforcementCode && delta.reinforcementCode !== reinforcementCodeFor(kind)) {
      return { ok: false, error: 'Código de refuerzo incompatible con el vano' };
    }
    if (!reinforcementCodeFor(kind)) return { ok: false, error: 'Tipo de vano inválido' };
    const o = withOpeningReinforcement({ ...old, ...delta, id: old.id });
    if (typeof o.bars !== 'boolean' || (o.type === 'door' && o.bars)) {
      return { ok: false, error: 'Tipo o barrotes inválidos' };
    }
    const err = validateOpening(o, id); if (err) return { ok: false, error: err };
    const zoneIssue = exteriorZonesError({ ...state, openings: state.openings.map(x => x.id === id ? o : x) });
    if (zoneIssue) return { ok: false, error: 'El vano invade un revestimiento exterior: ' + zoneIssue };
    Object.assign(old, o); selectedEntity = { kind: 'opening', id };
    return markChanged(false);
  },

  moveOpening(id, { face, u, v }) { return this.updateOpening(id, { face, u, v }); },

  duplicateOpening(id) {
    const old = state.openings.find(o => o.id === id); if (!old) return { ok: false, error: 'Abertura no encontrada' };
    const span = FACES[old.face].long ? state.L : state.W;
    for (const u of [old.u + old.w + .1, old.u - old.w - .1]) {
      const next = { ...old, id: state.nextId, u };
      if (u >= 0 && u + old.w <= span && !validateOpening(next) &&
          !exteriorZonesError({ ...state, openings: [...state.openings, next] })) {
        state.nextId++; state.openings.push(next); selectedEntity = { kind: 'opening', id: next.id };
        build(); return { ok: true, id: next.id };
      }
    }
    return { ok: false, error: 'No existe espacio libre para duplicar esta abertura' };
  },

  removeOpening(id) {
    state.openings = state.openings.filter(o => o.id !== id);
    if (selectedEntity?.kind === 'opening' && selectedEntity.id === id) selectedEntity = null;
    return markChanged(false);
  },

  clearOpenings() {
    state.openings = [];
    if (selectedEntity?.kind === 'opening') selectedEntity = null;
    return markChanged(false);
  },

  addObject(code, x, z, y = undefined, rot = 0) {
    const entry = CATALOG_BY_CODE[code];
    if (!entry || !['object', 'wall-object'].includes(entry.mode)) {
      return { ok: false, error: 'Esta partida requiere seleccionar una superficie, no colocar un objeto' };
    }
    const [w, h, d] = entry.size;
    const obj = { id: 'obj-' + state.nextId, code, x, y: y === undefined ? defaultElevation(entry) : y, z, w, h, d, rot };
    const err = objectError(obj); if (err) return { ok: false, error: err };
    state.nextId++; state.objects.push(obj); selectedEntity = { kind: 'object', id: obj.id };
    rebuildObjects(); return { ok: true, id: obj.id };
  },

  updateObject(id, delta = {}) {
    const current = state.objects.find(x => x.id === id); if (!current) return { ok: false, error: 'Objeto no encontrado' };
    const next = { ...current, ...delta, id: current.id, code: current.code };
    const err = objectError(next); if (err) return { ok: false, error: err };
    Object.assign(current, next); selectedEntity = { kind: 'object', id };
    return markChanged(true);
  },

  duplicateObject(id) {
    const original = state.objects.find(x => x.id === id); if (!original) return { ok: false, error: 'Objeto no encontrado' };
    const candidate = { ...original, id: 'obj-' + state.nextId };
    for (const [dx, dz] of [[original.w + .15, 0], [-original.w - .15, 0], [0, original.d + .15], [0, -original.d - .15]]) {
      candidate.x = original.x + dx; candidate.z = original.z + dz;
      if (!objectError(candidate)) {
        state.nextId++; state.objects.push({ ...candidate }); selectedEntity = { kind: 'object', id: candidate.id };
        rebuildObjects(); return { ok: true, id: candidate.id };
      }
    }
    return { ok: false, error: 'Sin espacio suficiente para duplicar el objeto' };
  },

  removeObject(id) {
    state.objects = state.objects.filter(o => o.id !== id);
    if (selectedEntity?.kind === 'object' && selectedEntity.id === id) selectedEntity = null;
    return markChanged(true);
  },

  setWallLining(face, code) {
    if (!FACES[face]) return { ok: false, error: 'Cara de muro inválida (A, B, C o D)' };
    const item = CATALOG_BY_CODE[code];
    if (!item) return { ok: false, error: 'Partida del catálogo inexistente' };
    if (item.mode === 'wall-exterior-finish') return this.setFinish(code, face);
    if (item.mode === 'wall-interior-finish') return this.setInteriorWallFinish(face, code);
    if (item.mode !== 'wall-object' || !['wall-lining', 'wet-lining'].includes(item.visual)) {
      return { ok: false, error: 'La partida seleccionada no es un revestimiento ni un trasdosado de muro' };
    }
    const [width, height, depth] = item.size;
    const span = FACES[face].long ? state.L : state.W;
    const edge = 0.055;
    if (height > state.H || width > span - 2 * edge) {
      return { ok: false, error: 'El trasdosado no cabe en la cara seleccionada' };
    }
    const inset = profileCfg.WALL + edge + depth / 2;
    const rot = { A: 180, B: -90, C: 0, D: 90 }[face];
    const maxOffset = span / 2 - width / 2 - edge;
    const offsets = [0];
    for (let i = 1; i * 0.2 <= maxOffset + 1e-7; i++) {
      offsets.push(i * 0.2, -i * 0.2);
    }
    for (const offset of offsets) {
      const x = face === 'B' ? state.L / 2 - inset : face === 'D' ? -state.L / 2 + inset : offset;
      const z = face === 'A' ? state.W / 2 - inset : face === 'C' ? -state.W / 2 + inset : offset;
      const result = this.addObject(code, x, z, 0, rot);
      if (result.ok) return { ...result, face, code };
    }
    return { ok: false, error: 'No hay espacio libre para instalar el trasdosado en esa cara' };
  },

  addSharedWall({ face, u, v = 0, w, h }) {
    const zone = { id: 'shared-' + state.nextId, face, u, v, w, h };
    const error = validateSharedWallRegion(zone, state);
    if (error) return { ok: false, error };
    const zoneIssue = exteriorZonesError({ ...state, sharedWalls: [...state.sharedWalls, zone] });
    if (zoneIssue) return { ok: false, error: 'El contacto invade un paño exterior: ' + zoneIssue };
    state.nextId++;
    state.sharedWalls.push(zone);
    editor?.refresh();
    return { ok: true, id: zone.id };
  },
  removeSharedWall(id) {
    const previous = state.sharedWalls.length;
    state.sharedWalls = state.sharedWalls.filter(x => x.id !== id);
    if (state.sharedWalls.length === previous) return { ok: false, error: 'Zona compartida inexistente' };
    editor?.refresh();
    return { ok: true };
  },
  addExteriorFinishZone({ face, code, areaM2, width, u = 0, v = 0, orientation = 'horizontal' } = {}) {
    if ((state.finishes.exteriorZones || []).length >= 100) return { ok: false, error: 'Máximo 100 paños exteriores' };
    const area = Number(areaM2), w = Number(width);
    if (!Number.isFinite(area) || !Number.isFinite(w) || area <= 0 || w <= 0) {
      return { ok: false, error: 'Indica una superficie positiva en m² y un ancho en metros' };
    }
    const candidate = { id: 'ext-' + state.nextId, face, code, u: Number(u), v: Number(v),
      width: w, height: area / w, orientation };
    const issue = validateExteriorZone(candidate, state);
    if (issue) return { ok: false, error: issue };
    state.finishes.exteriorZones.push(candidate);
    state.nextId++;
    build();
    return { ok: true, id: candidate.id, zone: { ...candidate }, areaM2: candidate.width * candidate.height };
  },

  updateExteriorFinishZone(id, delta = {}) {
    const old = state.finishes.exteriorZones.find(z => z.id === id);
    if (!old) return { ok: false, error: 'Paño exterior inexistente' };
    const candidate = { ...old, ...delta, id, u: Number(delta.u ?? old.u), v: Number(delta.v ?? old.v),
      width: Number(delta.width ?? old.width), height: Number(delta.height ?? old.height) };
    if (delta.areaM2 !== undefined) candidate.height = Number(delta.areaM2) / candidate.width;
    const issue = validateExteriorZone(candidate, state, id);
    if (issue) return { ok: false, error: issue };
    Object.assign(old, { id, face: candidate.face, code: candidate.code, u: candidate.u, v: candidate.v,
      width: candidate.width, height: candidate.height, orientation: candidate.orientation });
    build();
    return { ok: true, id, zone: { ...old }, areaM2: old.width * old.height };
  },

  removeExteriorFinishZone(id) {
    const zones = state.finishes.exteriorZones;
    if (!zones.some(z => z.id === id)) return { ok: false, error: 'Paño exterior inexistente' };
    state.finishes.exteriorZones = zones.filter(z => z.id !== id);
    build();
    return { ok: true };
  },

  setFinish(code, face = 'A') {
    const entry = CATALOG_BY_CODE[code]; if (!entry) return { ok: false, error: 'Código inexistente' };
    // Las terminaciones interiores se enrutan a la capa correcta en lugar de
    // rechazarlas cuando un control antiguo llama setFinish directamente.
    if (entry.mode === 'wall-interior-finish') return this.setInteriorWallFinish(face, code);
    if (entry.mode === 'floor') state.finishes.floor = code;
    else if (entry.mode === 'skirting') state.finishes.skirting = code;
    else if (entry.mode === 'ceiling') state.finishes.ceiling = code;
    else if (entry.mode === 'wall-exterior-finish') {
      if (!FACES[face]) return { ok: false, error: 'Selecciona una cara válida' };
      state.finishes.walls[face] = code;
    } else return { ok: false, error: 'Esta partida no corresponde a una terminación exterior del muro' };
    build(); return { ok: true, code, face };
  },

  setInteriorWallFinish(face, code) {
    if (!FACES[face]) return { ok: false, error: 'Cara interior inválida (A, B, C o D)' };
    if (code !== null && CATALOG_BY_CODE[code]?.mode !== 'wall-interior-finish') {
      return { ok: false, error: 'Selecciona un revestimiento interior válido' };
    }
    state.finishes.interiorWalls[face] = code;
    build();
    return { ok: true, face, code };
  },

  clearInteriorWallFinish(face) { return this.setInteriorWallFinish(face, null); },

  clearSurfaceFinish(kind, face = 'A') {
    if (kind === 'roof') state.finishes.ceiling = null;
    else if (kind === 'wall') {
      if (!FACES[face]) return { ok: false, error: 'Cara de muro inválida' };
      state.finishes.walls[face] = null;
    } else if (kind === 'skirting') state.finishes.skirting = null;
    else return { ok: false, error: 'Superficie inválida' };
    build();
    return { ok: true };
  },

  clearFloorFinish() {
    state.finishes.floor = null;
    build();
    return { ok: true };
  },

  addService(code) {
    const entry = CATALOG_BY_CODE[code];
    if (entry?.mode !== 'service') return { ok: false, error: 'Partida no administrativa' };
    const id = 'service-' + state.nextId++;
    state.services.push({ id, code }); editor?.refresh(); return { ok: true, id };
  },

  removeService(id) {
    state.services = state.services.filter(s => s.id !== id);
    editor?.refresh(); return { ok: true };
  },

  addPartition({ length = undefined, height, thickness = .1, axis = 'x', cx = 0, cz = 0, autoSpan = false,
    faceALining = null, faceBLining = null, hasInsulation = false, insulationCode = null,
    autoPlace = false, autoFit = undefined, fitDirection = 'both' }) {
    let candidate, span = null;
    if (autoFit !== undefined && typeof autoFit !== 'boolean') {
      return { ok: false, error: 'Modo de ajuste al crear el tabique inválido' };
    }
    if (!['both', 'positive', 'negative'].includes(fitDirection)) {
      return { ok: false, error: 'Dirección de crecimiento del tabique inválida' };
    }
    // No reinterpretar tabiques históricos ni el botón de inserción sucesiva.
    // Un largo manual explícito prevalece, excepto al solicitar autoFit:true.
    const shouldFit = autoFit === true || (autoFit !== false && length === undefined &&
      autoSpan === false && autoPlace === false);
    if (shouldFit && (autoSpan || autoPlace)) {
      return { ok: false, error: 'autoFit no se puede combinar con autoSpan ni autoPlace' };
    }
    try {
      if (shouldFit) {
        span = computeFreePartitionSpan({ axis, cx, cz, thickness }, state,
          state.partitions, state.objects, state.interiorDoors,
          profileThicknessFor(), 0.015, { direction: fitDirection });
        if (span.blockedBy || span.freeLengthM < 0.25 - 1e-8) {
          return { ok: false, error: span.blockedBy
            ? 'No se puede colocar aquí: el punto está ocupado por ' + span.blockedBy
            : 'No hay tramo libre suficiente en ese punto (mín. 0,25 m)' };
        }
        length = span.freeLengthM;
        if (axis === 'x') cx = span.recommendedCenter;
        else cz = span.recommendedCenter;
      }
      candidate = fittedPartition({ id: 'partition-' + state.nextId, length, height, thickness, axis, cx, cz, autoSpan,
        faceALining, faceBLining, hasInsulation, insulationCode: hasInsulation ? (insulationCode || 'P20') : insulationCode });
    } catch (error) { return { ok: false, error: String(error.message || error) }; }
    if (typeof autoPlace !== 'boolean') return { ok: false, error: 'Modo de colocación inválido' };
    const specificationError = partitionSpecificationError(candidate);
    if (specificationError) return { ok: false, error: specificationError };
    let error = partitionError(candidate);
    let automaticallyPositioned = false;
    if (error && autoPlace) {
      for (const pos of freePartitionCenters(candidate)) {
        const option = fittedPartition({ ...candidate, ...pos });
        if (partitionError(option)) continue;
        candidate = option;
        error = null;
        automaticallyPositioned = true;
        break;
      }
    }
    if (error) return {
      ok: false,
      error: autoPlace ?
        `No hay un espacio libre adecuado para otro tabique completo (${error}). ` +
        'Mueve un tabique existente o desactiva autoSpan y ajusta una división manual.' : error
    };
    state.nextId++;
    state.partitions.push(candidate);
    selectedEntity = { kind: 'partition', id: candidate.id };
    build();
    return { ok: true, id: candidate.id, cx: candidate.cx, cz: candidate.cz,
      axis: candidate.axis, length: candidate.length,
      partition: { ...candidate }, span, autoFitted: Boolean(span),
      autoPlaced: automaticallyPositioned };
  },

  addPartitionJunction({ hostId, type = 'T', side = 1, endpoint = 1 } = {}) {
    const host = state.partitions.find(p => p.id === hostId);
    if (!host) return { ok: false, error: 'Selecciona primero un tabique anfitrión' };
    let branch;
    try { branch = junctionBranchProposal(host, type, side, endpoint); }
    catch (error) { return { ok: false, error: String(error.message || error) }; }
    const result = this.addPartition(branch);
    if (!result.ok) return result;
    return { ...result, junctionType: type, hostId };
  },

  // Mismo solucionador para la vista previa y el desplazamiento definitivo.
  // No se edita el estado hasta verificar colisiones, puertas y perfil interior.
  /** Analiza el intervalo libre alrededor del centro del tabique sin mutar el proyecto. */
  getPartitionFreeSpan(idOrSpec) {
    const p = typeof idOrSpec === 'string'
      ? state.partitions.find(item => item.id === idOrSpec)
      : idOrSpec;
    if (!p) return { ok: false, error: 'Tabique no encontrado' };
    try {
      const span = computeFreePartitionSpan({
        axis: p.axis, cx: p.cx, cz: p.cz, thickness: p.thickness,
        partitionId: p.id ?? null
      }, state, state.partitions, state.objects, state.interiorDoors,
      profileThicknessFor());
      return { ok: true, span };
    } catch (error) {
      return { ok: false, error: String(error.message || error) };
    }
  },

  /** Acción explícita, transaccional: si hay colisión o puertas inválidas, no modifica nada. */
  fitPartitionToFreeSpace(id) {
    const p = state.partitions.find(item => item.id === id);
    if (!p) return { ok: false, error: 'Tabique no encontrado' };
    const result = this.getPartitionFreeSpan(id);
    if (!result.ok) return result;
    const { freeLengthM, recommendedCenter, fitsDoors,
      requiredMinDoorLengthM, blockedBy } = result.span;
    if (blockedBy || freeLengthM < 0.2 - 1e-8) {
      return { ok: false, error: blockedBy
        ? 'El centro del tabique está ocupado por ' + blockedBy + '. Muévelo a un vano libre.'
        : 'No hay espacio libre suficiente (mín. 0,20 m) en esa posición.' };
    }
    if (!fitsDoors) return { ok: false,
      error: `Tramo libre de ${freeLengthM.toFixed(2)} m insuficiente para una puerta (mín. ${requiredMinDoorLengthM.toFixed(2)} m).` };

    const key = p.axis === 'x' ? 'cx' : 'cz';
    const oldStart = p[key] - p.length / 2;
    const newStart = recommendedCenter - freeLengthM / 2;
    const next = { ...p, length: freeLengthM, autoSpan: false, [key]: recommendedCenter };
    // Las puertas usan coordenada u desde el inicio de cada tabique.
    // Conservar la posición real del vano en el contenedor, no moverlo al
    // recalcular automáticamente la longitud y su centro.
    const proposedDoors = state.interiorDoors.map(d => d.partitionId === id
      ? { ...d, u: d.u + oldStart - newStart } : { ...d });
    const failure = partitionSpecificationError(next) || partitionError(next) ||
      partitionDoorError(next, proposedDoors);
    if (failure) return { ok: false, error: failure };
    try {
      computePartitionJunctions(state.partitions.map(q => q.id === id ? next : q), proposedDoors);
    } catch (error) {
      return { ok: false, error: String(error.message || error) };
    }
    Object.assign(p, next);
    for (let i = 0; i < state.interiorDoors.length; i++) {
      if (state.interiorDoors[i].partitionId === id) {
        state.interiorDoors[i].u = proposedDoors[i].u;
      }
    }
    selectedEntity = { kind: 'partition', id };
    const done = markChanged(false);
    return { ...done, partition: { ...p }, span: result.span };
  },

  previewPartitionMove(id, { cx, cz, snap = true } = {}) {
    const current = state.partitions.find(p => p.id === id);
    if (!current) return { ok: false, error: 'Tabique no encontrado' };
    return resolveMagneticPartitionMove(current, { cx, cz }, state, profileThicknessFor(), {
      snap, partitions: state.partitions, objects: state.objects, interiorDoors: state.interiorDoors
    });
  },

  movePartition(id, { cx, cz, snap = true } = {}) {
    const preview = this.previewPartitionMove(id, { cx, cz, snap });
    if (!preview.ok) return preview;
    const current = state.partitions.find(p => p.id === id);
    if (!current) return { ok: false, error: 'Tabique no encontrado' };
    Object.assign(current, preview.candidate);
    selectedEntity = { kind: 'partition', id };
    const done = markChanged(false);
    return { ...done, cx: current.cx, cz: current.cz, snappedTo: preview.snappedTo };
  },

  updatePartition(id, delta = {}) {
    const current = state.partitions.find(p => p.id === id);
    if (!current) return { ok: false, error: 'Tabique no encontrado' };
    let candidate;
    try {
      const merged = { ...current, ...delta, id: current.id };
      merged.insulationCode = merged.hasInsulation ? (merged.insulationCode || 'P20') : null;
      candidate = fittedPartition(merged);
    }
    catch (error) { return { ok: false, error: String(error.message || error) }; }
    const error = partitionSpecificationError(candidate) || partitionError(candidate) || partitionDoorError(candidate);
    if (error) return { ok: false, error };
    Object.assign(current, candidate);
    selectedEntity = { kind: 'partition', id };
    return markChanged(false);
  },

  rotatePartition(id, { fitToWalls = false } = {}) {
    const current = state.partitions.find(p => p.id === id);
    if (!current) return { ok: false, error: 'Tabique no encontrado' };
    if (typeof fitToWalls !== 'boolean') return { ok: false, error: 'Modo de giro inválido' };
    let candidate;
    try {
      candidate = resolveRotatedPartition(current, state, profileThicknessFor(), {
        autoSpan: fitToWalls || current.autoSpan === true
      });
    } catch (error) { return { ok: false, error: String(error.message || error) }; }

    // En el modo manual, un tabique largo no se acorta ni reposiciona sin permiso.
    // La interfaz ofrece una segunda acción explícita para girar y extender
    // sobre el nuevo eje (autoSpan). Una colisión real también bloquea el giro.
    const error = partitionSpecificationError(candidate) || partitionError(candidate) || partitionDoorError(candidate);
    if (error) {
      const margin = interiorClearance(profileThicknessFor());
      const perpendicular = candidate.axis === 'x' ? state.L : state.W;
      const usable = perpendicular - 2 * margin;
      const outOfAxis = !candidate.autoSpan && candidate.length > usable + 1e-8;
      if (outOfAxis) {
        return { ok: false, code: 'ROTATION_NEEDS_FIT', canFit: true,
          error: `El tabique de ${candidate.length.toFixed(2)} m no cabe en el eje ${candidate.axis.toUpperCase()}: espacio disponible ${usable.toFixed(2)} m. Pulsa «Girar y ajustar a los muros» para cambiar al modo autoajuste, o reduce la longitud manual.` };
      }
      return { ok: false, code: 'ROTATION_BLOCKED', canFit: false,
        error: `No fue posible girar: ${error}. Prueba otro centro o despeja la zona.` };
    }
    Object.assign(current, candidate);
    selectedEntity = { kind: 'partition', id };
    build();
    return { ok: true, id, axis: current.axis, length: current.length,
      autoSpan: current.autoSpan };
  },

  addInteriorDoor({ partitionId, u = undefined, w = 0.8, h = 2.0, catalogCode = 'P81' } = {}) {
    const p = state.partitions.find(x => x.id === partitionId);
    if (!p) return { ok: false, error: 'Tabique anfitrión no encontrado' };
    const width = Number(w);
    const candidate = { id: 'idoor-' + state.nextId, partitionId, u: u === undefined ? (p.length - width) / 2 : Number(u),
      w: width, h: Number(h), catalogCode };
    const err = validateInteriorDoor(candidate, p, state.interiorDoors);
    if (err) return { ok: false, error: err };
    const junctionError = computePartitionJunctions(state.partitions, []).map(j =>
      checkJunctionAgainstDoors(j, [...state.interiorDoors.filter(d => d.id !== candidate.id), candidate]))
      .find(Boolean);
    if (junctionError) return { ok: false, error: junctionError };
    state.nextId++;
    state.interiorDoors.push(candidate);
    selectedEntity = { kind: 'interiorDoor', id: candidate.id };
    build();
    return { ok: true, id: candidate.id };
  },

  updateInteriorDoor(id, delta = {}) {
    const current = state.interiorDoors.find(x => x.id === id);
    if (!current) return { ok: false, error: 'Puerta interior no encontrada' };
    const p = state.partitions.find(x => x.id === current.partitionId);
    // Nunca permitir cambiar el tabique anfitrión de forma accidental.
    const candidate = { ...current, ...delta, id: current.id, partitionId: current.partitionId };
    const err = validateInteriorDoor(candidate, p, state.interiorDoors);
    if (err) return { ok: false, error: err };
    const junctionError = computePartitionJunctions(state.partitions, []).map(j =>
      checkJunctionAgainstDoors(j, [...state.interiorDoors.filter(d => d.id !== candidate.id), candidate]))
      .find(Boolean);
    if (junctionError) return { ok: false, error: junctionError };
    Object.assign(current, candidate);
    selectedEntity = { kind: 'interiorDoor', id };
    return markChanged(false);
  },

  removeInteriorDoor(id) {
    if (!state.interiorDoors.some(x => x.id === id)) return { ok: false, error: 'Puerta interior no encontrada' };
    state.interiorDoors = state.interiorDoors.filter(d => d.id !== id);
    if (selectedEntity?.kind === 'interiorDoor' && selectedEntity.id === id) selectedEntity = null;
    return markChanged(false);
  },

  removePartition(id) {
    if (!state.partitions.some(p => p.id === id)) return { ok: false, error: 'Tabique no encontrado' };
    state.partitions = state.partitions.filter(p => p.id !== id);
    state.interiorDoors = state.interiorDoors.filter(d => d.partitionId !== id);
    if ((selectedEntity?.kind === 'partition' && selectedEntity.id === id) ||
        (selectedEntity?.kind === 'interiorDoor' && !state.interiorDoors.some(d => d.id === selectedEntity.id))) selectedEntity = null;
    return markChanged(false);
  },

  selectEntity(kind, id) {
    if (kind === 'roof' && id !== 'main') return { ok: false, error: 'Techo inexistente' };
    if (kind === 'wall' && !FACES[id]) return { ok: false, error: 'Muro inexistente' };
    if (kind === 'floor' && id !== 'general') return { ok: false, error: 'Piso inexistente' };
    if (kind === 'object' && !state.objects.some(o => o.id === id)) return { ok: false, error: 'Objeto inexistente' };
    if (kind === 'opening' && !state.openings.some(o => o.id === id)) return { ok: false, error: 'Abertura inexistente' };
    if (kind === 'partition' && !state.partitions.some(p => p.id === id)) return { ok: false, error: 'Tabique inexistente' };
    if (kind === 'interiorDoor' && !state.interiorDoors.some(d => d.id === id)) return { ok: false, error: 'Puerta interior inexistente' };
    const prevKind = selectedEntity?.kind;
    selectedEntity = kind ? { kind, id } : null;
    if (['opening', 'partition', 'interiorDoor'].includes(kind) || ['opening', 'partition', 'interiorDoor'].includes(prevKind)) build();
    else rebuildObjects();
    return { ok: true };
  },

  getSelected() { return selectedEntity ? { ...selectedEntity } : null; },
  getEntityMeshes() { return objectGroups.slice(); },

  setFloorDirection(direction) {
    if (direction !== 'length' && direction !== 'width') {
      return { ok: false, error: 'Orientación del piso inválida (usa length o width)' };
    }
    if (state.floorDirection === direction) return { ok: true, direction };
    state.floorDirection = direction;
    build();
    return { ok: true, direction };
  },

  setColor(hex) {
    if (typeof hex !== 'string' || !/^#[a-f0-9]{6}$/i.test(hex)) return { ok: false, error: 'Color inválido' };
    state.color = hex; return markChanged(false);
  },

  setView(pos, target) { camera.position.set(...pos); if (target) controls.target.set(...target); controls.update(); cameraMoved = true; },
  setSeeInside(v) { state.seeInside = !!v; applyXray(true); },
  getState() { return JSON.parse(JSON.stringify(state)); },

  setState(s) {
    const backup = this.getState();
    try {
      if (!s || !TYPES[s.type] || !validDimensions(s.L, s.W, s.H) || typeof s.color !== 'string' || !/^#[a-f0-9]{6}$/i.test(s.color)) {
        throw Error('Archivo con datos de contenedor inválidos');
      }
      if (!Array.isArray(s.openings) || !Array.isArray(s.partitions)) throw Error('Estructura de proyecto incompleta');
      // Los proyectos anteriores no incluyen floorDirection: conservar longitud por defecto.
      const floorDirection = s.floorDirection === undefined ? 'length' : s.floorDirection;
      if (floorDirection !== 'length' && floorDirection !== 'width') {
        throw Error('Orientación del piso inválida en el archivo JSON');
      }
      for (const key of ['openings', 'partitions', 'interiorDoors', 'objects', 'services', 'sharedWalls']) {
        if (s[key] !== undefined && (!Array.isArray(s[key]) || s[key].length > 200)) {
          throw Error('Lista de ' + key + ' inválida o demasiado extensa');
        }
      }
      // Respaldos anteriores no incluyen bathFloor. Solo se acepta el campo
      // canónico superior para evitar dos fuentes de verdad divergentes.
      let cleanBathFloor = null;
      if (s.bathFloor !== undefined && s.bathFloor !== null) {
        if (!s.bathFloor || typeof s.bathFloor !== 'object' || Array.isArray(s.bathFloor)) {
          throw Error('Configuración de piso de baño inválida');
        }
        const code = String(s.bathFloor.code || '');
        if (CATALOG_BY_CODE[code]?.mode !== 'floor') throw Error('Código de piso de baño inválido');
        cleanBathFloor = { code, length: Number(s.bathFloor.length), width: Number(s.bathFloor.width) };
        if (Object.prototype.hasOwnProperty.call(s.bathFloor, 'cx') ||
            Object.prototype.hasOwnProperty.call(s.bathFloor, 'cz')) {
          if (!Object.prototype.hasOwnProperty.call(s.bathFloor, 'cx') ||
              !Object.prototype.hasOwnProperty.call(s.bathFloor, 'cz')) {
            throw Error('Ubicación del baño incompleta: se requieren X y Z');
          }
          cleanBathFloor.cx = Number(s.bathFloor.cx);
          cleanBathFloor.cz = Number(s.bathFloor.cz);
        }
      }
      const issueBath = validateBathFloor(cleanBathFloor, s,
        (TYPES[s.type].R + TYPES[s.type].T));
      if (issueBath) throw Error('Piso de baño inválido: ' + issueBath);
      const finishes = s.finishes || { floor: null, ceiling: null, skirting: null, walls: { A: null, B: null, C: null, D: null } };
      if (!finishes.walls || typeof finishes.walls !== 'object' || Array.isArray(finishes.walls) ||
          (finishes.interiorWalls !== undefined &&
           (!finishes.interiorWalls || typeof finishes.interiorWalls !== 'object' || Array.isArray(finishes.interiorWalls)))) {
        throw Error('Acabados de muros inválidos');
      }
      const validFinish = (code, modes) => code == null || modes.includes(CATALOG_BY_CODE[code]?.mode);
      if (!validFinish(finishes.floor, ['floor']) || !validFinish(finishes.ceiling, ['ceiling']) ||
          !validFinish(finishes.skirting, ['skirting'])) {
        throw Error('Códigos de acabados incompatibles');
      }
      const exteriorWalls = {}, interiorWalls = {};
      for (const face of ['A', 'B', 'C', 'D']) {
        const prevCode = finishes.walls[face] || null;
        const innerCode = finishes.interiorWalls?.[face] || null;
        if (!validFinish(innerCode, ['wall-interior-finish'])) {
          throw Error('Revestimiento interior inválido en cara ' + face);
        }
        if (CATALOG_BY_CODE[prevCode]?.mode === 'wall-interior-finish') {
          // JSON anterior: antes los interiores se guardaban en finishes.walls.
          if (innerCode && innerCode !== prevCode) throw Error('Revestimientos interiores incompatibles en cara ' + face);
          exteriorWalls[face] = null;
          interiorWalls[face] = innerCode || prevCode;
        } else {
          if (!validFinish(prevCode, ['wall-exterior-finish'])) throw Error('Revestimiento exterior inválido en cara ' + face);
          exteriorWalls[face] = prevCode;
          interiorWalls[face] = innerCode;
        }
      }

      let maxId = Number.isSafeInteger(s.nextId) && s.nextId > 0 ? s.nextId - 1 : 0;
      const trackNumId = val => {
        const n = typeof val === 'number' ? val : Number(String(val).replace(/^(obj|service|partition|idoor|shared|ext)-/, ''));
        if (Number.isSafeInteger(n) && n > maxId) maxId = n;
      };

      const seenIds = new Set();
      const uniqueId = (id, expectedPrefix = '') => {
        const key = String(id);
        if (seenIds.has(key)) throw Error('ID duplicado: ' + key);
        if (expectedPrefix && !new RegExp('^' + expectedPrefix + '-[1-9]\\d*$').test(key)) {
          throw Error('ID con formato inválido: ' + key);
        }
        seenIds.add(key);
      };

      const cleanOpenings = s.openings.map(o => {
        if (!o || typeof o !== 'object' || !Number.isSafeInteger(o.id) || o.id < 1) throw Error('ID de abertura inválido');
        uniqueId(o.id);
        trackNumId(o.id);
        const type = String(o.type);
        const expected = reinforcementCodeFor(type);
        if (!expected || (o.reinforcementCode != null && o.reinforcementCode !== expected)) {
          throw Error('Código de refuerzo del vano inválido');
        }
        if (o.bars !== undefined && typeof o.bars !== 'boolean') {
          throw Error('El indicador de barrotes debe ser booleano');
        }
        return withOpeningReinforcement({
          id: o.id, type, face: String(o.face), w: Number(o.w), h: Number(o.h),
          u: Number(o.u), v: Number(o.v), bars: o.bars === true,
          catalogCode: o.catalogCode ? String(o.catalogCode) : null
        });
      });

      const cleanElectrical = sanitizeElectricalConfig(s.electrical, s, cleanOpenings);

      const cleanObjects = (s.objects || []).map(o => {
        if (!o || typeof o !== 'object' || typeof o.id !== 'string' || !o.id) throw Error('ID de objeto inválido');
        uniqueId(o.id, 'obj');
        trackNumId(o.id);
        return {
          id: o.id, code: String(o.code), x: Number(o.x), y: Number(o.y), z: Number(o.z),
          w: Number(o.w), h: Number(o.h), d: Number(o.d), rot: Number(o.rot)
        };
      });

      const cleanServices = (s.services || []).map(srv => {
        if (!srv || typeof srv !== 'object' || typeof srv.id !== 'string' || !srv.id) throw Error('ID de servicio inválido');
        uniqueId(srv.id, 'service');
        trackNumId(srv.id);
        return { id: srv.id, code: String(srv.code) };
      });

      const cleanPartitions = s.partitions.map((p, index) => ({
        id: p.id ? String(p.id) : 'partition-' + (maxId + index + 1),
        length: Number(p.length), height: Number(p.height), thickness: Number(p.thickness),
        axis: String(p.axis), cx: Number(p.cx), cz: Number(p.cz),
        autoSpan: p.autoSpan === undefined ? false : p.autoSpan,
        faceALining: p.faceALining === undefined ? null : p.faceALining,
        faceBLining: p.faceBLining === undefined ? null : p.faceBLining,
        hasInsulation: p.hasInsulation === undefined ? false : p.hasInsulation,
        insulationCode: p.insulationCode === undefined ? null : p.insulationCode
      }));

      for (const p of cleanPartitions) {
        uniqueId(p.id, 'partition');
        trackNumId(p.id);
      }

      const cleanInteriorDoors = (s.interiorDoors || []).map(d => {
        if (!d || typeof d !== 'object' || typeof d.id !== 'string' || !d.id) {
          throw Error('ID de puerta interior inválido');
        }
        uniqueId(d.id, 'idoor');
        trackNumId(d.id);
        return { id: d.id, partitionId: String(d.partitionId), u: Number(d.u),
          w: Number(d.w), h: Number(d.h), catalogCode: String(d.catalogCode) };
      });

      const cleanSharedWalls = (s.sharedWalls || []).map(zone => {
        if (!zone || typeof zone !== 'object' || typeof zone.id !== 'string') {
          throw Error('Zona de muro compartido inválida');
        }
        uniqueId(zone.id, 'shared');
        trackNumId(zone.id);
        return { id: zone.id, face: String(zone.face), u: Number(zone.u),
          v: Number(zone.v), w: Number(zone.w), h: Number(zone.h) };
      });

      const cleanExteriorZones = sanitizeExteriorZones(finishes.exteriorZones || [], {
        ...s, openings: cleanOpenings, sharedWalls: cleanSharedWalls,
        finishes: { ...finishes, exteriorZones: [] }
      });
      for (const zone of cleanExteriorZones) { uniqueId(zone.id, 'ext'); trackNumId(zone.id); }
      if (!Number.isSafeInteger(maxId + 1)) throw Error('Contador de objetos fuera de rango');

      Object.assign(state, {
        type: s.type, L: Number(s.L), W: Number(s.W), H: Number(s.H), color: s.color,
        openings: [], partitions: cleanPartitions, interiorDoors: cleanInteriorDoors,
        objects: cleanObjects, services: cleanServices, sharedWalls: cleanSharedWalls,
        bathFloor: cleanBathFloor, floorDirection,
        electrical: cleanElectrical,
        finishes: {
          floor: finishes.floor || null, ceiling: finishes.ceiling || null, skirting: finishes.skirting || null,
          walls: exteriorWalls,
          interiorWalls, exteriorZones: cleanExteriorZones
        },
        seeInside: !!s.seeInside, nextId: maxId + 1
      });

      const bathErr = validateBathFloor(state.bathFloor, state, profileThicknessFor());
      if (bathErr) throw Error('Piso de baño inválido: ' + bathErr);
      // Primero validar la ubicación de los vanos y las zonas de contacto,
      // después verificar que ninguna zona invade el área libre de otra.
      for (const o of cleanOpenings) {
        if (!['door', 'window'].includes(o.type) || !['A', 'B', 'C', 'D'].includes(o.face) ||
            validateOpening(o)) throw Error('Abertura inválida: esquinero, superposición o límites');
        state.openings.push(o);
      }
      for (const zone of state.sharedWalls) {
        const error = validateSharedWallRegion(zone, state, zone.id);
        if (error) throw Error('Muro compartido inválido: ' + error);
      }
      for (const o of state.objects) if (objectError(o)) throw Error('Objeto inválido: ' + o.code);
      for (const o of state.services) if (CATALOG_BY_CODE[o.code]?.mode !== 'service') throw Error('Servicio inválido');
      for (const p of state.partitions) {
        if (typeof p.autoSpan !== 'boolean') throw Error('Autoajuste de tabique inválido');
        const specError = partitionSpecificationError(p);
        if (specError) throw Error('Tabique inválido: ' + specError);
        if (p.autoSpan) {
          const fit = fittedPartition(p);
          if (Math.abs(fit.length - p.length) > 1e-7 ||
              Math.abs(fit.cx - p.cx) > 1e-7 || Math.abs(fit.cz - p.cz) > 1e-7) {
            throw Error('Tabique autoajustado incompatible con las dimensiones del proyecto');
          }
        }
        const error = partitionError(p);
        if (error) throw Error('Tabique inválido: ' + error);
        const doorError = partitionDoorError(p);
        if (doorError) throw Error('Puerta interior inválida: ' + doorError);
      }
      if (state.interiorDoors.some(d => !state.partitions.some(p => p.id === d.partitionId))) {
        throw Error('Puerta interior sin tabique anfitrión');
      }

      selectedEntity = null;
      build();
      frameCamera();
      syncPanel();
      return { ok: true };
    } catch (error) {
      Object.assign(state, backup);
      selectedEntity = null;
      try { build(); syncPanel(); } catch (restoreError) { console.error('[BAT-V2] Fallo al restaurar escena:', restoreError); }
      return { ok: false, error: String(error.message || error) };
    }
  }
};

window.Container3D = api;

/* ============ Panel de demostración ============ */
const $ = id => document.getElementById(id);
const num = id => parseFloat(String($(id).value).replace(',', '.'));

function syncPanel() {
  $('dL').value = state.L; $('dW').value = state.W; $('dH').value = state.H; $('dC').value = state.color;
  $('desc').textContent = TYPES[state.type].desc;
  document.querySelectorAll('#seg button').forEach(b => b.classList.toggle('on', b.dataset.t === state.type));
  $('oBars').checked = state.type === 'modular';
  $('xray').checked = state.seeInside;
  $('msg').textContent = '';
  if ($('floor-direction')) $('floor-direction').value = state.floorDirection || 'length';
}

document.querySelectorAll('#seg button').forEach(b => {
  b.onclick = () => {
    if (state.type === b.dataset.t) return;
    const hasWork = state.objects.length || state.openings.length || state.partitions.length ||
      state.services.length || state.sharedWalls.length || state.finishes.floor || state.finishes.ceiling ||
      state.finishes.skirting || Object.values(state.finishes.walls).some(Boolean) ||
      Object.values(state.finishes.interiorWalls).some(Boolean) ||
      state.finishes.exteriorZones.length > 0;
    if (hasWork && !window.confirm('Cambiar el tipo de contenedor eliminará los elementos y acabados del diseño actual. ¿Continuar?')) return;
    const result = api.setType(b.dataset.t, { samples: false });
    if (result.ok) { syncPanel(); editor?.clearPending(); }
    else $('msg').textContent = result.error;
  };
});

$('bDims').onclick = () => {
  const r = api.setDimensions(num('dL'), num('dW'), num('dH'));
  $('msg').textContent = r.ok ? '' : r.error;
};
$('dC').oninput = e => api.setColor(e.target.value);
$('bAdd').onclick = () => {
  const r = api.addOpening({
    type: $('oT').value, face: $('oF').value, w: num('oW'), h: num('oH'),
    u: num('oU'), v: num('oV'), bars: $('oT').value === 'window' && $('oBars').checked,
  });
  $('msg').textContent = r.ok ? '' : r.error;
};
$('bClear').onclick = () => { api.clearOpenings(); $('msg').textContent = ''; };
$('xray').onchange = e => api.setSeeInside(e.target.checked);

api.setType('maritimo', { samples: false });
syncPanel();
const refreshElectrical = installElectricalUI({scene,state,FLOOR,camera,renderer,controls});

try {
  editor = installEditor({ THREE, renderer, camera, controls, root, api, state, FACES, FLOOR, syncPanel });
} catch (error) {
  console.error('[BAT-V2] No se pudo iniciar el editor:', error);
  document.getElementById('scene-hint').textContent = 'Error al iniciar el editor: ' + error.message;
}

(function loop() {
  requestAnimationFrame(loop);
  refreshElectrical();
  controls.update();
  if (state.seeInside && cameraMoved) {
    applyXray();
    cameraMoved = false;
  }
  renderer.render(scene, camera);
})();
