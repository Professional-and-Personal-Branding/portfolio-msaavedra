# DEPLOY — Runbook de producción (release 1.0.0)

> Procedimiento para poner el portafolio en producción: **backend** (NestJS + Postgres gestionado) y **frontend** (SPA estática). Escrito para seguirse de arriba abajo, una sola vez, y volver a él cuando haya que redeployar.
>
> Este documento lo produjo la Fase 6 (`add-production-hardening`). El estado de cada ítem del checklist está en `docs/RELEASE-1.0.0-CHECKLIST.md`.

---

## 0. Antes de empezar

Necesitás:

- Una cuenta en el proveedor del backend (**Railway** o **Render**; ambos sirven, las diferencias se marcan abajo).
- Una cuenta en **Vercel** (o Netlify) para el frontend.
- Un **Postgres gestionado**: el del propio proveedor, o Neon/Supabase.
- Un dominio, si querés uno propio. Sin dominio también funciona con los subdominios del proveedor.

Decidí de antemano **cómo van a quedar los dominios**, porque cambia una variable:

| Escenario | Ejemplo | `SESSION_COOKIE_SAMESITE` |
|---|---|---|
| Mismo sitio (frontend y API bajo el mismo dominio, la API en `/api` por un proxy) | `portafolio.com` y `portafolio.com/api` | `strict` |
| Sitios distintos (lo habitual con Vercel + Railway) | `portafolio.com` y `api.portafolio.com` | `none` |

Con `none` la cookie viaja siempre con `Secure`, y eso exige HTTPS en ambos extremos. Los dos proveedores lo dan por defecto.

---

## 1. Generar los secretos

```bash
# Secreto de firma del JWT (mínimo 32 caracteres; la API no arranca en producción con menos)
openssl rand -base64 48

# Sal para el hash de IP de la analítica: DEBE ser distinta del JWT_SECRET
openssl rand -base64 32

# Contraseña del administrador (la vas a cambiar en el primer arranque)
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
| `PORT` | la que inyecte el proveedor | Railway y Render la definen solos |
| `FRONTEND_URL` | `https://portafolio.com` | **origen exacto**: es el único que CORS permite y la base de las URLs del sitemap |
| `JWT_SECRET` | el generado en § 1 | mínimo 32 caracteres |
| `JWT_EXPIRES_IN` | `1d` | o `12h` si preferís sesiones más cortas |
| `ANALYTICS_SALT` | el generado en § 1 | distinto del `JWT_SECRET` |
| `SESSION_COOKIE_SAMESITE` | `strict` o `none` | según la tabla de § 0 |
| `LOG_LEVEL` | `info` | `debug` solo para diagnosticar |
| `THROTTLE_TTL` / `THROTTLE_LIMIT` | `60` / `120` | ventana en segundos y peticiones por IP |
| `THROTTLE_LOGIN_LIMIT` | `5` | intentos de login por ventana e IP |
| `ENABLE_API_DOCS` | *(sin definir)* | definila en `true` solo si querés Swagger público |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME` | los del administrador | solo se usan al correr `admin:bootstrap` |

### Comandos

```bash
# Build
npm ci && npm run build

# Arranque (Start Command del proveedor)
npm run prisma:deploy && npm run start:prod
```

`prisma:deploy` ejecuta `prisma migrate deploy`, que aplica las migraciones versionadas. **Nunca uses `prisma db push` en producción**: puede borrar datos.

### Primer arranque

```bash
# 1. Cargar los datos del portafolio (una sola vez)
npm run seed && npm run seed:verify

# 2. Crear el administrador
npm run admin:bootstrap

# 3. Entrar al backoffice y cambiar la contraseña del paso 1
```

### Healthcheck

Configurá la sonda del proveedor así:

| Proveedor | Campo | Valor |
|---|---|---|
| Railway | Healthcheck Path | `/health` |
| Render | Health Check Path | `/health` |

`GET /health` responde 200 con la base accesible y **503** si no responde, para que el orquestador saque la instancia del balanceador. `GET /health/live` responde 200 mientras el proceso viva, sin tocar la base: útil como sonda de *liveness* para que una caída temporal de Postgres no provoque reinicios.

---

## 4. Frontend

```bash
cd frontend
npm ci
npm run build     # genera dist/
```

| Ajuste | Valor |
|---|---|
| Framework preset (Vercel) | Vite |
| Build command | `npm run build` |
| Output directory | `dist` |
| Variable `VITE_API_URL` | `https://api.portafolio.com` (sin barra final) |

Como es una SPA, hay que **reescribir todas las rutas a `index.html`**, o `/tech-lead-dotnet` devolverá 404. En Vercel, `vercel.json`:

```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```

### robots.txt y sitemap.xml

Los genera el **backend** con los perfiles públicos del momento. Hay dos formas de exponerlos en el dominio del sitio:

- **Con proxy** (recomendado): reescribí `/robots.txt` y `/sitemap.xml` del frontend hacia el backend.
- **Sin proxy**: enviá a los buscadores directamente a `https://api.portafolio.com/sitemap.xml` desde Search Console.

---

## 5. Verificación posterior al despliegue

```bash
API=https://api.portafolio.com
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
    -H 'Content-Type: application/json' -d '{"email":"x@y.z","password":"mal"}'
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

1. **Código**: volvé al despliegue anterior desde el panel del proveedor (ambos guardan el historial).
2. **Migraciones**: `prisma migrate deploy` solo agrega; si una migración rompió algo, restaurá desde el backup (§ 7) y desplegá la versión anterior.
3. **Datos**: nunca corras `seed` sobre una base con datos reales; sobrescribe el contenido del portafolio.

---

## 7. Backups y su restauración

Activalos en el proveedor del Postgres (todos los mencionados los ofrecen). Un backup que nunca se restauró no es un backup: **probá la restauración al menos una vez**.

```bash
# Copia manual, además de la automática del proveedor
pg_dump "$DATABASE_URL" -Fc -f portafolio-$(date +%F).dump

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
- **Vista previa de los links**: al compartir un perfil en LinkedIn o WhatsApp verás los datos genéricos del portafolio, no los del perfil concreto. Es una limitación conocida: esos rastreadores no ejecutan JavaScript. Está anotada para 1.1 (ver `add-production-hardening/design.md` D6).
- **Escalar a más de una instancia**: el límite de peticiones se cuenta en memoria, así que cada instancia lleva su propio contador. Si algún día hace falta escalar horizontalmente, hay que moverlo a un almacén compartido.
