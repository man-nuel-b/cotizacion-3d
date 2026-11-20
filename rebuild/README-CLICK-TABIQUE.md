# BAT-CUBIKEITOR V4.9.3 · Crear tabique ajustado con clic en planta

Esta versión se basa en el ZIP V4.9.2 local. No modifica GitHub ni la versión desplegada.

## Uso

1. Abre **Elementos incorporados → Crear tabique en el punto elegido**.
2. Selecciona eje X (longitudinal) o Z (transversal) y la dirección: ambos lados, positivo o negativo.
3. Pulsa **Colocar tabique ajustado (clic 3D)** y haz clic en el piso del contenedor desde una vista superior.
4. Se busca el tramo continuo desde el punto seleccionado, limitado por perfiles, objetos girados y otros tabiques. Se coloca el nuevo tabique solo después de validar la geometría y las colisiones; un clic crea como máximo uno.
5. Si la posición está ocupada, se informa el error y puedes intentar de nuevo. **Esc** cancela.

El botón histórico «Añadir tabique paramétrico» conserva el funcionamiento anterior. Las llamadas API existentes con longitud explícita no se ajustan automáticamente; el nuevo modo usa `autoFit:true` y `fitDirection`. Las llamadas sin longitud explícita y sin `autoSpan/autoPlace` activan autoFit por defecto. No se alteran JSON históricos.

El cálculo es geométrico preliminar; no sustituye el detalle constructivo de uniones T/L o la validación en obra.

## Validación

Desde `rebuild`: `npm run test:geometry` y `npm run test:catalog`. Las pruebas E2E requieren `three` y `playwright` y un navegador Chromium disponible.
