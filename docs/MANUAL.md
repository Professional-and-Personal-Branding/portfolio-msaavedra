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
| `/admin` | Dashboard de analítica, con las tablas **Por origen** y **Por tipo** |
| `/admin/portada` | Perfil base (titular, resumen, contacto, disponibilidad) e idiomas, con vista previa del hero |
| `/admin/experiencias` | CRUD de experiencias |
| `/admin/skills` | CRUD de categorías y skills |
| `/admin/formacion` | Educación y certificaciones |
| `/admin/proyectos` | Proyectos destacados y enlaces sociales |
| `/admin/perfiles` | Lista de perfiles curados |
| `/admin/perfiles/:id` | **El constructor**: Identidad, Selección, Diseño y Publicación, con preview en vivo |

---

## A. Ruta de aprendizaje

Ocho conceptos, en este orden: cada uno se apoya en el anterior. Todos los ejemplos salen de la **base de ejemplo** (`docs/examples/cv-data.example.json`, ver § 0 y `docs/DATA-POPULATION.md` § 11): una persona ficticia, sin datos reales.

### C1 — Perfil base

Es tu información profesional **una sola vez**: nombre, titular, resumen, contacto, disponibilidad e idiomas (el perfil base), más las listas de experiencias, skills, formación, certificaciones, proyectos y enlaces. Todo lo que se publica sale de acá: un perfil curado nunca guarda copias, solo decide qué mostrar.

- **En el ejemplo:** Alex Rivera Duarte y su contenido: 6 experiencias (una oculta), 4 categorías con 16 skills, 3 formaciones, 3 certificaciones, 3 proyectos y 4 enlaces.
- **Dónde se edita:** B3 (Portada (con Idiomas)), B4 (Experiencias), B5 (Skills), B6 (Formación), B7 (Proyectos y enlaces)
- **Casos que lo verifican:** TC-01, TC-25, TC-26, TC-27

### C2 — Perfil curado

Una **vista filtrada y personalizada** del perfil base, accesible por un `slug` único (`/ejemplo-backend`). Tiene su propio titular, descripción, tema, orden de secciones y reglas de selección. La home es el perfil curado `all`, que no filtra nada.

- **En el ejemplo:** `ejemplo-backend` (Java y microservicios, acento `#1A365D`) y `all` (la home con las 9 secciones).
- **Dónde se edita:** B8 (Perfiles), B9 (Constructor · Identidad)
- **Casos que lo verifican:** TC-03, TC-12, TC-21

### C3 — Tags y overrides

Cada experiencia, skill y proyecto lleva **tags**. Un perfil incluye lo que comparte al menos un tag de su `filterTags` (vacío = todo). Encima, `includeIds` fuerza la inclusión (solo de ítems visibles) y `excludeIds` fuerza la exclusión y **siempre gana**. El orden de salida es cronológico, igual para todos los perfiles.

- **En el ejemplo:** `ejemplo-overrides` fuerza una experiencia sin tags comunes (Brújula Demo), intenta forzar una oculta (se ignora), suma un proyecto y quita una experiencia y una skill que sí coincidían.
- **Dónde se edita:** B10 (Constructor · Selección)
- **Casos que lo verifican:** TC-03, TC-13, TC-20

### C4 — Secciones

La página se arma con nueve secciones: `hero`, `stats`, `experience`, `skills`, `projects`, `education`, `certifications`, `presence` y `contact`. Cada perfil puede **reordenarlas** y **ocultarlas**. Una sección con datos que no figura en el orden se agrega al final; una sin datos no se muestra.

- **En el ejemplo:** `ejemplo-secciones` reordena las nueve y oculta Estadísticas y Presencia. La home (`all`) muestra las nueve.
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

Cada carga de una ruta pública registra una **visita** (`ProfileView`): perfil, idioma, origen, fecha y **tipo**; la IP solo como HMAC. Las vistas previas del panel no cuentan. Cada visita se guarda con su tipo: *Personas*, *Tus visitas* (la petición trae la sesión del panel) y *Bots* (sin navegador reconocible: Googlebot, `HeadlessChrome`, `curl`…). **Solo las de personas suman** en el total y en las visitas de cada perfil; las otras se cuentan aparte, en **Por tipo**. Si abrís tu sitio sin la sesión del panel, cuenta como una persona más. El dashboard resume por día, perfil, idioma, origen y tipo, y los perfiles archivados conservan su historial.

- **En el ejemplo:** 105 visitas sintéticas en 5 perfiles (`all`, `ejemplo-backend`, `ejemplo-secciones`, `ejemplo-archivado`, `ejemplo-protegido`), con orígenes directo, LinkedIn, buscador y un dominio de `example.com`.
- **Dónde se edita:** B2 (Dashboard)
- **Casos que lo verifican:** TC-18, TC-39


---

## B. Recorridos por objetivo

Nueve tareas reales, con los pasos por pantalla, lo que tiene que pasar, los errores típicos y los casos que las verifican. Se ejecutaron sobre la base de ejemplo (ver `openspec/changes/add-learning-guide-and-example-data/verification/5.3-recorridos.md`).

### R1 — Preparar un perfil para una vacante

1. **Perfiles** → botón **Duplicar** en `ejemplo-backend` → confirmar (también se puede crear con **Nuevo perfil**). La copia nace privada y sin enumerar, y se abre en el constructor.
2. **Identidad**: cambiá el **Slug** (kebab-case, es la URL), el **Título** y el **Titular** en ES y EN, y el **Tipo de rol**.
3. **Selección**: activá los **Tags de filtrado** de la vacante y mirá la vista previa. Con *Incluir* o *Excluir* ajustás experiencias puntuales.
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
4. **Formación** (educación y certificaciones) y **Proyectos y enlaces**: lo mismo, con **Visible** para ocultar.
5. Recargá `/`: los cambios se ven al instante, sin correr el seed.

**Resultado esperado:** El cambio aparece en la home y en cada perfil curado que lo incluya. Lo oculto sigue en el panel con la marca *Oculto*.

**Errores típicos:** Mensajes en línea como `La empresa es obligatoria` o `Usá el formato AAAA-MM o AAAA`; ver cada pantalla. **No corras `npm run seed`** sobre una base con contenido editado: lo pisa.

**Casos:** TC-19, TC-20, TC-25, TC-26, TC-27

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
4. **Por origen** muestra de dónde llegó cada visita: `directo`, `linkedin.com`, `google.com`…
5. **Por tipo** separa *Personas*, *Tus visitas* y *Bots*: solo las de personas suman en el total.

**Resultado esperado:** Con el ejemplo y 30 días: 105 visitas, 5 perfiles vistos, 2 idiomas, y los orígenes directo, linkedin.com, google.com y empleos.example.com.

**Errores típicos:** Las visitas de hoy cuentan (defecto D-01 corregido). La vista previa del panel y la carga de otra persona de `/admin` no suman visitas. Tus propias visitas (con la sesión del panel) y las de bots tampoco suman en el total: están en **Por tipo**.

**Casos:** TC-18, TC-39


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

Para la guía y las capturas se usa un administrador de prueba (`npm run admin:bootstrap` con una contraseña aleatoria de la sesión).

![Login del backoffice](manual/tc11-login.jpg)

![Error de credenciales](manual/tc11-login-error.jpg)

### B2 — Dashboard

Ruta: `/admin`. Visitas de las vistas públicas. Rango: 7, 30 (por defecto), 90 días o el último año. Totales (de **personas**), **Visitas por día**, **Por perfil** (con enlaces al constructor y a la vista pública y la marca `archivado`), **Por idioma**, **Por origen** y **Por tipo** (*Personas*, *Tus visitas* y *Bots*, con la aclaración de que solo las de personas suman).

| Campo | Tipo | Obligatorio | Validación | Ejemplo |
|---|---|---|---|---|
| Rango | selector | Sí (30 días por defecto) | 7, 30, 90 días o último año | Últimos 30 días |

| Mensaje | Cuándo |
|---|---|
| Todavía no hay visitas | No hay visitas en el rango elegido; el texto de apoyo es «Cuando alguien abra un perfil curado en el rango elegido, aparecerá acá.» |

**Acciones y avisos:** Solo lectura. Las visitas se registran en la ruta pública, no en la vista previa del panel. Si el rango solo tiene visitas propias o de bots, el estado vacío convive con la tabla **Por tipo**; con los tres tipos en cero, aparece solo el estado vacío.

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
| Orden / Visible en el sitio | entero / interruptor | No | Orden mayor o igual a 0 | `0` · activado |

| Mensaje | Cuándo |
|---|---|
| El título en español es obligatorio | Formación sin título en español. |
| La institución es obligatoria | Institución vacía. |
| La fecha de inicio es obligatoria | Inicio vacío. |
| Usá el formato AAAA-MM o AAAA | Fecha de inicio o fin con otro formato. |
| Una formación en curso no lleva fecha de fin | En curso con fecha de fin. |
| La fecha de fin no puede ser anterior al inicio | Fin anterior al inicio. |
| El nombre en español es obligatorio | Certificación sin nombre en español. |
| El emisor es obligatorio | Emisor vacío. |
| Usá el formato AAAA | Año de una certificación con otro formato (por ejemplo `20x`). |
| El orden no puede ser negativo | Orden menor que 0. |

**Acciones y avisos:** Borrar pide confirmación. Los ocultos siguen en el panel con la marca *Oculto*.

![Formación en el panel](manual/tc26-formacion.jpg)

![Certificación con el error de año](manual/bo-formacion-certificacion.jpg)

### B7 — Proyectos y enlaces

Ruta: `/admin/proyectos`. Proyectos destacados y enlaces sociales. Un proyecto con **tags** que coincidan con los `filterTags` de un perfil aparece en él, con su **URL** como enlace.

| Campo | Tipo | Obligatorio | Validación | Ejemplo |
|---|---|---|---|---|
| Proyecto · Nombre | texto | Sí | No vacío | `Plataforma de Reservas` |
| Proyecto · Período | texto | Sí | No vacío | `2024` |
| Proyecto · Rol / Resumen | ES/EN | Sí (ES) | Español obligatorio | `Arquitecta y líder técnica` |
| Proyecto · URL | texto | No | Absoluta, con http:// o https:// | `https://reservas.example.com` |
| Proyecto · Tecnologías / Tags | chips | No | Los tags alimentan `filterTags` | `java` · `microservices` |
| Proyecto · Orden / Visible en el portafolio | entero / interruptor | No | Orden entero mayor o igual a 0 | `0` · activado |
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
| La plataforma es obligatoria | Enlace sin plataforma. |
| Solo minúsculas, dígitos y guiones (por ejemplo, github) | Plataforma con mayúsculas, espacios u otros símbolos. |
| El usuario es obligatorio | Enlace sin usuario. |
| La URL es obligatoria | Enlace sin URL. |
| La etiqueta en español es obligatoria | Enlace sin etiqueta en español. |
| Si cargás la traducción, completá también la descripción en español | Descripción solo en inglés. |
| Las estadísticas deben ser un objeto JSON, por ejemplo {"repos": 67} | Estadísticas con un JSON que no es un objeto o con JSON roto. |
| El orden debe ser un entero | Orden con decimales. |

**Acciones y avisos:** Borrar pide confirmación («Se borrará "…". Esta acción no se puede deshacer.» para un proyecto). Un JSON inválido en estadísticas cuenta como cambio y bloquea el envío.

![Proyectos y enlaces sociales](manual/tc27-proyectos.jpg)

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

Ruta: `/admin/perfiles/:id`. Qué entra en el perfil. Los **Tags de filtrado** se activan como chips (abajo, los tags disponibles en los datos). Cada experiencia lleva **Incluir** y **Excluir**.

| Campo | Tipo | Obligatorio | Validación | Ejemplo |
|---|---|---|---|---|
| Tags de filtrado | chips | No | Sin tags entran todas las experiencias visibles | `java` · `microservices` |
| Incluir (por experiencia) | botón | No | Fuerza la inclusión; solo de ítems visibles | Brújula Demo en `ejemplo-overrides` |
| Excluir (por experiencia) | botón | No | Fuerza la exclusión; siempre gana | Atlas Demo en `ejemplo-overrides` |

**Acciones y avisos:** **Limitación vigente:** incluir y excluir en el panel cubre **solo experiencias**. Para forzar o quitar skills y proyectos hay que usar la API (`includeIds` / `excludeIds` con los ids de skills y proyectos). La vista previa se recalcula con cada clic.

Los ítems con `visible: false` nunca entran, ni forzándolos: en `ejemplo-overrides`, Terracota Demo (oculta) no aparece aunque esté en `includeRefs`.

![Constructor, pestaña Selección](manual/tc13-seleccion.jpg)

### B11 — Constructor · Diseño

Ruta: `/admin/perfiles/:id`. Layout, **Secciones** (un interruptor de visibilidad y las flechas **Subir** y **Bajar** por cada una de las nueve) y el customizador de **Tema**: tema base, ocho colores, fuentes, densidad y efectos. Solo se guardan las diferencias contra el tema base en `themeOverrides`.

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

Ruta: `/admin/perfiles/:id`. Los tres ejes: **Visibilidad**, **Enumerar en la home y el sitemap** y **Archivado**, más el **Link público** (copiar y abrir) y el aviso de faltantes de traducción.

| Campo | Tipo | Obligatorio | Validación | Ejemplo |
|---|---|---|---|---|
| Visibilidad | selector | Sí | Público, Protegido o Privado | Protegido en `ejemplo-protegido` |
| Token de acceso | texto | Sí si es Protegido | No vacío | `ejemplo-token-2026` |
| Enumerar en la home y el sitemap | interruptor | No (activado) | No cambia el acceso: un no enumerado abre por su link | Apagado en `ejemplo-dirigido` |
| Archivado | botón | — | Archivar pide confirmar; Desarchivar es directo | `ejemplo-archivado` |
| Link público | solo lectura | — | Copiar y Abrir; avisa si no resuelve | `/ejemplo-borrador` |

| Mensaje | Cuándo |
|---|---|
| Un perfil protegido necesita un token de acceso | Visibilidad Protegido sin token. |
| Este link no resuelve: un perfil privado responde 404. Usalo para borradores. | Aviso bajo el link de un perfil privado. |
| Este link no resuelve: el perfil está archivado y responde 404. | Aviso bajo el link de un perfil archivado. |
| Archivar perfil curado | Título del diálogo de **Archivar**. |
| El link deja de funcionar (responde 404) y el perfil sale del listado y del sitemap. Las visitas se conservan y siguen en el dashboard. Se puede desarchivar. | Texto del diálogo de **Archivar**. |

**Acciones y avisos:** **Archivar** → confirmar. **Desarchivar** vuelve al estado anterior. El aviso de faltantes (`Falta 1 traducción en EN`) vive acá, bajo el link.

![Constructor, pestaña Publicación](manual/tc16-publicacion.jpg)

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

---

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
4. En `/admin`: el primer Tab es **Saltar al contenido**; con Enter, el siguiente Tab entra al contenido de la pantalla y no al menú lateral.
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

*Pestaña Identidad, con la vista previa en vivo a la derecha: `2 experiencias · 3 categorías · 1 proyectos` ya filtradas (en `ejemplo-backend`).*

Los campos que no mandás toman su valor por defecto: `filterTags`, `includeIds`, `excludeIds`, `sectionsOrder` y `sectionsHidden` vacíos, `layout` en `classic`, `visibility` en `PUBLIC`.

> **Nota.** `accentColor` se retiró en el change `retire-accent-color`: ya no existe en la API y un cuerpo que lo traiga responde 400. El acento de un perfil es `themeOverrides.colors.accent` (TC-15).

### TC-13 — Elegir qué entra con tags y overrides ✅

Tres mecanismos, en este orden:

| Mecanismo | Efecto |
|---|---|
| `filterTags` | Entra el item que comparta **al menos un** tag. **Vacío = entra todo** |
| `includeIds` | Fuerza la inclusión. Solo funciona con items **visibles** |
| `excludeIds` | Fuerza la exclusión. **Siempre gana**, incluso sobre `includeIds` |

**Pasos:** pestaña **Selección** → los tags disponibles aparecen como chips (clic para activar o desactivar) y cada experiencia tiene los botones *Incluir* y *Excluir*. El preview de la derecha se recalcula con cada clic.

**Resultado esperado:** el preview refleja el filtro. Varios clics seguidos se acumulan: cada uno parte del estado anterior, no del render inicial.

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

### TC-14 — Ordenar y ocultar secciones ✅

Las nueve secciones conocidas: `hero`, `stats`, `experience`, `skills`, `projects`, `education`, `certifications`, `presence`, `contact`.

**Pasos:** pestaña **Diseño**, bloque *Secciones*: cada fila tiene un interruptor de visibilidad y las flechas **Subir** y **Bajar**.

**Resultado esperado:** el preview respeta el orden y el ocultado. Dos reglas que conviene conocer:

- Una sección **con datos** que no figure en `sectionsOrder` **se agrega al final**. Para ocultarla hay que ponerla en `sectionsHidden`.
- Una sección **sin datos** no se renderiza aunque esté en el orden.

![Pestaña Diseño con las secciones](manual/tc14-secciones.jpg)

*Las nueve secciones de `ejemplo-secciones`, reordenadas, con **Estadísticas** y **Presencia** apagadas.*

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

*Capturada el 27 de octubre de 2026 sobre la base de ejemplo, con sesión iniciada: 105 visitas en 30 días, en 5 perfiles y 2 idiomas (el archivado conserva las suyas). Las cinco tablas: por día, por perfil, por idioma, por origen y por tipo.*

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
A11Y_CHECK_ADMIN_EMAIL=… A11Y_CHECK_ADMIN_PASSWORD=… npm run a11y:check -- http://localhost:8080 --out reports
npm run perf:check -- http://localhost:8080 --out reports
```

Se miden contra el sitio como se sirve en producción (la imagen de `frontend/Dockerfile` con la API detrás), porque la CSP, el head por perfil y la compresión de Caddy cambian los puntajes; `vite dev` no sirve para esto. `CHROME_PATH` apunta al Chrome del sistema. Los reportes (axe en JSON, Lighthouse en HTML y JSON, resúmenes `.md`) solo se escriben con `--out`.

| Medida | Local, antes de un release | CI | ¿Bloquea? |
|---|---|---|---|
| `perf:budget` | ≤ 155 KB gzip, en **un solo** JS de módulo y sin `modulepreload` | Igual | Sí |
| axe (`a11y:check`) | 0 `serious` y 0 `critical`; el recorrido de teclado sin fallas | Igual | Sí |
| Lighthouse Accessibility, Best Practices y SEO (páginas públicas, mobile) | mediana de 3 ≥ 90 | mediana de 5 ≥ 90 | Sí |
| Lighthouse Performance (páginas públicas, mobile) | mediana de 3 ≥ 90 (`PERF_CHECK_RUNS`, `PERF_CHECK_MIN_PERFORMANCE`) | mediana de 5 ≥ **85** | Sí |
| `/admin/login` | Accessibility y Best Practices ≥ 90 (SEO exento: lleva `noindex`; Performance, informativa) | Igual | Sí |

El umbral de Performance es 85 en CI porque el runner de GitHub es el equipo de referencia de Lighthouse (`benchmarkIndex` ≈ 1.800: un móvil de gama media); una máquina local más rápida (≈ 4.200) infla el puntaje. Antes de `improve-mobile-performance` la vista pública medía ahí 71–76 y el umbral era 70; ahora, con el arranque en un solo archivo, el perfil en dos tiempos, los menús en diferido y Inter del propio sitio, el objetivo es ≥ 85 en las tres páginas que mide `perf:check`. Si aparecen fallas falsas se suben las corridas a 7 (`PERF_CHECK_RUNS`); el umbral no se baja sin el owner. **La medición local vale como diagnóstico solo en Linux** (por ejemplo, `ubuntu:24.04` con un Chrome fijado): con el Chrome de Windows el *Layout* cuesta unas 2,5 veces más y los números no se parecen a los del runner. La red principal contra una regresión sigue siendo el presupuesto de bytes, que no tiene ruido. `moderate` y `minor` de axe se informan sin bloquear. Una advertencia `inspector-issues` de Best Practices la dispara el propio axe al leer la hoja de Google Fonts y no se arregla abriendo la CSP.

**En CI:** el job `web-quality` (*Frontend · accesibilidad y Lighthouse*, dos ejecuciones en paralelo: `a11y` y `lighthouse`) levanta un Postgres de servicio, la API en `NODE_ENV=production` y la imagen del frontend, y corre el check. Si falla, el workflow queda en rojo y los reportes se bajan desde la corrida en *Summary → Artifacts → `web-quality-a11y` o `web-quality-lighthouse`* (14 días). Que además impida fusionar requeriría marcar esos dos checks como requeridos en la protección de `main`, y hoy no se puede: el plan gratuito de GitHub con un repositorio privado responde 403 a la protección de ramas y a los rulesets, y el owner decidió mantenerlo privado. Hasta entonces el control es de proceso: no fusionar con el workflow en rojo.

---

## 6. Suite de regresión manual

Antes de cada release, recorrer en este orden. Último caso ejecutado: **28 de octubre de 2026** (TC-39); antes, el 27 de octubre (TC-36 y TC-37). Corrida sobre la **base de ejemplo** (9 perfiles curados, 6 experiencias) con la API en `localhost:3310`: la suite `suite-backoffice.ps1` (TC-12 a TC-20) en verde, los recorridos R1 a R7 y R9 y los casos de lectura (TC-01 a TC-10, TC-21 a TC-27) por API, `print:check` (TC-31) y las 44 capturas con `manual:capture`. TC-33, TC-34 y TC-35 conservan la evidencia del 15 de octubre (con el CV real) y no se repitieron sobre el ejemplo; detalle en `openspec/changes/add-learning-guide-and-example-data/verification/7.1-corrida.md`.

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

**Los 39 casos pasan.** TC-39 (change `classify-profile-views`) se ejecutó el 28 de octubre de 2026 en la app real contra una base de ejemplo descartable, con la sesión del panel iniciada por `POST /api/auth/login`, y con los e2e de `view-kind`; el Dashboard con **Por tipo** es la captura de TC-18, regenerada con `manual:capture`. TC-36 y TC-37 (change `add-learning-guide-and-example-data`) se ejecutaron el 27 de octubre de 2026 con la salida transcrita; TC-38 (change `protect-default-seed`), el mismo día contra bases descartables, con la evidencia en `verification/` de ese change; las 44 capturas del manual salen de `npm run manual:capture` sobre la base de ejemplo. Los 20 originales tienen evidencia: 20 capturas en `docs/manual/` más las transcripciones de la API. Las capturas de TC-05 y TC-18 se renovaron el 8 de octubre de 2026 con sesión iniciada. TC-21 a TC-24 (change `add-curated-profile-lifecycle`) están cubiertos por e2e; TC-21 y TC-22 además se ejecutaron en la app real, con capturas en el archivo del change. TC-25 a TC-27 (change `add-profile-content-admin`) suman la transcripción del e2e y su captura de la app real. TC-28 a TC-30 (change `polish-builder-and-edge`) se ejecutaron el 8 de octubre de 2026 contra el contenedor `web` con la API de la rama detrás (TC-28, TC-29 y TC-30, con captura): 27 capturas en total. TC-31 (change `add-printable-one-page`) se verificó el 9 de octubre de 2026 con `npm run print:check` contra la base del seed y con los tests de la hoja; el diálogo de impresión y Firefox quedan como pasos manuales del caso. TC-32 (change `localize-language-level`) se ejecutó el 10 de octubre de 2026 en la app real contra una copia de la base de desarrollo, con captura y transcripción en el archivo del change. TC-33 y TC-34 (change `improve-a11y-and-performance`) se ejecutaron el 15 de octubre de 2026 contra la imagen de producción del frontend y una base descartable, con `npm run a11y:check`, Chrome controlado por `puppeteer-core` y tests; la evidencia está en el archivo del change. TC-35 (change `improve-mobile-performance`) se ejecutó el 15 de octubre de 2026 contra el `dist/` del repo servido por Caddy y una base descartable; la evidencia (recorrido en 375 px, visitas y Lighthouse) está en `verification.md` de ese change.

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
| **`includeIds` / `excludeIds`** | Overrides de selección: forzar incluir (solo visibles) o excluir (siempre gana). | C3 (Tags y overrides), B10 (Constructor · Selección), TC-13 |
| **sección** | Cada bloque de la página; son nueve y se pueden reordenar y ocultar por perfil. | C4 (Secciones), B11 (Constructor · Diseño), TC-14 |
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
