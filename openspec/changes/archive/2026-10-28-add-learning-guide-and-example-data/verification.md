# Verification — add-learning-guide-and-example-data

Fecha: 2026-10-27. Rama `docs/learning-guide` (sobre `docs/refresh-after-1-1`, PR #33). Toda la evidencia está en `verification/`. Ninguna corrida tocó la base `portfolio` del owner: todo fue contra `portfolio_example` y `portfolio_seedguard` (bases descartables en el mismo contenedor, ya borradas), con la API de ejemplo en `:3310` y el sitio en `:5190`.

## Estado por grupo

| Grupo | Estado | Evidencia |
|---|---|---|
| 1 Formato extendido y validación | Hecho | `backend/test/seed-source.spec.ts`, `seed-runner.spec.ts` (instantánea de 79 llamadas con SHA-256 del seed original) |
| 2 `--file`, negativa y verificación | Hecho, salvo el run de CI (2.5) | `2.3-cv-data.txt`, `4.1-seed-example.txt`, `4.2-negativa.txt`; el paso de CI está escrito |
| 3 Archivo de ejemplo y guía | Hecho | `3.4-claves.txt`; tests de traducciones y de cobertura |
| 4 Base local, TC-36 y TC-37 | Hecho | `4.1-seed-example.txt`, `4.2-negativa.txt`, `4.3-api.txt` |
| 5 Manual: ruta, recorridos, glosario | Hecho (recorridos por API) | `5.3-recorridos.md` |
| 6 Manual del backoffice | Hecho | `6.1-inventario.md` (53 mensajes literales, ninguno sin archivo) |
| 7 Casos sobre el ejemplo | Hecho, con casos "no repetidos" | `7.1-corrida.md`, `7.3-suite.txt` |
| 8 Capturas reproducibles | Hecho | `8.2-guardas.txt`, `8.4-capturas.md` (44 imágenes) |
| 9 Modo prueba y `manual:check` | Hecho, salvo el run de CI (9.5) | `9.1-filtros.txt`, `9.2-informe.md`, `9.3-axe.json`, `9.4-manual-check.txt` |
| 10 Cierre | Hecho, salvo 10.4 (a pedido del owner) | esta página |

## 10.3 — Comandos de verificación

```
backend/   npm run lint                      sin avisos
           npm run typecheck                 sin errores
           npm test                          81 suites, 629 tests (incluye 57 del seed y 36 de ejemplo y cobertura)
           npm run build                     ok
           npm run openapi:export            39 rutas, 61 schemas; git diff --exit-code -- openapi.json -> sin deriva
           npm run test:e2e                  10 suites, 174 tests, contra una copia descartable sembrada con cv-data.json
frontend/  npm run lint                      sin avisos
           npm test                          56 archivos, 629 tests
           npm run build                     tsc -b + vite build ok
           npm run perf:budget               148,9 KB gzip (tope 155 KB)
           npm run manual:check              ok: 37 casos alineados, 44 imágenes (3,18 MB), index.html 202 KB, 157 ids
raíz       npx -y @fission-ai/openspec@1.14.1 validate add-learning-guide-and-example-data --strict   válido
           npx -y @fission-ai/openspec@1.14.1 validate --all --strict                                  36 de 36, sin "Archive would refuse"
```

## Cómo se carga el ejemplo y la negativa

Salidas completas en `4.1-seed-example.txt` y `4.2-negativa.txt`.

- `seed:example` sin `SEED_DISPOSABLE_DB` contra una base vacía: código 2.
- Con la variable, dos cargas seguidas: código 0 las dos; `seed:example:verify`: código 0 (conteos 1 / 3 / 6 / 4 / 16 / 3 / 3 / 3 / 4 / 0 / 5 / 9 / 1 alias / 105 visitas).
- Un mecanismo distinto (`listed` de `ejemplo-dirigido` cambiado en la base): `seed:example:verify` sale con 1 nombrando el slug y el campo.
- Negativa sobre `portfolio_seedguard` (copia sembrada con `cv-data.json`, nunca `portfolio`): sin variable, código 2 (capa 1); con la variable, código 2 (capa 3); con `NODE_ENV=production`, código 2 (capa 2). Conteos y `Profile` sin cambios; `seed:verify` sigue en verde.
- El seed por defecto no cambió: el test compara las 79 llamadas que escribía antes del cambio (SHA-256 `24ef8090…`).

## Desvíos respecto del diseño y de las tareas

1. **Secciones del manual con letras (A, B, C) en lugar de renumerar.** Para no romper las referencias existentes a `MANUAL.md` § 5.1, § 6 y § 6.1 (`CLAUDE.md`, `frontend/README.md`, `CHANGELOG`, `dto-validation.spec.ts`), la ruta, los recorridos y el manual del backoffice son las secciones **A, B y C**, antes de los casos; TC-36 y TC-37 viven en § 4.1 y el glosario es § 9. El orden de D10 se respeta.
2. **Recorridos y casos por API (5.3, 7.1).** Se ejecutaron con los endpoints del panel y la sesión de prueba, no con clics en cada pantalla; la parte visual la cubren las capturas y la suite. Los avisos de cambios sin guardar (TC-28 a TC-30), TC-33, TC-34 y TC-35 conservan la evidencia anterior y **no se repitieron** sobre el ejemplo (está dicho en cada caso y en `7.1-corrida.md`).
3. **Sitio con `vite dev` (8.3), no la imagen de `frontend/Dockerfile`** (D11 lo admite). Las capturas que muestran el link público lo hacen con `localhost:5190`.
4. **Contraseña del administrador de prueba.** Generada al azar para la sesión (`crypto.randomUUID()`), guardada solo en un archivo temporal fuera del repositorio y borrado al terminar; no se escribió en ningún campo de un navegador (login por `fetch`).
5. **9.2:** no se probó dentro del visor de artifacts (no se publicó). El portapapeles se probó con éxito y con rechazo (textarea de respaldo).
6. **Ejemplo:** un solo aviso de la regla de las 12:00 UTC de las visitas: si la carga ocurre antes de esa hora, la visita del día 0 se ancla al momento de la carga para no quedar en el futuro (`buildSyntheticViews`).
7. **`suite-backoffice.ps1`:** además de aceptar `-Api` y las credenciales por entorno, se negó a correr si la API no sirve el perfil ficticio (código 2), y dejó de leer `backend/.env`. El `accentColor` de la línea 53 es intencional: comprueba que la API lo rechaza (400); se documentó en el script.
8. **El contador "0 de 24" de `index.html`** se reemplazó por uno calculado del DOM (hoy 37).

## Pendientes y hallazgos para el owner

- **2.5 y 9.5 (CI):** los pasos están escritos (segunda base con `seed:example` dos veces y la negativa contra la base con el CV; `manual:check` después de `npm test`), pero no se pudieron ver en verde porque no se hizo push. Hay que confirmarlos en el PR.
- **10.4:** el artifact no se publicó (el owner no lo pidió).
- **Hallazgo de accesibilidad del panel con el ejemplo** (`7.1-corrida.md`): `a11y:check` contra `vite dev` encontró 39 nodos de contraste en el panel (ítems ocultos atenuados) y presets claros en móvil. El CI actual corre sobre `cv-data.json`, que no tiene ítems ocultos, y no lo vería. No se tocó.
- Los topes de D13 se cumplen con margen en imágenes (mayor 146 KB) y en el HTML (202 KB), pero la imagen de la home (`tc36`) hubo que recortarla a 1.700 px para entrar.
- `featuredRepositories` queda documentado como inerte (§ 10 de `DATA-POPULATION.md`).
