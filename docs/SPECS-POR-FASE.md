# Plantilla de Specs por Fase — Portafolio Administrable
### Guía de Spec-Driven Development para Claude Code · Manuel Saavedra · Junio 2026

> Una especificación por fase, lista para guiar la implementación con Claude Code. Cada spec define **qué** debe lograrse y **cómo se verifica** (criterios de aceptación), no el código. El flujo por fase: especificar → planificar → implementar contra la spec → verificar y refinar.
>
> **Reglas de oro (SDD):**
> 1. Una fase a la vez. No avanzar hasta que los criterios de aceptación de la fase estén en verde.
> 2. La spec se commitea antes que el código que genera.
> 3. Si el código generado no encaja, primero preguntá si la spec era ambigua — corregí la spec, no parchees el código.
> 4. Cada fase arranca pidiéndole a Claude Code que lea `CLAUDE.md` + `ARCHITECTURE.md` + esta spec.

---

## CÓMO USAR ESTE DOCUMENTO

Por cada fase, seguí este micro-ciclo con Claude Code:

1. **Abrí la spec de la fase** (abajo) y leéla vos primero.
2. **Pasale el prompt de arranque** sugerido al final de cada spec.
3. **Dejá que implemente**, acotado al alcance declarado.
4. **Verificá contra los criterios de aceptación** — uno por uno.
5. **Commiteá** cuando todos estén en verde. Recién entonces, siguiente fase.

> Nota sobre TDD: cada spec incluye criterios verificables. Si querés sumar TDD dentro de la fase, esos criterios son tus tests — escribilos antes de implementar. SDD gobierna el *qué*; TDD (opcional) gobierna el *cómo se prueba*.

---

# FASE 1 — Backend base

### Objetivo
Tener un backend NestJS funcional conectado a PostgreSQL vía Prisma, con la base poblada desde `cv-data.json` y un módulo de referencia (`profile` + `experience`) implementado en Clean Architecture completa, exponiendo endpoints públicos de lectura documentados con Swagger.

### Alcance (qué SÍ entra)
- Inicialización de NestJS + Prisma + conexión a Postgres (Docker Compose ya está en el repo).
- Migración inicial de Prisma a partir del `schema.prisma` existente.
- Seed funcional que carga `cv-data.json` (el `seed.ts` ya existe — debe correr sin errores).
- Módulos `profile` y `experience` con las 4 capas de Clean Architecture (dominio, aplicación, infraestructura, presentación) — como módulo de referencia bien hecho.
- Endpoints GET públicos de lectura + Swagger en `/api/docs`.

### Fuera de alcance (qué NO entra todavía)
- Perfiles curados (Fase 2), auth (Fase 3), frontend (Fase 4+), hardening (Fase 6).

### Criterios de aceptación (verificables)
- [ ] `docker compose up -d` levanta Postgres y la app conecta sin errores.
- [ ] `prisma migrate dev` genera la migración inicial versionada (no `db push`).
- [ ] El seed corre y carga todas las experiencias de `cv-data.json` (hoy 15), los perfiles curados (13 plantillas + `all` = 14), skills, educación, certificaciones y el profile. Verificable con `npm run seed:verify`.
- [ ] `GET /api/experiences` devuelve las experiencias; `GET /api/profile` devuelve el perfil.
- [ ] La respuesta respeta el locale (`?locale=es|en`) resolviendo los campos bilingües.
- [ ] El módulo `experience` tiene dominio aislado: el caso de uso no importa Prisma directamente, depende de una interfaz de repositorio.
- [ ] Swagger accesible en `/api/docs` con los endpoints documentados.

### Prompt de arranque para Claude Code
> "Leé `CLAUDE.md`, `docs/ARCHITECTURE.md` y la spec de la Fase 1 en `docs/SPECS-POR-FASE.md`. Estamos en Fase 0 completada. Implementá SOLO la Fase 1: inicializá NestJS con Prisma y Postgres, generá la migración inicial versionada con migrate dev, dejá el seed corriendo con los datos de cv-data.json, e implementá los módulos `profile` y `experience` con Clean Architecture completa (dominio/aplicación/infraestructura/presentación) y endpoints GET públicos con Swagger. Respetá el fallback de i18n existente. No implementes perfiles curados ni auth todavía. Cuando termine, indicame cómo verificar cada criterio de aceptación."

---

# FASE 2 — Núcleo curated-profile

### Objetivo
Implementar el corazón del producto: el caso de uso `ResolveCuratedProfile`, que dado el slug de un perfil curado devuelve el perfil junto a las experiencias (y skills) filtradas por la intersección de tags, ordenadas y resueltas al idioma pedido.

### Alcance
- Módulo `curated-profile` en Clean Architecture.
- Caso de uso `ResolveCuratedProfile(slug, locale)`:
  - Busca el perfil por slug.
  - Filtra experiencias/skills cuyos `tags` intersectan con los `filterTags` del perfil.
  - Aplica overrides: `includeIds` (forzar inclusión) y `excludeIds` (forzar exclusión).
  - Ordena las experiencias (por fecha, descendente).
  - Resuelve los campos bilingües al `locale`.
- Endpoints públicos: `GET /api/curated-profiles` (lista) y `GET /api/curated-profiles/:slug?locale=`.

### Fuera de alcance
- Edición de perfiles (Fase 3/5), frontend (Fase 4).

### Criterios de aceptación
- [ ] `GET /api/curated-profiles/tech-lead-dotnet?locale=es` devuelve solo experiencias cuyos tags intersectan con los filterTags del perfil (ej. dotnet, leadership, microservices).
- [ ] Un perfil con tag `java` NO trae experiencias exclusivamente .NET sin ese tag.
- [ ] Los overrides funcionan: un id en `excludeIds` no aparece aunque matchee por tag; uno en `includeIds` aparece aunque no matchee.
- [ ] El orden de experiencias es cronológico descendente (más reciente primero).
- [ ] `locale=en` devuelve los textos en inglés; un locale inexistente cae al español sin romper (fallback no excluyente).
- [ ] El perfil `generalist-polyglot` resuelve la mayoría de experiencias (es el amplio); `tech-lead-dotnet` resuelve un subconjunto coherente.
- [ ] La lógica de filtrado vive en la capa de dominio/aplicación, testeable sin DB (con un repositorio mock).

### Prompt de arranque
> "Leé la spec de la Fase 2. Con la Fase 1 ya verificada, implementá SOLO el módulo `curated-profile`: el caso de uso `ResolveCuratedProfile(slug, locale)` con filtrado por intersección de tags, overrides includeIds/excludeIds, orden cronológico descendente y resolución de locale con fallback. Exponé los endpoints públicos de lista y detalle por slug. La lógica de filtrado debe ser testeable sin base de datos. Indicame cómo verificar cada criterio."

---

# FASE 3 — Auth + Backoffice API

### Objetivo
Habilitar la administración: autenticación con JWT, CRUD completo de las entidades editables, y registro de analítica de visitas.

### Alcance
- Módulo `auth` con login JWT (el `AdminUser` ya está en el schema).
- Guards de autorización para proteger los endpoints de escritura.
- CRUD completo (crear/leer/editar/borrar) de: experiencias, skills, perfiles curados.
- Registro de visitas (`ProfileView`): al resolver un perfil público, registrar la visita con locale y fecha.

### Fuera de alcance
- Frontend del backoffice (Fase 5), theming (Fase 4).

### Criterios de aceptación
- [ ] `POST /api/auth/login` con credenciales válidas devuelve un JWT; con inválidas, 401.
- [ ] Los endpoints de escritura (POST/PUT/DELETE) rechazan requests sin token válido (401/403).
- [ ] Los endpoints públicos de lectura siguen funcionando sin token.
- [ ] CRUD de experiencias funciona end-to-end: crear, listar, editar, borrar.
- [ ] CRUD de perfiles curados permite editar filterTags, includeIds, excludeIds.
- [ ] Al visitar un perfil curado público, se registra un `ProfileView` con slug, locale y timestamp.
- [ ] Las contraseñas se almacenan hasheadas (bcrypt/argon2), nunca en texto plano.

### Prompt de arranque
> "Leé la spec de la Fase 3. Con Fases 1-2 verificadas, implementá SOLO: módulo `auth` con login JWT y guards, CRUD completo protegido de experiencias/skills/perfiles curados, y registro de ProfileView en cada visita a un perfil público. Contraseñas hasheadas. Los endpoints públicos de lectura siguen abiertos. Indicame cómo verificar cada criterio."

---

# FASE 4 — Frontend público + Motor de Theming

### Objetivo
Construir la cara visible: una SPA en React que consume la API, con un motor de theming que inyecta design tokens como CSS variables en runtime, soportando 5 presets, y vistas theme-aware (home + perfil por slug).

### Alcance
- Setup React + Vite + Tailwind (leyendo CSS variables) + shadcn/ui + React Query.
- `ThemeProvider` que inyecta los design tokens del tema activo como CSS variables en runtime.
- Los 5 presets: modern-dark, modern-light, minimal, elegant, corporate.
- Vista pública home (visión general) y vista de perfil curado por slug, ambas theme-aware y bilingües.
- Motor de layouts: al menos `ClassicLayout` + un segundo layout estructural.

### Fuera de alcance
- Backoffice visual (Fase 5), hardening (Fase 6).

### Criterios de aceptación
- [ ] La home renderiza consumiendo la API real (no datos hardcodeados).
- [ ] `/{slug}` renderiza el perfil curado correspondiente, con sus experiencias filtradas.
- [ ] Cambiar el tema activo cambia los colores/tipografía en runtime vía CSS variables, sin recargar.
- [ ] Los 5 presets se ven distintos y consistentes.
- [ ] El selector de idioma cambia ES/EN en toda la vista.
- [ ] Al menos 2 layouts seleccionables que reorganizan la presentación.
- [ ] La vista es responsive (móvil y desktop).

### Prompt de arranque
> "Leé la spec de la Fase 4 y `docs/I18N.md`. Con el backend (Fases 1-3) funcionando, implementá SOLO el frontend público: React+Vite+Tailwind+shadcn/ui+React Query, un ThemeProvider que inyecta design tokens como CSS variables en runtime, los 5 presets de tema, las vistas home y perfil-por-slug (theme-aware y bilingües) y al menos 2 layouts. Consumí la API real. Indicame cómo verificar cada criterio."

---

# FASE 5 — Frontend backoffice + Customizador visual

### Objetivo
Dar el panel de administración visual: login, dashboard con analítica, CRUD visual, y el constructor de perfiles curados con preview en vivo y customizador de tema en tiempo real.

### Alcance
- Login al backoffice.
- Dashboard con la analítica de visitas (`ProfileView`).
- CRUD visual de experiencias/skills.
- Constructor de perfiles curados: seleccionar tags, preview en vivo de qué experiencias resultan, elegir tema/layout, ordenar y ocultar secciones, generar el link público.
- Customizador de tema con preview en vivo: color pickers, selector de fuente, toggle claro/oscuro, densidad — aplicando cambios en tiempo real sobre un preview del perfil.

### Fuera de alcance
- Hardening de producción (Fase 6).

### Criterios de aceptación
- [ ] Login funcional contra el auth de Fase 3; rutas del backoffice protegidas.
- [ ] El dashboard muestra visitas por perfil/idioma/fecha desde ProfileView.
- [ ] El CRUD visual permite crear/editar/borrar experiencias y skills con feedback.
- [ ] El constructor de perfiles muestra en vivo qué experiencias resultan al cambiar los tags.
- [ ] El customizador de tema refleja en tiempo real los cambios de color/fuente/densidad sobre el preview.
- [ ] Generar un perfil produce un link público que renderiza la vista de Fase 4.

### Prompt de arranque
> "Leé la spec de la Fase 5. Con Fases 1-4 verificadas, implementá SOLO el backoffice: login, dashboard con analítica de ProfileView, CRUD visual de experiencias/skills, constructor de perfiles curados con preview en vivo del filtrado por tags, y customizador de tema en tiempo real (color pickers, fuente, claro/oscuro, densidad). Indicame cómo verificar cada criterio."

---

# FASE 6 — Hardening para producción (release 1.0.0)

### Objetivo
Dejar el proyecto listo para un despliegue serio, cerrando los bloqueantes e importantes del checklist de release antes de hacer deploy.

### Alcance
Trabajar `docs/RELEASE-1.0.0-CHECKLIST.md` como checklist explícito:
- **Bloqueantes:** secretos fuertes, migraciones `migrate deploy`, CORS estricto, validación de inputs (DTOs + ValidationPipe), manejo global de errores, healthcheck.
- **Importantes:** rate limiting, Helmet + HTTPS, logging estructurado, tests mínimos (curated-profile + i18n fallback), SEO + OpenGraph, backup de DB.
- **Deseables (pueden ir a 1.0.x):** export PDF, accesibilidad, caché, dashboard analítica avanzada, CI/CD, repos destacados.

### Criterios de aceptación
- [ ] Los 6 bloqueantes del checklist están resueltos (ver checklist para el detalle de cada uno).
- [ ] Los importantes están resueltos o conscientemente diferidos con justificación.
- [ ] `GET /health` responde y verifica conectividad con la DB.
- [ ] No hay secretos en el repo; el `.env` real usa valores fuertes.
- [ ] CORS permite solo el dominio del frontend.
- [ ] Existen tests para el caso de uso curated-profile y el fallback de i18n.
- [ ] Solo entonces: deploy (backend Railway/Render, frontend Vercel, Postgres gestionado).

### Prompt de arranque
> "Leé la spec de la Fase 6 y `docs/RELEASE-1.0.0-CHECKLIST.md`. Con Fases 1-5 verificadas, trabajemos el hardening: cerrá los 6 bloqueantes primero (secretos, migrate deploy, CORS, validación con DTOs, manejo global de errores, healthcheck), luego los importantes. El deploy es el último paso, solo cuando bloqueantes e importantes estén en verde. Indicame el estado de cada ítem del checklist a medida que avances."

---

## RESUMEN DEL FLUJO COMPLETO

| Fase | Entregable verificable | Depende de |
|---|---|---|
| 1 | Backend + DB + seed + módulo referencia + Swagger | Fase 0 |
| 2 | `ResolveCuratedProfile` funcionando por API | Fase 1 |
| 3 | Auth JWT + CRUD + analítica de visitas | Fase 2 |
| 4 | Frontend público + theming + 5 presets | Fase 3 |
| 5 | Backoffice + constructor + customizador en vivo | Fase 4 |
| 6 | Hardening (bloqueantes+importantes) → deploy 1.0.0 | Fase 5 |

**El principio que sostiene todo:** la spec es el contrato. Claude Code implementa contra ella, vos verificás contra los criterios de aceptación, y solo avanzás cuando la fase cumple. Así la IA construye coherente y vos mantenés el control — que es exactamente lo que vas a poder contar como evidencia de SDD en tus entrevistas.
