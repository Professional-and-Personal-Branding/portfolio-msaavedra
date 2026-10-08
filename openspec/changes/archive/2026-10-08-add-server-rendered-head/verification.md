# Verificación — add-server-rendered-head

Fecha: 2026-10-05 · Verifier: Claude (Opus 5.5) · Ciclos de reparación: 1 (las pruebas del borde obligaron a cambiar el mecanismo de inserción; ver `design.md`, *Cómo quedaron D3 y D6*).

**Estado: 18 de 19 tareas** (#11 sumó una). Falta la 5.4, la verificación con el Post Inspector de LinkedIn y el unfurl de Slack, porque necesita el sitio desplegado en una URL pública (ver al final). **Archivado el 2026-10-08 con la 5.4 pendiente**, por decisión de Manuel: queda en la verificación posterior al deploy de `docs/RELEASE-1.0.0-CHECKLIST.md`.

## Automatizado

| Check | Resultado |
|---|---|
| `backend`: `lint` / `typecheck` / `build` | 0 problemas |
| `backend`: `npm test` | 55 suites, **329 tests** (eran 314) |
| `backend`: `npm run test:e2e` | 7 suites, **123 tests** (eran 115), contra una base aparte migrada y con seed |
| `backend`: `openapi:export` | 24 rutas (+1: `GET /api/public/profile-head`) |
| `frontend`: `lint` / `build` | 0 problemas |
| `frontend`: `npm run test` | 23 archivos, **139 tests** (eran 132), dos corridas seguidas |
| `caddy validate` y `caddy fmt` del `Caddyfile` | válido y ya formateado |

## Por criterio

| Criterio (spec delta) | Evidencia |
|---|---|
| 200 `text/html; charset=utf-8` siempre, para las cuatro ramas | e2e *Fragmento de head*: público, protegido, privado, inexistente y sin slug |
| `PUBLIC`: title, description, canonical, og:*, Twitter, `index, follow` y JSON-LD | `profile-head.renderer.spec.ts` y e2e |
| En inglés: textos en inglés y `og:locale` | e2e (`en_US`) y transcripción por el borde |
| Escapado de `<`, `&` y `"`, también en el JSON-LD | `profile-head.renderer.spec.ts`: un `</script>` en el titular no cierra la etiqueta |
| El canonical coincide con el sitemap | unitario (`profilePath` compartido) y e2e contra `GET /sitemap.xml` |
| `PROTECTED` no filtra textos, con o sin token | e2e con `?token=` y con `X-Access-Token`; transcripción por el borde |
| `PRIVATE` e inexistente son idénticos | e2e (`toBe` del cuerpo completo) |
| No registra visitas; exento del rate limiting | e2e |
| `noindex` sin JavaScript | [`verification/noindex-sin-js.txt`](verification/noindex-sin-js.txt): HTML servido por Caddy |
| Cliente idempotente sobre un head del servidor | `document-meta.spec.ts`: una etiqueta por clave, navegación entre perfiles y head vacío |
| Textos del cliente y del servidor iguales | `document-meta.consistency.spec.ts` y `profile-head.consistency.spec.ts` sobre el mismo fixture (`docs/fixtures/profile-head-consistency.json`) |
| Imagen raster utilizable | `frontend/public/og-default.png`: 1200×630, 151 KB; `og:image:width/height/alt` en el fragmento y en el fallback |
| Título efectivo con y sin inserción; nunca sin título | [`4.2-con-include.txt`](verification/4.2-con-include.txt) y [`4.3-degradacion.txt`](verification/4.3-degradacion.txt): siempre un solo `<title>` |

## Borde (Docker)

La imagen del servicio `web` se construyó con `frontend/Dockerfile` y se corrió con `API_ORIGIN` apuntando a la API del change, contra la base `portfolio_verify`.

- **Con la API arriba** ([`4.2-con-include.txt`](verification/4.2-con-include.txt)): `/tech-lead-dotnet`, `/devops-platform` y `/` salen con títulos distintos. Hay un solo `<title>` y un solo `og:title`, y la SPA arranca. Una ruta inexistente cae al genérico con `noindex`.
- **Con la API apagada** ([`4.3-degradacion.txt`](verification/4.3-degradacion.txt)): HTTP 200, el título de fallback, la `og:image` absoluta y ningún resto del template. Las demás rutas de la API siguen dando 502, como antes.
- **Con una API colgada**, que acepta la conexión y no responde ([`4.3-degradacion-timeout.txt`](verification/4.3-degradacion-timeout.txt)): el HTML sale en **0,505 s** con el fallback. Es el presupuesto de 500 ms.
- **Navegador real**, sobre el contenedor: después de hidratar y de navegar a otro perfil sin recargar sigue habiendo una etiqueta por clave, el título se actualiza y la consola no muestra errores.

## Latencia (5.3)

[`5.3-latencia.txt`](verification/5.3-latencia.txt): 300 peticiones secuenciales por imagen, misma API.

| | p50 | p95 | p99 |
|---|---|---|---|
| antes (`main`) | 2,3 ms | 4,8 ms | 15,4 ms |
| después | 9,6 ms | 12,8 ms | 18,6 ms |

El p95 sube **8,0 ms**, por debajo del límite de 50 ms. La medición es en local: en Railway la API va por la red privada, así que conviene repetirla después del deploy.

## Revisión del PR #8 (2026-10-08)

- **API que responde 500**: con el `Caddyfile` anterior, `GET /tech-lead-dotnet` daba **500**; con el nuevo da **200** con el título de respaldo. Con la API sana se sigue insertando el fragmento, y con la API apagada sale el respaldo en 0,508 s. Transcripción en [`verification/revision-api-500.txt`](verification/revision-api-500.txt). `caddy validate` y `caddy fmt` sin cambios.
- **Caché del fragmento**: `profile-head.cache.spec.ts` (TTL, tope, renovación) y tres casos nuevos en `get-profile-head.use-case.spec.ts`: seis peticiones iguales componen una sola vez, vencido el TTL vuelve a componer y lo que no resuelve no se guarda. Unitarios 335/335 y e2e 123/123, incluido `el fragmento de head nunca se limita`.

## Pendiente: 5.4 (verificación externa)

El Post Inspector de LinkedIn y el unfurl de Slack necesitan una URL pública, y el sitio todavía no está desplegado (el deploy 1.0.0 sigue pendiente). Para hacerlo después del deploy:

1. `curl -s https://<dominio>/tech-lead-dotnet | grep og:title` y lo mismo con otro perfil: tienen que salir dos títulos distintos.
2. Pegar las dos URLs en https://www.linkedin.com/post-inspector/ y en un canal de Slack: las tarjetas tienen que mostrar títulos distintos y la imagen.
3. Guardar las capturas en `verification/` y marcar la 5.4.

## Desvíos respecto de los artefactos

Están detallados en `design.md`, *Cómo quedaron D3 y D6*. Resumen:

- **4.1**: `httpInclude` recibe una ruta y no `{$API_ORIGIN}`, porque hace una sub-petición al mismo Caddy.
- **Degradación**: hace falta un `handle_errors`. Sin él, la API caída daba 500 en todo el HTML.
- **D6**: el marcador quedó como un condicional `if/else` y no como un marcador antes del head estático. D6 tal como estaba escrito dejaba dos etiquetas por clave, y la spec exige una.
- **D4**: `setMeta` ya reutilizaba etiquetas; lo nuevo es que las marca como gestionadas.
- **Deltas de spec**: el requisito del cliente idempotente estaba como `MODIFIED` de uno inexistente y pasó a `ADDED`. `robots` se escribe `index, follow` / `noindex, nofollow`, el formato que ya usaba el cliente.
- **`og:image` del fallback**: el head de fallback la arma con el `Host` de la petición y `https`, porque el HTML estático no conoce el dominio. Detrás de Railway da la URL correcta; en un `docker run` local da `https://localhost/...`.
