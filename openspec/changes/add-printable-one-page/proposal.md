# add-printable-one-page — Imprimible de una hoja de un perfil curado

> Ronda 1.1.x. Es la propuesta `imprimible-una-hoja` de la deliberación del 4 de octubre (`docs/ROADMAP-1.1.md` § 2, puesto 7 por jueces y 13 puntos Borda), que el § 5 difirió *"1.1.x, junto al export a PDF del checklist"*. Ese export es el ítem deseable **Export PDF de perfil** de `docs/RELEASE-1.0.0-CHECKLIST.md` (🔵, 1.0.x). No abre una fase nueva de `docs/SPECS-POR-FASE.md`.
>
> La descripción original del candidato no está en el repositorio: el roadmap la cita como § 7.3, pero esa sección no existe y el catálogo completo quedó en el resultado del workflow `portafolio-feature-deliberation` (run `wf_841c542b-f34`). El alcance sale de lo que sí quedó escrito: *"útil y barato"* (esfuerzo **S**), una hoja, y que *"no cambia lo que decide una postulación"*.

## Why

Un perfil curado se manda por link, pero muchos procesos de selección siguen pidiendo un archivo: el formulario de una empresa que exige adjuntar un PDF, el reclutador que imprime para la entrevista o el que reenvía el CV al gerente por mail. Hoy, 9 de octubre de 2026, en `main`:

1. **Imprimir la vista pública da un resultado ilegible.** No hay ni una regla `@media print` en `frontend/src`. El preset por defecto es `modern-dark`: texto `#e8edf5` sobre fondo `#0a0e1a`, y los navegadores no imprimen fondos salvo que se lo pidan, así que el texto sale casi blanco sobre papel blanco.
2. **Hay contenido que directamente no sale.** El nombre del hero y los números de `stats` usan texto con degradé recortado (`bg-clip-text text-transparent`, `text-gradient`): sin fondos impresos, son invisibles.
3. **Las secciones que no se llegaron a ver salen en blanco.** `MotionSection` arranca cada sección con `opacity: 0` y la muestra con `whileInView`, que depende de un `IntersectionObserver`. Si alguien abre un perfil y aprieta Ctrl+P sin hacer scroll, todo lo que está debajo del primer pantallazo se imprime vacío.
4. **No cabe.** El perfil `all` tiene 15 experiencias, 12 categorías de skills, 6 formaciones y 8 certificaciones. Impreso tal cual son varias hojas de tarjetas, chips, barra superior y pie.
5. **El ítem del checklist sigue abierto.** *Export PDF de perfil* está pendiente desde la Fase 6, y `docs/I18N.md` § 8 ya fijó la condición: el PDF se genera bajo demanda, en el idioma pedido y desde los mismos datos, sin archivos duplicados.

## What Changes

- **Hoja imprimible en el mismo documento (D1).** La vista pública monta, junto al layout de pantalla, una hoja compacta que solo se ve al imprimir. Al imprimir se oculta todo lo demás: barra superior, pie, decoración y el layout de pantalla. Funciona igual desde el botón y desde Ctrl+P, sin ruta nueva, sin pedir nada a la API y sin dependencias de runtime.
- **Selección pura y probada (D2, D3).** Una función `buildPrintSheet` decide qué entra a partir del perfil curado ya resuelto. Respeta el orden y el ocultado que ya aplicó el backend en `sections`, deja afuera `stats` y `presence`, junta el contacto con el encabezado y aplica límites fijos: experiencias detalladas, experiencias en una línea, logros por experiencia, categorías de skills, formación, certificaciones y proyectos.
- **Truncado honesto (D4).** Lo que no entra se cuenta y se dice (*"y 6 experiencias más"*), con la URL de la versión en línea. Si algún perfil no cabe, la hoja sigue en una segunda página sin cortar ninguna entrada al medio. Nada se recorta en silencio.
- **Tinta sobre papel (D5, D6).** La hoja usa una paleta fija de papel, definida en `themes/presets/` y fuera de los presets conmutables: texto oscuro sobre blanco con cualquier preset, override o `?theme=`, sin degradés en el texto y legible sin imprimir fondos. Conserva la tipografía del perfil. Los márgenes van en `@page` y la caja de diseño cabe tanto en A4 como en Letter.
- **Las animaciones no ocultan nada (D7).** La hoja no usa `MotionSection`. Además, una regla defensiva fuerza `opacity: 1` y `transform: none` en `[data-motion="on"]` al imprimir.
- **Enlaces como texto (D8).** Email, teléfono, LinkedIn y los enlaces destacados se imprimen como texto visible. La URL de la versión en línea es la canónica, con `?lang=` si el idioma no es el por defecto, y nunca lleva `token`, `theme` ni `layout`. No hay QR.
- **Botón "Imprimir / Guardar PDF" (D9).** Va en la barra superior de la vista pública, solo cuando el perfil se resolvió, y llama a `window.print()` desde el bundle, así que no hace falta tocar la CSP. El botón no se imprime.
- **Sin analítica ni cambios de head (D10).** Imprimir no registra nada ni pide nada al servidor. El título del documento queda como está y es el nombre que el navegador propone para el PDF.
- **Verificación de "una hoja" (D11).** Tests de Vitest para la selección y la estructura, y un script `npm run print:check` con `puppeteer-core` (devDependency, usa el Chrome del sistema) que genera el PDF de cada perfil en A4 y Letter, en `es` y en `en`, y comprueba que tiene una sola página y que el texto contrasta.
- **El checklist (D12).** El *Guardar como PDF* del navegador sobre esta hoja cubre el ítem *Export PDF de perfil* tal como lo pide `docs/I18N.md` § 8. La generación de PDF en el servidor queda fuera de alcance.
- **Docs:** `docs/MANUAL.md` y `docs/manual/index.html` (caso nuevo TC-31), `docs/ROADMAP-1.1.md` § 5, `docs/RELEASE-1.0.0-CHECKLIST.md`, `docs/I18N.md` § 8, `docs/ARCHITECTURE.md` (deseables), `docs/CHANGELOG.md` y `CLAUDE.md` al archivar.

## Non-goals

- Generar el PDF en el servidor (Puppeteer o Chrome en el contenedor de la API, una librería de PDF o un endpoint de descarga). Ver D1 y D12.
- Una ruta o un parámetro propios para imprimir (`/:slug/imprimir`, `?print=1`).
- Configurar los límites o el contenido de la hoja por perfil desde el panel. No hay campos nuevos en el schema, el OpenAPI ni el constructor.
- Vista previa del imprimible en el constructor del panel. El preview del panel no cambia.
- Un QR con la URL del perfil (D8).
- Registrar las impresiones en `ProfileView` o en cualquier otra métrica (D10).
- Rediseñar las secciones de pantalla o la impresión del panel `/admin`.
- Sumar `print:check` al CI en este change (ver Open Questions de `design.md`).

## Capabilities

### New Capabilities

- `printable-curated-profile`: la hoja imprimible de un perfil curado. Qué entra y en qué orden, los límites y el truncado, cómo se ve en papel con cualquier tema, el disparador y la verificación de que cabe en una hoja.

### Modified Capabilities

Ninguna. El layout de pantalla, el theming en runtime, la localización, el SEO y la analítica conservan sus requisitos. La hoja los reutiliza sin cambiar su comportamiento en pantalla.

## Impact

- **Frontend:**
  - Nuevo en `features/curated-view/print/`: `print-sheet.ts` (selección pura y límites), `PrintableSheet.tsx`, `PrintButton.tsx` y sus tests.
  - Nuevo en `themes/presets/paper.ts`: la paleta de papel, que no entra en la lista de presets conmutables.
  - Cambios en `CuratedProfileView.tsx`, que monta la hoja, marca lo que no se imprime y quita el fondo y el `min-height` de pantalla al imprimir. También en `theme-provider.tsx` (lo mismo para el contenedor raíz), `features/navigation/TopBar.tsx` (el botón), `themes/theme.css` (bloque `@media print` y `@page`) y `shared/i18n/messages.ts` (claves `print.*` en `es` y `en`).
  - Nuevo `scripts/check-print-pages.mjs`, con el script `print:check` y la devDependency `puppeteer-core` en `package.json`.
- **Backend, OpenAPI, Prisma, seed:** sin cambios.
- **Borde (`frontend/Caddyfile`):** sin cambios. La CSP sigue igual porque no hay scripts inline ni recursos externos nuevos.
- **Bundle inicial:** unos pocos KB. Sin dependencias de runtime nuevas.
