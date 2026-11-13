# Verificación y desvíos — add-integrations-foundation

Implementado el 12 de noviembre de 2026 sobre `feat/integrations-foundation`, con el ajuste **D25** (la pantalla no suma un ítem a la barra). Bases usadas: `portfolio_integ_e2e` (e2e y unitarios, migrada y sembrada) y `portfolio_integ_check` (migración, rekey, CLI y app real, sembrada con el ejemplo), ambas descartables, dentro de `portfolio-postgres`; la base `portfolio` del owner no se tocó.

## Desvíos y decisiones de implementación

Ninguno cambia una decisión de arquitectura; se listan para que el arquitecto los revise.

1. **Resuelto (D11 enmendado, 2026-11-12):** el secreto de un proveedor ya no se exige al arrancar; `requiredEnv` pasó a `secretEnv` opcional. TC-49 recorre el formulario en un arranque normal sin `FAKE_PROVIDER_TOKEN` (ver `10.1-tc49.txt`); los e2e de la base arrancan sin la variable y el caso «con variable → env / 422» la define explícitamente.
2. **`cron` se importa directamente** (`CronJob.from`, `validateCronExpression`) aunque no figura en `package.json`: es la dependencia transitiva 4.4.0 de `@nestjs/schedule@~6.1.3`, que `SchedulerRegistry.addCronJob` exige. No se agregó ninguna dependencia a `package.json` salvo `@nestjs/schedule`.
3. **El CI de `backend-e2e` suma `npm run build`** antes de `npm run test:e2e`: `integrations-env.e2e-spec.ts` (7.6) arranca `node dist/main` como proceso hijo y en ese job no había build.
4. **`integrations-rekey` es un e2e** (`test/integrations-rekey.e2e-spec.ts`), no `test/integrations-rekey.spec.ts`: el `testRegex` del Jest unitario lista los archivos de `test/` uno por uno y el test necesita la base de e2e.
5. **`SKIP LOCKED` (7.1a):** no se fija `statement_timeout` en la sesión (el reclamo corre en otra conexión del pool); la espera se corta con una carrera de 5 s y un timeout de 15 s de la transacción, que hacen fallar el test en vez de colgarlo.
6. **Retención (D23):** además de los `DONE` de más de 30 días, se borran los `DEAD` de más de 90 días y las `SyncRun` de más de 90 días (el texto dice que `DEAD` se conserva 90 días).
7. **`SyncRun` suma un índice por `jobId`** (la FK con cascada lo necesita para borrar sin recorrer la tabla); está en la migración y en `verification/3.1-migracion.sql`.
8. **El CLI `integrations:sync` corre con `ts-node --transpile-only`**, no con `tsx`: esbuild no emite `design:paramtypes` y la inyección de Nest lo necesita (igual que `openapi:export`). La configuración inválida sale con 2 (import dinámico de `AppModule` y `abortOnError: false`); un argumento desconocido también sale con 2.
9. **Bloque «Integraciones» de Cuenta después de «Cambiar contraseña»**, no antes: así la captura `bo-cuenta` (que muestra «Las contraseñas no coinciden» en la parte baja de la pantalla) sigue mostrando lo que el manual describe y no hubo que regenerarla.
10. **El Dashboard consulta `GET /api/admin/integrations`** para el aviso (D25) con la misma consulta que la pantalla, sin refresco automático; el handler por defecto de `msw-admin.ts` devuelve «sin proveedores».
11. **`a11y:check` en el CI** corre con la API en `NODE_ENV=production`, donde `fake` está prohibido: ahí audita `/admin/integraciones` en el estado «No hay integraciones habilitadas». La tarjeta y el error de credencial vacía se auditaron en local (10.2) con la API de desarrollo.
12. **7.4 «verde en el CI»** no se pudo comprobar: no se hizo push. Los umbrales tienen mucho margen sobre lo medido (ver `7.4-latencia.txt`).
13. **Mensaje de un id desconocido en `INTEGRATIONS_ENABLED`:** nombra la variable y los ids válidos, no el valor recibido (la spec pide no imprimir el valor).
14. (Resuelto) La captura y el a11y se regeneraron con la imagen actual.
16. **Test de latencia (D22) más robusto, sin tocar los umbrales.** El trabajo lento dura ~6 s en 60 pasos (D22 dice ~3 s en 30) para que las 40 muestras terminen siempre con el trabajo en curso, y la medición admite hasta 3 intentos: con la máquina cargada por otros agentes se vieron una suite con la ventana vencida y un p99 del event loop de 94 ms con las peticiones en 8 ms (pausas del sistema). Un bloqueo real falla los 3 intentos.
15. **Frontend bajo carga:** los archivos `CuratedProfileView.staged`, `CuratedProfilePage`, `ProfileBuilderPage` y `ShareLinks` fallan por timeout solo cuando corre la suite completa con otros agentes activos; aislados pasan (también fallaban en la línea de base, ver `1.1-punto-de-partida.txt`).

## Estado de las tareas que dependen de otros pasos

- **12.4** (línea del roadmap y comandos en `CLAUDE.md`) queda para el archivado: no se archivó el change.
- **12.3:** ver `12.3-bases.txt`.
