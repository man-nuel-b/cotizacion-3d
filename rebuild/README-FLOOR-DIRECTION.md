# BAT-CUBIKEITOR V4.9 — Orientación del piso

En **Dimensiones**, usar el selector **Orientación del piso**: longitud (eje L/X) o ancho (eje W/Z).
La elección cambia la rotación de la textura en el piso general y en un piso de baño ubicado en 3D, cuando el material tenga un mapa de textura. La superficie en m² no cambia. Materiales lisos o patrones simétricos pueden verse iguales al girar.

- Se guarda como `floorDirection: "length" | "width"` en el estado y JSON versión 3 existente.
- Proyectos JSON antiguos sin este campo se interpretan `length`.
- Valores desconocidos se rechazan sin modificar el diseño.
- Cambiar de tipo de contenedor restablece `length`.
- El material de las puertas y paredes nunca comparte la textura rotada del suelo de madera.
- Pruebas: `cd rebuild && npm run test:geometry`; E2E con `npm run test:e2e` tras instalar `npm install` y Chromium.

La orientación es visual; no incluye patrón de corte, merma de instalación ni BOM valorizado.
