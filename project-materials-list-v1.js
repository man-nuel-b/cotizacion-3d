// BAT-Cubikeitor · Consolidated project materials list v1
// Builds a procurement-oriented material list from the actual project BOM + APU components.
(function(){
  if(window.BAT_KUBIQUEITOR_PROJECT_MATERIALS_LIST) return;

  const n=(v,f=0)=>{const x=Number(v);return Number.isFinite(x)?x:f;};
  const esc=t=>String(t??'').replace(/[&<>\'\"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[ch]));
  const money=v=>new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(Math.round(n(v))).replace('CLP','$');
  const qtyFmt=v=>new Intl.NumberFormat('es-CL',{minimumFractionDigits:0,maximumFractionDigits:3}).format(n(v));

  function master(){try{return typeof getApuMaster==='function'?getApuMaster():null;}catch(e){return null;}}
  function taxPct(){try{return Math.max(0,n(getApuExcelSettings?.()?.taxPct,19));}catch(e){return 19;}}
  function currentBom(){try{const c=typeof calculate==='function'?calculate():null;return Array.isArray(c?.bom)?c.bom:(typeof buildBOM==='function'?buildBOM():[]);}catch(e){return [];}}
  function buyQty(qty){return Math.ceil(Math.max(0,n(qty)));}

  function consolidate(){
    const m=master();
    const bom=currentBom();
    const map=new Map();

    function ensure(key,data){
      if(!map.has(key))map.set(key,{key,code:data.code||'—',name:data.name||key,unit:data.unit||'un',unitPriceNet:Math.max(0,n(data.unitPriceNet)),calculatedQty:0,wasteQty:0,finalQty:0,partidas:new Set(),source:data.source||'APU'});
      const row=map.get(key);
      if(!row.unitPriceNet&&data.unitPriceNet)row.unitPriceNet=Math.max(0,n(data.unitPriceNet));
      return row;
    }

    bom.forEach(item=>{
      const projectQty=Math.max(0,n(item?.qty));
      const apu=item?.apuId&&m?.apus?.[item.apuId];
      if(apu&&Array.isArray(apu.components)){
        apu.components.forEach(c=>{
          const r=m.resources?.[c.resourceId];
          if(!r||r.type==='labor'||r.type==='equipment')return;
          const yieldFactor=Math.max(.0001,n(c.yield,1));
          const base=projectQty*Math.max(0,n(c.qty))/yieldFactor;
          const final=base*(1+Math.max(0,n(c.waste))/100);
          const row=ensure(r.id,{code:r.code,name:r.name,unit:r.unit,unitPriceNet:r.price,source:'APU'});
          row.calculatedQty+=base;
          row.finalQty+=final;
          row.wasteQty+=Math.max(0,final-base);
          row.partidas.add(apu.excelCode||apu.name||item.name||item.apuId);
        });
        return;
      }

      // Direct BOM material not represented by an APU.
      if(projectQty>0&&n(item?.unitCost)>=0){
        const key=`bom:${item.key||item.name}`;
        const row=ensure(key,{code:item.key||'BOM',name:item.name,unit:item.unit,unitPriceNet:item.unitCost,source:'BOM directo'});
        row.calculatedQty+=projectQty;
        row.finalQty+=projectQty;
        row.partidas.add('BOM directo');
      }
    });

    const tax=taxPct()/100;
    return [...map.values()].map(row=>{
      const purchaseQty=buyQty(row.finalQty);
      const totalNet=purchaseQty*row.unitPriceNet;
      return {...row,partidas:[...row.partidas],purchaseQty,totalNet,totalGross:totalNet*(1+tax),effectiveWastePct:row.calculatedQty>0?(row.wasteQty/row.calculatedQty*100):0};
    }).sort((a,b)=>(a.code||'').localeCompare(b.code||'',undefined,{numeric:true})||(a.name||'').localeCompare(b.name||''));
  }

  function summary(rows){
    return rows.reduce((s,r)=>({items:s.items+1,net:s.net+n(r.totalNet),gross:s.gross+n(r.totalGross)}),{items:0,net:0,gross:0});
  }

  function ensureModal(){
    if(document.getElementById('project-materials-modal'))return;
    const modal=document.createElement('div');modal.id='project-materials-modal';modal.className='fixed inset-0 z-[75] modal-backdrop hidden items-center justify-center p-4';
    modal.innerHTML=`<div class="modal-panel bg-white w-full max-w-7xl rounded-2xl shadow-2xl flex flex-col" style="max-height:94vh"><div class="px-5 py-4 border-b flex items-center gap-3"><div><h3 class="font-black text-lg">Lista total de materiales</h3><p class="text-xs text-slate-500">Consolidado automático del modelo 3D, BOM y partidas A.P.U.</p></div><div class="ml-auto flex gap-2"><button onclick="exportProjectMaterialsCSV()" class="rounded-xl bg-emerald-600 text-white px-3 py-2 text-xs font-black"><i class="fa-solid fa-file-csv mr-1"></i> Exportar CSV</button><button onclick="closeModal('project-materials-modal')" class="w-9 h-9 rounded-full bg-slate-100"><i class="fa-solid fa-xmark"></i></button></div></div><div class="modal-body overflow-auto p-5"><div id="project-materials-root"></div></div></div>`;
    document.body.appendChild(modal);
  }

  function render(){
    ensureModal();
    const root=document.getElementById('project-materials-root');if(!root)return;
    const rows=consolidate(),tot=summary(rows),tax=taxPct();
    root.innerHTML=`<div class="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4"><div class="rounded-xl border bg-slate-50 p-3"><div class="text-[10px] uppercase text-slate-400 font-bold">Materiales distintos</div><div class="font-black text-xl">${tot.items}</div></div><div class="rounded-xl border bg-slate-50 p-3"><div class="text-[10px] uppercase text-slate-400 font-bold">Compra neta estimada</div><div class="font-black text-xl">${money(tot.net)}</div></div><div class="rounded-xl border bg-amber-50 border-amber-200 p-3"><div class="text-[10px] uppercase text-amber-700 font-bold">Compra con IVA (${tax}%)</div><div class="font-black text-xl">${money(tot.gross)}</div></div></div>
    <div class="rounded-xl border overflow-x-auto"><table class="table-clean w-full text-[11px]"><thead><tr><th>Código</th><th>Material</th><th>Unidad</th><th class="text-right">Cant. calculada</th><th class="text-right">Merma</th><th class="text-right">Cant. final</th><th class="text-right">Comprar</th><th class="text-right">P. unit. neto</th><th class="text-right">Total compra</th><th>Usado en</th></tr></thead><tbody>${rows.map(r=>`<tr><td class="font-black text-slate-600">${esc(r.code)}</td><td><div class="font-bold text-slate-800">${esc(r.name)}</div><div class="text-[9px] text-slate-400">${esc(r.source)}</div></td><td>${esc(r.unit)}</td><td class="text-right">${qtyFmt(r.calculatedQty)}</td><td class="text-right"><span title="${r.effectiveWastePct.toFixed(2)}%">${qtyFmt(r.wasteQty)}</span></td><td class="text-right font-bold">${qtyFmt(r.finalQty)}</td><td class="text-right font-black text-amber-700">${qtyFmt(r.purchaseQty)}</td><td class="text-right">${money(r.unitPriceNet)}</td><td class="text-right font-black">${money(r.totalNet)}</td><td><div class="max-w-[260px] text-[9px] text-slate-500">${r.partidas.map(esc).join(' · ')}</div></td></tr>`).join('')}</tbody><tfoot><tr class="bg-slate-50"><td colspan="8" class="text-right font-black">TOTAL COMPRA NETA</td><td class="text-right font-black">${money(tot.net)}</td><td></td></tr><tr class="bg-amber-50"><td colspan="8" class="text-right font-black">TOTAL COMPRA CON IVA</td><td class="text-right font-black">${money(tot.gross)}</td><td></td></tr></tfoot></table></div><div class="mt-3 text-[10px] text-slate-500">“Comprar” redondea hacia arriba a la unidad de compra definida en el maestro de recursos. Los materiales repetidos en distintas partidas se consolidan en una sola fila.</div>`;
  }

  function csvCell(v){const s=String(v??'');return `"${s.replaceAll('"','""')}"`;}
  window.exportProjectMaterialsCSV=function(){
    const rows=consolidate();
    const header=['Código','Material','Unidad','Cantidad calculada','Merma','Merma %','Cantidad final','Cantidad a comprar','Precio unitario neto','Total neto','Total con IVA','Partidas'];
    const data=[header,...rows.map(r=>[r.code,r.name,r.unit,r.calculatedQty,r.wasteQty,r.effectiveWastePct,r.finalQty,r.purchaseQty,r.unitPriceNet,r.totalNet,r.totalGross,r.partidas.join(' | ')])];
    const csv='\ufeff'+data.map(row=>row.map(csvCell).join(';')).join('\r\n');
    const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`BAT-Cubikeitor-materiales-${new Date().toISOString().slice(0,10)}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500);
  };

  window.openProjectMaterials=function(){render();showModal('project-materials-modal');};
  window.getProjectMaterialsList=()=>consolidate();

  function installButton(){
    const modal=document.getElementById('company-modal');if(!modal||document.getElementById('project-materials-open-btn'))return false;
    const header=modal.querySelector('.px-5.py-4.border-b'),close=header?.querySelector('button[onclick*="closeModal"]');if(!header||!close)return false;
    const btn=document.createElement('button');btn.id='project-materials-open-btn';btn.type='button';btn.onclick=openProjectMaterials;btn.className='mr-2 rounded-xl bg-emerald-600 text-white px-3 py-2 text-xs font-black';btn.innerHTML='<i class="fa-solid fa-list-check mr-1"></i> Lista materiales';header.insertBefore(btn,close);return true;
  }

  function hookCompany(){
    if(typeof renderCompanyMode==='function'&&!renderCompanyMode.__materialsListWrapped){const before=renderCompanyMode;const wrapped=function(){const r=before.apply(this,arguments);installButton();return r;};wrapped.__materialsListWrapped=true;renderCompanyMode=wrapped;}
  }

  ensureModal();hookCompany();installButton();
  window.BAT_KUBIQUEITOR_PROJECT_MATERIALS_LIST={version:1,get:consolidate,render};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{ensureModal();hookCompany();installButton();},{once:true});
})();