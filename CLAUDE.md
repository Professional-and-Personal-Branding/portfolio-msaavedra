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
6. Incrementa el contador de vistas (registrar `ProfileView`) — implementado en Fase 3: solo cuando el caso de uso recibe `viewContext` (ruta pública), de forma atómica y sin que un fallo altere la respuesta. IP solo como HMAC (`ANALYTICS_SALT`).
7. Devuelve un DTO de presentación listo para el frontend.

Este caso de uso es el corazón del producto — implementarlo con tests exhaustivos. Implementado en `backend/src/modules/curated-profile/` (servicios puros `select-by-tags`, `select-skill-categories`, `resolve-sections`; tema en `modules/theme/domain/services/merge-theme-tokens.ts`). `PRIVATE` → 404 (no revela existencia); `PROTECTED` → 401 sin token válido (`X-Access-Token` o `?token=`).

---

## Comandos esperados (definir en package.json)

```
# Backend
npm run start:dev        # NestJS en watch
npm run prisma:migrate   # prisma migrate dev
npm run prisma:generate  # prisma generate
npm run seed             # carga docs/cv-data.json
npm run seed:verify      # compara conteos DB vs cv-data.json
npm run admin:bootstrap  # crea/actualiza el administrador (ADMIN_EMAIL/ADMIN_PASSWORD/ADMIN_NAME, argon2id)
npm run openapi:export   # escribe backend/openapi.json (fuente de los tipos del frontend; sin servidor ni DB)
npm run prisma:deploy    # aplica migraciones en producción (NUNCA prisma db push)
# El backoffice vive en el frontend: http://localhost:5173/admin
npm run test             # jest

# Frontend
npm run dev              # vite (proxy /api → backend en 3300)
npm run build            # tsc -b + vite build
npm run test             # vitest
npm run api:types        # regenera src/shared/types/api.d.ts desde ../backend/openapi.json
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
- [ ] Deploy 1.0.0 — **Railway** (los tres servicios en un proyecto); configuración versionada en `backend/railway.json`, `frontend/railway.json`, `frontend/Dockerfile` y `frontend/Caddyfile`. Guía corta: `docs/DEPLOY-RAILWAY.md`; referencia completa: `docs/DEPLOY.md` § 9.5
- [x] Ronda 1.1 — 5 changes en orden, todos archivados el 2026-10-08 (`docs/ROADMAP-1.1.md` § 4):
  - [x] `unify-section-catalog` — un solo catálogo de secciones (archivado 2026-10-05)
  - [x] `add-server-rendered-head` — head SEO por perfil servido desde el servidor (archivado 2026-10-08; la verificación con LinkedIn y Slack queda para después del deploy)
  - [x] `add-curated-profile-lifecycle` — duplicar, archivar, `listed` y alias de slug (archivado 2026-10-08)
  - [x] `add-profile-content-admin` — hero, educación, certificaciones, proyectos y enlaces desde el panel (archivado 2026-10-08)
  - [x] `add-bilingual-builder-parity` — conmutador de idioma en el preview, `highlights.en` editable y aviso de faltantes de traducción (archivado 2026-10-08)
- [x] `polish-builder-and-edge` — aviso de cambios sin guardar, visita en segundo plano, CSP del sitio y `accentColor` obsoleto (etapa 1) (archivado 2026-10-09)
- [x] `retire-accent-color` — `accentColor` retirado del contrato y la base; su color pasó a `themeOverrides.colors.accent` (archivado 2026-10-09)

---

## Decisiones tomadas (no re-litigar sin motivo)

- ORM = Prisma.
- Theming basado en design tokens + CSS variables en runtime (sin rebuild al cambiar tema).
- Monolito modular (no microservicios) para el MVP.
- Dos carpetas independientes (backend / frontend); considerar monorepo (Turborepo/Nx) solo si se necesita compartir tipos intensivamente.
- Tipos del frontend: generar desde el OpenAPI del backend (openapi-typescript) para contrato único. Implementado en Fase 4: `backend/openapi.json` y `frontend/src/shared/types/api.d.ts` se versionan; un test del frontend detecta la deriva.
- Frontend (Fase 4): los tokens se aplican como `--t-*` en un contenedor raíz (no en `documentElement`); Tailwind 4 los expone con `@theme inline` (`bg-bg`, `bg-brand`, `rounded-theme`, …) y las variables de shadcn/ui derivan de ellos. Idioma, preset, layout y token viven en la URL (`?lang= ?theme= ?layout= ?token=`), sin `localStorage`. La home es el perfil curado `all`. El catálogo de secciones (9 ids) vive solo en el dominio del backend y viaja como enum `SectionId` del OpenAPI; el backend aplica orden, ocultado y relleno (las secciones con datos que no figuran en `sectionsOrder` van al final) y el cliente renderiza `sections` tal cual (change `unify-section-catalog`).
- Backoffice (Fase 5): panel en `/admin` dentro del mismo frontend, en un chunk aparte (`React.lazy`). La sesión es una **cookie httpOnly** (`portfolio_session`) que emite el login; el guard acepta cookie o `Authorization: Bearer`, y el cliente nunca guarda el JWT: la sesión se deriva de `GET /api/auth/me`. El preview del constructor lo resuelve el backend (`POST /api/admin/curated-profiles/preview`) reusando `CuratedProfileComposer`, el mismo servicio que la ruta pública, para que no puedan divergir. El customizador aplica los tokens en el cliente y guarda solo las diferencias en `themeOverrides`.
- Hardening (Fase 6): `AllExceptionsFilter` global (ningún error expone stack ni detalles de la base), `GET /health` y `/health/live` fuera de `/api`, límite de peticiones global y reforzado en el login, Helmet + HTTPS por `X-Forwarded-Proto`, logs JSON con `requestId` y redacción de credenciales, y `robots.txt`/`sitemap.xml`. **En producción la API no arranca con secretos débiles** y Swagger queda cerrado salvo `ENABLE_API_DOCS=true`. Runbook: `docs/DEPLOY.md` (referencia) y `docs/DEPLOY-RAILWAY.md` (guía corta). Uso de la plataforma caso por caso: `docs/MANUAL.md`.
- Despliegue: **Railway**, tres servicios (`api`, `Postgres`, `web`) en un proyecto. El servicio `web` es un contenedor con **Caddy** que sirve la SPA y hace de **proxy** de `/api/*`, `/robots.txt` y `/sitemap.xml` hacia la API por la red privada: un solo origen, sin CORS, cookie con `SameSite=strict` y `VITE_API_URL` vacío. Las migraciones van en el `preDeployCommand`, no en el start, y por eso `prisma` y `tsx` están en `dependencies`.

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

`docs/cv-data.json` contiene la trayectoria consolidada (14 experiencias, skills por categoría, educación, certificaciones, **2 proyectos destacados** y **13 plantillas de perfil curado**). Cada perfil curado tiene una taxonomía de navegación (`roleType` bilingüe + `techFocus`) que el frontend usa para agrupar el menú por tipo de rol (Tech Lead, Backend, Fullstack, DevOps, Arquitecto, Liderazgo, Generalista) mostrando la tecnología destacada. El script `backend/scripts/seed.ts` lo carga en la base. El schema incluye un modelo `Project` para los proyectos destacados.
