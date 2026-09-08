## Purpose

La puerta de entrada del panel: quién entra, qué pasa cuando la sesión caduca y cómo se navega entre las secciones de administración, sin filtrar nada a la vista pública.

## ADDED Requirements

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
