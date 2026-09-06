# theme-resolution Specification

## Purpose
Define cómo se obtiene el conjunto final de design tokens de un perfil curado: tema base (propio o preset por defecto) combinado con los overrides parciales del perfil, listo para que el frontend lo inyecte como CSS variables sin lógica adicional.

## Requirements

### Requirement: Tema base con fallback al preset por defecto
Si el perfil curado referencia un tema, el sistema SHALL usarlo como base. Si no referencia ninguno o el referenciado no existe, SHALL usar el preset `modern-dark`. Si tampoco existe, `theme` SHALL ser `null` y la resolución MUST continuar sin error.

#### Scenario: Tema propio
- **WHEN** el perfil referencia el tema `elegant`
- **THEN** `theme.slug` es `elegant` y `theme.tokens` parte de sus tokens

#### Scenario: Sin tema → preset por defecto
- **WHEN** el perfil no referencia tema
- **THEN** `theme.slug` es `modern-dark`

#### Scenario: Sin ningún tema disponible
- **WHEN** el perfil no referencia tema y no existe el preset `modern-dark`
- **THEN** `theme` es `null` y el resto de la vista se resuelve normalmente

### Requirement: Merge profundo de overrides
`themeOverrides` SHALL combinarse sobre los tokens base recursivamente: los objetos se fusionan clave a clave; los valores primitivos y arrays del override reemplazan al base; las claves ausentes en el override conservan el valor base; un override `null`/inexistente deja los tokens base intactos. El merge MUST NOT mutar los tokens del tema base.

#### Scenario: Override parcial de colores
- **WHEN** base `colors = { bg: "#0a0e1a", accent: "#38bdf8" }` y override `{ colors: { accent: "#ff0000" } }`
- **THEN** `tokens.colors` es `{ bg: "#0a0e1a", accent: "#ff0000" }`

#### Scenario: Override anidado no borra hermanos
- **WHEN** override `{ typography: { fontSans: "Georgia" } }` y base `typography = { fontSans: "Inter", fontHeading: "Inter", scale: "default" }`
- **THEN** `tokens.typography` es `{ fontSans: "Georgia", fontHeading: "Inter", scale: "default" }`

#### Scenario: Primitivos y arrays reemplazan
- **WHEN** override `{ mode: "light", effects: { animations: false } }`
- **THEN** `tokens.mode` es `"light"` y `tokens.effects.animations` es `false`, conservando `effects.glassmorphism` del base

#### Scenario: Override nulo
- **WHEN** `themeOverrides` es `null`
- **THEN** `tokens` es igual a los tokens del tema base

#### Scenario: Inmutabilidad del base
- **WHEN** se aplica un override sobre un tema
- **THEN** los tokens del tema base no cambian tras la operación

### Requirement: Forma del tema resuelto
`theme` SHALL exponer `slug`, `name`, `isPreset` y `tokens` (ya combinados). El `accentColor` del perfil curado SHALL exponerse como metadato del perfil y NO SHALL alterar los tokens automáticamente (el frontend decide su uso).

#### Scenario: Claves del tema
- **WHEN** se resuelve un perfil con tema
- **THEN** `theme` tiene exactamente las claves `slug, name, isPreset, tokens`
