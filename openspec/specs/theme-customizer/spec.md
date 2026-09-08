# theme-customizer Specification

## Purpose
Cierra el pilar del producto: personalizar el aspecto sin tocar código y ver el efecto mientras se elige, sobre el contenido real del perfil.

## Requirements

### Requirement: Edición de design tokens
El customizador SHALL permitir editar, sobre el tema base elegido, los ocho colores (`bg`, `bgSoft`, `card`, `border`, `text`, `textMuted`, `accent`, `accent2`) con selector de color y campo hexadecimal, la tipografía (`fontSans`, `fontHeading`), el modo claro/oscuro, la densidad (`compact`, `comfortable`, `spacious`) y el radio, con los mismos tokens que define `docs/ARCHITECTURE.md` §8.1.

#### Scenario: Cambiar un color
- **WHEN** se elige `#ff5500` como `accent`
- **THEN** el campo hexadecimal muestra `#ff5500` y el preview usa ese color de acento

#### Scenario: Hexadecimal inválido
- **WHEN** se escribe `no-es-color` en un campo de color
- **THEN** se marca el campo como inválido y el preview conserva el último valor válido

#### Scenario: Modo y densidad
- **WHEN** se cambia el modo a claro y la densidad a `compact`
- **THEN** el preview cambia a la paleta clara y reduce el espaciado

### Requirement: Preview en tiempo real sin ir a la red
Cada cambio de token SHALL reflejarse en el preview de forma inmediata aplicando los tokens en el cliente con el motor de theming, **sin** pedir de nuevo los datos al servidor. Solo los cambios que alteran la selección de contenido (tags, inclusiones, exclusiones, layout, secciones) vuelven a llamar al preview del backend.

#### Scenario: Inmediatez
- **WHEN** se arrastra el selector de color del acento
- **THEN** el preview cambia de color sin que se produzca ninguna petición HTTP

#### Scenario: Los datos no se pierden
- **WHEN** se cambian varios tokens seguidos
- **THEN** el preview mantiene las mismas experiencias y skills que ya había resuelto

### Requirement: Tema base y overrides
El customizador SHALL partir del tema base (`themeId`) y guardar únicamente las diferencias como `themeOverrides` del perfil curado. Cambiar el tema base SHALL descartar los overrides previos tras confirmación. Restablecer SHALL dejar `themeOverrides` vacío.

#### Scenario: Solo se guardan las diferencias
- **WHEN** sobre `modern-dark` solo se cambia el acento y se guarda
- **THEN** el `PATCH` envía `themeOverrides` con ese color y sin el resto de los tokens

#### Scenario: Restablecer
- **WHEN** se pulsa restablecer y se guarda
- **THEN** `themeOverrides` queda vacío y el perfil vuelve a verse como su tema base

#### Scenario: Cambiar de tema base
- **WHEN** hay overrides y se elige otro tema base
- **THEN** se pide confirmación explicando que se perderán los ajustes

### Requirement: Persistencia visible en la vista pública
Al guardar, los tokens ajustados SHALL aplicarse a la vista pública del perfil, que los recibe ya mergeados desde la API.

#### Scenario: Del customizador a la vista pública
- **WHEN** se guarda un acento `#c81d4e` y se abre el link público del perfil sin `?theme=`
- **THEN** la vista pública renderiza con ese acento
