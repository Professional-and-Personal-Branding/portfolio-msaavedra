# Design — add-server-rendered-head

## Context

Ver `proposal.md`. Estado verificado el 4 de octubre de 2026:

- `frontend/index.html` trae head estático genérico y `og:image` = `/favicon.svg`.
- `frontend/src/shared/lib/document-meta.ts` ya marca sus etiquetas con `data-managed-meta` y expone `metaFromProfile`, `personJsonLd`, `applyDocumentMeta` y `restoreDocumentMeta`. `setMeta` crea la etiqueta si no existe.
- `GET /api/curated-profiles/{slug}` ya acepta `locale`, `lang`, `token` y `X-Access-Token`, y devuelve 401 para `PROTECTED` sin token y 404 para `PRIVATE`.
- El servicio `web` de Railway ya sirve el HTML con **Caddy** (`frontend/Caddyfile`) y ya tiene `API_ORIGIN` apuntando a la API por la red privada. Eso es lo que hace viable este change sin stack nuevo: hace una semana no existía el borde donde insertar.
- `SitemapBuilder` ya compone URLs absolutas sobre `FRONTEND_URL`.

## Goals / Non-Goals

**Goals:** que el HTML inicial de `/:slug` traiga los metadatos del perfil; `noindex` sin JavaScript; nunca degradar la disponibilidad del sitio; una sola fuente de los textos.
**Non-Goals:** SSR del cuerpo, imagen por perfil, prerender por `User-Agent`, CSP, caché.

## Decisions

### D1 — El fragmento lo arma el backend, no una plantilla de Caddy

El endpoint devuelve el HTML del head ya compuesto. Alternativa descartada: que Caddy pida el JSON del perfil y arme las etiquetas con la sintaxis de `templates`. Eso pondría reglas de presentación (truncado de la descripción, elección de `og:locale`, forma del JSON-LD) en el Caddyfile, fuera de todo test. Con el fragmento ya armado, la lógica queda en el backend, con sus specs, y Caddy solo concatena.

### D2 — `GET /api/public/profile-head`, público y sin token

Parámetros: `slug` (requerido) y `lang`. Siempre responde **200 con `text/html; charset=utf-8`**, incluso cuando el perfil no existe o no es accesible: en esos casos devuelve el fragmento genérico con `robots: noindex`. Razón: es un fragmento de presentación consumido por el borde, no una API de datos; un 404 obligaría a Caddy a decidir qué hacer con el error y abriría la puerta a entregar un HTML a medias.

**Qué emite según el estado del perfil:**

| Perfil | Fragmento |
|---|---|
| `PUBLIC` | metadatos completos del perfil, `robots: index,follow`, JSON-LD |
| `PROTECTED` | título y descripción **genéricos**, `robots: noindex,nofollow`, sin JSON-LD |
| `PRIVATE` | idéntico a inexistente: genérico y `noindex` |
| inexistente | genérico y `noindex` |

El endpoint **no acepta** `token` ni `X-Access-Token`: un fragmento de head no es el lugar para autenticar, y emitir los textos de un perfil protegido en el HTML inicial filtraría justo lo que la visibilidad protege. Quien tenga el token ve los metadatos correctos igual, porque el cliente los reescribe al resolver.

### D3 — Inserción con `templates` + `httpInclude`, con marcador explícito

`index.html` lleva un marcador en el head:

```html
<!--#head-include-->
```

y el Caddyfile procesa el HTML con `templates`, sustituyendo ese marcador por `{{httpInclude (printf "%s/api/public/profile-head?slug=%s&lang=%s" ...)}}`. El `slug` sale de la ruta pedida y `lang` del query. Se mantiene el marcador como comentario HTML para que el `index.html` siga siendo válido y el `npm run dev` de Vite funcione sin Caddy: en desarrollo el marcador simplemente no se sustituye y el cliente escribe los metadatos como hoy.

**Presupuesto:** el include se corta a 500 ms. Si falla o expira, el marcador queda vacío y el head estático es lo que se entrega.

### D4 — Las etiquetas del servidor y las del cliente son las mismas etiquetas

`setMeta` pasa a buscar por `[property="og:title"]` / `[name="description"]` **sin exigir el marcador `data-managed-meta`**, reutilizar la etiqueta si existe y marcarla como gestionada al escribirla. Así, cuando el servidor ya puso `og:title`, el cliente la actualiza en lugar de agregar una segunda. Un test verifica que después de `applyDocumentMeta` hay **exactamente una** etiqueta por clave, partiendo de un head pre-poblado.

`restoreDocumentMeta` conserva su comportamiento: solo limpia lo que marcó como gestionado, lo que ahora incluye las que vinieron del servidor y el cliente reescribió. Es correcto: al salir de la vista, lo genérico es lo que corresponde.

### D5 — `og:image` raster y estática, servida por el frontend

Un PNG de 1200×630 en `frontend/public/og-default.png`, con nombre y titular, referenciado con URL absoluta sobre `FRONTEND_URL`. Se agregan `og:image:width`, `og:image:height` y `og:image:alt`, que es lo que las vistas previas necesitan para no recortar mal. Por perfil queda fuera de alcance (Non-goal), pero el endpoint ya recibe el slug: cuando se quiera, solo cambia la URL que emite el fragmento.

### D6 — El `title` del fragmento manda sobre el `<title>` estático

Dos `<title>` en un documento son inválidos. El fragmento emite el suyo y el marcador se coloca **después** del `<title>` estático; los navegadores y los rastreadores toman el primero, así que el marcador va **antes**. Decisión: el marcador se coloca inmediatamente antes del `<title>` estático, y el fragmento emite su propio `<title>`; cuando el include funciona hay dos y gana el del fragmento por ser el primero. Alternativa descartada: quitar el `<title>` estático, porque dejaría el documento sin título cuando el include degrada.

> Esta es la parte más frágil del diseño y se verifica explícitamente en la spec: con include y sin include, el título efectivo tiene que ser el correcto.

## Risks

| Riesgo | Mitigación |
|---|---|
| El include agrega latencia a cada HTML | Presupuesto de 500 ms, degradación silenciosa, y medición del p95 antes y después |
| La API cae y el sitio deja de cargar | `httpInclude` que falla deja el marcador vacío; test de verificación con la API apagada |
| Dos `<title>` confunden a un rastreador concreto | D6 y verificación con el Post Inspector de LinkedIn y el unfurl de Slack, no solo con `curl` |
| Los textos del fragmento y los del cliente divergen | Los dos salen de `metaFromProfile` sobre el mismo DTO del composer; un test compara ambos para el mismo perfil e idioma |
| `templates` procesa HTML que no debería | Se limita a `index.html` por matcher de ruta en el Caddyfile, no a todo el `file_server` |

## Migration Plan

Sin migración de datos. Orden: endpoint y fragmento en el backend → `og-default.png` e `index.html` con el marcador → `applyDocumentMeta` idempotente → `Caddyfile` → documentación del despliegue → verificación con la API arriba y abajo.

El change es desplegable por partes: el endpoint y el cliente idempotente pueden ir primero sin tocar el Caddyfile, y el sitio se comporta exactamente como hoy.

## Open Questions

- ¿El fragmento debería emitir también `hreflang` para `es`/`en`? Hoy no hay URLs separadas por idioma (el idioma va en query), así que `hreflang` apuntaría a la misma URL con otro parámetro. Se deja para el change de URLs bilingües, que está en el catálogo diferido.
