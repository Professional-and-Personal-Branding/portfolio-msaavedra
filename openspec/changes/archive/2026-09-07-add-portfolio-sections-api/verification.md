# Verification — add-portfolio-sections-api

Verifier: escenarios de `public-portfolio-sections-api` (nueva) y del delta de `curated-profile-resolution`. Fecha: 2026-09-07. Entorno: Windows 11, Node 22, Postgres 16 (docker compose), `PORT=3300`.

Ciclos de reparación usados: **0 de 3**. Estado final: **todo en verde**.

## Escenarios

| Spec / requisito | Evidencia | Resultado |
|---|---|---|
| Educación visible (conteo, primero del JSON, `en`, sin `visible`) | e2e `sections.e2e-spec` + curl `GET /api/education?locale=en` → 6, `degree: "Ph.D. in Computer Science and Telecommunications"`, `inProgress: true` | ✅ |
| Certificaciones visibles | curl → 8, `issuer: "CertifPro, Sunrise Florida, EEUU"`; e2e | ✅ |
| Proyectos visibles | curl `?locale=en` → 2, `role: "Personal project"`, `tags` array; e2e | ✅ |
| Enlaces sociales visibles | curl → 3; e2e: github `featured: true` con `stats.repos` numérico, youtube `featured: false` | ✅ |
| Elementos ocultos excluidos | e2e: proyecto `visible=false` desaparece de `/api/projects` y de la vista curada (mutación revertida) | ✅ |
| OpenAPI | e2e: las cuatro rutas con `locale`; curl: 20 rutas totales, tag `sections` | ✅ |
| Selección de proyectos por tags (delta) | unit: intersección, sin intersección → `[]`, `filterTags` vacío → ambos por `order`, `excludeIds`/`includeIds`; e2e: `tech-lead-dotnet` 2, `devops-platform` 0, `generalist-polyglot` 2 (derivado de `cv-data.json`); curl `devops-platform projects=0` | ✅ |
| Secciones informativas sin filtrar (delta) | e2e: `education` 6, `certifications` 8, `socialLinks` 3 en tres perfiles; unit con loader mock | ✅ |
| Resultado listo para presentación (MODIFIED) | unit + e2e: 19 claves (`… skillCategories, projects, education, certifications, socialLinks`); locale `en` en proyectos, educación, certificaciones y social links; sin objetos `{es,en}` | ✅ |

**Totales:** `npm test` → 39 suites / 168 tests ✅ · `npm run test:e2e` → 5 suites / 73 tests ✅ · `npm run lint` → 0 problemas · `tsc --noEmit` y `npm run build` → OK.

## Desvíos respecto a la propuesta

- Ninguno funcional. El `PortfolioSectionsLoader` re-filtra `visible` por defensa aunque los adaptadores ya lo hagan (misma convención que el resolver con experiencias).
