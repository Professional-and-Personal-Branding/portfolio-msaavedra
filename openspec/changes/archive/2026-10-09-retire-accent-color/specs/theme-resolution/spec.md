# theme-resolution Specification (delta)

## MODIFIED Requirements

### Requirement: Forma del tema resuelto
`theme` SHALL exponer `slug`, `name`, `isPreset` y `tokens` (ya combinados). El acento del perfil SHALL salir solo de `tokens.colors.accent`: el del tema base combinado con `themeOverrides`, que en los perfiles migrados guarda su antiguo `accentColor`. Ningún otro campo del perfil curado altera los tokens, y el resultado MUST NOT tener la clave `accentColor`.

#### Scenario: Claves del tema
- **WHEN** se resuelve un perfil con tema
- **THEN** `theme` tiene exactamente las claves `slug, name, isPreset, tokens`

#### Scenario: El acento viene de los tokens
- **WHEN** se resuelve un perfil con tema `modern-dark` y `themeOverrides: { colors: { accent: "#f97316" } }`
- **THEN** `theme.tokens.colors.accent` es `#f97316` y el resultado no tiene la clave `accentColor`

#### Scenario: Perfil migrado conserva su color
- **WHEN** se resuelve un perfil con tema `modern-dark` cuyo `accentColor` era `#065F46` y que no tenía `colors.accent` en `themeOverrides` antes de la migración
- **THEN** `theme.tokens.colors.accent` es `#065F46` y los demás tokens de `modern-dark` no cambian

#### Scenario: La personalización previa gana
- **WHEN** se resuelve un perfil cuyo `accentColor` era `#0F766E` y que ya tenía `themeOverrides.colors.accent: "#f97316"` antes de la migración
- **THEN** `theme.tokens.colors.accent` es `#f97316`
