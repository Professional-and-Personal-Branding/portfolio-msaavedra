# Design — unify-section-catalog

## Context

Ver `proposal.md`. Estado verificado el 4 de octubre de 2026:

- `backend/src/modules/curated-profile/domain/services/resolve-sections.ts:2` → `DEFAULT_SECTIONS: readonly string[]` con 7 ids. `resolveSections(sectionsOrder, sectionsHidden)` usa `sectionsOrder` si tiene elementos y `DEFAULT_SECTIONS` si está vacío; devuelve `{ sections, hiddenSections }`.
- `frontend/src/themes/layouts/sections.ts` → `KNOWN_SECTIONS` con 9 ids `as const`, el tipo `SectionId`, `isKnownSection()` y `hasData(section, data)` con un `switch` por sección. El frontend ordena con `orderSections` y completa con las conocidas que tengan datos.
- El DTO (`CreateCuratedProfileDto`, `UpdateCuratedProfileDto`, `PreviewCuratedProfileDto`) valida `sectionsOrder` y `sectionsHidden` solo como arrays de string.
- `openspec/specs/layout-engine/spec.md` ya describe el relleno como comportamiento del frontend; esa parte se reescribe.

## Goals / Non-Goals

**Goals:** un catálogo con dueño; el array `sections` de la API es el orden final; un id inválido falla al escribirse, no al renderizarse; un test impide la deriva.
**Non-Goals:** secciones nuevas, cambiar layouts, cambiar la semántica de ocultado, migración.

## Decisions

### D1 — El catálogo vive en el dominio del backend, no en un paquete compartido

`SECTION_IDS` como `readonly string[]` en `curated-profile/domain/services/resolve-sections.ts`, con los 9 ids en orden canónico, y `DEFAULT_SECTIONS` pasa a ser un alias de ese mismo array. Alternativa descartada: un paquete compartido entre backend y frontend. Hoy son dos carpetas independientes y la decisión vigente de `CLAUDE.md` es que el contrato único se transporta por el OpenAPI (`openapi-typescript`), no por código compartido; introducir un paquete abriría la discusión de monorepo, que está explícitamente diferida.

### D2 — El relleno se muda al backend, y es lo único semántico que cambia

Hoy el frontend decide qué secciones conocidas con datos agregar al final. Pasa al composer, que es el único que conoce a la vez el orden guardado y qué colecciones quedaron no vacías después del filtrado. Queda una sola implementación de `hasData`, en el backend, sobre el DTO de salida que el propio composer acaba de construir.

Consecuencia deseada: `sections` es el orden final. El frontend recorre `sections` y renderiza; `hasData` desaparece del cliente.

Consecuencia a vigilar: para los perfiles del seed, cuyo `sectionsOrder` hoy tiene 7 ids, el resultado visible **no cambia** (antes el frontend agregaba `projects`/`presence` al final; ahora los agrega el backend en el mismo lugar). El cambio sí es observable para un cliente de API, que antes recibía 7 y ahora recibe hasta 9. Eso se declara en la spec como corrección, no como ruptura.

### D3 — El enum viaja por el OpenAPI y el frontend deriva su tipo

El DTO declara `sectionsOrder` y `sectionsHidden` con `@ApiProperty({ enum: SECTION_IDS, isArray: true })`, de modo que `openapi-typescript` genera una unión de literales. `frontend/src/themes/layouts/sections.ts` pasa a:

```ts
import type { components } from '@/shared/types/api';
export type SectionId = NonNullable<components['schemas']['CreateCuratedProfileDto']['sectionsOrder']>[number];
```

y el registro de layouts (`LAYOUTS`) se tipa con `Record<SectionId, ComponentType<...>>`, así que **si el backend agrega una sección y el frontend no la implementa, no compila**. Eso es el test de contrato más barato posible: el compilador.

### D4 — La validación rechaza, no normaliza

Un id desconocido en `sectionsOrder` o `sectionsHidden` devuelve 400 nombrando el id. Alternativa descartada: descartar los ids desconocidos en silencio. El panel enviaría datos que no se guardan y el usuario no se enteraría; es el mismo problema que hoy, con otra forma.

Para el preview (`PreviewCuratedProfileDto`) rige la misma validación: el constructor no debe poder previsualizar algo que no se puede guardar.

### D5 — Orden canónico de los 9

`hero`, `stats`, `experience`, `skills`, `projects`, `education`, `certifications`, `presence`, `contact`. Es el orden que ya declara `KNOWN_SECTIONS` en el frontend, que es el que se renderiza hoy: se adopta el que está en producción y no se inventa uno nuevo.

## Risks

| Riesgo | Mitigación |
|---|---|
| Un perfil ya guardado tiene un id inválido y su edición empieza a fallar con 400 | Antes de desplegar, consulta de lectura sobre `sectionsOrder`/`sectionsHidden` de todas las filas contra el catálogo. En el seed no hay ninguno |
| Un cliente de la API depende de que `sections` tenga 7 ids | El único cliente es el propio frontend, y se adapta en este change |
| El tipo derivado del OpenAPI se desincroniza si no se regenera | Ya existe el test de deriva de `api.d.ts`; `npm run api:types` es parte de las tareas |

## Migration Plan

Ninguna migración de datos. Orden de trabajo: catálogo y relleno en el backend → validación en los DTO → `openapi:export` y `api:types` → frontend derivando el tipo → seed con los 9 ids → verificación.

## Open Questions

- ¿`stats` debería poder ocultarse sola o va siempre con `hero`? Hoy son independientes y este change no lo toca, pero el customizador podría querer tratarlas como una.
