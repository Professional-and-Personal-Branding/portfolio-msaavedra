# add-admin-backoffice — Fase 5: Backoffice visual + constructor y customizador

> Materializa la **Fase 5** de `docs/SPECS-POR-FASE.md` (objetivo, alcance y criterios viven allí). Referencias: `docs/ARCHITECTURE.md` §4 y §8.1, `docs/I18N.md`, demo `docs/demo-theming.html` (controles del customizador). Depende de las Fases 1-4, ya archivadas.

## Why

La API de backoffice existe desde la Fase 3 y la vista pública desde la Fase 4, pero **administrar el portafolio hoy exige `curl` con un JWT a mano**. El valor del producto está en generar un perfil curado para una vacante concreta en minutos: elegir tags, ver al instante qué experiencias entran, ajustar el tema y compartir el link. Esta fase entrega ese panel y cierra el bucle: el customizador escribe `themeOverrides`, y el motor de theming de la Fase 4 los renderiza tal cual en el preview y en la vista pública.

## What Changes

- **Panel `/admin` dentro del proyecto `frontend/`**, reutilizando el cliente tipado, el motor de theming y los layouts de la Fase 4 (esa era su razón de ser). Nueva feature `features/backoffice/` con rutas anidadas y un layout propio; la vista pública no cambia.
- **Sesión del backoffice por cookie httpOnly** (D1): `POST /api/auth/login` además de devolver el JWT lo emite como cookie `SameSite=Lax`; `POST /api/auth/logout` la borra; el guard acepta la cookie **o** el header `Authorization: Bearer` (curl, Swagger y los e2e siguen funcionando). El frontend no guarda el token en JavaScript: al arrancar pregunta `GET /api/auth/me` y así la sesión sobrevive a un refresh sin usar `localStorage` (CLAUDE.md).
- **Preview de borrador en el backend** (D2): `POST /api/admin/curated-profiles/preview` resuelve un perfil **no guardado** con el mismo pipeline que la ruta pública (selección por tags, overrides, orden, tema mergeado, secciones) y devuelve el mismo `CuratedProfileResponse`. Sin persistir, sin registrar visitas. La lógica de resolución se extrae a un servicio de aplicación compartido para que la ruta pública y el preview no puedan divergir.
- **Catálogo de temas**: `GET /api/admin/themes` lista los `Theme` de la base (`id`, `slug`, `name`, `isPreset`, `tokens`) para que el customizador elija el tema base por id y parta de sus tokens reales.
- **Login y rutas protegidas**: `/admin/login` y el resto de `/admin/*` detrás de sesión; un 401 de la API devuelve al login conservando el destino.
- **Dashboard de analítica**: totales y series de `GET /api/admin/analytics/views` (por perfil, por idioma, por día) con selector de rango, en gráficos propios sobre los tokens del tema (sin librería de charts, D6).
- **CRUD visual de experiencias y skills**: tablas con orden y visibilidad, formularios con campos bilingües ES/EN (`role`, `summary`, `highlights`, nombre de categoría), edición de tags/tecnologías/sector como chips, alta, edición, borrado con confirmación y feedback (toast) en cada operación.
- **Constructor de perfiles curados**: editor de `filterTags` con el universo de tags real, `includeIds`/`excludeIds` desde la lista de experiencias, tema y layout, orden y ocultamiento de secciones, visibilidad y token de acceso; **panel de preview en vivo** que llama al endpoint de preview con el borrador y renderiza el resultado con los componentes públicos de la Fase 4. Al guardar, la ficha muestra el link público (`/{slug}`) con botón de copiar y de abrir.
- **Customizador de tema en tiempo real**: color pickers para los 8 colores, tipografía, modo claro/oscuro, densidad y radio; el preview se re-renderiza con cada cambio **sin ir a la red** (los tokens se aplican en el cliente con el `ThemeProvider`), y al guardar se persisten como `themeOverrides` del perfil.
- **Verificación**: tests Jest del backend para el preview, el catálogo de temas y la sesión por cookie; Vitest + MSW para las páginas del panel (login, dashboard, CRUD, constructor, customizador); los criterios de la fase se comprueban en el navegador contra la API real con capturas.

### Non-goals

- Hardening de producción (Fase 6): CSRF token explícito, rate limiting del login, refresh tokens, `SameSite=None; Secure` para un despliegue en dominios distintos, auditoría de accesibilidad, E2E de navegador.
- CRUD de educación, certificaciones, proyectos, enlaces sociales y del perfil base (`Profile`): no existen endpoints admin y la Fase 5 no los pide. Candidatos a un change propio antes o después de la Fase 6.
- Crear o borrar `Theme` con nombre propio ni una galería de temas guardados: el customizador escribe `themeOverrides` del perfil sobre un tema base existente.
- Gestión de usuarios, roles o recuperación de contraseña: hay un único administrador (`admin:bootstrap`).
- Interfaz del panel en inglés: el panel es para el administrador y va en español; lo bilingüe son **los datos** que edita (pestañas ES/EN).
- Subida de imágenes o gestión de archivos; export PDF (Fase 6 / 1.0.x).
- Cambios de esquema Prisma o de `docs/cv-data.json`.

## Capabilities

### New Capabilities
- `admin-curated-profile-preview`: resolución de un perfil curado en borrador, sin persistir ni registrar visitas.
- `admin-theme-catalog`: listado de temas disponibles para el backoffice.
- `admin-backoffice-shell`: login, sesión, rutas protegidas y estructura del panel.
- `admin-analytics-dashboard`: visitas por perfil, idioma y día con rango de fechas.
- `admin-content-management`: CRUD visual de experiencias y skills con datos bilingües.
- `curated-profile-builder`: constructor de perfiles curados con preview en vivo y link público.
- `theme-customizer`: edición de design tokens con preview en tiempo real y persistencia como `themeOverrides`.

### Modified Capabilities
- `admin-authentication`: se agrega la sesión por cookie httpOnly y el logout; el header `Bearer` sigue siendo válido.

## Impact

- **Nuevo (backend)**: `POST /api/admin/curated-profiles/preview`, `GET /api/admin/themes`, `POST /api/auth/logout`; servicio de aplicación `CuratedProfileComposer` (extraído de `ResolveCuratedProfileUseCase`), `PreviewCuratedProfileUseCase`, `ListThemesUseCase`, `findAll()` en `ThemeRepository`; extracción del JWT desde cookie en `JwtStrategy`.
- **Nuevo (frontend)**: `features/backoffice/**` (login, dashboard, experiencias, skills, perfiles curados, customizador), componentes shadcn adicionales, `shared/lib/session`, formularios con React Hook Form + Zod.
- **Modificado**: `backend/src/modules/{auth,curated-profile,theme}/**`, `backend/src/shared/infrastructure/http/cors.options.ts` (`credentials`), `main.ts` (`cookie-parser`), `backend/openapi.json` y `frontend/src/shared/types/api.d.ts` (regenerados), `frontend/src/app/router.tsx`.
- **Dependencias**: backend `cookie-parser` + `@types/cookie-parser`; frontend `@hookform/resolvers` y `sonner` (toasts). Sin librería de gráficos ni de drag & drop (D6, D7).
- **Sin cambios**: esquema Prisma, `docs/cv-data.json`, comportamiento de los endpoints públicos.
- **Docs al archivar**: checkbox Fase 5 en `CLAUDE.md`/`README.md`; `docs/ARCHITECTURE.md` §4 y §7; `docs/CHANGELOG.md`; `frontend/README.md` y `backend/README.md`; `STEPS.md`.
