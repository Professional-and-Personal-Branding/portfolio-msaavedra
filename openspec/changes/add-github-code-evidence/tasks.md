# Tasks — add-github-code-evidence

> Referencias: `proposal.md`, `design.md` (D1–D17; P1–P5 no bloqueantes, con recomendación) y los deltas de `specs/`. La evidencia va en `verification/`, como en los changes anteriores.
>
> **Orden:** 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10. Cada grupo de código va en el mismo commit que sus tests.
>
> **Bases:**
> - `portfolio` (la del owner, `localhost:5434`): **ninguna** tarea le escribe; la migra él.
> - E2e: la base de e2e de siempre (migrada y sembrada).
> - `portfolio_github_check`: base descartable nueva, sembrada con el ejemplo, para la migración (2) y la app real (8); se borra al terminar. Antes de cada comando que escriba, `npm run prisma:status` para confirmar el destino.
>
> **Red:** ninguna tarea hace peticiones reales a GitHub. Todo corre con `GITHUB_TRANSPORT=fixture`, un `GithubApi` en memoria o un servidor HTTP en `127.0.0.1`.
>
> **Conflictos esperables:** `schema.prisma`, `provider-catalog.ts`, `integrations.module.ts`, `featured-repository.output.ts`, `Repositories.tsx`, `messages.ts`, `MANUAL.md`/`index.html`. Regenerar `openapi.json` y `api.d.ts` con los comandos, nunca a mano. TC-52 es de este change.

## 1. Punto de partida

- [ ] 1.1 Confirmar en la rama: `PROVIDER_CATALOG` con solo `fake`; `FeaturedRepositoryOutput` sin `evidence`; TC-51 como último caso de `docs/MANUAL.md`. Verificar: `npm test`, `npm run test:e2e`, `npm run lint` y `npm run typecheck` en `backend/`; `npm test`, `npm run build` y `npm run perf:budget` en `frontend/`; salida y tamaño del arranque en `verification/1.1-punto-de-partida.txt`.

## 2. Persistencia (D8, D17)

- [ ] 2.1 `schema.prisma`: enum `RepositoryEvidenceStatus` y modelo `RepositoryEvidence` (D8) con relación 1:1 opcional desde `FeaturedRepository` y `onDelete: Cascade`. Migración `<timestamp>_add_github_code_evidence` con `npx prisma migrate dev --create-only` contra `portfolio_github_check`, revisada a mano (solo `CREATE TYPE`, `CREATE TABLE` y la FK). Verificar: `npm run prisma:migrate` y `npm run prisma:status` sobre la descartable; `npx prisma migrate diff` sin diferencias; el SQL en `verification/2.1-migracion.sql`.

## 3. Dominio puro (D4, D6, D9, D10)

- [ ] 3.1 `integrations/domain/github/project-github-repository.ts`: proyección con lista blanca del repo y de los lenguajes (D4). Verificar: unitario con un fixture completo (claves fuera de la lista ausentes), tipos inesperados → `null`, topics en minúsculas y hasta 20, descripción recortada a 350, lenguajes hasta 20.
- [ ] 3.2 `integrations/domain/github/classify-github-response.ts` (D6, D7): fallos del trabajo y estados por repo, reusando `classifyHttpFailure`; reserva de cuota ≤ 50. Verificar: unitario con **cada fila** de la tabla de D6 y de la reserva, incluidos 403 con `retry-after`, 403 «secondary rate limit» sin cabeceras → 60 s, 429 sin nada → 60 s, 451 → `INACCESSIBLE`; `classifyHttpFailure.spec.ts` sin cambios y verde.
- [ ] 3.3 `featured-repository/domain/value-objects/repository-evidence.ts` y `domain/services/present-repository-evidence.ts` (D9, D10): validez (`OK` y `repoKey` igual a la clave de la URL), lenguaje efectivo, top 3 lenguajes con porcentaje entero sin 0 %, topics hasta 5 sin repetir tecnologías (sin distinguir mayúsculas). Verificar: unitario con evidencia ausente, `NOT_FOUND`, `PRIVATE`, `repoKey` viejo, override manual del lenguaje, redondeo de porcentajes y deduplicación.
- [ ] 3.4 Catálogo: `PROVIDER_CATALOG.github` (D1). Verificar: unitario del catálogo y de `parseEnabledProviders` con `github`.

## 4. Aplicación y conector (D2, D3, D5, D7)

- [ ] 4.1 Puertos `application/github/github-api.port.ts` (`get(path, { etag, token, signal })` → `{ status, headers, body }`) y `code-evidence-store.port.ts` (`listTargets`, `save`, `pruneSnapshots`).
- [ ] 4.2 `SyncGithubEvidenceService` (D3): objetivos ordenados y deduplicados con tope 50, en serie, repo y después lenguajes (salvo `PRIVATE`/no encontrado), snapshot y evidencia por repo antes del siguiente, 304 y mismo hash solo mueven `verifiedAt`, `movedTo`, limpieza de snapshots al terminar, `itemsChanged`. Verificar: unitario con un `GithubApi` en memoria: primera corrida actualiza todo; segunda con 304 → `itemsChanged: 0`, datos y `changedAt` idénticos, `verifiedAt` posterior; 401 en el primero → `Permanent` sin `save`; 503 en el segundo → `Transient` con el primero grabado; reserva → `ResetAt` sin más peticiones; máximo de peticiones simultáneas = 1; 51 repos → 50 procesados y un `warn`; sin repos → 0 peticiones.
- [ ] 4.3 `FetchGithubTransport` (D3, D5): URL base constante (inyectable solo por constructor para el test), cabeceras fijas, `AbortSignal.any` con 15 s, `redirect: 'manual'` con hasta 2 saltos dentro de `https://api.github.com/`, corte del cuerpo en 512 KiB. Verificar: test contra `http.createServer` en `127.0.0.1` (puerto 0): `Authorization` presente en la petición inicial, en la condicional y tras la redirección; redirección a otro origen no seguida; tercer salto rechazado; cuerpo grande cortado sin `JSON.parse`; aborto por la señal del trabajo y por timeout.
- [ ] 4.4 `FixtureGithubTransport` (D15) y fixtures en `backend/test/fixtures/github/` para `portafolio-ejemplo-ficticio/{reservas-api,metricas-dashboard,experimento-oculto}` y los casos `rate-limited`, `secondary-limit`, `moved`, `private-repo`, `forbidden`; 401 con `fixture-invalid-token`; registro de peticiones (sin el valor del token). Verificar: unitario del transporte (ETag estable, 304, 404 sin carpeta, 401) y `npx jest test/architecture.spec.ts` (escaneo de tokens) verde.
- [ ] 4.5 `GithubConnector` (`ConnectorPort`), `PrismaCodeEvidenceStore` (upsert en una transacción corta) y el cableado en `integrations.module.ts` según `GITHUB_TRANSPORT`. Verificar: `npm run typecheck`, `npm run lint` y un unitario de que el conector pasa la señal al servicio.
- [ ] 4.6 Config (D16): `GITHUB_SYNC_TOKEN` y `GITHUB_TRANSPORT` en `env.validation.ts` y `configuration.ts`; `fixture` prohibido en producción. Verificar: casos nuevos en `integrations-env.e2e-spec.ts` (valor desconocido, `fixture` con `NODE_ENV=production`, default `http`), mensajes sin valores.

## 5. Lectura en `featured-repository` (D10, D12, D13)

- [ ] 5.1 Adaptador Prisma con `include: { evidence: true }`; salida pública con `evidence` y lenguaje efectivo (`toFeaturedRepositoryOutput`); salida del panel con la evidencia cruda y `stale`; schemas de Swagger. Verificar: unitarios de los mappers; `npm run openapi:export` y `npm run api:types` sin errores.
- [ ] 5.2 Test de arquitectura (D2): `featured-repository` en la lista de módulos que no importan `integrations`; regla «solo `prisma-code-evidence.store.ts` escribe `repositoryEvidence`» con su autocontrol. Verificar: `npx jest test/architecture.spec.ts` verde y el autocontrol detecta un escritor de ejemplo.

## 6. E2e sin red

- [ ] 6.1 `test/github-code-evidence.e2e-spec.ts` con `INTEGRATIONS_ENABLED=github`, `GITHUB_TRANSPORT=fixture`, keyring de prueba y la corrida invocada directamente: (a) primera corrida → stars, lenguajes y topics en `GET /api/featured-repositories` y en el perfil curado; (b) segunda → 304 en todo, `itemsChanged: 0`, datos idénticos, `verifiedAt` posterior; (c) secreto `fixture-invalid-token` → trabajo `DEAD` con el mensaje del 401, evidencia idéntica y la ruta pública la sigue sirviendo; (d) `GET /api/curated-profiles/all` y su `resume.json` → 0 peticiones al transporte; (e) `updatedAt` de los perfiles sin cambios; (f) repo `private-repo` → `evidence: null`; (g) borrar un repo → su evidencia desaparece; (h) `PUT` de la credencial con `GITHUB_SYNC_TOKEN` definida → 422; (i) un error con el secreto en el texto → `[Redacted]` en `lastError`. Verificar: `npm run test:e2e` verde; salida en `verification/6.1-e2e.txt`.
- [ ] 6.2 JSON Resume: caso en `json-resume-export.e2e-spec.ts`: repo sin lenguaje manual con evidencia `Java` → `keywords[0] = "Java"`; sin stars ni topics; valida contra el schema vendorizado. Verificar: `npm run test:e2e`.

## 7. Frontend (D10, D12)

- [ ] 7.1 `Repositories.tsx`: stars (≥ 1, nombre accesible), lenguajes con porcentaje, topics, «Archivado», último cambio y sello; sin evidencia, render idéntico. Rótulos en `messages.ts` (ES/EN). Verificar: Vitest con fixtures: con evidencia, con 0 stars, con `evidence: null` (snapshot igual al anterior), en inglés; `npm run perf:budget` sin crecer el arranque (la sección ya es diferida).
- [ ] 7.2 Bloque Repositorios de `/admin/proyectos`: insignia por estado, descripción de GitHub de solo lectura, placeholder del lenguaje, aviso con **Ver integraciones** a partir de `GET /api/admin/integrations`; la barra sin cambios. Verificar: Vitest con MSW: cada insignia, aviso con `github` en `DEAD`, sin aviso si la consulta falla o no hay `github`; test de `NAV` sin cambios.
- [ ] 7.3 `npm run lint`, `npm run typecheck`, `npm test` y `npm run build` en `frontend/`.

## 8. App real sin red (TC-52)

- [ ] 8.1 Contra `portfolio_github_check` (ejemplo sembrado), API con `INTEGRATIONS_ENABLED=github`, `GITHUB_TRANSPORT=fixture`, keyring de prueba y credencial guardada desde Integraciones: «Sincronizar ahora» + `npm run integrations:sync`; revisar la tarjeta pública y el bloque del panel; repetir (304); cambiar la credencial a `fixture-invalid-token` y repetir (DEAD y avisos). Verificar: pasos y salidas en `verification/8.1-tc52.md`; `npm run a11y:check` con `A11Y_CHECK_DISPOSABLE_DB=1` sobre `/` y `/admin/proyectos` sin violaciones nuevas.
- [ ] 8.2 `npm run print:check` con `PRINT_CHECK_DISPOSABLE_DB=1`: la hoja sigue en una página y sin evidencia (D14).

## 9. Documentación

- [ ] 9.1 `docs/MANUAL.md` e `index.html`: **TC-52 — Verificar los repositorios contra GitHub** (de `verification/8.1-tc52.md`), B7 (insignias y aviso literales), B17 (proveedor `github`, `GITHUB_SYNC_TOKEN`, token vencido), glosario («evidencia», «verificado el…»); capturas con `npm run manual:capture` contra la base de ejemplo con `GITHUB_TRANSPORT=fixture`. Verificar: `npm run manual:check` con código 0.
- [ ] 9.2 `docs/DEPLOY-RAILWAY.md` y `docs/DEPLOY.md` (crear el PAT fine-grained de solo lectura con vencimiento, dónde cargarlo, encender el proveedor, qué hacer al vencer), `backend/.env.example`, `docs/ARCHITECTURE.md` (conector `github`, tabla `RepositoryEvidence`, precedencia), `docs/DATA-POPULATION.md` § 10 (qué campos son manuales y cuáles de GitHub), `docs/CHANGELOG.md`. Verificar: revisión de enlaces y `npm run manual:check`.

## 10. Cierre

- [ ] 10.1 Suite completa: `backend/` (`lint`, `typecheck`, `test`, `test:e2e`, `openapi:export` sin deriva) y `frontend/` (`lint`, `typecheck`, `test`, `build`, `perf:budget`); `npx -y @fission-ai/openspec@1.14.1 validate add-github-code-evidence --strict`. Verificar: todo verde en `verification/10.1-cierre.txt`.
- [ ] 10.2 Al archivar: línea del roadmap en `CLAUDE.md` (Fase 1.3) y revisar que el archivado no diga «Archive would refuse».
