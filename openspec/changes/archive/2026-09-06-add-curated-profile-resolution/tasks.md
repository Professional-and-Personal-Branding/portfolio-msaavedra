# Tasks — add-curated-profile-resolution

> Referencias: `proposal.md`, `specs/*/spec.md`, `design.md` (D1–D10). Criterios de negocio: `docs/SPECS-POR-FASE.md` § Fase 2. Prerrequisito: D1 (orden canónico) aprobado por el Human Gate.

## 1. Shared y ajustes de Fase 1 (D1, D6)

- [x] 1.1 Agregar `shared/domain/errors/access-denied.error.ts` (+ export en `index.ts`) y mapearlo a `UnauthorizedException` en `domain-error.mapper.ts`. Verificar: `domain-error.mapper.spec.ts` cubre 401 y sigue en verde.
- [x] 1.2 Cambiar `sortExperiences` a `startDate` desc / `order` asc y el `orderBy` de `PrismaExperienceRepository`; actualizar `sort-experiences.spec.ts` (empate por `startDate`) y el escenario de orden en `test/app.e2e-spec.ts`. Verificar: `npm test` y `npm run test:e2e` en verde; `GET /api/experiences` devuelve `kiwox` antes que `vidoomy`.
- [x] 1.3 `ProfileModule` y `ExperienceModule` exportan los proveedores `PROFILE_REPOSITORY` y `EXPERIENCE_REPOSITORY`. Verificar: `npm run build` y arranque sin errores de DI.

## 2. Módulo `skill` mínimo (D3)

- [x] 2.1 Domain: `entities/{skill-category,skill}.entity.ts`, `repositories/skill-category.repository.ts` (`findAll()` + token). Verificar: `tsc --noEmit`; test de arquitectura en verde.
- [x] 2.2 Infrastructure: `persistence/skill-category.prisma-mapper.ts` (+spec con JSON malformado) y `prisma-skill-category.repository.ts` (include skills ordenadas); `skill.module.ts` exporta el puerto. Verificar: spec del mapper en verde; consulta manual devuelve 12 categorías / 108 skills.

## 3. Módulo `theme` mínimo (D3)

- [x] 3.1 Domain: `entities/theme.entity.ts`, `services/merge-theme-tokens.ts` + `merge-theme-tokens.spec.ts` (6 escenarios de `theme-resolution`: parcial, anidado, primitivos/arrays, nulo, inmutabilidad, forma), `repositories/theme.repository.ts` (`findById`, `findBySlug`, `DEFAULT_THEME_SLUG`). Verificar: spec en verde.
- [x] 3.2 Infrastructure: `persistence/theme.prisma-mapper.ts` + `prisma-theme.repository.ts`; `theme.module.ts` exporta el puerto. Verificar: `tsc --noEmit`; consulta manual devuelve 5 presets.

## 4. Módulo `curated-profile` — dominio (D2, D4)

- [x] 4.1 `entities/curated-profile.entity.ts` (Visibility de dominio, campos bilingües como `LocalizedText`), `value-objects/access-token.vo.ts` (+spec: coincide, no coincide, null, longitud distinta, tiempo constante por construcción). Verificar: specs en verde.
- [x] 4.2 `services/select-by-tags.ts` + spec (intersección, sin intersección, `filterTags` vacío, exclude gana, include fuerza, conflicto, id inexistente, orden de entrada conservado, no mutación, lista vacía). Verificar: ≥10 tests en verde.
- [x] 4.3 `services/resolve-sections.ts` (+ `DEFAULT_SECTIONS`) + spec (orden custom con ocultas, vacío → default, oculta inexistente ignorada). Verificar: spec en verde.
- [x] 4.4 `repositories/curated-profile.repository.ts` (`findBySlug`, `findAllPublic` + token) y `errors/{curated-profile-not-found,curated-profile-access-denied}.error.ts`. Verificar: `tsc --noEmit`; test de arquitectura en verde.

## 5. Módulo `curated-profile` — aplicación (D5, D8)

- [x] 5.1 `dto/curated-profile.output.ts`, `dto/curated-profile-summary.output.ts`, `mappers/curated-profile.mapper.ts` (reutiliza `toProfileOutput`/`toExperienceOutput`; reagrupa skills por categoría). Verificar: `tsc --noEmit`.
- [x] 5.2 `use-cases/resolve-curated-profile.use-case.ts` según D5. Spec con repos mock: público OK; inexistente → NotFound; PRIVATE → NotFound; PROTECTED sin token / token incorrecto → AccessDenied; PROTECTED con token → OK; tema propio / sin tema → `modern-dark` / sin ninguno → `null`; overrides merge; skills reagrupadas sin categorías vacías; orden cronológico; `filterTags` vacío incluye todo; oculta excluida aunque esté en `includeIds`; locale `en` en todo el árbol; sin `accessToken/includeIds/excludeIds/filterTags`; perfil base ausente → `profile: null`. Verificar: ≥15 tests en verde sin `DATABASE_URL`.
- [x] 5.3 `use-cases/list-curated-profiles.use-case.ts` + spec (solo PUBLIC, orden de entrada, resueltos al locale, sin campos internos). Verificar: spec en verde.

## 6. Módulo `curated-profile` — infraestructura (D4, D7)

- [x] 6.1 `persistence/curated-profile.prisma-mapper.ts` (+spec: Visibility Prisma → dominio, JSON malformado, arrays) y `prisma-curated-profile.repository.ts`. Verificar: spec en verde.
- [x] 6.2 `controllers/access-token.decorator.ts` (+spec: header, query, precedencia header, ausente → undefined), `controllers/dto/curated-profile.query.ts` (extiende `LocaleQueryDto` con `token`). Verificar: spec en verde.
- [x] 6.3 `controllers/curated-profile.controller.ts` (`GET /api/curated-profiles`, `GET /api/curated-profiles/:slug`) con modelos Swagger en `docs/`, `@ApiHeader('X-Access-Token')`, `@ApiQuery('token')`, respuestas 200/401/404; `curated-profile.module.ts` (imports Profile/Experience/Skill/Theme); registrar en `AppModule`; tag `curated-profiles` en `swagger.ts`. Verificar: `curl :3300/api/curated-profiles | jq length` → 14; `curl :3300/api/curated-profiles/tech-lead-dotnet?locale=en` → 200 con `theme.slug: modern-dark`; `/api/docs-json` documenta ambas rutas y parámetros.

## 7. Verificación integral (Verifier)

- [x] 7.1 E2E `test/curated-profile.e2e-spec.ts` (D9/D10): listado (14, `all` último, `en`, exclusión de no públicos), detalle `tech-lead-dotnet` (cada experiencia intersecta; `eron-directa24`/`kiwox` ausentes), `java-senior-backend` (sin `ypfb`/`delta-cargo`), `generalist-polyglot` (15), `all` (12 categorías, 108 skills), orden cronológico, `locale=en`/`xx`, `Content-Language`, forma completa sin campos sensibles, 404 inexistente; mutaciones revertidas: `excludeIds`, `includeIds`, `PRIVATE` (404 + fuera del listado), `PROTECTED` (401 / 200 header / 200 query / 401 token incorrecto). Verificar: `npm run test:e2e` en verde (Fase 1 + Fase 2).
- [x] 7.2 Ejecutar los 7 criterios de aceptación de `docs/SPECS-POR-FASE.md` § Fase 2 y registrar comando + evidencia en `openspec/changes/add-curated-profile-resolution/verification.md`. Verificar: todos ✅; máx. 3 ciclos de reparación antes de escalar al Human Gate.
- [x] 7.3 `npm run lint`, `npm run typecheck`, `npm run build`, `npm test` en verde. Verificar: 0 problemas.

## 8. Documentación (Reviewer, previo al archive)

- [x] 8.1 Actualizar `backend/README.md` (endpoints, token de acceso, orden canónico, verificación Fase 2). Verificar: tabla de endpoints y de criterios actualizada.
- [x] 8.2 Sincronizar docs para el archive: checkbox Fase 2 en `CLAUDE.md` y `README.md`; `CLAUDE.md` § núcleo (orden canónico; paso 6 `ProfileView` → Fase 3); `docs/ARCHITECTURE.md` §6 (rutas Fase 2 ✅); `docs/DATA-POPULATION.md` (overrides no viven en el JSON); `docs/CHANGELOG.md`. Verificar: diff revisado; `openspec validate --strict` OK antes de `openspec archive`.
