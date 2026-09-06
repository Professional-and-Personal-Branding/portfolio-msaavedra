# Kick-Off — Portafolio Administrable con Claude Code
### Paquete de arranque · SDD Agéntico + OpenSpec + Graphify · Manuel Saavedra · Agosto 2026

> Este documento es el **punto de entrada** para construir el proyecto con Claude Code. Contiene: (1) los insumos que ya existen, (2) el setup de herramientas (OpenSpec + Graphify), (3) la arquitectura de agentes y el harness, (4) la estrategia iterativa de SDD, y (5) el prompt de kick-off para pegar en Claude Code. Leélo una vez, seguí el orden.

---

## 0. TL;DR — QUÉ VAS A HACER

1. Instalar OpenSpec (SDD) y Graphify (optimización de tokens).
2. Crear `AGENTS.md` (contrato para los agentes) que complementa tu `CLAUDE.md`.
3. Ejecutar el ciclo `propose → apply → archive` por cada change, empezando por `add-backend-base` (Fase 1).
4. Vos sos el **Human Gate**: aprobás cada propuesta antes de que se escriba código.

---

## 1. INSUMOS QUE YA EXISTEN (Fase 0 completa)

El proyecto ya trae todo el andamiaje. Claude Code parte de acá, no de cero:

| Insumo | Qué aporta |
|---|---|
| `CLAUDE.md` | Contrato de arquitectura, stack, convenciones, reglas de Clean Architecture |
| `docs/ARCHITECTURE.md` | Visión, capas, modelo de datos, endpoints |
| `docs/SPECS-POR-FASE.md` | Las 6 specs de fase con criterios de aceptación (input de negocio) |
| `docs/RELEASE-1.0.0-CHECKLIST.md` | Checklist de hardening para producción |
| `backend/prisma/schema.prisma` | 14 modelos de datos completos |
| `backend/scripts/seed.ts` | Carga `cv-data.json` a la DB |
| `backend/src/shared/.../resolve-locale.ts` | Motor de i18n ya implementado |
| `docs/cv-data.json` | **15 experiencias reales, actualizadas y coherentes con los CVs** |
| `docker-compose.yml` | Postgres 16 + Adminer listo |

**Lo que NO existe y hay que construir:** todo el código de aplicación (módulos backend, casos de uso, controllers, frontend). Ese es el trabajo de las Fases 1-6.

---

## 2. SETUP DE HERRAMIENTAS

### 2.1 OpenSpec (la disciplina SDD)

OpenSpec gobierna el flujo spec-driven: separa `specs/` (la verdad del sistema) de `changes/` (propuestas activas), con el ciclo propose → apply → archive.

```bash
# Instalar OpenSpec (vía npx, sin API keys) — el paquete npm es @fission-ai/openspec
npx @fission-ai/openspec@latest init
# Esto crea la estructura openspec/ y registra los slash commands
```

Resultado: una carpeta `openspec/` con `specs/`, `changes/` y `AGENTS.md`.

### 2.2 Graphify (optimización de tokens)

Graphify convierte el código en un grafo consultable, para que los agentes recuperen contexto puntual en vez de leer archivos enteros — clave para no quemar tokens a medida que el código crece.

```bash
# Requisitos: Python 3.10+ y uv
uv tool install graphify-labs
# Generar el grafo de conocimiento del código
graphify
# En Claude Code, luego: /graphify
```

**Cuándo corre:** al principio el proyecto es chico (poco que grafiar), pero a partir de la Fase 2-3, cuando haya varios módulos, Graphify empieza a rendir. Configuralo como pre-commit hook para mantener el grafo sincronizado. Genera `GRAPH_REPORT.md` (resumen de arquitectura) y `graph.json` (grafo consultable).

**Regla de uso:** antes de que un agente explore el código para una tarea, que consulte el grafo (`/graphify`) en vez de leer archivo por archivo.

---

## 3. ARQUITECTURA DE AGENTES + HARNESS

### 3.1 El harness (el andamiaje que orquesta)

El **harness** es la estructura que coordina los agentes especializados, gestiona el estado entre fases, y mantiene el control humano en los puntos críticos. En Claude Code, el harness se materializa como: subagentes con roles definidos + los slash commands de OpenSpec + el grafo de Graphify como memoria compartida + vos en el gate.

```
┌──────────────────── HARNESS ────────────────────┐
│  Estado compartido: openspec/specs (verdad)      │
│  Memoria de código: graph.json (Graphify)        │
│  Contrato: CLAUDE.md + AGENTS.md                 │
│                                                   │
│  ┌─────────┐  ┌──────────┐  ┌──────────────┐     │
│  │EXPLORER │─▶│ARCHITECT │─▶│  HUMAN GATE  │     │
│  │/graphify│  │(propose) │  │  (vos)       │     │
│  └─────────┘  └──────────┘  └──────┬───────┘     │
│                                     │ aprobado    │
│  ┌──────────┐  ┌──────────┐  ┌─────▼──────┐      │
│  │ REVIEWER │◀─│ VERIFIER │◀─│IMPLEMENTER │      │
│  │(archive) │  │(tests)   │  │(apply)     │      │
│  └──────────┘  └──────────┘  └────────────┘      │
└───────────────────────────────────────────────────┘
```

### 3.2 Los agentes y sus patrones

| Agente | Patrón agéntico | Responsabilidad | Herramienta |
|---|---|---|---|
| **Explorer** | ReAct (razona+observa) | Entiende el código actual y el alcance | `/graphify` para no leer archivos enteros |
| **Architect** | Planning | Redacta la propuesta OpenSpec (proposal/design/tasks) | `openspec propose` |
| **Human Gate** | — (control humano) | Aprobás/corregís la spec antes del código | Vos |
| **Implementer** | Tool use + codegen | Escribe código acotado a la propuesta | `openspec apply` |
| **Verifier** | Reflection/self-critique | Corre los criterios de aceptación como tests | Jest/e2e |
| **Reviewer** | Reflection | Code review + sincroniza `specs/` | `openspec archive` |

**Regla del harness (máx. 3 ciclos):** si el Verifier falla, vuelve al Implementer con el feedback — máximo 3 iteraciones generador→crítico→reparación por gate. Si al tercer intento no pasa, se escala a vos (revisar si la spec era ambigua).

---

## 4. ESTRATEGIA ITERATIVA DE SDD (el ciclo por change)

Por cada feature (change), este es el loop documentado:

```
1. PROPOSE   → Architect lee CLAUDE.md + spec de negocio + grafo
              → genera openspec/changes/<nombre>/{proposal,design,tasks}.md
2. HUMAN GATE→ vos revisás la PROPUESTA (no el código)
              → si desvía: corregís la spec, NO el código
3. APPLY     → Implementer escribe código contra la propuesta aprobada
4. VERIFY    → Verifier corre los criterios de aceptación (tests)
              → falla? vuelve a APPLY (máx 3 ciclos)
5. ARCHIVE   → Reviewer hace code review + actualiza specs/
              → el change se archiva, specs/ refleja la realidad
6. COMMIT    → commit de la fase; recién entonces, siguiente change
```

**Orden de changes (mapeado a las fases):**

| # | Change | Fase | "Hecho" cuando |
|---|---|---|---|
| 1 | `add-backend-base` | 1 | Seed corre, `GET /api/experiences` responde, Swagger up |
| 2 | `add-curated-profile-resolution` | 2 | `ResolveCuratedProfile` filtra por tags, tests sin DB en verde |
| 3 | `add-auth-and-crud` | 3 | Login JWT, CRUD protegido, ProfileView registra |
| 4 | `add-public-frontend-theming` | 4 | Home consume API, 5 temas, i18n runtime |
| 5 | `add-backoffice-builder` | 5 | Constructor con preview en vivo |
| 6 | `harden-for-release` | 6 | 6 bloqueantes cerrados, deploy |

**Regla de oro (de tu propio SPECS-POR-FASE.md):** una fase a la vez; no avanzar hasta que los criterios estén en verde; la spec se commitea antes que el código; si el código no encaja, primero preguntá si la spec era ambigua.

---

## 5. PROMPT DE KICK-OFF PARA CLAUDE CODE

Copiá y pegá esto en Claude Code, en la raíz del proyecto:

---

```
Vas a trabajar en el proyecto "Portafolio Administrable". Está en Fase 0 completa
(andamiaje, schema, seed y docs listos; sin código de aplicación todavía).

PASO 1 — CONTEXTO. Leé, en este orden:
- CLAUDE.md (contrato de arquitectura y convenciones)
- docs/ARCHITECTURE.md (visión, capas, modelo de datos, endpoints)
- docs/SPECS-POR-FASE.md (las 6 specs de fase con criterios de aceptación)
- backend/prisma/schema.prisma (modelo de datos)

PASO 2 — SETUP DE DISCIPLINA SDD. Vamos a trabajar con OpenSpec.
- Inicializá OpenSpec (npx @fission-ai/openspec@latest init) si no está.
- Nuestros SPECS-POR-FASE.md son el input de negocio; las propuestas de OpenSpec
  son el "cómo". No los dupliques: referencialos.

PASO 3 — FLUJO DE AGENTES. Trabajaremos con roles y control humano:
- Explorer: entendé el código/alcance (usá el grafo de Graphify si está, no leas
  archivos enteros innecesariamente).
- Architect: redactá la propuesta OpenSpec (proposal + design + tasks).
- PARÁ ACÁ y mostrámela. Yo soy el Human Gate: apruebo la propuesta ANTES de que
  escribas código. Si algo desvía, corregimos la spec, no parcheamos el código.
- Implementer: recién con mi OK, implementá contra la propuesta.
- Verifier: corré los criterios de aceptación como tests. Máx 3 ciclos de
  reparación; si no pasa, escalámelo.
- Reviewer: code review + actualizá specs/ y archivá el change.

PASO 4 — PRIMER CHANGE. Empezamos por `add-backend-base` (Fase 1), acotado:
inicializar NestJS + Prisma + Postgres, migración inicial versionada (migrate dev,
NO db push), seed corriendo con cv-data.json, módulos `profile` y `experience` con
Clean Architecture completa (dominio/aplicación/infraestructura/presentación),
endpoints GET públicos con Swagger, respetando el fallback de i18n existente.
NO implementes perfiles curados ni auth todavía.

AHORA: hacé el PASO 1 (leé el contexto) y luego, como Architect, proponé el change
`add-backend-base` en formato OpenSpec. Parás en la propuesta para mi aprobación.
No escribas código de implementación todavía.
```

---

## 6. CHECKLIST DE ARRANQUE

- [ ] Descomprimir el `portfolio.zip` en tu entorno local.
- [ ] `docker compose up -d` (verificar que Postgres levanta).
- [ ] Instalar OpenSpec (`npx @fission-ai/openspec@latest init`).
- [ ] Instalar Graphify (`uv tool install graphify-labs`) — opcional al inicio, recomendado desde Fase 2.
- [ ] Abrir Claude Code en la raíz del proyecto.
- [ ] Pegar el prompt de kick-off (sección 5).
- [ ] Revisar la propuesta de `add-backend-base` (Human Gate).
- [ ] Aprobar → dejar implementar → verificar criterios → commit.

---

## 7. RECORDATORIOS CLAVE

- **El gate humano es el corazón de SDD.** Si te saltás la revisión de la propuesta, perdés el control y volvés a "vibe coding". Revisá siempre la spec antes del código.
- **Una fase a la vez.** No dejes que el agente corra a la Fase 2 antes de que la 1 esté en verde.
- **Graphify rinde con volumen.** Al inicio el proyecto es chico; activá su uso intensivo cuando haya varios módulos.
- **El proceso es evidencia.** Documentá cómo construiste esto (SDD, agentes, harness, Graphify) — es material real para tus entrevistas de AI Engineer.
- **El seed ya está coherente con tus CVs** (Novacomp terminado en Ago 2026, Openpay cerrado con dominio de pagos). No lo toques salvo que cambien tus datos.
