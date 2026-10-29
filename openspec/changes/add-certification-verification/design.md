# Design — add-certification-verification

## Context

Ver `proposal.md`. Estado verificado el 29 de octubre de 2026 sobre `main` (`fb21a46`, con `add-share-links` fusionado y sin archivar):

- **Modelo.** `Certification { id, name Json, issuer String, year String?, order Int, visible Boolean }`. La entidad de dominio (`modules/education/domain/entities/certification.entity.ts`) es bilingüe en `name`; `validateCertification` exige emisor y `name.es` y `year` `^\d{4}$` o `null`.
- **API.** `CertificationOutput { id, name, issuer, year, order }` lo arma `toCertificationOutput(c, locale)`, que reusan `GET /api/certifications` y la vista curada (`curated-profile.mapper.ts`), así que el preview del constructor también lo recibe. El panel usa `CreateCertificationDto`/`UpdateCertificationDto` (`PartialType`) con `adminValidationPipe` (whitelist).
- **URLs ya validadas en el repo.** `Project.url` y `SocialLink.url` aceptan http(s): `isHttpUrl` (`shared/domain/http-url.ts`) en el dominio y `@IsUrl({ protocols: ['http','https'], require_protocol: true })` en el DTO. `Projects.tsx` enlaza con `target="_blank" rel="noreferrer"` y `ArrowUpRight`.
- **Sección pública.** `Certifications.tsx` muestra una grilla de tarjetas con `Award`, nombre (`truncate`) y «emisor · año».
- **Hoja imprimible.** `print-sheet.ts` arma el bloque `certifications` como `items: string[]` («Nombre (emisor, año)», hasta 4) y `PrintableSheet.tsx` lo pinta en un solo párrafo con `line-clamp-2`. `PrintLink { text, href? }` y `LinkOrText` ya resuelven los enlaces clicables en el PDF.
- **Panel.** `formacion-form.ts` tiene el schema Zod de certificación (nombre, emisor, año, orden, visible) y `FormacionForms.tsx` el diálogo; el aviso de cambios sin guardar compara valores, así que los campos nuevos entran solos.
- **Seed.** `seed-source.ts` valida `certifications[]` (`name`, `issuer`, `year`, `visible` opcional) antes de borrar; `seed-runner.ts` las crea en orden. `docs/cv-data.json` tiene 8 certificaciones sin enlaces; el ejemplo tiene 3 (una sin año, una oculta).
- **Borde.** Caddy responde `Referrer-Policy no-referrer` y una CSP que no permite recursos de otros orígenes; un `<a href>` externo no la afecta.

## Goals / Non-Goals

**Goals:** que cada certificación pueda llevar el enlace a su página de verificación, su ID y su vencimiento; que el sitio y el PDF ofrezcan «Ver credencial» sin perder la hoja única ni el presupuesto de JS; que una URL insegura no pueda guardarse por ninguna vía (panel, API, seed); que el cambio sea retrocompatible con los datos y el contrato actuales.

**Non-Goals:** ver `proposal.md` § Non-goals.

## Decisions

### D1 — Tres columnas opcionales en `Certification`, no una entidad `Credential`

```prisma
model Certification {
  // … campos actuales …
  verificationUrl String?  // https absoluta, ≤ 2048
  credentialId    String?  // texto plano, ≤ 100
  expiresAt       String?  // AAAA-MM o AAAA
}
```

- Una certificación tiene a lo sumo una credencial; los tres datos se leen y se editan juntos y siempre con su certificación.
- La entidad de dominio suma `verificationUrl`, `credentialId` y `expiresAt` (`string | null`) a `CertificationProps`; `with(changes)` ya cubre la edición parcial.
- El nombre `expiresAt` es el de la propuesta (ítem 1.1). Es un `String` con precisión de mes, como `Education.startDate`/`endDate`, porque los emisores expresan el vencimiento por mes o por año, no por instante. No se confunde con el `expiresAt` `DateTime` que `add-profile-expiration` pondrá en el perfil curado: viven en modelos distintos.

Alternativas descartadas:
- **Un modelo `Credential` 1:1.** Una tabla, una FK y un join más para tres campos que no tienen vida propia.
- **Un `Json` libre `credential`.** Sin tipos en la base, sin validación por campo en el DTO y con más trabajo en el seed y el OpenAPI.
- **`expiresAt DateTime`.** Obligaría a inventar el día y la zona horaria, y el panel tendría que pedir una fecha completa que el emisor casi nunca da.

### D2 — Ninguno de los tres campos es bilingüe

`docs/I18N.md` § 2: URLs, identificadores y fechas no se traducen. Un emisor publica una sola URL de verificación por credencial (la página detecta el idioma del visitante), y el ID y el vencimiento son iguales en todo idioma. Lo que sí cambia por idioma son las etiquetas de la interfaz («Ver credencial» / «View credential», «Vencida» / «Expired»), que viven en `messages.ts`. `detectMissingTranslations` no cambia.

Alternativa descartada: **`verificationUrl` como `LocalizedText`.** Duplicaría la misma URL en casi todos los casos y obligaría al panel a pedir dos campos para un dato único.

### D3 — Solo https, validado en dominio, DTO y panel

- **Dominio:** `isHttpsUrl(value)` en `shared/domain/http-url.ts` (mismo patrón que `isHttpUrl`: `new URL()` y `protocol === 'https:'`). `validateCertification` suma, en este orden: `verificationUrl` https y ≤ 2048; `credentialId` no vacío tras recortar y ≤ 100; `expiresAt` con `CERTIFICATION_DATE_REGEX` (`^\d{4}(-(0[1-9]|1[0-2]))?$`); si hay `year` y `expiresAt`, el año de `expiresAt` MUST ser ≥ `year`. Cada falla es un `ValidationError` con el campo.
- **DTO:** `verificationUrl` con `@IsOptional() @IsUrl({ protocols: ['https'], require_protocol: true }) @MaxLength(2048)`; `credentialId` con `@IsOptional() @IsString() @MaxLength(100)`; `expiresAt` con `@IsOptional() @Matches(CERTIFICATION_DATE_REGEX)`. Los tres aceptan `null` para quitar el valor (en `PATCH`, `null` borra y la clave ausente no toca, como `Project.url`). Los mappers recortan espacios y convierten `''` en `null`.
- **Panel:** el schema Zod repite las reglas con los mensajes literales de D8; el cuerpo manda `null` para un campo vacío.
- Se rechazan `http://` (la propuesta lo exige: un enlace de verificación sin TLS se puede reemplazar en tránsito), `javascript:`, `data:` y las relativas.

Alternativas descartadas:
- **Aceptar http como `Project.url`.** La ficha de la propuesta pide https; todos los emisores relevados sirven https.
- **Validar solo en el DTO.** El seed no pasa por el DTO: sin la regla en el dominio (que el seed reusa, D9), un archivo podría cargar `javascript:`.

### D4 — La API pública devuelve los tres campos tal cual

`CertificationOutput` suma `verificationUrl: string | null`, `credentialId: string | null` y `expiresAt: string | null`. Lo reciben `GET /api/certifications`, `GET /api/curated-profiles/:slug` y `POST /api/admin/curated-profiles/preview`, porque todos usan `toCertificationOutput`. El listado del panel devuelve los mismos campos crudos. Son campos nuevos y nulos por defecto: un cliente viejo los ignora.

Los schemas de respuesta de Swagger (`education.response.ts`, `admin-education.response.ts`, `curated-profile.response.ts`, `preview-curated-profile.response.ts`) los declaran `nullable`.

### D5 — La vigencia se deriva en el cliente con la fecha del navegador

- Función pura `certificationValidity(expiresAt, now)` en `frontend/src/shared/lib/certification-validity.ts` → `'none' | 'valid' | 'expired'`. Con `AAAA-MM`, vence al terminar ese mes (vencida si el mes actual es posterior); con `AAAA`, al terminar ese año. `now` se inyecta: `Certifications.tsx` usa `new Date()` y `buildPrintSheet` recibe `now` como parámetro (por defecto `new Date()`), para que los tests sean deterministas.
- Las certificaciones vencidas **se muestran**, marcadas «Vencida». El owner decide si sacarlas con **Visible en el sitio**; el enlace se conserva porque la página del emisor dice el estado real.

Alternativas descartadas:
- **Un `expired: boolean` calculado en el backend con `CLOCK`.** La misma respuesta cambiaría con el paso del tiempo sin que cambien los datos, habría que inyectar el reloj en dos módulos (`education` y `curated-profile`) y en los e2e, y el frontend tendría que confiar en la hora del servidor de todos modos. La vigencia es presentación relativa al lector.
- **Ocultar las vencidas automáticamente.** Esconde un dato que el owner cargó sin que lo decida, y el resultado dependería de la fecha en que se abre el link.

### D6 — Sección pública: «Ver credencial» con nombre accesible propio

En cada tarjeta de `Certifications.tsx`:

- Debajo de «emisor · año», una línea de detalle con `ID: <credentialId>` si lo hay y «Válida hasta mm/aaaa» («Valid until …») o **«Vencida»** («Expired») según D5. El mes se formatea con `formatMonthYear` en el idioma de la vista; con `AAAA` solo se muestra el año.
- Si hay `verificationUrl`: un enlace **«Ver credencial»** («View credential») con `href` a la URL, `target="_blank"`, `rel="noopener noreferrer"`, las clases del enlace de `Projects.tsx` (`text-brand-ink`, que ya cumple AA con cualquier tema) y el ícono `ArrowUpRight` que ese componente ya importa, para no sumar íconos al bundle. El nombre accesible es «Ver credencial: <nombre de la certificación>» (texto visible más un `sr-only`), para que varios enlaces de la misma sección no se anuncien iguales.
- Sin enlace, ID ni vencimiento, la tarjeta queda idéntica a la actual.
- El texto visible es «Ver credencial» y no «Verificar», como dice la ficha de la propuesta: el enlace lleva a la página del emisor, que es quien verifica.

Alternativas descartadas:
- **Toda la tarjeta como enlace.** Mezcla la lectura con la navegación y en móvil dispara aperturas sin querer.
- **`rel="noreferrer"` solo, como `Projects.tsx`.** Equivale en los navegadores actuales, pero la propuesta y el brief piden `noopener noreferrer` explícito; no cuesta nada y no depende de la semántica implícita de `noreferrer`.

### D7 — Hoja imprimible: el enlace clicable sin imprimir la URL

- El bloque `certifications` pasa de `items: string[]` a `items: { text: string; credential: PrintLink | null; expired: boolean }[]`. `text` sigue siendo «Nombre (emisor, año)»; si está vencida, el paréntesis suma «vencida» («expired»): «Nombre (emisor, 2021, vencida)».
- `credential` es `{ text: 'Ver credencial', href: verificationUrl }` (en inglés «View credential»). `PrintableSheet` lo pinta con `LinkOrText` a continuación del texto, en el **mismo párrafo** separado por « · » de la siguiente certificación. En el PDF es un enlace; en papel se lee la etiqueta, y la URL de la versión completa, que la hoja ya imprime al final, lleva a la sección con todos los enlaces.
- No se imprime la URL de la credencial: las de Credly o Accredible pasan de 50 caracteres y cuatro de ellas no entran en el bloque sin romper la hoja única.
- El párrafo pasa de `line-clamp-2` a `line-clamp-3`, para que una etiqueta no quede recortada sin aviso. Con los datos del owner (sin enlaces) el texto es idéntico al de hoy, así que no gana líneas; con el ejemplo (una credencial) se verifica con `print:check`.
- `PRINT_LIMITS` no cambia. El ID y la fecha de vencimiento no se imprimen (solo la marca «vencida»).

Alternativas descartadas:
- **Una línea por certificación.** Hasta 4 líneas más en el peor caso; la hoja de los perfiles más largos ya está al límite.
- **Imprimir el dominio (`credly.com`) como en LinkedIn.** No identifica la credencial y ocupa más que la etiqueta.
- **No llevar el enlace al PDF.** La ficha de la propuesta lo pide explícitamente («en el PDF»), y un PDF que se reenvía es justamente donde más se usa.

### D8 — Panel: tres campos en el diálogo de certificación

- `certificationSchema` suma `verificationUrl`, `credentialId` y `expiresAt` como texto (vacío permitido). Mensajes literales (citados en `docs/MANUAL.md` § B6, que `manual:check` busca en `frontend/src`):
  - «Usá una URL completa que empiece con https://» (formato o protocolo inválido, o más de 2048 caracteres).
  - «El ID de credencial admite hasta 100 caracteres».
  - «Usá el formato AAAA-MM o AAAA» (ya existe; se reusa para `expiresAt`).
  - «El vencimiento no puede ser anterior al año».
- Etiquetas: **Enlace de verificación** (con la ayuda «La página pública de la credencial en el emisor, por ejemplo Credly o Accredible»), **ID de credencial** y **Vence**. Ninguno es obligatorio. Los textos del panel van solo en español, como el resto del backoffice.
- `toCertificationValues` y `toCertificationBody` mapean `null` ↔ `''`.
- La lista de certificaciones no cambia.

### D9 — Seed: campos opcionales, misma regla que el dominio, sin tocar `cv-data.json`

- `SeedCertification` suma `verificationUrl?`, `credentialId?` y `expiresAt?` (`string | null`). `checkSource` valida con las mismas funciones del dominio (`isHttpsUrl`, el regex, los largos y la regla del año) y nombra el campo (`certifications[0].verificationUrl`) antes de borrar nada; la fuente inválida sale con código 1 (requisito vigente *Seed por defecto sin cambios con el formato extendido*).
- Ausentes → `null`. Con `docs/cv-data.json` actual el resultado de `npm run seed` es idéntico al de hoy.
- `seed:verify` (y `seed:example:verify`, que es el mismo script con `--file`) compara los tres campos de cada certificación por orden y nombra la que difiere.
- `docs/examples/cv-data.example.json`: la primera certificación visible gana `verificationUrl: "https://example.org/credenciales/arquitecto-nube-2023"`, `credentialId: "EJ-2023-0042"` y `expiresAt: "2029-06"`; *Liderazgo técnico…* (sin año) gana `expiresAt: "2025-12"` sin enlace, para que el ejemplo muestre una vigente con enlace y una vencida sin él. Los conteos no cambian.

Alternativa descartada: **cargar enlaces de ejemplo en `docs/cv-data.json`.** Son datos reales del owner; un enlace inventado sería falso y uno real lo tiene que copiar él del emisor (ítem 0.3).

### D10 — Migración solo aditiva

`<timestamp>_add_certification_credential`, generada con `prisma migrate dev --create-only` contra una base descartable: tres `ALTER TABLE "Certification" ADD COLUMN … TEXT` nulas. Sin `UPDATE`, sin `DROP`, sin valores por defecto ni índices (no se consulta por estos campos).

### D11 — Sin verificación automática ni llamadas a terceros

La propuesta (§ 3) confirma que Credly y Accredible exponen la verificación como página pública por credencial y que su API es para emisores. Este change no consulta al emisor, no valida que la URL responda, no restringe dominios y no trae imágenes de insignias:

- La ruta pública sigue sin llamar a terceros (principio de la propuesta para `add-integrations-foundation`).
- Una lista blanca de dominios obligaría a un deploy por emisor nuevo (Microsoft Learn, Platzi, Udemy, Coursera, emisores locales) y no aporta seguridad frente a https más el control del owner, que es el único que escribe.
- Comprobar que la URL responda al guardar haría que el panel dependa de la red del emisor y abre una petición saliente desde la API (SSRF) sin un caso de uso que lo justifique.

Si más adelante se quiere un chequeo periódico de enlaces rotos, encaja en `add-integrations-foundation` (cola y cron) con su propia decisión.

## Risks / Trade-offs

- **[Enlace roto o reemplazado en el emisor]** → el sitio no lo detecta (D11). El owner lo ve al revisar; el manual (TC-42) recomienda abrir cada enlace después de cargarlo.
- **[Hora del navegador mal configurada]** → la marca «Vencida» puede adelantarse o atrasarse para ese lector. El dato es orientativo y la página del emisor manda.
- **[La hoja crece con muchas credenciales]** → el bloque sigue limitado a 4 certificaciones y un párrafo de 3 líneas como máximo; `print:check` con el ejemplo y con el CV lo verifica.
- **[Un enlace con datos personales]** → algunas URLs de verificación incluyen el nombre del portador. Es información que el owner decide publicar al pegarla; el campo no se registra en logs.
- **[Mostrar «Vencida» resta]** → el owner puede ocultar la certificación; ver P1.

## Migration Plan

1. **Migración** `<timestamp>_add_certification_credential`: generada y revisada a mano contra una base descartable (`portfolio_cert_check`), sin `UPDATE` ni `DROP`.
2. **Deploy:** corre en el `preDeployCommand`. Sin backfill ni script nuevo.
3. **Base local del owner (`portfolio`, 5434):** la migra él con `npm run prisma:migrate` cuando actualice; ninguna tarea la toca.
4. **Datos reales:** después del deploy, el owner carga los enlaces desde `/admin/formacion` (ítem 0.3). Si prefiere el archivo, edita `docs/cv-data.json`; el seed por defecto se niega sobre una base con contenido, así que en producción va por el panel.
5. **Rollback:** revertir el código deja las columnas sin uso (la API vieja no las lee). Quitarlas exige una migración inversa con `DROP COLUMN`; se perderían los enlaces cargados.

## Open Questions

Ninguna bloqueante. Una no bloqueante, ya **resuelta el 2026-10-29** con la opción A (lo implementado en D5):

- **P1 — ¿Cómo se ven las certificaciones vencidas en el sitio público?**
  - A) Se muestran con la marca «Vencida» y el enlace (D5).
  - B) Se muestran sin marca.
  - C) Se ocultan solas al vencer.

  **Resuelta el 2026-10-29: opción A** (marca «Vencida», la que D5 ya implementa). Recomendación original: es honesto con el lector, no depende de la fecha en que se abre el link para decidir qué se ve, y el owner puede ocultar una a mano con **Visible en el sitio**. **[no bloqueante]**
