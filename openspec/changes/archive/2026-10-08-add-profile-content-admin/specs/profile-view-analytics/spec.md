# profile-view-analytics Specification (delta)

## ADDED Requirements

### Requirement: Agregado por origen de la visita
El agregado de visitas SHALL incluir `byReferrer: { referrer, views }[]`, construido **sobre el `referrer` que ya se persiste** desde la Fase 3. MUST NOT capturarse ningún dato nuevo, ni cookies, ni la URL completa del origen: solo su host.

La normalización SHALL ser una función pura de dominio con estas reglas:

- `referrer` nulo, vacío o no parseable → `"directo"`.
- Una URL válida → su host en minúsculas, sin el prefijo `www.`.
- Un host que coincide con el de `FRONTEND_URL` → `"interno"`, para no contar la navegación dentro del sitio como tráfico entrante.

#### Scenario: Origen externo
- **WHEN** una visita llega con `referrer: "https://www.linkedin.com/feed/"`
- **THEN** cuenta bajo `linkedin.com`

#### Scenario: Sin referrer
- **WHEN** una visita llega sin `referrer`
- **THEN** cuenta bajo `directo`

#### Scenario: Navegación interna
- **WHEN** el `referrer` es una URL del propio `FRONTEND_URL`
- **THEN** cuenta bajo `interno` y no como tráfico entrante

#### Scenario: Referrer basura
- **WHEN** el `referrer` no es una URL parseable
- **THEN** cuenta bajo `directo` y no rompe el agregado

#### Scenario: Solo el host
- **WHEN** el `referrer` trae path y query
- **THEN** el agregado guarda únicamente el host, sin path ni parámetros

#### Scenario: El total no cambia
- **WHEN** se compara la suma de `byReferrer` con `total` en el mismo rango
- **THEN** son iguales
