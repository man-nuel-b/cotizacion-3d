// Editing integration for true shell openings.
// Makes all four opening variants selectable and forces the standard dimension editor.
(function(){
  if(window.BAT_KUBIQUEITOR_OPENING_EDITOR_INTEGRATION) return;
  window.BAT_KUBIQUEITOR_OPENING_EDITOR_INTEGRATION={version:1};

  const TYPES=['opening','openingFrame','windowOpening','windowOpeningFrame'];

  function isOpeningType(type){return TYPES.includes(type);}

  function strengthenOpeningHitboxes(){
    if(typeof containerGroup==='undefined'||!containerGroup) return;
    containerGroup.traverse(obj=>{
      if(!obj?.userData?.openingHitbox) return;
      obj.material.transparent=true;
      obj.material.opacity=.004;
      obj.material.depthWrite=false;
      obj.material.depthTest=false;
      obj.renderOrder=1000;
      const root=obj.parent;
      if(root?.userData?.trueOpeningDetail&&root?.userData?.editor){
        obj.userData.editorRoot=root;
      }
    });
  }

  function ensureOpeningSchemas(){
    if(typeof OBJECT_DIMENSIONS==='undefined') return;
    const doorFields=(OBJECT_DIMENSIONS.door?.fields||[
      {key:'width',label:'Ancho',min:.70,max:1.60,step:.05},
      {key:'height',label:'Alto',min:1.80,max:2.50,step:.05}
    ]).map(field=>({...field}));
    const windowFields=(OBJECT_DIMENSIONS.window?.fields||[
      {key:'width',label:'Ancho',min:.40,max:2.40,step:.05},
      {key:'height',label:'Alto',min:.40,max:1.80,step:.05}
    ]).map(field=>({...field}));

    if(!OBJECT_DIMENSIONS.opening){
      OBJECT_DIMENSIONS.opening={fields:doorFields.map(field=>({...field})),defaults:()=>({width:.90,height:2.10,depth:.20})};
    }
    if(!OBJECT_DIMENSIONS.openingFrame){
      OBJECT_DIMENSIONS.openingFrame={fields:doorFields.map(field=>({...field})),defaults:()=>({width:.90,height:2.10,depth:.20})};
    }
    if(!OBJECT_DIMENSIONS.windowOpening){
      OBJECT_DIMENSIONS.windowOpening={fields:windowFields.map(field=>({...field})),defaults:()=>({width:1.20,height:1.05,depth:.20})};
    }
    if(!OBJECT_DIMENSIONS.windowOpeningFrame){
      OBJECT_DIMENSIONS.windowOpeningFrame={fields:windowFields.map(field=>({...field})),defaults:()=>({width:1.20,height:1.05,depth:.20})};
    }
    if(typeof ensureDimensionState==='function') ensureDimensionState();
  }

  function installEditorBridge(){
    if(typeof showEditorPanel!=='function'||typeof renderDimensionEditor!=='function') return false;
    const previousShowEditorPanel=showEditorPanel;
    showEditorPanel=function(root){
      previousShowEditorPanel(root);
      const meta=root?.userData?.editor;
      if(!meta||!isOpeningType(meta.type)) return;
      ensureOpeningSchemas();
      const panel=document.getElementById('object-editor');
      panel?.classList.remove('hidden');
      renderDimensionEditor(meta.type,meta.index);
      const editor=document.getElementById('dimension-editor');
      editor?.classList.remove('hidden');
    };
    return true;
  }

  function installRebuildBridge(){
    if(typeof rebuild3D!=='function') return false;
    const baseRebuild=rebuild3D;
    rebuild3D=function(){
      baseRebuild();
      strengthenOpeningHitboxes();
      if(selectedEditable&&isOpeningType(selectedEditable.type)){
        const root=editableObjects?.find?.(o=>o?.userData?.editor?.type===selectedEditable.type&&o?.userData?.editor?.index===selectedEditable.index);
        if(root){
          addSelectionOutline?.(root);
          showEditorPanel(root);
        }
      }
    };
    strengthenOpeningHitboxes();
    return true;
  }

  function install(){
    if(!window.BAT_KUBIQUEITOR_OPENING_SHELL||typeof editableObjects==='undefined') return false;
    ensureOpeningSchemas();
    if(!installEditorBridge()) return false;
    if(!installRebuildBridge()) return false;
    rebuild3D();
    return true;
  }

  let tries=0;
  const timer=setInterval(()=>{
    tries++;
    if(install()){clearInterval(timer);return;}
    if(tries>=180){clearInterval(timer);console.error('bat-kubiqueitor: opening-editor-integration no pudo instalarse');}
  },80);
})();