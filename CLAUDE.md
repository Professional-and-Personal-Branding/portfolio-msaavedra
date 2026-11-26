# CLAUDE.md — Contexto del Proyecto

> Este archivo es leído automáticamente por Claude Code. Define convenciones, arquitectura y reglas que **deben respetarse** en todo el desarrollo. La fuente de verdad ampliada está en `docs/ARCHITECTURE.md`.

---

## Qué es este proyecto

Portafolio web profesional **administrable** de Manuel Saavedra. El núcleo es el concepto de **perfiles curados** (`CuratedProfile`): vistas filtradas y personalizadas del perfil profesional, generadas para empresas o vacantes específicas, accesibles por un `slug` único.

---

## Stack (NO cambiar sin acuerdo explícito)

- **Backend:** NestJS (v11.x estable) + TypeScript estricto · Clean Architecture + SOLID
- **ORM:** Prisma (PostgreSQL) — CONFIRMADO
- **Frontend:** React 18/19 + TypeScript + Vite
- **UI:** shadcn/ui + Tailwind CSS + Framer Motion + Lucide React
- **Data fetching:** TanStack Query v5 · **Forms:** React Hook Form + Zod · **Estado:** Zustand
- **Theming:** design tokens en DB → CSS variables en runtime (pilar del producto)

---

## Reglas de Arquitectura (Clean Architecture) — OBLIGATORIAS

Estructura por módulo de dominio, con la regla de dependencia estricta:

```
domain  ←  application  ←  infrastructure
```

1. **`domain/`** — Entidades, value objects, interfaces de repositorio (puertos), errores de dominio. NO depende de NADA externo. Sin decoradores de NestJS, sin Prisma, sin librerías de infraestructura.
2. **`application/`** — Casos de uso (un caso de uso = una clase con un único método `execute()`), DTOs, mappers. Depende solo de `domain`. Define puertos que infraestructura implementa.
3. **`infrastructure/`** — Implementaciones concretas: repositorios Prisma (adaptadores), controllers HTTP, módulos NestJS. Depende de `application` y `domain`.

**Reglas concretas:**
- Prisma vive SOLO en `infrastructure/persistence/`. Nunca importar `@prisma/client` en domain o application.
- Los casos de uso reciben interfaces de repositorio por inyección (DIP), no clases concretas. Usar tokens de inyección de NestJS.
- Manejo de errores en domain con un patrón `Result<T, E>` (Either) — evitar lanzar excepciones desde el dominio.
- DTOs de entrada validados con `class-validator` + `class-transformer`.
- Cada módulo expone su `*.module.ts` que cablea las dependencias (provee implementaciones para los tokens).

**Módulo de referencia:** implementar primero `profile` y `experience` con esta estructura completa y bien hecha; servirán de plantilla para los demás.

---

## Estructura de carpetas

```
backend/src/
├── modules/
│   ├── profile/        { domain, application, infrastructure, profile.module.ts }
│   ├── experience/
│   ├── skill/
│   ├── curated-profile/   # núcleo del producto
│   ├── theme/             # sistema de personalización
│   ├── education/
│   └── auth/
├── shared/
│   ├── domain/         # BaseEntity, Result type, errores base
│   ├── application/
│   └── infrastructure/ # PrismaService, guards, interceptors, config
├── config/
└── main.ts
```

```
frontend/src/
├── app/                # providers, router
├── features/           # portfolio-public, curated-view, backoffice
├── shared/             # components/ui, hooks, lib, types
└── themes/             # theme-provider, presets, tokens, layouts
```

---

## Convenciones de código

- **TypeScript estricto:** `strict: true`, sin `any` (usar `unknown` + narrowing).
- **Naming:** PascalCase para clases/tipos, camelCase para variables/funciones, kebab-case para archivos.
- **Casos de uso:** nombre verbo + sustantivo, ej. `ResolveCuratedProfileUseCase`, `CreateExperienceUseCase`.
- **Commits:** conventional commits (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`).
- **Tests:** Jest (backend), Vitest (frontend). Casos de uso deben tener tests unitarios con repositorios mockeados.
- **Validación frontend:** Zod schemas compartidos donde sea posible.
- **No usar** `localStorage`/`sessionStorage` en componentes que puedan correr en SSR; preferir estado en memoria o cookies httpOnly para auth.

---

## Modelos por tipo de trabajo

- Diseño, specs, ADRs, decisiones y preguntas al owner → agente `arquitecto` (Claude Opus 5.5, `claude-opus-5-5`).
- Implementación, tests, archivado y cierre de PRs → agente `implementador` (Claude Sonnet 5.5, `claude-sonnet-5-5`).
- La sesión principal orquesta: reparte el trabajo, revisa diffs, resuelve conflictos e integra.
- Si una tarea mezcla ambos, primero `arquitecto` (spec y decisiones) y después `implementador`.
- Para cambiar de versión de modelo en el futuro, se actualiza el `model:` de ambos agentes y esta sección en el mismo PR.

Los agentes viven en `.claude/agents/arquitecto.md` y `.claude/agents/implementador.md`.

---

## El núcleo: ResolveCuratedProfile

Dado un `slug`, el caso de uso `ResolveCuratedProfileUseCase`:
1. Busca el `CuratedProfile` por slug. Si no existe o no es visible → error de dominio.
2. Si es `PROTECTED`, valida el token de acceso.
3. Resuelve las **experiencias**, **skills** y **proyectos** aplicando (y adjunta educación, certificaciones y enlaces sociales sin filtrar):
   - Filtro por `filterTags` (incluir si el item comparte al menos un tag; `filterTags` vacío = todo).
   - Overrides: `includeIds` fuerza inclusión (solo de items visibles), `excludeIds` fuerza exclusión y siempre gana.
   - Orden canónico (decisión D1 de `add-curated-profile-resolution`): **cronológico**, `startDate` desc y `order` asc como desempate — el mismo que `GET /api/experiences`.
4. Resuelve el **tema**: `theme` base + `themeOverrides` (merge profundo).
5. Aplica `sectionsOrder` y `sectionsHidden`.
6. Registra la visita (`ProfileView`) — implementado en Fase 3: solo cuando el caso de uso recibe `viewContext` (ruta pública), en segundo plano y sin que un fallo altere la respuesta. IP solo como HMAC (`ANALYTICS_SALT`). Cada visita se guarda con su `kind` (change `classify-profile-views`): `OWNER` si la petición trae una sesión de administrador válida (cookie o Bearer, validada en la tarea en segundo plano; la ruta sigue siendo anónima), `BOT` si el `User-Agent` falta o está en la lista versionada (`classifyUserAgent`), `HUMAN` el resto. **El contador `views` y el agregado suman solo `HUMAN`**; `byKind` cuenta todas. Atribución (change `add-share-links`): `?via=<código>` (un `ShareLink` de 10 caracteres, activo y del mismo perfil) guarda `ProfileView.shareLinkId` y `?src=<portal>` (normalizado a `[a-z0-9-]`, 32) guarda `ProfileView.source`, ambos resueltos en la misma tarea en segundo plano, sin cambiar la respuesta ni reemplazar al token; `byShareLink` y `bySource` cuentan solo `HUMAN`. El incremento de `views` es un `UPDATE` crudo en la misma transacción y no mueve `CuratedProfile.updatedAt` (change `polish-views-updated-at-and-builder`).
7. Devuelve un DTO de presentación listo para el frontend.

Este caso de uso es el corazón del producto — implementarlo con tests exhaustivos. Implementado en `backend/src/modules/curated-profile/` (servicios puros `select-by-tags`, `select-skill-categories`, `resolve-sections`; tema en `modules/theme/domain/services/merge-theme-tokens.ts`). `PRIVATE` → 404 (no revela existencia); `PROTECTED` → 401 sin token válido (`X-Access-Token` o `?token=`).

---

## Comandos esperados (definir en package.json)

```
# Backend
npm run start:dev        # NestJS en watch
npm run prisma:migrate   # prisma migrate dev
npm run prisma:generate  # prisma generate
npm run prisma:status    # prisma migrate status
npm run seed             # carga docs/cv-data.json solo sobre una base vacía; con contenido se niega (código 2) salvo --overwrite, y en producción además SEED_ALLOW_PRODUCTION=1
npm run seed:verify      # compara conteos DB vs cv-data.json
npm run seed -- --file <ruta>   # carga otro archivo (solo en una base DESCARTABLE: exige SEED_DISPOSABLE_DB=1, NODE_ENV != production y base vacía o con el mismo perfil; si no, sale con 2)
npm run seed:example     # carga docs/examples/cv-data.example.json (datos FICTICIOS) en una base aparte, p. ej. portfolio_example; nunca en la del owner
npm run seed:example:verify   # compara la base con el ejemplo (conteos, mecanismos de cada perfil, alias y visitas)
npm run admin:bootstrap  # crea/actualiza el administrador (ADMIN_EMAIL/ADMIN_PASSWORD/ADMIN_NAME, argon2id)
npm run views:reclassify # recalcula el `kind` de las visitas con la lista de bots vigente y `views` como la cantidad de visitas HUMAN (simulación; `-- --apply` escribe; correrlo primero sin --apply y con pg_dump)
npm run cv:lint          # reglas de consistencia del CV sobre docs/cv-data.json (sin base): 0 ok, 1 algún error, 2 archivo inválido
npm run integrations:sync   # corre el ejecutor de integraciones una vez, sin HTTP ([-- --provider <id>] [-- --plan]): 0 ok, 1 algún trabajo falló, 2 entorno inválido
npm run integrations:rekey  # recifra las credenciales con la clave activa del keyring
npm run job-postings:purge  # simula: cuántas vacantes vencidas (90 días) purgaría; `-- --apply` borra su texto crudo
npm run ai:eval          # evals en vivo contra Anthropic: exige AI_EVAL_API_KEY (workspace de evals, distinta de ANTHROPIC_API_KEY) y AI_EVAL_ALLOW_SPEND=1; tope 2 USD; se niega en producción (código 2)
npm run ai-runs:purge    # deja en nulo la salida de las corridas de IA de más de 180 días (simulación; `-- --apply` escribe)
npm run openapi:export   # escribe backend/openapi.json (fuente de los tipos del frontend; sin servidor ni DB)
npm run prisma:deploy    # aplica migraciones en producción (NUNCA prisma db push)
# El backoffice vive en el frontend: http://localhost:5173/admin
npm run test             # jest
npm run test:e2e         # jest e2e contra el Postgres local (migrado y seedeado)
npm run lint             # eslint
npm run typecheck        # tsc --noEmit

# Frontend
npm run dev              # vite (proxy /api → backend en 3300)
npm run build            # tsc -b + vite build
npm run test             # vitest
npm run api:types        # regenera src/shared/types/api.d.ts desde ../backend/openapi.json
npm run lint             # eslint
npm run typecheck        # tsc -b
npm run print:check      # PDF de cada perfil en A4 y Letter: una hoja y contraste ≥ 4,5:1 (exige PRINT_CHECK_DISPOSABLE_DB=1 y una base DESCARTABLE)
npm run perf:budget      # tope de JS del arranque público (≤ 155 KB gzip, un solo JS de módulo) sobre dist/; sin navegador ni base
# a11y:check y perf:check abren páginas reales (cada carga registra una visita): exigen A11Y_CHECK_DISPOSABLE_DB=1
npm run manual:capture -- <base>   # regenera las capturas de docs/manual desde la API de EJEMPLO (exige MANUAL_CAPTURE_DISPOSABLE_DB=1 y que GET /api/profile devuelva el perfil ficticio; sale con 2 si no)
npm run manual:check             # sin navegador ni base: MANUAL.md e index.html alineados (casos, imágenes, mensajes literales, topes de tamaño); corre en el CI
# y una base DESCARTABLE; contra la imagen de frontend/Dockerfile (ver docs/MANUAL.md § 5.1)
npm run a11y:check -- <base>   # axe-core + recorrido de teclado (con A11Y_CHECK_ADMIN_EMAIL/_PASSWORD, también el panel)
# A11Y_CHECK_PROFILE=<slug> elige el perfil base de la matriz de presets (por defecto tech-lead-dotnet; con el ejemplo, ejemplo-backend); si no resuelve, sale con 2 sin abrir páginas
npm run perf:check -- <base>   # Lighthouse mobile, mediana de PERF_CHECK_RUNS (3) y umbral PERF_CHECK_MIN_PERFORMANCE (90)

# Infraestructura de Railway (.railway/; sin red hacia Railway; corre en el CI como el job `railway-iac`)
npm ci --prefix .railway && npm run typecheck --prefix .railway && npm test --prefix .railway   # tipos de railway.ts y su test de coherencia con el repo
```

---

## Roadmap (seguir en orden — detalle en docs/ARCHITECTURE.md)

- [x] Fase 0 — Scaffolding, datos, demos, estos artefactos
> Specs por fase con criterios de aceptación: `docs/SPECS-POR-FASE.md` (guía SDD).

- [x] Fase 1 — Backend base (profile, experience) + Prisma + seed + Swagger — change `add-backend-base` (ver `openspec/changes/archive/`)
- [x] Fase 2 — curated-profile (ResolveCuratedProfile) — change `add-curated-profile-resolution`
- [x] Fase 3 — auth JWT + backoffice API (CRUD) — change `add-auth-and-crud`
- [x] Fase 4 — frontend público + motor de theming — change `add-public-frontend-theming`
- [x] Fase 5 — frontend backoffice + customizador visual — change `add-admin-backoffice`
- [x] Fase 6 — hardening para producción — change `add-production-hardening`; falta el deploy en sí (ver `docs/DEPLOY.md`)
- [ ] Deploy 1.0.0 — **Railway** (los tres servicios en un proyecto); infraestructura como código en `.railway/railway.ts` (`railway config plan` → `apply`), más `frontend/Dockerfile` y `frontend/Caddyfile`. Guía corta: `docs/DEPLOY-RAILWAY.md`; referencia completa: `docs/DEPLOY.md` § 9.5
- [x] Ronda 1.1 — 5 changes en orden, todos archivados el 2026-10-08 (`docs/ROADMAP-1.1.md` § 4):
  - [x] `unify-section-catalog` — un solo catálogo de secciones (archivado 2026-10-05)
  - [x] `add-server-rendered-head` — head SEO por perfil servido desde el servidor (archivado 2026-10-08; la verificación con LinkedIn y Slack queda para después del deploy)
  - [x] `add-curated-profile-lifecycle` — duplicar, archivar, `listed` y alias de slug (archivado 2026-10-08)
  - [x] `add-profile-content-admin` — hero, educación, certificaciones, proyectos y enlaces desde el panel (archivado 2026-10-08)
  - [x] `add-bilingual-builder-parity` — conmutador de idioma en el preview, `highlights.en` editable y aviso de faltantes de traducción (archivado 2026-10-08)
- [x] `polish-builder-and-edge` — aviso de cambios sin guardar, visita en segundo plano, CSP del sitio y `accentColor` obsoleto (etapa 1) (archivado 2026-10-09)
- [x] `retire-accent-color` — `accentColor` retirado del contrato y la base; su color pasó a `themeOverrides.colors.accent` (archivado 2026-10-09)
- [x] `add-printable-one-page` — hoja imprimible de una página (A4/Letter) con botón «Imprimir / Guardar PDF» y `npm run print:check` (archivado 2026-10-10)
- [x] `localize-language-level` — el nivel de los idiomas pasa a texto bilingüe `{es,en}` en la misma fila (migración de datos no destructiva) y se edita en ES/EN desde la Portada (archivado 2026-10-10)
- [x] `improve-a11y-and-performance` — accesibilidad AA (acento, atenuado y foco derivados del tema, salto al contenido, estructura ARIA), arranque público de 228 a 179 KB gzip y los checks `perf:budget`, `a11y:check` y `perf:check` bloqueantes en el CI (job `web-quality`) (archivado 2026-10-16; marcar `web-quality` como required checks de `main` no es posible hoy: el plan gratuito de GitHub con repo privado responde 403 a la protección de ramas y a los rulesets, y el owner decidió mantener el repo privado, P6)
- [x] `improve-mobile-performance` — Performance mobile ≥ 85 en el runner de GitHub: arranque en un solo chunk, perfil en dos tiempos (hero primero), menús de la barra en diferido, petición temprana del perfil (`public/profile-prefetch.js`), Inter del propio sitio y animación de entrada sin remontar; umbral de CI en 85 y tope de `perf:budget` en 155 KB. Medianas de Performance de 97 en el CI (archivado 2026-10-16)
- [x] `add-learning-guide-and-example-data` — datos de ejemplo ficticios (`docs/examples/cv-data.example.json`), seed con formato extendido y `--file` con negativa en tres capas (`SEED_DISPOSABLE_DB=1`, `NODE_ENV` distinto de `production`, base vacía o con el mismo perfil), guía campo por campo (`docs/DATA-POPULATION.md` § 11 y 12) y manual renovado con `manual:capture` y `manual:check` en el CI (archivado 2026-10-28)
- [x] `protect-default-seed` — `npm run seed` se niega (código 2) sobre una base con contenido salvo `--overwrite`; en producción además `SEED_ALLOW_PRODUCTION=1`, solo para el comando. Sugiere un `pg_dump` sin contraseña y el `preDeployCommand` sigue sin sembrar (archivado 2026-10-28)
- [x] `classify-profile-views` — cada visita se guarda con su `kind` (HUMAN/OWNER/BOT), `views` suma solo las humanas y `npm run views:reclassify` recalcula las históricas (archivado 2026-10-29)
- [x] `fix-admin-contrast` — ítems ocultos e insignias del panel con contraste AA, token `--t-success-ink` y pierna `a11y-example` del CI (archivado 2026-10-29)
- [x] `add-share-links` — enlaces de seguimiento `?via=` y portal `?src=`, API de admin, «Compartir en LinkedIn» y tablas «Por enlace» y «Por portal» (archivado 2026-10-29)
- [x] `add-certification-verification` — cada certificación puede llevar `verificationUrl` (solo https), `credentialId` y `expiresAt` (`AAAA-MM` o `AAAA`); «Ver credencial» en la sección y en el PDF, «Vencida» derivada en el cliente, sin llamadas al emisor; migración aditiva y seed retrocompatible (archivado 2026-10-29)
- [x] `add-builder-skill-project-overrides` — el constructor incluye y excluye skills (por skill, agrupadas por categoría y con buscador) y proyectos en los mismos `includeIds`/`excludeIds` (ids cuid compartidos), con Incluir y Excluir mutuamente excluyentes, ocultos marcados y referencias huérfanas visibles; solo frontend, sin cambios de contrato (archivado 2026-11-05)
- [x] `upgrade-profile-structured-data` — el JSON-LD del perfil pasa a `ProfilePage` con el `Person` (`knowsAbout`, `alumniOf` y `hasCredential`), sin `dateModified` por la P1 y con el cliente sin bloque y `noindex` (archivado 2026-11-05)
- [x] `polish-views-updated-at-and-builder` — el incremento de `views` ya no mueve `CuratedProfile.updatedAt` (`UPDATE` crudo en la misma transacción) y se pulen detalles del constructor; resolvió la P1 de `upgrade-profile-structured-data` (archivado 2026-11-05)
- [x] `add-admin-password-change` — cambio de contraseña desde **Cuenta**, `sessionVersion` en el JWT que revoca las demás sesiones, límite propio y `admin:bootstrap` como recuperación (archivado 2026-11-05)
- [x] `fix-error-contrast-and-date-modified` — mensajes de error con `--t-danger-ink` (≥ 4,5:1 en todos los presets) y regla `danger`, `a11y:check` con formularios con errores a la vista, y `dateModified` en el JSON-LD desde `CuratedProfile.updatedAt` (día UTC, igual al `<lastmod>`), con `updatedAt` en el DTO público (archivado 2026-11-07)
- [x] `raise-manual-html-size-cap` — el tope de `docs/manual/index.html` en `manual:check` pasa de 300 KB a 1 MB (el límite de un artifact es 16 MB y cada caso suma ~3 KB); imágenes sin cambios (archivado 2026-11-09)
- [ ] Fase 1.3 — sin bloqueantes primero (`docs/PROPUESTA-FEATURES.md` § 6.2; decisiones del owner del 2026-11-07):
  - [x] `add-json-resume-export` — cada perfil curado se exporta como JSON Resume v1.0.0 (`GET /api/curated-profiles/:slug/resume.json?locale=` y la ruta del panel por id), con la misma resolución que la ruta pública y sin registrar visitas; schema vendorizado con SHA-256 y validado con Ajv en los tests (archivado 2026-11-10)
  - [x] `add-application-tracking` — postulaciones en `/admin/postulaciones` (siete estados con transiciones, `RuleViolationError` → 422, vínculo con un `ShareLink` y «Abierto el…», CSV a prueba de fórmulas), sin rutas públicas ni datos de contacto; migración aditiva `add_application_tracking` (archivado 2026-11-10)
  - [x] `add-cv-consistency-rules` — linter determinista del CV (14 códigos, `computeYearsOfExperience`), pantalla `/admin/revision`, `GET /api/admin/consistency` y `npm run cv:lint` en el CI (archivado 2026-11-10)
  - [x] `add-integrations-foundation` — base para integrar terceros (solo el conector `fake`): cola en Postgres con arriendo del ejecutor y `FOR UPDATE SKIP LOCKED`, `@nestjs/schedule` **apagado por defecto** (`INTEGRATIONS_SCHEDULER_ENABLED`), credenciales AES-256-GCM con keyring (`INTEGRATIONS_KEYS`/`INTEGRATIONS_ACTIVE_KEY`; la variable del secreto de cada proveedor es opcional), pantalla `/admin/integraciones` desde **Cuenta** (sin ítem en la barra) y latencia medida sin cuellos de botella (archivado 2026-11-13)
  - [x] `add-featured-repositories` — repositorios de GitHub cargados a mano (solo URLs de GitHub), décima sección `repositories` (visible con 2 o más), línea en el PDF solo si entra, JSON Resume y constructor; migración de datos que ubica `repositories` después de `projects` en los perfiles ya sembrados (archivado 2026-11-13)
  - [x] `add-job-posting-intake` — perfil curado borrador (`PRIVATE`) desde una vacante: URL de Greenhouse/Lever/Ashby o JSON-LD con guarda SSRF, o texto pegado (portales cerrados → 422), cobertura de tags, texto crudo purgado a los 90 días (perezoso y `npm run job-postings:purge`); pantalla `/admin/perfiles/desde-vacante` (archivado 2026-11-13)
  - [x] `raise-manual-images-cap` — el tope del total de imágenes de `manual:check` pasa de 4 MB a 8 MB; por imagen sigue en 150 KB (archivado 2026-11-13)
  - [x] `add-github-code-evidence` — primer proveedor real (`github`): verifica los repositorios destacados contra la API REST en serie, con ETag y un PAT de solo lectura (`GITHUB_SYNC_TOKEN` opcional o credencial del panel) que no sale de `api.github.com`; tabla `RepositoryEvidence` (migración aditiva), lo manual nunca se pisa, tarjeta con stars, lenguajes, topics y «Verificado en GitHub el…», cero red en la ruta pública y `GITHUB_TRANSPORT=fixture` (prohibido en producción) para tests y capturas; Integraciones pasa a B18 en el manual (archivado 2026-11-17)
  - Pendientes para el deploy: la purga de vacantes es perezosa más una corrida mensual a mano (sin cron: `job-postings:purge` simula y `-- --apply` escribe); para la evidencia de GitHub, crear el token fine-grained de solo lectura, habilitar `INTEGRATIONS_ENABLED=github` con el keyring y encender `INTEGRATIONS_SCHEDULER_ENABLED` en una sola réplica (`docs/DEPLOY-RAILWAY.md`), y ejecutar TC-52 contra GitHub real
- [x] `polish-pre-deploy-cleanup` — limpieza antes del deploy 1.0.0: se retira la columna inerte `FeaturedRepository.stars` (migración `retire_featured_repository_stars`), Caddy deja una sola línea `Cache-Control` por respuesta (`?Cache-Control`) y las tablas «Por enlace» y «Por portal» del Dashboard se alcanzan con teclado (`Table.regionLabel`), con `a11y:check` auditándolas con filas (archivado 2026-11-18)
- [x] `prepare-deploy-1-0-0` — endurecimiento de producción y guías de deploy alineadas con el código: `ANALYTICS_SALT` obligatoria (32 o más, distinta de `JWT_SECRET` y del keyring) y `FRONTEND_URL` como origen en el arranque, `admin:bootstrap` sin la contraseña de ejemplo y con 12 o más en producción, `job-postings:purge` que simula por defecto, las 15 migraciones, renombre de servicios, tabla de variables por servicio y «Checklist de la 1.0.0» (archivado 2026-11-19; el repo es público desde el 2026-11-18 y `main` exige los 6 checks del CI)
- [x] `migrate-railway-iac` — la infraestructura de Railway pasa de Config as Code (los archivos de configuración de cada servicio, deprecados: dejan de leerse el 2026-12-01) a IaC en `.railway/railway.ts` (Postgres 18, `api` y `web`, dominio `mjsaavedra.is-a.dev`, secretos con `preserve()`), con su test sin red y el job `railway-iac` del CI; el CI pasa a `postgres:18-alpine` (se archiva tras el merge)
- [ ] Fase 2.0 — IA con Anthropic (decisión del owner del 2026-11-17: tope de 10 USD por mes más el spend limit de la Console):
  - [x] `add-ai-foundation` — módulo `ai` con `LlmPort` (adaptadores `anthropic`, `fake` prohibido en producción, `disabled` y de cassettes), modelos por tarea (Haiku 5.5 por defecto), `BudgetGuard` con reserva atómica del peor caso en `AiBudgetMonth` (micro-USD, `AI_MONTHLY_BUDGET_USD`), `maxRetries: 0`, `AiRun`, caché por hash, prompts versionados, frontera de datos con lista blanca y guardián, bloque «Inteligencia artificial» en `/admin/integraciones`, `npm run ai:eval` (solo con `AI_EVAL_API_KEY` de otro workspace y `AI_EVAL_ALLOW_SPEND=1`, tope 2 USD) y `npm run ai-runs:purge` (180 días); **apagada por defecto** (`AI_ENABLED`) (archivado 2026-11-18)

---

## Decisiones tomadas (no re-litigar sin motivo)

- ORM = Prisma.
- Theming basado en design tokens + CSS variables en runtime (sin rebuild al cambiar tema).
- Monolito modular (no microservicios) para el MVP.
- Dos carpetas independientes (backend / frontend); considerar monorepo (Turborepo/Nx) solo si se necesita compartir tipos intensivamente.
- Tipos del frontend: generar desde el OpenAPI del backend (openapi-typescript) para contrato único. Implementado en Fase 4: `backend/openapi.json` y `frontend/src/shared/types/api.d.ts` se versionan; un test del frontend detecta la deriva.
- Frontend (Fase 4): los tokens se aplican como `--t-*` en un contenedor raíz (no en `documentElement`); Tailwind 4 los expone con `@theme inline` (`bg-bg`, `bg-brand`, `rounded-theme`, …) y las variables de shadcn/ui derivan de ellos. Idioma, preset, layout y token viven en la URL (`?lang= ?theme= ?layout= ?token=`), sin `localStorage`. La home es el perfil curado `all`. El catálogo de secciones (10 ids; `repositories` desde `add-featured-repositories`) vive solo en el dominio del backend y viaja como enum `SectionId` del OpenAPI; el backend aplica orden, ocultado y relleno (las secciones con datos que no figuran en `sectionsOrder` van al final) y el cliente renderiza `sections` tal cual (change `unify-section-catalog`).
- Backoffice (Fase 5): panel en `/admin` dentro del mismo frontend, en un chunk aparte (`React.lazy`). La sesión es una **cookie httpOnly** (`portfolio_session`) que emite el login; el guard acepta cookie o `Authorization: Bearer`, y el cliente nunca guarda el JWT: la sesión se deriva de `GET /api/auth/me`. El preview del constructor lo resuelve el backend (`POST /api/admin/curated-profiles/preview`) reusando `CuratedProfileComposer`, el mismo servicio que la ruta pública, para que no puedan divergir. El customizador aplica los tokens en el cliente y guarda solo las diferencias en `themeOverrides`. El administrador cambia su contraseña desde `/admin/cuenta`; `AdminUser.sessionVersion` y el claim `sv` del JWT revocan las demás sesiones, y `admin:bootstrap` sigue como recuperación (change `add-admin-password-change`).
- Hardening (Fase 6): `AllExceptionsFilter` global (ningún error expone stack ni detalles de la base), `GET /health` y `/health/live` fuera de `/api`, límite de peticiones global y reforzado en el login, Helmet + HTTPS por `X-Forwarded-Proto`, logs JSON con `requestId` y redacción de credenciales, y `robots.txt`/`sitemap.xml`. **En producción la API no arranca con secretos débiles** y Swagger queda cerrado salvo `ENABLE_API_DOCS=true`. Runbook: `docs/DEPLOY.md` (referencia) y `docs/DEPLOY-RAILWAY.md` (guía corta). Uso de la plataforma caso por caso: `docs/MANUAL.md`.
- Despliegue: **Railway**, tres servicios (`api`, `Postgres`, `web`) en un proyecto. El servicio `web` es un contenedor con **Caddy** que sirve la SPA y hace de **proxy** de `/api/*`, `/robots.txt` y `/sitemap.xml` hacia la API por la red privada: un solo origen, sin CORS, cookie con `SameSite=strict` y `VITE_API_URL` vacío. Las migraciones van en el `preDeployCommand`, no en el start, y por eso `prisma` y `tsx` están en `dependencies`. La configuración vive como IaC en `.railway/railway.ts` (`railway config plan` → `apply`); Config as Code está deprecado y no se usa; los secretos se declaran con `preserve()` y su valor se carga por CLI; Postgres es la 18 (igual que el CI); toda variable o ajuste se cambia en el archivo, nunca solo en el panel.

---

## Internacionalización (i18n) — datos bilingües

Los datos son **bilingües ES/EN en un solo registro** (sin duplicar). Ver `docs/I18N.md` para el diseño completo.
- Campos traducibles (`role`, `summary`, `highlights`, `headline`, `title`, `description`, `degree`, `name` de categorías, etc.) se almacenan como `Json` (LocalizedText `{es,en}` o LocalizedList `{es:[],en:[]}`).
- Campos no traducibles (empresa, tecnologías, tags, fechas, slug) son planos.
- El **function switch** central es `resolveLocale(field, locale)` / `resolveLocaleList(...)` con fallback al `DEFAULT_LOCALE='es'`. Su núcleo puro vive en `shared/domain/i18n` (usable desde domain/application); `shared/infrastructure/i18n/resolve-locale.ts` lo re-exporta y agrega `normalizeLocale` (parsing HTTP).
- Los casos de uso reciben `locale: Locale` y lo propagan a los mappers de aplicación (las entidades de dominio permanecen bilingües); los controllers lo leen con `@RequestLocale()`: `?locale=` > `?lang=` > `Accept-Language` > `es`.
- Los DTOs de salida vienen ya resueltos (strings planos); el frontend no maneja objetos localizados.
- Para agregar un idioma: extender el tipo `Locale` y agregar la clave al JSON — sin filas nuevas.

## Datos de seed

`docs/cv-data.json` contiene la trayectoria consolidada (15 experiencias, skills por categoría, educación, certificaciones, **2 proyectos destacados** y **13 plantillas de perfil curado**; con el perfil `all` de la home son 14 perfiles). Cada perfil curado tiene una taxonomía de navegación (`roleType` bilingüe + `techFocus`) que el frontend usa para agrupar el menú por tipo de rol (Tech Lead, Backend, Fullstack, DevOps, Arquitecto, Liderazgo, Generalista) mostrando la tecnología destacada. El script `backend/scripts/seed.ts` lo carga en la base. El schema incluye un modelo `Project` para los proyectos destacados.
