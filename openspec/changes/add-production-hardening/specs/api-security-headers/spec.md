## Purpose

Cierra los vectores que dependen del navegador: sniffing de tipos, embebido en iframes, fuga del token de un perfil protegido por el `Referer` y tráfico en claro.

## ADDED Requirements

### Requirement: Cabeceras de seguridad en todas las respuestas
La API SHALL responder con Helmet configurado para una API JSON: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` (o `frame-ancestors 'none'`), `Referrer-Policy: no-referrer` y sin la cabecera `X-Powered-By`. En producción SHALL incluir además `Strict-Transport-Security`.

#### Scenario: Cabeceras presentes
- **WHEN** se pide cualquier endpoint público
- **THEN** la respuesta incluye `x-content-type-options: nosniff` y `referrer-policy: no-referrer`, y no incluye `x-powered-by`

#### Scenario: El token de un perfil protegido no viaja en el Referer
- **WHEN** se abre un perfil `PROTECTED` con `?token=` y la página solicita un recurso externo
- **THEN** la política de referrer impide que la URL con el token viaje en la cabecera `Referer`

#### Scenario: HSTS solo en producción
- **WHEN** la API corre en producción
- **THEN** las respuestas incluyen `strict-transport-security`; en desarrollo no

### Requirement: HTTPS en producción
Con `NODE_ENV=production`, una petición recibida por HTTP (según `X-Forwarded-Proto`) SHALL redirigirse con 301 a la misma URL en HTTPS. La API SHALL confiar en el proxy del proveedor para leer esa cabecera.

#### Scenario: Redirección
- **WHEN** llega una petición con `X-Forwarded-Proto: http` en producción
- **THEN** responde 301 hacia `https://` con la misma ruta

#### Scenario: Desarrollo sin redirección
- **WHEN** la misma petición llega en desarrollo
- **THEN** se atiende normalmente sin redirigir

### Requirement: Cookie de sesión endurecida
La cookie `portfolio_session` SHALL emitirse con `Secure` en producción y con el `SameSite` más estricto que permita el despliegue: `strict` cuando frontend y backend comparten sitio, `none` (siempre junto a `Secure`) cuando no, elegido por configuración (`SESSION_COOKIE_SAMESITE`).

#### Scenario: Producción con mismo sitio
- **WHEN** `NODE_ENV=production` y `SESSION_COOKIE_SAMESITE=strict`
- **THEN** el `Set-Cookie` del login incluye `Secure` y `SameSite=Strict`

#### Scenario: Dominios distintos
- **WHEN** `SESSION_COOKIE_SAMESITE=none`
- **THEN** el `Set-Cookie` incluye `SameSite=None` y `Secure`
