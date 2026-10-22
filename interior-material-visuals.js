// Independent 3D visuals for insulation and interior sheet finishes.
// Makes the construction layers visibly verifiable while editing Interior.
(function(){
  if(window.BAT_KUBIQUEITOR_MATERIAL_VISUALS) return;

  const STUD_SPACING=.60;
  const SHEET_W=1.20;
  const SHEET_H=2.40;
  const PANEL_GAP=.012;

  function ready(){
    return typeof THREE!=='undefined'&&typeof state!=='undefined'&&typeof DATA!=='undefined'&&
      typeof ensureInteriorSystem==='function'&&typeof rebuild3D==='function'&&typeof box==='function'&&
      typeof mat==='function'&&window.BAT_KUBIQUEITOR_FRAMING_VISUALS;
  }

  function ensurePreview(){
    const s=ensureInteriorSystem();
    if(!['framing','insulation','lining'].includes(s.previewLayer)) s.previewLayer='lining';
    return s;
  }

  function apertures(face,c){
    if(typeof windowsForFace!=='function') return [];
    try{return windowsForFace(face,c)||[];}catch(e){return [];}
  }

  function spacedPositions(span,inset=.15){
    const min=-span/2+inset,max=span/2-inset,out=[];
    if(max<=min) return [min,max];
    for(let p=min;p<=max+.001;p+=STUD_SPACING) out.push(Math.min(p,max));
    if(Math.abs(out[out.length-1]-max)>.10) out.push(max);
    return [...new Set(out.map(v=>Math.round(v*1000)/1000))];
  }

  function intervals(start,end,step){
    const out=[];
    for(let a=start;a<end-.001;a+=step) out.push([a,Math.min(end,a+step)]);
    return out;
  }

  function openingRects(face,c){
    return apertures(face,c).map(open=>({
      x1:(Number(open.center)||0)-(Math.max(0,Number(open.width)||0)/2)-.012,
      x2:(Number(open.center)||0)+(Math.max(0,Number(open.width)||0)/2)+.012,
      y1:Math.max(.12,Number.isFinite(Number(open.bottom))?Number(open.bottom):.12)-.012,
      y2:Math.min(c.height-.12,Number.isFinite(Number(open.top))?Number(open.top):c.height-.12)+.012
    }));
  }

  function subtractRect(rect,cut){
    const ix1=Math.max(rect.x1,cut.x1),ix2=Math.min(rect.x2,cut.x2),iy1=Math.max(rect.y1,cut.y1),iy2=Math.min(rect.y2,cut.y2);
    if(ix1>=ix2||iy1>=iy2) return [rect];
    const out=[];
    if(rect.x1<ix1) out.push({x1:rect.x1,x2:ix1,y1:rect.y1,y2:rect.y2});
    if(ix2<rect.x2) out.push({x1:ix2,x2:rect.x2,y1:rect.y1,y2:rect.y2});
    if(rect.y1<iy1) out.push({x1:ix1,x2:ix2,y1:rect.y1,y2:iy1});
    if(iy2<rect.y2) out.push({x1:ix1,x2:ix2,y1:iy2,y2:rect.y2});
    return out.filter(r=>r.x2-r.x1>.045&&r.y2-r.y1>.045);
  }

  function subtractCuts(rect,cuts){
    let parts=[rect];
    cuts.forEach(cut=>{parts=parts.flatMap(part=>subtractRect(part,cut));});
    return parts;
  }

  function removeLegacyCladding(){
    if(!containerGroup) return;
    ['interior-cladding-system','interior-insulation-visuals','interior-finish-visuals'].forEach(name=>{
      for(let i=containerGroup.children.length-1;i>=0;i--){
        if(containerGroup.children[i]?.name===name) containerGroup.remove(containerGroup.children[i]);
      }
    });
  }

  function insulationMaterial(key){
    if(key==='mineralwool') return mat(0x9da07b,{roughness:.98,metalness:0,transparent:true,opacity:.88,depthWrite:false});
    if(key==='eps') return mat(0xe8f2f5,{roughness:.82,metalness:0,transparent:true,opacity:.90,depthWrite:false});
    return mat(0xe8c35b,{roughness:.96,metalness:0,transparent:true,opacity:.90,depthWrite:false});
  }

  function insulationAccentMaterial(key){
    if(key==='mineralwool') return mat(0x6f7256,{roughness:1,metalness:0,transparent:true,opacity:.70,depthWrite:false});
    if(key==='eps') return mat(0xb7d7df,{roughness:.9,metalness:0,transparent:true,opacity:.65,depthWrite:false});
    return mat(0xc79b31,{roughness:1,metalness:0,transparent:true,opacity:.70,depthWrite:false});
  }

  function liningMaterial(key){
    if(key==='fibrocement') return mat(0xb5b8b6,{roughness:.88,metalness:.01});
    if(key==='plywood') return mat(0xc88e4e,{roughness:.72,metalness:.01});
    if(key==='osb') return mat(0xb57b45,{roughness:.82,metalness:.01});
    if(key==='pvc') return mat(0xf7fafc,{roughness:.28,metalness:.02});
    return mat(0xeeeae3,{roughness:.76,metalness:.01});
  }

  function addLongInsulation(group,face,c,material,accent,key){
    const z=face==='A'?c.width/2-.142:-c.width/2+.142;
    const studs=spacedPositions(c.length),cuts=openingRects(face,c);
    for(let i=0;i<studs.length-1;i++){
      const x1=studs[i]+.035,x2=studs[i+1]-.035;
      const rows=[[.19,c.height/2-.045],[c.height/2+.045,c.height-.19]];
      rows.forEach(([y1,y2])=>subtractCuts({x1,x2,y1,y2},cuts).forEach(r=>{
        const w=r.x2-r.x1,h=r.y2-r.y1;if(w<=.04||h<=.04) return;
        group.add(box(w,h,.035,material,(r.x1+r.x2)/2,(r.y1+r.y2)/2,z));
        if(key==='mineralwool'&&h>.22) group.add(box(w*.92,.012,.038,accent,(r.x1+r.x2)/2,(r.y1+r.y2)/2,z+(face==='A'?-.003:.003)));
      }));
    }
  }

  function addEndInsulation(group,face,c,material,accent,key){
    const x=face==='C'?c.length/2-.152:-c.length/2+.152;
    const studs=spacedPositions(c.width),cuts=openingRects(face,c);
    for(let i=0;i<studs.length-1;i++){
      const z1=studs[i]+.035,z2=studs[i+1]-.035;
      const rows=[[.19,c.height/2-.045],[c.height/2+.045,c.height-.19]];
      rows.forEach(([y1,y2])=>subtractCuts({x1:z1,x2:z2,y1,y2},cuts).forEach(r=>{
        const w=r.x2-r.x1,h=r.y2-r.y1;if(w<=.04||h<=.04) return;
        group.add(box(.035,h,w,material,x,(r.y1+r.y2)/2,(r.x1+r.x2)/2));
        if(key==='mineralwool'&&h>.22) group.add(box(.038,.012,w*.92,accent,x+(face==='C'?-.003:.003),(r.y1+r.y2)/2,(r.x1+r.x2)/2));
      }));
    }
  }

  function addCeilingInsulation(group,c,material,accent,key){
    const y=c.height-.158;
    const xs=spacedPositions(c.length),zs=spacedPositions(c.width);
    for(let i=0;i<xs.length-1;i++) for(let j=0;j<zs.length-1;j++){
      const x1=xs[i]+.035,x2=xs[i+1]-.035,z1=zs[j]+.035,z2=zs[j+1]-.035;
      const w=x2-x1,d=z2-z1;if(w<=.04||d<=.04) continue;
      group.add(box(w,.035,d,material,(x1+x2)/2,y,(z1+z2)/2));
      if(key==='mineralwool') group.add(box(w*.86,.038,.012,accent,(x1+x2)/2,y-.003,(z1+z2)/2));
    }
  }

  function addInsulationVisuals(){
    if(!containerGroup) return;
    const s=ensurePreview(),c=DATA.containers[state.container],key=s.insulation;
    const material=insulationMaterial(key),accent=insulationAccentMaterial(key);
    const group=new THREE.Group();group.name='interior-insulation-visuals';group.userData.layer='insulation';group.userData.material=key;
    if(s.insulationFaces.A) addLongInsulation(group,'A',c,material,accent,key);
    if(s.insulationFaces.B) addLongInsulation(group,'B',c,material,accent,key);
    if(s.insulationFaces.C) addEndInsulation(group,'C',c,material,accent,key);
    if(s.insulationFaces.D) addEndInsulation(group,'D',c,material,accent,key);
    if(s.insulationFaces.E) addCeilingInsulation(group,c,material,accent,key);
    containerGroup.add(group);
  }

  function addLongFinish(group,face,c,material){
    if(state.cutaway&&face==='A') return;
    const z=face==='A'?c.width/2-.184:-c.width/2+.184;
    const cuts=openingRects(face,c),min=-c.length/2+.15,max=c.length/2-.15;
    intervals(min,max,SHEET_W).forEach(([x1,x2])=>intervals(.15,c.height-.15,SHEET_H).forEach(([y1,y2])=>{
      subtractCuts({x1,x2,y1,y2},cuts).forEach(r=>{
        const w=r.x2-r.x1-PANEL_GAP,h=r.y2-r.y1-PANEL_GAP;if(w<=.035||h<=.035) return;
        group.add(box(w,h,.016,material,(r.x1+r.x2)/2,(r.y1+r.y2)/2,z));
      });
    }));
  }

  function addEndFinish(group,face,c,material){
    const x=face==='C'?c.length/2-.194:-c.length/2+.194;
    const cuts=openingRects(face,c),min=-c.width/2+.15,max=c.width/2-.15;
    intervals(min,max,SHEET_W).forEach(([z1,z2])=>intervals(.15,c.height-.15,SHEET_H).forEach(([y1,y2])=>{
      subtractCuts({x1:z1,x2:z2,y1,y2},cuts).forEach(r=>{
        const w=r.x2-r.x1-PANEL_GAP,h=r.y2-r.y1-PANEL_GAP;if(w<=.035||h<=.035) return;
        group.add(box(.016,h,w,material,x,(r.y1+r.y2)/2,(r.x1+r.x2)/2));
      });
    }));
  }

  function addCeilingFinish(group,c,material){
    if(state.cutaway) return;
    const y=c.height-.205,minX=-c.length/2+.15,maxX=c.length/2-.15,minZ=-c.width/2+.15,maxZ=c.width/2-.15;
    intervals(minX,maxX,SHEET_H).forEach(([x1,x2])=>intervals(minZ,maxZ,SHEET_W).forEach(([z1,z2])=>{
      const w=x2-x1-PANEL_GAP,d=z2-z1-PANEL_GAP;if(w<=.035||d<=.035) return;
      group.add(box(w,.016,d,material,(x1+x2)/2,y,(z1+z2)/2));
    }));
  }

  function addFinishVisuals(){
    if(!containerGroup) return;
    const s=ensurePreview(),c=DATA.containers[state.container],material=liningMaterial(s.lining);
    const group=new THREE.Group();group.name='interior-finish-visuals';group.userData.layer='lining';group.userData.material=s.lining;
    if(s.liningFaces.A) addLongFinish(group,'A',c,material);
    if(s.liningFaces.B) addLongFinish(group,'B',c,material);
    if(s.liningFaces.C) addEndFinish(group,'C',c,material);
    if(s.liningFaces.D) addEndFinish(group,'D',c,material);
    if(s.liningFaces.E) addCeilingFinish(group,c,material);
    if(s.liningFaces.F&&typeof createFloorMaterial==='function') group.add(box(c.length-.30,.018,c.width-.30,createFloorMaterial(),0,.095,0));
    containerGroup.add(group);
  }

  function setPreview(layer){
    const s=ensurePreview();s.previewLayer=layer;
  }

  function installPreviewHooks(){
    if(window.BAT_KUBIQUEITOR_LAYER_PREVIEW_HOOKS) return;
    if(typeof selectInteriorFraming==='function'){
      const before=selectInteriorFraming;selectInteriorFraming=function(key){setPreview('framing');return before(key);};
    }
    if(typeof selectInteriorInsulation==='function'){
      const before=selectInteriorInsulation;selectInteriorInsulation=function(key){setPreview('insulation');return before(key);};
    }
    if(typeof selectInteriorLining==='function'){
      const before=selectInteriorLining;selectInteriorLining=function(key){setPreview('lining');return before(key);};
    }
    if(typeof toggleInteriorLayerFace==='function'){
      const before=toggleInteriorLayerFace;toggleInteriorLayerFace=function(layer,face){setPreview(layer);return before(layer,face);};
    }
    if(typeof setInteriorLayerFaces==='function'){
      const before=setInteriorLayerFaces;setInteriorLayerFaces=function(layer,value){setPreview(layer);return before(layer,value);};
    }
    window.BAT_KUBIQUEITOR_LAYER_PREVIEW_HOOKS=true;
  }

  function renderMaterialLayers(){
    removeLegacyCladding();
    const s=ensurePreview();
    if(s.previewLayer==='insulation') addInsulationVisuals();
    else if(s.previewLayer==='lining') addFinishVisuals();
    // framing preview intentionally leaves only the framing rendered by framing-visuals.js.
  }

  function install(){
    if(!ready()) return false;
    ensurePreview();installPreviewHooks();
    const rebuildBeforeMaterialVisuals=rebuild3D;
    rebuild3D=function(){rebuildBeforeMaterialVisuals();renderMaterialLayers();};
    window.renderInteriorMaterialLayers=renderMaterialLayers;
    window.BAT_KUBIQUEITOR_MATERIAL_VISUALS=true;
    rebuild3D();
    return true;
  }

  if(!install()){
    let attempts=0;
    const timer=setInterval(()=>{
      attempts++;
      if(install()||attempts>120) clearInterval(timer);
    },80);
  }
})();
