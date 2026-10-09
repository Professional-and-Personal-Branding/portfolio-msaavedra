# CHANGELOG — Datos del Portafolio

## Update — Octubre 2026 (ronda 1.1 — `retire-accent-color`)

Segunda etapa de la decisión D9 de `polish-builder-and-edge`: `accentColor` deja de existir en todas las capas. El owner eligió **P1 = B**, así que los colores no se pierden: pasan al tema.

- **Primera migración destructiva del proyecto** (`retire_accent_color`, escrita a mano): copia el `accentColor` de cada perfil a `themeOverrides.colors.accent` (un `colors.accent` que ya existía no se pisa) y después borra la columna. Es idempotente y se aplica con `prisma migrate deploy` (en Railway, desde el `preDeployCommand`); sobre una base vacía no toca filas. La base de desarrollo del owner se migró primero, con respaldo previo, ensayo y rollback probado en una copia (evidencia en `openspec/changes/retire-accent-color/verification.md`).
- **Cambio visible:** los 13 perfiles de las plantillas dejan de verse con el `#38bdf8` del preset y pasan a su acento propio. Varios contrastan poco con el fondo `#0a0e1a` de `modern-dark` (8 de 13 quedan por debajo de 3:1): riesgo aceptado por el owner, se corrige desde el customizador.
- **Contrato (BREAKING, sin clientes afectados):** `accentColor` sale de los DTO de entrada y de las cuatro respuestas del perfil curado; un cuerpo que lo traiga responde 400. Se regeneran `openapi.json` y `api.d.ts`.
- **Dominio y frontend:** sale la regla hex y `HEX_COLOR_REGEX`; desaparecen los tipos `*Wire` y sus casts.
- **Seed:** `docs/cv-data.json` guarda el color de cada plantilla como `themeOverrides.colors.accent`, y `seed:verify` lo comprueba.
- Verificado: 529 unitarios, 168 e2e y 243 del frontend.

## Update — Octubre 2026 (ronda 1.1, change 4 — `add-profile-content-admin`)

Mergeado en PR #9 y archivado en `openspec/changes/archive/2026-10-08-add-profile-content-admin/`, con sus specs sincronizadas. Ahora el portafolio se administra desde el panel donde más se ve: hasta este change, el hero, la formación, los proyectos y los enlaces solo se cambiaban por seed o SQL.

- **Perfil base**: `GET` y `PUT /api/admin/profile` (titular, resumen, contacto y disponibilidad, bilingües), con la página `/admin/portada`, que previsualiza el hero antes de guardar.
- **CRUD** de idiomas, enlaces sociales, educación, certificaciones y proyectos, con la plantilla de capas de `admin-experience-crud`. Páginas `/admin/formacion` y `/admin/proyectos`.
- **Analítica por origen**: el agregado suma `byReferrer`, con el origen normalizado a su dominio y lo vacío agrupado como "directo". Lee lo que ya estaba guardado, sin capturar nada nuevo. El dashboard lo muestra en una tabla.
- Un perfil curado puede dejar el titular vacío y heredar el del perfil base.
- Sin migración: todos los campos ya existían. Verificado: 420 unitarios, 140 e2e y 153 del frontend.

## Update — Octubre 2026 (ronda 1.1, changes 2 y 3 — `add-server-rendered-head` y `add-curated-profile-lifecycle`)

Mergeados en PR #7 y #8, más la corrección de #11 sobre el head. Archivados en `openspec/changes/archive/2026-10-08-*`, con sus specs sincronizadas.

### Change 2 — el link compartido dice quién es Manuel
- `GET /api/public/profile-head?slug=&lang=` devuelve el fragmento de `<head>` de cada perfil (title, description, canonical, Open Graph, Twitter, robots y JSON-LD). Siempre responde 200 y lo arma el mismo composer de la ruta pública. Los perfiles no públicos dan el genérico con `noindex`.
- Caddy procesa `index.html` con `templates` y lo inserta con `httpInclude`. Si la API falla o tarda más de 500 ms, el sitio sirve el head de fallback (#11 cubrió también los 4xx/5xx). El fragmento de cada perfil público se cachea un minuto.
- `og:image` pasa a ser un PNG de 1200×630 en lugar del SVG. El cliente reutiliza las etiquetas del servidor en lugar de duplicarlas.
- Pendiente: la verificación con LinkedIn y Slack, que necesita el sitio desplegado (`docs/RELEASE-1.0.0-CHECKLIST.md`).

### Change 3 — duplicar, archivar, enumerar y renombrar
- Tres ejes disjuntos: `visibility` (quién puede abrirlo), `archivedAt` (si sigue vivo: archivado da 404, siempre) y `listed` (si se enumera). La decisión de acceso está en una sola función, `resolvability`, con la tabla de verdad de doce casos.
- Duplicar (`POST …/{id}/duplicate`): la copia nace privada y no enumerada. Archivar y desarchivar con endpoints propios: se conservan las visitas.
- Alias de slug: renombrar no rompe los links ya enviados. El menú de perfiles solo aparece en la home.
- Primera migración incremental, aditiva: `20261005201934_curated_profile_lifecycle`.

## Update — Octubre 2026 (ronda 1.1, change 1 — `unify-section-catalog`; CI)

Primer change de la ronda 1.1 (`docs/ROADMAP-1.1.md` § 4), mergeado en PR #4 y archivado en `openspec/changes/archive/2026-10-05-unify-section-catalog/`. Antes, en PR #2, se agregó el CI.

### Catálogo de secciones
- **Una sola fuente de verdad**: `SECTION_IDS` en el dominio del backend, con 9 ids en orden canónico (`hero, stats, experience, skills, projects, education, certifications, presence, contact`). Viaja al cliente como enum `SectionId` del OpenAPI. Antes el backend declaraba 7 y el frontend 9.
- **El backend decide el orden final**: el composer aplica el orden, el ocultado y el relleno (las secciones con datos que no figuran en `sectionsOrder` van al final) y descarta las vacías. El frontend renderiza `sections` tal cual llega; desaparecen `orderSections` y `hasData` del cliente.
- **Validación**: un id fuera del catálogo en `sectionsOrder` o `sectionsHidden` responde 400 nombrando el id, al crear, al editar y en el preview.
- **Contrato que compila**: el registro de componentes del frontend es `Record<SectionId, …>`; si el backend agrega una sección y el cliente no la implementa, el build falla.
- **Seed**: las plantillas y `all` usan `SECTION_IDS`. Visiblemente se ven las mismas secciones; `projects` y `presence` pasan del final a su lugar canónico.
- Specs sincronizadas: `curated-profile-resolution` (requisito nuevo *Catálogo canónico de secciones*; *Secciones ordenadas y ocultas* reescrito), `layout-engine` y `admin-curated-profile-crud` (*Validación de ids de sección*).

### CI (`.github/workflows/ci.yml`)
- En cada push y PR a `main`: backend (lint, typecheck, unitarios, build y control de que `openapi.json` siga al día), backend e2e contra Postgres 16 con `prisma migrate deploy` y seed, y frontend (lint, tests y build). Cierra el ítem CI/CD del checklist 1.0.x.
- `asyncUtilTimeout` de Testing Library a 5 s: las pantallas lazy del backoffice fallaban al azar con el segundo por defecto.

## Update — Octubre 2026 (defectos D-01 y D-02 de la suite de regresión manual)

Los dos defectos que encontró la primera ejecución completa de la suite (`docs/MANUAL.md` § 6.1, 5 de octubre de 2026). Corregidos en PR #1; PR #3 agrega la cobertura de punta a punta y una guardia general.

### D-01 — El dashboard no mostraba las visitas de hoy
- `GET /api/admin/analytics/views`: el rango `from`/`to` es **cerrado**. Una fecha sin hora se resuelve al borde de su día en UTC —inicio para `from`, último milisegundo para `to`— en `range-boundaries.ts`; un instante completo se respeta tal cual, para consultar ventanas de horas. Antes `to=<fecha>` caía en la medianoche inicial y el panel, que manda `to=<hoy>`, nunca contaba el día en curso.
- Spec `profile-view-analytics`: requisito nuevo *El rango de fechas es cerrado*. Tests unitarios de los bordes y e2e del día en curso.

### D-02 — Omitir un objeto obligatorio respondía 500
- `@IsDefined()` en los campos bilingües obligatorios: `role` y `summary` de experiencias, `title` y `headline` de perfiles curados y `name` de categorías de skills. Ahora responden 400, como ya exigían `api-platform` y las specs de CRUD. Los `PATCH` parciales no cambian: `PartialType` anula el `@IsDefined()`.
- `backend/test/dto-validation.spec.ts`: por cada DTO de entrada listado, un cuerpo sin cada campo obligatorio, o con él en `null`, falla la validación.
- `backend/test/security.spec.ts` (PR #3): guardia sobre los metadatos de `class-validator` de **toda** clase validada en `src/`; un `@ValidateNested()` sin `@IsOptional()` debe llevar `@IsDefined()`. Cubre los DTO que todavía no están en la lista anterior.
- `backend/test/admin.e2e-spec.ts` (PR #3): las seis omisiones por HTTP responden 400 con el campo en el mensaje, sin crear nada.

## Update — Septiembre 2026 (Fase 6 — change OpenSpec `add-production-hardening`)

Hardening para el release 1.0.0 (propuesta aprobada por Human Gate, commit `33029cc`). Cierra los 6 bloqueantes del checklist y 5 de los 6 importantes; el sexto (backups) no es código.

### Backend (`backend/`)
- `AllExceptionsFilter` global: todo error sale como `{ statusCode, message, error, requestId, timestamp }`, sin stack traces, SQL ni códigos de Prisma; el detalle va al log.
- `GET /health` (200 / 503 según la base, con timeout de 2 s) y `GET /health/live`, fuera del prefijo `/api`, sin autenticación y exentos del rate limiting.
- Arranque seguro: con `NODE_ENV=production` la API no levanta con el `JWT_SECRET` de ejemplo, con menos de 32 caracteres, con `ANALYTICS_SALT` repetida o con `FRONTEND_URL` sin https. Swagger solo se publica con `ENABLE_API_DOCS=true`.
- Rate limiting: global por IP (`@nestjs/throttler`) y un guard propio para el login con 429 y `Retry-After`.
- Helmet ajustado a una API JSON, HSTS y redirección 301 a https por `X-Forwarded-Proto` en producción, `SESSION_COOKIE_SAMESITE` configurable (`none` fuerza `Secure`).
- Logs estructurados con pino: JSON en producción, `LOG_LEVEL`, `requestId` por petición (cabecera, cuerpo de error y log) y redacción de credenciales; el `?token=` de los perfiles protegidos se censura.
- `GET /robots.txt` y `GET /sitemap.xml` con los perfiles `PUBLIC` sobre `FRONTEND_URL`.
- Scripts: `prisma:deploy`. Variables nuevas documentadas en `.env.example`.

### Frontend (`frontend/`)
- Metadatos por perfil y por idioma: título, descripción, canonical, OpenGraph, Twitter Card y JSON-LD `Person`; `noindex` en perfiles no públicos y en `/admin`. `index.html` trae metadatos base para rastreadores sin JavaScript.

### Documentación
- **`docs/DEPLOY.md` (nuevo)**: runbook de producción con variables por entorno, generación de secretos, orden de arranque, healthcheck del proveedor, verificación posterior, rollback y backups con su prueba de restauración.
- `docs/RELEASE-1.0.0-CHECKLIST.md` reescrito con el estado real de los 18 ítems.

### Datos
- Sin cambios en `cv-data.json` ni en el schema.

## Update — Septiembre 2026 (Fase 5 — change OpenSpec `add-admin-backoffice`)

Backoffice visual bajo SDD (propuesta aprobada por Human Gate, commit `379bf46`).

### Backend (`backend/`)
- Sesión del panel por cookie `httpOnly` (`portfolio_session`): la emite `POST /api/auth/login`, la borra `POST /api/auth/logout` y el guard acepta cookie o `Authorization: Bearer`. CORS con `credentials`.
- `POST /api/admin/curated-profiles/preview`: resuelve un perfil curado en borrador sin persistir ni registrar visitas, con el mismo cuerpo que la ruta pública. Para lograrlo se extrajo `CuratedProfileComposer` (pasos 3-5 y 7 del núcleo) de `ResolveCuratedProfileUseCase`, que ahora conserva visibilidad, token y registro de visita.
- `GET /api/admin/themes`: catálogo de temas para el customizador (`findAll()` en `ThemeRepository`).
- Contrato: `endDate`, `techFocus`, `themeId` y `accessToken` se declaraban como `object` en OpenAPI por un `@ApiPropertyOptional({ nullable: true })` sin `type`; ahora son `string`.

### Frontend (`frontend/`)
- Panel `/admin` en un chunk aparte (`React.lazy`): login, dashboard, experiencias, skills, perfiles curados.
- Dashboard de visitas con rango de fechas y gráficos propios (sin librería de charts).
- CRUD visual con campos bilingües (`LocalizedField`), listas de chips (`ChipListField`), confirmaciones y avisos (`sonner`).
- Constructor con preview en vivo (retardo de 400 ms, tokens del tema fuera de la clave), selección por tags del universo real, include/exclude por experiencia, orden y ocultamiento de secciones, visibilidad, token y link público con copiar y abrir.
- Customizador de tema en tiempo real: 8 colores con selector y hexadecimal, tipografía, modo, densidad y radio; guarda solo las diferencias contra el tema base.
- Tests: 118 en el frontend (eran 56) y 182 + 91 en el backend (eran 168 + 73).

### Datos
- Sin cambios en `cv-data.json` ni en el schema. El perfil `verificacion-fase5`, creado durante la verificación, se borró al terminar.

## Update — Septiembre 2026 (Fase 4 — change OpenSpec `add-public-frontend-theming`)

Frontend público + motor de theming bajo SDD (propuesta aprobada por Human Gate, commit `62a49d6`).

### Backend (`backend/`)
- Script `npm run openapi:export` (`scripts/export-openapi.ts`): escribe `backend/openapi.json` con el mismo documento de `/api/docs-json`, sin abrir puerto ni conectar a la base; `swagger.ts` expone `buildOpenApiDocument`. `openapi.json` se versiona.

### Frontend (`frontend/`, nuevo)
- SPA React 19 + Vite 8 + TypeScript 5.9 estricto + Tailwind 4 + shadcn/ui + Motion + TanStack Query + react-router 8 + Zustand + Zod. Tipos generados con `openapi-typescript` (`npm run api:types` → `src/shared/types/api.d.ts`, versionado, test de deriva por hash) y cliente `openapi-fetch`.
- Motor de theming: `ThemeTokens` (zod) compatible con `Theme.tokens` del seed, 5 presets, `tokensToCssVars` → `--t-*` aplicadas por `ThemeProvider` en el contenedor raíz; Tailwind `@theme inline` y variables de shadcn derivadas. Selector de presets (`?theme=`), modo, densidad, radio, tipografía y animaciones (respeta `prefers-reduced-motion`).
- Layouts `classic` y `sidebar` (`?layout=`), orden de secciones de la API + conocidas faltantes al final, ocultas/vacías omitidas, `stats` derivadas.
- Home = perfil curado `all`; `/:slug`; menú agrupado por `roleType` (dropdown/panel lateral); estados de carga, error con reintento, 404 propia y formulario de token para PROTECTED (`X-Access-Token`, `?token=`).
- Bilingüe: `?lang=` > `navigator.language`; diccionario `es`/`en` con fallback; toda petición envía `?locale=`.
- Tests Vitest (12 archivos, 56 tests) con Testing Library + MSW; verificación visual con capturas en `openspec/changes/archive/…/verification/`.

### Datos
- Sin cambios en `cv-data.json` ni en el schema. Nota: el perfil `all` no tiene `roleType`; el menú lo muestra como grupo "Perfil completo".

## Update — Septiembre 2026 (change OpenSpec `add-portfolio-sections-api`, previo a Fase 4)

Cierra el hueco de datos para el frontend público (propuesta aprobada por Human Gate, commit `145d4df`).

### Backend (`backend/`)
- Módulos mínimos `education` (educación + certificaciones), `project` y `social-link`: entidades, puertos de lectura, adaptadores Prisma, casos de uso y endpoints `GET /api/education`, `/api/certifications`, `/api/projects`, `/api/social-links` (solo visibles, orden `order`, locale negociado).
- La vista curada agrega `projects` (filtrados por tags + overrides, mismo espacio de ids), `education`, `certifications` y `socialLinks`; `PortfolioSectionsLoader` agrupa las cuatro lecturas.
- Specs: nueva `public-portfolio-sections-api`; `curated-profile-resolution` con la regla de proyectos y la forma completa ampliada.

## Update — Septiembre 2026 (Fase 3 — change OpenSpec `add-auth-and-crud`)

Backoffice API bajo SDD (propuesta aprobada por Human Gate, commit `31cdbe7`).

### Backend (`backend/`)
- Módulo `auth`: `LoginUseCase` con puertos `PasswordHasher` (argon2id) y `TokenSigner` (JWT HS256 vía `@nestjs/jwt` 11 + Passport); `JwtAuthGuard` en todo `/api/admin/*`; `GET /api/auth/me`; `npm run admin:bootstrap`.
- CRUD de experiencias, categorías/skills y perfiles curados con DTOs bilingües `{ es, en? }`, `PATCH` parcial, reglas de dominio (`validateExperience`, `validateCuratedProfile`), `ValidationError` → 400 y `ConflictError` → 409. Campos desconocidos → 400 en rutas con cuerpo (pipe estricto por controller; el global solo transforma).
- Módulo `analytics`: `ProfileView` registrado en cada resolución pública exitosa (transacción `create` + `views++`, IP solo como HMAC-SHA256) y `GET /api/admin/analytics/views` (total, por perfil, por idioma, por día).
- Config: `JWT_SECRET` (min 16), `JWT_EXPIRES_IN`, `ANALYTICS_SALT`; CORS con `POST/PATCH/DELETE` y `Authorization`.
- Tests: 157 unitarios + 65 e2e (auth, backoffice, Fase 1 y 2).

### Docs sincronizadas
- `CLAUDE.md`: checkbox Fase 3; paso 6 del núcleo implementado; comando `admin:bootstrap`.
- `ARCHITECTURE.md` §6/§7: rutas admin reales y Fase 3 marcada.
- `DATA-POPULATION.md`: el seed convive con la edición por API y preserva `AdminUser`.
- `backend/.env.example`: `ADMIN_NAME`, `ANALYTICS_SALT`, notas de `JWT_SECRET`.

## Update — Septiembre 2026 (Fase 2 — change OpenSpec `add-curated-profile-resolution`)

Núcleo del producto implementado bajo SDD (propuesta aprobada por Human Gate, commit `67ea1a9`).

### Backend (`backend/`)
- Módulo `curated-profile`: `ResolveCuratedProfileUseCase(slug, locale, accessToken?)` y `ListCuratedProfilesUseCase`; servicios de dominio puros `select-by-tags` (intersección + overrides), `select-skill-categories`, `resolve-sections`; value object `AccessToken` (comparación en tiempo constante).
- Módulos mínimos `skill` y `theme` (dominio + puerto + adaptador Prisma); `merge-theme-tokens` (merge profundo inmutable de `themeOverrides`); preset por defecto `modern-dark`.
- Endpoints `GET /api/curated-profiles` (solo PUBLIC) y `GET /api/curated-profiles/:slug` (404 PRIVATE/inexistente, 401 PROTECTED sin token vía `X-Access-Token` o `?token=`).
- **Orden canónico de experiencias pasa a cronológico** (`startDate` desc, `order` asc como desempate) en toda la API, incluido `GET /api/experiences` (decisión D1, aprobada). Motivo: los datos reales tenían 2 casos donde `order` no era cronológico.
- `AccessDeniedError` en shared + mapeo a 401. `ProfileModule`/`ExperienceModule` exportan sus puertos.
- Tests: 117 unitarios (incluye arquitectura) + 43 e2e.

### Docs sincronizadas
- `CLAUDE.md`: checkbox Fase 2; § núcleo actualizado (orden canónico, `ProfileView` en Fase 3, visibilidad).
- `ARCHITECTURE.md` §6/§7: rutas de Fase 2 marcadas; endpoint `access` descartado.
- `DATA-POPULATION.md`: overrides no viven en el JSON; orden cronológico.
- `openspec/specs/public-experience-api`: requisito de orden modificado.

## Update — Septiembre 2026 (Fase 1 — change OpenSpec `add-backend-base`)

Primer change de código bajo disciplina SDD con OpenSpec (`openspec/`), aprobado por Human Gate antes de implementar.

### Backend (`backend/`)
- Proyecto NestJS 11.2 + Prisma 6.19 con TypeScript estricto, ESLint/Prettier, Jest.
- Migración inicial versionada `prisma/migrations/20260906055928_init` (14 tablas) generada con `migrate dev`; sin `db push`.
- Seed operativo e idempotente desde `docs/cv-data.json` + `npm run seed:verify` (conteos calculados en runtime desde el JSON).
- Módulos de referencia `profile` y `experience` en Clean Architecture (domain/application/infrastructure) con `Result<T,E>`, puertos + tokens Symbol, adaptadores Prisma, casos de uso con tests mock.
- Endpoints públicos `GET /api/profile`, `GET /api/experiences`, `GET /api/experiences/:id`; Swagger en `/api/docs`, OpenAPI en `/api/docs-json`.
- i18n: núcleo puro reubicado a `shared/domain/i18n` (la ruta `shared/infrastructure/i18n/resolve-locale.ts` queda como fachada + `normalizeLocale`). Negociación `?locale=` > `?lang=` > `Accept-Language` > `es`, header `Content-Language`.
- Tests: 56 unitarios (incluye test de arquitectura de la regla de dependencia) + 26 e2e.

### Docs sincronizadas
- `SPECS-POR-FASE.md`: el criterio de seed refleja los conteos reales (15 experiencias; 13 plantillas + `all` = 14 perfiles curados).
- `ARCHITECTURE.md` §6: rutas públicas planas bajo `/api` (superan el borrador `/api/public/*`); Fase 1 marcada.
- `I18N.md` §4/§9: ubicación del núcleo i18n y precedencia de locale.
- `KICKOFF-ClaudeCode.md`: el paquete npm de OpenSpec es `@fission-ai/openspec`.
- `CLAUDE.md` / `README.md`: checkbox Fase 1.

## Update — Junio 2026 (plantilla de specs por fase para SDD)

Añadido `docs/SPECS-POR-FASE.md`: una especificación ejecutable por cada una de las 6 fases (objetivo, alcance, fuera de alcance, criterios de aceptación verificables y prompt de arranque para Claude Code). Formaliza el flujo de Spec-Driven Development: especificar → planificar → implementar → verificar, una fase a la vez. Referenciado desde ARCHITECTURE.md y CLAUDE.md.

## Update — Junio 2026 (checklist de release 1.0.0)

Añadido `docs/RELEASE-1.0.0-CHECKLIST.md`: guía de hardening para producción priorizada en bloqueantes (secretos, migraciones, CORS, validación, manejo de errores, healthcheck), importantes (rate limiting, Helmet, logging, tests mínimos, SEO, backup DB) y deseables (export PDF, a11y, caché, analítica, CI/CD, repos destacados). La "Fase 6 — Pulido" de `ARCHITECTURE.md` se reescribió como "Fase 6 — Hardening para producción" y apunta a este checklist. El deploy real queda como último paso, tras cerrar bloqueantes e importantes.

## Update — Mayo 2026 (taxonomía de navegación + perfiles Tech Lead .NET y Generalista)

Enriquecidas experiencias recientes y añadida una taxonomía de navegación para agrupar los perfiles curados por tipo de rol y tecnología.

### Taxonomía de navegación (nuevo)
Cada perfil curado ahora tiene dos campos para el menú:
- **`roleType`** (LocalizedText) — categoría de rol: Tech Lead, Backend, Fullstack, DevOps, Arquitecto, Liderazgo, Generalista.
- **`techFocus`** (string) — tecnología destacada: .NET, Java, Node / React, Azure, etc.

El menú de navegación se agrupa por `roleType` y muestra el `techFocus` como subtítulo de cada perfil. En `schema.prisma`, `CuratedProfile` gana `roleType` (Json) y `techFocus` (String).

### Perfiles curados: 11 → 13
Añadidos:
- **tech-lead-dotnet** — Tech Lead · .NET · Modernización Legacy. Acento `#5B2C87`. filterTags: leadership, dotnet, microservices, migration, microsoft, integration, fullstack.
- **generalist-polyglot** — Senior Software Engineer (Generalista) · Polyglot. Acento `#0F766E`. filterTags amplios (java, dotnet, nodejs, fullstack, microservices, cloud, fintech, leadership) — pensado para recruiters con búsquedas abiertas.

### Experiencias enriquecidas (bilingüe ES/EN)
- **K27** → rol "Líder Técnico de Desarrollo": liderazgo de equipo, migración .NET/React, PoC de Kubernetes para banca. Tags nuevos: leadership, fullstack, migration, banking.
- **Tul** → rol "Software Technical Lead · DevOps": separación explícita LT + ingeniería DevOps. Tag nuevo: devops.
- **NEXTGO** → rol "Software Technical Lead · DevOps": LT + IaC/CI-CD destacado.
- **Banco Ganadero** → rol "Fullstack Developer · Encargado de Proyecto": diseño/desarrollo/puesta en producción de GanaSafi (ahorro e inversión) + liderazgo de proyecto con 3 personas. Tag nuevo: leadership.

---

## Update — Mayo 2026 (LinkedIn agregado a la presencia pública)

Sumado LinkedIn como tercer canal de presencia pública, completando el tríptico profesional.

### `cv-data.json`
- Nueva entrada en `profile.socialLinks`: **linkedin** con URL pública verificada (`/in/manuel-joaquin-saavedra-severiche-266a4b125`), `featured: true`.
- Descripción bilingüe basada en el headline público real del perfil ("Senior Full-Stack Software Architect | Senior Tech Lead | Senior Fullstack Developer").

### Demo principal (`demo.html`)
- Reorganización de la sección "Presencia Pública" para acomodar tres enlaces sin amontonar.
- Layout actualizado: **dos tarjetas hero arriba** (GitHub + LinkedIn, grid 1:1) y **YouTube como banda inferior full-width**.
- Nuevo variant CSS `.presence-card--strip` para el formato banda de YouTube.
- Color de marca LinkedIn (`#0a66c2`) aplicado al ícono con clase `.presence-icon--li`.
- Title de sección actualizado: "Código, Red Profesional y Comunidad".

### Decisión de diseño
- **GitHub y LinkedIn como protagonistas duales** — GitHub representa el código y la práctica técnica abierta; LinkedIn representa la trayectoria profesional y el canal de contacto formal. Ambos cumplen funciones complementarias críticas para un perfil senior buscando oportunidades.
- **YouTube se mantiene discreto** — el banda inferior reduce su peso visual sin esconderlo.
- **Sin scraping de LinkedIn** — la descripción se basa solo en el headline público que aparece en resultados de búsqueda (verificado), no en contenido scrapeable del perfil.

---

## Update — Mayo 2026 (presencia pública: GitHub + YouTube)

Añadida la sección de presencia pública al MVP, con GitHub como protagonista visual y YouTube como acompañante discreto.

### Nuevos modelos en `schema.prisma`
- **`SocialLink`** — enlaces a redes (platform, handle, url, label, description, stats, featured, visible).
- **`FeaturedRepository`** — curaduría manual de repos destacados (NO un dump del API de GitHub).

### `cv-data.json` extendido
- `profile.socialLinks` → 2 entradas (github + youtube) con descripción bilingüe honesta.
- `profile.featuredRepositories` → placeholder con `visible: false` esperando curaduría manual de Manuel sobre cuáles repos profesionales destacar (los visibles en su perfil GitHub son mayoritariamente académicos UPSA).

### Demo principal (`demo.html`)
- Nueva sección "Presencia Pública · Código y Comunidad" entre Skills y Footer.
- Tarjeta GitHub grande (protagonista) con icono SVG, handle, descripción narrativa, stats (67 repos, 10+ años activo) y badges (Pull Shark, Arctic Code Vault).
- Tarjeta YouTube lateral discreta con descripción honesta de "contenido mixto técnico".

### Decisiones de diseño documentadas
- **GitHub protagonista, YouTube discreto** (decisión de Manuel).
- **Sin scraping automático de GitHub:** la lista de repos destacados se cura manualmente para evitar mostrar repos universitarios antiguos que diluyen el mensaje profesional.
- **YouTube descrito de forma honesta:** "contenido mixto técnico" sin inventar temáticas que no se pudieron verificar (RSS bloqueado al scraping).

---

## Update — Mayo 2026 (perfil Backend Payments / Ruby on Rails)

Añadido un perfil curado para vacantes de backend de pagos con Ruby on Rails.

### Perfiles curados: 10 → 11
Añadido:
- **backend-payments-ror** — Ingeniero Backend de Pagos · Fintech · Ruby on Rails (en formación). Acento ruby `#9B1C2E`. filterTags: `payments, fintech, banking, ruby, messaging, integration`. Resuelve 7 experiencias (Ensitech, Eron/Directa24, Tul, Banco Ganadero, SCVS, NSoft, Delta Cargo).

### Tags nuevos en experiencias
- `payments` — añadido a Ensitech, Eron/Directa24, Banco Ganadero.
- `ruby` — añadido a Ensitech (refleja formación autodidacta en Ruby/Rails, posicionada con honestidad).

### Nota de posicionamiento
Este perfil encarna el criterio de honestidad aplicado en el CV correspondiente: lidera con la fortaleza real (backend de pagos, fintech, ISO 8583, TDD, SQL avanzado, event-driven) y declara Ruby on Rails como formación en curso, sin inflar. Las equivalencias técnicas (JUnit↔RSpec, BigQuery↔Snowflake, Grafana↔Datadog) se marcan como tales, nunca como la herramienta exacta.

---

## Refactor — Mayo 2026 (post-CVs adicionales)

Actualización de los datos consolidados para reflejar los CVs generados después del scaffold inicial.

### Perfiles curados (profileTemplates): 6 → 10
Añadidos:
- **ai-software-engineer** — Hybrid AI coding (Claude Code, Cursor, MCP), full-stack TS/Python. Acento violeta `#6D28D9`.
- **fullstack-microsoft** — Ecosistema Microsoft end-to-end: .NET, SQL Server, reporting, modernización legacy. Acento `#0078D4`.
- **devops-azure** — DevOps con Azure al frente: Azure DevOps, Terraform, K8s, incident management. Acento `#0078D4`.
- **software-architect** — Arquitectura de software: microservicios, patrones, alto rendimiento. Acento `#1E293B`.

### Tags nuevos en experiencias
- `ai-engineer` — añadido a Ensitech, K27, Tul (donde se usó IA en el flujo).
- `microsoft` — añadido a Ensitech, K27, Delta Cargo, YPFB, NSoft, Banco Ganadero.
- `python` — añadido a Ensitech.
- `azure` — reforzado en K27, Ensitech.
- `fullstack` / `nodejs` — reforzados donde correspondía (Vidoomy, Tul, Banco Ganadero).

### Nueva sección: projects
- **portfolio-web** — el propio portafolio (NestJS + React + Prisma, construido con Claude Code).
- **erp-awa** — ERP AWA de NSoft (de cero a producción).

### Schema
- Nuevo modelo `Project` (name, role, period, summary, technologies, tags, url, order, visible).

### Seed
- Carga de `projects` añadida.
- Heurística de tags por categoría de skill ampliada con `ai-engineer`, `microsoft`, `python`, `azure`.

### Resolución verificada (experiencias / proyectos que matchean por perfil)
```
java-senior-backend      → 11 exp, 1 proy
fullstack-nest-react     → 13 exp, 2 proy
devops-platform          →  8 exp, 0 proy
dotnet-backend           →  7 exp, 1 proy
it-leadership            →  6 exp, 1 proy
integration-architect    →  7 exp, 0 proy
ai-software-engineer     →  9 exp, 1 proy
fullstack-microsoft      →  7 exp, 1 proy
devops-azure             → 10 exp, 1 proy
software-architect       → 12 exp, 1 proy
```
