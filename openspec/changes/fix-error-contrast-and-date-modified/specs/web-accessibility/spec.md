## ADDED Requirements

### Requirement: Mensajes de error legibles
El texto de un mensaje de error o de aviso del panel y de la vista pública SHALL usar un rojo derivado del tema efectivo con contraste ≥ 4,5:1 contra `bg`, `bgSoft` y `card`, con el tono de la base; si la base ya cumple, SHALL ser la base. El derivado MUST NOT guardarse, y ningún mensaje MUST usar `text-destructive` ni una mezcla de color ad hoc.

#### Scenario: Error en el panel oscuro
- **WHEN** el login del panel muestra «Email o contraseña incorrectos» con el preset `modern-dark`
- **THEN** el texto del mensaje mide ≥ 4,5:1 contra la tarjeta del formulario y conserva el tono rojo

#### Scenario: Cinco presets
- **WHEN** se calculan las variables de los cinco presets
- **THEN** el rojo de error mide ≥ 4,5:1 contra `bg`, `bgSoft` y `card` de cada uno, y en `minimal` es la base `#dc2626`

#### Scenario: Regla estática
- **WHEN** una línea de la vista pública o del panel usa `text-destructive`, `hover:text-destructive` o `text-[color-mix(in_srgb,var(--color-destructive)_60%,var(--t-text))]`
- **THEN** el test de uso de colores de estado falla señalando esa línea, y no falla por `bg-destructive text-white`

### Requirement: La auditoría ve los formularios con errores
`a11y:check` SHALL auditar, en móvil y escritorio, el login con un mensaje de error a la vista (con la respuesta 401 simulada en el navegador, sin llegar a la API) y, con credenciales de prueba, un diálogo del panel con errores de validación, sin enviar escrituras. Si el mensaje esperado no aparece, la entrada SHALL contar como problema.

#### Scenario: Login con error
- **WHEN** se corre `a11y:check` contra el build de producción y una base descartable
- **THEN** el reporte incluye `admin-login-error` en móvil y escritorio con 0 violaciones `serious` y 0 `critical`, y la API no registra ningún intento de login de esa entrada

#### Scenario: Diálogo con errores
- **WHEN** se corre con credenciales de prueba
- **THEN** el reporte incluye `admin-experiencias-error` con el diálogo «Nueva experiencia» mostrando errores, 0 violaciones `serious` y 0 `critical`, y ninguna petición `POST` a `/api/admin/`

#### Scenario: El error no aparece
- **WHEN** el mensaje de error esperado no aparece en 5 segundos
- **THEN** el script lo informa como problema y sale con código 1
