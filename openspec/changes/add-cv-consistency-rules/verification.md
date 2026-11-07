# Verificación — add-cv-consistency-rules

> Plan de verificación del change. Se completa al implementarlo, con la evidencia en `verification/`. Ninguna tarea escribe en `portfolio` (la base del owner): la app real corre contra `portfolio_lint_check`, descartable, sembrada con el ejemplo y borrada al terminar.

## Resultado por tarea

| Tarea | Qué se comprueba | Resultado | Evidencia |
|---|---|---|---|
| 1.1 Punto de partida | Suites verdes antes de tocar nada; no hay `computeYearsOfExperience` ni `fast-check` | pendiente | `verification/1.1-punto-de-partida.txt` |
| 2.1–2.4 Cálculo de años | Meses inclusivos, fusión, actual hasta `asOf`; propiedades 1 a 4; la mutación de meses exclusivos se detecta | pendiente | specs de `profile/domain/services`, `verification/2.4-mutacion.txt` |
| 3.1–3.6 Dominio del linter | Predicado de traducción compartido sin cambiar expectativas; 14 códigos; el 100 % de los sembrados; cruce con los validadores; propiedad 5; errores iguales con dos `asOf` | pendiente | `verification/3.4-sembrados.txt` |
| 4.1–4.5 Aplicación y API | Una consulta por repositorio, sin escrituras; orden; locale; 401 sin sesión; `no-store`; conteos de tablas intactos | pendiente | `verification/4.5-e2e.txt` |
| 5.1–5.4 `cv:lint` y CI | Códigos 0, 1 y 2; sin base; los dos JSON dan 0; pasos en el CI | pendiente | `verification/5.3-cv-lint.txt` |
| 6.1–6.5 Contrato y panel | Sin deriva de `api.d.ts`; `?editar=` en cuatro pantallas; pantalla Revisión; axe; `perf:budget` igual | pendiente | `verification/6.5-perf-budget.txt` |
| 7.1–7.3 Calidad | Todo verde; `fast-check` fuera de `dist/` | pendiente | `verification/7.1-backend.txt`, `7.2-frontend.txt`, `7.3-dev-only.txt` |
| 8.1–8.3 App real | TC-47 completo; captura; `a11y:check` con `/admin/revision` | pendiente | `verification/8.1-entorno.txt`, `8.2-tc47.txt`, `8.3-a11y.txt` |
| 9.1–9.4 Docs y cierre | B15, TC-47, `manual:check`, validación estricta | pendiente | `verification/9.3-validacion.txt` |

## Criterios de aceptación de la propuesta (§ 6.2)

| Criterio | Cómo se demuestra |
|---|---|
| «Fast-check: ningún "años con X" contradice las fechas» | Propiedades 1 a 4 de D14 sobre `computeYearsOfExperience`, incluida la monotonía de subconjuntos (tarea 2.4), y la propiedad 5 sobre la regla de años (tarea 3.6). |
| «`Profile.yearsOfExperience` se contrasta con `computeYearsOfExperience`» (pregunta 20 = A) | Regla `profile.years-mismatch` (D3), tareas 3.3 y 3.6; con `cv-data.json` da 10 contra 8 años y 7 meses (tarea 5.3). |
| «El 100 % de los errores sembrados se detecta» | `cv-rules.seeded.spec.ts` recorre los 14 códigos de `CvIssueCode` y falla si alguno no tiene mutación o no se detecta (tarea 3.4). |

## TC-47 — Revisar la consistencia del CV

Texto del caso para `docs/MANUAL.md` (sección 3, al final de los casos del backoffice) y su espejo en `docs/manual/index.html`. Estado inicial al implementarlo: ✅ si se ejecuta completo en la app real (tarea 8.2); 🔍 si falta algún paso.

**Precondición:** base de ejemplo **descartable** (`portfolio_lint_check`, nunca `portfolio`) sembrada con `npm run seed:example`, con la API y el frontend levantados (de preferencia la imagen de `frontend/Dockerfile`) y una sesión de administrador. El ejemplo declara 11 años y sus experiencias van de 2015-01 al mes actual (`cobalto` es actual): en noviembre de 2026 suman 143 meses (11 años y 11 meses) y no hay aviso de años; desde diciembre de 2026 suman 12 años o más y el aviso aparece desde el paso 1, lo que también es correcto. Tiene una certificación vencida (`2025-12`).

**Pasos (panel):**
1. Entrá a `/admin` y pulsá **Revisión** en el menú lateral.
2. Mirá el resumen y el bloque **Sugerencias**.
3. En **Portada**, cambiá los años de experiencia a `15` y guardá. Volvé a **Revisión** y pulsá **Volver a revisar**.
4. En el hallazgo de años, pulsá **Abrir**.
5. Volvé a poner `11` en **Portada**, guardá y volvé a **Revisión**.
6. En **Experiencias**, editá una experiencia visible: borrá el **Resumen (EN)** y guardá. Volvé a **Revisión**.
7. En ese hallazgo, pulsá **Abrir**.
8. Restaurá el resumen en inglés, guardá y volvé a **Revisión**.
9. Abrí a mano `/admin/formacion?editar=inexistente`.

**Resultado esperado:**
1. Se abre `/admin/revision` con el ítem **Revisión** marcado como activo.
2. El resumen dice «0 errores · 0 avisos · 1 sugerencia» y «Experiencia: 11 años declarados; las fechas suman {años} años y {meses} meses», con los años y meses del mes actual (11 y 11 en noviembre de 2026; desde diciembre, «1 aviso» por los años). En **Sugerencias** está la certificación vencida, con «Venció en 2025-12: el sitio la muestra como «Vencida».».
3. Aparece el bloque **Avisos** con «Declarás 15 años de experiencia, pero las experiencias cargadas suman {años} años y {meses} meses.», con los mismos números del paso 2.
4. Se abre **Portada**.
5. El aviso de 15 años desaparece y el resumen vuelve al del paso 2.
6. Aparece en **Avisos** un hallazgo de esa experiencia: «Falta el texto en inglés de summary.».
7. Se abre **Experiencias** con el diálogo de edición de esa experiencia, y la URL ya no tiene `?editar=`.
8. El hallazgo desaparece y el resumen vuelve al del paso 2.
9. Aparece «El ítem ya no existe.» y no se abre ningún diálogo.

**Errores típicos:** si el resumen no cambia después de editar, pulsá **Volver a revisar** (la pantalla vuelve a pedir al entrar, pero no mientras está abierta). Un aviso de años con tus datos reales no es un error de la plataforma: `yearsOfExperience` se carga a mano y la revisión solo compara con las experiencias cargadas. Si falta experiencia anterior, cargala o ajustá el número. La revisión nunca corrige nada sola.

**Por la API** (Bash, con la cookie de sesión del login de § 0 en `jar`):

```bash
API=http://localhost:3300
curl -s -o /dev/null -w '%{http_code}\n' $API/api/admin/consistency                 # 401
curl -s -b jar $API/api/admin/consistency | node -e "
  const r=JSON.parse(require('fs').readFileSync(0,'utf8'));
  console.log(r.asOf, JSON.stringify(r.experience), JSON.stringify(r.summary));
  for (const i of r.issues) console.log(i.severity, i.code, i.entityType, i.entityId, '-', i.message);"
                                                                                  # 0 errores; certification.expired
curl -s -b jar "$API/api/admin/consistency?locale=en" | node -e "
  const r=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(r.issues[0].code, '|', r.issues[0].message);"
                                                                                  # mismo code, mensaje en inglés
curl -s -D - -o /dev/null -b jar $API/api/admin/consistency | grep -i cache-control  # no-store
```

**Por la línea de comandos** (sin base):

```bash
cd backend
npm run cv:lint; echo "salida: $?"                                                 # aviso de años (10 contra 8 años y 7 meses); salida: 0
npm run cv:lint -- --file ../docs/examples/cv-data.example.json; echo "salida: $?"  # sugerencia de vencida (y aviso de años desde 2026-12); salida: 0
node -e "const f=require('fs');const d=JSON.parse(f.readFileSync('../docs/examples/cv-data.example.json','utf8'));
  d.experiences[0].current=true; d.experiences[0].endDate='2024-05';
  f.writeFileSync(require('os').tmpdir()+'/cv-roto.json',JSON.stringify(d))"
npm run cv:lint -- --file "$(node -p "require('os').tmpdir()")/cv-roto.json"; echo "salida: $?"
                                                                                  # ERROR date.ongoing-with-end experience:<clave>; salida: 1
npm run cv:lint -- --file no-existe.json; echo "salida: $?"                        # salida: 2
```
