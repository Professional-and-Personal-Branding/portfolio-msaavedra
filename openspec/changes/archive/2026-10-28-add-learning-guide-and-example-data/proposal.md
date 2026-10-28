# add-learning-guide-and-example-data — Datos de ejemplo completos y manual de aprendizaje

> Iteración posterior a la ronda 1.1 y a los changes de calidad web (todos archivados al 2026-10-16). Parte de la rama `docs/refresh-after-1-1` (PR #33), que dejó la documentación al día. No abre una fase nueva de `docs/SPECS-POR-FASE.md`.
>
> Pedido del owner, textual: *«Seeders de profiles completos con todas las secciones completadas para guía mía de populación de contenido en el directorio, además del manual completo del backoffice en cuestión, Ruta de aprendizaje, Recorridos por objetivo, Capturas renovadas, Modo prueba mejorado»*.

## Why

El panel ya permite editar todo el contenido, pero aprender a usarlo sigue costando. Estado verificado el 27 de octubre de 2026 sobre `docs/refresh-after-1-1`:

1. **No hay un conjunto de datos que muestre todo.** `docs/cv-data.json` es el CV real del owner y deja sin ejemplo la mitad de los mecanismos del perfil curado. Las 13 plantillas son `PUBLIC`, `classic`, `modern-dark`, con las 9 secciones en orden canónico y sin `sectionsHidden`, `includeIds`, `excludeIds`, token, archivado ni alias. Todas las experiencias, formaciones y certificaciones son visibles, y las skills reciben los tags de una heurística por categoría (`tagsForSkillCategory`).
2. **El seed no puede representar esos mecanismos.** `backend/scripts/seed.ts` lee siempre `docs/cv-data.json` y fija `visibility: 'PUBLIC'`, `layout: 'classic'` y el tema `modern-dark`. Tampoco tiene cómo referirse a los ids de `includeIds`/`excludeIds`, que genera la base.
3. **El seed sobrescribe sin preguntar.** Borra las 13 tablas del contenido y recarga. Correrlo contra la base del owner pisa lo que editó desde el panel. Cualquier archivo alternativo tiene que ser imposible de cargar ahí por accidente.
4. **El manual es una suite de casos, no una guía.** `docs/MANUAL.md` y `docs/manual/index.html` describen 35 casos (28 *pasa*, 7 *parcial*), pero no explican los conceptos en orden ni cómo resolver tareas reales. Tampoco recorren cada pantalla del panel con sus campos, sus validaciones y sus mensajes.
5. **Las capturas quedaron viejas.** Las 27 capturas son del 4 al 10 de octubre, sacadas a mano sobre el CV real. Varias muestran pantallas anteriores a cambios ya archivados: la experiencia sin *Logros (en)*, con la nota de *Limitación actual* todavía publicada; la Publicación sin enumeración, archivado ni link público; la lista de perfiles sin *Duplicar*; el login anterior al foco visible. Otros casos no tienen ninguna: TC-31, TC-33, TC-34, TC-35 y TC-21 a TC-24. `tc32-faltantes.png` pesa 186 KB, más que cualquier otra.
6. **El modo prueba solo marca casillas.** `index.html` filtra por estado y busca texto. Las marcas viven en `localStorage` y no hay forma de sacar el resultado de una corrida para dejarlo registrado.

## What Changes

- **Datos de ejemplo (D2, D7, D8).** Nuevo `docs/examples/cv-data.example.json`, con el formato de `cv-data.json` y una persona ficticia. Todas las entidades tienen al menos una fila y el perfil `all` muestra las 9 secciones con datos. Las plantillas cubren cada mecanismo: `filterTags`, `includeIds` (también sobre un ítem oculto, que no entra), `excludeIds`, orden y ocultado de secciones, `themeOverrides` con acento oscuro, layout `sidebar`, otro preset, `PUBLIC`/`PROTECTED`/`PRIVATE`, `listed: false`, archivado y alias de slug. Trae un faltante de traducción deliberado y visitas sintéticas para el dashboard.
- **Formato extendido y opcional del seed (D3, D7).** Campos opcionales nuevos, ausentes en `cv-data.json`: `visible` en experiencias, formación y certificaciones; tags por categoría o por skill; y, en las plantillas, `theme`, `layout`, `visibility`, `accessToken`, `sectionsOrder`, `sectionsHidden`, `includeRefs`, `excludeRefs`, `archived` y `slugAliases`. Se agrega además `exampleViews`. Sin ellos el seed produce exactamente lo de hoy.
- **Carga segura de un archivo alternativo (D5, D6).** `npm run seed -- --file <ruta>` y `npm run seed:verify -- --file <ruta>`, con los atajos `seed:example` y `seed:example:verify`. Con `--file` el seed valida el archivo y comprueba tres cosas antes de borrar nada: `SEED_DISPOSABLE_DB=1`, `NODE_ENV` distinto de `production` y que la base esté vacía o ya tenga la misma persona del archivo. Si alguna falla, sale con código 2 sin tocar la base. Sin `--file`, todo sigue igual.
- **Guía campo por campo (D4).** `docs/DATA-POPULATION.md` suma la referencia de cada campo del formato: tipo, obligatoriedad, ejemplo, dónde se ve y qué pantalla del panel lo edita. Explica también cómo levantar la base de ejemplo.
- **Manual reorganizado (D9, D10).** `MANUAL.md` e `index.html` pasan a tener esta estructura: *Ruta de aprendizaje* (8 conceptos en orden), *Recorridos por objetivo* (9 tareas reales), *Manual del backoffice* (cada pantalla con cada campo, validación y mensaje literal del código), los casos TC-01 a TC-37 (dos casos nuevos para los datos de ejemplo), operación y glosario. Los casos toman como base la de ejemplo.
- **Capturas reproducibles (D11, D12).** Nuevo `npm run manual:capture` en `frontend/scripts/`, con `puppeteer-core` y el Chrome del sistema, como `print:check`. Saca todas las capturas del manual contra una base descartable sembrada con el ejemplo. Exige `MANUAL_CAPTURE_DISPOSABLE_DB=1`, comprueba por la API que la persona servida es la del ejemplo y entra al panel con `fetch('/api/auth/login')` y credenciales de prueba aleatorias, sin escribir la contraseña en un campo. Fuera de iniciar sesión, no guarda nada. Se renuevan las 27 capturas y se suman las que faltan (inventario en `design.md`, D12).
- **Alineación comprobable (D13).** Nuevo `npm run manual:check`, sin navegador ni base. Comprueba que `MANUAL.md` e `index.html` tengan los mismos casos con el mismo título y estado, que cada imagen referenciada exista y ninguna quede huérfana, que se respeten los topes de tamaño y que cada mensaje de validación citado exista en `frontend/src`. Corre en el job de frontend del CI.
- **Modo prueba mejorado (D14, D15).** En `index.html`: filtros combinables por estado, área (pública, backoffice, datos) y change; un resultado por caso (*pasa*, *falla* u *omitido*) con una nota opcional; *Copiar resultado* en Markdown con fecha, base y casos; y un glosario. Sin dependencias nuevas, con `localStorage` solo como conveniencia y accesible por teclado.
- **Docs y cierre:** `CLAUDE.md` (comandos nuevos), `docs/CHANGELOG.md` y `docs/ARCHITECTURE.md` (referencia al ejemplo) al archivar.

## Non-goals

- Cambiar el dominio, la API, el OpenAPI, el schema de Prisma o las migraciones. Los datos de ejemplo usan columnas que ya existen.
- Cambiar el comportamiento de `npm run seed` sin `--file` o de `docs/cv-data.json`. Proteger también el seed por defecto queda como pregunta abierta (P5).
- Exponer en el constructor `includeIds`/`excludeIds` de skills y proyectos, que hoy solo se editan por la API. El manual lo documenta tal cual.
- Usar o mostrar `FeaturedRepository`: la tabla existe, pero ningún módulo de `backend/src` la lee. El ejemplo no le carga filas visibles y la guía la marca como inerte.
- Comparar capturas automáticamente (regresión visual) o sumar `manual:capture` al CI.
- Traducir el manual al inglés.
- Hacer que el informe de una corrida salga del navegador: se copia al portapapeles y el lector decide dónde guardarlo.

## Capabilities

### New Capabilities

- `example-seed-data`: el archivo de datos de ejemplo, su cobertura de entidades y mecanismos, las referencias estables de los overrides, la carga con archivo alternativo y la negativa a cargarlo sobre una base que no sea descartable, la verificación y la guía campo por campo.
- `platform-manual`: el manual de la plataforma en sus dos formatos alineados, con la ruta de aprendizaje, los recorridos, el manual del backoffice, los casos de los datos de ejemplo, las capturas reproducibles con su inventario y sus topes, el modo prueba con filtros, el registro de corrida y el glosario.

### Modified Capabilities

- `data-persistence-seed`: suma un requisito (ADDED) para que el seed por defecto no cambie con el formato extendido. Los requisitos vigentes no se modifican.

## Impact

- **Backend (`backend/scripts/`, tooling, no `src/`):** `seed.ts` (`--file`, validación previa, negativa, formato extendido, refs y visitas sintéticas), `verify-seed.ts` (`--file` y comprobaciones de mecanismos) y `backend/package.json` (`seed:example`, `seed:example:verify`). Sin cambios en `backend/src`, `backend/prisma` ni el OpenAPI. Tests nuevos del parser y de la negativa, sin base.
- **Frontend (`frontend/scripts/`, tooling):** `capture-manual.mjs` y `check-manual.mjs`, con los scripts `manual:capture` y `manual:check` en `package.json`. Reutilizan `scripts/lib/web-quality.mjs` (`findChrome`, `chromeFlags`). Sin dependencias nuevas, porque `puppeteer-core` ya está. Sin cambios en `frontend/src`.
- **Datos:** nuevo `docs/examples/cv-data.example.json`. `docs/cv-data.json` no cambia.
- **Docs:** `docs/MANUAL.md`, `docs/manual/index.html`, `docs/manual/*.jpg` (renovadas y nuevas; `tc32-faltantes.png` pasa a `.jpg`), `docs/manual/suite-backoffice.ps1` (base de ejemplo), `docs/DATA-POPULATION.md`, `CLAUDE.md`, `docs/CHANGELOG.md` y `docs/ARCHITECTURE.md`.
- **CI (`.github/workflows/ci.yml`):** `manual:check` en el job de frontend. En el job de e2e, `seed:example` y `seed:example:verify` contra una segunda base del Postgres de servicio.
- **Tamaño:** `index.html` ≤ 300 KB (hoy 107 KB), cada captura ≤ 150 KB y el total de `docs/manual/` ≤ 4 MB, para que el manual se pueda seguir publicando como artifact.
