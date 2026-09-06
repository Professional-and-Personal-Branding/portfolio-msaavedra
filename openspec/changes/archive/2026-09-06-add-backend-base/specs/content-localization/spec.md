## Purpose

Garantiza que un único conjunto de datos bilingüe (ES/EN, sin duplicar registros) se sirva en el idioma pedido por cada request, con fallback no excluyente al español, y que el cliente reciba siempre texto ya resuelto. Diseño de referencia: `docs/I18N.md`.

## ADDED Requirements

### Requirement: Negociación del locale por request
La API SHALL determinar el locale de cada request público con esta precedencia: query `locale` → query `lang` → header `Accept-Language` → `es` por defecto. Los valores SHALL normalizarse (insensible a mayúsculas; `en-US` equivale a `en`). Un valor no soportado MUST resolverse al locale por defecto sin producir error.

#### Scenario: Query locale explícito
- **WHEN** un cliente hace `GET /api/profile?locale=en`
- **THEN** los campos traducibles vienen en inglés

#### Scenario: Query lang como alias
- **WHEN** un cliente hace `GET /api/profile?lang=en` sin `locale`
- **THEN** los campos traducibles vienen en inglés

#### Scenario: Precedencia de locale sobre lang
- **WHEN** un cliente hace `GET /api/profile?locale=es&lang=en`
- **THEN** los campos traducibles vienen en español

#### Scenario: Header Accept-Language
- **WHEN** un cliente hace `GET /api/experiences` con header `Accept-Language: en-US,en;q=0.9,es;q=0.8` y sin query de idioma
- **THEN** los campos traducibles vienen en inglés

#### Scenario: Sin indicación de idioma
- **WHEN** un cliente hace `GET /api/experiences` sin query ni header de idioma
- **THEN** los campos traducibles vienen en español

#### Scenario: Locale no soportado cae al default
- **WHEN** un cliente hace `GET /api/profile?locale=fr`
- **THEN** la respuesta es 200 y los campos traducibles vienen en español

#### Scenario: Normalización de variantes regionales
- **WHEN** un cliente hace `GET /api/profile?locale=EN-us`
- **THEN** los campos traducibles vienen en inglés

### Requirement: Respuestas con texto ya resuelto
Los campos traducibles de toda respuesta pública SHALL ser cadenas planas o listas de cadenas. La API MUST NOT exponer objetos `{ es, en }` al cliente.

#### Scenario: Campo de texto resuelto
- **WHEN** un cliente pide `GET /api/experiences?locale=en`
- **THEN** en cada elemento `role` y `summary` son strings y `highlights` es un array de strings

### Requirement: Fallback por campo, no excluyente
Cuando un campo traducible carece del idioma pedido, la API SHALL devolver el valor en el locale por defecto (`es`); si tampoco existe, el primer valor disponible; si el campo es nulo, cadena vacía (texto) o lista vacía (lista). Un campo almacenado como texto plano (dato legado) SHALL devolverse tal cual.

#### Scenario: Falta la traducción pedida
- **WHEN** se resuelve `{ es: "Hola" }` con locale `en`
- **THEN** el resultado es `"Hola"`

#### Scenario: Falta también el default
- **WHEN** se resuelve `{ pt: "Olá" }` con locale `en`
- **THEN** el resultado es `"Olá"`

#### Scenario: Campo nulo
- **WHEN** se resuelve `null` como texto y como lista con cualquier locale
- **THEN** el resultado es `""` y `[]` respectivamente

#### Scenario: Dato plano legado
- **WHEN** se resuelve la cadena `"Texto plano"` con locale `en`
- **THEN** el resultado es `"Texto plano"`

### Requirement: Header Content-Language en respuestas públicas
Toda respuesta 2xx de un endpoint público SHALL incluir el header `Content-Language` con el locale efectivamente servido.

#### Scenario: Locale servido informado
- **WHEN** un cliente hace `GET /api/profile?locale=fr`
- **THEN** la respuesta incluye `Content-Language: es`
