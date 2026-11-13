# raise-manual-images-cap — tope del total de imágenes del manual acorde al límite real

> Change chico de herramientas de documentación. No toca la app, la API ni la base.

## Why

Las 55 capturas de `docs/manual/` suman **3,99 MB** en `main`, con un promedio de **74 KB** por imagen. El requisito *Tope de tamaño del manual* fija **4 MB** para el total (`MAX_IMAGES_TOTAL` en `frontend/scripts/check-manual.mjs`).

Al fusionar `add-job-posting-intake` (#60) el total llegó a 4,01 MB. Para que entrara hubo que recomprimir tres capturas (`tc36-ejemplo-home`, `tc18-dashboard` y `bo-constructor-diseno`). Con unos 10 KB de margen, la próxima captura rompe `npm run manual:check` en el CI.

El tope existe para que el manual se pueda publicar como artifact con margen. En un artifact, las imágenes van como archivos aparte: cada archivo binario admite 15 MB, y cada publicación admite 64 MB. Los 4 MB no salen de ninguna restricción. El tope por imagen (150 KB) sí cumple su función, porque detecta una captura anómala o una imagen embebida, así que no cambia.

## What Changes

- **Total de imágenes en 8 MB (D1).** `MAX_IMAGES_TOTAL` pasa de `4 * 1024 * 1024` a `8 * 1024 * 1024`. Al promedio actual alcanza para unas 55 capturas más.
- **Mensaje con el tope derivado (D2).** El mensaje de error se arma desde la constante, igual que el del HTML desde `raise-manual-html-size-cap`. El comentario de cabecera dice «8 MB».
- **Sin cambios en el tope por imagen ni en el del HTML** (150 KB y 1 MB).
- **Las tres capturas recomprimidas no se revierten.** Se regeneran solas en la próxima corrida de `manual:capture`.
- `docs/CHANGELOG.md` registra el tope nuevo.

## Capabilities

### Modified Capabilities

- `platform-manual`: el requisito *Tope de tamaño del manual* sube el total de imágenes a 8 MB y suma dos escenarios para el total.

## Impact

- `frontend/scripts/check-manual.mjs`: la constante, el mensaje y el comentario.
- `openspec/specs/platform-manual/spec.md`, al archivar.
- `docs/CHANGELOG.md`.
- Sin cambios de contrato, de dependencias ni de datos.
