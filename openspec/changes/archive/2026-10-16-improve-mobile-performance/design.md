# Design — improve-mobile-performance

## Context

Ver `proposal.md` y `audit/README.md`. Estado de partida (código del PR #30, change `improve-a11y-and-performance`, sin archivar):

- **Medida que importa.** El runner de GitHub (`benchmarkIndex` ≈ 1.800, el equipo de referencia de Lighthouse) da medianas de 71 / 76 / 75 en las tres páginas que mide `perf:check`, con TBT 300–400 ms y LCP ≈ 3,8 s. El CI exige ≥ 70 (D17 del change anterior). La máquina local (≈ 4.200) infla el puntaje; Windows además infla el *Layout*.
- **Arranque.** `main.tsx` monta con `createRoot().render()` síncrono. `vite.config.ts` parte el arranque con `manualChunks` en `index`, `react` y `query` (179 KB gzip, tres archivos por HTTP/1.1 en el CI). El `AppProviders` envuelve todo en `TooltipProvider`, que ningún componente usa hoy.
- **Datos.** `useCuratedProfile` (TanStack Query) pide `GET /api/curated-profiles/:slug?locale=` recién cuando corre la app; con `placeholderData` conserva el perfil anterior al cambiar idioma o token del mismo slug. El cliente es `openapi-fetch` con `credentials: 'include'` y un `fetch` que se resuelve por llamada.
- **Vista.** `CuratedProfileView` renderiza `ProfileLayout` con todas las secciones de golpe. `MotionSection` (ocho secciones; el hero ya no anima por D7 del change anterior) usa `React.lazy` de `animated-section.tsx` (`LazyMotion` + `m.section`): al llegar el chunk, el `Suspense` cambia el *fallback* por el componente y remonta el contenido. El preview del constructor (`PreviewPanel`) reusa `ProfileLayout` y `MotionSection`.
- **Barra.** `TopBar` importa de forma estática `ThemeSwitcher` (Radix `DropdownMenu`) y `ProfileMenu` (`DropdownMenu` en escritorio y `Sheet` en móvil, solo en la home): Radix y Floating UI viajan en el arranque.
- **Tipografía.** `index.html` precarga la hoja de Inter de Google Fonts (D9 del change anterior) con `preconnect` a dos orígenes; `fonts.ts` inyecta la hoja de cualquier familia de Google, Inter incluida. La CSP ya permite `font-src 'self'`.
- **Borde.** Caddy sirve `/assets/*` con `Cache-Control: public, max-age=31536000, immutable` y el resto con `no-cache`; HTTP/1.1 sin TLS en el CI y detrás del borde de Railway (que habla HTTP/2 con el navegador).
- **Layout `sidebar`.** La grilla declara columnas solo desde `lg`; en móvil el ancho de la columna implícita depende del contenido.

## Goals / Non-Goals

**Goals:** Performance mobile ≥ 85 por mediana de 5 en el runner de GitHub en las tres páginas de `perf:check`, con el umbral del CI subido a 85; un arranque de un solo archivo y un presupuesto que fije lo ganado; sin regresiones de accesibilidad, CSP, theming ni impresión; todo con tests.

**Non-Goals:** ver `proposal.md` § Non-goals.

## Decisions

### D1 — El perfil se revela en dos tiempos: hero primero

Cuando `CuratedProfileView` recibe el perfil por primera vez en su montaje, renderiza solo la sección `hero` (con el resto del `sections` de la API intacto, solo filtrado para el render) y, debajo, un relleno `aria-hidden` de alto de pantalla (`min-h-screen`) para que el pie no se mueva. En el mismo efecto, dentro de `startTransition`, marca la vista como **revelada** y React renderiza el resto de las secciones en una transición, interrumpible. La lógica vive en un hook propio de la vista (p. ej. `useStagedSections(sections, ready)`), no en los layouts.

- **Una vez revelada, no vuelve atrás** mientras dure el montaje: cambiar de idioma (que conserva el perfil anterior con `placeholderData`), de tema, de layout o pasar de un slug a otro dentro de `/:slug` (mismo componente) renderiza todas las secciones de una. Ir de `/` a `/:slug` es otra ruta y otro montaje: vuelve a revelarse en dos tiempos, que es barato y correcto.
- **El preview del constructor no cambia**: `PreviewPanel` usa `ProfileLayout` directo con todas las secciones; el hook vive en `CuratedProfileView`.
- **Los estados terminales** (`notFound`, `needsToken`, `error`) no pasan por el revelado.
- **Impresión:** la hoja (`PrintableSheet`) no depende del revelado; se monta con los datos, como hoy.

Medido: TBT del proxy rápido 300 → ≈ 160 ms.

Alternativas descartadas:
- **Montar cada sección al entrar en pantalla** (`IntersectionObserver`): baja más el trabajo inicial, pero el contenido fuera de pantalla no existe en el DOM: rompe la búsqueda en la página, los anclas `#experience`, los lectores de pantalla que recorren el documento y la impresión.
- **Sin relleno:** el pie sube hasta el hero y baja al revelarse; es un desplazamiento de diseño visible y medible (CLS).

### D2 — El render del perfil es interrumpible

- `useCuratedProfile` devuelve los datos a través de `useDeferredValue(query.data)`: el render que depende del perfil pasa a prioridad de transición en vez de la notificación síncrona de `useSyncExternalStore`. Mientras el valor diferido no llegó, el estado sigue siendo `loading` (esqueleto).
- `main.tsx` hace `root.render(...)` dentro de `startTransition`, así el primer render de la app también puede ceder el hilo.
- `MotionSection` agrega `content-visibility: auto` y `contain-intrinsic-size: auto 640px`: el navegador no hace *layout* ni *paint* de las secciones fuera de pantalla (el *Layout* de ≈ 1.700 objetos pasa a ser el del primer pliegue). `auto` en el tamaño intrínseco recuerda la altura real una vez renderizada, así la barra de desplazamiento se estabiliza. El hero no lo lleva: es el LCP.

Medido, junto con D1: TBT del proxy rápido → 0 y Performance 93.

Alternativas descartadas:
- **Trocear a mano con `setTimeout`/`scheduler.yield`:** reimplementa lo que React ya hace con las transiciones y queda acoplado al orden de las secciones.
- **`structuredClone`/memo de los datos para abaratar el render:** el costo no está en los datos sino en crear y medir el DOM.

### D3 — Menús de la barra en diferido, con disparador idéntico

`ThemeSwitcher` y `ProfileMenu` (Radix `DropdownMenu`, `Sheet` y Floating UI) salen del arranque y se cargan con `import()` dinámico detrás de un componente genérico de la barra (p. ej. `DeferredMenu`), que reutiliza `lazyWithPreload` (extendido para recibir props).

- **Disparador idéntico mientras tanto:** el arranque renderiza un `Button` con la misma variante, tamaño, ícono, texto, `aria-label`, `title`, `aria-haspopup="menu"` y `aria-expanded="false"` que el disparador real (en `ProfileMenu`, los dos: el de escritorio y el de móvil). Un test compara los atributos accesibles de los dos para que no diverjan.
- **Cuándo cargan:** (a) cuando la vista terminó de revelarse (D1) o llegó a un estado terminal, en el primer momento ocioso después del evento `load` (`requestIdleCallback` con un tope de 2 s, o `setTimeout` donde no exista); o (b) antes, en cuanto el visitante muestra intención sobre el disparador: `pointerenter`, `pointerdown` o `focus`. Una sola carga por módulo (la promesa se comparte).
- **Activación antes de que cargue:** un clic o `Enter`/`Espacio`/`ArrowDown` sobre el disparador provisional deja pedida la apertura; al montarse, el menú real abre (`open` controlado al montar) y Radix mueve el foco al contenido, como si el módulo hubiera estado desde el principio.
- **Foco al intercambiar:** si el disparador provisional tiene el foco cuando llega el real, el foco pasa al disparador real en el mismo commit (por `ref`), sin perder la posición en el orden de tabulación ni anunciar un cambio.
- **Si la carga falla** (chunk inaccesible tras un deploy): el disparador provisional sigue ahí y la próxima activación reintenta; nunca escala al *error boundary* de la vista.
- `TooltipProvider` sale de `AppProviders` y pasa a la raíz del panel (`BackofficeApp`): ningún componente público usa tooltips.

Medido: arranque 179 → 150 KB gzip.

Alternativas descartadas:
- **Cargar al montar (sin esperar al revelado):** el chunk compite por ancho de banda con el perfil y el LCP (≈ 0,16 s medidos).
- **Menú propio sin Radix:** sacaría la dependencia del todo, pero reescribir el manejo de foco, teclado y `aria` que hoy da Radix (y que el change anterior verificó) es más riesgo que diferirlo.
- **Esqueleto en lugar del disparador:** cambia el aspecto de la barra y, con foco de teclado encima, el elemento enfocado desaparecería.

### D4 — Un único chunk de arranque con `codeSplitting.groups` de Rolldown

`vite.config.ts` reemplaza `manualChunks` por `build.rollupOptions.output.codeSplitting: { groups: [{ name: 'app', tags: ['$initial'] }] }` (Rolldown, Vite 8.2.2): todo lo que el *entry* importa de forma estática queda en un solo archivo; lo que se importa con `import()` (panel, menús, animación) sigue en sus chunks. `dist/index.html` queda con un `<script type="module">` y ningún `modulepreload`.

- **Por qué en el CI:** el sitio se mide por HTTP/1.1 (Caddy sin TLS, igual que en Lantern) y cada chunk crítico paga su petición en la simulación. Medido: FCP 2,1 → 1,9 s.
- **En Railway:** el borde habla HTTP/2 con el navegador, así que el efecto real es menor (sin colas de conexión); queda el ahorro de no descubrir los chunks en serie. El costo es de caché: un deploy invalida el archivo entero (≈ 147 KB) en vez de solo el de la app (≈ 60 KB). Para un portafolio con pocas visitas repetidas, se acepta.

Alternativas descartadas:
- **Mantener `manualChunks`:** tres peticiones críticas; además Rolldown lo trata como compatibilidad.
- **HTTP/2 en el CI (h2c o TLS local):** Chrome no habla h2c y un certificado propio en el runner mide algo distinto del borde de Railway.

### D5 — Petición temprana del perfil, entregada al cliente: una petición, una visita

Un script clásico mínimo, `frontend/public/profile-prefetch.js`, cargado con `<script src="/profile-prefetch.js" async>` en el `<head>`, pide el perfil mientras se descarga el bundle. **No comparte módulos con el bundle** (no importa nada) y se escribe en JavaScript con `// @ts-check` y JSDoc, incluido en el `tsc -b` y en `eslint .`.

- **Misma petición que haría la app:** solo en `/` (slug `all`) y en `/:slug` de un segmento (con o sin `/` final, decodificado como `useParams`); nunca en `/admin` ni `/admin/*`, ni en rutas de más de un segmento. Locale: `?lang=` si es `es` o `en`, si no `navigator.language` (`en*` → `en`, resto → `es`). Token: `?token=` no vacío → cabecera `X-Access-Token`; vacío → sin token. URL `GET /api/curated-profiles/{slug}?locale=` con `credentials: 'include'`. Un `decodeURIComponent` inválido o cualquier excepción: no pide nada.
- **Entrega:** deja `window.__portfolioEarlyProfile = { key, response }`, con `key = JSON.stringify([slug, locale, token])` y `response` la promesa de `fetch` (con un `catch` vacío para no dejar rechazos sin manejar). `fetchCuratedProfile` la toma **una sola vez** (borra la global al tomarla) y solo si la clave coincide exactamente con la de la consulta y la API es del mismo origen (`API_BASE_URL === ''`); se la pasa a `openapi-fetch` con su opción `fetch` por petición, así el parseo, `unwrap` y los errores (`401`, `404`, red) son los de siempre. Un reintento de TanStack Query ya no la encuentra y pide de nuevo, como hoy.
- **Paridad verificada:** un test de Vitest ejecuta el script en jsdom sobre una matriz de URLs y `navigator.language` y compara la clave con la que arma la app (`readUrlState`, `detectLocale`, el slug del router); otro comprueba que una carga de la vista produce **una** sola llamada a `fetch` para el perfil.
- **Caché:** el nombre no lleva hash, así que queda con el `Cache-Control: no-cache` por defecto del `Caddyfile`, sin cambios. Es deliberado: un script viejo en caché con una lógica de clave distinta de la app nueva haría que la app no lo tome y pida otra vez (visita doble).
- **CSP:** script del propio origen, sin inline: `script-src 'self'` alcanza.

Medido: una sola petición; LCP 2,9 → 2,76 s (proxy rápido) y 2,2–2,5 s (proxy lento).

Alternativas descartadas:
- **`<link rel="preload" as="fetch">`** (ya descartado por D8 del change anterior): no puede llevar `X-Access-Token` y el navegador solo lo reutiliza si modo, credenciales y cabeceras coinciden exactamente; si no, cuenta doble.
- **TS compilado como entrada aparte** (plugin de Vite que transpila un `.ts` sin imports a `assets/profile-prefetch-[hash].js` y lo inyecta en el HTML): gana tipos nativos y caché inmutable para ≈ 1 KB, a cambio de maquinaria de build propia (orden de hooks de `transformIndexHtml`, modo dev). `@ts-check` da el chequeo de tipos sin esa maquinaria.
- **Segundo `<script type="module">` en `index.html`:** Rolldown lo agruparía en `$initial` con el resto (D4) o compartiría el *runtime*, y la petición volvería a esperar al bundle.

### D6 — Inter desde el propio origen, con `preload`

- `frontend/public/fonts/inter-latin-v20.woff2` (Inter variable, pesos 400–800, subconjunto latin; ≈ 48 KB) y su licencia `frontend/public/fonts/OFL.txt` (SIL Open Font License 1.1, que permite redistribuirla). `theme.css` declara el `@font-face` (`font-display: swap`, `unicode-range` latin) y `index.html` la precarga (`<link rel="preload" as="font" type="font/woff2" crossorigin>`).
- `fonts.ts` saca `Inter` de la lista de Google Fonts: las demás familias (Poppins, Playfair Display, JetBrains Mono, Lora, Merriweather) se siguen pidiendo a Google cuando un tema las usa. `index.html` pierde el `preload` de la hoja de Inter y los dos `preconnect`.
- **Caché:** `Caddyfile` sirve `/fonts/*` con `Cache-Control: public, max-age=31536000, immutable` y los excluye del `no-cache`. El nombre lleva la versión (`-v20`): **cambiar el archivo exige cambiar el nombre**; un test lo exige para todo lo que haya en `public/fonts/` y comprueba que `theme.css` e `index.html` apuntan al mismo archivo existente.
- **CSP:** sin cambios (`font-src 'self'` ya está). `fonts.googleapis.com` y `fonts.gstatic.com` siguen permitidos para las otras familias.

Retoma la alternativa que D9 del change anterior dejó «para si la mediana no llega»: saca dos orígenes de la cadena del LCP. Con `preload` o sin él, el LCP varía ≈ 0,16 s en el prototipo y, con D8, no hay CLS en ningún caso; se elige **con `preload`** porque es la variante medida en el prototipo y evita el cambio de tipografía visible en el hero. Ver P1.

Alternativas descartadas:
- **Paquete `@fontsource-variable/inter`:** suma una dependencia para servir el mismo archivo.
- **Inter como asset de Vite con hash (`/assets/`):** no necesita regla en Caddy, pero depende de que Vite reescriba el `href` del `preload` del HTML y el `url()` del CSS al mismo archivo; un error ahí descarga la fuente dos veces sin que nada falle.

### D7 — Animación de entrada imperativa con Motion, sin remontar

`MotionSection` renderiza **siempre la misma `<section>`** (sin `Suspense` ni `React.lazy`) con `data-motion="on"` u `"off"`. Con animaciones activas, un efecto carga en diferido `themes/entrance-animation.ts`, que usa la API *vanilla* de Motion (`animate` de `motion/mini` e `inView` de `motion`) para animar opacidad y desplazamiento la primera vez que la sección entra en pantalla, con el mismo `delay`, duración (0,55 s), *easing* y margen de hoy.

- **Estado inicial en CSS, no en `style`:** `theme.css` oculta `[data-motion='on']:not([data-motion-entered])` (opacidad 0 y `translateY(20px)`); la animación marca `data-motion-entered` al terminar y limpia sus estilos en línea. Así un re-render de React no vuelve a ocultar una sección ya vista, y apagar las animaciones (`effects.animations = false` o `prefers-reduced-motion`) quita `data-motion="on"` y la sección queda visible.
- **Si el chunk no carga:** la sección se marca como entrada y queda visible.
- **Impresión:** la regla `@media print` de `[data-motion='on']` (opacidad 1, sin transformación, con `!important`, que gana a las animaciones de WAAPI) sigue valiendo; la hoja no usa `MotionSection`.
- **Preview del constructor:** mismo comportamiento; `inView` observa contra el viewport y el lienzo con desplazamiento propio se recorta igual que hoy con `whileInView`.
- Sigue siendo la librería Motion (Framer Motion) del stack. `animated-section.tsx` se elimina.

Medido: chunk de animación 25,9 → 3,2 KB gzip; desaparece el commit grande del remontaje.

Alternativas descartadas:
- **Mantener `LazyMotion` con `Suspense`:** el remontaje es la tarea larga que se quiere quitar.
- **Animaciones por CSS (`animation-timeline: view()`) o `IntersectionObserver` + transiciones, sin Motion:** cambia el stack de `CLAUDE.md`; sería una pregunta al owner sin necesidad, porque la API *vanilla* de Motion ya da el tamaño buscado.

### D8 — La grilla del layout `sidebar` es de una columna en móvil

`SidebarLayout` agrega `grid-cols-1` a la grilla (las columnas `lg:` no cambian). Sin columnas declaradas, mientras solo existe el aside (D1) la columna implícita mide lo que mide su contenido y, al revelarse el resto, se ensancha: CLS 0,416 → 0,001. Es un defecto latente que D1 hizo visible; la spec `layout-engine` ya dice que en móvil la columna pasa arriba.

Alternativa descartada: **ancho mínimo en el aside**: tapa el síntoma en un layout y deja la grilla dependiendo del contenido.

### D9 — Presupuesto: 155 KB gzip en un solo JS de módulo

`perf:budget` pasa a medir **todos** los scripts que carga el HTML (el `<script type="module">` de entrada, los `modulepreload` y los `<script src>` clásicos, como `profile-prefetch.js`) y falla si:

- la suma gzip supera **155 KB** (hoy el prototipo da 147 KB más ≈ 1 KB del script temprano: ≈ 5 % de margen, para que una dependencia nueva de verdad se discuta y no pase sola);
- hay **más de un JS de módulo** o **algún `modulepreload`** en el arranque (D4);
- algún script del arranque contiene `zod` clásico, las animaciones de Motion para React (`whileInView`, `data-framer-*`) o el *popper* de Radix (`data-radix-popper-content-wrapper`, que traen los menús y los tooltips; D3).

`BUNDLE_BUDGET_KB` sigue permitiendo probar el tope a mano. El presupuesto de bytes no tiene ruido: es la red principal contra las regresiones; Lighthouse confirma.

Alternativa descartada: **solo bajar el número, sin contar archivos:** volver a `manualChunks` pasaría el tope de bytes y perdería lo ganado en FCP sin que nada falle.

### D10 — CI: Performance ≥ 85, mediana de 5

`.github/workflows/ci.yml` pasa `PERF_CHECK_MIN_PERFORMANCE` de `'70'` a `'85'` en el job `web-quality (lighthouse)` y actualiza su comentario. Se mantiene la **mediana de 5** (`PERF_CHECK_RUNS: '5'`): las 15 corridas de la línea base fueron parejas (no hubo ruido que justifique más) y 7 sumarían ≈ 1 min al job. Si aparecen fallas falsas, primero se sube a 7 corridas (como ya prevé D11 del change anterior) y nunca se baja el umbral sin el owner. El default local de `perf:check` (90) y los umbrales de Accessibility, Best Practices y SEO (90) no cambian.

**Criterio de aceptación:** las tres páginas públicas con mediana ≥ 85 en el runner con el umbral ya subido. Si la primera corrida no llega, no se baja el umbral: se reporta al owner con las medianas y los reportes (P2).

### D11 — Este change se archiva después de `improve-a11y-and-performance`

La capability `web-performance` todavía no existe en `openspec/specs/`: la crea el delta de `improve-a11y-and-performance` (PR #30, sin archivar). Este change modifica dos de sus requisitos con `MODIFIED` y su **nombre exacto** (*Presupuesto de JS del arranque público* y *Los checks de calidad web bloquean en CI*), copiando el texto completo y todos sus escenarios; quita *Tipografía por defecto pedida desde el HTML* con `REMOVED` (su escenario, «la hoja de Inter se pide una sola vez», deja de ser cierto y OpenSpec no deja descartar escenarios con un `MODIFIED`) y lo reemplaza con `ADDED` *Tipografía por defecto desde el propio origen*; el resto son `ADDED`. Se verificó simulando el archivado previo (la spec de `web-performance` del change anterior copiada a `openspec/specs/` en una copia descartable): `validate --strict` da válido y sin avisos. Hasta que el change anterior se archive, `openspec validate` puede avisar que el archivado se negaría: es esperado, y **el orden de archivado es obligatorio** (primero `improve-a11y-and-performance`, después este). La rama sale de la del PR #30; si ese PR cambia sus requisitos antes de fusionarse, los `MODIFIED` de acá se re-sincronizan antes de implementar (tarea 0.2).

Alternativa descartada: **todo como `ADDED` con nombres nuevos:** dejaría vigentes dos presupuestos (180 y 155 KB) y dos umbrales de CI (70 y 85) contradictorios en la spec consolidada.

## Risks

- **`content-visibility: auto` y la accesibilidad:** el contenido omitido sigue en el árbol de accesibilidad, pero axe podría no evaluar el contraste de lo no renderizado. Mitigación: `a11y:check` ya recorre la página antes de auditar; la tarea de verificación compara las reglas de axe con la línea base.
- **Búsqueda en la página y anclas con `content-visibility`:** Chrome renderiza lo omitido al buscar o saltar a un ancla; Safari 18+ también. Si un navegador viejo no lo soporta, ignora la propiedad (sin efecto, no se rompe).
- **Visita doble si la lógica del script y la de la app divergen** (por ejemplo, un cambio futuro en la detección de idioma): la app no toma la petición temprana y pide otra. Mitigación: el test de paridad de D5 y `no-cache` para el script.
- **Visita doble por alias de slug:** resolver un slug anterior y navegar al canónico ya hace dos peticiones hoy; este change no lo empeora ni lo arregla.
- **Menús que no cargan tras un deploy** (chunk viejo borrado): el disparador provisional sigue y reintenta; no rompe la vista.
- **Un solo chunk invalida toda la caché en cada deploy** (D4): aceptado para el volumen de visitas del sitio.
- **El runner no llega a 85** aunque los proxies den 95+: el prototipo nunca corrió en GitHub. Mitigación: la tarea 9.4 lo mide antes de dar el change por cerrado y P2 deja las siguientes palancas.
- **Ruido o deriva del runner:** mediana de 5, Chrome fijado, y 7 corridas antes de tocar el umbral (D10).
- **Tests que dependen de los menús:** con D3 los menús montan en diferido; los tests que los abren tienen que esperar al módulo (`findBy…` o el `preload` del componente) sin tocar `src/test/setup.ts`.

## Migration Plan

Sin migración de datos ni de contrato; la API no cambia. Despliegue normal del servicio `web` (cambian el bundle, `index.html`, `public/` y el `Caddyfile`). Rollback: revertir el commit; `/fonts/*` con caché inmutable no deja nada roto porque el HTML anterior no lo referencia. El umbral 85 entra en el mismo PR. Orden de archivado: D11.

## Open Questions

- **P1 [no bloqueante]** — ¿Inter con `preload` o sin él? Con `preload` no hay cambio visible de tipografía en el hero; sin él, el prototipo midió el LCP ≈ 0,16 s mejor porque la fuente no compite con el bundle y el perfil. Con D8, ninguna de las dos da CLS. Opciones: (a) con `preload`; (b) sin `preload`; (c) decidir con dos corridas del CI, una por variante. **Recomendación:** (a), que es lo medido; si la tarea 9.4 queda por debajo de 85 en alguna página, probar (b) antes que cualquier otra palanca.
- **P2 [no bloqueante]** — Si el runner da menos de 85 con todo implementado, ¿qué sigue? Opciones: (a) sin `preload` de Inter (P1 b); (b) inyectar el CSS crítico en el HTML (≈ 150 ms de CSS bloqueante según la auditoría anterior; exige revisar la CSP de `style-src`, que ya permite `'unsafe-inline'`); (c) reportar y decidir. **Recomendación:** (a) y, si no alcanza, (c) con los reportes del CI; el umbral no se baja sin el owner.
