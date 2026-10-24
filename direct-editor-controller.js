// Authoritative Universal Direct 3D Editor controller.
// Owns close, movement controls, face changes, reset and delete visibility.
(function(){
  if(window.BAT_KUBIQUEITOR_DIRECT_EDITOR_CONTROLLER?.version>=2) return;

  const FLOOR_TYPES=new Set(['wc','sink','shower']);

  function currentSelection(){
    try{return (typeof selectedEditable!=='undefined'&&selectedEditable)?selectedEditable:null;}catch(e){return null;}
  }

  function closeDirectEditor(){
    try{ selectedEditable=null; }catch(e){}
    try{ draggingEditable=null; }catch(e){}
    if(typeof clearSelectionHelpers==='function') clearSelectionHelpers();
    if(typeof hideEditorPanel==='function') hideEditorPanel();
    else document.getElementById('object-editor')?.classList.add('hidden');
  }

  function isMounted(type){
    try{return typeof isMountedFaceType==='function'&&isMountedFaceType(type);}catch(e){return false;}
  }

  function actionButton(label,icon,action,extra=''){
    return `<button type="button" ${extra} onclick="${action}" class="rounded-lg bg-white/10 hover:bg-white/15 py-2 text-[11px] font-bold transition"><i class="fa-solid ${icon}${label?' mr-1':''}"></i>${label||''}</button>`;
  }

  function ensureControls(panel){
    let root=panel.querySelector('[data-universal-editor-controls]');
    if(root) return root;

    root=document.createElement('div');
    root.dataset.universalEditorControls='true';
    root.className='mt-3';
    root.innerHTML=`
      <div data-editor-position-controls>
        <div class="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-2">Posición</div>
        <div class="grid grid-cols-3 gap-2">
          ${actionButton('','fa-arrow-left','nudgeSelected(-0.05,0)','title="Mover 5 cm"')}
          ${actionButton('','fa-wand-magic-sparkles','resetSelectedPosition()','title="Restaurar posición automática"')}
          ${actionButton('','fa-arrow-right','nudgeSelected(0.05,0)','title="Mover 5 cm"')}
        </div>
        <div data-editor-depth-controls class="grid grid-cols-2 gap-2 mt-2">
          ${actionButton('Fondo','fa-arrow-up','nudgeSelected(0,-0.05)')}
          ${actionButton('Frente','fa-arrow-down','nudgeSelected(0,0.05)')}
        </div>
      </div>
      <div data-editor-face-controls class="hidden mt-3 rounded-xl bg-white/5 border border-white/10 p-3">
        <div class="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-2">Cara del contenedor</div>
        <div class="grid grid-cols-4 gap-2">
          ${['A','B','C','D'].map(face=>`<button type="button" data-editor-face="${face}" onclick="changeSelectedMountedFace('${face}')" class="rounded-lg bg-white/10 border border-white/10 py-2 text-xs font-black">${face}</button>`).join('')}
        </div>
      </div>`;

    const deleteButton=panel.querySelector('button[onclick*="deleteSelectedObject"]');
    if(deleteButton) panel.insertBefore(root,deleteButton);
    else panel.appendChild(root);
    return root;
  }

  function removeLegacyMovementRows(panel){
    [...panel.querySelectorAll('button')].forEach(btn=>{
      if(btn.closest('[data-universal-editor-controls]')) return;
      const action=btn.getAttribute('onclick')||'';
      if(!action.includes('nudgeSelected(')&&!action.includes('resetSelectedPosition()')) return;
      const row=btn.parentElement;
      if(row&&row!==panel) row.remove(); else btn.remove();
    });
  }

  function syncControls(){
    const panel=document.getElementById('object-editor');
    if(!panel) return false;
    const selection=currentSelection();
    const root=ensureControls(panel);
    const depth=root.querySelector('[data-editor-depth-controls]');
    const faces=root.querySelector('[data-editor-face-controls]');

    if(!selection){
      faces?.classList.add('hidden');
      depth?.classList.add('hidden');
      return true;
    }

    depth?.classList.toggle('hidden',!FLOOR_TYPES.has(selection.type));
    const mounted=isMounted(selection.type);
    faces?.classList.toggle('hidden',!mounted);

    if(mounted&&faces){
      let currentFace=null;
      try{ currentFace=actualLayout(selection.type,selection.index)?.face||null; }catch(e){}
      faces.querySelectorAll('[data-editor-face]').forEach(btn=>{
        const active=btn.dataset.editorFace===currentFace;
        btn.classList.toggle('bg-amber-500',active);
        btn.classList.toggle('text-slate-950',active);
        btn.classList.toggle('bg-white/10',!active);
      });
    }
    return true;
  }

  function install(){
    const panel=document.getElementById('object-editor');
    if(!panel) return false;

    removeLegacyMovementRows(panel);
    ensureControls(panel);

    const closeButton=panel.querySelector('.fa-xmark')?.closest('button');
    if(closeButton&&!closeButton.dataset.directEditorClose){
      closeButton.dataset.directEditorClose='true';
      closeButton.removeAttribute('onclick');
      closeButton.type='button';
      closeButton.setAttribute('aria-label','Cerrar editor 3D');
      closeButton.addEventListener('click',event=>{
        event.preventDefault();
        event.stopPropagation();
        closeDirectEditor();
      });
    }

    if(typeof showEditorPanel==='function'&&!showEditorPanel.__universalEditorV2){
      const baseShow=showEditorPanel;
      const wrapped=function(root){
        const result=baseShow(root);
        syncControls();
        return result;
      };
      wrapped.__universalEditorV2=true;
      showEditorPanel=wrapped;
    }

    if(!window.__universalEditorEscapeInstalled){
      window.__universalEditorEscapeInstalled=true;
      window.addEventListener('keydown',event=>{
        if(event.key==='Escape'&&!document.getElementById('object-editor')?.classList.contains('hidden')){
          event.preventDefault();
          closeDirectEditor();
        }
      });
    }

    window.closeDirect3DEditor=closeDirectEditor;
    window.syncDirect3DEditor=syncControls;
    window.BAT_KUBIQUEITOR_DIRECT_EDITOR_CONTROLLER={version:2};
    syncControls();
    return true;
  }

  // face-select performs its legacy cleanup around 80 ms. Install after it so
  // this controller is the final and only owner of the visible movement UI.
  setTimeout(()=>{
    if(install()) return;
    let tries=0;
    const timer=setInterval(()=>{
      tries++;
      if(install()||tries>=80) clearInterval(timer);
    },50);
  },160);
})();
