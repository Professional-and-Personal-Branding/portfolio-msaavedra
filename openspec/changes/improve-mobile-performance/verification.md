# Verificación — improve-mobile-performance

Ejecutada el 15 de octubre de 2026 en la rama `perf/mobile-lighthouse-85` (sobre el código del PR #30). Evidencia en `verification/`. **Pendiente (lo decide el owner):** tarea 9.7, la corrida verde del CI de GitHub con el umbral ya en 85. **Tarea 9.4 sin marcar:** el proxy lento de Linux da 74 / 75 / 78 (< 85); el proxy rápido, 97 / 98 / 97. Ver § Lighthouse y § Riesgos.

## Entorno

Nada de esto tocó la base `portfolio` del owner (5434) ni se escribió una contraseña en un navegador o en el repositorio.

| Pieza | Qué se usó |
|---|---|
| Base | Contenedor `postgres:16-alpine` aparte (`perf-db`, puerto 5499, base `portfolio_a11y`), migrado y sembrado (`seed:verify` verde salvo `ProfileView`, que ya no es 0 porque cada carga de los checks registra una visita: es la base descartable). Administrador de prueba con credenciales aleatorias de un solo proceso (`admin:bootstrap`). |
| API | `node dist/main` con `NODE_ENV=production`, puerto 3301. |
| Sitio | `dist/` y `frontend/Caddyfile` del worktree en `caddy:2-alpine` (`perf-web`, puerto 8088): CSP, `templates`, compresión y `Cache-Control` como en producción, HTTP/1.1 sin TLS. La línea base se midió en un contenedor aparte con el sitio del PR #30 (`perf-web-base`, 8089). |
| Linux | Imagen `lh-linux`: `ubuntu:24.04` + Google Chrome 155.0.8059.84 + `lighthouse@13.5.0`. **No se midió con el Chrome de Windows** (el *Layout* cuesta 2,5 veces más; ver `audit/README.md`); en Windows solo se corrieron los checks funcionales (axe, impresión, recorrido, visitas). |
| Proxies | Rápido: CPU libre (`benchmarkIndex` 3.350–4.170) con `cpuSlowdownMultiplier` 9,1, que emula el ×4 de Lighthouse sobre el equipo de referencia (BI ≈ 1.800) respecto de esta máquina. Lento: `--cpu-period=2200 --cpu-quota=1000` (BI 1.220–1.290) con ×4. Ninguno es el runner de GitHub; el veredicto lo da el CI. |

## Resultados por criterio

| Criterio | Resultado | Evidencia |
|---|---|---|
| 9.1 lint, tipos, tests, build | Frontend: `eslint` limpio, `tsc -b` y build en verde, Vitest **56 archivos / 629 tests** (antes 44 / 342). Backend sin tocar: 76 suites / 535 tests, igual que antes. | `verification/9.1-suite.txt` |
| 9.2 presupuesto de JS | **148,9 KB gzip** en un solo JS de módulo más el script clásico (tope 155; antes 178,9 KB en tres archivos). | `verification/9.2-budget.txt`, `7.1-budget.txt` |
| 9.3 axe | **0 violaciones** de cualquier impacto en 72 cargas (igual que antes del change) y recorrido de teclado sin problemas. | `verification/9.3-a11y.txt` |
| 9.4 Lighthouse | Proxy rápido: 97 / 98 / 97. Proxy lento (`perf:check` con los parámetros del CI): 74 / 75 / 78 (**no llega a 85**); Accessibility, Best Practices y SEO = 100 en las tres. | `verification/9.4-lighthouse.txt`, `9.4-perf-check-linux.md` |
| 9.5 recorrido a 375 px | 13 comprobaciones en verde con Chrome controlado. | `verification/9.5-recorrido.txt` y capturas `9.5-*.png` |
| 9.6 OpenSpec | `validate improve-mobile-performance --strict` válido; `validate --all --strict`: 35 de 35. El único aviso es *Archive would refuse* sobre `web-performance`, esperado hasta que se archive `improve-a11y-and-performance` (D11). | `verification/9.6-validate.txt` |
| 9.7 CI en el PR | **Pendiente**: sin push ni PR (lo decide el owner). | § CI |

### Lighthouse mobile, antes y después (Linux, medianas; entre paréntesis, las corridas)

Antes: 3 corridas del código del PR #30. Después: 5 corridas.

#### Proxy rápido (CPU libre, ×9,1)

| Página | Perf | FCP | LCP | TBT | CLS | JS transferido |
|---|---|---|---|---|---|---|
| `/` | 88 → **97** (88/90/85 → 98/97/98/97/96) | 2,1 → 1,7 s | 2,8 → 2,4 s | 281 → 0 ms | 0,052 → 0,001 | 217 → 199 KB |
| `/tech-lead-dotnet` | 88 → **98** (89/87/88 → 98/97/97/98/98) | 2,1 → 1,7 s | 2,8 → 2,3 s | 268 → 0 ms | 0,051 → 0,001 | 217 → 193 KB |
| `…?lang=en&theme=modern-dark&layout=sidebar` | 90 → **97** (91/90/89 → 95/97/95/98/98) | 2,1 → 1,7 s | 2,7 → 2,4 s | 223 → 0 ms | 0,001 → 0,001 | 217 → 193 KB |

#### Proxy lento (cuota de CPU, ×4)

| Página | Perf | FCP | LCP | TBT | CLS | JS transferido |
|---|---|---|---|---|---|---|
| `/` | 54 → **74** (68/54/54 → 82/74/77/73/74) | 2,4 → 1,8 s | 4,6 → 2,3 s | 1764 → 1140 ms | 0,028 → 0,001 | 217 → 199 KB |
| `/tech-lead-dotnet` | 55 → **75** (55/57/55 → 74/83/76/75/75) | 2,4 → 1,9 s | 4,4 → 2,4 s | 1654 → 924 ms | 0,028 → 0,001 | 217 → 193 KB |
| `…?lang=en&theme=modern-dark&layout=sidebar` | 59 → **81** (59/60/55 → 76/82/78/81/81) | 2,3 → 1,8 s | 4,1 → 2,3 s | 1387 → 672 ms | 0 → 0,001 | 217 → 193 KB |

`perf:check` (el comando del CI, 5 corridas) dentro de Linux con el proxy lento dio 74 / 75 / 78 (corridas 71–77, 74–86 y 75–80): la misma banda con otra hornada de corridas. El BP de la tabla de los proxies (78) viene de abrir el sitio por `host.docker.internal` (`is-on-https`); `perf:check` con un reenviador a `localhost` da 100.

**Cómo leerlo.** Los dos proxies acotan al runner, no lo reproducen. En la línea base el CI real dio 71 / 76 / 75 con TBT de 300–400 ms y LCP de ≈ 3,8 s: el TBT coincide con el del proxy rápido (245–320 ms) y el LCP con el del lento (3,4–4,1 s). Con el change, el proxy rápido tiene TBT 0 y el lento LCP de 2,3–2,4 s (−1,7 s). El TBT del lento (670–1.140 ms) es ruido de la cuota de CFS (cada trozo de 5 ms de React se estira por la espera de la cuota; `audit/README.md`), no una tarea larga real: en el rápido ninguna pasa de 50 ms. Por eso la estimación para el CI es ≥ 85 pero **no está medida**: lo dirá la tarea 9.7.

**P1 (b) probada.** Como 9.4 no llegó en el proxy lento, se midió Inter sin `preload` (solo en `dist/`, proxy lento, 5 corridas): 75 / 73 / 78 con FCP de 2,0–2,1 s, contra 74 / 75 / 81 con FCP de 1,8–1,9 s con `preload`. No mejora (el FCP empeora ≈ 0,2 s), así que se conserva P1 (a). Quedan P2 (b) (CSS crítico en el HTML) y (c) (reportar) por si el CI no llega.

### JS de arranque público (gzip)

| | entry | react | query | runtime | script clásico | **Total** | Archivos |
|---|---|---|---|---|---|---|---|
| Antes | 79,4 | 86,4 | 12,8 | 0,4 | — | **178,9 KB** | 3 JS de módulo + `modulepreload` |
| Después | 147,8 | (dentro) | (dentro) | (dentro) | 1,1 | **148,9 KB** | 1 |

Fuera del arranque: `entrance-animation` 3,3 KB (antes `LazyMotion` + `m` 25,9 KB), `ThemeSwitcher` 0,5, `ProfileMenu` 1,7, `dropdown-menu` 5,2, `sheet` 2,5 y el *popper* compartido 23,8 KB.

`verification/7.1-budget.txt` muestra el presupuesto en rojo (código 1) con `manualChunks` restaurado (151,2 KB: pasa el tope de bytes pero tiene cinco `modulepreload`), con un import estático de `ThemeSwitcher` en `TopBar` (176,0 KB y el *popper* de Radix) y con `BUNDLE_BUDGET_KB=100`.

### Cabeceras y CSP (6.5)

`verification/6.5-cabeceras.txt`: `/fonts/inter-latin-v20.woff2` con `Cache-Control: public, max-age=31536000, immutable`; `/profile-prefetch.js` y `/` con `no-cache`; `/assets/*` inmutable; la CSP de `/tech-lead-dotnet` es **idéntica por texto** a la del contenedor sin cambios.

### Impresión (6.3)

`print:check` contra la base descartable: 56 casos (14 perfiles × `es`/`en` × 2 temas), 0 con problemas, 1 página en A4 y Letter, contraste mínimo 9,74:1 (`verification/6.3-print.txt`).

## Recorrido en 375 px (9.5)

Chrome controlado por `puppeteer-core` (`verification/9.5-recorrido.txt`; capturas `9.5-perfil-375.png`, `9.5-sidebar-375.png`, `9.5-menu-tema-abierto.png`, `9.5-sheet-perfiles.png`), CPU 4× salvo donde se retienen los chunks de los menús 2,5 s:

- [x] El primer frame con datos tiene solo `hero` y el relleno; al final están las 9 secciones y no queda relleno. CLS del perfil 0,0000.
- [x] `?layout=sidebar`: el aside mide 327 px con solo el hero y con todas las secciones; CLS 0,0000.
- [x] Cambiar de idioma no deja ningún frame con menos de 9 secciones.
- [x] Menú de tema: con el foco en el disparador provisional y los chunks retenidos, `Enter` no abre nada todavía; al llegar el módulo el menú abre con el foco adentro y `Escape` devuelve el foco al botón (no a `body`).
- [x] `Sheet` de móvil: `Enter` antes de la carga abre con el foco adentro y `Escape` devuelve el foco al botón.
- [x] Consola sin violaciones de CSP ni errores de página en `/`, un perfil, `?theme=elegant` (Playfair Display desde Google Fonts), `?layout=sidebar&lang=en` y `/admin/login`.
- [x] Impresión completa: ver `print:check` arriba.
- [x] `npm run dev` arranca sin advertencias ni errores en consola con StrictMode (`verification/2.2-dev-consola.txt`).

## Una visita por carga (3.5)

`verification/3.5-visitas.txt`, Chrome contra el sitio de producción y la base descartable (la tabla `ProfileView` se cuenta con `psql` antes y después):

| Carga | `ProfileView` | Peticiones del perfil |
|---|---|---|
| `/tech-lead-dotnet?lang=es` | +1 | 1 (`locale=es`) |
| `/dotnet-backend?token=…&lang=en` (perfil `PROTECTED` de prueba) | +1 | 1 (`locale=en`, con `X-Access-Token`) |
| `/` con `navigator.language = es-BO` | +1 | 1 (`locale=es`) |
| `/` con `navigator.language = en-US` | +1 | 1 (`locale=en`) |

## Pruebas de que los tests detectan lo que dicen

- **Paridad del script temprano (3.4):** 227 casos (8 rutas × 7 búsquedas × 4 idiomas del navegador, más 3 de borde). Cambiando `indexOf('en')` por `indexOf('es')` en `public/profile-prefetch.js`, **60 casos fallan** y la suite deja de pasar.
- **Tipos del script (3.1):** una línea inválida añadida a `profile-prefetch.js` hace fallar `tsc -b` (TS2362/TS6133) y la variable sin usar de un `catch` hizo fallar `eslint` mientras se escribía.

## Desvíos respecto del diseño

1. **`useDeferredValue` lleva el slug** (D2 decía `useDeferredValue(query.data)`): se difiere `{ slug, data }` y solo se devuelve el perfil diferido si su slug es el de la ruta. Sin eso, al cambiar de `/a` a `/b` con `/b` ya en caché se mostraba un cuadro el perfil de `/a`. El resto del comportamiento (loading hasta que el diferido llega, nunca `error`, conservar el anterior al cambiar idioma o token) es el del diseño.
2. **Activación con `pointerdown` además de clic, `Enter`/`Espacio` y `ArrowDown`** (D3): el disparador provisional trata el botón principal presionado como activación, igual que Radix, para no perder el gesto si el módulo llega entre `pointerdown` y `click` (el clic caería sobre un nodo ya reemplazado). `Enter`/`Espacio` llegan como `click` de un `<button>`.
3. **`lazyWithPreload`** (D3) además de recibir props comparte la promesa del módulo, olvida una carga fallida (para reintentar) y expone `isLoaded()`; `DeferredMenu` lo usa para montar el menú real directamente si otro montaje ya lo cargó.
4. **El script clásico se chequea desde `tsconfig.app.json`** (`allowJs` + `checkJs` solo para `public/profile-prefetch.js`) y no desde un proyecto aparte, para compartir la declaración global de `window.__portfolioEarlyProfile` con `early-profile.ts`.
5. **Test del `TooltipProvider` del panel** (2.3): `AppProviders` se prueba por comportamiento (un `Tooltip` sin proveedor falla); la raíz del panel, por búsqueda de código (`TooltipProvider` solo aparece en `BackofficeApp.tsx` y en `ui/tooltip.tsx`).
6. **Archivos auxiliares nuevos:** `src/test/source-files.ts` (lectura de fuentes para tests de arquitectura) y `src/themes/motion-attributes.ts` (la constante `data-motion-entered`, compartida por `MotionSection` y `entrance-animation` sin que el arranque importe Motion). `src/test/setup.ts` no se tocó.
7. **Commits:** `index.html`, `use-curated-profile.ts` y `theme.css` mezclan dos palancas; se commitearon por partes (versiones parciales y restauración) para que cada commit compile y pase sus tests.
8. **`docs/manual/index.html`** (la guía HTML del manual) no se actualizó con TC-35: la tarea 8.1 pedía `MANUAL.md`.

## Riesgos y notas

- **El runner de GitHub no se midió** (9.7): los proxies lo acotan (ver § Lighthouse) pero no lo reproducen. Si el CI da < 85 en alguna página: no se baja el umbral; siguiente palanca P2 (b) (CSS crítico en el HTML, ≈ 150 ms de CSS bloqueante; la CSP ya permite `style-src 'unsafe-inline'`) y, si no alcanza, reportar con los reportes del CI (P2 c). P1 (b) ya se probó sin ganancia.
- **`content-visibility: auto`** aplica `contain: paint`: puede recortar sombras que salgan del borde de una sección. En el recorrido a 375 px no se vio recorte (capturas); queda como punto a mirar en escritorio con temas de sombras grandes.
- **Un solo chunk invalida toda la caché en cada deploy** (D4): aceptado.
- `seed:verify` marca `ProfileView ≠ 0` en la base descartable porque los checks registran visitas: esperado.

## CI

**Pendiente (tarea 9.7).** Con el push y el PR (decisión del owner), `frontend` (con `perf:budget`), `web-quality (a11y)` y `web-quality (lighthouse)` tienen que quedar en verde con mediana de Performance ≥ 85 en `/`, `/tech-lead-dotnet` y `/tech-lead-dotnet?lang=en&theme=modern-dark&layout=sidebar`. Tabla de medianas y link a la corrida: *a completar tras la corrida*.
