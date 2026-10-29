# DATA-POPULATION.md — Guía de Populación de Información

> Cómo cargar, actualizar y mantener la información de los CVs en la base de datos del portafolio. Esta guía aplica a la **versión actual** de los datos (13 plantillas de perfil curado más `all`, o sea 14 perfiles, 15 experiencias, 2 proyectos, **bilingüe ES/EN**). Mantener junto a `docs/cv-data.json`.

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
- **`seed.ts`** lee el JSON y lo inserta en las tablas (limpia y recarga, pero solo sobre una base vacía o con `--overwrite`: § 3).
- La **API** lee de la base y resuelve cada perfil curado filtrando por tags.

Regla práctica: **editás el JSON → corrés el seed sobre una base vacía (o con `--overwrite`) → la base queda actualizada.** Sobre una base con contenido, `npm run seed` se niega (código 2) y no escribe nada.

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
#    postgresql://portfolio:portfolio@localhost:5434/portfolio?schema=public

# 3. Instalar dependencias (si aún no se hizo)
npm install

# 4. Generar el cliente Prisma y crear las tablas
npx prisma generate
npx prisma migrate dev --name init

# 5. Poblar la base con los datos del JSON (la base recién migrada está vacía)
npm run seed

# 6. (Opcional) Inspeccionar visualmente
#    Abrir http://localhost:8080 (Adminer)
#    Sistema: PostgreSQL · Servidor: postgres · Usuario: portfolio · Clave: portfolio · Base: portfolio
```

Al terminar, la base contiene: 1 perfil, 15 experiencias, las skills por categoría, educación, certificaciones, 2 proyectos, 5 temas preset y 14 perfiles curados (13 plantillas + "all").

---

## 3. Cómo actualizar la información (flujo recurrente)

Cada vez que generemos un CV nuevo, cambies un dato o agregues una experiencia:

1. **Editar `docs/cv-data.json`** — agregar/modificar la experiencia, skill, proyecto o perfil curado.
2. **Re-ejecutar el seed** (la base ya tiene contenido, así que hace falta `--overwrite`):
   ```bash
   cd backend
   npm run seed -- --overwrite
   ```
   El seed limpia las tablas y recarga todo desde el JSON. Tus datos quedan sincronizados. Sin `--overwrite`, sobre una base con contenido, se niega (§ 9).

> ⚠️ El seed **borra y recarga** los datos del portafolio (no toca `AdminUser`), **también lo que editaste desde el panel**. Desde `protect-default-seed` se niega a hacerlo sobre una base con contenido salvo `--overwrite` (en producción, además `SEED_ALLOW_PRODUCTION=1`): respaldá antes con el `pg_dump` que sugiere la negativa. Para aprender o probar usá los datos de ejemplo en una base aparte (§ 11). Desde la Fase 3 también podés editar experiencias, skills y perfiles curados por la API de backoffice (`/api/admin/*`, ver `backend/README.md`); esas ediciones **se pierden** si volvés a correr el seed, así que el JSON sigue siendo la fuente de verdad hasta que el backoffice visual (Fase 5) invierta el flujo. El administrador se crea con `npm run admin:bootstrap`.

---

## 4. Anatomía de `cv-data.json`

El JSON tiene seis secciones:

| Sección | Qué contiene | Lo usa |
|---|---|---|
| `profile` | Datos base: nombre, headline, contacto, summary, disponibilidad, idiomas | Header del portafolio |
| `profile.socialLinks` | Enlaces a presencia pública (GitHub, YouTube, etc.) con descripción bilingüe | Sección "Presencia Pública" |
| `profile.featuredRepositories` | **Curaduría manual** de repos a destacar (NO un dump del API de GitHub) | Sección "Código Destacado" |
| `experiences` | Las 15 experiencias laborales con `tags` | Filtrado por perfil |
| `skillCategories` | Skills agrupadas por categoría | Sección de competencias |
| `education` | Formación académica | Sección educación |
| `certifications` | Certificaciones y cursos | Sección certificaciones |
| `projects` | Proyectos destacados (portafolio, ERP AWA) con `tags` | Filtrado por perfil |
| `profileTemplates` | Las 13 plantillas de perfil curado con `filterTags` | Define cada vista curada |

### El campo clave: `tags`

Cada **experiencia**, **skill** y **proyecto** tiene `tags`. Cada **perfil curado** tiene `filterTags`. La regla de inclusión es simple:

> Un item aparece en un perfil curado si comparte **al menos un tag** con los `filterTags` de ese perfil (`filterTags` vacío = todos, como el perfil `all`). Los overrides `includeIds`/`excludeIds` referencian ids generados por el seed, así que **no viven en este JSON**: se gestionan desde el backoffice. Las experiencias se sirven en orden cronológico (`startDate` desc; `order` solo desempata).

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
     "themeOverrides": { "colors": { "accent": "#B91C1C" } }
   }
   ```
   El acento de la plantilla vive en `themeOverrides.colors.accent` (el campo `accentColor` se retiró en `retire-accent-color`). Es el color del acento sobre el fondo del tema (`modern-dark` usa `#0a0e1a`): elegí uno con contraste suficiente, 4,5:1 como mínimo para texto y 3:1 para elementos grandes.
4. **Re-ejecutar el seed** (`npm run seed -- --overwrite` si la base ya tiene contenido). El nuevo perfil queda disponible en `/security-engineer`.

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

## 6. Los 13 perfiles curados actuales

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
npm run seed                               # cargar docs/cv-data.json (solo base vacía; con contenido, código 2)
npm run seed -- --overwrite                # borrar y recargar aunque haya contenido (respaldá antes)
npm run seed -- --file <ruta>              # cargar otro archivo (solo en una base descartable: § 11)
npm run seed:example                      # cargar los datos de ejemplo (SEED_DISPOSABLE_DB=1)
npm run seed:example:verify               # comparar la base con el ejemplo
npx prisma studio                          # GUI oficial de Prisma para ver/editar datos
```

---

## 9. Solución de problemas

- **"Can't reach database":** ¿está corriendo `docker compose up -d`? ¿coincide `DATABASE_URL` con el puerto 5434 que publica el `docker-compose.yml` (`POSTGRES_PORT`)?
- **El seed no encuentra `cv-data.json`:** el script lo busca en `../../docs/cv-data.json` relativo a `backend/scripts/`. Verificar la estructura de carpetas.
- **Un perfil curado aparece vacío:** revisar que sus `filterTags` coincidan con tags reales en experiencias/proyectos. Usar el vocabulario de la sección 5.
- **`npm run seed` sale con código 2 («Negativa: … la base ya tiene contenido»):** la base tiene filas en alguna de las tablas que el seed limpia; el mensaje lista los conteos, sugiere el `pg_dump` (sin contraseña) y no escribió nada. Si querés borrar y recargar, respaldá y corré `npm run seed -- --overwrite`; en producción además `SEED_ALLOW_PRODUCTION=1` solo para ese comando.
- **`npm run seed` sale con código 1 («No se pudo comprobar si … tiene contenido»):** no se pudo contar (base sin migrar, sin conexión o `DATABASE_URL` mal). No se borró nada. Aplicá las migraciones (`npm run prisma:deploy`) o corregí la conexión.
- **Cambié el schema y el seed falla:** correr `npx prisma migrate dev` antes del seed para sincronizar las tablas.

---

## 10. Presencia pública (GitHub, YouTube) y repos destacados

### Enlaces sociales (`socialLinks`)
Cada entrada tiene `platform`, `handle`, `url`, `label` y `description` bilingües, `stats` libre (ej. `{repos: 67, achievements: [...]}`), y dos flags: `featured` (si la UI le da protagonismo) y `visible`.

Las dos entradas iniciales:
- **github** — `manuXD270516`, `featured: true` → tarjeta protagonista en la sección.
- **youtube** — canal técnico mixto, `featured: false` → tarjeta lateral discreta.

### Repos destacados (`featuredRepositories`) — ⚠️ curaduría manual

> ⚠️ **Hoy es inerte:** la tabla `FeaturedRepository` se carga con el seed, pero ninguna sección, endpoint ni pantalla del panel la lee, así que activar un repo con `visible: true` no cambia el sitio. Lo que sigue describe la intención original (curaduría manual) por si se retoma.

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

---

## 11. Datos de ejemplo (ficticios) para aprender

`docs/examples/cv-data.example.json` es una segunda fuente con el **mismo formato** que `cv-data.json`, más unos campos opcionales (sección 12). Cuenta la historia de una persona **ficticia** (Alex Rivera Duarte) y reúne en un solo lugar cada entidad, cada sección y cada mecanismo del perfil curado: filtro por tags, incluir y excluir, secciones reordenadas y ocultas, tema y layout propios, las tres visibilidades, perfil no enumerado, archivado, alias de slug y visitas para el dashboard. Es la **base de referencia del manual** (`docs/MANUAL.md`).

Es ficticio a propósito: sin personas ni empresas reales, dominios `example.com`/`example.org`/`example.net` (RFC 2606) y teléfono `+1 555 01xx`. No se confunde con tu CV y se puede publicar o fotografiar sin exponer tus datos. La única excepción son los `referrer` de las visitas sintéticas, que imitan orígenes reales (LinkedIn, un buscador) y no se muestran como enlace.

**Qué trae el ejemplo**

| Contenido | Cantidad | Casos que muestra |
|---|---|---|
| Idiomas | 3 | Nativo, MCER con detalle, Intermedio |
| Experiencias | 6 | Una actual, una oculta (`visible: false`), `id: "atlas"` |
| Skills | 16 en 4 categorías | Tags por categoría y skills `{ name, tags }` |
| Formación | 3 | En curso, con fechas `AAAA`, una oculta |
| Certificaciones | 3 | Una sin año, una oculta |
| Proyectos | 3 | Con `url`, sin `url`, uno oculto |
| Enlaces | 4 | GitHub destacado con `stats`, LinkedIn, YouTube no destacado, uno oculto |
| Perfiles curados | 8 + `all` | `ejemplo-backend`, `ejemplo-overrides`, `ejemplo-secciones`, `ejemplo-protegido`, `ejemplo-borrador`, `ejemplo-dirigido`, `ejemplo-archivado`, `ejemplo-renombrado` |
| Visitas sintéticas | 105 | En 5 perfiles, con orígenes variados |

Datos de prueba que usa el manual: el token del perfil protegido `ejemplo-protegido` es `ejemplo-token-2026`, y el alias `ejemplo-nombre-anterior` resuelve a `ejemplo-renombrado`. El perfil `ejemplo-borrador` (PRIVATE) no tiene `description.en` a propósito, para que el aviso de faltantes de traducción del constructor tenga algo que mostrar.

### 11.1 Cargarlo: siempre en una base aparte

El seed **borra y recarga** el contenido. Por eso, con `--file` (y con `npm run seed:example`) el seed se **niega** a escribir salvo que la base sea descartable. Antes de borrar nada exige tres cosas:

1. `SEED_DISPOSABLE_DB=1` en el entorno, como confirmación explícita.
2. `NODE_ENV` distinto de `production`.
3. Que la base no tenga filas de `Profile`, o que su único `Profile` tenga el mismo `fullName` que el archivo (así el ejemplo se puede recargar sobre sí mismo, pero nunca sobre otro perfil).

Si falla alguna, sale con código **2**, dice cuál, muestra el destino como `host:puerto/base` (sin contraseña) y no escribe nada. La capa 3 cubre el olvido más probable: `backend/.env` apunta a tu base real y, si no redefinís `DATABASE_URL`, el seed se conectaría ahí; esa base tiene tu `Profile`, así que se niega aunque hayas puesto la variable. Un archivo inexistente, un JSON roto o un archivo que no cumple el formato salen con código **1** y tampoco borran nada. `npm run seed` a secas no usa estas tres capas: tiene su propia negativa por contenido (§ 3 y § 9). **`--overwrite` no se combina con `--file`**: sale con código 1 antes de leer el archivo o conectarse, porque las tres capas ya cubren el caso completo, incluida la recarga del mismo archivo.

**PowerShell**

```powershell
# 1. Crear la base de ejemplo en el mismo contenedor (no toca la tuya)
docker exec portfolio-postgres createdb -U portfolio portfolio_example

# 2. Apuntar SOLO esta terminal a ella y comprobarlo
cd backend
$env:DATABASE_URL = "postgresql://portfolio:portfolio@localhost:5434/portfolio_example?schema=public"
npm run prisma:status        # debe decir: database "portfolio_example"

# 3. Migrar, cargar (se puede repetir) y verificar
npm run prisma:deploy
$env:SEED_DISPOSABLE_DB = "1"
npm run seed:example
npm run seed:example:verify  # exit 0 = la base coincide con el archivo

# 4. Terminal limpia: sacar las variables para no apuntar al ejemplo por error
Remove-Item Env:DATABASE_URL, Env:SEED_DISPOSABLE_DB
```

**bash**

```bash
docker exec portfolio-postgres createdb -U portfolio portfolio_example
cd backend
export DATABASE_URL="postgresql://portfolio:portfolio@localhost:5434/portfolio_example?schema=public"
npm run prisma:status
npm run prisma:deploy
SEED_DISPOSABLE_DB=1 npm run seed:example
npm run seed:example:verify
unset DATABASE_URL
```

**Usar la API de ejemplo sin tocar la tuya.** La API del owner suele estar en el puerto 3300. La de ejemplo va en otro (por ejemplo 3310) y el frontend la usa con `VITE_PROXY_TARGET`:

```powershell
$env:DATABASE_URL = "postgresql://portfolio:portfolio@localhost:5434/portfolio_example?schema=public"
$env:PORT = "3310"; npm run start:dev          # API de ejemplo
# en otra terminal:
cd frontend; $env:VITE_PROXY_TARGET = "http://localhost:3310"; npm run dev
```

**Borrarla** cuando ya no la necesites: `docker exec portfolio-postgres dropdb -U portfolio portfolio_example`. Si quedó a medias, se borra y se vuelve a crear.

> ⚠️ Antes de cualquier comando que escriba, confirmá el destino con `npm run prisma:status`. Nunca apuntes `seed:example`, `manual:capture`, `suite-backoffice.ps1` ni los checks que abren páginas (cada carga registra una visita) a la base `portfolio`.

### 11.2 Seed con el panel: dos formas de poblar

| | Seed (`npm run seed`) | Panel (`/admin`) |
|---|---|---|
| Cuándo | Base vacía o recarga total | Día a día |
| Efecto | Borra y recarga el contenido | Edita un ítem a la vez |
| Fuente de verdad | El JSON | La base |
| Ediciones del panel | Se pierden | Se conservan |

Si ya editaste contenido desde el panel, `npm run seed` se niega (código 2) y no escribe nada; solo `npm run seed -- --overwrite` borra y recarga, y debería ser un acto deliberado con respaldo previo. Para probar, usá una base aparte (§ 11.1).

---

## 12. Referencia campo por campo

Todas las tablas usan las mismas seis columnas:

- **Tipo:** `LocalizedText` es `{ "es": "…", "en": "…" }`; `LocalizedList`, `{ "es": ["…"], "en": ["…"] }`; las fechas son texto `AAAA-MM` (o `AAAA`).
- **Obligatorio / defecto:** *Sí* si falta el archivo se rechaza (código 1, con la ruta del campo); si es opcional, se indica qué hace el seed cuando falta.
- **Ejemplo:** tomado de `docs/examples/cv-data.example.json`.
- **Dónde se ve:** la sección o pantalla pública.
- **Panel:** la pantalla y el campo del backoffice que lo editan, o *solo en el seed* / *solo por la API*.

En `LocalizedText`, `es` es obligatorio y `en` puede faltar (la plataforma cae al español y el constructor avisa del faltante).

### 12.1 `profile` (perfil base)

| Campo | Tipo | Obligatorio / defecto | Ejemplo | Dónde se ve | Panel |
|---|---|---|---|---|---|
| `fullName` | texto | Sí | `"Alex Rivera Duarte"` | Hero, título de la página | Portada → Nombre completo |
| `headline` | LocalizedText | Sí | `"Ingeniera de Software Senior · …"` | Hero (si el perfil curado no trae titular propio) | Portada → Titular |
| `summary` | LocalizedText | Sí | `"Ingeniera de software con más de diez años…"` | Hero | Portada → Resumen |
| `location` | texto | Sí | `"Ciudad Ejemplo, Ejemplandia"` | Hero y Contacto | Portada → Ubicación |
| `timezone` | texto | Sí | `"UTC-03:00"` | Contacto | Portada → Huso horario |
| `phone` | texto | Sí | `"+1 555 0142"` | Contacto | Portada → Teléfono |
| `email` | texto | Sí | `"alex.rivera@example.com"` | Contacto | Portada → Email |
| `yearsOfExperience` | número | Sí | `11` | Estadísticas | Portada → Años de experiencia |
| `availability.modality` | LocalizedText | Sí | `"Remoto / Híbrido"` | Contacto (disponibilidad) | Portada → Modalidad |
| `availability.contractType` | LocalizedText | Sí | `"Relación de dependencia · Freelance"` | Contacto | Portada → Tipo de contrato |
| `availability.startDate` | LocalizedText | Sí | `"A convenir"` | Contacto | Portada → Fecha de inicio |
| `languages` | lista | Sí (puede ser `[]`) | ver 12.2 | Contacto | Portada → Idiomas |
| `socialLinks` | lista | No (`[]`) | ver 12.9 | Presencia | Proyectos y enlaces |
| `featuredRepositories` | lista | No (`[]`) | `[]` | **Nada**: ninguna sección los muestra | Solo en el seed |

> `featuredRepositories` es **inerte**: la tabla existe y el seed la carga, pero ninguna sección ni endpoint la lee. El ejemplo no le carga filas visibles.

### 12.2 `profile.languages[]`

| Campo | Tipo | Obligatorio / defecto | Ejemplo | Dónde se ve | Panel |
|---|---|---|---|---|---|
| `name` | texto | Sí | `"Inglés"` | Clave interna del idioma | Portada → Idiomas → Nombre |
| `nameI18n` | LocalizedText | Sí | `{ "es": "Inglés", "en": "English" }` | Contacto | Idiomas → Nombre mostrado |
| `level` | LocalizedText | Sí | `{ "es": "Avanzado (C1)", "en": "Advanced (C1)" }` | Contacto | Idiomas → Nivel (ES y EN) |
| `detail` | LocalizedText | Sí | `"Reuniones técnicas y documentación diaria…"` | Contacto | Idiomas → Detalle |

### 12.3 `experiences[]`

| Campo | Tipo | Obligatorio / defecto | Ejemplo | Dónde se ve | Panel |
|---|---|---|---|---|---|
| `id` | texto único | Sí (solo en el seed) | `"atlas"` | No se ve: es la clave de `experience:<id>` en `includeRefs`/`excludeRefs`; el seed genera su propio id | Solo en el seed |
| `company` | texto | Sí | `"Cobalto Ejemplo"` | Experiencia | Experiencias → Empresa |
| `role` | LocalizedText | Sí | `"Tech Lead Backend"` | Experiencia | Rol |
| `startDate` | `AAAA-MM` | Sí | `"2025-02"` | Experiencia (orden cronológico desc) | Inicio |
| `endDate` | `AAAA-MM` o `null` | Sí | `null` | Experiencia | Fin |
| `current` | booleano | Sí | `true` | Experiencia ("Actual") | Actual |
| `location` | texto | Sí | `"Ciudad Ejemplo · Remoto"` | Experiencia | Ubicación |
| `sector` | lista de texto | Sí | `["fintech","payments"]` | Experiencia | Sector |
| `summary` | LocalizedText | Sí | `"Liderazgo técnico de un equipo…"` | Experiencia | Resumen |
| `highlights` | LocalizedList | Sí | `{ "es": ["Definí los estándares…"] }` | Experiencia (logros) | Logros (es) / Logros (en) |
| `technologies` | lista de texto | Sí | `["Java 21","Kafka"]` | Experiencia | Tecnologías |
| `tags` | lista de texto | Sí | `["java","leadership"]` | No se ve: decide en qué perfiles curados entra | Tags |
| `visible` | booleano | No (`true`) | `false` (Terracota Demo) | Oculta: solo aparece en el panel | Visible en el portafolio |

El orden de la lista en el archivo se guarda como `order`; en el sitio manda la fecha de inicio (y `order` solo desempata). Desde el panel, `order` se edita en **Orden**.

### 12.4 `skillCategories[]`

| Campo | Tipo | Obligatorio / defecto | Ejemplo | Dónde se ve | Panel |
|---|---|---|---|---|---|
| `name` | LocalizedText | Sí | `{ "es": "Lenguajes", "en": "Languages" }` | Habilidades (título de categoría) | Skills → Nombre de la categoría |
| `tags` | lista de texto | No (tags por nombre de categoría: `tagsForSkillCategory`) | `["java","python"]` | No se ve: tags que heredan sus skills | Solo en el seed (en el panel cada skill tiene sus Tags) |
| `skills[]` | texto **o** `{ name, tags }` | Sí | `"Docker"` · `{ "name": "Spring Boot", "tags": ["java"] }` | Habilidades | Skills → Nombre, Tags y Orden de cada skill |
| `skills[].name` | texto | Sí | `"Spring Boot"` | Habilidades | Nombre |
| `skills[].tags` | lista de texto | No (los tags de la categoría) | `["java","spring-boot"]` | No se ve: filtra por perfil | Tags |

Las skills no tienen `visible`. Una referencia `skill:<nombre>` exige un nombre único en todo el archivo.

### 12.5 `education[]`

| Campo | Tipo | Obligatorio / defecto | Ejemplo | Dónde se ve | Panel |
|---|---|---|---|---|---|
| `degree` | LocalizedText | Sí | `"Maestría en Ingeniería de Software"` | Formación | Formación → Título |
| `institution` | texto | Sí | `"Universidad Ejemplo"` | Formación | Institución |
| `startDate` | `AAAA-MM` o `AAAA` | Sí | `"2010"` | Formación | Inicio |
| `endDate` | fecha o `null` | Sí | `"2014"` | Formación | Fin |
| `inProgress` | booleano | Sí | `true` | Formación ("En curso") | En curso |
| `visible` | booleano | No (`true`) | `false` | Oculta: solo en el panel | Visible en el sitio |

### 12.6 `certifications[]`

| Campo | Tipo | Obligatorio / defecto | Ejemplo | Dónde se ve | Panel |
|---|---|---|---|---|---|
| `name` | LocalizedText | Sí | `"Arquitecto de Soluciones en la Nube"` | Certificaciones | Formación → Certificaciones → Nombre |
| `issuer` | texto | Sí | `"Consorcio Cloud Ejemplo"` | Certificaciones | Emisor |
| `year` | `AAAA` o `null` | Sí | `null` | Certificaciones (sin año, no se muestra) | Año |
| `verificationUrl` | URL `https://` o `null` | No (`null`) | `"https://example.org/credenciales/arquitecto-nube-2023"` | Certificaciones: enlace «Ver credencial» (y en el PDF) | Enlace de verificación |
| `credentialId` | texto (hasta 100) o `null` | No (`null`) | `"EJ-2023-0042"` | Certificaciones: «ID: …» | ID de credencial |
| `expiresAt` | `AAAA-MM`, `AAAA` o `null` | No (`null`) | `"2029-06"` | Certificaciones: «Válida hasta …» o «Vencida» según la fecha del lector | Vence |
| `visible` | booleano | No (`true`) | `false` | Oculta: solo en el panel | Visible en el sitio |

### 12.7 `projects[]`

| Campo | Tipo | Obligatorio / defecto | Ejemplo | Dónde se ve | Panel |
|---|---|---|---|---|---|
| `id` | texto único | Sí (solo en el seed) | `"herramienta-interna"` | No se ve: clave de `project:<id>` | Solo en el seed |
| `name` | texto | Sí | `"Plataforma de Reservas"` | Proyectos | Proyectos y enlaces → Nombre |
| `role` | LocalizedText | Sí | `"Arquitecta y líder técnica"` | Proyectos | Rol |
| `period` | texto | Sí | `"2024"` | Proyectos | Período |
| `summary` | LocalizedText | Sí | `"Plataforma de reservas multi-inquilino…"` | Proyectos | Resumen |
| `technologies` | lista de texto | Sí | `["Java","Kafka"]` | Proyectos | Tecnologías |
| `tags` | lista de texto | Sí | `["java","microservices"]` | No se ve: filtra por perfil | Tags |
| `url` | texto `https://…` o `null` | Sí | `"https://reservas.example.com"` | Proyectos (enlace; sin `url`, sin enlace) | URL |
| `visible` | booleano | No (`true`) | `false` | Oculto: solo en el panel | Visible en el portafolio |

### 12.8 `profileTemplates[]` (perfiles curados)

Cada plantilla crea un perfil curado. Además de las plantillas, el seed crea siempre el perfil `all` (sin filtro: la home); el slug `all` está reservado.

| Campo | Tipo | Obligatorio / defecto | Ejemplo | Dónde se ve | Panel |
|---|---|---|---|---|---|
| `slug` | kebab-case único | Sí | `"ejemplo-backend"` | URL `/<slug>` | Perfiles → constructor → Identidad → Slug (cambiarlo crea el alias) |
| `title` | LocalizedText | Sí | `"Ingeniera Backend Java"` | Menú de perfiles y título | Identidad → Título |
| `headline` | LocalizedText | Sí | `"Ingeniera Backend Java · Spring Boot…"` | Hero | Identidad → Titular |
| `description` | LocalizedText | Sí | `"Perfil que filtra por tags…"` | Menú y metadatos | Identidad → Descripción |
| `roleType` | LocalizedText | No | `"Backend"` | Agrupa el menú por tipo de rol | Identidad → Tipo de rol |
| `techFocus` | texto | No | `"Java"` | Etiqueta del menú | Identidad → Tecnología destacada |
| `filterTags` | lista de texto | Sí (`[]` = todo) | `["java","microservices"]` | Qué experiencias, skills y proyectos entran | Selección → Tags de filtrado |
| `includeRefs` | lista de referencias | No (`[]`) | `["experience:brujula","project:herramienta-interna"]` | Fuerza la inclusión (solo ítems visibles) | Selección → **Incluir** en cada experiencia. *Skills y proyectos solo por la API*: el constructor ofrece incluir y excluir solo experiencias |
| `excludeRefs` | lista de referencias | No (`[]`) | `["experience:atlas","skill:Kotlin"]` | Fuerza la exclusión; siempre gana | Selección → **Excluir** (solo experiencias; skills y proyectos por la API) |
| `themeOverrides` | objeto parcial de tokens | No | `{ "colors": { "accent": "#1A365D" } }` | Colores, tipografía y radio propios | Diseño → customizador |
| `theme` | slug de preset | No (`modern-dark`) | `"elegant"` | Tema base | Diseño → Tema |
| `layout` | `classic` \| `sidebar` | No (`classic`) | `"sidebar"` | Estructura de la página | Diseño → Layout |
| `sectionsOrder` | ids del catálogo, sin repetir | No (las 9 en orden canónico) | `["hero","skills","experience",…]` | Orden de las secciones | Diseño → Secciones |
| `sectionsHidden` | ids del catálogo | No (`[]`) | `["stats","presence"]` | Secciones ocultas | Diseño → Secciones (ocultar) |
| `visibility` | `PUBLIC` \| `PROTECTED` \| `PRIVATE` | No (`PUBLIC`) | `"PROTECTED"` | Quién lo abre: PROTECTED pide token (401), PRIVATE da 404 | Publicación → Visibilidad |
| `accessToken` | texto | **Sí si `PROTECTED`**; si no, ninguno | `"ejemplo-token-2026"` | `X-Access-Token` o `?token=` | Publicación → Token de acceso |
| `listed` | booleano | No (`true`) | `false` | `false` = fuera de la home, del menú y del sitemap, pero con link | Publicación → Enumerar en la home y el sitemap |
| `archived` | booleano | No (`false`) | `true` | Archivado: 404 para todos, conserva la analítica | Publicación → Archivar / Desarchivar |
| `slugAliases` | lista de kebab-case | No (ninguno) | `["ejemplo-nombre-anterior"]` | El slug viejo sigue resolviendo | Identidad → Slug (al cambiarlo, el viejo queda como alias) |

Reglas que valida el seed: los ids de sección deben existir en el catálogo (`hero, stats, experience, skills, projects, education, certifications, presence, contact`); los alias no pueden repetir un slug ni otro alias; una referencia que no existe, o una `skill:` repetida en dos categorías, rechaza el archivo. Una referencia a un ítem con `visible: false` es válida: se guarda, pero el resolvedor la ignora.

**Referencias** (`includeRefs`, `excludeRefs`): `experience:<id>` y `project:<id>` usan el `id` del JSON; `skill:<nombre>` usa el nombre de la skill. El seed las traduce al id que genera la base y las guarda en `includeIds`/`excludeIds`.

### 12.9 `profile.socialLinks[]`

| Campo | Tipo | Obligatorio / defecto | Ejemplo | Dónde se ve | Panel |
|---|---|---|---|---|---|
| `platform` | minúsculas, dígitos y guiones | Sí | `"github"` | Presencia (ícono y tarjeta) | Proyectos y enlaces → Plataforma |
| `handle` | texto | Sí | `"alexrivera-ejemplo"` | Presencia | Usuario |
| `url` | texto `https://…` | Sí | `"https://github.example.com/alexrivera-ejemplo"` | Presencia (enlace) | URL |
| `label` | LocalizedText | Sí | `"Código y proyectos abiertos"` | Presencia | Etiqueta |
| `description` | LocalizedText | No | `"Repositorios de ejemplo…"` | Presencia (tarjeta protagonista) | Descripción |
| `stats` | objeto libre | No | `{ "repos": 42, "achievements": ["Pull Shark"] }` | Presencia (cifras de la tarjeta) | Estadísticas (JSON) |
| `featured` | booleano | Sí | `true` | Tarjeta protagonista vs. lateral | Destacado |
| `visible` | booleano | Sí | `false` | Oculto: solo en el panel | Visible en el portafolio |

### 12.10 `featuredRepositories[]`

Inerte (ver 12.1). Campos: `name`, `url`, `language`, `description` (LocalizedText), `tags`, `technologies`, `stars`, `visible`. Sin pantalla del panel y sin sección que los muestre.

### 12.11 `exampleViews[]` (solo el ejemplo)

Visitas sintéticas para que el dashboard tenga datos. Sin esta clave, el seed no crea ninguna visita.

| Campo | Tipo | Obligatorio / defecto | Ejemplo | Dónde se ve | Panel |
|---|---|---|---|---|---|
| `slug` | slug de un perfil del archivo (o `all`) | Sí | `"ejemplo-archivado"` | Dashboard | Solo en el seed |
| `count` | entero ≥ 1 | Sí | `14` | Dashboard (visitas) | Solo en el seed |
| `daysBack` | entero ≥ 1 | Sí | `25` | La visita *i* cae `i % daysBack` días antes de la carga, a las 12:00 UTC | Solo en el seed |
| `locales` | lista de texto | Sí | `["es","en"]` | Reparto por idioma (`locales[i % n]`) | Solo en el seed |
| `referrers` | lista de texto o `null` | Sí | `[null,"https://www.linkedin.com/"]` | Tabla *Por origen* (`null` = directo) | Solo en el seed |

Cada visita lleva `userAgent: "example-seed"` e `ipHash: null`, y el contador `views` del perfil queda igual a su total. El seed no clasifica: todas quedan con `kind: HUMAN` (el valor por defecto), así que el dashboard del ejemplo muestra 105 visitas de *Personas*. Las visitas que sumen después los scripts de calidad (`HeadlessChrome`, `PortfolioCheck`) quedan como `BOT` y no cambian ese total; el contador `views` de cada perfil cuenta solo las de personas.
