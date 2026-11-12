# add-application-tracking — CRM personal de postulaciones en el panel

> Change de la **Fase 1.3** de `docs/PROPUESTA-FEATURES.md` (§ 4, épica E3, ítem **3.2** «CRM de postulaciones»; § 6.2, fila `add-application-tracking`). La ficha pide: «CRUD bajo `/api/admin/applications`. Una transición inválida da 422. Muestra «abierto el…». Exporta a CSV. No tiene rutas públicas». Respeta las decisiones del owner: P14 = A (la cobertura queda solo en el panel, y este change no la muestra en público) y P15 = A (empresa, puesto y notas, **sin datos de contacto de personas**), ambas resueltas el 2026-11-07. Se apoya en `add-share-links` (archivado el 2026-10-29), que ya cuenta las aperturas `HUMAN` por enlace. Es un change de panel: no toca la ruta pública, el seed ni el tema. En `docs/SPECS-POR-FASE.md` no hay fase para la ronda post-1.1; la ficha de la propuesta hace ese papel.

## Why

La búsqueda de empleo es activa: el owner manda perfiles curados a varias empresas, cada una con su `ShareLink`, y hoy no tiene dónde anotar a quién le escribió, en qué estado está cada proceso ni si el reclutador abrió el link. Esa información está repartida entre la tabla **Por enlace** del dashboard, que muestra visitas sin contexto, y notas sueltas fuera de la plataforma.

Las visitas atribuidas ya existen (`ProfileView.shareLinkId`, `kind = HUMAN`). Lo que falta es una entidad propia que una la empresa, el puesto y el estado del proceso con el perfil y el enlace que se mandaron, para responder «¿lo abrieron?» sin cruzar datos a mano.

## What Changes

- **Módulo nuevo `application-tracking`** (D1) con Clean Architecture completa: entidad `Application`, máquina de estados en el dominio, casos de uso con repositorios por token y adaptadores Prisma.
- **Entidad `Application`** (D2): empresa, puesto, URL de la vacante opcional (http/https), portal opcional normalizado como el de los enlaces, notas, estado, fecha de postulación, fecha del último cambio de estado, y vínculos opcionales con un `CuratedProfile` y con un `ShareLink`. Sin datos de contacto de personas (P15 = A). Textos planos, no bilingües (D3).
- **Siete estados y transiciones válidas en el dominio** (D4): `DRAFT`, `APPLIED`, `INTERVIEWING`, `OFFER`, `ACCEPTED`, `REJECTED` y `WITHDRAWN`. Una transición inválida devuelve **422** (D5) con una base de error compartida nueva, `RuleViolationError`.
- **La API publica las transiciones posibles** (`nextStatuses`) de cada postulación (D6): el panel no duplica la tabla.
- **Vínculo con perfil y enlace** (D7): el enlace tiene que ser `MANUAL`, del perfil elegido y no estar asociado a otra postulación (409). Un enlace revocado se acepta.
- **«Abierto el…»** (D8): primera visita `HUMAN` atribuida al enlace, con la cantidad y la última apertura, en **dos consultas** por listado (sin N+1), reusando `countOpensByShareLink`, que suma `firstOpenedAt`.
- **CRUD bajo `/api/admin/applications`** (D9) con el guard de sesión: `GET` (filtro `status`), `POST`, `GET /:id`, `PATCH /:id` (incluye el cambio de estado) y `DELETE /:id`; `GET /summary` con los conteos por estado.
- **Export CSV** (D10): `GET /api/admin/applications/export` con el mismo filtro, UTF-8 con BOM, CRLF, todas las celdas entre comillas, **neutralización de fórmulas** (`=`, `+`, `-`, `@`, tabulación y retorno de carro) y `Content-Disposition: attachment; filename="postulaciones-AAAA-MM-DD.csv"`.
- **Pantalla Postulaciones** (`/admin/postulaciones`, D11): ítem en la navegación, lista filtrable por estado (filtro en la URL), diálogo con React Hook Form + Zod, borrado con confirmación y botón **Exportar CSV**.
- **Resumen en el dashboard** (D12): una franja de una línea con las postulaciones activas por estado y un enlace a la pantalla, sin tarjetas nuevas ni dependencia del rango de fechas.
- **Migración solo aditiva** (D13): tabla `Application`, enum `ApplicationStatus` e índices. Sin dependencias nuevas.
- **Contrato y docs:** `backend/openapi.json` y `frontend/src/shared/types/api.d.ts` regenerados; `docs/MANUAL.md` e `index.html` (**TC-46**, pantalla nueva del backoffice, glosario) con la captura `bo-postulaciones.jpg`; `docs/ARCHITECTURE.md` (endpoints), `docs/CHANGELOG.md`; la línea del roadmap en `CLAUDE.md` al archivar.

## Non-goals

- **Rutas públicas o cobertura en público** (P14 = A): nada de este módulo llega a la vista pública, al sitemap ni al head.
- **Datos de contacto** (nombre, email o teléfono del reclutador) (P15 = A).
- **Kanban** o arrastrar tarjetas entre columnas: la propuesta lo deja fuera del MVP.
- **Embudo por postulación** (ítem 5.2, `GetApplicationFunnelUseCase`): otro change. El resumen del dashboard es un conteo por estado, no un embudo.
- **Historial de estados** (una fila por transición): se guarda solo el último cambio (`statusChangedAt`). Ver D4.
- **Recordatorios, fechas de seguimiento o notificaciones** (ítem 3.3, `add-open-notifications`, queda después del deploy).
- **Crear enlaces desde el diálogo**: se crean en la pestaña Publicación del constructor, como hoy.
- **Importar desde la vacante** (`add-job-posting-intake`) o desde un CSV.
- **Paginación**: el volumen esperado es de cientos de filas por año (ver Risks en `design.md`).
- **Datos de ejemplo en el seed**: las postulaciones de la captura las crea `manual:capture` sobre la base de ejemplo (D14), sin tocar `docs/examples/cv-data.example.json`.

## Capabilities

### New Capabilities

- `application-tracking`: entidad, estados y transiciones, vínculos con perfil y enlace, «abierto el…», API del panel, export CSV, pantalla Postulaciones y ausencia de rutas públicas.

### Modified Capabilities

- `admin-analytics-dashboard`: ADDED *Resumen de postulaciones en el dashboard*. No se reescribe ningún requisito vigente.
- `api-platform`: ADDED *Violación de una regla de negocio con 422*. No se reescribe *Errores en formato JSON consistente*, que sigue igual para los códigos que ya nombra.
- `platform-manual`: MODIFIED *Manual del backoffice por pantalla* (suma la pantalla Postulaciones).

## Impact

- **Base (`backend/prisma/`):** modelo `Application`, enum `ApplicationStatus`, relaciones opcionales con `CuratedProfile` y `ShareLink` (`onDelete: SetNull`), índice único por `shareLinkId` (`@unique`; Postgres admite varios nulos) e índices por `status` y `updatedAt`. Una migración nueva, aditiva.
- **Backend:**
  - `modules/application-tracking/` nuevo: `domain/` (entidad, `ApplicationStatus`, `APPLICATION_TRANSITIONS`, `validateApplicationFields`, errores, puertos `ApplicationRepository` y `ApplicationReferenceReader`), `application/` (casos de uso, DTOs, `toApplicationCsv`), `infrastructure/` (controller, DTOs de entrada, adaptadores Prisma) y `application-tracking.module.ts`.
  - `shared/domain/errors/rule-violation.error.ts` y su mapeo a 422 en `domain-error.mapper.ts`.
  - `shared/domain/normalize-source.ts`: `normalizeSource` se muda desde `curated-profile/domain/services/` (que lo re-exporta) para que lo usen los dos módulos.
  - `analytics`: `ShareLinkOpens.firstOpenedAt` (`_min.viewedAt` en el mismo `groupBy`).
  - `app.module.ts`: importa `ApplicationTrackingModule`.
- **Frontend (`frontend/src/features/backoffice/`):** `applications/` (página, diálogo, schema Zod, hooks, descarga del CSV), ítem en `NAV` de `shared/AdminShell.tsx`, ruta en `BackofficeApp.tsx` y la franja en `dashboard/DashboardPage.tsx`; `api.d.ts` regenerado.
- **Scripts:** `frontend/scripts/check-a11y.mjs` (rutas `/admin/postulaciones` y el diálogo con errores) y `frontend/scripts/capture-manual.mjs` (captura y postulaciones ficticias idempotentes).
- **Docs:** `docs/MANUAL.md`, `docs/manual/index.html`, `docs/manual/bo-postulaciones.jpg`, `docs/ARCHITECTURE.md`, `docs/CHANGELOG.md`, `CLAUDE.md`.
- **Sin cambios** en Caddy, la CSP, CORS, la cookie, las variables de entorno, el seed ni las dependencias de `package.json`. El arranque público no cambia: todo va en el chunk del panel.
