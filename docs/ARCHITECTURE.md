# Portafolio Administrable — Manuel Saavedra
## Documento de Arquitectura y Roadmap (para Claude Code)

---

## 1. Visión del Producto

Portafolio web profesional **administrable desde un backoffice** que permite a Manuel crear **"vistas curadas"** (perfiles) de su información profesional, mostrando únicamente las experiencias, skills y proyectos relevantes según la empresa o vacante objetivo.

**Concepto central — "Perfiles curados":** En lugar de un CV estático, Manuel genera links únicos (ej. `/p/java-senior-backend`, `/p/empresa-acme`) donde cada uno muestra una versión filtrada y reordenada de su perfil. Esto digitaliza la lógica que se aplicó manualmente en los 8+ CVs generados: reposicionar el perfil según el público objetivo.

### Casos de uso
1. **Vista pública general** — portafolio completo en la home.
2. **Vistas curadas por perfil** — Java Senior, DevOps, .NET, Jefe de TI, etc. (filtradas por tags).
3. **Vistas privadas por empresa** — link con slug único + opción de protección (token/clave) para enviar a un reclutador específico.
4. **Backoffice** — CRUD de experiencias, skills, perfiles curados; toggle de visibilidad por elemento; analítica básica de visitas.

---

## 2. Stack Tecnológico (definido por Manuel)

### Backend — NestJS (monolito con Clean Architecture)
- **NestJS** (última versión estable, v11.x) + **TypeScript** estricto
- **Arquitectura:** Monolito modular con **Clean Architecture** + **SOLID**
- **ORM:** Prisma (recomendado por DX y type-safety) o TypeORM
- **Base de datos:** PostgreSQL
- **Auth:** JWT (Passport) para el backoffice
- **Validación:** class-validator + class-transformer (DTOs)
- **Docs:** Swagger/OpenAPI (@nestjs/swagger)

### Frontend — React (con TypeScript)
- **React 18/19** (estable) + **TypeScript** + **Vite**
- **Routing:** React Router v6/v7
- **Data fetching:** TanStack Query (React Query) v5
- **Estado:** Zustand (ligero) para estado global del backoffice
- **Formularios:** React Hook Form + Zod (validación type-safe)
- **UI / Estética (motor de plantillas / design system):**
  - **shadcn/ui** + **Tailwind CSS** como base del design system
  - **Framer Motion** para animaciones profesionales
  - **Lucide React** para iconografía
  - Plantillas de portafolio premium con temas conmutables

### Calidad y Tooling
- ESLint + Prettier, Husky + lint-staged (pre-commit)
- Vitest (frontend) + Jest (backend) para testing
- Docker Compose para entorno local (Postgres + servicios)

---

## 3. Arquitectura del Backend (Clean Architecture)

Estructura monolito modular siguiendo Clean Architecture. Cada módulo de dominio respeta las capas:

```
backend/src/
├── modules/
│   ├── profile/              # Información base del perfil
│   │   ├── domain/           # Entidades, value objects, interfaces de repositorio
│   │   │   ├── entities/
│   │   │   ├── repositories/ # Interfaces (puertos)
│   │   │   └── value-objects/
│   │   ├── application/      # Casos de uso (interactors), DTOs
│   │   │   ├── use-cases/
│   │   │   ├── dto/
│   │   │   └── mappers/
│   │   ├── infrastructure/   # Implementaciones (adaptadores)
│   │   │   ├── persistence/  # Repositorios Prisma, entidades ORM
│   │   │   └── controllers/  # Controllers HTTP
│   │   └── profile.module.ts
│   ├── experience/           # Experiencias laborales
│   ├── skill/                # Skills y categorías
│   ├── curated-profile/      # ⭐ Perfiles curados (núcleo del producto)
│   ├── education/            # Formación académica
│   └── auth/                 # Autenticación del backoffice
├── shared/                   # Código transversal
│   ├── domain/               # Base entities, Result type, errores de dominio
│   ├── application/          # Interfaces compartidas
│   └── infrastructure/       # Config, Prisma service, guards, interceptors
├── config/                   # Configuración (env, validación)
└── main.ts
```

### Principios Clean Architecture aplicados
- **Regla de dependencia:** domain no depende de nada; application depende de domain; infrastructure depende de application y domain. Nunca al revés.
- **Puertos y adaptadores:** los casos de uso dependen de interfaces de repositorio (puertos), implementadas en infrastructure (adaptadores Prisma).
- **Inversión de dependencias (DIP):** se inyectan interfaces, no implementaciones concretas. NestJS DI con tokens.
- **Casos de uso explícitos:** cada operación de negocio es un use case con un único método `execute()`.

### Modelo de dominio núcleo (curated-profile)
El módulo `curated-profile` es el corazón. Un `CuratedProfile`:
- Tiene un `slug` único (para la URL pública).
- Define `filterTags` que determinan qué experiencias/skills se incluyen.
- Permite override manual: incluir/excluir elementos específicos, reordenar.
- Tiene metadatos: título, headline, descripción, color de acento, visibilidad (público/privado/protegido), y opcional token de acceso.
- Registra visitas (analítica básica).

---

## 4. Arquitectura del Frontend

Implementado en la Fase 4 (change OpenSpec `add-public-frontend-theming`); `backoffice/` llega en la Fase 5.

```
frontend/src/
├── main.tsx · app/{App, providers, router, query-client}
├── features/
│   ├── portfolio-public/     HomePage → perfil curado `all`
│   ├── curated-view/         CuratedProfilePage · CuratedProfileView (orquesta URL → API → layout) · hooks/use-curated-profile · components/{AccessTokenForm, NotFound, ErrorState, LoadingSkeleton}
│   ├── navigation/           TopBar · ProfileMenu (agrupado por roleType) · ThemeSwitcher · LayoutSwitcher · LocaleSwitcher
│   └── backoffice/           BackofficeApp (chunk aparte) · auth/{LoginPage, RequireSession, use-session} · dashboard/ · experiencias/ · skills/ · curated-profiles/{ProfilesPage, ProfileBuilderPage, PreviewPanel, use-preview} · theme-customizer/ · shared/{AdminShell, ConfirmDialog, fields/}
├── shared/
│   ├── components/ui/        shadcn/ui (generados por el CLI, sin modificar)
│   ├── components/portfolio/ Hero · Stats · ExperienceTimeline · SkillsGrid · Projects · Education · Certifications · Presence · Contact
│   ├── lib/                  api-client (openapi-fetch) · url-state (lang/theme/layout/token) · profile-link · stats · format · utils
│   ├── i18n/                 locale · messages (es/en, fallback es) · use-locale
│   ├── stores/               ui.store (Zustand: solo estado efímero)
│   └── types/                api.d.ts (generado de backend/openapi.json) · portfolio.ts (aliases)
└── themes/                   ⭐ Motor de theming y layouts
    ├── tokens.ts             ThemeTokens (zod) · DEFAULT_TOKENS (modern-dark) · mergeTokens · parseThemeTokens
    ├── presets/              modern-dark · modern-light · minimal · elegant · corporate
    ├── css-vars.ts           tokens → `--t-*`
    ├── theme.css             Tailwind `@theme inline` + variables shadcn derivadas + utilidades
    ├── theme-provider.tsx    aplica `--t-*` al contenedor raíz · use-theme · motion-section
    └── layouts/              ClassicLayout · SidebarLayout · sections.ts (orden/ocultas/vacías) · section-registry
```

### Contrato de tipos
`backend: npm run openapi:export` → `backend/openapi.json` (sin servidor ni DB) → `frontend: npm run api:types` → `src/shared/types/api.d.ts`. Ambos versionados; `api-types.spec.ts` detecta la deriva por hash. El cliente `openapi-fetch` hace que una ruta o campo inexistente no compile.

### Motor de theming
Un `Theme` son design tokens (ver §8.1). `ThemeProvider` recibe `theme.tokens` del perfil curado y el preset elegido por el visitante (`?theme=`), completa los tokens parciales con `modern-dark` y los aplica como CSS variables `--t-*` en un contenedor raíz (no en `documentElement`, para que en Fase 5 convivan varios previews). Tailwind 4 los expone con `@theme inline` y las variables de shadcn/ui derivan de ellos, así los componentes de librería siguen el tema sin tocar su código. `mode` alterna paleta, `layout.density` escala el espaciado, `effects.animations`/`prefers-reduced-motion` gobiernan las animaciones (Motion).

### Motor de layouts
Los layouts son componentes que reciben los mismos datos: `classic` (una columna, hero arriba) y `sidebar` (identidad + contacto fijos a la izquierda). El layout activo es el del perfil curado; `?layout=` lo sobrescribe; desconocido → `classic`. Las secciones se renderizan en el orden de `sections` de la API; las conocidas con datos no listadas se agregan al final; ocultas y vacías no se renderizan. `stats` se deriva de los datos.

### Estado en la URL
`?lang=`, `?theme=`, `?layout=` y `?token=` (perfiles PROTECTED) viven en la URL: enlaces compartibles y nada en `localStorage`.

### Backoffice (Fase 5)
El panel vive en `/admin`, dentro del mismo proyecto, y reutiliza el cliente tipado, el motor de theming y los layouts de la Fase 4; se carga con `React.lazy`, así que el visitante anónimo no lo descarga. La sesión es una cookie `httpOnly` que emite el login: el cliente no guarda el JWT y deriva el estado de `GET /api/auth/me`, de modo que sobrevive a un refresh sin usar `localStorage`.

El constructor de perfiles curados previsualiza el borrador con `POST /api/admin/curated-profiles/preview`, que resuelve **sin guardar** usando `CuratedProfileComposer`, el mismo servicio de aplicación que la ruta pública (extraído de `ResolveCuratedProfileUseCase` en esta fase). Los cambios de selección se agrupan con un retardo de 400 ms; los del tema no van a la red, porque el customizador aplica los tokens en el cliente con el `ThemeProvider` y al guardar persiste solo las diferencias contra el tema base en `themeOverrides`.

---

## 5. Modelo de Datos (Prisma Schema — borrador)

```prisma
model Profile {
  id          String   @id @default(cuid())
  fullName    String
  headline    String
  location    String
  email       String
  phone       String?
  summary     String   @db.Text
  // ... campos del perfil base
}

model Experience {
  id           String   @id @default(cuid())
  company      String
  role         String
  startDate    String
  endDate      String?
  current      Boolean  @default(false)
  location     String
  summary      String   @db.Text
  highlights   String[] // array de logros
  technologies String[]
  tags         String[] // para filtrado por perfil curado
  sector       String[]
  order        Int      @default(0)
  visible      Boolean  @default(true)
}

model SkillCategory {
  id     String   @id @default(cuid())
  name   String
  order  Int      @default(0)
  skills Skill[]
}

model Skill {
  id         String        @id @default(cuid())
  name       String
  tags       String[]
  category   SkillCategory @relation(fields: [categoryId], references: [id])
  categoryId String
}

model CuratedProfile {
  id          String   @id @default(cuid())
  slug        String   @unique
  title       String
  headline    String
  description String?
  filterTags  String[] // tags que definen qué se muestra
  includeIds  String[] // overrides: forzar inclusión
  excludeIds  String[] // overrides: forzar exclusión
  accentColor String   @default("#1A365D")
  theme       String   @default("modern")
  visibility  Visibility @default(PUBLIC)
  accessToken String?  // para perfiles protegidos
  views       Int      @default(0)
  createdAt   DateTime @default(now())
}

enum Visibility {
  PUBLIC
  PRIVATE
  PROTECTED
}

model Education { /* ... */ }
model Certification { /* ... */ }
model ProfileView { /* analítica: slug, timestamp, referrer */ }
```

---

## 6. API Endpoints (borrador)

### Públicos (rutas planas bajo `/api`, según los criterios de `docs/SPECS-POR-FASE.md`)
- `GET /api/profile` — perfil base ✅ Fase 1
- `GET /api/experiences` · `GET /api/experiences/:id` — experiencias visibles, orden cronológico ✅ Fase 1
- `GET /api/curated-profiles` · `GET /api/curated-profiles/:slug` — perfil curado resuelto ✅ Fase 2 (PROTECTED: token por header `X-Access-Token` o `?token=`; PRIVATE → 404); incluye proyectos filtrados, educación, certificaciones y enlaces sociales ✅ (`add-portfolio-sections-api`)
- `GET /api/education` · `GET /api/certifications` · `GET /api/projects` · `GET /api/social-links` — secciones del portafolio ✅ (`add-portfolio-sections-api`)
- ~~`POST /api/curated-profiles/:slug/access`~~ — no necesario: el token viaja en el `GET` (puede añadirse en Fase 3 si el frontend lo requiere)
- Idioma por request: `?locale=` > `?lang=` > `Accept-Language` > `es`. Swagger en `/api/docs`, OpenAPI en `/api/docs-json`.

### Backoffice (protegidos con JWT: header `Authorization: Bearer` o cookie de sesión) ✅ Fases 3 y 5
- `POST /api/auth/login` · `GET /api/auth/me`
- `GET|POST /api/admin/experiences` · `GET|PATCH|DELETE /api/admin/experiences/:id`
- `GET|POST /api/admin/skill-categories` · `PATCH|DELETE /api/admin/skill-categories/:id` · `POST /api/admin/skill-categories/:id/skills` · `PATCH|DELETE /api/admin/skills/:id`
- `GET|POST /api/admin/curated-profiles` · `GET|PATCH|DELETE /api/admin/curated-profiles/:id`
- `GET /api/admin/analytics/views?from&to` — visitas por perfil, idioma y día
- Contraseñas: argon2id. Administrador único vía `npm run admin:bootstrap`. Rate limiting, Helmet y cookies: Fase 6.

---

## 7. Roadmap de Desarrollo (fases para Claude Code)

> **Specs ejecutables por fase:** cada fase tiene su especificación con criterios de aceptación y prompt de arranque en **`docs/SPECS-POR-FASE.md`** — usarla como contrato de Spec-Driven Development al implementar con Claude Code.

### ✅ Fase 0 — Scaffolding (este MVP)
- Estructura de carpetas, datos consolidados (cv-data.json), documentación.
- Demo HTML estática del portafolio para validar la dirección estética.

### ✅ Fase 1 — Backend base (change OpenSpec `add-backend-base`, sept. 2026)
1. Inicializar NestJS + Prisma + PostgreSQL (Docker Compose).
2. Definir schema Prisma y migración inicial.
3. Seed con los datos de `cv-data.json`.
4. Módulo `profile` y `experience` con Clean Architecture completa (un módulo de referencia bien hecho).
5. Endpoints públicos de lectura + Swagger.

### ✅ Fase 2 — Núcleo curated-profile (change OpenSpec `add-curated-profile-resolution`, sept. 2026)
1. Módulo `curated-profile` con lógica de resolución (filtrado por tags + overrides).
2. Caso de uso `ResolveCuratedProfile`: dado un slug, devuelve perfil + experiencias filtradas y ordenadas.
3. Endpoints públicos de perfiles curados.

### ✅ Fase 3 — Auth + Backoffice API (change OpenSpec `add-auth-and-crud`, sept. 2026)
1. Módulo `auth` con JWT.
2. CRUD completo de experiencias, skills, perfiles curados.
3. Analítica de visitas.

### ✅ Fase 4 — Frontend público + Motor de Theming (change OpenSpec `add-public-frontend-theming`, sept. 2026)
1. ✅ React 19 + Vite 8 + TypeScript 5.9 + Tailwind 4 (`@theme inline` sobre `--t-*`) + shadcn/ui + TanStack Query + react-router 8 + Motion.
2. ✅ `ThemeProvider` que inyecta design tokens como CSS variables en runtime (contenedor raíz).
3. ✅ Los 5 presets (modern-dark, modern-light, minimal, elegant, corporate) con selector en la barra (`?theme=`).
4. ✅ Home (perfil curado `all`) y vista por slug, bilingües (`?lang=`), con estados de carga/error/404/token.
5. ✅ Layouts `classic` + `sidebar` (`?layout=`), orden/ocultamiento de secciones y stats derivadas.
6. ✅ Tipos generados del OpenAPI (`openapi:export` + `api:types`, versionados).

### ✅ Fase 5 — Frontend backoffice + Customizador visual (change OpenSpec `add-admin-backoffice`, sept. 2026)
1. ✅ Login con sesión por cookie httpOnly y rutas `/admin/*` protegidas.
2. ✅ Dashboard de visitas (`ProfileView`) por perfil, idioma y día, con rango de fechas.
3. ✅ CRUD visual de experiencias y skills, con campos bilingües ES/EN y confirmaciones.
4. ✅ Constructor de perfiles curados: tags del universo real, include/exclude por experiencia, preview en vivo resuelto por el backend, tema y layout, orden y ocultamiento de secciones, visibilidad y link público.
5. ✅ Customizador de tema en tiempo real (8 colores, tipografía, modo, densidad, radio) que guarda solo las diferencias como `themeOverrides`.

### Fase 6 — Hardening para producción (release 1.0.0)

Esta fase prepara el proyecto para un despliegue serio. El detalle completo, priorizado en bloqueantes / importantes / deseables, está en **`docs/RELEASE-1.0.0-CHECKLIST.md`** — trabajarlo como checklist explícito.

Resumen de lo que cubre:
- **🔴 Bloqueantes:** secretos fuertes, migraciones Prisma (`migrate deploy`), CORS estricto, validación de inputs (DTOs + ValidationPipe), manejo global de errores, healthcheck.
- **🟡 Importantes:** rate limiting (throttler), security headers (Helmet) + HTTPS, logging estructurado, tests mínimos (curated-profile + i18n fallback), SEO + OpenGraph, backup de DB.
- **🔵 Deseables (1.0.x):** export PDF de perfil, accesibilidad, caché/performance, dashboard de analítica (`ProfileView`), CI/CD, repos destacados reales.

**El deploy real es el ÚLTIMO paso** (backend en Railway/Render, frontend en Vercel, DB Postgres gestionada), una vez que los bloqueantes e importantes estén en verde.

---

## 8. Decisiones técnicas

### ✅ Decisiones confirmadas por Manuel
- **ORM: Prisma** (confirmado). Usar Prisma como adaptador de persistencia en la capa de infrastructure. Las interfaces de repositorio (puertos) viven en domain; las implementaciones Prisma en infrastructure. Prisma nunca debe filtrarse hacia domain o application.
- **Estética: validada** (tema oscuro moderno del demo) **+ requisito de ser totalmente customizable** (ver sección 8.1). El sistema de temas es un pilar del producto, no un agregado.

### 8.1 — Sistema de Personalización (Theming) — PILAR DEL PRODUCTO

El portafolio debe ser **customizable a nivel visual sin tocar código**, administrable desde el backoffice. Cada `CuratedProfile` referencia un `Theme` y puede sobreescribir tokens puntuales.

**Modelo de theming basado en design tokens:**
- Un `Theme` es un conjunto de **design tokens** (colores, tipografía, radios, espaciado, modo claro/oscuro) almacenado como JSON en la base de datos.
- El frontend consume los tokens y los aplica vía **CSS Custom Properties** en runtime (`:root { --color-accent: ... }`), de modo que cambiar un tema no requiere rebuild.
- Tailwind se configura para leer de esas CSS variables, permitiendo que las utilidades respondan al tema activo. Implementación (Fase 4): Tailwind 4 con `@theme inline { --color-brand: var(--t-accent); … }` en `frontend/src/themes/theme.css`; el acento se llama `brand` en Tailwind para no colisionar con el `accent` de shadcn/ui, cuyas variables (`--primary`, `--card`, `--muted`, …) también derivan de `--t-*`.

**Tokens mínimos del Theme (JSON):**
```json
{
  "name": "Modern Dark",
  "mode": "dark",
  "colors": {
    "bg": "#0a0e1a", "bgSoft": "#111827", "card": "#161d2e",
    "border": "#252d42", "text": "#e8edf5", "textMuted": "#94a3b8",
    "accent": "#38bdf8", "accent2": "#818cf8"
  },
  "typography": { "fontSans": "Inter", "fontHeading": "Inter", "scale": "default" },
  "layout": { "radius": "16px", "maxWidth": "1100px", "density": "comfortable" },
  "effects": { "animations": true, "glassmorphism": true }
}
```

**Tres niveles de personalización (de menor a mayor control):**
1. **Presets de tema** — temas predefinidos seleccionables con un clic: `modern-dark`, `modern-light`, `minimal`, `elegant`, `corporate`.
2. **Override de tokens por perfil** — desde el backoffice, ajustar color de acento, fuente, modo claro/oscuro, densidad, radios — con **preview en vivo**. Se guarda como `themeOverrides` (JSON parcial) en el `CuratedProfile`.
3. **Layout / plantilla estructural** — elegir qué secciones se muestran y en qué orden (hero, stats, experiencia, skills, educación, certificaciones, contacto), y qué "layout component" las renderiza. Este es el motor de plantillas: distintos layouts consumen los mismos datos.

**Arquitectura frontend del theming:**
```
frontend/src/themes/
├── theme-provider.tsx      # Context que inyecta tokens como CSS vars en runtime
├── presets/                # Temas predefinidos (JSON/TS)
│   ├── modern-dark.ts
│   ├── modern-light.ts
│   ├── minimal.ts
│   ├── elegant.ts
│   └── corporate.ts
├── tokens.ts               # Tipos TS de los design tokens (contrato)
└── layouts/                # Motor de plantillas estructurales
    ├── ClassicLayout.tsx
    ├── SidebarLayout.tsx
    └── TimelineLayout.tsx
```

El `ThemeProvider` recibe `theme + themeOverrides` resueltos del backend, hace merge profundo, y aplica los tokens como CSS variables en un contenedor raíz. Cambiar tema = cambiar variables = sin recarga ni rebuild.

**Modelo de datos adicional (Prisma):**
```prisma
model Theme {
  id        String   @id @default(cuid())
  name      String
  slug      String   @unique
  isPreset  Boolean  @default(false)
  tokens    Json     // design tokens completos
  createdAt DateTime @default(now())
}
// CuratedProfile gana estos campos:
//   themeId        String?   (FK a Theme; si null usa default)
//   themeOverrides Json?     (override parcial de tokens)
//   layout         String    @default("classic")
//   sectionsOrder  String[]  (orden de secciones)
//   sectionsHidden String[]  (secciones ocultas)
```

### Otras decisiones recomendadas

- **Prisma sobre TypeORM:** mejor DX, type-safety, migraciones más simples. Encaja con el énfasis en TypeScript estricto. (CONFIRMADO)
- **Monorepo opcional:** considerar Nx o Turborepo si se quiere compartir tipos entre back y front. Para el MVP, dos carpetas independientes es suficiente.
- **Tipos compartidos:** generar tipos del frontend desde el OpenAPI del backend (openapi-typescript) para mantener contrato único.
- **Resultado type (Result/Either):** en domain, usar un patrón Result para manejo de errores explícito sin excepciones, alineado con Clean Architecture.

---

## 9. Cómo continuar con Claude Code

Abrir este directorio con Claude Code y pedir, fase por fase:
1. "Inicializa el backend NestJS con la estructura de Clean Architecture descrita en docs/ARCHITECTURE.md, empezando por el módulo profile."
2. "Genera el schema Prisma y el seed a partir de docs/cv-data.json."
3. ... seguir el roadmap.

Mantener este documento como fuente de verdad de la arquitectura.
