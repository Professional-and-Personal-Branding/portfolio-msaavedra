# data-persistence-seed Specification (delta)

## ADDED Requirements

### Requirement: Seed por defecto sin cambios con el formato extendido
Sin `--file`, `npm run seed` SHALL seguir cargando `docs/cv-data.json` sin exigir `SEED_DISPOSABLE_DB` y con el mismo resultado que antes del formato extendido. Los campos opcionales ausentes toman los valores de hoy. La validación del archivo SHALL correr antes de la limpieza, y una fuente inválida MUST terminar con código 1 sin borrar ninguna tabla.

#### Scenario: Mismos conteos que antes
- **WHEN** se ejecuta `npm run seed` y después `npm run seed:verify` sobre una base migrada
- **THEN** los conteos son los de *Seed completo desde cv-data.json*, con 0 en `CuratedProfileSlugAlias` y en `ProfileView`

#### Scenario: Valores por defecto de las plantillas
- **WHEN** se lee tras el seed cualquier plantilla de `docs/cv-data.json`
- **THEN** es `PUBLIC`, `classic`, con el tema `modern-dark`, las 9 secciones en orden canónico, sin `sectionsHidden`, overrides, token, archivado ni alias

#### Scenario: Fuente inválida
- **WHEN** se ejecuta `npm run seed` con un `docs/cv-data.json` que no es JSON válido
- **THEN** el seed termina con código 1 y los conteos de la base no cambian
