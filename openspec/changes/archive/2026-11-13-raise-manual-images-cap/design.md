# Design — raise-manual-images-cap

## D1 — Total de imágenes en 8 MB

- **Valor.** 8 MB duplica el tope actual. Al promedio de hoy (74 KB por captura) alcanza para unas 55 capturas más, y cada change suma entre una y tres.
- **Por qué no más.** El tope también sirve como alarma: si el total salta de golpe, algo se coló, por ejemplo una captura sin comprimir o una imagen duplicada. Con 8 MB, el manual completo (imágenes más `index.html` de hasta 1 MB) sigue muy por debajo de los límites de un artifact (16 MB la página, 15 MB cada archivo binario y 64 MB cada publicación).
- **Alternativas descartadas:**
  - Bajar la calidad JPEG de `manual:capture`: degrada todas las capturas para ganar un margen que se agota igual.
  - Pasar a WebP: cambia el manifiesto, los dos formatos del manual y el script de capturas, por un problema que es solo de umbral.

## D2 — Mensaje derivado de la constante

El mensaje dice `el tope es ${MAX_IMAGES_TOTAL / 1048576} MB`, igual que el del HTML. Así la constante y el texto no pueden quedar desalineados.

## Riesgos

Ninguno de runtime: solo cambia un umbral del script de verificación de la documentación.
