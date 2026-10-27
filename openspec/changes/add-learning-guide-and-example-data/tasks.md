# Tasks — add-learning-guide-and-example-data

> Referencias: `proposal.md`, `design.md` (D1–D15, P1–P6), `specs/*/spec.md`. La evidencia va en `verification.md` y en `verification/`, como en los changes archivados.
>
> **Orden de los grupos:** 1 → 2 → 3 → 4 (datos y seed; pueden ir en un primer PR, D1) → 5, 6 y 7 (manual, en paralelo) → 8 (capturas) → 9 (modo prueba y `manual:check`) → 10 (cierre). El grupo 9 puede empezar en paralelo con 5–7, pero `manual:check` se cierra después de 8.
>
> **Bases:**
> - `portfolio` (la del owner, `portfolio-postgres` en `localhost:5434`): **ninguna** tarea le corre `seed`, `seed:example`, `manual:capture`, `suite-backoffice.ps1` ni los checks que abren páginas.
> - `portfolio_example`: base descartable en el mismo contenedor, sembrada con el ejemplo. En PowerShell: `$env:DATABASE_URL = "postgresql://portfolio:portfolio@localhost:5434/portfolio_example?schema=public"`. La API de ejemplo corre en `PORT=3310` y el frontend usa `VITE_PROXY_TARGET=http://localhost:3310`.
>
> Antes de cada comando que escriba en una base, correr `npm run prisma:status` y confirmar que el destino es `portfolio_example`.

## 1. Formato extendido y validación del seed (D3, D5, D7)

- [x] 1.1 Extraer de `backend/scripts/seed.ts` un módulo puro, `backend/scripts/lib/seed-source.ts`, con los tipos del formato (los de hoy más los campos opcionales de D3 y `exampleViews`) y una función `parseSeedSource(raw: unknown): Result<SeedSource, SeedSourceError[]>`. Valida campos obligatorios, tipos, ids de sección contra `SECTION_IDS`, slugs y alias con `^[a-z0-9]+(?:-[a-z0-9]+)*$`, alias que no repitan slugs ni otros alias, `accessToken` presente en los `PROTECTED`, `layout` en `classic`/`sidebar` y `theme` dentro de los presets. Cada error lleva la ruta del campo (`profileTemplates[3].accessToken`). Verificar: tests de Jest sin base (`backend/test/seed-source.spec.ts`, sumado al `testRegex`) con un caso por regla y uno que acepta `docs/cv-data.json` tal cual.
- [x] 1.2 Resolución de referencias (D7) en el mismo módulo: `resolveRefs(source, createdIds)` traduce `experience:<id>`, `project:<id>` y `skill:<nombre>`. Una referencia inexistente, una `skill:` ambigua o un prefijo desconocido se rechazan antes de escribir. Para eso, la validación de 1.1 comprueba la existencia de cada referencia contra el propio archivo. Verificar: tests de la referencia resuelta, la inexistente, la ambigua y la que apunta a un ítem `visible: false` (válida).
- [x] 1.3 Aplicar los defaults de D3 en `seed.ts`: `visible`, tags por categoría o por skill (con `tagsForSkillCategory` como respaldo) y, por plantilla, `theme`, `layout`, `visibility`, `accessToken`, `sectionsOrder`, `sectionsHidden`, `includeIds`/`excludeIds` (desde las refs), `archivedAt` (momento de la carga si `archived`) y `slugAliases` (creación anidada de `CuratedProfileSlugAlias`). El orden de creación pasa a ser contenido → mapa de ids → perfiles curados → visitas. Verificar: un test sin base, con el cliente de Prisma simulado, demuestra que desde `docs/cv-data.json` los argumentos de cada `create` son idénticos a los de antes del cambio (instantánea tomada del script actual).
- [x] 1.4 Visitas sintéticas (D8): `exampleViews` genera las filas de `ProfileView` con la regla `i % daysBack`, `locales[i % n]`, `referrers[i % m]`, `userAgent: "example-seed"` e `ipHash: null`, en un solo `createMany`, y actualiza `views` del perfil. Verificar: test de la distribución (días, idiomas y orígenes) para una entrada de `count: 7, daysBack: 3`.
- [x] 1.5 Validar **antes** de limpiar (D5), también sin `--file`. Verificar: test con un archivo inválido que comprueba que no se llamó a ningún `deleteMany`.

## 2. Carga alternativa, negativa y verificación (D5, D6)

- [x] 2.1 `seed.ts` lee `--file <ruta>` de `process.argv`, con la ruta resuelta contra `process.cwd()`. Sin flag, la ruta sigue siendo `../../docs/cv-data.json` relativa al script. Archivo inexistente o JSON inválido → código 1 sin conectarse a escribir. Verificar: tests del parser de argumentos y del error de ruta.
- [x] 2.2 Negativa (D6) en `backend/scripts/lib/seed-guard.ts`, pura salvo la consulta `profile.findMany({ select: { fullName: true } })`. Exige `SEED_DISPOSABLE_DB=1`, `NODE_ENV !== 'production'` y cero `Profile` o uno solo con el `fullName` del archivo. Corre solo con `--file`, antes de la limpieza, y sale con código 2. El mensaje explica la capa que falló, muestra `host:puerto/base` sin credenciales y sugiere crear `portfolio_example`. Verificar: tests de cada capa (las tres en verde y cada una en rojo) con la consulta simulada, y un test de que la URL mostrada no contiene la contraseña.
- [x] 2.3 `verify-seed.ts` con `--file`: conteos desde el archivo, con `CuratedProfileSlugAlias` (sin alias, 0) y `ProfileView` (suma de `exampleViews.count`, o 0). El chequeo bilingüe pasa a usar la primera experiencia del archivo en lugar de `Novacomp` fijo, que sigue siendo la primera de `cv-data.json`. Por plantilla compara `visibility`, `listed`, archivado (`archivedAt` nulo o no), `layout`, slug del tema, `sectionsOrder`, `sectionsHidden`, alias e `includeIds`/`excludeIds` contra las refs resueltas por nombre (empresa, proyecto o skill), no por id. Verificar: revisión del diff; `npm run seed` + `npm run seed:verify` sobre una base descartable con los mismos conteos que antes (salida en `verification/2.3-cv-data.txt`).
- [x] 2.4 `backend/package.json`: `seed:example` (`tsx scripts/seed.ts --file ../docs/examples/cv-data.example.json`) y `seed:example:verify` (lo mismo con `verify-seed.ts`). Verificar: `npm run seed:example` sin `SEED_DISPOSABLE_DB` sale con 2.
- [ ] 2.5 CI (`.github/workflows/ci.yml`, job *Backend · e2e contra Postgres*): al terminar los e2e, crear una segunda base en el Postgres de servicio (`createdb portfolio_example` o `psql -c 'CREATE DATABASE …'`), aplicar `prisma:deploy` con su `DATABASE_URL` y correr `SEED_DISPOSABLE_DB=1 npm run seed:example`, dos veces, y `npm run seed:example:verify`. Agregar un paso que corra `seed:example` contra la base principal, ya sembrada con `cv-data.json`, y exija el código 2. Verificar: el job queda verde en el PR y su log muestra los conteos del ejemplo y la negativa.

## 3. Archivo de ejemplo y guía campo por campo (D2, D4, D8)

- [x] 3.1 Escribir `docs/examples/cv-data.example.json` con una persona ficticia (D2) y como mínimo:
  - **Perfil e idiomas:** 1 `Profile` con la disponibilidad completa y teléfono `+1 555 01xx`. 3 idiomas: uno `Nativo`/`Native`, uno MCER con `detail` y uno `Intermedio`/`Intermediate`.
  - **Contenido:**
    - 6 experiencias, una con `current: true` y una con `visible: false`. Una de ellas tiene `id: "atlas"`, como en los escenarios de la spec.
    - 4 categorías con 16 skills: una con `tags` por categoría y una con skills `{ name, tags }`.
    - 3 formaciones: una en curso, una con fechas `AAAA` y una oculta.
    - 3 certificaciones: una sin año y una oculta.
    - 3 proyectos: uno con `url`, uno sin `url` y uno oculto.
    - 4 enlaces: GitHub destacado con `stats`, LinkedIn, YouTube no destacado y uno oculto.
    - Sin `featuredRepositories` visibles.
  - **8 plantillas, cada una con `roleType` y `techFocus`:**
    - `ejemplo-backend`: `filterTags` y acento `#1A365D`.
    - `ejemplo-overrides`: `includeRefs` con una experiencia sin tags comunes, la experiencia oculta y un proyecto; `excludeRefs` con una experiencia que sí comparte tags y una skill.
    - `ejemplo-secciones`: las 9 secciones reordenadas, `sectionsHidden: ["stats","presence"]`, `layout: "sidebar"`, `theme: "elegant"` y overrides de tipografía y radio.
    - `ejemplo-protegido`: `PROTECTED`, con un token de prueba documentado y `listed: false`.
    - `ejemplo-borrador`: `PRIVATE`, sin `description.en`.
    - `ejemplo-dirigido`: `listed: false`.
    - `ejemplo-archivado`: `archived: true`, con visitas.
    - `ejemplo-renombrado`: `slugAliases: ["ejemplo-nombre-anterior"]`.
  - **Visitas:** `exampleViews` para al menos 4 perfiles, el archivado incluido, con orígenes variados (directo, LinkedIn, buscador, un dominio de `example.com`).

  Verificar: `parseSeedSource` lo acepta, y una búsqueda del `fullName`, el email y el teléfono de `docs/cv-data.json` en el archivo no da coincidencias.
- [x] 3.2 Test de traducciones del ejemplo: generalizar `seed-translations.spec.ts` (o sumar `example-translations.spec.ts`) para que lea `docs/examples/cv-data.example.json`, aplique la misma selección que el composer, refs incluidas, y exija como único faltante `description` en EN de `ejemplo-borrador`. Verificar: el test pasa, y falla si se borra un `en` cualquiera del archivo.
- [x] 3.3 Test de cobertura sin base: con el archivo parseado, comprobar que cada mecanismo de *Cobertura de los mecanismos del perfil curado* aparece en al menos una plantilla y que cada entidad de *Cobertura de entidades y secciones* tiene sus casos (actual, en curso, sin año, con `url`, con `stats` y ocultos). Verificar: el test pasa, y falla si se quita, por ejemplo, el alias.
- [x] 3.4 `docs/DATA-POPULATION.md`: sección *Datos de ejemplo* (qué es, por qué es ficticio, cómo crear, sembrar, verificar y borrar `portfolio_example`, con PowerShell y bash, y qué hace cada capa de la negativa) y sección *Referencia campo por campo* (D4), con una tabla por entidad y las seis columnas. Actualizar § 3 (el seed sobrescribe) y § 10 (`featuredRepositories` es inerte: ninguna sección lo muestra). Verificar: cada clave del ejemplo tiene su fila (revisión con un listado de claves generado del JSON, guardado en `verification/3.4-claves.txt`).

## 4. Base de ejemplo local y evidencia de TC-36 y TC-37

- [x] 4.1 Crear `portfolio_example` (`docker exec portfolio-postgres createdb -U portfolio portfolio_example`), aplicar `npm run prisma:deploy` y correr `SEED_DISPOSABLE_DB=1 npm run seed:example` dos veces y `npm run seed:example:verify`. Verificar: salida en `verification/4.1-seed-example.txt`, con código 0 en las tres.
- [x] 4.2 TC-37 sobre una copia descartable sembrada con `cv-data.json` (`portfolio_seedguard`, nunca `portfolio`): `seed:example` sin la variable (código 2), con la variable (código 2 por la capa 3) y con `NODE_ENV=production` (código 2). Después `seed:verify`, con los conteos sin cambios. Verificar: salidas en `verification/4.2-negativa.txt`; borrar `portfolio_seedguard` al terminar.
- [x] 4.3 Comprobar contra la API de ejemplo (`PORT=3310`) los escenarios HTTP de la spec: home con 9 secciones, protegido 401/200, privado 404, archivado 404, alias 200, la experiencia oculta solo en el panel y el override sobre la oculta. Verificar: transcripción en `verification/4.3-api.txt`.

## 5. Manual: estructura, ruta de aprendizaje, recorridos y glosario (D9, D10)

- [ ] 5.1 Reordenar `docs/MANUAL.md` e `index.html` según D10: ruta, recorridos, manual del backoffice, casos por área, operación y glosario. Actualizar § 0 (entorno con la base de ejemplo, `PORT=3310` y `VITE_PROXY_TARGET`) y el mapa. Verificar: el índice lateral del HTML y los encabezados del Markdown siguen el mismo orden (revisión, y `manual:check` en 9.4).
- [ ] 5.2 Ruta de aprendizaje: ocho conceptos en el orden de la spec. Cada uno con su explicación, el dato del ejemplo que lo muestra (slug o entidad), el enlace a la pantalla del manual del backoffice y los casos. Verificar: cada enlace interno resuelve (`manual:check`, regla 5).
- [ ] 5.3 Nueve recorridos por objetivo, ejecutados de verdad sobre `portfolio_example` desde el panel. Los que guardan cambios se hacen sobre perfiles del ejemplo y la base se vuelve a sembrar al terminar. Verificar: en `verification/5.3-recorridos.md`, cada recorrido con fecha y resultado; *Mandarlo a una sola empresa* comprobado contra `/sitemap.xml` y la home.
- [ ] 5.4 Glosario con los términos de la spec, cada uno enlazado. Verificar: revisión y `manual:check`.

## 6. Manual del backoffice por pantalla (D10)

- [ ] 6.1 Inventario de campos, validaciones y mensajes desde el código: `LoginPage.tsx`, `DashboardPage.tsx` y `ranges.ts`, `PortadaPage.tsx` con `portada-draft.ts` y `language-form.ts`, `experience-form.ts`, `SkillsPage.tsx` y `skills-form.ts`, `formacion-form.ts`, `proyectos-form.ts`, `ProfilesPage.tsx`, `ProfileBuilderPage.tsx` y `profile-draft.ts`, `ThemeCustomizerPanel.tsx` y `theme-draft.ts`, `PreviewLocaleTabs.tsx`, `MissingTranslationsNotice.tsx`, `ConfirmDialog`/`UnsavedChangesDialog`, y los DTO del backend cuando el cliente no valida (por ejemplo, el 409 de slug repetido). Verificar: tabla en `verification/6.1-inventario.md` con la ruta del archivo por cada mensaje.
- [ ] 6.2 Escribir una subsección por pantalla en los dos formatos. Cada una lleva qué hace, la tabla de campos (etiqueta, tipo, obligatorio, validación, ejemplo del archivo), la columna *Mensaje* / `td.msg` con los mensajes literales, las acciones con confirmación y los errores típicos. Incluye las limitaciones vigentes: *Incluir*/*Excluir* solo para experiencias y el `PUT` de la Portada, que reemplaza todo el perfil. Verificar: `manual:check` (regla 4) encuentra cada mensaje en `frontend/src`.

## 7. Casos sobre la base de ejemplo (D9)

- [ ] 7.1 Reescribir la precondición y las cifras de TC-01 a TC-35 sobre el ejemplo: conteos, métricas de TC-03, slugs de TC-05 a TC-08 y TC-21 a TC-24, perfiles del dashboard, idiomas de TC-32 y acento de TC-34. Quitar la nota de *Limitación actual* de TC-19. Volver a ejecutar cada caso contra `portfolio_example` y fijar el estado real, con la fecha de la corrida. Verificar: `verification/7.1-corrida.md`, generado con *Copiar resultado* (D15) cuando el grupo 9 esté listo, o a mano antes.
- [ ] 7.2 Sumar TC-36 y TC-37 en los dos formatos, con pasos en PowerShell y bash y las salidas de 4.1 y 4.2 transcritas, en el área `datos`. Verificar: aparecen en el índice, en la tabla de la suite y en los filtros.
- [ ] 7.3 `docs/manual/suite-backoffice.ps1`: documentar en la cabecera que corre contra `portfolio_example` y la API de ejemplo, y aceptar la URL de la API por parámetro (por defecto `http://localhost:3310`). Revisar que no queden supuestos del CV real, como el `accentColor` retirado en la línea 53. Verificar: la suite corre en verde contra la API de ejemplo y deja los conteos de `seed:example:verify` intactos (salida en `verification/7.3-suite.txt`).

## 8. Capturas reproducibles (D11, D12)

- [ ] 8.1 `frontend/scripts/capture-manual.mjs` y el script `manual:capture` en `frontend/package.json`. Lleva el manifiesto de D12 (id, archivo, ruta, viewport, sesión y pasos sin escritura) y `--only`. Reutiliza `findChrome` y `chromeFlags`. Emula `prefers-reduced-motion`, espera fuentes y red en reposo y saca JPEG de calidad 78 en 1280×800 o 390×844. Verificar: revisión del diff; el script no tiene llamadas `POST`/`PATCH`/`DELETE` salvo el login, y ningún paso escribe en un `input[type=password]`.
- [ ] 8.2 Guardas: `MANUAL_CAPTURE_DISPOSABLE_DB=1` (código 2 sin ella) y comparación de `GET /api/profile` con el `fullName` del ejemplo (código 2 si difiere), las dos antes de abrir páginas. Login por `fetch('/api/auth/login')` con `MANUAL_CAPTURE_ADMIN_EMAIL`/`_PASSWORD`. Verificar: corrida contra una API sembrada con `cv-data.json` (copia descartable): código 2 y cero `ProfileView` nuevas (`verification/8.2-guardas.txt`).
- [ ] 8.3 Administrador de prueba en `portfolio_example` con `npm run admin:bootstrap`, `ADMIN_EMAIL=capture@example.com` y una contraseña generada en la sesión (`[guid]::NewGuid().ToString()`), sin escribirla en ningún archivo. Correr `npm run manual:capture` contra la imagen de `frontend/Dockerfile` con la API de ejemplo detrás. Verificar: las 44 capturas del inventario quedan en `docs/manual/`, cada una de hasta 150 KB; `tc32-faltantes.png` y `tc10-login.jpg` se borran y sus reemplazos quedan referenciados.
- [ ] 8.4 Revisar una por una las capturas contra el inventario de D12: TC-19 con *Logros (en)*, Publicación con enumeración, archivado y link, lista de perfiles con *Duplicar*, login con foco, etc. Verificar: tabla en `verification/8.4-capturas.md` con archivo, caso, qué se comprobó y tamaño.

## 9. Modo prueba mejorado y `manual:check` (D13, D14, D15)

- [ ] 9.1 Filtros por área y por change (D14): `data-area` y `data-change` en cada `article.case`, chips de área, `<select>` de change con `<label>`, combinación con estado y búsqueda, contador con `aria-live="polite"` y filtro recordado en `localStorage` con `try/catch`. Verificar: en el navegador, área backoffice + `add-curated-profile-lifecycle` deja TC-21 a TC-24 y el contador anuncia 4. Con `localStorage` bloqueado (DevTools), todo funciona sin errores en la consola.
- [ ] 9.2 Registro de corrida (D15): tres resultados por caso con `fieldset`/`legend`, nota opcional, migración de la marca `'1'` heredada a *pasa*, progreso calculado del DOM, *Copiar resultado* en Markdown con *fallback* a `<textarea>` seleccionado y *Reiniciar corrida*. Verificar: el escenario *Copiar el resultado* de la spec; el texto pegado en `verification/9.2-informe.md`. Probar también dentro del visor de artifacts.
- [ ] 9.3 Accesibilidad del HTML: recorrido completo con teclado (filtros, resultados, notas, copiar y lightbox), foco visible y `prefers-reduced-motion`. Correr axe-core sobre `index.html` servido en local, con el `axe-core` que ya es devDependency del frontend. Verificar: 0 violaciones `serious`/`critical` (`verification/9.3-axe.json`).
- [ ] 9.4 `frontend/scripts/check-manual.mjs` y el script `manual:check`, con las cinco reglas de D13: casos alineados (id, título y estado, índice y tabla de la suite), imágenes existentes y sin huérfanas, topes de tamaño, mensajes literales en `frontend/src` y anclas internas. Mensajes de error con archivo y línea. Verificar: termina con 0 sobre el manual final y con 1 en cada uno de estos casos de prueba, armados en una copia temporal: un estado cambiado, una imagen huérfana, una imagen de 186 KB, un mensaje inventado y un ancla rota.
- [ ] 9.5 CI: `npm run manual:check` en el job *Frontend · lint, tipos, tests y build*, después de `npm test`. Verificar: el job queda verde en el PR.

## 10. Cierre

- [ ] 10.1 `CLAUDE.md`: sumar `seed:example`, `seed:example:verify`, `manual:capture` y `manual:check` a *Comandos esperados*, con la advertencia de base descartable, y el change al roadmap al archivar. Verificar: revisión del diff.
- [ ] 10.2 `docs/CHANGELOG.md` y `docs/ARCHITECTURE.md` (referencia a `docs/examples/` y al formato extendido del seed). Verificar: revisión del diff.
- [ ] 10.3 Validar: `npx -y @fission-ai/openspec@1.14.1 validate add-learning-guide-and-example-data --strict` y `validate --all --strict`, sin fallas nuevas ni avisos *Archive would refuse*. `npm test` en backend y frontend, y `npm run manual:check`. Verificar: salidas en `verification.md`.
- [ ] 10.4 Publicar el manual renovado como artifact (con las capturas en `files`) solo si el owner lo pide, y dejar el link en `verification.md`. Verificar: el artifact abre con todas las imágenes y el modo prueba funciona dentro del visor.
