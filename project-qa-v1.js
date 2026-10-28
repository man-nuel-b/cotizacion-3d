// One-click technical/commercial QA for bat-kubiqueitor.
(function(){
  if(window.BAT_KUBIQUEITOR_PROJECT_QA?.version>=1) return;

  const APERTURES=['window','door','opening','openingFrame','windowOpening','windowOpeningFrame'];
  const SANITARY=['wc','sink','shower'];
  const WINDOW_TYPES=new Set(['window','windowOpening','windowOpeningFrame']);

  function n(value,fallback=0){const parsed=Number(value);return Number.isFinite(parsed)?parsed:fallback;}
  function dims(type,index){try{return objectDimensions(type,index)||{};}catch(e){return{};}}
  function layout(type,index){try{return actualLayout(type,index)||{};}catch(e){return{};}}
  function face(type,index){const p=layout(type,index);try{return p.face||MOUNTED_FACE_TYPES?.[type]?.defaultFace||'A';}catch(e){return p.face||'A';}}
  function faceLength(faceKey,c){return (faceKey==='A'||faceKey==='B')?c.length:c.width;}

  function collectApertures(c){
    const list=[];
    APERTURES.forEach(type=>{
      const count=n(state?.counts?.[type]);
      for(let i=0;i<count;i++){
        const d=dims(type,i),p=layout(type,i),f=face(type,i),isWindow=WINDOW_TYPES.has(type);
        const width=Math.max(.20,n(d.width,isWindow?1.20:.98));
        const height=Math.max(.20,n(d.height,isWindow?1.05:2.08));
        const x=n(p.x);
        let bottom,top;
        if(isWindow){
          const half=height/2,center=Math.min(c.height-half-.15,Math.max(half+.15,c.height*.60));
          bottom=center-half;top=center+half;
        }else{bottom=.02;top=bottom+height;}
        list.push({type,index:i,face:f,width,height,x,left:x-width/2,right:x+width/2,bottom,top});
      }
    });
    return list;
  }

  function runQA(){
    const errors=[],warnings=[],checks=[];
    const c=DATA?.containers?.[state?.container];
    if(!c){errors.push('No existe una base de contenedor válida.');return{errors,warnings,checks};}

    const apertures=collectApertures(c);
    apertures.forEach(item=>{
      const label=`${typeof typeLabel==='function'?typeLabel(item.type):item.type} ${item.index+1}`;
      const halfFace=faceLength(item.face,c)/2;
      if(item.left<-halfFace+.08||item.right>halfFace-.08) errors.push(`${label}: queda fuera de los límites de la cara ${item.face}.`);
      if(item.top>c.height-.04||item.bottom<0) errors.push(`${label}: su altura no cabe dentro del contenedor.`);
      if(item.width<.20||item.height<.20) errors.push(`${label}: tiene medidas inválidas.`);
    });

    for(let i=0;i<apertures.length;i++){
      for(let j=i+1;j<apertures.length;j++){
        const a=apertures[i],b=apertures[j];
        if(a.face!==b.face) continue;
        const horizontal=Math.min(a.right,b.right)-Math.max(a.left,b.left);
        const vertical=Math.min(a.top,b.top)-Math.max(a.bottom,b.bottom);
        if(horizontal>.02&&vertical>.02){
          const la=`${typeof typeLabel==='function'?typeLabel(a.type):a.type} ${a.index+1}`;
          const lb=`${typeof typeLabel==='function'?typeLabel(b.type):b.type} ${b.index+1}`;
          errors.push(`${la} y ${lb}: se superponen en la cara ${a.face}.`);
        }
      }
    }
    checks.push(`${apertures.length} abertura(s) revisada(s) en caras A/B/C/D.`);

    SANITARY.forEach(type=>{
      const count=n(state?.counts?.[type]);
      for(let i=0;i<count;i++){
        const d=dims(type,i),p=layout(type,i);
        const hw=Math.max(.05,n(d.width,.40)/2),hd=Math.max(.05,n(d.depth,.40)/2);
        if(n(p.x)-hw<-c.length/2+.05||n(p.x)+hw>c.length/2-.05||n(p.z)-hd<-c.width/2+.05||n(p.z)+hd>c.width/2-.05){
          errors.push(`${typeof typeLabel==='function'?typeLabel(type):type} ${i+1}: queda fuera del área interior utilizable.`);
        }
      }
    });
    checks.push(`${SANITARY.reduce((sum,t)=>sum+n(state?.counts?.[t]),0)} artefacto(s) sanitario(s) revisado(s).`);

    const partitionCount=n(state?.counts?.partition);
    for(let i=0;i<partitionCount;i++){
      const d=dims('partition',i),length=Math.max(.20,n(d.length,n(d.width,c.width-.20))),height=Math.max(.20,n(d.height,c.height-.15));
      if(length>Math.max(c.length,c.width)+.02) warnings.push(`Tabique ${i+1}: su longitud supera una dimensión principal del módulo; revisar orientación.`);
      if(height>c.height-.02) errors.push(`Tabique ${i+1}: su altura supera la altura interior disponible.`);
    }
    checks.push(`${partitionCount} tabique(s) revisado(s).`);

    try{
      const totals=calculate();
      if(!totals||![totals.materials,totals.labor,totals.direct,totals.net,totals.total].every(Number.isFinite)) errors.push('El presupuesto contiene valores no numéricos.');
      else{
        if(totals.total<=0) errors.push('El total calculado es menor o igual a cero.');
        if(totals.total<totals.direct) errors.push('El precio final quedó por debajo del costo directo.');
        const badRows=(totals.bom||[]).filter(row=>!Number.isFinite(Number(row.qty))||Number(row.qty)<0||!Number.isFinite(Number(row.subtotal)));
        if(badRows.length) errors.push(`${badRows.length} partida(s) de la cubicación tienen cantidades o subtotales inválidos.`);
        const zeroRows=(totals.bom||[]).filter(row=>(Number(row.qty)||0)>0&&(row.pendingCost||Number(row.unitCost)<=0));
        if(zeroRows.length) warnings.push(`${zeroRows.length} partida(s) tienen precio pendiente o igual a $0.`);
        checks.push(`${(totals.bom||[]).length} partida(s) del presupuesto revisada(s).`);
      }
    }catch(e){errors.push('No fue posible ejecutar la validación del presupuesto.');}

    if(!String(state?.customer?.name||'').trim()&&!String(state?.customer?.company||'').trim()) warnings.push('La cotización todavía no tiene nombre de cliente o empresa.');
    if(!String(state?.customer?.email||'').trim()&&!String(state?.customer?.phone||'').trim()) warnings.push('No hay teléfono ni correo de contacto del cliente.');

    return {errors:[...new Set(errors)],warnings:[...new Set(warnings)],checks};
  }

  function ensureModal(){
    let modal=document.getElementById('project-qa-modal');
    if(modal) return modal;
    modal=document.createElement('div');
    modal.id='project-qa-modal';
    modal.className='fixed inset-0 z-[70] modal-backdrop hidden items-center justify-center p-4';
    modal.innerHTML=`<div class="modal-panel bg-white w-full max-w-3xl rounded-2xl shadow-2xl flex flex-col"><div class="px-5 py-4 border-b flex items-center justify-between"><div><h3 class="font-black text-lg">Validación del proyecto</h3><p class="text-xs text-slate-500">Control técnico y comercial previo a cotizar.</p></div><button type="button" data-qa-close class="w-9 h-9 rounded-full bg-slate-100"><i class="fa-solid fa-xmark"></i></button></div><div data-qa-body class="modal-body p-5"></div></div>`;
    modal.querySelector('[data-qa-close]').addEventListener('click',()=>{modal.classList.add('hidden');modal.classList.remove('flex');});
    modal.addEventListener('click',event=>{if(event.target===modal){modal.classList.add('hidden');modal.classList.remove('flex');}});
    document.body.appendChild(modal);
    return modal;
  }

  function itemList(items,kind){
    if(!items.length) return '';
    const icon=kind==='error'?'fa-circle-xmark':'fa-triangle-exclamation';
    const boxClass=kind==='error'?'border-red-200 bg-red-50 text-red-800':'border-amber-200 bg-amber-50 text-amber-800';
    return `<div class="rounded-xl border ${boxClass} p-4"><div class="text-xs font-black uppercase tracking-wider mb-2"><i class="fa-solid ${icon} mr-1"></i>${kind==='error'?'Corregir antes de cotizar':'Revisar'}</div><div class="space-y-2 text-xs">${items.map(text=>`<div>• ${text}</div>`).join('')}</div></div>`;
  }

  function showQA(){
    const result=runQA(),modal=ensureModal(),body=modal.querySelector('[data-qa-body]');
    const ok=result.errors.length===0;
    body.innerHTML=`<div class="rounded-2xl ${ok?'bg-emerald-50 border-emerald-200 text-emerald-800':'bg-red-50 border-red-200 text-red-800'} border p-4 mb-4"><div class="font-black text-base"><i class="fa-solid ${ok?'fa-circle-check':'fa-shield-halved'} mr-1"></i>${ok?'Proyecto técnicamente consistente':'Se detectaron problemas que deben corregirse'}</div><div class="text-xs mt-1">${result.errors.length} error(es) · ${result.warnings.length} advertencia(s) · ${result.checks.length} grupos verificados.</div></div><div class="grid gap-3">${itemList(result.errors,'error')}${itemList(result.warnings,'warning')}<div class="rounded-xl border border-slate-200 bg-slate-50 p-4"><div class="text-xs font-black uppercase tracking-wider text-slate-500 mb-2">Controles ejecutados</div><div class="space-y-2 text-xs text-slate-600">${result.checks.map(text=>`<div><i class="fa-solid fa-check text-emerald-500 mr-1"></i>${text}</div>`).join('')}</div></div></div>`;
    modal.classList.remove('hidden');modal.classList.add('flex');
    return result;
  }

  function installButton(){
    const modal=document.getElementById('company-modal');
    if(!modal||document.getElementById('project-qa-button')) return Boolean(document.getElementById('project-qa-button'));
    const header=modal.querySelector('.px-5.py-4.border-b');
    const close=header?.querySelector('button');
    if(!header||!close) return false;
    const button=document.createElement('button');
    button.id='project-qa-button';button.type='button';button.className='ml-auto mr-2 px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-black';
    button.innerHTML='<i class="fa-solid fa-shield-check mr-1"></i> Validar proyecto';
    button.addEventListener('click',showQA);
    header.insertBefore(button,close);
    return true;
  }

  function install(){
    if(typeof state==='undefined'||typeof DATA==='undefined'||typeof calculate!=='function'||typeof objectDimensions!=='function'||typeof actualLayout!=='function') return false;
    ensureModal();installButton();
    window.runProjectQA=runQA;
    window.showProjectQA=showQA;
    window.BAT_KUBIQUEITOR_PROJECT_QA={version:1};
    return true;
  }

  let tries=0;const timer=setInterval(()=>{tries++;if(install()){clearInterval(timer);return;}if(tries>=240){clearInterval(timer);console.error('bat-kubiqueitor: project-qa-v1 no pudo instalarse');}},100);
})();
