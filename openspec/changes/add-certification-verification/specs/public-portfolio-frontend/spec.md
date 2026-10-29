## ADDED Requirements

### Requirement: Certificación verificable en la sección pública
Cada certificación con `verificationUrl` SHALL mostrar un enlace «Ver credencial» («View credential» en inglés) con `target="_blank"`, `rel="noopener noreferrer"` y un nombre accesible que incluye el nombre de la certificación. SHALL mostrar el `credentialId` si existe y, según `expiresAt` y la fecha del navegador, «Válida hasta» con el mes o «Vencida». Sin esos datos la tarjeta MUST quedar como antes. MUST NOT sumar recursos de otros orígenes.

#### Scenario: Enlace a la credencial
- **WHEN** se abre `/` con una certificación que tiene `verificationUrl: "https://example.org/c/1"`
- **THEN** su tarjeta tiene un enlace «Ver credencial» a esa URL con `target="_blank"` y `rel="noopener noreferrer"`

#### Scenario: Nombre accesible propio
- **WHEN** dos certificaciones de la sección tienen enlace
- **THEN** cada enlace tiene un nombre accesible distinto que empieza con «Ver credencial» y nombra su certificación

#### Scenario: En inglés
- **WHEN** se abre `/?lang=en` con la misma certificación
- **THEN** el enlace dice «View credential» y apunta a la misma URL

#### Scenario: Vigente y vencida
- **WHEN** con la fecha del navegador en octubre de 2026 una certificación tiene `expiresAt: "2029-06"` y otra `expiresAt: "2025-12"`
- **THEN** la primera muestra «Válida hasta» con junio de 2029 y la segunda muestra «Vencida»

#### Scenario: Sin credencial
- **WHEN** una certificación no tiene `verificationUrl`, `credentialId` ni `expiresAt`
- **THEN** su tarjeta muestra solo nombre, emisor y año, sin enlace

#### Scenario: Presupuesto del arranque
- **WHEN** se corre `npm run perf:budget` sobre el build con este cambio
- **THEN** el arranque público sigue en 155 KB gzip o menos y en un solo JS de módulo
