# admin-skill-crud Specification

## Purpose
Permite al administrador mantener el catálogo de competencias: categorías bilingües ordenadas y skills con los tags que alimentan el filtrado de perfiles curados.

## Requirements

### Requirement: Categorías de skills
`GET /api/admin/skill-categories` SHALL listar todas las categorías (nombre `{ es, en }` sin resolver, `order`) con sus skills (`id`, `name`, `tags`, `order`). `POST /api/admin/skill-categories` SHALL crear una (201) validando `name.es` obligatorio y `order` entero ≥ 0; `PATCH /api/admin/skill-categories/:id` SHALL editar parcialmente (200, 404 si no existe); `DELETE /api/admin/skill-categories/:id` SHALL borrar la categoría **y sus skills** (204, 404 si no existe).

#### Scenario: Crear categoría
- **WHEN** envía `{ name: { es: "Datos", en: "Data" }, order: 20 }`
- **THEN** recibe 201 con `id` y la categoría aparece en el listado admin con `skills: []`

#### Scenario: Borrar categoría con skills
- **WHEN** borra una categoría que tiene 2 skills
- **THEN** recibe 204 y las 2 skills ya no existen

#### Scenario: Nombre sin español
- **WHEN** envía `{ name: { en: "Data" } }`
- **THEN** recibe 400

### Requirement: Skills dentro de una categoría
`POST /api/admin/skill-categories/:categoryId/skills` SHALL crear una skill (201) con `name` no vacío, `tags` array de strings (default `[]`) y `order` entero ≥ 0 (default 0); 404 si la categoría no existe. `PATCH /api/admin/skills/:id` SHALL editar parcialmente `name`, `tags`, `order` o moverla a otra categoría con `categoryId` (404 si la skill o la categoría destino no existen). `DELETE /api/admin/skills/:id` SHALL responder 204 (404 si no existe).

#### Scenario: Crear skill con tags
- **WHEN** envía `{ name: "Kafka Streams", tags: ["java", "messaging"] }` a una categoría existente
- **THEN** recibe 201 y la skill aparece en `GET /api/curated-profiles/java-senior-backend` dentro de esa categoría

#### Scenario: Cambiar tags saca la skill de un perfil
- **WHEN** edita la skill con `{ tags: ["ruby"] }`
- **THEN** deja de aparecer en `java-senior-backend`

#### Scenario: Categoría inexistente
- **WHEN** hace `POST /api/admin/skill-categories/no-existe/skills`
- **THEN** recibe 404

#### Scenario: Mover de categoría
- **WHEN** hace `PATCH /api/admin/skills/:id` con `{ categoryId: <otra> }`
- **THEN** recibe 200 y la skill aparece bajo la otra categoría en el listado admin
