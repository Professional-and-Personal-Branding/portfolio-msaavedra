## ADDED Requirements

### Requirement: Credenciales en la hoja
En el bloque de certificaciones, cada certificación con `verificationUrl` SHALL llevar a continuación la etiqueta «Ver credencial» («View credential» en inglés) como enlace clicable en el PDF, sin imprimir la URL. Una certificación vencida según la fecha del navegador SHALL sumar «vencida» («expired») a su paréntesis. El ID y la fecha de vencimiento MUST NOT imprimirse. Los límites de `PRINT_LIMITS` y la hoja única SHALL mantenerse.

#### Scenario: Enlace en el PDF
- **WHEN** se arma la hoja de `/` con una certificación que tiene `verificationUrl: "https://example.org/c/1"`
- **THEN** el bloque de certificaciones tiene un enlace «Ver credencial» con ese `href` y el texto de la hoja no contiene `example.org`

#### Scenario: Certificación vencida
- **WHEN** se arma la hoja con `now` en octubre de 2026 y una certificación con emisor `Escuela Demo`, sin año y `expiresAt: "2025-12"`
- **THEN** su texto es «<nombre> (Escuela Demo, vencida)»

#### Scenario: Sin credenciales
- **WHEN** se arma la hoja de un perfil cuyas certificaciones no tienen enlace ni vencimiento
- **THEN** el bloque tiene el mismo texto que antes de este cambio

#### Scenario: Una hoja con el ejemplo
- **WHEN** se corre `npm run print:check` contra la base de ejemplo, que tiene una credencial con enlace y otra vencida
- **THEN** cada combinación de perfil, idioma, papel y tema da un PDF de una página y el script sale con código 0
