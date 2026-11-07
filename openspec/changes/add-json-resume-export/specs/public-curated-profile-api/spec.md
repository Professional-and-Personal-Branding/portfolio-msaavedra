## ADDED Requirements

### Requirement: Exportación JSON Resume por slug
`GET /api/curated-profiles/:slug/resume.json` SHALL devolver 200 con el documento JSON Resume (`json-resume-export`) de la misma vista que `GET /api/curated-profiles/:slug`, en el locale negociado. Los códigos MUST ser los del detalle: 404 para slug inexistente, `PRIVATE` o archivado, y 401 para `PROTECTED` sin token válido (`X-Access-Token` o `?token=`). Un slug anterior SHALL resolver con `Content-Location` a la ruta del canónico.

#### Scenario: Perfil público en inglés
- **WHEN** un cliente hace `GET /api/curated-profiles/tech-lead-dotnet/resume.json?lang=en`
- **THEN** recibe 200, `Content-Language: en` y un documento cuyo `work` tiene las mismas empresas, en el mismo orden, que `experiences` de `GET /api/curated-profiles/tech-lead-dotnet?lang=en`

#### Scenario: Perfil de la home
- **WHEN** un cliente hace `GET /api/curated-profiles/all/resume.json`
- **THEN** recibe 200 con el documento del perfil `all` en español

#### Scenario: Privado
- **WHEN** un perfil es `PRIVATE` y un cliente pide su `resume.json`
- **THEN** recibe 404 con `error: "Not Found"`

#### Scenario: Archivado
- **WHEN** un perfil `PUBLIC` está archivado y un cliente pide su `resume.json`
- **THEN** recibe 404, nunca 401

#### Scenario: Protegido sin token
- **WHEN** un perfil es `PROTECTED` y un cliente pide su `resume.json` sin token o con uno incorrecto
- **THEN** recibe 401 con `error: "Unauthorized"`

#### Scenario: Protegido con token
- **WHEN** un cliente pide el `resume.json` de un perfil `PROTECTED` con `?token=<correcto>` o con `X-Access-Token`
- **THEN** recibe 200 y el token no aparece en ninguna parte del documento

#### Scenario: Slug anterior
- **WHEN** un cliente pide `GET /api/curated-profiles/ejemplo-nombre-anterior/resume.json` y ese slug es alias de `ejemplo-renombrado`
- **THEN** recibe 200 con `Content-Location: /api/curated-profiles/ejemplo-renombrado/resume.json` y `meta.canonical` apunta al slug canónico

### Requirement: Documentación OpenAPI de la exportación
El documento OpenAPI SHALL incluir `/api/curated-profiles/{slug}/resume.json` con `locale`, `X-Access-Token`, `token` y las respuestas 200, 401 y 404, y `/api/admin/curated-profiles/{id}/resume.json` con `locale` y 200, 401 y 404. El cuerpo 200 de ambas SHALL declararse como objeto `application/json` con referencia al schema JSON Resume v1.0.0.

#### Scenario: Rutas documentadas
- **WHEN** se corre `npm run openapi:export`
- **THEN** `paths` de `backend/openapi.json` contiene las dos rutas, la pública declara `locale`, `X-Access-Token` y `token` y no declara `via` ni `src`

#### Scenario: Contrato generado
- **WHEN** se corre `npm run openapi:export` y después `npm run api:types`
- **THEN** `api.d.ts` incluye las dos rutas y el test de deriva del frontend pasa
