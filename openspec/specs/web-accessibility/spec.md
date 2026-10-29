# web-accessibility Specification

## Purpose
Que la vista pública y el panel cumplan WCAG 2.2 AA con cualquier tema, preset, override o idioma: texto legible aunque el owner elija un acento oscuro, foco que siempre se ve, navegación por teclado sin rodeos y estructura que los lectores de pantalla entienden, verificado con un comando que no ensucia la analítica.

## Requirements

### Requirement: Acento legible como texto
El motor de theming SHALL derivar de cada tema efectivo un color de acento para texto (`--t-accent-ink`) con el tono del acento y contraste ≥ 4,5:1 contra `bg`, `bgSoft` y `card`; si el acento ya cumple, SHALL ser el acento. Todo texto pintado con el acento SHALL usar ese derivado; rellenos, bordes e íconos decorativos MAY seguir usando el acento. Los tokens guardados MUST NOT cambiar.

#### Scenario: Acento oscuro sobre tema oscuro
- **WHEN** se abre `/tech-lead-dotnet`, cuyo tema efectivo es `modern-dark` con `accent = #5B2C87`
- **THEN** el titular del hero y los *eyebrow* de las secciones tienen contraste ≥ 4,5:1 contra su fondo y conservan el tono del acento

#### Scenario: Acento que ya cumple
- **WHEN** el tema efectivo es `modern-dark` sin overrides (`accent = #38bdf8`)
- **THEN** `--t-accent-ink` es `#38bdf8`

#### Scenario: Los datos no cambian
- **WHEN** se guarda un perfil con `themeOverrides.colors.accent = #1E293B`
- **THEN** la API devuelve ese mismo acento y solo el derivado del cliente se ajusta

### Requirement: Texto atenuado y texto sobre el acento con contraste AA
El texto atenuado (`text-dim`) SHALL tener contraste ≥ 4,5:1 contra `bg`, `bgSoft` y `card` en cualquier tema, sin dejar de ser más tenue que `textMuted` cuando el tema lo permita. El texto sobre un relleno de acento SHALL ser, entre blanco y `#0a0e1a`, el de mayor contraste WCAG con el acento.

#### Scenario: Atenuado en los cinco presets
- **WHEN** se recorren los cinco presets
- **THEN** cada texto `text-dim` de la vista pública mide ≥ 4,5:1 contra su fondo

#### Scenario: Botón primario de modern-light
- **WHEN** el tema efectivo es `modern-light` (`accent = #0284c7`)
- **THEN** el texto del botón primario es `#0a0e1a` (4,70:1) y no blanco (4,09:1)

### Requirement: Indicador de foco visible
Todo elemento enfocado con teclado, en la vista pública y en el panel, SHALL mostrar un único indicador sólido de al menos 2 px, separado del borde del elemento y con contraste ≥ 3:1 contra el fondo adyacente, derivado del tema efectivo.

#### Scenario: Foco con un acento oscuro
- **WHEN** en `/tech-lead-dotnet` se recorre con Tab la barra superior y el hero
- **THEN** cada control enfocado muestra un contorno sólido de 2 px con contraste ≥ 3:1 contra el fondo

#### Scenario: Componentes de librería
- **WHEN** se enfoca con Tab un botón o un campo de shadcn/ui en el panel
- **THEN** se ve el mismo indicador y no un anillo semitransparente

### Requirement: Salto al contenido y landmarks
La vista pública y el panel SHALL ofrecer como primer elemento enfocable un enlace *Saltar al contenido* (traducido según el idioma activo en la vista pública), oculto hasta recibir foco, que lleve el foco al `<main>` de la pantalla. Cada pantalla, `/admin/login` incluida, SHALL tener exactamente un `<main>`.

#### Scenario: Primer Tab en un perfil
- **WHEN** se abre `/tech-lead-dotnet?lang=en` y se pulsa Tab una vez
- **THEN** el foco está en un enlace visible "Skip to content"

#### Scenario: Activar el salto en el panel
- **WHEN** en `/admin/experiencias` se activa *Saltar al contenido*
- **THEN** el siguiente Tab enfoca un control del contenido y no del menú lateral

#### Scenario: Login con landmark
- **WHEN** se audita `/admin/login` con axe
- **THEN** no hay violaciones `landmark-one-main` ni `region`

### Requirement: Estructura semántica válida
Las listas de definición SHALL contener solo grupos `div` con `dt` y `dd` como hijos directos. Las pestañas SHALL controlar paneles que existen en el DOM: cada `aria-controls` MUST apuntar a un id presente.

#### Scenario: Contacto
- **WHEN** se audita la sección de contacto en layout `classic` y `sidebar`
- **THEN** axe no reporta `definition-list` ni `dlitem`

#### Scenario: Campo bilingüe del panel
- **WHEN** se audita `/admin/portada` y la ficha de un perfil en el constructor
- **THEN** axe no reporta `aria-valid-attr-value` y las pestañas ES/EN siguen editando el mismo campo

### Requirement: Movimiento reducido completo
Con `prefers-reduced-motion: reduce`, además de apagar las animaciones de entrada, el desplazamiento a un ancla MUST NOT ser animado.

#### Scenario: Ancla con movimiento reducido
- **WHEN** con `prefers-reduced-motion: reduce` se activa *Saltar al contenido*
- **THEN** `scroll-behavior` del documento es `auto`

### Requirement: Auditoría de accesibilidad reproducible
`npm run a11y:check -- <base>` SHALL correr axe-core (versión exacta) y un recorrido de teclado sobre la home, cada preset × layout de un perfil base (`A11Y_CHECK_PROFILE`), `?lang=en`, los perfiles con acento propio, el 404, `/admin/login` y, con credenciales de prueba, el panel; SHALL salir con 1 ante una violación `serious` o `critical`, y con 2 si falta `A11Y_CHECK_DISPOSABLE_DB=1` o el perfil base no resuelve. El CI SHALL correrlo sobre `cv-data.json` y sobre los datos de ejemplo.

#### Scenario: Sin la variable de base descartable
- **WHEN** se corre `npm run a11y:check -- http://localhost:8080` sin `A11Y_CHECK_DISPOSABLE_DB=1`
- **THEN** el script no abre ninguna página y sale con código 2

#### Scenario: Línea base cumplida
- **WHEN** se corre contra el build de producción servido por Caddy y una base descartable sembrada
- **THEN** sale con código 0 y el reporte lista 0 violaciones `serious` y 0 `critical`

#### Scenario: Perfil base inexistente
- **WHEN** con los datos de ejemplo se corre `a11y:check` sin definir `A11Y_CHECK_PROFILE` (el valor por defecto `tech-lead-dotnet` no existe ahí)
- **THEN** el script avisa que el perfil base no existe, no abre ninguna página y sale con código 2

#### Scenario: Datos de ejemplo con panel
- **WHEN** se corre con panel y `A11Y_CHECK_PROFILE=ejemplo-backend` contra una base descartable sembrada con `seed:example`
- **THEN** sale con código 0, con 0 violaciones `serious` y 0 `critical`, incluidas las listas con ítems ocultos y los presets claros

#### Scenario: Los dos juegos de datos en el CI
- **WHEN** corre el job `web-quality` en un PR
- **THEN** hay una auditoría con panel sobre `cv-data.json` y otra sobre los datos de ejemplo, y cualquiera de las dos con una violación `serious` o `critical` hace fallar el job

### Requirement: Ítems ocultos sin pérdida de contraste
Un ítem oculto en una lista del panel (experiencias, formación, certificaciones, proyectos, enlaces) SHALL distinguirse de uno visible con una insignia textual y un estilo de borde o fondo propio. Su texto MUST NOT bajar de 4,5:1 contra su fondo: el estado no se expresa con opacidad ni filtros sobre el texto.

#### Scenario: Experiencia oculta legible
- **WHEN** con los datos de ejemplo se audita `/admin/experiencias` con axe, en móvil y en escritorio
- **THEN** la fila de la experiencia oculta muestra la insignia «Oculta» y axe no reporta `color-contrast`

#### Scenario: Formación y proyectos ocultos
- **WHEN** con los datos de ejemplo se auditan `/admin/formacion` y `/admin/proyectos`
- **THEN** cada fila oculta muestra la insignia «Oculto», un borde distinto del de las filas visibles, y axe no reporta `color-contrast`

#### Scenario: Ninguna fila usa opacidad para el estado
- **WHEN** se renderiza una lista del panel con un ítem `visible: false`
- **THEN** la fila no lleva clases `opacity-*` y conserva las clases de color de texto de una fila visible

### Requirement: Insignias de estado legibles
El texto de una insignia de estado (como «Actual» en una experiencia en curso) SHALL usar un color derivado del tema efectivo con el tono del estado y contraste ≥ 4,5:1 contra `bg`, `bgSoft`, `card` y el tinte de la insignia; si el color base ya cumple, SHALL ser el color base. El derivado MUST NOT guardarse.

#### Scenario: Experiencia actual con un preset claro
- **WHEN** se abre `/ejemplo-backend?theme=modern-light` y la línea de tiempo muestra la insignia «Actual»
- **THEN** su texto mide ≥ 4,5:1 contra el fondo de la insignia y conserva el tono verde

#### Scenario: Preset oscuro sin cambio
- **WHEN** el tema efectivo es `modern-dark` sin overrides
- **THEN** el derivado del estado es el verde base `#00bc7d`

#### Scenario: Cinco presets
- **WHEN** se calculan las variables de los cinco presets
- **THEN** el derivado del estado mide ≥ 4,5:1 contra cada superficie y contra el tinte de la insignia

### Requirement: Regiones desplazables alcanzables con teclado
Toda región del sitio o del panel cuyo contenido se desplace y no contenga elementos enfocables SHALL ser enfocable con Tab, tener un nombre accesible y mostrar el indicador de foco del tema, de modo que su contenido se pueda recorrer con las flechas.

#### Scenario: Barras por día en móvil
- **WHEN** a 375 px de ancho se abre `/admin` con los datos de ejemplo y se audita con axe
- **THEN** axe no reporta `scrollable-region-focusable` y la región de las barras tiene nombre «Visitas por día»

#### Scenario: Desplazar con teclado
- **WHEN** a 375 px se enfoca con Tab la región de las barras y se pulsa la flecha derecha
- **THEN** la región se desplaza en horizontal y muestra un contorno sólido de 2 px con contraste ≥ 3:1
