# Tasks — unify-section-catalog

> Referencias: `proposal.md`, `design.md` (D1–D5), `specs/*/spec.md`.

## 1. Catálogo y relleno en el dominio (D1, D2, D5)

- [ ] 1.1 `resolve-sections.ts`: `SECTION_IDS` con los 9 ids en orden canónico; `DEFAULT_SECTIONS` alias de ese array; `isSectionId()`. Verificar: spec de tabla con id válido, inválido y vacío.
- [ ] 1.2 Función pura de relleno: recibe el orden resuelto y el conjunto de secciones con datos, y agrega al final las conocidas con datos que falten, sin duplicar ni reordenar lo existente. Verificar: spec con orden parcial, orden completo, orden con id repetido y orden vacío.
- [ ] 1.3 `CuratedProfileComposer`: aplica el relleno después de `resolveSections`, calculando qué colecciones quedaron no vacías tras el filtrado. Verificar: spec del composer con un perfil cuyo `sectionsOrder` omite `projects` teniendo proyectos, y otro sin proyectos.

## 2. Validación de entrada (D4)

- [ ] 2.1 Decorador de validación de ids de sección reutilizable; aplicarlo a `sectionsOrder` y `sectionsHidden` en `CreateCuratedProfileDto`, `UpdateCuratedProfileDto` y `PreviewCuratedProfileDto`, con `@ApiProperty({ enum: SECTION_IDS, isArray: true })`. Verificar: e2e `POST /api/admin/curated-profiles` con `sectionsOrder: ["heroe"]` → 400 y el mensaje nombra `heroe`.
- [ ] 2.2 Mismo caso en `PATCH` y en `POST .../preview`. Verificar: e2e de los dos.

## 3. Contrato (D3)

- [ ] 3.1 `npm run openapi:export`; confirmar que el enum de secciones aparece en `backend/openapi.json`. Verificar: el test de deriva del frontend falla antes de regenerar y pasa después.
- [ ] 3.2 `npm run api:types` en el frontend; `sections.ts` deriva `SectionId` del contrato y se borra `KNOWN_SECTIONS` literal. Verificar: `npm run typecheck`.
- [ ] 3.3 `LAYOUTS` y el registro de secciones tipados con `Record<SectionId, …>`. Verificar: quitar a mano una sección del registro no compila (comprobación manual, se revierte).

## 4. Frontend: renderizar lo que viene (D2)

- [ ] 4.1 Los layouts recorren `sections` tal cual; se elimina `hasData` y la lógica de relleno del cliente. Verificar: `layouts.test.tsx` actualizado; test que falla si el cliente reordena o agrega secciones.
- [ ] 4.2 El constructor del backoffice ofrece los 9 ids en el bloque Secciones. Verificar: `ProfileBuilderPage.test.tsx` cuenta 9 filas.

## 5. Datos y verificación

- [ ] 5.1 `docs/cv-data.json`: `sectionsOrder` de las 13 plantillas con los 9 ids en el orden deseado por perfil. Verificar: `npm run seed && npm run seed:verify`.
- [ ] 5.2 Consulta de lectura previa al despliegue: ninguna fila de `CuratedProfile` tiene ids fuera del catálogo. Verificar: salida vacía.
- [ ] 5.3 Suite completa: `npm run test:all` en backend y `npm run test` en frontend. Verificar: 254+ unitarios, 109+ e2e y 128+ del frontend en verde.
- [ ] 5.4 Comprobación en navegador: `/` y `/tech-lead-dotnet` renderizan las mismas secciones que antes del change, con `projects` y `presence` en su lugar. Verificar: capturas en `verification/`.
