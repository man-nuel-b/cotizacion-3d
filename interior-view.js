// Improved interior camera for bat-kubiqueitor.
// Loaded after the geometry layers so the Interior button always gets the final camera behavior.

const setViewBeforeInteriorZoomOut=setView;

function configureExpandedInteriorCamera(){
  if(!camera||!controls) return;
  camera.fov=68;
  camera.updateProjectionMatrix();
  controls.enablePan=false;
  controls.minDistance=.65;
  controls.maxDistance=8.5;
  controls.rotateSpeed=.48;
  controls.zoomSpeed=.75;
}

setView=function(view,animateIt=true){
  if(view!=='interior') return setViewBeforeInteriorZoomOut(view,animateIt);
  if(!camera||!controls) return;

  const c=DATA.containers[state.container];
  currentView='interior';

  // Interior must use the closed container geometry, not the cutaway/top shell.
  if(state.cutaway){
    state.cutaway=false;
    rebuild3D();
  }

  configureExpandedInteriorCamera();

  const eye=clamp(c.height*.55,1.48,1.60);
  // Move the camera farther back, almost against the interior end wall.
  // This gives an immediate wide overview instead of landing near furniture.
  const cameraX=-c.length/2+.30;
  const targetX=c.length>8?Math.min(c.length/2-1.0,c.length*.20):Math.min(c.length/2-.75,c.length*.16);
  const pos=[cameraX,eye,.02];
  const target=[targetX,eye-.10,0];

  const mode=document.getElementById('scene-mode-label');
  if(mode) mode.textContent='Interior · vista amplia';

  if(animateIt){
    animateCamera(pos,target,720);
  }else{
    camera.position.set(...pos);
    controls.target.set(...target);
    camera.lookAt(controls.target);
    controls.update();
  }
};

// Keep +/- useful in the wider interior mode.
const zoomCameraBeforeInteriorZoomOut=zoomCamera;
zoomCamera=function(direction){
  if(currentView!=='interior') return zoomCameraBeforeInteriorZoomOut(direction);
  if(!camera||!controls) return;

  const offset=camera.position.clone().sub(controls.target);
  const distance=offset.length();
  const factor=direction>0?.80:1.25;
  const next=clamp(distance*factor,.70,8.2);
  if(Math.abs(next-distance)<.01) return;

  const newPos=controls.target.clone().add(offset.normalize().multiplyScalar(next));
  animateCamera(newPos.toArray(),controls.target.toArray(),240);
};
