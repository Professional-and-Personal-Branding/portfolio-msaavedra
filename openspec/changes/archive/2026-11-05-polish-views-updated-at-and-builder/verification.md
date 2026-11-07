# Verificación — polish-views-updated-at-and-builder

Estado: **implementado y verificado** (2026-11-05). Rama `fix/views-updated-at-and-builder`, apilada sobre `feat/profile-structured-data` (`a7a4317`, PR #47). Evidencia en `verification/`. Sin PR todavía (tareas 8.2 y 8.3 pendientes).

## Resultados

| Medida | Antes | Después | Tarea / evidencia |
|---|---|---|---|
| `updatedAt` tras una visita `HUMAN` | e2e en rojo (hora de la visita) | igual al previo, exacto | 1.2 `1.2-rojo.txt`, 2.1 |
| `<lastmod>` tras una visita | día de la visita | `2026-01-15`, el de la última edición | e2e + `7.4-app-real.txt` |
| `<lastmod>` tras un `PATCH` del perfil (control) | verde | verde, día de hoy | 1.2 |
| `updatedAt` tras `applyReclassification` | rojo | igual al previo | 1.2, 2.2 |
| Con `updateMany` en vez de `$executeRaw` | — | el paso 3 sigue en rojo (alternativa descartada) | `1.2-rojo-updatemany.txt` |
| Jest unitario (backend) | 94 suites / 925 tests | 94 / 925 | `8.0-backend-final.txt` |
| E2E (backend) | 14 suites / 250 tests | 15 / 253 (`views-updated-at`, 3 tests) | `1.1`, `8.0` |
| «Todo o nada», `view-kind`, `share-links` e2e | verdes | verdes, sin cambios | 2.1 |
| `backend/openapi.json`, `api.d.ts` | — | sin cambios | 2.4, `8.0` |
| Vitest (frontend) | 64 archivos / 972 tests | 65 / 981 (+3 `plural`, +3 preview, +1 builder, +1 lista, +1 skills; dashboard ajustado) | `1.1-frontend.txt`, `8.0-frontend-final.txt` |
| Contador del preview con 1/1/1 | «1 experiencias · 1 categorías · 1 proyectos» | «1 experiencia · 1 categoría · 1 proyecto» | 3.3 (el test falla con el plural fijo) |
| Contador con el preview en EN | español | español (D6) | 3.3 |
| `perf:budget` | — | 150,1 KB gzip (tope 155) | 5.1, `8.0` |
| Vitest en frío (tres corridas tras `rm dist` y `npm run build`) | 1 de 3 con 2 fallos (`Test timed out in 5000ms`) | 3 de 3 sin fallos (37,6 s, 39,2 s, 39,2 s) | `6.1-medicion.md`, `6.4-tres-corridas.txt` |
| `findBy` imposible | — | falla a 1016 ms (`asyncUtilTimeout` intacto) | 6.5 |
| `frontend/src/test/setup.ts` | — | sin cambios; no se creó `warm-up.ts` | 6.2, 6.3 |
| `manual:check` | 43 casos | 43 casos, 46 imágenes; epígrafe y captura de TC-12 corregidos | 7.1, 7.2 |
| `openspec validate --all --strict` | 39 válidos | `Totals: 40 passed, 0 failed (40 items)`, sin «Archive would refuse» | `8.1-validacion.txt` |

## App real

API en el puerto 3344 sobre una base descartable sembrada con `seed:example`; `updatedAt` de `ejemplo-backend` fijado en `2026-01-15 12:00` y una visita por `curl` con un `User-Agent` de navegador: `views` 26 → 27, `updatedAt` intacto y `/sitemap.xml` con `<lastmod>2026-01-15</lastmod>` (`7.4-app-real.txt`). La base, el servidor y las credenciales de prueba se borraron al terminar.

## Notas y pendientes

- **Medición de timeouts.** En frío falló una de las tres corridas de 6.1, con dos `Test timed out in 5000ms` (no `findBy`), y las otras dos pasaron: la evidencia es modesta pero coherente con D7. Por eso solo se aplicaron los timeouts, sin `warm-up.ts`. Antes de eso, en corridas parciales o tibias, hubo además un fallo del staged de la vista pública (`expected null not to be null`) y un `findBy` de `preview-counts` demorado por la carga; ninguno fue el primer test de su archivo.
- **Otra escritura de `views`.** `scripts/lib/seed-runner.ts` incrementa `views` con `update` al sembrar visitas del ejemplo. Corre al crear el perfil, así que `updatedAt` = creación es correcto; no se tocó (ver `2.3-escrituras.txt`).
- P1 y P2 resueltas el 2026-11-04 (A y A); ver `design.md`.
- Pendientes: 8.2 (PR y CI) y 8.3 (archivado y nota en el PR de #47), que no se pidieron en esta tarea.
