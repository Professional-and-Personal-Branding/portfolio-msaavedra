## MODIFIED Requirements

### Requirement: Repositorios destacados en el seed
El seed SHALL cargar todos los `profile.featuredRepositories` del archivo, visibles y ocultos, con `order` según su posición. Una clave `stars` de un archivo anterior SHALL ignorarse como cualquier clave que el seed no conoce, sin validar su tipo. Antes de borrar nada MUST validar cada `url` con la URL de GitHub canónica, rechazar dos con el mismo `owner/repo` sin distinguir mayúsculas y aceptar un `id` opcional único. `seed:verify` SHALL contarlos todos.

#### Scenario: Seed por defecto
- **WHEN** se ejecuta `npm run seed` sobre una base migrada vacía con `docs/cv-data.json`
- **THEN** termina con código 0, `FeaturedRepository` tiene 0 filas y `npm run seed:verify` termina con código 0

#### Scenario: URL inválida en el archivo
- **WHEN** se carga con `--file` un archivo cuyo primer repositorio tiene `url: "https://gitlab.com/a/b"`
- **THEN** el seed termina con código 1 nombrando `profile.featuredRepositories[0].url` y la base no cambia

#### Scenario: Repositorio oculto sembrado
- **WHEN** se carga el ejemplo, que tiene un repositorio con `visible: false`
- **THEN** la tabla tiene 3 filas, una con `visible = false`, y `npm run seed:example:verify` termina con código 0

#### Scenario: Archivo anterior con stars
- **WHEN** se carga un archivo cuyos repositorios traen `stars: 12` y no traen `id`
- **THEN** el seed termina con código 0, crea los repositorios con sus demás campos y no escribe stars en ninguna tabla

#### Scenario: Stars no numérica
- **WHEN** se valida un archivo cuyo primer repositorio trae `stars: "muchas"`
- **THEN** la validación no informa ningún error sobre `profile.featuredRepositories[0].stars`
