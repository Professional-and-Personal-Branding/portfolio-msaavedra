# add-auth-and-crud — Fase 3: Auth + Backoffice API

> Materializa la **Fase 3** de `docs/SPECS-POR-FASE.md` (objetivo, alcance y criterios viven allí). Contrato: `CLAUDE.md`. Depende de las Fases 1 y 2 archivadas.

## Why

Hoy el portafolio solo se administra editando `cv-data.json` y re-corriendo el seed, que borra y recarga todo. Para que el backoffice (Fase 5) exista, la API necesita **autenticación** y **endpoints de escritura** sobre experiencias, skills y perfiles curados. Además, el núcleo (`ResolveCuratedProfile`) todavía no registra visitas (`ProfileView`), que es el insumo de la analítica del dashboard.

## What Changes

- **Módulo `auth`** (Clean Architecture): entidad `AdminUser`, puertos `AdminUserRepository`, `PasswordHasher` y `TokenSigner`; caso de uso `LoginUseCase(email, password)` → JWT; `GET /api/auth/me`; guard JWT (Passport, estrategia Bearer) que protege todo `/api/admin/*`. Hash de contraseñas con **argon2id**. Script `npm run admin:bootstrap` que crea/actualiza el administrador desde `ADMIN_EMAIL`/`ADMIN_PASSWORD`/`ADMIN_NAME`.
- **CRUD de experiencias** `/api/admin/experiences` (listar incluyendo ocultas, ver, crear, editar parcialmente, borrar) con DTOs `class-validator` bilingües (`{ es, en }`); el puerto `ExperienceRepository` gana métodos de escritura.
- **CRUD de skills** `/api/admin/skill-categories` (categorías) y `/api/admin/skill-categories/:id/skills` + `/api/admin/skills/:id` (skills con `tags` y `order`).
- **CRUD de perfiles curados** `/api/admin/curated-profiles`: edita `filterTags`, `includeIds`, `excludeIds`, `themeId`, `themeOverrides`, `layout`, secciones, `visibility` y `accessToken`; slug único (409 en conflicto); `PROTECTED` exige `accessToken` (400).
- **Registro de visitas**: al resolver con éxito un perfil curado por la ruta pública, se crea un `ProfileView` (slug vía relación, `locale`, `referrer`, `userAgent`, `ipHash` HMAC-SHA256, `viewedAt`) y se incrementa `views` atómicamente. Nunca rompe la respuesta pública. Lectura agregada mínima para el futuro dashboard: `GET /api/admin/analytics/views?from&to` (total, por perfil, por idioma, por día).
- **Shared**: `ValidationError` (400) y `ConflictError` (409) de dominio + mapeo HTTP; `JWT_SECRET`/`JWT_EXPIRES_IN` validados al arranque; CORS admite `POST/PATCH/DELETE` y el header `Authorization`.
- **Tests**: unitarios (login, verificación de hash, estrategia JWT, casos de uso CRUD con repos mock, reglas de validación de dominio, registro de vistas con repo mock), e2e (login válido/inválido, 401 en escrituras sin token, lecturas públicas abiertas, CRUD end-to-end de experiencias/skills/perfiles, overrides editados que cambian la resolución, `ProfileView` registrado, hash `$argon2id$` en la base).

### Non-goals

- Frontend del backoffice (Fase 5). Rate limiting del login, Helmet, cookies httpOnly, rotación/refresh de tokens, revocación, CSRF: Fase 6 (`docs/RELEASE-1.0.0-CHECKLIST.md`). El token JWT viaja como `Authorization: Bearer` y el frontend lo mantendrá en memoria.
- Múltiples usuarios/roles, cambio de contraseña por API, recuperación de cuenta: un solo administrador gestionado por el script de bootstrap.
- CRUD de `education`, `certification`, `project`, `social-link`, `theme`, `profile` base: fuera del alcance de la spec de fase (siguen editándose vía JSON + seed). Se propone un change `add-portfolio-sections-api` (lectura pública + CRUD) antes de la Fase 4/5.
- Dashboard visual de analítica (Fase 5) y retención/anonimización avanzada.
- Cambios al `schema.prisma` (`AdminUser` y `ProfileView` ya existen).

## Capabilities

### New Capabilities
- `admin-authentication`: login con credenciales, emisión y validación de JWT, protección de rutas de administración, almacenamiento seguro de contraseñas, bootstrap del administrador.
- `admin-experience-crud`: gestión completa de experiencias (incluye ocultas), validación de entrada y efecto inmediato en las lecturas públicas.
- `admin-skill-crud`: gestión de categorías de skills y de skills (nombre, tags, orden).
- `admin-curated-profile-crud`: gestión de perfiles curados (filtros, overrides, tema, secciones, visibilidad y token), unicidad de slug.
- `profile-view-analytics`: registro de cada visita pública resuelta y lectura agregada para el administrador.

### Modified Capabilities
- `api-platform`: la configuración validada incorpora `JWT_SECRET` (obligatoria, longitud mínima) y `JWT_EXPIRES_IN`; se agregan errores 400 (validación) y 409 (conflicto) al formato consistente; CORS permite métodos de escritura y `Authorization` solo para el origen del frontend.
- `curated-profile-resolution`: nueva regla — una resolución pública exitosa registra la visita sin afectar el resultado.

## Impact

- **Nuevo**: `backend/src/modules/auth/**`, `backend/src/modules/analytics/**` (ProfileView), controllers/DTOs admin en `experience`, `skill` y `curated-profile`, `scripts/bootstrap-admin.ts`, `test/admin.e2e-spec.ts`, `test/auth.e2e-spec.ts`.
- **Modificado**: puertos y adaptadores Prisma de `experience`, `skill`, `curated-profile` (métodos de escritura); entidades (`with()`); `ResolveCuratedProfileUseCase` (registro de vista opcional); `env.validation.ts`; `cors.options.ts`; `domain-error.mapper.ts`; `app.module.ts`; `swagger.ts` (`addBearerAuth`, tags `auth`/`admin`).
- **Dependencias nuevas**: `@nestjs/jwt`, `@nestjs/passport`, `passport`, `passport-jwt`, `argon2`; dev: `@types/passport-jwt`.
- **Docs al archivar**: checkbox Fase 3 en `CLAUDE.md`/`README.md`; `CLAUDE.md` § núcleo paso 6 (implementado); `docs/ARCHITECTURE.md` §6 (rutas admin); `docs/DATA-POPULATION.md` (el seed ya no es la única forma de editar; no borra `AdminUser`); `backend/.env.example` (`ADMIN_NAME`, `ANALYTICS_SALT`); `docs/CHANGELOG.md`.
