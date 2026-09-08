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
3. **Levanta el producto:** `docker compose up -d` → `backend/` (`npm install && npm run prisma:migrate && npm run seed && npm run admin:bootstrap && npm run start:dev`) → `frontend/` (`npm install && npm run dev`). El portafolio queda en http://localhost:5173 y el backoffice en http://localhost:5173/admin. Detalles en `backend/README.md` y `frontend/README.md`.
4. **Continúa con Claude Code:** abre este directorio y sigue el roadmap fase por fase.

## Roadmap resumido

- [x] **Fase 0** — Scaffolding, datos consolidados, demo estético
- [x] **Fase 1** — Backend NestJS base (módulos profile, experience) + Prisma + seed
- [x] **Fase 2** — Núcleo curated-profile (resolución por tags + overrides)
- [x] **Fase 3** — Auth JWT + Backoffice API (CRUD)
- [x] **Fase 4** — Frontend público (home + vista curada + temas + layouts, bilingüe) — change `add-public-frontend-theming`
- [x] **Fase 5** — Frontend backoffice (login, dashboard, CRUD, constructor y customizador) — change `add-admin-backoffice`
- [ ] **Fase 6** — Pulido (SEO, export PDF, deploy)

Ver `docs/ARCHITECTURE.md` para el detalle completo.
