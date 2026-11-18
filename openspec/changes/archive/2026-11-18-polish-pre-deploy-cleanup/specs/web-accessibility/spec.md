## MODIFIED Requirements

### Requirement: Regiones desplazables alcanzables con teclado
Toda región del sitio o del panel cuyo contenido se desplace y no contenga elementos enfocables SHALL ser enfocable con Tab, tener un nombre accesible y mostrar el indicador de foco del tema, de modo que su contenido se pueda recorrer con las flechas. Incluye las tablas **Por enlace** y **Por portal** del Dashboard.

#### Scenario: Barras por día en móvil
- **WHEN** a 375 px de ancho se abre `/admin` con los datos de ejemplo y se audita con axe
- **THEN** axe no reporta `scrollable-region-focusable` y la región de las barras tiene nombre «Visitas por día»

#### Scenario: Desplazar con teclado
- **WHEN** a 375 px se enfoca con Tab la región de las barras y se pulsa la flecha derecha
- **THEN** la región se desplaza en horizontal y muestra un contorno sólido de 2 px con contraste ≥ 3:1

#### Scenario: Tabla por enlace en móvil
- **WHEN** a 375 px se abre `/admin` con visitas atribuidas a un enlace de etiqueta larga y se audita con axe
- **THEN** axe no reporta `scrollable-region-focusable`, el contenedor de la tabla es una región «Visitas por enlace» enfocable con Tab y la flecha derecha la desplaza

#### Scenario: Tabla por portal
- **WHEN** se renderiza el Dashboard con `bySource` no vacío
- **THEN** el contenedor de la tabla **Por portal** es una región «Visitas por portal» con `tabIndex` 0

#### Scenario: Tablas con controles sin cambios
- **WHEN** se renderiza una tabla del panel sin `regionLabel`, como la de Postulaciones
- **THEN** su contenedor no tiene `role`, `aria-label` ni `tabIndex`

## ADDED Requirements

### Requirement: La auditoría ve las tablas del Dashboard con filas
Con panel, `a11y:check` SHALL registrar antes de auditar, una sola vez y solo en la base descartable, visitas de persona del perfil `all` con un enlace de seguimiento de etiqueta larga y con un portal. Una entrada propia SHALL auditar `/admin` en los dos viewports y MUST fallar con código 1 si **Por enlace** o **Por portal** no tienen filas o si, en móvil, **Por enlace** no desborda.

#### Scenario: Datos que producen scroll
- **WHEN** se corre `a11y:check` con panel contra la imagen de producción y una base descartable sembrada
- **THEN** la entrada `admin-dashboard-tablas` en móvil encuentra las dos tablas con filas, la de **Por enlace** con `scrollWidth` mayor que `clientWidth`, y axe no reporta `scrollable-region-focusable`

#### Scenario: Visitas que no llegan como personas
- **WHEN** las visitas de preparación se clasifican como bots y las tablas quedan en su estado vacío
- **THEN** la entrada informa el problema de preparación y el script sale con código 1

#### Scenario: Idempotente
- **WHEN** se corre `a11y:check` dos veces sobre la misma base
- **THEN** existe un solo enlace «Auditoría a11y — enlace de seguimiento con etiqueta larga para el móvil» en el perfil `all`
