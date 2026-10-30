# Tasks — add-builder-skill-project-overrides

> Referencias: `proposal.md`, `design.md` (D1–D11, P1–P3) y los deltas de `specs/` (`curated-profile-builder`, `curated-profile-resolution`, `admin-curated-profile-preview`). La evidencia va en `verification/`, como en `add-certification-verification`.
>
> **Orden:** 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8. Cada grupo de código va en el mismo commit que sus tests. El 7 (docs) puede escribirse en paralelo con el 5, salvo las capturas, que necesitan el 6.
>
> **Sin código de backend (D1):** si alguna tarea parece pedir un cambio en `backend/src`, `backend/prisma` o `backend/scripts`, se detiene y se consulta al arquitecto. Los grupos 2 y 3 solo suman tests.
>
> **Bases:**
> - `portfolio` (la del owner, `localhost:5434`): **ninguna** tarea le escribe. Cada carga pública registra una visita.
> - Los e2e corren contra la base de e2e de siempre (migrada y sembrada), nunca contra `portfolio`.
> - `portfolio_overrides_check`: base descartable **nueva** en el mismo contenedor, sembrada con el ejemplo, para la app real (6); borrada al terminar. En PowerShell: `$env:DATABASE_URL = "postgresql://portfolio:portfolio@localhost:5434/portfolio_overrides_check?schema=public"`.
>
> Antes de cada comando que escriba en una base, correr `npm run prisma:status` y confirmar el destino.

## 1. Punto de partida

- [ ] 1.1 Confirmar en la rama: el composer pasa el mismo `SelectionCriteria` a `selectByTags` (experiencias y proyectos) y a `selectSkillCategories`; `PortfolioSectionsLoader` filtra proyectos visibles; `tagUniverse` no recibe proyectos; la pestaña Selección solo lista experiencias con `toggleIn`. Verificar: `npm test` y `npm run test:e2e` en `backend/`, `npm test` en `frontend/` verdes antes de tocar nada; conteos en `verification/1.1-punto-de-partida.txt`.

## 2. Regresión de los servicios puros del núcleo (D11)

- [ ] 2.1 `select-skill-categories.spec.ts`: casos de *Selección de skills por categoría*: `includeIds` de una skill de una categoría sin coincidencias → la categoría aparece con esa sola skill; `excludeIds` de una skill que matchea → sale y la categoría conserva las demás; `excludeIds` de la única skill seleccionada → la categoría desaparece; id de categoría en `excludeIds` → sin efecto. Verificar: `npm test` verde en `backend/` sin tocar `select-skill-categories.ts`.
- [ ] 2.2 `select-by-tags.spec.ts`: un caso con ítems de tipos distintos en el mismo arreglo (id de skill en `includeIds` y de proyecto en `excludeIds`) que demuestra que cada lista solo reacciona a sus propios ids. Verificar: `npm test` verde sin tocar `select-by-tags.ts`.

## 3. Regresión del caso de uso y del preview (D11)

- [ ] 3.1 `curated-profile.use-cases.spec.ts` (repositorios simulados): `ResolveCuratedProfileUseCase` con un proyecto visible sin intersección en `includeIds` → aparece en su posición por `order`; un proyecto oculto en `includeIds` → no aparece (el loader simulado devuelve también el oculto, para probar el filtro); una skill en `excludeIds` y otra en `includeIds` → el resultado agrupa como dice el delta. Verificar: `npm test` verde.
- [ ] 3.2 E2e del preview (`backend/test/backoffice.e2e-spec.ts`, junto al escenario *Overrides* existente): escenario *Overrides de skills y proyectos*: borrador con `filterTags: ["java"]`, una skill java en `excludeIds`, una skill y un proyecto visible sin tags comunes en `includeIds` → 200 con ese resultado; después `PATCH` de un perfil de prueba con los mismos criterios y `GET /api/curated-profiles/{slug}` → `experiences`, `skillCategories` y `projects` iguales a los del preview. Restaurar el perfil al terminar. Verificar: `npm run test:e2e` verde; salida en `verification/3.2-e2e.txt`.
- [ ] 3.3 Si existe un test sobre el ejemplo (`example-translations.spec.ts` o la verificación del seed de ejemplo), sumar el escenario *Datos de ejemplo — ejemplo-overrides* (Kotlin ausente, dos proyectos, Prototipo en Pausa ausente); si no existe, comprobarlo en 6.2. Verificar: test verde o nota en `verification/6.2-tc43.txt`.

## 4. Funciones puras del borrador (D2, D3, D5, D7, D8, D10)

- [ ] 4.1 `frontend/src/features/backoffice/curated-profiles/selection-overrides.ts` (o en `profile-draft.ts`): `overrideState(draft, id)` → `'include' | 'exclude' | 'none'` (id en ambos → `'exclude'`); `setOverride(draft, id, mode)` con la exclusión mutua de D5, sin mutar y sin duplicar ids. Verificar: tests de 4.4.
- [ ] 4.2 `orphanOverrideIds(draft, experiences, categories, projects)`: ids de los dos arreglos que no están en ninguna lista, sin duplicados; `removeOverrideIds(draft, ids)`. Verificar: tests de 4.4.
- [ ] 4.3 `filterSkillCategories(categories, query)` (sin distinguir mayúsculas ni acentos, recorte de espacios, query vacía → todo, categorías sin coincidencias fuera) y `tagUniverse(experiences, categories, projects, extra)` con los tags de proyectos. Actualizar el llamador. Verificar: tests de 4.4.
- [ ] 4.4 Tests de Vitest (`selection-overrides.spec.ts` y `profile-draft.spec.ts`): `setOverride` incluir→excluir→incluir mueve el id entre arreglos; `none` lo quita de ambos; id en ambos → `overrideState` `'exclude'` y `setOverride(…, 'include')` lo deja solo en `includeIds`; huérfanos con un id de cada tipo existente y uno inexistente → solo el inexistente; `filterSkillCategories` con `kot`, `KOT`, `Ñandú` vs `nandu`, `  ` y un texto sin coincidencias; `tagUniverse` con un tag que solo tiene un proyecto. Verificar: `npm test` verde en `frontend/`.

## 5. Constructor (D3, D4, D5, D6, D7, D9, D10)

- [ ] 5.1 `SelectionOverrides.tsx`: `OverrideRow` (etiqueta, detalle, insignia opcional, botones con `aria-pressed` y `aria-label` «Incluir <nombre>»/«Excluir <nombre>», motivo de deshabilitado en `title` y `sr-only`) y la lista desplazable con `tabIndex={0}` y nombre accesible. Verificar: tests de 5.6.
- [ ] 5.2 `ProfileBuilderPage.tsx`: el bloque **Experiencias** pasa a `OverrideRow` y a `setOverride` (mismos textos y `aria-label` que hoy); las ocultas van al final con la insignia **Oculta** y el comportamiento de D6. Verificar: el test existente «excluir una experiencia la manda en excludeIds» sigue verde sin cambios.
- [ ] 5.3 Bloque **Skills**: buscador **Buscar skill** (estado de vista, fuera del borrador), grupos por categoría con encabezado (nombre en español y el contador «N incluidas · M excluidas» si hay alguna) y una fila por skill; mensaje «Ninguna skill coincide con "<texto>"». Verificar: tests de 5.6.
- [ ] 5.4 Bloque **Proyectos** con `useProjects()`: «Nombre · rol (es)», ocultos al final con **Oculto** y D6. Carga y error por bloque (`LoadingRows`, `ErrorPanel` con reintento) sin bloquear el resto. Verificar: tests de 5.6.
- [ ] 5.5 Aviso de huérfanos (D7): con las tres listas cargadas y al menos un huérfano, «N referencias a ítems que ya no existen» (singular con 1) y botón **Quitar**. Verificar: tests de 5.6.
- [ ] 5.6 Tests de Vitest (`ProfileBuilderPage.test.tsx`, fixtures en `src/test/` con skills, un proyecto visible, uno oculto y un perfil con overrides de los tres tipos, uno en ambos arreglos y un id huérfano), uno por escenario de los deltas de `curated-profile-builder`: excluir Kotlin → el cuerpo del preview lleva su id en `excludeIds`; incluir React; incluir quita la exclusión; id en los dos arreglos; buscar `kot` (sin petición de preview nueva); búsqueda sin resultados; la búsqueda no ensucia (*Volver* sin diálogo); incluir y excluir un proyecto; proyecto oculto con Incluir deshabilitado; quitar la inclusión de una experiencia oculta; huérfano informado sin ensuciar; **Quitar** y guardar → `PATCH` sin el huérfano; lista de proyectos con error → sin aviso de huérfanos y el `PATCH` conserva los ids; tag de proyecto en el universo. Verificar: `npm test`, `npm run lint` y `npm run typecheck` verdes en `frontend/`.
- [ ] 5.7 Contrato sin cambios: `npm run openapi:export` en `backend/` y `npm run api:types` en `frontend/`. Verificar: `git diff --exit-code backend/openapi.json frontend/src/shared/types/api.d.ts` sin diferencias y el test de deriva verde.
- [ ] 5.8 `npm run build` y `npm run perf:budget`: el arranque público no cambia (el constructor vive en el chunk del panel). Verificar: salida en `verification/5.8-perf-budget.txt` con la diferencia frente a 1.1 (esperado: 0).

## 6. App real sobre base descartable

- [ ] 6.1 Preparar `portfolio_overrides_check`: `npm run prisma:deploy`, `SEED_DISPOSABLE_DB=1 npm run seed:example` y `npm run admin:bootstrap` con las credenciales de prueba de `.env.example`. API en un puerto libre y la imagen de `frontend/Dockerfile` contra ella, como en TC-42. Verificar: `npm run prisma:status` muestra `portfolio_overrides_check`; `GET /health` 200.
- [ ] 6.2 Recorrer **TC-43** completo en Chrome no headless (pasos de `verification.md`). Verificar: transcripción en `verification/6.2-tc43.txt` con los contadores del preview en cada paso, los cuerpos de las peticiones de preview y del `PATCH` (`includeIds`/`excludeIds`), el `aria-pressed` y `disabled` leídos del DOM, el resultado público en la ventana privada y la consola sin errores. Si los contadores difieren de los del caso, anotar los observados y corregir el texto del manual.
- [ ] 6.3 `A11Y_CHECK_DISPOSABLE_DB=1 A11Y_CHECK_PROFILE=ejemplo-backend npm run a11y:check` con el panel. Verificar: ninguna violación nueva en el constructor frente a la corrida de `add-certification-verification`, en particular sin `scrollable-region-focusable` ni `color-contrast` en las listas nuevas; salida en `verification/6.3-a11y.txt`. Borrar la base descartable al terminar.

## 7. Documentación

- [ ] 7.1 `docs/MANUAL.md`: **TC-43 — Ajustar skills y proyectos de un perfil** (texto de `verification.md`, sección 3 después de TC-13); B10 con filas de **Incluir/Excluir (por skill)**, **Incluir/Excluir (por proyecto)**, **Buscar skill**, la insignia **Oculta/Oculto**, el aviso de referencias huérfanas y sus mensajes literales, sin la «Limitación vigente»; TC-13 menciona los tres bloques y la exclusión mutua; fila de TC-43 en la suite (§ 6); glosario (*referencia huérfana*). Capturas con `npm run manual:capture` contra la API de ejemplo: `tc43-overrides.jpg` nueva (bloques Skills y Proyectos de `ejemplo-overrides` con Kotlin excluida y el proyecto oculto) y `tc13-seleccion.jpg` regenerada; `capture-manual.mjs` suma la entrada. Verificar: capturas en `docs/manual/`, cada una ≤ 150 KB.
- [ ] 7.2 `docs/manual/index.html` alineado con `MANUAL.md` (caso, índice lateral, `td.msg` con los mensajes nuevos, imágenes). Verificar: `npm run manual:check` verde.
- [ ] 7.3 `docs/DATA-POPULATION.md`: la fila de `includeRefs`/`excludeRefs` (§ 12) y la nota de § 96 dicen que skills y proyectos también se ajustan desde **Selección**. Verificar: revisión del diff.
- [ ] 7.4 `docs/CHANGELOG.md` (entrada del change) y `docs/PROPUESTA-FEATURES.md` § 6.2 (fila marcada como hecha, con los requisitos ADDED y MODIFIED reales). Verificar: revisión del diff.
- [ ] 7.5 Al archivar, `CLAUDE.md` § Roadmap suma la línea: `- [x] \`add-builder-skill-project-overrides\` — el constructor incluye y excluye skills (por skill, agrupadas por categoría y con buscador) y proyectos en los mismos \`includeIds\`/\`excludeIds\` (ids cuid compartidos), con Incluir y Excluir mutuamente excluyentes, ocultos marcados y referencias huérfanas visibles; solo frontend, sin cambios de contrato (archivado AAAA-MM-DD)`. Verificar: revisión del diff del archivado.

## 8. Cierre

- [ ] 8.1 `backend/`: `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:e2e`; `frontend/`: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run perf:budget`, `npm run manual:check`. Verificar: todo verde; salida en `verification/8.1-cierre.txt`.
- [ ] 8.2 `npx -y @fission-ai/openspec@1.14.1 validate add-builder-skill-project-overrides --strict` y `validate --all --strict`, sin «Archive would refuse». Verificar: salida en `verification/8.2-validacion.txt`.
- [ ] 8.3 `git diff --stat main -- backend/src backend/prisma backend/scripts` vacío (D1) y la base `portfolio` del owner sin escrituras. Verificar: nota en `verification/8.3-alcance.txt`.
