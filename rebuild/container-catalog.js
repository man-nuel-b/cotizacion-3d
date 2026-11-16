/* Catálogo técnico V2: 60 partidas proporcionadas por el usuario.
 * Dimensiones por defecto ilustrativas/editables cuando la partida no las fija.
 * Sin precios, APU, BOM ni conexión a Supabase.
 */
export const FAMILIES=Object.freeze([
 ['pisos','Pisos y zócalos'],
 ['estructura','Estructuras y aislaciones'],
 ['revestimientos','Revestimientos'],
 ['contenedor','Estructura del contenedor'],
 ['sistemas','Tabiques, muros y cielos'],
 ['sanitarios','Sanitarios y kitchenette'],
 ['electricos','Electricidad y climatización'],
 ['aberturas','Puertas y ventanas']
].map(([id,name])=>Object.freeze({id,name})));
const records=[
 // [codigo, familia, modo, nombre, dimensiones por defecto [ancho,alto,profundidad], variante]
 ['P01','pisos','floor','Piso vinílico SPC click 4 mm roble natural',null,'oak'],
 ['P02','pisos','floor','Piso vinílico SPC click 4 mm roble claro',null,'light-oak'],
 ['P03','pisos','floor','Piso vinílico SPC click 5 mm 60x120 tono cemento',null,'cement'],
 ['P04','pisos','floor','Piso vinílico continuo en rollo 2 mm (pegado)',null,'roll'],
 ['P05','pisos','floor','Piso vinílico sanitario antideslizante con soldadura y media caña',null,'sanitary'],
 ['P06','pisos','floor','Porcelanato antideslizante 60x60 (adhesivo y fragüe)',null,'tile'],
 ['P07','pisos','floor','Piso epóxico industrial autonivelante ~2 mm',null,'epoxy'],
 ['P08','pisos','skirting','Zócalo PVC 7 cm',null,'skirting'],
 ['P10','estructura','wall-object','Tabique estructura Metalcon 60x38 @ 40 cm (altura 2,4 m, sin revestir)',[1.6,2.35,.06],'metal-studs'],
 ['P11','estructura','wall-object','Tabique estructura madera pino 2x3" @ 40 cm (altura 2,4 m, sin revestir)',[1.6,2.35,.075],'wood-studs'],
 ['P20','estructura','wall-object','Aislación lana de vidrio rollo 50 mm con barrera de vapor',[1.2,1.4,.05],'glass-wool'],
 ['P21','estructura','wall-object','Aislación lana mineral 50 mm con barrera de vapor',[1.2,1.4,.05],'mineral-wool'],
 ['P22','estructura','wall-object','Aislación poliestireno expandido (EPS) 50 mm',[1.2,1.4,.05],'eps'],
 ['P23','estructura','wall-object','Aislación lana de vidrio panel 50 mm con barrera de vapor',[1.2,1.4,.05],'glass-panel'],
 ['P30','revestimientos','wall-finish','Revestimiento volcanita ST 15 mm, 1 cara, juntas listas para pintar',null,'gypsum'],
 ['P31','revestimientos','wall-finish','Revestimiento volcanita RH 15 mm (zonas húmedas), 1 cara',null,'moisture'],
 ['P32','revestimientos','wall-finish','Revestimiento fibrocemento liso 6 mm, 1 cara',null,'fiber-cement'],
 ['P33','revestimientos','wall-finish','Revestimiento terciado estructural 12 mm, 1 cara',null,'plywood'],
 ['P34','revestimientos','wall-finish','Revestimiento OSB 9,5 mm, 1 cara',null,'osb'],
 ['P35','revestimientos','wall-finish','Revestimiento wall panel PVC lavable (sobre base existente)',null,'pvc'],
 ['P40','contenedor','opening','Corte de vano puerta 0,90x2,10 m con marco de refuerzo tubular 50x50x3',[.9,2.1,.05],'cut-door'],
 ['P41','contenedor','opening','Corte de vano ventana 1,20x1,00 m con marco de refuerzo tubular 50x50x2',[1.2,1,.05],'cut-window'],
 ['P42','contenedor','opening','Corte de vano ventana baño 1,00x0,60 m con marco de refuerzo tubular 50x50x2',[1,.6,.05],'cut-bath'],
 ['P43','contenedor','opening','Corte de vano ventanal 1,60x2,10 m con refuerzo tubular 50x50x3 (dintel)',[1.6,2.1,.05],'cut-glass'],
 ['P44','contenedor','wall-finish','Preparación de superficie y anticorrosivo (cepillado, convertidor de óxido, 2 manos)',null,'primer'],
 ['P45','contenedor','wall-finish','Pintura exterior esmalte poliuretano/sintético, 2 manos, sobre anticorrosivo',null,'paint-out'],
 ['P46','contenedor','wall-finish','Pintura interior látex lavable 2 manos sobre volcanita (con sellador)',null,'paint-in'],
 ['P47','contenedor','floor','Sobrepiso terciado/OSB 18 mm sobre piso original con barrera de humedad',null,'osb-floor'],
 ['P48','contenedor','wall-object','Aislación poliuretano proyectado 50 mm (subcontrato)',[1.2,1.5,.05],'spray-foam'],
 ['P12','sistemas','wall-object','Tabique divisorio interior completo: Metalcon 60x38 @40 + lana de vidrio 50 mm + volcanita ST 15 mm ambas caras',[1.6,2.35,.12],'partition'],
 ['P13','sistemas','wall-object','Tabique zona húmeda: Metalcon 60x38 @40 + lana 50 mm + volcanita RH (cara húmeda) y ST (cara seca)',[1.6,2.35,.12],'wet-partition'],
 ['P14','sistemas','wall-object','Muro interior de contenedor (trasdosado): Metalcon + barrera de vapor + lana 50 mm + volcanita ST 15 mm',[1.6,2.35,.12],'wall-lining'],
 ['P17','sistemas','wall-object','Muro interior de contenedor zona húmeda (trasdosado): Metalcon + barrera de vapor + lana 50 mm + volcanita RH 15 mm',[1.6,2.35,.12],'wet-lining'],
 ['P15','sistemas','wall-object','Muro de cierre completo (relleno de vano/ampliación): Metalcon + OSB 9,5 + fibrocemento 6 + lana 50 + volcanita ST interior',[1.6,2.35,.15],'closure'],
 ['P16','sistemas','ceiling','Cielo falso: estructura Metalcon + lana 50 mm + volcanita ST 15 mm, listo para pintar',null,'false-ceiling'],
 ['P36','sistemas','wall-finish','Revestimiento cerámico/porcelanato muro 30x60 (adhesivo y fragüe)',null,'wall-tile'],
 ['P37','sistemas','wall-finish','Impermeabilización zona húmeda con membrana líquida elástica 2 manos + banda de refuerzo',null,'waterproof'],
 ['P60','sanitarios','object','Inodoro (WC) two piece instalado, con llave de paso y flexible',[.40,.78,.68],'toilet'],
 ['P61','sanitarios','object','Lavamanos con pedestal, grifería monomando y sifón instalado',[.55,.86,.48],'sink'],
 ['P62','sanitarios','object','Ducha completa: receptáculo 80x80, grifería monomando y sumidero instalados',[.8,2.05,.8],'shower'],
 ['P63','sanitarios','object','Termo eléctrico 50 L instalado con válvula de seguridad (sin punto eléctrico)',[.45,.85,.45],'water-heater'],
 ['P64','sanitarios','object','Punto de agua potable fría o caliente PPR 20 mm (hasta 3 m)',[.8,.5,.16],'water-point'],
 ['P65','sanitarios','object','Punto de desagüe PVC 50 mm (lavamanos/ducha/lavaplatos, hasta 2 m)',[.8,.4,.12],'drain-50'],
 ['P66','sanitarios','object','Punto de desagüe PVC 110 mm (WC, hasta 3 m)',[.8,.45,.16],'drain-110'],
 ['P67','sanitarios','object','Extractor de aire baño 100 mm con ducto, rejilla exterior y conexión',[.22,.22,.14],'extractor'],
 ['P68','sanitarios','object','Kit accesorios de baño instalado (portarrollo, toallero, jabonera, espejo)',[.65,.9,.16],'bath-accessories'],
 ['P69','sanitarios','object','Kitchenette 1,8 m instalada (mueble, lavaplatos, grifería; sin puntos de agua/desagüe)',[1.8,2.05,.6],'kitchenette'],
 ['P70','electricos','object','Punto de alumbrado con interruptor (hasta 6 m de línea) incluye luminaria LED',[.52,.09,.52],'light'],
 ['P71','electricos','object','Punto de enchufe doble 16 A con tierra (hasta 8 m de línea)',[.16,.1,.06],'outlet'],
 ['P72','electricos','object','Punto de fuerza dedicado 220 V (A/A, termo, kitchenette; hasta 10 m) con automático',[.16,.16,.11],'power'],
 ['P73','electricos','object','Tablero general 12 módulos con protecciones y acometida 6 mm² (hasta 10 m)',[.46,.64,.17],'panel'],
 ['P74','electricos','object','Puesta a tierra del tablero y conexión equipotencial a la estructura del contenedor',[.36,.34,.06],'grounding'],
 ['P75','electricos','object','Aire acondicionado split inverter 12.000 BTU instalado (sin punto de fuerza)',[.9,.34,.25],'aircon'],
 ['P76','electricos','service','Gestión TE-1 / declaración de instalación eléctrica (instalador autorizado SEC)',null,'te1'],
 ['P80','aberturas','opening','Puerta interior terciada 70x200 con marco, bisagras y cerradura con pestillo (baño)',[.7,2,.05],'door-wood'],
 ['P81','aberturas','opening','Puerta interior MDF 80x200 con marco, bisagras y cerradura con llave (oficina)',[.8,2,.05],'door-mdf'],
 ['P82','aberturas','opening','Puerta exterior de acero 90x205 con marco y cerradura de seguridad, instalada en vano',[.9,2.05,.05],'door-steel'],
 ['P83','aberturas','opening','Ventana aluminio corredera 121x100 instalada en vano',[1.21,1,.05],'window'],
 ['P84','aberturas','opening','Ventana baño aluminio corredera 100x60 instalada en vano',[1,.6,.05],'bath-window'],
 ['P85','aberturas','opening','Ventanal aluminio corredera 150x205 instalado en vano',[1.5,2.05,.05],'glazing']
];
if(records.length!==60)throw new Error('El catálogo debe tener exactamente 60 partidas');
const ids=new Set();for(const r of records){if(ids.has(r[0]))throw new Error('Código repetido: '+r[0]);ids.add(r[0]);}
export const CATALOG=Object.freeze(records.map(([code,family,mode,name,size,visual])=>
 Object.freeze({code,family,mode,name,size:size?Object.freeze(size.slice()):null,visual})));
export const CATALOG_BY_CODE=Object.freeze(Object.fromEntries(CATALOG.map(x=>[x.code,x])));
export const findCatalog=(query='',family='')=>{
 const q=String(query).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 return CATALOG.filter(x=>(!family||x.family===family)&&
 (x.code+' '+x.name).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(q));
};
