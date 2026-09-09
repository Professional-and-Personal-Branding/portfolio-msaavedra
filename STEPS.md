# STEPS — Cómo continuar con Claude Code

Guía paso a paso para arrancar el desarrollo del portafolio. Seguir en orden.

---

## Paso 0 — Preparación del entorno (una sola vez)

Asegurate de tener instalado en tu máquina:

- **Node.js 20+** (recomendado 22 LTS)
- **Docker Desktop** (para la base de datos local)
- **Claude Code** (CLI de Anthropic)
- **Git**

```bash
node --version    # v20+ o v22
docker --version
git --version
```

---

## Paso 1 — Descomprimir y abrir

```bash
# Descomprimir el ZIP donde quieras tu proyecto
unzip portfolio.zip
cd portfolio

# Inicializar git
git init
git add .
git commit -m "chore: scaffolding inicial del portafolio"

# Abrir con Claude Code
claude
```

Al abrir, Claude Code leerá automáticamente `CLAUDE.md` (contexto y reglas de arquitectura).

---

## Paso 2 — Validar la dirección estética (opcional pero recomendado)

Antes de programar, abrí en tu navegador para confirmar que la dirección visual te gusta:

- `docs/demo.html` — concepto de perfiles curados con los **10 perfiles** (Java Senior, Full-Stack, AI Engineer, DevOps, DevOps Azure, .NET, Microsoft, Arquitecto, Integración, Jefe de TI)
- `docs/demo-theming.html` — personalización en vivo (temas, colores, fuentes)

Si querés ajustar algo de la estética, decíselo a Claude Code antes de la Fase 4.

> 📋 Para entender cómo se cargan y actualizan tus datos, leé `docs/DATA-POPULATION.md` — explica el flujo JSON → seed → base de datos y cómo agregar nuevos perfiles curados al generar un CV nuevo.

---

## Paso 3 — FASE 1: Backend base

Prompt sugerido para Claude Code:

> "Lee CLAUDE.md y docs/ARCHITECTURE.md. Inicializa el proyecto NestJS dentro de backend/ respetando Clean Architecture. Usa el schema.prisma que ya existe en backend/prisma/. Configura Prisma, levanta la base con `docker compose up -d`, corre la migración inicial y ejecuta el seed (backend/scripts/seed.ts que lee docs/cv-data.json). Luego implementa los módulos `profile` y `experience` completos (domain, application, infrastructure) como módulos de referencia, con endpoints públicos de lectura y documentación Swagger."

**Resultado esperado:** backend corriendo en `localhost:3000`, Swagger en `/api`, base poblada con tu trayectoria.

Verificá:
```bash
docker compose up -d           # base de datos
cd backend
npm run prisma:migrate
npm run seed
npm run start:dev
# abrir http://localhost:3000/api (Swagger)
# abrir http://localhost:8080 (Adminer, para ver la DB)
```

---

## Paso 4 — FASE 2: Núcleo de perfiles curados

> "Implementa el módulo `curated-profile` con el caso de uso `ResolveCuratedProfileUseCase` siguiendo la lógica descrita en CLAUDE.md (filtrado por tags + overrides + resolución de tema + secciones). Agrega los endpoints públicos: GET /api/public/curated/:slug y POST /api/public/curated/:slug/access para perfiles protegidos. Tests unitarios del caso de uso con repositorios mockeados."

---

## Paso 5 — FASE 3: Auth + Backoffice API

> "Implementa el módulo `auth` con JWT (login del backoffice). Luego el CRUD protegido de experiencias, skills y perfiles curados, y el endpoint de analítica de visitas. Aplica guards JWT a las rutas /api/admin/*."

---

## Paso 6 — ✅ FASE 4: Frontend público + motor de theming (change `add-public-frontend-theming`)

> "Inicializa el frontend en frontend/ con React + Vite + TypeScript + Tailwind + shadcn/ui + TanStack Query. Implementa el ThemeProvider que inyecta design tokens como CSS variables en runtime, los 5 presets de tema, la vista pública (home) y la vista de perfil curado por slug. Consume la API del backend."

Hecho. Para levantarlo:

```bash
cd backend && npm run openapi:export   # solo si cambió el contrato de la API
cd ../frontend
cp .env.example .env.local && npm install
npm run api:types                      # solo si cambió backend/openapi.json
npm run dev                            # http://localhost:5173 (proxy /api → backend en 3300)
```

Prueba: `/` (perfil `all`), `/tech-lead-dotnet`, `?theme=elegant`, `?layout=sidebar`, `?lang=en`, `?token=` en un perfil PROTECTED. Ver `frontend/README.md`.

---

## Paso 7 — ✅ FASE 5: Frontend backoffice + customizador (change `add-admin-backoffice`)

> "Implementa el backoffice: login, dashboard con analítica, CRUD visual de experiencias y skills, y el constructor de perfiles curados con preview en vivo, selección de tags, elección de tema/layout y el customizador visual (color pickers, fuente, modo claro/oscuro) aplicando cambios en tiempo real."

Hecho. Para usarlo:

```bash
cd backend && npm run admin:bootstrap   # crea el administrador desde ADMIN_EMAIL / ADMIN_PASSWORD
npm run start:dev
cd ../frontend && npm run dev
# abrir http://localhost:5173/admin e iniciar sesión
```

Flujo típico: **Perfiles curados → Nuevo perfil →** poné slug, título y titular → pestaña **Selección** para elegir tags (el preview de la derecha muestra al instante qué experiencias entran) → pestaña **Diseño** para el tema, el layout y el orden de secciones → **Publicación** para la visibilidad y el link → **Guardar**. Ver `frontend/README.md`.

---

## Paso 8 — ✅ FASE 6: Hardening para producción (change `add-production-hardening`)

> "Agrega SEO y OpenGraph para compartir links, exportación de un perfil curado a PDF, optimización responsive y de accesibilidad. Prepara configuración de deploy (backend en Railway/Render, frontend en Vercel, Postgres gestionada)."

Hecho el hardening: manejo global de errores, healthcheck, rate limiting, cabeceras de seguridad, logs estructurados y SEO. El export a PDF quedó como deseable de 1.0.x.

**El deploy es tuyo**: seguí `docs/DEPLOY.md` de arriba abajo (variables, `prisma migrate deploy`, healthcheck del proveedor, backups y su prueba de restauración) y después la verificación posterior de la § 5. El estado de cada ítem del release está en `docs/RELEASE-1.0.0-CHECKLIST.md`.

---

## Recordatorios importantes

- **Respetá la regla de dependencia:** domain ← application ← infrastructure. Prisma SOLO en infrastructure.
- **Un caso de uso = una clase con `execute()`.**
- **Avanzá fase por fase**, commiteando con conventional commits al cerrar cada bloque.
- **El `CuratedProfile` es el corazón** del producto — vale la pena implementarlo con tests sólidos.
- Si Claude Code propone cambiar el stack o saltarse la arquitectura, recordale las decisiones en CLAUDE.md.

---

## Estructura del proyecto (referencia)

```
portfolio/
├── CLAUDE.md                      # contexto para Claude Code (se lee solo)
├── README.md
├── STEPS.md                       # este archivo
├── .gitignore
├── docker-compose.yml             # PostgreSQL + Adminer
├── docs/
│   ├── ARCHITECTURE.md            # fuente de verdad de arquitectura + roadmap
│   ├── DATA-POPULATION.md         # guía de populación de datos (JSON → seed → DB)
│   ├── CHANGELOG.md               # historial de cambios en los datos
│   ├── cv-data.json               # datos consolidados (seed)
│   ├── demo.html                  # demo concepto perfiles curados (10 perfiles)
│   └── demo-theming.html          # demo personalización en vivo
└── backend/
    ├── prisma/
    │   └── schema.prisma          # modelo de datos completo
    ├── scripts/
    │   └── seed.ts                # carga cv-data.json
    └── .env.example               # variables de entorno (copiar a .env)
├── frontend/                      # SPA React + Vite (Fase 4): ver frontend/README.md
└── openspec/                      # specs, changes y archivo (SDD)
```

`backend/src/` y `frontend/src/` se construyeron en las Fases 1–4; el backoffice web llega en la Fase 5.
