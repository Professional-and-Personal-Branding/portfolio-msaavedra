# curated-profile-builder Specification (delta)

## ADDED Requirements

### Requirement: Aviso de faltantes antes de copiar el link
La pestaña Publicación SHALL mostrar el informe de faltantes de traducción del preview: el conteo y la lista agrupada por entidad, junto al link que se va a copiar. El aviso SHALL ser informativo y MUST NOT impedir guardar ni publicar: hay perfiles que solo se envían en español.

Cuando no hay faltantes en el idioma del preview, el aviso SHALL indicarlo en una línea en lugar de desaparecer, para que la ausencia de aviso no se confunda con "no se comprobó".

#### Scenario: Perfil con faltantes en inglés
- **WHEN** el preview está en EN y tres experiencias no tienen logros en inglés
- **THEN** la pestaña Publicación muestra el conteo y las tres entradas, y el botón de guardar sigue habilitado

#### Scenario: Perfil completo
- **WHEN** el preview está en EN y no falta nada
- **THEN** la pestaña Publicación lo indica explícitamente

#### Scenario: El aviso sigue al idioma del preview
- **WHEN** se conmuta el preview de EN a ES en un perfil con el español completo
- **THEN** el aviso pasa a indicar que no faltan traducciones

#### Scenario: Publicar con faltantes
- **WHEN** se publica un perfil que tiene faltantes en inglés
- **THEN** la operación se completa con normalidad
