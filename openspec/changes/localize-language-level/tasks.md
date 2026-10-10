# Tasks — localize-language-level

> Referencias: `proposal.md`, `design.md` (D1–D9, P1–P3), `specs/*/spec.md`. La evidencia va en `verification.md` y en `verification/`, como en `add-printable-one-page`.
>
> **Orden de los grupos:** 1 (base descartable, schema, migración y seed) → 2 (backend) → 3 (contrato generado) → 4 (frontend) → 6 (verificación). El grupo 5 (documentación) puede ir en paralelo con 2 a 4. El grupo 7 (base del owner) va **último** y solo con el OK explícito del owner (P2).
>
> **Bases (D8):**
> - `portfolio` (la del owner, `portfolio-postgres` en `localhost:5434`): **nunca** se le corre `npm run seed`, `prisma db push` ni `prisma migrate dev`. Antes del grupo 7 solo recibe lecturas (`pg_dump`, `SELECT`).
> - `portfolio_levelfix`: copia descartable en el mismo contenedor. Todo el desarrollo, el seed, los e2e y la app real corren contra ella. En PowerShell: `$env:DATABASE_URL = "postgresql://portfolio:portfolio@localhost:5434/portfolio_levelfix?schema=public"`.
>
> Antes de cada comando de Prisma, del seed o de los e2e, correr `npm run prisma:status` y confirmar que el destino es `portfolio_levelfix`.

## 1. Base descartable, schema, migración y seed (D1, D2, D5, D8, D9)

- [x] 1.1 Respaldo de solo lectura de `portfolio`: `docker exec portfolio-postgres pg_dump -U portfolio -Fc portfolio > <dir fuera del repo>/portfolio-pre-levelfix-<YYYYMMDD-HHMMSS>.dump`. Verificar: en `verification.md` § *Respaldo* quedan la ruta absoluta, el tamaño (mayor que 0) y el SHA-256; `pg_restore --list` lista la tabla `Language`.
- [x] 1.2 Evidencia previa, solo lectura, sobre `portfolio`: `SELECT id, name, level FROM "Language" ORDER BY name;` y `SELECT datcollate, datctype FROM pg_database WHERE datname = 'portfolio';`. Verificar: salida en `verification/1.2-antes.txt`; en `verification.md`, cada `level` con la categoría de D2 que le toca (conocido, MCER o desconocido). Si alguno es desconocido, **consultar al owner** antes de seguir (P3).
- [x] 1.3 Copia descartable: `docker exec portfolio-postgres createdb -U portfolio portfolio_levelfix` y `pg_restore --no-owner -d portfolio_levelfix` del dump de 1.1. Verificar: con `DATABASE_URL` de la copia, `npm run prisma:status` muestra el destino `portfolio_levelfix` y las tres migraciones aplicadas.
- [x] 1.4 `backend/prisma/schema.prisma`: `level Json` en `Language`. Escribir a mano `backend/prisma/migrations/20261010120000_localize_language_level/migration.sql` con el SQL de D2. **No** usar `prisma migrate dev` ni `db push`. Verificar: `npx prisma validate` en verde y el SQL es idéntico al de D2.
- [x] 1.5 Seed (D5): en `docs/cv-data.json`, `"level": { "es": "Nativo", "en": "Native" }` y `"level": { "es": "B1-B2", "en": "B1-B2" }`. En `backend/scripts/seed.ts`, `level: LocalizedText` en el tipo y el valor tal cual al `create`. En `backend/scripts/verify-seed.ts`, comparar el `level` de cada idioma (por `name`) con la fuente y fallar nombrando el idioma si difiere. Verificar: revisión del diff; `docs/cv-data.es-only.backup.json` sin cambios.
- [x] 1.6 Ensayo de la migración en la copia:
  1. Insertar idiomas sintéticos en el perfil de la copia con `level` `" avanzado "`, `"Nativa"`, `"Bilingüe"`, `"Intermedio alto"`, `"C1"`, `"B2+"`, `"B2/C1"` y `"Nivel de supervivencia"`.
  2. `npm run prisma:status`, `npm run prisma:deploy` y otra vez `prisma:status`.
  3. `SELECT id, name, level, jsonb_typeof(level) FROM "Language" ORDER BY name;` y el tipo de la columna en `information_schema.columns`.

  Verificar: cada fila queda como dicen la tabla de D2 y los escenarios de *Migración del nivel de idioma a texto bilingüe*; las filas reales quedan como anticipó 1.2; la cantidad de filas no cambia; la columna es `jsonb` no nula. Salida en `verification/1.6-ensayo-migracion.txt`.
- [x] 1.7 Ensayo del rollback en la copia:
  1. Correr el SQL de rollback de D9. Verificar que la columna vuelve a `text`, que cada fila tiene su español y que `prisma:status` muestra `localize_language_level` pendiente.
  2. Restaurar el dump (`pg_restore --clean --if-exists --no-owner`) y comparar el `SELECT` de 1.2 contra la copia con `verification/1.2-antes.txt` (diff vacío).
  3. Volver a aplicar la migración (`prisma:deploy`), y correr `npm run seed` y `npm run seed:verify` **solo en la copia**.

  Verificar: `seed:verify` termina con código 0; el `level` sembrado de `Español` e `Inglés` es igual al que produjo la migración para `Nativo` y `B1-B2`. Salida en `verification/1.7-ensayo-rollback-y-seed.txt`; procedimiento en `verification.md` § *Rollback*.
- [x] 1.8 Con el backend parado, `npm run prisma:generate` y `npx prisma migrate diff --from-schema-datasource ./prisma/schema.prisma --to-schema-datamodel ./prisma/schema.prisma --exit-code` contra la copia. Verificar: código 0 (sin deriva entre el SQL a mano y el schema).

## 2. Backend (D1, D3, D4, D7)

- [x] 2.1 Tests primero:
  - Unitarios:
    - `validate-profile.spec.ts`: `level` `{ es: " " }`, `{ en: "Native" }` y `" "` fallan; `{ es: "Nativo" }` y `"C1"` pasan.
    - `get-profile.use-case.spec.ts`: `level` `{ es: "Nativo", en: "Native" }` sale `"Native"` en `en` y `"Nativo"` en `es`; `{ es: "Intermedio" }` sale `"Intermedio"` en `en`; `"C1"` sale igual en los dos.
    - `profile.prisma-mapper.spec.ts`: lee y escribe `level` como objeto y como string.
    - `profile-admin.use-cases.spec.ts`: alta y edición con `level` bilingüe; `PATCH` reemplaza el objeto.
    - `detect-missing-translations.spec.ts`: entidad `language` con `nameI18n`, `level` y `detail` faltantes en `en`; un `level` string no se reporta; un idioma completo no aparece.
  - e2e, contra `portfolio_levelfix` sembrada:
    - `content-admin.e2e-spec.ts`: alta con `level: { es: "Avanzado", en: "Advanced" }` y su lectura cruda; `level: "B2"` → 400 sin crear; `PATCH` con `es` en blanco → 400 sin cambios; `PATCH` que reemplaza el objeto.
    - `app.e2e-spec.ts`: `GET /api/profile?lang=en` da `languages[0].level` `"Native"` y con `?lang=es` `"Nativo"`; la recreación del perfil sigue compilando con `level` `Json`.
    - `curated-profile.e2e-spec.ts`: `GET /api/curated-profiles/all?lang=en` da `profile.languages[0].level` `"Native"`.
    - Preview del constructor en EN con un idioma sin `level.en`: el informe trae `{ entity: "language", field: "level" }`; la ruta pública no trae el informe.

  Verificar: fallan antes de 2.2–2.4.
- [x] 2.2 Dominio: `LanguageProps.level: LocalizedText | string` y su getter; `validateLanguage` con `sourceText` (D3). Verificar: `npm run typecheck` y los unitarios de dominio en verde.
- [x] 2.3 Aplicación: `LanguageOutput.level` sigue `string` y se resuelve con `resolveLocale` en `toLanguageOutput`; `AdminLanguageOutput.level: LocalizedText | string`; `detectMissingTranslations` suma la entidad `language` (D7) y actualiza su comentario de cobertura. Verificar: unitarios de 2.1 en verde.
- [x] 2.4 Infraestructura:
  - `controllers/dto/profile.dto.ts`: `level` como `LocalizedTextDto` (`@IsObject`, `@ValidateNested`, `@Type`), y `toNewLanguageProps`/`toLanguageChanges` con `toLocalizedText` (D4).
  - `docs/admin-profile.response.ts`: `level` como `LocalizedTextDto`. `docs/profile.response.ts`: descripción *"resuelto al idioma pedido"*.
  - `curated-profile/.../docs/preview-curated-profile.response.ts`: `language` en el enum de entidad.
  - `persistence/profile.prisma-mapper.ts`: lectura de `Prisma.JsonValue` con el mismo narrowing que `detail`.

  Verificar: 2.1 en verde.
- [x] 2.5 Backend completo contra `portfolio_levelfix`: `npm run lint`, `npm run typecheck`, `npm run test` y `npm run test:e2e`. Verificar: todo en verde; salida en `verification/2.5-backend.txt`.

## 3. Contrato generado (D4, D7)

- [x] 3.1 `npm run openapi:export` en backend, dos veces seguidas. Verificar: la segunda corrida no deja diff; `git diff backend/openapi.json` solo cambia `level` de `CreateLanguageDto`, `UpdateLanguageDto` y `AdminLanguageResponse` (a `LocalizedTextDto`), la descripción de `LanguageResponse.level` (sigue `string`) y suma `language` al enum de entidad del informe de faltantes.
- [x] 3.2 `npm run api:types` en frontend. Verificar: `api-types.spec.ts` en verde; en `api.d.ts`, `LanguageResponse.level` sigue siendo `string`.

## 4. Frontend (D6, D7)

- [x] 4.1 Tests primero:
  - `PortadaPage.test.tsx`: crear un idioma envía `level: { es, en }`; editar el inglés del nivel, guardar y reabrir muestra ES y EN; guardar sin `level.es` no llama a la API y muestra *"El nombre y el nivel son obligatorios"*; un `level` legado `"C1"` se carga en ES y cerrar sin tocar no avisa; el listado muestra el español.
  - `proyectos/proyectos-form.spec.ts`: los casos de `toLanguageBody` con `level` bilingüe (espacios al borde no cuentan como cambio).
  - `MissingTranslationsNotice` (test nuevo o existente): una entrada `language`/`level` se muestra como *Idiomas — Inglés: Nivel* con la lista de idiomas cargada, y con el id si no cargó.

  Verificar: fallan antes de 4.2–4.3.
- [x] 4.2 `portada/language-form.ts` y `PortadaPage.tsx`: `level: LocalizedText`, `EMPTY_LANGUAGE`, `editableText` al editar, `toLocalizedPayload` en `toLanguageBody`, `LocalizedField` obligatorio en lugar del `TextField`, validación de `level.es` y listado con el español. Ajustar fixtures (`test/fixtures`). Verificar: 4.1 de la Portada en verde.
- [x] 4.3 `MissingTranslationsNotice.tsx`: `language: 'Idiomas'` en `ENTITY_LABELS`, *Nombre mostrado*, *Nivel* y *Detalle* en `FIELD_LABELS`, y el nombre del idioma desde la query `['admin', 'languages']` (D7). Verificar: 4.1 del aviso en verde.
- [x] 4.4 `npm run lint`, `npm run typecheck`, `npm run test` y `npm run build`. Verificar: todo en verde; `Contact.tsx` y `print-sheet.ts` sin cambios.

## 5. Documentación (D2, D9)

- [x] 5.1 `docs/I18N.md` § 2: `Language.level` (y `nameI18n`/`detail`, que faltaban) en la columna de traducibles. Verificar: revisión del diff.
- [x] 5.2 `docs/MANUAL.md` y `docs/manual/index.html`: TC-32 *El nivel del idioma en los dos idiomas* (editar el nivel en ES/EN en la Portada, ver `Spanish · Native` en `/?lang=en` y en la hoja imprimible, el aviso de faltantes con un nivel sin inglés), con su bloque `curl` y el resultado ejecutado. TC-25, paso 4: el nivel se edita con pestañas ES/EN. Verificar: revisión del diff.
- [x] 5.3 `docs/DEPLOY.md` § 9.5 y `docs/DEPLOY-RAILWAY.md`: qué hace `localize_language_level`, que corre en el `preDeployCommand`, que sobre una base vacía solo cambia el tipo, el respaldo previo si hay datos y los dos rollbacks de D9. `docs/RELEASE-1.0.0-CHECKLIST.md`: el ítem de migraciones suma `localize_language_level` (de datos, no destructiva). Verificar: revisión del diff.
- [x] 5.4 `docs/CHANGELOG.md`: entrada con la migración de datos, el cambio visible en inglés, el BREAKING admin sin clientes y la entidad nueva del informe. `CLAUDE.md` (línea del change) al archivar. Verificar: revisión del diff.

## 6. Verificación completa (contra `portfolio_levelfix`)

- [x] 6.1 Suites: `npm run test:all` y `npm run lint` en backend; `npm run test`, `npm run lint` y `npm run build` en frontend. Verificar: todo en verde, con los conteos en `verification/6.1-suite.txt`.
- [x] 6.2 API real (backend en 3300 contra la copia):
  - `GET /api/curated-profiles/all?lang=en` → `profile.languages[0].level` `"Native"`; con `?lang=es` → `"Nativo"`; con `?locale=en` → `"Native"`.
  - Lo mismo con un perfil de plantilla (`tech-lead-dotnet`).
  - `POST /api/admin/languages` con `level: "B2"` → 400.

  Verificar: salidas de `curl` en `verification/6.2-api.txt`.
- [x] 6.3 App real (`npm run dev`): en `/admin/portada`, editar el nivel de `Inglés` en EN, guardar, recargar y reabrir (ES y EN se conservan); `/?lang=en` muestra `Spanish · Native` en el contacto y en la vista de impresión; en el constructor, un nivel sin inglés aparece en el aviso de faltantes como *Idiomas — <nombre>: Nivel*. Verificar: capturas en `verification/`.
- [x] 6.4 `npx -y @fission-ai/openspec@1.14.1 validate localize-language-level --strict` y `npx -y @fission-ai/openspec@1.14.1 validate --all --strict`. Verificar: el change valida, sin avisos *Archive would refuse* y sin fallas nuevas en `--all`; transcripción en `verification/6.4-validate.txt`.
- [ ] 6.5 Cierre de la copia: `dropdb portfolio_levelfix`, salvo que el grupo 7 siga pendiente y se quiera repetir el ensayo. Verificar: `psql -l` no la lista o `verification.md` explica por qué sigue.

## 7. Base del owner — PENDIENTE DE APROBACIÓN (P2, D8)

> No empezar sin el OK explícito del owner en el chat. Desde 7.2, el backend de `main` no puede leer `portfolio` hasta el merge (D8).

- [ ] 7.1 Respaldo nuevo de `portfolio` (como 1.1, con fecha nueva). Verificar: ruta, tamaño y SHA-256 en `verification.md` § *Respaldo*.
- [ ] 7.2 Con los backends locales parados y `DATABASE_URL` de `portfolio`: `npm run prisma:status` (destino `portfolio`, `localize_language_level` pendiente), `npm run prisma:deploy` y `prisma:status`. **Sin seed.** Verificar: salida en `verification/7.2-deploy-owner.txt`; sin pendientes.
- [ ] 7.3 Evidencia posterior: el `SELECT` de 1.2 y el tipo de la columna; `prisma migrate diff … --exit-code`. Verificar: en `verification.md` § *Antes y después*, una tabla por idioma con el `level` previo y el resultante, conforme a D2; `migrate diff` con código 0. Salida en `verification/7.3-despues.txt`.
