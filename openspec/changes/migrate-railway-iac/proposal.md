# migrate-railway-iac — La configuración de Railway pasa a IaC versionado (`.railway/railway.ts`)

> Change previo al deploy 1.0.0 (roadmap: «Deploy 1.0.0 — Railway» de `CLAUDE.md`; materializa la parte de infraestructura de la **Fase 6** de `docs/SPECS-POR-FASE.md`, «Hardening para producción (release 1.0.0)»). Decisión del owner del 2026-11-25: migrar a Infrastructure as Code con `railway config plan` → revisión → `railway config apply`.

## Why

El deploy 1.0.0 todavía no se hizo, y la guía (`docs/DEPLOY-RAILWAY.md`, pasos 3 y 5) se apoya en **Config as Code**: cada servicio apunta con *Config file path* a `/backend/railway.json` o `/frontend/railway.json`. Railway lo deprecó:

- «Config as Code is deprecated» y «New services cannot opt into Config as Code» (<https://docs.railway.com/config-as-code>).
- «Existing Config as Code files stop being read on 2026-12-01 (hard cutoff)» (misma página).
- El reemplazo es IaC: un archivo `.railway/railway.ts` que la CLI evalúa y aplica con `railway config plan` / `railway config apply` (<https://docs.railway.com/infrastructure-as-code>, <https://docs.railway.com/cli/config>).

Los servicios `api` y `web` van a ser **nuevos**, así que los pasos 3 y 5 ya no funcionan: Railway no leería los `railway.json` y el build de `api` saldría sin `prisma generate`, sin pre-deploy y sin healthcheck. Sin este change, el owner tendría que cargar a mano en el panel lo que hoy está versionado, y la configuración dejaría de estar en el repo.

## What Changes

- **Nuevo `.railway/railway.ts`** (TypeScript, `import … from "railway/iac"`): declara el proyecto completo de producción, sin UUIDs, sin dominios generados y sin secretos:
  - `postgres("Postgres")` — el nombre se conserva porque toda la documentación usa `${{Postgres.DATABASE_URL}}`.
  - Servicio `api`: fuente GitHub del repo en `main` con *Wait for CI* (`checkSuites`), `rootDirectory: "backend"`, Railpack, build, pre-deploy, start, healthcheck, timeouts, drenaje, reinicio, sin App Sleeping y las variables **no secretas** de `DEPLOY-RAILWAY.md` § 3. `JWT_SECRET` y `ANALYTICS_SALT` con `preserve()`.
  - Servicio `web`: `rootDirectory: "frontend"`, `DOCKERFILE`, `watchPatterns`, healthcheck `/`, `PORT=8080`, `API_ORIGIN` derivado del nombre y el puerto de `api`, y el dominio `mjsaavedra.is-a.dev` (D6).
- **Paquete propio en `.railway/`** (`package.json`, `package-lock.json`, `tsconfig.json`): `railway` fijado a una versión exacta, más `typescript` y `@types/node` para el typecheck. No toca `backend/` ni `frontend/` (D2).
- **Test de coherencia sin red** (`.railway/railway.test.ts`, con `node --test`): evalúa el programa de IaC en memoria y comprueba que los comandos existen en `backend/package.json`, que `API_ORIGIN` coincide con `api`, que los secretos son `preserve()`, que no hay UUIDs ni dominios `*.up.railway.app`, que no quedan `railway.json`/`railway.toml` y la versión mayor de Postgres (D8).
- **Job nuevo del CI `railway-iac`**: `npm ci`, typecheck y el test de `.railway/`. **Nunca** llama a la API de Railway (D9).
- **Se borran `backend/railway.json` y `frontend/railway.json`.**
- **Guías reescritas**: `docs/DEPLOY-RAILWAY.md` (pasos 0, 2, 3 y 5 con CLI + IaC; sin *Config file path*; tabla de lo que queda en el panel), `docs/DEPLOY.md` (§ 3, § 4 y § 9.5), `docs/DEPLOY-ARCHITECTURE.md`, `docs/RELEASE-1.0.0-CHECKLIST.md`, `docs/CHANGELOG.md` y `CLAUDE.md` (roadmap y «Decisiones tomadas → Despliegue»).

## Non-goals

- **No se despliega ni se aplica nada.** Ni este change ni su implementación ejecutan `railway config plan` ni `apply` ni llaman a la API de Railway: lo hace el owner con su CLI (5.75.0), siguiendo la guía.
- **Sin GitHub Action `railwayapp/config`** (plan en PR / apply al fusionar): queda fuera, sin token de Railway en los secretos del repo (D10, P3).
- Sin cambios en `frontend/Dockerfile`, `frontend/Caddyfile`, el código de `backend/src` ni `frontend/src`.
- Sin entornos adicionales (staging, PR environments): solo `production`.
- Los backups de Postgres, la alerta de uso y la versión de la base se siguen mirando en el panel; los backups no tienen representación en IaC.
- Sin caso nuevo en `docs/MANUAL.md`: el manual cubre el uso de la plataforma; esto es despliegue, cubierto por el test de `.railway/` y la guía. **TC-55 sigue libre.**

## Capabilities

### New Capabilities

- `deployment-infrastructure`: la infraestructura de producción en Railway declarada como código (`.railway/railway.ts`), coherente con los scripts del backend y el proxy de `web`, sin secretos ni identificadores generados, y verificada en el CI sin red hacia Railway.

### Modified Capabilities

Ninguna. Ningún requisito vigente de `openspec/specs/` describe la configuración del proveedor (los `railway.json` nunca tuvieron spec).

## Impact

- **Archivos nuevos:** `.railway/railway.ts`, `.railway/railway.test.ts`, `.railway/package.json`, `.railway/package-lock.json`, `.railway/tsconfig.json`, `.railway/README.md`.
- **Archivos borrados:** `backend/railway.json`, `frontend/railway.json`.
- **CI:** `.github/workflows/ci.yml` suma el job `railway-iac` (Ubuntu 24.04, Node 22). Para que bloquee el merge hay que sumarlo a los *required checks* de `main` (P5, lo hace el owner).
- **Docs:** las seis de *What Changes*.
- **Operación:** desde ahora, **toda** variable o ajuste de `api`, `web` o `Postgres` se cambia en `.railway/railway.ts` (PR) y después `plan` → `apply`. Una variable cargada solo en el panel aparece como borrado en el próximo plan (D7).
- **Dependencias:** solo en `.railway/` (`railway`, `typescript`, `@types/node`); `backend/` y `frontend/` no cambian su `package.json`.
- **Sin migraciones de base, sin cambios de contrato ni de OpenAPI.**
