# Tasks — prepare-deploy-1-0-0

> Referencias: `proposal.md`, `design.md` (D1–D13; P1–P3 no bloqueantes, con recomendación; tabla R1–R28) y los deltas de `specs/`.
>
> **Orden:** 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8. Cada grupo de código va en el mismo commit que sus tests. La rama sale de `feat/ai-foundation`; el PR va contra `main` y se fusiona después de #68.
>
> **Sin red ni bases del owner:** ninguna tarea toca Railway, GitHub ni Anthropic, ni escribe en la base `portfolio` de `localhost:5434`. Los tests usan las bases de e2e de siempre.
>
> **Reglas condicionales:** las tareas marcadas **(P1)**, **(P2)** o **(P3)** dependen de esas preguntas del `design.md`. Si el owner elige B, se quita el escenario correspondiente del delta y la tarea se marca «descartada por P-n».

## Evidencia

Los resultados de antes y después están en `verification/`: `00-antes-backend.txt` y `00-antes-e2e.txt` (línea base: 186 suites y 2483 tests unitarios, 33 suites y 490 e2e), `20-despues-e2e.txt` (después), `30-openspec-validate.txt` y `40-resumen.md` (tabla antes y después). Desvíos y pendientes: `40-resumen.md`.

## 1. Validación de entorno (`backend/src/config/env.validation.ts`)

- [x] 1.1 Agregar a `productionIssues` la regla de D1: `ANALYTICS_SALT` ausente o vacía → «ANALYTICS_SALT: obligatoria en producción…», sin el valor. **Verificación:** test «Sal ausente en producción» en `env.validation.spec.ts`; el fixture `production` del spec suma una `ANALYTICS_SALT` válida y los tests existentes siguen en verde.
- [x] 1.2 Agregar la regla de D2 (`new URL(v).origin === v`) para `FRONTEND_URL`, en todos los entornos y solo si la forma básica ya validó. **Verificación:** tests «Barra final», «Con ruta» y «Origen válido con puerto»; ningún mensaje contiene el valor.
- [x] 1.3 **(P1)** En `productionIssues`: `ANALYTICS_SALT` con menos de 32 caracteres → error de longitud. En `integrationIssues`, en producción: una clave del keyring igual a `ANALYTICS_SALT` → error que nombra `INTEGRATIONS_KEYS`. **Verificación:** tests «Sal corta en producción» y «Sal repetida en el keyring».
- [x] 1.4 Sumar `ANALYTICS_SALT` (32 bytes en base64, distinta del `JWT_SECRET`) a los arranques en modo producción de `test/e2e-helpers.ts` y de los e2e `auth`, `ai-env` e `integrations-env`. **Verificación:** `npm run test` y `npm run test:e2e` en verde; `npm run lint` y `npm run typecheck` sin errores.
- [x] 1.5 Confirmar que el job `web-quality` de `.github/workflows/ci.yml` arranca la API con las reglas nuevas (`ANALYTICS_SALT` de 44 caracteres y `FRONTEND_URL` sin barra). **Verificación:** el CI del PR en verde; si fallara, ajustar solo el valor del workflow.

## 2. `admin:bootstrap` (`backend/scripts/bootstrap-admin.ts`)

- [x] 2.1 Extraer a `scripts/lib/bootstrap-admin.ts` una función pura que, dados `password` y `NODE_ENV`, devuelva el rechazo o el aviso (D3). En producción, la contraseña de ejemplo sale con 1 **antes** de construir `PrismaClient`. **Verificación:** unitarios «Contraseña de ejemplo en producción» y «… fuera de producción»; un test comprueba que no se instancia el cliente de Prisma.
- [x] 2.2 **(P2)** Mínimo de 12 caracteres con `NODE_ENV=production` (fuera de producción sigue en 8) (D5). **Verificación:** unitario «Contraseña corta en producción».
- [x] 2.3 Agregar el archivo del test al `testRegex` de `backend/package.json` si hace falta. **Verificación:** `npm run test` lo ejecuta (se ve en la salida).

## 3. `job-postings:purge` en simulación (P3)

- [x] 3.1 `scripts/purge-job-posting-text.ts` y `scripts/lib/purge-job-posting-text.ts`: sin `--apply` cuenta y no escribe; con `--apply` purga. Los mensajes de D6 y los códigos 0/1 no cambian. **Verificación:** tests «Simulación por defecto» y «Comando de purga» contra un repositorio en memoria; la purga perezosa conserva sus tests en verde.
- [x] 3.2 Actualizar las menciones del comando en `docs/MANUAL.md` (~línea 921) y `docs/manual/index.html`, `docs/ARCHITECTURE.md` y `CLAUDE.md` (sección de comandos) con `-- --apply`. **Verificación:** `grep -rn "job-postings:purge"` sobre `docs/` y `CLAUDE.md` muestra la simulación y `--apply` en cada lugar; `npm run manual:check` en verde.

## 4. `docs/DEPLOY-RAILWAY.md`

- [x] 4.1 **R1:** paso 3 («Cómo verificar el deploy»), tabla «Migraciones de la 1.0.0 y su riesgo» y nota de migraciones: las 15 en orden, con su tipo (D8). **Verificación:** la lista coincide con `ls backend/prisma/migrations`.
- [x] 4.2 **R2 y R22:** primer ítem de los pasos 3 y 5, «Settings → Service Name: `api`» (y `web`), más la línea sobre el primer deploy automático que falla (D9). **Verificación:** lectura; `API_ORIGIN` del paso 5 menciona el nombre fijado en el paso 3.
- [x] 4.3 **R3:** paso 0. La precondición pasa a «`openspec/changes/` solo con `archive/`: archivar antes `polish-pre-deploy-cleanup`, `add-ai-foundation` y `prepare-deploy-1-0-0`» (D11). **Verificación:** lectura.
- [x] 4.4 **R5 y R13:** en el paso 1, la frase de qué impide el arranque se alinea con el delta (`ANALYTICS_SALT` obligatoria en producción y, con P1, de 32 caracteres o más y distinta del keyring; `FRONTEND_URL` como origen). En el paso 3, la advertencia de qué pasa sin `NODE_ENV=production` y el criterio de la línea «Swagger deshabilitado…» en el log. **Verificación:** cada regla citada existe en `env.validation.ts`.
- [x] 4.5 **R6 y R28:** el bloque de variables del paso 3 lleva `FRONTEND_URL=https://mjsaavedra.is-a.dev` (origen, sin barra) y una nota de por qué es inocuo antes del lanzamiento (D10). El paso 6 pasa a solo verificar; el redeploy queda solo si se cambió el valor. **Verificación:** lectura; ninguna mención a un `FRONTEND_URL` provisorio.
- [x] 4.6 **R7, R16 y R25** (Operación, «Integraciones»):
  - La rotación con `integrations:rekey` lleva `DATABASE_URL`, `INTEGRATIONS_KEYS` (con `k1` y `k2`) e `INTEGRATIONS_ACTIVE_KEY=k2` solo en esa terminal, y su limpieza.
  - «Sincronizar ahora» del panel en lugar de `integrations:sync` desde la PC, y qué variables pediría el script.
  - Generar una clave del keyring nueva, nunca la `ANALYTICS_SALT`.

  **Verificación:** las variables coinciden con `scripts/integrations-rekey.ts:37-47`.
- [x] 4.7 **R9 y R23:** tabla de Operación con «mes · `job-postings:purge` (simulación y `-- --apply`)» y «mes, desde mayo de 2027 · `ai-runs:purge`», desde la PC con `DATABASE_PUBLIC_URL` y `NODE_ENV=production`; sin servicio cron (D7). **Verificación:** lectura; el bloque de comandos coincide con D6.
- [x] 4.8 **R10 y R26:** en los pasos 3 y 5, «Wait for CI», si el panel lo ofrece. En el paso 3, marcar como *sealed* `JWT_SECRET`, `ANALYTICS_SALT`, `INTEGRATIONS_KEYS`, `GITHUB_SYNC_TOKEN` y `ANTHROPIC_API_KEY`, si el panel lo ofrece (D12). **Verificación:** lectura.
- [x] 4.9 **R11 y R15:** en «Encender la IA», la migración `add_ai_foundation` ya corrió en el deploy que trajo el código. Spend limits decididos: 12 USD en `portfolio-app` y 5 USD en `portfolio-evals`, sin «p. ej.». **Verificación:** lectura.
- [x] 4.10 **R12:** en el paso 7, la verificación de la cookie (login con `curl.exe -D -`; `Set-Cookie` con `HttpOnly`, `Secure` y `SameSite=Strict`, con credenciales solo en la terminal) y `/health/live` 200. **Verificación:** el comando es válido en PowerShell (`curl.exe`, sin alias).
- [x] 4.11 **R14:** en el paso 2, «si el plan no ofrece Backups, el `.dump` del paso 9 es el único respaldo: semanal el primer mes». **Verificación:** lectura.
- [x] 4.12 **R17:** en el paso 5, `VITE_API_URL` no se define: el `ARG` del Dockerfile ya vale `""`. **Verificación:** coincide con `frontend/Dockerfile`.
- [x] 4.13 **R19 y R20:**
  - En el paso 2, anotar que el CI prueba con Postgres 16 y qué hacer si Railway da otra versión mayor.
  - En los pasos 4 y 9, «si la conexión falla por TLS, agregá `?sslmode=require`».

  **Verificación:** lectura.
- [x] 4.14 **R21:** en el paso 4, el bootstrap rechaza en producción la contraseña de ejemplo (y, con P2, una de menos de 12 caracteres); con «Faltan variables», repetir con las variables de la terminal. **Verificación:** los mensajes citados coinciden con los del grupo 2.
- [x] 4.15 **R24 y D12:** las secciones de IA y de GitHub pasan a una fase «Opcionales, con el sitio estable». GitHub pide antes 2 o más repositorios en `/admin/proyectos` y ejecutar TC-52 contra GitHub real; la IA, ejecutar TC-54 contra Anthropic real. **Verificación:** lectura.
- [x] 4.16 **D13:** sección final «Checklist de la 1.0.0», con tablas por fase (paso, verificación) y enlaces a los pasos numerados:
  - Fases: antes, servicios, variables, primer deploy, datos iniciales y respaldo cero, dominio, verificación, opcionales y después.
  - Plan de vuelta atrás: build o pre-deploy fallido, migración a medias, defecto sin migración, defecto con migración, variable faltante, datos pisados y primer deploy inutilizable antes de compartir el link.
  - Los tres respaldos.

  **Verificación:** cada ítem enlaza a un paso que existe; el índice del documento lo lista.

## 5. `docs/DEPLOY.md`

- [x] 5.1 **R1:** § 9.5, «Las 8 migraciones…» → las 15 con su tipo (D8). **Verificación:** coincide con 4.1.
- [x] 5.2 **R4 y R13:** la tabla del § 3 pasa a ser la tabla completa por servicio, con todas las variables que valida `env.validation.ts`:
  - Agrega las de IA, una fila de `AI_EVAL_*` con «nunca en el servicio», y las columnas de default, secreto y cómo generarla (`openssl rand -base64 48` y `-base64 32`, o `New-Secret`).
  - Agrega la nota sobre `NODE_ENV` ausente.
  - Corrige la fila de `ANALYTICS_SALT` (obligatoria en producción) y la de `FRONTEND_URL` (origen sin barra).

  **Verificación:** un `grep` de los nombres de propiedad de `EnvironmentVariables` encuentra cada uno en la tabla.
- [x] 5.3 **R5:** § 1, la frase de qué impide el arranque se alinea con el delta. **Verificación:** igual que 4.4.
- [x] 5.4 **R7 y R16:** § 3, «Integraciones con terceros», ítems 5 y 6, se alinean con 4.6. **Verificación:** lectura.
- [x] 5.5 **R8:** § 7, la reclasificación de visitas usa la URL pública en la terminal y no `railway run`. **Verificación:** `grep -n "railway run npm" docs/DEPLOY.md` no encuentra ninguna instrucción a ejecutar.
- [x] 5.6 **R17 y R18:** § 4 cita `node:22.23.3-alpine` y `caddy:2.11.4-alpine` como en el Dockerfile. La fila de `VITE_API_URL` dice «no definir». **Verificación:** coincide con `frontend/Dockerfile`.
- [x] 5.7 **R20:** § 9.5, la nota de `sslmode` se alinea con 4.13. **Verificación:** lectura.

## 6. `docs/DEPLOY-ARCHITECTURE.md`

- [x] 6.1 **R1:** § 10, tabla de migraciones con las 15; el diagrama de la línea ~410 pasa a «¿15 migraciones…?». **Verificación:** coincide con 4.1.
- [x] 6.2 **R4:** § 9, el mapa de variables suma `INTEGRATIONS_*`, `GITHUB_*`, `AI_*` y `ANTHROPIC_API_KEY` (servicio `api`) y la regla «`AI_EVAL_*` y `ADMIN_*` solo en la terminal». **Verificación:** lectura contra 5.2.

## 7. Release, ejemplo de entorno y registro

- [x] 7.1 **R3 y R27:** `docs/RELEASE-1.0.0-CHECKLIST.md` suma tres ítems:
  - Changes archivados antes del deploy.
  - Purgas mensuales (sin cron).
  - Opcionales GitHub e IA (⏸️) con enlace a la guía.

  **Verificación:** lectura.
- [x] 7.2 `backend/.env.example` (el ejemplo no menciona `job-postings:purge`, así que no hubo qué cambiar en ese ítem):
  - `ANALYTICS_SALT` descomentada, con un valor de desarrollo y la regla de producción (obligatoria, de 32 o más con P1, distinta de `JWT_SECRET` y del keyring).
  - Comentario de `FRONTEND_URL` («origen, sin barra final»).
  - Nota de que el bootstrap rechaza el placeholder en producción.
  - `job-postings:purge` con `--apply`.

  **Verificación:** la API arranca en desarrollo con un `.env` copiado del ejemplo (`npm run start:dev` arranca sin errores de configuración).
- [x] 7.3 `docs/MANUAL.md` (~línea 773) e `index.html`: el bootstrap «acepta contraseñas de 8 caracteres o más» pasa a decir 12 en producción con P2, o se aclara que en producción no acepta el placeholder. **Verificación:** `npm run manual:check` en verde.
- [x] 7.4 `docs/CHANGELOG.md`: entrada del change. `CLAUDE.md`: el comando `job-postings:purge` con `--apply`, la línea del roadmap y los «Pendientes para el deploy» sin el cron de Railway. **Verificación:** lectura.

## 8. Cierre

- [x] 8.1 `npx -y @fission-ai/openspec@1.14.1 validate prepare-deploy-1-0-0 --strict` y `validate --all --strict`, sin «Archive would refuse» para este change. **Verificación:** la salida se guarda en `verification/`.
- [x] 8.2 `npm run lint`, `npm run typecheck`, `npm run test` y `npm run test:e2e` en `backend/`; `npm run manual:check` en `frontend/`. **Verificación:** salida en `verification/`; el CI del PR en verde.
- [x] 8.3 (parcial: se cumple al fusionar #69; `polish-pre-deploy-cleanup` y `add-ai-foundation` ya están archivados en `main`; este change lo archiva la sesión principal tras el merge) Archivar `polish-pre-deploy-cleanup`, `add-ai-foundation` y `prepare-deploy-1-0-0`, en ese orden, antes del deploy (D11). **Verificación:** `ls openspec/changes` muestra solo `archive/`.
