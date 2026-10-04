# MANUAL — Uso de la plataforma, caso por caso

> Cómo se **usa** el portafolio una vez desplegado: cada caso con sus pasos en el panel y el `curl` equivalente, para poder hacer lo mismo sin interfaz.
>
> Para desplegar: [`DEPLOY-RAILWAY.md`](DEPLOY-RAILWAY.md) (guía corta) y [`DEPLOY.md`](DEPLOY.md) (referencia). Este documento empieza donde terminan esos.

---

## Mapa de la plataforma

**Público** — sin autenticación:

| Ruta | Qué es |
|---|---|
| `/` | La home. Es el perfil curado con slug `all` |
| `/:slug` | Un perfil curado. Ej. `/tech-lead-dotnet`, `/devops-azure` |
| cualquier otra | 404 propio |
| `/robots.txt`, `/sitemap.xml` | Los genera el backend con los perfiles `PUBLIC` del momento |

**Parámetros de URL** (viven en la URL, nunca en `localStorage` — se pueden compartir):

| Parámetro | Valores | Para qué |
|---|---|---|
| `?lang=` | `es`, `en` | Idioma. La API también acepta `?locale=`, que tiene prioridad. Sin ninguno: `Accept-Language` y después `es` |
| `?theme=` | `modern-dark`, `modern-light`, `minimal`, `elegant`, `corporate` | Preset visual. Por defecto `modern-dark` |
| `?layout=` | `classic`, `sidebar` | Estructura. Por defecto `classic` |
| `?token=` | el token del perfil | Solo para perfiles `PROTECTED` |

**Panel** — en `/admin`, detrás de la cookie de sesión:

| Ruta | Pantalla |
|---|---|
| `/admin/login` | Entrada |
| `/admin` | Dashboard de analítica |
| `/admin/experiencias` | CRUD de experiencias |
| `/admin/skills` | CRUD de categorías y skills |
| `/admin/perfiles` | Lista de perfiles curados |
| `/admin/perfiles/:id` | **El constructor**: filtros, secciones, tema y preview en vivo |

**API** — 32 operaciones. Para explorarlas, `GET /api/docs` (solo si `ENABLE_API_DOCS=true`).

---

## Preparar la sesión para los `curl`

El panel usa una cookie httpOnly, pero la API también acepta `Authorization: Bearer`. Para la consola conviene el token:

```bash
API=https://portafolio.com          # o http://localhost:3300 en desarrollo

TOKEN=$(curl -s -X POST $API/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"tu@email.com","password":"tu-password"}' | jq -r '.accessToken')

AUTH="Authorization: Bearer $TOKEN"
curl -s $API/api/auth/me -H "$AUTH" | jq    # debe devolver tu usuario
```

> El login está limitado a 5 intentos por minuto y por IP. Si ves un `429`, mirá el `Retry-After`.

---

## Caso 1 — Entrar y salir del panel

**En el panel:** `/admin` → te redirige a `/admin/login` → email y contraseña → entrás al Dashboard. El botón de salir cierra la sesión y vuelve al login.

La sesión no se guarda en el navegador: la cookie es httpOnly y el estado se deriva de `GET /api/auth/me`. Si la cookie expira (`JWT_EXPIRES_IN`, por defecto `1d`), el panel te devuelve al login en la siguiente petición.

```bash
curl -s -X POST $API/api/auth/logout -H "$AUTH"
```

---

## Caso 2 — Crear un perfil curado para una vacante concreta

El caso estrella. Supongamos una vacante de **Tech Lead .NET en Acme**.

**En el panel:**

1. `/admin/perfiles` → **Nuevo perfil**.
2. Completá la identidad:
   - **slug** — `acme-tech-lead` (kebab-case, único: es la URL).
   - **title** — ES y EN. Es el `<title>` y el encabezado.
   - **headline** — ES y EN. La frase de posicionamiento.
   - **description** — opcional, ES y EN. Es la meta description y el texto de OpenGraph.
   - **roleType** — ES y EN. Agrupa el menú de perfiles (ej. "Tech Lead").
   - **techFocus** — `.NET`. La tecnología destacada que se muestra en el menú.
3. Guardá. Ya tenés el perfil; los pasos 3 a 7 lo afinan.

**Por API:**

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
}' | jq '{id, slug}'
```

> **Truco:** crealo en `PRIVATE` y pasalo a `PUBLIC` recién cuando esté listo (caso 7). Un `PRIVATE` devuelve 404, así que nadie lo encuentra mientras lo armás.

Los campos que no mandás toman su valor por defecto: `filterTags`, `includeIds`, `excludeIds`, `sectionsOrder` y `sectionsHidden` quedan vacíos, `accentColor` en `#1A365D`, `layout` en `classic`, `visibility` en `PUBLIC`.

---

## Caso 3 — Elegir qué experiencias, skills y proyectos se muestran

Tres mecanismos, y se aplican en este orden:

| Mecanismo | Efecto |
|---|---|
| `filterTags` | Entra el item que comparta **al menos un** tag. **Vacío = entra todo** |
| `includeIds` | Fuerza la inclusión de un item, aunque no comparta tags. Solo funciona con items visibles |
| `excludeIds` | Fuerza la exclusión. **Siempre gana**, incluso sobre `includeIds` |

**En el panel**, dentro del constructor: los tags disponibles aparecen como chips — clic para activar o desactivar. Debajo, la lista de experiencias con dos botones por fila, *Incluir* y *Excluir*. El preview de la derecha se actualiza con cada clic.

**Por API:**

```bash
ID=<el id del perfil>
curl -s -X PATCH $API/api/admin/curated-profiles/$ID -H "$AUTH" \
  -H 'Content-Type: application/json' -d '{
  "filterTags": ["dotnet", "leadership", "architecture"],
  "includeIds": ["<id-de-una-experiencia-que-quiero-si-o-si>"],
  "excludeIds": ["<id-de-algo-que-no-aplica-a-esta-vacante>"]
}' | jq '{filterTags, includeIds, excludeIds}'
```

El orden de salida siempre es cronológico: `startDate` descendente, y `order` ascendente como desempate. No se puede reordenar item por item — es deliberado, para que todos los perfiles cuenten la historia en el mismo sentido.

Para ver los tags que existen:

```bash
curl -s $API/api/admin/experiences -H "$AUTH" | jq -r '[.[].tags[]] | unique | join(", ")'
```

---

## Caso 4 — Ordenar y ocultar secciones

Las nueve secciones conocidas: `hero`, `stats`, `experience`, `skills`, `projects`, `education`, `certifications`, `presence`, `contact`.

**En el panel**, bloque *Secciones*: cada fila tiene un interruptor de visibilidad y las flechas de **Subir** y **Bajar**.

**Por API:**

```bash
curl -s -X PATCH $API/api/admin/curated-profiles/$ID -H "$AUTH" \
  -H 'Content-Type: application/json' -d '{
  "sectionsOrder": ["hero", "experience", "skills", "projects", "stats", "contact"],
  "sectionsHidden": ["education", "certifications"]
}' | jq '{sectionsOrder, sectionsHidden}'
```

Dos reglas que conviene conocer:

- Una sección **con datos** que no figure en `sectionsOrder` **se agrega al final**. No desaparece por omitirla: para ocultarla hay que ponerla en `sectionsHidden`.
- Una sección **sin datos** no se renderiza aunque esté en el orden. Si `projects` no tiene proyectos que pasen el filtro, no aparece.

---

## Caso 5 — Personalizar el tema

Dos niveles: elegir un preset, o ajustarlo token por token.

**En el panel**, bloque *Tema* del constructor:

1. **Tema base** — uno de los cinco presets.
2. **Colores** — ocho controles: Fondo, Fondo suave, Tarjeta, Borde, Texto, Texto tenue, Acento y Acento 2. Aceptan hex.
3. **Densidad** — Compacta, Cómoda o Amplia.
4. **Restablecer** — vuelve al preset y borra los ajustes.

Los cambios se ven al instante porque los tokens se aplican como variables CSS `--t-*` en el contenedor del preview, no en el documento. Y **solo se guardan las diferencias** contra el tema base, en `themeOverrides`: si mañana cambia el preset, tu perfil hereda la mejora y conserva su ajuste.

**Por API:**

```bash
curl -s $API/api/admin/themes -H "$AUTH" | jq -r '.[] | "\(.id)  \(.slug)"'

curl -s -X PATCH $API/api/admin/curated-profiles/$ID -H "$AUTH" \
  -H 'Content-Type: application/json' -d '{
  "themeId": "<id-del-tema-base>",
  "themeOverrides": { "colors": { "accent": "#5B2C87" }, "density": "compact" }
}' | jq '{themeId, themeOverrides}'
```

---

## Caso 6 — Elegir el layout

`classic` (una columna, secciones apiladas) o `sidebar` (navegación lateral fija).

**En el panel:** selector *Layout*, arriba del bloque de secciones.

```bash
curl -s -X PATCH $API/api/admin/curated-profiles/$ID -H "$AUTH" \
  -H 'Content-Type: application/json' -d '{"layout": "sidebar"}' | jq .layout
```

El visitante puede probar el otro con `?layout=sidebar` sin que cambie lo que guardaste. Útil para decidir: abrí el perfil con los dos y comparalo.

---

## Caso 7 — Publicar, proteger o esconder

Tres visibilidades, y cada una se comporta distinto a propósito:

| Visibilidad | Sin token | Con token | En el sitemap |
|---|---|---|---|
| `PUBLIC` | 200 | — | **Sí** |
| `PROTECTED` | **401** | 200 | No |
| `PRIVATE` | **404** | 404 | No |

`PRIVATE` devuelve 404 y no 403 **a propósito**: un 403 confirmaría que el slug existe. Un 404 no revela nada.

**En el panel:** selector *Visibilidad*. Al elegir `PROTECTED` aparece el campo del token, que pasa a ser obligatorio.

```bash
# Publicar
curl -s -X PATCH $API/api/admin/curated-profiles/$ID -H "$AUTH" \
  -H 'Content-Type: application/json' -d '{"visibility":"PUBLIC"}' | jq .visibility

# Proteger con token
curl -s -X PATCH $API/api/admin/curated-profiles/$ID -H "$AUTH" \
  -H 'Content-Type: application/json' \
  -d "{\"visibility\":\"PROTECTED\",\"accessToken\":\"$(openssl rand -hex 16)\"}" | jq '{visibility, accessToken}'
```

Y la comprobación, que vale la pena hacer siempre después de proteger algo:

```bash
curl -s -o /dev/null -w 'sin token: %{http_code}\n' $API/api/curated-profiles/acme-tech-lead
curl -s -o /dev/null -w 'con token: %{http_code}\n' "$API/api/curated-profiles/acme-tech-lead?token=EL-TOKEN"
```

El token viaja en `?token=` o en la cabecera `X-Access-Token`. En los logs el `?token=` sale **censurado**, y la cabecera `Referrer-Policy: no-referrer` evita que se filtre al navegar a un link externo.

---

## Caso 8 — Previsualizar sin guardar

El preview del constructor **no lo calcula el navegador**: lo resuelve el backend con el mismo servicio que la ruta pública (`CuratedProfileComposer`), para que no puedan divergir. Lo que ves es lo que va a ver el reclutador.

```bash
curl -s -X POST $API/api/admin/curated-profiles/preview -H "$AUTH" \
  -H 'Content-Type: application/json' -d '{
  "title":    { "es": "Prueba", "en": "Test" },
  "headline": { "es": "Probando filtros", "en": "Testing filters" },
  "filterTags": ["dotnet"],
  "layout": "sidebar"
}' | jq '{experiencias: (.experiences | length), skills: (.skillCategories | length), secciones: .sections}'
```

> Cuidado con los nombres: lo que **mandás** usa `sectionsOrder` y `sectionsHidden`; lo que **vuelve resuelto** trae `sections` (ya ordenadas y filtradas) y `hiddenSections`. Es la diferencia entre la configuración y el resultado.

No persiste nada. Sirve para tantear un filtro antes de tocar un perfil que ya está publicado.

---

## Caso 9 — Compartir el link

Lo que mandás por LinkedIn o por mail:

```
https://portafolio.com/acme-tech-lead                    # como lo guardaste
https://portafolio.com/acme-tech-lead?lang=en            # en inglés
https://portafolio.com/acme-tech-lead?token=EL-TOKEN     # si es PROTECTED
https://portafolio.com/acme-tech-lead?lang=en&theme=corporate&layout=sidebar
```

Qué ve el visitante: el perfil con su tema y su layout, un selector de idioma, y el menú de los otros perfiles **públicos** agrupados por `roleType` con su `techFocus`.

> **Limitación conocida, importante al compartir:** los metadatos (título, descripción, OpenGraph, JSON-LD) se escriben en el cliente. Google ejecuta JavaScript y los ve; **LinkedIn, WhatsApp y Slack no**, así que la vista previa del link muestra los datos genéricos del portafolio y no los del perfil. Está anotado para 1.1 y requiere SSR o prerender por bot.

---

## Caso 10 — Medir qué pasó con los links

**En el panel:** `/admin` es el dashboard.

- **Rango:** Últimos 7 días, 30 (por defecto), 90, o el último año.
- **Totales:** Visitas en el rango · Perfiles vistos · Idiomas.
- **Tablas:** por día, por perfil (con enlace al constructor y a la vista pública) y por idioma.

```bash
curl -s "$API/api/admin/analytics/views?from=2026-09-01&to=2026-10-04" -H "$AUTH" | jq '{
  total,
  porPerfil: [.byProfile[] | {slug, views}],
  porIdioma: .byLocale
}'
```

Qué se guarda de cada visita: el perfil, el idioma, la fecha y la IP **solo como HMAC** con `ANALYTICS_SALT`. No hay cookies de seguimiento ni IP en claro. Las visitas se registran únicamente en la ruta pública, nunca en el preview del panel, y si el registro falla la respuesta al visitante no se altera.

---

## Caso 11 — Mantener las experiencias

**En el panel:** `/admin/experiencias`. **Nueva experiencia** abre el formulario:

| Campo | Notas |
|---|---|
| Empresa * | plano, no se traduce |
| Ubicación * | plano |
| Rol | **bilingüe**: una pestaña ES y una EN |
| Resumen, logros | bilingües |
| Inicio * / Fin | si marcás *Actual*, Fin queda vacío |
| Orden | desempate cuando dos comparten `startDate` |
| Tecnologías, tags, sector | listas de chips. **Los tags son los que usa `filterTags`** |
| Visible en el portafolio | si lo apagás, no aparece en ningún perfil, ni forzándolo con `includeIds` |

```bash
curl -s -X POST $API/api/admin/experiences -H "$AUTH" \
  -H 'Content-Type: application/json' -d '{
  "company": "Acme",
  "location": "Santiago, Chile",
  "role": { "es": "Tech Lead", "en": "Tech Lead" },
  "startDate": "2024-01-01",
  "current": true,
  "technologies": [".NET", "Azure"],
  "tags": ["dotnet", "leadership"],
  "visible": true
}' | jq '{id, company}'
```

> Al agregar un tag nuevo, aparece solo como chip en el constructor de todos los perfiles. Es la forma más rápida de abrir una dimensión de filtrado nueva.

---

## Caso 12 — Mantener skills y categorías

**En el panel:** `/admin/skills`. Las skills viven dentro de categorías.

1. **Nueva categoría** — nombre bilingüe y orden.
2. Dentro de cada categoría, **Nueva skill** — nombre, tags, orden.
3. Una skill se puede **mover de categoría** editando su campo de categoría.
4. Borrar una categoría **borra sus skills**. El panel lo confirma antes.

```bash
CAT=$(curl -s -X POST $API/api/admin/skill-categories -H "$AUTH" \
  -H 'Content-Type: application/json' \
  -d '{"name":{"es":"Plataforma","en":"Platform"},"order":5}' | jq -r .id)

curl -s -X POST $API/api/admin/skill-categories/$CAT/skills -H "$AUTH" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Railway","tags":["devops","cloud"],"order":1}' | jq '{id, name}'
```

Una categoría entra en un perfil curado si **alguna de sus skills** comparte un tag con `filterTags`; dentro, se muestran solo las skills que pasan el filtro.

---

## Caso 13 — Lo que hoy NO se administra desde el panel

Hay que saberlo antes de necesitarlo. Estas entidades existen, se muestran en el sitio y **solo se cargan por seed**:

| Entidad | Dónde se edita hoy |
|---|---|
| Perfil base (nombre, headline, resumen, contacto, foto) | `docs/cv-data.json` → `npm run seed` |
| Educación | ídem |
| Certificaciones | ídem |
| Proyectos destacados | ídem |
| Enlaces sociales | ídem |
| Temas (los cinco presets) | ídem |

El procedimiento para cambiar cualquiera de ellas:

```bash
# 1. Editar docs/cv-data.json
# 2. Recargar (CUIDADO: sobrescribe el contenido del portafolio)
cd backend && railway run npm run seed && railway run npm run seed:verify
```

> `seed` **sobrescribe**. No borra perfiles curados creados desde el panel, pero sí reemplaza el contenido que administra. Antes de correrlo en producción, hacé el `pg_dump` del § 7 del runbook.

Esto es la deuda más visible del producto: cinco entidades sin CRUD. Es candidata número uno de la próxima fase.

---

## Caso 14 — Operar: salud, logs y recuperación

```bash
# ¿Vive y ve la base?
curl -s $API/health | jq            # 200, o 503 si Postgres no responde
curl -s $API/health/live            # 200 mientras viva el proceso, sin tocar la base

# Seguir un error concreto: cada respuesta de error trae requestId,
# y el mismo id está en la cabecera X-Request-Id y en el log.
curl -sD - $API/api/curated-profiles/no-existe -o /dev/null | grep -i x-request-id
```

Con ese `requestId` buscás en los logs del panel de Railway la petición exacta. Los logs son JSON; de cada petición se guardan solo id, método y URL, con el `?token=` censurado — nunca cuerpos ni cabeceras, así que no hay credenciales en los logs.

| Situación | Qué hacer |
|---|---|
| Olvidaste la contraseña del admin | `railway run npm run admin:bootstrap` con `ADMIN_PASSWORD` nuevo |
| Rotar el `JWT_SECRET` | cambiá la variable y redesplegá: invalida todas las sesiones |
| Un perfil quedó mal publicado | pasalo a `PRIVATE` (devuelve 404 al instante) y arreglalo con calma |
| Perdiste datos | restaurá del backup — § 7 de [`DEPLOY.md`](DEPLOY.md) |
| Deploy roto | Rollback en Deployments, dentro de las 72 h del plan Hobby |

---

## Receta completa: de la vacante al link, en 6 llamadas

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
  -d '{"title":{"es":"x","en":"x"},"headline":{"es":"x","en":"x"},"filterTags":["dotnet","leadership"]}' \
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
echo "https://portafolio.com/acme-tech-lead"
```

---

## Probar todo esto en local

```bash
# Postgres (si el 5432 está ocupado, cambiá el puerto y la DATABASE_URL)
docker run -d --name portafolio-db -p 5432:5432 \
  -e POSTGRES_USER=portfolio -e POSTGRES_PASSWORD=portfolio -e POSTGRES_DB=portfolio postgres:18-alpine

cd backend
npm ci && npm run prisma:migrate && npm run seed && npm run admin:bootstrap
npm run start:dev                 # API en http://localhost:3300

cd ../frontend
npm ci && npm run dev             # sitio en http://localhost:5173, /admin para el panel
```

Con eso todos los casos de este manual funcionan igual, cambiando `API=http://localhost:3300`.

---

## Qué falla y por qué

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
| La vista previa en LinkedIn es genérica | limitación conocida: no ejecuta JavaScript (caso 9) |
| El nuevo perfil no está en el sitemap | solo entran los `PUBLIC` |
