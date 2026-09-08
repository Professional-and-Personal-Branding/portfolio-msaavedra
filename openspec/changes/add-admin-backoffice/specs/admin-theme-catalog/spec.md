## Purpose

El customizador necesita saber qué temas base existen y con qué tokens arrancan, sin adivinarlos ni duplicarlos en el frontend.

## ADDED Requirements

### Requirement: Listado de temas para el backoffice
`GET /api/admin/themes` (autenticado) SHALL devolver todos los temas de la base con `id`, `slug`, `name`, `isPreset` y `tokens`, ordenados con los presets primero y luego por nombre.

#### Scenario: Catálogo
- **WHEN** un administrador pide `GET /api/admin/themes` con la base seedeada
- **THEN** responde 200 con los 5 presets (`modern-dark`, `modern-light`, `minimal`, `elegant`, `corporate`), cada uno con su `id` y sus `tokens` completos

#### Scenario: Sin sesión
- **WHEN** se pide `GET /api/admin/themes` sin autenticación
- **THEN** responde 401

### Requirement: Los tokens del catálogo alimentan la resolución
El `id` devuelto SHALL ser el mismo que acepta `themeId` en el CRUD de perfiles curados y en el preview.

#### Scenario: Tema base aplicado
- **WHEN** se guarda un perfil curado con el `themeId` de `elegant` tomado del catálogo
- **THEN** la vista pública de ese perfil devuelve `theme.slug = "elegant"` y sus tokens
