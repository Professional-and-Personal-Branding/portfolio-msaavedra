# Borrador del caso del manual — TC-54

> Borrador para `docs/MANUAL.md` (tarea 11.1). TC-53 lo reserva `polish-pre-deploy-cleanup`. El «Observado» se completa con `verification/10.1-tc54.md`.

### TC-54 — Ver el gasto de IA y probar la conexión 🔍

**Precondición:** base de ejemplo **descartable** (nunca `portfolio`) sembrada con `npm run seed:example`, la API con **`AI_PROVIDER=fake`** (responde sin red y sin clave; el arranque lo prohíbe con `NODE_ENV=production`), el frontend levantado (de preferencia la imagen de `frontend/Dockerfile`) y una sesión del panel. Los pasos 1 a 7 no llaman a Anthropic ni gastan; el paso 8 pide una clave real y gasta unos centavos de dólar.

**Pasos:**
1. Con la API arrancada **sin** variables `AI_*`, abrí `/admin/integraciones` y bajá hasta **Inteligencia artificial**.
2. Arrancá la API con `AI_ENABLED=true` y `AI_PROVIDER=anthropic`, **sin** `ANTHROPIC_API_KEY`.
3. Arrancala con `AI_ENABLED=true` y `AI_PROVIDER=fake`. Recargá la pantalla.
4. Pulsá **Probar conexión** y confirmá.
5. Pulsá **Probar conexión** otra vez y confirmá.
6. Reiniciá la API con `AI_MONTHLY_BUDGET_USD=0`, recargá la pantalla y abrí el Dashboard.
7. Reiniciala con `AI_MONTHLY_BUDGET_USD=10` y `AI_FAKE_SCENARIO=spend-limit-tier`, pulsá **Probar conexión** y recargá.
8. Con la base real del owner, `AI_PROVIDER=anthropic` y una clave real en un workspace con spend limit: **Probar conexión**.

**Resultado esperado:**
1. El bloque dice «La IA está apagada. Se enciende con la variable `AI_ENABLED` del servidor.», sin **Probar conexión**. La barra del panel no tiene un ítem de IA.
2. La API **no arranca**: el error nombra `ANTHROPIC_API_KEY` y no imprime ningún valor.
3. El bloque dice «Activa», «Gastado 0,00 de 10,00 USD en {mes} (0 %)», la fecha de verificación de precios (17 de noviembre de 2026) y ninguna corrida.
4. La confirmación decía «Proveedor de prueba: no llama a Anthropic.». La tabla suma una corrida `ai.smoke` v1 con `claude-haiku-5-5`, **Exitosa**, sus tokens, su costo (fracciones de centavo) y su duración; el gastado sube por ese costo.
5. La segunda corrida también es **Exitosa** con su propio costo: **Probar conexión** no usa la caché, para probar la conexión de verdad.
6. El bloque dice «Se alcanzó el tope de IA del mes» con **Probar conexión** deshabilitado, y el Dashboard muestra «La IA alcanzó el tope del mes» con el enlace a Integraciones.
7. La corrida queda **Fallida** y el bloque dice «Anthropic cortó por el spend limit hasta {1.º del mes siguiente, 00:00 UTC}»; un nuevo **Probar conexión** responde lo mismo sin sumar llamadas al proveedor.
8. La confirmación decía «Hace una llamada real a Anthropic (unos 0,0001 USD).»; la corrida es **Exitosa** y su costo coincide (al centavo de centavo) con el que muestra la Console de Anthropic para esa petición.

**Errores típicos:** «La IA está apagada»: falta `AI_ENABLED=true`. La API no arranca nombrando `ANTHROPIC_API_KEY`: falta la clave con el proveedor `anthropic`. «Anthropic rechazó la clave»: la clave se revocó o es de otra organización. «Anthropic cortó por el spend limit»: se llegó al límite de la Console o al tope del tier; esperá a la fecha indicada o subí el límite en la Console. «Hay demasiadas consultas de IA en curso»: esperá unos segundos (límite `AI_MAX_CONCURRENCY`). «Se alcanzó el tope de IA del mes»: el gasto más lo reservado llegó a `AI_MONTHLY_BUDGET_USD`; se libera el día 1 a las 00:00 UTC.

**Por la API** (Bash; con la cookie de sesión del login en `s.jar` y la API con el proveedor `fake`):

```bash
API=http://localhost:3300
curl -s -b s.jar $API/api/admin/ai/usage | jq '{enabled, provider, state, budgetUsd, spentUsd, reservedUsd, pricingVerifiedAt}'
curl -s -b s.jar -X POST $API/api/admin/ai/smoke | jq '{task, model, status, costMicroUsd}'      # 201, SUCCEEDED
curl -s -b s.jar -X POST $API/api/admin/ai/smoke | jq '.status'                                   # "SUCCEEDED" otra vez: el humo no usa la caché
curl -s -b s.jar $API/api/admin/ai/usage | jq '.recentRuns | length'                              # 2
curl -s -X POST $API/api/admin/ai/smoke -o /dev/null -w '%{http_code}\n'                          # 401 sin sesión
```

**Observado:** _(completar con `verification/10.1-tc54.md`)_. **No se ejecuta en la verificación del change:** el paso 8 (ninguna llamada a Anthropic ni clave real). Por eso el caso queda en 🔍.
