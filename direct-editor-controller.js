// Universal Direct 3D Editor controller.
// Closing the editor must only clear selection and hide the panel; never rebuild/reselect.
(function(){
  if(window.BAT_KUBIQUEITOR_DIRECT_EDITOR_CONTROLLER) return;

  function closeDirectEditor(){
    if(typeof selectEditable==='function'){
      selectEditable(null);
      return;
    }
    try{ selectedEditable=null; }catch(e){}
    if(typeof clearSelectionHelpers==='function') clearSelectionHelpers();
    if(typeof hideEditorPanel==='function') hideEditorPanel();
    else document.getElementById('object-editor')?.classList.add('hidden');
  }

  function install(){
    const panel=document.getElementById('object-editor');
    if(!panel) return false;
    const closeButton=panel.querySelector('.fa-xmark')?.closest('button');
    if(!closeButton) return false;

    closeButton.removeAttribute('onclick');
    closeButton.type='button';
    closeButton.setAttribute('aria-label','Cerrar editor 3D');
    closeButton.addEventListener('click',event=>{
      event.preventDefault();
      event.stopPropagation();
      closeDirectEditor();
    });

    window.closeDirect3DEditor=closeDirectEditor;
    window.BAT_KUBIQUEITOR_DIRECT_EDITOR_CONTROLLER={version:1};
    return true;
  }

  if(install()) return;
  let tries=0;
  const timer=setInterval(()=>{
    tries++;
    if(install()){clearInterval(timer);return;}
    if(tries>=80) clearInterval(timer);
  },50);
})();
