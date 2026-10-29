# public-curated-profile-api Specification (delta)

## MODIFIED Requirements

### Requirement: Documentación OpenAPI
El documento OpenAPI SHALL incluir `/api/curated-profiles` y `/api/curated-profiles/{slug}`, documentando `locale`, el header `X-Access-Token`, el query `token`, los query opcionales de atribución `via` y `src` (`share-links`) y las respuestas 200/401/404.

#### Scenario: Rutas documentadas
- **WHEN** un cliente hace `GET /api/docs-json`
- **THEN** `paths` contiene ambas rutas y el detalle declara los parámetros `locale`, `X-Access-Token`, `token`, `via` y `src`
