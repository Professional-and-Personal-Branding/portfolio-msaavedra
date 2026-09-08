# Design — add-public-frontend-theming

## Context

Ver `proposal.md` y `docs/SPECS-POR-FASE.md` § Fase 4. La API expone todo lo necesario en una llamada (`GET /api/curated-profiles/:slug` → perfil base, experiencias, skills, proyectos, educación, certificaciones, social links, tema mergeado, `sections`/`hiddenSections`) más el listado para el menú y `Content-Language`. CORS permite `http://localhost:5173`. Versiones publicadas (2026-09-07): React 19.2.8, Vite 8.2.2, `@vitejs/plugin-react` 6.1, Tailwind 4.3.3 + `@tailwindcss/vite`, react-router 8.3, TanStack Query 5.102, Zustand 5, Motion 13.2 (`motion/react`, sucesor de framer-motion), lucide-react 1.41, shadcn CLI 4.21, openapi-typescript 7.13, openapi-fetch 0.17, Vitest 5, Testing Library 16, TypeScript 7.0 (nuevo compilador) / 5.9 (línea estable).

Dirección estética validada: `docs/demo.html` (tema oscuro moderno: hero con badge de disponibilidad, stats en tarjetas, timeline de experiencias con tags y badge "actual", grilla de skills por categoría, presencia pública con GitHub/LinkedIn protagonistas) y `docs/demo-theming.html` (presets, acentos, fuentes, modo, radio).

## Goals / Non-Goals

**Goals:** una SPA que se vea como el demo, 100 % alimentada por la API; theming y layouts como motores reutilizables por el backoffice (Fase 5); tipos generados del contrato; tests del motor sin navegador.
**Non-Goals:** editar tokens desde la UI pública, SSR, persistencia de preferencias, E2E de navegador automatizado (Fase 6).

## Decisions

### D1 — Stack y versiones
React 19.2 + Vite 8 + `@vitejs/plugin-react` 6; **TypeScript ~5.9** (misma línea que el backend; el compilador 7.0 es reciente y Vitest/ESLint aún lo soportan parcialmente); Tailwind 4 con `@tailwindcss/vite` (config CSS-first, sin `tailwind.config.js`); shadcn/ui vía CLI 4 (`--base-color neutral`, estilo `new-york`, componentes: `button, badge, card, sheet, dropdown-menu, tooltip, skeleton, separator, input`); Motion 13 (`motion/react`); lucide-react; TanStack Query 5; react-router 8 en modo declarativo (`BrowserRouter`/`Routes`); Zustand 5 para estado de UI (tema elegido, layout override, menú abierto); Zod (validación de tokens de tema al leerlos del backend) — React Hook Form queda instalado para Fase 5 pero no se usa aquí; Vitest 5 + Testing Library + jsdom; MSW 2 para mockear la API en tests de componentes; ESLint 9 flat + `typescript-eslint` + `eslint-plugin-react-hooks` + Prettier (mismas reglas que el backend).

### D2 — Contrato de tipos
Backend: `scripts/export-openapi.ts` crea la app con `NestFactory.create(AppModule, { logger: false })`, **sin `init()` ni `listen()`** (evita conectar Prisma), genera el documento con `SwaggerModule.createDocument` y escribe `backend/openapi.json`; script `openapi:export`. Frontend: `api:types` → `openapi-typescript ../backend/openapi.json -o src/shared/types/api.d.ts`; cliente `openapi-fetch` (`createClient<paths>({ baseUrl })`). Se versionan `openapi.json` y `api.d.ts` para que el frontend compile sin backend; un test del frontend comprueba que `api.d.ts` no está desactualizado respecto a `openapi.json` (hash en cabecera). `baseUrl` = `import.meta.env.VITE_API_URL ?? ''`; en dev, Vite proxy `/api` → `http://localhost:3300`.
*Alternativa*: generar tipos desde la API viva → obliga a tener el backend arriba para compilar.

### D3 — Estructura (CLAUDE.md §frontend)
```
frontend/src/
├── main.tsx · app/{App.tsx, providers.tsx, router.tsx, query-client.ts}
├── features/
│   ├── portfolio-public/   HomePage.tsx (renderiza CuratedProfileView con slug 'all')
│   ├── curated-view/       CuratedProfilePage.tsx · hooks/use-curated-profile.ts · components/{AccessTokenForm, NotFound, ErrorState, LoadingSkeleton}
│   └── navigation/         TopBar.tsx · ProfileMenu.tsx (agrupa por roleType) · LocaleSwitcher.tsx · ThemeSwitcher.tsx · LayoutSwitcher.tsx
├── shared/
│   ├── components/ui/      shadcn (generados) · components/portfolio/{Hero, Stats, ExperienceTimeline, SkillsGrid, Projects, Education, Certifications, Presence, Contact}
│   ├── lib/                api-client.ts · cn.ts · url-state.ts (lang/theme/layout/token ↔ URLSearchParams)
│   ├── i18n/               messages.ts (es/en) · use-locale.ts
│   ├── stores/             ui.store.ts (Zustand)
│   └── types/              api.d.ts (generado) · portfolio.ts (aliases de components.schemas)
└── themes/
    ├── tokens.ts           ThemeTokens + zod schema + DEFAULT (modern-dark) + mergeTokens
    ├── presets/            modern-dark.ts · modern-light.ts · minimal.ts · elegant.ts · corporate.ts · index.ts
    ├── theme-provider.tsx  aplica CSS vars al contenedor raíz; expone useTheme()
    ├── css-vars.ts         tokensToCssVars(tokens) → Record<'--t-…', string>
    ├── theme.css           @theme inline de Tailwind + mapeo shadcn (--background: var(--t-bg) …)
    └── layouts/            ClassicLayout.tsx · SidebarLayout.tsx · index.ts (registry) · sections.ts (orden/ocultas)
```

### D4 — Motor de theming
- `tokensToCssVars` produce `--t-bg, --t-bg-soft, --t-card, --t-border, --t-text, --t-text-muted, --t-accent, --t-accent2, --t-radius, --t-max-width, --t-font-sans, --t-font-heading, --t-space` (escala por `density`: compact 0.75, comfortable 1, spacious 1.25) y `--t-scale`.
- `theme.css`: `@theme inline { --color-bg: var(--t-bg); --color-card: var(--t-card); --color-accent: var(--t-accent); … --radius-theme: var(--t-radius); --font-sans: var(--t-font-sans); }` → utilidades `bg-bg`, `text-text-muted`, `border-border`, `bg-accent`, `rounded-theme`, `font-sans`. Variables de shadcn (`--background`, `--foreground`, `--card`, `--primary`, `--primary-foreground`, `--muted`, `--border`, `--ring`, `--radius`) se definen a partir de `--t-*` en `:root`/`[data-theme]`, así `Button`, `Card`, `Sheet` siguen el tema sin tocar sus fuentes. `mode` → `color-scheme` + clase `dark` en el contenedor (shadcn/Tailwind `dark:` variantes).
- `ThemeProvider` recibe `tokens` (del perfil curado) y el preset elegido (`ui.store`/`?theme=`); efectivo = preset elegido ? preset : mergeTokens(DEFAULT, tokensApi). Aplica estilos como `style={cssVars}` en un `<div data-theme=… className={mode}>` que envuelve la app (sin tocar `document.documentElement`, para que varios previews convivan en Fase 5). Fuentes: `<link>` a Google Fonts para Inter y Poppins se inyecta una vez; Georgia/JetBrains: stack de sistema.
- Motion: `<MotionSection>` con `initial/animate` solo si `effects.animations && !prefersReducedMotion` (`useReducedMotion`).
*Alternativa descartada*: `tailwind.config` con `colors: { accent: 'var(--accent)' }` (Tailwind 3): Tailwind 4 lo resuelve nativamente con `@theme inline`.

### D5 — Layouts y secciones
Registro `layouts = { classic: ClassicLayout, sidebar: SidebarLayout }`; `resolveLayout(name)` cae a `classic`. `orderSections(sections, hidden, data)` (función pura): recorre `sections` y luego agrega las conocidas faltantes en orden canónico `KNOWN_SECTIONS`; filtra ocultas y sin datos (`hasData(section, data)`). Cada sección es un componente que recibe el `CuratedProfileResponse` completo. `stats` derivado con `computeStats`.

### D6 — Estado y URL
`url-state.ts` centraliza `lang`, `theme`, `layout`, `token` en `useSearchParams`; `useLocale()` lee `lang` o `navigator.language`; `LocaleSwitcher` escribe `lang`. `ui.store` (Zustand) guarda solo lo efímero (menú abierto). Nada en `localStorage`.

### D7 — Datos
`useCuratedProfile(slug, { locale, token })` → `useQuery({ queryKey: ['curated', slug, locale, token] })` con `openapi-fetch`; 401 → estado `needsToken`; 404 → `notFound`; otros → `error` con `refetch`. `useCuratedProfiles(locale)` para el menú; `staleTime` 5 min. Header `X-Access-Token` cuando hay token.

### D8 — Estética
Tokens y componentes replican el demo: hero con badge de disponibilidad (`availability.startDate`), stats en tarjetas, timeline con badge "Actual"/"Current", tags de tecnologías, grilla de skills por categoría, proyectos en tarjetas con enlace, presencia con GitHub/LinkedIn destacados (`featured`) y `stats.repos`, contacto (email/teléfono/ubicación/idiomas). Clases Tailwind sobre tokens; nada de colores literales fuera de `presets/`.

### D9 — Tests
- Vitest (jsdom): `tokens.spec` (merge, defaults, zod rechaza tokens inválidos), `css-vars.spec` (mapa completo, densidad), `presets.spec` (5 presets, `bg`/`accent` distintos), `sections.spec` (orden API, faltantes al final, ocultas, vacías), `stats.spec`, `url-state.spec`, `messages.spec` (fallback `es`), `ThemeProvider.test` (variables en el DOM, cambio sin remount), `layouts.test` (classic/sidebar/desconocido), `CuratedProfilePage.test` con MSW (carga → render; 401 → formulario → reintento con header; 404; error → reintentar), `ProfileMenu.test` (agrupación por roleType), `api-types.spec` (hash de `openapi.json` coincide con el de `api.d.ts`).
- Verificación en navegador (Verifier, con la API real): home, `/tech-lead-dotnet`, cinco presets, ES/EN, `?layout=sidebar`, 375 px, `?token=` en un perfil PROTECTED; capturas en `verification/`.

### D10 — Calidad
`tsconfig` estricto (`strict`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`); `npm run typecheck` (`tsc -b`); ESLint + Prettier; `vite build` con `manualChunks` para `react`/`motion`; objetivo < 400 KB gzip inicial.

## Risks / Trade-offs

- [Stack muy reciente (Vite 8, Tailwind 4.3, router 8, Motion 13)] → todo estable y con docs; se pinnea con `~`; si el CLI de shadcn falla con Tailwind 4.3, se copian los componentes a mano (son archivos).
- [Google Fonts requiere red] → `font-display: swap` y fallbacks de sistema en `fontSans`.
- [`sections` del seed no incluye `projects`/`presence`] → regla "conocidas faltantes al final"; el backoffice (Fase 5) podrá ordenarlas explícitamente.
- [Token en `?token=`] → decisión heredada de Fase 2 (links compartibles); Fase 6 evalúa alternativas.

## Migration Plan

Nuevo directorio `frontend/`; `npm install`; `npm run api:types` (con `backend/openapi.json` versionado); `npm run dev` (proxy a 3300). Sin impacto en backend salvo el script de exportación. Rollback = borrar `frontend/`.

## Open Questions

- ¿Playwright para los criterios visuales? Diferible a Fase 6: no cambia specs ni el motor.
