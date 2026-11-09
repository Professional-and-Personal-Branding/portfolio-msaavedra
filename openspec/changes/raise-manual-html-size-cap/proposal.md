# raise-manual-html-size-cap — tope del `index.html` del manual acorde al límite real

> Change chico de herramientas de documentación. No toca la app, la API ni la base.

## Why

`docs/manual/index.html` pesa **295.690 bytes (~289 KB)** en `main` y el requisito *Tope de tamaño del manual* fija **300 KB** (`MAX_HTML` en `frontend/scripts/check-manual.mjs`). Cada caso de prueba nuevo suma unos 3 KB de HTML, así que el próximo (TC-49) o el siguiente rompe `npm run manual:check` en el CI. Al fusionar TC-46 a TC-48 ya hubo que compactar la nota de estado para que entrara.

El motivo del tope es «que el manual se pueda publicar como artifact», y ese límite es de **16 MB** por página. Los 300 KB no salen de ninguna restricción.

## What Changes

- **Tope del HTML en 1 MB (D1).** `MAX_HTML` pasa de `300 * 1024` a `1024 * 1024`, y el mensaje de error y el comentario de cabecera de `check-manual.mjs` dicen «1 MB». Los topes de imágenes no cambian (150 KB cada una, 4 MB en total).
- **Mensaje con el tope derivado.** El mensaje se arma desde la constante para que no vuelvan a quedar desalineados.
- **Sin reducción estructural (D2).** No se quita el historial ni se normaliza la sangría del HTML.
- `docs/CHANGELOG.md` registra el tope nuevo.

## Capabilities

### Modified Capabilities

- `platform-manual`: el requisito *Tope de tamaño del manual* sube el tope de `index.html` a 1 MB y suma un escenario para el HTML.

## Impact

- `frontend/scripts/check-manual.mjs` (constante, mensaje y comentario).
- `openspec/specs/platform-manual/spec.md` (al archivar).
- `docs/CHANGELOG.md`.
- Sin cambios de contrato, de dependencias ni de datos.
