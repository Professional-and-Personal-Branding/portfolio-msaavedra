# Verificación — add-json-resume-export

> Plan de verificación del change. Se completa al implementarlo, con la evidencia en `verification/`. Todas las escrituras van contra bases descartables (la del e2e y una sembrada con `seed:example`); la base `portfolio` del owner no se toca. Ninguna contraseña de prueba se imprime ni se escribe acá ni en `verification/`.

Estado: **implementado** (2026-11-07). Rama `feat/json-resume-export`, desde `main` en `e337efd`. Preguntas resueltas por el owner el 2026-11-07: P1 → A (certificaciones sin `date`), P2 → no (sin ruta fuera de `/api`).

## Resultado por tarea

| Tarea | Qué se comprueba | Resultado | Evidencia |
|---|---|---|---|
| 1.1 Punto de partida | Suites verdes, `perf:budget` y `Totals:` antes de tocar nada | **ok**: backend 99 suites / 972 tests, e2e 17 / 277, frontend 68 / 1041, `perf:budget` 148,9 KB (total 150,1), `Totals: 39 passed` | `1.1-punto-de-partida.txt` |
| 1.2 Schema | Copia byte a byte del tag `v1.0.0`, SHA-256 y licencia; supuestos de D4 confirmados | **ok**: SHA-256 `ff6e39e7…c27a6`, todos los supuestos de D4 confirmados; licencia MIT en `LICENSE.md` (el `package.json` del tag dice BSD-2-Clause) | `1.2-schema.txt` |
| 1.3–1.4 Validador | `ajv`/`ajv-formats` declarados sin paquetes nuevos; el helper acepta lo válido y rechaza `date: "2023"` y claves de raíz desconocidas | **ok**: el lockfile solo suma las dos declaraciones (`1.3-lockfile.txt`); 7 tests del helper | `json-resume-validator` spec |
| 2.1–2.5 Mapper | Tabla de D4, regla de `sections`, orden de claves, sin vacíos ni extensiones | **ok**: 21 tests del mapper y 18 de `parseProjectPeriod` (incluye los `period` del seed y del ejemplo) | `json-resume.mapper.spec.ts` |
| 3.1–3.5 Rutas | 200 válido por perfil e idioma; 404/401 como el detalle; alias; cabeceras; sin visita; panel con `PRIVATE` y paridad | **ok**: 8 tests de los casos de uso y 21 e2e | `3.5-e2e.txt` |
| 4.1–4.3 Contrato | Dos rutas en `openapi.json` y `api.d.ts`; sin `via`/`src` en la exportación; sin deriva | **ok**: 3 tests nuevos en `swagger.spec.ts`; `openapi.json` +252 líneas, `api.d.ts` regenerado, deriva del frontend verde | test de OpenAPI y de deriva |
| 5.1–5.3 Constructor | Enlaces ES/EN, estados sin guardar y con cambios; `perf:budget` sin cambios | **ok**: 4 tests nuevos; frontend 68 / 1045; `perf:budget` idéntico (148,9 KB; total 150,1) | `5.3-frontend.txt` |
| 6.1–6.3 Final y app real | Backend completo; TC-48 por Caddy y en Chrome; `manual:check` con un caso más | **ok con reservas**: backend 103 suites / 1029 tests, e2e 18 / 298, `openapi:export` sin deriva, `manual:check` 46 casos, `a11y:check` con panel 0 violaciones (56 cargas); los pasos del panel con sesión no se ejecutaron a mano (ver Desvíos) | `6.1-backend.txt`, `6.3-tc48.md` |
| 7.1 Cierre | `validate --all --strict` sin fallos ni «Archive would refuse» | **ok**: `Totals: 39 passed, 0 failed (39 items)` | `7.1-validacion.txt` |

## TC-48 — Exportar un perfil curado como JSON Resume (texto para el manual)

### TC-48 — Exportar un perfil curado como JSON Resume 🔍

**Precondición:** base de ejemplo **descartable** (nunca `portfolio`), con la API y el frontend levantados (de preferencia la imagen de `frontend/Dockerfile`, para que `/api/...` pase por Caddy). Sesión del panel con un administrador de prueba.

**Pasos (panel):**
1. En **Perfiles curados**, abrí `ejemplo-backend` y pasá a la pestaña **Publicación**.
2. Debajo de **Link público**, pulsá **ES** en «Descargar JSON Resume»; después, **EN**.
3. Cambiá el título del perfil sin guardar y volvé a **Publicación**.
4. Descartá el cambio. Abrí `ejemplo-borrador` (privado) y pulsá **ES**.
5. Volvé a la lista, pulsá **Nuevo perfil** y entrá a **Publicación** sin guardar.

**Resultado esperado:**
1. Se ve «Descargar JSON Resume» con los enlaces **ES** y **EN**.
2. Se descargan `ejemplo-backend.es.resume.json` y `ejemplo-backend.en.resume.json`. Abiertos, empiezan con `"$schema"` apuntando a `resume-schema/v1.0.0`, `basics.name` es el nombre del perfil de ejemplo, `work` tiene las mismas experiencias y en el mismo orden que la página `/ejemplo-backend`, y los textos están en el idioma de cada archivo.
3. Debajo de los enlaces se ve «Se exporta la última versión guardada».
4. Se descarga `ejemplo-borrador.es.resume.json`, aunque `/ejemplo-borrador` en el sitio da «no encontrado».
5. Los enlaces están deshabilitados y se ve «Guardá el perfil para exportarlo».

**Por la API** (Bash):

```bash
BASE=http://localhost:8080          # la imagen de frontend/Dockerfile; con Vite, http://localhost:5173
R=/api/curated-profiles
curl -s -o /dev/null -w '%{http_code}\n' "$BASE$R/all/resume.json"                                   # 200
curl -s -D - -o /dev/null "$BASE$R/ejemplo-backend/resume.json?lang=en" | grep -iE 'content-(type|disposition|language)|cache-control|x-robots'
#   application/json; charset=utf-8 · attachment; filename="ejemplo-backend.en.resume.json" · en · no-cache · noindex
curl -s -o /dev/null -w '%{http_code}\n' "$BASE$R/ejemplo-secciones/resume.json"                     # 200, sin basics.profiles (Presencia oculta)
curl -s -o /dev/null -w '%{http_code}\n' "$BASE$R/ejemplo-borrador/resume.json"                      # 404 (PRIVATE)
curl -s -o /dev/null -w '%{http_code}\n' "$BASE$R/ejemplo-archivado/resume.json"                     # 404 (archivado)
curl -s -o /dev/null -w '%{http_code}\n' "$BASE$R/ejemplo-protegido/resume.json"                     # 401
curl -s -o /dev/null -w '%{http_code}\n' "$BASE$R/ejemplo-protegido/resume.json?token=ejemplo-token-2026"   # 200, Cache-Control: private, no-store
curl -s -D - -o /dev/null "$BASE$R/ejemplo-nombre-anterior/resume.json" | grep -i content-location   # /api/curated-profiles/ejemplo-renombrado/resume.json
```

Antes y después de los `curl`, el contador de visitas de `ejemplo-backend` en **Perfiles curados** (o en el Dashboard) es el mismo: exportar no cuenta como visita.

**Errores típicos:** `/ejemplo-backend/resume.json` (sin `/api`) devuelve la página del sitio, no el JSON: la ruta es `/api/curated-profiles/<slug>/resume.json`. Un 401 en la descarga del panel indica que la sesión venció: volvé a entrar. El archivo no trae el año de las certificaciones (el formato pide una fecha completa que el panel no guarda; P1 de `design.md`).

## Desvíos

1. **Pasos del panel de TC-48 sin ejecutar a mano.** Pedían una sesión iniciada en el navegador y las credenciales de prueba no se escriben en un navegador. Se cubren con el test del constructor (`ProfileBuilderPage.test.tsx`), el e2e de la ruta del panel y el `curl` con la misma cookie; TC-48 queda en 🔍, como estaba previsto en este plan. En Chrome se comprobó lo que no pide sesión (la vista pública sin enlace y la descarga por `fetch`).
2. **Sin captura nueva en el manual.** Ni el change ni el diseño la exigen (el enlace es texto en una pestaña ya capturada) y no se regeneró `tc16-publicacion` con `manual:capture`.
3. **`a11y:check` no abre la pestaña Publicación.** La matriz recorre el constructor en su primera pestaña (0 violaciones, teclado ok); lo agregado vive en Publicación y se cubre con los tests del componente (roles, nombres accesibles y estados deshabilitados).
4. **Dos líneas de `Cache-Control` por el contenedor `web`.** El `Caddyfile` pone `no-cache` a todo lo que no sea `/assets/*` o `/fonts/*`, también a `/api/*`: un `PROTECTED` llega con `no-cache` y `private, no-store` (la segunda sigue presente, y lo mismo ocurre con el detalle desde antes). Directo contra la API la cabecera es la de D6. No se tocó el `Caddyfile` (D1 lo excluye); decidir si `/api/*` sale de `@noCache` queda para el owner.
5. **Discrepancia de licencia en el origen del schema.** `LICENSE.md` del tag es MIT y su `package.json` declara BSD-2-Clause; anotado en `SOURCE.md`. No cambia el uso (solo tests).
6. **`ajv` y `ajv-formats` con versión exacta** (`8.18.0` y `3.0.1`, como pide D9) en `devDependencies`; el `package-lock.json` solo suma las dos declaraciones. Además se agregó `json-resume-validator` al `testRegex` de Jest del backend para que corra su spec (vive en `test/`).
7. **Un test del frontend falló dos veces de forma intermitente** (una vez en el punto de partida y una al correr `ProfileBuilderPage` con la CPU compartida); repetidos, pasan. Sin relación con el change.
