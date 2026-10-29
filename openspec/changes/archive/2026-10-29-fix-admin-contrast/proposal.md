# fix-admin-contrast — Contraste del panel y de los estados, visto por el CI

> Primer change de la **Fase 1.2** (`docs/PROPUESTA-FEATURES.md` § 4, E8 ítem 8.6, y § 6.2). Cierra el hallazgo fuera de alcance de `add-learning-guide-and-example-data` (`verification/7.1-corrida.md`): 39 nodos `color-contrast` y un `scrollable-region-focusable`, todos `serious`, que `a11y:check` encuentra con los datos de ejemplo y no con `cv-data.json`. Reproducido el 2026-10-28 en `audit/`.

## Why

La spec `web-accessibility` promete WCAG 2.2 AA «con cualquier tema, preset, override o idioma» y una auditoría que lo demuestra. Las dos promesas fallan con datos que el owner puede crear desde el panel en cualquier momento:

1. **Los ítems ocultos del panel se leen mal.** Experiencias, formación, certificaciones, proyectos y enlaces ocultos se atenúan con `opacity-60` sobre toda la fila. La opacidad se compone sobre `--t-text-dim` y `--t-text-muted`, que `improve-a11y-and-performance` (D3) ya dejó en ≥ 4,5:1: el resultado baja a 2,44:1 y 3,13:1. Son 27 de los 39 nodos.
2. **La insignia «Actual» de la línea de tiempo es ilegible en los presets claros.** Usa `text-emerald-500` literal sobre un tinte del mismo verde: 2,14:1 en `modern-light`, `minimal` y `corporate`, en móvil y en escritorio. No deriva del tema, a diferencia del acento. Son los otros 12 nodos (la evidencia de octubre los describía como «presets claros en móvil» y «panel»: son de la vista pública y de los dos viewports).
3. **Las barras por día del dashboard no se alcanzan con teclado.** En móvil, la lista de 30 días desborda y se desplaza en horizontal, pero no es enfocable ni contiene nada enfocable: quien usa teclado no puede ver los días que quedan afuera.
4. **El CI no lo ve.** `web-quality` siembra `docs/cv-data.json`, que no tiene ítems ocultos, ninguna experiencia actual ni volumen de visitas. Además, `a11y:check` usa por defecto el perfil `tech-lead-dotnet`: contra otros datos, la matriz de presets audita una página 404 sin avisar.

## What Changes

- **Ítems ocultos sin opacidad (D1).** La fila oculta deja de bajar la opacidad del texto. Conserva la insignia «Oculto»/«Oculta», que ya existe en las cuatro listas, y suma borde punteado y fondo `bg-soft`. El texto sigue en `text`, `text-muted` y `text-dim`, que ya cumplen ≥ 4,5:1 contra `card` y `bgSoft`.
- **Insignia de estado derivada del tema (D2).** Nuevo derivado `--t-success-ink` (utilidad `text-success-ink`), calculado como `--t-accent-ink` a partir del verde actual contra los fondos y el tinte de la insignia. La insignia «Actual» de la línea de tiempo y la del panel lo usan, y el tinte deriva del mismo color. En los presets oscuros el verde no cambia; en los claros pasa a un verde más oscuro del mismo tono (≥ 4,67:1). No se guarda.
- **Región de barras enfocable (D3).** La lista de barras por día queda dentro de una región con nombre (`role="region"`, `aria-label`) y `tabIndex={0}`, con el indicador de foco del tema. Las flechas desplazan la región; la lista sigue siendo una lista.
- **`a11y:check` sobre los datos de ejemplo en el CI (D4, D5).** El job `web-quality` suma una tercera pierna en su matriz (`a11y-example`), en paralelo con `a11y` y `lighthouse`, que siembra `seed:example` y corre `a11y:check` con `A11Y_CHECK_PROFILE=ejemplo-backend`. El script sale con **2** si el perfil base no resuelve (en vez de auditar un 404).
- **Pruebas y manual.** Tests de Vitest de las filas ocultas, de la insignia, de la región y del derivado en los cinco presets. Nuevo caso **TC-40** en `docs/MANUAL.md` y `docs/manual/index.html` (con `manual:check`); TC-34 suma la fila del verde.

## Non-goals

- Cambios de dominio, de API, del OpenAPI o de la base. Todo es frontend, el script de auditoría y el CI.
- Rediseñar el dashboard o reducir los días del gráfico.
- Un tema claro para el panel (sigue fijo en `modern-dark`, `AdminShell.tsx`).
- Auditar la hoja imprimible (`paper`) con axe: `print:check` ya mide su contraste.
- Marcar `web-quality` como *required check*: el plan gratuito con repo privado no lo permite (P6 de `improve-a11y-and-performance`).
- Corregir las specs archivadas que `--strict` rechaza por longitud (estado conocido de OpenSpec 1.14.1).

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `web-accessibility`: modifica *Auditoría de accesibilidad reproducible* (MODIFIED: perfil base verificado, salida 2 si no existe, y el CI sobre los dos juegos de datos) y suma *Ítems ocultos sin pérdida de contraste*, *Insignias de estado legibles* y *Regiones desplazables alcanzables con teclado* (ADDED).

## Impact

- **Frontend (`frontend/src`):** `themes/contrast.ts` (sin cambios de firma; se reusa `accentInk`), `themes/css-vars.ts` (`--t-success-ink` y el tinte), `themes/theme.css` (`--color-success-ink`, `--color-success`), `shared/components/portfolio/ExperienceTimeline.tsx`, `features/backoffice/experiences/ExperiencesPage.tsx`, `features/backoffice/formacion/FormacionPage.tsx`, `features/backoffice/proyectos/ProyectosPage.tsx` y `features/backoffice/dashboard/DashboardPage.tsx`. Se sugiere extraer una clase o componente común para la fila oculta (las cuatro listas repiten el patrón).
- **Tests (Vitest):** `css-vars.spec.ts`, `brand-ink-usage.spec.ts` (o uno hermano para literales de color de estado), y los tests de las cuatro páginas y del dashboard.
- **Tooling:** `frontend/scripts/check-a11y.mjs` (verificación del perfil base y cabecera).
- **CI:** `.github/workflows/ci.yml`, job `web-quality`: una pierna más en la matriz. Unos 9 minutos de runner por corrida (la pierna `a11y` tardó 8 min 51 s en la última corrida de `main`, run 40767720058), sin alargar el tiempo de pared (D5; la alternativa secuencial cuesta unos 4 minutos y alarga el job, P2).
- **Bundle público:** unas decenas de bytes en `css-vars`; `perf:budget` (≤ 155 KB gzip) no debe moverse de forma apreciable.
- **Docs:** `docs/MANUAL.md` y `docs/manual/index.html` (TC-40, TC-34, línea de `a11y:check`), la línea de `a11y:check` en `CLAUDE.md` (`A11Y_CHECK_PROFILE`), `docs/CHANGELOG.md` y el roadmap de `CLAUDE.md` al archivar.
