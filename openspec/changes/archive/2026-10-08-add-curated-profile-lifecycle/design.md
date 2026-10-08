# Design — add-curated-profile-lifecycle

## Context

Ver `proposal.md`. Estado verificado el 4 de octubre de 2026:

- `CuratedProfileRepository` expone `findBySlug`, `findAllPublic`, `findAll`, `findById`, `create`, `update`, `delete`.
- La entidad `CuratedProfile` ya tiene `create()`, **`with(changes)`** y `toProps()`, más getters de solo lectura. No tiene lógica de estado más allá de `visibility`.
- `delete` cascadea `ProfileView` (comentario explícito en `prisma-curated-profile.repository.ts`).
- `ResolveCuratedProfileUseCase` decide hoy: `PRIVATE` → 404, `PROTECTED` sin token → 401, resto → 200. Esa decisión está inline en el caso de uso.
- `frontend/src/features/.../TopBar.tsx:30` monta `ProfileMenu` sin condicionar por ruta.
- `SitemapBuilder.toSitemapEntries` filtra por `PUBLIC`.
- Solo existe la migración `init`: esta es la primera migración incremental del proyecto.

## Goals / Non-Goals

**Goals:** un perfil nuevo publicable copiando otro; retirar sin perder analítica; un link enviado que no enumera a los demás; un slug renombrado que no rompe links; una sola función que decida el acceso.
**Non-Goals:** versionado, caducidad automática, borrado suave general, redirección en el borde, cambiar lo que hoy se indexa.

## Decisions

### D1 — `archivedAt` decide el acceso; `listed` decide la enumeración; `visibility` no cambia de significado

Tres ejes **disjuntos**, y eso es lo que hace la tabla manejable. Alternativa descartada: agregar `ARCHIVED` al enum `CuratedVisibility`. Sería un cuarto valor que se confundiría con los otros tres (¿un archivado era público o privado?), rompería la semántica ya especificada de los tres y obligaría a migrar datos en lugar de agregar columnas.

### D2 — Una función de dominio, `resolvability`, con la tabla de verdad completa

En `curated-profile/domain/services/`, pura, junto a `select-by-tags`:

```
resolvability(visibility, archivedAt, tokenProvided) → 'ok' | 'unauthorized' | 'not-found'
```

| `visibility` | `archivedAt` | sin token | con token válido |
|---|---|---|---|
| `PUBLIC` | null | `ok` | `ok` |
| `PUBLIC` | fecha | **`not-found`** | **`not-found`** |
| `PROTECTED` | null | `unauthorized` | `ok` |
| `PROTECTED` | fecha | **`not-found`** | **`not-found`** |
| `PRIVATE` | null | `not-found` | `not-found` |
| `PRIVATE` | fecha | `not-found` | `not-found` |

**`archivedAt` gana siempre y devuelve `not-found`, nunca `unauthorized`.** Un 401 en un perfil archivado confirmaría que el slug existió; un 404 no dice nada, que es la misma razón por la que `PRIVATE` ya responde 404. `ResolveCuratedProfileUseCase` deja de decidir inline y delega. El `PreviewCuratedProfileUseCase` no la usa: un borrador siempre se previsualiza.

Las seis filas × dos columnas son doce casos y los doce van al spec como tabla.

### D3 — Duplicar: la entidad ya sabe hacerlo, el caso de uso decide qué no copiar

`DuplicateCuratedProfileUseCase` lee el original, arma la copia con `with()` y la crea. **No copia**: `accessToken` (null), `views` (0), visitas (ninguna), `archivedAt` (null). **Fuerza**: `visibility = PRIVATE` y `listed = false`.

Que el duplicado nazca `PRIVATE` no es prudencia decorativa: es lo que evita que una copia a medio configurar, con los textos del perfil anterior, quede accesible por un slug adivinable.

**Slug derivado:** `<slug>-2`, y si existe `-3`, y así. El caso de uso consulta y reintenta; si llega a `-50` devuelve un error de dominio en lugar de iterar. Alternativa descartada: pedir el slug en el cuerpo. Duplicar tiene que ser un clic; renombrar ya se puede hacer después, y ahora sin romper links (D5).

### D4 — Archivar y desarchivar son endpoints propios, no un campo del `PATCH`

`POST /api/admin/curated-profiles/{id}/archive` y `.../unarchive`. `archivedAt` MUST NOT ser escribible desde el cuerpo del `PATCH`: una fecha arbitraria, o futura, no significa nada y el dominio tendría que defenderse de ella. El endpoint pone la fecha del servidor; desarchivar la borra. Archivar dos veces es idempotente y conserva la primera fecha.

`listed`, en cambio, **sí** es un booleano normal del `PATCH`: no tiene estado temporal ni invariante que proteger.

### D5 — Alias de slug: se resuelve en datos y se corrige en el cliente

Tabla `CuratedProfileSlugAlias { id, slug @unique, curatedProfileId, createdAt }`, con `onDelete: Cascade`. Al actualizar un perfil con un `slug` distinto, el anterior se registra como alias **en la misma transacción**.

`findBySlug` busca primero en `CuratedProfile` y, si no hay, en los alias. Cuando resuelve por alias, la respuesta lleva el **slug canónico** en su cuerpo y la cabecera `Content-Location` con la ruta canónica. El frontend, al detectar que el slug resuelto difiere del de la URL, reemplaza la URL con `replace: true`.

Alternativa descartada: una redirección 301 en Caddy. Obligaría al borde a conocer los alias (otra consulta en el camino del HTML, justo lo que el change del head ya acota) y a mantener reglas de redirección sincronizadas con la base. El `canonical` del head ya apunta al slug canónico, que es lo que importa para SEO.

**Invariantes:** un alias MUST NOT colisionar con el slug de otro perfil ni con otro alias; crear un perfil con un slug que es alias de otro responde 409. Si un slug vuelve a usarse para el mismo perfil, su alias se elimina.

### D6 — El valor inicial de `listed` preserva lo que hoy se indexa

Los 13 perfiles del seed nacen `listed = true`, igual que el default de la columna. **No** se marcan como dirigidos en este change.

Razón: hoy esos 13 están en el sitemap y pueden estar indexados. Ponerlos en `false` los retiraría de los buscadores como efecto colateral de un change cuyo objetivo es *poder* hacerlo, no hacerlo. Es una decisión de distribución —cuánta superficie de búsqueda se cambia por cuánta credibilidad al compartir— y es de Manuel, perfil por perfil, desde el panel. El change entrega el interruptor y lo documenta en `docs/MANUAL.md`.

### D7 — El menú solo en la home

`TopBar` recibe si debe mostrar el menú; `/` sí, `/:slug` no. Es un cambio de dos líneas y resuelve la mitad del problema 3 **sin** depender de `listed`: incluso un perfil enumerado deja de ofrecer navegación a los demás cuando se abre por su slug.

### D8 — El dashboard sigue mostrando los archivados

`AggregateProfileViews` no filtra por estado: un perfil archivado conserva sus visitas y sigue en la tabla por perfil, con una marca de archivado. Lo contrario convertiría archivar en una pérdida de información, que es justo el problema que resuelve.

## Risks

| Riesgo | Mitigación |
|---|---|
| Un perfil queda accesible cuando se creía retirado | La tabla de D2 como test exhaustivo de doce casos; `archivedAt` gana siempre |
| `listed` y `visibility` se confunden al usarlos | Efectos disjuntos por diseño, y la pestaña Publicación explica cada uno en una línea |
| La primera migración incremental del proyecto sale mal | Aditiva (dos columnas con default y una tabla nueva), sin `NOT NULL` sin default; se prueba con `prisma migrate deploy` sobre una copia restaurada del backup antes de producción |
| El alias deja dos URLs vivas y se indexan las dos | El `canonical` apunta al slug canónico y solo el canónico entra en el sitemap |
| Duplicar deja perfiles basura acumulados | Nacen `PRIVATE` y no enumerados, así que no se ven; la lista del panel los marca y se pueden borrar |

## Migration Plan

1. `prisma migrate dev --name curated_profile_lifecycle`: dos columnas y una tabla, todo aditivo.
2. Backfill: ninguno. `listed` toma su default `true` y `archivedAt` queda null, que es exactamente el estado actual.
3. Orden de trabajo: migración → `resolvability` y sus tests → entidad y puerto → casos de uso → controller y DTO → sitemap y listado público → frontend → seed → verificación.
4. Reversión: la migración es reversible borrando las columnas y la tabla; ningún dato existente se transforma.

## Open Questions

- ¿Un perfil archivado debería poder desarchivarse si su slug fue reutilizado por otro perfil mientras estaba archivado? Hoy el alias lo impediría por colisión. Propuesta: devolver un error de dominio que nombre el conflicto, y que Manuel renombre. Queda para confirmar en la implementación.
- ¿Conviene un `listed` implícito para los duplicados cuando se publican (pasar a `true` al pasar a `PUBLIC`)? Se decide no acoplarlos: son ejes disjuntos y acoplarlos reintroduce la confusión que D1 evita.
