# Tasks — upgrade-profile-structured-data

> Referencias: `proposal.md`, `design.md` (D1–D11, P1) y los deltas de `specs/` (`public-seo`, `public-portfolio-frontend`). La evidencia va en `verification/`, como en `add-certification-verification`.
>
> **Orden:** 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8. El 2 (fixture) va antes que el código de los dos lados, que se cambian **en el mismo commit** que sus tests (la ficha lo pide). El 7 (docs) puede escribirse en paralelo con el 5, salvo el resultado de TC-44, que necesita el 6.
>
> **Bases:** este change no escribe en ninguna base ni agrega migraciones. Los e2e corren contra la base de e2e de siempre (migrada y sembrada). La app real (6) usa una base **descartable** sembrada con el ejemplo (cada carga pública registra una visita); `portfolio` (la del owner, `localhost:5434`) no se toca.

## 1. Punto de partida

- [x] 1.1 Confirmar en la rama: `personJsonLd` en `profile-head.renderer.ts` y en `document-meta.ts` con la forma descrita en `design.md` § Context; `metaFromProfile` devuelve `jsonLd` aunque `noindex` sea `true`; `safeJson` escapa solo `<`; el fixture compara título, descripción y canonical. Verificar: `npm test` y `npm run test:e2e` en `backend/`, y `npm test` y `npm run perf:budget` (tras `npm run build`) en `frontend/`, verdes antes de tocar nada; notas y tamaño del arranque en `verification/1.1-punto-de-partida.txt`.

## 2. Fixture compartido (D2, D3, D4, D6, D7)

- [x] 2.1 `docs/fixtures/profile-head-consistency.json`: los casos existentes suman `sections`, `skillCategories`, `education`, `certifications` y `socialLinks` (datos ficticios, dominios de RFC 2606) y `expected.jsonLd` con el objeto completo de D2. Casos nuevos: (a) skills repetidas con distinta capitalización, 70 skills distintas, una institución repetida, una certificación con `verificationUrl`, `credentialId` y `expiresAt` y otra sin ninguno; (b) `skills`, `education` y `certifications` fuera de `sections`; (c) `visibility: "PROTECTED"` sin `expected.jsonLd`; (d) un título con `</script>` y una skill con `&` y `<`. Verificar: el JSON parsea; cada `expected.jsonLd` se revisa a mano contra D2 (claves en orden, sin `[]` ni `null`, `knowsAbout` ≤ 50) y se pega en `verification/2.1-fixture.md` el de un caso.

## 3. Servidor (D2–D8)

- [x] 3.1 `backend/src/modules/curated-profile/application/services/profile-head.renderer.ts`: `profilePageJsonLd` reemplaza a `personJsonLd` (constante `KNOWS_ABOUT_MAX = 50`; reglas de D2, D3 y D4; omite claves vacías); `headMetaFromProfile` la llama con `title`, `description`, `canonical`, `locale` y el origen ya derivados. `renderProfileHead` mantiene la condición `jsonLd && !noindex`. Sin cambios en el use case, la caché ni el controller. Verificar: `npm run typecheck` y `npm run lint` en `backend/`; `grep -rn personJsonLd backend/src` sin resultados.
- [x] 3.2 `safeJson`: escapa `<`, `>`, `&`, U+2028 y U+2029 como `\uXXXX` (D8). Verificar: tests de 3.3.
- [x] 3.3 Tests unitarios en `profile-head.renderer.spec.ts`:
  - forma de D2 para un perfil completo (incluido `@id` y `url` del `Person` iguales para `all` y otro slug, `inLanguage` por idioma, `url` igual al `canonical`);
  - `knowsAbout` sin repetidos, en orden, cortado en 50, y ausente con `skills` oculta o sin skills;
  - `alumniOf` sin instituciones repetidas; `hasCredential` con y sin campos de credencial, sin claves nulas; ambos ausentes con su sección oculta;
  - sin `dateModified` ni `dateCreated`;
  - `noindex` → sin `<script type="application/ld+json">`; sin `profile` → sin bloque;
  - golden test: el `<script>` completo de un caso chico como literal; el título `</script><script>alert(1)</script>` deja `</script` una sola vez en el bloque y `JSON.parse` devuelve el texto original; `C# & <F#>` sale como `C# & <F#>`.

  Verificar: `npm test` verde en `backend/`.
- [x] 3.4 `profile-head.consistency.spec.ts`: suma la comparación de `meta.jsonLd` con `expected.jsonLd` (igualdad profunda y `JSON.stringify`) y, cuando hay bloque, que el `<script>` del HTML parseado sea igual a `expected.jsonLd`. Verificar: `npm test` verde con el fixture de 2.1.

## 4. Cliente (D6, D7, D10)

- [x] 4.1 `frontend/src/shared/lib/document-meta.ts`: `profilePageJsonLd` gemela de la del servidor (misma firma lógica, mismo orden de claves); `metaFromProfile` deja `jsonLd` en `undefined` si `noindex`. `setJsonLd` no cambia (ya quita el bloque con `undefined`). Verificar: `npm run typecheck` y `npm run lint` en `frontend/`; `grep -rn personJsonLd frontend/src` sin resultados.
- [x] 4.2 `document-meta.consistency.spec.ts`: compara `meta.jsonLd` con `expected.jsonLd` (igualdad profunda y `JSON.stringify`) en todos los casos del fixture. Verificar: `npm test` verde en `frontend/`.
- [x] 4.3 `document-meta.spec.ts`: el bloque escrito tiene `"@type": "ProfilePage"` y `mainEntity` `Person`; con `visibility: 'PROTECTED'` se quita el bloque que trajo el servidor y no queda ninguno; al aplicar dos perfiles seguidos queda un solo bloque con la `url` del segundo; los tests de idempotencia existentes siguen verdes. Verificar: `npm test` verde.
- [x] 4.4 `npm run build` y `npm run perf:budget`: el arranque público sigue ≤ 155 KB gzip y en un solo JS de módulo. Verificar: salida en `verification/4.4-perf-budget.txt`, con la diferencia frente a 1.1.

## 5. E2e del fragmento (D6, D8)

- [x] 5.1 `backend/test/hardening.e2e-spec.ts`, bloque del fragmento de head:
  - `tech-lead-dotnet` en `es` y en `en`: extraer el `<script type="application/ld+json">`, parsearlo y comprobar `@type` `ProfilePage`, `url` igual al `canonical` (y a su `<loc>` del sitemap), `inLanguage`, `name` igual al `<title>`, `mainEntity.@type` `Person`, `mainEntity.name` igual al `fullName` sembrado y `knowsAbout` no vacío y ≤ 50;
  - `?via=k7m2q9xw4t&src=linkedin` no cambia el bloque;
  - `all` y `tech-lead-dotnet` comparten `mainEntity.@id`;
  - regresión: `PROTECTED` (con y sin `token`, y con `X-Access-Token`), `PRIVATE`, archivado e inexistente sin `application/ld+json`; `PUBLIC` con `listed: false` con bloque. Restaurar los valores al terminar.

  Verificar: `npm run test:e2e` verde; salida en `verification/5.1-e2e.txt`.

## 6. App real (D9, D11)

- [x] 6.1 Base descartable sembrada con el ejemplo (`SEED_DISPOSABLE_DB=1 npm run seed:example`), API en un puerto libre y la imagen de `frontend/Dockerfile` apuntando a ella, como en TC-35. Verificar: `GET /health` 200; `npm run prisma:status` confirma el nombre de la base antes de sembrar.
- [x] 6.2 Pasos 1 a 5 de TC-44 (los que no requieren deploy): `curl` del HTML de `/`, de un perfil público en `es` y `en`, de uno `PROTECTED` y de uno con `?via=`; el bloque en Chrome (DevTools, sin violaciones de CSP en la consola); el HTML de un perfil pegado en el validador de schema.org (modo código) sin errores. Verificar: transcripción en `verification/6.2-tc44.txt`.
- [x] 6.3 Borrar la base descartable. Verificar: `portfolio` sin cambios (`verification/6.3-base-del-owner.txt`).

## 7. Documentación

- [x] 7.1 `docs/MANUAL.md` § 2 (después de TC-40, y de TC-43 si ya está fusionado): **TC-44** con el texto de `verification.md`, estado 🔍 hasta correr los pasos 6 y 7 con el sitio desplegado; fila en la tabla de la suite de regresión (§ 6); espejo en `docs/manual/index.html`. Verificar: `npm run manual:check` verde.
- [x] 7.2 `docs/DEPLOY.md` § 9.5 y `docs/DEPLOY-RAILWAY.md` (lista posterior al deploy): una línea con el Rich Results Test y el validador de schema.org sobre dos perfiles públicos (TC-44, pasos 6 y 7). `docs/RELEASE-1.0.0-CHECKLIST.md`: «JSON-LD `Person`» pasa a «JSON-LD `ProfilePage` (con el `Person`)». Verificar: diff revisado.
- [x] 7.3 `docs/CHANGELOG.md`: entrada con D2 a D6 en una línea cada una y la nota de P1. Verificar: diff revisado.
- [x] 7.4 Al archivar: la línea de `upgrade-profile-structured-data` en el roadmap de `CLAUDE.md` (fecha de archivado, `ProfilePage` con `knowsAbout`, `alumniOf` y `hasCredential`, sin `dateModified` por P1, cliente sin bloque con `noindex`). Verificar: diff revisado en el PR de archivado.

## 8. Cierre

- [x] 8.1 Backend `npm test`, `npm run test:e2e`, `npm run lint`, `npm run typecheck`; frontend `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm run perf:budget`; `openapi:export` sin diferencias (el contrato no cambia, D10). Verificar: salida en `verification/8.1-cierre.txt`; `git diff --exit-code backend/openapi.json frontend/src/shared/types/api.d.ts`.
- [x] 8.2 `npx --no-install openspec validate upgrade-profile-structured-data --strict` y `npx --no-install openspec validate --all --strict` sin fallos ni avisos «Archive would refuse». Verificar: `Totals:` en `verification/8.2-validacion.txt`.
