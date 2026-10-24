// Technical electrical visualization and takeoff for bat-kubiqueitor.
// Keeps client view clean; technical mode renders surface conduit, junction boxes and live metering.
(function(){
  if(window.BAT_KUBIQUEITOR_ELECTRICAL_TECHNICAL?.version>=1) return;

  const ROOT_NAME='electrical-technical-root';
  const CONDUIT_RADIUS=.014;
  const TOP_CLEARANCE=.11;
  const EXTRA_FACTOR=1.10;
  let visible=false;
  let lastSignature='';
  let installed=false;

  function ready(){
    return typeof THREE!=='undefined'&&typeof state!=='undefined'&&typeof DATA!=='undefined'&&typeof actualLayout==='function'&&typeof containerGroup!=='undefined'&&containerGroup;
  }

  function container(){return DATA.containers[state.container];}

  function mountedPoint(type,index,height){
    const c=container(),layout=actualLayout(type,index)||{},face=layout.face||'A',offset=Number(layout.x)||0;
    if(face==='A') return new THREE.Vector3(offset,height,c.width/2-.045);
    if(face==='B') return new THREE.Vector3(offset,height,-c.width/2+.045);
    if(face==='C') return new THREE.Vector3(c.length/2-.045,height,offset);
    return new THREE.Vector3(-c.length/2+.045,height,offset);
  }

  function boardPoint(){
    const c=container();
    return new THREE.Vector3(-c.length/2+.36,1.55,c.width/2-.055);
  }

  function lightPoint(index){
    const c=container(),p=actualLayout('electricalLight',index)||{};
    return new THREE.Vector3(Number(p.x)||0,c.height-TOP_CLEARANCE,Number(p.z)||0);
  }

  function points(){
    const list=[];
    for(let i=0;i<(state.counts?.electrical||0);i++) list.push({id:`E${i+1}`,kind:'outlet',circuit:'C2',point:mountedPoint('electrical',i,.30)});
    for(let i=0;i<(state.counts?.electricalSwitch||0);i++) list.push({id:`I${i+1}`,kind:'switch',circuit:'C1',point:mountedPoint('electricalSwitch',i,1.10)});
    for(let i=0;i<(state.counts?.electricalLight||0);i++) list.push({id:`L${i+1}`,kind:'light',circuit:'C1',point:lightPoint(i)});
    return list;
  }

  function ceilingTarget(point){
    const c=container();
    return new THREE.Vector3(point.x,c.height-TOP_CLEARANCE,point.z);
  }

  function routeFor(target){
    const c=container(),board=boardPoint(),topY=c.height-TOP_CLEARANCE;
    const startTop=new THREE.Vector3(board.x,topY,board.z);
    const centerEntry=new THREE.Vector3(board.x,topY,0);
    const targetCenter=new THREE.Vector3(target.x,topY,0);
    const targetTop=ceilingTarget(target);
    const route=[board.clone(),startTop,centerEntry,targetCenter,targetTop];
    if(Math.abs(target.y-topY)>.02) route.push(target.clone());
    return route.filter((p,i,a)=>i===0||p.distanceTo(a[i-1])>.015);
  }

  function segmentLength(points){
    let total=0;for(let i=1;i<points.length;i++) total+=points[i].distanceTo(points[i-1]);return total;
  }

  function calculate(){
    if(!ready()) return {conduit:0,c1Conductor:0,c2Conductor:0,boxes:0,routes:[]};
    const routes=points().map(item=>({...item,route:routeFor(item.point)}));
    let conduit=0,c1=0,c2=0;
    routes.forEach(item=>{
      const len=segmentLength(item.route);
      conduit+=len;
      if(item.circuit==='C1') c1+=len; else c2+=len;
    });
    const estimate={
      conduit:Number((conduit*EXTRA_FACTOR).toFixed(2)),
      c1Conductor:Number((c1*3*EXTRA_FACTOR).toFixed(2)),
      c2Conductor:Number((c2*3*EXTRA_FACTOR).toFixed(2)),
      boxes:routes.length,
      routes
    };
    state.electricalEstimate={
      conduitM:estimate.conduit,
      conductorC1M:estimate.c1Conductor,
      conductorC2M:estimate.c2Conductor,
      junctionBoxes:estimate.boxes,
      method:'Estimación preliminar de canalización superficial; validar dimensionamiento final con instalador autorizado SEC.'
    };
    return estimate;
  }

  function disposeRoot(){
    const old=containerGroup?.children?.find(child=>child.name===ROOT_NAME);
    if(!old) return;
    old.traverse(obj=>{obj.geometry?.dispose?.();if(Array.isArray(obj.material))obj.material.forEach(m=>m?.dispose?.());else obj.material?.dispose?.();});
    containerGroup.remove(old);
  }

  function conduitBetween(a,b,material){
    const delta=new THREE.Vector3().subVectors(b,a),len=delta.length();
    if(len<.02) return null;
    const mesh=new THREE.Mesh(new THREE.CylinderGeometry(CONDUIT_RADIUS,CONDUIT_RADIUS,len,12),material);
    mesh.position.copy(a).add(b).multiplyScalar(.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.clone().normalize());
    mesh.userData.electricalConduit=true;
    return mesh;
  }

  function junctionBox(point,material){
    const box=new THREE.Mesh(new THREE.BoxGeometry(.09,.055,.09),material);
    box.position.copy(point);
    box.userData.electricalJunctionBox=true;
    return box;
  }

  function render(){
    if(!ready()) return;
    disposeRoot();
    const estimate=calculate();
    updateInfo(estimate);
    if(!visible) return;

    const root=new THREE.Group();root.name=ROOT_NAME;root.userData.electricalTechnical=true;
    const conduitMat=new THREE.MeshStandardMaterial({color:0xd1d5db,roughness:.58,metalness:.08});
    const boxMat=new THREE.MeshStandardMaterial({color:0x9ca3af,roughness:.52,metalness:.10});

    estimate.routes.forEach(item=>{
      for(let i=1;i<item.route.length;i++){
        const seg=conduitBetween(item.route[i-1],item.route[i],conduitMat.clone());
        if(seg) root.add(seg);
      }
      const top=item.route[item.route.length>2?item.route.length-2:0];
      if(top) root.add(junctionBox(top,boxMat.clone()));
    });
    containerGroup.add(root);
  }

  function signature(){
    if(!ready()) return '';
    const layouts={
      e:state.layout?.electrical||[],
      s:state.layout?.electricalSwitch||[],
      l:state.layout?.electricalLight||[]
    };
    return JSON.stringify([state.container,state.counts?.electrical||0,state.counts?.electricalSwitch||0,state.counts?.electricalLight||0,layouts,visible]);
  }

  function updateInfo(estimate=calculate()){
    const box=document.getElementById('electrical-technical-info');if(!box)return;
    box.innerHTML=`<div class="grid grid-cols-2 gap-1.5"><div><span class="text-slate-500">Canalización</span><br><strong>${estimate.conduit.toFixed(1)} m</strong></div><div><span class="text-slate-500">Cajas</span><br><strong>${estimate.boxes}</strong></div><div><span class="text-slate-500">C1 · 1,5 mm²</span><br><strong>${estimate.c1Conductor.toFixed(1)} m</strong></div><div><span class="text-slate-500">C2 · 2,5 mm²</span><br><strong>${estimate.c2Conductor.toFixed(1)} m</strong></div></div>`;
  }

  function setVisible(next){
    visible=Boolean(next);
    const btn=document.getElementById('electrical-technical-toggle');
    if(btn){
      btn.classList.toggle('bg-amber-500',visible);btn.classList.toggle('text-slate-950',visible);btn.classList.toggle('bg-white/10',!visible);
      btn.innerHTML=visible?'<i class="fa-solid fa-eye-slash mr-1"></i> Ocultar canalización':'<i class="fa-solid fa-route mr-1"></i> Ver canalización';
    }
    lastSignature='';render();
  }

  function installUI(){
    const panel=document.getElementById('electrical-placement-panel');if(!panel)return false;
    if(!document.getElementById('electrical-technical-toggle')){
      const block=document.createElement('div');block.className='mt-3 pt-3 border-t border-white/10';
      block.innerHTML=`<button id="electrical-technical-toggle" type="button" class="w-full rounded-xl bg-white/10 py-2 text-[10px] font-bold"><i class="fa-solid fa-route mr-1"></i> Ver canalización</button><div id="electrical-technical-info" class="mt-2 rounded-xl bg-white/5 border border-white/10 p-2.5 text-[9px] text-slate-300 leading-relaxed"></div><div class="mt-1.5 text-[9px] text-slate-500">Vista técnica para fabricación y cubicación. El cliente puede trabajar con la canalización oculta.</div>`;
      panel.appendChild(block);
      block.querySelector('#electrical-technical-toggle').addEventListener('click',()=>setVisible(!visible));
    }
    updateInfo();return true;
  }

  function install(){
    if(installed)return true;
    if(!ready()||!window.BAT_KUBIQUEITOR_ELECTRICAL)return false;
    installed=true;installUI();calculate();
    const timer=setInterval(()=>{
      if(!ready())return;
      installUI();
      const sig=signature();
      if(sig!==lastSignature){lastSignature=sig;render();}
    },250);
    window.BAT_KUBIQUEITOR_ELECTRICAL_TECHNICAL={version:1,setVisible,get visible(){return visible;},calculate,render,timer};
    return true;
  }

  let tries=0;const boot=setInterval(()=>{tries++;if(install()||tries>=180)clearInterval(boot);},80);
})();
