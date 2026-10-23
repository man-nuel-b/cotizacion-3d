// Stable per-partition state across copy/paste/delete/undo flows.
// Layout identity is authoritative; normal edits are never restored from stale registry data.
(function(){
  if(window.BAT_KUBIQUEITOR_PARTITION_STATE_INTEGRITY) return;

  const registry=new Map();
  const lastLengths=new Map();
  let lastIds=[];
  let seq=0;
  let installed=false;

  function cloneSafe(value){
    if(value==null) return value;
    try{return typeof clone==='function'?clone(value):JSON.parse(JSON.stringify(value));}
    catch(e){return value;}
  }
  function ready(){
    return typeof state!=='undefined'&&typeof renderAll==='function'&&
      typeof ensureLayoutState==='function'&&typeof ensureDimensionState==='function'&&
      window.BAT_KUBIQUEITOR_PARTITION_FACES;
  }
  function count(){return Math.max(0,Number(state.counts?.partition)||0);}
  function newId(){seq++;return `partition-${Date.now().toString(36)}-${seq.toString(36)}`;}

  function ensureArrays(){
    ensureLayoutState(); ensureDimensionState();
    if(!Array.isArray(state.layout.partition)) state.layout.partition=[];
    if(!Array.isArray(state.dimensions.partition)) state.dimensions.partition=[];
    if(!Array.isArray(state.partitionSpecs)) state.partitionSpecs=[];
    if(!Array.isArray(state.interiorDoors)) state.interiorDoors=[];
    if(!Array.isArray(state.interiorDoorBehavior)) state.interiorDoorBehavior=[];
  }
  function identityAt(index){return state.layout?.partition?.[index]?._partitionId||state.dimensions?.partition?.[index]?._partitionId||null;}
  function tag(value,id){if(value&&typeof value==='object')value._partitionId=id;return value;}

  function ensureIdentitySlots(){
    ensureArrays();
    const ids=[],seen=new Set();
    for(let i=0;i<count();i++){
      if(!state.layout.partition[i])state.layout.partition[i]={};
      if(!state.dimensions.partition[i])state.dimensions.partition[i]={};
      let id=identityAt(i);
      if(!id||seen.has(id))id=newId();
      seen.add(id);
      state.layout.partition[i]._partitionId=id;
      state.dimensions.partition[i]._partitionId=id;
      ids.push(id);
    }
    state.layout.partition=state.layout.partition.slice(0,count());
    state.dimensions.partition=state.dimensions.partition.slice(0,count());
    return ids;
  }

  function partitionLength(index){
    try{return Number(objectDimensions('partition',index)?.length)||0;}catch(e){return Number(state.dimensions?.partition?.[index]?.length)||0;}
  }
  function captureLengths(){
    const active=new Set();
    for(let i=0;i<count();i++){
      const id=identityAt(i);if(!id)continue;
      active.add(id);lastLengths.set(id,partitionLength(i));
    }
    [...lastLengths.keys()].forEach(id=>{if(!active.has(id))lastLengths.delete(id);});
  }
  function clearJointsAfterLengthChange(){
    for(let i=0;i<count();i++){
      const id=identityAt(i);if(!id)continue;
      const now=partitionLength(i),before=lastLengths.get(id);
      if(before!==undefined&&Math.abs(now-before)>.0005){
        if(!state.layout.partition[i])state.layout.partition[i]={};
        state.layout.partition[i].joints=[];
        delete state.layout.partition[i].joint;
        delete state.layout.partition[i].jointType;
      }
    }
  }

  function captureRegistry(){
    ensureArrays();
    const ids=ensureIdentitySlots();
    ids.forEach((id,i)=>{
      tag(state.partitionSpecs[i],id);tag(state.interiorDoors[i],id);tag(state.interiorDoorBehavior[i],id);
      registry.set(id,{spec:cloneSafe(state.partitionSpecs[i]),door:cloneSafe(state.interiorDoors[i]),behavior:cloneSafe(state.interiorDoorBehavior[i])});
    });
    lastIds=ids.slice();captureLengths();
  }

  function rawIds(){ensureArrays();return Array.from({length:count()},(_,i)=>identityAt(i));}
  function structureChanged(ids){
    if(ids.length!==lastIds.length)return true;
    const seen=new Set();
    for(let i=0;i<ids.length;i++){if(!ids[i]||seen.has(ids[i])||ids[i]!==lastIds[i])return true;seen.add(ids[i]);}
    return false;
  }

  function reconcileStructuralState(){
    ensureArrays();const ids=rawIds();if(!structureChanged(ids))return;
    const seen=new Set(),nextSpecs=[],nextDoors=[],nextBehaviors=[];
    for(let i=0;i<count();i++){
      if(!state.layout.partition[i])state.layout.partition[i]={};
      if(!state.dimensions.partition[i])state.dimensions.partition[i]={};
      const incomingId=identityAt(i),duplicate=Boolean(incomingId&&seen.has(incomingId)),source=incomingId?registry.get(incomingId):null;
      const id=(!incomingId||duplicate)?newId():incomingId;seen.add(id);
      state.layout.partition[i]._partitionId=id;state.dimensions.partition[i]._partitionId=id;
      if(source){
        nextSpecs[i]=tag(cloneSafe(source.spec),id);nextDoors[i]=tag(cloneSafe(source.door),id);nextBehaviors[i]=tag(cloneSafe(source.behavior),id);
      }else{
        nextSpecs[i]=tag(cloneSafe(state.partitionSpecs[i]),id);nextDoors[i]=tag(cloneSafe(state.interiorDoors[i]),id);nextBehaviors[i]=tag(cloneSafe(state.interiorDoorBehavior[i]),id);
      }
    }
    state.partitionSpecs=nextSpecs;state.interiorDoors=nextDoors;state.interiorDoorBehavior=nextBehaviors;
  }

  function hideLegacyDoorHandles(){
    if(typeof editableObjects==='undefined'||!Array.isArray(editableObjects))return;
    editableObjects.forEach(root=>{
      if(root?.userData?.editor?.type!=='partition')return;
      const overlay=root.getObjectByName?.('interior-door-behavior-visual');if(!overlay)return;
      root.children.forEach(child=>{if(child!==overlay&&child?.isMesh&&child.geometry?.type==='SphereGeometry')child.visible=false;});
    });
  }

  function repairDoorExtraUI(){
    const root=document.getElementById('extras-list');if(!root)return;
    const card=[...root.children].find(el=>(el.querySelector('.font-bold.text-sm')?.textContent||'').trim()==='Puerta interior');if(!card)return;
    const total=count();let installedDoors=0,firstFree=-1;
    for(let i=0;i<total;i++){let enabled=false;try{enabled=Boolean(window.partitionDoor?.(i)?.enabled);}catch(e){}if(enabled)installedDoors++;else if(firstFree<0)firstFree=i;}
    const select=document.getElementById('interior-door-target');
    if(select&&firstFree>=0){const current=Number(select.value);let enabled=false;try{enabled=Boolean(window.partitionDoor?.(current)?.enabled);}catch(e){}if(enabled){select.value=String(firstFree);window.selectInteriorDoorTarget?.(firstFree);}}
    const buttons=[...card.querySelectorAll('button.counter-btn')],minus=buttons[0],plus=buttons[buttons.length-1];
    if(minus){minus.disabled=installedDoors<=0;minus.style.opacity=minus.disabled?'.35':'';minus.style.cursor=minus.disabled?'not-allowed':'';}
    if(plus){plus.disabled=total<=0||firstFree<0;plus.style.opacity=plus.disabled?'.35':'';plus.style.cursor=plus.disabled?'not-allowed':'';plus.title=total<=0?'Agrega primero una división interior':firstFree<0?'Todos los tabiques ya tienen puerta interior':'';}
  }

  function installUiFixes(){
    if(document.getElementById('stability-ui-style'))return;
    const style=document.createElement('style');style.id='stability-ui-style';
    style.textContent=`@media(min-width:821px){#summary-panel-toggle{top:auto!important;bottom:86px!important;transform:none!important}}@media(max-width:820px){#summary-panel-toggle{top:auto!important;bottom:132px!important;transform:none!important}}`;
    document.head.appendChild(style);
  }

  function install(){
    if(installed||!ready())return false;
    installed=true;ensureIdentitySlots();captureRegistry();installUiFixes();
    const baseRenderAll=renderAll;
    renderAll=function(...args){
      reconcileStructuralState();
      clearJointsAfterLengthChange();
      const result=baseRenderAll.apply(this,args);
      hideLegacyDoorHandles();repairDoorExtraUI();captureRegistry();
      return result;
    };
    hideLegacyDoorHandles();repairDoorExtraUI();captureRegistry();
    window.BAT_KUBIQUEITOR_PARTITION_STATE_INTEGRITY={version:4,registrySize:()=>registry.size};
    return true;
  }

  if(!install()){
    let tries=0;const timer=setInterval(()=>{tries++;if(install()||tries>240)clearInterval(timer);},80);
  }
})();
