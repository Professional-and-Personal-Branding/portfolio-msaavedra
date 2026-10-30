# public-portfolio-sections-api Specification

## Purpose
Expone públicamente las secciones complementarias del portafolio (formación, certificaciones, proyectos destacados y presencia pública) en el idioma solicitado, para la home y como referencia de las vistas curadas.

## Requirements

### Requirement: Educación visible
`GET /api/education` SHALL devolver 200 con los registros de educación visibles, ordenados por `order` ascendente. Cada elemento MUST contener `id`, `degree` (resuelto al locale), `institution`, `startDate`, `endDate` (nulo si en curso), `inProgress`, `order`, y MUST NOT contener `visible`.

#### Scenario: Listado tras el seed
- **WHEN** un cliente hace `GET /api/education`
- **THEN** recibe tantos elementos como `education` en `cv-data.json` (6), el primero con `institution` igual al primero del JSON e `inProgress: true`

#### Scenario: Locale en inglés
- **WHEN** un cliente hace `GET /api/education?locale=en`
- **THEN** `degree` del primer elemento es el valor `en` del JSON y `Content-Language` es `en`

### Requirement: Certificaciones visibles
`GET /api/certifications` SHALL devolver 200 con las certificaciones visibles ordenadas por `order`. Cada elemento MUST contener `id`, `name` (resuelto), `issuer`, `year` (nulo si no aplica), `order`, `verificationUrl`, `credentialId` y `expiresAt` (cada uno nulo si no se cargó). Estos tres no se traducen y la API no calcula si la certificación está vencida.

#### Scenario: Listado tras el seed
- **WHEN** un cliente hace `GET /api/certifications`
- **THEN** recibe 8 elementos y el primero tiene `issuer` igual al del JSON

#### Scenario: Certificación sin credencial
- **WHEN** un cliente hace `GET /api/certifications` tras sembrar `docs/cv-data.json`
- **THEN** cada elemento tiene `verificationUrl`, `credentialId` y `expiresAt` en `null`

#### Scenario: Certificación con credencial en los dos idiomas
- **WHEN** una certificación tiene `verificationUrl: "https://example.org/c/1"`, `credentialId: "EJ-1"` y `expiresAt: "2029-06"` y un cliente pide `GET /api/certifications?locale=en`
- **THEN** el elemento trae esos tres valores sin cambios, igual que con `locale=es`, y no trae ningún campo `expired`

#### Scenario: La vista curada usa la misma forma
- **WHEN** un cliente pide `GET /api/curated-profiles/all` con esa misma certificación cargada
- **THEN** su elemento de `certifications` trae `verificationUrl`, `credentialId` y `expiresAt` con los mismos valores

### Requirement: Proyectos visibles
`GET /api/projects` SHALL devolver 200 con los proyectos visibles ordenados por `order`. Cada elemento MUST contener `id`, `name`, `role` (resuelto), `period`, `summary` (resuelto), `technologies[]`, `tags[]`, `url` (nulo si no hay), `order`.

#### Scenario: Listado tras el seed
- **WHEN** un cliente hace `GET /api/projects?locale=en`
- **THEN** recibe 2 elementos, `role` y `summary` son strings en inglés y `tags` es un array

### Requirement: Enlaces sociales visibles
`GET /api/social-links` SHALL devolver 200 con los enlaces visibles ordenados por `order`. Cada elemento MUST contener `id`, `platform`, `handle`, `url`, `label` (resuelto), `description` (resuelto, cadena vacía si no hay), `stats` (objeto libre o nulo), `featured`, `order`.

#### Scenario: Listado tras el seed
- **WHEN** un cliente hace `GET /api/social-links`
- **THEN** recibe 3 elementos; el de `platform: "github"` tiene `featured: true` y `stats.repos` numérico; el de `youtube` tiene `featured: false`

### Requirement: Elementos ocultos excluidos
Un registro con `visible = false` MUST NOT aparecer en ninguno de los cuatro listados.

#### Scenario: Proyecto oculto
- **WHEN** un proyecto pasa a `visible = false` y un cliente hace `GET /api/projects`
- **THEN** ese proyecto no aparece

### Requirement: Documentación OpenAPI
El documento OpenAPI SHALL incluir las cuatro rutas con el parámetro `locale`.

#### Scenario: Rutas documentadas
- **WHEN** un cliente hace `GET /api/docs-json`
- **THEN** `paths` contiene `/api/education`, `/api/certifications`, `/api/projects` y `/api/social-links`
