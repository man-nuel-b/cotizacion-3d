# BAT-CUBIKEITOR V4.9.2 · Ajustar tabique al espacio libre

Esta versión es una **copia local separada** de la V4.9.1; no modifica el proyecto original ni GitHub. Se conserva la base histórica V4.3.

## Uso

1. Crear o seleccionar un tabique **paramétrico** en la escena o lista de elementos.
2. Desde **Propiedades del elemento**, presionar **Ajustar al espacio libre**.
3. El motor calcula los obstáculos más próximos en el eje X o Z, conserva la coordenada perpendicular y ajusta el largo y el centro, sin atravesar tabiques ni objetos.
4. En tabiques ortogonales puede terminar **a ras de cara** formando T/L; en tabiques paralelos y mobiliario mantiene una pequeña holgura.
5. Si hay puertas, el motor procura preservar su **posición absoluta en planta** y rechaza el ajuste cuando quedan fuera del nuevo vano.

El botón desactiva `autoSpan` de forma expresa. La operación es transaccional: ante una colisión no cambia la geometría ni las puertas; los proyectos JSON existentes conservan su estructura. El cálculo del espacio libre es geométrico preliminar, no sustituye detalles de refuerzos ni normas estructurales.

## Validar

```bash
cd rebuild
node --test tests/construction-integrity.mjs tests/free-partition-span.mjs tests/partition-api-integration.mjs tests/engine-wiring.mjs
```

Para validación visual se necesita instalar Three.js y Playwright, y ejecutar `npm run test:e2e` desde `rebuild`.
