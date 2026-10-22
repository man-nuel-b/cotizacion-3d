// Toggle interior furniture visibility without changing pricing or project quantities.

if(typeof state.showFurniture==='undefined') state.showFurniture=true;

const addFurnishingsBeforeToggle=addFurnishings;
addFurnishings=function(parent,c){
  if(state.showFurniture===false) return;
  return addFurnishingsBeforeToggle(parent,c);
};

function updateFurnitureButton(){
  const btn=document.getElementById('furniture-toggle-btn');
  if(!btn) return;
  const visible=state.showFurniture!==false;
  btn.classList.toggle('furniture-off',!visible);
  btn.setAttribute('aria-pressed',String(visible));
  btn.innerHTML=visible
    ? '<i class="fa-solid fa-couch mr-1"></i> Muebles'
    : '<i class="fa-solid fa-couch mr-1"></i> Sin muebles';
  btn.title=visible?'Ocultar muebles interiores':'Mostrar muebles interiores';
}

function toggleFurniture(){
  state.showFurniture=state.showFurniture===false;
  rebuild3D();
  updateFurnitureButton();
  toast(state.showFurniture===false?'Muebles interiores ocultos':'Muebles interiores visibles');
}

function installFurnitureToggle(){
  const toolbar=document.querySelector('.viewer-toolbar');
  if(!toolbar||document.getElementById('furniture-toggle-btn')){
    updateFurnitureButton();
    return;
  }

  const btn=document.createElement('button');
  btn.id='furniture-toggle-btn';
  btn.type='button';
  btn.className='viewer-pill rounded-xl px-3 py-2 text-xs font-semibold furniture-toggle-btn';
  btn.onclick=toggleFurniture;
  toolbar.insertBefore(btn,document.getElementById('interaction-mode-controls')||toolbar.querySelector('.presentation-trigger'));

  if(!document.getElementById('furniture-toggle-style')){
    const style=document.createElement('style');
    style.id='furniture-toggle-style';
    style.textContent=`
      .furniture-toggle-btn{transition:.15s ease}
      .furniture-toggle-btn.furniture-off{opacity:.62;border-color:rgba(248,113,113,.38)!important;color:#fecaca!important}
      .furniture-toggle-btn.furniture-off i{color:#f87171}
    `;
    document.head.appendChild(style);
  }

  updateFurnitureButton();
}

if(document.readyState==='loading'){
  window.addEventListener('DOMContentLoaded',()=>setTimeout(installFurnitureToggle,180));
}else{
  setTimeout(installFurnitureToggle,180);
}
