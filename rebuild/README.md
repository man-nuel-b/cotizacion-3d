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
