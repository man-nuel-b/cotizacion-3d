// BAT-Cubikeitor · Plano de ubicación de materiales v1
// Generates an auditable 2D plan from the current 3D/editor state and active Excel APUs.
(function(){
  if(window.BAT_KUBIQUEITOR_PROJECT_MATERIAL_PLAN) return;
  const n=(v,f=0)=>{const x=Number(v);return Number.isFinite(x)?x:f;};
  const esc=t=>String(t??'').replace(/[&<>\'\"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[ch]));
  const r2=v=>Math.round(n(v)*100)/100;

  function ctn(){return DATA?.containers?.[state?.container]||null;}
  function master(){try{return typeof getApuMaster==='function'?getApuMaster():null;}catch(e){return null;}}
  function apu(code){return master()?.apus?.[`excel:${code}`]||null;}
  function resourceNames(code,limit=5){
    const m=master(),a=apu(code);if(!m||!a)return [];
    return (a.components||[]).map(c=>m.resources?.[c.resourceId]).filter(r=>r&&r.type==='material').map(r=>`${r.code||''} ${r.name||''}`.trim()).slice(0,limit);
  }
  function floorCode(){return ({spc_oak:'P01',spc_light:'P02',spc_concrete:'P03',vinyl_roll:'P04',sanitary_vinyl:'P05',porcelain_r10:'P06',epoxy:'P07'})[state?.floorFinish]||null;}
  function wallCodes(){if(state?.finish==='sanitary')return ['P17'];if(state?.finish==='basic')return ['P10','P22','P34'];return ['P14'];}
  function count(type){return Math.max(0,Math.round(n(state?.counts?.[type])));}

  function fallbackSanitary(type,index,c){
    const list=[];for(let i=0;i<count('wc');i++)list.push(['wc',i]);for(let i=0;i<count('sink');i++)list.push(['sink',i]);for(let i=0;i<count('shower');i++)list.push(['shower',i]);
    const cols=Math.max(1,Math.min(c.length>8?5:3,Math.ceil(Math.sqrt(list.length||1))));
    const found=list.findIndex(([t,i])=>t===type&&i===index);const g=Math.max(0,found),row=Math.floor(g/cols),col=g%cols;
    return {x:Math.max(-c.length/2+.65,Math.min(c.length/2-.65,-c.length*.28+col*1.05)),z:Math.max(-c.width/2+.46,Math.min(c.width/2-.46,-.55+row*.95))};
  }
  function layout(type,index){
    try{if(typeof actualLayout==='function')return actualLayout(type,index);}catch(e){}
    const c=ctn();if(!c)return {x:0,z:0};
    const stored=state?.layout?.[type]?.[index];
    if(type==='window')return {face:stored?.face||'B',x:Number.isFinite(stored?.x)?stored.x:0};
    if(type==='door')return {x:Number.isFinite(stored?.x)?stored.x:0};
    if(type==='partition')return {x:Number.isFinite(stored?.x)?stored.x:-c.length/2+((index+1)*c.length/(count('partition')+1))};
    if(['wc','sink','shower'].includes(type))return {...fallbackSanitary(type,index,c),...(stored||{})};
    if(type==='ac')return {x:Number.isFinite(stored?.x)?stored.x:0};
    return {x:0,z:0};
  }
  function electrical(){
    const pts=Array.isArray(state?.electrical?.points)?state.electrical.points:[];
    return pts.map((p,i)=>{try{return {...p,...(typeof actualLayout==='function'?actualLayout('electrical',i):{})};}catch(e){return {...p,face:p.face||'B',x:n(p.position?.x),z:n(p.position?.z),y:n(p.height,.35)};}});
  }

  function systemLegend(){
    const rows=[];const push=(location,codes)=>{codes.filter(Boolean).forEach(code=>{const a=apu(code);if(a)rows.push({location,code,name:a.name||code,materials:resourceNames(code)});});};
    push('Muros perimetrales interiores',wallCodes());
    if(state?.finish!=='basic')push('Cielo interior',['P16']);
    push('Piso estructural',['P47']);push('Terminación de piso',[floorCode()]);
    if(count('partition'))push('Tabiques interiores',['P12']);
    if(count('door'))push('Puertas exteriores y vanos',['P82','P40']);
    if(count('window'))push('Ventanas y vanos',['P83','P84','P85','P41','P42','P43']);
    if(count('wc'))push('WC',['P60']);if(count('sink'))push('Lavamanos',['P61']);if(count('shower'))push('Duchas',['P62']);
    if(count('ac'))push('Climatización',['P75']);
    const types=electrical().map(p=>p.type);if(types.includes('light')||types.includes('switch'))push('Alumbrado',['P70']);if(types.includes('outlet')||(!types.length&&count('electrical')))push('Enchufes',['P71']);if(types.includes('acPoint'))push('Puntos de fuerza',['P72']);
    return rows;
  }

  function svgPlan(){
    const c=ctn();if(!c)return '';
    const W=1180,H=760,margin=90,planW=760,planH=360;
    const scale=Math.min((planW-60)/c.length,(planH-50)/c.width);
    const ox=80+(planW-c.length*scale)/2,oy=165+(planH-c.width*scale)/2;
    const sx=x=>ox+(x+c.length/2)*scale, sy=z=>oy+(c.width/2-z)*scale;
    const wallStroke=14;
    const parts=[];
    const text=(x,y,t,size=13,weight=600,anchor='middle')=>`<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="Inter,Arial,sans-serif" font-size="${size}" font-weight="${weight}" fill="#0f172a">${esc(t)}</text>`;
    const badge=(x,y,label,fill='#f59e0b')=>`<g><circle cx="${x}" cy="${y}" r="14" fill="${fill}" stroke="#fff" stroke-width="2"/><text x="${x}" y="${y+4}" text-anchor="middle" font-family="Inter,Arial" font-size="10" font-weight="900" fill="#0f172a">${esc(label)}</text></g>`;

    parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="100%" height="100%" fill="#f8fafc"/>`);
    parts.push(text(60,42,'BAT-Cubikeitor · Plano de ubicación de materiales',23,900,'start'));
    parts.push(text(60,68,`${DATA?.solutions?.[state?.solution]?.name||'Proyecto'} · ${c.name} · ${c.length.toFixed(2)} × ${c.width.toFixed(2)} m`,12,600,'start'));
    parts.push(`<rect x="${ox}" y="${oy}" width="${c.length*scale}" height="${c.width*scale}" rx="4" fill="#fff7ed" stroke="#334155" stroke-width="${wallStroke}"/>`);
    parts.push(`<rect x="${ox+wallStroke/2}" y="${oy+wallStroke/2}" width="${c.length*scale-wallStroke}" height="${c.width*scale-wallStroke}" fill="url(#floorPat)" opacity=".50"/>`);
    parts.push(`<defs><pattern id="floorPat" width="18" height="18" patternUnits="userSpaceOnUse"><path d="M0 18 L18 0" stroke="#f59e0b" stroke-width="1" opacity=".28"/></pattern></defs>`);
    parts.push(text(ox+c.length*scale/2,oy+c.width*scale/2,`${floorCode()||'PISO'} · Piso`,15,900));
    parts.push(text(ox+c.length*scale/2,oy-24,`${wallCodes().join(' + ')} · Muros`,12,800));
    if(state?.finish!=='basic')parts.push(text(ox+c.length*scale/2,oy+c.width*scale+38,'P16 · Cielo (sobre toda la planta)',11,700));

    // Partitions
    for(let i=0;i<count('partition');i++){
      const p=layout('partition',i),x=sx(p.x);parts.push(`<line x1="${x}" y1="${oy+9}" x2="${x}" y2="${oy+c.width*scale-9}" stroke="#7c3aed" stroke-width="7"/>`);parts.push(badge(x,oy+c.width*scale/2,`T${i+1}`,'#c4b5fd'));
    }
    // Doors (face A / +Z)
    for(let i=0;i<count('door');i++){
      const p=layout('door',i),x=sx(p.x),y=sy(c.width/2);parts.push(`<line x1="${x-22}" y1="${y}" x2="${x+22}" y2="${y}" stroke="#fff" stroke-width="18"/>`);parts.push(`<path d="M ${x-22} ${y} A 44 44 0 0 1 ${x+22} ${y-44}" fill="none" stroke="#0f172a" stroke-width="2"/>`);parts.push(badge(x,y-17,`D${i+1}`,'#fdba74'));
    }
    // Windows by face
    for(let i=0;i<count('window');i++){
      const p=layout('window',i),face=p.face||'B';let x1,y1,x2,y2,bx,by;
      if(face==='A'||face==='B'){const x=sx(p.x),z=face==='A'?c.width/2:-c.width/2,y=sy(z);x1=x-24;x2=x+24;y1=y2=y;bx=x;by=y+(face==='A'?-18:18);}else{const x=sx(face==='C'?c.length/2:-c.length/2),z=p.x,y=sy(z);x1=x2=x;y1=y-24;y2=y+24;bx=x+(face==='C'?-18:18);by=y;}
      parts.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#38bdf8" stroke-width="8"/>`);parts.push(badge(bx,by,`V${i+1}`,'#7dd3fc'));
    }
    // Sanitary
    const san=[['wc','WC','#93c5fd'],['sink','L','#86efac'],['shower','DU','#67e8f9']];
    san.forEach(([type,label,color])=>{for(let i=0;i<count(type);i++){const p=layout(type,i),x=sx(p.x),y=sy(p.z);parts.push(`<rect x="${x-16}" y="${y-13}" width="32" height="26" rx="7" fill="${color}" stroke="#0f172a" stroke-width="1.5"/>`);parts.push(text(x,y+4,`${label}${i+1}`,8,900));}});
    // AC
    for(let i=0;i<count('ac');i++){const p=layout('ac',i),x=sx(p.x),y=sy(-c.width/2)+13;parts.push(`<rect x="${x-25}" y="${y-8}" width="50" height="16" rx="5" fill="#bae6fd" stroke="#0369a1"/>`);parts.push(text(x,y+4,`AC${i+1}`,8,900));}
    // Electrical
    const e=electrical();e.forEach((p,i)=>{const type=p.type||'outlet';let x,y;if(type==='light'||p.face==='ceiling'){x=sx(n(p.x));y=sy(n(p.z));}else if(p.face==='A'||p.face==='B'){x=sx(n(p.x));y=sy(p.face==='A'?c.width/2:-c.width/2)+(p.face==='A'?15:-15);}else{x=sx(p.face==='C'?c.length/2:-c.length/2)+(p.face==='C'?-15:15);y=sy(n(p.x));}const lbl=type==='light'?'LUZ':type==='switch'?'INT':type==='acPoint'?'FZA':'EN';parts.push(`<circle cx="${x}" cy="${y}" r="10" fill="#fde68a" stroke="#92400e" stroke-width="1.5"/>`);parts.push(text(x,y+3.5,lbl,6.5,900));});

    // Dimensions
    parts.push(`<line x1="${ox}" y1="${oy+c.width*scale+65}" x2="${ox+c.length*scale}" y2="${oy+c.width*scale+65}" stroke="#64748b"/><line x1="${ox}" y1="${oy+c.width*scale+58}" x2="${ox}" y2="${oy+c.width*scale+72}" stroke="#64748b"/><line x1="${ox+c.length*scale}" y1="${oy+c.width*scale+58}" x2="${ox+c.length*scale}" y2="${oy+c.width*scale+72}" stroke="#64748b"/>`);parts.push(text(ox+c.length*scale/2,oy+c.width*scale+86,`${c.length.toFixed(2)} m`,11,800));
    parts.push(`<line x1="${ox-48}" y1="${oy}" x2="${ox-48}" y2="${oy+c.width*scale}" stroke="#64748b"/><line x1="${ox-55}" y1="${oy}" x2="${ox-41}" y2="${oy}" stroke="#64748b"/><line x1="${ox-55}" y1="${oy+c.width*scale}" x2="${ox-41}" y2="${oy+c.width*scale}" stroke="#64748b"/>`);parts.push(`<text x="${ox-62}" y="${oy+c.width*scale/2}" transform="rotate(-90 ${ox-62} ${oy+c.width*scale/2})" text-anchor="middle" font-family="Inter,Arial" font-size="11" font-weight="800" fill="#0f172a">${c.width.toFixed(2)} m</text>`);

    // Legend
    const lx=860,ly=120;parts.push(text(lx,ly-35,'Leyenda de partidas/materiales',16,900,'start'));
    const legend=systemLegend().slice(0,15);legend.forEach((row,i)=>{const y=ly+i*38;parts.push(`<rect x="${lx}" y="${y-15}" width="285" height="32" rx="7" fill="${i%2?'#ffffff':'#f1f5f9'}" stroke="#e2e8f0"/>`);parts.push(text(lx+10,y-2,`${row.code} · ${row.location}`,10,900,'start'));parts.push(text(lx+10,y+11,(row.materials[0]||row.name).slice(0,54),8.5,500,'start'));});
    parts.push(text(60,720,'Plano referencial generado desde el modelo 3D. Las etiquetas Pxx corresponden a partidas A.P.U. del proyecto.',10,600,'start'));
    parts.push('</svg>');return parts.join('');
  }

  function ensureModal(){
    if(document.getElementById('material-plan-modal'))return;
    const modal=document.createElement('div');modal.id='material-plan-modal';modal.className='fixed inset-0 z-[76] modal-backdrop hidden items-center justify-center p-4';
    modal.innerHTML=`<div class="modal-panel bg-white w-full max-w-7xl rounded-2xl shadow-2xl flex flex-col" style="max-height:95vh"><div class="px-5 py-4 border-b flex items-center gap-3"><div><h3 class="font-black text-lg">Plano de ubicación de materiales</h3><p class="text-xs text-slate-500">Planta automática basada en las posiciones reales del modelo 3D y sus A.P.U.</p></div><div class="ml-auto flex gap-2"><button onclick="exportMaterialPlanSVG()" class="rounded-xl bg-slate-900 text-white px-3 py-2 text-xs font-black">Exportar SVG</button><button onclick="exportMaterialPlanPNG()" class="rounded-xl bg-amber-500 text-slate-950 px-3 py-2 text-xs font-black">Exportar PNG</button><button onclick="closeModal('material-plan-modal')" class="w-9 h-9 rounded-full bg-slate-100"><i class="fa-solid fa-xmark"></i></button></div></div><div class="modal-body overflow-auto p-4 bg-slate-100"><div id="material-plan-root" class="bg-white rounded-xl border overflow-auto"></div></div></div>`;
    document.body.appendChild(modal);
  }
  function render(){ensureModal();const root=document.getElementById('material-plan-root');if(root)root.innerHTML=svgPlan();}
  window.openMaterialPlan=function(){render();showModal('material-plan-modal');};
  window.exportMaterialPlanSVG=function(){const svg=svgPlan();const blob=new Blob([svg],{type:'image/svg+xml;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`BAT-Cubikeitor-plano-materiales-${new Date().toISOString().slice(0,10)}.svg`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500);};
  window.exportMaterialPlanPNG=function(){
    const svg=svgPlan(),blob=new Blob([svg],{type:'image/svg+xml;charset=utf-8'}),url=URL.createObjectURL(blob),img=new Image();
    img.onload=()=>{const canvas=document.createElement('canvas');canvas.width=2360;canvas.height=1520;const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);URL.revokeObjectURL(url);canvas.toBlob(png=>{if(!png)return;const a=document.createElement('a');a.href=URL.createObjectURL(png);a.download=`BAT-Cubikeitor-plano-materiales-${new Date().toISOString().slice(0,10)}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500);},'image/png');};img.src=url;
  };
  function installButton(){
    const modal=document.getElementById('company-modal');if(!modal||document.getElementById('material-plan-open-btn'))return false;
    const header=modal.querySelector('.px-5.py-4.border-b'),close=header?.querySelector('button[onclick*="closeModal"]');if(!header||!close)return false;
    const btn=document.createElement('button');btn.id='material-plan-open-btn';btn.type='button';btn.onclick=openMaterialPlan;btn.className='mr-2 rounded-xl bg-sky-600 text-white px-3 py-2 text-xs font-black';btn.innerHTML='<i class="fa-solid fa-map mr-1"></i> Plano materiales';header.insertBefore(btn,close);return true;
  }
  function hookCompany(){if(typeof renderCompanyMode==='function'&&!renderCompanyMode.__materialPlanWrapped){const before=renderCompanyMode;const wrapped=function(){const r=before.apply(this,arguments);installButton();return r;};wrapped.__materialPlanWrapped=true;renderCompanyMode=wrapped;}}
  ensureModal();hookCompany();installButton();
  window.BAT_KUBIQUEITOR_PROJECT_MATERIAL_PLAN={version:1,render,svg:svgPlan,legend:systemLegend};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{ensureModal();hookCompany();installButton();},{once:true});
})();