# platform-manual Specification

## Purpose
Que el manual de la plataforma sirva para aprender a usarla y para verificarla antes de cada release. Lo hace con los conceptos en orden, tareas reales paso a paso, cada pantalla del panel con sus campos y mensajes reales, y casos de prueba con capturas al día y reproducibles. Mantiene `docs/MANUAL.md` y `docs/manual/index.html` alineados de forma comprobable.

## Requirements

### Requirement: Manual en dos formatos alineados
`docs/MANUAL.md` y `docs/manual/index.html` SHALL tener los mismos casos, con el mismo id, título y estado (✅ ↔ `ok`, 🔍 ↔ `part`, ❌ ↔ `fail`), y las mismas secciones de aprendizaje, recorridos, backoffice y glosario. `npm run manual:check` SHALL comprobarlo sin navegador ni base y terminar con código 1 ante cualquier diferencia.

#### Scenario: Estado distinto
- **WHEN** un caso figura ✅ en `MANUAL.md` y `data-status="part"` en `index.html`, y se ejecuta `npm run manual:check`
- **THEN** termina con código 1 nombrando el caso

#### Scenario: Índice y suite completos
- **WHEN** se ejecuta `npm run manual:check` con el manual al día
- **THEN** termina con código 0, y el índice lateral y la tabla de la suite listan exactamente los casos del documento

### Requirement: Ruta de aprendizaje
El manual SHALL empezar con una ruta de aprendizaje de ocho conceptos, en este orden: perfil base, perfil curado, tags y overrides, secciones, tema, visibilidad, enumeración y archivo, idiomas, y analítica. Cada concepto SHALL explicar qué es y enlazar el dato del ejemplo que lo muestra, la pantalla que lo edita y los casos que lo verifican.

#### Scenario: Concepto enlazado
- **WHEN** se abre el concepto *tags y overrides* en `index.html`
- **THEN** enlaza la pestaña Selección del manual del backoffice y los casos TC-03, TC-13 y TC-20

### Requirement: Recorridos por objetivo
El manual SHALL incluir nueve recorridos: preparar un perfil para una vacante, mandarlo a una sola empresa, retirarlo, renombrar el slug, ajustar el tema y el acento, editar el contenido base, traducir y revisar faltantes, imprimir o guardar en PDF, y leer la analítica. Cada uno SHALL tener pasos numerados por pantalla, el resultado esperado, los errores típicos y sus casos.

#### Scenario: Recorrido ejecutable sobre el ejemplo
- **WHEN** se sigue *Mandarlo a una sola empresa* sobre la base de ejemplo
- **THEN** el perfil queda fuera de la home y del sitemap, y su link responde 200

### Requirement: Manual del backoffice por pantalla
El manual SHALL recorrer cada pantalla del panel: login, dashboard, portada con idiomas, experiencias, skills, formación, proyectos y enlaces, perfiles, el constructor con sus cuatro pestañas, la vista previa y la cuenta. Cada campo SHALL tener su etiqueta visible, tipo, obligatoriedad, validación y un ejemplo del archivo de ejemplo, según el código vigente del panel y de la API.

#### Scenario: Campo con validación
- **WHEN** se lee la fila de *Plataforma* en la pantalla Proyectos y enlaces
- **THEN** dice que es obligatoria, que admite solo minúsculas, dígitos y guiones, y da `github` como ejemplo

#### Scenario: Override fuera del constructor
- **WHEN** se lee la pestaña Selección
- **THEN** aclara que incluir y excluir en el panel cubre solo experiencias, y que skills y proyectos se editan por la API

#### Scenario: Pantalla Cuenta
- **WHEN** se lee la pantalla Cuenta
- **THEN** describe los tres campos de contraseña con su regla, cita sus mensajes literales y aclara que el cambio cierra las sesiones de otros dispositivos y que `admin:bootstrap` es la vía de recuperación

### Requirement: Mensajes de validación literales
Los mensajes de error del manual del backoffice SHALL citarse literales, en una columna *Mensaje* en Markdown y en `td.msg` en el HTML. `npm run manual:check` SHALL terminar con código 1 si alguno no aparece literal en `frontend/src`.

#### Scenario: Mensaje desactualizado
- **WHEN** el manual cita "La empresa es requerida" y el código dice "La empresa es obligatoria"
- **THEN** `npm run manual:check` termina con código 1 citando el mensaje

### Requirement: Casos de los datos de ejemplo
El manual SHALL incluir TC-36, *Cargar los datos de ejemplo en una base descartable*, y TC-37, *El seed de ejemplo se niega contra una base con otros datos*. Su precondición, sus pasos en PowerShell y en bash, el resultado esperado y la salida transcrita salen de la base de ejemplo. Todos los casos SHALL tener esa base como precondición.

#### Scenario: TC-37 ejecutado
- **WHEN** se sigue TC-37 contra una base sembrada con `docs/cv-data.json`
- **THEN** la salida transcrita muestra el código 2, el motivo y los conteos sin cambios

### Requirement: Capturas reproducibles
`npm run manual:capture -- <base>` SHALL generar todas las capturas del manual desde un manifiesto, con `puppeteer-core` y el Chrome del sistema, en JPEG de calidad 78: 1280×800 en escritorio y 390×844 en móvil, con movimiento reducido. Fuera de iniciar sesión, MUST NOT guardar datos. `--only <ids>` SHALL limitar la corrida.

#### Scenario: Corrida parcial
- **WHEN** se ejecuta `npm run manual:capture -- http://localhost:8080 --only tc19b-formulario`
- **THEN** solo cambia `docs/manual/tc19b-formulario.jpg` y los conteos de la base no cambian

### Requirement: Capturas solo contra la base de ejemplo
`manual:capture` MUST exigir `MANUAL_CAPTURE_DISPOSABLE_DB=1` y comprobar que `GET /api/profile` devuelve el `fullName` del archivo de ejemplo antes de abrir ninguna página. Si no, SHALL salir con código 2. Entra al panel con `fetch('/api/auth/login')` y credenciales de prueba por variables de entorno, y MUST NOT escribir la contraseña en un campo.

#### Scenario: Base del owner
- **WHEN** se ejecuta `manual:capture` con la variable puesta contra una API que sirve `docs/cv-data.json`
- **THEN** termina con código 2 sin abrir páginas públicas ni registrar visitas

### Requirement: Inventario de capturas al día
Cada imagen referenciada por el manual SHALL existir en `docs/manual/` y figurar en el manifiesto de `manual:capture`. Ninguna imagen de esa carpeta MUST quedar sin referencia. Las capturas SHALL mostrar el panel y la vista pública vigentes sobre la base de ejemplo, sin notas de limitaciones ya resueltas.

#### Scenario: TC-19 al día
- **WHEN** se abre TC-19 en `index.html`
- **THEN** la captura del formulario muestra *Logros (en)* y no queda la nota de *Limitación actual*

#### Scenario: Imagen huérfana
- **WHEN** queda en `docs/manual/` una imagen que el manual no referencia y se ejecuta `npm run manual:check`
- **THEN** termina con código 1 nombrando el archivo

### Requirement: Tope de tamaño del manual
Cada imagen de `docs/manual/` MUST pesar hasta 150 KB, el total de imágenes hasta 4 MB e `index.html` hasta 300 KB, para que el manual se pueda publicar como artifact. `npm run manual:check` SHALL terminar con código 1 si se supera algún tope.

#### Scenario: Captura pesada
- **WHEN** una captura pesa 186 KB y se ejecuta `npm run manual:check`
- **THEN** termina con código 1 nombrando el archivo y su tamaño

### Requirement: Filtros por área y por change
`index.html` SHALL filtrar los casos por área (pública, backoffice, datos) y por el change que los introdujo, además de por estado y texto, combinando todos los filtros. Un contador con `aria-live="polite"` SHALL anunciar cuántos casos quedan, y todos los controles SHALL tener nombre accesible y funcionar con teclado.

#### Scenario: Filtros combinados
- **WHEN** se elige el área backoffice y el change `add-curated-profile-lifecycle`
- **THEN** quedan visibles TC-21 a TC-24 y el contador anuncia 4 casos

### Requirement: Registro de una corrida
Cada caso SHALL admitir un resultado (pasa, falla u omitido) y una nota opcional, guardados en `localStorage` con `try/catch`. *Copiar resultado* SHALL copiar un Markdown con fecha, base, totales y una fila por caso. Si el portapapeles falla, SHALL mostrar el texto seleccionado, y la página MUST funcionar sin almacenamiento.

#### Scenario: Copiar el resultado
- **WHEN** se marca TC-01 como pasa y TC-08 como falla con una nota, y se pulsa *Copiar resultado*
- **THEN** el texto copiado tiene la fecha, los totales y las filas de TC-01 y TC-08 con su resultado y la nota

#### Scenario: Sin almacenamiento
- **WHEN** se abre `index.html` con `localStorage` bloqueado
- **THEN** los filtros, los resultados y *Copiar resultado* funcionan durante la sesión, sin errores en la consola

### Requirement: Glosario
El manual SHALL incluir un glosario con al menos estos términos: slug, perfil base, perfil curado, `filterTags`, `includeIds`/`excludeIds`, sección, preset, token de diseño, `themeOverrides`, visibilidad, `listed`, archivado, alias de slug, `LocalizedText`, faltante de traducción y `ProfileView`. Cada término SHALL enlazar el concepto o la pantalla donde se usa.

#### Scenario: Término enlazado
- **WHEN** se abre el término *alias de slug* en el glosario
- **THEN** enlaza el recorrido *Renombrar el slug* y TC-24

### Requirement: Sin dependencias nuevas en el manual
`index.html` MUST NOT cargar recursos externos además de las fuentes de Google Fonts que ya usa. Su JavaScript SHALL ser inline y sin bibliotecas, y la página SHALL respetar `prefers-reduced-motion` y mantener el foco visible.

#### Scenario: Recursos externos
- **WHEN** se listan los `src` y `href` externos de `index.html`
- **THEN** solo aparecen `fonts.googleapis.com` y `fonts.gstatic.com`
