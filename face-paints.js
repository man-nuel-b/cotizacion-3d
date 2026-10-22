// Visual face treatment for bat-kubiqueitor.
// Loaded after editor.js / faces-mounted.js so A/B/C/D are painted on the container
// instead of being shown as floating labels.

function createPaintedFace(face,c){
  const group=new THREE.Group();
  const color=new THREE.Color(CONTAINER_FACES[face].color);
  const isLong=face==='A'||face==='B';
  const width=(isLong?c.length:c.width)*.965;
  const height=c.height*.82;

  const fillMaterial=new THREE.MeshBasicMaterial({
    color,
    transparent:true,
    opacity:.16,
    side:THREE.DoubleSide,
    depthWrite:false,
    polygonOffset:true,
    polygonOffsetFactor:-2,
    polygonOffsetUnits:-2
  });

  const geometry=new THREE.PlaneGeometry(width,height);
  const fill=new THREE.Mesh(geometry,fillMaterial);
  fill.renderOrder=105;
  fill.userData.facePaint=true;
  fill.userData.containerFace=face;

  const edges=new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry),
    new THREE.LineBasicMaterial({
      color,
      transparent:true,
      opacity:.56,
      depthTest:true
    })
  );
  edges.renderOrder=106;
  edges.userData.facePaint=true;
  edges.userData.containerFace=face;

  group.add(fill,edges);
  group.userData.facePaint=true;
  group.userData.containerFace=face;

  const y=c.height*.51;
  const offset=.088;
  if(face==='A'){
    group.position.set(0,y,c.width/2+offset);
    group.rotation.y=Math.PI;
  }else if(face==='B'){
    group.position.set(0,y,-c.width/2-offset);
  }else if(face==='C'){
    group.position.set(c.length/2+offset,y,0);
    group.rotation.y=-Math.PI/2;
  }else{
    group.position.set(-c.length/2-offset,y,0);
    group.rotation.y=Math.PI/2;
  }

  return group;
}

// Keep the old function name because both editor.js and faces-mounted.js call it.
// Its implementation is now paint-only: no sprites, cards or floating text.
addFaceLabels=function(parent,c){
  if(!faceLabelsVisible) return;
  ['A','B','C','D'].forEach(face=>parent.add(createPaintedFace(face,c)));
};

// Keep the existing visibility control, but rename it visually for the user.
toggleFaceLabels=function(){
  faceLabelsVisible=!faceLabelsVisible;
  rebuild3D();
  const btn=document.getElementById('face-label-toggle');
  if(btn){
    btn.classList.toggle('opacity-50',!faceLabelsVisible);
    btn.innerHTML='<i class="fa-solid fa-fill-drip mr-1"></i> Caras pintadas';
    btn.title=faceLabelsVisible?'Ocultar colores de caras':'Mostrar colores de caras';
  }
};

function refreshFacePaintButton(){
  const btn=document.getElementById('face-label-toggle');
  if(!btn) return;
  btn.innerHTML='<i class="fa-solid fa-fill-drip mr-1"></i> Caras pintadas';
  btn.title='Mostrar u ocultar los colores de las caras A, B, C y D';
}

window.addEventListener('DOMContentLoaded',()=>{
  setTimeout(()=>{
    refreshFacePaintButton();
    // The initial rebuild can happen before this final visual layer is installed.
    // Rebuild once so the first frame already uses painted faces.
    if(typeof rebuild3D==='function') rebuild3D();
  },20);
});
