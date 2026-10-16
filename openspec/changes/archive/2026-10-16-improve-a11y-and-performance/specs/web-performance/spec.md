# web-performance Specification (delta)

## Purpose
Que un perfil curado abra rápido en un teléfono de gama media con red móvil, sin depender de cache en el servidor: el arranque público carga solo el JS que necesita para pintar, el contenido principal no espera animaciones y un presupuesto medible impide volver atrás.

## ADDED Requirements

### Requirement: Presupuesto de JS del arranque público
La suma gzip de los JS que carga el arranque de una ruta pública (el *entry* y sus `modulepreload` en `dist/index.html`) SHALL ser ≤ 180 KB. Esos chunks MUST NOT contener la API clásica de `zod` ni las animaciones de `motion`, que SHALL cargarse en diferido. `npm run perf:budget` SHALL medirlo sobre `dist/` y salir con 1 si se excede.

#### Scenario: Build dentro del presupuesto
- **WHEN** se corre `npm run build` y luego `npm run perf:budget`
- **THEN** el script informa el total gzip del arranque, es ≤ 180 KB y sale con código 0

#### Scenario: Regresión detectada
- **WHEN** un componente público vuelve a importar `zod` clásico o `motion` de forma estática
- **THEN** `npm run perf:budget` sale con código 1 y nombra el chunk y el módulo

### Requirement: El contenido principal no espera animaciones
El hero de la vista pública SHALL pintarse con opacidad completa desde su primer render, con o sin animaciones en el tema. Las demás secciones MAY animar su entrada al aparecer en pantalla según `runtime-theming`.

#### Scenario: Hero visible al primer render
- **WHEN** se abre `/tech-lead-dotnet` con un tema que tiene `effects.animations = true`
- **THEN** la sección `hero` tiene opacidad 1 en el primer frame en que existe en el DOM

#### Scenario: Secciones inferiores
- **WHEN** se abre el mismo perfil y se baja hasta *Experiencia*
- **THEN** esa sección sigue animando su entrada

### Requirement: Tipografía por defecto pedida desde el HTML
`index.html` SHALL precargar (`rel="preload" as="style"`) la hoja de Google Fonts de Inter con la misma URL que usa el cargador de fuentes, sin bloquear el render y sin agregar orígenes a la CSP.

#### Scenario: Una sola petición de la hoja
- **WHEN** se abre `/` con el tema por defecto
- **THEN** la hoja de Inter se pide una sola vez y antes de que termine de ejecutarse el JS de entrada

### Requirement: Umbral de Lighthouse verificable
`npm run perf:check -- <base>` SHALL correr Lighthouse (versión exacta) en mobile `PERF_CHECK_RUNS` veces (default 3) sobre `/`, un perfil y su variante `?lang=en&theme=modern-dark&layout=sidebar`, y salir con 1 si la mediana de Performance baja de `PERF_CHECK_MIN_PERFORMANCE` (default 90) o la de Accessibility, Best Practices o SEO baja de 90; en `/admin/login`, solo Accessibility y Best Practices. Sin `A11Y_CHECK_DISPOSABLE_DB=1` SHALL salir con 2.

#### Scenario: Páginas públicas en mobile
- **WHEN** se corre contra el build de producción servido por Caddy y una base descartable
- **THEN** las tres páginas públicas tienen mediana ≥ 90 en las cuatro categorías y el script sale con código 0

#### Scenario: Login sin exigencia de SEO
- **WHEN** se mide `/admin/login`, que lleva `noindex`
- **THEN** su SEO se informa pero no hace fallar el script

#### Scenario: Sin base descartable
- **WHEN** se corre sin `A11Y_CHECK_DISPOSABLE_DB=1`
- **THEN** no se ejecuta ninguna medición y el script sale con código 2

#### Scenario: Umbral de Performance parametrizado
- **WHEN** se corre con `PERF_CHECK_RUNS=5` y `PERF_CHECK_MIN_PERFORMANCE=85` y una página da medianas de Performance 87 y de SEO 100
- **THEN** el script hace cinco corridas por página pública y esa página no lo hace fallar

### Requirement: Los checks de calidad web bloquean en CI
El workflow de CI SHALL correr, en cada push y PR a `main`, `perf:budget` sobre el build del frontend, y `a11y:check` y `perf:check` (5 corridas, Performance ≥ 70) contra la imagen de `frontend/Dockerfile` y la API sobre un Postgres de servicio migrado y sembrado. `A11Y_CHECK_DISPOSABLE_DB=1` SHALL definirse solo en ese job. Si un check falla, el workflow SHALL fallar y subir sus reportes como artefacto.

#### Scenario: Regresión de accesibilidad en un PR
- **WHEN** un PR a `main` vuelve a usar `text-brand` como texto con un acento oscuro
- **THEN** el job de accesibilidad falla por `color-contrast` y el workflow queda en rojo con el reporte de axe como artefacto

#### Scenario: Corrida verde
- **WHEN** un push a `main` no introduce regresiones
- **THEN** `perf:budget`, `a11y:check` y `perf:check` pasan y no se sube ningún artefacto

#### Scenario: La variable no se filtra
- **WHEN** se revisa `.github/workflows/ci.yml`
- **THEN** `A11Y_CHECK_DISPOSABLE_DB` aparece solo en el `env` del job que levanta su propio Postgres
