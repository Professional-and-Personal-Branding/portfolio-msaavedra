# Backend — Portafolio Administrable

API NestJS 11 + Prisma 6 (PostgreSQL) en **Clean Architecture**. Fase 1 completada: módulos de referencia `profile` y `experience`, migración inicial versionada, seed desde `docs/cv-data.json`, endpoints públicos con Swagger e i18n ES/EN con fallback.

> Contrato de arquitectura: [`../CLAUDE.md`](../CLAUDE.md). Specs de negocio: [`../docs/SPECS-POR-FASE.md`](../docs/SPECS-POR-FASE.md). Diseño del change: [`../openspec/changes/archive/2026-09-06-add-backend-base/`](../openspec/changes/archive/2026-09-06-add-backend-base/).

## Requisitos

- Node.js 20+ (probado con 22) · npm 10
- Docker Desktop (Postgres 16 + Adminer vía `docker-compose.yml` en la raíz)

## Puesta en marcha

```bash
# 0. Desde la raíz del repo: levantar Postgres (5432) y Adminer (8080)
docker compose up -d
```

```bash
# 1. Configurar el backend
cd backend
cp .env.example .env        # ajustar PORT si el 3000 está ocupado (ej. PORT=3300)
npm install
```

```bash
# 2. Esquema y datos
npm run prisma:generate     # cliente Prisma
npm run prisma:migrate      # prisma migrate dev --name init (migración versionada; NUNCA db push)
npm run seed                # carga docs/cv-data.json (idempotente: limpia y recarga)
npm run seed:verify         # compara conteos DB vs cv-data.json
```

```bash
# 3. Arrancar
npm run start:dev           # http://localhost:$PORT/api  ·  Swagger: /api/docs  ·  OpenAPI: /api/docs-json
```

## Endpoints públicos

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/profile` | Perfil base (idiomas, disponibilidad) |
| GET | `/api/experiences` | Experiencias visibles, orden `order` asc + `startDate` desc |
| GET | `/api/experiences/:id` | Detalle de una experiencia visible (404 si no existe/oculta) |
| GET | `/api/docs` · `/api/docs-json` | Swagger UI · documento OpenAPI |

**Idioma:** `?locale=` > `?lang=` > header `Accept-Language` > `es`. Un locale no soportado cae a `es` (200, nunca 400). El locale servido viaja en el header `Content-Language`. Las respuestas traen strings ya resueltos, nunca objetos `{es,en}`.

## Scripts

| Script | Qué hace |
|---|---|
| `npm run start:dev` | NestJS en watch |
| `npm run build` / `start:prod` | Compila a `dist/` / ejecuta compilado |
| `npm run lint` / `lint:fix` | ESLint + Prettier |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Unitarios + test de arquitectura (regla de dependencia) |
| `npm run test:e2e` | E2E con supertest contra la base seedeada |
| `npm run test:all` | Ambos |
| `npm run prisma:migrate` / `prisma:status` | Migración `init` / estado de migraciones |
| `npm run seed` / `seed:verify` | Cargar / verificar datos |

## Estructura (módulo de referencia)

```
src/
├── main.ts · app.module.ts · app.constants.ts · swagger.ts
├── config/                       env.validation.ts (fail-fast) · configuration.ts
├── shared/
│   ├── domain/                   result.ts · errors/ · i18n/ (núcleo puro: Locale, resolveLocale…)
│   └── infrastructure/
│       ├── persistence/          prisma.service · prisma.module · json.guards
│       ├── i18n/resolve-locale   fachada (re-export del núcleo + normalizeLocale)
│       └── http/                 request-locale.decorator · content-language.interceptor · domain-error.mapper · cors.options
└── modules/
    ├── profile/                  domain/ · application/ · infrastructure/{persistence,controllers} · profile.module.ts
    └── experience/               (misma estructura + domain/services/sort-experiences.ts)
```

Regla de dependencia `domain ← application ← infrastructure`, verificada por `test/architecture.spec.ts`. Prisma solo en `infrastructure/persistence`. Casos de uso devuelven `Result<T,E>`; el controller traduce errores de dominio a HTTP con `toHttpException`.

## Cómo verificar los criterios de aceptación de la Fase 1

| Criterio | Cómo |
|---|---|
| `docker compose up -d` levanta Postgres y la app conecta | `docker ps` muestra `portfolio-postgres (healthy)`; `npm run start:dev` loguea "Conexión a PostgreSQL establecida" |
| `prisma migrate dev` genera migración versionada (no `db push`) | existe `prisma/migrations/<ts>_init/migration.sql`; `npm run prisma:status` → "up to date"; `grep "db push" package.json` vacío |
| El seed carga experiencias, perfiles, skills, educación, certificaciones y profile | `npm run seed && npm run seed:verify` → todos ✅ (15 experiencias, 14 perfiles curados = 13 plantillas + `all`) |
| `GET /api/experiences` y `GET /api/profile` responden | `curl localhost:$PORT/api/experiences` · `curl localhost:$PORT/api/profile` |
| Respeta `?locale=es\|en` | `curl "localhost:$PORT/api/profile?locale=en"` → `availability.startDate: "Immediate"` y `Content-Language: en` |
| Dominio aislado (caso de uso sin Prisma) | `npm test` → `test/architecture.spec.ts` en verde |
| Swagger en `/api/docs` | abrir `http://localhost:$PORT/api/docs` |

Evidencia registrada en [`../openspec/changes/archive/2026-09-06-add-backend-base/verification.md`](../openspec/changes/archive/2026-09-06-add-backend-base/verification.md).

## Notas

- **Puerto:** `.env.example` usa 3000. Si otro servicio lo ocupa, cambiá `PORT` en tu `.env` (no versionado).
- **Seed destructivo:** limpia y recarga todas las tablas. Es el flujo previsto hasta que exista el backoffice (Fase 5).
- **Versiones fijadas:** NestJS ~11.2 y Prisma ~6.19 (ver `openspec/changes/archive/2026-09-06-add-backend-base/design.md`, D1/D2). Los upgrades a NestJS 12 / Prisma 7 se harán como changes propios.
