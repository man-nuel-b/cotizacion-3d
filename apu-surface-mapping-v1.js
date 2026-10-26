// BAT-Cubikeitor · Surface geometry → Excel APU mapping v1
// Maps real container wall/ceiling/floor areas to Excel APU items.
// Pricing only: does not mutate 3D geometry or editor state.
(function(){
  if(window.BAT_KUBIQUEITOR_APU_SURFACE_MAPPING) return;

  const n=(v,f=0)=>{const x=Number(v);return Number.isFinite(x)?x:f;};
  const r2=v=>Math.round(n(v)*100)/100;
  const SURFACE_FACES=['A','B','C','D','E'];

  function master(){try{return typeof getApuMaster==='function'?getApuMaster():null;}catch(e){return null;}}
  function apu(code){return master()?.apus?.[`excel:${code}`]||null;}
  function breakdown(code){try{return typeof getApuExcelBreakdown==='function'?getApuExcelBreakdown(`excel:${code}`):null;}catch(e){return null;}}

  function excelItem(code,qty,meta={}){
    qty=Math.max(0,n(qty));
    const a=apu(code);if(!a||qty<=0)return null;
    const b=breakdown(code)||{};
    const unitCost=Math.max(0,n(b.net));
    const directUnitCost=Math.max(0,n(b.direct,unitCost));
    return {
      key:`excel-surface:${code}:${meta.surface||'surface'}`,
      apuId:`excel:${code}`,
      excelCode:code,
      name:a.name||code,
      qty:r2(qty),unit:meta.unit||a.unit||'m²',
      unitCost,subtotal:qty*unitCost,
      directUnitCost,directSubtotal:qty*directUnitCost,
      apuBreakdown:b,excelApu:true,modelMapped:true,surfaceMapped:true,
      ...meta
    };
  }

  function dimensions(type,index,fallbackW,fallbackH){
    let d={width:fallbackW,height:fallbackH};
    try{if(typeof objectDimensions==='function')d={...d,...objectDimensions(type,index)};}catch(e){}
    return {width:Math.max(0,n(d.width,fallbackW)),height:Math.max(0,n(d.height,fallbackH))};
  }
  function openingArea(type,index,fallbackW,fallbackH){const d=dimensions(type,index,fallbackW,fallbackH);return d.width*d.height;}
  function openingFace(type,index){
    try{
      if(typeof actualLayout==='function'){
        const face=actualLayout(type,index)?.face;
        if(['A','B','C','D'].includes(face))return face;
      }
    }catch(e){}
    if(type==='window'){
      const face=state?.layout?.window?.[index]?.face;
      if(['A','B','C','D'].includes(face))return face;
      return 'B';
    }
    return 'A';
  }

  function faceGeometry(){
    const c=DATA?.containers?.[state?.container];
    if(!c)return {A:0,B:0,C:0,D:0,E:0};
    const areas={A:n(c.length)*n(c.height),B:n(c.length)*n(c.height),C:n(c.width)*n(c.height),D:n(c.width)*n(c.height),E:n(c.length)*n(c.width)};
    const wc=Math.max(0,Math.round(n(state?.counts?.window))),dc=Math.max(0,Math.round(n(state?.counts?.door)));
    for(let i=0;i<wc;i++){
      const face=openingFace('window',i);areas[face]=Math.max(0,areas[face]-openingArea('window',i,1.21,1.0));
    }
    for(let i=0;i<dc;i++){
      const face=openingFace('door',i);areas[face]=Math.max(0,areas[face]-openingArea('door',i,.90,2.05));
    }
    Object.keys(areas).forEach(k=>areas[k]=r2(areas[k]));
    return areas;
  }

  function geometry(){
    const c=DATA?.containers?.[state?.container];
    if(!c)return {wallGross:0,openingArea:0,wallNet:0,floor:0,ceiling:0,faces:{A:0,B:0,C:0,D:0,E:0}};
    const wallGross=2*(n(c.length)*n(c.height))+2*(n(c.width)*n(c.height));
    let openings=0;
    const wc=Math.max(0,Math.round(n(state?.counts?.window)));
    const dc=Math.max(0,Math.round(n(state?.counts?.door)));
    for(let i=0;i<wc;i++)openings+=openingArea('window',i,1.21,1.0);
    for(let i=0;i<dc;i++)openings+=openingArea('door',i,.90,2.05);
    const floor=n(c.length)*n(c.width);
    return {wallGross:r2(wallGross),openingArea:r2(openings),wallNet:r2(Math.max(0,wallGross-openings)),floor:r2(floor),ceiling:r2(floor),faces:faceGeometry()};
  }

  function floorCode(){
    return ({spc_oak:'P01',spc_light:'P02',spc_concrete:'P03',vinyl_roll:'P04',sanitary_vinyl:'P05',porcelain_r10:'P06',epoxy:'P07'})[state?.floorFinish]||null;
  }

  function selectedFaces(extraKey){
    const list=state?.surfaceExtras?.[extraKey]?.faces;
    return Array.isArray(list)?[...new Set(list.filter(face=>SURFACE_FACES.includes(face)))]:[];
  }
  function selectedArea(extraKey,g){return r2(selectedFaces(extraKey).reduce((sum,face)=>sum+n(g.faces?.[face]),0));}

  function surfaceItems(){
    const g=geometry(),items=[];
    const add=(code,qty,meta)=>{const x=excelItem(code,qty,meta);if(x)items.push(x);};

    // Muros interiores perimetrales. P14/P17 already include structure, insulation and lining.
    if(state?.finish==='sanitary') add('P17',g.wallNet,{surface:'walls',sourceObject:'containerWalls'});
    else if(state?.finish==='basic'){
      add('P10',g.wallNet,{surface:'walls-structure',sourceObject:'containerWalls'});
      add('P22',g.wallNet,{surface:'walls-insulation',sourceObject:'containerWalls'});
      add('P34',g.wallNet,{surface:'walls-lining',sourceObject:'containerWalls'});
    } else add('P14',g.wallNet,{surface:'walls',sourceObject:'containerWalls'});

    // Ceiling: finished solutions receive complete ceiling APU. Basic warehouse keeps original shell.
    if(state?.finish!=='basic') add('P16',g.ceiling,{surface:'ceiling',sourceObject:'containerCeiling'});

    // Floor: structural subfloor plus selected visible finish.
    add('P47',g.floor,{surface:'floor-base',sourceObject:'containerFloor'});
    const f=floorCode();if(f)add(f,g.floor,{surface:'floor-finish',sourceObject:'containerFloor'});

    // Optional exterior treatments selected explicitly by face.
    const grateadoFaces=selectedFaces('grateado'),pinturaFaces=selectedFaces('pintura');
    add('P44',selectedArea('grateado',g),{surface:'exterior-grateado',sourceObject:'containerExterior',faces:grateadoFaces});
    add('P45',selectedArea('pintura',g),{surface:'exterior-paint',sourceObject:'containerExterior',faces:pinturaFaces});
    return items;
  }

  function shouldRemoveLegacy(item){
    if(!item)return false;
    const finish=DATA?.finishes?.[state?.finish]||{};
    const keys=new Set([finish.lining,finish.insulation,finish.flooring,'stud','track','screws','floor-base-structural']);
    // Once face-based surface extras are active, the old global paint quantity must not be charged in parallel.
    if(state?.surfaceExtras)keys.add('paint');
    if(keys.has(item.key))return true;
    if(typeof item.key==='string'&&item.key.startsWith('floor-'))return true;
    return false;
  }

  function install(){
    if(typeof buildBOM!=='function'||typeof getApuExcelBreakdown!=='function')return false;
    if(buildBOM.__batSurfaceMapping)return true;
    const before=buildBOM;
    buildBOM=function(){
      const base=before.apply(this,arguments)||[];
      const filtered=base.filter(item=>!shouldRemoveLegacy(item));
      return filtered.concat(surfaceItems());
    };
    buildBOM.__batSurfaceMapping=true;
    buildBOM.__previous=before;
    window.getSurfaceApuSnapshot=function(){
      const g=geometry();
      return {...g,finish:state?.finish,floorFinish:state?.floorFinish||null,surfaceExtras:state?.surfaceExtras||null,mapped:surfaceItems().map(x=>({code:x.excelCode,qty:x.qty,unit:x.unit,surface:x.surface,faces:x.faces||null}))};
    };
    window.BAT_KUBIQUEITOR_APU_SURFACE_MAPPING={version:2,snapshot:window.getSurfaceApuSnapshot};
    try{if(typeof renderAll==='function')renderAll();}catch(e){}
    return true;
  }

  let tries=0;const timer=setInterval(()=>{
    tries++;
    if(window.BAT_KUBIQUEITOR_APU_3D_MAPPING&&window.BAT_KUBIQUEITOR_APU_EXCEL_ACCOUNTING&&install())clearInterval(timer);
    else if(tries>180){install();clearInterval(timer);}
  },100);
})();
