/* BAT-Kubiqueitor: calculo financiero centralizado. Base directa y recargos nunca se mezclan. */
(function(root){
  'use strict';
  const number=(v,fallback=0)=>{const n=Number(v);return Number.isFinite(n)?n:fallback;};
  const nonnegative=v=>Math.max(0,number(v));
  function calculate({bom=[],externalLabor=0,transport=0,overheadPct=0,profitPct=0,taxPct=19}={}){
    if(!Array.isArray(bom))throw new TypeError('La cubicacion debe ser un arreglo');
    let apuMaterial=0,apuLabor=0,nonApuMaterials=0,nonApuLabor=0,equipment=0;
    const invalid=[];
    for(let i=0;i<bom.length;i++){
      const item=bom[i]||{},qty=number(item.qty,NaN),subtotal=number(item.subtotal,NaN);
      if(!Number.isFinite(qty)||qty<0||!Number.isFinite(subtotal)||subtotal<0){
        invalid.push(i+1);continue;
      }
      if(item.excelApu&&item.apuBreakdown){
        const b=item.apuBreakdown;
        apuMaterial+=qty*(nonnegative(b.materials)+nonnegative(b.tools));
        equipment+=qty*nonnegative(b.equipment);
        apuLabor+=qty*nonnegative(b.labor);
      }else if(item.laborOnly){
        nonApuLabor+=subtotal;
      }else{
        nonApuMaterials+=subtotal;
      }
    }
    if(invalid.length)throw new RangeError('Partidas invalidas: '+invalid.join(', '));
    const materials=apuMaterial+equipment+nonApuMaterials;
    const labor=apuLabor+nonApuLabor+nonnegative(externalLabor);
    const haul=nonnegative(transport);
    const direct=materials+labor+haul;
    const overhead=direct*nonnegative(overheadPct)/100;
    const profit=direct*nonnegative(profitPct)/100;
    const net=direct+overhead+profit;
    const taxAmount=net*nonnegative(taxPct)/100;
    return {bom,materials,labor,transport:haul,direct,overhead,profit,net,taxAmount,total:net+taxAmount,
      externalLabor:nonnegative(externalLabor),apuMaterials:apuMaterial+equipment,apuLabor,
      nonApuMaterials,nonApuLabor,apuDirect:apuMaterial+equipment+apuLabor,
      nonApuDirect:nonApuMaterials+nonApuLabor,
      overheadPct:nonnegative(overheadPct),profitPct:nonnegative(profitPct),taxPct:nonnegative(taxPct),
      method:'canonical-apu-v1',invalid:[]};
  }
  const api=Object.freeze({version:1,calculate});
  root.BAT_KUBIQUEITOR_PRICING_INTEGRITY=api;
  if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
