// Stabilizes per-partition state across copy/paste/delete/undo flows.
// Keeps each partition's faces, door and door behavior attached to the correct partition.
(function(){
  if(window.BAT_KUBIQUEITOR_PARTITION_STATE_INTEGRITY) return;

  const registry=new Map();
  let lastIds=[];
  let seq=0;
  let installed=false;
  let lastPartitionCount=0;
  let visualRefreshToken=0;

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

  function count(){ return Math.max(0,Number(state.counts?.partition)||0); }

  function newId(){
    seq++;
    return `partition-${Date.now().toString(36)}-${seq.toString(36)}`;
  }

  function ensureArrays(){
    ensureLayoutState();
    ensureDimensionState();
    if(!Array.isArray(state.layout.partition)) state.layout.partition=[];
    if(!Array.isArray(state.dimensions.partition)) state.dimensions.partition=[];
    if(!Array.isArray(state.partitionSpecs)) state.partitionSpecs=[];
    if(!Array.isArray(state.interiorDoors)) state.interiorDoors=[];
    if(!Array.isArray(state.interiorDoorBehavior)) state.interiorDoorBehavior=[];
  }

  function identityAt(index){
    const layout=state.layout?.partition?.[index];
    const dims=state.dimensions?.partition?.[index];
    return layout?._partitionId||dims?._partitionId||null;
  }

  function ensureIdentitySlots(){
    ensureArrays();
    const ids=[];
    const seen=new Set();
    for(let i=0;i<count();i++){
      if(!state.layout.partition[i]) state.layout.partition[i]={};
      if(!state.dimensions.partition[i]) state.dimensions.partition[i]={};
      let id=identityAt(i);
      if(!id||seen.has(id)) id=newId();
      seen.add(id);
      state.layout.partition[i]._partitionId=id;
      state.dimensions.partition[i]._partitionId=id;
      ids.push(id);
    }
    state.layout.partition=state.layout.partition.slice(0,count());
    state.dimensions.partition=state.dimensions.partition.slice(0,count());
    return ids;
  }

  function tagObject(obj,id){
    if(obj&&typeof obj==='object') obj._partitionId=id;
    return obj;
  }

  function captureRegistry(){
    ensureArrays();
    const ids=ensureIdentitySlots();
    for(let i=0;i<ids.length;i++){
      const id=ids[i];
      const spec=tagObject(state.partitionSpecs[i],id);
      const door=tagObject(state.interiorDoors[i],id);
      const behavior=tagObject(state.interiorDoorBehavior[i],id);
      registry.set(id,{
        spec:cloneSafe(spec),
        door:cloneSafe(door),
        behavior:cloneSafe(behavior)
      });
    }
    lastIds=ids.slice();
  }

  function currentRawIds(){
    ensureArrays();
    const ids=[];
    for(let i=0;i<count();i++) ids.push(identityAt(i));
    return ids;
  }

  function hasStructuralChange(ids){
    if(ids.length!==lastIds.length) return true;
    const seen=new Set();
    for(let i=0;i<ids.length;i++){
      const id=ids[i];
      if(!id||seen.has(id)||id!==lastIds[i]) return true;
      seen.add(id);
    }
    return false;
  }

  function chooseCurrentOrRegistry(current,id,source){
    if(current&&current._partitionId===id) return cloneSafe(current);
    return cloneSafe(source);
  }

  function reconcileStructuralState(){
    ensureArrays();
    const rawIds=currentRawIds();
    if(!hasStructuralChange(rawIds)) return;

    const seen=new Set();
    const nextSpecs=[],nextDoors=[],nextBehaviors=[];

    for(let i=0;i<count();i++){
      if(!state.layout.partition[i]) state.layout.partition[i]={};
      if(!state.dimensions.partition[i]) state.dimensions.partition[i]={};

      let sourceId=identityAt(i);
      const duplicate=Boolean(sourceId&&seen.has(sourceId));
      const source=sourceId?registry.get(sourceId):null;
      let id=sourceId;
      if(!id||duplicate) id=newId();
      seen.add(id);

      state.layout.partition[i]._partitionId=id;
      state.dimensions.partition[i]._partitionId=id;

      const currentSpec=state.partitionSpecs[i];
      const currentDoor=state.interiorDoors[i];
      const currentBehavior=state.interiorDoorBehavior[i];

      const spec=duplicate
        ? cloneSafe(source?.spec||currentSpec)
        : chooseCurrentOrRegistry(currentSpec,id,source?.spec||currentSpec);
      const door=duplicate
        ? cloneSafe(source?.door||currentDoor)
        : chooseCurrentOrRegistry(currentDoor,id,source?.door||currentDoor);
      const behavior=duplicate
        ? cloneSafe(source?.behavior||currentBehavior)
        : chooseCurrentOrRegistry(currentBehavior,id,source?.behavior||currentBehavior);

      nextSpecs[i]=tagObject(spec,id);
      nextDoors[i]=tagObject(door,id);
      nextBehaviors[i]=tagObject(behavior,id);
    }

    state.partitionSpecs=nextSpecs;
    state.interiorDoors=nextDoors;
    state.interiorDoorBehavior=nextBehaviors;
  }

  function hideLegacyDoorHandles(){
    if(typeof editableObjects==='undefined'||!Array.isArray(editableObjects)) return;
    editableObjects.forEach(root=>{
      if(root?.userData?.editor?.type!=='partition') return;
      const overlay=root.getObjectByName?.('interior-door-behavior-visual');
      if(!overlay) return;
      root.children.forEach(child=>{
        if(child===overlay) return;
        if(child?.isMesh&&child.geometry?.type==='SphereGeometry') child.visible=false;
      });
    });
  }

  function repairDoorExtraUI(){
    const select=document.getElementById('interior-door-target');
    const root=document.getElementById('extras-list');
    if(!root) return;
    const cards=[...root.children];
    const card=cards.find(el=>(el.querySelector('.font-bold.text-sm')?.textContent||'').trim()==='Puerta interior');
    if(!card) return;

    const total=count();
    let installedDoors=0,firstFree=-1;
    for(let i=0;i<total;i++){
      let enabled=false;
      try{ enabled=Boolean(window.partitionDoor?.(i)?.enabled); }catch(e){}
      if(enabled) installedDoors++;
      else if(firstFree<0) firstFree=i;
    }

    if(select&&firstFree>=0){
      const current=Number(select.value);
      let currentEnabled=false;
      try{ currentEnabled=Boolean(window.partitionDoor?.(current)?.enabled); }catch(e){}
      if(currentEnabled){
        select.value=String(firstFree);
        window.selectInteriorDoorTarget?.(firstFree);
      }
    }

    const buttons=[...card.querySelectorAll('button.counter-btn')];
    const minus=buttons[0],plus=buttons[buttons.length-1];
    if(minus){
      minus.disabled=installedDoors<=0;
      minus.style.opacity=minus.disabled?'.35':'';
      minus.style.cursor=minus.disabled?'not-allowed':'';
    }
    if(plus){
      plus.disabled=total<=0||firstFree<0;
      plus.style.opacity=plus.disabled?'.35':'';
      plus.style.cursor=plus.disabled?'not-allowed':'';
      plus.title=total<=0?'Agrega primero una división interior':firstFree<0?'Todos los tabiques ya tienen puerta interior':'';
    }
  }

  function fixControlOverlap(){
    if(document.getElementById('stability-ui-style')) return;
    const style=document.createElement('style');
    style.id='stability-ui-style';
    style.textContent=`
      @media(min-width:821px){#summary-panel-toggle{top:auto!important;bottom:86px!important;transform:none!important}}
      @media(max-width:820px){#summary-panel-toggle{top:auto!important;bottom:132px!important;transform:none!important}}
    `;
    document.head.appendChild(style);
  }

  // A partition-count change can be visually overwritten by another rebuild wrapper in the
  // same synchronous render cycle. A final scene rebuild on the next frame guarantees that
  // the newest parametric partitions are present immediately in Cutaway, Interior and Exterior.
  function schedulePartitionVisualRefresh(){
    const token=++visualRefreshToken;
    const expectedCount=count();
    requestAnimationFrame(()=>{
      if(token!==visualRefreshToken||count()!==expectedCount||typeof rebuild3D!=='function') return;
      rebuild3D();
      hideLegacyDoorHandles();
      repairDoorExtraUI();
    });
  }

  function install(){
    if(installed||!ready()) return false;
    installed=true;
    ensureIdentitySlots();
    captureRegistry();
    fixControlOverlap();
    lastPartitionCount=count();

    const baseRenderAll=renderAll;
    renderAll=function(...args){
      const partitionCountChanged=count()!==lastPartitionCount;
      reconcileStructuralState();
      const result=baseRenderAll.apply(this,args);
      hideLegacyDoorHandles();
      repairDoorExtraUI();
      captureRegistry();
      lastPartitionCount=count();
      if(partitionCountChanged) schedulePartitionVisualRefresh();
      return result;
    };

    // Clean the current scene/UI immediately without causing a second full rebuild loop.
    hideLegacyDoorHandles();
    repairDoorExtraUI();
    captureRegistry();

    window.BAT_KUBIQUEITOR_PARTITION_STATE_INTEGRITY={
      version:2,
      registrySize:()=>registry.size,
      refreshPartitions:schedulePartitionVisualRefresh
    };
    return true;
  }

  if(!install()){
    let tries=0;
    const timer=setInterval(()=>{tries++;if(install()||tries>240) clearInterval(timer);},80);
  }
})();
