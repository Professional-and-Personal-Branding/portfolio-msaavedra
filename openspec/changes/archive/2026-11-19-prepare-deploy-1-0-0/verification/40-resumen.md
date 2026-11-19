# Verificación — prepare-deploy-1-0-0 (2026-11-18)

| Comando | Antes | Después |
|---|---|---|
| `npm test` (backend) | 186 suites, 2483 tests, verde | 187 suites, 2501 tests, verde |
| `npm run test:e2e` | 33 suites, 490 tests, verde | 33 suites, 490 tests; una corrida con 1 fallo por timeout de arranque del proceso hijo (`integrations-env`, `/health/live` a tiempo, bajo carga); `integrations-env` y `ai-env` solos: 17/17 verde |
| `npm run lint` / `typecheck` / `build` (backend) | verde | verde |
| `openapi:export` | sin deriva | sin deriva (`git diff --exit-code` limpio) |
| `npm test` (frontend, sin cambios de código) | no medido antes | 1328 de 1330; 2 fallos intermitentes de temporización en `ProfileBuilderPage.test.tsx` bajo carga, que aislado da 69/69 |
| `npm run lint` / `manual:check` (frontend) | — | verde; 54 casos, 62 imágenes (4,47 MB) |
| `openspec validate --all --strict` | — | 48/48, sin «Archive would refuse» (`30-openspec-validate.txt`) |

Desvíos: ver el informe final. Pendiente: CI del PR; archivar el change tras el merge.
