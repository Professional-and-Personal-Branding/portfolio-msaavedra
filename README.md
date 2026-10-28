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
| UI | shadcn/ui + Tailwind + Motion (paquete `motion`) |
| Data | TanStack Query · React Hook Form + Zod |

## Estructura del repositorio

```
portfolio/
├── backend/      # API NestJS (Clean Architecture)
├── frontend/     # SPA React + Vite (y la imagen de producción con Caddy)
├── openspec/     # Specs vigentes (specs/) y changes (changes/, archivados en changes/archive/)
├── CLAUDE.md     # Convenciones y decisiones del proyecto (lo lee Claude Code)
├── STEPS.md      # Guía histórica de arranque, paso a paso
└── docs/
    ├── ARCHITECTURE.md   # ⭐ Fuente de verdad de la arquitectura y roadmap
    ├── SPECS-POR-FASE.md # Specs por fase con criterios de aceptación (guía SDD)
    ├── ROADMAP-1.1.md    # Cómo se decidió la ronda 1.1 y qué quedó diferido
    ├── CHANGELOG.md      # Historia por change, de los datos al hardening y la ronda 1.1
    ├── DEPLOY.md         # Runbook de producción: referencia (variables, arranque, backups, proveedores)
    ├── DEPLOY-RAILWAY.md # Guía corta para desplegar en Railway, paso a paso
    ├── RELEASE-1.0.0-CHECKLIST.md  # Estado de cada ítem del release
    ├── MANUAL.md         # Uso de la plataforma, caso por caso (panel + API)
    ├── manual/index.html # El mismo manual, interactivo: índice, filtros y capturas
    ├── I18N.md           # Diseño de los datos bilingües ES/EN
    ├── DATA-POPULATION.md # Cómo se cargan y mantienen los datos (seed)
    ├── KICKOFF-ClaudeCode.md # Documento histórico del arranque (Fase 0)
    ├── cv-data.json      # Datos consolidados de toda la trayectoria (seed)
    ├── fixtures/         # Datos de prueba de contrato (p. ej. consistencia del head por perfil)
    ├── demo.html         # Demo estático para validar dirección estética
    └── demo-theming.html # Demo estático del sistema de theming
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
- [x] **Fase 6** — Hardening para producción (errores, health, límites, cabeceras, logs, SEO) — change `add-production-hardening`
- [x] **Ronda 1.1** — head SEO por perfil servido desde el servidor, ciclo de vida de los perfiles (duplicar, archivar, enumerar, alias de slug), contenido administrable desde el panel y paridad bilingüe del constructor (`docs/ROADMAP-1.1.md`)
- [x] **Después de la ronda 1.1** — aviso de cambios sin guardar y CSP del sitio, `accentColor` retirado, hoja imprimible de una página, nivel de idioma bilingüe, accesibilidad AA, y rendimiento mobile (Performance ≥ 85 en el CI) (`docs/CHANGELOG.md`)
- [ ] **Deploy 1.0.0** — Railway: seguir `docs/DEPLOY-RAILWAY.md` (guía corta) y `docs/DEPLOY.md` (referencia), y cerrar los backups

Ver `docs/ARCHITECTURE.md` para el detalle completo.
