# Verificación — unify-section-catalog

Fecha: 2026-10-05 · Verifier: Claude (Opus 5.5) · Ciclos de reparación: 0.

## Automatizado

| Check | Resultado |
|---|---|
| `backend`: `npm run lint` / `typecheck` / `build` | 0 problemas |
| `backend`: `npm test` | 52 suites, **312 tests** (eran 295) |
| `backend`: `npm run test:e2e` | 7 suites, **113 tests** (eran 110), contra una base recién migrada y cargada con el seed |
| `backend`: `npm run seed` + `seed:verify` | conteos idénticos a `cv-data.json` |
| `frontend`: `npm run lint` / `build` (`tsc -b` + `vite build`) | 0 problemas |
| `frontend`: `npm run test` | 22 archivos, **132 tests** (eran 128) |

Los tests del frontend fallan de forma intermitente en las pantallas del backoffice por el timeout de 1 s de Testing Library (el chunk lazy y MSW tardan más bajo carga). Es anterior a este change: también ocurre en `main`. Con `asyncUtilTimeout: 5000` pasan 132/132 en tres corridas seguidas; el ajuste va en el PR de CI.

## Por criterio

| Criterio (spec delta) | Evidencia |
|---|---|
| Un único catálogo de 9 ids en orden canónico; `DEFAULT_SECTIONS` es el mismo | `resolve-sections.spec.ts` (`toBe(SECTION_IDS)`) |
| Orden vacío usa el catálogo completo | spec del dominio y del use case: 9 ids |
| El catálogo del backend y el tipo del frontend no pueden divergir | Comprobación manual: quitar `presence` del registro da `TS2741: Property 'presence' is missing` |
| Sección con datos omitida del orden se agrega al final | `completeSections` (orden parcial) y composer (`sectionsOrder: [hero, experience]` con proyectos) |
| Sección sin datos no se rellena, ni aunque esté declarada | composer con `excludeIds: [proj-erp]`, declarada y omitida |
| Sección oculta no se rellena | dominio y composer |
| El orden declarado no se altera | `completeSections`: orden invertido completo se devuelve tal cual |
| Id repetido aparece una vez | `completeSections` |
| 400 que nombra el id al crear, editar y en el preview | e2e `ids de sección`: `heroe`, `proyectos`, `timeline-3d` |
| PATCH inválido deja el perfil sin cambios; los 9 ids se aceptan | mismo e2e: `sectionsHidden` intacto; orden invertido → 200 y persistido |
| El OpenAPI declara el enum | `components.schemas.SectionId` con los 9 ids; `sectionsOrder`/`sectionsHidden` lo referencian |
| El cliente renderiza exactamente lo recibido; un id desconocido no rompe | `sections.spec.ts` y `layouts.test.tsx` (`[contact, hero, experience]` se renderiza en ese orden y nada más) |
| El constructor ofrece los 9 ids | `ProfileBuilderPage.test.tsx`: 9 filas en *Secciones* |

## Datos

- **5.1** El orden de 7 ids no estaba en `docs/cv-data.json` (las plantillas no declaran `sectionsOrder`) sino escrito a mano dos veces en `backend/scripts/seed.ts`. El seed ahora usa `SECTION_IDS` del dominio, en vez de agregar 13 copias del catálogo al JSON, que habría reintroducido la duplicación que el change elimina.
- **5.2** Consulta de solo lectura sobre la base de desarrollo: 14 perfiles revisados, **0 ids fuera del catálogo** en `sectionsOrder` ni en `sectionsHidden`. Repetirla en producción antes del primer despliegue que incluya este change, si para entonces hay datos.

## Navegador

API y frontend del change en puertos propios (3310 y 5175) contra una base aparte, `portfolio_verify`, migrada y cargada con el seed; la base de desarrollo no se tocó. Se comparó contra los servidores de `main` (3300 y 5173).

| Ruta | Antes (`main`) | Después |
|---|---|---|
| `/tech-lead-dotnet` — `sections` de la API | 7 ids, sin `projects` ni `presence` | 9 ids en orden canónico |
| `/tech-lead-dotnet` — renderizado | `… certifications, contact, projects, presence` (relleno del cliente, al final) | `… skills, projects, education, certifications, presence, contact` |
| `/` — renderizado | — | los 9 en orden canónico, igual que `sections` |

Mismas secciones antes y después; `projects` y `presence` pasan del final a su lugar. Sin errores en consola.

- [`verification/01-antes-tech-lead-dotnet.png`](verification/01-antes-tech-lead-dotnet.png)
- [`verification/02-despues-tech-lead-dotnet.png`](verification/02-despues-tech-lead-dotnet.png): Proyectos entre Skills y Educación
- [`verification/03-despues-home.png`](verification/03-despues-home.png)

## Desvíos respecto de los artefactos

- **5.1** apuntaba a `cv-data.json`; el cambio está en `seed.ts` (ver *Datos*). Tarea corregida.
- **3.3** pedía tipar `LAYOUTS` con `Record<SectionId, …>`, pero `LAYOUTS` está indexado por nombre de layout, no por sección. Lo que cumple el criterio es el registro de componentes (`SECTION_COMPONENTS`), que ya era `Record<SectionId, …>` y ahora toma `SectionId` del contrato.
- El perfil del panel (`AdminCuratedProfileResponse`) sigue declarando `sectionsOrder` como `string[]`: una fila anterior a la validación podría tener un id inválido y el contrato no debe prometer lo contrario. El constructor descarta esos ids al cargar, porque el panel no puede mostrarlos ni quitarlos y cada guardado daría 400; la API sigue rechazándolos.
- `proposal.md` lista `api-contract-types` como capability modificada, pero el change no trae delta spec para ella. El comportamiento lo cubre el test de deriva existente.
