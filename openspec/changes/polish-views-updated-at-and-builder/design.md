# Design — polish-views-updated-at-and-builder

## Context

Ver `proposal.md`. Estado verificado el 2026-11-04 sobre `feat/profile-structured-data` (`a7a4317`, PR #47 abierto):

- **El incremento.** `PrismaProfileViewRepository.record` (`backend/src/modules/analytics/infrastructure/persistence/prisma-profile-view.repository.ts`) corre un `$transaction` en lote: `profileView.create(...)` y, solo si `kind === 'HUMAN'`, `curatedProfile.update({ where: { id }, data: { views: { increment: 1 } } })`. El `create` falla por la clave foránea si el perfil no existe, y eso deja la transacción en cero (test «todo o nada» de `background-views.e2e-spec.ts`).
- **El campo.** `CuratedProfile.updatedAt DateTime @updatedAt` en `backend/prisma/schema.prisma`, sin `@@map` (la tabla es `"CuratedProfile"`). Prisma lo rellena en el cliente en cada `update`, y su documentación dice lo mismo de `updateMany`.
- **Quién lee `updatedAt`.** `BuildSitemapUseCase` → `toSitemapEntries` → `<lastmod>` con granularidad de **día** (`toISOString().slice(0, 10)`), y el DTO de admin (`curated-profile.admin-output.ts`, `updatedAt: string | null`), que el frontend no muestra (solo aparece en `test/fixtures/admin.ts`). Nada ordena por `updatedAt`.
- **Otra escritura de `views`.** `applyReclassification` (`backend/scripts/lib/reclassify-views.ts`) escribe `views: change.expected` con `tx.curatedProfile.update` dentro de un `$transaction` interactivo. El seed crea perfiles con su `views` (un `create`, que no es el problema).
- **Datos existentes.** El sitio no está desplegado (P18 de `docs/PROPUESTA-FEATURES.md`). Las bases que existen son la local del owner, la del e2e y las descartables de ejemplo.
- **El preview.** `PreviewPanel.tsx` arma `{n} experiencias · {n} categorías · {n} proyectos` con plural fijo. En el mismo panel, `MissingTranslationsNotice` ya distingue «Falta 1 traducción» de «Faltan N traducciones», y `ShareLinksPanel` distingue «apertura» de «aperturas», cada uno con su ternario. La hoja imprimible (`print/print-sheet.ts`) usa claves `one`/`other` del diccionario público. No hay helper de plural en `frontend/src/shared/i18n/`. Todo el texto del panel está en español; las pestañas ES/EN del preview cambian el idioma del **contenido** resuelto, no el del panel.
- **Los timeouts.** `frontend/vite.config.ts` no fija `testTimeout` (5 s por defecto) ni `hookTimeout` (10 s). `src/test/setup.ts` precarga el chunk lazy del backoffice en un `beforeAll` para los tests de `features/backoffice/**` y deja `asyncUtilTimeout` en 1 s **a propósito** («un `findBy` que tarda más señala un problema real»). Aun así fallan en frío dos archivos del backoffice (`ProfileBuilderPage.test.tsx`, 893 líneas y 62 `findBy`/`waitFor`, y `ShareLinks.test.tsx`) y dos de la vista pública, que no tienen precarga. Los `verification.md` de `unify-section-catalog` y `add-share-links` atribuyen los fallos al `findBy` de 1 s bajo carga; ninguno registró si también hubo `Test timed out in 5000ms`.

## Goals / Non-Goals

**Goals:** que `updatedAt` y el `<lastmod>` del sitemap cambien solo cuando cambia el perfil; que el incremento siga siendo atómico con el `ProfileView`; que los contadores del preview concuerden en número; que `npm test` pase en frío sin repetir.

**Non-Goals:** ver `proposal.md` § Non-goals.

## Decisions

### D1 — El incremento va por `$executeRaw` dentro de la misma transacción en lote

`record` reemplaza el `update` por:

```ts
this.prisma.$executeRaw`UPDATE "CuratedProfile" SET "views" = "views" + 1 WHERE "id" = ${view.curatedProfileId}`
```

como segundo elemento del mismo `$transaction([...])`. Es el `UPDATE … SET views = views + 1` que Prisma ya emitía, sin la columna `updatedAt`: el incremento lo hace la base (no hay lectura previa ni carrera entre visitas concurrentes) y las dos escrituras se confirman o se descartan juntas. El valor viaja como parámetro del template de Prisma, nunca concatenado. El comentario «Único SQL crudo del proyecto» de `aggregate` se corrige (ya no es el único) y el nuevo lleva el motivo: «sin `@updatedAt`: una visita no es una edición».

Un `UPDATE` crudo que no encuentra la fila no falla (devuelve 0). No cambia el todo o nada: el `create` del `ProfileView` va primero y falla por la clave foránea si el perfil no existe. El test «todo o nada» vigente lo cubre.

Alternativas descartadas:
- **`updateMany`.** No ahorra nada: Prisma también rellena `@updatedAt` en `updateMany`. La tarea 1.2 lo comprueba con el e2e en rojo.
- **Pasar `updatedAt` explícito igual al actual.** Exige leer antes de escribir, lo que saca la operación del lote y la lleva a una transacción interactiva. Entre la lectura y la escritura, una edición del panel puede cambiar `updatedAt`, y la visita lo pisaría con el valor viejo: borraría la fecha de una edición real.
- **Mover el contador a otra tabla** (`CuratedProfileStats`). Es lo más limpio a largo plazo, pero pide migración, cambia el mapper de lectura y el `views:reclassify`. Es demasiado para un correctivo.

### D2 — `views:reclassify` escribe `views` con el mismo criterio

`applyReclassification` cambia `tx.curatedProfile.update({ data: { views: change.expected } })` por un `tx.$executeRaw` con `UPDATE "CuratedProfile" SET "views" = ${change.expected} WHERE "id" = ${change.id}`, dentro de su transacción interactiva, que no cambia (lotes, `timeout` y `maxWait`). Sin esto, la primera reclasificación en producción pondría el `<lastmod>` de todos los perfiles corregidos en el día de la corrida.

Alternativa descartada: **dejarlo como está porque es un script ocasional.** Es justo el que se corre sobre la base de producción, con `--apply`, y movería las fechas de varios perfiles de una vez.

### D3 — Sin corrección de datos para los `updatedAt` ya inflados

No hay ninguna columna ni tabla que guarde la fecha de la última edición: el único rastro era `updatedAt`, y las visitas lo pisaron. El sitio no está desplegado, así que no hay buscadores con un `<lastmod>` falso. En las bases locales y descartables el valor queda con la fecha de la última visita y se corrige solo con la próxima edición del perfil.

Alternativas descartadas:
- **`updatedAt = createdAt` para todos.** Afirma «nunca se editó», que es tan falso como lo que reemplaza, y obliga a un script de datos con su propia negativa en producción.
- **`updatedAt = max(viewedAt)` o parecidos.** Es exactamente el dato que el change quiere dejar de publicar.

### D4 — Un e2e que fija la fecha antes de visitar

`<lastmod>` tiene granularidad de día y el seed del e2e se carga el mismo día que corren los tests. Una visita de hoy sobre un perfil editado hoy no mostraría ninguna diferencia. Por eso el e2e nuevo (`backend/test/views-updated-at.e2e-spec.ts`), sobre `tech-lead-dotnet` (público y enumerado):

1. guarda el `updatedAt` original y lo fija en `2026-01-15T12:00:00.000Z` con Prisma (escritura de preparación del test);
2. hace `GET /api/curated-profiles/tech-lead-dotnet` con `BROWSER_UA` (visita `HUMAN`) y `settleBackgroundTasks(app)`;
3. comprueba que `views` sumó 1, que `updatedAt` sigue **exactamente** en `2026-01-15T12:00:00.000Z` y que `GET /sitemap.xml` tiene `<loc>{FRONTEND_URL}/tech-lead-dotnet</loc>` seguido de `<lastmod>2026-01-15</lastmod>`;
4. **control:** un `PATCH /api/admin/curated-profiles/:id` (por ejemplo, el mismo `techFocus`) mueve `updatedAt` a la fecha de hoy y el `<lastmod>` del sitemap cambia. Sin este control, un sitemap que dejara de emitir `<lastmod>` haría pasar el test;
5. el mismo esquema con `applyReclassification` sobre un plan con un `profileChanges`: `views` queda en el esperado y `updatedAt` no cambia;
6. en el `afterAll` restituye `updatedAt`, `views` y las visitas que creó (con un `User-Agent` marcado, como `background-views.e2e-spec.ts`).

Antes de tocar el código, los pasos 3 y 5 tienen que fallar (tarea 1.2).

### D5 — Helper `formatCount` con `Intl.PluralRules`

`frontend/src/shared/i18n/plural.ts`:

```ts
export function formatCount(count: number, forms: { one: string; other: string }, locale: Locale = 'es'): string
```

Devuelve `${count} ${forms.one}` cuando `new Intl.PluralRules(locale).select(count) === 'one'` y `${count} ${forms.other}` en el resto de los casos. En español y en inglés solo el 1 es `one`, así que 0 va en plural («0 proyectos», «0 projects»), igual que en la hoja imprimible. Es una función pura, sin React, y sirve para cualquier idioma del tipo `Locale`. Las formas las pone quien llama, porque el panel no usa el diccionario público.

`PreviewPanel` la usa en los tres contadores: «experiencia/experiencias», «categoría/categorías», «proyecto/proyectos». `MissingTranslationsNotice` y `ShareLinksPanel` ya concuerdan en número y no se tocan (P2).

Alternativas descartadas:
- **Un ternario por contador**, como `ShareLinksPanel`. Funciona, pero hace tres copias del mismo patrón en una línea y no deja nada reutilizable para P2.
- **Claves `one`/`other` en `messages.ts`.** El diccionario es del sitio público y viaja en el arranque, que tiene el tope de 155 KB de `perf:budget`. El panel no lo usa para nada más.

### D6 — Los contadores del panel quedan en español con el preview en EN

Las pestañas ES/EN del preview cambian el idioma del contenido resuelto. El resto del panel (encabezado «Vista previa», «actualizando», pestañas, avisos) está en español, y el contador es parte del panel, no del contenido. Con el preview en EN, el contador sigue diciendo «1 proyecto». El helper acepta el `locale` para que el día que el panel tenga inglés alcance con pasarlo.

Alternativa descartada: **que el contador siga la pestaña del preview.** Dejaría una línea en inglés dentro de un encabezado en español.

### D7 — Timeouts en frío: primero medir, después lo mínimo, sin tocar `setup.ts`

**Causa probable.** En la primera corrida tras un `build`, el disco y la caché del sistema están fríos y cada worker de Vitest transforma desde cero el grafo de módulos de su primer archivo: React, Radix, Framer Motion (`motion`), TanStack Query, MSW y, en las pantallas del panel, el chunk de `BackofficeApp`. Ese costo cae dentro del primer test de cada archivo. Bajo la carga de varios workers en paralelo puede romper dos límites distintos: el `findBy` de 1 s (si cae entre el primer render y el contenido, por ejemplo en un `import()` diferido como los menús de `features/navigation/lazy-menus.ts`) o los 5 s de `testTimeout`, en los tests largos con `userEvent` del constructor. La precarga de `setup.ts` mueve el chunk del panel fuera del test, pero no el resto del grafo ni los archivos de la vista pública.

**Paso 1, medir (tarea 6.1).** Tres corridas en frío sobre el estado actual, guardando cada fallo con su mensaje: `Test timed out in 5000ms` (Vitest) o `Unable to find … within 1000ms` / `Timed out in waitFor` (Testing Library), con el archivo y el test.

**Paso 2, lo mínimo según lo medido:**
- **Siempre:** `test.testTimeout: 15_000` y `test.hookTimeout: 30_000` en `frontend/vite.config.ts`, con un comentario que remita a este change. Cubren los tests largos y el `beforeAll` de precarga bajo carga. No esconden un `findBy` lento: ese sigue fallando a 1 s.
- **Solo si el paso 1 muestra fallos de `findBy` en el primer test de un archivo:** un helper nuevo `frontend/src/test/warm-up.ts` con `warmPublicView()` (que importa con `import()` `@/features/curated-view/CuratedProfileView`, `@/themes/layouts/ProfileLayout` y `@/features/navigation/lazy-menus`) y, si hiciera falta, `warmBuilder()`. Cada archivo afectado lo llama en su propio `beforeAll`, que corre con el `hookTimeout` de 30 s. Así el costo de importar queda fuera de la ventana del `findBy`.

**Criterio de aceptación:** tres corridas completas de `npm test`, cada una precedida por `npm run build` y en un proceso nuevo, sin fallos. Además, un `findBy` deliberadamente imposible sigue fallando a 1 s (prueba temporal, no se commitea), para confirmar que el `asyncUtilTimeout` no cambió.

Alternativas descartadas:
- **Subir `asyncUtilTimeout`.** Contradice la decisión registrada en `setup.ts` y esconde las esperas lentas de verdad. Además, se configura en `setup.ts`.
- **Un segundo `setupFiles` global que precaliente todo.** Es editar la política de `setup.ts` por otra puerta y les cobra el precalentamiento a los ~60 archivos, la mayoría puros.
- **`retry` en Vitest.** Convierte un rojo en un verde que nadie mira.
- **Bajar `maxWorkers` o correr en un solo hilo.** Alarga toda la suite para tapar el costo del primer test de unos pocos archivos.
- **`vi.hoisted`.** Sube código síncrono por encima de los `import`; un `import()` asíncrono ahí queda sin esperar o pide un `await` de nivel superior, menos claro que un `beforeAll` y sin el `hookTimeout`.

### D8 — Sin caso nuevo del manual y sin delta para los timeouts

Ningún flujo del manual cambia. La fecha del sitemap no se ve desde el panel, el contador ya figura en TC-12 (alcanza con corregir el epígrafe y la captura) y los timeouts son de las pruebas. **No se agrega TC-46.** La verificación queda en el e2e de D4, en los tests de Vitest de D5 y en las tres corridas de D7.

Los timeouts no tienen capacidad en `openspec/specs/` donde encajen: son configuración de pruebas, no comportamiento del producto. Su criterio vive en `tasks.md` y `verification.md`.

### D9 — Deltas solo `ADDED`

Los tres requisitos son nuevos, con nombres que no existen en `openspec/specs/`. Agregar una línea a *Registro de visita en cada resolución pública exitosa*, *robots.txt y sitemap.xml* o *Preview en vivo del resultado* con `MODIFIED` obligaría a copiarlos enteros con todos sus escenarios y a mantenerlos alineados con cambios en paralelo (#47 ya modifica otros requisitos de `public-seo`). Un `ADDED` dice lo mismo y no choca al archivar.

## Risks / Trade-offs

- **SQL crudo con nombres de tabla y columna escritos a mano.** Si un día `CuratedProfile` lleva `@@map` o se renombra `views`, el `$executeRaw` falla en tiempo de ejecución, no al compilar. Mitigación: el e2e de D4 y los e2e vigentes de visitas fallan de inmediato. Un comentario junto al SQL lo advierte.
- **`$executeRaw` dentro de `$transaction([...])`.** Prisma 6 lo admite en el lote. Si una versión futura lo cambiara, el «todo o nada» de `background-views.e2e-spec.ts` lo detecta.
- **Fechas que siguen infladas en las bases locales** (D3). Se corrigen con la próxima edición. No afectan a producción, que no existe todavía.
- **Timeouts de 15 s y 30 s.** Un test colgado tarda más en fallar. Es aceptable: el límite que importa para las esperas de la UI sigue siendo el `findBy` de 1 s.
- **Rama apilada.** Si #47 cambia antes de fusionarse, hay que rebasar. Este change no toca los archivos de #47 (JSON-LD, fragmento del head).

## Migration Plan

Sin migración de schema ni de datos. Despliegue normal: el `preDeployCommand` no tiene nada nuevo que aplicar. Rollback: revertir el commit; los `updatedAt` vuelven a moverse con las visitas, sin pérdida de datos.

## Open Questions

- **P1 [no bloqueante] — `dateModified` en el JSON-LD y `updatedAt` en el DTO público.** Con D1 y D2, `updatedAt` ya es confiable, y P1 de `upgrade-profile-structured-data` dejaba `dateModified` para el change que lo corrigiera.
  - A) Change aparte, chico, cuando este y #47 estén en `main`: `updatedAt` en `CuratedProfileOutput`, OpenAPI y `api.d.ts`, `dateModified` en el fragmento y en el cliente, con su escenario en `public-seo`.
  - B) Sumarlo acá: el change deja de ser solo correctivo, toca el contrato y queda atado a cómo termine #47.
  - **Recomendación: A.** Este change no cambia el contrato y se puede revisar solo. Nota: `upgrade-profile-structured-data` nombra el arreglo como `fix-curated-profile-updated-at`. Al archivarlo conviene aclarar que lo hizo `polish-views-updated-at-and-builder`.
- **P2 [no bloqueante] — ¿La misma convención para los contadores del resto del panel?** Tienen el mismo defecto: el badge «{n} visitas» del constructor (`ProfileBuilderPage.tsx`), «{n} visitas» de la lista y del diálogo de borrar (`ProfilesPage.tsx`), «{n} skills» y su diálogo (`SkillsPage.tsx`) y el `aria-label` «{día}: {n} visitas» del dashboard.
  - A) Sí, en este change, con `formatCount` (unas seis líneas más y sus tests).
  - B) No; un change aparte cuando se toquen esas pantallas.
  - **Recomendación: A.** Es el mismo arreglo con el mismo helper, y queda como grupo 4 opcional de `tasks.md`: si el owner elige B, el grupo se borra antes de implementar.
