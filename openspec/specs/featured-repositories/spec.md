# featured-repositories Specification

## Purpose
Los proyectos destacados cuentan qué se hizo, pero una empresa técnica quiere ver código. Repositorios de GitHub cargados a mano desde el panel, con tags y visibilidad como los proyectos, permiten mostrarlos en una sección propia del perfil curado, en la hoja imprimible si entran y en el JSON Resume, sin llamar a la API de GitHub.

## Requirements

### Requirement: URL de GitHub canónica
La URL de un repositorio destacado SHALL tener la forma exacta `https://github.com/<owner>/<repo>`: host `github.com` sin `www.` ni puerto, `owner` de 1 a 39 caracteres alfanuméricos o guiones simples sin guion en los bordes, `repo` de 1 a 100 de `[A-Za-z0-9._-]` distinto de `.` y `..` y sin `.git` final, sin barra final, query ni fragmento. Una sola función pura de dominio SHALL decidirlo y devolver `owner` y `repo`.

#### Scenario: URL válida
- **WHEN** se valida `https://github.com/octo-org/api-reservas`
- **THEN** el resultado es exitoso con `owner` `octo-org` y `repo` `api-reservas`

#### Scenario: URLs rechazadas
- **WHEN** se valida `http://github.com/a/b`, `https://www.github.com/a/b`, `https://gitlab.com/a/b`, `https://github.com/a`, `https://github.com/a/b/`, `https://github.com/a/b.git`, `https://github.com/a/b?tab=x` o `https://github.com/-a/b`
- **THEN** cada una devuelve un error de validación sobre `url`

### Requirement: Campos de un repositorio destacado
Un repositorio SHALL tener `name` (1 a 100 caracteres sin contar espacios de los bordes), `url` (según la URL de GitHub canónica), `language` opcional (hasta 40), `description` bilingüe con `es` obligatorio, `technologies[]`, `tags[]`, `order` (entero ≥ 0) y `visible`. `stars` MUST NOT leerse ni escribirse por la API en este change.

#### Scenario: Nombre vacío
- **WHEN** se crea un repositorio con `name: "   "`
- **THEN** responde 400 nombrando `name` y no se guarda nada

#### Scenario: Stars fuera del contrato
- **WHEN** se hace `POST /api/admin/featured-repositories` con un campo `stars`
- **THEN** responde 400 por campo desconocido

### Requirement: Un repositorio no se carga dos veces
Crear o editar un repositorio cuyo par `owner/repo`, sin distinguir mayúsculas, ya pertenece a otro registro SHALL responder 409 sin guardar. Editar un registro conservando su propia URL MUST NOT dar conflicto.

#### Scenario: Duplicado con otras mayúsculas
- **WHEN** existe `https://github.com/octo-org/api-reservas` y se crea otro con `https://github.com/Octo-Org/API-Reservas`
- **THEN** responde 409 y la cantidad de repositorios no cambia

#### Scenario: Editar sin cambiar la URL
- **WHEN** se hace `PATCH` de un repositorio cambiando solo `name`
- **THEN** responde 200

### Requirement: Repositorios destacados visibles
`GET /api/featured-repositories` SHALL devolver 200 con los repositorios visibles ordenados por `order`. Cada elemento MUST contener `id`, `name`, `url`, `language` (nulo si no hay), `description` (resuelta al locale), `technologies[]`, `tags[]` y `order`, y MUST NOT contener `visible` ni `stars`.

#### Scenario: Listado en inglés
- **WHEN** un cliente hace `GET /api/featured-repositories?locale=en` contra la base de ejemplo
- **THEN** recibe los 2 repositorios visibles, `description` es un string en inglés y `Content-Language` es `en`

#### Scenario: Base sin repositorios
- **WHEN** un cliente hace `GET /api/featured-repositories` tras sembrar `docs/cv-data.json`
- **THEN** recibe 200 con un array vacío

### Requirement: Administración de repositorios por la API del panel
`/api/admin/featured-repositories` SHALL ofrecer listado crudo (con ocultos, `description` `{es,en}`, `visible` y `order`), alta, detalle, edición parcial y borrado, todos autenticados y con validación de whitelist, igual que proyectos.

#### Scenario: Sin sesión
- **WHEN** se hace `GET /api/admin/featured-repositories` sin cookie ni Bearer
- **THEN** responde 401

#### Scenario: Ocultar sin borrar
- **WHEN** se hace `PATCH` con `visible: false` sobre un repositorio
- **THEN** sigue en el listado del panel con `visible: false` y no figura en `GET /api/featured-repositories`

#### Scenario: Borrar
- **WHEN** se hace `DELETE` de un repositorio existente y después `GET /api/admin/featured-repositories/:id`
- **THEN** el borrado responde 204 y el detalle responde 404

### Requirement: Sección pública de repositorios
La sección `repositories` SHALL mostrar una tarjeta por repositorio con el nombre como enlace a su URL (`target="_blank"`, `rel="noopener noreferrer"`, nombre accesible que incluye el nombre del repositorio), la descripción, el lenguaje si existe y las tecnologías. MUST NOT cargar recursos de otros orígenes ni llamar a GitHub.

#### Scenario: Tarjeta con enlace
- **WHEN** se abre `/` contra la base de ejemplo
- **THEN** la sección `#repositories` tiene dos tarjetas y cada enlace apunta a su `https://github.com/...` con `target="_blank"` y `rel="noopener noreferrer"`

#### Scenario: Sin lenguaje
- **WHEN** un repositorio tiene `language: null`
- **THEN** su tarjeta no muestra la etiqueta de lenguaje ni un valor vacío

### Requirement: Preparado para la sincronización sin rehacer el modelo
El dominio SHALL derivar `owner/repo` de la URL guardada con la misma función que la valida, para que un change posterior asocie datos sincronizados a cada repositorio por su `id` sin cambiar la entidad. Este change MUST NOT llamar a ninguna API externa ni requerir secretos nuevos.

#### Scenario: Sin red en los tests
- **WHEN** corren las suites unitaria y e2e del módulo sin acceso a internet
- **THEN** pasan y ninguna hace peticiones a `github.com`
