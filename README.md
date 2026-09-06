# Portafolio Administrable — Manuel Saavedra

Portafolio web profesional administrable desde un backoffice, que permite crear **vistas curadas** del perfil profesional según la empresa o vacante objetivo.

## Concepto

En lugar de un CV estático, el sistema permite generar links únicos donde cada uno muestra una versión **filtrada y reordenada** del perfil. Digitaliza la lógica de "reposicionar el perfil según el público" que normalmente se hace manualmente con múltiples CVs.

## Stack

| Capa | Tecnología |
|------|-----------|
| Backend | NestJS + TypeScript · Clean Architecture · SOLID |
| ORM | Prisma |
| DB | PostgreSQL |
| Frontend | React + TypeScript + Vite |
| UI | shadcn/ui + Tailwind + Framer Motion |
| Data | TanStack Query · React Hook Form + Zod |

## Estructura del repositorio

```
portfolio/
├── backend/      # API NestJS (Clean Architecture)
├── frontend/     # SPA React + Vite
└── docs/
    ├── ARCHITECTURE.md   # ⭐ Fuente de verdad de la arquitectura y roadmap
    ├── cv-data.json      # Datos consolidados de toda la trayectoria (seed)
    └── demo.html         # Demo estático para validar dirección estética
```

## Cómo empezar

1. **Revisa la dirección estética:** abre `docs/demo.html` en el navegador. Cambia entre perfiles en la barra superior para ver el concepto de vistas curadas en acción.
2. **Lee la arquitectura:** `docs/ARCHITECTURE.md` contiene el roadmap completo por fases.
3. **Continúa con Claude Code:** abre este directorio y sigue el roadmap fase por fase.

## Roadmap resumido

- [x] **Fase 0** — Scaffolding, datos consolidados, demo estético
- [x] **Fase 1** — Backend NestJS base (módulos profile, experience) + Prisma + seed
- [x] **Fase 2** — Núcleo curated-profile (resolución por tags + overrides)
- [ ] **Fase 3** — Auth JWT + Backoffice API (CRUD)
- [ ] **Fase 4** — Frontend público (home + vista curada + temas)
- [ ] **Fase 5** — Frontend backoffice (constructor de perfiles)
- [ ] **Fase 6** — Pulido (SEO, export PDF, deploy)

Ver `docs/ARCHITECTURE.md` para el detalle completo.
