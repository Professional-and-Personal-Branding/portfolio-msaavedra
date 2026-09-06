# Verification — add-curated-profile-resolution (Fase 2)

Verifier: criterios de aceptación de `docs/SPECS-POR-FASE.md` § Fase 2 y escenarios de los 4 specs del change. Fecha: 2026-09-06. Entorno: Windows 11, Node 22, Postgres 16 (docker compose), `PORT=3300`.

Ciclos de reparación usados: **0 de 3**. Estado final: **todo en verde**.

## Criterios de aceptación de la Fase 2

| # | Criterio | Comando / evidencia | Resultado |
|---|---|---|---|
| 1 | `tech-lead-dotnet?locale=es` devuelve solo experiencias cuyos tags intersectan con los filterTags | e2e "tech-lead-dotnet: cada experiencia intersecta" (verifica cada `tags` contra `cv-data.json`); curl → 13 experiencias, sin Eron/Directa24 ni Kiwox | ✅ |
| 2 | Un perfil con tag `java` NO trae experiencias exclusivamente .NET | `java-senior-backend` → 12 experiencias; YPFB Aviación, Delta Cargo y Nannys App (sin tag `java`) ausentes | ✅ |
| 3 | Overrides: `excludeIds` saca aunque matchee; `includeIds` mete aunque no matchee | unit `select-by-tags.spec` (10 casos) + `curated-profile.use-cases.spec`; e2e con mutación revertida: Novacomp excluida, Kiwox forzada en `tech-lead-dotnet` | ✅ |
| 4 | Orden cronológico descendente | e2e `generalist-polyglot` → `startDate` no creciente; curl `/api/experiences` → `2026-03 > 2023-07 > … > 2018-02` (Kiwox 2022-04 ahora antes que Vidoomy 2022-02) | ✅ |
| 5 | `locale=en` en inglés; locale inexistente cae al español sin romper | `?locale=en` → `title: "Tech Lead .NET"`, `roleType: "Tech Lead"`, `Content-Language: en`; `all?locale=xx` → 200, español | ✅ |
| 6 | `generalist-polyglot` resuelve la mayoría; `tech-lead-dotnet` un subconjunto coherente | 15 vs. 13 experiencias; `all` → 15 experiencias, 12 categorías, 108 skills | ✅ |
| 7 | Lógica de filtrado testeable sin DB | `npm test` sin `DATABASE_URL`: `select-by-tags.spec`, `select-skill-categories.spec`, `resolve-sections.spec`, `access-token.vo.spec`, `merge-theme-tokens.spec`, `curated-profile.use-cases.spec` (17 casos con repos mock) | ✅ |

## Escenarios de los specs

| Spec | Cobertura | Suite |
|---|---|---|
| `curated-profile-resolution` | intersección, sin intersección, `filterTags` vacío, oculta nunca entra (ni con `includeIds`), seed tech-lead/java/generalist, overrides (exclude gana, include fuerza, conflicto, id inexistente), skills por categoría (parcial, vacía desaparece, `all` completo), orden cronológico + desempate, visibilidad (público, privado=404, inexistente, protegido sin/mal/con token), secciones (custom+ocultas, default), forma completa, sin datos sensibles, locale en todo el árbol, testeable sin DB | unit (≥40) + e2e (11) |
| `theme-resolution` | tema propio, sin tema → `modern-dark`, sin ninguno → `null`; merge parcial, anidado, primitivos/arrays, nulo, inmutabilidad, claves nuevas; forma `{slug,name,isPreset,tokens}` | `merge-theme-tokens.spec` (7), use-case spec (2), e2e override mergeado (mutación revertida) |
| `public-curated-profile-api` | listado (14, `all` último, `en`, exclusión de PRIVATE/PROTECTED), detalle es/en/xx, `Content-Language`, 404 inexistente/PRIVATE, 401 sin token / token incorrecto, 200 por header y por query, OpenAPI con `locale`, `token`, `X-Access-Token`, respuestas 200/401/404 | e2e (7) + curl |
| `public-experience-api` (MODIFIED) | orden cronológico y desempate por `order` | `sort-experiences.spec` (4), e2e Fase 1 actualizado |

**Totales:** `npm test` → 22 suites / 117 tests ✅ · `npm run test:e2e` → 2 suites / 43 tests ✅ (26 Fase 1 + 17 Fase 2) · `npm run lint` → 0 problemas · `tsc --noEmit` y `npm run build` → OK.

## Evidencia runtime (app compilada en 3300)

```
GET /api/curated-profiles                         → 14 items, último "all"
GET /api/curated-profiles/tech-lead-dotnet?locale=en
   title=Tech Lead .NET | roleType=Tech Lead | theme=modern-dark | exps=13 | cats=11
   Content-Language: en | profile.fullName presente | tokens.colors.accent=#38bdf8
GET /api/curated-profiles/java-senior-backend      → 12 exps (sin YPFB, Delta Cargo, Nannys)
GET /api/experiences                              → 2026-03 > 2023-07 > 2023-01 > 2023-01 > 2022-10 > 2022-04 > 2022-02 > …
GET /api/curated-profiles/no-existe               → 404 {"error":"Not Found"}
GET /api/curated-profiles/all?locale=xx           → 200
OpenAPI /api/curated-profiles/{slug}: params path:slug, query:locale, query:lang, query:token, header:X-Access-Token; responses 200/401/404
```

## Desvíos respecto a la propuesta

- Ninguno funcional. El mapper Prisma degrada una `visibility` desconocida a `PRIVATE` (más restrictivo) con warning; no está en la spec pero es coherente con "no revelar existencia".
- `ProfileView`/`views` siguen en 0 (non-goal declarado; Fase 3).
