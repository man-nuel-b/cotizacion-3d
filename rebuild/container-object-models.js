/* Three.js models for the principal component of the technical catalog.
 * Geometric examples, not manufacturer-certified products or construction detailing.
 * Entry code identifies the example mesh; pricing/APU are intentionally absent.
 */
function material(THREE,registry,color,roughness=.55,metalness=.08,extra={}){
 const m=new THREE.MeshStandardMaterial({color,roughness,metalness,...extra});
 registry(m);return m;
}
export function createObjectModel(THREE,item,trackMaterial){
 if(!item?.size)throw new Error('La partida no es un objeto físico: '+item?.code);
 const [w,h,d]=item.size,root=new THREE.Group();root.name=item.code;
 const steel=material(THREE,trackMaterial,0xadb7c1,.3,.78);
 const dark=material(THREE,trackMaterial,0x303a45,.48,.36);
 const white=material(THREE,trackMaterial,0xf2f3ef,.19,.02);
 const silver=material(THREE,trackMaterial,0xd9dfe2,.19,.86);
 const wood=material(THREE,trackMaterial,0xa98258,.65,.02);
 const pale=material(THREE,trackMaterial,0xe5e1d7,.82,.01);
 const glass=material(THREE,trackMaterial,0xa8d1de,.1,.1,{transparent:true,opacity:.23,depthWrite:false,side:THREE.DoubleSide});
 const yellow=material(THREE,trackMaterial,0xe7c96f,.96,0);
 const greyWool=material(THREE,trackMaterial,0x8f9987,.98,0);
 const ceramic=material(THREE,trackMaterial,0xe6e2de,.27,.02);
 const blue=material(THREE,trackMaterial,0x3879b2,.45,.16);
 const green=material(THREE,trackMaterial,0x43b47c,.52,.02);
 function mesh(geom,mat,x,y,z,parent=root){
  const result=new THREE.Mesh(geom,mat);result.position.set(x,y,z);
  result.castShadow=true;result.receiveShadow=true;parent.add(result);return result;
 }
 function box(a,b,c,mat,x=0,y=b/2,z=0){return mesh(new THREE.BoxGeometry(a,b,c),mat,x,y,z);}
 function cylinder(rt,rb,length,mat,x,y,z,segments=28){
  return mesh(new THREE.CylinderGeometry(rt,rb,length,segments),mat,x,y,z);
 }
 function pipe(radius,length,mat,x,y,z,axis='y'){
  const m=cylinder(radius,radius,length,mat,x,y,z,16);
  if(axis==='x')m.rotation.z=Math.PI/2;
  if(axis==='z')m.rotation.x=Math.PI/2;return m;
 }
 function ring(radius,tube,mat,x,y,z,horizontal=true){
  const m=mesh(new THREE.TorusGeometry(radius,tube,10,40),mat,x,y,z);
  if(horizontal)m.rotation.x=Math.PI/2;
  return m;
 }
 function ball(rx,ry,rz,mat,x,y,z){
  const obj=mesh(new THREE.SphereGeometry(1,22,14),mat,x,y,z);
  obj.scale.set(rx,ry,rz);return obj;
 }
 function panelFrame(){
  const step=Math.min(.4,w/3);
  box(w,.045,d,steel,0,.025,0);box(w,.045,d,steel,0,h-.025,0);
  for(let x=-w/2;x<=w/2+.0001;x+=step)box(.035,h,d,steel,Math.min(x,w/2),h/2,0);
 }
 const v=item.visual;
 if(['metal-studs','wood-studs','partition','wet-partition','wall-lining','wet-lining','closure'].includes(v)){
  const framing=v==='wood-studs'?wood:steel;
  if(v==='metal-studs'||v==='wood-studs'){
   panelFrame();
   if(v==='wood-studs'){
    // Natural timber members, including top and sole plates.
    root.children.forEach(ch=>{if(ch.material===steel)ch.material=wood;});
   }
  }else{
   panelFrame();
   box(w-.055,h-.10,Math.min(.055,d*.5),yellow,0,h/2,0);
   const face=v.includes('wet')?material(THREE,trackMaterial,0xb8d2c5,.85,0):pale;
   box(w,h,.015,face,0,h/2,d/2-.008);
   box(w,h,.015,ceramic,0,h/2,-d/2+.008);
   if(v==='closure')box(w,h,.009,wood,0,h/2,d/2-.02);
   if(v==='wet-partition'||v==='wet-lining'){
    for(let x=-w/2;x<=w/2+.01;x+=.3)box(.006,h,.002,silver,x,h/2,d/2+.007);
    for(let y=.3;y<h;y+=.3)box(w,.006,.002,silver,0,y,d/2+.007);
   }
  }
 }else if(['glass-wool','mineral-wool','eps','glass-panel','spray-foam'].includes(v)){
  const filler=v==='mineral-wool'?greyWool:v==='eps'?white:yellow;
  box(w,h,d,filler);
  if(v!=='eps'&&v!=='spray-foam'){
   const film=material(THREE,trackMaterial,0xffffff,.36,0,{transparent:true,opacity:.25,depthWrite:false});
   box(w,h,.003,film,0,h/2,d/2+.005);
  }
  if(v==='spray-foam')for(let i=0;i<20;i++){
   const x=-w/2+w*(i%5+.5)/5,y=h*(Math.floor(i/5)+.5)/4;
   ball(.13,.16,.028,filler,x,y,d/2);
  }
 }else if(v==='toilet'){
  // Vitreous china tank, curved bowl, seat and pedestal.
  cylinder(.12,.16,.34,white,0,.17,-.05);
  ball(.205,.155,.285,white,0,.37,.045);
  cylinder(.205,.205,.045,white,0,.43,.045);
  ring(.16,.023,white,0,.465,.045);
  box(.41,.39,.19,white,0,.60,-.245);
  box(.43,.035,.21,white,0,.80,-.245);
  box(.09,.016,.09,silver,.05,.82,-.245);
 }else if(v==='sink'){
  cylinder(.095,.15,.69,white,0,.345,.04);
  ball(.275,.13,.23,white,0,.77,0);
  ring(.20,.018,white,0,.846,0);
  pipe(.012,.21,silver,.02,.98,-.08);
  pipe(.012,.12,silver,.02,1.07,-.04,'z');
  cylinder(.013,.013,.035,silver,.02,1.045,-.08);
  pipe(.025,.24,silver,0,.62,.04);
 }else if(v==='shower'){
  box(w,.1,d,white,0,.05,0);
  const edge=steel;
  for(const x of [-w/2,w/2])box(.022,h-.1,.022,edge,x,h/2, d/2);
  for(const z of [-d/2,d/2])box(.022,h-.1,.022,edge,-w/2,h/2,z);
  box(.012,h-.2,d,glass,w/2,h/2,0);
  box(w,h-.2,.012,glass,0,h/2,d/2);
  pipe(.018,h-.28,silver,-w/2+.08,h/2,-d/2+.08);
  pipe(.018,.32,silver,-w/2+.08,h-.2,-d/2+.24,'z');
  cylinder(.13,.13,.015,silver,-w/2+.08,h-.22,-d/2+.40);
  box(.09,.008,.09,steel,0,.111,0);
 }else if(v==='water-heater'){
  const tank=cylinder(w*.45,w*.45,h*.91,white,0,h*.53,0,36);
  cylinder(w*.445,w*.445,.022,silver,0,h*.96,0,36);
  cylinder(w*.445,w*.445,.025,silver,0,.08,0,36);
  pipe(.016,.15,blue,-.09,.06,0);pipe(.016,.15,green,.09,.06,0);
  cylinder(.035,.035,.008,dark,.12,h*.62,d/2);
 }else if(v==='kitchenette'){
  box(w,.1,d,wood,0,.78,0);
  box(w,.71,d-.02,wood,0,.36,0);
  box(w,.045,d,silver,0,.84,0);
  for(const x of [-w/4,w/4]){
   box(w/2-.025,.62,.026,wood,x,.38,d/2+.007);
   box(.014,.18,.012,silver,x+.12,.39,d/2+.023);
  }
  box(.62,.015,.36,steel,-w*.2,.859,-.045);
  box(.52,.009,.27,dark,-w*.2,.868,-.045);
  pipe(.015,.21,silver,-w*.2,.985,-.18);
  pipe(.015,.13,silver,-w*.2,1.09,-.12,'z');
  box(w*.64,.56,.30,wood,w*.17,1.74,-.12);
  for(let i=-1;i<=1;i++)box(.012,.22,.01,silver,w*.17+i*.21,1.73,.038);
  box(w*.64,.018,.025,yellow,w*.17,1.47,.07);
 }else if(v==='bath-accessories'){
  box(.36,.51,.025,glass,-.12,.65,-.03);
  box(.4,.035,.035,silver,-.12,.92,-.02);
  box(.42,.025,.025,silver,.07,.34,.055);
  pipe(.012,.08,silver,-.1,.34,.04);pipe(.012,.08,silver,.25,.34,.04);
  cylinder(.035,.035,.115,white,.27,.2,.05);
  ring(.07,.015,silver,-.24,.22,.05,false);
 }else if(v==='extractor'){
  box(w,h,d,white);
  cylinder(w*.36,w*.36,.013,dark,0,h/2,d/2+.008);
  for(let i=0;i<7;i++){
   const blade=box(.015,h*.6,.009,white,Math.sin(i*2*Math.PI/7)*.035,h/2,d/2+.03);
   blade.rotation.z=i*Math.PI/7;
  }
 }else if(v==='light'){
  box(w,.055,d,white,0,h/2,0);
  const glow=material(THREE,trackMaterial,0xfff3db,.45,0,{emissive:0xffe8ad,emissiveIntensity:.6});
  box(w*.91,.012,d*.91,glow,0,h/2+.034,0);
 }else if(v==='outlet'||v==='power'){
  box(w,h,d,white);
  if(v==='outlet')for(const x of [-w*.22,w*.22]){
   cylinder(.016,.016,.006,dark,x,h*.56,d/2+.004,16);
   for(const dx of [-.012,.012])cylinder(.004,.004,.007,dark,x+dx,h*.53,d/2+.008,12);
  }else{
   cylinder(.055,.055,.018,blue,0,h/2,d/2+.015);
   ring(.036,.008,dark,0,h/2,d/2+.028,false);
  }
 }else if(v==='panel'){
  box(w,h,d,white);
  box(w*.81,h*.68,d*.1,dark,0,h*.55,d/2+.012);
  for(let i=0;i<12;i++){
   const x=-w*.32+(i%6)*w*.128,y=h*(.73-Math.floor(i/6)*.22);
   box(w*.092,h*.12,.02,white,x,y,d/2+.04);
   box(w*.065,h*.027,.022,blue,x,y+.018,d/2+.052);
  }
 }else if(v==='grounding'){
  box(w,.06,d,silver,0,h*.55,0);
  for(let i=0;i<4;i++){
   const x=(i-1.5)*w*.23;
   cylinder(.018,.018,.018,silver,x,h*.55,d/2);
   pipe(.008,h*.6,i%2?yellow:green,x,h*.3,d/2+.006);
  }
 }else if(v==='aircon'){
  box(w,h*.84,d,white,0,h*.54,0);
  box(w*.86,.035,.032,dark,0,h*.24,d/2+.012);
  box(w*.82,.018,.015,silver,0,h*.19,d/2+.026);
  cylinder(.01,.01,.012,green,w*.38,h*.62,d/2+.02,14);
 }else if(['water-point','drain-50','drain-110'].includes(v)){
  const m=v==='water-point'?green:white;
  const radius=v==='drain-110'?.065:v==='drain-50'?.045:.019;
  pipe(radius,w*.83,m,0,h*.28,0,'x');
  pipe(radius,h*.65,m,-w*.34,h*.35,0);
  cylinder(radius*1.5,radius*1.5,.045,silver,w*.33,h*.28,0);
  cylinder(radius*1.5,radius*1.5,.045,silver,-w*.34,h*.68,0);
 }else{
  // Unrecognized future item: a visible technical component proxy.
  box(w,h,d,pale);
 }
 return root;
}
const FINISH={
 P01:['#a78058','wood'],P02:['#cdb492','wood'],P03:['#9a9d9a','tile'],
 P04:['#c8c8c1','speckle'],P05:['#8a9ba5','speckle'],P06:['#929494','tile'],
 P07:['#9aa8aa','epoxy'],P47:['#9b7951','osb'],
 P30:['#e7e3db','plain'],P31:['#a7c6b4','plain'],P32:['#aeb2b1','cement'],
 P33:['#b69068','wood'],P34:['#a68a65','osb'],P35:['#e4e8e8','pvc'],
 P44:['#ad6954','plain'],P45:['#344c62','plain'],P46:['#f0ede5','plain'],
 P36:['#b9b3a9','tile'],P37:['#418cbb','waterproof'],P16:['#e9e7e1','plain']
};
export function makeFinishMaterial(THREE,code,registerMaterial,registerTexture,repeatX=5,repeatY=3){
 const info=FINISH[code]||['#d4d2cb','plain'],[color,pattern]=info;
 const canvas=document.createElement('canvas');canvas.width=canvas.height=512;
 const g=canvas.getContext('2d');if(!g)throw new Error('Canvas 2D no disponible');
 g.fillStyle=color;g.fillRect(0,0,512,512);
 if(pattern==='wood'||pattern==='osb'){
  let seed=code.split('').reduce((n,c)=>n*31+c.charCodeAt(0),17);
  const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967295;};
  if(pattern==='wood'){
   for(let i=0;i<220;i++){
    g.strokeStyle=rand()>.55?'rgba(77,47,24,.12)':'rgba(244,228,190,.17)';
    g.lineWidth=.5+rand()*2;g.beginPath();
    const y=rand()*512;g.moveTo(0,y);g.bezierCurveTo(130,y+rand()*8,360,y-rand()*8,512,y);g.stroke();
   }
  }else for(let i=0;i<1350;i++){
   const x=rand()*512,y=rand()*512;
   g.fillStyle=rand()>.55?'rgba(60,37,15,.17)':'rgba(250,222,178,.20)';
   g.save();g.translate(x,y);g.rotate(rand()*3);
   g.fillRect(0,0,3+rand()*13,1+rand()*4);g.restore();
  }
 }
 if(pattern==='tile'||pattern==='pvc'){
  g.strokeStyle='rgba(50,50,55,.17)';g.lineWidth=pattern==='tile'?3:2;
  const step=pattern==='pvc'?64:256;
  for(let x=0;x<=512;x+=step){g.beginPath();g.moveTo(x,0);g.lineTo(x,512);g.stroke();}
  if(pattern==='tile')for(let y=0;y<=512;y+=256){g.beginPath();g.moveTo(0,y);g.lineTo(512,y);g.stroke();}
 }
 if(pattern==='speckle'||pattern==='cement'||pattern==='waterproof'){
  let n=24;for(let i=0;i<2000;i++){
   n=(n*1664525+1013904223)>>>0;
   g.fillStyle=i%2?'rgba(30,30,30,.07)':'rgba(255,255,255,.09)';
   g.fillRect(n%512,(n>>>9)%512,1.4,1.4);
  }
 }
 const tex=new THREE.CanvasTexture(canvas);
 tex.colorSpace=THREE.SRGBColorSpace;tex.wrapS=tex.wrapT=THREE.RepeatWrapping;
 tex.repeat.set(repeatX,repeatY);tex.anisotropy=4;registerTexture(tex);
 return material(THREE,registerMaterial,0xffffff,pattern==='epoxy'?.16:.78,pattern==='epoxy'?.22:0,{map:tex,side:THREE.DoubleSide});
}

