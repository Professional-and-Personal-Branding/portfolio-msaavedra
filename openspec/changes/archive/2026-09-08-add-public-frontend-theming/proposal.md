# add-public-frontend-theming — Fase 4: Frontend público + motor de theming

> Materializa la **Fase 4** de `docs/SPECS-POR-FASE.md` (objetivo, alcance y criterios viven allí). Referencias: `docs/ARCHITECTURE.md` §4 y §8.1 (theming como pilar), `docs/I18N.md`, demos `docs/demo.html` y `docs/demo-theming.html` (dirección estética validada). Depende de las Fases 1-3 y del change `add-portfolio-sections-api`, ya archivados.

## Why

El backend resuelve perfiles curados completos, tematizados y bilingües, pero **no existe ninguna interfaz**: hoy el producto es un JSON. La Fase 4 entrega la cara visible del portafolio: una SPA que consume la API real, renderiza la home y cada perfil curado por slug, y convierte los design tokens de la base en CSS variables en runtime, cumpliendo el pilar del producto (personalización sin rebuild).

## What Changes

- **Proyecto `frontend/`** con React 19 + TypeScript estricto + Vite 8, Tailwind CSS 4 (config CSS-first), shadcn/ui (base `new-york`), Motion, Lucide, TanStack Query 5, react-router 8, Zustand, Vitest + Testing Library. Estructura de CLAUDE.md: `app/`, `features/`, `shared/`, `themes/`.
- **Contrato único de tipos**: el backend gana `npm run openapi:export` (escribe `backend/openapi.json` sin levantar el servidor) y el frontend genera `src/shared/types/api.d.ts` con `openapi-typescript`; el cliente HTTP es `openapi-fetch` tipado. Ambos artefactos se versionan.
- **Motor de theming**: contrato `ThemeTokens` (mismo JSON que `Theme.tokens` del backend), `ThemeProvider` que inyecta los tokens como CSS custom properties en un contenedor raíz, Tailwind 4 leyendo esas variables (`bg-bg`, `text-text`, `bg-accent`, `rounded-theme`…), mapeo de las variables de shadcn/ui a los tokens (los componentes de la librería siguen el tema), `mode` claro/oscuro, `density`, `radius`, `maxWidth`, tipografía y `effects.animations` (respeta `prefers-reduced-motion`). Los **5 presets** (`modern-dark`, `modern-light`, `minimal`, `elegant`, `corporate`) viven en `themes/presets/` con los mismos tokens que el seed; el visitante puede conmutarlos en runtime desde la barra superior (criterio de aceptación), y el tema del perfil curado resuelto por la API es el valor inicial.
- **Motor de layouts**: `ClassicLayout` (una columna, como el demo) y `SidebarLayout` (columna lateral fija con hero/contacto + contenido); el `layout` del perfil curado elige, y `?layout=` permite probar. Las secciones se renderizan en el orden de `sections` que devuelve la API; las secciones conocidas con datos que no figuren en `sections` ni en `hiddenSections` (`projects`, `presence`) se agregan al final en orden canónico.
- **Vistas**: `/` (home = perfil curado `all`) y `/:slug` (perfil curado); menú de navegación agrupado por `roleType` desde `GET /api/curated-profiles`; perfiles `PROTECTED` vía `?token=`; estados de carga, error, 401 (formulario para ingresar el token) y 404.
- **Bilingüe**: `?lang=` como fuente de verdad (default por `navigator.language`, fallback `es`), propagado a la API y a un diccionario mínimo de textos de interfaz (`shared/i18n/`); selector ES/EN en la barra.
- **Responsive**: móvil y escritorio (menú en `Sheet` en móvil; sidebar colapsa).
- **Verificación**: Vitest para el motor (tokens → variables, merge con preset, regla de orden de secciones, store de locale/tema, diccionario), tests de componentes con datos mock (layouts, secciones, estados), `tsc` estricto con los tipos generados, `npm run build`; los criterios visuales se comprueban en el navegador contra la API real y quedan documentados con capturas en `verification.md`.

### Non-goals

- Backoffice, login visual, constructor de perfiles, customizador con color pickers (Fase 5). Los presets se conmutan; no se editan tokens sueltos desde la UI pública.
- SEO/OpenGraph, sitemap, export PDF, accesibilidad auditada, caché, PWA, tests E2E de navegador (Playwright): Fase 6 / 1.0.x.
- Cambios de esquema o de datos. Cambios de comportamiento de la API (solo se agrega el script de exportación OpenAPI).
- Persistir preferencias del visitante (tema/idioma) más allá de la URL y la memoria: sin `localStorage` (CLAUDE.md).

## Capabilities

### New Capabilities
- `api-contract-types`: exportación del documento OpenAPI y generación de tipos TypeScript del frontend a partir de él.
- `runtime-theming`: contrato de tokens, inyección como CSS variables, presets, conmutación en runtime, modo, densidad, radio, tipografía, animaciones.
- `layout-engine`: layouts estructurales conmutables y regla de orden/ocultamiento de secciones.
- `frontend-localization`: idioma por URL, propagación a la API y textos de interfaz.
- `public-portfolio-frontend`: home y vista curada por slug consumiendo la API real, navegación, acceso protegido, estados y responsive.

### Modified Capabilities
- (ninguna del backend: `api-platform` no cambia comportamiento; el export OpenAPI es tooling)

## Impact

- **Nuevo**: `frontend/**` completo; `backend/scripts/export-openapi.ts` + script `openapi:export`; `backend/openapi.json` (generado, versionado).
- **Modificado**: `backend/package.json` (script), `.gitignore` (artefactos del frontend), `docker-compose.yml` no cambia.
- **Dependencias**: las del stack (ver design D1). Sin dependencias nuevas en el backend.
- **Docs al archivar**: checkbox Fase 4 en `CLAUDE.md`/`README.md`; `docs/ARCHITECTURE.md` §4 (estructura real) y §8.1 (implementación); `docs/CHANGELOG.md`; `frontend/README.md`; `STEPS.md` (comandos).
