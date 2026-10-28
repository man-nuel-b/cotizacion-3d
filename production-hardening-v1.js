// Production hardening layer: authoritative wall apertures + geometry-aware BOM.
(function(){
  if(window.BAT_KUBIQUEITOR_PRODUCTION_HARDENING?.version>=1) return;

  const APERTURE_TYPES=['window','door','opening','openingFrame','windowOpening','windowOpeningFrame'];
  const WINDOW_TYPES=new Set(['window','windowOpening','windowOpeningFrame']);
  const CLEARANCE=.08;
  let shellInstalled=false;
  let bomInstalled=false;
  let rebuildWrapped=false;

  const clampLocal=(v,min,max)=>Math.min(max,Math.max(min,v));

  function safeDims(type,index){
    try{return typeof objectDimensions==='function'?(objectDimensions(type,index)||{}):{};}catch(e){return{};}
  }

  function safeLayout(type,index){
    try{return typeof actualLayout==='function'?(actualLayout(type,index)||{}):{};}catch(e){return{};}
  }

  function faceFor(type,index){
    const layout=safeLayout(type,index);
    try{return layout.face||MOUNTED_FACE_TYPES?.[type]?.defaultFace||'A';}catch(e){return layout.face||'A';}
  }

  function apertureBounds(type,index,c){
    const d=safeDims(type,index),layout=safeLayout(type,index);
    const isWindow=WINDOW_TYPES.has(type);
    const width=Math.max(.20,Number(d.width)||(isWindow?1.20:.98));
    const height=Math.max(.20,Number(d.height)||(isWindow?1.05:2.08));
    let bottom,top;
    if(isWindow){
      const half=height/2;
      const center=clampLocal(c.height*.60,half+.15,c.height-half-.15);
      bottom=center-half;
      top=center+half;
    }else{
      bottom=.02;
      top=Math.min(c.height-CLEARANCE,bottom+height);
    }
    const center=Number(layout.x)||0;
    return {type,index,center,width,left:center-width/2,right:center+width/2,bottom,top};
  }

  function aperturesForFace(face,c){
    const out=[];
    APERTURE_TYPES.forEach(type=>{
      const count=Number(state?.counts?.[type])||0;
      for(let i=0;i<count;i++){
        if(faceFor(type,i)!==face) continue;
        out.push(apertureBounds(type,i,c));
      }
    });
    return out;
  }

  function mergeIntervals(intervals,min,max){
    const cleaned=intervals
      .map(([a,b])=>[clampLocal(a,min,max),clampLocal(b,min,max)])
      .filter(([a,b])=>b-a>.001)
      .sort((a,b)=>a[0]-b[0]);
    const merged=[];
    cleaned.forEach(pair=>{
      const last=merged[merged.length-1];
      if(!last||pair[0]>last[1]+.001) merged.push(pair.slice());
      else last[1]=Math.max(last[1],pair[1]);
    });
    return merged;
  }

  function addWallWithCuts(parent,{axis,axisMin,axisMax,yMin,yMax,position,thickness,material,openings}){
    const boundaries=[axisMin,axisMax];
    openings.forEach(o=>{
      boundaries.push(clampLocal(o.left,axisMin,axisMax));
      boundaries.push(clampLocal(o.right,axisMin,axisMax));
    });
    const values=[...new Set(boundaries.map(v=>Number(v.toFixed(4))))].sort((a,b)=>a-b);
    for(let i=0;i<values.length-1;i++){
      const a=values[i],b=values[i+1];
      if(b-a<.002) continue;
      const mid=(a+b)/2;
      const blocked=mergeIntervals(
        openings.filter(o=>mid>o.left+.0005&&mid<o.right-.0005).map(o=>[o.bottom,o.top]),
        yMin,yMax
      );
      let cursor=yMin;
      const add=(lo,hi)=>{
        if(hi-lo<.002) return;
        const span=b-a,height=hi-lo,centerAxis=(a+b)/2,centerY=(lo+hi)/2;
        parent.add(axis==='x'
          ? box(span,height,thickness,material,centerAxis,centerY,position)
          : box(thickness,height,span,material,position,centerY,centerAxis));
      };
      blocked.forEach(([lo,hi])=>{add(cursor,lo);cursor=Math.max(cursor,hi);});
      add(cursor,yMax);
    }
  }

  function addRibWithCuts(parent,{x,z,thickness,depth,material,yMin,yMax,openings}){
    const blocked=mergeIntervals(
      openings.filter(o=>x>o.left-.015&&x<o.right+.015).map(o=>[o.bottom,o.top]),
      yMin,yMax
    );
    let cursor=yMin;
    const add=(lo,hi)=>{
      if(hi-lo<.01) return;
      parent.add(box(thickness,hi-lo,depth,material,x,(lo+hi)/2,z));
    };
    blocked.forEach(([lo,hi])=>{add(cursor,lo);cursor=Math.max(cursor,hi);});
    add(cursor,yMax);
  }

  function authoritativeShell(c,materials){
    const g=new THREE.Group();
    const L=c.length,W=c.width,H=c.height;
    const {exterior,interior,frame,floor}=materials;
    const yMin=.08,yMax=H-.08,postW=.13;
    const faces={
      A:aperturesForFace('A',c),B:aperturesForFace('B',c),
      C:aperturesForFace('C',c),D:aperturesForFace('D',c)
    };

    g.add(box(L,.14,W,floor,0,.02,0));
    [-L/2,L/2].forEach(x=>[-W/2,W/2].forEach(z=>g.add(box(postW,H+.12,postW,frame,x,H/2,z))));
    g.add(box(L,.11,.12,frame,0,.07,-W/2));
    g.add(box(L,.11,.12,frame,0,.07,W/2));
    g.add(box(L,.11,.12,frame,0,H-.03,-W/2));
    g.add(box(L,.11,.12,frame,0,H-.03,W/2));

    addWallWithCuts(g,{axis:'x',axisMin:-L/2+.10,axisMax:L/2-.10,yMin,yMax,position:-W/2,thickness:.055,material:exterior,openings:faces.B});
    if(!state.cutaway) addWallWithCuts(g,{axis:'x',axisMin:-L/2+.10,axisMax:L/2-.10,yMin,yMax,position:W/2,thickness:.045,material:exterior,openings:faces.A});
    addWallWithCuts(g,{axis:'z',axisMin:-W/2+.09,axisMax:W/2-.09,yMin,yMax,position:L/2,thickness:.075,material:exterior,openings:faces.C});
    addWallWithCuts(g,{axis:'z',axisMin:-W/2+.09,axisMax:W/2-.09,yMin,yMax,position:-L/2,thickness:.075,material:exterior,openings:faces.D});

    // Interior lining follows the same apertures on every wall so openings remain real from inside.
    addWallWithCuts(g,{axis:'x',axisMin:-L/2+.14,axisMax:L/2-.14,yMin:.14,yMax:H-.14,position:-W/2+.055,thickness:.018,material:interior,openings:faces.B});
    if(!state.cutaway) addWallWithCuts(g,{axis:'x',axisMin:-L/2+.14,axisMax:L/2-.14,yMin:.14,yMax:H-.14,position:W/2-.055,thickness:.018,material:interior,openings:faces.A});
    addWallWithCuts(g,{axis:'z',axisMin:-W/2+.14,axisMax:W/2-.14,yMin:.14,yMax:H-.14,position:L/2-.055,thickness:.018,material:interior,openings:faces.C});
    addWallWithCuts(g,{axis:'z',axisMin:-W/2+.14,axisMax:W/2-.14,yMin:.14,yMax:H-.14,position:-L/2+.055,thickness:.018,material:interior,openings:faces.D});

    if(!state.cutaway) g.add(box(L-.12,.07,W-.12,exterior,0,H,0));
    else g.add(box(L-.24,.06,.08,frame,0,H-.02,W/2));

    const ribMat=mat(new THREE.Color(state.exteriorColor).multiplyScalar(.78),{roughness:.62,metalness:.2});
    const spacing=.32,count=Math.floor((L-.3)/spacing);
    for(let i=0;i<=count;i++){
      const x=-L/2+.18+i*spacing;
      addRibWithCuts(g,{x,z:-W/2-.038,thickness:.028,depth:.022,material:ribMat,yMin:.13,yMax:H-.12,openings:faces.B});
      if(!state.cutaway) addRibWithCuts(g,{x,z:W/2+.038,thickness:.028,depth:.022,material:ribMat,yMin:.13,yMax:H-.12,openings:faces.A});
    }

    const blockMat=mat(0x172033,{roughness:.45,metalness:.55});
    [-L/2,L/2].forEach(x=>[-W/2,W/2].forEach(z=>[.08,H-.08].forEach(y=>g.add(box(.23,.15,.23,blockMat,x,y,z)))));
    return g;
  }

  function installAuthoritativeShell(){
    if(shellInstalled) return true;
    if(typeof THREE==='undefined'||typeof box!=='function'||typeof mat!=='function'||typeof createContainerShell!=='function'||typeof actualLayout!=='function'||typeof objectDimensions!=='function') return false;
    createContainerShell=authoritativeShell;
    shellInstalled=true;
    return true;
  }

  function exactOpeningArea(){
    let area=0;
    APERTURE_TYPES.forEach(type=>{
      const count=Number(state?.counts?.[type])||0;
      for(let i=0;i<count;i++){
        const d=safeDims(type,i),isWindow=WINDOW_TYPES.has(type);
        const width=Math.max(.20,Number(d.width)||(isWindow?1.20:.98));
        const height=Math.max(.20,Number(d.height)||(isWindow?1.05:2.08));
        area+=width*height;
      }
    });
    return area;
  }

  function partitionMetrics(c){
    let gross=0,doorCuts=0,totalLength=0;
    const count=Number(state?.counts?.partition)||0;
    for(let i=0;i<count;i++){
      const d=safeDims('partition',i);
      const length=Math.max(.20,Number(d.length)||Number(d.width)||Math.max(.60,c.width-.20));
      const height=Math.max(.20,Number(d.height)||Math.max(1,c.height-.15));
      gross+=length*height*2;
      totalLength+=length;
      const door=state?.interiorDoors?.[i];
      if(door&&door.enabled!==false){
        const dw=Math.max(.40,Number(door.width)||.82),dh=Math.max(.80,Number(door.height)||2.05);
        doorCuts+=Math.min(length*height,dw*dh)*2;
      }
    }
    return {gross,doorCuts,totalLength};
  }

  function replaceQty(items,key,qty){
    const item=items.find(row=>row.key===key);
    if(!item) return;
    item.qty=Math.max(0,Math.ceil(qty));
    item.subtotal=item.qty*item.unitCost;
  }

  function installGeometryAwareBOM(){
    if(bomInstalled) return true;
    if(typeof buildBOM!=='function'||typeof DATA==='undefined') return false;
    const baseBuildBOM=buildBOM;
    buildBOM=function(){
      const items=baseBuildBOM();
      try{
        const c=DATA.containers[state.container],finish=DATA.finishes[state.finish];
        if(!c||!finish) return items;
        const wallGross=2*(c.length*c.height)+2*(c.width*c.height);
        const openingArea=Math.min(wallGross,exactOpeningArea());
        const pm=partitionMetrics(c);
        const usablePartitionArea=Math.max(0,pm.gross-pm.doorCuts);
        const liningArea=Math.max(0,wallGross-openingArea)+usablePartitionArea;
        const insulationArea=Math.max(0,wallGross-openingArea)+(usablePartitionArea/2);
        const floorArea=c.length*c.width;
        const exteriorArea=Math.max(0,wallGross-openingArea)+floorArea;
        const lining=DATA.catalog[finish.lining],insulation=DATA.catalog[finish.insulation],flooring=DATA.catalog[finish.flooring];
        const waste=1.10;

        if(lining?.coverage) replaceQty(items,finish.lining,(liningArea*waste)/lining.coverage);
        if(insulation?.coverage) replaceQty(items,finish.insulation,(insulationArea*waste)/insulation.coverage);
        if(flooring?.coverage) replaceQty(items,finish.flooring,(floorArea*waste)/flooring.coverage);

        const apertureCount=APERTURE_TYPES.reduce((sum,type)=>sum+(Number(state?.counts?.[type])||0),0);
        const studs=Math.ceil(((2*c.length+2*c.width)/.6)+(pm.totalLength/.6)+apertureCount*2);
        const tracks=Math.ceil(((2*(c.length+c.width))+(pm.totalLength*2)+(openingArea*.18))/3);
        replaceQty(items,'stud',studs);
        replaceQty(items,'track',tracks);

        const liningQty=items.find(row=>row.key===finish.lining)?.qty||0;
        const studQty=items.find(row=>row.key==='stud')?.qty||0;
        const trackQty=items.find(row=>row.key==='track')?.qty||0;
        replaceQty(items,'screws',Math.max(1,Math.ceil((liningQty+studQty+trackQty)/20)));
        if(DATA.catalog.paint?.coverage) replaceQty(items,'paint',Math.max(1,Math.ceil((exteriorArea*2)/DATA.catalog.paint.coverage)));

        items.forEach(item=>{item.subtotal=item.qty*item.unitCost;});
        return items;
      }catch(e){
        console.warn('bat-kubiqueitor: no se pudo aplicar cubicación geométrica',e);
        return items;
      }
    };
    bomInstalled=true;
    window.projectGeometryMetrics=function(){
      const c=DATA.containers[state.container],pm=partitionMetrics(c);
      return {openingArea:exactOpeningArea(),partitionGrossArea:pm.gross,partitionDoorCutArea:pm.doorCuts,partitionLength:pm.totalLength};
    };
    return true;
  }

  function installRebuildGuard(){
    if(rebuildWrapped||typeof rebuild3D!=='function') return false;
    const baseRebuild=rebuild3D;
    rebuild3D=function(){
      if(shellInstalled) createContainerShell=authoritativeShell;
      return baseRebuild();
    };
    rebuildWrapped=true;
    return true;
  }

  function addEditorGeometryStatus(){
    const panel=document.getElementById('object-editor');
    if(!panel||typeof showEditorPanel!=='function'||showEditorPanel.__geometryStatusV1) return false;
    const baseShow=showEditorPanel;
    const wrapped=function(root){
      const result=baseShow(root);
      const old=panel.querySelector('[data-geometry-status]');
      old?.remove();
      const meta=root?.userData?.editor;
      if(meta&&['window','door'].includes(meta.type)){
        const d=safeDims(meta.type,meta.index),layout=safeLayout(meta.type,meta.index);
        const status=document.createElement('div');
        status.dataset.geometryStatus='true';
        status.className='mt-3 rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-[10px] text-emerald-100';
        status.innerHTML=`<div class="font-black uppercase tracking-wider text-emerald-300">Vinculado a cubicación</div><div class="mt-1">Cara ${layout.face||'A'} · ${(Number(d.width)||0).toFixed(2)} × ${(Number(d.height)||0).toFixed(2)} m · el hueco y materiales se recalculan con estas medidas.</div>`;
        const deleteBtn=panel.querySelector('button[onclick*="deleteSelectedObject"]');
        if(deleteBtn) panel.insertBefore(status,deleteBtn); else panel.appendChild(status);
      }
      return result;
    };
    wrapped.__geometryStatusV1=true;
    showEditorPanel=wrapped;
    return true;
  }

  function install(){
    const a=installAuthoritativeShell();
    const b=installGeometryAwareBOM();
    installRebuildGuard();
    addEditorGeometryStatus();
    if(a&&b){
      window.BAT_KUBIQUEITOR_PRODUCTION_HARDENING={version:1,apertureTypes:[...APERTURE_TYPES]};
      try{rebuild3D();renderAll?.();}catch(e){}
      return true;
    }
    return false;
  }

  let tries=0;
  const timer=setInterval(()=>{
    tries++;
    if(install()){clearInterval(timer);return;}
    if(tries>=240){
      clearInterval(timer);
      console.error('bat-kubiqueitor: production-hardening-v1 no pudo instalarse completamente');
    }
  },100);
})();
