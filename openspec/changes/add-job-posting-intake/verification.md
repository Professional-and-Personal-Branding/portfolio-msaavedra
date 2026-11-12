# Verificación — add-job-posting-intake

> Se completa al implementar el change, con la evidencia en `verification/`. Todas las escrituras fueron contra bases descartables propias (`portfolio_intake_e2e`, `portfolio_intake_check`); la base `portfolio` del owner no se tocó. Ninguna credencial figura en este archivo ni en `verification/`. **No se hizo ninguna petición a sitios de terceros.**

## Resultado por tarea

| Tarea | Qué se comprueba | Resultado | Evidencia |
|---|---|---|---|
| 1.1 Punto de partida | Suites verdes antes de tocar nada | ok: backend 126 suites / 1350 tests, e2e 20 / 338, frontend 74 archivos / 1136 | `verification/1.1-punto-de-partida.txt` |
| 2.1–2.8 Dominio | Vocabulario, política de URL, canónica, portales, ATS, términos, cobertura, texto pegado, HTML a texto, entidad y puertos | ok (specs en `domain/` y `shared/domain/`); `slugifyDraft` vive en `shared/domain` para que lo usen los dos módulos sin importarse | specs |
| 3.1 Migración | Solo `CREATE TYPE`, `CREATE TABLE`, índices; `migrate diff` sin diferencias | ok | `verification/3.1-migracion.sql` |
| 3.2 Persistencia | Repositorio y lector de vocabulario | ok, cubiertos por los e2e | e2e |
| 4.1 Cliente HTTP seguro | Guarda SSRF completa | ok: ver «Casos SSRF» | specs de `infrastructure/http/` |
| 4.2–4.5 Fuentes | Contrato y casos propios de Greenhouse, Lever, Ashby y JSON-LD con fixtures | ok (25 tests) | `sources.spec.ts` |
| 4.6 Documentación de los ATS | Rutas y variante EU | ok con dos formas supuestas (`createdAt` de Lever, `id` de Ashby) y la variante EU de Greenhouse no confirmada (cae al respaldo) | `verification/4.6-ats-docs.md` |
| 5.1–5.3 Aplicación | DTOs, casos de uso (a–f), puerto de lectura | ok (23 tests) | `job-posting.use-cases.spec.ts` |
| 6.1–6.2 HTTP y borrador | Controller con límite, módulo, caso de uso del borrador | ok (10 tests del borrador) | specs y e2e |
| 6.3 Arquitectura | Cuatro reglas con autocontrol | ok; con una sonda temporal el test falla | `verification/6.3-arquitectura.txt` |
| 6.4 Purga | Script y corrida con dos vencidas | ok: «purgado: 2», código 0, segunda corrida 0 | `verification/6.4-purga.txt` |
| 7.1–7.5 E2e | Importación, SSRF, límite, sugerencia, purga, borrador, sin rutas públicas | ok: 23 tests (e2e total 21 suites / 361) | `verification/7-e2e.txt` |
| 8.1 Contrato | Rutas, enums, 422 y 429 en `openapi.json`; `api.d.ts` regenerado | ok; el export es determinista | test de deriva |
| 9.1–9.3 Panel | Formulario Zod, pantalla, hooks, botón, arranque público | ok (29 tests nuevos); arranque público 150,1 KB, igual que `main` | `verification/9.3-perf-budget.txt` |
| 10.1 Entorno | API de la rama + imagen de `frontend/Dockerfile` con base descartable | ok | `verification/10.1-entorno.txt` |
| 10.2 TC-51 | App real: API y Chrome | **parcial (🔍)**: pasos 1 a 7 ejecutados; el paso con una URL pública real de un ATS no se ejecutó (sin peticiones a terceros) | `verification/10.2-tc51.txt` |
| 10.3 a11y | Tres entradas nuevas, móvil y escritorio | ok: 0 violaciones en 68 cargas (con panel) | `verification/10.3-a11y.txt` |
| 11.1–11.3 Docs | TC-51, B17, glosario, R1, captura, arquitectura y changelog; `manual:check` | ok: 49 casos alineados, 51 imágenes | `verification/11.2-captura.txt` |
| 11.4 Archivado | Línea del roadmap y fila de la propuesta | al archivar | — |
| 12.1 Cierre | Todo verde | ver `verification/12.1-cierre.txt` | |
| 12.2 Revisión de seguridad | Revisión independiente | **pendiente de la sesión principal** | — |
| 12.3 Validación OpenSpec | `validate --strict` | ver `verification/12.3-validacion.txt` | |
| 12.4 Base del owner | Sin la migración | ver `verification/12.4-base-del-owner.txt` | |

## Casos SSRF cubiertos (D7–D10) y su test

| Caso | Test |
|---|---|
| IP literal en todas sus formas (`127.0.0.1`, `2130706433`, `0x7f.1`, `0177.0.0.1`, `[::1]`, `[::ffff:127.0.0.1]`, con punto final) | `check-url-policy.spec.ts` (tabla), e2e 7.2 |
| `localhost`, `*.localhost`, `*.internal` (Railway), `*.local`, `*.lan`, `*.home.arpa`, `*.test`, sin punto | `check-url-policy.spec.ts`, e2e 7.2 |
| `http:`, esquemas ajenos, puerto 5432, `user:pass@`, 2049 caracteres | `check-url-policy.spec.ts`, e2e 7.2 |
| Primer y último valor de cada rango de D9 (IPv4 e IPv6), vecinos públicos | `address-policy.spec.ts` |
| Metadata `169.254.169.254` y `::ffff:169.254.169.254` | `address-policy.spec.ts`, `default-safe-http-client.spec.ts` |
| IPv4 mapeada en sus dos formas (`::ffff:a.b.c.d`, `::ffff:7f00:1`), NAT64, 6to4, ULA, link-local | `address-policy.spec.ts` |
| Nombre que resuelve a privada; una pública y una privada; sin IP en el mensaje | `default-safe-http-client.spec.ts`, e2e 7.2 |
| DNS rebinding: la IP validada es la del socket (el transporte conecta a `address`, sin segunda resolución) | `node-http-transport.spec.ts` («con una IP fijada…»), `default-safe-http-client.spec.ts` |
| Integración real: resolvedor a `127.0.0.1` y **0 conexiones** al servidor local | `node-http-transport.spec.ts` |
| Redirect a host privado, a `http:`, a `lnkd.in`, a IP literal y a nombre local: sin pedir el destino | `default-safe-http-client.spec.ts`, e2e 7.2 |
| Cuarto redirect, `Location` relativa, redirect sin `Location` | `default-safe-http-client.spec.ts`, e2e 7.2 |
| Portales cerrados (incluidos `www.linkedin.com`, `lnkd.in`, `ar.indeed.com`, `indeed.com.mx`, `glassdoor.co.uk`, `angel.co`) y negativos (`misindeedjobs.com`, `linkedin.com.acme-ejemplo.com`) sin DNS ni petición | `closed-portals.spec.ts`, e2e 7.2 |
| Tamaño: `Content-Length` grande (corta sin leer), sin `Content-Length`, gzip de 100 KB a 3 MiB | `node-http-transport.spec.ts` |
| Plazo: servidor que gotea (plazo total), servidor mudo (socket), resolvedor colgado | `node-http-transport.spec.ts`, `default-safe-http-client.spec.ts` |
| `Content-Type` (`application/pdf`, JSON vs HTML), 404/410, 5xx, errores sin cuerpo remoto ni IP | `default-safe-http-client.spec.ts`, e2e 7.2 |
| Sin `Cookie` ni `Authorization`, `GET`, cabeceras exactas, `Set-Cookie` ignorado | `node-http-transport.spec.ts` |
| Id de ATS con `../`, `%00` o fuera de `^[A-Za-z0-9._-]{1,100}$` | `match-ats-url.spec.ts` |
| Sin sesión: 401 y 0 peticiones; límite de 10 por minuto con 429 y `Retry-After` | e2e 7.1 y 7.3 |

## Desvíos y aclaraciones

- **Campo `referenceUrl`.** D6 llama `url` a la URL de referencia del texto pegado, pero el e2e y la spec exigen que `url` y `text` juntos den 400. El campo se llama `referenceUrl` (solo con `text`) y `url` queda para la URL a leer.
- **IPv4 antes que IPv6.** Cuando un nombre resuelve a direcciones públicas de las dos familias, el socket usa la IPv4 validada (no depende de que el servidor tenga ruta IPv6). Todas las direcciones se validan igual.
- **Variante EU de Greenhouse.** No figura en la documentación oficial: `GreenhouseSource` no la atiende y esa URL cae al respaldo JSON-LD (D3 lo prevé).
- **Cupo del límite en los e2e.** El límite (10 por minuto por IP) vive en la instancia del servidor y también cuenta las peticiones sin sesión; los e2e se reparten en bloques con su propia app para no gastar el cupo de otro.
- **`createTestApp(customize?)`.** `e2e-helpers.ts` acepta una función para sustituir proveedores (transporte, DNS, reloj); es compatible hacia atrás.
- **`slugifyDraft` en `shared/domain`** (no en `job-posting`): lo usan la sugerencia y el borrador, y la regla 3 de D19 impide que `curated-profile` importe del dominio de `job-posting`.

## Revisión de seguridad (12.2) y su resolución

- **ALTO — ReDoS cuadrático (corregido).** Las regex sobre el HTML remoto (`SCRIPT_BLOCK` del JSON-LD y las de `htmlToText`) bloqueaban el event loop. Antes, a 100 KB: `<a ` repetido 4212 ms, `<!--` sin cierre 3500 ms, `<script ` sin cierre 487 ms en el escáner de JSON-LD. Ahora, a 2 MiB: 13 ms, 1 ms y 11 ms (el resto, de 0 a 21 ms). Arreglo: entrada de `htmlToText` cortada a 100 000 caracteres, recorrido lineal con `indexOf`, etiquetas con `[^<>]*`, escáner de JSON-LD lineal que termina sin cierre y colapso de saltos de línea sin cuantificadores anidados. Test: `infrastructure/sources/redos.spec.ts` (2 MiB de `<a `, `<script`, `<!--`, `<style`, `<script>` y otros, en `htmlToText`, `extractLdJsonBlocks` y `JsonLdJobPostingSource.fetch`, todos < 500 ms) y los tests funcionales existentes sin cambios.
- **BAJO — título de un texto pegado sin `title`.** Es la primera línea del texto crudo: sobrevive a la purga y se copia al perfil. Se acepta; la pantalla lo aclara en el campo **Título**.
- **BAJO — purga sin cron.** Perezosa (listar, leer, importar); `npm run job-postings:purge` existe pero ningún cron lo corre. Pendiente para el deploy (cron de Railway).

## TC-51 — Crear un perfil desde una vacante

El texto completo del caso (precondición, pasos, resultado esperado, errores típicos, API y observado) está en `docs/MANUAL.md` (sección 3) y en `docs/manual/index.html`. Estado: **🔍**. Los pasos 1 a 7 se ejecutaron en la app real el 12 de noviembre de 2026; el paso 8 (URL pública real de un ATS) no, por no hacer peticiones a sitios de terceros: lo sustituyen los e2e (transporte y resolvedor falsos), los tests de cada fuente y el servidor `http` local del test del transporte.
