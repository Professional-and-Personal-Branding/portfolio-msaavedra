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

```
frontend/src/
├── app/                      # Configuración de la app, providers, router
├── features/                 # Features por dominio (screaming architecture)
│   ├── portfolio-public/     # Vista pública del portafolio
│   ├── curated-view/         # Renderizado de un perfil curado por slug
│   └── backoffice/           # Panel de administración
│       ├── experiences/
│       ├── skills/
│       ├── curated-profiles/
│       └── dashboard/
├── shared/                   # Componentes, hooks, utils transversales
│   ├── components/ui/        # shadcn/ui components
│   ├── components/portfolio/ # Componentes específicos del portafolio
│   ├── hooks/
│   ├── lib/                  # api client, query client, utils
│   └── types/                # Tipos compartidos (idealmente generados del backend)
├── themes/                   # ⭐ Motor de plantillas / temas conmutables
│   ├── minimal/
│   ├── modern/
│   └── elegant/
└── main.tsx
```

### Motor de plantillas (temas)
Cada `CuratedProfile` puede elegir un **tema visual**. Los temas son componentes React que reciben los mismos datos y los renderizan con estéticas distintas. Esto da el "design profesional para UX regia" solicitado:
- **minimal** — limpio, tipográfico, foco en contenido
- **modern** — gradientes sutiles, glassmorphism, animaciones Framer Motion
- **elegant** — serif + sans, espaciado generoso, tono corporativo

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
- `GET /api/curated-profiles` · `GET /api/curated-profiles/:slug` — perfil curado resuelto ✅ Fase 2 (PROTECTED: token por header `X-Access-Token` o `?token=`; PRIVATE → 404)
- ~~`POST /api/curated-profiles/:slug/access`~~ — no necesario: el token viaja en el `GET` (puede añadirse en Fase 3 si el frontend lo requiere)
- Idioma por request: `?locale=` > `?lang=` > `Accept-Language` > `es`. Swagger en `/api/docs`, OpenAPI en `/api/docs-json`.

### Backoffice (protegidos con JWT)
- `POST /api/auth/login`
- `GET|POST|PATCH|DELETE /api/admin/experiences`
- `GET|POST|PATCH|DELETE /api/admin/skills`
- `GET|POST|PATCH|DELETE /api/admin/curated-profiles`
- `GET /api/admin/analytics` — visitas por perfil

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

### Fase 3 — Auth + Backoffice API
1. Módulo `auth` con JWT.
2. CRUD completo de experiencias, skills, perfiles curados.
3. Analítica de visitas.

### Fase 4 — Frontend público + Motor de Theming
1. Setup React + Vite + Tailwind (configurado para leer CSS variables) + shadcn/ui + React Query.
2. `ThemeProvider` que inyecta design tokens como CSS variables en runtime.
3. Implementar los 5 presets de tema (modern-dark, modern-light, minimal, elegant, corporate).
4. Vista pública general (home) y vista de perfil curado por slug, ambas theme-aware.
5. Motor de layouts: al menos ClassicLayout + un segundo layout estructural.

### Fase 5 — Frontend backoffice + Customizador visual
1. Login.
2. Dashboard con analítica.
3. CRUD visual de experiencias/skills.
4. Constructor de perfiles curados: seleccionar tags, preview en vivo, elegir tema/layout, ordenar y ocultar secciones, generar link.
5. **Customizador de tema con preview en vivo:** color pickers, selector de fuente, toggle claro/oscuro, densidad — aplicando cambios en tiempo real sobre un preview del perfil.

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
- Tailwind se configura para leer de esas CSS variables (`colors: { accent: 'var(--color-accent)' }`), permitiendo que las utilidades respondan al tema activo.

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
