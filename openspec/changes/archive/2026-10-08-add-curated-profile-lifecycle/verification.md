# Verificación — add-curated-profile-lifecycle

Fecha: 2026-10-05 · Verifier: Claude (Opus 5.5) · Ciclos de reparación: 1. El e2e encontró que duplicar aceptaba un cuerpo con `slug` y lo ignoraba; ahora lo rechaza con 400, que es lo que dice la spec.

**Estado: 25 de 25 tareas.**

## Automatizado

| Check | Resultado |
|---|---|
| `backend`: `lint` / `typecheck` / `build` | 0 problemas |
| `backend`: `npm test` | 59 suites, **365 tests** (eran 329) |
| `backend`: `npm run test:e2e` | 8 suites, **133 tests** (eran 123), contra una base recién migrada y con seed; suite nueva `curated-profile-lifecycle.e2e-spec.ts` |
| `backend`: `seed` + `seed:verify` | conteos idénticos a `cv-data.json` |
| `backend`: `openapi:export` | 27 rutas (+3: duplicate, archive, unarchive) |
| `frontend`: `lint` / `build` | 0 problemas |
| `frontend`: `npm run test` | 24 archivos, **149 tests** (eran 139), dos corridas seguidas |
| `openspec validate --strict` | válido |

## Migración (1.1, 1.2)

`20261005201934_curated_profile_lifecycle` es aditiva: `archivedAt DateTime?`, `listed Boolean @default(true)` y la tabla `CuratedProfileSlugAlias`, con `onDelete: Cascade`. No hay backfill.

Todavía no existe un backup de producción, porque el deploy 1.0.0 sigue pendiente. Se probó `prisma migrate deploy` sobre lo más parecido que hay: un `pg_dump` de la base de desarrollo, con uso real, restaurado en una base aparte ([`verification/1.2-migrate-deploy.txt`](verification/1.2-migrate-deploy.txt)). Resultado: 14 perfiles, 757 visitas y el contador iguales antes y después; los 14 quedaron enumerados y sin archivar, que es el estado actual. **Repetirlo sobre un backup real antes del primer deploy que incluya este change.**

## Por criterio

| Criterio (spec delta) | Evidencia |
|---|---|
| Tabla de verdad: doce casos, el archivado gana y nunca da 401 | `resolvability.spec.ts` (13 tests) y e2e con un `PROTECTED` archivado y su token → 404 |
| La resolución delega en una sola función | `ResolveCuratedProfileUseCase`, `CuratedProfile.canAccess` y `GetProfileHeadUseCase` usan `resolvability`; todos los specs previos del resolver pasan sin cambios de expectativa |
| Duplicar: copia la configuración, nace PRIVATE y no enumerado, sin token, visitas ni archivado, con slug `-2`, `-3`… | `curated-profile-lifecycle.use-cases.spec.ts` y e2e; tope en `-50` con error de dominio |
| El cuerpo de duplicar no acepta un slug | e2e: `{ slug }` → 400 |
| Archivar: 404 indistinguible, idempotente, conserva visitas, no registra nuevas | e2e (mismo mensaje que un slug inexistente salvo el slug nombrado, visitas intactas, `archivedAt` igual al archivar dos veces) |
| `archivedAt` no se escribe por POST ni por PATCH | e2e: 400 en los dos y el perfil sin cambios |
| `listed`: accesible por slug, fuera del listado y del sitemap; no altera la visibilidad | e2e, incluido un `PROTECTED` no enumerado (401 / 200) |
| Alias: el link viejo resuelve con el slug canónico y `Content-Location`; solo el canónico en el sitemap y en el head; 409 al tomar el alias de otro; volver al slug propio borra el alias; el alias de un archivado da 404 | e2e *alias de slug*, contra el adaptador Prisma real (incluida la transacción) |
| El sitemap y el listado enumeran el mismo conjunto | `isPubliclyListed` compartido; e2e que compara los dos |
| Un archivado sigue en la analítica | e2e (`byProfile` con sus visitas) y `DashboardPage.test.tsx` (marca *archivado*, sin link) |
| El menú solo en la home | `CuratedProfilePage.test.tsx`: en `/:slug` no hay enlaces a otro slug (el test falla si el menú se monta); en `/` sí |
| Por alias, la URL pasa al canónico | `CuratedProfilePage.test.tsx` (la vista termina pidiendo el slug canónico) |
| Panel: duplicar y estado en la lista; los tres ejes en Publicación; el link advierte | `ProfilesPage.test.tsx` y `ProfileBuilderPage.test.tsx` (*ciclo de vida*) |

## App real (7.4)

[`verification/7.4-app-real.txt`](verification/7.4-app-real.txt). El circuito completo se hizo desde la interfaz del panel, contra la API y el frontend del change: duplicar `tech-lead-dotnet`, publicarlo como `acme-tech-lead` cambiando solo slug, título y titular, sumar 3 visitas, archivarlo, confirmar el 404 y ver que el dashboard conserva sus 3 visitas marcadas como archivado.

Capturas en `verification/`, de `01-lista-perfiles.png` a `06-home-con-menu.png`.

## Desvíos respecto de los artefactos

- **Deltas de spec.** *"El menú de perfiles solo en la home"* estaba como `MODIFIED` de un requisito que no existe en `curated-profile-builder`, y además es comportamiento de la vista pública. Pasó a `public-portfolio-frontend` como `MODIFIED` de *"Navegación por perfiles curados"*, el requisito que de verdad cambia, conservando su escenario.
- **3.3.** El puerto expone `findBySlugOrAlias` y el alias se registra **dentro** de `update`, en la misma transacción que el renombrado, en lugar de exponer `registerAlias` y `removeAlias` sueltos: métodos sueltos permitirían llamarlos fuera de la transacción. `existsBySlug` cuenta los alias de otros perfiles, y de ahí sale el 409.
- **3.2.** La hora del servidor llega por un puerto `Clock` (`shared/domain/clock.ts`), que no existía.
- **2.2.** Un spec del resolver cambió el nombre del método que espera (`findBySlug` → `findBySlugOrAlias`); ninguna expectativa de comportamiento cambió.
- **El head del change 2** también aplica la tabla de verdad: un perfil archivado da el fragmento genérico con `noindex`, y uno pedido por alias, el de su slug canónico.
- **`profile-view-analytics`.** La propuesta lo lista como capability modificada, pero el requisito de conservar visitas quedó en `curated-profile-resolution` y no hay delta propio.
- **Pregunta abierta del diseño** (desarchivar si el slug lo tomó otro perfil): no puede pasar. El slug vigente es único y `existsBySlug` también bloquea los alias, así que nadie puede tomar el slug de un perfil archivado.
- **Visto de paso, fuera de alcance:** entre unos 768 y 930 px de ancho el header del panel (`AdminShell`) desborda en horizontal, en todas sus páginas. Ocurre igual sin este change; quedó propuesto como tarea aparte.
