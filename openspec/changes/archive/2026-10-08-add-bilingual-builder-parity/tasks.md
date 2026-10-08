# Tasks — add-bilingual-builder-parity

> Referencias: `proposal.md`, `design.md` (D1–D6), `specs/*/spec.md`.
> Las tres partes son independientes y desplegables por separado.

## 1. Paridad de logros en el formulario (D6)

- [x] 1.1 `ExperienceForm.tsx`: segundo `ChipListField` "Logros (en)" sobre `values.highlights.en`, junto al de español. Verificar: test que escribe en los dos y comprueba el payload.
- [x] 1.2 Test de regresión del guardado: abrir una experiencia con `highlights.en` poblado, editar solo el español, guardar, y comprobar que el inglés sobrevive. Verificar: el test falla si se rompe `toFormValues` o `toLocalizedListPayload`.

## 2. Conmutador de idioma en el preview (D1, D2)

- [x] 2.1 `use-preview.ts`: el locale entra en la clave de la query como **segmento propio**, no mezclado con el borrador. Verificar: spec que comprueba la forma de la clave.
- [x] 2.2 `PreviewPanel.tsx`: conmutador ES/EN, con el idioma en el estado del editor y no en el borrador. Verificar: test que conmuta y comprueba que el `PATCH` no lleva el idioma.
- [x] 2.3 Test de caché: conmutar a EN y volver a ES no emite una segunda petición, con MSW contando llamadas. Verificar: el contador queda en dos, una por idioma.
- [x] 2.4 Editar un filtro con el preview en EN lo recalcula en EN. Verificar: test.

## 3. Informe de faltantes (D3, D4)

- [x] 3.1 Application: `detectMissingTranslations(output, locale)` puro, sin Prisma ni Nest. Verificar: spec de tabla con campo vacío, lista vacía, valor idéntico al otro idioma (no cuenta) y entidad completa.
- [x] 3.2 El informe entra en el DTO de salida del **preview** y no en el de la ruta pública. Verificar: e2e que comprueba que `GET /api/curated-profiles/{slug}` no lo trae y que `POST .../preview` sí.
- [x] 3.3 `openapi:export` y `api:types`. Verificar: test de deriva en verde.

## 4. Aviso en la pestaña Publicación (D5)

- [x] 4.1 Bloque de aviso junto al link, agrupado por entidad, con el caso "no falta nada" explícito. Verificar: test de los tres escenarios de la spec.
- [x] 4.2 Comprobar que no bloquea guardar ni publicar. Verificar: test que publica un perfil con faltantes.

## 5. Contenido y verificación

- [x] 5.1 Completar el inglés que falte en `docs/cv-data.json` hasta que el informe dé cero en los 13 perfiles. Verificar: test que recalcula el informe sobre el seed y exige cero.
- [x] 5.2 `docs/MANUAL.md`: el caso de previsualizar suma el conmutador de idioma y el aviso de faltantes.
- [x] 5.3 Suite completa: `npm run test:all` en backend y `npm run test` en frontend. Verificar: en verde.
- [x] 5.4 Verificación en la app real: abrir un perfil en el constructor, conmutar a EN, corregir un faltante desde Experiencias y ver el aviso bajar. Verificar: capturas en `verification/`.
