# Verificación — fix-error-contrast-and-date-modified

> Plan de verificación del change. Se completa al implementarlo, con la evidencia en `verification/`, como en `polish-views-updated-at-and-builder`. Todas las escrituras van contra bases descartables (la del e2e y `portfolio_errfix_check`); la base `portfolio` del owner no se toca. Ninguna contraseña de prueba se imprime ni se escribe en este archivo ni en `verification/`.

Estado: **propuesto** (2026-11-06). Rama `fix/error-contrast-and-date-modified`, apilada sobre `docs/archive-fase-1-2-b` (PR #50).

## Resultado por tarea

| Tarea | Qué se comprueba | Resultado | Evidencia |
|---|---|---|---|
| 1.1 Punto de partida | Suites verdes y `Totals:` de OpenSpec antes de tocar nada | pendiente | `verification/1.1-punto-de-partida.txt` |
| 1.2–1.3 Rojos | `--t-danger-ink` y la regla `danger` fallan; fixture y e2e de `dateModified` fallan, el paso del sitemap pasa | pendiente | `1.2-rojo-a.txt`, `1.3-rojo-b.txt` |
| 2.1–2.3 Token | ≥ 4,5:1 en los cinco presets contra `bg`, `bgSoft` y `card`; `minimal` = base; `modern-dark` = `#e45656`; tono conservado | pendiente | `css-vars.spec.ts` |
| 3.1–3.4 Reemplazo y regla | Solo `dropdown-menu.tsx` conserva `text-destructive`; sin `color-mix` en `features/`; la regla atrapa los dos casos y no los botones | pendiente | `status-color-usage.spec.ts`, grep |
| 4.1–4.4 `a11y:check` | Login con 401 simulado y diálogo vacío auditados en dos viewports; sin `POST` de la auditoría; control en rojo con `text-destructive` | pendiente | `4.1-control.txt`, `4.4-rojo-a11y.txt` |
| 5.1 Frontend A | lint, typecheck, test, build, `perf:budget` ≤ 155 KB | pendiente | `5.1-frontend-a.txt` |
| 6.1–6.5 `dateModified` | Fixture con `updatedAt` (nulo y 23:30 UTC); paridad head/cliente; contrato regenerado; e2e con fragmento, API y sitemap el mismo día; visita que no lo mueve; Vitest con `TZ=America/La_Paz` | pendiente | specs de consistencia, `profile-date-modified.e2e-spec.ts` |
| 7.1 Final | Backend y frontend completos en verde | pendiente | `7.1-final.txt` |
| 8.1–8.5 App real | `a11y:check` con panel en 0; TC-44 con `dateModified` = `<lastmod>` en head y SPA; `manual:check` con 44 casos; base borrada | pendiente | `8.1`–`8.5` |
| 9.1–9.2 Cierre | `validate --all --strict` sin fallos ni «Archive would refuse» | pendiente | `9.1-validacion.txt` |

## Medidas de partida (diseño)

Contraste de `#dc2626` como texto, con la fórmula de `frontend/src/themes/contrast.ts`:

| Preset | `bg` | `bgSoft` | `card` | `--t-danger-ink` esperado | mínimo esperado |
|---|---|---|---|---|---|
| modern-dark (panel) | 3,99 | 3,67 | 3,48 | `#e45656` | 4,61 |
| modern-light | — | — | — | `#da2323` | 4,51 |
| minimal | 4,83 | 4,63 | 4,83 | `#dc2626` (base) | 4,63 |
| elegant | 3,67 | 3,40 | 3,20 | `#e55f5f` | 4,51 |
| corporate | 4,62 | 4,39 | 4,83 | `#d52222` | 4,68 |

Lo que no cambia y por qué (D2): blanco sobre `bg-destructive` = 4,83:1; blanco sobre `bg-destructive/60` en `modern-dark` = 9,40:1 (fondo) y 8,77:1 (tarjeta); bordes `aria-invalid` sobre la tarjeta del panel = 3,48:1 (componente no textual, 3:1).

## TC-44 — cambios del texto (D10)

- **Resultado esperado 1**, última oración: «No hay `dateModified`.» → «`dateModified` es el día de la última edición del perfil (`AAAA-MM-DD`), el mismo que el `<lastmod>` de esa URL en `/sitemap.xml`.»
- **Resultado esperado 6**: «Las advertencias por campos recomendados (`dateModified`, `image`) son esperables (P1 de `design.md` de `upgrade-profile-structured-data`).» → «La advertencia por `image` (campo recomendado) es esperable.»
- **Errores típicos**, al final: «Si `dateModified` no coincide con el `<lastmod>`, revisá que no estés mirando el head en caché (un minuto) después de editar el perfil.»

El estado del caso sigue en 🔍 hasta correr los pasos 6 y 7 con el sitio desplegado.
