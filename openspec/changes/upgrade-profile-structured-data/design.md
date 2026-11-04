# Design — upgrade-profile-structured-data

## Context

Ver `proposal.md`. Estado verificado el 4 de noviembre de 2026 sobre `main` (`2d8c221`, con `add-certification-verification` archivado):

- **Head del servidor.** `GET /api/public/profile-head` (`ProfileHeadController`, `@SkipThrottle`) llama a `GetProfileHeadUseCase`. La tabla de verdad (`resolvability(visibility, archivedAt, false)`) se evalúa antes de la caché de un minuto (`ProfileHeadCache`): archivado, `PROTECTED`, `PRIVATE` e inexistente devuelven `genericHeadMeta` (con `noindex` y sin `jsonLd`). Un perfil resoluble pasa por `CuratedProfileComposer.compose(curated, locale)` (el mismo servicio de la ruta pública) y `headMetaFromProfile` → `renderProfileHead`.
- **JSON-LD actual.** `personJsonLd(data)` emite `{ @context, @type: Person, name, jobTitle (headline del perfil curado o del base), email: mailto:, address: PostalAddress(addressLocality), sameAs? }`. `renderProfileHead` lo agrega solo si `meta.jsonLd && !meta.noindex`, serializado con `safeJson`, que hoy escapa solo `<`.
- **Cliente.** `frontend/src/shared/lib/document-meta.ts` tiene un `personJsonLd` idéntico; `metaFromProfile` lo pone en `jsonLd` **aunque `noindex` sea `true`**, y `setJsonLd` reutiliza el `<script type="application/ld+json">` que trajo el servidor (spec `public-portfolio-frontend`, *El escritor de metadatos del cliente es idempotente*). `CuratedProfileView` lo aplica con `globalThis.location.origin`. El módulo está en el JS público (lo importan la vista curada y la hoja imprimible).
- **Paridad.** `docs/fixtures/profile-head-consistency.json` alimenta `profile-head.consistency.spec.ts` (backend) y `document-meta.consistency.spec.ts` (frontend). Hoy compara título, descripción y canonical, no el JSON-LD.
- **Datos disponibles sin consultas nuevas** (`CuratedProfileOutput`): `slug`, `title`, `headline`, `description`, `visibility`, `sections` (las visibles, en su orden final y con relleno), `profile` (`fullName`, `headline`, `location`, `email`, `summary`…), `skillCategories[{ name, skills[] }]` (ya filtradas por tags), `education[{ degree, institution, … }]`, `certifications[{ name, issuer, year, verificationUrl, credentialId, expiresAt }]` y `socialLinks[{ url, … }]`, todo resuelto al idioma y solo con lo `visible`. **No** trae `updatedAt` ni `createdAt`.
- **`updatedAt` del perfil curado.** `CuratedProfile.updatedAt` es `@updatedAt`. `PrismaProfileViewRepository.record` hace `curatedProfile.update({ data: { views: { increment: 1 } } })` en cada visita `HUMAN`, y Prisma reescribe `updatedAt` en todo `update`. El sitemap usa ese mismo valor como `<lastmod>`.
- **CSP.** `frontend/Caddyfile`: `script-src 'self'` sin `'unsafe-inline'`; el comentario del archivo y la spec `site-security-policy` (*JSON-LD presente y sin violación*) ya registran que un bloque `application/ld+json` es un bloque de datos y no necesita hash ni nonce.
- **Presupuesto.** `perf:budget` exige ≤ 155 KB gzip y un solo JS de módulo; el último registro es 149,7 KB (`add-certification-verification`, tarea 6.7).

## Goals / Non-Goals

**Goals:** que cada perfil público declare con `ProfilePage` que su tema principal es el `Person`, con lo que sabe hacer, dónde estudió y qué credenciales tiene; que el bloque diga exactamente lo que la página muestra, en el idioma de la petición; que servidor y cliente no puedan divergir; que nada de esto aparezca para un perfil no indexable; sin consultas, datos, dependencias ni cambios de contrato.

**Non-Goals:** ver `proposal.md` § Non-goals.

## Decisions

### D1 — Envolver el `Person`, no reemplazarlo ni sumar otros tipos

El bloque pasa a ser un `ProfilePage` cuyo `mainEntity` es el `Person` de hoy, con sus mismos campos (`name`, `jobTitle`, `email`, `address`, `sameAs`) y las reglas de siempre. Sigue habiendo **un solo** `<script type="application/ld+json">` por documento (la spec del cliente lo exige).

El owner decidió el alcance: solo `ProfilePage`. Nada de `JobPosting`, `WebSite`, `BreadcrumbList` ni un `@graph` con varios nodos.

Alternativas descartadas:
- **Dos bloques (un `Person` y un `ProfilePage` que lo referencia por `@id`).** Rompe «un solo script» del escritor idempotente del cliente y obliga a cambiar `setJsonLd`.
- **Un `@graph` con `ProfilePage` + `Person` + `WebSite`.** Suma tipos fuera del alcance decidido.

### D2 — Forma exacta del bloque

```json
{
  "@context": "https://schema.org",
  "@type": "ProfilePage",
  "url": "<canonical>",
  "name": "<meta.title>",
  "description": "<meta.description>",
  "inLanguage": "es",
  "mainEntity": {
    "@type": "Person",
    "@id": "<origen>/#person",
    "url": "<origen>/",
    "name": "<profile.fullName>",
    "jobTitle": "<headline del perfil curado o del base>",
    "email": "mailto:<profile.email>",
    "address": { "@type": "PostalAddress", "addressLocality": "<profile.location>" },
    "sameAs": ["<socialLinks[].url>"],
    "knowsAbout": ["<D3>"],
    "alumniOf": [{ "@type": "EducationalOrganization", "name": "<institution>" }],
    "hasCredential": [
      {
        "@type": "EducationalOccupationalCredential",
        "name": "<name>",
        "recognizedBy": { "@type": "Organization", "name": "<issuer>" },
        "url": "<verificationUrl>",
        "identifier": "<credentialId>",
        "expires": "<expiresAt>"
      }
    ]
  }
}
```

- `url` es el **mismo** `canonical` del fragmento: absoluto sobre `FRONTEND_URL`, sin query (`via`, `src`, `lang` y `token` nunca entran), con `/` para `all`.
- `name` y `description` son **los mismos textos ya derivados** para `<title>` y la meta `description` (truncado a 300 incluido): no hay una segunda derivación que pueda divergir.
- `inLanguage` es el `Locale` de la petición (`es` o `en`), el mismo que decide `og:locale`.
- `@id` y `url` del `Person` apuntan a la home y son **iguales en todos los perfiles**: le dicen al buscador que los perfiles curados hablan de la misma persona.
- Las claves opcionales (`sameAs`, `knowsAbout`, `alumniOf`, `hasCredential` y, dentro de una credencial, `url`, `identifier` y `expires`) **se omiten** si quedan vacías o nulas; nunca se emite `[]` ni `null`.
- El orden de las claves es el de arriba, para que el fixture compare también la serialización.
- Sin `profile` (perfil base ausente) no hay bloque, como hoy.

Alternativa descartada: **`description` del `Person` con `profile.summary`.** Es un texto largo que ya está en la página y que `ProfilePage` no pide; el de la página es el que el owner escribió para la vacante.

### D3 — `knowsAbout` desde las skills ya resueltas

- Fuente: `skillCategories[].skills`, que el composer ya filtró por `filterTags` y overrides para ese perfil. Un perfil curado para .NET declara lo que muestra para .NET, no el catálogo completo.
- Se aplanan en el orden de categorías y de skills, se quitan repetidos comparando sin distinguir mayúsculas y sin espacios en los extremos (se conserva la primera aparición, tal como está escrita) y se cortan en **50** (`KNOWS_ABOUT_MAX`), para acotar el tamaño del head.
- Solo si `skills` está en `sections`. Si el owner ocultó la sección, el bloque no la menciona.
- Son strings (`Text`), no `DefinedTerm`: las skills no son bilingües y no hay un vocabulario externo al que enlazar.

Alternativa descartada: **los `filterTags` del perfil.** Son taxonomía interna de curaduría (`backend`, `lead`…), no lo que el visitante ve en la página.

### D4 — `alumniOf` y `hasCredential` entran, porque no piden datos nuevos

- **`alumniOf`:** una `EducationalOrganization` por `institution` distinta de `education`, en el orden de la sección y sin repetidos. El título (`degree`) no entra: `alumniOf` describe la institución y schema.org no tiene una forma simple de adjuntarle el título.
- **`hasCredential`:** una `EducationalOccupationalCredential` por certificación de la vista, en su orden: `name` (resuelto al idioma), `recognizedBy` `{ @type: Organization, name: issuer }` y, si existen, `url` (`verificationUrl`, siempre https por D3 de `add-certification-verification`), `identifier` (`credentialId`) y `expires` (`expiresAt` tal cual, `AAAA-MM` o `AAAA`, ISO 8601 de precisión reducida).
- Las certificaciones vencidas **se incluyen** con su `expires`: la página también las muestra, marcadas «Vencida» (P1 de `add-certification-verification`). El backend sigue sin calcular la vigencia (D5 de ese change).
- Cada lista solo si su sección (`education`, `certifications`) está en `sections`.

Alternativas descartadas:
- **Dejarlos para otro change.** `add-certification-verification` derivó `hasCredential` a este; los datos ya están en el DTO y el costo es el mismo que el de `knowsAbout`.
- **Filtrar las certificaciones vencidas.** Haría depender el bloque de la fecha del servidor (lo que D5 de ese change descartó) y diría menos que la página.

### D5 — Sin `dateModified` (ni `dateCreated`) en este change

La ficha pide `dateModified`, pero el único dato candidato no sirve:

- `CuratedProfile.updatedAt` cambia con **cada visita humana**, porque el incremento de `views` es un `update` y Prisma reescribe `@updatedAt`. Publicarlo diría «modificado» cuando solo hubo una visita, y expondría en una página pública **cuándo fue la última visita** a un perfil enviado a una empresa.
- Tampoco está en `CuratedProfileOutput`: emitirlo exigiría sumarlo al contrato público (OpenAPI, `api.d.ts`) para que el cliente lo repita, o que el cliente preserve un valor que solo conoce el servidor.
- En `ProfilePage` es **recomendado**, no obligatorio: el Rich Results Test no da error sin él.

Queda como **P1** (no bloqueante). El mismo defecto afecta al `<lastmod>` del sitemap y se informa ahí.

Alternativas descartadas:
- **Usar `updatedAt` igual.** Falso, y filtra la analítica.
- **Una columna nueva `contentUpdatedAt`.** Es un dato nuevo, con migración y reglas sobre qué edición la mueve (¿una experiencia nueva cambia todos los perfiles que la incluyen?): no entra en un change de esfuerzo S que promete «sin datos nuevos».

### D6 — El bloque solo existe donde la página es indexable, también en el cliente

- **Servidor:** la regla no cambia. Solo un perfil `PUBLIC` y no archivado (pedido por slug o por alias) compone y emite el bloque; archivado, `PROTECTED`, `PRIVATE` e inexistente devuelven el fragmento genérico, idéntico entre sí, con `noindex, nofollow` y **sin** JSON-LD. La ruta sigue sin aceptar token y sin registrar visitas. Un `PUBLIC` con `listed: false` emite el bloque, igual que hoy emite `index, follow`.
- **Cliente:** `metaFromProfile` deja `jsonLd` en `undefined` cuando `noindex` es `true`, y `setJsonLd` quita el bloque existente. Hoy un `PROTECTED` abierto con su token escribe el `Person` en el documento aunque la página sea `noindex`; con este change no escribe nada.
- Las dos ramas quedan como **tests de regresión**, como pide la ficha: e2e del fragmento con `PROTECTED` (con y sin token), `PRIVATE`, archivado e inexistente, y unitario del cliente con `visibility: 'PROTECTED'`.

Alternativa descartada: **dejar el cliente como está.** El dato no llega a un rastreador (sin token no resuelve), pero rompe la simetría que el fixture compartido tiene que poder afirmar y contradice la propia ficha («PROTECTED y PRIVATE no emiten nada»).

### D7 — Dos funciones puras gemelas y un fixture compartido como snapshot

- `profilePageJsonLd` reemplaza a `personJsonLd` en **los dos** lados (`profile-head.renderer.ts` y `document-meta.ts`), con la misma entrada (el perfil resuelto, el idioma, el origen y los `title`, `description` y `canonical` ya derivados) y la misma salida. La llaman `headMetaFromProfile` y `metaFromProfile`.
- `docs/fixtures/profile-head-consistency.json` suma a cada caso `sections`, `skillCategories`, `education`, `certifications` y `socialLinks`, y `expected.jsonLd` con el objeto completo (o su ausencia). Un caso nuevo cubre: skills repetidas con distinta capitalización, más de 50 skills, una institución repetida, una certificación con los tres campos de credencial y otra sin ninguno; otro, las secciones `skills`, `education` y `certifications` ocultas; otro, un perfil `PROTECTED` sin bloque.
- Los dos tests de consistencia comparan `meta.jsonLd` con `expected.jsonLd` por igualdad profunda **y** por `JSON.stringify` (orden de claves). El fixture versionado **es** el snapshot: no se usan archivos `.snap` de Jest, que el frontend no ve.
- Además, `profile-head.renderer.spec.ts` fija con un literal el `<script>` completo de un caso chico (golden test del escape de D8).

Alternativa descartada: **un paquete compartido** entre `backend/` y `frontend/`. `CLAUDE.md` decide dos carpetas independientes y monorepo solo si se comparte intensivamente; una función de 40 líneas no lo justifica, y el patrón fixture + dos tests ya es el del head.

### D8 — Escape del JSON embebido

- `safeJson` reemplaza `<` por `<`, `>` por `>`, `&` por `&`, U+2028 por ` ` y U+2029 por ` `. El resultado sigue siendo JSON válido, y `JSON.parse` devuelve el objeto original.
- Así ningún texto del perfil (título, titular, nombre de una certificación, una skill) puede cerrar el `<script>`, abrir un comentario (`<!--`) ni romper el HTML.
- El cliente sigue usando `script.textContent = JSON.stringify(data)`: `textContent` no interpreta HTML, así que no necesita escape.
- Test: un título `</script><script>alert(1)</script>` y una skill `C# & <F#>` producen un fragmento donde `</script` aparece una sola vez (el cierre propio), y el contenido del bloque, parseado, devuelve los textos originales.

### D9 — La CSP no cambia

`script-src 'self'` sin `'unsafe-inline'` se mantiene. Un `<script type="application/ld+json">` es un bloque de datos: el navegador no lo ejecuta y la CSP no lo evalúa. No hace falta nonce ni hash, y el bloque ya existe hoy sin violaciones (spec `site-security-policy`, *JSON-LD presente y sin violación*). La tarea de la app real lo vuelve a comprobar en la consola.

### D10 — Sin consultas, datos ni cambios de contrato; el cliente crece poco

- El servidor usa el `CuratedProfileOutput` que ya compone para el head: ninguna lectura nueva; la caché de un minuto y su clave quedan iguales.
- `openapi.json` y `api.d.ts` no cambian (D5 evita sumar `updatedAt`).
- El generador del cliente **sí** está en el JS público (lo importa la vista curada). Suma unos cientos de bytes; `perf:budget` tiene que seguir en ≤ 155 KB gzip con un solo JS de módulo, y se registra la diferencia.
- Sin dependencias nuevas.

Alternativa descartada: **que el cliente deje de escribir JSON-LD y solo conserve el del servidor.** Al navegar entre perfiles dentro de la SPA quedaría el bloque del perfil anterior (o ninguno), y en desarrollo o con el borde caído no habría bloque; la ficha pide cambiar los dos lados juntos.

### D11 — La validación de Google y schema.org es manual y después del deploy

El Rich Results Test necesita una URL pública (o el HTML pegado) y depende de un servicio de Google: no entra en el CI. TC-44 lo recorre con el sitio desplegado, como la verificación del Post Inspector de `add-server-rendered-head`, y además con el validador de schema.org. Antes del deploy, la tarea de la app real pega el HTML servido por la imagen de `frontend/Dockerfile` en el validador de schema.org (modo código), que no requiere URL pública.

## Risks / Trade-offs

- **[El Rich Results Test marca `expires` con precisión de mes]** → es ISO 8601 válido; si el validador lo marca como error (no como advertencia), la implementación omite `expires` en las credenciales `AAAA-MM` y lo registra en `verification.md`. No bloquea el resto.
- **[El head crece]** → con el CV real, unas 60 skills (50 tras el tope), 8 certificaciones y pocas instituciones: del orden de 3 a 4 KB más en el HTML inicial, sin comprimir. Caddy comprime el HTML.
- **[Google no muestra un resultado enriquecido para el portafolio]** → `ProfilePage` no lo garantiza; el valor está en que el tipo y la entidad queden claros para el buscador. Es lo que la propuesta estimó como impacto medio.
- **[Divergencia entre servidor y cliente]** → los dos tests leen el mismo fixture con el objeto completo y el orden de claves.
- **[Un perfil cambia de visibilidad]** → la tabla de verdad se evalúa antes de la caché: el bloque desaparece al instante; una edición de textos tarda hasta un minuto, como hoy.

## Migration Plan

1. Sin migración, sin variables y sin datos. El deploy es solo de código.
2. La caché del head se vacía sola en un minuto. LinkedIn y Slack no leen el JSON-LD, así que sus tarjetas no cambian.
3. Después del deploy: TC-44 (Rich Results Test y validador de schema.org con dos perfiles públicos) y, si el sitio ya está en Search Console, pedir la reindexación de la home.
4. **Rollback:** revertir el código devuelve el `Person` suelto; no hay datos que deshacer.

## Open Questions

Ninguna bloqueante.

- **P1 — ¿Cómo se suma `dateModified` (y de paso se corrige el `<lastmod>` del sitemap)?** Hoy `CuratedProfile.updatedAt` se mueve con cada visita humana, así que no sirve para ninguno de los dos (D5).
  - A) Change aparte `fix-curated-profile-updated-at`: el incremento de `views` deja de tocar `updatedAt` (`$executeRaw` sin `@updatedAt`, o el contador en otra tabla) y después `dateModified` y `<lastmod>` usan ese valor, sumándolo al DTO público.
  - B) Columna nueva `contentUpdatedAt`, movida por las ediciones del perfil curado y de su contenido.
  - C) Seguir sin `dateModified` y quitar `<lastmod>` del sitemap.

  **Recomiendo A**: es S, arregla un dato que hoy ya se publica mal en el sitemap (y deja ver el día de la última visita a un perfil listado) y no suma columnas. **[no bloqueante]**
