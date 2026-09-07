# Design — add-auth-and-crud

## Context

Ver `proposal.md` y `docs/SPECS-POR-FASE.md` § Fase 3. Estado de partida: Fases 1-2 archivadas; módulos `profile`, `experience`, `skill`, `theme`, `curated-profile` con puertos de solo lectura; `AdminUser` y `ProfileView` ya existen en `schema.prisma`; el seed no borra `AdminUser`; `.env.example` trae `JWT_SECRET`, `JWT_EXPIRES_IN`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`.

Verificado en el entorno (2026-09-07): `argon2@0.45.1` instala con binario precompilado y funciona en Windows/Node 22; `@nestjs/passport@11.0.5` es la última 11.x; `passport-jwt@4.0.1`. **Nota post-implementación:** `@nestjs/jwt@12` (peer `^11 || ^12`) se publica solo como ESM y Jest no puede cargarlo; se usa `@nestjs/jwt@~11.0.2` (CommonJS). Ver `verification.md`.

## Goals / Non-Goals

**Goals:**
- Un módulo `auth` con la misma plantilla de capas; la lógica de login testeable con puertos mock (`PasswordHasher`, `TokenSigner`).
- Escrituras que pasan por casos de uso con `Result` y reglas de dominio (no lógica en controllers).
- Registro de visitas desacoplado: la resolución pública nunca falla por analítica.
- DTOs bilingües reutilizables para todos los CRUD.

**Non-Goals:**
- Endurecer producción (rate limit, cookies, refresh): Fase 6.
- Generalizar un "CRUD genérico": cada agregado tiene sus casos de uso explícitos (SOLID > DRY aquí).

## Decisions

### D1 — Hash: argon2id vía `argon2`
Verificado que instala y corre en la máquina de desarrollo. Parámetros por defecto de la librería (m=65536, t=3, p=4). Puerto `PasswordHasher { hash(plain), verify(hash, plain) }` en `auth/domain`; adaptador `Argon2PasswordHasher` en infra.
*Alternativas*: `bcrypt` (nativo, más antiguo), `bcryptjs` (JS puro, sin riesgo de build pero más lento). Si en CI/deploy fallara el binario, cambiar el adaptador es un archivo.

### D2 — JWT con `@nestjs/jwt` + Passport (`passport-jwt`, Bearer)
Sigue ARCHITECTURE.md ("JWT (Passport)"). `JwtModule.registerAsync` con `JWT_SECRET`/`JWT_EXPIRES_IN`. Estrategia `JwtStrategy` (extrae Bearer, valida firma/exp, carga el admin por `sub` → si no existe, 401). `JwtAuthGuard extends AuthGuard('jwt')`, aplicado a nivel de clase en todos los controllers `/api/admin/*` y en `GET /api/auth/me`. Puerto `TokenSigner { sign(claims) → { token, expiresInSeconds } }` implementado sobre `JwtService` para que `LoginUseCase` no dependa de Nest.
*Alternativa*: guard manual sin Passport → menos deps, pero contradice la doc de arquitectura.

### D3 — Transporte del token: `Authorization: Bearer`
Fase 3 solo API; Fase 5 lo guardará en memoria (CLAUDE.md prohíbe localStorage). Cookies httpOnly + CSRF se evalúan en Fase 6 junto con Helmet. Swagger: `addBearerAuth()` y `@ApiBearerAuth()` en controllers admin.

### D4 — Bootstrap del administrador
`scripts/bootstrap-admin.ts` (tsx, como el seed): lee `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` (default "Admin"), hashea con argon2 y hace `upsert` por email. Falla con exit 1 si faltan email/password. Advierte (sin fallar) si la contraseña es el placeholder de `.env.example`. El seed no se toca. Los e2e crean su propio admin (`e2e-admin@test.local`) en `beforeAll` y lo borran en `afterAll`.

### D5 — Puertos de escritura en los mismos repositorios
`ExperienceRepository` gana `findAll()`, `findById(id)`, `create(props)`, `update(id, props)`, `delete(id)`; `SkillCategoryRepository` gana CRUD de categorías y skills (`createSkill(categoryId, props)`, `updateSkill(id, props)`, `deleteSkill(id)`, `findSkillById`); `CuratedProfileRepository` gana `findAll()`, `findById`, `existsBySlug(slug, excludeId?)`, `create`, `update`, `delete`. Un solo puerto por agregado (ISP no se viola: los consumidores públicos siguen usando solo los métodos de lectura; separar puertos duplicaría tokens y módulos sin beneficio hoy).
Entidades: `Experience.create` sigue igual; se agrega `with(changes: Partial<ExperienceProps>)` que devuelve una instancia nueva. `NewExperienceProps = Omit<ExperienceProps, 'id'>`; el adaptador Prisma genera el `cuid`.

### D6 — Validación en dos niveles
1. **HTTP (class-validator)**: DTOs en `infrastructure/controllers/dto/` de cada módulo. DTOs bilingües compartidos en `shared/infrastructure/http/dto/localized.dto.ts`: `LocalizedTextDto { @IsString es; @IsOptional @IsString en }`, `LocalizedListDto { @IsArray @IsString({each}) es; en? }`. **Ajuste post-implementación:** el `ValidationPipe` global queda solo con `transform` (un `whitelist` global corre antes que el pipe del controller y borra los campos desconocidos sin dar 400); `adminValidationPipe` (`whitelist + forbidNonWhitelisted + transform`) se aplica vía `@UsePipes` en los controllers con cuerpo (admin y `auth`). Las rutas públicas GET no cambian.
2. **Dominio**: reglas que dependen del estado resultante o de otros agregados viven en el caso de uso/entidad y devuelven `ValidationError` (nuevo en `shared/domain/errors`, → 400) o `ConflictError` (→ 409): `PROTECTED` requiere `accessToken`; `slug` único (`existsBySlug`); `themeId` debe existir (`ThemeRepository.findById`); `endDate` requiere `!current`; `startDate <= endDate`.

### D7 — Salidas admin "crudas"
Los DTOs de salida admin (`AdminExperienceOutput`, etc.) exponen los campos traducibles como `{ es, en }` y los internos (`visible`, `accessToken`, `includeIds`…). Mappers en `application/mappers/*.admin-mapper.ts`. Las salidas públicas no cambian.

### D8 — Rutas y verbos
```
POST   /api/auth/login                              público
GET    /api/auth/me                                 Bearer
GET/POST        /api/admin/experiences              Bearer
GET/PATCH/DELETE /api/admin/experiences/:id
GET/POST        /api/admin/skill-categories
PATCH/DELETE    /api/admin/skill-categories/:id
POST            /api/admin/skill-categories/:id/skills
PATCH/DELETE    /api/admin/skills/:id
GET/POST        /api/admin/curated-profiles
GET/PATCH/DELETE /api/admin/curated-profiles/:id
GET             /api/admin/analytics/views?from&to
```
`PATCH` (parcial) en lugar de `PUT`, como ARCHITECTURE.md. `DELETE` → 204 sin cuerpo. `POST` → 201 con el recurso.

### D9 — Registro de visitas
Nuevo módulo `analytics` (mínimo): `ProfileView` entity (solo lectura agregada), puerto `ProfileViewRepository { record(view), aggregate(range) }`, adaptador Prisma que en una transacción crea el `ProfileView` e incrementa `CuratedProfile.views`. `ResolveCuratedProfileUseCase` recibe opcionalmente `viewContext?: { locale, referrer?, userAgent?, ipHash? }`; si viene y el resultado es exitoso, llama `record` **con `await` envuelto en try/catch** que solo loguea (`Logger.warn`). El controller público construye el contexto: `ipHash = HMAC-SHA256(ip, ANALYTICS_SALT ?? JWT_SECRET)` en un helper de infra (`shared/infrastructure/http/ip-hash.ts`), `ip` = `req.ip` (respeta `trust proxy` que se configurará en Fase 6). Los tests unitarios existentes no pasan contexto → no registran.
*Alternativa*: interceptor que registra tras la respuesta → más desacoplado pero pierde el `curatedProfileId` resuelto y la garantía de "solo si 200" quedaría implícita.

### D10 — Agregado de analítica
`GET /api/admin/analytics/views` → `AggregateProfileViewsUseCase({ from, to })`. Prisma: `groupBy` por `curatedProfileId` (join a slug en memoria), por `locale`, y por día vía `queryRaw` (`date_trunc('day', "viewedAt")`) — único SQL crudo del proyecto, encapsulado en el adaptador. Default: últimos 30 días. Validación de `from`/`to` con `@IsISO8601`.

### D11 — Configuración y CORS
`EnvironmentVariables` gana `JWT_SECRET` (`@MinLength(16)`), `JWT_EXPIRES_IN` (default `1d`, validado con regex `^\d+(s|m|h|d)?$`), `ANALYTICS_SALT` opcional. `AppConfig` expone `jwt: { secret, expiresIn }`, `analyticsSalt`. `buildCorsOptions` amplía métodos y headers (spec `api-platform` MODIFIED). `.env.example` documenta `ADMIN_NAME` y `ANALYTICS_SALT`.

### D12 — Estructura
```
modules/auth/
├── domain/        entities/admin-user.entity.ts · repositories/admin-user.repository.ts
│                  ports/{password-hasher,token-signer}.port.ts · errors/invalid-credentials.error.ts (extends AccessDeniedError)
├── application/   use-cases/{login,get-current-admin}.use-case.ts · dto/auth.output.ts
├── infrastructure/ persistence/prisma-admin-user.repository.ts · security/{argon2-password-hasher,jwt-token-signer,jwt.strategy,jwt-auth.guard,current-admin.decorator}.ts
│                  controllers/auth.controller.ts · dto/login.dto.ts · docs/*.response.ts
└── auth.module.ts (exporta JwtAuthGuard + PasswordHasher token para el script/e2e)
modules/analytics/  domain/{entities,repositories} · application/use-cases/aggregate-profile-views.use-case.ts · infrastructure/{persistence,controllers}
modules/experience|skill|curated-profile/  + application/use-cases/admin/* · application/mappers/*.admin-mapper.ts · infrastructure/controllers/admin-*.controller.ts · dto/*
```

### D13 — Tests
- Unit: `LoginUseCase` (ok, email inexistente, password incorrecta, actualiza lastLoginAt), `Argon2PasswordHasher` (hash empieza con `$argon2id$`, verify), `JwtStrategy.validate` (admin inexistente → 401), casos de uso CRUD con repos mock (create/update/delete, 404, reglas de dominio: PROTECTED sin token, slug duplicado, themeId inexistente, endDate/current), `AggregateProfileViewsUseCase`, `ResolveCuratedProfileUseCase` con/sin `viewContext` y con `record` que falla.
- E2E `test/auth.e2e-spec.ts`: login ok/401/400, `/me`, token inválido/expirado (firmar con otro secreto y con `expiresIn: -1s`), 401 en admin sin token, públicas abiertas, hash en DB, seed preserva admin (verificación por consulta, sin re-correr el seed completo en e2e).
- E2E `test/admin.e2e-spec.ts`: CRUD experiencias (crear → ver en público y en perfil curado → patch tags/visible → delete → 404), skills (categoría + skill → aparece en perfil → patch tags → mover → delete categoría con skills), perfiles curados (crear → 409 slug → patch filterTags/includeIds/excludeIds → PROTECTED → 401/200 → delete), analytics (ProfileView delta, ipHash sin IP, 401/404 no registran, agregado ≥ conteos). Todo lo creado se borra en `finally`.

## Risks / Trade-offs

- [Binario nativo `argon2` en otros entornos (CI, Railway)] → precompilados oficiales para linux-x64/glibc; el puerto `PasswordHasher` permite cambiar a `bcryptjs` en un archivo.
- [Token en `Authorization` almacenado en memoria del frontend se pierde al recargar] → aceptado para Fase 5; Fase 6 decide cookies/refresh.
- [`forbidNonWhitelisted` solo en admin] → las rutas públicas mantienen tolerancia a query params extra (no rompen enlaces compartidos).
- [Acumulación de `ProfileView` por e2e/curl locales] → el seed limpia la tabla; en producción, retención es tema de Fase 6.
- [`req.ip` detrás de proxy devuelve la IP del proxy] → `trust proxy` en Fase 6; el hash igual nunca expone IP.
- [SQL crudo para `byDay`] → encapsulado en el adaptador, con test e2e; alternativa en memoria si crece.

## Migration Plan

Sin migraciones de esquema. Local: `npm install`, agregar `JWT_SECRET` fuerte y `ADMIN_*` al `.env`, `npm run admin:bootstrap`, `npm run start:dev`, `POST /api/auth/login`. Rollback: revertir el commit; los `AdminUser` creados pueden quedar.

## Open Questions

- ¿Retención de `ProfileView` (borrar > N días)? Diferible a Fase 6; no cambia specs ni tareas.
