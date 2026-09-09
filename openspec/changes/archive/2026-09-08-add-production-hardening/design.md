# Design — add-production-hardening

## Context

Ver `proposal.md`, `docs/SPECS-POR-FASE.md` § Fase 6 y `docs/RELEASE-1.0.0-CHECKLIST.md`. Estado real al abrir la fase, comprobado sobre el código:

| Ítem del checklist | Estado hoy |
|---|---|
| 🔴 Secretos fuertes | `.env` ignorado y **sin secretos en el historial de git** (verificado con `git log -S`). Falta que producción rechace un secreto débil |
| 🔴 Migraciones | La migración `20260906055928_init` está versionada. Falta el script `migrate deploy` y su lugar en el runbook |
| 🔴 CORS estricto | Hecho (Fase 1, `credentials` en Fase 5). Falta una prueba explícita de que un origen ajeno no recibe `Access-Control-Allow-Origin` |
| 🔴 Validación de inputs | Los 4 controllers que reciben cuerpo usan `adminValidationPipe` (whitelist + forbidNonWhitelisted). Falta un test que lo garantice para los futuros |
| 🔴 Manejo global de errores | **No existe**: un error no controlado sale como el 500 por defecto de Nest |
| 🔴 Healthcheck | **No existe** |
| 🟡 Rate limiting | **No existe** |
| 🟡 Security headers | **No existe** Helmet ni redirección HTTPS; las cookies ya son `httpOnly`/`sameSite`/`secure` condicional (Fase 5) |
| 🟡 Logging estructurado | Logger por defecto de Nest, sin request id ni redacción |
| 🟡 Tests mínimos | **Ya superado**: `ResolveCuratedProfile` con 64 tests unitarios, `resolve-locale.spec` cubre el fallback de i18n y hay 6 suites e2e (91 tests) |
| 🟡 SEO + OpenGraph | **No existe**: `index.html` tiene un `title` genérico y ninguna etiqueta OpenGraph |
| 🟡 Backup de DB | Depende del proveedor; no hay código que escribir |

Versiones a incorporar (compatibles con Nest 11): `helmet` 8.3, `@nestjs/throttler` 6.5, `nestjs-pino` 5.1 + `pino` 10 + `pino-http` 11, `pino-pretty` (solo desarrollo).

## Goals / Non-Goals

**Goals:** cerrar los seis bloqueantes con evidencia, cerrar los importantes que son código, y dejar un runbook que Manuel pueda seguir para desplegar.
**Non-Goals:** los de `proposal.md`. En particular **no se ejecuta el despliegue** ni se contratan servicios.

## Decisions

### D1 — Un solo filtro de excepciones, con el mapeo de dominio intacto
`AllExceptionsFilter` (registrado con `APP_FILTER`) atiende **todo**: `HttpException` conserva su status y su cuerpo de negocio; cualquier otra cosa se convierte en 500 con un mensaje fijo. Siempre agrega `requestId` y `timestamp`. El error original se registra con `logger.error` incluyendo el stack, que nunca sale por HTTP. `toHttpException` (que traduce errores de dominio) se mantiene tal cual: sigue siendo la primera línea, y el filtro es la red de seguridad.
*Por qué*: la fuga típica no está en los errores previstos sino en los que nadie previó, y hoy esos devuelven el stack de Nest.

### D2 — Healthcheck propio, sin `@nestjs/terminus`
`HealthController` + `HealthService`: `SELECT 1` sobre `PrismaService` con `Promise.race` contra un tiempo máximo de 2 s. `/health` responde 200 u **503**; `/health/live` no toca la base. Van fuera del prefijo `/api` (el orquestador espera `/health`) y quedan exentos del rate limiting.
*Por qué*: son ~40 líneas y evitan una dependencia que aquí solo aportaría un envoltorio; el proyecto ya rechazó dependencias equivalentes en las Fases 4 y 5 (gráficos, drag & drop).
*Alternativa*: `@nestjs/terminus`, estándar y con más indicadores, útil si en el futuro hay que vigilar servicios externos.

### D3 — Rate limiting: global suave, login estricto
`ThrottlerModule.forRootAsync` leyendo `THROTTLE_TTL`/`THROTTLE_LIMIT` (120/min por defecto) con `ThrottlerGuard` global; `POST /api/auth/login` lleva `@Throttle` propio (5/min). El healthcheck se marca con `@SkipThrottle`. Detrás de un proxy hay que confiar en `X-Forwarded-For` (`trust proxy`) para no contar todo el tráfico como una sola IP.
*Riesgo asumido*: el almacenamiento es en memoria, así que el límite es por instancia. Con una sola instancia alcanza; escalar horizontalmente pediría Redis, y queda anotado.

### D4 — Helmet ajustado a una API JSON, HTTPS por cabecera del proxy
Helmet con `contentSecurityPolicy: false` (esta app no sirve HTML; la CSP del frontend es responsabilidad de Vercel), `crossOriginResourcePolicy: 'cross-origin'` (el frontend vive en otro origen), `referrerPolicy: 'no-referrer'` y HSTS solo en producción. La redirección a HTTPS es un middleware que mira `X-Forwarded-Proto`, con `app.set('trust proxy', 1)`.
*Por qué `no-referrer`*: los perfiles `PROTECTED` viajan con el token en la URL (decisión heredada de la Fase 2); sin esa política, el token se filtraría en el `Referer` de cualquier recurso externo.

### D5 — Logging con `nestjs-pino`
Pino como logger de Nest (`app.useLogger`), `pino-http` para el log de peticiones, `pino-pretty` solo en desarrollo. La **redacción** se configura con `redact` (cabeceras `authorization`, `cookie`, `set-cookie`, `x-access-token`; campos `password`, `accessToken`) y un `serializer` de `req` que reescribe `?token=` como `token=[Redacted]`. El `requestId` sale de `genReqId` (usa `X-Request-Id` si viene, si no `randomUUID`) y se devuelve en la respuesta.
*Por qué una dependencia y no un logger propio*: la redacción es código de seguridad; equivocarse ahí significa escribir contraseñas en el log. Pino la trae probada y es el estándar del ecosistema Nest.

### D6 — SEO: metadatos en el cliente, sitemap en el backend
El frontend actualiza `title`, `description`, `canonical`, OpenGraph, Twitter Card y un bloque JSON-LD `Person` cuando resuelve el perfil (`shared/lib/document-meta.ts`, ~60 líneas, sin dependencias). El backend sirve `/robots.txt` y `/sitemap.xml` porque es quien conoce los perfiles `PUBLIC` y sus fechas.
**Limitación conocida y aceptada**: los scrapers que no ejecutan JavaScript (LinkedIn, WhatsApp, Slack) verán las meta genéricas de `index.html`, no las del perfil. Buscar la vista previa por perfil exigiría SSR o prerender por bot, es decir cambiar la arquitectura del frontend o atarse a la infraestructura de Vercel; ninguna de las dos entra en un hardening. Se documenta y se propone para 1.1.
*Alternativa evaluada*: función serverless que sirva HTML con meta para user-agents de bots. Frágil (listas de user-agents), específica del proveedor y difícil de testear.

### D7 — Reglas que solo aplican en producción
`env.validation.ts` gana una validación posterior a `class-validator`: si `NODE_ENV=production`, rechaza `JWT_SECRET` igual al de `.env.example`, más corto de 32, o igual a `ANALYTICS_SALT`, y `FRONTEND_URL` sin `https`. Los mensajes nombran la variable y **nunca** imprimen su valor. Swagger se publica salvo en producción, donde hace falta `ENABLE_API_DOCS=true`.
*Por qué en el código y no solo en el runbook*: un checklist se olvida; un arranque que falla, no.

### D8 — Lo que no se automatiza
El despliegue (cuentas, Postgres gestionado, dominios, variables en el proveedor) y los backups son acciones de Manuel: requieren credenciales, tienen costo y son irreversibles. Este change entrega `docs/DEPLOY.md` con el runbook paso a paso —incluida la comprobación de que un backup **se puede restaurar**, que es la única parte del ítem que se puede verificar— y deja `docs/RELEASE-1.0.0-CHECKLIST.md` con el estado real de cada ítem, distinguiendo "hecho en código" de "pendiente de infraestructura".

### D9 — CSRF diferido, con el razonamiento escrito
La cookie de sesión es `SameSite` estricto y los endpoints de escritura solo aceptan `application/json`: un formulario cross-site no puede enviar ese `Content-Type` sin un preflight que CORS rechaza, y con `SameSite` la cookie ni siquiera viaja. El riesgo residual (un subdominio comprometido con `SameSite=Lax`) no justifica el doble token en 1.0.0. Se documenta como diferido consciente, que es lo que el criterio de la fase permite.

### D10 — Cómo se prueba lo que solo pasa en producción
- **Unitarios**: `validateEnv` con `NODE_ENV=production` y cada secreto malo; `AllExceptionsFilter` con un error cualquiera; el mapa de redacción del logger; el generador del sitemap a partir de una lista de perfiles.
- **E2E**: una app de pruebas dedicada (`createHardenedTestApp`) que registra filtro, helmet, throttler y logger igual que `main.ts`, para comprobar cabeceras, 429, 503 del health y el cuerpo de error sin fugas. La app e2e existente no cambia, así que las 91 pruebas actuales siguen valiendo como red.
- **Producción simulada**: los escenarios de HSTS y redirección se prueban levantando la app de test con `NODE_ENV=production` y `X-Forwarded-Proto`, sin desplegar nada.
- **Navegador**: metadatos por perfil e idioma, `robots.txt` y `sitemap.xml` con la API real.

## Risks / Trade-offs

- [Rate limiting en memoria] → correcto con una instancia; con varias, cada una cuenta por separado. Anotado para cuando haga falta escalar (Redis).
- [Helmet sin CSP] → esta API no sirve HTML; la CSP del sitio la pone el hosting del frontend. Si algún día el backend sirviera páginas, hay que revisarlo.
- [Pino agrega tres dependencias] → a cambio de redacción probada; el bundle del backend no viaja al navegador.
- [Meta tags solo en cliente] → ver D6; es el compromiso explícito de esta fase.
- [Tocar `main.ts` y la validación de entorno] → son el camino de arranque; los cubren los e2e existentes más los nuevos, y un fallo se ve de inmediato al levantar la API.

## Migration Plan

Sin migración de datos. En producción el arranque pasa a ser `prisma migrate deploy` → `node dist/main`. Un `.env` que hoy funciona en desarrollo sigue funcionando; en producción, un secreto débil ahora impide arrancar (efecto buscado, documentado en `DEPLOY.md`).

## Open Questions

- ¿El despliegue va a Railway o a Render? El runbook cubre ambos, y la diferencia solo afecta a `docs/DEPLOY.md`, no al código.
