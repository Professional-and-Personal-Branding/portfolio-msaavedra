## ADDED Requirements

### Requirement: Contadores del preview en singular y plural
Los contadores del preview (experiencias, categorías de skills y proyectos) SHALL concordar en número con la cantidad: singular para 1 y plural para cualquier otra cantidad, incluido 0. Los contadores son parte del panel y SHALL seguir en español aunque el preview muestre el contenido en inglés.

#### Scenario: Un elemento de cada tipo
- **WHEN** el preview resuelve 1 experiencia, 1 categoría y 1 proyecto
- **THEN** el contador dice «1 experiencia · 1 categoría · 1 proyecto»

#### Scenario: Cero y varios
- **WHEN** el preview resuelve 2 experiencias, 3 categorías y 0 proyectos
- **THEN** el contador dice «2 experiencias · 3 categorías · 0 proyectos»

#### Scenario: Preview en inglés
- **WHEN** el preview muestra la pestaña EN y resuelve 1 proyecto
- **THEN** el contador sigue en español y dice «1 proyecto»
