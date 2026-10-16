# layout-engine Specification (delta)

## ADDED Requirements

### Requirement: Columna única del layout sidebar en móvil
Por debajo del breakpoint `lg`, la grilla de `SidebarLayout` SHALL declarar una sola columna que ocupa todo el ancho del contenedor, de modo que el ancho del aside y del contenido no dependa de qué secciones estén renderizadas.

#### Scenario: Ancho estable en móvil
- **WHEN** a 375 px de ancho se renderiza `SidebarLayout` primero solo con `hero` y después con todas las secciones
- **THEN** el aside tiene el mismo ancho en los dos renders y no hay scroll horizontal

#### Scenario: Escritorio sin cambios
- **WHEN** el viewport es de 1280 px
- **THEN** la grilla conserva la columna lateral de 320 px y el contenido a la derecha
