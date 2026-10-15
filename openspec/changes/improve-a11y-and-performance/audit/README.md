# Auditoría de accesibilidad y performance — 15 de octubre de 2026

Base: `main` en `fdad7a1`, worktree `wt-a11y` (rama `feat/a11y-performance`). Línea base del change `improve-a11y-and-performance`: los números de acá son los que el change tiene que mejorar, y `tasks.md` § 7 los vuelve a medir con los mismos scripts.

## Entorno

| Pieza | Qué se usó |
|---|---|
| Frontend | `npm run build` y la imagen de `frontend/Dockerfile` (`docker build -t portfolio-web-a11y:audit frontend`): Caddy 2 con el `Caddyfile` de producción, CSP incluida, `encode zstd gzip` y `Cache-Control` inmutable en `/assets/*`. Contenedor en `localhost:8088` con `API_ORIGIN=http://host.docker.internal:3300`. El head por perfil llega del servidor (verificado: `<title>Tech Lead .NET · …</title>` en el HTML). |
| API pública | `npm run build` y `node dist/main` del backend en el puerto 3300 contra la base local del owner (`portfolio`, Postgres en 5434), `NODE_ENV=development`. Solo lecturas, salvo las visitas que registra la ruta pública (ver *Visitas*). |
| Panel autenticado | Base **descartable** aparte (`postgres:16-alpine` en 5499, `prisma migrate deploy` + `npm run seed` + `npm run admin:bootstrap` con credenciales de prueba generadas al azar), segunda API en 3301 y segundo Caddy en 8089. La sesión se abrió con `fetch('/api/auth/login')` desde la página: no se escribió ninguna contraseña en un campo, ni se usó la del owner. Todo se borró al terminar. |
| Lighthouse | `lighthouse@13.5.0` (instalado fuera del repo) con el Chrome del sistema 155 en `--headless=new`. Mobile = configuración por defecto (moto g power, CPU 4x, 150 ms RTT, 1,6 Mbps, simulado); desktop = `--preset=desktop`. |
| axe-core | `axe-core@4.13.0` inyectado con `puppeteer-core` (ya es devDependency del frontend por `print:check`). Etiquetas `wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa, best-practice`. Viewports 375×812 (táctil) y 1350×940. Antes de cada corrida se recorre la página para disparar las animaciones `whileInView`. |

Los scripts con los que se midió quedaron en `scripts/` solo en la copia local del autor, **sin versionar** (`.gitignore` de esta carpeta, D16): sus rutas absolutas apuntan al scratchpad de la sesión y los reemplazan `frontend/scripts/check-a11y.mjs`, `check-lighthouse.mjs` y `check-bundle-budget.mjs` (`npm run a11y:check`, `perf:check` y `perf:budget`).

## Lighthouse (corrida base)

| Página | Form factor | Perf | A11y | BP | SEO | FCP | LCP | TBT | CLS | JS (KB transf.) |
|---|---|---|---|---|---|---|---|---|---|---|
| `/` | mobile | 94 | 88 | 96 | 100 | 2,3 s | 2,7 s | 80 ms | 0,008 | 235 |
| `/` | desktop | 100 | 88 | 96 | 100 | 0,5 s | 0,6 s | 0 ms | 0,003 | 235 |
| `/tech-lead-dotnet` | mobile | 90 | 88 | 96 | 100 | 2,3 s | 3,2 s | 80 ms | 0,002 | 235 |
| `/tech-lead-dotnet` | desktop | 100 | 88 | 96 | 100 | 0,5 s | 0,6 s | 0 ms | 0,002 | 235 |
| `…?lang=en&theme=modern-dark&layout=sidebar` | mobile | 93 | 88 | 96 | 100 | 2,4 s | 2,7 s | 70 ms | 0,001 | 235 |
| `…?lang=en&theme=modern-dark&layout=sidebar` | desktop | 100 | 88 | 96 | 100 | 0,5 s | 0,5 s | 0 ms | 0,003 | 235 |
| `/admin/login` | mobile | 90 | 98 | 92 | 66 | 2,6 s | 3,0 s | 0 ms | 0 | 284 |
| `/admin/login` | desktop | 100 | 98 | 92 | 66 | 0,5 s | 0,6 s | 0 ms | 0 | 284 |

Detalle por auditoría: `lighthouse/summary.md`; reportes completos: los ocho `lighthouse/*.report.html` están versionados; los `*.report.json` y `lighthouse/mobile-repeat/` (las repeticiones de `mobile-variability.md`) no, por peso (D16).

**Variabilidad (mobile, 4 corridas por página, `lighthouse/mobile-variability.md`):** `/` 87–94 (mediana 91), `/tech-lead-dotnet` 89–95 (mediana 92), sidebar 93–95 (mediana 94). El LCP es bimodal (≈ 2,5–2,7 s o ≈ 3,2–3,4 s) y siempre es el párrafo de resumen del hero; lo que cambia entre corridas es el *element render delay* (≈ 180 ms contra ≈ 340 ms sin throttling), que coincide con el fundido de entrada del hero (`opacity: 0` → 1 en 0,55 s). **Hoy el umbral de 90 no está garantizado en mobile.**

Lectura:

- **A11y 88** en todas las páginas públicas: `color-contrast`, `definition-list` y `dlitem`.
- **BP 96**: `inspector-issues` (CSP). Es un artefacto de la herramienta: sin axe, la página no deja ningún error en consola (`axe/probe-public.json`, `consoleWithoutAxe: []`); axe pide por `fetch` la hoja de Google Fonts para leer su CSSOM y `connect-src 'self'` lo bloquea. La CSP del sitio no se toca.
- **`/admin/login`**: SEO 66 por el `noindex` deliberado (`is-crawlable`), BP 92 por el 401 esperado de `GET /api/auth/me` y A11y 98 por `landmark-one-main`.
- **Performance**: TTFB del HTML ≈ 22 ms y respuesta de la API ≈ 20 ms. El camino crítico es *HTML → 228 KB gzip de JS (`index` 88, `react` 87,5, `motion` 41,8, `query` 10,2) → API → render*. Bootup: `motion` 465 ms (CPU 4x), el más caro. `unused-javascript` estima 118–123 KiB. CSS bloqueante: 13,7 KB (≈ 150 ms estimados).
- **Composición del bundle** (`bundle-composition.md`, sourcemaps): en el chunk de entrada público, `zod` ocupa **80,8 KB min (29 %)**; solo lo importa `themes/tokens.ts`. `motion` (125,5 KB min) se precarga en toda página pública para animar la entrada de las secciones.
- **Imágenes**: la vista pública no renderiza ningún `<img>` (`axe/probe-public.json`, `imgs: []`). El ítem *lazy-loading de imágenes* del checklist no aplica hoy.
- **Cache de lectura del backend**: con 20 ms de API, no hay nada que ganar; se respeta el diferimiento de `cache-de-lectura-y-visitas` (`docs/ROADMAP-1.1.md` § 5).

## axe-core

Vista pública (34 cargas: 17 páginas × 2 viewports; `axe/axe-public-summary.md`, `axe/axe-public.json`):

| Regla | Impacto | Nodos | Dónde |
|---|---|---|---|
| `color-contrast` | serious | 1376 | Las 30 vistas de perfil (todos los presets, layouts y acentos) |
| `definition-list` | serious | 30 | `Contact`: el `<dl>` envuelve `div > svg + div > dt/dd` y, en compacto, un `<p>` |
| `dlitem` | serious | 300 | Ídem: `dt`/`dd` no son hijos directos de un `div` hijo del `dl` |
| `landmark-one-main` | moderate | 2 | `/admin/login` sin `<main>` |
| `region` | moderate | 8 | `/admin/login`: contenido fuera de landmarks |

`/no-existe-este-perfil` (404) no tiene violaciones.

Panel autenticado (base descartable, 8 pantallas × 2 viewports; `axe/axe-admin-summary.md`, `axe/axe-admin.json`):

| Regla | Impacto | Nodos | Dónde |
|---|---|---|---|
| `aria-valid-attr-value` | **critical** | 22 | `LocalizedField`: `Tabs` de Radix sin `TabsContent`, así que `aria-controls` apunta a un id que no existe (Portada y constructor) |
| `color-contrast` | serious | 420 | Todas las pantallas: `text-dim` sobre `card` (3,66:1); en el preview del constructor, el acento del perfil |
| `definition-list` / `dlitem` | serious | 2 / 20 | El `Contact` del preview del constructor |

### Causas del contraste (`axe/axe-public-contrast-breakdown.md`, `axe/axe-admin-contrast-breakdown.md`, `contrast-tokens.md`)

1. **`text-dim`** (`color-mix(in srgb, textMuted 70%, bg)` en `theme.css`): falla en los cinco presets contra `card` (3,62–4,01:1) y en cuatro contra `bg`. Es la mayoría de los nodos, en público y en el panel.
2. **El acento como texto** (`text-brand`: titular del hero, *eyebrow* de cada sección, badge de disponibilidad, etiquetas del menú): 12 de los 14 perfiles tienen en `themeOverrides.colors.accent` un acento oscuro sobre `modern-dark` (1,15–4,25:1; `tech-lead-dotnet` #5B2C87 = 1,98:1, `software-architect` #1E293B = 1,32:1). El preset `modern-light` (#0284c7) también falla como texto (3,91:1).
3. **Texto sobre el acento**: `readableOn` elige blanco o negro por brillo YIQ, no por contraste. Con `modern-light` elige blanco (4,09:1) cuando el oscuro da 4,70:1.

## Teclado (`axe/axe-public.json` → `keyboard`, `axe/probe-public.json` → `focus`)

- **No hay enlace para saltar al contenido** en la vista pública ni en el panel: el primer Tab va a la marca; en escritorio, el panel obliga a pasar por los 10 controles del menú lateral (marca, 7 secciones, *Ver portafolio* y *Cerrar sesión*) antes del contenido.
- **El orden de tabulación es lógico** (marca → menú de perfiles → layout → tema → idioma → imprimir → hero → secciones) y todo lo interactivo es alcanzable.
- **El indicador de foco existe pero no siempre se ve**: los enlaces usan el `outline` del navegador teñido con `outline-ring/50`; los botones y campos de shadcn, un anillo de 3 px de `--t-accent` al 50 %. Contra el fondo, ese anillo da 3,03:1 en `modern-dark`, 1,93:1 en `modern-light`, 2,34:1 en `corporate` y 1,12–1,90:1 con los acentos oscuros de los perfiles: en `tech-lead-dotnet` es prácticamente invisible.
- **Menús y diálogos se comportan bien**: el menú de perfiles (dropdown en escritorio, `Sheet` en móvil), y el selector de tema abren con Enter, mueven el foco adentro, cierran con Escape y devuelven el foco al disparador. El conmutador de layout son dos botones con `aria-pressed`.
- **Movimiento reducido**: con `prefers-reduced-motion: reduce` todas las secciones quedan `data-motion="off"`, pero `html { scroll-behavior: smooth }` sigue activo.
- **Idioma**: `<html lang>` acompaña a `?lang=` del lado del cliente; los encabezados siguen h1 → h2 → h3.

## Visitas en la base del owner

Cada carga de una ruta pública registra un `ProfileView`. Antes de medir: `db-views-before.txt` (706 filas). Las 49 visitas generadas (ventana 07:09:31–07:21:00 UTC; UA `HeadlessChrome` = puppeteer, `moto g power` = Lighthouse mobile, `Macintosh` = Lighthouse desktop) se borraron en una sola sentencia que además descontó `CuratedProfile.views` por perfil (`db-views-cleanup.txt`: `all` 7, `java-senior-backend` 2, `software-architect` 2, `tech-lead-dotnet` 38). Después: `db-views-after.txt`, idéntico al de antes perfil por perfil (706 filas). Las 6 filas `HeadlessChrome` anteriores al 9 de octubre no son de esta auditoría y no se tocaron. No hubo ninguna otra escritura en esa base.
