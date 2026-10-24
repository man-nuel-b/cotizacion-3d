// Independent floor system: structural base + selectable visible finish.
// Owns floor UI, floor 3D and floor cost contributions. It never overrides BOM/calculate.
(function(){
  if(window.BAT_KUBIQUEITOR_FLOOR_FINISHES) return;

  const FLOORS={
    spc_oak:{name:'SPC Roble Natural',short:'SPC Roble',desc:'Oficinas y uso diario',badge:'Recomendado',costM2:22990,laborM2:6500,waste:1.08,color:0xb58a5b,pattern:'wood'},
    spc_light:{name:'SPC Roble Claro',short:'SPC Claro',desc:'Oficinas luminosas y recepción',costM2:22990,laborM2:6500,waste:1.08,color:0xd7c3a2,pattern:'wood'},
    spc_concrete:{name:'SPC Cemento',short:'SPC Cemento',desc:'Oficinas industriales y camarines',costM2:24990,laborM2:7000,waste:1.08,color:0x9ca3af,pattern:'slab'},
    vinyl_roll:{name:'Vinílico continuo',short:'Vinílico',desc:'Comedores, camarines y alto tránsito',costM2:14990,laborM2:7000,waste:1.10,color:0xb9c0c8,pattern:'sheet'},
    sanitary_vinyl:{name:'Vinílico sanitario antideslizante',short:'Sanitario',desc:'Baños y zonas húmedas',badge:'Sanitario',costM2:21990,laborM2:9500,waste:1.10,color:0x9bb6b5,pattern:'speckle'},
    porcelain_r10:{name:'Porcelanato antideslizante R10',short:'Porcelanato R10',desc:'Baños y terminación premium',badge:'Premium',costM2:23990,laborM2:17500,waste:1.12,color:0xc9c7c2,pattern:'tile',ancillaryM2:6500},
    epoxy:{name:'Piso epóxico industrial',short:'Epóxico',desc:'Taller, laboratorio y sala técnica',costM2:29990,laborM2:14000,waste:1.05,color:0x7d8792,pattern:'epoxy'}
  };
  const RECOMMENDED={office:'spc_oak',officeBath:'spc_oak',bathrooms:'sanitary_vinyl',locker:'sanitary_vinyl',dining:'vinyl_roll',warehouse:'epoxy',custom:'spc_oak'};
  const BASE={name:'Subpiso estructural OSB 18 mm',coverage:2.98,cost:28990,laborM2:4500,waste:1.08};

  function ensure(){
    if(!state.floorFinish||!FLOORS[state.floorFinish]) state.floorFinish=RECOMMENDED[state.solution]||'spc_oak';
    return FLOORS[state.floorFinish];
  }
  function floorArea(){const c=DATA.containers[state.container];return c.length*c.width;}

  function makeTexture(kind,color){
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=512;const ctx=canvas.getContext('2d');
    ctx.fillStyle='#'+new THREE.Color(color).getHexString();ctx.fillRect(0,0,512,512);
    if(kind==='wood'){
      ctx.strokeStyle='rgba(70,45,25,.30)';ctx.lineWidth=3;for(let y=0;y<=512;y+=64){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(512,y);ctx.stroke();}
      ctx.strokeStyle='rgba(255,255,255,.18)';ctx.lineWidth=2;for(let y=0;y<512;y+=64){for(let x=(y/64)%2?80:0;x<512;x+=160){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,y+64);ctx.stroke();}}
    }else if(kind==='tile'){
      ctx.strokeStyle='rgba(90,90,90,.25)';ctx.lineWidth=3;for(let n=0;n<=512;n+=128){ctx.beginPath();ctx.moveTo(n,0);ctx.lineTo(n,512);ctx.stroke();ctx.beginPath();ctx.moveTo(0,n);ctx.lineTo(512,n);ctx.stroke();}
    }else if(kind==='slab'){
      ctx.strokeStyle='rgba(60,70,80,.14)';ctx.lineWidth=2;for(let x=0;x<=512;x+=180){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,512);ctx.stroke();}
    }else if(kind==='speckle'){
      for(let i=0;i<700;i++){ctx.fillStyle=i%2?'rgba(255,255,255,.20)':'rgba(30,60,60,.14)';ctx.fillRect(Math.random()*512,Math.random()*512,2,2);}
    }else if(kind==='epoxy'){
      for(let i=0;i<250;i++){ctx.fillStyle='rgba(255,255,255,.10)';ctx.fillRect(Math.random()*512,Math.random()*512,1.5,1.5);}
    }
    const tex=new THREE.CanvasTexture(canvas);tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.repeat.set(6,3);tex.anisotropy=4;return tex;
  }

  function renderVisual(){
    if(!containerGroup||typeof THREE==='undefined') return;
    const f=ensure(),c=DATA.containers[state.container];
    const tex=makeTexture(f.pattern,f.color);
    const material=new THREE.MeshStandardMaterial({color:f.color,map:tex,roughness:f.pattern==='epoxy'?.42:.72,metalness:f.pattern==='epoxy'?.08:.01});
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(c.length-.22,.032,c.width-.22),material);
    mesh.position.set(0,.125,0);mesh.receiveShadow=true;mesh.name='selected-floor-finish';mesh.userData.floorFinishOverlay=true;containerGroup.add(mesh);
  }

  function renderUI(){
    ensure();
    let host=document.getElementById('floor-finish-selector');
    if(!host){host=document.createElement('div');host.id='floor-finish-selector';host.className='mt-5';document.getElementById('finish-list')?.insertAdjacentElement('afterend',host);}
    if(!host)return;
    host.innerHTML=`<div class="flex items-end justify-between gap-3 mb-2"><div><label class="block text-xs font-black text-slate-700">Terminación de piso</label><div class="text-[10px] text-slate-400 mt-0.5">Base estructural + acabado visible · precios referenciales</div></div><span class="text-[9px] font-black uppercase tracking-wider text-amber-700 bg-amber-100 px-2 py-1 rounded-full">Chile</span></div><div class="grid gap-2">${Object.entries(FLOORS).map(([key,item])=>`<button type="button" onclick="selectFloorFinish('${key}')" class="option-card ${state.floorFinish===key?'active':''} border rounded-xl p-3 text-left flex gap-3 items-center"><span class="w-10 h-10 rounded-xl border shrink-0" style="background:#${new THREE.Color(item.color).getHexString()}"></span><span class="min-w-0 flex-1"><strong class="block text-sm">${item.name}${item.badge?` <span class='text-[9px] text-amber-600'>${item.badge}</span>`:''}</strong><small class="block text-[10px] text-slate-500 mt-0.5">${item.desc}</small></span><span class="text-[10px] font-bold text-slate-500">${money(item.costM2)}/m²</span></button>`).join('')}</div>`;
    window.BAT_KUBIQUEITOR_SIX_STEP_WIZARD?.sync?.();
  }

  window.getFloorBOMItems=function(){
    const f=ensure(),area=floorArea(),baseQty=Math.ceil((area*BASE.waste)/BASE.coverage),finishQty=Number((area*f.waste).toFixed(1));
    const items=[
      {key:'floor-base-structural',name:BASE.name,qty:baseQty,unit:'plancha',unitCost:BASE.cost,subtotal:baseQty*BASE.cost,category:'Piso'},
      {key:`floor-${state.floorFinish}`,name:f.name,qty:finishQty,unit:'m²',unitCost:f.costM2,subtotal:finishQty*f.costM2,category:'Piso'}
    ];
    if(f.ancillaryM2)items.push({key:`floor-${state.floorFinish}-ancillary`,name:'Adhesivo + fragüe para piso',qty:finishQty,unit:'m²',unitCost:f.ancillaryM2,subtotal:finishQty*f.ancillaryM2,category:'Piso'});
    return items;
  };
  window.getFloorLaborCost=function(){const f=ensure();return floorArea()*(BASE.laborM2+f.laborM2);};
  window.renderFloorFinishUI=renderUI;
  window.renderFloorFinishVisual=renderVisual;
  window.applyRecommendedFloorForSolution=function(solution){state.floorFinish=RECOMMENDED[solution]||state.floorFinish||'spc_oak';};
  window.selectFloorFinish=function(key){if(!FLOORS[key])return;pushHistory();state.floorFinish=key;renderAll();toast(`${FLOORS[key].name} seleccionado`);};

  const rebuild3DBeforeFloor=rebuild3D;
  rebuild3D=function(){rebuild3DBeforeFloor();renderVisual();};
  const renderAllBeforeFloor=renderAll;
  renderAll=function(){ensure();renderAllBeforeFloor();renderUI();};

  ensure();renderUI();
  window.BAT_KUBIQUEITOR_FLOOR_FINISHES={version:3,floors:FLOORS,recommended:RECOMMENDED,renderVisual,renderUI};
})();