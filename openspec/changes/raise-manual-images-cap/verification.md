# Verificación — raise-manual-images-cap

Ejecutado el 13 de noviembre de 2026 sobre `main` con `add-job-posting-intake` ya fusionado: 55 imágenes, 3,99 MB y un promedio de 74 KB.

| Prueba | Resultado |
|---|---|
| `npm run manual:check` sobre el repo | ok: 51 casos, 55 imágenes (3,99 MB), `index.html` 346 KB |
| Copia del manual con cada imagen agrandada a 93 KB, sin pasar de 150 KB (`--root`) | 5,20 MB en total: ok, código 0 |
| Copia del manual con cada imagen en 149 KB, sin pasar de 150 KB (`--root`) | 8,00 MB en total (8.391.680 bytes, 3.072 sobre 8 MiB): «las imágenes suman 8.00 MB y el tope es 8 MB», código 1, sin errores por imagen |
| `openspec validate --all --strict` (1.14.1) | 45 passed, 0 failed |

El escenario de la spec usa 8,5 MB. Con 55 imágenes de hasta 150 KB no se puede llegar a esa cifra sin disparar el tope por imagen, así que la prueba usa el máximo alcanzable, que ya supera el tope. El mensaje redondea a dos decimales; el código de salida es lo que decide.

Las copias se armaron en el scratchpad de la sesión con un script que agrega bytes al final de cada imagen. Después se borraron.
