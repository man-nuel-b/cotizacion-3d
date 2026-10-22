// Direct 3D editor layer for the modular configurator.
// Loaded after app.js so it can reuse the existing scene helpers and component factories.

let editableObjects = [];
let selectedEditable = null;
let draggingEditable = null;
let dragStartLayout = null;
let editorRaycaster = null;
let editorPointer = null;
let dragPlane = null;
let dragMoved = false;
let editorInstalled = false;

function ensureLayoutState() {
  if (!state.layout) state.layout = {};
  ['window','door','partition','wc','sink','shower','ac'].forEach(type => {
    if (!Array.isArray(state.layout[type])) state.layout[type] = [];
  });
}

function layoutValue(type, index, fallback) {
  ensureLayoutState();
  return { ...fallback, ...(state.layout[type][index] || {}) };
}

function saveLayoutValue(type, index, value, withHistory = false) {
  ensureLayoutState();
  if (withHistory) pushHistory();
  state.layout[type][index] = { ...value };
}

function clearInvalidLayoutEntries() {
  ensureLayoutState();
  Object.keys(state.layout).forEach(type => {
    const count = state.counts[type] || 0;
    state.layout[type] = state.layout[type].slice(0, count);
  });
}

function registerEditable(group, type, index, position, config = {}) {
  group.userData.editor = { type, index, ...config };
  group.traverse(obj => {
    obj.userData.editorRoot = group;
  });
  editableObjects.push(group);
  if (selectedEditable && selectedEditable.type === type && selectedEditable.index === index) addSelectionOutline(group);
  return group;
}

function addSelectionOutline(group) {
  const box3 = new THREE.Box3().setFromObject(group);
  if (box3.isEmpty()) return;
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box3.getSize(size); box3.getCenter(center);
  const localCenter = group.worldToLocal(center.clone());
  const geo = new THREE.BoxGeometry(Math.max(.12,size.x+.08), Math.max(.12,size.y+.08), Math.max(.12,size.z+.08));
  const edges = new THREE.EdgesGeometry(geo);
  const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xf59e0b, depthTest: false, transparent: true, opacity: .95 }));
  line.position.copy(localCenter);
  line.renderOrder = 999;
  line.userData.selectionHelper = true;
  group.add(line);
}

function defaultWallX(index, count, length, padding) {
  return slotPosition(index, count, length, padding);
}

function validCandidate(type, index, candidate) {
  const c = DATA.containers[state.container];
  const bounds = {
    window: { minX: -c.length/2 + .72, maxX: c.length/2 - .72, gap: 1.22 },
    door: { minX: -c.length/2 + .58, maxX: c.length/2 - .58, gap: 1.02 },
    partition: { minX: -c.length/2 + .55, maxX: c.length/2 - .55, gap: .45 },
    ac: { minX: -c.length/2 + .55, maxX: c.length/2 - .55, gap: .95 }
  };
  if (bounds[type]) {
    if (candidate.x < bounds[type].minX || candidate.x > bounds[type].maxX) return false;
    const siblings = state.layout[type] || [];
    for (let i = 0; i < (state.counts[type] || 0); i++) {
      if (i === index) continue;
      const fallbackX = defaultWallX(i, state.counts[type], c.length, type === 'door' ? 1 : .9);
      const otherX = (siblings[i] && Number.isFinite(siblings[i].x)) ? siblings[i].x : fallbackX;
      if (Math.abs(otherX - candidate.x) < bounds[type].gap) return false;
    }
  }
  if (['wc','sink','shower'].includes(type)) {
    if (candidate.x < -c.length/2 + .48 || candidate.x > c.length/2 - .48) return false;
    if (candidate.z < -c.width/2 + .38 || candidate.z > c.width/2 - .38) return false;
    const sanitaryTypes = ['wc','sink','shower'];
    for (const otherType of sanitaryTypes) {
      const arr = state.layout[otherType] || [];
      for (let i = 0; i < (state.counts[otherType] || 0); i++) {
        if (otherType === type && i === index) continue;
        const other = arr[i];
        if (!other) continue;
        const dx = other.x - candidate.x, dz = other.z - candidate.z;
        if (Math.hypot(dx,dz) < .68) return false;
      }
    }
  }
  return true;
}

function editorPositionLabel(type, pos) {
  if (['wc','sink','shower'].includes(type)) return `X ${pos.x.toFixed(2)} m · Z ${pos.z.toFixed(2)} m`;
  return `X ${pos.x.toFixed(2)} m`;
}

function typeLabel(type) {
  return ({window:'Ventana termopanel',door:'Puerta peatonal',partition:'División interior',wc:'WC',sink:'Lavamanos',shower:'Ducha',ac:'Aire acondicionado'})[type] || type;
}

function showEditorPanel(root) {
  const panel = document.getElementById('object-editor');
  if (!panel || !root) return;
  const meta = root.userData.editor;
  const pos = layoutValue(meta.type, meta.index, root.position);
  document.getElementById('editor-title').textContent = typeLabel(meta.type);
  document.getElementById('editor-subtitle').textContent = `Elemento ${meta.index + 1} · ${editorPositionLabel(meta.type, pos)}`;
  panel.classList.remove('hidden');
}

function hideEditorPanel() {
  document.getElementById('object-editor')?.classList.add('hidden');
}

function deleteSelectedObject() {
  if (!selectedEditable) return;
  const { type, index } = selectedEditable;
  if (!state.counts[type]) return;
  pushHistory();
  state.counts[type] = Math.max(0, state.counts[type] - 1);
  ensureLayoutState();
  state.layout[type].splice(index, 1);
  selectedEditable = null;
  hideEditorPanel();
  renderAll();
  toast(`${typeLabel(type)} eliminado`);
}

function nudgeSelected(dx = 0, dz = 0) {
  if (!selectedEditable) return;
  const { type, index } = selectedEditable;
  const root = editableObjects.find(o => o.userData.editor?.type === type && o.userData.editor?.index === index);
  if (!root) return;
  const current = layoutValue(type, index, { x: root.position.x, z: root.position.z });
  const candidate = { ...current, x: current.x + dx };
  if (['wc','sink','shower'].includes(type)) candidate.z = (current.z || 0) + dz;
  if (!validCandidate(type, index, candidate)) return toast('Esa posición no es válida');
  saveLayoutValue(type, index, candidate, true);
  renderAll();
  toast('Posición ajustada');
}

function resetSelectedPosition() {
  if (!selectedEditable) return;
  const { type, index } = selectedEditable;
  pushHistory();
  ensureLayoutState();
  state.layout[type][index] = undefined;
  renderAll();
  toast('Posición automática restaurada');
}

// Replace only the arrangement layer. All visual component factories still come from app.js.
rebuild3D = function() {
  if (!containerGroup) return;
  ensureLayoutState(); clearInvalidLayoutEntries();
  disposeGroup(containerGroup);
  editableObjects = [];
  const c = DATA.containers[state.container];
  const extColor = new THREE.Color(state.exteriorColor);
  const materials = {
    exterior: mat(extColor, { roughness: .58, metalness: .2 }),
    interior: mat(state.finish === 'sanitary' ? 0xf8fafc : 0xf1f5f9, { roughness: state.finish === 'sanitary' ? .32 : .82 }),
    frame: mat(new THREE.Color(extColor).multiplyScalar(.55), { roughness: .42, metalness: .48 }),
    floor: createFloorMaterial()
  };
  containerGroup.add(createContainerShell(c, materials));

  const winCount = state.counts.window || 0;
  for (let i=0;i<winCount;i++) {
    const p = layoutValue('window', i, { x: defaultWallX(i,winCount,c.length,.9) });
    const obj = createWindow(); addGroup(containerGroup,obj,p.x,c.height*.60,-c.width/2-.075,0);
    registerEditable(obj,'window',i,p,{ axis:'x', surface:'rear' });
  }
  const doorCount = state.counts.door || 0;
  for (let i=0;i<doorCount;i++) {
    const p = layoutValue('door', i, { x: defaultWallX(i,doorCount,c.length,1) });
    const obj = createDoor(); addGroup(containerGroup,obj,p.x,1.06,c.width/2+.07,0);
    registerEditable(obj,'door',i,p,{ axis:'x', surface:'front' });
  }
  const partitionCount = state.counts.partition || 0;
  for (let i=0;i<partitionCount;i++) {
    const fallback = -c.length/2 + ((i+1)*c.length/(partitionCount+1));
    const p = layoutValue('partition', i, { x:fallback });
    const obj = createPartition(c.width-.2,c.height-.15); addGroup(containerGroup,obj,p.x,.08,0);
    registerEditable(obj,'partition',i,p,{ axis:'x', surface:'floor' });
  }

  const sanitaryDefaults = [];
  for (let i=0;i<(state.counts.wc||0);i++) sanitaryDefaults.push(['wc',i]);
  for (let i=0;i<(state.counts.sink||0);i++) sanitaryDefaults.push(['sink',i]);
  for (let i=0;i<(state.counts.shower||0);i++) sanitaryDefaults.push(['shower',i]);
  const cols = Math.max(1, Math.min(c.length > 8 ? 5 : 3, Math.ceil(Math.sqrt(sanitaryDefaults.length || 1))));
  sanitaryDefaults.forEach(([type,index], globalIndex) => {
    const row=Math.floor(globalIndex/cols), col=globalIndex%cols;
    const fallback={ x:clamp(-c.length*.28+col*1.05,-c.length/2+.65,c.length/2-.65), z:clamp(-.55+row*.95,-c.width/2+.46,c.width/2-.46) };
    const p=layoutValue(type,index,fallback);
    const obj=type==='wc'?createWC():type==='sink'?createSink():createShower();
    addGroup(containerGroup,obj,p.x,.08,p.z,type==='sink'?Math.PI:0);
    registerEditable(obj,type,index,p,{ axis:'xz', surface:'floor' });
  });

  const acCount=state.counts.ac||0;
  for (let i=0;i<acCount;i++) {
    const p=layoutValue('ac',i,{x:defaultWallX(i,acCount,c.length,1)});
    const indoor=createSplitAC(); addGroup(containerGroup,indoor,p.x,c.height-.42,-c.width/2+.17);
    registerEditable(indoor,'ac',i,p,{axis:'x',surface:'rear'});
    addGroup(containerGroup,createCondenser(),p.x,.08,c.width/2+.28);
  }

  const lightCount=Math.max(1,Math.ceil((state.counts.electrical||0)/3));
  for(let i=0;i<lightCount;i++) addGroup(containerGroup,createCeilingLight(),slotPosition(i,lightCount,c.length,.7),c.height-.1,0);
  addFurnishings(containerGroup,c);
  if(state.showPeople) addGroup(containerGroup,createHuman(),c.length*.28,.08,state.cutaway?c.width*.24:c.width/2+.75,state.cutaway?Math.PI:-Math.PI/2);
  controls?.target.set(0,c.height*.45,0);
  updateLighting();
  const selectedRoot=selectedEditable&&editableObjects.find(o=>o.userData.editor?.type===selectedEditable.type&&o.userData.editor?.index===selectedEditable.index);
  if(selectedRoot) showEditorPanel(selectedRoot);
};

function editableRootFromIntersection(object) {
  let node = object;
  while (node) {
    if (node.userData?.editor) return node;
    if (node.userData?.editorRoot) return node.userData.editorRoot;
    node = node.parent;
  }
  return null;
}

function pointerNDC(event) {
  const rect=renderer.domElement.getBoundingClientRect();
  editorPointer.x=((event.clientX-rect.left)/rect.width)*2-1;
  editorPointer.y=-((event.clientY-rect.top)/rect.height)*2+1;
}

function hitEditable(event) {
  pointerNDC(event); editorRaycaster.setFromCamera(editorPointer,camera);
  const hits=editorRaycaster.intersectObjects(editableObjects,true);
  return hits.length?editableRootFromIntersection(hits[0].object):null;
}

function planeForEditable(root) {
  const meta=root.userData.editor;
  if(meta.axis==='xz') return new THREE.Plane(new THREE.Vector3(0,1,0),-.08);
  if(meta.surface==='front') return new THREE.Plane(new THREE.Vector3(0,0,1),-(DATA.containers[state.container].width/2+.07));
  if(meta.surface==='rear') return new THREE.Plane(new THREE.Vector3(0,0,1),DATA.containers[state.container].width/2-.07);
  return new THREE.Plane(new THREE.Vector3(0,1,0),-.08);
}

function onEditorPointerDown(event) {
  if (event.button !== 0 || isPresentation) return;
  const root=hitEditable(event);
  if(!root){ selectedEditable=null; hideEditorPanel(); rebuild3D(); return; }
  const meta=root.userData.editor;
  selectedEditable={type:meta.type,index:meta.index};
  draggingEditable=root; dragPlane=planeForEditable(root); dragMoved=false;
  dragStartLayout=clone(layoutValue(meta.type,meta.index,{x:root.position.x,z:root.position.z}));
  controls.enabled=false;
  renderer.domElement.setPointerCapture?.(event.pointerId);
  showEditorPanel(root); rebuild3D();
  event.preventDefault();
}

function onEditorPointerMove(event) {
  if(!draggingEditable) return;
  pointerNDC(event); editorRaycaster.setFromCamera(editorPointer,camera);
  const point=new THREE.Vector3();
  if(!editorRaycaster.ray.intersectPlane(dragPlane,point)) return;
  const {type,index}=draggingEditable.userData.editor;
  const current=layoutValue(type,index,{x:draggingEditable.position.x,z:draggingEditable.position.z});
  const candidate={...current,x:Math.round(point.x*20)/20};
  if(['wc','sink','shower'].includes(type)) candidate.z=Math.round(point.z*20)/20;
  if(!validCandidate(type,index,candidate)) return;
  dragMoved=true; saveLayoutValue(type,index,candidate,false);
  draggingEditable.position.x=candidate.x;
  if(['wc','sink','shower'].includes(type)) draggingEditable.position.z=candidate.z;
  document.getElementById('editor-subtitle').textContent=`Elemento ${index+1} · ${editorPositionLabel(type,candidate)}`;
}

function onEditorPointerUp(event) {
  if(!draggingEditable) return;
  controls.enabled=true;
  renderer.domElement.releasePointerCapture?.(event.pointerId);
  if(dragMoved){ history.push({ ...clone(state), layout:{...clone(state.layout), [draggingEditable.userData.editor.type]:clone(state.layout[draggingEditable.userData.editor.type])} }); history.pop(); /* keep history stack clean */
    // add pre-drag state once, so undo returns to the exact prior location
    const after=clone(state); state.layout[draggingEditable.userData.editor.type][draggingEditable.userData.editor.index]=dragStartLayout; pushHistory(); state=after; toast('Posición actualizada'); }
  draggingEditable=null; dragPlane=null; dragStartLayout=null; renderAll();
}

function installDirectEditor() {
  if(editorInstalled || !renderer?.domElement) return;
  editorInstalled=true; ensureLayoutState();
  editorRaycaster=new THREE.Raycaster(); editorPointer=new THREE.Vector2();
  const canvas=renderer.domElement;
  canvas.addEventListener('pointerdown',onEditorPointerDown);
  canvas.addEventListener('pointermove',onEditorPointerMove);
  canvas.addEventListener('pointerup',onEditorPointerUp);
  canvas.addEventListener('pointercancel',onEditorPointerUp);
  window.addEventListener('keydown',event=>{
    if(!selectedEditable) return;
    if(event.key==='Delete'||event.key==='Backspace'){ if(!['INPUT','TEXTAREA'].includes(document.activeElement?.tagName)){event.preventDefault();deleteSelectedObject();} }
    const step=event.shiftKey?.2:.05;
    if(event.key==='ArrowLeft'){event.preventDefault();nudgeSelected(-step,0);}
    if(event.key==='ArrowRight'){event.preventDefault();nudgeSelected(step,0);}
    if(event.key==='ArrowUp'&&['wc','sink','shower'].includes(selectedEditable.type)){event.preventDefault();nudgeSelected(0,-step);}
    if(event.key==='ArrowDown'&&['wc','sink','shower'].includes(selectedEditable.type)){event.preventDefault();nudgeSelected(0,step);}
  });
  rebuild3D();
}

window.addEventListener('DOMContentLoaded',()=>setTimeout(installDirectEditor,0));
