## ADDED Requirements

### Requirement: Caso TC-53 de las tablas del Dashboard con teclado
El manual SHALL incluir el caso TC-53: a 375 px, con al menos una visita atribuida a un enlace y otra a un portal, llegar con Tab a las tablas **Por enlace** y **Por portal** del Dashboard y desplazarlas con las flechas, con el contorno de foco visible. La pantalla B2 SHALL mencionar que las tablas desplazables se recorren con el teclado.

#### Scenario: Caso TC-53 alineado
- **WHEN** se ejecuta `npm run manual:check` con TC-53 en `MANUAL.md`, en `index.html` y en la tabla de la suite
- **THEN** termina con código 0

#### Scenario: Pasos reproducibles
- **WHEN** se siguen los pasos de TC-53 sobre la base de ejemplo descartable después de TC-41
- **THEN** el foco llega a la región «Visitas por enlace», la flecha derecha la desplaza y el contorno se ve
