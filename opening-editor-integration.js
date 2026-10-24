// Editing integration for true shell openings.
// Makes all four opening variants selectable and keeps the standard dimension editor open.
(function(){
  if(window.BAT_KUBIQUEITOR_OPENING_EDITOR_INTEGRATION?.version>=2) return;
  window.BAT_KUBIQUEITOR_OPENING_EDITOR_INTEGRATION={version:2};

  const TYPES=['opening','openingFrame','windowOpening','windowOpeningFrame'];
  let lastOpeningSelection=null;

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

  function rememberOpeningSelection(root){
    const meta=root?.userData?.editor;
    if(meta&&isOpeningType(meta.type)) lastOpeningSelection={type:meta.type,index:meta.index};
  }

  function restoreOpeningSelection(selection){
    if(!selection||typeof editableObjects==='undefined') return false;
    const root=editableObjects.find(o=>o?.userData?.editor?.type===selection.type&&o?.userData?.editor?.index===selection.index);
    if(!root) return false;
    selectedEditable={type:selection.type,index:selection.index};
    lastOpeningSelection={...selectedEditable};
    if(typeof addSelectionOutline==='function') addSelectionOutline(root);
    showEditorPanel(root);
    return true;
  }

  function installEditorBridge(){
    if(typeof showEditorPanel!=='function'||typeof renderDimensionEditor!=='function') return false;
    const previousShowEditorPanel=showEditorPanel;
    showEditorPanel=function(root){
      previousShowEditorPanel(root);
      const meta=root?.userData?.editor;
      if(!meta||!isOpeningType(meta.type)) return;
      rememberOpeningSelection(root);
      ensureOpeningSchemas();
      const panel=document.getElementById('object-editor');
      panel?.classList.remove('hidden');
      renderDimensionEditor(meta.type,meta.index);
      document.getElementById('dimension-editor')?.classList.remove('hidden');
    };
    return true;
  }

  function installSelectionBridge(){
    if(typeof selectEditable!=='function') return false;
    const previousSelectEditable=selectEditable;
    selectEditable=function(root){
      const meta=root?.userData?.editor;
      if(meta&&isOpeningType(meta.type)) rememberOpeningSelection(root);
      else if(!root) lastOpeningSelection=null;
      return previousSelectEditable(root);
    };
    return true;
  }

  function installRebuildBridge(){
    if(typeof rebuild3D!=='function') return false;
    const baseRebuild=rebuild3D;
    rebuild3D=function(){
      const selection=(selectedEditable&&isOpeningType(selectedEditable.type))?{...selectedEditable}:(lastOpeningSelection?{...lastOpeningSelection}:null);
      baseRebuild();
      strengthenOpeningHitboxes();
      if(selection){
        requestAnimationFrame(()=>restoreOpeningSelection(selection));
      }
    };
    strengthenOpeningHitboxes();
    return true;
  }

  function install(){
    if(!window.BAT_KUBIQUEITOR_OPENING_SHELL||typeof editableObjects==='undefined') return false;
    ensureOpeningSchemas();
    if(!installEditorBridge()) return false;
    if(!installSelectionBridge()) return false;
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