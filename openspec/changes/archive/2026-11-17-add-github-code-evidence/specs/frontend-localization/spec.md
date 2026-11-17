## ADDED Requirements

### Requirement: Rótulos de la evidencia de GitHub
Los rótulos de la evidencia SHALL existir en español e inglés: «Verificado en GitHub el {fecha}» / «Verified on GitHub on {date}», «Archivado» / «Archived», «Último cambio: {mes}» / «Last change: {month}» y el nombre accesible de las stars («{n} stars en GitHub» / «{n} stars on GitHub»). Las fechas MUST formatearse con el locale de la vista.

#### Scenario: Vista en inglés
- **WHEN** se abre un perfil con `?lang=en` y un repositorio verificado
- **THEN** la tarjeta dice «Verified on GitHub on» con la fecha en formato inglés

#### Scenario: Stars accesibles
- **WHEN** un lector de pantalla recorre una tarjeta con 12 stars en español
- **THEN** anuncia «12 stars en GitHub» y no solo el número
