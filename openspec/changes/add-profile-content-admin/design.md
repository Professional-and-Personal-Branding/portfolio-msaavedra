# Design — add-profile-content-admin

## Context

Ver `proposal.md`. Estado verificado el 4 de octubre de 2026 sobre la base local seedeada (14 perfiles curados, 15 experiencias, 5 temas, 1 administrador):

- `Profile` se lee con `profiles.findOne()`: es un singleton de hecho, sin endpoint que reciba id.
- Los módulos `profile`, `education`, `project` y `social-link` existen **solo de lectura**: entidad, puerto `findAllVisible()`, adaptador Prisma, un caso de uso de listado y un controller público. No tienen `admin-*.controller.ts`.
- `admin-experience-crud` y `admin-skill-crud` ya establecieron la plantilla completa: DTO con `class-validator`, `adminValidationPipe` con whitelist y `forbidNonWhitelisted`, casos de uso con un único `execute()`, tests con repositorio mockeado, e2e por endpoint.
- `ProfileView` guarda `referrer` y `userAgent` desde la Fase 3 (`curated-profile.controller.ts:96-97`); `ProfileViewsResponse` expone `from`, `to`, `total`, `byProfile`, `byLocale`, `byDay`. Ningún consumidor lee los dos primeros.
- Todos los campos que este change edita **ya existen** en `schema.prisma`, incluidos los `Json` bilingües de disponibilidad y el `stats` libre de `SocialLink`.

## Goals / Non-Goals

**Goals:** que el contenido que se muestra se edite desde el panel; que `seed` deje de ser la vía de edición; que la analítica responda de dónde vino la visita con datos ya guardados.
**Non-Goals:** subida de imágenes, editor de texto rico, CRUD de temas, CRUD de `FeaturedRepository`, capturar datos nuevos, migración.

## Decisions

### D1 — El perfil base es un `PUT`, no un `PATCH`, y no recibe id

`GET /api/admin/profile` y `PUT /api/admin/profile`. Es un singleton: inventar un id en la URL sería mentir sobre la cardinalidad. `PUT` y no `PATCH` porque el formulario envía el bloque completo y un reemplazo total es más fácil de razonar que un merge parcial sobre campos `Json` anidados.

Consecuencia que hay que cuidar: un `PUT` incompleto borra lo que no manda. Por eso el DTO declara obligatorios los campos que no pueden quedar vacíos (`fullName`, `headline`, `summary`, `email`, `location`) y la whitelist rechaza lo desconocido con 400 en lugar de ignorarlo.

### D2 — Las otras cinco entidades siguen la plantilla, sin inventar nada

`Language`, `SocialLink`, `Education`, `Certification` y `Project` reciben el mismo juego que experiencias: `GET` lista cruda (incluye las no visibles), `POST`, `GET /{id}`, `PATCH` parcial y `DELETE`. Mismos nombres, mismos códigos, mismo pipe.

`Language` es la excepción de forma: cuelga de `Profile` y se administra **dentro** de la página de portada, como las skills cuelgan de su categoría. Su API sigue siendo propia (`/api/admin/languages`), para no meter un array anidado dentro del `PUT` del perfil.

### D3 — Tres páginas, agrupadas por cuándo se editan, no por tabla

- **`/admin/portada`** — lo que cambia durante la búsqueda: titular, resumen, contacto, disponibilidad e idiomas.
- **`/admin/formacion`** — educación y certificaciones. Cambia una o dos veces al año.
- **`/admin/proyectos`** — proyectos y enlaces sociales. Cambia cuando hay algo nuevo que mostrar.

Alternativa descartada: una página por entidad (seis entradas más en la navegación, que pasaría de cuatro a diez). La agrupación por frecuencia de cambio es la que corresponde al uso real.

### D4 — El preview del hero reusa el del constructor

La página de portada muestra el hero con el mismo mecanismo que el constructor: lo resuelve el backend con `POST /api/admin/curated-profiles/preview`. Así se ve el cambio antes de guardar y no aparece un segundo renderizador de hero que pueda divergir del público.

### D5 — `byReferrer` normaliza a dominio y agrupa lo vacío como "directo"

El agregado suma `byReferrer: { referrer, views }[]`. Reglas, en el dominio y con tests de tabla:

- `null`, vacío o no parseable → `"directo"`.
- Una URL → su **host**, en minúsculas y sin `www.` (`https://www.linkedin.com/feed/` → `linkedin.com`).
- El propio `FRONTEND_URL` → `"interno"`, para no contar la navegación dentro del sitio como tráfico entrante.

No se guarda nada nuevo: el `referrer` ya está en la fila. `userAgent` **no** se agrega todavía; clasificarlo pide una tabla de dispositivos que envejece mal, y nadie lo pidió.

### D6 — El seed no cambia de rol, cambia de uso

`npm run seed` sigue siendo la forma de poblar una base vacía y sigue sobrescribiendo. Lo que cambia es que deja de ser la forma de **editar**: después de este change, correrlo en una base con contenido administrado desde el panel pisa ese trabajo. La advertencia se refuerza en `docs/MANUAL.md` y en `docs/DEPLOY.md`, y `seed:verify` se mantiene como está.

## Risks

| Riesgo | Mitigación |
|---|---|
| Un `PUT` incompleto deja el hero vacío en los 14 links | Campos obligatorios en el DTO y en el dominio; escenario explícito de 400 ante payload desconocido; el preview muestra el resultado antes de guardar |
| Seis CRUD repetidos invitan a copiar y pegar con errores | Es la plantilla de `admin-experience-crud` aplicada seis veces; cada uno con su e2e. El test estático que exige `adminValidationPipe` en todo endpoint con cuerpo ya cubre el olvido más probable |
| La navegación del panel crece y se vuelve ruidosa | Tres entradas, no seis, agrupadas por frecuencia de cambio (D3) |
| `byReferrer` expone orígenes con parámetros sensibles | Se guarda solo el host, nunca la URL completa; es una reducción, no un dato nuevo |

## Migration Plan

Ninguna migración. Orden: backend por entidad (perfil primero, que es el que más se nota), `openapi:export` y `api:types`, páginas del panel, agregado por origen, documentación.

Es desplegable por partes: cada entidad es independiente y el panel puede ir sumando páginas sin romper lo anterior.

## Open Questions

- ¿La disponibilidad debería tener un estado "no disponible" explícito que oculte el badge del hero? Hoy son tres campos de texto y el badge siempre se muestra. Se deja fuera para no mezclar una decisión de producto con un change de administrabilidad.
- ¿`SocialLink.stats` merece un editor estructurado o alcanza con JSON crudo? Propuesta: JSON crudo validado, porque su forma varía por plataforma y hoy solo GitHub lo usa.
