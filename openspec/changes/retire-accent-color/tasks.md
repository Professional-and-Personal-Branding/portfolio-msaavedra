# Tasks — retire-accent-color

> Referencias: `proposal.md`, `design.md` (D1–D11), `specs/*/spec.md`, `verification.md`.
>
> **Orden de los grupos:** 1 (base de datos: respaldo, ensayo y migración de la base del owner) → 2 (backend) → 3 (contrato generado) → 4 (frontend) → 5 (documentación) → 6 (verificación). El grupo 1 va primero y entero; dentro de él, el orden es estricto. El grupo 5 puede ir en paralelo con los grupos 2 a 4.
>
> **Bases:**
> - `portfolio` (la del owner, `localhost:5434`) recibe solo las tareas 1.1, 1.2, 1.7 y 1.8, y después los tests y la app real. **Nunca se le corre el seed.**
> - `portfolio_retire_accent` es la copia descartable del ensayo (tareas 1.5 y 1.6). Para trabajar sobre ella, exportar `DATABASE_URL="postgresql://portfolio:portfolio@localhost:5434/portfolio_retire_accent?schema=public"`.
>
> Antes de cada comando de Prisma o del seed, correr `npm run prisma:status` para confirmar el destino.
>
> **Efecto aceptado (D5):** desde la tarea 1.7, el backend de `main` no funciona contra `portfolio` hasta el merge.

## 1. Base de datos: respaldo, ensayo y migración de la base del owner (D3, D4, D5, D11)

- [x] 1.1 Respaldo de `portfolio`: `docker exec portfolio-postgres pg_dump -U portfolio -Fc portfolio > <dir fuera del repo>/portfolio-pre-retire-accent-<YYYYMMDD-HHMMSS>.dump`. Verificar: en `verification.md` § *Respaldo* quedan la ruta absoluta, el tamaño en bytes (mayor que 0) y el SHA-256 (`sha256sum` o `Get-FileHash`); `pg_restore --list <dump>` lista la tabla `CuratedProfile`.
- [x] 1.2 Evidencia previa, solo lectura, sobre `portfolio`: `SELECT id, slug, "accentColor", "themeId", jsonb_typeof("themeOverrides") AS overrides_type, jsonb_typeof("themeOverrides"->'colors') AS colors_type, "themeOverrides"->'colors'->'accent' AS override_accent FROM "CuratedProfile" ORDER BY slug;`. Verificar: la salida queda en `verification/1.2-antes.txt`. Si algún `overrides_type` no es `object` ni nulo, o algún `colors_type` no es `object` ni nulo, **frenar y consultar** (D4). Anotar en `verification.md` cuántas filas tienen ya `override_accent`, porque esas no deben cambiar.
- [x] 1.3 `prisma/schema.prisma`: quitar `accentColor` de `CuratedProfile`. Escribir a mano `prisma/migrations/<YYYYMMDDHHMMSS>_retire_accent_color/migration.sql` con el SQL de D4 (comentario, `UPDATE` jsonb y `DROP COLUMN`). **No** usar `prisma migrate dev` ni `db push`. Verificar: `npx prisma validate` en verde y el SQL es idéntico al de D4.
- [x] 1.4 Seed (D11):
  - En `docs/cv-data.json`, reemplazar en cada una de las 13 plantillas `"accentColor": "#…"` por `"themeOverrides": { "colors": { "accent": "#…" } }`, con el mismo color.
  - En `backend/scripts/seed.ts`, `themeOverrides?: Record<string, unknown>` en el tipo de la plantilla, pasarlo al `create` (si falta, `NULL`) y quitar `accentColor` de los dos `create`. El perfil `all` va con `themeOverrides: { colors: { accent: '#38bdf8' } }`.
  - En `backend/scripts/verify-seed.ts`, comparar el `colors.accent` de cada plantilla con `cv-data.json`.

  Verificar: `grep -n accentColor docs/cv-data.json backend/scripts` vacío; los 13 colores siguen siendo los de 1.2 (diff de `cv-data.json` revisado).
- [x] 1.5 Ensayo en la copia:
  1. `createdb portfolio_retire_accent` en el mismo servidor y `pg_restore --no-owner -d portfolio_retire_accent <dump>`.
  2. Insertar cinco perfiles sintéticos con los casos de D4: `themeOverrides` en `NULL` de SQL, `null` de JSON, objeto sin `colors`, `colors` sin `accent` y `colors.accent` presente.
  3. `npm run prisma:status`, `npm run prisma:deploy` y otra vez `prisma:status`.
  4. `SELECT` como el de 1.2, sin la columna.

  Verificar: cada caso sintético queda como dicen los escenarios de `data-persistence-seed` (*Migración del acento de los perfiles al tema*); cada fila real tiene `colors.accent` igual a su `accentColor` de 1.2, salvo las que ya tenían override, que no cambian; la columna no existe. Salida en `verification/1.5-ensayo-migracion.txt`.
- [x] 1.6 Ensayo del rollback en la copia: con la copia migrada, `pg_restore --clean --if-exists --no-owner -d portfolio_retire_accent <dump>`. Verificar: `prisma:status` muestra dos migraciones aplicadas y `retire_accent_color` pendiente; el `SELECT` de 1.2 contra la copia coincide con `verification/1.2-antes.txt` (diff vacío). Después:
  1. Volver a aplicar la migración (`prisma:deploy`).
  2. Correr `npm run seed` y `npm run seed:verify` **solo en la copia**.
  3. Comprobar que el `colors.accent` sembrado de cada plantilla coincide con el migrado en 1.5 (salvo los perfiles editados a mano en la base del owner, que se listan).

  Salida en `verification/1.6-ensayo-rollback-y-seed.txt`; procedimiento en `verification.md` § *Rollback*.
- [x] 1.7 Aplicar en `portfolio`: parar cualquier backend local; con `DATABASE_URL` de `portfolio` (el `.env`), `npm run prisma:status` (destino `portfolio`, `retire_accent_color` pendiente), `npm run prisma:deploy` y `npm run prisma:status`. Verificar: salida completa en `verification/1.7-deploy-owner.txt`; sin pendientes; en `verification.md` queda la fecha y hora y la nota del efecto aceptado (D5).
- [x] 1.8 Evidencia posterior sobre `portfolio`:
  - `SELECT id, slug, "themeOverrides"->'colors'->'accent' FROM "CuratedProfile" ORDER BY slug;`
  - `SELECT column_name FROM information_schema.columns WHERE table_name = 'CuratedProfile' AND column_name = 'accentColor';`, que debe venir vacío.
  - `npx prisma migrate diff --from-schema-datasource ./prisma/schema.prisma --to-schema-datamodel ./prisma/schema.prisma --exit-code`.
  - Con el backend parado, `npm run prisma:generate`.

  Verificar: en `verification.md` § *Antes y después*, una tabla por fila con `accentColor` previo, override previo y `colors.accent` resultante, todas conformes a D3; `migrate diff` sale con código 0. Salida en `verification/1.8-despues.txt`.

## 2. Backend (D2, D6, D8)

- [x] 2.1 Tests primero:
  - Unitarios:
    - lista de claves de `curated-profile.use-cases.spec.ts` (≈ línea 509) sin `accentColor`;
    - en `curated-profile-lifecycle.use-cases.spec.ts`, el duplicado copia `themeOverrides.colors.accent` y no trae `accentColor`;
    - en el spec del composer o de `mergeThemeTokens`, un override de `colors.accent` sobre `modern-dark` cambia solo ese token.
  - `src/swagger.spec.ts` reescrito: ningún schema de `components.schemas` tiene la propiedad `accentColor` (D8).
  - e2e, contra `portfolio` migrada:
    - las listas de claves de `test/curated-profile.e2e-spec.ts` (≈ líneas 95 y 190) sin `accentColor`;
    - `POST`, `PATCH` y preview con `accentColor: "#5B2C87"` responden 400 nombrando la propiedad (el alta no crea fila y el `PATCH` no cambia nada);
    - `GET /api/curated-profiles/fullstack-nest-react` da `theme.tokens.colors.accent` igual al valor de `cv-data.json`, salvo que 1.8 muestre un override previo;
    - un perfil creado con `themeOverrides.colors.accent` lo resuelve.

  Verificar: fallan antes de 2.2–2.4.
- [x] 2.2 Dominio: quitar `accentColor` de `NewCuratedProfileProps` y el getter de la entidad, la regla hex de `validateCuratedProfile` y `HEX_COLOR_REGEX`, y actualizar su doc. Fixture de `curated-profile.entity.spec.ts`. Verificar: `grep -rn "HEX_COLOR_REGEX\|accentColor" backend/src/modules/curated-profile/domain` vacío.
- [x] 2.3 Aplicación: quitar el campo de `CuratedProfileSummaryOutput`, de `curated-profile.admin-output.ts`, de `toCuratedProfileSummary`, de `curated-profile.admin-mapper.ts` y de la copia de `curated-profile-lifecycle.use-cases.ts`. Fixtures de los specs de casos de uso y de `profile-head.renderer.spec.ts`. Verificar: `npm run typecheck`.
- [x] 2.4 Infraestructura:
  - En `dto/curated-profile.dto.ts`, quitar el campo (`Update` y `Preview` heredan), los imports de `HEX_COLOR_REGEX` y `ACCENT_COLOR_DEPRECATED`, y las tres asignaciones.
  - Quitarlo de `docs/curated-profile.response.ts` y de `docs/admin-curated-profile.response.ts`, y **borrar** `docs/accent-color-deprecated.ts`.
  - Quitarlo de los dos sentidos de `curated-profile.prisma-mapper.ts` y de su spec.
  - En `test/backoffice.e2e-spec.ts`, quitarlo de `AdminProfile` y de `draftOf`.

  Verificar: `grep -rn "accentColor\|ACCENT_COLOR" backend/src backend/test backend/scripts` solo encuentra los tests de 2.1; 2.1 en verde.
- [x] 2.5 Backend completo: `npm run lint`, `npm run typecheck`, `npm run test` y `npm run test:e2e` contra `portfolio`. Verificar: todo en verde.

## 3. Contrato generado (D8)

- [x] 3.1 `npm run openapi:export` en backend, dos veces seguidas. Verificar: la segunda corrida no deja diff; `git diff backend/openapi.json` solo quita `accentColor` (la propiedad, la descripción de obsoleto y su entrada en `required`) de `CreateCuratedProfileDto`, `UpdateCuratedProfileDto`, `PreviewCuratedProfileDto`, `AdminCuratedProfileResponse`, `CuratedProfileSummaryResponse`, `CuratedProfileResponse` y `PreviewCuratedProfileResponse`.
- [x] 3.2 `npm run api:types` en frontend. Verificar: `grep -c accentColor frontend/src/shared/types/api.d.ts` da 0; `api-types.spec.ts` en verde.

## 4. Frontend (D7)

- [x] 4.1 `shared/admin-types.ts`: borrar los `*Wire`, los `Omit` y el comentario de D9. `shared/use-admin-api.ts` y `curated-profiles/use-preview.ts`: quitar `*Wire`, los casts del cuerpo y los comentarios. Verificar: `npm run typecheck`, sin casts del cuerpo.
- [x] 4.2 Quitar `accentColor` de `heroData` (`PortadaPage.tsx`) y de `test/fixtures/admin.ts` y `test/fixtures/curated-profile.ts`. Borrar los tests de D9 de `profile-draft.spec.ts` y `ProfileBuilderPage.test.tsx`. Verificar: `grep -rn accentColor frontend/src` vacío.
- [x] 4.3 `npm run lint`, `npm run typecheck`, `npm run test` y `npm run build`. Verificar: todo en verde.

## 5. Documentación (D5, D10, D11)

- [x] 5.1 `docs/MANUAL.md` y `docs/manual/index.html`:
  - TC-12: quitar `accentColor` del párrafo de defaults y de la línea observada, con una nota de que se retiró en `retire-accent-color`.
  - Caso del customizador: los perfiles existentes arrancan con su acento como override, y *Restablecer* lo devuelve al del preset.

  En `docs/manual/suite-backoffice.ps1`, quitar `accentColor=`. Verificar: `grep -n accentColor docs/MANUAL.md docs/manual` solo encuentra la nota.
- [x] 5.2 `docs/ARCHITECTURE.md` (schema de `CuratedProfile`) e `docs/I18N.md` (tabla): quitar `accentColor`. `docs/DATA-POPULATION.md`: el ejemplo de plantilla usa `themeOverrides.colors.accent`, con una línea sobre el contraste con el fondo del tema. Verificar: `grep -n accentColor` en los tres archivos vacío.
- [x] 5.3 `docs/DEPLOY.md` § 9.5 y `docs/DEPLOY-RAILWAY.md`:
  - qué hace `retire_accent_color` (copia el acento a `themeOverrides` y borra la columna);
  - que corre en el `preDeployCommand` con `prisma migrate deploy`;
  - que sobre una base vacía no toca filas;
  - el **respaldo previo recomendado** si la base ya tiene datos (`pg_dump` como en § backups, o un backup de Railway, antes del deploy que la incluya);
  - el rollback: restaurar el respaldo y volver a desplegar la imagen anterior; el código nuevo sin la migración no arranca, y el viejo no funciona con la columna borrada.

  `docs/RELEASE-1.0.0-CHECKLIST.md`: el ítem de migraciones suma `retire_accent_color` como destructiva, con el respaldo previo. Verificar: revisión del diff.
- [x] 5.4 `docs/ROADMAP-1.1.md`: filas de § 3.2 y § 5 resueltas, citando este change y P1 = B. `docs/CHANGELOG.md`: entrada con la primera migración destructiva, la migración de datos, el cambio visible de acentos y el BREAKING sin clientes. `CLAUDE.md` (ronda 1.1): línea del change al archivar. Verificar: revisión del diff.

## 6. Verificación completa

- [x] 6.1 Suite completa contra `portfolio` (sin seed): `npm run test:all` y `npm run lint` en backend; `npm run test`, `npm run lint` y `npm run build` en frontend. Verificar: todo en verde, con los conteos en `verification/6.1-suite.txt`.
- [x] 6.2 Inventario final: `grep -rn "accentColor\|accent_color" --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=archive .`. Verificar: solo quedan la migración `init`, la migración nueva, `docs/cv-data.es-only.backup.json`, la nota de TC-12, los tests de 2.1, `swagger.spec.ts`, `docs/DEPLOY*.md`, `CHANGELOG.md` y los artefactos de este change. Salida en `verification/6.2-inventario.txt`.
- [x] 6.3 App real contra `portfolio` (backend en 3300 y `npm run dev`):
  - `/` se ve con `#38bdf8`; `/fullstack-nest-react` y `/tech-lead-dotnet`, con su acento migrado. Las respuestas no traen `accentColor`.
  - En el customizador, un perfil migrado muestra el acento como override, y *Restablecer* vuelve al del preset sin guardar.
  - En el constructor, crear, guardar y previsualizar sin errores.
  - Con `curl`, un `POST` con `accentColor` responde 400.
  - Correr el bloque de TC-12 de `suite-backoffice.ps1`.

  Verificar: capturas y salidas en `verification/`.
- [x] 6.4 Contraste: para cada perfil de `portfolio`, calcular el contraste WCAG entre su `tokens.colors.accent` resuelto y su `tokens.colors.bg` (`GET /api/curated-profiles/{slug}`, o el preview si el perfil no es público). Verificar: en `verification.md` § *Contraste*, una tabla con perfil, acento, fondo, contraste y marca `< 3:1` / `< 4,5:1`. Solo se registra, no se corrige (riesgo aceptado, D3).
- [x] 6.5 `npx -y @fission-ai/openspec@1.14.1 validate retire-accent-color --strict` y `npx -y @fission-ai/openspec@1.14.1 validate --all --strict`. Verificar: sin fallas nuevas ni avisos *Archive would refuse*; transcripción en `verification/6.5-validate.txt`.
- [x] 6.6 Cierre: `dropdb portfolio_retire_accent`. El dump de 1.1 se conserva hasta el deploy 1.0.0, y su ruta queda en `verification.md`. Verificar: `psql -l` ya no lista la copia; `verification.md` completo, sin marcadores pendientes.
