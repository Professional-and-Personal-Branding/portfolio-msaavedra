# admin-experience-crud Specification (delta)

## ADDED Requirements

### Requirement: Paridad bilingüe en los logros
El formulario de experiencias SHALL ofrecer los logros en los dos idiomas, con el mismo componente de listas que ya usa el español, igual que `role` y `summary` ya ofrecen sus dos lados.

El guardado SHALL preservar el contenido existente del idioma que no se editó. Esto ya ocurre (`toFormValues` lee `highlights.en` y el payload lo reenvía) y SHALL quedar cubierto por un test de regresión que falle si un guardado desde el panel deja `highlights.en` vacío cuando antes tenía contenido.

#### Scenario: Escribir los logros en inglés
- **WHEN** se edita una experiencia y se agregan logros en el campo en inglés
- **THEN** al guardar, `highlights.en` contiene esos valores y `highlights.es` queda intacto

#### Scenario: Editar solo el español no borra el inglés
- **WHEN** se edita una experiencia que ya tenía `highlights.en`, se cambia solo el español y se guarda
- **THEN** `highlights.en` conserva su contenido anterior

#### Scenario: Experiencia sin inglés previo
- **WHEN** se abre una experiencia cuyo `highlights.en` está vacío
- **THEN** el campo en inglés aparece vacío y editable, sin inventar una traducción del español
