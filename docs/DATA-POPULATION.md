# DATA-POPULATION.md — Guía de Populación de Información

> Cómo cargar, actualizar y mantener la información de los CVs en la base de datos del portafolio. Esta guía aplica a la **versión actual** de los datos (10 perfiles curados, 14 experiencias, 2 proyectos, **bilingüe ES/EN**). Mantener junto a `docs/cv-data.json`.

> 🌐 **Multi-idioma:** los datos son **bilingües** (español/inglés) en un solo registro. Ver `docs/I18N.md` para el diseño completo. Los campos traducibles son objetos `{ es, en }`; los no traducibles (empresa, tecnologías, tags, fechas) son planos.

---

## 1. Modelo mental: cómo fluyen los datos

```
docs/cv-data.json   →   schema.prisma   →   migración   →   seed.ts   →   PostgreSQL   →   API
   (fuente única)        (estructura)       (tablas)      (carga)        (datos)       (resuelve)
```

- **`docs/cv-data.json`** es la **única fuente de verdad** de tu información. Todo sale de ahí.
- **`schema.prisma`** define la forma de las tablas.
- La **migración** crea esas tablas vacías en PostgreSQL.
- **`seed.ts`** lee el JSON y lo inserta en las tablas (es idempotente: limpia y recarga).
- La **API** lee de la base y resuelve cada perfil curado filtrando por tags.

Regla práctica: **editás el JSON → corrés el seed → la base queda actualizada.**

---

## 2. Procedimiento completo (primera vez)

```bash
# 0. Desde la raíz del proyecto
cd portfolio

# 1. Levantar PostgreSQL (y Adminer para inspección visual)
docker compose up -d

# 2. Configurar el backend
cd backend
cp .env.example .env
#    Verificar que DATABASE_URL apunte a la base local:
#    postgresql://portfolio:portfolio@localhost:5432/portfolio?schema=public

# 3. Instalar dependencias (si aún no se hizo)
npm install

# 4. Generar el cliente Prisma y crear las tablas
npx prisma generate
npx prisma migrate dev --name init

# 5. Poblar la base con los datos del JSON
npm run seed

# 6. (Opcional) Inspeccionar visualmente
#    Abrir http://localhost:8080 (Adminer)
#    Sistema: PostgreSQL · Servidor: postgres · Usuario: portfolio · Clave: portfolio · Base: portfolio
```

Al terminar, la base contiene: 1 perfil, 14 experiencias, las skills por categoría, educación, certificaciones, 2 proyectos, 5 temas preset y 11 perfiles curados (10 plantillas + "all").

---

## 3. Cómo actualizar la información (flujo recurrente)

Cada vez que generemos un CV nuevo, cambies un dato o agregues una experiencia:

1. **Editar `docs/cv-data.json`** — agregar/modificar la experiencia, skill, proyecto o perfil curado.
2. **Re-ejecutar el seed:**
   ```bash
   cd backend
   npm run seed
   ```
   El seed limpia las tablas y recarga todo desde el JSON. Tus datos quedan sincronizados.

> ⚠️ El seed **borra y recarga**. Es seguro mientras el JSON sea la fuente de verdad. Cuando el backoffice (Fase 5) esté listo, vas a editar desde la interfaz y el seed quedará solo para inicializar/resetear.

---

## 4. Anatomía de `cv-data.json`

El JSON tiene seis secciones:

| Sección | Qué contiene | Lo usa |
|---|---|---|
| `profile` | Datos base: nombre, headline, contacto, summary, disponibilidad, idiomas | Header del portafolio |
| `profile.socialLinks` | Enlaces a presencia pública (GitHub, YouTube, etc.) con descripción bilingüe | Sección "Presencia Pública" |
| `profile.featuredRepositories` | **Curaduría manual** de repos a destacar (NO un dump del API de GitHub) | Sección "Código Destacado" |
| `experiences` | Las 14 experiencias laborales con `tags` | Filtrado por perfil |
| `skillCategories` | Skills agrupadas por categoría | Sección de competencias |
| `education` | Formación académica | Sección educación |
| `certifications` | Certificaciones y cursos | Sección certificaciones |
| `projects` | Proyectos destacados (portafolio, ERP AWA) con `tags` | Filtrado por perfil |
| `profileTemplates` | Las 10 plantillas de perfil curado con `filterTags` | Define cada vista curada |

### El campo clave: `tags`

Cada **experiencia**, **skill** y **proyecto** tiene `tags`. Cada **perfil curado** tiene `filterTags`. La regla de inclusión es simple:

> Un item aparece en un perfil curado si comparte **al menos un tag** con los `filterTags` de ese perfil.

Ejemplo: el perfil `ai-software-engineer` tiene `filterTags: ["ai-engineer","ai","nodejs","nestjs","fullstack","python"]`. La experiencia de Ensitech tiene el tag `ai-engineer`, por lo tanto aparece. Mojix (solo tags Java/Quarkus/retail) no aparece.

### El otro campo clave: idioma (`{ es, en }`)

Los campos de **texto narrativo y títulos** son objetos bilingües:

```jsonc
"role": { "es": "Ingeniero de Software Senior", "en": "Senior Software Engineer" },
"summary": { "es": "Desarrollo backend...", "en": "Backend development..." },
"highlights": { "es": ["...", "..."], "en": ["...", "..."] }
```

Para agregar un idioma (ej. portugués): agregar la clave `pt` a estos objetos. **No** se crea un registro nuevo — el mismo registro gana un idioma más. El backend resuelve el idioma demandado con `resolveLocale()` (ver `docs/I18N.md`).

---

## 5. Cómo agregar un nuevo perfil curado (al generar un CV nuevo)

Cuando creamos un CV para una vacante nueva, el equivalente en el portafolio es **agregar un perfil curado**. Pasos:

1. **Identificar los tags** que definen ese perfil (ej. para un rol de seguridad: `["security","java","fintech"]`).
2. **Verificar que las experiencias relevantes tengan esos tags.** Si falta alguno, agregarlo al array `tags` de la experiencia en el JSON.
3. **Agregar la entrada** en `profileTemplates`:
   ```json
   {
     "slug": "security-engineer",
     "title": "Security Engineer",
     "description": "Perfil enfocado en seguridad aplicada y fintech.",
     "headline": "Security Software Engineer · OWASP · PCI-DSS · Fintech",
     "filterTags": ["security", "java", "fintech"],
     "accentColor": "#B91C1C"
   }
   ```
4. **Re-ejecutar el seed.** El nuevo perfil queda disponible en `/p/security-engineer`.

### Vocabulario de tags actual

Tags en uso (mantener consistencia al agregar nuevos):

```
ai, ai-engineer, aviation, azure, banking, batch, cloud, cloud-native, cto,
devops, dotnet, erp, event-driven, fintech, fullstack, gcp, high-volume, iac,
insurance, integration, java, leadership, legacy, logistics, management,
messaging, microservices, microsoft, migration, mobile, nodejs, nestjs,
payments, performance, project-management, python, qa, quarkus, reporting,
retail, ruby, serverless, spring-boot, testing, vbnet
```

---

## 6. Los 10 perfiles curados actuales

| Slug | Título | filterTags principales |
|---|---|---|
| `java-senior-backend` | Senior Java Backend Engineer | java, spring-boot, microservices |
| `fullstack-nest-react` | Full-Stack Developer Senior | nodejs, nestjs, fullstack, java |
| `devops-platform` | DevOps / Platform Engineer | devops, cloud, iac, serverless |
| `dotnet-backend` | Senior .NET Backend Developer | dotnet, azure, integration |
| `it-leadership` | Jefe de TI | leadership, management, erp, cto, migration |
| `integration-architect` | Arquitecto de Integración | integration, banking, fintech, messaging |
| `ai-software-engineer` | AI Software Engineer | ai-engineer, ai, nodejs, nestjs, fullstack, python |
| `fullstack-microsoft` | Fullstack Microsoft | microsoft, dotnet, azure, legacy, reporting, integration |
| `devops-azure` | DevOps Azure | devops, azure, cloud, iac, microsoft |
| `software-architect` | Arquitecto de Software | microservices, java, spring-boot, event-driven, integration, cloud |
| `backend-payments-ror` | Ingeniero Backend de Pagos (Ruby on Rails) | payments, fintech, banking, ruby, messaging, integration |
| `tech-lead-dotnet` | Tech Lead .NET | leadership, dotnet, microservices, migration, microsoft, integration, fullstack |
| `generalist-polyglot` | Senior Software Engineer (Generalista) | java, dotnet, nodejs, fullstack, microservices, cloud, fintech, leadership |

### Taxonomía de navegación (`roleType` + `techFocus`)

Cada perfil curado tiene dos campos que alimentan el menú de navegación agrupado:
- **`roleType`** (bilingüe `{es,en}`) — la categoría: `Tech Lead`, `Backend`, `Fullstack`, `DevOps`, `Arquitecto`, `Liderazgo`, `Generalista`.
- **`techFocus`** (string plano) — la tecnología destacada: `.NET`, `Java`, `Node / React`, `Azure`, `Pagos / Ruby`, etc.

El frontend agrupa los perfiles por `roleType` y muestra el `techFocus` como subtítulo. Al agregar un perfil nuevo, asigná ambos campos para que aparezca en la categoría correcta del menú.

Más el perfil `all` (vista completa, sin filtro).

---

## 7. Skills: cómo se asignan tags

Las skills del JSON están agrupadas por categoría y **no** tienen tags individuales en el JSON. El seed les asigna tags mediante la función `tagsForSkillCategory()` (heurística por categoría). Si agregás una categoría nueva de skills, agregá su mapeo de tags en esa función dentro de `seed.ts`.

---

## 8. Comandos de referencia rápida

```bash
docker compose up -d                       # levantar la base
docker compose down                        # detener
docker compose down -v                     # detener y BORRAR datos (reset total)

cd backend
npx prisma migrate dev --name <nombre>     # nueva migración tras cambiar el schema
npx prisma generate                        # regenerar cliente Prisma
npm run seed                               # recargar datos desde el JSON
npx prisma studio                          # GUI oficial de Prisma para ver/editar datos
```

---

## 9. Solución de problemas

- **"Can't reach database":** ¿está corriendo `docker compose up -d`? ¿coincide `DATABASE_URL` con el puerto 5432?
- **El seed no encuentra `cv-data.json`:** el script lo busca en `../../docs/cv-data.json` relativo a `backend/scripts/`. Verificar la estructura de carpetas.
- **Un perfil curado aparece vacío:** revisar que sus `filterTags` coincidan con tags reales en experiencias/proyectos. Usar el vocabulario de la sección 5.
- **Cambié el schema y el seed falla:** correr `npx prisma migrate dev` antes del seed para sincronizar las tablas.

---

## 10. Presencia pública (GitHub, YouTube) y repos destacados

### Enlaces sociales (`socialLinks`)
Cada entrada tiene `platform`, `handle`, `url`, `label` y `description` bilingües, `stats` libre (ej. `{repos: 67, achievements: [...]}`), y dos flags: `featured` (si la UI le da protagonismo) y `visible`.

Las dos entradas iniciales:
- **github** — `manuXD270516`, `featured: true` → tarjeta protagonista en la sección.
- **youtube** — canal técnico mixto, `featured: false` → tarjeta lateral discreta.

### Repos destacados (`featuredRepositories`) — ⚠️ curaduría manual

**Concepto clave:** esto NO es un dump automático del API de GitHub. Es una lista curada por Manuel de los repos profesionales recientes que quiere mostrar. Por defecto el JSON trae un placeholder con `visible: false` que el seed ignora.

Para activarlo:
1. Editar `cv-data.json` → `profile.featuredRepositories`.
2. Para cada repo a destacar, agregar entrada con `name`, `url`, `language`, `description` (bilingüe), `technologies`, `tags`, `visible: true`.
3. `npm run seed`.

**¿Por qué curaduría manual?** Para evitar que aparezcan repos académicos antiguos (UPSA, materias) que diluyen el mensaje profesional. Mostrar 4-6 repos curados con descripción contextual rinde más que 67 repos sin filtro.

Ejemplo de entrada bien armada:
```jsonc
{
  "name": "portfolio-web",
  "url": "https://github.com/manuXD270516/portfolio-web",
  "language": "TypeScript",
  "description": {
    "es": "Portafolio administrable con perfiles curados, NestJS + Clean Architecture, React + Vite, sistema de theming con design tokens.",
    "en": "Administrable portfolio with curated profiles, NestJS + Clean Architecture, React + Vite, theming system with design tokens."
  },
  "technologies": ["NestJS","React","Vite","Prisma","PostgreSQL"],
  "tags": ["fullstack","nodejs","nestjs","ai-engineer"],
  "stars": 0,
  "visible": true
}
```
