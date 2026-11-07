# Design — fix-error-contrast-and-date-modified

## Context

**Parte A — contraste de los errores.**

- `theme.css` declara `--color-destructive: #dc2626` dentro de `@theme inline`: es el único color de estado que **no** deriva del tema. `text-destructive` aparece en 19 líneas de `frontend/src`: 17 mensajes de error o aviso (`role="alert"`/`role="status"`) en el panel y en `AccessTokenForm` (vista pública, perfiles `PROTECTED`), `hover:text-destructive` en el botón de quitar de `ChipListField`, y los dos de `ui/form.tsx` (`FormLabel`, `FormMessage`), que hoy no usa ninguna pantalla.
- El panel fija `modern-dark` (`AdminShell`, D4 de `add-admin-backoffice`). Medido con la fórmula de `contrast.ts`, `#dc2626` como texto da:

  | Preset | `bg` | `bgSoft` | `card` |
  |---|---|---|---|
  | modern-dark (panel) | 3,99 | 3,67 | **3,48** |
  | elegant | 3,67 | 3,40 | 3,20 |
  | corporate | 4,62 | **4,39** | 4,83 |
  | minimal | 4,83 | 4,63 | 4,83 |

- `add-admin-password-change` (desvío 2) arregló solo `/admin/cuenta` con `ERROR_TEXT = 'text-[color-mix(in_srgb,var(--color-destructive)_60%,var(--t-text))]'`. Funciona en `modern-dark`, pero es una mezcla fija: no garantiza 4,5:1 en otro tema ni sigue el patrón del resto de los derivados.
- El patrón vigente (`fix-admin-contrast`, D2; `improve-a11y-and-performance`, D1): `tokensToCssVars` calcula `--t-accent-ink`, `--t-success-ink` y `--t-accent2-ink` con `accentInk(base, superficies, mode)`, que conserva tono y saturación y mueve la luminosidad en pasos de 1 % hasta 4,5:1; si la base ya cumple, devuelve la base. La base verde vive como constante `SUCCESS` en `css-vars.ts` y `--color-success-ink` la expone en `@theme inline`.
- `status-color-usage.spec.ts` prohíbe colores de Tailwind con nombre como texto (`text-red-500`…) y opacidad por visibilidad en `shared/components/portfolio`, `features/navigation`, `features/curated-view` y `features/backoffice`. No mira `text-destructive`.
- `check-a11y.mjs` audita `/admin/login` sin sesión y, con `A11Y_CHECK_ADMIN_EMAIL`/`_PASSWORD`, nueve rutas del panel (la sesión se abre con `fetch('/api/auth/login')`). Ninguna carga muestra un mensaje de error.

**Parte B — `dateModified`.**

- `CuratedProfile.updatedAt` (`@updatedAt`) ya solo cambia con ediciones: el incremento de `views` y la reclasificación usan `$executeRaw` (D1 y D2 de `polish-views-updated-at-and-builder`). El sitemap lo publica como `<lastmod>` con `toISOString().slice(0, 10)` (día UTC).
- La entidad `CuratedProfile` ya trae `updatedAt?: Date` (el mapper Prisma lo copia). El composer arma `CuratedProfileOutput` con `toCuratedProfileOutput(resolution)`, y `resolution.curated` es esa entidad: **el dato ya está en memoria** en la ruta pública, en el head (`GetProfileHeadUseCase` compone con el mismo composer) y en el preview.
- `CuratedProfileOutput` no trae `updatedAt`; el DTO de admin sí (`string | null`, ISO).
- `profilePageJsonLd` existe dos veces, en `profile-head.renderer.ts` (backend) y en `document-meta.ts` (cliente), y `docs/fixtures/profile-head-consistency.json` (7 casos) compara las dos salidas, incluido el orden de claves (D2 de `upgrade-profile-structured-data`).
- De los modelos de contenido, solo `Profile`, `Experience` y `Theme` tienen `updatedAt`; `Skill`, `SkillCategory`, `Education`, `Certification`, `Project` y `SocialLink` no.
- La spec vigente `public-seo` › *Datos estructurados del profesional* tiene el escenario «Sin fecha de modificación». OpenSpec 1.14.1 no deja quitar un escenario en un `MODIFIED` (el archivado se niega), así que el delta lo conserva con su nombre y lo acota al caso `updatedAt: null`, y suma «Fecha de modificación presente».
- El owner resolvió la P1 de `polish-views-updated-at-and-builder` con la opción A: «`updatedAt` en `CuratedProfileOutput`, OpenAPI y `api.d.ts`, `dateModified` en el fragmento y en el cliente, con su escenario en `public-seo`».

## Goals / Non-Goals

**Goals:** que todo mensaje de error del panel y de la vista pública mida ≥ 4,5:1 en cualquier preset, con un derivado del tema y no con mezclas sueltas; que una regla estática y `a11y:check` lo sostengan; que el `ProfilePage` lleve `dateModified` coherente con el `<lastmod>`, igual en el head y en el cliente, sin consultas nuevas.

**Non-Goals:** ver `proposal.md` § Non-goals.

## Decisions

### D1 — `--t-danger-ink`, derivado como `--t-success-ink`

- `css-vars.ts` suma `export const DANGER = '#dc2626'` (el mismo valor que `--color-destructive`, documentado como su base) y en `tokensToCssVars`:
  `'--t-danger-ink': accentInk(DANGER, [colors.bg, colors.bgSoft, colors.card], tokens.mode)`.
- Superficies: los tres fondos del tema. Los mensajes se pintan sobre la tarjeta (`surface`, diálogos = `popover` = `card`) o sobre el fondo; ninguno va sobre un tinte rojo (no hay `bg-destructive/10` detrás de un texto de error), así que no se agregan tintes como en el verde.
- `ThemeCssVars` suma la clave con su comentario; `@theme inline` suma `--color-danger-ink: var(--t-danger-ink)` (utilidad `text-danger-ink`); `:root` suma el default de `modern-dark`, `--t-danger-ink: #e45656`, para que el panel pinte bien antes de que el provider aplique los tokens.
- Valores esperados (calculados con `accentInk`; el test los fija por contraste, no por hex, salvo el default): modern-dark `#e45656` (4,61 sobre `card`), elegant `#e55f5f`, corporate `#d52222`, modern-light `#da2323`, minimal `#dc2626` (la base ya cumple).

Alternativas descartadas:
- **Mantener el `color-mix` de `AccountPage` y copiarlo a cada formulario.** Mezcla fija: en un preset claro aclara un rojo que debería oscurecerse, y no hay test que lo garantice.
- **Cambiar `--color-destructive` por el derivado.** Lo usan también `bg-destructive` de botones e insignias con texto blanco: aclarar el fondo en el tema oscuro bajaría el contraste del texto blanco (ver D2), y mezclaría dos usos con requisitos opuestos.
- **Un rojo literal más claro para el panel.** Viola «colores literales solo en `presets/`» y no cubre la vista pública.

### D2 — Qué se reemplaza y qué no (medido)

Se reemplaza por `text-danger-ink`:
- Los 16 mensajes de error y aviso del panel: `LoginPage` (84), `PreviewPanel` (60), `ProfileBuilderPage` (288, 519, 614), `ShareLinksPanel` (79), `ExperienceForm` (86, 102, 130), `FormacionForms` (279), `PortadaPage` (272, 322, 480), `SocialLinkForm` (135), `TextField` (38), `LocalizedField` (86).
- `AccessTokenForm` (45), vista pública: en `elegant` mide 3,20:1 y en `corporate` 4,39:1 sobre `bgSoft`.
- `AccountPage`: se borran la constante `ERROR_TEXT` y su comentario; sus mensajes usan `text-danger-ink`.
- `ChipListField` (90): `hover:text-destructive` → `hover:text-danger-ink`. Es un ícono (3:1 bastaba), pero así la regla de D3 no necesita excepciones.
- `ui/form.tsx` (87, 133): no lo usa ninguna pantalla, pero es la primitiva de formularios de shadcn; se corrige para que el próximo uso nazca bien.

No se toca (medido con la misma fórmula):
- **Botones e insignias destructivos** (`button.tsx`, `badge.tsx`: `bg-destructive text-white`, y `dark:bg-destructive/60`): blanco sobre `#dc2626` = 4,83:1; blanco sobre `bg-destructive/60` encima de `modern-dark` = 9,40:1 (fondo) y 8,77:1 (tarjeta). Cumplen.
- **Bordes y anillos `aria-invalid`** (`border-destructive`, `ring-destructive/20`): componente no textual, 3:1; `#dc2626` sobre la tarjeta del panel = 3,48:1. Cumplen.
- **Variante `destructive` de `dropdown-menu.tsx`**: ninguna pantalla la usa y pinta sobre su propio tinte (`focus:bg-destructive/10`); queda fuera de la regla de D3 (no está en las carpetas que escanea) y se anota como no-goal.

### D3 — La regla estática obliga al token

`status-color-usage.spec.ts` suma la regla `danger` (además de `color` y `opacity`) sobre las mismas cuatro carpetas: una línea incumple si tiene `text-destructive` como clase (sola o con variantes: `hover:`, `focus:`, `data-[…]:`) o una clase arbitraria de texto que nombre `destructive` (`text-[…destructive…]`, el caso de `ERROR_TEXT`). `bg-destructive`, `border-destructive`, `ring-destructive` y `variant="destructive"` no incumplen. El test del detector suma tres líneas: `text-destructive` y `text-[color-mix(…--color-destructive…)]` incumplen; `text-danger-ink` y `bg-destructive text-white` no.

Alternativa descartada: **sumar `shared/components/ui` a las carpetas.** Arrastraría la variante de `dropdown-menu` y las primitivas de shadcn, que se regeneran desde su CLI; `form.tsx` se corrige a mano (D2).

### D4 — `a11y:check` abre formularios con errores, sin escribir ni gastar el límite

- **Login con error (siempre, también sin credenciales):** una entrada nueva `admin-login-error` sobre `/admin/login`. Antes de navegar, `page.setRequestInterception(true)` y el handler responde `401` con `{"statusCode":401,"message":"Unauthorized"}` a `POST /api/auth/login`; el resto de las peticiones sigue (`request.continue()`). Se envía el formulario **vacío** (pulsando «Entrar»: `LoginPage` no valida en el cliente y manda la petición igual), sin escribir nada en ningún campo; se espera el `role="alert"` con «Email o contraseña incorrectos» y recién entonces corre axe. La petición no llega a la API: no gasta los 5 intentos por minuto del login (que necesita el `fetch` de la sesión del panel) ni deja un intento fallido en los logs.
- **Diálogo del panel con errores (con credenciales):** entrada `admin-experiencias-error` sobre `/admin/experiencias`: botón «Nueva experiencia», «Guardar» con el formulario vacío, espera de al menos un `role="alert"` dentro del diálogo y axe. La validación es del cliente: no sale ningún `POST` (el script lo comprueba contando las peticiones `POST` a `/api/admin/` de esa página: 0).
- Las dos entradas corren en móvil y escritorio. Si no aparece el mensaje esperado en 5 s, la entrada cuenta como problema (sale con 1): una auditoría que no vio el error no prueba nada.
- La función `audit` recibe un paso opcional `prepare(page)` que corre después de `settle` y antes de `runAxe`; las entradas existentes no lo usan.

Alternativas descartadas:
- **Un login real con contraseña incorrecta.** Gasta el límite (5/min por IP) que comparte con el login del propio script y escribe un intento fallido; en el CI con dos piernas seguidas puede dar 429.
- **`/admin/cuenta` con 11 caracteres.** Tipear en un campo de contraseña dentro de un script automatizado, aunque sea un valor ficticio, se evita por la misma regla que prohíbe escribir credenciales en un navegador; el diálogo de experiencias prueba lo mismo (`text-danger-ink` sobre un diálogo `card`).

### D5 — `dateModified` = `CuratedProfile.updatedAt`, sin el contenido base

La fecha es la de la última edición **del perfil curado**.

Alternativa descartada: **el máximo entre ese valor y el `updatedAt` del contenido que muestra** (`Profile`, experiencias, tema). Sería parcial: `Skill`, `Education`, `Certification`, `Project` y `SocialLink` no tienen `updatedAt` y una baja no deja rastro, así que el «máximo» seguiría ignorando la mitad de las ediciones y daría una precisión que no tiene; completarlo exige una migración en seis tablas. Además divergiría del `<lastmod>` del sitemap (que el owner ya fijó en el `updatedAt` del perfil curado, requisito *El `lastmod` del sitemap refleja ediciones, no visitas*) y haría que un perfil editado hace meses «cambie» por tocar una experiencia que ni muestra. El valor del perfil curado está en memoria y es coherente con el sitemap.

### D6 — Formato: día UTC (`AAAA-MM-DD`), como el `<lastmod>`

- `dateModified` es `updatedAt.slice(0, 10)` sobre el ISO UTC: `2026-01-15`. Es un `Date` válido de schema.org (ISO 8601) y el mismo día que el `<lastmod>` de esa URL.
- El backend extrae el día con una sola función, `isoDay(date: Date): string`, exportada desde `sitemap.builder.ts` (que ya exporta `profilePath` para el head) y usada por el sitemap y por el renderer. El cliente recibe el ISO como string y usa `updatedAt.slice(0, 10)`; **nunca** `new Date(...)` con métodos locales (`getDate`, `toLocaleDateString`): en un navegador con zona negativa un ISO de las 23:30 UTC caería en otro día y el bloque del cliente diferiría del head.

Alternativa descartada: **el ISO completo con hora y zona.** Google acepta `DateTime`, pero diferiría del `<lastmod>` y publicaría la hora exacta de cada edición sin ganar nada para un perfil profesional.

### D7 — `updatedAt` llega al cliente por el contrato público

- `CuratedProfileOutput` suma `updatedAt: string | null` (ISO 8601 UTC con `Z`, el mismo formato que el DTO de admin). El mapper (`toCuratedProfileOutput`) lo toma de `resolution.curated.updatedAt?.toISOString() ?? null`: **sin consultas nuevas**. `null` solo en el preview de un perfil en borrador, que no tiene fila.
- `CuratedProfileResponse` (docs de Swagger) suma `@ApiProperty({ nullable: true, type: String, format: 'date-time' })`; `PreviewCuratedProfileResponse` lo hereda. Se regeneran `backend/openapi.json` y `frontend/src/shared/types/api.d.ts`, y el test de deriva queda verde con los dos versionados.
- El head lo recibe por la misma composición que ya arma su fragmento (`GetProfileHeadUseCase` → `composer.compose`).
- La fecha de edición de un perfil no es un dato sensible (a diferencia de la última visita, D5 de `upgrade-profile-structured-data`): se publica igual que en el sitemap.

Alternativa descartada: **omitir `dateModified` en el cliente y emitirlo solo en el head.** El fixture dejaría de comparar bloques idénticos y la SPA reemplazaría el bloque del head por uno sin fecha al hidratar (el escritor del cliente es idempotente y pisa el `<script>`), así que un validador que ejecuta JavaScript vería el bloque sin fecha. Además contradice la resolución del owner.

### D8 — Posición, omisión y escape

- Orden: `@context`, `@type`, `url`, `name`, `description`, `inLanguage`, **`dateModified`**, `mainEntity`. Es un dato de la página (no del `Person`) y va junto a los otros de la página.
- Con `updatedAt` nulo la clave se omite (nunca `null` ni `""`), con el mismo `...(cond ? { … } : {})` que las listas opcionales.
- El valor pasa por el mismo escape del bloque (`<`, `>`, `&`, U+2028, U+2029); por formato no los contiene, pero no se abre una ruta sin escape.
- La caché de un minuto del head no cambia: un `dateModified` recién editado puede tardar hasta un minuto en verse en el fragmento, como los textos.

### D9 — Fixture y tests de paridad

- `docs/fixtures/profile-head-consistency.json`: cada caso suma `profile.updatedAt`. `tech-lead-dotnet` lleva `2026-01-15T12:00:00.000Z` → `dateModified: "2026-01-15"`; `all` lleva `2026-03-01T23:30:00.000Z` → `"2026-03-01"` (prueba el día UTC); `sin-secciones` lleva `null` → sin `dateModified`; los demás, una fecha cualquiera. `protegido` no tiene bloque y no cambia su `expected`.
- Los dos specs de consistencia (`profile-head.consistency.spec.ts` y `document-meta.consistency.spec.ts`) no cambian de lógica: comparan `JSON.stringify` del bloque con el `expected`, así que cubren orden y omisión.
- Vitest corre el spec del cliente también con `TZ=America/La_Paz` (UTC−4) en una tarea de verificación: el caso de las 23:30 UTC tiene que dar `2026-03-01`.
- e2e nuevo `backend/test/profile-date-modified.e2e-spec.ts` sobre `tech-lead-dotnet`, en una app propia (caché del head vacía): fija `updatedAt` en `2026-01-15T12:00:00.000Z` con Prisma, pide el fragmento y la API pública y comprueba `dateModified: "2026-01-15"` en el bloque parseado, `updatedAt: "2026-01-15T12:00:00.000Z"` en el JSON de `GET /api/curated-profiles/tech-lead-dotnet` y `<lastmod>2026-01-15</lastmod>` en el sitemap (los tres coinciden); el `afterAll` restituye `updatedAt`, `views` y las visitas creadas, como `views-updated-at.e2e-spec.ts`.

### D10 — Manual: TC-44 cambia, sin TC-46

- TC-44, resultado 1: «No hay `dateModified`» pasa a «`dateModified` es el día de la última edición del perfil (`AAAA-MM-DD`), el mismo que su `<lastmod>` en `/sitemap.xml`». Resultado 6: la advertencia esperable queda solo para `image`. Se espeja en `docs/manual/index.html` y `manual:check` sigue verde.
- El contraste de los errores no suma caso: no hay un flujo nuevo, y la verificación es automática (`a11y:check` de D4, test de D1 y regla de D3).

## Risks / Trade-offs

- **La superficie `glass` del panel.** Algún mensaje puede caer sobre un fondo semitransparente (`glass`: `--t-bg` al 80 %) encima del degradado `bg-glow` (acento al 7 %); el derivado se calcula sobre los tres fondos, como `--t-text-dim`. Mitigación: `a11y:check` mide los colores reales pintados; si axe marca un caso, el implementador suma esa superficie a `accentInk` y lo informa como desvío.
- **El rojo se aclara en temas oscuros** (`#e45656`): sigue leyéndose como error, con el mismo tono. Es el mismo criterio aceptado para el acento y el verde.
- **Interceptación en `a11y:check`.** Si cambia la ruta del login, la entrada no ve el error y falla (D4 lo convierte en problema): falla visible, no silenciosa.
- **Cambio de contrato.** `updatedAt` es aditivo y nullable; los fixtures de tests del frontend que construyen un `CuratedProfile` necesitan la clave (el tipo generado la vuelve obligatoria). Es trabajo mecánico de la tarea 6.3.
- **Bases locales con `updatedAt` inflado por visitas anteriores** a `polish-views-updated-at-and-builder` (su D3): el `dateModified` muestra esa fecha hasta la próxima edición. El sitio no está desplegado.

## Migration Plan

Sin migración de schema ni de datos. El contrato suma un campo nullable (compatible). Despliegue normal. Rollback: revertir el commit; el bloque vuelve a no tener `dateModified` y los mensajes vuelven a `text-destructive`.

## Open Questions

Ninguna bloqueante. Las dos elecciones con alternativa razonable quedan decididas con su motivo: D5 (solo el perfil curado, coherente con el sitemap) y D6 (día UTC y no fecha y hora).
