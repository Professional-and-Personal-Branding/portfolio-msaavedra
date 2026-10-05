# Tasks — fix-analytics-range-inclusive

> Referencias: `proposal.md`, `specs/profile-view-analytics/spec.md`. Defecto D-01 de `docs/MANUAL.md` § 6.1.

## 1. Tests que fallan hoy

- [x] 1.1 Spec del caso de uso: con `now = 2026-10-05T18:00:00Z` y `from = to = 2026-10-05`, el rango que recibe el repositorio contiene `now`. Verificar: falla antes del arreglo.
- [x] 1.2 Spec del caso de uso: normalización (`from` al inicio del día, `to` al último milisegundo en la respuesta, `to` exclusivo al día siguiente hacia el repositorio) y default de 30 días completos. Verificar: falla antes del arreglo.
- [x] 1.3 E2E (`admin.e2e-spec.ts`): registrar una visita por la ruta pública y consultar `from=to=<hoy UTC>`; `total ≥ 1` y `byDay` trae hoy. Verificar: falla antes del arreglo.

## 2. Arreglo

- [x] 2.1 `AggregateProfileViewsUseCase` normaliza a días UTC completos y pasa al repositorio `[inicio de from, inicio del día siguiente a to)`. Verificar: 1.1 y 1.2 pasan.
- [x] 2.2 Puerto `DateRange` documenta `to` exclusivo; el repositorio Prisma compara con `lt` / `<` en las cuatro consultas. Verificar: 1.3 pasa.
- [x] 2.3 Descripción Swagger de `from`/`to` y, si cambia, `openapi:export` + `api:types`. Verificar: el test de deriva del frontend pasa.

## 3. Cierre

- [x] 3.1 `docs/MANUAL.md` § 6: TC-18 ✅ y D-01 marcado como resuelto con referencia a este change.
- [x] 3.2 `npm run test` y `npm run test:e2e` del backend en verde; `npm run test` del frontend en verde.
