# curated-profile-builder Specification (delta)

## ADDED Requirements

### Requirement: Enlaces de seguimiento en la pestaña Publicación
Para un perfil guardado, Publicación SHALL listar sus enlaces (etiqueta editable, portal, aperturas, última apertura y estado), crear uno con etiqueta y portal opcional, copiar su URL absoluta con `?via=` (después de `token` si es `PROTECTED`) y revocarlo tras una confirmación que diga que el link sigue abriendo y no se deshace. SHALL ofrecer copiar `/{slug}?src=<portal>` sin llamar a la API.

#### Scenario: Crear y copiar
- **WHEN** en un perfil `PUBLIC` guardado se crea el enlace «Acme — RR. HH.» y se pulsa copiar
- **THEN** el enlace aparece con 0 aperturas y el portapapeles queda con la URL absoluta del perfil con `?via=<código>`

#### Scenario: Perfil protegido
- **WHEN** el perfil es `PROTECTED` con token `abc` y se copia un enlace
- **THEN** la URL copiada contiene `token=abc` y `via=<código>`

#### Scenario: Revocar
- **WHEN** se revoca un enlace y se confirma
- **THEN** el enlace queda marcado como revocado, sin acción de copiar, y sus aperturas siguen visibles

#### Scenario: Perfil sin guardar
- **WHEN** se abre Publicación en un perfil nuevo sin guardar
- **THEN** el bloque de enlaces indica que hay que guardar primero y no llama a la API

#### Scenario: Link genérico por portal
- **WHEN** se elige el portal `indeed` y se pulsa copiar
- **THEN** el portapapeles queda con la URL absoluta del perfil con `?src=indeed` y no se crea ningún enlace

### Requirement: Compartir en LinkedIn desde la pestaña Publicación
Publicación SHALL ofrecer **Compartir en LinkedIn** solo para un perfil guardado, `PUBLIC` y no archivado; si no, deshabilitado con el motivo. Al pulsarlo SHALL abrir en una pestaña nueva `https://www.linkedin.com/sharing/share-offsite/?url=` con la URL del perfil y el `via` del enlace `LINKEDIN_POST` que devuelve la API, y si la API falla SHALL cerrarla y mostrar el error.

#### Scenario: Compartir un perfil público
- **WHEN** se pulsa Compartir en LinkedIn en un perfil `PUBLIC` guardado
- **THEN** se abre una pestaña con `share-offsite` cuyo `url` es la URL absoluta del perfil con `?via=<código del enlace LinkedIn>`

#### Scenario: Perfil protegido
- **WHEN** el perfil es `PROTECTED`
- **THEN** el botón está deshabilitado y explica que publicaría el token

#### Scenario: Falla la API
- **WHEN** la API responde con error al pedir el enlace
- **THEN** la pestaña nueva se cierra y se muestra el error
