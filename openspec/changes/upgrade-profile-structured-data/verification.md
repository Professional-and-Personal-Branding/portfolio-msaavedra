# Verificación — upgrade-profile-structured-data

> Verificación completada el 2026-11-04 al implementar, con la evidencia en `verification/`, como en `add-certification-verification`. Ninguna tarea escribe en la base `portfolio` del owner.

## Resultado por tarea

| Tarea | Qué se comprueba | Resultado | Evidencia |
|---|---|---|---|
| 1.1 Punto de partida | Suites verdes y tamaño del arranque antes de tocar nada | ✅ backend 909 + 244 e2e, frontend 960, arranque 149,7 KB | `verification/1.1-punto-de-partida.txt` |
| 2.1 Fixture | `expected.jsonLd` por caso, revisado a mano contra D2 | ✅ 7 casos (3 ampliados, 4 nuevos) | `verification/2.1-fixture.md` |
| 3.1–3.4 Servidor | `ProfilePage` con `Person`, listas de D3/D4, sin fechas, escape de D8, paridad con el fixture | ✅ 12 tests nuevos en `profile-head.renderer.spec.ts` y la paridad con el fixture | specs de `profile-head.*` |
| 4.1–4.4 Cliente | Misma salida que el servidor, sin bloque con `noindex`, un solo bloque al navegar, `perf:budget` ≤ 155 KB | ✅ 150,1 KB (+0,4) | `verification/4.4-perf-budget.txt` |
| 5.1 E2e | Bloque parseado en `es` y `en`, `via`/`src` ignorados, `@id` común, regresión de no indexables | ✅ 250 tests (+6) | `verification/5.1-e2e.txt` |
| 6.1–6.3 App real | TC-44 pasos 1 a 5, consola sin violaciones de CSP, validador de schema.org | ✅ validador de schema.org: 0 errores y 0 advertencias; pasos 6 y 7 tras el deploy | `verification/6.2-tc44.txt`, `6.3-base-del-owner.txt` |
| 7.1–7.4 Docs | TC-44 en el manual, `manual:check`, deploy, checklist, changelog, roadmap | ✅ 7.1 a 7.3; 7.4 queda para el PR de archivado | diff |
| 8.1–8.2 Cierre | Todo verde, contrato sin cambios, validación estricta | ✅ `Totals: 39 passed, 0 failed` | `verification/8.1-cierre.txt`, `8.2-validacion.txt` |

## TC-44 — Los buscadores leen la página de perfil

Texto del caso para `docs/MANUAL.md` (sección 2, después de TC-40, y de TC-43 si ya está fusionado) y su espejo en `docs/manual/index.html`. Quedó en 🔍 con los pasos 1 a 5 ejecutados contra la imagen local; pasa a ✅ cuando los pasos 6 y 7 se corren con el sitio desplegado. El texto de `docs/MANUAL.md` ajusta los nombres de los controles del validador a los de su interfaz (**Fragmento de código**, **Obtener la URL**) y pide pegar el JSON-LD y no el HTML completo.

**Precondición:** base **descartable** sembrada con el ejemplo (nunca `portfolio`: cada carga pública registra una visita), la API y la imagen de `frontend/Dockerfile` levantadas, y un perfil del ejemplo puesto en `PROTECTED` desde el panel. Para los pasos 6 y 7, el sitio desplegado.

**Pasos:**
1. `curl -s <base>/ejemplo-backend` y buscá `application/ld+json` en la respuesta.
2. Repetí con `?lang=en` y con `?via=k7m2q9xw4t&src=linkedin`.
3. Compará el bloque de `/` con el de `/ejemplo-backend`.
4. `curl -s` del perfil `PROTECTED`, sin y con `?token=<su token>`.
5. Abrí `/ejemplo-backend` en Chrome, DevTools → **Elements**, buscá `ld+json`, y mirá la **Console**. Copiá el HTML que devolvió el paso 1 y pegalo en el validador de schema.org (https://validator.schema.org, **Code snippet**).
6. Con el sitio desplegado, pasá la URL de la home y la de un perfil público por el Rich Results Test (https://search.google.com/test/rich-results).
7. Pasá esas dos URLs por el validador de schema.org (**Fetch URL**).

**Resultado esperado:**
1. Hay un solo bloque. Es un `ProfilePage` con `url` igual al `canonical` (sin query), `name` igual al `<title>`, `inLanguage` `es` y un `mainEntity` `Person` con el nombre de la persona ficticia, `knowsAbout` con las skills que muestra el perfil, `alumniOf` y `hasCredential` (la credencial verificable trae `url`, `identifier` y `expires`). No hay `dateModified`.
2. Con `lang=en` los textos de `name`, `description`, `jobTitle` y las credenciales están en inglés e `inLanguage` es `en`. Con `via` y `src` el bloque es idéntico al del paso 1.
3. El `@id` y la `url` del `Person` son los mismos en los dos (la home).
4. Ninguna de las dos respuestas tiene `application/ld+json` ni el título del perfil; `robots` es `noindex, nofollow`.
5. Hay un solo `<script type="application/ld+json">` y la consola no muestra errores ni violaciones de CSP. El validador no informa errores y detecta `ProfilePage` y `Person`.
6. La prueba detecta **Página de perfil** (*Profile page*) sin errores. Las advertencias por campos recomendados (`dateModified`, `image`) son esperables (P1 de `design.md`).
7. Sin errores; los dos `Person` tienen el mismo `@id`.

**Errores típicos:** si el bloque no aparece, el borde entregó el head de fallback (API caída o lenta, ver *Qué falla y por qué*): el sitio sigue funcionando y la SPA escribe el bloque al cargar, pero los validadores que no ejecutan JavaScript no lo ven. Un perfil `PROTECTED`, `PRIVATE`, archivado o inexistente nunca tiene bloque, y es a propósito. Si cambiaste un texto y el bloque sigue con el anterior, esperá un minuto (caché del head). Google tarda días en reflejar los datos estructurados en los resultados: el Rich Results Test es la comprobación inmediata.

**Por la API:**

```text
GET /api/public/profile-head?slug=ejemplo-backend          -> 200, <script type="application/ld+json"> con "@type":"ProfilePage"
GET /api/public/profile-head?slug=ejemplo-backend&lang=en  -> "inLanguage":"en"
GET /api/public/profile-head?slug=<protegido>&token=<tok>  -> genérico, noindex, sin ld+json
GET /api/public/profile-head?slug=no-existe                -> genérico, igual al de un PRIVATE
```

**Captura:** ninguna; la evidencia es la transcripción del bloque y la salida de los validadores.

## Notas de la implementación

- **Manual: 43 casos en esta rama.** `main` trae 42 casos y 46 imágenes; el PR #46 (abierto) suma TC-43 y una captura. TC-44 se escribió como si TC-43 existiera y no se numeró nada como TC-43, así que `manual:check` cuenta **43 casos** acá (42 + TC-44) y **46 imágenes**. Al fusionar `main` después del #46 el total pasa a 44 casos y 47 imágenes; los textos de resumen del § 6 (`Último caso ejecutado`, `Pasan los 42 casos anteriores`) y la tabla de la suite van a tener conflicto textual con los del #46 y se resuelven a mano.
- **`jsonLd` ausente con `noindex` también en el servidor.** `headMetaFromProfile` devuelve `jsonLd: undefined` cuando la página es `noindex` (como el cliente), para que el fixture afirme la misma ausencia de los dos lados. `renderProfileHead` conserva su condición `jsonLd && !noindex`.
- **`design.md` D8 reparado.** El texto de la lista de reemplazos de `safeJson` había perdido las secuencias `\uXXXX` (decía «`<` por `<`»); se restauraron. P1 quedó registrada como resuelta con la opción A.
- **Fixture.** 7 casos: los 3 existentes con `sections`, `skillCategories`, `education`, `certifications` y `socialLinks`, y 4 nuevos (perfil rico con 70 skills, secciones ocultas, `PROTECTED` y escape). Los `expected` están escritos a mano en el generador, no salen del código de producción.
- **PROTECTED con token en el navegador:** no se abrió (el token no se tipea ni se imprime); lo cubren el test unitario del cliente y el paso 4 por `curl`.
- **Flaky.** Una corrida de `npm test` del frontend, hecha con la máquina cargada, dio 1 test fallido; las dos siguientes, 972 de 972.
