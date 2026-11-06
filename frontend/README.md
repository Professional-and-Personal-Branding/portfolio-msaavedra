# Frontend — Portafolio Administrable

SPA del portafolio: la vista pública (Fase 4, change `add-public-frontend-theming`) con home, perfil curado por slug, motor de theming por design tokens, dos layouts, bilingüe ES/EN y hoja imprimible (`add-printable-one-page`); y el backoffice en `/admin` (Fase 5, change `add-admin-backoffice`, ampliado en la ronda 1.1). Todo el contenido viene de la API del backend; no hay datos hardcodeados.

## Stack

React 19 · Vite 8 · TypeScript 5.9 (estricto) · Tailwind CSS 4 (`@tailwindcss/vite`, config CSS-first) · shadcn/ui (`new-york`) · Motion (paquete `motion`, `motion/react`) · lucide-react · TanStack Query 5 · react-router 8 (data router: `createBrowserRouter` con una ruta comodín que monta las `<Routes>` declarativas) · Zustand · Zod 4 (`zod/mini` en el arranque público) · openapi-fetch + openapi-typescript · ESLint 10 · Vitest 5 + Testing Library + MSW · `puppeteer-core` y `axe-core` (solo para los checks).

## Puesta en marcha

```bash
# 0. Backend arriba (ver backend/README.md): API en http://localhost:3300 (PORT de backend/.env)
cd frontend
cp .env.example .env.local        # VITE_API_URL vacío → proxy /api → VITE_PROXY_TARGET
npm install
npm run dev                       # http://localhost:5173
```

Rutas: `/` (perfil curado `all`), `/:slug` (perfil curado), cualquier otra → 404 propia.

## Scripts

| Script | Qué hace |
|---|---|
| `npm run dev` | Vite con proxy `/api` → `VITE_PROXY_TARGET` (default `http://localhost:3300`) |
| `npm run build` | `tsc -b` + `vite build`. El arranque público es **un solo archivo JS de módulo** (≈ 148 KB gzip, tope de 155 KB en `perf:budget`) más el script clásico `profile-prefetch.js`; el panel y los menús de la barra salen en chunks aparte. Sin chunks `react`/`motion`/`query` |
| `npm run preview` | Sirve `dist/` |
| `npm run typecheck` | `tsc -b` |
| `npm run lint` / `lint:fix` | ESLint 10 flat (typescript-eslint, react-hooks, react-refresh) + Prettier |
| `npm run format` | Prettier sobre `src/` |
| `npm run test` / `test:watch` | Vitest (jsdom) |
| `npm run api:types` | Regenera `src/shared/types/api.d.ts` desde `../backend/openapi.json` |
| `npm run perf:budget` | Tope de JS del arranque público sobre `dist/` (≤ 155 KB gzip, un solo JS de módulo, sin `modulepreload`). Sin navegador ni base |
| `npm run print:check` | Genera el PDF de cada perfil en A4 y Letter (es/en, dos temas), cuenta las páginas (debe ser 1) y mide el contraste. Abre páginas reales: exige `PRINT_CHECK_DISPOSABLE_DB=1` y una base **descartable** |
| `npm run a11y:check -- <base>` | axe-core + recorrido de teclado en la vista pública y, con `A11Y_CHECK_ADMIN_EMAIL`/`_PASSWORD`, en el panel. Exige `A11Y_CHECK_DISPOSABLE_DB=1` y una base **descartable**; se corre contra la imagen de `Dockerfile` |
| `npm run perf:check -- <base>` | Lighthouse mobile (mediana de `PERF_CHECK_RUNS`, umbral `PERF_CHECK_MIN_PERFORMANCE`; 85 en el CI). Misma exigencia que `a11y:check` |

Los umbrales y el uso de los tres checks están en [`../docs/MANUAL.md`](../docs/MANUAL.md) § 5.1; el job `web-quality` del CI los corre en cada PR.

## Contrato de tipos (spec `api-contract-types`)

1. En `backend/`: `npm run openapi:export` escribe `backend/openapi.json` (sin levantar servidor ni base).
2. En `frontend/`: `npm run api:types` genera `src/shared/types/api.d.ts` con `openapi-typescript`.
3. Ambos archivos se versionan: el frontend compila sin backend. `src/shared/types/api-types.spec.ts` falla si `api.d.ts` no corresponde al `openapi.json` (hash en la cabecera).

El cliente es `openapi-fetch` (`src/shared/lib/api-client.ts`): una ruta o campo inexistente en el contrato no compila. `src/shared/types/portfolio.ts` expone aliases (`CuratedProfile`, `Experience`, …).

## Estructura

```
src/
├── main.tsx · app/{App, providers, router, query-client}
├── features/
│   ├── portfolio-public/   HomePage (perfil curado `all`)
│   ├── curated-view/       CuratedProfilePage · CuratedProfileView (orquestador) · hooks/use-curated-profile · components/{AccessTokenForm, NotFound, ErrorState, LoadingSkeleton}
│   └── navigation/         TopBar · ProfileMenu (agrupa por roleType) · ThemeSwitcher · LayoutSwitcher · LocaleSwitcher
├── shared/
│   ├── components/ui/      shadcn/ui (generados por el CLI)
│   ├── components/portfolio/ Hero · Stats · ExperienceTimeline · SkillsGrid · Projects · Education · Certifications · Presence · Contact
│   ├── lib/                api-client · url-state (lang/theme/layout/token ↔ URL) · profile-link · stats · format · utils(cn)
│   ├── i18n/               locale · messages (es/en) · use-locale
│   ├── stores/             ui.store (Zustand: solo estado efímero)
│   └── types/              api.d.ts (generado) · portfolio.ts
└── themes/
    ├── tokens.ts           ThemeTokens (zod) · DEFAULT_TOKENS (modern-dark) · mergeTokens · parseThemeTokens
    ├── presets/            modern-dark · modern-light · minimal · elegant · corporate (mismos tokens que el seed)
    ├── css-vars.ts         tokensToCssVars → `--t-*`
    ├── theme.css           Tailwind `@theme inline` + variables shadcn derivadas de `--t-*` + utilidades (`surface`, `chip`, `text-gradient`, …)
    ├── theme-provider.tsx  aplica las variables al contenedor raíz; use-theme.ts · motion-section.tsx
    └── layouts/            ClassicLayout · SidebarLayout · sections.ts (orden/ocultas/vacías) · section-registry
```

## Theming (spec `runtime-theming`)

- `ThemeProvider` recibe `theme.tokens` del perfil curado y el preset elegido (`?theme=`). Precedencia: preset del visitante > tema del perfil > `modern-dark`. Tokens parciales se completan con `modern-dark`.
- Los tokens se aplican como `--t-bg`, `--t-accent`, `--t-radius`, `--t-font-sans`, … en un `<div data-theme>` que envuelve la app (no en `document.documentElement`, así varios previews podrán convivir en Fase 5). `mode` → `color-scheme` + clase `dark`.
- `theme.css` deriva de `--t-*` (a) las utilidades Tailwind `bg-bg`, `bg-bg-soft`, `bg-card`, `border-border`, `text-text`, `text-text-muted`, `text-text-dim`, `bg-brand`, `text-brand-2`, `rounded-theme`, `font-heading`, `p-card`, `mb-section` y (b) las variables de shadcn/ui (`--primary`, `--card`, `--muted`, `--ring`, `--radius`, …), por eso `Button`, `Sheet`, etc. siguen el tema sin modificar sus fuentes. El acento del tema se llama `brand` en Tailwind para no colisionar con el `accent` (hover sutil) de shadcn.
- Nada de colores literales fuera de `themes/presets/`.
- `effects.animations = false` o `prefers-reduced-motion` desactivan las animaciones de entrada (`MotionSection`).

## Layouts y secciones (spec `layout-engine`)

- Registro `LAYOUTS = { classic, sidebar }`; `?layout=` sobrescribe el `layout` del perfil; desconocido → `classic`.
- El **backend decide** el orden, el ocultado y el relleno de las secciones (catálogo de 9 ids, enum `SectionId`; change `unify-section-catalog`); el cliente renderiza `sections` tal cual llega, con un registro `Record<SectionId, …>` que falla al compilar si falta una.
- `stats` se deriva de los datos (`computeStats`): años, experiencias, tecnologías únicas, certificaciones.

## Idioma (spec `frontend-localization`)

`?lang=es|en` > `navigator.language` (`en*` → `en`, resto → `es`). Toda petición envía `?locale=`; los textos de interfaz salen de `shared/i18n/messages.ts` con fallback a `es`. Sin `localStorage`.

## Perfiles protegidos

Si la API responde 401, se muestra un formulario de token; al enviarlo se reintenta con `X-Access-Token` y la URL refleja `?token=` (enlace compartible). `?token=` en la URL se usa automáticamente.

## Backoffice (`/admin`, Fase 5)

Panel de administración dentro del mismo proyecto, cargado con `React.lazy` en su propio chunk: un visitante anónimo no lo descarga.

| Ruta | Qué hace |
|---|---|
| `/admin/login` | Email y contraseña contra `POST /api/auth/login` |
| `/admin` | Dashboard de visitas (`ProfileView`) por perfil, idioma, día y origen, con rango de fechas |
| `/admin/portada` | Perfil base (titular, resumen, contacto, disponibilidad) e idiomas (nivel en ES/EN), con vista previa del hero |
| `/admin/experiencias` | Alta, edición y borrado de experiencias, con textos ES/EN (también los logros), tags y visibilidad |
| `/admin/skills` | Categorías y skills, con sus tags |
| `/admin/formacion` | Educación y certificaciones |
| `/admin/proyectos` | Proyectos destacados y enlaces sociales |
| `/admin/perfiles` | Listado de perfiles curados con sus visitas; duplicar y archivar |
| `/admin/perfiles/:id` | Constructor: identidad, selección, diseño y publicación, con vista previa en vivo (ES/EN) y aviso de traducciones faltantes |

Los formularios con cambios sin guardar avisan antes de descartarse (guardián de navegación compartido, `useBlocker` + `beforeunload`).

### Sesión

El login emite una cookie `httpOnly` (`portfolio_session`): el frontend **nunca** guarda el JWT, y deriva la sesión de `GET /api/auth/me`, así que sobrevive a un refresh sin `localStorage`. Un 401 en cualquier petición del panel invalida la sesión y devuelve al login recordando el destino. `Cerrar sesión` llama a `POST /api/auth/logout`.

### Constructor de perfiles curados

- **Selección**: los tags se ofrecen desde el universo real de los datos (experiencias, skills y proyectos); además se puede forzar la inclusión o exclusión de una experiencia concreta.
- **Vista previa en vivo**: cada cambio de selección, layout o secciones llama a `POST /api/admin/curated-profiles/preview` (agrupado con 400 ms de retardo) y se renderiza con los **mismos componentes** de la vista pública, así que lo que ves es lo que verá quien abra el link.
- **Publicación**: visibilidad `PUBLIC`/`PRIVATE`/`PROTECTED` (con token obligatorio), link público con copiar y abrir; en los protegidos el link incluye `?token=`.

### Customizador de tema

Ocho colores con selector y campo hexadecimal, tipografía, modo claro/oscuro, densidad y radio. Los tokens se aplican en el cliente con el `ThemeProvider`, así que el preview responde **sin ir a la red**; al guardar se persisten solo las diferencias contra el tema base en `themeOverrides` del perfil. Restablecer deja el perfil con el tema base limpio.

El panel usa siempre el preset `modern-dark` para su propia interfaz: cambiar el tema del perfil no altera los colores del panel, porque cada `ThemeProvider` aplica sus variables a su contenedor.

## SEO (spec `public-seo`)

Al resolver un perfil, la vista pública escribe en el documento el título, la descripción, el `canonical`, las etiquetas OpenGraph y Twitter Card y un bloque JSON-LD `ProfilePage` con el `Person` en `mainEntity` (`shared/lib/document-meta.ts`; solo en perfiles públicos, igual que el del servidor). Cambian con el perfil y con el idioma, y se restauran al salir. Los perfiles `PRIVATE`/`PROTECTED` y todo `/admin` van con `noindex`.

`robots.txt` y `sitemap.xml` los sirve el **backend**, que es quien conoce los perfiles públicos.

El **head por perfil sale del servidor** (change `add-server-rendered-head`): Caddy pide `GET /api/public/profile-head?slug=&lang=` y lo inserta en el HTML inicial, así que LinkedIn, WhatsApp y Slack, que no ejecutan JavaScript, ya ven la tarjeta del perfil. Si la API falla o tarda más de 500 ms, el sitio sirve el head genérico. El cliente reutiliza las etiquetas del servidor en lugar de duplicarlas. Falta verificarlo con el Post Inspector de LinkedIn y con Slack una vez desplegado (`docs/RELEASE-1.0.0-CHECKLIST.md`).

## Hoja imprimible

Un perfil se imprime o se guarda como PDF en una sola hoja (A4 o Letter) con **Ctrl+P** o con el botón *Imprimir / Guardar PDF* de la barra. `PrintableSheet` se monta junto al layout de pantalla y solo se ve al imprimir; `buildPrintSheet` aplica los límites de contenido y la paleta de papel (`themes/presets/paper.ts`) es fija. No pide nada a la API ni suma una visita. `npm run print:check` lo verifica.

## Accesibilidad y rendimiento

El acento, el texto atenuado y el texto del botón se derivan del tema con contraste AA (`--t-accent-ink`, `--t-text-dim`), el foco es un contorno sólido de 2 px (`--t-ring`) y hay un enlace *Saltar al contenido* en el sitio y en el panel. El arranque público abre el hero primero, carga en diferido los menús de la barra, sirve Inter desde `public/fonts/` y pide el perfil desde `public/profile-prefetch.js` mientras baja el bundle. Detalle en `docs/CHANGELOG.md` (`improve-a11y-and-performance` e `improve-mobile-performance`).

## Tests

`npm run test`: motor de theming (tokens, presets, css-vars, ThemeProvider), orden de secciones, stats, estado de URL, diccionario, menú de perfiles, layouts y la página completa con MSW (carga, `?lang=`, 401 → token → 200, 404, error → reintentar). Los datos de prueba viven en `src/test/fixtures/` (ficticios).
