# Design — add-portfolio-sections-api

## Context

Ver `proposal.md`. Datos observados (`cv-data.json` / seed): 6 `Education` (orden = índice del JSON; el primero es el doctorado en curso), 8 `Certification`, 2 `Project` con tags (`tech-lead-dotnet` y `generalist-polyglot` intersectan ambos; `devops-platform`, `integration-architect`, `backend-payments-ror` ninguno), 3 `SocialLink` (github con `stats { repos, achievements[] }`, linkedin, youtube no destacado), 0 `FeaturedRepository` visibles. Los cuatro modelos tienen `order` y `visible`; ninguno tiene `createdAt`.

El resolver (`ResolveCuratedProfileUseCase`) ya inyecta seis puertos. `selectByTags` es genérico sobre `{ id, tags }`.

## Goals / Non-Goals

**Goals:** endpoints y datos listos para la Fase 4 con la plantilla de capas de siempre; el resolver sigue testeable con mocks; sin nuevas dependencias.
**Non-Goals:** CRUD, `FeaturedRepository`, cambios de esquema, cachear.

## Decisions

### D1 — Tres módulos mínimos, no uno genérico
`education` (agrega `Education` y `Certification`: dos entidades, dos puertos, un módulo, un controller con dos rutas), `project`, `social-link`. Cada uno: `domain/{entities,repositories}`, `application/{dto,mappers,use-cases}`, `infrastructure/{persistence,controllers}`. Un módulo "sections" genérico ahorraría archivos pero rompería la simetría que hace copiable la plantilla y complicaría el CRUD futuro por agregado.

### D2 — Puertos de solo lectura
`EducationRepository.findAllVisible()`, `CertificationRepository.findAllVisible()`, `ProjectRepository.findAllVisible()`, `SocialLinkRepository.findAllVisible()`; todos ordenan por `order` asc en el adaptador y el caso de uso no re-ordena (no hay regla de dominio de orden más allá de `order`). Tokens `Symbol` co-locados.

### D3 — `PortfolioSectionsLoader` en `curated-profile/application/services`
Servicio `@Injectable` que recibe los cuatro puertos y devuelve `{ education, certifications, projects, socialLinks }` (entidades) en `Promise.all`. El resolver pasa de seis a siete dependencias (loader) y su spec mockea el loader con un objeto simple. Alternativa descartada: inyectar los cuatro puertos en el resolver (diez dependencias, señal de que hace demasiado).

### D4 — Proyectos filtrados; educación, certificaciones y social links no
`Project` implementa `Taggable`; el resolver aplica `selectByTags(projects, criteria)` con los mismos `includeIds/excludeIds` (espacio de ids compartido, como ya ocurre entre experiencias y skills). Educación/certificaciones/social links no tienen tags: se incluyen completos (visibles). Siempre se cargan aunque la sección esté oculta: el volumen es mínimo y evita que el frontend tenga que pedirlos aparte al des-ocultar en el customizador (Fase 5).

### D5 — DTOs de salida
```
EducationOutput      { id, degree, institution, startDate, endDate, inProgress, order }
CertificationOutput  { id, name, issuer, year, order }
ProjectOutput        { id, name, role, period, summary, technologies[], tags[], url, order }
SocialLinkOutput     { id, platform, handle, url, label, description, stats, featured, order }
```
`stats` es `Record<string, unknown> | null` (JSON libre validado con `isPlainObject`). `description` vacía → `''` (misma convención de `resolveLocale`). Sin `visible` ni metadatos de persistencia. Los mismos DTOs se reutilizan dentro de `CuratedProfileOutput`.

### D6 — Rutas y Swagger
`GET /api/education`, `/api/certifications`, `/api/projects`, `/api/social-links`; `LocaleQueryDto` + `@RequestLocale()` + `Content-Language` (interceptor global ya existente). Tags Swagger `sections`. Modelos de respuesta en `infrastructure/controllers/docs/`.

### D7 — Tests
- Unit: mappers Prisma (JSON malformado → vacío), mappers de aplicación (locale), casos de uso (visibles/orden con repo mock), `PortfolioSectionsLoader`, resolver: proyectos filtrados/override/vacío, secciones informativas presentes, forma completa y locale (spec actualizado).
- E2E `test/sections.e2e-spec.ts`: cuatro endpoints (conteos y valores desde `cv-data.json`, locale `en`, `Content-Language`, oculto excluido con mutación revertida, OpenAPI). `test/curated-profile.e2e-spec.ts`: forma completa con las cuatro claves nuevas, `projects` por perfil derivado del JSON (`tech-lead-dotnet` 2, `devops-platform` 0), locale en todo el árbol.

## Risks / Trade-offs

- [Respuesta curada más grande] → +~10 KB; aceptable. Si crece, Fase 6 puede cargar solo secciones visibles.
- [Overrides con ids de proyectos] → mismo espacio que experiencias/skills; el backoffice (Fase 5) deberá listar proyectos al elegir overrides.

## Migration Plan

Sin migraciones. Deploy = build. Rollback = revertir el commit.
