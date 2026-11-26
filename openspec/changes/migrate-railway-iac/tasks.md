# Tasks — migrate-railway-iac

> Referencias: `proposal.md`, `design.md` (D1–D10; P1–P5 resueltas por el owner el 2026-11-25, todas con la opción A) y el delta `specs/deployment-infrastructure/spec.md`.
>
> **Orden:** 1 → 2 → 3 → 4 → 5, y el grupo 6 lo ejecuta el owner en el deploy. La rama sale de `main`. Cada grupo de código va en el mismo commit que su test.
>
> **Sin red hacia Railway:** ninguna tarea de 1 a 5 ejecuta `railway config plan` o `apply`, usa un token de Railway ni llama a su API. Solo `npm ci` contra el registro de npm.
>
> **Condicionales:** las tareas marcadas **(P2)** dependen de esa pregunta del `design.md`. Si el owner elige otra opción, se ajusta el valor esperado y se anota en la tarea.

## 1. Paquete y archivo de IaC (`.railway/`)

- [x] 1.1 Crear `.railway/package.json`:
  - `name: portfolio-railway-iac`, `private: true`, `type: module`, `engines.node: 22.x`;
  - devDependencies exactas: `railway` **3.17.0**, `typescript` **5.9.3** y `@types/node` de la línea 22;
  - scripts `typecheck` (`tsc --noEmit -p tsconfig.json`) y `test` (`node --test --experimental-strip-types`).

  Generar el `package-lock.json` con `npm install` dentro de `.railway/` (D2). **Verificación:** `npm ci --prefix .railway` termina con código 0; `git status` no muestra `.railway/node_modules`; `backend/package*.json` y `frontend/package*.json` sin cambios.
- [x] 1.2 Crear `.railway/tsconfig.json`: `strict`, `module` y `moduleResolution` en `nodenext`, `target: es2023`, `noEmit`, `allowImportingTsExtensions`, `erasableSyntaxOnly`, `verbatimModuleSyntax`, `types: ["node"]` e `include` de `*.ts`. **Verificación:** `npm run typecheck --prefix .railway` sin errores.
- [x] 1.3 Escribir `.railway/railway.ts` según D3 y D4:
  - constantes `REPO`, `SITE_DOMAIN`, `API_NAME` y `API_PORT`;
  - `postgres("Postgres")`;
  - `api` y `web` con las claves exactas de la tabla «Cada ajuste: dónde queda»;
  - `JWT_SECRET` y `ANALYTICS_SALT` con `preserve()`;
  - el dominio con `port: 8080`;
  - `project("portfolio-msaavedra", { resources: [db, api, web] })`.

  Sin UUIDs, sin dominios generados y sin las variables prohibidas de D3. **Verificación:** typecheck en verde y revisión del diff contra la tabla de `design.md` (cada fila presente con su clave).
- [x] 1.4 Escribir `.railway/README.md` (corto): qué es el archivo, la versión mínima de la CLI (5.49.1; probada con 5.75.0) y los comandos `npm ci --prefix .railway`, `railway config plan` y `railway config apply`.
  - Reglas: nunca `--yes` ni `--confirm-destructive` sin revisar el plan; no aplicar con el Public Access de Postgres encendido; un artefacto de `--out` va fuera de `.railway/`.
  - Remite a `docs/DEPLOY-RAILWAY.md`.

  **Verificación:** lectura; ningún comando del README llama a la API sin que lo ejecute el owner.

## 2. Test de coherencia (`.railway/railway.test.ts`)

- [x] 2.1 Test con `node:test` y `node:assert/strict`, según D8: importa `./railway.ts` y ejecuta el programa con `createRailwayContext({ environment: "production" })` y `project` de `railway/iac`. Cubre los escenarios de los requisitos *Infraestructura de Railway declarada como código*, *Comandos de api alineados*, *Ajustes de despliegue*, *Proxy, dominio y base* y *Secretos fuera del archivo*:
  - lee `../backend/package.json`, `../frontend/<dockerfilePath>` y `../frontend/Caddyfile` con rutas relativas a `import.meta.url`;
  - busca `railway.json` y `railway.toml` en la raíz, `backend/` y `frontend/`.

  **Verificación:** `npm test --prefix .railway` en verde.
- [x] 2.2 **(P2)** Assert de la imagen de `database.Postgres`: `:18` con la recomendación A. **Verificación:** se cambia a mano la etiqueta esperada a `:17` y el test falla; después se restaura.
- [x] 2.3 Pruebas negativas, hechas a mano y **sin commitear**:
  - renombrar `prisma:deploy` en una copia del `package.json` leído;
  - agregar `ADMIN_PASSWORD: "x"` a `api`;
  - cambiar `API_PORT` a 3000 sin tocar `API_ORIGIN`;
  - escribir `https://x.up.railway.app` en un comentario.

  **Verificación:** cada caso hace fallar el test con un mensaje que nombra el campo y no imprime valores. Anotar los cuatro resultados en `verification/10-negativos.txt`.

## 3. CI (`.github/workflows/ci.yml`)

- [x] 3.1 Job `railway-iac` (nombre visible «Infra · IaC de Railway (sin red)»), según D9:
  - `runs-on: ubuntu-24.04`, `defaults.run.working-directory: .railway`;
  - `actions/checkout@v7`;
  - `actions/setup-node@v7` con `node-version: ${{ env.NODE_VERSION }}`, `cache: npm` y `cache-dependency-path: .railway/package-lock.json`;
  - `npm ci`, `npm run typecheck` y `npm test`;
  - sin `secrets.*` ni `env` de Railway, y actualizar el comentario de cabecera del workflow.

  **Verificación:** el CI del PR muestra el job en verde; `grep -n "RAILWAY_TOKEN\|railway config" .github/workflows/ci.yml` no devuelve nada.

## 4. Borrar Config as Code

- [x] 4.1 `git rm backend/railway.json frontend/railway.json`. **Verificación:** el test 2.1 («Sin Config as Code») sigue en verde; `grep -rn "railway.json" --exclude-dir=archive --exclude-dir=node_modules .` solo devuelve menciones históricas en `docs/CHANGELOG.md` y la explicación de la deprecación en las guías.

## 5. Documentación

- [x] 5.1 `docs/DEPLOY-RAILWAY.md`:
  - **Encabezado:** la configuración vive en `.railway/railway.ts` y se aplica con `plan` → `apply`; en el panel quedan los backups, el Public Access temporal y la alerta de uso.
  - **Paso 0:**
    - CLI ≥ 5.49.1 (`railway --version`), `railway login` y la app de GitHub de Railway con acceso al repo;
    - `npm ci --prefix .railway`;
    - el repo ya es **público** y `main` tiene required checks (corrige «repo privado»);
    - *Wait for CI* ya va en el archivo.
  - **Paso 2:** `railway init --name portfolio-msaavedra`. Postgres lo crea el `apply` del paso 3. Backups en el panel después del `apply`. La versión mayor es la de P2 (no hace falta anotarla a mano).
  - **Paso 3, reescrito con D5:** `api` vacío, secretos con `$s = New-Secret …` y `railway variable set "K=$s" --skip-deploys`, sellado, `plan`, lo esperado en el plan y el criterio de parada, y `apply`.
    - Tabla de lo que fija el archivo, en lugar de la de `backend/railway.json`. Se quita *Config file path*.
    - Se quitan los ítems de *Wait for CI* y *App Sleeping*: van en el archivo.
    - El bloque `ini` de variables pasa a «lo que declara `railway.ts`», y los secretos a «lo que cargás vos».
  - **Paso 5:** `web` ya lo creó el mismo `apply`. Solo queda verificar el proxy y generar el dominio `*.up.railway.app` con `railway domain --service web`. Comprobar que un `plan` posterior no propone cambios.
  - **Paso 6:** el dominio ya está declarado (D6). Leer el `CNAME` y el `TXT` con `railway domain status mjsaavedra.is-a.dev --service web --json` o en el panel.
  - **Tabla nueva «Qué va por IaC, por CLI y por panel»:** la de `design.md`, sin la columna de fuentes.
  - **«Opcionales»** (IA y GitHub): cada variable nueva entra en `railway.ts` por PR (literal o `preserve()`); el secreto se carga antes con `--skip-deploys`; después `plan` → `apply` (D7).
  - **«Deploys siguientes»:** «¿Cambia una variable?» pasa a ser un PR a `railway.ts` y `plan` → `apply` antes de fusionar el código que la necesita.
  - **«Cambiar de dominio»:** PR a `SITE_DOMAIN`. Mientras convivan los dos dominios, `domains` lleva ambos.
  - **«Si algo falla»:** la fila de *Config file path* se reemplaza por «el plan no muestra un ajuste → respaldo de la tabla». Se suma «el plan propone quitar un proxy TCP → Public Access quedó encendido».
  - **Checklist de la 1.0.0** (fases 2 y 3): las filas de *Config file path* y *Wait for CI* pasan a «plan revisado, apply hecho y `railway environment config --json` con los ajustes».
  - «Nunca» suma: `railway config apply --yes` o `--confirm-destructive` sin leer el plan, y cambiar una variable solo en el panel.

  **Verificación:** `grep -n "Config file path\|Config-as-code\|railway.json" docs/DEPLOY-RAILWAY.md` solo devuelve la nota de la deprecación; cada comando nuevo figura en la tabla de `design.md` o en las docs citadas ahí.
- [x] 5.2 `docs/DEPLOY.md`: encabezado (línea 7); § 3 «Comandos» (el JSON pasa a un extracto de `railway.ts`) y «Healthcheck»; la fila de `RAILWAY_DEPLOYMENT_DRAINING_SECONDS` (`drainingSeconds` en `railway.ts`); § 4 (la fila de `frontend/railway.json` se reemplaza por `.railway/railway.ts`); § 9.5 (la tabla de archivos y las de `api` y `web` sin *Config file path*, con «lo declara `railway.ts`»). La tabla de variables de `web` suma `PORT=8080` (D4). **Verificación:** `grep -n "railway.json\|Config file path" docs/DEPLOY.md` solo devuelve la nota de la deprecación.
- [x] 5.3 `docs/DEPLOY-ARCHITECTURE.md`:
  - la línea 5 cambia la lista de archivos versionados;
  - la idea «La configuración está en el repo» (línea 75) dice que el panel solo guarda los backups y el Public Access, y la configuración va en `railway.ts`;
  - en la tabla de fallas (línea 290), la fila de Build remite al plan;
  - en el diagrama del § 12, la caja 3 pasa a «`api` vacío, secretos sellados, plan y apply».

  **Verificación:** lectura; los diagramas Mermaid siguen siendo válidos (GitHub los dibuja en la vista previa del PR).
- [x] 5.4 `docs/RELEASE-1.0.0-CHECKLIST.md`:
  - el ítem «Configuración de despliegue versionada» nombra `.railway/railway.ts` y su test;
  - el ítem ⏳ «Config file path» pasa a «Plan revisado y apply de `.railway/railway.ts`» (pasos 2 y 3);
  - el ítem del CI deja de decir que no hay required checks con el repo privado.

  **Verificación:** lectura.
- [x] 5.5 `docs/CHANGELOG.md`: entrada «Update — Noviembre 2026 (`migrate-railway-iac`)» al principio, con el porqué (deprecación y cutoff del 2026-12-01), el archivo, el test, el job del CI, los `railway.json` borrados y las guías. Las entradas viejas no se tocan. **Verificación:** lectura.
- [x] 5.6 `CLAUDE.md`:
  - la línea del roadmap «Deploy 1.0.0» nombra `.railway/railway.ts` (y deja `frontend/Dockerfile` y `frontend/Caddyfile`) en lugar de los dos `railway.json`;
  - se suma una línea `migrate-railway-iac` al roadmap;
  - «Decisiones tomadas → Despliegue» agrega: «configuración como IaC en `.railway/railway.ts` (`railway config plan` → `apply`); Config as Code deprecado; los secretos con `preserve()`».

  **Verificación:** `grep -n "railway.json" CLAUDE.md` no devuelve nada.
- [x] 5.7 **(P2, opción A)** Subir las imágenes de Postgres del CI (`e2e` y `web-quality` en `.github/workflows/ci.yml`) de `postgres:16-alpine` a `postgres:18-alpine`, y en las guías el texto «El CI prueba con Postgres 16». **Verificación:** el CI del PR en verde con las 15 migraciones aplicadas sobre 18 (log del paso de migraciones).

## 6. Primer apply (lo ejecuta el owner; no lo hace la implementación)

- [ ] 6.1 Pasos 0 a 3 de la guía nueva con el orden de D5 (P1). **Verificación:** el `plan` muestra `Postgres` y `web` a crear, `api` a actualizar, ningún cambio en `JWT_SECRET` ni `ANALYTICS_SALT` y `0 to destroy`. Si no, parar.
- [ ] 6.2 Después del `apply`, `railway environment config --json` muestra en `api` `preDeployTimeoutSeconds: 300`, `drainingSeconds: 10`, `healthcheckTimeout: 300`, `sleepApplication: false` y `checkSuites: true`, y en `web` `builder: DOCKERFILE` y `dockerfilePath`. **Verificación:** si falta alguno, aplicar el respaldo de la tabla de `design.md` y anotarlo en `docs/DEPLOY-RAILWAY.md`.
- [ ] 6.3 Primer deploy de `api` y de `web` según «Cómo verificar el deploy»:
  - `api`: `prisma generate` en el build, las 15 migraciones en el pre-deploy, `/health` en verde y «Swagger deshabilitado…» en el log;
  - `web`: el build usa el Dockerfile y `/health` por `web` devuelve JSON.

  **Verificación:** logs del panel.
- [ ] 6.4 Con el dominio generado de `web` creado, `railway config plan` muestra «0 to add, 0 to change, 0 to destroy». **Verificación:** salida del plan.

## 7. Criterios de aceptación (Fase 6, infraestructura)

- [ ] 7.1 `npx -y @fission-ai/openspec@1.14.1 validate migrate-railway-iac --strict` en verde, y `validate --all --strict` sin fallas nuevas respecto de `main`. **Verificación:** salida en `verification/30-openspec-validate.txt`.
- [ ] 7.2 El CI completo en verde, con el job `railway-iac` (y, con P2-A, los e2e sobre Postgres 18). **Verificación:** pestaña *Actions* del PR.
- [ ] 7.3 Ningún archivo de `backend/src`, `frontend/src`, `backend/prisma`, `frontend/Dockerfile` ni `frontend/Caddyfile` cambió. **Verificación:** `git diff --stat main...HEAD`.
