// Interior doors belong to Extras; the partition editor only configures an installed door.
(function(){
  if(window.BAT_KUBIQUEITOR_INTERIOR_DOOR_EXTRA) return;

  let selectedTarget=0;
  let installed=false;

  function ready(){
    return typeof state!=='undefined'&&typeof DATA!=='undefined'&&
      typeof renderExtras==='function'&&typeof renderAll==='function'&&
      typeof adjustCount==='function'&&typeof partitionDoor==='function'&&
      typeof showEditorPanel==='function'&&window.BAT_KUBIQUEITOR_PARTITION_FACES;
  }

  function partitionCount(){ return Math.max(0,Number(state.counts?.partition)||0); }

  function ensureDoorCount(){
    let count=0;
    for(let i=0;i<partitionCount();i++){
      try{ if(partitionDoor(i)?.enabled) count++; }catch(e){}
    }
    if(!state.counts) state.counts={};
    state.counts.interiorDoor=count;
    return count;
  }

  function firstFreePartition(){
    for(let i=0;i<partitionCount();i++){
      try{ if(!partitionDoor(i)?.enabled) return i; }catch(e){}
    }
    return partitionCount()?0:-1;
  }

  function normalizeTarget(){
    const count=partitionCount();
    if(!count){ selectedTarget=-1; return -1; }
    if(!Number.isInteger(selectedTarget)||selectedTarget<0||selectedTarget>=count){
      selectedTarget=firstFreePartition();
      if(selectedTarget<0) selectedTarget=0;
    }
    return selectedTarget;
  }

  function targetSelectHtml(){
    const count=partitionCount();
    if(!count){
      return `<div class="interior-door-extra-help"><i class="fa-solid fa-circle-info"></i> Agrega primero una División interior.</div>`;
    }
    normalizeTarget();
    const options=[];
    for(let i=0;i<count;i++){
      let enabled=false;
      try{ enabled=Boolean(partitionDoor(i)?.enabled); }catch(e){}
      options.push(`<option value="${i}" ${selectedTarget===i?'selected':''}>Tabique ${i+1}${enabled?' · puerta instalada':''}</option>`);
    }
    return `<div class="interior-door-target-row">
      <label for="interior-door-target">Instalar / quitar en</label>
      <select id="interior-door-target" onchange="selectInteriorDoorTarget(this.value)">${options.join('')}</select>
    </div>`;
  }

  function enhanceExtraCard(){
    const root=document.getElementById('extras-list');
    if(!root) return;
    const cards=[...root.children];
    const card=cards.find(el=>{
      const title=el.querySelector('.font-bold.text-sm');
      return (title?.textContent||'').trim()==='Puerta interior';
    });
    if(!card) return;

    card.classList.add('interior-door-extra-card');
    const sub=card.querySelector('.text-\[10px\].text-slate-400');
    if(sub) sub.textContent=partitionCount()?`Disponible en ${partitionCount()} tabique${partitionCount()===1?'':'s'}`:'Requiere una división interior';

    let target=card.querySelector('.interior-door-extra-target');
    if(!target){
      target=document.createElement('div');
      target.className='interior-door-extra-target';
      card.appendChild(target);
    }
    target.innerHTML=targetSelectHtml();
  }

  function addStyles(){
    if(document.getElementById('interior-door-extra-style')) return;
    const style=document.createElement('style');
    style.id='interior-door-extra-style';
    style.textContent=`
      .interior-door-extra-card{flex-wrap:wrap}
      .interior-door-extra-target{width:100%;padding-left:48px}
      .interior-door-target-row{display:flex;align-items:center;gap:8px;margin-top:4px}
      .interior-door-target-row label{font-size:10px;font-weight:800;color:#64748b;white-space:nowrap}
      .interior-door-target-row select{min-width:0;flex:1;border:1px solid #e2e8f0;border-radius:9px;background:#f8fafc;padding:6px 8px;font-size:10px;font-weight:750;color:#334155}
      .interior-door-extra-help{margin-top:4px;font-size:10px;font-weight:700;color:#b45309;background:#fff7ed;border:1px solid #fed7aa;border-radius:9px;padding:6px 8px}
      .interior-door-managed-badge{font-size:9px;font-weight:850;color:#fbbf24;background:rgba(245,158,11,.10);border:1px solid rgba(245,158,11,.20);border-radius:8px;padding:5px 7px;white-space:nowrap}
    `;
    document.head.appendChild(style);
  }

  window.selectInteriorDoorTarget=function(value){
    const parsed=Number(value);
    if(Number.isInteger(parsed)&&parsed>=0&&parsed<partitionCount()) selectedTarget=parsed;
  };

  function focusPartition(index){
    setTimeout(()=>{
      try{
        const root=editableObjects?.find?.(obj=>obj.userData?.editor?.type==='partition'&&obj.userData.editor.index===index);
        if(root&&typeof selectEditable==='function') selectEditable(root);
      }catch(e){}
    },40);
  }

  function installDoorOnTarget(){
    const count=partitionCount();
    if(!count){ toast('Primero agrega una División interior'); return; }
    normalizeTarget();
    if(selectedTarget<0||selectedTarget>=count) return;
    const door=partitionDoor(selectedTarget);
    if(door.enabled){ toast(`El Tabique ${selectedTarget+1} ya tiene una puerta interior`); return; }
    pushHistory();
    door.enabled=true;
    ensureDoorCount();
    renderAll();
    toast(`Puerta interior agregada al Tabique ${selectedTarget+1}`);
    focusPartition(selectedTarget);
  }

  function removeDoorFromTarget(){
    const count=partitionCount();
    if(!count){ toast('No hay divisiones interiores'); return; }
    normalizeTarget();
    let index=selectedTarget;
    let door=index>=0?partitionDoor(index):null;
    if(!door?.enabled){
      index=-1;
      for(let i=count-1;i>=0;i--){
        if(partitionDoor(i)?.enabled){ index=i; break; }
      }
      if(index<0){ toast('No hay puertas interiores instaladas'); return; }
      door=partitionDoor(index);
      selectedTarget=index;
    }
    pushHistory();
    door.enabled=false;
    ensureDoorCount();
    renderAll();
    toast(`Puerta interior retirada del Tabique ${index+1}`);
  }

  function markDoorAsManagedFromExtras(root){
    if(root?.userData?.editor?.type!=='partition') return;
    const block=document.getElementById('partition-face-system-editor');
    if(!block) return;
    const switches=[...block.querySelectorAll('.partition-switch')];
    const row=switches.find(el=>(el.textContent||'').includes('Puerta interior'));
    if(!row) return;
    const button=row.querySelector('button');
    if(!button) return;
    const index=root.userData.editor.index;
    let enabled=false;
    try{ enabled=Boolean(partitionDoor(index)?.enabled); }catch(e){}
    const badge=document.createElement('span');
    badge.className='interior-door-managed-badge';
    badge.textContent=enabled?'Instalada · gestionar en Extras':'Agregar desde Extras';
    button.replaceWith(badge);
  }

  function install(){
    if(installed||!ready()) return false;
    installed=true;
    addStyles();

    DATA.extras.interiorDoor={name:'Puerta interior',icon:'fa-door-closed',max:6};
    if(!DATA.catalog.interiorDoor) DATA.catalog.interiorDoor={name:'Puerta interior instalada',unit:'unidad',cost:0};
    if(!DATA.labor.interiorDoor) DATA.labor.interiorDoor=0;
    ensureDoorCount();

    const adjustBefore=adjustCount;
    adjustCount=function(key,delta){
      if(key!=='interiorDoor') return adjustBefore(key,delta);
      if(Number(delta)>0) return installDoorOnTarget();
      if(Number(delta)<0) return removeDoorFromTarget();
    };

    const extrasBefore=renderExtras;
    renderExtras=function(){
      ensureDoorCount();
      extrasBefore();
      enhanceExtraCard();
    };

    const showBefore=showEditorPanel;
    showEditorPanel=function(root){
      showBefore(root);
      markDoorAsManagedFromExtras(root);
    };

    window.BAT_KUBIQUEITOR_INTERIOR_DOOR_EXTRA={version:1};
    renderAll();
    return true;
  }

  if(!install()){
    let tries=0;
    const timer=setInterval(()=>{ tries++; if(install()||tries>240) clearInterval(timer); },80);
  }
})();
