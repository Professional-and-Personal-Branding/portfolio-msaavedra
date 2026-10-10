# Checklist de Release 1.0.0 — Hardening para Producción

> Este documento recoge lo que separa un "funciona en mi máquina" de un **release 1.0.0 sano** desplegable a producción.
>
> **Estado: cerrado en código por la Fase 6** (change OpenSpec `add-production-hardening`, sept. 2026). Cada ítem indica dónde quedó resuelto, qué falta hacer en la infraestructura o por qué se difirió. El runbook de despliegue está en `docs/DEPLOY.md`; la evidencia, en `openspec/changes/archive/…-add-production-hardening/verification.md`.

**Leyenda:** ✅ hecho en código · ⏳ pendiente de infraestructura (lo hace Manuel al desplegar) · ⏸️ diferido con justificación

---

## 🔴 Bloqueantes — sin esto NO se despliega a producción

- [x] ✅ **Secretos fuertes.** El historial de git no contiene secretos y `.env` está ignorado (verificado y blindado con `backend/test/security.spec.ts`). Además, **la API no arranca en producción** si `JWT_SECRET` es el de `.env.example`, tiene menos de 32 caracteres o coincide con `ANALYTICS_SALT`, o si `FRONTEND_URL` no usa https (`src/config/env.validation.ts`). Cómo generarlos: `docs/DEPLOY.md` § 1.
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
- [x] ✅ **SEO + OpenGraph.** Título, descripción, canonical, OpenGraph, Twitter Card y JSON-LD `Person` por perfil y por idioma; `noindex` en perfiles no públicos y en `/admin`; `robots.txt` y `sitemap.xml` generados por el backend con los perfiles públicos.
  - ⏸️ **Limitación conocida:** los scrapers que no ejecutan JavaScript (LinkedIn, WhatsApp, Slack) verán la vista previa genérica del portafolio, no la del perfil. Requiere SSR o prerender; propuesto para 1.1.
- [ ] ⏳ **Backup de DB.** Sin código que escribir. Activar los respaldos del Postgres gestionado y **probar una restauración** siguiendo `docs/DEPLOY.md` § 7. Anotar acá la fecha de la última prueba: `________`.

---

## 🔵 Deseables — 1.0.x o post-lanzamiento

- [x] ✅ **Export PDF de perfil.** Resuelto por `add-printable-one-page`: cada perfil curado tiene una hoja imprimible de una página (A4 y Letter) y el botón **Imprimir / Guardar PDF**. El PDF lo genera el navegador (*Guardar como PDF*), en el idioma de la vista y desde los mismos datos. Un PDF generado en el servidor queda fuera de alcance.
- [ ] **Accesibilidad (a11y).** Auditar con axe o Lighthouse. La base está: roles, `aria-label` en los controles y navegación por teclado en el panel.
- [ ] **Caché / performance.** Cache de los perfiles públicos, lazy-loading de imágenes, Lighthouse > 90.
- [x] ✅ **Dashboard de analítica.** Entregado en la Fase 5: visitas por perfil, idioma y día, con rango de fechas.
- [x] ✅ **CI.** `.github/workflows/ci.yml` corre lint, typecheck, unitarios, e2e contra Postgres (con `prisma migrate deploy` y seed), build y el control del contrato OpenAPI en cada push y PR a `main` (PR #2). El **CD** queda del lado de Railway, que despliega al hacer push a `main` una vez configurado el deploy.
- [ ] **Repositorios destacados reales.** Curaduría manual pendiente (de Manuel): completar `featuredRepositories` en `docs/cv-data.json`. Ver `docs/DATA-POPULATION.md` § 10.
- [ ] ⏸️ **Token CSRF.** Diferido: la cookie es `SameSite` estricto y los endpoints de escritura solo aceptan JSON, así que un formulario cross-site no puede provocar una escritura. Revisar si alguna vez se sirve el frontend desde un subdominio no confiable.

---

## Estado del release

**Todo lo que es código está cerrado.** Los 6 bloqueantes de hardening, el ajuste de empaquetado del CLI de Prisma y la configuración de despliegue. De los importantes queda uno, backups, que no es código y se cierra al desplegar. **Proveedor elegido: Railway** (`docs/DEPLOY.md` § 9.5). Lo que queda para el 1.0.0:

1. Crear el proyecto en Railway y seguir **`docs/DEPLOY-RAILWAY.md`** (la guía corta, con checkboxes). El detalle de cada paso está en `docs/DEPLOY.md`.
2. Activar backups y **probar una restauración** (§ 7), y anotar la fecha en este documento.
3. Correr la verificación posterior al despliegue (§ 5).
4. Pendientes de la ronda 1.1 que necesitan el sitio arriba:
   - **Vista previa de los links** (tarea 5.4 de `add-server-rendered-head`): pegar dos perfiles distintos en el [Post Inspector de LinkedIn](https://www.linkedin.com/post-inspector/) y en un canal de Slack. Las tarjetas tienen que mostrar títulos distintos y la imagen. Capturas en `openspec/changes/archive/2026-10-08-add-server-rendered-head/verification/`.
   - **Migración `curated_profile_lifecycle`**: antes del primer deploy que la incluya, probar `prisma migrate deploy` sobre una restauración del backup de producción (la prueba hecha fue sobre una copia de la base de desarrollo).
   - **Migración `retire_accent_color`** (destructiva: copia el acento a `themeOverrides` y borra la columna `accentColor`): respaldo previo con `pg_dump -Fc` o backup de Railway si la base ya tiene datos. Rollback: restaurar el respaldo y volver a desplegar la imagen anterior. Detalle en `docs/DEPLOY.md` § 9.5.
5. Recién entonces, etiquetar `v1.0.0`.

> Regla de oro: el deploy real es el último paso, no el primero.
