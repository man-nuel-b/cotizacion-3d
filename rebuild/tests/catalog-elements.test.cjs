'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Families=require('../core/catalog-families');
const Elements=require('../core/catalog-elements');
const UiMap=require('../core/catalog-ui-map');
const State=require('../core/project-state');
const Materials=require('../core/materials');
const Pricing=require('../core/pricing');
const Catalog=require('../core/catalog');

const expectedCounts={
 pisos:8,tabiques:2,aislaciones:5,revestimientos:7,'estructura-contenedor':8,
 'sistemas-completos':7,sanitarios:10,electricos:7,aberturas:6
};

test('los 60 elementos pedidos están registrados en 9 familias estables',()=>{
 assert.equal(Elements.all.length,60);
 assert.equal(Families.all.length,9);
 assert.deepEqual(Object.keys(Families.byId).sort(),Object.keys(expectedCounts).sort());
 for(const [family,count] of Object.entries(expectedCounts)){
  assert.equal(Elements.byFamily(family).length,count,'Familia '+family);
 }
 const codes=Elements.all.map(x=>x.id);
 assert.equal(new Set(codes).size,60);
 assert.ok(codes.every(id=>/^CAT-[A-Z]{3}-\d{3}$/.test(id)));
});

test('cada elemento contiene nombre, unidad y tipo consultable, sin APU ni precio',()=>{
 const allowedUnits=new Set(['m²','ml','un','servicio']);
 for(const item of Elements.all){
  assert.equal(typeof item.name,'string');
  assert.ok(item.name.trim().length>0);
  assert.ok(allowedUnits.has(item.unit));
  assert.equal(item.recordType,'technical-catalog');
  assert.equal(item.apuLinked,false);
  assert.equal(item.priceLinked,false);
  assert.equal(Object.isFrozen(item),true);
  assert.equal('price' in item,false);
  assert.equal('unitCost' in item,false);
  assert.equal('apuId' in item,false);
  assert.equal('resourceId' in item,false);
  assert.ok(UiMap.describe(item));
  assert.equal(UiMap.describe(item).autoCalculate,false);
  assert.equal(UiMap.describe(item).canPlaceIn3D,false);
  assert.equal(UiMap.describe(item).apuLinked,false);
  assert.equal(Elements.byId[item.id],item);
 }
});

test('se conservan denominaciones y medidas técnicas principales de la lista',()=>{
 assert.equal(Elements.byId['CAT-PIS-001'].name,'Piso vinílico SPC click 4 mm roble natural');
 assert.equal(Elements.byId['CAT-PIS-008'].unit,'ml');
 assert.equal(Elements.byId['CAT-TAB-002'].name,'Tabique estructura madera pino 2x3" @ 40 cm (altura 2,4 m, sin revestir)');
 assert.equal(Elements.byId['CAT-AIS-005'].name,'Aislación poliuretano proyectado 50 mm (subcontrato)');
 assert.equal(Elements.byId['CAT-REV-007'].name,'Revestimiento cerámico/porcelanato muro 30x60 (adhesivo y fragüe)');
 assert.equal(Elements.byId['CAT-EST-004'].referenceDimensionsM.width,1.6);
 assert.equal(Elements.byId['CAT-EST-004'].referenceDimensionsM.height,2.1);
 assert.equal(Elements.byId['CAT-SIS-007'].name,'Impermeabilización zona húmeda con membrana líquida elástica 2 manos + banda de refuerzo');
 assert.equal(Elements.byId['CAT-SAN-010'].name,'Kitchenette 1,8 m instalada (mueble, lavaplatos, grifería; sin puntos de agua/desagüe)');
 assert.equal(Elements.byId['CAT-ELE-007'].unit,'servicio');
 assert.deepEqual(Elements.byId['CAT-ABE-005'].referenceDimensionsM,{width:1,height:.6});
 assert.equal(Elements.byId['CAT-ABE-006'].name,'Ventanal aluminio corredera 150x205 instalado en vano');
});

test('búsqueda tolera acentos y familias sin modificar el registro',()=>{
 const result=Elements.search('vinilico','pisos');
 assert.ok(result.length>=4);
 assert.equal(result.every(i=>i.family==='pisos'),true);
 assert.equal(Elements.search('KITCHENETTE').length,2);
 assert.equal(Elements.search('TE-1').length,1);
 assert.equal(Elements.byFamily().length,60);
 assert.throws(()=>Elements.byFamily('inventada'),/desconocida/);
 assert.equal(Object.isFrozen(Elements.all),true);
});

test('consultar el catálogo no agrega objetos ni altera BOM, presupuesto o estado',()=>{
 const store=State.createStore();
 const before=store.getState();
 const takeoff=Materials.takeoff(before);
 const quote=Pricing.calculate(takeoff,Catalog,before.pricing);
 for(const item of Elements.all)UiMap.describe(item);
 assert.deepEqual(store.getState(),before);
 assert.deepEqual(Materials.takeoff(store.getState()),takeoff);
 assert.deepEqual(Pricing.calculate(takeoff,Catalog,before.pricing),quote);
});
