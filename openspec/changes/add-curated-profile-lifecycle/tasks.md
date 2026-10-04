# Tasks — add-curated-profile-lifecycle

> Referencias: `proposal.md`, `design.md` (D1–D8), `specs/*/spec.md`.

## 1. Migración (D1, D5)

- [ ] 1.1 `schema.prisma`: `CuratedProfile.archivedAt DateTime?`, `CuratedProfile.listed Boolean @default(true)`, modelo `CuratedProfileSlugAlias { id, slug @unique, curatedProfileId, createdAt }` con `onDelete: Cascade`. Verificar: `prisma migrate dev --name curated_profile_lifecycle` y `prisma migrate status` limpio.
- [ ] 1.2 Probar `prisma migrate deploy` sobre una copia restaurada del backup, no sobre la base de desarrollo. Verificar: transcripción en `verification/`.

## 2. Tabla de verdad en el dominio (D2)

- [ ] 2.1 `domain/services/resolvability.ts`: función pura `(visibility, archivedAt, tokenValido) → 'ok' | 'unauthorized' | 'not-found'`. Verificar: spec de tabla con los **doce** casos de la spec.
- [ ] 2.2 `ResolveCuratedProfileUseCase` delega en `resolvability` y deja de decidir inline. Verificar: sus 64 specs existentes siguen en verde sin cambios de expectativa.
- [ ] 2.3 Entidad: `archivedAt`, `listed`, y `with()` acepta ambos. Verificar: `tsc` y spec de la entidad.

## 3. Casos de uso (D3, D4)

- [ ] 3.1 `DuplicateCuratedProfileUseCase`: copia la configuración, fuerza `PRIVATE`/`listed:false`, descarta token, vistas y `archivedAt`, deriva el slug con el primer sufijo libre y devuelve error de dominio pasados 50 intentos. Verificar: spec con repositorio mockeado, incluidos colisión de slug e id inexistente.
- [ ] 3.2 `ArchiveCuratedProfileUseCase` y `UnarchiveCuratedProfileUseCase`, idempotentes, con la hora del servidor inyectada (no `new Date()` dentro del caso de uso). Verificar: spec, incluido archivar dos veces conservando la fecha.
- [ ] 3.3 Puerto: `findBySlugOrAlias`, `registerAlias` y `removeAlias`, con el registro del alias en la **misma transacción** que el renombrado. Verificar: spec del adaptador Prisma contra base real.

## 4. HTTP (D3, D4, D5)

- [ ] 4.1 `POST /api/admin/curated-profiles/{id}/duplicate` → 201. Verificar: e2e de los cinco escenarios de la spec.
- [ ] 4.2 `POST .../archive` y `.../unarchive` → 200; `archivedAt` fuera del whitelist del `PATCH`. Verificar: e2e, incluido `PATCH` con `archivedAt` → 400.
- [ ] 4.3 `listed` en `Create`/`Update`/`Preview` DTO con su `@ApiProperty`. Verificar: e2e de `PATCH listed`.
- [ ] 4.4 La ruta pública resuelve por alias, devuelve el slug canónico y la cabecera `Content-Location`. Verificar: e2e de los cinco escenarios de alias.
- [ ] 4.5 `GET /api/curated-profiles` y `SitemapBuilder` pasan al criterio de tres condiciones, **compartiendo** la misma función de filtrado. Verificar: e2e que compara los slugs de los dos y da el mismo conjunto.
- [ ] 4.6 `npm run openapi:export` y `npm run api:types`. Verificar: el test de deriva del frontend en verde.

## 5. Frontend (D7)

- [ ] 5.1 `ProfilesPage`: acción Duplicar con confirmación, y badges de visibilidad, archivado y enumeración. Verificar: test de la página.
- [ ] 5.2 Pestaña Publicación: archivar/desarchivar con confirmación que advierte que el link deja de funcionar y que las visitas se conservan; conmutador de `listed`; los tres ejes explicados por separado. Verificar: test del constructor.
- [ ] 5.3 El link público advierte cuando el perfil no resuelve (archivado o `PRIVATE`). Verificar: test.
- [ ] 5.4 `TopBar` monta el menú solo en `/`. Verificar: test de componente más e2e sobre `/:slug` que comprueba que el DOM no tiene enlaces a otro slug.
- [ ] 5.5 Al resolver por alias, la URL se reemplaza con el slug canónico (`replace: true`). Verificar: test con MSW.

## 6. Analítica (D8)

- [ ] 6.1 El dashboard sigue mostrando los perfiles archivados, marcados como tales. Verificar: test de `DashboardPage` con un perfil archivado con visitas.
- [ ] 6.2 Un perfil archivado no registra visitas nuevas. Verificar: e2e que pide el slug archivado y comprueba que no se creó `ProfileView`.

## 7. Datos y verificación (D6)

- [ ] 7.1 `docs/cv-data.json`: `listed: true` explícito en las 13 plantillas, para que el seed no dependa del default. Verificar: `npm run seed && npm run seed:verify`.
- [ ] 7.2 `docs/MANUAL.md`: casos nuevos de duplicar, archivar y enumerar, y la explicación de los tres ejes en el caso 7.
- [ ] 7.3 Suite completa: `npm run test:all` en backend y `npm run test` en frontend. Verificar: en verde.
- [ ] 7.4 Verificación en la app real: duplicar un perfil, publicarlo editando solo slug, título y titular, archivarlo, comprobar el 404 y que sus visitas siguen en el dashboard. Verificar: capturas y transcripción en `verification/`.
