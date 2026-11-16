## ADDED Requirements

### Requirement: Caso TC-52 de la evidencia de GitHub
El manual SHALL incluir el caso TC-52 «Verificar los repositorios contra GitHub» y ampliar B7 (estados de verificación y aviso del bloque Repositorios) y B17 Integraciones (proveedor `github`, `GITHUB_SYNC_TOKEN` y cómo crear el token fine-grained), con capturas generadas por `manual:capture` contra la base de ejemplo con `GITHUB_TRANSPORT=fixture`, sin red ni token real.

#### Scenario: Caso TC-52 alineado
- **WHEN** se ejecuta `npm run manual:check` con TC-52 en `MANUAL.md` e `index.html`
- **THEN** termina con código 0 y las capturas nuevas figuran en el inventario

#### Scenario: Mensajes literales
- **WHEN** se lee B7
- **THEN** lista literalmente «Sin verificar», «No encontrado en GitHub», «GitHub no da acceso», «Privado: no se publica» y «La última sincronización con GitHub falló»
