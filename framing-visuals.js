// Visible A-E framing for bat-kubiqueitor.
// Renders Metalcon or timber framing from state.interiorSystem.framingFaces.
(function(){
  if(window.BAT_KUBIQUEITOR_FRAMING_VISUALS) return;

  const SPACING=.60;

  function ready(){
    return typeof THREE!=='undefined'&&typeof state!=='undefined'&&typeof DATA!=='undefined'&&
      typeof ensureInteriorSystem==='function'&&typeof rebuild3D==='function'&&typeof box==='function'&&typeof mat==='function';
  }

  function loadMaterialVisuals(){
    if(document.querySelector('script[data-interior-material-visuals]')) return;
    const script=document.createElement('script');
    script.src=(typeof finalVersionedAsset==='function'?finalVersionedAsset('interior-material-visuals.js'):'interior-material-visuals.js?v=20261022-19');
    script.dataset.interiorMaterialVisuals='true';
    document.body.appendChild(script);
  }

  function frameMaterial(){
    const s=ensureInteriorSystem();
    return s.framing==='wood'
      ? mat(0xa66b34,{roughness:.76,metalness:.01})
      : mat(0xb8c1ca,{roughness:.28,metalness:.72});
  }

  function memberSize(){
    return ensureInteriorSystem().framing==='wood'
      ? {face:.050,depth:.052}
      : {face:.040,depth:.045};
  }

  function apertures(face,c){
    if(typeof windowsForFace!=='function') return [];
    try{return windowsForFace(face,c)||[];}catch(e){return [];}
  }

  function blockedAt(axisValue,openingList,pad=.025){
    return openingList.some(open=>Math.abs(axisValue-(Number(open.center)||0))<((Number(open.width)||0)/2)+pad);
  }

  function spacedPositions(span,inset=.15){
    const min=-span/2+inset,max=span/2-inset,out=[];
    if(max<=min) return [0];
    for(let p=min;p<=max+.001;p+=SPACING) out.push(Math.min(p,max));
    if(Math.abs(out[out.length-1]-max)>.10) out.push(max);
    return [...new Set(out.map(v=>Math.round(v*1000)/1000))];
  }

  function subtractOpenings(start,end,rowY,openingList,pad=.018){
    let segments=[[Math.min(start,end),Math.max(start,end)]];
    openingList.forEach(open=>{
      const bottom=Number.isFinite(Number(open.bottom))?Number(open.bottom):.12;
      const top=Number.isFinite(Number(open.top))?Number(open.top):999;
      if(rowY<=bottom-pad||rowY>=top+pad) return;
      const center=Number(open.center)||0,width=Math.max(0,Number(open.width)||0);
      const cutMin=center-width/2-pad,cutMax=center+width/2+pad;
      const next=[];
      segments.forEach(([a,b])=>{
        if(cutMax<=a||cutMin>=b){next.push([a,b]);return;}
        if(cutMin>a) next.push([a,Math.min(cutMin,b)]);
        if(cutMax<b) next.push([Math.max(cutMax,a),b]);
      });
      segments=next;
    });
    return segments.filter(([a,b])=>b-a>.075);
  }

  function addLongWallNoggins(group,c,material,size,z,opens){
    const rowY=c.height/2;
    const studs=spacedPositions(c.length);
    for(let i=0;i<studs.length-1;i++){
      const start=studs[i]+size.face/2,end=studs[i+1]-size.face/2;
      subtractOpenings(start,end,rowY,opens,size.face/2).forEach(([a,b])=>{
        group.add(box(b-a,size.face,size.depth,material,(a+b)/2,rowY,z));
      });
    }
  }

  function addEndWallNoggins(group,c,material,size,x,opens){
    const rowY=c.height/2;
    const studs=spacedPositions(c.width);
    for(let i=0;i<studs.length-1;i++){
      const start=studs[i]+size.face/2,end=studs[i+1]-size.face/2;
      subtractOpenings(start,end,rowY,opens,size.face/2).forEach(([a,b])=>{
        group.add(box(size.depth,size.face,b-a,material,x,rowY,(a+b)/2));
      });
    }
  }

  function addLongWallFrame(group,face,c,material,size){
    const span=c.length-.30,height=c.height-.30,yCenter=c.height/2;
    const z=face==='A'?c.width/2-.112:-c.width/2+.112;
    const opens=apertures(face,c);
    group.add(box(span,size.face,size.depth,material,0,.17,z));
    group.add(box(span,size.face,size.depth,material,0,c.height-.17,z));
    spacedPositions(c.length).forEach(x=>{
      if(blockedAt(x,opens,size.face)) return;
      group.add(box(size.face,height,size.depth,material,x,yCenter,z));
    });
    addLongWallNoggins(group,c,material,size,z,opens);
    opens.forEach(open=>{
      const center=Number(open.center)||0,width=Math.max(.10,Number(open.width)||0),bottom=Math.max(.12,Number(open.bottom)||.12),top=Math.min(c.height-.12,Number(open.top)||c.height-.12);
      const left=center-width/2-size.face/2,right=center+width/2+size.face/2;
      if(left>-c.length/2+.10) group.add(box(size.face,height,size.depth,material,left,yCenter,z));
      if(right<c.length/2-.10) group.add(box(size.face,height,size.depth,material,right,yCenter,z));
      if(top<c.height-.18) group.add(box(width+size.face*2,size.face,size.depth,material,center,top+size.face/2,z));
      if(bottom>.18) group.add(box(width+size.face*2,size.face,size.depth,material,center,bottom-size.face/2,z));
    });
  }

  function addEndWallFrame(group,face,c,material,size){
    const span=c.width-.30,height=c.height-.30,yCenter=c.height/2;
    const x=face==='C'?c.length/2-.122:-c.length/2+.122;
    const opens=apertures(face,c);
    group.add(box(size.depth,size.face,span,material,x,.17,0));
    group.add(box(size.depth,size.face,span,material,x,c.height-.17,0));
    spacedPositions(c.width).forEach(z=>{
      if(blockedAt(z,opens,size.face)) return;
      group.add(box(size.depth,height,size.face,material,x,yCenter,z));
    });
    addEndWallNoggins(group,c,material,size,x,opens);
    opens.forEach(open=>{
      const center=Number(open.center)||0,width=Math.max(.10,Number(open.width)||0),bottom=Math.max(.12,Number(open.bottom)||.12),top=Math.min(c.height-.12,Number(open.top)||c.height-.12);
      const left=center-width/2-size.face/2,right=center+width/2+size.face/2;
      if(left>-c.width/2+.10) group.add(box(size.depth,height,size.face,material,x,yCenter,left));
      if(right<c.width/2-.10) group.add(box(size.depth,height,size.face,material,x,yCenter,right));
      if(top<c.height-.18) group.add(box(size.depth,size.face,width+size.face*2,material,x,top+size.face/2,center));
      if(bottom>.18) group.add(box(size.depth,size.face,width+size.face*2,material,x,bottom-size.face/2,center));
    });
  }

  function addCeilingFrame(group,c,material,size){
    const y=c.height-.125,spanX=c.length-.30,spanZ=c.width-.30;
    group.add(box(spanX,size.depth,size.face,material,0,y,-spanZ/2));
    group.add(box(spanX,size.depth,size.face,material,0,y,spanZ/2));
    group.add(box(size.face,size.depth,spanZ,material,-spanX/2,y,0));
    group.add(box(size.face,size.depth,spanZ,material,spanX/2,y,0));
    const members=spacedPositions(c.length);
    members.forEach(x=>group.add(box(size.face,size.depth,spanZ,material,x,y,0)));
    for(let i=0;i<members.length-1;i++){
      const a=members[i]+size.face/2,b=members[i+1]-size.face/2;
      if(b-a>.075) group.add(box(b-a,size.depth,size.face,material,(a+b)/2,y,0));
    }
  }

  function wallNogginLinear(face,c,size){
    const span=face==='A'||face==='B'?c.length:c.width;
    const rowY=c.height/2,opens=apertures(face,c),studs=spacedPositions(span);
    let total=0;
    for(let i=0;i<studs.length-1;i++){
      const start=studs[i]+size.face/2,end=studs[i+1]-size.face/2;
      subtractOpenings(start,end,rowY,opens,size.face/2).forEach(([a,b])=>total+=b-a);
    }
    return total;
  }

  function framingNogginLinearMeters(){
    const s=ensureInteriorSystem(),c=DATA.containers[state.container],size=memberSize();
    let total=0;
    ['A','B','C','D'].forEach(face=>{if(s.framingFaces[face]) total+=wallNogginLinear(face,c,size);});
    if(s.framingFaces.E){
      const members=spacedPositions(c.length);
      for(let i=0;i<members.length-1;i++) total+=Math.max(0,members[i+1]-members[i]-size.face);
    }
    return Math.round(total*100)/100;
  }

  function installBomAdjustment(){
    if(typeof buildBOM!=='function'||window.BAT_KUBIQUEITOR_NOGGIN_BOM) return;
    const buildBOMBeforeNoggins=buildBOM;
    buildBOM=function(){
      const items=buildBOMBeforeNoggins();
      const extraLinear=framingNogginLinearMeters();
      if(extraLinear<=0) return items;
      const s=ensureInteriorSystem();
      if(s.framing==='wood'){
        const item=items.find(x=>x.key==='woodFrame');
        if(item){item.qty=Math.ceil((Number(item.qty||0)+extraLinear)*100)/100;item.subtotal=item.qty*item.unitCost;}
      }else{
        const item=items.find(x=>x.key==='stud');
        if(item){item.qty+=Math.ceil(extraLinear/3);item.subtotal=item.qty*item.unitCost;}
      }
      return items;
    };
    window.BAT_KUBIQUEITOR_NOGGIN_BOM=true;
  }

  function addInteriorFramingVisuals(){
    if(!containerGroup) return;
    const s=ensureInteriorSystem(),c=DATA.containers[state.container],material=frameMaterial(),size=memberSize();
    const group=new THREE.Group();
    group.name='interior-framing-visuals';
    group.userData.system='framing';
    if(s.framingFaces.A) addLongWallFrame(group,'A',c,material,size);
    if(s.framingFaces.B) addLongWallFrame(group,'B',c,material,size);
    if(s.framingFaces.C) addEndWallFrame(group,'C',c,material,size);
    if(s.framingFaces.D) addEndWallFrame(group,'D',c,material,size);
    if(s.framingFaces.E) addCeilingFrame(group,c,material,size);
    containerGroup.add(group);
  }

  function install(){
    if(!ready()) return false;
    installBomAdjustment();
    const rebuildBeforeFramingVisuals=rebuild3D;
    rebuild3D=function(){
      rebuildBeforeFramingVisuals();
      addInteriorFramingVisuals();
    };
    window.addInteriorFramingVisuals=addInteriorFramingVisuals;
    window.framingNogginLinearMeters=framingNogginLinearMeters;
    window.BAT_KUBIQUEITOR_FRAMING_VISUALS=true;
    rebuild3D();
    setTimeout(loadMaterialVisuals,20);
    return true;
  }

  if(!install()){
    let attempts=0;
    const timer=setInterval(()=>{
      attempts++;
      if(install()||attempts>100) clearInterval(timer);
    },80);
  }
})();
