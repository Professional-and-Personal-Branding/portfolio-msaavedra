# Checklist de Release 1.0.0 — Hardening para Producción

> Este documento recoge lo que separa un "funciona en mi máquina" de un **release 1.0.0 sano** desplegable a producción.
>
> **Estado: cerrado en código por la Fase 6** (change OpenSpec `add-production-hardening`, sept. 2026). Cada ítem indica dónde quedó resuelto, qué falta hacer en la infraestructura o por qué se difirió. El runbook de despliegue está en `docs/DEPLOY.md`; la evidencia, en `openspec/changes/archive/…-add-production-hardening/verification.md`.

**Leyenda:** ✅ hecho en código · ⏳ pendiente de infraestructura (lo hace Manuel al desplegar) · ⏸️ diferido con justificación

---

## 🔴 Bloqueantes — sin esto NO se despliega a producción

- [x] ✅ **Secretos fuertes.** El historial de git no contiene secretos y `.env` está ignorado (verificado y blindado con `backend/test/security.spec.ts`). Además, **la API no arranca en producción** si `JWT_SECRET` es el de `.env.example`, tiene menos de 32 caracteres o coincide con `ANALYTICS_SALT`; si `ANALYTICS_SALT` falta, tiene menos de 32 caracteres o coincide con una clave del keyring; o si `FRONTEND_URL` no usa https. En cualquier entorno exige que `FRONTEND_URL` sea un origen, sin barra final ni ruta (`src/config/env.validation.ts`, change `prepare-deploy-1-0-0`). Cómo generarlos: `docs/DEPLOY.md` § 1.
- [x] ✅ **Migraciones Prisma en producción.** `npm run prisma:deploy` (`prisma migrate deploy`) con la migración `init` versionada. `db push` queda prohibido y así se documenta en `docs/DEPLOY.md` § 3.
- [x] ✅ **CORS estricto.** Solo el origen exacto de `FRONTEND_URL`, con métodos y cabeceras acotados y `credentials` para la cookie del panel (`src/shared/infrastructure/http/cors.options.ts`). Un origen ajeno no recibe `Access-Control-Allow-Origin`.
- [x] ✅ **Validación de inputs.** DTOs con `class-validator` y `adminValidationPipe` (whitelist + forbidNonWhitelisted) en todos los endpoints que reciben cuerpo. Un test estático falla si se agrega uno sin el pipe.
- [x] ✅ **Manejo global de errores.** `AllExceptionsFilter` unifica el cuerpo (`statusCode`, `message`, `error`, `requestId`, `timestamp`) y nunca expone stack traces, SQL, códigos de Prisma ni rutas del servidor; el detalle va al log.
- [x] ✅ **Healthcheck.** `GET /health` (200 / **503** según la base) y `GET /health/live`, fuera del prefijo `/api`, sin autenticación y exentos del rate limiting. Configurarlo en el proveedor: `docs/DEPLOY.md` § 3.
- [x] ✅ **El CLI de Prisma existe en producción.** `prisma` y `tsx` se movieron a `dependencies` en `backend/package.json`: el `preDeployCommand` de Railway corre en un contenedor con la imagen final, donde las `devDependencies` ya no están, y ahí es donde se ejecuta `prisma migrate deploy`. Build y los 254 unitarios verificados después del cambio.
- [x] ✅ **Configuración de despliegue versionada.** `backend/railway.json` (build, pre-deploy, start, healthcheck), `frontend/railway.json`, `frontend/Dockerfile` y `frontend/Caddyfile` (fallback de la SPA + proxy a la API). El contenedor del frontend se verificó en local: deep link con 200, `/api` y `/sitemap.xml` enrutados al proxy, assets `immutable` y HTML `no-cache`.

---

## 🟡 Importantes — deberían entrar en 1.0.0

- [x] ✅ **Rate limiting.** Límite global por IP configurable (120/min por defecto) y un guard propio para `POST /api/auth/login` (5/min), con 429 y `Retry-After`. El healthcheck nunca se limita.
  - Nota: el contador es en memoria, o sea por instancia. Con varias instancias hay que moverlo a un almacén compartido (`docs/DEPLOY.md` § 8).
- [x] ✅ **Security headers.** Helmet ajustado a una API JSON (`nosniff`, `frame-ancestors none`, `no-referrer`, sin `x-powered-by`), HSTS y redirección a HTTPS por `X-Forwarded-Proto` solo en producción. La cookie de sesión ya era `httpOnly`; ahora su `SameSite` se elige por configuración y `none` fuerza `Secure`.
- [x] ✅ **Logging estructurado.** Pino: JSON en producción y salida legible en desarrollo, `LOG_LEVEL` configurable, `requestId` por petición (cabecera `X-Request-Id`, cuerpo de error y log) y **redacción** de credenciales: de la petición solo se registran id, método y URL, con el `?token=` censurado.
- [x] ✅ **Tests mínimos.** Superados con holgura: `ResolveCuratedProfile` con 64 unitarios, `resolve-locale.spec` para el fallback de i18n y 7 suites e2e (109 tests) sobre los endpoints públicos y de administración.
- [x] ✅ **SEO + OpenGraph.** Título, descripción, canonical, OpenGraph, Twitter Card y JSON-LD `ProfilePage` (con el `Person`) por perfil y por idioma; `noindex` en perfiles no públicos y en `/admin`; `robots.txt` y `sitemap.xml` generados por el backend con los perfiles públicos.
  - ✅ **Resuelto en 1.1** por `add-server-rendered-head`: el head de cada perfil (título, descripción, canonical, Open Graph, Twitter y JSON-LD) lo arma el servidor y Caddy lo inserta en `index.html`, así que los scrapers que no ejecutan JavaScript ya ven la tarjeta del perfil. **Falta verificar con el Post Inspector de LinkedIn y con Slack después del deploy** (ver "Estado del release").
- [ ] ⏳ **Backup de DB.** Sin código que escribir. Activar los respaldos del Postgres gestionado y **probar una restauración** siguiendo `docs/DEPLOY.md` § 7. Anotar acá la fecha de la última prueba: `________`.
- [ ] ⏳ **Backup fuera de Railway y prueba de restauración.** Un `pg_dump -Fc` propio (con Public Access encendido solo para eso), guardado fuera de la PC de trabajo y restaurado en un `postgres:<N>-alpine` descartable con la misma versión mayor del servicio; el conteo de `CuratedProfile` tiene que coincidir. Paso 9 de `docs/DEPLOY-RAILWAY.md`.
- [ ] ⏳ **Config file path de los dos servicios.** `/backend/railway.json` en `api` y `/frontend/railway.json` en `web` (rutas absolutas desde la raíz del repo). Sin eso Railway ignora el archivo versionado: el build no corre `prisma generate` y no hay pre-deploy ni healthcheck. Pasos 3 y 5.
- [ ] ⏳ **IP real del cliente verificada.** El `Caddyfile` copia `X-Real-IP` a `X-Forwarded-For`; falta comprobar en el sitio desplegado que el límite del login es por IP real (otra red recibe 401, no 429) y que Railway pisa un `X-Real-IP` falso del cliente. Paso 7 (7b y 7c).
- [ ] ⏳ **Changes archivados antes del deploy.** `openspec/changes/` solo con `archive/`: `polish-pre-deploy-cleanup` y `add-ai-foundation` ya están archivados; falta `prepare-deploy-1-0-0`. Paso 0 de `docs/DEPLOY-RAILWAY.md`.
- [ ] ⏳ **Purgas mensuales, sin cron.** `npm run job-postings:purge` (simulación y `-- --apply`) cada mes y `npm run ai-runs:purge` desde mayo de 2027, a mano desde la PC. Sección «Operación» de `docs/DEPLOY-RAILWAY.md`.
- [ ] ⏳ **Primer poblado desde la máquina del owner.** `npm run seed`, `seed:verify` y `admin:bootstrap` contra `DATABASE_PUBLIC_URL` (sin `railway run`), y Public Access apagado después. Paso 4.

---

## 🔵 Deseables — 1.0.x o post-lanzamiento

- [x] ✅ **Export PDF de perfil.** Resuelto por `add-printable-one-page`: cada perfil curado tiene una hoja imprimible de una página (A4 y Letter) y el botón **Imprimir / Guardar PDF**. El PDF lo genera el navegador (*Guardar como PDF*), en el idioma de la vista y desde los mismos datos. Un PDF generado en el servidor queda fuera de alcance.
- [x] ✅ **Accesibilidad (a11y).** Resuelto por `improve-a11y-and-performance`: axe-core con **0 violaciones** en la vista pública (todos los presets, layouts y los acentos de los 14 perfiles) y en el panel, y Lighthouse Accessibility 100 en las páginas públicas. El acento como texto, el texto atenuado y el texto del botón se derivan del tema con contraste AA (`--t-accent-ink`, `--t-text-dim`); el foco se ve (contorno de 2 px), hay un enlace *Saltar al contenido* en el sitio y en el panel, un `<main>` en cada pantalla, `dl` y pestañas con estructura válida, y el scroll suave respeta `prefers-reduced-motion`. Se vuelve a medir con `npm run a11y:check` y corre en cada PR (job `web-quality` de `ci.yml`).
- [x] ✅ **Caché / performance.** Resuelto por `improve-a11y-and-performance` y `improve-mobile-performance`: Lighthouse mobile con mediana ≥ 90 en Accessibility, Best Practices y SEO de las páginas públicas, y Performance ≥ 85 en el CI (mediana de 5; el runner de GitHub es el equipo de referencia de Lighthouse). La corrida del PR #31 dio medianas de Performance de 97 / 97 / 97 (antes 71–76). El JS del arranque público bajó de 228 a 179 KB y luego a **149 KB gzip en un solo archivo JS de módulo** (más 1 KB del script clásico `profile-prefetch.js`), con un tope de **155 KB** en `npm run perf:budget`; el hero se pinta primero, los menús de la barra cargan en diferido e Inter sale del propio sitio. **No hay cache de lectura en el backend** a propósito: el HTML sale en ≈ 22 ms y la API en ≈ 20 ms, así que no movería ningún número (`cache-de-lectura-y-visitas` sigue diferido, `ROADMAP-1.1.md` § 5). **Lazy-loading de imágenes: no aplica**, la vista pública no tiene `<img>`.
- [x] ✅ **Dashboard de analítica.** Entregado en la Fase 5: visitas por perfil, idioma y día, con rango de fechas.
- [x] ✅ **CI.** `.github/workflows/ci.yml` corre lint, typecheck, unitarios, e2e contra Postgres (con `prisma migrate deploy` y seed), build y el control del contrato OpenAPI en cada push y PR a `main` (PR #2). Desde `improve-a11y-and-performance` suma el job `web-quality` (*Frontend · accesibilidad y Lighthouse*: axe, recorrido de teclado y Lighthouse sobre la imagen de producción del frontend) y `perf:budget` en el job `frontend`. Impedir fusionar con ellos en rojo requeriría *required checks*, que el plan gratuito de GitHub no ofrece con un repositorio privado (403); hoy el control es de proceso. El **CD** queda del lado de Railway, que despliega al hacer push a `main` una vez configurado el deploy.
- [ ] **Repositorios destacados reales.** Curaduría manual pendiente (de Manuel): completar `featuredRepositories` en `docs/cv-data.json`. Ver `docs/DATA-POPULATION.md` § 10.
- [ ] ⏸️ **Opcionales con el sitio estable: evidencia de GitHub e IA.** Se encienden después de un deploy estable (GitHub, con 2 o más repositorios cargados; TC-52 y TC-54 contra los servicios reales). Spend limits de 12 USD (`portfolio-app`) y 5 USD (`portfolio-evals`). Sección «Opcionales, con el sitio estable» de `docs/DEPLOY-RAILWAY.md`.
- [ ] ⏸️ **Token CSRF.** Diferido: la cookie es `SameSite` estricto y los endpoints de escritura solo aceptan JSON, así que un formulario cross-site no puede provocar una escritura. Revisar si alguna vez se sirve el frontend desde un subdominio no confiable.

---

## Estado del release

**Todo lo que es código está cerrado.** Los 6 bloqueantes de hardening, el ajuste de empaquetado del CLI de Prisma y la configuración de despliegue. De los importantes queda uno, backups, que no es código y se cierra al desplegar. **Proveedor elegido: Railway** (`docs/DEPLOY.md` § 9.5). Lo que queda para el 1.0.0:

1. Crear el proyecto en Railway y seguir **`docs/DEPLOY-RAILWAY.md`** (la guía corta, con checkboxes). El detalle de cada paso está en `docs/DEPLOY.md`, y los diagramas de cómo encaja todo, en `docs/DEPLOY-ARCHITECTURE.md`.
2. Activar backups, hacer un **dump fuera de Railway** y **probar una restauración** (paso 9 de la guía y § 7), y anotar la fecha en este documento.
3. Correr la verificación posterior al despliegue (§ 5), incluida la prueba de IP real del paso 7.
4. Pendientes de la ronda 1.1 que necesitan el sitio arriba:
   - **Vista previa de los links** (tarea 5.4 de `add-server-rendered-head`): pegar dos perfiles distintos en el [Post Inspector de LinkedIn](https://www.linkedin.com/post-inspector/) y en un canal de Slack. Las tarjetas tienen que mostrar títulos distintos y la imagen. Capturas en `openspec/changes/archive/2026-10-08-add-server-rendered-head/verification/`.
   - **Migración `curated_profile_lifecycle`**: antes del primer deploy que la incluya, probar `prisma migrate deploy` sobre una restauración del backup de producción (la prueba hecha fue sobre una copia de la base de desarrollo).
   - **Migración `retire_accent_color`** (destructiva: copia el acento a `themeOverrides` y borra la columna `accentColor`): respaldo previo con `pg_dump -Fc` o backup de Railway si la base ya tiene datos. Rollback: restaurar el respaldo y volver a desplegar la imagen anterior. Detalle en `docs/DEPLOY.md` § 9.5.
   - **Migración `localize_language_level`** (de datos, no destructiva: cambia `Language.level` a JSONB `{ es, en }`): respaldo previo con `pg_dump -Fc` o backup de Railway si la base ya tiene datos. Rollback: restaurar el respaldo y volver a desplegar la imagen anterior (el SQL sin respaldo pierde el inglés). Detalle en `docs/DEPLOY.md` § 9.5.
5. Recién entonces, etiquetar `v1.0.0`.

> Regla de oro: el deploy real es el último paso, no el primero.
