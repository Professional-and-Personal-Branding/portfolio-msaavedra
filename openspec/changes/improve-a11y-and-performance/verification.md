# Verificación — improve-a11y-and-performance

Ejecutada el 15 de octubre de 2026 en la rama `feat/a11y-performance` (sobre `main` en `fdad7a1`). Evidencia en `verification/`. **Pendientes tras el push:** tarea 7.6 (costo real del CI), 7.7 (la hace el owner, P6) y 9.8 (CI verde en el PR).

## Entorno

Nada de esto tocó la base `portfolio` del owner ni se escribió ninguna contraseña en un navegador.

| Pieza | Qué se usó |
|---|---|
| Base | Contenedor `postgres:16-alpine` aparte (`a11y-pg`, puerto 5499, base `portfolio_a11y`), con `prisma migrate deploy`, `seed` (13 plantillas + `all` = 14 perfiles), `seed:verify` en verde y `admin:bootstrap` con credenciales aleatorias generadas fuera del repo. |
| API | `npm run build` y `node dist/main` con `NODE_ENV=production`, puerto 3300, secretos efímeros. **Variable que el CI necesita:** en producción la API exige `FRONTEND_URL` con `https://` (el valor no se usa: el sitio y la API comparten origen vía Caddy); el job le da `https://web-quality.example.test`. |
| Sitio | Imagen de `frontend/Dockerfile` (`docker build`), Caddy con CSP, head por perfil (`<title>` del perfil verificado) y compresión, en el puerto 8088 con `API_ORIGIN=http://host.docker.internal:3300`. El 8080 está ocupado por Adminer en esta máquina. |
| Chrome | 155.0.8059.41 (sistema). El job usa 155.0.8059.79 (estable vigente, existe en Chrome for Testing). |

Diferencia con el job de CI: allí el contenedor corre con `--network host` (Linux); en Docker Desktop de Windows se usó mapeo de puertos y `host.docker.internal`.

## Línea base re-medida (tarea 1.3)

Mismos scripts que `audit/scripts/` sobre `main`: axe da 1375 nodos de `color-contrast`, 30 de `definition-list`, 300 de `dlitem` (público) y 22 críticos de `aria-valid-attr-value` más 434 de contraste (panel): coincide con `audit/README.md` (1376 / 30 / 300 / 22 / 420; la diferencia de contraste del panel es una pantalla de constructor distinta). Lighthouse mobile: ver `verification/9.4-lighthouse.txt`; medianas 89 / 94 / 95 contra 91 / 92 / 94 de la auditoría (±5, con la corrida baja de `/` en 80 por ruido de CPU).

## Resultados por criterio

| Criterio | Resultado | Evidencia |
|---|---|---|
| 9.1 lint, tipos, tests, build | Frontend: lint limpio, `tsc -b` y build en verde, Vitest 44 archivos / **342 tests** (antes 39 / 326). Backend sin tocar: 76 suites / 535 tests. | `verification/9.1-suite.txt` |
| 9.2 presupuesto de JS | **178,9 KB gzip** (≤ 180; antes 227,9). Margen de 1,1 KB. | `verification/9.2-budget.txt`, `5.6-budget.txt` |
| 9.3 axe | **0 violaciones** de cualquier impacto en 72 cargas (home, 5 presets × 2 layouts, `?lang=en`, 13 perfiles de acento bajo, 404, login y 8 pantallas del panel; mobile y escritorio) y recorrido de teclado sin problemas. | `verification/9.3-a11y.txt` |
| 9.4 Lighthouse | Mediana ≥ 90 en las cuatro categorías de las tres páginas públicas, mobile. Ver tabla. | `verification/9.4-lighthouse.txt`, `9.4-lighthouse-ci-n5.md` |
| 9.5 teclado | Menús y diálogos devuelven el foco; ver § Teclado. | `verification/9.5-keyboard.json`, capturas `foco-*.png` |
| 9.6 `print:check` | 56 casos, 0 con problemas, contraste mínimo 9,74:1. | `verification/9.6-print.txt` |
| 9.7 OpenSpec | `validate improve-a11y-and-performance --strict` válido; `validate --all --strict`: 34 de 34, sin «Archive would refuse». | `verification/9.7-validate.txt` |
| 9.8 CI en el PR | **Pendiente** (sin push). | § CI |

### Lighthouse mobile, antes y después (mediana de 3, sitio de producción en local)

| Página | Perf antes → después | A11y | BP | SEO | LCP | TBT | JS transferido |
|---|---|---|---|---|---|---|---|
| `/` | 89 → **94** | 88 → **100** | 96 → **100** | 100 → 100 | 3,4 → 2,7 s | 50 → 41 ms | 235 → 213 KB |
| `/tech-lead-dotnet` | 94 → **95** | 88 → **100** | 96 → **100** | 100 → 100 | 2,6 → 2,5 s | 40 → 34 ms | 235 → 213 KB |
| `…?lang=en&theme=modern-dark&layout=sidebar` | 95 → **95** | 88 → **100** | 96 → **100** | 100 → 100 | 2,5 → 2,5 s | 50 → 26 ms | 235 → 213 KB |
| `/admin/login` (1 corrida) | 90 → 92 | 98 → **100** | 92 → 92 | 66 → 66 (exento) | 3,0 → 2,9 s | 0 | 284 → 247 KB |

Escritorio (1 corrida; sin umbral): Perf 97–100 (la de 97 en `/` se re-midió tres veces en 100), A11y 100, BP 100, SEO 100 en las públicas. Con los parámetros del CI (5 corridas): medianas 93 / 94 / 94, y la corrida más baja fue un 85 en `/`; con umbral 85 el job pasa, pero ese margen es justo (ver § Riesgos).

El BP de las páginas públicas sube de 96 a 100: ya no aparece `inspector-issues`. El login conserva BP 92 por el 401 esperado de `GET /api/auth/me`.

### axe: antes y después

| | Antes | Después |
|---|---|---|
| Público: `color-contrast` / `definition-list` + `dlitem` | 1375 / 330 nodos | 0 / 0 |
| Público: `landmark-one-main`, `region` (login) | 2 + 8 (moderate) | 0 |
| Panel: `aria-valid-attr-value` (critical) | 22 | 0 |
| Panel: `color-contrast` / `definition-list` + `dlitem` | 434 / 22 | 0 / 0 |

### JS de arranque público (gzip)

| | entry | react | motion | query | runtime | **Total** |
|---|---|---|---|---|---|---|
| Antes | 88,0 | 87,5 | 41,8 | 10,2 | 0,4 | **227,9 KB** |
| Después | 79,4 | 86,4 | — (en diferido, 25,9 aparte) | 12,8 | 0,4 | **178,9 KB** |

(Antes con las cifras de Vite; después con el propio script a gzip nivel 9. `zod/mini` solo ahorró ≈ 8 KB del entry, no los ≈ 20 que se esperaban: sus clases base siguen entrando; el resto vino de sacar `motion` del arranque.)

### Contraste con los derivados (`verification/2.1-contraste.md`)

Por preset, peor par contra `bg`/`bgSoft`/`card`: `--t-accent-ink` ≥ 4,5:1 en los cinco (modern-light 3,74 → 4,92, el resto sin cambio: `#38bdf8` queda igual); `--t-text-dim` 4,51–4,61:1 (antes 3,5–4,0); botón de `modern-light` con `#0a0e1a` 4,70:1 (antes 4,10 con blanco).

Por perfil del owner (sobre `modern-dark`): acento como texto 1,15–4,25:1 antes → `ink` 4,61–5,14:1 (tech-lead-dotnet 1,72 → 4,86; software-architect 1,15 → 4,61; los tres `#0078D4` 3,71 → 5,08); el relleno y el texto del botón no cambian (≥ 4,53:1 en los 14).

## Teclado (9.5)

Chrome controlado por `puppeteer-core` (sin escribir en ningún campo de login) sobre el sitio de producción:

- [x] Primer Tab en «Saltar al contenido»/«Skip to content»; Enter enfoca `main#contenido`; el Tab siguiente entra al contenido (público y panel, mobile y escritorio).
- [x] Orden de tabulación: salto → marca → menú de perfiles → diseño → tema → idioma → imprimir → hero.
- [x] Menú de perfiles (dropdown y `Sheet` móvil) y selector de tema: abren con Enter, el foco entra, Escape lo devuelve al disparador.
- [x] Diálogos del panel (nueva experiencia, categoría, proyecto): Escape devuelve el foco al botón. **Defecto encontrado y corregido:** antes del arreglo el foco caía en `<body>` (también en `main`: Radix lo evita si el diálogo no tiene `DialogTrigger`). Ver § Desvíos.
- [x] Foco visible con `modern-light`, `modern-dark` y `tech-lead-dotnet` (capturas `foco-modern-light-skip.png`, `foco-modern-dark-skip.png`, `foco-tech-lead-dotnet-brand.png`) y en un campo del panel (`foco-panel-campo.png`). El script mide además ≥ 3:1 del contorno de cada control alcanzado.
- [x] `prefers-reduced-motion: reduce` → `scroll-behavior: auto`; sin la preferencia, `smooth`.
- [x] Hero con opacidad 1 desde el primer frame en el DOM (probe con `MutationObserver`), con y sin movimiento reducido; `data-motion` ausente.
- [x] La hoja de Inter se pide **una vez** y sin errores de consola.

## Auditoría reproducible

- `a11y:check` sin `A11Y_CHECK_DISPOSABLE_DB=1`: sale 2 sin abrir páginas (`verification/6.1-a11y.txt`). `perf:check`: igual (`6.2-lighthouse.txt`).
- Regresión sembrada (`SectionHeading` con `text-brand`): `a11y:check` sale 1 con 39 nodos de `color-contrast` en 27 cargas y escribe `axe.json` y `a11y-summary.md`; el test `brand-ink-usage.spec.ts` también falla. Con el estado final sale 0.
- `perf:budget` rojo en dos casos: con `tokens.ts` vuelto a `zod` clásico (187,8 KB, «contiene zod clásico») y con `BUNDLE_BUDGET_KB=170`.
- Sin `--out` no se escribe nada en el árbol (`git status` limpio tras correr los tres).

## CI

- Sintaxis: `npx @action-validator/cli@0.6.0 .github/workflows/ci.yml` sin errores (y con un error sembrado, `fail-fastt`, lo detecta). `actionlint` no estaba disponible y no se descargó.
- `A11Y_CHECK_DISPOSABLE_DB` aparece **una sola vez**, en el `env` del job `web-quality`.
- Acciones fijadas por versión mayor, como el resto del workflow (versiones vigentes al 15/10/2026): `docker/setup-buildx-action@v4`, `docker/build-push-action@v7`, `browser-actions/setup-chrome@v2`, `actions/upload-artifact@v7`.
- **Ensayo local del job** (no es el CI remoto): base nueva → migraciones, seed, `seed:verify`, bootstrap → API en `production` → imagen **sin caché** → `a11y:check` con panel y `--out` → `perf:check` con `PERF_CHECK_RUNS=5` y `PERF_CHECK_MIN_PERFORMANCE=85` y `--out`:

| Paso | Tiempo local |
|---|---|
| Postgres de servicio | 3 s |
| `prisma:generate`, `deploy`, `seed`, `seed:verify`, `admin:bootstrap` | 15 s |
| Build y arranque de la API | 8 s (build incremental) |
| `docker build --no-cache` del frontend | 19 s |
| `a11y:check` (72 cargas) | ≈ 5 min, exit 0 |
| `perf:check` (3 páginas × 5 + login) | 247 s, exit 0 |

  En GitHub los pasos de instalación son más lentos (`npm ci` de dos proyectos, Chrome, descarga de `caddy`); la estimación de D15 (≈ 5–6 min para `a11y`, ≈ 9–10 min para `lighthouse`) queda por confirmar con las corridas del PR (7.6).
- **7.6 pendiente:** duración real de la matriz y del workflow completo, sin y con caché `gha`, con dos corridas en el PR.
- **7.7 pendiente (P6, owner):** marcar `Frontend · accesibilidad y Lighthouse (a11y)` y `(lighthouse)` como *required checks* de `main` después de la primera corrida verde en `main`. No se tocó la configuración del repositorio.
- **9.8 pendiente:** link a la corrida y medianas del CI cuando se abra el PR.

## Peso de lo versionado (8.4)

46 archivos nuevos en el change: **9,39 MB** (`audit/`: 23 archivos, 9,29 MB; `verification/` y artefactos: ≈ 0,1 MB), por debajo de 10 MB. `audit/.gitignore` deja afuera `lighthouse/*.report.json`, `lighthouse/mobile-repeat/` y `scripts/`.

## Desvíos respecto del diseño

1. **D8, `LazyMotion` en `MotionSection`:** `LazyMotion` + `m.section` con las features por `import()` dejaba `motion-dom` (≈ 11 KB gzip) en el entry y el total en 180,9 KB. `MotionSection` carga ahora un componente `AnimatedSection` con `React.lazy` (que usa `LazyMotion`, `m.section` y `domAnimation`); mientras llega, la sección se muestra en su estado inicial (`opacity: 0`, `translateY(20px)`), el mismo en que espera hoy. Se quitó el `manualChunks` de `motion` en `vite.config.ts` (anulaba el diferimiento). Hook propio `usePrefersReducedMotion` en lugar de `useReducedMotion`.
2. **D9, `crossorigin` en el preload de Inter:** medido, con `crossorigin` Chrome descarta el preload («request credentials mode does not match») y pide la hoja dos veces. Se quitó el atributo: una sola petición y consola limpia.
3. **Segundo acento (`--t-accent2-ink`)**, no previsto: `modern-light` falló `color-contrast` en los títulos de categoría de skills (`text-brand-2`, 4,27:1). Se derivó igual que el acento (`text-brand-2-ink`) y el test de uso cubre `text-brand-2`.
4. **Pestañas de idioma de las vistas previas** (Portada y constructor), no previstas: tenían el mismo `aria-controls` colgante que `LocalizedField` (los últimos 4 nodos críticos de axe). Se resolvieron con `PreviewLocaleTabs`: las dos pestañas controlan un único `role="tabpanel"` que envuelve la vista previa, sin remontarla al cambiar de idioma.
5. **Foco al cerrar diálogos**, no previsto (9.5 lo exige): `useReturnFocus` en `ui/dialog.tsx` y `ui/alert-dialog.tsx` recuerda el control que abrió el diálogo y le devuelve el foco. Sin `DialogTrigger`, Radix lo dejaba en `<body>` (defecto anterior a este change, también en `main`). Con test.
6. **Indicador de foco:** los ítems de menú y de `Select` (roving focus, no se alcanzan con Tab) conservan su resaltado de fondo en vez del contorno; el resto de controles de `ui/*` usa el contorno global. `TabsContent` de `LocalizedField` lleva `tabIndex={-1}` (su único contenido es el campo).
7. **Presupuesto en kB decimales** (1 KB = 1000 bytes, como Vite); en KiB serían 174,7. Para que el margen de 1,1 KB no se coma con un cambio chico, la próxima reducción natural es cargar en diferido el menú de perfiles y su `Sheet` (≈ 20 KB gzip de Radix y Floating UI que entran en el arranque aunque la mayoría de las rutas no tienen menú).

## Riesgos que quedan

- Margen del presupuesto de bytes: 1,1 KB.
- ~~Performance de `/` en CI: la mediana ronda 93, pero en el ensayo hubo una corrida de 85.~~ Se confirmó al revés en GitHub, ver § *Primera corrida en GitHub (D17)*.
- Performance mobile real ≈ 75 en el equipo de referencia de Lighthouse: queda para un change aparte (menos JS en el arranque y LCP).

## Primera corrida en GitHub (D17)

Corrida `38809668290` del PR #30, 2026-10-15: `web-quality (a11y)` en verde (10 min 2 s); `web-quality (lighthouse)` en rojo (6 min 50 s) con Performance por corrida `/` [71, 66, 73, 71, 76], `/tech-lead-dotnet` [75, 78, 72, 76, 77] y la variante en inglés con `modern-dark` y `sidebar` [70, 76, 75, 73, 78]; Accessibility, Best Practices y SEO en 100. LCP ≈ 3,8–3,9 s y TBT 297–392 ms. El `benchmarkIndex` del runner fue ≈ 1.781–1.875 (local ≈ 4.203) con `cpuSlowdownMultiplier` 4: el runner es el equipo de referencia de Lighthouse y el 93–95 local estaba inflado por la máquina. Con el OK del owner, el umbral de CI pasa a 70 (D17) y la mejora real se separa en otro change.
- Acento de luminosidad media: ver Risks del diseño; hoy los 14 perfiles y los 5 presets cumplen.
