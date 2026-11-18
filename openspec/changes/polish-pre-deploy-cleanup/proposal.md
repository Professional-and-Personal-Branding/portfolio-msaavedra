# polish-pre-deploy-cleanup — limpieza antes del deploy: columna `stars`, `Cache-Control` doble y tablas del Dashboard en móvil

> Change chico de limpieza, previo al Deploy 1.0.0. Junta tres pendientes que quedaron anotados en changes anteriores: la P3 de `add-github-code-evidence` (columna `FeaturedRepository.stars` inerte), la observación de TC-48 sobre el `Cache-Control` duplicado detrás de Caddy y la violación `scrollable-region-focusable` de la tabla **Por enlace** del Dashboard en móvil.

## Why

1. **Una columna que nadie lee.** `FeaturedRepository.stars` existe desde `init`. `add-featured-repositories` la sacó del contrato (D3: stars a mano restan credibilidad) y `add-github-code-evidence` llevó las stars verificadas a `RepositoryEvidence`, dejando la columna inerte (P3, recomendación A: «se retira en un change de limpieza»). Hoy la columna solo confunde: el seed todavía declara y valida un `stars` que tira, `DATA-POPULATION.md` documenta un campo «ignorado» y el schema arrastra un comentario que explica por qué no sirve. Conviene retirarla **antes** del primer deploy, cuando la base de producción todavía no existe y la migración destructiva corre sobre cero filas.
2. **Dos `Cache-Control` en las respuestas de la API.** El `Caddyfile` agrega `Cache-Control: no-cache` a todo lo que no es `/assets/*` ni `/fonts/*`, también a lo que pasa por el proxy. Las rutas de la API que ya mandan su política (`no-store` en el panel, `private, no-store` en el `resume.json` protegido) salen con dos líneas por el contenedor `web`. `no-store` sigue presente y gana, pero la respuesta es ambigua para cachés intermedias y para quien la audite (lo anotó TC-48 el 7 de noviembre).
3. **Una tabla que no se alcanza con el teclado en el celular.** El componente `Table` envuelve la tabla en un contenedor con scroll horizontal. En las tablas de **Por enlace** y **Por portal** del Dashboard no hay nada enfocable adentro, así que a 375 px quien navega con teclado no puede desplazarlas, y axe marca `scrollable-region-focusable` (`serious`). El CI no lo detecta porque `a11y:check` audita `/admin` con visitas de HeadlessChrome (bots) y con las visitas sintéticas del ejemplo, que no traen enlace ni portal: las dos tablas siempre están en su estado vacío.

## What Changes

- **Migración `retire_featured_repository_stars` (D1, destructiva):** `ALTER TABLE "FeaturedRepository" DROP COLUMN "stars"`. Sale `stars` de `schema.prisma`. Respaldo y comprobación previa documentados en `docs/DEPLOY.md` (D2).
- **El seed olvida `stars` (D3):** sale del tipo `SeedFeaturedRepository` y de la validación. Un archivo anterior con `stars` sigue cargando (la clave se ignora como cualquier otra clave desconocida); `stars: "muchas"` deja de ser un error. Los dos archivos de datos no traen `stars` y no cambian.
- **Sin cambios de contrato (D4):** la API ya responde 400 a `stars`; OpenAPI, JSON Resume y `seed:verify` no la mencionan (las únicas `stars` del OpenAPI son las de la evidencia). Se conservan los tests que lo prueban.
- **Caddy con `Cache-Control` por defecto, no agregado (D5):** `header @noCache ?Cache-Control "no-cache"`. La regla solo actúa si la respuesta no trae su propio `Cache-Control`: el HTML, `/profile-prefetch.js` y las rutas de la API sin política siguen con `no-cache`; las que la traen conservan la suya, sola. Los assets y las fuentes no cambian.
- **Verificación de las cabeceras en el CI (D6):** el paso «Frontend · Caddy con la imagen de producción» del job `web-quality` cuenta las líneas `Cache-Control` de cinco respuestas y falla si alguna tiene más de una o un valor distinto del esperado.
- **Tablas desplazables con nombre y foco (D7):** `Table` acepta una prop opcional `regionLabel`; con ella, su contenedor es `role="region"`, `aria-label` y `tabIndex={0}`, como ya hace **Visitas por día**. **Por enlace** y **Por portal** la usan. Las demás tablas del panel (Postulaciones, Crear desde una vacante) tienen botones en cada fila y no cambian.
- **`a11y:check` audita el Dashboard con filas (D8):** antes del panel, el script crea (por la API, una vez) un enlace de seguimiento con etiqueta larga y registra visitas de **persona** con `?via=` y `?src=` desde Node, con un User-Agent de navegador común y sin la cookie del panel. Una entrada nueva `admin-dashboard-tablas` comprueba en móvil que las dos tablas tienen filas y que la de **Por enlace** desborda; si no, es un problema de preparación (código 1).
- **Manual:** caso nuevo **TC-53** (recorrer las tablas del Dashboard con el teclado en el celular) y ajustes en B2 y en la guía de datos (D9).
- `docs/CHANGELOG.md`, `docs/DEPLOY.md` (migración, regla de caché), `docs/DATA-POPULATION.md` y `docs/ARCHITECTURE.md` al día.

## Non-goals

- Cambiar la política de caché de la API (qué rutas mandan `no-store` o `no-cache`): solo deja de duplicarse.
- Revisar el resto de las tablas o regiones desplazables del sitio: se cubren las dos que el Dashboard deja sin foco.
- Tocar la evidencia de GitHub, su tabla o su conector.
- Migrar valores de `stars` a `RepositoryEvidence`: esa tabla la escribe solo el conector (D8 de `add-github-code-evidence`).

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `featured-repositories`: *Campos de un repositorio destacado* deja de hablar de una columna inerte: el repositorio no guarda stars propias y la tabla no tiene la columna.
- `data-persistence-seed`: *Repositorios destacados en el seed* olvida `stars`: un archivo anterior con la clave sigue cargando y la tabla no la tiene.
- `web-performance`: requisito nuevo *Una sola política de caché por respuesta del sitio*.
- `web-accessibility`: *Regiones desplazables alcanzables con teclado* suma las tablas **Por enlace** y **Por portal**; requisito nuevo *La auditoría ve las tablas del Dashboard con filas*.
- `platform-manual`: requisito nuevo *Caso TC-53 de las tablas del Dashboard con teclado*.

## Impact

- **Backend:** `backend/prisma/schema.prisma`, migración nueva `backend/prisma/migrations/<timestamp>_retire_featured_repository_stars/`, `backend/scripts/lib/seed-source.ts`, `backend/scripts/lib/seed-runner.ts` (comentario), `backend/src/modules/featured-repository/infrastructure/persistence/featured-repository.prisma-mapper.ts` (comentarios), tests `backend/test/seed-source.spec.ts` y `backend/test/seed-runner.spec.ts`. `backend/openapi.json` no cambia (se verifica con `openapi:export`).
- **Frontend:** `frontend/Caddyfile`, `frontend/src/shared/components/ui/table.tsx`, `frontend/src/features/backoffice/dashboard/DashboardPage.tsx` y su test, `frontend/scripts/check-a11y.mjs`.
- **CI:** `.github/workflows/ci.yml` (paso de Caddy del job `web-quality`).
- **Docs:** `docs/MANUAL.md` y `docs/manual/index.html` (TC-53, B2), `docs/DEPLOY.md`, `docs/DATA-POPULATION.md`, `docs/ARCHITECTURE.md`, `docs/CHANGELOG.md`.
- **Datos:** migración destructiva sobre una columna que la API nunca expuso. Sobre una base vacía o sin repositorios no se pierde nada; con repositorios, solo números cargados a mano antes de `add-featured-repositories`, que ninguna vista muestra. Respaldo previo en D2.
- Sin dependencias nuevas ni cambios de contrato.
