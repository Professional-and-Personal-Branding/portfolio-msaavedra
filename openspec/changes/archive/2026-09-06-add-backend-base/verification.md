# Verification — add-backend-base (Fase 1)

Verifier: ejecución de los criterios de aceptación de `docs/SPECS-POR-FASE.md` § Fase 1 y de los escenarios de los 5 specs del change. Fecha: 2026-09-06. Entorno: Windows 11, Node 22.23.1, Docker 29, Postgres 16 (docker compose), `PORT=3300` local.

Ciclos de reparación usados: **2 de 3** (ver abajo). Estado final: **todo en verde**.

## Criterios de aceptación de la Fase 1

| # | Criterio | Comando / evidencia | Resultado |
|---|---|---|---|
| 1 | `docker compose up -d` levanta Postgres y la app conecta sin errores | `docker ps` → `portfolio-postgres Up (healthy)`; `node dist/main.js` → log `Conexión a PostgreSQL establecida`, `API escuchando en http://localhost:3300/api` | ✅ |
| 2 | `prisma migrate dev` genera la migración inicial versionada (no `db push`) | `prisma/migrations/20260906055928_init/migration.sql` con 14 `CREATE TABLE`; `prisma migrate status` → "Database schema is up to date!"; `grep "db push" package.json` → 0 | ✅ |
| 3 | El seed carga experiencias, perfiles, skills, educación, certificaciones y profile | `npm run seed` exit 0; `npm run seed:verify` → Profile 1, Language 2, Experience **15**, SkillCategory 12, Skill 108, Education 6, Certification 8, Project 2, SocialLink 3, FeaturedRepository 0, Theme 5, CuratedProfile **14** (13 + `all`), ProfileView 0; `Experience.role` bilingüe ✅. Segunda ejecución → mismos conteos (idempotente) | ✅ (nota: la spec decía 14/13; corregida a los conteos reales) |
| 4 | `GET /api/experiences` y `GET /api/profile` responden | `curl :3300/api/experiences` → 15 items, primero `Novacomp` (order 0); `curl :3300/api/profile` → 200 con `fullName`, `availability`, `languages` | ✅ |
| 5 | La respuesta respeta `?locale=es\|en` | `?locale=en` → `availability.startDate: "Immediate"`, `languages: ["Spanish","English"]`, header `Content-Language: en`; `Accept-Language: en-US` → `highlights` en inglés; `?locale=fr` → 200 en español | ✅ |
| 6 | Dominio aislado: el caso de uso no importa Prisma, depende de una interfaz | `test/architecture.spec.ts` (4 tests) en verde: `domain/**` sin `@nestjs/*`, `@prisma/client`, `application`, `infrastructure`; `application/**` sin `@prisma/client` ni `infrastructure`. Tokens `PROFILE_REPOSITORY` / `EXPERIENCE_REPOSITORY` inyectados vía `@Inject` | ✅ |
| 7 | Swagger accesible en `/api/docs` con los endpoints documentados | `curl :3300/api/docs` → 200 `text/html`; `/api/docs-json` → paths `/api/profile`, `/api/experiences`, `/api/experiences/{id}`, query `locale` enum `["es","en"]` | ✅ |

## Escenarios de los specs (tests automatizados)

| Spec | Cobertura | Suite |
|---|---|---|
| `api-platform` | prefijo `/api` (200 / 404 sin prefijo), config fail-fast (`DATABASE_URL` vacía → exit 1, mensaje `DATABASE_URL should not be empty`; defaults; PORT inválido), DB caída → exit 1 (`Please make sure your database server is running at localhost:5432`), errores JSON `{statusCode,message,error}` sin `stack`, CORS permitido/denegado, Swagger UI + JSON | `env.validation.spec.ts` (4), `app.e2e-spec.ts` (7), manual A/B/C |
| `content-localization` | 7 escenarios de negociación + cadena no cortada por valor inválido + caché; fallback por campo (falta traducción, falta default, nulo, plano); `Content-Language`; sin objetos `{es,en}` | `resolve-locale.spec.ts` (×2 archivos, 14), `request-locale.decorator.spec.ts` (9), e2e (8) |
| `data-persistence-seed` | migración `init` versionada, sin `db push`, conteos, bilingüe preservado, idempotencia, base sin migrar → seed exit 1 con `The table public.ProfileView does not exist` (probado contra una base temporal vacía) | `seed:verify` ×2, inspección de `migrations/`, manual |
| `public-profile-api` | perfil es/en, sin objetos localizados, sin `createdAt`/`profileId`, base sin perfil → 404 (mutación revertida) | `get-profile.use-case.spec.ts` (5), `profile.prisma-mapper.spec.ts` (2), e2e (4) |
| `public-experience-api` | listado (conteo del JSON, Novacomp primero, en inglés, orden, campos), detalle por id, 404, oculta → excluida + 404 (revertida), sin metadatos | `sort-experiences.spec.ts` (3), `experience.use-cases.spec.ts` (6), `experience.prisma-mapper.spec.ts` (2), e2e (7) |

**Totales:** `npm test` → 12 suites / 56 tests ✅ · `npm run test:e2e` → 1 suite / 26 tests ✅ · `npm run lint` → 0 problemas · `npm run build` → OK · `npx tsc --noEmit` → OK.

## Ciclos de reparación

1. **E2E colgado / `EADDRINUSE`**: el e2e importaba `main.ts`, que ejecutaba `bootstrap()` al cargarse. Fix: `GLOBAL_PREFIX` a `app.constants.ts` y bootstrap protegido con `require.main === module`.
2. **CORS**: con `origin` como string el middleware siempre emite `Access-Control-Allow-Origin`, violando el escenario "origen no permitido". Fix: `buildCorsOptions()` con función de origen, compartida por `main.ts` y el e2e.

Ajustes menores fuera de ciclo: `Result<T, never>` no colapsa en TS → `ListExperiencesUseCase` devuelve `Ok<T>`; `reflect-metadata` importado en `env.validation.ts` para testear la validación sin Nest; `@IsNotEmpty()` en `DATABASE_URL`.

## Hallazgo del entorno (no bloqueante)

Prisma 6 carga `backend/.env` por sí mismo al importar `@prisma/client`, así que "arrancar sin `.env`" no reproduce la falta de `DATABASE_URL` cuando el archivo existe. El escenario se verificó con `DATABASE_URL=""` (las variables de proceso tienen precedencia). En producción no habrá `.env`, así que el fail-fast aplica tal cual.

## Desvíos respecto a la propuesta

- `backend/scripts/seed.ts`: se declaró "sin cambios". Prettier lo reformateó al correr `lint:fix` (solo formato) y se cambió `const data: CvData = JSON.parse(raw)` por `JSON.parse(raw) as CvData` para satisfacer `no-unsafe-assignment`. Sin cambios funcionales; el seed produce los mismos conteos.
