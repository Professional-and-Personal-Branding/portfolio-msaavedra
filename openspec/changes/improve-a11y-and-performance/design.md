# Design — improve-a11y-and-performance

## Context

Ver `proposal.md` y `audit/README.md`. Estado medido el 15 de octubre de 2026 en `main` (`fdad7a1`):

- **Theming.** `tokensToCssVars` (`themes/css-vars.ts`) vuelca los ocho colores como `--t-*` y deriva uno solo: `--t-accent-foreground = readableOn(accent)`, blanco u oscuro según el brillo YIQ (umbral 128). `theme.css` define `--color-text-dim: color-mix(in srgb, var(--t-text-muted) 70%, var(--t-bg))`, `--color-brand: var(--t-accent)` y `--color-ring: var(--t-accent)`; la capa base pone `outline-ring/50` en todo, y los componentes de shadcn usan `focus-visible:ring-[3px] ring-ring/50`.
- **Uso del acento.** `text-brand` aparece 34 veces en `.tsx`: titular del hero, *eyebrow* de `SectionHeading`, badge de disponibilidad, etiquetas del menú de perfiles, íconos y asteriscos del panel. El mismo token pinta rellenos (`bg-brand`, `bg-brand-gradient`, botones primarios) y bordes.
- **Datos del owner.** Los cinco presets de la tabla `Theme` coinciden con `themes/presets/*`. 13 de los 14 perfiles tienen `themeOverrides.colors.accent`, 12 de ellos oscuros sobre `modern-dark` (tabla en `audit/contrast-tokens.md`). El precedente de `retire-accent-color` dejó ese color en `themeOverrides` a propósito: es una elección del owner por perfil.
- **Foco y teclado.** Sin enlace para saltar; `CuratedProfileView` ya tiene `<main>`, `AdminLayout` también; `LoginPage` no. Menús y diálogos de Radix devuelven bien el foco.
- **Animación.** `MotionSection` usa `motion.section` con `initial={{ opacity: 0, y: 20 }}` y `whileInView` en las nueve secciones, hero incluido; `ThemeProvider` usa `useReducedMotion`. `motion` es un chunk propio (`vite.config.ts`, `manualChunks`) que Vite precarga con `modulepreload` en `index.html`.
- **Bundle.** Entrada pública: `index` 88 KB gzip (`zod` 80,8 KB min, `tailwind-merge` 26,4, Radix menú y floating-ui ≈ 30), `react` 87,5 (`react-dom` + `react-router`), `motion` 41,8, `query` 10,2. Solo `themes/tokens.ts` importa `zod` fuera del panel.
- **Fuentes.** `ensureFontLoaded` inyecta la hoja de Google Fonts cuando el `ThemeProvider` resuelve el tema, ≈ 90 ms después de que corre el JS. La CSP ya permite `fonts.googleapis.com` y `fonts.gstatic.com`.
- **Medición.** Cada carga pública registra un `ProfileView`; `print:check` ya se protege con `PRINT_CHECK_DISPOSABLE_DB=1`.

## Goals / Non-Goals

**Goals:** 0 violaciones axe `serious`/`critical` en la vista pública (todos los presets, layouts y acentos del owner) y en el panel; Lighthouse ≥ 90 en las cuatro categorías para las páginas públicas en mobile, por mediana de 3; foco visible y salto al contenido; un presupuesto de JS que impida volver atrás; todo re-medible con un comando.

**Non-Goals:** ver `proposal.md` § Non-goals.

## Decisions

### D1 — El acento como texto es un derivado legible: `--t-accent-ink` (P1 = a)

`tokensToCssVars` calcula `--t-accent-ink`: el mismo tono y saturación que `accent` (HSL), con la luminosidad movida —hacia claro en tema oscuro, hacia oscuro en tema claro— en el menor paso que dé ≥ 4,5:1 contra `bg`, `bgSoft` y `card`. Si `accent` ya cumple, `ink = accent`. `theme.css` lo expone como `--color-brand-ink` y cada uso de `text-brand` **como texto** pasa a `text-brand-ink`; los rellenos, bordes e íconos decorativos siguen con `--t-accent`. Lo hace el cliente, así que vale para presets, overrides, `?theme=` y el preview del customizador sin tocar datos ni contrato.

Efecto con los datos de hoy: `modern-dark`, `minimal`, `elegant` y `corporate` no cambian (ya cumplen); `modern-light` y 12 perfiles muestran el acento más claro como texto.

Alternativas descartadas:
- **Que el owner cambie los 12 acentos** (P1, opción b, descartada por el owner): no necesita código, pero el próximo acento oscuro vuelve a romper el contraste y nada lo avisa.
- **Derivado más un aviso de contraste en el customizador** (P1, opción c, descartada por el owner): suma interfaz sin cambiar el resultado visible.
- **Validar en el backend y rechazar acentos ilegibles:** el acento también es color de relleno, donde uno oscuro es válido (el botón blanco sobre #5B2C87 da 9,74:1); rechazarlo quitaría una elección legítima.
- **Mezclar con `color-mix()` en CSS:** CSS no puede iterar hasta un contraste objetivo; un porcentaje fijo sobrecorrige unos acentos y no alcanza en otros.

### D2 — Texto sobre el acento por contraste, no por brillo

`readableOn` elige entre `#ffffff` y `#0a0e1a` el de **mayor razón de contraste WCAG** con el acento. Cambia un solo caso de hoy: `modern-light` (#0284c7) pasa de blanco 4,09:1 a oscuro 4,70:1. El fondo del botón sigue siendo el acento (spec `runtime-theming`, *Componentes de librería siguen el tema*); si ninguno de los dos colores llega a 4,5:1 con un acento de luminosidad media, queda el mejor de los dos y el caso se documenta en Risks.

Alternativa descartada: **mantener YIQ y subir el umbral**: cualquier umbral de brillo falla con algún acento; la razón WCAG es la que mide axe.

### D3 — `text-dim` garantizado: ≥ 4,5:1 contra `card`

`--t-text-dim` pasa a calcularse en `tokensToCssVars`: la mezcla de `textMuted` hacia `bg` más cercana al 70 % de hoy que todavía dé ≥ 4,5:1 contra `bg`, `bgSoft` y `card`; si ninguna lo da, `textMuted`. `theme.css` define `--color-text-dim: var(--t-text-dim)`. Se conserva la jerarquía (dim sigue más tenue que muted) y se arregla la mayoría de los nodos de axe, en público y en el panel. No es un color del owner sino un derivado del sistema; el cambio visible es leve (texto atenuado algo más claro en oscuro y algo más oscuro en claro).

Alternativa descartada: **eliminar `text-dim` y usar `textMuted`**: pierde un nivel de jerarquía que usan 60+ nodos (fechas, etiquetas, contadores) sin necesidad.

### D4 — Indicador de foco sólido y con contraste: `--t-ring`

`--t-ring = --t-accent-ink` (≥ 4,5:1 contra el fondo, holgado para el 3:1 de WCAG 1.4.11). Regla global en `theme.css`: `:focus-visible { outline: 2px solid var(--t-ring); outline-offset: 2px }`; se quita `outline-ring/50` de la capa base y el `ring-ring/50` de los componentes de shadcn pasa a usar el mismo outline (o `ring-ring` sólido de 2 px con `ring-offset`), para que haya **un** indicador y no dos. El panel hereda lo mismo porque también vive dentro de un `ThemeProvider`.

Alternativa descartada: **anillo en el color del texto** (`--t-text`): siempre contrasta, pero pierde la identidad del tema y en los presets oscuros parece un borde de selección, no de foco.

### D5 — Saltar al contenido y un `<main>` en cada pantalla

Componente `SkipLink` compartido (`shared/components/skip-link.tsx`): `<a href="#contenido">`, visualmente oculto hasta recibir foco, primer elemento enfocable dentro del `ThemeProvider`. Destino: el `<main id="contenido" tabIndex={-1}>` de `CuratedProfileView` y de `AdminLayout`. `LoginPage` envuelve su formulario en `<main>`. Texto por i18n (`a11y.skipToContent`: *Saltar al contenido* / *Skip to content*); el panel, en español como el resto de sus textos.

Alternativa descartada: **`tabIndex` en el `<h1>`**: no ayuda en el panel, donde el primer contenido no siempre es un `h1`, y no es el patrón que esperan los usuarios de teclado.

### D6 — Estructura válida: `dl` de contacto y pestañas con panel

- `Contact.tsx`: cada fila es `<div>` hijo directo del `<dl>` con `<dt>` y `<dd>` como hijos directos; el ícono va dentro del `<dt>` (`aria-hidden`); el título compacto sale del `<dl>` a un `<p>` previo. Mismo aspecto.
- `LocalizedField.tsx`: conserva las pestañas ES/EN (lo exigen `admin-content-management`, *Campos bilingües y listas* y *Edición del nivel en ES y EN desde la Portada*) y agrega un `TabsContent` por idioma con `forceMount` y `hidden` cuando no está activo, cada uno con su control (`id` propio, `aria-label` con el idioma). Así `aria-controls` apunta a un panel que existe y el `Label` sigue al control activo.

Alternativa descartada para el campo: **botones con `aria-pressed`** en vez de pestañas: válido para axe, pero contradice la redacción de dos specs vigentes y obligaría a un `MODIFIED` sin beneficio para el usuario.

### D7 — Movimiento: el scroll suave respeta la preferencia y el hero no espera (P2 = a)

- `theme.css`: `scroll-behavior: smooth` solo dentro de `@media (prefers-reduced-motion: no-preference)`.
- `Hero` deja de usar el fundido de entrada: se pinta con `opacity: 1` desde el primer frame. El resto de las secciones mantiene su animación al entrar en pantalla, y todas siguen apagándose con `effects.animations = false` o `prefers-reduced-motion` (spec `runtime-theming`, sin cambios). El LCP es el resumen del hero en las 12 corridas mobile; su *render delay* sube de ≈ 180 a ≈ 340 ms en las corridas lentas (`audit/README.md`).

Alternativas descartadas por el owner: **hero con desplazamiento sin fundido** (P2, opción b): no retrasa el LCP, pero con D8 las features de `motion` llegan después del primer render y el hero quedaría 20 px corrido hasta que carguen, con un salto visible. **Dejarlo como está** (P2, opción c): mantiene el LCP bimodal y la mediana en 91–92.

### D8 — Arranque: `zod/mini` para los tokens y `motion` en diferido

- `themes/tokens.ts` usa `zod/mini` (la API funcional de Zod 4, que se puede *tree-shakear*). Sigue siendo Zod, como pide `CLAUDE.md` (*Zod schemas compartidos*); los formularios del panel siguen con `zod` clásico en su chunk diferido.
- `MotionSection` usa `m.section` dentro de un `LazyMotion` cuyas features (`domAnimation`) se importan con `import()` dinámico; `motion` deja de precargarse en `index.html`. `useReducedMotion` se reemplaza por un hook propio sobre `matchMedia('(prefers-reduced-motion: reduce)')` si el de `motion/react` arrastra el chunk entero.
- **Presupuesto:** la suma gzip de los JS del arranque público (el *entry* más sus `modulepreload` en `dist/index.html`) **≤ 180 KB** (hoy 228). `frontend/scripts/check-bundle-budget.mjs` (`npm run perf:budget`) lo mide sobre `dist/` y falla si se pasa o si algún chunk del arranque contiene `zod/v4/classic` o el bundle completo de `motion-dom`.

Alternativas descartadas:
- **Quitar Framer Motion y animar con CSS (`animation-timeline: view()` o IntersectionObserver):** el menor bundle posible, pero cambia el stack fijado en `CLAUDE.md`; sería una pregunta al owner sin necesidad, porque `LazyMotion` alcanza el presupuesto.
- **Validar tokens a mano, sin Zod:** contradice la convención de schemas compartidos y duplica el contrato del backend.
- **Adelantar los datos del perfil en el HTML (Caddy `httpInclude` del JSON o `<link rel="preload" as="fetch">`):** sacaría la API del camino crítico, pero el `fetch` precargado registra la visita y el del cliente tiene que reutilizarlo exactamente (credenciales, cabeceras, `X-Access-Token`), o se cuenta doble. Mucho riesgo para ≈ 20 ms de API; se reconsidera si D8 no alcanza.

### D9 — Inter se pide desde el HTML

`index.html` agrega `<link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" crossorigin>` con la misma URL exacta que arma `ensureFontLoaded`, de modo que la hoja inyectada después sale de caché. Inter es la tipografía de cuatro de los cinco presets y del default. No bloquea el render (`preload`, no `stylesheet`) y la CSP no cambia (`style-src` ya incluye el origen).

Alternativa descartada: **servir Inter desde el propio sitio** (paquete `@fontsource-variable/inter`): quita dos orígenes externos, pero suma una dependencia y cambia cómo se cargan las demás familias, para una mejora que Lighthouse estima en ≈ 220 ms solo de conexión. Queda como mejora futura si la mediana no llega.

### D10 — Los checks se versionan, son parametrizables y se niegan a ensuciar una base real

- `frontend/scripts/check-a11y.mjs` (`npm run a11y:check -- <base>`): `puppeteer-core` + `axe-core` (devDependency, versión exacta) sobre la home, un perfil con cada preset × layout, `?lang=en`, los perfiles cuyo acento no cumple 4,5:1 (los lee de `GET /api/curated-profiles` y del tema resuelto), el 404 y `/admin/login`; con `A11Y_CHECK_ADMIN_EMAIL`/`A11Y_CHECK_ADMIN_PASSWORD`, también las pantallas del panel (login por `fetch`, nunca tipeando en un campo). Recorre con Tab y comprueba el salto al contenido y el contraste del indicador de foco. Sale con 1 ante cualquier violación `serious` o `critical`.
- `frontend/scripts/check-lighthouse.mjs` (`npm run perf:check -- <base>`): `npx -y lighthouse@13.5.0` (versión fija) en mobile. Parámetros por variable de entorno, para que local y CI usen el mismo script: `PERF_CHECK_RUNS` (corridas por página pública, default 3) y `PERF_CHECK_MIN_PERFORMANCE` (umbral de la mediana de Performance, default 90). Accessibility, Best Practices y SEO usan siempre 90. `/admin/login` se mide una vez, con la excepción de D11.
- `frontend/scripts/check-bundle-budget.mjs` (`npm run perf:budget`): ver D8; no necesita navegador ni base.
- `a11y:check` y `perf:check` exigen `A11Y_CHECK_DISPOSABLE_DB=1` y salen con 2 sin ella (mismo criterio que `PRINT_CHECK_DISPOSABLE_DB`). La variable solo se setea en el job del CI (D13) y a mano contra una base descartable; se documenta en `docs/MANUAL.md`.
- Los tres aceptan `--out <dir>`: escriben ahí los reportes (axe JSON, Lighthouse HTML y JSON, resumen `.md`) para subirlos como artefacto.

Alternativa descartada: **`@axe-core/puppeteer` y Lighthouse CI (`@lhci/cli`)**: más dependencias y configuración (servidor o almacenamiento de LHCI) para lo mismo que hacen 200 líneas, que además ya probaron funcionar en esta auditoría.

### D11 — Qué umbral aplica a cada página, local y en CI

| Medida | Local (antes de un release) | CI | Bloquea |
|---|---|---|---|
| `perf:budget` | ≤ 180 KB gzip | ≤ 180 KB gzip | Sí |
| axe | 0 `serious`, 0 `critical` | Igual | Sí |
| Lighthouse A11y, BP, SEO (públicas, mobile) | Mediana de 3 ≥ 90 | Mediana de 5 ≥ 90 | Sí |
| Lighthouse Performance (públicas, mobile) | Mediana de 3 ≥ 90 | Mediana de 5 ≥ **85** | Sí |
| `/admin/login` | A11y y BP ≥ 90, 1 corrida; SEO exento; Performance informativa | Igual | Sí (A11y y BP) |

- **Por qué 85 en CI:** en esta máquina, con la misma build, Performance mobile varió 8 puntos (87–95) entre corridas; los runners compartidos de GitHub suman ruido de CPU que el throttling simulado de Lighthouse no corrige del todo (el `benchmarkIndex` del runner varía entre corridas). Un umbral de 90 sobre una mediana que ronda 93–96 después de D7 y D8 daría fallas falsas; 85 con mediana de 5 sigue atrapando una regresión real (volver a precargar `motion` o `zod` baja 5–8 puntos) y el presupuesto de bytes, que no tiene ruido, es la red principal. El 90 local sigue siendo el criterio de aceptación de este change (tarea 8.4).
- **A11y, BP, SEO y axe son deterministas** (no dependen del tiempo): mismo umbral en los dos lados.
- **Best Practices `inspector-issues` (CSP):** se acepta. Lo dispara axe, que Lighthouse corre adentro, al pedir por `fetch` la hoja de Google Fonts (`connect-src 'self'`). Sin axe la consola queda vacía (`audit/axe/probe-public.json`). Abrir `connect-src` para satisfacer a la herramienta debilitaría la política.
- **axe `moderate` y `minor`:** se reportan; no bloquean.
- **Desktop:** se reporta sin umbral (ya da 100 en Performance).

Alternativas descartadas: **Performance informativa en CI** (no bloquea): deja pasar regresiones que el owner quiere frenar. **Calibrar el throttling por `benchmarkIndex`**: frágil y difícil de explicar; la mediana más el margen alcanzan.

### D12 — Sin cache de lectura en el backend

El HTML sale en ≈ 22 ms y la API en ≈ 20 ms; el 100 % de lo que separa el FCP del LCP en mobile está en el cliente. Se mantiene el diferimiento de `cache-de-lectura-y-visitas` (`docs/ROADMAP-1.1.md` § 5), y el checklist de release lo cierra citando esta medición. *Lazy-loading de imágenes* no aplica: la vista pública no tiene `<img>`.

### D13 — Dónde corren los checks en `.github/workflows/ci.yml` (P5)

- **`perf:budget`:** un paso más del job `frontend`, después de `npm run build`. Cuesta segundos y reutiliza el `dist/` que ya se arma.
- **`a11y:check` y `perf:check`:** un job nuevo, `web-quality` (*Frontend · accesibilidad y Lighthouse*), con `strategy.matrix.check: [a11y, lighthouse]` y `fail-fast: false`: dos ejecuciones en paralelo con los mismos pasos de preparación, así el tiempo de pared es el del más lento y no la suma. Corre en `ubuntu-24.04`, como el resto del workflow.
- **Disparadores:** los del workflow (push a `main` y PR a `main`), sin filtro de rutas. Correr también en push a `main` deja una línea de base del commit fusionado y detecta deriva de Chrome o de dependencias; `concurrency` ya cancela corridas viejas. Un filtro por rutas (`dorny/paths-filter`) se descarta: suma una acción de terceros para ahorrar minutos en PRs de solo docs, que hoy son pocos.
- **Qué pasa si falla:** el job falla y, con él, el workflow; los tres checks son bloqueantes con los umbrales de D11. Que GitHub impida el merge depende de marcar `Frontend · accesibilidad y Lighthouse (a11y)` y `(lighthouse)` como *required checks* en la protección de `main`: es una configuración del repositorio (P6).
- **Artefactos:** `actions/upload-artifact` con `if: failure()`, nombre `web-quality-${{ matrix.check }}`, la carpeta de `--out` y retención de 14 días. En éxito no se sube nada (los resúmenes quedan en el log del paso).

### D14 — Cómo se levanta el sitio en CI

- **Base descartable:** servicio `postgres:16-alpine` igual al de `backend-e2e`, con credenciales de prueba públicas. `prisma:deploy`, `seed`, `seed:verify` y `admin:bootstrap` con `ADMIN_EMAIL=ci@a11y.test` y `ADMIN_PASSWORD` generado con `openssl rand` en cada corrida (como `JWT_SECRET` y `ANALYTICS_SALT` en `backend-e2e`). Ahí sí se siembra: la base nace y muere con el job.
- **API:** `npm run build` y `node dist/main` en segundo plano, puerto 3300, con `NODE_ENV=production` y secretos efímeros fuertes, para medir el mismo comportamiento que Railway (Helmet, sin Swagger, cookie `Secure`, que Chrome acepta en `localhost`). Un paso espera `GET /health` antes de seguir.
- **Frontend:** la imagen de `frontend/Dockerfile` (`docker build`) corriendo con `--network host`, `PORT=8080` y `API_ORIGIN=http://localhost:3300`. Es lo que se sirve en producción: Caddy con la CSP, el head por perfil vía `templates`, compresión `zstd/gzip` y `Cache-Control`. Tiempo estimado: 60–90 s (`npm ci` y `vite build` dentro de la imagen; `caddy:2-alpine` se descarga en segundos). Con `docker/build-push-action` y caché `type=gha` baja a ≈ 30 s en corridas con el `package-lock.json` sin cambios.
- **`A11Y_CHECK_DISPOSABLE_DB=1`** se define solo en el `env` del job `web-quality`.
- **Chrome:** `browser-actions/setup-chrome` con versión **fijada** (la estable vigente al implementar; la auditoría usó 155) y `install-dependencies: true`; su salida `chrome-path` va a `CHROME_PATH`. El Chrome preinstalado en la imagen del runner se actualiza solo y movería los puntajes sin cambios en el código; subir de versión se hace a propósito, en un PR, como ya hace el workflow con el runner.

Alternativa descartada: **`vite preview` con proxy a la API**: arranca en ≈ 5 s en vez de 60–90, pero no aplica la CSP, ni el head servido por el servidor, ni la compresión de Caddy: SEO y Best Practices medirían otra cosa y Performance quedaría sesgada (assets sin comprimir). El minuto de diferencia no lo justifica.

### D15 — Tiempo agregado al CI

Estimación por ejecución de la matriz (runner estándar `ubuntu-24.04`; con un runner de 2 vCPU, el de repos privados, los pasos de Lighthouse pueden tardar hasta el doble):

| Paso | `a11y` | `lighthouse` |
|---|---|---|
| Checkout, Node, `npm ci` de backend y frontend (con caché) | ≈ 60 s | ≈ 60 s |
| Postgres listo, migraciones, seed, bootstrap | ≈ 25 s | ≈ 25 s |
| Build y arranque de la API | ≈ 30 s | ≈ 30 s |
| Imagen del frontend (sin / con caché `gha`) | 60–90 s / ≈ 30 s | 60–90 s / ≈ 30 s |
| Chrome fijado | ≈ 15 s | ≈ 15 s |
| Check | ≈ 2,5 min (≈ 50 cargas de axe) | ≈ 6 min (3 páginas × 5 corridas + login, ≈ 20 s c/u) |
| **Total** | **≈ 5–6 min** | **≈ 9–10 min** |

El job más largo del workflow pasa a ser `web-quality (lighthouse)`, ≈ 9–10 min de pared frente a los ≈ 2–4 min de hoy: suma **≈ 6–7 min de pared** por PR y por push a `main`, y ≈ 15 min de cómputo. `perf:budget` suma menos de 5 s al job `frontend`.

### D16 — Qué queda versionado de `audit/` (P3)

Se versionan los resúmenes (`README.md`, `contrast-tokens.md`, `bundle-composition.md`, `db-views-*.txt`, `axe/*.md`, `lighthouse/summary.md`, `lighthouse/mobile-variability.md`), los JSON de axe (`axe/*.json`) y los ocho `lighthouse/*.report.html` de la corrida base: ≈ 9,3 MB en 23 archivos. Quedan fuera los `lighthouse/*.report.json`, `lighthouse/mobile-repeat/` y `audit/scripts/` (los reemplazan los scripts de `frontend/scripts/`). Se excluyen con un `.gitignore` dentro de `audit/`, que viaja con la carpeta al archivar y deja explícito qué se omitió y por qué; los archivos locales no se borran.

Alternativa descartada: **moverlos al scratchpad**: el `.gitignore` deja el mismo resultado en git y no rompe las rutas que citan `README.md` y `mobile-variability.md` para quien tenga la copia local.

## Risks

- **Acentos de luminosidad media** (p. ej. #0078D4: blanco 4,53:1, oscuro 4,25:1): con D2 queda el mejor de los dos, que puede quedar justo por encima o por debajo de 4,5:1. Hoy los 14 perfiles y los 5 presets cumplen con D2; un acento futuro podría no hacerlo. Mitigación: `a11y:check` lo detecta en CI y la salida nombra el perfil.
- **`text-brand-ink` mal aplicado:** un uso de `text-brand` que quede como texto vuelve a fallar. Mitigación: test que busca `text-brand` (sin `-ink`, `/`, `-foreground` ni `-2`) fuera de íconos `aria-hidden`.
- **`LazyMotion` cambia el primer frame de las secciones**: hasta que llegan las features, `m.section` aplica el estado `initial` (opacidad 0) a lo que está debajo del pliegue. Es lo mismo que hoy para esas secciones; el hero queda afuera por D7.
- **Ruido de Lighthouse en runners compartidos:** fallas falsas de Performance. Mitigación: mediana de 5 y umbral de 85 en CI (D11); si aun así aparecen, se sube a 7 corridas antes de tocar el umbral, y el reporte HTML queda como artefacto para diagnosticar.
- **Deriva del runner o de Chrome:** cambia puntajes sin cambios en el código. Mitigación: runner `ubuntu-24.04` y Chrome fijados; actualizarlos es un PR propio.
- **CI más lento:** ≈ 6–7 min más de pared por PR (D15). Mitigación: matriz en paralelo y caché de la imagen.
- **Visitas registradas por los checks:** si alguien los corre contra la base del owner, ensucian la analítica. Mitigación: la variable obligatoria de D10, que solo setea el job del CI.

## Migration Plan

Sin migración de datos ni de contrato. Despliegue normal del servicio `web`; la API no cambia. Rollback: revertir el commit. Los `themeOverrides` guardados no se tocan, así que no hay nada que deshacer en la base. El job `web-quality` entra con el mismo PR; marcarlo como requerido (P6) es posterior a que pase verde en `main` al menos una vez.

## Open Questions

Respondidas por el owner el 15 de octubre de 2026:

- **P1** — Acento como texto: **(a)**, derivado automático `--t-accent-ink` (D1).
- **P2** — Hero: **(a)**, sin fundido de entrada; el resto de las secciones sigue animando (D7).
- **P3** — `audit/`: se versionan resúmenes, JSON de axe y los ocho HTML base; el resto no (D16, tarea 7.4).
- **P4** — Sin respuesta; queda la recomendación: **fuera de alcance**. Filtrar de `ProfileView` las visitas de herramientas automáticas (Lighthouse, PageSpeed Insights, `HeadlessChrome`) va en un change aparte después del deploy, junto con `cache-de-lectura-y-visitas`.
- **P5** — **Todos los checks entran al CI** (`perf:budget`, `a11y:check` y `perf:check`), bloqueantes (D13–D15).

Abiertas:

- **P6 [no bloqueante]** — ¿Se marcan `Frontend · accesibilidad y Lighthouse (a11y)` y `(lighthouse)` como *required checks* en la protección de `main`? Sin eso el job falla pero GitHub permite fusionar. Es una configuración del repositorio que hace el owner. **Recomendación:** sí, después de la primera corrida verde en `main` (tarea 7.5).
