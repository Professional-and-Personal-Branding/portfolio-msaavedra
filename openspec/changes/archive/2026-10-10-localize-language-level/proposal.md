# localize-language-level — Nivel de los idiomas en los dos idiomas

> Defecto de la ronda 1.1.x. Lo registró `openspec/changes/add-printable-one-page/verification.md`, punto 7: *en inglés, el nivel de los idiomas sale como lo guarda la base*. No abre una fase nueva de `docs/SPECS-POR-FASE.md`: completa la regla de `docs/I18N.md` (un registro, todos los idiomas) para el único texto del perfil base que había quedado plano.

## Why

Con `?lang=en` (o `?locale=en`) el perfil se sirve en inglés salvo el nivel de cada idioma: el contacto de la vista pública y la hoja imprimible muestran *"Spanish · Nativo"*. Hoy, 10 de octubre de 2026, en `main` (`a95da64`):

1. **La columna es texto plano.** `backend/prisma/schema.prisma` declara `Language.level String`, mientras `nameI18n` y `detail` del mismo modelo son `Json` (`LocalizedText`).
2. **La fuente también.** `docs/cv-data.json` guarda `"level": "Nativo"` y `"level": "B1-B2"`, y `backend/scripts/seed.ts` los copia tal cual.
3. **El mapper no lo resuelve.** `toLanguageOutput` (`profile/application/mappers/profile.mapper.ts`) devuelve `level: language.level`; `name` y `detail` sí pasan por `resolveLocale`.
4. **El panel no puede corregirlo.** El formulario de idiomas de `/admin/portada` edita el nivel con un solo campo de texto, y el informe de faltantes del constructor no mira los idiomas del perfil.

El efecto llega a todo perfil curado, porque el perfil base entra en todos, y ahora también al PDF que se manda a una empresa.

## What Changes

- **Persistencia:** `Language.level` pasa de `String` a `Json` **en la misma fila** (`LocalizedText`, o el string de un dato legado), igual que `detail` (D1). Migración nueva `localize_language_level`, escrita a mano, no destructiva: un `ALTER COLUMN … TYPE JSONB USING …` que convierte cada valor (D2).
- **Conversión de datos (D2):** los niveles conocidos en español (`Nativo`, `Básico`, `Intermedio`, `Avanzado`, `Bilingüe`, …; lista cerrada en `design.md`) pasan a `{ es, en }`; los códigos MCER (`B1-B2`, `C1`, `B2+`) pasan a `{ es: x, en: x }`; cualquier otro texto pasa a `{ es: x }`, sin inventar el inglés, para que el informe de faltantes lo marque.
- **Dominio y aplicación:** `level: LocalizedText | string`; la validación exige texto en español (o un legado no vacío). El mapper público lo resuelve con `resolveLocale` (D3).
- **Contrato público:** sin cambio de forma. `languages[].level` sigue siendo `string`, ahora en el idioma pedido, en `GET /api/profile`, en `GET /api/curated-profiles/{slug}` y en los dos previews.
- **Contrato admin (BREAKING, sin clientes afectados):** la entrada de `POST`/`PATCH /api/admin/languages` recibe `level` como `LocalizedTextDto`; un string responde 400. La salida cruda devuelve `LocalizedText | string` (D4). Se regeneran `backend/openapi.json` y `frontend/src/shared/types/api.d.ts`.
- **Seed:** `docs/cv-data.json` guarda `{ "es": "Nativo", "en": "Native" }` y `{ "es": "B1-B2", "en": "B1-B2" }`; `seed.ts` acepta `LocalizedText` y `seed:verify` compara el nivel de cada idioma (D5).
- **Panel:** el nivel se edita con `LocalizedField` (ES obligatorio, EN opcional), los legados se cargan con `editableText` y el listado muestra el español (D6).
- **Informe de faltantes del constructor:** cubre los idiomas del perfil como entidad `language` (`nameI18n`, `level`, `detail`), y el aviso los nombra (D7).
- **Docs:** `docs/I18N.md` (tabla de traducibles), `docs/MANUAL.md` y `docs/manual/index.html` (TC-32 nuevo), `docs/DEPLOY.md` § 9.5 y `docs/DEPLOY-RAILWAY.md` (migración de datos, respaldo y rollback), `docs/RELEASE-1.0.0-CHECKLIST.md` y `docs/CHANGELOG.md`.

## Non-goals

- Traducir automáticamente niveles fuera de la lista de D2 o cambiar los textos que el owner haya escrito.
- Convertir el nivel en un enum (MCER o propio). Es texto libre bilingüe, como `detail` (D1, alternativa descartada).
- Tocar `name` (nombre canónico, plano) o `nameI18n`/`detail`, que ya son bilingües.
- Cambiar la hoja imprimible o la sección de contacto: siguen mostrando `level` tal como llega, ya resuelto.
- Editar `docs/cv-data.es-only.backup.json`, la migración `init`, los changes archivados o `add-printable-one-page` (su punto 7 se cierra citando este change al archivarlo).

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `public-profile-api`: el nivel de los idiomas es un campo traducible resuelto al idioma pedido.
- `admin-content-management`: contrato del nivel en la administración de idiomas y edición ES/EN en el panel.
- `data-persistence-seed`: migración `localize_language_level` y nivel bilingüe en la fuente del seed.
- `admin-curated-profile-preview`: el informe de faltantes cubre los idiomas del perfil.

## Impact

- **Backend:**
  - Persistencia y seed: `prisma/schema.prisma`, la migración nueva, `scripts/seed.ts` y `scripts/verify-seed.ts`.
  - Dominio: `profile/domain/entities/language.entity.ts`, `domain/services/validate-profile.ts` y sus specs.
  - Aplicación: `mappers/profile.mapper.ts`, `dto/profile.admin-output.ts`, `mappers/profile.admin-mapper.ts`, `curated-profile/application/services/detect-missing-translations.ts` y sus specs.
  - Infraestructura: `controllers/dto/profile.dto.ts`, `controllers/docs/admin-profile.response.ts`, `controllers/docs/profile.response.ts` (descripción), `curated-profile/.../docs/preview-curated-profile.response.ts` (enum de entidad) y `persistence/profile.prisma-mapper.ts` con su spec.
  - Tests: `test/content-admin.e2e-spec.ts`, `test/app.e2e-spec.ts`, `test/curated-profile.e2e-spec.ts` o `backoffice.e2e-spec.ts` (preview).
- **Frontend:** `features/backoffice/portada/language-form.ts`, `PortadaPage.tsx` y su test, `proyectos/proyectos-form.spec.ts`, `curated-profiles/MissingTranslationsNotice.tsx` y el builder que le pasa los idiomas, fixtures de `test/fixtures`.
- **Contrato OpenAPI:** público sin cambio de forma; admin BREAKING en el papel (sin consumidores fuera del repo); enum `entity` del informe de faltantes suma `language`.
- **Datos:** la columna cambia de tipo; ninguna fila se pierde ni se agrega. **Cambio visible:** en inglés, *"Spanish · Native"*.
- **Operación:** migración de datos en el `preDeployCommand` de Railway. La base del owner se migra al final, con respaldo previo y su OK explícito (D8).
