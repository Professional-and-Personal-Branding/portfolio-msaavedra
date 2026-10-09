# polish-builder-and-edge — Defectos menores del constructor, del panel y del borde

> Ronda 1.1, pulido posterior a los cinco changes de `docs/ROADMAP-1.1.md` § 4. Toma tres defectos verificados de la tabla § 3.2 (borrador sin aviso, `accentColor` fantasma, visita en el camino crítico) y uno diferido en § 5 (CSP del sitio público, "junto al change que toca el Caddyfile"). No corresponde a una fase nueva de `docs/SPECS-POR-FASE.md`: endurece criterios ya aceptados de la Fase 5 (backoffice) y de la Fase 6 (hardening). Al responder las preguntas abiertas, el owner sumó el aviso en los formularios en diálogo del panel (P4).

## Why

Verificado hoy, 8 de octubre de 2026, en `origin/main`:

1. **El borrador del constructor se pierde sin aviso.** `ProfileBuilderPage.tsx` guarda el borrador en `useState` y no registra `beforeunload` ni bloquea la navegación del router. Un clic en *Volver*, en el menú lateral o en *Atrás* del navegador, o una recarga, descarta minutos de curaduría sin preguntar. `PortadaPage.tsx` tiene el mismo patrón; ya calcula `dirty` y muestra "Cambios sin guardar", pero tampoco protege la salida.
2. **`accentColor` es un campo fantasma.** Existe en el schema, la entidad, los DTO de entrada y salida, el preview y el seed (`docs/cv-data.json` trae un color distinto para cada una de las 13 plantillas). Ninguna pestaña del constructor lo edita y **ningún componente del frontend lo lee** (`grep accentColor frontend/src` solo encuentra el borrador y los fixtures). Además se superpone con el token `colors.accent` del tema, que el customizador sí edita y que es el que pinta el sitio.
3. **El registro de la visita está en el camino crítico.** `resolve-curated-profile.use-case.ts:75` hace `if (input.viewContext) await this.recordView(...)` antes de devolver el resultado. El try/catch evita que un fallo rompa la respuesta, pero cada visita pública espera una transacción de escritura (`ProfileView` + `views++`) que no cambia nada de lo que se responde.
4. **El sitio público no tiene Content-Security-Policy.** Helmet va sin CSP porque la API no sirve HTML. Desde `add-server-rendered-head`, **Caddy sí sirve el HTML** (la SPA más el fragmento de head con su JSON-LD), y la cabecera no existe en ninguna respuesta del servicio `web`.

## What Changes

- **Aviso de cambios sin guardar** en el constructor de perfiles curados y en la Portada: `beforeunload` al cerrar o recargar, y un diálogo propio del panel al navegar dentro de la SPA (enlaces, *Volver*, menú lateral, *Atrás*). Cambiar solo la query (`?lang=` de la Portada) no cuenta como salir. Guardar con éxito deja la página limpia.
- **El router pasa a ser un data router** con el mínimo cambio posible: `createBrowserRouter` con una única ruta comodín que monta el `AppRouter` actual. Las `<Routes>` declarativas del sitio y del backoffice quedan como están; solo así `useBlocker` funciona (D1). El helper de tests `renderWithProviders` cambia `MemoryRouter` por `createMemoryRouter` con la misma forma.
- **La visita sale del camino crítico**: el caso de uso entrega el registro a un puerto `BackgroundTasks` (definido en `shared/application`, implementado en `shared/infrastructure`) y responde sin esperarlo. La transacción atómica del repositorio no cambia. Los fallos se registran en el log, como hoy.
- **Apagado ordenado**: `PrismaService.onModuleDestroy` drena las tareas en vuelo (con tope de tiempo) **antes** de desconectar la base. Los e2e esperan las visitas con `whenIdle()`, sin `sleep`.
- **CSP del sitio en Caddy**, aplicada en modo *enforce* a las respuestas de la SPA, con el nombre de la cabecera configurable por variable (`CSP_HEADER`) para pasar a `Report-Only` sin reconstruir la imagen.
- **`accentColor`, primera etapa de su retiro** (D9, decisión del owner): el constructor deja de enviarlo en el alta, el guardado y el preview, y el OpenAPI lo marca `deprecated` en la entrada y la salida del perfil curado. La API lo sigue aceptando y devolviendo igual; un change posterior lo quita de la salida y borra la columna.
- **Aviso en los formularios en diálogo** (D11, D12, decisión del owner): experiencia, categoría, skill, formación, certificación, proyecto, enlace social e idioma piden *Seguir editando* / *Descartar* si se cierran con cambios por *Cancelar*, *Escape*, clic fuera o la X, y avisan al recargar. Reusan el diálogo y el `beforeunload` del guardián compartido.

### Non-goals

- Bloquear *Atrás* del navegador con un formulario en diálogo abierto fuera del constructor y de la Portada (D11: un router admite un solo blocker). Migrar esos formularios a React Hook Form.
- Pedir confirmación al cerrar sesión con cambios sin guardar (D10).
- Quitar `accentColor` de la salida o borrar su columna: change posterior (D9).
- Autoguardado o persistencia del borrador entre sesiones. Sigue siendo estado en memoria (regla de `CLAUDE.md`: sin `localStorage`).
- Reescribir el routing a rutas de objeto, loaders o actions. El data router se usa solo como contenedor del blocker.
- Una cola o tabla de *outbox* para las visitas, reintentos o un servicio externo. Con el tráfico actual alcanza con tareas en proceso drenadas al apagar.
- El caché de lectura de `cache-de-lectura-y-visitas` (`docs/ROADMAP-1.1.md` § 5). Este change resuelve solo la mitad de las visitas.
- CSP para Swagger (`/api/docs`) o para las respuestas JSON de `/api/*`: no son documentos que el navegador renderice como el sitio, y Swagger va cerrado en producción.
- Un endpoint propio para recibir reportes de violaciones CSP (`report-to`).
- Migración de Prisma: ninguna.

## Capabilities

### New Capabilities
- `site-security-policy`: cabeceras de seguridad del sitio que sirve el contenedor `web` (Caddy), empezando por su Content-Security-Policy.

### Modified Capabilities
- `curated-profile-builder`: aviso antes de descartar un borrador sin guardar, y el constructor deja de enviar `accentColor`.
- `admin-content-management`: el mismo aviso en la Portada, y el aviso al cerrar con cambios los formularios en diálogo.
- `profile-view-analytics`: la respuesta pública no espera al registro, y el apagado no pierde visitas en vuelo.
- `admin-curated-profile-crud`: `accentColor` marcado obsoleto en el contrato, sin cambio de comportamiento.

## Impact

- **Frontend**: `src/app/App.tsx` (data router), `src/test/render.tsx`, un hook y un diálogo nuevos en `features/backoffice/shared/`, `ProfileBuilderPage.tsx`, `PortadaPage.tsx` y sus tests; `curated-profiles/profile-draft.ts` (sin `accentColor`); un hook de diálogo en `features/backoffice/shared/` y los formularios `ExperienceForm.tsx`, `FormacionForms.tsx`, `ProjectForm.tsx`, `SocialLinkForm.tsx`, `SkillsPage.tsx` y `LanguagesSection` de `PortadaPage.tsx`, con sus tests.
- **Backend**: puerto `shared/application/background-tasks.ts`, implementación y módulo global en `shared/infrastructure/background/`, `ResolveCuratedProfileUseCase`, `PrismaService`, `test/e2e-helpers.ts` y los e2e que cuentan visitas; `deprecated` en `accentColor` de `curated-profile.dto.ts` y de `docs/admin-curated-profile.response.ts` y `docs/curated-profile.response.ts`.
- **Borde**: `frontend/Caddyfile` (cabecera y variable `CSP_HEADER`).
- **Docs**: `docs/MANUAL.md` y `docs/manual/index.html` (casos nuevos TC-28 a TC-30), `docs/DEPLOY.md` § 9.5 y `docs/DEPLOY-RAILWAY.md` (variable `CSP_HEADER`, gracia de apagado), `docs/ROADMAP-1.1.md` (marcar los defectos resueltos y anotar el change posterior de `accentColor`).
- **Contrato OpenAPI**: solo el grupo 5, compatible: `accentColor` pasa a `deprecated`; se regeneran `backend/openapi.json` y `frontend/src/shared/types/api.d.ts`.
