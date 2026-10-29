# Backend — Portafolio Administrable

API NestJS 11 + Prisma 6 (PostgreSQL) en **Clean Architecture**. **Estado: Fases 1 a 6 y la ronda 1.1 completadas** (el deploy 1.0.0 en Railway es lo único pendiente, ver `docs/DEPLOY-RAILWAY.md`). Incluye auth JWT del backoffice (argon2id, cookie `httpOnly`), CRUD de todo el contenido del portafolio (perfil base, idiomas, experiencias, skills, formación, certificaciones, proyectos, enlaces sociales y perfiles curados), ciclo de vida de los perfiles curados (duplicar, archivar, enumerar, alias de slug), analítica de visitas, el núcleo `curated-profile` (resolución por tags, overrides, tema y secciones), el fragmento de `<head>` por perfil para el borde, hardening de producción, migraciones versionadas, seed desde `docs/cv-data.json` e i18n ES/EN con fallback.

> Contrato de arquitectura: [`../CLAUDE.md`](../CLAUDE.md). Specs de negocio: [`../docs/SPECS-POR-FASE.md`](../docs/SPECS-POR-FASE.md). Historia por change: [`../docs/CHANGELOG.md`](../docs/CHANGELOG.md). Changes archivados: [`../openspec/changes/archive/`](../openspec/changes/archive/). Specs vigentes: [`../openspec/specs/`](../openspec/specs/).

## Requisitos

- Node.js 20+ (probado con 22) · npm 10
- Docker Desktop (Postgres 16 + Adminer vía `docker-compose.yml` en la raíz)

## Puesta en marcha

```bash
# 0. Desde la raíz del repo: levantar Postgres (5434; el 5432 suele estar tomado) y Adminer (8080)
docker compose up -d
```

```bash
# 1. Configurar el backend
cd backend
cp .env.example .env        # PORT=3300 (el proxy de Vite apunta ahí); poner un JWT_SECRET fuerte y ADMIN_*
npm install
```

```bash
# 2. Esquema y datos
npm run prisma:generate     # cliente Prisma
npm run prisma:migrate      # prisma migrate dev --name init (migración versionada; NUNCA db push)
npm run seed                # carga docs/cv-data.json solo sobre una base vacía; con contenido se niega (código 2). --overwrite fuerza la recarga (borra el contenido, incluidas las visitas)
npm run seed:verify         # compara conteos DB vs cv-data.json
npm run admin:bootstrap     # crea/actualiza el administrador desde ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_NAME
npm run views:reclassify    # reclasifica las visitas (HUMAN/OWNER/BOT) y recalcula views; simulación por defecto, -- --apply escribe
```

```bash
# 3. Arrancar
npm run start:dev           # http://localhost:$PORT/api  ·  Swagger: /api/docs  ·  OpenAPI: /api/docs-json
```

## Endpoints públicos

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/profile` | Perfil base (idiomas, disponibilidad) |
| GET | `/api/experiences` | Experiencias visibles, orden cronológico (`startDate` desc, `order` asc como desempate) |
| GET | `/api/experiences/:id` | Detalle de una experiencia visible (404 si no existe/oculta) |
| GET | `/api/curated-profiles` | Perfiles curados `PUBLIC` para el menú (título, `roleType`, `techFocus`, color) |
| GET | `/api/curated-profiles/:slug` | **Núcleo:** perfil curado resuelto (experiencias, skills y proyectos filtrados por tags + overrides; tema mergeado; secciones; perfil base; educación, certificaciones y enlaces sociales). 404 si no existe o es `PRIVATE`; 401 si es `PROTECTED` sin token |
| GET | `/api/education` · `/api/certifications` | Formación y certificaciones visibles |
| GET | `/api/projects` | Proyectos destacados visibles (con `tags`) |
| GET | `/api/social-links` | Presencia pública (GitHub, LinkedIn, YouTube…) con `stats` libre |
| GET | `/api/public/profile-head?slug=&lang=` | Fragmento de `<head>` (HTML) de un perfil: title, description, canonical, Open Graph, Twitter, robots y JSON-LD. Lo consume Caddy para el HTML inicial. Siempre 200; PROTECTED, PRIVATE o inexistente dan el genérico con `noindex`. Sin límite de peticiones ni visitas |
| GET | `/health` · `/health/live` | Healthcheck: 200 o 503 según la base · 200 mientras viva el proceso. **Fuera de `/api`**, sin autenticación ni límite |
| GET | `/robots.txt` · `/sitemap.xml` | Fuera de `/api`; el sitemap lista los perfiles `PUBLIC` enumerados, sobre `FRONTEND_URL` |
| GET | `/api/docs` · `/api/docs-json` | Swagger UI · documento OpenAPI (en producción, solo con `ENABLE_API_DOCS=true`) |

Un slug renombrado sigue resolviendo por su alias: `GET /api/curated-profiles/:slug` responde el perfil con su slug canónico en el cuerpo y en `Content-Location`. Un perfil archivado da 404.

## Backoffice (requiere sesión: cookie `portfolio_session` o `Authorization: Bearer <JWT>`)

Todo el detalle de cuerpos y respuestas está en [`openapi.json`](openapi.json) (o en Swagger).

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/auth/login` | `{ email, password }` → `{ accessToken, tokenType, expiresIn, user }` y la cookie de sesión (401 si no coincide; 5 intentos por minuto y por IP) |
| POST | `/api/auth/logout` | Borra la cookie (204) |
| GET | `/api/auth/me` | Administrador autenticado |
| GET/PUT | `/api/admin/profile` | Perfil base crudo (titular, resumen, contacto, disponibilidad) / reemplazarlo |
| POST | `/api/admin/profile/preview` | Previsualizar el perfil base sin guardarlo |
| GET/POST y GET/PATCH/DELETE por `:id` | `/api/admin/languages` | Idiomas del perfil base (el nivel es `{ es, en? }`) |
| GET/POST y GET/PATCH/DELETE por `:id` | `/api/admin/education`, `/api/admin/certifications`, `/api/admin/projects`, `/api/admin/social-links` | CRUD de formación, certificaciones, proyectos y enlaces sociales (incluye los ocultos; `visible:false` los saca del sitio sin borrarlos) |
| GET | `/api/admin/themes` | Catálogo de temas para el customizador |
| POST | `/api/admin/curated-profiles/preview` | Resolver un borrador de perfil curado sin guardarlo ni registrar visitas; `?locale=` elige el idioma y la respuesta suma `missingTranslations` |
| POST | `/api/admin/curated-profiles/:id/duplicate` | Duplica: la copia nace privada y no enumerada, con el primer slug libre |
| POST | `/api/admin/curated-profiles/:id/archive` · `/unarchive` | Archivar (404 público, conserva las visitas) / desarchivar |
| GET/POST | `/api/admin/experiences` | Listar (incluye ocultas, bilingüe crudo) / crear (201) |
| GET/PATCH/DELETE | `/api/admin/experiences/:id` | Ver / editar parcial / borrar (204) |
| GET/POST | `/api/admin/skill-categories` | Listar categorías con skills / crear |
| PATCH/DELETE | `/api/admin/skill-categories/:id` | Editar / borrar (con sus skills) |
| POST | `/api/admin/skill-categories/:id/skills` | Crear skill (`name`, `tags`, `order`) |
| PATCH/DELETE | `/api/admin/skills/:id` | Editar (incluye mover con `categoryId`) / borrar |
| GET/POST | `/api/admin/curated-profiles` | Listar (cualquier visibilidad, campos internos) / crear (409 slug repetido) |
| GET/PATCH/DELETE | `/api/admin/curated-profiles/:id` | Ver / editar (filtros, overrides, tema, secciones, visibilidad, `listed`, token, slug con alias) / borrar (y sus visitas) |
| GET | `/api/admin/analytics/views?from&to` | Visitas agregadas: total, por perfil, por idioma, por día y por origen (`byReferrer`); rango cerrado, default 30 días |

Reglas: cuerpos validados con `class-validator`; campos desconocidos → 400; `PROTECTED` exige `accessToken`; `themeId` debe existir; `slug` kebab-case y único. Los campos traducibles se envían y reciben como `{ es, en? }`.

**Visitas:** cada `GET /api/curated-profiles/:slug` con 200 registra un `ProfileView` (locale, referrer, user-agent, `ipHash` HMAC-SHA256 con `ANALYTICS_SALT`) e incrementa `views`, de forma atómica y **en segundo plano**: la respuesta no espera el registro y el apagado de la API drena las tareas en vuelo. 401/404 no registran, ni el preview ni el head. Un fallo del registro nunca rompe la respuesta.

**Idioma:** `?locale=` > `?lang=` > header `Accept-Language` > `es`. Un locale no soportado cae a `es` (200, nunca 400). El locale servido viaja en el header `Content-Language`. Las respuestas traen strings ya resueltos, nunca objetos `{es,en}`.

**Perfiles `PROTECTED`:** el token viaja en el header `X-Access-Token` (preferido) o en `?token=` (para links compartibles). La comparación es en tiempo constante. `PRIVATE` responde 404 sin revelar existencia.

**Regla de curación:** un item entra si comparte al menos un tag con `filterTags` (vacío = todo); `excludeIds` siempre gana, `includeIds` fuerza la inclusión de items visibles; las experiencias ocultas nunca entran. Tema = tema del perfil (o preset `modern-dark`) + `themeOverrides` con merge profundo.

## Scripts

| Script | Qué hace |
|---|---|
| `npm run start:dev` | NestJS en watch |
| `npm run build` / `start:prod` | Compila a `dist/` / ejecuta compilado |
| `npm run lint` / `lint:fix` | ESLint + Prettier |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Unitarios + test de arquitectura (regla de dependencia) |
| `npm run test:e2e` | E2E con supertest contra la base seedeada |
| `npm run test:all` | Ambos |
| `npm run prisma:migrate` / `prisma:status` | Migración `init` / estado de migraciones (desarrollo) |
| `npm run prisma:deploy` | `prisma migrate deploy`: aplica migraciones en producción. **Nunca usar `db push`** |
| `npm run seed` / `seed:verify` | Cargar / verificar datos. El seed carga solo sobre una base vacía y se niega (código 2) si hay contenido; `-- --overwrite` borra y recarga (incluidas las visitas), y no toca `AdminUser` |
| `npm run admin:bootstrap` | Crear/actualizar el administrador (hash argon2id, upsert por email) |
| `npm run views:reclassify` | Recalcula el `kind` de las visitas con `classifyUserAgent` (las `OWNER` no se tocan) y `views` de cada perfil como la cantidad de sus visitas `HUMAN`. Sin `--apply` solo informa; con `-- --apply` escribe en una transacción. Idempotente; correrlo después de cada cambio de versión de la lista de bots |
| `npm run openapi:export` | Escribe `backend/openapi.json` (mismo documento que `/api/docs-json`) sin levantar servidor ni conectar a la base; el frontend genera sus tipos desde él (`npm run api:types`). Se versiona: correrlo cuando cambie el contrato |

## Producción (Fase 6)

| Tema | Cómo queda |
|---|---|
| Errores | `AllExceptionsFilter` global: todo error sale como `{ statusCode, message, error, requestId, timestamp }`, sin stack, SQL ni detalles de Prisma; el detalle va al log |
| Healthcheck | `GET /health` (200, o **503** si la base no responde) y `GET /health/live` (200 mientras viva el proceso). Fuera de `/api`, sin autenticación y sin límite de peticiones |
| Límite de peticiones | Global por IP (`THROTTLE_TTL`/`THROTTLE_LIMIT`, 120/min) y reforzado en `POST /api/auth/login` (`THROTTLE_LOGIN_LIMIT`, 5/min) con 429 y `Retry-After`. Contador en memoria: por instancia |
| Cabeceras | Helmet para API JSON (`nosniff`, `DENY`, `no-referrer`, sin `x-powered-by`); en producción HSTS y redirección 301 a https según `X-Forwarded-Proto` |
| Logs | Pino: JSON en producción, legible en desarrollo (`LOG_LEVEL`). Cada petición lleva `requestId`, que vuelve en `X-Request-Id` y en el cuerpo de error. De la petición solo se registran id, método y URL, con `?token=` censurado |
| Arranque | Con `NODE_ENV=production` la API **no arranca** si `JWT_SECRET` es el del ejemplo, tiene menos de 32 caracteres o coincide con `ANALYTICS_SALT`, o si `FRONTEND_URL` no usa https |
| Swagger | Publicado en desarrollo; en producción solo con `ENABLE_API_DOCS=true` |
| SEO | `GET /robots.txt` y `GET /sitemap.xml` (solo perfiles `PUBLIC`, URLs sobre `FRONTEND_URL`) |

Despliegue paso a paso: **`docs/DEPLOY.md`**.

## Sesión del backoffice (Fase 5)

`POST /api/auth/login` devuelve el JWT en el cuerpo **y** lo emite como cookie `portfolio_session` (`HttpOnly`, `Path=/`, `Secure` solo en producción, caducidad igual a `JWT_EXPIRES_IN`). El `SameSite` se elige con `SESSION_COOKIE_SAMESITE` (`lax` por defecto, `strict`, o `none`, que fuerza `Secure`). El guard de `/api/admin/*` y `GET /api/auth/me` aceptan el token por header `Authorization: Bearer` (prioridad) o por esa cookie, así que `curl`, Swagger y los e2e siguen funcionando igual. `POST /api/auth/logout` borra la cookie y responde 204. El login tiene su propio límite de peticiones (`THROTTLE_LOGIN_LIMIT`, 5/min por IP).

En desarrollo el navegador ve un único origen gracias al proxy de Vite (`localhost:5173` → `3300`), por eso `SameSite=Lax` alcanza. **En producción** el servicio `web` (Caddy) hace de proxy de `/api/*`, así que sitio y API comparten origen y se usa `SESSION_COOKIE_SAMESITE=strict` (`docs/DEPLOY.md` § 9.5). Un despliegue con dominios distintos necesitaría `none`.

El preview del constructor (`POST /api/admin/curated-profiles/preview`) comparte el pipeline con la ruta pública mediante `CuratedProfileComposer`, así que no puede divergir de lo que verá el visitante.

## Estructura (módulo de referencia)

```
src/
├── main.ts · app.module.ts · app.constants.ts · swagger.ts
├── config/                       env.validation.ts (fail-fast) · configuration.ts
├── shared/
│   ├── domain/                   result.ts · errors/ · i18n/ (núcleo puro: Locale, resolveLocale…)
│   └── infrastructure/
│       ├── persistence/          prisma.service · prisma.module · json.guards
│       ├── i18n/resolve-locale   fachada (re-export del núcleo + normalizeLocale)
│       └── http/                 request-locale.decorator · content-language.interceptor · domain-error.mapper · cors.options · admin-validation.pipe · ip-hash · dto/localized.dto
└── modules/
    ├── profile/                  domain/ · application/ · infrastructure/{persistence,controllers} · profile.module.ts
    ├── experience/               (misma estructura + domain/services/sort-experiences.ts — orden canónico)
    ├── skill/ · theme/           mínimos: dominio + puerto + adaptador Prisma (sin endpoints); theme/domain/services/merge-theme-tokens.ts
    ├── curated-profile/          núcleo: domain/services/{select-by-tags,select-skill-categories,resolve-sections,validate-curated-profile} · value-objects/access-token
    │                             application/use-cases/{resolve-curated-profile,list-curated-profiles,admin/*} · infrastructure/{persistence,controllers}
    ├── education/ · project/ · social-link/   secciones: lectura pública + puertos que consume PortfolioSectionsLoader (curated-profile/application/services)
    ├── auth/                     AdminUser · puertos PasswordHasher/TokenSigner · LoginUseCase · argon2 + JWT (Passport) · JwtAuthGuard
    ├── analytics/                ProfileView: registro atómico (create + views++) y agregado por perfil/idioma/día/origen
    └── health/                   GET /health y /health/live (fuera de /api)
```

Regla de dependencia `domain ← application ← infrastructure`, verificada por `test/architecture.spec.ts`. Prisma solo en `infrastructure/persistence`. Casos de uso devuelven `Result<T,E>`; el controller traduce errores de dominio a HTTP con `toHttpException`.

## Cómo verificar los criterios de aceptación de la Fase 1

| Criterio | Cómo |
|---|---|
| `docker compose up -d` levanta Postgres y la app conecta | `docker ps` muestra `portfolio-postgres (healthy)`; `npm run start:dev` loguea "Conexión a PostgreSQL establecida" |
| `prisma migrate dev` genera migración versionada (no `db push`) | existe `prisma/migrations/<ts>_init/migration.sql`; `npm run prisma:status` → "up to date"; `grep "db push" package.json` vacío |
| El seed carga experiencias, perfiles, skills, educación, certificaciones y profile | `npm run seed && npm run seed:verify` → todos ✅ (15 experiencias, 14 perfiles curados = 13 plantillas + `all`) |
| `GET /api/experiences` y `GET /api/profile` responden | `curl localhost:$PORT/api/experiences` · `curl localhost:$PORT/api/profile` |
| Respeta `?locale=es\|en` | `curl "localhost:$PORT/api/profile?locale=en"` → `availability.startDate: "Immediate"` y `Content-Language: en` |
| Dominio aislado (caso de uso sin Prisma) | `npm test` → `test/architecture.spec.ts` en verde |
| Swagger en `/api/docs` | abrir `http://localhost:$PORT/api/docs` |

Evidencia registrada en [`../openspec/changes/archive/2026-09-06-add-backend-base/verification.md`](../openspec/changes/archive/2026-09-06-add-backend-base/verification.md).

## Cómo verificar los criterios de aceptación de la Fase 2

| Criterio | Cómo |
|---|---|
| `tech-lead-dotnet?locale=es` devuelve solo experiencias con intersección de tags | `curl "localhost:$PORT/api/curated-profiles/tech-lead-dotnet?locale=es"` → cada `experiences[].tags` intersecta con `leadership, dotnet, microservices, migration, microsoft, integration, fullstack` |
| Un perfil con tag `java` no trae experiencias .NET puras | `curl localhost:$PORT/api/curated-profiles/java-senior-backend` → no aparecen YPFB ni Delta Cargo |
| Overrides `includeIds` / `excludeIds` | e2e `test/curated-profile.e2e-spec.ts` → "overrides includeIds / excludeIds" (mutación revertida) |
| Orden cronológico descendente | `curl localhost:$PORT/api/curated-profiles/generalist-polyglot` → `startDate` no creciente |
| `locale=en` en inglés; locale inexistente cae a español | `?locale=en` → `title` en inglés; `?locale=xx` → 200 + `Content-Language: es` |
| `generalist-polyglot` resuelve la mayoría; `tech-lead-dotnet` un subconjunto | 15 vs. 13 experiencias |
| Lógica testeable sin DB | `npm test` → `select-by-tags.spec`, `curated-profile.use-cases.spec` (repos mock) |

Evidencia: [`../openspec/changes/archive/2026-09-06-add-curated-profile-resolution/verification.md`](../openspec/changes/archive/2026-09-06-add-curated-profile-resolution/verification.md).

## Cómo verificar los criterios de aceptación de la Fase 3

| Criterio | Cómo |
|---|---|
| `POST /api/auth/login` válido → JWT; inválido → 401 | `npm run admin:bootstrap` y luego `curl -X POST localhost:$PORT/api/auth/login -H "Content-Type: application/json" -d '{"email":"…","password":"…"}'` |
| Escrituras rechazan requests sin token | `curl -X POST localhost:$PORT/api/admin/experiences` → 401 |
| Lecturas públicas siguen abiertas | `curl localhost:$PORT/api/experiences` → 200 sin token |
| CRUD de experiencias end-to-end | e2e `test/admin.e2e-spec.ts` → "ciclo completo"; o curl con `Authorization: Bearer` |
| CRUD de perfiles curados edita filterTags/includeIds/excludeIds | e2e "editar filterTags, includeIds/excludeIds…" (verifica el efecto en la ruta pública) |
| Visita a perfil público registra `ProfileView` | `curl localhost:$PORT/api/curated-profiles/all` y consultar la tabla (Adminer) o `GET /api/admin/analytics/views` |
| Contraseñas hasheadas | `SELECT "passwordHash" FROM "AdminUser"` → empieza con `$argon2id$` |

Evidencia: [`../openspec/changes/archive/2026-09-07-add-auth-and-crud/verification.md`](../openspec/changes/archive/2026-09-07-add-auth-and-crud/verification.md).

## Notas

- **Puerto:** `.env.example` usa 3300 (el 3000 suele estar ocupado y el proxy de Vite apunta al 3300). Si también está ocupado, cambiá `PORT` en tu `.env` (no versionado) y `VITE_PROXY_TARGET` en el frontend.
- **Seed destructivo:** `npm run seed` borra y recarga el contenido (perfil, idiomas, experiencias, skills, formación, proyectos, enlaces, temas, perfiles curados y visitas). Como todo se edita desde el panel, **se niega (código 2) sobre una base con contenido** y muestra los conteos y un `pg_dump` sugerido; recargar exige `npm run seed -- --overwrite` y, en producción, además `SEED_ALLOW_PRODUCTION=1` solo para ese comando (nunca como variable del servicio), después de un `pg_dump` (`docs/DEPLOY.md` § 7). No se combina con `--file`. Si no puede contar (base sin migrar), sale con 1 sin borrar. No toca `AdminUser`.
- **Versiones fijadas:** NestJS ~11.2 y Prisma ~6.19 (ver `openspec/changes/archive/2026-09-06-add-backend-base/design.md`, D1/D2). Los upgrades a NestJS 12 / Prisma 7 se harán como changes propios.
- **Overrides de perfiles curados:** `includeIds`/`excludeIds` referencian ids `cuid` generados en el seed, así que no viven en `cv-data.json`; se gestionan desde el constructor del panel.
- **Analítica:** cada visita pública registra un `ProfileView` (IP solo como HMAC). No hay política de retención definida.
- **Auth:** un solo administrador (`admin:bootstrap`). La sesión es una cookie `httpOnly` (el frontend nunca guarda el JWT), con rate limiting en el login; no hay refresh de token. Estado de hardening: `docs/RELEASE-1.0.0-CHECKLIST.md`.
