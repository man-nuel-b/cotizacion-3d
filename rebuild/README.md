# BAT-CUBIKEITOR V2 — Reconstrucción controlada

**Estado:** editor geométrico y cúbica básica comprobados; no reemplaza BAT-CUBIKEITOR original.

## Diseño

Todos los cambios se procesan en `BatProjectState` de forma síncrona y validada. Ninguna malla de Three.js es la fuente de verdad para presupuestos ni geometrías; el visor, BOM y cotización se derivan del mismo estado.

| Archivo | Función |
|---|---|
| `core/project-state.js` | Estado único, eventos, medidas, límites y colisiones de aberturas/tabiques |
| `core/model-cost-bridge.js` | Proyección atómica y síncrona de estado → BOM → precio antes de confirmar un cambio |
| `core/cloud-sync.js` | Cola desacoplada para futuros guardados, control de versiones optimista y rechazo de cargas obsoletas; **no conectada a Supabase** |
| `core/apu-catalog.js` | Validación estricta de catálogos APU; **no reemplaza el catálogo comercial actual** |
| `core/spatial.js` | Interpretación de clic sobre caras A/B/C/D y ajuste de posición a cuadrícula de 5 cm |
| `core/materials.js` | Cubicación geométrica, superficies y cantidades |
| `core/pricing.js` | Totales centralizados en CLP, gastos generales, utilidad, imprevistos e IVA |
| `core/catalog.js` | Precios ilustrativos, NO precios comerciales verificados |
| `main.js` | Interfaz, selección directa en visor, render 3D y exportación/importación JSON |
| `index.html` | Demostrador interactivo de reconstrucción V2 |

## Funciones verificadas

- Editar dimensiones del contenedor.
- Agregar ventana o puerta por coordenadas, o activando el modo «Elegir cara y posición en el visor 3D» y haciendo clic sobre una pared.
- Seleccionar una abertura existente desde el visor o la lista y moverla haciendo clic sobre otra pared.
- Agregar, seleccionar, mover o eliminar tabiques mediante coordenadas X/Z, con orientación X/Z y espesor entre 4 y 30 cm.
- Validar límites, superposiciones horizontales y verticales y entrada numérica antes de modificar el proyecto.
- Ver recalcular la BOM y el costo con cada modificación válida.
- Rechazar cambios inválidos sin cambiar el estado ni el presupuesto. Los cálculos BOM y precios se validan antes del commit.
- Pruebas de estrés con más de 20 ventanas, 20 tabiques y cambios financieros consecutivos.
- Validación aislada de APU con celdas vacías, precios nulos, referencias inexistentes y rendimientos cero.
- Exportar e importar JSON validado de esta versión.

## Pruebas

```sh
node --test rebuild/tests/*.test.cjs
```

El workflow `.github/workflows/bat-v2-core.yml` ejecuta además Chromium con Playwright y Three.js. Las pruebas de sincronización cloud usan exclusivamente dobles de prueba (sin cuenta de Supabase, sin conexión real). Comprueba la interfaz en navegador, la colocación 3D de una abertura, el recálculo BOM/precio y el rechazo de movimientos fuera de rango. **Estas pruebas no equivalen a una certificación completa de producción.**

## Limitaciones deliberadas

- Las puertas y ventanas son marcadores visuales sobre superficies; **aún no hay perforación constructiva real de mallas** ni generación de planimetría.
- Los tabiques se representan esquemáticamente y la edición espacial inicial se hace con coordenadas; arrastre libre con detección de obstáculos especializados está pendiente.
- APU Excel completo, instalación eléctrica, sanitaria, mobiliario, control de usuarios, Supabase y sincronización en nube **aún no están integrados en V2**. El validador APU y el controlador de sincronización son componentes aislados de preparación, no conectores activos.
- La exportación/importación JSON es manual: esta fase **no tiene guardado automático en Supabase**.
- Catálogo de referencia no representa precios actuales de proveedores.

## Seguridad del cambio

La nueva versión reside exclusivamente en `rebuild/` dentro de la rama `rebuild/bat-core-v2`. Ni el producto original en `main` ni el proyecto CUBIKEITOR 3000 fueron reemplazados.


## Auditoría de integridad — 15 de noviembre de 2026

- **Estado/BOM/presupuesto:** `model-cost-bridge.js` deriva la cubicación y la cotización antes de confirmar una acción. No se recalculan costos leyendo mallas o el DOM.
- **Montos CLP:** `pricing.js` rechaza entradas vacías, valores no numéricos y resultados que desborden `Number.MAX_SAFE_INTEGER`, incluso cuando el desbordamiento aparece solo al sumar partidas, transporte o impuestos.
- **Coordenadas:** `spatial.js` rechaza puntos fuera del contenedor y alturas fuera del muro. `fitPartitionCenter` prepara el ajuste interno para futuros arrastres; **no activa arrastre libre**.
- **Carga/guardado:** `cloud-sync.js` bloquea guardados mientras se lee una versión remota, impide cargas simultáneas, exige aplicar el JSON remoto de forma síncrona y atómica y rechaza datos que quedarían obsoletos. Sus pruebas usan adaptadores simulados y **no hay conexión real a Supabase**.
- **Separación APU:** `apu-catalog.js` solo valida un catálogo aislado. Por decisión funcional, **no debe conectarse el APU a los objetos 3D hasta diseñar la nueva asociación**.
- **Pruebas:** `rebuild/tests/edge-guards.test.cjs` y los tests de nube refuerzan límites, redondeos, overflow y condiciones de carrera. Se ejecutan en CI junto a la prueba en Chromium.

La carpeta raíz se conserva para referencia funcional y compatibilidad. Su migración futura será por componentes, no mediante eliminación masiva o reemplazo del producto existente.

## Catálogo técnico estructurado (etapa independiente)

La lista de **60 elementos proporcionada por el usuario** está disponible en `core/catalog-elements.js`, organizada en **9 familias** (`core/catalog-families.js`). Las fichas incluyen identificador independiente `CAT-...`, nombre técnico, unidad, modo de representación previsto y dimensiones de referencia cuando aparecen en la fuente. La tabla `core/catalog-ui-map.js` describe la presentación sin ejecutar acciones sobre los objetos.

| Familia | Cantidad |
|---|---:|
| Pisos y zócalos | 8 |
| Estructuras de tabiques | 2 |
| Aislaciones | 5 |
| Revestimientos | 7 |
| Estructura del contenedor | 8 |
| Sistemas completos de tabiques, muros y cielos | 7 |
| Sanitarios y kitchenette | 10 |
| Eléctricos y climatización | 7 |
| Puertas y ventanas | 6 |
| **Total** | **60** |

La interfaz de `index.html` contiene un desplegable **«4. Catálogo técnico · 60 elementos»** con filtro de familia, búsqueda por nombre y ficha consultable. La implementación es **solo lectura**: consultar o seleccionar una ficha **no añade geometría, no cambia materiales/BOM, no modifica presupuestos y no vincula los APU**. El catálogo de precios ilustrativos `core/catalog.js` continúa siendo un módulo diferente.

La agrupación respeta los 60 conceptos del listado original; las secciones de encabezado no se contabilizan como elementos. Las unidades de medición son propuestas de clasificación y deben revisarse técnicamente antes de presupuestar; no se extrapolan costos ni proveedores de estos metadatos.

**Próximas etapas (no realizadas en esta fase):** selección visual avanzada, representación 3D según familia y definición futura del modelo de asociación objeto–solución constructiva–APU, solo cuando se acuerde explícitamente.

## Integridad de edición, ciclo de vida y respaldos locales

Desde esta etapa el editor incluye **actualización de dimensiones de aberturas y tabiques seleccionados**. Los cambios usan acciones `opening/update` y `partition/update` del estado único; las validaciones y la proyección BOM/cotización se ejecutan **antes** de confirmar una modificación. Los campos temporalmente inválidos al escribir (por ejemplo altura vacía o longitud cero) no producen cambios ni partidas `NaN`.

El controlador principal libera explícitamente recursos al salir de la página o al reiniciar el visor: elimina escuchas vinculadas mediante `AbortController`, desconecta `ResizeObserver`, cancela `requestAnimationFrame`, elimina objetos de Three.js y libera los controles de cámara/WebGL. `start()` es idempotente y se restaura en `pageshow` cuando corresponde; los avisos y la copia local se mantienen separados de errores de renderizado.

### Recuperación local, sin nube
- `core/local-backup.js` guarda **solo el estado del proyecto** en `localStorage` del mismo navegador después de cada acción válida. No guarda contraseñas ni conecta Supabase.
- La recuperación es **manual** con el botón «Restaurar copia local», que solicita confirmación. Al iniciar, V2 no reemplaza automáticamente un proyecto con una copia antigua.
- Los datos almacenados localmente pueden perderse al borrar la caché/datos del sitio, usar navegación privada o cambiar de navegador. También pueden fallar por cuota o bloqueos de privacidad; el error se informa, sin bloquear el proyecto.
- El respaldo externo mediante archivo JSON continúa disponible y es recomendable para proyectos importantes. No se deben ingresar datos personales o confidenciales en el prototipo de vista previa.
- `cloud-sync.js` sigue como protocolo inactivo sin Supabase. La lógica de APU **no se ha vinculado** a los objetos 3D.

### Precisión monetaria y validación
La moneda de la versión V2 es **CLP sin centavos**. Cada línea se redondea a pesos enteros y se revisan subtotales, IVA, totales y desbordamientos numéricos. Los ensayos incluyen cantidades fraccionarias de m² (incluyendo el caso `0.1 + 0.2`), errores de fórmula y valores nulos. Los precios siguen siendo **referenciales**, no APU de proveedores.

Las pruebas `dimension-update.test.cjs`, `local-backup.test.cjs`, `pricing-precision.test.cjs` y las pruebas en Chromium cubren estos cambios. Las pruebas superadas no garantizan ausencia total de fallos en producción.
