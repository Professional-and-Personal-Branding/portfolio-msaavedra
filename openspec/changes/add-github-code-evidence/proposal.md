# add-github-code-evidence — Evidencia de código: stars, lenguajes y topics verificados contra GitHub

> Change de la **Fase 1.3** de `docs/PROPUESTA-FEATURES.md` (§ 4, épica E1, ítem **1.2b**; § 6.2, fila `add-github-code-evidence`). Criterio de la ficha: «Con el fixture, se actualizan stars, lenguajes y topics. Un 304 autenticado no reescribe nada. Con el token vencido se sirve el último snapshot y el panel avisa.» Se apoya en `add-integrations-foundation` (cola, `ConnectorPort`, `ExternalSnapshot`, clasificadores, keyring, pantalla Integraciones) y en `add-featured-repositories` (módulo `featured-repository`, `parseGithubRepositoryUrl`, sección `repositories`). Respeta la línea 53 de la propuesta: GitHub REST con un PAT fine-grained de solo lectura, **siempre con `Authorization`** (también en las peticiones condicionales, que así no consumen cuota) y **en serie**.

## Why

La sección de repositorios muestra hoy lo que el owner escribió a mano: nombre, descripción, lenguaje y tecnologías. Para un reclutador técnico, lo que da credibilidad es lo verificable: que el repo existe, cuántas stars tiene, en qué lenguajes está escrito, cuándo se tocó por última vez y si está archivado. Cargar esos datos a mano los deja viejos al día siguiente; por eso `add-featured-repositories` dejó `stars` sin exponer (D3 de ese change) y anunció este change.

La base de integraciones ya resuelve la parte difícil (cola, reintentos, pausa por proveedor, cifrado del token, snapshots con ETag). Falta el primer proveedor real y la proyección de lo que trae a los repositorios destacados, sin que la ruta pública dependa de GitHub.

## What Changes

- **Proveedor `github`** en el catálogo de integraciones (D1), permitido en producción, con la variable opcional `GITHUB_SYNC_TOKEN` (D11 enmendado de la base: si está, manda; si no, la credencial cifrada del panel).
- **Conector `GithubConnector`** sobre `ConnectorPort` (D2, D3): por cada `FeaturedRepository`, en serie, `GET /repos/{owner}/{repo}` y `GET /repos/{owner}/{repo}/languages`, siempre con `Authorization: Bearer`, `If-None-Match` con el ETag del snapshot, `X-GitHub-Api-Version` y la señal de aborto; redirecciones seguidas a mano solo dentro de `https://api.github.com` (D5).
- **Clasificación propia de GitHub** (D6) sobre `classifyHttpFailure`: límite secundario por `retry-after`, `x-ratelimit-remaining: 0` o mensaje sin cabeceras (espera 1 min); 401 detiene el trabajo como `Permanent`; 404/403/451 de **un** repo no tumban el trabajo, quedan como estado de ese repo. Reserva de cuota: con `x-ratelimit-remaining` ≤ 50 el trabajo se detiene con `ResetAt` (D7).
- **Snapshots reducidos** (D4): el cuerpo guardado en `ExternalSnapshot` es una proyección con lista blanca de campos, así un cambio ajeno (p. ej. `watchers`) no cuenta como cambio. Un 304 solo mueve `fetchedAt` del snapshot y `verifiedAt` de la evidencia.
- **Tabla nueva `RepositoryEvidence`** (D8, migración aditiva): una fila por repositorio destacado con `repoKey`, estado (`OK`, `NOT_FOUND`, `INACCESSIBLE`, `PRIVATE`), stars, lenguaje principal, bytes por lenguaje, topics, `pushedAt`, archivado, `movedTo`, descripción de GitHub (solo panel), `verifiedAt` y `changedAt`. La escribe solo el conector; `featured-repository` solo la lee.
- **Precedencia** (D9): lo curado a mano (nombre, URL, descripción bilingüe, tecnologías, tags, orden, visible) no se toca nunca. El lenguaje efectivo es el manual si existe y, si no, el principal de GitHub. Stars, lenguajes, topics, último push, archivado y «verificado el…» salen solo de GitHub.
- **Vista pública** (D10): la tarjeta suma stars (desde 1), hasta 3 lenguajes con porcentaje, hasta 5 topics que no repitan tecnologías, «Archivado» y «Verificado en GitHub el {fecha}». Sin evidencia válida (repo no encontrado, privado, URL cambiada o proveedor nunca habilitado) la tarjeta queda **exactamente como hoy**.
- **Panel** (D12): en el bloque Repositorios de `/admin/proyectos`, el estado de verificación de cada repo y un aviso con enlace a Integraciones si la última sincronización de GitHub falló. **Sin ítem nuevo en la barra.** La tarjeta `github` de Integraciones es la genérica de la base.
- **JSON Resume** (D13): el lenguaje efectivo entra en `keywords`; sin stars ni fechas (el schema no tiene dónde). **PDF sin cambios** (D14).
- **Transporte de fixtures** (D15): `GITHUB_TRANSPORT=fixture`, prohibido en producción, responde desde `backend/test/fixtures/github/` con ETag y 304; lo usan los e2e, `manual:capture` y el TC-52 sin red ni token real.
- **Docs y contrato:** `openapi.json` y `api.d.ts` regenerados; `docs/MANUAL.md` e `index.html` con **TC-52** y la ampliación de B7 y B18; `docs/DEPLOY-RAILWAY.md` (cómo crear el PAT fine-grained y encender el proveedor); `backend/.env.example`; `docs/ARCHITECTURE.md`; `docs/CHANGELOG.md`; la línea del roadmap en `CLAUDE.md` al archivar.

## Non-goals

- **GraphQL, repos fijados, calendario de contribuciones, README de perfil, achievements** y métricas de GitHub hacia `SocialLink.stats` (ítem 1.3 de la propuesta): changes aparte.
- **Descubrir repos automáticamente** desde la cuenta del owner: la lista sigue siendo curada a mano.
- **Reescribir campos curados** con lo de GitHub (descripción, tecnologías, nombre): GitHub solo informa; el panel muestra la descripción de GitHub como referencia.
- **Otros hosts** (GitLab): decisión vigente del owner, solo GitHub.
- **Sincronizar al crear o editar un repo**: corre en la sincronización diaria o con «Sincronizar ahora».
- **JSON-LD** (`SoftwareSourceCode`): `public-seo` sin cambios, como decidió `add-featured-repositories` (D11 de ese change).
- **Regla nueva en `cv:lint`**: el linter corre sin base; la evidencia vive en la base.
- **Borrar la columna `FeaturedRepository.stars`**: queda inerte (P3).

## Capabilities

### New Capabilities

- `code-evidence`: proveedor `github`, conector en serie con `Authorization` y ETag, clasificación de GitHub, reserva de cuota, snapshots reducidos, `RepositoryEvidence` y su precedencia, presentación pública y en el panel, token vencido, transporte de fixtures y ausencia de llamadas en la ruta pública.

### Modified Capabilities

- `json-resume-export`: ADDED *Lenguaje efectivo de los repositorios en el JSON Resume*.
- `frontend-localization`: ADDED *Rótulos de la evidencia de GitHub*.
- `api-platform`: ADDED *Variables del proveedor GitHub validadas al arranque*.
- `platform-manual`: ADDED *Caso TC-52 de la evidencia de GitHub*.

No hay `MODIFIED`: los requisitos de `featured-repositories` e `integration-*` todavía no están en `openspec/specs/` (sus changes no se archivaron), y modificar un requisito ajeno haría que el archivado se negara. Todo lo nuevo va como `ADDED`.

## Impact

- **Base (`backend/prisma/`):** enum `RepositoryEvidenceStatus` y modelo `RepositoryEvidence` (FK a `FeaturedRepository` con `ON DELETE CASCADE`). Migración `<timestamp>_add_github_code_evidence`, solo aditiva.
- **Backend:**
  - `modules/integrations/domain/provider-catalog.ts` (entrada `github`); `domain/github/` (nuevo: `project-github-repository.ts`, `classify-github-response.ts`); `application/github/` (nuevo: `sync-github-evidence.service.ts`, puertos `github-api.port.ts` y `code-evidence-store.port.ts`); `infrastructure/providers/github/` (nuevo: `github.connector.ts`, `fetch-github-transport.ts`, `fixture-github-transport.ts`); `infrastructure/persistence/prisma-code-evidence.store.ts`; `integrations.module.ts`.
  - `modules/featured-repository/`: value object `RepositoryEvidence` en el dominio, `present-repository-evidence.ts` (puro), lectura con `include` en el adaptador Prisma, salidas pública y del panel con `evidence`, lenguaje efectivo en el mapper público, schemas de Swagger.
  - `config/env.validation.ts` y `config/configuration.ts`: `GITHUB_SYNC_TOKEN` (opcional) y `GITHUB_TRANSPORT`.
  - `test/architecture.spec.ts`: `featured-repository` no importa `integrations`; solo el store de GitHub escribe `RepositoryEvidence`.
- **Frontend:** `shared/components/portfolio/Repositories.tsx` (chunk diferido ya existente), `shared/i18n/messages.ts`, `features/backoffice/proyectos/` (estado por repo y aviso), `api.d.ts`, MSW y fixtures de los tests.
- **Fixtures:** `backend/test/fixtures/github/` (respuestas sin tokens reales; el escaneo de `ghp_`/`github_pat_` sigue pasando).
- **Scripts del frontend:** `capture-manual.mjs` (captura de la tarjeta con evidencia y del bloque del panel, contra la base de ejemplo con el transporte de fixtures).
- **Docs:** `docs/MANUAL.md`, `docs/manual/index.html` y capturas, `docs/DEPLOY-RAILWAY.md`, `docs/DEPLOY.md`, `docs/ARCHITECTURE.md`, `docs/DATA-POPULATION.md` § 10, `docs/CHANGELOG.md`, `backend/.env.example`, `CLAUDE.md`.
- **Dependencias:** ninguna nueva (`fetch` de Node 22). **CSP y Caddy:** sin cambios; el navegador nunca habla con GitHub.
- **Sin cambios** en la ruta pública fuera del DTO de repositorios, el composer, `/health`, el head, el sitemap ni `CuratedProfile.updatedAt`.
