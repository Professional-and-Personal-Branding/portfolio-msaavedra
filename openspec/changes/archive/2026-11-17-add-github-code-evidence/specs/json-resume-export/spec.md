## ADDED Requirements

### Requirement: Lenguaje efectivo de los repositorios en el JSON Resume
Cada repositorio exportado en `projects` SHALL usar en `keywords` el lenguaje efectivo: el cargado a mano si existe y, si no, el lenguaje principal verificado en GitHub. La exportación MUST NOT incluir stars, topics ni fechas de GitHub, y MUST NOT llamar a GitHub.

#### Scenario: Lenguaje desde GitHub
- **WHEN** un repositorio sin lenguaje manual tiene evidencia `OK` con lenguaje principal `Java` y se pide `resume.json`
- **THEN** su entrada en `projects` tiene `Java` como primer elemento de `keywords`

#### Scenario: Sin campos de GitHub
- **WHEN** se exporta un perfil con repositorios verificados
- **THEN** ninguna entrada de `projects` tiene stars, topics ni la fecha de verificación, y el documento sigue validando contra el schema v1.0.0
