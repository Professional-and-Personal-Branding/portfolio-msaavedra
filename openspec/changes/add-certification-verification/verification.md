# Verificación — add-certification-verification

> Verificación completada el 2026-10-29, con su evidencia en `verification/`, como en `add-share-links`. Todas las escrituras fueron contra bases descartables (`portfolio_cert_e2e`, `portfolio_cert_check`, `portfolio_cert_example`, `portfolio_cert_cv` y `portfolio_cert_shadow`); la base `portfolio` del owner no se tocó.

## Resultado por tarea

| Tarea | Qué se comprueba | Resultado | Evidencia |
|---|---|---|---|
| 1.1 Punto de partida | Suites verdes y tamaño del arranque antes de tocar nada | Backend 855 tests y 230 e2e, frontend 918, arranque 149,1 KB | `verification/1.1-punto-de-partida.txt` |
| 2.1–2.4 Dominio | `isHttpsUrl` y las reglas nuevas de `validateCertification` | OK | specs en `domain/` |
| 3.1–3.2 Esquema y migración | Solo `ADD COLUMN`; sin deriva entre schema y migración | OK: tres `ADD COLUMN`, `migrate diff` sin diferencias | `verification/3.1-migracion.sql` |
| 4.1–4.4 API | Los tres campos en la API pública, la vista curada y el panel; 400 con http, `javascript:`, relativa, ID largo y vencimiento anterior al año; `null` quita | OK: 14 e2e nuevos, 244 en total | `verification/4.4-e2e.txt` |
| 5.1–5.4 Seed y ejemplo | Seed por defecto idéntico; URL insegura en el archivo → código 1 sin borrar; `seed:example:verify` compara los campos | OK: código 1 con URL `http`, `verify` nombra el campo | `verification/5.4-seed.txt` |
| 6.1–6.7 Contrato y vista pública | `api.d.ts` sin deriva; «Ver credencial» con `rel="noopener noreferrer"`; vigencia con fecha fija; hoja con el enlace; `perf:budget` ≤ 155 KB | OK: arranque 149,7 KB (+0,6) | `verification/6.7-perf-budget.txt` |
| 7.1–7.3 Panel | Los cuatro mensajes literales; `null` al vaciar; aviso de cambios sin guardar | OK | tests de `formacion/` |
| 8.1–8.4 App real | TC-42, `print:check` con el ejemplo y con el CV, `a11y:check` | OK: TC-42 completo; `print:check` 20 y 56 casos en una página; `a11y:check` 0 violaciones en 50 cargas | `verification/8.2-tc42.txt`, `8.3-print-check.txt`, `8.4-a11y.txt` |
| 9.1–9.5 Docs | TC-42, B6, glosario, § 12.6, capturas, `manual:check` | 9.1 a 9.4 OK (42 casos, 46 capturas); 9.5 queda para el archivado | diff |
| 10.1–10.3 Cierre | Todo verde, validación estricta, base del owner intacta | OK (ver desvíos sobre la suite de frontend bajo carga) | `verification/10.1-cierre.txt`, `10.2-validacion.txt`, `10.3-base-del-owner.txt` |

## TC-42 — Verificar una certificación desde el sitio

Texto del caso para `docs/MANUAL.md` (sección 3, después de TC-26) y su espejo en `docs/manual/index.html`. Estado inicial al implementarlo: ✅ si se ejecuta completo en la app real (tarea 8.2).

**Precondición:** base de ejemplo, **descartable** (nunca `portfolio`: cada carga pública registra una visita), con la API y el frontend levantados (de preferencia la imagen de `frontend/Dockerfile`) y la sesión del panel iniciada en `/admin`.

**Pasos:**
1. `/admin/formacion` → **Certificaciones** → editar *Arquitecto de Soluciones en la Nube*. En **Enlace de verificación** escribí `http://example.org/credenciales/arquitecto-nube-2023` y pulsá **Guardar**.
2. Cambiá el enlace a `https://example.org/credenciales/arquitecto-nube-2023`. Comprobá que **ID de credencial** dice `EJ-2023-0042` y **Vence** `2029-06`, y guardá.
3. En **Vence** de *Liderazgo técnico para equipos de ingeniería* escribí `12/2025` y guardá; corregilo a `2025-12` y guardá.
4. En una **ventana privada**, abrí `/` y bajá a **Certificaciones**.
5. Pulsá **Ver credencial** en *Arquitecto de Soluciones en la Nube*.
6. Abrí `/?lang=en` y mirá la misma sección.
7. Volvé a `/` y pulsá **Imprimir / Guardar PDF** → **Guardar como PDF**. En el PDF, hacé clic en **Ver credencial**.
8. En el panel, borrá el texto de **Enlace de verificación** de esa certificación, guardá y recargá `/` en la ventana privada.

**Resultado esperado:**
1. El campo muestra «Usá una URL completa que empiece con https://» y no se guarda nada.
2. Se guarda; la lista no cambia.
3. Primero «Usá el formato AAAA-MM o AAAA»; con `2025-12`, se guarda.
4. *Arquitecto de Soluciones en la Nube* muestra `ID: EJ-2023-0042`, «Válida hasta» con junio de 2029 y el enlace **Ver credencial**. *Liderazgo técnico…* muestra **Vencida** y no tiene enlace. La certificación oculta no aparece.
5. Se abre una pestaña nueva en `https://example.org/credenciales/arquitecto-nube-2023`. El enlace tiene `rel="noopener noreferrer"`.
6. Las etiquetas dicen **View credential**, **Valid until** y **Expired**; la URL es la misma.
7. La hoja ocupa una página. En el bloque de certificaciones se lee «Ver credencial» junto a la primera y «vencida» en el paréntesis de la segunda; la URL de la credencial no está impresa. El clic en el PDF abre la URL.
8. La tarjeta vuelve a mostrar solo nombre, emisor, año, ID y vigencia, sin enlace.

**Errores típicos:** el enlace se rechaza por empezar con `http://` (solo se aceptan enlaces `https://`) o por faltarle el protocolo (`example.org/…`). «Vencida» depende de la fecha de tu equipo: el sitio no consulta al emisor, que es quien dice si la credencial sigue vigente. Para sacar una certificación vencida del sitio, desmarcá **Visible en el sitio**. El sitio no comprueba que el enlace funcione: abrilo después de cargarlo.

**Por la API** (con la cookie de sesión de § 0):

```text
PATCH /api/admin/certifications/:id {"verificationUrl":"http://example.org/c/1"}  -> 400
PATCH /api/admin/certifications/:id {"verificationUrl":"https://example.org/c/1"} -> 200
GET   /api/certifications                     -> verificationUrl, credentialId, expiresAt (sin campo expired)
PATCH /api/admin/certifications/:id {"verificationUrl":null}                      -> 200, enlace en null
```

**Captura:** `manual/tc42-credencial.jpg` (sección pública con «Ver credencial» y «Vencida»), generada con `manual:capture` sobre la base de ejemplo.

## 8. App real: pasos de ejecución

1. **Base y servicios (8.1).** Crear `portfolio_cert_check` en el contenedor local, `$env:DATABASE_URL` apuntando a ella en la misma sesión de PowerShell, `npm run prisma:status` (confirmar el nombre de la base), `npm run prisma:deploy`, `$env:SEED_DISPOSABLE_DB = "1"; npm run seed:example`, `npm run admin:bootstrap` con las credenciales de prueba de `.env.example`. API en un puerto libre (`PORT=3332`) y la imagen de `frontend/Dockerfile` apuntando a esa API, como en TC-35. Comprobar `GET /health` 200.
2. **TC-42 (8.2).** Chrome no headless: un contexto con la sesión del panel (iniciada por `fetch('/api/auth/login')`, sin escribir la contraseña en el navegador) para los pasos 1–3 y 8, y un contexto sin sesión para 4–7. Registrar en `verification/8.2-tc42.txt`: los mensajes de error del diálogo, el `href`, `target` y `rel` del enlace leídos del DOM, el nombre accesible de cada enlace, los textos en `es` y en `en`, el estado de las peticiones `PATCH` y la consola (sin violaciones de CSP ni errores).
3. **Hoja (8.3).** `$env:PRINT_CHECK_DISPOSABLE_DB = "1"; npm run print:check` contra la imagen sobre `portfolio_cert_check`, y otra vez sobre una base descartable sembrada con `docs/cv-data.json` (`npm run seed` sobre base vacía). Las dos salen con código 0. Abrir el PDF de `/` y comprobar que «Ver credencial» es un enlace a la URL del ejemplo.
4. **Accesibilidad (8.4).** `$env:A11Y_CHECK_DISPOSABLE_DB = "1"; $env:A11Y_CHECK_PROFILE = "ejemplo-backend"; npm run a11y:check -- <base>` con las variables del panel. Comparar con la corrida de `add-share-links`: ninguna violación nueva en `#certifications` ni en el diálogo de formación.
5. **Limpieza.** Borrar `portfolio_cert_check` y la base del CV usada en 8.3. Comprobar que `portfolio` sigue sin la migración nueva (10.3).

## Desvíos y pendientes

- **Bases.** Para la app real se usaron dos: `portfolio_cert_example` (ejemplo: TC-42, `print:check` y `a11y:check`) y `portfolio_cert_cv` (CV: `print:check`); `portfolio_cert_check` quedó para generar la migración. API en 3341 y 3342 y la imagen de `frontend/Dockerfile` en 8095 y 8096.
- **TC-42, pasos 1 y 3.** La base de ejemplo ya trae el enlace, el ID y el vencimiento, así que el valor se reemplaza (el manual dice «reemplazá el texto») en lugar de escribirse sobre un campo vacío.
- **Seed por defecto.** `seed-runner.ts` escribe los tres campos solo si la fuente los trae, para que las llamadas con `cv-data.json` sigan idénticas a la instantánea del test de retrocompatibilidad; en la base el resultado es el mismo (columnas en NULL).
- **Panel.** `isHttpsUrl` del panel exige además un dominio con punto, para no aceptar `https://localhost`, que el `@IsUrl` del backend rechaza. `TextField` asocia ayuda y error con `aria-describedby` en todos los campos del diálogo, no solo en los nuevos.
- **`a11y:check`** no abre el diálogo de certificación: los campos nuevos se cubren con tests y con el recorrido de TC-42.
- **Suite de frontend bajo carga.** Con la API, Chrome y los contenedores levantados, 4 tests de tiempo (`CuratedProfilePage`, `CuratedProfileView.staged`, `ProfileBuilderPage`, `ShareLinks`) vencieron; solos pasan (108) y, con todo bajado, la suite completa dio 960 verdes.
- **`seed:verify` sobre la base de e2e** informa `ProfileView` por las visitas de los e2e: es esperable; el CI lo corre antes de ellos.
- **10.3.** La base `portfolio` no se consultó: ningún comando corrió contra ella (ver la nota).
- **9.5** (línea del roadmap en `CLAUDE.md`) queda para el archivado.

Pendiente para el owner desde ya: aplicar la migración a `portfolio` con `npm run prisma:migrate` cuando actualice, y cargar los enlaces reales de sus certificaciones desde `/admin/formacion` (ítem 0.3 de la Fase 1.0.x).
