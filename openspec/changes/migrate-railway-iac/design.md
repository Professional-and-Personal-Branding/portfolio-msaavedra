# Design — migrate-railway-iac

## Context

La 1.0.0 se despliega en Railway con tres servicios en un proyecto (`api`, `web` y `Postgres`). `web` (Caddy) sirve la SPA y hace de proxy de `/api/*`, `/health*`, `/robots.txt` y `/sitemap.xml` hacia `api.railway.internal:8080`. El deploy todavía no se hizo.

La configuración de build y deploy vivía en dos archivos de Config as Code, que la guía conectaba con *Config file path*:

| `backend/railway.json` | `frontend/railway.json` |
|---|---|
| `builder: RAILPACK`, `buildCommand: npm run prisma:generate && npm run build`, `watchPatterns: ["/backend/**"]` | `builder: DOCKERFILE`, `dockerfilePath: Dockerfile`, `watchPatterns: ["/frontend/**"]` |
| `preDeployCommand: ["npm run prisma:deploy"]`, `preDeployTimeoutSeconds: 300`, `startCommand: node dist/main` | `healthcheckPath: /`, `restartPolicyType: ON_FAILURE` |
| `healthcheckPath: /health`, `healthcheckTimeout: 300`, `drainingSeconds: 10`, `restartPolicyType: ON_FAILURE` | |

La guía suma tres ajustes que no estaban en esos archivos y se hacían en el panel: Root Directory (`backend`, `frontend`), *Wait for CI* («si el panel lo ofrece») y *App Sleeping* apagado.

Railway deprecó Config as Code: los servicios nuevos no pueden usarlo y los archivos existentes dejan de leerse el 2026-12-01 (<https://docs.railway.com/config-as-code>). El reemplazo es IaC: `.railway/railway.ts`, evaluado por la CLI, con `railway config plan` y `railway config apply` (<https://docs.railway.com/infrastructure-as-code>). La CLI 5.75.0 ya está instalada en la PC del owner.

### Fuentes verificadas

Se leyeron, sin ejecutar nada, los tipos y el código del paquete npm `railway` en las versiones **3.17.0** y **3.18.0** (`npm pack`, carpeta temporal fuera del repo). Las líneas citadas coinciden en las dos:

- `dist/index-CweUhAOc.d.ts`: `ServiceSource` (L88-98), `BuildConfig` (L119-129), `DeployConfig` (L130-163), `VariableConfig` (L109-118), `IntentServiceConfig` (L367-406), `github()` (L428), `service()` (L432), `postgres()` (L463) y `preserve()` (L478).
- `dist/iac/index.js`: `github()` (L92-97, rama por defecto `main`), `service()` (L147-170), `postgres()` (L223-230, imagen `ghcr.io/railwayapp-templates/postgres-ssl:18`), `preserve()` (L272-274, devuelve `{ type: "preserve" }`), `normalizeBuild` y `normalizeDeploy` (L308-324) y `normalizeNetworking` (L339-343: un dominio sin puerto va al **8080**).
- `README.md` del paquete (L465-534): IaC en beta («The IaC API is in beta and will change»), CLI 5.42.1 o posterior, y «Removing resources or variables is destructive».
- Docs: <https://docs.railway.com/infrastructure-as-code> («omitting a resource means deleting it»; «Sealed variables stay as `preserve()`»; la GitHub Action y el `RAILWAY_TOKEN`; «Fork pull requests are skipped»), <https://docs.railway.com/infrastructure-as-code/reference> (dominios con puerto; «Generated Railway service domains are not included»; las bases gestionadas no necesitan volumen declarado) y <https://docs.railway.com/cli/config> (flags de `plan` y `apply`).
- Skill oficial `use-railway` (`configure.md`, L187-212): rutas de `railway environment edit --service-config`.

**Lo que ninguna fuente documenta** (2026-11-25): qué hace `preserve()` si la variable todavía no existe, si `config apply` dispara un deploy (no hay flag para evitarlo) y si `apply` crea el proyecto. Por eso el primer apply tiene un orden propio (D5, P1).

### Cada ajuste: dónde queda

| Ajuste (servicio) | IaC: clave exacta | Fuente | Si el plan no lo muestra (respaldo) |
|---|---|---|---|
| Root Directory (`api`, `web`) | `rootDirectory` del servicio (va a `source.rootDirectory`) | d.ts L370, L95; index.js L148 | `railway environment edit --service-config <svc> source.rootDirectory backend` |
| Repo y rama | `source: github("<owner>/<repo>", { branch: "main" })` | d.ts L428; index.js L92-97 | `… source.repo <repo>` y `… source.branch main` (skill `setup.md` L205-206) |
| *Wait for CI* | `github(…, { checkSuites: true })` | d.ts L95 | `… source.checkSuites true` (skill `configure.md` L191) |
| Builder `RAILPACK` / `DOCKERFILE` | `build: { builder }` | d.ts L120 | `… build.builder DOCKERFILE` |
| `dockerfilePath` (`web`) | `build: { dockerfilePath: "Dockerfile" }` | d.ts L124 | `… build.dockerfilePath Dockerfile` |
| `watchPatterns` | `build: { watchPatterns: ["/backend/**"] }` | d.ts L121 | `… build.watchPatterns '["/backend/**"]'` |
| Build command (`api`) | `build: { buildCommand }` (con objeto; `build: "…"` solo fija el comando) | d.ts L122; index.js L308-310 | `… build.buildCommand "…"` |
| Pre-deploy (`api`) | `preDeploy: "npm run prisma:deploy"` (se guarda como lista) | d.ts L381; index.js L313-318 | `… deploy.preDeployCommand "npm run prisma:deploy"` |
| Pre-deploy timeout 300 (`api`) | `deploy: { preDeployTimeoutSeconds: 300 }` | d.ts L133 | **panel** (Settings → Deploy): la ruta no figura en el esquema de `environment edit` de la skill |
| Start (`api`) | `start: "node dist/main"` | d.ts L379 | `… deploy.startCommand "node dist/main"` |
| Healthcheck path | `healthcheck: "/health"` (`web`: `"/"`) | d.ts L383 | `… deploy.healthcheckPath /health` |
| Healthcheck timeout 300 (`api`) | `healthcheckTimeout: 300` | d.ts L385, L136 | `… deploy.healthcheckTimeout 300` |
| Drenaje 10 s (`api`) | `deploy: { drainingSeconds: 10 }` | d.ts L160 | **panel**, o la variable `RAILWAY_DEPLOYMENT_DRAINING_SECONDS=10` en `railway.ts` (ya documentada en `DEPLOY.md` § 3) |
| Reinicio `ON_FAILURE` | `deploy: { restartPolicyType: "ON_FAILURE" }` | d.ts L143 | `… deploy.restartPolicyType ON_FAILURE` |
| App Sleeping apagado | `deploy: { sleepApplication: false }` | d.ts L137 | `… deploy.sleepApplication false` |
| Dominio propio (`web`) | `domains: [{ domain: "mjsaavedra.is-a.dev", port: 8080 }]` | d.ts L389-392; reference «domains» | `railway domain mjsaavedra.is-a.dev --service web --port 8080` (skill `configure.md` L254) |
| Variables y referencias | `env: { K: "v", DATABASE_URL: db.env.DATABASE_URL, JWT_SECRET: preserve() }` | d.ts L395, L432-435, L478 | `railway variable set K=v --service <svc>` |
| Sellar un secreto | no expresable junto con `preserve()` | d.ts L277-291 | `railway environment edit --service-config api variables.JWT_SECRET.isSealed true` (skill `configure.md` L212) o panel |
| Backups de Postgres | sin representación en IaC | — | **panel** (pestaña Backups) |
| Versión mayor de Postgres | la fija la imagen del helper: `postgres-ssl:18` | index.js L225 | — (P2) |
| Public Access de Postgres (proxy TCP) | **no se declara** (es a demanda) | d.ts L393-394 | **panel** (Settings → Networking); ver Riesgos |
| Dominio generado `*.up.railway.app` | **no va en el archivo** | reference: «Generated Railway service domains are not included» | `railway domain --service web` |

`railway environment edit` es solo el respaldo: si `config plan --verbose` muestra un campo, manda el archivo. Las rutas de `environment edit` salen del esquema de la skill oficial (`configure.md` L191-212). Ahí no figuran `preDeployTimeoutSeconds` ni `drainingSeconds`, así que para esos dos el respaldo es el panel.

## Goals / Non-Goals

**Goals**

- Los tres servicios y todo lo que estaba en los `railway.json` quedan declarados y versionados en un solo archivo, aplicable con `plan` → revisión → `apply`.
- Ningún secreto, UUID ni dominio generado en el repo.
- Un check del CI barato, sin red hacia Railway, que detecte la deriva entre `railway.ts` y el código: scripts, proxy, dominio y secretos.
- Guías que el owner pueda seguir al pie de la letra con la CLI 5.75.0.

**Non-Goals**

- Aplicar, desplegar o crear el proyecto.
- La GitHub Action de Railway.
- Más entornos que `production`.
- Cambiar el Dockerfile, el Caddyfile o el código de la app.

## Decisions

### D1 — IaC en TypeScript, un solo archivo `.railway/railway.ts`

Se usa el helper de producto (`service`, `postgres`, `github`, `preserve`, `project`, `defineRailway`) de `railway/iac`, sin APIs internas (`EnvironmentConfigPatch`, `customDomains`, `multiRegionConfig`). El archivo es la **fuente única del entorno**, sin *partials*.

- **Alternativa descartada:** Python o Go. Son beta según las docs, y el repo ya es TypeScript.
- **Alternativa descartada:** `railway config migrate` desde los `railway.json`. Sirve para servicios que ya existen; acá no existe ninguno y el archivo se escribe a mano, revisado contra la tabla de arriba.

### D2 — El paquete `railway` vive en `.railway/package.json` propio

`.railway/` tiene su `package.json` (`private: true`, `type: module`, `engines.node: 22.x`), su `package-lock.json` y su `tsconfig.json`. Las dependencias son de desarrollo y con versión exacta:

- `railway`: **3.17.0** (publicada el 2026-11-13). La 3.18.0 salió el mismo 2026-11-25 y se descarta por ahora: sin cambios en los tipos que usamos y sin días de uso. Cambiar de versión se hace en un PR propio que corre el test de D8.
- `typescript`: **5.9.3**, la misma que resuelve `backend`.
- `@types/node`: de la línea 22.

Scripts: `typecheck` (`tsc --noEmit -p tsconfig.json`) y `test` (`node --test --experimental-strip-types`). El `node_modules/` de `.railway/` ya lo ignora el `.gitignore` raíz. La CLI encuentra el paquete al evaluar porque `railway.ts` está en la misma carpeta. El owner corre `npm ci --prefix .railway` antes del primer `plan`.

- **Alternativa descartada:** devDependency en `backend/`. Ensucia el lock del backend, sus auditorías y su imagen de Railpack con un paquete que la API no usa.
- **Alternativa descartada:** un `package.json` en la raíz. El repo no tiene y no es un monorepo con workspaces (decisión de `CLAUDE.md`). Agregarlo cambiaría cómo resuelven `npm` los dos proyectos.

### D3 — `api`: lo mismo que `backend/railway.json`, más lo que estaba en el panel

```ts
const REPO = "Professional-and-Personal-Branding/portfolio-msaavedra";
const SITE_DOMAIN = "mjsaavedra.is-a.dev";
const API_NAME = "api";
const API_PORT = 8080;

const db = postgres("Postgres");

const api = service(API_NAME, {
  source: github(REPO, { branch: "main", checkSuites: true }),
  rootDirectory: "backend",
  build: {
    builder: "RAILPACK",
    buildCommand: "npm run prisma:generate && npm run build",
    watchPatterns: ["/backend/**"],
  },
  preDeploy: "npm run prisma:deploy",
  start: "node dist/main",
  healthcheck: "/health",
  healthcheckTimeout: 300,
  deploy: {
    preDeployTimeoutSeconds: 300,
    drainingSeconds: 10,
    restartPolicyType: "ON_FAILURE",
    sleepApplication: false,
  },
  env: {
    NODE_ENV: "production",
    PORT: String(API_PORT),
    DATABASE_URL: db.env.DATABASE_URL,
    JWT_SECRET: preserve(),
    JWT_EXPIRES_IN: "1d",
    ANALYTICS_SALT: preserve(),
    SESSION_COOKIE_SAMESITE: "strict",
    LOG_LEVEL: "info",
    THROTTLE_TTL: "60",
    THROTTLE_LIMIT: "120",
    THROTTLE_LOGIN_LIMIT: "5",
    FRONTEND_URL: `https://${SITE_DOMAIN}`,
  },
});
```

Este bloque es **ilustrativo**: lo escribe la implementación (tarea 1.3), y el test de D8 manda sobre él.

- `checkSuites: true` lleva *Wait for CI* al archivo. Antes era «si el panel lo ofrece»; hoy `main` está protegida y tiene checks, así que tiene sentido siempre.
- `sleepApplication: false` y `restartPolicyType: "ON_FAILURE"` repiten valores por defecto a propósito. La regla de la skill es no declarar defaults «salvo que el usuario los quiera», y el owner pidió explícitamente App Sleeping apagado; declarados, el plan detecta si alguien los cambia en el panel.
- `INTEGRATIONS_*`, `GITHUB_*`, `AI_*` y `ANTHROPIC_API_KEY` **no se declaran** en la 1.0.0: con sus defaults todo queda apagado. Cuando se enciendan, entran en `railway.ts`: los valores no secretos como literales y los secretos (`INTEGRATIONS_KEYS`, `GITHUB_SYNC_TOKEN`, `ANTHROPIC_API_KEY`) con `preserve()`.
- **Nunca** en el archivo: `ADMIN_*`, `SEED_ALLOW_PRODUCTION`, `ENABLE_API_DOCS` y `AI_EVAL_*` (el test de D8 lo exige).

- **Alternativa descartada:** `build: "npm run …"` (forma corta). Solo fija `buildCommand` (index.js L309) y se pierden `builder` y `watchPatterns`.

### D4 — `web`: Dockerfile, healthcheck `/`, `PORT` explícito y `API_ORIGIN` derivado

```ts
const web = service("web", {
  source: github(REPO, { branch: "main", checkSuites: true }),
  rootDirectory: "frontend",
  build: { builder: "DOCKERFILE", dockerfilePath: "Dockerfile", watchPatterns: ["/frontend/**"] },
  healthcheck: "/",
  deploy: { restartPolicyType: "ON_FAILURE", sleepApplication: false },
  env: {
    PORT: "8080",
    API_ORIGIN: `http://${API_NAME}.railway.internal:${API_PORT}`,
  },
  domains: [{ domain: SITE_DOMAIN, port: 8080 }],
});

return project("portfolio-msaavedra", { resources: [db, api, web] });
```

- `API_ORIGIN` se arma con las mismas constantes que el nombre y el `PORT` de `api`: renombrar uno sin el otro rompe el test, no el proxy en producción.
- `VITE_API_URL` y `CSP_HEADER` **no se definen**, igual que hoy.
- **`PORT=8080` en `web` es nuevo.** Caddy escucha en `{$PORT}` y el dominio propio necesita un puerto destino (el helper usa 8080 si no se indica, index.js L340). Fijarlo hace que el puerto del contenedor y el del dominio no dependan del valor que inyecte Railway.
  - **Alternativa descartada:** no fijarlo y declarar el dominio sin puerto. Funciona solo si Railway inyecta justo 8080, cosa que ninguna fuente garantiza.
- `dockerfilePath: "Dockerfile"` se conserva tal como estaba en `frontend/railway.json`, relativo al Root Directory. Si el primer build no lo encuentra, la tarea 6.3 lo detecta en el log.

### D5 — Primer apply: `api` vacío y secretos sellados antes del `plan`

Como no está documentado qué hace `preserve()` sobre una variable que no existe, ni si `apply` despliega, el orden recomendado deja los secretos cargados **antes** de que `api` tenga fuente:

1. `railway init --name portfolio-msaavedra` (crea y vincula el proyecto, entorno `production`).
2. `railway add --service api --json`: un servicio vacío, sin fuente, así que no despliega.
3. Desde PowerShell, sin que el valor toque el historial ni un archivo: `$s = New-Secret 48`, guardarlo en el gestor de contraseñas, `railway variable set "JWT_SECRET=$s" --service api --skip-deploys` y `Remove-Variable s`. Lo mismo con `ANALYTICS_SALT` (`New-Secret 32`). El historial de PowerShell guarda `$s`, no el valor. No se usa `| … --stdin`: PowerShell agrega un salto de línea al canalizar hacia un ejecutable nativo, y quedaría dentro del secreto.
4. Sellarlos: `railway environment edit --service-config api variables.JWT_SECRET.isSealed true` (y `ANALYTICS_SALT`), o desde el panel.
5. `npm ci --prefix .railway` y `railway config plan` desde la raíz. Lo esperado:
   - crear `Postgres` y `web`;
   - actualizar `api` (fuente, build, deploy y variables no secretas);
   - **sin cambios** en `JWT_SECRET` ni `ANALYTICS_SALT`;
   - **0 to destroy**.
6. Recién entonces `railway config apply`, interactivo, por el owner.

**Criterio de parada:** si el plan propone crear un segundo `api`, borrar algo o tocar los secretos, no se aplica y se vuelve a P1.

Con este orden, el primer deploy de `api` ya tiene sus secretos: no hay un deploy fallido esperable, como en la guía anterior.

- **Alternativa descartada:** aplicar directo y cargar los secretos después. Depende de un comportamiento de `preserve()` no documentado, y el primer deploy de `api` falla seguro por la validación de arranque.
- **Alternativa descartada:** una bandera de entorno en `railway.ts` que omita los secretos en el primer apply. Mete lógica condicional en el archivo de producción para un evento que ocurre una sola vez.

### D6 — El dominio `mjsaavedra.is-a.dev` se declara desde el primer apply

- El PR a `is-a-dev/register` necesita el destino del `CNAME` y el `TXT` de `_railway-verify`, y Railway recién los muestra cuando el dominio está agregado al servicio.
- El archivo es la fuente única del entorno («omitting a resource means deleting it»). Si el dominio se agrega por el panel o la CLI y no está en el archivo, el próximo `apply` arriesga quitarlo.
- Mientras is-a.dev no apruebe, el dominio queda pendiente de verificación. Es inocuo: `FRONTEND_URL` ya lleva el dominio final (decisión D10 de `prepare-deploy-1-0-0`).

`FRONTEND_URL` y `domains` salen de la misma constante `SITE_DOMAIN`. Cambiar de dominio pasa a ser un PR a `.railway/railway.ts` más `plan` → `apply`, sin rebuild de las imágenes (los `watchPatterns` no incluyen `.railway/`).

- **Alternativa descartada:** dejarlo comentado y agregarlo en el paso 6 desde el panel. Crea justo la deriva que el próximo `apply` intentaría borrar.

### D7 — Toda variable o ajuste se cambia en `railway.ts`, nunca solo en el panel

Consecuencia operativa de D1: quitar una variable del archivo la borra («Removing resources or variables is destructive», README L510).

- Encender la IA o GitHub (fase «Opcionales» de la guía) es un PR a `railway.ts` con los literales y los `preserve()`. Los valores secretos se cargan antes, con `railway variable set --stdin --skip-deploys`, y después se hace `plan` → `apply`.
- Excepciones, que no viven en el archivo: los secretos (su valor), los backups, el Public Access temporal de Postgres y los dominios generados.

### D8 — Test de coherencia en `.railway/railway.test.ts`, sin red

El test importa `railway.ts` y ejecuta el programa con `createRailwayContext({ environment: "production" })` y `project`. Son funciones puras del SDK que arman objetos en memoria, sin E/S. Después compara el resultado con el repo:

- Recursos: exactamente `database.Postgres`, `service.api` y `service.web`.
- `api`:
  - cada `npm run <x>` del build y el pre-deploy existe en `backend/package.json`;
  - `prisma:deploy` es `prisma migrate deploy` (nunca `db push`);
  - `start` es igual a `scripts["start:prod"]`;
  - el `PORT` de `api` es el del `API_ORIGIN` de `web`;
  - `preDeployTimeoutSeconds` es 300, `healthcheckTimeout` es 300 y `drainingSeconds` es mayor que 8 (por las integraciones, `DEPLOY-RAILWAY.md` «Operación»).
- `web`:
  - `frontend/<dockerfilePath>` existe;
  - el `Caddyfile` usa `{$PORT}` y `{$API_ORIGIN}`.
- Dominio: `FRONTEND_URL` es `https://` + el dominio de `web`, y es un origen (`new URL(v).origin === v`).
- Referencias: `DATABASE_URL` referencia `database.Postgres` / `DATABASE_URL`.
- Secretos:
  - `JWT_SECRET` y `ANALYTICS_SALT` son `{ type: "preserve" }`;
  - ninguna variable de la lista de secretos (`JWT_SECRET`, `ANALYTICS_SALT`, `INTEGRATIONS_KEYS`, `GITHUB_SYNC_TOKEN`, `ANTHROPIC_API_KEY`) es literal;
  - no aparecen `ADMIN_*`, `SEED_ALLOW_PRODUCTION`, `ENABLE_API_DOCS` ni `AI_EVAL_*`.
- Texto fuente de `railway.ts`: sin UUIDs (`/[0-9a-f]{8}-[0-9a-f]{4}-/i`) y sin `up.railway.app`.
- Sin `railway.json` ni `railway.toml` en la raíz, `backend/` ni `frontend/`.
- La imagen de `database.Postgres` termina en `:18` (o la que decida P2): un cambio de default del SDK al subir de versión no pasa sin verse.
- Fuente: `source.checkSuites === true`, `branch === "main"` y `watchPatterns` `/backend/**` y `/frontend/**`.

Runner: `node --test` con *type stripping* de Node 22, sin dependencias extra. El `tsconfig` usa `allowImportingTsExtensions`, `erasableSyntaxOnly`, `noEmit` y `module: nodenext`.

- **Alternativa descartada:** `railway config plan --detailed-exit-code` en el CI. Necesita un token de Railway y llama a su API (lo prohíbe el encargo y D10).
- **Alternativa descartada:** Vitest o Jest. Agregan dependencias para unos pocos asserts.

### D9 — Job `railway-iac` en el CI

Un job aparte en `.github/workflows/ci.yml` (`ubuntu-24.04`, Node 22, `working-directory: .railway`): checkout, `setup-node` con caché sobre `.railway/package-lock.json`, `npm ci`, `npm run typecheck` y `npm test`. Corre en cada push y PR a `main`, como el resto.

Para que bloquee el merge, el owner lo suma a los *required checks* de `main` (P5).

- **Alternativa descartada:** sumar los pasos al job `backend`. Mezcla responsabilidades y hace que un fallo de infraestructura parezca del backend.

### D10 — Sin la GitHub Action `railwayapp/config` en este change

La Action planifica en los PR y aplica al fusionar. Necesita un *project token* del entorno `production` como secreto `RAILWAY_TOKEN`.

- **Forks.** Según las docs, «Fork pull requests are skipped. They don't receive repository secrets» (`pull_request` no expone secretos a forks).
- **El riesgo real** es que ese token puede **modificar producción**: con un `apply` al fusionar, cualquier workflow con acceso al secreto queda a un error de un cambio destructivo. Los vectores son un `pull_request_target` mal puesto en el futuro, una Action de terceros comprometida o una rama del propio repo.
- **El beneficio es bajo** para un solo operador que corre `plan` a mano antes de cada `apply`.

Queda fuera de este change (P3). Si algún día entra, sería solo `plan` con `--detailed-exit-code` en `push` a `main`, con el token en un *environment* con aprobación, la Action fijada por SHA y sin `apply`.

## Risks / Trade-offs

- **IaC en beta.** «The IaC API is in beta and will change» (README L467) y el formato puede cambiar entre versiones de la CLI. Mitigación: versión exacta del SDK, el test de D8 y la CLI ≥ 5.49.1 (5.75.0 en la PC del owner). Cada subida de versión va en un PR propio.
- **Un campo de los tipos que la CLI no aplique.** Los tipos del SDK declaran `preDeployTimeoutSeconds`, `drainingSeconds`, `sleepApplication` y `checkSuites`, pero no hay garantía documentada de que el compilador de la CLI los traslade. Mitigación:
  - la tarea 6.2 exige verlos en `railway config plan --verbose` y, tras el apply, en `railway environment config --json`;
  - si falta alguno, se usa el respaldo de la tabla de arriba y se anota.
- **`preserve()` sobre una variable inexistente y deploy al aplicar: no documentados.** Mitigación: el orden de D5 y su criterio de parada (P1).
- **Postgres 18 contra el CI en 16.** El helper crea Postgres 18 (index.js L225) y los e2e y `web-quality` corren contra `postgres:16-alpine`. Prisma 6 y las 15 migraciones no se probaron sobre 18 (P2).
- **Public Access temporal.** Encender el proxy TCP de Postgres por el panel (pasos 4, 8 y 9) puede aparecer en el siguiente `plan` como algo a quitar, porque el archivo no lo declara. Regla de la guía: no correr `apply` con Public Access encendido; si el plan propone quitar un proxy TCP, es la señal de que quedó encendido.
- **Dominios generados.** Las docs dicen que no van en el archivo. Se asume que el `plan` los ignora; la tarea 6.4 lo comprueba.
- **Postgres todavía provisionando** cuando corre el primer pre-deploy de `api`. Si `prisma migrate deploy` falla por conexión, se redespliega `api` desde el panel o con `railway redeploy --service api`. La base sigue vacía y no hay riesgo.
- **Cambiar de dominio ahora pide un PR.** Antes era solo configuración del panel. Se acepta: queda revisado y versionado (D6).
- **Sin vuelta atrás a Config as Code.** Tras el 2026-12-01 no se lee, y los servicios nuevos no pueden usarlo. La vuelta atrás es aplicar un `railway.ts` anterior o, en una emergencia, el panel y `environment edit`.

## Migration Plan

1. **Implementación**, sin red hacia Railway: `.railway/`, test, job del CI, borrado de los `railway.json` y guías. CI en verde.
2. **Merge a `main`.** El owner suma `railway-iac` a los required checks (P5).
3. **Deploy por el owner** (guía nueva, pasos 0-5): proyecto, `api` vacío con secretos sellados, `plan`, revisión, `apply`, backups en el panel, seed desde la PC y verificación.
4. **Vuelta atrás** antes de compartir el link: `railway down` o borrar los servicios, corregir `railway.ts` y volver a aplicar. La base se puede vaciar y volver a poblar (paso 4).

## Open Questions

- **P1 [bloqueante para el primer `apply`, no para implementar]** ¿Qué orden se usa en el primer apply, dado que no está documentado qué hace `preserve()` sobre una variable inexistente ni si `apply` despliega?
  - **A.** `api` vacío y secretos sellados antes del `plan`, con el criterio de parada de D5.
  - **B.** `apply` directo, aceptando que el primer deploy de `api` falla, y secretos después con un redeploy.
  - **C.** Una bandera de bootstrap en `railway.ts`.
  - **Recomendación: A.** No depende de lo no documentado, y el `plan` (solo lectura) confirma el comportamiento antes de escribir nada.
- **P2 [bloqueante antes del primer `apply`]** ¿Qué versión mayor de Postgres usa producción? Cambiarla después es una migración mayor con datos.
  - **A.** 18, el default del helper, y en este change subir las imágenes del CI (`e2e` y `web-quality`) a `postgres:18-alpine`, para que las 15 migraciones se prueben sobre la misma versión.
  - **B.** Fijar 16 con `database("Postgres", "postgres", { image: "ghcr.io/railwayapp-templates/postgres-ssl:16", … })`, igual que el CI. Hay que confirmar que esa etiqueta existe, y se aparta del helper recomendado.
  - **C.** 18 sin tocar el CI, aceptando la diferencia que la guía ya anotaba.
  - **Recomendación: A.**
- **P3 [no bloqueante]** ¿Se suma la GitHub Action `railwayapp/config`?
  - **A.** No, por ahora (D10).
  - **B.** Solo `plan` en `push` a `main`, con un token en un *environment* con aprobación, en un change propio.
  - **C.** Plan en PR y apply al fusionar.
  - **Recomendación: A.** Si algún día hace falta, B.
- **P4 [no bloqueante]** ¿El dominio `mjsaavedra.is-a.dev` se declara desde el primer apply (D6)?
  - **A.** Sí, desde el primero.
  - **B.** Comentado y descomentado en un PR chico antes de abrir el PR a is-a.dev.
  - **Recomendación: A.** B también es seguro si el dominio nunca se agrega por fuera del archivo.
- **P5 [no bloqueante]** ¿Se suma el job `railway-iac` a los *required checks* de `main`?
  - **A.** Sí: lo hace el owner en Settings → Branches después del merge.
  - **B.** No: queda informativo.
  - **Recomendación: A.**
