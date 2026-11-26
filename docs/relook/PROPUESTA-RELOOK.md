# Propuesta de re-look visual: portfolio-msaavedra

**Fecha:** 2026-11-25. **Estado:** propuesta, pendiente de aprobación del owner.

**Recomendación:** quedarse con **shadcn/ui** y re-tematizarlo. Los cambios para el usuario:
- campos que se ven;
- tipografía fluida que respeta el zoom y el escalado del sistema;
- objetivos táctiles de 44 px;
- tablas legibles en el teléfono;
- transiciones sobrias entre perfiles.

No se cambia ninguna librería, no se toca el contrato de datos y no hay migración.

**Resultado del panel:** shadcn/ui ganó por mayoría absoluta (3 de 3 jueces). Plan B: tokens derivados en OKLCH.

**Criterio de referencia:** las guías [GoogleChrome/modern-web-guidance](https://github.com/GoogleChrome/modern-web-guidance) (Apache-2.0, versión del 2026-11-23), puntuadas como el criterio `modernidadWeb`, con peso 15.

## Qué hay hoy

| Aspecto | Estado |
|---|---|
| Stack | React 19.2, Vite 8, TypeScript 5.9 y Tailwind 4.3 (`@theme inline`) |
| Componentes | shadcn/ui (new-york) sobre `radix-ui`, `motion` y `lucide-react`: 20 componentes en `src/shared/components/ui` |
| Temas | Tokens en la base (`Theme` más `themeOverrides`) que se aplican como `--t-*` en el contenedor raíz en runtime. Hay 5 presets y `paper` para impresión, y derivados AA calculados en TS (`accent-ink`, `text-dim`, `success-ink`, `danger-ink`) |
| Restricciones | `a11y:check`, `perf:budget` (155 KB gzip), Lighthouse mobile de 85 o más, `print:check`, sin PWA ni service worker y 12 specs de `themes/` que verifican tokens y contraste |

**Diagnóstico** (verificado contra el código):

1. **Bordes de campos invisibles.** `--color-input` es `--t-border`, que da entre 1,18 y 1,44:1 contra el fondo en los cinco presets. Falla el criterio WCAG 1.4.11, que pide 3:1 o más para controles. Es el problema más serio y lo marcaron los tres jueces.
2. **Tamaños en px y alturas fijas.**
   - Hay 11 usos de `text-[10px]` y `text-[11px]`, y `h-9` en Button, Input y Select.
   - Eso va contra las guías `typography` y `respect-os-text-scale`: con el texto agrandado se recorta, y en el teléfono los objetivos táctiles quedan de 36 px.
3. **Estados que dependen solo del color.**
   - El perfil activo del menú se marca solo con `bg-brand-gradient`.
   - El h1 usa un degradado recortado en el texto.
   - En `forced-colors` se pierden los dos.
4. **Tablas del Dashboard** sin encabezado fijo ni versión apilada (guía `responsive-table`).
5. **Movimiento sin tokens** y sin continuidad al cambiar de perfil (guía `same-document-transitions`).

**Hallazgo lateral.** La CSP real de `frontend/Caddyfile` (línea 88) permite `style-src 'unsafe-inline'` y Google Fonts. Los dos motivos:
- `sonner` y los componentes de Radix con `react-remove-scroll` inyectan `<style>`;
- `themes/fonts.ts` carga 5 familias desde Google.

Lo que se daba por hecho («sin estilos en línea ni terceros») no es cierto hoy. Vale para cualquier candidato, y no bloquea el deploy.

## Lenguaje visual propuesto

| Dimensión | Hoy | Propuesto |
|---|---|---|
| Tipografía | Inter propia con tamaños fijos (h1 de 36 a 60 px), rótulos de 10 y 11 px y eyebrows con tracking de .15em | Inter sin bytes nuevos. Escala fluida `--t-step--1…4` con `clamp(rem + vw)` por `--t-scale` y un máximo de 2,5 veces el mínimo, acotada a `@media screen`. Mínimo de 0,75rem. `text-wrap: balance` en títulos y `pretty` en resúmenes. Mono del sistema con `tabular-nums` para chips y cifras. `font-size-adjust` con `@supports` |
| Color | 8 roles en hex con derivados de tinta AA | Los mismos 8 roles más derivados que no se guardan:<br>• `--t-border-strong`, de 3,06 a 3,13:1 medido, con un respaldo para `paper` y para `themeOverrides`;<br>• `--t-success` y `--t-danger` desde `css-vars.ts`, sin literales en `theme.css`;<br>• `--t-surface-raised` y `--t-accent-tint` con `color-mix` en oklab;<br>• `forced-colors` resuelto |
| Forma | `rounded-md` fijo (`--t-radius` menos 2 px) | `--t-radius-sm`/`-md` proporcionales al tema y dos niveles de sombra (en oscuro, la elevación va por superficie) |
| Densidad | `h-9` en todo | `min-block-size` de 40 px, y 44 px con `pointer: coarse`. Tarjetas como contenedor (`@container` en lugar de `md:`) |
| Movimiento | `motion/mini` diferido de 550 ms y nada entre perfiles | Tokens `--t-dur-*` y `--t-ease-*`. Entrada scroll-driven con detección y `motion/mini` como alternativa. View transition entre perfiles con el foco al h1. Sin animación con `reduce` ni en impresión |
| Iconografía | lucide, trazo 2 | lucide con trazo 1,75. Los estados llevan siempre ícono y texto. El «Close» del diálogo se localiza |

El hero pierde los clichés de plantilla:
- el h1 pasa a color sólido, con una línea de acento de 3 px debajo del headline;
- el glow queda solo en el CTA principal;
- los eyebrows bajan el tracking a .08em.

## Tokens

Mismo esquema `Theme.tokens`. Lo nuevo es derivado: se calcula en `css-vars.ts`, igual que `--t-accent-ink`, o es una expresión de `theme.css`.

```css
:root {
  --t-border-strong: #636a7b;   /* derivado: border→text hasta ≥ 3:1 vs bg/bgSoft/card, con respaldo */
  --t-success: #00bc7d;  --t-danger: #dc2626;      /* emitidos desde SUCCESS/DANGER */
  --t-surface-raised: color-mix(in oklab, var(--t-card) 92%, var(--t-text));
  --t-accent-tint:    color-mix(in oklab, var(--t-accent) 12%, var(--t-card)); /* sumarlo a inkSurfaces */
  --t-shadow-1: 0 1px 2px color-mix(in oklab, var(--t-text) 8%, transparent);
  --t-shadow-2: 0 12px 32px color-mix(in oklab, #000 28%, transparent);
  --t-step--1: calc(0.8125rem * var(--t-scale));
  --t-step-1:  calc(clamp(1.125rem, 1.05rem + 0.3vw, 1.25rem) * var(--t-scale));
  --t-step-2:  calc(clamp(1.375rem, 1.2rem + 0.7vw, 1.75rem) * var(--t-scale));
  --t-step-3:  calc(clamp(1.75rem, 1.4rem + 1.4vw, 2.5rem) * var(--t-scale));
  --t-step-4:  calc(clamp(2.25rem, 1.5rem + 3.2vw, 4rem) * var(--t-scale));
  --t-font-mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  --t-control-h: 2.5rem;
  --t-radius-sm: calc(var(--t-radius) * .5);  --t-radius-md: calc(var(--t-radius) * .75);
  --t-dur-fast: 120ms;  --t-dur-base: calc(200ms * var(--t-motion));  --t-dur-slow: calc(450ms * var(--t-motion));
  --t-ease-out: cubic-bezier(.2,.8,.2,1);  --t-ease-in-out: cubic-bezier(.4,0,.2,1);
}
@media screen and (pointer: coarse) { :root { --t-control-h: 2.75rem; } }

@theme inline {
  --color-input: var(--t-border-strong);       /* antes --t-border (1,18–1,44:1) */
  --color-success: var(--t-success);  --color-destructive: var(--t-danger);
  --color-popover: var(--t-surface-raised);  --color-brand-tint: var(--t-accent-tint);
  --radius-sm: var(--t-radius-sm);  --radius-md: var(--t-radius-md);
  --text-step-1: var(--t-step-1); /* … step--1 a step-4 */
  --font-mono: var(--t-font-mono);  --shadow-1: var(--t-shadow-1);  --shadow-2: var(--t-shadow-2);
}

/* Entrada scroll-driven: con 'to' EXPLÍCITO (corrige O-shadcn-ui-1, ver Arbitraje) */
@supports (animation-timeline: view()) {
  @media screen and (prefers-reduced-motion: no-preference) {
    [data-motion='on'] { animation: t-enter linear both; animation-timeline: view(); animation-range: entry 0% entry 40%; }
  }
}
@keyframes t-enter { from { opacity: 0; translate: 0 20px; } to { opacity: 1; translate: none; } }
```

**Contraste medido** de `--t-border-strong` contra bg, bgSoft y card:

| Preset | Color | Mínimo |
|---|---|---|
| modern-dark | `#636a7b` | 3,10:1 |
| modern-light | `#858c99` | 3,09:1 |
| minimal | `#8e8e91` | 3,13:1 |
| elegant | `#746f64` | 3,09:1 |
| corporate | `#888c95` | 3,06:1 |

El texto queda igual: text/bg entre 14,9 y 17,7:1, y textMuted/card entre 6,56 y 7,73:1.

## Componentes

| Hoy | Propuesto | Cambio |
|---|---|---|
| Button (`h-9`, `rounded-md`) | Misma API. `min-h` igual a `--t-control-h`, `--radius-md` y duración por token | Re-tematizar |
| Input y Textarea (borde de 1,2 a 1,4:1) | Borde con `--t-border-strong`. Error con `:user-invalid` además de `aria-invalid`, más ícono y `aria-describedby` | Re-tematizar |
| Select, Checkbox, Switch y Tabs (Radix) | Borde fuerte. La pestaña activa se marca con subrayado de 2 px, no solo con el color | Re-tematizar |
| Dialog, AlertDialog y Sheet (Radix) | `--t-surface-raised`, overlay con `color-mix`, cierre localizado y `overscroll-behavior: contain` | Re-tematizar |
| DropdownMenu (menú de perfiles) | Ítems de 44 px en pantallas táctiles. Rótulos de 0,75rem con peso 600. El ítem activo lleva tinte, borde fuerte, check y `aria-current` | Re-tematizar |
| Table | `caption`, thead fijo dentro de un contenedor con alto máximo, primera columna fija y versión apilada con `@container` y roles explícitos | Re-tematizar |
| Badge y chip | Mono de 0,75rem sobre un tinte de acento. Los estados llevan ícono y texto | Re-tematizar |
| Card y `surface` | `container-type: inline-size` y anillo de foco con `:has(a:focus-visible)` | Re-tematizar |
| Tooltip y Sonner | Sin cambios, salvo los tokens. Sonner sale solo si se decide cerrar la CSP (F0) | Sin cambio |
| MotionSection | La vía CSS cuando `CSS.supports` da verdadero; si no, importa `motion/mini` como hoy | Re-tematizar |
| Navegación entre perfiles | View transition del mismo documento con el foco al h1 | Nuevo |

## Pantallas clave

| Pantalla | Antes | Después | Tarea que mejora |
|---|---|---|---|
| Perfil público (hero y secciones) | h1 con degradado fijo, rótulos de 10 y 12 px, y una timeline que mueve el texto en hover | h1 sólido y fluido. Jerarquía de nombre → headline en `accent-ink` → resumen de 68ch. Chips mono. En hover solo cambia el borde | Que un reclutador vea rol, empresa y stack en menos de 10 segundos, también en el teléfono y con texto grande |
| Barra superior y menú de perfiles | Disparadores de 36 px. Activo marcado solo por un degradado. Salto brusco entre perfiles | Disparadores de 44 px en táctil. Activo accesible también en `forced-colors`. Transición de 200 ms con el foco al h1 | Comparar perfiles sin perder la orientación ni el foco |
| Formularios CRUD y customizador | Casi no se ve dónde escribir. Error marcado solo en rojo. Sin vista de contraste | Campos de 3:1 o más. Error al salir del campo, con ícono y anuncio. Contraste en vivo por color (con `contrast.ts`) | Cargar el CV sin errores y elegir colores que pasen AA |
| Dashboard | Scroll horizontal sin encabezado. Cifras en Inter proporcional | Caption y thead fijo. Por debajo de 36rem de contenedor, se apila. Cifras con `tabular-nums` | Saber desde el teléfono qué enlace o portal trajo visitas |
| Constructor y preview | Breakpoints por viewport. Ocultos con un punteado de 1,3:1 | El preview es un contenedor fiel. Ocultos con un punteado de 3:1 o más y un ícono | Ver con fidelidad qué entra en el perfil de una vacante |

## Viabilidad técnica (agente frontend)

**Veredicto:** viable con condiciones.

**Peso agregado:**
- 0 KB de JS en el arranque público, porque no se suma ninguna dependencia;
- entre 1,5 y 3 KB gzip de CSS;
- donde el navegador soporta animaciones scroll-driven, el chunk de `motion` (unos 3 KB) deja de pedirse.

**CSP:** no agrega nada en línea ni de terceros. Tampoco cierra la CSP actual: eso es la F0, común a cualquier candidato.

**Pruebas:** hay que ajustar entre 10 y 12 archivos: `contrast`, `css-vars`, `status-color-usage`, `brand-ink-usage`, `motion-section`, `entrance-animation`, `table`, `AdminLayout.responsive`, `layouts`, `ExperienceTimeline` y `Dashboard`. Las pruebas que hoy buscan por clase pasan a consultas por rol y nombre.

**Esfuerzo real:** medio, entre 9 y 13 días, frente a los 5 a 9 que estimó el proponente. Cambian unos 40 a 50 archivos.

**Soporte:**
- shadcn CLI 4.23.1 y Tailwind 4.3.5, los dos del 2026-11-25;
- radix-ui 1.8.1 (2026-10-14) y motion 14.14 (2026-11-13), todos con licencia MIT;
- lucide 1.80 (ISC).

shadcn sigue manteniendo Radix junto a Base UI, que es el default para proyectos nuevos desde julio de 2026. Los proyectos existentes no necesitan migrar.

**Objeciones aceptadas y cómo se resuelven:**
- **O-1 (grave): keyframe sin `to`.** Está confirmado en `theme.css:204`. Se agrega el `to` explícito y `MotionSection` importa `motion` solo si `CSS.supports` da falso (F4).
- **O-2: view transitions entre perfiles.** El perfil llega por TanStack Query después de navegar, así que la transición capturaría el esqueleto de carga. Hay que esperar los datos (loader o `placeholderData`). Esa parte es la F5, que es opcional; si el LCP no aguanta, queda solo un fundido.
- **O-3: tinte nuevo y tinta del acento.** `--t-accent-tint` se suma a `inkSurfaces`, para que `accent-ink` se valide también sobre esa superficie.
- **O-4: thead fijo.** Para que funcione, el contenedor necesita un alto máximo.
- **O-6: alturas de 44 px.** Cambian la geometría de la barra a 375 px, así que hay que vigilar el CLS y el LCP con `perf:check`.
- **O-7: `color-scheme` del documento.** Se fija según `tokens.mode`, no como `dark light` genérico.
- **O-8: respaldo de `border-strong`.** Hace falta un respaldo para `paper` y para `themeOverrides` arbitrarios.

## Plan por fases

Cada fase deja la app funcionando, con las pruebas y los gates en verde. Se haría como change de OpenSpec, `relook-shadcn-tokens`, con `frontend` como implementador.

| Fase | Qué se hace | Terminada cuando |
|---|---|---|
| F0 (opcional, decisión del owner) | Toast propio con `role=status` en lugar de sonner. Las 5 familias alojadas en `/fonts` o retiradas. Radix con `react-remove-scroll` aislado. CSP sin `'unsafe-inline'` ni Google | `caddyfile.spec`, `fonts.spec`, `a11y:check` y `perf:budget` en verde |
| F1 Tokens (2 días) | `border-strong` con respaldo, `success` y `danger` emitidos, tintes dentro de `inkSurfaces` y `color-scheme` según el modo | `contrast.spec` exige 3:1 o más en todos los presets, `paper` y overrides; `a11y:check` en verde |
| F2 Tipografía y controles (2 a 3 días) | Escala fluida solo en pantalla, fuera los px y `h-9`, y pruebas por rol | `print:check` A4 y Letter, más `perf:check` (CLS y LCP a 375 px) |
| F3 Componentes (3 a 4 días) | Badge, menú activo, tabs, card como contenedor, tabla responsive y hero sin degradado | `a11y:check` con tablas con filas y formularios con errores |
| F4 Movimiento (1 a 2 días) | Scroll-driven con `to` explícito y `motion` solo como alternativa | `motion-section` y `entrance-animation` cubren las dos ramas; `perf:budget` en verde |
| F5 View transitions (2 a 3 días, opcional) | Loader o espera de datos, `Link viewTransition`, foco al h1 y nada en `reduce` ni en impresión | `perf:check` con mediana de 85 o más, sin regresión del LCP |
| F6 (después, del plan B) | Modo «Semillas» en el customizador: deriva en OKLCH en el editor y guarda hex en `themeOverrides`. Contraste en vivo | Sin cambio de esquema; `theme-draft.spec` y `contrast.spec` en verde |

## Resultado del panel

Los tres jueces miraron con lentes distintas: usuario, mantenimiento e identidad.

| Candidato | 1.º | Borda | Ponderado | Frontend | Por qué quedó ahí |
|---|---|---|---|---|---|
| **shadcn/ui re-tematizado** (vigente) | 3 | 6 | **76,7** | Viable con condiciones | Es lo que más tareas reales mejora con menos riesgo. Se puede revertir por componente. Sus fallas graves son de ejecución y se corrigen. Techo de `modernidadWeb` = 3 |
| Tokens OKLCH (plan B) | 0 | 2 | 68,2 | Viable con condiciones | Es el mejor en identidad (4,3), pero tal como estaba escrito tiene cuatro fallas silenciosas. Su mejor parte entra en la F6 (ver abajo) |
| Primitivas nativas | 0 | 1 | 68,0 | Viable con condiciones | Es el más moderno (`modernidadWeb` 4,3) y el más liviano (rendimiento 5). En contra: jsdom no trae `showModal` ni `showPopover`, hay 18 archivos de prueba y 3 consumidores de Select para reescribir, rediseñar la guarda de descarte y retirar `motion`, que hoy es parte del stack fijo |

Las cuatro fallas de tokens OKLCH:
- `--spacing-xs` y `--spacing-xl` pisan `max-w-xs` y `max-w-xl`, y los formularios colapsarían;
- guardar valores en `oklch()` desactiva la garantía AA;
- el merge actual nunca dispara la derivación de las claves que faltan;
- cambiaría `modern-dark`, que es la base de los 14 perfiles.

Además, su premisa de que había un desvío entre sRGB y oklab en los tintes quedó refutada: Tailwind compone con alfa en sRGB.

**Regla que decidió:** mayoría absoluta de primeros puestos.

**Arbitraje:** hizo falta porque el ganador tenía una objeción grave propia, la O-1. La comprobé en el código: la regla `[data-motion='on']:not([data-motion-entered])` en `theme.css:204` dejaría las secciones ocultas si el keyframe no declara su final. Es un error de la propuesta y no del enfoque. Lo corregí arriba (keyframe con `to` y el `import` condicionado), y no cambia el resultado. El ganador por votos es además el de mayor puntaje ponderado.

## Condiciones y supuestos

**Condiciones comunes a todos los candidatos:**
- la CSP real, ver F0;
- definir la política de navegadores;
- el borde de 3:1 o más para controles;
- `color-scheme` según el modo;
- reglas fluidas y táctiles acotadas a la pantalla, con `print:check` en cada fase;
- rehacer la línea base de `perf:budget` y `perf:check` con un build actual, porque las mediciones del panel usaron un `frontend/dist` del 2026-10-09.

**Política de navegadores propuesta.** Hoy no hay ninguna declarada. Va a `CLAUDE.md` y a `browserslist`:

| Disponibilidad | Cómo se usa | Ejemplos |
|---|---|---|
| Baseline Widely available | Sin fallback | `:has`, container queries, `:user-invalid`, `color-mix`, `clamp` |
| Newly available | Solo con `@supports` o detección, y un fallback liviano | view transitions, scroll-driven, `light-dark()`, `font-size-adjust` |
| Limited | Solo como mejora que no rompe nada si falta | `text-wrap: pretty`, `meta text-scale`, anchor positioning, select personalizable |

**Supuestos sin verificar:**
- el ahorro real del chunk de `motion` en navegadores con scroll-driven;
- el efecto en el CLS de los 44 px en la barra a 375 px.

Los dos se miden en F2 y F4.

## Lo que tenés que decidir

1. **¿Aprobás la dirección?** shadcn/ui re-tematizado, con la F6 tomada del plan B. ¿O preferís ver antes una vista previa estática (HTML con los tokens aplicados al perfil público, con datos ficticios)?
2. **¿Se hace la F0 (CSP estricta) dentro del re-look o como change aparte?** Implica reemplazar sonner y alojar o retirar Poppins, Playfair Display, JetBrains Mono, Lora y Merriweather.
3. **¿Entra la F5 (view transitions)?** Toca la carga de datos del perfil y tiene riesgo para el LCP.
4. **¿Adoptamos la política de navegadores propuesta?**
5. **¿Cuándo?** Se recomienda después del deploy 1.0.0: la base visual actual ya pasa los gates, y nada de esto bloquea la salida.
