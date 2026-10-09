# Design — polish-builder-and-edge

## Context

Ver `proposal.md`. Lo que el código decide hoy (verificado el 8 de octubre de 2026 en `origin/main`):

**Router.** `src/app/App.tsx` monta `<BrowserRouter><AppRouter /></BrowserRouter>`; `AppRouter` y `BackofficeApp` son `<Routes>` declarativas anidadas (`/admin/*` → `<Routes>` → `*` → `<Routes>` del panel). La dependencia es `react-router@8.3.1`. En esa versión `useBlocker` empieza por `useDataRouterContext("useBlocker")`, que lanza *"must be used within a data router"* fuera de `createBrowserRouter`/`RouterProvider`. `useBeforeUnload` no tiene esa restricción. Los tests montan con `src/test/render.tsx` (`MemoryRouter`), que usan 14 archivos.

**Borradores.** `ProfileEditor` guarda el borrador en `useState` y, tras un `PATCH` exitoso, no lo reinicia: el borrador queda igual a lo guardado, pero nada lo marca como limpio. Al crear, navega con `replace` a `/admin/perfiles/:id`. `PortadaPage` ya calcula `dirty` comparando el borrador con `toPortadaDraft(profile.data)`, que se recalcula al volver la consulta, y su conmutador de idioma escribe `?lang=` en la URL (`useLocale` → `useUrlState`).

**`accentColor`.** Columna `CuratedProfile.accentColor` (default `#1A365D`), validada como `#RRGGBB` en dominio y DTO, copiada al duplicar, expuesta en la salida pública, el listado y el preview. `theme-resolution` dice que *"NO SHALL alterar los tokens automáticamente (el frontend decide su uso)"*. El frontend no lo usa en ningún lado; el acento visible del sitio es `tokens.colors.accent`, que el customizador edita y guarda como diferencia en `themeOverrides`. El seed trae 10 colores distintos para 13 plantillas, lo que sugiere una intención de producto que nunca llegó a la pantalla.

**Visitas.** El caso de uso espera `profileViews.record(...)` (una `$transaction` con `create` + `update views increment`) antes de `return ok(output)`. `main.ts` llama a `enableShutdownHooks()`. En `@nestjs/core`, `close()` ejecuta `onModuleDestroy` de todos los módulos, después `beforeApplicationShutdown`, **después** cierra el servidor HTTP y por último `onApplicationShutdown`. `PrismaService.onModuleDestroy` hace `$disconnect()`. El orden entre módulos de igual distancia no está garantizado.

**Borde.** `frontend/Caddyfile` sirve `/srv` con `try_files` → `/index.html`, procesa solo `index.html` con `templates` (para el `httpInclude` del fragmento de head) y hace proxy de `/api/*`, `/health*`, `/robots.txt` y `/sitemap.xml`. Ya emite `X-Content-Type-Options` y `Referrer-Policy: no-referrer`; no emite CSP. Lo que carga el sitio:

| Recurso | Origen | Cómo |
|---|---|---|
| JS y CSS del build | `'self'` (`/assets/*`) | `<script type="module" src>` y `<link>`, sin scripts inline en `index.html` |
| Chunks diferidos (`React.lazy` del panel) | `'self'` | `import()` |
| Hoja de Google Fonts | `https://fonts.googleapis.com` | `<link rel=stylesheet>` que inyecta `themes/fonts.ts` en runtime |
| Archivos de fuente | `https://fonts.gstatic.com` | los pide esa hoja |
| Tokens del tema | — | `style` de React sobre el contenedor raíz (CSSOM, `setProperty`) |
| Animaciones | — | `motion` escribe `element.style` (CSSOM) |
| Toasts | — | `sonner` inserta un `<style>` en el `<head>` al cargar |
| Imágenes | `'self'` | `favicon.svg`; `og-default.png` solo la piden los rastreadores, no el documento |
| Datos | `'self'` | `fetch` relativo a `/api/*` (sin `VITE_API_URL`) |
| JSON-LD | — | `<script type="application/ld+json">` del fragmento de head |

No hay `<img>` con origen externo, `iframe`, workers, `eval` ni `dangerouslySetInnerHTML` en `frontend/src`.

**Formularios en diálogo** (verificado el 8 de octubre de 2026, agregado al responder P4). Todos usan el `Dialog` de shadcn/ui (Radix). *Escape*, el clic en el overlay y la X llaman a `onOpenChange(false)`; *Cancelar* llama a `onOpenChange(false)` en los formularios con componente propio y a `setDraft(null)`/`setCategoryDraft(null)`/`setSkillDraft(null)` en los borradores en línea. El guardado exitoso cierra desde el padre (`setEditing(null)` o `setDraft(null)`), sin pasar por `onOpenChange`. Hay dos formas:

| Formulario | Archivo | Estado | Cuerpo |
|---|---|---|---|
| Experiencia | `experiences/ExperienceForm.tsx` | `values` propio desde `initialValues ?? EMPTY_EXPERIENCE`; el padre lo monta con `key` | `toExperienceBody` |
| Formación, certificación | `formacion/FormacionForms.tsx` | ídem (`EMPTY_EDUCATION`, `EMPTY_CERTIFICATION`) | `toEducationBody`, `toCertificationBody` |
| Proyecto, enlace social | `proyectos/ProjectForm.tsx`, `SocialLinkForm.tsx` | ídem; `Dialog open` fijo, el padre lo desmonta | `toProjectBody`, `toSocialLinkBody` (`stats` inválido → `null`) |
| Categoría, skill | `skills/SkillsPage.tsx` | borrador en línea `categoryDraft`/`skillDraft` en la página | armado dentro de `submitCategory`/`submitSkill` |
| Idioma | `portada/PortadaPage.tsx` (`LanguagesSection`) | borrador en línea `draft` | armado dentro de `submit` |

`ChipListField` guarda en su propio estado el texto que todavía no se agregó como chip.

## Goals / Non-Goals

**Goals:** que ninguna salida del constructor, de la Portada ni de un formulario en diálogo descarte cambios sin preguntar; que la respuesta pública no espere la escritura de la visita sin perder atomicidad ni visitas al apagar; que el sitio sirva una CSP que no rompa nada de lo que hoy funciona; dar el primer paso del retiro de `accentColor` (D9).
**Non-Goals:** ver `proposal.md` § Non-goals.

## Decisions

### D1 — Data router mínimo: una ruta comodín que envuelve el `AppRouter` actual

`App.tsx` crea el router con `createBrowserRouter([{ path: '*', element: <AppRouter /> }])` y lo monta con `<RouterProvider>`. `AppRouter`, `BackofficeApp` y todas sus `<Routes>` quedan intactas: react-router admite rutas descendientes bajo un comodín de un data router, y toda navegación (`Link`, `useNavigate`, `<Navigate>`, *Atrás*) pasa por el router, que es lo que `useBlocker` intercepta. `renderWithProviders` cambia `MemoryRouter` por `createMemoryRouter([{ path: '*', element: ui }], { initialEntries: [route] })` + `RouterProvider`, sin cambiar su firma, de modo que los 14 archivos que lo usan no se tocan.

Alternativas descartadas: (a) migrar a rutas de objeto con loaders: reescribe el routing sin beneficio para este defecto; (b) quedarse en `BrowserRouter` e interceptar a mano los clics de los enlaces del panel (contexto propio que envuelve `Link`): no cubre *Atrás*, ni `navigate()` programático, ni un enlace nuevo que alguien agregue sin el envoltorio; (c) `unstable_usePrompt`: también exige data router y usa `window.confirm`, fuera del sistema visual del panel.

### D2 — Un único guardián compartido: `useUnsavedChangesGuard(dirty)` + `UnsavedChangesDialog`

Viven en `features/backoffice/shared/`. El hook registra `beforeunload` solo mientras `dirty` es verdadero (`preventDefault()` y `returnValue = ''`; el navegador muestra su propio texto, que no se puede personalizar) y un `useBlocker` cuya función bloquea **solo si cambia el `pathname`**. Así el `?lang=` de la Portada y cualquier cambio de query no disparan el diálogo. El diálogo reusa `ConfirmDialog`: *"Tenés cambios sin guardar"*, acciones *Seguir editando* (`blocker.reset()`) y *Salir sin guardar* (`blocker.proceed()`).

La función del blocker lee el estado sucio de una **ref** sincronizada en el render, y el hook expone `markSaved(snapshot)` para actualizarla de forma síncrona. Motivo: al crear un perfil, `onSuccess` actualiza el estado y navega en el mismo tic; con una clausura sobre `dirty` el blocker vería el valor viejo y bloquearía la propia navegación a la ficha nueva.

Alternativa descartada: un guardián por página. Duplica la lógica sutil (ref, query vs. pathname, `beforeunload`) en dos lugares que tienen que comportarse igual.

### D3 — "Sucio" se mide contra el último guardado, sobre el cuerpo que se envía

En el constructor, el estado sucio es `JSON.stringify(toProfileBody(draft)) !== baseline`, con `baseline` inicializado desde `initialDraft` y reemplazado por el cuerpo enviado cuando el guardado tiene éxito. Comparar el cuerpo (y no el borrador crudo) hace que escribir y borrar un carácter, o un espacio final que `toProfileBody` recorta, vuelva a "limpio". El idioma del preview (estado de vista, D1 de `add-bilingual-builder-parity`) y el archivado (endpoint propio, se aplica al instante) no forman parte del cuerpo y, por lo tanto, nunca ensucian. En la Portada se reusa el `dirty` que ya existe. Un guardado que falla (400, 409) deja la página sucia.

Alternativa descartada: marcar sucio en el primer `onChange` y limpiar solo al guardar. Daría falsos positivos (deshacer a mano no limpia) y obligaría a tocar cada campo.

### D4 — La visita se delega a un puerto `BackgroundTasks` y la respuesta no la espera

Puerto en `shared/application/background-tasks.ts` (sin Nest ni Prisma; token `BACKGROUND_TASKS`):

- `run(name: string, task: () => Promise<void>): void`: lanza la tarea y la registra como en vuelo; un rechazo se captura y se registra en el log con el nombre, nunca se propaga.
- `whenIdle(): Promise<void>`: resuelve cuando no queda ninguna tarea en vuelo, incluidas las que se lanzaron mientras se esperaba.
- `drain(timeoutMs: number): Promise<void>`: como `whenIdle`, con tope; al vencer, registra un `warn` con la cantidad pendiente y resuelve.

Implementación `InProcessBackgroundTasks` en `shared/infrastructure/background/`, provista por un `BackgroundTasksModule` global. `ResolveCuratedProfileUseCase` inyecta el puerto por token (DIP) y reemplaza `await this.recordView(...)` por `this.background.run('record-profile-view', () => this.recordView(...))`. `recordView` y `PrismaProfileViewRepository.record` no cambian: la atomicidad (`ProfileView` + `views++` en una `$transaction`) sigue en el repositorio. El paso 6 sigue perteneciendo al caso de uso, como dice `CLAUDE.md`.

Alternativas descartadas: (a) disparar el registro desde el controller después de enviar la respuesta (`res.on('finish')`): saca un paso del núcleo a infraestructura y lo duplica si otra ruta resuelve con contexto de visita; (b) `@nestjs/event-emitter`: dependencia nueva y sus manejadores asíncronos no se esperan al apagar; (c) `void this.recordView(...)` sin registro: no hay forma de esperarlo en tests ni de drenarlo al cerrar; (d) una cola persistente o tabla *outbox*: desproporcionado para visitas de a decenas.

### D5 — El drenaje ocurre en `PrismaService.onModuleDestroy`, antes de `$disconnect()`

`PrismaService` recibe el puerto y su `onModuleDestroy` hace `await this.background.drain(SHUTDOWN_DRAIN_MS)` y recién después `$disconnect()`. Con `SHUTDOWN_DRAIN_MS = 5000`. Es la única ubicación con orden garantizado: `beforeApplicationShutdown` y `onApplicationShutdown` corren **después** de todos los `onModuleDestroy` (la base ya estaría cerrada), y un `onModuleDestroy` en el propio módulo de tareas no tiene orden asegurado frente al de `PrismaModule`, porque ambos son globales y de igual distancia.

Consecuencia aceptada: Nest cierra el servidor HTTP **después** de los `onModuleDestroy`, así que durante el drenaje todavía pueden entrar peticiones. `whenIdle`/`drain` esperan también a las tareas lanzadas mientras se drena; una visita que llegue después de vencido el tope puede perderse y queda en el log. Reordenar el cierre de Nest está fuera de alcance.

Alternativa descartada: drenar en `beforeApplicationShutdown` y mover el `$disconnect()` a `onApplicationShutdown`. Funciona, pero cambia el ciclo de vida de la conexión para todo el backend por un caso puntual.

### D6 — Los tests esperan las visitas con `whenIdle()`, nunca con `sleep`

`test/e2e-helpers.ts` suma `settleBackgroundTasks(app)`, que hace `app.get(BACKGROUND_TASKS).whenIdle()`. Todo e2e que lea `ProfileView` o `views` después de una petición pública lo llama antes de contar, **también los que comprueban que no se registró nada** (401, 404, preview, archivado, `profile-head`): sin esperar, esos pasarían aunque el registro se disparara. En unitarios, un `FakeBackgroundTasks` captura las tareas sin ejecutarlas, lo que permite comprobar que `execute()` resuelve antes de que la escritura termine.

Alternativa descartada: un flag de configuración que vuelva a esperar la escritura en tests. Los e2e dejarían de probar el comportamiento de producción.

### D7 — CSP del sitio en Caddy, en modo *enforce*, solo para las respuestas de la SPA

Política, emitida desde el bloque `handle` que sirve `/srv` (no desde el de `/api/*`, cuyas respuestas son JSON o las arma la API):

```
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
font-src 'self' https://fonts.gstatic.com;
img-src 'self' data:;
connect-src 'self';
object-src 'none';
base-uri 'self';
form-action 'self';
frame-ancestors 'none'
```

Justificación de cada concesión:

- **`script-src 'self'` sin `'unsafe-inline'` ni hashes.** El build de Vite no deja scripts inline en `index.html`. El JSON-LD es un *data block* (`type="application/ld+json"`): el navegador no lo ejecuta y `script-src` no se le aplica, así que no necesita hash ni nonce. Lo comprueba la tarea 4.4 (ninguna violación en consola con el fragmento presente).
- **`style-src 'unsafe-inline'`.** `sonner` inserta un elemento `<style>` y no acepta nonce. Los tokens del tema y `motion` no lo necesitan (escriben por CSSOM, que la CSP no controla), pero el `<style>` de los toasts sí. El riesgo residual es inyección de CSS, no de script.
- **`img-src data:`.** Margen para SVG embebidos de componentes; no hay imágenes externas.
- **Sin `upgrade-insecure-requests`.** Railway termina el TLS en el borde y el sitio ya se sirve por HTTPS; en la verificación local por `http://localhost` esa directiva rompería la carga de los propios assets.

*Enforce* directo y no `Report-Only`: la superficie está enumerada y es chica, no hay un colector de reportes (en `Report-Only` las violaciones solo aparecen en la consola de cada visitante, donde nadie las ve), y la tarea 4.4 recorre el sitio y el panel en el contenedor real antes de desplegar. Como red de seguridad, el nombre de la cabecera sale de una variable de Caddy, `{$CSP_HEADER:Content-Security-Policy}`: poner `CSP_HEADER=Content-Security-Policy-Report-Only` en Railway y redesplegar desactiva el bloqueo sin reconstruir la imagen.

Alternativa descartada: nonce por petición generado en `templates` (`{{uuid}}` o similar) para quitar `'unsafe-inline'` de `style-src`. `sonner` no lo usaría, y la CSP dependería de que el HTML pase siempre por `templates`.

### D8 — Capability nueva `site-security-policy`

Las cabeceras del contenedor `web` no son de la API (`api-security-headers` describe Helmet en Nest) ni de SEO (`public-seo`). Una capability propia deja claro dónde viven y deja lugar para las que ya emite el Caddyfile.

Alternativa descartada: agregar el requisito a `api-security-headers`. Su nombre y sus escenarios hablan de la API; mezclarlos confundiría qué componente cumple cada uno.

### D9 — `accentColor` se retira en dos etapas; en esta, el panel deja de enviarlo y el contrato lo marca obsoleto (P1 = B)

Decisión del owner (8 de octubre de 2026). El acento del sitio es `tokens.colors.accent`; un segundo color fuera de los tokens contradice el pilar de theming de `CLAUDE.md`.

**Esta etapa (grupo 5):**
- **Frontend.** `accentColor` sale de `ProfileDraft`, `EMPTY_DRAFT`, `toProfileDraft` y `toProfileBody`, así que no viaja en el alta, el `PATCH` ni el preview. El `PATCH` es parcial: el valor guardado se conserva. El alta toma el default del API (`#1A365D`). El tipo de salida `CuratedProfile` lo conserva porque la respuesta todavía lo trae.
- **Backend (solo documentación del contrato).** `deprecated: true` y una `description` en `@ApiPropertyOptional` de `CreateCuratedProfileDto.accentColor` (`Update` y `Preview` heredan por `PartialType`) y en `@ApiProperty` de `AdminCuratedProfileResponse` y `CuratedProfileSummaryResponse` (`CuratedProfileResponse` y `PreviewCuratedProfileResponse` heredan). Validación, default, duplicado, salida y schema **no cambian**. Se regeneran `backend/openapi.json` (`npm run openapi:export`) y `api.d.ts` (`npm run api:types`), que pasa a anotarlo `@deprecated`.
- **Specs.** `ADDED` en `curated-profile-builder` (*El constructor no envía `accentColor`*) y en `admin-curated-profile-crud` (*`accentColor` obsoleto en el contrato*). Los requisitos vigentes que lo nombran siguen siendo ciertos (la API lo acepta, lo copia y lo devuelve), por eso no se modifican aquí.

Consecuencia aceptada: el preview del constructor ya no envía el color, de modo que su respuesta trae el default y no el del perfil. Nadie lo lee.

**Change posterior** (se anota en `docs/ROADMAP-1.1.md`): quitarlo de la salida y del DTO de entrada, migración que borra la columna y el campo del seed, y los `MODIFIED` de `admin-curated-profile-crud` § *Campos opcionales de la creación y sus valores por defecto* y § *Duplicar un perfil curado*, `admin-curated-profile-preview` § *Resolución de un borrador sin persistir*, `curated-profile-resolution` § *Resultado listo para presentación*, `public-curated-profile-api` § *Listado de perfiles curados públicos* y `theme-resolution` § *Forma del tema resuelto*. Si se quieren colores por plantilla, van a `themeOverrides.colors.accent` del seed, que es otra decisión.

Alternativas descartadas: (A) exponerlo en la pestaña Diseño con un consumidor (`theme-color`, punto en el menú): dos acentos en la misma pestaña; (C) exponerlo sin uso; (B en una sola etapa) quitarlo ya de la salida y borrar la columna: rompe el contrato en el mismo change que lo depreca y suma una migración a un change de pulido.

### D10 — Cerrar sesión con cambios sin guardar no pide confirmación (P2 = no)

Decisión del owner (8 de octubre de 2026). La navegación a `/admin/login` nunca se bloquea: el logout es una acción explícita y, sin sesión (cerrada o vencida), el borrador ya no puede guardarse; bloquear esa redirección dejaría una página sin sesión. Lo implementa la función del blocker de D2 y lo fija el requisito *El fin de la sesión no se bloquea* de `curated-profile-builder`.

Alternativa descartada: que *Salir* pase por el diálogo de cambios sin guardar.

### D11 — Los formularios en diálogo interceptan su propio cierre, sin `useBlocker` (P4 = incluir)

Decisión del owner (8 de octubre de 2026): los ocho formularios en diálogo avisan. Todo cierre que no sea un guardado pasa por `onOpenChange(false)` o por *Cancelar* (ver § Context), así que alcanza con un punto de intercepción: `useDialogDiscardGuard({ dirty, onClose })` en `features/backoffice/shared/` devuelve `requestClose`, que cierra si no hay cambios y, si los hay, abre el aviso sin cerrar el formulario. *Cancelar* deja de cerrar directo y llama a `requestClose`. El guardado exitoso sigue cerrando desde el padre y no pasa por el guardián.

El aviso **reusa el del grupo 1** sin duplicarlo: de `UnsavedChangesDialog` se extrae un `UnsavedChangesPrompt` presentacional sobre `ConfirmDialog` (`open`, `onStay`, `onLeave`, `leaveLabel`), que `UnsavedChangesDialog` usa con el blocker (*Salir sin guardar*) y el formulario con su `requestClose` (*Descartar*); título y descripción son los mismos. Del guardián de D2 se extrae `useWarnBeforeUnload(active)`, que también usa el formulario abierto y con cambios. El `AlertDialog` del aviso se apila sobre el `Dialog`; *Escape* dentro del aviso equivale a *Seguir editando*.

El guardián de diálogo **no** registra `useBlocker`: un router admite un solo blocker activo y la Portada ya tiene el suyo, del que `LanguagesSection` es hija. Mientras el modal está abierto tapa la navegación del panel; la única salida por el router es *Atrás* del navegador (ver Risks).

Alternativas descartadas: (a) `onEscapeKeyDown`/`onPointerDownOutside`/`onInteractOutside` con `preventDefault` en cada `DialogContent`: tres manejadores por formulario y no cubren la X ni *Cancelar*; (b) un `GuardedDialog` que envuelva `Dialog`: los borradores en línea viven en la página y no en un componente, así que igual necesitan el hook; (c) sumar el estado sucio del diálogo al guardián de la página: acopla cada formulario con la página que lo aloja y no existe en las que no tienen guardián.

### D12 — "Sucio" en un formulario en diálogo se mide sobre el cuerpo, contra los valores al abrirlo

La misma regla que D3: `dirty = JSON.stringify(toXBody(actual)) !== JSON.stringify(toXBody(inicial))`, con `inicial` = `initialValues ?? EMPTY_*` en los formularios con componente propio (se montan con `key`, así que el inicial es estable) y, en los borradores en línea, el borrador guardado al abrir junto al actual. Para estos últimos se extraen `toCategoryBody`, `toSkillBody` y `toLanguageBody` de lo que hoy arma cada `submit`, así guardar y comparar usan la misma función. Excepción: en el enlace social, el texto de `stats` se compara recortado además del cuerpo, porque `toSocialLinkBody` convierte un JSON inválido en `null` y ese texto se perdería sin aviso. El texto pendiente de un `ChipListField` no cuenta (vive fuera de los valores). Un guardado que falla deja el formulario sucio.

Alternativa descartada: `isDirty` de React Hook Form. Estos formularios no usan RHF (estado con `useState`) y migrarlos excede el change.

## Risks / Trade-offs

- **[Data router con rutas descendientes]** → Un comportamiento distinto de `<Routes>` bajo `RouterProvider` aparecería en los 14 archivos de tests que usan `renderWithProviders`. Mitigación: la tarea 1.1 corre la suite completa antes de tocar las páginas.
- **[`beforeunload` no es personalizable]** → El texto lo pone el navegador y algunos móviles lo ignoran. Se acepta: es la única API disponible.
- **[Visita perdida al apagar]** → Una visita que llegue después de vencer el tope de 5 s se pierde (queda en el log). Depende de cuánto espera Railway entre `SIGTERM` y `SIGKILL` (P3).
- **[Contador eventual]** → El `views` del panel y del dashboard puede ir unos milisegundos por detrás de la respuesta pública. No es observable para una persona.
- **[CSP que rompe algo no inventariado]** → Mitigado por la tarea 4.4 y por `CSP_HEADER` como interruptor sin rebuild.
- **[Fuentes]** → Si un tema agrega una familia que no está en Google Fonts, `fonts.ts` no la pide: la CSP no cambia ese comportamiento.
- **[*Atrás* con un formulario en diálogo abierto]** → Sin blocker propio (D11), *Atrás* del navegador cambia de ruta y descarta el formulario sin aviso, salvo en el constructor y la Portada, cuyo guardián de página sí bloquea si la página está sucia. Se acepta: el modal tapa el resto de la navegación del panel y *Atrás* con un modal abierto es raro.
- **[Extracción sobre el grupo 1]** → El grupo 7 refactoriza código que el grupo 1 acaba de escribir. Mitigación: la tarea 7.2 no toca los tests de los grupos 1 y 2 y exige que sigan en verde.
- **[`accentColor` obsoleto en `api.d.ts`]** → El tipo generado lo anota `@deprecated`; si el lint del frontend avisa por su uso (fixtures), la tarea 5.5 lo resuelve sin desactivar la regla.

## Migration Plan

1. Grupos 1 a 5, en cualquier orden entre sí (ver `tasks.md`); el grupo 7 después del grupo 1, y el 6 al final. Ninguno toca el schema; solo el grupo 5 cambia el OpenAPI, y de forma compatible (`deprecated`).
2. Despliegue: el contenedor `web` publica la CSP en *enforce*; si aparece una violación en producción, `CSP_HEADER=Content-Security-Policy-Report-Only` y redespliegue; se corrige y se vuelve al default.
3. Rollback del backend: revertir el commit; no hay datos que migrar.
4. `accentColor`: un cliente externo que todavía lo envíe sigue funcionando; la columna se borra en el change posterior de D9.

## Open Questions

Respondidas por el owner el 8 de octubre de 2026 y convertidas en decisiones:

- **P1 — `accentColor`** → opción B, retiro en dos etapas: **D9**.
- **P2 — ¿El cierre de sesión con cambios pide confirmación?** → no: **D10**.
- **P4 — ¿Los formularios en diálogo también avisan?** → sí, en este change: **D11** y **D12** (grupo 7 de `tasks.md`).

Sigue abierta:

1. **P3 — ¿Cuánto espera Railway entre `SIGTERM` y `SIGKILL` en el servicio `api`?** **[no bloqueante]** El drenaje usa un tope de 5 s (D5). Opciones: (a) confirmar el valor actual de `RAILWAY_DEPLOYMENT_DRAINING_SECONDS` y fijarlo en 10 s; (b) bajar el tope a lo que dé Railway. **Recomendación: (a)**. Mientras no haya respuesta, la tarea 6.2 la deja escrita como recomendación en `docs/DEPLOY.md` § 9.5 y `docs/DEPLOY-RAILWAY.md`; no frena ningún grupo.
