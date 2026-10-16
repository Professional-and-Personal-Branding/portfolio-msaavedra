# Diagnóstico de Performance mobile y prototipo medido — 15 de octubre de 2026

Base: rama `perf/mobile-lighthouse-85`, creada desde `origin/feat/a11y-performance` (PR #30, change `improve-a11y-and-performance`, todavía sin fusionar ni archivar). Los números de acá son la línea base de este change y la evidencia de cada decisión de `design.md`. El prototipo es **de medición**, no la implementación: su diff quedó sin commitear en el worktree de la sesión y el diseño final (D1–D10) lo reemplaza.

## Por qué hace falta

La primera corrida del job `web-quality (lighthouse)` en GitHub (corrida `38809668290`, mediana de 5) dio **71 / 76 / 75** en `/`, `/tech-lead-dotnet` y `/tech-lead-dotnet?lang=en&theme=modern-dark&layout=sidebar`. El runner tiene `benchmarkIndex` ≈ 1.800, que es el equipo de referencia para el que Lighthouse calibra su *throttling* ×4: el ~75 es la medida fiel de un móvil de gama media. El owner fijó 70 en CI como freno de regresiones (D17 de `improve-a11y-and-performance`), descartó recalibrar `cpuSlowdownMultiplier` y dejó la mejora real para este change, con objetivo **≥ 85 en el runner de GitHub**.

## Cómo se midió (solo diagnóstico; nunca define el umbral)

| Pieza | Qué se usó |
|---|---|
| Base | **Descartable**: contenedor `postgres:16-alpine` en el puerto 5499 (`perf-db`), migrado y sembrado. Nunca la base del owner (5434): cada carga pública registra un `ProfileView`. |
| API | `node dist/main` con `NODE_ENV=production` en el puerto 3301. |
| Frontend | `dist/` servido por `caddy:2-alpine` con el `Caddyfile` del repo en el puerto 8088 (`perf-web`): CSP, `encode zstd gzip`, `Cache-Control`, HTTP/1.1 sin TLS, igual que el CI. |
| Navegador | Imagen Linux propia: `ubuntu:24.04` + Google Chrome 155.0.8059.84 + `lighthouse@13.5.0`. |

**Windows no sirve para diagnosticar.** Con el Chrome del sistema, el *Layout* cuesta 2,5 veces más que en Linux (el *fallback* de fuentes de DirectWrite), y eso desplaza el TBT y el LCP de una forma que el runner no tiene.

Se usaron dos *proxies* del runner, porque ninguno lo reproduce entero:

- **Rápido:** CPU libre (`benchmarkIndex` ≈ 4.100–4.400) con `cpuSlowdownMultiplier` 9,1. Es fiel para el trabajo que no se trocea; es pesimista con los trozos de ≈ 5 ms en que React parte una transición (5 × 9,1 = 45 ms, que Lighthouse ya cuenta como tarea larga).
- **Lento:** `--cpu-period=2200 --cpu-quota=1000` (`benchmarkIndex` ≈ 1.400–1.700) con ×4, como el CI. Reproduce el **LCP** del CI (3,5–4,3 s en la base), pero el TBT sale muy ruidoso por la cuota de CFS.

El veredicto lo da el runner de GitHub; los proxies solo ordenan las palancas.

## Línea base (código del PR #30)

| Condición | Perf | FCP | LCP | TBT |
|---|---|---|---|---|
| CI real (corrida `38809668290`, mediana de 5) | 71 / 76 / 75 | — | 3,8–3,9 s | 297–392 ms |
| Proxy rápido, `/tech-lead-dotnet` | 86–89 | 2,1 s | 2,8 s | 245–322 ms |
| Proxy lento, `/tech-lead-dotnet` | 58–73 | 2,3 s | 3,4–4,1 s | 530–1.580 ms |

Arranque público: 179 KB gzip de JS en tres archivos (`index`, `react`, `query`), dentro del presupuesto de 180 KB del change anterior.

## Causas

1. **LCP.** Con CPU lenta, el render del hero ocurre *después* de que llega Inter desde Google Fonts, y Lantern mete en la cadena del LCP la hoja de `fonts.googleapis.com` y el woff2 de `fonts.gstatic.com`: dos orígenes más, con una conexión cada uno. Además, la petición del perfil (`GET /api/curated-profiles/:slug`) recién sale cuando terminó de descargarse y evaluarse todo el JS.
2. **TBT.** El render del perfil al llegar los datos es una sola tarea síncrona (TanStack Query notifica con `useSyncExternalStore`, que no se puede interrumpir), seguida de un *Layout* de ≈ 1.700 objetos. Y cuando llega el chunk de `motion`, el `Suspense` de `MotionSection` **desmonta y vuelve a montar** el contenido de todas las secciones animadas.
3. **Peticiones.** El sitio se mide por HTTP/1.1 (Caddy sin TLS, igual que en el CI) y cada chunk crítico extra paga su conexión en la simulación de Lantern. Partir el *entry* sin consolidar los chunks empeora el LCP aunque baje el peso.

## Prototipo: palancas y efecto medido

| Palanca | Efecto medido | Decisión |
|---|---|---|
| Hero primero; el resto de las secciones en una transición (`startTransition`), con un relleno de alto de pantalla mientras tanto | TBT (proxy rápido) 300 → ≈ 160 ms | D1 |
| Datos del perfil por `useDeferredValue` + `root.render` dentro de `startTransition` + `content-visibility: auto` en las secciones con `MotionSection` | TBT (proxy rápido) → 0; Perf 93 | D2 |
| Menús de tema y de perfiles (Radix + Floating UI) en diferido, cargados cuando el perfil terminó de revelarse o al tocar el disparador; `TooltipProvider` fuera de la vista pública | arranque 179 → 150 KB gzip | D3 |
| Un único chunk de arranque: `codeSplitting.groups: [{ name: 'app', tags: ['$initial'] }]` de Rolldown en vez de `manualChunks` (`react`, `query`) | FCP 2,1 → 1,9 s; arranque 147 KB gzip en un archivo | D4 |
| Petición del perfil desde un script mínimo del HTML (`<script src="/profile-prefetch.js" async>`), entregada a `openapi-fetch` con el `fetch` por petición | **una sola petición** (verificado); LCP 2,9 → 2,76 s (rápido); 2,2–2,5 s (lento) | D5 |
| Inter servida desde el propio origen (woff2 latin v20, OFL) con `preload`; Google Fonts solo para las otras familias | saca dos orígenes de la cadena del LCP | D6 |
| Animación de entrada imperativa con la API *vanilla* de Motion (`motion/mini` `animate` + `inView`) sobre la misma `<section>`, sin remontar | chunk de animación 25,9 → 3,2 KB gzip; sin el commit grande | D7 |
| **Defecto que destapó el hero primero:** la grilla del layout `sidebar` no declara columnas en móvil; mientras solo existe el aside, la columna mide lo que mide su contenido. Arreglo: `grid-cols-1` | CLS 0,416 → 0,001 | D8 |

## Resultado del prototipo

| Página | Proxy rápido (Perf) | Proxy lento |
|---|---|---|
| `/` | 97–98 | LCP 2,2–2,5 s |
| `/tech-lead-dotnet` | 95–97 | LCP 2,2–2,5 s |
| `/tech-lead-dotnet?lang=en&theme=modern-dark&layout=sidebar` | 95–97 | LCP 2,2–2,5 s |

En el proxy rápido: TBT ≈ 0, LCP 2,3–2,7 s, CLS 0,001. En el proxy lento, el TBT sigue ruidoso (127–1.367 ms) por la cuota de CFS. **El CI de GitHub no se corrió con el prototipo**: es el criterio de aceptación de este change (`tasks.md` § 9).

## Otros datos

- Bloquear el woff2 de Inter, o los chunks de los menús, durante la carga baja el LCP ≈ 0,16 s cada uno: compiten por ancho de banda antes del LCP observado. Con el arreglo de la grilla no hay CLS ni con `preload` ni sin él. Ver D6 y la pregunta P1 de `design.md`.
- El prototipo tiene atajos que el diseño final no conserva: `public/profile-prefetch.js` sin chequeo de tipos ni test, `early-profile.ts` con funciones vacías sobrantes, `src/prefetch.ts` sin uso, un `useAfterLoad` improvisado en `TopBar` sin manejo de foco ni de activación temprana, y ningún test nuevo.
