// BAT-Cubikeitor · Planos de materiales por sistema v2
// Dynamic plans: only shows systems actually requested/present in the current project.
(function(){
  if(window.BAT_KUBIQUEITOR_PROJECT_MATERIAL_PLAN_FILTERED) return;
  const n=(v,f=0)=>{const x=Number(v);return Number.isFinite(x)?x:f;};
  const esc=t=>String(t??'').replace(/[&<>\'\"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[ch]));
  let active='all';

  function ctn(){return DATA?.containers?.[state?.container]||null;}
  function count(type){return Math.max(0,Math.round(n(state?.counts?.[type])));}
  function master(){try{return typeof getApuMaster==='function'?getApuMaster():null;}catch(e){return null;}}
  function apu(code){return master()?.apus?.[`excel:${code}`]||null;}
  function mats(code,limit=8){const m=master(),a=apu(code);if(!m||!a)return [];return (a.components||[]).map(c=>m.resources?.[c.resourceId]).filter(r=>r&&r.type==='material').map(r=>({code:r.code||'',name:r.name||'',unit:r.unit||''})).slice(0,limit);}
  function floorCode(){return ({spc_oak:'P01',spc_light:'P02',spc_concrete:'P03',vinyl_roll:'P04',sanitary_vinyl:'P05',porcelain_r10:'P06',epoxy:'P07'})[state?.floorFinish]||null;}
  function wallCodes(){if(state?.finish==='sanitary')return ['P17'];if(state?.finish==='basic')return ['P10','P22','P34'];return ['P14'];}
  function electricalPoints(){return Array.isArray(state?.electrical?.points)?state.electrical.points:[];}

  function systems(){
    const out=[{id:'all',label:'Todos',icon:'fa-layer-group',codes:[]}];
    if(count('partition'))out.push({id:'partitions',label:'Tabiquería',icon:'fa-grip-lines-vertical',codes:['P12']});
    if(count('wc')||count('sink')||count('shower'))out.push({id:'sanitary',label:'Sanitario',icon:'fa-toilet',codes:[count('wc')&&'P60',count('sink')&&'P61',count('shower')&&'P62'].filter(Boolean)});
    if(count('electrical')||electricalPoints().length)out.push({id:'electrical',label:'Eléctrico',icon:'fa-bolt',codes:['P70','P71','P72']});
    if(count('door')||count('window'))out.push({id:'openings',label:'Puertas y ventanas',icon:'fa-door-open',codes:[count('door')&&'P82',count('door')&&'P40',count('window')&&'P83',count('window')&&'P84',count('window')&&'P85',count('window')&&'P41',count('window')&&'P42',count('window')&&'P43'].filter(Boolean)});
    out.push({id:'floors',label:'Pisos',icon:'fa-border-all',codes:['P47',floorCode()].filter(Boolean)});
    out.push({id:'linings',label:'Revestimientos',icon:'fa-paint-roller',codes:[...wallCodes(),state?.finish!=='basic'?'P16':null].filter(Boolean)});
    if(count('ac'))out.push({id:'hvac',label:'Climatización',icon:'fa-wind',codes:['P75']});
    return out;
  }

  function layout(type,index){
    try{if(typeof actualLayout==='function')return actualLayout(type,index);}catch(e){}
    const c=ctn(),s=state?.layout?.[type]?.[index]||{};if(!c)return {x:0,z:0};
    if(type==='partition')return {x:Number.isFinite(s.x)?s.x:-c.length/2+((index+1)*c.length/(count('partition')+1))};
    if(type==='window')return {face:s.face||'B',x:Number.isFinite(s.x)?s.x:0};
    if(type==='door'||type==='ac')return {x:Number.isFinite(s.x)?s.x:0};
    if(['wc','sink','shower'].includes(type))return {x:Number.isFinite(s.x)?s.x:0,z:Number.isFinite(s.z)?s.z:0};
    return {x:0,z:0};
  }
  function ep(i){try{if(typeof actualLayout==='function')return {...electricalPoints()[i],...actualLayout('electrical',i)};}catch(e){}const p=electricalPoints()[i]||{};return {...p,face:p.face||'B',x:n(p.position?.x),z:n(p.position?.z),y:n(p.height,.35)};}

  function legendFor(system){
    const defs={
      partitions:[['Tabiques interiores','P12']],
      sanitary:[['WC','P60'],['Lavamanos','P61'],['Duchas','P62']],
      electrical:[['Alumbrado','P70'],['Enchufes','P71'],['Fuerza A/C','P72']],
      openings:[['Puerta exterior','P82'],['Corte vano puerta','P40'],['Ventana estándar','P83'],['Ventana baño','P84'],['Ventanal','P85'],['Corte vano ventana','P41']],
      floors:[['Subpiso','P47'],['Terminación piso',floorCode()]],
      linings:[...wallCodes().map(c=>['Muros interiores',c]),...(state?.finish!=='basic'?[['Cielo','P16']]:[])],
      hvac:[['Aire acondicionado','P75']]
    };
    let rows=defs[system]||[];
    if(system==='all')rows=systems().filter(s=>s.id!=='all').flatMap(s=>legendFor(s).map(r=>[r.location,r.code]));
    return rows.filter(([,code])=>code&&apu(code)).map(([location,code])=>({location,code,name:apu(code)?.name||code,materials:mats(code)}));
  }

  function svg(system='all'){
    const c=ctn();if(!c)return '';
    const W=1180,H=760,planW=760,planH=360,scale=Math.min((planW-60)/c.length,(planH-50)/c.width),ox=80+(planW-c.length*scale)/2,oy=165+(planH-c.width*scale)/2;
    const sx=x=>ox+(x+c.length/2)*scale,sy=z=>oy+(c.width/2-z)*scale;
    const p=[],show=id=>system==='all'||system===id;
    const text=(x,y,t,size=13,weight=600,anchor='middle',fill='#0f172a')=>`<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="Inter,Arial,sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}">${esc(t)}</text>`;
    const badge=(x,y,label,fill)=>`<g><circle cx="${x}" cy="${y}" r="14" fill="${fill}" stroke="#fff" stroke-width="2"/>${text(x,y+4,label,9,900)}</g>`;
    p.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="100%" height="100%" fill="#f8fafc"/>`);
    const sys=systems().find(s=>s.id===system);
    p.push(text(60,42,`BAT-Cubikeitor · ${sys?.label||'Plano'}${system==='all'?' · materiales':' '}`,23,900,'start'));
    p.push(text(60,68,`${DATA?.solutions?.[state?.solution]?.name||'Proyecto'} · ${c.name} · ${c.length.toFixed(2)} × ${c.width.toFixed(2)} m`,12,600,'start','#475569'));
    p.push(`<rect x="${ox}" y="${oy}" width="${c.length*scale}" height="${c.width*scale}" rx="4" fill="#fff" stroke="#334155" stroke-width="12"/>`);

    if(show('floors')){p.push(`<rect x="${ox+7}" y="${oy+7}" width="${c.length*scale-14}" height="${c.width*scale-14}" fill="#fef3c7" opacity=".55"/>`);p.push(text(ox+c.length*scale/2,oy+c.width*scale/2,`${floorCode()||'PISO'} · Terminación piso`,14,900));}
    if(show('linings')){p.push(text(ox+c.length*scale/2,oy-22,`${wallCodes().join(' + ')} · Revestimiento muros`,11,800));if(state?.finish!=='basic')p.push(text(ox+c.length*scale/2,oy+c.width*scale+34,'P16 · Cielo',10,800));}

    if(show('partitions'))for(let i=0;i<count('partition');i++){const q=layout('partition',i),x=sx(q.x);p.push(`<line x1="${x}" y1="${oy+8}" x2="${x}" y2="${oy+c.width*scale-8}" stroke="#7c3aed" stroke-width="8"/>`);p.push(badge(x,oy+c.width*scale/2,`T${i+1}`,'#c4b5fd'));}

    if(show('openings')){
      for(let i=0;i<count('door');i++){const q=layout('door',i),x=sx(q.x),y=sy(c.width/2);p.push(`<line x1="${x-22}" y1="${y}" x2="${x+22}" y2="${y}" stroke="#fff" stroke-width="18"/>`);p.push(`<path d="M ${x-22} ${y} A 44 44 0 0 1 ${x+22} ${y-44}" fill="none" stroke="#0f172a" stroke-width="2"/>`);p.push(badge(x,y-17,`D${i+1}`,'#fdba74'));}
      for(let i=0;i<count('window');i++){const q=layout('window',i),f=q.face||'B';let x1,y1,x2,y2,bx,by;if(f==='A'||f==='B'){const x=sx(q.x),y=sy(f==='A'?c.width/2:-c.width/2);x1=x-24;x2=x+24;y1=y2=y;bx=x;by=y+(f==='A'?-18:18);}else{const x=sx(f==='C'?c.length/2:-c.length/2),y=sy(q.x);x1=x2=x;y1=y-24;y2=y+24;bx=x+(f==='C'?-18:18);by=y;}p.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#38bdf8" stroke-width="8"/>`);p.push(badge(bx,by,`V${i+1}`,'#7dd3fc'));}
    }

    if(show('sanitary'))[['wc','WC','#93c5fd'],['sink','L','#86efac'],['shower','DU','#67e8f9']].forEach(([t,l,col])=>{for(let i=0;i<count(t);i++){const q=layout(t,i),x=sx(q.x),y=sy(q.z);p.push(`<rect x="${x-17}" y="${y-13}" width="34" height="26" rx="7" fill="${col}" stroke="#0f172a"/>`);p.push(text(x,y+4,`${l}${i+1}`,8,900));}});

    if(show('hvac'))for(let i=0;i<count('ac');i++){const q=layout('ac',i),x=sx(q.x),y=sy(-c.width/2)+14;p.push(`<rect x="${x-25}" y="${y-8}" width="50" height="16" rx="5" fill="#bae6fd" stroke="#0369a1"/>`);p.push(text(x,y+4,`AC${i+1}`,8,900));}

    if(show('electrical')){
      const pts=electricalPoints();if(pts.length){pts.forEach((pt,i)=>{const q=ep(i),t=pt.type||'outlet';let x,y;if(t==='light'||q.face==='ceiling'){x=sx(n(q.x));y=sy(n(q.z));}else if(q.face==='A'||q.face==='B'){x=sx(n(q.x));y=sy(q.face==='A'?c.width/2:-c.width/2)+(q.face==='A'?15:-15);}else{x=sx(q.face==='C'?c.length/2:-c.length/2)+(q.face==='C'?-15:15);y=sy(n(q.x));}const lab=t==='light'?'LUZ':t==='switch'?'INT':t==='acPoint'?'FZA':'EN';p.push(`<circle cx="${x}" cy="${y}" r="11" fill="#fde68a" stroke="#92400e" stroke-width="1.5"/>`);p.push(text(x,y+3.5,lab,6.5,900));});}
      else for(let i=0;i<count('electrical');i++){const x=sx(-c.length*.25+(i%4)*.8),y=sy(-c.width/2)+18;p.push(`<circle cx="${x}" cy="${y}" r="10" fill="#fde68a" stroke="#92400e"/>`);p.push(text(x,y+3,'EN',6,900));}
    }

    p.push(`<line x1="${ox}" y1="${oy+c.width*scale+65}" x2="${ox+c.length*scale}" y2="${oy+c.width*scale+65}" stroke="#64748b"/>`);p.push(text(ox+c.length*scale/2,oy+c.width*scale+85,`${c.length.toFixed(2)} m`,11,800));
    const lx=860,ly=112,legend=legendFor(system).slice(0,14);p.push(text(lx,82,'Partidas y materiales',16,900,'start'));
    legend.forEach((r,i)=>{const y=ly+i*42;p.push(`<rect x="${lx}" y="${y-16}" width="285" height="36" rx="7" fill="${i%2?'#fff':'#f1f5f9'}" stroke="#e2e8f0"/>`);p.push(text(lx+9,y-2,`${r.code} · ${r.location}`,9.5,900,'start'));p.push(text(lx+9,y+12,(r.materials[0]?`${r.materials[0].code} ${r.materials[0].name}`:r.name).slice(0,56),8.2,500,'start','#475569'));});
    p.push(text(60,720,'Plano generado automáticamente según los elementos realmente solicitados por el cliente en este proyecto.',10,600,'start','#475569'));
    p.push('</svg>');return p.join('');
  }

  function rebuildModal(){
    document.getElementById('material-plan-modal')?.remove();
    const modal=document.createElement('div');modal.id='material-plan-modal';modal.className='fixed inset-0 z-[76] modal-backdrop hidden items-center justify-center p-4';
    modal.innerHTML=`<div class="modal-panel bg-white w-full max-w-7xl rounded-2xl shadow-2xl flex flex-col" style="max-height:95vh"><div class="px-5 py-4 border-b flex items-center gap-3"><div><h3 class="font-black text-lg">Planos de materiales por sistema</h3><p class="text-xs text-slate-500">Se generan solo los planos que corresponden a lo solicitado por el cliente.</p></div><div class="ml-auto flex gap-2"><button onclick="exportMaterialPlanSVG()" class="rounded-xl bg-slate-900 text-white px-3 py-2 text-xs font-black">Exportar SVG</button><button onclick="exportMaterialPlanPNG()" class="rounded-xl bg-amber-500 text-slate-950 px-3 py-2 text-xs font-black">Exportar PNG</button><button onclick="closeModal('material-plan-modal')" class="w-9 h-9 rounded-full bg-slate-100"><i class="fa-solid fa-xmark"></i></button></div></div><div class="px-5 pt-3"><div id="material-plan-filters" class="flex flex-wrap gap-2"></div></div><div class="modal-body overflow-auto p-4 bg-slate-100"><div id="material-plan-root" class="bg-white rounded-xl border overflow-auto"></div></div></div>`;document.body.appendChild(modal);
  }
  function render(){
    if(!document.getElementById('material-plan-modal'))rebuildModal();
    const available=systems();if(!available.some(s=>s.id===active))active='all';
    const filters=document.getElementById('material-plan-filters');if(filters)filters.innerHTML=available.map(s=>`<button onclick="BAT_PLAN_FILTER.select('${s.id}')" class="rounded-xl px-3 py-2 text-xs font-black border ${active===s.id?'bg-slate-900 text-white border-slate-900':'bg-white text-slate-600 border-slate-200'}"><i class="fa-solid ${s.icon} mr-1"></i>${esc(s.label)}</button>`).join('');
    const root=document.getElementById('material-plan-root');if(root)root.innerHTML=svg(active);
  }
  function select(id){active=id;render();}
  function downloadSvg(){const data=svg(active),blob=new Blob([data],{type:'image/svg+xml;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`BAT-Cubikeitor-plano-${active}-${new Date().toISOString().slice(0,10)}.svg`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500);}
  function downloadPng(){const data=svg(active),blob=new Blob([data],{type:'image/svg+xml;charset=utf-8'}),url=URL.createObjectURL(blob),img=new Image();img.onload=()=>{const canvas=document.createElement('canvas');canvas.width=2360;canvas.height=1520;const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);URL.revokeObjectURL(url);canvas.toBlob(png=>{if(!png)return;const a=document.createElement('a');a.href=URL.createObjectURL(png);a.download=`BAT-Cubikeitor-plano-${active}-${new Date().toISOString().slice(0,10)}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500);},'image/png');};img.src=url;}

  window.BAT_PLAN_FILTER={select,systems,render};
  window.openMaterialPlan=function(){rebuildModal();render();showModal('material-plan-modal');};
  window.exportMaterialPlanSVG=downloadSvg;
  window.exportMaterialPlanPNG=downloadPng;
  window.BAT_KUBIQUEITOR_PROJECT_MATERIAL_PLAN_FILTERED={version:2,systems,render};
})();