## ADDED Requirements

### Requirement: El contador de visitas no cambia la fecha de modificación del perfil
Incrementar `views` al registrar una visita `HUMAN` y escribir `views` con `npm run views:reclassify -- --apply` MUST NOT modificar `CuratedProfile.updatedAt`: una visita no es una edición. El incremento SHALL seguir siendo atómico y en la misma transacción que el `ProfileView`, de modo que si una de las dos escrituras falla no queda ninguna.

#### Scenario: Una visita humana no mueve updatedAt
- **WHEN** el perfil `tech-lead-dotnet` tiene `updatedAt` en `2026-01-15T12:00:00.000Z` y un navegador hace `GET /api/curated-profiles/tech-lead-dotnet`
- **THEN** después de esperar las tareas en segundo plano, `views` del perfil aumentó en 1 y `updatedAt` sigue exactamente en `2026-01-15T12:00:00.000Z`

#### Scenario: La reclasificación no mueve updatedAt
- **WHEN** se aplica una reclasificación que cambia `views` de un perfil cuyo `updatedAt` es `2026-01-15T12:00:00.000Z`
- **THEN** `views` queda en el valor esperado y `updatedAt` no cambia

#### Scenario: Todo o nada se mantiene
- **WHEN** se intenta registrar una visita `HUMAN` de un perfil que no existe
- **THEN** la operación falla, no queda ningún `ProfileView` nuevo y ningún `views` cambia

#### Scenario: Una edición sí mueve updatedAt
- **WHEN** el administrador guarda un cambio del perfil con `PATCH /api/admin/curated-profiles/:id`
- **THEN** `updatedAt` pasa a la fecha y hora del guardado
