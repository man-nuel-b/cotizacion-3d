/* BAT V2 technical catalog browser.
 * Read-only: no connections to 3D, BOM, pricing, APU or cloud.
 */
(function(root){
'use strict';
const catalog=root.BatCatalogElements;
const families=root.BatCatalogFamilies;
const uiMap=root.BatCatalogUiMap;
if(!catalog||!families||!uiMap)return;
const $=id=>document.getElementById(id);
function init(){
 const rootElement=$('technical-catalog');
 if(!rootElement)return;
 const queryInput=$('catalog-search');
 const familyInput=$('catalog-family');
 const results=$('catalog-results');
 const count=$('catalog-count');
 const info=$('catalog-detail');
 if(!queryInput||!familyInput||!results||!count||!info)return;
 for(const family of families.all){
  const opt=document.createElement('option');
  opt.value=family.id;opt.textContent=family.label;
  familyInput.appendChild(opt);
 }
 let selectedId=null;
 function showDetail(item){
  selectedId=item.id;
  const ui=uiMap.describe(item);
  info.replaceChildren();
  const heading=document.createElement('strong');
  heading.textContent=item.name;
  const line=document.createElement('p');
  line.textContent=item.id+' · '+families.byId[item.family].label+' · '+item.unit;
  const usage=document.createElement('p');
  usage.textContent='Uso previsto: '+ui.title+' · destino: '+ui.surface;
  const dimensions=item.referenceDimensionsM;
  info.append(heading,line,usage);
  if(dimensions){
   const size=document.createElement('p');
   size.textContent='Medida de referencia: '+dimensions.width+' × '+dimensions.height+' m';
   info.appendChild(size);
  }
  const note=document.createElement('p');
  note.className='muted';
  note.textContent='Ficha técnica para consulta. Aún no coloca objetos 3D ni vincula costos o APU.';
  info.appendChild(note);
 }
 function render(){
  const items=catalog.search(queryInput.value,familyInput.value);
  count.textContent=items.length+' de '+catalog.all.length+' elementos';
  results.replaceChildren();
  if(!items.length){
   const empty=document.createElement('p');
   empty.className='muted';empty.textContent='No se encontraron elementos.';
   results.appendChild(empty);
   return;
  }
  for(const item of items){
   const button=document.createElement('button');
   button.type='button';
   button.className='catalog-entry';
   button.setAttribute('aria-pressed',String(item.id===selectedId));
   const name=document.createElement('span');
   name.textContent=item.name;
   const meta=document.createElement('small');
   meta.textContent=item.id+' · '+item.unit;
   button.append(name,meta);
   button.addEventListener('click',()=>{
    showDetail(item);
    for(const entry of results.querySelectorAll('.catalog-entry'))
     entry.setAttribute('aria-pressed','false');
    button.setAttribute('aria-pressed','true');
   });
   results.appendChild(button);
  }
 }
 queryInput.addEventListener('input',render);
 familyInput.addEventListener('change',render);
 render();
 root.BAT_V2_CATALOG=Object.freeze({
  count:()=>catalog.all.length,
  search:(query,family)=>catalog.search(query,family).map(item=>item.id),
  getById:id=>catalog.byId[id]||null
 });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
else init();
})(typeof globalThis!=='undefined'?globalThis:this);