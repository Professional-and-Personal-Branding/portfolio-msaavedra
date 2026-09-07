# Tasks — add-auth-and-crud

> Referencias: `proposal.md`, `specs/*/spec.md`, `design.md` (D1–D13). Criterios de negocio: `docs/SPECS-POR-FASE.md` § Fase 3.

## 1. Shared, configuración y dependencias (D6, D11)

- [x] 1.1 Instalar `@nestjs/jwt`, `@nestjs/passport@~11`, `passport`, `passport-jwt`, `argon2` y `@types/passport-jwt`. Verificar: `npm ls` sin conflictos de peer y `node -e "require('argon2')"` OK.
- [x] 1.2 `EnvironmentVariables`: `JWT_SECRET` (min 16), `JWT_EXPIRES_IN` (regex, default `1d`), `ANALYTICS_SALT` opcional; `AppConfig.jwt`/`analyticsSalt`; `.env.example` con `ADMIN_NAME` y `ANALYTICS_SALT` documentados; `.env` local con secreto fuerte. Verificar: `env.validation.spec.ts` cubre `JWT_SECRET` ausente/corta; arranque sin `JWT_SECRET` → exit 1 mencionándola.
- [x] 1.3 `shared/domain/errors/{validation,conflict}.error.ts` + export; `toHttpException` mapea a 400/409. Verificar: `domain-error.mapper.spec.ts` en verde con los 4 códigos.
- [x] 1.4 `shared/infrastructure/http/dto/localized.dto.ts` (`LocalizedTextDto`, `LocalizedListDto`) y helper `ip-hash.ts` (HMAC-SHA256). Verificar: unit test del hash (64 hex, distinto por salt) y del DTO (rechaza `es` faltante).
- [x] 1.5 `buildCorsOptions`: métodos `GET,HEAD,POST,PATCH,DELETE,OPTIONS` y headers `Authorization`, `X-Access-Token`. Verificar: e2e preflight `OPTIONS /api/admin/experiences` permite `POST` y `authorization`.

## 2. Módulo `auth` (D1, D2, D3, D4, D12)

- [x] 2.1 Domain: `AdminUser` entity, `AdminUserRepository` (`findByEmail`, `findById`, `upsert`, `touchLastLogin`), puertos `PasswordHasher` y `TokenSigner`, `InvalidCredentialsError`. Verificar: `tsc`; test de arquitectura en verde.
- [x] 2.2 Application: `LoginUseCase` (+spec: ok, email inexistente, password incorrecta, mismo mensaje, `touchLastLogin`), `GetCurrentAdminUseCase`, `AuthOutput`. Verificar: specs en verde con puertos mock.
- [x] 2.3 Infrastructure: `PrismaAdminUserRepository`, `Argon2PasswordHasher` (+spec: `$argon2id$`, verify true/false), `JwtTokenSigner` sobre `JwtService`, `JwtStrategy` (+spec: admin inexistente → Unauthorized), `JwtAuthGuard`, `@CurrentAdmin()`. Verificar: specs en verde.
- [x] 2.4 `AuthController` (`POST /api/auth/login`, `GET /api/auth/me`), `LoginDto`, docs Swagger, `AuthModule` (`JwtModule.registerAsync`, `PassportModule`), registro en `AppModule`, `swagger.ts` con `addBearerAuth()` y tags `auth`/`admin`. Verificar: `curl -X POST :3300/api/auth/login` → 200 con token; `/me` con Bearer → 200; sin → 401.
- [x] 2.5 `scripts/bootstrap-admin.ts` + script `admin:bootstrap` (upsert, exit 1 sin email/password, warning con placeholder). Verificar: ejecutar dos veces con contraseñas distintas → un solo `AdminUser`, login con la nueva; `npm run seed` conserva el admin.

## 3. CRUD de experiencias (D5, D6, D7, D8)

- [x] 3.1 Domain: `NewExperienceProps`, `Experience.with()`, reglas (`endDate` requiere `!current`, `startDate <= endDate`) como función `validateExperience()` → `Result<void, ValidationError>`; puerto ampliado. Verificar: spec de reglas.
- [x] 3.2 Application: `ListAllExperiencesUseCase`, `GetExperienceUseCase`, `CreateExperienceUseCase`, `UpdateExperienceUseCase`, `DeleteExperienceUseCase` + `experience.admin-mapper.ts`; specs con repo mock (404, validación, parcial). Verificar: specs en verde.
- [x] 3.3 Infrastructure: `PrismaExperienceRepository` con métodos de escritura; DTOs `create-experience.dto.ts` / `update-experience.dto.ts` (`PartialType`); `AdminExperienceController` con `JwtAuthGuard`, `@ApiBearerAuth`, `forbidNonWhitelisted`; `ExperienceModule` importa `AuthModule`. Verificar: curl crear/patch/delete con Bearer; sin Bearer → 401.

## 4. CRUD de skills (D5, D6, D7, D8)

- [x] 4.1 Domain: `NewSkillCategoryProps`, `NewSkillProps`, `with()` en ambas entidades, puerto ampliado (categorías y skills). Verificar: `tsc`.
- [x] 4.2 Application: casos de uso `CreateSkillCategory`, `UpdateSkillCategory`, `DeleteSkillCategory`, `ListSkillCategoriesAdmin`, `CreateSkill`, `UpdateSkill` (incluye mover de categoría), `DeleteSkill` + admin mapper; specs con repo mock (404 categoría/skill, categoría destino inexistente). Verificar: specs en verde.
- [x] 4.3 Infrastructure: adaptador Prisma (borrado en cascada ya definido en schema), DTOs, `AdminSkillController` (`/admin/skill-categories`, `/admin/skill-categories/:id/skills`, `/admin/skills/:id`), `SkillModule` con controller. Verificar: curl crear categoría + skill → aparece en `GET /api/curated-profiles/java-senior-backend`.

## 5. CRUD de perfiles curados (D5, D6, D7, D8)

- [x] 5.1 Domain: `NewCuratedProfileProps`, `with()`, `validateCuratedProfile()` (PROTECTED ⇒ accessToken; slug kebab-case) → `ValidationError`; puerto ampliado con `existsBySlug`. Verificar: spec de reglas.
- [x] 5.2 Application: `ListAllCuratedProfilesUseCase`, `GetCuratedProfileAdminUseCase`, `CreateCuratedProfileUseCase` (slug único → `ConflictError`; `themeId` existente vía `ThemeRepository`), `UpdateCuratedProfileUseCase` (coherencia sobre el estado resultante; slug único al cambiar), `DeleteCuratedProfileUseCase` + admin mapper; specs con repos mock. Verificar: specs en verde (≥12 casos).
- [x] 5.3 Infrastructure: adaptador Prisma (`existsBySlug`, CRUD, `Visibility` enum), DTOs (`slug` regex, `accentColor` hex, `visibility` enum, `themeOverrides` objeto), `AdminCuratedProfileController`. Verificar: curl crear → 201; slug repetido → 409; PROTECTED sin token → 400.

## 6. Analítica de visitas (D9, D10)

- [x] 6.1 Módulo `analytics`: `ProfileView` entity, `ProfileViewRepository { record, aggregate }`, adaptador Prisma con transacción (`create` + `views++`) y agregado (`groupBy` + `queryRaw` por día). Verificar: `tsc`; test de arquitectura.
- [x] 6.2 `ResolveCuratedProfileUseCase` acepta `viewContext?` y registra con try/catch + `Logger.warn`; el controller público arma el contexto (`ip-hash`, `referer`, `user-agent`, locale servido); `CuratedProfileModule` importa `AnalyticsModule`. Verificar: spec del caso de uso: con contexto registra, sin contexto no, `record` que lanza no altera el `Result`.
- [x] 6.3 `AggregateProfileViewsUseCase` + `AdminAnalyticsController` (`GET /api/admin/analytics/views`, `from`/`to` `@IsISO8601`, default 30 días). Verificar: unit test del rango por defecto; curl con Bearer → JSON con `total/byProfile/byLocale/byDay`.

## 7. Verificación integral (Verifier)

- [x] 7.1 `test/auth.e2e-spec.ts` (D13): login ok/401/400, `/me`, firma inválida, expirado, 401 en admin sin token (GET/POST/PATCH/DELETE), públicas abiertas, `passwordHash` empieza con `$argon2id$`, preflight CORS. Verificar: en verde.
- [x] 7.2 `test/admin.e2e-spec.ts`: CRUD experiencias, skills y perfiles curados end-to-end con efectos verificados en rutas públicas; analytics (delta de `ProfileView` y `views`, `ipHash` sin IP, 401/404 no registran, agregado). Limpieza en `finally`. Verificar: en verde y `npm run seed:verify` sigue OK tras un `npm run seed`.
- [x] 7.3 Ejecutar los 7 criterios de aceptación de Fase 3 y registrar evidencia en `openspec/changes/add-auth-and-crud/verification.md`; `npm run lint`, `typecheck`, `build`, `test`, `test:e2e` en verde. Verificar: todos ✅; máx. 3 ciclos de reparación.

## 8. Documentación (Reviewer, previo al archive)

- [x] 8.1 `backend/README.md`: auth, bootstrap, tabla de endpoints admin, criterios Fase 3. Verificar: tablas actualizadas.
- [x] 8.2 Sincronizar: checkbox Fase 3 en `CLAUDE.md`/`README.md`; `CLAUDE.md` § núcleo paso 6 implementado; `docs/ARCHITECTURE.md` §6 rutas admin ✅; `docs/DATA-POPULATION.md` (edición vía API; seed preserva admin); `docs/CHANGELOG.md`. Verificar: `openspec validate --strict` OK antes de `openspec archive`.
