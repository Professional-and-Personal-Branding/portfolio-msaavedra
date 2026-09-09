# Tasks — add-production-hardening

> Referencias: `proposal.md`, `specs/*/spec.md`, `design.md` (D1–D10). Criterios de negocio: `docs/SPECS-POR-FASE.md` § Fase 6 y `docs/RELEASE-1.0.0-CHECKLIST.md`.

## 1. Bloqueante — manejo global de errores (D1)

- [x] 1.1 `AllExceptionsFilter` con `APP_FILTER`: cuerpo uniforme (`statusCode`, `message`, `error`, `requestId`, `timestamp`), 500 genérico para lo no previsto, detalle completo al log. Verificar: unitarios (HttpException conserva status y mensaje; un `Error` cualquiera da 500 sin `stack`; un error de Prisma no filtra `prisma` ni SQL) y e2e sobre un endpoint que falla a propósito.

## 2. Bloqueante — healthcheck (D2)

- [x] 2.1 `HealthService` (`SELECT 1` con timeout de 2 s) + `HealthController` con `GET /health` y `GET /health/live`, fuera del prefijo `/api` y sin autenticación. Verificar: e2e 200 con la base arriba; con la base simulada caída, 503 y `checks.database.status: "down"`; `/health/live` responde 200 igual; ningún cuerpo contiene `postgresql://` ni rutas.

## 3. Bloqueantes — arranque seguro, migraciones y verificación de lo ya hecho (D7)

- [x] 3.1 Reglas de producción en `env.validation.ts` (secreto de ejemplo, mínimo 32, distinto de `ANALYTICS_SALT`, `FRONTEND_URL` con `https`) + `ENABLE_API_DOCS` y gating de Swagger. Verificar: unitarios por cada regla (mensaje nombra la variable y no muestra su valor); desarrollo sigue arrancando; e2e de `/api/docs-json` 404 en producción y 200 con la bandera.
- [x] 3.2 Script `prisma:deploy` y `.env.example` actualizado (secretos, `LOG_LEVEL`, `THROTTLE_*`, `SESSION_COOKIE_SAMESITE`, `ENABLE_API_DOCS`). Verificar: `npm run prisma:deploy` aplica migraciones sobre una base limpia sin `db push`.
- [x] 3.3 Tests que blindan los bloqueantes ya cubiertos: CORS rechaza un origen ajeno (sin `Access-Control-Allow-Origin`), y **todos** los controllers con `@Body()` aplican `adminValidationPipe` (test de arquitectura que recorre los controllers). Verificar: ambos en verde; el de arquitectura falla si se agrega un controller con cuerpo sin el pipe.

## 4. Importante — rate limiting (D3)

- [x] 4.1 `ThrottlerModule` configurable + guard global, `@Throttle` estricto en el login, `@SkipThrottle` en health, `trust proxy`. Verificar: e2e con límites bajos por configuración (429 con `Retry-After` al exceder; 6 logins fallidos → 429; el health nunca se limita; un login correcto tras dos fallos responde 200).

## 5. Importante — cabeceras y HTTPS (D4)

- [x] 5.1 Helmet ajustado a API JSON, HSTS solo en producción, middleware de redirección por `X-Forwarded-Proto`, `SESSION_COOKIE_SAMESITE`. Verificar: e2e de cabeceras (`nosniff`, `no-referrer`, sin `x-powered-by`); con `NODE_ENV=production`, `X-Forwarded-Proto: http` → 301 a `https` y presencia de HSTS; la cookie sale con `Secure` y el `SameSite` configurado.

## 6. Importante — observabilidad (D5)

- [x] 6.1 `nestjs-pino` como logger, `genReqId` con `X-Request-Id`, `LOG_LEVEL`, `pino-pretty` en desarrollo. Verificar: e2e devuelve `X-Request-Id` (propio y el del cliente) y el `requestId` del cuerpo de error coincide con el de la cabecera.
- [x] 6.2 Redacción (`authorization`, `cookie`, `set-cookie`, `x-access-token`, `token` de la query, `password`, `accessToken`). Verificar: test que captura la salida del logger durante un login y una petición con `?token=`, y comprueba que ni la contraseña ni el token aparecen.

## 7. Importante — SEO (D6)

- [x] 7.1 Backend: `SitemapController` con `GET /robots.txt` y `GET /sitemap.xml` (solo perfiles `PUBLIC`, URLs absolutas desde `FRONTEND_URL`). Verificar: unitarios del generador (incluye la home, excluye `PRIVATE`/`PROTECTED`, escapa las URLs) y e2e (200, `application/xml`, contiene `/tech-lead-dotnet`, `robots.txt` con `Disallow: /admin`).
- [x] 7.2 Frontend: `document-meta.ts` (título, descripción, canonical, OpenGraph, Twitter, JSON-LD `Person`, `noindex` en perfiles no públicos y en `/admin`) aplicado en la vista curada; `index.html` con metadatos base. Verificar: specs de Vitest sobre el DOM (perfil, cambio de idioma, restauración al desmontar, `noindex`) y comprobación en navegador.

## 8. Preparación del despliegue (D8)

- [x] 8.1 `docs/DEPLOY.md`: variables de entorno por entorno, generación de secretos, orden de arranque (`prisma migrate deploy` → `start:prod`), healthcheck para el orquestador, CORS/cookies según los dominios elegidos, backups y **prueba de restauración**. Verificar: alguien puede seguirlo sin conocer el proyecto.
- [x] 8.2 `docs/RELEASE-1.0.0-CHECKLIST.md` con el estado real de los 18 ítems: hecho en código (con dónde), pendiente de infraestructura (con el paso del runbook) o diferido con justificación. Verificar: ningún ítem queda sin estado.

## 9. Verificación (Verifier)

- [x] 9.1 `backend`: `lint`, `typecheck`, `test`, `test:e2e`, `build`. `frontend`: `typecheck`, `lint`, `test`, `build` (sin crecer más de 5 KB gzip el bundle inicial). Verificar: todo en verde con los tamaños reportados.
- [x] 9.2 Criterios de la Fase 6 contra la API real: los 6 bloqueantes demostrados uno por uno, `GET /health` con y sin base, 429 en el login, cabeceras, un error 500 sin fugas, `sitemap.xml`/`robots.txt`, y metadatos por perfil en el navegador. Capturas y salidas en `openspec/changes/add-production-hardening/verification/`, registro en `verification.md`. Máx. 3 ciclos de reparación.

## 10. Documentación (Reviewer)

- [x] 10.1 `backend/README.md` (health, límites, cabeceras, logs, variables nuevas), `frontend/README.md` (SEO y su limitación), `STEPS.md` (Paso 8). Verificar: los comandos citados existen y funcionan.
- [x] 10.2 Sincronizar: checkbox Fase 6 en `CLAUDE.md`/`README.md`, `docs/ARCHITECTURE.md` (§7 y decisiones), `docs/CHANGELOG.md`. Verificar: `openspec validate --strict` OK antes de `openspec archive`.
