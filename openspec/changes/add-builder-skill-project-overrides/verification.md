# Verificación — add-builder-skill-project-overrides

> Plan de verificación. Se completa al implementar, con la evidencia en `verification/`, como en `add-certification-verification`. Todas las escrituras van contra bases descartables (la de e2e y `portfolio_overrides_check`); la base `portfolio` del owner no se toca.

## Resultado por tarea

| Tarea | Qué se comprueba | Resultado | Evidencia |
|---|---|---|---|
| 1.1 Punto de partida | Suites verdes antes de tocar nada | pendiente | `verification/1.1-punto-de-partida.txt` |
| 2.1–2.2 Servicios puros | Include/exclude de skills y arreglo mixto, sin cambiar el código del núcleo | pendiente | specs en `domain/services/` |
| 3.1–3.3 Caso de uso y preview | Proyecto incluido y oculto, skills; preview igual a la ruta pública | pendiente | `verification/3.2-e2e.txt` |
| 4.1–4.4 Funciones puras | Exclusión mutua, huérfanos, buscador, universo de tags | pendiente | `selection-overrides.spec.ts` |
| 5.1–5.8 Constructor | Escenarios de `curated-profile-builder`; contrato y arranque público sin cambios | pendiente | tests de `curated-profiles/`, `verification/5.8-perf-budget.txt` |
| 6.1–6.3 App real | TC-43 y `a11y:check` con el panel | pendiente | `verification/6.2-tc43.txt`, `6.3-a11y.txt` |
| 7.1–7.5 Docs | TC-43, B10, TC-13, capturas, `manual:check` | pendiente (7.5 al archivar) | diff |
| 8.1–8.3 Cierre | Todo verde, validación estricta, sin diff en el backend | pendiente | `verification/8.1-cierre.txt`, `8.2-validacion.txt`, `8.3-alcance.txt` |

## TC-43 — Ajustar skills y proyectos de un perfil

Texto del caso para `docs/MANUAL.md` (sección 3, después de TC-13) y su espejo en `docs/manual/index.html`. Estado inicial al implementarlo: ✅ si se ejecuta completo en la app real (tarea 6.2).

**Precondición:** base de ejemplo, **descartable** (nunca `portfolio`: cada carga pública registra una visita), con la API y el frontend levantados (de preferencia la imagen de `frontend/Dockerfile`) y la sesión del panel iniciada en `/admin`.

**Pasos:**
1. `/admin/perfiles` → abrí **ejemplo-overrides** → pestaña **Selección**. Mirá los bloques **Experiencias**, **Skills** y **Proyectos** y el contador del preview.
2. En **Buscar skill** escribí `kot`. Después borrá el texto.
3. En **Kotlin** (categoría *Lenguajes*) pulsá **Excluir** para quitar la exclusión.
4. En **React** (categoría *Frontend*) pulsá **Incluir**.
5. En **Plataforma de Reservas** pulsá **Excluir**. Después pulsá **Incluir** en el mismo proyecto y otra vez **Incluir** para dejarlo sin override.
6. Volvé a pulsar **Excluir** en **Plataforma de Reservas**. Mirá la fila de **Prototipo en Pausa**.
7. Pulsá **Guardar**. En una **ventana privada**, abrí `/ejemplo-overrides` y mirá **Skills** y **Proyectos**.
8. Por la API, agregá un id inexistente a `excludeIds` del perfil (ver abajo) y recargá la ficha en el panel. Pulsá **Quitar** en el aviso y **Guardar**.

**Resultado esperado:**
1. **Kotlin** tiene **Excluir** presionado y el encabezado de *Lenguajes* indica «1 excluida». **Herramienta Interna de Métricas** tiene **Incluir** presionado. **Terracota Demo** y **Prototipo en Pausa** llevan la insignia de oculta/oculto. El preview dice «2 experiencias · 2 categorías · 2 proyectos».
2. Con `kot` solo se ve *Lenguajes* con **Kotlin**; el preview no se recalcula. Al borrar el texto vuelven todas las categorías.
3. **Excluir** de Kotlin deja de estar presionado y Kotlin aparece en *Lenguajes* en el preview; el contador no cambia.
4. El preview pasa a «3 categorías» y muestra *Frontend* solo con React.
5. Con **Excluir**, el preview pasa a «1 proyecto». Con **Incluir**, Excluir se apaga solo y vuelven los 2 proyectos. El segundo **Incluir** deja el proyecto sin override (sigue en el preview porque comparte tags).
6. El preview vuelve a «1 proyecto». **Prototipo en Pausa** tiene **Incluir** deshabilitado y explica que un proyecto oculto no entra aunque se lo incluya.
7. Se guarda sin errores. La vista pública muestra *Frontend* con React, *Lenguajes* con Kotlin y en **Proyectos** solo *Herramienta Interna de Métricas*. *Prototipo en Pausa* no aparece.
8. Al recargar, la pestaña dice «1 referencia a un ítem que ya no existe» y salir con **Volver** no pide confirmación. Después de **Quitar**, la ficha queda con cambios sin guardar; al guardar, `excludeIds` ya no tiene el id inexistente y conserva el de Plataforma de Reservas.

**Errores típicos:** buscar una categoría en **Buscar skill** (busca por nombre de skill, no de categoría). Esperar que **Incluir** reviva un ítem oculto: hay que marcarlo **Visible en el sitio** en su pantalla. Esperar que excluir una categoría entera exista: se excluyen sus skills una por una. Pulsar **Incluir** en un ítem excluido ya quita la exclusión: los dos botones no pueden quedar presionados a la vez.

**Por la API** (con la cookie de sesión de § 0; los ids salen de `GET /api/admin/skill-categories` y `GET /api/admin/projects`):

```text
PATCH /api/admin/curated-profiles/:id {"includeIds":["<id React>","<id Brújula>","<id Terracota>","<id Herramienta>"],
                                       "excludeIds":["<id Atlas>","<id Plataforma>","id-inexistente"]} -> 200
POST  /api/admin/curated-profiles/preview  (mismo borrador)  -> skillCategories con Frontend [React], projects sin Plataforma
GET   /api/curated-profiles/ejemplo-overrides               -> mismas experiences, skillCategories y projects que el preview
```

**Captura:** `manual/tc43-overrides.jpg` (bloques Skills y Proyectos de `ejemplo-overrides` con Kotlin excluida y el proyecto oculto), generada con `manual:capture` sobre la base de ejemplo.

## 6. App real: pasos de ejecución

1. **Base y servicios (6.1).** Crear `portfolio_overrides_check` en el contenedor local, `$env:DATABASE_URL` apuntando a ella en la misma sesión de PowerShell, `npm run prisma:status` (confirmar el nombre de la base), `npm run prisma:deploy`, `$env:SEED_DISPOSABLE_DB = "1"; npm run seed:example`, `npm run admin:bootstrap` con las credenciales de prueba de `.env.example`. API en un puerto libre y la imagen de `frontend/Dockerfile` apuntando a esa API, como en TC-42. Comprobar `GET /health` 200.
2. **TC-43 (6.2).** Chrome no headless: un contexto con la sesión del panel (iniciada por `fetch('/api/auth/login')`, sin escribir la contraseña en el navegador) para los pasos 1–6 y 8, y un contexto sin sesión para el 7. Registrar en `verification/6.2-tc43.txt`: el contador del preview tras cada paso, el cuerpo de cada `POST …/preview` y del `PATCH` (`includeIds`/`excludeIds`), `aria-pressed` y `disabled` de las filas de Kotlin, React, Plataforma de Reservas y Prototipo en Pausa leídos del DOM, el resultado público y la consola (sin errores). Si un contador difiere, anotar el observado y corregir el caso del manual.
3. **Equivalencia por API.** Con el perfil guardado, comparar `POST /api/admin/curated-profiles/preview` (mismo borrador) con `GET /api/curated-profiles/ejemplo-overrides`: `experiences`, `skillCategories` y `projects` idénticos.
4. **Accesibilidad (6.3).** `$env:A11Y_CHECK_DISPOSABLE_DB = "1"; $env:A11Y_CHECK_PROFILE = "ejemplo-backend"; npm run a11y:check -- <base>` con las variables del panel. Ninguna violación nueva en el constructor.
5. **Limpieza.** Borrar `portfolio_overrides_check`. Comprobar que `portfolio` no recibió escrituras y que no hay diff en `backend/src`, `backend/prisma` ni `backend/scripts` (8.3).
