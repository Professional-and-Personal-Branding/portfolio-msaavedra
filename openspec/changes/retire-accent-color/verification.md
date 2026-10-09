# Verificación — retire-accent-color

> Cada sección corresponde a una tarea de `tasks.md`. Las salidas completas están en `verification/`. Las credenciales de la base se redactaron en todos los registros (no se imprimieron ni se versionan).

## Efecto aceptado (D5)

Desde la tarea 1.7 (2026-10-09 04:19 -04:00), la base `portfolio` del owner no tiene la columna `accentColor`. **El backend de `main` deja de funcionar contra esa base hasta que se fusione el PR de este change.** Para volver a `main` antes del merge, seguir § *Rollback*. Además, el cliente Prisma generado en el checkout principal sigue siendo el anterior: no se regeneró a propósito, porque el código de `main` selecciona `accentColor`.

## Respaldo (1.1)

| Dato | Valor |
|---|---|
| Base | `portfolio` en `localhost:5434` (contenedor `portfolio-postgres`) |
| Comando | `docker exec portfolio-postgres pg_dump -U portfolio -Fc portfolio > <ruta>` (redirección de `cmd`, para no corromper el binario) |
| Ruta (fuera del repo) | `D:\projects\portfolio-msaavedra\backups\portfolio-pre-retire-accent-20261009-041629.dump` |
| Tamaño | 59098 bytes |
| SHA-256 | `E61479D316CF04BC2FC71B9D213F84A9B10FD12D5939BAD963AC76A477A01FC7` |
| Fecha y hora | 2026-10-09 04:16:29 (-04:00) |
| `pg_restore --list` | lista `TABLE public CuratedProfile`, `CuratedProfileSlugAlias`, `_prisma_migrations` y los datos de `CuratedProfile` |

El dump se conserva hasta el deploy 1.0.0 (tarea 6.6).

## Evidencia previa (1.2)

- Salida completa: `verification/1.2-antes.txt`.
- Filas: 14 (las 13 plantillas y `all`). Con `colors.accent` previo en `themeOverrides`: **0** (todas tenían `themeOverrides` en `NULL` de SQL).
- Formas inválidas de `themeOverrides` o de `colors`: **ninguna**. Se siguió adelante.

## Ensayo en la copia `portfolio_retire_accent` (1.5, 1.6)

- Migración, con los cinco casos sintéticos: `verification/1.5-ensayo-migracion.txt`. La copia se restauró del dump, el destino de Prisma se confirmó con `prisma migrate status` (`portfolio_retire_accent`) y los cinco casos quedaron como dicen los escenarios de `data-persistence-seed`:

| Caso sintético | `themeOverrides` antes | Después |
|---|---|---|
| `NULL` de SQL | `NULL` | `{"colors":{"accent":"#111111"}}` |
| `null` de JSON | `null` | `{"colors":{"accent":"#222222"}}` |
| objeto sin `colors` | `{"radius":"8px"}` | `{"colors":{"accent":"#333333"},"radius":"8px"}` |
| `colors` sin `accent` | `{"colors":{"bg":"#000000"},"radius":"4px"}` | `{"colors":{"bg":"#000000","accent":"#444444"},"radius":"4px"}` |
| `colors.accent` presente | `{"colors":{"accent":"#abcdef"}}` | sin cambios (`#abcdef`, gana lo personalizado) |

  Las 14 filas reales quedaron con `colors.accent` igual a su `accentColor` previo y la columna dejó de existir.
- Rollback y seed (el seed corrió **solo** en la copia): `verification/1.6-ensayo-rollback-y-seed.txt`. Tras `pg_restore --clean --if-exists --no-owner`, `prisma migrate status` mostró `retire_accent_color` pendiente y el `SELECT` de 1.2 coincidió con `1.2-antes.txt` (17 líneas con contenido, 0 diferencias; el diff crudo solo marca una línea en blanco final de la salida de `psql`). Después se reaplicó la migración, y `seed` y `seed:verify` terminaron en verde, con el `colors.accent` sembrado de cada plantilla igual al de `cv-data.json` y al migrado en 1.5 (la base del owner no tiene perfiles editados a mano que difieran).

## Rollback

Procedimiento ensayado en 1.6:

1. Parar el backend.
2. `pg_restore --clean --if-exists --no-owner -d portfolio <ruta del dump>` (por ejemplo, `docker exec -i portfolio-postgres pg_restore -U portfolio --clean --if-exists --no-owner -d portfolio < <dump>`).
3. `npm run prisma:status`: dos migraciones aplicadas y `retire_accent_color` pendiente.
4. Volver al código de `main`.

Si el dump no está disponible, no hay rollback de datos posible: el `DROP COLUMN` es definitivo.

## Aplicación en `portfolio` (1.7)

- Salida de `prisma migrate deploy`: `verification/1.7-deploy-owner.txt` (inicio 2026-10-09T04:19:31 -04:00, fin 04:19:36). Antes: destino `portfolio`, `retire_accent_color` pendiente. Después: `Database schema is up to date!`. No había ningún backend escuchando en 3300, 3000, 3001 ni 5173.

## Antes y después (1.8)

Salida: `verification/1.8-despues.txt`.

| Perfil | `accentColor` previo | `colors.accent` previo | `colors.accent` resultante | Conforme a D3 |
|---|---|---|---|---|
| `ai-software-engineer` | `#6D28D9` | (ninguno) | `#6D28D9` | sí |
| `all` | `#38bdf8` | (ninguno) | `#38bdf8` | sí |
| `backend-payments-ror` | `#9B1C2E` | (ninguno) | `#9B1C2E` | sí |
| `devops-azure` | `#0078D4` | (ninguno) | `#0078D4` | sí |
| `devops-platform` | `#0F766E` | (ninguno) | `#0F766E` | sí |
| `dotnet-backend` | `#0078D4` | (ninguno) | `#0078D4` | sí |
| `fullstack-microsoft` | `#0078D4` | (ninguno) | `#0078D4` | sí |
| `fullstack-nest-react` | `#065F46` | (ninguno) | `#065F46` | sí |
| `generalist-polyglot` | `#0F766E` | (ninguno) | `#0F766E` | sí |
| `integration-architect` | `#0E5263` | (ninguno) | `#0E5263` | sí |
| `it-leadership` | `#1B3A6B` | (ninguno) | `#1B3A6B` | sí |
| `java-senior-backend` | `#1A365D` | (ninguno) | `#1A365D` | sí |
| `software-architect` | `#1E293B` | (ninguno) | `#1E293B` | sí |
| `tech-lead-dotnet` | `#5B2C87` | (ninguno) | `#5B2C87` | sí |

- Columna `accentColor` en `information_schema`: vacío (0 filas).
- `prisma migrate diff --from-schema-datasource … --to-schema-datamodel … --exit-code`: `No difference detected`, código de salida **0**.
- `prisma generate` en el worktree con el backend parado: correcto.
- `_prisma_migrations` de `portfolio`: `init`, `curated_profile_lifecycle`, `retire_accent_color`.

## Contraste (6.4) — riesgo aceptado por el owner (D3)

Contra el fondo `#0a0e1a` de `modern-dark`, calculado con la fórmula WCAG 2.x sobre `GET /api/curated-profiles/{slug}` (`theme.tokens.colors.accent` y `bg` resueltos). Solo se registra, no se corrige. Coincide con la tabla de `design.md`. Salida: `verification/6.4-contraste.txt`.

| Perfil | Acento | Fondo | Contraste | < 3:1 | < 4,5:1 |
|---|---|---|---|---|---|
| `software-architect` | `#1E293B` | `#0a0e1a` | 1,32 | sí | sí |
| `java-senior-backend` | `#1A365D` | `#0a0e1a` | 1,59 | sí | sí |
| `it-leadership` | `#1B3A6B` | `#0a0e1a` | 1,71 | sí | sí |
| `tech-lead-dotnet` | `#5B2C87` | `#0a0e1a` | 1,98 | sí | sí |
| `integration-architect` | `#0E5263` | `#0a0e1a` | 2,21 | sí | sí |
| `backend-payments-ror` | `#9B1C2E` | `#0a0e1a` | 2,38 | sí | sí |
| `fullstack-nest-react` | `#065F46` | `#0a0e1a` | 2,51 | sí | sí |
| `ai-software-engineer` | `#6D28D9` | `#0a0e1a` | 2,71 | sí | sí |
| `devops-platform` | `#0F766E` | `#0a0e1a` | 3,52 | no | sí |
| `generalist-polyglot` | `#0F766E` | `#0a0e1a` | 3,52 | no | sí |
| `dotnet-backend` | `#0078D4` | `#0a0e1a` | 4,25 | no | sí |
| `fullstack-microsoft` | `#0078D4` | `#0a0e1a` | 4,25 | no | sí |
| `devops-azure` | `#0078D4` | `#0a0e1a` | 4,25 | no | sí |
| `all` | `#38bdf8` | `#0a0e1a` | 8,99 | no | no |

8 de las 13 plantillas quedan por debajo de 3:1 y ninguna llega a 4,5:1; solo `all` (igual al preset) lo supera.

## Suite, inventario, app real y validación (6.1–6.5)

- `verification/6.1-suite.txt` (contra `portfolio` migrada, sin seed): backend lint y typecheck limpios, **529 unitarios** (76 suites) y **168 e2e** (10 suites); frontend lint limpio, **243 tests** (34 archivos) y build correcto. `openapi:export` dos veces seguidas da el mismo hash (`8534453604706ABAAC6ADD3F33C3C80D7F36EB19E03DB918BB8F852DCF02C4D3`) y el diff contra `HEAD` solo borra `accentColor` (49 líneas). `grep -c accentColor frontend/src/shared/types/api.d.ts` da 0.
- `verification/6.2-inventario.txt`: `accentColor` solo queda en la migración `init`, la migración nueva, `docs/cv-data.es-only.backup.json`, los tests de 2.1 y `swagger.spec.ts`, `docs/` (`DEPLOY*.md`, `CHANGELOG.md`, `MANUAL.md` e `index.html` como nota de TC-12 y TC-15, `ROADMAP-1.1.md`, `DATA-POPULATION.md`, `RELEASE-1.0.0-CHECKLIST.md`, la suite `.ps1`), `CLAUDE.md` (la línea de `polish-builder-and-edge`) y los artefactos de este change. Los `openspec/specs/*` vigentes se actualizan al archivar.
- App real (6.3), backend de este worktree en 3300 contra `portfolio` y `npm run dev`:
  - `verification/6.3-api.txt`: `/all` resuelve `#38bdf8`, `/fullstack-nest-react` `#065F46` y `/tech-lead-dotnet` `#5B2C87`; ninguna respuesta (detalle, listado, listado admin) trae `accentColor`; `POST` y preview con `accentColor` responden **400** (`property accentColor should not exist`).
  - Capturas: `verification/6.3-home.jpg`, `6.3-fullstack-nest-react.jpg` (acento verde), `6.3-tech-lead-dotnet.jpg` (morado, durante la animación de entrada).
  - TC-12 de `suite-backoffice.ps1` (bloque aislado, más el TC-19 que lo sigue en el script): `verification/6.3-tc12.txt`, todo con el código esperado, incluido `POST con accentColor (retirado) -> 400`, y limpieza sin residuos (14 perfiles, 15 experiencias).
  - **No se probó a mano la sesión de `/admin`** (customizador mostrando el acento como override con *Restablecer*, y el constructor creando, guardando y previsualizando): hubiera requerido escribir la contraseña del administrador en el navegador. Lo cubren los tests del frontend (243 en verde) y los e2e del backend (preview con `accentColor` → 400, perfil con `themeOverrides.colors.accent` resuelto). Queda para que el owner lo mire en el panel.
- `verification/6.5-validate.txt`: `validate retire-accent-color --strict` válido; `validate --all --strict` con 33 de 33 y sin avisos *Archive would refuse*.
- 6.6: la copia `portfolio_retire_accent` se borró (`verification/6.6-psql-l.txt` ya no la lista). El dump de 1.1 se conserva en la ruta de § *Respaldo*.
