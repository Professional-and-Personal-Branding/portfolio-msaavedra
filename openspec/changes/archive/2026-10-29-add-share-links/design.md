# Design — add-share-links

## Context

Ver `proposal.md`. Estado verificado el 29 de octubre de 2026 sobre la rama `feat/classify-profile-views` (PR #40, `42890de`), que ya trae `ProfileView.kind` y `byKind`:

- **El referrer no llega.** `frontend/Caddyfile` pone `Referrer-Policy no-referrer` en el bloque global de cabeceras. La SPA pide el perfil con `api.GET('/api/curated-profiles/{slug}', { params: { query: { locale } } })` (`features/curated-view/hooks/use-curated-profile.ts`) y `public/profile-prefetch.js` con `fetch(url, { credentials: 'include' })`; ninguno reenvía `document.referrer`. `normalizeReferrer` convierte el `Referer` vacío en `directo`.
- **Registro.** `CuratedProfileController.findBySlug` arma el `ViewContext` (`locale`, `referrer`, `userAgent`, `ipHash`, `sessionToken`). `ResolveCuratedProfileUseCase.execute` compone, entrega `recordView` a `BackgroundTasks` y responde; `recordView` valida la sesión, clasifica con `classifyVisit` y llama a `ProfileViewRepository.record`, todo dentro de un `try/catch` que deja un `warn`.
- **Query pública.** `CuratedProfileQueryDto` extiende `LocaleQueryDto` con `token`. `main.ts` aplica un `ValidationPipe` global solo con `transform`; el `whitelist` y `forbidNonWhitelisted` viven en `adminValidationPipe`. Hoy un `?via=` desconocido no rompe nada, pero tampoco se documenta ni se usa.
- **Petición temprana.** El script deja `window.__portfolioEarlyProfile = { key: JSON.stringify([slug, locale, token]), response }`. La app la toma una sola vez en `takeEarlyProfile(slug, locale, token)` si la clave coincide. `early-profile.spec.ts` ejecuta el script sobre una matriz de rutas × búsquedas × idiomas y exige la misma clave, la misma URL y la misma cabecera que la app. Caddy sirve `/profile-prefetch.js` con `Cache-Control: no-cache` (D5 de `improve-mobile-performance`).
- **Estado de la URL.** `readUrlState` lee `lang`, `theme`, `layout` y `token`. `buildProfileLink` (enlaces del menú de la home) copia **todos** los parámetros de la URL actual salvo `token`: hoy un `?via=` de la home viajaría al perfil siguiente.
- **Metadatos.** `metaFromProfile` arma `canonical` con el origen y la ruta del slug, sin query; `og:url` usa el mismo valor. El fragmento de head lo pide `index.html` con `slug` y `lang` solamente.
- **Agregado.** `AggregateProfileViewsUseCase` combina `aggregate`, `countByReferrer` y `countByKind`; los desgloses cuentan solo `HUMAN` (P19 = A).
- **Constructor.** La pestaña Publicación de `ProfileBuilderPage.tsx` tiene visibilidad y token, el link público (copiar y abrir), los controles de ciclo de vida y el aviso de faltantes.
- **Specs vigentes que chocan.** *Agregado por origen de la visita* (en el texto que deja `classify-profile-views`) dice que MUST NOT persistirse ningún dato de origen nuevo; *Petición temprana del perfil* fija la clave en slug, idioma y token; *Borrado* y *El duplicado nace retirado* no conocen los enlaces.

## Goals / Non-Goals

**Goals:** que cada visita humana se pueda atribuir al destinatario o al portal que recibió el link, sin depender del referrer; que el código viaje igual por la app y por la petición temprana, sin visitas dobles; que la ruta pública no gane latencia, no cambie su respuesta y no deje de ser anónima; que un código no se pueda adivinar ni sirva para saltarse un token; que el SEO no vea los links con código como páginas aparte.

**Non-Goals:** ver `proposal.md` § Non-goals.

## Decisions

### D1 — `ShareLink` es un agregado del módulo `curated-profile`, con código y portal inmutables

```prisma
enum ShareLinkKind { MANUAL LINKEDIN_POST }

model ShareLink {
  id               String         @id @default(cuid())
  code             String         @unique
  curatedProfile   CuratedProfile @relation(fields: [curatedProfileId], references: [id], onDelete: Cascade)
  curatedProfileId String
  label            String         // escrita por el owner; 1 a 80 caracteres
  portal           String?        // normalizado como `src` (D3)
  kind             ShareLinkKind  @default(MANUAL)
  createdAt        DateTime       @default(now())
  revokedAt        DateTime?
  profileViews     ProfileView[]

  @@index([curatedProfileId])
}
```

- La entidad de dominio (`domain/entities/share-link.entity.ts`) expone `isActive()` (sin `revokedAt`), `belongsTo(curatedProfileId)`, `rename(label)` y `revoke(now)`, con `Result` para la validación de la etiqueta. Sin decoradores ni Prisma.
- **Inmutables:** `code`, `portal`, `kind` y el perfil. Cambiar el portal de un enlace ya enviado reescribiría la atribución de visitas pasadas; para otro portal se crea otro enlace. La **etiqueta** sí se edita (un error de tipeo no justifica un enlace nuevo).
- **Revocación irreversible** e idempotente: revocar uno revocado devuelve el mismo `revokedAt`. Reactivar abriría la pregunta de qué pasa con las visitas mientras estuvo revocado; el owner crea otro.
- **Sin borrado** de enlaces: la historia de atribución se conserva. Se borran solo en cascada con el perfil (D15).
- La etiqueta no es traducible (es dato interno del panel, nunca se publica), así que es un `String` plano y no un `LocalizedText`.

Alternativas descartadas:
- **Un módulo `share-link` aparte.** La resolución pública necesita buscar el enlace y la gestión necesita validar el perfil: dos módulos que se piden datos en los dos sentidos. El enlace no vive sin su perfil (se borra con él), que es la definición de un agregado subordinado. La propuesta (§ 5.1) ya lo ubica en `curated-profile`.
- **Guardar el código dentro de `CuratedProfile`** (un arreglo JSON). Sin unicidad global en la base, sin FK desde `ProfileView` y con escrituras concurrentes sobre la fila del perfil.

### D2 — Código de 10 caracteres en base32 de Crockford, aleatorio y único en toda la base

- **Alfabeto:** `0123456789abcdefghjkmnpqrstvwxyz` (32 símbolos, sin `i`, `l`, `o`, `u` para que no se confundan al dictarlo o copiarlo a mano). **Longitud 10:** 50 bits, unos 10^15 códigos.
- **Generación:** el puerto `ShareCodeGenerator` (aplicación) devuelve un código; `CryptoShareCodeGenerator` (infraestructura) toma 10 bytes de `crypto.randomBytes` y usa los 5 bits bajos de cada uno (32 divide a 256: sin sesgo). La codificación y el formato son una función pura de dominio (`share-code.ts`: `encodeShareCode(bytes)`, `isShareCode(value)`, `normalizeShareCode(raw)`).
- **Unicidad:** índice único global sobre `code`. `CreateShareLinkUseCase` reintenta hasta 3 veces si el repositorio informa colisión (el adaptador traduce el `P2002` de Prisma a un error de dominio); con 50 bits una colisión es prácticamente imposible, pero el reintento evita un 500 teórico.
- **Formato al leer:** `normalizeShareCode` recorta espacios, pasa a minúsculas y exige exactamente 10 símbolos del alfabeto; si no, devuelve `null` y **no se consulta la base**.
- **Único en toda la base, no por perfil:** así un `via` de otro perfil se reconoce como tal y no se atribuye (D7), y no hace falta el slug para buscarlo.

Alternativas descartadas:
- **El `cuid` del enlace como código.** Largo (25 caracteres) y en parte predecible (lleva un timestamp y un contador).
- **Un código legible elegido por el owner** (`?via=acme`). Adivinable: cualquiera que vea `?via=acme` prueba `?via=globex` y ensucia la atribución del otro destinatario. La etiqueta legible queda en el panel.
- **Base62 con mayúsculas.** Más denso, pero sensible a mayúsculas: un cliente que normaliza la URL o una persona que lo tipea rompe la atribución.
- **Un HMAC del perfil y la etiqueta** (sin tabla). No se puede revocar ni listar, y cambiar la etiqueta cambiaría el código.

### D3 — `src` se guarda en `ProfileView.source`, sin crear filas de `ShareLink`

La decisión P2 dice que `src` es «un `ShareLink` implícito por portal, sin gestión». Se implementa sin materializar el enlace:

- `normalizeSource(raw)` (dominio, puro): recorta, pasa a minúsculas y exige `^[a-z0-9][a-z0-9-]{0,31}$`; si no cumple, `null`. La misma función normaliza el `portal` de un `ShareLink` al crearlo (allí un valor inválido es 400, porque lo escribe el owner).
- `ProfileView.source String?` guarda el portal efectivo de la visita: el `portal` del enlace si el `via` es válido y activo y tiene portal; si no, el `src` normalizado; si no, `null` (D7).
- El agregado `bySource` agrupa por esa columna (D9).

Alternativas descartadas:
- **Un `ShareLink` de tipo `PORTAL` creado bajo demanda** con un nombre canónico por perfil y portal. La ruta pública pasaría a **escribir** en una tabla de gestión, con un `upsert` concurrente, y cualquiera podría crear filas arbitrarias con `?src=lo-que-sea`, que aparecerían en la lista de enlaces del panel. Además la búsqueda del enlace dejaría de ser una lectura.
- **Guardar `src` crudo y normalizar al agregar** (como `referrer`). `src` es un dato nuevo y no tiene un formato externo que respetar; normalizar al escribir deja la columna limpia y el `GROUP BY` directo.
- **Un catálogo cerrado de portales.** Obligaría a un deploy por cada portal nuevo (Computrabajo, Get on Board, un meetup). Ver la pregunta P1.

### D4 — `via` y `src` viajan como query de `GET /api/curated-profiles/:slug`

- La SPA los lee de su URL con `readUrlState`, que suma `via` y `src` (vacío → `null`, como `token`), y `fetchCuratedProfile(slug, locale, token, attribution)` los manda en la query **en este orden**: `locale`, `via`, `src`, omitiendo los nulos. La clave de TanStack Query pasa a `['curated-profile', slug, locale, token, via, src]`.
- El cliente **no valida ni normaliza** el formato: manda el valor tal como está en la URL. La validación es del servidor (D2, D3), así la app y el script no pueden divergir en una regla.
- `CuratedProfileQueryDto` declara `via` y `src` opcionales para el OpenAPI, con un `@Transform` que toma el primer valor si llegan repetidos y descarta lo que no sea texto. **No lleva validadores que rechacen**: un link mal copiado nunca da 400 y el perfil se ve igual.
- La URL de la SPA **no se limpia** después de cargar: quitar `via` cambiaría la clave y dispararía otra petición (otra visita). Si el destinatario reenvía la URL, esas visitas se atribuyen a su enlace, que es información útil (el link circuló). Ver la pregunta P3.

Alternativas descartadas:
- **Una cabecera (`X-Share-Via`).** La petición temprana tendría que agregarla igual, y en el OpenAPI y en los logs es menos visible que un parámetro; no aporta privacidad (el código ya está en la URL de la página).
- **Una cookie que la SPA fija al llegar.** Persiste más allá de la visita (atribuiría también visitas posteriores sin código), es un dato nuevo en el cliente y choca con la regla de no guardar estado en el navegador.
- **Un endpoint aparte (`POST /api/share-links/:code/open`).** Una segunda petición por carga, una segunda fila que reconciliar con el `ProfileView` y un endpoint público nuevo que contar y limitar.

### D5 — La misma clave en la app y en la petición temprana: `[slug, locale, token, via, src]`

- `profile-prefetch.js` lee `via` y `src` con `URLSearchParams` (`get(...) || null`, igual que `token`), los agrega a la URL (`&via=<encodeURIComponent>`, `&src=...`, en el orden de D4) y a la clave: `JSON.stringify([slug, locale, token, via, src])`.
- `earlyProfileKey` y `takeEarlyProfile` reciben los mismos cinco valores.
- `early-profile.spec.ts` suma a `SEARCHES`: `?via=k7m2q9xw4t`, `?via=`, `?src=linkedin`, `?src=LinkedIn`, `?via=a%20b`, `?via=x&via=y` y `?lang=en&token=abc&via=k7m2q9xw4t&src=indeed`. La aserción de URL (`script === app`) ya cubre orden y codificación.
- Un test nuevo en `use-curated-profile.test.tsx`: con `?via=` en la URL, una carga hace **una** llamada a `fetch` (la respuesta temprana se reusa).
- El `Cache-Control: no-cache` del script no cambia; se verifica sobre la imagen (tarea 7.3), porque un script viejo en caché con la clave de tres elementos haría que la app no tome la respuesta y pida otra vez: una visita doble.

Alternativas descartadas:
- **Dejar `via` fuera de la clave** y agregarlo solo a la petición de la app. La app reusaría la respuesta temprana (que no llevaba `via`) y la visita quedaría sin atribuir; o el script lo mandaría y la app no, y una carga sin respuesta temprana perdería la atribución. Tiene que estar en los dos lados y en la clave.
- **Que el script lea la clave de un módulo compartido con la app.** El script es clásico a propósito (D5 de `improve-mobile-performance`): sin módulos, para no esperar al bundle.

### D6 — La atribución se resuelve dentro de la tarea en segundo plano

`ViewContext` suma `via?: string` y `src?: string` (crudos). En `recordView`, después de la sesión y antes de `record`:

1. `code = normalizeShareCode(via)`; si es `null`, no hay consulta.
2. Si hay código: `shareLinks.findByCode(code)` (lectura por índice único).
3. `resolveShareAttribution({ curatedProfileId, link, src })` (dominio, puro) devuelve `{ shareLinkId, source }` con las reglas de D7.
4. `profileViews.record({ ..., kind, shareLinkId, source })`.

Un fallo en la búsqueda del enlace se trata como «sin enlace» (la visita se registra igual, con `src` si vino) y deja un `warn` sin el código. La respuesta nunca espera la búsqueda: sigue valiendo *La respuesta pública no espera al registro de la visita*, sin modificarlo.

Alternativas descartadas:
- **Buscar el enlace antes de responder.** Una consulta más en el camino de cada visita pública, y la tentación de cambiar la respuesta según el enlace (que filtraría si un código existe).
- **Guardar `via` crudo y resolver al agregar.** Un enlace revocado después de la visita perdería atribuciones que fueron válidas, y el agregado necesitaría la lógica de dominio en SQL.

### D7 — Reglas de atribución

| `via` | Resultado |
| --- | --- |
| ausente, vacío o malformado | `shareLinkId: null` |
| bien formado pero inexistente | `shareLinkId: null` |
| de otro perfil (el `curatedProfileId` no coincide) | `shareLinkId: null` |
| revocado (`revokedAt` no nulo al registrar) | `shareLinkId: null` |
| activo y del mismo perfil | `shareLinkId: <id>` |

`source = (enlace atribuido && enlace.portal) ? enlace.portal : normalizeSource(src)`.

- La comparación es por `curatedProfileId`, no por slug: un enlace creado antes de un renombrado sigue atribuyendo cuando se abre por el alias (`curated-profile-resolution`, *Resolución por slug anterior*).
- La atribución se guarda en **todas** las filas, sea cual sea el `kind`, para no perder información; las aperturas (D10) y los desgloses (D9) cuentan solo `HUMAN`. El owner que prueba su propio link con la sesión abierta registra una fila `OWNER` con el enlace, que no suma.
- Un enlace revocado **no bloquea** el perfil: responde 200 igual. Revocar es «dejar de atribuir»; cortar el acceso es `PROTECTED`, `PRIVATE` o archivar.
- La respuesta pública es **byte a byte la misma** con un `via` válido, revocado, inexistente o sin `via`: no se puede usar para enumerar códigos.

### D8 — PROTECTED: el `via` no reemplaza al token

- `resolvability` no cambia: un perfil `PROTECTED` sin token válido da 401 aunque traiga un `via` válido, y un 401 no registra nada (como hoy).
- El link que copia el constructor para un perfil `PROTECTED` es `/{slug}?token=<token>&via=<código>`.
- Si el destinatario entra sin token y lo escribe en el formulario, la SPA refleja `?token=` en la URL conservando `via` y `src` (el formulario usa `writeUrlState`, que solo toca las claves que se le pasan), así que la visita del reintento se atribuye.
- El botón de LinkedIn no se ofrece para `PROTECTED` (D12): publicaría el token.

Alternativa descartada: **que un `via` válido abra un `PROTECTED` sin token** («el link es la credencial»). Convertiría cada enlace en un segundo token sin el control de `accessToken`, y revocar pasaría a ser control de acceso, que es otra decisión de producto.

### D9 — Desgloses `byShareLink` y `bySource` en el agregado

- `ProfileViewRepository.countByShareLink(range)` agrupa las visitas `HUMAN` del rango con `shareLinkId` no nulo y devuelve, por enlace, `{ shareLinkId, code, label, slug, portal, revoked, views }` (el adaptador Prisma hace el `groupBy` y lee los enlaces y los slugs de sus perfiles). Orden: visitas descendente; desempate por etiqueta.
- `countBySource(range)` agrupa las visitas `HUMAN` con `source` no nulo: `{ source, views }`, descendente.
- Las visitas sin enlace o sin portal **no** forman una fila: el dashboard muestra «sin enlace» y «sin portal» como `total − suma` (así la suma de cada desglose es ≤ `total` y no se inventa un nombre de portal reservado que pueda chocar con un `src` real).
- Un enlace de un perfil archivado sigue apareciendo (las visitas se conservan, `curated-profile-resolution`), con su slug.
- `byReferrer` no cambia (no se modifica *Normalización del origen de la visita*): sigue informando lo que llegue en el header, y el manual explica que en producción será casi siempre `directo`.

Alternativa descartada: **mezclar la atribución en `byReferrer`** (que el portal del enlace reemplace al host). Dos fuentes con semánticas distintas en una misma tabla, y el host real dejaría de verse el día que algún cliente sí lo mande.

### D10 — API del panel para los enlaces

Todas con `JwtAuthGuard` y `adminValidationPipe`, en un `AdminShareLinkController` nuevo de `curated-profile/infrastructure`:

| Método y ruta | Cuerpo | Respuesta |
| --- | --- | --- |
| `GET /api/admin/curated-profiles/:id/share-links` | — | 200 `ShareLink[]` (más recientes primero); 404 si el perfil no existe |
| `POST /api/admin/curated-profiles/:id/share-links` | `{ label, portal? }` | 201 `ShareLink` (`kind: MANUAL`); 400 si la etiqueta o el portal no validan; 404 |
| `PATCH /api/admin/curated-profiles/:id/share-links/:linkId` | `{ label }` | 200; 404 si el enlace no existe **o es de otro perfil** |
| `POST /api/admin/curated-profiles/:id/share-links/:linkId/revoke` | — | 200 (idempotente); 404 como arriba |
| `POST /api/admin/curated-profiles/:id/share-links/linkedin` | — | 200 o 201 con el enlace `LINKEDIN_POST` activo (D12); 409 si el perfil no es `PUBLIC` o está archivado |

`ShareLink` (respuesta): `{ id, code, label, portal, kind, createdAt, revokedAt, opens, lastOpenedAt }`. `opens` y `lastOpenedAt` son las aperturas `HUMAN` de **toda la historia** del enlace (no del rango del dashboard), leídas con `ProfileViewRepository.countOpensByShareLink(ids)`: `curated-profile` ya depende del puerto de visitas de `analytics` para registrar, así que la lectura sigue la misma dirección y cada módulo sigue escribiendo solo su agregado.

La URL **no** viaja en la respuesta: el frontend la compone con el origen del sitio y `profilePath(slug)`, como ya hace el link público de la pestaña Publicación.

Alternativas descartadas:
- **Rutas planas `/api/admin/share-links/:linkId`.** Pierden el chequeo de pertenencia al perfil en la propia ruta y obligan al cliente a recordar de qué perfil es cada enlace.
- **`DELETE` del enlace.** Ver D1.
- **Contar las aperturas con una columna `opens` en `ShareLink`** incrementada al registrar. Una segunda escritura por visita (otro agregado), y `views:reclassify` tendría que recalcularla también.

### D11 — Gestión en la pestaña Publicación

Bloque **Enlaces de seguimiento** debajo del link público, solo para un perfil guardado (sin `id` muestra «Guardá el perfil para crear enlaces»):

- **Crear:** etiqueta obligatoria (por ejemplo «Acme — María, RR. HH.») y portal opcional con sugerencias (`linkedin`, `indeed`, `computrabajo`, `getonbrd`, `upwork`, `torre`, `email`), aceptando texto libre normalizable.
- **Lista:** etiqueta (editable en el lugar), portal, aperturas, última apertura y estado. Los revocados quedan al final, atenuados y sin acción de copiar.
- **Copiar:** la URL absoluta con `?via=<código>` (y `token` antes, si es `PROTECTED`). Comparte la advertencia del link público si el perfil está archivado o es `PRIVATE`, y el aviso de faltantes de traducción queda a la vista.
- **Revocar:** con confirmación que explica que el link **sigue abriendo** el perfil pero deja de atribuirse, y que la revocación no se deshace.
- **Link genérico por portal:** un selector de portal y «Copiar» para `/{slug}?src=<portal>`, sin llamar a la API, para pegar en perfiles de portales donde no interesa distinguir destinatarios.

Los textos del panel van solo en español, como el resto del backoffice.

### D12 — «Compartir en LinkedIn» con un enlace `LINKEDIN_POST` reusado

- El botón está en Publicación, habilitado solo si el perfil está guardado, es `PUBLIC` y no está archivado; si no, se muestra deshabilitado con el motivo.
- Al pulsarlo: abre una pestaña **dentro del mismo clic** (para que el bloqueador de ventanas no la frene), pide `POST .../share-links/linkedin`, y navega esa pestaña a `https://www.linkedin.com/sharing/share-offsite/?url=<encodeURIComponent(urlConVia)>`; luego le quita `opener`. Si la petición falla, cierra la pestaña y muestra el error.
- `GetOrCreateLinkedInShareLinkUseCase` devuelve el enlace `LINKEDIN_POST` activo más reciente del perfil o crea uno con `portal: 'linkedin'` y etiqueta «Publicación en LinkedIn». Si el owner lo revoca, el siguiente clic crea otro.
- No hay índice único parcial para «un solo `LINKEDIN_POST` activo por perfil»: Prisma no lo expresa en el schema y la siguiente migración lo detectaría como deriva. Un doble clic concurrente puede crear dos; es inofensivo (los dos atribuyen a `linkedin`) y el caso de uso reusa el más reciente.
- La vista previa de LinkedIn sale del fragmento de head del servidor, que ignora `via` (D13): título, descripción e imagen del perfil.

Alternativas descartadas:
- **Un `<a href>` estático con un enlace creado al abrir la pestaña.** Crearía un enlace en cada visita a Publicación aunque nunca se comparta.
- **Compartir la URL sin código.** Las visitas desde la publicación se mezclarían con las directas, justo lo que este change resuelve.
- **Publicar por API** (`w_member_social`): OAuth, token de 60 días sin refresh; es el ítem 4.6, fuera de 1.2.

### D13 — SEO: los links con código no son páginas aparte

- `canonical` y `og:url` siguen siendo `origen + ruta del slug`, **sin query**: ya es así en el cliente (`metaFromProfile`) y en el servidor (el fragmento se pide con `slug` y `lang`). El change lo vuelve requisito y lo prueba con `?via=` y `?src=`.
- El fragmento de head ignora `via` y `src`: el HTML de `/{slug}?via=...` tiene el mismo head que el de `/{slug}`.
- El sitemap no cambia: nunca lleva query.
- `robots.txt` **no** suma `Disallow: /*?via=`. Los rastreadores de vista previa (LinkedInBot, Slackbot) respetan `robots.txt`: bloquearlo dejaría sin tarjeta a cada link compartido, que es el caso principal. El `canonical` ya consolida el link con código en la URL limpia para los buscadores.

### D14 — Contrato OpenAPI

- `GET /api/curated-profiles/{slug}`: parámetros de query opcionales `via` y `src`, descriptos como atribución que no cambia la respuesta.
- Schemas nuevos: `ShareLinkResponse`, `CreateShareLinkDto`, `UpdateShareLinkDto`, enum `ShareLinkKind`, `CountByShareLink`, `CountBySource`; `ProfileViewsResponse` suma `byShareLink` y `bySource`.
- `npm run openapi:export` y `npm run api:types`; el test de deriva del frontend tiene que quedar verde.

### D15 — Ciclo de vida con el perfil

- **Borrar** el perfil borra sus enlaces en cascada (como sus `ProfileView`).
- **Duplicar** no copia enlaces: pertenecen a destinatarios del original.
- **Archivar** no toca los enlaces: el link da 404 mientras esté archivado y vuelve a atribuir al desarchivar.
- **Renombrar** no los afecta: se identifican por `curatedProfileId` y el alias sigue resolviendo; el link que copia el panel usa el slug vigente.
- `ProfileView.shareLinkId` es `ON DELETE SET NULL`, aunque hoy un enlace solo se borra con su perfil (cuyas visitas se borran también): evita que un borrado futuro de enlaces arrastre visitas.

## Risks / Trade-offs

- **[El destinatario reenvía el link]** → las visitas del reenvío se atribuyen a su enlace. Se acepta y se documenta en el manual; es una señal útil (el link circuló). Ver P3.
- **[`src` libre permite ensuciar el desglose]** → cualquiera puede abrir `?src=lo-que-sea`. Solo cuenta si la visita es `HUMAN`, la columna está normalizada y acotada a 32 caracteres, y el desglose es privado. Si se vuelve un problema, P1 propone un catálogo.
- **[Visita doble por un script viejo en caché]** → `no-cache` en el script (verificado en 7.3) y la matriz de `early-profile.spec.ts`.
- **[El cambio de idioma vuelve a registrar]** → al pasar a `?lang=en` la app pide otra vez y registra otra visita, ahora también atribuida. Es el comportamiento actual de cualquier cambio de idioma y no se toca acá.
- **[Enumeración de códigos]** → 50 bits, respuesta idéntica con o sin código válido y el límite de peticiones global. Adivinar un código solo permitiría sumar aperturas falsas a un enlace ajeno.
- **[La etiqueta contiene datos de un tercero]** → la escribe el owner, nunca sale de la API del panel y no va al log; es lo que la propuesta admite («solo los que el owner escriba a mano»).
- **[`byReferrer` sigue en `directo`]** → se mantiene a propósito; el manual lo explica junto a las tablas nuevas.

## Migration Plan

1. **Orden de archivado:** `classify-profile-views` se archiva antes que este change. Los `MODIFIED` de *Agregado por origen de la visita* parten del texto que aquel deja.
2. **Migración** `<timestamp>_add_share_links`, generada con `prisma migrate dev --create-only` contra una base descartable y revisada a mano: `CREATE TYPE "ShareLinkKind"`, `CREATE TABLE "ShareLink"` con su índice único y su FK `ON DELETE CASCADE`, `ALTER TABLE "ProfileView" ADD COLUMN "shareLinkId" TEXT, ADD COLUMN "source" TEXT`, la FK `ON DELETE SET NULL` y los dos índices. Sin `UPDATE`: las filas previas quedan sin atribución.
3. **Deploy:** la migración corre en el `preDeployCommand`. No hay backfill ni script nuevo.
4. **Base local del owner (`portfolio`, 5434):** la migra él con `npm run prisma:migrate` cuando actualice; ninguna tarea la toca.
5. **Rollback:** revertir el código deja las columnas y la tabla sin uso (la API vieja ignora `via` y `src`). Si hiciera falta quitarlas, una migración inversa con `DROP`; los datos de atribución se pierden.

## Open Questions

Las tres preguntas quedaron **resueltas el 2026-10-29** con la opción A recomendada; ninguna era bloqueante y lo implementado es lo que describen D3, D4 y D10.

- **P1 — ¿`src` libre o catálogo cerrado de portales?** → **Resuelta el 2026-10-29: A.** Libre, normalizado a `[a-z0-9-]` y 32 caracteres (D3). El desglose es privado y solo cuenta visitas humanas; si aparece ruido, C (mostrar los 10 primeros y agrupar el resto en «otros») es un cambio solo de presentación.
- **P2 — ¿Las aperturas de un enlace muestran también las propias y las de bots?** → **Resuelta el 2026-10-29: A.** Solo humanas (D10), coherente con P19 = A. El dato queda en la fila (`kind` y `shareLinkId`), así que un contador aparte de propias y de bots se puede sumar sin migrar.
- **P3 — ¿La SPA quita `?via=` de la barra de direcciones después de cargar?** → **Resuelta el 2026-10-29: A.** No (D4): quitarlo complicaría la paridad de la clave que protege contra la visita doble, y un reenvío atribuido también informa.
