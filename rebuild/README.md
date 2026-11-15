# BAT-CUBIKEITOR V2 — Reconstrucción controlada

**Estado:** editor geométrico y cúbica básica comprobados; no reemplaza BAT-CUBIKEITOR original.

## Diseño

Todos los cambios se procesan en `BatProjectState` de forma síncrona y validada. Ninguna malla de Three.js es la fuente de verdad para presupuestos ni geometrías; el visor, BOM y cotización se derivan del mismo estado.

| Archivo | Función |
|---|---|
| `core/project-state.js` | Estado único, eventos, medidas, límites y colisiones de aberturas/tabiques |
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
- Agregar, seleccionar, mover o eliminar tabiques mediante coordenadas X/Z.
- Validar límites, superposiciones horizontales y verticales y entrada numérica antes de modificar el proyecto.
- Ver recalcular la BOM y el costo con cada modificación válida.
- Rechazar cambios inválidos sin cambiar el estado ni el presupuesto.
- Exportar e importar JSON validado de esta versión.

## Pruebas

```sh
node --test rebuild/tests/*.test.cjs
```

El workflow `.github/workflows/bat-v2-core.yml` ejecuta además Chromium con Playwright y Three.js. Comprueba la interfaz en navegador, la colocación 3D de una abertura, el recálculo BOM/precio y el rechazo de movimientos fuera de rango. **Estas pruebas no equivalen a una certificación completa de producción.**

## Limitaciones deliberadas

- Las puertas y ventanas son marcadores visuales sobre superficies; **aún no hay perforación constructiva real de mallas** ni generación de planimetría.
- Los tabiques se representan esquemáticamente y la edición espacial inicial se hace con coordenadas; arrastre libre con detección de obstáculos especializados está pendiente.
- APU Excel completo, instalación eléctrica, sanitaria, mobiliario, control de usuarios, Supabase y sincronización en nube **aún no están integrados en V2**.
- La exportación/importación JSON es manual: esta fase **no tiene guardado automático en Supabase**.
- Catálogo de referencia no representa precios actuales de proveedores.

## Seguridad del cambio

La nueva versión reside exclusivamente en `rebuild/` dentro de la rama `rebuild/bat-core-v2`. Ni el producto original en `main` ni el proyecto CUBIKEITOR 3000 fueron reemplazados.
