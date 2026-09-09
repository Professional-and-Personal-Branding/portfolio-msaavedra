# Verificación — add-production-hardening (Fase 6)

Fecha: 2026-09-09 · Verifier: Claude (Opus 5) · Ciclos de reparación: 2 (por dos fallos reales, detallados abajo).

## Automatizado

| Check | Resultado |
|---|---|
| `backend`: `lint` / `typecheck` / `build` | 0 problemas |
| `backend`: `npm test` | 50 suites, **254 tests** (eran 182 al abrir la fase) |
| `backend`: `npm run test:e2e` | 7 suites, **109 tests** (eran 91) |
| `frontend`: `typecheck` / `lint` / `prettier --check` | 0 problemas |
| `frontend`: `npm run test` | 22 archivos, **128 tests** (eran 118) |
| `frontend`: `npm run build` | OK; bundle inicial 206.0 KB gzip (era 205.6: +0.4 KB por los metadatos) |

Cobertura por spec:
- `api-platform`: `all-exceptions.filter.spec` (dominio conserva status y mensaje; error cualquiera → 500 genérico; **error de Prisma sin `prisma`, SQL ni nombres de columna**; 5xx previsto tampoco explica; stack al log y nunca a la respuesta; no responde si las cabeceras ya salieron), `env.validation.spec` (secreto de ejemplo, secreto corto, salt repetida y `FRONTEND_URL` sin https rechazados **sin imprimir el valor**; desarrollo intacto), `shouldPublishDocs`.
- `api-health`: `health.service.spec` (base arriba y caída; nunca devuelve la cadena de conexión ni el mensaje del driver; el detalle va al log; una base que no responde vence por timeout sin colgar la sonda).
- `api-rate-limiting`: `login-rate-limit.guard.spec` (dentro del límite, 429 con `Retry-After`, mensaje que no revela si el email existe, cuenta por IP, la ventana se renueva, petición sin IP no rompe).
- `api-security-headers`: `security.middleware.spec` (redirección 301 con `X-Forwarded-Proto: http`, https pasa, varios saltos, sin cabecera se asume TLS resuelto, desarrollo nunca redirige), `session-cookie.spec` (SameSite configurable; `none` fuerza `Secure`).
- `api-observability`: `request-id.spec` (id propio, id del cliente, formatos sospechosos descartados), `logger.options.spec` y **`logger-redaction.spec`, que arma un logger pino real** y comprueba que de la petición solo salen id, método y URL, que el `?token=` se redacta, que las contraseñas y tokens sueltos salen como `[Redacted]` y que de la respuesta solo sale el status.
- `public-seo`: `sitemap.builder.spec` (home, exclusión de `PRIVATE`/`PROTECTED`, `all` como home, escapes), `document-meta.spec` (título, descripción, canonical, OpenGraph, Twitter, JSON-LD, cambio de idioma sin duplicar etiquetas, `noindex` en no públicos, restauración limpia solo lo propio).
- **Bloqueantes ya cubiertos, ahora blindados**: `test/security.spec.ts` recorre los controllers y falla si alguno recibe `@Body()` sin `adminValidationPipe`; comprueba que el pipe use `whitelist` + `forbidNonWhitelisted`, que `.env` esté ignorado y que no haya secretos embebidos en `src/`.
- E2E `hardening.e2e-spec.ts` (18 tests) con una app montada como `main.ts`, incluida una **en modo producción** para HSTS y la redirección HTTPS.

## Contra la API real

Salidas completas en `verification/api-checks.txt`. Resumen:

| Bloqueante del checklist | Evidencia | Resultado |
|---|---|---|
| Secretos fuertes | `git log -S` sin secretos en el historial; `.env` ignorado; producción rechaza arrancar con el secreto de ejemplo, uno corto, salt repetida o `FRONTEND_URL` sin https | ✅ |
| Migraciones | `npm run prisma:deploy` (`prisma migrate deploy`) documentado en el runbook; `db push` explícitamente prohibido | ✅ |
| CORS estricto | `Origin: http://malicioso.com` → **0** cabeceras `Access-Control-Allow-Origin`; el origen del frontend sí la recibe | ✅ |
| Validación de inputs | Los 4 controllers con cuerpo usan `adminValidationPipe`; un test estático lo exige para los futuros | ✅ |
| Manejo global de errores | `/api/curated-profiles/no-existe` → `{statusCode, message, error, requestId, timestamp}`; ninguna respuesta de error contiene `stack`, `prisma` ni rutas | ✅ |
| Healthcheck | `GET /health` → `{"status":"ok","uptime":5,"checks":{"database":{"status":"up","responseTime":1}}}`; `/health/live` → 200; `/api/health` → 404 (vive fuera del prefijo) | ✅ |

| Importante | Evidencia | Resultado |
|---|---|---|
| Rate limiting | 6 intentos de login: `400 400 400 400 400 429`; el 429 trae `Retry-After: 60` y un mensaje que no distingue email de contraseña | ✅ |
| Security headers | `x-content-type-options: nosniff`, `referrer-policy: no-referrer`, `x-frame-options: DENY`, sin `x-powered-by`; en modo producción `strict-transport-security: max-age=31536000; includeSubDomains` y 301 a https | ✅ |
| Logging estructurado | Arranque real con `NODE_ENV=production`: líneas JSON con `level`, `time`, `req.id`, `res.statusCode`; la URL de un perfil protegido se registra como `?token=[Redacted]`; el healthcheck no genera ruido | ✅ |
| Tests mínimos | Ya superados antes de la fase: `ResolveCuratedProfile` (64 unitarios), `resolve-locale.spec` (fallback de i18n) y 7 suites e2e | ✅ |
| SEO + OpenGraph | En el navegador, `/tech-lead-dotnet`: título, descripción, `og:url`, `og:locale`, canonical y JSON-LD `Person` del perfil; con `?lang=en` pasa a `en_US` **sin duplicar etiquetas**; `/admin` queda `noindex, nofollow`; `robots.txt` bloquea `/admin` y `sitemap.xml` lista la home y los perfiles públicos | ✅ |
| Backup de DB | Sin código que escribir: procedimiento y **prueba de restauración** en `docs/DEPLOY.md` § 7. Pendiente de ejecutar en el proveedor | ⏳ infraestructura |

| Diferido conscientemente | Motivo |
|---|---|
| Token CSRF | La cookie es `SameSite` estricto y los endpoints solo aceptan JSON: un formulario cross-site no puede provocar una escritura. Documentado en `design.md` D9 |
| Vista previa por perfil en scrapers sin JavaScript | Exige SSR o prerender por bot, es decir cambiar la arquitectura del frontend. Propuesto para 1.1 (`design.md` D6) |
| Deseables del checklist | Export PDF, auditoría de accesibilidad, caché, CI/CD y `featuredRepositories`: fuera del alcance de la fase |

El despliegue en sí **no se ejecutó**: requiere cuentas y credenciales de Manuel. `docs/DEPLOY.md` es el runbook para hacerlo.

## Fallos encontrados y corregidos

1. **El identificador de petición del log no coincidía con el de la respuesta.** `pino-http` genera su propio id cuando `req.id` todavía no existe, y el middleware corría *después* del logger porque estaba registrado como middleware de módulo. El cliente recibía un id y el log guardaba otro, así que era imposible cruzar un incidente con su traza. Se pasó a un middleware de Express registrado con `app.use()` antes que todo lo demás. Regresión: `test/security.spec.ts` verifica el orden de registro y que el logger reutilice el id.
2. **El serializador del logger rompía con objetos de petición incompletos.** Asumía que `url` siempre existe; pino aplica el serializador a cualquier objeto bajo la clave `req`, así que un log con forma distinta lanzaba una excepción dentro del logger. Ahora es defensivo. Descubierto al escribir la prueba de redacción con un logger real.
3. **`test/app.e2e-spec.ts` montaba su propia aplicación** en vez de usar el helper compartido, así que no ejercitaba la configuración real de `main.ts` y se quedó sin el identificador de petición. Se lo pasó a `createTestApp`.
4. Ajuste de expectativa, no de código: la redacción resultó **más fuerte** de lo previsto. El serializador descarta cabeceras y cuerpo por completo en lugar de censurarlos campo a campo; las pruebas se reescribieron para afirmar esa garantía real.

## Deuda anotada

- El límite de peticiones se cuenta en memoria: con más de una instancia, cada una lleva el suyo. Migrar a un almacén compartido si se escala horizontalmente (anotado en `docs/DEPLOY.md` § 8).
- El e2e `curated-profile.e2e-spec` de la Fase 2 sigue sin revertir el `themeOverrides` que escribe (detectado en la Fase 4; fuera del alcance de esta fase).
