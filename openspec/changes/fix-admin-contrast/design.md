# Design — fix-admin-contrast

## Context

Ver `proposal.md`. Estado verificado el 2026-10-28 sobre `main` (`f833bbf`) y medido en `audit/` (README con el detalle de cada nodo):

- **La medición.** `a11y:check` con panel, contra la imagen de producción del frontend y una base descartable sembrada con `seed:example`, da **39 `color-contrast` + 1 `scrollable-region-focusable`** (todos `serious`) con `A11Y_CHECK_PROFILE=ejemplo-backend`. Sin esa variable el perfil base es `tech-lead-dotnet`, que no existe en el ejemplo: la matriz de presets audita la página 404 y salen 27 + 1, sin ningún aviso.
- **Ítems ocultos (27 nodos).** `ExperiencesPage.tsx`, `FormacionPage.tsx` (educación y certificaciones, componente `Row`) y `ProyectosPage.tsx` (proyectos y enlaces sociales) pintan la fila con `surface … ${visible ? '' : 'opacity-60'}` y `data-visible`. Las cuatro ya muestran una insignia `Badge variant="secondary"` con `EyeOff` y el texto «Oculta»/«Oculto» (`HiddenBadge` en proyectos). El panel fija `modern-dark` (`AdminShell.tsx`): `--t-text-dim` y `--t-text-muted` cumplen ≥ 4,5:1 contra `card` y `bgSoft` (D3 de `improve-a11y-and-performance`); la opacidad los baja a 2,44:1 y 3,13:1. El constructor (`ProfileBuilderPage.tsx`) marca las secciones ocultas con `text-text-dim line-through`, sin opacidad, y axe no lo reporta.
- **Insignia «Actual» (12 nodos).** `ExperienceTimeline.tsx` pinta `border-emerald-500/30 bg-emerald-500/15 … text-emerald-500` cuando `experience.current`. Tailwind 4 resuelve `emerald-500` a `#00bc7d`. Contra el tinte sobre `card` blanco (`#d9f5ec`) mide 2,14:1; en `modern-dark` y `elegant` pasa (5,31:1 y 4,91:1). El panel tiene otra insignia «Actual» con `text-emerald-500` sobre `card` oscuro, que hoy pasa. `theme.css` declara que no se escriben colores literales fuera de `presets/`; estas dos son las excepciones que quedan.
- **Barras por día (1 nodo).** `DashboardPage.tsx` (`DayBars`) pinta `<ol class="flex h-40 … overflow-x-auto">` con 30 `<li class="min-w-4 flex-1">`. A 375 px no entran y la lista se desplaza; nada adentro es enfocable (las barras son `role="img"`). A 1350 px entran y axe no reporta nada.
- **El script.** `frontend/scripts/check-a11y.mjs` arma la matriz de presets sobre `A11Y_CHECK_PROFILE` (por defecto `tech-lead-dotnet`), detecta solo los perfiles con acento bajo 4,5:1 y audita el panel si recibe credenciales. Sale con 1 ante `serious`/`critical` o fallas de teclado y con 2 sin `A11Y_CHECK_DISPOSABLE_DB=1` (`requireDisposableDb`). No comprueba que el perfil base resuelva.
- **El CI.** Job `web-quality`, matriz `check: [a11y, lighthouse]`, un servicio Postgres por pierna, `npm run seed` + `seed:verify` + `admin:bootstrap`, API en producción, imagen de Caddy y Chrome fijado. La pierna `a11y` tardó **8 min 51 s** y `lighthouse` **5 min 18 s** en la última corrida de `main` (run 40767720058). `docs/cv-data.json` no tiene ítems ocultos en esas listas ni experiencias con `current: true`; el ejemplo tiene 5 ocultos, una experiencia actual en `ejemplo-backend` y 105 visitas.
- **El seed de ejemplo.** `npm run seed:example` exige `SEED_DISPOSABLE_DB=1`, `NODE_ENV` distinto de `production` y base vacía (D6 de `add-learning-guide-and-example-data`). `seed:example:verify` compara conteos, mecanismos de cada perfil, alias y visitas.

## Goals / Non-Goals

**Goals:** 0 violaciones `serious`/`critical` de `a11y:check` con panel sobre los datos de ejemplo y sobre `cv-data.json`; que un ítem oculto se siga distinguiendo de uno visible sin perder legibilidad; que un color de estado no pueda volver a quedar ilegible con un preset o un override; que el CI audite los dos juegos de datos y que una matriz mal configurada no pase en silencio.

**Non-Goals:** ver `proposal.md` § Non-goals.

## Decisions

### D1 — Ítem oculto: insignia + borde punteado + fondo suave; nunca opacidad sobre el texto

La fila oculta deja de llevar `opacity-60`. Se distingue con tres señales que no tocan el color del texto:

1. la insignia «Oculta»/«Oculto» que ya existe (texto + ícono `EyeOff`), que es la señal que no depende del color;
2. **borde punteado** (`border-dashed`) en lugar del sólido de `surface`;
3. **fondo `bg-soft`** en lugar de `card`.

El texto conserva sus clases (`text`, `text-muted`, `text-dim`), que ya cumplen ≥ 4,5:1 contra `card` y contra `bgSoft` en cualquier tema (D3 de `improve-a11y-and-performance` calcula `text-dim` contra las dos superficies). La prueba de concepto (`audit/prueba-arreglo.txt`) lleva los 27 nodos a 0.

Las cuatro listas repiten el mismo patrón: se recomienda una sola utilidad (`@utility surface-hidden` en `theme.css`) o un componente de fila compartido en `features/backoffice/shared/`, y que `HiddenBadge` pase a ser el único componente de la insignia. La elección entre utilidad y componente queda al implementador; la regla es que **ninguna fila del panel use `opacity-*` para expresar un estado**, y un test estático lo comprueba (tarea 4.4).

Alternativas descartadas:
- **Un derivado `--t-text-hidden`** (más tenue que `text-dim` pero ≥ 4,5:1). En `modern-dark`, `text-dim` ya es el gris más tenue que llega a 4,5:1 contra `card`: no hay margen para algo más tenue y legible. Agregaría un token que en la práctica sería igual a `text-dim`.
- **Bajar la opacidad solo de los elementos decorativos** (ícono, borde). Mantiene el patrón «opacidad = oculto», que es el que se rompió, y el próximo texto que se agregue a la fila vuelve a fallar.
- **Tachar el título** (como las secciones del constructor). En una lista de datos, el tachado se lee como «borrado», que no es lo que pasa: el ítem sigue existiendo y se puede volver a mostrar.

### D2 — Color de estado derivado: `--t-success-ink`, con el mismo algoritmo que el acento

`tokensToCssVars` suma `--t-success-ink = accentInk(SUCCESS, superficies, mode)`, con `SUCCESS = '#00bc7d'` (el `emerald-500` que hoy se pinta) declarado en `themes/` y las superficies `bg`, `bgSoft`, `card` y el tinte de la insignia (15 % de `SUCCESS` sobre `bg` y sobre `card`). `theme.css` lo expone como `--color-success-ink` (`text-success-ink`) y el verde base como `--color-success` (`bg-success/15`, `border-success/30`) para el tinte y el borde. La insignia de la línea de tiempo y la del panel usan esas utilidades y ningún `emerald-*` literal.

| Preset | Hoy (`#00bc7d`) | `--t-success-ink` |
|---|---|---|
| modern-dark | 5,31:1 | `#00bc7d` (sin cambio) |
| elegant | 4,91:1 | `#00bc7d` (sin cambio) |
| modern-light | 2,06:1 | `#00754e`, 4,80:1 |
| minimal | 2,15:1 | `#007a51`, 4,67:1 |
| corporate | 2,07:1 | `#00754e`, 4,80:1 |

Como `--t-accent-ink`, el derivado **no se guarda** y responde a los overrides de `bg`, `bgSoft` y `card`. El punto verde del hero (`Hero.tsx`, `bg-emerald-500`, decorativo) puede pasar a `bg-success` por consistencia; no es texto y no cambia el contraste.

Alternativas descartadas:
- **Dos verdes fijos por modo** (`emerald-700` en claro, `emerald-500` en oscuro). Más simple, pero el owner puede cambiar `card` o `bg` con un override y el verde fijo vuelve a fallar; tampoco hay una clase `dark:` (el modo vive en los tokens, no en el documento).
- **Insignia neutra** (texto `text` con un punto verde). Pierde el color como refuerzo del estado sin necesidad: el derivado conserva el tono.
- **Un token `success` editable en el tema.** Amplía el contrato de `ThemeTokens`, el customizador y la API por un único uso. Si algún día se necesita, el derivado ya tiene dónde leerlo.

### D3 — Región de barras: contenedor enfocable con nombre, sin quitar el desplazamiento

`DayBars` envuelve el `<ol>` en `<div role="region" aria-label="Visitas por día" tabIndex={0} className="overflow-x-auto">` y el `<ol>` pierde el `overflow-x-auto`. Con foco, las flechas del teclado desplazan la región (comportamiento nativo del navegador sobre un elemento desplazable enfocado) y el indicador de foco global (`:focus-visible`, D4 de `improve-a11y-and-performance`) la marca. El nombre de la región evita que un lector de pantalla anuncie un grupo anónimo. La lista conserva su semántica y sus `role="img"` con la cifra.

`tabIndex={0}` se pone siempre, aunque en escritorio no haya desplazamiento: es un tope más en el recorrido con Tab, pero detectar el desborde en tiempo de ejecución (`scrollWidth > clientWidth` con un `ResizeObserver`) agrega estado y código para ahorrar un Tab. El recorrido de teclado de `a11y:check` en `/admin` ya mide el foco de cada control: la región entra en esa medición.

Alternativas descartadas:
- **Quitar el desplazamiento** (barras de `min-w-0`). A 375 px, 30 barras con etiqueta de fecha `whitespace-nowrap` no entran: habría que ocultar etiquetas o días, que es rediseñar el gráfico (fuera de alcance).
- **`tabIndex` sobre el `<ol>` directamente.** axe lo acepta, pero un `<ol>` enfocable sin nombre se anuncia como «lista, 30 elementos» y no dice qué es; ponerle `aria-label` a la lista y `role="region"` a la vez rompe su semántica.
- **Tabindex condicional al desborde.** Ver arriba.

### D4 — `a11y:check` verifica el perfil base y sale con 2 si no existe

Antes de abrir el navegador, el script pide `GET /api/curated-profiles/<A11Y_CHECK_PROFILE>`. Si no responde 200, imprime `El perfil base «<slug>» no existe en esta base: definí A11Y_CHECK_PROFILE con un slug público.` y sale con **2**, el mismo código que la falta de base descartable: es un error de configuración, no una violación de accesibilidad, y no abre páginas (no registra visitas). El valor por defecto sigue siendo `tech-lead-dotnet` para que la pierna `a11y` del CI no cambie.

Alternativa descartada: **elegir solo el perfil base** (el primero de `GET /api/curated-profiles` con acento propio). Cambia en silencio qué se audita cuando cambian los datos; un slug explícito con verificación es reproducible.

### D5 — El CI audita los dos juegos de datos en paralelo: tercera pierna `a11y-example`

La matriz de `web-quality` pasa a `check: [a11y, a11y-example, lighthouse]`. Cada pierna ya tiene su propio servicio Postgres, así que la nueva solo cambia la siembra y una variable:

- paso de siembra: si `matrix.check == 'a11y-example'`, `SEED_DISPOSABLE_DB=1 npm run seed:example` y `npm run seed:example:verify`; si no, `npm run seed` y `npm run seed:verify`, como hoy. `admin:bootstrap` corre en todas;
- paso de accesibilidad: `if: startsWith(matrix.check, 'a11y')`, con `A11Y_CHECK_PROFILE: ${{ matrix.check == 'a11y-example' && 'ejemplo-backend' || 'tech-lead-dotnet' }}`;
- el resto (API en producción, imagen de Caddy, Chrome fijado, artefacto `web-quality-${{ matrix.check }}` ante una falla) no cambia.

Costo: unos **9 minutos de runner** por corrida (lo que tarda hoy la pierna `a11y`) y **ningún minuto de tiempo de pared**, porque corre en paralelo con la pierna `a11y` y dura lo mismo que ella. Los fallos quedan atribuidos al juego de datos que los produjo.

Alternativas descartadas:
- **Secuencial en la pierna `a11y`**: después de la primera auditoría, `prisma migrate reset --force --skip-seed`, `seed:example`, `admin:bootstrap` y una segunda corrida. Cuesta unos 4 minutos de runner en vez de 9, pero alarga el job a unos 13 minutos de pared, mezcla los dos reportes en un mismo artefacto y una falla de la primera corrida oculta la segunda (o hay que encadenar `if: always()`). Es la opción si el owner prioriza minutos de runner (P2).
- **Reemplazar `cv-data.json` por el ejemplo en la pierna `a11y`.** Más barato, pero deja de auditar los 13 perfiles reales del owner y sus acentos, que es lo que se despliega.
- **Agregar ítems ocultos y una experiencia actual a `cv-data.json`.** Ensucia los datos del owner para satisfacer al CI.
- **Una segunda base y una segunda API en la misma pierna.** Duplica el arranque de la API y del contenedor sin ventaja frente a una pierna paralela.

## Risks

- **Cambio visual en los presets claros.** La insignia «Actual» pasa de `#00bc7d` a `#00754e`/`#007a51`. Es más oscura pero del mismo tono; en oscuro no cambia. Lo ve el owner en TC-40.
- **Un Tab más en el dashboard.** La región enfocable agrega una parada al recorrido con teclado en escritorio, donde no hay desplazamiento. Aceptado (D3).
- **Minutos de runner.** +9 min por push con el repo privado en plan gratuito (2.000 min/mes). `web-quality` pasa de unos 14 a unos 23 minutos de runner por corrida; si aprieta, P2 permite pasar a la variante secuencial sin tocar la spec.
- **Deriva del ejemplo.** Si el ejemplo pierde sus ítems ocultos o la experiencia actual, la pierna `a11y-example` deja de ejercitar estos casos sin fallar. Mitigación: `seed:example:verify` ya compara conteos con el archivo; el TC-40 documenta qué datos del ejemplo cubren cada caso.
- **Nuevos colores literales.** Un componente futuro puede volver a usar `text-emerald-*` u otro color de Tailwind como texto. El test estático de la tarea 4.4 lo bloquea en las carpetas de la vista pública y del panel.

## Migration Plan

1. Implementar D1–D3 y sus tests (grupos 2–4 de `tasks.md`) en un commit.
2. D4 en `check-a11y.mjs` y D5 en `ci.yml` (grupo 5), en el mismo PR.
3. Medición local con los dos juegos de datos sobre bases descartables (grupo 6) y documentación (grupo 7).
4. Sin migraciones ni cambios de datos: revertir es revertir el PR. El deploy no requiere pasos manuales.

## Open Questions

Resueltas el 2026-10-28 por el owner, con la opción recomendada en las tres:

- **P1 [resuelta: (a)]** — Cómo se distingue un ítem oculto: insignia + borde punteado + fondo suave (D1). Descartadas: (b) solo la insignia; (c) una atenuación con un token propio.
- **P2 [resuelta: (a)]** — Cómo se suma el ejemplo al CI: pierna paralela `a11y-example`, +9 min de runner y 0 de pared (D5). Descartada: (b) secuencial en la pierna `a11y`, +4 min de runner y +4 de pared.
- **P3 [resuelta: (a)]** — El verde de «Actual» en los presets claros se oscurece a `#00754e`/`#007a51` (D2). Descartada: (b) una insignia neutra con punto verde.

## Desvíos de la implementación (2026-10-28)

- **Numeración del manual:** el caso nuevo es **TC-40** (TC-39 lo reserva el change `classify-profile-views`).
- **Landmark duplicado (D3):** al envolver las barras en `role="region"` con el nombre «Visitas por día», la `<section aria-labelledby="por-dia">` que las contiene quedaba como un segundo landmark con el mismo nombre (axe `landmark-unique`, moderate). La sección pasó a ser un `<div>` con su `<h2>`: la región enfocable es la única con ese nombre. No cambia el aspecto.
- **Override de la tarea 4.2:** la tarea pedía un override `card: '#1E293B'` sobre `modern-light`; con el fondo claro y una tarjeta oscura no existe ningún color con 4,5:1 contra las dos superficies (el rango de luminancia es vacío), así que el derivado no puede cumplir. El test usa una tarjeta más oscura pero coherente con un tema claro (`card: '#94a3b8'`): el derivado se recalcula y cumple.
- **Tinte de la insignia:** `inkSurfaces` ahora recibe el color y la fracción del tinte (0,10 para el acento, 0,15 para el verde `bg-success/15`).
