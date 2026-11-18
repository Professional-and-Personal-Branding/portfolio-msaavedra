# Design — polish-pre-deploy-cleanup

## Context

**Columna `FeaturedRepository.stars`.** Nació en `20260906055928_init` (`"stars" INTEGER`, nula). Hasta `add-featured-repositories` el seed la escribía (`stars: r.stars ?? null`, solo para los repositorios visibles); desde ese change el seed la ignora, la API la rechaza con 400 (whitelist) y ninguna salida la expone (D3 de ese change). `add-github-code-evidence` llevó las stars verificadas a `RepositoryEvidence` y dejó la columna inerte por su P3 (respuesta A: «se retira en un change de limpieza»). Estado de `main` (8f64cb6):

- `schema.prisma`: `stars Int?` con el comentario «columna inerte».
- `featured-repository.prisma-mapper.ts`: no la lee ni la escribe; los `stars` que aparecen ahí son de `RepositoryEvidence`.
- `seed-source.ts`: `SeedFeaturedRepository.stars?: number` y una validación de tipo («debe ser un número (se ignora al cargar)»). `seed-runner.ts` no la escribe.
- `docs/cv-data.json` y `docs/examples/cv-data.example.json`: **no** traen `stars`.
- `backend/openapi.json`: `stars` solo en `RepositoryEvidenceResponse` y `AdminRepositoryEvidenceResponse`. `verify-seed.ts` y `json-resume.mapper.ts` no la usan.
- Specs vigentes que la nombran: *Campos de un repositorio destacado* (`featured-repositories`) y *Repositorios destacados en el seed* (`data-persistence-seed`, escenario «Archivo anterior con stars … la columna `stars` queda nula»). `add-github-code-evidence` (fusionado, sin archivar) solo agrega requisitos en capacidades nuevas o ajenas a estas dos.
- Precedente de migración destructiva: `retire_accent_color` (`DROP COLUMN` en el `preDeployCommand`, con respaldo recomendado y rollback documentados en `docs/DEPLOY.md`).

**Caddy.** En `frontend/Caddyfile`, después de los `handle`, hay tres reglas de caché: `/assets/*` y `/fonts/*` con `public, max-age=31536000, immutable`, y `@noCache not path /assets/* /fonts/*` con `header @noCache Cache-Control "no-cache"`. Esa directiva `header` sin prefijo se aplica **antes** de que responda el handler, y `reverse_proxy` copia las cabeceras de la API **sumándolas** a las que ya hay: si la API manda `Cache-Control`, la respuesta sale con dos líneas. Rutas de la API con política propia: `/api/admin/consistency`, `/api/admin/integrations/*` y el CSV de postulaciones (`no-store`), el `resume.json` (`no-cache` público, `private, no-store` protegido y panel). Las demás rutas (perfil público, `/health`, `robots.txt`, `sitemap.xml`) no mandan `Cache-Control` y hoy reciben el `no-cache` de Caddy. Requisitos vigentes que dependen de la regla: `web-performance` («El script no queda en caché»: `/profile-prefetch.js` con `no-cache`; fuentes inmutables) y `json-resume-export` (`no-cache` / `private, no-store`).

**Tablas del Dashboard.** `frontend/src/shared/components/ui/table.tsx` (shadcn) envuelve `<table>` en `<div data-slot="table-container" class="relative w-full overflow-x-auto">`. En `DashboardPage.tsx`, `ShareLinkTable` (cuatro columnas: etiqueta truncada a `max-w-56`, perfil, portal, visitas) y `SourceTable` (dos columnas) no tienen nada enfocable. A 375 px la de **Por enlace** desborda y axe reporta `scrollable-region-focusable`. El patrón del proyecto ya existe: `DayBars` (`role="region" aria-label="Visitas por día" tabIndex={0}`) y `SelectionOverrides`, con el foco visible global de `theme.css` (`:focus-visible`). El requisito *Regiones desplazables alcanzables con teclado* (`web-accessibility`) ya obliga a esto en todo el sitio; las tablas se le escaparon porque `a11y:check` nunca las ve con filas: las visitas de Chrome sin cabeza se clasifican `BOT`, las del panel `OWNER`, y las 105 visitas sintéticas del ejemplo no traen enlace ni portal.

## Goals / Non-Goals

**Goals:** (1) retirar `stars` de la base, del schema, del seed y de la documentación sin perder nada que alguna vista muestre; (2) una sola línea `Cache-Control` por respuesta del contenedor `web`, sin cambiar la política efectiva de ninguna ruta; (3) las tablas del Dashboard alcanzables con teclado en móvil, y un `a11y:check` que las vea con filas para que no vuelva a pasar.

**Non-Goals:** cambiar qué ruta de la API manda qué política; revisar otras tablas o regiones; copiar `stars` a la evidencia; tocar el conector de GitHub.

## Decisions

### D1 — `DROP COLUMN` directo, en una migración propia

Migración `retire_featured_repository_stars`, con una sola sentencia y un comentario que cita este change:

```sql
-- polish-pre-deploy-cleanup (D1): columna inerte desde add-github-code-evidence (P3).
-- Las stars viven en RepositoryEvidence y solo las escribe el conector de GitHub.
ALTER TABLE "FeaturedRepository" DROP COLUMN "stars";
```

Se genera con `prisma migrate dev --create-only` contra una base descartable y se revisa a mano: no debe tocar `RepositoryEvidence.stars` ni ninguna otra tabla.

*Alternativa descartada:* una guarda en SQL que aborte (`RAISE EXCEPTION`) si alguna fila tiene `stars` no nula. Haría fallar el `preDeployCommand`, y con él el deploy entero, por un número que ninguna vista muestra desde `add-featured-repositories` y que el contrato prohíbe exponer. La protección real es el respaldo previo (D2), igual que en `retire_accent_color`. Queda como P1 por si el owner prefiere la guarda.

*Alternativa descartada:* dejar la columna inerte para siempre (respuesta A de la P3 de `add-github-code-evidence` fue explícitamente temporal) o borrarla solo del `schema.prisma` sin migración (deriva entre el schema y la base, que `prisma migrate status` y el próximo `migrate dev` reportan).

### D2 — Respaldo y comprobación previa; rollback por SQL sin pérdida

`docs/DEPLOY.md` suma una sección *Migración `retire_featured_repository_stars` (destructiva)*, con el formato de `retire_accent_color`:

- Sobre una base vacía (el primer deploy) la columna se crea en `init` y se borra en esta migración sin filas.
- Con datos, **antes** del deploy: `SELECT count(*) FROM "FeaturedRepository" WHERE "stars" IS NOT NULL;`. Si da más de 0, `pg_dump -Fc` del § 7 (o un backup de Railway) y anotar los valores si interesan; no hay otro lugar donde guardarlos.
- **Rollback:** `ALTER TABLE "FeaturedRepository" ADD COLUMN "stars" INTEGER;` y volver a desplegar la imagen anterior. El código anterior funciona con la columna nula (no la lee ni la escribe), así que el rollback no necesita restaurar el respaldo salvo que se quieran recuperar los valores.

La base local del owner tiene la columna y hoy 0 repositorios, pero la implementación no lo asume: la comprobación va en las tareas (6.2) contra la base que se migre.

### D3 — El seed olvida `stars` en vez de rechazarla

Sale `stars?: number` de `SeedFeaturedRepository` y la validación de tipo de `seed-source.ts`. La validación del seed no rechaza claves desconocidas en ningún objeto: un archivo anterior con `stars` sigue cargando, con la clave ignorada como cualquier otra que el seed no conoce. Los tests cambian a: «acepta un archivo con `stars` (numérica o no) y no la escribe».

*Alternativa descartada:* rechazar `stars` con código 1. Rompería archivos exportados o armados antes de `add-featured-repositories` sin beneficio, y sería la única clave desconocida con error propio.

*Alternativa descartada:* conservar la validación de tipo. Validar un campo que no se usa obliga a documentarlo y a mantenerlo; es justo lo que este change limpia.

### D4 — Sin cambios de contrato

La API ya responde 400 a `stars` por la whitelist y no la devuelve; el OpenAPI solo la tiene dentro de la evidencia; el JSON Resume no la exporta; `seed:verify` no la compara. Ninguno cambia. La implementación lo comprueba regenerando `backend/openapi.json` (sin diferencias) y dejando en verde los tests existentes (`featured-repositories.e2e-spec.ts`: 400 por `stars` y sin `stars` en las salidas).

### D5 — `?Cache-Control`: valor por defecto, no cabecera agregada

```caddyfile
@noCache not path /assets/* /fonts/*
header @noCache ?Cache-Control "no-cache"
```

Con el prefijo `?`, Caddy difiere la directiva hasta que el handler escribió las cabeceras y pone `no-cache` **solo si la respuesta no trae** `Cache-Control`. Efecto por ruta:

| Respuesta | Hoy | Después |
|---|---|---|
| `index.html`, rutas de la SPA, `/profile-prefetch.js` | `no-cache` | `no-cache` |
| API sin política (`/api/curated-profiles/:slug`, `/health`, `robots.txt`, `sitemap.xml`) | `no-cache` | `no-cache` |
| API con política (`no-store`, `private, no-store`, `no-cache` del `resume.json`) | dos líneas: `no-cache` + la de la API | solo la de la API |
| `/assets/*`, `/fonts/*` | `public, max-age=31536000, immutable` | igual |

El comentario del `Caddyfile` explica el `?` y por qué la regla no excluye `/api/*`.

*Alternativa descartada:* sacar `/api/*` (y `/health*`, `robots.txt`, `sitemap.xml`) del matcher. Resuelve la duplicación, pero las rutas de la API sin política propia pasarían a salir **sin** `Cache-Control`: un cambio de comportamiento (caché heurística en intermediarios) que habría que compensar agregando la cabecera en el backend, ruta por ruta.

*Alternativa descartada:* `header @noCache >Cache-Control "no-cache"` (diferido, reemplaza). Pisaría el `no-store` del panel con `no-cache`: peor que hoy.

### D6 — La verificación de las cabeceras vive en el CI

El paso «Frontend · Caddy con la imagen de producción» del job `web-quality` ya levanta la imagen de `frontend/Dockerfile` con la API detrás. Se le suma un bloque que, para cada URL, cuenta las líneas `Cache-Control` (sin distinguir mayúsculas) con `curl -sS -D - -o /dev/null` y exige exactamente una con el valor esperado:

| URL | Esperado |
|---|---|
| `/` | `no-cache` |
| el primer `/assets/*.js` que referencia `/` | `public, max-age=31536000, immutable` |
| `/profile-prefetch.js` | `no-cache` |
| `/api/curated-profiles/all` | `no-cache` (puesto por Caddy) |
| `/api/curated-profiles/all/resume.json` | `no-cache` (puesto por la API, una sola vez) |

Corre en las tres piernas de la matriz; ninguna URL depende de los datos (`all` existe en los dos juegos). Además, un test de Vitest lee `frontend/Caddyfile` y comprueba que la regla `@noCache` usa `?Cache-Control`, para fallar antes del CI de Docker.

*Alternativa descartada:* solo el `curl` manual del runbook. El defecto ya pasó una vez sin que nada lo marcara.

### D7 — `Table` con `regionLabel` opcional

`Table` acepta `regionLabel?: string`. Con la prop, el contenedor lleva `role="region"`, `aria-label={regionLabel}` y `tabIndex={0}`; sin ella queda idéntico. `ShareLinkTable` usa «Visitas por enlace» y `SourceTable` «Visitas por portal». El foco visible sale de la regla global `:focus-visible` del tema, como en **Visitas por día**.

Se aplica a las dos tablas aunque **Por portal** (dos columnas) rara vez desborde: el patrón queda uniforme entre las tablas del Dashboard y un portal largo (hasta 32 caracteres) puede desbordar en pantallas angostas.

*Alternativa descartada:* contenedor siempre enfocable en `Table`. Sumaría una parada de Tab en Postulaciones y en Crear desde una vacante, cuyas filas ya tienen botones y no violan la regla.

*Alternativa descartada:* hacer `tabIndex` condicional al desborde (con `ResizeObserver`). Más código y estado para ahorrar una parada de Tab; el proyecto ya usa la región siempre enfocable en **Visitas por día**.

*Alternativa descartada:* envolver la tabla en otra `div` con `role="region"` desde el Dashboard. No sirve: el que desplaza es el contenedor interno de `Table`.

### D8 — `a11y:check` produce visitas de persona con enlace y portal

Con panel, después de `seedApplications`, el script corre `seedShareLinkVisits(session, home)`, donde `home` es el perfil `all` de la lista del panel (público en los dos juegos de datos; el primero de la lista puede ser privado y entonces la visita no se registra):

1. Con la sesión del panel, busca en los enlaces de `all` uno con la etiqueta «Auditoría a11y — enlace de seguimiento con etiqueta larga para el móvil» y, si no existe, lo crea con portal `linkedin`. Idempotente.
2. Desde Node (`fetch`, sin cookies) pide `GET ${BASE}/api/curated-profiles/all?via=<código>` dos veces y `?src=portal-de-empleo-ejemplo` una vez, con un User-Agent de Chrome de escritorio sin `HeadlessChrome`. La API las clasifica `HUMAN` (sin sesión, User-Agent fuera de la lista de bots) y las atribuye en segundo plano.
3. Con la sesión, consulta `GET /api/admin/analytics/views` hasta ver `byShareLink` y `bySource` con filas (hasta 5 s). Si no llegan, lo informa como problema de preparación.

Entrada nueva `admin-dashboard-tablas` (`/admin`), en los dos viewports, cuyo `prepare` exige en el DOM las dos tablas con filas y, en móvil, que el contenedor de **Por enlace** desborde (`scrollWidth > clientWidth`). Si los datos no producen el escenario, la entrada falla con código 1 en lugar de pasar en vacío. La entrada `admin` existente no cambia.

Solo corre en una base descartable (`A11Y_CHECK_DISPOSABLE_DB=1`, como el resto del script): las visitas suman a `views` del perfil y a los totales del Dashboard.

*Alternativa descartada:* interceptar `GET /api/admin/analytics/views` en el navegador y responder un fixture. No escribe en la base, pero audita un JSON armado a mano que puede divergir del contrato y no ejercita el camino real (`?via=` → `HUMAN` → agregado → tabla).

*Alternativa descartada:* agregar visitas con enlace a `exampleViews` del ejemplo. Cambia los números documentados del ejemplo (105 visitas, tablas vacías en R9 y TC-18) y solo cubriría la pierna `a11y-example`.

### D9 — Manual: TC-53 y ajustes puntuales

- **TC-53 — Recorrer las tablas del Dashboard con el teclado en el celular** (próximo libre después de TC-52): precondición de TC-41 (al menos una visita con enlace y otra con portal), viewport de 375 px, Tab hasta **Por enlace**, flecha derecha, contorno visible; lo mismo en **Por portal**. Sin captura nueva (el Dashboard ya tiene la de TC-18); `manual:check` lo exige alineado en `MANUAL.md` e `index.html`.
- B2 (*Dashboard*), *Acciones y avisos*: una oración sobre las tablas desplazables con teclado.
- `docs/DATA-POPULATION.md`: sale la fila `stars` de la tabla de § 12 y la oración de § «Repositorios destacados»; se aclara que una clave `stars` de un archivo viejo se ignora.
- `docs/DEPLOY.md` § Caddy: «el HTML y todo lo demás, con `no-cache`» pasa a «con `no-cache` salvo que la API mande su propio `Cache-Control`, que se respeta».

## Risks / Trade-offs

- **[DROP con datos]** Una base con repositorios cargados por el seed anterior a `add-featured-repositories` puede tener `stars` no nulas, que se pierden. → Ninguna vista ni salida las muestra desde ese change; comprobación previa y `pg_dump` (D2); rollback del esquema por SQL sin restaurar.
- **[Ventana entre la migración y el código nuevo]** En Railway el `preDeployCommand` corre antes de que el contenedor nuevo reemplace al viejo. Si ya hubiera una API 1.0.0 en producción con un cliente Prisma que selecciona `stars`, sus consultas de repositorios fallarían hasta el reemplazo. → Hoy no hay producción: el change se fusiona antes del Deploy 1.0.0 y la base nace con toda la cadena de migraciones. Si el deploy llegara antes que este change, se parte en dos deploys (primero el código sin `stars` en el schema, después la migración). Lo pregunta la P2.
- **[`?` en Caddy]** El prefijo depende de la versión de Caddy (la imagen fija `caddy:2.11.4-alpine`, que lo soporta). → La tarea 3.2 corre `caddy validate` y `caddy adapt` con esa imagen y el CI (D6) lo comprueba en la imagen real.
- **[Visitas de la auditoría]** D8 suma visitas `HUMAN` a la base de la auditoría. → Solo con `A11Y_CHECK_DISPOSABLE_DB=1`; el script ya se niega sin ella.
- **[Clasificación del User-Agent]** Si la lista de bots llegara a incluir el User-Agent elegido, las visitas serían `BOT` y las tablas quedarían vacías. → El `prepare` lo detecta y falla con un mensaje claro en vez de pasar en vacío.
- **[Parada de Tab extra]** **Por portal** suma una parada aunque no desborde. → Mismo criterio que **Visitas por día**; aceptado.

## Migration Plan

1. Fusionar antes del Deploy 1.0.0. En local: `npm run prisma:migrate` aplica `retire_featured_repository_stars` sobre la base del owner (con la comprobación previa de D2).
2. En el primer deploy, el `preDeployCommand` (`prisma migrate deploy`) aplica toda la cadena sobre la base vacía.
3. Rollback: SQL de D2 más la imagen anterior; para Caddy y el panel, la imagen anterior de `web`.

## Open Questions

- **P1 [no bloqueante] — Guarda en la migración.** A) `DROP COLUMN` directo con comprobación previa y respaldo documentados (D1, D2); B) un bloque `DO` que aborte la migración si alguna fila tiene `stars` no nula. **Recomendación: A.** B frena el deploy por un dato que nada muestra y que el contrato prohíbe exponer.
- **P2 [no bloqueante] — Orden respecto del Deploy 1.0.0.** A) fusionar este change antes del primer deploy, en un solo paso (D1); B) si el deploy sale antes, partirlo en dos deploys (código sin `stars`, después la migración). **Recomendación: A.** Es la razón de hacerlo ahora; B queda descripta en Risks por si el orden cambia.
- **P3 [no bloqueante] — Alcance de `regionLabel`.** A) solo **Por enlace** y **Por portal** (D7); B) también las tablas de Postulaciones y Crear desde una vacante, para uniformar. **Recomendación: A.** Esas tablas tienen botones en cada fila, no violan la regla y una parada de Tab más no aporta.
