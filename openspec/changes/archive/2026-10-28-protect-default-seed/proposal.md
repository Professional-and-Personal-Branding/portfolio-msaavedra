# protect-default-seed — El seed por defecto no pisa una base con contenido

> Iteración posterior a la ronda 1.1. Sale de la pregunta P5 de `add-learning-guide-and-example-data`, que el owner resolvió el 2026-10-27 dejando la protección del seed por defecto para un change aparte. No abre una fase nueva de `docs/SPECS-POR-FASE.md`: endurece el seed de la Fase 1 (`add-backend-base`) para el uso real de la Fase 5 en adelante, cuando todo el contenido se edita desde `/admin`.
>
> **Depende de `add-learning-guide-and-example-data`** (sin archivar ni fusionar al 2026-10-27): reutiliza `backend/scripts/lib/seed-guard.ts`, `seed-runner.ts` y el cliente de Prisma simulado de `backend/test/seed-runner.spec.ts`, que nacen en ese change. Se implementa encima de esa rama y se archiva después de él.

## Why

Desde `add-profile-content-admin` todo lo que el sitio muestra se edita en el panel, y la base pasa a ser la fuente de verdad del contenido. El seed, en cambio, sigue tratando `docs/cv-data.json` como la fuente:

1. **`npm run seed` borra sin preguntar.** Sin `--file`, `executeSeed` (`backend/scripts/lib/seed-runner.ts`) valida el archivo y pasa directo a `writeSeed`, que hace `deleteMany` sobre las 13 tablas del contenido y recarga. Correrlo sobre la base del owner, o con `railway run` sobre producción, pisa la portada, las experiencias, los perfiles curados y las visitas.
2. **La única protección es documental.** `docs/DEPLOY.md` § 6, `docs/DEPLOY-RAILWAY.md` § 3 y *Nunca*, `docs/DATA-POPULATION.md` § 3 y § 11.2, `backend/README.md` y `docs/MANUAL.md` § 4 repiten «no lo corras sobre datos reales». Un comando que se escribe de memoria, o que queda en el historial de la terminal, no lee esas advertencias.
3. **`--file` ya está protegido; el comando más peligroso no.** `add-learning-guide-and-example-data` (D6) se niega a cargar un archivo alternativo sobre una base que no sea descartable, pero dejó `npm run seed` a secas como estaba (su P5).

## What Changes

- **Negativa del seed por defecto (D1–D4).** Antes de cualquier `deleteMany`, `npm run seed` cuenta las filas de cada tabla que el seed limpia. Si todas están en cero, carga como hoy, sin flags (primer arranque local, primer deploy, `prisma migrate reset`). Si alguna tiene filas, sale con **código 2** y no escribe nada. El mensaje muestra el destino sin credenciales, los conteos por tabla, el `pg_dump` sugerido para ese destino (sin la contraseña), cómo forzar la recarga y que no se escribió nada.
- **`--overwrite` explícito (D3).** `npm run seed -- --overwrite` recarga aunque haya contenido. No hay confirmación interactiva. El seed no ejecuta ni exige `pg_dump`: lo recomienda.
- **Producción (D4).** Con `NODE_ENV=production` y la base vacía, carga. Con contenido, además de `--overwrite` exige `SEED_ALLOW_PRODUCTION=1`. El `preDeployCommand` de `backend/railway.json` sigue siendo solo `npm run prisma:deploy`: el seed nunca corre en un deploy.
- **`--overwrite` con `--file` es un error de uso (D5):** código 1, antes de leer el archivo o conectarse. El archivo alternativo conserva sus tres capas sin atajos.
- **Falla al contar (D6):** si alguna consulta de conteo falla (base sin migrar, sin conexión), el seed sale con código 1, muestra el error y no borra nada.
- **Pruebas sin base (D7):** el cliente de Prisma simulado deja de avanzar su contador con las lecturas, y la instantánea `LEGACY_CALLS`/`LEGACY_SHA256` se calcula sobre las escrituras. Con la base vacía, el seed escribe exactamente lo mismo que antes.
- **`seed:verify` rechaza `--overwrite`** con código 1: no escribe, así que el flag no tiene sentido ahí.
- **CI:** en el job de e2e, un segundo `npm run seed` sobre la base ya sembrada exige el código 2 y `npm run seed -- --overwrite` seguido de `seed:verify` cubre la recarga.
- **Docs:** `docs/MANUAL.md` (TC-38), `docs/DEPLOY.md` (§ 3 *Primer arranque*, § 6 y § 7), `docs/DEPLOY-RAILWAY.md`, `docs/DATA-POPULATION.md`, `backend/README.md`, la cabecera de `backend/scripts/seed.ts`, la línea de `npm run seed` en `CLAUDE.md` y `docs/CHANGELOG.md`.

## Non-goals

- Ejecutar `pg_dump` desde el seed o exigir un respaldo previo. Decisión del owner (2026-10-27): `--overwrite` alcanza.
- Confirmación interactiva (`¿Seguro? [s/N]`). Decisión del owner: rompe el uso en CI y en scripts.
- Cambiar las tres capas de `--file` (`add-learning-guide-and-example-data`, D6) o el formato de `docs/cv-data.json`.
- Un seed incremental o de fusión (agregar lo nuevo del JSON sin borrar lo editado). El seed sigue siendo «todo o nada».
- Correr el seed en el `preDeployCommand` o en el arranque de la API.
- Proteger `prisma migrate reset`, `dropdb` u otras herramientas que ya son destructivas por sí mismas.
- Cambios en `backend/src`, `backend/prisma`, el OpenAPI o el frontend.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `data-persistence-seed`: suma *Negativa a sobrescribir una base con contenido* (ADDED) y modifica *Seed completo desde cv-data.json* y *Seed idempotente* (MODIFIED), que hoy prometen cargar y recargar sobre cualquier base migrada.

## Impact

- **Backend (`backend/scripts/`, tooling; no `src/`):** `lib/seed-guard.ts` (tablas del contenido, conteos, evaluación de la negativa por defecto, comando `pg_dump` sin contraseña y su mensaje), `lib/seed-runner.ts` (`--overwrite` en `parseSeedArgs`, conteos antes de escribir en el modo por defecto), `seed.ts` (cabecera y paso del flag) y `verify-seed.ts` (rechaza `--overwrite`). Sin dependencias nuevas.
- **Tests (Jest, sin base):** `backend/test/seed-guard.spec.ts` y `backend/test/seed-runner.spec.ts` (cliente simulado y digest sobre escrituras).
- **CI (`.github/workflows/ci.yml`):** dos pasos en el job *Backend · e2e contra Postgres*. El job `web-quality` no cambia: siembra una base recién migrada.
- **Operación:** quien hoy corra `npm run seed` sobre una base con datos recibe código 2 en lugar de la recarga. Es el comportamiento buscado; los docs muestran `--overwrite` y, en producción, `SEED_ALLOW_PRODUCTION=1`.
- **Docs:** los listados en *What Changes*.
