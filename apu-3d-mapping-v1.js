// BAT-Cubikeitor · 3D → Excel APU mapping v1
// Replaces legacy generic APU lines with the corresponding Excel library items.
// Pricing only: never mutates geometry/editor state.
(function(){
  if(window.BAT_KUBIQUEITOR_APU_3D_MAPPING) return;

  const GENERIC_IDS=new Set(['window','door','partition','wc','sink','shower','ac','electrical']);
  const n=(v,f=0)=>{const x=Number(v);return Number.isFinite(x)?x:f;};
  const round2=v=>Math.round(n(v)*100)/100;

  function excelApu(id){
    try{return typeof getApuMaster==='function'?getApuMaster()?.apus?.[`excel:${id}`]:null;}catch(e){return null;}
  }
  function breakdown(code){
    try{return typeof getApuExcelBreakdown==='function'?getApuExcelBreakdown(`excel:${code}`):null;}catch(e){return null;}
  }
  function itemFor(code,qty,meta={}){
    const apu=excelApu(code);if(!apu||qty<=0)return null;
    const b=breakdown(code)||{};
    const unitCost=Math.max(0,n(b.net));
    const directUnitCost=Math.max(0,n(b.direct,unitCost));
    return {
      key:`excel-apu:${code}`,
      apuId:`excel:${code}`,
      excelCode:code,
      name:apu.name||`${code}`,
      qty:round2(qty),
      unit:meta.unit||apu.unit||'un',
      unitCost,
      subtotal:qty*unitCost,
      directUnitCost,
      directSubtotal:qty*directUnitCost,
      apuBreakdown:b,
      excelApu:true,
      modelMapped:true,
      ...meta
    };
  }

  function count(type){return Math.max(0,Math.round(n(state?.counts?.[type])));}
  function partitionArea(){
    try{return Math.max(0,n(getPartitionCostMetrics?.()?.singleFaceArea));}catch(e){}
    const c=DATA?.containers?.[state?.container];
    return c?count('partition')*n(c.width)*n(c.height):0;
  }
  function windowCode(index){
    let d={width:1.21,height:1};
    try{if(typeof objectDimensions==='function')d={...d,...objectDimensions('window',index)};}catch(e){}
    const w=n(d.width,1.21),h=n(d.height,1);
    if(w>=1.40&&h>=1.75)return 'P85';
    if(w<=1.05&&h<=0.75)return 'P84';
    return 'P83';
  }
  function windowCounts(){
    const out={P83:0,P84:0,P85:0};
    for(let i=0;i<count('window');i++)out[windowCode(i)]++;
    return out;
  }
  function interiorDoorCounts(){
    const out={P80:0,P81:0};
    const doors=Array.isArray(state?.interiorDoors)?state.interiorDoors:[];
    doors.forEach(d=>{if(!d)return;const w=n(d.width,.82);if(w<=.75)out.P80++;else out.P81++;});
    return out;
  }
  function electricalCounts(){
    const pts=Array.isArray(state?.electrical?.points)?state.electrical.points:[];
    if(!pts.length)return {P70:0,P71:count('electrical'),P72:0};
    let lights=0,switches=0,outlets=0,power=0;
    pts.forEach(p=>{
      if(p?.type==='light')lights++;
      else if(p?.type==='switch')switches++;
      else if(p?.type==='acPoint')power++;
      else outlets++;
    });
    return {P70:Math.max(lights,switches),P71:outlets,P72:power};
  }

  function mappedItems(){
    const items=[];
    const add=(code,qty,meta)=>{const x=itemFor(code,qty,meta);if(x)items.push(x);};

    // Tabiquería real medida desde el modelo.
    add('P12',partitionArea(),{sourceObject:'partition',unit:'m²'});

    // Puertas interiores insertadas en tabiques.
    const interior=interiorDoorCounts();
    add('P80',interior.P80,{sourceObject:'interiorDoor'});
    add('P81',interior.P81,{sourceObject:'interiorDoor'});

    // Artefactos sanitarios.
    add('P60',count('wc'),{sourceObject:'wc'});
    add('P61',count('sink'),{sourceObject:'sink'});
    add('P62',count('shower'),{sourceObject:'shower'});

    // Aberturas visibles. El corte/refuerzo del vano se cotiza aparte según tipo.
    add('P82',count('door'),{sourceObject:'door'});
    add('P40',count('door'),{sourceObject:'doorOpening'});
    const wc=windowCounts();
    add('P83',wc.P83,{sourceObject:'window'}); add('P41',wc.P83,{sourceObject:'windowOpening'});
    add('P84',wc.P84,{sourceObject:'window'}); add('P42',wc.P84,{sourceObject:'windowOpening'});
    add('P85',wc.P85,{sourceObject:'window'}); add('P43',wc.P85,{sourceObject:'windowOpening'});

    // Climatización.
    add('P75',count('ac'),{sourceObject:'ac'});

    // Electricidad semántica del editor.
    const e=electricalCounts();
    add('P70',e.P70,{sourceObject:'electricalLight'});
    add('P71',e.P71,{sourceObject:'electricalOutlet'});
    add('P72',e.P72,{sourceObject:'electricalPower'});
    return items;
  }

  function install(){
    if(typeof buildBOM!=='function'||typeof getApuMaster!=='function'||typeof getApuExcelBreakdown!=='function')return false;
    if(buildBOM.__bat3dExcelMapping)return true;
    const before=buildBOM;
    buildBOM=function(){
      const base=before.apply(this,arguments)||[];
      const filtered=base.filter(item=>!(item?.apuId&&GENERIC_IDS.has(item.apuId)));
      return filtered.concat(mappedItems());
    };
    buildBOM.__bat3dExcelMapping=true;
    buildBOM.__previous=before;
    window.get3dApuMappingSnapshot=function(){
      return {
        partitionM2:round2(partitionArea()),
        windows:windowCounts(),
        interiorDoors:interiorDoorCounts(),
        electrical:electricalCounts(),
        mapped:mappedItems().map(x=>({code:x.excelCode,qty:x.qty,unit:x.unit,source:x.sourceObject}))
      };
    };
    window.BAT_KUBIQUEITOR_APU_3D_MAPPING={version:1,snapshot:window.get3dApuMappingSnapshot};
    try{if(typeof renderAll==='function')renderAll();}catch(e){}
    return true;
  }

  let tries=0;
  const timer=setInterval(()=>{
    tries++;
    const catalogReady=Boolean(window.BAT_KUBIQUEITOR_EXCEL_APU_CATALOG);
    if(catalogReady&&install())clearInterval(timer);
    else if(tries>160){install();clearInterval(timer);}
  },100);
})();
