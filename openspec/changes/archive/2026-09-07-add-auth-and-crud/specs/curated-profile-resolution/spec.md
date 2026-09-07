## ADDED Requirements

### Requirement: Registro de visita al resolver por la ruta pública
Una resolución exitosa solicitada por la ruta pública SHALL registrar la visita según `profile-view-analytics` (paso 6 del núcleo en `CLAUDE.md`). La resolución invocada sin contexto de visita (tests unitarios, usos internos) MUST NOT registrar nada. El registro MUST NOT modificar el resultado devuelto ni convertir un éxito en error.

#### Scenario: Con contexto de visita
- **WHEN** el caso de uso se ejecuta con `viewContext` (locale, referrer, userAgent, ipHash) y el perfil es accesible
- **THEN** se registra una visita y el resultado es el mismo que sin contexto

#### Scenario: Sin contexto de visita
- **WHEN** el caso de uso se ejecuta sin `viewContext`
- **THEN** no se registra ninguna visita

#### Scenario: Fallo del registro
- **WHEN** el repositorio de visitas falla al registrar
- **THEN** el caso de uso devuelve igualmente el resultado exitoso
