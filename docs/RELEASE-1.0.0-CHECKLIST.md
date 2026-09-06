# Checklist de Release 1.0.0 — Hardening para Producción

> Este documento recoge lo que separa un "funciona en mi máquina" de un **release 1.0.0 sano** desplegable a producción. Está pensado para trabajarse con Claude Code durante la fase de implementación, **después** de que el código de aplicación (backend NestJS + frontend React) esté funcionando, y **antes** del deploy real.
>
> Marcá cada ítem a medida que lo cierres. El deploy a producción es el último paso, una vez que los bloqueantes e importantes estén en verde.

---

## 🔴 Bloqueantes — sin esto NO se despliega a producción

Riesgo concreto, no teórico. Cada uno de estos, omitido, abre una vulnerabilidad real o puede tumbar la app.

- [ ] **Secretos fuertes.** Generar un `JWT_SECRET` aleatorio y largo (p. ej. `openssl rand -base64 48`); nunca usar el valor de `.env.example`. Cambiar `ADMIN_PASSWORD` en el primer arranque. Confirmar que `.env` está en `.gitignore` (ya lo está) y que ningún secreto quedó commiteado en el historial de git.
- [ ] **Migraciones Prisma en producción.** Usar `prisma migrate deploy` (aplica migraciones versionadas), nunca `prisma db push` (que puede provocar pérdida de datos). Generar la primera migración con `prisma migrate dev --name init` en desarrollo y versionarla.
- [ ] **CORS estricto.** Configurar CORS para permitir únicamente el dominio real del frontend (vía `FRONTEND_URL`), no `*`. Limitar métodos y headers a los necesarios.
- [ ] **Validación de inputs.** DTOs con `class-validator` + `ValidationPipe` global (whitelist + forbidNonWhitelisted) en cada endpoint que reciba datos. Nada llega a la capa de dominio sin validar.
- [ ] **Manejo global de errores.** Filtro de excepciones global de NestJS que devuelva errores limpios y consistentes al cliente. Nunca exponer stack traces, rutas internas ni detalles de la DB en las respuestas.
- [ ] **Healthcheck.** Endpoint `/health` (y opcionalmente `/health/ready` y `/health/live`) que el orquestador (Railway/Render) consulte para liveness/readiness. Idealmente verifica conectividad con la DB.

---

## 🟡 Importantes — deberían entrar en 1.0.0

No bloquean el arranque, pero un release que se precie de "1.0.0" los incluye.

- [ ] **Rate limiting.** `@nestjs/throttler` a nivel global, con un límite más estricto en el login del backoffice para frenar fuerza bruta.
- [ ] **Security headers.** Integrar Helmet. Forzar HTTPS en producción. Cookies de sesión/refresh con `httpOnly`, `secure` y `sameSite`.
- [ ] **Logging estructurado.** Logger con niveles (info/warn/error), request id por petición, y reglas para no loguear datos sensibles (passwords, tokens, PII). Útil para diagnosticar incidentes en producción.
- [ ] **Tests mínimos.** No se busca 95% de cobertura para 1.0.0, sino cubrir lo que más duele si se rompe:
  - Caso de uso `ResolveCuratedProfile` (que un perfil resuelve bien sus experiencias por tags).
  - Fallback de i18n (si falta una traducción, devuelve el idioma por defecto sin romper).
  - Al menos un test e2e del endpoint público de perfil.
- [ ] **SEO + OpenGraph.** Meta tags por perfil curado (title, description) y tags OpenGraph/Twitter Card para que los links compartidos a empresas se vean bien. Sitemap básico.
- [ ] **Backup de DB.** Activar los respaldos automáticos del Postgres gestionado (Railway/Render/Neon/Supabase suelen ofrecerlos). Verificar que se puede restaurar.

---

## 🔵 Deseables — 1.0.x o post-lanzamiento

Mejoras de valor que no justifican retrasar el lanzamiento.

- [ ] **Export PDF de perfil.** Generar un PDF del perfil curado, cerrando el círculo con la biblioteca de CVs. (Reutilizable: el mismo concepto de "perfil filtrado por tags" que alimenta la web.)
- [ ] **Accesibilidad (a11y).** Foco visible, contraste suficiente, navegación por teclado, roles ARIA, alt en imágenes. Auditar con axe o Lighthouse.
- [ ] **Caché / performance.** Cache de los perfiles públicos (que cambian poco), lazy-loading de imágenes, score de Lighthouse > 90 en performance.
- [ ] **Dashboard de analítica.** Ya existe el modelo `ProfileView` (con campo `locale`); falta una vista en el backoffice que muestre visitas por perfil, idioma y fecha.
- [ ] **CI/CD.** Pipeline (GitHub Actions) que en cada push corra lint + tests + build, y opcionalmente despliegue automático al hacer merge a main.
- [ ] **Repositorios destacados reales.** Curaduría manual pendiente (de Manuel): definir qué repos profesionales mostrar en `featuredRepositories` y completar el placeholder en `cv-data.json`. Ver `docs/DATA-POPULATION.md` sección 10.

---

## Orden sugerido de trabajo

1. Completar el código de aplicación según el roadmap (Fases 1–5 de `ARCHITECTURE.md`).
2. Cerrar todos los **🔴 bloqueantes**.
3. Cerrar los **🟡 importantes** (al menos rate limiting, security headers, logging, tests mínimos y backup).
4. Hacer el **deploy** a producción (backend en Railway/Render, frontend en Vercel, Postgres gestionado).
5. Iterar los **🔵 deseables** en releases 1.0.x posteriores.

> Regla de oro: el deploy real es el último paso, no el primero. Un 1.0.0 con los bloqueantes e importantes en verde es un lanzamiento del que no te vas a arrepentir.
