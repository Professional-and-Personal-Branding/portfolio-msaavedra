## Purpose

Toda la vista cambia de idioma con un solo control: los datos vienen resueltos de la API y los textos de interfaz salen de un diccionario mínimo, ambos gobernados por el mismo locale.

## ADDED Requirements

### Requirement: Locale por URL con detección inicial
El locale activo SHALL leerse de `?lang=` (`es|en`); si falta, SHALL derivarse de `navigator.language` (`en*` → `en`, resto → `es`). Cambiarlo con el selector SHALL actualizar `?lang=` sin recargar. MUST NOT usarse `localStorage`/`sessionStorage`.

#### Scenario: Parámetro explícito
- **WHEN** se abre `/all?lang=en`
- **THEN** el locale activo es `en`

#### Scenario: Detección
- **WHEN** se abre `/all` sin `lang` en un navegador con `navigator.language = "en-US"`
- **THEN** el locale activo es `en`; con `"es-BO"` es `es`

#### Scenario: Selector
- **WHEN** el visitante pulsa `EN` en el selector
- **THEN** la URL pasa a incluir `lang=en` y no hay recarga

### Requirement: Propagación a la API y a la interfaz
Toda petición a la API SHALL enviar `?locale=<activo>`. Los textos de interfaz (títulos de sección, etiquetas, estados) SHALL salir de un diccionario `es`/`en`; una clave sin traducción SHALL caer a `es`.

#### Scenario: Cambio total de idioma
- **WHEN** el locale pasa de `es` a `en`
- **THEN** los títulos de sección ("Experiencia Profesional" → "Professional Experience") y los datos (`experiences[].role`) cambian a inglés

#### Scenario: Petición con locale
- **WHEN** se carga `/tech-lead-dotnet` con locale `en`
- **THEN** la petición es `GET /api/curated-profiles/tech-lead-dotnet?locale=en`

#### Scenario: Clave sin traducción
- **WHEN** falta la traducción `en` de una clave
- **THEN** se muestra el texto en `es`
