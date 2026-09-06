# Tasks — add-backend-base

> Referencias: `proposal.md` (qué), `specs/*/spec.md` (comportamiento), `design.md` (cómo, decisiones D1–D14). Criterios de aceptación de negocio: `docs/SPECS-POR-FASE.md` § Fase 1.

## 1. Bootstrap del proyecto NestJS (D1, D12, D14)

- [x] 1.1 Crear `backend/package.json` con NestJS 11.2.x, `@nestjs/config` 4.x, `@nestjs/swagger` 11.x, class-validator/transformer, y dev-deps (cli 11, testing, jest, ts-jest, supertest, tsx, rimraf, eslint, prettier); scripts `start:dev`, `build`, `lint`, `test`, `test:e2e`, `test:all`, `prisma:generate`, `prisma:migrate`, `seed`, `seed:verify`. Verificar: `npm install` termina sin errores y `npm ls @nestjs/core` muestra 11.2.x.
- [x] 1.2 Crear `tsconfig.json` (`strict: true`, `exclude: scripts/test/dist`), `tsconfig.build.json`, `nest-cli.json`, ESLint flat config + Prettier. Verificar: `npx tsc --noEmit -p tsconfig.json` y `npm run lint` pasan sobre un `main.ts` mínimo.
- [x] 1.3 Implementar `src/config/env.validation.ts` + `configuration.ts` y cablear `ConfigModule.forRoot({ validate })` en `AppModule`. Verificar: arrancar sin `DATABASE_URL` termina con exit ≠ 0 y el mensaje nombra la variable (spec `api-platform`).
- [x] 1.4 Implementar `src/main.ts`: prefijo `api`, `ValidationPipe` global, CORS por `FRONTEND_URL`, Swagger en `api/docs` + `api/docs-json`. Verificar: `curl -i localhost:$PORT/api/docs` → 200 HTML; `curl localhost:$PORT/api/docs-json | jq .paths` lista las rutas; petición con `Origin` = `FRONTEND_URL` recibe `Access-Control-Allow-Origin`.

## 2. Prisma, migración inicial y seed (D2, D11)

- [x] 2.1 Agregar `prisma@~6.19.3` y `@prisma/client@~6.19.3`; crear `.env` local desde `.env.example` (con `PORT=3300` por el puerto ocupado). Verificar: `npm run prisma:generate` genera el cliente sin warnings de versión.
- [x] 2.2 Implementar `shared/infrastructure/persistence/{prisma.service,prisma.module}.ts` (global, `$connect` en `onModuleInit`, shutdown hooks). Verificar: con Postgres arriba el log muestra conexión; con Postgres abajo el arranque termina exit ≠ 0 (spec `api-platform`).
- [x] 2.3 `docker compose up -d` y `npm run prisma:migrate` (`migrate dev --name init`). Verificar: existe `backend/prisma/migrations/<ts>_init/migration.sql` con 14 `CREATE TABLE`, `npx prisma migrate status` reporta "up to date", y `grep -r "db push" backend/package.json` no devuelve nada (spec `data-persistence-seed`).
- [x] 2.4 Registrar `"prisma": { "seed": "tsx scripts/seed.ts" }` y script `seed`; ejecutar `npm run seed` sin modificar `seed.ts`. Verificar: exit 0 y log "Seed completado".
- [x] 2.5 Implementar `scripts/verify-seed.ts` (conteos por tabla vs. `cv-data.json` en runtime; exit 1 si difiere) y script `seed:verify`. Verificar: `npm run seed:verify` exit 0 con los conteos de la spec; correr `seed` dos veces y volver a verificar → mismos conteos (idempotencia); contra una base sin tablas (`migrate reset --skip-seed` + drop) → el seed sale ≠ 0 mencionando la tabla.

## 3. Base compartida: Result, errores, i18n, HTTP (D4, D5, D8)

- [x] 3.1 Implementar `shared/domain/result.ts` (`Result<T,E>`, `ok`, `fail`, `isOk`) con `result.spec.ts`. Verificar: `npm test -- result` en verde.
- [x] 3.2 Implementar `shared/domain/errors/{domain.error,not-found.error}.ts`. Verificar: compila y `NotFoundError` expone `code` y `message`.
- [x] 3.3 Mover el núcleo puro de i18n a `shared/domain/i18n/` y dejar `shared/infrastructure/i18n/resolve-locale.ts` como fachada (re-export del núcleo + `normalizeLocale`). Escribir `resolve-locale.spec.ts` con los escenarios de fallback de la spec `content-localization` (falta traducción, falta default, nulo, dato plano, normalización `EN-us`). Verificar: tests en verde y ningún import roto (`tsc --noEmit`).
- [x] 3.4 Implementar `shared/infrastructure/http/request-locale.decorator.ts` (precedencia `locale` > `lang` > `Accept-Language` > `es`) y `content-language.interceptor.ts`. Verificar: unit test del extractor con los 7 escenarios de negociación de la spec `content-localization`.
- [x] 3.5 Implementar `shared/infrastructure/http/domain-error.mapper.ts` (`NotFoundError` → `NotFoundException`, resto → `InternalServerErrorException` sin detalles). Verificar: unit test del mapeo.

## 4. Módulo `profile` (D6, D7, D8, D10)

- [x] 4.1 Domain: `entities/profile.entity.ts`, `entities/language.entity.ts`, `value-objects/availability.vo.ts` (campos traducibles como `LocalizedText`), `repositories/profile.repository.ts` (interfaz `findOne()` + token `PROFILE_REPOSITORY`), `errors/profile-not-found.error.ts`. Verificar: `tsc --noEmit`; el test de arquitectura (6.2) no detecta imports prohibidos.
- [x] 4.2 Application: `dto/profile.output.ts` (tipo plano), `mappers/profile.mapper.ts` (entidad + locale → output), `use-cases/get-profile.use-case.ts`. Tests con repo mock: perfil encontrado en `es`, en `en`, fallback de campo faltante, repo vacío → `ProfileNotFoundError`. Verificar: `npm test -- profile` en verde.
- [x] 4.3 Infrastructure/persistence: `profile.prisma-mapper.ts` (type-guards para `Json`) y `prisma-profile.repository.ts` (include `languages`). Verificar: unit test del mapper con un JSON malformado → `''` sin lanzar.
- [x] 4.4 Infrastructure/controllers: `profile.controller.ts` (`GET /api/profile`, `@RequestLocale()`, `toHttpException`), `docs/profile.response.ts` (`@ApiProperty`, `implements ProfileOutput`), `profile.module.ts` cableando el token; registrar en `AppModule`. Verificar: `curl localhost:$PORT/api/profile?locale=en` devuelve `availability.startDate: "Immediate"` y header `Content-Language: en`; Swagger muestra el modelo.

## 5. Módulo `experience` (D6, D7, D8, D9, D10)

- [x] 5.1 Domain: `entities/experience.entity.ts`, `repositories/experience.repository.ts` (`findAllVisible()`, `findVisibleById(id)` + token), `errors/experience-not-found.error.ts`, `services/sort-experiences.ts` (order asc, startDate desc) con `sort-experiences.spec.ts`. Verificar: tests en verde incluyendo empate de `order`.
- [x] 5.2 Application: `dto/experience.output.ts`, `mappers/experience.mapper.ts`, `use-cases/list-experiences.use-case.ts`, `use-cases/get-experience-by-id.use-case.ts`. Tests con repo mock: lista ordenada y resuelta en `en`, `highlights` como `string[]`, id inexistente → `ExperienceNotFoundError`. Verificar: `npm test -- experience` en verde.
- [x] 5.3 Infrastructure/persistence: `experience.prisma-mapper.ts` y `prisma-experience.repository.ts` (`where visible`, `orderBy [order asc, startDate desc]`). Verificar: unit test del mapper; consulta manual vía Adminer coincide con la API.
- [x] 5.4 Infrastructure/controllers: `experience.controller.ts` (`GET /api/experiences`, `GET /api/experiences/:id`), `docs/experience.response.ts`, `experience.module.ts`; registrar en `AppModule`. Verificar: `curl localhost:$PORT/api/experiences | jq length` → 15; `curl .../api/experiences/no-existe` → 404 JSON `{statusCode,message,error}` sin `stack`.

## 6. Verificación integral (Verifier)

- [x] 6.1 E2E `test/app.e2e-spec.ts` con supertest cubriendo todos los escenarios de los 5 specs: prefijo (`/profile` → 404), docs (`/api/docs`, `/api/docs-json` con `locale` enum), CORS, negociación de locale (7 casos), `Content-Language`, perfil es/en/sin objetos localizados/sin `createdAt`, experiencias (conteo desde `cv-data.json`, primer elemento Novacomp, `en`, detalle por id, 404, oculta → excluida y 404 revirtiendo la mutación), perfil inexistente (mutación revertida). Verificar: `npm run test:e2e` en verde contra la base seedeada.
- [x] 6.2 Test de arquitectura `test/architecture.spec.ts`: `domain/**` sin `@nestjs/*`, `@prisma/client` ni `infrastructure`; `application/**` sin `@prisma/client` ni `infrastructure`. Verificar: en verde, y falla si se inyecta un import prohibido de prueba.
- [x] 6.3 Ejecutar la checklist de criterios de aceptación de `docs/SPECS-POR-FASE.md` § Fase 1 uno por uno y registrar comando + evidencia en `openspec/changes/add-backend-base/verification.md` (nota: conteo real 15 experiencias / 14 perfiles curados). Verificar: los 7 criterios marcados con evidencia; máx. 3 ciclos de reparación antes de escalar al Human Gate.

## 7. Documentación (Reviewer, previo al archive)

- [x] 7.1 Escribir `backend/README.md`: requisitos, `.env`, comandos, cómo verificar cada criterio de Fase 1, nota del puerto local. Verificar: un desarrollador puede seguirlo de cero hasta `GET /api/experiences`.
- [x] 7.2 Preparar la sincronización de docs para el archive: checkbox Fase 1 en `CLAUDE.md` y `README.md`; entrada en `docs/CHANGELOG.md`; conteos en `docs/SPECS-POR-FASE.md` (15 experiencias, 13 + `all` perfiles); paquete `@fission-ai/openspec` en `docs/KICKOFF-ClaudeCode.md`; rutas de `docs/ARCHITECTURE.md` §6 y ubicación del núcleo i18n en `docs/I18N.md` §4. Verificar: diff revisado por el Human Gate antes de `openspec archive`.
