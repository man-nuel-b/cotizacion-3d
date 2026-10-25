// BAT-Cubikeitor · Model → Cost bridge v1
// Reads real model state and dimensions to improve BOM quantities.
// It never changes geometry, camera, drag behavior or editor state.
(function(){
  if(window.BAT_KUBIQUEITOR_MODEL_COST_BRIDGE) return;

  const n=(value,fallback=0)=>{const x=Number(value);return Number.isFinite(x)?x:fallback;};
  const round2=value=>Math.round(n(value)*100)/100;

  function realObjectCount(type){
    if(type==='electrical'&&Array.isArray(state?.electrical?.points)) return state.electrical.points.length;
    return Math.max(0,Math.round(n(state?.counts?.[type])));
  }

  function partitionMetrics(){
    const c=DATA?.containers?.[state?.container];
    if(!c) return {count:0,singleFaceArea:0,doubleFaceArea:0,insulationArea:0,doorOpeningArea:0,studs:0,tracksMeters:0};
    const count=realObjectCount('partition');
    let singleFaceArea=0,doorOpeningArea=0,studs=0,tracksMeters=0;
    for(let i=0;i<count;i++){
      let d={length:c.width,height:c.height,thickness:.075};
      try{ if(typeof objectDimensions==='function') d={...d,...objectDimensions('partition',i)}; }catch(e){}
      const length=Math.max(.30,n(d.length,c.width));
      const height=Math.max(1,n(d.height,c.height));
      singleFaceArea+=length*height;
      studs+=Math.max(2,Math.ceil(length/.60)+1);
      tracksMeters+=length*2;
      const door=Array.isArray(state?.interiorDoors)?state.interiorDoors[i]:null;
      if(door){
        const width=Math.max(0,n(door.width,.82));
        const doorHeight=Math.max(0,n(door.height,2.05));
        doorOpeningArea+=Math.min(length*height,width*doorHeight);
      }
    }
    return {
      count,
      singleFaceArea:round2(singleFaceArea),
      doubleFaceArea:round2(Math.max(0,singleFaceArea*2-doorOpeningArea*2)),
      insulationArea:round2(Math.max(0,singleFaceArea-doorOpeningArea)),
      doorOpeningArea:round2(doorOpeningArea),
      studs,
      tracksMeters:round2(tracksMeters)
    };
  }

  function modelSnapshot(){
    return {
      version:1,
      counts:{
        window:realObjectCount('window'),door:realObjectCount('door'),partition:realObjectCount('partition'),
        wc:realObjectCount('wc'),sink:realObjectCount('sink'),shower:realObjectCount('shower'),
        ac:realObjectCount('ac'),electrical:realObjectCount('electrical')
      },
      partitions:partitionMetrics()
    };
  }

  function enhanceBom(base){
    if(!Array.isArray(base)) return base;
    const c=DATA?.containers?.[state?.container],finish=DATA?.finishes?.[state?.finish];
    if(!c||!finish) return base;
    const p=partitionMetrics();
    const wallGross=2*(c.length*c.height)+2*(c.width*c.height);
    const openings=realObjectCount('window')*1.2+realObjectCount('door')*1.8;
    const wallNet=Math.max(0,wallGross-openings);
    const liningArea=wallNet+p.doubleFaceArea;
    const insulationArea=wallNet+p.insulationArea;
    const waste=1.10;
    const lining=DATA.catalog?.[finish.lining],insulation=DATA.catalog?.[finish.insulation];
    const perimeterStuds=Math.ceil((2*c.length+2*c.width)/.60);
    const studs=perimeterStuds+p.studs;
    const tracks=Math.ceil(((2*(c.length+c.width))+p.tracksMeters)/3);

    const out=base.map(item=>({...item}));
    const setQty=(key,qty)=>{
      const item=out.find(x=>x.key===key);
      if(!item) return;
      item.qty=Math.max(0,Math.ceil(qty));
      item.subtotal=item.qty*n(item.unitCost);
      item.modelDriven=true;
    };
    if(lining?.coverage) setQty(finish.lining,(liningArea*waste)/lining.coverage);
    if(insulation?.coverage) setQty(finish.insulation,(insulationArea*waste)/insulation.coverage);
    setQty('stud',studs);
    setQty('track',tracks);

    const liningQty=n(out.find(x=>x.key===finish.lining)?.qty);
    const studQty=n(out.find(x=>x.key==='stud')?.qty);
    const trackQty=n(out.find(x=>x.key==='track')?.qty);
    setQty('screws',Math.max(1,Math.ceil((liningQty+studQty+trackQty)/20)));
    return out;
  }

  function install(){
    if(typeof buildBOM!=='function'||typeof state==='undefined'||typeof DATA==='undefined') return false;
    if(buildBOM.__batModelCostBridge) return true;
    const previous=buildBOM;
    const wrapped=function(){ return enhanceBom(previous.apply(this,arguments)); };
    wrapped.__batModelCostBridge=true;
    wrapped.__previous=previous;
    buildBOM=wrapped;
    window.getModelCostSnapshot=modelSnapshot;
    window.getPartitionCostMetrics=partitionMetrics;
    window.BAT_KUBIQUEITOR_MODEL_COST_BRIDGE={version:1,snapshot:modelSnapshot,partitions:partitionMetrics};
    try{ if(typeof renderAll==='function') renderAll(); }catch(e){}
    return true;
  }

  let tries=0;
  const timer=setInterval(()=>{
    tries++;
    const apuReady=!('BAT_KUBIQUEITOR_APU_MASTER' in window)||Boolean(window.BAT_KUBIQUEITOR_APU_MASTER);
    if(apuReady&&install()) clearInterval(timer);
    else if(tries>80){ install(); clearInterval(timer); }
  },100);
})();