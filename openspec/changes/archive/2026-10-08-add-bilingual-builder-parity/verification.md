# Verificación — add-bilingual-builder-parity

Ejecutada el 8 de octubre de 2026 sobre la rama `feat/bilingual-builder-parity`, con la base local `portfolio` (Postgres en el 5434).

## Automatizado (5.3)

| Comando | Resultado |
|---|---|
| backend `npm run lint`, `typecheck`, `build` | limpios |
| backend `npm run test:all` | 517 unitarios y 160 e2e en verde |
| backend `openapi:export` | idempotente sobre el `openapi.json` del change (mismo hash antes y después) |
| frontend `npm run api:types` | idempotente sobre `api.d.ts` |
| frontend `npm run lint`, `npm test`, `npm run build` | limpios; 187 tests en verde |
| `openspec validate add-bilingual-builder-parity --strict` (1.14.1) | válido |

## Por criterio

| Criterio | Evidencia |
|---|---|
| Logros editables en los dos idiomas; editar solo el español conserva el inglés | `ExperiencesPage.test.tsx` (tres tests) y captura `02` |
| El preview conmuta ES/EN sin tocar el borrador ni el `PATCH` | `ProfileBuilderPage.test.tsx` · «idioma de la vista previa» |
| Volver al idioma anterior no re-consulta | test con MSW: una petición por idioma; la clave es `['admin','preview', borrador, idioma]` |
| El informe viaja solo en el preview | e2e `backoffice.e2e-spec.ts`: el preview trae `missingTranslations`, la ruta pública no trae la clave |
| "Falta" es vacío, nunca "igual al español" | `detect-missing-translations.spec.ts` (tabla de diez casos) |
| El aviso en Publicación, informativo | cinco tests en `ProfileBuilderPage.test.tsx` y capturas `01` y `03` |
| Cero faltantes en el seed (5.1) | `seed-translations.spec.ts`: `all` y las 13 plantillas, en EN y en ES, sobre `docs/cv-data.json`. No hizo falta escribir contenido |

## App real (5.4)

1. Se vació temporalmente `highlights.en` de la experiencia de Novacomp, que entra en `tech-lead-dotnet`, después de guardar una copia de sus logros.
2. Constructor de `tech-lead-dotnet` → pestaña Publicación → preview en EN: **«Falta 1 traducción en EN»**, con «Novacomp — Senior Fullstack Developer · Fintech: Logros», y el aviso de que se puede guardar y publicar igual ([`verification/01-aviso-falta-1-en.jpg`](verification/01-aviso-falta-1-en.jpg)).
3. Experiencias → Novacomp → campo nuevo **Logros (en)** → agregar un logro → Guardar. El español quedó intacto: 4 logros ([`verification/02-logros-en-desde-experiencias.jpg`](verification/02-logros-en-desde-experiencias.jpg)).
4. De vuelta en el constructor, preview en EN: **«Sin faltantes de traducción en EN»**, y el preview en inglés ([`verification/03-aviso-sin-faltantes-en.jpg`](verification/03-aviso-sin-faltantes-en.jpg)).
5. Se restauraron los logros originales de Novacomp: idénticos a la copia, 4 en EN y 4 en ES.

También se abrió el constructor de `all`, que tiene `roleType: {}` en la base: el preview responde 200, porque el constructor normaliza el campo vacío. El 400 que aparece al reenviar el registro crudo al preview no afecta al panel.

## Desvíos respecto de los artefactos

- **D3, entrada del detector.** El DTO compuesto viene resuelto a strings y no permite distinguir "falta" de "igual al español". El detector recibe las entidades bilingües que el composer ya seleccionó: `composeWithResolution` devuelve la salida y la selección, y solo lo usa el preview. `compose()` sigue igual para la ruta pública y el head.
- **D4, campos opcionales.** Un campo vacío en todos los idiomas, como una `description` nula o el titular vacío de `all` (decisión D7 de `add-profile-content-admin`), no cuenta como faltante.
- **Tarea 5.1.** Contradecía el non-goal "escribirlo es de Manuel". Se resolvió sola: el informe ya da cero sobre el JSON, y el test lo deja fijado.
- **Caché del preview.** Se fijó `gcTime` en 5 minutos, el default de TanStack Query, porque el render de los tests usa `gcTime: 0` y descartaba el idioma anterior. En la app no cambia nada.
