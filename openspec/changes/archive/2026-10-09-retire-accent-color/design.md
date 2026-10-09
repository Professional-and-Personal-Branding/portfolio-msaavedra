# Design — retire-accent-color

## Context

**Etapa 1, ya hecha** (D9 de `polish-builder-and-edge`, decisión del owner del 8 de octubre de 2026). El constructor no envía `accentColor` en el alta, el `PATCH` ni el preview. El OpenAPI lo marca `deprecated` con la descripción de `ACCENT_COLOR_DEPRECATED` y `src/swagger.spec.ts` lo comprueba. La API lo sigue aceptando, validando como `#RRGGBB`, copiando al duplicar y devolviendo.

**Respuestas del owner** (9 de octubre de 2026):
- **P1 = B:** los colores se preservan y pasan a `themeOverrides.colors.accent`.
- **P2:** el primer paso, la migración de su base de desarrollo, lo ejecuta el agente, con trazabilidad y documentación.

**Inventario** (`grep -rn "accentColor\|accent_color"`, sin `node_modules`, `dist` ni `archive`). Fuera de los archivos generados no aparece `accent_color`.

| Lugar | Referencias |
|---|---|
| Persistencia | `prisma/schema.prisma:214`; `migrations/20260906055928_init/migration.sql:178` (histórica, no se toca) |
| Dominio | `curated-profile.entity.ts` (props y getter), `validate-curated-profile.ts` (regla hex y `HEX_COLOR_REGEX`), `curated-profile.entity.spec.ts` |
| Aplicación | `curated-profile.output.ts` (`CuratedProfileSummaryOutput`, que hereda `CuratedProfileOutput`), `curated-profile.admin-output.ts`, `curated-profile.mapper.ts`, `curated-profile.admin-mapper.ts`, `curated-profile-lifecycle.use-cases.ts:58` (duplicado); specs: `curated-profile.use-cases.spec.ts` (fixture y lista de claves), `curated-profile-admin.use-cases.spec.ts`, `curated-profile-lifecycle.use-cases.spec.ts`, `profile-head.renderer.spec.ts` (solo fixture) |
| Infraestructura | `dto/curated-profile.dto.ts` (campo, `@Matches`, import de la constante, `toCreate…`, `toDraft…`, `toCuratedProfileChanges`), `docs/curated-profile.response.ts`, `docs/admin-curated-profile.response.ts`, `docs/accent-color-deprecated.ts`, `persistence/curated-profile.prisma-mapper.ts` y su spec, `src/swagger.spec.ts` |
| e2e | `test/curated-profile.e2e-spec.ts:95,190` (listas de claves), `test/backoffice.e2e-spec.ts:31,67` (`AdminProfile` y `draftOf`) |
| Seed | `scripts/seed.ts:94,477,502`; `docs/cv-data.json` (13 plantillas, 10 colores distintos); `docs/cv-data.es-only.backup.json` (respaldo que ningún script lee) |
| Contrato generado | `backend/openapi.json` (7 schemas, con `required`), `frontend/src/shared/types/api.d.ts` (7 tipos) |
| Frontend | `shared/admin-types.ts` (`*Wire`, `Omit`), `shared/use-admin-api.ts` (casts), `curated-profiles/use-preview.ts` (`PreviewCuratedProfileWire`, cast), `portada/PortadaPage.tsx:217` (`heroData`), `test/fixtures/admin.ts:96`, `test/fixtures/curated-profile.ts:31,161`, `profile-draft.spec.ts:65-69`, `ProfileBuilderPage.test.tsx:845-889` |
| Docs | `MANUAL.md:252,269`, `manual/index.html:542`, `manual/suite-backoffice.ps1:48`, `ARCHITECTURE.md:201`, `I18N.md:34`, `DATA-POPULATION.md:128`, `ROADMAP-1.1.md:104,161`, `CLAUDE.md` (ronda 1.1) |
| Specs vigentes | `admin-curated-profile-crud` (3 requisitos), `admin-curated-profile-preview` (1), `curated-profile-builder` (1), `curated-profile-resolution` (1), `public-curated-profile-api` (1), `theme-resolution` (1) |

**No se tocan** los presets (`colors.accent` y `accent2`), el `brand` de Tailwind ni el `accent` de shadcn/ui.

**Resolución del tema.** `CuratedProfileComposer` combina `theme.tokens` con `themeOverrides` usando `mergeThemeTokens`, un merge profundo. Si el perfil no tiene `themeId`, `theme` es `null` y los overrides no se aplican. Todas las plantillas del seed usan `modern-dark`, cuyo `colors.accent` es `#38bdf8` y su fondo `#0a0e1a`. El customizador guarda solo las diferencias contra el tema base.

**Validación de entrada.** `adminValidationPipe` aplica `whitelist` y `forbidNonWhitelisted` en los controllers del backoffice, preview incluido.

**Entornos.** No hay producción. Las migraciones corren en el `preDeployCommand` (`backend/railway.json`). La base de desarrollo del owner es `portfolio`, en `localhost:5434` (contenedor `portfolio-postgres`), y los e2e corren contra ella. `prisma` es `~6.19`.

## Goals / Non-Goals

**Goals:**
- Que `accentColor` no exista en ninguna capa.
- Que el color de cada perfil sobreviva como token, sin pisar una personalización existente.
- Que producción nazca sin la columna.
- Que la migración de la base del owner quede respaldada, ensayada, con evidencia de antes y después y un rollback probado.

**Non-Goals:** ver `proposal.md`. En particular, no se corrigen colores por contraste.

## Decisions

### D1 — Retiro completo en un solo change, sin tercera etapa

Sale de la entrada, la salida, el dominio, la persistencia, el seed y los tipos a la vez. Así ninguna capa queda con un campo que otra ya no conoce.

*Alternativa descartada:* dejar la columna para más adelante. Habría una columna con default que nadie escribe ni lee, y una tercera migración en algún momento.

### D2 — Un cuerpo con `accentColor` responde 400, como cualquier campo desconocido

El campo sale de `CreateCuratedProfileDto`, y por eso también de `Update` y `Preview`, que heredan por `PartialType`. Con `forbidNonWhitelisted`, `POST`, `PATCH` y preview responden 400 y el mensaje nombra la propiedad.

*Por qué:* el único cliente es el frontend, que dejó de enviarlo en la etapa 1. No hay producción ni bundles viejos en navegadores ajenos. La convención del repo es que un campo desconocido nunca se ignora.

*Alternativa descartada:* tolerarlo en silencio con `@Allow()`, o abrir una ventana de gracia. Solo serviría a clientes que no existen.

### D3 — El color de cada perfil pasa a `themeOverrides.colors.accent`; lo personalizado gana (P1 = B)

La migración copia el `accentColor` de **todas** las filas a `themeOverrides.colors.accent`, salvo en las que ese token ya existe con un valor que no es `null`. Esas se dejan como están, porque es lo que se eligió en el customizador.

*Por qué todas, incluidos `#1A365D` y `all`:* el owner pidió preservar los colores, y desde la base no se puede saber si un `#1A365D` fue una elección o el default. En `cv-data.json`, `java-senior-backend` lo trae explícito; los perfiles creados desde el panel lo recibieron por default. Excluir el default perdería una elección real. En `all`, el color (`#38bdf8`) es igual al acento de `modern-dark`, así que copiarlo no cambia nada visible y mantiene la regla sin excepciones. Lo mismo vale para un perfil de panel con `#1A365D` y el riesgo de contraste: queda registrado (Risks) y se corrige desde el customizador, perfil por perfil.

*Efectos colaterales aceptados:*
- **El customizador muestra el acento migrado como una diferencia respecto del preset**, y *Restablecer* lo devuelve a `#38bdf8`. Es la forma natural de editarlo.
- **Un perfil sin `themeId` guarda el override pero no lo ve.** Con tema `null`, los overrides no se aplican: lo mismo que hoy, cuando tampoco veía el color.
- **El duplicado ya hereda el color**, porque copia `themeOverrides`.

*Alternativas descartadas:*
- Migrar solo los colores distintos de `#1A365D`. Pierde elecciones explícitas, como la de `java-senior-backend`.
- Pisar `colors.accent` existentes. Destruye una personalización hecha a mano.
- Descartar los colores, que era el default anterior de este design. El owner lo rechazó.

### D4 — Migración única, escrita a mano: primero el `UPDATE` idempotente y después el `DROP`; `init` no se toca

`backend/prisma/migrations/<YYYYMMDDHHMMSS>_retire_accent_color/migration.sql`:

```sql
-- retire-accent-color (D3, D4): el acento de cada perfil pasa al tema antes de borrar la columna.
-- Un colors.accent ya presente en themeOverrides gana: no se pisa.
UPDATE "CuratedProfile"
SET "themeOverrides" = jsonb_set(
      CASE WHEN jsonb_typeof("themeOverrides") = 'object' THEN "themeOverrides" ELSE '{}'::jsonb END,
      '{colors}',
      CASE WHEN jsonb_typeof("themeOverrides" -> 'colors') = 'object'
           THEN "themeOverrides" -> 'colors' ELSE '{}'::jsonb END
        || jsonb_build_object('accent', "accentColor"),
      true)
WHERE COALESCE(jsonb_typeof("themeOverrides" #> '{colors,accent}'), 'null') = 'null';

ALTER TABLE "CuratedProfile" DROP COLUMN "accentColor";
```

Cómo se comporta en cada caso:
- `themeOverrides` en `NULL` de SQL o `null` de JSON queda `{"colors":{"accent":…}}`.
- Un objeto sin `colors` conserva sus otras claves y gana `colors`.
- Un `colors` sin `accent` conserva sus otros tokens.
- Un `colors.accent` existente no entra en el `WHERE`.

El `UPDATE` es idempotente: una segunda pasada no encuentra filas. Si la migración falla entre las dos sentencias, Prisma la marca fallida, y se recupera con `prisma migrate resolve --rolled-back <nombre>` y un nuevo `deploy`, sin doble escritura. Un `themeOverrides` que no sea objeto (por ejemplo un array) o un `colors` que no sea objeto se reemplazarían por `{}`. Son formas inválidas que el customizador no produce; la tarea 1.2 las busca y, si aparece alguna, se frena y se consulta.

Se aplica **solo** con `prisma migrate deploy`; en Railway, desde el `preDeployCommand`. Nunca con `migrate dev`, porque con deriva ofrece resetear la base, ni con `db push`. En producción, que nace vacía, el `UPDATE` afecta 0 filas.

*Alternativas descartadas:*
- Dos migraciones, una de datos y otra de `DROP`. No agrega seguridad, porque las dos corren en el mismo `deploy`.
- Editar `init`. Rompe el checksum de una migración ya aplicada.
- Una migración de datos en TypeScript. Saca la lógica del flujo de `migrate deploy`.

### D5 — El agente migra la base del owner en el grupo 1, con respaldo, ensayo en una copia y evidencia (P2)

El grupo 1 se ejecuta en este orden:

1. **Respaldo.** `pg_dump -Fc` de `portfolio` a un archivo con timestamp **fuera del repo**, en el scratchpad de la sesión o en una carpeta del owner. En `verification.md` se registran la ruta, el tamaño y el SHA-256.
2. **Evidencia previa.** Un `SELECT` de solo lectura de `id`, `slug`, `accentColor`, `themeId`, `jsonb_typeof(themeOverrides)` y `themeOverrides->'colors'->'accent'`.
3. **Schema y migración** (D4), y el seed (D11).
4. **Ensayo en la copia descartable `portfolio_retire_accent`,** restaurada del dump en el mismo servidor:
   - filas sintéticas con los cinco casos de D4;
   - `migrate deploy` y comprobación de los resultados;
   - **ensayo del rollback** (restaurar el dump y comprobar que vuelve al estado previo);
   - seed y `seed:verify`. El seed se corre solo en la copia.
5. **Aplicación en `portfolio`** con `prisma migrate deploy`, guardando la salida.
6. **Evidencia posterior.** Un `SELECT` que compara fila por fila y comprueba que la columna ya no existe.

La copia se usa solo para el ensayo y se borra al cerrar el change.

**Efecto aceptado:** desde el paso 5, el backend de `main` deja de funcionar contra `portfolio` hasta que se fusione el PR. Prisma selecciona `accentColor` explícitamente y la columna ya no existe. Para volver a `main` antes del merge, se usa el rollback: restaurar el dump. Queda anotado en `verification.md`. El resto del change (unitarios, e2e, app real) corre contra `portfolio` ya migrada, como en los changes anteriores. **Prohibido correr el seed sobre `portfolio`.**

**Rollback documentado:**
1. Parar el backend.
2. `pg_restore --clean --if-exists --no-owner -d portfolio <dump>`. Restaura también `_prisma_migrations`, así que `prisma migrate status` vuelve a mostrar dos migraciones.
3. Volver al código de `main`.

*Alternativas descartadas:*
- Migrar la base del owner al final, después del merge. Era el default anterior; el owner pidió hacerlo primero.
- Trabajar todo el change sobre la copia. Duplica bases sin necesidad, una vez que la del owner está migrada y respaldada.

### D6 — Se borra la regla hex del dominio junto con `HEX_COLOR_REGEX`

`validateCuratedProfile` deja de validar el color. `HEX_COLOR_REGEX` no tiene otro uso, así que se borra. No se agrega validación de los colores de `themeOverrides`: sería otra regla, para todos los tokens.

### D7 — Frontend: sin `*Wire` ni casts; los tests de D9 se borran

Los cuerpos pasan a ser directamente los schemas generados. Desaparecen `CreateCuratedProfileWire`, `UpdateCuratedProfileWire` y `PreviewCuratedProfileWire`, con sus casts y comentarios. También salen la clave de `heroData` y la de los fixtures, `it('no incluye accentColor (D9)')` y el `describe('ProfileBuilderPage — sin accentColor (D9)')`. Con el tipo generado sin la clave, el compilador impide enviarla, y el backend la rechaza (D2).

*Alternativa descartada:* conservar esos tests. Habría que construir el cuerpo con `as unknown`, y dejarían de probar algo.

### D8 — Se borra la constante; el test de swagger pasa a comprobar la ausencia

Se borra `accent-color-deprecated.ts`. `src/swagger.spec.ts` se reescribe para recorrer todos los `components.schemas` y comprobar que ninguno tiene `accentColor`. Se regeneran `openapi.json` y `api.d.ts`.

### D9 — Specs: dos `REMOVED`, tres `ADDED` y seis `MODIFIED`

- **`REMOVED`:**
  - *`accentColor` obsoleto en el contrato* (`admin-curated-profile-crud`).
  - *El constructor no envía `accentColor`* (`curated-profile-builder`).
- **`ADDED`:**
  - *`accentColor` retirado del contrato* (`admin-curated-profile-crud`).
  - *Migración del acento de los perfiles al tema* (`data-persistence-seed`).
  - *Acento de las plantillas en el tema* (`data-persistence-seed`).
- **`MODIFIED`:**
  - `admin-curated-profile-crud`: *Campos opcionales de la creación y sus valores por defecto* y *Duplicar un perfil curado*. El duplicado suma un escenario: hereda el acento migrado.
  - `admin-curated-profile-preview`: *Resolución de un borrador sin persistir*.
  - `curated-profile-resolution`: *Resultado listo para presentación*.
  - `public-curated-profile-api`: *Listado de perfiles curados públicos*.
  - `theme-resolution`: *Forma del tema resuelto*. El acento sale de los tokens, que ahora incluyen el override migrado. Suma los escenarios del perfil migrado y del override que gana.

### D10 — Lo histórico se conserva; lo vigente se actualiza

No se tocan `init`, los changes archivados ni `docs/cv-data.es-only.backup.json`. TC-12 del manual pierde `accentColor=#1A365D` en la línea observada, con una nota, y se vuelve a correr ese bloque de la suite. La sección del customizador del manual explica que los perfiles existentes arrancan con su acento como override.

### D11 — `cv-data.json` guarda el color con la forma del modelo: `themeOverrides`

En cada plantilla, `"accentColor": "#…"` se reemplaza por `"themeOverrides": { "colors": { "accent": "#…" } }`. `seed.ts` declara `themeOverrides?: Record<string, unknown>` en el tipo de la plantilla y lo pasa tal cual al `create`; si falta, usa `NULL`. El perfil `all` se crea con `themeOverrides: { colors: { accent: '#38bdf8' } }`. `verify-seed.ts` comprueba, para cada plantilla, que `themeOverrides.colors.accent` coincide con `cv-data.json`.

*Por qué renombrar en lugar de mapear:* `cv-data.json` es la fuente del seed y debe hablar el idioma del modelo. Si el seed mapeara `accentColor` a `themeOverrides`, el nombre retirado seguiría vivo en los datos, y el próximo que agregue una plantilla (`DATA-POPULATION.md`) lo copiaría. Además, la forma de `themeOverrides` deja agregar otros tokens por plantilla sin tocar el seed. Con esto, una base recién sembrada queda igual que una migrada, y la tarea 1.6 lo comprueba.

*Alternativa descartada:* conservar `accentColor` en `cv-data.json` y mapearlo en `seed.ts`.

## Risks / Trade-offs

- **[Contraste, riesgo aceptado por el owner]** → Ningún color migrado llega a 4,5:1 contra el fondo `#0a0e1a` de `modern-dark`, y 8 de 13 no llegan a 3:1. El owner lo eligió sabiendo esto. No se cambian colores. La tarea 6.4 lista el contraste de cada perfil migrado en `verification.md`, y la corrección, si se quiere, se hace desde el customizador. Los valores, calculados con la fórmula WCAG 2.x contra `#0a0e1a`:

  | Perfil | Color | Contraste |
  |---|---|---|
  | `software-architect` | `#1E293B` | 1,32 |
  | `java-senior-backend` | `#1A365D` | 1,59 |
  | `it-leadership` | `#1B3A6B` | 1,71 |
  | `tech-lead-dotnet` | `#5B2C87` | 1,98 |
  | `integration-architect` | `#0E5263` | 2,21 |
  | `backend-payments-ror` | `#9B1C2E` | 2,38 |
  | `fullstack-nest-react` | `#065F46` | 2,51 |
  | `ai-software-engineer` | `#6D28D9` | 2,71 |
  | `devops-platform`, `generalist-polyglot` | `#0F766E` | 3,52 |
  | `dotnet-backend`, `fullstack-microsoft`, `devops-azure` | `#0078D4` | 4,25 |
  | `all` (igual que el preset) | `#38bdf8` | 8,99 |

- **[Cambio visible del sitio]** → 13 perfiles dejan de verse con `#38bdf8`. Es lo que se busca con P1 = B. La app real (6.3) lo captura.
- **[`main` no funciona contra la base del owner hasta el merge]** → Es un efecto aceptado (D5). El rollback está documentado y ensayado. Conviene que el PR se fusione pronto.
- **[Migración destructiva]** → Dump previo con checksum, ensayo y rollback en la copia, y evidencia de antes y después. Producción no existe. Si producción ya tuviera datos cuando esto se despliegue, aplica lo de `DEPLOY.md`: respaldo antes del deploy, y como rollback restaurar y volver a la imagen anterior.
- **[Formas inválidas de `themeOverrides`]** → Un array o un `colors` escalar se reemplazarían por `{}`. La tarea 1.2 las busca antes de migrar y frena si aparece alguna.
- **[Equivocarse de base]** → Cada comando de Prisma va precedido de `prisma migrate status`, que muestra el destino. Los comandos del ensayo usan `DATABASE_URL` de la copia por variable de entorno. El seed nunca se corre con la URL de `portfolio`.
- **[`prisma generate` en Windows]** → Hay que parar el backend antes, porque el motor puede estar bloqueado.

## Migration Plan

1. Grupo 1 (D5): dump, evidencia previa, migración y seed, ensayo y rollback en la copia, aplicación en `portfolio` y evidencia posterior.
2. Grupos 2 a 5: código, contrato, frontend y docs, contra `portfolio` ya migrada.
3. Grupo 6: verificación completa y medición del contraste. Se borra la copia; el dump se conserva hasta el deploy 1.0.0.
4. Merge. Desde ahí, `main` vuelve a funcionar contra `portfolio`.
5. Producción: el primer `preDeployCommand` aplica `init`, `curated_profile_lifecycle` y `retire_accent_color` sobre una base vacía (el `UPDATE` afecta 0 filas). Después se corre el seed, que ya trae los acentos en `themeOverrides`.

## Open Questions

Ninguna. P1 y P2 fueron respondidas por el owner el 9 de octubre de 2026 (D3, D5).
