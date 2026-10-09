# retire-accent-color — Retiro de `accentColor`, segunda etapa

> Ronda 1.1, segunda etapa de la decisión D9 de `polish-builder-and-edge` (archivado el 2026-10-09). Corresponde a la fila *Retirar `accentColor`* de `docs/ROADMAP-1.1.md` § 5. No abre una fase nueva de `docs/SPECS-POR-FASE.md`: limpia el contrato aceptado en las Fases 2 a 5. El owner respondió las dos preguntas abiertas: **P1 = B** (los colores pasan al tema) y **P2** (la base de desarrollo la migra el agente en el primer paso, con trazabilidad).

## Why

`accentColor` es un campo fantasma desde el principio. La etapa 1 (D9) ya hizo dos cosas: el panel dejó de enviarlo y el OpenAPI lo marca `deprecated` en la entrada y la salida. Hoy, 9 de octubre de 2026, en `main`:

1. **Nadie lo lee.** En `frontend/src` solo aparece en tipos, fixtures, en `heroData` de `PortadaPage.tsx` (con valor `''`) y en los tests que comprueban que no se envía. El acento visible del sitio es `tokens.colors.accent`, que edita el customizador.
2. **Contradice el pilar de theming.** Es un segundo color fuera de los tokens (`CLAUDE.md`, *Decisiones tomadas*).
3. **Arrastra deuda en cada capa.** Columna con default `#1A365D`, validación hex en dominio y en DTO, copia al duplicar, tres tipos `*Wire` y sus casts en el frontend, una constante de descripción y un test de swagger que solo existen para documentar que es obsoleto.
4. **El color que cada plantilla quería tener nunca llegó a la pantalla.** El owner decidió conservarlo, y para eso tiene que vivir donde el sitio lo lee: el tema.
5. **Conviene hacerlo ahora.** El deploy 1.0.0 en Railway todavía no ocurrió. Si el change entra antes, producción aplica las tres migraciones sobre una base vacía y nace sin la columna. El único cliente de la API es el propio frontend, que ya no envía el campo.

## What Changes

- **Datos (P1 = B):** el `accentColor` de cada perfil pasa a `themeOverrides.colors.accent` en la misma migración que borra la columna. Un `colors.accent` que ya exista en `themeOverrides` no se pisa: gana lo que se personalizó en el customizador (D3). Desde ese momento, cada perfil se ve con su color propio.
- **Persistencia:** migración nueva `retire_accent_color`, escrita a mano. Primero hace un `UPDATE` con jsonb, idempotente, y después el `DROP COLUMN`. Se aplica con `prisma migrate deploy`, en Railway desde el `preDeployCommand`, y nunca con `migrate dev` ni con `db push` (D4).
- **Base de desarrollo del owner (P2):** el agente la migra en el grupo 1, con dump previo, evidencia antes y después, y el rollback ensayado antes en una copia descartable (D5).
- **Seed:** en las 13 plantillas de `docs/cv-data.json`, `accentColor` se reemplaza por `themeOverrides: { colors: { accent } }`. `backend/scripts/seed.ts` pasa `themeOverrides` tal cual, y el perfil `all` recibe el mismo tratamiento. Una base recién sembrada queda igual que una migrada (D11).
- **Contrato (BREAKING, sin clientes afectados):** `accentColor` sale de `CreateCuratedProfileDto`, `UpdateCuratedProfileDto` y `PreviewCuratedProfileDto`, y de `AdminCuratedProfileResponse`, `CuratedProfileSummaryResponse`, `CuratedProfileResponse` y `PreviewCuratedProfileResponse`. Un cuerpo que lo traiga responde **400** por la whitelist (D2).
- **Dominio y aplicación:** sale de `NewCuratedProfileProps` y de la entidad. Se borran la regla hex de `validateCuratedProfile` y `HEX_COLOR_REGEX`. Sale también de los outputs, de los mappers y del duplicado (el color ya viaja dentro de `themeOverrides`, que el duplicado copia).
- **Frontend:** desaparecen `CreateCuratedProfileWire`, `UpdateCuratedProfileWire` y `PreviewCuratedProfileWire` con sus casts, los `Omit<…, 'accentColor'>`, el campo de `heroData` y de los fixtures, y los tests de D9 (D7).
- **Contrato generado:** se regeneran `backend/openapi.json` y `frontend/src/shared/types/api.d.ts`. Se borra `accent-color-deprecated.ts`, y `swagger.spec.ts` pasa a comprobar que el campo no figura en ningún schema (D8).
- **Docs:** `DEPLOY.md` § 9.5 y `DEPLOY-RAILWAY.md` (migración de datos en el `preDeployCommand`, respaldo previo, rollback), `RELEASE-1.0.0-CHECKLIST.md`, `MANUAL.md` y `manual/index.html` (TC-12 y el customizador), `manual/suite-backoffice.ps1`, `ARCHITECTURE.md`, `I18N.md`, `DATA-POPULATION.md`, `ROADMAP-1.1.md`, `CHANGELOG.md` y `CLAUDE.md`.

## Non-goals

- Cambiar o "arreglar" colores por contraste. El owner aceptó el riesgo (D3, Risks). Este change solo lo mide y lo deja registrado.
- Tocar los presets: el `colors.accent` y el `accent2` de `modern-dark` y los demás quedan igual, al igual que el `brand` de Tailwind y el `accent` de shadcn/ui.
- Validar como hex los colores de `themeOverrides`. Hoy no se validan y este change no agrega reglas.
- Editar `docs/cv-data.es-only.backup.json`, la migración `init` o los changes archivados (D10).

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `data-persistence-seed`: requisitos nuevos para la migración del acento al tema y para el acento de las plantillas en el seed.
- `theme-resolution`: el acento sale solo de los tokens, y para los perfiles migrados eso incluye el override que dejó la migración.
- `admin-curated-profile-crud`: los defaults de la creación y el duplicado dejan de nombrar `accentColor`. Se quita *`accentColor` obsoleto en el contrato* y entra *`accentColor` retirado del contrato*.
- `admin-curated-profile-preview`: el borrador no acepta `accentColor`.
- `curated-profile-builder`: se quita *El constructor no envía `accentColor`*.
- `curated-profile-resolution`: la forma de la vista resuelta ya no trae `accentColor`.
- `public-curated-profile-api`: los elementos del listado ya no traen `accentColor`.

## Impact

- **Backend:**
  - Persistencia y seed: `prisma/schema.prisma` y la migración nueva; `scripts/seed.ts` y `scripts/verify-seed.ts`.
  - Dominio: `curated-profile/domain/entities/curated-profile.entity.ts` (y su spec) y `domain/services/validate-curated-profile.ts`.
  - Aplicación: outputs, mappers y `curated-profile-lifecycle.use-cases.ts`, con sus specs, y el spec de `profile-head.renderer`.
  - Infraestructura: `controllers/dto/curated-profile.dto.ts`, `docs/*.response.ts`, `docs/accent-color-deprecated.ts` (se borra), `persistence/curated-profile.prisma-mapper.ts` y su spec.
  - Tests: `src/swagger.spec.ts`, `test/curated-profile.e2e-spec.ts`, `test/backoffice.e2e-spec.ts` y los e2e nuevos.
- **Frontend:** `features/backoffice/shared/admin-types.ts`, `shared/use-admin-api.ts`, `curated-profiles/use-preview.ts`, `portada/PortadaPage.tsx`, dos specs del constructor y dos fixtures.
- **Contrato OpenAPI:** BREAKING en el papel. No hay consumidores fuera del repo.
- **Datos:** una columna menos en `CuratedProfile`; `themeOverrides` gana `colors.accent` en todos los perfiles que no lo tenían. **Cambio visible:** los perfiles pasan a mostrar su acento propio en lugar del `#38bdf8` del preset.
- **Operación:** primera migración destructiva del proyecto. La base del owner se migra en el grupo 1, y desde ese momento el backend de `main` no funciona contra ella hasta el merge (D5).
