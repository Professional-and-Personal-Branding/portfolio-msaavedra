# polish-views-updated-at-and-builder — `updatedAt` que no mienten, contadores en singular y tests sin timeouts en frío

> Change correctivo y chico, **apilado sobre `feat/profile-structured-data`** (PR #47, change `upgrade-profile-structured-data`, todavía sin fusionar). Toma la mitad de su **P1** que corrige `CuratedProfile.updatedAt` (allí se llamó `fix-curated-profile-updated-at`); `dateModified` en el JSON-LD queda fuera (P1 de este change).

## Why

1. **Cada visita humana reescribe la fecha de modificación del perfil.** `PrismaProfileViewRepository.record` incrementa `views` con `curatedProfile.update({ data: { views: { increment: 1 } } })`, y Prisma rellena `@updatedAt` en todo `update`. El `<lastmod>` del sitemap sale de ese valor: le dice a los buscadores que el perfil cambió cuando solo lo abrió alguien, y a cualquiera que lea el sitemap le cuenta **el día de la última visita** a un perfil enviado a una empresa. Es el hallazgo de D5 de `upgrade-profile-structured-data`, que por eso no pudo emitir `dateModified`. `npm run views:reclassify -- --apply` tiene el mismo defecto: escribe `views` con `update` y movería el `updatedAt` de todos los perfiles que corrige.
2. **El preview del constructor dice «1 proyectos».** `PreviewPanel.tsx` concatena el número con el plural fijo en los tres contadores (`experiencias`, `categorías`, `proyectos`). La captura del manual (TC-12, `tc12b-identidad.jpg`) lo muestra tal cual.
3. **La primera corrida de Vitest después de un `build` falla por tiempo.** `CuratedProfilePage.test.tsx`, `CuratedProfileView.staged.test.tsx`, `ProfileBuilderPage.test.tsx` y `ShareLinks.test.tsx` fallan de forma intermitente en frío y pasan al repetir. Ya pasó en `unify-section-catalog`, `add-share-links` y `fix-admin-contrast` (sus `verification.md`). Un rojo que se resuelve repitiendo enseña a ignorar el rojo.

## What Changes

- **El incremento de `views` no toca `updatedAt` (D1).** El `record` reemplaza el `update` por un `$executeRaw` parametrizado (`UPDATE "CuratedProfile" SET "views" = "views" + 1 WHERE "id" = …`) dentro del mismo `$transaction` en lote que crea el `ProfileView`. Sigue siendo atómico y todo o nada.
- **La reclasificación tampoco (D2).** `applyReclassification` escribe `views` con `tx.$executeRaw` dentro de su transacción interactiva.
- **Sin corrección de datos (D3).** No hay de dónde recuperar la fecha real de la última edición y el sitio no está desplegado. El valor se corrige solo con la próxima edición.
- **e2e que lo fija (D4).** Una visita humana suma 1 a `views` y deja `updatedAt` y el `<lastmod>` del sitemap exactamente iguales; una edición desde el panel sí los mueve (control de que el test no pasa en vacío).
- **Contadores del preview con singular y plural (D5, D6).** Helper `formatCount` en `frontend/src/shared/i18n/plural.ts` con `Intl.PluralRules`: «1 experiencia · 1 categoría · 1 proyecto», «0 proyectos», «2 proyectos». En inglés, «1 project» / «2 projects». El panel sigue en español aunque el preview esté en EN. Se corrige el epígrafe de la captura de TC-12.
- **Timeouts en frío (D7).** Primero se mide qué timeout se dispara. Después, `testTimeout` y `hookTimeout` mayores en `frontend/vite.config.ts` y, si hace falta, un precalentamiento por archivo con `beforeAll` (helper nuevo `src/test/warm-up.ts`). `src/test/setup.ts` no se toca y `asyncUtilTimeout` sigue en 1 s.

## Non-goals

- `dateModified` en el JSON-LD del head y `updatedAt` en el DTO público (P1).
- Mover el contador `views` a otra tabla o cambiar el schema: este change no tiene migración.
- Pluralizar los contadores del panel fuera del preview («1 visitas», «1 skills»), salvo que el owner elija A en P2 (grupo 4 opcional de `tasks.md`).
- Traducir el panel al inglés.
- Tocar `frontend/src/test/setup.ts`, subir el `asyncUtilTimeout` de Testing Library o sumar reintentos (`retry`) a Vitest.
- Corregir las specs archivadas que `--strict` pudiera rechazar por longitud (hoy pasan las 39).

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `profile-view-analytics`: suma *El contador de visitas no cambia la fecha de modificación del perfil* (ADDED).
- `public-seo`: suma *El `lastmod` del sitemap refleja ediciones, no visitas* (ADDED).
- `curated-profile-builder`: suma *Contadores del preview en singular y plural* (ADDED).

Los timeouts de Vitest son infraestructura de pruebas y no tienen delta de spec (D8).

## Impact

- **Backend:** `backend/src/modules/analytics/infrastructure/persistence/prisma-profile-view.repository.ts` (`record` y el comentario «Único SQL crudo del proyecto», que deja de ser cierto) y `backend/scripts/lib/reclassify-views.ts` (`applyReclassification`). Sin cambios de dominio, de casos de uso, de DTOs ni del OpenAPI.
- **Base:** sin migración y sin corrección de datos.
- **Tests backend:** e2e nuevo `backend/test/views-updated-at.e2e-spec.ts` (visita, sitemap, reclasificación y control con edición).
- **Frontend:** `frontend/src/shared/i18n/plural.ts` (nuevo) y su `plural.spec.ts`, `features/backoffice/curated-profiles/PreviewPanel.tsx` y `PreviewPanel.test.tsx`, `frontend/vite.config.ts` (`test.testTimeout`, `test.hookTimeout`) y, condicionado a la medición, `frontend/src/test/warm-up.ts` más un `beforeAll` en los archivos afectados.
- **Docs:** epígrafe de `tc12b-identidad` en `docs/MANUAL.md` y `docs/manual/index.html` (y la captura regenerada con `manual:capture` sobre una base descartable), `docs/CHANGELOG.md` y el roadmap de `CLAUDE.md` al archivar. Sin caso nuevo del manual (D8).
- **Apilado:** la rama `fix/views-updated-at-and-builder` sale de `feat/profile-structured-data`. Si el PR #47 se fusiona antes, se rebasa sobre `main` antes de abrir el PR; si no, el PR apunta a `main` y se revisa el `merge-base` (PR #17 y #35 entraron en su rama base y no en `main`).
