# INGEBAM Ventanas 3D — Prototipo V1

Prototipo independiente de configurador y cotizador preliminar de ventanas.

## Ejecución

Abre `index.html` en un navegador moderno. No requiere compilación, servidor, bibliotecas externas, claves ni Supabase.

## Funciones

- Vista 3D interactiva Canvas con rotación, zoom y simulación visual de apertura.
- Tipologías: corredera (dos hojas), fija, abatible y proyectante.
- Medidas en mm (400–2800 mm ancho, 400–2400 mm alto); PVC/aluminio; color; vidrio simple/DVH; cantidad.
- Cotización de demostración basada en área y multiplicadores configurados en código.
- Resumen geométrico: área y perímetro. No genera despiece industrial.
- Copia de presupuesto, impresión/PDF, exportación JSON.
- Sin dependencias ni conexión de datos; no altera otros proyectos.

## Limitaciones

**Todos los precios son ficticios.** No usar para ventas, fabricación ni decisiones estructurales. La definición de hojas, ángulos de apertura y perfiles es ilustrativa y no valida compatibilidades reales. Para producción se necesita catálogo y ficha técnica del fabricante, descuentos de corte, sistemas de herrajes, uniones, holguras, refuerzos, vidrio, montaje y pruebas.

## Próximas versiones

1. Motor BOM/APU separado del render 3D.
2. Catálogo parametrizable por fabricante con validaciones de medidas y sistemas de apertura.
3. Cotización PDF comercial con control de versiones y gestión de clientes.
4. Órdenes de producción y optimización de cortes, tras homologación técnica.
