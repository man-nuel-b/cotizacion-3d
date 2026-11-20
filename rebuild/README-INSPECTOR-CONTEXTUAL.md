# BAT-CUBIKEITOR V4.10 — Inspector contextual de edición

- Al seleccionar un tabique paramétrico, ensamblaje del catálogo, objeto, puerta o vano, se abre una ficha amplia a la derecha, sin recorrer la barra lateral.
- Los controles originales y sus IDs son **los mismos**: los mueve `installEditor()` al inspector en el DOM una sola vez, sin duplicar listeners.
- Para tabiques se agrupan a la vista posición/dimensiones, revestimientos cara A/B, aislación, puertas, autoSpan, imán, ajuste al espacio libre, rotación y uniones T/L.
- Para puertas, vanos y objetos se muestran solo las opciones compatibles.
- `Ocultar` o `Escape` cierra el inspector sin eliminar ni deseleccionar el objeto; `Editar elemento seleccionado` lo reabre. Seleccionar otro elemento lo abre automáticamente.
- En ventanas bajas se compactan los mensajes auxiliares para reducir desplazamientos; en pantallas pequeñas existe desplazamiento interno como contingencia de accesibilidad.
- Los botones duplicar/eliminar permanecen visibles en el pie. Los mensajes de error/éxito aparecen en el inspector y en el aviso habitual.
- No se alteran modelos, algoritmo geométrico, cantidades/BOM, ni formato JSON.

**Validación**: ejecutar `npm run test:geometry`, `npm run test:catalog`, `npm run test:e2e` en `rebuild/` con las dependencias instaladas.
