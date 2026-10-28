# Design — protect-default-seed

## Context

Ver `proposal.md`. Estado verificado el 27 de octubre de 2026 en la rama `docs/learning-guide` (que trae `add-learning-guide-and-example-data` sin archivar):

- **Entrada.** `backend/scripts/seed.ts` parsea los argumentos (`parseSeedArgs`), lee el archivo (`readSeedFile`) y llama a `executeSeed(prisma, raw, { guarded: args.file !== undefined, env: process.env })`. Códigos: 0 ok, 1 fuente ausente o inválida, 2 negativa.
- **Orquestador.** `executeSeed` (`backend/scripts/lib/seed-runner.ts`) valida la fuente con `parseSeedSource` (código 1 sin tocar la base). Con `guarded` evalúa las capas 1 y 2 sin conectarse y la 3 con `profile.findMany`. Después llama a `writeSeed`, que empieza con 13 `deleteMany` en este orden: `profileView`, `curatedProfile`, `theme`, `skill`, `skillCategory`, `experience`, `language`, `profile`, `education`, `certification`, `project`, `socialLink`, `featuredRepository`. Sin `--file` no hay ninguna lectura antes del primer `deleteMany`.
- **Negativa de `--file`.** `backend/scripts/lib/seed-guard.ts` exporta `SEED_GUARD_EXIT_CODE = 2`, `describeDatabaseTarget` (`host:puerto/base` sin usuario ni contraseña), `evaluateEnvLayers`, `evaluateContentLayer`, `formatGuardFailure` (primera línea *«Negativa: …»*, una viñeta por motivo, cómo seguir y *«No se escribió nada.»*) y `loadExistingProfileNames`.
- **Tablas fuera de la limpieza.** `AdminUser` no se toca. `CuratedProfileSlugAlias` no tiene `deleteMany` propio: cae en cascada con su `CuratedProfile` (FK obligatoria con `onDelete: Cascade`), igual que `Language` con `Profile` y `Skill` con `SkillCategory`, aunque estas dos sí tienen `deleteMany` explícito.
- **Pruebas.** `backend/test/seed-runner.spec.ts` usa un cliente simulado (un `Proxy`) que registra cada llamada y devuelve `{ id: "<modelo>-<n>" }`, con `n` un contador que avanza en **todas** las llamadas, lecturas incluidas. La instantánea `LEGACY_CALLS = 79` / `LEGACY_SHA256` es el `sha256` de `JSON.stringify(calls)` del seed por defecto. Un test exige que `calls[0]` sea `deleteMany` y que no haya `findMany`. El helper `writes(calls)` ya filtra `findMany` y `count`.
- **Dónde corre el seed.** Local (`npm run seed`, con `DATABASE_URL` de `backend/.env` apuntando a la base del owner en `localhost:5434/portfolio`), `prisma migrate reset` (por `"prisma": { "seed": "tsx scripts/seed.ts" }` en `backend/package.json`, siempre sobre una base recién vaciada), el CI (job de e2e y job `web-quality`, ambos sobre una base recién migrada) y el primer arranque en Railway (`railway run npm run seed`, con las variables del servicio `api`, entre ellas `NODE_ENV=production`).
- **Deploy.** `backend/railway.json` tiene `"preDeployCommand": ["npm run prisma:deploy"]` y `"startCommand": "npm run start:prod"`. Ninguno corre el seed, y este change no lo cambia.
- **Specs vigentes.** `openspec/specs/data-persistence-seed/spec.md` dice que `npm run seed` SHALL cargar todo `cv-data.json` «sobre una base migrada» (*Seed completo desde cv-data.json*) y que ejecutarlo varias veces SHALL dejar la base igual porque «limpia y recarga» (*Seed idempotente*, con el escenario *Doble ejecución*). *Seed falla claramente sin esquema* exige código distinto de 0 y un error que mencione la tabla. El requisito *Seed por defecto sin cambios con el formato extendido* solo existe en el delta de `add-learning-guide-and-example-data`.

## Goals / Non-Goals

**Goals:** que `npm run seed` no pueda borrar contenido por accidente, ni local ni en producción; que el primer arranque siga siendo un solo comando sin flags; que la negativa diga exactamente qué se perdería y cómo respaldarlo; que forzar sea explícito y, en producción, doble; que con la base vacía el seed escriba byte a byte lo mismo que hoy.

**Non-Goals:** ver `proposal.md` § Non-goals.

## Decisions

### D1 — «Base con contenido»: alguna fila en cualquiera de las tablas que el seed limpia

Antes de escribir, el seed cuenta las filas de las **13 tablas que limpia**, en el mismo orden que sus `deleteMany`: `ProfileView`, `CuratedProfile`, `Theme`, `Skill`, `SkillCategory`, `Experience`, `Language`, `Profile`, `Education`, `Certification`, `Project`, `SocialLink` y `FeaturedRepository`. La base tiene contenido si **alguna** cuenta es mayor que cero. `AdminUser` no cuenta: el seed no la toca, y el primer deploy puede correr `admin:bootstrap` antes del seed sin que eso bloquee la carga.

- **Un `count()` por tabla, en secuencia.** Son 13 consultas triviales en un comando que se corre a mano. El orden fijo hace que el cliente simulado registre siempre la misma secuencia.
- **`CuratedProfileSlugAlias` no se cuenta:** no puede existir un alias sin su perfil curado (FK obligatoria), así que un alias implica una fila en `CuratedProfile`. Contarlo no cambiaría ninguna decisión.
- **Una sola lista.** `seed-guard.ts` declara `SEED_CONTENT_TABLES`: cada entrada lleva el nombre del modelo de Prisma (`'profileView'`), la etiqueta del mensaje (`'ProfileView'`, como en `seed:verify`) y la función de conteo. Un test compara esa lista con la secuencia de `deleteMany` del seed por defecto (mismo orden, mismos modelos). Si mañana se agrega una tabla a la limpieza y no a la lista, el test falla.

Alternativas descartadas:
- **Solo `Profile`** (como la capa 3 de `--file`). No ve el caso de un perfil base borrado desde la base que deja experiencias, perfiles curados y visitas. Tampoco el de un seed interrumpido a mitad de camino.
- **Solo las tablas «editables desde el panel».** `ProfileView` no se edita, pero es la analítica del owner y el seed la borra. `Theme` tampoco se edita desde el panel, pero el seed la vacía y recrea. El criterio que no envejece es «lo que el seed borraría».
- **Una sola consulta SQL con `UNION ALL`** (`$queryRaw`). Una ida a la base en lugar de 13, pero acopla el script a los nombres de tabla de Postgres y pierde el tipado del cliente. La diferencia de tiempo no importa en un comando manual.

### D2 — Orden de los pasos: validar, contar, decidir, escribir

Sin `--file`, `executeSeed` sigue este orden:

1. **Argumentos** (`parseSeedArgs`): `--overwrite` junto a `--file` es un error de uso (D5).
2. **Fuente:** lectura y `parseSeedSource`, como hoy. Una fuente inválida sale con 1 **sin ninguna llamada a la base**, ni siquiera de lectura. El test vigente (`calls` vacío) sigue valiendo.
3. **Conteos** (D1). Si alguno falla, código 1 (D6).
4. **Decisión** (D3, D4). Si se niega, código 2 y fin.
5. **Escritura** (`writeSeed`), sin cambios.

Con `--file` no se cuenta nada: siguen sus tres capas (D5).

Alternativa descartada: **contar antes de validar la fuente.** Ahorraría leer el JSON si la base tiene contenido, pero obligaría a reescribir el test de fuente inválida y a explicar dos errores a la vez. La validación no toca la base y es instantánea.

### D3 — Base vacía carga, base con contenido se niega, `--overwrite` fuerza (decisión del owner)

Con la base vacía, el seed carga sin flags ni variables, como hoy. Es el primer arranque local, el primer deploy y el seed automático de `prisma migrate reset`.

Con contenido y sin `--overwrite`, sale con `SEED_GUARD_EXIT_CODE` (2) y no escribe nada. Con `--overwrite` (fuera de producción, D4), escribe y antes deja en el log qué borra:

```
⚠️  --overwrite: se borra el contenido de localhost:5434/portfolio (ProfileView: 230, CuratedProfile: 14, Theme: 5, …).
```

- **No hay confirmación interactiva** (decisión del owner).
- **El seed no ejecuta `pg_dump` ni exige un respaldo** (decisión del owner): lo sugiere en la negativa (D8) y los docs lo recomiendan antes de `--overwrite`.
- **`--overwrite` sobre una base vacía** no es un error: carga igual y no deja aviso. Así un script puede pasarlo siempre sin distinguir los dos casos.
- **Argumento:** solo `--overwrite`, sin valor (`--overwrite=algo` es «argumento desconocido», código 1). Vale para un solo comando, como `--file` (`add-learning-guide-and-example-data`, D5). No hay variable de entorno equivalente que pueda quedar puesta en la terminal.

Alternativa descartada: **una variable `SEED_OVERWRITE=1`** en lugar del flag. Quedaría viva en la sesión de PowerShell, y el siguiente `npm run seed` borraría sin que nadie lo pidiera. Es el mismo argumento por el que `--file` no es `SEED_FILE`.

### D4 — Producción: `--overwrite` y `SEED_ALLOW_PRODUCTION=1` (decisión del owner)

Con `NODE_ENV=production` (comparación exacta, la misma de `evaluateEnvLayers`):

| Base | `--overwrite` | `SEED_ALLOW_PRODUCTION=1` | Resultado |
|---|---|---|---|
| vacía | — | — | carga (código 0) |
| con contenido | no | no o sí | negativa (2) |
| con contenido | sí | no | negativa (2) |
| con contenido | sí | sí | carga, con el aviso de D3 y la marca de producción |

- **La variable sola no autoriza nada:** sin `--overwrite`, la negativa es la misma. La variable confirma el entorno y el flag confirma la acción.
- **Fuera de producción** `SEED_ALLOW_PRODUCTION` se ignora.
- **El aviso en producción** suma la marca: `⚠️  --overwrite en producción (SEED_ALLOW_PRODUCTION=1): se borra el contenido de <destino> (…).`
- **El `preDeployCommand` no corre el seed.** `backend/railway.json` queda con `npm run prisma:deploy`. Un deploy nunca dispara una carga, y una carga en producción es siempre un comando manual (`railway run`). Los docs dicen que `SEED_ALLOW_PRODUCTION` se define solo para ese comando y **nunca** como variable del servicio `api`: si quedara en el servicio, la doble llave se reduciría a `--overwrite`.

Alternativa descartada: **prohibir siempre la recarga en producción** (como `--file`, capa 2). Restaurar desde `cv-data.json` sobre producción es raro pero legítimo, por ejemplo tras un primer deploy fallido a medias. Es justamente el caso que el owner quiere permitir con dos llaves.

### D5 — `--overwrite` y `--file` son incompatibles: código 1

`parseSeedArgs` rechaza la combinación con el mensaje:

```
❌ --overwrite no se combina con --file: un archivo alternativo tiene su propia negativa (ver docs/DATA-POPULATION.md § 11).
```

Sale con **código 1** (error de uso), antes de leer el archivo y sin conectarse a la base.

- **Ninguna capa de `--file` se saltea.** Las tres capas de `add-learning-guide-and-example-data` (D6) ya cubren su caso completo, incluida la recarga del mismo archivo sobre sí mismo. Un `--overwrite` que se aceptara y no hiciera nada haría creer a quien lo escribe que forzó algo. Fallar en voz alta es más claro.
- **Con `--file` no se aplica la negativa por defecto** (D1): la capa 3 ya mira el contenido, y el CI recarga el ejemplo dos veces sobre `portfolio_example` (idempotencia de `seed:example`) sin flags.
- **`seed:verify`** comparte `parseSeedArgs`, pero no escribe: si recibe `--overwrite`, sale con 1 y el mensaje `--overwrite solo aplica a npm run seed: seed:verify no escribe.`

Alternativa descartada: **aceptar `--overwrite` con `--file` e ignorarlo.** Es silencioso, y abre la puerta a que alguien lo lea como «saltea la capa 3» en una versión futura.

### D6 — Falla al contar: código 1 y nada borrado

Si cualquier `count()` lanza (la base no está migrada, `DATABASE_URL` ilegible o ausente, sin conexión, permisos), `executeSeed` lo atrapa, no llega a ningún `deleteMany` y sale con **código 1**:

```
❌ No se pudo comprobar si localhost:5434/portfolio tiene contenido: <mensaje del error de Prisma>
¿Aplicaste las migraciones? (npm run prisma:deploy)
No se escribió nada.
```

- **Código 1, no 2.** El 2 es una negativa deliberada sobre una base que se pudo leer. El 1 es «algo está mal con la base o la fuente», como hoy.
- **`--overwrite` no saltea los conteos.** Si no se puede contar, tampoco se podría borrar con sentido. Además, los conteos alimentan el aviso y la decisión de producción.
- **Compatibilidad con *Seed falla claramente sin esquema*.** Sobre una base sin tablas, el primer `count()` falla con el error de Prisma `P2021` (*«The table `public.ProfileView` does not exist in the current database.»*), que nombra la tabla. El requisito vigente se sigue cumpliendo, y ahora antes de cualquier escritura.
- **Credenciales.** El mensaje usa `describeDatabaseTarget`. El texto del error de Prisma no incluye la contraseña (nombra host y puerto). Un test lo comprueba con un error simulado.

Alternativa descartada: **tratar el error como «base vacía» y cargar.** Es exactamente el modo de falla que el change quiere evitar: un error transitorio no puede terminar en una recarga.

### D7 — Pruebas: el contador del simulado avanza solo con escrituras y el digest se calcula sobre ellas

Los conteos agregan 13 lecturas antes de la primera escritura. Con el simulado de hoy cambiarían dos cosas: la longitud de `calls` y, más sutil, **los ids devueltos** (`theme-93` en lugar de `theme-80`), que entran en los argumentos de los `create` siguientes (`themeId`, `includeIds`). Por eso cambiaría el digest aunque el seed escribiera lo mismo. Se ajusta así:

- **Simulado.** El contador avanza solo con métodos de escritura (`create`, `createMany`, `update`, `deleteMany`). Las lecturas devuelven la respuesta configurada o un valor neutro: `0` para `count` y `[]` para `findMany`. Una respuesta configurada que sea un `Error` hace que la llamada se rechace, para probar D6. Con esto, la secuencia de ids de las escrituras es la misma con o sin lecturas.
- **Instantánea.** `LEGACY_CALLS = 79` y `LEGACY_SHA256` **no cambian**. Se comparan contra `writes(calls)`, que ya existe y filtra `count` y `findMany`. Además se exige que `calls.slice(0, 13)` sean los 13 `count` en el orden de D1 y que ninguna escritura aparezca antes del último `count`. Con la base vacía, el seed escribe exactamente lo mismo que antes, en el mismo orden y con los mismos argumentos.
- **Test reemplazado.** *«no exige SEED_DISPOSABLE_DB ni consulta la base antes de escribir»* pasa a ser *«con la base vacía solo cuenta antes de escribir y no exige SEED_DISPOSABLE_DB»*: las primeras 13 llamadas son `count`, la 14.ª es `profileView.deleteMany` y no hay `findMany`.
- **Ids derivados del índice.** Los tests del formato extendido que calculan ids con `calls.indexOf(x) + 1` pasan a usar el índice dentro de `writes(calls)`. Es la misma regla del contador nuevo.
- **Los tests de `--file`** no cambian de expectativa: `['profile.findMany']` sigue siendo la única llamada cuando la capa 3 se niega.

Alternativa descartada: **regenerar la instantánea con las lecturas incluidas.** Se perdería la garantía de que la instantánea viene del script anterior al formato extendido: el digest nuevo solo probaría que el seed hace lo que hace hoy. Filtrar las lecturas conserva la comparación con el original.

### D8 — Texto de la negativa

Reutiliza la forma de `formatGuardFailure`: primera línea *«Negativa: …»* con el destino, viñetas con el motivo, cómo seguir y *«No se escribió nada.»*. Se imprime con `error()` y el prefijo `❌`. Las viñetas son solo las tablas con filas, en el orden de D1.

**Local, sin `--overwrite`:**

```
❌ Negativa: no se recarga docs/cv-data.json en localhost:5434/portfolio: la base ya tiene contenido.
  - ProfileView: 230
  - CuratedProfile: 14
  - Theme: 5
  - Skill: 108
  - SkillCategory: 12
  - Experience: 15
  - Language: 2
  - Profile: 1
  - Education: 6
  - Certification: 8
  - Project: 2
  - SocialLink: 3
Si querés conservarlo, respaldalo antes (pg_dump pide la contraseña):
  pg_dump "postgresql://portfolio@localhost:5434/portfolio" -Fc -f portfolio-2026-10-27.dump
Para borrarlo y recargar desde docs/cv-data.json: npm run seed -- --overwrite
No se escribió nada.
```

**Producción, sin `--overwrite`:** la primera línea termina en `la base ya tiene contenido (NODE_ENV=production).` y la línea de cómo forzar dice:

```
Para borrarlo y recargar en producción hacen falta las dos llaves: SEED_ALLOW_PRODUCTION=1, definida solo para este comando, y npm run seed -- --overwrite
```

**Producción, con `--overwrite` y sin la variable:** misma primera línea y la de cómo forzar dice:

```
--overwrite no alcanza con NODE_ENV=production: falta SEED_ALLOW_PRODUCTION=1, definida solo para este comando (nunca como variable del servicio).
```

**El comando `pg_dump`** se arma con `describePgDumpCommand(databaseUrl, now)` en `seed-guard.ts`:

- Es una URI de libpq **sin contraseña**: `postgresql://<usuario>@<host>:<puerto>/<base>`. El puerto por defecto es `5432` y se omite el usuario si la URL no lo trae.
- De la query string se conserva solo `sslmode`. Se descarta `schema=public`, que Prisma usa pero libpq rechaza (`invalid URI query parameter`), y cualquier otro parámetro de Prisma (`connection_limit`, …).
- El archivo es `<base>-AAAA-MM-DD.dump`, con la fecha local de `now`. Así no choca entre bases distintas.
- Si el host termina en `.railway.internal`, se agrega una línea: *«Esa dirección es la red privada de Railway: desde tu máquina usá DATABASE_PUBLIC_URL del servicio Postgres (docs/DEPLOY-RAILWAY.md § 7).»*
- Si la URL falta o no se puede leer, no se llega a la negativa (falla el conteo, D6). Igual, la función devuelve una indicación genérica que remite a `docs/DEPLOY.md` § 7, y un test la cubre.

El usuario sí aparece en el comando: el owner pidió omitir solo la contraseña, y sin usuario el comando no sirve tal cual. `describeDatabaseTarget` sigue sin mostrarlo en la primera línea, igual que en la negativa de `--file`.

Alternativa descartada: **`pg_dump -h … -p … -U … -d …` con flags separados.** Funciona, pero `sslmode` habría que pasarlo por `PGSSLMODE`, con sintaxis distinta en PowerShell y en bash. La URI entre comillas es la misma en las dos.

### D9 — Requisitos vigentes: dos MODIFIED y un ADDED

- **ADDED** *Negativa a sobrescribir una base con contenido*, con un escenario por caso de D3 a D6.
- **MODIFIED** *Seed completo desde cv-data.json*: la carga se promete sobre una base migrada **sin contenido** (o con `--overwrite`). Sin el cambio, el requisito vigente («SHALL cargar … sobre una base migrada») contradiría la negativa.
- **MODIFIED** *Seed idempotente*: la doble ejecución pasa a ser `npm run seed` seguido de `npm run seed -- --overwrite`, con los mismos conteos. Un segundo `npm run seed` a secas se niega y tampoco cambia la base, así que el estado final sigue siendo el mismo.
- *Seed falla claramente sin esquema* **no cambia** (D6 lo sigue cumpliendo).
- *Seed por defecto sin cambios con el formato extendido* (delta de `add-learning-guide-and-example-data`) **no se toca**: un MODIFIED sobre él haría que el archivado se niegue, porque `openspec/specs` todavía no lo tiene. No hay contradicción: ese requisito compara el resultado antes y después del formato extendido sobre una base cargable, no exige `SEED_DISPOSABLE_DB`, y este change tampoco lo exige.

## Risks / Trade-offs

- **Un `npm run seed` de la rutina local deja de funcionar** (el owner o un script lo corrían sobre una base con datos) → es el objetivo. La negativa dice cómo forzar en una línea, y el CHANGELOG y `CLAUDE.md` lo anuncian.
- **`--overwrite` se vuelve un reflejo** («siempre lo paso») → la negativa muestra qué se perdería con conteos concretos y el `pg_dump`. En producción hace falta una segunda llave que no puede quedar puesta en el servicio sin que los docs lo prohíban explícitamente.
- **`SEED_ALLOW_PRODUCTION=1` cargada como variable del servicio `api`** → la doble llave se reduce a `--overwrite`. Los docs de Railway lo prohíben y la negativa lo repite. El seed no puede distinguir una variable de servicio de una de la terminal.
- **`railway run` y las variables locales** → la doble llave asume que una variable definida en la terminal llega al proceso que lanza `railway run`. La tarea 4.3 lo comprueba antes de escribir el comando definitivo en `DEPLOY-RAILWAY.md` (P1).
- **Ventana entre contar y borrar** (alguien guarda desde `/admin` en ese instante) → se acepta. El seed no es transaccional hoy, y la ventana es de milisegundos en un comando manual. Envolver conteo y limpieza en una transacción queda fuera de alcance.
- **El digest de la instantánea se rompe por un detalle del simulado** → D7 ajusta el simulado y deja `LEGACY_CALLS`/`LEGACY_SHA256` intactos. Si alguno tuviera que cambiar, sería señal de que el seed por defecto escribe otra cosa, y eso bloquea.
- **Implementarlo antes de fusionar `add-learning-guide-and-example-data`** → `seed-guard.ts`, `seed-runner.ts` y el simulado no existirían. La tarea 1.1 lo verifica primero.

## Migration Plan

No hay migración de esquema ni de datos.

1. Fusionar `add-learning-guide-and-example-data`, al menos sus grupos 1 a 3 (seed y guard).
2. Implementar este change encima: guard, runner, tests y CI en un PR. Los docs pueden ir en el mismo PR.
3. Archivar después de `add-learning-guide-and-example-data`. Si ese change se archiva antes, sus requisitos ya estarán en `openspec/specs` y este delta no los toca, así que el orden de archivado no genera conflictos.

**Rollback:** revertir el PR. El seed vuelve a recargar sin preguntar. Ningún dato cambia por el revert.

## Open Questions

- **P1 — `railway run` y una variable definida en la terminal. [no bloqueante]** ¿El comando de producción documentado es `SEED_ALLOW_PRODUCTION=1 railway run npm run seed -- --overwrite`? Depende de que `railway run` pase las variables locales al proceso, además de las del servicio.
  - (a) Si las pasa, ese es el comando.
  - (b) Si no las pasa, `railway run -- sh -c 'SEED_ALLOW_PRODUCTION=1 npm run seed -- --overwrite'`.

  *Recomendación:* decidir con la evidencia de la tarea 4.3, sin el owner. No afecta al código, solo al texto de `DEPLOY-RAILWAY.md`.
- **P2 — `railway run npm run seed` y la `DATABASE_URL` privada. [no bloqueante, previa a este change]** `docs/DEPLOY-RAILWAY.md` § 2 define `DATABASE_URL=${{Postgres.DATABASE_URL}}`, que apunta a la red privada (`*.railway.internal`), y el § 3 corre el seed con `railway run` desde la máquina local. No está verificado que esa dirección resuelva desde fuera. El § 7 ya usa `DATABASE_PUBLIC_URL` para `pg_dump`.
  - (a) Documentar el primer arranque con `DATABASE_URL="$DATABASE_PUBLIC_URL"` para el comando.
  - (b) Correr el seed dentro del contenedor (`railway ssh` o una shell del servicio).
  - (c) Dejarlo como está hasta el primer deploy y verificarlo ahí.

  *Recomendación:* (c), y anotarlo en `docs/RELEASE-1.0.0-CHECKLIST.md`. Se reporta aparte porque no es un efecto de este change. D8 ya agrega la pista de `DATABASE_PUBLIC_URL` al `pg_dump` sugerido.
