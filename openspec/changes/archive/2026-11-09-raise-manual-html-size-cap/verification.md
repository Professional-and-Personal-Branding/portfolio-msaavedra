# Verificación — raise-manual-html-size-cap

Fecha: 2026-11-09, sobre `origin/main` (`ed046f0`).

| Escenario | Cómo | Resultado |
|---|---|---|
| Estado actual | `npm run manual:check` | `ok: 47 casos alineados, 49 imágenes (3.63 MB), index.html 289 KB` · código 0 |
| HTML dentro del tope | `index.html` con un comentario de 30 KB al final (~320 KB) | código 0, sin error de tamaño |
| HTML pesado | `index.html` con otros 900 KB (~1,2 MB) | `index.html pesa 1197 KB y el tope es 1 MB` · código 1 |
| Spec | `npx -y @fission-ai/openspec@1.14.1 validate --all --strict` | 41 passed, 0 failed |

Los rellenos del HTML se revirtieron con `git checkout` después de cada prueba.
