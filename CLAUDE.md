# CLAUDE.md — Contexto del Proyecto

> Este archivo es leído automáticamente por Claude Code. Define convenciones, arquitectura y reglas que **deben respetarse** en todo el desarrollo. La fuente de verdad ampliada está en `docs/ARCHITECTURE.md`.

---

## Qué es este proyecto

Portafolio web profesional **administrable** de Manuel Saavedra. El núcleo es el concepto de **perfiles curados** (`CuratedProfile`): vistas filtradas y personalizadas del perfil profesional, generadas para empresas o vacantes específicas, accesibles por un `slug` único.

---

## Stack (NO cambiar sin acuerdo explícito)

- **Backend:** NestJS (v11.x estable) + TypeScript estricto · Clean Architecture + SOLID
- **ORM:** Prisma (PostgreSQL) — CONFIRMADO
- **Frontend:** React 18/19 + TypeScript + Vite
- **UI:** shadcn/ui + Tailwind CSS + Framer Motion + Lucide React
- **Data fetching:** TanStack Query v5 · **Forms:** React Hook Form + Zod · **Estado:** Zustand
- **Theming:** design tokens en DB → CSS variables en runtime (pilar del producto)

---

## Reglas de Arquitectura (Clean Architecture) — OBLIGATORIAS

Estructura por módulo de dominio, con la regla de dependencia estricta:

```
domain  ←  application  ←  infrastructure
```

1. **`domain/`** — Entidades, value objects, interfaces de repositorio (puertos), errores de dominio. NO depende de NADA externo. Sin decoradores de NestJS, sin Prisma, sin librerías de infraestructura.
2. **`application/`** — Casos de uso (un caso de uso = una clase con un único método `execute()`), DTOs, mappers. Depende solo de `domain`. Define puertos que infraestructura implementa.
3. **`infrastructure/`** — Implementaciones concretas: repositorios Prisma (adaptadores), controllers HTTP, módulos NestJS. Depende de `application` y `domain`.

**Reglas concretas:**
- Prisma vive SOLO en `infrastructure/persistence/`. Nunca importar `@prisma/client` en domain o application.
- Los casos de uso reciben interfaces de repositorio por inyección (DIP), no clases concretas. Usar tokens de inyección de NestJS.
- Manejo de errores en domain con un patrón `Result<T, E>` (Either) — evitar lanzar excepciones desde el dominio.
- DTOs de entrada validados con `class-validator` + `class-transformer`.
- Cada módulo expone su `*.module.ts` que cablea las dependencias (provee implementaciones para los tokens).

**Módulo de referencia:** implementar primero `profile` y `experience` con esta estructura completa y bien hecha; servirán de plantilla para los demás.

---

## Estructura de carpetas

```
backend/src/
├── modules/
│   ├── profile/        { domain, application, infrastructure, profile.module.ts }
│   ├── experience/
│   ├── skill/
│   ├── curated-profile/   # núcleo del producto
│   ├── theme/             # sistema de personalización
│   ├── education/
│   └── auth/
├── shared/
│   ├── domain/         # BaseEntity, Result type, errores base
│   ├── application/
│   └── infrastructure/ # PrismaService, guards, interceptors, config
├── config/
└── main.ts
```

```
frontend/src/
├── app/                # providers, router
├── features/           # portfolio-public, curated-view, backoffice
├── shared/             # components/ui, hooks, lib, types
└── themes/             # theme-provider, presets, tokens, layouts
```

---

## Convenciones de código

- **TypeScript estricto:** `strict: true`, sin `any` (usar `unknown` + narrowing).
- **Naming:** PascalCase para clases/tipos, camelCase para variables/funciones, kebab-case para archivos.
- **Casos de uso:** nombre verbo + sustantivo, ej. `ResolveCuratedProfileUseCase`, `CreateExperienceUseCase`.
- **Commits:** conventional commits (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`).
- **Tests:** Jest (backend), Vitest (frontend). Casos de uso deben tener tests unitarios con repositorios mockeados.
- **Validación frontend:** Zod schemas compartidos donde sea posible.
- **No usar** `localStorage`/`sessionStorage` en componentes que puedan correr en SSR; preferir estado en memoria o cookies httpOnly para auth.

---

## El núcleo: ResolveCuratedProfile

Dado un `slug`, el caso de uso `ResolveCuratedProfileUseCase`:
1. Busca el `CuratedProfile` por slug. Si no existe o no es visible → error de dominio.
2. Si es `PROTECTED`, valida el token de acceso.
3. Resuelve las **experiencias** y **skills** aplicando:
   - Filtro por `filterTags` (incluir si el item comparte al menos un tag).
   - Overrides: `includeIds` fuerza inclusión, `excludeIds` fuerza exclusión.
   - Orden: por `order` y luego por fecha descendente.
4. Resuelve el **tema**: `theme` base + `themeOverrides` (merge profundo).
5. Aplica `sectionsOrder` y `sectionsHidden`.
6. Incrementa el contador de vistas (registrar `ProfileView`).
7. Devuelve un DTO de presentación listo para el frontend.

Este caso de uso es el corazón del producto — implementarlo con tests exhaustivos.

---

## Comandos esperados (definir en package.json)

```
# Backend
npm run start:dev        # NestJS en watch
npm run prisma:migrate   # prisma migrate dev
npm run prisma:generate  # prisma generate
npm run seed             # carga docs/cv-data.json
npm run seed:verify      # compara conteos DB vs cv-data.json
npm run test             # jest

# Frontend
npm run dev              # vite
npm run build
npm run test             # vitest
```

---

## Roadmap (seguir en orden — detalle en docs/ARCHITECTURE.md)

- [x] Fase 0 — Scaffolding, datos, demos, estos artefactos
> Specs por fase con criterios de aceptación: `docs/SPECS-POR-FASE.md` (guía SDD).

- [x] Fase 1 — Backend base (profile, experience) + Prisma + seed + Swagger — change `add-backend-base` (ver `openspec/changes/archive/`)
- [ ] Fase 2 — curated-profile (ResolveCuratedProfile)
- [ ] Fase 3 — auth JWT + backoffice API (CRUD)
- [ ] Fase 4 — frontend público + motor de theming
- [ ] Fase 5 — frontend backoffice + customizador visual
- [ ] Fase 6 — hardening para producción (ver `docs/RELEASE-1.0.0-CHECKLIST.md`) → deploy 1.0.0

---

## Decisiones tomadas (no re-litigar sin motivo)

- ORM = Prisma.
- Theming basado en design tokens + CSS variables en runtime (sin rebuild al cambiar tema).
- Monolito modular (no microservicios) para el MVP.
- Dos carpetas independientes (backend / frontend); considerar monorepo (Turborepo/Nx) solo si se necesita compartir tipos intensivamente.
- Tipos del frontend: generar desde el OpenAPI del backend (openapi-typescript) para contrato único.

---

## Internacionalización (i18n) — datos bilingües

Los datos son **bilingües ES/EN en un solo registro** (sin duplicar). Ver `docs/I18N.md` para el diseño completo.
- Campos traducibles (`role`, `summary`, `highlights`, `headline`, `title`, `description`, `degree`, `name` de categorías, etc.) se almacenan como `Json` (LocalizedText `{es,en}` o LocalizedList `{es:[],en:[]}`).
- Campos no traducibles (empresa, tecnologías, tags, fechas, slug) son planos.
- El **function switch** central es `resolveLocale(field, locale)` / `resolveLocaleList(...)` con fallback al `DEFAULT_LOCALE='es'`. Su núcleo puro vive en `shared/domain/i18n` (usable desde domain/application); `shared/infrastructure/i18n/resolve-locale.ts` lo re-exporta y agrega `normalizeLocale` (parsing HTTP).
- Los casos de uso reciben `locale: Locale` y lo propagan a los mappers de aplicación (las entidades de dominio permanecen bilingües); los controllers lo leen con `@RequestLocale()`: `?locale=` > `?lang=` > `Accept-Language` > `es`.
- Los DTOs de salida vienen ya resueltos (strings planos); el frontend no maneja objetos localizados.
- Para agregar un idioma: extender el tipo `Locale` y agregar la clave al JSON — sin filas nuevas.

## Datos de seed

`docs/cv-data.json` contiene la trayectoria consolidada (14 experiencias, skills por categoría, educación, certificaciones, **2 proyectos destacados** y **13 plantillas de perfil curado**). Cada perfil curado tiene una taxonomía de navegación (`roleType` bilingüe + `techFocus`) que el frontend usa para agrupar el menú por tipo de rol (Tech Lead, Backend, Fullstack, DevOps, Arquitecto, Liderazgo, Generalista) mostrando la tecnología destacada. El script `backend/scripts/seed.ts` lo carga en la base. El schema incluye un modelo `Project` para los proyectos destacados.
