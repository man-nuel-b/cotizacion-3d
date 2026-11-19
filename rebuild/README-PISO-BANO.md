# BAT-CUBIKEITOR V4.7 — Asignación de piso de baño

Desde **Cubicación geométrica preliminar → Asignar piso de baño**, elige una partida P01–P07/P47, largo y ancho. El sistema reserva su superficie respecto del piso general, calcula el remanente y suma el piso por código sin duplicar m².

La API expone `setBathFloor({code,length,width})`, `clearBathFloor()` y `getConstructionTakeoff()` con `bathFloor`, `bathFloorAreaM2`, `remainingFloorAreaM2` y `floorByCodeM2`.

Se valida la zona interior útil (considerando perfiles), el catálogo, la actualización de dimensiones y la importación de JSON previos. La exportación sigue con esquema JSON v3 compatible; `bathFloor` es opcional.

**Alcance**: no crea ni ubica geométricamente una habitación ni cambia el renderizado del piso; solo asigna m². Para dibujar recintos y verificar geometría de pisos reales se requieren coordenadas de ubicación y el contorno del baño. Los m² son preliminares y no incluyen desperdicios, APU ni precios.

Ejecuta desde `rebuild/`: `npm run test:geometry`, `npm run test:catalog`, y con Chromium instalado `npm run test:e2e`.
