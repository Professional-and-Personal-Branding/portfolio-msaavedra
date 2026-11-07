# fix-error-contrast-and-date-modified — mensajes de error legibles y `dateModified` en el JSON-LD

> Change correctivo y chico, **apilado sobre `docs/archive-fase-1-2-b`** (PR #50, archivado de la tanda del 2026-11-05: `openspec/specs/` ya trae los deltas de `add-admin-password-change`, `add-builder-skill-project-overrides`, `polish-views-updated-at-and-builder` y `upgrade-profile-structured-data`). Junta dos pendientes que dejó esa tanda: el desvío 2 de `add-admin-password-change` y la P1 resuelta (opción A) de `polish-views-updated-at-and-builder`.

## Why

1. **Los mensajes de error del panel no llegan a AA.** `text-destructive` es `#dc2626` fijo (`theme.css`). El panel usa siempre `modern-dark` (D4 de `add-admin-backoffice`), y ahí ese rojo mide **3,99:1** sobre `bg`, **3,67:1** sobre `bgSoft` y **3,48:1** sobre la tarjeta (AA pide 4,5:1). axe lo marcó en `/admin/cuenta` y `add-admin-password-change` lo resolvió solo para esa pantalla con un `color-mix` ad hoc (desvío 2 de su `verification.md`). El resto —login, `TextField`, `LocalizedField`, los diálogos de experiencias, formación, proyectos, enlaces, Portada y el constructor— sigue con 3,48:1, y `a11y:check` no lo ve porque nunca abre un formulario con errores a la vista. El mismo rojo en la vista pública (`AccessTokenForm`) mide 3,67:1 y 3,20:1 en `elegant` y 4,39:1 sobre `bgSoft` en `corporate`.
2. **El JSON-LD no dice cuándo cambió el perfil.** `upgrade-profile-structured-data` dejó `dateModified` fuera (D5) porque `CuratedProfile.updatedAt` se movía con cada visita. `polish-views-updated-at-and-builder` lo corrigió (D1, D2) y el owner resolvió su P1 con la opción A: un change aparte que sume `updatedAt` al DTO público y `dateModified` al fragmento y al cliente. El Rich Results Test lo marca como campo recomendado ausente (TC-44, paso 6).

## What Changes

- **Token derivado `--t-danger-ink` (D1).** Rojo de error legible como texto (≥ 4,5:1 sobre `bg`, `bgSoft` y `card`), calculado en `tokensToCssVars` con `accentInk` sobre la base `DANGER = '#dc2626'`, igual que `--t-success-ink`. No se guarda. `@theme inline` lo expone como `text-danger-ink`.
- **Reemplazo en los mensajes (D2).** Todos los `text-destructive` de mensajes de error y avisos de `features/` pasan a `text-danger-ink`, también `hover:text-destructive` de `ChipListField` y los dos de `ui/form.tsx`. El `ERROR_TEXT` con `color-mix` de `AccountPage.tsx` se borra y usa el token. Los botones e insignias destructivos (`bg-destructive` + texto blanco) y los bordes `aria-invalid` **no cambian**: ya cumplen (medido en D2).
- **Regla estática (D3).** `status-color-usage.spec.ts` suma la regla `danger`: en la vista pública y el panel, ningún `text-destructive` (con o sin variante) ni `text-[…destructive…]`.
- **`a11y:check` con errores a la vista (D4).** El login con un 401 simulado por interceptación (no llega a la API ni gasta el límite) y el diálogo «Nueva experiencia» enviado vacío (validación del cliente, sin escritura), en móvil y escritorio, con 0 violaciones.
- **`updatedAt` en la vista resuelta (D5, D7).** `CuratedProfileOutput` suma `updatedAt: string | null` (ISO 8601 UTC, el `CuratedProfile.updatedAt` que ya trae la entidad: sin consultas nuevas). `openapi.json` y `api.d.ts` se regeneran.
- **`dateModified` en el `ProfilePage` (D6, D8).** `AAAA-MM-DD` en UTC, el mismo día que el `<lastmod>` del sitemap, después de `inLanguage` y antes de `mainEntity`; se omite si `updatedAt` es nulo. Lo emiten las dos funciones gemelas (`profile-head.renderer.ts` y `document-meta.ts`), con la misma función de día en el backend que el sitemap.
- **Fixture, tests y manual (D9, D10).** `docs/fixtures/profile-head-consistency.json` suma `updatedAt` a los casos (uno nulo y uno cerca de la medianoche UTC); e2e nuevo del head y de la API pública; TC-44 actualizado. Sin TC-46.

## Non-goals

- Cambiar `--color-destructive`, el color de los botones o las insignias destructivas, o la variante `destructive` de `dropdown-menu.tsx` (no se usa en ninguna pantalla).
- Tomar en cuenta las ediciones del contenido base (experiencias, skills, formación, proyectos) en la fecha: solo `Profile`, `Experience` y `Theme` tienen `updatedAt`, y sumarlo al resto exige migración (D5).
- `dateCreated`, `datePublished` o `image` en el JSON-LD.
- Mostrar la fecha de actualización en la página pública.
- Corregir las specs archivadas que `--strict` pudiera rechazar por longitud (hoy pasan las 38).

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `web-accessibility`: suma *Mensajes de error legibles* y *La auditoría ve los formularios con errores* (ADDED).
- `public-seo`: modifica *Datos estructurados del profesional* (el escenario «Sin fecha de modificación» pasa a cubrir solo `updatedAt: null` y se suma «Fecha de modificación presente») y suma *Fecha de la última edición en los datos estructurados* (ADDED).
- `public-curated-profile-api`: suma *La vista resuelta informa su última edición* (ADDED).

## Impact

- **Frontend:** `src/themes/css-vars.ts` (+ `DANGER`, `--t-danger-ink`) y `css-vars.spec.ts`; `src/themes/theme.css` (`--color-danger-ink` y el default en `:root`); `src/themes/status-color-usage.spec.ts`; los mensajes de `features/backoffice/**` (`LoginPage`, `AccountPage`, `PreviewPanel`, `ProfileBuilderPage`, `ShareLinksPanel`, `ExperienceForm`, `FormacionForms`, `PortadaPage`, `SocialLinkForm`, `TextField`, `LocalizedField`, `ChipListField`) y `features/curated-view/components/AccessTokenForm.tsx`; `shared/components/ui/form.tsx`; `scripts/check-a11y.mjs`; `src/shared/lib/document-meta.ts` y sus specs; `src/shared/types/api.d.ts` (regenerado) y los fixtures de tests que construyen un `CuratedProfile`.
- **Backend:** `curated-profile.output.ts`, `curated-profile.mapper.ts`, `docs/curated-profile.response.ts` (y por herencia `PreviewCuratedProfileResponse`), `profile-head.renderer.ts`, `sitemap.builder.ts` (función de día compartida), `openapi.json`, e2e nuevo `backend/test/profile-date-modified.e2e-spec.ts`. Sin migración, sin consultas nuevas, sin cambios de dominio.
- **Docs:** `docs/fixtures/profile-head-consistency.json`, TC-44 en `docs/MANUAL.md` y `docs/manual/index.html`, `docs/CHANGELOG.md` y el roadmap de `CLAUDE.md` al archivar.
- **Apilado:** la rama `fix/error-contrast-and-date-modified` sale de `docs/archive-fase-1-2-b` (PR #50). El PR apunta a `main`; si #50 todavía no entró, se revisa el `merge-base` antes de fusionar (PR #17 y #35 entraron en su rama base y no en `main`).
