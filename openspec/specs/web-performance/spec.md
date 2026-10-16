# web-performance Specification

## Purpose
Que un perfil curado abra rápido en un teléfono de gama media con red móvil, sin depender de cache en el servidor: el arranque público carga solo el JS que necesita para pintar, el contenido principal no espera animaciones y un presupuesto medible impide volver atrás.

## Requirements

### Requirement: Presupuesto de JS del arranque público
La suma gzip de todos los scripts que carga `dist/index.html` (el *entry*, sus `modulepreload` y los `<script src>` clásicos) SHALL ser ≤ 155 KB, con un solo JS de módulo y ningún `modulepreload`. Esos scripts MUST NOT contener la API clásica de `zod`, las animaciones de Motion para React ni el *popper* de Radix, que SHALL cargarse en diferido. `npm run perf:budget` SHALL medirlo sobre `dist/` y salir con 1 si se incumple.

#### Scenario: Build dentro del presupuesto
- **WHEN** se corre `npm run build` y luego `npm run perf:budget`
- **THEN** el script informa el total gzip del arranque, es ≤ 155 KB, hay un solo JS de módulo y sale con código 0

#### Scenario: Regresión detectada
- **WHEN** un componente público vuelve a importar `zod` clásico, `motion/react` o un menú de Radix de forma estática
- **THEN** `npm run perf:budget` sale con código 1 y nombra el chunk y la marca encontrada

#### Scenario: Arranque partido
- **WHEN** la configuración de build vuelve a separar el arranque en varios chunks (por ejemplo, con `manualChunks`)
- **THEN** `npm run perf:budget` sale con código 1 aunque el total no supere 155 KB

#### Scenario: El script temprano cuenta
- **WHEN** `dist/index.html` carga `/profile-prefetch.js`
- **THEN** su tamaño gzip entra en el total informado

### Requirement: El contenido principal no espera animaciones
El hero de la vista pública SHALL pintarse con opacidad completa desde su primer render, con o sin animaciones en el tema. Las demás secciones MAY animar su entrada al aparecer en pantalla según `runtime-theming`.

#### Scenario: Hero visible al primer render
- **WHEN** se abre `/tech-lead-dotnet` con un tema que tiene `effects.animations = true`
- **THEN** la sección `hero` tiene opacidad 1 en el primer frame en que existe en el DOM

#### Scenario: Secciones inferiores
- **WHEN** se abre el mismo perfil y se baja hasta *Experiencia*
- **THEN** esa sección sigue animando su entrada

### Requirement: Umbral de Lighthouse verificable
`npm run perf:check -- <base>` SHALL correr Lighthouse (versión exacta) en mobile `PERF_CHECK_RUNS` veces (default 3) sobre `/`, un perfil y su variante `?lang=en&theme=modern-dark&layout=sidebar`, y salir con 1 si la mediana de Performance baja de `PERF_CHECK_MIN_PERFORMANCE` (default 90) o la de Accessibility, Best Practices o SEO baja de 90; en `/admin/login`, solo Accessibility y Best Practices. Sin `A11Y_CHECK_DISPOSABLE_DB=1` SHALL salir con 2.

#### Scenario: Páginas públicas en mobile
- **WHEN** se corre contra el build de producción servido por Caddy y una base descartable
- **THEN** las tres páginas públicas tienen mediana ≥ 90 en las cuatro categorías y el script sale con código 0

#### Scenario: Login sin exigencia de SEO
- **WHEN** se mide `/admin/login`, que lleva `noindex`
- **THEN** su SEO se informa pero no hace fallar el script

#### Scenario: Sin base descartable
- **WHEN** se corre sin `A11Y_CHECK_DISPOSABLE_DB=1`
- **THEN** no se ejecuta ninguna medición y el script sale con código 2

#### Scenario: Umbral de Performance parametrizado
- **WHEN** se corre con `PERF_CHECK_RUNS=5` y `PERF_CHECK_MIN_PERFORMANCE=85` y una página da medianas de Performance 87 y de SEO 100
- **THEN** el script hace cinco corridas por página pública y esa página no lo hace fallar

### Requirement: Los checks de calidad web bloquean en CI
El workflow de CI SHALL correr, en cada push y PR a `main`, `perf:budget` sobre el build del frontend, y `a11y:check` y `perf:check` (5 corridas, Performance ≥ 85) contra la imagen de `frontend/Dockerfile` y la API sobre un Postgres de servicio migrado y sembrado. `A11Y_CHECK_DISPOSABLE_DB=1` SHALL definirse solo en ese job. Si un check falla, el workflow SHALL fallar y subir sus reportes como artefacto.

#### Scenario: Regresión de accesibilidad en un PR
- **WHEN** un PR a `main` vuelve a usar `text-brand` como texto con un acento oscuro
- **THEN** el job de accesibilidad falla por `color-contrast` y el workflow queda en rojo con el reporte de axe como artefacto

#### Scenario: Corrida verde
- **WHEN** un push a `main` no introduce regresiones
- **THEN** `perf:budget`, `a11y:check` y `perf:check` pasan y no se sube ningún artefacto

#### Scenario: La variable no se filtra
- **WHEN** se revisa `.github/workflows/ci.yml`
- **THEN** `A11Y_CHECK_DISPOSABLE_DB` aparece solo en el `env` del job que levanta su propio Postgres

#### Scenario: Umbral de Performance en CI
- **WHEN** se revisa el paso de Lighthouse del job `web-quality`
- **THEN** corre con `PERF_CHECK_RUNS` igual a 5 y `PERF_CHECK_MIN_PERFORMANCE` igual a 85

#### Scenario: Mobile de gama media
- **WHEN** el job `web-quality (lighthouse)` mide `/`, `/tech-lead-dotnet` y `/tech-lead-dotnet?lang=en&theme=modern-dark&layout=sidebar` en el runner de GitHub
- **THEN** la mediana de Performance de cada una es ≥ 85 y el job pasa

### Requirement: Tipografía por defecto desde el propio origen
Inter SHALL servirse desde el propio origen como woff2 bajo `/fonts/`, con su licencia junto al archivo y un nombre que cambia con su contenido; `index.html` SHALL precargarla (`rel="preload" as="font"`). `index.html` MUST NOT referenciar `fonts.googleapis.com` ni `fonts.gstatic.com`, y Google Fonts SHALL quedar solo para las demás familias. La CSP MUST NOT cambiar.

#### Scenario: Una sola petición de la fuente
- **WHEN** se abre `/` con el tema por defecto
- **THEN** el woff2 de Inter se pide una sola vez, al propio origen, y no hay peticiones a `fonts.googleapis.com` ni a `fonts.gstatic.com`

#### Scenario: Caché larga con nombre versionado
- **WHEN** se pide el woff2 de Inter al contenedor `web`
- **THEN** la respuesta trae `Cache-Control: public, max-age=31536000, immutable`

#### Scenario: Otra familia sigue en Google Fonts
- **WHEN** el tema activo usa `Playfair Display`
- **THEN** se inyecta la hoja de Google Fonts de esa familia y la consola no registra violaciones de CSP

### Requirement: Render del perfil en dos tiempos
Al recibir el perfil por primera vez en su montaje, la vista pública SHALL renderizar solo la sección `hero`, con un relleno `aria-hidden` de al menos el alto de la pantalla, y SHALL renderizar el resto de `sections`, en el orden recibido, dentro de una transición. Una vez revelada, la vista MUST NOT volver a mostrar solo el hero mientras siga montada. El preview del constructor MUST NOT usar este revelado.

#### Scenario: Hero primero
- **WHEN** se abre `/tech-lead-dotnet` y llega el perfil
- **THEN** el primer render con datos contiene `#hero` y el relleno, y después aparecen las demás secciones en el orden de `sections` y el relleno desaparece

#### Scenario: Cambio de idioma
- **WHEN** con el perfil ya revelado el visitante pasa de `ES` a `EN`
- **THEN** ningún render intermedio muestra solo el hero: las secciones siguen en pantalla y se actualizan al idioma nuevo

#### Scenario: Cambio de perfil en la misma ruta
- **WHEN** con `/dotnet-backend` revelado se navega a `/tech-lead-dotnet` sin recargar
- **THEN** al llegar el perfil nuevo se renderizan todas sus secciones sin pasar por «solo hero»

#### Scenario: Preview del constructor
- **WHEN** el constructor del panel muestra el preview de un perfil
- **THEN** renderiza todas las secciones en el primer render con datos

### Requirement: Render del perfil interrumpible
El render que depende de los datos del perfil SHALL ocurrir con prioridad de transición (valor diferido) y el montaje inicial de la app SHALL hacerse dentro de `startTransition`. Las secciones con animación de entrada SHALL declarar `content-visibility: auto` con un tamaño intrínseco recordado; el hero MUST NOT declararlo.

#### Scenario: Secciones fuera de pantalla
- **WHEN** se renderiza un perfil con la sección `experience`
- **THEN** `#experience` tiene `content-visibility: auto` y `#hero` no

#### Scenario: Estado de carga con valor diferido
- **WHEN** la consulta ya resolvió pero el valor diferido todavía no se aplicó
- **THEN** la vista sigue mostrando el esqueleto de carga y no un error

### Requirement: Menús de la barra en diferido
El selector de tema y el menú de perfiles MUST NOT viajar en el arranque. Hasta que carguen, la barra SHALL mostrar disparadores con el mismo nombre accesible, `aria-haspopup` y aspecto. SHALL cargarse al revelarse el perfil (o al llegar a un estado terminal) en un momento ocioso tras `load`, o antes ante `pointerenter`, `pointerdown` o `focus` en el disparador. El foco y una activación previa a la carga MUST conservarse.

#### Scenario: Disparador equivalente
- **WHEN** se renderiza la barra antes de que cargue el selector de tema
- **THEN** existe un botón con el nombre accesible del selector y `aria-haspopup="menu"`, y sus atributos accesibles coinciden con los del disparador real

#### Scenario: Foco conservado
- **WHEN** el disparador provisional tiene el foco de teclado y llega el módulo del menú
- **THEN** el foco queda en el disparador real, sin pasar por `body`

#### Scenario: Activación antes de la carga
- **WHEN** el visitante pulsa `Enter` sobre el disparador provisional del selector de tema antes de que cargue
- **THEN** al cargar, el menú se abre con el foco en su contenido y Escape devuelve el foco al disparador

#### Scenario: Carga fallida
- **WHEN** el import del menú falla
- **THEN** el disparador provisional sigue en la barra, la vista no muestra el estado de error y una nueva activación reintenta la carga

### Requirement: Petición temprana del perfil
`index.html` SHALL cargar con `async` un script clásico del propio origen, sin módulos compartidos con el bundle, que pida el perfil de `/` (slug `all`) y de `/:slug` con el slug, el idioma y el token que resolvería la app. La app SHALL tomar esa respuesta una sola vez si la clave coincide y la API es del mismo origen. Cada carga MUST hacer una sola petición del perfil y registrar una sola visita. MUST NOT correr en `/admin/*`.

#### Scenario: Una sola petición
- **WHEN** se abre `/tech-lead-dotnet?lang=es` en la imagen de producción contra una base descartable
- **THEN** hay exactamente una petición a `/api/curated-profiles/tech-lead-dotnet?locale=es` y la base registra un solo `ProfileView` nuevo

#### Scenario: Idioma y token
- **WHEN** se abre `/dotnet-backend?lang=en&token=abc`
- **THEN** la petición temprana es `GET /api/curated-profiles/dotnet-backend?locale=en` con la cabecera `X-Access-Token: abc` y la app la reutiliza

#### Scenario: Idioma del navegador
- **WHEN** se abre `/` sin `lang` con `navigator.language = "en-US"`
- **THEN** la petición temprana es `GET /api/curated-profiles/all?locale=en`

#### Scenario: Panel excluido
- **WHEN** se abre `/admin/login`
- **THEN** el script no hace ninguna petición

#### Scenario: Clave distinta
- **WHEN** la clave que dejó el script no coincide con la de la consulta de la app
- **THEN** la app no usa esa respuesta y pide el perfil con su propia petición

#### Scenario: Error de la API
- **WHEN** la petición temprana responde 401 o 404
- **THEN** la vista muestra el formulario de token o la página «perfil no encontrado», como sin el script

### Requirement: Animación de entrada sin remontar
Con animaciones activas, cada sección animada SHALL ser el mismo elemento `<section>` desde su primer render y SHALL animar su entrada de forma imperativa con Motion cuando aparece en pantalla, sin desmontar su contenido. Una sección que ya entró MUST NOT volver a ocultarse por un re-render. Si la animación no puede cargarse, la sección SHALL quedar visible.

#### Scenario: Sin remontaje
- **WHEN** se renderiza `ExperienceTimeline` con animaciones activas y llega el módulo de animación
- **THEN** el nodo DOM de `#experience` y los de su contenido son los mismos antes y después

#### Scenario: Animaciones desactivadas
- **WHEN** el tema tiene `effects.animations = false` o el visitante pidió `prefers-reduced-motion: reduce`
- **THEN** la sección tiene `data-motion="off"`, no se carga el módulo de animación y el contenido es visible

#### Scenario: Re-render tras la entrada
- **WHEN** una sección ya animó su entrada y el visitante cambia de idioma
- **THEN** la sección sigue visible, sin repetir la animación

#### Scenario: Módulo inaccesible
- **WHEN** el import del módulo de animación falla
- **THEN** la sección queda con opacidad 1
