# add-json-resume-export — exportar un perfil curado como JSON Resume v1.0.0

> Change de la Fase 1.3 (`docs/PROPUESTA-FEATURES.md` § 6.2, fila `add-json-resume-export`; § 4, ítem 4.4; § 3, fila «JSON Resume y Europass»). Sale de `main` en `e337efd`. Solo la exportación: el importador de la misma fila queda fuera (Non-goals). Caso del manual reservado: **TC-48** (TC-46 y TC-47 los toman otros changes en paralelo).

## Why

1. **Los portales y las herramientas de CV hablan JSON Resume, no nuestro DTO.** JSON Resume v1.0.0 es el formato abierto que aceptan temas, generadores de PDF y algunos ATS. Hoy un perfil curado solo sale como página o como PDF impreso: para cargarlo en otra herramienta hay que copiarlo a mano, y la copia deja de coincidir con el perfil apenas se edita.
2. **El perfil curado ya hace el trabajo difícil.** La selección por tags, los overrides, el orden cronológico y las secciones ocultas los resuelve `CuratedProfileComposer`. Exportar es traducir esa vista resuelta a otro formato; si la exportación resolviera por su cuenta, podría divergir de lo que ve el reclutador.
3. **JSON Resume no es bilingüe.** Un archivo por idioma, con el mismo `?lang=` que el resto de la API.

## What Changes

- **Ruta pública `GET /api/curated-profiles/:slug/resume.json` (D1).** Misma resolución que `GET /api/curated-profiles/:slug` (`ResolveCuratedProfileUseCase` sin contexto de visita): 404 para slug inexistente, `PRIVATE` o archivado; 401 para `PROTECTED` sin token válido (`X-Access-Token` o `?token=`); un alias resuelve con `Content-Location` al slug canónico. El de la home es `/api/curated-profiles/all/resume.json`. No hay ruta nueva en Caddy: `/api/*` ya va al proxy.
- **No registra visita (D2).** Ni `ProfileView` ni incremento de `views`; `?via=` y `?src=` no se aceptan en esta ruta.
- **Mapeo fijo a JSON Resume (D3, D4, D5).** Un mapper puro de aplicación convierte `CuratedProfileOutput` en el documento: `$schema`, `basics` (con `location` y `profiles`), `work`, `education`, `certificates`, `skills`, `languages`, `projects` y `meta` (`canonical`, `version: "v1.0.0"`, `lastModified` desde `updatedAt`). Una sección se exporta solo si su id está en `sections` de la vista resuelta: lo oculto y lo vacío no salen. Sin claves de extensión: tema, layout, `filterTags`, tecnologías por experiencia, `credentialId` y `expiresAt` no viajan.
- **Cabeceras (D6).** `Content-Type: application/json; charset=utf-8`, `Content-Language`, `Content-Disposition: attachment; filename="<slug>.<locale>.resume.json"`, `X-Robots-Tag: noindex`, `Cache-Control: no-cache` para `PUBLIC` y `private, no-store` para `PROTECTED`. Sin caché en memoria del servidor.
- **Ruta del panel `GET /api/admin/curated-profiles/:id/resume.json` (D7).** Con sesión de administrador, exporta lo **guardado** de cualquier perfil (también `PRIVATE`, `PROTECTED` sin token y archivado), con el mismo composer y el mismo mapper, sin visita.
- **Enlace en el constructor (D8).** En la pestaña **Publicación**, junto a «Link público», «Descargar JSON Resume» en ES y EN, apuntando a la ruta del panel. Deshabilitado en un perfil nuevo sin guardar; con cambios sin guardar, avisa que se exporta lo guardado. **No** se agrega a la vista pública.
- **Validación contra el schema publicado (D9).** El JSON Schema v1.0.0 se vendoriza en `backend/test/fixtures/json-resume/` con su URL de origen y su SHA-256; un test unitario del mapper y un e2e por perfil público e idioma validan la salida con `ajv` + `ajv-formats` (`uri`, `email`, `date`), declarados como devDependencies con las versiones que ya están en `package-lock.json`.
- **Contrato y manual (D10).** `openapi.json` y `api.d.ts` regenerados (las dos rutas, cuerpo documentado como objeto JSON Resume); TC-48 en `docs/MANUAL.md` y `docs/manual/index.html`.

## Non-goals

- El importador de JSON Resume (misma fila de la propuesta): change aparte.
- Europass u otros formatos.
- Una ruta en el sitio fuera de `/api` (`/{slug}/resume.json` o `/resume.json`) con reescritura en Caddy (D1).
- Un botón de descarga en la vista pública (D8).
- Claves de extensión no estándar en el documento (D5).
- Registrar las descargas en la analítica, o un `kind` nuevo en `ProfileView` (exigiría migración; D2).
- Exportar el borrador sin guardar del constructor.
- Migraciones o cambios en el dominio de `curated-profile`.
- Corregir specs archivadas que `--strict` rechace por longitud (hoy pasan todas).

## Capabilities

### New Capabilities

- `json-resume-export`: el documento JSON Resume de un perfil curado (mapeo, secciones, validez contra el schema, cabeceras, sin visita) y la ruta del panel.

### Modified Capabilities

- `public-curated-profile-api`: suma *Exportación JSON Resume por slug* y *Documentación OpenAPI de la exportación* (ADDED).
- `curated-profile-builder`: suma *Descarga del JSON Resume en la pestaña Publicación* (ADDED).

## Impact

- **Backend:** `curated-profile/application/dto/json-resume.output.ts` (tipo del documento), `application/mappers/json-resume.mapper.ts` (puro) y su spec; dos casos de uso (`ExportCuratedProfileResumeUseCase` sobre `ResolveCuratedProfileUseCase`, `ExportCuratedProfileResumeForAdminUseCase` sobre el repositorio y `CuratedProfileComposer`); dos handlers en `curated-profile.controller.ts` y `admin-curated-profile.controller.ts`; `curated-profile.module.ts`; `profilePath`/`HOME_SLUG` compartidos con el sitemap y el head. `openapi.json`. e2e nuevo `backend/test/json-resume-export.e2e-spec.ts`. `package.json`: `ajv` y `ajv-formats` en devDependencies (versiones del lockfile). Sin migraciones.
- **Frontend:** `features/backoffice/curated-profiles/ProfileBuilderPage.tsx` (enlaces en Publicación) y su test; `src/shared/types/api.d.ts` regenerado. La vista pública no cambia: `perf:budget` no se mueve.
- **Infra:** ninguno. `frontend/Caddyfile` y `docs/DEPLOY-ARCHITECTURE.md` no cambian (la ruta vive bajo `/api/*`).
- **Docs:** TC-48 en `docs/MANUAL.md` y `docs/manual/index.html`; `docs/CHANGELOG.md` y el roadmap de `CLAUDE.md` al archivar. `docs/PROPUESTA-FEATURES.md` no se toca en este change (la ruta difiere de la fila de § 6.2: ver D1).
