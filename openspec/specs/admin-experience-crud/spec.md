# admin-experience-crud Specification

## Purpose
Permite al administrador gestionar la trayectoria laboral completa desde la API, con datos bilingües validados y efecto inmediato en las vistas públicas y curadas.

## Requirements

### Requirement: Listado y detalle administrativos con datos crudos
`GET /api/admin/experiences` SHALL devolver todas las experiencias (visibles y ocultas) en orden cronológico canónico, con los campos traducibles **sin resolver** (`{ es, en }`) para poder editarlos, más `visible`, `createdAt` y `updatedAt`. `GET /api/admin/experiences/:id` SHALL devolver una (404 si no existe).

#### Scenario: Listado incluye ocultas y objetos bilingües
- **WHEN** existe una experiencia con `visible = false` y el administrador hace `GET /api/admin/experiences`
- **THEN** aparece en la respuesta, `role` es un objeto con claves `es`/`en` y el elemento incluye `visible: false`

#### Scenario: Detalle inexistente
- **WHEN** hace `GET /api/admin/experiences/no-existe`
- **THEN** recibe 404

### Requirement: Creación validada
`POST /api/admin/experiences` SHALL crear una experiencia y responder 201 con el recurso creado (incluido `id`). Campos desconocidos MUST rechazarse, y un cuerpo inválido MUST responder 400 con los mensajes de validación.

#### Scenario: Creación exitosa
- **WHEN** envía un cuerpo válido con `company: "ACME"`, `role: { es: "Dev", en: "Dev" }`, `startDate: "2025-01"`, `tags: ["java"]`
- **THEN** recibe 201 con `id` y la experiencia aparece en `GET /api/experiences` y en los perfiles curados cuyo `filterTags` incluya `java`

#### Scenario: Campo desconocido
- **WHEN** envía `{ ..., hacker: true }`
- **THEN** recibe 400

### Requirement: Reglas de validación de una experiencia
El cuerpo de una experiencia MUST validarse: `company`, `location` no vacíos; `role`, `summary` objetos `{ es: string, en?: string }`; `highlights` `{ es: string[], en?: string[] }`; `startDate` y `endDate` con formato `YYYY-MM` (`endDate` nulo u omitido si `current`); `technologies`, `tags`, `sector` arrays de strings; `order` entero ≥ 0 (default 0); `visible` booleano (default true).

#### Scenario: Fecha inválida
- **WHEN** envía `startDate: "2025-13"` o `"enero 2025"`
- **THEN** recibe 400 y el mensaje menciona `startDate`

#### Scenario: Traducción obligatoria en español
- **WHEN** envía `role: { en: "Dev" }` sin `es`
- **THEN** recibe 400

### Requirement: Edición parcial
`PATCH /api/admin/experiences/:id` SHALL aplicar solo los campos enviados (mismas reglas de validación) y responder 200 con el recurso actualizado; 404 si no existe.

#### Scenario: Ocultar una experiencia
- **WHEN** envía `{ visible: false }`
- **THEN** recibe 200, `visible` es `false` y la experiencia deja de aparecer en `GET /api/experiences` y en los perfiles curados

#### Scenario: Cambiar solo tags
- **WHEN** envía `{ tags: ["dotnet"] }`
- **THEN** el resto de campos permanece igual y la experiencia deja de aparecer en perfiles cuyo filtro no incluya `dotnet`

#### Scenario: Id inexistente
- **WHEN** hace `PATCH /api/admin/experiences/no-existe`
- **THEN** recibe 404

### Requirement: Borrado
`DELETE /api/admin/experiences/:id` SHALL eliminar la experiencia y responder 204; 404 si no existe. Los ids referenciados en `includeIds`/`excludeIds` de perfiles curados SHALL quedar como referencias ignoradas (no rompen la resolución).

#### Scenario: Borrado exitoso
- **WHEN** borra una experiencia existente
- **THEN** recibe 204, `GET /api/admin/experiences/:id` responde 404 y el conteo público disminuye en uno

#### Scenario: Referencia huérfana en overrides
- **WHEN** un perfil curado tiene ese id en `excludeIds` y se resuelve
- **THEN** la resolución responde 200 normalmente

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
