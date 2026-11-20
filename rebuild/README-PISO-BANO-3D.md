# BAT-CUBIKEITOR V4.8 — Piso visible de baño

## Utilización

1. Abre `rebuild/index.html` desde un servidor local (o GitHub Pages).
2. Construye el baño con tabiques. Selecciona una vista superior y activa **Ver interior** si es necesario.
3. En **Cubicación geométrica preliminar → Asignar piso de baño y superficie restante**, elige la partida P05 (sanitario) o P06 (porcelanato), u otra partida compatible del catálogo.
4. Pulsa **Aplicar piso al recinto (clic 3D)** y haz clic **dentro del recinto rectangular**. El programa detecta paredes interiores y tabiques, coloca el material en el piso y recalcula superficies. Una puerta interior no une superficies para este fin: se entiende como límite de recinto.
5. Si el espacio aún está abierto o tiene geometría irregular, utiliza **Ubicar zona de estas medidas (clic 3D)**: define largo (X) y ancho (Z), luego haz clic en el **centro del área**. La zona no puede atravesar tabiques ni perfiles.
6. **Reservar solo m²** mantiene el comportamiento de V4.7: almacena la superficie sin una ubicación visual. **Quitar piso baño** retira la asignación y la malla 3D.
7. **Esc** cancela la selección sobre el visor.

## Modelo de datos

- Antes: `bathFloor: {code, length, width}` (solo superficie cuantitativa; compatible).
- Ahora: `bathFloor: {code, length, width, cx, cz}` al posicionarlo. X corresponde al largo, Z al ancho. Se exporta e importa dentro del JSON v3 sin cambiar su número de esquema.
- `floorAreaM2` sigue siendo superficie **bruta** L×W por compatibilidad; `bathFloorAreaM2` se resta del piso general disponible, y `floorByCodeM2` evita doble contabilización de m² de materiales.
- El acabado de baño se dibuja como una capa superficial delgada sobre el piso general con el material elegido. Se libera al reconstruir la escena.
- La zona posicionada se valida contra la holgura interior y los tabiques. Añadir o trasladar un tabique que atraviese la zona se rechaza; si cambias la distribución de habitaciones, **vuelve a aplicar el piso al recinto** para actualizar su geometría.

## Alcance y límites

- El algoritmo reconoce solo **recintos rectangulares conectados** definidos por tabiques ortogonales y los paramentos del contenedor. Rechaza formas abiertas, en L u otras geometrías irregulares para evitar revestir superficies equivocadas. Se puede elegir una zona rectangular manualmente como alternativa.
- No infiere automáticamente qué habitación es un baño, ni asigna superficies sanitarias por intuición. Es el usuario quien elige el recinto y el material.
- Los paneles y acabados visuales **no representan** cálculo de pendientes, impermeabilización certificada, espesor completo de mortero, accesibilidad, secuencia constructiva, compras o normas chilenas de seguridad y construcción.
- Los conteos son **cubicación preliminar**. El área general sigue bruta por diseño heredado; no equivale al área neta instalable después de descontar tabiques y perfiles. Requiere afinamiento previo a una lista de materiales y presupuesto de terreno.

## Pruebas

```sh
cd rebuild
npm install
npm run test:geometry
npm run test:catalog
npm run test:e2e
```

Las pruebas de navegador requieren Three.js, Chromium y Playwright. No se debe afirmar que pasaron si no se ejecutaron exitosamente.
