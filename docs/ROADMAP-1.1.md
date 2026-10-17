# ROADMAP 1.1 — Propuestas de funcionalidad y cómo se decidieron

> Registro de la deliberación multiagente del 4 de octubre de 2026 y el set de changes que propone para después del 1.0.0.
>
> **Estado: completada.** Los cinco changes del § 4 se implementaron y archivaron entre el 5 y el 8 de octubre de 2026 (`openspec/changes/archive/`), y hubo changes posteriores (§ 6). Lo que sigue se conserva como registro de cómo se decidió; del § 5 quedan diferidos `evidencia-verificable-repos`, `encabezado-de-ajuste`, `cobertura-de-vacante`, `skills-con-respaldo-temporal` y `cache-de-lectura-y-visitas`.
>
> Estado original: propuesta. Nada de esto se implementa sin el Human Gate. El orden de lectura es: § 1 cómo se decidió, § 2 qué salió, § 3 **la corrección**, § 4 el set final, § 5 lo diferido.

---

## 1. Cómo se decidió

Seis fases, 23 agentes, patrones distintos en cada una. La elección de patrón por fase no es decorativa: cada uno corrige una falla del anterior.

| Fase | Patrón | Agentes | Para qué |
|---|---|---|---|
| Explorar | **ReAct** — razonar, leer archivos reales, concluir | 3 lentes: producto, dominio, plataforma | Que las propuestas partan de hechos del repo y no de imaginación |
| Generar | **Divergencia forzada** — cada persona solo ve su ángulo | 5: reclutador, Manuel buscando, distribución, datos, plataforma | Que no converjan prematuramente en lo obvio |
| Evaluar | **Judgment con lentes incompatibles**; cada juez debe escribir su objeción más fuerte incluso cuando puntúa alto | 3: impacto, costo/riesgo, coherencia | Separar "me gusta" de "conviene" |
| Votar | **Voting independiente** + conteo **Borda** en código | 3: secuencia, valor inmediato, solidez | Que el orden no dependa de un solo criterio |
| Reflexionar | **Completeness critic** + **crítico adversarial** cuya premisa es que el set es peor de lo que parece | 2 | Atacar el resultado, no admirarlo |
| Factibilidad | **ReAct por ganador** | 7 | Aterrizar en archivos, migraciones, requisitos SHALL y escenarios WHEN/THEN |

La deduplicación, la agregación de puntajes y el conteo Borda los hace **código, no agentes**: es aritmética, no juicio. Un candidato vetado por dos o más jueces sale antes de la votación.

**Qué falló, y se dice porque importa:** en la primera corrida los tres votantes murieron con un error de safeguards de la API (`[reasoning_extraction]`), probablemente por pedirles la cadena de pensamiento dentro de un campo estructurado. El ranking de esa corrida quedó determinado **solo por el promedio de los jueces**, con Borda 0 para todos, y es sobre ese ranking que trabajaron los dos críticos. El crítico adversarial detectó el hueco por su cuenta y lo usó como argumento, con razón: *"los promedios con un decimal proyectan una precisión que el procedimiento no tiene"*.

La fase se reescribió sin ese pedido y se volvió a correr reutilizando el prefijo cacheado: los tres votantes funcionaron y su resultado está en el § 2.2. La corrida se detuvo antes de re-ejecutar reflexión y factibilidad sobre el orden nuevo, porque las críticas ya habían cumplido su función y el orden nuevo **confirma** la corrección que proponían.

---

## 2. Qué produjo la deliberación

**29 candidatos únicos**, 2 vetados antes de votar:

| Vetado | Por |
|---|---|
| `registro-de-envios` — registro de envíos con link por destinatario | costo-riesgo + coherencia |
| `alcance-de-secciones` — qué sección nadie llega a ver | los tres jueces |

El top del ranking por promedio de jueces (impacto · costo-riesgo · coherencia):

| # | id | prom | Esfuerzo |
|---|---|---|---|
| 1 | `duplicar-perfil-curado` | 9.0 | S |
| 2 | `constructor-bilingue` | 8.7 | M |
| 3 | `encabezado-de-ajuste-90-segundos` | 8.3 | M |
| 4 | `perfil-dirigido-sin-vitrina` | 8.3 | S |
| 5 | `evidencia-verificable-repos` | 8.0 | M |
| 6 | `ciclo-de-vida-perfil-curado` | 7.7 | M |
| 7 | `imprimible-una-hoja` | 7.3 | S |
| 8–12 | `cobertura-de-vacante`, `link-aislado`, `skills-con-respaldo-temporal`, `portada-editable`, `head-seo-en-el-servidor` | 7.3–7.0 | M |

### 2.2 El voting, y por qué cambia la lectura

Tres votantes independientes, un criterio cada uno, conteo Borda (10 puntos al primero, 1 al décimo):

| Candidata | Borda | secuencia | valor inmediato | solidez | Puesto por jueces |
|---|---|---|---|---|---|
| `constructor-bilingue` | **29** | 1º | 2º | 1º | 2 |
| `duplicar-perfil-curado` | **23** | 5º | 3º | 2º | 1 |
| `perfil-dirigido-sin-vitrina` | **15** | 7º | 4º | 7º | 4 |
| `head-seo-en-el-servidor` | **13** | **3º** | 6º | — | **12** |
| `imprimible-una-hoja` | 13 | — | 5º | 4º | 7 |
| `encabezado-de-ajuste-90-segundos` | 12 | — | **1º** | 9º | 3 |
| `skills-con-respaldo-temporal` | 12 | — | 7º | 3º | 10 |
| `kernel-contenido-administrable` | 9 | **2º** | — | — | **27** |
| `seleccion-por-seccion` | 7 | 4º | — | — | 19 |
| `cobertura-de-vacante` | 7 | — | 10º | 5º | 8 |

Tres movimientos importan:

- **`head-seo-en-el-servidor` sube del 12º al 4º**, y el votante de secuencia lo pone tercero de todo el catálogo. Es la validación independiente de la promoción que pedían los críticos.
- **`kernel-contenido-administrable` sube del último puesto al 8º**, segundo para el votante de secuencia. Las tres lentes de los jueces lo habían hundido; el criterio de "qué habilita lo demás" lo rescata. Sostiene la promoción del contenido administrable.
- **`ciclo-de-vida-perfil-curado` cae del 6º al 12º mientras `duplicar-perfil-curado` se queda 2º.** Los votantes resolvieron solos la redundancia que marcaron los críticos: de las dos descripciones del mismo change, prefirieron la acotada.

Nada de esto cambia la **membresía** del set final, que la decidió la reflexión. Cambia la confianza: dos de las tres promociones que parecían ir contra el ranking tienen ahora un criterio explícito que las respalda.

---

## 3. La corrección — por qué ese set no se aprueba como salió

Los dos críticos llegaron por separado a **las mismas tres conclusiones**. Verifiqué sus afirmaciones de hecho una por una en el repositorio antes de aceptarlas, porque un crítico equivocado es peor que ninguno.

### 3.1 Hechos que los exploradores afirmaron y son falsos

| Afirmación | Verificado | Consecuencia |
|---|---|---|
| "`ExperienceForm` sobrescribe los logros sin inglés al guardar" | **FALSO.** `experience-form.ts:56` lee `highlights.en` y `:75` lo reenvía con `toLocalizedListPayload` | El hueco real es que **no se puede editar** `highlights.en` (solo existe `label="Logros (es)"`, `ExperienceForm.tsx:182`), no que se pierda. Esto era *toda* la justificación del puesto 2 |
| "`Experience.sector[]` no lo lee ningún componente del frontend" | **FALSO.** `ExperienceTimeline.tsx:46` lo renderiza en público y `ExperienceForm.tsx:203` lo edita | "Filtrar por sector es oro barato" ya no aplica: el campo está en uso |
| "`featuredRepositories` está vacío" | **Casi.** Tiene **1** entrada, y los **2** proyectos tienen `url` en blanco | Confirma el fondo: hoy no hay evidencia enlazable que mostrar |

Dos de los tres informes que alimentaron la votación contenían afirmaciones falsas. No se rankearon propuestas: se rankearon descripciones de propuestas. Por eso la reflexión manda sobre el ranking.

### 3.2 Defectos reales que la exploración sí encontró, y verifiqué

| Defecto | Evidencia |
|---|---|
| **El catálogo de secciones tiene dos fuentes de verdad y están desalineadas** | `backend/.../resolve-sections.ts:2` define `DEFAULT_SECTIONS` con **7** ids; `frontend/src/themes/layouts/sections.ts` define `KNOWN_SECTIONS` con **9** (`projects` y `presence` faltan en el backend). Un perfil sin `sectionsOrder` propio nunca las ordena: entran al final por el fallback del frontend |
| ✅ **El registro de visita está en el camino crítico** *(resuelto en `polish-builder-and-edge`: la visita corre en segundo plano y la respuesta no la espera)* | `resolve-curated-profile.use-case.ts:68` → `if (input.viewContext) await this.recordView(...)` antes del `return`. Protegido con try/catch, así que no rompe la respuesta, pero suma latencia a cada visita pública |
| **`referrer` y `userAgent` se persisten y nunca se leen** | Los graba `curated-profile.controller.ts:96-97`; `ProfileViewsResponse` solo expone `total`, `byProfile`, `byLocale`, `byDay`. No se puede saber de dónde llegó una visita |
| **El menú público delata la curaduría** | `TopBar.tsx:30` monta `ProfileMenu` siempre, también en `/:slug`: quien abre un perfil ve los otros doce hechos para otras vacantes |
| ✅ **El borrador del constructor se pierde sin aviso** *(resuelto en `polish-builder-and-edge`: aviso en el constructor, la Portada y los formularios en diálogo)* | Estado en `useState` sin `beforeunload` ni blocker de router |
| ✅ **`accentColor` es un campo fantasma** *(resuelto: etapa 1 en `polish-builder-and-edge` (D9) y retiro completo en `retire-accent-color`; el owner eligió P1 = B y el color de cada perfil pasó a `themeOverrides.colors.accent`)* | Viaja a la API desde `profile-draft.ts` pero ninguna pestaña lo edita: congelado en `#1A365D` |

### 3.3 Las dos cosas que el set ganador no tocaba

**a) El link compartido sigue roto, y es la razón de ser declarada del producto.** La spec ya aprobada `openspec/specs/public-seo/spec.md` abre con que el link *"tiene que decir quién es Manuel y para qué rol, tanto en un buscador como en la vista previa de un chat"*. Hoy los 13 perfiles se ven idénticos al pegarlos: `index.html` trae un título genérico y un `og:image` que apunta a un SVG. `head-seo-en-el-servidor` quedó 12º y `preview-de-link-compartible` fue vetado por costo-riesgo. Como dijo el crítico adversarial: *"cero de las siete ganadoras cambian lo que pasa cuando el link se comparte, que es la única rotura verificada del caso de uso principal"*.

**b) El "portafolio administrable" sigue sin ser administrable donde más se ve.** `openspec/specs/admin-content-management/spec.md` abre con "editar el contenido del portafolio sin tocar la base ni curl", y cubre experiencias y skills. El hero —titular, email, disponibilidad—, la educación, las certificaciones, los proyectos y los enlaces sociales solo se cambian por seed o SQL. `portada-editable` quedó 11º y `kernel-contenido-administrable` último, con 4.0.

> Precisión sobre una afirmación de los críticos: los dos dijeron que `kernel-contenido-administrable` fue "vetada por impacto". No lo fue. La lente de impacto la puso en su lista de descarte, pero el veto exige dos lentes y solo hubo una, así que la propuesta llegó a la votación y quedó última. Los únicos vetados fueron `registro-de-envios` y `alcance-de-secciones`. El fondo del reclamo sigue en pie; el mecanismo que describen, no.

### 3.4 Redundancias que los dos críticos marcaron

- `duplicar-perfil-curado` está **literalmente contenido** en `ciclo-de-vida-perfil-curado`. Puestos 1 y 6 son el mismo change.
- `perfil-dirigido-sin-vitrina` (4º), `link-aislado` (9º) e `indexabilidad-y-canonical-por-perfil` (15º) son la misma funcionalidad descrita por tres personas distintas.
- `constructor-bilingue` (2º) y `encabezado-de-ajuste` (3º) incluyen los dos el conmutador de idioma del preview.

---

## 4. El set final propuesto

Cinco changes, en este orden. La justificación de cada movimiento respecto del ranking crudo está en la última columna.

| # | Change | Capability | Esfuerzo | Migración | Por qué acá |
|---|---|---|---|---|---|
| **1** | `unify-section-catalog` | `layout-engine`, `curated-profile-resolution` | XS | No | Corrige un defecto verificado (7 vs 9) y es prerrequisito de cualquier sección nueva. Los dos críticos lo pidieron como change propio: es un refactor de contrato, no una funcionalidad |
| **2** | `add-server-rendered-head` | `public-seo` | M | No | **Promovido del 12º al 2º.** No es una funcionalidad nueva: completa el Purpose de una spec ya aprobada. Es lo único que cambia lo que ve alguien afuera |
| **3** | `add-curated-profile-lifecycle` | `admin-curated-profile-crud`, `curated-profile-resolution`, `public-curated-profile-api` | M | Sí | **Fusiona los puestos 1, 4, 6 y 9.** Duplicar, archivar, `listed` y alias de slug, con una sola tabla de verdad de resolución de ruta en vez de booleanos sueltos |
| **4** | `add-profile-content-admin` | `admin-content-management` | M | No | **Promovido del 11º.** Hace verdadero el nombre del producto. Todos los campos ya existen en el schema |
| **5** | `add-bilingual-builder-parity` | `admin-curated-profile-preview`, `admin-experience-crud` | S | No | **Reducido** a lo verificable: conmutador de idioma en el preview y `highlights.en` editable. Sin el arreglo de guardado, porque ese bug no existe |

### Cómo quedó cada ganadora original

| Original | Destino |
|---|---|
| `duplicar-perfil-curado` (1º) | Absorbido por el change 3 |
| `constructor-bilingue` (2º) | Reducido al change 5 |
| `encabezado-de-ajuste` (3º) | **Partido**: la unificación de secciones es el change 1; los bullets de ajuste quedan diferidos (§ 5) |
| `perfil-dirigido-sin-vitrina` (4º) | Absorbido por el change 3 |
| `evidencia-verificable-repos` (5º) | **Diferido**: no hay nada que enlazar (1 repo, 2 proyectos sin url) |
| `ciclo-de-vida-perfil-curado` (6º) | Es el change 3 |
| `imprimible-una-hoja` (7º) | **Diferido** por debajo de los changes 2 y 4 |

---

## 5. Diferido, con la razón

| Propuesta | Por qué espera | Cuándo tendría sentido |
|---|---|---|
| `evidencia-verificable-repos` | Construir la sección antes de tener qué mostrar garantiza una sección vacía: su propia regla la oculta con menos de dos items | Después de curar `featuredRepositories` y poner las `url` de los proyectos. Es trabajo de datos, de Manuel, no de código |
| `encabezado-de-ajuste` (bullets de ajuste) | Su valor depende de prosa que todavía hay que escribir, y hoy eso se puede poner en `description` | Cuando el change 1 esté hecho y haya evidencia de que `description` no alcanza |
| ✅ `imprimible-una-hoja` | **Resuelto en `add-printable-one-page`** (1.1.x), junto al ítem *Export PDF de perfil* del checklist: hoja de una página en A4 y Letter, botón *Imprimir / Guardar PDF* y `npm run print:check`. El PDF lo genera el navegador. La descripción del candidato, citada arriba como § 7.3, no está en el repositorio: el alcance salió de lo que sí quedó escrito (*útil y barato*, una hoja) | Hecho |
| `cobertura-de-vacante` | Depende de que los tags estén bien poblados; hoy el cruce lo haría contra datos sin auditar | Después del change 4, que es cuando el contenido se mantiene de verdad |
| `skills-con-respaldo-temporal` | Interesante y sin migración, pero cualquier badge que contradiga las fechas destruye la credibilidad que busca construir | Cuando haya un test de propiedad que lo garantice |
| ✅ `analitica-visitas-honestas` / por `referrer` | **Resuelto en `add-profile-content-admin`** (change 4): el agregado de analítica suma `byReferrer` (origen normalizado a su dominio, lo vacío como "directo") y el dashboard lo muestra en la tabla **Por origen**. Lee lo que ya se persistía, sin capturar nada nuevo | Hecho |
| `cache-de-lectura-y-visitas` | **La mitad de las visitas está hecha** (`polish-builder-and-edge` sacó `recordView` del camino crítico). Falta el cache de lectura | Cuando haya tráfico que lo justifique: hoy son visitas de a decenas |
| ✅ CI/CD | **Resuelto**: el CI existe desde el PR #2 (`.github/workflows/ci.yml`: lint, typecheck, unitarios, e2e contra Postgres, build y control del OpenAPI) y desde `improve-a11y-and-performance` suma el job `web-quality` (axe, teclado y Lighthouse). El CD queda del lado de Railway. Lo habían marcado los dos críticos: había 254 unitarios y 109 e2e que nadie corría automáticamente | Hecho (los *required checks* de `main` no se pueden activar: plan gratuito con repo privado) |
| ✅ Content-Security-Policy del sitio público | **Resuelto en `polish-builder-and-edge`**: Caddy la sirve, con `CSP_HEADER` para pasar a `Report-Only` sin reconstruir | Hecho |
| ✅ Retirar `accentColor` (segunda etapa de D9) | **Resuelto en `retire-accent-color`** (P1 = B): sale de la entrada, la salida, el dominio y el seed; una migración copia el color de cada perfil a `themeOverrides.colors.accent` y borra la columna | Hecho |

---

## 6. Cómo seguir

La ronda está cerrada. Los cinco changes del § 4 están implementados y archivados en `openspec/changes/archive/` (proposal, design, specs delta, tasks y verificación):

| # | Change | Archivado |
|---|---|---|
| 1 | `unify-section-catalog` | 2026-10-05 |
| 2 | `add-server-rendered-head` | 2026-10-08 |
| 3 | `add-curated-profile-lifecycle` | 2026-10-08 |
| 4 | `add-profile-content-admin` | 2026-10-08 |
| 5 | `add-bilingual-builder-parity` | 2026-10-08 |

Después hubo changes posteriores, que salieron de los defectos del § 3.2 y de lo diferido del § 5 (`docs/CHANGELOG.md`):

| Change | Archivado | Qué resolvió |
|---|---|---|
| `polish-builder-and-edge` | 2026-10-09 | aviso de cambios sin guardar, visita fuera del camino crítico, CSP del sitio y `accentColor` obsoleto (etapa 1) |
| `retire-accent-color` | 2026-10-09 | retiro de `accentColor` (etapa 2) |
| `add-printable-one-page` | 2026-10-10 | hoja imprimible de una página |
| `localize-language-level` | 2026-10-10 | nivel de los idiomas bilingüe |
| `improve-a11y-and-performance` | 2026-10-16 | accesibilidad AA, arranque más liviano y `web-quality` en el CI |
| `improve-mobile-performance` | 2026-10-16 | Performance mobile ≥ 85 (medianas de 97 en el CI) |

Lo que sigue diferido está en el § 5. Todo change nuevo sigue pasando por el **Human Gate**: nada se implementa sin el OK, y si algo se desvía durante la implementación, se corrige la spec, no el código.

> El catálogo completo de los 29 candidatos con sus puntajes por juez, sus objeciones y las dos críticas íntegras quedó en el resultado del workflow `portafolio-feature-deliberation` (run `wf_841c542b-f34`).
