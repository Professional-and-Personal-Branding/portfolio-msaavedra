# Tasks — add-json-resume-export

> Referencias: `proposal.md`, `design.md` (D1–D10) y los deltas de `specs/` (`json-resume-export`, `public-curated-profile-api`, `curated-profile-builder`). La evidencia va en `verification/`, como en los changes archivados.
>
> **Orden:** 1 → 2 → 3 → 4 → 5 → 6 → 7. El grupo 5 (frontend) puede empezar cuando 4.3 dejó el contrato regenerado.
>
> **Bases:** el e2e corre contra la base local del e2e (migrada y sembrada), como el resto de `npm run test:e2e`. TC-48 corre contra una base **descartable** sembrada con `seed:example`, creada y borrada en la misma tarea. Ninguna tarea toca la base `portfolio` del owner. Las credenciales de prueba del panel solo viven en la terminal y nunca se escriben en `verification/`.

## 1. Punto de partida y schema

- [ ] 1.1 Confirmar la base: `npm run lint`, `npm run typecheck` y `npm test` del backend y del frontend en verde, `npm run perf:budget` (tamaño de partida) y `npx -y @fission-ai/openspec@1.14.1 validate --all --strict` con el `Totals:` de partida. Verificar: salida en `verification/1.1-punto-de-partida.txt` con el hash.
- [ ] 1.2 Vendorizar el schema (D9, R1): descargar `https://raw.githubusercontent.com/jsonresume/resume-schema/v1.0.0/schema.json` a `backend/test/fixtures/json-resume/schema-v1.0.0.json` sin reformatear; `SOURCE.md` al lado con URL, fecha, SHA-256 y la licencia del repositorio (confirmarla en el `LICENSE` del tag). Comparar con lo que asume `design.md` § Context (`$schema` draft-04, raíz con `additionalProperties: false` y `$schema` declarada, `certificates[].date` con `format: "date"`, `meta.lastModified` sin `format`). Verificar: diferencias anotadas en `verification/1.2-schema.txt`; si alguna contradice D4, frenar y reportar antes de seguir.
- [ ] 1.3 `ajv` (8.18.0) y `ajv-formats` (3.0.1) en `devDependencies` del backend con versión exacta. Verificar: `npm install` no agrega paquetes a `package-lock.json` (solo mueve la declaración); `git diff --stat backend/package-lock.json` en la evidencia.
- [ ] 1.4 Helper de validación de tests (`backend/test/support/json-resume-validator.ts` o similar): carga el schema, quita `$schema` de una copia, `new Ajv({ strict: false, allErrors: true })`, `addFormats(ajv, ['uri', 'email', 'date'])`. Test del helper: el SHA-256 coincide con `SOURCE.md`; un documento mínimo válido pasa; uno con `certificates[0].date: "2023"` falla; uno con una clave de raíz desconocida falla. Verificar: `npm test -- json-resume-validator` verde.

## 2. Mapper puro (D3, D4, D5)

- [ ] 2.1 `application/dto/json-resume.output.ts`: interfaz `JsonResumeOutput` con solo las claves del schema que usa D4 (todas opcionales salvo `$schema` y `meta`). Verificar: `npm run typecheck` verde; ningún import de Nest ni Prisma.
- [ ] 2.2 `profilePath` y `HOME_SLUG` extraídos de `sitemap.builder.ts` a un módulo compartido de `application/services` y reusados por el sitemap y `profile-head.renderer.ts`. Verificar: specs del sitemap, del head y de `profile-head.consistency` en verde sin cambiar aserciones.
- [ ] 2.3 Función pura `parseProjectPeriod(period)` según D4. Verificar: tests con `2026`, `2019 – 2022`, `2019-2022`, `2021-03 — 2022-11`, `2020 – actualidad`, `Proyecto personal`, `""` y los `period` reales de `docs/cv-data.json` y del ejemplo; ninguna salida rompe el patrón `iso8601`.
- [ ] 2.4 `application/mappers/json-resume.mapper.ts`: `toJsonResume(output, { baseUrl, locale })` según la tabla de D4, la regla de `sections` de D3, el orden de claves fijo y sin valores vacíos. Verificar: 2.5 en verde.
- [ ] 2.5 `json-resume.mapper.spec.ts` con una vista resuelta de fixture: perfil completo (valida con el helper de 1.4); `contact` oculto (sin `email`, `phone` ni `languages`); `presence` oculto (sin `profiles`); `hero` oculto (`basics` completo); `profile: null` (`basics` solo con `url`); `phone: null`; `endDate: null`; fecha inválida omitida; `headline` curado vacío (cae al del perfil); `updatedAt: null` (sin `lastModified`); `all` (`basics.url` termina en `/`); orden de claves; ninguna clave fuera del schema (comparar contra las `properties` del schema vendorizado). Verificar: `npm test -- json-resume.mapper` verde.

## 3. Casos de uso y rutas (D1, D2, D6, D7)

- [ ] 3.1 `ExportCuratedProfileResumeUseCase`: llama a `ResolveCuratedProfileUseCase.execute({ slug, locale, accessToken })` **sin `viewContext`** y mapea; devuelve también la visibilidad y el slug canónico para las cabeceras. Verificar: test unitario con el caso de uso de resolución mockeado: propaga 404/401 tal cual y nunca pasa `viewContext`.
- [ ] 3.2 `ExportCuratedProfileResumeForAdminUseCase`: `findById` → `CuratedProfileComposer.compose` → mapper; id inexistente → `CuratedProfileNotFoundError`; no consulta `resolvability`. Verificar: test unitario con repositorio mockeado (`PRIVATE` y archivado dan documento; id inexistente da error).
- [ ] 3.3 Handler público `@Get(':slug/resume.json')` en `curated-profile.controller.ts`, con una query DTO propia (`LocaleQueryDto` + `token`, sin `via` ni `src`), cabeceras de D6 y `Content-Location` para alias. Verificar: e2e de 3.5; además, que `GET /api/curated-profiles/tech-lead-dotnet` sigue respondiendo el detalle (la ruta nueva no lo tapa) y `GET /api/curated-profiles/resume.json` da 404 de slug inexistente.
- [ ] 3.4 Handler del panel `@Get(':id/resume.json')` en `admin-curated-profile.controller.ts` (bajo `JwtAuthGuard`), con `Cache-Control: private, no-store` y el mismo `Content-Disposition`. Cablear los dos casos de uso en `curated-profile.module.ts`. Verificar: e2e de 3.5.
- [ ] 3.5 `backend/test/json-resume-export.e2e-spec.ts`: por cada perfil público de la base, `es` y `en`, 200 y válido con el helper de 1.4; `work` igual (empresas y orden) a `experiences` del detalle; `all`; `PRIVATE` → 404; archivado → 404; `PROTECTED` sin token y con token incorrecto → 401, con token por query y por header → 200 sin el token en el cuerpo; alias → `Content-Location`; cabeceras de D6 (público y protegido); filas de `ProfileView`, `views` y `updatedAt` sin cambios después de dos descargas, también con `?via=&src=`; panel: sin sesión → 401, `PRIVATE` por id → 200 válido, id inexistente → 404, paridad byte a byte con la ruta pública para un `PUBLIC`. Verificar: `npm run test:e2e -- json-resume-export` verde; salida en `verification/3.5-e2e.txt`.

## 4. Contrato (D10)

- [ ] 4.1 Decoradores Swagger de las dos rutas según D10 (`@ApiProduces`, parámetros, 200/401/404, cabeceras, cuerpo como objeto con `externalDocs`). Verificar: `GET /api/docs-json` local muestra las dos rutas.
- [ ] 4.2 Test de OpenAPI (el existente o uno nuevo): la ruta pública declara `locale`, `X-Access-Token` y `token` y no declara `via` ni `src`. Verificar: verde.
- [ ] 4.3 `npm run openapi:export` y, en el frontend, `npm run api:types`. Verificar: `backend/openapi.json` y `frontend/src/shared/types/api.d.ts` con las dos rutas; test de deriva del frontend verde.

## 5. Constructor (D8)

- [ ] 5.1 `ProfileBuilderPage.tsx`, pestaña **Publicación**: «Descargar JSON Resume» con **ES** y **EN** (`<a href download>` a `/api/admin/curated-profiles/<id>/resume.json?locale=`), deshabilitados con «Guardá el perfil para exportarlo» si no hay id, y «Se exporta la última versión guardada» con cambios sin guardar (reusar el estado de cambios del aviso de `polish-builder-and-edge`). Mensajes con `text-text-muted` o el token que ya use la pestaña (sin colores literales; regla de `status-color-usage`). Verificar: 5.2 en verde.
- [ ] 5.2 `ProfileBuilderPage.test.tsx`: los dos `href` y el atributo `download` con un perfil guardado; deshabilitados y el texto con un perfil nuevo; el aviso con un cambio sin guardar. Verificar: `npm test -- ProfileBuilderPage` verde.
- [ ] 5.3 Frontend completo: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` y `npm run perf:budget`. Verificar: `perf:budget` igual al de 1.1 (la vista pública no cambia); salida en `verification/5.3-frontend.txt`.

## 6. Final y app real

- [ ] 6.1 Backend completo: `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:e2e`, y `npm run openapi:export` sin deriva. Verificar: salida en `verification/6.1-backend.txt`.
- [ ] 6.2 TC-48 en `docs/MANUAL.md` y `docs/manual/index.html` con el texto de `verification.md`; fila en la tabla de casos; glosario solo si hace falta. Verificar: `npm run manual:check` verde con un caso más.
- [ ] 6.3 Ejecutar TC-48 contra una base descartable sembrada con `seed:example`, con la imagen de `frontend/Dockerfile` (para probar que `/api/...` llega por Caddy) y Chrome: descarga desde el constructor (ES y EN, `PRIVATE` incluido) y los `curl` de los códigos y cabeceras; validar los archivos bajados con el helper de 1.4 (script de una línea con `node`). `a11y:check` con panel no debe sumar violaciones en el constructor. Borrar la base y los contenedores. Verificar: evidencia en `verification/6.3-tc48.md`.

## 7. Cierre

- [ ] 7.1 `npx -y @fission-ai/openspec@1.14.1 validate --all --strict` y `validate add-json-resume-export --strict`, sin fallos ni «Archive would refuse». Completar `verification.md`. Verificar: salida en `verification/7.1-validacion.txt`. CHANGELOG, roadmap de `CLAUDE.md` y la fila de `docs/PROPUESTA-FEATURES.md` § 6.2 (ruta de D1) quedan para el archivado.
