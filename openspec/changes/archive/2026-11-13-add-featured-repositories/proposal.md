# add-featured-repositories — Repositorios destacados de punta a punta, cargados a mano

> Change de la **Fase 1.3** de `docs/PROPUESTA-FEATURES.md` (§ 4 E1 ítem **1.2a**, § 4 ítem 8.5, § 6.2 fila `add-featured-repositories`, § 9 preguntas 6 y 7). Criterio de la ficha: «CRUD en el panel. La sección se oculta con menos de 2 repos. `print:check` da una hoja. No hay deriva de `openapi.json` ni de `api.d.ts`. Hay un TC-nn». Respeta las respuestas del owner: pregunta 6 = A (hay repos públicos en GitHub) y las decisiones del 2026-11-12 registradas en `design.md` (P1: solo URLs de GitHub; P2: en el PDF solo si entra). La sincronización con GitHub (stars, lenguajes, topics, «verificado el…») es `add-github-code-evidence` (1.2b), sobre `add-integrations-foundation`; **no** entra acá.

## Why

El modelo `FeaturedRepository` existe desde la migración `init`, el seed lo carga y `seed:verify` lo cuenta, pero ninguna API, sección ni pantalla lo lee (`docs/DATA-POPULATION.md` § 10 lo marca como «inerte»). Para un perfil técnico, el código público es la evidencia más directa después de la experiencia: un reclutador técnico abre GitHub antes que cualquier otra cosa. Hoy el sitio solo enlaza el perfil de GitHub en Presencia, sin decir qué repos mirar ni por qué.

Activar la entidad con curaduría manual (nombre, enlace, descripción bilingüe, tecnologías y tags) permite que cada perfil curado muestre los repos que corresponden a la vacante, con la misma regla de tags que proyectos, sin depender todavía de la API de GitHub.

## What Changes

- **Módulo `featured-repository`** (D1) con Clean Architecture, sobre la plantilla de `project`: entidad, puerto de repositorio, reglas de dominio, casos de uso público y de administración, adaptador Prisma, controllers y módulo Nest. **Sin migración:** la tabla de `init` alcanza.
- **URL solo de GitHub** (D2, decisión del owner P1): `https://github.com/<owner>/<repo>` en forma canónica, validada en dominio, DTO, panel y seed con la misma función pura `parseGithubRepositoryUrl`, que el change de sincronización reutilizará. Un mismo `owner/repo` (sin distinguir mayúsculas) no se puede cargar dos veces (409).
- **Campos** (D3): `name`, `url`, `language` (opcional), `description` `{es,en}`, `technologies[]`, `tags[]`, `order`, `visible`. La columna `stars` queda sin exponer ni editar: la llenará la sincronización.
- **API** (D7): `GET /api/featured-repositories` (visibles, resueltos al locale) y CRUD bajo `/api/admin/featured-repositories` (listado crudo con ocultos).
- **Sección `repositories`, 10.º id del catálogo** (D4), después de `projects`. Selección por `filterTags` e `includeIds`/`excludeIds` con `selectByTags` (D5); la sección se muestra **solo con 2 o más repos resueltos** (D6).
- **Vista pública** (D8): tarjetas con nombre enlazado, descripción, lenguaje y tecnologías. El componente vive en un **chunk diferido** que se precarga cuando `sections` trae `repositories`: el arranque público no crece por la sección.
- **Hoja imprimible** (D9, decisión del owner P2): una línea compacta «Repositorios: a · b · c» con nombres enlazados, **solo si entra**, según un estimador determinístico de líneas; si no entra, la sección no se imprime. `print:check` sigue exigiendo una hoja.
- **JSON Resume** (D10): los repos de la vista se exportan en `projects`, después de los proyectos, con `type: "repository"`.
- **Panel** (D12, D13): bloque **Repositorios** en `/admin/proyectos` (alta, edición, borrado con confirmación, visible y orden) y bloque **Repositorios** en la pestaña Selección del constructor (Incluir/Excluir, ocultos marcados, huérfanas con las cuatro listas, aviso «la sección se muestra desde 2»).
- **Seed** (D14): carga todos los repos (también los ocultos, como proyectos), acepta un `id` opcional para referencias `repository:<id>` y valida la URL antes de borrar nada. El placeholder `PENDIENTE-CURAR` de `docs/cv-data.json` se reemplaza por `[]` (conteo sigue en 0).
- **Ejemplo** (D15): tres repos ficticios (dos visibles, uno oculto) y la plantilla `ejemplo-secciones` con las diez secciones.
- **Consistencia del CV** (D16): `i18n.missing-translation` cubre la descripción de los repos visibles.
- **Contrato y docs:** `backend/openapi.json` y `frontend/src/shared/types/api.d.ts` regenerados; `docs/MANUAL.md` y `docs/manual/index.html` con **TC-50**; `docs/DATA-POPULATION.md` § 10 y § 12.10; `docs/CHANGELOG.md`.

## Non-goals

- **Sincronizar con GitHub** (stars, lenguajes, topics, README, «verificado el…», snapshots): es `add-github-code-evidence`. Este change no llama a ninguna API externa ni suma secretos.
- **Mostrar stars** cargadas a mano: un número sin verificar resta credibilidad (D3).
- **GitLab u otros hosts**: el owner eligió solo GitHub (P1). Sumar otro host es un change que amplía `parseGithubRepositoryUrl` a un puerto.
- **Datos estructurados** (`SoftwareSourceCode` en el JSON-LD): sin cambios en `public-seo` (D11).
- **Contadores del preview** del constructor con repos: siguen siendo experiencias, categorías y proyectos.
- **Cargar los repos reales** del owner: es la curaduría del ítem 0.3, desde el panel o editando `cv-data.json`.
- **Página propia en la navegación del panel**: los repos van dentro de Proyectos (D12).

## Capabilities

### New Capabilities

- `featured-repositories`: entidad, URL de GitHub, unicidad, API pública y de administración, sección pública y preparación para la sincronización.

### Modified Capabilities

- `curated-profile-resolution`: MODIFIED *Catálogo canónico de secciones* (diez ids) y *Resultado listo para presentación* (clave `repositories`); ADDED *Selección de repositorios por tags* y *La sección de repositorios necesita dos*.
- `layout-engine`: ADDED *La sección de repositorios no suma al arranque*.
- `printable-curated-profile`: MODIFIED *Contenido y orden de la hoja*; ADDED *Repositorios en la hoja solo si entran*.
- `frontend-localization`: ADDED *Rótulos de la sección de repositorios*.
- `public-portfolio-sections-api`: MODIFIED *Elementos ocultos excluidos* y *Documentación OpenAPI* (cinco listados).
- `api-contract-types`: ADDED *Repositorios en el contrato generado*.
- `admin-content-management`: MODIFIED *El panel agrupa el contenido por frecuencia de cambio*; ADDED *Repositorios en la página Proyectos*.
- `curated-profile-builder`: MODIFIED *Ítems ocultos y referencias huérfanas en la selección*; ADDED *Selección de repositorios en el constructor*.
- `json-resume-export`: MODIFIED *Las secciones ocultas no se exportan*; ADDED *Repositorios como proyectos del JSON Resume*.
- `data-persistence-seed`: ADDED *Repositorios destacados en el seed*.
- `example-seed-data`: MODIFIED *Archivo de datos de ejemplo*, *Cobertura de entidades y secciones*, *Cobertura de los mecanismos del perfil curado* y *Referencias estables en los overrides*.
- `cv-consistency`: ADDED *Traducciones de los repositorios*.

## Impact

- **Base:** sin migración ni cambios en `schema.prisma` (D1). `FeaturedRepository.stars` sigue nula.
- **Backend (`backend/src/`):** módulo nuevo `modules/featured-repository/`; `modules/curated-profile/` (`SECTION_IDS`, `sections-with-data.ts`, `portfolio-sections.loader.ts`, `curated-profile.composer.ts`, mapper y DTO de salida, `json-resume.mapper.ts`, `detect-missing-translations.ts`, schemas de Swagger de la vista y del preview); `modules/cv-consistency/` (snapshot y regla de traducciones); `app.module.ts`.
- **Scripts (`backend/scripts/`):** `seed-source.ts`, `seed-runner.ts`, `verify-seed.ts` (conteo sin filtrar ocultos) y referencias `repository:`.
- **Frontend (`frontend/src/`):** `shared/components/portfolio/Repositories.tsx` (chunk diferido), `themes/layouts/section-registry.ts`, `shared/i18n/messages.ts`, `features/curated-view/print/` (bloque y estimador), `features/backoffice/proyectos/` (bloque y formulario), `features/backoffice/curated-profiles/` (selección, huérfanas, aviso, faltantes), `test/` (fixtures y MSW).
- **Contrato:** `backend/openapi.json`, `frontend/src/shared/types/api.d.ts`.
- **Datos:** `docs/cv-data.json` (placeholder → `[]`), `docs/examples/cv-data.example.json`.
- **Docs:** `docs/MANUAL.md`, `docs/manual/index.html` y capturas (TC-50), `docs/DATA-POPULATION.md`, `docs/CHANGELOG.md`; al archivar, la línea del roadmap en `CLAUDE.md`.
- **Dependencias:** ninguna nueva. **CSP:** sin cambios (los enlaces a `github.com` son navegación, no recursos).
