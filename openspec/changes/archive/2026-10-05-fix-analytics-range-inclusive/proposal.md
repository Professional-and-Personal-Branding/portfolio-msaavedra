# fix-analytics-range-inclusive — El dashboard cuenta las visitas de hoy

> Corrige el defecto **D-01** (`docs/MANUAL.md` § 6.1), encontrado el 5 de octubre de 2026 al ejecutar la suite de regresión manual (TC-18). Es una **corrección de conformidad** con `admin-analytics-dashboard`, que ya pide un rango que termina hoy, más una **precisión** de `profile-view-analytics`, que nunca dijo si `to` incluía su día.

## Why

El dashboard de `/admin` nunca muestra las visitas del día en curso: se comparte un link, alguien lo abre, `views` del perfil sube, y el panel sigue en cero hasta el día siguiente.

`rangeOfDays` (frontend) construye el rango cerrado `[hoy - (días - 1), hoy]` y manda `to=<hoy>` como fecha ISO sin hora. El controller lo convierte con `new Date(query.to)`, que da **la medianoche inicial** de ese día (`2026-10-05T00:00:00Z`), y el repositorio filtra `viewedAt <= to`. El bound es inclusivo del instante, pero el instante es el comienzo del día: todo el día `to` queda fuera.

```
GET /api/admin/analytics/views?from=2026-10-05&to=2026-10-05  -> total=0
GET /api/admin/analytics/views?from=2026-10-05&to=2026-10-06  -> total=13, byDay={2026-10-05:13}
```

Además, el default del backend (`from = to - 30 × 24 h`) toca 31 días parciales, mientras que el del panel son 30 días completos: dos definiciones distintas de "últimos 30 días".

## What Changes

- **El rango es de días UTC completos y cerrado**: `from` incluye su día entero desde las 00:00 UTC y `to` incluye su día entero hasta el final. Un `to` con hora se interpreta igual: cuenta el día UTC al que pertenece.
- **La normalización vive en `AggregateProfileViewsUseCase`**, no en el controller ni en el repositorio: es la regla de aplicación que define qué significa el rango.
- **El repositorio recibe un rango semiabierto** `[inicio de from, inicio del día siguiente a to)` y compara con `<` en el `count`, los `groupBy` y el SQL crudo de `byDay`. Es un detalle interno: evita depender de un `23:59:59.999` literal y de la precisión de la columna.
- **Default alineado con el panel**: los 30 días UTC completos `[hoy - 29, hoy]`, lo mismo que `rangeOfDays(30)`.
- **`from` y `to` de la respuesta salen normalizados**: inicio del día de `from` y último milisegundo del día de `to`. Es el único cambio visible en la forma de la respuesta.

### Non-goals

- **Zona horaria del administrador.** Todo sigue en UTC, como ya lo están `date_trunc` del SQL, las claves de `byDay` y `rangeOfDays`. Que "hoy" en UTC no coincida con "hoy" en UTC-5 es preexistente y pide otra decisión.
- **El frontend.** `rangeOfDays` ya construye lo correcto; no se toca.
- **D-02** (`@IsDefined()` en DTO anidados): defecto distinto, change aparte.
- Migración de Prisma: ninguna.

## Capabilities

### Modified Capabilities

- `profile-view-analytics` — el requisito *Lectura agregada para el administrador* precisa la semántica del rango y el default.

`admin-analytics-dashboard` no cambia: su escenario *Cambio de rango* ya describe el comportamiento correcto.

## Impact

- `backend/src/modules/analytics/application/use-cases/aggregate-profile-views.use-case.ts` y su spec.
- `backend/src/modules/analytics/infrastructure/persistence/prisma-profile-view.repository.ts`.
- `backend/src/modules/analytics/domain/repositories/profile-view.repository.ts` (documenta que `to` es exclusivo en el puerto).
- `backend/src/modules/analytics/infrastructure/controllers/admin-analytics.controller.ts` (descripción Swagger) y `backend/openapi.json` / `frontend/src/shared/types/api.d.ts` si la descripción cambia el contrato exportado.
- `backend/test/admin.e2e-spec.ts`: TC-18 automatizado.
- `docs/MANUAL.md` § 6: TC-18 pasa a ✅ y D-01 queda como resuelto.
