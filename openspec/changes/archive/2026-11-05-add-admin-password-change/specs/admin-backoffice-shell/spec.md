## ADDED Requirements

### Requirement: Pantalla Cuenta con cambio de contraseña
`/admin/cuenta` SHALL requerir sesión, mostrar el nombre y el email del administrador y un formulario con la contraseña actual, la nueva y su repetición que llama a `POST /api/auth/password`. La barra superior SHALL enlazar a Cuenta. El formulario MUST validar en el cliente las reglas de la API y que la repetición coincida, MUST vaciar los campos tras el éxito y MUST NOT guardar contraseñas ni tokens en `localStorage` ni `sessionStorage`.

#### Scenario: Acceso desde la barra
- **WHEN** se pulsa **Cuenta** en la barra superior del panel
- **THEN** se llega a `/admin/cuenta`, que muestra el nombre y el email del administrador

#### Scenario: Cambio correcto
- **WHEN** se completa el formulario con la actual correcta y una nueva válida repetida igual, y la API responde 200
- **THEN** aparece "Contraseña actualizada. Se cerraron las sesiones de otros dispositivos.", los tres campos quedan vacíos y se sigue en `/admin/cuenta`

#### Scenario: Contraseña actual incorrecta
- **WHEN** la API responde 401 al cambio y `GET /api/auth/me` sigue respondiendo 200
- **THEN** se muestra "La contraseña actual no es correcta" y no hay navegación

#### Scenario: La repetición no coincide
- **WHEN** la nueva y su repetición difieren
- **THEN** se muestra "Las contraseñas no coinciden" y no se llama a la API

#### Scenario: Nueva demasiado corta
- **WHEN** la nueva tiene 11 caracteres
- **THEN** se muestra "Usá al menos 12 caracteres" y no se llama a la API

#### Scenario: Demasiados intentos
- **WHEN** la API responde 429
- **THEN** se muestra "Demasiados intentos. Probá de nuevo en unos minutos."

#### Scenario: Sin almacenamiento
- **WHEN** se completa un cambio exitoso
- **THEN** `localStorage` y `sessionStorage` no contienen ninguna de las contraseñas ni el JWT
