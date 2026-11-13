# Tasks — raise-manual-images-cap

## 1. Spec y verificación previa

- [x] 1.1 Delta `MODIFIED` de *Tope de tamaño del manual* en `specs/platform-manual/spec.md`, con los escenarios del total de imágenes
- [x] 1.2 `npx -y @fission-ai/openspec@1.14.1 validate --all --strict` sin errores ni «Archive would refuse»

## 2. Script

- [x] 2.1 `MAX_IMAGES_TOTAL = 8 * 1024 * 1024` en `frontend/scripts/check-manual.mjs`
- [x] 2.2 Mensaje de error con el tope tomado de la constante («el tope es 8 MB») y comentario de cabecera al día
- [x] 2.3 `npm run manual:check` en verde
- [x] 2.4 Escenarios del total probados con `--root` sobre una copia temporal del manual (5 MB pasa; 8,5 MB falla con código 1)

## 3. Documentación

- [x] 3.1 Entrada en `docs/CHANGELOG.md`
