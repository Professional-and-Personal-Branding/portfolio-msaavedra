# Verification — add-auth-and-crud (Fase 3)

Verifier: criterios de aceptación de `docs/SPECS-POR-FASE.md` § Fase 3 y escenarios de los 7 specs del change (5 nuevos + 2 deltas). Fecha: 2026-09-07. Entorno: Windows 11, Node 22, Postgres 16 (docker compose), `PORT=3300`.

Ciclos de reparación usados: **2 de 3**. Estado final: **todo en verde**.

## Criterios de aceptación de la Fase 3

| # | Criterio | Comando / evidencia | Resultado |
|---|---|---|---|
| 1 | `POST /api/auth/login` válido → JWT; inválido → 401 | curl con `ADMIN_EMAIL`/`ADMIN_PASSWORD` → `tokenType: Bearer`, `expiresIn: 86400`, token JWT (3 segmentos); contraseña incorrecta → 401. e2e `auth.e2e-spec` (ok, 401 mismo mensaje para email inexistente y password incorrecta, 400 cuerpo inválido, `lastLoginAt` actualizado) | ✅ |
| 2 | Escrituras rechazan requests sin token válido | `POST /api/admin/experiences` sin token → 401; e2e cubre GET/POST/PATCH/DELETE en `/api/admin/*`, firma inválida, expirado, token de admin borrado → 401 | ✅ |
| 3 | Lecturas públicas siguen sin token | `/api/profile`, `/api/experiences`, `/api/curated-profiles/all` → 200 sin `Authorization` | ✅ |
| 4 | CRUD de experiencias end-to-end | e2e "ciclo completo": crear (201) → aparece en `GET /api/experiences` y en `java-senior-backend` → `PATCH tags` la saca del perfil → `PATCH visible:false` la saca de público (404 en detalle) pero sigue en admin con `role {es,en}` → `DELETE` 204 → 404 | ✅ |
| 5 | CRUD de perfiles curados edita `filterTags`, `includeIds`, `excludeIds` | e2e: `PATCH filterTags ['ruby']` → resolución solo `ruby`; `includeIds [kiwox]` + `excludeIds [novacomp]` → efecto verificado en `GET /api/curated-profiles/tech-lead-dotnet`; PROTECTED con token → 401/200 público; mutaciones revertidas | ✅ |
| 6 | Visitar un perfil curado público registra `ProfileView` con slug, locale y timestamp | curl `GET /api/curated-profiles/all?locale=en` → `ProfileView` con `locale: en`, `userAgent: CurlUA`, `ipHash` 64 hex, `viewedAt` reciente; `views` del perfil +1; e2e: 401 y 404 no registran; `GET /api/admin/analytics/views` → `byProfile [{all,1}]`, `byLocale [{en,1}]`, `byDay [{2026-09-07,1}]` | ✅ |
| 7 | Contraseñas hasheadas | `AdminUser.passwordHash` empieza con `$argon2id$` y no contiene la contraseña (unit `Argon2PasswordHasher`, e2e, consulta directa tras `admin:bootstrap`) | ✅ |

## Escenarios de los specs

| Spec | Cobertura | Suite |
|---|---|---|
| `admin-authentication` | login ok/401/400, mismo mensaje, `lastLoginAt`; JWT válido/firma inválida/expirado/malformado; `/api/admin/*` 401 en todos los métodos, públicas abiertas; hash argon2id; bootstrap: crea, re-ejecución actualiza sin duplicar, exit 1 sin `ADMIN_PASSWORD`, seed preserva admin (1 admin antes y después de `npm run seed`) | `auth.use-cases.spec` (3), `argon2-password-hasher.spec` (2), `jwt.strategy.spec` (2), `auth.e2e-spec` (11), manual A/B/C |
| `admin-experience-crud` | listado crudo con ocultas, 404, creación validada (fecha, campo desconocido, sin `es`, regla `current`/`endDate`), patch parcial (tags, visible), borrado 204/404, referencia huérfana en overrides | `validate-experience.spec` (3), `experience-admin.use-cases.spec` (5), `admin.e2e-spec` (3) |
| `admin-skill-crud` | crear categoría, skill con tags visible en perfil curado, patch tags lo saca, mover de categoría, borrado en cascada, 404s, nombre sin `es` | `skill-admin.use-cases.spec` (5), e2e (2) |
| `admin-curated-profile-crud` | listado con campos internos, creación mínima resoluble, 409 slug, 400 slug/PROTECTED sin token/`themeId`, patch filtros/overrides/visibilidad, slug ocupado, borrado | `validate` + `curated-profile-admin.use-cases.spec` (4), e2e (3) |
| `profile-view-analytics` | registro con locale/UA/ipHash sin IP, `views++`, 401/404 no registran, agregado total/perfil/idioma/día, 401 sin token, rango inválido 400 | `aggregate-profile-views.use-case.spec` (2), resolver spec (3), e2e (3), curl |
| `api-platform` (MODIFIED) | `JWT_SECRET` ausente/corta → exit 1 (`JWT_SECRET must be longer than or equal to 16 characters`), defaults, `JWT_EXPIRES_IN`; 400/409 en formato consistente; preflight CORS permite `POST` y `Authorization` | `env.validation.spec` (7), `domain-error.mapper.spec` (5), e2e preflight, manual D |
| `curated-profile-resolution` (ADDED) | con `viewContext` registra y el resultado es idéntico; sin contexto no registra; `record` que lanza no altera el `Result` | `curated-profile.use-cases.spec` (3) |

**Totales:** `npm test` → 32 suites / 157 tests ✅ · `npm run test:e2e` → 4 suites / 65 tests ✅ (26 Fase 1 + 17 Fase 2 + 11 auth + 11 backoffice) · `npm run lint` → 0 problemas · `tsc --noEmit` y `npm run build` → OK · Swagger: 11 rutas `auth`/`admin` documentadas con `securitySchemes.bearer`.

## Ciclos de reparación

1. **`@nestjs/jwt@12` es ESM puro** y Jest (CommonJS) no puede cargarlo (`Must use import to load ES Module`). Fix: `@nestjs/jwt@~11.0.2` (CommonJS, misma línea que el resto del stack Nest 11). El diseño D2 mencionaba 12.0.1 por su peer range; queda corregido.
2. **Campo desconocido devolvía 201**: el `ValidationPipe` global con `whitelist` corre antes que el pipe del controller y elimina el campo en silencio, así que `forbidNonWhitelisted` nunca lo veía. Fix: el pipe global queda solo con `transform`; `adminValidationPipe` (whitelist + forbid) se aplica en los controllers con cuerpo (admin y `auth`). Una corrida abortada dejó una experiencia "ACME E2E" en la base; se agregó `cleanupE2eLeftovers()` al `beforeAll` del e2e de backoffice.

## Desvíos respecto a la propuesta

- `@nestjs/jwt` 11.0.2 en lugar de 12.0.1 (ver ciclo 1). Sin impacto funcional.
- El pipe estricto también se aplica a `POST /api/auth/login` (campos desconocidos → 400); la spec solo exigía validar email/password.
- `LoginUseCase` no ejecuta un `verify` "dummy" cuando el email no existe, así que el tiempo de respuesta difiere ligeramente entre email inexistente y contraseña incorrecta (el mensaje es idéntico). Se anota para Fase 6 junto con el rate limiting.
