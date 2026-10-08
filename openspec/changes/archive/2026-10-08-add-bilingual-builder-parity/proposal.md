# add-bilingual-builder-parity — Ver y editar el perfil en inglés antes de mandarlo

> Quinto change de la ronda 1.1 (`docs/ROADMAP-1.1.md` § 4). **Reducido a lo verificable**: la propuesta original salió segunda en la evaluación y primera para dos de los tres votantes, pero su justificación principal resultó ser un hecho falso. Este change conserva lo que sí existe y descarta lo que no.

## Why

La mitad de las vacantes son en inglés y el perfil se manda por link sin poder revisar cómo queda en ese idioma.

**Lo que sí es cierto, verificado en el código:**

1. **El preview del constructor siempre está en español.** `use-preview.ts` fija `locale: Locale = 'es'` por defecto y `PreviewPanel.tsx` no tiene conmutador. El backend ya acepta el idioma (`POST /api/admin/curated-profiles/preview` resuelve con el locale negociado) y el hook ya recibe el parámetro: falta exponerlo.
2. **Los logros en inglés no se pueden editar.** `ExperienceForm.tsx:182` expone un único campo, `label="Logros (es)"`, atado a `values.highlights.es`. `highlights.en` llega del seed y no hay forma de tocarlo desde el panel.
3. **Nada avisa de lo que falta en inglés.** Un perfil puede estar completo en español y caer al fallback en media docena de campos sin que nadie lo note hasta que el reclutador abre el link.

**Lo que se afirmó y es falso** —y por eso no entra en este change—: que el formulario *pierde* `highlights.en` al guardar. No lo pierde: `experience-form.ts:56` lo lee en `toFormValues` y `:75` lo reenvía con `toLocalizedListPayload`. El dato sobrevive; lo que falta es poder editarlo. Esa diferencia baja el riesgo (no hay pérdida de datos que reparar) y el alcance (es agregar un campo, no arreglar un guardado).

## What Changes

- **Conmutador ES/EN en el preview del constructor**: el panel pasa el idioma elegido a `usePreview`, que ya lo acepta, y la caché de TanStack Query se indexa por perfil **y** por idioma para que cambiar de idioma no descarte el preview anterior.
- **Paridad de campos en el formulario de experiencias**: `highlights` gana su campo en inglés junto al de español, con el mismo componente de chips, igual que ya ocurre con `role` y `summary`.
- **Informe de faltantes en inglés**: un servicio **puro** recorre las entidades bilingües que entran en el perfil resuelto y devuelve qué campos cayeron al fallback español. Se expone en la respuesta del preview y se muestra como aviso en la pestaña Publicación, junto al link que se va a copiar.

### Non-goals

- **Arreglar el guardado de `highlights.en`**, porque no está roto. Se agrega un test de regresión que lo deja blindado, y nada más.
- **Traducción automática.** El informe dice qué falta; escribirlo es de Manuel.
- **Bloquear la publicación** de un perfil con faltantes en inglés. Es un aviso, no una validación: hay perfiles que solo se mandan en español y está bien.
- **Un tercer idioma.** El diseño de i18n ya lo soporta (`docs/I18N.md`), pero nadie lo pidió y agregarlo ahora sería trabajo sin destinatario.
- **El idioma del panel.** El backoffice sigue en español; esto es sobre el **contenido**, no sobre la interfaz.
- Migración de Prisma: ninguna.

## Capabilities

### Modified Capabilities
- `admin-curated-profile-preview`: el preview se resuelve en el idioma elegido y reporta los faltantes.
- `admin-experience-crud`: paridad bilingüe en los logros.
- `curated-profile-builder`: el conmutador y el aviso en la pestaña Publicación.

## Impact

- **Backend**: un servicio puro de detección de faltantes en `curated-profile/application/services/` y su salida en el DTO del preview. No toca la ruta pública.
- **Frontend**: `use-preview.ts` (clave de caché por idioma), `PreviewPanel.tsx` (conmutador), `ExperienceForm.tsx` (campo EN), y la pestaña Publicación (aviso).
- **Riesgo**: bajo. El cambio de clave de caché es lo único que puede sorprender: mal hecho, cambiar de idioma descartaría el preview y provocaría un parpadeo en cada clic. Hay un escenario explícito para eso.
- **Señal de éxito medible**: el informe de faltantes sobre los 13 perfiles del seed se puede llevar a cero, y un test lo recalcula para que no vuelva a subir.
