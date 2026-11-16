/* BAT-CUBIKEITOR V2 — 60 technical catalog entries from the user's source list.
 * Technical choices only: NO pricing, NO APU IDs, NO automatic BOM or 3D objects.
 * The CAT-* IDs are independent of existing Excel APU codes (e.g. P01).
 * Maintain the order within each family so IDs remain stable in future versions.
 */
(function(root,factory){
 const families=root.BatCatalogFamilies||(typeof require==='function'?require('./catalog-families'):null);
 const api=factory(families);
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.BatCatalogElements=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(Families){
'use strict';
if(!Families?.byId)throw new Error('Faltan las familias del catálogo técnico');
// Each tuple: [name from source, measurement unit, intended UI mode, optional WxH metres].
// The UI mode is advisory only; it does not create, price or modify objects.
const groups=[
{family:'pisos',prefix:'PIS',rows:[
['Piso vinílico SPC click 4 mm roble natural','m²','floor-finish'],
['Piso vinílico SPC click 4 mm roble claro','m²','floor-finish'],
['Piso vinílico SPC click 5 mm 60x120 tono cemento','m²','floor-finish'],
['Piso vinílico continuo en rollo 2 mm (pegado)','m²','floor-finish'],
['Piso vinílico sanitario antideslizante con soldadura y media caña','m²','floor-finish'],
['Porcelanato antideslizante 60x60 (adhesivo y fragüe)','m²','floor-finish'],
['Piso epóxico industrial autonivelante ~2 mm','m²','floor-finish'],
['Zócalo PVC 7 cm','ml','linear-finish']
]},
{family:'tabiques',prefix:'TAB',rows:[
['Tabique estructura Metalcon 60x38 @ 40 cm (altura 2,4 m, sin revestir)','m²','partition-system'],
['Tabique estructura madera pino 2x3" @ 40 cm (altura 2,4 m, sin revestir)','m²','partition-system']
]},
{family:'aislaciones',prefix:'AIS',rows:[
['Aislación lana de vidrio rollo 50 mm con barrera de vapor','m²','insulation'],
['Aislación lana mineral 50 mm con barrera de vapor','m²','insulation'],
['Aislación poliestireno expandido (EPS) 50 mm','m²','insulation'],
['Aislación lana de vidrio panel 50 mm con barrera de vapor','m²','insulation'],
['Aislación poliuretano proyectado 50 mm (subcontrato)','m²','insulation']
]},
{family:'revestimientos',prefix:'REV',rows:[
['Revestimiento volcanita ST 15 mm, 1 cara, juntas listas para pintar','m²','wall-finish'],
['Revestimiento volcanita RH 15 mm (zonas húmedas), 1 cara','m²','wall-finish'],
['Revestimiento fibrocemento liso 6 mm, 1 cara','m²','wall-finish'],
['Revestimiento terciado estructural 12 mm, 1 cara','m²','wall-finish'],
['Revestimiento OSB 9,5 mm, 1 cara','m²','wall-finish'],
['Revestimiento wall panel PVC lavable (sobre base existente)','m²','wall-finish'],
['Revestimiento cerámico/porcelanato muro 30x60 (adhesivo y fragüe)','m²','wall-finish']
]},
{family:'estructura-contenedor',prefix:'EST',rows:[
['Corte de vano puerta 0,90x2,10 m con marco de refuerzo tubular 50x50x3','un','opening-work',[.9,2.1]],
['Corte de vano ventana 1,20x1,00 m con marco de refuerzo tubular 50x50x2','un','opening-work',[1.2,1]],
['Corte de vano ventana baño 1,00x0,60 m con marco de refuerzo tubular 50x50x2','un','opening-work',[1,.6]],
['Corte de vano ventanal 1,60x2,10 m con refuerzo tubular 50x50x3 (dintel)','un','opening-work',[1.6,2.1]],
['Preparación de superficie y anticorrosivo (cepillado, convertidor de óxido, 2 manos)','m²','surface-treatment'],
['Pintura exterior esmalte poliuretano/sintético, 2 manos, sobre anticorrosivo','m²','surface-treatment'],
['Pintura interior látex lavable 2 manos sobre volcanita (con sellador)','m²','surface-treatment'],
['Sobrepiso terciado/OSB 18 mm sobre piso original con barrera de humedad','m²','floor-finish']
]},
{family:'sistemas-completos',prefix:'SIS',rows:[
['Tabique divisorio interior completo: Metalcon 60x38 @40 + lana de vidrio 50 mm + volcanita ST 15 mm ambas caras','m²','composite-system'],
['Tabique zona húmeda: Metalcon 60x38 @40 + lana 50 mm + volcanita RH (cara húmeda) y ST (cara seca)','m²','composite-system'],
['Muro interior de contenedor (trasdosado): Metalcon + barrera de vapor + lana 50 mm + volcanita ST 15 mm','m²','composite-system'],
['Muro interior de contenedor zona húmeda (trasdosado): Metalcon + barrera de vapor + lana 50 mm + volcanita RH 15 mm','m²','composite-system'],
['Muro de cierre completo (relleno de vano/ampliación): Metalcon + OSB 9,5 + fibrocemento 6 + lana 50 + volcanita ST interior','m²','composite-system'],
['Cielo falso: estructura Metalcon + lana 50 mm + volcanita ST 15 mm, listo para pintar','m²','composite-system'],
['Impermeabilización zona húmeda con membrana líquida elástica 2 manos + banda de refuerzo','m²','surface-treatment']
]},
{family:'sanitarios',prefix:'SAN',rows:[
['Inodoro (WC) two piece instalado, con llave de paso y flexible','un','sanitary-object'],
['Lavamanos con pedestal, grifería monomando y sifón instalado','un','sanitary-object'],
['Ducha completa: receptáculo 80x80, grifería monomando y sumidero instalados','un','sanitary-object',[.8,.8]],
['Termo eléctrico 50 L instalado con válvula de seguridad (sin punto eléctrico)','un','equipment'],
['Punto de agua potable fría o caliente PPR 20 mm (hasta 3 m)','un','utility-point'],
['Punto de desagüe PVC 50 mm (lavamanos/ducha/lavaplatos, hasta 2 m)','un','utility-point'],
['Punto de desagüe PVC 110 mm (WC, hasta 3 m)','un','utility-point'],
['Extractor de aire baño 100 mm con ducto, rejilla exterior y conexión','un','equipment'],
['Kit accesorios de baño instalado (portarrollo, toallero, jabonera, espejo)','un','equipment'],
['Kitchenette 1,8 m instalada (mueble, lavaplatos, grifería; sin puntos de agua/desagüe)','un','sanitary-object']
]},
{family:'electricos',prefix:'ELE',rows:[
['Punto de alumbrado con interruptor (hasta 6 m de línea) incluye luminaria LED','un','electrical-point'],
['Punto de enchufe doble 16 A con tierra (hasta 8 m de línea)','un','electrical-point'],
['Punto de fuerza dedicado 220 V (A/A, termo, kitchenette; hasta 10 m) con automático','un','electrical-point'],
['Tablero general 12 módulos con protecciones y acometida 6 mm² (hasta 10 m)','un','equipment'],
['Puesta a tierra del tablero y conexión equipotencial a la estructura del contenedor','un','electrical-point'],
['Aire acondicionado split inverter 12.000 BTU instalado (sin punto de fuerza)','un','equipment'],
['Gestión TE-1 / declaración de instalación eléctrica (instalador autorizado SEC)','servicio','administrative-service']
]},
{family:'aberturas',prefix:'ABE',rows:[
['Puerta interior terciada 70x200 con marco, bisagras y cerradura con pestillo (baño)','un','opening-door',[.7,2]],
['Puerta interior MDF 80x200 con marco, bisagras y cerradura con llave (oficina)','un','opening-door',[.8,2]],
['Puerta exterior de acero 90x205 con marco y cerradura de seguridad, instalada en vano','un','opening-door',[.9,2.05]],
['Ventana aluminio corredera 121x100 instalada en vano','un','opening-window',[1.21,1]],
['Ventana baño aluminio corredera 100x60 instalada en vano','un','opening-window',[1,.6]],
['Ventanal aluminio corredera 150x205 instalado en vano','un','opening-window',[1.5,2.05]]
]}];
const entries=[];
for(const group of groups){
 if(!Families.byId[group.family])throw new Error('Familia de catálogo desconocida: '+group.family);
 for(const [i,row] of group.rows.entries()){
  const [name,unit,uiMode,dimensions]=row;
  const item={id:'CAT-'+group.prefix+'-'+String(i+1).padStart(3,'0'),
   name,family:group.family,unit,uiMode,
   recordType:'technical-catalog',priceLinked:false,apuLinked:false};
  if(dimensions)item.referenceDimensionsM=Object.freeze({width:dimensions[0],height:dimensions[1]});
  entries.push(Object.freeze(item));
 }
}
const all=Object.freeze(entries);
const byId=Object.freeze(Object.fromEntries(all.map(item=>[item.id,item])));
function byFamily(id){
 if(id&&!Families.byId[id])throw new Error('Familia desconocida: '+id);
 return Object.freeze((id?all.filter(item=>item.family===id):all).slice());
}
function search(query='',family=''){
 const normalized=String(query).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es-CL').trim();
 return Object.freeze(byFamily(family).filter(item=>
  (item.name+' '+item.id).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es-CL').includes(normalized)));
}
if(all.length!==60||Object.keys(byId).length!==60)throw new Error('Catálogo técnico V2 incompleto o con códigos repetidos');
return Object.freeze({version:1,all,byId,byFamily,search});
});