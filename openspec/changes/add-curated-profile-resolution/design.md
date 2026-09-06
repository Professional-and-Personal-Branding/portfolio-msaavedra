# Design — add-curated-profile-resolution

## Context

Ver `proposal.md` (Why) y `docs/SPECS-POR-FASE.md` § Fase 2. Punto de partida: Fase 1 archivada (`profile`, `experience`, shared `Result`, i18n, `@RequestLocale()`, `toHttpException`, test de arquitectura, e2e).

Datos observados en `cv-data.json` / seed:
- 14 perfiles curados `PUBLIC` (13 plantillas + `all` con `filterTags = []`), todos con `themeId = modern-dark`, `layout = classic`, `sectionsOrder` completo, `sectionsHidden = []`, `includeIds/excludeIds = []`, `accessToken = null`.
- Intersecciones reales: `tech-lead-dotnet` → 13 exps (excluye `eron-directa24`, `kiwox`); `java-senior-backend` → 12 (excluye `nannys`, `delta-cargo`, `ypfb`); `generalist-polyglot` → 15; `all` → 15 + 12 categorías / 108 skills.
- **`order` no es cronológico** en 2 casos: `vidoomy` (2022-02, order 5) precede a `kiwox` (2022-04, order 6); `nsoft` (2019-01) precede a `delta-cargo` (2019-07). Hay empates reales de `startDate` (`eron-directa24`/`k27` en 2023-01; `banco-ganadero`/`mojix` en 2021-06).
- Skills: sus `tags` los asigna el seed por categoría (`tagsForSkillCategory`), así toda la categoría comparte tags.
- Ids de experiencias/skills son `cuid` generados en el seed → los overrides no pueden venir del JSON; se prueban con mocks (unit) y mutaciones revertidas (e2e).

## Goals / Non-Goals

**Goals:**
- Núcleo de selección **puro y genérico** (`Taggable = { id, tags }`) reutilizable para experiencias, skills y, más adelante, proyectos.
- Un solo orden canónico de experiencias en toda la API.
- Módulos `skill` y `theme` con la misma plantilla de Fase 1, listos para crecer sin refactor.
- Cero acoplamiento a Prisma en la lógica de resolución (criterio de la fase).

**Non-Goals:**
- Analítica (`ProfileView`, `views`), endpoints de skills/temas/educación, proyectos en la resolución (ver proposal → Non-goals).
- Cachear la resolución.

## Decisions

### D1 — Orden canónico: `startDate` desc, desempate `order` asc (cambia Fase 1)
CLAUDE.md dice "por `order` y luego por fecha descendente"; SPECS Fase 2 exige "cronológico descendente". Con los datos reales ambos no pueden cumplirse (ver Context). Se elige **cronológico** porque el perfil curado es una línea de tiempo profesional y así lo verifica el criterio de aceptación; `order` sigue siendo útil como desempate (hay 2 empates reales de mes) y como control manual futuro dentro de un mismo mes. Para no tener dos órdenes distintos en la API, `GET /api/experiences` adopta el mismo criterio (delta MODIFIED en `public-experience-api`; se actualiza `sortExperiences`, el `orderBy` del repositorio y el e2e de Fase 1).
*Alternativas descartadas*: (a) mantener `order`-first y reordenar `cv-data.json` → toca la fuente de datos del usuario y sigue frágil ante ediciones; (b) órdenes distintos por endpoint → inconsistencia visible en el frontend.
**Decisión de producto: requiere OK explícito del gate.**

### D2 — Servicio de selección genérico en dominio
`selectByTags<T extends Taggable>(items, { filterTags, includeIds, excludeIds })` en `curated-profile/domain/services/select-by-tags.ts`. Reglas: `excludeIds` gana siempre; `includeIds` fuerza; `filterTags` vacío = todo; conserva el orden de entrada; no muta. Las experiencias no visibles se filtran **antes** (el puerto ya devuelve solo visibles; el caso de uso re-filtra por defensa). Skills: se aplica sobre la lista aplanada y luego se reagrupa por categoría descartando vacías.

### D3 — Módulos mínimos `skill` y `theme`
- `skill`: `SkillCategory` (id, name LocalizedText, order, skills: `Skill[]{id,name,tags,order}`), puerto `SkillCategoryRepository.findAll()` (`SKILL_CATEGORY_REPOSITORY`), adaptador Prisma con `include: { skills: { orderBy: order } }`, `orderBy: order`. Sin controller. Módulo exporta el proveedor del puerto.
- `theme`: `Theme` (id, name, slug, isPreset, tokens: `ThemeTokens = Record<string, unknown>` validado como objeto plano), puerto `ThemeRepository.findById(id)` / `findBySlug(slug)` (`THEME_REPOSITORY`), servicio de dominio `mergeThemeTokens(base, overrides)` (merge profundo inmutable: objetos planos recursivos, primitivos/arrays reemplazan, `null`/`undefined` en override no pisan). Constante `DEFAULT_THEME_SLUG = 'modern-dark'`. Sin controller.
*Alternativa descartada*: meter skills y tema dentro de `curated-profile` → mezcla agregados y obliga a duplicar cuando lleguen sus CRUD en Fase 3.

### D4 — Módulo `curated-profile`
```
modules/curated-profile/
├── domain/
│   ├── entities/curated-profile.entity.ts        (Visibility enum propio del dominio: 'PUBLIC'|'PRIVATE'|'PROTECTED')
│   ├── value-objects/access-token.vo.ts          (matches(candidate) en tiempo constante, sin node:crypto)
│   ├── services/select-by-tags.ts · resolve-sections.ts (+ DEFAULT_SECTIONS)
│   ├── repositories/curated-profile.repository.ts (findBySlug, findAllPublic + token)
│   └── errors/curated-profile-not-found.error.ts · curated-profile-access-denied.error.ts
├── application/
│   ├── dto/curated-profile.output.ts · curated-profile-summary.output.ts
│   ├── mappers/curated-profile.mapper.ts
│   └── use-cases/resolve-curated-profile.use-case.ts · list-curated-profiles.use-case.ts
├── infrastructure/
│   ├── persistence/curated-profile.prisma-mapper.ts · prisma-curated-profile.repository.ts
│   └── controllers/curated-profile.controller.ts · docs/*.response.ts · access-token.decorator.ts
└── curated-profile.module.ts   (imports: ProfileModule, ExperienceModule, SkillModule, ThemeModule)
```
El caso de uso `ResolveCuratedProfileUseCase` recibe por token: `CURATED_PROFILE_REPOSITORY`, `PROFILE_REPOSITORY`, `EXPERIENCE_REPOSITORY`, `SKILL_CATEGORY_REPOSITORY`, `THEME_REPOSITORY`. `ProfileModule` y `ExperienceModule` pasan a exportar sus proveedores de puerto (hoy exportan solo casos de uso). Las lecturas se lanzan en paralelo (`Promise.all`) tras validar visibilidad/acceso.

### D5 — Algoritmo de `ResolveCuratedProfileUseCase.execute({ slug, locale, accessToken? })`
1. `findBySlug(slug)` → si no existe **o** `visibility = PRIVATE` → `fail(CuratedProfileNotFoundError)`.
2. Si `PROTECTED` y `!profile.accessToken.matches(accessToken)` → `fail(CuratedProfileAccessDeniedError)`.
3. En paralelo: perfil base, experiencias visibles, categorías de skills, tema (`themeId` → `findById`; si null/no existe → `findBySlug(DEFAULT_THEME_SLUG)`; si tampoco → `null`).
4. `selectByTags` sobre experiencias → `sortExperiences` (D1) → `toExperienceOutput(locale)`.
5. `selectByTags` sobre skills aplanadas → reagrupar por categoría → `{ name: resolveLocale, skills: names }`.
6. `mergeThemeTokens(theme.tokens, profile.themeOverrides)`.
7. `resolveSections(sectionsOrder, sectionsHidden)`.
8. `ok(toCuratedProfileOutput(...))` con `profile` = `toProfileOutput(base, locale)` (si no hay perfil base → `profile: null`; no se falla la resolución).
Reutiliza mappers de aplicación de `profile` y `experience` (dependencia application→application entre módulos, permitida; el test de arquitectura sigue prohibiendo Prisma/infrastructure).

### D6 — Errores y códigos HTTP
Nuevo `AccessDeniedError extends DomainError` en `shared/domain/errors` (code `*_ACCESS_DENIED`). `toHttpException`: `AccessDeniedError → UnauthorizedException` (401). `PRIVATE` reutiliza `NotFoundError` (404) a propósito para no revelar existencia. Se elige 401 (y no 403) porque el remedio es presentar credencial.

### D7 — Token de acceso en la request
Decorador `@AccessToken()` en `curated-profile/infrastructure/controllers/`: lee `X-Access-Token` y, si falta, `?token=`. Documentado en Swagger con `@ApiHeader` + `@ApiQuery`. El `LocaleQueryDto` de Fase 1 se reutiliza; se agrega `token` opcional a un `CuratedProfileQueryDto` que lo extiende para que `ValidationPipe({ whitelist })` no lo descarte.

### D8 — Listado
`ListCuratedProfilesUseCase` → `findAllPublic()` (Prisma: `where visibility = PUBLIC`, `orderBy createdAt asc`) → `CuratedProfileSummaryOutput`. No expone `filterTags` ni overrides. El frontend agrupa por `roleType` (ya viene resuelto al locale).

### D9 — Tests
- Unit (sin DB): `select-by-tags.spec` (≥10 casos incl. conflicto include/exclude, ids inexistentes, vacío), `resolve-sections.spec`, `merge-theme-tokens.spec` (6 escenarios de la spec), `access-token.vo.spec`, `resolve-curated-profile.use-case.spec` (repos mock: público, privado→NotFound, inexistente→NotFound, protegido sin/con token, tema propio/default/null, skills reagrupadas, orden, locale en todo el árbol, sin campos sensibles), `list-curated-profiles.use-case.spec`, mappers Prisma.
- E2E `test/curated-profile.e2e-spec.ts`: listado (14, `all` último, `en`), detalle `tech-lead-dotnet` (intersección verificada contra `cv-data.json`), `java-senior-backend` sin `ypfb`/`delta-cargo`, `generalist-polyglot` = 15, `all` = 12 categorías, orden cronológico, `locale=xx`, 404 inexistente; con mutación revertida: `excludeIds`/`includeIds`, `PRIVATE` → 404 + fuera del listado, `PROTECTED` → 401 / 200 header / 200 query. Actualizar `test/app.e2e-spec.ts` (escenario de orden) y `sort-experiences.spec.ts`.
- Test de arquitectura: incluye automáticamente los módulos nuevos (recorre `modules/*/domain|application`).

### D10 — Datos de prueba e ids
Los e2e obtienen ids reales vía `PrismaService` (mismo patrón de Fase 1) y siempre restauran en `finally`. Las aserciones de conteo se derivan de `cv-data.json` aplicando la misma regla de intersección en el test (independiente de la implementación).

## Risks / Trade-offs

- [Cambio de orden en `GET /api/experiences` altera un contrato ya archivado] → delta MODIFIED explícito, e2e actualizado, decisión D1 visible al gate; sin consumidores externos aún (frontend no existe).
- [Overrides con ids `cuid` no reproducibles entre seeds] → el backoffice (Fase 3) los gestionará; hoy se prueban por mutación. Documentar en DATA-POPULATION que `includeIds/excludeIds` no viven en el JSON.
- [Token en query string queda en logs/historial] → se documenta que el header es el medio preferido; el query existe para links compartibles (caso de uso real: mandar un link a un reclutador). Fase 6 podrá endurecerlo.
- [`themeOverrides` con formas arbitrarias] → `mergeThemeTokens` solo recorre objetos planos y nunca lanza; JSON no-objeto se ignora con warning.
- [`Promise.all` cae si falla una lectura] → aceptable: son lecturas de la misma DB; un fallo es 500 legítimo.

## Migration Plan

Sin migraciones de esquema. Despliegue local: `npm run build && npm run start:dev`. El cambio de orden es inmediato tras deploy; rollback = revertir el commit.

## Open Questions

- ¿Debe el listado incluir un conteo de experiencias por perfil para el menú? Diferible: el frontend puede derivarlo al abrir el perfil; agregarlo luego es aditivo.
