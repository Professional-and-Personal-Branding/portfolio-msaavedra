# add-job-posting-intake — De una vacante a un borrador de perfil curado, sin IA

> Change de la **Fase 1.3** de `docs/PROPUESTA-FEATURES.md` (§ 4, épica E2, ítem **2.1** «Entrada de vacante»; § 5.1 módulo `job-posting`; § 6.2, fila `add-job-posting-intake`; § 8, riesgo SSRF). La ficha pide: «Con fixtures de los tres ATS y de JSON-LD se obtiene un `JobPosting`. Los hosts bloqueados responden «pegá el texto». Una IP privada o un redirect a una IP privada se rechaza. `job-posting` no importa ningún repositorio de `curated-profile` (test de arquitectura). El borrador queda PRIVATE con `filterTags` ⊆ vocabulario». Respeta las decisiones del owner: **P14 = A** (la cobertura se ve solo en el panel, resuelta el 2026-11-07) y **P5 = B** (el texto de la vacante se guarda 90 días, resuelta el 2026-11-12). Es **independiente** de `add-integrations-foundation`, que se diseña en paralelo: la importación es una acción síncrona del owner en el panel, no un trabajo encolado (D2).

## Why

Para cada vacante, el owner arma a mano un perfil curado: lee la descripción, adivina qué tags de sus datos le sirven y prueba en el constructor hasta que el preview cierra. Es el paso más repetido de la búsqueda y el que más depende de la memoria. La mayoría de las vacantes técnicas se publican en tres ATS con API pública de job board (Greenhouse, Lever y Ashby) o en páginas de empleo con un bloque JSON-LD `JobPosting`; el resto se puede pegar como texto.

Con eso alcanza para un primer paso **determinístico**: normalizar la vacante, detectar qué tecnologías y temas pide, cruzarlos con el vocabulario real de tags del owner y proponerle los criterios con su cobertura («cubre 6 de 9 requisitos detectados»). El owner decide; el borrador nace privado y se termina en el constructor de siempre. La versión con IA (`add-ai-vacancy-to-profile`, Fase 2.0) se apoya en esto.

## What Changes

- **Módulo nuevo `job-posting`** (D1) con Clean Architecture completa: entidad `JobPosting`, servicios puros (`checkUrlPolicy`, `classifyClosedPortal`, `matchAtsUrl`, `detectTerms`, `computeTagCoverage`, `extractFromPastedText`, `slugifyDraft`), casos de uso `ImportJobPostingUseCase`, `ListJobPostingsUseCase`, `GetJobPostingUseCase`, `DeleteJobPostingUseCase`, `SuggestProfileCriteriaFromPostingUseCase` y un puerto de lectura `JobPostingReader` que exporta para `curated-profile`. **No escribe en `CuratedProfile`.**
- **Fuentes** (D3, D4): un `JobPostingSource` por ATS (Greenhouse, Lever, Ashby) que llama a su API pública de job board, y un respaldo JSON-LD que lee el bloque `JobPosting` de una página https cualquiera que no sea un portal cerrado. El puerto vive en `job-posting/application/ports/`, no en `integrations/` (D2).
- **Portales cerrados** (D5): LinkedIn (incluido `lnkd.in`), Indeed, Glassdoor, Wellfound, Computrabajo, Bumeran, Laborum, ZonaJobs, Workana, Upwork, Torre, Get on Board y los agregadores con ToS restrictivos responden **422** con «pegá el texto», sin ninguna petición saliente; también si un redirect lleva a uno de ellos.
- **Texto pegado** (D6): extracción determinística de título, modalidad, tipo de empleo, idioma y términos; sin LLM.
- **Guarda SSRF** (D7–D10): solo https al puerto 443, sin credenciales ni IP literales ni nombres locales; resolución DNS validada **en el momento de conectar** (rechazo de privadas, loopback, link-local, metadata, CGNAT, ULA, multicast, reservadas e IPv4 mapeadas en IPv6); revalidación completa en cada redirect (máximo 3); plazo total de 10 s; tope de 2 MiB (HTML) o 5 MiB (JSON de ATS) medido después de descomprimir; `Content-Type` esperado; solo `GET`, sin cookies ni credenciales. Sin dependencias nuevas (`node:https`, `node:dns`, `net.BlockList`, `zlib`).
- **Detección y cobertura** (D11, D12): un diccionario versionado de términos con alias bilingües más los tags del propio vocabulario; `computeTagCoverage` (puro) devuelve los tags cubiertos con su evidencia, los términos sin respaldo, la proporción y los `filterTags` sugeridos, **siempre ⊆ vocabulario**.
- **Texto 90 días** (D13, P5 = B): la descripción se guarda con `textPurgeAt = importación + 90 días` y se borra de forma perezosa al listar, leer o importar, y con `npm run job-postings:purge`; los metadatos y los términos detectados quedan.
- **API del panel** (D14) bajo `/api/admin/job-postings`: importar (`POST`, 201 nueva o 200 reimportada), listar, leer, borrar y `GET /:id/suggestion`. Límite propio de **10 importaciones por minuto** (D15). Errores de importación como **422** con un mensaje que termina en «Pegá el texto de la vacante.» (D16).
- **Borrador desde `curated-profile`** (D17): `POST /api/admin/curated-profiles/from-job-posting` con `CreateCuratedProfileFromJobPostingUseCase`, que lee la vacante por el token `JOB_POSTING_READER`, valida `filterTags` ⊆ vocabulario y crea el perfil `PRIVATE`, no enumerado, con el slug libre.
- **Pantalla «Crear desde una vacante»** (D18) en `/admin/perfiles/desde-vacante`, a la que se llega con el botón **Desde una vacante** de Perfiles curados; sin ítem nuevo en la navegación.
- **Test de arquitectura** (D19): `job-posting` no importa nada de `curated-profile` ni escribe `curatedProfile`; `curated-profile` solo importa de `job-posting` su puerto de lectura; la ruta pública no depende de `job-posting`.
- **Migración solo aditiva** (D20): tabla `JobPosting` y enums `JobPostingSourceKind` y `WorkplaceType`.
- **Contrato y docs:** `backend/openapi.json` y `frontend/src/shared/types/api.d.ts` regenerados; `docs/MANUAL.md` e `index.html` con el caso **TC-51** y la pantalla **B17**; `docs/ARCHITECTURE.md`, `docs/CHANGELOG.md`; la línea del roadmap en `CLAUDE.md` al archivar.

## Non-goals

- **IA**: ni para el texto libre ni para elegir tags (`add-ai-vacancy-to-profile`, Fase 2.0).
- **Scraping** de cualquier portal cerrado, ni el respaldo JSON-LD sobre ellos (§ 2 de la propuesta).
- **Radar o feeds de vacantes** (`add-job-radar`), búsqueda en los boards o sincronización periódica: cada importación la dispara el owner.
- **Cola, scheduler o cifrado** de `add-integrations-foundation`: este change no los usa ni los espera.
- **Cobertura en público** (P14 = A): nada de `job-posting` llega a la vista pública, al head, al sitemap ni al JSON-LD.
- **Republicar la vacante**: no se emite JSON-LD `JobPosting` ni se muestra fuera del panel.
- **Vincular el borrador o una postulación a la vacante** (`CuratedProfile.sourceJobPostingId`, crear una `Application` desde la vacante): quedan para un change posterior (D21).
- **Editar la vacante importada** o el diccionario de términos desde el panel: el diccionario es código versionado (D11).
- **`http://`** sin TLS (D7).

## Capabilities

### New Capabilities

- `job-posting-intake`: importación desde ATS, JSON-LD y texto pegado, portales cerrados, guarda SSRF, límites de la descarga, normalización y reimportación, detección de términos, cobertura y sugerencia, conservación del texto, API del panel, separación de módulos y la pantalla «Crear desde una vacante».

### Modified Capabilities

- `admin-curated-profile-crud`: ADDED *Borrador de perfil desde una vacante* y *Tags del borrador dentro del vocabulario*. No se reescribe *Creación validada con slug único*.
- `curated-profile-builder`: ADDED *Acceso a la creación desde una vacante*. La propuesta (§ 6.2) anotaba un MODIFIED; se prefiere ADDED para no reescribir *Listado y ficha de perfiles curados*, que tocan otros changes en paralelo.
- `api-rate-limiting`: ADDED *Límite reforzado en la importación de vacantes*.
- `platform-manual`: ADDED *Pantalla Crear desde una vacante en el manual*, en lugar de reescribir *Manual del backoffice por pantalla*.

## Impact

- **Base (`backend/prisma/`):** modelo `JobPosting`, enums `JobPostingSourceKind` y `WorkplaceType`, índice único por `sourceKey` e índices por `importedAt` y `textPurgeAt`. Una migración nueva, aditiva; ninguna tabla existente cambia.
- **Backend:**
  - `modules/job-posting/` nuevo: `domain/` (entidad, servicios puros, diccionario, lista de portales cerrados, errores, puertos `JobPostingRepository` y `TagVocabularyReader`), `application/` (casos de uso, DTOs, puertos `JobPostingSource`, `SafeHttpClient` y `JobPostingReader`), `infrastructure/` (controller, DTOs, fuentes por ATS y JSON-LD con fixtures, cliente HTTP seguro, adaptadores Prisma) y `job-posting.module.ts`.
  - `shared/domain/tag-vocabulary.ts` (puro): vocabulario de tags desde experiencias, skills y proyectos visibles, usado por los dos módulos.
  - `curated-profile`: `CreateCuratedProfileFromJobPostingUseCase`, ruta `POST /api/admin/curated-profiles/from-job-posting`, lector de vocabulario y la importación de `JobPostingModule`.
  - `app.module.ts`: importa `JobPostingModule`. `backend/scripts/purge-job-posting-text.ts` y el script `job-postings:purge`.
  - `test/architecture.spec.ts`: tres reglas nuevas.
- **Frontend (`frontend/src/features/backoffice/`):** `job-postings/` (página, formulario, resultado, cobertura, hooks y schema Zod), botón en `curated-profiles/ProfilesPage.tsx` y ruta en `BackofficeApp.tsx`; `api.d.ts` regenerado. Todo en el chunk del panel.
- **Scripts:** `frontend/scripts/check-a11y.mjs` (la pantalla nueva vacía, con un análisis y con errores) y `frontend/scripts/capture-manual.mjs` (captura con una vacante pegada ficticia, sin red).
- **Docs:** `docs/MANUAL.md`, `docs/manual/index.html`, `docs/manual/bo-desde-vacante.jpg`, `docs/ARCHITECTURE.md`, `docs/CHANGELOG.md`, `CLAUDE.md`.
- **Sin cambios** en Caddy, la CSP (las peticiones salen del backend, no del navegador), CORS, la cookie, las variables de entorno, el seed, la ruta pública ni las dependencias de `package.json`.
