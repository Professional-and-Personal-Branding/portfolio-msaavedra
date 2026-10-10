# Verificación — add-printable-one-page

Ejecutada el 9 de octubre de 2026 en la rama `feat/printable-one-page` (sobre `main` `a5de8cd`), con Chrome del sistema (`C:/Program Files/Google/Chrome/Application/chrome.exe`), Postgres local en el 5434 y la API en el 3300. Las salidas literales están en `verification/`.

## Respuestas del owner (2026-10-09)

| Pregunta | Respuesta | Dónde quedó |
|---|---|---|
| P1 — ¿Quién ve el botón? | A: todos los perfiles resueltos, incluida la home | `design.md` § Decisiones resueltas, D9 |
| P2 — ¿Qué es imprescindible? | A: los límites de D3 (ajustados después, ver Desvío 1) | `design.md`, D3 |
| P3 — ¿La URL impresa de un `PROTECTED` lleva el token? | A: no | `design.md`, D8 |
| P4 — ¿Cierra el ítem *Export PDF de perfil*? | A: sí, aclarando que el PDF lo genera el navegador | `design.md`, D12; checklist, I18N y ARCHITECTURE |

## Resultados

| Tarea | Estado | Evidencia |
|---|---|---|
| 1.1–1.3 Selección | Hecho | `print-sheet.spec.ts` (26 tests), claves `print.*` con su test |
| 2.1–2.5 Hoja y estilos | Hecho | `PrintableSheet.test.tsx`, `CuratedProfileView.print.test.tsx`, el CSS del build trae `@page{margin:12mm}` y la regla de `[data-motion=on]` |
| 3.1–3.3 Botón | Hecho | `PrintButton.test.tsx`; sin `beforeprint`/`afterprint` en `src`; JS inicial 88 kB gzip (más 87 de react, 42 de motion y 10 de query, bien debajo de 400 KB) |
| 4.1–4.2 `print:check` | Hecho | `puppeteer-core@25.13.0` solo en `devDependencies`; con `PRINT_CHECK_PAPERS=A4,A5` el script falla y lo informa: `verification/4.2-print-check-falla-a5.txt` |
| 4.3 Corrida sobre el seed | Hecho: 56/56 casos con una página | `verification/4.3-print-check-seed.txt` |
| 4.4 Corrida sobre `portfolio` | Hecho: 56/56 casos con una página | `verification/4.4-print-check-owner.txt` (ver Efecto lateral) |
| 5.1–5.4 Documentación | Hecho, salvo `CLAUDE.md`, que se actualiza al archivar | diff de `docs/` |
| 6.1 Suites | Hecho | `verification/6.1-suite.txt` |
| 6.2 App real | **Parcial**, ver abajo | `verification/6.2-checks-protegido-y-click.txt`, `verification/pdf/`, `verification/screen-con-boton.png` |
| 6.3 Firefox | **Pendiente**: no hay Firefox instalado en esta máquina | — |
| 6.4 Contenedor `web` con CSP | Hecho | `verification/6.4-csp-contenedor-web.txt` |
| 6.5 `openspec validate` | Hecho: el change valida y `--all --strict` da 33/33 | `verification/6.5-validate.txt` |
| 6.6 Cierre | `portfolio_print_check` eliminada (ver abajo) | — |

### Páginas por perfil (tareas 4.3 y 4.4)

14 perfiles (los 13 de las plantillas y `all`; en la corrida sobre el seed, uno de ellos como `PROTECTED` con token) × `es`/`en` × tema del perfil y `?theme=modern-dark&layout=sidebar` = **56 casos por papel**. En todos, A4 = 1 página y Letter = 1 página, con `printBackground: false`. El contraste mínimo del texto de la hoja contra blanco es **9,74:1** (el gris atenuado `#444`; la tinta `#111` da 18,9:1), contra el 4,5:1 exigido. También se comprueba en cada caso que la hoja se ve al imprimir y que el layout de pantalla no.

### Medición del ajuste de límites (Desvío 1)

Alto de la hoja con el ancho de A4 (703 px), contra el alto útil de Letter (965 px; A4 tiene 1032 px):

| Perfil | Límites iniciales (6 / 6 / 3) | Límites finales (3 / 3 / 2) |
|---|---|---|
| `tech-lead-dotnet` (el peor) | 1170 px: no entra | 943 px |
| `generalist-polyglot` | 1154 px | 927 px |
| `fullstack-nest-react` | 1137 px | 910 px |
| `all` | 1119 px | 892 px |
| `devops-platform` (el más corto) | 1001 px | 848 px |

(Experiencias en una línea / categorías de skills / logros por experiencia.) El margen del peor caso es de 22 px en Letter.

### 6.2 — qué se hizo y qué no

Hecho, contra la base descartable `portfolio_print_check` con la API en el 3300 y Vite en el 5173:

- Un `PROTECTED` sin token no muestra el botón ni monta la hoja. Con `?token=…&theme=elegant&layout=sidebar&lang=en`, la URL impresa es `http://localhost:5173/backend-payments-ror?lang=en`: sin `token`, `theme` ni `layout`.
- Al pulsar el botón, `window.print` se llama una vez, no sale ninguna petición nueva y el contador de `ProfileView` queda igual (189 antes, 189 después).
- Los PDF del `print:check` están en `verification/pdf/`: `tech-lead-dotnet` en A4 y Letter (`es`), `all` en Letter (`en`) y `tech-lead-dotnet?theme=modern-dark&layout=sidebar` en A4. Cada uno tiene una página.
- La vista de pantalla sigue igual, con el botón en la barra: `verification/screen-con-boton.png`.

No se hizo:

- Las capturas de la **vista previa del diálogo de impresión** de Chrome (Ctrl+P): el diálogo es interfaz del navegador y no se puede capturar desde `puppeteer`. Los PDF de `page.pdf` usan el mismo motor de compaginación y los mismos márgenes de `@page` (se comprobó contra el PDF que Chrome respeta los 12 mm), pero no son la captura del diálogo.
- La corrida contra la base `portfolio` del owner (la tarea pide `portfolio`): se hizo contra la descartable para no sumar más visitas a la base real después de la corrida 4.4 (ver Efecto lateral).
- "Ctrl+P con animaciones activas sin hacer scroll": lo cubre `print:check` (emula el medio `print` al cargar, sin scroll, con `modern-dark`, que tiene animaciones activas) y el test que prueba que la hoja no tiene `data-motion`.

## Desvíos

1. **Límites de D3 bajados (tarea 4.3).** Con los valores iniciales de la spec (6 experiencias en una línea, 6 categorías de skills, 3 logros por experiencia), los 14 perfiles daban **dos páginas** en A4 y en Letter. Se aplicó el procedimiento que ya fija D3 (bajar en orden: experiencias en una línea, categorías de skills, logros por experiencia, y actualizar spec y diseño a la vez). Quedaron en **3 / 3 / 2** y bastó con eso; no se tocaron las experiencias en detalle, las tecnologías ni los otros bloques. Se actualizaron `design.md` (tabla y párrafo de ajuste de D3, P2), la spec (requisito *Límites de contenido* y sus escenarios) y `PRINT_LIMITS`. Es un recorte de contenido fuerte (una hoja con 3 experiencias en detalle y 3 más en una línea, de 15 en total): **si el owner prefiere otro balance, es el momento de decidirlo** (por ejemplo, 2 experiencias en detalle y más en una línea, o 8,5 pt para el cuerpo), porque con el cuerpo en 9,5 pt y los datos reales no hay más aire.
2. **Dos ajustes de maquetación sin cambio de spec:** la lista de skills va a 8,5 pt (hasta 2 líneas por categoría, no una) y el relleno vertical de los bloques es menor. El cuerpo sigue en 9,5 pt.
3. **La hoja lleva `aria-hidden="true"` además de `display: none`.** jsdom no aplica el CSS de Tailwind, así que sin él los 8 tests existentes que buscan `heading` `h1` por rol encontraban dos. En pantalla no cambia nada (`display: none` ya la saca del árbol de accesibilidad).
4. **Recortes dentro de una entrada sin marca individual.** Las tecnologías (`+N`) y los skills (`+N`) dicen cuántos faltan; los logros recortados no (la hoja muestra 2 de N). Los cubre la línea *Versión completa* del pie. La spec pide una línea de omitidos por recorte de **cantidad de entradas**, y eso se cumple.
5. **`print:check` suma tres variables de entorno** que la tarea no pedía: `PRINT_CHECK_SLUGS` (acotar perfiles), `PRINT_CHECK_PAPERS` (el papel es configurable; con `A5` el script tiene que fallar, que es como se verificó la tarea 4.2 sin tocar los datos) y `PRINT_CHECK_OUT` (guardar los PDF).
6. **Sin la etiqueta *Actual* en la experiencia vigente.** La hoja no la imprime: el período ya termina en *Presente*.
7. **Dato fuera de este change:** en inglés, el nivel de los idiomas sale como lo guarda la base (`Nativo`, `B1-B2`): `LanguageResponse.level` no está localizado en la API.
8. **Orden de las tareas.** Los tests de `print-sheet.spec.ts` y `PrintableSheet.test.tsx` se escribieron antes de la implementación de cada pieza en la misma pasada, pero no se corrieron en rojo antes (la verificación "fallan antes de 1.2" no quedó registrada).

## Efecto lateral en la base del owner

La corrida de la tarea 4.4 (`print:check` contra la API conectada a `portfolio`, sin seed y sin escrituras manuales) abrió 56 páginas con `HeadlessChrome`, así que **la tabla `ProfileView` de `portfolio` sumó 56 visitas** (entre 01:48 y 01:50 UTC del 10 de octubre). Se pueden reconocer por el `userAgent` y, si el owner quiere, borrarlas con `delete from "ProfileView" where "userAgent" ilike '%HeadlessChrome%' and "viewedAt" > '2026-10-10 01:40'`. No se borraron: son datos del owner. Conviene tenerlo en cuenta antes de volver a correr `print:check` contra una base real (o apuntar a la descartable).

## Base descartable

`portfolio_print_check` se creó con `createdb`, `prisma migrate deploy`, `npm run seed` y `npm run seed:verify` (13 plantillas, "La base coincide con cv-data.json"); un perfil (`backend-payments-ror`) se pasó a `PROTECTED` con un token de prueba. Se eliminó al cerrar (tarea 6.6).

## Pendientes para el owner o la sesión principal

- 6.3: probar TC-31 en Firefox (no hay Firefox en esta máquina) y registrar si compagina en una hoja.
- 6.2: las capturas del diálogo de Ctrl+P en Chrome, a mano (o aceptar los PDF como evidencia).
- Decidir el balance de contenido del Desvío 1.
- `CLAUDE.md`: la línea del change en la lista de la ronda 1.1 se agrega al archivar.
