# add-production-hardening — Fase 6: Hardening para el release 1.0.0

> Materializa la **Fase 6** de `docs/SPECS-POR-FASE.md` y trabaja `docs/RELEASE-1.0.0-CHECKLIST.md` como lista explícita (objetivo, alcance y criterios viven allí). Depende de las Fases 1-5, ya archivadas.

## Why

El producto está completo de punta a punta, pero **hoy no es desplegable con responsabilidad**: un error inesperado devuelve el stack trace de NestJS al cliente, no hay endpoint que el orquestador consulte para saber si la API vive, cualquiera puede martillar el login sin límite, faltan las cabeceras de seguridad básicas, los logs no permiten seguir una petición ni protegen los tokens, y un link compartido a una empresa se previsualiza como "Portafolio" sin más. Esta fase cierra esos huecos y deja preparado —no ejecutado— el despliegue.

## What Changes

- **Manejo global de errores** (bloqueante): filtro de excepciones que unifica toda respuesta de error en el mismo cuerpo (`statusCode`, `message`, `error`, `requestId`, `timestamp`), registra el detalle en el log y MUST NOT filtrar stack traces, rutas de archivos, SQL ni mensajes de Prisma. Los errores de dominio siguen mapeándose como hasta ahora.
- **Healthcheck** (bloqueante): `GET /health` (fuera del prefijo `/api`, sin autenticación) responde 200 con el estado de la base y `503` si no hay conexión; `GET /health/live` responde sin tocar la base. Sin dependencia nueva: consulta `SELECT 1` con un tiempo máximo.
- **Secretos y arranque seguro** (bloqueante): la validación de entorno rechaza arrancar en `production` con `JWT_SECRET` de ejemplo, corto o repetido en `ANALYTICS_SALT`, y exige `FRONTEND_URL` con `https`. Se documenta cómo generarlos y se verifica que el historial de git no contiene secretos.
- **Migraciones** (bloqueante): script `prisma:deploy` (`prisma migrate deploy`) y su lugar en el arranque de producción; queda prohibido `db push`.
- **CORS y validación** (bloqueantes ya cubiertos): se verifican con tests explícitos en lugar de darlos por hechos, incluida la cobertura de `adminValidationPipe` en **todos** los endpoints que reciben cuerpo.
- **Rate limiting** (importante): `@nestjs/throttler` global y un límite mucho más estricto en `POST /api/auth/login`; el exceso responde 429 con `Retry-After`.
- **Cabeceras de seguridad** (importante): Helmet con una política ajustada a una API JSON, `Referrer-Policy` estricto (los perfiles protegidos viajan con `?token=` en la URL), redirección a HTTPS en producción, y Swagger deshabilitado en producción salvo que se habilite explícitamente.
- **Logging estructurado** (importante): logs JSON con nivel, `requestId` por petición (propagado al cuerpo de error y a la cabecera `X-Request-Id`) y **redacción** de `authorization`, `cookie`, `set-cookie`, `x-access-token`, `?token=` y contraseñas. En desarrollo, salida legible.
- **SEO y OpenGraph** (importante): título, descripción, canonical, OpenGraph, Twitter Card y JSON-LD por perfil curado, escritos en el cliente al resolver el perfil; `robots.txt` y `sitemap.xml` generados por el backend a partir de los perfiles públicos.
- **Preparación del despliegue**: `docs/DEPLOY.md` con el runbook (variables, orden de arranque, healthcheck, backups y su restauración) y `docs/RELEASE-1.0.0-CHECKLIST.md` actualizado con el estado real de cada ítem. **El despliegue en sí lo ejecuta Manuel**, no este change.
- **Verificación**: tests unitarios y e2e para cada ítem nuevo (filtro, health, throttler, cabeceras, redacción del logger, sitemap), y comprobación en navegador de las meta tags por perfil.

### Non-goals

- **Ejecutar el despliegue**: crear cuentas, aprovisionar Postgres, configurar dominios o publicar. Requiere credenciales y decisiones de costo que son de Manuel; este change entrega el runbook y la app lista.
- **SSR o prerender**: las meta tags se escriben en el cliente. Google las ve; los scrapers que no ejecutan JavaScript (LinkedIn, WhatsApp, Slack) mostrarán las meta genéricas del `index.html`. Se documenta como limitación conocida y se propone para 1.1 (decisión D6).
- **Token CSRF explícito**: con `SameSite` estricto y endpoints que solo aceptan JSON, el riesgo queda mitigado; se documenta el razonamiento y se difiere conscientemente (lo permite el criterio de la fase).
- **Deseables del checklist**: export PDF, auditoría de accesibilidad, caché y Lighthouse, CI/CD y la curaduría de `featuredRepositories`. El dashboard de analítica ya se entregó en la Fase 5.
- Cambios de esquema Prisma, de `docs/cv-data.json` o del comportamiento funcional de la API y del panel.

## Capabilities

### New Capabilities
- `api-health`: estado de vida y de dependencias para el orquestador.
- `api-rate-limiting`: límites de peticiones globales y reforzados en el login.
- `api-security-headers`: Helmet, HTTPS, política de referrer y exposición de Swagger.
- `api-observability`: logs estructurados, identificador de petición y redacción de datos sensibles.
- `public-seo`: metadatos por perfil curado, `robots.txt` y `sitemap.xml`.

### Modified Capabilities
- `api-platform`: se agregan el manejo global de errores y las reglas de arranque seguro en producción.

## Impact

- **Nuevo (backend)**: `AllExceptionsFilter`, `HealthController` + `HealthService`, `RequestIdMiddleware`, configuración de logger, `ThrottlerModule` y guard, Helmet y redirección HTTPS en `main.ts`, `SitemapController` (`/robots.txt`, `/sitemap.xml`), script `prisma:deploy`.
- **Nuevo (frontend)**: `shared/lib/document-meta.ts` y su uso en la vista curada.
- **Modificado**: `src/config/env.validation.ts` (reglas de producción), `main.ts`, `swagger.ts` (gating), `.env.example`, `frontend/index.html` (meta base y OpenGraph por defecto).
- **Dependencias (backend)**: `helmet`, `@nestjs/throttler`, `nestjs-pino` + `pino` + `pino-http`, `pino-pretty` (solo desarrollo). Sin dependencias nuevas en el frontend.
- **Docs al archivar**: `docs/DEPLOY.md` (nuevo), `docs/RELEASE-1.0.0-CHECKLIST.md` (estado real), checkbox Fase 6 en `CLAUDE.md`/`README.md`, `docs/ARCHITECTURE.md`, `docs/CHANGELOG.md`, `backend/README.md`, `STEPS.md`.
