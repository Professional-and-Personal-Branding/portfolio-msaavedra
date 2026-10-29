# classify-profile-views — Separar las visitas de personas, las propias y las de bots

> Primer change de la **Fase 1.2** de `docs/PROPUESTA-FEATURES.md` (§ 6.2, ítem 5.1 de la épica E5). Implementa la decisión **P19 = A** del owner (2026-10-28): **`views` cuenta solo las visitas humanas de terceros y todas las filas se guardan con su `kind`**. No depende de otro change de 1.2; `add-share-links` y `add-open-notifications` (Fase 1.3) se apoyan en él para atribuir y avisar solo las aperturas humanas.

## Why

Cada `200` de `GET /api/curated-profiles/:slug` suma una visita, sin importar quién la hizo. Hoy eso mezcla tres cosas distintas en el mismo número:

1. **Las visitas del owner.** Revisar el propio sitio después de editar desde `/admin` suma visitas. La cookie `portfolio_session` ya llega a la ruta pública: el sitio y la API comparten origen (Caddy en producción, el proxy de Vite en desarrollo) y `frontend/public/profile-prefetch.js` pide el perfil con `credentials: 'include'`. El dato para separarlas está en la petición; solo falta leerlo.
2. **Los bots que ejecutan JavaScript.** Googlebot renderiza la SPA y dispara la misma petición que un navegador. Lo mismo hacen HeadlessChrome y Lighthouse, que hoy usan `print:check`, `a11y:check`, `perf:check` y `manual:capture` (por eso esos scripts exigen una base descartable). LinkedInBot, Slackbot y UptimeRobot no ejecutan JS y la ruta del fragmento de head no cuenta visitas (`public-seo`), así que no ensucian la señal, pero cualquier cliente que llame a la API directo sí lo hace.
3. **Las visitas de terceros**, que son las únicas que importan durante una búsqueda de empleo y las que van a disparar avisos y atribuciones en la Fase 1.3.

El `userAgent` ya se persiste desde la Fase 3, así que las filas existentes se pueden reclasificar sin datos nuevos.

## What Changes

- **`ProfileView.kind`** (enum `ViewKind`: `HUMAN`, `OWNER`, `BOT`), obligatorio, con `HUMAN` por defecto para las filas previas (D1, D4). Migración no destructiva.
- **Clasificación de cada visita (D2, D3, D6).** `OWNER` si la petición trae una sesión de administrador válida (la cookie `portfolio_session` o `Authorization: Bearer`, validada con el mismo secreto, algoritmo y expiración que el guard); si no, `BOT` si el `User-Agent` falta o coincide con la lista versionada; si no, `HUMAN`. La ruta pública **no exige** auth: una sesión ausente, vencida o forjada nunca da 401 ni cambia la respuesta. La validación de la sesión ocurre en la tarea en segundo plano que ya registra la visita, así que la respuesta no espera ni una consulta más. La sesión nunca se persiste.
- **`classifyUserAgent`**, función pura de dominio (`analytics/domain/services`) sobre una lista de patrones versionada en el repositorio, con tests de UA reales y de falsos positivos (D3).
- **`views` solo suma con `HUMAN`** (decisión del owner). La fila se guarda siempre, con su `kind` (D6).
- **Reclasificación idempotente** de las filas existentes con `npm run views:reclassify` (simulación por defecto, `--apply` para escribir): recalcula `kind` por `userAgent` con la misma función y **recalcula `views`** de cada perfil como la cantidad de sus visitas `HUMAN` (D4, D5).
- **Agregado:** `total`, `byProfile`, `byLocale`, `byDay` y `byReferrer` cuentan solo `HUMAN`; el nuevo `byKind: [{ kind, views }]` cuenta todas las filas del rango, con los tres tipos siempre presentes (D7).
- **Dashboard:** tabla **Por tipo** (Personas, Tus visitas, Bots) y una línea que aclara qué suma en el total (D8).
- **Contrato:** `byKind` y el enum `ViewKind` en el OpenAPI; `backend/openapi.json` y `frontend/src/shared/types/api.d.ts` regenerados (D9).
- **Scripts de calidad:** sus visitas quedan como `BOT` sin tocarlos, si su UA real coincide con la lista; si alguno no coincide, se le agrega un token identificable (D10).
- **Docs:** `docs/MANUAL.md` e `index.html` (TC-39, B2, el concepto de visita y el recorrido del dashboard; captura `tc18-dashboard.jpg` regenerada), `CLAUDE.md` (paso 6 del núcleo y el comando nuevo), `docs/DATA-POPULATION.md` si cita el contador, `backend/README.md` y `docs/CHANGELOG.md`.

## Non-goals

- Atribución por destinatario o portal (`ShareLink`, `?via=`, `?src=`): es `add-share-links`.
- Avisos por email en la primera apertura humana: es `add-open-notifications`.
- Detectar bots por comportamiento (frecuencia, IP, ausencia de JS), por listas de IP o con servicios externos. Sin IA, sin servicios ni dependencias nuevas.
- Reclasificar como `OWNER` las visitas propias anteriores al change: no hay ningún dato persistido que lo permita (ver Risks).
- Un filtro por tipo en el agregado (`?kind=`) o en el dashboard: ver la pregunta P2.
- Excluir las visitas por IP o permitir que el owner marque dispositivos como propios.
- Correr la reclasificación en el `preDeployCommand` o en el arranque.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `profile-view-analytics`: ADDED *Clasificación de la visita*, *Clasificador de User-Agent puro y versionado* y *Reclasificación idempotente de las visitas existentes*; MODIFIED *Registro de visita en cada resolución pública exitosa* (hoy suma 1 a `views` en cada 200), *Lectura agregada para el administrador* (suma `byKind` y acota los desgloses a `HUMAN`), *Agregado por origen de la visita* (hoy prohíbe leer cookies) y *La respuesta pública no espera al registro de la visita* (hoy fija `views + 1` en la transacción y su escenario espera +1 sin `User-Agent`).
- `admin-analytics-dashboard`: ADDED *Tabla por tipo de visita en el dashboard*; MODIFIED *Panel de visitas* (el total pasa a ser de personas y el estado vacío convive con visitas propias o de bots).

## Impact

- **Base (`backend/prisma/`):** enum `ViewKind`, columna `ProfileView.kind` con default `HUMAN` y una migración nueva sin `UPDATE`.
- **Backend (`backend/src/`):**
  - `modules/analytics/domain/services/`: `classify-user-agent.ts` (lista y versión) y `classify-visit.ts`, con tests.
  - `modules/analytics/domain/repositories/profile-view.repository.ts`: `kind` en `NewProfileView`, filtro `HUMAN` en los agregados y `countByKind`.
  - `modules/analytics/infrastructure/persistence/prisma-profile-view.repository.ts`: `views + 1` solo con `HUMAN`; filtros y conteo por tipo.
  - `modules/analytics/application/use-cases/aggregate-profile-views.use-case.ts` y el controller admin: `byKind`.
  - `shared/application/admin-session-verifier.ts` (puerto nuevo, como `background-tasks.ts`), implementado en `modules/auth/infrastructure/security/` y exportado por `AuthModule`.
  - `modules/curated-profile/`: el controller público extrae el token sin validarlo; `ResolveCuratedProfileUseCase` lo valida y clasifica dentro de la tarea en segundo plano.
- **Scripts (`backend/scripts/`):** `reclassify-views.ts` y su lógica en `scripts/lib/`, con el script `views:reclassify` en `backend/package.json`.
- **Tests:** unitarios del clasificador, de `classifyVisit`, del caso de uso (clasificación en la tarea, verificador que falla) y del agregado; e2e con cookie de admin, con UA de bot y con UA vacío; ajuste de los e2e que hoy piden el perfil sin `User-Agent` y esperan `views + 1`; test sin base de la reclasificación y corrida sobre una base descartable.
- **Frontend:** `features/backoffice/dashboard/DashboardPage.tsx` y su test; `api.d.ts` regenerado.
- **Operación:** la migración corre sola en el `preDeployCommand`. La reclasificación es manual y en producción hoy no hace falta (el deploy 1.0.0 todavía no ocurrió, P18). En la base local del owner la corre él, primero sin `--apply`.
- **Sin cambios** en el contrato público de `GET /api/curated-profiles/:slug`, en `profile-prefetch.js`, en Caddy ni en la CSP.
