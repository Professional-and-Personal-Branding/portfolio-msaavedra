## ADDED Requirements

### Requirement: Pantalla Crear desde una vacante en el manual
El manual SHALL describir la pantalla Crear desde una vacante (B17): fuentes admitidas y portales cerrados, cada campo con su regla y sus mensajes literales, cómo leer la cobertura, que el borrador nace privado y no enumerado, y que el texto de la vacante se borra a los 90 días. SHALL incluir el caso TC-51 con su captura generada por `manual:capture` sin red.

#### Scenario: Portales cerrados explicados
- **WHEN** se lee B17
- **THEN** nombra LinkedIn e Indeed entre los portales que no se pueden leer y explica cómo pegar el texto

#### Scenario: Caso TC-51 alineado
- **WHEN** se ejecuta `npm run manual:check` con TC-51 en `MANUAL.md` e `index.html`
- **THEN** termina con código 0 y la captura `bo-desde-vacante.jpg` figura en el inventario
