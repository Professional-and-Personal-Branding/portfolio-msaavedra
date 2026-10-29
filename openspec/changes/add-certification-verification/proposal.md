# add-certification-verification — Certificaciones verificables: enlace a la credencial, ID y vencimiento

> Change de la **Fase 1.2** de `docs/PROPUESTA-FEATURES.md` (§ 3 fila *Credly y Accredible*, § 4 E1 ítem **1.1**, § 6.1 y § 6.2 fila `add-certification-verification`). La ficha pide: «`verificationUrl` solo acepta https. Se ve «Ver credencial» en la sección y en el PDF. `print:check` sigue dando una hoja». El ítem 1.1 suma `credentialId` y `expiresAt`. Respeta las decisiones del owner del 2026-10-28 (§ 9): P1 = A (1.2 sin IA, sin OAuth y sin servicios nuevos).

## Why

Hoy una certificación es nombre, emisor y año (`Certification` en `backend/prisma/schema.prisma`). Quien lee el perfil no tiene cómo comprobarla: la credencial existe en el emisor (Credly, Accredible, Microsoft Learn, Platzi, Udemy…), pero el sitio no la enlaza. La propuesta la marca como **impacto alto y esfuerzo S** (§ 6.1): es la evidencia más barata de sumar y la que un reclutador técnico revisa primero.

Los emisores ya publican una **página pública de verificación por credencial**; sus API sirven para emitir, no para que el portador liste sus insignias (§ 3). Alcanza con guardar el enlace que el owner copia del emisor y mostrarlo bien, sin integrarse con nadie.

Que la credencial tenga enlace también es criterio de la curaduría de datos de la Fase 1.0.x (§ 6.2: «Las credenciales tienen enlace»). Sin el campo, ese criterio no se puede cumplir.

## What Changes

- **Tres campos opcionales en `Certification`** (D1, D2): `verificationUrl` (URL absoluta **solo https**, hasta 2048 caracteres), `credentialId` (texto plano de hasta 100 caracteres) y `expiresAt` (`AAAA-MM` o `AAAA`, como las fechas de formación). Ninguno se traduce (`docs/I18N.md` § 2: URLs, identificadores y fechas no se traducen). Vacío o `null` quita el valor.
- **Validación en las tres capas** (D3): dominio (`validateCertification` con `isHttpsUrl`, nuevo en `shared/domain/http-url.ts`, y la regla «el vencimiento no es anterior al año»), DTO (`class-validator`: `@IsUrl({ protocols: ['https'], require_protocol: true })`, `@MaxLength`, `@Matches`) y panel (Zod). Una URL `http://`, `javascript:` o relativa da 400.
- **API pública** (D4): `GET /api/certifications`, la vista curada y el preview suman `verificationUrl`, `credentialId` y `expiresAt` (nulos si no hay). El backend **no** calcula si está vencida: el cliente lo deriva con la fecha del navegador (D5).
- **Sección pública** (D6): cada certificación con enlace muestra **«Ver credencial»** («View credential» en inglés), con `target="_blank"` y `rel="noopener noreferrer"`, nombre accesible que incluye el de la certificación, sin ícono nuevo. Muestra el ID si lo hay, «Válida hasta mm/aaaa» si vence en el futuro y **«Vencida»** si ya venció. Sin enlace, la tarjeta queda como hoy.
- **Hoja imprimible** (D7): «Ver credencial» como enlace clicable en el PDF junto a cada certificación que lo tenga, y «vencida» si venció. No se imprime la URL. Los límites de `PRINT_LIMITS` no cambian y `print:check` sigue dando una hoja.
- **Panel** (D8): el diálogo de certificación de `/admin/formacion` suma **Enlace de verificación**, **ID de credencial** y **Vence**, con sus mensajes literales en el manual.
- **Seed y datos** (D9): el formato del seed acepta los tres campos como opcionales y los valida antes de borrar nada. `docs/cv-data.json` **no cambia** (cargar los enlaces reales es trabajo del owner, ítem 0.3). `docs/examples/cv-data.example.json` suma una credencial vigente con enlace e ID y otra vencida, con dominios de RFC 2606.
- **Migración aditiva** (D10): `ALTER TABLE "Certification" ADD COLUMN …` × 3, sin `UPDATE` ni `DROP`.
- **Sin llamadas a terceros** (D11): ni verificación automática contra el emisor, ni lista blanca de dominios, ni imágenes de insignias.
- **Contrato y docs:** `backend/openapi.json` y `frontend/src/shared/types/api.d.ts` regenerados; `docs/MANUAL.md` e `index.html` (**TC-42**, B6, glosario, capturas), `docs/DATA-POPULATION.md` § 12.6, `docs/CHANGELOG.md`; la línea del roadmap en `CLAUDE.md` al archivar.

## Non-goals

- **Verificar automáticamente** contra el emisor (consultar Credly o Accredible, leer el estado de la insignia, importar la lista de credenciales). Las API son para emisores y la Fase 1.2 no suma servicios (D11).
- **Restringir los dominios** del enlace a una lista de emisores conocidos (D11).
- **Mostrar la imagen de la insignia** o una vista previa del emisor: suma recursos de otros orígenes y rompe la CSP del sitio.
- **Datos estructurados** (`hasCredential` en el JSON-LD del head): queda para `upgrade-profile-structured-data`.
- **Ocultar automáticamente** las certificaciones vencidas. Se muestran marcadas; para sacarlas está **Visible en el sitio** (D5).
- **Cargar los enlaces reales** en `docs/cv-data.json`: es la curaduría del owner (ítem 0.3 de la Fase 1.0.x), desde el panel o editando el archivo.
- **Filtrar certificaciones por tags** en los perfiles curados: no tienen tags y se siguen adjuntando sin filtrar.
- **Avisar en el panel** de las certificaciones sin enlace (un linter de curaduría es otro change).

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `public-portfolio-sections-api`: MODIFIED *Certificaciones visibles* (los tres campos nuevos en la respuesta).
- `admin-content-management`: ADDED *Credencial de una certificación en la API del panel* y *Campos de credencial en el formulario de certificación*. La ficha de la propuesta habla de MODIFIED; se usan requisitos nuevos para no reescribir *Administración de idiomas, enlaces sociales, formación y proyectos*, que no cambia.
- `public-portfolio-frontend`: ADDED *Certificación verificable en la sección pública*.
- `printable-curated-profile`: ADDED *Credenciales en la hoja*.
- `data-persistence-seed`: ADDED *Campos de credencial opcionales en el seed*.
- `example-seed-data`: ADDED *Certificaciones verificables en el ejemplo*.

## Impact

- **Base (`backend/prisma/`):** tres columnas `TEXT` nulas en `Certification` y una migración nueva, aditiva.
- **Backend (`backend/src/`):**
  - `shared/domain/http-url.ts`: `isHttpsUrl`.
  - `modules/education/domain/`: entidad `Certification` con los tres campos; `validateCertification` con las reglas nuevas; constantes `CREDENTIAL_ID_MAX`, `VERIFICATION_URL_MAX` y `CERTIFICATION_DATE_REGEX`.
  - `modules/education/application/`: `CertificationOutput`, el DTO de salida del panel y sus mappers.
  - `modules/education/infrastructure/`: `CreateCertificationDto`/`UpdateCertificationDto`, el mapper de Prisma y los schemas de respuesta de Swagger (público y del panel).
  - `modules/curated-profile/`: solo los schemas de respuesta de Swagger (la vista curada reusa `toCertificationOutput`).
- **Scripts (`backend/scripts/`):** `lib/seed-source.ts` (tipo y validación), `lib/seed-runner.ts` (escritura) y `verify-seed.ts` (comparación de los campos).
- **Frontend (`frontend/src/`):** `shared/components/portfolio/Certifications.tsx`, `shared/lib/` (función pura `certificationValidity`), `shared/i18n/messages.ts`, `features/curated-view/print/print-sheet.ts` y `PrintableSheet.tsx`, `features/backoffice/formacion/formacion-form.ts` y `FormacionForms.tsx`, fixtures de test y `api.d.ts` regenerado.
- **Datos:** `docs/examples/cv-data.example.json` (dos certificaciones existentes ganan campos; los conteos no cambian).
- **Docs:** `docs/MANUAL.md`, `docs/manual/index.html` y capturas (`tc42-credencial.jpg` nueva; `bo-formacion-certificacion.jpg` regenerada), `frontend/scripts/capture-manual.mjs` (manifiesto), `docs/DATA-POPULATION.md`, `docs/CHANGELOG.md`, `CLAUDE.md`.
- **Sin cambios** en Caddy, la CSP, `Referrer-Policy`, el head del servidor, el sitemap, `PRINT_LIMITS`, la analítica ni las dependencias de `package.json`.
- **Operación:** la migración corre sola en el `preDeployCommand`. No hay backfill: las certificaciones existentes quedan sin enlace hasta que el owner lo cargue.
