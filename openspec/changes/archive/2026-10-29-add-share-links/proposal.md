# add-share-links — Saber qué link abrió cada visita: enlaces por destinatario y atribución por portal

> Segundo change de la **Fase 1.2** de `docs/PROPUESTA-FEATURES.md` (§ 1 punto 3, § 4 E3 ítem 3.0 y E4 ítem 4.2, § 5.3, § 6.2 fila `add-share-links`, § 8 y § 9). Implementa la decisión **P2 = C** del owner (2026-10-28): **los dos mecanismos**, un `ShareLink` (`?via=<código>`) por destinatario o portal, con etiqueta y revocación, y `?src=<portal>` como atribución genérica sin gestión. Se apoya en `classify-profile-views` (PR #40): la atribución solo cuenta las visitas `HUMAN`.

## Why

Durante una búsqueda de empleo activa, el owner manda el mismo perfil curado a varias personas y lo publica en varios portales. Hoy no puede saber cuál de esos envíos generó una visita.

**Hallazgo: el origen de la visita nunca llega.** El agregado `byReferrer` (`profile-view-analytics`) se construye sobre el header `Referer` de la petición a la API, y esa petición no lo trae por dos motivos que se suman:

1. `frontend/Caddyfile` responde `Referrer-Policy no-referrer` en todo el sitio. El navegador no conserva el origen externo ni para la navegación ni para los `fetch` de la página.
2. Aun sin esa política, el `Referer` de la petición a la API sería la URL del propio sitio, no la de LinkedIn o del correo: la SPA (`use-curated-profile.ts`) y la petición temprana (`public/profile-prefetch.js`) no reenvían `document.referrer`.

En producción, entonces, `byReferrer` siempre da «directo» (o «interno»). Cambiar la política de referrer no lo arregla: LinkedIn, Gmail y la mayoría de los clientes de correo y de chat ya mandan el referrer vacío o recortado, así que tampoco distinguiría a dos destinatarios del mismo portal.

**La señal tiene que viajar en el link.** Un código en la URL (`?via=`) que la SPA reenvía a la API es lo único que funciona con `no-referrer`, identifica al destinatario y no depende de terceros.

**Esto reabre un veto.** La idea fue vetada en la ronda 1.1 como `registro-de-envios` («registro de envíos con link por destinatario», vetada por los jueces de costo-riesgo y de coherencia, `docs/ROADMAP-1.1.md` § 2). **Qué cambió:**

- **El motivo nuevo:** el hallazgo de arriba. En 1.1 se daba por hecho que `byReferrer` iba a dar el origen; hoy sabemos que en producción no da nada, así que sin un código en el link la analítica no responde la pregunta básica de una búsqueda activa (¿quién lo abrió?).
- **La búsqueda de empleo es activa ahora** (P18: el sitio se despliega en 1.0.x para usarlo ya), y las visitas se pueden separar de las propias y de los bots (`classify-profile-views`), que en 1.1 tampoco existía: sin eso, un contador por link habría mezclado las aperturas del owner.
- **El MVP está recortado** respecto de `registro-de-envios`: sin registro de envíos ni CRM (eso es `add-application-tracking`, Fase 1.3), sin vencimiento (`add-profile-expiration`), sin avisos por email (`add-open-notifications`) y sin datos del destinatario más allá de la etiqueta que el owner escribe a mano.

## What Changes

- **Entidad `ShareLink`** en el módulo `curated-profile` (D1, D2): pertenece a un perfil, tiene un **código corto, aleatorio y no adivinable** (10 caracteres en base32 de Crockford en minúsculas, ~50 bits, único en toda la base), una etiqueta escrita por el owner, un portal opcional, un tipo (`MANUAL` o `LINKEDIN_POST`), la fecha de creación y la de revocación. El código y el portal no cambian; la etiqueta sí. La revocación es irreversible y no bloquea el acceso al perfil: solo deja de atribuir.
- **`?src=<portal>` sin filas nuevas** (D3): `src` se normaliza (minúsculas, `[a-z0-9-]`, hasta 32 caracteres) y se guarda en la columna nueva **`ProfileView.source`**. Es el «ShareLink implícito por portal» de la decisión P2 sin materializarlo: no crea filas desde la ruta pública ni aparece en la gestión. Si la visita trae un `via` válido con portal, el portal del enlace gana sobre `src`.
- **Viaje de `via` y `src` hasta la API** (D4, D5): la SPA los lee de la URL y los manda como query de `GET /api/curated-profiles/:slug`, igual que `profile-prefetch.js`; los dos entran en la clave de la petición temprana, que pasa a ser `[slug, locale, token, via, src]` en los dos lugares, y `early-profile.spec.ts` amplía su matriz. Los enlaces internos (el menú de la home) no los arrastran.
- **Registro** (D6, D7): `ProfileView.shareLinkId` (FK nullable, `SET NULL`) y `ProfileView.source`. La búsqueda del código ocurre en la tarea en segundo plano que ya registra la visita, así que la respuesta no espera ni una consulta más. Un `via` revocado, inexistente, malformado o de **otro perfil** no se atribuye. Se guarda en todas las filas, pero las aperturas y los desgloses cuentan solo `HUMAN`. La respuesta pública es idéntica con o sin `via`, y un `via` o `src` malformado nunca da 400.
- **PROTECTED** (D8): el `via` no reemplaza al token. Sin token válido, 401 y no se registra nada (como hoy). El link copiado de un perfil `PROTECTED` lleva `?token=` y `&via=`.
- **Agregado** (D9): `byShareLink: [{ shareLinkId, code, label, slug, portal, revoked, views }]` y `bySource: [{ source, views }]`, solo con visitas `HUMAN` atribuidas y ordenados por visitas descendente. El dashboard suma las tablas **Por enlace** y **Por portal**.
- **API del panel** (D10): listar, crear, cambiar la etiqueta y revocar los enlaces de un perfil, bajo `/api/admin/curated-profiles/:id/share-links`, con las aperturas humanas y la última apertura de cada uno.
- **Pestaña Publicación del constructor** (D11): bloque **Enlaces de seguimiento** (crear con etiqueta y portal, copiar el link, cambiar la etiqueta, revocar con confirmación y ver aperturas) y un ayudante para copiar un link genérico por portal (`?src=`), sin llamar a la API.
- **Botón «Compartir en LinkedIn»** (ítem 4.2, D12): abre `share-offsite` de LinkedIn con un `ShareLink` de tipo `LINKEDIN_POST` y portal `linkedin`, reusado mientras esté activo. Solo para perfiles `PUBLIC`, guardados y no archivados.
- **SEO** (D13): `canonical` y `og:url` siguen siendo la URL del perfil sin query, con o sin `?via=`; el fragmento de head ignora `via` y `src`; el sitemap no cambia y `robots.txt` **no** bloquea `?via=` (bloquearlo rompería la vista previa de LinkedIn y de Slack, que respetan `robots.txt`).
- **Contrato** (D14): query `via` y `src`, los schemas de enlaces y los dos desgloses nuevos en el OpenAPI; `backend/openapi.json` y `frontend/src/shared/types/api.d.ts` regenerados.
- **Docs:** `docs/MANUAL.md` e `index.html` (TC-41, el recorrido de Publicación y del dashboard, el glosario), `CLAUDE.md` (paso 6 del núcleo), `docs/CHANGELOG.md` y `backend/README.md`.

## Non-goals

- **Vencimiento** del enlace (`expiresAt`): es `add-profile-expiration` (ítem 3.6).
- **Registro de envíos o CRM** (empresa, puesto, estado, notas): es `add-application-tracking` (Fase 1.3), que reusará el `ShareLink`.
- **Avisos** en la primera apertura: es `add-open-notifications` (Fase 1.3).
- **Bloquear el acceso al revocar.** Para cortar el acceso ya están `PROTECTED`, `PRIVATE` y archivar; revocar solo deja de atribuir.
- **Datos del destinatario** más allá de la etiqueta escrita a mano (ni email ni nombre estructurado).
- **Cambiar `Referrer-Policy`** o reenviar `document.referrer`: no resuelve el problema (ver Why) y suma un dato nuevo.
- **Publicar en LinkedIn por API** (`/v2/ugcPosts`, ítem 4.6): el botón usa el enlace `share-offsite`, sin OAuth ni token.
- **Atribuir la navegación interna**: pasar de un perfil a otro dentro del sitio no arrastra `via` ni `src`.
- **Tocar los datos de ejemplo** (`docs/examples/cv-data.example.json`) o el seed: los enlaces se crean desde el panel.
- **Cambiar `byReferrer`** o su normalización: queda como está y documenta su límite.

## Capabilities

### New Capabilities

- `share-links`: enlaces de seguimiento por destinatario o portal (`?via=`) y atribución genérica por portal (`?src=`): la entidad y su código, la gestión desde la API del panel, las reglas de atribución (revocado, otro perfil, token), el reenvío desde la SPA y la petición temprana, y el enlace para LinkedIn.

### Modified Capabilities

- `profile-view-analytics`: ADDED *Desglose por enlace y por portal*; MODIFIED *Agregado por origen de la visita* (hoy prohíbe persistir datos de origen nuevos; parte del texto que deja `classify-profile-views`).
- `curated-profile-resolution`: MODIFIED *Registro de visita al resolver por la ruta pública* (el contexto de visita trae `via` y `src` y no altera el resultado).
- `public-curated-profile-api`: MODIFIED *Documentación OpenAPI* (query `via` y `src`).
- `web-performance`: MODIFIED *Petición temprana del perfil* (la clave y la URL incluyen `via` y `src`).
- `public-seo`: MODIFIED *Metadatos por perfil curado* (`canonical` y `og:url` sin query); ADDED *Los enlaces de seguimiento no se indexan aparte*.
- `admin-curated-profile-crud`: MODIFIED *Borrado* (también borra los enlaces) y *El duplicado nace retirado* (no hereda enlaces).
- `admin-analytics-dashboard`: ADDED *Tabla por enlace en el dashboard* y *Tabla por portal en el dashboard*.
- `curated-profile-builder`: ADDED *Enlaces de seguimiento en la pestaña Publicación* y *Compartir en LinkedIn desde la pestaña Publicación*.

## Impact

- **Base (`backend/prisma/`):** modelo `ShareLink` y enum `ShareLinkKind`; columnas `ProfileView.shareLinkId` (FK `ON DELETE SET NULL`, con índice) y `ProfileView.source` (con índice). Migración nueva, aditiva, sin `UPDATE`.
- **Backend (`backend/src/`):**
  - `modules/curated-profile/domain/`: entidad `ShareLink`, servicios puros `share-code.ts` (alfabeto, formato y codificación), `normalize-source.ts` y `resolve-share-attribution.ts`; puerto `ShareLinkRepository`; errores.
  - `modules/curated-profile/application/`: puerto `ShareCodeGenerator`; casos de uso `ListShareLinksUseCase`, `CreateShareLinkUseCase`, `RenameShareLinkUseCase`, `RevokeShareLinkUseCase` y `GetOrCreateLinkedInShareLinkUseCase`; `ResolveCuratedProfileUseCase` resuelve la atribución dentro de la tarea en segundo plano.
  - `modules/curated-profile/infrastructure/`: `PrismaShareLinkRepository`, `CryptoShareCodeGenerator`, `AdminShareLinkController`, `via` y `src` en `CuratedProfileQueryDto` y en el `ViewContext` del controller público; borrado y duplicado ajustados.
  - `modules/analytics/`: `shareLinkId` y `source` en `NewProfileView`; `countByShareLink`, `countBySource` y `countOpensByShareLink` en el repositorio; `byShareLink` y `bySource` en el caso de uso y el controller.
- **Frontend (`frontend/`):** `public/profile-prefetch.js`, `features/curated-view/early-profile.ts` y su spec, `hooks/use-curated-profile.ts`, `shared/lib/url-state.ts` y `profile-link.ts`; la pestaña Publicación de `ProfileBuilderPage.tsx` (componentes nuevos de enlaces y del botón de LinkedIn); `DashboardPage.tsx`; `api.d.ts` regenerado.
- **Tests:** unitarios de dominio y casos de uso; e2e de API (atribución, revocado, otro perfil, PROTECTED, malformado, agregado, CRUD); Vitest de la matriz de la petición temprana, de los enlaces internos, del bloque de Publicación y del dashboard; carga real por el SPA contra una base descartable.
- **Sin cambios** en Caddy, la CSP, `Referrer-Policy`, el sitemap, `robots.txt`, el seed ni `views:reclassify`.
- **Coordinación:** la fila `upgrade-profile-structured-data` de la propuesta (§ 6.2) también menciona share-offsite; con este change ese botón ya existe y aquel change queda solo con `ProfilePage`. `classify-profile-views` se archiva antes que este (los `MODIFIED` de `profile-view-analytics` parten de su texto).
- **Operación:** la migración corre sola en el `preDeployCommand`. No hay backfill: las visitas previas quedan sin enlace ni portal.
