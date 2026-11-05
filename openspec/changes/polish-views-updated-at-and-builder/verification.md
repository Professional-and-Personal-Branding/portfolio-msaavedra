# Verificación — polish-views-updated-at-and-builder

Estado: **propuesto, sin implementar** (2026-11-04). Rama `fix/views-updated-at-and-builder`, apilada sobre `feat/profile-structured-data` (`a7a4317`, PR #47). Este archivo se completa al implementar; la evidencia va en `verification/`.

## Resultado esperado

| Medida | Antes | Después (esperado) | Tarea |
|---|---|---|---|
| `updatedAt` tras una visita `HUMAN` | pasa a la hora de la visita | igual al previo, exacto | 1.2, 2.1 |
| `<lastmod>` del sitemap tras una visita | día de la visita | día de la última edición | 1.2, 2.1 |
| `<lastmod>` tras un `PATCH` del perfil | día del guardado | día del guardado (control) | 1.2 |
| `updatedAt` tras `views:reclassify -- --apply` | hora de la corrida | igual al previo | 1.2, 2.2 |
| «Todo o nada» del registro (`background-views.e2e-spec.ts`) | verde | verde, sin cambios en el test | 2.1 |
| `backend/openapi.json` | — | sin cambios | 2.4 |
| Contador del preview con 1/1/1 | «1 experiencias · 1 categorías · 1 proyectos» | «1 experiencia · 1 categoría · 1 proyecto» | 3.3 |
| Contador con el preview en EN | en español | en español (D6) | 3.3 |
| `perf:budget` | — | ≤ 155 KB gzip, sin cambio apreciable | 5.1 |
| Vitest en frío (tres corridas tras `npm run build`) | fallos intermitentes por tiempo | 0 fallos en las tres | 6.1, 6.4 |
| `findBy` imposible | falla a ~1 s | falla a ~1 s (`asyncUtilTimeout` intacto) | 6.5 |
| `frontend/src/test/setup.ts` | — | sin cambios | 6.2 |
| `manual:check` | verde | verde, epígrafe de TC-12 corregido | 7.1, 7.2 |
| `openspec validate --all --strict` | 39 válidos | 40 válidos (con este change), 0 fallas | 8.1 |

## Validación de la propuesta

`npx -y @fission-ai/openspec@1.14.1 validate --all --strict` sobre la rama, con este change incluido: `Totals: 40 passed, 0 failed (40 items)` (2026-11-04). Deltas solo `ADDED` (D9): no hay avisos «Archive would refuse».

## Pendientes

- P1 y P2 de `design.md` (no bloqueantes) esperan la respuesta del owner. P2 decide si el grupo 4 de `tasks.md` se implementa o se borra.
