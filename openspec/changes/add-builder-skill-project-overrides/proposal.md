# add-builder-skill-project-overrides — Incluir y excluir skills y proyectos desde el constructor

> Change de la **Fase 1.2** de `docs/PROPUESTA-FEATURES.md` (§ 4 E8 ítem **8.3**, § 6.1 «Impacto medio» y § 6.2 fila `add-builder-skill-project-overrides`). La ficha pide: «El constructor incluye y excluye skills (por categoría, con buscador) y proyectos, y el preview lo refleja. El design registra que el change es solo de frontend y que el arreglo es compartido (cuid). Tests de Vitest y un TC-nn». Respeta las decisiones del owner del 2026-10-28 (§ 9): P1 = A (1.2 sin IA, sin OAuth y sin servicios nuevos).

## Why

El núcleo (`ResolveCuratedProfileUseCase` y el preview, los dos sobre `CuratedProfileComposer`) ya aplica `includeIds` y `excludeIds` a experiencias, **skills** y **proyectos**: el composer pasa el mismo `SelectionCriteria` a `selectByTags` (experiencias y proyectos) y a `selectSkillCategories` (skills, agrupadas por categoría). Pero el constructor del panel solo ofrece **Incluir** y **Excluir** por experiencia. Para quitar una skill que matchea por tag o sumar un proyecto que no comparte ninguno, hoy hay que usar la API con ids copiados a mano; `docs/MANUAL.md` (B10) lo documenta como «Limitación vigente».

El caso es frecuente al armar un perfil para una vacante: un tag amplio (`java`) arrastra skills que no aportan (Kotlin en un perfil de Spring), o un proyecto relevante no comparte el tag elegido. El dato de ejemplo `ejemplo-overrides` ya lo hace desde el seed (`skill:Kotlin` excluida, `project:herramienta-interna` incluido) y el panel no lo muestra ni deja cambiarlo.

## What Changes

- **Solo frontend** (D1): sin cambios en `backend/src`, en `schema.prisma`, en los DTOs ni en `openapi.json`. El contrato de `includeIds`/`excludeIds` (arreglos de strings) ya admite ids de cualquier tipo.
- **Arreglo compartido** (D2): skills y proyectos usan los mismos `includeIds`/`excludeIds` que las experiencias, sin prefijo de tipo ni columnas nuevas. Los ids son cuid generados por Prisma en todas las tablas.
- **Skills individuales, agrupadas por categoría y con buscador** (D3, D10): la pestaña **Selección** suma un bloque **Skills** con cada categoría y sus skills, cada una con **Incluir** y **Excluir**, y un buscador por nombre. No se guardan ids de categoría.
- **Proyectos** (D4): un bloque **Proyectos** con **Incluir** y **Excluir** por proyecto.
- **Un solo componente de fila** para los tres tipos (D4), extraído del bloque de experiencias actual.
- **Incluir y Excluir se excluyen entre sí** (D5): activar uno quita el id del otro arreglo. Un id cargado en los dos (solo posible por API) se muestra como excluido, con la aclaración de que la exclusión gana.
- **Ítems ocultos** (D6): experiencias y proyectos con `visible: false` aparecen con la insignia **Oculta**/**Oculto** y **Incluir** deshabilitado (salvo para quitar una inclusión que ya existe), porque el núcleo nunca los incluye.
- **Referencias huérfanas** (D7): ids de `includeIds`/`excludeIds` que no corresponden a ningún ítem se conservan al guardar; la pestaña los cuenta y ofrece **Quitar** para sacarlos del borrador.
- **Tags de proyectos en el universo de tags** (D8): el requisito vigente ya los pide y `tagUniverse` los omitía.
- **Datos** (D9): listas de `GET /api/admin/experiences`, `/api/admin/skill-categories` y `/api/admin/projects`, ya existentes; sin endpoints ni dependencias nuevas.
- **Regresión del núcleo** (D11): los requisitos de skills y proyectos de `curated-profile-resolution` y el de equivalencia del preview suman escenarios de include/exclude que hoy no están escritos, con tests unitarios y e2e, sin cambiar código del backend.
- **Docs:** `docs/MANUAL.md` e `index.html` (**TC-43**, B10 sin la «Limitación vigente», TC-13, suite § 6 y captura), `docs/DATA-POPULATION.md` § 12 (fila de `includeRefs`/`excludeRefs`), `docs/CHANGELOG.md`, `docs/PROPUESTA-FEATURES.md` § 6.2 y la línea del roadmap en `CLAUDE.md` al archivar.

## Non-goals

- **Cambiar la regla del núcleo** (tags, overrides, visibilidad, orden) o el `CuratedProfileComposer`.
- **Overrides por categoría completa** (ids de `SkillCategory` en los arreglos o un atajo «Incluir/Excluir todas»): queda como pregunta P1.
- **Overrides de educación, certificaciones o enlaces sociales**: no se filtran por tags y se adjuntan siempre (`curated-profile-resolution`, «Secciones informativas sin filtrar»).
- **Reordenar ítems a mano** dentro de un perfil: el orden canónico es una decisión vigente (D1 de `add-curated-profile-resolution`).
- **Visibilidad propia de las skills**: `Skill` no tiene `visible` y no se agrega.
- **Contador de skills en el preview**: el preview ya renderiza las skills resultantes (P2).
- **Migrar o limpiar ids huérfanos en la base**: solo se ofrecen para quitar desde el borrador (D7).

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `curated-profile-builder`: MODIFIED *Edición de los criterios de selección* (inclusiones y exclusiones de experiencias, skills y proyectos; exclusión mutua). ADDED *Selección de skills y proyectos en el constructor* y *Ítems ocultos y referencias huérfanas en la selección*.
- `curated-profile-resolution`: MODIFIED *Selección de skills por categoría* y *Selección de proyectos por tags* (mismo texto, escenarios nuevos de include/exclude y de proyecto oculto).
- `admin-curated-profile-preview`: MODIFIED *Misma resolución que la ruta pública* (escenario de overrides sobre skills y proyectos).

## Impact

- **Frontend (`frontend/src/features/backoffice/curated-profiles/`):**
  - `ProfileBuilderPage.tsx`: bloques **Skills** y **Proyectos** en la pestaña Selección; el bloque de experiencias pasa al componente compartido.
  - Componente nuevo `SelectionOverrides.tsx` (fila y lista de overrides) y funciones puras en `profile-draft.ts` (o `selection-overrides.ts`): `setOverride`, `overrideState`, `orphanOverrideIds`, `filterSkillCategories` y `tagUniverse` con proyectos.
  - Tests: `profile-draft.spec.ts` (o `selection-overrides.spec.ts`), `ProfileBuilderPage.test.tsx` y los fixtures de `src/test/` (`msw-admin.ts` ya sirve `/api/admin/projects`).
- **Backend:** sin cambios de código. Tests nuevos en `select-by-tags.spec.ts`, `select-skill-categories.spec.ts`, `curated-profile.use-cases.spec.ts` y el e2e del preview (`backend/test/backoffice.e2e-spec.ts` o `admin.e2e-spec.ts`).
- **Contrato:** `backend/openapi.json` y `frontend/src/shared/types/api.d.ts` sin cambios (el test de deriva lo comprueba).
- **Base y seed:** sin migración. `docs/examples/cv-data.example.json` y `docs/cv-data.json` sin cambios: `ejemplo-overrides` ya ejercita skills y proyectos.
- **Docs:** `docs/MANUAL.md`, `docs/manual/index.html`, captura `tc43-overrides.jpg` nueva y `tc13-seleccion.jpg` regenerada (`frontend/scripts/capture-manual.mjs`), `docs/DATA-POPULATION.md`, `docs/CHANGELOG.md`, `docs/PROPUESTA-FEATURES.md`, `CLAUDE.md`.
- **Sin cambios** en Caddy, la CSP, el arranque público (el panel es un chunk aparte; `perf:budget` no cambia), la analítica ni las dependencias de `package.json`.
