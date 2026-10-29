# profile-view-analytics Specification (delta)

## ADDED Requirements

### Requirement: Desglose por enlace y por portal
El agregado de visitas SHALL incluir `byShareLink: [{ shareLinkId, code, label, slug, portal, revoked, views }]` y `bySource: [{ source, views }]`, con las visitas `HUMAN` del rango que tienen `shareLinkId` o `source`, ordenados por `views` descendente. Las visitas sin enlace o sin portal MUST NOT formar una fila, así que cada suma SHALL ser menor o igual que `total`.

#### Scenario: Enlaces y portales en el rango
- **WHEN** en un rango sin otras visitas hay 3 visitas `HUMAN` por el enlace «Acme» (portal `linkedin`), 2 `HUMAN` con `src=indeed`, 1 `HUMAN` directa y 1 `BOT` por «Acme»
- **THEN** `total` es 6, `byShareLink` es `[{ label: "Acme", views: 3, ... }]` y `bySource` es `[{ source: "linkedin", views: 3 }, { source: "indeed", views: 2 }]`

#### Scenario: Enlace revocado o de un perfil archivado
- **WHEN** un enlace con visitas en el rango se revoca o su perfil se archiva
- **THEN** sigue en `byShareLink` con sus visitas, `revoked` refleja su estado y `slug` es el de su perfil

#### Scenario: Sin atribuciones
- **WHEN** el rango tiene visitas pero ninguna con enlace ni portal
- **THEN** `byShareLink` y `bySource` son listas vacías

## MODIFIED Requirements

### Requirement: Agregado por origen de la visita
El agregado de visitas SHALL incluir `byReferrer: { referrer, views }[]`, construido **sobre el `referrer` que ya se persiste** desde la Fase 3, con las mismas visitas que `total`. Los únicos datos de origen nuevos que SHALL persistirse son `shareLinkId` y `source` (`share-links`); MUST NOT persistirse la URL completa del origen: solo su host. La cookie de sesión solo SHALL leerse para clasificar la visita y MUST NOT guardarse.

#### Scenario: Solo el host
- **WHEN** el `referrer` trae path y query
- **THEN** el agregado guarda únicamente el host, sin path ni parámetros

#### Scenario: El total no cambia
- **WHEN** se compara la suma de `byReferrer` con `total` en el mismo rango
- **THEN** son iguales

#### Scenario: La cookie no se guarda
- **WHEN** se registra una visita `OWNER` con la cookie `portfolio_session`
- **THEN** ninguna columna del `ProfileView` contiene el token ni parte de él

#### Scenario: La atribución no reemplaza al referrer
- **WHEN** una visita llega con `?via=` de un enlace con portal `linkedin` y sin header `Referer`
- **THEN** cuenta bajo `directo` en `byReferrer` y bajo `linkedin` en `bySource`
