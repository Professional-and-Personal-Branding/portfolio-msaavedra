# Design — add-admin-backoffice

## Context

Ver `proposal.md` y `docs/SPECS-POR-FASE.md` § Fase 5. Lo que ya existe y se reutiliza:

- **API de backoffice (Fase 3)**: `POST /api/auth/login`, `GET /api/auth/me`, CRUD completo de experiencias (`/api/admin/experiences`), categorías y skills (`/api/admin/skill-categories`, `/api/admin/skills/{id}`) y perfiles curados (`/api/admin/curated-profiles`), más `GET /api/admin/analytics/views?from&to` → `{ total, byProfile[{slug,views}], byLocale[{locale,views}], byDay[{day,views}] }`. Los DTO admin devuelven los textos **bilingües crudos** (`{es,en}`), que es justo lo que el editor necesita.
- **Frontend (Fase 4)**: cliente `openapi-fetch` tipado, `ThemeProvider` que aplica los tokens a un contenedor (no a `documentElement`, decisión tomada pensando en esta fase), `ClassicLayout`/`SidebarLayout`, `orderSections`, componentes de sección, `url-state`, shadcn/ui.
- **Núcleo (Fase 2)**: `ResolveCuratedProfileUseCase` con `selectByTags`, `selectSkillCategories`, `resolveSections`, `mergeThemeTokens`, `sortExperiences` y `PortfolioSectionsLoader`.

Huecos reales detectados: no hay forma de resolver un borrador sin guardarlo, no hay catálogo de temas, y la sesión del panel no puede vivir en `localStorage` (CLAUDE.md).

Versiones a incorporar: `@hookform/resolvers` 5.9 (React Hook Form 7.87 y Zod 4.5 ya están instalados), `sonner` 2.0 (toasts, integrado en shadcn), `cookie-parser` 1.4 + `@types/cookie-parser` en el backend.

## Goals / Non-Goals

**Goals:** administrar el contenido sin `curl`; armar un perfil curado viendo el resultado en vivo; ajustar el tema y ver el efecto al instante; una sola implementación de la resolución para vista pública y preview.
**Non-Goals:** los de `proposal.md` § Non-goals. En particular: nada de hardening (Fase 6), ni CRUD de secciones sin endpoint admin, ni gestión de usuarios.

## Decisions

### D1 — Sesión por cookie httpOnly, con `Bearer` intacto
`POST /api/auth/login` emite además `Set-Cookie: portfolio_session=<jwt>; HttpOnly; SameSite=Lax; Path=/; Max-Age=<JWT_EXPIRES_IN>` (`Secure` en producción); `POST /api/auth/logout` la limpia; `JwtStrategy` usa `ExtractJwt.fromExtractors([fromAuthHeaderAsBearerToken(), fromCookie])`, en ese orden. `main.ts` añade `cookie-parser` y `buildCorsOptions` pasa `credentials: true`. El frontend nunca ve el token: hace `credentials: 'include'` y deriva la sesión de `GET /api/auth/me`.
*Por qué*: CLAUDE.md pide explícitamente evitar `localStorage`/`sessionStorage` para auth y preferir cookies httpOnly; además la sesión sobrevive a un refresh, que en un panel de administración se usa todo el tiempo. En desarrollo el proxy de Vite hace que el navegador vea un solo origen (`localhost:5173`), así que `SameSite=Lax` funciona sin `Secure`.
*Alternativas*: (a) **JWT solo en memoria** — cero cambios en el backend, pero cada refresh vuelve al login; (b) **`sessionStorage`** — sobrevive al refresh pero contradice CLAUDE.md y queda expuesto a XSS.
*Deuda para Fase 6*: token CSRF (con `SameSite=Lax` y peticiones JSON el riesgo es bajo, no nulo), rate limiting del login y, si el despliegue deja frontend y backend en dominios distintos, `SameSite=None; Secure` o un proxy que los unifique.

### D2 — El preview se resuelve en el backend, con la lógica compartida
Nuevo `POST /api/admin/curated-profiles/preview` que recibe el borrador y devuelve `CuratedProfileResponse`. Para no duplicar el núcleo se extrae de `ResolveCuratedProfileUseCase` un servicio de aplicación `CuratedProfileComposer` con los pasos 3-5 y 7 (lecturas en paralelo, selección, tema, secciones, mapeo); `ResolveCuratedProfileUseCase` conserva los pasos 1, 2 y 6 (existencia/visibilidad, token, registro de visita) y `PreviewCuratedProfileUseCase` construye una entidad `CuratedProfile` transitoria con `CuratedProfile.create()` y llama al composer. Un test comprueba que preview y ruta pública devuelven lo mismo para los mismos criterios.
*Por qué*: si el filtrado se replicara en el frontend, el preview y la realidad divergirían en cuanto cambie una regla; además el preview así renderiza el DTO exacto que consumen los componentes de la Fase 4.
*Alternativa descartada*: portar `selectByTags` a TypeScript del cliente (es una función pura y sería tentador), pero duplica el núcleo del producto justo donde más caro es equivocarse.

### D3 — Estructura del frontend
```
frontend/src/features/backoffice/
├── BackofficeApp.tsx          layout + <Outlet>, cargado con React.lazy desde el router
├── auth/                      LoginPage · use-session.ts (useQuery de /auth/me) · RequireSession.tsx · logout
├── dashboard/                 DashboardPage · components/{StatCard, BarSeries, RankedList}
├── experiences/               ExperiencesPage · ExperienceForm · use-experiences.ts
├── skills/                    SkillsPage · CategoryForm · SkillForm · use-skills.ts
├── curated-profiles/          ProfilesPage · ProfileBuilderPage · panels/{SelectionPanel, SectionsPanel, PublishPanel} · use-curated-admin.ts · use-preview.ts
├── theme-customizer/          ThemeCustomizerPanel · TokenColorField · use-theme-draft.ts
└── shared/                    AdminShell · AdminNav · PageHeader · DataTable · ConfirmDialog · LocalizedField · ChipListField · EmptyState
```
Rutas (react-router 8, anidadas bajo `/admin`): `login`, `` (dashboard), `experiencias`, `skills`, `perfiles`, `perfiles/:id` (`nuevo` para el alta). El router público de la Fase 4 gana una rama `/admin/*` con `lazy`, de modo que un visitante anónimo no descarga el panel.

### D4 — El panel tiene su propio aspecto; el preview, el del perfil
`AdminShell` envuelve el panel en un `ThemeProvider` con el preset `modern-dark` fijo, y el preview usa **otro** `ThemeProvider` anidado con los tokens del borrador. Como en la Fase 4 las variables se aplican al contenedor y no a `document.documentElement`, los dos temas conviven sin pelearse: cambiar el tema del perfil no altera los colores del panel.

### D5 — Formularios: React Hook Form + Zod
Un esquema Zod por entidad (`experienceSchema`, `skillCategorySchema`, `curatedProfileSchema`), `zodResolver`, y componentes reutilizables: `LocalizedField` (pestañas ES/EN sobre un mismo campo, `es` obligatorio y `en` opcional; si `en` queda vacío no se envía) y `ChipListField` (agregar/quitar elementos con Enter y con botón, sin pedir separadores). Al editar se envía `PATCH` con el objeto completo del formulario (la API acepta parciales; enviar todo evita estados intermedios raros) y al crear `POST`. Los errores de la API (400 con mensajes de `class-validator`, 409 por slug duplicado) se muestran junto al campo cuando se puede identificar, y como toast si no.

### D6 — Gráficos propios, sin librería
El dashboard dibuja las series con `div`/SVG y las utilidades del tema (`bg-brand-gradient`, alturas en porcentaje): barras por día, lista ordenada por perfil y por idioma, con la cifra siempre visible como texto. Cero dependencias nuevas y responde al tema del panel.
*Por qué*: la analítica de esta fase son tres agregados simples; Recharts pesa más que todo el panel y la Fase 6 podrá reevaluarlo si el dashboard crece.

### D7 — Reordenar sin drag & drop
Las secciones se reordenan con botones "subir/bajar" (y `aria-label` claro). Es accesible por teclado, no agrega dependencias (`dnd-kit` pesa y complica los tests) y son nueve elementos como mucho.

### D8 — Datos, caché y el ritmo del preview
TanStack Query con claves `['admin','experiences']`, `['admin','skill-categories']`, `['admin','curated-profiles']`, `['admin','themes']`, `['admin','analytics',from,to]`, `['auth','me']`. Toda mutación invalida su clave y las derivadas. El preview usa `useQuery` con clave `['admin','preview', draftKey]` donde `draftKey` es el borrador serializado **sin** los tokens del tema (los tokens no cambian la selección: los aplica el cliente), con `debounce` de 400 ms sobre el borrador y `placeholderData` para no parpadear entre respuestas. Un 401 en cualquier petición del panel invalida `['auth','me']` y dispara la redirección al login.

### D9 — Tests
- **Backend (Jest)**: unitarios de `PreviewCuratedProfileUseCase` (selección, overrides, sin persistencia, sin `ProfileView`) y de `ListThemesUseCase`; e2e de `POST /api/admin/curated-profiles/preview` (200 con sesión, 401 sin ella, equivalencia con la ruta pública, contador de visitas intacto), `GET /api/admin/themes`, y de la sesión por cookie (login emite cookie, cookie autentica, logout la borra, cookie inválida → 401, `Bearer` sigue funcionando).
- **Frontend (Vitest + MSW)**: `LoginPage.test` (éxito, 401, sin token en storage), `RequireSession.test` (redirección y destino recordado), `DashboardPage.test` (totales, orden, rango, vacío), `ExperiencesPage.test` (listado, alta, validación, `current` deshabilita `endDate`, borrado con confirmación), `SkillsPage.test` (crear skill, aviso al borrar categoría), `ProfileBuilderPage.test` (preview al cambiar tags con MSW, una sola petición tras varios cambios, no guarda solo, link público y copiar), `ThemeCustomizer.test` (cambio de color sin peticiones, overrides mínimos al guardar, restablecer), más specs puros de `theme-draft` (diferencias contra el tema base) y del cálculo del universo de tags.
- **Navegador (Verifier)** contra la API real: los 6 criterios de la fase, con capturas en `verification/`.

### D10 — Calidad y presupuesto
`tsc -b` estricto, ESLint + Prettier con las reglas de la Fase 4, y el panel en su propio chunk por `React.lazy`. Presupuesto: el bundle **inicial** (público) no debe crecer más de 10 KB gzip respecto de la Fase 4 (203 KB), y el chunk del backoffice se mantiene por debajo de 150 KB gzip.

## Risks / Trade-offs

- [Cookie httpOnly y despliegue en dominios distintos] → en dev el proxy de Vite lo hace same-origin; en producción hará falta `SameSite=None; Secure` o servir ambos bajo el mismo dominio. Se documenta como entrada de la Fase 6, junto con CSRF.
- [Extraer el composer toca el núcleo ya verificado] → se hace a comportamiento constante, con los 168 tests del backend y los e2e de perfiles curados como red; ningún test existente debería cambiar.
- [El preview del backend agrega latencia por pulsación] → `debounce` de 400 ms, `placeholderData` y clave que ignora los tokens del tema; los cambios de color no llaman a la red (D6 del proposal, spec `theme-customizer`).
- [Superficie grande para una sola fase] → el orden de las tareas entrega valor incremental (sesión → CRUD → constructor → customizador); si hubiera que recortar, el customizador es lo último y podría salir en un change propio, pero entonces la fase no cumpliría su quinto criterio.
- [Formularios bilingües con listas anidadas (`highlights`)] → `LocalizedField` + `ChipListField` se prueban por separado para no depender solo de los tests de página.

## Migration Plan

Sin migración de datos ni cambios de esquema. Orden: backend (cookie, preview, catálogo) → `npm run openapi:export` → `npm run api:types` → panel. Rollback: revertir el change; la vista pública no depende de nada nuevo.

## Open Questions

- ¿El panel debería permitir editar el perfil base, educación, certificaciones, proyectos y enlaces sociales? Hoy no hay endpoints admin para eso y la Fase 5 no lo pide; queda como candidato a un change propio.
