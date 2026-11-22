# BAT-CUBIKEITOR V4.17 — Revestimientos exteriores e interiores

## Alcance

El editor de muros A/B/C/D distingue las terminaciones aplicadas a la fachada exterior de los acabados de la cara interior. El catálogo técnico crece de 60 a **70 partidas** sin cambiar los códigos de las partidas anteriores.

## Revestimientos de fachada nuevos (P50–P59)

| Código | Material |
| --- | --- |
| P50 | Pintura exterior poliuretano gris grafito sobre acero preparado |
| P51 | Sistema anticorrosivo, imprimante y esmalte terracota |
| P52 | Siding de fibrocemento horizontal gris claro |
| P53 | Siding PVC exterior horizontal blanco marfil |
| P54 | WPC exterior listonado tono nogal |
| P55 | Fachada ventilada metálica prepintada antracita |
| P56 | Plancha zinc/aluzinc exterior acanalada gris plata |
| P57 | Placa fibrocemento lisa exterior pintada arena |
| P58 | Enchape de piedra decorativa gris |
| P59 | Madera tratada exterior tipo tinglado tono miel |

También siguen disponibles P44 (tratamiento anticorrosivo preliminar) y P45 (pintura exterior).

## Uso en el editor

1. Selecciona **Muro A, B, C o D** desde los botones de superficies o el visor 3D.
2. Usa **Revestimiento exterior** para aplicar material de fachada. Las partidas interiores no aparecen en este selector.
3. Expande **Revestimiento interior (opcional)** para seleccionar de forma independiente P30–P37 o P46.
4. Los cambios se ven de inmediato en el modelo 3D. Los vanos de puertas y ventanas se conservan.

El catálogo a la izquierda también permite elegir un revestimiento y la cara. Los trasdosados P14/P17 mantienen su representación 3D independiente.

## Estado y compatibilidad JSON

- `finishes.walls.{A,B,C,D}`: acabados exteriores por cara.
- `finishes.interiorWalls.{A,B,C,D}`: acabados interiores por cara.
- Al importar un proyecto antiguo que tenía P30–P37 o P46 en `finishes.walls`, esos códigos se migran a `interiorWalls` para que no aparezcan sobre la fachada.
- La cubicación `getConstructionTakeoff().walls[face]` devuelve `exteriorLiningCode/exteriorLiningAreaM2` y `interiorLiningCode/interiorLiningAreaM2`, conservando `liningCode/liningAreaM2` para clientes antiguos.

## Límites

Los patrones, colores, texturas y representaciones 3D son referenciales, no fichas técnicas homologadas de fabricantes. No se han añadido precios, APU, pesos propios, fijaciones, subestructuras ni tolerancias de montaje. Deben validarse antes de utilizar la cubicación como especificación constructiva o presupuesto definitivo.

## V4.18 — Revestimientos exteriores por paños y orientación

El revestimiento ya no exige cubrir la fachada completa: el cliente puede contratar exactamente **6 m²**, por ejemplo, de madera tratada P59, instalada **vertical u horizontalmente**. El sistema almacena cada paño por ubicación y medidas reales en su cara A/B/C/D.

### Flujo recomendado en el editor

1. Selecciona el muro o escoge P59/P54 en el catálogo y señala la cara.
2. En «Agregar paño exterior por m²» indica **superficie 6**, **ancho 3**, **inicio horizontal 0** y **altura de inicio 0**.
3. El sistema calcula **alto 2 m** (6 m² / 3 m).
4. Selecciona orientación **Vertical** u **Horizontal** y presiona «Agregar paño de revestimiento».
5. Puedes agregar otro paño en el espacio libre, cambiar la orientación del existente o retirarlo.

Las partidas de fachada P44, P45 y P50–P59 admiten la misma lógica. El selector «Acabado de fachada completa (opcional)» queda disponible para proyectos donde corresponde cubrir el muro entero.

### API y JSON

- `finishes.exteriorZones`: array de paños `{ id, face, code, u, v, width, height, orientation }`.
- `Container3D.addExteriorFinishZone({face,code,areaM2,width,u,v,orientation})`: calcula `height=areaM2/width`.
- `updateExteriorFinishZone(id,delta)` y `removeExteriorFinishZone(id)`.
- El área de cada paño se deriva de `width*height`, evitando una segunda cifra susceptible de desincronización.
- `getConstructionTakeoff().exteriorFinishByCodeM2` consolida m² exteriores por código. Si hay un revestimiento de fondo para todo el muro, el área de los paños se resta del fondo para impedir doble conteo.
- Las validaciones bloquean paños superpuestos entre sí o que invadan puertas, ventanas, contactos compartidos y límites de la fachada. También impiden añadir un vano posteriormente en medio de un paño sin editarlo antes.

**Advertencia:** los m² representan superficie geométrica instalada, sin porcentajes de merma, fijaciones ni subestructura; el APU debe permanecer como módulo separado y sumar rendimiento/desperdicio según el sistema elegido. La orientación es visual y descriptiva, todavía no produce un plano de despiece optimizado.
