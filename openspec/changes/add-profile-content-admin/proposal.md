# add-profile-content-admin — Que "administrable" sea verdad

> Cuarto change de la ronda 1.1 (`docs/ROADMAP-1.1.md` § 4). **Promovido del puesto 11** por la reflexión y respaldado por el voting: el votante de secuencia puso `kernel-contenido-administrable` segundo de todo el catálogo, cuando las tres lentes de los jueces lo habían dejado último.

## Why

`openspec/specs/admin-content-management/spec.md` abre con "editar el contenido del portafolio sin tocar la base ni curl". Hoy cubre **experiencias y skills**. Todo lo demás se muestra en el sitio y solo se carga por seed:

| Entidad | Qué contiene | Dónde se edita hoy |
|---|---|---|
| `Profile` | nombre, titular, resumen, ubicación, email, teléfono, años de experiencia, **disponibilidad** | `docs/cv-data.json` + `npm run seed` |
| `Language` | idiomas y nivel | ídem |
| `SocialLink` | GitHub, LinkedIn, YouTube, con `stats` y `featured` | ídem |
| `Education` | formación | ídem |
| `Certification` | certificaciones | ídem |
| `Project` | proyectos destacados, con `url` | ídem |

El titular, el email y la disponibilidad son **lo primero que lee un reclutador** y aparecen en los 14 links. Cambiar una línea exige editar el seed y volver a correrlo —lo que **sobrescribe** todo el contenido administrado— o abrir SQL en producción. En búsqueda activa eso cambia cada pocas semanas, y mientras no se cambia se están enviando links con información vieja.

Dos efectos colaterales que confirman el diagnóstico:

- `Project.url` está vacío en los dos proyectos del seed, y `FeaturedRepository` tiene una sola fila. No es casualidad: no hay forma cómoda de completarlos, así que no se completan. Por eso `evidencia-verificable-repos` quedó diferido: su sección nacería vacía.
- `docs/MANUAL.md` tiene que dedicar un caso entero (el 13) a explicar qué **no** se puede administrar y a advertir que `seed` sobrescribe. Este change borra ese caso.

Y hay una pieza de analítica que cuesta casi nada y hoy se desperdicia: `ProfileView.referrer` y `userAgent` **se persisten** desde la Fase 3 y **nadie los lee**. Los dos críticos lo marcaron: sin eso, la próxima priorización vuelve a ser intuición.

## What Changes

- **CRUD del perfil base**: `GET` y `PUT /api/admin/profile`, respetando que `Profile` es un singleton de hecho (el caso de uso no recibe id, igual que el `findOne` que ya existe). Campos bilingües `Json` tal como ya los usa el seed, incluida la disponibilidad (modalidad, tipo de contrato, fecha de inicio).
- **CRUD de `Language`, `SocialLink`, `Education`, `Certification` y `Project`**, con la misma plantilla de capas que `admin-experience-crud`: entidad, puerto, adaptador Prisma, casos de uso, DTO validado con whitelist, controller.
- **Página `/admin/portada`** con el bloque que de verdad cambia durante la búsqueda —titular, resumen, contacto, disponibilidad e idiomas—, con el mismo preview que el constructor para ver el hero antes de guardar.
- **Páginas `/admin/formacion`** (educación y certificaciones) y **`/admin/proyectos`** (proyectos y enlaces sociales), con el patrón de lista más diálogo que ya usan Experiencias y Skills.
- **Analítica por `referrer`**: el agregado suma `byReferrer`, normalizando el origen a su dominio y agrupando lo vacío como "directo". Sin capturar nada nuevo: solo se lee lo que ya está guardado.
- **`docs/MANUAL.md`**: el caso 13 pasa de "lo que no se administra" a los casos de administración, y desaparece la advertencia sobre `seed`.

### Non-goals

- **Subida de imágenes.** La foto del perfil y las de proyectos siguen siendo URLs. Pide almacenamiento de archivos, que es otra decisión de infraestructura.
- **Editor de texto rico.** Los campos siguen siendo texto plano y listas de chips, como en experiencias.
- **CRUD de temas.** Los cinco presets siguen viniendo del seed; el customizador por perfil ya cubre la necesidad real. Un editor de temas es un producto aparte.
- **CRUD de `FeaturedRepository`.** La tabla existe y está huérfana, pero su sección pública es otro change (`evidencia-verificable-repos`, diferido). Agregar el CRUD sin la sección sería administrar algo que no se muestra.
- **Capturar datos nuevos de analítica.** `byReferrer` lee lo persistido; no se agregan campos ni cookies ni se toca el HMAC de la IP.
- **Reemplazar el seed.** Sigue siendo la forma de poblar una base vacía; deja de ser la forma de editar.
- Migración de Prisma: **ninguna**. Todos los campos ya existen.

## Capabilities

### Modified Capabilities
- `admin-content-management`: cubre las seis entidades restantes y el perfil base.
- `admin-backoffice-shell`: tres entradas nuevas en la navegación.
- `admin-analytics-dashboard`: agregado y tabla por origen.
- `profile-view-analytics`: `byReferrer` en la salida del agregado.

## Impact

- **Backend**: módulos `profile`, `education`, `project` y `social-link` suman su capa de administración (hoy son solo lectura); `analytics` suma el agregado por origen. Es la plantilla de `admin-experience-crud` aplicada seis veces, que es exactamente para lo que se hizo.
- **Frontend**: tres páginas nuevas, su navegación, y el dashboard con la tabla de orígenes.
- **Datos**: ninguno. El seed sigue igual.
- **Riesgo**: un `PUT` del perfil base mal validado podría dejar el hero vacío en los 14 links a la vez. Se mitiga con whitelist estricta, campos obligatorios en el dominio y el escenario explícito de que un payload con campos desconocidos devuelve 400 en lugar de borrar en silencio.
