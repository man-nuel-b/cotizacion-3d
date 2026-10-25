// BAT-Cubikeitor · Excel-like APU editor v1
// UI-only editor over the existing APU master. Does not touch 3D geometry/editor behavior.
(function(){
  if(window.BAT_KUBIQUEITOR_APU_EXCEL_EDITOR) return;
  const MASTER_KEY='bat-kubiqueitor-apu-master-v2';
  const esc=t=>String(t??'').replace(/[&<>\'\"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[ch]));
  const n=(v,f=0)=>{const x=Number(v);return Number.isFinite(x)?x:f;};
  const money=v=>new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(Math.round(n(v))).replace('CLP','$');
  let selectedId='excel:P12';
  let search='';

  function current(){try{return typeof getApuMaster==='function'?getApuMaster():null;}catch(e){return null;}}
  function persist(master,after){
    try{
      const file=new File([JSON.stringify(master)],'bat-apu-edit.json',{type:'application/json'});
      importApuMaster({files:[file],value:'editor'});
      setTimeout(()=>{try{after?.();renderEditor();if(typeof renderAll==='function')renderAll();}catch(e){}},120);
    }catch(e){console.warn('[BAT APU editor] persist',e);}
  }
  function mutate(fn){
    const m=current();if(!m)return;
    fn(m);persist(m);
  }

  function resourceRows(){
    const m=current();return Object.values(m?.resources||{}).sort((a,b)=>(a.type||'').localeCompare(b.type||'')||(a.code||'').localeCompare(b.code||''));
  }
  function apuRows(){
    const m=current();return Object.values(m?.apus||{}).sort((a,b)=>(a.excelCode||a.id||'').localeCompare(b.excelCode||b.id||'',undefined,{numeric:true}));
  }
  function resourceOptions(selected){return resourceRows().map(r=>`<option value="${esc(r.id)}" ${r.id===selected?'selected':''}>${esc(r.code||'—')} · ${esc(r.name||r.id)}</option>`).join('');}
  function typeLabel(t){return t==='labor'?'Mano de obra':t==='equipment'?'Equipo':'Material';}

  function breakdown(apu){
    try{if(typeof getApuExcelBreakdown==='function'){const b=getApuExcelBreakdown(apu.id);if(b)return b;}}catch(e){}
    const m=current();let materials=0,labor=0,equipment=0;
    (apu.components||[]).forEach(c=>{const r=m?.resources?.[c.resourceId];if(!r)return;const cost=n(r.price)*Math.max(0,n(c.qty))*(1+Math.max(0,n(c.waste))/100)/Math.max(.0001,n(c.yield,1));if(r.type==='labor')labor+=cost;else if(r.type==='equipment')equipment+=cost;else materials+=cost;});
    const direct=materials+labor+equipment;return {materials,labor,equipment,tools:0,direct,overhead:0,profit:0,net:direct,tax:0,gross:direct};
  }

  function ensure(){
    const modal=document.getElementById('apu-master-modal');if(!modal)return false;
    const tabs=modal.querySelector('.px-5.py-3.border-b');if(!tabs)return false;
    if(!document.getElementById('apu-tab-excel-editor')){
      const btn=document.createElement('button');btn.id='apu-tab-excel-editor';btn.className='apu-tab';btn.textContent='Editor tipo Excel';btn.onclick=showEditor;const restore=tabs.querySelector('button[onclick*="resetApuMaster"]');tabs.insertBefore(btn,restore||null);
    }
    const body=modal.querySelector('.modal-body');
    if(body&&!document.getElementById('apu-view-excel-editor')){
      const section=document.createElement('section');section.id='apu-view-excel-editor';section.className='hidden';section.innerHTML='<div id="apu-excel-editor-root"></div>';body.appendChild(section);
    }
    if(!document.getElementById('apu-excel-editor-style')){
      const s=document.createElement('style');s.id='apu-excel-editor-style';s.textContent=`
      .apu-xl-shell{display:grid;grid-template-columns:300px minmax(0,1fr);gap:14px;min-height:620px}.apu-xl-side{border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;background:#fff}.apu-xl-list{max-height:565px;overflow:auto}.apu-xl-item{width:100%;text-align:left;padding:10px 12px;border-bottom:1px solid #f1f5f9}.apu-xl-item:hover{background:#f8fafc}.apu-xl-item.active{background:#fff7ed;border-left:3px solid #f59e0b}.apu-xl-main{min-width:0}.apu-xl-table{width:100%;border-collapse:collapse;font-size:11px}.apu-xl-table th{background:#0f172a;color:#fff;padding:8px 7px;text-align:left;white-space:nowrap}.apu-xl-table td{padding:6px 7px;border-bottom:1px solid #e2e8f0;vertical-align:middle}.apu-xl-table input,.apu-xl-table select{border:1px solid #cbd5e1;border-radius:7px;padding:6px;font-size:11px;background:#fff}.apu-xl-total{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}@media(max-width:980px){.apu-xl-shell{grid-template-columns:1fr}.apu-xl-side{max-height:260px}.apu-xl-list{max-height:210px}.apu-xl-total{grid-template-columns:1fr 1fr}}`;
      document.head.appendChild(s);
    }
    return true;
  }

  function showEditor(){
    if(!ensure())return;
    document.getElementById('apu-view-partidas')?.classList.add('hidden');
    document.getElementById('apu-view-recursos')?.classList.add('hidden');
    document.getElementById('apu-view-excel-editor')?.classList.remove('hidden');
    document.querySelectorAll('#apu-master-modal .apu-tab').forEach(x=>x.classList.remove('active'));
    document.getElementById('apu-tab-excel-editor')?.classList.add('active');
    renderEditor();
  }
  const oldShow=()=>window.showApuTab;
  function hookTabs(){
    if(typeof window.showApuTab==='function'&&!window.showApuTab.__excelEditorWrapped){const before=window.showApuTab;const wrapped=function(tab){document.getElementById('apu-view-excel-editor')?.classList.add('hidden');document.getElementById('apu-tab-excel-editor')?.classList.remove('active');return before.apply(this,arguments);};wrapped.__excelEditorWrapped=true;window.showApuTab=wrapped;}
  }

  function selectApu(id){selectedId=id;renderEditor();}
  function setSearch(v){search=String(v||'').toLowerCase();renderEditor();}

  function updatePartida(field,value){mutate(m=>{const a=m.apus?.[selectedId];if(a)a[field]=String(value||'').trim()||'—';});}
  function updateComponent(index,field,value){mutate(m=>{const c=m.apus?.[selectedId]?.components?.[index];if(!c)return;if(field==='resourceId')c.resourceId=value;else c[field]=Math.max(field==='yield'?.0001:0,n(value,field==='yield'?1:0));});}
  function removeComponent(index){mutate(m=>{m.apus?.[selectedId]?.components?.splice(index,1);});}
  function addComponent(){mutate(m=>{const first=Object.keys(m.resources||{})[0];if(!first)return;(m.apus?.[selectedId]?.components||(m.apus[selectedId].components=[])).push({resourceId:first,qty:1,waste:0,yield:1});});}
  function updateResourcePrice(resourceId,value){mutate(m=>{if(m.resources?.[resourceId])m.resources[resourceId].price=Math.max(0,n(value));});}
  function duplicateApu(){
    mutate(m=>{const src=m.apus?.[selectedId];if(!src)return;const id=`custom_partida_${Date.now().toString(36)}`;m.apus[id]={...JSON.parse(JSON.stringify(src)),id,name:`Copia · ${src.name}`,excelCode:null,source:'custom'};selectedId=id;});
  }

  function renderEditor(){
    if(!ensure())return;hookTabs();const root=document.getElementById('apu-excel-editor-root');if(!root)return;
    const m=current();if(!m){root.innerHTML='<div class="text-sm text-slate-500">Cargando Maestro A.P.U…</div>';return;}
    const all=apuRows();if(!m.apus[selectedId])selectedId=all[0]?.id;
    const apu=m.apus[selectedId];if(!apu)return;
    const filtered=all.filter(a=>!search||`${a.excelCode||''} ${a.name||''} ${a.group||''}`.toLowerCase().includes(search));
    const b=breakdown(apu);const comp=apu.components||[];
    root.innerHTML=`<div class="apu-xl-shell">
      <aside class="apu-xl-side"><div class="p-3 border-b bg-slate-50"><div class="text-[10px] font-black uppercase tracking-wider text-slate-500">Biblioteca A.P.U.</div><input value="${esc(search)}" oninput="BAT_APU_XL.setSearch(this.value)" placeholder="Buscar P60, WC, tabique…" class="mt-2 w-full border rounded-lg px-2 py-2 text-xs"></div><div class="apu-xl-list">${filtered.map(a=>`<button class="apu-xl-item ${a.id===selectedId?'active':''}" onclick="BAT_APU_XL.select('${esc(a.id)}')"><div class="text-[10px] font-black text-amber-600">${esc(a.excelCode||a.id)}</div><div class="text-xs font-bold text-slate-800 mt-0.5">${esc(a.name)}</div><div class="text-[9px] text-slate-400 mt-1">${esc(a.group||'Sin grupo')} · ${esc(a.unit||'un')}</div></button>`).join('')}</div></aside>
      <main class="apu-xl-main"><div class="rounded-2xl border bg-white overflow-hidden"><div class="p-4 border-b bg-slate-50 flex gap-3 items-start"><div class="flex-1"><div class="text-[10px] font-black text-amber-600 uppercase">${esc(apu.excelCode||'APU editable')}</div><input value="${esc(apu.name)}" onchange="BAT_APU_XL.partida('name',this.value)" class="mt-1 w-full border rounded-lg px-2 py-2 font-black text-sm"><div class="grid grid-cols-2 gap-2 mt-2"><input value="${esc(apu.group||'')}" onchange="BAT_APU_XL.partida('group',this.value)" class="border rounded-lg px-2 py-1.5 text-xs" placeholder="Grupo"><input value="${esc(apu.unit||'')}" onchange="BAT_APU_XL.partida('unit',this.value)" class="border rounded-lg px-2 py-1.5 text-xs" placeholder="Unidad"></div></div><button onclick="BAT_APU_XL.duplicate()" class="rounded-xl bg-slate-900 text-white px-3 py-2 text-[10px] font-bold">Duplicar APU</button></div>
      <div class="overflow-x-auto"><table class="apu-xl-table"><thead><tr><th>Tipo</th><th>Código / recurso</th><th>Unidad</th><th>Cantidad</th><th>Pérdida %</th><th>Rend.</th><th>Precio neto</th><th>Parcial</th><th></th></tr></thead><tbody>${comp.map((c,i)=>{const r=m.resources[c.resourceId]||{};const amount=Math.max(0,n(c.qty))*(1+Math.max(0,n(c.waste))/100)/Math.max(.0001,n(c.yield,1));const partial=n(r.price)*amount;return `<tr><td><span class="font-bold">${esc(typeLabel(r.type))}</span></td><td><select onchange="BAT_APU_XL.component(${i},'resourceId',this.value)" class="min-w-[280px]">${resourceOptions(c.resourceId)}</select><div class="text-[9px] text-slate-400 mt-1">${esc(r.code||'—')}</div></td><td>${esc(r.unit||'—')}</td><td><input type="number" min="0" step=".001" value="${n(c.qty)}" onchange="BAT_APU_XL.component(${i},'qty',this.value)" class="w-20"></td><td><input type="number" min="0" step=".1" value="${n(c.waste)}" onchange="BAT_APU_XL.component(${i},'waste',this.value)" class="w-20"></td><td><input type="number" min=".0001" step=".01" value="${n(c.yield,1)}" onchange="BAT_APU_XL.component(${i},'yield',this.value)" class="w-20"></td><td><input type="number" min="0" step="100" value="${Math.round(n(r.price))}" onchange="BAT_APU_XL.resourcePrice('${esc(c.resourceId)}',this.value)" class="w-28 text-right"><div class="text-[8px] text-amber-600">Precio maestro</div></td><td class="font-black text-right">${money(partial)}</td><td><button onclick="BAT_APU_XL.remove(${i})" class="w-8 h-8 rounded-lg bg-red-50 text-red-600"><i class="fa-solid fa-trash"></i></button></td></tr>`;}).join('')}</tbody></table></div>
      <div class="p-3 border-t flex justify-between items-center"><div class="text-[10px] text-slate-500">Agregar/quitar filas modifica directamente esta partida. Cambiar un precio maestro afecta todos los APU que usan ese recurso.</div><button onclick="BAT_APU_XL.add()" class="rounded-xl bg-amber-500 text-slate-950 px-3 py-2 text-xs font-black">+ Agregar recurso</button></div></div>
      <div class="apu-xl-total mt-3"><div class="rounded-xl border p-3"><div class="text-[9px] text-slate-400 uppercase">Materiales</div><div class="font-black">${money(b.materials)}</div></div><div class="rounded-xl border p-3"><div class="text-[9px] text-slate-400 uppercase">Mano de obra</div><div class="font-black">${money(b.labor)}</div></div><div class="rounded-xl border p-3"><div class="text-[9px] text-slate-400 uppercase">Herramientas / equipos</div><div class="font-black">${money(n(b.tools)+n(b.equipment))}</div></div><div class="rounded-xl border p-3 bg-slate-900 text-white"><div class="text-[9px] text-slate-400 uppercase">Costo directo</div><div class="font-black">${money(b.direct)}</div></div><div class="rounded-xl border p-3"><div class="text-[9px] text-slate-400 uppercase">Gastos generales</div><div class="font-black">${money(b.overhead)}</div></div><div class="rounded-xl border p-3"><div class="text-[9px] text-slate-400 uppercase">Utilidad</div><div class="font-black">${money(b.profit)}</div></div><div class="rounded-xl border p-3"><div class="text-[9px] text-slate-400 uppercase">Precio neto</div><div class="font-black">${money(b.net)}</div></div><div class="rounded-xl border p-3 bg-amber-50"><div class="text-[9px] text-amber-700 uppercase">Precio con IVA</div><div class="font-black">${money(b.gross||n(b.net)+n(b.tax))}</div></div></div>
      </main></div>`;
  }

  window.BAT_APU_XL={select:selectApu,setSearch,partida:updatePartida,component:updateComponent,remove:removeComponent,add:addComponent,resourcePrice:updateResourcePrice,duplicate:duplicateApu,render:renderEditor};
  window.BAT_KUBIQUEITOR_APU_EXCEL_EDITOR={version:1,show:showEditor,render:renderEditor};
  let tries=0;const timer=setInterval(()=>{tries++;if(ensure()&&typeof getApuMaster==='function'){hookTabs();clearInterval(timer);}else if(tries>180)clearInterval(timer);},100);
})();