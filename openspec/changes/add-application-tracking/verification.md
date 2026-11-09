# Verificación — add-application-tracking

> Plan de verificación del change. Se completa al implementarlo, con la evidencia en `verification/`, como en `add-admin-password-change`. Todas las escrituras van contra bases descartables (la de e2e y `portfolio_apps_check`); la base `portfolio` del owner no se toca. Ninguna credencial se imprime ni se escribe en este archivo ni en `verification/`.

## Resultado por tarea

| Tarea | Qué se comprueba | Resultado | Evidencia |
|---|---|---|---|
| 1.1 Punto de partida | Suites verdes antes de tocar nada | ok: backend 99 suites / 972 tests, e2e 17 / 277, frontend 1041, arranque 150.1 KB | `verification/1.1-punto-de-partida.txt` |
| 2.1–2.4 Dominio | `RuleViolationError` → 422; tabla de transiciones completa; reglas de campos y fechas | ok: 14 transiciones validas, 28 invalidas y 7 iguales (49 combinaciones), 422 en el mapper | specs de `domain/` y del mapper |
| 3.1–3.3 Esquema y migración | Migración solo aditiva; una consulta con `include`; `firstOpenedAt` en el mismo `groupBy` | ok: solo CREATE TYPE/TABLE/INDEX y FK; migrate diff sin diferencias con shadow descartable | `verification/3.1-migracion.sql` |
| 4.1–4.3 Aplicación | Casos de uso con repos simulados; una sola llamada de aperturas; CSV puro con neutralización | ok: una llamada de aperturas por lista; CSV con ida y vuelta RFC 4180 | specs de `application/` |
| 5.1 HTTP | Rutas, guard, validación y cabeceras del CSV | ok: cubierto por los e2e | e2e |
| 6.1–6.5 E2e | CRUD, 422, vínculos, aperturas humanas, CSV, sin rutas públicas | ok: 34 tests (18 suites / 311 en total) | `verification/6-e2e.txt` |
| 7.1 Contrato | `api.d.ts` sin deriva | ok: openapi.json sin deriva; api.d.ts regenerado | test de deriva |
| 8.1–8.6 Panel | Pantalla, diálogo, filtro en la URL, descarga, franja del dashboard, barra de ocho ítems, arranque público igual | ok salvo 8.5: la barra de ocho items se desborda en 1280 y 1536 y el plan de D11 (2xl) no lo resuelve; pendiente de decision (ver 8.5-barra.txt). Arranque publico 150.1 KB, igual | `verification/8.5-barra.txt`, `8.6-perf-budget.txt` |
| 9.1–9.3 App real | TC-46, CSV abierto en una planilla, `a11y:check` de la pantalla y del diálogo con errores | ok: TC-46 completo (API, 9 pasos en Chrome, CSV en Excel 16), a11y:check con panel 0 violaciones en 60 cargas | `verification/9.1-entorno.txt`, `9.2-tc46.txt`, `9.2-csv.png`, `9.3-a11y.txt` |
| 10.1–10.4 Docs | TC-46, pantalla Postulaciones, captura, arquitectura, changelog, `manual:check` | ok 10.1 a 10.3 (manual:check: 46 casos); 10.4 al archivar | diff, `verification/10.2-captura.txt` |
| 11.1–11.3 Cierre | Todo verde, validación estricta, base del owner intacta | ok: todo verde, validate --all --strict 39 passed, base del owner intacta | `verification/11.1-cierre.txt`, `11.2-validacion.txt`, `11.3-base-del-owner.txt` |

## TC-46 — Registrar una postulación y ver si abrieron el enlace

Texto del caso para `docs/MANUAL.md` (sección 3, al final de los casos del backoffice) y su espejo en `docs/manual/index.html`. Estado inicial al implementarlo: ✅ si se ejecuta completo en la app real (tarea 9.2); 🔍 si falta algún paso.

**Precondición:** base de ejemplo, **descartable** (nunca `portfolio`), con la API y el frontend levantados (de preferencia la imagen de `frontend/Dockerfile`) y sesión en el panel. El perfil `ejemplo-backend` tiene un enlace de seguimiento `MANUAL` activo (creálo en **Perfiles → ejemplo-backend → Publicación** con la etiqueta «Globex — RR. HH.» si no existe).

**Pasos (panel):**
1. Pulsá **Postulaciones** en la navegación.
2. Pulsá **Nueva postulación**, escribí `globex.example` en **URL de la vacante** y pulsá **Guardar** sin completar nada más.
3. Completá **Empresa** `Globex`, **Puesto** `Backend Senior`, **URL de la vacante** `https://globex.example/jobs/1`, **Estado** *Postulada*, **Perfil** `ejemplo-backend` y **Enlace** «Globex — RR. HH.». Pulsá **Guardar**.
4. En una **ventana privada** (sin sesión), abrí el link del enlace (`/ejemplo-backend?via=<código>`, copiálo desde **Publicación**). Volvé al panel y recargá **Postulaciones**.
5. Editá la postulación y abrí el selector **Estado**.
6. Elegí *En entrevistas* y guardá. Después elegí el filtro **Estado → En entrevistas** y recargá la página.
7. Pulsá **Exportar CSV** y abrí el archivo en una planilla.
8. Volvé al **Dashboard**.
9. Borrá la postulación y confirmá.

**Resultado esperado:**
1. Se abre `/admin/postulaciones` con el filtro **Activas** y, sin datos, «No hay postulaciones con este estado».
2. Se ven «Escribí la empresa», «Escribí el puesto» y «Usá una URL que empiece con http:// o https://», y no sale ninguna petición (pestaña Red).
3. Aparece «Postulación creada»; la fila muestra Globex, Backend Senior, *Postulada*, el portal del enlace si lo tiene, `ejemplo-backend`, «Sin abrir» y la fecha de hoy.
4. La fila pasa a «Abierto el <fecha de hoy>».
5. El selector ofrece solo *Postulada*, *En entrevistas*, *Oferta*, *Rechazada* y *Retirada*.
6. Aparece «Postulación actualizada»; la URL lleva `?estado=interviewing` y tras recargar el filtro sigue elegido y la fila sigue en la lista.
7. Se descarga `postulaciones-<fecha>.csv`; la planilla muestra las columnas Empresa, Puesto, Estado, …, Abierto el, Aperturas, Notas, Creada y Actualizada, con los acentos bien, y la fila de Globex con «En entrevistas».
8. La franja dice «Postulaciones activas: 1 · 1 en entrevistas» con el enlace **Ver postulaciones**.
9. Aparece «Postulación borrada» y la lista vuelve al estado vacío.

**Errores típicos:** «Ese enlace ya está asociado a otra postulación.»: el enlace ya está en otra fila; creá otro en **Publicación**. «Ese cambio de estado no está permitido. Elegí uno de la lista.»: otra pestaña cambió el estado antes; recargá. Si la visita del paso 4 no aparece, la abriste con la sesión del panel (cuenta como tuya, no como persona) o el enlace es `LINKEDIN_POST`. Si Excel muestra todo en una columna, importá con *Datos → Desde texto/CSV*, origen UTF-8 y delimitador coma.

**Por la API** (Bash; con la cookie de sesión de § 0 del manual en `s.jar`):

```bash
API=http://localhost:3300
PROFILE_ID=<id de ejemplo-backend>   # GET /api/admin/curated-profiles
LINK_ID=<id del enlace MANUAL>       # GET /api/admin/curated-profiles/$PROFILE_ID/share-links

curl -s -o /dev/null -w '%{http_code}\n' $API/api/admin/applications                       # 401  sin sesión
curl -s -o /dev/null -w '%{http_code}\n' $API/api/applications                             # 404  sin rutas públicas

ID=$(curl -s -b s.jar -H 'Content-Type: application/json' \
  -d "{\"company\":\"Globex\",\"role\":\"Backend Senior\",\"status\":\"APPLIED\",\"curatedProfileId\":\"$PROFILE_ID\",\"shareLinkId\":\"$LINK_ID\"}" \
  $API/api/admin/applications | node -pe 'JSON.parse(require("fs").readFileSync(0)).id')   # 201

curl -s -o /dev/null -w '%{http_code}\n' -b s.jar -X PATCH -H 'Content-Type: application/json' \
  -d '{"status":"ACCEPTED"}' $API/api/admin/applications/$ID                              # 422  APPLIED → ACCEPTED
curl -s -o /dev/null -w '%{http_code}\n' -b s.jar -X PATCH -H 'Content-Type: application/json' \
  -d '{"status":"INTERVIEWING"}' $API/api/admin/applications/$ID                          # 200
curl -s -o /dev/null -w '%{http_code}\n' -b s.jar -H 'Content-Type: application/json' \
  -d "{\"company\":\"Otra\",\"role\":\"X\",\"curatedProfileId\":\"$PROFILE_ID\",\"shareLinkId\":\"$LINK_ID\"}" \
  $API/api/admin/applications                                                              # 409  enlace repetido
curl -s -b s.jar $API/api/admin/applications/summary                                       # {"byStatus":{...,"INTERVIEWING":1,...},"active":1}
curl -s -D - -o postulaciones.csv -b s.jar "$API/api/admin/applications/export?status=INTERVIEWING"
# Content-Type: text/csv; charset=utf-8
# Content-Disposition: attachment; filename="postulaciones-AAAA-MM-DD.csv"
# Cache-Control: no-store
curl -s -o /dev/null -w '%{http_code}\n' -b s.jar -X DELETE $API/api/admin/applications/$ID  # 204
rm -f postulaciones.csv
```

En `verification/9.2-tc46.txt` va la columna de códigos y las cabeceras del export, sin la cookie.

**Captura:** `manual/bo-postulaciones.jpg` (lista con el filtro `Todas` y las tres postulaciones ficticias de D14), generada con `manual:capture` sobre la base de ejemplo.

## 9. App real: pasos de ejecución

1. Crear `portfolio_apps_check` en el contenedor de `localhost:5434`, definir su `DATABASE_URL` en la terminal, `npm run prisma:status` (destino correcto), `npm run prisma:deploy` y `SEED_DISPOSABLE_DB=1 npm run seed:example`.
2. Generar una contraseña aleatoria en la terminal (18 bytes en base64url) y correr `admin:bootstrap` con un email de prueba.
3. Levantar la API de la rama y la imagen de `frontend/Dockerfile` apuntando a ella.
4. Correr el bloque **Por la API** y después los pasos del panel en Chrome.
5. `A11Y_CHECK_DISPOSABLE_DB=1 A11Y_CHECK_PROFILE=ejemplo-backend npm run a11y:check -- <base>` con las credenciales de la terminal (tarea 9.3).
6. `MANUAL_CAPTURE_DISPOSABLE_DB=1 npm run manual:capture -- <base>` dos veces y contar las postulaciones (tarea 10.2).
7. Bajar todo y borrar `portfolio_apps_check` (tarea 11.3).
