// Direct 3D manipulation for preset bathroom modules.
(function(){
  if(window.BAT_KUBIQUEITOR_BATHROOM_DRAG_FIX) return;

  const SIZE={full:{width:2.02,depth:1.12},half:{width:1.38,depth:1.02}};
  let raycaster,pointer,plane,active=null,startState=null,startX=0,startRotation=0;

  function roots(){return (containerGroup?.children||[]).filter(o=>o.userData?.bathroomPresetRoot);}
  function normalizeRot(v){let r=Math.round((Number(v)||0)/90)*90%360;return r<0?r+360:r;}
  function moduleSize(m,rot=m.rotation||0){const s=SIZE[m.kind]||SIZE.half,swap=normalizeRot(rot)%180===90;return {width:swap?s.depth:s.width,depth:swap?s.width:s.depth};}
  function valid(index,x,z,rot){
    const m=state.bathroomModules?.[index]; if(!m) return false;
    const c=DATA.containers[state.container],s=moduleSize(m,rot);
    if(x-s.width/2<-c.length/2+.12||x+s.width/2>c.length/2-.12)return false;
    if(z-s.depth/2<-c.width/2+.10||z+s.depth/2>c.width/2-.10)return false;
    for(let i=0;i<(state.bathroomModules||[]).length;i++){
      if(i===index)continue;
      const o=state.bathroomModules[i],os=moduleSize(o,o.rotation||0);
      const hit=Math.abs(x-(Number(o.x)||0))<(s.width+os.width)/2+.08&&Math.abs(z-(Number(o.z)||0))<(s.depth+os.depth)/2+.08;
      if(hit)return false;
    }
    return true;
  }
  function setPointer(e){const r=renderer.domElement.getBoundingClientRect();pointer.x=((e.clientX-r.left)/r.width)*2-1;pointer.y=-((e.clientY-r.top)/r.height)*2+1;}
  function floorPoint(e){setPointer(e);raycaster.setFromCamera(pointer,camera);const p=new THREE.Vector3();plane.set(new THREE.Vector3(0,1,0),0);return raycaster.ray.intersectPlane(plane,p)?p:null;}
  function rootFromObject(o){let n=o;while(n){if(n.userData?.bathroomPresetRoot)return n;if(n.userData?.bathroomModuleRoot)return n.userData.bathroomModuleRoot;n=n.parent;}return null;}
  function ensureGrabSurface(root){
    if(root.children.some(c=>c.userData?.bathroomGrabSurface))return;
    const i=root.userData.bathroomModuleIndex,m=state.bathroomModules?.[i];if(!m)return;
    const s=SIZE[m.kind]||SIZE.half;
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(s.width,.22,s.depth),new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}));
    mesh.position.y=.22;mesh.userData.bathroomGrabSurface=true;mesh.userData.bathroomModuleRoot=root;root.add(mesh);
  }
  function refreshGrabSurfaces(){roots().forEach(ensureGrabSurface);}
  function hitModule(e){refreshGrabSurfaces();setPointer(e);raycaster.setFromCamera(pointer,camera);const hits=raycaster.intersectObjects(roots(),true);return hits.length?rootFromObject(hits[0].object):null;}

  function pointerDown(e){
    if(!renderer?.domElement||e.target!==renderer.domElement||e.button!==0)return;
    const root=hitModule(e);if(!root)return;
    const index=root.userData.bathroomModuleIndex,m=state.bathroomModules?.[index];if(!m)return;
    const p=floorPoint(e);if(!p)return;
    e.preventDefault();e.stopPropagation();e.stopImmediatePropagation?.();
    active={root,index,mode:e.shiftKey?'rotate':'move',offsetX:(Number(m.x)||0)-p.x,offsetZ:(Number(m.z)||0)-p.z,pointerId:e.pointerId};
    startState=typeof clone==='function'?clone(state):JSON.parse(JSON.stringify(state));
    startX=e.clientX;startRotation=normalizeRot(m.rotation||0);
    if(controls)controls.enabled=false;
    renderer.domElement.setPointerCapture?.(e.pointerId);
    renderer.domElement.style.cursor=active.mode==='rotate'?'ew-resize':'grabbing';
  }
  function pointerMove(e){
    if(!active)return;
    e.preventDefault();e.stopPropagation();
    const m=state.bathroomModules?.[active.index];if(!m)return;
    if(active.mode==='move'){
      const p=floorPoint(e);if(!p)return;
      const x=Math.round((p.x+active.offsetX)*20)/20,z=Math.round((p.z+active.offsetZ)*20)/20;
      if(!valid(active.index,x,z,m.rotation||0))return;
      m.x=x;m.z=z;active.root.position.x=x;active.root.position.z=z;
    }else{
      const dx=e.clientX-startX;
      const steps=Math.round(dx/55);
      const next=normalizeRot(startRotation+steps*90);
      if(next===normalizeRot(m.rotation||0))return;
      if(!valid(active.index,Number(m.x)||0,Number(m.z)||0,next))return;
      m.rotation=next;active.root.rotation.y=THREE.MathUtils.degToRad(next);
    }
  }
  function finish(e){
    if(!active)return;
    e.preventDefault();e.stopPropagation();
    if(controls)controls.enabled=true;
    renderer.domElement.releasePointerCapture?.(active.pointerId);
    renderer.domElement.style.cursor='';
    const changed=JSON.stringify(startState?.bathroomModules||[])!==JSON.stringify(state.bathroomModules||[]);
    if(changed&&startState&&Array.isArray(history)){
      history.push(startState);if(history.length>40)history.shift();
      if(Array.isArray(future))future=[];
      if(typeof toast==='function')toast(active.mode==='rotate'?'Módulo girado':'Módulo reubicado');
    }
    active=null;startState=null;
  }
  function contextMenu(e){
    if(e.target!==renderer?.domElement)return;
    const root=hitModule(e);if(root)e.preventDefault();
  }
  function install(){
    if(!renderer?.domElement||typeof THREE==='undefined')return false;
    raycaster=new THREE.Raycaster();pointer=new THREE.Vector2();plane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
    window.addEventListener('pointerdown',pointerDown,true);
    window.addEventListener('pointermove',pointerMove,true);
    window.addEventListener('pointerup',finish,true);
    window.addEventListener('pointercancel',finish,true);
    window.addEventListener('contextmenu',contextMenu,true);
    setInterval(refreshGrabSurfaces,300);refreshGrabSurfaces();
    window.BAT_KUBIQUEITOR_BATHROOM_DRAG_FIX={version:1};
    return true;
  }
  let tries=0;const timer=setInterval(()=>{tries++;if(install()||tries>40)clearInterval(timer);},50);
})();
