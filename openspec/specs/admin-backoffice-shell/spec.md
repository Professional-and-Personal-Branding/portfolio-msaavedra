# admin-backoffice-shell Specification

## Purpose
La puerta de entrada del panel: quién entra, qué pasa cuando la sesión caduca y cómo se navega entre las secciones de administración, sin filtrar nada a la vista pública.

## Requirements

### Requirement: Login del backoffice
`/admin/login` SHALL ofrecer un formulario de email y contraseña que llama a `POST /api/auth/login`. Con credenciales válidas SHALL redirigir al destino solicitado (o al dashboard) y mostrar el administrador autenticado; con credenciales inválidas SHALL mostrar un mensaje de error sin vaciar el email. El token MUST NOT guardarse en `localStorage` ni en `sessionStorage`.

#### Scenario: Login correcto
- **WHEN** se envía el formulario con credenciales válidas
- **THEN** la aplicación navega a `/admin` y la barra del panel muestra el nombre del administrador

#### Scenario: Credenciales inválidas
- **WHEN** la API responde 401 al login
- **THEN** se muestra "Email o contraseña incorrectos", el campo de email conserva su valor y no hay navegación

#### Scenario: Sin almacenamiento del token
- **WHEN** se completa un login exitoso
- **THEN** `localStorage` y `sessionStorage` no contienen el JWT

### Requirement: Rutas protegidas y restauración de sesión
Todas las rutas `/admin/*` distintas de `/admin/login` SHALL requerir sesión. Al cargar la aplicación, el estado de sesión SHALL determinarse con `GET /api/auth/me`: mientras se resuelve se muestra un estado de carga, con 200 se permite el acceso y con 401 se redirige a `/admin/login` recordando la ruta pedida.

#### Scenario: Sesión válida tras recargar
- **WHEN** se recarga `/admin/experiencias` con la cookie de sesión vigente
- **THEN** tras la comprobación se renderiza la página de experiencias, sin pasar por el login

#### Scenario: Sin sesión
- **WHEN** se abre `/admin/perfiles` sin sesión
- **THEN** se redirige a `/admin/login`, y al autenticarse se vuelve a `/admin/perfiles`

#### Scenario: Sesión caducada durante el uso
- **WHEN** una petición del panel responde 401
- **THEN** el estado de sesión se invalida y se redirige a `/admin/login`

### Requirement: Cierre de sesión
El panel SHALL ofrecer cerrar sesión; al hacerlo llama a `POST /api/auth/logout`, descarta el estado de sesión y las respuestas cacheadas, y navega a `/admin/login`.

#### Scenario: Logout
- **WHEN** se pulsa "Cerrar sesión"
- **THEN** se llama a `POST /api/auth/logout` y se llega a `/admin/login`; volver atrás en el navegador no muestra datos del panel

### Requirement: Estructura del panel
Las rutas autenticadas SHALL compartir un layout con navegación a Dashboard, Experiencias, Skills y Perfiles curados, indicando la sección activa, con un enlace para abrir el portafolio público y navegación usable en 375 px. El panel SHALL renderizarse con una apariencia estable propia (preset `modern-dark`), independiente del tema que se esté editando.

#### Scenario: Navegación
- **WHEN** se está en `/admin/skills`
- **THEN** el enlace "Skills" aparece marcado como activo y los demás enlaces llevan a sus rutas

#### Scenario: El panel no cambia con el tema editado
- **WHEN** en el customizador se elige un tema claro para el perfil
- **THEN** cambian los colores del preview, no los del panel

### Requirement: Separación de la vista pública
El bundle y el estado del panel MUST NOT alterar la vista pública: las rutas públicas siguen funcionando sin sesión y el código del backoffice SHALL cargarse de forma diferida (`lazy`), de modo que un visitante anónimo no lo descargue.

#### Scenario: Visitante anónimo
- **WHEN** se abre `/` sin sesión
- **THEN** la home renderiza normalmente y el chunk del backoffice no se solicita

### Requirement: Pantalla Cuenta con cambio de contraseña
`/admin/cuenta` SHALL requerir sesión, mostrar el nombre y el email del administrador y un formulario con la contraseña actual, la nueva y su repetición que llama a `POST /api/auth/password`. La barra superior SHALL enlazar a Cuenta. El formulario MUST validar en el cliente las reglas de la API y que la repetición coincida, MUST vaciar los campos tras el éxito y MUST NOT guardar contraseñas ni tokens en `localStorage` ni `sessionStorage`.

#### Scenario: Acceso desde la barra
- **WHEN** se pulsa **Cuenta** en la barra superior del panel
- **THEN** se llega a `/admin/cuenta`, que muestra el nombre y el email del administrador

#### Scenario: Cambio correcto
- **WHEN** se completa el formulario con la actual correcta y una nueva válida repetida igual, y la API responde 200
- **THEN** aparece "Contraseña actualizada. Se cerraron las sesiones de otros dispositivos.", los tres campos quedan vacíos y se sigue en `/admin/cuenta`

#### Scenario: Contraseña actual incorrecta
- **WHEN** la API responde 401 al cambio y `GET /api/auth/me` sigue respondiendo 200
- **THEN** se muestra "La contraseña actual no es correcta" y no hay navegación

#### Scenario: La repetición no coincide
- **WHEN** la nueva y su repetición difieren
- **THEN** se muestra "Las contraseñas no coinciden" y no se llama a la API

#### Scenario: Nueva demasiado corta
- **WHEN** la nueva tiene 11 caracteres
- **THEN** se muestra "Usá al menos 12 caracteres" y no se llama a la API

#### Scenario: Demasiados intentos
- **WHEN** la API responde 429
- **THEN** se muestra "Demasiados intentos. Probá de nuevo en unos minutos."

#### Scenario: Sin almacenamiento
- **WHEN** se completa un cambio exitoso
- **THEN** `localStorage` y `sessionStorage` no contienen ninguna de las contraseñas ni el JWT

### Requirement: Pantalla Revisión del CV
`/admin/revision` SHALL requerir sesión, figurar como **Revisión** en la navegación y mostrar el resultado de `GET /api/admin/consistency`: el resumen por severidad, los años declarados y derivados, y los hallazgos agrupados en Errores, Avisos y Sugerencias y por tipo de entidad, cada uno con su mensaje y un enlace **Abrir** al ítem. La severidad MUST distinguirse por texto, no solo por color.

#### Scenario: Abrir una experiencia
- **WHEN** se pulsa **Abrir** en un hallazgo de la experiencia `exp1`
- **THEN** se llega a `/admin/experiencias`, se abre el diálogo de edición de `exp1` y el parámetro `editar` sale de la URL

#### Scenario: El ítem ya no existe
- **WHEN** se abre `/admin/formacion?editar=<id>` con un id que no está en la lista
- **THEN** aparece "El ítem ya no existe." y no se abre ningún diálogo

#### Scenario: Perfil curado
- **WHEN** se pulsa **Abrir** en un hallazgo de un perfil curado
- **THEN** se llega a su ficha en `/admin/perfiles/<id>`

#### Scenario: Sin hallazgos
- **WHEN** la API devuelve `issues` vacío
- **THEN** se muestra "No hay hallazgos: el CV es consistente." y ningún bloque de severidad

#### Scenario: Volver a revisar
- **WHEN** se corrige un ítem y se pulsa **Volver a revisar**
- **THEN** se vuelve a pedir `GET /api/admin/consistency` y la lista refleja el cambio

### Requirement: Pantalla Integraciones
`/admin/integraciones` SHALL requerir sesión, MUST NOT sumar un ítem a la barra del panel y se SHALL alcanzar desde Cuenta y desde un aviso del Dashboard. Muestra por proveedor su estado (por texto), la última corrida, la cola y el último error; **Sincronizar ahora** encola, **Pausar** y **Reanudar** cambian `enabled`, y la credencial se escribe sin mostrarse nunca.

#### Scenario: Sincronizar ahora
- **WHEN** se pulsa **Sincronizar ahora** en `fake`
- **THEN** aparece «Encolado: corre en el próximo minuto.» y la cola muestra 1 pendiente

#### Scenario: Ya en cola
- **WHEN** se vuelve a pulsar con el trabajo pendiente
- **THEN** aparece «Ya había una sincronización en cola.»

#### Scenario: Atrasado
- **WHEN** la API devuelve `stale: true` para `fake`
- **THEN** la tarjeta muestra «Sin sincronizar hace más de 48 h»

#### Scenario: Credencial
- **WHEN** se guarda una credencial y se recarga la página
- **THEN** el campo está vacío, la tarjeta dice que la credencial está guardada en la base y el valor no figura en el DOM

#### Scenario: Credencial vacía
- **WHEN** se pulsa **Guardar** con el campo vacío
- **THEN** aparece «Ingresá la credencial.» y no se llama a la API

#### Scenario: Sin proveedores
- **WHEN** la API devuelve `providers` vacío
- **THEN** se muestra «No hay integraciones habilitadas. Se activan con la variable `INTEGRATIONS_ENABLED` del servidor.»

#### Scenario: Scheduler apagado
- **WHEN** la API devuelve `schedulerEnabled: false`
- **THEN** se muestra «El scheduler está apagado en este servidor: lo que encoles queda en espera.»

#### Scenario: Acceso desde Cuenta
- **WHEN** se abre la pantalla Cuenta
- **THEN** hay un bloque «Integraciones» con un enlace «Integraciones» que lleva a `/admin/integraciones`, y la barra de navegación del panel no tiene un ítem Integraciones

#### Scenario: Aviso en el Dashboard
- **WHEN** la API devuelve algún proveedor con `stale: true` o con trabajos `dead` mayores que 0
- **THEN** el Dashboard muestra «Hay integraciones que requieren atención» con un enlace a `/admin/integraciones`

#### Scenario: Dashboard sin avisos
- **WHEN** ningún proveedor está atrasado ni tiene trabajos muertos, o no hay proveedores
- **THEN** el Dashboard no muestra el aviso
