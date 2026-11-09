## ADDED Requirements

### Requirement: Resumen de postulaciones en el dashboard
El dashboard SHALL mostrar, sobre los totales, una franja de una línea con las postulaciones activas (`GET /api/admin/applications/summary`): el total y cada estado activo con más de cero, más el enlace **Ver postulaciones**. No SHALL depender del rango de fechas ni sumar tarjetas. Con cero activas SHALL decir «Sin postulaciones activas»; si la consulta falla, la franja MUST NOT mostrarse y el resto sigue.

#### Scenario: Con activas
- **WHEN** el resumen trae `active: 3` con 2 `APPLIED` y 1 `OFFER`
- **THEN** la franja dice «Postulaciones activas: 3 · 2 postuladas · 1 con oferta» y enlaza a `/admin/postulaciones`

#### Scenario: El rango no la cambia
- **WHEN** se cambia el rango a 7 días
- **THEN** no se vuelve a pedir el resumen y la franja sigue igual

#### Scenario: Falla el resumen
- **WHEN** el resumen responde 500 y las visitas 200
- **THEN** el dashboard muestra las visitas y no muestra la franja
