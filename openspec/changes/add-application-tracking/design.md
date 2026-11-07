# Design — add-application-tracking

## Context

Ver `proposal.md`. Estado verificado el 7 de noviembre de 2026 sobre `main` (`e337efd`, sin changes activos):

- **Enlaces.** `ShareLink { id, code @unique, curatedProfileId, label, portal?, kind (MANUAL | LINKEDIN_POST), createdAt, revokedAt? }`, con cascada desde el perfil. La entidad de dominio expone `belongsTo(profileId)`. `normalizeSource` (portal: minúsculas, `^[a-z0-9][a-z0-9-]{0,31}$`) vive en `curated-profile/domain/services/`.
- **Aperturas.** `ProfileViewRepository.countOpensByShareLink(ids)` (módulo `analytics`, exportado por `AnalyticsModule`) hace un solo `groupBy` por `shareLinkId` con `kind = HUMAN` y devuelve `opens` y `lastOpenedAt` (`_max.viewedAt`). `ListShareLinksUseCase` de `curated-profile` ya lo consume por el token `PROFILE_VIEW_REPOSITORY`: es el precedente de dependencia entre módulos por puerto.
- **Errores.** `toHttpException` mapea `NotFoundError` → 404, `AccessDeniedError` → 401, `ValidationError` → 400 y `ConflictError` → 409; cualquier otro `DomainError` → 500. No hay base para 422, aunque `AllExceptionsFilter` ya conoce el nombre `Unprocessable Entity`.
- **API del panel.** Convención `GET|POST /api/admin/<recurso>` y `GET|PATCH|DELETE /api/admin/<recurso>/:id`, `JwtAuthGuard` a nivel de controller y `adminValidationPipe` (rechaza campos desconocidos). El reloj es un puerto (`CLOCK`).
- **Panel.** `NAV` de `AdminShell.tsx` tiene siete secciones; la barra horizontal aparece desde `xl` con `overflow-x-auto` y por debajo hay menú lateral. Las páginas de lista (`ExperiencesPage`) usan `PageHeader`, `EmptyState`/`ErrorPanel`/`LoadingRows`, un diálogo con RHF + `zodResolver`, `ConfirmDialog` para borrar y `notifySuccess`/`notifyError`. El dashboard tiene tres `StatCard` y tablas por rango.
- **Herramientas.** `check-a11y.mjs` recorre una lista fija de rutas del panel (incluye `admin-experiencias-error` con un diálogo con errores). `capture-manual.mjs` solo escribe el login y, de forma idempotente, un enlace de seguimiento en la base de ejemplo.

## Goals / Non-Goals

**Goals:** que el owner registre cada postulación con su perfil y su enlace, mueva su estado solo por caminos válidos, vea si el reclutador abrió el link y exporte todo a una planilla sin riesgo de fórmulas; sin rutas públicas, sin N+1 y sin agrandar el dashboard.

**Non-Goals:** ver `proposal.md` § Non-goals.

## Decisions

### D1 — Módulo propio `application-tracking`, con puertos hacia los otros dos

- `backend/src/modules/application-tracking/{domain,application,infrastructure}` y `application-tracking.module.ts`, importado en `AppModule`. Importa `AnalyticsModule` para el token `PROFILE_VIEW_REPOSITORY`, como ya hace `curated-profile`.
- Para validar el perfil y el enlace define su propio puerto de lectura en `domain/repositories/`: `ApplicationReferenceReader { findProfile(id): Promise<{ id; slug } | null>; findShareLink(id): Promise<{ id; curatedProfileId; kind; label; code; revokedAt } | null> }`. Su adaptador Prisma vive en `application-tracking/infrastructure/persistence/` y solo lee.
- `curated-profile` no cambia de comportamiento ni importa nada del módulo nuevo.

Alternativas descartadas:
- **Dentro de `curated-profile`.** Mezcla el núcleo público con un CRM privado y agranda un módulo que la propuesta (§ 5.1) ya separa.
- **Importar `CURATED_PROFILE_REPOSITORY` y `SHARE_LINK_REPOSITORY`.** Acopla el CRM a entidades completas (tema, overrides, secciones) para leer dos campos; un puerto chico de lectura es suficiente.

### D2 — Entidad `Application`

| Campo | Tipo | Regla |
|---|---|---|
| `company` | texto | obligatorio, 1 a 120 caracteres tras recortar |
| `role` | texto | obligatorio, 1 a 160 tras recortar |
| `jobUrl` | texto o nulo | URL absoluta http/https (`isHttpUrl`), ≤ 2048 |
| `portal` | texto o nulo | `normalizeSource`; vacío → nulo; inválido → 400 |
| `notes` | texto o nulo | ≤ 5000; vacío → nulo |
| `status` | `ApplicationStatus` | ver D4 |
| `appliedAt` | fecha `AAAA-MM-DD` o nula | ver D4 |
| `statusChangedAt` | instante | lo fija el dominio con el reloj |
| `curatedProfileId` | id o nulo | ver D7 |
| `shareLinkId` | id o nulo | ver D7 |
| `createdAt`, `updatedAt` | instantes | Prisma |

- Sin datos de contacto de personas (P15 = A). Las notas son texto libre del owner; la pantalla avisa «No guardes datos de contacto de personas» bajo el campo.
- `validateApplicationFields` (servicio puro de dominio) aplica las reglas y devuelve `Result<ApplicationFields, ValidationError>`. El DTO (`class-validator`) es el primer filtro; el dominio manda.

Alternativa descartada: **contacto opcional** (P15 = B). El owner eligió A: evita datos personales de terceros y su tratamiento.

### D3 — Textos planos, no bilingües

Las postulaciones no se muestran en público y el panel está en español: `company`, `role`, `notes` y `portal` son `String`, no `LocalizedText`. Es la regla de `docs/I18N.md` para campos no traducibles.

Alternativa descartada: **`{ es, en }`.** Duplica la carga sin un lector que lo use.

### D4 — Siete estados y sus transiciones

Camino principal: `DRAFT → APPLIED → INTERVIEWING → OFFER → ACCEPTED`. Salidas: `REJECTED` y `WITHDRAWN`. Reapertura: `REJECTED`/`WITHDRAWN → APPLIED`.

| Desde | Hacia |
|---|---|
| `DRAFT` (por postular) | `APPLIED`, `WITHDRAWN` |
| `APPLIED` (postulada) | `INTERVIEWING`, `OFFER`, `REJECTED`, `WITHDRAWN` |
| `INTERVIEWING` (en entrevistas) | `OFFER`, `REJECTED`, `WITHDRAWN` |
| `OFFER` (oferta) | `ACCEPTED`, `REJECTED`, `WITHDRAWN` |
| `ACCEPTED` (aceptada) | — (final) |
| `REJECTED` (rechazada) | `APPLIED` |
| `WITHDRAWN` (retirada) | `APPLIED` |

- La tabla vive en el dominio como `APPLICATION_TRANSITIONS: Readonly<Record<ApplicationStatus, readonly ApplicationStatus[]>>` y la consulta `Application.transitionTo(next, now)`, que devuelve `Result<Application, InvalidApplicationTransitionError>`. Pasar al mismo estado es un no-op (no cambia `statusChangedAt`) y no es error.
- **Activas** = `DRAFT`, `APPLIED`, `INTERVIEWING` y `OFFER`; **cerradas** = las otras tres. El grupo vive en el dominio (`ACTIVE_APPLICATION_STATUSES`).
- `APPLIED → OFFER` existe porque hay ofertas sin entrevista formal. `OFFER → WITHDRAWN` es «la rechacé yo»; `OFFER → REJECTED`, «la retiró la empresa».
- Reabrir (`REJECTED`/`WITHDRAWN → APPLIED`) cubre un proceso que vuelve y un clic equivocado; `ACCEPTED` es final.
- **Creación:** se puede crear en cualquier estado (registrar procesos ya avanzados); no hay transición que validar.
- **`appliedAt`:** con `DRAFT` tiene que ser nula (400). En cualquier otro estado, si falta, el dominio la fija con la fecha UTC del reloj al crear o al salir de `DRAFT`; si viene, no puede ser posterior al día UTC del reloj más uno (tolerancia de zona horaria; si no, 400). Reabrir no la cambia.
- **`statusChangedAt`:** se fija al crear y en cada transición efectiva.

Alternativas descartadas:
- **Historial de estados** (tabla `ApplicationEvent`). Sirve al embudo (5.2) y a una línea de tiempo; para el MVP basta el último cambio, y la tabla se puede sumar sin migrar los datos.
- **Cualquier estado a cualquier estado.** Pierde la garantía que pide la ficha (422) y la semántica de los conteos.
- **Estados finales sin reabrir.** Un clic equivocado en *Rechazada* no tendría arreglo desde el panel.

### D5 — 422 con una base de error compartida

- `RuleViolationError extends DomainError` en `shared/domain/errors/` («la petición está bien formada pero viola una regla del dominio») y su rama en `toHttpException` → `UnprocessableEntityException` (cuerpo `{ statusCode: 422, message, error: "Unprocessable Entity" }`).
- `InvalidApplicationTransitionError extends RuleViolationError` con el mensaje `Transición de estado inválida: <DESDE> → <HACIA>` y `code = 'INVALID_APPLICATION_TRANSITION'`.
- Un `status` que no es del enum sigue siendo 400 (validación de entrada).

Alternativas descartadas:
- **409.** El estado guardado no «choca» con otro recurso; la regla es del dominio y la ficha pide 422.
- **Mapear en el controller.** Cada módulo futuro repetiría el `if`; la base compartida deja una sola regla (ADDED en `api-platform`).

### D6 — `nextStatuses` en la respuesta

Cada postulación de la API trae `nextStatuses: ApplicationStatus[]`, calculado con `APPLICATION_TRANSITIONS`. El panel arma el selector de estado con el actual más esos, sin copiar la tabla.

Alternativa descartada: **la tabla duplicada en el frontend.** Dos fuentes que pueden divergir; el 422 seguiría protegiendo, pero el selector ofrecería opciones que fallan.

### D7 — Vínculos con perfil y enlace

- `curatedProfileId` opcional; si viene, el perfil tiene que existir (si no, 400 `El perfil curado no existe`). Puede estar archivado.
- `shareLinkId` opcional y **requiere** `curatedProfileId`. El enlace tiene que existir, pertenecer a ese perfil y ser `MANUAL` (si no, 400). Un enlace revocado se acepta: sigue mostrando sus aperturas pasadas.
- Un enlace solo puede estar en una postulación: `shareLinkId @unique`; el caso de uso lo verifica antes y el adaptador traduce `P2002` a `ConflictError` (409 `El enlace ya está asociado a otra postulación`).
- Cambiar o quitar el perfil sin quitar el enlace, si el enlace deja de pertenecer, es 400.
- Si el perfil o el enlace se borran, la relación queda en nulo (`onDelete: SetNull`) y la postulación sigue.

Alternativas descartadas:
- **Aceptar `LINKEDIN_POST`.** Lo abre cualquiera que vea la publicación: «abierto el…» no hablaría de esa empresa.
- **Un enlace en varias postulaciones.** Mezcla las aperturas de destinatarios distintos.
- **Exigir que el enlace esté activo.** Impediría editar una postulación vieja cuyo enlace se revocó.

### D8 — «Abierto el…» sin N+1

- `ShareLinkOpens` suma `firstOpenedAt: Date | null` (`_min.viewedAt`) en el mismo `groupBy` de `countOpensByShareLink`. `ListShareLinksUseCase` lo ignora; su contrato no cambia.
- `ListApplicationsUseCase`: (1) `applications.list({ statuses })` hace **una** consulta con `include` del `slug` del perfil y de `label`, `code` y `revokedAt` del enlace; (2) **una** llamada a `countOpensByShareLink` con todos los `shareLinkId` no nulos de la página. Total: dos consultas, sea cual sea la cantidad de filas. `GetApplicationUseCase` y las respuestas de `POST`/`PATCH` usan la misma llamada con un solo id.
- Salida: `shareLink: { id, label, code, revoked, opens, firstOpenedAt, lastOpenedAt } | null`. Solo cuentan las visitas `HUMAN`, en toda la historia del enlace, igual que `opens` de `share-links`.
- El panel muestra «Abierto el 12/11/2026» (`firstOpenedAt`, fecha local), «Sin abrir» si es nulo, y la cantidad de aperturas en el `title`.

Alternativas descartadas:
- **Una consulta propia en el repositorio de postulaciones.** Duplica la definición de «apertura humana» que ya tiene `analytics`.
- **Contar solo desde `appliedAt`.** El enlace es de esa postulación (D7): las aperturas previas son de la misma persona, por ejemplo cuando se mandó antes de registrarla.

### D9 — API del panel

Controller `admin/applications`, `@UseGuards(JwtAuthGuard)`, `adminValidationPipe`. Las rutas literales se declaran antes de `:id`.

| Método y ruta | Respuesta |
|---|---|
| `GET /api/admin/applications?status=APPLIED,INTERVIEWING` | 200, lista ordenada por `updatedAt` desc e `id` desc; sin `status`, todas. Un valor fuera del enum → 400 |
| `GET /api/admin/applications/summary` | 200, `{ byStatus: Record<ApplicationStatus, number>, active: number }` con ceros incluidos, un solo `groupBy` |
| `GET /api/admin/applications/export?status=…` | 200 `text/csv` (D10) |
| `POST /api/admin/applications` | 201 con la postulación |
| `GET /api/admin/applications/:id` | 200 o 404 |
| `PATCH /api/admin/applications/:id` | 200; campos parciales, incluido `status` (transición, D4) |
| `DELETE /api/admin/applications/:id` | 204 o 404 |

- `PATCH` con `status` y otros campos se aplica en una sola escritura: si la transición es inválida, 422 y nada cambia.
- Sin token, 401 en todas. No hay ninguna ruta fuera de `/api/admin/` (P14 = A): `GET /api/applications` da 404.

Alternativas descartadas:
- **`POST /:id/transition` aparte.** El diálogo edita campos y estado juntos; dos llamadas no serían atómicas.
- **Filtro solo en el cliente.** El CSV necesita el mismo filtro en el servidor.

### D10 — CSV

- `GET /api/admin/applications/export`, mismo `status` que la lista y mismo orden.
- Cabeceras: `Content-Type: text/csv; charset=utf-8`, `Content-Disposition: attachment; filename="postulaciones-AAAA-MM-DD.csv"` (fecha UTC del reloj), `Cache-Control: no-store`.
- Cuerpo: BOM UTF-8 (`﻿`) para que Excel lea los acentos, separador coma, fin de línea CRLF (RFC 4180), **todas** las celdas entre comillas dobles y las comillas internas duplicadas.
- Columnas, en este orden: `Empresa`, `Puesto`, `Estado` (etiqueta en español: Por postular, Postulada, En entrevistas, Oferta, Aceptada, Rechazada, Retirada), `Portal`, `URL de la vacante`, `Fecha de postulación` (`AAAA-MM-DD`), `Último cambio de estado` (ISO 8601 UTC), `Perfil` (slug), `Enlace` (etiqueta), `Abierto el` (ISO 8601 UTC de la primera apertura), `Aperturas`, `Notas`, `Creada`, `Actualizada`. Sin ids ni el código del enlace.
- **Neutralización de fórmulas** (OWASP CSV Injection): si una celda empieza con `=`, `+`, `-`, `@`, tabulación (`\t`) o retorno de carro (`\r`), se le antepone un apóstrofo (`'`) antes de entrecomillarla. Se aplica a todas las celdas, también a las que no vienen del usuario.
- La función es pura (`toApplicationCsv(rows, now)` en `application/services/`) y la prueban tests unitarios; el controller solo pone las cabeceras.
- Sin filas: solo la cabecera.

Alternativas descartadas:
- **Punto y coma** (el Excel en español lo usa por defecto). La coma es el estándar y Google Sheets y LibreOffice la detectan; el manual explica la importación con *Datos → Desde texto* si Excel no separa.
- **Quitar el carácter peligroso.** Cambia el dato (una nota «-30 % de sueldo» perdería el signo); el apóstrofo lo conserva visible.
- **XLSX.** Pide una dependencia nueva.

### D11 — Pantalla Postulaciones

- Ruta `/admin/postulaciones` dentro de `RequireSession`/`AdminLayout`, ítem **Postulaciones** (ícono `Briefcase`) en `NAV` después de **Perfiles curados**. Criterio medible: a 1280 px y a 1536 px la barra horizontal no se desborda (`scrollWidth ≤ clientWidth`); si se desborda, la barra completa pasa a mostrarse desde `2xl` y por debajo queda el menú lateral (la regla de 375 px no cambia).
- **Lista**: tabla con Empresa y puesto, Estado (insignia con contraste AA), Portal, Perfil, Enlace con «Abierto el…»/«Sin abrir» y Fecha de postulación; acciones Editar y Borrar (con `ConfirmDialog`). Filtro **Estado** con `Activas` (por defecto), `Todas` y cada estado; vive en la URL (`?estado=activas|todas|<estado en minúsculas>`), sin `localStorage`. Estado vacío propio por filtro.
- **Diálogo** «Nueva postulación»/«Editar postulación» con RHF + Zod (`applications/application-form.ts`): Empresa, Puesto, URL de la vacante, Portal, Estado (al crear, todos; al editar, el actual más `nextStatuses`), Fecha de postulación (oculta y vacía con *Por postular*; al elegir otro estado se completa con la fecha local de hoy si está vacía), Perfil (select de perfiles curados, opcional), Enlace (select con los enlaces `MANUAL` del perfil elegido, deshabilitado sin perfil; si el portal está vacío, elegir un enlace con portal lo completa) y Notas con el aviso de D2. Usa el guardián de descarte de los demás diálogos (`use-dialog-discard-guard`).
- Mensajes literales (los cita el manual; `manual:check` los busca en `frontend/src`):
  - `Escribí la empresa` · `Escribí el puesto`
  - `Usá como máximo 120 caracteres` (empresa) · `Usá como máximo 160 caracteres` (puesto) · `Usá como máximo 5000 caracteres` (notas)
  - `Usá una URL que empiece con http:// o https://`
  - `Usá solo minúsculas, números y guiones (hasta 32)` (portal)
  - `La fecha no puede ser futura`
  - 422: `Ese cambio de estado no está permitido. Elegí uno de la lista.`
  - 409: `Ese enlace ya está asociado a otra postulación.`
  - toasts: `Postulación creada`, `Postulación actualizada`, `Postulación borrada`
  - vacío: `Todavía no registraste postulaciones` (con `Todas`) y `No hay postulaciones con este estado` (con otro filtro)
- **Exportar CSV**: botón en el encabezado que descarga con `fetch` (cookie de sesión), toma el nombre de `Content-Disposition` y dispara la descarga con un `URL.createObjectURL` temporal; un 401 manda al login como el resto del panel y otro error muestra `No se pudo exportar. Intentá de nuevo.`

Alternativas descartadas:
- **Enlace directo `<a href download>`.** Con la sesión vencida, el navegador guardaría el JSON del 401 como archivo.
- **Página de detalle aparte.** El diálogo alcanza para once campos y sigue el patrón de las demás pantallas.

### D12 — Resumen en el dashboard: una franja, no tarjetas

- Debajo del encabezado y antes de los totales, una línea `Postulaciones activas: 5 · 1 por postular · 2 postuladas · 1 en entrevistas · 1 con oferta` y el enlace **Ver postulaciones** a `/admin/postulaciones`, desde `GET /api/admin/applications/summary`. Los estados en cero se omiten de la línea.
- No depende del rango de fechas (es el estado actual) y lo dice su `aria-label` («Resumen de postulaciones, estado actual»).
- Con `active = 0`: `Sin postulaciones activas` y el mismo enlace. Si la consulta falla, la franja no se muestra y el resto del dashboard sigue (el error no tapa las visitas).

Alternativas descartadas:
- **Una cuarta `StatCard`.** Rompe la grilla de tres y mezcla un conteo actual con cifras del rango.
- **Nada en el dashboard.** La propuesta pide MODIFIED en `admin-analytics-dashboard` y la línea cuesta una consulta barata.

### D13 — Migración aditiva, sin dependencias nuevas

```prisma
enum ApplicationStatus { DRAFT APPLIED INTERVIEWING OFFER ACCEPTED REJECTED WITHDRAWN }

model Application {
  id               String            @id @default(cuid())
  company          String
  role             String
  jobUrl           String?
  portal           String?
  notes            String?
  status           ApplicationStatus @default(DRAFT)
  appliedAt        DateTime?         @db.Date
  statusChangedAt  DateTime          @default(now())
  curatedProfile   CuratedProfile?   @relation(fields: [curatedProfileId], references: [id], onDelete: SetNull)
  curatedProfileId String?
  shareLink        ShareLink?        @relation(fields: [shareLinkId], references: [id], onDelete: SetNull)
  shareLinkId      String?           @unique
  createdAt        DateTime          @default(now())
  updatedAt        DateTime          @updatedAt

  @@index([status])
  @@index([updatedAt])
  @@index([curatedProfileId])
}
```

- `CuratedProfile` y `ShareLink` suman solo el campo de relación inversa (sin columnas). La migración es `CREATE TYPE`, `CREATE TABLE`, índices y claves foráneas: ningún `ALTER` de tablas existentes salvo las FK nuevas, ningún `UPDATE` ni `DROP`.
- Todo lo necesario ya está en `package.json` (Prisma, class-validator, RHF, Zod, sonner, lucide).

Alternativa descartada: **`status` como texto.** El enum de Postgres impide valores fuera del dominio también para quien escriba con SQL.

### D14 — Captura del manual con postulaciones ficticias

`capture-manual.mjs` suma la captura `bo-postulaciones.jpg` (filtro `Todas`) y, antes de tomarla, crea por la API tres postulaciones ficticias en la base de ejemplo **solo si no existe ninguna con esa empresa** (idempotente, como el enlace de seguimiento que ya crea): una `INTERVIEWING` con un enlace de un perfil de ejemplo, una `APPLIED` sin enlace y una `REJECTED`. Las empresas son las ficticias del archivo de ejemplo. No hace ningún `PATCH` ni `DELETE`.

Alternativa descartada: **sumarlas a `cv-data.example.json`.** Exige ampliar el formato del seed, `seed:example:verify` y la spec `example-seed-data` para un dato que solo usa la captura.

### D15 — `normalizeSource` pasa a `shared/domain`

La función es pura y ahora la usan dos módulos: se muda a `shared/domain/normalize-source.ts` y `curated-profile/domain/services/normalize-source.ts` la re-exporta para no tocar sus importaciones. Así el dominio de `application-tracking` no importa el de `curated-profile`.

Alternativa descartada: **importarla desde `curated-profile/domain`.** Funciona, pero acopla dos dominios por una utilidad.

## Risks / Trade-offs

- **[Sin paginación]** → con cientos de filas por año, la lista y el CSV son una consulta indexada y un `groupBy` por `IN` de ids; si pasara de unas 2000, se suma paginación por cursor sin cambiar el contrato de los filtros.
- **[Notas con datos de terceros]** → la regla P15 = A no se puede forzar sobre texto libre; el aviso bajo el campo y el manual lo piden. Las notas no viajan a los logs (el serializador de `req` no incluye el cuerpo).
- **[El CSV es un volcado de datos personales del owner]** → solo con sesión, `Cache-Control: no-store` y descarga explícita.
- **[Apóstrofo visible en Excel]** → una celda que empieza con `-` o `+` se ve con `'` adelante; es el costo de no ejecutar fórmulas.
- **[Barra del panel con ocho ítems]** → D11 fija el criterio medible y la salida (`2xl`).
- **[Reloj y zona horaria]** → `appliedAt` se guarda como fecha sin hora; la tolerancia de un día evita rechazar «hoy» en Argentina después de las 21:00 (UTC−3).
- **[Changes en paralelo]** → TC-47 y TC-48 son de otros dos changes; el número de la pantalla del backoffice (B15) puede chocar en `docs/MANUAL.md`: se toma el siguiente libre al implementar y se resuelve en el merge.

## Migration Plan

1. **Migración** `<timestamp>_add_application_tracking`: generada con `--create-only` contra una base descartable (`portfolio_apps_check`) y revisada a mano (solo `CREATE TYPE`, `CREATE TABLE`, `CREATE INDEX` y `ADD CONSTRAINT ... FOREIGN KEY` sobre la tabla nueva).
2. **Deploy:** corre en el `preDeployCommand`. Sin backfill: la tabla nace vacía.
3. **Base local del owner (`portfolio`, 5434):** la migra él con `npm run prisma:migrate`; ninguna tarea la toca.
4. **Rollback:** revertir el código deja la tabla sin uso. Quitarla exige una migración inversa con `DROP TABLE` y `DROP TYPE` (pierde las postulaciones cargadas).

## Open Questions

Ninguna bloqueante. P14 y P15 quedaron resueltas con A el 2026-11-07. Lo que quedó fuera (historial, embudo, kanban, recordatorios, contacto) está en `proposal.md` § Non-goals.
