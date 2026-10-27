# Design — add-learning-guide-and-example-data

## Context

Ver `proposal.md`. Estado verificado el 27 de octubre de 2026 en `docs/refresh-after-1-1` (PR #33):

- **Seed.** `backend/scripts/seed.ts` lee una ruta fija (`../../docs/cv-data.json`), borra 13 tablas (`ProfileView` → `FeaturedRepository`; `AdminUser` y `CuratedProfileSlugAlias` no se borran explícitamente, aunque el alias cae en cascada con su perfil) y recarga. Fija `visibility: 'PUBLIC'`, `layout: 'classic'`, `themeId` de `modern-dark` y `sectionsOrder: SECTION_IDS`. Las experiencias, formaciones y certificaciones se crean visibles. Las skills reciben los tags de `tagsForSkillCategory(cat.name.es)`. Ignora el `id` de experiencias y proyectos del JSON. Tampoco carga `includeIds`, `excludeIds`, `sectionsHidden`, `accessToken`, `archivedAt` ni alias.
- **Verificación.** `verify-seed.ts` calcula los conteos esperados desde el JSON, busca la experiencia `Novacomp` para comprobar el bilingüe y compara `Language.level` y `colors.accent` por plantilla. Su ruta también es fija.
- **Esquema.** `CuratedProfile` ya tiene todas las columnas que hacen falta: `includeIds`, `excludeIds`, `themeId`, `themeOverrides`, `layout`, `sectionsOrder`, `sectionsHidden`, `visibility`, `accessToken`, `archivedAt`, `listed` y `slugAliases` (`CuratedProfileSlugAlias`). `Experience`, `Education`, `Certification`, `Project` y `SocialLink` tienen `visible`. `FeaturedRepository` no se lee en ningún módulo de `backend/src`.
- **Selección.** `CuratedProfileComposer` aplica `selectByTags` a experiencias visibles y a proyectos, y `selectSkillCategories` a las skills, con los mismos `includeIds`/`excludeIds`. El constructor (`ProfileBuilderPage.tsx`) solo ofrece *Incluir*/*Excluir* para experiencias. Para skills y proyectos solo existe la API.
- **Faltantes.** `detectMissingTranslations` cubre `curatedProfile`, `profile`, `experience`, `skillCategory`, `project`, `education`, `certification`, `socialLink` y `language`. `seed-translations.spec.ts` exige cero faltantes en `cv-data.json`.
- **Guardas existentes.** `print:check` exige `PRINT_CHECK_DISPOSABLE_DB=1` y `a11y:check`/`perf:check` exigen `A11Y_CHECK_DISPOSABLE_DB=1` (`frontend/scripts/lib/web-quality.mjs`, `requireDisposableDb`). `a11y:check` entra al panel con `fetch('/api/auth/login')` desde la página. Las tres usan `puppeteer-core` con el Chrome del sistema (`findChrome`, `chromeFlags`).
- **Manual.** `docs/MANUAL.md` (72 KB) y `docs/manual/index.html` (108 KB, 1.216 líneas) describen 35 casos. En el HTML, ✅ es `data-status="ok"` y 🔍 es `data-status="part"`: 28 y 7. Hay 27 capturas (26 `.jpg` y `tc32-faltantes.png`, de 186 KB). El HTML usa fuentes de Google Fonts y un `store` con `try/catch` sobre `localStorage` para el tema y las marcas `manual-run-<tc>`. La barra de progreso dice *"0 de 24"* antes del script, aunque hay 35 casillas. La nota de *Limitación actual* de TC-19 sigue publicada, aunque `add-bilingual-builder-parity` la resolvió el 8 de octubre.
- **Suite.** `docs/manual/suite-backoffice.ps1` ejecuta TC-12 a TC-20 contra la API y limpia lo que crea. No depende de los conteos de la base.
- **Proxy de desarrollo.** `frontend/vite.config.ts` usa `VITE_PROXY_TARGET` (por defecto `http://localhost:3300`), así que se puede levantar una API de ejemplo en otro puerto sin tocar la del owner.

## Goals / Non-Goals

**Goals:** un conjunto de datos donde se vea cada entidad, cada sección y cada mecanismo del perfil curado; que sea imposible cargarlo sobre la base del owner por error; una guía que enseñe a poblar el contenido campo por campo; un manual que se pueda leer de punta a punta para aprender (conceptos, tareas reales y cada pantalla) además de ejecutarse como suite; capturas al día y reproducibles con un comando; un modo prueba que deje registro.

**Non-Goals:** ver `proposal.md` § Non-goals.

## Decisions

### D1 — Un solo change, con los datos primero

Un change con grupos ordenados: datos y seed (1–3), manual (4–7), capturas (8), modo prueba (9) y cierre (10). Los grupos 1–3 pueden ir en un primer PR propio.

Alternativa descartada: **dos changes** (`add-example-seed-data` y `add-learning-guide`). Aislaría el riesgo del seed, pero el segundo no puede cerrar sin el primero: las capturas, los recorridos y la base de los casos se definen sobre los datos de ejemplo. El primero, en cambio, quedaría sin quien lo use. La parte de seed es chica (dos scripts y un JSON), y separarla en un PR propio dentro del mismo change da el mismo aislamiento de revisión.

### D2 — `docs/examples/cv-data.example.json`, con una persona ficticia

*«En el directorio»* se interpreta como un directorio del repositorio, junto a la fuente real: `docs/examples/`. El archivo usa una persona ficticia y respeta estas reglas:

- No usa nombres de personas ni de empresas reales. Las empresas llevan nombres genéricos e inventados.
- Los dominios son `example.com`, `example.org` o `example.net` (RFC 2606). La excepción son los `referrer` de las visitas sintéticas, que imitan orígenes reales (D8) y no se muestran como enlace.
- El teléfono es del rango ficticio `+1 555 01xx`.
- El token de acceso del perfil protegido es un valor de prueba documentado en la guía.

Con esto, las capturas y el manual (que se publica como artifact) no exponen el email, el teléfono ni los enlaces reales del owner. El ejemplo tampoco se confunde con su CV.

Alternativas descartadas:
- **Datos del propio owner:** `cv-data.json` ya son sus datos. Copiarlos y completarlos duplicaría la fuente y mezclaría contenido real con mecanismos de demostración (perfiles archivados, tokens, faltantes adrede).
- **`backend/prisma/seed-examples/`:** acerca el archivo al script pero lo aleja de `cv-data.json` y de la guía, que viven en `docs/`.

Queda como pregunta al owner (P1, P2), con este default.

### D3 — Formato extendido, opcional y compatible hacia atrás

El ejemplo usa el mismo formato que `cv-data.json` más campos opcionales. **Ausente** cada uno, el seed hace exactamente lo de hoy:

| Dónde | Campo | Tipo | Si falta |
|---|---|---|---|
| `experiences[]`, `education[]`, `certifications[]` | `visible` | boolean | `true` |
| `skillCategories[]` | `tags` | string[] | `tagsForSkillCategory(name.es)` |
| `skillCategories[].skills[]` | string u objeto `{ name, tags }` | — | string: los tags de la categoría |
| `profileTemplates[]` | `theme` | slug de un preset | `modern-dark` |
| | `layout` | `classic` \| `sidebar` | `classic` |
| | `visibility` | `PUBLIC` \| `PROTECTED` \| `PRIVATE` | `PUBLIC` |
| | `accessToken` | string, obligatorio si `PROTECTED` | `null` |
| | `sectionsOrder` | ids del catálogo, sin repetir | `SECTION_IDS` |
| | `sectionsHidden` | ids del catálogo | `[]` |
| | `includeRefs`, `excludeRefs` | referencias (D7) | `[]` |
| | `archived` | boolean | `false` (`archivedAt: null`) |
| | `slugAliases` | slugs kebab-case | ninguno |
| raíz | `exampleViews` | ver D8 | ninguna visita |

Los ids de sección se validan contra `SECTION_IDS`, que el script ya importa. Los slugs y alias usan el mismo patrón que el panel (`^[a-z0-9]+(?:-[a-z0-9]+)*$`). Un alias no puede repetir un slug ni otro alias.

Alternativas descartadas:
- **Un segundo script que aplique los mecanismos por la API del panel**, después del seed. Enseña la API, pero exige la API levantada y un administrador, y duplica las validaciones con otra vía de fallo. Además, el archivado y los alias se crean por acciones (`POST :id/archive`, `PATCH` del slug) que el JSON describe mejor como estado.
- **Un formato propio para el ejemplo:** dos formatos que mantener. El owner aprendería uno que no es el de su `cv-data.json`.

### D4 — JSON plano y la guía campo por campo en `DATA-POPULATION.md`

`JSON.parse` no admite comentarios, y el ejemplo tiene que seguir cargándose con el mismo parser. La documentación de cada campo va en una sección nueva de `docs/DATA-POPULATION.md`, *Referencia campo por campo*, con una tabla por entidad. Cada fila dice:

- el campo y su tipo (`LocalizedText`, `LocalizedList`, string, fecha `AAAA-MM`, etc.);
- si es obligatorio y su valor por defecto;
- un ejemplo tomado del archivo;
- dónde se ve en el sitio;
- qué pantalla y campo del panel lo editan (o *"solo por la API"* / *"solo en el seed"*).

La sección también explica cómo levantar la base de ejemplo (D5, D6) y cuál es la diferencia entre poblar con el seed (base vacía) y editar desde el panel (día a día).

Alternativas descartadas:
- **JSONC con comentarios** (`cv-data.example.jsonc`): exigiría un parser o un *strip* de comentarios en el seed, y el archivo dejaría de ser válido para cualquier herramienta de JSON.
- **JSON Schema con `description` por campo** (ayuda en el editor): sería una segunda fuente que se desincroniza, y validarlo de verdad en el seed exigiría una dependencia nueva (Ajv). Se puede sumar más adelante si la guía no alcanza.

### D5 — `--file` explícito y validación completa antes de borrar

- `npm run seed -- --file <ruta>` y `npm run seed:verify -- --file <ruta>`. La ruta se resuelve contra el directorio actual (`backend/` cuando se corre con npm). Atajos en `backend/package.json`: `seed:example` → `tsx scripts/seed.ts --file ../docs/examples/cv-data.example.json`, y `seed:example:verify`, igual con `verify-seed.ts`.
- Si la ruta no existe, no es JSON válido o no cumple el formato (campos obligatorios, tipos, ids de sección, slugs, alias duplicados, `accessToken` faltante en un `PROTECTED`, referencias que no resuelven), el seed sale con código **1**. El mensaje nombra el campo (`profileTemplates[3].includeRefs[1]: no existe experience:atlas`) y no se borra nada.
- La validación corre **antes** de la limpieza también sin `--file`. Para `cv-data.json` no cambia nada, porque ya es válido. Una fuente rota deja de vaciar la base a medias.

Alternativa descartada: **`SEED_FILE=<ruta>` como variable de entorno.** Queda viva en la terminal (`$env:SEED_FILE` en PowerShell) y un `npm run seed` posterior, pensado para el CV real, cargaría el ejemplo, o al revés. El flag vale para un solo comando.

### D6 — Negativa en tres capas, antes de tocar la base

Con `--file`, y siempre **antes** de cualquier `deleteMany`, el seed exige:

1. `SEED_DISPOSABLE_DB=1`, con el mismo criterio que `PRINT_CHECK_DISPOSABLE_DB` y `A11Y_CHECK_DISPOSABLE_DB`.
2. `NODE_ENV` distinto de `production`.
3. Que la base esté **vacía de contenido** (cero filas de `Profile`) o que su único `Profile` tenga el mismo `fullName` que el archivo. Así se puede recargar el ejemplo sobre sí mismo, pero nunca sobre otro perfil.

Si falla cualquiera, sale con código **2**, explica cuál falló y cómo seguir (*"creá una base aparte, por ejemplo `portfolio_example`, aplicá las migraciones y apuntá `DATABASE_URL` a ella"*) y no escribe nada. El mensaje muestra la base de destino sin la contraseña (`host:puerto/base`). `seed:verify --file` no escribe, así que no exige las capas.

La capa 3 cubre el olvido más probable: `backend/.env` apunta a la base del owner (`portfolio`), y si `DATABASE_URL` no se redefine en la terminal, el seed se conecta ahí. Esa base tiene el `Profile` del owner y la carga se niega aunque la variable esté puesta.

Alternativas descartadas:
- **Solo la variable de entorno:** se exporta una vez y queda puesta. No protege contra un `DATABASE_URL` equivocado.
- **Exigir un nombre de base con sufijo (`_example`):** acopla el script a una convención de nombres y no ve el contenido. La capa 3 mira lo que importa: de quién son los datos.
- **Pedir confirmación interactiva:** rompe el uso en CI y en scripts.

### D7 — Referencias estables para los overrides

`includeIds` y `excludeIds` guardan ids que genera la base (`cuid`), así que un JSON no puede escribirlos. El formato usa referencias que el seed traduce al id generado:

- `experience:<id>`: el `id` de la experiencia en el JSON (ya existe, por ejemplo `novacomp`).
- `project:<id>`: el `id` del proyecto en el JSON (ya existe).
- `skill:<nombre>`: el nombre de la skill. Si se repite en dos categorías, la referencia es ambigua y el archivo se rechaza (D5).

El seed crea primero el contenido, arma un mapa referencia → id y después crea los perfiles curados. Una referencia a un ítem con `visible: false` es válida y se guarda: el composer la ignora, que es justo lo que el ejemplo quiere mostrar.

Alternativa descartada: **usar el `id` del JSON como id de la fila.** Haría el JSON directamente escribible, pero cambiaría también los ids del CV real en cada seed y mezclaría dos formatos de id en la misma tabla.

### D8 — Visitas sintéticas deterministas y un faltante deliberado

- **`exampleViews`:** una lista de `{ slug, count, daysBack, locales, referrers }`. La visita *i* de cada entrada cae `i % daysBack` días antes del momento del seed, a las 12:00 UTC, con `locale = locales[i % n]` y `referrer = referrers[i % m]` (`null` es directo). Lleva `userAgent: "example-seed"` e `ipHash: null`, y el seed actualiza el contador `views` del perfil con el total. Es determinista respecto del día de carga, así que el dashboard siempre tiene la misma forma. `seed:verify --file` cuenta `ProfileView` como la suma de los `count`. Sin `exampleViews`, el esperado sigue siendo 0, como exige *Seed completo desde cv-data.json*.
- **Faltante deliberado:** todo el ejemplo es bilingüe salvo `description.en` del perfil `PRIVATE`. Con eso, el aviso de faltantes del constructor tiene algo que mostrar en el recorrido *Traducir y revisar faltantes* y en TC-32. Un test sobre el archivo exige exactamente ese faltante y ninguno más.

Alternativa descartada: **no sembrar visitas y generarlas abriendo páginas.** Haría falta un navegador y el resultado dependería del orden de las capturas. Tampoco habría visitas de días anteriores ni orígenes variados para la tabla *Por origen*.

### D9 — La base de ejemplo es la base de referencia del manual

Cada caso TC pasa a tener como precondición *"base de ejemplo"* (`portfolio_example`, sembrada con `seed:example`), y las cifras esperadas (conteos, métricas, slugs) se reescriben sobre ese archivo. `suite-backoffice.ps1` documenta que corre contra esa base. No depende de conteos, pero crea y borra datos, y no debería apuntarse a la del owner. La API de ejemplo se levanta en otro puerto (`PORT=3310`) y el frontend la usa con `VITE_PROXY_TARGET=http://localhost:3310`.

Con una sola base de referencia, los casos, los recorridos y las capturas muestran lo mismo, y ejecutar la suite ya no registra visitas ni crea datos en la base del owner.

Alternativa descartada: **mantener `cv-data.json` como base de los casos y usar el ejemplo solo para la guía.** Las capturas mostrarían a otra persona que los números del texto, y los mecanismos que el CV real no tiene (protegido, archivado, alias) no tendrían dónde verse.

### D10 — Estructura del manual: aprender primero, verificar después

`MANUAL.md` e `index.html` comparten este orden de secciones:

1. **Ruta de aprendizaje.** Ocho conceptos en este orden: perfil base → perfil curado → tags y overrides → secciones → tema → visibilidad, enumeración y archivo → idiomas → analítica. Cada concepto trae qué es (dos o tres frases), qué dato del ejemplo lo muestra, qué pantalla lo edita y qué casos TC lo verifican.
2. **Recorridos por objetivo.** Nueve tareas: preparar un perfil para una vacante; mandarlo a una sola empresa (`listed: false` o `PROTECTED`); retirarlo (archivar, sin perder visitas); renombrar el slug sin romper los links; ajustar el tema y el acento; editar el contenido base; traducir y revisar faltantes; imprimir o guardar en PDF; leer la analítica. Cada recorrido trae pasos numerados por pantalla, el resultado esperado, los errores típicos y los casos relacionados.
3. **Manual del backoffice.** Una subsección por pantalla: `/admin/login`, Dashboard, Portada (con Idiomas), Experiencias, Skills, Formación, Proyectos y enlaces, Perfiles, el constructor con sus cuatro pestañas (Identidad, Selección, Diseño con el customizador, Publicación) y la vista previa (conmutador ES/EN y aviso de faltantes). Cada una lleva una tabla de campos (etiqueta tal como se ve, tipo, obligatorio, validación, ejemplo del archivo), los mensajes de error **literales** del código y las acciones con confirmación (*Duplicar*, *Archivar*, *Borrar*, *Cambiar tema*, avisos de cambios sin guardar). Las fuentes son los esquemas Zod y los borradores de `frontend/src/features/backoffice/*` (`experience-form.ts`, `formacion-form.ts`, `proyectos-form.ts`, `portada-draft.ts`, `language-form.ts`, `profile-draft.ts`, `theme-draft.ts`) y las validaciones de los DTO del backend cuando el cliente no las replica.
4. **Casos TC-01 a TC-37**, agrupados por área: pública, backoffice y datos. Se suman **TC-36** (*Cargar los datos de ejemplo en una base descartable*) y **TC-37** (*El seed de ejemplo se niega contra una base con otros datos*).
5. Operación, calidad web, defectos, receta y *Qué falla y por qué*, como hoy.
6. **Glosario.**

Los mensajes de validación se citan en una tabla con una marca reconocible para `manual:check` (D13): una columna *Mensaje* en Markdown y `<td class="msg">` en el HTML.

Alternativa descartada: **un `docs/BACKOFFICE.md` aparte.** Sería un tercer documento que alinear. El owner pidió el manual del backoffice dentro del manual, y el HTML ya tiene índice y buscador para navegarlo.

### D11 — Capturas reproducibles con `npm run manual:capture`

- **Script:** `frontend/scripts/capture-manual.mjs` (`npm run manual:capture -- <base> [--only <id,…>]`). Reutiliza `findChrome` y `chromeFlags` de `scripts/lib/web-quality.mjs`. Un manifiesto en el propio script declara cada captura: `{ id, archivo, ruta, viewport, sesión, pasos }`. Los pasos son acciones sin escritura: navegar, hacer clic, tabular, abrir un diálogo, escribir en un campo que no es contraseña o emular `print`.
- **Guardas:** exige `MANUAL_CAPTURE_DISPOSABLE_DB=1` (sale con 2 sin ella). Antes de la primera captura pide `GET /api/profile` y compara `fullName` con el de `docs/examples/cv-data.example.json`; si no coincide, sale con 2 sin abrir ninguna página. Así nunca se fotografía ni se registran visitas en la base del owner.
- **Sesión:** el operador crea un administrador de prueba en la base de ejemplo con `npm run admin:bootstrap`. Usa `ADMIN_EMAIL=capture@example.com` y una contraseña aleatoria generada en el momento (por ejemplo `[guid]::NewGuid()` en PowerShell), que no se guarda en ningún archivo, y se la pasa al script en `MANUAL_CAPTURE_ADMIN_EMAIL`/`_PASSWORD`. El script entra con `fetch('/api/auth/login')` desde la página, como `a11y:check`. Nunca escribe la contraseña en un campo. La captura del login muestra el formulario vacío y, en otra, el error de credenciales provocado con un email inexistente y una contraseña de relleno que no es de nadie.
- **Sin escrituras:** fuera del login, el script no guarda nada. Los estados que necesitan datos (archivado, alias, protegido, visitas) vienen del seed. Los errores de validación se provocan con *Guardar* sobre un formulario vacío, que valida en el cliente sin pedir nada. Los avisos de cambios sin guardar se abren y se cierran con *Cancelar*. Por eso el script se puede repetir sin volver a sembrar. Las cargas públicas sí registran visitas, y por eso el dashboard es la primera captura del manifiesto.
- **Determinismo:** emula `prefers-reduced-motion: reduce`, espera `document.fonts.ready` y la red en reposo, oculta el cursor de texto y usa siempre el mismo idioma (`?lang=` explícito) y el mismo viewport.
- **Formato:** JPEG con calidad 78. Escritorio en 1280×800 y móvil en 390×844, con `deviceScaleFactor: 1`. El recorte va a la región relevante (`clip` del elemento) cuando la pantalla completa no aporta. Los archivos quedan en `docs/manual/` con el nombre del manifiesto. El HTML las muestra a 800 px de ancho con `width`/`height` reales, como hoy.
- **Dónde corre:** contra cualquier frontend servido cuya API apunte a la base de ejemplo. Se recomienda la imagen de `frontend/Dockerfile`, como en `a11y:check`; `vite dev` con `VITE_PROXY_TARGET` también sirve. No va al CI (ver Non-goals).

Alternativas descartadas:
- **Capturas a mano:** es lo que dejó 27 capturas desfasadas y sin forma de repetirlas.
- **Playwright:** sería una dependencia nueva; `puppeteer-core` ya está y lo usan tres scripts.
- **PNG o WebP:** PNG pesa entre 3 y 5 veces más en pantallas con degradés (`tc32-faltantes.png`: 186 KB). WebP ahorraría más, pero cambiaría la extensión de todas las capturas sin necesidad, porque JPEG 78 ya entra en el tope de D13.

### D12 — Inventario de capturas

**Se renuevan las 27** con la persona ficticia, porque todas muestran el CV real y la base cambia (D9). Además, estas están desactualizadas por el contenido:

| Archivo actual | Caso | Por qué |
|---|---|---|
| `tc19b-formulario.jpg` | TC-19 | Sin *Logros (en)*; se quita la nota de *Limitación actual* |
| `tc19a-experiencias.jpg` | TC-19 | Sin la experiencia oculta marcada como tal |
| `tc12a-perfiles-lista.jpg` | TC-12 | Sin *Duplicar* ni las marcas de archivado y no enumerado |
| `tc16-publicacion.jpg` | TC-16 | Sin *Enumerar*, *Archivado* ni *Link público* |
| `tc12b-identidad.jpg`, `tc13-seleccion.jpg`, `tc14-secciones.jpg` | TC-12 a TC-14 | Vista previa sin el conmutador ES/EN |
| `tc15-tema.jpg` | TC-15 | Anterior a `retire-accent-color`: el acento ahora vive en el tema |
| `tc25-portada.jpg` | TC-25 | Nivel de idioma de un solo idioma (anterior a `localize-language-level`) |
| `tc10-login.jpg` | TC-11 | Anterior al foco visible y al salto al contenido; pasa a `tc11-login.jpg` |
| `tc01`–`tc09`, `tc18`, `tc20`, `tc26`–`tc30` | varios | Persona y base nuevas; la vista pública es anterior al hero en dos tiempos |
| `tc32-faltantes.png` | TC-32 | 186 KB; pasa a `tc32-faltantes.jpg` sobre el perfil `PRIVATE` con el faltante deliberado |

**Nuevas:**

| Archivo | Caso o pantalla | Qué muestra |
|---|---|---|
| `tc11-login-error.jpg` | TC-11 | El error de credenciales |
| `tc17-preview-en.jpg` | TC-17 | La vista previa en EN con un borrador sin guardar |
| `tc21-duplicar.jpg` | TC-21 | El diálogo *Duplicar perfil curado* |
| `tc22-archivado.jpg` | TC-22 | La pestaña Publicación de un perfil archivado |
| `tc23-dirigido.jpg` | TC-23 | Un perfil con *Enumerar* apagado y su link |
| `tc24-alias.jpg` | TC-24 | El perfil renombrado resolviendo desde el slug anterior |
| `tc31-imprimir.jpg` | TC-31 | La hoja con `print` emulado, más el botón *Imprimir / Guardar PDF* |
| `tc33-foco.jpg` | TC-33 | El salto al contenido y el foco visible tras tabular |
| `tc34-acento.jpg` | TC-34 | El perfil con acento `#1A365D` y el acento derivado legible |
| `tc35-movil-hero.jpg` | TC-35 | El hero en 390 px, primer tiempo |
| `tc36-ejemplo-home.jpg` | TC-36 | La home sembrada con el ejemplo y las 9 secciones |
| `bo-portada-idioma.jpg` | Portada | El diálogo de idioma con el nivel en ES/EN |
| `bo-experiencia-errores.jpg` | Experiencias | Los mensajes de validación al guardar vacío |
| `bo-skills-dialogo.jpg` | Skills | Los diálogos de categoría y skill con sus tags |
| `bo-formacion-certificacion.jpg` | Formación | El formulario de certificación con el error de año |
| `bo-enlace-stats.jpg` | Proyectos y enlaces | El enlace social con `stats` inválido |
| `bo-constructor-diseno.jpg` | Constructor · Diseño | El customizador completo: tema base, colores, fuentes, densidad y efectos |

En total serán unas 44 capturas (27 renovadas, una de ellas renombrada, y 17 nuevas). Las pantallas del manual del backoffice reutilizan la captura del caso cuando muestran lo mismo: Dashboard → `tc18`, Perfiles → `tc12a`, Identidad → `tc12b`, Selección → `tc13`, Publicación → `tc16`. TC-10 (códigos HTTP) y TC-37 (negativa del seed) llevan la salida transcrita, sin captura.

### D13 — `npm run manual:check`: la alineación se comprueba, no se promete

`frontend/scripts/check-manual.mjs` (sin navegador, sin base ni dependencias nuevas) falla con código 1 si:

1. Los casos de `MANUAL.md` (encabezados `### TC-nn — Título <estado>`) y los de `index.html` (`<article class="case" id="tcnn" data-status>` con su `<h3>`) difieren en ids, títulos o estado (✅ ↔ `ok`, 🔍 ↔ `part`, ❌ ↔ `fail`). También falla si la tabla de la suite (§ 6) o el índice lateral del HTML no listan exactamente esos casos.
2. Alguna imagen referenciada (`![](manual/…)` o `<img src>`) no existe, o algún `.jpg`/`.png` de `docs/manual/` no está referenciado.
3. Alguna imagen pasa de 150 KB, el total de imágenes de `docs/manual/` pasa de 4 MB o `index.html` pasa de 300 KB.
4. Algún mensaje citado como mensaje de validación (columna *Mensaje* / `td.msg`, D10) no aparece literal en `frontend/src`.
5. Algún `href="#…"` del HTML apunta a un id que no existe.

Corre en el job *Frontend · lint, tipos, tests y build* del CI, después de los tests.

Alternativa descartada: **revisar la alineación a mano en cada PR.** Hoy los dos formatos ya difieren en detalles (la barra dice *"0 de 24"* con 35 casillas) y la regla de *"mismos casos y estados"* depende de la memoria de quien edita.

### D14 — Filtros por área y por change, combinables

Cada `article.case` suma `data-area` (`publica`, `backoffice`, `datos`) y `data-change` (el change que lo introdujo, por ejemplo `add-curated-profile-lifecycle`; los casos de las fases 4 y 5 usan el change de su fase). La barra suma un grupo de chips de área y un `<select>` de change con `<label>` visible. Los filtros de estado, área, change y búsqueda se combinan con *Y*. Un contador con `aria-live="polite"` anuncia cuántos casos quedan, y el mensaje *"Ningún caso coincide"* se mantiene. Las secciones de aprendizaje, recorridos y backoffice no se filtran, pero sí entran en la búsqueda. El filtro activo se recuerda en `localStorage` (con `try/catch`) solo como conveniencia, y sin almacenamiento arranca en *Todos*.

Alternativa descartada: **filtro por la URL (`#?area=`)** — el visor de artifacts aísla la página en un iframe donde el hash ya se resuelve por script (ver *Ir a un caso*); sumar parámetros complica esa lógica sin necesidad.

### D15 — Registro de una corrida, copiado al portapapeles

- Cada caso reemplaza la casilla *ejecutado* por tres opciones (`radio` con `fieldset`/`legend` accesibles): **pasa**, **falla** y **omitido**. Suma una nota opcional de una línea. Se guardan en `localStorage` con las claves `manual-run-<tc>` y `manual-note-<tc>`, siempre con `try/catch`. Una marca `'1'` heredada del formato anterior se lee como *pasa*.
- La barra de progreso cuenta *"n de N con resultado"* y desglosa los tres resultados. Calcula N desde el DOM, así que deja de verse *"0 de 24"* antes del script.
- **Copiar resultado** arma un Markdown con estos datos:
  - la fecha y hora local, en ISO;
  - la base indicada por el lector en un campo libre, por defecto *"base de ejemplo"*;
  - los totales;
  - una tabla `| Caso | Título | Estado documentado | Resultado | Nota |` con todos los casos;
  - los filtros activos, si los hay.

  Usa `navigator.clipboard.writeText`. Si falla (iframe sin permiso), muestra el texto en un `<textarea>` de solo lectura ya seleccionado.
- **Reiniciar corrida** borra resultados y notas.
- Nada sale del navegador. El lector decide dónde pegar el informe, por ejemplo en el `verification.md` de un change o en la descripción de un PR.

Alternativa descartada: **descargar un `.md` con `Blob` y `download`.** Dentro del visor de artifacts, las descargas pueden estar bloqueadas por el sandbox del iframe, y el portapapeles con *fallback* funciona en los dos contextos.

## Risks / Trade-offs

- **Cargar el ejemplo en la base del owner** → D6: tres capas antes de escribir. La 3 mira el contenido y no el nombre. TC-37 lo verifica y los tests del seed cubren cada capa sin base (con el cliente de Prisma simulado).
- **El seed por defecto cambia sin querer** → el requisito ADDED de `data-persistence-seed` lo fija: el CI sigue corriendo `seed` + `seed:verify` sobre `cv-data.json` con los conteos de siempre, y un test compara lo que el seed escribiría desde `cv-data.json` antes y después del cambio.
- **La validación previa rechaza el `cv-data.json` actual** → la tarea 2.2 la ejerce contra el archivo real en un test sin base, antes de conectarla al flujo.
- **El manual crece y el HTML pesa** → topes de D13. El texto del manual del backoffice va en tablas compactas, sin repetir lo que dice la captura.
- **Capturas con ruido entre corridas** (fechas del dashboard, visitas que suman) → D8 fija la forma de las visitas, el dashboard se captura primero y el script se puede limitar con `--only`. No hay comparación píxel a píxel (Non-goals).
- **Los mensajes literales se desactualizan cuando cambia el código** → la regla 4 de `manual:check` lo detecta en el CI.
- **Contraseña del administrador de prueba en el historial de la terminal** → se genera en el momento y solo vale en la base descartable. La guía recomienda definirla en la sesión, sin escribirla en un archivo, y borrar la base al terminar si se quiere.
- **`FeaturedRepository` sin uso confunde al que lee la guía** → la guía la marca como inerte y el ejemplo no le carga filas visibles (Non-goals).

## Migration Plan

No hay migración de esquema ni de datos. Pasos de adopción:

1. Fusionar los grupos 1–3 (seed, ejemplo y guía). El CI ya corre `seed:example` y `seed:example:verify` en una base aparte.
2. Crear la base de ejemplo local (`portfolio_example`) y sembrarla siguiendo la guía.
3. Fusionar el manual, las capturas y el modo prueba.

**Rollback:** revertir el PR. La base del owner no se toca en ningún paso. Si una base de ejemplo queda con datos a medias, se borra (`dropdb portfolio_example`) y se recrea.

## Open Questions

Resueltas por el owner el **2026-10-27**, todas con la opción recomendada. Ya no queda ninguna abierta.

- **P1 — Resuelta (2026-10-27):** los datos de ejemplo son **ficticios** (D2).
- **P2 — Resuelta (2026-10-27):** el directorio es `docs/examples/` (D2).
- **P3 — Resuelta (2026-10-27):** se renuevan **todas** las capturas, públicas y del backoffice, desde la base de ejemplo (D9, D12).
- **P4 — Resuelta (2026-10-27):** `manual:check` **sí** entra al CI, en el job de frontend (D13).
- **P5 — Resuelta (2026-10-27):** proteger también el `npm run seed` por defecto (sobre una base con contenido editado desde el panel) queda **fuera de alcance** y se hará en un change aparte. Este change solo protege la carga con `--file`.
- **P6 — Resuelta (2026-10-27):** el ejemplo **sí** lleva visitas sintéticas (D8).
