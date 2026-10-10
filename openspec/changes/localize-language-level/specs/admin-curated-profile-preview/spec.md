## ADDED Requirements

### Requirement: Faltantes de traducción en los idiomas del perfil
El informe de faltantes del preview SHALL revisar cada idioma del perfil base como entidad `language`, con su id, en los campos `nameI18n`, `level` y `detail`, con la misma regla de faltante que el resto. Un valor guardado como texto plano MUST NOT reportarse. El aviso del constructor SHALL agruparlos bajo *Idiomas* y nombrar cada idioma por su nombre en español; solo si la lista de idiomas no cargó, por su id.

#### Scenario: Nivel sin inglés
- **WHEN** se previsualiza en EN un perfil cuyo idioma `Inglés` tiene `level: { es: "Intermedio" }`
- **THEN** el informe incluye `{ entity: "language", id: <id de Inglés>, field: "level" }` y el aviso muestra *Idiomas — Inglés: Nivel*

#### Scenario: Idiomas completos
- **WHEN** se previsualiza en EN un perfil tras el seed
- **THEN** el informe no incluye ninguna entrada de entidad `language`

#### Scenario: Nivel legado
- **WHEN** un idioma tiene `level` guardado como el string `"C1"` y se previsualiza en EN
- **THEN** el informe no lo marca como faltante

#### Scenario: Detalle sin inglés
- **WHEN** se previsualiza en EN un perfil con un idioma cuyo `detail` es `{ es: "Oral y escrito" }`
- **THEN** el informe incluye ese idioma con el campo `detail`
