# Supabase foundation — bat-kubiqueitor

Esta carpeta contiene la base de datos propuesta para reemplazar progresivamente `localStorage` sin romper el configurador actual.

## Objetivo

Separar tres capas:

1. **Estado 3D del proyecto** → `projects.project_state` (`jsonb`).
2. **Datos comerciales estructurados** → clientes, cotizaciones y detalle.
3. **Costos/APU/precios** → materiales, proveedores, precios y recursos APU.

## Tablas principales

- `organizations`: empresa/tenant.
- `profiles`: datos del usuario autenticado.
- `organization_members`: usuarios, roles y acceso a la empresa.
- `customers`: clientes.
- `projects`: proyecto/configuración 3D completa.
- `project_items`: elementos del diseño que conviene consultar individualmente.
- `materials`: maestro de materiales.
- `suppliers`: proveedores (Sodimac, Construmart, locales, etc.).
- `supplier_prices`: precio capturado por proveedor y fecha.
- `apu_resources`: recursos de análisis de precio unitario.
- `quotes`: cotizaciones emitidas con snapshot inmutable.
- `quote_items`: detalle de cada cotización.
- `price_history`: histórico de precios.
- `audit_log`: trazabilidad futura.

## Seguridad

El esquema activa Row Level Security (RLS). Cada registro comercial pertenece a una organización y los usuarios solo pueden acceder a organizaciones de las que sean miembros.

Roles previstos:

- `owner`
- `admin`
- `seller`
- `viewer`

## Orden de integración recomendado

### Etapa 1
Guardar/abrir `projects.project_state` en Supabase manteniendo `localStorage` como fallback.

### Etapa 2
Migrar clientes y listado de proyectos.

### Etapa 3
Migrar materiales, APU y precios.

### Etapa 4
Guardar cotizaciones como snapshots inmutables.

### Etapa 5
Autenticación multiusuario y permisos por vendedor/administrador.

## Importante

No colocar `service_role` ni secretos de Supabase en archivos públicos del repositorio o GitHub Pages. El navegador solo debe utilizar la URL pública del proyecto y la `anon/publishable key`, protegida por RLS. Operaciones administrativas o actualización automatizada de proveedores deben ejecutarse desde un backend/Edge Function.
