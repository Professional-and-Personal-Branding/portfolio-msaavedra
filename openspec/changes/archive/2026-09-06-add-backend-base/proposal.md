# add-backend-base — Fase 1: Backend base

> Materializa la **Fase 1** de `docs/SPECS-POR-FASE.md` (objetivo, alcance y criterios de aceptación viven allí; este documento no los duplica). Contrato de arquitectura: `CLAUDE.md`.

## Why

La Fase 0 dejó el andamiaje (schema Prisma, `seed.ts`, motor i18n, docs) pero **no existe código de aplicación**: nada arranca, la base no tiene tablas ni datos y ningún endpoint sirve el perfil. Sin este cimiento no se puede construir el núcleo del producto (`curated-profile`, Fase 2). Además, `profile` y `experience` deben quedar como **módulo de referencia** en Clean Architecture: la plantilla que copiarán skill, education, curated-profile y auth.

## What Changes

- **Proyecto NestJS 11.x en `backend/`** con TypeScript estricto, ESLint + Prettier, Jest, configuración por variables de entorno validada al arranque (fail-fast), prefijo global `/api`, `ValidationPipe` global y CORS acotado a `FRONTEND_URL`.
- **Prisma 6.x integrado** con el `schema.prisma` existente (sin cambios de modelo): `PrismaService` en `shared/infrastructure/persistence`, **migración inicial versionada** `init` generada con `prisma migrate dev` (nunca `db push`), y `prisma.seed` apuntando a `scripts/seed.ts`.
- **Seed operativo** cargando `docs/cv-data.json` completo e idempotente: 1 perfil (+2 idiomas), 15 experiencias, 12 categorías / 108 skills, 6 registros de educación, 8 certificaciones, 2 proyectos, 3 enlaces sociales, 5 temas preset, 14 perfiles curados (13 plantillas + `all`).
- **Base compartida (`shared/`)**: `Result<T,E>`, `DomainError` base y errores `NotFound`; el **núcleo puro de i18n** (`Locale`, `LocalizedText`, `resolveLocale`, `resolveLocaleList`, `DEFAULT_LOCALE`) se reubica a `shared/domain/i18n` para que domain/application puedan usarlo sin violar la regla de dependencia; `shared/infrastructure/i18n/resolve-locale.ts` se conserva como re-export + `normalizeLocale` (la ruta citada en CLAUDE.md sigue vigente y el comportamiento de fallback no cambia).
- **Módulo `profile`** (4 capas): entidad `Profile` con `Language` y `Availability`, puerto `ProfileRepository`, `GetProfileUseCase`, adaptador Prisma, controller `GET /api/profile`.
- **Módulo `experience`** (4 capas): entidad `Experience`, puerto `ExperienceRepository`, `ListExperiencesUseCase` y `GetExperienceByIdUseCase`, adaptador Prisma, controllers `GET /api/experiences` y `GET /api/experiences/:id`.
- **Negociación de idioma** en la capa HTTP: `?locale=` (criterio de aceptación) > `?lang=` (CLAUDE.md / I18N.md) > `Accept-Language` > `es`. Las respuestas salen ya resueltas (strings planos) y con header `Content-Language`.
- **Swagger/OpenAPI** en `/api/docs` (UI) y `/api/docs-json` (contrato para generar tipos del frontend en Fase 4).
- **Tests**: unitarios de casos de uso con repositorios mock, unitarios del fallback i18n, test de arquitectura (sin `@prisma/client` ni `@nestjs/*` en domain; sin Prisma en application), e2e de los endpoints contra la base seedeada y script `seed:verify` de conteos.
- **Documentación**: `backend/README.md` con comandos y guía de verificación de los criterios de la Fase 1.

### Non-goals

- Perfiles curados (`curated-profile`, Fase 2), auth/JWT y CRUD (Fase 3), frontend (Fase 4-5).
- Endpoints de `skill`, `education`, `certification`, `project`, `social-link`, `theme`: se seedean, pero no se exponen todavía.
- Hardening de producción (healthcheck, Helmet, throttler, filtro global de excepciones, logging estructurado): Fase 6. Solo se incluye lo mínimo para que las respuestas de error sean JSON consistentes.
- Cambios al modelo de datos (`schema.prisma`) o a los datos de `cv-data.json`.
- Migrar a Prisma 7/8 o NestJS 12 (ver design.md, decisiones D1/D2).

## Capabilities

### New Capabilities
- `api-platform`: arranque de la API, prefijo `/api`, configuración validada, CORS, forma de los errores y documentación OpenAPI.
- `content-localization`: negociación del locale por request y reglas de fallback ES/EN en las respuestas públicas.
- `data-persistence-seed`: esquema aplicado por migraciones versionadas y carga idempotente de `cv-data.json`.
- `public-profile-api`: lectura pública del perfil base (con idiomas y disponibilidad).
- `public-experience-api`: lectura pública de experiencias visibles (lista ordenada y detalle por id).

### Modified Capabilities
- (ninguna: `openspec/specs/` está vacío; este es el primer change)

## Impact

- **Código nuevo**: `backend/` completo (package.json, tsconfig, nest-cli, `src/main.ts`, `src/app.module.ts`, `src/config/`, `src/shared/{domain,infrastructure}`, `src/modules/{profile,experience}`, `test/`, `prisma/migrations/`).
- **Código existente tocado**: `backend/src/shared/infrastructure/i18n/resolve-locale.ts` (pasa a re-exportar el núcleo desde `shared/domain/i18n`; API pública idéntica). `backend/scripts/seed.ts` y `backend/prisma/schema.prisma` **no cambian**; `backend/.env.example` solo gana comentarios.
- **Dependencias**: `@nestjs/{core,common,platform-express,config,swagger}` 11.x, `prisma` + `@prisma/client` 6.19.x, `class-validator`, `class-transformer`, `reflect-metadata`, `rxjs`; dev: `@nestjs/{cli,testing}`, `typescript`, `ts-jest`, `jest`, `supertest`, `tsx`, `eslint`, `prettier`.
- **Infra local**: `docker-compose.yml` existente (Postgres 16 en 5432, Adminer en 8080). El puerto 3000 está ocupado en la máquina de desarrollo por otro contenedor → el `.env` local usará `PORT=3300` (no versionado; `.env.example` mantiene 3000).
- **Docs a sincronizar al archivar** (Reviewer): checkbox Fase 1 en `CLAUDE.md` y `README.md`; `docs/CHANGELOG.md`; corregir en `docs/SPECS-POR-FASE.md` los conteos del criterio de seed (dice 14 experiencias y 13 perfiles; el JSON tiene 15 experiencias y el seed crea 13 + `all` = 14 perfiles); en `docs/KICKOFF-ClaudeCode.md` el paquete real de OpenSpec es `@fission-ai/openspec`; en `docs/ARCHITECTURE.md` §6 las rutas borrador `/api/public/*` quedan superadas por las rutas de SPECS (`/api/profile`, `/api/experiences`, `/api/curated-profiles`).
