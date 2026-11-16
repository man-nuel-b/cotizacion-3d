import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CATALOG, CATALOG_BY_CODE } from './container-catalog.js';
import { createObjectModel, makeFinishMaterial } from './container-object-models.js';
import { installEditor } from './container-editor-ui.js';

/* ====================== Tipos de contenedor ====================== */
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

/* ====================== Escena, luces, render ====================== */
const view = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
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
sun.shadow.bias = -0.0008;
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

const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.1, 400);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI / 2 - 0.02;
controls.minDistance = 2;
controls.maxDistance = 70;

function frameCamera() {
  const d = Math.max(state.L, 6) * 1.15;
  camera.position.set(d * 0.8, d * 0.38, d * 0.95);
  controls.target.set(0, (state.H + FLOOR) / 2, 0);
  controls.update();
}
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

/* ====================== Texturas procedurales ====================== */
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

/* ====================== Chapa (corrugada o lisa) ====================== */
function dAt(x) {
  const { Q, V } = profileCfg;
  const k = Math.floor(x / Q + 1e-12);
  const t = (x - k * Q) / Q;
  const a = V[((k % 4) + 4) % 4], b = V[(((k + 1) % 4) + 4) % 4];
  return a + (b - a) * t;
}
function profile(x0, x1) {
  const { R, Q, V } = profileCfg;
  if (R === 0) return [[x0, 0], [x1, 0]];
  const pts = [[x0, dAt(x0)]];
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

/* ====================== Estado y construcción ====================== */
const state = {
   type: 'maritimo',
   L: 12.03, W: 2.35, H: 2.39, color: '#7d8388',
   openings: [], partitions: [], objects: [], services: [],
   finishes: { floor: null, ceiling: null, skirting: null, walls: { A: null, B: null, C: null, D: null } },
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

function mat(opts) { const m = new THREE.MeshStandardMaterial(opts); owned.push(m); return m; }
function clearRoot() {
  for (const c of [...root.children]) {
    if (c === objectsLayer) continue;
    root.remove(c);
    c.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  }
  owned.forEach(m => m.dispose());
  ownedTextures.forEach(t => t.dispose());
  owned = []; ownedTextures = []; walls = [];
}
function clearObjectsLayer() {
  for (const c of [...objectsLayer.children]) {
    objectsLayer.remove(c);
    c.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  }
  ownedObjMaterials.forEach(m => m.dispose());
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

function validateOpening(o, excludeId = null) {
  const f = FACES[o.face];
  if (!f) return 'Cara inválida';
  if (![o.w, o.h, o.u, o.v].every(Number.isFinite) || !(o.w > 0 && o.h > 0)) return 'Dimensiones inválidas';
  const lw = f.long ? state.L : state.W;
  if (o.u < -1e-9 || o.u + o.w > lw + 1e-9 || o.v < -1e-9 || o.v + o.h > state.H + 1e-9)
    return 'Abertura fuera del contenedor';
  for (const p of state.openings) {
    if (p.id === excludeId || p.face !== o.face) continue;
    const sep = o.u + o.w <= p.u || p.u + p.w <= o.u || o.v + o.h <= p.v || p.v + p.h <= o.v;
    if (!sep) return 'Se superpone con otra abertura';
  }
  return null;
}

/* ---------- Puertas y ventanas ---------- */
function buildOpening(o, lw, m, parent) {
  const { WALL } = profileCfg;
  const g = new THREE.Group();
  const w = o.w, h = o.h, fb = 0.05, fd = Math.max(0.09, WALL + 0.03);
  const frameMat = selectedEntity?.kind === 'opening' && selectedEntity.id === o.id ?
    m.yellow : o.type === 'window' ? m.alu : m.frame;
  g.position.set(o.u + w / 2 - lw / 2, FLOOR + o.v + h / 2, -WALL / 2 + (fd - WALL) / 2);




    box(w + 2 * fb, fb, fd, frameMat, 0, h / 2 + fb / 2, 0, g);
    if (o.v > 0.01) box(w + 2 * fb, fb, fd, frameMat, 0, -h / 2 - fb / 2, 0, g);
    box(fb, h, fd, frameMat, -(w / 2 + fb / 2), 0, 0, g);
    box(fb, h, fd, frameMat, (w / 2 + fb / 2), 0, 0, g);
    const zFront = fd / 2;
    if (o.type === 'door') {
      const leaf = o.catalogCode === 'P80' ? m.wood : o.catalogCode === 'P81' ? m.light : m.door;
      box(w - 0.02, h - 0.02, 0.035, leaf, 0, 0, -0.012, g);
      box(w * 0.72, h * 0.8, 0.012, m.doorInset, 0, 0, 0.012, g);
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
        box(w, 0.016, 0.016, m.bars, 0, h * 0.25, zFront + 0.012, g);
        box(w, 0.016, 0.016, m.bars, 0, -h * 0.25, zFront + 0.012, g);
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

/* ---------- Reconstrucción parcial de objetos 3D (sin reconstruir casco) ---------- */
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

/* ---------- Construcción completa del contenedor ---------- */
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
     : mat({ color: new THREE.Color(state.color).multiplyScalar(0.72), map: paintTex, roughness: cfg.rough, metalness: cfg.metal+ 0.05, envMapIntensity: 0.75 });
  const m = {
     frame,
     dark: mat({ color: 0x25282c, roughness: 0.7, metalness: 0.3 }),
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

  const floorMat = state.finishes.floor ?
    makeFinishMaterial(THREE, state.finishes.floor, matObj => owned.push(matObj), t => ownedTextures.push(t), Math.max(1, L /2), Math.max(1, W)) :cfg.floor === 'wood' ? m.wood : cfg.floor === 'alu' ? m.floorAlu : m.floorVinyl;

    box(L - 2 * WALL - 0.02, 0.05, W - 2 * WALL - 0.02, floorMat, 0, FLOOR - 0.025, 0, root);
    if (state.finishes.skirting) {
      const sk = mat({ color: 0xe4e8e8, roughness: .76, metalness: 0 });
      for (const side of [-1, 1]) {
        box(L - .17, .07, .013, sk, 0, FLOOR + .035, side * (W / 2 - WALL - .025), root);
        box(.013, .07, W - .15, sk, side * (L / 2 - WALL - .02), FLOOR + .035, 0, root);
      }




  }
  for (let x = -L / 2 + 0.35; x < L / 2 - 0.2; x += 0.6) box(0.1, 0.1, W - 0.2, m.dark, x, 0.05, 0, root);
  const e = 0.003;
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
    for (const s of [-1, 1]) for (const x of [-1.9, 1.9]) box(0.36, 0.09, 0.11, m.dark, x, 0.07, s * (W / 2 - 0.05 + 0.006),
root);
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
      makeFinishMaterial(THREE, finishCode, matObj => owned.push(matObj), t => ownedTextures.push(t),
        Math.max(1, lw / 1.2), Math.max(1, totalH / 1.2)) :
      paint.clone();
    if (!finishCode) owned.push(wmat);
    const group = wallPanels(lw, totalH, cuts, wmat, seam);
    group.rotation.y = Math.atan2(f.n[0], f.n[2]);
    group.position.set(f.n[0] * half, 0, f.n[2] * half);
    root.add(group);
    ops.forEach(o => buildOpening(o, lw, m, group));
    if (ops.length === 0) {
      const deco = cfg.deco[key];
      if (deco === 'doors') buildDoorsEnd(lw, totalH, m, group, state.type === 'reefer' ? [-0.95, -0.5, 0.5, 0.95] : [-0.9,
-0.2, 0.2, 0.9]);
      if (deco === 'machine') buildMachine(lw, totalH, m, group);
    }
    walls.push({ group, mat: wmat, n: new THREE.Vector3(...f.n), half, hidden: false, roof: false });
  }

    {
        const rmat = state.finishes.ceiling ?
          makeFinishMaterial(THREE, state.finishes.ceiling, matObj => owned.push(matObj), t => ownedTextures.push(t),
            Math.max(1, L / 1.2), Math.max(1, W / 1.2)) : paint.clone();
        if (!state.finishes.ceiling) owned.push(rmat);
        const rl = L - 0.2, rw = W - 0.2;
        const roof = wallPanels(rl, rw, [], rmat);
        roof.rotation.x = -Math.PI / 2;
        roof.position.set(0, totalH - WALL + 0.0005, rw / 2);
        root.add(roof);
        walls.push({ group: roof, mat: rmat, n: new THREE.Vector3(0, 1, 0), half: 0, hidden: false, roof: true });
    }

    state.partitions.forEach(p => {
      const sx = p.axis === 'x' ? p.length : p.thickness;
      const sz = p.axis === 'x' ? p.thickness : p.length;
      box(sx, p.height, sz, m.part, p.cx, FLOOR + p.height / 2, p.cz, root);
    });

    rebuildObjects();
    applyXray(true);
}

/* ====================== Modo "ver interior" ====================== */
function setWallHidden(w, hide) {
  if (w.hidden === hide) return;
  w.hidden = hide;
  w.mat.transparent = hide;
  w.mat.opacity = hide ? 0.07 : 1;
  w.mat.depthWrite = !hide;
  w.mat.needsUpdate = true;
  w.group.traverse(o => {
    if (o.userData.isPanel) o.castShadow = !hide;
    if (o.userData.seam) o.visible = !hide;
  });
}
function applyXray(force = false) {
  if (force) walls.forEach(w => { w.hidden = null; });




    const cam = camera.position;
    for (const w of walls) {
      let hide = false;
      if (state.seeInside) hide = w.roof ? true : cam.dot(w.n) > w.half - 0.01;
      setWallHidden(w, hide);
    }
}

/* ====================== API pública ====================== */
const SAMPLES = {
   maritimo: [
      { type: 'window', face: 'A', w: 1.2, h: 0.8, u: 4, v: 0.9 },
      { type: 'door', face: 'C', w: 0.9, h: 2.0, u: 1.2, v: 0 },
   ],
   reefer: [],
   modular: [
      { type: 'door', face: 'A', w: 0.9, h: 2.05, u: 0.8, v: 0 },
      { type: 'window', face: 'A', w: 1.2, h: 1.0, u: 2.4, v: 1.0, bars: true },
      { type: 'window', face: 'C', w: 1.2, h: 1.0, u: 2.4, v: 1.0, bars: true },
   ],
};

function finitePositive(n) { return Number.isFinite(n) && n > 0; }
function validDimensions(L, W, H) {
  return [L, W, H].every(finitePositive) && L >= 2 && L <= 25 && W >= 1 && W <= 5 && H >= 1.8 && H <= 5;
}
function objectError(o, ref = state) {
  const entry = CATALOG_BY_CODE[o?.code];
  if (!entry || !['object', 'wall-object'].includes(entry.mode)) return 'Partida 3D no válida';
  if (![o.x, o.y, o.z, o.w, o.h, o.d, o.rot].every(Number.isFinite)) return 'Coordenadas no numéricas';
  if (!(o.w > .02 && o.h > .02 && o.d > .008) || o.w > 25 || o.h > 5 || o.d > 5) return 'Dimensiones inválidas';
  const angle = o.rot * Math.PI / 180;
  const rx = (Math.abs(Math.cos(angle)) * o.w + Math.abs(Math.sin(angle)) * o.d) / 2;
  const rz = (Math.abs(Math.sin(angle)) * o.w + Math.abs(Math.cos(angle)) * o.d) / 2;
  if (Math.abs(o.x) + rx > ref.L / 2 - .055 || Math.abs(o.z) + rz > ref.W / 2 - .055)
    return 'El elemento no cabe dentro del contenedor; cambia su posición o dimensiones';
  if (o.y < 0 || o.y + o.h > ref.H + .0001) return 'El elemento supera la altura interior';
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
  setType(key, { samples = false } = {}) {
     const c = TYPES[key]; if (!c) return { ok: false, error: 'Tipo de contenedor inválido' };
     state.type = key; [state.L, state.W, state.H] = c.dims;
     state.color = c.color; state.openings = []; state.partitions = [];
     state.objects = []; state.services = [];
     state.finishes = { floor: null, ceiling: null, skirting: null, walls: { A: null, B: null, C: null, D: null } };
     state.nextId = 1; selectedEntity = null;
     if (samples) for (const x of SAMPLES[key]) {
       const sample = { id: state.nextId, ...x };
       if (!validateOpening(sample)) { state.nextId++; state.openings.push(sample); }
     }
     build(); frameCamera(); return { ok: true, dims: c.dims, color: c.color };
  },
  setDimensions(L, W, H) {
     if (!validDimensions(L, W, H)) return { ok: false, error: 'Dimensiones fuera de rango permitido' };
     const next = { L, W, H };
     if (state.openings.some(o => {
       const f = FACES[o.face], span = f?.long ? L : W;
       return !f || o.u < 0 || o.u + o.w > span + 1e-8 || o.v < 0 || o.v + o.h > H + 1e-8;
     })) return { ok: false, error: 'Algunas aberturas quedarían fuera; debes moverlas antes' };
     if (state.objects.some(o => objectError(o, next))) return { ok: false, error: 'Algunos objetos no caben en las nuevasdimensiones' };
     if (state.partitions.some(p => {
       const rx = p.axis === 'x' ? p.length / 2 : p.thickness / 2;
       const rz = p.axis === 'z' ? p.length / 2 : p.thickness / 2;
       return ![p.length, p.height, p.thickness, p.cx, p.cz].every(Number.isFinite) ||
         p.height > H || p.height <= 0 || Math.abs(p.cx) + rx > L / 2 || Math.abs(p.cz) + rz > W / 2;
     })) return { ok: false, error: 'Los tabiques actuales no caben en las nuevas dimensiones' };




  [state.L, state.W, state.H] = [L, W, H];
  return markChanged(false);
},
addOpening({ type = 'door', face = 'A', w, h, u, v = 0, bars = false, catalogCode = null }) {
   if (!['door', 'window'].includes(type) || typeof bars !== 'boolean' || (bars && type !== 'window'))return { ok: false, error: 'Tipo o barrotes inválidos' };
   if (catalogCode && CATALOG_BY_CODE[catalogCode]?.mode !== 'opening')
     return { ok: false, error: 'Código de abertura inválido' };
   const o = { id: state.nextId, type, face, w, h, u, v, bars, catalogCode };
   const err = validateOpening(o); if (err) return { ok: false, error: err };
   state.nextId++; state.openings.push(o); selectedEntity = { kind: 'opening', id: o.id };
   build(); return { ok: true, id: o.id };
},
updateOpening(id, delta = {}) {
   const old = state.openings.find(o => o.id === id); if (!old) return { ok: false, error: 'Abertura no encontrada' };
   const o = { ...old, ...delta, id: old.id };
   if (!['door', 'window'].includes(o.type) || typeof o.bars !== 'boolean' || (o.type === 'door' && o.bars))return { ok: false, error: 'Tipo o barrotes inválidos' };
   const err = validateOpening(o, id); if (err) return { ok: false, error: err };
   Object.assign(old, o); selectedEntity = { kind: 'opening', id };
   return markChanged(false);
},
moveOpening(id, { face, u, v }) { return this.updateOpening(id, { face, u, v }); },
duplicateOpening(id) {
   const old = state.openings.find(o => o.id === id); if (!old) return { ok: false, error: 'Abertura no encontrada' };
   const span = FACES[old.face].long ? state.L : state.W;
   for (const u of [old.u + old.w + .1, old.u - old.w - .1]) {
     const next = { ...old, id: state.nextId, u };
     if (u >= 0 && u + old.w <= span && !validateOpening(next)) {
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
   if (!entry || !['object', 'wall-object'].includes(entry.mode))
     return { ok: false, error: 'Esta partida requiere seleccionar una superficie, no colocar un objeto' };
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
setFinish(code, face = 'A') {
   const entry = CATALOG_BY_CODE[code]; if (!entry) return { ok: false, error: 'Código inexistente' };
   if (entry.mode === 'floor') state.finishes.floor = code;
   else if (entry.mode === 'skirting') state.finishes.skirting = code;
   else if (entry.mode === 'ceiling') state.finishes.ceiling = code;
   else if (entry.mode === 'wall-finish') {
     if (!FACES[face]) return { ok: false, error: 'Selecciona una cara válida' };




      state.finishes.walls[face] = code;
    } else return { ok: false, error: 'Esta partida no corresponde a una terminación' };
    build(); return { ok: true, code, face };
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
  addPartition({ length, height, thickness = .1, axis = 'x', cx = 0, cz = 0 }) {
     if (![length, height, thickness, cx, cz].every(Number.isFinite) || length <= 0 || height <= 0 || thickness <= 0 ||height > state.H || !['x', 'z'].includes(axis)) return { ok: false, error: 'Tabique inválido' };
     const rx = axis === 'x' ? length / 2 : thickness / 2, rz = axis === 'z' ? length / 2 : thickness / 2;
     if (Math.abs(cx) + rx > state.L / 2 || Math.abs(cz) + rz > state.W / 2) return { ok: false, error: 'Tabique fuera delcontenedor' };
     state.partitions.push({ length, height, thickness, axis, cx, cz }); return markChanged(false);
  },
  selectEntity(kind, id) {
     if (kind === 'object' && !state.objects.some(o => o.id === id)) return { ok: false, error: 'Objeto inexistente' };
     if (kind === 'opening' && !state.openings.some(o => o.id === id)) return { ok: false, error: 'Abertura inexistente' };
     const prevKind = selectedEntity?.kind;
     selectedEntity = kind ? { kind, id } : null;
     if (kind === 'opening' || prevKind === 'opening') build();
     else rebuildObjects();
     return { ok: true };
  },
  getSelected() { return selectedEntity ? { ...selectedEntity } : null; },
  getEntityMeshes() { return objectGroups.slice(); },
  setColor(hex) {
     if (typeof hex !== 'string' || !/^#[a-f0-9]{6}$/i.test(hex)) return { ok: false, error: 'Color inválido' };
     state.color = hex; return markChanged(false);
  },
  setView(pos, target) { camera.position.set(...pos); if (target) controls.target.set(...target); controls.update(); },
  setSeeInside(v) { state.seeInside = !!v; applyXray(true); },
  getState() { return JSON.parse(JSON.stringify(state)); },
  setState(s) {
     const backup = this.getState();
     try {
       if (!s || !TYPES[s.type] || !validDimensions(s.L, s.W, s.H) || typeof s.color !== 'string' || !/^#[a-f0-9]{6}$/i.test(s.color))throw Error('Archivo con datos de contenedor inválidos');
       if (!Array.isArray(s.openings) || !Array.isArray(s.partitions))
         throw Error('Estructura de proyecto incompleta');
       for (const key of ['openings', 'partitions', 'objects', 'services'])
         if (s[key] !== undefined && (!Array.isArray(s[key]) || s[key].length > 200))
           throw Error('Lista de ' + key + ' inválida o demasiado extensa');

      const finishes = s.finishes || { floor: null, ceiling: null, skirting: null, walls: { A: null, B: null, C: null, D:null } };
      if (!finishes.walls || typeof finishes.walls !== 'object') throw Error('Acabados inválidos');
      const validFinish = (code, modes) => code == null || modes.includes(CATALOG_BY_CODE[code]?.mode);
      if (!validFinish(finishes.floor, ['floor']) || !validFinish(finishes.ceiling, ['ceiling']) ||!validFinish(finishes.skirting, ['skirting']) ||!Object.values(finishes.walls).every(c => validFinish(c, ['wall-finish'])))throw Error('Códigos de acabados incompatibles');

      // Sanitización estricta de entidades y cálculo seguro de nextId
      let maxId = Number.isSafeInteger(s.nextId) && s.nextId > 0 ? s.nextId - 1 : 0;
      const trackNumId = val => {
         const n = typeof val === 'number' ? val : Number(String(val).replace(/^(obj|service)-/, ''));
         if (Number.isSafeInteger(n) && n > maxId) maxId = n;
      };

      // Los ID se comparten entre entidades: rechazar colisiones y valores no canónicos.
      const seenIds = new Set();
      const uniqueId = (id, expectedPrefix = '') => {
        const key = String(id);
        if (seenIds.has(key) || (expectedPrefix && !new RegExp('^' + expectedPrefix + '-[1-9]\\d*
        if (!o || typeof o !== 'object' || !Number.isSafeInteger(o.id) || o.id < 1)
           throw Error('ID de abertura inválido');
        uniqueId(o.id);
        trackNumId(o.id);
        return {
           id: o.id,
           type: String(o.type),
           face: String(o.face),
           w: Number(o.w),
           h: Number(o.h),
           u: Number(o.u),
           v: Number(o.v),
           bars: Boolean(o.bars),
           catalogCode: o.catalogCode ? String(o.catalogCode) : null
        };
      });

      const cleanObjects = (s.objects || []).map(o => {




        if (!o || typeof o !== 'object' || typeof o.id !== 'string' || !o.id)
           throw Error('ID de objeto inválido');
        trackNumId(o.id);
        return {
           id: o.id,
           code: String(o.code),
           x: Number(o.x),
           y: Number(o.y),
           z: Number(o.z),
           w: Number(o.w),
           h: Number(o.h),
           d: Number(o.d),
           rot: Number(o.rot)
        };
      });

      const cleanServices = (s.services || []).map(srv => {
        if (!srv || typeof srv !== 'object' || typeof srv.id !== 'string' || !srv.id)
          throw Error('ID de servicio inválido');
        uniqueId(srv.id, 'service');
        trackNumId(srv.id);
        return { id: srv.id, code: String(srv.code) };
      });

      const cleanPartitions = s.partitions.map(p => ({
        length: Number(p.length),
        height: Number(p.height),
        thickness: Number(p.thickness),
        axis: String(p.axis),
        cx: Number(p.cx),
        cz: Number(p.cz)
      }));

      if (!Number.isSafeInteger(maxId + 1)) throw Error('Contador de objetos fuera de rango');
      Object.assign(state, {
        type: s.type,
        L: Number(s.L),
        W: Number(s.W),
        H: Number(s.H),
        color: s.color,
        openings: [],
        partitions: cleanPartitions,
        objects: cleanObjects,
        services: cleanServices,
        finishes: {
           floor: finishes.floor || null,
           ceiling: finishes.ceiling || null,
           skirting: finishes.skirting || null,
           walls: {
             A: finishes.walls.A || null,
             B: finishes.walls.B || null,
             C: finishes.walls.C || null,
             D: finishes.walls.D || null
           }
        },
        seeInside: !!s.seeInside,
        nextId: maxId + 1
      });

      for (const o of cleanOpenings) {
        if (!['door', 'window'].includes(o.type) || !['A', 'B', 'C', 'D'].includes(o.face) || validateOpening(o))throw Error('Abertura fuera de rango o superpuesta');
        state.openings.push(o);
      }
      for (const o of state.objects) if (objectError(o)) throw Error('Objeto inválido: ' + o.code);
      for (const o of state.services) if (CATALOG_BY_CODE[o.code]?.mode !== 'service') throw Error('Servicio inválido');
      for (const p of state.partitions) {
        if (![p.length, p.height, p.thickness, p.cx, p.cz].every(Number.isFinite) ||
            !['x', 'z'].includes(p.axis) || p.length <= 0 || p.height <= 0 ||
            p.thickness <= 0 || p.height > state.H) throw Error('Tabique inválido');
        const rx = p.axis === 'x' ? p.length / 2 : p.thickness / 2;
        const rz = p.axis === 'z' ? p.length / 2 : p.thickness / 2;
        if (Math.abs(p.cx) + rx > state.L / 2 || Math.abs(p.cz) + rz > state.W / 2)
          throw Error('Tabique fuera del contenedor');
      }

      selectedEntity = null;
      build();
      frameCamera();
      syncPanel();
      return { ok: true };
    } catch (error) {
      Object.assign(state, backup);
      selectedEntity = null;
      // La importación fallida no debe dejar desincronizados el modelo y el visor.
      try { build(); syncPanel(); } catch (restoreError) { console.error('[BAT-V2] Fallo al restaurar escena:', restoreError); }
      return { ok: false, error: String(error.message || error) };
    }
   }
};
window.Container3D = api;

/* ====================== Panel de demostración ====================== */
const $ = id => document.getElementById(id);
const num = id => parseFloat(String($(id).value).replace(',', '.'));
function syncPanel() {




  $('dL').value = state.L; $('dW').value = state.W; $('dH').value = state.H; $('dC').value = state.color;
  $('desc').textContent = TYPES[state.type].desc;
  document.querySelectorAll('#seg button').forEach(b => b.classList.toggle('on', b.dataset.t === state.type));
  $('oBars').checked = state.type === 'modular';
  $('xray').checked = state.seeInside;
  $('msg').textContent = '';
}
document.querySelectorAll('#seg button').forEach(b => {
   b.onclick = () => {
      if (state.type === b.dataset.t) return;
      const hasWork = state.objects.length || state.openings.length || state.partitions.length ||state.services.length || state.finishes.floor || state.finishes.ceiling ||state.finishes.skirting || Object.values(state.finishes.walls).some(Boolean);
      if (hasWork && !window.confirm('Cambiar el tipo de contenedor eliminará los elementos y acabados del diseño actual.¿Continuar?')) return;
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
try {
  editor = installEditor({ THREE, renderer, camera, controls, root, api, state, FACES, FLOOR, syncPanel });
} catch (error) {
  console.error('[BAT V2] No se pudo iniciar el editor:', error);
  document.getElementById('scene-hint').textContent = 'Error al iniciar el editor: ' + error.message;
}
(function loop() {
  requestAnimationFrame(loop);
  controls.update();
  if (state.seeInside) applyXray();
  renderer.render(scene, camera);
})();
).test(key)))
          throw Error('ID duplicado o inválido: ' + key);
        seenIds.add(key);
      };
      const cleanOpenings = s.openings.map(o => {
        if (!o || typeof o !== 'object' || !Number.isSafeInteger(o.id) || o.id < 1)
           throw Error('ID de abertura inválido');
        trackNumId(o.id);
        return {
           id: o.id,
           type: String(o.type),
           face: String(o.face),
           w: Number(o.w),
           h: Number(o.h),
           u: Number(o.u),
           v: Number(o.v),
           bars: Boolean(o.bars),
           catalogCode: o.catalogCode ? String(o.catalogCode) : null
        };
      });

      const cleanObjects = (s.objects || []).map(o => {




        if (!o || typeof o !== 'object' || typeof o.id !== 'string' || !o.id)
           throw Error('ID de objeto inválido');
        trackNumId(o.id);
        return {
           id: o.id,
           code: String(o.code),
           x: Number(o.x),
           y: Number(o.y),
           z: Number(o.z),
           w: Number(o.w),
           h: Number(o.h),
           d: Number(o.d),
           rot: Number(o.rot)
        };
      });

      const cleanServices = (s.services || []).map(srv => {
        if (!srv || typeof srv !== 'object' || typeof srv.id !== 'string' || !srv.id)
          throw Error('ID de servicio inválido');
        trackNumId(srv.id);
        return { id: srv.id, code: String(srv.code) };
      });

      const cleanPartitions = s.partitions.map(p => ({
        length: Number(p.length),
        height: Number(p.height),
        thickness: Number(p.thickness),
        axis: String(p.axis),
        cx: Number(p.cx),
        cz: Number(p.cz)
      }));

      Object.assign(state, {
        type: s.type,
        L: Number(s.L),
        W: Number(s.W),
        H: Number(s.H),
        color: s.color,
        openings: [],
        partitions: cleanPartitions,
        objects: cleanObjects,
        services: cleanServices,
        finishes: {
           floor: finishes.floor || null,
           ceiling: finishes.ceiling || null,
           skirting: finishes.skirting || null,
           walls: {
             A: finishes.walls.A || null,
             B: finishes.walls.B || null,
             C: finishes.walls.C || null,
             D: finishes.walls.D || null
           }
        },
        seeInside: !!s.seeInside,
        nextId: maxId + 1
      });

      for (const o of cleanOpenings) {
        if (!['door', 'window'].includes(o.type) || !['A', 'B', 'C', 'D'].includes(o.face) || validateOpening(o))throw Error('Abertura fuera de rango o superpuesta');
        state.openings.push(o);
      }
      for (const o of state.objects) if (objectError(o)) throw Error('Objeto inválido: ' + o.code);
      for (const o of state.services) if (CATALOG_BY_CODE[o.code]?.mode !== 'service') throw Error('Servicio inválido');
      for (const p of state.partitions) {
        if (![p.length, p.height, p.thickness, p.cx, p.cz].every(Number.isFinite) || p.height > state.H || p.height <= 0)throw Error('Tabique inválido');
      }

      selectedEntity = null;
      build();
      frameCamera();
      syncPanel();
      return { ok: true };
    } catch (error) {
      Object.assign(state, backup);
      // La importación fallida no debe dejar desincronizados el modelo y el visor.
      try { build(); syncPanel(); } catch (restoreError) { console.error('[BAT-V2] Fallo al restaurar escena:', restoreError); }
      return { ok: false, error: String(error.message || error) };
    }
   }
};
window.Container3D = api;

/* ====================== Panel de demostración ====================== */
const $ = id => document.getElementById(id);
const num = id => parseFloat(String($(id).value).replace(',', '.'));
function syncPanel() {




  $('dL').value = state.L; $('dW').value = state.W; $('dH').value = state.H; $('dC').value = state.color;
  $('desc').textContent = TYPES[state.type].desc;
  document.querySelectorAll('#seg button').forEach(b => b.classList.toggle('on', b.dataset.t === state.type));
  $('oBars').checked = state.type === 'modular';
  $('xray').checked = state.seeInside;
  $('msg').textContent = '';
}
document.querySelectorAll('#seg button').forEach(b => {
   b.onclick = () => {
      if (state.type === b.dataset.t) return;
      const hasWork = state.objects.length || state.openings.length || state.partitions.length ||state.services.length || state.finishes.floor || state.finishes.ceiling ||state.finishes.skirting || Object.values(state.finishes.walls).some(Boolean);
      if (hasWork && !window.confirm('Cambiar el tipo de contenedor eliminará los elementos y acabados del diseño actual.¿Continuar?')) return;
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
try {
  editor = installEditor({ THREE, renderer, camera, controls, root, api, state, FACES, FLOOR, syncPanel });
} catch (error) {
  console.error('[BAT V2] No se pudo iniciar el editor:', error);
  document.getElementById('scene-hint').textContent = 'Error al iniciar el editor: ' + error.message;
}
(function loop() {
  requestAnimationFrame(loop);
  controls.update();
  if (state.seeInside) applyXray();
  renderer.render(scene, camera);
})();
