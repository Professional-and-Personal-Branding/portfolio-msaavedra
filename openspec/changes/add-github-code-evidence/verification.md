# Verificación — add-github-code-evidence

La evidencia por tarea está en `verification/` (punto de partida, migración, TC-52, `a11y:check`, `print:check` y cierre).

## Revisión de seguridad y su resolución

Sin hallazgos críticos ni altos. Corregidos en `fix(integrations)`:

| Hallazgo | Arreglo | Verificación |
|---|---|---|
| M1: surrogate suelto por `slice` UTF-16 dejaba el trabajo en `DEAD` | `wellFormed` y `truncateCodePoints` sobre todo string remoto guardado | `project-github-repository.spec.ts` (emoji en el borde, surrogates y NUL) y e2e `github-code-evidence` contra la base (guarda sin error) |
| B1: conteos sin tope desbordaban INTEGER | stars y bytes ≤ 2 147 483 647; topics y lenguajes ≤ 50 code points | mismos tests |
| B2: ocultos ocupaban lugar en el tope de 50 | visibles primero, ocultos después (enmienda de D3) | `sync-github-evidence.service.spec.ts`, 52 repositorios |
| B3: `AbortSignal.any` pide Node ≥ 20.3 | `engines` ya en `22.x`; nota en `docs/DEPLOY-RAILWAY.md` | — |
