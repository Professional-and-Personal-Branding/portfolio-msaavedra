# job-posting-intake Specification

## Purpose
Armar un perfil curado para una vacante obligaba a leerla y elegir tags a mano. Importar la vacante desde una URL de un ATS con API pública o desde el texto pegado, con una guarda contra SSRF, medir qué requisitos tienen respaldo en los datos y crear un borrador privado acelera ese paso sin publicar nada ni consultar portales que no lo permiten; el texto crudo se purga a los 90 días.

## Requirements

### Requirement: Importación desde un ATS con API pública
Una URL de vacante de Greenhouse, Lever o Ashby SHALL importarse llamando a la API pública de job board de ese ATS, en un host fijo que no sale de la entrada, y SHALL dar un `JobPosting` normalizado con título, empresa, ubicación, modalidad, descripción en texto plano, `applyUrl` https y la fecha de publicación cuando la fuente los trae.

#### Scenario: Greenhouse
- **WHEN** el owner importa `https://boards.greenhouse.io/acmeejemplo/jobs/4012345` y la API responde con el fixture de Greenhouse
- **THEN** la respuesta es 201 con `source: GREENHOUSE`, el título del fixture y una descripción sin etiquetas HTML

#### Scenario: Lever
- **WHEN** el owner importa `https://jobs.lever.co/acmeejemplo/<uuid>` y la API responde con el fixture de Lever
- **THEN** la vacante queda con `source: LEVER`, la modalidad del fixture y el `applyUrl` de Lever

#### Scenario: Ashby elige la vacante del board
- **WHEN** el owner importa `https://jobs.ashbyhq.com/acmeejemplo/<uuid>` y el board del fixture tiene tres vacantes
- **THEN** se guarda solo la del `<uuid>` pedido, con su compensación como texto

#### Scenario: Vacante que no está en el board
- **WHEN** el `<uuid>` no figura en el board de Ashby
- **THEN** la respuesta es 422 y su mensaje termina en «Pegá el texto de la vacante.»

### Requirement: Respaldo con JSON-LD JobPosting
Una URL https que no es de un ATS ni de un portal cerrado SHALL leerse como HTML y SHALL importarse desde el primer bloque `application/ld+json` cuyo `@type` incluya `JobPosting`, también dentro de un arreglo o de `@graph`. Sin ese bloque, la respuesta SHALL ser 422 indicando pegar el texto.

#### Scenario: Página de empleo con JSON-LD
- **WHEN** el owner importa la página de empleo de una empresa que trae un bloque JSON-LD `JobPosting` dentro de `@graph`
- **THEN** la vacante queda con `source: JSON_LD`, el `hiringOrganization.name` como empresa y la descripción convertida a texto

#### Scenario: Página sin vacante estructurada
- **WHEN** la página no tiene ningún bloque JSON-LD con `@type` `JobPosting`
- **THEN** la respuesta es 422 con «No encontramos una vacante en esa página. Pegá el texto de la vacante.»

### Requirement: Portales cerrados
Una URL cuyo host, o el de cualquier redirect, pertenezca a la lista versionada de portales cerrados (LinkedIn y `lnkd.in`, Indeed, Glassdoor, Wellfound, Computrabajo, Bumeran, Laborum, ZonaJobs, Workana, Upwork, Torre, Get on Board y los agregadores con ToS restrictivos) SHALL responder 422 indicando pegar el texto, sin resolver DNS ni hacer ninguna petición a ese host.

#### Scenario: LinkedIn
- **WHEN** el owner importa `https://www.linkedin.com/jobs/view/123`
- **THEN** la respuesta es 422 con «LinkedIn» no permite leer sus vacantes y la indicación de pegar el texto, y el transporte HTTP no recibió ninguna petición

#### Scenario: Dominio de país
- **WHEN** el owner importa una URL de `ar.indeed.com` o de `indeed.com.mx`
- **THEN** la respuesta es 422 de portal cerrado

#### Scenario: Redirect hacia un portal cerrado
- **WHEN** una página de empleo responde 302 hacia `https://lnkd.in/abc`
- **THEN** la respuesta es 422 de portal cerrado y no se sigue el redirect

### Requirement: Importación desde texto pegado
El owner SHALL poder importar el texto de una vacante (50 a 50 000 caracteres) con título, empresa y una URL de referencia https opcionales. La extracción SHALL ser determinística, sin LLM: título (el dado o la primera línea), modalidad, tipo de empleo, idioma y términos. La URL de referencia SHALL guardarse sin pedirse nunca.

#### Scenario: Texto de una vacante de LinkedIn
- **WHEN** el owner pega el texto de una vacante con la URL de referencia de LinkedIn
- **THEN** la vacante queda con `source: PASTED`, esa URL como `sourceUrl` y sin ninguna petición saliente

#### Scenario: Modalidad híbrida
- **WHEN** el texto dice «Modalidad híbrida, dos días remoto»
- **THEN** `workplaceType` es `HYBRID`

#### Scenario: Texto demasiado corto
- **WHEN** el texto tiene 49 caracteres tras recortar
- **THEN** la respuesta es 400 y no se guarda nada

### Requirement: Política de la URL antes de la red
Antes de cualquier resolución o petición, la URL SHALL ser `https:` al puerto 443, sin usuario ni contraseña, con un host que no sea una IP literal (tras la normalización WHATWG), que tenga al menos un punto y que no sea `localhost` ni termine en `.localhost`, `.local`, `.internal`, `.lan`, `.home.arpa`, `.test`, `.example` o `.invalid`. Si no, SHALL responder 422.

#### Scenario: http sin TLS
- **WHEN** el owner importa `http://careers.acme-ejemplo.com/job/1`
- **THEN** la respuesta es 422 con «Usá una URL que empiece con https://»

#### Scenario: IP literal disfrazada
- **WHEN** el owner importa `https://2130706433/` o `https://[::1]/`
- **THEN** la respuesta es 422 y no se resuelve ni se conecta nada

#### Scenario: Puerto interno
- **WHEN** el owner importa `https://careers.acme-ejemplo.com:5432/`
- **THEN** la respuesta es 422

### Requirement: Rechazo de direcciones no públicas al conectar
La resolución DNS SHALL hacerse en el momento de conectar y SHALL rechazar el host si alguna dirección es privada, loopback, link-local (incluida la metadata `169.254.169.254`), CGNAT, ULA, multicast, de documentación o reservada, en IPv4 o IPv6, incluidas las IPv4 mapeadas `::ffff:`, NAT64 y 6to4. El socket SHALL usar la misma IP validada.

#### Scenario: Nombre que resuelve a una IP privada
- **WHEN** `vacantes.acme-ejemplo.com` resuelve a `10.0.0.5`
- **THEN** la respuesta es 422 con un mensaje que no incluye la IP, y no se abre ninguna conexión

#### Scenario: IPv4 mapeada en IPv6
- **WHEN** el host resuelve a `::ffff:169.254.169.254`
- **THEN** se rechaza como la metadata en IPv4

#### Scenario: Una de varias direcciones es privada
- **WHEN** el host resuelve a `93.184.216.34` y a `192.168.1.10`
- **THEN** se rechaza

### Requirement: Revalidación en cada redirect
Los redirects SHALL seguirse a mano, como máximo tres, y cada destino SHALL pasar otra vez por la política de la URL, la lista de portales cerrados y la validación de direcciones. Un cuarto redirect SHALL responder 422.

#### Scenario: Redirect a una IP privada
- **WHEN** la página responde 301 hacia `https://interno.acme-ejemplo.com/` y ese host resuelve a `172.16.0.10`
- **THEN** la respuesta es 422 y no se conecta al destino

#### Scenario: Rebaje a http
- **WHEN** la página responde 302 hacia una URL `http:`
- **THEN** la respuesta es 422

#### Scenario: Demasiados redirects
- **WHEN** la página encadena cuatro redirects
- **THEN** la respuesta es 422 con «La página redirige demasiadas veces» y la indicación de pegar el texto

### Requirement: Límites de la descarga
Cada importación SHALL usar solo `GET`, sin `Cookie`, `Authorization` ni cabeceras de la petición entrante, con un plazo total de 10 s, un tope de 2 MiB para HTML y 5 MiB para el JSON de un ATS medido después de descomprimir, y un `Content-Type` esperado. Pasar cualquiera de esos límites SHALL responder 422 sin guardar nada.

#### Scenario: Respuesta comprimida que se expande
- **WHEN** el servidor envía 100 KB en gzip que se descomprimen en 3 MiB de HTML
- **THEN** la lectura se corta al pasar 2 MiB y la respuesta es 422 con «La página es demasiado grande»

#### Scenario: Servidor lento
- **WHEN** el servidor no termina de responder en 10 s
- **THEN** la respuesta es 422 con «La página tardó demasiado en responder»

#### Scenario: Tipo inesperado
- **WHEN** la URL devuelve `application/pdf`
- **THEN** la respuesta es 422

#### Scenario: Sin credenciales salientes
- **WHEN** el owner importa con su cookie de sesión
- **THEN** la petición saliente no lleva `Cookie` ni `Authorization`

### Requirement: Errores de importación accionables
Toda falla al obtener una vacante desde una URL SHALL responder 422 con el cuerpo de error estándar y un mensaje en español que termine en «Pegá el texto de la vacante.» (o que ya lo indique, en un portal cerrado), sin el cuerpo remoto ni la IP resuelta. Los errores de forma de la entrada SHALL responder 400.

#### Scenario: Vacante cerrada
- **WHEN** la API del ATS responde 404
- **THEN** la respuesta es 422 con «No encontramos esa vacante (puede estar cerrada)» y la indicación de pegar el texto

#### Scenario: URL y texto juntos
- **WHEN** el cuerpo trae `url` y `text`
- **THEN** la respuesta es 400

### Requirement: Vacante normalizada y reimportación
Cada vacante SHALL guardarse una vez por `sourceKey` (ATS y id, URL canónica sin fragmento ni parámetros de seguimiento, o hash del texto pegado). Importar de nuevo la misma SHALL actualizarla, renovar `importedAt` y responder 200; una nueva SHALL responder 201. Nunca SHALL guardarse la respuesta remota completa.

#### Scenario: Misma URL con parámetros de seguimiento
- **WHEN** el owner importa una URL y después la misma con `?utm_source=x#apply`
- **THEN** la segunda responde 200 y sigue habiendo una sola vacante

#### Scenario: Mismo texto pegado
- **WHEN** el owner pega dos veces el mismo texto con otros espacios
- **THEN** la segunda responde 200 sobre la misma vacante

### Requirement: Detección determinística de términos
Al importar, los términos de la vacante SHALL detectarse sobre el título y la descripción normalizados, como secuencias de tokens completas, con un diccionario versionado de términos y alias ES/EN más las formas de cada tag del vocabulario, y SHALL guardarse en `detectedTerms`. Los alias ambiguos de una o dos letras no SHALL usarse solos.

#### Scenario: Alias de un tag
- **WHEN** la descripción dice «experiencia en .NET Core y C#»
- **THEN** `detectedTerms` incluye `dotnet`

#### Scenario: Palabra contenida en otra
- **WHEN** la descripción menciona JavaScript y no Java
- **THEN** `detectedTerms` no incluye `java`

#### Scenario: Tag del vocabulario con guiones
- **WHEN** el vocabulario tiene `spring-boot` y la descripción dice «Spring Boot»
- **THEN** `detectedTerms` incluye `spring-boot`

### Requirement: Cobertura de tags
`computeTagCoverage` SHALL ser una función pura que, dados los términos detectados y el vocabulario con su evidencia, devuelva los tags cubiertos con la cantidad de ítems visibles que los llevan, los términos sin respaldo, los conteos y la proporción (nula si no se detectó nada), con un orden estable.

#### Scenario: Cobertura parcial
- **WHEN** se detectan `java`, `spring-boot`, `kubernetes` y `go`, y el vocabulario tiene los dos primeros
- **THEN** cubre 2 de 4, la proporción es 0,5 y `kubernetes` y `go` quedan sin respaldo

#### Scenario: Nada detectado
- **WHEN** no se detecta ningún término
- **THEN** la proporción es nula y no hay tags sugeridos

### Requirement: Sugerencia de criterios dentro del vocabulario
`GET /api/admin/job-postings/:id/suggestion` SHALL devolver solo la cobertura, hasta 8 `suggestedFilterTags`, un título y una base de slug, calculados contra el vocabulario vigente (tags de experiencias y proyectos visibles y de las skills). Los tags sugeridos SHALL ser siempre un subconjunto del vocabulario, sin repetidos.

#### Scenario: El vocabulario cambia
- **WHEN** después de importar el owner oculta la única experiencia con el tag `fintech`
- **THEN** la sugerencia deja de incluir `fintech` y lo cuenta como sin respaldo

#### Scenario: Propiedad del subconjunto
- **WHEN** se generan vocabularios y términos arbitrarios
- **THEN** cada tag sugerido pertenece al vocabulario y no se repite

### Requirement: Texto de la vacante por 90 días
La descripción SHALL guardarse con `textPurgeAt` a 90 días de la importación y SHALL borrarse, conservando metadatos y términos, al listar, leer o importar vacantes y con `npm run job-postings:purge -- --apply`, sin depender de ningún scheduler. Sin `--apply`, el comando SHALL solo informar cuántas purgaría, sin escribir. Reimportar SHALL renovar el plazo.

#### Scenario: Purga perezosa
- **WHEN** con el reloj 91 días después de importar se lista `GET /api/admin/job-postings`
- **THEN** esa vacante tiene `description: null`, conserva título y términos, y la sugerencia sigue respondiendo

#### Scenario: Comando de purga
- **WHEN** se corre `npm run job-postings:purge -- --apply` con dos vacantes vencidas
- **THEN** imprime que purgó 2 y termina con código 0

#### Scenario: Simulación por defecto
- **WHEN** se corre `npm run job-postings:purge` sin `--apply` con dos vacantes vencidas
- **THEN** imprime que purgaría 2, termina con código 0 y las dos conservan su `description`

### Requirement: API de vacantes del panel
Bajo `/api/admin/job-postings`, con sesión de administrador, SHALL existir: `POST` (importar desde `url` o `text`), `GET` (lista por `importedAt` desc), `GET /:id`, `DELETE /:id` (204) y `GET /:id/suggestion`. Sin sesión SHALL responder 401 sin ninguna petición saliente; un id inexistente, 404.

#### Scenario: Sin sesión
- **WHEN** se llama a `POST /api/admin/job-postings` sin cookie ni Bearer
- **THEN** la respuesta es 401 y el transporte HTTP no recibió ninguna petición

#### Scenario: Borrar
- **WHEN** el owner borra una vacante
- **THEN** responde 204 y `GET /:id` da 404, y los perfiles curados no cambian

### Requirement: Vacantes solo en el panel
Ninguna ruta pública, el head, el sitemap ni el JSON-LD del sitio SHALL exponer vacantes, su cobertura ni sus términos. La ruta pública y el preview SHALL resolverse sin depender de `job-posting`.

#### Scenario: Ruta pública intacta
- **WHEN** existe una vacante importada y se pide `GET /api/curated-profiles/{slug}`
- **THEN** el cuerpo es el mismo que antes de importarla

#### Scenario: Sin ruta pública de vacantes
- **WHEN** se pide `GET /api/job-postings`
- **THEN** la respuesta es 404

### Requirement: Separación entre job-posting y curated-profile
`job-posting` SHALL no importar nada de `curated-profile` ni escribir `CuratedProfile`; `curated-profile` SHALL importar de `job-posting` solo su puerto de lectura, y solo desde su módulo y el caso de uso del borrador. `test/architecture.spec.ts` SHALL verificarlo con un autocontrol por regla.

#### Scenario: Import prohibido
- **WHEN** un archivo de `modules/job-posting` importa algo de `curated-profile/`
- **THEN** el test de arquitectura falla nombrando el archivo

#### Scenario: Escritura prohibida
- **WHEN** un archivo de `modules/job-posting` contiene `.curatedProfile.create`
- **THEN** el test de arquitectura falla

### Requirement: Pantalla Crear desde una vacante
`/admin/perfiles/desde-vacante` SHALL permitir importar por URL o por texto, mostrar la vacante, su cobertura con una casilla por tag cubierto (los sugeridos marcados) y los términos sin respaldo, y crear el borrador con título y slug opcionales. Ante un portal cerrado SHALL ofrecer **Pegar el texto**, que conserva la URL como referencia.

#### Scenario: De la URL al borrador
- **WHEN** el owner analiza una URL de Lever, deja los tags sugeridos y pulsa **Crear borrador**
- **THEN** llega a `/admin/perfiles/{id}` con el toast «Borrador creado. Es privado hasta que lo publiques.»

#### Scenario: Portal cerrado
- **WHEN** el análisis de una URL de LinkedIn responde 422
- **THEN** el mensaje se anuncia en una región `role="alert"` y **Pegar el texto** cambia a Texto con la URL en «URL de referencia»

#### Scenario: Sin tags elegidos
- **WHEN** el owner desmarca todas las casillas y pulsa **Crear borrador**
- **THEN** ve «Elegí al menos un tag» y no se llama a la API

### Requirement: Vacantes importadas en la pantalla
La pantalla SHALL listar las vacantes importadas con puesto, empresa, fuente y fecha, abrir una con `?vacante={id}` en la URL, borrar con confirmación e indicar cuándo se borra o se borró su texto, sin `localStorage` ni `sessionStorage`.

#### Scenario: Abrir una vacante anterior
- **WHEN** el owner pulsa **Abrir** en una fila y recarga la página
- **THEN** la URL conserva `?vacante={id}` y se vuelve a ver su análisis

#### Scenario: Lista vacía
- **WHEN** no hay vacantes importadas
- **THEN** se ve «Todavía no importaste vacantes»
