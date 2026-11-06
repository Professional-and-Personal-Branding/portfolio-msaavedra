## ADDED Requirements

### Requirement: El `lastmod` del sitemap refleja ediciones, no visitas
El `<lastmod>` de cada URL de `GET /sitemap.xml` SHALL ser la fecha de la última edición del perfil curado. Una visita MUST NOT cambiarlo, para no anunciar cambios que no hubo ni revelar cuándo se abrió por última vez un perfil.

#### Scenario: Una visita no cambia el lastmod
- **WHEN** el perfil `tech-lead-dotnet` tiene `updatedAt` en `2026-01-15T12:00:00.000Z`, recibe una visita humana y se pide `GET /sitemap.xml`
- **THEN** la URL `/tech-lead-dotnet` del sitemap lleva `<lastmod>2026-01-15</lastmod>`

#### Scenario: Una edición actualiza el lastmod
- **WHEN** después de eso el administrador guarda un cambio del perfil y se vuelve a pedir el sitemap
- **THEN** la URL `/tech-lead-dotnet` lleva como `<lastmod>` la fecha del guardado
