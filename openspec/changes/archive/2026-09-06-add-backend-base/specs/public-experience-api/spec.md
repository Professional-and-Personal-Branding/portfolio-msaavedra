## Purpose

Expone públicamente la trayectoria laboral visible, ordenada y resuelta al idioma pedido, como base de la home y de las vistas curadas que en Fase 2 la filtrarán por tags.

## ADDED Requirements

### Requirement: Listado de experiencias visibles y ordenadas
`GET /api/experiences` SHALL devolver 200 con un array de las experiencias marcadas visibles, ordenadas por `order` ascendente y, a igual `order`, por `startDate` descendente. Cada elemento MUST contener: `id`, `company`, `role`, `startDate`, `endDate` (nulo si es actual), `current`, `location`, `sector[]`, `summary`, `highlights[]`, `technologies[]`, `tags[]`, `order`. Los campos `role`, `summary` y `highlights` SHALL venir resueltos al locale del request.

#### Scenario: Listado tras el seed
- **WHEN** un cliente hace `GET /api/experiences`
- **THEN** recibe 200 con tantos elementos como experiencias tiene `docs/cv-data.json` (15) y el primero es `company: "Novacomp"` con `order: 0`

#### Scenario: Listado en inglés
- **WHEN** un cliente hace `GET /api/experiences?locale=en`
- **THEN** el primer elemento tiene `role` igual al valor `en` del JSON y `highlights` es un array de strings en inglés

#### Scenario: Experiencias ocultas excluidas
- **WHEN** una experiencia tiene `visible = false` y un cliente hace `GET /api/experiences`
- **THEN** esa experiencia no aparece en el listado

#### Scenario: Orden estable
- **WHEN** dos experiencias comparten el mismo `order`
- **THEN** la de `startDate` más reciente aparece primero

### Requirement: Detalle de experiencia por id
`GET /api/experiences/:id` SHALL devolver 200 con la experiencia visible indicada, con la misma forma que los elementos del listado. Si el id no existe o la experiencia no es visible, MUST responder 404 en el formato de error de `api-platform`.

#### Scenario: Detalle existente
- **WHEN** un cliente toma el `id` del primer elemento del listado y hace `GET /api/experiences/:id?locale=en`
- **THEN** recibe 200 con `company: "Novacomp"` y `role` en inglés

#### Scenario: Id inexistente
- **WHEN** un cliente hace `GET /api/experiences/no-existe`
- **THEN** recibe 404 con `error: "Not Found"`

#### Scenario: Experiencia oculta no accesible
- **WHEN** una experiencia tiene `visible = false` y un cliente pide su detalle por id
- **THEN** recibe 404

### Requirement: Solo campos públicos
Las respuestas MUST NOT incluir `createdAt`, `updatedAt` ni el campo `visible`.

#### Scenario: Sin metadatos de persistencia
- **WHEN** un cliente hace `GET /api/experiences`
- **THEN** ningún elemento contiene las claves `createdAt`, `updatedAt` ni `visible`
