## MODIFIED Requirements

### Requirement: Listado de experiencias visibles y ordenadas
`GET /api/experiences` SHALL devolver 200 con un array de las experiencias marcadas visibles, ordenadas cronológicamente: por `startDate` descendente (más reciente primero) y, a igual `startDate`, por `order` ascendente. Es el mismo orden canónico que usan los perfiles curados. Cada elemento MUST contener: `id`, `company`, `role`, `startDate`, `endDate` (nulo si es actual), `current`, `location`, `sector[]`, `summary`, `highlights[]`, `technologies[]`, `tags[]`, `order`. Los campos `role`, `summary` y `highlights` SHALL venir resueltos al locale del request.

#### Scenario: Listado tras el seed
- **WHEN** un cliente hace `GET /api/experiences`
- **THEN** recibe 200 con tantos elementos como experiencias tiene `docs/cv-data.json` (15) y el primero es la de `startDate` más reciente (`company: "Novacomp"`, `2026-03`)

#### Scenario: Listado en inglés
- **WHEN** un cliente hace `GET /api/experiences?locale=en`
- **THEN** el primer elemento tiene `role` igual al valor `en` del JSON y `highlights` es un array de strings en inglés

#### Scenario: Experiencias ocultas excluidas
- **WHEN** una experiencia tiene `visible = false` y un cliente hace `GET /api/experiences`
- **THEN** esa experiencia no aparece en el listado

#### Scenario: Orden cronológico descendente
- **WHEN** un cliente hace `GET /api/experiences`
- **THEN** para todo `i`, `experiences[i].startDate >= experiences[i+1].startDate`

#### Scenario: Orden estable
- **WHEN** dos experiencias comparten el mismo `startDate`
- **THEN** la de menor `order` aparece primero
