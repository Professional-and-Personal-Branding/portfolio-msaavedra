## ADDED Requirements

### Requirement: Credencial de una certificación en la API del panel
La creación y la edición de una certificación SHALL aceptar `verificationUrl` (URL absoluta https, hasta 2048 caracteres), `credentialId` (hasta 100 caracteres) y `expiresAt` (`AAAA-MM` o `AAAA`, con año no anterior a `year`), todos opcionales. `null` o vacío MUST quitar el valor y la clave ausente en `PATCH` no lo toca. Un valor inválido MUST responder 400 sin guardar. El listado del panel SHALL devolverlos.

#### Scenario: Guardar una credencial
- **WHEN** se hace `PATCH /api/admin/certifications/:id` con `verificationUrl: "https://example.org/c/1"`, `credentialId: "EJ-1"` y `expiresAt: "2029-06"`
- **THEN** responde 200 y `GET /api/admin/certifications` devuelve esos tres valores

#### Scenario: URL que no es https
- **WHEN** se hace `POST /api/admin/certifications` con `verificationUrl` igual a `http://example.org/c/1`, `javascript:alert(1)` o `/c/1`
- **THEN** responde 400 y no se crea ninguna certificación

#### Scenario: Vencimiento anterior al año
- **WHEN** se hace `PATCH` de una certificación con `year: "2023"` y `expiresAt: "2022-12"`
- **THEN** responde 400 y la certificación conserva su `expiresAt` anterior

#### Scenario: Quitar el enlace
- **WHEN** se hace `PATCH` con `verificationUrl: null` sobre una certificación que lo tenía
- **THEN** responde 200, el enlace queda en `null` y `credentialId` y `expiresAt` no cambian

#### Scenario: ID demasiado largo
- **WHEN** se hace `POST` con un `credentialId` de 101 caracteres
- **THEN** responde 400

### Requirement: Campos de credencial en el formulario de certificación
El diálogo de certificación de `/admin/formacion` SHALL ofrecer **Enlace de verificación**, **ID de credencial** y **Vence**, opcionales, con las reglas de la API validadas antes de enviar y sus mensajes en español. Un campo vacío SHALL enviarse como `null`. Cambiar cualquiera de ellos SHALL contar como cambio sin guardar.

#### Scenario: Enlace con http
- **WHEN** se escribe `http://example.org/c/1` en **Enlace de verificación** y se pulsa **Guardar**
- **THEN** el campo muestra «Usá una URL completa que empiece con https://» y no sale ninguna petición

#### Scenario: Vencimiento con formato inválido
- **WHEN** se escribe `06/2029` en **Vence**
- **THEN** el campo muestra «Usá el formato AAAA-MM o AAAA»

#### Scenario: Vaciar el enlace
- **WHEN** se borra el texto de **Enlace de verificación** de una certificación que lo tenía y se guarda
- **THEN** el cuerpo del `PATCH` lleva `verificationUrl: null`

#### Scenario: Cerrar con un cambio en la credencial
- **WHEN** se edita solo **ID de credencial** y se pulsa *Cancelar*
- **THEN** el diálogo pide confirmación con *Seguir editando* y *Descartar*
