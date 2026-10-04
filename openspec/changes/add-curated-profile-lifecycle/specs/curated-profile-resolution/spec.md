# curated-profile-resolution Specification (delta)

## ADDED Requirements

### Requirement: Tabla de verdad de la resolución de ruta
La decisión de si un slug resuelve SHALL tomarse en **una única** función pura de dominio sobre `(visibility, archivedAt, token presente y válido)`, y ningún caso de uso ni controller SHALL replicarla. Un perfil **archivado** MUST resolver siempre como inexistente, cualquiera sea su visibilidad y aunque se presente un token válido; MUST NOT devolver 401, porque un 401 confirmaría que el slug existió.

| `visibility` | `archivedAt` | sin token | con token válido |
|---|---|---|---|
| `PUBLIC` | null | 200 | 200 |
| `PUBLIC` | fecha | 404 | 404 |
| `PROTECTED` | null | 401 | 200 |
| `PROTECTED` | fecha | 404 | 404 |
| `PRIVATE` | null | 404 | 404 |
| `PRIVATE` | fecha | 404 | 404 |

#### Scenario: Público archivado
- **WHEN** un perfil `PUBLIC` se archiva y se pide `GET /api/curated-profiles/{slug}`
- **THEN** responde 404, sin distinguirse de un slug inexistente

#### Scenario: Protegido archivado con token válido
- **WHEN** un perfil `PROTECTED` archivado se pide con su `?token=` correcto
- **THEN** responde 404 y no 401 ni 200

#### Scenario: Protegido no archivado sigue igual
- **WHEN** un perfil `PROTECTED` no archivado se pide sin token y luego con token válido
- **THEN** responde 401 y después 200

#### Scenario: Desarchivar restituye el comportamiento
- **WHEN** un perfil `PUBLIC` archivado se desarchiva y se vuelve a pedir
- **THEN** responde 200 con el mismo contenido que antes de archivarse

#### Scenario: Los doce casos están cubiertos
- **WHEN** se ejecuta la tabla de verdad como test
- **THEN** las seis combinaciones de `visibility` × `archivedAt`, con y sin token, dan el resultado de la tabla

### Requirement: Un perfil archivado conserva sus visitas
Archivar MUST NOT borrar `ProfileView` ni reiniciar `views`. Un perfil archivado SHALL seguir apareciendo en la analítica agregada, identificable como archivado. Mientras está archivado, la ruta pública no resuelve, así que MUST NOT registrarse ninguna visita nueva.

#### Scenario: Las visitas sobreviven
- **WHEN** un perfil con visitas se archiva y se consulta `GET /api/admin/analytics/views` en un rango que las incluye
- **THEN** sus visitas siguen contando en `total` y el perfil sigue en `byProfile`

#### Scenario: No se registran visitas nuevas
- **WHEN** se pide el slug de un perfil archivado
- **THEN** responde 404 y no se crea ningún `ProfileView`

### Requirement: Resolución por slug anterior
Al renombrarse el `slug` de un perfil, el anterior SHALL registrarse como alias en la misma transacción. La búsqueda por slug SHALL consultar primero los slugs vigentes y después los alias. Cuando resuelve por un alias, la respuesta MUST contener el **slug canónico** del perfil y SHALL incluir la cabecera `Content-Location` con la ruta canónica. Un alias MUST NOT colisionar con el slug vigente de otro perfil ni con otro alias; si el slug vuelve a usarse para el mismo perfil, su alias SHALL eliminarse.

#### Scenario: El link viejo sigue funcionando
- **WHEN** un perfil pasa de `acme-tech-lead` a `acme-lead` y se pide el slug anterior
- **THEN** responde 200 con el perfil, su cuerpo trae `slug: "acme-lead"` y `Content-Location` apunta a la ruta canónica

#### Scenario: El alias no se indexa
- **WHEN** se pide `GET /sitemap.xml` después del renombrado
- **THEN** figura solo la URL canónica y no la del alias

#### Scenario: Colisión de slug con un alias existente
- **WHEN** se intenta crear un perfil con un slug que es alias de otro
- **THEN** responde 409 y no se crea

#### Scenario: Reusar el slug propio borra el alias
- **WHEN** un perfil vuelve a su slug anterior
- **THEN** ese alias desaparece y no queda duplicado

#### Scenario: Un alias de un perfil archivado no resuelve
- **WHEN** se pide el alias de un perfil que está archivado
- **THEN** responde 404, igual que su slug canónico
