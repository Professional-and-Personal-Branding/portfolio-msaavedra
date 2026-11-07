# Verificación — fix-error-contrast-and-date-modified

> Plan de verificación del change. Se completa al implementarlo, con la evidencia en `verification/`, como en `polish-views-updated-at-and-builder`. Todas las escrituras van contra bases descartables (la del e2e y `portfolio_errfix_check`); la base `portfolio` del owner no se toca. Ninguna contraseña de prueba se imprime ni se escribe en este archivo ni en `verification/`.

Estado: **implementado** (2026-11-06), pendiente de archivar. Rama `fix/error-contrast-and-date-modified`, apilada sobre `docs/archive-fase-1-2-b` (PR #50).

## Resultado por tarea

| Tarea | Qué se comprueba | Resultado | Evidencia |
|---|---|---|---|
| 1.1 Punto de partida | Suites verdes y `Totals:` de OpenSpec antes de tocar nada | ok: backend 968 tests, frontend 1032, `Totals: 39 passed, 0 failed` | `1.1-punto-de-partida.txt` |
| 1.2–1.3 Rojos | `--t-danger-ink` y la regla `danger` fallan; fixture y e2e de `dateModified` fallan, el paso del sitemap pasa | desvío: no se capturó el rojo previo; los controles se probaron con 4.4 y con tres specs que fijaban el contrato viejo | `1.2-rojo-a.txt`, `1.3-rojo-b.txt` |
| 2.1–2.3 Token | ≥ 4,5:1 en los cinco presets contra `bg`, `bgSoft` y `card`; `minimal` = base; `modern-dark` = `#e45656`; tono conservado | ok: 5 presets ≥ 4,5:1 contra `bg`, `bgSoft` y `card`; `minimal` = `#dc2626`; `modern-dark` = `#e45656`; tono a menos de 1° | `css-vars.spec.ts` |
| 3.1–3.4 Reemplazo y regla | Solo `dropdown-menu.tsx` conserva `text-destructive`; sin `color-mix` en `features/`; la regla atrapa los dos casos y no los botones | ok: solo `dropdown-menu.tsx` conserva `text-destructive`; sin `color-mix` en `features/`; la regla atrapa los dos casos y no los botones | `status-color-usage.spec.ts`, grep |
| 4.1–4.4 `a11y:check` | Login con 401 simulado y diálogo vacío auditados en dos viewports; sin `POST` de la auditoría; control en rojo con `text-destructive` | ok: login (401 simulado) y diálogo vacío auditados en móvil y escritorio; un solo `POST /api/auth/login` en el log (el `fetch` de la sesión); 0 `POST` de la entrada de experiencias; con `text-destructive` en las dos pantallas marca `color-contrast` (8 nodos); con un mensaje inexistente sale con 1 | `4.1-control.txt`, `4.4-rojo-a11y.txt` |
| 5.1 Frontend A | lint, typecheck, test, build, `perf:budget` ≤ 155 KB | ok: lint, typecheck, test, build; `perf:budget` 148,9 KB gzip (total 150,1 KB, tope 155) | `5.1-frontend-a.txt` |
| 6.1–6.5 `dateModified` | Fixture con `updatedAt` (nulo y 23:30 UTC); paridad head/cliente; contrato regenerado; e2e con fragmento, API y sitemap el mismo día; visita que no lo mueve; Vitest con `TZ=America/La_Paz` | ok: fixture con `updatedAt` (nulo y 23:30 UTC); paridad head/cliente; contrato regenerado; e2e con fragmento, API y sitemap el mismo día y visita que no mueve nada; Vitest también con `TZ` La Paz y Auckland | specs de consistencia, `profile-date-modified.e2e-spec.ts`, `6.5-zonas-horarias.txt` |
| 7.1 Final | Backend y frontend completos en verde | ok: backend 972 unit + 277 e2e; frontend 1041; `openapi:export` sin deriva | `7.1-final.txt` |
| 8.1–8.5 App real | `a11y:check` con panel en 0; TC-44 con `dateModified` = `<lastmod>` en head y SPA; `manual:check` con 44 casos; base borrada | ok: `a11y:check` con panel, 56 cargas, 0 violaciones; TC-44: `dateModified` = `<lastmod>` = `updatedAt` en head, API y bloque que escribe la SPA, y una visita (views 32 a 33) no lo mueve; `manual:check` ok (45 casos, sin TC nuevo); base y contenedores borrados | `8.1`–`8.5` |
| 9.1–9.2 Cierre | `validate --all --strict` sin fallos ni «Archive would refuse» | `validate --all --strict`: `Totals: 39 passed, 0 failed (39 items)`; el change válido con `--strict`; sin «Archive would refuse». `verification.md` completo; CHANGELOG y roadmap quedan para el archivado | `9.1-validacion.txt` |

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

## Desvíos

1. **Rojos 1.2 y 1.3 sin capturar por separado.** Código y tests se escribieron en la misma pasada. Se compensó con el control de 4.4 (con `text-destructive` en las dos pantallas, `a11y:check` marca `color-contrast`), el control de 4.1 (la entrada falla si no ve el mensaje) y el caso `danger` del detector. Al sumar `updatedAt`, tres specs que fijaban el contrato viejo fallaron hasta actualizarlos: `curated-profile.e2e-spec` (lista exacta de claves), `backoffice.e2e-spec` (el preview de un borrador informa `updatedAt: null` y la ruta pública la fecha) y `hardening.e2e-spec` (esperaba que no hubiera `dateModified`).
2. **`TZ` en Windows.** Un `TZ=America/La_Paz` puesto en el entorno de Git Bash no llega a Node; se usó `NODE_OPTIONS=--require` con un archivo que asigna `process.env.TZ`. El caso de las 23:30 UTC no distingue la zona de La Paz (UTC−4 sigue en el mismo día), así que se corrió además con `Pacific/Auckland` (UTC+13), donde `new Date(...).getDate()` sí cambiaría de día: verde en las dos.
3. **Segundo commit mezcla un archivo.** `PortadaPage.tsx` (`updatedAt: null` en `heroData`) quedó en el commit de la parte A por el `git add` de `features/`; la parte A sola no compila contra el `api.d.ts` regenerado del commit B. El PR es un solo conjunto.
4. **Recuento del manual.** `manual:check` informa 45 casos (el 45 existe de antes); el change no suma ninguno.
5. **Corrida de `a11y:check` sin superficie `glass` extra.** El derivado se calculó solo sobre los tres fondos (D1); axe no marcó ningún caso, así que no hizo falta sumar superficies (riesgo de D1).
6. **Formato.** `theme.css` y `ShareLinksPanel.tsx` ya no pasaban `prettier --check` antes del change (el frontend no lo exige en el CI); no se reformatearon.
