/* BAT-CUBIKEITOR V2 realistic container skin.
 * Adapted from the user-provided "contenedor-realista.html" (Three.js r160)
 * to the existing Three.js r128 V2, without introducing another project state.
 * Geometry is a VIEW only: it never writes dimensions, openings, BOM or APU.
 */
(function(root,factory){
 const api=factory(root.THREE);
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.BatContainerVisual=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(THREE){
'use strict';
const FLOOR=.14,R=.036,T=.004,P=.076,Q=P/4,WALL=R+T;
const FACES=Object.freeze({
 // Keep BAT V2 face IDs, NOT those from the standalone HTML:
 A:{normal:[0,0,-1],long:true,angle:Math.PI,sign:-1},
 B:{normal:[0,0, 1],long:true,angle:0,sign:1},
 C:{normal:[-1,0,0],long:false,angle:-Math.PI/2,sign:1},
 D:{normal:[ 1,0,0],long:false,angle:Math.PI/2,sign:-1}
});
const CARGO_FACE='D'; // +X end: standalone model's closing-bar face B.
function dAt(x){
 const k=Math.floor(x/Q+1e-12),t=(x-k*Q)/Q,V=[0,0,R,R];
 return V[((k%4)+4)%4]+(V[(((k+1)%4)+4)%4]-V[((k%4)+4)%4])*t;
}
function profile(a,b){
 const pts=[[a,dAt(a)]];
 for(let k=Math.floor(a/Q)+1;k*Q<b-1e-9;k++){
  const x=k*Q;if(x>a+1e-9)pts.push([x,[0,0,R,R][((k%4)+4)%4]]);
 }
 pts.push([b,dAt(b)]);return pts;
}
function create({scene}={}){
 if(!THREE)throw new Error('Three.js no está disponible');
 if(!scene)throw new Error('Se requiere una escena');
 const rootGroup=new THREE.Group();rootGroup.name='BAT-realistic-container';scene.add(rootGroup);
 let signature='',shellMesh=null,openings=[],wallFaces=[],geometries=[],materials=[],paintTexture=null,woodTexture=null;
 let xray=false,lastState=null;
 const ownedGeometry=g=>{geometries.push(g);return g;};
 const ownedMaterial=m=>{materials.push(m);return m;};
 function texture(draw){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
  const ctx=canvas.getContext('2d');draw(ctx,256);
  const tex=new THREE.CanvasTexture(canvas);tex.wrapS=tex.wrapT=THREE.RepeatWrapping;
  tex.anisotropy=4;return tex;
 }
 function ensureTextures(){
  if(paintTexture)return;
  paintTexture=texture((g,s)=>{
   g.fillStyle='#f1f1f1';g.fillRect(0,0,s,s);
   for(let i=0;i<3200;i++){
    const n=Math.round(214+Math.random()*35);
    g.fillStyle='rgba('+n+','+n+','+n+',0.1)';
    g.fillRect(Math.random()*s,Math.random()*s,1.5,1.5);
   }
   for(let i=0;i<20;i++){
    const x=Math.random()*s,gradient=g.createLinearGradient(0,0,0,s);
    gradient.addColorStop(0,'rgba(70,55,45,0.12)');
    gradient.addColorStop(1,'rgba(70,55,45,0)');
    g.fillStyle=gradient;g.fillRect(x,0,1+Math.random()*2,s);
   }
  });
  woodTexture=texture((g,s)=>{
   g.fillStyle='#9e7551';g.fillRect(0,0,s,s);
   for(let i=0;i<8;i++){
    const y=i*s/8;g.fillStyle=i%2?'#9b704f':'#a47c55';
    g.fillRect(0,y,s,s/8);g.fillStyle='rgba(38,25,15,.65)';
    g.fillRect(0,y,s,2);
    for(let j=0;j<12;j++){
     g.strokeStyle='rgba(45,29,15,.19)';g.beginPath();
     const yy=y+Math.random()*s/8;g.moveTo(0,yy);g.lineTo(s,yy);g.stroke();
    }
   }
  });
 }
 function clear(){
  for(const item of [...rootGroup.children])rootGroup.remove(item);
  for(const g of geometries)g.dispose();
  for(const m of materials)m.dispose();
  geometries=[];materials=[];wallFaces=[];openings=[];shellMesh=null;
 }
 function mat(props){return ownedMaterial(new THREE.MeshStandardMaterial(props));}
 function box(w,h,d,m,x,y,z,parent,selectId){
  const mesh=new THREE.Mesh(ownedGeometry(new THREE.BoxGeometry(w,h,d)),m);
  mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;
  if(selectId){mesh.userData.openingId=selectId;openings.push(mesh);}
  parent.add(mesh);return mesh;
 }
 function corrugationPanel(xa,xb,ya,yb,span,material,parent){
  if(xb-xa<.001||yb-ya<.001)return;
  const pts=profile(xa,xb),shape=new THREE.Shape();
  shape.moveTo(pts[0][0],pts[0][1]+T);
  for(let i=1;i<pts.length;i++)shape.lineTo(pts[i][0],pts[i][1]+T);
  for(let i=pts.length-1;i>=0;i--)shape.lineTo(pts[i][0],pts[i][1]);
  shape.closePath();
  const geometry=ownedGeometry(new THREE.ExtrudeGeometry(shape,{depth:yb-ya,bevelEnabled:false,steps:1}));
  geometry.rotateX(Math.PI/2);
  geometry.translate(-span/2,yb,-WALL);
  const panel=new THREE.Mesh(geometry,material);panel.castShadow=true;panel.receiveShadow=true;
  panel.userData.corrugatedPanel=true;parent.add(panel);
 }
 function corrugatedWall(span,height,cuts,material){
  const group=new THREE.Group();
  const raw=[0,span];for(const c of cuts)raw.push(c.u0,c.u1);
  const edges=raw.filter(v=>v>=-1e-9&&v<=span+1e-9).sort((a,b)=>a-b)
   .filter((v,i,arr)=>i===0||v-arr[i-1]>1e-4);
  for(let i=0;i<edges.length-1;i++){
   const xa=edges[i],xb=edges[i+1],mid=(xa+xb)/2;
   const blocked=cuts.filter(c=>c.u0<=mid&&c.u1>=mid)
    .map(c=>[c.v0,c.v1]).sort((a,b)=>a[0]-b[0]);
   let y=0;
   for(const [low,high] of blocked){
    if(low>y+1e-4)corrugationPanel(xa,xb,y,Math.min(low,height),span,material,group);
    y=Math.max(y,high);
   }
   if(y<height-1e-4)corrugationPanel(xa,xb,y,height,span,material,group);
  }
  return group;
 }
 function buildOpening(opening,span,face,m,parent,selected){
  const w=opening.width,h=opening.height,fb=.05,fd=.09;
  const localX=face.sign*opening.offset;
  const g=new THREE.Group();g.position.set(localX,FLOOR+(opening.bottom||0)+h/2,-WALL/2);
  const id=opening.id,frame=selected?m.highlight:opening.kind==='window'?m.aluminium:m.darkPaint;
  box(w+2*fb,fb,fd,frame,0,h/2+fb/2,0,g,id);
  if((opening.bottom||0)>.01)box(w+2*fb,fb,fd,frame,0,-h/2-fb/2,0,g,id);
  box(fb,h,fd,frame,-w/2-fb/2,0,0,g,id);
  box(fb,h,fd,frame,w/2+fb/2,0,0,g,id);
  if(opening.kind==='door'){
   box(w-.02,h-.02,.035,m.door,0,0,-.012,g,id);
   box(w*.72,h*.8,.012,m.doorInset,0,0,.012,g,id);
   const handle=new THREE.Mesh(ownedGeometry(new THREE.CylinderGeometry(.012,.012,.14,12)),m.chrome);
   handle.rotation.z=Math.PI/2;handle.position.set(w/2-.1,0,.032);
   handle.userData.openingId=id;openings.push(handle);g.add(handle);
   for(const y of [-.35,.35])box(.04,.1,.02,m.chrome,-w/2+.02,y*h,.02,g,id);
  }else{
   box(w-.02,h-.02,.01,m.glass,0,0,-.01,g,id);
   if(w>1)box(.035,h,.05,frame,0,0,0,g,id);
   box(w+.1,.03,.14,frame,0,-h/2-fb-.015,.03,g,id);
  }
  parent.add(g);
 }
 function endDoors(span,height,m,parent){
  const rodH=height-.32,rodPositions=[-.9,-.2,.2,.9].map(x=>Math.max(-span/2+.17,Math.min(span/2-.17,x)));
  for(const x of rodPositions){
   const rod=new THREE.Mesh(ownedGeometry(new THREE.CylinderGeometry(.0165,.0165,rodH,14)),m.chrome);
   rod.position.set(x,height/2,.034);rod.castShadow=true;parent.add(rod);
   for(const p of [.1,.36,.64,.9])box(.07,.05,.05,m.darkPaint,x,height*p,.02,parent);
   box(.14,.035,.035,m.chrome,x+(x<0?.08:-.08),Math.min(1.05,height*.5),.062,parent);
  }
  box(.014,rodH,.012,m.dark,0,height/2,.006,parent);
  box(.18,.14,.004,m.yellow,-span/2+.3,height-.5,.004,parent);
  box(.05,rodH,.03,m.darkPaint,-span/2+.06,height/2,.012,parent);
  box(.05,rodH,.03,m.darkPaint,span/2-.06,height/2,.012,parent);
 }
 function build(state,selectedOpeningId,selectedPartitionId){
  ensureTextures();clear();
  const c=state.project.container,L=c.length,W=c.width,H=c.height,totalH=H+FLOOR;
  // Visual quality-of-service: keep extremely large imported dimensions from
  // generating millions of triangles. Canonical state/BOM remains unmodified.
  const corrugated=L<=25&&W<=12&&H<=8;
  const color=/^#[0-9a-f]{6}$/i.test(c.color||'')?c.color:'#7d8388';
  const m={
   darkPaint:mat({color:new THREE.Color(color).multiplyScalar(.72),map:paintTexture,roughness:.62,metalness:.45}),
   dark:mat({color:0x25282c,roughness:.72,metalness:.3}),
   chrome:mat({color:0xd9dde1,roughness:.25,metalness:.88}),
   yellow:mat({color:0xe8c11a,roughness:.5}),
   door:mat({color:0x59636b,roughness:.55,metalness:.5}),
   doorInset:mat({color:0x4c555c,roughness:.6,metalness:.5}),
   aluminium:mat({color:0xe6e9ec,roughness:.35,metalness:.8}),
   glass:mat({color:0xbfd8e6,roughness:.1,transparent:true,opacity:.35,depthWrite:false,side:THREE.DoubleSide}),
   wood:mat({color:0xffffff,map:woodTexture,roughness:.8}),
   partition:mat({color:0xe9e4da,roughness:.9}),
   selected:mat({color:0xfbbf24,roughness:.55}),
   highlight:mat({color:0xfbbf24,roughness:.4,metalness:.2})
  };
  const floorW=Math.max(.01,W-2*WALL-.02),floorL=Math.max(.01,L-2*WALL-.02);
  box(floorL,.05,floorW,m.wood,0,FLOOR-.025,0,rootGroup);
  for(let x=-L/2+.35;x<L/2-.2&&x<50;x+=.6)box(.1,.1,Math.max(.02,W-.2),m.dark,x,.05,0,rootGroup);
  for(const s of [-1,1]){
   box(L,.14,.1,m.darkPaint,0,.07,s*(W/2-.05),rootGroup);
   box(L,.09,.08,m.darkPaint,0,totalH-.045,s*(W/2-.04),rootGroup);
   box(.1,.14,Math.max(.02,W-.3),m.darkPaint,s*(L/2-.05),.07,0,rootGroup);
   box(.1,.1,Math.max(.02,W-.3),m.darkPaint,s*(L/2-.05),totalH-.05,0,rootGroup);
   for(const t of [-1,1]){
    box(.12,totalH,.12,m.darkPaint,s*(L/2-.06),totalH/2,t*(W/2-.06),rootGroup);
    for(const y of [.065,totalH-.065])box(.178,.13,.178,m.dark,s*(L/2-.089),y,t*(W/2-.089),rootGroup);
   }
   for(const x of [-1.9,1.9])if(Math.abs(x)<L/2-.2)box(.36,.09,.11,m.dark,x,.07,s*(W/2-.05),rootGroup);
  }
  for(const [key,face] of Object.entries(FACES)){
   const span=face.long?L:W,half=face.long?W/2:L/2;
   const ops=state.openings.filter(o=>o.face===key);
   const cuts=ops.map(o=>{
    const center=span/2+o.offset*face.sign;
    return {u0:center-o.width/2,u1:center+o.width/2,
     v0:FLOOR+(o.bottom||0),v1:FLOOR+(o.bottom||0)+o.height};
   });
   const material=mat({color,map:paintTexture,roughness:.63,metalness:.4,side:THREE.DoubleSide});
   const group=corrugated?corrugatedWall(span,totalH,cuts,material):new THREE.Group();
   if(!corrugated)box(span,totalH,WALL,material,0,totalH/2,0,group);
   group.rotation.y=face.angle;
   group.position.set(face.normal[0]*half,0,face.normal[2]*half);
   rootGroup.add(group);
   for(const o of ops)buildOpening(o,span,face,m,group,o.id===selectedOpeningId);
   if(key===CARGO_FACE&&ops.length===0)endDoors(span,totalH,m,group);
   wallFaces.push({group,material,normal:new THREE.Vector3(...face.normal),half,roof:false,hidden:null});
  }
  // Reuse the source's transverse corrugation on the roof.
  const roofMat=mat({color,map:paintTexture,roughness:.64,metalness:.42,side:THREE.DoubleSide});
  const roofSpan=Math.max(.1,L-.2),roofDepth=Math.max(.1,W-.2);
  const roof=corrugated?corrugatedWall(roofSpan,roofDepth,[],roofMat):new THREE.Group();
  if(!corrugated){box(roofSpan,.04,roofDepth,roofMat,0,totalH-.02,0,roof);}
  else{roof.rotation.x=-Math.PI/2;roof.position.set(0,totalH-WALL+.0005,roofDepth/2);}
  rootGroup.add(roof);
  wallFaces.push({group:roof,material:roofMat,normal:new THREE.Vector3(0,1,0),half:0,roof:true,hidden:null});
  for(const p of state.partitions){
   const axis=p.orientation==='z',thickness=p.thickness??.08;
   box(axis?thickness:p.length,p.height,axis?p.length:thickness,
    p.id===selectedPartitionId?m.selected:m.partition,p.x,FLOOR+p.height/2,p.z,rootGroup);
  }
  // A transparent, not-visible raycast surface ensures that wall targeting is
  // independent of corrugation ridges, panes, and the opening cut-out mesh.
  shellMesh=new THREE.Mesh(ownedGeometry(new THREE.BoxGeometry(L,H,W)),
   mat({transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide}));
  shellMesh.position.y=FLOOR+H/2;shellMesh.name='container-hit-shell';
  rootGroup.add(shellMesh);
  lastState=state;refreshXray();
 }
 function refreshXray(camera){
  if(!camera)return;
  for(const wall of wallFaces){
   const hide=xray&&(wall.roof||camera.position.dot(wall.normal)>wall.half-.01);
   if(wall.hidden===hide)continue;
   wall.hidden=hide;wall.material.transparent=hide;
   wall.material.opacity=hide?.07:1;
   wall.material.depthWrite=!hide;
   wall.material.needsUpdate=true;
   wall.group.traverse(obj=>{if(obj.userData.corrugatedPanel)obj.castShadow=!hide;});
  }
 }
 function update(state,{selectedOpeningId=null,selectedPartitionId=null,seeInside=false,camera=null}={}){
  const next=JSON.stringify({
   c:state.project.container,o:state.openings,p:state.partitions,
   selectedOpeningId,selectedPartitionId
  });
  xray=!!seeInside;
  if(next!==signature){build(state,selectedOpeningId,selectedPartitionId);signature=next;}
  refreshXray(camera);
  return {shellMesh,openingMeshes:openings,root:rootGroup};
 }
 function setSeeInside(value,camera){xray=!!value;refreshXray(camera);}
 function dispose(){
  clear();rootGroup.parent?.remove(rootGroup);
  paintTexture?.dispose();woodTexture?.dispose();
  paintTexture=null;woodTexture=null;signature='';
 }
 function getStats(){
  let corrugatedPanels=0;
  rootGroup.traverse(obj=>{if(obj.userData.corrugatedPanel)corrugatedPanels++;});
  return Object.freeze({
   source:'contenedor-realista.html',
   corrugatedPanels,actualWallCuts:lastState?.openings?.length||0,
   openingSelectableMeshes:openings.length,
   container:lastState?{...lastState.project.container}:null,
   floorBaseHeight:FLOOR,cargoDoorFace:CARGO_FACE,
   visibleWalls:wallFaces.filter(w=>!w.hidden).length,
   faceMapping:'BAT-V2'
  });
 }
 return Object.freeze({update,setSeeInside,refreshXray,dispose,getStats,getRoot:()=>rootGroup});
}
return Object.freeze({create,FACES,FLOOR,version:1});
});