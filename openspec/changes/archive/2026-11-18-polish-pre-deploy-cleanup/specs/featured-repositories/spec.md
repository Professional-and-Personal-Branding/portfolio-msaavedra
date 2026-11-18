## MODIFIED Requirements

### Requirement: Campos de un repositorio destacado
Un repositorio SHALL tener `name` (1 a 100 caracteres sin contar espacios de los bordes), `url` (según la URL de GitHub canónica), `language` opcional (hasta 40), `description` bilingüe con `es` obligatorio, `technologies[]`, `tags[]`, `order` (entero ≥ 0) y `visible`. Un repositorio MUST NOT tener stars propias: la API no las lee ni las escribe y la tabla `FeaturedRepository` no tiene la columna `stars`; las stars solo vienen de la evidencia verificada contra GitHub.

#### Scenario: Nombre vacío
- **WHEN** se crea un repositorio con `name: "   "`
- **THEN** responde 400 nombrando `name` y no se guarda nada

#### Scenario: Stars fuera del contrato
- **WHEN** se hace `POST /api/admin/featured-repositories` con un campo `stars`
- **THEN** responde 400 por campo desconocido

#### Scenario: La tabla no tiene la columna
- **WHEN** se aplican todas las migraciones sobre una base vacía y se listan las columnas de `FeaturedRepository`
- **THEN** no hay ninguna columna `stars`, y `RepositoryEvidence` conserva la suya

#### Scenario: Migración acotada
- **WHEN** se lee el SQL de la migración `retire_featured_repository_stars`
- **THEN** su única sentencia es `ALTER TABLE "FeaturedRepository" DROP COLUMN "stars"`, sin `UPDATE`, sin otras tablas y sin tocar `RepositoryEvidence`

#### Scenario: Base con datos
- **WHEN** se aplica la migración sobre una base con repositorios cargados, alguno con `stars` no nula
- **THEN** la migración termina sin error, los repositorios conservan los demás campos y su evidencia, y `GET /api/featured-repositories` devuelve lo mismo que antes de migrar
