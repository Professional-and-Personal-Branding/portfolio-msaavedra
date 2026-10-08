# public-portfolio-frontend Specification (delta)

## MODIFIED Requirements

### Requirement: Navegación por perfiles curados
La barra superior SHALL ofrecer el menú de perfiles **únicamente en la home** (`/`), con los perfiles de `GET /api/curated-profiles` —públicos, enumerados y no archivados— agrupados por `roleType` y mostrando `techFocus`; en móvil SHALL abrirse en un panel lateral. En `/:slug` MUST NOT renderizarse ningún enlace a otro slug de perfil curado, cualquiera sea el valor de `listed` de los demás: un perfil enviado no ofrece navegación a los otros.

#### Scenario: Menú agrupado
- **WHEN** se abre el menú en la home
- **THEN** aparecen los perfiles del listado público agrupados por `roleType` (ej. "Tech Lead", "Backend") y cada uno muestra su `techFocus`

#### Scenario: Un perfil enviado no enumera a los demás
- **WHEN** se abre `/tech-lead-dotnet`
- **THEN** el DOM no contiene ningún enlace a otro slug de perfil curado

#### Scenario: La home sí ofrece el menú
- **WHEN** se abre `/`
- **THEN** el menú lista los perfiles públicos, enumerados y no archivados, agrupados por `roleType`
