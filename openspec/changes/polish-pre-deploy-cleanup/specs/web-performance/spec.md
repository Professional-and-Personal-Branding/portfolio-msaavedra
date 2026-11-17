## ADDED Requirements

### Requirement: Una sola política de caché por respuesta del sitio
Cada respuesta del contenedor `web` SHALL llevar exactamente una cabecera `Cache-Control`. Los assets con hash y las fuentes versionadas SHALL salir como `public, max-age=31536000, immutable`; una respuesta de la API que traiga su propio `Cache-Control` SHALL conservarlo solo; cualquier otra respuesta SHALL salir con `no-cache`.

#### Scenario: Ruta del panel con no-store
- **WHEN** con la sesión iniciada se pide `GET /api/admin/consistency` al contenedor `web`
- **THEN** la respuesta trae una sola línea `Cache-Control`, con valor `no-store`

#### Scenario: Exportación protegida
- **WHEN** se pide al contenedor `web` el `resume.json` de un perfil `PROTECTED` con su token
- **THEN** la respuesta trae una sola línea `Cache-Control`, con valor `private, no-store`

#### Scenario: API sin política propia
- **WHEN** se pide `GET /api/curated-profiles/all` al contenedor `web`
- **THEN** la respuesta trae una sola línea `Cache-Control`, con valor `no-cache`

#### Scenario: HTML y assets sin cambios
- **WHEN** se piden `/`, `/profile-prefetch.js` y un archivo de `/assets/` al contenedor `web`
- **THEN** `/` y `/profile-prefetch.js` traen una sola línea `no-cache` y el asset una sola línea `public, max-age=31536000, immutable`

#### Scenario: El CI cuenta las cabeceras
- **WHEN** corre el job `web-quality` y alguna de las URLs verificadas sale con dos líneas `Cache-Control` o con otro valor
- **THEN** el paso de Caddy falla y el job no pasa
