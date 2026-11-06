# CHANGELOG — Datos del Portafolio

## Update — Octubre 2026 (`add-builder-skill-project-overrides`)

El constructor incluye y excluye skills y proyectos, no solo experiencias. Solo frontend: sin cambios de dominio, de API, del OpenAPI ni de la base.

- **Selección.** La pestaña suma los bloques **Skills** (una fila por skill, agrupadas por categoría, con el buscador **Buscar skill** por nombre y el conteo «N incluidas · M excluidas» por categoría) y **Proyectos**. Las filas de experiencias, skills y proyectos son un solo componente.
- **Mismo arreglo.** Skills y proyectos se guardan en los mismos `includeIds`/`excludeIds` que las experiencias, como ids cuid crudos; nunca ids de categoría (el núcleo los ignora).
- **Exclusión mutua.** **Incluir** y **Excluir** de un ítem se apagan entre sí (también en las experiencias); un id en los dos arreglos, solo posible por API o seed, se muestra excluido y dice que la exclusión gana. El resultado del perfil no cambia: la exclusión ya ganaba.
- **Ocultos y huérfanos.** Experiencias y proyectos con `visible: false` van al final con la insignia **Oculta**/**Oculto** y **Incluir** deshabilitado (salvo para quitar una inclusión existente). Los ids que no corresponden a ningún ítem se conservan al guardar; con las tres listas cargadas, la pestaña los cuenta y ofrece **Quitar**.
- **Tags.** El universo de tags de la pestaña suma los de los proyectos.
- **Núcleo.** Tests de regresión (sin tocar su código): include/exclude de skills, ids de categoría sin efecto, proyectos forzados y ocultos, e2e del preview igual a la ruta pública con overrides de skills y proyectos, y los datos de `ejemplo-overrides`.
- **Docs.** `docs/MANUAL.md` e `index.html` (TC-43, B10 sin la «Limitación vigente», TC-13, C3, R1, glosario; `tc43-overrides.jpg` nueva y `tc13-seleccion.jpg` regenerada), `docs/DATA-POPULATION.md` § 12 y `docs/PROPUESTA-FEATURES.md` § 6.2.

## Update — Octubre 2026 (`add-certification-verification`)

Cada certificación puede llevar el enlace a su credencial, su ID y su vencimiento.

- **Campos.** `Certification.verificationUrl` (URL absoluta solo `https`, hasta 2048), `credentialId` (hasta 100) y `expiresAt` (`AAAA-MM` o `AAAA`), los tres opcionales y sin traducir. Migración `add_certification_credential` solo aditiva (tres `ADD COLUMN`, sin backfill).
- **Validación en tres capas.** Dominio (`isHttpsUrl`, `validateCertification`), DTO (`@IsUrl` https, `@MaxLength`, `@Matches`) y panel (Zod). `http://`, `javascript:` y las relativas dan 400; un vencimiento anterior al año también.
- **API.** `GET /api/certifications`, la vista curada y el preview devuelven los tres campos (nulos si no hay); el backend no calcula si venció.
- **Sitio y PDF.** «Ver credencial» (`target=_blank`, `rel=noopener noreferrer`), ID, «Válida hasta» y «Vencida» (derivada en el cliente con la fecha del navegador); en la hoja imprimible, «Ver credencial» clicable sin imprimir la URL y «vencida» en el paréntesis. `print:check` sigue dando una página.
- **Panel.** El diálogo de certificación suma Enlace de verificación, ID de credencial y Vence.
- **Seed.** El formato acepta los tres campos con las reglas del dominio y los valida antes de escribir; `seed:verify` los compara. `docs/cv-data.json` no cambia (los enlaces reales los carga el owner); el ejemplo suma una credencial vigente con enlace e ID y otra vencida.
- **Docs.** `docs/MANUAL.md` e `index.html` (TC-42, B6, R6, glosario; `tc42-credencial.jpg` nueva y `bo-formacion-certificacion.jpg` regenerada), `docs/DATA-POPULATION.md` § 12.6.

## Update — Octubre 2026 (`add-share-links`)

Cada visita humana se puede atribuir al destinatario o al portal que recibió el link, sin depender del referrer (que en producción nunca llega).

- **Enlaces de seguimiento.** Tabla `ShareLink`: código aleatorio de 10 caracteres (base32 de Crockford en minúsculas, único), etiqueta de 1 a 80 caracteres, portal opcional y tipo `MANUAL` o `LINKEDIN_POST`. El código, el portal y el perfil no cambian; la etiqueta sí. Revocar es irreversible, idempotente y solo deja de atribuir: el link sigue abriendo. Se borran con su perfil y el duplicado no los copia.
- **Atribución.** `GET /api/curated-profiles/:slug` acepta `?via=` y `?src=` (nunca da 400; el primer valor si se repiten). `ProfileView.shareLinkId` (`SET NULL`) y `ProfileView.source`, resueltos en la tarea en segundo plano: un código revocado, inexistente, mal formado o de otro perfil no atribuye; el portal del enlace gana sobre `src`; la respuesta es idéntica con o sin `via` y un perfil `PROTECTED` sigue exigiendo el token. Migración `add_share_links` (sin `UPDATE` ni `DROP`).
- **API del panel.** `GET/POST /api/admin/curated-profiles/:id/share-links`, `PATCH .../:linkId`, `POST .../:linkId/revoke` y `POST .../linkedin` (reusa el enlace `LINKEDIN_POST` activo; 409 si el perfil no es `PUBLIC` o está archivado). Cada enlace trae `opens` y `lastOpenedAt` (solo `HUMAN`). El agregado de visitas suma `byShareLink` y `bySource`.
- **Cliente.** La SPA y `public/profile-prefetch.js` mandan `via` y `src` a la API con la misma clave `[slug, locale, token, via, src]`: una carga con `?via=` sigue siendo una petición y una visita. El menú de la home no arrastra `via` ni `src`. `canonical` y `og:url` siguen sin query y `robots.txt` no bloquea `?via=`.
- **Panel.** Pestaña Publicación: enlaces de seguimiento (crear, renombrar, copiar, revocar con confirmación), link genérico por portal (`?src=`) y «Compartir en LinkedIn». Dashboard: tablas **Por enlace** y **Por portal**, y la aclaración de que **Por origen** casi siempre da `directo`. Todo el código vive en el chunk del admin: el arranque público sigue bajo 155 KB.
- **Docs.** `docs/MANUAL.md` e `index.html` (TC-41, B2, B12, R9, C8, glosario; `tc41-enlaces.jpg` y `tc18-dashboard.jpg` regeneradas con `manual:capture`, que crea el enlace de ejemplo por la API del panel), `CLAUDE.md`, `backend/README.md` y `docs/PROPUESTA-FEATURES.md`.

## Update — Octubre 2026 (`classify-profile-views`)

`views` y el dashboard cuentan solo las visitas de personas; cada visita se guarda con su tipo.

- **Tipo de visita.** `ProfileView.kind` (`HUMAN`, `OWNER`, `BOT`), obligatorio y con `HUMAN` por defecto: la migración no cambia ningún número. `OWNER` si la petición trae una sesión de administrador válida (cookie `portfolio_session` o `Authorization: Bearer`; se valida en la tarea en segundo plano, así que la ruta pública sigue anónima, sin latencia extra y sin 401 por una cookie vieja); `BOT` si falta el `User-Agent` o coincide con la lista versionada (`classifyUserAgent`, v1); `HUMAN` el resto.
- **Qué suma.** `views` de cada perfil y el total, `byProfile`, `byLocale`, `byDay` y `byReferrer` del agregado cuentan solo `HUMAN`. El agregado suma `byKind` (`HUMAN`, `OWNER`, `BOT`, siempre los tres) y el dashboard, la tabla **Por tipo**.
- **Reclasificación.** `npm run views:reclassify` recalcula `kind` con la misma función y `views` como la cantidad de visitas `HUMAN`: simulación por defecto, `-- --apply` escribe en una transacción, idempotente, sin tocar las `OWNER`. En la base local del owner la corre él; las visitas propias anteriores al change no se pueden recuperar.
- **Scripts de calidad.** Sus visitas quedan como `BOT`: Puppeteer ya manda `HeadlessChrome`; `a11y:check` (sus GET con `fetch`) y `perf:check` (UA emulado de Lighthouse) llevan el token `PortfolioCheck`.
- **Docs.** `docs/MANUAL.md` e `index.html` (TC-39, B2, R9, C8, glosario y `tc18-dashboard.jpg` regenerada), `docs/DEPLOY.md` § 7, `docs/DEPLOY-RAILWAY.md`, `docs/DATA-POPULATION.md` y `backend/README.md`.

## Update — Octubre 2026 (`fix-admin-contrast`)

El contraste del panel y de los estados pasa la auditoría con cualquier juego de datos. Sin cambios de dominio, de API, del OpenAPI ni de la base.

- **Ítems ocultos del panel** (experiencias, formación, certificaciones, proyectos, enlaces): dejan de bajar la opacidad de la fila (daba 2,44:1 y 3,13:1). Se distinguen por la insignia «Oculta»/«Oculto» (`HiddenBadge`, compartida), un borde punteado y el fondo suave (`surface-hidden`). El texto conserva sus colores.
- **Insignia «Actual»** de la línea de tiempo y del panel: usa el nuevo derivado `--t-success-ink` (`text-success-ink`), calculado como el acento legible a partir del verde `#00bc7d` y de las superficies del tema. En `modern-dark` y `elegant` no cambia; en `modern-light`, `minimal` y `corporate` pasa a `#00754e`, `#007a51` y `#00754e` (≥ 4,67:1; antes 2,06–2,15:1). No se guarda.
- **Barras por día del dashboard:** la lista va dentro de una región con nombre «Visitas por día» y enfocable, que se desplaza con las flechas (antes `scrollable-region-focusable` en móvil). La sección que la contiene ya no es un landmark con el mismo nombre.
- **`a11y:check`:** verifica el perfil base antes de abrir páginas y sale con 2 si no resuelve; la variable `A11Y_CHECK_PROFILE` queda documentada.
- **CI:** el job `web-quality` suma la pierna `a11y-example` (siembra `seed:example` y audita `ejemplo-backend`), en paralelo con `a11y` y `lighthouse`: unos 9 minutos de runner más por corrida, sin alargar el tiempo de pared.
- **Medido:** `a11y:check` con panel sobre el ejemplo pasó de 39 `color-contrast` + 1 `scrollable-region-focusable` a 0, y sobre `cv-data.json` sigue en 0. Tests nuevos de las filas, la insignia, la región, `--t-success-ink` y un test estático contra colores con nombre y opacidad por estado.
- **Docs:** `docs/MANUAL.md` y `docs/manual/index.html` (TC-40; ajustes de TC-33 y TC-34) y la línea de `a11y:check` de `CLAUDE.md`.

## Update — Octubre 2026 (`fix(deploy)`)

Correcciones de despliegue que salieron de la revisión integral previa al deploy en Railway.

- **`backend/railway.json`.** `buildCommand` corre `prisma generate` antes de `nest build`; `startCommand` pasa a `node dist/main`; `watchPatterns` con ruta absoluta del repo (`/backend/**`); `drainingSeconds: 10` y `preDeployTimeoutSeconds: 300` versionados (claves confirmadas en el schema de Railway).
- **`frontend/railway.json`.** `watchPatterns` `/frontend/**` y `healthcheckPath: /`.
- **Config file path.** Los dos servicios deben apuntar a `/backend/railway.json` y `/frontend/railway.json` (absolutas desde la raíz): `railway.json` relativo al Root Directory no lo encuentra.
- **`frontend/Caddyfile`.** `header_up X-Forwarded-For {http.request.header.X-Real-IP}` en los dos proxies: sin esto la API veía la IP del borde para todos (límite de peticiones y de login compartidos, un solo `ipHash`).
- **Imágenes base.** `frontend/Dockerfile` fija `node:22.23.3-alpine` y `caddy:2.11.4-alpine`; `backend/package.json` declara `engines.node` `22.x`.
- **Docs.** `docs/DEPLOY-RAILWAY.md` reescrita como guía de 10 pasos (poblado y administrador desde la máquina del owner contra `DATABASE_PUBLIC_URL`, sin `railway run`; rotación de la contraseña con `admin:bootstrap`; dominio sin `www`; prueba de IP real; backup fuera de Railway y restauración). `docs/DEPLOY.md` y `docs/RELEASE-1.0.0-CHECKLIST.md` alineados. El comando de recarga de la entrada anterior (`railway run -- sh -c ...`) quedó reemplazado por el del paso 4 de la guía.

## Update — Octubre 2026 (`protect-default-seed`)

`npm run seed` ya no puede pisar una base con contenido por accidente.

- **Comportamiento.** Sin `--file`, el seed cuenta las filas de las 13 tablas que limpia (no `AdminUser`). Con todas en cero, carga sin flags: primer arranque local, primer deploy y `prisma migrate reset`. Con alguna fila, sale con **código 2** y no escribe: muestra el destino sin credenciales, los conteos por tabla, un `pg_dump` sin contraseña (`<base>-AAAA-MM-DD.dump`) y cómo forzar.
- **`--overwrite`.** `npm run seed -- --overwrite` borra y recarga aunque haya contenido, con un aviso previo de lo que se pierde. Sin confirmación interactiva ni `pg_dump` automático: el respaldo se recomienda, no se exige.
- **Producción.** Con `NODE_ENV=production` y contenido hacen falta las dos llaves: `--overwrite` y `SEED_ALLOW_PRODUCTION=1`, esta última solo para el comando y nunca como variable del servicio `api`. El `preDeployCommand` sigue siendo solo `prisma:deploy`: un deploy no siembra.
- **Códigos de salida.** 0 ok · 1 fuente inválida, error de uso (`--overwrite` con `--file`, o en `seed:verify`) o falla al contar (base sin migrar o sin conexión: no se borra nada) · 2 negativa.
- **Operación.** Un `npm run seed` de rutina sobre una base con datos ahora sale con 2: usar `--overwrite` (con `pg_dump` previo) si la recarga es a propósito.
- **Docs.** `docs/DEPLOY.md`, `docs/DEPLOY-RAILWAY.md` (comando de recarga en producción: `railway run -- sh -c 'SEED_ALLOW_PRODUCTION=1 npm run seed -- --overwrite'`), `docs/DATA-POPULATION.md`, `docs/MANUAL.md` (TC-38) y `backend/README.md`.

## Update — Octubre 2026 (`add-learning-guide-and-example-data`)

Una guía para aprender a poblar y usar la plataforma, sobre una base de datos de ejemplo. Sin cambios de esquema ni de contrato HTTP.

- **Datos de ejemplo ficticios** (`docs/examples/cv-data.example.json`): una persona inventada con las 9 secciones, todas las entidades y todos los mecanismos del perfil curado (filtro por tags, incluir y excluir, secciones reordenadas y ocultas, tema y layout propios, las tres visibilidades, no enumerado, archivado, alias de slug) y 105 visitas sintéticas. Es la base de referencia del manual.
- **Seed con formato extendido** (`backend/scripts/lib/`): `npm run seed -- --file <ruta>`, `seed:example` y `seed:example:verify`. Campos opcionales por plantilla (`theme`, `layout`, `visibility`, `accessToken`, `sectionsOrder`, `sectionsHidden`, `includeRefs`/`excludeRefs`, `archived`, `slugAliases`) y `exampleViews`; sin ellos el seed hace exactamente lo de siempre (instantánea de 79 llamadas). La fuente se valida completa **antes** de borrar (código 1).
- **Negativa en tres capas** con `--file`: `SEED_DISPOSABLE_DB=1`, `NODE_ENV` distinto de `production` y base vacía o con el mismo perfil. Si falla alguna, código 2 sin escribir y con el destino sin contraseña. El `npm run seed` por defecto lo protege `protect-default-seed`.
- **Guía** (`docs/DATA-POPULATION.md` § 11 y 12): cómo crear, sembrar y borrar la base de ejemplo y una referencia campo por campo.
- **Manual** (`docs/MANUAL.md`, `docs/manual/index.html`): ruta de aprendizaje de ocho conceptos, nueve recorridos por objetivo, manual del backoffice por pantalla con los mensajes literales del código, TC-36 y TC-37, glosario, filtros por área y por change y registro de una corrida con *Copiar resultado*. 44 capturas regeneradas con `npm run manual:capture`.
- **`npm run manual:check`** (corre en el CI): casos, conceptos, recorridos y pantallas alineados entre los dos formatos, imágenes sin huérfanas, mensajes literales en `frontend/src` y topes de tamaño (150 KB por imagen, 4 MB en total, 300 KB el HTML).
- **CI:** el job de e2e carga el ejemplo dos veces en una segunda base y comprueba la negativa contra la base con el CV.

## Update — Octubre 2026 (ronda 1.1.x — `improve-mobile-performance`)

La vista pública abre más rápido en un móvil de gama media: el objetivo es Performance ≥ 85 en el runner de GitHub (antes 71–76, con TBT de 300–400 ms y LCP de ≈ 3,8 s). Sin backend, sin contrato HTTP, sin migración y sin tocar la CSP.

- **Cambios visibles.**
  - **El hero aparece primero.** Con el perfil recién llegado se pinta solo el hero y, en una transición interrumpible, el resto de las secciones; mientras tanto se reserva el alto de la pantalla para que el pie no se mueva. Cambiar de idioma, de tema o de perfil dentro de la misma ruta no vuelve a ese estado.
  - **Inter sale del propio sitio** (`/fonts/inter-latin-v20.woff2`, licencia OFL junto al archivo), con `preload`: la cadena de la carga ya no pasa por `fonts.googleapis.com` ni `fonts.gstatic.com`. Las demás familias de los temas se siguen pidiendo a Google Fonts.
  - **Los menús de la barra** (tema y perfiles) cargan en diferido: la barra muestra desde el primer render disparadores idénticos (mismo nombre accesible, `aria-haspopup`, aspecto) y el menú real llega en un momento ocioso tras `load`, o antes si el visitante apunta o enfoca el botón. Un `Enter` o un clic antes de que llegue abre el menú apenas carga, con el foco adentro.
  - **La animación de entrada** de las secciones es imperativa (API *vanilla* de Motion) sobre la misma `<section>`: ya no se remonta el contenido al llegar la librería (25,9 → 3,3 KB gzip). Las secciones fuera de pantalla usan `content-visibility: auto`.
  - **Arreglo:** el layout `sidebar` declara una sola columna en móvil (antes la columna implícita se ensanchaba al revelarse el resto; CLS 0,416 → 0,001).
- **Arranque.** Un solo archivo JS (`codeSplitting.groups` de Rolldown en lugar de `manualChunks`): de 179 KB en tres archivos a 148 KB en uno. La petición del perfil sale desde `public/profile-prefetch.js` (script clásico, sin inline) mientras baja el bundle y la app la toma una sola vez: **una petición y una visita por carga**.
- **Medición** (Linux, Chrome 155, Lighthouse 13.5.0, mobile, mediana de 5 contra una base descartable): proxy rápido 88 / 88 / 90 → 97 / 98 / 97 con TBT ≈ 0 y CLS 0,001; proxy lento (más pesimista que el runner) 54 / 55 / 59 → 74 / 75 / 81. Detalle en `openspec/changes/archive/2026-10-16-improve-mobile-performance/verification.md`.
- **Presupuesto y CI.** `perf:budget` mide todos los scripts del arranque (módulo, `modulepreload` y clásicos): ≤ 155 KB gzip, un solo JS de módulo, sin `modulepreload`, sin `zod` clásico, Motion para React ni el *popper* de Radix. El umbral de Performance del CI sube de 70 a **85** (mediana de 5).
- **Docs.** `docs/MANUAL.md` § 5.1 (umbrales) y el caso TC-35; `docs/DEPLOY.md` § 9.5 (`/fonts/*` inmutable, `profile-prefetch.js` con `no-cache` a propósito).
- **CI y archivado:** la corrida del PR #31 dio medianas de Performance de 97 / 97 / 97 y el change se archivó el 16 de octubre de 2026, después de `improve-a11y-and-performance` (que crea la capability `web-performance`).

## Update — Octubre 2026 (ronda 1.1.x — `improve-a11y-and-performance`)

Accesibilidad WCAG AA y arranque público más liviano, medidos con comandos que ahora viven en el repositorio y corren en el CI. Sin backend, sin contrato HTTP, sin migración y sin tocar la CSP: los acentos y los temas guardados no cambian.

- **Cambios visibles.**
  - **El acento como texto se ajusta:** cuando un acento no llega a 4,5:1 contra el fondo (13 de los 14 perfiles sobre `modern-dark`, y `modern-light`), el titular del hero, el *eyebrow* de las secciones, el badge de disponibilidad y las etiquetas del menú usan un derivado del mismo tono, más claro en temas oscuros y más oscuro en claros (`--t-accent-ink`). Los rellenos, bordes e íconos siguen con el acento elegido. El segundo acento, cuando se usa como texto (títulos de las categorías de skills), recibe el mismo tratamiento (`--t-accent2-ink`).
  - **El texto atenuado** (fechas, etiquetas, contadores) gana contraste: era 3,5–4,0:1 y ahora cumple 4,5:1 (`--t-text-dim`).
  - **El botón primario de `modern-light`** pasa a texto oscuro (4,70:1 en vez de 4,10:1 con blanco): el texto sobre el acento se elige por contraste WCAG y no por brillo.
  - **El foco se ve:** un contorno sólido de 2 px, separado del borde (`--t-ring`), en la vista pública y en el panel. Antes era el acento al 50 %, casi invisible con los acentos oscuros.
  - **El hero ya no hace fundido de entrada:** se pinta de una vez. Las demás secciones siguen animando al aparecer en pantalla.
- **Navegación.** Enlace *Saltar al contenido* (*Skip to content*) como primer foco del sitio y del panel; `/admin/login` pasa a tener un `<main>`; el scroll suave respeta `prefers-reduced-motion`. Al cerrar con Escape un diálogo del panel, el foco vuelve al botón que lo abrió (antes se perdía en `<body>`).
- **Estructura.** El `dl` de contacto y las pestañas ES/EN del panel (campos bilingües y conmutador de idioma de las vistas previas) tienen estructura ARIA válida.
- **Arranque.** El JS que baja una ruta pública pasó de 228 a 179 KB gzip: los tokens se validan con `zod/mini` y `motion` carga en diferido. La hoja de Inter se pide desde el HTML, una sola vez.
- **Medición (mobile, mediana de 3, sitio de producción en local).** Lighthouse: Accessibility 88 → 100, Best Practices 96 → 100, SEO 100, Performance 89–94 → 94–95. axe: de 1376 nodos de `color-contrast`, 330 de `dl` y 22 críticos del panel a 0 violaciones.
- **Nuevos comandos del frontend:** `npm run perf:budget` (tope de 180 KB gzip, sin navegador; luego 155 KB, ver arriba), `npm run a11y:check` (axe + recorrido de teclado) y `npm run perf:check` (Lighthouse con versión fija y mediana). Los dos últimos abren páginas reales y se niegan a correr sin `A11Y_CHECK_DISPOSABLE_DB=1`, porque cada carga registra una visita.
- **CI.** `perf:budget` en el job `frontend` y un job nuevo, `web-quality` (*Frontend · accesibilidad y Lighthouse*, dos ejecuciones en paralelo), que levanta un Postgres descartable, la API en producción y la imagen de producción del frontend. Bloquea con los umbrales de `docs/MANUAL.md` § 5.1 (en CI, Performance ≥ 70 con mediana de 5: es lo que mide hoy el equipo de referencia de Lighthouse; subirlo es un change aparte; luego 85, ver arriba). Suma unos 6–7 minutos de pared por PR.
- Cierra los ítems *Accesibilidad* y *Caché / performance* del checklist 1.0.x. Sin cache de lectura en el backend (la API responde en ≈ 20 ms) y sin lazy-loading de imágenes (la vista pública no tiene `<img>`).

## Update — Octubre 2026 (ronda 1.1.x — `localize-language-level`)

Mergeado en PR #28 y archivado en `openspec/changes/archive/2026-10-10-localize-language-level/`, con sus specs sincronizadas. La migración ya se aplicó a la base de desarrollo del owner, con respaldo previo.

En inglés, el nivel de cada idioma salía como lo guardaba la base (*"Spanish · Nativo"*, defecto registrado en `add-printable-one-page`). Ahora es un texto bilingüe como el resto del perfil base.

- **Cambio visible:** con `?lang=en`, el contacto, la hoja imprimible y el perfil curado muestran *"Spanish · Native"*; con `?lang=es`, *"Español · Nativo"*.
- **Migración de datos** (`localize_language_level`, escrita a mano, no destructiva): `Language.level` pasa de `TEXT` a `JSONB` en la misma fila. Un nivel conocido en español queda `{ es, en }`, un código MCER (`B1-B2`, `C1`) `{ es: x, en: x }` y cualquier otro texto `{ es: x }`, sin inventar el inglés. Se aplica con `prisma migrate deploy` (en Railway, desde el `preDeployCommand`); ensayada, junto con su rollback, en una copia descartable de la base de desarrollo.
- **Contrato público sin cambio de forma:** `languages[].level` sigue siendo `string`, ahora en el idioma pedido.
- **Contrato admin (BREAKING, sin clientes afectados):** `POST`/`PATCH /api/admin/languages` reciben `level` como `{ es, en? }`; un string responde 400. La salida cruda devuelve `{ es, en }` (o el string de un dato legado). Se regeneran `openapi.json` y `api.d.ts`.
- **Panel:** el nivel se edita con pestañas ES/EN en la Portada (español obligatorio). El informe de faltantes del constructor suma los idiomas del perfil (entidad `language`: nombre mostrado, nivel y detalle) y el aviso los nombra.
- **Seed:** `docs/cv-data.json` guarda el nivel como `{ es, en }` y `seed:verify` lo compara por idioma.

## Update — Octubre 2026 (ronda 1.1.x — `add-printable-one-page`)

Un perfil curado se puede imprimir o guardar como PDF en **una hoja legible**, en A4 y en Letter. Sin backend, sin contrato HTTP, sin migración y sin tocar la CSP.

- **Hoja dedicada en el mismo documento.** La vista pública monta `PrintableSheet` junto al layout de pantalla; solo se ve al imprimir (con Ctrl+P o con el botón). La barra, el pie y la decoración no se imprimen. No hay ruta nueva ni pedidos a la API.
- **Qué entra.** `buildPrintSheet` (puro y probado) respeta el orden y el ocultado de `sections`, suma el contacto y los enlaces destacados al encabezado, deja afuera `stats` y aplica límites (`PRINT_LIMITS`): 3 experiencias en detalle con 2 logros, 3 en una línea, 3 categorías de skills, 2 proyectos, 3 formaciones y 4 certificaciones. Lo que no entra se cuenta (*"y 7 experiencias más"*) y el pie trae la URL de la versión completa, sin `token`, `theme` ni `layout`.
- **Tinta sobre papel.** Paleta fija de papel (`themes/presets/paper.ts`, fuera de los presets conmutables) con cualquier tema; contraste mínimo medido de 9,7:1. Las animaciones no ocultan nada: la hoja no usa `motion` y una regla de `@media print` fuerza la opacidad de `[data-motion="on"]`.
- **Botón *Imprimir / Guardar PDF*** en la barra superior, solo con el perfil resuelto. Imprimir no pide nada ni suma una visita.
- **`npm run print:check`** (`puppeteer-core`, devDependency, con el Chrome del sistema) genera el PDF de cada perfil en `es`/`en` × A4/Letter × dos temas, cuenta las páginas y mide el contraste.
- **Ajuste de límites.** Los valores iniciales de la spec (6 en una línea, 6 categorías, 3 logros) daban dos páginas en los 14 perfiles del seed: se bajaron con `print:check` y se actualizaron la spec y el diseño.
- Cierra el ítem *Export PDF de perfil* del checklist 1.0.x: el PDF lo genera el navegador.

## Update — Octubre 2026 (ronda 1.1.x — `retire-accent-color`)

Segunda etapa de la decisión D9 de `polish-builder-and-edge`: `accentColor` deja de existir en todas las capas. El owner eligió **P1 = B**, así que los colores no se pierden: pasan al tema.

- **Primera migración destructiva del proyecto** (`retire_accent_color`, escrita a mano): copia el `accentColor` de cada perfil a `themeOverrides.colors.accent` (un `colors.accent` que ya existía no se pisa) y después borra la columna. Es idempotente y se aplica con `prisma migrate deploy` (en Railway, desde el `preDeployCommand`); sobre una base vacía no toca filas. La base de desarrollo del owner se migró primero, con respaldo previo, ensayo y rollback probado en una copia (evidencia en `openspec/changes/archive/2026-10-09-retire-accent-color/verification.md`).
- **Cambio visible:** los 13 perfiles de las plantillas dejan de verse con el `#38bdf8` del preset y pasan a su acento propio. Varios contrastan poco con el fondo `#0a0e1a` de `modern-dark` (8 de 13 quedan por debajo de 3:1): riesgo aceptado por el owner, se corrige desde el customizador.
- **Contrato (BREAKING, sin clientes afectados):** `accentColor` sale de los DTO de entrada y de las cuatro respuestas del perfil curado; un cuerpo que lo traiga responde 400. Se regeneran `openapi.json` y `api.d.ts`.
- **Dominio y frontend:** sale la regla hex y `HEX_COLOR_REGEX`; desaparecen los tipos `*Wire` y sus casts.
- **Seed:** `docs/cv-data.json` guarda el color de cada plantilla como `themeOverrides.colors.accent`, y `seed:verify` lo comprueba.
- Verificado: 529 unitarios, 168 e2e y 243 del frontend.

## Update — Octubre 2026 (ronda 1.1.x — fix del preview con slug vacío)

Mergeado en PR #22 (`fix/preview-empty-slug`), sobre `polish-builder-and-edge`. Al armar un perfil nuevo en el constructor, el preview fallaba mientras el slug estaba vacío o todavía no era kebab-case válido.

- **Frontend:** el borrador omite el `slug` del cuerpo del preview cuando no es válido (el backend usa uno provisorio) y la clave de caché del preview deja de depender del slug. Con dos tests de regresión (`profile-draft.spec.ts` y `ProfileBuilderPage.test.tsx`).
- Sin backend, sin contrato HTTP ni migración.

## Update — Octubre 2026 (ronda 1.1, pulido — `polish-builder-and-edge`)

Mergeado en PR #21 (`feat/polish-1-1`) y archivado en `openspec/changes/archive/2026-10-09-polish-builder-and-edge/` (PR #23), con sus specs sincronizadas. Cuatro defectos menores del constructor, del panel y del borde, más el aviso en los formularios en diálogo que sumó el owner.

- **Aviso de cambios sin guardar.** El constructor y la Portada avisan antes de perder un borrador: `beforeunload` al cerrar o recargar, y un diálogo del panel (*Seguir editando* / *Descartar*) al navegar dentro de la SPA. Cambiar solo el `?lang=` de la Portada no cuenta como salir. El router pasa a ser un *data router* (`createBrowserRouter`) para poder usar `useBlocker`. Los formularios en diálogo (experiencia, categoría, skill, formación, certificación, proyecto, enlace social e idioma) piden confirmar si se cierran con cambios. Casos TC-28 a TC-30 del manual.
- **La visita sale del camino crítico.** `ResolveCuratedProfileUseCase` entrega el registro a un puerto `BackgroundTasks` y responde sin esperarlo; la transacción atómica no cambia y los fallos van al log. `PrismaService.onModuleDestroy` drena las tareas en vuelo (con tope de 5 s) antes de desconectar la base; en Railway, `RAILWAY_DEPLOYMENT_DRAINING_SECONDS` debe quedar por encima.
- **CSP del sitio.** Caddy aplica una Content-Security-Policy en modo *enforce* a las respuestas de la SPA; el nombre de la cabecera se cambia con `CSP_HEADER` (por ejemplo a `Content-Security-Policy-Report-Only`) sin reconstruir la imagen. Capability nueva `site-security-policy`.
- **`accentColor`, primera etapa de su retiro.** El constructor deja de enviarlo y el OpenAPI lo marca `deprecated`; la etapa 2 es `retire-accent-color`.
- **Defecto previo corregido:** el perfil público devolvía los idiomas en el orden físico de Postgres; ahora van ordenados por `id`, como el listado del panel.
- Sin migración. Verificado: 532 unitarios, 164 e2e y 241 del frontend; los pasos con la app real, contra el contenedor `web` con la CSP en bloqueo.

## Update — Octubre 2026 (ronda 1.1, change 5 — `add-bilingual-builder-parity`)

Mergeado en PR #18 (`feat/bilingual-builder-parity`) y archivado en `openspec/changes/archive/2026-10-08-add-bilingual-builder-parity/` (PR #19), con sus specs sincronizadas. Cierra la ronda 1.1. Ahora el perfil se puede revisar y completar en inglés antes de mandarlo.

- **Preview en ES/EN.** El panel de vista previa del constructor tiene un conmutador de idioma que pide el preview con `?locale=en`. Es estado de vista (no se guarda) y la caché de TanStack Query se indexa por perfil **e** idioma, así que volver al idioma anterior no repite la petición.
- **Logros en inglés editables.** `highlights.en` se edita en el formulario de experiencias junto al español, con los mismos chips. Editar solo el español conserva el inglés (test de regresión).
- **Aviso de faltantes de traducción.** Un servicio puro del backend recorre las entidades bilingües del perfil resuelto y el preview devuelve `missingTranslations`: los campos que caerían al español. La pestaña Publicación lo muestra con el conteo y la lista agrupada por entidad. Es informativo: no impide guardar ni publicar. La ruta pública no trae el informe.
- Sin migración. Verificado: 517 unitarios, 160 e2e y 187 del frontend.

## Update — Octubre 2026 (ronda 1.1, change 4 — `add-profile-content-admin`)

Mergeado en PR #9 y archivado en `openspec/changes/archive/2026-10-08-add-profile-content-admin/`, con sus specs sincronizadas. Ahora el portafolio se administra desde el panel donde más se ve: hasta este change, el hero, la formación, los proyectos y los enlaces solo se cambiaban por seed o SQL.

- **Perfil base**: `GET` y `PUT /api/admin/profile` (titular, resumen, contacto y disponibilidad, bilingües), con la página `/admin/portada`, que previsualiza el hero antes de guardar.
- **CRUD** de idiomas, enlaces sociales, educación, certificaciones y proyectos, con la plantilla de capas de `admin-experience-crud`. Páginas `/admin/formacion` y `/admin/proyectos`.
- **Analítica por origen**: el agregado suma `byReferrer`, con el origen normalizado a su dominio y lo vacío agrupado como "directo". Lee lo que ya estaba guardado, sin capturar nada nuevo. El dashboard lo muestra en una tabla.
- Un perfil curado puede dejar el titular vacío y heredar el del perfil base.
- Sin migración: todos los campos ya existían. Verificado: 420 unitarios, 140 e2e y 153 del frontend.

## Update — Octubre 2026 (ronda 1.1, changes 2 y 3 — `add-server-rendered-head` y `add-curated-profile-lifecycle`)

Mergeados en PR #7 y #8, más la corrección de #11 sobre el head. Archivados en `openspec/changes/archive/2026-10-08-*`, con sus specs sincronizadas.

### Change 2 — el link compartido dice quién es Manuel
- `GET /api/public/profile-head?slug=&lang=` devuelve el fragmento de `<head>` de cada perfil (title, description, canonical, Open Graph, Twitter, robots y JSON-LD). Siempre responde 200 y lo arma el mismo composer de la ruta pública. Los perfiles no públicos dan el genérico con `noindex`.
- Caddy procesa `index.html` con `templates` y lo inserta con `httpInclude`. Si la API falla o tarda más de 500 ms, el sitio sirve el head de fallback (#11 cubrió también los 4xx/5xx). El fragmento de cada perfil público se cachea un minuto.
- `og:image` pasa a ser un PNG de 1200×630 en lugar del SVG. El cliente reutiliza las etiquetas del servidor en lugar de duplicarlas.
- Pendiente: la verificación con LinkedIn y Slack, que necesita el sitio desplegado (`docs/RELEASE-1.0.0-CHECKLIST.md`).

### Change 3 — duplicar, archivar, enumerar y renombrar
- Tres ejes disjuntos: `visibility` (quién puede abrirlo), `archivedAt` (si sigue vivo: archivado da 404, siempre) y `listed` (si se enumera). La decisión de acceso está en una sola función, `resolvability`, con la tabla de verdad de doce casos.
- Duplicar (`POST …/{id}/duplicate`): la copia nace privada y no enumerada. Archivar y desarchivar con endpoints propios: se conservan las visitas.
- Alias de slug: renombrar no rompe los links ya enviados. El menú de perfiles solo aparece en la home.
- Primera migración incremental, aditiva: `20261005201934_curated_profile_lifecycle`.

## Update — Octubre 2026 (ronda 1.1, change 1 — `unify-section-catalog`; CI)

Primer change de la ronda 1.1 (`docs/ROADMAP-1.1.md` § 4), mergeado en PR #4 y archivado en `openspec/changes/archive/2026-10-05-unify-section-catalog/`. Antes, en PR #2, se agregó el CI.

### Catálogo de secciones
- **Una sola fuente de verdad**: `SECTION_IDS` en el dominio del backend, con 9 ids en orden canónico (`hero, stats, experience, skills, projects, education, certifications, presence, contact`). Viaja al cliente como enum `SectionId` del OpenAPI. Antes el backend declaraba 7 y el frontend 9.
- **El backend decide el orden final**: el composer aplica el orden, el ocultado y el relleno (las secciones con datos que no figuran en `sectionsOrder` van al final) y descarta las vacías. El frontend renderiza `sections` tal cual llega; desaparecen `orderSections` y `hasData` del cliente.
- **Validación**: un id fuera del catálogo en `sectionsOrder` o `sectionsHidden` responde 400 nombrando el id, al crear, al editar y en el preview.
- **Contrato que compila**: el registro de componentes del frontend es `Record<SectionId, …>`; si el backend agrega una sección y el cliente no la implementa, el build falla.
- **Seed**: las plantillas y `all` usan `SECTION_IDS`. Visiblemente se ven las mismas secciones; `projects` y `presence` pasan del final a su lugar canónico.
- Specs sincronizadas: `curated-profile-resolution` (requisito nuevo *Catálogo canónico de secciones*; *Secciones ordenadas y ocultas* reescrito), `layout-engine` y `admin-curated-profile-crud` (*Validación de ids de sección*).

### CI (`.github/workflows/ci.yml`)
- En cada push y PR a `main`: backend (lint, typecheck, unitarios, build y control de que `openapi.json` siga al día), backend e2e contra Postgres 16 con `prisma migrate deploy` y seed, y frontend (lint, tests y build). Cierra el ítem CI/CD del checklist 1.0.x.
- `asyncUtilTimeout` de Testing Library a 5 s: las pantallas lazy del backoffice fallaban al azar con el segundo por defecto.

## Update — Octubre 2026 (defectos D-01 y D-02 de la suite de regresión manual)

Los dos defectos que encontró la primera ejecución completa de la suite (`docs/MANUAL.md` § 6.1, 5 de octubre de 2026). Corregidos en PR #1; PR #3 agrega la cobertura de punta a punta y una guardia general.

### D-01 — El dashboard no mostraba las visitas de hoy
- `GET /api/admin/analytics/views`: el rango `from`/`to` es **cerrado**. Una fecha sin hora se resuelve al borde de su día en UTC —inicio para `from`, último milisegundo para `to`— en `range-boundaries.ts`; un instante completo se respeta tal cual, para consultar ventanas de horas. Antes `to=<fecha>` caía en la medianoche inicial y el panel, que manda `to=<hoy>`, nunca contaba el día en curso.
- Spec `profile-view-analytics`: requisito nuevo *El rango de fechas es cerrado*. Tests unitarios de los bordes y e2e del día en curso.

### D-02 — Omitir un objeto obligatorio respondía 500
- `@IsDefined()` en los campos bilingües obligatorios: `role` y `summary` de experiencias, `title` y `headline` de perfiles curados y `name` de categorías de skills. Ahora responden 400, como ya exigían `api-platform` y las specs de CRUD. Los `PATCH` parciales no cambian: `PartialType` anula el `@IsDefined()`.
- `backend/test/dto-validation.spec.ts`: por cada DTO de entrada listado, un cuerpo sin cada campo obligatorio, o con él en `null`, falla la validación.
- `backend/test/security.spec.ts` (PR #3): guardia sobre los metadatos de `class-validator` de **toda** clase validada en `src/`; un `@ValidateNested()` sin `@IsOptional()` debe llevar `@IsDefined()`. Cubre los DTO que todavía no están en la lista anterior.
- `backend/test/admin.e2e-spec.ts` (PR #3): las seis omisiones por HTTP responden 400 con el campo en el mensaje, sin crear nada.

## Update — Septiembre 2026 (Fase 6 — change OpenSpec `add-production-hardening`)

Hardening para el release 1.0.0 (propuesta aprobada por Human Gate, commit `33029cc`). Cierra los 6 bloqueantes del checklist y 5 de los 6 importantes; el sexto (backups) no es código.

### Backend (`backend/`)
- `AllExceptionsFilter` global: todo error sale como `{ statusCode, message, error, requestId, timestamp }`, sin stack traces, SQL ni códigos de Prisma; el detalle va al log.
- `GET /health` (200 / 503 según la base, con timeout de 2 s) y `GET /health/live`, fuera del prefijo `/api`, sin autenticación y exentos del rate limiting.
- Arranque seguro: con `NODE_ENV=production` la API no levanta con el `JWT_SECRET` de ejemplo, con menos de 32 caracteres, con `ANALYTICS_SALT` repetida o con `FRONTEND_URL` sin https. Swagger solo se publica con `ENABLE_API_DOCS=true`.
- Rate limiting: global por IP (`@nestjs/throttler`) y un guard propio para el login con 429 y `Retry-After`.
- Helmet ajustado a una API JSON, HSTS y redirección 301 a https por `X-Forwarded-Proto` en producción, `SESSION_COOKIE_SAMESITE` configurable (`none` fuerza `Secure`).
- Logs estructurados con pino: JSON en producción, `LOG_LEVEL`, `requestId` por petición (cabecera, cuerpo de error y log) y redacción de credenciales; el `?token=` de los perfiles protegidos se censura.
- `GET /robots.txt` y `GET /sitemap.xml` con los perfiles `PUBLIC` sobre `FRONTEND_URL`.
- Scripts: `prisma:deploy`. Variables nuevas documentadas en `.env.example`.

### Frontend (`frontend/`)
- Metadatos por perfil y por idioma: título, descripción, canonical, OpenGraph, Twitter Card y JSON-LD `Person`; `noindex` en perfiles no públicos y en `/admin`. `index.html` trae metadatos base para rastreadores sin JavaScript.

### Documentación
- **`docs/DEPLOY.md` (nuevo)**: runbook de producción con variables por entorno, generación de secretos, orden de arranque, healthcheck del proveedor, verificación posterior, rollback y backups con su prueba de restauración.
- `docs/RELEASE-1.0.0-CHECKLIST.md` reescrito con el estado real de los 18 ítems.

### Datos
- Sin cambios en `cv-data.json` ni en el schema.

## Update — Septiembre 2026 (Fase 5 — change OpenSpec `add-admin-backoffice`)

Backoffice visual bajo SDD (propuesta aprobada por Human Gate, commit `379bf46`).

### Backend (`backend/`)
- Sesión del panel por cookie `httpOnly` (`portfolio_session`): la emite `POST /api/auth/login`, la borra `POST /api/auth/logout` y el guard acepta cookie o `Authorization: Bearer`. CORS con `credentials`.
- `POST /api/admin/curated-profiles/preview`: resuelve un perfil curado en borrador sin persistir ni registrar visitas, con el mismo cuerpo que la ruta pública. Para lograrlo se extrajo `CuratedProfileComposer` (pasos 3-5 y 7 del núcleo) de `ResolveCuratedProfileUseCase`, que ahora conserva visibilidad, token y registro de visita.
- `GET /api/admin/themes`: catálogo de temas para el customizador (`findAll()` en `ThemeRepository`).
- Contrato: `endDate`, `techFocus`, `themeId` y `accessToken` se declaraban como `object` en OpenAPI por un `@ApiPropertyOptional({ nullable: true })` sin `type`; ahora son `string`.

### Frontend (`frontend/`)
- Panel `/admin` en un chunk aparte (`React.lazy`): login, dashboard, experiencias, skills, perfiles curados.
- Dashboard de visitas con rango de fechas y gráficos propios (sin librería de charts).
- CRUD visual con campos bilingües (`LocalizedField`), listas de chips (`ChipListField`), confirmaciones y avisos (`sonner`).
- Constructor con preview en vivo (retardo de 400 ms, tokens del tema fuera de la clave), selección por tags del universo real, include/exclude por experiencia, orden y ocultamiento de secciones, visibilidad, token y link público con copiar y abrir.
- Customizador de tema en tiempo real: 8 colores con selector y hexadecimal, tipografía, modo, densidad y radio; guarda solo las diferencias contra el tema base.
- Tests: 118 en el frontend (eran 56) y 182 + 91 en el backend (eran 168 + 73).

### Datos
- Sin cambios en `cv-data.json` ni en el schema. El perfil `verificacion-fase5`, creado durante la verificación, se borró al terminar.

## Update — Septiembre 2026 (Fase 4 — change OpenSpec `add-public-frontend-theming`)

Frontend público + motor de theming bajo SDD (propuesta aprobada por Human Gate, commit `62a49d6`).

### Backend (`backend/`)
- Script `npm run openapi:export` (`scripts/export-openapi.ts`): escribe `backend/openapi.json` con el mismo documento de `/api/docs-json`, sin abrir puerto ni conectar a la base; `swagger.ts` expone `buildOpenApiDocument`. `openapi.json` se versiona.

### Frontend (`frontend/`, nuevo)
- SPA React 19 + Vite 8 + TypeScript 5.9 estricto + Tailwind 4 + shadcn/ui + Motion + TanStack Query + react-router 8 + Zustand + Zod. Tipos generados con `openapi-typescript` (`npm run api:types` → `src/shared/types/api.d.ts`, versionado, test de deriva por hash) y cliente `openapi-fetch`.
- Motor de theming: `ThemeTokens` (zod) compatible con `Theme.tokens` del seed, 5 presets, `tokensToCssVars` → `--t-*` aplicadas por `ThemeProvider` en el contenedor raíz; Tailwind `@theme inline` y variables de shadcn derivadas. Selector de presets (`?theme=`), modo, densidad, radio, tipografía y animaciones (respeta `prefers-reduced-motion`).
- Layouts `classic` y `sidebar` (`?layout=`), orden de secciones de la API + conocidas faltantes al final, ocultas/vacías omitidas, `stats` derivadas.
- Home = perfil curado `all`; `/:slug`; menú agrupado por `roleType` (dropdown/panel lateral); estados de carga, error con reintento, 404 propia y formulario de token para PROTECTED (`X-Access-Token`, `?token=`).
- Bilingüe: `?lang=` > `navigator.language`; diccionario `es`/`en` con fallback; toda petición envía `?locale=`.
- Tests Vitest (12 archivos, 56 tests) con Testing Library + MSW; verificación visual con capturas en `openspec/changes/archive/…/verification/`.

### Datos
- Sin cambios en `cv-data.json` ni en el schema. Nota: el perfil `all` no tiene `roleType`; el menú lo muestra como grupo "Perfil completo".

## Update — Septiembre 2026 (change OpenSpec `add-portfolio-sections-api`, previo a Fase 4)

Cierra el hueco de datos para el frontend público (propuesta aprobada por Human Gate, commit `145d4df`).

### Backend (`backend/`)
- Módulos mínimos `education` (educación + certificaciones), `project` y `social-link`: entidades, puertos de lectura, adaptadores Prisma, casos de uso y endpoints `GET /api/education`, `/api/certifications`, `/api/projects`, `/api/social-links` (solo visibles, orden `order`, locale negociado).
- La vista curada agrega `projects` (filtrados por tags + overrides, mismo espacio de ids), `education`, `certifications` y `socialLinks`; `PortfolioSectionsLoader` agrupa las cuatro lecturas.
- Specs: nueva `public-portfolio-sections-api`; `curated-profile-resolution` con la regla de proyectos y la forma completa ampliada.

## Update — Septiembre 2026 (Fase 3 — change OpenSpec `add-auth-and-crud`)

Backoffice API bajo SDD (propuesta aprobada por Human Gate, commit `31cdbe7`).

### Backend (`backend/`)
- Módulo `auth`: `LoginUseCase` con puertos `PasswordHasher` (argon2id) y `TokenSigner` (JWT HS256 vía `@nestjs/jwt` 11 + Passport); `JwtAuthGuard` en todo `/api/admin/*`; `GET /api/auth/me`; `npm run admin:bootstrap`.
- CRUD de experiencias, categorías/skills y perfiles curados con DTOs bilingües `{ es, en? }`, `PATCH` parcial, reglas de dominio (`validateExperience`, `validateCuratedProfile`), `ValidationError` → 400 y `ConflictError` → 409. Campos desconocidos → 400 en rutas con cuerpo (pipe estricto por controller; el global solo transforma).
- Módulo `analytics`: `ProfileView` registrado en cada resolución pública exitosa (transacción `create` + `views++`, IP solo como HMAC-SHA256) y `GET /api/admin/analytics/views` (total, por perfil, por idioma, por día).
- Config: `JWT_SECRET` (min 16), `JWT_EXPIRES_IN`, `ANALYTICS_SALT`; CORS con `POST/PATCH/DELETE` y `Authorization`.
- Tests: 157 unitarios + 65 e2e (auth, backoffice, Fase 1 y 2).

### Docs sincronizadas
- `CLAUDE.md`: checkbox Fase 3; paso 6 del núcleo implementado; comando `admin:bootstrap`.
- `ARCHITECTURE.md` §6/§7: rutas admin reales y Fase 3 marcada.
- `DATA-POPULATION.md`: el seed convive con la edición por API y preserva `AdminUser`.
- `backend/.env.example`: `ADMIN_NAME`, `ANALYTICS_SALT`, notas de `JWT_SECRET`.

## Update — Septiembre 2026 (Fase 2 — change OpenSpec `add-curated-profile-resolution`)

Núcleo del producto implementado bajo SDD (propuesta aprobada por Human Gate, commit `67ea1a9`).

### Backend (`backend/`)
- Módulo `curated-profile`: `ResolveCuratedProfileUseCase(slug, locale, accessToken?)` y `ListCuratedProfilesUseCase`; servicios de dominio puros `select-by-tags` (intersección + overrides), `select-skill-categories`, `resolve-sections`; value object `AccessToken` (comparación en tiempo constante).
- Módulos mínimos `skill` y `theme` (dominio + puerto + adaptador Prisma); `merge-theme-tokens` (merge profundo inmutable de `themeOverrides`); preset por defecto `modern-dark`.
- Endpoints `GET /api/curated-profiles` (solo PUBLIC) y `GET /api/curated-profiles/:slug` (404 PRIVATE/inexistente, 401 PROTECTED sin token vía `X-Access-Token` o `?token=`).
- **Orden canónico de experiencias pasa a cronológico** (`startDate` desc, `order` asc como desempate) en toda la API, incluido `GET /api/experiences` (decisión D1, aprobada). Motivo: los datos reales tenían 2 casos donde `order` no era cronológico.
- `AccessDeniedError` en shared + mapeo a 401. `ProfileModule`/`ExperienceModule` exportan sus puertos.
- Tests: 117 unitarios (incluye arquitectura) + 43 e2e.

### Docs sincronizadas
- `CLAUDE.md`: checkbox Fase 2; § núcleo actualizado (orden canónico, `ProfileView` en Fase 3, visibilidad).
- `ARCHITECTURE.md` §6/§7: rutas de Fase 2 marcadas; endpoint `access` descartado.
- `DATA-POPULATION.md`: overrides no viven en el JSON; orden cronológico.
- `openspec/specs/public-experience-api`: requisito de orden modificado.

## Update — Septiembre 2026 (Fase 1 — change OpenSpec `add-backend-base`)

Primer change de código bajo disciplina SDD con OpenSpec (`openspec/`), aprobado por Human Gate antes de implementar.

### Backend (`backend/`)
- Proyecto NestJS 11.2 + Prisma 6.19 con TypeScript estricto, ESLint/Prettier, Jest.
- Migración inicial versionada `prisma/migrations/20260906055928_init` (14 tablas) generada con `migrate dev`; sin `db push`.
- Seed operativo e idempotente desde `docs/cv-data.json` + `npm run seed:verify` (conteos calculados en runtime desde el JSON).
- Módulos de referencia `profile` y `experience` en Clean Architecture (domain/application/infrastructure) con `Result<T,E>`, puertos + tokens Symbol, adaptadores Prisma, casos de uso con tests mock.
- Endpoints públicos `GET /api/profile`, `GET /api/experiences`, `GET /api/experiences/:id`; Swagger en `/api/docs`, OpenAPI en `/api/docs-json`.
- i18n: núcleo puro reubicado a `shared/domain/i18n` (la ruta `shared/infrastructure/i18n/resolve-locale.ts` queda como fachada + `normalizeLocale`). Negociación `?locale=` > `?lang=` > `Accept-Language` > `es`, header `Content-Language`.
- Tests: 56 unitarios (incluye test de arquitectura de la regla de dependencia) + 26 e2e.

### Docs sincronizadas
- `SPECS-POR-FASE.md`: el criterio de seed refleja los conteos reales (15 experiencias; 13 plantillas + `all` = 14 perfiles curados).
- `ARCHITECTURE.md` §6: rutas públicas planas bajo `/api` (superan el borrador `/api/public/*`); Fase 1 marcada.
- `I18N.md` §4/§9: ubicación del núcleo i18n y precedencia de locale.
- `KICKOFF-ClaudeCode.md`: el paquete npm de OpenSpec es `@fission-ai/openspec`.
- `CLAUDE.md` / `README.md`: checkbox Fase 1.

## Update — Junio 2026 (plantilla de specs por fase para SDD)

Añadido `docs/SPECS-POR-FASE.md`: una especificación ejecutable por cada una de las 6 fases (objetivo, alcance, fuera de alcance, criterios de aceptación verificables y prompt de arranque para Claude Code). Formaliza el flujo de Spec-Driven Development: especificar → planificar → implementar → verificar, una fase a la vez. Referenciado desde ARCHITECTURE.md y CLAUDE.md.

## Update — Junio 2026 (checklist de release 1.0.0)

Añadido `docs/RELEASE-1.0.0-CHECKLIST.md`: guía de hardening para producción priorizada en bloqueantes (secretos, migraciones, CORS, validación, manejo de errores, healthcheck), importantes (rate limiting, Helmet, logging, tests mínimos, SEO, backup DB) y deseables (export PDF, a11y, caché, analítica, CI/CD, repos destacados). La "Fase 6 — Pulido" de `ARCHITECTURE.md` se reescribió como "Fase 6 — Hardening para producción" y apunta a este checklist. El deploy real queda como último paso, tras cerrar bloqueantes e importantes.

## Update — Mayo 2026 (taxonomía de navegación + perfiles Tech Lead .NET y Generalista)

Enriquecidas experiencias recientes y añadida una taxonomía de navegación para agrupar los perfiles curados por tipo de rol y tecnología.

### Taxonomía de navegación (nuevo)
Cada perfil curado ahora tiene dos campos para el menú:
- **`roleType`** (LocalizedText) — categoría de rol: Tech Lead, Backend, Fullstack, DevOps, Arquitecto, Liderazgo, Generalista.
- **`techFocus`** (string) — tecnología destacada: .NET, Java, Node / React, Azure, etc.

El menú de navegación se agrupa por `roleType` y muestra el `techFocus` como subtítulo de cada perfil. En `schema.prisma`, `CuratedProfile` gana `roleType` (Json) y `techFocus` (String).

### Perfiles curados: 11 → 13
Añadidos:
- **tech-lead-dotnet** — Tech Lead · .NET · Modernización Legacy. Acento `#5B2C87`. filterTags: leadership, dotnet, microservices, migration, microsoft, integration, fullstack.
- **generalist-polyglot** — Senior Software Engineer (Generalista) · Polyglot. Acento `#0F766E`. filterTags amplios (java, dotnet, nodejs, fullstack, microservices, cloud, fintech, leadership) — pensado para recruiters con búsquedas abiertas.

### Experiencias enriquecidas (bilingüe ES/EN)
- **K27** → rol "Líder Técnico de Desarrollo": liderazgo de equipo, migración .NET/React, PoC de Kubernetes para banca. Tags nuevos: leadership, fullstack, migration, banking.
- **Tul** → rol "Software Technical Lead · DevOps": separación explícita LT + ingeniería DevOps. Tag nuevo: devops.
- **NEXTGO** → rol "Software Technical Lead · DevOps": LT + IaC/CI-CD destacado.
- **Banco Ganadero** → rol "Fullstack Developer · Encargado de Proyecto": diseño/desarrollo/puesta en producción de GanaSafi (ahorro e inversión) + liderazgo de proyecto con 3 personas. Tag nuevo: leadership.

---

## Update — Mayo 2026 (LinkedIn agregado a la presencia pública)

Sumado LinkedIn como tercer canal de presencia pública, completando el tríptico profesional.

### `cv-data.json`
- Nueva entrada en `profile.socialLinks`: **linkedin** con URL pública verificada (`/in/manuel-joaquin-saavedra-severiche-266a4b125`), `featured: true`.
- Descripción bilingüe basada en el headline público real del perfil ("Senior Full-Stack Software Architect | Senior Tech Lead | Senior Fullstack Developer").

### Demo principal (`demo.html`)
- Reorganización de la sección "Presencia Pública" para acomodar tres enlaces sin amontonar.
- Layout actualizado: **dos tarjetas hero arriba** (GitHub + LinkedIn, grid 1:1) y **YouTube como banda inferior full-width**.
- Nuevo variant CSS `.presence-card--strip` para el formato banda de YouTube.
- Color de marca LinkedIn (`#0a66c2`) aplicado al ícono con clase `.presence-icon--li`.
- Title de sección actualizado: "Código, Red Profesional y Comunidad".

### Decisión de diseño
- **GitHub y LinkedIn como protagonistas duales** — GitHub representa el código y la práctica técnica abierta; LinkedIn representa la trayectoria profesional y el canal de contacto formal. Ambos cumplen funciones complementarias críticas para un perfil senior buscando oportunidades.
- **YouTube se mantiene discreto** — el banda inferior reduce su peso visual sin esconderlo.
- **Sin scraping de LinkedIn** — la descripción se basa solo en el headline público que aparece en resultados de búsqueda (verificado), no en contenido scrapeable del perfil.

---

## Update — Mayo 2026 (presencia pública: GitHub + YouTube)

Añadida la sección de presencia pública al MVP, con GitHub como protagonista visual y YouTube como acompañante discreto.

### Nuevos modelos en `schema.prisma`
- **`SocialLink`** — enlaces a redes (platform, handle, url, label, description, stats, featured, visible).
- **`FeaturedRepository`** — curaduría manual de repos destacados (NO un dump del API de GitHub).

### `cv-data.json` extendido
- `profile.socialLinks` → 2 entradas (github + youtube) con descripción bilingüe honesta.
- `profile.featuredRepositories` → placeholder con `visible: false` esperando curaduría manual de Manuel sobre cuáles repos profesionales destacar (los visibles en su perfil GitHub son mayoritariamente académicos UPSA).

### Demo principal (`demo.html`)
- Nueva sección "Presencia Pública · Código y Comunidad" entre Skills y Footer.
- Tarjeta GitHub grande (protagonista) con icono SVG, handle, descripción narrativa, stats (67 repos, 10+ años activo) y badges (Pull Shark, Arctic Code Vault).
- Tarjeta YouTube lateral discreta con descripción honesta de "contenido mixto técnico".

### Decisiones de diseño documentadas
- **GitHub protagonista, YouTube discreto** (decisión de Manuel).
- **Sin scraping automático de GitHub:** la lista de repos destacados se cura manualmente para evitar mostrar repos universitarios antiguos que diluyen el mensaje profesional.
- **YouTube descrito de forma honesta:** "contenido mixto técnico" sin inventar temáticas que no se pudieron verificar (RSS bloqueado al scraping).

---

## Update — Mayo 2026 (perfil Backend Payments / Ruby on Rails)

Añadido un perfil curado para vacantes de backend de pagos con Ruby on Rails.

### Perfiles curados: 10 → 11
Añadido:
- **backend-payments-ror** — Ingeniero Backend de Pagos · Fintech · Ruby on Rails (en formación). Acento ruby `#9B1C2E`. filterTags: `payments, fintech, banking, ruby, messaging, integration`. Resuelve 7 experiencias (Ensitech, Eron/Directa24, Tul, Banco Ganadero, SCVS, NSoft, Delta Cargo).

### Tags nuevos en experiencias
- `payments` — añadido a Ensitech, Eron/Directa24, Banco Ganadero.
- `ruby` — añadido a Ensitech (refleja formación autodidacta en Ruby/Rails, posicionada con honestidad).

### Nota de posicionamiento
Este perfil encarna el criterio de honestidad aplicado en el CV correspondiente: lidera con la fortaleza real (backend de pagos, fintech, ISO 8583, TDD, SQL avanzado, event-driven) y declara Ruby on Rails como formación en curso, sin inflar. Las equivalencias técnicas (JUnit↔RSpec, BigQuery↔Snowflake, Grafana↔Datadog) se marcan como tales, nunca como la herramienta exacta.

---

## Refactor — Mayo 2026 (post-CVs adicionales)

Actualización de los datos consolidados para reflejar los CVs generados después del scaffold inicial.

### Perfiles curados (profileTemplates): 6 → 10
Añadidos:
- **ai-software-engineer** — Hybrid AI coding (Claude Code, Cursor, MCP), full-stack TS/Python. Acento violeta `#6D28D9`.
- **fullstack-microsoft** — Ecosistema Microsoft end-to-end: .NET, SQL Server, reporting, modernización legacy. Acento `#0078D4`.
- **devops-azure** — DevOps con Azure al frente: Azure DevOps, Terraform, K8s, incident management. Acento `#0078D4`.
- **software-architect** — Arquitectura de software: microservicios, patrones, alto rendimiento. Acento `#1E293B`.

### Tags nuevos en experiencias
- `ai-engineer` — añadido a Ensitech, K27, Tul (donde se usó IA en el flujo).
- `microsoft` — añadido a Ensitech, K27, Delta Cargo, YPFB, NSoft, Banco Ganadero.
- `python` — añadido a Ensitech.
- `azure` — reforzado en K27, Ensitech.
- `fullstack` / `nodejs` — reforzados donde correspondía (Vidoomy, Tul, Banco Ganadero).

### Nueva sección: projects
- **portfolio-web** — el propio portafolio (NestJS + React + Prisma, construido con Claude Code).
- **erp-awa** — ERP AWA de NSoft (de cero a producción).

### Schema
- Nuevo modelo `Project` (name, role, period, summary, technologies, tags, url, order, visible).

### Seed
- Carga de `projects` añadida.
- Heurística de tags por categoría de skill ampliada con `ai-engineer`, `microsoft`, `python`, `azure`.

### Resolución verificada (experiencias / proyectos que matchean por perfil)
```
java-senior-backend      → 11 exp, 1 proy
fullstack-nest-react     → 13 exp, 2 proy
devops-platform          →  8 exp, 0 proy
dotnet-backend           →  7 exp, 1 proy
it-leadership            →  6 exp, 1 proy
integration-architect    →  7 exp, 0 proy
ai-software-engineer     →  9 exp, 1 proy
fullstack-microsoft      →  7 exp, 1 proy
devops-azure             → 10 exp, 1 proy
software-architect       → 12 exp, 1 proy
```
