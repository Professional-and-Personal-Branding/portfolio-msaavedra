# Design — add-featured-repositories

## Context

- `FeaturedRepository` existe en `backend/prisma/schema.prisma` desde la migración `20260906055928_init` con `id` (cuid), `name`, `url`, `language?`, `description` (Json), `technologies[]`, `tags[]`, `stars?`, `order` y `visible`. Lo tocan solo los scripts: `seed-source.ts` (tipo `SeedFeaturedRepository` y validación), `seed-runner.ts` (crea **solo los visibles**), `seed-guard.ts` (cuenta la tabla para negarse a sobrescribir) y `verify-seed.ts` (conteo esperado = visibles). `docs/cv-data.json` trae un placeholder `PENDIENTE-CURAR` con `visible: false`; el ejemplo trae `[]`.
- Proyectos son la plantilla más cercana: `modules/project/` (entidad, `validateProject`, casos de uso público y de admin, Prisma, controllers), sección `projects`, `selectByTags` en `CuratedProfileComposer`, bloque en `print-sheet.ts`, `Projects.tsx`, `/admin/proyectos` y el bloque de proyectos del constructor (`add-builder-skill-project-overrides`).
- El catálogo de secciones vive solo en `curated-profile/domain/services/resolve-sections.ts` (`SECTION_IDS`) y viaja como enum `SectionId` del OpenAPI; el registro del cliente es `Record<SectionId, …>` y no compila si falta un id (`unify-section-catalog`). `sectionsWithData` es la única definición de «sección con datos»; los datos de una sección oculta siguen en la respuesta.
- Arranque público: un solo JS de módulo, ≤ 155 KB gzip, medido por `perf:budget` (~148 KB tras `improve-mobile-performance`). Todas las secciones están hoy en ese chunk.
- La hoja imprimible tiene límites calibrados para entrar en una página (`PRINT_LIMITS`, D3 de `add-printable-one-page`); no hay margen libre conocido.
- En paralelo se diseñan `add-integrations-foundation` (cola, cron, cifrado, `ExternalSnapshot`) y `add-job-posting-intake`. `add-github-code-evidence` vendrá después sobre la base de integraciones.

## Goals / Non-Goals

**Goals:** activar la entidad de punta a punta con curaduría manual; sección filtrable por perfil curado que se oculta con menos de 2 repos; CRUD en el panel; selección en el constructor; seed y ejemplo coherentes; contrato sin deriva; arranque público sin crecer por la sección; una hoja en `print:check`.

**Non-Goals:** sincronizar con GitHub, mostrar stars, otros hosts, JSON-LD, contadores del preview (ver `proposal.md`).

## Decisions

### D1. Módulo `featured-repository` sobre la plantilla de `project`, sin migración

`backend/src/modules/featured-repository/{domain,application,infrastructure}` y `featured-repository.module.ts`, con el token `FEATURED_REPOSITORY_REPOSITORY`. `PortfolioSectionsLoader` suma el puerto (como hizo con proyectos), así el composer no gana otra dependencia. La tabla de `init` ya tiene todo lo necesario: **no hay migración** y `schema.prisma` no cambia.

*Alternativa descartada:* meter los repos dentro del módulo `project` (un `kind`). Mezcla dos entidades con campos y reglas distintas (período y rol contra URL de GitHub) y obligaría a migrar datos.

### D2. URL solo de GitHub, canónica y única (decisión del owner P1)

Función pura de dominio `parseGithubRepositoryUrl(value): Result<{ owner, repo }, ValidationError>` en `featured-repository/domain/services/`. Acepta exactamente `https://github.com/<owner>/<repo>`:

- esquema `https`, host `github.com` exacto (sin `www.`, sin puerto, sin usuario);
- `owner`: 1–39 caracteres alfanuméricos o guiones simples, sin guion al principio ni al final;
- `repo`: 1–100 de `[A-Za-z0-9._-]`, distinto de `.` y `..`, sin terminar en `.git`;
- sin más segmentos, sin barra final, sin query ni fragmento.

No normaliza: un valor fuera de forma es 400 con un mensaje que muestra la forma esperada. El DTO solo recorta espacios. El panel replica la regla en Zod con el mismo mensaje y el seed importa la función del dominio (como ya importa `SECTION_IDS`).

**Unicidad:** crear o editar un repo cuyo `owner/repo`, sin distinguir mayúsculas, ya existe en otro registro devuelve `ConflictError` (409) sin guardar. Se resuelve en el caso de uso con `findAll()` (la tabla tiene decenas de filas); no hay índice único en la base porque exigiría una migración con expresión `lower()` para una regla que el dominio ya garantiza. La sincronización usará `owner/repo` como clave: dos filas con el mismo repo la duplicarían.

*Alternativa descartada:* URL https genérica (cualquier host). El owner la descartó: solo tiene repos en GitHub y la sincronización futura solo habla con GitHub.

### D3. Campos expuestos y preparación para la sincronización

Salida pública: `id`, `name`, `url`, `language` (nulo si no hay), `description` (resuelta), `technologies[]`, `tags[]`, `order`. Salida del panel: lo mismo sin resolver (`description` `{es,en}`) más `visible`. Reglas: `name` 1–100 caracteres sin contar espacios de los bordes; `language` hasta 40 o nulo; `description.es` obligatorio (mismo `LocalizedTextDto` que proyectos).

`stars` **no se expone ni se edita**: queda nula y es dominio de la sincronización. Lo que `add-github-code-evidence` necesita ya está: `owner/repo` derivable de la URL canónica (D2) y un `id` estable para colgar el snapshot de la tabla de `add-integrations-foundation`. Ese change sumará campos de salida (stars, topics, lenguajes, «verificado el…») como opcionales sin rehacer la entidad ni el contrato.

*Alternativa descartada:* exponer `stars` editable a mano. Un número que nadie verifica y que envejece resta credibilidad justo en la sección que busca evidencia.

### D4. Sección `repositories`, 10.º id, después de `projects`

`SECTION_IDS = hero, stats, experience, skills, projects, repositories, education, certifications, presence, contact`. Un perfil con `sectionsOrder` vacío la muestra después de proyectos; uno con orden explícito la recibe por el relleno al final, como cualquier sección con datos que no figura (regla vigente, no se re-litiga). Ninguna plantilla de `docs/cv-data.json` declara `sectionsOrder`, así que el owner no ve el relleno al final salvo que lo configure.

### D5. Selección con `selectByTags` y el mismo espacio de overrides

Repos visibles → `selectByTags(repos, { filterTags, includeIds, excludeIds })` → orden por `order` ascendente. `filterTags` vacío = todos; `excludeIds` gana; `includeIds` solo fuerza visibles; ids inexistentes se ignoran. Los ids son cuid compartidos con experiencias, skills y proyectos en los mismos arrays.

### D6. La sección exige 2 repos resueltos; los datos se conservan

`MIN_REPOSITORIES_FOR_SECTION = 2` en el dominio de `curated-profile`. `sectionsWithData` marca `repositories` solo si `output.repositories.length >= 2`. La clave `repositories` de la respuesta conserva lo seleccionado (0, 1 o más), igual que hoy conserva los datos de una sección oculta: el constructor usa eso para avisar «la sección se muestra desde 2 repos; este perfil resuelve 1» (D13). Con 1 repo, la sección no está en `sections`, no se renderiza, no se imprime y no se exporta al JSON Resume.

*Alternativa descartada:* vaciar el array con menos de 2. Pierde la información que el constructor necesita para explicar por qué no aparece la sección.

### D7. Rutas

- `GET /api/featured-repositories?locale=` (público, sin auth): visibles por `order`, con la forma de D3. Mantiene la paridad con `/api/projects` y sirve a la verificación por API del manual.
- `/api/admin/featured-repositories`: `GET` (crudo, con ocultos), `POST`, `GET /:id`, `PATCH /:id`, `DELETE /:id`, con el guard del panel, whitelist (`forbidNonWhitelisted`) y los errores de siempre (400, 401, 404, 409).

### D8. Vista pública: componente en un chunk diferido

`Repositories.tsx` (tarjetas con el nombre como enlace `target="_blank" rel="noopener noreferrer"`, nombre accesible propio, descripción, lenguaje y tecnologías; sin íconos nuevos ni recursos de otros orígenes) se carga con `lazyWithPreload` desde `section-registry.ts`. Cuando la vista recibe un perfil cuyo `sections` contiene `repositories`, llama a `preload()` antes del revelado en dos tiempos; mientras llega, la sección renderiza un contenedor `#repositories` con el título y un alto mínimo reservado, sin spinner. El preview del panel usa el mismo registro. El registro sigue tipado como `Record<SectionId, ComponentType<SectionProps>>`.

Objetivo medible: `perf:budget` no crece más de 0,5 KB gzip por este change (lo que suman los rótulos, el wrapper diferido y el id); el JS de la sección queda fuera de `dist/index.html`.

*Alternativa descartada:* importar la sección de forma estática como las demás (~1–1,5 KB gzip). Funciona hoy, pero gasta un margen de ~7 KB que el arranque necesita para lo que viene, y la sección no aparece en todos los perfiles.

### D9. Hoja imprimible: una línea compacta, solo si entra (decisión del owner P2)

Bloque `kind: 'repositories'` de **una línea**: rótulo en línea («Repositorios:» / «Repositories:») y hasta `PRINT_LIMITS.repositories = 3` nombres enlazados a su URL, separados por « · »; si hay más, cierra con «y N más» en la misma línea. La URL no se imprime (como «Ver credencial»). Nombres de más de 40 caracteres se recortan con «…» en el dato, no con CSS. Va en la posición que le da `sections`.

**Criterio determinístico «entra»:** función pura `estimatePrintLines(blocks)` en `print-sheet.ts`, con pesos fijos por elemento y `CHARS_PER_LINE = 110` para el texto que envuelve:

| Elemento | Líneas |
|---|---|
| Encabezado (nombre, titular, contacto, detalles) | 5 |
| Título de bloque | 1,5 |
| Resumen | `min(4, ceil(chars / CHARS_PER_LINE))` |
| Experiencia detallada | 1 + Σ `ceil(logro / CHARS_PER_LINE)` + 1 (tecnologías) |
| Experiencia en una línea, formación, línea de omitidos | 1 cada una |
| Categoría de skills | `ceil(chars / CHARS_PER_LINE)` |
| Proyecto | 1 + `ceil(resumen / CHARS_PER_LINE)` + (1 si hay enlace) |
| Certificaciones | `ceil(chars del párrafo / CHARS_PER_LINE)` |
| URL de cierre | 1 |
| Línea de repositorios | 1,5 |

`buildPrintSheet` arma primero la hoja sin repos; si `repositories` está en `sections` y `estimatePrintLines(hoja) + 1,5 ≤ PRINT_CAPACITY_LINES`, inserta la línea; si no, la omite **sin línea de omitidos** (como `stats`, no es un recorte de cantidad y la URL de cierre lleva a la versión completa). `PRINT_CAPACITY_LINES` se calibra en la implementación: el mayor valor con el que `print:check` sigue dando una hoja en todas las combinaciones de las dos bases (cv-data con dos repos de prueba y el ejemplo) y en un fixture al límite; el valor y la tabla quedan en este D al cerrar. Si el estimador falla en el sentido optimista, `print:check` lo detecta; el *Desborde ordenado* vigente evita perder texto.

*Alternativa descartada:* medir la altura real en el navegador al imprimir (`beforeprint`). No es reproducible entre navegadores ni testeable sin navegador, y la hoja está en `display: none` en pantalla.

### D10. JSON Resume: los repos van a `projects`

Cada repo de la vista, si `repositories` está en `sections`, se agrega a `projects` **después** de los proyectos: `name`, `description`, `url`, `keywords` (lenguaje primero si no está en tecnologías, luego tecnologías, sin repetidos sin distinguir mayúsculas) y `type: "repository"`. Sin fechas ni `roles`. El schema v1.0.0 vendorizado define `type` en `projects`. Con `projects` oculta y `repositories` visible, la clave `projects` existe solo con repos.

*Alternativa descartada:* no exportarlos. Los importadores de JSON Resume no tienen otro lugar para código y el repo es justo lo que un ATS técnico enlaza.

### D11. JSON-LD sin cambios

El `Person` no suma `SoftwareSourceCode` ni `subjectOf`. No hay requisito de los buscadores que lo pida y `public-seo` queda intacto, lo que evita tocar el fragmento del head y su cache.

### D12. Panel: bloque Repositorios dentro de `/admin/proyectos`

Tercer bloque de la página (después de Proyectos, antes de Enlaces), con el mismo patrón de lista + diálogo: Nombre, URL de GitHub, Lenguaje, Descripción ES/EN, Tecnologías, Tags, Orden y Visible en el sitio. Si el nombre está vacío al salir del campo URL válido, se propone el segmento `repo` (editable). El diálogo usa el aviso de cambios sin guardar vigente. Mensajes literales (en el manual): «La URL tiene que ser https://github.com/<usuario>/<repositorio>» y «Ese repositorio ya está cargado». La navegación del panel no cambia de entradas; el rótulo de la página pasa a «Proyectos, repositorios y enlaces».

*Alternativa descartada:* entrada propia en la navegación. Agrega una pantalla para una lista corta que cambia con la misma frecuencia que proyectos.

### D13. Constructor

En la pestaña Selección, bloque **Repositorios** con Incluir/Excluir por repo (mismo componente que proyectos), ocultos marcados con Incluir deshabilitado salvo para quitar una inclusión existente. La detección de referencias huérfanas pasa a exigir las **cuatro** listas cargadas (experiencias, skills, proyectos, repositorios). Si el preview trae `repositories` con exactamente 1 elemento y `sections` no contiene `repositories`, el bloque muestra «La sección Repositorios se muestra desde 2; este perfil resuelve 1». `detectMissingTranslations` suma `description` de cada repo seleccionado, agrupado como «Repositorio».

### D14. Seed

- Carga **todos** los repos del archivo (también los ocultos, con su `visible`), en el orden del archivo como `order`, igual que proyectos. `expectedCounts` y `seed:verify` cuentan todos.
- `SeedFeaturedRepository.id` opcional (estable, como `projects[].id`), único en el archivo; obligatorio solo si una plantilla lo referencia con `repository:<id>` en `includeRefs`/`excludeRefs`.
- La validación usa `parseGithubRepositoryUrl` y la unicidad de D2 antes de borrar nada; nombra el campo (`profile.featuredRepositories[i].url`).
- `stars` del archivo se sigue aceptando (retrocompatibilidad) y se ignora al escribir.
- `docs/cv-data.json`: el placeholder `PENDIENTE-CURAR` pasa a `[]`. Con la carga de ocultos, el placeholder aparecería en el panel; su guía pasa a `DATA-POPULATION.md`. El conteo de `data-persistence-seed` sigue en 0 y su requisito no cambia. Si el owner ya cargó repos reales al implementar (ítem 0.3), se conservan y la tarea actualiza ese conteo con un MODIFIED en este change.

### D15. Ejemplo

Tres repos bajo la cuenta ficticia `portafolio-ejemplo-ficticio` (`https://github.com/portafolio-ejemplo-ficticio/<repo>`): `reservas-api` (Java, tags `java`, `microservices`), `metricas-dashboard` (TypeScript, tags `nodejs`, `react`, `microservices`) y `experimento-oculto` (Python, `visible: false`). Efecto buscado: `all` y `ejemplo-backend` muestran la sección (2 repos); `ejemplo-dirigido` (`cloud`, `devops`, `microservices`) resuelve 2; `ejemplo-renombrado` (`nodejs`, `react`) resuelve 1 y **no** muestra la sección (caso del umbral para TC-50); `ejemplo-overrides` suma `includeRefs: ["repository:experimento-oculto"]` para demostrar que no fuerza un oculto. `ejemplo-secciones` declara las diez secciones. Es la única excepción a «dominios RFC 2606» además de los `referrer`: el host tiene que ser `github.com` por D2.

### D16. Consistencia del CV

`to-cv-snapshot` suma los repos; la regla de traducciones emite `i18n.missing-translation` por `description` de cada repo visible con un idioma vacío y el otro con contenido, `entityType: 'repository'`. No hay regla de URL: la forma de D2 ya se garantiza al guardar y al sembrar.

### D17. Rótulos

`section.repositories.eyebrow` («Código» / «Code»), `section.repositories.title` («Repositorios destacados» / «Featured Repositories»), `repositories.language` («Lenguaje» / «Language»), `repositories.open` («Ver en GitHub» / «View on GitHub», parte del nombre accesible), `print.block.repositories` («Repositorios» / «Repositories») y `print.omitted.repositories.one/other` («y {n} más» / «and {n} more»).

## Risks / Trade-offs

- **Estimador optimista o pesimista (D9).** Optimista: `print:check` falla y se baja la capacidad. Pesimista: la línea se omite en perfiles donde entraba; es aceptable por la regla «solo si entra». Mitigación: test de frontera en Vitest y calibración documentada.
- **Chunk diferido (D8).** Un salto de layout si la sección está en pantalla al cargar; con el alto reservado y la sección después de proyectos, queda bajo el pliegue en móvil. `perf:check` (≥ 85) y `a11y:check` lo cubren.
- **Cuenta ficticia en GitHub (D15).** `portafolio-ejemplo-ficticio` podría existir o crearse. Los checks no navegan los enlaces; el riesgo es solo que alguien haga clic en el ejemplo. Se documenta en `DATA-POPULATION.md`.
- **Unicidad sin índice (D2).** Dos altas simultáneas del mismo repo podrían pasar. Con un solo administrador es despreciable.
- **Conflictos con changes en paralelo:** `openapi.json` y `api.d.ts` (todos los changes con rutas nuevas), `section-registry.ts`/`SECTION_IDS`, `messages.ts`, `print-sheet.ts`, `ProyectosPage.tsx`, la pestaña Selección del constructor y `selection-overrides.ts`, `MANUAL.md` e `index.html`, `CHANGELOG.md`, `seed-source.ts`/`seed-runner.ts`, `app.module.ts` y el `test/msw-admin.ts`. Regla: regenerar los artefactos del contrato después de rebasar, nunca resolverlos a mano.

## Migration Plan

1. Sin migración de base. El deploy no corre el seed (`preDeployCommand` sigue igual), así que producción queda con 0 repos y la sección oculta hasta que el owner los cargue desde el panel.
2. Rollback: revertir el change; la tabla queda con las filas cargadas, inerte como antes.

## Open Questions

Todas resueltas. El owner decidió P1 y P2 el 2026-11-12 y aprobó adoptar la recomendación en las no bloqueantes.

- **P1 [bloqueante, resuelta]. Hosts de la URL.** A) solo GitHub, B) https genérico, C) lista de hosts. **Decisión del owner: A** (D2).
- **P2 [bloqueante, resuelta]. Repos en el PDF.** A) fuera, B) siempre, C) solo si entran. **Decisión del owner: C**, una línea compacta con criterio determinístico (D9).
- **P3 [no bloqueante, resuelta con la recomendación]. Placeholder de `cv-data.json`.** A) reemplazarlo por `[]` y sembrar también los ocultos, B) seguir ignorando los ocultos. **A** (D14).
- **P4 [no bloqueante, resuelta con la recomendación]. Repos en el JSON Resume.** A) en `projects` con `type: "repository"`, B) no exportarlos. **A** (D10).
- **P5 [no bloqueante, resuelta con la recomendación]. Ubicación en el panel.** A) bloque dentro de Proyectos, B) página propia. **A** (D12).
- **P6 [no bloqueante, resuelta con la recomendación]. Stars manuales.** A) no exponerlas hasta la sincronización, B) editables a mano. **A** (D3).
