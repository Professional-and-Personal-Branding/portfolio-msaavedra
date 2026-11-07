# add-cv-consistency-rules — Linter del CV, capa 1: reglas deterministas sobre el contenido

> Change de la **Fase 1.3** de `docs/PROPUESTA-FEATURES.md` (§ 4, ítem **2.5** «Linter del CV. Capa 1 sin IA»; § 5.1, `computeYearsOfExperience` en `profile/domain/services`; § 6.2, fila `add-cv-consistency-rules`). La ficha pide: «Fast-check: ningún "años con X" contradice las fechas. `Profile.yearsOfExperience` se contrasta con `computeYearsOfExperience` […]. El 100 % de los errores sembrados se detecta». Aplica la **pregunta 20 resuelta con A**: `yearsOfExperience` sigue cargado a mano y el linter avisa si contradice las fechas. Respeta P1 = A (sin IA, sin servicios nuevos). La capa 2 (revisión con LLM) es `add-ai-cv-review`, otro change.

## Why

El CV vive en nueve tablas que se editan por separado (panel, API y seed) y nada mira el conjunto. Hoy hay inconsistencias que nadie ve hasta que las ve un reclutador:

- **Años declarados contra fechas.** `Profile.yearsOfExperience` se carga a mano y aparece en el hero de todos los perfiles. Con `docs/cv-data.json` vale `10`, pero las 15 experiencias, con los solapamientos fusionados, suman **103 meses (8 años y 7 meses)**, de 2018-02 a 2026-08. Puede haber experiencia previa que no está cargada, pero la plataforma no lo avisa.
- **El seed no pasa por el dominio.** `parseSeedSource` valida la forma de las experiencias (que `startDate` sea texto) pero no `validateExperience`: un `2024-13`, un fin anterior al inicio o una experiencia `current` con `endDate` llegan a la base, y el panel después se niega a guardarlas.
- **Traducciones y criterios.** El aviso de faltantes ES/EN existe, pero solo en la pestaña Publicación del constructor y para un perfil a la vez. Un `filterTag` que ya no coincide con nada, o un `includeIds` que apunta a un ítem borrado, no se ven fuera de la ficha.

Un conjunto de reglas puras, con un código estable y el ítem exacto al que apuntan, resuelve las tres cosas sin IA. Además deja `computeYearsOfExperience` listo para la carta con evidencia (2.3) y para la capa 2.

## What Changes

- **`computeYearsOfExperience`** (D2): servicio puro en `profile/domain/services`. Cuenta meses inclusivos, fusiona solapamientos y meses contiguos, y una experiencia actual cuenta hasta el mes de referencia (`asOf`). La entrada es una lista de intervalos genérica, así sirve para cualquier subconjunto.
- **Módulo `cv-consistency`** (D1) con una instantánea propia del CV (`CvSnapshot`) y reglas puras `(snapshot, contexto) → CvIssue[]`.
- **Catálogo de 14 reglas** (D4), con severidad `error`, `warning` o `info`, código estable, `entityType` + `entityId` y campo:
  - años declarados contra fechas (D3);
  - fechas con formato inválido, fin anterior al inicio, y «actual» o «en curso» con fecha de fin;
  - más de una experiencia actual;
  - traducciones faltantes y logros con distinta cantidad en ES y EN (D7);
  - URLs inválidas o sin https;
  - certificaciones vencidas;
  - en los perfiles curados: referencias huérfanas, ids en `includeIds` y `excludeIds` a la vez, `filterTags` sin coincidencias y perfiles sin experiencias.
- **Reglas que quedan fuera** con su motivo (D5): solapamientos de fechas, cruce de skills con tecnologías y respaldo temporal por skill.
- **`RunCvConsistencyCheckUseCase`** (D9): ocho lecturas en paralelo por los repositorios existentes (sin N+1), corre todas las reglas y no escribe nada.
- **`GET /api/admin/consistency`** (D10), con el guard del panel: resumen por severidad, años declarados y derivados, y la lista de hallazgos ordenada con su mensaje ya resuelto en el idioma pedido (D8).
- **Pantalla Revisión** (`/admin/revision`, D12): hallazgos agrupados por severidad y entidad, con un enlace que abre el ítem (`?editar=<id>` en Experiencias, Skills, Formación y Proyectos; la ficha en Perfiles curados).
- **`npm run cv:lint`** (D13): corre las mismas reglas sobre un archivo del seed (por defecto `docs/cv-data.json`), sin base. Sale con **1** si hay algún `error` y con **2** si el archivo no se puede leer. Corre en el job `backend` del CI con los dos archivos.
- **Errores independientes de la fecha** (D11): ninguna regla de severidad `error` depende de `asOf`, así el CI no cambia de resultado con el calendario.
- **Tests:** `fast-check` como devDependency del backend (D14), con propiedades sobre `computeYearsOfExperience` y la regla de años, y un fixture con un error sembrado por código: tiene que detectarse el 100 %.
- **Contrato y docs:** `backend/openapi.json` y `frontend/src/shared/types/api.d.ts` regenerados; `docs/MANUAL.md` e `index.html` (**TC-47**, B15 nueva), `docs/DATA-POPULATION.md` (cómo usar `cv:lint` antes de sembrar), `docs/CHANGELOG.md` y la línea del roadmap en `CLAUDE.md` al archivar.

## Non-goals

- **Capa 2 con LLM** (`add-ai-cv-review`).
- **Convertir `yearsOfExperience` en un valor derivado**: es la opción B de la pregunta 20, descartada por el owner. El linter no lo corrige ni lo sugiere como dato: solo avisa.
- **Corregir automáticamente.** Ninguna regla escribe; el panel enlaza al ítem y el owner decide.
- **Insignias «N años con X»** en el sitio (`skills-con-respaldo-temporal`, ROADMAP-1.1 § 5): siguen diferidas. Este change deja la función y la propiedad que esa idea pedía como condición, pero no agrega nada público.
- **Normalizar nombres de skills y tecnologías** («Java (8-21)» contra «Java»): es la normalización de `computeTagCoverage` (ítem 1.4).
- **Una tarjeta en el Dashboard** o avisos en otras pantallas: la revisión vive en su pantalla.
- **Correr el linter contra la base desde la terminal**: para la base está el panel; `cv:lint` lee el archivo del seed.
- **Bloquear un guardado** por un hallazgo: las reglas de escritura siguen siendo las de cada módulo.

## Capabilities

### New Capabilities

- `cv-consistency`: cálculo de los años de experiencia, catálogo de reglas, forma de un hallazgo, revisión por la API del panel y por la línea de comandos.

### Modified Capabilities

- `admin-backoffice-shell`: ADDED *Pantalla Revisión del CV*.
- `platform-manual`: MODIFIED *Manual del backoffice por pantalla* (suma la pantalla Revisión).

## Impact

- **Backend:**
  - `modules/profile/domain/services/compute-years-of-experience.ts` (nuevo, puro).
  - `shared/domain/i18n/missing-translation.ts`: extrae el predicado `isMissingTranslation` de `detect-missing-translations.ts`, que pasa a importarlo sin cambiar su comportamiento.
  - `modules/cv-consistency/` (nuevo):
    - `domain/`: `CvSnapshot`, `CvIssue`, `CvIssueCode`, `CvSeverity` y las reglas en `domain/rules/`;
    - `application/`: `RunCvConsistencyCheckUseCase`, `toCvSnapshot` (entidades → instantánea), el catálogo de mensajes y el DTO de salida;
    - `infrastructure/`: `AdminCvConsistencyController` y `cv-consistency.module.ts`.
  - `curated-profile.module.ts` exporta `CURATED_PROFILE_REPOSITORY`; `app.module.ts` registra el módulo nuevo.
- **Scripts:** `backend/scripts/cv-lint.ts` y `backend/scripts/lib/seed-to-cv-snapshot.ts` (reusa `parseSeedSource`); el script `cv:lint` en `package.json`.
- **Dependencias:** `fast-check` en `devDependencies` del backend. Nada en `dependencies`.
- **CI:** el job `backend` suma `npm run cv:lint` y `npm run cv:lint -- --file ../docs/examples/cv-data.example.json` antes de los tests.
- **Frontend (`features/backoffice/`):**
  - `revision/RevisionPage.tsx` y `revision/issue-links.ts`;
  - la ruta y el ítem **Revisión** en `AdminShell.tsx`;
  - `useCvConsistency` en `use-admin-api.ts`;
  - el parámetro `?editar=<id>` en Experiencias, Skills, Formación y Proyectos;
  - `api.d.ts` regenerado.
- **Docs:** `docs/MANUAL.md`, `docs/manual/index.html` y la captura `bo-revision.jpg`, `docs/DATA-POPULATION.md`, `docs/CHANGELOG.md`, `CLAUDE.md`.
- **Sin cambios** en el esquema de Prisma, las migraciones, las variables de entorno, las rutas públicas, la CSP ni Caddy.
- **Primera corrida:** con los datos del owner aparece al menos el aviso de años (10 declarados contra 8 años y 7 meses derivados). Es lo que se busca: el owner decide si corrige el número o carga la experiencia que falta.
