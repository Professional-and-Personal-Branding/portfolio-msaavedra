# add-curated-profile-lifecycle — Duplicar, archivar, no enumerar y no romper links

> Tercer change de la ronda 1.1 (`docs/ROADMAP-1.1.md` § 4). **Fusiona cuatro candidatas de la deliberación** —`duplicar-perfil-curado` (1º), `perfil-dirigido-sin-vitrina` (4º), `ciclo-de-vida-perfil-curado` (6º) y `link-aislado` (9º)— porque las cuatro tocan el mismo estado de la misma entidad. Los dos críticos pidieron explícitamente que no entraran por separado: *"resolver de una vez la tabla de verdad de resolución de ruta antes de agregar cualquier booleano"*.

## Why

Cuatro problemas que hoy no tienen solución y comparten causa: `CuratedProfile` solo distingue tres visibilidades y nada más.

1. **Cada vacante arranca de cero.** El constructor siempre parte vacío. Hay perfiles que ya quedaron bien para un stack parecido y no hay forma de partir de ellos: tags, inclusiones, orden de secciones, layout y tema se reconfiguran a mano. La entidad ya tiene `with()`, así que el dominio está listo y falta el caso de uso.
2. **La única forma de retirar un perfil es borrarlo, y eso borra sus visitas.** `delete` cascadea `ProfileView` (está en el comentario del adaptador Prisma). Retirar un perfil cuesta perder su analítica, así que en la práctica no se retira nada.
3. **El link enviado delata la curaduría.** `TopBar.tsx:30` monta el menú de perfiles **siempre**, también en `/:slug`: quien abre el perfil hecho para su vacante ve los otros doce hechos para otras. Y aunque no viera el menú, `GET /api/curated-profiles` y el `sitemap.xml` publican la lista completa.
4. **Renombrar un slug rompe en silencio los links ya enviados.** No hay registro del slug anterior: el correo que se mandó la semana pasada empieza a devolver 404 y nadie se entera.

## What Changes

- **Duplicar**: `POST /api/admin/curated-profiles/{id}/duplicate` crea una copia con slug derivado, copiando toda la configuración y **sin** copiar `accessToken`, `views` ni visitas. El duplicado nace `PRIVATE` y no enumerado, para que un perfil a medio configurar nunca quede accesible. En el panel, acción *Duplicar* en la lista.
- **Archivar**: campo `archivedAt`. Un perfil archivado **no resuelve** (404), no se enumera, no entra en el sitemap y **conserva sus visitas**, que siguen contando en el dashboard. Se archiva y desarchiva con endpoints propios, no escribiendo la fecha a mano.
- **Enumerar o no**: campo `listed`. Un perfil no enumerado sigue siendo accesible por su slug pero desaparece de `GET /api/curated-profiles`, del menú público y del sitemap. Es lo que convierte un link en un envío dirigido sin cambiar su visibilidad.
- **El menú solo en la home**: `/:slug` deja de montar el menú de perfiles. Un perfil enviado no ofrece navegación a los otros.
- **Alias de slug**: al renombrar, el slug anterior queda registrado y sigue resolviendo al perfil, informando su slug canónico para que la URL se corrija en el navegador y el `canonical` apunte a uno solo.
- **Una sola tabla de verdad**: la resolución de ruta se decide en **una** función de dominio sobre `(visibility, archivedAt)`, con `archivedAt` ganando siempre. Los seis casos quedan cubiertos por tests.

### Non-goals

- **Historial de cambios o versiones** de un perfil. Archivar no es versionar.
- **Borrado suave general**: `delete` sigue existiendo y sigue cascadeando. Archivar es la alternativa recomendada, no un reemplazo forzado.
- **Caducidad automática de links** (un perfil que se archiva solo a los 30 días). Tentador y fácil de agregar sobre `archivedAt`, pero agrega un trabajo programado y una decisión de producto que nadie pidió.
- **Cambiar el valor inicial de `listed` para los 13 perfiles del seed.** Se preserva el comportamiento actual (todos enumerados) y la decisión de ocultarlos queda en manos de Manuel, perfil por perfil. Ver decisión D6.
- **Redirección 301 en el borde** para los alias. Se resuelve en la capa de datos y en el cliente; ver D5.

## Capabilities

### Modified Capabilities
- `admin-curated-profile-crud`: duplicar, archivar, desarchivar y `listed`.
- `curated-profile-resolution`: la tabla de verdad `(visibility, archivedAt)` y la resolución por alias.
- `public-curated-profile-api`: el listado público pasa a devolver solo los enumerados, públicos y no archivados.
- `public-seo`: el sitemap usa el mismo criterio que el listado.
- `curated-profile-builder`: acción de duplicar, controles de archivado y de enumeración en la pestaña Publicación.
- `profile-view-analytics`: un perfil archivado conserva sus visitas y sigue apareciendo en el dashboard, marcado como archivado.
- `public-portfolio-frontend`: el menú de perfiles solo se monta en la home.

## Impact

- **Migración de Prisma** (la primera desde la `init`): `CuratedProfile.archivedAt DateTime?`, `CuratedProfile.listed Boolean @default(true)` y la tabla `CuratedProfileSlugAlias`. Aditiva y reversible.
- **Backend**: entidad y puerto de `curated-profile`, tres casos de uso nuevos, el resolver, el `SitemapBuilder`, el DTO y el controller de administración.
- **Frontend**: `ProfilesPage` (duplicar, badges de estado), la pestaña Publicación del constructor, `TopBar`.
- **Datos**: `docs/cv-data.json` suma `listed` explícito en las plantillas para que el seed no dependa del default.
- **Riesgo**: un booleano mal interpretado deja un perfil accesible cuando se creía retirado, o inaccesible cuando se creía publicado. Se mitiga con la tabla de verdad como test exhaustivo y con que los dos campos nuevos tengan efectos **disjuntos**: `archivedAt` decide el acceso, `listed` decide la enumeración, y ninguno de los dos toca `visibility`.
