## MODIFIED Requirements

### Requirement: Bootstrap del administrador
`npm run admin:bootstrap` SHALL crear el administrador a partir de `ADMIN_EMAIL`, `ADMIN_PASSWORD` y `ADMIN_NAME` (o actualizarlo, incrementando `sessionVersion`) y MUST fallar con mensaje claro si falta email o contraseña. Con `NODE_ENV=production` MUST rechazar, sin tocar la base, la contraseña de `.env.example` y una de menos de 12 caracteres. El seed MUST NOT borrar administradores. Es la vía de recuperación de la contraseña.

#### Scenario: Primer arranque
- **WHEN** no existe administrador y se ejecuta el bootstrap con las variables definidas
- **THEN** existe un `AdminUser` con ese email, nombre y hash argon2id, y el login funciona

#### Scenario: Re-ejecución actualiza
- **WHEN** ya existe el administrador y se ejecuta con otra `ADMIN_PASSWORD`
- **THEN** el login funciona con la nueva contraseña y no se duplica el usuario

#### Scenario: La re-ejecución cierra las sesiones
- **WHEN** hay una sesión abierta en el panel y se vuelve a ejecutar el bootstrap
- **THEN** `sessionVersion` aumenta en 1 y esa sesión recibe 401 en su próxima petición

#### Scenario: Faltan variables
- **WHEN** se ejecuta sin `ADMIN_PASSWORD`
- **THEN** el proceso termina con código distinto de 0 y menciona la variable

#### Scenario: Seed preserva administradores
- **WHEN** se ejecuta `npm run seed` con un administrador existente
- **THEN** el administrador sigue existiendo

#### Scenario: Contraseña de ejemplo en producción
- **WHEN** se ejecuta con `NODE_ENV=production` y `ADMIN_PASSWORD=cambiar-en-primer-arranque`
- **THEN** el proceso termina con código 1, nombra `ADMIN_PASSWORD` y no crea ni modifica ningún `AdminUser`

#### Scenario: Contraseña de ejemplo fuera de producción
- **WHEN** se ejecuta con `NODE_ENV=development` y la contraseña de `.env.example`
- **THEN** avisa que es el valor de ejemplo y crea o actualiza el administrador

#### Scenario: Contraseña corta en producción
- **WHEN** se ejecuta con `NODE_ENV=production` y una `ADMIN_PASSWORD` de 10 caracteres
- **THEN** el proceso termina con código 1 indicando el mínimo de 12 y no toca la base
