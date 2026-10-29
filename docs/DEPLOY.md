# DEPLOY — Runbook de producción (release 1.0.0)

> **Este es el documento de referencia: el qué, el por qué y las alternativas.** Para desplegar con el panel abierto usá la guía corta, [`DEPLOY-RAILWAY.md`](DEPLOY-RAILWAY.md), que son los mismos pasos en una página y remite acá sección por sección.
>
> Procedimiento para poner el portafolio en producción: **backend** (NestJS + Postgres gestionado) y **frontend** (SPA estática). Escrito para seguirse de arriba abajo, una sola vez, y volver a él cuando haya que redeployar.
>
> **Proveedor elegido: Railway**, los tres servicios en el mismo proyecto. La configuración está versionada en el repo (`backend/railway.json`, `frontend/railway.json`, `frontend/Dockerfile`, `frontend/Caddyfile`) y el paso a paso está en el **§ 9.5**. El § 9 conserva la comparación con las otras tres plataformas evaluadas, por si algún día hay que mudarse.
>
> Este documento lo produjo la Fase 6 (`add-production-hardening`). El estado de cada ítem del checklist está en `docs/RELEASE-1.0.0-CHECKLIST.md`.

---

## 0. Antes de empezar

Necesitás:

- Una cuenta en **Railway** (plan Hobby, $5/mes). Los tres servicios —API, Postgres y sitio— viven en un mismo proyecto.
- Un dominio, si querés uno propio. Sin dominio también funciona con el subdominio `*.up.railway.app`.

> El **§ 9** guarda la comparación con las otras tres plataformas evaluadas (Seenode, DigitalOcean App Platform y Fly.io) y el detalle campo por campo de cada una. Si alguna vez hay que mudarse, los requisitos R1–R7 del § 9.1 son la vara.

Decidí de antemano **cómo van a quedar los dominios**, porque cambia una variable:

| Escenario | Ejemplo | `SESSION_COOKIE_SAMESITE` |
|---|---|---|
| **Mismo sitio** (frontend y API bajo el mismo dominio, la API en `/api` por un proxy) | `portafolio.com` y `portafolio.com/api` | **`strict`** |
| Sitios distintos | `portafolio.com` y `api.portafolio.com` | `none` |

Con `none` la cookie viaja siempre con `Secure`, y eso exige HTTPS en ambos extremos; Railway lo da por defecto.

**En este despliegue vamos por la primera fila.** El contenedor del frontend corre Caddy, que sirve la SPA y además hace de proxy de `/api/*`, `/health*`, `/robots.txt` y `/sitemap.xml` hacia la API por la red privada de Railway (`frontend/Caddyfile`). El navegador habla con un solo origen, así que la cookie va con **`SameSite=strict`**, no hay CORS en juego y `VITE_API_URL` queda **vacío** —el cliente usa rutas relativas, que es su comportamiento por defecto.

---

## 1. Generar los secretos

```bash
# Secreto de firma del JWT (mínimo 32 caracteres; la API no arranca en producción con menos)
openssl rand -base64 48

# Sal para el hash de IP de la analítica: DEBE ser distinta del JWT_SECRET
openssl rand -base64 32

# Contraseña del administrador (24 bytes; es la definitiva: va directo al gestor de contraseñas)
openssl rand -base64 24
```

Guardalos en el gestor de secretos del proveedor, nunca en el repositorio. La API **rechaza arrancar** en producción si el `JWT_SECRET` es el del `.env.example`, si tiene menos de 32 caracteres, si coincide con `ANALYTICS_SALT` o si `FRONTEND_URL` no usa `https`.

---

## 2. Base de datos

1. Creá el Postgres gestionado y copiá su cadena de conexión.
2. Verificá que exige TLS (`?sslmode=require` en la mayoría de los proveedores).
3. **Activá los backups automáticos** ahora, no después (ver § 7).

---

## 3. Backend

### Variables de entorno

| Variable | Valor en producción | Notas |
|---|---|---|
| `DATABASE_URL` | cadena del Postgres gestionado | con TLS |
| `NODE_ENV` | `production` | activa HSTS, `Secure` en la cookie y las validaciones de arranque |
| `PORT` | `8080` | fijala a mano: el `API_ORIGIN` del proxy la necesita explícita |
| `FRONTEND_URL` | `https://portafolio.com` | **origen exacto**: es el único que CORS permite y la base de las URLs del sitemap. Con el proxy es el dominio del servicio `web`, no el de la API |
| `JWT_SECRET` | el generado en § 1 | mínimo 32 caracteres |
| `JWT_EXPIRES_IN` | `1d` | o `12h` si preferís sesiones más cortas |
| `ANALYTICS_SALT` | el generado en § 1 | distinto del `JWT_SECRET` |
| `SESSION_COOKIE_SAMESITE` | `strict` | mismo origen gracias al proxy del § 9.5; ver la tabla de § 0 |
| `LOG_LEVEL` | `info` | `debug` solo para diagnosticar |
| `THROTTLE_TTL` / `THROTTLE_LIMIT` | `60` / `120` | ventana en segundos y peticiones por IP |
| `THROTTLE_LOGIN_LIMIT` | `5` | intentos de login por ventana e IP |
| `ENABLE_API_DOCS` | *(sin definir)* | definila en `true` solo si querés Swagger público |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME` | los del administrador | **no van en el servicio `api`**: solo se usan al correr `admin:bootstrap` y se definen en la terminal de tu máquina (ver *Primer arranque*) |
| `RAILWAY_DEPLOYMENT_DRAINING_SECONDS` | *(no hace falta)* | solo Railway, servicio `api`. Ya queda versionado como `drainingSeconds: 10` en `backend/railway.json`; la variable solo sirve si querés pisarlo desde el panel. La API espera hasta 5 s a registrar las visitas en vuelo al apagarse; tiene que quedar **por encima de 5** (ver § 9.5, *Apagado de la API*) |
| `CSP_HEADER` | *(sin definir)* | **del servicio `web`, no de la API.** Nombre de la cabecera de la CSP del sitio; sin definir bloquea, con `Content-Security-Policy-Report-Only` solo reporta (ver § 9.5, *Content-Security-Policy del sitio*) |

### Comandos

En Railway estos comandos no se escriben en el panel: los toma de **`backend/railway.json`**, que está versionado.

```json
{
  "build": {
    "builder": "RAILPACK",
    "buildCommand": "npm run prisma:generate && npm run build",
    "watchPatterns": ["/backend/**"]
  },
  "deploy": {
    "preDeployCommand": ["npm run prisma:deploy"],
    "preDeployTimeoutSeconds": 300,
    "startCommand": "node dist/main",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 300,
    "drainingSeconds": 10,
    "restartPolicyType": "ON_FAILURE"
  }
}
```

Dos detalles que importan: el `buildCommand` corre `prisma generate` **antes** de `nest build` (sin el cliente generado, el build de TypeScript no compila), y los `watchPatterns` llevan **ruta absoluta desde la raíz del repo** (`/backend/**`) porque el repositorio es un monorepo: así un cambio solo en `frontend/` o en `docs/` no redespliega la API. `drainingSeconds: 10` da margen a que la API registre (hasta 5 s) las visitas en vuelo al apagarse.
`prisma:deploy` ejecuta `prisma migrate deploy`, que aplica las migraciones versionadas. **Nunca uses `prisma db push` en producción**: puede borrar datos.

El `preDeployCommand` corre en un contenedor aparte con la imagen nueva, antes de que la versión nueva reciba tráfico; si la migración falla, el despliegue se detiene y la versión vieja sigue sirviendo. Por eso `prisma` y `tsx` están en `dependencies` y no en `devDependencies`. Railpack **no poda** las dev después del build salvo que se defina `RAILPACK_PRUNE_DEPS`, así que hoy funcionarían de las dos maneras; seguimos manteniéndolas en `dependencies` porque el día que se active la poda (o se pase a una imagen mínima) el `preDeployCommand`, el seed y `admin:bootstrap` dejarían de encontrar sus binarios.

### Primer arranque

Se hace **una sola vez y desde tu máquina**, no con `railway run` (que corre localmente con las variables del servicio, incluida la `DATABASE_URL` de la red privada, `*.railway.internal`, que desde tu PC no resuelve). El paso a paso con cada comando está en [`DEPLOY-RAILWAY.md`](DEPLOY-RAILWAY.md) § 4; en resumen:

1. Encender **Public Access** en el servicio Postgres (solo para esto y para los backups) y copiar `DATABASE_PUBLIC_URL`.
2. En una terminal, definir `DATABASE_URL` con esa URL y correr, desde `backend/`: `npm run seed`, `npm run seed:verify` y `npm run admin:bootstrap` (con `ADMIN_EMAIL`, `ADMIN_PASSWORD` y `ADMIN_NAME` definidas **solo en esa terminal**). Carga porque la base está vacía; si ya tiene datos, el seed se niega con código 2.
3. Cerrar la terminal o borrar las variables.

**No hay pantalla para cambiar la contraseña** del administrador. Se rota volviendo a correr `admin:bootstrap` con un `ADMIN_PASSWORD` nuevo (hace *upsert* por email, es idempotente).

El `preDeployCommand` solo migra (`npm run prisma:deploy`): **nunca siembra**. Un deploy no dispara una carga; sembrar en producción es siempre un comando manual.

### Healthcheck

En Railway ya queda puesto por `backend/railway.json` (`healthcheckPath: "/health"`). Con el healthcheck configurado, **el despliegue nuevo no se activa hasta que `/health` responda 2xx**, así que una base caída o una migración a medias no tumban el sitio.

`GET /health` responde 200 con la base accesible y **503** si no responde, para que el orquestador saque la instancia del balanceador. `GET /health/live` responde 200 mientras el proceso viva, sin tocar la base: útil como sonda de *liveness* para que una caída temporal de Postgres no provoque reinicios.

---

## 4. Frontend

El frontend se despliega como un contenedor: Node compila y **Caddy** sirve `dist/`. Está todo versionado, no hay nada que configurar en el panel más allá de las variables.

| Archivo | Qué hace |
|---|---|
| `frontend/Dockerfile` | Dos etapas: `node:22-alpine` corre `npm ci && npm run build`, y `caddy:2-alpine` se queda solo con `dist/` |
| `frontend/Caddyfile` | Sirve la SPA con `try_files {path} /index.html` y hace de proxy de `/api/*`, `/health*`, `/robots.txt` y `/sitemap.xml` |
| `frontend/railway.json` | `builder: DOCKERFILE` |

| Variable | Valor |
|---|---|
| `API_ORIGIN` | `http://<nombre-del-servicio-api>.railway.internal:8080` |
| `VITE_API_URL` | **vacío** (el cliente usa rutas relativas y las resuelve el proxy) |

El `try_files` es el que evita que `/tech-lead-dotnet` devuelva 404. Los assets de Vite (`/assets/*`, con hash en el nombre) y las fuentes propias (`/fonts/*`) salen con `Cache-Control: public, max-age=31536000, immutable`; el HTML y todo lo demás, con `no-cache`.

Cuatro detalles del arranque público (change `improve-mobile-performance`):

- **`/fonts/*` es inmutable, y por eso el nombre lleva la versión** (`inter-latin-v20.woff2`). Cambiar el archivo exige cambiar el nombre y los dos lugares que lo nombran (`@font-face` de `themes/theme.css` y el `preload` de `index.html`); un test lo verifica. Inter sale del propio sitio; Google Fonts queda solo para las demás familias de los temas.
- **`/profile-prefetch.js` se sirve con `no-cache`, a propósito.** Es el script que pide el perfil mientras baja el bundle y no lleva hash en el nombre. Si un navegador conservara una copia vieja con otra lógica de clave que la app nueva, la app no tomaría su respuesta y pediría el perfil otra vez (una visita doble en `ProfileView`).
- **La CSP no cambió:** `script-src 'self'` alcanza para el script (es del propio origen, sin inline) y `font-src 'self'` ya permitía la fuente.
- **El arranque es un solo archivo JS.** Detrás del borde de Railway (HTTP/2) el efecto es menor que en el CI (HTTP/1.1); a cambio, un deploy invalida el archivo entero en vez de solo el de la app. Se acepta por el volumen de visitas repetidas del sitio.

Para probarlo en local, sin Railway:

```bash
cd frontend
docker build -t portafolio-web .
docker run --rm -p 8099:8080 -e PORT=8080 -e API_ORIGIN=http://host.docker.internal:3300 portafolio-web
# http://localhost:8099 y http://localhost:8099/tech-lead-dotnet deben dar 200
```

### robots.txt y sitemap.xml

Los genera el **backend** con los perfiles públicos del momento, y el proxy del `Caddyfile` los expone en el dominio del sitio, que es donde los buscadores los esperan. No hay nada más que hacer.

---

## 5. Verificación posterior al despliegue

Con el proxy, el sitio y la API comparten origen, así que `API` y `SITIO` son el mismo host. Si además dejaste el dominio público de la API (`*.up.railway.app`), usalo para los puntos 2 a 4, que es donde interesa ver la respuesta cruda de la API.

> `/health*` está en el proxy a propósito: si no lo estuviera, el fallback de la SPA respondería 200 con HTML y el punto 1 pasaría sin haber tocado la API.

```bash
API=https://portafolio.com          # o el *.up.railway.app del servicio api
SITIO=https://portafolio.com

# 1. La API vive y ve la base
curl -s $API/health | jq

# 2. Cabeceras de seguridad y HTTPS
curl -sI $API/api/profile | grep -iE 'strict-transport|x-content-type|referrer-policy|x-powered-by'

# 3. CORS solo desde el frontend
curl -sI -H "Origin: https://otro-sitio.com" $API/api/profile | grep -i access-control-allow-origin   # vacío
curl -sI -H "Origin: $SITIO" $API/api/profile | grep -i access-control-allow-origin                    # el dominio

# 4. Swagger cerrado
curl -s -o /dev/null -w '%{http_code}\n' $API/api/docs-json    # 404

# 5. Un error no filtra nada
curl -s $API/api/curated-profiles/no-existe | jq

# 6. El login se frena tras varios intentos
for i in $(seq 1 6); do
  curl -s -o /dev/null -w "%{http_code} " -X POST $API/api/auth/login \
    -H 'Content-Type: application/json' -d '{"email":"nadie@example.com","password":"mal"}'
done; echo    # termina en 429

# 7. SEO
curl -s $API/sitemap.xml | head -20
curl -s $API/robots.txt

# 8. El sitio
open $SITIO            # home
open $SITIO/admin      # backoffice
```

Revisá además, en el panel del proveedor, que los logs salgan en **JSON con `reqId`** y que no aparezcan contraseñas ni tokens.

---

## 6. Rollback

1. **Código**: en el servicio, pestaña Deployments → *Rollback* en el despliegue que funcionaba. **Solo alcanza los que estén dentro de la retención: 72 h en el plan Hobby, 120 h en Pro.** Más viejo que eso, hay que volver a desplegar desde el commit.
2. **Migraciones**: `prisma migrate deploy` solo agrega; si una migración rompió algo, restaurá desde el backup (§ 7) y desplegá la versión anterior.
3. **Datos**: el seed sobrescribe el contenido del portafolio, y desde `add-profile-content-admin` todo se edita en el panel (portada, formación, proyectos, enlaces, experiencias y skills). La protección es real (change `protect-default-seed`): `npm run seed` cuenta las filas de las 13 tablas que limpia y, si hay alguna, sale con código 2 sin escribir. Forzar la recarga en producción exige dos llaves: `--overwrite` y `SEED_ALLOW_PRODUCTION=1`, esta última definida **solo para ese comando** y **nunca** como variable del servicio `api` (si quedara en el servicio, la doble llave se reduciría a `--overwrite`). Hacé el `pg_dump` del § 7 antes.

---

## 7. Backups y su restauración

Activalos en el proveedor del Postgres (todos los mencionados los ofrecen). Un backup que nunca se restauró no es un backup: **probá la restauración al menos una vez**.

```bash
# Copia manual, además de la automática del proveedor
pg_dump "$DATABASE_URL" -Fc -f portafolio-$(date +%F).dump
# Antes de cualquier `npm run seed -- --overwrite` (la negativa del seed sugiere este mismo
# comando, con el archivo <base>-AAAA-MM-DD.dump y sin contraseña: libpq la pide).

# Prueba de restauración contra una base descartable
createdb portafolio_restore_test
pg_restore -d portafolio_restore_test portafolio-$(date +%F).dump
psql -d portafolio_restore_test -c 'select count(*) from "CuratedProfile";'
dropdb portafolio_restore_test
```

Anotá la fecha de la última prueba de restauración en `docs/RELEASE-1.0.0-CHECKLIST.md`.

---

## 8. Después del despliegue

- **Search Console**: dar de alta el dominio y enviar el sitemap.
- **Vista previa de los links**: resuelto en 1.1 por `add-server-rendered-head` (el head de cada perfil sale del servidor, § 9.5). Falta verificarlo con el sitio desplegado: pegar dos perfiles distintos en el [Post Inspector de LinkedIn](https://www.linkedin.com/post-inspector/) y en un canal de Slack; las tarjetas tienen que mostrar títulos distintos y la imagen. Si salen genéricas, ver *Qué falla y por qué* en `docs/MANUAL.md`.
- **Límites por IP detrás de Caddy**: ver *IP real del cliente* en el § 9.5; si se quita el `header_up X-Forwarded-For` del `Caddyfile`, el límite de peticiones y el del login pasan a ser compartidos por todos los visitantes.
- **Escalar a más de una instancia**: el límite de peticiones se cuenta en memoria, así que cada instancia lleva su propio contador. Si algún día hace falta escalar horizontalmente (en Railway, subir las réplicas del servicio), hay que moverlo a un almacén compartido.
- **Costo**: Railway cobra por uso (RAM $10/GB/mes, vCPU $20/vCPU/mes) y el plan Hobby incluye $5. Tres servicios siempre encendidos lo superan; mirá el panel de uso la primera semana para saber en qué se estabiliza.

---

## 9. Proveedores: comparación y configuración campo por campo

Las secciones anteriores son independientes del proveedor. Acá están los cuatro que se evaluaron, con los valores exactos de cada campo del panel. Elegí uno y seguí solo su apartado.

### 9.1 Lo que este proyecto le exige al proveedor

| # | Requisito | Por qué | Dónde |
|---|---|---|---|
| R1 | Proceso Node **siempre vivo** (no serverless) | El límite de peticiones y el contador de la analítica viven en memoria del proceso | § 3 |
| R2 | Correr `prisma migrate deploy` **antes** de servir tráfico | Si el esquema va atrasado, la API arranca y falla en cada consulta | § 3 |
| R3 | **Healthcheck configurable** en `/health` | `GET /health` devuelve **503** si Postgres no responde, para que el orquestador saque la instancia | § 3 |
| R4 | Hosting estático con **fallback de `/*` a `index.html`** | Es una SPA: sin eso `/tech-lead-dotnet` da 404 | § 4 |
| R5 | Postgres gestionado con **TLS** y **backups restaurables** | Un backup que nunca se restauró no es un backup | § 2, § 7 |
| R6 | Acceso a la base **desde fuera** (psql / pg_dump) | La prueba de restauración se corre desde tu máquina | § 7 |
| R7 | **Rollback** a un despliegue anterior | Paso 1 del rollback | § 6 |

### 9.2 Comparación

| | **Seenode** | **Railway** | **DigitalOcean App Platform** | **Fly.io** |
|---|---|---|---|---|
| R1 proceso siempre vivo | ✅ *"Always running, no cold starts"* | ✅ | ✅ | ⚠️ solo con `min_machines_running = 1` y `auto_stop_machines = "off"`; por defecto las máquinas se apagan |
| R2 migraciones antes del tráfico | ⚠️ encadenadas en el *start command* (`&&`) | ✅ **Pre-deploy Command** en contenedor aparte | ✅ **job `PRE_DEPLOY`** | ✅✅ **`release_command`**: máquina temporal con la imagen nueva, antes de crear o actualizar ninguna, y *"a non-zero exit status from this command will stop the deployment"* |
| R3 healthcheck en `/health` | ❌ **no existe el campo** | ✅ *Healthcheck Path*; el deploy nuevo no se activa hasta el 2xx | ✅ *readiness* + *liveness* por separado | ✅ `[[http_service.checks]]` con `path` e `interval`; corre por la red privada |
| R4 SPA estática | ✅ fallback **activado por defecto**, hosting **$0** | ⚠️ es un servicio más y se **cobra**; resuelto acá con `frontend/Dockerfile` + `Caddyfile` versionados | ✅ `catchall_document`, **gratis** (hasta 3 sitios) | ❌ `[[statics]]` desde el contenedor **no tiene fallback**: *"it will not find `index.html` at the root"*. `index_document` existe solo para statics en Tigris, y resuelve directorios, no un catch-all. Hace falta una segunda app con Caddy o un bucket Tigris |
| R5 Postgres + backups | ⚠️ PG 18.4 / 16.14, retención de **3 días** | ✅ diario 6 d · semanal 1 mes · mensual 3 meses, + PITR ≈ 4 semanas | ✅ diario + PITR | ✅ MPG: backups **10 días** + PITR, HA y PgBouncer en todos los planes |
| R6 acceso externo | ✅ red pública de fábrica | ⚠️ **privada por defecto** desde el 31-jul-2026: hay que activar *Public Access* (proxy TCP) y usar `sslmode=require` | ✅ con *trusted sources* | ⚠️ **sin acceso público por diseño**: el `pg_dump` del § 7 sale por `fly mpg proxy` o WireGuard |
| R7 rollback | ✅ | ⚠️ solo dentro de la retención: **72 h** en Hobby, 120 h en Pro | ✅ | ✅ sin comando propio: `fly releases --image` y `fly deploy --image <tag anterior>`, sin reconstruir |
| Mismo dominio para API y sitio → `SameSite=strict` | ⚠️ depende de si el *rewrite* acepta destino externo (**verificar**) | ✅ con el proxy de Caddy que ya está en el repo | ✅ **nativo**: una sola app con `routes` por componente | ⚠️ posible, pero poniendo vos el proxy |
| Costo mensual estimado | **$11** fijo ($7 app Standard + $4 DB Basic + $0 estático) | **$10–20** variable ($5 de plan con $5 de uso incluido; tres servicios encendidos lo superan) | **≈ $20** fijo ($5 app + $15,15 Postgres + $0 estático) | **≈ $44** ($3 máquina de 512 MB + **$38 MPG Basic** + $2,80 de 10 GB a $0,28/GB) |
| Prueba gratis | 7 días, sin tarjeta; los sitios estáticos no la consumen | no (el plan Hobby ya cuesta $5) | 3 sitios estáticos gratis permanentes | no |

**Resumen:** Seenode es el más barato y el que menos configuración pide, a cambio de R3 (no hay healthcheck) y de una retención de backups corta. Railway es el más equilibrado y el único con *pre-deploy command* más healthcheck bloqueante, pero el costo es variable y el rollback caduca en 72 h. DigitalOcean es el único que cumple los siete requisitos **y** permite servir API y sitio bajo un mismo dominio, lo que habilita `SESSION_COOKIE_SAMESITE=strict` y vuelve triviales `robots.txt` y `sitemap.xml`; es el más caro de los tres primeros y el de panel más áspero. Fly.io tiene el **mejor mecanismo de despliegue de los cuatro** y la mejor base, pero su Postgres gestionado arranca en $38/mes y no sabe servir una SPA: queda como la opción de lujo (§ 9.7).

### 9.3 Dos ajustes del repositorio, antes de elegir proveedor

**A. `prisma` y `tsx` (histórico: hoy ya están en `dependencies`).** `npm run prisma:deploy` necesita el CLI de `prisma`, y `seed` / `admin:bootstrap` necesitan `tsx`. Si el proveedor instala con `NODE_ENV=production` —que hace que `npm ci` omita las `devDependencies`— o poda las dev después del build, esos comandos no existen y el deploy falla. Dos salidas, en orden de preferencia:

1. Mover `prisma` y `tsx` a `dependencies` en `backend/package.json` y regenerar el lockfile. Es lo más robusto y vale para los tres proveedores.
2. Dejarlas donde están y usar `npm ci --include=dev` como *build command*, asegurándose de que el proveedor **no** pode las dev entre el build y el arranque.

**B. `SESSION_COOKIE_SAMESITE`** se decide con la tabla del § 0, y la respuesta depende del proveedor: con DigitalOcean podés usar `strict`; con Seenode lo normal es `none`; Railway también puede usar `strict` gracias al proxy de Caddy del servicio `web` (§ 9.5).

Lo que **no** hay que tocar: `app.listen(config.port)` ya escucha en todas las interfaces, y `app.set('trust proxy', 1)` ya está puesto, así que el límite por IP cuenta la IP real detrás del balanceador. En Railway, con el proxy de Caddy en el medio, además hace falta que Caddy reenvíe la IP del cliente: ver *IP real del cliente* en el § 9.5.

### 9.4 Seenode — campo por campo

**Web Service** (el backend):

| Campo | Valor |
|---|---|
| Root directory | `backend` |
| Language | Node (22) |
| Build command | `npm ci --include=dev && npm run build` |
| Start command | `npm run prisma:deploy && npm run start:prod` |
| Port | el valor de este campo tiene que ser el mismo de la variable `PORT` |
| Instance | **Standard ($7)** — Basic (0,5 GB / 0,25 vCPU) va justo para `tsc` + `prisma generate` |

El balanceador termina el TLS y reenvía al puerto configurado. No hay campo de healthcheck (R3): `GET /health` queda para monitoreo externo, no para que la plataforma retire la instancia. Si te importa, preguntá a `help@seenode.com` antes de decidir.

**Static Site** (el frontend), hosting $0:

| Campo | Valor |
|---|---|
| Root directory | `frontend` |
| Build command | `npm ci && npm run build` |
| Publish directory | `dist` |
| SPA / client-side routing | ya viene activado: agrega el rewrite de `/*` a `/index.html` |
| Variable | `VITE_API_URL=https://<api>.seenode.app` (sin barra final) |

En la pestaña **Routing** las reglas son ordenadas, gana la primera y se evalúan solo cuando el archivo no existe. Agregá dos *rewrites*, `/robots.txt` y `/sitemap.xml`, hacia el backend. **Verificá si el destino puede ser una URL externa**: si puede, podés también mandar `/api/*` al backend y usar `SESSION_COOKIE_SAMESITE=strict`; si no, van dominios distintos y `none`.

**Database:** PostgreSQL 18.4, tier Basic ($4, 1 GB, 20 conexiones). Confirmá en la cadena de conexión que exige TLS (§ 2) y agregá `?connection_limit=5` para que el pool de Prisma no se coma las 20 conexiones. Retención de backups: **3 días**, así que el `pg_dump` del § 7 pasa de deseable a necesario.

### 9.5 Railway — campo por campo (**el proveedor elegido**)

Un proyecto con **tres servicios**: `api`, `Postgres` y `web`. Lo que es configuración vive en el repo; en el panel solo se ponen variables y dominios.

| Archivo | Servicio | Qué fija |
|---|---|---|
| `backend/railway.json` | `api` | build, `preDeployCommand`, start y `healthcheckPath` |
| `frontend/railway.json` | `web` | `builder: DOCKERFILE` |
| `frontend/Dockerfile` | `web` | build con Node + runtime con Caddy |
| `frontend/Caddyfile` | `web` | fallback de la SPA, proxy a la API y cabeceras de caché |

#### Servicio `api`

| Campo del panel | Valor |
|---|---|
| Root Directory | `backend` |
| Config file path | **`/backend/railway.json`** — ruta **absoluta desde la raíz del repo**: el Root Directory no la reubica, y `railway.json` a secas no se encuentra |
| Build / Start / Pre-deploy / Healthcheck | **no tocar**: los toma de `backend/railway.json` |
| Pre-deploy Timeout | `300` — ya versionado (`preDeployTimeoutSeconds`); por defecto **no tiene límite**, y un comando colgado deja el despliegue en curso indefinidamente |
| Networking | el dominio público es opcional; dejalo para poder correr la verificación del § 5 contra la API cruda |

Variables: las del § 3, con `PORT=8080`, `SESSION_COOKIE_SAMESITE=strict`, `FRONTEND_URL` = el dominio del servicio `web` y `DATABASE_URL=${{Postgres.DATABASE_URL}}` (red privada).

#### Servicio `Postgres`

Se agrega desde el canvas del proyecto (New → Database → PostgreSQL).

- `DATABASE_URL` se referencia con `${{Postgres.DATABASE_URL}}` y resuelve por la red privada; no hace falta exponerlo.
- Para el § 7 sí necesitás acceso externo: **Settings → Networking → Public Access**, que crea el proxy TCP. Desde fuera la conexión exige `sslmode=require` y la cadena pública queda en `DATABASE_PUBLIC_URL`.
- Pestaña **Backups**: elegí el esquema (diario con 6 días, semanal con 1 mes, mensual con 3 meses). El restore se **prepara** montando un volumen nuevo con la fecha del backup y recién se aplica al hacer Deploy.
- Agregá `?connection_limit=5` a la URL que usa la API si alguna vez subís réplicas, para que los pools no se sumen hasta agotar las conexiones.

#### Servicio `web`

| Campo del panel | Valor |
|---|---|
| Root Directory | `frontend` |
| Config file path | **`/frontend/railway.json`** (ruta absoluta desde la raíz del repo) |
| Builder | **no tocar**: `frontend/railway.json` ya dice `DOCKERFILE` |
| Variable `API_ORIGIN` | `http://api.railway.internal:8080` (el nombre del servicio `api`, tal como figura en el canvas) |
| Variable `VITE_API_URL` | **vacía** |
| Variable `CSP_HEADER` | opcional; sin definir, la CSP **bloquea** (ver *Content-Security-Policy* más abajo) |
| Networking | acá va el dominio propio: es el que ve el navegador |

El `Caddyfile` escucha en `:{$PORT}` —Railway inyecta `PORT`— y reparte así:

- `/api/*`, `/health`, `/health/live`, `/robots.txt`, `/sitemap.xml` → `reverse_proxy {$API_ORIGIN}`, con `header_up X-Forwarded-Proto https` explícito para que la redirección a https del backend no entre en bucle (el TLS real lo terminó el borde de Railway).
- `/api/public/profile-head` → la misma API, en una ruta propia con `dial_timeout` y `response_header_timeout` de **500 ms**.
- todo lo demás → `try_files {path} /index.html` y `file_server`; `index.html` pasa además por `templates`.

**Head por perfil en el HTML inicial** (change `add-server-rendered-head`). Las vistas previas de LinkedIn, WhatsApp y Slack no ejecutan JavaScript, así que el título y la imagen del perfil tienen que estar en el HTML que entrega Caddy. Para eso `index.html` se procesa con la directiva `templates` (delimitadores `<!--#` y `-->`, que en el archivo son comentarios HTML) y pide con `httpInclude` el fragmento `GET /api/public/profile-head?slug=…&lang=…`. Si llega, lo emite en lugar del head de fallback; si no, entrega el fallback. Nunca quedan dos etiquetas por clave.

- `httpInclude` hace una **sub-petición al mismo Caddy**, no a `API_ORIGIN` directo: por eso existe la ruta propia de arriba, que es la que llega a la API.
- **Degradación:** si la API falla o no responde en 500 ms, un `handle_errors` hace que el fragmento llegue vacío con 200 y el sitio sirve el head de fallback. Sin eso, el error de la sub-petición haría fallar el template y con él **todo el HTML**. Verificado con la API apagada y con una API que acepta la conexión y no responde (`openspec/changes/archive/*-add-server-rendered-head/verification/`).
- **Costo:** una petición más por carga de HTML; medido en local, el p95 sube unos 8 ms.
- **No hay variable nueva.** Usa `API_ORIGIN`, y las URLs absolutas del fragmento (`canonical`, `og:image`) salen del `FRONTEND_URL` del servicio `api`, que tiene que ser el dominio público del sitio.
- Un perfil `PROTECTED` o `PRIVATE` emite `robots: noindex, nofollow` en el HTML inicial y nunca sus textos, ni siquiera con `?token=`.

**Content-Security-Policy del sitio** (change `polish-builder-and-edge`). Caddy la agrega a las respuestas que sirve él (el HTML y los estáticos); las que pasan por el proxy hacia la API no la reciben. El valor por defecto es `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'` (`frontend/Caddyfile`). Sin `'unsafe-inline'` en `script-src`: el JSON-LD del head es un bloque de datos y no se ejecuta.

- **Variable `CSP_HEADER`** (servicio `web`, opcional). Es el *nombre* de la cabecera. Sin definir vale `Content-Security-Policy` y la política bloquea. Con `CSP_HEADER=Content-Security-Policy-Report-Only` la misma política solo reporta (el navegador deja pasar todo y anota las violaciones en la consola). Cambiarla es redesplegar `web`; no reconstruye la imagen.
- **Si algo deja de cargar** tras un deploy (una fuente, un tema nuevo), pasá a `Report-Only`, abrí la consola, agregá el origen que falte al `Caddyfile` y volvé a `Content-Security-Policy`.
- Si un tema agrega una familia que no está en Google Fonts, `fonts.ts` no la pide: la política no cambia eso.

**Apagado de la API y visitas en vuelo.** La visita se registra en segundo plano, fuera del camino de la respuesta; al recibir `SIGTERM`, la API espera hasta **5 s** a que terminen las que quedan en vuelo (`drain`) y recién entonces cierra. **Recomendación (P3, no bloquea):** confirmar el valor actual de `RAILWAY_DEPLOYMENT_DRAINING_SECONDS` en el servicio `api` y fijarlo **por encima de ese tope de 5 s**, por ejemplo en `10`. Si queda por debajo, Railway envía `SIGKILL` antes de que termine el drenaje y se pierden las visitas en vuelo (quedan solo en el log).

**IP real del cliente (límites de peticiones y analítica).** Con Caddy en el medio, la API ve la conexión de Caddy, no la del navegador. Railway entrega la IP del cliente en la cabecera `X-Real-IP`, y el `Caddyfile` la copia a `X-Forwarded-For` con `header_up X-Forwarded-For {http.request.header.X-Real-IP}` en los dos proxies (`@backend` y `@head`). Como `app.set('trust proxy', 1)` toma un solo salto, la API usa esa IP para el límite de peticiones, el del login y el `ipHash` de la analítica. Sin esa línea, todos los visitantes compartirían una IP (la del borde): cinco logins fallidos de cualquiera bloquearían al administrador y la analítica contaría un solo visitante. Como `header_up` **reemplaza** el valor, un `X-Forwarded-For` enviado por el cliente no sirve para evadir el límite. Verificación en producción: `DEPLOY-RAILWAY.md` § 7 (el `X-Real-IP` que manda el cliente lo pisa el borde de Railway; comprobarlo es parte de la lista).

Caddy preserva el `Host` original al hacer proxy, así que la cookie de sesión queda ligada al dominio del sitio, que es justamente lo que permite `SameSite=strict`.

> **Red privada:** Railway la resuelve por IPv6. La API no necesita ningún cambio —`app.listen(port)` de Node escucha en `::` cuando no se le pasa host— pero si algún día alguien la ata a `0.0.0.0`, el proxy deja de encontrarla.

#### Orden de arranque

1. Crear el proyecto y agregar **Postgres**.
2. Crear `api` desde el repo con Root Directory `backend`, cargar las variables del § 3 y desplegar. El `preDeployCommand` corre la migración; el healthcheck decide si la versión entra.
3. Correr el primer arranque del § 3, desde tu máquina contra `DATABASE_PUBLIC_URL` (`npm run seed`, `seed:verify`, `admin:bootstrap`).
4. Crear `web` con Root Directory `frontend`, poner `API_ORIGIN` y desplegar.
5. Asignar el dominio al servicio `web` y recién entonces fijar `FRONTEND_URL` en `api` (CORS y las URLs del sitemap dependen de él) y redesplegar `api`.
6. Correr la verificación del § 5.

#### Migración `retire_accent_color` (destructiva)

La tercera migración (`init`, `curated_profile_lifecycle`, `retire_accent_color`) es la primera que borra datos: copia el `accentColor` de cada perfil a `themeOverrides.colors.accent` (sin pisar un `colors.accent` existente) y después hace `DROP COLUMN "accentColor"`.

- Corre en el `preDeployCommand` con `prisma migrate deploy`, como las demás. Nunca con `migrate dev` ni `db push`.
- Sobre una base vacía (el primer deploy) el `UPDATE` afecta 0 filas y la columna nace sin existir. Después se corre el seed, que ya trae los acentos en `themeOverrides`.
- **Respaldo previo recomendado** si la base ya tiene datos: `pg_dump -Fc` como en el § 7, o un backup de Railway, antes del deploy que incluya esta migración.
- **Rollback:** restaurar ese respaldo y volver a desplegar la imagen anterior. El código nuevo sin la migración no arranca, y el viejo no funciona con la columna borrada.

#### Migración `localize_language_level` (de datos, no destructiva)

La cuarta migración (`init`, `curated_profile_lifecycle`, `retire_accent_color`, `localize_language_level`) cambia el tipo de `Language.level` de `TEXT` a `JSONB` en la misma fila, con un único `ALTER COLUMN … TYPE JSONB USING …`. Cada valor pasa a texto bilingüe: un nivel conocido en español (`Nativo`, `Avanzado`, …) queda `{ es, en }`; un código MCER (`B1-B2`, `C1`), `{ es: x, en: x }`; cualquier otro texto, `{ es: x }`, sin inventar el inglés. No borra ni agrega filas; la tabla de traducciones está en `openspec/changes/archive/2026-10-10-localize-language-level/design.md` (D2).

- Corre en el `preDeployCommand` con `prisma migrate deploy`, como las demás. Nunca con `migrate dev` ni `db push`.
- Sobre una base vacía (el primer deploy) solo cambia el tipo de la columna. Después se corre el seed, que ya trae `level` como `{ es, en }`.
- **Respaldo previo recomendado** si la base ya tiene datos: `pg_dump -Fc` como en el § 7, o un backup de Railway.
- **Rollback preferido:** restaurar ese respaldo y volver a desplegar la imagen anterior. El código nuevo no funciona sobre la columna `TEXT` y el viejo no funciona sobre `JSONB`.
- **Rollback por SQL** (sin respaldo; **pierde el inglés**, conserva el español):

```sql
ALTER TABLE "Language" ALTER COLUMN "level" TYPE TEXT USING (
  CASE jsonb_typeof("level")
    WHEN 'string' THEN "level" #>> '{}'
    WHEN 'object' THEN COALESCE(NULLIF(btrim("level" ->> 'es'), ''), "level" ->> 'en', '')
    ELSE "level"::text
  END
);
DELETE FROM "_prisma_migrations" WHERE migration_name = '20261010120000_localize_language_level';
```

Después, desplegar el código anterior.

#### Lo que cede Railway

- **El rollback caduca**: 72 h en Hobby, 120 h en Pro (§ 6).
- **El costo es variable**: RAM $10/GB/mes y vCPU $20/vCPU/mes, con $5 incluidos en Hobby. Tres servicios encendidos lo superan.
- El servicio `web` se cobra como cualquier otro, aunque solo sirva archivos. La alternativa, si el gasto molesta, es mover el frontend a Vercel — pero entonces se pierden el mismo origen y el `SameSite=strict`, y hay que volver a `none`.

### 9.6 DigitalOcean App Platform — campo por campo

Es el único de los tres donde **API y sitio viven en el mismo dominio**, como componentes de una misma app enrutados por path. Eso habilita `SESSION_COOKIE_SAMESITE=strict` y hace que `robots.txt` y `sitemap.xml` queden en el origen del sitio sin ningún proxy.

El *app spec* (Settings → App Spec) queda así:

```yaml
name: portafolio-msaavedra
region: nyc
services:
  - name: api
    source_dir: backend
    github: { repo: <usuario>/portfolio-msaavedra, branch: main, deploy_on_push: true }
    build_command: npm ci --include=dev && npm run build
    run_command: npm run start:prod
    instance_size_slug: basic-xxs      # $5/mes
    instance_count: 1
    http_port: 8080                    # el mismo valor que la variable PORT
    health_check:
      http_path: /health
    routes:
      - path: /api
      - path: /health
      - path: /robots.txt
      - path: /sitemap.xml
static_sites:
  - name: web
    source_dir: frontend
    build_command: npm ci && npm run build
    output_dir: dist
    catchall_document: index.html      # el fallback de la SPA
    routes:
      - path: /
jobs:
  - name: migrate
    kind: PRE_DEPLOY
    source_dir: backend
    run_command: npm run prisma:deploy
databases:
  - name: db
    engine: PG
    production: true                   # Managed Postgres, desde $15,15/mes
```

Notas:

- `health_check.http_path` es la sonda de *readiness*; `liveness_health_check` es aparte y, si falla, **reinicia** el componente. Apuntá el liveness a `/health/live`, que no toca la base, para que una caída temporal de Postgres no provoque reinicios.
- Con dominio propio, declaralo tanto en `domains` como en los `routes`, o el `catchall_document` no se aplica al dominio custom.
- Como todo queda en un origen, `FRONTEND_URL` y `VITE_API_URL` apuntan al mismo host (`VITE_API_URL=https://portafolio.com`) y la API cuelga de `/api`.
- Para el § 7, agregá tu IP a las *trusted sources* de la base antes de correr `pg_dump`.

### 9.7 Fly.io — por qué entra y por qué no gana

Fly.io cumple R1, R2, R3, R5 y R7, y en R2 es el mejor de los cuatro. Pierde por dos cosas que no son de configuración: **R4 y el precio de la base**.

**Lo que hace mejor que todos.** El `release_command` del `fly.toml` corre en una máquina temporal con la imagen nueva, *antes* de que se cree o actualice cualquier máquina, y un código de salida distinto de cero **detiene el despliegue**. Para el R2 de este proyecto eso es exactamente lo que se quiere: si la migración falla, la versión vieja sigue sirviendo y nunca hay una imagen nueva contra un esquema viejo.

```toml
app = "portafolio-api"
primary_region = "gru"

[build]

[deploy]
  release_command = "npm run prisma:deploy"

[env]
  NODE_ENV = "production"
  PORT = "8080"

[http_service]
  internal_port = 8080
  force_https = true
  auto_stop_machines = "off"      # R1: sin esto las máquinas se apagan
  auto_start_machines = true
  min_machines_running = 1        # R1: el límite por IP y el contador viven en memoria

  [[http_service.checks]]
    path = "/health"
    interval = "15s"
    timeout = "3s"

[[vm]]
  memory = "512mb"
  cpu_kind = "shared"
  cpus = 1
```

Los secretos van con `fly secrets set JWT_SECRET=… ANALYTICS_SALT=…`, no en `[env]`.

**Por qué no gana.**

1. **R4, la SPA.** `[[statics]]` sirve archivos del contenedor pero no hace fallback: la documentación dice que *"it will not find `index.html` at the root. The full path must be requested"*, así que `/tech-lead-dotnet` daría 404. El `index_document` existe solo para statics respaldados por Tigris y resuelve rutas de directorio, no un catch-all. Las salidas son una **segunda app** con Caddy (`try_files {path} /index.html`) o un bucket **Tigris** — en ambos casos, una pieza más que mantener. La tercera salida, que el backend sirva el `index.html`, choca con una decisión de la Fase 6: Helmet va sin CSP justamente porque *"esta app no sirve HTML"* ([security.middleware.ts](../backend/src/shared/infrastructure/http/security.middleware.ts)), así que habría que rehacer esa configuración.
2. **El precio de la base.** Managed Postgres arranca en **$38/mes** (Basic, shared-2x, 1 GB RAM) más $0,28 por GB provisionado. Con la máquina de la API quedan **≈ $44/mes**: el doble de DigitalOcean y cuatro veces Seenode, para un portafolio que recibe visitas de a decenas.
3. **R6.** El clúster no es alcanzable desde internet por diseño; la prueba de restauración del § 7 hay que hacerla a través de `fly mpg proxy` o un túnel WireGuard. Funciona, pero es un paso más.

**La trampa que conviene no pisar:** el `fly postgres` clásico (no gestionado) sale centavos, y es tentador. Fly mismo advierte que no es una base gestionada: la operás vos y los respaldos son snapshots del volumen. Eso incumple el R5 y el ítem de backups del checklist, que es justamente el último bloqueante del release. Si vas a Fly.io, es con MPG.

**Cuándo sí elegirlo:** si algún día el portafolio necesita varias regiones, o si ya tenés otras cosas en Fly.io y el costo de la base se reparte entre varios proyectos. Para el 1.0.0 de este proyecto, es pagar de más por capacidades que no usa.

### 9.8 Recomendación

**Decidido: Railway** (§ 9.5), porque el `preDeployCommand` más el healthcheck bloqueante hacen que una migración rota no tumbe el sitio, y porque el proxy de Caddy del servicio `web` nos da el mismo origen y con él `SameSite=strict` — que era la única ventaja real de DigitalOcean — a menos de la mitad del costo.

El resto queda como referencia, por si hay que mudarse:

- **Si el criterio es el costo y la simplicidad:** Seenode, aceptando que no hay healthcheck y que los backups propios del § 7 son obligatorios.
- **Si el criterio es que el despliegue sea a prueba de errores:** Railway, por el pre-deploy command más el healthcheck bloqueante; con el frontend en Vercel si no querés pagar un servicio para servir archivos estáticos.
- **Si el criterio es la postura de seguridad:** DigitalOcean, porque el mismo dominio permite `SameSite=strict`, la fila más segura de la tabla del § 0.
- **Fly.io** queda como cuarta opción: mejores mecánicas de despliegue, el doble de costo y una pieza extra para servir la SPA (§ 9.7).

> Los datos de planes, retenciones y precios son de **octubre de 2026**. Verificalos en el proveedor antes de contratar.
