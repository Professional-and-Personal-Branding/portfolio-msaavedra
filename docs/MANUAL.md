# MANUAL — Uso de la plataforma, paso a paso y con casos de prueba

> **Versión interactiva: [`manual/index.html`](manual/index.html)** — el mismo contenido con índice lateral, filtros por estado, buscador, capturas ampliables y marcas de corrida. Abrila con doble clic o publicada como artifact; este Markdown queda como la fuente en texto plano, diffeable en el repo.
>
> Guía interactiva: cada funcionalidad está escrita como un **caso de prueba funcional** con precondición, pasos, resultado esperado y evidencia. Se puede leer como manual de uso o ejecutar como suite de regresión manual antes de cada release.
>
> Para desplegar: [`DEPLOY-RAILWAY.md`](DEPLOY-RAILWAY.md) (guía corta) y [`DEPLOY.md`](DEPLOY.md) (referencia). Este documento empieza donde terminan esos.
>
> **Base de referencia:** todos los casos, recorridos y capturas parten de la **base de ejemplo**, ficticia (`docs/examples/cv-data.example.json`, ver § 0 y [`DATA-POPULATION.md`](DATA-POPULATION.md) § 11). Nunca se ejecutan contra la base del owner.

**Leyenda de estado**

| | Significado |
|---|---|
| ✅ | Ejecutado y verificado sobre la **base de ejemplo** (`portfolio_example`), con captura o transcripción |
| 🔍 | Ejecutado y verificado contra la API, con la salida transcrita |
| 📝 | Documentado paso a paso; la captura de pantalla queda pendiente (ver § 6) |
| ❌ | Ejecutado y **falla**: el comportamiento real no es el esperado. Ver § 6.1 |

> El estado 📝 desapareció el 5 de octubre: todos los casos del backoffice tienen su captura.

---

## 0. Preparar el entorno

### Local

```bash
# 1. Base de datos
docker compose up -d                      # Postgres en 5434 y Adminer en 8080

# 2. Backend
cd backend
npm ci
npm run prisma:migrate                    # solo la primera vez
npm run seed && npm run seed:verify       # carga docs/cv-data.json (base recién migrada, vacía); con contenido se niega: TC-38
npm run admin:bootstrap                   # crea el administrador
npm run start:dev                         # API en http://localhost:3300

# 3. Frontend
cd ../frontend
npm ci && npm run dev                     # sitio en http://localhost:5173
```

### Base de ejemplo (la que usa todo el manual)

Los casos, los recorridos y las capturas corren sobre una base **aparte** (`portfolio_example`), sembrada con una persona ficticia. **Nunca contra la base `portfolio`**: crean y borran datos y cada carga pública suma una visita. El seed se niega a cargar el ejemplo sobre otra base (TC-37).

```powershell
docker exec portfolio-postgres createdb -U portfolio portfolio_example
cd backend
$env:DATABASE_URL = "postgresql://portfolio:portfolio@localhost:5434/portfolio_example?schema=public"
npm run prisma:status && npm run prisma:deploy      # tiene que decir: database "portfolio_example"
$env:SEED_DISPOSABLE_DB = "1"; npm run seed:example && npm run seed:example:verify
$env:PORT = "3310"; npm run start:dev               # API de ejemplo en otro puerto: la del owner sigue en el 3300
# en otra terminal
cd frontend; $env:VITE_PROXY_TARGET = "http://localhost:3310"; npm run dev
```

En los `curl` de este manual, `API=http://localhost:3310`. Para el panel hace falta un administrador de prueba **de esa base** (`npm run admin:bootstrap` con `ADMIN_EMAIL=capture@example.com` y una contraseña aleatoria de la sesión, que no se guarda en ningún archivo). Guía completa: [`DATA-POPULATION.md`](DATA-POPULATION.md) § 11.

### Puertos

| Servicio | Puerto | Cómo se cambia |
|---|---|---|
| Postgres | **5434** | `POSTGRES_PORT=5555 docker compose up -d` |
| Adminer | 8080 | `ADMINER_PORT=8081 docker compose up -d` |
| API (NestJS) | 3300 | `PORT` en `backend/.env` |
| API de ejemplo | 3310 | `PORT=3310` en la terminal, con `DATABASE_URL` de `portfolio_example` |
| Sitio (Vite) | 5173 | `npm run dev -- --port 5174` (con la API de ejemplo: `VITE_PROXY_TARGET=http://localhost:3310`) |

> El Postgres del portafolio **no usa el 5432** a propósito: ese puerto suele estar tomado por otro Postgres local. Si el 5434 también lo está, cambialo con `POSTGRES_PORT` y ajustá `DATABASE_URL` en `backend/.env`.

Comprobá que todo arrancó:

```bash
curl -s http://localhost:3300/health | jq
# {"status":"ok","uptime":16,"checks":{"database":{"status":"up","responseTime":12}}}
```

### Sesión para los `curl`

El panel usa una cookie httpOnly, pero la API también acepta `Authorization: Bearer`, que es más cómodo en consola:

```bash
API=http://localhost:3300          # en producción, el dominio del sitio

TOKEN=$(curl -s -X POST $API/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"tu@email.com","password":"tu-password"}' | jq -r '.accessToken')

AUTH="Authorization: Bearer $TOKEN"
curl -s $API/api/auth/me -H "$AUTH" | jq
```

> El login está limitado a **5 intentos por minuto y por IP**. Si ves un `429`, mirá el `Retry-After`.
>
> Cambiar la contraseña desde **Cuenta** (B14, TC-45) o correr `npm run admin:bootstrap` cierra todas las sesiones anteriores: un `TOKEN` sacado antes da `401`. Volvé a hacer el login de arriba.

---

## 1. Mapa de la plataforma

**Rutas públicas**

| Ruta | Qué es |
|---|---|
| `/` | La home. Es el perfil curado con slug `all` |
| `/:slug` | Un perfil curado. Ej. `/ejemplo-backend` |
| cualquier otra | 404 propio |
| `/robots.txt`, `/sitemap.xml` | Los genera el backend con los perfiles `PUBLIC` |

**Parámetros de URL** — viven en la URL, nunca en `localStorage`, así que se comparten:

| Parámetro | Valores | Por defecto |
|---|---|---|
| `?lang=` | `es`, `en` | `Accept-Language` y después `es`. La API también acepta `?locale=`, con prioridad |
| `?theme=` | `modern-dark`, `modern-light`, `minimal`, `elegant`, `corporate` | `modern-dark` |
| `?layout=` | `classic`, `sidebar` | `classic` |
| `?token=` | el token del perfil | — |

**Panel** — en `/admin`, detrás de la cookie de sesión:

| Ruta | Pantalla |
|---|---|
| `/admin/login` | Entrada |
| `/admin` | Dashboard de analítica, con las tablas **Por origen**, **Por enlace**, **Por portal** y **Por tipo** |
| `/admin/portada` | Perfil base (titular, resumen, contacto, disponibilidad) e idiomas, con vista previa del hero |
| `/admin/experiencias` | CRUD de experiencias |
| `/admin/skills` | CRUD de categorías y skills |
| `/admin/formacion` | Educación y certificaciones |
| `/admin/proyectos` | Proyectos destacados, repositorios de GitHub y enlaces sociales |
| `/admin/perfiles` | Lista de perfiles curados |
| `/admin/perfiles/:id` | **El constructor**: Identidad, Selección, Diseño y Publicación, con preview en vivo |
| `/admin/postulaciones` | Postulaciones: estado de cada proceso, «Abierto el…» y export a CSV |
| `/admin/integraciones` | Integraciones: estado, cola, pausa y credencial de cada proveedor (sin ítem en la barra: se llega desde **Cuenta**) |

---

## A. Ruta de aprendizaje

Ocho conceptos, en este orden: cada uno se apoya en el anterior. Todos los ejemplos salen de la **base de ejemplo** (`docs/examples/cv-data.example.json`, ver § 0 y `docs/DATA-POPULATION.md` § 11): una persona ficticia, sin datos reales.

### C1 — Perfil base

Es tu información profesional **una sola vez**: nombre, titular, resumen, contacto, disponibilidad e idiomas (el perfil base), más las listas de experiencias, skills, formación, certificaciones, proyectos y enlaces. Todo lo que se publica sale de acá: un perfil curado nunca guarda copias, solo decide qué mostrar.

- **En el ejemplo:** Alex Rivera Duarte y su contenido: 6 experiencias (una oculta), 4 categorías con 16 skills, 3 formaciones, 3 certificaciones, 3 proyectos y 4 enlaces.
- **Dónde se edita:** B3 (Portada (con Idiomas)), B4 (Experiencias), B5 (Skills), B6 (Formación), B7 (Proyectos y enlaces)
- **Casos que lo verifican:** TC-01, TC-25, TC-26, TC-27, TC-42

### C2 — Perfil curado

Una **vista filtrada y personalizada** del perfil base, accesible por un `slug` único (`/ejemplo-backend`). Tiene su propio titular, descripción, tema, orden de secciones y reglas de selección. La home es el perfil curado `all`, que no filtra nada.

- **En el ejemplo:** `ejemplo-backend` (Java y microservicios, acento `#1A365D`) y `all` (la home con las 10 secciones).
- **Dónde se edita:** B8 (Perfiles), B9 (Constructor · Identidad)
- **Casos que lo verifican:** TC-03, TC-12, TC-21

### C3 — Tags y overrides

Cada experiencia, skill y proyecto lleva **tags**. Un perfil incluye lo que comparte al menos un tag de su `filterTags` (vacío = todo). Encima, `includeIds` fuerza la inclusión (solo de ítems visibles) y `excludeIds` fuerza la exclusión y **siempre gana**. El orden de salida es cronológico, igual para todos los perfiles.

- **En el ejemplo:** `ejemplo-overrides` fuerza una experiencia sin tags comunes (Brújula Demo), intenta forzar una oculta (se ignora), suma un proyecto y quita una experiencia y una skill que sí coincidían.
- **Dónde se edita:** B10 (Constructor · Selección)
- **Casos que lo verifican:** TC-03, TC-13, TC-20, TC-43

### C4 — Secciones

La página se arma con diez secciones: `hero`, `stats`, `experience`, `skills`, `projects`, `repositories`, `education`, `certifications`, `presence` y `contact`. Cada perfil puede **reordenarlas** y **ocultarlas**. Una sección con datos que no figura en el orden se agrega al final; una sin datos no se muestra. `repositories` necesita además **2 o más** repositorios resueltos para el perfil: con uno solo no se muestra (TC-50).

- **En el ejemplo:** `ejemplo-secciones` reordena las diez y oculta Estadísticas y Presencia. La home (`all`) muestra las diez.
- **Dónde se edita:** B11 (Constructor · Diseño)
- **Casos que lo verifican:** TC-14, TC-36

### C5 — Tema

Los colores, la tipografía y el espaciado son **tokens de diseño** guardados en la base y aplicados como variables CSS en el navegador, sin reconstruir nada. Un perfil elige un **preset** (cinco disponibles) y guarda solo sus diferencias en `themeOverrides`. El acento se deriva solo para que el texto siga siendo legible.

- **En el ejemplo:** `ejemplo-backend` usa `modern-dark` con acento `#1A365D`; `ejemplo-secciones` usa `elegant`, layout `sidebar` y overrides de tipografía y radio.
- **Dónde se edita:** B11 (Constructor · Diseño)
- **Casos que lo verifican:** TC-04, TC-15, TC-34

### C6 — Visibilidad, enumeración y archivo

Tres ejes independientes. La **visibilidad** decide quién abre el link (`PUBLIC`, `PROTECTED` con token, `PRIVATE` da 404). La **enumeración** (`listed`) decide si figura en el menú, el listado y el sitemap. El **archivo** retira el perfil (404) conservando sus visitas. Renombrar un slug deja un **alias** que sigue funcionando.

- **En el ejemplo:** `ejemplo-protegido` (token `ejemplo-token-2026`), `ejemplo-borrador` (privado), `ejemplo-dirigido` (no enumerado), `ejemplo-archivado` y `ejemplo-renombrado` (alias `ejemplo-nombre-anterior`).
- **Dónde se edita:** B12 (Constructor · Publicación)
- **Casos que lo verifican:** TC-06, TC-07, TC-08, TC-10, TC-16, TC-22, TC-23, TC-24

### C7 — Idiomas

Los datos son **bilingües ES/EN en un solo registro**: cada texto traducible es `{ "es": "…", "en": "…" }`. El sitio lo resuelve con `?lang=`; si falta el inglés, muestra el español y el constructor lo **avisa** como faltante de traducción, sin bloquear nada.

- **En el ejemplo:** Todo el ejemplo está en los dos idiomas salvo `description.en` de `ejemplo-borrador`, que falta a propósito.
- **Dónde se edita:** B3 (Portada (con Idiomas)), B13 (Vista previa)
- **Casos que lo verifican:** TC-02, TC-17, TC-32

### C8 — Analítica

Cada carga de una ruta pública registra una **visita** (`ProfileView`): perfil, idioma, origen, fecha y **tipo**; la IP solo como HMAC. Las vistas previas del panel no cuentan. Cada visita se guarda con su tipo: *Personas*, *Tus visitas* (la petición trae la sesión del panel) y *Bots* (sin navegador reconocible: Googlebot, `HeadlessChrome`, `curl`…). **Solo las de personas suman** en el total y en las visitas de cada perfil; las otras se cuentan aparte, en **Por tipo**. Si abrís tu sitio sin la sesión del panel, cuenta como una persona más. El dashboard resume por día, perfil, idioma, origen, enlace, portal y tipo, y los perfiles archivados conservan su historial.

**El origen casi nunca llega.** El sitio no reenvía de dónde vino la persona (`Referrer-Policy: no-referrer`) y LinkedIn, Gmail o el chat tampoco lo mandan, así que en producción **Por origen** da casi siempre `directo`. Lo que sí viaja es el link: un **enlace de seguimiento** (`?via=<código>`, uno por destinatario o portal, con etiqueta y revocación) o un **portal** genérico (`?src=<portal>`). Cada **apertura** de una persona se cuenta en el enlace y en el portal, y se ve en **Por enlace** y **Por portal**. Un enlace revocado deja de atribuir, pero el link sigue abriendo el perfil.

- **En el ejemplo:** 105 visitas sintéticas en 5 perfiles (`all`, `ejemplo-backend`, `ejemplo-secciones`, `ejemplo-archivado`, `ejemplo-protegido`), con orígenes directo, LinkedIn, buscador y un dominio de `example.com`. Ninguna trae enlace ni portal: las tablas **Por enlace** y **Por portal** arrancan con su estado vacío.
- **Dónde se edita:** B2 (Dashboard); los enlaces se crean en B12 (Constructor · Publicación)
- **Postulaciones:** el CRM del panel (B15) usa estas aperturas para mostrar «Abierto el…» en cada postulación con enlace.
- **Casos que lo verifican:** TC-18, TC-39, TC-41, TC-46


---

## B. Recorridos por objetivo

Nueve tareas reales, con los pasos por pantalla, lo que tiene que pasar, los errores típicos y los casos que las verifican. Se ejecutaron sobre la base de ejemplo (ver `openspec/changes/add-learning-guide-and-example-data/verification/5.3-recorridos.md`).

### R1 — Preparar un perfil para una vacante

1. **Perfiles** → botón **Duplicar** en `ejemplo-backend` → confirmar (también se puede crear con **Nuevo perfil**). La copia nace privada y sin enumerar, y se abre en el constructor.
2. **Identidad**: cambiá el **Slug** (kebab-case, es la URL), el **Título** y el **Titular** en ES y EN, y el **Tipo de rol**.
3. **Selección**: activá los **Tags de filtrado** de la vacante y mirá la vista previa. Con *Incluir* o *Excluir* ajustás experiencias, skills y proyectos puntuales.
4. **Diseño**: elegí el **Tema** y el **Acento**, y ordená u ocultá las **Secciones**.
5. **Guardar**. Después, en **Publicación**, cambiá la **Visibilidad** a `Público` (o `Protegido` con token) y copiá el **Link público**.

**Resultado esperado:** El link responde 200 y muestra solo lo que pasa el filtro, con el titular y el tema del perfil nuevo. Mientras fue privado, nadie lo veía (404).

**Errores típicos:** `Ya existe un perfil con ese slug` (409) al elegir un slug tomado, o que es el alias de otro perfil. Si la vista previa queda vacía, los tags no coinciden con ninguna experiencia: mirá los tags disponibles en **Selección**.

**Casos:** TC-12, TC-13, TC-15, TC-16, TC-21

### R2 — Mandarlo a una sola empresa

1. En **Perfiles** abrí el perfil (por ejemplo `ejemplo-dirigido`) → pestaña **Publicación**.
2. Apagá **Enumerar en la home y el sitemap** y **Guardar**. El perfil sigue abriendo por su link pero sale del menú, del listado y del sitemap.
3. Si además querés que lo abra solo quien tiene una clave: **Visibilidad** → `Protegido` y completá el **Token de acceso** (obligatorio). Compartí el link con `?token=`.
4. Copiá el **Link público** y comprobalo en una ventana privada.

**Resultado esperado:** `ejemplo-dirigido` responde 200 por su link y no figura en `/sitemap.xml`, en `GET /api/curated-profiles` ni en el menú de la home. `ejemplo-protegido` responde 401 sin token y 200 con `?token=ejemplo-token-2026`.

**Errores típicos:** Un protegido sin token guardado: `Un perfil protegido necesita un token de acceso`. Un perfil **privado** no sirve para esto: da 404 incluso con el link (úsalo para borradores).

**Casos:** TC-16, TC-23, TC-06, TC-07

### R3 — Retirar un perfil sin perder sus visitas

1. **Perfiles** → abrí el perfil → pestaña **Publicación**.
2. Bloque **Archivado** → **Archivar** → confirmar. El perfil sale del listado, del menú y del sitemap.
3. Para volver atrás, el mismo bloque ofrece **Desarchivar**.
4. Verificá en el **Dashboard**: el perfil sigue en *Por perfil*, marcado como `archivado`, con sus visitas.

**Resultado esperado:** `ejemplo-archivado` responde 404 por su link, incluso con token, pero conserva sus 14 visitas en el dashboard.

**Errores típicos:** Borrar en lugar de archivar elimina las visitas con el perfil (el diálogo lo advierte). Un `PATCH` con `archivedAt` da 400: usá los botones.

**Casos:** TC-22, TC-18

### R4 — Renombrar el slug sin romper los links

1. Abrí el perfil en el constructor → pestaña **Identidad**.
2. Cambiá el **Slug** por el nuevo y **Guardar**.
3. Abrí el slug anterior en el navegador: el sitio resuelve el mismo perfil y corrige la URL solo.

**Resultado esperado:** `/ejemplo-nombre-anterior` responde 200 con el perfil `ejemplo-renombrado`; el sitemap y el `canonical` usan solo el slug nuevo.

**Errores típicos:** `Ya existe un perfil con ese slug` (409) si el nuevo es el de otro perfil o el alias de otro. Volver a un slug anterior propio libera el alias.

**Casos:** TC-24

### R5 — Ajustar el tema y el acento

1. Constructor → pestaña **Diseño** → **Tema base**: elegí un preset. Si ya hiciste ajustes, el panel pregunta antes de perderlos (**Cambiar el tema base**).
2. Ajustá los **Colores** (ocho controles, con su valor hexadecimal), las **Fuentes**, la **Densidad** y los efectos. La vista previa cambia al instante.
3. Para un acento oscuro (por ejemplo `#1A365D`) escribilo en **Acento**: el sitio deriva solo un tono legible para el texto, sin cambiar lo que guardás.
4. **Restablecer** vuelve al preset. **Guardar**.

**Resultado esperado:** Se guarda solo la diferencia contra el preset en `themeOverrides`. En `ejemplo-backend` el texto en acento se lee con contraste de 4,5:1 o más aunque el color de relleno sea oscuro.

**Errores típicos:** Un hexadecimal inválido se marca en el campo y no rompe la vista previa. Cambiar el preset descarta los ajustes: el aviso lo dice.

**Casos:** TC-04, TC-15, TC-34

### R6 — Editar el contenido base

1. **Portada**: editá el titular, el resumen, el contacto y la disponibilidad (pestañas ES/EN) y **Guardar portada**.
2. **Experiencias**: **Nueva experiencia** o el lápiz de una existente. Los **Tags** deciden en qué perfiles entra; apagá **Visible en el portafolio** para ocultarla sin borrarla.
3. **Skills**: categorías y skills, con sus **Tags**.
4. **Formación** (educación y certificaciones) y **Proyectos y enlaces**: lo mismo, con **Visible** para ocultar. En cada certificación podés cargar el **Enlace de verificación** (solo `https://`), el **ID de credencial** y cuándo **Vence**: el sitio muestra «Ver credencial» y, si ya venció, «Vencida» (TC-42).
5. Recargá `/`: los cambios se ven al instante, sin correr el seed.

**Resultado esperado:** El cambio aparece en la home y en cada perfil curado que lo incluya. Lo oculto sigue en el panel con la marca *Oculto*.

**Errores típicos:** Mensajes en línea como `La empresa es obligatoria` o `Usá el formato AAAA-MM o AAAA`; ver cada pantalla. **No corras `npm run seed`** sobre una base con contenido editado: lo pisa.

**Casos:** TC-19, TC-20, TC-25, TC-26, TC-27, TC-42

### R7 — Traducir y revisar faltantes

1. Abrí el constructor del perfil (por ejemplo `ejemplo-borrador`) y elegí **EN** en el conmutador de la **Vista previa**.
2. Pestaña **Publicación**: el aviso lista cada campo sin traducir (`Falta 1 traducción en EN`).
3. Completá el inglés donde corresponda (Identidad: pestañas ES/EN de cada campo; contenido base: sus pantallas) y volvé a mirar el aviso.
4. Es solo un aviso: podés guardar y publicar igual; donde falta, el sitio muestra el español.

**Resultado esperado:** En `ejemplo-borrador` el único faltante es `Descripción` del perfil curado. Al completarlo, el aviso pasa a `Sin faltantes de traducción en EN`.

**Errores típicos:** Si el aviso muestra `Comprobando traducciones en EN…` mucho rato, la vista previa no cargó: revisá que el borrador tenga los obligatorios.

**Casos:** TC-17, TC-32, TC-02

### R8 — Imprimir o guardar en PDF

1. Abrí el perfil público (por ejemplo `/ejemplo-backend`).
2. Botón **Imprimir / Guardar PDF** de la barra superior (o **Ctrl+P**).
3. En el diálogo: papel A4 o Letter, sin encabezados ni pies, y destino *Guardar como PDF*.

**Resultado esperado:** Una sola hoja, texto oscuro sobre blanco, sin barra ni selectores, con el pie *Versión completa* y la URL del perfil sin token ni tema.

**Errores típicos:** En un perfil protegido el botón no aparece en la pantalla del token. Imprimir no registra una visita.

**Casos:** TC-31

### R9 — Leer la analítica

1. **Dashboard** → elegí el **rango** (7, 30, 90 días o un año).
2. Mirá los totales (**Visitas en el rango**, **Perfiles vistos**, **Idiomas**) y **Visitas por día**.
3. En **Por perfil** abrí el constructor o la vista pública con los enlaces de cada fila; el perfil archivado lleva la marca `archivado`.
4. **Por origen** muestra de dónde llegó cada visita según el navegador: `directo`, `linkedin.com`, `google.com`… En producción casi siempre da `directo`, porque el sitio no reenvía el origen.
5. **Por enlace** muestra qué enlace de seguimiento abrió cada persona (con el perfil, el portal y la marca `revocado`) y, al final, **Sin enlace**: las visitas que no llegaron por ninguno.
6. **Por portal** muestra el portal del enlace o del link genérico (`?src=`) y, al final, **Sin portal**. No depende del referrer.
7. **Por tipo** separa *Personas*, *Tus visitas* y *Bots*: solo las de personas suman en el total.

**Resultado esperado:** Con el ejemplo y 30 días: 105 visitas, 5 perfiles vistos, 2 idiomas, y los orígenes directo, linkedin.com, google.com y empleos.example.com. **Por enlace** y **Por portal** quedan con su estado vacío hasta que se envíe un link con código.

**Errores típicos:** Las visitas de hoy cuentan (defecto D-01 corregido). La vista previa del panel y la carga de otra persona de `/admin` no suman visitas. Tus propias visitas (con la sesión del panel) y las de bots tampoco suman en el total: están en **Por tipo**. Si **Por origen** dice `directo` para todo, es lo esperado: mirá **Por enlace** y **Por portal**.

**Casos:** TC-18, TC-39, TC-41, TC-46


---

## C. Manual del backoffice por pantalla

Una subsección por pantalla del panel (`/admin`). Las tablas de campos usan la **etiqueta tal como se ve**; la columna *Mensaje* cita el texto **literal** del código (`npm run manual:check` lo comprueba contra `frontend/src`). Los ejemplos son del archivo de ejemplo.

### B1 — Login

Ruta: `/admin/login`. Entrada al panel. La sesión es una cookie `httpOnly`: el navegador nunca guarda el token y el panel deriva la sesión de `GET /api/auth/me`. `/admin` redirige acá sin sesión y vuelve al destino original tras entrar.

| Campo | Tipo | Obligatorio | Validación | Ejemplo |
|---|---|---|---|---|
| Email | texto (email) | Sí | Formato de email | `capture@example.com` |
| Contraseña | texto (oculto) | Sí | No se valida el formato; la API responde 401 si no coincide | — |

| Mensaje | Cuándo |
|---|---|
| Email o contraseña incorrectos | La API respondió 401. El email escrito se conserva. |
| No pudimos contactar al servidor. Intentá de nuevo. | Cualquier otro error (red caída, API apagada). |

**Acciones y avisos:** El login está limitado a 5 intentos por minuto y por IP (429 con `Retry-After`).

Para la guía y las capturas se usa un administrador de prueba (`npm run admin:bootstrap` con una contraseña aleatoria de la sesión). Una vez dentro, la contraseña se cambia desde **Cuenta** (B14); si se perdió, `npm run admin:bootstrap` es la recuperación.

![Login del backoffice](manual/tc11-login.jpg)

![Error de credenciales](manual/tc11-login-error.jpg)

### B2 — Dashboard

Ruta: `/admin`. Visitas de las vistas públicas. Rango: 7, 30 (por defecto), 90 días o el último año. Totales (de **personas**), **Visitas por día**, **Por perfil** (con enlaces al constructor y a la vista pública y la marca `archivado`), **Por idioma**, **Por origen** (con la aclaración de que casi siempre da `directo`), **Por enlace** (etiqueta, perfil, portal, marca `revocado` y visitas, más una fila final **Sin enlace**), **Por portal** (con una fila final **Sin portal**) y **Por tipo** (*Personas*, *Tus visitas* y *Bots*, con la aclaración de que solo las de personas suman). Sobre los totales hay una franja con las postulaciones activas por estado y el enlace **Ver postulaciones** (B15); muestra el estado de hoy y no cambia con el rango.

| Campo | Tipo | Obligatorio | Validación | Ejemplo |
|---|---|---|---|---|
| Rango | selector | Sí (30 días por defecto) | 7, 30, 90 días o último año | Últimos 30 días |

| Mensaje | Cuándo |
|---|---|
| Todavía no hay visitas | No hay visitas en el rango elegido; el texto de apoyo es «Cuando alguien abra un perfil curado en el rango elegido, aparecerá acá.» |

**Acciones y avisos:** Solo lectura. Las visitas se registran en la ruta pública, no en la vista previa del panel. Si el rango solo tiene visitas propias o de bots, el estado vacío convive con la tabla **Por tipo**; con los tres tipos en cero, aparece solo el estado vacío. **Por enlace** y **Por portal** cuentan solo visitas de personas; sin ninguna atribuida muestran un texto que manda a la pestaña **Publicación** en lugar de una tabla de ceros.

Con el ejemplo y 30 días: 105 visitas de personas, 5 perfiles vistos y 2 idiomas.

![Dashboard de analítica](manual/tc18-dashboard.jpg)

### B3 — Portada (con Idiomas)

Ruta: `/admin/portada`. El perfil base: lo primero que se lee en todos los links. **Identidad y contacto**, **Disponibilidad**, una **Vista previa** del hero (la resuelve el backend, con el mismo mapper de la ruta pública) e **Idiomas**. El `PUT` de la Portada **reemplaza todo el perfil**: guardá siempre desde esta pantalla, no editando campos sueltos por la API.

| Campo | Tipo | Obligatorio | Validación | Ejemplo |
|---|---|---|---|---|
| Nombre completo | texto | Sí | No vacío | `Alex Rivera Duarte` |
| Titular | ES/EN | Sí (ES) | Español obligatorio | `Ingeniera de Software Senior · …` |
| Resumen | ES/EN | Sí (ES) | Español obligatorio | `Ingeniera de software con más de diez años…` |
| Email | texto | Sí | Formato de email | `alex.rivera@example.com` |
| Teléfono | texto | No | — | `+1 555 0142` |
| Ubicación | texto | Sí | No vacío | `Ciudad Ejemplo, Ejemplandia` |
| Huso horario | texto | No | — | `UTC-03:00` |
| Años de experiencia | entero | Sí | Entero mayor o igual a 0 | `11` |
| Fecha de inicio / Modalidad / Tipo de contrato | ES/EN | No | — | `A convenir` · `Remoto / Híbrido` |
| Idioma · Nombre / Nombre mostrado / Nivel / Detalle | texto / ES/EN | Nombre y Nivel (ES) | El español del nivel es obligatorio | `Inglés` · `Avanzado (C1)` / `Advanced (C1)` |

| Mensaje | Cuándo |
|---|---|
| El nombre es obligatorio | Nombre completo vacío. |
| El titular en español es obligatorio | Titular sin español. |
| El resumen en español es obligatorio | Resumen sin español. |
| El email no es válido | Email con formato inválido. |
| La ubicación es obligatoria | Ubicación vacía. |
| Los años deben ser un entero mayor o igual a 0 | Años de experiencia negativos o con decimales. |
| El nombre y el nivel son obligatorios | Diálogo de idioma sin nombre o sin nivel. |

**Acciones y avisos:** **Guardar portada** (habilitado solo con cambios). Borrar un idioma pide confirmación: «Se borrará "…" del perfil base y de todos los links.» Salir con cambios abre **Tenés cambios sin guardar** (TC-29); cambiar el idioma de la vista previa no cuenta como cambio.

El titular base lo usan la home y todo perfil curado sin titular propio.

![Portada con la vista previa del hero](manual/tc25-portada.jpg)

![Diálogo de idioma con el nivel en ES y EN](manual/bo-portada-idioma.jpg)

### B4 — Experiencias

Ruta: `/admin/experiencias`. Lista cronológica con empresa, período, tags y orden; las ocultas se atenúan y llevan la marca *Oculta*. **Nueva experiencia** y el lápiz abren el formulario en un diálogo.

| Campo | Tipo | Obligatorio | Validación | Ejemplo |
|---|---|---|---|---|
| Empresa | texto | Sí | No vacío | `Cobalto Ejemplo` |
| Ubicación | texto | Sí | No vacío | `Ciudad Ejemplo · Remoto` |
| Rol | ES/EN | Sí (ES) | Español obligatorio | `Tech Lead Backend` |
| Inicio | mes (AAAA-MM) | Sí | No vacío | `2025-02` |
| Fin | mes | No | Vacío si es **Actual** | `2025-01` |
| Actual | interruptor | No | Implica Fin vacío | activado |
| Orden | entero | No | Mayor o igual a 0; desempata el mismo inicio | `0` |
| Visible en el portafolio | interruptor | No (activado) | Apagado: no sale en ningún perfil, ni forzado con `includeIds` | Terracota Demo: apagado |
| Resumen | ES/EN | Sí (ES) | Español obligatorio | `Liderazgo técnico de un equipo…` |
| Logros (es) / Logros (en) | lista de textos | No | Un renglón por logro | `Definí los estándares…` |
| Tecnologías / Tags / Sector | chips | No | Los **tags** alimentan `filterTags` | `java` · `spring-boot` |

| Mensaje | Cuándo |
|---|---|
| La empresa es obligatoria | Empresa vacía. |
| El rol en español es obligatorio | Rol sin español. |
| La fecha de inicio es obligatoria | Inicio vacío. |
| La ubicación es obligatoria | Ubicación vacía. |
| El resumen en español es obligatorio | Resumen sin español. |

**Acciones y avisos:** Borrar pide confirmación: «Se borrará "rol" en empresa. Esta acción no se puede deshacer.» Cerrar el diálogo con cambios abre **Tenés cambios sin guardar** (TC-30).

El formulario expone **Logros (es)** y **Logros (en)**. La traducción al inglés es opcional: si falta, la vista en inglés muestra el español.

![Lista de experiencias](manual/tc19a-experiencias.jpg)

![Formulario de experiencia](manual/tc19b-formulario.jpg)

![Errores de validación al guardar vacío](manual/bo-experiencia-errores.jpg)

### B5 — Skills

Ruta: `/admin/skills`. Las skills viven dentro de categorías. **Nueva categoría** (nombre ES/EN y orden) y, dentro de cada una, **Nueva skill** (nombre, tags y orden). Una skill se mueve de categoría editándola.

| Campo | Tipo | Obligatorio | Validación | Ejemplo |
|---|---|---|---|---|
| Categoría · Nombre | ES/EN | Sí (ES) | Español obligatorio | `Lenguajes` / `Languages` |
| Categoría · Orden | entero | No | Mayor o igual a 0 | `0` |
| Skill · Nombre | texto | Sí | No vacío | `Spring Boot` |
| Skill · Tags | chips | No | Deciden en qué perfiles aparece | `java` · `spring-boot` |
| Skill · Orden | entero | No | Mayor o igual a 0 | `0` |

**Acciones y avisos:** Sin mensaje en línea: con el nombre vacío, **Guardar** no hace nada. Borrar una categoría borra sus skills y el diálogo de confirmación lo dice con la cuenta de skills (*«Se borrará "…" y también sus N skills. Esta acción no se puede deshacer.»*).

Una categoría entra en un perfil si alguna de sus skills comparte un tag con `filterTags`. En el ejemplo, la categoría *Backend* usa skills `{ name, tags }` y *Lenguajes* un tag por categoría.

![Skills por categoría](manual/tc20-skills.jpg)

![Diálogo de skill con sus tags](manual/bo-skills-dialogo.jpg)

### B6 — Formación

Ruta: `/admin/formacion`. Dos listas, **Educación** y **Certificaciones**, con el mismo patrón de lista y diálogo. Desmarcar **Visible en el sitio** oculta un ítem sin borrarlo.

| Campo | Tipo | Obligatorio | Validación | Ejemplo |
|---|---|---|---|---|
| Título | ES/EN | Sí (ES) | Español obligatorio | `Maestría en Ingeniería de Software` |
| Institución | texto | Sí | No vacío | `Universidad Ejemplo` |
| Inicio | AAAA-MM o AAAA | Sí | Formato AAAA-MM o AAAA | `2010` |
| Fin | AAAA-MM o AAAA | No | No anterior al inicio; vacío si está **En curso** | `2014` |
| En curso | interruptor | No | Excluye la fecha de fin | activado en la maestría |
| Certificación · Nombre | ES/EN | Sí (ES) | Español obligatorio | `Arquitecto de Soluciones en la Nube` |
| Certificación · Emisor | texto | Sí | No vacío | `Consorcio Cloud Ejemplo` |
| Certificación · Año | AAAA | No | Cuatro dígitos | `2023` (vacío en *Liderazgo técnico…*) |
| Certificación · Enlace de verificación | URL | No | Solo `https://`, hasta 2048 caracteres; vacío la quita | `https://example.org/credenciales/arquitecto-nube-2023` |
| Certificación · ID de credencial | texto | No | Hasta 100 caracteres | `EJ-2023-0042` |
| Certificación · Vence | AAAA-MM o AAAA | No | No anterior al año de la certificación; vacío si no vence | `2029-06` |
| Orden / Visible en el sitio | entero / interruptor | No | Orden mayor o igual a 0 | `0` · activado |

| Mensaje | Cuándo |
|---|---|
| El título en español es obligatorio | Formación sin título en español. |
| La institución es obligatoria | Institución vacía. |
| La fecha de inicio es obligatoria | Inicio vacío. |
| Usá el formato AAAA-MM o AAAA | Fecha de inicio, de fin o vencimiento con otro formato. |
| Una formación en curso no lleva fecha de fin | En curso con fecha de fin. |
| La fecha de fin no puede ser anterior al inicio | Fin anterior al inicio. |
| El nombre en español es obligatorio | Certificación sin nombre en español. |
| El emisor es obligatorio | Emisor vacío. |
| Usá el formato AAAA | Año de una certificación con otro formato (por ejemplo `20x`). |
| Usá una URL completa que empiece con https:// | Enlace de verificación con `http://`, sin protocolo, sin dominio o de más de 2048 caracteres. |
| El ID de credencial admite hasta 100 caracteres | ID de credencial más largo. |
| El vencimiento no puede ser anterior al año | **Vence** en un año anterior al **Año** de la certificación. |
| El orden no puede ser negativo | Orden menor que 0. |

**Acciones y avisos:** Borrar pide confirmación. Los ocultos siguen en el panel con la marca *Oculto*. El sitio no consulta al emisor ni comprueba que el enlace funcione: abrilo después de cargarlo (TC-42).

![Formación en el panel](manual/tc26-formacion.jpg)

![Certificación con los campos de credencial y el error de enlace](manual/bo-formacion-certificacion.jpg)

### B7 — Proyectos y enlaces

Ruta: `/admin/proyectos`. Proyectos destacados, repositorios de GitHub y enlaces sociales, en tres bloques; la página se titula «Proyectos, repositorios y enlaces» (el ítem del menú sigue diciendo **Proyectos**). Un proyecto o un repositorio con **tags** que coincidan con los `filterTags` de un perfil aparece en él; el proyecto con su **URL** como enlace y el repositorio con el nombre enlazado a GitHub.

| Campo | Tipo | Obligatorio | Validación | Ejemplo |
|---|---|---|---|---|
| Proyecto · Nombre | texto | Sí | No vacío | `Plataforma de Reservas` |
| Proyecto · Período | texto | Sí | No vacío | `2024` |
| Proyecto · Rol / Resumen | ES/EN | Sí (ES) | Español obligatorio | `Arquitecta y líder técnica` |
| Proyecto · URL | texto | No | Absoluta, con http:// o https:// | `https://reservas.example.com` |
| Proyecto · Tecnologías / Tags | chips | No | Los tags alimentan `filterTags` | `java` · `microservices` |
| Proyecto · Orden / Visible en el portafolio | entero / interruptor | No | Orden entero mayor o igual a 0 | `0` · activado |
| Repositorio · URL de GitHub | texto | Sí | Exactamente `https://github.com/<usuario>/<repositorio>`; no se repite el mismo `usuario/repositorio` | `https://github.com/portafolio-ejemplo-ficticio/reservas-api` |
| Repositorio · Nombre | texto | Sí | 1 a 100 caracteres; al salir de la URL se propone el nombre del repositorio | `reservas-api` |
| Repositorio · Lenguaje | texto | No | Hasta 40 caracteres | `Java` |
| Repositorio · Descripción | ES/EN | Sí (ES) | Español obligatorio | `API de reservas con Spring Boot…` |
| Repositorio · Tecnologías / Tags | chips | No | Los tags alimentan `filterTags` | `java` · `microservices` |
| Repositorio · Orden / Visible en el sitio | entero / interruptor | No | Orden entero mayor o igual a 0 | `0` · activado |
| Enlace · Plataforma | texto | Sí | Solo minúsculas, dígitos y guiones | `github` |
| Enlace · Usuario | texto | Sí | No vacío | `alexrivera-ejemplo` |
| Enlace · URL | texto | Sí | Absoluta, con http:// o https:// | `https://github.example.com/alexrivera-ejemplo` |
| Enlace · Etiqueta / Descripción | ES/EN | Etiqueta sí (ES) | La descripción en inglés exige la del español | `Código y proyectos abiertos` |
| Enlace · Estadísticas (JSON) | objeto JSON | No | Un objeto, no un array ni un texto | `{ "repos": 42 }` |
| Enlace · Destacado / Visible en el portafolio | interruptores | No | — | GitHub destacado |

| Mensaje | Cuándo |
|---|---|
| El nombre es obligatorio | Proyecto sin nombre. |
| El período es obligatorio | Proyecto sin período. |
| El rol en español es obligatorio | Proyecto sin rol en español. |
| El resumen en español es obligatorio | Proyecto sin resumen en español. |
| Usá una URL absoluta que empiece con http:// o https:// | URL del proyecto o del enlace sin esquema. |
| La URL tiene que ser https://github.com/<usuario>/<repositorio> | URL de un repositorio de otro host o fuera de forma (barra final, `.git`, `www.`, query). |
| Ese repositorio ya está cargado | El mismo `usuario/repositorio` ya existe (el servidor responde 409); el mensaje sale en el campo URL y se va al editarla. |
| La descripción en español es obligatoria | Repositorio sin descripción en español. |
| El nombre admite hasta 100 caracteres | Nombre de repositorio demasiado largo. |
| El lenguaje admite hasta 40 caracteres | Lenguaje demasiado largo. |
| La plataforma es obligatoria | Enlace sin plataforma. |
| Solo minúsculas, dígitos y guiones (por ejemplo, github) | Plataforma con mayúsculas, espacios u otros símbolos. |
| El usuario es obligatorio | Enlace sin usuario. |
| La URL es obligatoria | Enlace sin URL. |
| La etiqueta en español es obligatoria | Enlace sin etiqueta en español. |
| Si cargás la traducción, completá también la descripción en español | Descripción solo en inglés. |
| Las estadísticas deben ser un objeto JSON, por ejemplo {"repos": 67} | Estadísticas con un JSON que no es un objeto o con JSON roto. |
| El orden debe ser un entero | Orden con decimales. |

**Acciones y avisos:** Borrar pide confirmación («Se borrará "…". Esta acción no se puede deshacer.» para un proyecto; para un repositorio aclara que el de GitHub no se toca). Un JSON inválido en estadísticas cuenta como cambio y bloquea el envío. Los repositorios ocultos se marcan con la insignia **Oculto**; el diálogo de un repositorio avisa de los cambios sin guardar como los demás. Con menos de 2 repositorios la sección no se muestra en ningún perfil: el bloque vacío lo recuerda.

![Proyectos y enlaces sociales](manual/tc27-proyectos.jpg)

![Bloque Repositorios destacados](manual/tc50-repositorios.jpg)

![Repositorio con una URL que no es de GitHub](manual/tc50-repositorio-dialogo.jpg)

![Enlace social con estadísticas inválidas](manual/bo-enlace-stats.jpg)

### B8 — Perfiles

Ruta: `/admin/perfiles`. Lista de perfiles curados con su slug, visibilidad, taxonomía y visitas, y las marcas `Archivado` y `No enumerado`. Por fila: abrir en el portafolio, editar, **Duplicar** y borrar. **Nuevo perfil** abre el constructor vacío.

| Campo | Tipo | Obligatorio | Validación | Ejemplo |
|---|---|---|---|---|
| Acciones por fila | botones | — | Abrir, Editar, Duplicar, Borrar | `ejemplo-backend` |

| Mensaje | Cuándo |
|---|---|
| Todavía no hay perfiles curados | La lista está vacía. |

**Acciones y avisos:** **Duplicar** pide confirmar: la copia nace privada y sin enumerar, sin token ni visitas ni archivo, y se abre en el constructor. **Borrar** advierte que se pierden las visitas y sugiere archivar.

Es la entrada al constructor (B9 a B13).

![Lista de perfiles curados](manual/tc12a-perfiles-lista.jpg)

![Diálogo Duplicar perfil curado](manual/tc21-duplicar.jpg)

### B9 — Constructor · Identidad

Ruta: `/admin/perfiles/:id`. Primera de las cuatro pestañas del constructor (**Identidad**, **Selección**, **Diseño**, **Publicación**), con la vista previa en vivo a la derecha. Guardar un perfil nuevo lo crea y deja el constructor abierto sobre él.

| Campo | Tipo | Obligatorio | Validación | Ejemplo |
|---|---|---|---|---|
| Slug | kebab-case | Sí | Minúsculas, números y guiones; es la URL pública | `ejemplo-backend` |
| Título | ES/EN | Sí (ES) | Español obligatorio | `Ingeniera Backend Java` |
| Titular | ES/EN | No | Vacío: el hero usa el del perfil base; con inglés exige el español | `Ingeniera Backend Java · Spring Boot…` |
| Descripción | ES/EN | No | — | `Perfil que filtra por tags…` |
| Tipo de rol | ES/EN | No | Agrupa el menú público | `Backend` |
| Tecnología destacada | texto | No | Etiqueta bajo el título en el menú | `Java` |

| Mensaje | Cuándo |
|---|---|
| El slug es obligatorio | Slug vacío. |
| Usá kebab-case: solo minúsculas, números y guiones | Slug con mayúsculas, espacios u otros símbolos. |
| El título en español es obligatorio | Título sin español. |
| Falta el titular en español | Titular con inglés y sin español. |
| Ya existe un perfil con ese slug | La API respondió 409: el slug es de otro perfil o es el alias de otro. |
| Revisá los campos marcados | Guardar con errores de validación. |

**Acciones y avisos:** Cambiar el slug de un perfil guardado deja el anterior como **alias** (R4). Salir con cambios abre **Tenés cambios sin guardar** (TC-28).

![Constructor, pestaña Identidad](manual/tc12b-identidad.jpg)

### B10 — Constructor · Selección

Ruta: `/admin/perfiles/:id`. Qué entra en el perfil. Los **Tags de filtrado** se activan como chips (abajo, los tags disponibles en los datos: de experiencias, skills, proyectos y repositorios). Después vienen cuatro bloques, **Experiencias**, **Skills** (agrupadas por categoría, con un buscador), **Proyectos** y **Repositorios**, y en cada fila los botones **Incluir** y **Excluir**.

| Campo | Tipo | Obligatorio | Validación | Ejemplo |
|---|---|---|---|---|
| Tags de filtrado | chips | No | Sin tags entran todas las experiencias visibles | `java` · `microservices` |
| Incluir (por experiencia) | botón | No | Fuerza la inclusión; solo de ítems visibles | Brújula Demo en `ejemplo-overrides` |
| Excluir (por experiencia) | botón | No | Fuerza la exclusión; siempre gana | Atlas Demo en `ejemplo-overrides` |
| Buscar skill | texto | No | Filtra las skills por nombre (sin distinguir mayúsculas ni acentos); no busca por categoría y no cambia el perfil | `kot` deja solo Kotlin |
| Incluir (por skill) | botón | No | Fuerza una skill aunque no comparta tags; su categoría aparece con esa skill | React en `ejemplo-overrides` |
| Excluir (por skill) | botón | No | Quita una skill que sí coincide; siempre gana | Kotlin en `ejemplo-overrides` |
| Incluir (por proyecto) | botón | No | Fuerza la inclusión; solo de proyectos visibles | Herramienta Interna de Métricas en `ejemplo-overrides` |
| Excluir (por proyecto) | botón | No | Fuerza la exclusión; siempre gana | Plataforma de Reservas |
| Incluir (por repositorio) | botón | No | Fuerza la inclusión; solo de repositorios visibles | `reservas-api` en `ejemplo-renombrado` |
| Excluir (por repositorio) | botón | No | Fuerza la exclusión; siempre gana | `metricas-dashboard` |
| Oculta / Oculto | insignia | — | Un ítem con `visible: false` lleva la insignia y su **Incluir** está deshabilitado | Terracota Demo, Prototipo en Pausa y `experimento-oculto` |

**Acciones y avisos:** la vista previa se recalcula con cada clic. **Incluir** y **Excluir** se apagan entre sí: pulsar uno en un ítem excluido (o al revés) lo cambia de lado, y pulsarlo de nuevo lo deja sin override. Si un perfil guardado por la API trae el mismo id en los dos arreglos, la fila lo muestra como excluido y dice «Excluida: la exclusión gana sobre la inclusión». El encabezado de cada categoría cuenta las skills forzadas o quitadas («1 excluida»). Las skills se ajustan **de a una**: no hay un botón para incluir o excluir una categoría entera.

Un ítem oculto (experiencia o proyecto con `visible: false`) se lista al final de su bloque con la insignia **Oculta** u **Oculto** y su **Incluir** deshabilitado («Oculta: no entra aunque la incluyas»), salvo que ya esté incluido: así se puede quitar esa inclusión. Si el perfil guarda ids de ítems que ya no existen, la pestaña avisa «1 referencia a un ítem que ya no existe» (o «N referencias a ítems que ya no existen») con el botón **Quitar**, que los saca del borrador; hasta que lo pulses y guardes se conservan y no cambian el resultado. Si alguna de las cuatro listas no carga, ese bloque muestra el error con **Reintentar**, no se informan referencias y **Guardar** no altera los ids. Si el preview resuelve exactamente 1 repositorio, el bloque **Repositorios** avisa «La sección Repositorios se muestra desde 2; este perfil resuelve 1» (en `ejemplo-renombrado`); la pestaña **Publicación** suma al aviso de traducciones la descripción de cada repositorio seleccionado.

Los ítems con `visible: false` nunca entran, ni forzándolos: en `ejemplo-overrides`, Terracota Demo (oculta) no aparece aunque esté en `includeRefs`.

![Constructor, pestaña Selección](manual/tc13-seleccion.jpg)

![Constructor, bloques Skills y Proyectos](manual/tc43-overrides.jpg)

### B11 — Constructor · Diseño

Ruta: `/admin/perfiles/:id`. Layout, **Secciones** (un interruptor de visibilidad y las flechas **Subir** y **Bajar** por cada una de las diez) y el customizador de **Tema**: tema base, ocho colores, fuentes, densidad y efectos. Solo se guardan las diferencias contra el tema base en `themeOverrides`.

| Campo | Tipo | Obligatorio | Validación | Ejemplo |
|---|---|---|---|---|
| Layout | selector | Sí (`classic`) | `classic` o `sidebar` | `sidebar` en `ejemplo-secciones` |
| Secciones · Mostrar / Subir / Bajar | interruptor y flechas | No | Una sección con datos que no figura en el orden va al final | Estadísticas y Presencia ocultas |
| Tema base | selector | Sí | Uno de los cinco presets | `elegant` |
| Colores (8) | hexadecimal | No | Hexadecimal válido; uno inválido se marca y no rompe la vista previa | Acento `#1A365D` |
| Fuente del cuerpo / Fuente de títulos | selector | No | — | `Georgia` en `ejemplo-secciones` |
| Densidad | selector | No | Compacta, Cómoda o Amplia | Cómoda |
| Restablecer | botón | — | Vuelve al preset y descarta los ajustes | — |

| Mensaje | Cuándo |
|---|---|
| Cambiar el tema base | Título del diálogo al elegir otro preset con ajustes hechos. |
| Los ajustes de color, tipografía y espaciado que hiciste sobre el tema actual se perderán. | Texto de ese diálogo de confirmación. |

**Acciones y avisos:** Cambiar el tema base pide confirmar si había ajustes. Los colores se aplican como variables `--t-*` solo en el contenedor de la vista previa.

Ver R5 (Ajustar el tema y el acento).

![Constructor, pestaña Diseño con las secciones](manual/tc14-secciones.jpg)

![Customizador de tema](manual/tc15-tema.jpg)

![Pestaña Diseño completa](manual/bo-constructor-diseno.jpg)

### B12 — Constructor · Publicación

Ruta: `/admin/perfiles/:id`. Los tres ejes: **Visibilidad**, **Enumerar en la home y el sitemap** y **Archivado**, más el **Link público** (copiar y abrir), **Descargar JSON Resume**, **Compartir en LinkedIn**, los **Enlaces de seguimiento** y el aviso de faltantes de traducción.

| Campo | Tipo | Obligatorio | Validación | Ejemplo |
|---|---|---|---|---|
| Visibilidad | selector | Sí | Público, Protegido o Privado | Protegido en `ejemplo-protegido` |
| Token de acceso | texto | Sí si es Protegido | No vacío | `ejemplo-token-2026` |
| Enumerar en la home y el sitemap | interruptor | No (activado) | No cambia el acceso: un no enumerado abre por su link | Apagado en `ejemplo-dirigido` |
| Archivado | botón | — | Archivar pide confirmar; Desarchivar es directo | `ejemplo-archivado` |
| Link público | solo lectura | — | Copiar y Abrir; avisa si no resuelve | `/ejemplo-borrador` |
| Descargar JSON Resume | dos enlaces (ES y EN) | — | Solo un perfil guardado, de cualquier visibilidad; baja lo guardado, no el borrador | `ejemplo-backend` |
| Compartir en LinkedIn | botón | — | Solo un perfil guardado, público y no archivado; abre la página de compartir de LinkedIn con el link y su código | `ejemplo-backend` |
| Etiqueta (enlace nuevo) | texto | Sí | De 1 a 80 caracteres; se puede cambiar después | `Cobalto — Laura, RR. HH.` |
| Portal (enlace nuevo) | texto con sugerencias | No | Letras, números y guiones, hasta 32 caracteres; no se cambia después | `linkedin` |
| Link genérico por portal | selector y botón | — | Copia `/{slug}?src=<portal>` sin crear ningún enlace | `indeed` |

| Mensaje | Cuándo |
|---|---|
| Un perfil protegido necesita un token de acceso | Visibilidad Protegido sin token. |
| Guardá el perfil primero para crear enlaces de seguimiento. | Perfil nuevo, sin guardar: todavía no hay enlaces. |
| Guardá el perfil para exportarlo | Perfil nuevo, sin guardar: los enlaces de **Descargar JSON Resume** están deshabilitados. |
| Se exporta la última versión guardada | Hay cambios sin guardar: el JSON sale de lo guardado, no del borrador. |
| Los links no resuelven: un perfil privado responde 404. | Aviso sobre los enlaces de un perfil privado. |
| Los links no resuelven: el perfil está archivado y responde 404. | Aviso sobre los enlaces de un perfil archivado. |
| El perfil es protegido: el link incluiría el token y publicarlo en LinkedIn lo expondría. | Motivo por el que **Compartir en LinkedIn** está deshabilitado en un perfil protegido. |
| Revocar enlace de seguimiento | Título del diálogo de **Revocar**. |
| El link sigue abriendo el perfil, pero sus visitas dejan de atribuirse a este enlace. Sus aperturas pasadas se conservan. La revocación no se deshace. | Texto del diálogo de **Revocar**. |
| Este link no resuelve: un perfil privado responde 404. Usalo para borradores. | Aviso bajo el link de un perfil privado. |
| Este link no resuelve: el perfil está archivado y responde 404. | Aviso bajo el link de un perfil archivado. |
| Archivar perfil curado | Título del diálogo de **Archivar**. |
| El link deja de funcionar (responde 404) y el perfil sale del listado y del sitemap. Las visitas se conservan y siguen en el dashboard. Se puede desarchivar. | Texto del diálogo de **Archivar**. |

**Acciones y avisos:** **Archivar** → confirmar. **Desarchivar** vuelve al estado anterior. El aviso de faltantes (`Falta 1 traducción en EN`) vive acá, bajo el link.

**Enlaces de seguimiento** (solo con el perfil guardado; usan siempre lo guardado, no el borrador): cada fila muestra la etiqueta (se renombra en el lugar), el portal, las **aperturas** de personas, la última apertura y el estado. **Copiar link** pone en el portapapeles la URL absoluta con `?via=<código>` (con `token` antes si el perfil es protegido). **Revocar** pide confirmar y no se deshace: el link sigue abriendo, pero deja de atribuirse. Las tuyas y las de bots no cuentan como aperturas. **Compartir en LinkedIn** reusa un enlace propio mientras esté activo y solo abre la página de compartir: no publica nada.

![Constructor, pestaña Publicación](manual/tc16-publicacion.jpg)

![Enlaces de seguimiento en Publicación](manual/tc41-enlaces.jpg)

![Publicación de un perfil archivado](manual/tc22-archivado.jpg)

![Publicación de un perfil no enumerado](manual/tc23-dirigido.jpg)

### B13 — Vista previa

Ruta: `/admin/perfiles/:id`. A la derecha del constructor, con los componentes reales del portafolio. La resuelve el backend con el mismo servicio que la ruta pública, así que no puede divergir y **no persiste ni cuenta visitas**. El conmutador **ES / EN** pide la vista previa en el otro idioma (`?locale=en`); es estado de vista y no se guarda.

| Campo | Tipo | Obligatorio | Validación | Ejemplo |
|---|---|---|---|---|
| Idioma de la vista previa | conmutador ES/EN | — | Vuelve a español al recargar | EN en `ejemplo-borrador` |

| Mensaje | Cuándo |
|---|---|
| Completá los campos obligatorios para ver la vista previa. | El borrador no es válido y no se pide la vista previa. |

**Acciones y avisos:** La vista previa refleja el borrador sin guardar: tocar el Slug o un tag la recalcula. Con `ejemplo-borrador` en EN, la pestaña Publicación muestra `Falta 1 traducción en EN`.

![Vista previa en inglés con un borrador sin guardar](manual/tc17-preview-en.jpg)

![Aviso de faltantes de traducción](manual/tc32-faltantes.jpg)

### B14 — Cuenta

Ruta: `/admin/cuenta`. Se llega con el botón **Cuenta** de la barra superior (antes de **Cerrar sesión**). Muestra el nombre y el email del administrador (solo lectura) y el formulario **Cambiar contraseña**. Al cambiarla se **cierran las sesiones abiertas en otros navegadores y dispositivos**; la sesión que hizo el cambio sigue, porque el servidor le emite una cookie nueva. Ninguna contraseña ni token toca `localStorage` ni `sessionStorage`.

| Campo | Tipo | Obligatorio | Validación | Ejemplo |
|---|---|---|---|---|
| Contraseña actual | texto (oculto) | Sí | No vacía; hasta 256 caracteres | — |
| Nueva contraseña | texto (oculto) | Sí | De 12 a 256 caracteres (un acento o un emoji cuentan 1) y distinta de la actual; no se recortan espacios | — |
| Repetí la nueva contraseña | texto (oculto) | Sí | Igual a la nueva | — |

| Mensaje | Cuándo |
|---|---|
| Escribí tu contraseña actual | La actual está vacía. |
| Usá al menos 12 caracteres | La nueva tiene menos de 12 caracteres. |
| Usá como máximo 256 caracteres | La actual o la nueva pasan de 256 caracteres. |
| La nueva contraseña tiene que ser distinta de la actual | La nueva es igual a la actual. |
| Las contraseñas no coinciden | La repetición no es igual a la nueva. No sale ninguna petición. |
| La contraseña actual no es correcta | La API respondió 401 y la sesión sigue vigente. |
| La API rechazó la contraseña nueva. Revisá las reglas. | La API respondió 400. |
| Demasiados intentos. Probá de nuevo en unos minutos. | La API respondió 429: 5 intentos por minuto y por IP, con un contador propio (el del login no cuenta). |
| No pudimos contactar al servidor. Intentá de nuevo. | Cualquier otro error. |
| Contraseña actualizada. Se cerraron las sesiones de otros dispositivos. | Aviso de éxito; los tres campos quedan vacíos. |

**Acciones y avisos:** Si la sesión se revocó (otro dispositivo cambió la contraseña) o venció, la próxima petición del panel da 401 y vuelve al login. Los `curl` con un `TOKEN` anterior al cambio también dan 401 (ver § 0). Si perdiste la contraseña, la recuperación es `npm run admin:bootstrap` desde la terminal: acepta contraseñas de 8 caracteres o más y también cierra todas las sesiones.

![Cuenta con el aviso de repetición distinta](manual/bo-cuenta.jpg)

### B15 — Postulaciones

Ruta: `/admin/postulaciones`. Tu seguimiento personal de procesos: a quién te postulaste, en qué estado está y **si abrieron el enlace** que mandaste. Solo existe en el panel: ninguna ruta pública, el sitemap ni el head de un perfil muestran nada de esto. La lista se filtra por **Estado** (**Activas** por defecto, **Todas** o uno) y el filtro vive en la URL (`?estado=interviewing`), no en `localStorage`. Columnas: Empresa y puesto, Estado, Portal, Perfil, Enlace y Postulada; **Editar** y **Borrar** (con confirmación) por fila.

| Campo | Tipo | Obligatorio | Validación | Ejemplo |
|---|---|---|---|---|
| Empresa | texto | Sí | 1 a 120 caracteres tras recortar | Cobalto Ejemplo |
| Puesto | texto | Sí | 1 a 160 caracteres | Backend Senior |
| URL de la vacante | texto | No | URL absoluta `http://` o `https://`, hasta 2048 caracteres | https://empresa.example/jobs/1 |
| Estado | selector | Sí (*Por postular* por defecto) | Al crear, los siete. Al editar, el actual y los que la API manda en `nextStatuses` (tabla de abajo) | En entrevistas |
| Fecha de postulación | fecha | No | Oculta con *Por postular*. Al elegir otro estado se completa con hoy; no puede ser futura. Vacía, el servidor pone hoy | 2026-11-05 |
| Portal | texto | No | Minúsculas, números y guiones, hasta 32; no empieza con guion. Elegir un enlace con portal completa uno vacío | linkedin |
| Perfil | selector | No | Un perfil curado existente (puede estar archivado) | ejemplo-backend |
| Enlace | selector | No | Solo enlaces `MANUAL` del perfil elegido, activos o revocados; deshabilitado sin perfil. Un enlace solo puede estar en una postulación | Cobalto — Laura, RR. HH. |
| Notas | texto largo | No | Hasta 5000 caracteres. No guardes datos de contacto de personas | Primera llamada con RR. HH. |

**Transiciones de estado** (la tabla vive en el servidor; el selector solo ofrece las válidas y un cambio inválido da 422 sin guardar nada, ni siquiera las notas que se editaron en el mismo guardado):

| Desde | Puede pasar a |
|---|---|
| Por postular | Postulada, Retirada |
| Postulada | En entrevistas, Oferta, Rechazada, Retirada |
| En entrevistas | Oferta, Rechazada, Retirada |
| Oferta | Aceptada, Rechazada, Retirada |
| Aceptada | — (final) |
| Rechazada | Postulada (reabrir) |
| Retirada | Postulada (reabrir) |

| Mensaje | Cuándo |
|---|---|
| Escribí la empresa | La empresa está vacía. |
| Escribí el puesto | El puesto está vacío. |
| Usá como máximo 120 caracteres | La empresa pasa de 120 caracteres. |
| Usá como máximo 160 caracteres | El puesto pasa de 160 caracteres. |
| Usá como máximo 5000 caracteres | Las notas pasan de 5000 caracteres. |
| Usá una URL que empiece con http:// o https:// | La URL de la vacante no empieza con `http://` o `https://`. |
| Usá como máximo 2048 caracteres | La URL de la vacante pasa de 2048 caracteres. |
| Usá solo minúsculas, números y guiones (hasta 32) | El portal tiene otros caracteres o más de 32. |
| La fecha no puede ser futura | La fecha de postulación es posterior a hoy. |
| Ese cambio de estado no está permitido. Elegí uno de la lista. | La API respondió 422: otra pestaña cambió el estado antes. El diálogo sigue abierto; recargá la lista. |
| Ese enlace ya está asociado a otra postulación. | La API respondió 409. El diálogo sigue abierto; elegí otro enlace. |
| Postulación creada | Aviso de éxito al crear. |
| Postulación actualizada | Aviso de éxito al editar. |
| Postulación borrada | Aviso de éxito al borrar (pide confirmación antes). |
| No se pudo exportar. Intentá de nuevo. | **Exportar CSV** falló (por ejemplo, un 500). No se descarga ningún archivo. |
| Todavía no registraste postulaciones | No hay ninguna y el filtro es **Todas**. |
| No hay postulaciones con este estado | No hay ninguna con el filtro elegido (**Activas** u otro estado). |

**Acciones y avisos:** **Abierto el…** es la fecha de la **primera apertura de una persona** del enlace asociado (`firstOpenedAt`), en tu fecha local, o **Sin abrir** si nadie lo abrió. No cuentan tus visitas con la sesión del panel ni las de bots, igual que en **Por enlace** del Dashboard; la cantidad de aperturas está en el `title` de la celda. Si mandaste el link antes de registrar la postulación, esas aperturas previas también cuentan: el enlace es de esa postulación. **Sin datos de contacto.** Bajo **Notas** el diálogo avisa «No guardes datos de contacto de personas»: la plataforma no tiene campos de nombre, email ni teléfono del reclutador y la API rechaza cualquier campo desconocido con 400. **Exportar CSV** descarga las postulaciones con el filtro vigente (`postulaciones-AAAA-MM-DD.csv`, 14 columnas: Empresa, Puesto, Estado, Portal, URL de la vacante, Fecha de postulación, Último cambio de estado, Perfil, Enlace, Abierto el, Aperturas, Notas, Creada y Actualizada). Está en UTF-8 con BOM, separado por comas y con todas las celdas entre comillas. Una celda que empieza con `=`, `+`, `-`, `@`, tabulación o retorno de carro lleva un apóstrofo delante, para que la planilla no la ejecute como fórmula: se ve `'=1+1` como texto. **Para abrirlo:** en Excel, **Datos → Desde texto/CSV**, origen UTF-8 y delimitador coma (con doble clic suele alcanzar); en Google Sheets o LibreOffice, **Archivo → Importar**. La franja del Dashboard (B2) resume el estado actual: «Postulaciones activas: 3 · 2 postuladas · 1 con oferta» con el enlace **Ver postulaciones**; no depende del rango de fechas.

![Postulaciones con el filtro Todas](manual/bo-postulaciones.jpg)

### B16 — Revisión

Ruta: `/admin/revision`. Se llega con el ítem **Revisión** del menú (después de **Perfiles curados**). Contrasta el CV consigo mismo y lista lo que se contradice, con el ítem exacto y un enlace **Abrir** para corregirlo. **Es solo lectura: nada se corrige solo.** La pantalla vuelve a pedir los hallazgos cada vez que se entra; mientras está abierta, **Volver a revisar** actualiza la lista después de corregir.

Arriba, el resumen («1 error · 2 avisos · 1 sugerencia», en singular cuando el número es 1) y una línea de experiencia: «Experiencia: 11 años declarados; las fechas suman 11 años y 11 meses». Debajo, los hallazgos en tres bloques —**Errores**, **Avisos** y **Sugerencias**— y, dentro de cada uno, por tipo de ítem; los bloques vacíos no se muestran. Cada severidad se distingue por su título y su ícono, no solo por el color.

| Severidad | Qué significa |
|---|---|
| Error | El dato viola una regla que la API del panel rechazaría, o rompe el render. Solo puede venir del seed, de SQL directo o de datos anteriores a una validación. |
| Aviso | Probablemente es un descuido y lo ve un reclutador. |
| Sugerencia | Conviene mirarlo, pero suele ser legítimo (una certificación vencida, dos trabajos «actuales»). |

**Las 14 reglas:**

| Código | Severidad | Qué detecta |
|---|---|---|
| `profile.years-mismatch` | aviso | Los años declarados en Portada quedan fuera de [piso, techo] de los años que suman las experiencias cargadas (ocultas incluidas). |
| `date.invalid-format` | error | Una fecha fuera de AAAA-MM (experiencia) o de AAAA-MM / AAAA (formación y vencimiento), o un año de certificación que no es AAAA. |
| `date.end-before-start` | error | La fecha de fin es anterior a la de inicio. |
| `date.ongoing-with-end` | error | Una experiencia «actual» o una formación «en curso» que además tiene fecha de fin. |
| `experience.multiple-current` | sugerencia | Más de una experiencia visible marcada como actual. |
| `i18n.missing-translation` | aviso | Un campo bilingüe vacío en un idioma y con contenido en el otro (el mismo criterio que el aviso del constructor). |
| `i18n.highlights-count-mismatch` | aviso | Los logros de una experiencia tienen distinta cantidad en español y en inglés. |
| `url.invalid` | error | Una URL que no es http(s) en un proyecto o enlace; en una certificación, cualquiera que no sea https. |
| `url.not-https` | aviso | Una URL http (válida) en un proyecto o enlace social. |
| `certification.expired` | sugerencia | Una certificación visible con vencimiento anterior al mes actual. |
| `curated.orphan-reference` | aviso | Un id de includeIds o excludeIds que no es ninguna experiencia, skill ni proyecto. |
| `curated.conflicting-reference` | sugerencia | El mismo id en includeIds y excludeIds (gana la exclusión). |
| `curated.unmatched-filter-tag` | aviso | Un tag de filtro que ningún ítem visible tiene. |
| `curated.no-experiences` | aviso | Con sus criterios, el perfil curado no muestra ninguna experiencia. |

| Texto del hallazgo (ejemplos) | Regla |
|---|---|
| Declarás {declared} años de experiencia, pero las experiencias cargadas suman {años} años y {meses} meses. | Perfil |
| {campo} no tiene un formato válido (AAAA-MM): «{valor}». · La fecha de fin ({fin}) es anterior a la de inicio ({inicio}). · Está marcada como actual y además tiene fecha de fin ({fin}). | Fechas |
| Falta el texto en inglés de summary. · Los logros tienen 4 ítems en español y 3 en inglés. | Traducciones |
| url no es una URL válida. · url usa http; conviene https. · Venció en 2025-12: el sitio la muestra como «Vencida». | Enlaces |
| Con sus criterios actuales no muestra ninguna experiencia. · El tag «cobol» no coincide con ninguna experiencia, skill ni proyecto visible. | Perfiles curados |

| Mensaje | Cuándo |
|---|---|
| No hay hallazgos: el CV es consistente. | La API no devolvió ningún hallazgo. |
| El ítem ya no existe. | Se abrió `/admin/<pantalla>?editar=<id>` con un id que ya no está en la lista (por ejemplo, el ítem se borró). No se abre ningún diálogo. |

**Años de experiencia.** `yearsOfExperience` se carga a mano en **Portada**; la revisión solo avisa si contradice las fechas de las experiencias cargadas (fusiona los trabajos que se solapan y cuenta ambos meses extremos; admite redondear para arriba o para abajo). Un aviso con tus datos reales no es un error de la plataforma: si falta experiencia anterior, cargala; si no, ajustá el número. **El valor declarado no se modifica nunca.**

**Abrir.** Lleva a la pantalla del ítem y abre su diálogo de edición (`?editar=<id>`, que sale de la URL al abrirse): **Experiencias**, **Skills** (categoría o skill), **Formación** (formación o certificación) y **Proyectos** (proyecto o enlace). Para el perfil base y los idiomas abre **Portada**; para un perfil curado, su ficha. Los hallazgos de errores no bloquean nada: el panel no deja guardar un dato inválido, así que un error solo puede venir de afuera del panel.

**Misma revisión, sin base.** `npm run cv:lint` corre las mismas reglas sobre el archivo del seed (por defecto `docs/cv-data.json`; otro con `-- --file <ruta>`) y sale con **0** sin errores (los avisos y sugerencias no fallan), **1** con algún error y **2** si el archivo no existe o el seed lo rechaza. El CI lo corre sobre `docs/cv-data.json` y sobre el ejemplo.

![Revisión con un aviso y una sugerencia](manual/bo-revision.jpg)

---

### B17 — Integraciones

Ruta: `/admin/integraciones`. **No tiene ítem en la barra** del panel: se llega desde **Cuenta** (bloque **Integraciones**, enlace **Integraciones**) y, si hay una sincronización atrasada o un trabajo fallido, desde el aviso del **Dashboard** («Hay integraciones que requieren atención», con el enlace **Ver integraciones**). Muestra, por cada proveedor habilitado en el servidor (`INTEGRATIONS_ENABLED`), su estado, la última corrida, la última exitosa, la cola, el último error y el origen de la credencial. Hoy el único proveedor es `fake`, de prueba y prohibido en producción; los reales llegan con sus propios changes. **Sincronizar ahora solo encola:** el trabajo corre en el próximo minuto (el ejecutor mira la cola cada `INTEGRATIONS_TICK_SECONDS`, 60 por defecto) y nunca dentro de la petición, así que la pantalla responde al instante aunque el proveedor esté lento. Mientras haya trabajos pendientes o en curso, la pantalla se refresca sola cada 15 s.

| Estado | Qué significa |
|---|---|
| Activo | Se puede sincronizar. El planificador encola un trabajo por día (06:00 en Bolivia por defecto, `INTEGRATIONS_SYNC_CRON`, en UTC). |
| En pausa hasta {fecha} | El proveedor pidió esperar (límite de peticiones), se agotó su presupuesto o falló cinco veces seguidas (el circuito se abre). Se reanuda solo al vencer; la tarjeta dice el motivo. |
| Pausado | Lo pausaste vos con **Pausar**: no se encola ni se ejecuta nada hasta **Reanudar**. Un trabajo en curso termina. |
| Sin sincronizar hace más de 48 h | Insignia roja: pasaron más de 48 h sin una corrida exitosa. Un proveedor pausado a mano no se marca; uno pausado por el circuito, sí. |

| Campo de la tarjeta | Qué muestra |
|---|---|
| Última corrida | Resultado del último intento y su fecha: Exitosa, Con error (se reintenta), Fallida (no se reintenta), Interrumpida por un reinicio o Tiempo agotado; «En curso» si todavía no terminó. |
| Última exitosa | Fecha de la última corrida exitosa, o «Nunca». |
| Cola | Trabajos pendientes, en curso, con error (esperan su reintento) y fallidos (no se reintentan). |
| Credencial | De dónde sale el secreto: «Variable de entorno del servidor», «Guardada en la base (clave k1)» o «Falta la credencial» (con el campo a la vista). Nunca se muestra el valor. |
| Motivo de la pausa | Solo con una pausa vigente: el proveedor pidió esperar, límite agotado, presupuesto agotado o varios errores seguidos. |
| Último error fallido / Error de la última corrida | El mensaje del error, ya sin el token (se redacta antes de guardarlo). |

**Botones.** **Sincronizar ahora** encola un trabajo (deshabilitado con el proveedor pausado). **Pausar** y **Reanudar** cambian `enabled`: pausar impide encolar y ejecutar nuevos trabajos, pero no cancela uno en curso.

**Credencial.** Si el secreto no viene de una variable de entorno, la tarjeta ofrece el campo **Credencial** (de tipo contraseña, de 1 a 4096 caracteres, sin espacios al borde) con **Guardar** y, si ya hay una guardada, **Borrar** (con confirmación). Se guarda cifrada (AES-256-GCM, con la clave activa del keyring) y **no se vuelve a mostrar**: el campo nunca se rellena con el valor guardado y la API tampoco lo devuelve. Escribir una nueva reemplaza la anterior. La variable de entorno del proveedor (p. ej. `FAKE_PROVIDER_TOKEN`) es **opcional** y, si está definida, manda: no hay campo y la API responde 422 al `PUT`, para que no haya dos fuentes que diverjan. Sin variable ni credencial guardada la tarjeta dice «Falta la credencial» y un trabajo termina «Fallida» con «falta la credencial».

| Mensaje | Cuándo |
|---|---|
| Encolado: corre en el próximo minuto. | **Sincronizar ahora** creó un trabajo. |
| Ya había una sincronización en cola. | Ya había un trabajo pendiente, en curso o con error del proveedor: no se crea otro. |
| El scheduler está apagado en este servidor: lo que encoles queda en espera. | El servidor no tiene `INTEGRATIONS_SCHEDULER_ENABLED=true`: lo encolado espera a que algún proceso con el scheduler encendido (o `npm run integrations:sync`) lo tome. |
| No hay integraciones habilitadas. | `INTEGRATIONS_ENABLED` está vacía en el servidor. |
| Se activan con la variable INTEGRATIONS_ENABLED del servidor. | Segunda línea del mensaje anterior: los proveedores no se encienden desde el panel. |
| Sin sincronizar hace más de 48 h | Insignia de la tarjeta (`stale: true` en la API). |
| Ingresá la credencial. | **Guardar** con el campo vacío o con solo espacios. No se llama a la API. |
| La credencial no puede superar 4096 caracteres. | El valor tiene más de 4096 caracteres. No se llama a la API. |
| La credencial no puede empezar ni terminar con espacios. | El valor tiene espacios al borde (la API también los rechaza). |
| Hay integraciones que requieren atención | Aviso del **Dashboard**: algún proveedor está atrasado o tiene un trabajo fallido. |

**Fuera del panel.** `npm run integrations:sync [-- --provider <id>] [-- --plan]` corre el ejecutor **una** vez, sin abrir ningún puerto ni servicio aparte (sale con **0**, **1** si algún trabajo quedó fallido, **2** si la configuración es inválida o el arriendo lo tiene otra instancia). `npm run integrations:rekey` recifra las credenciales con la clave activa después de rotar el keyring (simulación por defecto; `-- --apply` escribe). Las variables y la rotación están en [`DEPLOY-RAILWAY.md`](DEPLOY-RAILWAY.md).

![Integraciones con el proveedor fake: última corrida exitosa y el campo Credencial](manual/bo-integraciones.jpg)

## 2. Casos de la vista pública

### TC-01 — La home resuelve el perfil completo ✅

**Precondición:** base de ejemplo, sitio levantado.
**Pasos:** abrir `http://localhost:5173/?lang=es`.
**Resultado esperado:** se renderiza el perfil `all` con el hero, el badge de disponibilidad, los datos de contacto y la fila de métricas. El título del documento es `Perfil Completo · <nombre>`.
**Verificado** (27 de octubre de 2026, base de ejemplo): 5 experiencias, 16 tecnologías, 2 certificaciones, 2 proyectos, 4 categorías con 16 skills y las 9 secciones.

![Home en español](manual/tc01-home-es.jpg)

### TC-02 — El idioma se negocia y se puede forzar ✅

**Pasos:**
1. Abrir `/` sin parámetros, con el navegador en inglés.
2. Abrir `/?lang=es`.

**Resultado esperado:** sin parámetro, el contenido sale en el idioma del `Accept-Language` (acá, inglés) y el selector marca **EN**. Con `?lang=es`, todo pasa a español, incluido el título del documento (`Full Profile` → `Perfil Completo`). Los datos no se duplican: es el mismo registro resuelto en otro idioma.

![Home en inglés](manual/tc02-home-en.jpg)

### TC-03 — Un perfil curado filtra el contenido ✅

**Pasos:** abrir `/ejemplo-backend?lang=es`.
**Resultado esperado:** el titular pasa a ser el del perfil (`Ingeniera Backend Java · Spring Boot · Microservicios`), se antepone la descripción del perfil al resumen general, y las métricas bajan respecto de la home porque el contenido está filtrado por `filterTags`.

![Perfil curado](manual/tc03-perfil-curado.jpg)

> **Cómo se comprueba el filtro sin mirar:** compará las métricas con las de TC-01. En `ejemplo-backend` (`filterTags`: `java`, `spring-boot`, `microservices`) se pasa de 5 experiencias y 16 tecnologías a 2 y 7.

### TC-04 — Tema y layout se cambian desde la URL ✅

**Pasos:** abrir `/ejemplo-backend?lang=es&theme=corporate&layout=sidebar`.
**Resultado esperado:** el preset `corporate` cambia la paleta completa en caliente, sin recargar ni reconstruir, y `sidebar` reorganiza la página en dos columnas con los datos fijos a la izquierda. Lo guardado en el perfil **no** se modifica: es una vista alternativa que se puede compartir.

![Tema corporate con layout sidebar](manual/tc04-tema-layout.jpg)

### TC-05 — El menú ofrece los demás perfiles, solo en la home ✅

**Pasos:** en la home (`/`), abrir el desplegable **Perfiles**. Después abrir un perfil por su link, por ejemplo `/ejemplo-backend`.
**Resultado esperado:** en la home, el menú lista los perfiles públicos, enumerados y no archivados, agrupados por `roleType` (en el ejemplo: Backend, Generalista, Fullstack; los perfiles protegido, privado, dirigido y archivado no se enumeran), cada uno con su `techFocus` debajo. En `/:slug` **no hay menú**: quien recibe un link no ve los otros perfiles hechos para otras vacantes.

![Menú de perfiles](manual/tc05-menu-perfiles.jpg)

*El desplegable abierto en la home, agrupado por tipo de rol, sobre la base de ejemplo. En `/ejemplo-backend` no hay botón **Perfiles**.*

> Desde el change `add-curated-profile-lifecycle` el menú solo se monta en la home. La captura del perfil sin menú está en `openspec/changes/archive/*-add-curated-profile-lifecycle/verification/05-perfil-sin-menu.png`.

### TC-06 — Un perfil protegido pide token ✅

**Precondición:** base de ejemplo: `ejemplo-protegido` (`visibility: PROTECTED`, token `ejemplo-token-2026`).
**Pasos:** abrir `/ejemplo-protegido` sin `?token=`.
**Resultado esperado:** la API responde **401** y la vista muestra el formulario de token, sin filtrar ningún dato del perfil.

![Formulario de token](manual/tc06-token-form.jpg)

### TC-07 — Con el token correcto, el perfil resuelve ✅

**Pasos:** escribir el token (`ejemplo-token-2026`) y pulsar **Acceder**.
**Resultado esperado:** el token pasa a la URL como `?token=`, la API responde 200 y el perfil se renderiza. El link con el token es compartible tal cual.

![Perfil protegido resuelto](manual/tc07-token-resuelto.jpg)

### TC-08 — Un slug inexistente o privado da 404 ✅

**Pasos:** abrir `/no-existe` y también `/ejemplo-borrador` (privado).
**Resultado esperado:** la API responde **404** y la vista muestra el 404 propio con el enlace al perfil completo. Un perfil `PRIVATE` responde exactamente igual: **a propósito**, para no confirmar que el slug existe.

![404](manual/tc08-404.jpg)

### TC-09 — La vista funciona en móvil ✅

**Pasos:** abrir `/ejemplo-backend` con el viewport en 390×844.
**Resultado esperado:** una sola columna, el menú colapsa en hamburguesa, los selectores de tema e idioma siguen accesibles y no hay scroll horizontal.

![Vista móvil](manual/tc09-movil.jpg)

### TC-10 — Los códigos de estado por visibilidad 🔍

**Pasos y resultado verificado:**

```bash
curl -s -o /dev/null -w '%{http_code}\n' $API/api/curated-profiles/ejemplo-protegido
# 401   ← PROTECTED sin token

curl -s -o /dev/null -w '%{http_code}\n' "$API/api/curated-profiles/ejemplo-protegido?token=ejemplo-token-2026"
# 200   ← PROTECTED con token

curl -s -o /dev/null -w '%{http_code}\n' $API/api/curated-profiles/no-existe
# 404   ← inexistente, y lo mismo devuelve un PRIVATE
```

El token también viaja en la cabecera `X-Access-Token`. En los logs el `?token=` sale **censurado**, y `Referrer-Policy: no-referrer` evita que se filtre al navegar a un enlace externo.

### TC-31 — Imprimir un perfil en una hoja 🔍

**Precondición:** base de ejemplo, sitio levantado, Chrome (y Firefox para el paso 6).
**Pasos:**
1. Abrir `/ejemplo-backend` y, **sin hacer scroll**, apretar **Ctrl+P**.
2. En el diálogo: papel **A4**, márgenes por defecto, **Encabezados y pies de página desactivados** y **Gráficos de fondo desactivados**.
3. Cerrar el diálogo y repetir con el botón **Imprimir / Guardar PDF** de la barra superior.
4. Repetir con `?lang=en`, con `?theme=modern-dark&layout=sidebar` y con papel **Letter**.
5. Guardar como PDF y abrirlo: los enlaces (email, LinkedIn, la URL del pie) son clicables.
6. Repetir el paso 2 en Firefox.

**Resultado esperado:** una sola hoja, con texto oscuro sobre blanco aunque el tema sea oscuro (también con *Gráficos de fondo* activado: la página sigue blanca), el nombre visible y el orden de secciones del perfil. Sin barra superior, selectores ni pie del sitio. Lo que no entró dice *"y N experiencias más"* (*"and N more roles"* en inglés) y el pie trae **Versión completa** con la URL del perfil, que no lleva `token`, `theme` ni `layout`. En la pantalla del token de un perfil `PROTECTED` el botón no aparece. Imprimir no hace ninguna petición ni suma una visita al perfil.

`print:check` automatiza esto en Chrome, sin el diálogo: genera el PDF de cada perfil público y de `all`, en `es` y `en`, en A4 y Letter, con el tema del perfil y con `?theme=modern-dark&layout=sidebar`, cuenta las páginas y mide el contraste. Sale con código 1 si algún caso pasa de una hoja o contrasta menos de 4,5:1.

Requiere `PRINT_CHECK_DISPOSABLE_DB=1`, que confirma que la API apunta a una base descartable: cada caso registra una visita y, contra una base real, ensucia la analítica; sin la variable el script sale con código 2. La API tiene que apuntar a una base descartable (p. ej. `portfolio_print_check`, con migraciones y seed).

```bash
cd frontend
npm run dev                       # y la API en el 3300
PRINT_CHECK_DISPOSABLE_DB=1 PRINT_CHECK_TOKENS=slug=token npm run print:check   # el token es opcional (perfiles PROTECTED)
```

**Verificado** (27 de octubre de 2026, base de ejemplo): 24 casos (6 perfiles × `es`/`en` × 2 temas) con una página en A4 y en Letter y un contraste mínimo de 9,7:1. Los pasos con el diálogo de impresión y Firefox son manuales.

![Hoja imprimible con print emulado](manual/tc31-imprimir.jpg)

*La hoja de `ejemplo-backend` con `print` emulado: una página, texto oscuro sobre blanco.*

### TC-32 — El nivel del idioma en los dos idiomas ✅

**Precondición:** base de ejemplo, sitio y API levantados, sesión iniciada en `/admin`.
**Pasos:**
1. `/admin/portada` → **Idiomas** → editar *Inglés*. El **Nivel** tiene pestañas ES/EN, como el detalle: el español es obligatorio y el inglés opcional. Un nivel legado (texto plano, p. ej. `C1`) se abre en ES con EN vacío.
2. En la pestaña EN escribir *B1-B2 (working proficiency)* y **Guardar**. Recargar y reabrir: ES y EN se conservan.
3. Abrir `/?lang=en`: el contacto dice *English · B1-B2 (working proficiency)*; con `?lang=es` dice el español. La vista de impresión (Ctrl+P o **Imprimir / Guardar PDF**) muestra lo mismo, porque lee el texto ya resuelto.
4. Vaciar el inglés del nivel y guardar. En el constructor (`/admin/perfiles/<id>` → **Publicación**), con la vista previa en EN, el aviso de faltantes dice *Idiomas — Inglés: Nivel*. Es solo un aviso: se puede guardar y publicar igual, y en inglés el nivel sale en español.

**Resultado esperado:** con la base de ejemplo, `/?lang=en` muestra *Spanish · Native*, *English · Advanced (C1)* y *Portuguese · Intermediate*, y `/?lang=es` muestra *Español · Nativo*, *Inglés · Avanzado (C1)* y *Portugués · Intermedio*. Con la vista previa de `ejemplo-borrador` en EN, el aviso dice *Falta 1 traducción en EN* (`Descripción` del perfil curado). Una base migrada desde la anterior queda igual (la migración `localize_language_level` convierte `Nativo` en `{ es: "Nativo", en: "Native" }`).

```bash
curl -s "$API/api/profile?lang=en" | jq '.languages[] | {name, level}'
curl -s "$API/api/curated-profiles/all?lang=es" | jq '.profile.languages[0].level'
curl -s $API/api/admin/languages -H "$AUTH" | jq '.[0].level'            # crudo: { es, en }
curl -s -X POST $API/api/admin/languages -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"name":"X","level":"B2"}'                                            # 400: level debe ser { es, en? }
```

**Ejecutado** (10 de octubre de 2026, con los datos del CV real de ese momento; no se repitió sobre el ejemplo, contra una copia de la base de desarrollo, `portfolio_levelfix`, con la API en el 3300 y el panel en el 5173; transcripción en el `verification.md` del change archivado [`2026-10-10-localize-language-level`](../openspec/changes/archive/2026-10-10-localize-language-level/verification.md)):

```
GET /api/curated-profiles/all?lang=en            -> languages[0] = Spanish · Native
GET /api/curated-profiles/all?lang=es            -> languages[0] = Español · Nativo
GET /api/curated-profiles/ejemplo-backend?lang=en -> Spanish · Native
POST /api/admin/languages  level: "B2"           -> 400 (level must be an object)
Portada: EN del nivel -> guardar -> recargar     -> ES="B1-B2" EN="B1-B2 (working proficiency)"
Constructor, vista previa en EN, nivel sin inglés -> "Falta 1 traducción en EN · Idiomas · Inglés: Nivel"
```

![Aviso de faltantes de traducción](manual/tc32-faltantes.jpg)

*La pestaña Publicación de `ejemplo-borrador` con la vista previa en EN: `Falta 1 traducción en EN`.*

### TC-33 — Navegación por teclado y foco visible ✅

**Precondición:** base de ejemplo, sitio levantado, Chrome; para los pasos 4 y 5, sesión iniciada en `/admin`.
**Pasos:**
1. Abrir `/ejemplo-backend` y, sin tocar el mouse, apretar **Tab**: lo primero que aparece es **Saltar al contenido** (*Skip to content* con `?lang=en`). Con **Enter** el foco pasa al contenido; el siguiente Tab cae en el primer control del hero, no en la barra superior.
2. Volver a empezar y recorrer con Tab la barra (marca, menú de perfiles, diseño, tema, idioma, imprimir) y el hero. Cada control muestra un contorno **sólido de 2 px**, separado del borde, del color de acento legible del tema. Repetir con `?theme=modern-light` y `?theme=modern-dark`.
3. En la home, abrir con **Enter** el menú de perfiles y el selector de tema (en móvil, el menú lateral): el foco entra, **Escape** cierra y el foco vuelve al botón.
4. En `/admin`: el primer Tab es **Saltar al contenido**; con Enter, el siguiente Tab entra al contenido de la pantalla y no al menú lateral. A 375 px, más adelante el Tab llega a la región «Visitas por día» (las barras): muestra el contorno de foco y las flechas la desplazan (TC-40).
5. En `/admin/experiencias` abrir **Nueva experiencia** con Enter y cerrar con **Escape**: el foco vuelve al botón. En `/admin/portada` cambiar un campo de ES a EN con las pestañas: el campo y su etiqueta siguen al idioma.
6. En Chrome → DevTools → *Rendering* → *Emulate CSS media feature prefers-reduced-motion: reduce*, activar el salto: el desplazamiento no es animado.

**Resultado esperado:** el foco nunca queda invisible ni se pierde (tampoco al cerrar un diálogo), y el salto lleva siempre al `<main>`. Con `prefers-reduced-motion: reduce` el documento tiene `scroll-behavior: auto`.

`a11y:check` automatiza los pasos 1 y 2 en la home y en dos perfiles (primer Tab en el salto, Enter enfoca `<main id="contenido">`, el contorno de cada control alcanzado con Tab mide ≥ 3:1 contra el fondo) y los pasos 4 y 5 en el panel; los menús y los diálogos se recorrieron con Chrome controlado por `puppeteer-core`.

**Ejecutado** (15 de octubre de 2026, con el CV real de ese momento; no se repitió sobre el ejemplo; contra la imagen de producción de `frontend/Dockerfile` y una base descartable):

```
Tab 1 en /ejemplo-backend            -> "Skip to content" / "Saltar al contenido"
Enter                                 -> document.activeElement = main#contenido
Menú de perfiles, tema, Sheet móvil   -> foco adentro; Escape devuelve el foco al botón
Nueva experiencia / categoría / proyecto + Escape -> el foco vuelve al botón (antes: <body>)
prefers-reduced-motion: reduce        -> scroll-behavior: auto
```

![Salto al contenido con el foco visible](manual/tc33-foco.jpg)

*Tras el primer **Tab**: **Saltar al contenido** con el foco visible.*

### TC-34 — Contraste con un acento oscuro ✅

**Precondición:** base de ejemplo, sitio levantado, sesión iniciada en `/admin` para el paso 4.
**Pasos:**
1. Abrir `/ejemplo-backend` (`themeOverrides.colors.accent = #1A365D`, 1,38:1 contra la tarjeta de `modern-dark`). El titular del hero, el *eyebrow* de cada sección y las etiquetas del menú se leen: tienen el **tono** del acento, más claro.
2. El botón *Contactar* conserva el relleno `#1A365D` con texto blanco. Repetir con `/ejemplo-secciones` (`#8a5a00` sobre el preset `elegant`, 2,60:1).
3. Abrir `/ejemplo-backend?theme=modern-light`: el botón primario lleva texto oscuro (4,70:1) y no blanco (4,10:1).
4. En `/admin/perfiles/<id>` → **Diseño**, elegir como acento `#1A365D`: en la vista previa se lee como texto. Guardar y reabrir: lo guardado es `#1A365D`, el color elegido, no el derivado.

**Resultado esperado:** ningún texto del sitio baja de 4,5:1 contra su fondo, con ningún preset ni con los acentos de los perfiles del ejemplo; el dato guardado no cambia. Medido sobre los tokens (`css-vars` y su spec) y sobre el sitio (axe, `a11y:check`):

| Acento | Como texto antes | `--t-accent-ink` | Como texto después |
|---|---|---|---|
| `#1A365D` (ejemplo-backend, `modern-dark`) | 1,38:1 | `#5588cf` | 4,65:1 |
| `#8a5a00` (ejemplo-secciones, `elegant`) | 2,60:1 | `#c78200` | 4,87:1 |
| `#38bdf8` (all, `modern-dark`) | 7,85:1 | `#38bdf8` | 7,85:1 (sin cambio) |
| `#0284c7` (preset `modern-light`) | 4,10:1 | `#0270a9` | 5,39:1 |
| `#00bc7d` (verde de la insignia «Actual», `modern-light`) | 2,06:1 | `#00754e` (`--t-success-ink`) | 4,80:1 |

Medido el 27 de octubre de 2026 en la base de ejemplo, contra el fondo de la tarjeta de cada tema.

El texto atenuado (`text-dim`) pasó de 3,5–4,0:1 a ≥ 4,5:1 en los cinco presets.

**Ejecutado** (15 de octubre de 2026, con el CV real de ese momento; no se repitió sobre el ejemplo): `a11y:check` sobre la home, cada preset × layout, `?lang=en`, los 13 perfiles con acento bajo y el panel: 0 violaciones en 72 cargas. Antes: 1376 nodos de `color-contrast` en las vistas de perfil y 420 en el panel.

![Perfil con el acento derivado legible](manual/tc34-acento.jpg)

*`ejemplo-backend` con el preset `modern-light`: el texto en acento se lee.*

### TC-35 — El perfil abre rápido en un móvil ✅

**Precondición:** base de ejemplo (descartable; nunca la del owner: cada carga registra una visita), la API en `NODE_ENV=production` y el frontend como se sirve en producción (la imagen de `frontend/Dockerfile`, o `dist/` con el `Caddyfile` del repo en `caddy:2-alpine`); Chrome. Para el paso 6, un perfil `PROTECTED` con su token.
**Pasos:**
1. En Chrome → DevTools → *Device toolbar* a **375 px** y *Performance* con CPU **4× slowdown**; abrir `/ejemplo-backend`. El **hero** (nombre, titular, resumen) aparece primero; las demás secciones llegan enseguida, sin que el contenido de arriba se mueva ni el pie salte a la vista.
2. En la pestaña *Network*, filtrar por `curated-profiles`: hay **una sola** petición de `GET /api/curated-profiles/ejemplo-backend?locale=es` (no dos), y sale del script `profile-prefetch.js` antes de que termine el bundle.
3. En la base descartable, `SELECT count(*) FROM "ProfileView"` antes y después de la carga: **+1**.
4. Cambiar de idioma con el selector `ES`/`EN`: las secciones no desaparecen ni parpadean; el texto se traduce en su lugar. Repetir con `?layout=sidebar`: no hay salto de diseño al aparecer las secciones.
5. Antes de que cargue el selector de tema (en *Network* → *Throttling* → *Slow 3G*, o bloqueando `ThemeSwitcher-*.js`), enfocar el botón de tema con **Tab** y apretar **Enter**: el menú abre en cuanto llega el módulo, con el foco adentro; **Escape** lo cierra y el foco vuelve al botón. Repetir con el menú de perfiles de la home (en 375 px, el menú lateral).
6. Abrir `/<perfil-protegido>?token=<token>&lang=en`: una sola petición del perfil, con la cabecera `X-Access-Token`, y +1 en `ProfileView`.

**Resultado esperado:** el hero se ve antes que el resto, el pie no salta (CLS ≤ 0,01), una sola petición del perfil y una sola visita por carga, y los menús abren con teclado aunque se activen al instante. La consola no muestra violaciones de CSP.

`perf:budget` fija lo ganado en el arranque (≤ 155 KB gzip en un solo JS de módulo) y `perf:check` mide el resultado en Lighthouse (Performance ≥ 85, mediana de 5, en el CI). Los pasos 1 a 3 y 6 los automatizan los scripts de la evidencia del change `improve-mobile-performance`, con Chrome controlado por `puppeteer-core`.

**Ejecutado** (15 de octubre de 2026, con el CV real de ese momento; no se repitió sobre el ejemplo; contra el `dist/` y el `Caddyfile` del repo en `caddy:2-alpine` y una base descartable): ver `verification.md` del change `improve-mobile-performance` (§ Recorrido en 375 px y § Una visita por carga).

![Hero en 390 px](manual/tc35-movil-hero.jpg)

*El hero en 390 px, primer tiempo de la carga.*

### TC-40 — Ítems ocultos e insignias legibles ✅

**Precondición:** base de ejemplo **descartable** (nunca la del owner), sitio levantado como en producción y sesión iniciada en `/admin`. El ejemplo trae 5 ítems ocultos (experiencias, formación, proyectos y enlaces), una experiencia actual en `ejemplo-backend` y 105 visitas repartidas en los últimos 30 días: son los datos que ejercitan este caso.
**Pasos:**
1. Abrir `/admin/experiencias`, `/admin/formacion` y `/admin/proyectos`. Cada ítem oculto muestra la insignia **Oculta**/**Oculto** (texto e ícono), un borde **punteado** y un fondo suave; su título, subtítulo y etiquetas se leen igual que los de un ítem visible (no están atenuados).
2. Abrir `/ejemplo-backend?theme=modern-light`, `?theme=minimal` y `?theme=corporate`, con `layout=classic` y `layout=sidebar`: la insignia **Actual** de la experiencia en curso se lee, en un verde más oscuro que el de `modern-dark`.
3. Abrir `/ejemplo-backend?theme=modern-dark`: la insignia conserva el verde `#00bc7d`.
4. A 375 px de ancho (DevTools → *Device toolbar*), abrir `/admin` y apretar **Tab** hasta llegar al gráfico de visitas por día: la región «Visitas por día» muestra el contorno de foco; con la flecha derecha se desplaza y deja ver los días del final.
5. Opcional: `A11Y_CHECK_DISPOSABLE_DB=1 A11Y_CHECK_PROFILE=ejemplo-backend A11Y_CHECK_ADMIN_EMAIL=… A11Y_CHECK_ADMIN_PASSWORD=… npm run a11y:check -- http://localhost:8080`. Sin `A11Y_CHECK_PROFILE`, contra el ejemplo, sale con código **2** y el aviso «El perfil base «tech-lead-dotnet» no existe en esta base».

**Resultado esperado:** ningún texto de las listas del panel ni de la insignia «Actual» baja de 4,5:1, con cualquier preset; un ítem oculto se distingue por la insignia, el borde y el fondo, nunca por la opacidad; las barras por día se alcanzan con el teclado. `a11y:check` con panel sale con 0 `serious` y 0 `critical` sobre el ejemplo y sobre `cv-data.json`. El verde de estado se deriva del tema y no se guarda:

| Preset | Verde `#00bc7d` como texto | `--t-success-ink` | Peor caso derivado |
|---|---|---|---|
| modern-dark | 5,31:1 | `#00bc7d` (sin cambio) | 5,31:1 |
| elegant | 4,91:1 | `#00bc7d` (sin cambio) | 4,91:1 |
| modern-light | 2,06:1 | `#00754e` | 4,80:1 |
| minimal | 2,15:1 | `#007a51` | 4,67:1 |
| corporate | 2,07:1 | `#00754e` | 4,80:1 |

**Ejecutado** (28 de octubre de 2026, contra la imagen de producción del frontend y bases descartables sembradas con `seed:example` y `seed`): `a11y:check` con panel sobre el ejemplo con `A11Y_CHECK_PROFILE=ejemplo-backend`, 50 cargas: **0** `serious`/`critical` y recorrido de teclado sin problemas (antes: 39 `color-contrast` + 1 `scrollable-region-focusable`); sobre `cv-data.json`, 72 cargas: 0. `print:check` en una hoja (20 casos, contraste mínimo 9,74:1). Detalle por página en `openspec/changes/fix-admin-contrast/verification/6.2-resumen.md`.

---

## 3. Casos del backoffice

### TC-11 — Entrar al panel ✅

**Pasos:** abrir `/admin`.
**Resultado esperado:** redirige a `/admin/login`. Tras entrar con credenciales válidas, se llega al Dashboard y se vuelve al destino original si se había pedido otra ruta.

![Login del backoffice](manual/tc11-login.jpg)

![Error de credenciales](manual/tc11-login-error.jpg)

*Con un email inexistente y una contraseña de relleno: `Email o contraseña incorrectos`.*

La sesión es una cookie **httpOnly**: el cliente nunca guarda el JWT y el estado se deriva de `GET /api/auth/me`. Al expirar (`JWT_EXPIRES_IN`, por defecto `1d`), el panel vuelve al login en la siguiente petición.

### TC-12 — Crear un perfil curado para una vacante ✅

**Precondición:** sesión iniciada.
**Pasos:**
1. `/admin/perfiles` → **Nuevo perfil**.
2. Pestaña **Identidad**: `slug` en kebab-case (es la URL, y se valida), `title`, `headline` (opcional: vacío usa el titular del perfil base) y `description` en ES y EN, `roleType` (agrupa el menú) y `techFocus`.
3. Guardar.

**Resultado esperado:** el perfil se crea y el constructor queda abierto sobre él. Un slug repetido devuelve **409**.

**Equivalente por API** 🔍:

```bash
curl -s -X POST $API/api/admin/curated-profiles -H "$AUTH" \
  -H 'Content-Type: application/json' -d '{
  "slug": "acme-tech-lead",
  "title":    { "es": "Tech Lead .NET", "en": "Tech Lead .NET" },
  "headline": { "es": "14 años construyendo y liderando equipos .NET",
                "en": "14 years building and leading .NET teams" },
  "roleType": { "es": "Tech Lead", "en": "Tech Lead" },
  "techFocus": ".NET",
  "visibility": "PRIVATE"
}' | jq '{id, slug, visibility}'
```

**Ejecutado el 5 de octubre de 2026:**

```
POST /api/admin/curated-profiles       -> 201  slug=suite-demo visibility=PRIVATE
  defaults: layout=classic views=0 filterTags=[]
POST con el mismo slug                 -> 409
POST con un campo fuera del DTO        -> 400
POST omitiendo "title" (obligatorio)   -> 500  ❌ antes del arreglo de D-02 — ver § 6.1
POST omitiendo "title" (obligatorio)   -> 400  ✅ después: "title should not be null or undefined"
POST con accentColor                   -> 400  campo retirado (retire-accent-color)
```

> **Recomendado:** crealo `PRIVATE` y pasalo a `PUBLIC` recién cuando esté listo (TC-16). Un `PRIVATE` devuelve 404, así que nadie lo encuentra mientras lo armás.

![Lista de perfiles curados](manual/tc12a-perfiles-lista.jpg)

*La lista muestra el slug, la visibilidad, la taxonomía y las visitas de cada perfil.*

![Pestaña Identidad del constructor](manual/tc12b-identidad.jpg)

*Pestaña Identidad, con la vista previa en vivo a la derecha: `2 experiencias · 3 categorías · 1 proyecto` ya filtradas (en `ejemplo-backend`).*

Los campos que no mandás toman su valor por defecto: `filterTags`, `includeIds`, `excludeIds`, `sectionsOrder` y `sectionsHidden` vacíos, `layout` en `classic`, `visibility` en `PUBLIC`.

> **Nota.** `accentColor` se retiró en el change `retire-accent-color`: ya no existe en la API y un cuerpo que lo traiga responde 400. El acento de un perfil es `themeOverrides.colors.accent` (TC-15).

### TC-13 — Elegir qué entra con tags y overrides ✅

Tres mecanismos, en este orden:

| Mecanismo | Efecto |
|---|---|
| `filterTags` | Entra el item que comparta **al menos un** tag. **Vacío = entra todo** |
| `includeIds` | Fuerza la inclusión. Solo funciona con items **visibles** |
| `excludeIds` | Fuerza la exclusión. **Siempre gana**, incluso sobre `includeIds` |

**Pasos:** pestaña **Selección** → los tags disponibles aparecen como chips (clic para activar o desactivar) y los bloques **Experiencias**, **Skills** y **Proyectos** tienen los botones *Incluir* y *Excluir* en cada fila (skills y proyectos, en TC-43). El preview de la derecha se recalcula con cada clic.

**Resultado esperado:** el preview refleja el filtro. Varios clics seguidos se acumulan: cada uno parte del estado anterior, no del render inicial. *Incluir* y *Excluir* de un mismo ítem no pueden quedar presionados a la vez: el segundo apaga al primero.

**Equivalente por API:**

```bash
ID=<id del perfil>
curl -s -X PATCH $API/api/admin/curated-profiles/$ID -H "$AUTH" \
  -H 'Content-Type: application/json' -d '{
  "filterTags": ["dotnet", "leadership"],
  "includeIds": ["<id de una experiencia que quiero sí o sí>"],
  "excludeIds": ["<id de algo que no aplica>"]
}' | jq '{filterTags, includeIds, excludeIds}'

# Ver los tags que existen:
curl -s $API/api/admin/experiences -H "$AUTH" | jq -r '[.[].tags[]] | unique | join(", ")'
```

**Ejecutado**, con dos experiencias de prueba que comparten el tag `suite-tag`, una visible y otra oculta:

```
filterTags vacío                          -> 16 experiencias (entra todo lo visible)
filterTags=[suite-tag]                    -> 1; la visible entró, la oculta no
includeIds sobre una experiencia oculta   -> no entró  (includeIds no fuerza invisibles)
mismo id en includeIds y excludeIds       -> no entró  (excludeIds siempre gana)
```

El orden de salida siempre es cronológico: `startDate` descendente, `order` ascendente como desempate. No se reordena item por item, a propósito: todos los perfiles cuentan la historia en el mismo sentido.

![Pestaña Selección](manual/tc13-seleccion.jpg)

*Los tags activos arriba y el universo de tags disponible debajo, sacado de los datos reales. La vista previa se recalcula con cada clic.*

### TC-43 — Ajustar skills y proyectos de un perfil ✅

**Precondición:** base de ejemplo, **descartable** (nunca `portfolio`: cada carga pública registra una visita), con la API y el frontend levantados (de preferencia la imagen de `frontend/Dockerfile`) y la sesión del panel iniciada en `/admin`.

**Pasos:**
1. `/admin/perfiles` → abrí **ejemplo-overrides** → pestaña **Selección**. Mirá los bloques **Experiencias**, **Skills** y **Proyectos** y el contador del preview.
2. En **Buscar skill** escribí `kot`. Después borrá el texto.
3. En **Kotlin** (categoría *Lenguajes*) pulsá **Excluir** para quitar la exclusión.
4. En **React** (categoría *Frontend*) pulsá **Incluir**.
5. En **Plataforma de Reservas** pulsá **Excluir**. Después pulsá **Incluir** en el mismo proyecto y otra vez **Incluir** para dejarlo sin override.
6. Volvé a pulsar **Excluir** en **Plataforma de Reservas**. Mirá la fila de **Prototipo en Pausa**.
7. Pulsá **Guardar**. En una **ventana privada**, abrí `/ejemplo-overrides` y mirá **Skills** y **Proyectos**.
8. Por la API, agregá un id inexistente a `excludeIds` del perfil (ver abajo) y recargá la ficha en el panel. Pulsá **Quitar** en el aviso y **Guardar**.

**Resultado esperado:**
1. **Kotlin** tiene **Excluir** presionado y el encabezado de *Lenguajes* indica «1 excluida». **Herramienta Interna de Métricas** tiene **Incluir** presionado. **Terracota Demo** y **Prototipo en Pausa** llevan la insignia **Oculta** u **Oculto**. El preview dice «2 experiencias · 3 categorías · 2 proyectos».
2. Con `kot` solo se ve *Lenguajes* con **Kotlin**; el preview no se recalcula. Al borrar el texto vuelven las cuatro categorías.
3. **Excluir** de Kotlin deja de estar presionado, el encabezado de *Lenguajes* ya no cuenta ninguna y Kotlin aparece en *Lenguajes* en el preview; el contador no cambia.
4. El preview pasa a «4 categorías» y muestra *Frontend* solo con React.
5. Con **Excluir**, el preview pasa a «1 proyectos» (el contador no pone el singular). Con **Incluir**, Excluir se apaga solo y vuelven los 2 proyectos. El segundo **Incluir** deja el proyecto sin override (sigue en el preview porque comparte tags).
6. El preview vuelve a «1 proyectos». **Prototipo en Pausa** tiene **Incluir** deshabilitado, con la descripción «Oculto: no entra aunque lo incluyas».
7. Se guarda sin errores. La vista pública muestra *Frontend* con React, *Lenguajes* con Kotlin y en **Proyectos** solo *Herramienta Interna de Métricas*. *Prototipo en Pausa* no aparece.
8. Al recargar, la pestaña dice «1 referencia a un ítem que ya no existe» y salir con **Volver** no pide confirmación. Después de **Quitar**, la ficha queda con cambios sin guardar; al guardar, `excludeIds` ya no tiene el id inexistente y conserva el de Plataforma de Reservas.

**Errores típicos:** buscar una categoría en **Buscar skill** (busca por nombre de skill, no de categoría). Esperar que **Incluir** reviva un ítem oculto: hay que marcarlo **Visible en el sitio** en su pantalla. Esperar que excluir una categoría entera exista: se excluyen sus skills una por una. Pulsar **Incluir** en un ítem excluido ya quita la exclusión: los dos botones no pueden quedar presionados a la vez.

**Por la API** (con la cookie de sesión de § 0; los ids salen de `GET /api/admin/skill-categories` y `GET /api/admin/projects`):

```text
PATCH /api/admin/curated-profiles/:id {"includeIds":["<id React>","<id Brújula>","<id Terracota>","<id Herramienta>"],
                                       "excludeIds":["<id Atlas>","<id Plataforma>","id-inexistente"]} -> 200
POST  /api/admin/curated-profiles/preview  (mismo borrador)  -> skillCategories con Frontend [React], projects sin Plataforma
GET   /api/curated-profiles/ejemplo-overrides               -> mismas experiences, skillCategories y projects que el preview
```

**Ejecutado** (29 de octubre de 2026, imagen de `frontend/Dockerfile` en `localhost:8096`, API local y la base descartable `portfolio_ovr_example`, sembrada con el ejemplo; Chrome no headless con la sesión del panel iniciada por `fetch('/api/auth/login')`, sin escribir la contraseña en un navegador, y un contexto sin sesión para el sitio; evidencia en `openspec/changes/add-builder-skill-project-overrides/verification/`): los pasos 1 a 8 dieron lo esperado con los contadores de arriba. El preview y la ruta pública devolvieron `experiences`, `skillCategories` y `projects` idénticos con el perfil guardado, y el `PATCH` llevó solo ids en `includeIds` y `excludeIds`. `a11y:check` con el panel dio 0 violaciones y axe sobre la pestaña **Selección** (escritorio y móvil) también; la consola, sin errores.

![Bloques Skills y Proyectos de ejemplo-overrides](manual/tc43-overrides.jpg)

*Kotlin excluida (y «1 excluida» en su categoría), la inclusión de Herramienta Interna de Métricas y el proyecto oculto con **Incluir** deshabilitado.*

### TC-14 — Ordenar y ocultar secciones ✅

Las diez secciones conocidas: `hero`, `stats`, `experience`, `skills`, `projects`, `repositories`, `education`, `certifications`, `presence`, `contact` (el caso se ejecutó cuando eran nueve; `repositories` se sumó con el change `add-featured-repositories`).

**Pasos:** pestaña **Diseño**, bloque *Secciones*: cada fila tiene un interruptor de visibilidad y las flechas **Subir** y **Bajar**.

**Resultado esperado:** el preview respeta el orden y el ocultado. Dos reglas que conviene conocer:

- Una sección **con datos** que no figure en `sectionsOrder` **se agrega al final**. Para ocultarla hay que ponerla en `sectionsHidden`.
- Una sección **sin datos** no se renderiza aunque esté en el orden.

![Pestaña Diseño con las secciones](manual/tc14-secciones.jpg)

*Las secciones de `ejemplo-secciones`, reordenadas, con **Estadísticas** y **Presencia** apagadas.*

```bash
curl -s -X PATCH $API/api/admin/curated-profiles/$ID -H "$AUTH" \
  -H 'Content-Type: application/json' -d '{
  "sectionsOrder": ["hero", "experience", "skills", "projects", "stats", "contact"],
  "sectionsHidden": ["education", "certifications"]
}' | jq '{sectionsOrder, sectionsHidden}'
```

**Ejecutado** sobre un borrador sin proyectos ni formación que pasen el filtro:

```
sectionsOrder=[hero,experience]                        -> sections=[hero,experience]
sectionsOrder=[hero,skills,experience,contact]
            + sectionsHidden=[skills]                  -> sections=[hero,experience,contact]
                                                          hiddenSections=[skills]
```

> **Desde el change `unify-section-catalog`** el catálogo es uno solo, con **9** secciones, y el **backend** aplica el relleno: `sections` trae además, al final y en orden canónico, las secciones con datos que no figuran en `sectionsOrder` ni están ocultas. Es el orden final que se renderiza. La transcripción de arriba es anterior al change y muestra `sections` sin ese relleno. Un id fuera del catálogo en `sectionsOrder` o `sectionsHidden` ahora responde 400.

### TC-15 — Personalizar el tema ✅

**Pasos:** pestaña **Diseño**, bloque *Tema*:

1. **Tema base** — uno de los cinco presets.
2. **Colores** — ocho controles: Fondo, Fondo suave, Tarjeta, Borde, Texto, Texto tenue, Acento y Acento 2.
3. **Densidad** — Compacta, Cómoda o Amplia.
4. **Restablecer** — vuelve al preset y descarta los ajustes.

> **Perfiles existentes.** Al retirarse `accentColor` (`retire-accent-color`), el color de cada perfil pasó a `themeOverrides.colors.accent`. Por eso el customizador muestra el **Acento** de esos perfiles como una diferencia respecto del preset, y **Restablecer** lo devuelve al del preset (`#38bdf8` en `modern-dark`). Varios de esos colores contrastan poco con el fondo oscuro: se corrigen desde este mismo control, perfil por perfil.

**Resultado esperado:** el preview cambia al instante, porque los tokens se aplican como variables CSS `--t-*` en el contenedor del preview, no en el documento. Y **solo se guardan las diferencias** contra el tema base, en `themeOverrides`: si mañana cambia el preset, el perfil hereda la mejora y conserva su ajuste.

```bash
curl -s $API/api/admin/themes -H "$AUTH" | jq -r '.[] | "\(.id)  \(.slug)"'

curl -s -X PATCH $API/api/admin/curated-profiles/$ID -H "$AUTH" \
  -H 'Content-Type: application/json' -d '{
  "themeId": "<id del tema base>",
  "themeOverrides": { "colors": { "accent": "#5B2C87" }, "density": "compact" }
}' | jq '{themeId, themeOverrides}'
```

**Ejecutado:**

```
GET /api/admin/themes  -> 5 temas: corporate, elegant, minimal, modern-dark, modern-light
PATCH themeOverrides   -> se guarda {"colors":{"accent":"#5B2C87"}}, solo la diferencia
```

![Customizador de tema](manual/tc15-tema.jpg)

*Tema base, los ocho colores con su valor hexadecimal, y **Restablecer** para volver al preset.*

### TC-16 — Publicar, proteger o esconder ✅

Un perfil tiene **tres ejes independientes**, y la pestaña **Publicación** los presenta por separado:

| Eje | Decide | Dónde se cambia |
|---|---|---|
| **Visibilidad** (`PUBLIC` / `PROTECTED` / `PRIVATE`) | **quién puede abrir** el perfil por su link | selector *Visibilidad* |
| **Enumeración** (`listed`) | **si se enumera** en el menú de la home, el listado público y el sitemap. No cambia el acceso | interruptor *Enumerar en la home y el sitemap* (TC-23) |
| **Archivado** (`archivedAt`) | **si sigue vivo**: archivado responde 404 siempre y gana sobre los otros dos | botón *Archivar* (TC-22) |

| Visibilidad | Sin token | Con token | En el sitemap |
|---|---|---|---|
| `PUBLIC` | 200 | — | **Sí**, si está enumerado |
| `PROTECTED` | **401** | 200 | No |
| `PRIVATE` | **404** | 404 | No |
| cualquiera, **archivado** | **404** | **404** | No |

**Pasos:** pestaña **Publicación** → selector *Visibilidad*. Al elegir `PROTECTED` aparece el campo del token, que pasa a ser obligatorio. El bloque del link ofrece copiarlo y abrirlo.

```bash
# Publicar
curl -s -X PATCH $API/api/admin/curated-profiles/$ID -H "$AUTH" \
  -H 'Content-Type: application/json' -d '{"visibility":"PUBLIC"}' | jq .visibility

# Proteger con token
curl -s -X PATCH $API/api/admin/curated-profiles/$ID -H "$AUTH" \
  -H 'Content-Type: application/json' \
  -d "{\"visibility\":\"PROTECTED\",\"accessToken\":\"$(openssl rand -hex 16)\"}" | jq '{visibility, accessToken}'
```

**Ejecutado**, recorriendo las tres visibilidades sobre el mismo perfil:

```
PUBLIC    sin token -> 200
PROTECTED sin token -> 401
PROTECTED con token -> 200
PRIVATE   sin token -> 404
PRIVATE   con token -> 404   (no revela que existe)
slug inexistente    -> 404   (indistinguible del PRIVATE)
el PRIVATE figura en el sitemap -> no
```

![Pestaña Publicación](manual/tc16-publicacion.jpg)

*Visibilidad, el link público con copiar y abrir, y el contador de visitas del perfil.*

Después de proteger algo, ejecutá TC-10: es la comprobación que importa.

### TC-17 — Previsualizar sin guardar 🔍

El preview **no lo calcula el navegador**: lo resuelve el backend con el mismo servicio que la ruta pública (`CuratedProfileComposer`), para que no puedan divergir. Lo que ves es lo que verá quien reciba el link.

```bash
curl -s -X POST $API/api/admin/curated-profiles/preview -H "$AUTH" \
  -H 'Content-Type: application/json' -d '{
  "title":    { "es": "Prueba", "en": "Test" },
  "headline": { "es": "Probando filtros", "en": "Testing filters" },
  "filterTags": ["dotnet"],
  "layout": "sidebar"
}' | jq '{experiencias: (.experiences|length), skills: (.skillCategories|length), secciones: .sections}'
```

No persiste nada. Sirve para tantear un filtro antes de tocar un perfil ya publicado.

**Idioma de la vista previa.** En el constructor, el conmutador **ES / EN** del panel de vista previa pide el preview en el otro idioma (`?locale=en`). Es estado de vista, no del perfil: no se guarda ni viaja en el guardado, y al recargar vuelve a español. Los dos idiomas conviven en caché, así que volver al anterior es instantáneo.

**Aviso de faltantes.** El preview devuelve además `missingTranslations`: los campos bilingües que están vacíos en el idioma pedido y caerían al español. La pestaña **Publicación**, junto al link público, lo muestra con el conteo y la lista agrupada por entidad (por ejemplo, «Acme Corp — Backend: Logros»); si no falta nada, lo dice en una línea («Sin faltantes de traducción en EN»). Es solo informativo: no impide guardar ni publicar, porque hay perfiles que se mandan solo en español. Un texto igual en los dos idiomas (`Tech Lead`, `.NET`) no cuenta como faltante. La ruta pública no trae este informe.

```bash
curl -s -X POST "$API/api/admin/curated-profiles/preview?locale=en" -H "$AUTH"   -H 'Content-Type: application/json' -d '{ "filterTags": ["dotnet"] }'   | jq '.missingTranslations'
```

> **Cuidado con los nombres:** lo que **mandás** usa `sectionsOrder` y `sectionsHidden`; lo que **vuelve resuelto** trae `sections` (ya ordenadas y filtradas) y `hiddenSections`. Es la diferencia entre la configuración y el resultado.

![Vista previa en inglés con un borrador sin guardar](manual/tc17-preview-en.jpg)

*La vista previa en EN de `ejemplo-backend` con el slug editado y sin guardar: es estado de vista, no se persiste.*

### TC-18 — Medir qué pasó con los links ✅

**Pasos:** `/admin` es el dashboard.

- **Rango:** 7, 30 (por defecto), 90 días o el último año.
- **Totales:** Visitas en el rango · Perfiles vistos · Idiomas.
- **Tablas:** por día, por perfil (con enlace al constructor y a la vista pública) y por idioma.

```bash
curl -s "$API/api/admin/analytics/views?from=2026-09-01&to=2026-10-04" -H "$AUTH" | jq '{
  total,
  porPerfil: [.byProfile[] | {slug, views}],
  porIdioma: .byLocale
}'
```

**Ejecutado.** Acá apareció el defecto D-01, ya corregido:

```
views del perfil antes                 -> 2
tras 2 visitas a la ruta pública       -> 4   ✅ el contador sube
tras un preview del panel              -> 4   ✅ el preview no cuenta como visita
GET analytics/views?from=hoy&to=hoy    -> total=0   ❌ antes del arreglo; debía ser 4
GET analytics/views?from=hoy&to=hoy    -> total=4   ✅ después del arreglo
```

El contador del perfil y el registro de `ProfileView` siempre funcionaron. Lo que fallaba era el **rango** del agregado: `to` era exclusivo y el dashboard pide `[hoy-29, hoy]`, así que las visitas de hoy no aparecían nunca. Ver § 6.1.

![Dashboard de analítica](manual/tc18-dashboard.jpg)

*Capturada el 29 de octubre de 2026 sobre la base de ejemplo, con sesión iniciada: 105 visitas en 30 días, en 5 perfiles y 2 idiomas (el archivado conserva las suyas). Las siete tablas: por día, por perfil, por idioma, por origen, por enlace, por portal y por tipo (las dos nuevas, con su estado vacío: el ejemplo no trae enlaces).*

De cada visita se guarda el perfil, el idioma, la fecha y la IP **solo como HMAC** con `ANALYTICS_SALT`. No hay cookies de seguimiento: la cookie de sesión del panel solo se lee para reconocer tus visitas y no se guarda. Las visitas se registran únicamente en la ruta pública, nunca en el preview, y si el registro falla la respuesta al visitante no se altera.

### TC-39 — Las visitas propias y de bots no suman ✅

**Precondición:** base de ejemplo, **descartable** (nunca `portfolio`: cada carga pública registra una visita), con la API y el frontend levantados y la sesión del panel iniciada en `/admin`. Para el paso 3, `$API` es la URL de la API.

**Pasos:**
1. Anotá el **Dashboard** (30 días): el total de *Personas* y las visitas de `ejemplo-backend` en `/admin/perfiles`.
2. Con la sesión del panel iniciada, abrí `/ejemplo-backend` (o pedí el perfil con la cookie de sesión).
3. Desde la terminal, sin sesión: `curl -s -o /dev/null -H "User-Agent: Mozilla/5.0 (compatible; Googlebot/2.1)" $API/api/curated-profiles/ejemplo-backend` y otra vez con `-H "User-Agent:"` (sin User-Agent).
4. En una **ventana privada**, abrí `/ejemplo-backend`.
5. Recargá el Dashboard y `/admin/perfiles`.

**Resultado esperado:**
1. En la base de ejemplo: *Personas* 105 (el total) y `ejemplo-backend` con 26 visitas.
2. La visita queda como *Tus visitas*: el total y las visitas del perfil **no cambian**.
3. Dos visitas de *Bots*: tampoco suman.
4. Esa visita sí suma: el total pasa a 106 y `ejemplo-backend` a 27.
5. **Por tipo** muestra *Personas*, *Tus visitas* y *Bots* en ese orden, y la columna de visitas de cada perfil coincide con las de personas de **Por perfil**.

**Errores típicos:** Si abrís tu sitio sin la sesión del panel (otro dispositivo, una ventana privada, una sesión vencida), la visita cuenta como una persona más. Un bot que se hace pasar por un navegador común también cuenta como persona: se reconoce por su User-Agent, no por su comportamiento. Las visitas de los scripts de calidad (`print:check`, `a11y:check`, `perf:check`, `manual:capture`) quedan como *Bots*.

**Ejecutado** (28 de octubre de 2026, base de ejemplo descartable, API local; la sesión se inició por `POST /api/auth/login` y se reusó su cookie, sin escribir la contraseña en un navegador; evidencia en `openspec/changes/classify-profile-views/verification/`):

```text
base de ejemplo (antes)              -> Personas 105 · Tus visitas 0
perfil con la cookie de sesión (x2)  -> filas OWNER, views del perfil igual
Googlebot y sin User-Agent           -> filas BOT, views igual
navegador sin sesión (ejemplo-backend)-> fila HUMAN, views 26 -> 27
GET analytics/views                  -> total 106 · byKind HUMAN 106, OWNER 2, BOT (las 2 del paso 3)
views de cada perfil                 -> igual a sus filas HUMAN
```

Sin captura propia: el Dashboard con la tabla **Por tipo** es la de TC-18. Los e2e `view-kind.e2e-spec.ts` cubren la cookie, el `Authorization: Bearer`, la cookie vencida o forjada, Googlebot, HeadlessChrome y la ausencia de User-Agent.

### TC-41 — Compartir un perfil con un enlace de seguimiento ✅

**Precondición:** base de ejemplo, **descartable** (nunca `portfolio`: cada carga pública registra una visita), con la API y el frontend levantados (de preferencia la imagen de `frontend/Dockerfile`), la sesión del panel iniciada en `/admin` y un perfil `Público` guardado (`ejemplo-backend`).

**Pasos:**
1. `/admin/perfiles` → `ejemplo-backend` → pestaña **Publicación**. En **Enlaces de seguimiento**, escribí la etiqueta `Cobalto — Laura, RR. HH.`, el portal `linkedin` y **Crear enlace**.
2. En la fila nueva pulsá **Copiar link**. El portapapeles queda con `https://<tu-sitio>/ejemplo-backend?via=<código>` (10 caracteres).
3. En una **ventana privada** (sin la sesión del panel), pegá el link y abrilo. Recargá la pestaña **Publicación**: el enlace muestra **1 apertura**.
4. Abrí también `/ejemplo-backend?src=indeed` en la ventana privada. En **Publicación**, **Link genérico por portal** → `indeed` → **Copiar link por portal** da esa misma URL sin crear ningún enlace.
5. `/admin` → **Por enlace** y **Por portal**: el enlace con su apertura y los portales `linkedin` e `indeed`.
6. Volvé a **Publicación** → **Revocar** en la fila → confirmá. El enlace queda `Revocado`, sin **Copiar link**, con sus aperturas.
7. Abrí otra vez el link con el código revocado en la ventana privada: el perfil se ve igual. Las aperturas del enlace no cambian y la visita queda en **Sin enlace**.
8. Con el perfil `Público`, **Compartir en LinkedIn**: se abre una pestaña en la página de compartir de LinkedIn con la URL del perfil y un `?via=` propio; no se publica nada.

**Resultado esperado:**
1. El enlace aparece con 0 aperturas, el portal `linkedin` y el estado `Activo`.
2. La URL lleva `via=` y, en un perfil protegido, `token=` antes.
3. 1 apertura. Las tuyas (con la sesión del panel) y las de bots no cuentan.
4. `?src=indeed` suma al portal `indeed` sin tocar ningún enlace; la URL copiada es `…/ejemplo-backend?src=indeed`.
5. **Por enlace**: `Cobalto — Laura, RR. HH.` con 1 y **Sin enlace** con el resto; **Por portal**: `linkedin` 1 e `indeed` 1.
6. La revocación no se deshace; para otro envío se crea un enlace nuevo.
7. El link no deja de funcionar: revocar deja de atribuir, no corta el acceso (para cortarlo, `Privado`, `Protegido` o archivar).
8. La pestaña pide `https://www.linkedin.com/sharing/share-offsite/?url=…` con el `?via=` de un enlace `LINKEDIN_POST` que se reusa mientras esté activo.

**Errores típicos:** **Por origen** sigue diciendo `directo`: el sitio no reenvía el origen (ver C8); la atribución viaja en el link, no en el referrer. Si el destinatario reenvía el link, esas visitas también se atribuyen a su enlace. Un código copiado a medias o de otro perfil no atribuye y no da error. En un perfil protegido, un `via` válido **no** reemplaza al token. **Compartir en LinkedIn** está deshabilitado en un perfil protegido, privado, archivado o sin guardar.

**Ejecutado** (29 de octubre de 2026, imagen de `frontend/Dockerfile` en `localhost:8093`, API local y la base descartable `portfolio_share_check`, sembrada con el CV; Chrome no headless con un contexto sin sesión para las visitas y la sesión del panel iniciada por `fetch('/api/auth/login')`, sin escribir la contraseña en un navegador; evidencia en `openspec/changes/add-share-links/verification/`):

```text
Crear desde Publicación          -> código de 10 caracteres, portal linkedin, 0 aperturas
?via=<código>                    -> 1 petición del perfil (con via) · +1 ProfileView · shareLinkId del enlace · source linkedin
?src=indeed                      -> 1 petición del perfil (con src) · +1 ProfileView · shareLinkId nulo · source indeed
?via=<código>&src=indeed&lang=en -> 1 petición del perfil · +1 ProfileView · shareLinkId del enlace · source linkedin (gana el portal del enlace)
Revocar (diálogo)                -> revokedAt fijado · aperturas 2
?via=<código revocado>           -> perfil igual · +1 ProfileView sin enlace ni portal · aperturas siguen en 2
Compartir en LinkedIn (x2)       -> share-offsite?url=…?via=<código LINKEDIN_POST> · el segundo clic reusa el mismo enlace
GET /profile-prefetch.js         -> Cache-Control: no-cache
HTML de /<slug>?via=…            -> canonical y og:url sin query · mismo head que sin código
```

![Enlaces de seguimiento en Publicación](manual/tc41-enlaces.jpg)

*Capturada sobre la base de ejemplo con `manual:capture`, que crea ese enlace por la API del panel. El Dashboard con **Por enlace** y **Por portal** es la captura de TC-18.* Los e2e `share-links.e2e-spec.ts` y `share-links-admin.e2e-spec.ts` cubren el código activo, revocado, de otro perfil, inexistente y mal formado, `?src=`, el perfil protegido, el slug anterior, el agregado y el ciclo de vida.

### TC-19 — Mantener las experiencias ✅

**Pasos:** `/admin/experiencias` → **Nueva experiencia**.

| Campo | Notas |
|---|---|
| Empresa * | plano, no se traduce |
| Ubicación * | plano |
| Rol, resumen, logros | **bilingües**, con pestañas ES y EN |
| Inicio * / Fin | si marcás *Actual*, Fin queda vacío |
| Orden | desempate cuando dos comparten `startDate` |
| Tecnologías, tags, sector | listas de chips. **Los tags son los que usa `filterTags`** |
| Visible en el portafolio | si lo apagás, no aparece en ningún perfil, ni forzándolo con `includeIds` |

```bash
curl -s -X POST $API/api/admin/experiences -H "$AUTH" \
  -H 'Content-Type: application/json' -d '{
  "company": "Acme",
  "location": "Santa Cruz, Bolivia",
  "role": { "es": "Tech Lead", "en": "Tech Lead" },
  "startDate": "2024-01",
  "current": true,
  "technologies": [".NET", "Azure"],
  "tags": ["dotnet", "leadership"],
  "visible": true
}' | jq '{id, company}'
```

**Ejecutado:**

```
POST experiencia visible                       -> 201, tags=[suite-tag]
POST experiencia oculta (visible:false)        -> 201
GET /api/experiences (público) la oculta       -> no aparece
GET /api/admin/experiences la oculta           -> sí aparece, con visible=false
POST omitiendo "summary" (obligatorio)         -> 500  ❌ antes del arreglo de D-02 — ver § 6.1
POST omitiendo "summary" (obligatorio)         -> 400  ✅ después: "summary should not be null or undefined"
```

> Un tag nuevo aparece solo como chip en el constructor de **todos** los perfiles: es la forma más rápida de abrir una dimensión de filtrado nueva.
>
![Lista de experiencias](manual/tc19a-experiencias.jpg)

*Cada fila con su empresa, periodo, tags y orden.*

![Formulario de experiencia](manual/tc19b-formulario.jpg)

*Los campos bilingües llevan su conmutador ES/EN; **Logros (es)** y **Logros (en)** son dos listas, y el inglés es opcional.*


### TC-20 — Mantener skills y categorías ✅

**Pasos:** `/admin/skills`. Las skills viven dentro de categorías.

1. **Nueva categoría** — nombre bilingüe y orden.
2. Dentro de cada una, **Nueva skill** — nombre, tags, orden.
3. Una skill se mueve de categoría editando su campo de categoría.
4. Borrar una categoría **borra sus skills**; el panel lo confirma antes.

```bash
CAT=$(curl -s -X POST $API/api/admin/skill-categories -H "$AUTH" \
  -H 'Content-Type: application/json' \
  -d '{"name":{"es":"Plataforma","en":"Platform"},"order":5}' | jq -r .id)

curl -s -X POST $API/api/admin/skill-categories/$CAT/skills -H "$AUTH" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Railway","tags":["devops","cloud"],"order":1}' | jq '{id, name}'
```

**Ejecutado:**

```
POST categoría "Suite Cat"                          -> 201
POST skill "SuiteSkill" con tags=[suite-tag]        -> 201
preview con filterTags=[suite-tag]                  -> la categoría entra por el tag de su skill
DELETE de la categoría                              -> se lleva sus skills
```

![Skills por categoría](manual/tc20-skills.jpg)

*Las skills viven dentro de categorías, y cada una lleva los tags que deciden en qué perfiles aparece.*

Una categoría entra en un perfil curado si **alguna de sus skills** comparte un tag con `filterTags`; dentro, se muestran solo las skills que pasan el filtro.

---

### TC-21 — Duplicar un perfil para otra vacante 🔍

**Pasos:** `/admin/perfiles` → botón **Duplicar** de un perfil → confirmar.

**Resultado esperado:** se crea una copia con toda la configuración (tags, inclusiones, exclusiones, secciones, tema y layout) y el constructor se abre sobre ella. La copia nace **privada y no enumerada**, sin token, sin visitas y sin archivar, con el slug del original más el primer sufijo libre (`-2`, `-3`, …). Así una copia a medio configurar nunca queda accesible. Para publicarla alcanza con cambiar slug, título, titular y visibilidad.

```bash
curl -s -X POST $API/api/admin/curated-profiles/$ID/duplicate -H "$AUTH" \
  | jq '{slug, visibility, listed, accessToken, views}'
```

**Ejecutado** (27 de octubre de 2026, base de ejemplo, por API): duplicar `ejemplo-backend` dio `ejemplo-backend-2` (201), `PRIVATE`, no enumerado, sin token y con 0 visitas; publicado como `ejemplo-vacante` cambiando slug, título, `filterTags`, tema y secciones y pasándolo a `PUBLIC`, respondió 200 con su contenido filtrado. El original quedó intacto. Transcripción en `openspec/changes/add-learning-guide-and-example-data/verification/5.3-recorridos.md`.

![Diálogo Duplicar perfil curado](manual/tc21-duplicar.jpg)

*El diálogo de **Duplicar**: la copia nace privada y sin enumerar.*

### TC-22 — Retirar un perfil sin perder sus visitas 🔍

**Pasos:** pestaña **Publicación** → **Archivar** → confirmar. Para volver atrás, **Desarchivar**.

**Resultado esperado:** el link responde **404**, igual que un slug que nunca existió, incluso si es `PROTECTED` y se presenta el token. El perfil sale del listado, del menú y del sitemap, pero **conserva sus visitas**, que siguen en el dashboard marcadas como *archivado*. Archivar dos veces conserva la primera fecha. Mientras está archivado no se registran visitas nuevas.

```bash
curl -s -X POST $API/api/admin/curated-profiles/$ID/archive -H "$AUTH" | jq .archivedAt
curl -s -o /dev/null -w '%{http_code}\n' $API/api/curated-profiles/acme-tech-lead   # 404
curl -s -X POST $API/api/admin/curated-profiles/$ID/unarchive -H "$AUTH" | jq .archivedAt   # null
```

> **Archivar en lugar de borrar.** Borrar se lleva las visitas con el perfil. Archivar lo retira conservándolas, y se puede deshacer. `archivedAt` no se escribe por `PATCH`: un `PATCH` con ese campo da 400.

**Ejecutado** (27 de octubre de 2026, base de ejemplo, por API): archivada la copia `ejemplo-vacante` el link dio 404; archivar dos veces conservó la primera fecha; `PATCH` con `archivedAt` dio 400; *Desarchivar* la devolvió a 200. `ejemplo-archivado` responde 404 y conserva sus 14 visitas en la analítica.

![Publicación de un perfil archivado](manual/tc22-archivado.jpg)

*La pestaña Publicación de `ejemplo-archivado`: el link avisa que no resuelve.*

### TC-23 — Un link dirigido que no aparece en ningún listado 🔍

**Pasos:** pestaña **Publicación** → apagar **Enumerar en la home y el sitemap** → Guardar.

**Resultado esperado:** el perfil sigue abriendo por su link (200 si es `PUBLIC`; 401 sin token y 200 con token si es `PROTECTED`), pero no figura en `GET /api/curated-profiles`, en el menú de la home ni en el `sitemap.xml`. Es la forma de mandar un perfil a una sola empresa sin que quede expuesto.

```bash
curl -s -X PATCH $API/api/admin/curated-profiles/$ID -H "$AUTH" \
  -H 'Content-Type: application/json' -d '{"listed":false}' | jq .listed
```

> Los perfiles del seed nacen enumerados, salvo los que el ejemplo marca a propósito (`ejemplo-dirigido` y `ejemplo-protegido`): dejarlos de enumerar los retiraría de los buscadores. Es una decisión perfil por perfil, desde el panel.
>
> **Ejecutado** (27 de octubre de 2026, base de ejemplo): `ejemplo-dirigido` responde 200 por su link y no figura en `GET /api/curated-profiles` ni en `/sitemap.xml`. Una copia pasada a `listed: false` siguió abriendo y salió del listado.

![Publicación de un perfil no enumerado](manual/tc23-dirigido.jpg)

*La pestaña Publicación de `ejemplo-dirigido`, con **Enumerar** apagado y su link.*

### TC-24 — Renombrar un slug sin romper los links ya enviados 🔍

**Pasos:** pestaña **Identidad** → cambiar el **Slug** → Guardar.

**Resultado esperado:** el slug anterior **sigue funcionando**. Responde el mismo perfil con su slug canónico en el cuerpo y en la cabecera `Content-Location`, y el navegador corrige la URL solo. El sitemap y el `canonical` usan únicamente el slug nuevo. Un slug que es el anterior de otro perfil no se puede tomar (409). Volver al slug anterior borra ese alias. El alias de un perfil archivado también da 404.

```bash
curl -s -D - -o /dev/null $API/api/curated-profiles/el-slug-viejo | grep -i content-location
```

**Ejecutado** (27 de octubre de 2026, base de ejemplo): `/ejemplo-nombre-anterior` responde 200 con el perfil `ejemplo-renombrado` y `Content-Location: /api/curated-profiles/ejemplo-renombrado`. Renombrar la copia `ejemplo-backend-2` a `ejemplo-vacante` dejó el anterior funcionando. Tomar `ejemplo-nombre-anterior` para otro perfil dio **409**.

![Perfil renombrado resolviendo desde el slug anterior](manual/tc24-alias.jpg)

*`/ejemplo-nombre-anterior` abre el perfil `ejemplo-renombrado`.*

### TC-45 — Cambiar la contraseña del panel 🔍

**Precondición:** base de ejemplo **descartable** (nunca `portfolio`), con la API y el frontend levantados (de preferencia la imagen de `frontend/Dockerfile`). Un administrador de prueba creado con `npm run admin:bootstrap` y una contraseña aleatoria que solo vive en la terminal y en el gestor de contraseñas, y una segunda contraseña aleatoria para el cambio.

**Pasos (panel):**
1. En Chrome, entrá a `/admin` (sesión A). En una **ventana privada**, entrá también (sesión B).
2. En A, pulsá **Cuenta** en la barra superior.
3. En **Nueva contraseña** escribí 11 caracteres y pasá al campo siguiente.
4. Escribí una nueva válida y, en **Repetí la nueva contraseña**, otra distinta. Pulsá **Cambiar contraseña**.
5. Escribí una **Contraseña actual** incorrecta, la nueva y su repetición iguales, y pulsá **Cambiar contraseña**.
6. Corregí la **Contraseña actual** y pulsá **Cambiar contraseña**.
7. En B, abrí **Experiencias**.
8. En B, entrá con la contraseña anterior; después, con la nueva.
9. En A, recargá la página.

**Resultado esperado:**
1. Las dos sesiones llegan al Dashboard.
2. Se abre `/admin/cuenta` con el nombre y el email del administrador y el formulario **Cambiar contraseña**.
3. Se ve «Usá al menos 12 caracteres».
4. Se ve «Las contraseñas no coinciden» y no sale ninguna petición (pestaña Red).
5. Se ve «La contraseña actual no es correcta» y se sigue en Cuenta.
6. Aparece «Contraseña actualizada. Se cerraron las sesiones de otros dispositivos.» y los tres campos quedan vacíos.
7. B vuelve a `/admin/login`.
8. Con la anterior, «Email o contraseña incorrectos»; con la nueva, B entra al Dashboard.
9. A sigue en el panel sin pasar por el login.

**Errores típicos:** «La contraseña actual no es correcta» después de varios intentos puede pasar a «Demasiados intentos. Probá de nuevo en unos minutos.» (5 por minuto e IP, como el login). Los `curl` con un `TOKEN` sacado antes del cambio dan 401: volvé a hacer el login de § 0. Si perdiste la contraseña, la recuperación es `npm run admin:bootstrap` desde la terminal (también cierra todas las sesiones).

**Por la API** (Bash; las contraseñas en variables de la terminal, los cuerpos armados con `node` para no escribirlas en la línea de comandos):

```bash
API=http://localhost:3300
EMAIL=capture@example.com              # el del administrador de prueba
# OLD_PW y NEW_PW ya definidas en esta terminal, sin imprimirlas
login() { node -e "process.stdout.write(JSON.stringify({email:process.env.EMAIL,password:process.env[process.argv[1]]}))" "$1" \
  | curl -s -o /dev/null -w '%{http_code}\n' -c "$2" -H 'Content-Type: application/json' --data @- $API/api/auth/login; }
export EMAIL OLD_PW NEW_PW

login OLD_PW a.jar                                   # 200  sesión A
login OLD_PW b.jar                                   # 200  sesión B
cp a.jar a-vieja.jar

node -e "process.stdout.write(JSON.stringify({currentPassword:'incorrecta-de-prueba',newPassword:process.env.NEW_PW}))" \
  | curl -s -o /dev/null -w '%{http_code}\n' -b a.jar -H 'Content-Type: application/json' --data @- $API/api/auth/password   # 401
node -e "process.stdout.write(JSON.stringify({currentPassword:process.env.OLD_PW,newPassword:'corta'}))" \
  | curl -s -o /dev/null -w '%{http_code}\n' -b a.jar -H 'Content-Type: application/json' --data @- $API/api/auth/password   # 400
node -e "process.stdout.write(JSON.stringify({currentPassword:process.env.OLD_PW,newPassword:process.env.NEW_PW}))" \
  | curl -s -o /dev/null -w '%{http_code}\n' -b a.jar -c a.jar -H 'Content-Type: application/json' --data @- $API/api/auth/password  # 200

curl -s -o /dev/null -w '%{http_code}\n' -b a.jar        $API/api/auth/me   # 200  cookie nueva de A
curl -s -o /dev/null -w '%{http_code}\n' -b a-vieja.jar  $API/api/auth/me   # 401  cookie anterior de A
curl -s -o /dev/null -w '%{http_code}\n' -b b.jar        $API/api/auth/me   # 401  sesión B
login OLD_PW c.jar                                   # 401
login NEW_PW c.jar                                   # 200
rm -f a.jar a-vieja.jar b.jar c.jar
```

**Ejecutado** (5 de noviembre de 2026, imagen de `frontend/Dockerfile` en `localhost:8099`, API de la rama en `localhost:3345` y la base descartable `portfolio_pwd_example`, sembrada con el ejemplo): el bloque **Por la API** dio exactamente los códigos esperados (200, 200, 401 sin `Set-Cookie`, 400, 400, 401 sin sesión, 200 con `Set-Cookie` `HttpOnly`; `/me` 200 con la cookie nueva, 401 con la anterior y con la de B; login 401 con la contraseña anterior y 200 con la nueva). Además: el sexto intento de cambio en un minuto dio 429 con `Retry-After`, con el login todavía disponible; `npm run admin:bootstrap` cerró la sesión abierta (`sessionVersion` +1) y permitió entrar con la contraseña nueva; en Chrome, con la sesión abierta en `/admin/experiencias` y la versión incrementada desde otro cliente, pulsar **Skills** devolvió al login; y los logs de la API y del contenedor `web` tienen 0 apariciones de las contraseñas. Los pasos 3 a 6 y 8 del panel, que piden escribir contraseñas reales en el navegador, **no se ejecutaron a mano**: las reglas del formulario y sus mensajes los cubren los tests del frontend y la captura de abajo, hecha con valores de relleno. Por eso el caso queda en 🔍. `a11y:check` con panel (52 cargas, incluida **Cuenta**) y axe con los errores de validación a la vista: 0 violaciones. Evidencia: `openspec/changes/add-admin-password-change/verification/8.2-tc45.txt`.

![Cuenta con el aviso de repetición distinta](manual/bo-cuenta.jpg)

### TC-46 — Registrar una postulación y ver si abrieron el enlace ✅

**Precondición:** base de ejemplo **descartable** (nunca `portfolio`), con la API y el frontend levantados (de preferencia la imagen de `frontend/Dockerfile`) y sesión en el panel. Sin postulaciones cargadas (si corriste `manual:capture` hay tres de ejemplo: el paso 1 mostrará la lista con ellas y el filtro **Activas**). El perfil `ejemplo-backend` tiene un enlace de seguimiento `MANUAL` activo (creálo en **Perfiles → ejemplo-backend → Publicación** con la etiqueta «Globex — RR. HH.» si no existe).

**Pasos (panel):**
1. Pulsá **Postulaciones** en la navegación.
2. Pulsá **Nueva postulación**, escribí `globex.example` en **URL de la vacante** y pulsá **Guardar** sin completar nada más.
3. Completá **Empresa** `Globex`, **Puesto** `Backend Senior`, **URL de la vacante** `https://globex.example/jobs/1`, **Estado** *Postulada*, **Perfil** `ejemplo-backend` y **Enlace** «Globex — RR. HH.». Pulsá **Guardar**.
4. En una **ventana privada** (sin sesión), abrí el link del enlace (`/ejemplo-backend?via=<código>`, copiálo desde **Publicación**). Volvé al panel y recargá **Postulaciones**.
5. Editá la postulación y abrí el selector **Estado**.
6. Elegí *En entrevistas* y guardá. Después elegí el filtro **Estado → En entrevistas** y recargá la página.
7. Pulsá **Exportar CSV** y abrí el archivo en una planilla.
8. Volvé al **Dashboard**.
9. Borrá la postulación y confirmá.

**Resultado esperado:**
1. Se abre `/admin/postulaciones` con el filtro **Activas** y, sin datos, «No hay postulaciones con este estado».
2. Se ven «Escribí la empresa», «Escribí el puesto» y «Usá una URL que empiece con http:// o https://», y no sale ninguna petición (pestaña Red).
3. Aparece «Postulación creada»; la fila muestra Globex, Backend Senior, *Postulada*, `ejemplo-backend`, «Sin abrir» y la fecha de hoy.
4. La fila pasa a «Abierto el <fecha de hoy>».
5. El selector ofrece solo *Postulada*, *En entrevistas*, *Oferta*, *Rechazada* y *Retirada*.
6. Aparece «Postulación actualizada»; la URL lleva `?estado=interviewing` y tras recargar el filtro sigue elegido y la fila sigue en la lista.
7. Se descarga `postulaciones-<fecha>.csv`; la planilla muestra las columnas Empresa, Puesto, Estado, …, Abierto el, Aperturas, Notas, Creada y Actualizada, con los acentos bien, y la fila de Globex con «En entrevistas».
8. La franja dice «Postulaciones activas: 1 · 1 en entrevistas» con el enlace **Ver postulaciones**.
9. Aparece «Postulación borrada» y la lista vuelve al estado vacío.

**Errores típicos:** «Ese enlace ya está asociado a otra postulación.»: el enlace ya está en otra fila; creá otro en **Publicación**. «Ese cambio de estado no está permitido. Elegí uno de la lista.»: otra pestaña cambió el estado antes; recargá. Si la visita del paso 4 no aparece, la abriste con la sesión del panel (cuenta como tuya, no como persona) o el enlace es `LINKEDIN_POST`. Si Excel muestra todo en una columna, importá con *Datos → Desde texto/CSV*, origen UTF-8 y delimitador coma.

**Por la API** (Bash; con la cookie de sesión de § 0 del manual en `s.jar`):

```bash
API=http://localhost:3300
PROFILE_ID=<id de ejemplo-backend>   # GET /api/admin/curated-profiles
LINK_ID=<id del enlace MANUAL>       # GET /api/admin/curated-profiles/$PROFILE_ID/share-links

curl -s -o /dev/null -w '%{http_code}\n' $API/api/admin/applications                       # 401  sin sesión
curl -s -o /dev/null -w '%{http_code}\n' $API/api/applications                             # 404  sin rutas públicas

ID=$(curl -s -b s.jar -H 'Content-Type: application/json' \
  -d "{\"company\":\"Globex\",\"role\":\"Backend Senior\",\"status\":\"APPLIED\",\"curatedProfileId\":\"$PROFILE_ID\",\"shareLinkId\":\"$LINK_ID\"}" \
  $API/api/admin/applications | node -pe 'JSON.parse(require("fs").readFileSync(0)).id')   # 201

curl -s -o /dev/null -w '%{http_code}\n' -b s.jar -X PATCH -H 'Content-Type: application/json' \
  -d '{"status":"ACCEPTED"}' $API/api/admin/applications/$ID                              # 422  APPLIED → ACCEPTED
curl -s -o /dev/null -w '%{http_code}\n' -b s.jar -X PATCH -H 'Content-Type: application/json' \
  -d '{"status":"INTERVIEWING"}' $API/api/admin/applications/$ID                          # 200
curl -s -o /dev/null -w '%{http_code}\n' -b s.jar -H 'Content-Type: application/json' \
  -d "{\"company\":\"Otra\",\"role\":\"X\",\"curatedProfileId\":\"$PROFILE_ID\",\"shareLinkId\":\"$LINK_ID\"}" \
  $API/api/admin/applications                                                              # 409  enlace repetido
curl -s -b s.jar $API/api/admin/applications/summary                                       # {"byStatus":{...,"INTERVIEWING":1,...},"active":1}
curl -s -D - -o postulaciones.csv -b s.jar "$API/api/admin/applications/export?status=INTERVIEWING"
# Content-Type: text/csv; charset=utf-8
# Content-Disposition: attachment; filename="postulaciones-AAAA-MM-DD.csv"
# Cache-Control: no-store
curl -s -o /dev/null -w '%{http_code}\n' -b s.jar -X DELETE $API/api/admin/applications/$ID  # 204
rm -f postulaciones.csv
```

**Ejecutado** (7 de noviembre de 2026, imagen de `frontend/Dockerfile` en `localhost:8102`, API de la rama en `localhost:3348` y la base descartable `portfolio_apps_example`, sembrada con el ejemplo): el bloque **Por la API** dio los códigos esperados (401, 404, 201, 422 con `error: "Unprocessable Entity"` y sin `stack`, 200, 409, 400 con un campo `contactEmail`, 400 con `status=HIRED`, 204; el resumen dio `active: 1`; con una apertura de persona y otra de un bot, el enlace trajo `opens: 1`; el export respondió `text/csv; charset=utf-8`, `attachment; filename="postulaciones-2026-11-07.csv"` y `no-store`). Los nueve pasos del panel se ejecutaron en Chrome controlado con `puppeteer-core` (sesión abierta por `fetch`, sin escribir credenciales) con el resultado esperado de cada uno. El CSV se abrió en **Excel 16**: acentos correctos, 14 columnas y las celdas con fórmula (`=HYPERLINK(…)`, `+Lead`, `@usuario`) como texto con su apóstrofo, sin ninguna celda con fórmula. Además `a11y:check` con panel (60 cargas, con `/admin/postulaciones` y el diálogo con errores): 0 violaciones. Evidencia: `openspec/changes/add-application-tracking/verification/` (`9.2-tc46.txt`, `9.2-csv.png`, `9.3-a11y.txt`).

![Postulaciones con el filtro Todas](manual/bo-postulaciones.jpg)

### TC-47 — Revisar la consistencia del CV ✅

**Precondición:** base de ejemplo **descartable** (nunca `portfolio`) sembrada con `npm run seed:example`, con la API y el frontend levantados (de preferencia la imagen de `frontend/Dockerfile`) y una sesión de administrador. El ejemplo declara 11 años y sus experiencias van de 2015-01 al mes actual (`cobalto` es actual): en noviembre de 2026 suman 143 meses (11 años y 11 meses) y no hay aviso de años; desde diciembre de 2026 suman 12 años o más y el aviso aparece desde el paso 1, lo que también es correcto. Tiene una certificación vencida (`2025-12`) y el perfil `ejemplo-borrador` sin la descripción en inglés, a propósito.

**Pasos (panel):**
1. Entrá a `/admin` y pulsá **Revisión** en el menú.
2. Mirá el resumen y los bloques **Avisos** y **Sugerencias**.
3. En **Portada**, cambiá los años de experiencia a `15` y guardá. Volvé a **Revisión** y pulsá **Volver a revisar**.
4. En el hallazgo de años, pulsá **Abrir**.
5. Volvé a poner `11` en **Portada**, guardá y volvé a **Revisión**.
6. En **Experiencias**, editá una experiencia visible: borrá el **Resumen (EN)** y guardá. Volvé a **Revisión**.
7. En ese hallazgo, pulsá **Abrir**.
8. Restaurá el resumen en inglés, guardá y volvé a **Revisión**.
9. Abrí a mano `/admin/formacion?editar=inexistente`.

**Resultado esperado:**
1. Se abre `/admin/revision` con el ítem **Revisión** marcado como activo.
2. El resumen dice «0 errores · 1 aviso · 1 sugerencia» y «Experiencia: 11 años declarados; las fechas suman {años} años y {meses} meses», con los del mes actual (11 y 11 en noviembre de 2026; desde diciembre, un aviso más por los años). En **Avisos** está `ejemplo-borrador` con «Falta el texto en inglés de description.»; en **Sugerencias**, la certificación vencida con «Venció en 2025-12: el sitio la muestra como «Vencida».».
3. En **Avisos** aparece «Declarás 15 años de experiencia, pero las experiencias cargadas suman {años} años y {meses} meses.» (los mismos números del paso 2) y el resumen pasa a «0 errores · 2 avisos · 1 sugerencia».
4. Se abre **Portada**.
5. El aviso de 15 años desaparece y el resumen vuelve al del paso 2.
6. Aparece en **Avisos** un hallazgo de esa experiencia: «Falta el texto en inglés de summary.».
7. Se abre **Experiencias** con el diálogo de edición de esa experiencia, y la URL ya no tiene `?editar=`.
8. El hallazgo desaparece y el resumen vuelve al del paso 2.
9. Aparece «El ítem ya no existe.» y no se abre ningún diálogo.

**Errores típicos:** si el resumen no cambia después de editar, pulsá **Volver a revisar** (la pantalla vuelve a pedir al entrar, pero no mientras está abierta). Un aviso de años con tus datos reales no es un error de la plataforma: `yearsOfExperience` se carga a mano y la revisión solo compara con las experiencias cargadas. Si falta experiencia anterior, cargala o ajustá el número. La revisión nunca corrige nada sola.

**Por la API** (Bash, con la cookie de sesión del login de § 0 en `jar`):

```bash
API=http://localhost:3300
curl -s -o /dev/null -w '%{http_code}\n' $API/api/admin/consistency                 # 401
curl -s -b jar $API/api/admin/consistency | node -e "
  const r=JSON.parse(require('fs').readFileSync(0,'utf8'));
  console.log(r.asOf, JSON.stringify(r.experience), JSON.stringify(r.summary));
  for (const i of r.issues) console.log(i.severity, i.code, i.entityType, i.entityId, '-', i.message);"
                                                                                  # 0 errores; certification.expired y el borrador sin traducir
curl -s -b jar "$API/api/admin/consistency?locale=en" | node -e "
  const r=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(r.issues[0].code, '|', r.issues[0].message);"
                                                                                  # mismo code, mensaje en inglés
curl -s -D - -o /dev/null -b jar $API/api/admin/consistency | grep -i cache-control  # no-store
```

**Por la línea de comandos** (sin base):

```bash
cd backend
npm run cv:lint; echo "salida: $?"                                                 # aviso de años (10 contra 8 años y 7 meses); salida: 0
npm run cv:lint -- --file ../docs/examples/cv-data.example.json; echo "salida: $?"  # borrador sin traducir y vencida (y aviso de años desde 2026-12); salida: 0
node -e "const f=require('fs');const d=JSON.parse(f.readFileSync('../docs/examples/cv-data.example.json','utf8'));
  d.experiences[1].current=true; d.experiences[1].endDate='2024-05';
  f.writeFileSync(require('os').tmpdir()+'/cv-roto.json',JSON.stringify(d))"
npm run cv:lint -- --file "$(node -p "require('os').tmpdir()")/cv-roto.json"; echo "salida: $?"
                                                                                  # ERROR date.ongoing-with-end experience:<clave>; salida: 1
npm run cv:lint -- --file no-existe.json; echo "salida: $?"                        # salida: 2
```

**Observado** (7 de noviembre de 2026, imagen de `frontend/Dockerfile` en `localhost:8103`, API de producción de la rama en `localhost:3349` y la base descartable `portfolio_lint_example`, sembrada con el ejemplo): los nueve pasos dieron lo esperado, con el resumen «0 errores · 1 aviso · 1 sugerencia» (143 meses derivados contra 11 declarados), «0 errores · 2 avisos · 1 sugerencia» con 15 años y con el resumen en inglés vacío, y de vuelta a «1 aviso · 1 sugerencia» al restaurar. Los cambios de datos de los pasos 3, 5, 6 y 8 se hicieron por la API con la misma sesión; la navegación, **Volver a revisar**, **Abrir** y el aviso salen del panel. Por la API: 401 sin sesión, `Cache-Control: no-store` y el mismo `code` en español e inglés. `cv:lint` salió con 0 y 0 sobre los dos archivos (con el aviso de años del CV real, 10 contra 8 años y 7 meses), con 1 sobre la copia rota y con 2 con la ruta inexistente. `a11y:check` con panel, incluida `/admin/revision`: 0 violaciones.

![Revisión con un aviso y una sugerencia](manual/bo-revision.jpg)

### TC-48 — Exportar un perfil curado como JSON Resume 🔍

**Precondición:** base de ejemplo **descartable** (nunca `portfolio`), con la API y el frontend levantados (de preferencia la imagen de `frontend/Dockerfile`, para que `/api/...` pase por Caddy). Sesión del panel con un administrador de prueba.

**Pasos (panel):**
1. En **Perfiles curados**, abrí `ejemplo-backend` y pasá a la pestaña **Publicación**.
2. Debajo de **Link público**, pulsá **ES** en «Descargar JSON Resume»; después, **EN**.
3. Cambiá el título del perfil sin guardar y volvé a **Publicación**.
4. Descartá el cambio. Abrí `ejemplo-borrador` (privado) y pulsá **ES**.
5. Volvé a la lista, pulsá **Nuevo perfil** y entrá a **Publicación** sin guardar.

**Resultado esperado:**
1. Se ve «Descargar JSON Resume» con los enlaces **ES** y **EN**.
2. Se descargan `ejemplo-backend.es.resume.json` y `ejemplo-backend.en.resume.json`. Abiertos, empiezan con `"$schema"` apuntando a `resume-schema/v1.0.0`, `basics.name` es el nombre del perfil de ejemplo, `work` tiene las mismas experiencias y en el mismo orden que la página `/ejemplo-backend`, y los textos están en el idioma de cada archivo.
3. Debajo de los enlaces se ve «Se exporta la última versión guardada».
4. Se descarga `ejemplo-borrador.es.resume.json`, aunque `/ejemplo-borrador` en el sitio da «no encontrado».
5. Los enlaces están deshabilitados y se ve «Guardá el perfil para exportarlo».

**Por la API** (Bash):

```bash
BASE=http://localhost:8080          # la imagen de frontend/Dockerfile; con Vite, http://localhost:5173
R=/api/curated-profiles
curl -s -o /dev/null -w '%{http_code}\n' "$BASE$R/all/resume.json"                                   # 200
curl -s -D - -o /dev/null "$BASE$R/ejemplo-backend/resume.json?lang=en" | grep -iE 'content-(type|disposition|language)|cache-control|x-robots'
#   application/json; charset=utf-8 · attachment; filename="ejemplo-backend.en.resume.json" · en · no-cache · noindex
curl -s -o /dev/null -w '%{http_code}\n' "$BASE$R/ejemplo-secciones/resume.json"                     # 200, sin basics.profiles (Presencia oculta)
curl -s -o /dev/null -w '%{http_code}\n' "$BASE$R/ejemplo-borrador/resume.json"                      # 404 (PRIVATE)
curl -s -o /dev/null -w '%{http_code}\n' "$BASE$R/ejemplo-archivado/resume.json"                     # 404 (archivado)
curl -s -o /dev/null -w '%{http_code}\n' "$BASE$R/ejemplo-protegido/resume.json"                     # 401
curl -s -o /dev/null -w '%{http_code}\n' "$BASE$R/ejemplo-protegido/resume.json?token=ejemplo-token-2026"   # 200, Cache-Control: private, no-store
curl -s -D - -o /dev/null "$BASE$R/ejemplo-nombre-anterior/resume.json" | grep -i content-location   # /api/curated-profiles/ejemplo-renombrado/resume.json
```

Antes y después de los `curl`, el contador de visitas de `ejemplo-backend` en **Perfiles curados** (o en el Dashboard) es el mismo: exportar no cuenta como visita.

**Errores típicos:** `/ejemplo-backend/resume.json` (sin `/api`) devuelve la página del sitio, no el JSON: la ruta es `/api/curated-profiles/<slug>/resume.json`. Un 401 en la descarga del panel indica que la sesión venció: volvé a entrar. El archivo no trae el año de las certificaciones (el formato pide una fecha completa que el panel no guarda; P1 de `design.md`).

**Ejecutado** (7 de noviembre de 2026, imagen de `frontend/Dockerfile` en `localhost:8101`, API de la rama en `localhost:3347` y la base descartable `portfolio_resume_example`, sembrada con el ejemplo): el bloque **Por la API** dio exactamente los códigos esperados (200 para `all` y `ejemplo-secciones`, este sin `basics.profiles`; 404 para `ejemplo-borrador` y `ejemplo-archivado`; 401 para `ejemplo-protegido` sin token y 200 con `?token=` y con `X-Access-Token`; `Content-Location` al slug vigente en el alias; y `/ejemplo-backend/resume.json` sin `/api`, la página del sitio, 200 `text/html`). Los 8 archivos bajados (públicos en ES y EN, el protegido y los del panel, incluido el del perfil privado) validan contra el schema vendorizado con los formatos activos; el del protegido no contiene el token; el del panel es idéntico byte a byte al público en ES y EN; el contador de visitas de los 9 perfiles es el mismo antes y después, también con `?via=&src=`. En Chrome, la vista pública de `ejemplo-backend` no trae ningún enlace al JSON y la descarga por `fetch` devuelve las mismas empresas que la página. `a11y:check` con panel (56 cargas, incluido el constructor): 0 violaciones. **Observación:** el `Caddyfile` agrega `Cache-Control: no-cache` a toda ruta que no sea `/assets/*` ni `/fonts/*`, así que por el contenedor `web` un perfil protegido recibe dos líneas (`no-cache` y `private, no-store`); `no-store` sigue presente y lo mismo pasa con el detalle, pero conviene decidir si `/api/*` debe quedar fuera de esa regla. Los pasos del panel (1 a 5), que piden una sesión iniciada en el navegador, **no se ejecutaron a mano**: los cubren el test del constructor (los dos `href`, `download`, el perfil nuevo y los cambios sin guardar) y el e2e de la ruta del panel, y la sesión del `curl` es la misma que usa la descarga. Por eso el caso queda en 🔍. Evidencia: `openspec/changes/add-json-resume-export/verification/6.3-tc48.md`.

### TC-49 — Sincronizar una integración y ver su estado ✅

**Precondición:** base de ejemplo **descartable** (nunca `portfolio`), con la API y el frontend levantados (de preferencia la imagen de `frontend/Dockerfile`) y una sesión de administrador. La API arranca con `INTEGRATIONS_ENABLED=fake`, `INTEGRATIONS_SCHEDULER_ENABLED=true`, `INTEGRATIONS_TICK_SECONDS=10` y un keyring (`INTEGRATIONS_KEYS` e `INTEGRATIONS_ACTIVE_KEY`, claves de 32 bytes generadas con `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`), **sin** `FAKE_PROVIDER_TOKEN`: el secreto es opcional y se carga desde el panel.

**Pasos:**
1. Abrí **Cuenta** (`/admin/cuenta`) y pulsá el enlace **Integraciones** del bloque del mismo nombre.
2. Mirá la tarjeta de `fake`.
3. Pulsá **Guardar** con el campo **Credencial** vacío.
4. Escribí una credencial de prueba (un valor aleatorio que no sea de nadie) y pulsá **Guardar**; recargá la página.
5. Pulsá **Sincronizar ahora** y, de inmediato, otra vez.
6. Esperá hasta 25 s sin tocar nada.
7. Pulsá **Pausar** y, por la API, pedí otra sincronización (`POST /api/admin/integrations/fake/sync`). Después pulsá **Reanudar**.
8. Pulsá **Borrar** y confirmá.
9. Desde `backend/`, corré `npm run integrations:sync -- --provider fake` (con la credencial borrada).

**Resultado esperado:**
1. Se abre `/admin/integraciones`; la barra de navegación sigue con sus nueve ítems y ninguno es **Integraciones**; hay un enlace **Volver a Cuenta**.
2. Estado «Activo», «Todavía no corrió», credencial «Falta la credencial» con el campo **Credencial** (tipo contraseña) a la vista y ningún aviso de scheduler apagado.
3. Aparece «Ingresá la credencial.» y no se llama a la API.
4. Aparece «Credencial guardada.», el campo queda vacío y la tarjeta dice «Guardada en la base (clave k1)»; tras recargar sigue igual, el campo vacío y el valor no figura en el DOM.
5. Aparece «Encolado: corre en el próximo minuto.» (cola «1 pendientes») y después «Ya había una sincronización en cola.».
6. El tick toma el trabajo y la pantalla se refresca sola: la última corrida pasa a «Exitosa», «Última exitosa» tiene fecha y la cola vuelve a «0 pendientes · 0 en curso».
7. El estado pasa a «Pausado», **Sincronizar ahora** queda deshabilitado y la API responde **422**; al reanudar vuelve «Activo».
8. Aparece «Credencial borrada.» y la tarjeta vuelve a «Falta la credencial».
9. Sin credencial el trabajo termina fallido: «Corrida: 1 trabajos (hechos 0, …, muertos 1, …)», salida **1**, y la tarjeta muestra «falta la credencial» como último error fallido.

**Errores típicos:** Con `FAKE_PROVIDER_TOKEN` definida en el servidor la credencial viene de la variable: la tarjeta dice «Variable de entorno del servidor», no hay campo y `PUT /api/admin/integrations/fake/credential` responde 422. Con el scheduler apagado (`INTEGRATIONS_SCHEDULER_ENABLED` sin definir) el trabajo se encola pero no corre: la pantalla lo avisa y `npm run integrations:sync` lo ejecuta a mano. «Sincronizar ahora» nunca llama al proveedor dentro de la petición: si tarda en correr, esperá al próximo tick (hasta 60 s con el valor por defecto).

**Observado** (12 de noviembre de 2026 (repetido tras el cambio de D11), imagen de `frontend/Dockerfile` en `localhost:8158`, API de la rama en `localhost:3358` arrancada **sin** `FAKE_PROVIDER_TOKEN` y la base descartable `portfolio_integ_check`, sembrada con el ejemplo; Chrome controlado con `puppeteer-core` (sesión abierta por `fetch`, sin escribir la contraseña del panel). Los pasos 1 a 8 dieron lo esperado en un arranque normal: «Falta la credencial» con el campo a la vista, «Ingresá la credencial.» sin llamar a la API, un valor de prueba generado al azar guardado («Guardada en la base (clave k1)», campo vacío, valor fuera del DOM también tras recargar), «Encolado…», «Ya había…», «Exitosa» tras el tick con refresco automático, Pausar con 422 por la API, Reanudar y Borrar con confirmación. El paso 9 (`integrations:sync` sin credencial) dio la salida 1 con el trabajo fallido «falta la credencial». Con `FAKE_PROVIDER_TOKEN` definida, el `PUT` da 422 y la tarjeta dice «Variable de entorno del servidor» (e2e `integrations-admin`). `a11y:check` con panel contra la imagen actual: ver `10.2-a11y.txt`. Evidencia: `openspec/changes/add-integrations-foundation/verification/` (`10.1-tc49.txt`, `10.2-a11y.txt`, `8.2-cli.txt`, `7.4-latencia.txt`).)

![Integraciones con el proveedor fake: última corrida exitosa y el campo Credencial](manual/bo-integraciones.jpg)

### TC-50 — Destacar repositorios de GitHub 🔍

**Precondición:** base de ejemplo **descartable** (nunca `portfolio`), con la API y el frontend levantados (de preferencia la imagen de `frontend/Dockerfile`) y una sesión de administrador. El ejemplo trae tres repositorios ficticios de `portafolio-ejemplo-ficticio`: `reservas-api` (tags `java`, `microservices`), `metricas-dashboard` (`nodejs`, `react`, `microservices`) y `experimento-oculto` (oculto).

**Pasos (panel):**
1. Entrá a `/admin/proyectos`: debajo de **Proyectos destacados** está **Repositorios destacados**. Mirá la insignia **Oculto** en `experimento-oculto`.
2. Pulsá **Nuevo repositorio**. En **URL de GitHub** escribí `https://gitlab.com/a/b`, en **Nombre** `x` y pulsá **Guardar**.
3. Cambiá la URL por `https://github.com/Portafolio-Ejemplo-Ficticio/RESERVAS-API` (otras mayúsculas), completá **Descripción (es)** con `x` y pulsá **Guardar**. Después **Cancelar**.
4. Abrí la home `/` y bajá hasta **Repositorios destacados**.
5. Abrí `/ejemplo-renombrado`.
6. En **Perfiles curados**, abrí `ejemplo-renombrado`, pestaña **Selección**, y mirá el bloque **Repositorios**.
7. Pulsá **Incluir** en `reservas-api` (sin guardar).
8. Pulsá **Excluir** en `metricas-dashboard` y volvé a **Incluir** en `reservas-api`. Salí sin guardar.
9. Con `ejemplo-backend` en el navegador, imprimí (`Ctrl+P`, **Guardar como PDF**); después pedí su `resume.json` (ver abajo).

**Resultado esperado:**
1. Se ven los tres repositorios: `experimento-oculto` con el borde punteado y la insignia **Oculto**.
2. No se envía nada: bajo **URL de GitHub** aparece «La URL tiene que ser https://github.com/<usuario>/<repositorio>».
3. Aparece «Ese repositorio ya está cargado» bajo la URL (la API respondió 409); al editar la URL el mensaje se va. No se creó ningún repositorio.
4. La sección tiene dos tarjetas, `reservas-api` y `metricas-dashboard`, con el nombre como enlace a `https://github.com/portafolio-ejemplo-ficticio/…` (se abre en una pestaña nueva), el lenguaje y las tecnologías; `experimento-oculto` no está.
5. El perfil **no** tiene la sección: resuelve un solo repositorio (`metricas-dashboard`) y la sección necesita dos.
6. Aparecen los dos visibles y el oculto (este con **Incluir** deshabilitado) y el aviso «La sección Repositorios se muestra desde 2; este perfil resuelve 1».
7. El aviso desaparece y la vista previa muestra la sección **Repositorios destacados** con los dos repositorios.
8. El aviso del umbral vuelve a aparecer y la sección sale de la vista previa; al salir sin guardar no queda ningún cambio.
9. El PDF de `ejemplo-backend` tiene una sola página con la línea «Repositorios: reservas-api · metricas-dashboard» (los dos nombres son enlaces y no se imprime ninguna URL).

**Por la API** (Bash, con la cookie de sesión del login de § 0 en `jar`):

```bash
BASE=http://localhost:8080          # la imagen de frontend/Dockerfile; con Vite, http://localhost:5173
curl -s "$BASE/api/featured-repositories?locale=en" | node -e "
  const r=JSON.parse(require('fs').readFileSync(0,'utf8'));
  console.log(r.length, r.map(x=>x.name).join(','), '|', r[0].description);"
                                                                                  # 2 reservas-api,metricas-dashboard | descripción en inglés (el oculto no sale)
curl -s -b jar $BASE/api/admin/featured-repositories | node -e "
  const r=JSON.parse(require('fs').readFileSync(0,'utf8'));
  console.log(r.length, r.filter(x=>!x.visible).map(x=>x.name).join(','));"
                                                                                  # 3 experimento-oculto (el panel trae los tres)
curl -s $BASE/api/curated-profiles/ejemplo-renombrado | node -e "
  const r=JSON.parse(require('fs').readFileSync(0,'utf8'));
  console.log(r.repositories.length, r.sections.includes('repositories'));"
                                                                                  # 1 false (el dato viaja, la sección no)
curl -s $BASE/api/curated-profiles/all | node -e "
  const r=JSON.parse(require('fs').readFileSync(0,'utf8'));
  console.log(r.repositories.length, r.sections.indexOf('repositories')-r.sections.indexOf('projects'));"
                                                                                  # 2 1 (justo después de projects)
curl -s $BASE/api/curated-profiles/ejemplo-backend/resume.json | node -e "
  const r=JSON.parse(require('fs').readFileSync(0,'utf8'));
  console.log(r.projects.filter(p=>p.type==='repository').map(p=>p.name+' '+p.keywords.join('/')).join(' | '));"
                                                                                  # reservas-api Java/Spring Boot/PostgreSQL/Docker | metricas-dashboard TypeScript/React/NestJS/Vite
curl -s -o /dev/null -w '%{http_code}\n' -b jar -X POST $BASE/api/admin/featured-repositories -H 'Content-Type: application/json' \
  -d '{"name":"x","url":"https://gitlab.com/a/b","description":{"es":"x"}}'                  # 400
curl -s -o /dev/null -w '%{http_code}\n' -b jar -X POST $BASE/api/admin/featured-repositories -H 'Content-Type: application/json' \
  -d '{"name":"x","url":"https://github.com/Portafolio-Ejemplo-Ficticio/RESERVAS-API","description":{"es":"x"}}'   # 409
curl -s -o /dev/null -w '%{http_code}\n' -b jar -X POST $BASE/api/admin/featured-repositories -H 'Content-Type: application/json' \
  -d '{"name":"x","url":"https://github.com/a/b","description":{"es":"x"},"stars":5}'        # 400 (stars no existe en el contrato)
```

**Errores típicos:** con un solo repositorio visible para un perfil la sección no aparece: no es un error, la regla es 2 o más. Una URL con barra final, `.git`, `www.` o de otro host se rechaza siempre. Un repositorio sin tags solo aparece en los perfiles sin `filterTags` (la home) o donde lo incluyas a mano. En el PDF la línea se omite sin aviso cuando la hoja no tiene lugar (perfiles muy cargados); el sitio y el `resume.json` sí lo muestran. Nada de esto llama a GitHub: ni las *stars* ni el lenguaje se sincronizan, y `stars` no existe en la API.

**Observado** (12 de noviembre de 2026, el `dist/` del repo servido por Caddy 2 con el `Caddyfile` del repo en `localhost:8152` (equivale a la imagen de `frontend/Dockerfile`), la API de la rama en `localhost:3352` y la base descartable `portfolio_repos_check`, sembrada con el ejemplo): los pasos 1 a 8 se ejecutaron en Chrome controlado por `puppeteer-core` con la sesión iniciada por `POST /api/auth/login` (sin escribir ninguna contraseña) y dieron lo esperado: los tres repositorios con el oculto marcado; el mensaje de URL fuera de forma sin enviar nada; «Ese repositorio ya está cargado» bajo la URL, que se va al editarla, y el aviso de cambios sin guardar al cancelar; la home con las dos tarjetas (enlaces a `github.com/portafolio-ejemplo-ficticio/…` con `target="_blank"` y `rel="noopener noreferrer"`); `/ejemplo-renombrado` sin la sección; en el constructor, los tres repositorios con `Incluir` deshabilitado en el oculto y el aviso del umbral, que desaparece al incluir `reservas-api` (la vista previa trae la sección) y vuelve al excluir `metricas-dashboard`; al salir sin guardar, `includeIds` y `excludeIds` de `ejemplo-renombrado` siguen vacíos. Por la API: `GET /api/featured-repositories?locale=en` devuelve 2 con la descripción en inglés, el panel trae 3 (uno oculto), `ejemplo-renombrado` resuelve 1 repositorio y no trae la sección, `all` trae la sección justo después de `projects`, el `resume.json` de `ejemplo-backend` termina con `reservas-api` y `metricas-dashboard` (`type: "repository"`, con el lenguaje y las tecnologías como `keywords`), y los tres `POST` dieron 400 (GitLab), 409 (otras mayúsculas) y 400 (`stars`) sin crear nada (el panel sigue con 3). `print:check`: 20 casos sobre el ejemplo y 56 sobre `docs/cv-data.json` con dos repositorios de prueba, todos en una página en A4 y Letter (la línea entra en todos los perfiles menos en el de 62 y 63 líneas estimadas, que desbordaba; ver D9 del change). `a11y:check` con panel (62 cargas, incluido `/admin/proyectos` con el bloque nuevo): 0 violaciones. `perf:check` (Lighthouse mobile, 3 corridas): Performance 94 en la home y 95 en el perfil. El paso 9 no se ejecutó a mano: el diálogo de impresión de Chrome queda como paso manual (como en TC-31) y el PDF se verificó con `print:check` y con la línea «Repositorios: reservas-api · metricas-dashboard» en el DOM de impresión. Por eso el caso queda en 🔍. Evidencia: `openspec/changes/add-featured-repositories/verification/`.)

![Bloque Repositorios destacados](manual/tc50-repositorios.jpg)

![Repositorio con una URL que no es de GitHub](manual/tc50-repositorio-dialogo.jpg)

![Sección Repositorios destacados de la home](manual/tc50-seccion-publica.jpg)

## 4. Administrar el resto del contenido

Desde el change `add-profile-content-admin`, todo lo que el sitio muestra se edita en el panel. El seed queda para **poblar una base vacía**, no para editar.

### TC-25 — Cambiar el titular y la disponibilidad ✅

**Pasos:** `/admin/portada`.

1. Editar **Titular** o **Fecha de inicio** (pestañas ES/EN). La vista previa del hero, a la derecha, cambia sin guardar: la resuelve el backend con el mismo mapper que la ruta pública.
2. **Guardar portada.** El cambio se ve en `/` y en cada perfil curado, sin correr el seed.
3. Un obligatorio vacío (nombre, titular o resumen en español, email, ubicación) no se envía; si llega a la API, es 400 y el perfil queda como estaba.
4. **Idiomas**, en la misma página: agregar, editar y borrar con confirmación. El nombre mostrado, el **nivel** y el detalle tienen pestañas ES/EN (el español del nivel es obligatorio); ver TC-32.

> El titular base se ve en la home y en todo perfil curado **sin titular propio** (decisión D7). Las plantillas del seed traen el suyo, pensado para su rol, y lo conservan; la home `all` no tiene ninguno. Para que un perfil curado vuelva a usar el titular base, vaciá su titular en la pestaña Identidad del constructor.

```bash
# El perfil es un singleton: no hay id en la ruta. El PUT reemplaza todo.
curl -s $API/api/admin/profile -H "$AUTH" | jq '{headline, availability}'
curl -s -X PUT $API/api/admin/profile -H "$AUTH" -H 'Content-Type: application/json'   -d "$(curl -s $API/api/admin/profile -H "$AUTH" | jq 'del(.id) | .availability.startDate={"es":"En dos semanas","en":"In two weeks"}')"
```

**Ejecutado** (e2e `content-admin.e2e-spec.ts`):

```
PUT con headline nuevo                     -> 200 y el hero de / lo muestra (all no tiene titular propio)
PUT con startDate nuevo                    -> el perfil curado lo sirve en el idioma pedido
PUT con un campo desconocido               -> 400 y el perfil queda idéntico
PUT con email vacío                        -> 400 y conserva el email anterior
POST /api/admin/profile/preview            -> 200 resuelto, sin escribir nada
```

![Portada con la vista previa del hero](manual/tc25-portada.jpg)

### TC-26 — Formación: ocultar sin borrar ✅

**Pasos:** `/admin/formacion`. Dos listas: **Educación** y **Certificaciones**, con el mismo patrón de lista y diálogo que Skills.

1. **Nueva** → completar → **Guardar**. Las fechas aceptan `YYYY-MM` o `YYYY`; *en curso* excluye la fecha de fin.
2. Para retirar un ítem sin perderlo, desmarcar **Visible en el sitio**: sale de la vista pública y sigue en el panel con la marca *Oculto*.
3. Borrar pide confirmación.

```
POST certificación + PATCH {visible:false} -> fuera de GET /api/certifications, sigue en /api/admin/certifications
GET /api/admin/education                   -> incluye la oculta, con visible y order
```

![Formación en el panel](manual/tc26-formacion.jpg)

### TC-42 — Verificar una certificación desde el sitio ✅

**Precondición:** base de ejemplo, **descartable** (nunca `portfolio`: cada carga pública registra una visita), con la API y el frontend levantados (de preferencia la imagen de `frontend/Dockerfile`) y la sesión del panel iniciada en `/admin`.

**Pasos:**
1. `/admin/formacion` → **Certificaciones** → editar *Arquitecto de Soluciones en la Nube*. En **Enlace de verificación** reemplazá el texto por `http://example.org/credenciales/arquitecto-nube-2023` y pulsá **Guardar**.
2. Cambiá el enlace a `https://example.org/credenciales/arquitecto-nube-2023`. Comprobá que **ID de credencial** dice `EJ-2023-0042` y **Vence** `2029-06`, y guardá.
3. En **Vence** de *Liderazgo técnico para equipos de ingeniería* escribí `12/2025` y guardá; corregilo a `2025-12` y guardá.
4. En una **ventana privada**, abrí `/` y bajá a **Certificaciones**.
5. Pulsá **Ver credencial** en *Arquitecto de Soluciones en la Nube*.
6. Abrí `/?lang=en` y mirá la misma sección.
7. Volvé a `/` y pulsá **Imprimir / Guardar PDF** → **Guardar como PDF**. En el PDF, hacé clic en **Ver credencial**.
8. En el panel, borrá el texto de **Enlace de verificación** de esa certificación, guardá y recargá `/` en la ventana privada.

**Resultado esperado:**
1. El campo muestra «Usá una URL completa que empiece con https://» y no se guarda nada.
2. Se guarda; la lista no cambia.
3. Primero «Usá el formato AAAA-MM o AAAA»; con `2025-12`, se guarda.
4. *Arquitecto de Soluciones en la Nube* muestra `ID: EJ-2023-0042`, «Válida hasta» con junio de 2029 y el enlace **Ver credencial**. *Liderazgo técnico…* muestra **Vencida** y no tiene enlace. La certificación oculta no aparece.
5. Se abre una pestaña nueva en `https://example.org/credenciales/arquitecto-nube-2023`. El enlace tiene `rel="noopener noreferrer"`.
6. Las etiquetas dicen **View credential**, **Valid until** y **Expired**; la URL es la misma.
7. La hoja ocupa una página. En el bloque de certificaciones se lee «Ver credencial» junto a la primera y «vencida» en el paréntesis de la segunda; la URL de la credencial no está impresa. El clic en el PDF abre la URL.
8. La tarjeta vuelve a mostrar solo nombre, emisor, año, ID y vigencia, sin enlace.

**Errores típicos:** el enlace se rechaza por empezar con `http://` (solo se aceptan enlaces `https://`) o por faltarle el protocolo (`example.org/…`). «Vencida» depende de la fecha de tu equipo: el sitio no consulta al emisor, que es quien dice si la credencial sigue vigente. Para sacar una certificación vencida del sitio, desmarcá **Visible en el sitio**. El sitio no comprueba que el enlace funcione: abrilo después de cargarlo.

**Por la API** (con la cookie de sesión de § 0):

```text
PATCH /api/admin/certifications/:id {"verificationUrl":"http://example.org/c/1"}  -> 400
PATCH /api/admin/certifications/:id {"verificationUrl":"https://example.org/c/1"} -> 200
GET   /api/certifications                     -> verificationUrl, credentialId, expiresAt (sin campo expired)
PATCH /api/admin/certifications/:id {"verificationUrl":null}                      -> 200, enlace en null
```

**Ejecutado** (29 de octubre de 2026, imagen de `frontend/Dockerfile` en `localhost:8095`, API local y la base descartable `portfolio_cert_example`, sembrada con el ejemplo; Chrome no headless con un contexto sin sesión para el sitio y la sesión del panel iniciada por `fetch('/api/auth/login')`, sin escribir la contraseña en un navegador; evidencia en `openspec/changes/add-certification-verification/verification/`): los pasos 1 a 8 dieron lo esperado. El enlace leído del DOM: `target="_blank"`, `rel="noopener noreferrer"` y nombre accesible «Ver credencial: Arquitecto de Soluciones en la Nube»; el PDF tiene 1 página y un enlace `/URI` a la URL del ejemplo; la consola, sin errores ni violaciones de CSP. `print:check` dio 1 página en las 20 combinaciones del ejemplo y en las 56 del CV.

![Sección de certificaciones con Ver credencial y Vencida](manual/tc42-credencial.jpg)

### TC-44 — Los buscadores leen la página de perfil 🔍

**Precondición:** base **descartable** sembrada con el ejemplo (nunca `portfolio`: cada carga pública registra una visita), la API y la imagen de `frontend/Dockerfile` levantadas, y un perfil del ejemplo puesto en `PROTECTED` desde el panel (el ejemplo ya trae `ejemplo-protegido`). Para los pasos 6 y 7, el sitio desplegado.

**Pasos:**
1. `curl -s <base>/ejemplo-backend` y buscá `application/ld+json` en la respuesta.
2. Repetí con `?lang=en` y con `?via=k7m2q9xw4t&src=linkedin`.
3. Compará el bloque de `/` con el de `/ejemplo-backend`.
4. `curl -s` del perfil `PROTECTED`, sin y con `?token=<su token>`.
5. Abrí `/ejemplo-backend` en Chrome, DevTools → **Elements**, buscá `ld+json`, y mirá la **Console**. Copiá el JSON-LD que devolvió el paso 1 y pegalo en el validador de schema.org (https://validator.schema.org, **Fragmento de código**).
6. Con el sitio desplegado, pasá la URL de la home y la de un perfil público por el Rich Results Test (https://search.google.com/test/rich-results).
7. Pasá esas dos URLs por el validador de schema.org (**Obtener la URL**).

**Resultado esperado:**
1. Hay un solo bloque. Es un `ProfilePage` con `url` igual al `canonical` (sin query), `name` igual al `<title>`, `inLanguage` `es` y un `mainEntity` `Person` con el nombre de la persona ficticia, `knowsAbout` con las skills que muestra el perfil, `alumniOf` y `hasCredential` (la credencial verificable trae `url`, `identifier` y `expires`). `dateModified` es el día de la última edición del perfil (`AAAA-MM-DD`), el mismo que su `<lastmod>` en `/sitemap.xml`.
2. Con `lang=en` los textos de `name`, `description`, `jobTitle` y las credenciales están en inglés e `inLanguage` es `en`. Con `via` y `src` el bloque es idéntico al del paso 1.
3. El `@id` y la `url` del `Person` son los mismos en los dos (la home).
4. Ninguna de las dos respuestas tiene `application/ld+json` ni el título del perfil; `robots` es `noindex, nofollow`.
5. Hay un solo `<script type="application/ld+json">` y la consola no muestra errores ni violaciones de CSP. El validador no informa errores y detecta `ProfilePage` y `Person`.
6. La prueba detecta **Página de perfil** (*Profile page*) sin errores. La advertencia por `image` (campo recomendado) es esperable.
7. Sin errores; los dos `Person` tienen el mismo `@id`.

**Errores típicos:** si el bloque no aparece, el borde entregó el head de fallback (API caída o lenta, ver *Qué falla y por qué*): el sitio sigue funcionando y la SPA escribe el bloque al cargar, pero los validadores que no ejecutan JavaScript no lo ven. Un perfil `PROTECTED`, `PRIVATE`, archivado o inexistente nunca tiene bloque, y es a propósito. Si cambiaste un texto y el bloque sigue con el anterior, esperá un minuto (caché del head). Si `dateModified` no coincide con el `<lastmod>`, revisá que no estés mirando el head en caché (un minuto) después de editar el perfil. Google tarda días en reflejar los datos estructurados en los resultados: el Rich Results Test es la comprobación inmediata.

**Por la API:**

```text
GET /api/public/profile-head?slug=ejemplo-backend          -> 200, <script type="application/ld+json"> con "@type":"ProfilePage"
GET /api/public/profile-head?slug=ejemplo-backend&lang=en  -> "inLanguage":"en"
GET /api/public/profile-head?slug=<protegido>&token=<tok>  -> genérico, noindex, sin ld+json
GET /api/public/profile-head?slug=no-existe                -> genérico, igual al de un PRIVATE
```

**Ejecutado** (4 de noviembre de 2026, pasos 1 a 5; imagen de `frontend/Dockerfile` en `localhost:8097`, API de la rama en `localhost:3343` y la base descartable `portfolio_sd_example`, sembrada con el ejemplo): los diez `curl` dieron 200; `/`, `/ejemplo-backend` (es, en y con `via`/`src`) y `/ejemplo-dirigido` traen un solo bloque `ProfilePage`; `ejemplo-protegido` (con y sin token), `ejemplo-borrador`, `ejemplo-archivado` y un slug inexistente devuelven el genérico, sin bloque y con `noindex, nofollow`. El bloque de `ejemplo-backend` trae 12 skills, 2 instituciones y 2 credenciales (la verificable con `url`, `identifier` y `expires`); el de `via`/`src` es idéntico byte a byte; `/` y `/ejemplo-backend` comparten `@id` y `url`. En Chrome hay un solo bloque, también tras navegar dentro de la SPA, y la consola no muestra errores ni violaciones de CSP. El validador de schema.org dio **0 errores y 0 advertencias** (`ProfilePage`, `Person`, `PostalAddress`, `EducationalOrganization` y `EducationalOccupationalCredential`). Los pasos 6 y 7 esperan el deploy: por eso el caso queda en 🔍. Evidencia: `openspec/changes/upgrade-profile-structured-data/verification/6.2-tc44.txt`.

### TC-27 — Proyectos y enlaces sociales ✅

**Pasos:** `/admin/proyectos`.

1. Un proyecto con **tags** que coincidan con los `filterTags` de un perfil curado aparece en ese perfil, con su **url** como enlace. Es la forma de completar la `url` de los dos proyectos del seed.
2. Enlaces sociales: plataforma (`github`, `linkedin`, …), handle, url, etiqueta bilingüe, *destacado*, y `stats` como JSON (un objeto; un array o un texto es 400).

```
POST proyecto con tags del perfil          -> aparece en /api/curated-profiles/ejemplo-backend con su url
DELETE enlace social                       -> 204 y desaparece de /api/social-links
POST enlace con stats=[1,2]                -> 400
POST de cualquiera de las cinco entidades con un campo extra -> 400
```

![Proyectos y enlaces sociales](manual/tc27-proyectos.jpg)

### TC-28 — El constructor avisa antes de descartar cambios ✅

**Pasos:** `/admin/perfiles/:id` (por ejemplo `ejemplo-backend`).

1. Editar un campo, por ejemplo el **Título** de la pestaña Identidad. El botón *Guardar* sigue igual; lo que cambia es que salir ya no es gratis.
2. Pulsar **Volver** (o un enlace del menú lateral, o *Atrás* del navegador): aparece **Tenés cambios sin guardar** y la página no se mueve.
3. **Seguir editando** cierra el aviso y conserva lo escrito. **Salir sin guardar** navega y descarta: el título guardado sigue como estaba.
4. Recargar o cerrar la pestaña con cambios dispara el aviso nativo del navegador (el texto lo pone el navegador).
5. Escribir y borrar el mismo carácter, o un espacio final, vuelve a "limpio". Cambiar solo el idioma del preview o archivar el perfil nunca cuentan como cambio. Un perfil nuevo sin tocar sale sin diálogo, y un guardado exitoso deja la ficha limpia.

```
Título de ejemplo-backend editado -> Volver abre el aviso, sigue en /admin/perfiles/:id
Salir sin guardar                  -> /admin/perfiles, el título guardado sigue "Tech Lead .NET"
```

> El aviso nativo de `beforeunload` lo dibuja el navegador y no se capturó en la app real: lo cubren los tests del guardián (`use-unsaved-changes-guard.test.tsx`, `ProfileBuilderPage.test.tsx`).

![El constructor con cambios sin guardar](manual/tc28-constructor-con-cambios.jpg)

### TC-29 — La Portada avisa; cambiar el idioma no ✅

**Pasos:** `/admin/portada`.

1. Con el formulario en *Cambios sin guardar* (por ejemplo, un titular editado), elegir *Experiencias* en el menú lateral: aparece el mismo aviso que en el constructor, con *Seguir editando* / *Salir sin guardar*.
2. Cambiar el idioma de la vista previa (`?lang=`) con cambios pendientes **no** pide confirmación: es solo la query.
3. **Guardar portada** deja la página limpia y salir ya no pregunta.

**Ejecutado** el 8 de octubre de 2026 contra el contenedor `web`: se editó la Ubicación; cambiar el idioma de la vista previa (EN y de vuelta a ES, la URL pasó a `?lang=es`) no abrió el aviso y la edición se conservó; ir a Skills desde el menú lateral abrió «Tenés cambios sin guardar»; *Salir sin guardar* llevó a `/admin/skills` y la ubicación guardada siguió «Santa Cruz de la Sierra, Bolivia». Reusa el guardián y el diálogo de TC-28, con los tests de `PortadaPage.test.tsx`.

![La Portada con cambios sin guardar](manual/tc29-portada-con-cambios.jpg)

### TC-30 — Los formularios en diálogo avisan antes de descartar ✅

**Pasos:** cualquier formulario en diálogo del panel: experiencia, categoría y skill, formación y certificación, proyecto, enlace social e idioma. Ejemplo: `/admin/skills` → **Nueva categoría**.

1. Escribir un nombre y cerrar con **Escape**, con un clic fuera, con la X o con **Cancelar**: aparece **Tenés cambios sin guardar** ("Si lo cerrás ahora, se descartan los cambios de este formulario.") con el formulario abierto detrás.
2. **Seguir editando** conserva los valores. **Descartar** cierra sin crear nada.
3. Sin cambios, los cuatro caminos cierran directo. Guardar con éxito cierra sin aviso.
4. Con el diálogo abierto y con cambios, recargar dispara el aviso nativo.

```
Skills > Nueva categoría > nombre escrito > Escape -> aviso con el formulario abierto detrás
Descartar                                          -> cierra, la categoría no se crea
```

> *Atrás* del navegador con un diálogo abierto no tiene aviso propio (decisión D11 del change): el modal tapa la navegación del panel y *Atrás* con un modal abierto es raro. En la app real se probó *Escape*; clic fuera, X y *Cancelar* los cubren los tests del guardián y de cada página.

![Aviso al cerrar un formulario en diálogo con cambios](manual/tc30-dialogo-con-cambios.jpg)

### El seed ya no es la forma de editar

```bash
# Base vacía: carga sin flags
cd backend && npm run seed && npm run seed:verify

# Base con contenido: se niega (código 2). Para volver al estado del CV a propósito:
npm run seed -- --overwrite
```

> `seed` **sobrescribe**: pisaría el trabajo del panel (portada, formación, proyectos, enlaces, experiencias y skills). Por eso, sobre una base con contenido, `npm run seed` sale con código 2 y no escribe nada: lista qué se perdería y sugiere el `pg_dump`. Solo `--overwrite` fuerza la recarga; en producción además hace falta `SEED_ALLOW_PRODUCTION=1`, definida solo para ese comando. Hacé el `pg_dump` del § 7 de [`DEPLOY.md`](DEPLOY.md) antes (caso TC-38).

---

## 4.1 Casos del seed

TC-36 y TC-37 enseñan a cargar la base de ejemplo y comprueban que **no se puede** cargar sobre otra; TC-38 comprueba que el seed por defecto no pisa una base con contenido. Guía completa: [`DATA-POPULATION.md`](DATA-POPULATION.md) § 11.

### TC-36 — Cargar los datos de ejemplo en una base descartable ✅

**Precondición:** `docker compose up -d` (Postgres en el 5434) y una base **aparte**, vacía y migrada. Nunca la base `portfolio`.
**Pasos (PowerShell):**

```powershell
docker exec portfolio-postgres createdb -U portfolio portfolio_example
cd backend
$env:DATABASE_URL = "postgresql://portfolio:portfolio@localhost:5434/portfolio_example?schema=public"
npm run prisma:status          # tiene que decir: database "portfolio_example"
npm run prisma:deploy
$env:SEED_DISPOSABLE_DB = "1"
npm run seed:example           # se puede repetir
npm run seed:example:verify
```

**Pasos (bash):**

```bash
docker exec portfolio-postgres createdb -U portfolio portfolio_example
cd backend
export DATABASE_URL="postgresql://portfolio:portfolio@localhost:5434/portfolio_example?schema=public"
npm run prisma:status && npm run prisma:deploy
SEED_DISPOSABLE_DB=1 npm run seed:example
npm run seed:example:verify
```

**Resultado esperado:** las dos cargas salen con código 0 y la verificación coincide con el archivo. Con la API de ejemplo (`PORT=3310`) y el frontend (`VITE_PROXY_TARGET=http://localhost:3310`), la home muestra a **Alex Rivera Duarte** con las nueve secciones.

**Ejecutado** (27 de octubre de 2026):

```
$ npm run seed:example
🛡️  Base descartable confirmada: localhost:5434/portfolio_example
🌱 Iniciando seed...  (6 experiencias, 4 categorías de skills, 3 formaciones, 3 certificaciones,
   3 proyectos, 4 enlaces, 5 temas, 8 perfiles curados y 105 visitas de ejemplo)
✅ Seed completado con éxito.            exit=0
(segunda carga, sin vaciar antes)        exit=0
$ npm run seed:example:verify
  ✅ Profile 1 · Language 3 · Experience 6 · SkillCategory 4 · Skill 16 · Education 3 · Certification 3
  ✅ Project 3 · SocialLink 4 · FeaturedRepository 0 · Theme 5 · CuratedProfile 9
  ✅ CuratedProfileSlugAlias 1 · ProfileView 105
  ✅ los 8 perfiles curados: visibilidad, listed, archivado, layout, tema, secciones, alias y overrides
✅ La base coincide con el archivo de ejemplo.     exit=0
```

![Home sembrada con el ejemplo](manual/tc36-ejemplo-home.jpg)

*La home (`all`) sobre la base de ejemplo: persona ficticia, experiencias, skills y las demás secciones.*

### TC-37 — El seed de ejemplo se niega contra una base con otros datos ✅

**Precondición:** una base descartable **sembrada con `docs/cv-data.json`** (`portfolio_seedguard`, nunca `portfolio`).
**Pasos:** correr `npm run seed:example` (a) sin la variable, (b) con `SEED_DISPOSABLE_DB=1` y (c) con `NODE_ENV=production`; después `npm run seed:verify`.
**Resultado esperado:** las tres salen con código **2**, dicen cuál de las capas falló, muestran el destino como `host:puerto/base` (sin contraseña) y no escriben nada: los conteos y el `Profile` quedan como estaban.

**Ejecutado** (27 de octubre de 2026):

```
# Base descartable portfolio_seedguard, sembrada con docs/cv-data.json (1 Profile, 15 Experience, 14 CuratedProfile)

$ npm run seed:example                       (sin SEED_DISPOSABLE_DB)
❌ Negativa: no se carga el archivo alternativo en localhost:5434/portfolio_seedguard.
  - capa 1: falta SEED_DISPOSABLE_DB=1: confirma que la base de destino es descartable.
No se escribió nada.                         exit=2

$ SEED_DISPOSABLE_DB=1 npm run seed:example  (la base tiene el perfil de otra persona)
❌ Negativa: no se carga el archivo alternativo en localhost:5434/portfolio_seedguard.
  - capa 3: la base ya tiene el contenido de otro perfil (no está vacía ni es una recarga del mismo archivo).
No se escribió nada.                         exit=2

$ SEED_DISPOSABLE_DB=1 NODE_ENV=production npm run seed:example
  - capa 2: NODE_ENV=production: un archivo alternativo nunca se carga en producción.
No se escribió nada.                         exit=2

Conteos antes y después: Profile=1 · Experience=15 · CuratedProfile=14 · ProfileView=0   (sin cambios)
$ npm run seed:verify                        -> ✅ La base coincide con cv-data.json   exit=0
```

Sin captura: es salida de terminal. La capa 3 cubre el olvido más probable (`backend/.env` apunta a la base del owner y `DATABASE_URL` no se redefinió): esa base tiene otro `Profile`, así que el seed se niega aunque la variable esté puesta.

### TC-38 — El seed por defecto se niega sobre una base con contenido ✅

**Precondición:** una base **descartable** (nunca la del owner), migrada. Crear una aparte y confirmar el destino antes de escribir:

```powershell
docker exec portfolio-postgres createdb -U portfolio portfolio_seed_guard
cd backend
$env:DATABASE_URL = "postgresql://portfolio:portfolio@localhost:5434/portfolio_seed_guard?schema=public"
npm run prisma:status     # debe nombrar portfolio_seed_guard
npm run prisma:deploy
```

En bash, `export DATABASE_URL="postgresql://portfolio:portfolio@localhost:5434/portfolio_seed_guard?schema=public"` y el mismo resto.

**Pasos:**
1. `npm run seed` con la base vacía.
2. `npm run seed` otra vez.
3. `npm run seed -- --overwrite` y después `npm run seed:verify`.
4. `npm run seed -- --overwrite --file ../docs/examples/cv-data.example.json`.
5. Con `NODE_ENV=production` (PowerShell: `$env:NODE_ENV = "production"`; bash: `NODE_ENV=production npm run seed …`): `npm run seed -- --overwrite` sin más; después `SEED_ALLOW_PRODUCTION=1 npm run seed` sin `--overwrite`; por último `SEED_ALLOW_PRODUCTION=1 npm run seed -- --overwrite`.

**Resultado esperado:**
1. Código **0**: carga la base vacía sin flags ni variables.
2. Código **2**: «Negativa: no se recarga docs/cv-data.json en localhost:5434/portfolio_seed_guard: la base ya tiene contenido.», los conteos de las tablas con filas, un `pg_dump` sin contraseña, `npm run seed -- --overwrite` y «No se escribió nada.». Los conteos de la base no cambian.
3. Código **0** con el aviso «--overwrite: se borra el contenido de …»; `seed:verify` termina con **0**.
4. Código **1**: «--overwrite no se combina con --file…», sin leer el archivo ni conectarse.
5. `--overwrite` solo sale con **2** y dice que falta `SEED_ALLOW_PRODUCTION=1`; la variable sola también sale con **2**; las dos juntas salen con **0**, con el aviso marcado «en producción».

Transcripción de la ejecución del 27 de octubre de 2026 (el resto está en `openspec/changes/protect-default-seed/verification/`):

```text
> npm run seed          (base con contenido)
❌ Negativa: no se recarga docs/cv-data.json en localhost:5434/portfolio_seed_guard: la base ya tiene contenido.
  - CuratedProfile: 14
  - Theme: 5
  - Skill: 108
  …
Si querés conservarlo, respaldalo antes (pg_dump pide la contraseña):
  pg_dump "postgresql://portfolio@localhost:5434/portfolio_seed_guard" -Fc -f portfolio_seed_guard-2026-10-27.dump
Para borrarlo y recargar desde docs/cv-data.json: npm run seed -- --overwrite
No se escribió nada.
exit: 2
```

Al terminar: `docker exec portfolio-postgres dropdb -U portfolio portfolio_seed_guard`.

---

## 5. Operación

```bash
# ¿Vive y ve la base?
curl -s $API/health | jq            # 200, o 503 si Postgres no responde
curl -s $API/health/live            # 200 mientras viva el proceso, sin tocar la base

# Seguir un error concreto: cada respuesta de error trae requestId,
# y el mismo id está en la cabecera X-Request-Id y en el log.
curl -sD - $API/api/curated-profiles/no-existe -o /dev/null | grep -i x-request-id
```

| Situación | Qué hacer |
|---|---|
| Olvidaste la contraseña del admin | `npm run admin:bootstrap` con `ADMIN_PASSWORD` nuevo |
| Rotar el `JWT_SECRET` | cambiá la variable y redesplegá: invalida todas las sesiones |
| Un perfil quedó mal publicado | pasalo a `PRIVATE` (404 al instante) y arreglalo con calma |
| Perdiste datos | restaurá del backup — § 7 de [`DEPLOY.md`](DEPLOY.md) |
| Deploy roto | Rollback en Deployments, dentro de las 72 h del plan Hobby |
| El sitio dejó de cargar algo (fuente, script) tras un deploy | La CSP del servicio `web` lo bloquea. Probá con `CSP_HEADER=Content-Security-Policy-Report-Only` en `web` (solo reporta, sin bloquear; no requiere reconstruir) y mirá la consola. Detalle en `DEPLOY.md` § 9.5 |
| Una visita no suma justo después de un deploy | La visita se registra en segundo plano y el apagado espera hasta 5 s; confirmá que `RAILWAY_DEPLOYMENT_DRAINING_SECONDS` del servicio `api` esté por encima (p. ej. 10) |

### 5.1 Calidad web: accesibilidad, Lighthouse y presupuesto de JS

Tres comandos del frontend (`frontend/scripts/`), los mismos que corre el CI:

```bash
cd frontend
npm run build && npm run perf:budget                      # tope de JS del arranque público; sin navegador ni base

# Los dos siguientes abren páginas reales: cada carga registra una visita (ProfileView).
# Exigen A11Y_CHECK_DISPOSABLE_DB=1 y salen con 2 sin ella. Usalos SOLO contra una base descartable
# (p. ej. `portfolio_a11y`, con migraciones, seed y un administrador de prueba), nunca contra la del owner.
export A11Y_CHECK_DISPOSABLE_DB=1
# Con los datos de ejemplo hay que elegir el perfil base: A11Y_CHECK_PROFILE=ejemplo-backend (el valor por
# defecto es tech-lead-dotnet, de cv-data.json). Si el perfil no resuelve, sale con 2 sin abrir páginas.
A11Y_CHECK_ADMIN_EMAIL=… A11Y_CHECK_ADMIN_PASSWORD=… npm run a11y:check -- http://localhost:8080 --out reports
npm run perf:check -- http://localhost:8080 --out reports
```

Se miden contra el sitio como se sirve en producción (la imagen de `frontend/Dockerfile` con la API detrás), porque la CSP, el head por perfil y la compresión de Caddy cambian los puntajes; `vite dev` no sirve para esto. `CHROME_PATH` apunta al Chrome del sistema. Los reportes (axe en JSON, Lighthouse en HTML y JSON, resúmenes `.md`) solo se escriben con `--out`.

| Medida | Local, antes de un release | CI | ¿Bloquea? |
|---|---|---|---|
| `perf:budget` | ≤ 155 KB gzip, en **un solo** JS de módulo y sin `modulepreload` | Igual | Sí |
| axe (`a11y:check`) | 0 `serious` y 0 `critical`; el recorrido de teclado sin fallas | Igual, sobre `cv-data.json` y sobre los datos de ejemplo (dos piernas, `a11y` y `a11y-example`) | Sí |
| Lighthouse Accessibility, Best Practices y SEO (páginas públicas, mobile) | mediana de 3 ≥ 90 | mediana de 5 ≥ 90 | Sí |
| Lighthouse Performance (páginas públicas, mobile) | mediana de 3 ≥ 90 (`PERF_CHECK_RUNS`, `PERF_CHECK_MIN_PERFORMANCE`) | mediana de 5 ≥ **85** | Sí |
| `/admin/login` | Accessibility y Best Practices ≥ 90 (SEO exento: lleva `noindex`; Performance, informativa) | Igual | Sí |

El umbral de Performance es 85 en CI porque el runner de GitHub es el equipo de referencia de Lighthouse (`benchmarkIndex` ≈ 1.800: un móvil de gama media); una máquina local más rápida (≈ 4.200) infla el puntaje. Antes de `improve-mobile-performance` la vista pública medía ahí 71–76 y el umbral era 70; ahora, con el arranque en un solo archivo, el perfil en dos tiempos, los menús en diferido y Inter del propio sitio, el objetivo es ≥ 85 en las tres páginas que mide `perf:check`. Si aparecen fallas falsas se suben las corridas a 7 (`PERF_CHECK_RUNS`); el umbral no se baja sin el owner. **La medición local vale como diagnóstico solo en Linux** (por ejemplo, `ubuntu:24.04` con un Chrome fijado): con el Chrome de Windows el *Layout* cuesta unas 2,5 veces más y los números no se parecen a los del runner. La red principal contra una regresión sigue siendo el presupuesto de bytes, que no tiene ruido. `moderate` y `minor` de axe se informan sin bloquear. Una advertencia `inspector-issues` de Best Practices la dispara el propio axe al leer la hoja de Google Fonts y no se arregla abriendo la CSP.

**En CI:** el job `web-quality` (*Frontend · accesibilidad y Lighthouse*, dos ejecuciones en paralelo: `a11y` y `lighthouse`) levanta un Postgres de servicio, la API en `NODE_ENV=production` y la imagen del frontend, y corre el check. Si falla, el workflow queda en rojo y los reportes se bajan desde la corrida en *Summary → Artifacts → `web-quality-a11y` o `web-quality-lighthouse`* (14 días). Que además impida fusionar requeriría marcar esos dos checks como requeridos en la protección de `main`, y hoy no se puede: el plan gratuito de GitHub con un repositorio privado responde 403 a la protección de ramas y a los rulesets, y el owner decidió mantenerlo privado. Hasta entonces el control es de proceso: no fusionar con el workflow en rojo.

---

## 6. Suite de regresión manual

Antes de cada release, recorrer en este orden. Último caso ejecutado: **12 de noviembre de 2026** (TC-49, en la app real con la imagen de producción y Chrome controlado, y TC-50, en la app real con una base descartable: los pasos 1 a 8 en Chrome controlado y el resto por la API y `print:check`); antes, **7 de noviembre de 2026** (TC-46, por la API y en Chrome contra la imagen de producción; TC-47, en la app real con la imagen de producción, y TC-48, por la API y el contenedor `web`); antes, el 5 de noviembre (TC-45, por la API y la sesión revocada en Chrome); antes, el 4 de noviembre (TC-44, pasos 1 a 5); antes, el 29 de octubre (TC-43, TC-42 y TC-41) y el 28 de octubre (TC-39) y el 27 de octubre (TC-36 y TC-37). Corrida sobre la **base de ejemplo** (9 perfiles curados, 6 experiencias) con la API en `localhost:3310`: la suite `suite-backoffice.ps1` (TC-12 a TC-20) en verde, los recorridos R1 a R7 y R9 y los casos de lectura (TC-01 a TC-10, TC-21 a TC-27) por API, `print:check` (TC-31) y las 46 capturas con `manual:capture` (TC-43 suma una y regenera la de TC-13). TC-33, TC-34 y TC-35 conservan la evidencia del 15 de octubre (con el CV real) y no se repitieron sobre el ejemplo; detalle en `openspec/changes/add-learning-guide-and-example-data/verification/7.1-corrida.md`.

Los casos del backoffice están automatizados en [`manual/suite-backoffice.ps1`](manual/suite-backoffice.ps1): ejecuta TC-12 a TC-20 contra la API, imprime el resultado real junto al esperado y borra todos los datos de prueba que crea, pase o falle.

```bash
cd docs/manual && pwsh ./suite-backoffice.ps1
```

| # | Caso | Estado | Evidencia |
|---|---|---|---|
| TC-01 | La home resuelve el perfil completo | ✅ | captura |
| TC-02 | Idioma negociado y forzado | ✅ | captura |
| TC-03 | Un perfil curado filtra el contenido | ✅ | captura + métricas 15→7 |
| TC-04 | Tema y layout desde la URL | ✅ | captura |
| TC-05 | Menú de perfiles, solo en la home | ✅ | captura renovada · en `/:slug` no hay menú |
| TC-06 | Perfil protegido pide token | ✅ | captura |
| TC-07 | Token correcto resuelve el perfil | ✅ | captura |
| TC-08 | Slug inexistente o privado da 404 | ✅ | captura |
| TC-09 | Vista móvil | ✅ | captura |
| TC-10 | Códigos de estado por visibilidad | 🔍 | 401 / 200 / 404 |
| TC-11 | Entrar al panel | ✅ | captura del login |
| TC-12 | Crear un perfil curado | ✅ | 2 capturas · 201 / 409 / 400 (D-02 corregido) |
| TC-13 | Tags y overrides | ✅ | captura · los cuatro casos del filtro |
| TC-14 | Ordenar y ocultar secciones | ✅ | captura · orden y ocultado resueltos |
| TC-15 | Personalizar el tema | ✅ | captura · solo se guarda la diferencia |
| TC-16 | Publicar, proteger, esconder | ✅ | captura · la tabla completa de visibilidad |
| TC-17 | Previsualizar sin guardar | 🔍 | no persiste nada |
| TC-18 | Dashboard de analítica | ✅ | captura renovada con las visitas de hoy y las tablas por origen y por tipo (D-01 corregido) |
| TC-19 | Mantener experiencias | ✅ | 2 capturas · visible / oculta (D-02 corregido) |
| TC-20 | Mantener skills | ✅ | captura · la categoría entra por el tag de su skill |
| TC-21 | Duplicar un perfil | 🔍 | e2e · app real con capturas en el archivo del change |
| TC-22 | Archivar sin perder visitas | 🔍 | e2e · app real con capturas en el archivo del change |
| TC-23 | Link dirigido (`listed`) | 🔍 | e2e |
| TC-24 | Renombrar sin romper links | 🔍 | e2e |
| TC-25 | Portada: titular, disponibilidad, idiomas | ✅ | captura · e2e · 200 / 400 sin cambios · preview sin escribir |
| TC-26 | Formación: ocultar sin borrar | ✅ | captura · e2e · visible:false sale del sitio y queda en el panel |
| TC-27 | Proyectos y enlaces sociales | ✅ | captura · e2e · el proyecto entra por tags con su url · stats inválido 400 |
| TC-28 | El constructor avisa antes de descartar | ✅ | captura · app real contra el contenedor · tests del guardián |
| TC-29 | La Portada avisa; el idioma no | ✅ | captura · app real contra el contenedor · tests de `PortadaPage` |
| TC-30 | Los formularios en diálogo avisan | ✅ | captura · app real contra el contenedor · tests por formulario |
| TC-31 | Imprimir un perfil en una hoja | 🔍 | `print:check` (56 casos, 1 página en A4 y Letter) · PDF en el archivo del change · tests de la hoja y del botón |
| TC-32 | El nivel del idioma en los dos idiomas | ✅ | captura · app real contra una copia de la base · e2e · tests del formulario y del aviso |
| TC-33 | Navegación por teclado y foco visible | ✅ | `a11y:check` (recorrido de teclado) · menús y diálogos con Chrome controlado · capturas del foco en el archivo del change |
| TC-34 | Contraste con un acento oscuro | ✅ | `a11y:check` (0 violaciones en 72 cargas) · tabla de contraste por acento · tests de `css-vars` |
| TC-35 | El perfil abre rápido en un móvil | ✅ | recorrido en 375 px con Chrome controlado · una petición y una visita por carga · `perf:budget` y `perf:check` · tests de la vista, el script y los menús |
| TC-36 | Cargar los datos de ejemplo en una base descartable | ✅ | captura · salida de `seed:example` y `seed:example:verify` · dos cargas |
| TC-37 | El seed de ejemplo se niega contra una base con otros datos | ✅ | salida transcrita · código 2 en las tres capas · conteos sin cambios |
| TC-38 | El seed por defecto se niega sobre una base con contenido | ✅ | transcripción de las salidas (códigos 0, 2, 1) contra una base descartable · tests de `seed-guard` y `seed-runner` |
| TC-39 | Las visitas propias y de bots no suman | ✅ | app real con la cookie de sesión, Googlebot y sin User-Agent · e2e `view-kind` · tests del clasificador y del dashboard |
| TC-40 | Ítems ocultos e insignias legibles | ✅ | `a11y:check` con panel sobre el ejemplo (0 en 50 cargas, antes 40 nodos) y sobre `cv-data.json` (0 en 72) · tests de las filas, la insignia, la región y `css-vars` · `print:check` |
| TC-41 | Compartir un perfil con un enlace de seguimiento | ✅ | app real con la imagen de producción y Chrome no headless · e2e `share-links` y `share-links-admin` · tests de la petición temprana, del panel y del dashboard |
| TC-44 | Los buscadores leen la página de perfil | 🔍 | `curl` del HTML de la imagen de producción (público, `PROTECTED`, privado, archivado e inexistente) · Chrome sin errores de CSP · validador de schema.org sin errores · e2e del fragmento y fixture compartido · pasos 6 y 7 (Rich Results Test) tras el deploy |
| TC-48 | Exportar un perfil curado como JSON Resume | 🔍 | `curl` de la imagen de producción (público, `PROTECTED`, privado, archivado, alias y panel) · 8 archivos validados contra el schema de JSON Resume v1.0.0 · contador de visitas sin cambios · `a11y:check` con el constructor · e2e `json-resume-export` y test del constructor · pasos del panel con sesión sin ejecutar a mano |
| TC-49 | Sincronizar una integración y ver su estado | ✅ | app real con la imagen de producción y Chrome controlado (enlace desde Cuenta, Sincronizar ahora, segundo clic, refresco automático, Pausar y Reanudar) · API (422 con el proveedor pausado y con la variable de entorno, `no-store`) · formulario de credencial con la variable retirada tras el arranque · `integrations:sync` con salida 0 · `a11y:check` con panel · tests de latencia, cola, apagado y redacción |
| TC-45 | Cambiar la contraseña del panel | 🔍 | `curl` de la imagen de producción con dos sesiones (cambio, 401 de la anterior, límite y `admin:bootstrap`) · Chrome con la sesión revocada · `a11y:check` con Cuenta · e2e `admin-password` · pasos del panel con contraseñas reales sin ejecutar a mano |
| TC-46 | Registrar una postulación y ver si abrieron el enlace | ✅ | app real con la imagen de producción y Chrome controlado · API (401, 404, 422, 409, 400, CSV) · CSV abierto en Excel con las fórmulas como texto · `a11y:check` con panel · e2e `admin-applications` · tests de la pantalla, el diálogo y la descarga |
| TC-47 | Revisar la consistencia del CV | ✅ | app real con la imagen de producción y una base descartable · panel de punta a punta (resumen, Volver a revisar, Abrir, `?editar=`) · API (401, `no-store`, `locale`) · `cv:lint` con salidas 0, 1 y 2 · `a11y:check` con `/admin/revision` · e2e `cv-consistency` |
| TC-50 | Destacar repositorios de GitHub | 🔍 | app real con el `dist/` servido por Caddy y una base descartable · panel con Chrome controlado (pasos 1 a 8) · API (400, 409, 400 por `stars`, `resume.json`) · `print:check` (76 casos, una página en A4 y Letter) · `a11y:check` con panel (62 cargas, 0 violaciones) · `perf:check` · e2e `featured-repositories` · tests de la sección, de la hoja y de los bloques del panel · diálogo de impresión sin ejecutar a mano |
| TC-42 | Verificar una certificación desde el sitio | ✅ | app real con la imagen de producción y Chrome no headless · API (400 con `http://`, 200, `null`) · PDF de una página con el enlace · `print:check` (ejemplo y CV) · tests de la sección, la hoja y el panel |
| TC-43 | Ajustar skills y proyectos de un perfil | ✅ | app real con la imagen de producción y Chrome no headless · preview = ruta pública (API) · `a11y:check` con panel y axe sobre Selección · tests de las funciones puras, del constructor y del núcleo (unitarios y e2e) |

**Pasan los 43 casos anteriores, TC-46, TC-47 y TC-49; TC-44, TC-45, TC-48 y TC-50 quedan en 🔍** (change `add-featured-repositories`: TC-50 se ejecutó el 12 de noviembre de 2026 en la app real con una base descartable, con tres capturas nuevas y la regeneración de `tc27-proyectos`, `tc13-seleccion` y `tc43-overrides`; el diálogo de impresión del paso 9 no se ejecutó a mano) (change `add-integrations-foundation`: TC-49 se ejecutó el 12 de noviembre de 2026 en la app real; el formulario de credencial se recorrió con la variable de `fake` retirada tras el arranque, ver el caso) (change `add-application-tracking`: TC-46 se ejecutó completo el 7 de noviembre de 2026 en la app real con una base descartable, con la captura `bo-postulaciones`; el Dashboard de TC-18 se regeneró con la franja de postulaciones) (change `add-json-resume-export`: TC-48 se ejecutó el 7 de noviembre de 2026 en la app real con una base descartable, por la API y con el contenedor `web`; los pasos del panel con sesión no se ejecutaron a mano; sin captura nueva) (change `add-cv-consistency-rules`: TC-47 se ejecutó el 7 de noviembre de 2026 en la app real con la imagen de `frontend/Dockerfile` y una base descartable, con la captura `bo-revision` nueva y `a11y:check` con `/admin/revision`; change `add-admin-password-change`: TC-45 se ejecutó el 5 de noviembre de 2026 en la app real con una base descartable, por la API y con la sesión revocada en Chrome, con la captura `bo-cuenta`; los pasos del panel que escriben contraseñas reales no se ejecutaron a mano; change `upgrade-profile-structured-data`: pasos 1 a 5 ejecutados el 4 de noviembre de 2026 en la app real con una base descartable, sin captura; los pasos 6 y 7 piden el sitio desplegado). TC-43 (change `add-builder-skill-project-overrides`) se ejecutó el 29 de octubre de 2026 en la app real (imagen de `frontend/Dockerfile`, Chrome no headless y una base descartable), con la captura `tc43-overrides` nueva y la de `tc13-seleccion` regenerada con `manual:capture`. TC-42 (change `add-certification-verification`) se ejecutó el 29 de octubre de 2026 en la app real (imagen de `frontend/Dockerfile`, Chrome no headless y una base descartable), con la captura `tc42-credencial` nueva y la del diálogo de certificación regenerada con `manual:capture`. TC-41 (change `add-share-links`) se ejecutó el 29 de octubre de 2026 en la app real (imagen de `frontend/Dockerfile`, Chrome no headless y una base descartable), con el Dashboard de TC-18 y la captura de **Publicación** regeneradas con `manual:capture`. TC-39 (change `classify-profile-views`) se ejecutó el 28 de octubre de 2026 en la app real contra una base de ejemplo descartable, con la sesión del panel iniciada por `POST /api/auth/login`, y con los e2e de `view-kind`; el Dashboard con **Por tipo** es la captura de TC-18, regenerada con `manual:capture`. TC-36 y TC-37 (change `add-learning-guide-and-example-data`) se ejecutaron el 27 de octubre de 2026 con la salida transcrita; TC-38 (change `protect-default-seed`), el mismo día contra bases descartables, con la evidencia en `verification/` de ese change; las 46 capturas del manual salen de `npm run manual:capture` sobre la base de ejemplo. TC-40 (change `fix-admin-contrast`) se ejecutó el 28 de octubre de 2026 contra la imagen de producción del frontend y bases descartables, sin captura (es la salida de `a11y:check` y las medidas de contraste). Los 20 originales tienen evidencia: 20 capturas en `docs/manual/` más las transcripciones de la API. Las capturas de TC-05 y TC-18 se renovaron el 8 de octubre de 2026 con sesión iniciada. TC-21 a TC-24 (change `add-curated-profile-lifecycle`) están cubiertos por e2e; TC-21 y TC-22 además se ejecutaron en la app real, con capturas en el archivo del change. TC-25 a TC-27 (change `add-profile-content-admin`) suman la transcripción del e2e y su captura de la app real. TC-28 a TC-30 (change `polish-builder-and-edge`) se ejecutaron el 8 de octubre de 2026 contra el contenedor `web` con la API de la rama detrás (TC-28, TC-29 y TC-30, con captura): 27 capturas en total. TC-31 (change `add-printable-one-page`) se verificó el 9 de octubre de 2026 con `npm run print:check` contra la base del seed y con los tests de la hoja; el diálogo de impresión y Firefox quedan como pasos manuales del caso. TC-32 (change `localize-language-level`) se ejecutó el 10 de octubre de 2026 en la app real contra una copia de la base de desarrollo, con captura y transcripción en el archivo del change. TC-33 y TC-34 (change `improve-a11y-and-performance`) se ejecutaron el 15 de octubre de 2026 contra la imagen de producción del frontend y una base descartable, con `npm run a11y:check`, Chrome controlado por `puppeteer-core` y tests; la evidencia está en el archivo del change. TC-35 (change `improve-mobile-performance`) se ejecutó el 15 de octubre de 2026 contra el `dist/` del repo servido por Caddy y una base descartable; la evidencia (recorrido en 375 px, visitas y Lighthouse) está en `verification.md` de ese change.

### 6.1 Defectos encontrados al ejecutar la suite

Los dos aparecieron al ejecutar estos casos por primera vez de punta a punta. Ninguno estaba reportado. **Los dos están corregidos**; quedan documentados acá porque la suite los sigue cubriendo.

#### D-01 — El dashboard nunca muestra las visitas de hoy — ✅ corregido

**Severidad:** alta, visible para el usuario.
**Síntoma:** se compartía un link, alguien lo abría, y el dashboard seguía en cero hasta el día siguiente.
**Causa:** el parámetro `to` de `GET /api/admin/analytics/views` se interpretaba como un instante, así que `to=2026-10-05` era la medianoche de ese día. `frontend/src/features/backoffice/dashboard/ranges.ts` documenta y construye un **rango cerrado** `[hoy - (días - 1), hoy]`, de modo que el `to = hoy` del panel dejaba fuera el día en curso.

```
GET /api/admin/analytics/views?from=2026-10-05&to=2026-10-05  -> total=0    (antes)
GET /api/admin/analytics/views?from=2026-10-05&to=2026-10-06  -> total=13, byDay={2026-10-05:13}
```

**Arreglo aplicado:** el rango pasó a ser cerrado en la API, que es lo que describe la spec `admin-analytics-dashboard` y lo que el panel ya asumía. Una fecha sin hora se resuelve al borde del día en UTC — inicio para `from`, último milisegundo para `to` —; un instante completo (`2026-10-05T14:30:00Z`) se respeta tal cual, para poder pedir ventanas más finas que un día. La decisión vive en un servicio puro, `backend/src/modules/analytics/domain/services/range-boundaries.ts`, y el controller la usa en lugar de llamar a `new Date()` directamente. Se descartó la alternativa de que el frontend mandara `to = mañana`, porque deja la API mintiendo sobre su propio contrato.

**Regresión:** `range-boundaries.spec.ts` cubre los bordes del parseo, y `admin.e2e-spec.ts` agrega el caso de punta a punta — una visita nueva aparece en `?from=hoy&to=hoy`. Sin el arreglo ese caso da `total=0`. La descripción del endpoint en Swagger ahora dice que el rango es cerrado, así que `openapi.json` y los tipos del frontend se regeneraron.

#### D-02 — Omitir un objeto obligatorio devuelve 500 en lugar de 400 — ✅ corregido

**Severidad:** media; solo afecta endpoints autenticados del panel.
**Síntoma:** un cuerpo al que le falta un campo obligatorio anidado respondía `500 Error interno del servidor` en vez de un 400 que dijera qué falta.
**Causa:** los campos obligatorios de tipo objeto se declaran con `@ValidateNested()` + `@Type()` pero **sin `@IsDefined()`**. `class-validator` no valida un valor `undefined`, así que la validación pasa y el mapper revienta con `TypeError: Cannot read properties of undefined (reading 'en')`.

**Arreglo aplicado:** `@IsDefined()` en los cinco campos obligatorios de tipo objeto que había en los DTO de entrada — `role` y `summary` de `CreateExperienceDto`, `title` y `headline` de `CreateCuratedProfileDto`, y `name` de `CreateSkillCategoryDto`. Los `Update*Dto` heredan por `PartialType`, que inyecta `@IsOptional()` y corta la cadena antes de `@IsDefined()`: los PATCH parciales siguen funcionando igual. `openapi.json` no cambia, porque la obligatoriedad en Swagger ya venía de `@ApiProperty`.

Las mismas cinco variantes, tras el arreglo:

```
POST /api/admin/experiences       sin "summary"  -> 400  ["summary should not be null or undefined"]
POST /api/admin/experiences       sin "role"     -> 400  ["role should not be null or undefined"]
POST /api/admin/curated-profiles  sin "title"    -> 400  ["title should not be null or undefined"]
POST /api/admin/curated-profiles  sin "headline" -> 400  ["headline should not be null or undefined"]
POST /api/admin/skill-categories  sin "name"     -> 400  ["name should not be null or undefined"]
POST /api/admin/experiences       completo       -> 201  (control)
```

> Desde `add-profile-content-admin` (decisión D7), `headline` es **opcional**: un perfil curado sin titular propio responde 201 y su hero muestra el titular del perfil base. La línea de `headline` de arriba queda como registro del defecto; hoy esa omisión da 201.

**Regresión:** `backend/test/dto-validation.spec.ts` corre `class-validator` sobre cada DTO de entrada con las mismas opciones que `adminValidationPipe` y exige un error por cada campo obligatorio — con el cuerpo vacío, con el campo ausente y con el campo en `null` — más un control con el cuerpo completo. Es un test de comportamiento: no depende de qué decorador arregle el problema y cubre todos los campos obligatorios, no solo los anidados. Sin los `@IsDefined()` fallan 8 de sus 34 casos. Desde el PR #3 lo complementan una guarda estática en `backend/test/security.spec.ts`, que exige `@IsDefined()` en todo `@ValidateNested()` no opcional de cualquier clase validada en `src/`, y un e2e en `admin.e2e-spec.ts` que prueba las seis omisiones por HTTP.

---

## 7. Receta completa: de la vacante al link, en 6 llamadas

```bash
# 1. Crear en privado
ID=$(curl -s -X POST $API/api/admin/curated-profiles -H "$AUTH" -H 'Content-Type: application/json' -d '{
  "slug":"acme-tech-lead",
  "title":{"es":"Tech Lead .NET","en":"Tech Lead .NET"},
  "headline":{"es":"14 años en .NET y liderazgo","en":"14 years in .NET and leadership"},
  "roleType":{"es":"Tech Lead","en":"Tech Lead"},"techFocus":".NET","visibility":"PRIVATE"}' | jq -r .id)

# 2. Ver qué tags hay
curl -s $API/api/admin/experiences -H "$AUTH" | jq -r '[.[].tags[]]|unique|join(", ")'

# 3. Probar el filtro sin tocar nada
curl -s -X POST $API/api/admin/curated-profiles/preview -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"title":{"es":"x","en":"x"},"headline":{"es":"x","en":"x"},"filterTags":["dotnet"]}' \
  | jq '.experiences | length'

# 4. Aplicar filtro, secciones y tema
curl -s -X PATCH $API/api/admin/curated-profiles/$ID -H "$AUTH" -H 'Content-Type: application/json' -d '{
  "filterTags":["dotnet","leadership"],
  "sectionsOrder":["hero","experience","skills","projects","contact"],
  "sectionsHidden":["education"],
  "themeOverrides":{"colors":{"accent":"#5B2C87"}},
  "layout":"sidebar"}' > /dev/null

# 5. Publicar
curl -s -X PATCH $API/api/admin/curated-profiles/$ID -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"visibility":"PUBLIC"}' | jq .visibility

# 6. Comprobar y compartir
curl -s -o /dev/null -w '%{http_code}\n' $API/api/curated-profiles/acme-tech-lead
echo "$SITIO/acme-tech-lead"
```

**Los tres ejes, al final de la receta** (TC-16):

- La **visibilidad** decide quién puede abrirlo. `PUBLIC` para cualquiera con el link y `PROTECTED` para quien tenga el token.
- La **enumeración** decide si aparece en la home y el sitemap. Para un envío a una sola empresa, `{"listed": false}`: el link funciona igual y el perfil no queda expuesto (TC-23).
- El **archivado** decide si sigue vivo. Cuando la vacante se cierra, archivarlo: el link da 404 y las visitas se conservan (TC-22).

**Atajo:** para la próxima vacante parecida, no hace falta empezar de cero. Duplicá este perfil (TC-21) y ajustá slug, título y titular.

---

## 8. Qué falla y por qué

| Síntoma | Causa |
|---|---|
| `401` en todo el panel | la cookie expiró, o `JWT_SECRET` cambió. Volvé a entrar |
| `429` al entrar | 5 intentos por minuto y por IP. Esperá el `Retry-After` |
| El perfil ignora un `includeIds` | la experiencia tiene `visible: false`. `includeIds` solo fuerza items visibles |
| Una sección aparece aunque no la puse en el orden | tiene datos: se agrega al final. Para ocultarla, `sectionsHidden` |
| Una sección no aparece aunque la puse | no tiene datos que pasen el filtro |
| `400` al crear un perfil | campo de más o faltante: el pipe rechaza lo que no está en el DTO. El mensaje dice cuál |
| `409` al crear un perfil | el `slug` ya existe |
| El `?token=` no funciona | el perfil es `PRIVATE`, no `PROTECTED`. `PRIVATE` siempre da 404 |
| La vista previa en LinkedIn es genérica | el borde no insertó el head del perfil: la API no respondió en 500 ms y el sitio degradó al genérico, o el perfil no es `PUBLIC` (a propósito: `PROTECTED` y `PRIVATE` nunca exponen sus textos). Comprobar con `curl -s <sitio>/<slug> \| grep og:title`. La imagen es la misma para todos los perfiles; una por vacante quedó fuera del change `add-server-rendered-head` |
| El nuevo perfil no está en el sitemap | solo entran los `PUBLIC`, enumerados y no archivados. Un duplicado nace `PRIVATE` y no enumerado |
| El link que mandé da 404 | el perfil está archivado (TC-22) o es `PRIVATE`. El bloque del link en la pestaña Publicación lo advierte |
| Un perfil público no aparece en el menú | no está enumerado (`listed: false`), o se está mirando un `/:slug`: el menú solo se muestra en la home |
| Renombré un slug y el link viejo sigue respondiendo | es a propósito: el slug anterior queda como alias y redirige al nuevo (TC-24) |
| `409` al usar un slug que nadie tiene | es el slug anterior de otro perfil |
| `400` al mandar `archivedAt` | no se escribe por `PATCH`: usar `/archive` y `/unarchive` |

---

## 9. Glosario

Cada término enlaza el concepto, el recorrido o el caso donde se usa.

| Término | Qué es | Dónde se usa |
|---|---|---|
| **slug** | La parte de la URL que identifica un perfil curado (`/ejemplo-backend`). Kebab-case y único. | B9 (Constructor · Identidad), R4 (Renombrar el slug sin romper los links), TC-12 |
| **perfil base** | La información profesional única (nombre, contacto, idiomas…) de la que sale todo lo demás. | C1 (Perfil base), B3 (Portada (con Idiomas)) |
| **perfil curado** | Una vista filtrada y personalizada del perfil base, con su slug, tema y reglas. | C2 (Perfil curado), B8 (Perfiles), TC-12 |
| **`filterTags`** | Lista de tags: un ítem entra si comparte al menos uno. Vacía, entra todo. | C3 (Tags y overrides), B10 (Constructor · Selección), TC-13 |
| **`includeIds` / `excludeIds`** | Overrides de selección, con ids de experiencias, skills, proyectos y repositorios: forzar incluir (solo visibles) o excluir (siempre gana). | C3 (Tags y overrides), B10 (Constructor · Selección), TC-13, TC-43, TC-50 |
| **sección** | Cada bloque de la página; son diez y se pueden reordenar y ocultar por perfil. | C4 (Secciones), B11 (Constructor · Diseño), TC-14, TC-50 |
| **preset** | Uno de los cinco temas base (`modern-dark`, `modern-light`, `minimal`, `elegant`, `corporate`). | C5 (Tema), B11 (Constructor · Diseño), TC-15 |
| **token de diseño** | Un valor de color, tipografía o espaciado guardado en la base y aplicado como variable CSS. | C5 (Tema), B11 (Constructor · Diseño) |
| **`themeOverrides`** | Las diferencias de un perfil contra su preset; solo se guarda lo que cambió. | C5 (Tema), R5 (Ajustar el tema y el acento), TC-15 |
| **visibilidad** | `PUBLIC`, `PROTECTED` (pide token) o `PRIVATE` (404): quién puede abrir el link. | C6 (Visibilidad, enumeración y archivo), B12 (Constructor · Publicación), TC-16 |
| **`listed`** | Si el perfil se enumera en el menú, el listado y el sitemap; no cambia el acceso. | C6 (Visibilidad, enumeración y archivo), R2 (Mandarlo a una sola empresa), TC-23 |
| **archivado** | Retirado de circulación (404) conservando sus visitas; se puede desarchivar. | C6 (Visibilidad, enumeración y archivo), R3 (Retirar un perfil sin perder sus visitas), TC-22 |
| **alias de slug** | El slug anterior de un perfil renombrado, que sigue resolviendo al perfil. | R4 (Renombrar el slug sin romper los links), TC-24 |
| **`LocalizedText`** | Un texto bilingüe `{ "es": "…", "en": "…" }` en un solo registro. | C7 (Idiomas), B3 (Portada (con Idiomas)) |
| **faltante de traducción** | Un campo bilingüe sin contenido en el idioma pedido; es solo un aviso. | C7 (Idiomas), R7 (Traducir y revisar faltantes), TC-32 |
| **`ProfileView`** | El registro de una visita pública (perfil, idioma, origen, fecha, tipo, IP como HMAC). | C8 (Analítica), B2 (Dashboard), TC-18 |
| **tipo de visita** | Si la visita fue de una persona, tuya (con la sesión del panel) o de un bot; solo las de personas suman en el total y en `views`. | C8 (Analítica), B2 (Dashboard), TC-39 |
| **enlace de seguimiento** | Un link con un código propio (`?via=<código>`) para un destinatario o un portal, con etiqueta y revocación; cuenta las aperturas de personas sin depender del referrer. | C8 (Analítica), B12 (Constructor · Publicación), TC-41 |
| **portal** | El sitio donde se publica un link (`linkedin`, `indeed`…): el del enlace de seguimiento o el de `?src=<portal>`, normalizado a minúsculas, números y guiones. | C8 (Analítica), B2 (Dashboard), TC-41 |
| **apertura** | Una visita de una persona atribuida a un enlace de seguimiento; las tuyas y las de bots no cuentan. | B12 (Constructor · Publicación), TC-41 |
| **referencia huérfana** | Un id de `includeIds` o `excludeIds` que ya no corresponde a ninguna experiencia, skill ni proyecto (el ítem se borró). El sitio lo ignora; el constructor lo cuenta y deja quitarlo. | B10 (Constructor · Selección), TC-43 |
| **credencial** | Lo que acredita una certificación en el emisor: el enlace de verificación, el ID y el vencimiento, los tres opcionales. | B6 (Formación), TC-42 |
| **hallazgo** | Un dato del CV que contradice otro o una regla de la plataforma, detectado por la pantalla Revisión o por `npm run cv:lint`: lleva un código estable, una severidad y el ítem exacto. Nunca se corrige solo. | B16 (Revisión), TC-47 |
| **severidad** | Qué tan grave es un hallazgo: error (la API lo rechazaría o rompe el render), aviso (probable descuido) o sugerencia (suele ser legítimo). Solo los errores hacen fallar `cv:lint`. | B16 (Revisión), TC-47 |
| **versión de sesión** | Un número del administrador (`sessionVersion`) que el token del panel lleva como `sv`; cambiar la contraseña desde **Cuenta** o correr `admin:bootstrap` lo incrementa y los tokens con otra versión dejan de valer. | B14 (Cuenta), TC-45 |
| **repositorio destacado** | Un repositorio de GitHub que cargás a mano (nombre, URL `https://github.com/<usuario>/<repositorio>`, descripción en ES/EN, tecnologías y tags). La sección se muestra desde 2 repositorios por perfil, sale como una línea en el PDF y como `projects` con `type: "repository"` en el JSON Resume. No se sincroniza con GitHub. | B7 (Proyectos y enlaces), B10 (Constructor · Selección), TC-50 |
| **JSON Resume** | Formato abierto (v1.0.0) con el que se exporta un perfil curado, un archivo por idioma: lo que muestra la página, sin las secciones ocultas ni el año de las certificaciones. Se baja desde **Publicación**; no cuenta como visita. | B12 (Constructor · Publicación), TC-48 |
| **enlace de verificación** | La página pública de la credencial en el emisor (Credly, Accredible…); solo `https://`. El sitio lo muestra como «Ver credencial» y no comprueba que funcione. | B6 (Formación), TC-42 |
| **postulación** | Un proceso de selección que registrás en el panel: empresa, puesto, estado, fecha y, si querés, el perfil y el enlace de seguimiento que mandaste. Es privada: no se publica en ningún lado. | B15 (Postulaciones), TC-46 |
| **Abierto el** | La fecha de la primera apertura de una persona del enlace asociado a una postulación, o «Sin abrir». Las tuyas y las de bots no cuentan. | B15 (Postulaciones), TC-46 |
| **integración** | Un servicio externo con el que la plataforma se sincroniza fuera del camino de las peticiones (hoy solo `fake`, de prueba). Se habilita en el servidor con `INTEGRATIONS_ENABLED`; el panel muestra su estado y permite pausarla, sincronizarla y cargar su credencial. | B17 (Integraciones), TC-49 |
| **trabajo** | Una tarea de la cola de integraciones (por ejemplo, sincronizar un proveedor). Pasa por pendiente, en curso, hecho, con error (se reintenta con espera creciente) o fallido (no se reintenta); cada intento queda registrado. | B17 (Integraciones), TC-49 |
| **arriendo del ejecutor** | Una fila de la base que asegura que una sola instancia ejecute trabajos a la vez, incluso cuando conviven dos procesos durante un deploy. Vence sola si el proceso muere, así que nada queda trabado. | TC-49 |
| **sincronización atrasada** | Un proveedor habilitado que lleva más de 48 h sin una corrida exitosa. La tarjeta lo marca con «Sin sincronizar hace más de 48 h» y el Dashboard lo avisa; un proveedor pausado a mano no cuenta. | B17 (Integraciones), TC-49 |
