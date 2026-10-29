# Tasks — add-share-links

> Referencias: `proposal.md`, `design.md` (D1–D15, P1–P3) y los deltas de `specs/` (`share-links`, `profile-view-analytics`, `curated-profile-resolution`, `public-curated-profile-api`, `web-performance`, `public-seo`, `admin-curated-profile-crud`, `admin-analytics-dashboard`, `curated-profile-builder`). La evidencia va en `verification/`, como en `classify-profile-views`.
>
> **Requisito previo:** `classify-profile-views` fusionado (esta rama sale de la suya) y archivado antes que este change (design, *Migration Plan* paso 1).
>
> **Orden:** 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11. Cada grupo de código va en el mismo commit que sus tests. El 10 (docs) puede escribirse en paralelo con el 8, salvo las capturas, que necesitan el 9.
>
> **Bases:**
> - `portfolio` (la del owner, `localhost:5434`): **ninguna** tarea le aplica la migración, crea enlaces ni registra visitas.
> - Los e2e corren contra la base de e2e de siempre (migrada y sembrada), nunca contra `portfolio`.
> - `portfolio_share_check`: base descartable **nueva** en el mismo contenedor para los grupos 3 (generar la migración) y 9, borrada al terminar el 9. En PowerShell: `$env:DATABASE_URL = "postgresql://portfolio:portfolio@localhost:5434/portfolio_share_check?schema=public"`.
>
> Antes de cada comando que escriba en una base, correr `npm run prisma:status` y confirmar el destino. `backend/.env` apunta a `portfolio`: la variable de la terminal tiene que estar definida en la misma sesión.

## 1. Punto de partida

- [x] 1.1 Confirmar sobre la rama: que `ProfileView.kind` y `byKind` existen; que `CuratedProfileQueryDto` no declara `via`/`src` y que un `?via=` hoy responde 200; que `buildProfileLink` conserva parámetros desconocidos (hoy arrastraría `via`); que `metaFromProfile` arma `canonical` sin query; que `/profile-prefetch.js` sale con `Cache-Control: no-cache` en `frontend/Caddyfile`. Verificar: `npm test` y `npm run test:e2e` en `backend/` y `npm test` en `frontend/` verdes antes de tocar nada; notas en `verification/1.1-punto-de-partida.txt`.

## 2. Dominio de enlaces (D1, D2, D3, D7)

- [x] 2.1 `modules/curated-profile/domain/services/share-code.ts`: `SHARE_CODE_ALPHABET`, `SHARE_CODE_LENGTH = 10`, `encodeShareCode(bytes)` (5 bits bajos de cada byte), `isShareCode(value)` y `normalizeShareCode(raw)` (recorta, minúsculas, formato exacto o `null`). Verificar: tests de 2.5.
- [x] 2.2 `domain/services/normalize-source.ts`: `normalizeSource(raw)` con `^[a-z0-9][a-z0-9-]{0,31}$` después de recortar y pasar a minúsculas. Verificar: tests de 2.5.
- [x] 2.3 `domain/entities/share-link.entity.ts`: `ShareLink` con `isActive()`, `belongsTo(id)`, `rename(label)` (1 a 80 caracteres tras recortar, `Result`) y `revoke(now)` idempotente; tipo `ShareLinkKind = 'MANUAL' | 'LINKEDIN_POST'`. `domain/repositories/share-link.repository.ts`: `SHARE_LINK_REPOSITORY` con `findByCode`, `findById`, `listByProfile`, `create`, `save` y `findActiveLinkedIn(profileId)`; error de dominio de colisión de código. Verificar: test de arquitectura (sin Nest ni Prisma en `domain/`) y tests de 2.5.
- [x] 2.4 `domain/services/resolve-share-attribution.ts`: `resolveShareAttribution({ curatedProfileId, link, src })` → `{ shareLinkId, source }` con la tabla de D7 y la regla de `source`. Verificar: tests de 2.5.
- [x] 2.5 Tests unitarios: `encodeShareCode` con bytes fijos (0, 31, 32, 255) da los símbolos esperados; `normalizeShareCode` acepta mayúsculas y espacios alrededor y rechaza 9 u 11 caracteres, `i`/`l`/`o`/`u` y vacío; `normalizeSource` con `Indeed`, ` linkedin `, `get-on-board`, 33 caracteres, `mi portal`, `-x` y vacío; la entidad (etiqueta vacía o de 81 caracteres, revocar dos veces conserva la fecha); `resolveShareAttribution` con las cinco filas de D7 × con y sin `src` × enlace con y sin portal. Verificar: `npm test` verde.

## 3. Persistencia y migración (D1, D3, D15)

- [x] 3.1 `backend/prisma/schema.prisma`: enum `ShareLinkKind`, modelo `ShareLink` de D1 (FK `onDelete: Cascade`), y en `ProfileView` `shareLink ShareLink? @relation(onDelete: SetNull)`, `shareLinkId String?`, `source String?` con `@@index([shareLinkId])` y `@@index([source])`; `CuratedProfile.shareLinks`. Migración `<timestamp>_add_share_links` con `prisma migrate dev --create-only` **contra `portfolio_share_check`**, revisada a mano: sin `UPDATE` ni `DROP`. Verificar: el SQL en `verification/3.1-migracion.sql`; `npm run prisma:generate` y `npm run typecheck` verdes.
- [x] 3.2 `infrastructure/persistence/prisma-share-link.repository.ts` y su mapper: traduce `P2002` sobre `code` al error de colisión; `findActiveLinkedIn` devuelve el más reciente. `infrastructure/security/crypto-share-code.generator.ts` implementa `ShareCodeGenerator` (puerto en `application/ports/`) con `crypto.randomBytes(10)`. Cableado en `curated-profile.module.ts` con tokens Symbol. Verificar: e2e de 5.6.

## 4. Atribución en la ruta pública (D4, D6, D7, D8)

- [x] 4.1 `CuratedProfileQueryDto`: `via` y `src` opcionales con `@ApiPropertyOptional` y un `@Transform` que toma el primer valor si viene un arreglo y descarta lo que no sea texto; **sin** validadores que rechacen. El controller público los pasa al `ViewContext`. Verificar: e2e de 4.4 (parámetro repetido → 200).
- [x] 4.2 `analytics`: `NewProfileView` suma `shareLinkId?: string | null` y `source?: string | null`; `PrismaProfileViewRepository.record` los persiste sin cambiar la regla de `views`. Verificar: `npm run typecheck` y e2e de 4.4.
- [x] 4.3 `ResolveCuratedProfileUseCase.recordView`: después de la sesión, `normalizeShareCode(via)`; si hay código, `shareLinks.findByCode` en su propio `try/catch` (rechazo → sin enlace, `warn` sin el código); `resolveShareAttribution`; `record` con `kind`, `shareLinkId` y `source`. Tests unitarios con `FakeBackgroundTasks`: `execute()` resuelve con la búsqueda pendiente y con el mismo resultado; código malformado no llama al repositorio; enlace activo, revocado, de otro perfil e inexistente; falla del repositorio con `src`; sin `viewContext` no busca. Verificar: `npm test` verde.
- [x] 4.4 E2e `share-links.e2e-spec.ts` (con `BROWSER_UA` y `settleBackgroundTasks` antes de leer): enlace activo → `shareLinkId` y `HUMAN`; revocado, de otro perfil, inexistente y malformado → `shareLinkId` nulo y 200; `?src=Indeed` → `source: "indeed"` sin filas de `ShareLink`; `via` con portal + `src` → gana el portal; slug anterior con `via` → atribuida; cuerpos idénticos con `via` válido, inexistente y sin `via`; `PROTECTED` con `via` válido y sin token → 401 y ninguna fila; con cookie de admin → `OWNER` con `shareLinkId`; `?via=a&via=b&src=x&src=y` → 200. Verificar: `npm run test:e2e` verde; salida en `verification/4.4-e2e.txt`.

## 5. API del panel y ciclo de vida (D10, D12, D15)

- [x] 5.1 Casos de uso en `application/use-cases/admin/share-links.use-cases.ts` (un `execute()` por clase): `ListShareLinksUseCase` (con `ProfileViewRepository.countOpensByShareLink(ids)` → `opens` y `lastOpenedAt`, solo `HUMAN`), `CreateShareLinkUseCase` (normaliza el portal, 3 reintentos ante colisión), `RenameShareLinkUseCase`, `RevokeShareLinkUseCase` y `GetOrCreateLinkedInShareLinkUseCase` (409 si no es `PUBLIC` o está archivado). Pertenencia al perfil → `NotFoundError`. DTO de salida y mapper. Verificar: tests unitarios con repositorios simulados, incluido el reintento por colisión y el `ConflictError`.
- [x] 5.2 `analytics`: `countOpensByShareLink(ids)` en el puerto y en Prisma (`groupBy` por `shareLinkId` con `kind = 'HUMAN'`, `_count` y `_max(viewedAt)`). Verificar: e2e de 5.6.
- [x] 5.3 `infrastructure/controllers/admin-share-link.controller.ts` con las cinco rutas de D10, `JwtAuthGuard`, `adminValidationPipe`, DTOs `CreateShareLinkDto` (`label` 1–80, `portal` opcional) y `UpdateShareLinkDto`, y los schemas de respuesta para Swagger. La ruta `.../share-links/linkedin` se declara antes que `.../:linkId`. Verificar: e2e de 5.6.
- [x] 5.4 Borrado: confirmar que la cascada de la FK borra los enlaces junto con el perfil (y ajustar el repositorio si borra a mano). Duplicar: confirmar que no copia enlaces. Verificar: e2e de 5.6.
- [x] 5.5 Lint de arquitectura: `curated-profile` no importa nada de `analytics/infrastructure`; `analytics` no escribe en `ShareLink`. Verificar: `architecture.spec.ts` verde (sumar la regla si no existe).
- [x] 5.6 E2e (`share-links-admin.e2e-spec.ts`): crear (201, portal normalizado, `opens: 0`), listar (más reciente primero), etiqueta vacía y portal inválido → 400, renombrar, revocar dos veces (mismo `revokedAt`), enlace de otro perfil → 404, sin token → 401, `opens` cuenta 3 `HUMAN` y no las `OWNER` ni `BOT`, `linkedin` dos veces → 201 y 200 con el mismo código, revocado → 201 con otro, `PROTECTED`/`PRIVATE`/archivado → 409; borrar un perfil con dos enlaces → no queda ninguno; duplicar uno con tres → el duplicado no tiene enlaces. Verificar: `npm run test:e2e` verde; salida en `verification/5.6-e2e.txt`.

## 6. Agregado (D9)

- [x] 6.1 `ProfileViewRepository.countByShareLink(range)` y `countBySource(range)` (solo `HUMAN`, no nulos, descendente; el primero con `code`, `label`, `slug`, `portal` y `revoked`). `AggregateProfileViewsUseCase` y `ProfileViewsResponse` suman `byShareLink` y `bySource`, con `CountByShareLink` y `CountBySource` documentados. Verificar: tests unitarios del caso de uso (orden y listas vacías).
- [x] 6.2 E2e del agregado con un rango acotado a la prueba: el escenario *Enlaces y portales en el rango* (3 por «Acme», 2 `src=indeed`, 1 directa y 1 `BOT`) da `total: 6`, `byShareLink` y `bySource` exactos; un enlace revocado sigue apareciendo con `revoked: true`; la atribución no cambia `byReferrer` (`directo`). Verificar: `npm run test:e2e` verde.

## 7. Contrato y cliente público (D4, D5, D13, D14)

- [x] 7.1 `npm run openapi:export` y, en `frontend/`, `npm run api:types`: `via`, `src`, los schemas de enlaces y los dos desgloses aparecen en `backend/openapi.json` y en `src/shared/types/api.d.ts`. Verificar: el test de deriva del frontend y el escenario de `public-curated-profile-api` (parámetros declarados en `/api/docs-json`) verdes.
- [x] 7.2 Cliente:
  - `shared/lib/url-state.ts`: `via` y `src` en `UrlState` y `URL_KEYS` (vacío → `null`).
  - `shared/lib/profile-link.ts`: `buildProfileLink` quita `token`, `via` y `src`.
  - `features/curated-view/early-profile.ts`: `earlyProfileKey` y `takeEarlyProfile` con `[slug, locale, token, via, src]`.
  - `hooks/use-curated-profile.ts`: `fetchCuratedProfile` manda `via` y `src` en la query (orden `locale`, `via`, `src`, sin nulos); la clave de TanStack Query los incluye; `CuratedProfilePage` los toma de `useUrlState`.
  - `public/profile-prefetch.js`: lee `via` y `src`, los agrega a la URL y a la clave en el mismo orden.

  Verificar: `npm run typecheck`, `npm run lint` y los tests de 7.3.
- [x] 7.3 Tests de Vitest:
  - `early-profile.spec.ts`: `SEARCHES` suma `?via=k7m2q9xw4t`, `?via=`, `?src=linkedin`, `?src=LinkedIn`, `?via=a%20b`, `?via=x&via=y` y `?lang=en&token=abc&via=k7m2q9xw4t&src=indeed`; misma clave, misma URL y misma cabecera que la app.
  - `use-curated-profile.test.tsx`: con `?via=` y la respuesta temprana presente, una sola llamada a `fetch`.
  - `url-state.spec.ts` y un test de `buildProfileLink`: el menú desde `/?via=…&src=…&lang=en` conserva `lang` y no lleva `via` ni `src`; cambiar el idioma o el token conserva `via`.
  - `document-meta.spec.ts`: con `?via=…&src=…&lang=en` en la URL, `canonical` y `og:url` no tienen query.

  Verificar: `npm test` verde en `frontend/`.
- [x] 7.4 Fragmento de head: test del backend que pide `GET /api/public/profile-head?slug=tech-lead-dotnet&via=k7m2q9xw4t&src=x` y compara el cuerpo con el de sin `via`; `GET /robots.txt` no contiene `via` ni `src`. Verificar: `npm run test:e2e` verde.
- [x] 7.5 `npm run perf:budget` sigue bajo 155 KB gzip con el cliente nuevo. Verificar: salida en `verification/7.5-perf-budget.txt`.

## 8. Panel: Publicación y dashboard (D11, D12)

- [x] 8.1 `features/backoffice/curated-profiles/`: componente `ShareLinksPanel` en la pestaña Publicación (lista, crear con etiqueta y portal con sugerencias, renombrar en el lugar, copiar con `token` si es `PROTECTED`, revocar con confirmación, estado sin guardar) y `PortalLinkCopy` para `?src=`. Hooks de TanStack Query sobre los tipos generados; invalidación del listado al crear, renombrar o revocar. Verificar: tests de 8.4.
- [x] 8.2 `ShareOnLinkedInButton`: habilitado solo con perfil guardado, `PUBLIC` y no archivado (motivo visible si no); abre la pestaña en el clic, pide el enlace, navega a `share-offsite` con la URL codificada, anula `opener`; si falla, cierra la pestaña y avisa. Verificar: tests de 8.4.
- [x] 8.3 `features/backoffice/dashboard/DashboardPage.tsx`: tablas **Por enlace** (con «Sin enlace» y marca de revocado) y **Por portal** (con «Sin portal» y la línea sobre el referrer), con sus estados vacíos. Verificar: tests de 8.4.
- [x] 8.4 Tests de Vitest: los escenarios de `curated-profile-builder` (crear y copiar, `PROTECTED`, revocar, sin guardar, link por portal; LinkedIn con perfil público, `PROTECTED` deshabilitado y falla de la API con `window.open` simulado) y de `admin-analytics-dashboard` (enlaces en el rango, sin enlaces, portales, sin portales, cambio de rango). Verificar: `npm test`, `npm run lint` y `npm run typecheck` verdes en `frontend/`.

## 9. App real sobre base descartable

- [x] 9.1 Preparar `portfolio_share_check`: migrar, `npm run seed` (base vacía) y `npm run admin:bootstrap` con credenciales de prueba del `.env.example`. Levantar la imagen de `frontend/Dockerfile` contra la API local, como en TC-35. Verificar: `npm run prisma:status` muestra `portfolio_share_check`; `GET /health` 200.
- [x] 9.2 **Una visita por carga a través del SPA:** crear un enlace desde Publicación; contar filas de `ProfileView` antes y después de abrir en Chrome no headless (sin sesión, con su UA real, para que la visita sea `HUMAN`) `/{slug}?via=<código>`, `/{slug}?src=indeed` y `/{slug}?via=<código>&src=indeed&lang=en`. Verificar: +1 fila por carga, con el `shareLinkId` o el `source` esperados, y una sola petición del perfil en la pestaña de red, con `via`/`src` en la query; transcripción en `verification/9.2-visitas.txt`.
- [x] 9.3 Revocar el enlace desde el panel y volver a abrirlo. Verificar: el perfil se ve igual, +1 fila con `shareLinkId` nulo y las aperturas del enlace no cambian; en la misma transcripción.
- [x] 9.4 `curl -sI <imagen>/profile-prefetch.js` y el HTML de `/{slug}?via=<código>`. Verificar: `Cache-Control: no-cache` en el script; `canonical` y `og:url` sin query en el HTML inicial y, tras hidratar, en el DOM; salida en `verification/9.4-cabeceras.txt`.
- [x] 9.5 Compartir en LinkedIn con un perfil `PUBLIC`: la pestaña abre `share-offsite` con la URL codificada con `?via=`; no se publica nada. Verificar: captura de la URL de la pestaña en `verification/9.5-linkedin.txt`.
- [x] 9.6 Dashboard con el rango del día: tablas Por enlace y Por portal con los conteos de 9.2 y 9.3 (las cargas de Chrome controlado que den `BOT` no suman). Verificar: captura en `verification/9.6-dashboard.jpg`. Borrar `portfolio_share_check` al terminar.

## 10. Documentación

- [x] 10.1 `docs/MANUAL.md`: **TC-41 — Compartir un perfil con un enlace de seguimiento** (crear el enlace, copiarlo, abrirlo en una ventana privada, ver la apertura en Publicación y en el dashboard, revocarlo y comprobar que el link sigue abriendo sin atribuir; link genérico `?src=`; Compartir en LinkedIn); recorrido de Publicación y del dashboard actualizados; glosario (*enlace de seguimiento*, *portal*, *apertura*); nota de que **Por origen** casi siempre da `directo` en producción y por qué. Capturas `tc41-enlaces.jpg` (Publicación) y `tc18-dashboard.jpg` regeneradas con `npm run manual:capture` contra la API de ejemplo (el script crea el enlace por la API del panel sobre esa base descartable). Verificar: las capturas en `docs/manual/`.
- [x] 10.2 `docs/manual/index.html` alineado con `MANUAL.md` (caso, imágenes y mensajes literales). Verificar: `npm run manual:check` verde.
- [x] 10.3 `CLAUDE.md` (paso 6 del núcleo: atribución por `via`/`src`; la línea del change en el roadmap al archivar), `docs/CHANGELOG.md`, `backend/README.md` (rutas nuevas) y `docs/PROPUESTA-FEATURES.md` (§ 6.2: share-offsite resuelto acá, `upgrade-profile-structured-data` queda con `ProfilePage`). Verificar: revisión del diff.

## 11. Cierre

- [x] 11.1 `backend/`: `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:e2e`; `frontend/`: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run perf:budget`, `npm run manual:check`. Verificar: todo verde; salida en `verification/11.1-cierre.txt`.
- [x] 11.2 `npx -y @fission-ai/openspec@1.14.1 validate add-share-links --strict` y `validate --all --strict`, sin «Archive would refuse» en este change (las fallas previas por requisitos largos de specs archivadas se informan aparte). Verificar: salida en `verification/11.2-validacion.txt`.
- [x] 11.3 Comprobar que la base `portfolio` del owner no cambió (`prisma migrate status` contra ella sin la migración nueva aplicada y sin filas en `ShareLink` si la tabla existiera). Verificar: nota en `verification/11.3-base-del-owner.txt`.
