# Tasks — add-certification-verification

> Referencias: `proposal.md`, `design.md` (D1–D11, P1) y los deltas de `specs/` (`public-portfolio-sections-api`, `admin-content-management`, `public-portfolio-frontend`, `printable-curated-profile`, `data-persistence-seed`, `example-seed-data`). La evidencia va en `verification/`, como en `add-share-links`.
>
> **Orden:** 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10. Cada grupo de código va en el mismo commit que sus tests. El 9 (docs) puede escribirse en paralelo con el 7, salvo las capturas, que necesitan el 8.
>
> **Bases:**
> - `portfolio` (la del owner, `localhost:5434`): **ninguna** tarea le aplica la migración ni le escribe.
> - Los e2e corren contra la base de e2e de siempre (migrada y sembrada), nunca contra `portfolio`.
> - `portfolio_cert_check`: base descartable **nueva** en el mismo contenedor, para generar la migración (3.1) y para la app real (8), sembrada con el ejemplo; borrada al terminar el 8. En PowerShell: `$env:DATABASE_URL = "postgresql://portfolio:portfolio@localhost:5434/portfolio_cert_check?schema=public"`.
>
> Antes de cada comando que escriba en una base, correr `npm run prisma:status` y confirmar el destino. `backend/.env` apunta a `portfolio`: la variable de la terminal tiene que estar definida en la misma sesión.

## 1. Punto de partida

- [x] 1.1 Confirmar en la rama: `Certification` sin columnas de credencial; `GET /api/certifications` devuelve `id, name, issuer, year, order`; el bloque `certifications` de `print-sheet.ts` es `string[]` con `line-clamp-2`; `Projects.tsx` ya importa `ArrowUpRight`. Verificar: `npm test` y `npm run test:e2e` en `backend/` y `npm test` y `npm run perf:budget` (tras `npm run build`) en `frontend/` verdes antes de tocar nada; notas y el tamaño del arranque en `verification/1.1-punto-de-partida.txt`.

## 2. Dominio (D1, D2, D3)

- [x] 2.1 `shared/domain/http-url.ts`: `isHttpsUrl(value)` (`new URL`, `protocol === 'https:'`, `false` si no parsea). Verificar: tests de 2.4.
- [x] 2.2 `modules/education/domain/entities/certification.entity.ts`: `verificationUrl`, `credentialId` y `expiresAt` (`string | null`) en `CertificationProps`, con sus getters. Verificar: `npm run typecheck`.
- [x] 2.3 `domain/services/validate-certification.ts`: `CERTIFICATION_DATE_REGEX`, `VERIFICATION_URL_MAX = 2048`, `CREDENTIAL_ID_MAX = 100` y las reglas de D3 en este orden (URL https y largo; ID no vacío y largo; formato de `expiresAt`; año de `expiresAt` ≥ `year`), cada una con su `ValidationError` y campo. Verificar: tests de 2.4 y el test de arquitectura (sin Nest ni Prisma en `domain/`).
- [x] 2.4 Tests unitarios: `isHttpsUrl` con `https://a.dev` (sí), `http://a.dev`, `javascript:alert(1)`, `data:text/html,x`, `/c/1` y `no es url` (no); `validateCertification` acepta los tres en `null` y la combinación completa; rechaza URL `http`, URL de 2049 caracteres, ID vacío o de 101, `expiresAt` `2029-13`, `06/2029` y `29`, y `year: "2023"` con `expiresAt: "2022-12"`; acepta `year: "2023"` con `expiresAt: "2023"`. Verificar: `npm test` verde.

## 3. Persistencia y migración (D1, D10)

- [x] 3.1 `backend/prisma/schema.prisma`: `verificationUrl String?`, `credentialId String?` y `expiresAt String?` en `Certification`. Migración `<timestamp>_add_certification_credential` con `prisma migrate dev --create-only` **contra `portfolio_cert_check`**, revisada a mano: solo `ADD COLUMN`, sin `UPDATE` ni `DROP`. Verificar: el SQL en `verification/3.1-migracion.sql`; `npm run prisma:generate` y `npm run typecheck` verdes; `prisma migrate diff --from-url <portfolio_cert_check> --to-schema-datamodel prisma/schema.prisma --exit-code` sin diferencias.
- [x] 3.2 `infrastructure/persistence/education.prisma-mapper.ts` y `prisma-education.repository.ts`: leer y escribir los tres campos. Verificar: `education.prisma-mapper.spec.ts` ampliado (ida y vuelta con valores y con `null`) verde.

## 4. Aplicación y API (D3, D4)

- [x] 4.1 `application/dto/education.output.ts` y `education.admin-output.ts`: los tres campos en `CertificationOutput` y en el DTO del panel; `education.mapper.ts` y `education.admin-mapper.ts` los copian sin transformar. Verificar: `education.use-cases.spec.ts` y `education-admin.use-cases.spec.ts` (repositorios simulados) comprueban que el listado público y el del panel los devuelven, y que crear o editar con un valor inválido devuelve el `ValidationError` sin llamar a `save`.
- [x] 4.2 `infrastructure/controllers/dto/certification.dto.ts`: los tres campos con los decoradores de D3 (`@IsUrl({ protocols: ['https'], require_protocol: true })`, `@MaxLength`, `@Matches(CERTIFICATION_DATE_REGEX)`), `nullable` en Swagger; `toNewCertificationProps` y `toCertificationChanges` recortan, convierten `''` en `null` y en el `PATCH` distinguen `null` (quitar) de ausente (no tocar). Verificar: tests unitarios de los dos mappers del DTO.
- [x] 4.3 Schemas de respuesta de Swagger: `education.response.ts`, `admin-education.response.ts`, `curated-profile.response.ts` y `preview-curated-profile.response.ts` declaran los tres campos `nullable`. Verificar: `npm run openapi:export` los muestra en `backend/openapi.json`.
- [x] 4.4 E2e (`certifications-credential.e2e-spec.ts` o el e2e de formación existente): tras el seed los tres campos son `null` en `GET /api/certifications` y en `GET /api/curated-profiles/all`; `PATCH` con los tres → 200 y aparecen en `/api/admin/certifications`, `/api/certifications?locale=en` y en la vista curada, sin campo `expired`; `POST` con `http://…`, `javascript:…` y `/c/1` → 400 sin crear; `credentialId` de 101 → 400; `year: "2023"` con `expiresAt: "2022-12"` → 400 y sin cambios; `PATCH { verificationUrl: null }` → quita solo el enlace; campo desconocido → 400; sin token → 401. Restaurar los valores al terminar. Verificar: `npm run test:e2e` verde; salida en `verification/4.4-e2e.txt`.

## 5. Seed y datos de ejemplo (D9)

- [x] 5.1 `scripts/lib/seed-source.ts`: `SeedCertification` con los tres campos opcionales; la validación de `certifications[i]` usa `isHttpsUrl`, `CERTIFICATION_DATE_REGEX`, los largos y la regla del año importados del dominio, y nombra el campo. `scripts/lib/seed-runner.ts` los escribe (ausente → `null`). Verificar: tests de `seed-source` (archivo con URL `http` → error en `certifications[0].verificationUrl`; con ID de 101 → error; sin los campos → válido).
- [x] 5.2 `scripts/verify-seed.ts`: compara los tres campos de cada certificación por orden y nombra la que difiere. Verificar: test unitario de la comparación (igual, distinto en `credentialId`).
- [x] 5.3 `docs/examples/cv-data.example.json`: la primera certificación visible suma `verificationUrl: "https://example.org/credenciales/arquitecto-nube-2023"`, `credentialId: "EJ-2023-0042"` y `expiresAt: "2029-06"`; *Liderazgo técnico para equipos de ingeniería* suma `expiresAt: "2025-12"`. `docs/cv-data.json` **no se toca**. Verificar: el test del archivo de ejemplo (URLs con `https://` y RFC 2606, ahora también `verificationUrl`) y `example-translations.spec.ts` verdes.
- [x] 5.4 Sobre `portfolio_cert_check` vacía y migrada: `SEED_DISPOSABLE_DB=1 npm run seed:example` y `npm run seed:example:verify` → código 0; cambiar a mano el `credentialId` sembrado y repetir la verificación → código 1 nombrando el campo; volver a sembrar. Verificar: transcripción en `verification/5.4-seed.txt`.

## 6. Contrato y vista pública (D4, D5, D6, D7)

- [ ] 6.1 `npm run openapi:export` y, en `frontend/`, `npm run api:types`: los tres campos aparecen en `CertificationResponse`, en la vista curada, en el preview y en el panel. Verificar: el test de deriva del frontend verde y `git diff --exit-code` tras un segundo export.
- [ ] 6.2 `frontend/src/shared/lib/certification-validity.ts`: `certificationValidity(expiresAt, now)` → `'none' | 'valid' | 'expired'` (fin de mes con `AAAA-MM`, fin de año con `AAAA`). Verificar: `certification-validity.spec.ts` con `now` fijo en 2026-10-29: `null` → `none`; `2026-10` → `valid`; `2026-09` → `expired`; `2026` → `valid`; `2025` → `expired`; `2029-06` → `valid`.
- [ ] 6.3 `shared/i18n/messages.ts`: claves `certification.verify` («Ver credencial» / «View credential»), `certification.credentialId` («ID» / «ID»), `certification.validUntil` («Válida hasta {date}» / «Valid until {date}»), `certification.expired` («Vencida» / «Expired») y `print.certification.expired` («vencida» / «expired»). Verificar: el test de paridad de claves ES/EN, si existe, verde.
- [ ] 6.4 `shared/components/portfolio/Certifications.tsx`: línea de detalle (ID y vigencia con `formatMonthYear`) y enlace «Ver credencial» de D6 (`target="_blank"`, `rel="noopener noreferrer"`, `sr-only` con el nombre, `ArrowUpRight`, clases del enlace de `Projects.tsx`). Sin datos nuevos, el DOM de la tarjeta queda igual. Verificar: tests de 6.6.
- [ ] 6.5 `features/curated-view/print/print-sheet.ts`: `buildPrintSheet(data, locale, origin, now = new Date())`; ítems `{ text, credential, expired }` de D7. `PrintableSheet.tsx`: un párrafo con `line-clamp-3`, cada ítem con `LinkOrText` para la credencial, separados por « · ». Verificar: tests de 6.6.
- [ ] 6.6 Tests de Vitest:
  - `layouts.test.tsx` o un test nuevo de `Certifications`: enlace con `href`, `target` y `rel` exactos; nombres accesibles distintos para dos credenciales; «View credential» con `?lang=en`; «Válida hasta» y «Vencida» con `vi.setSystemTime(new Date('2026-10-29'))`; tarjeta sin datos nuevos sin enlace ni línea de detalle.
  - `print-sheet.spec.ts`: credencial como `PrintLink` sin la URL en el texto; «(Escuela Demo, vencida)» y «(…, expired)»; sin credenciales, el mismo texto que antes; los límites no cambian.
  - `PrintableSheet.test.tsx`: el enlace «Ver credencial» con su `href` y sin `data-motion`.
  - Fixtures (`test/fixtures/curated-profile.ts`, `admin.ts`, `msw-admin.ts`) con los tres campos.

  Verificar: `npm test`, `npm run lint` y `npm run typecheck` verdes en `frontend/`.
- [ ] 6.7 `npm run build` y `npm run perf:budget`: el arranque público sigue ≤ 155 KB gzip y en un solo JS de módulo. Verificar: salida en `verification/6.7-perf-budget.txt`, con la diferencia frente a 1.1.

## 7. Panel (D8)

- [ ] 7.1 `features/backoffice/formacion/formacion-form.ts`: `certificationSchema` con los tres campos y los mensajes literales de D8; `EMPTY_CERTIFICATION`, `toCertificationValues` (`null` → `''`) y `toCertificationBody` (`''` → `null`, recortado). Verificar: tests de 7.3.
- [ ] 7.2 `FormacionForms.tsx`: **Enlace de verificación** (con la ayuda de D8, `type="url"`, `inputMode="url"`), **ID de credencial** y **Vence** (placeholder `AAAA-MM`), con sus errores asociados por `aria-describedby`. Verificar: tests de 7.3.
- [ ] 7.3 Tests de Vitest (`formacion-form.spec.ts` y `FormacionPage.test.tsx`): los escenarios de *Campos de credencial en el formulario de certificación* (http → mensaje y ninguna petición; `06/2029` → mensaje; vaciar el enlace → `PATCH` con `null`; editar solo el ID y cancelar → confirmación), más «El ID de credencial admite hasta 100 caracteres» y «El vencimiento no puede ser anterior al año». Verificar: `npm test`, `npm run lint` y `npm run typecheck` verdes en `frontend/`.

## 8. App real sobre base descartable

- [ ] 8.1 Preparar `portfolio_cert_check`: migrar, `SEED_DISPOSABLE_DB=1 npm run seed:example` y `npm run admin:bootstrap` con credenciales de prueba del `.env.example`. Levantar la imagen de `frontend/Dockerfile` contra la API local, como en TC-35. Verificar: `npm run prisma:status` muestra `portfolio_cert_check`; `GET /health` 200.
- [ ] 8.2 Recorrer **TC-42** completo en Chrome no headless (pasos de `verification.md`). Verificar: transcripción en `verification/8.2-tc42.txt` con el `href`, el `target` y el `rel` leídos del DOM, las respuestas 400 y 200 de la API y la consola sin violaciones de CSP.
- [ ] 8.3 `PRINT_CHECK_DISPOSABLE_DB=1 npm run print:check` contra la imagen sobre `portfolio_cert_check` (ejemplo, con la credencial) y contra otra base descartable sembrada con `docs/cv-data.json`. Verificar: todas las combinaciones en una página; salidas en `verification/8.3-print-check.txt`; en el PDF de `/` el enlace «Ver credencial» es clicable y apunta a la URL del ejemplo.
- [ ] 8.4 `A11Y_CHECK_DISPOSABLE_DB=1 A11Y_CHECK_PROFILE=ejemplo-backend npm run a11y:check` con el panel. Verificar: sin violaciones nuevas en la sección de certificaciones ni en el diálogo de formación frente a la corrida de `add-share-links`; salida en `verification/8.4-a11y.txt`. Borrar las bases descartables al terminar.

## 9. Documentación

- [ ] 9.1 `docs/MANUAL.md`: **TC-42 — Verificar una certificación desde el sitio** (texto de `verification.md`, sección 3 junto a TC-26), tabla de B6 con **Enlace de verificación**, **ID de credencial** y **Vence** y los cuatro mensajes literales de D8, fila de TC-42 en la suite (§ 6), glosario (*credencial*, *enlace de verificación*) y el paso de R6 que menciona la formación. Capturas con `npm run manual:capture` contra la API de ejemplo: `tc42-credencial.jpg` nueva (sección pública con «Ver credencial» y «Vencida») y `bo-formacion-certificacion.jpg` regenerada (diálogo con los campos nuevos y el error de https); `capture-manual.mjs` suma la entrada al manifiesto. Verificar: las capturas en `docs/manual/`, cada una ≤ 150 KB.
- [ ] 9.2 `docs/manual/index.html` alineado con `MANUAL.md` (caso, índice lateral, `td.msg` con los mensajes nuevos, imágenes). Verificar: `npm run manual:check` verde.
- [ ] 9.3 `docs/DATA-POPULATION.md` § 12.6: filas de `verificationUrl`, `credentialId` y `expiresAt` con las seis columnas (tipo, obligatorio/defecto, ejemplo del archivo, dónde se ve, panel). Verificar: el escenario *Campo documentado* de `example-seed-data` (cada clave del ejemplo tiene fila).
- [ ] 9.4 `docs/CHANGELOG.md` (entrada del change) y `docs/PROPUESTA-FEATURES.md` § 6.2 (fila marcada como hecha, con el nombre de los requisitos ADDED en `admin-content-management`). Verificar: revisión del diff.
- [ ] 9.5 Al archivar, `CLAUDE.md` § Roadmap suma la línea: `- [x] \`add-certification-verification\` — cada certificación puede llevar \`verificationUrl\` (solo https), \`credentialId\` y \`expiresAt\` (\`AAAA-MM\` o \`AAAA\`); «Ver credencial» en la sección y en el PDF, «Vencida» derivada en el cliente, sin llamadas al emisor; migración aditiva y seed retrocompatible (archivado AAAA-MM-DD)`. Verificar: revisión del diff del archivado.

## 10. Cierre

- [ ] 10.1 `backend/`: `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:e2e`; `frontend/`: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run perf:budget`, `npm run manual:check`. Verificar: todo verde; salida en `verification/10.1-cierre.txt`.
- [ ] 10.2 `npx -y @fission-ai/openspec@1.14.1 validate add-certification-verification --strict` y `validate --all --strict`, sin «Archive would refuse». Verificar: salida en `verification/10.2-validacion.txt`.
- [ ] 10.3 Comprobar que la base `portfolio` del owner no cambió (`prisma migrate status` contra ella sin la migración nueva aplicada). Verificar: nota en `verification/10.3-base-del-owner.txt`.
