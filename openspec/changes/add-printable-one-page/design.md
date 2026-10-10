# Design — add-printable-one-page

## Context

Ver `proposal.md`. Esto es lo que el código decide hoy (verificado el 9 de octubre de 2026 en `main`, `a5de8cd`).

**Vista pública.** `/` (`HomePage` → `CuratedProfileView slug="all"`) y `/:slug` comparten `CuratedProfileView`. La vista arma `ThemeProvider`, que pone los tokens `--t-*` como `style` del contenedor raíz con `min-h-screen bg-bg`. Adentro van una capa `fixed` con `bg-glow`, un `TopBar` `sticky` con `glass`, `main` con el layout (`ClassicLayout` o `SidebarLayout`, que recorren `sections` tal como llega) y un `Footer`. Los estados son `loading`, `needsToken`, `notFound`, `error` y `success`, y el layout solo se renderiza en `success`. El backend ya aplicó a `sections` el orden, el ocultado, el relleno y el descarte de secciones vacías (spec `layout-engine`). El cliente no decide nada de eso.

**Impresión hoy.** No hay ninguna regla `@media print`, ninguna variante `print:` ni ningún `@page` en `frontend/src`. Lo que pasa al imprimir:

| Problema | Dónde | Efecto en papel |
|---|---|---|
| Paleta oscura por defecto (`modern-dark`) | `theme.css` `:root` y tokens del perfil | Sin "gráficos de fondo", texto `#e8edf5` sobre blanco: ilegible. Con fondos, una hoja azul oscuro entera |
| Texto con degradé recortado | `Hero` (`bg-clip-text text-transparent`), `Stats` y `Presence` (`text-gradient`) | El texto es `transparent` y el fondo no se imprime: el nombre del hero desaparece |
| `MotionSection` con `initial={{ opacity: 0, y: 20 }}` y `whileInView` | `themes/motion-section.tsx`, que usan las 9 secciones | Motion escribe `opacity: 0` inline y solo lo cambia cuando el `IntersectionObserver` ve la sección. Imprimir no hace scroll ni dispara el observer: lo que no se vio sale en blanco. Solo se salva con `effects.animations = false` o `prefers-reduced-motion` |
| `min-h-screen` en el contenedor raíz y en el envoltorio de la vista | `theme-provider.tsx`, `CuratedProfileView.tsx` | En impresión `100vh` es el alto de la página: puede agregar una hoja en blanco |
| Barra `sticky`, capa `fixed`, selectores de tema, layout e idioma, menú de perfiles | `TopBar`, `CuratedProfileView` | Se repiten o se imprimen como controles muertos |
| Tarjetas, chips, sombras y `hover:` | todas las secciones | Muchísimo espacio por dato |

**Volumen real** (`docs/cv-data.json`): 15 experiencias (entre 2 y 12 logros cada una, de 6 a 29 tecnologías), 12 categorías de skills, 6 formaciones, 8 certificaciones, 2 proyectos y 13 plantillas de perfil curado. `tech-lead-dotnet` resuelve 13 experiencias.

**Borde.** `frontend/Caddyfile` sirve la SPA con una CSP en *enforce*: `script-src 'self'` sin `'unsafe-inline'`, `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`, `img-src 'self' data:` y `connect-src 'self'` (spec `site-security-policy`). Cualquier cosa nueva tiene que salir del bundle.

**Herramientas.** El frontend no tiene Puppeteer ni Playwright. El Chrome del sistema está en `C:\Program Files\Google\Chrome\Application\chrome.exe`, y los runners `ubuntu-latest` de GitHub traen Google Chrome. Vitest corre en jsdom, que no compagina ni aplica `@media print`.

**El "export a PDF del checklist".** Es el ítem 🔵 *Export PDF de perfil. Generar un PDF del perfil curado.* de `docs/RELEASE-1.0.0-CHECKLIST.md`, que la Fase 6 dejó como deseable de 1.0.x (`STEPS.md`, prompt de la Fase 6). `docs/I18N.md` § 8 fija la condición: el mismo `locale` alimenta un único motor de plantilla, bajo demanda y sin archivos duplicados.

## Goals / Non-Goals

**Goals:** que imprimir un perfil curado (con el botón o con Ctrl+P) dé **una hoja legible** en A4 y en Letter, en el idioma de la vista y con cualquier tema; que respete lo que el perfil decidió mostrar; que lo omitido se diga y no se pierda en silencio; que "cabe en una hoja" se compruebe con una herramienta y no a ojo; que todo esto salga sin dependencias de runtime, sin tocar backend ni CSP y sin registrar nada.

**Non-Goals:** ver `proposal.md` § Non-goals.

## Decisions

### D1 — Una hoja dedicada dentro del mismo documento, visible solo al imprimir

En el estado `success`, `CuratedProfileView` monta `<PrintableSheet data={…} locale={…} />` como hermano del layout de pantalla. La hoja lleva `hidden print:block` y `data-print-sheet`. El envoltorio de pantalla (barra, capa de brillo, `main` con el layout, pie) lleva `print:hidden`. En pantalla la hoja no existe para el usuario ni para los lectores de pantalla, porque `display: none` la saca del árbol de accesibilidad. Al imprimir es lo único que hay.

Así Ctrl+P y el botón dan exactamente lo mismo, sin escuchar `beforeprint`: la hoja ya está en el DOM. No hay ruta nueva ni pedido nuevo a la API, porque reusa el `CuratedProfile` ya cargado. Y no depende del layout ni de las secciones de pantalla.

Alternativas descartadas:

- **(a) Solo una hoja de estilos `@media print` sobre los layouts actuales.** Es lo más barato en archivos, pero obliga a pelear con dos layouts por cinco presets por nueve secciones de tarjetas, chips y degradés a fuerza de `!important`. Además, el truncado con `:nth-child` no puede decir *"y 6 más"* y no se puede probar en Vitest. Cualquier cambio visual de pantalla rompería la impresión sin que nadie lo note.
- **(b) Una ruta o un parámetro propios (`/:slug/imprimir`, `?print=1`).** Ctrl+P sobre la vista normal seguiría saliendo mal, que es justamente el caso más común. Suma un estado de URL más, que hay que excluir del canonical, del sitemap y del registro de visitas, y una visita más si se abre en otra pestaña.
- **(c) Generar el PDF en el servidor** (Puppeteer o Chrome en la API, o una librería de PDF). Necesita un Chrome en el contenedor de Railway o una dependencia pesada, un endpoint nuevo con su rate limit y su caso PROTECTED, y una segunda plantilla en el backend que divergiría de la vista. Es desproporcionado para un change de esfuerzo S. *Guardar como PDF* del navegador da el mismo archivo.

### D2 — La selección es una función pura con los límites en un solo módulo

`features/curated-view/print/print-sheet.ts` exporta `PRINT_LIMITS` (constantes) y `buildPrintSheet(data: CuratedProfile, locale: Locale, origin: string): PrintSheetModel`. El modelo trae el encabezado, los bloques en orden, los recortes ya aplicados con su cuenta de omitidos y la URL de la versión en línea. `PrintableSheet` solo renderiza el modelo y no decide nada.

La razón es que Vitest no puede compaginar, pero sí probar sin navegador qué entra, en qué orden y qué se cuenta como omitido. El conteo de páginas queda para D11.

Alternativa descartada: recortar con CSS (`line-clamp`, `:nth-child(n+4) { display: none }`). No permite contar lo omitido ni probarlo, y oculta datos en el DOM impreso sin avisar. `line-clamp` sí se usa, pero solo como segunda red para textos largos (D3).

### D3 — Qué entra y en qué orden

**Encabezado (siempre).** Es la identidad, y sin ella la hoja no sirve. Lleva:

- `profile.fullName`;
- el titular (`data.headline` o, si falta, `profile.headline`);
- la `description` del perfil curado, salvo en `all`, como en el hero, recortada a 2 líneas;
- una línea de contacto con email, ubicación y la URL de LinkedIn si existe, como hace el hero en pantalla.

**Bloques, en el orden de `data.sections`** (el orden y el ocultado ya los resolvió el backend):

| Sección | En la hoja |
|---|---|
| `hero` | Bloque *Perfil*: `profile.summary`, a 4 líneas como máximo |
| `experience` | Las primeras **3** experiencias en detalle: rol, empresa, período, ubicación, hasta **2** logros (2 líneas cada uno) y hasta **8** tecnologías en una línea de texto. Después, hasta **3** en una línea (`período · rol — empresa`). Si quedan más, *"y N experiencias más"*. El orden es el canónico de la API (cronológico descendente) |
| `skills` | Hasta **3** categorías, `Categoría: a · b · c`, con hasta **10** skills (8,5 pt, hasta 2 líneas cada una) |
| `projects` | Hasta **2**, una línea cada uno: nombre, rol, resumen recortado y URL si tiene |
| `education` | Hasta **3**, una línea cada una: título, institución, período y la marca *en curso* |
| `certifications` | Hasta **4**, en línea y separadas por ` · ` (nombre, emisor, año), a 2 líneas como máximo |
| `contact` | No va como bloque: suma al encabezado teléfono, idiomas (`nombre · nivel`) y disponibilidad (modalidad, contratación y fecha de inicio) |
| `stats` | No se imprime: son números decorativos derivados de lo que ya está en la hoja |
| `presence` | No va como bloque: suma al encabezado las URL de los enlaces `featured`, hasta 2, además de LinkedIn |

Lo oculto u omitido por el backend no aparece en la hoja: si `sections` no trae `experience`, no hay bloque de experiencia. La excepción es el encabezado, que siempre está. Su contenido sigue la misma regla que el hero de pantalla: nombre, titular, email y ubicación siempre, y lo que aporta `contact` solo si `contact` figura en `sections`.

**Maquetación.** Una sola columna de contenido, con la etiqueta de cada bloque en una columna angosta a la izquierda (≈ 28 mm). Así se ahorra una línea de título por bloque sin romper el orden de lectura. El cuerpo va a 9,5 pt con interlineado 1,3; el nombre, a 18 pt.

Los números en **negrita** son los límites de `PRINT_LIMITS`, calculados contra la caja de D5 con el volumen real. Si `print:check` (D11) demuestra que algún perfil de la base de verificación no cabe, se bajan en este orden: experiencias en una línea, categorías de skills, logros por experiencia. Y se actualizan a la vez la spec y esta tabla (Human Gate: se corrige la spec, no solo el código).

**Ajuste del 2026-10-09 (tarea 4.3).** Los valores iniciales (6 experiencias en una línea, 6 categorías de skills, 3 logros por experiencia) daban dos páginas en los 14 perfiles de la base de verificación: la hoja de `tech-lead-dotnet` medía 1170 px contra los 965 px de alto útil de Letter (con el ancho de A4, 703 px). Se aplicó el procedimiento de arriba, que bajó los tres a **3**, **3** y **2**, y fue suficiente: no hizo falta tocar las experiencias en detalle, las tecnologías ni los demás bloques. El peor perfil mide 943 px (22 px de margen en Letter). Además, la lista de skills pasó a 8,5 pt y los bloques a un relleno vertical menor; el cuerpo sigue en 9,5 pt. La medición está en `verification.md`.

Alternativa descartada: dos columnas (experiencia a la izquierda, skills, formación y contacto a la derecha). Entra más, pero el orden de `sections` deja de tener sentido y la hoja diverge del perfil que el owner armó.

### D4 — Truncado explícito y desborde sin recorte

Cada recorte de cantidad deja una línea de omitidos en el idioma de la vista (*"y 6 experiencias más"*, *"and 6 more roles"*), y el pie de la hoja trae *"Versión completa: <URL>"* (D8). Los recortes de longitud (`line-clamp`) terminan en elipsis.

Si aun así el contenido no cabe (datos fuera de lo verificado), **la hoja sigue en una segunda página**. Cada entrada lleva `break-inside: avoid` y ningún bloque se corta a la mitad de un renglón. No hay `overflow: hidden` ni escalado.

Alternativas descartadas:

- **(a) `overflow: hidden` con alto fijo.** Recorta en silencio, y el lector nunca sabe que faltaba algo.
- **(b) Escalar la hoja con `transform: scale()` o `zoom` hasta que entre.** Con mucho contenido da letra de 6 pt. La legibilidad es el objetivo, no la cantidad de hojas.

### D5 — La caja de diseño es la intersección de A4 y Letter

`@page { margin: 12mm; }`, sin `size`: el usuario o el driver eligen el papel. La hoja se diseña para el ancho útil de A4 (210 − 24 = 186 mm) y el alto útil de Letter (279,4 − 24 ≈ 255 mm). Lo que cabe ahí cabe en las dos.

Los encabezados y pies que agrega el navegador (fecha, URL, título) dependen de una opción del diálogo de impresión. El manual indica desactivarlos, pero no se fuerzan con `@page { margin: 0 }`: si hubiera una segunda página, quedaría sin margen superior.

Alternativa descartada: `size: A4`. Obliga a un papel y en Letter recorta o reescala.

### D6 — Paleta de papel fija y tipografía del perfil

`themes/presets/paper.ts` define los colores de papel: fondo blanco, tinta `#111`, atenuado `#444`, bordes `#bbb`. Están en `presets/` para respetar la regla de `theme.css` de que los colores literales no salen de esa carpeta. **No** se suma a la lista de presets conmutables ni a `findPreset`.

La hoja aplica esos colores como `--t-*` en su propio contenedor, con `tokensToCssVars` sobre una copia de los tokens activos con los colores reemplazados. Hereda del perfil la tipografía (`fontSans`, `fontHeading`, ya cargadas por `ensureFontLoaded`) y el radio. El acento del perfil se usa **solo** en la línea decorativa bajo el encabezado, nunca en texto, porque el acento de varios presets no contrasta sobre blanco: `modern-dark` tiene `#38bdf8`, que da ≈ 2:1.

En impresión, `html`, `body`, el contenedor raíz de `ThemeProvider` y el envoltorio de la vista pierden el fondo (`background: transparent`) y el `min-height`, y la hoja no usa degradés, sombras, `glass` ni texto recortado. El resultado es legible con "gráficos de fondo" activado o no, y no hay hoja en blanco por `100vh`.

Alternativas descartadas:

- **(a) Respetar el tema del perfil al imprimir.** Con `modern-dark` da texto claro sobre papel blanco, o una hoja entera de tinta oscura si se imprimen fondos.
- **(b) `filter: invert()` en impresión.** Invierte también los acentos y las fuentes de colores, y no arregla el texto recortado con degradé.
- **(c) Forzar `modern-light`.** Es conmutable y editable, y su acento tampoco garantiza contraste.

### D7 — Las animaciones no pueden ocultar contenido impreso

El riesgo es real, y se verificó leyendo `motion-section.tsx`: con `animationsEnabled`, cada sección arranca con `opacity: 0; transform: translateY(20px)` inline y solo pasa a visible cuando el `IntersectionObserver` de `whileInView` la ve (`once: true`). Imprimir no dispara ese observer.

Dos medidas:

1. **La hoja no usa `MotionSection` ni ningún componente de `motion`.** Es HTML estático y siempre visible.
2. **Regla defensiva en `@media print`:** `[data-motion="on"] { opacity: 1 !important; transform: none !important; }`. El `!important` de una hoja de estilos le gana al estilo inline sin `!important` que escribe Motion. Hoy el layout de pantalla queda oculto al imprimir, pero la regla protege cualquier uso futuro de `MotionSection` en algo que sí se imprima.

Alternativa descartada: desactivar las animaciones en `beforeprint` y reactivarlas en `afterprint`. Depende de que React vuelva a renderizar antes de que el navegador compagine, y no está garantizado en todos los navegadores.

### D8 — Enlaces como texto visible, URL canónica sin token y sin QR

El email, el teléfono, LinkedIn y los enlaces `featured` se imprimen como texto: el dominio y la ruta, sin `https://` ni `mailto:`. Siguen siendo `<a>`, así que en el PDF son clicables. El pie trae la URL de la versión en línea: el `canonical` de `metaFromProfile` más `?lang=<locale>` cuando el locale no es `es`. **Nunca** lleva `token`, `theme` ni `layout`: el papel y el PDF circulan más allá de quien recibió el link, y un token impreso es un acceso que no se puede revocar sin rotarlo.

Sin QR: generarlo exige una librería (≈ 10–20 KB) o un codificador escrito a mano, y en un PDF la URL ya es clicable.

Alternativa descartada: imprimir la URL tal como está en la barra de direcciones. Filtraría `?token=` y arrastraría `?theme=` o `?layout=`, que no tienen sentido en papel.

### D9 — Botón en la barra superior, solo con el perfil resuelto

`TopBar` recibe una prop opcional `onPrint`. Si viene, muestra un botón con el icono `Printer` de Lucide y la etiqueta *"Imprimir / Guardar PDF"* / *"Print / Save as PDF"*: el texto se ve desde `md` y en móvil queda solo el icono, con `aria-label`. `CuratedProfileView` le pasa `onPrint` **solo en `success`**: en carga, token pendiente, 404 o error no hay nada que imprimir.

La acción es `window.print()`, llamada desde un manejador de React en el bundle: no hay script inline y la CSP no cambia. La barra completa lleva `print:hidden`. Ctrl+P funciona igual por D1.

Visibilidad: en **todos** los perfiles resueltos, públicos, `PROTECTED` con token válido y la home (P1 = A, resuelta el 2026-10-09).

Alternativa descartada: un botón flotante sobre el contenido. Tapa contenido en móvil y es un patrón ajeno al resto de la vista.

### D10 — Imprimir no registra nada ni cambia el head

Imprimir no hace ningún pedido: la hoja usa los datos ya cargados, y la visita ya se registró al resolver el perfil (spec `profile-view-analytics`, en segundo plano desde `polish-builder-and-edge`). No se agregan listeners de `beforeprint` ni endpoint de métricas.

El `document.title` (`<título del perfil> · <nombre>`, de `metaFromProfile`) queda como está. Es el nombre de archivo que el navegador propone al guardar el PDF, y ya identifica a la persona y el rol.

Alternativa descartada: contar las impresiones. Necesita un endpoint, una tabla o un campo nuevo y su rate limit, y mide algo que no cambia ninguna decisión. Queda para cuando haya una pregunta de producto que lo pida.

### D11 — "Cabe en una hoja" se verifica con un PDF real

Tres niveles:

1. **Vitest (CI):**
   - `print-sheet.spec.ts`: límites, orden según `sections`, secciones ocultas, cuentas de omitidos, encabezado con y sin `contact`, URL sin `token`, `theme` ni `layout` y con `?lang=en`.
   - `PrintableSheet.test.tsx`: la hoja lleva `hidden print:block`, no contiene `data-motion` y no tiene clases `text-transparent` ni `text-gradient`.
   - Test de la vista: el envoltorio de pantalla lleva `print:hidden`; el botón está solo en `success`; el clic llama a `window.print` y no hace ningún pedido, con MSW contando las peticiones.
2. **`npm run print:check` (local):** `frontend/scripts/check-print-pages.mjs`, con la devDependency `puppeteer-core` (no descarga navegador) y `CHROME_PATH` hacia el Chrome del sistema. Recibe la URL base (por defecto `http://localhost:5173`). Pide el listado público, suma `all` y los slugs con token que se pasen por variable de entorno. Para cada perfil, en `es` y `en`, en A4 y Letter, con el tema del perfil y además con `?theme=modern-dark&layout=sidebar`:
   - espera `[data-print-sheet]`;
   - genera `page.pdf({ format, printBackground: false })`, respetando el `@page`;
   - cuenta las páginas del PDF;
   - con `emulateMediaType('print')`, comprueba que el contraste del texto de la hoja contra blanco sea ≥ 4,5:1.

   Sale con código distinto de 0 si algún caso da más de una página o no contrasta, e imprime una tabla perfil × idioma × papel → páginas.
3. **Manual:** TC-31 del manual, con capturas del diálogo de impresión en Chrome y en Firefox.

Alternativas descartadas:

- **(a) Medir alturas en jsdom.** jsdom no hace layout.
- **(b) Chrome en modo headless por CLI (`--print-to-pdf`).** No tiene dependencias, pero no deja elegir el papel ni esperar un selector.
- **(c) Sumar Playwright.** Duplica con `puppeteer-core` sin ventaja para un único script.

### D12 — El *Guardar como PDF* del navegador cubre el ítem del checklist

La hoja cumple lo que pide `docs/I18N.md` § 8: un único motor de plantilla (la hoja), bajo demanda, en el idioma pedido (`?lang=`) y desde los mismos datos, sin archivos guardados. Por eso, este change propone marcar como resuelto el ítem *Export PDF de perfil* de `docs/RELEASE-1.0.0-CHECKLIST.md`, con la aclaración de que el PDF lo genera el navegador (P4 = A, resuelta el 2026-10-09). Un PDF generado en el servidor, como un endpoint de descarga o un adjunto automático, queda fuera de alcance y como posible change futuro si algún caso lo exige.

Alternativa descartada: dejar el ítem abierto hasta tener PDF en el servidor. Dejaría pendiente para siempre algo que el usuario ya puede hacer en dos clics.

## Risks / Trade-offs

- **Diferencias entre navegadores.** Chrome, Edge, Firefox y Safari compaginan distinto: márgenes mínimos del driver, `line-clamp` y `break-inside`. → `print:check` corre en Chrome. TC-31 suma Firefox a mano, y la caja de D5 deja aire porque se calcula contra el papel más chico en cada dimensión.
- **Los límites no garantizan una hoja con cualquier dato.** Un logro de 600 caracteres o un nombre de empresa larguísimo pueden empujar el contenido. → `line-clamp` como segunda red, desborde ordenado a una segunda página (D4) y `print:check` en cada cambio de contenido relevante.
- **Contenido duplicado en el DOM.** La hoja repite texto que ya está en pantalla, con `display: none`. Los buscadores renderizan CSS y el contenido oculto que repite al visible no se considera engañoso. El costo de render es de unos pocos nodos más por vista.
- **Pérdida de información en papel.** Por diseño, la hoja omite experiencias, skills y certificaciones. → Lo omitido se cuenta y se ofrece la URL completa (D4, D8). Qué es imprescindible lo decidió el owner (P2 = A).
- **`puppeteer-core` como devDependency nueva.** No va al bundle ni a producción. Si el Chrome del sistema cambia de versión, la API de `page.pdf` es estable.
- **Encabezados y pies del navegador.** Si el usuario los deja activados, ocupan parte del margen. Con 12 mm entran sin pisar la hoja, y el manual indica desactivarlos.

## Migration Plan

Sin migraciones ni cambios de contrato. Es un despliegue normal del servicio `web`, y el rollback es volver a la imagen anterior. La CSP de `frontend/Caddyfile` no cambia, pero la tarea 6.4 lo comprueba en el contenedor.

## Decisiones resueltas del owner (2026-10-09)

El owner respondió las cuatro preguntas con la opción recomendada. Ninguna cambia el diseño: confirman los valores por defecto que ya implementaban D3, D8, D9 y D12.

1. **P1 — Quién ve el botón: (A).** Todos los perfiles resueltos, incluida la home (D9). Ctrl+P funciona igual en todos los casos, así que ocultar el botón no protege nada.
2. **P2 — Qué es imprescindible: (A).** Los límites de D3: 3 experiencias en detalle y 6 en una línea, 6 categorías de skills, 2 proyectos, 3 formaciones y 4 certificaciones. Se ajustan después con `print:check`, siguiendo el orden de D3. Quedaron en 3 experiencias en detalle y 3 en una línea, 3 categorías de skills, 2 logros por experiencia, 2 proyectos, 3 formaciones y 4 certificaciones (ajuste de la tarea 4.3, ver D3).
3. **P3 — URL impresa de un `PROTECTED`: (A).** Nunca lleva el token (D8): el lector del papel pide acceso. Un token impreso no se puede retirar sin rotarlo.
4. **P4 — Cierre del ítem del checklist: (A).** Este change cierra *Export PDF de perfil* de `docs/RELEASE-1.0.0-CHECKLIST.md`, aclarando que el PDF lo genera el navegador (D12).

## Open Questions

- **CI para `print:check`.** Necesita la API con datos (el job de e2e ya levanta Postgres con seed) y el frontend servido. Es técnicamente viable en `ubuntu-latest`, pero suma minutos a cada PR. Queda como follow-up, a proponer después de ver cuánto tarda localmente. No es pregunta para el owner salvo que quiera adelantarlo.