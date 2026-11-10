# Tasks — raise-manual-html-size-cap

## 1. Spec y verificación previa

- [x] 1.1 Delta `MODIFIED` de *Tope de tamaño del manual* en `specs/platform-manual/spec.md`, con el escenario del HTML
- [x] 1.2 `npx -y @fission-ai/openspec@1.14.1 validate --all --strict` sin errores

## 2. Script

- [x] 2.1 `MAX_HTML = 1024 * 1024` en `frontend/scripts/check-manual.mjs`
- [x] 2.2 Mensaje de error con el tope tomado de la constante («el tope es 1 MB») y comentario de cabecera al día
- [x] 2.3 `npm run manual:check` en verde

## 3. Documentación

- [x] 3.1 Entrada en `docs/CHANGELOG.md`
