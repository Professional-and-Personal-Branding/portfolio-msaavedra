# unify-section-catalog — Un solo catálogo de secciones, con dueño

> Primer change de la ronda 1.1 (ver `docs/ROADMAP-1.1.md` § 4). Es un refactor de contrato, no una funcionalidad: corrige un defecto verificado y es prerrequisito de cualquier sección nueva.

## Why

El catálogo de secciones está definido **dos veces y las dos definiciones no coinciden**:

- `backend/src/modules/curated-profile/domain/services/resolve-sections.ts:2` — `DEFAULT_SECTIONS`, **7** ids: `hero`, `stats`, `experience`, `skills`, `education`, `certifications`, `contact`.
- `frontend/src/themes/layouts/sections.ts` — `KNOWN_SECTIONS`, **9** ids: los 7 anteriores más `projects` y `presence`.

Tres consecuencias, todas verificables hoy:

1. Un perfil sin `sectionsOrder` propio **nunca ordena `projects` ni `presence`**: el backend devuelve 7 ids y el frontend las agrega al final con su propia regla de relleno. El orden canónico se decide en dos lugares.
2. El array `sections` que devuelve la API **no es el orden final** que se renderiza, aunque su nombre y su spec lo sugieran. Quien consuma la API sin el frontend obtiene una respuesta incompleta.
3. `sectionsOrder` y `sectionsHidden` se validan como `@IsString({ each: true })`: un id mal escrito se acepta con 201 y después se ignora en silencio. No hay forma de que el panel ni la API avisen del error.

Mientras existan dos listas, cualquier sección nueva (los bullets de ajuste, la de evidencia) hay que agregarla en dos lados y nada falla si se olvida uno.

## What Changes

- **Una sola fuente de verdad**: el catálogo canónico de secciones vive en el dominio del backend con los **9** ids, en orden canónico, y se expone en el OpenAPI como un enum. El frontend deriva su tipo de los tipos generados (`api-contract-types`), así que deja de declarar su propia lista.
- **El backend pasa a ser dueño del orden final**: el composer aplica el orden, el ocultado **y la regla de relleno** (una sección conocida con datos que no figure en `sectionsOrder` se agrega al final). El array `sections` de la respuesta es el orden que se renderiza, sin post-proceso en el cliente.
- **Validación de ids**: `sectionsOrder` y `sectionsHidden` SHALL rechazar ids desconocidos con 400 y un mensaje que nombre el id inválido. Deja de ser posible guardar una sección inexistente.
- **Test de contrato**: un test falla si la lista del backend y la que derive el frontend dejan de coincidir, igual que el test de deriva que ya cubre `api.d.ts`.
- **Seed**: los 13 perfiles de plantilla pasan a declarar el orden completo de 9 ids, para que lo que se ve no dependa de una regla de relleno.

### Non-goals

- **Agregar secciones nuevas** (bullets de ajuste, evidencia). Este change deja el terreno listo; las secciones entran por sus propios changes.
- **Cambiar la semántica del motor de orden**: una sección oculta sigue oculta, una sección sin datos sigue sin renderizarse y el relleno sigue yendo al final. Lo único que cambia es **dónde** se aplica el relleno.
- **Cambiar los layouts** (`classic`, `sidebar`) ni el registro de componentes del frontend.
- Migración de Prisma: ninguna. `sectionsOrder` y `sectionsHidden` ya son `String[]`.

## Capabilities

### Modified Capabilities
- `layout-engine`: el catálogo deja de declararse en el frontend y se deriva del contrato; el cliente renderiza `sections` tal como viene.
- `curated-profile-resolution`: el composer aplica la regla de relleno y devuelve el orden final completo.
- `admin-curated-profile-crud`: validación de ids de sección en creación y edición.
- `api-contract-types`: el enum de secciones viaja en el OpenAPI y queda cubierto por el test de deriva.

## Impact

- **Backend**: `resolve-sections.ts` (catálogo y relleno), el DTO de curated profile (validación), el composer, y los specs de los tres.
- **Frontend**: `themes/layouts/sections.ts` pasa a derivar el tipo del contrato y pierde `hasData`, que se vuelve responsabilidad del backend; los layouts siguen igual.
- **Datos**: `docs/cv-data.json` — `sectionsOrder` de las 13 plantillas.
- **Riesgo**: bajo y detectable. El cambio es observable en el array `sections` de todos los perfiles, y los e2e existentes de resolución lo cubren. Un perfil guardado con un id inválido hoy (no hay ninguno en el seed) empezaría a dar 400 al editarse: se verifica antes de desplegar con una consulta de lectura.
