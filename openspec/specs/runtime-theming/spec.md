# runtime-theming Specification

## Purpose
Hace del theming un pilar verificable: los design tokens (de la base o de un preset) se convierten en CSS variables en runtime y toda la interfaz, incluidos los componentes de librería, responde a ellos sin recargar ni recompilar.

## Requirements

### Requirement: Contrato de tokens compartido con el backend
El frontend SHALL definir un tipo `ThemeTokens` con `mode` (`light|dark`), `colors` (`bg, bgSoft, card, border, text, textMuted, accent, accent2`), `typography` (`fontSans, fontHeading, scale`), `layout` (`radius, maxWidth, density`) y `effects` (`animations, glassmorphism`), compatible con `Theme.tokens` del seed. Tokens ausentes SHALL completarse con los del preset `modern-dark`.

#### Scenario: Tokens parciales se completan
- **WHEN** el `ThemeProvider` recibe `{ colors: { accent: "#ff0000" } }`
- **THEN** el tema efectivo tiene `colors.accent = "#ff0000"` y el resto de tokens de `modern-dark`

### Requirement: Inyección como CSS variables en runtime
El `ThemeProvider` SHALL aplicar cada token como CSS custom property (`--t-bg`, `--t-accent`, `--t-radius`, `--t-font-sans`, …) en el contenedor raíz de la aplicación y `color-scheme` según `mode`, sin recargar la página. Las utilidades de Tailwind y las variables de shadcn/ui (`--background`, `--foreground`, `--primary`, `--card`, `--border`, `--muted`, `--radius`) SHALL derivar de esas variables.

#### Scenario: Cambio de tokens sin recarga
- **WHEN** el tema activo cambia de `modern-dark` a `modern-light`
- **THEN** el contenedor raíz expone `--t-bg: #f8fafc` y `--t-text: #0f172a` sin que ocurra una navegación ni recarga

#### Scenario: Componentes de librería siguen el tema
- **WHEN** el tema activo tiene `colors.accent = "#c8a04e"`
- **THEN** un botón primario de shadcn/ui renderiza con fondo `#c8a04e`

### Requirement: Cinco presets conmutables
El frontend SHALL incluir los presets `modern-dark`, `modern-light`, `minimal`, `elegant` y `corporate` con los mismos tokens que el seed, y un selector visible en la barra superior que permita conmutarlos en runtime. El preset elegido por el visitante SHALL prevalecer sobre el tema del perfil mientras dure la sesión y SHALL reflejarse en `?theme=` para poder compartirlo.

#### Scenario: Los cinco presets se ven distintos
- **WHEN** se recorren los cinco presets
- **THEN** cada uno produce valores de `--t-bg` y `--t-accent` distintos entre sí

#### Scenario: Tema inicial desde la API
- **WHEN** se abre `/tech-lead-dotnet` sin `?theme=`
- **THEN** los tokens aplicados son los de `theme.tokens` de la respuesta de la API (tema del perfil + overrides)

#### Scenario: Preset por URL
- **WHEN** se abre `/tech-lead-dotnet?theme=elegant`
- **THEN** se aplican los tokens de `elegant` y el selector lo muestra activo

### Requirement: Modo, densidad, radio, tipografía y animaciones
`mode` SHALL alternar la paleta clara/oscura; `layout.radius` y `layout.maxWidth` SHALL aplicarse a tarjetas y contenedor; `layout.density` (`compact|comfortable|spacious`) SHALL escalar el espaciado; `typography.fontSans`/`fontHeading` SHALL aplicarse a cuerpo y títulos; con `effects.animations = false` o `prefers-reduced-motion` las animaciones de entrada MUST desactivarse.

#### Scenario: Densidad
- **WHEN** el tema tiene `density: "compact"`
- **THEN** la variable de espaciado base es menor que con `comfortable`

#### Scenario: Animaciones desactivadas
- **WHEN** el tema tiene `effects.animations = false`
- **THEN** las secciones se renderizan sin animación de entrada
