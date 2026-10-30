# Design — add-builder-skill-project-overrides

## Context

Ver `proposal.md`. Estado verificado el 29 de octubre de 2026 sobre `main` (`cbc1d9c`, con `add-certification-verification` fusionado y sin archivar):

- **Modelo.** `CuratedProfile.includeIds String[]` y `excludeIds String[]` (`backend/prisma/schema.prisma`; el comentario dice «exp/skill»). `Experience`, `Skill`, `SkillCategory` y `Project` tienen `id String @id @default(cuid())`. `Experience` y `Project` tienen `visible`; `Skill` no.
- **Núcleo.** `CuratedProfileComposer.composeWithResolution` arma **un** `SelectionCriteria { filterTags, includeIds, excludeIds }` y lo pasa a:
  - `selectByTags(experiencias visibles)` → `sortExperiences`;
  - `selectByTags(portfolio.projects)` → orden por `order` (`PortfolioSectionsLoader` ya filtra `visible`);
  - `selectSkillCategories(categorías)`, que aplica `selectByTags` a las **skills** de cada categoría y descarta las que quedan vacías. Los ids de categoría no se consultan.
  - `selectByTags`: `excludeIds` gana, `includeIds` fuerza, ids desconocidos se ignoran. La visibilidad la decide el llamador.
- **Preview.** `PreviewCuratedProfileUseCase` usa el mismo composer (`admin-curated-profile-preview`, «Misma resolución que la ruta pública»).
- **API del panel.** `CreateCuratedProfileDto`/`UpdateCuratedProfileDto`: `includeIds`/`excludeIds` con `@IsArray() @IsString({ each: true })`, sin restricción de tipo. La API de creación de experiencias, skills y proyectos no acepta `id`.
- **Seed.** `seed-runner.ts` traduce `includeRefs`/`excludeRefs` (`experience:<id>`, `project:<id>`, `skill:<nombre>`) a los cuid que genera la base. En el ejemplo, `ejemplo-overrides` (`filterTags: ["java","microservices"]`) incluye `experience:brujula`, `experience:terracota` (oculta) y `project:herramienta-interna`, y excluye `experience:atlas` y `skill:Kotlin`.
- **Constructor.** `ProfileBuilderPage.tsx`, pestaña **Selección**: chips de tags (`tagUniverse(experiences, categories, filterTags)`, **sin proyectos**) y una lista de experiencias con **Incluir**/**Excluir** que alternan cada arreglo de forma independiente (`toggleIn`). Las experiencias ocultas se listan sin distinción. No hay bloque de skills ni de proyectos. Carga `useExperiences()` y `useSkillCategories()`; `useProjects()` vive en `proyectos/use-proyectos-api.ts`.
- **Borrador.** `profile-draft.ts`: `toDraft`, `toProfileBody` (cuerpo del `PATCH`, base del aviso de cambios sin guardar) y `previewKey` (ordena los arreglos para la clave del preview).
- **Manual.** B10 y TC-13 describen solo experiencias; B10 tiene la «Limitación vigente».

## Goals / Non-Goals

**Goals:** paridad de **Incluir**/**Excluir** para skills y proyectos en el constructor, con el mismo resultado que la API y la ruta pública; que el panel no ofrezca acciones que el núcleo ignora (incluir un oculto, un id de categoría); que el estado guardado sea siempre visible y editable, incluso el que llegó por seed o por API; cero cambios de contrato.

**Non-Goals:** ver `proposal.md` § Non-goals.

## Decisions

### D1 — El change es solo de frontend

El núcleo ya resuelve overrides de skills y proyectos con la misma regla que las experiencias, y el preview lo hereda por compartir `CuratedProfileComposer`. El constructor solo necesita escribir los ids correctos en `includeIds`/`excludeIds`. No se toca `backend/src`, ni el schema, ni los DTOs, ni `openapi.json`; el test de deriva del frontend lo comprueba.

Alternativa descartada: **un endpoint o un servicio de «overrides por tipo»** en el backend. Duplicaría la regla que ya vive en `selectByTags` y abriría la puerta a que el preview y la ruta pública diverjan.

### D2 — Un único arreglo compartido entre tipos, sin prefijo

Skills y proyectos se guardan en los mismos `includeIds`/`excludeIds` que las experiencias, como ids crudos.

- Todos los ids los genera Prisma con `cuid()` (25 caracteres, contador y aleatoriedad por proceso). La API no acepta ids elegidos por el cliente y el seed traduce las referencias a cuid. La probabilidad de que un cuid de `Skill` coincida con uno de `Project` es despreciable, y aun así el efecto sería forzar o quitar dos ítems, no un error.
- Es el contrato que ya usan la API, el seed (`includeRefs` mezcla tipos) y `curated-profile-resolution` («los overrides comparten el mismo espacio de ids»).
- El frontend identifica el tipo de cada id por pertenencia a la lista cargada, no por el formato.

Alternativas descartadas:
- **Columnas por tipo** (`includeSkillIds`, `includeProjectIds`, …): migración, cambio del contrato del panel, del preview, del seed y de `duplicate`, para un riesgo que no existe en la práctica.
- **Prefijo de tipo** (`skill:<id>`): rompe los perfiles guardados y obliga a cambiar `selectByTags` y el seed.

### D3 — Overrides por skill individual, agrupados por categoría

El bloque **Skills** lista cada categoría (nombre en español, en el orden de `order`) con sus skills; cada skill tiene **Incluir** y **Excluir**. Solo se escriben ids de `Skill`.

- `selectSkillCategories` decide por skill y la categoría aparece si le queda alguna: incluir una skill de una categoría sin coincidencias hace aparecer la categoría con esa sola skill; excluir la última la hace desaparecer. Es exactamente lo que el preview muestra.
- Un id de `SkillCategory` en los arreglos sería ignorado en silencio por el núcleo: el panel nunca lo escribe.
- Cada categoría muestra cuántas skills tiene forzadas o quitadas, para que el estado no quede escondido en una categoría plegada.

Alternativas descartadas:
- **Ids de categoría con significado propio** («excluir Frontend entera»): requiere cambiar `selectSkillCategories` y la spec del núcleo. Queda como P1.
- **Atajo que expande la categoría a los ids de sus skills**: es una foto; una skill agregada después a la categoría no queda incluida ni excluida, y el owner no lo vería. Queda como P1.

### D4 — Un componente de fila compartido para los tres tipos

`SelectionOverrides.tsx` exporta una fila (`OverrideRow`: etiqueta, detalle, insignia opcional y los dos botones con `aria-pressed` y `aria-label` «Incluir <nombre>»/«Excluir <nombre>») y una lista con altura máxima y desplazamiento propio. El bloque de experiencias actual pasa a usarla sin cambiar sus textos; **Skills** y **Proyectos** la reutilizan. La lista desplazable lleva `tabIndex={0}` y nombre accesible, como la región desplazable de `DashboardPage.tsx` que corrigió `fix-admin-contrast` (`scrollable-region-focusable`); `a11y:check` con el panel no debe sumar esa violación.

- Experiencia: «Empresa · rol (es)».
- Skill: su nombre; la categoría es el encabezado del grupo.
- Proyecto: «Nombre · rol (es)».

Alternativa descartada: **copiar el bloque de experiencias tres veces.** Tres lugares donde corregir la accesibilidad y la exclusión mutua.

### D5 — Incluir y Excluir se excluyen entre sí en la interfaz

Una función pura `setOverride(draft, id, mode)` con `mode ∈ 'include' | 'exclude' | 'none'` reemplaza a `toggleIn` para los overrides:

- Pulsar **Incluir** en un ítem no incluido lo agrega a `includeIds` y lo quita de `excludeIds`; pulsarlo estando incluido lo quita (`none`). Simétrico para **Excluir**.
- `overrideState(draft, id)` devuelve `'include' | 'exclude' | 'none'`; si el id está en los dos arreglos (solo puede llegar por API o seed), devuelve `'exclude'`, porque es lo que hace el núcleo, y la fila muestra «Excluida: la exclusión gana sobre la inclusión».
- Sigue partiendo del estado vigente (`setDraft(current => …)`), como `toggleIn`, para que varios clics en la misma tanda no se pisen.

Cambia el comportamiento de las experiencias: hoy se puede dejar un id en los dos arreglos desde el panel. Es un cambio de interfaz, no de datos ni de resultado (la exclusión ya ganaba).

Alternativa descartada: **mantener los dos botones independientes.** Permite armar desde el panel un estado contradictorio cuyo efecto solo se entiende leyendo la spec.

### D6 — Los ítems ocultos se listan, marcados, sin poder incluirse

Experiencias y proyectos con `visible: false` aparecen al final de su bloque con la insignia **Oculta**/**Oculto** (el estilo AA de `fix-admin-contrast`).

- **Incluir** está deshabilitado con el motivo «Oculta: no entra aunque la incluyas» (`title` y texto `sr-only`), salvo que el id ya esté en `includeIds`: entonces está habilitado para poder quitarlo (el caso de Terracota Demo en `ejemplo-overrides`).
- **Excluir** queda habilitado: no cambia el resultado hoy y protege el perfil si el ítem vuelve a ser visible.
- Las skills no tienen visibilidad (non-goal).

Alternativas descartadas:
- **No listar los ocultos.** Un `includeIds` vigente sobre un oculto quedaría invisible y solo se vería como «referencia huérfana».
- **Dejar Incluir habilitado** (como hoy en experiencias): ofrece una acción que el núcleo ignora.

### D7 — Las referencias huérfanas se conservan y se pueden quitar

Una referencia huérfana es un id de `includeIds`/`excludeIds` que no está en ninguna de las tres listas cargadas (el ítem se borró).

- Se **conservan** en el borrador y en el `PATCH`: descartarlas al cargar ensuciaría la ficha recién abierta (el aviso de cambios sin guardar compara `toProfileBody`) y, si una lista falla al cargar, borraría overrides válidos.
- `orphanOverrideIds(draft, experiences, categories, projects)` solo se calcula cuando las **tres** listas cargaron bien. Con al menos una, la pestaña muestra «N referencias a ítems que ya no existen» y el botón **Quitar**, que las saca del borrador (cuenta como cambio y se guarda con **Guardar**).
- El núcleo ya las ignora: no cambian el resultado.

Alternativa descartada: **limpiarlas automáticamente al guardar.** Modifica datos que el owner no tocó y depende de que las tres listas estén completas en ese momento.

### D8 — El universo de tags suma los tags de proyectos

`tagUniverse(experiences, categories, projects, extra)` agrega los tags de los proyectos (visibles y ocultos, como hoy con las experiencias). El requisito vigente ya decía «experiencias, skills y proyectos»; la implementación los omitía. Un proyecto con un tag que nada más tiene ya no obliga a escribirlo a mano.

Alternativa descartada: **dejarlo fuera del change.** Es el mismo bloque, el mismo test y el mismo requisito que se modifica.

### D9 — Datos desde las rutas del panel que ya existen

El constructor suma `useProjects()` (de `proyectos/use-proyectos-api.ts`, misma clave de TanStack Query, así que comparte caché con la pantalla de proyectos). Cada bloque maneja su carga y su error (`LoadingRows` y `ErrorPanel` con reintento) sin bloquear el resto de la ficha ni el guardado. Sin endpoints, sin dependencias y sin tocar el chunk público.

Alternativa descartada: **un endpoint agregado «catálogo de selección».** Un contrato nuevo para datos que el panel ya trae.

### D10 — Buscador de skills como estado de vista

Un campo **Buscar skill** encima del bloque filtra por nombre (sin distinguir mayúsculas ni acentos, `normalize('NFD')`); las categorías sin coincidencias se ocultan mientras dura la búsqueda y, si nada coincide, se muestra «Ninguna skill coincide con "<texto>"». La búsqueda no entra en el borrador ni ensucia la ficha (como el idioma del preview) y no afecta al preview. La función pura `filterSkillCategories(categories, query)` vive junto al borrador.

Experiencias y proyectos no llevan buscador: hoy son pocas filas (15 y 2 en `cv-data.json`). Ver P3.

Alternativa descartada: **buscar en el backend.** Un viaje de red por pulsación para un centenar de nombres que ya están en memoria.

### D11 — Los escenarios del núcleo se fijan como regresión, sin tocar su texto

`curated-profile-resolution` dice que skills y proyectos siguen la misma regla de overrides, pero no tiene escenarios de **incluir** una skill o un proyecto, ni de un proyecto oculto en `includeIds`. Como el constructor pasa a depender de ese comportamiento, los requisitos *Selección de skills por categoría* y *Selección de proyectos por tags* se MODIFICAN **solo para sumar escenarios** (el texto queda igual), y *Misma resolución que la ruta pública* suma uno de skills y proyectos en el preview. Se cubren con tests unitarios (servicios puros y caso de uso con repositorios simulados) y un e2e del preview.

Alternativa descartada: **requisitos ADDED nuevos en el núcleo.** Repetirían una regla que ya está escrita; dos requisitos con la misma regla pueden divergir.

## Risks / Trade-offs

- **[Cambio de comportamiento en experiencias por D5]** → Un owner acostumbrado a marcar los dos botones ve que uno apaga al otro. Mitigación: el resultado del perfil no cambia (la exclusión ya ganaba); el manual (B10, TC-13) lo explica.
- **[Pestaña Selección larga]** → Con 12 categorías y 108 skills la lista crece. Mitigación: lista con altura máxima y desplazamiento propio, buscador (D10) y contador por categoría (D3).
- **[Ids huérfanos de cualquier tipo]** → No se puede saber de qué tipo era un id borrado. Mitigación: solo se cuentan y se ofrecen para quitar (D7); no afectan el resultado.
- **[Colisión de cuid entre tablas]** → Teórica (D2). Efecto acotado: dos ítems forzados o quitados a la vez.
- **[Una lista falla al cargar]** → El bloque muestra el error y su reintento; no se calculan huérfanos (D7) y el guardado no altera los ids de esa lista.

## Migration Plan

Sin migración de base ni de contrato. El despliegue es el del frontend; los perfiles guardados se ven igual en el sitio. En el panel, los overrides de skills y proyectos que ya existían (por seed o API) pasan a verse marcados en la pestaña Selección. Rollback: revertir el commit del frontend; los datos guardados con la versión nueva son válidos para la anterior.

## Open Questions

Ninguna era bloqueante para implementar. **Resueltas el 2026-10-29 con la recomendación del arquitecto (P1: A, P2: A, P3: A)**: sin overrides por categoría, el contador del preview no cambia y el buscador queda solo en skills. Las alternativas B y C quedan como ideas de changes aparte.

- **P1 — Overrides por categoría completa.** **[no bloqueante]**
  - A) No en este change: solo skills individuales (D3).
  - B) Atajo «Incluir todas / Excluir todas» que expande a los ids de las skills actuales de la categoría.
  - C) Ids de `SkillCategory` con significado propio en el núcleo (MODIFIED de *Selección de skills por categoría* y cambio de `selectSkillCategories`).

  **Resuelta: A (2026-10-29).** **Recomiendo A.** B deja una foto que no sigue a las skills nuevas; C toca el núcleo. Si el uso real lo pide, C es la forma correcta en un change aparte.
- **P2 — Contador de skills en el preview.** Hoy dice «N experiencias · N categorías · N proyectos». **[no bloqueante]**
  - A) Dejarlo así.
  - B) Sumar «M skills» (MODIFIED de *Preview en vivo del resultado*).

  **Resuelta: A (2026-10-29).** **Recomiendo A**: el preview ya muestra las skills; B se puede sumar sin costo si al usarlo se extraña.
- **P3 — Buscador en experiencias y proyectos.** **[no bloqueante]**
  - A) Solo en skills (D10).
  - B) En los tres bloques.

  **Resuelta: A (2026-10-29).** **Recomiendo A** mientras haya menos de 30 experiencias y 10 proyectos.
