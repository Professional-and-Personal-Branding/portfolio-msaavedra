# Tasks — add-admin-backoffice

> Referencias: `proposal.md`, `specs/*/spec.md`, `design.md` (D1–D10). Criterios de negocio: `docs/SPECS-POR-FASE.md` § Fase 5.

## 1. Backend — sesión por cookie (D1)

- [x] 1.1 `cookie-parser` en `main.ts`, `credentials: true` en `buildCorsOptions`, cookie `portfolio_session` en el login, `POST /api/auth/logout`, extracción del JWT desde cookie o header en `JwtStrategy`. Verificar: e2e `auth.e2e-spec` amplía a login emite `Set-Cookie` con `HttpOnly`/`SameSite=Lax`, la cookie autentica `/api/auth/me` y `/api/admin/*`, cookie inválida → 401, `Bearer` sigue funcionando, logout borra y deja 401.

## 2. Backend — preview y catálogo de temas (D2)

- [x] 2.1 Extraer `CuratedProfileComposer` (pasos 3-5 y 7) de `ResolveCuratedProfileUseCase` sin cambiar comportamiento. Verificar: `npm test` y `npm run test:e2e` en verde sin tocar los tests existentes.
- [x] 2.2 `PreviewCuratedProfileUseCase` + `POST /api/admin/curated-profiles/preview` con su DTO y documentación Swagger. Verificar: unitarios (selección, overrides, `PRIVATE`/`PROTECTED` sin token) y e2e (200 con sesión, 401 sin ella, `CuratedProfile` y `ProfileView` sin cambios, cuerpo igual al de la ruta pública con los mismos criterios).
- [x] 2.3 `findAll()` en `ThemeRepository` + adaptador Prisma + `ListThemesUseCase` + `GET /api/admin/themes`. Verificar: e2e devuelve los 5 presets con `id` y `tokens`; 401 sin sesión.
- [x] 2.4 `npm run openapi:export` y, en el frontend, `npm run api:types`. Verificar: `api-types.spec` en verde; el contrato incluye las tres rutas nuevas.

## 3. Frontend — esqueleto del panel (D3, D4)

- [x] 3.1 Dependencias (`@hookform/resolvers`, `sonner`) y componentes shadcn adicionales (`form, label, input, textarea, select, switch, checkbox, tabs, dialog, alert-dialog, table, sonner`). Verificar: `npm run build` OK; componentes en `shared/components/ui/`.
- [x] 3.2 Rama `/admin/*` en el router con `React.lazy`, `AdminShell` + `AdminNav` con `ThemeProvider` fijo, `PageHeader`, `EmptyState`, `ConfirmDialog`, `DataTable`. Verificar: en navegador `/admin` enruta y el panel no cambia con `?theme=`; el chunk del backoffice no se descarga al abrir `/`.
- [x] 3.3 Sesión: cliente con `credentials: 'include'`, `use-session`, `RequireSession`, `LoginPage`, logout, redirección global ante 401. Verificar: `LoginPage.test` (éxito, 401, sin token en `localStorage`/`sessionStorage`), `RequireSession.test` (redirección y destino recordado).

## 4. Frontend — dashboard (D6)

- [x] 4.1 `DashboardPage` con totales, ranking por perfil, desglose por idioma, serie diaria en barras y selector de rango. Verificar: `DashboardPage.test` con MSW (totales, orden descendente, cambio de rango pide `from`/`to`, estado vacío, cada barra expone fecha y cantidad).

## 5. Frontend — CRUD visual (D5)

- [x] 5.1 `LocalizedField` y `ChipListField` con sus specs. Verificar: `es` obligatorio, `en` opcional no se envía vacío, agregar/quitar elementos de lista.
- [x] 5.2 `ExperiencesPage` + `ExperienceForm` (alta, edición, borrado con confirmación, orden y visibilidad, `current` deshabilita `endDate`). Verificar: `ExperiencesPage.test` con MSW cubre los escenarios de la spec.
- [x] 5.3 `SkillsPage` con categorías y skills (alta, edición, borrado con aviso de arrastre de skills). Verificar: `SkillsPage.test` con MSW.

## 6. Frontend — constructor de perfiles (D2, D7, D8)

- [x] 6.1 `ProfilesPage` (listado con visitas y visibilidad, crear, borrar con confirmación). Verificar: `ProfilesPage.test`.
- [x] 6.2 `ProfileBuilderPage`: identidad y textos bilingües, selección (`filterTags` desde el universo real, include/exclude por experiencia), tema y layout, secciones con subir/bajar y ocultar, visibilidad y token. Verificar: specs del universo de tags y del orden de secciones; `ProfileBuilderPage.test` (tags → preview, `PROTECTED` exige token).
- [x] 6.3 `use-preview` con `debounce` 400 ms y panel de preview que renderiza el resultado con los componentes públicos + contadores. Verificar: en el test, tres cambios seguidos producen una sola petición; el preview no dispara `POST`/`PATCH` de guardado.
- [x] 6.4 Guardado (`POST`/`PATCH`), manejo de 409 por slug, panel de publicación con link público, copiar y abrir. Verificar: `ProfileBuilderPage.test` (guardar nuevo, slug duplicado, link con `?token=` en `PROTECTED`).

## 7. Frontend — customizador de tema (D4)

- [x] 7.1 `use-theme-draft` (tokens efectivos = base + overrides; cálculo de las diferencias mínimas al guardar) + spec. Verificar: solo se envían los tokens cambiados; restablecer deja `themeOverrides` vacío.
- [x] 7.2 `ThemeCustomizerPanel` (8 colores con picker y hex, tipografía, modo, densidad, radio) integrado en la ficha, aplicando los tokens al preview en el cliente. Verificar: `ThemeCustomizer.test` (cambiar color no genera peticiones, hex inválido no rompe el preview, cambiar tema base pide confirmación).

## 8. Verificación (Verifier)

- [x] 8.1 `backend`: `npm run lint`, `typecheck`, `test`, `test:e2e`, `build`. `frontend`: `typecheck`, `lint`, `test`, `build` (inicial ≤ 213 KB gzip, chunk del panel < 150 KB). Verificar: todo en verde con los tamaños reportados por Vite.
- [x] 8.2 En navegador contra la API real: los 6 criterios de la Fase 5 (login y rutas protegidas, dashboard con datos de `ProfileView`, CRUD con feedback, preview en vivo al cambiar tags, customizador en tiempo real, link público que renderiza la vista de la Fase 4) + sesión que sobrevive a un refresh. Capturas en `openspec/changes/add-admin-backoffice/verification/` y registro en `verification.md`. Máx. 3 ciclos de reparación.

## 9. Documentación (Reviewer)

- [x] 9.1 `frontend/README.md` (rutas del panel, sesión, constructor, customizador), `backend/README.md` (cookie, `/api/auth/logout`, preview, catálogo de temas), `STEPS.md` (Paso 7). Verificar: alguien levanta el panel y crea un perfil curado siguiendo solo los README.
- [x] 9.2 Sincronizar: checkbox Fase 5 en `CLAUDE.md`/`README.md`; `docs/ARCHITECTURE.md` §4 y §7; `docs/CHANGELOG.md`. Verificar: `openspec validate --strict` OK antes de `openspec archive`.
