## ADDED Requirements

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

## MODIFIED Requirements

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
