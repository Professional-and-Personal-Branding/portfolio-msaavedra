# Verificación — add-admin-backoffice (Fase 5)

Fecha: 2026-09-08 · Verifier: Claude (Opus 5) · Ciclos de reparación: 2 (ambos por fallos reales encontrados en el navegador, detallados abajo).

## Automatizado

| Check | Resultado |
|---|---|
| `backend`: `npm run lint` / `typecheck` / `build` | 0 problemas |
| `backend`: `npm test` | 41 suites, **182 tests** (eran 168 antes de la fase) |
| `backend`: `npm run test:e2e` | 6 suites, **91 tests** (eran 73) |
| `frontend`: `npm run typecheck` / `lint` / `prettier --check` | 0 problemas |
| `frontend`: `npm run test` | 21 archivos, **118 tests** (eran 56) |
| `frontend`: `npm run build` | OK |

Tamaños (gzip) frente al presupuesto de `design.md` D10:

| Bundle | Tamaño | Presupuesto |
|---|---|---|
| Inicial público (react + index + motion + query + runtime) | 205.6 KB | ≤ 213 KB |
| Chunk del backoffice (`BackofficeApp`) | 36.6 KB | < 150 KB |

El panel viaja en su propio chunk: un visitante anónimo no lo descarga.

Cobertura por spec:
- `admin-authentication`: e2e de la cookie (login emite `HttpOnly`/`SameSite=Lax`/`Path=/` sin `Secure` fuera de producción; credenciales inválidas no emiten cookie; la cookie autentica `/api/auth/me` y `/api/admin/*`; cookie con firma inválida → 401; `Bearer` tiene prioridad y sigue funcionando; logout borra y deja 401; preflight con `Access-Control-Allow-Credentials: true` y origen exacto). Unitarios de `session-cookie` (opciones y extractor).
- `admin-curated-profile-preview`: unitarios de `PreviewCuratedProfileUseCase` (misma selección que la ruta pública, overrides, sin visitas, `PRIVATE`/`PROTECTED` sin token, tema con overrides, locale) y e2e (200 con sesión y con cookie, 401 sin ella, cuerpo **idéntico** al de la ruta pública con los mismos criterios, `CuratedProfile` y `ProfileView` sin cambios, cuerpo inválido → 400).
- `admin-theme-catalog`: unitarios de `ListThemesUseCase` (forma, orden, copias de tokens) y e2e (5 presets con `id` y `tokens`, 401 sin sesión, el `id` sirve como `themeId` en el preview).
- `admin-backoffice-shell`: `LoginPage.test` (login correcto, 401 con email conservado, **nada en `localStorage`/`sessionStorage`**), `RequireSession` (redirección con destino recordado, sesión válida sin pasar por login, logout), `query-client.spec` (un 401 no reintenta en bucle, invalida la sesión desde otras consultas).
- `admin-analytics-dashboard`: `DashboardPage.test` (totales, ranking descendente, desglose por idioma, barras con fecha y cantidad accesibles, cambio de rango con `from`/`to`, estado vacío, error con reintento).
- `admin-content-management`: `fields.spec` (`es` obligatorio, `en` vacío no viaja, listas), `ExperiencesPage.test` (listado con ocultas, alta bilingüe, validación sin llamar a la API, `current` deshabilita `endDate` y envía `null`, borrado solo tras confirmar, error 400 mostrado sin cerrar el formulario), `SkillsPage.test` (listado, alta de skill en su categoría, edición, aviso de arrastre al borrar una categoría).
- `curated-profile-builder`: `profile-draft.spec` (validación, cuerpo, clave de preview, universo de tags, mover secciones) y `ProfileBuilderPage.test` (carga y previsualiza, tags → preview con una sola petición, **tres alternancias en la misma tanda**, exclusión de experiencias, guardado con 409, `PROTECTED` exige token y arma el link con `?token=`, copiar al portapapeles, reordenar y ocultar secciones).
- `theme-customizer`: `theme-draft.spec` (tokens base, efectivos, diferencias mínimas, restablecer, hexadecimal) y `ThemeCustomizerPanel` en `ProfileBuilderPage.test` (cambiar color **sin peticiones** y guardando solo la diferencia, hexadecimal inválido, restablecer, confirmación al cambiar de tema base).

## Navegador (API real en :3300 con la base seedeada, Vite en :5173)

Capturas en `verification/` (Chrome headless 1280×900).

| Criterio (SPECS-POR-FASE § Fase 5) | Evidencia | Resultado |
|---|---|---|
| Login funcional y rutas protegidas | `01-login.png`, `02-dashboard.png`: sin sesión `/admin` lleva al login; tras entrar se ve el panel. `localStorage` y `sessionStorage` vacíos y `document.cookie` vacío (la sesión es `HttpOnly`) | ✅ |
| Dashboard con datos de `ProfileView` | `02-dashboard.png`: 33 visitas en el rango, 6 perfiles y 2 idiomas, todo desde `GET /api/admin/analytics/views` | ✅ |
| CRUD visual con feedback | `03-experiencias.png` (15 experiencias), `04-skills.png` (12 categorías, 108 skills), `05-perfiles.png` (14 perfiles con sus visitas). Alta, edición y borrado cubiertos por los tests con MSW y probados a mano en el punto siguiente | ✅ |
| El constructor muestra en vivo qué experiencias resultan | `07-preview-en-vivo.png`: quitar `integration`, `leadership` y `migration` pasa de **13 experiencias · 11 categorías** a **11 · 9** con **una sola** petición de preview. Coincide con la API consultada por separado | ✅ |
| El customizador refleja los cambios en tiempo real | `08-customizador.png`: el acento pasa de `#38bdf8` a `#ff5500` y el fondo a `#1b1230` con **0 peticiones nuevas**; el badge del preview toma `rgb(255, 85, 0)` | ✅ |
| Generar un perfil produce un link público que renderiza la vista de Fase 4 | `10-perfil-nuevo.png`, `11-link-publico.png`: perfil `verificacion-fase5` creado desde el panel con el tag `dotnet` (7 experiencias en el preview) y acento `#c81d4e`; `/verificacion-fase5` renderiza 7 experiencias, las 9 secciones y ese acento | ✅ |
| La sesión sobrevive a un refresh | Recarga completa de `/admin` sin volver al login | ✅ |

El perfil `verificacion-fase5` se borró al terminar (`DELETE` → 204, y su ruta pública responde 404). `tech-lead-dotnet` quedó intacto: 13 experiencias y acento `#38bdf8`.

## Fallos encontrados y corregidos

1. **Bucle infinito de peticiones a `/api/auth/me`.** El manejador global de 401 invalidaba la consulta de sesión; cuando la que fallaba era esa misma consulta, se reinvocaba sin fin (cientos de peticiones, panel colgado en el esqueleto). No lo detectaron los tests porque con MSW la redirección igual ocurría. Corregido excluyendo la consulta de sesión del manejador, con `query-client.spec` como regresión.
2. **Alternar varios tags en la misma tanda perdía cambios.** Cada `onClick` calculaba la lista nueva a partir del `draft` del render vigente, así que tres clics agrupados por React dejaban solo el último. Se veía como "el preview no cambia" pese a dispararse la petición. Corregido con actualizaciones funcionales (`toggleIn`), con un test que hace tres clics sincrónicos.
3. **`clear()` de TanStack Query no avisaba a los componentes al cerrar sesión**, así que el panel seguía mostrando datos con la sesión ya cerrada. Cambiado por `resetQueries()`.
4. **El contrato OpenAPI declaraba como `object` cuatro campos que son texto** (`endDate`, `techFocus`, `themeId`, `accessToken`): `@ApiPropertyOptional({ nullable: true })` sin `type` hace que Swagger infiera `object`. Los tipos generados del frontend no compilaban contra la realidad. Corregido declarando `type: String`; el contrato y `api.d.ts` se regeneraron.
5. **Detalles de shadcn/ui en Windows** (repetidos de la Fase 4): el CLI escribe en una carpeta literal `@/` y agrega un paquete `cn` inexistente; además `sonner.tsx` viene atado a `next-themes`, que este proyecto no usa. Se reubicaron los componentes, se corrigieron los imports y `sonner` se conectó al motor de theming propio.

## Deuda anotada para la Fase 6

- Token CSRF y rate limiting del login (la cookie usa `SameSite=Lax`, que mitiga pero no elimina el riesgo).
- Si el despliegue deja frontend y backend en dominios distintos, la cookie necesitará `SameSite=None; Secure` o un proxy que unifique el origen.
- El e2e de Fase 2 `curated-profile.e2e-spec` sigue sin revertir el `themeOverrides` que escribe (detectado en la Fase 4, no corregido aquí por estar fuera del alcance).
