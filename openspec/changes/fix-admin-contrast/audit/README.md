# Auditoría de partida — fix-admin-contrast

Fecha: 2026-10-28 (los reportes llevan la hora UTC, 2026-10-29T02:0x). Rama `fix/admin-contrast` sobre `f833bbf`, sin cambios de código.

## Entorno

- **Base:** `portfolio_contrast_tmp`, descartable, creada para esta corrida en el contenedor `portfolio-postgres` (`localhost:5434`) y borrada al terminar. Migrada con `npm run prisma:deploy`, sembrada con `SEED_DISPOSABLE_DB=1 npm run seed:example` y con un administrador de prueba (`ci@a11y.test`, contraseña aleatoria de un solo uso que no se escribió en ningún archivo del repo ni en un navegador). **La base `portfolio` del owner no se tocó.**
- **API:** `node dist/main` en `:3310`, `NODE_ENV=development`.
- **Sitio:** la imagen de producción (`docker build frontend`, Caddy) en `:8090` con `API_ORIGIN=http://host.docker.internal:3310`, como en el job `web-quality`.
- **Auditoría:** `npm run a11y:check -- http://localhost:8090 --out …` con `A11Y_CHECK_DISPOSABLE_DB=1`, `A11Y_CHECK_ADMIN_EMAIL` y `A11Y_CHECK_ADMIN_PASSWORD` (login por `fetch('/api/auth/login')`). axe-core 4.13.0, Chrome del sistema.

## Corridas

| Carpeta | `A11Y_CHECK_PROFILE` | Cargas | `color-contrast` (serious) | `scrollable-region-focusable` (serious) | Salida |
|---|---|---|---|---|---|
| `default-profile/` | sin definir (`tech-lead-dotnet`, que **no existe** en el ejemplo: la matriz de presets audita el 404) | 50 | 27 | 1 | 1 |
| `ejemplo-backend/` | `ejemplo-backend` | 50 | **39** | **1** | 1 |

La segunda reproduce exactamente el hallazgo de `add-learning-guide-and-example-data` (`verification/7.1-corrida.md`): 39 + 1 nodos.

## Qué son los 40 nodos

| Grupo | Nodos | Dónde | Causa | Medido |
|---|---|---|---|---|
| Ítems ocultos del panel | 27 | `/admin/experiencias` (2 en móvil, 3 en escritorio), `/admin/formacion` (4 + 4), `/admin/proyectos` (7 + 7) | La fila oculta lleva `opacity-60` (`ExperiencesPage.tsx`, `FormacionPage.tsx`, `ProyectosPage.tsx`, proyectos y enlaces). La opacidad se compone sobre `--t-text-dim` y `--t-text-muted`, que sí cumplen sin ella | `text-dim` 2,44:1 (`#4d5767` sobre `#111726`); `text-muted` 3,13:1 (`#5d6779`) |
| Insignia «Actual» en presets claros | 12 | Línea de tiempo de experiencias de `/ejemplo-backend` con `modern-light`, `minimal` y `corporate`, layouts `classic` y `sidebar`, **en móvil y en escritorio** (no solo en móvil) | `text-emerald-500` literal sobre `bg-emerald-500/15` (`ExperienceTimeline.tsx`); no deriva del tema | 2,14:1 (`#00bc7d` sobre `#d9f5ec`) |
| Región con desplazamiento | 1 | `/admin` en móvil (375 px) | `<ol class="h-40 … overflow-x-auto">` de las barras por día (`DashboardPage.tsx`, `DayBars`): 30 barras no entran y la lista se desplaza, pero no es enfocable ni contiene nada enfocable | — |

Ninguno es del panel en «presets claros»: el panel fija `modern-dark` (`AdminShell.tsx`). Lo de los presets claros es la vista pública.

### Por qué el CI no los ve

`web-quality` siembra `docs/cv-data.json`: ningún ítem tiene `visible: false` en experiencias, formación, proyectos ni enlaces, ninguna experiencia tiene `current: true` (la insignia «Actual» nunca se pinta) y el dashboard del CI tiene pocas visitas por día. El ejemplo trae 5 ítems ocultos, una experiencia actual y 105 visitas repartidas.

## Prueba del arreglo (sin tocar código)

`prueba-arreglo.txt`: misma base y mismo sitio, axe sobre las 10 páginas afectadas en los dos viewports, antes y después de inyectar en la página el equivalente de D1–D3:

```css
[data-visible="false"] { opacity: 1 !important; border-style: dashed !important; background-color: var(--t-bg-soft) !important; }
.text-emerald-500 { color: <derivado del preset> !important; }   /* #00754e modern-light y corporate, #007a51 minimal */
```

y `tabindex="0"` + `aria-label="Visitas por día"` en la lista de barras. Resultado: de 40 nodos serious a 0 en las 40 cargas.

Los colores derivados salen de `accentInk('#00bc7d', [bg, bgSoft, card, tinte 15 % sobre bg, tinte 15 % sobre card], mode)` de `frontend/src/themes/contrast.ts`:

| Preset | `#00bc7d` peor caso | Derivado | Peor caso derivado |
|---|---|---|---|
| modern-dark | 5,31:1 | `#00bc7d` (sin cambio) | 5,31:1 |
| elegant | 4,91:1 | `#00bc7d` (sin cambio) | 4,91:1 |
| modern-light | 2,06:1 | `#00754e` | 4,80:1 |
| minimal | 2,15:1 | `#007a51` | 4,67:1 |
| corporate | 2,07:1 | `#00754e` | 4,80:1 |
