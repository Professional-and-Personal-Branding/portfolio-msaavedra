# Verification — polish-pre-deploy-cleanup

Ejecutado el 2026-11-17 en el worktree `chore/cleanup-pre-deploy`, con bases descartables `portfolio_cleanup_*` en el Postgres local (5434), la API de la rama en `3356` y la imagen de `frontend/Dockerfile` en `8156`. La base `portfolio` del owner no se tocó.

## Índice de evidencias

| Tarea | Evidencia |
|---|---|
| 2.3 | `verification/2.3-migracion.txt` — migración con `stars = 7` en una fila, respuesta de `GET /api/featured-repositories` idéntica antes y después, `\d` sin `stars` y rollback de D2 |
| 3.4 | `verification/3.4-cabeceras.txt` — líneas `Cache-Control` por URL antes (2 en las rutas con política propia) y después (1 en todas), `caddy adapt` con `require`/`set` y el bloque del CI contra el `Caddyfile` nuevo (rc 0) y el anterior (rc 1) |
| 5.3 | `verification/5.3-a11y-negativo.txt` — con el `Table` anterior, `scrollable-region-focusable` (serious) en `admin-dashboard-tablas.mobile` y en `admin.mobile`; salida 1 |
| 5.4 | `verification/5.4-a11y.txt` — `a11y:check` con panel: ejemplo (dos corridas), CV; 0 violaciones, teclado y errores a la vista sin problemas, un solo enlace de auditoría |
| 6.4 | `verification/6.4-tc53.txt` — TC-53 en la app real |

## Resultados

- **P3 de `add-github-code-evidence` / D2:** la sesión principal consultó en modo solo lectura la base `portfolio` del owner: `FeaturedRepository` tiene **0 filas**, o sea **0 valores de `stars` no nulos**. No se volvió a consultar esa base.
- **Backend:** `lint`, `typecheck` y `build` en verde; `npm test` 169 suites y 2193 tests, igual antes y después (un test del seed cambió de «rechaza» a «acepta»); `test:e2e` 31 suites y 464 tests sobre una base descartable migrada y sembrada, con `FRONTEND_URL=http://localhost:5173` (antes 30 de 31: `integrations-env` arranca el proceso real y falló solo porque todavía no existía `dist/`; con `npm run build` hecho pasa); `openapi:export` sin deriva; `prisma migrate diff` y `prisma:status` sin diferencias; `seed` y `seed:verify` y `seed:example` y `seed:example:verify` con código 0.
- **Frontend:** `lint`, `typecheck` (`tsc -b`) y `build` en verde; `npm test` 86 archivos y 1302 tests (antes 84 y 1295: suman `caddyfile.spec.ts`, `table.test.tsx` y dos tests del Dashboard); `api:types` sin deriva; `perf:budget` 151,2 KB sobre 155; `manual:check` 53 casos alineados.
- **Caddy:** una sola línea `Cache-Control` en las siete URLs de `3.4` (cinco del CI más el `resume.json` protegido y `/api/admin/consistency`), con el valor esperado.
- **`a11y:check` con panel:** 0 violaciones en las dos bases (74 cargas con el ejemplo, 96 con el CV); en móvil, `Por enlace` desborda (`scrollWidth 403 > clientWidth 285`).
- **`openspec validate --all --strict`** (`@fission-ai/openspec@1.14.1`): 47 correctos, 0 fallas, sin «Archive would refuse».
- **TC-53: ✅** (app real, imagen de producción, Chrome con viewport de 375 px y teclado real).

## Pendientes y desvíos

- **6.2 (base local del owner):** no se aplicó. La instrucción de la sesión de implementación prohíbe tocar la base `portfolio`. Queda para el owner: `SELECT count(*) FROM "FeaturedRepository" WHERE "stars" IS NOT NULL;` (ya se sabe que da 0) y `npm run prisma:migrate` en `backend/`.
- **3.5:** el bloque del CI se probó localmente (pasa con el `Caddyfile` nuevo y falla con el anterior); el job `web-quality` en verde se confirma en el PR.
- **Prueba negativa 5.3:** la primera corrida usó un mensaje de preparación que confundía «sin filas» con «sin región»; se corrigió después (la preparación ya no depende del `aria-label`) y la corrida negativa no se repitió entera. La violación `scrollable-region-focusable` y el código 1 quedaron comprobados.
- **Hallazgo:** con filas en el Dashboard, la entrada `admin` existente ya detecta la violación en móvil (las visitas sintéticas del script la sacan del estado vacío): `admin-dashboard-tablas` deja el escenario explícito.
