# BAT-CUBIKEITOR V4.11 — Inspector acoplado y edición en vivo

## Uso

1. Entra al editor de BAT-CUBIKEITOR y selecciona un tabique, una puerta, una ventana o un objeto 3D.
2. Se abrirá una ficha **a la derecha del visor**, sin cubrir la escena. El catálogo sigue disponible a la izquierda; pulsa «Ocultar catálogo» para ampliar el área del modelo.
3. Cambia las coordenadas, largo, ancho, espesor, alto o giro: después de una pausa breve (170 ms) el motor aplica el **campo modificado** directamente a la escena, sin necesidad de pulsar «Aplicar modificaciones». Los materiales A/B, aislación y otros selectores siguen aplicándose inmediatamente.
4. Las reglas de colisión, perfiles y vanos siguen activas. Si una medida es inválida, se muestra el error y **se conserva la última geometría válida**.
5. «Deshacer último cambio» revierte la **última modificación geométrica individual** realizada desde los campos; no es un historial general ni revierte cambios de materiales, creación o eliminación.
6. «Ocultar» cierra la ficha contextual y restaura los paneles habituales.

## Detalles técnicos

- `rebuild/index.html`: diseño acoplado y adaptable, con `inspector-docked`, opción `catalog-collapsed`, feedback y botón de deshacer.
- `rebuild/container-engine.js`: WebGL y cámara usan las dimensiones reales de `#view`, observadas por `ResizeObserver`. La escena nunca se estira ni queda bajo el inspector.
- `rebuild/container-editor-ui.js`: llamadas a `updatePartition`, `updateObject`, `updateOpening` o `updateInteriorDoor` sobre **una sola propiedad** por edición; validación previa a reconstruir la escena; preservación de texto mientras se escribe.
- `rebuild/tests/live-inspector-wiring.mjs`: pruebas de conexión del modo vivo y layout.
- `rebuild/tests/editor-smoke.mjs`: escenario E2E de vista sin superposición, cambio en vivo, rechazo de colisiones y deshacer.

**Limitaciones:** no es una edición por vértices ni un motor BIM certificado. Las mallas ilustrativas del catálogo pueden no tener geometría industrial exacta. Una colisión rechazada no permite el cambio visible, y la entrada inválida debe corregirse. No hay análisis de precios/APU en esta versión.
