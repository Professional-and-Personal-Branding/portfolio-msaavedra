# DEPLOY — Guía definitiva (Railway)

> Diez pasos, en orden, para seguir con el panel de Railway abierto. **El detalle y el por qué están en [`DEPLOY.md`](DEPLOY.md)**: cada paso indica entre paréntesis la sección a la que ir si algo no cierra.
>
> La configuración de build ya está versionada (`backend/railway.json`, `frontend/railway.json`, `frontend/Dockerfile`, `frontend/Caddyfile`). **En el panel se cargan variables, la ruta del archivo de configuración y el dominio.**
>
> Decisiones tomadas: plan **Hobby**; dominio **gratuito `mjsaavedra.is-a.dev`** para la 1.0.0 (subdominio de [is-a.dev](https://docs.is-a.dev), que se pide con un PR a su repositorio en GitHub); la compra de un dominio propio queda para después (ver [«Dominios candidatos»](#dominios-candidatos)). `FRONTEND_URL` se completa en el paso 6. El dominio no está escrito en ningún archivo del código: si después se cambia por otro, alcanza con el procedimiento de [«Cambiar de dominio»](#cambiar-de-dominio). Comandos para **PowerShell**; los `curl` se escriben `curl.exe` para no chocar con el alias de PowerShell.

**Arquitectura:** tres servicios en un proyecto. `web` (Caddy) sirve la SPA y hace de **proxy** de `/api/*`, `/health*`, `/robots.txt` y `/sitemap.xml` hacia `api` por la red privada. Un solo origen → cookie `SameSite=strict`, sin CORS, `VITE_API_URL` vacío. (§ 0, § 9.5)

```
navegador → [web: Caddy] ──/api/*──▶ [api: NestJS] ──privada──▶ [Postgres]
                   └── todo lo demás → dist/ con fallback a index.html
```

---

## 0. Antes de empezar

- [ ] Cuenta de Railway con el plan **Hobby** (USD 5 incluidos; el costo es por uso).
- [ ] El repositorio conectado a Railway (GitHub) y `main` al día con este cambio.
- [ ] En tu máquina: Node 22, `git`, **Docker** (para la prueba de restauración del paso 9) y el `.env` de `backend/` apuntando a **tu base local**, nunca a producción.
- [ ] Un gestor de contraseñas abierto: ahí van los secretos del paso 1.
- [ ] Cuenta de GitHub para pedir `mjsaavedra.is-a.dev` (paso 6). Mientras el PR de is-a.dev no esté aprobado, los pasos 1 a 5 y 7 se pueden hacer con el dominio `*.up.railway.app` del servicio `web`; el paso 6 y el `FRONTEND_URL` definitivo quedan para cuando exista.

---

## 1. Secretos (§ 1)

Pegá la función en PowerShell y generá los tres valores. Cada uno va **directo al gestor de contraseñas**; no los pegues en ningún archivo del repo.

```powershell
function New-Secret([int]$Bytes) {
  $b = [byte[]]::new($Bytes)
  $g = [Security.Cryptography.RandomNumberGenerator]::Create()
  $g.GetBytes($b); $g.Dispose()
  [Convert]::ToBase64String($b)
}

New-Secret 48   # JWT_SECRET       (64 caracteres; mínimo exigido: 32)
New-Secret 32   # ANALYTICS_SALT   (distinta del JWT_SECRET)
New-Secret 24   # contraseña del administrador (ADMIN_PASSWORD en el paso 4)
```

La contraseña de `admin:bootstrap` puede ser la de siempre, pero conviene cambiarla después desde **Cuenta** en el panel (`/admin/cuenta`); `admin:bootstrap` queda como recuperación.

En producción la API **no arranca** si el `JWT_SECRET` es el del `.env.example`, tiene menos de 32 caracteres, coincide con `ANALYTICS_SALT`, o si `FRONTEND_URL` no usa https.

---

## 2. Proyecto y Postgres (§ 7, § 9.5)

- [ ] New Project → **New → Database → PostgreSQL**.
- [ ] Pestaña **Backups**: activar el esquema **diario (6 días) + semanal (1 mes) + mensual (3 meses)**. Ahora, no después.
- [ ] Anotar la **versión mayor de Postgres** del servicio (la muestra `select version();`): la necesitás en el paso 9 para usar la misma imagen `postgres:<N>-alpine`. Versión: `____`.

---

## 3. Servicio `api` (§ 9.5)

- [ ] New → GitHub Repo → **Settings → Root Directory: `backend`**.
- [ ] **Settings → Config-as-code → Config file path: `/backend/railway.json`**. Es una ruta **absoluta desde la raíz del repo**: el Root Directory no la reubica, y con `railway.json` a secas Railway no encuentra el archivo y usa sus valores por defecto (build sin `prisma generate`, sin pre-deploy ni healthcheck).
- [ ] No tocar Build / Start / Pre-deploy / Healthcheck: los toma de `backend/railway.json` (`buildCommand` con `prisma generate`, `startCommand: node dist/main`, `preDeployCommand`, `preDeployTimeoutSeconds: 300`, `healthcheckPath: /health`, `drainingSeconds: 10`). Comprobá en el panel que esos campos figuren como definidos por el archivo y que el **Pre-deploy Timeout** diga `300`.
- [ ] **App Sleeping apagado** (Settings → Serverless). Si el servicio durmiera, la primera visita del día pagaría el arranque.
- [ ] Variables → Raw Editor, pegar y completar:

```ini
NODE_ENV=production
PORT=8080
DATABASE_URL=${{Postgres.DATABASE_URL}}
JWT_SECRET=<paso 1>
JWT_EXPIRES_IN=1d
ANALYTICS_SALT=<paso 1>
SESSION_COOKIE_SAMESITE=strict
LOG_LEVEL=info
THROTTLE_TTL=60
THROTTLE_LIMIT=120
THROTTLE_LOGIN_LIMIT=5
FRONTEND_URL=https://mjsaavedra.is-a.dev
```

- **`FRONTEND_URL`** lleva el dominio real, que se completa en el paso 6. La API en producción exige un valor https; si querés probar antes de tener dominio, poné provisoriamente `https://<dominio-up.railway.app-de-web>` y reemplazalo en el paso 6.
- **No** definir `ENABLE_API_DOCS` (Swagger queda cerrado), **ni** `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME` (viven solo en la terminal del paso 4), **ni** `SEED_ALLOW_PRODUCTION`.
- El drenaje de 10 s ya está versionado (`drainingSeconds`); la variable `RAILWAY_DEPLOYMENT_DRAINING_SECONDS` solo hace falta para pisarlo desde el panel. La API espera hasta 5 s a registrar las visitas en vuelo al apagarse.
- [ ] Deploy.

**Cómo verificar el deploy** (pestaña Deployments → logs):

1. En el **build**: aparece `prisma generate` (“Generated Prisma Client”) y después `nest build`, sin errores de TypeScript.
2. En el **pre-deploy**: `prisma migrate deploy` aplica las **4 migraciones** (`init`, `curated_profile_lifecycle`, `retire_accent_color`, `localize_language_level`).
3. El **healthcheck** `/health` pasa y la versión entra. En los logs, JSON con `reqId`, sin contraseñas ni tokens.

**Si falla:**

- *Build: TypeScript no encuentra tipos de `@prisma/client`* → el `buildCommand` no es el del archivo: el Config file path está mal (arriba).
- *Pre-deploy: error de conexión* → `DATABASE_URL=${{Postgres.DATABASE_URL}}` mal escrita, o el servicio de base con otro nombre en el canvas.
- *Arranque o pre-deploy: error de Prisma sobre `libssl`/OpenSSL o “query engine” no encontrado* → **a verificar**: sería que la imagen de runtime no trae la biblioteca que necesita el motor de Prisma. No definas variables a ciegas: copiá el mensaje exacto del log, buscalo en la documentación de Railpack y de Prisma y, si no se resuelve, frená y consultalo antes de seguir.
- *El log habla de un secreto* → validación de arranque (§ 1).
- *“healthcheck failed”* → la base no responde (`/health` devuelve 503 a propósito) o `PORT` distinto de `8080`.
- Una migración que falla **detiene el deploy y la versión vieja sigue sirviendo**: ver *Si algo falla* al final.

> Las migraciones `retire_accent_color` y `localize_language_level` son inocuas sobre una base **vacía** (este primer deploy). Si algún día un deploy las aplica sobre una base con datos, hacé un respaldo antes (§ 9.5).

- [ ] Opcional: **Settings → Networking → Generate Domain** en `api`, para mirar la API cruda en el paso 7. Se puede borrar después.

---

## 4. Primer poblado y administrador — desde tu máquina (§ 3)

Se hace **una sola vez**, con tu PC contra la base de Railway por su dirección pública. No se usa `railway run` (correría localmente con la `DATABASE_URL` de la red privada, que desde tu PC no resuelve). **El seed nunca corre en un deploy**: el `preDeployCommand` solo migra.

- [ ] En el servicio **Postgres → Settings → Networking → Public Access**: encender. Copiar `DATABASE_PUBLIC_URL` (pestaña Variables). Se apaga al terminar.
- [ ] En una terminal nueva de PowerShell:

```powershell
cd backend

# Apuntar a producción SOLO en esta terminal (las variables del proceso pisan el .env; no lo edites)
$env:DATABASE_URL = '<DATABASE_PUBLIC_URL>'    # la cadena pública exige sslmode=require
$env:NODE_ENV = 'production'                   # así las protecciones del seed exigen sus dos llaves

npm run seed          # base vacía → carga docs/cv-data.json. Mirá que el destino impreso (host:puerto/base) sea el de Railway
npm run seed:verify   # conteos de la base contra el JSON: tienen que coincidir

# Administrador: ADMIN_* definidas solo en esta terminal
$env:ADMIN_EMAIL = '<tu email>'
$env:ADMIN_PASSWORD = '<la del paso 1>'
$env:ADMIN_NAME = 'Manuel Saavedra'
npm run admin:bootstrap

# Limpieza
Remove-Item Env:DATABASE_URL, Env:NODE_ENV, Env:ADMIN_EMAIL, Env:ADMIN_PASSWORD, Env:ADMIN_NAME
```

- [ ] **Apagar Public Access** del Postgres. Se vuelve a encender solo para backups y recargas (paso 9 y *Recarga*).
- [ ] Si `npm run seed` sale con código 2 («Negativa: … la base ya tiene contenido») es que ya había datos: no escribió nada. Leé el mensaje antes de seguir.

**Rotar la contraseña del administrador**: la rotación de rutina va por **Cuenta** en el panel (cierra las sesiones de otros dispositivos). Si se perdió la contraseña, o se sospecha que hay una sesión tomada, `admin:bootstrap` es la recuperación: repetirlo con un `ADMIN_PASSWORD` nuevo (hace *upsert* por email y también cierra todas las sesiones). Hace falta Public Access encendido y las variables solo en esa terminal.

**Recarga deliberada** (borra y recarga desde `docs/cv-data.json`, **también lo editado en el panel**): primero el respaldo del paso 9; después, en una terminal con `DATABASE_URL` y `NODE_ENV=production` como arriba:

```powershell
$env:SEED_ALLOW_PRODUCTION = '1'
npm run seed -- --overwrite
Remove-Item Env:SEED_ALLOW_PRODUCTION, Env:DATABASE_URL, Env:NODE_ENV
```

Con contenido en producción hacen falta las **dos llaves** (`--overwrite` y `SEED_ALLOW_PRODUCTION=1`); `--overwrite` no se combina con `--file`. `AdminUser` no se toca.

---

## 5. Servicio `web` (§ 4, § 9.5)

- [ ] New → GitHub Repo (el mismo) → **Root Directory: `frontend`**.
- [ ] **Config file path: `/frontend/railway.json`** (absoluta desde la raíz del repo, igual que en `api`).
- [ ] Variables:

```ini
API_ORIGIN=http://api.railway.internal:8080
VITE_API_URL=
```

`API_ORIGIN` usa el **nombre real del servicio `api`** tal como figura en el canvas (si lo renombraste, cambialo acá) y el `PORT` de `api`. `VITE_API_URL` va vacía a propósito: el cliente usa rutas relativas que resuelve el proxy. **No definir `CSP_HEADER`**: sin definir, la CSP del sitio bloquea (si tras un deploy algo deja de cargar, `CSP_HEADER=Content-Security-Policy-Report-Only` solo reporta; § 9.5).

- [ ] Deploy. El healthcheck de `web` es `/` (versionado).
- [ ] Verificar el proxy: `curl.exe -s https://<dominio-de-web>/health` tiene que devolver **JSON** (`{"status":"ok",...}`). Si devuelve HTML, el proxy no llega a la API (se sacó `/health` del matcher de `frontend/Caddyfile`, o `API_ORIGIN` está mal).

---

## 6. Dominio gratuito `mjsaavedra.is-a.dev` (§ 0)

Es un subdominio, así que no hace falta `ALIAS` ni redirección de `www`. El trámite es un PR al repositorio [`is-a-dev/register`](https://github.com/is-a-dev/register) y **lo hacés vos desde tu cuenta de GitHub** (su README pide que la solicitud no la genere una IA y la revisan a mano; el tiempo de aprobación no está publicado). Seguí su [guía para Railway](https://docs.is-a.dev/guides/railway/) y la [estructura de archivos](https://docs.is-a.dev/domain-structure/).

- [ ] En `web` → **Settings → Networking → Custom Domain** → agregar `mjsaavedra.is-a.dev`. Railway muestra dos valores: el destino del **`CNAME`** (`@`, tipo `xxxx.up.railway.app`) y el **`TXT`** de `_railway-verify`.
- [ ] Hacer fork de `is-a-dev/register` y crear en la carpeta `domains/` dos archivos, con tu usuario de GitHub en `owner.username`:
  - `domains/mjsaavedra.json` → `{ "owner": { "username": "<tu-usuario>" }, "records": { "CNAME": "<destino que dio Railway>" } }`
  - `domains/_railway-verify.mjsaavedra.json` → `{ "owner": { "username": "<tu-usuario>" }, "records": { "TXT": "<valor de _railway-verify>" } }`
- [ ] **Sin `"proxied": true`**. Ese campo pone el proxy de Cloudflare delante, y entonces Railway vería la IP de Cloudflare en `X-Real-IP`: se romperían la IP real del cliente y el límite de peticiones y de login por visitante (§ 9.5 «IP real del cliente»).
- [ ] Abrir el PR con la vista previa del sitio que exige is-a.dev: el link `*.up.railway.app` del servicio `web` y una captura de la home. Si piden cambios, aplicarlos; si no, rechazan la solicitud.
- [ ] Cuando lo fusionen, el DNS se publica en minutos (si a las 48 h no resuelve, abrir un issue o preguntar en su Discord). Esperar a que Railway marque el dominio verificado y el certificado emitido.
- [ ] En `api`: **`FRONTEND_URL=https://mjsaavedra.is-a.dev`** (origen exacto, sin barra final; de él dependen CORS, el `canonical`, la `og:image` y las URLs del sitemap).
- [ ] **Redeploy de `api`.**
- [ ] Verificar: `curl.exe -s https://mjsaavedra.is-a.dev/tech-lead-dotnet | Select-String 'og:title|canonical'` muestra el título del perfil y `https://mjsaavedra.is-a.dev/tech-lead-dotnet` (no `localhost`).

---

## 7. Verificación completa (§ 5)

```powershell
$SITIO = 'https://mjsaavedra.is-a.dev'

curl.exe -s $SITIO/health                                              # 1. JSON, status ok, base arriba
curl.exe -s -o NUL -w "%{http_code}`n" $SITIO/tech-lead-dotnet         # 2. 200: fallback de la SPA con el head del perfil
curl.exe -s $SITIO/robots.txt                                          # 3. con el dominio (Sitemap: https://mjsaavedra.is-a.dev/sitemap.xml)
curl.exe -s $SITIO/sitemap.xml | Select-Object -First 5                #    URLs con https://mjsaavedra.is-a.dev
curl.exe -s $SITIO/api/curated-profiles/no-existe                      # 4. error sin stack ni detalles
curl.exe -s -o NUL -w "%{http_code}`n" $SITIO/api/docs-json            # 5. 404: Swagger cerrado
curl.exe -sI $SITIO/ | Select-String -Pattern 'content-security-policy|x-content-type|referrer-policy'   # 6. CSP presente
```

**Límite del login y IP real** (cada intento fallido cuenta; la ventana es de 60 s: esperá 1 minuto entre pruebas):

```powershell
# 7a. Seis logins con un usuario inexistente: cinco 401 y el sexto 429
1..6 | ForEach-Object { curl.exe -s -o NUL -w '%{http_code} ' -X POST "$SITIO/api/auth/login" -H 'Content-Type: application/json' -d '{"email":"nadie@example.com","password":"mal"}' }; ''
```

- [ ] **7b. Desde otra red** (el teléfono con datos móviles, no el wifi): un solo login con `nadie@example.com` → **401**, no 429. Prueba que el límite es **por IP real** y no compartido por todos (que la IP llega bien desde Caddy). Si da 429, la API ve la misma IP para todos: revisar el `header_up X-Forwarded-For` de `frontend/Caddyfile` (§ 9.5, *IP real del cliente*).
- [ ] **7c. Railway pisa un `X-Real-IP` enviado por el cliente.** Esperar 1 minuto y, desde tu PC:

```powershell
# seis intentos fallidos mandando un X-Real-IP falso
1..6 | ForEach-Object { curl.exe -s -o NUL -w '%{http_code} ' -X POST "$SITIO/api/auth/login" -H 'X-Real-IP: 1.2.3.4' -H 'Content-Type: application/json' -d '{"email":"nadie@example.com","password":"mal"}' }; ''
# un séptimo, ahora SIN la cabecera: tiene que dar 429 (misma IP, la tuya) y no 401
curl.exe -s -o NUL -w "%{http_code}`n" -X POST "$SITIO/api/auth/login" -H 'Content-Type: application/json' -d '{"email":"nadie@example.com","password":"mal"}'
```

  Si el séptimo da **429**, Railway ignoró el `X-Real-IP` falso y contó todo contra tu IP real: correcto. Si da **401**, el borde deja pasar la cabecera del cliente y cualquiera podría evadir el límite del login: **no cierres el release**; anotá el resultado y consultalo antes de seguir. Desde la otra red, un login tiene que seguir dando 401.

- [ ] Logs de `api` y `web` (panel): JSON con `reqId`, sin contraseñas ni tokens.
- [ ] Abrir el sitio, entrar a `/admin` con el email y la contraseña del paso 4 y mirar un perfil.

Contra el dominio de la API (`*.up.railway.app`, si lo generaste), donde se ve la respuesta cruda:

```powershell
$API = 'https://api-xxxx.up.railway.app'
curl.exe -sI $API/api/profile | Select-String -Pattern 'strict-transport|x-content-type|referrer-policy|x-powered-by'
curl.exe -sI -H 'Origin: https://otro-sitio.com' $API/api/profile | Select-String access-control-allow-origin   # vacío
```

---

## 8. Vistas previas de los links

- [ ] Pegar dos perfiles públicos distintos en el [Post Inspector de LinkedIn](https://www.linkedin.com/post-inspector/) y en un canal de Slack. Las tarjetas tienen que mostrar **títulos distintos** y la imagen (tarea 5.4 de `add-server-rendered-head`). Si salen genéricas, ver *Si algo falla*.
- [ ] Pasar la home y un perfil público por el [Rich Results Test](https://search.google.com/test/rich-results) y por el [validador de schema.org](https://validator.schema.org): `ProfilePage` sin errores y el mismo `@id` del `Person` en los dos (TC-44, pasos 6 y 7 de `docs/MANUAL.md`).

Al primer deploy no hay visitas que reclasificar. Cuando suba la versión de la lista de bots, hacé el `pg_dump` de arriba y corré `railway run npm run views:reclassify` (simulación, no escribe) y, si el informe cierra, `railway run npm run views:reclassify -- --apply` (`docs/DEPLOY.md` § 7).

---

## 9. Backup fuera de Railway y prueba de restauración (§ 7)

El último bloqueante. Los backups de Railway viven en la misma cuenta; un dump propio no. Con Public Access del Postgres **encendido solo para esto** y la versión mayor anotada en el paso 2 (`<N>`):

```powershell
$env:PGURL = '<DATABASE_PUBLIC_URL>'
$fecha = Get-Date -Format yyyy-MM-dd
New-Item -ItemType Directory -Force "$HOME\backups-portafolio" | Out-Null

# Dump (formato custom). Se escribe con -f dentro del contenedor: no uses '>' en PowerShell, corrompe binarios.
docker run --rm -e PGURL -v "$HOME\backups-portafolio:/out" postgres:<N>-alpine sh -c 'pg_dump "$PGURL" -Fc -f /out/portafolio.dump'
Rename-Item "$HOME\backups-portafolio\portafolio.dump" "portafolio-$fecha.dump"

# Prueba de restauración en un Postgres descartable
docker run -d --name pg-restore-test -e POSTGRES_PASSWORD=test postgres:<N>-alpine
Start-Sleep 8
docker cp "$HOME\backups-portafolio\portafolio-$fecha.dump" pg-restore-test:/tmp/b.dump
docker exec pg-restore-test sh -c 'createdb -U postgres restore_test && pg_restore -U postgres -d restore_test --no-owner /tmp/b.dump'
docker exec pg-restore-test psql -U postgres -d restore_test -c 'select count(*) from "CuratedProfile";'   # tiene que coincidir con los perfiles del seed
docker rm -f pg-restore-test

Remove-Item Env:PGURL
```

- [ ] Guardar el `.dump` fuera de la PC de trabajo (disco externo o almacenamiento cifrado) y **apagar Public Access**.
- [ ] Anotar la fecha de la prueba en [`RELEASE-1.0.0-CHECKLIST.md`](RELEASE-1.0.0-CHECKLIST.md). Un backup que no se restauró nunca no cuenta. Repetí el dump antes de cualquier recarga con `--overwrite`.

---

## 10. Cierre

- [ ] Search Console: dar de alta `https://mjsaavedra.is-a.dev` como propiedad de **prefijo de URL** (no de dominio: el DNS de `is-a.dev` no es tuyo; verificá con el **archivo HTML** que ofrece Search Console: va en `frontend/public/` con un PR chico, y Caddy lo sirve tal cual) y enviar `https://mjsaavedra.is-a.dev/sitemap.xml`. (§ 8)
- [ ] **Alerta de uso** del plan Hobby: configurar el aviso de gasto en Railway y mirar el panel de uso la primera semana (tres servicios encendidos superan los USD 5 incluidos).
- [ ] Verificar que el redeploy es selectivo: un cambio trivial en `backend/` (p. ej. un comentario) y push a `main` tiene que redesplegar **solo `api`**, no `web` (por los `watchPatterns` `/backend/**` y `/frontend/**`).
- [ ] `git tag v1.0.0 && git push --tags`.
- [ ] Leer [`MANUAL.md`](MANUAL.md): cómo se usa la plataforma, caso por caso.

---

## Cambiar de dominio

El dominio **no está en el código**: el `canonical`, la `og:url`/`og:image`, el `robots.txt`, el sitemap y CORS salen todos de la variable `FRONTEND_URL` del servicio `api`. Cambiar de dominio es configuración, sin PR ni rebuild de la imagen:

1. Comprar el dominio nuevo (ver la tabla de candidatos) y, en `web` → **Custom Domain**, agregarlo **sin quitar todavía el anterior**. Cargar en su DNS el `ALIAS`/`CNAME` y el `TXT` que muestre Railway, sin proxy delante, y esperar el certificado.
2. En `api`: `FRONTEND_URL=https://<nuevo>` y **redeploy de `api`**. Verificar con el paso 6 (`og:title` y `canonical` con el dominio nuevo) y con `curl.exe -s https://<nuevo>/robots.txt`.
3. En el DNS del dominio **anterior**, redirigir todo con 301 a `https://<nuevo>` conservando la ruta (los links ya enviados y lo indexado siguen funcionando), y quitarlo de los Custom Domains de `web`.
4. Search Console: dar de alta el dominio nuevo, enviar `https://<nuevo>/sitemap.xml` y usar **Cambio de dirección** desde la propiedad anterior.
5. Volver a pasar dos perfiles por LinkedIn Post Inspector (renueva la caché de la tarjeta) y actualizar el link en LinkedIn, GitHub y el CV.
6. Mantener el dominio anterior renovado al menos un año, para que la redirección no se corte.

### Dominios candidatos

Evaluados el 2026-10-28 (disponibilidad consultada por RDAP ese día: confirmar al comprar; precios de agregadores, por año en USD):

| Dominio | Registrador | Registro | Renovación | Notas |
|---|---|---|---|---|
| `mjsaavedra.link` | Porkbun | 7,72 | 7,72 | Neutro, sin restricciones; DNS con `ALIAS` en el apex y *URL Forwarding* para `www` (sin proxy delante) |
| `mjsaavedra.uk` | Cloudflare | 5,30 | 5,30 | El más barato serio; el requisito de dirección en el Reino Unido se habría eliminado en 2018 (confirmar). Cloudflare exige sus nameservers: registro en solo DNS (nube gris) |
| `mjsaavedra.com` | Cloudflare | 10,46 | ~11,17 desde 2026-11-01 | El más reconocible; mismo cuidado con el proxy de Cloudflare |
| `manueljsaavedra.com` | Cloudflare | 10,46 | ~11,17 | Nombre completo |
| `mjsaavedra.dev` | Porkbun | 8,75 | 12,87 | Perfil técnico; `.dev` exige HTTPS (ya lo tiene) |
| `manuelsaavedra.dev` | Porkbun | 8,75 | 12,87 | Nombre exacto |
| `mjsaavedra.page` | Cloudflare | 10,20 | 10,20 | Registro de Google; exige HTTPS |
| `mjsaavedra.fyi` | Cloudflare | 5,20 | 5,20 | Muy barato, pero informal |
| **`mjsaavedra.is-a.dev`** | is-a.dev (gratis) | 0 | 0 | **Elegido para la 1.0.0.** Por PR al repositorio de is-a.dev; depende de su aprobación; sin `"proxied": true` (paso 6) |

Descartados: `manuelsaavedra.com` y `msaavedra.com` (registrados); `.top`, `.xyz`, `.click`, `.site`, `.online` (reputación de spam o renovaciones caras); `.de` y `.us` (exigen contacto en Alemania o vínculo con EE. UU.); `.tech`, `.io`, `.me`, `.pro` (renovaciones de USD 17 a 50); `.cv` (elegibilidad para extranjeros sin confirmar).

---

## Si algo falla

| Síntoma | Causa probable | Dónde |
|---|---|---|
| El deploy de `api` compila sin `prisma generate` o no corre el pre-deploy | Config file path mal (`railway.json` en vez de `/backend/railway.json`) | paso 3 |
| El deploy de `api` queda en "deploying" para siempre | el `preDeployCommand` colgado y sin timeout | Pre-deploy Timeout = 300 (§ 9.5) |
| “healthcheck failed” | la base no responde (`/health` devuelve 503 a propósito) o `PORT` ≠ 8080 | logs del servicio (§ 3) |
| La API no arranca y el log habla de un secreto | validación de arranque | § 1 |
| `/tech-lead-dotnet` da 404 | se perdió el `try_files` del `Caddyfile` | § 4 |
| `/health` devuelve 200 **con HTML** | se sacó `/health*` del matcher del proxy: responde la SPA, no la API | `frontend/Caddyfile` |
| Bucle de redirecciones en la API | falta `header_up X-Forwarded-Proto https` en el proxy | § 9.5 |
| El login del panel no persiste la sesión | la cookie viaja a otro origen: revisar `SESSION_COOKIE_SAMESITE` y que el navegador use el dominio de `web` | § 0 |
| El proxy no encuentra la API | `API_ORIGIN` con otro nombre de servicio o otro puerto que el `PORT` de `api` | § 9.5 |
| **429 en el login para todos** (o para vos desde cualquier red) | la API ve una sola IP: falta o se rompió el `header_up X-Forwarded-For` del `Caddyfile`. Esperá 60 s a que expire la ventana | § 9.5, *IP real del cliente* |
| Todos los perfiles se previsualizan iguales (**cards genéricas**) | el head del servidor no llega: `api` caída o lenta (el sitio degrada al genérico a propósito) o `index.html` sin pasar por `templates`. LinkedIn y Slack guardan en caché la tarjeta anterior: reintentá en Post Inspector | `curl.exe -s https://mjsaavedra.is-a.dev/<slug> \| Select-String og:title` · § 9.5 |
| `canonical` u `og:image` apuntan a `localhost` o a otro dominio | `FRONTEND_URL` de `api` sin el dominio público | § 9.5 |
| El HTML responde 500 | un error dentro del template de `index.html`: se tocó una acción `<!--# … -->` o se quitó el `handle_errors` del `Caddyfile` | `frontend/Caddyfile` |

**Rollback.** Deployments → el despliegue anterior → *Rollback*. En el plan Hobby alcanza a los despliegues de las últimas **72 h**; más viejo que eso se vuelve a desplegar desde el commit. Un rollback **no revierte la base**.

**Migración rota.** El pre-deploy falla, el despliegue se detiene y la versión vieja sigue sirviendo. Leé el log de `prisma migrate deploy`, corregí la migración en una rama y volvé a desplegar. Si quedó aplicada a medias, restaurá el último backup (paso 9) y recién entonces desplegá la corrección (§ 6, § 7).

**Datos perdidos o pisados.** Restaurar el backup de Railway o el `.dump` del paso 9; si lo perdido es solo contenido del seed, la recarga deliberada del paso 4 (con respaldo previo).

## Nunca

- `prisma db push` en producción — solo `prisma migrate deploy` (lo corre el pre-deploy).
- `npm run seed -- --overwrite` sobre datos reales sin el dump del paso 9 hecho antes.
- `SEED_ALLOW_PRODUCTION` ni `ADMIN_*` como variables del servicio `api`: van solo en la terminal del paso 4.
- Dejar el Public Access del Postgres encendido de forma permanente.
- Commitear `.env` ni secretos. Van en las variables del servicio.
- Confiar en un backup que no se restauró nunca.

## Lo que hay que saber de Railway

- El **rollback caduca**: alcanza los despliegues de las últimas **72 h** (plan Hobby) o 120 h (Pro). (§ 6)
- El **costo es variable** (RAM $10/GB/mes, vCPU $20/vCPU/mes, $5 incluidos en Hobby). Tres servicios encendidos lo superan: alerta de uso y mirada la primera semana.
- El límite de peticiones se cuenta **en memoria**, o sea por instancia. Al subir réplicas hay que moverlo a un almacén compartido. (§ 8)
