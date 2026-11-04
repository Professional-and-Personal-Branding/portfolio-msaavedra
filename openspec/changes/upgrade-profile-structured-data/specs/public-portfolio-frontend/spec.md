## ADDED Requirements

### Requirement: El cliente escribe el mismo JSON-LD que el fragmento
`metaFromProfile` SHALL derivar el bloque `ProfilePage` con las mismas reglas que el fragmento del servidor, de modo que para el mismo perfil, idioma y origen los dos objetos sean iguales, con las claves en el mismo orden. Con `noindex` (perfil no público) el cliente MUST NOT escribir JSON-LD y SHALL quitar el bloque que hubiera en el documento.

#### Scenario: Paridad con el servidor
- **WHEN** se compara el `jsonLd` de `metaFromProfile` con el del fragmento del backend para cada caso de `docs/fixtures/profile-head-consistency.json`
- **THEN** los dos coinciden con `expected.jsonLd`, también en el orden de las claves

#### Scenario: Perfil protegido abierto con token
- **WHEN** se abre un perfil `PROTECTED` con su token válido
- **THEN** el documento no contiene ningún `<script type="application/ld+json">`

#### Scenario: Navegación a otro perfil
- **WHEN** se navega de `/` a `/tech-lead-dotnet` dentro de la SPA
- **THEN** hay un solo bloque JSON-LD y su `url` es la de `/tech-lead-dotnet`

#### Scenario: Presupuesto del arranque
- **WHEN** se corre `npm run perf:budget` sobre el build con este cambio
- **THEN** el arranque público sigue en 155 KB gzip o menos y en un solo JS de módulo
