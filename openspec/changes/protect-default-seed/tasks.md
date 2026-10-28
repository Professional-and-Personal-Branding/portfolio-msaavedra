# Tasks — protect-default-seed

> Referencias: `proposal.md`, `design.md` (D1–D9, P1–P2), `specs/data-persistence-seed/spec.md`. La evidencia va en `verification/`, como en `add-learning-guide-and-example-data`.
>
> **Orden:** 1 → 2 → 3 → 4 → 5 → 6. Los grupos 2 y 3 van juntos en el mismo commit (el código y sus tests). El 5 (docs) puede escribirse en paralelo con el 4.
>
> **Bases:**
> - `portfolio` (la del owner, `portfolio-postgres` en `localhost:5434`): **ninguna** tarea le corre `npm run seed`, con o sin flags. Tampoco `prisma migrate reset`.
> - `portfolio_seed_guard` y `portfolio_seed_guard_nomig`: bases descartables **nuevas** en el mismo contenedor, creadas al empezar el grupo 4 y borradas al terminarlo. En PowerShell: `$env:DATABASE_URL = "postgresql://portfolio:portfolio@localhost:5434/portfolio_seed_guard?schema=public"`.
>
> Antes de cada comando que escriba en una base, correr `npm run prisma:status` y confirmar que el destino es la base descartable. `backend/.env` apunta a `portfolio`: la variable de la terminal tiene que estar definida en la misma sesión.

## 1. Punto de partida

- [x] 1.1 Confirmar que la rama de trabajo contiene `add-learning-guide-and-example-data` (al menos sus grupos 1 a 3): existen `backend/scripts/lib/seed-guard.ts`, `backend/scripts/lib/seed-runner.ts` y `backend/test/seed-runner.spec.ts` con `LEGACY_CALLS = 79`. Confirmar también que `backend/railway.json` tiene `"preDeployCommand": ["npm run prisma:deploy"]` y que ningún script de `backend/package.json` llama al seed salvo `seed`, `seed:example` y `prisma.seed`. Verificar: `npm test` verde en `backend/` antes de tocar nada, y la salida de `Select-String` sobre `railway.json` y `package.json` en `verification/1.1-punto-de-partida.txt`.

## 2. Guard y orquestador (D1–D6, D8)

- [x] 2.1 `backend/scripts/lib/seed-guard.ts`: `SEED_CONTENT_TABLES` con las 13 tablas en el orden de los `deleteMany` de `writeSeed` (modelo de Prisma, etiqueta PascalCase y función de conteo), y `loadContentCounts(prisma)`, que las cuenta en secuencia y devuelve `{ label, rows }[]`. Es la única función con acceso a la base de esta parte; el resto es puro. Verificar: tests de 3.1.
- [x] 2.2 En el mismo módulo, `evaluateDefaultSeed({ counts, overwrite, env })`, que devuelve `load`, `load-overwrite` o una negativa con su motivo (`content`, `production-needs-overwrite`, `production-needs-allow`). Sigue D3 y la tabla de D4: `NODE_ENV === 'production'` exacto y `SEED_ALLOW_PRODUCTION === '1'` exacto, que se ignora fuera de producción. Verificar: tests de 3.1, uno por fila de la tabla de D4 y los dos casos locales.
- [x] 2.3 `describePgDumpCommand(databaseUrl, now)` (D8): URI de libpq sin contraseña, puerto `5432` por defecto, solo `sslmode` de la query string (sin `schema`), archivo `<base>-AAAA-MM-DD.dump` con la fecha local, la línea de `DATABASE_PUBLIC_URL` si el host termina en `.railway.internal` y la indicación genérica (que remite a `docs/DEPLOY.md` § 7) si la URL falta o no se puede leer. Verificar: tests de 3.1.
- [x] 2.4 `formatDefaultSeedRefusal(...)` con los tres textos literales de D8, con la misma forma que `formatGuardFailure`. También los avisos de `--overwrite` de D3 y D4 y el mensaje de falla al contar de D6. Verificar: tests de 3.1 que comparan el texto completo para una entrada fija.
- [x] 2.5 `backend/scripts/lib/seed-runner.ts`:
  - `SeedArgs` suma `overwrite: boolean`. `parseSeedArgs` acepta `--overwrite` (sin valor) y rechaza `--overwrite=…` como argumento desconocido y la combinación con `--file` con el mensaje de D5.
  - `RunSeedOptions` suma `overwrite`. Sin `--file`, `executeSeed` sigue el orden de D2: valida la fuente, cuenta (un fallo → código 1 con el mensaje de D6), decide (negativa → `SEED_GUARD_EXIT_CODE`) y recién entonces llama a `writeSeed`, que no cambia.
  - Con `--file`, el camino actual no cambia y no se cuenta nada.

  Verificar: tests de 3.2.
- [x] 2.6 `backend/scripts/seed.ts`: pasar `overwrite` a `executeSeed` y reescribir el comentario de cabecera: base vacía carga, con contenido se niega (código 2) salvo `--overwrite`, en producción además `SEED_ALLOW_PRODUCTION=1`, `--overwrite` no se combina con `--file`, y la tabla de códigos de salida. Verificar: revisión del diff.
- [x] 2.7 `backend/scripts/verify-seed.ts`: si `parseSeedArgs` devuelve `overwrite: true`, sale con 1 y el mensaje de D5 (`--overwrite solo aplica a npm run seed: seed:verify no escribe.`). El resto no cambia: los conteos esperados y las comparaciones son los mismos. Verificar: `npm run seed:verify -- --overwrite` sale con 1 sin conectarse (salida en `verification/4.6-verify-overwrite.txt`) y revisión del diff.

## 3. Pruebas sin base (D7)

- [x] 3.1 `backend/test/seed-guard.spec.ts`:
  - `evaluateDefaultSeed`: todos los conteos en 0, con y sin `--overwrite` y en producción; una sola tabla con filas (`Experience`); cada fila de la tabla de D4; `SEED_ALLOW_PRODUCTION=1` fuera de producción, que se ignora.
  - `describePgDumpCommand`: sin contraseña, sin `schema`, con `sslmode`, puerto por defecto, sin usuario, host `.railway.internal`, URL ausente e ilegible.
  - Los textos completos de D8, con una fila con conteo 0 que no se lista.
  - Que ningún mensaje contenga la contraseña de la URL de prueba.

  Verificar: `npm test` verde, y que el test de la contraseña falla si se pasa la URL sin depurar.
- [x] 3.2 `backend/test/seed-runner.spec.ts`:
  - **Simulado:** el contador avanza solo con escrituras. `count` devuelve 0 y `findMany` devuelve `[]` por defecto. Una respuesta configurada que sea un `Error` rechaza la llamada.
  - **Instantánea:** `LEGACY_CALLS` y `LEGACY_SHA256` sin cambios, comparados contra `writes(calls)`. Además, las primeras 13 llamadas son los `count` en el orden de `SEED_CONTENT_TABLES` y la 14.ª es `profileView.deleteMany`.
  - **Test reemplazado:** *«no exige SEED_DISPOSABLE_DB ni consulta la base antes de escribir»* pasa a *«con la base vacía solo cuenta antes de escribir»*.
  - **Ids:** los tests del formato extendido derivan los ids del índice dentro de `writes(calls)`.
  - **Casos nuevos:**
    - Base con contenido sin flag: código 2, solo los 13 `count`, y el mensaje con destino, conteos, `pg_dump` y `--overwrite`.
    - `--overwrite` local: código 0, con las escrituras iguales a la instantánea.
    - Producción con la base vacía: código 0.
    - Producción con contenido, sin `--overwrite`, solo con `--overwrite` y solo con la variable: código 2 sin escrituras.
    - Producción con las dos llaves: código 0.
    - Un `count` que falla: código 1, sin escrituras, con el error en el mensaje y sin la contraseña.
    - Un test que compara `SEED_CONTENT_TABLES` con la secuencia de `deleteMany` (D1).
  - **`parseSeedArgs`:** `--overwrite`, `--overwrite=x`, y `--overwrite` con `--file` en los dos órdenes.
  - Los tests de `--file` mantienen sus expectativas.

  Verificar: `npm test` verde, y que la instantánea falla si se cambia el orden de dos `deleteMany` en `writeSeed` (prueba local, sin commitear).
- [x] 3.3 Lint y tipos: `npm run lint` y `npx tsc --noEmit -p tsconfig.json` (o el comando de tipos que use el CI del backend) sin errores. Verificar: salida limpia en el PR.

## 4. Evidencia contra bases descartables (nunca `portfolio`)

- [x] 4.1 Crear las bases y migrar solo la primera:

  ```powershell
  docker exec portfolio-postgres createdb -U portfolio portfolio_seed_guard
  docker exec portfolio-postgres createdb -U portfolio portfolio_seed_guard_nomig
  ```

  Después, con `DATABASE_URL` apuntando a `portfolio_seed_guard`: `npm run prisma:status` (debe nombrar `portfolio_seed_guard`) y `npm run prisma:deploy`. Verificar: salida en `verification/4.1-bases.txt`, con el `current_database()` de cada una.
- [x] 4.2 Escenarios locales sobre `portfolio_seed_guard`, con el código de salida después de cada comando (`$LASTEXITCODE`) y los conteos de `Profile`, `Experience`, `CuratedProfile` y `ProfileView` antes y después de cada negativa:
  1. `npm run seed` con la base vacía → 0.
  2. `npm run seed` otra vez → 2, con el texto de D8 completo y los conteos sin cambios.
  3. `npm run seed -- --overwrite` → 0 con el aviso de D3, y `npm run seed:verify` → 0.
  4. `npm run seed -- --overwrite --file ../docs/examples/cv-data.example.json` → 1 con el mensaje de D5.
  5. Opcional, si hay `pg_dump` en la máquina: ejecutar el comando sugerido por la negativa con `PGPASSWORD` definida en la sesión, para comprobar que libpq acepta la URI (D8), y borrar el `.dump` al terminar. Si no hay, ejecutarlo con `docker exec portfolio-postgres pg_dump "<uri con host localhost y puerto 5432>" -Fc -f /tmp/x.dump`.

  Verificar: salida en `verification/4.2-local.txt`.
- [x] 4.3 Escenarios de producción sobre `portfolio_seed_guard`, con `$env:NODE_ENV = "production"` solo en esta sesión:
  1. `npm run seed -- --overwrite` sin la variable → 2, con el mensaje de la variable faltante.
  2. `$env:SEED_ALLOW_PRODUCTION = "1"`; `npm run seed` sin `--overwrite` → 2.
  3. `npm run seed -- --overwrite` con las dos llaves → 0, con la marca de producción en el aviso, y `npm run seed:verify` → 0.
  4. Recrear la base vacía (`dropdb` + `createdb` + `prisma:deploy`) y correr `npm run seed` sin flags y sin la variable → 0.

  Al terminar, `Remove-Item Env:NODE_ENV, Env:SEED_ALLOW_PRODUCTION`. Si hay un proyecto de Railway de prueba (nunca el de producción con datos), comprobar además si `railway run` pasa una variable local al proceso, para resolver P1. Si no lo hay, dejar P1 abierta. Verificar: salida en `verification/4.3-produccion.txt`.
- [x] 4.4 Falla al contar sobre `portfolio_seed_guard_nomig` (sin migrar): `npm run seed -- --overwrite` → 1, el error nombra la tabla inexistente (*«The table `public.ProfileView` does not exist…»*) y dice «No se escribió nada.». La base sigue sin tablas. Verificar: salida en `verification/4.4-sin-migrar.txt`, con `\dt` vacío después.
- [x] 4.5 Comprobar que el ejemplo sigue funcionando sobre una base descartable (puede ser `portfolio_seed_guard` recreada): `SEED_DISPOSABLE_DB=1 npm run seed:example` dos veces → 0 y 0 (D5: sin cuenta de contenido). Verificar: salida en `verification/4.5-ejemplo.txt`.
- [x] 4.6 `npm run seed:verify -- --overwrite` → 1 sin conectarse (2.7). Después, borrar las dos bases (`docker exec portfolio-postgres dropdb -U portfolio portfolio_seed_guard` y lo mismo para `_nomig`) y confirmar con `\l` que `portfolio` sigue con sus conteos (solo lectura: `select count(*)` de `Profile` y `CuratedProfile`). Verificar: salida en `verification/4.6-verify-overwrite.txt`.

## 5. Documentación (sin tocar código)

- [ ] 5.1 `docs/DEPLOY.md`:
  - § 3 *Primer arranque*: el seed carga porque la base está vacía. Si ya tiene datos, se niega con código 2.
  - § 6, punto 3: la protección es real, y forzar en producción exige `--overwrite` y `SEED_ALLOW_PRODUCTION=1` solo para el comando, nunca en el servicio.
  - § 7: el `pg_dump` como paso previo a cualquier `--overwrite`, con el nombre `<base>-AAAA-MM-DD.dump` que sugiere la negativa.
  - Explicitar que el `preDeployCommand` solo migra y nunca siembra.

  Verificar: revisión del diff.
- [ ] 5.2 `docs/DEPLOY-RAILWAY.md`:
  - § 3: «una sola vez»; el seed se niega si ya hay datos.
  - Comando de recarga en producción, según la resolución de P1.
  - § 7: `pg_dump "$DATABASE_PUBLIC_URL"` antes de cualquier recarga.
  - *Nunca*: `SEED_ALLOW_PRODUCTION` como variable del servicio.

  Verificar: revisión del diff.
- [ ] 5.3 `docs/DATA-POPULATION.md`:
  - § 1 y § 3: el flujo «editás el JSON → corrés el seed» pasa a «base vacía o `--overwrite`».
  - § 8: comandos con `--overwrite`.
  - § 9: solución de problemas para el código 2 y para la falla al contar.
  - § 11: `--overwrite` no se combina con `--file`.
  - § 11.2: quitar la nota de que la protección «queda para un change aparte».

  Verificar: revisión del diff.
- [ ] 5.4 `backend/README.md`: la línea de `npm run seed` en *Puesta en marcha*, la fila de *Scripts* y la nota *Seed destructivo*. Verificar: revisión del diff.
- [ ] 5.5 `docs/MANUAL.md`:
  - § 0 y § 4 (*El seed ya no es la forma de editar*): la negativa y `--overwrite`.
  - Nuevo caso **TC-38 — El seed por defecto se niega sobre una base con contenido**, en el área de datos: precondición de base descartable, pasos en PowerShell y bash, resultado esperado y la salida de 4.2 transcrita.
  - Si `docs/manual/index.html` ya tiene el formato de `add-learning-guide-and-example-data` (D10, D13), sumar TC-38 también ahí, en el índice y en la tabla de la suite, para que `manual:check` siga en verde.

  Verificar: revisión del diff y, si existe, `npm run manual:check` en `frontend/`.
- [ ] 5.6 `CLAUDE.md`, *Comandos esperados*: la línea `npm run seed` pasa a decir que carga `docs/cv-data.json` solo sobre una base vacía, que con contenido se niega (código 2) salvo `--overwrite`, y que en producción además exige `SEED_ALLOW_PRODUCTION=1`. Al archivar, sumar el change al roadmap. Verificar: revisión del diff.
- [ ] 5.7 `docs/CHANGELOG.md`: entrada `protect-default-seed` con el comportamiento nuevo, los códigos de salida, `--overwrite`, `SEED_ALLOW_PRODUCTION` y la nota de operación (un `npm run seed` de rutina sobre una base con datos ahora sale con 2). Verificar: revisión del diff.

## 6. CI y cierre

- [ ] 6.1 `.github/workflows/ci.yml`, job *Backend · e2e contra Postgres*, después de `npm run test:e2e` y antes de los pasos de datos de ejemplo:
  - Paso *Seed por defecto · la negativa sobre una base con contenido*: `set +e; npm run seed; code=$?; [ "$code" -eq 2 ]`.
  - Paso *Seed por defecto · recarga con --overwrite*: `npm run seed -- --overwrite` y `npm run seed:verify`.

  El job `web-quality` no cambia: siembra una base recién migrada. Verificar: el job queda verde en el PR y su log muestra la negativa con los conteos y la recarga.
- [ ] 6.2 Validar:
  - `npx -y @fission-ai/openspec@1.14.1 validate protect-default-seed --strict` sin errores.
  - `validate --all --strict` sin fallas nuevas respecto de `main`. Las fallas previas por requisitos de más de 500 caracteres se reportan aparte.
  - Ningún aviso *Archive would refuse* para este change.
  - `npm test` en `backend/`.

  Verificar: salidas en `verification/6.2-validacion.txt`.
- [ ] 6.3 Archivar después de `add-learning-guide-and-example-data` (Migration Plan). Verificar: `openspec/specs/data-persistence-seed/spec.md` contiene *Negativa a sobrescribir una base con contenido* y las versiones nuevas de *Seed completo desde cv-data.json* y *Seed idempotente*.
