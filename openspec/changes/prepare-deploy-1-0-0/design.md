# Design — prepare-deploy-1-0-0

## Context

La 1.0.0 se despliega en Railway con tres servicios (`api`, `Postgres` y `web`, con Caddy como proxy de `/api`). El deploy lo hace el owner a mano siguiendo `docs/DEPLOY-RAILWAY.md`. La revisión del 2026-11-18 cruzó esa guía, `docs/DEPLOY.md` y `docs/DEPLOY-ARCHITECTURE.md` con el código de `feat/ai-foundation` y encontró 28 discrepancias (R1–R28; la tabla está al final). Lo que la revisión verificó **sin** discrepancias no se toca:

- `X-Forwarded-Proto` fijado por Caddy y la redirección a https sin bucle en el healthcheck.
- `trust proxy 1` con `X-Forwarded-For` tomado de `X-Real-IP`.
- `/health` fuera de `/api`.
- Un `preDeployCommand` que solo migra.
- Node 22 en `engines`, el CI y el Dockerfile.
- El scheduler apagado por defecto y `drainingSeconds: 10`.
- La escucha en `::`.
- La cookie `Secure` en producción y Swagger cerrado.

Decisiones del owner del 2026-11-18 sobre la revisión:

- **P1.** La 1.0.0 sale con `add-ai-foundation` fusionado: 15 migraciones.
- **P2.** Sin servicio cron para `job-postings:purge`: purga perezosa más una corrida mensual a mano. Evaluar el modo simulación.
- **P3.** Spend limit de 12 USD para el workspace `portfolio-app` y de 5 USD para `portfolio-evals`.
- **P4.** Endurecer antes del deploy:
  - `ANALYTICS_SALT` obligatoria en producción.
  - `FRONTEND_URL` sin barra ni ruta.
  - `admin:bootstrap` sin la contraseña de ejemplo en producción.
  - Otros endurecimientos baratos, propuestos como no bloqueantes.
- **P5 y P6.** Con la recomendación del arquitecto:
  - Wait for CI, si el panel lo ofrece.
  - GitHub e IA después de un deploy estable, con 2 o más repositorios cargados.

## Goals / Non-Goals

**Goals:**

1. Que el arranque en producción falle ante las tres configuraciones inseguras que hoy pasan.
2. Que seguir la guía al pie de la letra produzca un deploy correcto.
3. Un checklist de una página con criterio de verificación y vuelta atrás.

**Non-Goals:**

- Desplegar.
- Agregar servicios a Railway.
- Cambiar la configuración versionada de Railway, Caddy o el Dockerfile.
- Tocar el frontend.
- Agregar casos al manual.

## Decisions

### D1 — `ANALYTICS_SALT` obligatoria solo con `NODE_ENV=production`

`productionIssues` suma: si `ANALYTICS_SALT` falta o está vacía, el mensaje es «ANALYTICS_SALT: obligatoria en producción (generá una con openssl rand -base64 32)». Sigue la regla vigente de que sea distinta de `JWT_SECRET`. Fuera de producción conserva el default `JWT_SECRET` (`configuration.ts:85`), así no cambian el desarrollo, los tests ni `.env.example`.

- *Descartada:* obligatoria en todos los entornos. Obligaría a tocar todos los `.env` locales y las fixtures de los e2e para un riesgo que solo existe en producción.
- *Descartada:* solo un aviso en el log. Nadie lo lee en el primer deploy, y la guía ya da la variable por obligatoria.

### D2 — `FRONTEND_URL` es un origen, en todos los entornos

La regla nueva, en `validateEnv` y fuera de `productionIssues`: `new URL(valor).origin === valor`. Eso rechaza una barra final, una ruta, query, fragmento, usuario o contraseña, y mayúsculas en el host (el origen se normaliza en minúsculas). El mensaje es «FRONTEND_URL: tiene que ser un origen, sin barra final ni ruta (p. ej. https://mjsaavedra.is-a.dev)» y no repite el valor. Va en todos los entornos porque CORS compara el origen **exacto** también en desarrollo (`cors.options.ts:16`) y las URLs del sitemap y del head se arman concatenando.

- *Descartada:* normalizar en silencio (quitar la barra). Ocultaría un error de configuración, y una ruta (`https://x.dev/portfolio`) no tiene una normalización correcta.
- *Descartada:* solo en producción. El defecto de CORS se vería recién en el deploy.

### D3 — `admin:bootstrap` rechaza la contraseña de ejemplo en producción

Con `NODE_ENV=production` y `ADMIN_PASSWORD` igual a `cambiar-en-primer-arranque`, el script sale con 1 antes de conectarse a la base, con el mensaje «ADMIN_PASSWORD es el valor de ejemplo de .env.example: en producción no se acepta». Fuera de producción conserva el aviso actual, porque el `.env` local de desarrollo nace con ese valor. La regla se extrae a una función pura en `scripts/lib/bootstrap-admin.ts` para probarla sin base.

- *Descartada:* rechazarla siempre. Rompería el primer arranque local documentado en `docs/DATA-POPULATION.md` sin ninguna ganancia.

### D4 — Propuesto: `ANALYTICS_SALT` de 32 caracteres o más y distinta del keyring, en producción

Ambas reglas son baratas y siguen el criterio del `JWT_SECRET`. La guía genera la sal con 32 bytes en base64 (44 caracteres), y una clave del keyring tiene el mismo formato: copiar la sal como clave es un error plausible. El mensaje nombra la variable sin el valor. **Sujeto a P1** (no bloqueante): si el owner lo rechaza, se quitan del delta y de la tarea 1.3 sin afectar al resto.

- *Descartada:* exigir 32 también fuera de producción. Es el mismo argumento que en D1.

### D5 — Propuesto: el bootstrap exige 12 caracteres o más en producción

Hoy `admin:bootstrap` acepta 8 y el cambio de contraseña desde **Cuenta** exige de 12 a 256. La guía ya pide al menos 12. Con la regla, la contraseña de recuperación no puede ser más débil que la del panel. Fuera de producción sigue el mínimo de 8. **Sujeto a P2** (no bloqueante).

### D6 — `job-postings:purge` simula por defecto (recomendado)

Hoy escribe directo. `views:reclassify`, `ai-runs:purge` e `integrations:rekey` simulan por defecto y escriben con `-- --apply`. La purga corre a mano contra producción desde la PC (D7), y con el mismo gesto en los cuatro comandos se evita borrar descripciones por error.

- Sin `--apply` imprime «Vacantes que se purgarían (simulación; usá --apply): N» y no escribe.
- Con `--apply` imprime «Vacantes purgadas: N».
- Los códigos de salida no cambian (0 ok, 1 error de base).
- La purga perezosa no cambia.

**Sujeto a P3** (no bloqueante; recomendado): si el owner prefiere dejarlo como está, se quitan el delta de `job-posting-intake` y el grupo 3 de tareas.

- *Descartada:* dejarlo como está. La única diferencia es una palabra más al correrlo, y la inconsistencia ya generó el caso «¿este escribe o simula?» en la revisión.

### D7 — Sin cron: purga perezosa más una corrida mensual

Decisión del owner (P2). La tabla de Operación de `DEPLOY-RAILWAY.md` suma dos filas:

- «mes · `npm run job-postings:purge` (simulación y `-- --apply`) desde la PC con `DATABASE_PUBLIC_URL`».
- «mes, desde mayo de 2027 · `npm run ai-runs:purge`», que no tiene purga perezosa.

`CLAUDE.md` deja de listar el cron de Railway entre los pendientes.

### D8 — Las 15 migraciones en las tres guías

Las 15 van en orden, con su tipo:

- **Destructivas:** `retire_accent_color` y `retire_featured_repository_stars`.
- **De datos:** `localize_language_level` y `order_repositories_section` (idempotente; inocua sobre la base vacía).
- **Aditivas:** las demás (`add_ai_foundation` incluida).

El criterio del paso del pre-deploy pasa a ser «15 migraciones» y el diagrama de `DEPLOY-ARCHITECTURE.md:410` cambia igual.

### D9 — El renombre de los servicios es el primer paso

En los pasos 3 y 5 de la guía, el primer ítem es «Settings → Service Name: `api`» (o `web`). Le sigue una línea que explica que el primer deploy automático al crear el servicio falla y que es esperable (R22).

### D10 — `FRONTEND_URL` con el dominio final desde el primer deploy

Con el proxy, `FRONTEND_URL` solo da forma al `canonical`, `og:*`, sitemap, robots y JSON Resume; CORS no interviene en un mismo origen. Poner `https://mjsaavedra.is-a.dev` desde el paso 3 es inocuo antes del lanzamiento y evita un redeploy. El paso 6 pasa a ser solo verificación (R6 y R28).

### D11 — Precondición de OpenSpec

Antes del deploy, `openspec/changes/` contiene solo `archive/`. Para eso se archivan `polish-pre-deploy-cleanup`, `add-ai-foundation` y este change, en ese orden. El paso 0 de la guía lo dice así, con los tres nombres, y el `RELEASE-1.0.0-CHECKLIST.md` suma el ítem.

### D12 — Railway, IA y GitHub

- **Wait for CI:** ítem de los pasos 3 y 5, «si el panel lo ofrece», con la nota de que es el único freno posible mientras el repo siga privado sin *required checks*.
- **Spend limits:** 12 USD en `portfolio-app` y 5 USD en `portfolio-evals`, como valores decididos y no «p. ej.».
- **Orden:** GitHub e IA en una fase «Opcionales, con el sitio estable». GitHub además exige 2 o más repositorios cargados en `/admin/proyectos`; recién entonces se ejecutan TC-52 y TC-54 contra los servicios reales.
- **Secretos:** marcar como *sealed* los secretos del servicio `api`, si el panel lo ofrece.

### D13 — El checklist va al final de `DEPLOY-RAILWAY.md`

La sección final es «Checklist de la 1.0.0»: una tabla por fase (antes, servicios, variables, primer deploy, datos iniciales y respaldo cero, dominio, verificación, opcionales, después) con enlaces a los pasos numerados, el criterio de verificación y el plan de vuelta atrás. No va en un archivo nuevo: ya existen `DEPLOY-RAILWAY.md` (pasos), `DEPLOY.md` (referencia), `DEPLOY-ARCHITECTURE.md` (por qué) y `RELEASE-1.0.0-CHECKLIST.md` (gate del release), y un quinto documento repetiría contenido. La tabla completa de variables por servicio (nombre, servicio, obligatoria, default, secreto, cómo generarla) vive en `DEPLOY.md` § 3 y el checklist la enlaza.

## Risks / Trade-offs

- **Un `FRONTEND_URL` local con barra deja de arrancar.** El mensaje nombra la variable y da el ejemplo; `.env.example` ya está sin barra.
- **e2e en modo producción sin `ANALYTICS_SALT`.** Fallarían; la tarea 1.4 los ajusta en el mismo commit.
- **Las reglas propuestas (D4, D5) podrían no aceptarse.** Están aisladas en escenarios y tareas propias para quitarlas sin rehacer el resto.
- **Las opciones del panel de Railway** (Wait for CI, sealed variables, backups en Hobby) no se pueden verificar desde el repo. La guía las marca «si el panel lo ofrece» y da la alternativa: el `.dump` propio como único respaldo.

## Migration Plan

1. Fusionar #68. Fusionar este change (código, tests y docs).
2. Archivar `polish-pre-deploy-cleanup`, `add-ai-foundation` y `prepare-deploy-1-0-0`.
3. El owner sigue `DEPLOY-RAILWAY.md`, con `ANALYTICS_SALT` en el servicio `api` desde el paso 3.

**Vuelta atrás:** revertir el commit del código. Las reglas nuevas solo agregan rechazos al arranque y no hay datos que migrar.

## Open Questions

- **P1 [no bloqueante]** ¿Se suman en producción `ANALYTICS_SALT` de 32 caracteres o más y distinta de toda clave del keyring (D4)?
  - A) Sí.
  - B) No, alcanza con que sea obligatoria.
  - **Recomiendo A.**
- **P2 [no bloqueante]** ¿El bootstrap exige 12 caracteres o más en producción (D5)?
  - A) Sí, igual que **Cuenta**.
  - B) No, sigue en 8.
  - **Recomiendo A.**
- **P3 [no bloqueante]** ¿`job-postings:purge` simula por defecto y escribe con `-- --apply` (D6)?
  - A) Sí, como los otros tres comandos.
  - B) No, sigue escribiendo directo.
  - **Recomiendo A.**

## Discrepancias de la revisión (R1–R28) y dónde se corrigen

| R | Resumen | Tarea |
|---|---|---|
| R1 | 8 migraciones en vez de 15; faltan una destructiva y una de datos | 4.1, 5.1, 6.1 |
| R2 | Falta renombrar los servicios a `api`/`web` | 4.2 |
| R3 | Precondición de OpenSpec que hoy no se cumple | 4.3, 7.1 |
| R4 | Variables de IA (y de integraciones en el mapa) sin documentar | 5.2, 6.2 |
| R5 | `ANALYTICS_SALT` presentada como obligatoria sin serlo | 1.1, 4.4, 5.3 |
| R6 | `FRONTEND_URL` provisorio de un servicio que no existe | 4.5 |
| R7 | `integrations:rekey` sin el keyring en la terminal | 4.6, 5.4 |
| R8 | `railway run` en `views:reclassify` | 5.5 |
| R9 | `job-postings:purge` sin programación ni aviso de que escribe | 3.x, 4.7 |
| R10 | El CI no frena el deploy; Wait for CI | 4.8 |
| R11 | La IA dice que su migración corre al encenderla | 4.9 |
| R12 | No se verifican los atributos de la cookie | 4.10 |
| R13 | Qué pasa si falta `NODE_ENV` | 4.4, 5.2 |
| R14 | Backups en Hobby sin verificar | 4.11 |
| R15 | Spend limit de la app (12 USD) | 4.9 |
| R16 | `integrations:sync` desde la PC pide todo el entorno | 4.6, 5.4 |
| R17 | `VITE_API_URL=` vacía innecesaria | 4.12, 5.6 |
| R18 | Imágenes del Dockerfile citadas sin versión | 5.6 |
| R19 | Versión de Postgres del CI (16) contra la de Railway | 4.13 |
| R20 | `sslmode` de `DATABASE_PUBLIC_URL` | 4.13, 5.7 |
| R21 | El bootstrap acepta el placeholder | 2.x, 4.14 |
| R22 | Primer deploy automático que falla | 4.2 |
| R23 | `ai-runs:purge` sin cadencia | 4.7 |
| R24 | GitHub sin repositorios que verificar | 4.15 |
| R25 | Clave del keyring igual a la sal | 1.3, 4.6 |
| R26 | Secretos sin sellar | 4.8 |
| R27 | `RELEASE-1.0.0-CHECKLIST.md` sin IA ni purgas | 7.1 |
| R28 | Paso 6 redundante con `FRONTEND_URL` | 4.5 |
