# Verificación — add-public-frontend-theming (Fase 4)

Fecha: 2026-09-08 · Verifier: Claude (Fable 5.1) · Ciclos de reparación: 0 (los ajustes durante la verificación fueron de código de test/estado de DB, no de criterios fallidos).

## Automatizado

| Check | Resultado |
|---|---|
| `frontend`: `npm run typecheck` | 0 errores |
| `frontend`: `npm run lint` (ESLint 9 flat + Prettier check) | 0 problemas |
| `frontend`: `npm run test` (Vitest, jsdom, MSW) | 12 archivos, 56 tests en verde |
| `frontend`: `npm run build` | OK. JS inicial gzip: react 70.28 KB + index 80.50 KB + motion 41.82 KB + query 9.73 KB + runtime 0.36 KB = **202.7 KB** (< 400 KB); CSS 8.85 KB gzip |
| `backend`: `npm run openapi:export` con `DATABASE_URL=""`/`JWT_SECRET=""` (sin base) | exit 0; 20 rutas, 34 schemas; incluye `/api/profile`, `/api/curated-profiles/{slug}`, `/api/education` |
| `backend`: `npm test` / `lint` / `typecheck` / `build` tras el refactor de `swagger.ts` | 39 suites, 168 tests; lint 0; tsc 0; build OK |
| `frontend`: `api-types.spec` (hash de `openapi.json` vs cabecera de `api.d.ts`) | verde |
| `openspec validate add-public-frontend-theming --strict` | válido |

Cobertura por spec (tests Vitest):
- `api-contract-types`: `api-types.spec.ts` (hash, rutas públicas). Deriva en compilación: comprobada a mano — acceder a `data.noExiste` en `use-curated-profile.ts` produce `TS2339` en `tsc -b`.
- `runtime-theming`: `tokens.spec` (parciales → modern-dark, zod rechaza inválidos), `presets.spec` (5 presets, `bg`/`accent` distintos), `css-vars.spec` (mapa `--t-*`, densidad, animaciones), `theme-provider.test` (variables en el contenedor raíz, no en `documentElement`; cambio sin remount; preset > perfil; desconocido ignorado; `MotionSection` on/off).
- `layout-engine`: `sections.spec` (orden API, faltantes al final, ocultas, vacías, desconocidas), `stats.spec`, `layouts.test` (classic/sidebar/desconocido → classic).
- `frontend-localization`: `messages.spec` (fallback `es`, cobertura `en`, `detectLocale`), `url-state.spec`, `CuratedProfilePage.test` (`?lang=en` → `?locale=en` y títulos en inglés).
- `public-portfolio-frontend`: `CuratedProfilePage.test` (render con secciones, 401 → formulario → `X-Access-Token` → 200, `?token=` automático, 404, error de red → reintentar, home = `all`), `ProfileMenu.test` (14 perfiles agrupados por `roleType`, `techFocus`, activo, enlaces sin `token`).

## Navegador (API real, backend en :3300 con seed, Vite en :5173)

Capturas en `verification/` (Chrome headless 1280×900 / 375×812; el flujo del token también se ejecutó a mano en el navegador integrado).

| Criterio (SPECS-POR-FASE § Fase 4) | Evidencia | Resultado |
|---|---|---|
| Home con datos reales | `01-home-1280.png`: nombre del perfil base, 15 experiencias, 12 categorías; secciones `hero, stats, experience, skills, education, certifications, contact` + `projects, presence` al final | ✅ |
| `/:slug` | `02-tech-lead-dotnet.png`: "Tech Lead .NET", 13 experiencias, tema `modern-dark` (`--t-accent #38bdf8`) | ✅ |
| Tema en runtime sin recarga | `13-runtime-theme-switch.png`: selector → `modern-light`; `--t-bg` `#0a0e1a` → `#f8fafc`, `--t-text` `#0f172a`, URL pasa a `?theme=modern-light`, `performance.getEntriesByType('navigation')` sigue en 1 | ✅ |
| 5 presets distintos | `04`–`07` + `01`: bg/accent `#0a0e1a/#38bdf8`, `#f8fafc/#0284c7`, `#ffffff/#18181b`, `#1a1814/#c8a04e`, `#f9fafb/#1d4ed8`; botón primario de shadcn toma el acento (`rgb(200,160,78)` en elegant) | ✅ |
| ES/EN | `03-home-en.png`: títulos "Professional Experience…" y datos en inglés; petición `?locale=en` | ✅ |
| 2 layouts | `08-layout-sidebar.png`: `data-layout="sidebar"`, `hero` + `contact` en `aside`; classic en `01` | ✅ |
| Responsive 375/1280 | `09-mobile-375.png`, `14-mobile-menu.png`: sin scroll horizontal (`scrollWidth === innerWidth`), skills en una columna, menú en panel lateral con 8 grupos (Perfil completo + 7 roleType) | ✅ |
| PROTECTED con token | `11-protected-form.png` (401 → formulario), `12-protected-token.png` (`?token=` → perfil con 8 experiencias). A mano: token incorrecto → alerta "Token incorrecto…" y URL `?token=…`; token correcto → perfil | ✅ |
| 404 propia | `10-not-found.png`: "Perfil no encontrado" con enlace a la home | ✅ |
| Sin datos hardcodeados | `grep -ri "novacomp\|saavedra" frontend/src` → solo 3 líneas en `shared/types/api.d.ts`, y son comentarios `@example` copiados del contrato OpenAPI (`@ApiProperty({ example })` del backend); ningún componente ni test los usa. Excluyendo el archivo generado: sin resultados | ✅ |

Para la prueba PROTECTED se marcó temporalmente `dotnet-backend` como `PROTECTED` con `accessToken` vía `PATCH /api/admin/curated-profiles/:id` y se restauró a `PUBLIC` al terminar.

## Hallazgos durante la verificación

1. La base local tenía en el perfil `all` un `themeOverrides` residual (`accent #123456`, `mode light`) dejado por el e2e `curated-profile.e2e-spec.ts` de Fase 2/3, que no revierte su PATCH. Se limpió vía API (`themeOverrides: null`). Sugerencia para Fase 6: que ese e2e restaure el estado.
2. El perfil `all` no tiene `roleType` (cadena vacía): el menú lo agrupa primero bajo "Perfil completo" (fix + test en `group-profiles.ts`).
3. `tsx` no emite `emitDecoratorMetadata`, así que Nest no puede arrancar bajo `tsx`; `openapi:export` usa `ts-node --transpile-only`.
4. `openapi-fetch` captura `fetch` al crear el cliente; se pasa `fetch: (i) => globalThis.fetch(i)` para que MSW (y cualquier polyfill) lo intercepte.
5. El CLI de shadcn (Windows) escribió los componentes en una carpeta literal `@/` y agregó un paquete `cn` inexistente; se movieron a `src/shared/components/ui/` y se corrigieron los imports.
