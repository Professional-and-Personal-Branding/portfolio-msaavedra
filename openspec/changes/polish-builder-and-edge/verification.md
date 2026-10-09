# Verificación — polish-builder-and-edge

Ejecutada el 8 de octubre de 2026 sobre la rama `feat/polish-1-1`, con la base local `portfolio` (Postgres en el 5434). Transcripciones en [`verification/`](verification/).

## Automatizado (6.4, 6.6)

| Comando | Resultado |
|---|---|
| backend `npm run lint`, `typecheck`, `build` | limpios |
| backend `npm test` | 76 suites, 532 tests en verde |
| backend `npm run test:e2e` | 164 tests en verde (ver el desvío del orden de idiomas) |
| backend `openapi:export` | idempotente sobre el `openapi.json` del change |
| frontend `npm run lint`, `npm test`, `npm run build` | limpios; 34 archivos y 241 tests en verde |
| `openspec validate polish-builder-and-edge --strict` y `validate --all --strict` (1.14.1) | válido; 32 de 32, sin avisos *Archive would refuse* ([`6.6-validate.txt`](verification/6.6-validate.txt)) |

## Por criterio

| Criterio | Evidencia |
|---|---|
| El constructor y la Portada piden confirmación al salir con cambios; la query y el idioma del preview no cuentan | `use-unsaved-changes-guard.test.tsx`, `ProfileBuilderPage.test.tsx`, `PortadaPage.test.tsx`; app real (TC-28), captura [`6.5-tc28`](verification/6.5-tc28-constructor-con-cambios.jpg) |
| El aviso de página y el de diálogo dicen cada uno su texto | `use-unsaved-changes-guard.test.tsx` («de esta página») y `use-dialog-discard-guard.test.tsx` («de este formulario») |
| Los formularios en diálogo avisan con *Escape*, clic fuera, X y *Cancelar*; sin cambios cierran directo; guardar no pregunta | `use-dialog-discard-guard.test.tsx` y un test por formulario (7.4); app real (TC-30, *Escape*), captura [`6.5-tc30`](verification/6.5-tc30-dialogo-con-cambios.jpg) |
| La visita se registra en segundo plano, sin perder atomicidad ni visitas al apagar | e2e de *Todo o nada* y del apagado (3.6, 3.7) |
| La latencia de `GET /api/curated-profiles/all` no sube | [`3.9-latencia.txt`](verification/3.9-latencia.txt): p95 22,0 → 21,4 ms, p99 30,3 → 23,5 ms; las 220 visitas de prueba se registraron y se borraron |
| La CSP se emite en el HTML y no en la API; `CSP_HEADER` cambia el modo | [`4.1-validate-fmt.txt`](verification/4.1-validate-fmt.txt), [`4.2-sin-inline.txt`](verification/4.2-sin-inline.txt), [`4.3-cabeceras.txt`](verification/4.3-cabeceras.txt) |
| El panel no envía `accentColor` | app real: el cuerpo del `POST` del preview tenía 17 claves y ninguna era `accentColor` |

## App real

Contra el contenedor de `frontend/Dockerfile` en el puerto 8099, con la API de la rama detrás (4.4 y 6.5):

1. **CSP.** La cabecera `Content-Security-Policy` está en `/tech-lead-dotnet`. El perfil cargó con el head insertado (título «Tech Lead .NET · Manuel Joaquín Saavedra Severiche»), el JSON-LD presente y la fuente Inter cargada. `/` con `?lang=en&theme=elegant&layout=sidebar`, `/admin` (7 secciones, 3 barras, estilo de sonner aplicado) y `/admin/skills`: cero errores en consola y cero eventos `securitypolicyviolation`.
2. **TC-28.** Se editó el título de `tech-lead-dotnet`; *Volver* abrió «Tenés cambios sin guardar» sin salir de la página; *Salir sin guardar* llevó a `/admin/perfiles` y el título guardado siguió «Tech Lead .NET».
3. **TC-30.** Skills → Nueva categoría → nombre escrito → *Escape* abrió el aviso con el formulario abierto detrás; *Descartar* cerró sin crear la categoría.
4. **`accentColor` (D9).** Interceptando `fetch`, el cuerpo del `POST` del preview no traía `accentColor`.

## Ampliación de la verificación en la app real

Contra el contenedor de `frontend/Dockerfile` (puerto 8099, CSP en modo bloqueo) con la API de la rama en el 3300, el 8 de octubre de 2026.

**4.4, CSP en el navegador**
- En `/no-existe-esta-ruta` (404 propio, «Profile not found») se inyectó un `<script>` inline y otro con `src` `https://example.com/evil.js`: dos eventos `securitypolicyviolation` con `script-src-elem` (`blockedURI` «inline» y «https://example.com/evil.js»); el inline no se ejecutó (`window.__inlineRan` siguió en `false`).
- Embeber `/tech-lead-dotnet` en un `iframe` fue bloqueado por `frame-ancestors 'none'` (mensaje en consola) y el `contentDocument` quedó inaccesible.
- El login no hizo falta (había sesión) y el panel cargó completo bajo la política. El `<style>` de sonner está presente y aplicado en el dashboard.

**6.5**
- **TC-29** (Portada): se editó la Ubicación; cambiar el idioma de la vista previa (EN y de vuelta a ES) no abrió el aviso y la edición se conservó; ir a Skills abrió «Tenés cambios sin guardar»; *Salir sin guardar* llevó a `/admin/skills` y la ubicación guardada siguió «Santa Cruz de la Sierra, Bolivia». Captura [`6.5-tc29`](verification/6.5-tc29-portada-con-cambios.jpg).
- **Visita fuera del camino crítico:** `GET /api/curated-profiles/tech-lead-dotnet` respondió 200 en 16,4 ms; a los 500 ms las `views` del perfil pasaron de 203 a 204 y el total de hoy de 224 a 225.
- **Alta de un perfil nuevo** (`/admin/perfiles/nuevo`, slug y título, Guardar): navegó a `/admin/perfiles/<id>` sin abrir el aviso; el perfil de prueba se borró (DELETE 204).
- **Orden de idiomas** tras el arreglo: `/api/profile` devuelve `['Español', 'Inglés']`.

## Lo que no se ejecutó en la app real

- El diálogo nativo de `beforeunload` (lo dibuja el navegador): queda cubierto por los tests del guardián.
- En TC-30 se probó *Escape* y *Descartar*; la X, el clic fuera y *Cancelar* los cubre el test del guardián. Tampoco hay test directo, en su propia página, de «clic fuera» en el formulario de skill ni de «guardar un proyecto editado cierra sin aviso».
- 4.4: el cambio de un token en el constructor con guardado y toast (se comprobó que el estilo de sonner está presente y aplicado).

## Hallazgo fuera de alcance (preexistente en `main`)

En `/admin/perfiles/nuevo` el preview muestra «No se pudo generar la vista previa: slug must be kebab-case» hasta que se escribe un slug, porque `toProfileBody` envía `slug: ''`.

## Desvíos respecto de los artefactos

- **Orden de los idiomas del perfil público (defecto previo, corregido).** Al correr el e2e fallaron «perfil en español» y «perfil en inglés»: `PrismaProfileRepository.findOne()` y `save()` hacían `include: { languages: true }` sin `orderBy`, así que el perfil público devolvía los idiomas en el orden físico de Postgres, mientras que el listado del panel (`PrismaLanguageRepository.findAll`) ya ordenaba por `id`. Ahora ambos usan `include: { languages: { orderBy: { id: 'asc' } } }` (el `cuid` sigue el orden de creación). Lo fija el e2e existente. No se tocó la base ni el seed.
- **Texto del aviso.** `UnsavedChangesPrompt` mostraba «Si salís ahora, se descartan los cambios de esta página.» también dentro de un formulario en diálogo. Ahora tiene una prop `description` con ese texto por defecto, y `useDialogDiscardGuard` pasa «Si lo cerrás ahora, se descartan los cambios de este formulario.». El constructor y la Portada no cambian.
- **TC-29.** `tasks.md` 6.1 define TC-29 como el aviso de la Portada; el manual y la guía interactiva lo recogen así, ya ejecutado en la app real. La CSP y el drenaje al apagar van en § 5 *Operación*.
