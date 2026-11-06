# Verificación — add-admin-password-change

> Plan de verificación del change. Se completa al implementarlo, con la evidencia en `verification/`, como en `add-certification-verification`. Todas las escrituras van contra bases descartables (la de e2e y `portfolio_pwd_check`); la base `portfolio` del owner no se toca. Ninguna contraseña de prueba se imprime ni se escribe en este archivo ni en `verification/`.

## Resultado por tarea

| Tarea | Qué se comprueba | Resultado | Evidencia |
|---|---|---|---|
| 1.1 Punto de partida | Suites verdes antes de tocar nada | ok — Backend: lint ok, 925 unit (94 suites), 250 e2e (14 suites). Frontend: 971 de 972 (1 timeout en frío que pasó solo). | `verification/1.1-punto-de-partida.txt` |
| 2.1–2.4 Dominio | `acceptsSession`, `validateNewPassword` (puntos de código, sin recorte), errores nuevos | ok — `admin-user.entity.spec`, `validate-new-password.spec`. | specs en `domain/` |
| 3.1–3.2 Esquema y migración | Un solo `ADD COLUMN ... DEFAULT 0`; escritura condicional por versión | ok — Un solo `ADD COLUMN`; `migrate diff` contra `portfolio_pwd_check`: sin diferencias; repositorio probado en el e2e. | `verification/3.1-migracion.sql` |
| 4.1–4.4 Aplicación y token | Claim `sv`; una sola verificación para guard, `/me` y visitas; caso de uso con repos simulados | ok — Casos de uso, estrategia, verificador y firmante con specs; una sola verificación (e2e de visitas). | specs de `application/` y `security/` |
| 5.1–5.3 Controller, límite y redacción | 200 con cookie nueva; contador propio; `currentPassword`/`newPassword` redactados | ok — `password-change-rate-limit.guard.spec`, `logger-redaction.spec`; `login-rate-limit.guard.spec` sin cambios. | specs de `security/` y `logger-redaction.spec.ts` |
| 6.1–6.5 E2e | Flujo completo con invalidación de la sesión vieja (cookie y Bearer), errores, límite, visitas, logs y bootstrap | ok — `admin-password.e2e-spec.ts`: 20 pruebas; suite e2e 270 en verde. | `verification/6-e2e.txt` |
| 7.1–7.4 Contrato y panel | `api.d.ts` sin deriva; pantalla Cuenta con mensajes literales; arranque público igual | ok — `api.d.ts` sin deriva; 21 pruebas nuevas; arranque público 150,1 KB gzip antes y después. | `verification/7.4-perf-budget.txt` |
| 8.1–8.4 App real | TC-45, `a11y:check` de Cuenta, logs sin contraseñas | parcial — Por la API, límite, `admin:bootstrap`, sesión revocada en Chrome, `a11y:check` (52 cargas, 0) y logs (0 coincidencias) ejecutados; los pasos del panel con contraseñas reales no se tipearon (regla de credenciales). | `verification/8.1-entorno.txt`, `8.2-tc45.txt`, `8.3-a11y.txt` |
| 9.1–9.5 Docs | TC-45, B14, deploy, changelog, `manual:check` | ok (9.5 al archivar) — `manual:check`: 44 casos; TC-45 en 🔍; B14, glosario, deploy y changelog. 9.5 queda para el archivado. | diff |
| 10.1–10.3 Cierre | Todo verde, validación estricta, base del owner intacta | parcial — 10.1 y 10.2 ok; 10.3: la lectura de `portfolio` no se hizo (ver evidencia). | `verification/10.1-cierre.txt`, `10.2-validacion.txt`, `10.3-base-del-owner.txt` |

## Resultados de la implementación (5 de noviembre de 2026)

- **Backend:** `lint`, `typecheck`, `build` y `openapi:export` sin deriva en verde; unit 955 (99 suites), e2e 270 (15 suites).
- **Frontend:** `lint`, `typecheck`, `build` en verde; 993 pruebas (66 archivos); `perf:budget` 150,1 KB (tope 155, igual que antes del change); `manual:check` con 44 casos.
- **OpenSpec:** `validate --all --strict`: `Totals: 40 passed, 0 failed`, sin «Archive would refuse».
- **TC-45:** por la API, todos los códigos esperados. Los pasos del panel que escriben contraseñas reales no se ejecutaron a mano (el brief prohíbe tipear credenciales en un navegador): el caso queda en 🔍. La revocación se comprobó en Chrome con el login por `fetch` y `admin:bootstrap` desde otro cliente.

### Desvíos respecto del diseño

1. **`useSession` oculta al administrador ante un 401 de `/me`** (no estaba en el diseño). D6 supone que `RequireSession` manda al login cuando `/me` vuelve 401, pero la caché conservaba el dato anterior y el panel seguía montado; TC-45 paso 7 no se cumplía. Lo detectó el test «sesión revocada»; con el arreglo, también se comprobó en Chrome.
2. **Mensajes de error de Cuenta con un tono propio** (`color-mix` entre `--color-destructive` y `--t-text`): `text-destructive` pesa 3,48:1 sobre la tarjeta del panel y axe lo marcó. El resto de los formularios del panel usa `text-destructive` y no se auditó con errores a la vista; queda como pendiente aparte.
3. **`a11y:check` suma `/admin/cuenta`** a las rutas del panel (52 cargas en lugar de 50).
4. **Núcleo del bootstrap en `scripts/lib/bootstrap-admin.ts`** para poder probarlo (6.5); el script lo usa.
5. **10.3 sin consulta a `portfolio`** (permiso denegado por la sesión).
6. En 8.2, la primera corrida del bloque de límite cayó dentro de la ventana de 60 s de la corrida anterior y dio 429 antes de tiempo; se repitió esperando.

## TC-45 — Cambiar la contraseña del panel

Texto del caso para `docs/MANUAL.md` (sección 3, al final de los casos del backoffice) y su espejo en `docs/manual/index.html`. Estado inicial al implementarlo: ✅ si se ejecuta completo en la app real (tarea 8.2); 🔍 si falta algún paso.

**Precondición:** base de ejemplo, **descartable** (nunca `portfolio`), con la API y el frontend levantados (de preferencia la imagen de `frontend/Dockerfile`). Un administrador de prueba creado con `npm run admin:bootstrap` y una contraseña aleatoria que solo vive en la terminal y en el gestor de contraseñas. Una segunda contraseña aleatoria para el cambio.

**Pasos (panel):**
1. En Chrome, entrá a `/admin` (sesión A). En una **ventana privada**, entrá también (sesión B).
2. En A, pulsá **Cuenta** en la barra superior.
3. En **Nueva contraseña** escribí 11 caracteres y pasá al campo siguiente.
4. Escribí una nueva válida y, en **Repetí la nueva contraseña**, otra distinta. Pulsá **Cambiar contraseña**.
5. Escribí una **Contraseña actual** incorrecta, la nueva y su repetición iguales, y pulsá **Cambiar contraseña**.
6. Corregí la **Contraseña actual** y pulsá **Cambiar contraseña**.
7. En B, abrí **Experiencias**.
8. En B, entrá con la contraseña anterior; después, con la nueva.
9. En A, recargá la página.

**Resultado esperado:**
1. Las dos sesiones llegan al Dashboard.
2. Se abre `/admin/cuenta` con el nombre y el email del administrador y el formulario **Cambiar contraseña**.
3. Se ve «Usá al menos 12 caracteres».
4. Se ve «Las contraseñas no coinciden» y no sale ninguna petición (pestaña Red).
5. Se ve «La contraseña actual no es correcta» y se sigue en Cuenta.
6. Aparece «Contraseña actualizada. Se cerraron las sesiones de otros dispositivos.» y los tres campos quedan vacíos.
7. B vuelve a `/admin/login`.
8. Con la anterior, «Email o contraseña incorrectos»; con la nueva, B entra al Dashboard.
9. A sigue en el panel sin pasar por el login.

**Errores típicos:** «La contraseña actual no es correcta» después de varios intentos puede pasar a «Demasiados intentos. Probá de nuevo en unos minutos.» (5 por minuto e IP, como el login). Los `curl` con un `TOKEN` sacado antes del cambio dan 401: volvé a hacer el login de § 0. Si perdiste la contraseña, la recuperación es `npm run admin:bootstrap` desde la terminal (también cierra todas las sesiones).

**Por la API** (Bash; las contraseñas en variables de la terminal, los cuerpos armados con `node` para no escribirlas en la línea de comandos):

```bash
API=http://localhost:3300
EMAIL=capture@example.com              # el del administrador de prueba
# OLD_PW y NEW_PW ya definidas en esta terminal, sin imprimirlas
login() { node -e "process.stdout.write(JSON.stringify({email:process.env.EMAIL,password:process.env[process.argv[1]]}))" "$1" \
  | curl -s -o /dev/null -w '%{http_code}\n' -c "$2" -H 'Content-Type: application/json' --data @- $API/api/auth/login; }
export EMAIL OLD_PW NEW_PW

login OLD_PW a.jar                                   # 200  sesión A
login OLD_PW b.jar                                   # 200  sesión B
cp a.jar a-vieja.jar

node -e "process.stdout.write(JSON.stringify({currentPassword:'incorrecta-de-prueba',newPassword:process.env.NEW_PW}))" \
  | curl -s -o /dev/null -w '%{http_code}\n' -b a.jar -H 'Content-Type: application/json' --data @- $API/api/auth/password   # 401
node -e "process.stdout.write(JSON.stringify({currentPassword:process.env.OLD_PW,newPassword:'corta'}))" \
  | curl -s -o /dev/null -w '%{http_code}\n' -b a.jar -H 'Content-Type: application/json' --data @- $API/api/auth/password   # 400
node -e "process.stdout.write(JSON.stringify({currentPassword:process.env.OLD_PW,newPassword:process.env.NEW_PW}))" \
  | curl -s -o /dev/null -w '%{http_code}\n' -b a.jar -c a.jar -H 'Content-Type: application/json' --data @- $API/api/auth/password  # 200

curl -s -o /dev/null -w '%{http_code}\n' -b a.jar        $API/api/auth/me   # 200  cookie nueva de A
curl -s -o /dev/null -w '%{http_code}\n' -b a-vieja.jar  $API/api/auth/me   # 401  cookie anterior de A
curl -s -o /dev/null -w '%{http_code}\n' -b b.jar        $API/api/auth/me   # 401  sesión B
login OLD_PW c.jar                                   # 401
login NEW_PW c.jar                                   # 200
rm -f a.jar a-vieja.jar b.jar c.jar
```

En `verification/8.2-tc45.txt` va solo la columna de códigos y, de las respuestas, las cabeceras con `Set-Cookie` redactado. Después se buscan los valores de `OLD_PW` y `NEW_PW` en el log de la API (`grep -cF -- "$OLD_PW"` y lo mismo con `NEW_PW`): ambos conteos tienen que ser 0.

**Captura:** `manual/bo-cuenta.jpg` (formulario con «Las contraseñas no coinciden», sin enviar nada), generada con `manual:capture` sobre la base de ejemplo.

## 8. App real: pasos de ejecución

1. Crear `portfolio_pwd_check` en el contenedor de `localhost:5434`, definir su `DATABASE_URL` en la terminal, `npm run prisma:status` (destino correcto), `npm run prisma:deploy` y `SEED_DISPOSABLE_DB=1 npm run seed:example`.
2. Generar `OLD_PW` y `NEW_PW` aleatorias en la terminal (18 bytes en base64url) y correr `ADMIN_EMAIL=capture@example.com ADMIN_PASSWORD="$OLD_PW" ADMIN_NAME=Captura npm run admin:bootstrap`.
3. Levantar la API de la rama (puerto 3310) y la imagen de `frontend/Dockerfile` apuntando a ella.
4. Correr el bloque **Por la API** y después los pasos del panel en Chrome (con otra pareja de contraseñas aleatorias, repitiendo el paso 2).
5. `A11Y_CHECK_DISPOSABLE_DB=1 npm run a11y:check -- <base>` con las credenciales de la terminal (tarea 8.3).
6. Bajar todo y borrar `portfolio_pwd_check` (tarea 10.3).
