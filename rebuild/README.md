# BAT-CUBIKEITOR V2 · Reconstrucción controlada

**Estado:** primera fase funcional, no reemplaza el BAT-CUBIKEITOR existente.

## Objetivo
Reconstruir el sistema manteniendo su lógica de configuración, visor 3D, cubicación y cotización, pero sin depender de parches globales que se reescriben entre sí.

## Arquitectura inicial
- `core/project-state.js`: estado paramétrico único, validación y eventos.
- `core/materials.js`: cubicación determinista a partir del estado.
- `core/pricing.js`: presupuesto centralizado con redondeo CLP.
- `core/catalog.js`: precios **ilustrativos, no comprobados**.
- `main.js`: coordinación de la interfaz con el visor Three.js.
- `index.html`: demostración funcional de dimensiones, puertas/ventanas, tabiques, BOM, total y respaldo JSON.

## Pruebas
Ejecutar `node --test rebuild/tests/*.test.cjs` (Node.js 22+).
Las pruebas comprueban sincronización 3D/BOM/presupuesto a nivel de estado, rechazo transaccional de datos inválidos, y suma de costos.

## Pendientes deliberados
Aún no están migrados el selector 3D de caras, los arrastres avanzados, colisiones, sistemas eléctricos/sanitarios, el catálogo APU completo, cotización comercial y Supabase. Para cada módulo se requiere una especificación de comportamiento, implementación aislada y prueba de regresión antes de incorporarlo.

## Seguridad
No introducir claves secretas ni credenciales administrativas en el navegador. El nuevo núcleo no escribe a Supabase. El BAT original permanece inalterado.
