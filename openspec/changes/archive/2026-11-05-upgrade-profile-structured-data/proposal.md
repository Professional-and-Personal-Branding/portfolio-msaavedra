# upgrade-profile-structured-data — El head de cada perfil emite `ProfilePage` con el `Person` adentro

> Change de la **Fase 1.2** de `docs/PROPUESTA-FEATURES.md` (§ 4 E4 ítem **4.1**, § 6.1 y § 6.2 fila `upgrade-profile-structured-data`). La ficha pide: «Un perfil PUBLIC emite `ProfilePage` con `mainEntity` (el Person actual), `dateModified` y `knowsAbout`. `profile-head.consistency.spec.ts` pasa con el servidor y el cliente cambiados juntos. Que PROTECTED y PRIVATE no emitan nada se mantiene como test de regresión. Rich Results Test sin errores». El owner fijó el alcance en **solo `ProfilePage`**: sin `JobPosting` ni otros tipos. El botón share-offsite ya lo resolvió `add-share-links` (D12). Respeta P1 = A del 2026-10-28 (1.2 sin IA, sin OAuth y sin servicios nuevos).

## Why

Desde `add-server-rendered-head` el head de cada perfil público sale del servidor con un JSON-LD `schema.org/Person` (`personJsonLd()` en `profile-head.renderer.ts`, y su gemelo en `frontend/src/shared/lib/document-meta.ts`). Ese `Person` suelto no le dice al buscador **qué es la página**: Google documenta `ProfilePage` como el tipo de una página cuyo tema principal es una persona, con el `Person` en `mainEntity`. Envolverlo es barato (esfuerzo S, § 6.1) y hace que cada perfil curado se lea como «la página de perfil de Manuel para este rol», con lo que sabe hacer (`knowsAbout`), dónde estudió (`alumniOf`) y qué credenciales tiene (`hasCredential`, que `add-certification-verification` dejó explícitamente para este change).

Todo eso ya está en el DTO que resuelve el head (`CuratedProfileOutput`): no hace falta leer nada más de la base.

## What Changes

- **`ProfilePage` envuelve al `Person` actual** (D1, D2): el bloque `<script type="application/ld+json">` del fragmento de head pasa a ser un `ProfilePage` con `url` (el `canonical`, sin query), `name` y `description` (los mismos textos que `<title>` y la meta `description`, en el idioma de la petición), `inLanguage` y `mainEntity`. El `Person` conserva lo que emite hoy (`name`, `jobTitle`, `email`, `address`, `sameAs`) y suma un `@id` y una `url` estables (la home), iguales en todos los perfiles.
- **`knowsAbout`** (D3): las skills de las categorías ya resueltas para el perfil, aplanadas en su orden, sin repetidos y con un tope de 50. Solo si la sección `skills` está entre las que el perfil muestra.
- **`alumniOf` y `hasCredential`** (D4): las instituciones de la formación y las certificaciones visibles (con `recognizedBy`, `url` de verificación, `identifier` y `expires` cuando existen), solo si las secciones `education` y `certifications` se muestran. Ninguno requiere datos nuevos.
- **Sin `dateModified`** (D5): el único dato candidato, `CuratedProfile.updatedAt`, se mueve con **cada visita humana** (el incremento de `views` es un `update` y Prisma reescribe `@updatedAt`). Publicarlo sería falso y filtraría la hora de la última visita. Queda como P1, no bloqueante.
- **Mismo criterio de emisión** (D6): solo un perfil `PUBLIC`, no archivado, emite el bloque (hoy ya es así en el servidor). El cliente pasa a respetar lo mismo: con `noindex` (un `PROTECTED` abierto con token) **quita** el bloque en lugar de escribir uno.
- **Servidor y cliente cambian juntos** (D7): las dos funciones puras (`profilePageJsonLd`) se comparan contra el **mismo fixture** (`docs/fixtures/profile-head-consistency.json`, que suma `expected.jsonLd` por caso) en `profile-head.consistency.spec.ts` y `document-meta.consistency.spec.ts`. Ese fixture es el snapshot versionado.
- **Escape endurecido** (D8): el JSON embebido en el fragmento escapa `<`, `>`, `&`, U+2028 y U+2029 como `\uXXXX`; un `</script>` en un texto del perfil no puede cerrar la etiqueta. El cliente sigue escribiendo por `textContent`.
- **CSP, contrato y presupuesto** (D9, D10): sin cambios en la CSP (un bloque de datos no se ejecuta y `script-src` no se le aplica), en `backend/openapi.json`, en `api.d.ts`, en la caché del head ni en las dependencias. El generador del cliente vive en el JS público: suma unos cientos de bytes y `perf:budget` tiene que seguir ≤ 155 KB gzip.
- **Validación externa después del deploy** (D11): el Rich Results Test de Google y el validador de schema.org son pasos manuales de **TC-44**, como el Post Inspector de LinkedIn en `add-server-rendered-head`.
- **Docs:** `docs/MANUAL.md` y `docs/manual/index.html` (**TC-44**, § 2), `docs/DEPLOY.md` § 9.5 (una línea), `docs/RELEASE-1.0.0-CHECKLIST.md` (JSON-LD `ProfilePage`), `docs/CHANGELOG.md` y la línea del roadmap en `CLAUDE.md` al archivar.

## Non-goals

- **`JobPosting` y cualquier otro tipo de schema.org** (`WebSite`, `BreadcrumbList`, `Organization` propia, `ItemList` de proyectos): el owner limitó el alcance a `ProfilePage`.
- **`dateModified` y `dateCreated`**: esperan a que `updatedAt` signifique «editado» (D5, P1).
- **Cambiar lo que el `Person` ya emite** (`email`, `address`, `sameAs`): se muestran en el hero y no se re-litigan acá.
- **`worksFor` o `hasOccupation` derivados de las experiencias**: no los pide la ficha y aumentan el bloque sin beneficio documentado para `ProfilePage`.
- **Imagen del `Person`** (`image`): el perfil no tiene foto en el modelo; la imagen OG por perfil (ítem 4.3) es otro change.
- **JSON-LD en el panel, el preview del constructor o la hoja imprimible.**
- **Corregir que el contador de visitas mueva `updatedAt`** (afecta también al `<lastmod>` del sitemap): se informa en P1 como change aparte.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `public-seo`: MODIFIED *Datos estructurados del profesional* (`ProfilePage` con `mainEntity` `Person`, idioma y URL canónica) y MODIFIED *Contenido del fragmento de un perfil público* (el bloque pasa de `Person` a `ProfilePage`); ADDED *Lo que el profesional sabe, estudió y acredita*, *Escape del JSON-LD embebido* y *Sin datos estructurados fuera de lo indexable* (separados para que cada requisito quede bajo los 500 caracteres de `--strict`).
- `public-portfolio-frontend`: ADDED *El cliente escribe el mismo JSON-LD que el fragmento* (paridad con el servidor y sin bloque con `noindex`).

## Impact

- **Backend (`backend/src/`):** solo `modules/curated-profile/application/services/profile-head.renderer.ts` (`profilePageJsonLd` reemplaza a `personJsonLd`, `safeJson` endurecido) y sus specs (`profile-head.renderer.spec.ts`, `profile-head.consistency.spec.ts`). Sin cambios en el use case, el controller, la caché, los DTOs, Swagger ni Prisma.
- **Frontend (`frontend/src/`):** `shared/lib/document-meta.ts` (`profilePageJsonLd` y la regla de `noindex`) y sus specs (`document-meta.spec.ts`, `document-meta.consistency.spec.ts`).
- **Fixture compartido:** `docs/fixtures/profile-head-consistency.json` (los casos suman `sections`, `skillCategories`, `education`, `certifications` y `expected.jsonLd`).
- **E2e:** `backend/test/hardening.e2e-spec.ts` (bloque del fragmento de head).
- **Docs:** `docs/MANUAL.md`, `docs/manual/index.html`, `docs/DEPLOY.md`, `docs/RELEASE-1.0.0-CHECKLIST.md`, `docs/CHANGELOG.md`, `CLAUDE.md`.
- **Sin cambios** en la base, las migraciones, el seed, Caddy, la CSP, el sitemap, `robots.txt`, `openapi.json`, `api.d.ts`, la analítica ni `package.json`.
- **Operación:** sin migración ni variables nuevas. La caché del head (un minuto) hace que el bloque nuevo se vea, como mucho, un minuto después del deploy.
