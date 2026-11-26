## ADDED Requirements

### Requirement: Infraestructura de Railway declarada como código
El repositorio SHALL declarar la infraestructura de producción en un único archivo `.railway/railway.ts` que importa de `railway/iac` y exporta `defineRailway`. El programa evaluado MUST producir exactamente tres recursos: la base `Postgres` (helper `postgres`) y los servicios `api` y `web`, con fuente GitHub en la rama `main`, *Wait for CI* activo y Root Directory `backend` y `frontend`.

#### Scenario: Recursos del proyecto
- **WHEN** el test de `.railway/` evalúa el programa con un contexto del entorno `production`
- **THEN** los recursos son `database.Postgres`, `service.api` y `service.web`, y ninguno más

#### Scenario: Fuente y Root Directory
- **WHEN** el test lee la fuente de `api` y de `web`
- **THEN** las dos tienen `branch` igual a `main` y `checkSuites` en `true`, y `rootDirectory` es `backend` en `api` y `frontend` en `web`

#### Scenario: Sin Config as Code
- **WHEN** el test busca `railway.json` y `railway.toml` en la raíz, en `backend/` y en `frontend/`
- **THEN** no encuentra ninguno

### Requirement: Comandos de api alineados con los scripts del backend
El servicio `api` SHALL usar Railpack con el build `npm run prisma:generate && npm run build`, el pre-deploy `npm run prisma:deploy` y el start igual a `scripts["start:prod"]` de `backend/package.json`. Cada `npm run <script>` declarado MUST existir en ese archivo y `prisma:deploy` MUST ser `prisma migrate deploy`.

#### Scenario: Scripts existentes
- **WHEN** el test separa el build y el pre-deploy de `api` en comandos `npm run <script>`
- **THEN** cada script figura en `backend/package.json` y `prisma:deploy` vale `prisma migrate deploy`

#### Scenario: Script renombrado en el backend
- **WHEN** `backend/package.json` deja de tener un script que `railway.ts` usa
- **THEN** el test falla nombrando el script ausente

#### Scenario: Start de producción
- **WHEN** el test compara el start de `api` con `scripts["start:prod"]`
- **THEN** los dos valen `node dist/main`

### Requirement: Ajustes de despliegue de api y web declarados
`api` SHALL declarar el healthcheck `/health` con timeout de 300 s, el timeout de pre-deploy de 300 s, un drenaje mayor que 8 s, el reinicio `ON_FAILURE`, App Sleeping apagado y `watchPatterns` `/backend/**`. `web` SHALL declarar `DOCKERFILE` con un `dockerfilePath` que exista en `frontend/`, el healthcheck `/`, `watchPatterns` `/frontend/**`, el reinicio `ON_FAILURE` y App Sleeping apagado.

#### Scenario: Ajustes de api
- **WHEN** el test lee el deploy de `api`
- **THEN** `healthcheckPath` es `/health`, `healthcheckTimeout` y `preDeployTimeoutSeconds` son 300, `drainingSeconds` es mayor que 8, `restartPolicyType` es `ON_FAILURE` y `sleepApplication` es `false`

#### Scenario: Dockerfile de web
- **WHEN** el test resuelve `frontend/<dockerfilePath>` de `web`
- **THEN** el archivo existe y el builder es `DOCKERFILE`

#### Scenario: Redeploy selectivo
- **WHEN** el test lee los `watchPatterns` de los dos servicios
- **THEN** `api` tiene solo `/backend/**` y `web` solo `/frontend/**`

### Requirement: Proxy, dominio y base coherentes entre servicios
`API_ORIGIN` de `web` SHALL ser `http://<nombre de api>.railway.internal:<PORT de api>`. `FRONTEND_URL` de `api` SHALL ser `https://` más el dominio propio declarado en `web`, sin barra ni ruta. `DATABASE_URL` de `api` SHALL referenciar la salida `DATABASE_URL` de `Postgres`, y `web` SHALL fijar `PORT` igual al puerto de su dominio.

#### Scenario: API_ORIGIN derivado
- **WHEN** el test compara `API_ORIGIN` de `web` con el nombre y el `PORT` de `api`
- **THEN** vale `http://api.railway.internal:8080`

#### Scenario: Origen del sitio
- **WHEN** el test compara `FRONTEND_URL` con el dominio de `web`
- **THEN** vale `https://mjsaavedra.is-a.dev` y `new URL(FRONTEND_URL).origin` es igual al valor

#### Scenario: Referencia a la base
- **WHEN** el test lee `DATABASE_URL` de `api`
- **THEN** es una referencia al recurso `database.Postgres` con salida `DATABASE_URL`, no un literal

### Requirement: Secretos fuera del archivo de IaC
`JWT_SECRET` y `ANALYTICS_SALT` SHALL declararse con `preserve()`. Ninguna variable secreta (`JWT_SECRET`, `ANALYTICS_SALT`, `INTEGRATIONS_KEYS`, `GITHUB_SYNC_TOKEN`, `ANTHROPIC_API_KEY`) MUST ser un literal. `ADMIN_*`, `SEED_ALLOW_PRODUCTION`, `ENABLE_API_DOCS` y `AI_EVAL_*` MUST NOT figurar. El texto de `railway.ts` MUST NOT contener UUIDs ni dominios `up.railway.app`.

#### Scenario: Secretos preservados
- **WHEN** el test lee las variables de `api`
- **THEN** `JWT_SECRET` y `ANALYTICS_SALT` son de tipo `preserve` y ninguna variable secreta es literal

#### Scenario: Variable prohibida
- **WHEN** `railway.ts` declara `ADMIN_PASSWORD` o `SEED_ALLOW_PRODUCTION` en cualquier servicio
- **THEN** el test falla nombrando la variable, sin imprimir su valor

#### Scenario: Identificadores generados
- **WHEN** el test busca en el texto de `railway.ts` un UUID o la cadena `up.railway.app`
- **THEN** no encuentra ninguno

### Requirement: Versión de Postgres fijada y verificada
La imagen de la base `Postgres` SHALL tener la versión mayor que decidió el owner (P2 del design), y el test MUST fallar si una actualización del paquete `railway` cambia la imagen por defecto del helper.

#### Scenario: Imagen de la base
- **WHEN** el test lee la imagen de `database.Postgres`
- **THEN** termina en la etiqueta de la versión mayor decidida (`:18` con la recomendación A de P2)

### Requirement: Check de IaC en el CI sin red hacia Railway
El CI SHALL correr en cada push y PR a `main` un job que instala las dependencias de `.railway/` con `npm ci`, hace el typecheck de `railway.ts` y ejecuta su test. El job MUST NOT usar un token de Railway ni ejecutar `railway config plan` o `apply`.

#### Scenario: Job verde
- **WHEN** corre el job `railway-iac` sobre un `railway.ts` coherente con el repo
- **THEN** `npm run typecheck` y `npm test` terminan con código 0

#### Scenario: Sin credenciales de Railway
- **WHEN** se inspecciona el job `railway-iac` en `.github/workflows/ci.yml`
- **THEN** no referencia `RAILWAY_TOKEN` ni ningún secreto, y no invoca la CLI de Railway
