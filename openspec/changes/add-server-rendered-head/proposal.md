# add-server-rendered-head — El link compartido dice quién es Manuel

> Segundo change de la ronda 1.1 (`docs/ROADMAP-1.1.md` § 4). No es una funcionalidad nueva: **completa el Purpose de una spec ya aprobada**.

## Why

`openspec/specs/public-seo/spec.md` abre declarando que un perfil curado se comparte por link y que ese link *"tiene que decir quién es Manuel y para qué rol, tanto en un buscador como en la vista previa de un chat"*. La primera mitad funciona: Google ejecuta JavaScript y ve los metadatos que escribe el cliente. **La segunda mitad no existe.**

Verificado hoy en `frontend/index.html`:

- `<title>Portafolio profesional</title>` — genérico.
- `description` y `og:description` — genéricas.
- `og:image` apunta a `/favicon.svg`, y los rastreadores de LinkedIn, WhatsApp y Slack no renderizan SVG: la tarjeta sale **sin imagen**.

Resultado: los 13 perfiles curados se previsualizan **idénticos** al pegarlos en un mensaje. El producto es un link que se pega en LinkedIn; su carta de presentación está en blanco. La propia Fase 6 lo dejó anotado como limitación conocida y lo propuso para 1.1 (decisión D6 de `add-production-hardening`): este es ese change.

La deliberación de funcionalidades lo confirmó desde dos lados: el crítico adversarial señaló que *"cero de las siete ganadoras cambian lo que pasa cuando el link se comparte, que es la única rotura verificada del caso de uso principal"*, y el votante de secuencia lo puso tercero de todo el catálogo.

## What Changes

- **Endpoint de fragmento de head**: `GET /api/public/profile-head` con `slug` y `lang`, que devuelve **HTML** (no JSON) con `<title>`, `description`, `canonical`, `og:*`, `twitter:*`, `robots` y el JSON-LD `Person` del perfil resuelto. Lo construye el **mismo `CuratedProfileComposer`** que ya usan la ruta pública y el preview del panel, así que no puede divergir de lo que el visitante ve.
- **Inserción en el borde**: el `Caddyfile` del servicio `web` procesa `index.html` con la directiva `templates` e incrusta el fragmento con `httpInclude` antes de entregar el HTML. No hay segundo renderizador, no hay SSR del cuerpo, no cambia el stack y el frontend sigue siendo la misma SPA en el mismo origen: la cookie `SameSite=strict` no se toca.
- **Degradación, nunca error**: si el include falla o tarda más que su presupuesto, Caddy entrega el head estático actual. Un fallo del backend MUST NOT impedir que el sitio cargue.
- **`robots: noindex` real**: un perfil `PRIVATE` o `PROTECTED` emite `noindex` **en el HTML inicial**, sin depender de que el rastreador ejecute JavaScript.
- **`og:image` de verdad**: una imagen raster (PNG 1200×630) servida por el frontend, con el nombre y el titular, y `og:image:width`/`height`/`alt`. Reemplaza al SVG. Por perfil queda fuera de alcance (ver Non-goals).
- **El escritor del cliente se vuelve idempotente**: `applyDocumentMeta` reutiliza las etiquetas que ya vinieron del servidor en lugar de duplicarlas, y sigue siendo la única fuente al navegar entre perfiles sin recargar.
- **`index.html` deja de mentir**: el head estático pasa a describir el portafolio de forma honesta y queda como fallback explícito, no como el caso normal.

### Non-goals

- **SSR del cuerpo.** Solo el head. El cuerpo sigue siendo la SPA; no se introduce un segundo renderizador ni Node en el borde.
- **`og:image` generada por perfil** (una imagen distinta por vacante). Pide generación de imágenes en el servidor o un servicio externo; se difiere y se deja la puerta abierta con el endpoint ya parametrizado por slug.
- **Prerender del cuerpo para rastreadores** por `User-Agent`. Es detección de bots y una vía de divergencia entre lo que ve un bot y lo que ve una persona.
- **Content-Security-Policy del sitio público.** Ahora que Caddy sirve el HTML, es posible y conviene, pero es otra discusión de seguridad: se anota en `docs/ROADMAP-1.1.md` § 5 y no entra acá.
- **Cachear el fragmento en el backend.** Con el tráfico actual no se justifica; el presupuesto de tiempo del include lo cubre.
- Migración de Prisma: ninguna.

## Capabilities

### Modified Capabilities
- `public-seo`: los metadatos por perfil pasan a estar en el HTML inicial; `noindex` deja de depender de JavaScript; `og:image` deja de ser un SVG.
- `public-portfolio-frontend`: el escritor de metadatos del cliente se vuelve idempotente sobre un head ya poblado.
- `api-platform`: una ruta pública nueva que devuelve `text/html` en lugar de JSON, con su propia regla de errores.

## Impact

- **Backend**: `modules/curated-profile/infrastructure/controllers/` (controller nuevo), un servicio de aplicación que serializa el fragmento, y specs de los dos. Reusa el composer y el `SitemapBuilder` ya existentes para las URLs absolutas.
- **Frontend**: `index.html`, `shared/lib/document-meta.ts`, la imagen en `public/`, y el `Caddyfile`.
- **Despliegue**: el `Caddyfile` del servicio `web` suma `templates` y una variable con el origen interno de la API (ya existe `API_ORIGIN`). Hay que documentarlo en `docs/DEPLOY.md` § 9.5 y en `docs/DEPLOY-RAILWAY.md`.
- **Riesgo principal**: una petición extra en el camino del HTML. Se acota con presupuesto de tiempo y degradación, y se mide: el p95 de la ruta HTML no debe subir más de 50 ms.
