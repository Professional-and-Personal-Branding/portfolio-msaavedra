# DEPLOY — Guía corta (Railway)

> Versión condensada para seguir con el panel abierto. **El detalle y el por qué están en [`DEPLOY.md`](DEPLOY.md)**: cada paso indica entre paréntesis la sección a la que ir si algo no cierra.
>
> La configuración de build ya está versionada (`backend/railway.json`, `frontend/railway.json`, `frontend/Dockerfile`, `frontend/Caddyfile`). **En el panel solo se cargan variables y dominios.**

**Arquitectura:** tres servicios en un proyecto. `web` (Caddy) sirve la SPA y hace de **proxy** de `/api/*`, `/health*`, `/robots.txt` y `/sitemap.xml` hacia `api` por la red privada. Un solo origen → cookie `SameSite=strict`, sin CORS, `VITE_API_URL` vacío. (§ 0, § 9.5)

```
navegador → [web: Caddy] ──/api/*──▶ [api: NestJS] ──privada──▶ [Postgres]
                   └── todo lo demás → dist/ con fallback a index.html
```

---

## 0. Secretos (§ 1)

```bash
openssl rand -base64 48   # JWT_SECRET      (mín. 32 caracteres)
openssl rand -base64 32   # ANALYTICS_SALT  (distinta del JWT_SECRET)
openssl rand -base64 24   # ADMIN_PASSWORD  (la cambiás en el paso 3)
```

En producción la API **no arranca** si el `JWT_SECRET` es el del `.env.example`, tiene menos de 32 caracteres, coincide con `ANALYTICS_SALT`, o si `FRONTEND_URL` no usa https.

---

## 1. Proyecto y base

- [ ] New Project → **New → Database → PostgreSQL**.
- [ ] Pestaña **Backups**: activar el esquema (diario 6 d · semanal 1 mes · mensual 3 meses). Ahora, no después. (§ 7)

---

## 2. Servicio `api` (§ 9.5)

- [ ] New → GitHub Repo → **Root Directory: `backend`**.
- [ ] **No** tocar Build / Start / Pre-deploy / Healthcheck: los toma de `backend/railway.json`.
- [ ] Settings → **Pre-deploy Timeout: `300`** (por defecto no tiene límite).
- [ ] Variables → Raw Editor, pegar y completar:

```ini
NODE_ENV=production
PORT=8080
DATABASE_URL=${{Postgres.DATABASE_URL}}
JWT_SECRET=<paso 0>
JWT_EXPIRES_IN=1d
ANALYTICS_SALT=<paso 0>
SESSION_COOKIE_SAMESITE=strict
LOG_LEVEL=info
THROTTLE_TTL=60
THROTTLE_LIMIT=120
THROTTLE_LOGIN_LIMIT=5
ADMIN_EMAIL=<tu email>
ADMIN_PASSWORD=<paso 0>
ADMIN_NAME=Manuel Saavedra
FRONTEND_URL=https://PENDIENTE
```

`FRONTEND_URL` se completa en el paso 5, cuando exista el dominio. `ENABLE_API_DOCS` **no se define** (Swagger queda cerrado).

- [ ] Variables → agregar `RAILWAY_DEPLOYMENT_DRAINING_SECONDS=10` (recomendado). La API espera hasta 5 s a registrar las visitas en vuelo al apagarse; si Railway espera menos, esas visitas se pierden. Confirmá primero el valor que tiene hoy el servicio y que quede **por encima de 5**.

- [ ] Deploy. El `preDeployCommand` corre `prisma migrate deploy`; el healthcheck `/health` decide si la versión entra. Si la migración falla, el despliegue se detiene y la versión vieja sigue sirviendo.
- [ ] La migración `retire_accent_color` es **destructiva**: copia el acento de cada perfil a `themeOverrides.colors.accent` y borra la columna `accentColor`. Sobre una base vacía no toca filas. Si la base ya tiene datos, hacé un **respaldo antes** del deploy (`pg_dump -Fc` o un backup de Railway); el rollback es restaurarlo y volver a desplegar la imagen anterior. (§ 9.5)
- [ ] La migración `localize_language_level` cambia `Language.level` de texto a JSONB (`{ es, en }`) sin perder filas. Sobre una base vacía solo cambia el tipo. Si la base ya tiene datos, hacé un **respaldo antes** del deploy. Rollback preferido: restaurar el respaldo y volver a desplegar la imagen anterior; sin respaldo, el SQL de `docs/DEPLOY.md` § 9.5 vuelve la columna a texto y **pierde el inglés**. (§ 9.5)
- [ ] Settings → Networking → **Generate Domain** (opcional pero útil: sirve para verificar la API cruda en el paso 6).

---

## 3. Primer arranque — una sola vez (§ 3)

```bash
cd backend
railway link          # elegir el proyecto y el servicio api
railway run npm run seed
railway run npm run seed:verify
railway run npm run admin:bootstrap
```

- [ ] Entrar a `/admin` y **cambiar la contraseña** del paso 0.

> `npm run seed` **sobrescribe** el contenido del portafolio. No volver a correrlo sobre datos reales.

---

## 4. Servicio `web` (§ 4, § 9.5)

- [ ] New → GitHub Repo (el mismo) → **Root Directory: `frontend`**.
- [ ] Variables:

```ini
API_ORIGIN=http://api.railway.internal:8080
VITE_API_URL=
# Opcional. Sin definir, la CSP del sitio bloquea. Para solo reportar:
# CSP_HEADER=Content-Security-Policy-Report-Only
```

`API_ORIGIN` usa el **nombre del servicio `api`** tal como figura en el canvas. `VITE_API_URL` va vacía a propósito: el cliente usa rutas relativas que resuelve el proxy.

`web` también inserta el head de cada perfil en el HTML inicial, pidiéndolo a `api` con un presupuesto de 500 ms; si `api` no responde, el sitio carga igual con el head genérico. No hace falta ninguna variable más, pero el `FRONTEND_URL` de `api` tiene que ser el dominio público: de ahí salen el `canonical` y la `og:image` (§ 9.5).

`web` sirve el sitio con una **Content-Security-Policy** que bloquea lo que no sea del propio origen (más Google Fonts). Si tras un deploy algo deja de cargar, poné `CSP_HEADER=Content-Security-Policy-Report-Only` en `web`, redesplegá y mirá la consola; el detalle está en el § 9.5.

- [ ] Deploy.

---

## 5. Dominio (§ 0)

- [ ] Asignar el dominio **al servicio `web`** (es el que ve el navegador). Settings → Networking → Custom Domain, y el CNAME que indique.
- [ ] Volver a `api` y poner `FRONTEND_URL=https://portafolio.com` — el origen exacto, sin barra final. De él dependen CORS y las URLs del sitemap.
- [ ] **Redeploy de `api`.**

---

## 6. Verificar (§ 5)

```bash
SITIO=https://portafolio.com

curl -s $SITIO/health | jq                      # 1. la API ve la base
curl -s -o /dev/null -w '%{http_code}\n' $SITIO/tech-lead-dotnet   # 2. 200: el fallback de la SPA
curl -s $SITIO/sitemap.xml | head -5            # 3. SEO
curl -s $SITIO/api/curated-profiles/no-existe | jq   # 4. el error no filtra nada
curl -s -o /dev/null -w '%{http_code}\n' $SITIO/api/docs-json       # 5. 404: Swagger cerrado

# 6. el login se frena tras varios intentos
for i in $(seq 1 6); do curl -s -o /dev/null -w "%{http_code} " -X POST $SITIO/api/auth/login \
  -H 'Content-Type: application/json' -d '{"email":"x@y.z","password":"mal"}'; done; echo   # termina en 429
```

Contra el dominio de la API (`*.up.railway.app`), donde se ve la respuesta cruda:

```bash
API=https://api-xxxx.up.railway.app
curl -sI $API/api/profile | grep -iE 'strict-transport|x-content-type|referrer-policy|x-powered-by'
curl -sI -H "Origin: https://otro-sitio.com" $API/api/profile | grep -i access-control-allow-origin   # vacío
```

- [ ] En los logs del panel: **JSON con `reqId`**, sin contraseñas ni tokens.
- [ ] Abrir el sitio y `/admin`.

---

## 7. Backups — el último bloqueante (§ 7)

```bash
# Acceso externo: en el servicio Postgres, Settings → Networking → Public Access.
# Desde fuera la conexión exige sslmode=require; la cadena está en DATABASE_PUBLIC_URL.

pg_dump "$DATABASE_PUBLIC_URL" -Fc -f portafolio-$(date +%F).dump

createdb portafolio_restore_test
pg_restore -d portafolio_restore_test portafolio-$(date +%F).dump
psql -d portafolio_restore_test -c 'select count(*) from "CuratedProfile";'
dropdb portafolio_restore_test
```

- [ ] Anotar la fecha de la prueba en [`RELEASE-1.0.0-CHECKLIST.md`](RELEASE-1.0.0-CHECKLIST.md).

---

## 8. Cerrar el release

- [ ] Search Console: dar de alta el dominio y enviar el sitemap. (§ 8)
- [ ] `git tag v1.0.0 && git push --tags`.
- [ ] Leer [`MANUAL.md`](MANUAL.md): cómo se usa la plataforma, caso por caso.

---

## Si algo falla

| Síntoma | Causa probable | Dónde |
|---|---|---|
| El deploy de `api` queda en "deploying" para siempre | el `preDeployCommand` colgado y sin timeout | Pre-deploy Timeout = 300 (§ 9.5) |
| El deploy falla con "healthcheck failed" | la base no responde: `/health` devuelve 503 a propósito | logs del servicio (§ 3) |
| La API no arranca y el log habla de un secreto | validación de arranque | § 1 |
| `/tech-lead-dotnet` da 404 | se perdió el `try_files` del `Caddyfile` | § 4 |
| `/health` devuelve 200 **con HTML** | se sacó `/health*` del matcher del proxy: responde la SPA, no la API | `frontend/Caddyfile` |
| Bucle de redirecciones en la API | falta `header_up X-Forwarded-Proto https` en el proxy | § 9.5 |
| El login del panel no persiste la sesión | la cookie viaja a otro origen: revisar `SESSION_COOKIE_SAMESITE` y que el navegador use el dominio de `web` | § 0 |
| El proxy no encuentra la API | `API_ORIGIN` con otro nombre de servicio o otro puerto que el `PORT` de `api` | § 9.5 |
| Todos los perfiles se previsualizan iguales al compartirlos | el head del servidor no llega: `api` caída o lenta (el sitio degrada al genérico a propósito) o `index.html` sin pasar por `templates` | `curl -s https://<dominio>/<slug> \| grep og:title` · § 9.5 |
| `canonical` u `og:image` apuntan a `localhost` | `FRONTEND_URL` de `api` sin el dominio público | § 9.5 |
| El HTML responde 500 | un error dentro del template de `index.html`: se tocó una acción `<!--# … -->` o se quitó el `handle_errors` del `Caddyfile` | `frontend/Caddyfile` |

## Nunca

- `prisma db push` en producción — solo `prisma migrate deploy` (lo corre el pre-deploy).
- `npm run seed` sobre datos reales.
- Commitear `.env` ni secretos. Van en las variables del servicio.
- Confiar en un backup que no se restauró nunca.

## Lo que hay que saber de Railway

- El **rollback caduca**: alcanza los despliegues de las últimas **72 h** (plan Hobby) o 120 h (Pro). Más viejo que eso, se vuelve a desplegar desde el commit. (§ 6)
- El **costo es variable** (RAM $10/GB/mes, vCPU $20/vCPU/mes, $5 incluidos en Hobby). Tres servicios encendidos lo superan: mirar el uso la primera semana.
- El límite de peticiones se cuenta **en memoria**, o sea por instancia. Al subir réplicas hay que moverlo a un almacén compartido. (§ 8)
