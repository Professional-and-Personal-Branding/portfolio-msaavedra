# Design — add-bilingual-builder-parity

## Context

Ver `proposal.md`. Estado verificado el 4 de octubre de 2026:

- `use-preview.ts` declara `locale: Locale = 'es'` y lo usa en la clave de la query y en el cuerpo del `POST`. El parámetro **existe**; nadie lo pasa distinto de su default.
- `POST /api/admin/curated-profiles/preview` ya resuelve con el locale negociado, igual que la ruta pública, porque los dos pasan por `CuratedProfileComposer`.
- `ExperienceForm.tsx:181-188` monta un solo `ChipListField` con `label="Logros (es)"` sobre `values.highlights.es`.
- `experience-form.ts:56` → `highlights: { es: experience.highlights.es, en: experience.highlights.en ?? [] }`; `:75` → `highlights: toLocalizedListPayload(values.highlights)`. El inglés se preserva.
- `resolveLocale` / `resolveLocaleList` caen a `DEFAULT_LOCALE='es'` **en silencio**: no hay forma de distinguir "está en español porque así se escribió" de "está en español porque falta el inglés".
- `LocalizedField` ya existe y resuelve el patrón de dos pestañas ES/EN para campos de texto.

## Goals / Non-Goals

**Goals:** ver el perfil en inglés antes de mandarlo; poder escribir los logros en inglés; saber qué falta sin abrirlo campo por campo.
**Non-Goals:** traducción automática, bloquear publicación, tercer idioma, idioma del panel, arreglar un guardado que no está roto.

## Decisions

### D1 — El conmutador vive en el panel de preview, no en el borrador

El idioma del preview es estado de **vista**, no del perfil: no se persiste, no viaja en el `PATCH` y no ensucia `draft`. Vive en el estado del `ProfileEditor` junto al preview y se pasa a `usePreview(draft, locale)`.

Consecuencia deliberada: al recargar el constructor vuelve a español. Es correcto; el idioma por defecto del contenido es el español y el conmutador sirve para revisar, no para configurar.

### D2 — La clave de caché incluye el idioma, y los dos idiomas conviven

`usePreview` ya construye su clave con el borrador; se le suma el locale. Así, al conmutar, el preview del otro idioma **no se descarta**: queda en caché y volver es instantáneo, sin parpadeo ni segunda petición.

Es el punto más fácil de arruinar: si el locale se mezcla dentro de la clave del borrador en lugar de ser un segmento propio, cada conmutación invalida el preview anterior. Hay un escenario explícito que lo verifica.

### D3 — El informe de faltantes es un servicio puro y viaja con el preview

`detectMissingTranslations(output)` en `curated-profile/application/services/`, sin Prisma y sin Nest. Recibe el DTO ya compuesto y devuelve qué campos de qué entidades no tienen contenido en el idioma pedido:

```
{ entidad: 'experience', id, campo: 'highlights', idioma: 'en' }[]
```

Viaja **solo en la respuesta del preview**, nunca en la ruta pública: es información de edición, no de presentación, y la ruta pública no debe pagar su costo ni exponer qué le falta al perfil.

Alternativa descartada: un endpoint propio de auditoría. Sería una segunda petición para un dato que el preview ya tiene calculado en la mano.

### D4 — "Falta" significa vacío, no "igual al español"

Un campo cuenta como faltante cuando su valor en el idioma pedido está ausente, es cadena vacía o es una lista vacía. **No** cuenta como faltante cuando el texto en inglés es idéntico al español: hay nombres propios, siglas y títulos que legítimamente no se traducen (`Tech Lead`, `.NET`, `Novacomp`).

Si no se hiciera esta distinción, el informe marcaría como faltante media trayectoria y nadie lo miraría.

### D5 — El aviso va en la pestaña Publicación, junto al link

Es el último lugar antes de copiar el link, que es el momento en que importa. Muestra el conteo y la lista de campos, agrupada por entidad, y **no impide guardar ni publicar**. En la pestaña Selección el aviso sería ruido: ahí todavía se está decidiendo qué entra.

### D6 — Paridad de `highlights`, con el componente que ya existe

Dos `ChipListField`, "Logros (es)" y "Logros (en)", uno al lado del otro, igual que `LocalizedField` resuelve `role` y `summary`. No se introduce un componente nuevo ni se cambia la forma del payload: `toLocalizedListPayload` ya maneja los dos lados.

## Risks

| Riesgo | Mitigación |
|---|---|
| La clave de caché mal armada hace parpadear el preview en cada conmutación | D2 y un escenario que verifica que volver al idioma anterior no dispara una petición nueva |
| El informe marca como faltante lo que no se traduce y se vuelve ruido | D4: solo cuenta lo vacío, nunca la coincidencia con el español |
| El aviso se interpreta como un error y frena la publicación | Es informativo por diseño; el texto lo dice y no hay validación que bloquee |
| El servicio de faltantes se filtra a la ruta pública | Vive en el DTO del preview; un test verifica que la respuesta pública no lo trae |

## Migration Plan

Ninguna migración. Orden: campo EN en el formulario (independiente y entregable solo) → conmutador y clave de caché → servicio de faltantes y su salida en el preview → aviso en Publicación → completar el inglés de los 13 perfiles del seed.

Las tres partes son desplegables por separado.

## Open Questions

- ¿El informe debería cubrir también el perfil base y los proyectos, o solo lo que entra en el perfil curado resuelto? Propuesta: solo lo resuelto, porque es lo que el reclutador va a ver. Si el perfil base queda a medias en inglés, el informe de **cualquier** perfil lo marcará igual, porque el hero entra en todos.
