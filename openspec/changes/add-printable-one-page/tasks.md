# Tasks — add-printable-one-page

> Referencias: `proposal.md`, `design.md` (D1–D12 y preguntas P1–P4), `specs/printable-curated-profile/spec.md`.
>
> **Orden de los grupos:** 1 (selección) → 2 (hoja y estilos) → 3 (botón) → 4 (verificación de páginas) → 5 (documentación) → 6 (verificación completa). El grupo 5 puede ir en paralelo con los grupos 2 a 4.
>
> **Respuestas del owner:** si al implementar ya hay respuesta a P1–P4 distinta del valor por defecto, primero se actualizan `design.md` y la spec con `openspec-update-change` y después se implementa.
>
> **Bases:**
> - `portfolio` (la del owner, `localhost:5434`) se usa para la app real. **Nunca se le corre el seed.**
> - `portfolio_print_check` es una base descartable en el mismo servidor, creada con `prisma migrate deploy` y `npm run seed`, solo para la tarea 4.3. Para usarla: `DATABASE_URL="postgresql://portfolio:portfolio@localhost:5434/portfolio_print_check?schema=public"`.
>
> **`print:check` exige `PRINT_CHECK_DISPOSABLE_DB=1`** (confirma que la API apunta a una base descartable, porque cada caso registra una visita); sin ella sale con código 2. Nunca se corre contra `portfolio`.
>
> Antes de cada comando de Prisma o del seed, correr `npm run prisma:status` para confirmar el destino. El backend escucha en el puerto 3300.

## 1. Selección de contenido (D2, D3, D4, D8)

- [x] 1.1 Tests primero, en `frontend/src/features/curated-view/print/print-sheet.spec.ts`, con los fixtures de `test/fixtures/curated-profile.ts`. Tienen que cubrir:
  - el orden de los bloques según `sections`, con secciones ocultas y `stats` sin imprimir;
  - el encabezado con y sin `contact` en `sections`, y los enlaces `featured` de `presence` (hasta 2);
  - los límites de `PRINT_LIMITS` (escenarios *Perfil con 13 experiencias* y *Logros recortados*);
  - las cuentas de omitidos por bloque;
  - la URL de la versión completa sin `token`, `theme` ni `layout`, y con `?lang=en` solo en inglés;
  - `description` ausente en `all`.

  Verificar: los tests fallan antes de 1.2.
- [x] 1.2 `print-sheet.ts`: `PRINT_LIMITS` y `buildPrintSheet(data, locale, origin)` según D3, reutilizando `metaFromProfile(...).canonical` para la URL. Es una función pura, sin React ni DOM. Verificar: 1.1 en verde; `npm run typecheck`.
- [x] 1.3 Claves `print.*` en `shared/i18n/messages.ts`, en `es` y en `en`: etiquetas de bloque, líneas de omitidos con cantidad, *"Versión completa"*, el botón y su `aria-label`. Verificar: el test del diccionario (si existe) o uno nuevo comprueba que cada clave `print.*` está en los dos idiomas.

## 2. Hoja y estilos de impresión (D1, D5, D6, D7)

- [x] 2.1 `themes/presets/paper.ts`: la paleta de papel de D6. No se registra en la lista de presets conmutables. Verificar: `presets.spec.ts` sigue listando cinco presets, y un test nuevo comprueba que `findPreset('paper')` es `undefined`.
- [x] 2.2 Tests de `PrintableSheet.test.tsx`:
  - lleva `data-print-sheet` y las clases `hidden print:block`;
  - no contiene `data-motion`, `text-transparent`, `bg-clip-text` ni `text-gradient`;
  - su contenedor expone los `--t-*` de la paleta de papel y la `--t-font-sans` del perfil;
  - los enlaces muestran su texto visible.

  Verificar: fallan antes de 2.3.
- [x] 2.3 `features/curated-view/print/PrintableSheet.tsx`: renderiza el `PrintSheetModel`, con la columna de etiquetas de D3, `break-inside: avoid` por entrada, `line-clamp` como segunda red y la línea decorativa con el acento. Sin `MotionSection` ni `motion`. Verificar: 2.2 en verde.
- [x] 2.4 `CuratedProfileView.tsx`: monta `PrintableSheet` solo en `success` y marca con `print:hidden` el envoltorio de pantalla (capa `bg-glow`, `TopBar`, `main` y `Footer`), además de `print:min-h-0` donde haya `min-h-screen`. En `theme-provider.tsx`, `print:min-h-0 print:bg-transparent` en el contenedor raíz. Verificar: un test de la vista comprueba esas clases y que la hoja no existe en `loading`, `needsToken`, `notFound` ni `error`.
- [x] 2.5 `themes/theme.css`, bloque `@media print`:
  - `@page { margin: 12mm; }`;
  - `html` y `body` con fondo transparente y sin `overflow-x: hidden`;
  - `[data-motion="on"] { opacity: 1 !important; transform: none !important; }` (D7).

  Verificar: `npm run build`, y el CSS del build contiene `@page` y la regla de `data-motion`.

## 3. Disparador (D9, D10)

- [x] 3.1 Tests:
  - `TopBar` sin `onPrint` no muestra el botón, y con `onPrint` muestra el botón con su nombre accesible en `es` y en `en`;
  - en la vista, el botón aparece solo en `success`;
  - el clic llama a `window.print` (espía) y MSW no registra ninguna petición nueva después del clic.

  Verificar: fallan antes de 3.2.
- [x] 3.2 `PrintButton.tsx` con el icono `Printer` de Lucide, la etiqueta visible desde `md` y el `aria-label`. `TopBar` recibe `onPrint` y lleva `print:hidden`. `CuratedProfileView` pasa `onPrint={() => window.print()}` solo en `success`. No se agregan listeners de `beforeprint` ni `afterprint`, y `document.title` no se toca. Verificar: 3.1 en verde; `grep -rn "beforeprint\|afterprint" frontend/src` vacío.
- [x] 3.3 Frontend completo: `npm run lint`, `npm run typecheck`, `npm run test` y `npm run build`. Verificar: todo en verde y el JS inicial sigue por debajo de 400 KB gzip (spec `public-portfolio-frontend`).

## 4. Verificación automatizada de "una hoja" (D11)

- [x] 4.1 `npm i -D puppeteer-core` en `frontend` (la versión estable vigente, fijada en el lockfile) y script `"print:check": "node scripts/check-print-pages.mjs"`. Verificar: `npm ls puppeteer-core` la muestra solo como devDependency; `npm run build` no la incluye en `dist`.
- [x] 4.2 `frontend/scripts/check-print-pages.mjs`, según D11:
  - argumentos: URL base (por defecto `http://localhost:5173`), `CHROME_PATH` y `PRINT_CHECK_TOKENS` (`slug=token,…`, opcional);
  - toma los perfiles de `GET /api/curated-profiles` y suma `all`;
  - recorre `es`/`en` × A4/Letter × tema del perfil/`?theme=modern-dark&layout=sidebar`;
  - para cada caso: `page.pdf({ format, printBackground: false })`, conteo de páginas y, con `emulateMediaType('print')`, contraste de cada nodo de texto de `[data-print-sheet]` contra blanco;
  - imprime una tabla y sale con código 1 si algún caso da más de una página o un contraste menor a 4,5:1.

  Verificar: con un perfil al que se le fuerza contenido largo en una base descartable, el script falla y lo informa en la tabla.
- [x] 4.3 Corrida sobre los datos del seed: crear `portfolio_print_check` (`createdb`), `npm run prisma:status`, `npm run prisma:deploy`, `npm run seed` y `npm run seed:verify` **solo en esa base**. Levantar el backend contra ella en 3300 y `npm run dev`, y correr `npm run print:check`, con el token de un perfil `PROTECTED` en `PRINT_CHECK_TOKENS`. Verificar: todos los casos dan una página y el script sale con 0. Si no, se bajan los límites en el orden de D3, se actualizan la spec y `design.md`, y se repite. La salida queda en `verification/4.3-print-check-seed.txt`.
- [x] 4.4 Misma corrida contra `portfolio` (la base del owner, **sin seed**): backend en 3300 contra el `.env` y `npm run dev`. Verificar: todos los casos dan una página, con la salida en `verification/4.4-print-check-owner.txt`. Si algún perfil editado por el owner no entra, se registra en `verification.md` con el motivo (qué bloque desborda) y se consulta antes de tocar los límites.

## 5. Documentación (D3, D5, D9, D12)

- [x] 5.1 `docs/MANUAL.md`: caso nuevo **TC-31 — Imprimir un perfil en una hoja** en § 2 (vista pública). Pasos:
  - abrir `/tech-lead-dotnet` sin hacer scroll;
  - Ctrl+P, A4, sin encabezados ni pies del navegador y sin gráficos de fondo;
  - repetir con el botón, con `?lang=en`, con `?theme=modern-dark&layout=sidebar` y en Letter;
  - guardar como PDF.

  Esperado: una hoja, texto oscuro sobre blanco, el orden del perfil, líneas de omitidos, la URL completa sin token y sin barra ni pie; el botón no aparece en la pantalla del token de un `PROTECTED`.

  Suma una nota de que `print:check` lo automatiza en Chrome. Actualiza el mapa (§ 1) y la suite (§ 6) si listan los casos. Verificar: revisión del diff; los números de TC son correlativos.
- [x] 5.2 `docs/manual/index.html`: entrada TC-31 en el índice lateral y su tarjeta de caso, con el mismo contenido que 5.1, y actualizar la nota de conteo (*"Los 30 casos pasan"* → 31). Verificar: el HTML abre sin errores en el navegador y el enlace `#tc31` lleva a la tarjeta.
- [x] 5.3 `docs/RELEASE-1.0.0-CHECKLIST.md`: según P4 (por defecto, A), marcar *Export PDF de perfil* como resuelto por `add-printable-one-page`, aclarando que el PDF lo genera el navegador. `docs/I18N.md` § 8: el motor de plantilla es la hoja imprimible del frontend, alimentada por el mismo `locale`. `docs/ARCHITECTURE.md`: el deseable *export PDF* apunta a este change. Verificar: revisión del diff.
- [x] 5.4 `docs/ROADMAP-1.1.md` § 5: la fila `imprimible-una-hoja` queda resuelta, citando este change, y se anota que la descripción del candidato citada como § 7.3 no está en el repo. `docs/CHANGELOG.md`: entrada del change. `CLAUDE.md`: línea del change en la lista de la ronda al archivar. Verificar: revisión del diff.

## 6. Verificación completa

- [x] 6.1 Suite del frontend: `npm run lint`, `npm run typecheck`, `npm run test` y `npm run build`. Backend: `npm run test` para confirmar que nada cambió (sin cambios esperados). Verificar: todo en verde, con los conteos en `verification/6.1-suite.txt`.
- [ ] 6.2 App real contra `portfolio` (backend en 3300 y `npm run dev`), en Chrome:
  - TC-31 completo, con capturas de la vista previa de impresión: `/tech-lead-dotnet` en A4 `es`, `/all` en Letter `en` y `/tech-lead-dotnet?theme=modern-dark&layout=sidebar`;
  - el PDF guardado de uno de ellos, con una página y los enlaces clicables;
  - Ctrl+P sin hacer scroll con un tema de animaciones activas: no hay bloques vacíos;
  - un `PROTECTED` sin token no muestra el botón, y con token imprime una URL sin `token`;
  - en DevTools → Network, ninguna petición al pulsar el botón, y el contador de visitas del perfil (panel, TC-18) no cambia por imprimir.

  Verificar: capturas y PDF en `verification/`.
- [ ] 6.3 Firefox: TC-31 sobre `/tech-lead-dotnet` en A4. Verificar: una hoja legible, con su captura en `verification/`. Si Firefox compagina en dos hojas y Chrome en una, se registra en `verification.md` como riesgo conocido (Risks de `design.md`) con la diferencia observada.
- [x] 6.4 Contenedor `web` con la CSP activa (`docker build` de `frontend/` y la API local como `API_ORIGIN`): abrir un perfil, usar el botón y cancelar el diálogo. Verificar: la consola no registra violaciones de CSP y `git diff main -- frontend/Caddyfile` está vacío.
- [x] 6.5 `npx -y @fission-ai/openspec@1.14.1 validate add-printable-one-page --strict` y `npx -y @fission-ai/openspec@1.14.1 validate --all --strict`. Verificar: el change valida, sin fallas nuevas ni avisos *Archive would refuse*; la transcripción queda en `verification/6.5-validate.txt`.
- [x] 6.6 Cierre: `dropdb portfolio_print_check`. Verificar: `psql -l` ya no la lista; `verification.md` completo, con las respuestas del owner a P1–P4 registradas y sin marcadores pendientes.
