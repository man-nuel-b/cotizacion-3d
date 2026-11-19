# BAT-CUBIKEITOR V4.6 — Arrastre e imán constructivo

Se mantiene el diseño V4.5. Esta versión implementa:

1. **Arrastre real**: selecciona un tabique paramétrico con un clic, mantén presionado y arrástralo con el mouse sobre el contenedor. Suelta para validar y guardar. `Esc` cancela sin modificar el proyecto.
2. **Ajuste magnético** (activado por defecto para el tabique seleccionado): si el extremo del tabique manual está a menos de 18 cm de una cara interior del contenedor, encaja exactamente; la longitud original NO se altera. Desmarca «Imán» para mover sin acoplamiento.
3. **Encuentros T y L**: al acercar un extremo a la cara de otro tabique perpendicular, el imán crea un encuentro cara-con-testa, siempre que el resultado no invada puertas, no cruce perfiles y pase las validaciones de geometría. Los cruzamientos profundos y tabiques coincidentes continúan prohibidos.
4. **autoSpan**: los tabiques con ajuste entre muros mantienen su luz útil y solo se desplazan transversalmente; para acoplar un tabique manual a un único extremo de muro, desactiva `autoSpan` en sus propiedades.
5. **Vista previa no destructiva**: mover el cursor no cambia el estado ni la cubicación; al soltar se aplica la misma validación que en el motor. Si no cabe, vuelve a su posición anterior.

**Limitaciones**: encuentro geométrico aproximado, no proyecto de cálculo estructural ni BOM valorizado. El arrastre magnético se aplica a `state.partitions`; los ensamblajes P10–P15 del catálogo son objetos 3D independientes y conservan su comportamiento de arrastre de objetos.

## Pruebas

En `rebuild/`, ejecuta `npm run test:geometry`; y tras instalar `three` y `playwright`, `npm run test:e2e`.

Para visualizar localmente, desde la raíz sirve `python -m http.server 8000`, luego visita `http://localhost:8000/rebuild/`. Para la versión publicada usa GitHub Pages.
