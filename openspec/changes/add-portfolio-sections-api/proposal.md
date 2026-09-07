# add-portfolio-sections-api — Secciones del portafolio (previo a Fase 4)

> Change corto entre las Fases 3 y 4 del roadmap (`docs/SPECS-POR-FASE.md`). No corresponde a una fase propia: cierra un hueco detectado en `add-curated-profile-resolution` (non-goal declarado) para que el frontend público (Fase 4) tenga todos los datos de sus secciones sin rehacer el backend a mitad de esa fase.

## Why

Las secciones por defecto de un perfil curado son `hero, stats, experience, skills, education, certifications, contact`, y el demo estático muestra además proyectos destacados y presencia pública (GitHub/LinkedIn/YouTube). Hoy la API resuelve perfil, experiencias y skills, pero **educación, certificaciones, proyectos y enlaces sociales solo existen en la base**: nada los expone. La Fase 4 no puede renderizar la home ni la vista curada completas sin esto.

## What Changes

- **Módulos mínimos `education`, `project` y `social-link`** (misma plantilla de capas): entidades, puertos de lectura, adaptadores Prisma, mappers a DTOs resueltos al locale.
- **Endpoints públicos de solo lectura**: `GET /api/education`, `GET /api/certifications`, `GET /api/projects`, `GET /api/social-links` (solo visibles, orden `order` asc, idioma negociado, `Content-Language`).
- **La resolución de perfiles curados se completa**: la vista resuelta agrega `education`, `certifications`, `socialLinks` (sin filtrar: no tienen tags) y `projects` **filtrados por la misma regla de tags + overrides** que experiencias y skills (comparten espacio de ids), ordenados por `order`.
- Un servicio de aplicación `PortfolioSectionsLoader` agrupa esas cuatro lecturas para que el resolver no crezca a diez dependencias.
- Tests unitarios (mappers, casos de uso, loader, resolver con proyectos) y e2e (cuatro endpoints + forma completa de la vista curada con conteos derivados de `cv-data.json`).

### Non-goals

- CRUD de estas secciones y del perfil base: se propone como parte de la Fase 5 (el backoffice visual lo necesitará) o un change `add-sections-crud` previo.
- `FeaturedRepository`: el seed no tiene ninguno visible (curaduría manual pendiente, ver `docs/RELEASE-1.0.0-CHECKLIST.md`). Se añadirá cuando exista contenido.
- Cambios al `schema.prisma`, al seed o a `cv-data.json`. Frontend (Fase 4).
- Cálculo de `stats` (años, empresas, etc.): lo deriva el frontend de los datos ya expuestos.

## Capabilities

### New Capabilities
- `public-portfolio-sections-api`: lectura pública de educación, certificaciones, proyectos y enlaces sociales, resueltos al locale.

### Modified Capabilities
- `curated-profile-resolution`: la vista resuelta incorpora `education`, `certifications`, `projects` (seleccionados por tags/overrides) y `socialLinks`; nueva regla de selección de proyectos.

## Impact

- **Nuevo**: `backend/src/modules/{education,project,social-link}/**`, `curated-profile/application/services/portfolio-sections.loader.ts`, `test/sections.e2e-spec.ts`.
- **Modificado**: `curated-profile` (DTO de salida, mapper, resolver, módulo, docs Swagger), `test/curated-profile.e2e-spec.ts` (forma completa), `swagger.ts` (tags), `app.module.ts`.
- **Dependencias**: ninguna nueva.
- **Docs al archivar**: `backend/README.md` (endpoints), `docs/ARCHITECTURE.md` §6, `docs/CHANGELOG.md`, `CLAUDE.md` (nota en el núcleo: paso 3 incluye proyectos).
