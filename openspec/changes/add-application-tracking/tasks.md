# Tasks — add-application-tracking

> Referencias: `proposal.md`, `design.md` (D1–D15) y los deltas de `specs/` (`application-tracking`, `admin-analytics-dashboard`, `api-platform`, `platform-manual`). La evidencia va en `verification/`, como en `add-admin-password-change`.
>
> **Rama:** `feat/application-tracking` desde `main`. TC-46 es de este change; TC-47 y TC-48 los toman otros dos changes en paralelo: si chocan en `docs/MANUAL.md` (número de pantalla B15, tabla de la suite), se resuelve en el merge sin renumerar TC-46.
>
> **Orden:** 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11. Cada grupo de código va en el mismo commit que sus tests. Los docs (10) pueden escribirse en paralelo con el 8, salvo la captura, que necesita el 9.
>
> **Bases:**
> - `portfolio` (la del owner, `localhost:5434`): **ninguna** tarea le aplica la migración ni le escribe.
> - Los e2e corren contra la base de e2e de siempre (migrada y sembrada), nunca contra `portfolio`.
> - `portfolio_apps_check`: base descartable **nueva** en el mismo contenedor, para generar la migración (3.1) y para la app real (9), sembrada con el ejemplo; borrada al terminar.
>
> Antes de cada comando que escriba en una base, correr `npm run prisma:status` y confirmar el destino. Las credenciales del administrador de prueba se generan en la terminal y nunca se imprimen ni se escriben en `verification/`.

## 1. Punto de partida

- [x] 1.1 Confirmar en la rama: no existen el modelo `Application` ni el módulo `application-tracking`; `toHttpException` no tiene rama para 422; `ShareLinkOpens` no tiene `firstOpenedAt`; `NAV` tiene siete ítems. Verificar: `npm test`, `npm run test:e2e` y `npm run lint` en `backend/` y `npm test` en `frontend/` verdes antes de tocar nada; conteos en `verification/1.1-punto-de-partida.txt`.

## 2. Dominio (D2, D4, D5, D7, D15)

- [x] 2.1 `shared/domain/errors/rule-violation.error.ts` (`RuleViolationError extends DomainError`), exportado en `index.ts`, y su rama en `toHttpException` → `UnprocessableEntityException`. Verificar: `domain-error.mapper.spec.ts` ampliado (una subclase da 422 con `error: "Unprocessable Entity"`; las demás ramas sin cambios).
- [x] 2.2 Mudar `normalizeSource` a `shared/domain/normalize-source.ts` y re-exportarlo desde `curated-profile/domain/services/normalize-source.ts`. Verificar: los tests existentes de `normalize-source` y de `share-link.entity` siguen verdes sin cambiar expectativas.
- [x] 2.3 `application-tracking/domain/`: `ApplicationStatus` y `APPLICATION_STATUSES`, `APPLICATION_TRANSITIONS`, `ACTIVE_APPLICATION_STATUSES`, `validateApplicationFields` (D2), entidad `Application` con `transitionTo(next, now)`, `nextStatuses` y la regla de `appliedAt` (D4); errores `InvalidApplicationTransitionError` (`RuleViolationError`), `ApplicationNotFoundError` (`NotFoundError`) y `ShareLinkAlreadyTrackedError` (`ConflictError`); puertos `ApplicationRepository` y `ApplicationReferenceReader` con sus tokens Symbol. Verificar: el test de arquitectura (sin Nest ni Prisma en `domain/`) y `npm run typecheck`.
- [x] 2.4 Tests unitarios de dominio: la tabla completa de transiciones (las 49 combinaciones: válidas → ok con `statusChangedAt` nuevo; inválidas → `InvalidApplicationTransitionError` sin cambios; mismo estado → no-op); `nextStatuses` por estado; `appliedAt` (nula con `DRAFT`; automática al salir de `DRAFT` con el reloj; reabrir no la cambia; día del reloj + 1 se acepta y + 2 no); `validateApplicationFields` (límites 120/121, 160/161, 5000/5001 y 2048/2049, recorte, URL `ftp:` y relativa rechazadas, portal normalizado y portal inválido). Verificar: `npm test` verde.

## 3. Persistencia y migración (D7, D8, D13)

- [x] 3.1 `backend/prisma/schema.prisma`: enum `ApplicationStatus`, modelo `Application` y las relaciones inversas en `CuratedProfile` y `ShareLink`. Migración `<timestamp>_add_application_tracking` con `prisma migrate dev --create-only` **contra `portfolio_apps_check`**, revisada a mano: solo `CREATE TYPE`, `CREATE TABLE`, `CREATE INDEX`/`CREATE UNIQUE INDEX` y las FK de la tabla nueva con `ON DELETE SET NULL`; sin `UPDATE`, `DROP` ni cambios de columnas existentes. Verificar: el SQL en `verification/3.1-migracion.sql`; `npm run prisma:generate` y `npm run typecheck` verdes; `prisma migrate diff --from-url <portfolio_apps_check> --to-schema-datamodel prisma/schema.prisma --exit-code` sin diferencias.
- [x] 3.2 `PrismaApplicationRepository`: `list({ statuses })` en **una** consulta con `include` (`slug` del perfil; `label`, `code`, `revokedAt` del enlace) y orden `updatedAt` desc, `id` desc; `findById`, `create`, `update` (una escritura; `P2002` sobre `shareLinkId` → `ShareLinkAlreadyTrackedError`), `delete` (`P2025` → `false`), `countByStatus` (un `groupBy`), `isShareLinkTracked(shareLinkId, exceptId?)`. `PrismaApplicationReferenceReader` (solo lectura). Verificar: cubiertos por los e2e de 6 (incluido el `SetNull` al borrar el perfil).
- [x] 3.3 `analytics`: `ShareLinkOpens.firstOpenedAt` con `_min.viewedAt` en el mismo `groupBy` de `countOpensByShareLink`. Verificar: el e2e de `share-links` sigue verde sin cambios de contrato y un e2e nuevo en 6.3 comprueba `firstOpenedAt`.

## 4. Aplicación (D6, D7, D8, D9, D10)

- [x] 4.1 DTOs de salida (`ApplicationOutput` con `nextStatuses` y `shareLink { id, label, code, revoked, opens, firstOpenedAt, lastOpenedAt } | null`, `ApplicationSummaryOutput`) y mapper. Verificar: tests del mapper (fechas ISO, `appliedAt` como `AAAA-MM-DD`).
- [x] 4.2 Casos de uso, un `execute()` cada uno: `ListApplicationsUseCase`, `GetApplicationUseCase`, `CreateApplicationUseCase`, `UpdateApplicationUseCase`, `DeleteApplicationUseCase`, `GetApplicationSummaryUseCase` y `ExportApplicationsUseCase`, con repositorios, lector de referencias, `PROFILE_VIEW_REPOSITORY` y `CLOCK` por token. Verificar: specs con repositorios simulados: (a) la lista llama **una vez** a `countOpensByShareLink` con todos los ids no nulos y ninguna si no hay enlaces; (b) crear con perfil inexistente, enlace ajeno, `LINKEDIN_POST` o enlace sin perfil → `ValidationError` sin escribir; (c) enlace ya rastreado → `ShareLinkAlreadyTrackedError` sin escribir; (d) actualizar con transición inválida y otros campos → `InvalidApplicationTransitionError` sin llamar a `update`; (e) id inexistente → `ApplicationNotFoundError`; (f) el resumen completa los siete estados con ceros y calcula `active`; (g) el reloj simulado fija `statusChangedAt` y `appliedAt`.
- [x] 4.3 `application/services/to-application-csv.ts` (D10), puro. Verificar: `to-application-csv.spec.ts`: BOM, CRLF, cabecera exacta, todas las celdas entre comillas, comillas duplicadas, salto de línea dentro de una celda, neutralización de `=`, `+`, `-`, `@`, `\t` y `\r` (y que `Backend Senior` o una fecha no cambian), etiquetas de estado en español, sin filas → solo cabecera; y un parseo de ida y vuelta con un parser RFC 4180 mínimo escrito en el test (sin dependencias nuevas) que recupera los valores originales salvo el apóstrofo.

## 5. Infraestructura HTTP (D5, D9, D10)

- [x] 5.1 DTOs de entrada (`CreateApplicationDto`, `UpdateApplicationDto`, `ListApplicationsQuery` con `status` separado por coma y validado contra el enum) y `AdminApplicationController` bajo `admin/applications` con `JwtAuthGuard` y `adminValidationPipe`, rutas `summary` y `export` antes de `:id`, Swagger con 400, 401, 404, 409 y 422. El export pone `Content-Type`, `Content-Disposition` y `Cache-Control: no-store`. `ApplicationTrackingModule` cablea los tokens e importa `AnalyticsModule`; `AppModule` lo importa. Verificar: `npm run typecheck`, `npm run lint` y los e2e de 6.

## 6. E2e (`backend/test/admin-applications.e2e-spec.ts`)

> Crea sus propios perfiles y enlaces de prueba en `beforeAll` y los borra en `afterAll`; las visitas se insertan directo con Prisma con el `kind` que cada caso necesita.

- [x] 6.1 CRUD y filtro: crear (201, `portal` normalizado), leer, `PATCH` parcial, listar con `status=APPLIED,INTERVIEWING` y orden por `updatedAt`, borrar (204) y leer (404); `status=HIRED` → 400; campo desconocido (`contactEmail`) → 400; sin sesión → 401 en las siete rutas. Verificar: `npm run test:e2e` verde.
- [x] 6.2 Transiciones: `APPLIED → INTERVIEWING` → 200 con `nextStatuses`; `DRAFT → OFFER` → 422 con `error: "Unprocessable Entity"` y sin `stack`; `ACCEPTED → APPLIED` → 422; `PATCH` con notas y transición inválida → 422 y notas sin cambios en la base; `REJECTED → APPLIED` conserva `appliedAt`; `DRAFT` con `appliedAt` → 400. Verificar: `npm run test:e2e` verde.
- [x] 6.3 Vínculos y aperturas: enlace de otro perfil, `LINKEDIN_POST` o sin perfil → 400; segundo uso del mismo enlace → 409; enlace revocado → 201; con visitas `OWNER` (día 1), `HUMAN` (días 3 y 5) y `BOT` → `opens: 2`, `firstOpenedAt` del día 3 y `lastOpenedAt` del día 5; borrar el perfil deja la postulación sin perfil ni enlace. Verificar: `npm run test:e2e` verde.
- [x] 6.4 Resumen y CSV: `summary` con ceros y `active`; export con cabeceras exactas (`text/csv; charset=utf-8`, `attachment; filename="postulaciones-<fecha UTC>.csv"`, `no-store`), BOM, una empresa `=1+1` exportada como `"'=1+1"`, filtro aplicado; sin sesión → 401 JSON. Verificar: `npm run test:e2e` verde.
- [x] 6.5 Sin rutas públicas: `GET /api/applications` y `GET /api/applications/export` → 404; `GET /api/curated-profiles/:slug` de un perfil con postulaciones devuelve el mismo cuerpo que antes de crearlas; `sitemap.xml` sin cambios. Verificar: `npm run test:e2e` verde; salida completa del archivo en `verification/6-e2e.txt`.

## 7. Contrato

- [x] 7.1 `npm run openapi:export` y, en `frontend/`, `npm run api:types`: aparecen las siete rutas de `/api/admin/applications`, `ApplicationStatus` como enum y la respuesta 422. Verificar: el test de deriva del frontend verde y `git diff --exit-code` tras un segundo export.

## 8. Panel (D11, D12)

- [x] 8.1 `applications/application-form.ts`: schema Zod con las reglas y los mensajes literales de D11. Verificar: `application-form.spec.ts` (empresa vacía, 121 caracteres, URL sin esquema, portal inválido, fecha futura con un reloj fijo, `DRAFT` sin fecha válido).
- [x] 8.2 Hooks en `shared/use-admin-api.ts` o `applications/use-applications-api.ts` (lista por filtro, resumen, guardar, borrar) y `applications/download-csv.ts` (`fetch` con la sesión, nombre desde `Content-Disposition`, `URL.createObjectURL` y `revokeObjectURL`). Verificar: `download-csv.spec.ts` (nombre tomado de la cabecera; error 500 → rechaza sin crear el objeto URL).
- [x] 8.3 `applications/ApplicationsPage.tsx` y `ApplicationDialog.tsx`, ruta `postulaciones` en `BackofficeApp.tsx` e ítem **Postulaciones** (`Briefcase`) en `NAV`. Verificar: `ApplicationsPage.test.tsx` con la API simulada: filtro `Activas` por defecto y en la URL (`?estado=interviewing` tras elegir y recargar); «Abierto el 12/11/2026» y «Sin abrir»; los dos estados vacíos literales; el selector de estado al editar `INTERVIEWING` ofrece solo los de `nextStatuses`; la fecha se oculta con *Por postular* y se completa al elegir *Postulada*; el select de enlaces solo lista `MANUAL` del perfil elegido; 422 y 409 muestran su mensaje literal y el diálogo sigue abierto; borrar pide confirmación; **Exportar CSV** pide la URL con el filtro y muestra «No se pudo exportar. Intentá de nuevo.» ante un 500; `localStorage` y `sessionStorage` sin cambios.
- [x] 8.4 Franja del dashboard (D12) en `DashboardPage.tsx`. Verificar: `DashboardPage.test.tsx` ampliado (texto literal con 2 `APPLIED` y 1 `OFFER`; «Sin postulaciones activas»; cambiar el rango no vuelve a pedir el resumen; resumen 500 con visitas 200 → sin franja y con visitas).
- [ ] 8.5 Barra del panel con ocho ítems (D11): `AdminLayout.responsive.test.tsx` ampliado con el ítem nuevo, y en Chrome, a 1280 × 800 y a 1536 × 900, la barra horizontal no se desborda (`scrollWidth ≤ clientWidth` de la `nav` «Secciones»); si se desborda, pasar la barra completa a `2xl`. Verificar: medidas en `verification/8.5-barra.txt`.
- [x] 8.6 `npm run lint`, `npm run typecheck`, `npm run build` y `npm run perf:budget` en `frontend/`: el código va en el chunk del panel y el arranque público no cambia. Verificar: tamaño del arranque en `verification/8.6-perf-budget.txt` (igual al de 1.1).

## 9. App real

- [x] 9.1 Sobre `portfolio_apps_check` migrada y sembrada con el ejemplo: API de la rama y la imagen de `frontend/Dockerfile`; administrador creado con `admin:bootstrap` y una contraseña aleatoria de la terminal. Verificar: `npm run prisma:status` contra esa base antes de escribir; nota en `verification/9.1-entorno.txt` sin credenciales.
- [x] 9.2 TC-46 completo según `verification.md`, pasos del panel en Chrome y por la API con `curl`; abrir el CSV descargado en LibreOffice o Excel y comprobar que la celda con fórmula se ve como texto. Verificar: transcripción de status y cabeceras en `verification/9.2-tc46.txt` y una captura de la planilla en `verification/9.2-csv.png`.
- [x] 9.3 `check-a11y.mjs`: sumar `admin-postulaciones` (`/admin/postulaciones`, con postulaciones en la lista y el filtro `Todas`) y `admin-postulaciones-error` (diálogo «Nueva postulación» con errores, sin ningún `POST`). `npm run a11y:check` con `A11Y_CHECK_DISPOSABLE_DB=1` y las credenciales de la terminal, en móvil y escritorio, con `A11Y_CHECK_PROFILE=ejemplo-backend`. Verificar: 0 violaciones `serious` y 0 `critical`; salida en `verification/9.3-a11y.txt`.

## 10. Docs

- [x] 10.1 `docs/MANUAL.md` e `index.html`: **TC-46** (texto de `verification.md`) en la sección 3 y en la tabla de la suite (§ 6); pantalla **B15 — Postulaciones** (o la siguiente libre si otro change tomó B15) con la tabla de campos y la columna *Mensaje* de D11, la tabla de transiciones, «Abierto el…», el aviso de contacto y cómo abrir el CSV (*Datos → Desde texto/CSV*, coma, UTF-8); B2 menciona la franja; C8 y R9 citan TC-46; glosario: *Postulación* y *Abierto el*. Verificar: `npm run manual:check` verde.
- [x] 10.2 `capture-manual.mjs` (D14): las tres postulaciones ficticias idempotentes y la captura `bo-postulaciones.jpg` en el manifiesto; actualizar el comentario de cabecera del script con la escritura nueva. Generar con `manual:capture` sobre la base de ejemplo. Verificar: `manual:check` (inventario y tope de 150 KB) verde; correr la captura dos veces no duplica postulaciones (conteo en `verification/10.2-captura.txt`).
- [x] 10.3 `docs/ARCHITECTURE.md` § 6 (rutas de `/api/admin/applications`) y `docs/CHANGELOG.md` (módulo, 422, CSV, pantalla, franja, migración aditiva). Verificar: diff revisado.
- [ ] 10.4 Al archivar: la línea del roadmap en `CLAUDE.md` (`add-application-tracking` — CRM de postulaciones en el panel: estados con transiciones en el dominio y 422, vínculo con perfil y `ShareLink` con «Abierto el…», CSV sin fórmulas y franja en el dashboard; sin rutas públicas) y, en `docs/PROPUESTA-FEATURES.md` § 6.2, la fila pasa de «(en curso)» a ✅. Verificar: diff revisado en el PR de archivado.

## 11. Cierre

- [x] 11.1 Todo verde: `npm test`, `npm run test:e2e`, `npm run lint` y `npm run typecheck` en `backend/`; `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm run perf:budget` y `npm run manual:check` en `frontend/`. Verificar: conteos en `verification/11.1-cierre.txt`.
- [x] 11.2 `npx -y @fission-ai/openspec@1.14.1 validate --all --strict` sin fallos y sin avisos «Archive would refuse» para este change. Verificar: salida en `verification/11.2-validacion.txt`.
- [x] 11.3 Borrar `portfolio_apps_check` y confirmar que `portfolio` no tiene la migración (`prisma migrate status` contra ella la muestra pendiente). Verificar: `verification/11.3-base-del-owner.txt`.
