# Verificación — localize-language-level

Ejecutada el 10 de octubre de 2026 (grupos 1 a 6). El grupo 7 (base del owner) se cerró ese mismo día, después del merge del PR #28 y con el OK del owner (P2). Todo corrió contra `portfolio_levelfix`, copia descartable de `portfolio` en `portfolio-postgres` (`localhost:5434`); `portfolio` solo recibió lecturas (`pg_dump` y `SELECT`). Antes de cada comando de Prisma, del seed y de los e2e se confirmó el destino con `prisma:status` (*Datasource "db": PostgreSQL database "portfolio_levelfix"*).

## Respaldo

| Dato | Valor |
|---|---|
| Comando | `pg_dump -U portfolio -Fc -f /tmp/<archivo> portfolio` dentro de `portfolio-postgres`, y `docker cp` al scratchpad (fuera del repo) |
| Ruta | `C:\Users\Manuel Saavedra\AppData\Local\Temp\claude\D--projects-portfolio-msaavedra-portfolio-msaavedra--claude-worktrees-compassionate-sammet-12b825\5394de86-eeaf-4a96-8a89-032ccee8f627\scratchpad\dumps\portfolio-pre-levelfix-20261010-043224.dump` (copia también en `/tmp/` del contenedor) |
| Tamaño | 61 544 bytes |
| SHA-256 | `8C640FFB47D7751D9736F90819B4F2F4582503F19ACDC5763420E946D7A45D82` |
| `pg_restore --list` | lista `TABLE public Language`, `TABLE DATA public Language`, `Language_pkey` y `Language_profileId_fkey` |

## 1. Base descartable, schema, migración y seed

- **1.1** Respaldo: tabla de arriba.
- **1.2** Evidencia previa (`verification/1.2-antes.txt`), solo lectura sobre `portfolio`. Collation `en_US.utf8`.

  | Idioma | `level` en `portfolio` | Categoría de D2 | Resultado esperado |
  |---|---|---|---|
  | Español | `Nativo` | conocido | `{ es: "Nativo", en: "Native" }` |
  | Inglés | `B1-B2` | código MCER | `{ es: "B1-B2", en: "B1-B2" }` |

  Ningún valor desconocido: no hubo que consultar al owner (P3 = A).
- **1.3** `createdb portfolio_levelfix` y `pg_restore --no-owner` del dump. `prisma:status` con la copia: *3 migrations found … Database schema is up to date!*
- **1.4** `schema.prisma`: `level Json`; `migration.sql` de `20261010120000_localize_language_level` idéntico al SQL de D2 (extraído del propio `design.md`). `npx prisma validate`: *The schema … is valid*.
- **1.5** `docs/cv-data.json`, `scripts/seed.ts` y `scripts/verify-seed.ts` (compara `es` y `en` de cada `level` por `name`, sin depender del orden de claves de `jsonb`). `docs/cv-data.es-only.backup.json` sin cambios.
- **1.6** Ensayo de la migración (`verification/1.6-ensayo-migracion.txt`): 8 idiomas sintéticos (`" avanzado "`, `Nativa`, `Bilingüe`, `Intermedio alto`, `C1`, `B2+`, `B2/C1`, `Nivel de supervivencia`) + los 2 reales. Resultado: `{"es":"avanzado","en":"Advanced"}`, `Nativa`→`Native`, `Bilingüe`→`Bilingual`, `Intermedio alto`→`Upper intermediate`, `C1`/`B2+`/`B2/C1` con `en` igual al código, `Nivel de supervivencia` → `{"es": …}` sin `en`; los reales como anticipó 1.2. 10 filas antes y después, columna `jsonb` `NOT NULL`, `prisma:status` sin pendientes.
- **1.7** Rollback y seed (`verification/1.7-ensayo-rollback-y-seed.txt`): el SQL de D9 devuelve la columna a `text` con el español de cada fila y `prisma:status` muestra `localize_language_level` pendiente. `pg_restore --clean --if-exists` y el `SELECT` de 1.2 sobre la copia es idéntico a `1.2-antes.txt`. Se reaplicó la migración y se corrió `npm run seed` y `npm run seed:verify` **solo en la copia**: código 0; `Español` = `{"es":"Nativo","en":"Native"}` e `Inglés` = `{"es":"B1-B2","en":"B1-B2"}`, iguales a lo que produjo la migración. Con `level.en` alterado en la base, `seed:verify` sale con código 1 nombrando el idioma.
- **1.8** `prisma generate` y `prisma migrate diff --from-schema-datasource … --to-schema-datamodel … --exit-code`: *No difference detected*, código 0.

## 2. Backend

- **2.1** Tests: `validate-profile.spec.ts`, `get-profile.use-case.spec.ts`, `profile.prisma-mapper.spec.ts`, `profile-admin.use-cases.spec.ts`, `detect-missing-translations.spec.ts` y `seed-translations.spec.ts` (el seed bilingüe ahora incluye los idiomas); e2e en `content-admin`, `app`, `curated-profile` y `backoffice`. *Desvío:* en el backend el cambio de tipos (2.2 a 2.4) se escribió en la misma pasada que los tests, así que no se corrió una vuelta intermedia con los tests rojos; en el frontend sí (14 de 14 tests de la Portada y 2 del aviso fallaron antes de 4.2 y 4.3).
- **2.2 a 2.4** Implementados como indica D3, D4 y D7.
- **2.5** `verification/2.5-backend.txt`: lint y typecheck en 0; 76 suites / 535 unitarios y 10 suites / 174 e2e en verde; `nest build` en 0.

## 3. Contrato generado

- **3.1** `openapi:export` dos veces: sin diferencias entre corridas. El diff de `backend/openapi.json` es exactamente el previsto: `level` de `CreateLanguageDto`, `UpdateLanguageDto` y `AdminLanguageResponse` pasa a `LocalizedTextDto`, la descripción de `LanguageResponse.level` (sigue `string`) y `language` en el enum de entidad del informe.
- **3.2** `npm run api:types`; `api-types.spec.ts` en verde dentro de la suite del frontend; `LanguageResponse.level` sigue `string`.

## 4. Frontend

- **4.1 a 4.3** Tests y código de `PortadaPage`, `language-form.ts`, `proyectos-form.spec.ts` y `MissingTranslationsNotice` (con `ProfileBuilderPage.test.tsx`).
- **4.4** `verification/4.4-frontend.txt`: lint y build en 0; 38 archivos / 297 tests en verde. `Contact.tsx` y `print-sheet.ts` sin cambios.

## 5. Documentación

`docs/I18N.md`, `docs/MANUAL.md` y `docs/manual/index.html` (TC-32, captura `docs/manual/tc32-faltantes.png`, TC-25 paso 4), `docs/DEPLOY.md` § 9.5, `docs/DEPLOY-RAILWAY.md`, `docs/RELEASE-1.0.0-CHECKLIST.md` y `docs/CHANGELOG.md`. La línea del change en `CLAUDE.md` se agrega al archivar.

## 6. Verificación completa

- **6.1** `verification/6.1-suite.txt`: backend lint 0; `test:all` = 535 unitarios (76 suites) + 174 e2e (10 suites); `openapi:export` sin deriva; frontend lint 0, 297 tests (38 archivos), build 0.
- **6.2** `verification/6.2-api.txt` (backend `node dist/main` en el 3300 contra la copia):
  - `GET /api/curated-profiles/all?lang=en` → `Spanish · Native`; `?lang=es` → `Español · Nativo`; `?locale=en` → `Native`. Inglés: `B1-B2` en los dos idiomas.
  - `tech-lead-dotnet`: `Native` en `en`, `Nativo` en `es`.
  - `POST /api/admin/languages` con `level: "B2"` → 400 (*level must be an object*).
- **6.3** `verification/6.3-app-real.txt` y capturas (`6.3-contacto-en.png`, `6.3-impresion-en.png`, `6.3-portada-nivel-en.png`, `6.3-portada-reabierto.png`, `6.3-constructor-aviso.png`), con Vite en el 5173 y `puppeteer-core` + Chrome del sistema:
  - `/?lang=en`: contacto y hoja imprimible (`@media print`) dicen `Spanish · Native`.
  - Portada: se editó el nivel EN de *Inglés*, se guardó, se recargó y se reabrió: `ES="B1-B2"`, `EN="B1-B2 (working proficiency)"`; `/api/profile?lang=en` lo refleja.
  - Con el inglés vaciado, el nivel crudo queda `{"es":"B1-B2"}` y la vista previa en EN del constructor muestra *Falta 1 traducción en EN · Idiomas · Inglés: Nivel*.
  - Al final el nivel de *Inglés* se restauró al valor del seed en la copia.
  - Se creó un administrador de prueba **solo en `portfolio_levelfix`** (`admin:bootstrap`, credenciales generadas, guardadas fuera del repo).
- **6.4** `verification/6.4-validate.txt`: `validate localize-language-level --strict` válido, sin *Archive would refuse*; `validate --all --strict`: 34 pasan, 0 fallan.
- **6.5** `portfolio_levelfix` se borró al cerrar el grupo 7 (`dropdb`), junto con su administrador de prueba. `pg_database` solo lista `portfolio`, `postgres`, `template0` y `template1`. Los procesos de la prueba (backend en el 3300 y Vite en el 5173) se pararon.

## 7. Base del owner

El owner dio el OK el 10 de octubre de 2026.

- **7.1** Respaldo nuevo de `portfolio`, tomado con el mismo procedimiento que § *Respaldo*:
  - Ruta: `…\scratchpad\dumps\portfolio-pre-migrate-20261010-161408.dump` (también queda en `/tmp/` del contenedor).
  - Tamaño: 61 544 bytes.
  - SHA-256: `D6654B6C2B1ED8DE63E36AA4205523E0E2EE0DF17B7AC100F106A3184B4CDD88`.
  - `pg_restore --list` lista `TABLE DATA public Language`.
- **7.2** El 10 de octubre de 2026, después del merge del PR #28 y con autorización del owner, se aplicó la migración sobre `portfolio`. Salida en `verification/7.2-7.3-owner.txt`:
  - Antes: `prisma:status` mostraba `localize_language_level` pendiente.
  - `prisma:deploy`, sin seed.
  - Después: `prisma:status` da *Database schema is up to date!*.
- **7.3** Evidencia posterior (mismo archivo): la columna `level` es `jsonb` no nula; `prisma migrate diff … --exit-code` da *No difference detected* con código 0.

  **Antes y después**

  | Idioma | `level` antes | `level` después | Regla de D2 |
  |---|---|---|---|
  | Español | `Nativo` | `{"es":"Nativo","en":"Native"}` | conocido |
  | Inglés | `B1-B2` | `{"es":"B1-B2","en":"B1-B2"}` | MCER |
