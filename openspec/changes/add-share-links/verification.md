# Verificación — add-share-links

Ejecutada el 29 de octubre de 2026 sobre la rama `feat/share-links` (cortada de `feat/classify-profile-views`, PR #40). Evidencia cruda en `verification/`. Todas las escrituras fueron contra bases descartables del mismo contenedor (`portfolio_share_e2e`, `portfolio_share_check`, `portfolio_share_example`), borradas al terminar; la base `portfolio` del owner no se tocó (`verification/11.3-base-del-owner.txt`).

## Resultado por tarea

| Tarea | Resultado | Evidencia |
|---|---|---|
| 1.1 Punto de partida | `npm test` 86 suites / 769 tests, `npm run test:e2e` 11 suites / 188 tests y `npm test` del frontend 56 archivos / 632 tests, todos verdes antes de tocar nada | `verification/1.1-punto-de-partida.txt` |
| 2.1–2.5 Dominio | `share-code` (alfabeto, `encodeShareCode` con 0, 31, 32 y 255, `normalizeShareCode`), `normalizeSource`, entidad `ShareLink` (renombrar, revocar idempotente, etiqueta de 0 y 81), `resolveShareAttribution` (las cinco filas de D7 con y sin `src`, con y sin portal) | specs en `domain/` |
| 3.1 Esquema y migración | `20261029082012_add_share_links`: `CREATE TYPE`, `CREATE TABLE`, `ADD COLUMN`, índices y FK; sin `UPDATE` ni `DROP`. `prisma migrate diff --from-url … --to-schema-datamodel --exit-code` sin diferencias | `verification/3.1-migracion.sql` |
| 3.2 Persistencia | `PrismaShareLinkRepository` (`P2002` a colisión, `findActiveLinkedIn` el más reciente) y `CryptoShareCodeGenerator` | e2e de 4.4 y 5.6 |
| 4.1–4.3 Atribución | `via` y `src` en la query (primer valor, sin validadores que rechacen); la búsqueda del enlace dentro de la tarea en segundo plano; tests del caso de uso: activo, normalización del código, revocado, otro perfil, inexistente, mal formado sin consulta, falla con `src` y aviso sin el código, `execute()` con la búsqueda pendiente y sin contexto | `curated-profile.use-cases.spec.ts` |
| 4.4 e2e de atribución | 26 tests en `share-links.e2e-spec.ts`: activo a `HUMAN` con `shareLinkId`; revocado, otro perfil, inexistente y mal formado a 200 sin atribuir; `?src=Indeed` sin filas de `ShareLink`; gana el portal del enlace; slug anterior; `OWNER` con enlace; `PROTECTED` con `via` y sin token a 401 sin filas; cuerpos idénticos; parámetros repetidos y raros a 200; agregado; head; `robots.txt` | `verification/4.4-e2e.txt` |
| 5.1–5.5 API del panel | Cinco casos de uso, `AdminShareLinkController` (`linkedin` antes que `:linkId`), `countOpensByShareLink`, cascada con el perfil, el duplicado sin enlaces y la regla de arquitectura entre `curated-profile` y `analytics` | tests unitarios y e2e de 5.6 |
| 5.6 e2e del panel | 16 tests en `share-links-admin.e2e-spec.ts`: crear (portal normalizado, `opens: 0`), listar, 400, renombrar, revocar dos veces, 404 de otro perfil, 401, `opens` de 3 `HUMAN` sin `OWNER` ni `BOT`, `linkedin` 201/200/201 y 409, borrar, duplicar, archivar y renombrar el slug | `verification/5.6-e2e.txt` |
| 6.1–6.2 Agregado | `byShareLink` y `bySource` solo `HUMAN`; e2e con 3 por «Acme», 2 `src=indeed`, 1 directa y 1 `BOT`: `total` 6, desgloses exactos, revocado marcado, `byReferrer` en `directo` | `share-links.e2e-spec.ts` |
| 7.1 Contrato | `openapi.json` y `api.d.ts` regenerados; el export es idempotente (`git diff --exit-code` da 0) y el test de deriva pasa | `verification/11.1-cierre.txt` |
| 7.2–7.3 Cliente | `via` y `src` en `UrlState`, `buildProfileLink`, `earlyProfileKey`/`takeEarlyProfile`, `fetchCuratedProfile` y `public/profile-prefetch.js` con la misma clave; matriz de `early-profile.spec.ts` ampliada (7 a 14 búsquedas) | `frontend/src/features/curated-view/` |
| 7.4 Head | El fragmento con `via` y `src` es idéntico al de sin código, no registra visitas y `robots.txt` no los menciona | `share-links.e2e-spec.ts` |
| 7.5 Presupuesto | Arranque público 148,9 a 149,1 KB gzip (tope 155); el panel nuevo queda en el chunk del admin | `verification/7.5-perf-budget.txt` |
| 8.1–8.4 Panel | `ShareLinksPanel`, `PortalLinkCopy`, `ShareOnLinkedInButton`, hooks y tablas **Por enlace** y **Por portal**; tests del panel y de LinkedIn (`ShareLinks.test.tsx`) y del dashboard | `ShareLinks.test.tsx`, `DashboardPage.test.tsx` |
| 9.1–9.6 App real | Ver abajo | `verification/9.2-visitas.txt`, `9.4-cabeceras.txt`, `9.6-dashboard.jpg` |
| 10.1–10.3 Docs | TC-41, B2, B12, R9, C8 y glosario en `MANUAL.md` e `index.html`; `tc41-enlaces.jpg` y `tc18-dashboard.jpg` regeneradas con `manual:capture`; `manual:check`: 40 casos, 45 imágenes; `CLAUDE.md` (paso 6), `CHANGELOG.md`, `backend/README.md` y `PROPUESTA-FEATURES.md` (`upgrade-profile-structured-data` queda solo con `ProfilePage`) | diff |
| 11.1 Cierre | Todo en verde | `verification/11.1-cierre.txt` |
| 11.2 Validación | `validate add-share-links --strict` válido; `validate --all --strict`: 39 passed, 0 failed; sin «Archive would refuse» | `verification/11.2-validacion.txt` |
| 11.3 Base del owner | `portfolio` sin la migración nueva y sin la tabla `ShareLink` | `verification/11.3-base-del-owner.txt` |

## 9. App real

Imagen de `frontend/Dockerfile` en `:8093` (Caddy) con la API local en `:3331` y la base descartable `portfolio_share_check`, sembrada con `npm run seed` (vacía). Chrome no headless (`puppeteer-core`), un contexto sin sesión para las visitas (`HUMAN`) y la sesión del panel iniciada por `fetch` a `/api/auth/login` con credenciales aleatorias que no se imprimieron ni se versionaron.

- **9.2:** crear el enlace desde Publicación y abrir `/{slug}?via=<código>`, `?src=indeed` y `?via=<código>&src=indeed&lang=en`: **una sola petición del perfil por carga**, con `via` y `src` en la query en el orden `locale`, `via`, `src`, y **+1 `ProfileView`** cada una, con el `shareLinkId` y el `source` esperados (portal `linkedin` del enlace; gana sobre `src`).
- **9.3:** revocar desde el diálogo del panel (el texto avisa que el link sigue abriendo y que no se deshace) y volver a abrir: el perfil se ve igual, +1 fila con `shareLinkId` nulo y las aperturas del enlace siguen en 2.
- **9.4:** `/profile-prefetch.js` con `Cache-Control: no-cache`; el HTML de `/{slug}?via=…&src=…` con `canonical` y `og:url` sin query y el mismo head que sin código; el DOM hidratado, con los mismos valores en cada carga.
- **9.5:** **Compartir en LinkedIn** abre `share-offsite?url=` con la URL del perfil y el `via` del enlace `LINKEDIN_POST` (la navegación se interceptó y se abortó en el cliente: no se publicó nada ni se salió a LinkedIn); el segundo clic reusa el mismo enlace.
- **9.6:** el Dashboard muestra **Por enlace** (Acme revocado 2, Sin enlace 2) y **Por portal** (linkedin 2, indeed 1, Sin portal 1) con las 4 visitas de personas de la corrida.

Además, sobre una base de ejemplo (`portfolio_share_example`) y la misma imagen: `manual:capture` (`tc18-dashboard`, `tc41-enlaces`), `print:check` (20 casos, 0 con problemas) y `a11y:check` con el panel (el constructor y el dashboard sin violaciones).

## Desvíos y pendientes

- **7.3:** el test de «una sola llamada a `fetch` con `?via=` y la respuesta temprana presente» está en `early-profile.test.tsx` (donde ya vive el simulacro de `API_BASE_URL` vacío) y no en `use-curated-profile.test.tsx`; la paridad de clave y URL está en `early-profile.spec.ts`.
- **7.4:** las pruebas del fragmento de head y de `robots.txt` están dentro de `share-links.e2e-spec.ts`, no en un archivo aparte.
- **9.1:** la base `portfolio_share_check` se sembró con el CV (`npm run seed`, base vacía) y no con el ejemplo; el ejemplo se usó para `manual:capture`, `print:check` y `a11y:check` (`portfolio_share_example`).
- **10.1:** `scripts/capture-manual.mjs` deja de ser «sin escrituras»: además del login, crea **un** enlace de ejemplo por la API del panel (idempotente) para la captura de TC-41. La cabecera del script lo dice.
- **10.3:** la línea del change en el roadmap de `CLAUDE.md` se agrega al archivar (el change no se archivó).
- **Formulario de Publicación:** el `aria-label` del formulario de creación pasó a «Nuevo enlace de seguimiento» al descubrir en la app real que compartía nombre con su botón.
- **Tests de la vista pública:** dos tests con el timeout por defecto de Testing Library fallaron una vez mientras corrían procesos pesados; con el equipo en reposo, 3 corridas seguidas en verde (59 archivos, 907 tests).
- **`a11y:check` con panel:** quedan violaciones `serious` que ya existían (color-contrast en experiencias, formación y proyectos; scrollable-region de las barras del dashboard en móvil), ajenas a este change.
- **Pendiente para el owner:** aplicar `20261029082012_add_share_links` a `portfolio` con `npm run prisma:migrate` cuando actualice, y archivar `classify-profile-views` antes que este change (design, *Migration Plan* paso 1).
