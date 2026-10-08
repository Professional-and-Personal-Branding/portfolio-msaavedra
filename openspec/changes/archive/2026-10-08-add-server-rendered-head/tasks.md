# Tasks — add-server-rendered-head

> Referencias: `proposal.md`, `design.md` (D1–D6), `specs/*/spec.md`.

## 1. Fragmento de head en el backend (D1, D2, D5)

- [x] 1.1 Application: servicio puro que recibe el DTO del composer, el idioma y la URL absoluta, y devuelve el HTML del fragmento (escapado). Sin Prisma, sin Nest. Verificar: spec con perfil completo, perfil sin descripción, textos con `<`, `&` y `"`, y el caso genérico.
- [x] 1.2 Application: `GetProfileHeadUseCase` con un único `execute()`. Resuelve el perfil **sin** registrar visita y sin aceptar token; `PROTECTED`, `PRIVATE` e inexistente devuelven el fragmento genérico con `noindex`. Verificar: spec con repositorio mockeado, las cuatro ramas de la tabla de D2.
- [x] 1.3 Infrastructure: `GET /api/public/profile-head?slug=&lang=`, respuesta `text/html; charset=utf-8`, siempre 200, exenta del rate limiting como el healthcheck. Docs de Swagger. Verificar: e2e de las cuatro ramas y del `Content-Type`.
- [x] 1.4 El fragmento usa las mismas URLs absolutas que el sitemap (`FRONTEND_URL`). Verificar: spec que compara el `canonical` del fragmento con la URL del mismo perfil en `GET /sitemap.xml`.

## 2. Head estático e imagen (D5, D6)

- [x] 2.1 `frontend/public/og-default.png` de 1200×630 con nombre y titular. Verificar: dimensiones y peso < 300 KB.
- [x] 2.2 `index.html` (implementado como condicional de template en lugar de marcador, ver `design.md`, *Cómo quedaron D3 y D6*): marcador `<!--#head-include-->` inmediatamente antes del `<title>`, `og:image` apuntando al PNG absoluto, `og:image:width/height/alt`, y textos de fallback honestos. Verificar: `npm run dev` carga sin Caddy y el cliente escribe los metadatos como hoy.

## 3. Cliente idempotente (D4)

- [x] 3.1 `setMeta` busca por clave sin exigir `data-managed-meta`, reutiliza y marca al escribir. Verificar: spec que parte de un head pre-poblado y comprueba **exactamente una** etiqueta por clave tras `applyDocumentMeta`.
- [x] 3.2 `setCanonical` y `setJsonLd` con el mismo criterio: un solo `<link rel="canonical">` y un solo `<script type="application/ld+json">`. Verificar: spec.
- [x] 3.3 Test de consistencia servidor/cliente: para el mismo perfil e idioma, el fragmento del backend y el resultado de `metaFromProfile` coinciden en título, descripción y canonical. Verificar: spec con fixture compartido.

## 4. Borde (D3)

- [x] 4.1 `frontend/Caddyfile`: matcher que limita `templates` a la entrega de `index.html`, sustitución del marcador con `httpInclude` sobre `{$API_ORIGIN}`, presupuesto de 500 ms. Verificar: `caddy validate` y `caddy fmt`.
- [x] 4.2 Prueba local con Docker: `docker build` del frontend y `curl -s localhost:8099/tech-lead-dotnet | grep 'og:title'` devuelve el título del perfil. Verificar: transcripción en `verification/`.
- [x] 4.3 Prueba de degradación: con `API_ORIGIN` apuntando a un puerto muerto, el sitio sigue devolviendo 200 con el head estático y la SPA arranca. Verificar: transcripción.
- [x] 4.4 Prueba del título: con include, el título efectivo es el del perfil; sin include, el estático. Verificar: transcripción de los dos casos.

## 5. Documentación y verificación

- [x] 5.1 `docs/DEPLOY.md` § 9.5 y `docs/DEPLOY-RAILWAY.md`: la variable y el comportamiento del include, con la degradación explicada.
- [x] 5.2 `docs/MANUAL.md` caso 9: reemplazar la limitación conocida por el comportamiento nuevo, y dejar anotado que la imagen es la misma para todos los perfiles.
- [x] 5.3 Medición: p95 de la ruta HTML antes y después, con la API arriba. Verificar: no sube más de 50 ms.
- [x] 5.6 Ajustes de la revisión del PR #8: un 4xx/5xx de la API degrada al head de respaldo (`handle_response`) y el fragmento de los perfiles públicos se guarda un minuto (`ProfileHeadCache`). Verificar: transcripción `verification/revision-api-500.txt` y unitarios.
- [ ] 5.4 Verificación externa: Post Inspector de LinkedIn y unfurl de Slack sobre dos perfiles distintos muestran títulos distintos. Verificar: capturas en `verification/`.
- [x] 5.5 Suite completa: `npm run test:all` en backend y `npm run test` en frontend. Verificar: en verde.
