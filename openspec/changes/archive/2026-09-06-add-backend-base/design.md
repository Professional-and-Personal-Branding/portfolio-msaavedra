# Design — add-backend-base

## Context

Ver `proposal.md` (Why) y `docs/SPECS-POR-FASE.md` § Fase 1. Estado observado del repo y del entorno:

- **Existe**: `backend/prisma/schema.prisma` (14 modelos, generator `prisma-client-js`, `url = env("DATABASE_URL")`), `backend/scripts/seed.ts` (usa `new PrismaClient()` sin adaptadores, `__dirname` → CommonJS), `backend/src/shared/infrastructure/i18n/resolve-locale.ts` (puro, sin deps), `backend/.env.example`, `docker-compose.yml` (Postgres 16 + Adminer). No hay `package.json`, `tsconfig`, `main.ts` ni módulos. No hay git ni Graphify.
- **Versiones publicadas hoy (2026-09-05)**: NestJS `@nestjs/core` 12.0.1 (latest) / 11.2.3 (última 11.x); `@nestjs/cli` 11.0.24; `@nestjs/swagger` 11.4.7; `@nestjs/config` 4.0.4. Prisma: dist-tag `latest` = 8.0.0-rc.13, `prev` = 7.10.0, última 6.x = 6.19.3. Node 22.23.1, npm 10.9.8.
- **Entorno local**: Docker 29 operativo. Puertos **3000 y 3001 ocupados** por otro proyecto (`job-application-agent-portal`). 5432 y 8080 libres.
- **Datos**: `cv-data.json` tiene 15 experiencias (la spec dice 14), 13 `profileTemplates` (+ `all` que crea el seed = 14 perfiles curados), 12 categorías / 108 skills, 6 educación, 8 certificaciones, 2 proyectos, 3 social links, 1 featured repo no visible.
- **Restricciones**: CLAUDE.md fija NestJS 11.x, Prisma, Clean Architecture con regla de dependencia estricta, `Result<T,E>` en dominio, DTOs con class-validator, locale propagado a mappers, DTOs de salida planos, i18n centralizado en `resolveLocale`.

## Goals / Non-Goals

**Goals:**
- Un módulo de referencia (`profile`, `experience`) cuya estructura pueda copiarse literalmente en Fase 2/3.
- Regla de dependencia verificable por test, no solo por convención.
- Arranque local reproducible en Windows (PowerShell) y Unix con los mismos scripts npm.
- Contrato OpenAPI suficiente para generar tipos del frontend en Fase 4.

**Non-Goals:**
- Diseñar la resolución de perfiles curados (solo se garantiza que `experience` deja el terreno listo: entidad con `tags`, orden determinista).
- Abstraer la persistencia más allá de un puerto por agregado (sin Unit of Work, sin especificaciones genéricas).
- Optimizaciones de performance o caché.

## Decisions

### D1 — NestJS 11.2.x (no 12)
CLAUDE.md fija "v11.x estable" y prohíbe cambiar el stack sin acuerdo explícito. Se pinnea `~11.2.3` para core/common/platform-express, `@nestjs/cli ~11.0.24`, `@nestjs/swagger ~11.4.7`, `@nestjs/config ~4.0.4`.
*Alternativa descartada*: NestJS 12.0.1 (recién liberado, ecosistema de plugins aún desparejo; subir sería un change propio `upgrade-nestjs-12`).

### D2 — Prisma 6.19.x (no 7/8)
El `schema.prisma` y `seed.ts` existentes son Prisma 6: generator `prisma-client-js`, `url` en el datasource, `new PrismaClient()` sin driver adapter. Prisma 7 exige `prisma.config.ts`, generator `prisma-client` con `output`, y driver adapter (`@prisma/adapter-pg`); 8 está en RC. Se pinnea `prisma@~6.19.3` y `@prisma/client@~6.19.3` para no tocar los artefactos de Fase 0.
*Alternativa descartada*: Prisma 7.10 → obliga a reescribir seed y schema en este mismo change y mezcla dos preocupaciones. Se propone un change posterior `upgrade-prisma-7` una vez que Fase 1-2 estén verdes.

### D3 — Rutas: gana la spec de negocio
SPECS-POR-FASE (criterios de aceptación) define `GET /api/profile`, `GET /api/experiences` y Swagger en `/api/docs`; su Fase 2 usa `/api/curated-profiles`. ARCHITECTURE.md §6 (borrador) y STEPS.md dicen `/api/public/*` y Swagger en `/api`. Se implementa lo que dicen los **criterios de aceptación** (rutas planas bajo `/api`) y se corrige la doc al archivar. Se agrega `GET /api/experiences/:id`: cuesta poco y hace que el módulo de referencia exhiba el camino "no encontrado" (`Result` → 404), que Fase 2 necesita.
*Alternativa descartada*: `/api/public/*` ahora y renombrar después → churn en frontend y Swagger.

### D4 — Negociación de locale: `locale` > `lang` > `Accept-Language` > `es`
El criterio de aceptación usa `?locale=`; CLAUDE.md e I18N.md usan `?lang=`. Se aceptan ambos con esa precedencia, más el header, reutilizando `normalizeLocale` (ya soporta `en-US`, mayúsculas, fallback). Un locale no soportado **no** es 400: cae a `es` (coherente con el criterio de Fase 2 "fallback no excluyente"). El locale servido se informa en `Content-Language`.
Implementación: decorador de parámetro `@RequestLocale()` (infra HTTP compartida) + interceptor que setea el header. El controller pasa `locale` al caso de uso.

### D5 — Núcleo i18n puro a `shared/domain/i18n`; infra conserva la fachada
Las entidades de dominio deben guardar `LocalizedText` (el dato *es* bilingüe; la proyección a un idioma es una preocupación de presentación) y los mappers de aplicación resuelven el locale. Para que domain/application usen `Locale`, `LocalizedText`, `resolveLocale*` sin importar de infrastructure, esas piezas puras se mueven a `shared/domain/i18n/`. `shared/infrastructure/i18n/resolve-locale.ts` queda como fachada que re-exporta el núcleo de dominio y agrega `normalizeLocale` (parsing de query/header, que sí es HTTP). La ruta citada en CLAUDE.md sigue existiendo y la API pública es idéntica.
*Alternativa descartada*: resolver el locale dentro del repositorio Prisma (I18N.md §4) devolviendo entidades ya en un idioma → el dominio dejaría de ser bilingüe y Fase 3 (CRUD que edita ambos idiomas) necesitaría otra entidad/puerto.

### D6 — Mapeo de las "4 capas" a carpetas
Se sigue el árbol de CLAUDE.md: la capa de **presentación** vive en `infrastructure/controllers/` (controllers, DTOs de query, modelos de respuesta Swagger). Los DTOs de salida de `application/dto/` son tipos TS planos sin decoradores; las clases con `@ApiProperty` viven en `infrastructure/controllers/docs/` e implementan (`implements`) esos tipos para que el compilador detecte divergencias.

```
backend/src/
├── main.ts · app.module.ts
├── config/               env.validation.ts (class-validator, fail-fast) · configuration.ts
├── shared/
│   ├── domain/           result.ts · errors/{domain.error,not-found.error}.ts · i18n/{locale,resolve-locale}.ts
│   └── infrastructure/   persistence/{prisma.service,prisma.module}.ts · i18n/resolve-locale.ts (fachada)
│                         http/{request-locale.decorator,content-language.interceptor,domain-error.mapper}.ts
└── modules/
    ├── profile/
    │   ├── domain/       entities/{profile,language}.entity.ts · value-objects/availability.vo.ts
    │   │                 repositories/profile.repository.ts (interfaz + token) · errors/profile-not-found.error.ts
    │   ├── application/  use-cases/get-profile.use-case.ts · dto/profile.output.ts · mappers/profile.mapper.ts
    │   ├── infrastructure/ persistence/{prisma-profile.repository,profile.prisma-mapper}.ts
    │   │                   controllers/{profile.controller,docs/profile.response}.ts
    │   └── profile.module.ts
    └── experience/       (misma estructura; use-cases list-experiences y get-experience-by-id;
                           domain/services/sort-experiences.ts)
```

### D7 — Puertos, tokens e inyección
Cada puerto es una interfaz TS en `domain/repositories/` acompañada de un token `Symbol` exportado desde el mismo archivo (un `Symbol` no depende de NestJS). El `*.module.ts` provee `{ provide: EXPERIENCE_REPOSITORY, useClass: PrismaExperienceRepository }` y los casos de uso reciben `@Inject(EXPERIENCE_REPOSITORY)`. Los casos de uso son `@Injectable()` (decorador de NestJS en application: aceptado por CLAUDE.md, que solo veda decoradores en domain).

### D8 — Casos de uso y `Result<T,E>`
`GetProfileUseCase.execute({ locale })` → `Result<ProfileOutput, ProfileNotFoundError>`; `ListExperiencesUseCase.execute({ locale })` → `Result<ExperienceOutput[], never>`; `GetExperienceByIdUseCase.execute({ id, locale })` → `Result<ExperienceOutput, ExperienceNotFoundError>`. `Result` es una unión discriminada `{ ok: true, value } | { ok: false, error }` con helpers `ok()/fail()`. Un mapper compartido (`domain-error.mapper.ts`) traduce `NotFoundError` → `NotFoundException`; el controller hace `if (!r.ok) throw toHttpException(r.error)`.

### D9 — Orden y visibilidad de experiencias
El puerto expone `findAllVisible()` y `findVisibleById(id)`. El adaptador Prisma ya filtra `visible: true` y ordena en la query; además el caso de uso aplica `sortExperiences()` (función pura en `domain/services/`) para que el orden sea un invariante de dominio testeable sin base y reutilizable en Fase 2 (que ordena en memoria tras filtrar por tags).

### D10 — Mapper Prisma → dominio a prueba de JSON
Los campos `Json` de Prisma llegan como `JsonValue`. El mapper de infra valida forma con type-guards (`isLocalizedText`, `isLocalizedList`) antes de construir la entidad; un valor inesperado se mapea a `''`/`[]` y se loguea `warn`, nunca rompe la respuesta pública.

### D11 — Prisma: servicio, migración, seed
- `PrismaService extends PrismaClient` con `onModuleInit → $connect()` y `enableShutdownHooks`; `PrismaModule` global.
- Migración inicial: `prisma migrate dev --name init` (script `prisma:migrate`). El seed se registra en `package.json` → `"prisma": { "seed": "tsx scripts/seed.ts" }` para que `migrate reset` lo ejecute; `npm run seed` invoca lo mismo. `seed.ts` no se modifica (Prisma 6 carga `.env` solo).
- `scripts/verify-seed.ts` cuenta filas por tabla y compara contra `cv-data.json` leído en runtime (no números hardcodeados), sale 1 si difiere. Es la evidencia del criterio "el seed carga…".

### D12 — Config y arranque
`@nestjs/config` con `validate()` basado en class-validator (`EnvironmentVariables`: `DATABASE_URL` url obligatoria, `PORT` int default 3000, `NODE_ENV` enum, `FRONTEND_URL` url). `main.ts`: `setGlobalPrefix('api')`, `ValidationPipe({ whitelist: true, transform: true })`, `enableCors({ origin: FRONTEND_URL })`, Swagger en `api/docs` (`jsonDocumentUrl: 'api/docs-json'`). Sin filtro global de excepciones: las `HttpException` de Nest ya producen `{statusCode,message,error}`; el filtro global queda para Fase 6.

### D13 — Tests
- Unitarios (`src/**/*.spec.ts`, ts-jest): casos de uso con repos mock, `sortExperiences`, `Result`, fallback i18n, mappers.
- Arquitectura (`test/architecture.spec.ts`): recorre `src/modules/*/domain/**` y falla si importa `@nestjs/*`, `@prisma/client` o `../infrastructure`; recorre `application/**` y falla si importa `@prisma/client` o `infrastructure`.
- E2E (`test/*.e2e-spec.ts`, supertest): levanta `AppModule` contra `DATABASE_URL` seedeada; escenarios de los 5 specs; los conteos esperados se leen de `cv-data.json`. Para los escenarios "oculta"/"sin perfil" el test muta la fila vía Prisma y restaura al final.
- Scripts: `test` (unit + arquitectura), `test:e2e`, `test:all`.

### D14 — Tooling y Windows
Scripts npm sin sintaxis específica de shell; `tsx` para scripts TS; `rimraf` para `dist`. `tsconfig.json` con `strict: true` y `exclude: ["scripts", "test", "dist"]`; `tsconfig.build.json` para Nest. ESLint flat config + Prettier (single quotes, trailing commas).

## Risks / Trade-offs

- [Prisma 6 quedará atrás respecto a 7/8] → change dedicado `upgrade-prisma-7` tras Fase 2; el aislamiento en `infrastructure/persistence` acota el impacto.
- [Puerto 3000 ocupado en la máquina de desarrollo] → `.env` local con `PORT=3300`; `.env.example` mantiene 3000 y lo documenta; los e2e usan el puerto efímero de supertest (no dependen de `PORT`).
- [`migrate dev` necesita crear una shadow database] → el usuario `portfolio` del compose es superusuario del contenedor; si fallara, documentar `SHADOW_DATABASE_URL`.
- [El seed borra y recarga toda la base] → comportamiento documentado en DATA-POPULATION.md; aceptable hasta Fase 5.
- [E2E acoplados al contenido del seed] → aserciones derivadas de `cv-data.json` en runtime, no literales; mutaciones de prueba revertidas.
- [Mover el núcleo i18n cambia la ubicación citada en I18N.md §4] → fachada en la ruta original; actualizar I18N.md al archivar.

## Migration Plan

Solo entorno local (no hay producción):
1. `docker compose up -d` → Postgres saludable.
2. `cd backend && cp .env.example .env` (ajustar `PORT=3300`) → `npm install` → `npm run prisma:generate`.
3. `npm run prisma:migrate` (crea `migrations/*_init`) → `npm run seed` → `npm run seed:verify`.
4. `npm run start:dev` → `http://localhost:3300/api/docs`.
Rollback: `docker compose down -v` borra el volumen; el código es aditivo.

## Open Questions

- ¿Base separada `portfolio_test` para e2e? Diferible: por ahora corren contra la base seedeada local y revierten sus mutaciones. Si en Fase 3 los e2e escriben más, se agrega `DATABASE_URL_TEST`.
