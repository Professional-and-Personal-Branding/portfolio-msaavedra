# share-links Specification

## Purpose
El owner manda un perfil curado a varias personas y lo publica en varios portales, y el referrer no llega a la API. Un código en el link (`?via=`) por destinatario o portal, y un portal genérico (`?src=`), que la SPA reenvía a la API, permiten saber qué envío generó cada visita humana sin depender de terceros.

## Requirements

### Requirement: Enlace de seguimiento por perfil
Un `ShareLink` SHALL pertenecer a un perfil curado y tener un `code` único en toda la base, de 10 caracteres del alfabeto `0123456789abcdefghjkmnpqrstvwxyz` generados con aleatoriedad criptográfica, una etiqueta de 1 a 80 caracteres, un `portal` opcional, un `kind` (`MANUAL` o `LINKEDIN_POST`), `createdAt` y `revokedAt`. El código, el portal, el tipo y el perfil MUST NOT cambiar después de crearse; la etiqueta sí.

#### Scenario: Código bien formado y único
- **WHEN** el owner crea dos enlaces para el mismo perfil
- **THEN** cada uno tiene un código de 10 caracteres del alfabeto y los dos códigos son distintos

#### Scenario: Colisión al generar
- **WHEN** el generador devuelve primero un código que ya existe y después uno libre
- **THEN** el enlace se crea con el segundo código y no hay error

#### Scenario: La etiqueta cambia, el código no
- **WHEN** el owner cambia la etiqueta de un enlace
- **THEN** la etiqueta nueva queda guardada y el código, el portal y el perfil siguen iguales

### Requirement: Revocación de un enlace
Revocar un enlace SHALL fijar `revokedAt` una sola vez: revocar uno ya revocado SHALL responder con el mismo `revokedAt`. La revocación MUST NOT deshacerse y MUST NOT bloquear el acceso al perfil: el link sigue resolviendo como sin `via` y solo deja de atribuirse.

#### Scenario: Revocar dos veces
- **WHEN** el owner revoca un enlace y lo vuelve a revocar
- **THEN** las dos respuestas son 200 con el mismo `revokedAt`

#### Scenario: El link revocado sigue abriendo
- **WHEN** un visitante abre `/{slug}?via=<código revocado>` de un perfil `PUBLIC`
- **THEN** ve el perfil con el mismo cuerpo que sin `via` y la visita no se atribuye al enlace

### Requirement: Gestión de enlaces desde la API del panel
Con token de administrador, `/api/admin/curated-profiles/:id/share-links` SHALL listar (más recientes primero) y crear enlaces (`{ label, portal? }`, 201), y `.../:linkId` SHALL aceptar `PATCH { label }` y `POST .../revoke`. Un perfil inexistente, o un enlace inexistente o de otro perfil, SHALL dar 404; una etiqueta vacía o un portal inválido, 400; sin token, 401.

#### Scenario: Crear y listar
- **WHEN** el administrador crea un enlace con `label: "Acme — RR. HH."` y `portal: "LinkedIn"`
- **THEN** recibe 201 con `kind: "MANUAL"`, `portal: "linkedin"`, `revokedAt: null` y `opens: 0`, y el enlace encabeza el listado del perfil

#### Scenario: Enlace de otro perfil
- **WHEN** el administrador revoca un enlace usando el id de otro perfil en la ruta
- **THEN** recibe 404 y el enlace no cambia

#### Scenario: Validación
- **WHEN** crea un enlace con etiqueta vacía o con `portal: "mi portal!"`
- **THEN** recibe 400 y no se crea nada

#### Scenario: Sin sesión
- **WHEN** un cliente sin token pide el listado
- **THEN** recibe 401

### Requirement: Aperturas por enlace
Cada enlace del listado SHALL traer `opens`, la cantidad de sus `ProfileView` con `kind` `HUMAN` en toda su historia, y `lastOpenedAt`, el `viewedAt` más reciente de esas visitas o `null`. Las visitas `OWNER` y `BOT` MUST NOT contar.

#### Scenario: Solo las humanas
- **WHEN** un enlace tiene 3 visitas `HUMAN`, 1 `OWNER` y 2 `BOT`
- **THEN** el listado muestra `opens: 3` y `lastOpenedAt` es la fecha de la última visita `HUMAN`

#### Scenario: Sin aperturas
- **WHEN** un enlace recién creado se lista
- **THEN** trae `opens: 0` y `lastOpenedAt: null`

### Requirement: Atribución de una visita a un enlace
Una visita pública con `?via=` SHALL guardar `shareLinkId` solo si el código normalizado existe, el enlace está activo y pertenece al perfil resuelto (también por alias). Si no, `shareLinkId` SHALL ser nulo. La atribución SHALL guardarse en toda fila, sea cual sea su `kind`.

#### Scenario: Enlace activo
- **WHEN** un navegador sin sesión abre el perfil con el `via` de un enlace activo de ese perfil y se espera `whenIdle()`
- **THEN** el nuevo `ProfileView` tiene `kind: "HUMAN"` y el `shareLinkId` de ese enlace

#### Scenario: Enlace de otro perfil
- **WHEN** se abre `/perfil-a?via=<código de un enlace de perfil-b>`
- **THEN** responde 200 con `perfil-a` y la visita queda con `shareLinkId` nulo

#### Scenario: Código inexistente o malformado
- **WHEN** se abre el perfil con `?via=no-existe` o con un código de 10 caracteres que no está en la base
- **THEN** responde 200 y la visita queda con `shareLinkId` nulo

#### Scenario: Por el slug anterior
- **WHEN** un perfil se renombra y se abre su slug anterior con el `via` de uno de sus enlaces
- **THEN** la visita se atribuye a ese enlace

#### Scenario: Visita propia por un enlace
- **WHEN** el owner con su sesión abre el link de un enlace
- **THEN** la fila tiene `kind: "OWNER"` y el `shareLinkId`, y `opens` del enlace no cambia

### Requirement: Atribución genérica por portal
Una visita SHALL guardar en `source` el `portal` del enlace atribuido si lo tiene; si no, el `src` de la URL normalizado (sin espacios, en minúsculas, que cumpla `^[a-z0-9][a-z0-9-]{0,31}$`); si no, nulo. `src` MUST NOT crear filas de `ShareLink`. La misma normalización SHALL aplicarse al `portal` de un enlace al crearlo.

#### Scenario: Portal genérico
- **WHEN** un navegador abre `/{slug}?src=Indeed`
- **THEN** la visita tiene `source: "indeed"`, `shareLinkId` nulo y no se creó ningún `ShareLink`

#### Scenario: El portal del enlace gana
- **WHEN** se abre `?via=<enlace con portal linkedin>&src=indeed`
- **THEN** la visita tiene `source: "linkedin"`

#### Scenario: src inválido
- **WHEN** se abre `?src=` con un valor de 40 caracteres o con espacios internos
- **THEN** la visita tiene `source` nulo

### Requirement: El código no cambia la respuesta ni reemplaza al token
La respuesta de `GET /api/curated-profiles/:slug` SHALL ser idéntica con un `via` válido, revocado, inexistente o sin él. Un `via` o `src` malformado o repetido MUST NOT producir 400. Un perfil `PROTECTED` sin token válido SHALL dar 401 aunque traiga un `via` válido, sin registrar nada.

#### Scenario: Misma respuesta
- **WHEN** se pide el mismo perfil y locale sin `via`, con un `via` válido y con uno inexistente
- **THEN** los tres cuerpos son iguales

#### Scenario: Protegido con via y sin token
- **WHEN** se pide un perfil `PROTECTED` con el `via` válido de uno de sus enlaces y sin token
- **THEN** responde 401 y no se crea ningún `ProfileView`

#### Scenario: Parámetro repetido
- **WHEN** se pide `?via=a&via=b&src=x&src=y`
- **THEN** responde 200

### Requirement: La atribución no demora la respuesta
La búsqueda del enlace SHALL ocurrir dentro de la tarea en segundo plano que registra la visita, después de responder. Un código malformado MUST NOT consultar la base. Un fallo al buscar el enlace SHALL registrar la visita sin enlace, con su `source`, y dejar un aviso en el log que MUST NOT incluir el código.

#### Scenario: Responde antes de buscar
- **WHEN** el caso de uso resuelve con un `via` y el repositorio de enlaces todavía no respondió
- **THEN** `execute()` ya devolvió el resultado exitoso, idéntico al que devuelve sin `via`

#### Scenario: Falla la búsqueda
- **WHEN** el repositorio de enlaces rechaza la búsqueda y la URL trae `src=indeed`
- **THEN** la visita se registra con `shareLinkId` nulo y `source: "indeed"`, y el log no contiene el código

### Requirement: El cliente reenvía via y src a la API
La SPA y `profile-prefetch.js` SHALL mandar `via` y `src` de la URL, sin normalizarlos, como query de `GET /api/curated-profiles/:slug` en el orden `locale`, `via`, `src` y omitiendo los vacíos. Los dos SHALL usar la clave `[slug, locale, token, via, src]`. Una carga con `?via=` MUST registrar exactamente una visita.

#### Scenario: Paridad del script y la app
- **WHEN** `early-profile.spec.ts` ejecuta el script con `?lang=en&token=abc&via=k7m2q9xw4t&src=indeed`
- **THEN** la clave y la URL del script son las que arma la app para la misma URL

#### Scenario: Una visita por carga a través del SPA
- **WHEN** se abre `/{slug}?via=<código activo>` en Chrome contra la imagen de producción y una base descartable
- **THEN** hay una sola petición del perfil, con `via` en la query, y un solo `ProfileView` nuevo con ese `shareLinkId`

### Requirement: via y src no viajan en la navegación interna
Los enlaces que la SPA arma hacia otro perfil (el menú de la home) MUST NOT llevar `via` ni `src`, igual que no llevan `token`. Cambiar el idioma o escribir el token en el formulario SHALL conservarlos.

#### Scenario: Menú desde la home con código
- **WHEN** se abre `/?via=k7m2q9xw4t&src=indeed&lang=en` y se inspeccionan los enlaces del menú de perfiles
- **THEN** conservan `lang=en` y ninguno contiene `via` ni `src`

#### Scenario: Token escrito a mano
- **WHEN** un perfil `PROTECTED` se abre con `?via=<código>` y el visitante escribe el token en el formulario
- **THEN** la URL pasa a tener `token` y conserva `via`, y la visita resultante se atribuye

### Requirement: Enlace para compartir en LinkedIn
`POST /api/admin/curated-profiles/:id/share-links/linkedin` SHALL devolver el enlace activo de tipo `LINKEDIN_POST` más reciente del perfil, o crear uno con `portal: "linkedin"` (201). SHALL responder 409 si el perfil no es `PUBLIC` o está archivado, y 404 si no existe.

#### Scenario: Se reusa mientras esté activo
- **WHEN** el administrador lo pide dos veces para el mismo perfil `PUBLIC`
- **THEN** la primera respuesta es 201, la segunda 200 y las dos traen el mismo código

#### Scenario: Revocado, se crea otro
- **WHEN** el enlace `LINKEDIN_POST` se revoca y se vuelve a pedir
- **THEN** recibe 201 con un código nuevo

#### Scenario: Perfil no público
- **WHEN** se pide para un perfil `PROTECTED`, `PRIVATE` o archivado
- **THEN** recibe 409 y no se crea ningún enlace
