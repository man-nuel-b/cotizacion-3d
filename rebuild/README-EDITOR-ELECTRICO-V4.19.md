# BAT-CUBIKEITOR V4.19 — Editor eléctrico de precisión

## Funcionalidad

La herramienta **Instalación eléctrica** permite colocar enchufes, interruptores, luminarias y tableros sobre un modelo 3D usando clic/arrastre o coordenadas en milímetros:

- **Muro exterior**: cara A/B/C/D; U (mm) desde el extremo del muro y V (mm) desde el piso terminado.
- **Tabique interior**: elegir ID del tabique y cara A/B; U (mm) desde el inicio del tabique y V (mm) sobre piso.
- **Cielo interior**: solo luminarias; U (mm) desde el origen longitudinal del contenedor y V (mm) desde el origen transversal.
- **Snapping** al mover en el visor: 1, 10, 50 o 100 mm. La entrada numérica exacta admite resolución de 1 mm.
- **Edición/duplicación**: el listado muestra cada punto y ofrece Editar, Mover 3D, Quitar; al editar aparecen las coordenadas y se habilita Duplicar.

Al hacer clic en «Ubicar/arrastrar en 3D», el cursor se convierte en cruz y una malla semitransparente verde/roja indica posiciones válidas/conflictivas. La ubicación se confirma al soltar el ratón. Escape cancela sin alterar el punto.

## Estado y compatibilidad

El editor conserva `state.electrical.points`; cada punto almacena `{id,type,face,u,v}` como antes. Los nuevos puntos añaden `mount: "wall"|"partition"|"ceiling"`. Un montaje en tabique incluye `partitionId` y usa `face: "A"|"B"`; un montaje en cielo utiliza `face: "roof"`.

- Los archivos antiguos, sin `mount`, siguen importándose como puntos sobre muros exteriores, sin reescribir sus valores.
- Las exportaciones JSON conservan montaje y coordenadas.
- La validación rechaza puntos fuera de límites, superpuestos, sobre vanos o puertas de tabique, y sin anfitrión.
- Antes de agregar/editar un vano, puerta interior, cambiar dimensiones o modificar un tabique se comprueba que no se invalide un punto eléctrico.
- Un tabique que tiene puntos eléctricos asociados no puede eliminarse hasta reubicarlos o quitarlos.

## Cubicación y límites

Los puntos colocados manualmente se suman a los conteos de enchufes/interruptores/luminarias/tableros en el estimador existente. La geometría del punto **no determina todavía** trayectos reales de conductor, canalización, caída de tensión, sección, protecciones o cumplimiento normativo SEC. El APU y los precios se mantienen en el módulo existente, separados de la geometría 3D; son cifras preliminares.

Las sugerencias automáticas de puntos siguen siendo referenciales, no equivalentes a la distribución manual. El proyecto ejecutivo eléctrico debe ser revisado por un profesional habilitado.
