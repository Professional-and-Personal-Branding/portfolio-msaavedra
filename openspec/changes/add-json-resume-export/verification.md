# Verificación — add-json-resume-export

> Plan de verificación del change. Se completa al implementarlo, con la evidencia en `verification/`. Todas las escrituras van contra bases descartables (la del e2e y una sembrada con `seed:example`); la base `portfolio` del owner no se toca. Ninguna contraseña de prueba se imprime ni se escribe acá ni en `verification/`.

Estado: **propuesto** (2026-11-07). Rama `feat/json-resume-export`, desde `main` en `e337efd`.

## Resultado por tarea

| Tarea | Qué se comprueba | Resultado | Evidencia |
|---|---|---|---|
| 1.1 Punto de partida | Suites verdes, `perf:budget` y `Totals:` antes de tocar nada | pendiente | `1.1-punto-de-partida.txt` |
| 1.2 Schema | Copia byte a byte del tag `v1.0.0`, SHA-256 y licencia; supuestos de D4 confirmados | pendiente | `1.2-schema.txt` |
| 1.3–1.4 Validador | `ajv`/`ajv-formats` declarados sin paquetes nuevos; el helper acepta lo válido y rechaza `date: "2023"` y claves de raíz desconocidas | pendiente | `json-resume-validator` spec |
| 2.1–2.5 Mapper | Tabla de D4, regla de `sections`, orden de claves, sin vacíos ni extensiones | pendiente | `json-resume.mapper.spec.ts` |
| 3.1–3.5 Rutas | 200 válido por perfil e idioma; 404/401 como el detalle; alias; cabeceras; sin visita; panel con `PRIVATE` y paridad | pendiente | `3.5-e2e.txt` |
| 4.1–4.3 Contrato | Dos rutas en `openapi.json` y `api.d.ts`; sin `via`/`src` en la exportación; sin deriva | pendiente | test de OpenAPI y de deriva |
| 5.1–5.3 Constructor | Enlaces ES/EN, estados sin guardar y con cambios; `perf:budget` sin cambios | pendiente | `5.3-frontend.txt` |
| 6.1–6.3 Final y app real | Backend completo; TC-48 por Caddy y en Chrome; `manual:check` con un caso más | pendiente | `6.1-backend.txt`, `6.3-tc48.md` |
| 7.1 Cierre | `validate --all --strict` sin fallos ni «Archive would refuse» | pendiente | `7.1-validacion.txt` |

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

Ninguno todavía.
