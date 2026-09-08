# Backend — Portafolio Administrable

API NestJS 11 + Prisma 6 (PostgreSQL) en **Clean Architecture**. Fases 1, 2 y 3 completadas: auth JWT del backoffice (argon2id), CRUD de experiencias/skills/perfiles curados y analítica de visitas; módulos `profile`, `experience`, `skill`, `theme` y el núcleo `curated-profile` (resolución de perfiles curados por tags, overrides, tema y secciones), migración inicial versionada, seed desde `docs/cv-data.json`, endpoints públicos con Swagger e i18n ES/EN con fallback.

> Contrato de arquitectura: [`../CLAUDE.md`](../CLAUDE.md). Specs de negocio: [`../docs/SPECS-POR-FASE.md`](../docs/SPECS-POR-FASE.md). Changes archivados: [`../openspec/changes/archive/`](../openspec/changes/archive/) (`add-backend-base`, `add-curated-profile-resolution`, `add-auth-and-crud`, `add-portfolio-sections-api`). Specs vigentes: [`../openspec/specs/`](../openspec/specs/).

## Requisitos

- Node.js 20+ (probado con 22) · npm 10
- Docker Desktop (Postgres 16 + Adminer vía `docker-compose.yml` en la raíz)

## Puesta en marcha

```bash
# 0. Desde la raíz del repo: levantar Postgres (5432) y Adminer (8080)
docker compose up -d
```

```bash
# 1. Configurar el backend
cd backend
cp .env.example .env        # ajustar PORT si el 3000 está ocupado (ej. PORT=3300); poner un JWT_SECRET fuerte y ADMIN_*
npm install
```

```bash
# 2. Esquema y datos
npm run prisma:generate     # cliente Prisma
npm run prisma:migrate      # prisma migrate dev --name init (migración versionada; NUNCA db push)
npm run seed                # carga docs/cv-data.json (idempotente: limpia y recarga)
npm run seed:verify         # compara conteos DB vs cv-data.json
npm run admin:bootstrap     # crea/actualiza el administrador desde ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_NAME
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
| GET | `/api/docs` · `/api/docs-json` | Swagger UI · documento OpenAPI |

## Backoffice (requiere `Authorization: Bearer <JWT>`)

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/auth/login` | `{ email, password }` → `{ accessToken, tokenType, expiresIn, user }` (401 si no coincide) |
| GET | `/api/auth/me` | Administrador autenticado |
| GET/POST | `/api/admin/experiences` | Listar (incluye ocultas, bilingüe crudo) / crear (201) |
| GET/PATCH/DELETE | `/api/admin/experiences/:id` | Ver / editar parcial / borrar (204) |
| GET/POST | `/api/admin/skill-categories` | Listar categorías con skills / crear |
| PATCH/DELETE | `/api/admin/skill-categories/:id` | Editar / borrar (con sus skills) |
| POST | `/api/admin/skill-categories/:id/skills` | Crear skill (`name`, `tags`, `order`) |
| PATCH/DELETE | `/api/admin/skills/:id` | Editar (incluye mover con `categoryId`) / borrar |
| GET/POST | `/api/admin/curated-profiles` | Listar (cualquier visibilidad, campos internos) / crear (409 slug repetido) |
| GET/PATCH/DELETE | `/api/admin/curated-profiles/:id` | Ver / editar (filtros, overrides, tema, secciones, visibilidad, token) / borrar |
| GET | `/api/admin/analytics/views?from&to` | Visitas agregadas: total, por perfil, por idioma, por día (default 30 días) |

Reglas: cuerpos validados con `class-validator`; campos desconocidos → 400; `PROTECTED` exige `accessToken`; `themeId` debe existir; `slug` kebab-case y único. Los campos traducibles se envían y reciben como `{ es, en? }`.

**Visitas:** cada `GET /api/curated-profiles/:slug` con 200 registra un `ProfileView` (locale, referrer, user-agent, `ipHash` HMAC-SHA256 con `ANALYTICS_SALT`) e incrementa `views`. 401/404 no registran. Un fallo del registro nunca rompe la respuesta.

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
| `npm run prisma:migrate` / `prisma:status` | Migración `init` / estado de migraciones |
| `npm run seed` / `seed:verify` | Cargar / verificar datos (el seed no toca `AdminUser`) |
| `npm run admin:bootstrap` | Crear/actualizar el administrador (hash argon2id, upsert por email) |
| `npm run openapi:export` | Escribe `backend/openapi.json` (mismo documento que `/api/docs-json`) sin levantar servidor ni conectar a la base; el frontend genera sus tipos desde él (`npm run api:types`). Se versiona: correrlo cuando cambie el contrato |

## Sesión del backoffice (Fase 5)

`POST /api/auth/login` devuelve el JWT en el cuerpo **y** lo emite como cookie `portfolio_session` (`HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` solo en producción, caducidad igual a `JWT_EXPIRES_IN`). El guard de `/api/admin/*` y `GET /api/auth/me` aceptan el token por header `Authorization: Bearer` (prioridad) o por esa cookie, así que `curl`, Swagger y los e2e siguen funcionando igual. `POST /api/auth/logout` borra la cookie y responde 204.

En desarrollo el navegador ve un único origen gracias al proxy de Vite (`localhost:5173` → `3300`), por eso `SameSite=Lax` alcanza. Un despliegue con dominios distintos necesitará `SameSite=None; Secure` o un proxy que los unifique (Fase 6, junto con CSRF y rate limiting del login).

## Endpoints del backoffice agregados en la Fase 5

| Endpoint | Qué hace |
|---|---|
| `POST /api/auth/logout` | Cierra la sesión borrando la cookie |
| `POST /api/admin/curated-profiles/preview` | Resuelve un perfil curado **en borrador** (sin guardarlo y sin registrar visitas) y devuelve el mismo cuerpo que `GET /api/curated-profiles/{slug}`. Comparte el pipeline con la ruta pública mediante `CuratedProfileComposer`, así el preview del constructor no puede divergir de lo que verá el visitante |
| `GET /api/admin/themes` | Catálogo de temas (`id`, `slug`, `name`, `isPreset`, `tokens`) para el customizador |

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
    └── analytics/                ProfileView: registro atómico (create + views++) y agregado por perfil/idioma/día
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

- **Puerto:** `.env.example` usa 3000. Si otro servicio lo ocupa, cambiá `PORT` en tu `.env` (no versionado).
- **Seed destructivo:** limpia y recarga todas las tablas. Es el flujo previsto hasta que exista el backoffice (Fase 5).
- **Versiones fijadas:** NestJS ~11.2 y Prisma ~6.19 (ver `openspec/changes/archive/2026-09-06-add-backend-base/design.md`, D1/D2). Los upgrades a NestJS 12 / Prisma 7 se harán como changes propios.
- **Overrides de perfiles curados:** `includeIds`/`excludeIds` referencian ids `cuid` generados en el seed, así que no viven en `cv-data.json`; se gestionarán desde el backoffice (Fase 3/5).
- **Analítica:** cada visita pública registra un `ProfileView` (IP solo como HMAC). La retención de datos se define en Fase 6.
- **Auth:** un solo administrador (`admin:bootstrap`). Token Bearer en memoria del frontend; cookies httpOnly, refresh y rate limiting quedan para Fase 6 (`docs/RELEASE-1.0.0-CHECKLIST.md`).
