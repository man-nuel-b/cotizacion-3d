'use strict';
// Valores de referencia extraídos de la hoja "Modulos" del Excel del usuario.
// El Excel cotiza SOLO trabajos de habilitación: excluye contenedor, flete y grúa.
// Estos tests no afirman equivalencia geométrica 3D: confrontan las 60 fichas APU.
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),
fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),ctx=vm.createContext({window:{}});
for(const name of ['apu-excel-resources-1.js','apu-excel-resources-2.js','apu-excel-resources-3.js',
'apu-excel-partidas-1.js','apu-excel-partidas-2.js','apu-excel-partidas-3.js']){
 vm.runInContext(fs.readFileSync(path.join(root,name),'utf8'),ctx,{filename:name});
}
const resources=new Map(ctx.window.BAT_EXCEL_APU_R.map(r=>[r[0],r]));
const partidas=new Map(ctx.window.BAT_EXCEL_APU_A.map(a=>[a[0],a]));
const wages={master:60000,helper:42000,specialist:70000,plumber:70000,electrician:75000,welder:75000,painter:55000};
function unitPrice(code){
 const apu=partidas.get(code);assert.ok(apu,'APU inexistente: '+code);
 const [_,name,unit,group,yieldDay,masters,helpers,role,components]=apu;
 let materials=0,equipment=0;
 for(const [resourceCode,consumption,waste] of components){
  const r=resources.get(resourceCode);assert.ok(r,'Recurso inexistente '+resourceCode);
  const cost=r[4]*consumption*(1+waste/100);
  if(r[1]==='equipment')equipment+=cost;else if(r[1]==='material')materials+=cost;
 }
 const labor=((wages[role]??wages.master)*masters+wages.helper*helpers)*1.30/yieldDay;
 return (materials+equipment+labor+labor*.05)*1.25;
}
const refs={
 medio_bano:{expected:2141172.281449406,items:{P47:1.8,P37:1.8,P05:1.8,P13:5.08,P17:5.88,P16:1.8,P46:12.76,P42:1,P84:1,P80:1,P60:1,P61:1,P64:2,P66:1,P65:1,P67:1,P70:1,P71:1,P68:1}},
 bano_completo:{expected:3531675.799847295,items:{P47:3.525,P37:6.885,P05:3.525,P36:3.36,P13:4.24,P17:8.88,P16:3.525,P46:16.645,P42:1,P84:1,P80:1,P60:1,P61:1,P62:1,P63:1,P64:5,P66:1,P65:2,P67:1,P70:1,P71:1,P72:1,P68:1}},
 bateria_banos:{expected:9144355.392914614,items:{'MOD-BC':2,P80:-2,P40:2,P82:2,P73:1,P74:1,P76:1}},
 oficina_habilitada:{expected:7883122.737065462,items:{P44:56.765,P45:56.765,P47:13.865,P01:13.865,P08:16.5,P14:35.31,P16:13.865,P46:49.175,P41:2,P83:2,P40:1,P82:1,P70:4,P71:6,P72:1,P75:1,P73:1,P74:1,P76:1}},
 studio_habitable:{expected:10898405.436004246,items:{P44:56.765,P45:56.765,P47:13.865,P02:9.635,P05:4.23,P08:12.9,P37:7.59,P36:3.36,P13:4.24,P17:10.32,P14:15.39,P16:13.865,P46:48.055,P41:2,P83:2,P42:1,P84:1,P40:1,P82:1,P80:1,P60:1,P61:1,P62:1,P63:1,P64:7,P66:1,P65:3,P69:1,P67:1,P68:1,P70:5,P71:7,P72:3,P75:1,P73:1,P74:1,P76:1}}
};
function netFor(ref){
 let sum=0;
 for(const [code,qty] of Object.entries(ref.items)){
  // MOD-BC corresponde a un baño completo valorizado con el 5% de contingencia.
  if(code==='MOD-BC')sum+=qty*refs.bano_completo.expected;
  else sum+=qty*unitPrice(code);
 }
 return codeIsBattery(ref)?sum*1.05:sum*1.05;
}
function codeIsBattery(ref){return ref.items['MOD-BC']!==undefined}
test('The original workbook library has 60 unique APU and 123 resources',()=>{
 assert.equal(partidas.size,60);assert.equal(resources.size,123);
 for(const a of partidas.values())for(const x of a[8])assert.ok(resources.has(x[0]),x[0]);
});
test('Reference models agree with workbook including separate 5% contingency and excluding container',()=>{
 for(const [name,ref] of Object.entries(refs)){
  let total=0;
  for(const [code,qty] of Object.entries(ref.items)){
   if(code==='MOD-BC')total+=qty*refs.bano_completo.expected;
   else total+=qty*unitPrice(code);
  }
  total*=1.05;
  assert.ok(Math.abs(total-ref.expected)<2,name+' expected '+ref.expected+' found '+total);
 }
});
test('Check reference unit prices of selected APU against worksheet',()=>{
 for(const [code,expected] of Object.entries({
 P60:184800.84033613448,P61:185840.75630252095,P62:259737.184873949,
 P63:222302.9411764706,P64:49233.65546218487,P65:49627.56302521008,
 P66:75033.40336134454,P73:348869.6953781512,P74:122924.868697479,
 P76:188984.375
 }))assert.ok(Math.abs(unitPrice(code)-expected)<.1,code);
});
