# Tasks — fix-error-contrast-and-date-modified

> Referencias: `proposal.md`, `design.md` (D1–D10) y los deltas de `specs/` (`web-accessibility`, `public-seo`, `public-curated-profile-api`). La evidencia va en `verification/`, como en los changes archivados.
>
> **Orden:** 1 → 2 → 3 → 4 (parte A) y 5 → 6 → 7 (parte B), después 8 → 9. Las partes A y B son independientes: pueden ir en commits propios del mismo PR.
>
> **Bases:** el e2e corre contra la base local del e2e (migrada y sembrada), como el resto de `npm run test:e2e`. `a11y:check` y la app real usan una base **descartable** sembrada con `seed:example` (`A11Y_CHECK_DISPOSABLE_DB=1`), creada y borrada en la misma tarea. Ninguna tarea toca la base `portfolio` del owner. Las credenciales de prueba del panel solo viven en la terminal y nunca se tipean en un navegador ni se escriben en `verification/`.
>
> **Rama apilada:** `fix/error-contrast-and-date-modified` sale de `docs/archive-fase-1-2-b` (PR #50). Antes del grupo 9, si #50 ya está en `main`, rebasar sobre `main`.

## 1. Punto de partida y rojo

- [x] 1.1 Confirmar la base: `npm run lint`, `npm run typecheck` y `npm test` del backend y del frontend en verde (el frontend en corrida tibia), y `npx -y @fission-ai/openspec@1.14.1 validate --all --strict` con el `Totals:` de partida. Verificar: salida en `verification/1.1-punto-de-partida.txt` con el hash.
- [x] 1.2 (desvío: sin rojo previo capturado, ver `verification.md`) Rojo de la parte A: en `css-vars.spec.ts`, el bloque «--t-danger-ink» de 2.2 y, en `status-color-usage.spec.ts`, los casos nuevos del detector de 3.1, sin tocar el código. Verificar: los dos fallan (`--t-danger-ink` no existe; `text-destructive` no se detecta); salida en `verification/1.2-rojo-a.txt`.
- [x] 1.3 (desvío: sin rojo previo capturado, ver `verification.md`) Rojo de la parte B: el fixture de 6.1 y `backend/test/profile-date-modified.e2e-spec.ts` de 6.4, sin tocar el código. Verificar: los dos specs de consistencia y el e2e fallan por la falta de `dateModified`/`updatedAt`, y el paso del sitemap del e2e pasa (control); salida en `verification/1.3-rojo-b.txt`.

## 2. Token `--t-danger-ink` (D1)

- [x] 2.1 `frontend/src/themes/css-vars.ts`: `export const DANGER = '#dc2626'` con su comentario (base de `--color-destructive`), la clave `'--t-danger-ink'` en `ThemeCssVars` y su cálculo `accentInk(DANGER, [colors.bg, colors.bgSoft, colors.card], tokens.mode)` en `tokensToCssVars`. Verificar: 2.2 en verde.
- [x] 2.2 `css-vars.spec.ts`, bloque «--t-danger-ink (fix-error-contrast-and-date-modified, D1)»: para cada preset de `THEME_PRESETS`, ≥ 4,5:1 contra `bg`, `bgSoft` y `card`; en `minimal` es exactamente `#dc2626`; en `modern-dark` es `#e45656`; el tono (HSL) difiere de la base en menos de 1°. Verificar: `npm test -- css-vars` verde.
- [x] 2.3 `frontend/src/themes/theme.css`: `--color-danger-ink: var(--t-danger-ink)` en `@theme inline`, junto a `--color-success-ink`, y `--t-danger-ink: #e45656` en `:root`. Verificar: `npm run build` verde; después de 3.2, el CSS de `dist/assets/` define la utilidad `.text-danger-ink`.

## 3. Reemplazo y regla estática (D2, D3)

- [x] 3.1 `status-color-usage.spec.ts`: regla `danger` según D3 (`text-destructive` con o sin variante y `text-[…destructive…]`), el tipo de `rule` ampliado y el test del detector con las líneas de D3 (dos incumplen, `text-danger-ink` y `bg-destructive text-white` no). Verificar: el test de detector verde y el de las carpetas en rojo con las líneas de D2 listadas (las 18 de `features/`, más `ERROR_TEXT` y su comentario en `AccountPage`).
- [x] 3.2 Reemplazar por `text-danger-ink` en las líneas de D2: `LoginPage`, `PreviewPanel`, `ProfileBuilderPage` (3), `ShareLinksPanel`, `ExperienceForm` (3), `FormacionForms`, `PortadaPage` (3), `SocialLinkForm`, `TextField`, `LocalizedField`, `AccessTokenForm`; `hover:text-danger-ink` en `ChipListField`; los dos de `shared/components/ui/form.tsx`. Verificar: `grep -rn "text-destructive" frontend/src` solo muestra `dropdown-menu.tsx` (D2, no se usa); 3.1 en verde.
- [x] 3.3 `AccountPage.tsx`: borrar `ERROR_TEXT` y su comentario; sus mensajes usan `text-danger-ink`. Verificar: `grep -rn "color-mix" frontend/src/features` sin resultados; `AccountPage.test.tsx` verde sin cambios de aserciones (los textos literales no cambian).
- [x] 3.4 Tests del panel que buscan la clase `text-destructive` (si alguno la usa como selector): pasar a buscar por `role="alert"` o por la clase nueva. Verificar: `npm test` del frontend verde.

## 4. `a11y:check` con errores a la vista (D4)

- [x] 4.1 `frontend/scripts/check-a11y.mjs`: parámetro opcional `prepare(page)` en `audit` (después de `settle`, antes de `runAxe`) y un problema registrado si `prepare` no encuentra lo que espera en 5 s. Verificar: con `prepare` que busca un selector inexistente, el script informa el problema y sale con 1 (corrida descartada, salida en `verification/4.1-control.txt`).
- [x] 4.2 Entrada `admin-login-error` (siempre): interceptación de `POST /api/auth/login` → 401, clic en «Entrar» con los campos vacíos, espera del `role="alert"` «Email o contraseña incorrectos». Verificar: en el log de la API de la corrida no hay ningún `POST /api/auth/login` de esa entrada (solo el del `fetch` de la sesión, si hay credenciales).
- [x] 4.3 Entrada `admin-experiencias-error` (con credenciales): «Nueva experiencia» → «Guardar» vacío → espera de un `role="alert"` dentro del diálogo; cuenta de `POST` a `/api/admin/` en esa página = 0. Verificar: el reporte lo muestra en móvil y escritorio.
- [x] 4.4 Control de que la auditoría ve el error: con el código de 3.2 revertido solo en `LoginPage` y `ExperienceForm` (cambio local que no se commitea), `a11y:check` marca `color-contrast` en las dos entradas nuevas. Verificar: salida en `verification/4.4-rojo-a11y.txt`; restituido el cambio, 0 violaciones.

## 5. Parte A completa

- [x] 5.1 Frontend: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` y `npm run perf:budget`. Verificar: todo verde, arranque público ≤ 155 KB gzip y sin cambio apreciable (una variable CSS más); salida en `verification/5.1-frontend-a.txt`.

## 6. `updatedAt` y `dateModified` (D5–D9)

- [x] 6.1 `docs/fixtures/profile-head-consistency.json`: `profile.updatedAt` en cada caso según D9 (`tech-lead-dotnet` `2026-01-15T12:00:00.000Z`, `all` `2026-03-01T23:30:00.000Z`, `sin-secciones` `null`, el resto una fecha) y `dateModified` en el `expected.jsonLd` de cada caso con bloque, después de `inLanguage`. Verificar: rojo de 1.3.
- [x] 6.2 Backend: `updatedAt: string | null` en `CuratedProfileOutput`; `toCuratedProfileOutput` lo toma de `resolution.curated.updatedAt?.toISOString() ?? null`; `CuratedProfileResponse` con `@ApiProperty({ nullable: true, type: String, format: 'date-time' })`; `isoDay(date)` exportada desde `sitemap.builder.ts` y usada por `buildSitemapXml`; `profilePageJsonLd` del renderer suma `dateModified` (D6, D8). Verificar: `profile-head.consistency.spec.ts`, `profile-head.renderer.spec.ts`, `sitemap.builder.spec.ts` y los specs del composer y del mapper verdes; ningún repositorio nuevo inyectado ni consulta nueva (`git diff` de `infrastructure/persistence` vacío).
- [x] 6.3 Contrato: `npm run openapi:export` en el backend y `npm run api:types` en el frontend; sumar `updatedAt` a los fixtures de tests del frontend que construyen un `CuratedProfile` o un preview. Verificar: `git diff backend/openapi.json` muestra solo `updatedAt` en `CuratedProfileResponse`; el test de deriva del frontend verde.
- [x] 6.4 `backend/test/profile-date-modified.e2e-spec.ts` según D9 (fragmento, API pública y sitemap con el mismo día; una visita humana con `BROWSER_UA` y `settleBackgroundTasks` no lo mueve; `afterAll` que restituye). Verificar: `npm run test:e2e -- profile-date-modified` verde y el resto de la suite e2e verde.
- [x] 6.5 Frontend: `profilePageJsonLd` de `document-meta.ts` suma `dateModified` con `data.updatedAt.slice(0, 10)` en la misma posición (D6, D8). Verificar: `document-meta.consistency.spec.ts` y `document-meta.spec.ts` verdes; además `TZ=America/La_Paz npx vitest run src/shared/lib/document-meta.consistency.spec.ts` verde (caso de las 23:30 UTC).

## 7. Parte B completa

- [x] 7.1 Backend: `npm run lint`, `npm run typecheck`, `npm run test`, `npm run test:e2e` y `npm run build`. Frontend: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run perf:budget`. Verificar: todo verde; salida en `verification/7.1-final.txt`.

## 8. App real y manual (D4, D10)

- [x] 8.1 Base descartable `portfolio_errfix_check` (sembrada con `seed:example`), API de la rama e imagen de `frontend/Dockerfile`; administrador de prueba con `admin:bootstrap` y contraseña aleatoria en la terminal. Verificar: `npm run prisma:status` apunta a la base descartable; salida sin secretos en `verification/8.1-entorno.txt`.
- [x] 8.2 `A11Y_CHECK_DISPOSABLE_DB=1 A11Y_CHECK_PROFILE=ejemplo-backend npm run a11y:check -- <base>` con credenciales en la terminal. Verificar: sale con 0; el reporte incluye `admin-login-error` y `admin-experiencias-error` en móvil y escritorio con 0 violaciones `serious`/`critical`; salida en `verification/8.2-a11y.txt`.
- [x] 8.3 TC-44 pasos 1 a 5 contra la imagen: `dateModified` en el bloque de `curl -s <base>/ejemplo-backend`, igual al `<lastmod>` de esa URL en `curl -s <base>/sitemap.xml`; el bloque que escribe la SPA (DevTools, o `document.querySelector('script[type="application/ld+json"]')` desde la consola) trae el mismo valor. Verificar: salida en `verification/8.3-tc44.txt`.
- [x] 8.4 `docs/MANUAL.md` y `docs/manual/index.html`: TC-44 según D10. Verificar: `npm run manual:check` verde con 44 casos (sin TC-46).
- [x] 8.5 Bajar todo y borrar `portfolio_errfix_check`. Verificar: `psql -l` sin la base; anotado en `verification/8.5-limpieza.txt`.

## 9. Cierre

- [x] 9.1 `npx -y @fission-ai/openspec@1.14.1 validate --all --strict` y `validate fix-error-contrast-and-date-modified --strict`. Verificar: `Totals:` sin fallos y sin «Archive would refuse»; salida en `verification/9.1-validacion.txt`.
- [x] 9.2 Completar `verification.md` con resultados y desvíos. Al archivar: `docs/CHANGELOG.md` y el roadmap de `CLAUDE.md`. Verificar: diff de los tres archivos revisado.
