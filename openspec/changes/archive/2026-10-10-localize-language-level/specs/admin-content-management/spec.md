## ADDED Requirements

### Requirement: Nivel del idioma bilingüe en la administración
`POST` y `PATCH /api/admin/languages` SHALL recibir `level` como texto bilingüe `{ es, en? }`, con `es` no vacío; un `level` string, nulo o sin `es` MUST responder 400 sin escribir. El listado y el detalle crudos SHALL devolver `level` sin resolver: `{ es, en }`, o el string de un dato legado. Un `PATCH` con `level` SHALL reemplazar el objeto completo.

#### Scenario: Crear un idioma con su nivel en los dos idiomas
- **WHEN** se hace `POST /api/admin/languages` con `level: { es: "Avanzado", en: "Advanced" }`
- **THEN** responde 201, `GET /api/admin/languages` lo devuelve con ese `level` y `GET /api/profile?lang=en` lo muestra como `"Advanced"`

#### Scenario: Nivel como string
- **WHEN** se hace `POST /api/admin/languages` con `level: "B2"`
- **THEN** responde 400 nombrando `level` y no se crea ningún idioma

#### Scenario: Español vacío
- **WHEN** se hace `PATCH /api/admin/languages/{id}` con `level: { es: " ", en: "Advanced" }`
- **THEN** responde 400 y el idioma conserva su nivel anterior

#### Scenario: Reemplazo completo
- **WHEN** un idioma tiene `level: { es: "Nativo", en: "Native" }` y se hace `PATCH` con `level: { es: "Bilingüe" }`
- **THEN** su `level` queda `{ es: "Bilingüe" }`, sin `en`

#### Scenario: Legado en el listado crudo
- **WHEN** un idioma tiene `level` guardado como el string `"C1"` y se pide `GET /api/admin/languages`
- **THEN** su `level` llega como `"C1"`

### Requirement: Edición del nivel en ES y EN desde la Portada
El formulario de idiomas de `/admin/portada` SHALL editar el nivel con pestañas ES/EN sobre el mismo campo, con `es` obligatorio y `en` opcional, como `detail`. Un nivel legado SHALL cargarse en ES con EN vacío. El listado SHALL mostrar el nivel en español. Abrir y cerrar sin tocar nada MUST NOT contar como cambio.

#### Scenario: Guardar y releer los dos idiomas
- **WHEN** se edita el inglés del nivel de un idioma a "Native", se guarda y se reabre la ficha
- **THEN** la petición lleva `level: { es: "Nativo", en: "Native" }` y la ficha muestra "Nativo" en ES y "Native" en EN

#### Scenario: Español obligatorio
- **WHEN** se intenta guardar un idioma con el nivel en inglés y sin el español
- **THEN** no se llama a la API y aparece "El nombre y el nivel son obligatorios"

#### Scenario: Inglés opcional
- **WHEN** se guarda un idioma con el nivel solo en español
- **THEN** la petición lleva `level` sin la clave `en`

#### Scenario: Nivel legado
- **WHEN** se abre un idioma cuyo `level` es el string `"C1"`
- **THEN** la pestaña ES muestra "C1", la EN está vacía y cerrar sin tocar nada no muestra el aviso de cambios sin guardar
