# Tasks — add-portfolio-sections-api

> Referencias: `proposal.md`, `specs/*/spec.md`, `design.md` (D1–D7).

## 1. Módulo `education` (D1, D2, D5, D6)

- [x] 1.1 Domain: `Education` y `Certification` entities; puertos `EducationRepository` / `CertificationRepository` (`findAllVisible`) con tokens. Verificar: `tsc`; test de arquitectura.
- [x] 1.2 Application: DTOs `EducationOutput`/`CertificationOutput`, mappers (+spec locale/fallback), `ListEducationUseCase`, `ListCertificationsUseCase` (+spec con repo mock). Verificar: specs en verde.
- [x] 1.3 Infrastructure: mappers Prisma (+spec JSON malformado), adaptadores, `EducationController` (`GET /api/education`, `GET /api/certifications`), docs Swagger, `EducationModule` (exporta puertos). Verificar: `curl :3300/api/education | jq length` → 6; `/api/certifications` → 8.

## 2. Módulo `project` (D1, D2, D4, D5, D6)

- [x] 2.1 Domain: `Project` entity (implementa `Taggable`), puerto `ProjectRepository` + token. Verificar: `tsc`.
- [x] 2.2 Application: `ProjectOutput`, mapper (+spec), `ListProjectsUseCase` (+spec). Verificar: specs en verde.
- [x] 2.3 Infrastructure: mapper Prisma (+spec), adaptador, `ProjectController` (`GET /api/projects`), docs, `ProjectModule`. Verificar: `curl :3300/api/projects?locale=en` → 2 con `role` en inglés.

## 3. Módulo `social-link` (D1, D2, D5, D6)

- [x] 3.1 Domain: `SocialLink` entity, puerto + token. Verificar: `tsc`.
- [x] 3.2 Application: `SocialLinkOutput`, mapper (+spec: `stats` objeto/nulo, `description` vacía), `ListSocialLinksUseCase` (+spec). Verificar: specs en verde.
- [x] 3.3 Infrastructure: mapper Prisma (+spec `stats` malformado → null), adaptador, `SocialLinkController` (`GET /api/social-links`), docs, `SocialLinkModule`. Verificar: `curl :3300/api/social-links` → 3, github con `stats.repos`.

## 4. Integración en la resolución curada (D3, D4, D5)

- [x] 4.1 `curated-profile/application/services/portfolio-sections.loader.ts` (+spec: `Promise.all` de los cuatro puertos). Verificar: spec en verde.
- [x] 4.2 `CuratedProfileOutput` + mapper con `projects`, `education`, `certifications`, `socialLinks`; resolver aplica `selectByTags` a proyectos y usa el loader; `CuratedProfileModule` importa los tres módulos; docs Swagger de la respuesta. Verificar: `curated-profile.use-cases.spec` actualizado (proyectos con intersección/sin/override, conteos informativos, forma completa, locale en todo el árbol) en verde.
- [x] 4.3 `AppModule` y `swagger.ts` (tag `sections`). Verificar: `/api/docs-json` documenta las cuatro rutas.

## 5. Verificación (Verifier)

- [x] 5.1 `test/sections.e2e-spec.ts` (D7) y actualización de `test/curated-profile.e2e-spec.ts` (forma completa, `projects` por perfil desde el JSON, locale). Verificar: `npm run test:e2e` en verde (todas las suites).
- [x] 5.2 Ejecutar escenarios de los specs, `lint`, `typecheck`, `build`, `test`; registrar evidencia en `verification.md`. Verificar: todo ✅; máx. 3 ciclos.

## 6. Documentación (Reviewer)

- [x] 6.1 `backend/README.md` (endpoints y estructura), `docs/ARCHITECTURE.md` §6, `CLAUDE.md` (núcleo paso 3 incluye proyectos), `docs/CHANGELOG.md`. Verificar: `openspec validate --strict` OK antes de `openspec archive`.
