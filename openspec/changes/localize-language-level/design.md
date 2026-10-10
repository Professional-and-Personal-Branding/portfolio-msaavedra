# Design — localize-language-level

## Context

Ver `proposal.md`. Estado verificado el 10 de octubre de 2026 en `main` (`a95da64`):

- **Modelo.** `model Language { id; profileId; name String; nameI18n Json?; level String; detail Json? }`. La migración `init` creó `"level" TEXT NOT NULL`. Es el único texto mostrable del perfil base que no es `Json`.
- **Dominio.** `LanguageProps.level: string`; `validateLanguage` rechaza `level` en blanco (`validate-profile.ts:50`).
- **Aplicación.** `toLanguageOutput` resuelve `nameI18n` (con fallback a `name`) y `detail`, y copia `level`. `toAdminLanguageOutput` copia `level` crudo. `LanguageOutput.level` y `AdminLanguageOutput.level` son `string`.
- **HTTP.** `CreateLanguageDto.level` es `@IsString() @IsNotEmpty()` (ejemplo `'B2'`); `UpdateLanguageDto` es su `PartialType`. `LocalizedTextDto` (`shared/infrastructure/http/dto/localized.dto.ts`) ya existe, con `es` obligatorio y `en` opcional.
- **Composición.** El perfil curado público y los dos previews (`POST /api/admin/profile/preview` y `POST /api/admin/curated-profiles/preview`) pasan por `toProfileOutput`: arreglar el mapper arregla las cuatro salidas.
- **Faltantes.** `detectMissingTranslations` documenta *"No cubre idiomas hablados del perfil"*. El preview no trae el `id` de cada idioma (`LanguageResponse` es `{ name, level, detail }`).
- **Panel.** `language-form.ts` define `level: string` y `toLanguageBody` lo recorta. `PortadaPage.tsx` lo edita con `TextField` y lo muestra en el listado (`· {language.level}`). `nameI18n` y `detail` ya usan `LocalizedField` + `editableText`.
- **Consumidores públicos.** `Contact.tsx` y `print-sheet.ts` arman `` `${l.name} · ${l.level}` ``: no cambian, porque reciben texto resuelto.
- **Fuente.** `docs/cv-data.json` → `"Nativo"` y `"B1-B2"`. `verify-seed.ts` solo cuenta filas de `Language`.
- **Precedente.** `retire-accent-color` (archivado el 2026-10-09) fijó cómo se hace una migración de datos: SQL a mano, `prisma migrate deploy`, ensayo en una copia descartable, respaldo previo y rollback documentado.

## Goals / Non-Goals

**Goals:** que el nivel salga en el idioma pedido en toda salida pública; que el owner lo pueda escribir en ES y EN desde el panel; que los datos existentes se conviertan sin perder nada; que una base sembrada y una migrada queden iguales; que el informe de faltantes avise cuando el inglés no está.

**Non-Goals:** ver `proposal.md` § Non-goals.

## Decisions

### D1 — `level` es `Json` en la misma fila, como `detail`

`Language.level` pasa a `Json` (no nulo) y guarda un `LocalizedText` o, como dato legado, un string. Es la regla de `docs/I18N.md` § 1: un registro, todas las traducciones embebidas. Dominio y aplicación lo tipan `LocalizedText | string`, igual que `headline`, `summary` y `detail`, y el mapper usa `resolveLocale`, que ya devuelve tal cual un string legado (spec `content-localization`, *Fallback por campo, no excluyente*).

Alternativas descartadas:
- **Columna `levelI18n` aparte** (como `nameI18n`): `nameI18n` existe porque `name` es un nombre canónico que se usa como clave y como fallback. El nivel no cumple ese rol; una segunda columna duplicaría el dato y obligaría a decidir cuál gana.
- **Enum de niveles (MCER o propio) traducido en el cliente:** quita libertad al owner (*"B1-B2"*, *"Nativo"*, *"Profesional"* conviven hoy), mueve textos de datos a `messages.ts` y contradice el contrato de texto ya resuelto.

### D2 — Migración `localize_language_level`: cambio de tipo con conversión, sin pérdida

Archivo `backend/prisma/migrations/20261010120000_localize_language_level/migration.sql`, escrito a mano (no `migrate dev`, no `db push`). Un único `ALTER`, atómico:

```sql
-- localize-language-level (D2): el nivel de cada idioma pasa a texto bilingüe en la misma fila.
-- Nivel conocido en español -> { es, en }; código MCER -> { es: x, en: x }; cualquier otro -> { es: x }.
ALTER TABLE "Language" ALTER COLUMN "level" TYPE JSONB USING (
  CASE
    WHEN lower(btrim("level")) IN ('nativo', 'nativa', 'lengua materna', 'idioma materno')
      THEN jsonb_build_object('es', btrim("level"), 'en', 'Native')
    WHEN lower(btrim("level")) = 'bilingüe'
      THEN jsonb_build_object('es', btrim("level"), 'en', 'Bilingual')
    WHEN lower(btrim("level")) = 'principiante'
      THEN jsonb_build_object('es', btrim("level"), 'en', 'Beginner')
    WHEN lower(btrim("level")) IN ('básico', 'básica')
      THEN jsonb_build_object('es', btrim("level"), 'en', 'Basic')
    WHEN lower(btrim("level")) = 'elemental'
      THEN jsonb_build_object('es', btrim("level"), 'en', 'Elementary')
    WHEN lower(btrim("level")) IN ('intermedio', 'intermedia')
      THEN jsonb_build_object('es', btrim("level"), 'en', 'Intermediate')
    WHEN lower(btrim("level")) IN ('intermedio alto', 'intermedio-alto', 'intermedia alta', 'intermedia-alta')
      THEN jsonb_build_object('es', btrim("level"), 'en', 'Upper intermediate')
    WHEN lower(btrim("level")) IN ('avanzado', 'avanzada')
      THEN jsonb_build_object('es', btrim("level"), 'en', 'Advanced')
    WHEN lower(btrim("level")) IN ('fluido', 'fluida')
      THEN jsonb_build_object('es', btrim("level"), 'en', 'Fluent')
    WHEN lower(btrim("level")) = 'conversacional'
      THEN jsonb_build_object('es', btrim("level"), 'en', 'Conversational')
    WHEN lower(btrim("level")) = 'profesional'
      THEN jsonb_build_object('es', btrim("level"), 'en', 'Professional')
    WHEN btrim("level") ~* '^[abc][12]\+?(\s*[-/–]\s*[abc][12]\+?)?$'
      THEN jsonb_build_object('es', btrim("level"), 'en', btrim("level"))
    ELSE jsonb_build_object('es', btrim("level"))
  END
);
```

**Tabla de traducciones** (comparación sin mayúsculas y sin espacios al borde; el español conserva lo escrito, recortado):

| Español (cualquiera de) | Inglés |
|---|---|
| Nativo, Nativa, Lengua materna, Idioma materno | Native |
| Bilingüe | Bilingual |
| Principiante | Beginner |
| Básico, Básica | Basic |
| Elemental | Elementary |
| Intermedio, Intermedia | Intermediate |
| Intermedio alto, Intermedio-alto, Intermedia alta, Intermedia-alta | Upper intermediate |
| Avanzado, Avanzada | Advanced |
| Fluido, Fluida | Fluent |
| Conversacional | Conversational |
| Profesional | Professional |
| Código MCER: `A1`…`C2`, con `+` opcional, o un rango con `-`, `/` o `–` (`B1-B2`, `B2/C1`, `B2+`) | el mismo texto |
| Cualquier otro texto | sin `en` |

**Por qué todo queda como objeto** (y no se deja el MCER o lo desconocido como string legado, que era la primera idea): con todas las filas en `LocalizedText`, el formulario no necesita casos especiales y el informe de faltantes funciona. Un string legado nunca se reporta como faltante (regla D4 de `add-bilingual-builder-parity`), así que un *"Nivel C"* que no está en la lista desaparecería en silencio; como `{ es }` aparece en el aviso del constructor. Para un código MCER se escribe también el inglés, porque es el mismo texto y no es una traducción pendiente. El código sigue aceptando strings legados en lectura, por robustez.

**Por qué no se rellena `en` con el español en lo desconocido:** un valor igual al del otro idioma no cuenta como faltante, así que escondería justo lo que hay que traducir.

No hace falta idempotencia: Prisma registra la migración y no la vuelve a correr, y el `ALTER` es atómico (si falla, la columna queda como estaba). Sobre una base sin filas (producción al nacer) solo cambia el tipo.

Alternativa descartada: **convertir en un script TypeScript** después de una migración de tipo plana. Partiría el cambio en dos pasos no atómicos y dejaría una ventana con datos a medias.

### D3 — Validación y mapper

- `validateLanguage`: `level` obligatorio. Si es string, no puede estar en blanco; si es objeto, `es` no puede estar en blanco. `en` es opcional. Se reusa `sourceText` del mismo archivo (el que ya validan `headline` y `summary`); el mensaje pasa a `level.es es obligatorio`.
- `toLanguageOutput`: `level: resolveLocale(language.level, locale)`.
- `toAdminLanguageOutput`: `level` crudo.
- `profile.prisma-mapper.ts`: lee `Prisma.JsonValue` con el mismo narrowing que `detail`; escribe el valor tal cual.

### D4 — Contrato

- **Público:** `LanguageResponse.level` sigue siendo `string` y obligatorio. Solo cambia su descripción en Swagger (*"resuelto al idioma pedido"*).
- **Admin, entrada:** `CreateLanguageDto.level` pasa a `LocalizedTextDto` con `@IsObject()`, `@ValidateNested()` y `@Type(() => LocalizedTextDto)`, obligatorio; `UpdateLanguageDto` lo hereda opcional (y `null` sigue siendo 400, por `skipNullProperties: false`). Un string responde 400: el panel es el único cliente y se actualiza en el mismo change.
- **Admin, salida:** `AdminLanguageResponse.level` es `LocalizedText | string`, documentado como `LocalizedTextDto`, igual que `headline`.
- `PATCH` con `level` reemplaza el objeto completo, sin merge por idioma, como el resto de los campos bilingües.

Alternativa descartada: **aceptar también un string en la entrada.** Haría falta un validador de unión y el panel nunca lo enviaría; solo serviría para mantener datos legados nuevos.

### D5 — Seed igual a una base migrada

`docs/cv-data.json`: `"level": { "es": "Nativo", "en": "Native" }` y `"level": { "es": "B1-B2", "en": "B1-B2" }`, exactamente lo que D2 produce con esos valores. `seed.ts` tipa `level: LocalizedText` y lo pasa tal cual. `verify-seed.ts` compara el `level` de cada idioma de la base con el de `cv-data.json` (por `name`) y falla si difiere.

### D6 — Panel: el nivel es un `LocalizedField` obligatorio

- `LanguageDraft.level: LocalizedText`; `EMPTY_LANGUAGE.level = { es: '', en: '' }`.
- `edit()` carga con `editableText(language.level)`: un legado string queda en ES, con EN vacío.
- `toLanguageBody` envía `level: toLocalizedPayload(draft.level)` (recorta y omite `en` vacío). Como define qué cuenta como cambio (D12 de `polish-builder-and-edge`), un legado que se abre y se cierra sin tocar no queda sucio.
- La validación de cliente exige nombre y `level.es`; el mensaje sigue siendo *"El nombre y el nivel son obligatorios"*.
- El listado muestra `es(editableText(language.level))`.

### D7 — El informe de faltantes cubre los idiomas del perfil

`MissingTranslationEntity` suma `'language'`. Por cada idioma del perfil se revisan `nameI18n`, `level` y `detail`, con la misma regla `isMissing` (vacío en el idioma pedido y con contenido en otro; los strings legados no se reportan). El campo se informa con su nombre (`nameI18n`, `level`, `detail`) y el id del idioma.

Se cubren los tres campos y no solo el nivel porque comparten entidad, se muestran juntos y el costo es el mismo; si quedaran afuera, un `detail` sin inglés seguiría saliendo en español sin aviso.

**Nombre legible en el aviso:** el preview no trae el id de cada idioma y no se agrega al contrato público. `MissingTranslationsNotice` resuelve el nombre con la lista de `GET /api/admin/languages` (la misma query de TanStack que usa la Portada, clave `['admin', 'languages']`), mostrando el español de `nameI18n` o `name`; si la lista no cargó, el id. Etiquetas: entidad *Idiomas*; campos *Nombre mostrado*, *Nivel* y *Detalle*.

Alternativa descartada: **agregar `id` a `LanguageResponse`.** Cambiaría el contrato público para una necesidad del panel.

### D8 — Orden de aplicación y bases

1. Todo el desarrollo y los e2e corren contra una base descartable, `portfolio_levelfix`, en el mismo contenedor (`portfolio-postgres`, `localhost:5434`), creada a partir de un `pg_dump` de solo lectura de `portfolio`.
2. **La base del owner (`portfolio`) nunca recibe el seed ni `db push`.** Se migra al final, con `prisma migrate deploy`, solo con un respaldo nuevo y el **OK explícito del owner** (P2).
3. Efecto aceptado si el owner lo aprueba: desde que `portfolio` se migra, el backend de `main` (cliente Prisma viejo, `level String`) no la puede leer hasta el merge. Por eso la migración del owner va última.

### D9 — Producción y rollback

En Railway la migración corre en el `preDeployCommand` (`prisma migrate deploy`). Sobre una base vacía solo cambia el tipo. Si la base ya tiene datos, se toma un respaldo antes (`pg_dump` o backup de Railway).

**Rollback preferido:** restaurar el respaldo y volver a desplegar la imagen anterior.

**Rollback por SQL** (sin respaldo; **pierde el inglés**, conserva el español):

```sql
ALTER TABLE "Language" ALTER COLUMN "level" TYPE TEXT USING (
  CASE jsonb_typeof("level")
    WHEN 'string' THEN "level" #>> '{}'
    WHEN 'object' THEN COALESCE(NULLIF(btrim("level" ->> 'es'), ''), "level" ->> 'en', '')
    ELSE "level"::text
  END
);
DELETE FROM "_prisma_migrations" WHERE migration_name = '20261010120000_localize_language_level';
```

Después, desplegar el código anterior. El código nuevo no funciona sobre la columna `TEXT` y el viejo no funciona sobre `JSONB`.

## Risks

| Riesgo | Mitigación |
|---|---|
| Un valor real del owner no está en la lista y queda sin inglés | Pasa a `{ es }` y el informe de faltantes lo muestra; la tarea 1.2 lista los valores reales antes de migrar, y si alguno no está en la tabla se consulta (P3) |
| `lower()` no baja acentos en mayúscula con collation `C` (`BÁSICO`) | El valor cae a `{ es }`: no se pierde nada y aparece en el aviso. La tarea 1.2 registra la collation de la base |
| El backend de `main` no lee `portfolio` migrada | D8: la base del owner se migra al final y solo con su OK |
| El ALTER falla a mitad | Es una sola sentencia atómica; la columna queda como estaba |
| Un cliente admin externo manda `level` como string | No hay clientes fuera del repo; responde 400 con el nombre de la propiedad |
| El aviso de faltantes crece y se vuelve ruido | Solo cuenta lo vacío (D4 de `add-bilingual-builder-parity`); con el seed y la conversión de D2 no aparece nada nuevo |

## Migration Plan

1. Respaldo de solo lectura de `portfolio` y copia descartable `portfolio_levelfix` (tareas 1.1 y 1.2).
2. Schema, migración, seed y ensayo de la migración y del rollback en la copia (grupo 1).
3. Backend, contrato generado, frontend y documentación (grupos 2 a 5), con los e2e contra la copia.
4. Verificación completa (grupo 6).
5. Con el OK del owner: respaldo nuevo de `portfolio`, `prisma migrate deploy` y evidencia (grupo 7).
6. En el deploy a Railway, la migración corre sola en el `preDeployCommand`.

## Open Questions

- **P1 — ¿El informe de faltantes cubre `nameI18n` y `detail` además del nivel?** [no bloqueante]
  - A: los tres campos (recomendado, D7).
  - B: solo `level`.

  Recomendación: A, por lo explicado en D7. Pasar a B es sacar dos claves del `check` y no cambia nada más.
- **P2 — ¿Quién migra la base del owner (`portfolio`) y cuándo?** [bloqueante solo para el grupo 7]
  - A: el agente, al final, tras `pg_dump` y con el OK explícito del owner en el chat (como `retire-accent-color`).
  - B: el owner, a mano, después del merge.

  Recomendación: A, con el efecto de D8 aceptado.
- **P3 — ¿Se amplía la tabla de traducciones de D2?** [no bloqueante]
  - A: queda como está; lo desconocido pasa a `{ es }` y se completa desde el panel.
  - B: el owner agrega valores antes de la migración.

  Recomendación: A. Si la tarea 1.2 muestra en `portfolio` un valor fuera de la tabla, se consulta antes de cerrar el grupo 1.
