## ADDED Requirements

### Requirement: Proveedor github en el catálogo de integraciones
El catálogo de integraciones SHALL incluir el proveedor `github`, permitido en producción, con la variable de secreto opcional `GITHUB_SYNC_TOKEN`: si está definida manda sobre la credencial guardada desde el panel; si no, se usa la credencial cifrada. Habilitarlo MUST NOT exigir la variable al arrancar.

#### Scenario: Arranque sin la variable
- **WHEN** la API arranca con `INTEGRATIONS_ENABLED=github`, el keyring configurado y sin `GITHUB_SYNC_TOKEN`
- **THEN** arranca y la tarjeta `github` de Integraciones dice «Falta la credencial» con el campo a la vista

#### Scenario: La variable manda
- **WHEN** `GITHUB_SYNC_TOKEN` está definida y se hace `PUT /api/admin/integrations/github/credential`
- **THEN** responde 422 y la credencial se informa con origen «Variable de entorno del servidor»

### Requirement: Peticiones a GitHub en serie y siempre autorizadas
El conector `github` SHALL pedir, en serie y nunca en paralelo, `GET /repos/{owner}/{repo}` y `GET /repos/{owner}/{repo}/languages` de cada repositorio destacado a la URL base fija `https://api.github.com`, con `Authorization: Bearer`, `X-GitHub-Api-Version`, `User-Agent` y la señal de aborto. Cada petición MUST llevar `Authorization`, también la condicional y la que sigue una redirección.

#### Scenario: Condicional autorizada
- **WHEN** existe el snapshot de un repo con ETag y corre la sincronización
- **THEN** la petición lleva `If-None-Match` con ese ETag y `Authorization: Bearer`

#### Scenario: Nunca dos a la vez
- **WHEN** el transporte de prueba mide las peticiones en curso durante una sincronización de tres repositorios
- **THEN** el máximo de peticiones simultáneas es 1

#### Scenario: Sin repositorios
- **WHEN** no hay ningún repositorio destacado y corre la sincronización
- **THEN** el trabajo termina `DONE` sin hacer peticiones

### Requirement: Con el fixture se actualizan stars, lenguajes y topics
Una sincronización con respuestas 200 SHALL guardar por repositorio, en `RepositoryEvidence`, el estado `OK`, las stars, el lenguaje principal, los bytes por lenguaje, los topics, el último push, si está archivado y `verifiedAt`, y MUST grabar cada repositorio antes de pedir el siguiente.

#### Scenario: Primera sincronización con fixtures
- **WHEN** corre la sincronización con `GITHUB_TRANSPORT=fixture` contra la base de ejemplo
- **THEN** `reservas-api` tiene las stars, los lenguajes y los topics de su fixture y `GET /api/featured-repositories` los devuelve en `evidence`

#### Scenario: Fallo a mitad de camino
- **WHEN** el segundo de tres repositorios responde 503
- **THEN** el trabajo queda `FAILED` con `Transient` y la evidencia del primero quedó grabada

### Requirement: Un 304 autenticado no reescribe nada
Cuando GitHub responde 304 a los dos recursos de un repositorio, o 200 con la misma proyección, la sincronización MUST NOT cambiar las stars, los lenguajes, los topics ni `changedAt` de la evidencia, ni el cuerpo ni el `contentHash` de los snapshots. SHALL actualizar solo `fetchedAt` de los snapshots y `verifiedAt` de la evidencia, y contar 0 cambios.

#### Scenario: Segunda corrida sin cambios
- **WHEN** corre la sincronización dos veces seguidas con los mismos fixtures
- **THEN** la segunda recibe 304 en todas las peticiones, el trabajo informa `itemsChanged: 0`, `changedAt` y los datos son idénticos y `verifiedAt` es posterior

#### Scenario: Cambio ajeno a la proyección
- **WHEN** GitHub devuelve 200 con otro ETag y solo cambió `watchers_count`
- **THEN** la evidencia no cambia de contenido y la corrida cuenta 0 cambios

### Requirement: Snapshots reducidos a una lista blanca
El snapshot `repo:<owner/repo>` del proveedor `github` SHALL guardar solo `full_name`, `private`, `fork`, `archived`, `stargazers_count`, `language`, `topics` (hasta 20), `pushed_at`, `description` (hasta 350 caracteres) y `html_url`, y el de `languages:<owner/repo>` hasta 20 lenguajes con bytes enteros. Un campo con tipo inesperado MUST quedar nulo sin fallar.

#### Scenario: Campos fuera de la lista
- **WHEN** la respuesta del repo trae `owner`, `permissions` y `license`
- **THEN** el cuerpo guardado del snapshot no tiene esas claves

#### Scenario: Tipo inesperado
- **WHEN** `stargazers_count` llega como texto
- **THEN** la evidencia guarda `stars` nulo y el trabajo no falla

### Requirement: Clasificación de las respuestas de GitHub
La sincronización SHALL detener el trabajo con `RetryAfter` ante un 403 o 429 con `retry-after`, o con un mensaje de límite sin cabeceras (60 s); con `ResetAt` si `x-ratelimit-remaining` es 0 con `x-ratelimit-reset`; con `Transient` ante 5xx, red o timeout de 15 s; con `Permanent` ante 401 u otro 4xx. Un 404 o 410 de un repositorio MUST marcarlo `NOT_FOUND`, y otro 403 o un 451 `INACCESSIBLE`, sin detener el trabajo.

#### Scenario: Límite secundario sin cabeceras
- **WHEN** GitHub responde 403 con un mensaje que dice «secondary rate limit» y sin `retry-after` ni `x-ratelimit-remaining`
- **THEN** el trabajo queda `FAILED` con `RetryAfter` de 60 s y el proveedor en pausa hasta entonces

#### Scenario: Límite primario agotado
- **WHEN** GitHub responde 403 con `x-ratelimit-remaining: 0` y `x-ratelimit-reset`
- **THEN** el trabajo queda `FAILED` con `ResetAt` en ese instante, acotado por `sanitizeFailure`

#### Scenario: Un repo borrado no frena a los demás
- **WHEN** el primero de dos repositorios responde 404
- **THEN** queda `NOT_FOUND`, el segundo se sincroniza y el trabajo termina `DONE`

### Requirement: Reserva de cuota
Después de cada respuesta, si `x-ratelimit-remaining` es 50 o menos y viene `x-ratelimit-reset`, la sincronización MUST detenerse antes de la siguiente petición con `ResetAt` en ese instante, conservando lo ya grabado.

#### Scenario: Cuota casi agotada
- **WHEN** la respuesta del primer repositorio trae `x-ratelimit-remaining: 40`
- **THEN** no se hace ninguna petición más y el trabajo queda `FAILED` con `ResetAt`

### Requirement: Redirecciones solo dentro de la API de GitHub
El transporte SHALL seguir a mano hasta dos redirecciones 301, 302 o 307 cuyo destino empiece con `https://api.github.com/`, repitiendo todas las cabeceras. Una redirección a otro origen MUST NOT seguirse ni recibir el token; el repositorio queda `INACCESSIBLE`. Si el `full_name` recibido difiere del pedido, la evidencia SHALL guardarlo en `movedTo`.

#### Scenario: Repo renombrado
- **WHEN** GitHub responde 301 hacia `https://api.github.com/repositories/123` y ese recurso trae otro `full_name`
- **THEN** la evidencia queda `OK` con `movedTo` igual al `full_name` nuevo

#### Scenario: Redirección a otro host
- **WHEN** la respuesta es 302 con `location: https://example.com/x`
- **THEN** el transporte no hace esa petición y el repositorio queda `INACCESSIBLE`

### Requirement: Un repositorio privado no se publica
Si GitHub responde 200 con `private: true`, la evidencia SHALL quedar `PRIVATE`, no se pedirán sus lenguajes y MUST NOT publicarse ningún dato de ese repositorio.

#### Scenario: Repo privado
- **WHEN** la sincronización recibe `private: true` para un repositorio visible
- **THEN** `GET /api/featured-repositories` lo devuelve con `evidence: null` y el panel muestra «Privado: no se publica»

### Requirement: Con el token vencido se sirve el último snapshot y el panel avisa
Ante un 401, el trabajo SHALL terminar `DEAD` con `Permanent` y el mensaje «GitHub rechazó el token (401): renovalo en Integraciones o en GITHUB_SYNC_TOKEN», sin modificar ninguna evidencia. La ruta pública MUST seguir sirviendo la evidencia anterior con su fecha, y el panel SHALL avisar en Integraciones, en el Dashboard y en el bloque Repositorios.

#### Scenario: Token vencido
- **WHEN** hay evidencia grabada y corre la sincronización con el secreto `fixture-invalid-token`
- **THEN** el trabajo queda `DEAD`, la evidencia y su `verifiedAt` no cambian y la vista pública sigue mostrando stars y «Verificado en GitHub el …»

#### Scenario: Aviso en el bloque Repositorios
- **WHEN** se abre `/admin/proyectos` con el último trabajo de `github` en `DEAD`
- **THEN** el bloque Repositorios dice «La última sincronización con GitHub falló» con el enlace **Ver integraciones**

### Requirement: Lo curado a mano no se sobrescribe
La sincronización MUST NOT escribir el nombre, la URL, la descripción, las tecnologías, los tags, el orden ni la visibilidad de un repositorio destacado. El lenguaje mostrado SHALL ser el cargado a mano si existe y, si no, el lenguaje principal de GitHub.

#### Scenario: Lenguaje manual como override
- **WHEN** un repositorio tiene `language: "TypeScript"` a mano y GitHub informa `JavaScript`
- **THEN** la vista pública y el JSON Resume muestran `TypeScript`

#### Scenario: Lenguaje desde GitHub
- **WHEN** un repositorio tiene `language: null` y GitHub informa `Java`
- **THEN** la vista pública muestra `Java`

### Requirement: Evidencia publicada solo si es válida
La salida pública de un repositorio SHALL llevar `evidence` con stars, hasta 3 lenguajes con porcentaje entero, hasta 5 topics que no repitan tecnologías, `pushedAt`, `archived` y `verifiedAt`, y MUST llevar `evidence: null` si no hay evidencia, si su estado no es `OK` o si su `repoKey` no coincide con la URL actual.

#### Scenario: URL cambiada en el panel
- **WHEN** el owner cambia la URL de un repositorio ya verificado y todavía no corrió otra sincronización
- **THEN** la salida pública trae `evidence: null` y el panel muestra «Sin verificar»

#### Scenario: Topics deduplicados
- **WHEN** las tecnologías son `["NestJS"]` y los topics de GitHub `["nestjs", "prisma"]`
- **THEN** `evidence.topics` es `["prisma"]`

### Requirement: Tarjeta pública con la evidencia
La tarjeta de un repositorio con evidencia SHALL mostrar las stars solo si son 1 o más, los lenguajes con porcentaje, los topics, «Archivado» si corresponde, el mes del último push y «Verificado en GitHub el {fecha}». Sin evidencia, la tarjeta MUST ser igual a la anterior a este change. Nada MUST cargar recursos de otro origen ni llamar a GitHub.

#### Scenario: Stars en cero
- **WHEN** un repositorio verificado tiene 0 stars
- **THEN** su tarjeta no muestra el contador de stars y sí el sello de verificación

#### Scenario: Sin proveedor habilitado
- **WHEN** se abre `/` contra la base de ejemplo sin `github` en `INTEGRATIONS_ENABLED` y sin evidencia
- **THEN** las tarjetas de repositorios no muestran stars, topics ni sello

### Requirement: Cero llamadas a GitHub fuera de la sincronización
La ruta pública, el preview, el head, el sitemap, la hoja imprimible y la exportación JSON Resume MUST NOT llamar a GitHub: leen la evidencia de la base. Grabar evidencia MUST NOT cambiar `CuratedProfile.updatedAt`.

#### Scenario: Ruta pública sin peticiones
- **WHEN** se piden `GET /api/curated-profiles/all` y su `resume.json` con `GITHUB_TRANSPORT=fixture`
- **THEN** el transporte de fixtures registra 0 peticiones

#### Scenario: Sin mover updatedAt
- **WHEN** corre una sincronización que cambia la evidencia
- **THEN** el `updatedAt` de todos los perfiles curados queda igual

### Requirement: Estado de verificación en el panel
El bloque Repositorios de `/admin/proyectos` SHALL mostrar por repositorio una insignia de texto: «Verificado el {fecha}», «Sin verificar», «No encontrado en GitHub», «GitHub no da acceso», «Privado: no se publica» o «GitHub lo movió a {owner/repo}: actualizá la URL», y en el diálogo la descripción de GitHub como referencia de solo lectura. La barra del panel MUST NOT ganar un ítem.

#### Scenario: Repo no encontrado
- **WHEN** un repositorio quedó `NOT_FOUND` en la última sincronización
- **THEN** su fila muestra «No encontrado en GitHub»

#### Scenario: Barra sin cambios
- **WHEN** se recorre la navegación del panel
- **THEN** tiene los mismos ítems que antes del change

### Requirement: Solo el conector escribe la evidencia
`RepositoryEvidence` SHALL tener una fila por repositorio destacado, borrada en cascada con él, y solo el almacén del conector `github` MUST escribirla. El módulo `featured-repository` MUST NOT importar nada de `integrations`.

#### Scenario: Test de arquitectura
- **WHEN** corre `test/architecture.spec.ts`
- **THEN** pasa y falla si otro archivo escribe `repositoryEvidence` o si `featured-repository` importa `integrations`

#### Scenario: Borrado en cascada
- **WHEN** se borra un repositorio destacado con evidencia
- **THEN** su fila de `RepositoryEvidence` desaparece

### Requirement: Transporte de fixtures sin red ni tokens
Con `GITHUB_TRANSPORT=fixture` el conector SHALL responder desde `backend/test/fixtures/github/` con ETag y 304, 401 para el secreto `fixture-invalid-token` y los casos de límite, redirección y privado. Ese modo MUST hacer fallar el arranque con `NODE_ENV=production`, y ningún fixture MUST contener un token.

#### Scenario: Prohibido en producción
- **WHEN** la API arranca con `NODE_ENV=production` y `GITHUB_TRANSPORT=fixture`
- **THEN** no arranca y el mensaje nombra `GITHUB_TRANSPORT` sin imprimir valores

#### Scenario: Escaneo de tokens
- **WHEN** corre el escaneo de `ghp_`, `github_pat_` y `sk-ant-` sobre `backend/test/fixtures`
- **THEN** pasa con los fixtures de GitHub incluidos

### Requirement: El token no se filtra
El secreto del trabajo SHALL redactarse de todo mensaje de error, de `lastError` y de los logs del conector, y MUST NOT guardarse en snapshots ni en la evidencia ni devolverse por la API.

#### Scenario: Error con el token en el texto
- **WHEN** el transporte falla con un mensaje que contiene el secreto
- **THEN** `lastError` y el log muestran `[Redacted]` en su lugar
