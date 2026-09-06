# add-curated-profile-resolution — Fase 2: Núcleo curated-profile

> Materializa la **Fase 2** de `docs/SPECS-POR-FASE.md` (objetivo, alcance y criterios viven allí; no se duplican). El algoritmo de referencia es la sección "El núcleo: ResolveCuratedProfile" de `CLAUDE.md`. Depende de la Fase 1 archivada (`2026-09-06-add-backend-base`).

## Why

El producto entero gira alrededor de los **perfiles curados**: un slug devuelve una proyección filtrada, ordenada y tematizada del perfil profesional. Hoy la base ya contiene 14 perfiles curados (13 plantillas + `all`), 5 temas preset y experiencias/skills etiquetadas, pero **ningún endpoint los resuelve**. Sin este change no hay Fase 4 (frontend público) posible: la vista `/{slug}` no tendría de dónde leer.

## What Changes

- **Módulo `curated-profile`** (Clean Architecture completa): entidad `CuratedProfile`, servicios de dominio puros para la **selección por tags + overrides** (`includeIds`/`excludeIds`) y la **resolución de secciones**, caso de uso `ResolveCuratedProfileUseCase(slug, locale, accessToken?)` y `ListCuratedProfilesUseCase(locale)`, adaptador Prisma, controllers.
- **Módulos mínimos `skill` y `theme`** (dominio + puerto + adaptador Prisma, sin endpoints propios): el resolver necesita las skills por categoría con sus tags y el tema base con sus tokens. Quedan listos para exponer endpoints en fases posteriores.
- **Resolución de tema**: `theme` base del perfil (o el preset por defecto `modern-dark` si no tiene) + `themeOverrides` con **merge profundo**; el frontend recibe tokens ya combinados.
- **Visibilidad y acceso**: `PUBLIC` se sirve; `PRIVATE` responde 404 (no revela existencia); `PROTECTED` exige el token de acceso (header `X-Access-Token` o query `token`) y responde 401 si falta o no coincide (comparación en tiempo constante).
- **Endpoints públicos**: `GET /api/curated-profiles` (listado para el menú de navegación: solo `PUBLIC`, con `roleType`/`techFocus` bilingües resueltos) y `GET /api/curated-profiles/:slug` (perfil resuelto: metadatos, tema, perfil base, experiencias, skills por categoría, secciones).
- **Orden canónico de experiencias — BREAKING de spec (D1 en design)**: pasa a **cronológico descendente** (`startDate` desc, `order` asc como desempate) en toda la API, incluido `GET /api/experiences`. Motivo: el criterio de Fase 2 exige orden cronológico y los datos reales tienen 2 casos donde `order` (índice del JSON) no es cronológico. Requiere actualizar la spec `public-experience-api` y un test e2e de Fase 1.
- **Shared**: `AccessDeniedError` (dominio) y su mapeo HTTP a 401; `ProfileModule`/`ExperienceModule` exportan sus puertos para reutilizarlos.
- **Tests**: unitarios exhaustivos de la selección (tags, overrides, `filterTags` vacío, ocultas), del merge de tema, de secciones y del caso de uso con repos mock (sin DB, como exige el criterio); e2e sobre los perfiles seedeados (`tech-lead-dotnet`, `java-senior-backend`, `generalist-polyglot`, `all`) y con mutaciones revertidas para overrides, `PRIVATE` y `PROTECTED`.

### Non-goals

- Registro de visitas (`ProfileView`, contador `views`): Fase 3 según `docs/SPECS-POR-FASE.md` (CLAUDE.md lo lista en el núcleo; se difiere para respetar la spec de fase). `views` queda en 0.
- Endpoint `POST /api/curated-profiles/:slug/access`: el token viaja en el `GET`; un endpoint de canje puede añadirse en Fase 3 si el frontend lo necesita.
- Edición de perfiles curados, auth, CRUD (Fase 3). Frontend (Fase 4).
- Endpoints de `skills`, `themes`, `education`, `certifications`, `projects`, `social-links`: se seedean y (skills/themes) se leen internamente, pero no se exponen. La Fase 4 necesitará `education`/`certifications`/`projects` para las secciones: se propone un change corto `add-portfolio-sections-api` antes o durante la Fase 4.
- Inclusión de `projects` en la resolución curada (tienen `tags`): fuera por alcance de la spec de fase; trivial de agregar luego con el mismo servicio de selección.
- Cambios al `schema.prisma` o a `cv-data.json`.

## Capabilities

### New Capabilities
- `curated-profile-resolution`: reglas de negocio para resolver un perfil curado: selección de experiencias y skills por intersección de tags con overrides, orden, visibilidad/acceso, secciones y forma del resultado.
- `theme-resolution`: elección del tema base (propio o preset por defecto) y merge profundo de `themeOverrides` sobre sus tokens.
- `public-curated-profile-api`: contrato HTTP de listado y detalle por slug, códigos de estado y negociación de idioma.

### Modified Capabilities
- `public-experience-api`: el orden del listado pasa de `order` asc / `startDate` desc a **`startDate` desc / `order` asc** (orden cronológico canónico compartido con los perfiles curados).

## Impact

- **Código nuevo**: `backend/src/modules/{curated-profile,skill,theme}/**`, `shared/domain/errors/access-denied.error.ts`, tests unitarios y e2e (`test/curated-profile.e2e-spec.ts`).
- **Código modificado**: `experience/domain/services/sort-experiences.ts` (+spec) y `experience/infrastructure/persistence/prisma-experience.repository.ts` (orderBy); `profile.module.ts` / `experience.module.ts` (exportan puertos); `shared/infrastructure/http/domain-error.mapper.ts` (+401); `test/app.e2e-spec.ts` (escenario de orden); `swagger.ts` (tag `curated-profiles`).
- **Specs**: 3 nuevas + delta MODIFIED sobre `openspec/specs/public-experience-api/spec.md`.
- **Dependencias**: ninguna nueva.
- **Docs a sincronizar al archivar**: checkbox Fase 2 en `CLAUDE.md`/`README.md`; `docs/CHANGELOG.md`; en `CLAUDE.md` § núcleo, aclarar que el paso 6 (`ProfileView`) se implementa en Fase 3 y el orden canónico; `docs/ARCHITECTURE.md` §6 (rutas de Fase 2 marcadas).
