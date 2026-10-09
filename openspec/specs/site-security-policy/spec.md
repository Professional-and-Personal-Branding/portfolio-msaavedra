# site-security-policy Specification

## Purpose
Define la Content-Security-Policy que el contenedor `web` (Caddy) sirve con la SPA, para que el sitio solo ejecute scripts propios y no se pueda embeber, y cómo pasarla a modo solo-reporte sin reconstruir la imagen.

## Requirements

### Requirement: Content-Security-Policy del sitio
Las respuestas que el contenedor `web` sirve desde la SPA (el HTML, con o sin fragmento de head, y los archivos estáticos) SHALL incluir una CSP con `default-src 'self'`, `script-src 'self'`, `connect-src 'self'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'` y `frame-ancestors 'none'`. Las respuestas que pasan por el proxy hacia la API MUST NOT recibir esta política desde Caddy.

#### Scenario: Cabecera en el HTML
- **WHEN** se pide `/` o `/tech-lead-dotnet` al contenedor `web`
- **THEN** la respuesta trae `Content-Security-Policy` con `script-src 'self'` y `frame-ancestors 'none'`

#### Scenario: El sitio no se embebe
- **WHEN** otra página intenta mostrar el sitio en un `iframe`
- **THEN** el navegador lo rechaza por `frame-ancestors 'none'`

#### Scenario: La API no la recibe del borde
- **WHEN** se pide `/api/curated-profiles/all` a través del contenedor `web`
- **THEN** la respuesta no trae la `Content-Security-Policy` del sitio

### Requirement: La política no rompe lo que el sitio carga
La CSP SHALL permitir la hoja de Google Fonts (`style-src https://fonts.googleapis.com`) y sus archivos (`font-src https://fonts.gstatic.com`), los estilos inline (`style-src 'unsafe-inline'`) y las imágenes propias y `data:`. Con la política activa, el sitio público, el panel y el JSON-LD del fragmento de head MUST funcionar sin violaciones en la consola, y `script-src` MUST NOT incluir `'unsafe-inline'` ni `'unsafe-eval'`.

#### Scenario: Perfil público sin violaciones
- **WHEN** se abre `/tech-lead-dotnet` en el contenedor `web` con la API arriba
- **THEN** el perfil se ve con sus fuentes y su tema, y la consola no tiene violaciones de CSP

#### Scenario: JSON-LD presente y sin violación
- **WHEN** el HTML trae el `<script type="application/ld+json">` del fragmento de head
- **THEN** el bloque está en el documento y la consola no registra violación por él

#### Scenario: Panel sin violaciones
- **WHEN** se entra al panel, se abre el constructor, se cambia un token del tema y se guarda
- **THEN** el preview aplica el token, aparece el toast de éxito y la consola no tiene violaciones de CSP

#### Scenario: Script inline bloqueado
- **WHEN** se inserta en la página un `<script>` inline
- **THEN** el navegador no lo ejecuta y registra una violación de `script-src`

### Requirement: Modo de la política sin reconstruir la imagen
El nombre de la cabecera SHALL tomarse de la variable `CSP_HEADER`, con `Content-Security-Policy` (bloquea) por defecto. Con `CSP_HEADER=Content-Security-Policy-Report-Only` la misma política SHALL emitirse solo como reporte, sin reconstruir la imagen.

#### Scenario: Default en enforce
- **WHEN** el contenedor arranca sin `CSP_HEADER`
- **THEN** el HTML trae `Content-Security-Policy` y no `Content-Security-Policy-Report-Only`

#### Scenario: Solo reporte
- **WHEN** el contenedor arranca con `CSP_HEADER=Content-Security-Policy-Report-Only`
- **THEN** el HTML trae `Content-Security-Policy-Report-Only` con la misma política y no `Content-Security-Policy`
