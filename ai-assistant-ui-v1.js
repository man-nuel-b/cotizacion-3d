/* BAT-Kubiqueitor — interfaz de asistente de diseño, fase 1.
   Interpreta órdenes locales, enseña el plan y pide confirmar antes de editar.
*/
(function(root){
 'use strict';
 if(root.BAT_KUBIQUEITOR_AI_ASSISTANT)return;
 const css='.bat-ai-btn{border:1px solid #fbbf24;color:#0f172a;background:#fcd34d;border-radius:10px;padding:9px 12px;font-size:12px;font-weight:900;white-space:nowrap}.bat-ai-panel{margin:12px 0;padding:14px;border:1px solid #f59e0b;background:#fffaf0;border-radius:14px}.bat-ai-panel h3{font-size:15px;font-weight:900;color:#0f172a}.bat-ai-panel p,.bat-ai-panel li{font-size:12px;line-height:1.5;color:#475569}.bat-ai-input{display:block;width:100%;padding:11px;border:1px solid #94a3b8;border-radius:10px;min-height:90px;resize:vertical;background:white;color:#0f172a;font-size:13px;margin:10px 0}.bat-ai-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}.bat-ai-actions button{padding:9px 12px;border:1px solid #cbd5e1;border-radius:10px;background:#fff;color:#0f172a;font-size:12px;font-weight:800}.bat-ai-actions button[data-ai-review]{background:#0f172a;color:white}.bat-ai-actions button[data-ai-approve]{background:#f59e0b;border-color:#f59e0b;color:#111827}.bat-ai-review{margin-top:12px;padding:12px;background:white;border:1px solid #fcd34d;border-radius:10px}.bat-ai-error{margin-top:9px;background:#fef2f2;color:#991b1b;border-radius:8px;padding:10px;font-size:12px}.bat-ai-note{font-size:11px;color:#92400e;margin-top:8px}.bat-ai-review ul{list-style:disc;padding-left:18px;margin-top:7px}.bat-ai-review li{margin:5px 0}.presentation-mode #bat-ai-top{display:none!important}@media(max-width:700px){.bat-ai-btn{font-size:11px;padding:8px}}';
 let proposal=null,source=null;
 function escapeHtml(t){return String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&#39;'}[c]));}
 function currentPanel(){return document.getElementById('bat-ai-review');}
 function clearProposal(){proposal=null;source=null;const el=currentPanel();if(el){el.hidden=true;el.innerHTML='';}}
 function review(){
  const input=document.getElementById('bat-ai-input');if(!input)return;
  const parse=root.BAT_KUBIQUEITOR_AI_COMMAND_CORE?.parse;
  const stage=root.BAT_KUBIQUEITOR_AI_EXECUTOR?.stage;
  if(!parse||!stage){showError('El asistente sigue cargando; intenta nuevamente.');return;}
  const draft=parse(input.value);
  if(!draft.ok){showError(draft.errors.join(' '));clearProposal();return;}
  try{
   const project=typeof state!=='undefined'?state:null;
   const geometry=typeof DATA!=='undefined'?DATA.containers?.[project?.container]:null;
   const staged=stage(draft,{state:project,DATA:typeof DATA!=='undefined'?DATA:null,container:geometry,
     schemas:typeof OBJECT_DIMENSIONS!=='undefined'?OBJECT_DIMENSIONS:null});
   proposal=draft;source=input.value;
   const el=currentPanel();el.hidden=false;
   el.innerHTML='<b style="font-size:13px">Revisa antes de aplicar</b><ul>'+
    staged.changes.map(a=>'<li>'+escapeHtml(a.label||a.kind)+'</li>').join('')+'</ul>'+
    [...draft.notes,...staged.warnings].map(n=>'<div class="bat-ai-note">⚠ '+escapeHtml(n)+'</div>').join('')+
    '<p style="margin-top:9px"><b>El precio se recalculará con los APU actuales.</b> Los insumos sin precio o las incompatibilidades requieren revisión antes de ofertar.</p>'+
    '<div class="bat-ai-actions"><button type="button" data-ai-cancel>Cancelar</button><button type="button" data-ai-approve>Confirmar cambios en 3D</button></div>';
   const error=document.getElementById('bat-ai-error');if(error){error.hidden=true;error.textContent='';}
  }catch(err){clearProposal();showError(err.message);}
 }
 function showError(message){const el=document.getElementById('bat-ai-error');if(el){el.hidden=false;el.textContent=message;}}
 function approve(){
  if(!proposal||source===null)return;
  const input=document.getElementById('bat-ai-input');
  if(input?.value!==source){showError('Las instrucciones cambiaron. Vuelve a revisarlas antes de aplicar.');clearProposal();return;}
  try{
   // Stage is repeated on the CURRENT project, even when another manual edit occurred after review.
   const executor=root.BAT_KUBIQUEITOR_AI_EXECUTOR;
   if(!executor?.apply)throw Error('El editor de acciones todavía no está disponible.');
   const result=executor.apply(proposal);
   clearProposal();if(input)input.value='';
   if(typeof toast==='function')toast('Cambios aplicados al proyecto 3D · puedes usar Deshacer.');
   const status=document.getElementById('bat-ai-status');
   if(status)status.textContent=result.applied+' cambio(s) aplicado(s). Usa Deshacer para revertir.';
  }catch(err){clearProposal();showError('No se aplicaron cambios: '+err.message);}
 }
 function example(value){
  const input=document.getElementById('bat-ai-input');if(input){input.value=value;input.focus();clearProposal();}
 }
 function open(){
  if(typeof goStep==='function')goStep(3);
  const panel=document.getElementById('bat-ai-panel');if(!panel)return;
  panel.scrollIntoView({behavior:'smooth',block:'nearest'});
  panel.querySelector('textarea')?.focus();
 }
 function install(){
  if(!document.querySelector('.wizard-step[data-step="3"]')||!root.BAT_KUBIQUEITOR_AI_COMMAND_CORE||!root.BAT_KUBIQUEITOR_AI_EXECUTOR)return false;
  if(!document.getElementById('bat-ai-style')){const style=document.createElement('style');style.id='bat-ai-style';style.textContent=css;document.head.appendChild(style);}
  if(!document.getElementById('bat-ai-panel')){
   const section=document.createElement('section');section.id='bat-ai-panel';section.className='bat-ai-panel';
   section.innerHTML='<h3><i class="fa-solid fa-wand-magic-sparkles"></i> Asistente de diseño · Fase 1</h3>'+
    '<p>Escribe una instrucción sencilla. Primero la interpretaré y te pediré aprobarla. Puedes seguir editando manualmente después.</p>'+
    '<textarea id="bat-ai-input" class="bat-ai-input" maxlength="1000" placeholder="Ej.: Agrega 2 ventanas de 120 x 100 cm en cara A"></textarea>'+
    '<div class="bat-ai-actions"><button type="button" data-ai-review>Revisar propuesta</button><button type="button" data-ai-example="windows">Ejemplo ventanas</button><button type="button" data-ai-example="partition">Ejemplo tabique</button></div>'+
    '<div id="bat-ai-error" class="bat-ai-error" hidden></div><div id="bat-ai-review" class="bat-ai-review" hidden></div>'+
    '<p id="bat-ai-status" style="margin-top:9px;font-size:11px;color:#475569">Intérprete local de órdenes, no IA generativa: no inventa materiales, medidas ni precios.</p>';
   const target=document.getElementById('bat-live-controls')||document.querySelector('.wizard-step[data-step="3"]');
   target.insertAdjacentElement('afterend',section);
   section.addEventListener('click',event=>{
    const btn=event.target.closest('button');if(!btn)return;
    if(btn.matches('[data-ai-review]'))review();
    if(btn.matches('[data-ai-approve]'))approve();
    if(btn.matches('[data-ai-cancel]'))clearProposal();
    if(btn.dataset.aiExample==='windows')example('Agrega 2 ventanas de 120 x 100 cm en cara A');
    if(btn.dataset.aiExample==='partition')example('Crea un tabique transversal de 2,20 metros de largo y 2,40 metros de alto');
   });
   section.querySelector('textarea').addEventListener('input',()=>{clearProposal();});
  }
  const company=document.querySelector('.topbar button[onclick="openCompanyMode()"]');
  if(company&&!document.getElementById('bat-ai-top')){
   const btn=document.createElement('button');btn.type='button';btn.id='bat-ai-top';btn.className='bat-ai-btn';
   btn.textContent='Asistente de diseño';btn.addEventListener('click',open);
   company.parentElement.insertBefore(btn,company);
  }
  root.BAT_KUBIQUEITOR_AI_ASSISTANT={version:1,open,review,approve};
  return true;
 }
 if(typeof document!=='undefined'){
  let n=0;const timer=setInterval(()=>{if(install()||++n>180)clearInterval(timer);},100);
 }
})(typeof window!=='undefined'?window:globalThis);
