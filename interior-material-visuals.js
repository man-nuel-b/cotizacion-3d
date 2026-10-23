// Persistent 3D assembly layers for insulation and interior sheet finishes.
// Framing + insulation + lining coexist. Editing a buried layer only changes visibility for inspection.
(function(){
  if(window.BAT_KUBIQUEITOR_MATERIAL_VISUALS) return;

  const STUD_SPACING=.60;
  const SHEET_W=1.20;
  const SHEET_H=2.40;
  const PANEL_GAP=.012;
  const FACES=['A','B','C','D','E'];

  function ready(){
    return typeof THREE!=='undefined'&&typeof state!=='undefined'&&typeof DATA!=='undefined'&&
      typeof ensureInteriorSystem==='function'&&typeof rebuild3D==='function'&&typeof box==='function'&&
      typeof mat==='function'&&window.BAT_KUBIQUEITOR_FRAMING_VISUALS;
  }

  function assemblyState(){
    const s=ensureInteriorSystem();
    if(typeof window.normalizeInteriorLayerDependencies==='function') window.normalizeInteriorLayerDependencies();
    if(!['framing','insulation','lining','assembly'].includes(s.previewLayer)) s.previewLayer='assembly';
    FACES.forEach(face=>{
      if(!s.framingFaces?.[face]){
        if(s.insulationFaces) s.insulationFaces[face]=false;
        if(s.liningFaces) s.liningFaces[face]=false;
      }
    });
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
    if(!out.length||Math.abs(out[out.length-1]-max)>.10) out.push(max);
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

  function removeGeneratedLayers(){
    if(!containerGroup) return;
    const names=new Set(['interior-cladding-system','interior-insulation-visuals','interior-finish-visuals']);
    for(let i=containerGroup.children.length-1;i>=0;i--){
      if(names.has(containerGroup.children[i]?.name)) containerGroup.remove(containerGroup.children[i]);
    }
  }

  function insulationMaterial(key){
    if(key==='mineralwool') return mat(0x9ca279,{roughness:.98,metalness:0,transparent:true,opacity:.94,depthWrite:true});
    if(key==='eps') return mat(0xe6f0f2,{roughness:.82,metalness:0,transparent:true,opacity:.96,depthWrite:true});
    return mat(0xe6bc4d,{roughness:.96,metalness:0,transparent:true,opacity:.94,depthWrite:true});
  }

  function insulationAccentMaterial(key){
    if(key==='mineralwool') return mat(0x666b4d,{roughness:1,metalness:0});
    if(key==='eps') return mat(0xb5d5dd,{roughness:.9,metalness:0});
    return mat(0xc28d23,{roughness:1,metalness:0});
  }

  function liningMaterial(key){
    if(key==='fibrocement') return mat(0xb4b7b5,{roughness:.9,metalness:.01});
    if(key==='plywood') return mat(0xc88e4e,{roughness:.72,metalness:.01});
    if(key==='osb') return mat(0xb57b45,{roughness:.82,metalness:.01});
    if(key==='pvc') return mat(0xf7fafc,{roughness:.28,metalness:.02});
    return mat(0xeeeae3,{roughness:.76,metalness:.01});
  }

  function addLongInsulation(group,face,c,material,accent,key){
    const z=face==='A'?c.width/2-.145:-c.width/2+.145;
    const studs=spacedPositions(c.length),cuts=openingRects(face,c);
    for(let i=0;i<studs.length-1;i++){
      const x1=studs[i]+.032,x2=studs[i+1]-.032;
      const rows=[[.19,c.height/2-.05],[c.height/2+.05,c.height-.19]];
      rows.forEach(([y1,y2])=>subtractCuts({x1,x2,y1,y2},cuts).forEach(r=>{
        const w=r.x2-r.x1,h=r.y2-r.y1;
        if(w<=.04||h<=.04) return;
        group.add(box(w,h,.045,material,(r.x1+r.x2)/2,(r.y1+r.y2)/2,z));
        if(key==='mineralwool'&&h>.20) group.add(box(w*.90,.018,.049,accent,(r.x1+r.x2)/2,(r.y1+r.y2)/2,z));
      }));
    }
  }

  function addEndInsulation(group,face,c,material,accent,key){
    const x=face==='C'?c.length/2-.155:-c.length/2+.155;
    const studs=spacedPositions(c.width),cuts=openingRects(face,c);
    for(let i=0;i<studs.length-1;i++){
      const z1=studs[i]+.032,z2=studs[i+1]-.032;
      const rows=[[.19,c.height/2-.05],[c.height/2+.05,c.height-.19]];
      rows.forEach(([y1,y2])=>subtractCuts({x1:z1,x2:z2,y1,y2},cuts).forEach(r=>{
        const w=r.x2-r.x1,h=r.y2-r.y1;
        if(w<=.04||h<=.04) return;
        group.add(box(.045,h,w,material,x,(r.y1+r.y2)/2,(r.x1+r.x2)/2));
        if(key==='mineralwool'&&h>.20) group.add(box(.049,.018,w*.90,accent,x,(r.y1+r.y2)/2,(r.x1+r.x2)/2));
      }));
    }
  }

  function addCeilingInsulation(group,c,material,accent,key){
    const y=c.height-.165;
    const xs=spacedPositions(c.length),zs=spacedPositions(c.width);
    for(let i=0;i<xs.length-1;i++) for(let j=0;j<zs.length-1;j++){
      const x1=xs[i]+.032,x2=xs[i+1]-.032,z1=zs[j]+.032,z2=zs[j+1]-.032;
      const w=x2-x1,d=z2-z1;
      if(w<=.04||d<=.04) continue;
      group.add(box(w,.045,d,material,(x1+x2)/2,y,(z1+z2)/2));
      if(key==='mineralwool') group.add(box(w*.86,.049,.018,accent,(x1+x2)/2,y,(z1+z2)/2));
    }
  }

  function buildInsulationGroup(){
    const s=assemblyState(),c=DATA.containers[state.container],key=s.insulation;
    const material=insulationMaterial(key),accent=insulationAccentMaterial(key);
    const group=new THREE.Group();
    group.name='interior-insulation-visuals';
    group.userData.layer='insulation';
    group.userData.material=key;
    if(s.insulationFaces?.A) addLongInsulation(group,'A',c,material,accent,key);
    if(s.insulationFaces?.B) addLongInsulation(group,'B',c,material,accent,key);
    if(s.insulationFaces?.C) addEndInsulation(group,'C',c,material,accent,key);
    if(s.insulationFaces?.D) addEndInsulation(group,'D',c,material,accent,key);
    if(s.insulationFaces?.E) addCeilingInsulation(group,c,material,accent,key);
    return group;
  }

  function addLongFinish(group,face,c,material){
    if(state.cutaway&&face==='A') return;
    const z=face==='A'?c.width/2-.205:-c.width/2+.205;
    const cuts=openingRects(face,c),min=-c.length/2+.15,max=c.length/2-.15;
    intervals(min,max,SHEET_W).forEach(([x1,x2])=>intervals(.15,c.height-.15,SHEET_H).forEach(([y1,y2])=>{
      subtractCuts({x1,x2,y1,y2},cuts).forEach(r=>{
        const w=r.x2-r.x1-PANEL_GAP,h=r.y2-r.y1-PANEL_GAP;
        if(w<=.035||h<=.035) return;
        group.add(box(w,h,.018,material,(r.x1+r.x2)/2,(r.y1+r.y2)/2,z));
      });
    }));
  }

  function addEndFinish(group,face,c,material){
    const x=face==='C'?c.length/2-.215:-c.length/2+.215;
    const cuts=openingRects(face,c),min=-c.width/2+.15,max=c.width/2-.15;
    intervals(min,max,SHEET_W).forEach(([z1,z2])=>intervals(.15,c.height-.15,SHEET_H).forEach(([y1,y2])=>{
      subtractCuts({x1:z1,x2:z2,y1,y2},cuts).forEach(r=>{
        const w=r.x2-r.x1-PANEL_GAP,h=r.y2-r.y1-PANEL_GAP;
        if(w<=.035||h<=.035) return;
        group.add(box(.018,h,w,material,x,(r.y1+r.y2)/2,(r.x1+r.x2)/2));
      });
    }));
  }

  function addCeilingFinish(group,c,material){
    if(state.cutaway) return;
    const y=c.height-.225,minX=-c.length/2+.15,maxX=c.length/2-.15,minZ=-c.width/2+.15,maxZ=c.width/2-.15;
    intervals(minX,maxX,SHEET_H).forEach(([x1,x2])=>intervals(minZ,maxZ,SHEET_W).forEach(([z1,z2])=>{
      const w=x2-x1-PANEL_GAP,d=z2-z1-PANEL_GAP;
      if(w<=.035||d<=.035) return;
      group.add(box(w,.018,d,material,(x1+x2)/2,y,(z1+z2)/2));
    }));
  }

  function buildFinishGroup(){
    const s=assemblyState(),c=DATA.containers[state.container],material=liningMaterial(s.lining);
    const group=new THREE.Group();
    group.name='interior-finish-visuals';
    group.userData.layer='lining';
    group.userData.material=s.lining;
    if(s.liningFaces?.A) addLongFinish(group,'A',c,material);
    if(s.liningFaces?.B) addLongFinish(group,'B',c,material);
    if(s.liningFaces?.C) addEndFinish(group,'C',c,material);
    if(s.liningFaces?.D) addEndFinish(group,'D',c,material);
    if(s.liningFaces?.E) addCeilingFinish(group,c,material);
    return group;
  }

  function renderAssemblyLayers(){
    if(!containerGroup) return;
    removeGeneratedLayers();
    const s=assemblyState();
    const insulation=buildInsulationGroup();
    const finish=buildFinishGroup();

    // Las dos capas siempre se construyen y permanecen en la escena.
    // Para inspeccionar aislación se oculta temporalmente el revestimiento.
    insulation.visible=s.previewLayer!=='framing';
    finish.visible=s.previewLayer!=='framing'&&s.previewLayer!=='insulation';

    containerGroup.add(insulation);
    containerGroup.add(finish);
  }

  function installFallbackPreviewHooks(){
    if(window.BAT_KUBIQUEITOR_ASSEMBLY_PREVIEW_HOOKS) return;
    const wrap=(name,layer)=>{
      const fn=window[name];
      if(typeof fn!=='function') return;
      window[name]=function(...args){
        const s=assemblyState();
        s.previewLayer=layer;
        return fn.apply(this,args);
      };
    };
    wrap('selectInteriorFraming','framing');
    wrap('selectInteriorInsulation','insulation');
    wrap('selectInteriorLining','lining');
    window.BAT_KUBIQUEITOR_ASSEMBLY_PREVIEW_HOOKS=true;
  }

  function install(){
    if(!ready()) return false;
    installFallbackPreviewHooks();
    const before=rebuild3D;
    rebuild3D=function(){
      before();
      renderAssemblyLayers();
    };
    window.renderInteriorMaterialLayers=renderAssemblyLayers;
    window.BAT_KUBIQUEITOR_MATERIAL_VISUALS=true;
    rebuild3D();
    return true;
  }

  if(!install()){
    let attempts=0;
    const timer=setInterval(()=>{
      attempts++;
      if(install()||attempts>150) clearInterval(timer);
    },80);
  }
})();
