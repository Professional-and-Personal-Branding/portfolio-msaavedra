## MODIFIED Requirements

### Requirement: Reglas de las variables de sesión y analítica
`JWT_SECRET` es obligatoria y MUST tener al menos 16 caracteres. `JWT_EXPIRES_IN` SHALL aceptar segundos o notación `1d`/`12h`/`30m` (default `1d`). Fuera de producción, `ANALYTICS_SALT` es opcional y SHALL usar `JWT_SECRET` como valor por defecto; con `NODE_ENV=production` la rige el requisito *Arranque seguro en producción*.

#### Scenario: JWT_SECRET ausente o corta
- **WHEN** la API arranca sin `JWT_SECRET` o con una de 8 caracteres
- **THEN** el proceso termina con código distinto de 0 y el error menciona `JWT_SECRET`

#### Scenario: Sal por defecto fuera de producción
- **WHEN** la API arranca con `NODE_ENV=development` y sin `ANALYTICS_SALT`
- **THEN** arranca normalmente y el hash de IP usa `JWT_SECRET` como sal

### Requirement: Arranque seguro en producción
Con `NODE_ENV=production`, la validación SHALL impedir el arranque cuando `JWT_SECRET` sea el valor de `.env.example`, tenga menos de 32 caracteres o coincida con `ANALYTICS_SALT`; cuando `ANALYTICS_SALT` falte, tenga menos de 32 caracteres o coincida con una clave de `INTEGRATIONS_KEYS`; y cuando `FRONTEND_URL` no use `https`. El mensaje SHALL nombrar la variable y no imprimir su valor.

#### Scenario: Secreto de ejemplo en producción
- **WHEN** se arranca con `NODE_ENV=production` y el `JWT_SECRET` que trae `.env.example`
- **THEN** el proceso termina con código distinto de 0 y el mensaje nombra `JWT_SECRET` sin mostrar su contenido

#### Scenario: Secreto corto en producción
- **WHEN** `NODE_ENV=production` y `JWT_SECRET` tiene 20 caracteres
- **THEN** el arranque falla indicando la longitud mínima

#### Scenario: Frontend sin HTTPS en producción
- **WHEN** `NODE_ENV=production` y `FRONTEND_URL` es `http://ejemplo.com`
- **THEN** el arranque falla nombrando `FRONTEND_URL`

#### Scenario: Desarrollo no se ve afectado
- **WHEN** se arranca con `NODE_ENV=development`, `FRONTEND_URL=http://localhost:5173` y un secreto de desarrollo
- **THEN** la API arranca normalmente

#### Scenario: Sal ausente en producción
- **WHEN** `NODE_ENV=production`, con un `JWT_SECRET` válido y sin `ANALYTICS_SALT`
- **THEN** el arranque falla nombrando `ANALYTICS_SALT` como obligatoria en producción

#### Scenario: Sal corta en producción
- **WHEN** `NODE_ENV=production` y `ANALYTICS_SALT` tiene 20 caracteres
- **THEN** el arranque falla nombrando `ANALYTICS_SALT` e indicando la longitud mínima, sin mostrar su valor

#### Scenario: Sal repetida en el keyring
- **WHEN** `NODE_ENV=production` y `INTEGRATIONS_KEYS` contiene como clave el mismo valor que `ANALYTICS_SALT`
- **THEN** el arranque falla nombrando `INTEGRATIONS_KEYS` sin mostrar ningún valor

## ADDED Requirements

### Requirement: FRONTEND_URL es un origen
En cualquier entorno, `FRONTEND_URL` MUST ser un origen: esquema, host y puerto opcional, igual a su forma normalizada, sin barra final, ruta, query, fragmento ni credenciales. Si no lo es, el arranque MUST fallar nombrando `FRONTEND_URL` sin imprimir su valor.

#### Scenario: Barra final
- **WHEN** la API arranca con `FRONTEND_URL=https://mjsaavedra.is-a.dev/`
- **THEN** el proceso termina con código distinto de 0 y el error nombra `FRONTEND_URL`

#### Scenario: Con ruta
- **WHEN** la API arranca con `FRONTEND_URL=https://ejemplo.dev/portafolio`
- **THEN** el arranque falla nombrando `FRONTEND_URL`

#### Scenario: Origen válido con puerto
- **WHEN** la API arranca con `NODE_ENV=development` y `FRONTEND_URL=http://localhost:5173`
- **THEN** arranca normalmente y CORS acepta exactamente ese origen
