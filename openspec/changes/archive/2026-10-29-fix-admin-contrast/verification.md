# Verificación — fix-admin-contrast

Fecha: 2026-10-28. Rama `fix/admin-contrast` sobre `f833bbf`. Evidencia en `verification/` y partida en `audit/`.

## Resultado

| Medida | Antes | Después |
|---|---|---|
| `a11y:check` con panel, ejemplo (`A11Y_CHECK_PROFILE=ejemplo-backend`) | 39 `color-contrast` + 1 `scrollable-region-focusable` (50 cargas) | **0** serious/critical, teclado sin problemas (50 cargas) |
| `a11y:check` con panel, `cv-data.json` | 0 | **0** (72 cargas), teclado sin problemas |
| `a11y:check` sin perfil base en el ejemplo | 27 + 1 sobre un 404, sin aviso | salida 2 sin abrir páginas (`ProfileView` 105 → 105) |
| `perf:budget` | 148,9 KB gzip (147,8 + 1,0) | 148,9 KB (sin regresión; tope 155) |
| `print:check` (A4 y Letter) | — | 20 casos, 0 con problemas, contraste mínimo 9,74:1 |
| Vitest | — | 640 pruebas verdes (una corrida con la CPU saturada por las APIs y Chrome falló 3 pruebas de temporización de otros archivos; la repetición pasó completa) |
| lint / typecheck / build | — | verdes |
| `manual:check` | — | 39 casos alineados, 44 imágenes, `index.html` 212 KB |
| `openspec validate --all --strict` | — | 38 pasan, 0 fallan, sin «Archive would refuse» |

Por página: `verification/6.2-resumen.md`. Reportes completos de axe: `verification/6.2-ejemplo/` y `verification/6.2-cv/`.

## Colores derivados (`--t-success-ink`)

| Preset | Antes | Derivado | Peor caso |
|---|---|---|---|
| modern-dark | `#00bc7d` 5,31:1 | `#00bc7d` | 5,31:1 |
| elegant | `#00bc7d` 4,91:1 | `#00bc7d` | 4,91:1 |
| modern-light | 2,06:1 | `#00754e` | 4,80:1 |
| minimal | 2,15:1 | `#007a51` | 4,67:1 |
| corporate | 2,07:1 | `#00754e` | 4,80:1 |

Los valores salen de los tests de `css-vars.spec.ts` (fijan los hex y el ≥ 4,5:1 contra las cinco superficies).

## Pendiente

- Tarea 5.2 (PR con las tres piernas verdes y sus duraciones) y 5.3 (prueba negativa en el CI): requieren el CI remoto.
- Tarea 8.2 (archivar, roadmap de `CLAUDE.md`, sync de la spec): se hace al archivar.
