# prepare-deploy-1-0-0 — Endurecimiento de producción y guía de deploy alineada con el código

> Último change antes del primer deploy (1.0.0) en Railway. Sale de la revisión de la guía contra el código del 2026-11-18, que encontró 28 discrepancias (D1–D28 de esa revisión; acá se citan como **R1–R28**), y de las decisiones del owner del mismo día (P1–P6). Se fusiona **después** de `add-ai-foundation` (PR #68) y se archiva, junto con él y con `polish-pre-deploy-cleanup`, **antes** del deploy.

## Why

Las guías de deploy (`docs/DEPLOY-RAILWAY.md`, `docs/DEPLOY.md`, `docs/DEPLOY-ARCHITECTURE.md`) se escribieron cuando la 1.0.0 tenía 8 migraciones. Hoy hay 15, entre ellas una destructiva y otra de datos. Además, las guías no piden renombrar los servicios (el proxy depende de `api.railway.internal`), no documentan las variables de la IA y piden un `FRONTEND_URL` provisorio de un servicio que todavía no existe. El owner va a desplegar a mano, siguiendo la guía al pie de la letra: cada error de la guía es un deploy fallido o, peor, uno que «anda» con una configuración insegura.

Además, tres reglas de seguridad que la guía da por hechas no las aplica el código:

- `ANALYTICS_SALT` es opcional y, si falta, la sal del HMAC de IP es el `JWT_SECRET`.
- `FRONTEND_URL` acepta una barra final o una ruta, y entonces CORS deja de coincidir y las URLs del sitemap salen con `//`.
- `admin:bootstrap` solo avisa si la contraseña es la de `.env.example`, aun en producción.

El owner decidió cerrarlas antes del deploy (P4).

## What Changes

- **Validación de producción** (`backend/src/config/env.validation.ts`):
  - Con `NODE_ENV=production`, `ANALYTICS_SALT` pasa a ser **obligatoria** (D1).
  - `FRONTEND_URL` tiene que ser un **origen** (esquema, host y puerto opcional), sin barra final, ruta, query, fragmento ni credenciales, en todos los entornos (D2).
  - Propuesto, no bloqueante: en producción, `ANALYTICS_SALT` de al menos 32 caracteres y distinta de toda clave del keyring de integraciones (D4, P1).
- **`admin:bootstrap`** (`backend/scripts/bootstrap-admin.ts`):
  - Con `NODE_ENV=production` rechaza la contraseña de ejemplo (sale con 1 y no toca la base) (D3).
  - Propuesto, no bloqueante: en producción exige 12 caracteres o más, como **Cuenta** (D5, P2).
- **`job-postings:purge`**: simulación por defecto y `-- --apply` para escribir, como `views:reclassify` y `ai-runs:purge` (D6; recomendado, P3). Sin servicio cron: purga perezosa más una corrida mensual a mano (D7, decisión del owner).
- **Guías de deploy corregidas** (las 28 discrepancias):
  - Las 15 migraciones con su riesgo (D8).
  - El renombre de los servicios a `api` y `web` como primer paso (D9).
  - `FRONTEND_URL` con el dominio final desde el primer deploy (D10).
  - `integrations:rekey` con el keyring en la terminal.
  - Las variables de IA e integraciones en las tablas.
  - `railway run` eliminado de `views:reclassify`.
  - Spend limits de 12 y 5 USD (D12).
  - Wait for CI, si el panel lo ofrece (D12).
  - GitHub e IA después de un deploy estable (D12).
  - La precondición de OpenSpec ajustada (D11).
- **Checklist de la 1.0.0** como sección final de `docs/DEPLOY-RAILWAY.md`: fases, comandos, criterio de verificación, vuelta atrás y respaldos (D13). La tabla completa de variables por servicio vive en `docs/DEPLOY.md` § 3.
- **`backend/.env.example`**: `ANALYTICS_SALT` descomentada con su regla de producción, `FRONTEND_URL` sin barra y la nota del placeholder del administrador.

## Non-goals

- **No se despliega nada.** El deploy lo hace el owner a mano, siguiendo la guía.
- **Sin servicio cron** para `job-postings:purge` ni para `ai-runs:purge`.
- Sin cambios en `backend/railway.json`, `frontend/railway.json`, `frontend/Dockerfile` ni `frontend/Caddyfile`. La revisión los encontró correctos.
- No se cambia el default `lax` de `SESSION_COOKIE_SAMESITE`: la guía fija `strict` y el paso de verificación nuevo lo comprueba.
- `add-uptime-monitoring` y `add-open-notifications` quedan para después.
- Sin caso nuevo en el manual: lo nuevo son reglas de arranque y de un script de terminal, cubiertas por tests. TC-55 queda libre.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `api-platform`:
  - MODIFIED *Reglas de las variables de sesión y analítica*: `ANALYTICS_SALT` sigue con su valor por defecto solo fuera de producción.
  - MODIFIED *Arranque seguro en producción*: `ANALYTICS_SALT` obligatoria y, propuesto, larga y distinta del keyring.
  - ADDED *FRONTEND_URL es un origen*.
- `admin-authentication`: MODIFIED *Bootstrap del administrador*: contraseña de ejemplo rechazada en producción y, propuesto, longitud mínima de 12.
- `job-posting-intake`: MODIFIED *Texto de la vacante por 90 días*: el comando simula por defecto.

## Impact

- **Backend:**
  - `src/config/env.validation.ts` y su spec.
  - `scripts/bootstrap-admin.ts` (y `scripts/lib/bootstrap-admin.ts` si la regla se extrae para probarla).
  - `scripts/purge-job-posting-text.ts` y `scripts/lib/purge-job-posting-text.ts`, con sus tests.
  - Fixtures de producción de los e2e (`test/e2e-helpers.ts`, `test/auth.e2e-spec.ts`, `test/ai-env.e2e-spec.ts`, `test/integrations-env.e2e-spec.ts`): suman `ANALYTICS_SALT`.
- **CI:** sin cambios esperados. `web-quality` ya genera `ANALYTICS_SALT` con `openssl rand -base64 32` (44 caracteres) y un `FRONTEND_URL` sin barra.
- **Docs:**
  - `docs/DEPLOY-RAILWAY.md`, `docs/DEPLOY.md`, `docs/DEPLOY-ARCHITECTURE.md`, `docs/RELEASE-1.0.0-CHECKLIST.md` y `backend/.env.example`.
  - `docs/MANUAL.md` e `index.html`: la línea 773, que dice que el bootstrap «acepta contraseñas de 8 caracteres o más»; las menciones de `job-postings:purge`.
  - `docs/CHANGELOG.md` y `CLAUDE.md`: los comandos y la línea del roadmap, al archivar.
- **Sin migraciones**, sin cambios de contrato OpenAPI y sin cambios en el frontend.
- **Riesgo de corte:** si la variable `api` de Railway no tuviera `ANALYTICS_SALT`, la API no arrancaría. Es intencional y la guía la pide desde el paso 3. En local no cambia nada salvo un `FRONTEND_URL` con barra, que pasa a dar un error con el nombre de la variable.
