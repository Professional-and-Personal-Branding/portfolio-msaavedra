# printable-curated-profile Specification

## Purpose
Que un perfil curado se pueda imprimir o guardar como PDF en una hoja legible, en A4 y en Letter, desde la misma vista pública y en su idioma, con cualquier tema. La hoja respeta lo que el perfil decidió mostrar, dice lo que omite y no registra nada.

## Requirements

### Requirement: Hoja imprimible en la misma vista
Con el perfil resuelto, `/` y `/:slug` SHALL montar una hoja imprimible (`data-print-sheet`) que en pantalla no se muestra ni está en el árbol de accesibilidad. Al imprimir, con el botón o con Ctrl+P, SHALL imprimirse solo esa hoja: la barra superior, el pie, la decoración y el layout de pantalla MUST NOT imprimirse. No SHALL existir una ruta ni un parámetro propios para imprimir.

#### Scenario: Ctrl+P en un perfil
- **WHEN** se abre `/tech-lead-dotnet` y se imprime con Ctrl+P sin hacer scroll
- **THEN** la vista previa muestra la hoja con nombre, titular y experiencia, sin barra superior, selectores ni pie

#### Scenario: Oculta en pantalla
- **WHEN** se abre `/tech-lead-dotnet` en pantalla
- **THEN** la hoja tiene `display: none` y un lector de pantalla no la anuncia

#### Scenario: Estados sin perfil
- **WHEN** la vista está en carga, pide token, da 404 o muestra error
- **THEN** no hay hoja imprimible en el DOM

### Requirement: Contenido y orden de la hoja
La hoja SHALL abrir con un encabezado de identidad (nombre, titular, email, ubicación y LinkedIn) y seguir con bloques en el orden de `sections` de la respuesta. Una sección ausente de `sections` MUST NOT imprimirse. `stats` MUST NOT imprimirse. `contact` y `presence` SHALL sumar datos al encabezado en lugar de imprimirse como bloque. El cliente MUST NOT reordenar.

#### Scenario: Orden del perfil
- **WHEN** `sections = ["hero","skills","experience","education"]`
- **THEN** los bloques de la hoja son Perfil, Skills, Experiencia y Formación, en ese orden

#### Scenario: Sección oculta
- **WHEN** el perfil oculta `certifications`
- **THEN** la hoja no tiene bloque de certificaciones

#### Scenario: Contacto en el encabezado
- **WHEN** `sections` incluye `contact` y el perfil tiene teléfono e idiomas
- **THEN** el encabezado muestra teléfono, idiomas y disponibilidad, y no hay un bloque Contacto aparte

### Requirement: Límites de contenido
La hoja SHALL aplicar los límites de `PRINT_LIMITS`: 3 experiencias en detalle con hasta 2 logros y 8 tecnologías cada una, después hasta 3 en una línea; 3 categorías de skills con hasta 10 skills; 2 proyectos; 3 formaciones; 4 certificaciones; resumen de 4 líneas como máximo. Las experiencias SHALL seguir el orden canónico de la API. Cambiar un límite exige actualizar esta spec.

#### Scenario: Perfil con 13 experiencias
- **WHEN** se arma la hoja de un perfil con 13 experiencias
- **THEN** hay 3 en detalle, 3 en una línea y una línea de omitidos que dice que hay 7 más

#### Scenario: Logros recortados
- **WHEN** la experiencia más reciente tiene 12 logros
- **THEN** la hoja muestra sus 2 primeros

### Requirement: Lo omitido se dice
Cada recorte de cantidad SHALL dejar una línea de omitidos con la cantidad, en el idioma de la vista. La hoja SHALL cerrar con la URL de la versión completa. Ningún dato SHALL ocultarse en el DOM impreso sin esa indicación: no se usa `overflow: hidden` ni se escala la hoja para que entre.

#### Scenario: Omitidos en inglés
- **WHEN** se imprime `/all?lang=en` y hay certificaciones fuera del límite
- **THEN** la hoja indica en inglés cuántas certificaciones más hay y muestra la URL de la versión completa

### Requirement: Una hoja con los datos verificados
Para cada perfil público y enumerado, más `all`, de la base de verificación, en `es` y en `en`, la hoja SHALL ocupar exactamente una página en A4 y en Letter con los márgenes de `@page` (12 mm) y sin gráficos de fondo, también con `?theme=modern-dark&layout=sidebar`. El contenedor raíz MUST NOT agregar una página en blanco.

#### Scenario: Conteo de páginas
- **WHEN** se corre `npm run print:check` contra la app con los datos de verificación
- **THEN** cada combinación de perfil, idioma, papel y tema da un PDF de una página y el script sale con código 0

#### Scenario: Override de layout por URL
- **WHEN** se imprime `/tech-lead-dotnet?layout=sidebar`
- **THEN** la hoja es la misma que sin el parámetro

### Requirement: Desborde ordenado
Si el contenido supera una página, la hoja SHALL continuar en la siguiente sin recortar texto. Ninguna entrada (experiencia, formación, proyecto) SHALL quedar partida entre dos páginas.

#### Scenario: Datos fuera de lo verificado
- **WHEN** una experiencia en detalle tiene logros muy largos y la hoja no entra en una página
- **THEN** la impresión tiene dos páginas, la entrada que no entra pasa entera a la segunda y no falta texto

### Requirement: Tinta sobre papel con cualquier tema
La hoja SHALL imprimirse con la paleta de papel (texto oscuro sobre blanco, contraste ≥ 4,5:1) con cualquier preset, override o `?theme=`, conservando la tipografía del perfil. El acento del perfil MUST NOT usarse en texto. La hoja MUST NOT usar texto con degradé recortado ni depender de fondos para ser legible.

#### Scenario: Preset oscuro
- **WHEN** se imprime `/tech-lead-dotnet?theme=modern-dark` sin gráficos de fondo
- **THEN** el texto sale oscuro sobre blanco y el nombre es visible

#### Scenario: Con gráficos de fondo
- **WHEN** se imprime el mismo perfil con gráficos de fondo activados
- **THEN** la página es blanca y no aparece el fondo oscuro del tema

### Requirement: Las animaciones no ocultan contenido
La hoja MUST NOT usar `MotionSection` ni componentes de `motion`. Al imprimir, todo elemento `[data-motion="on"]` SHALL tener opacidad 1 y sin transformación, aunque nunca haya entrado en el viewport.

#### Scenario: Animaciones activas y sin scroll
- **WHEN** el tema tiene `effects.animations = true` y se imprime apenas carga el perfil
- **THEN** todos los bloques de la hoja salen con su texto completo

#### Scenario: Hoja sin motion
- **WHEN** se renderiza la hoja en un test
- **THEN** no contiene ningún elemento con `data-motion`

### Requirement: Enlaces legibles y URL sin token
Email, teléfono, LinkedIn y los enlaces destacados (hasta 2) SHALL imprimirse como texto visible. La URL de la versión completa SHALL ser la canónica del perfil, con `?lang=` si el idioma no es `es`, y MUST NOT incluir `token`, `theme` ni `layout`.

#### Scenario: Perfil protegido
- **WHEN** se imprime `/dotnet-backend?token=<válido>&theme=elegant`
- **THEN** la URL impresa es la canónica de `/dotnet-backend` sin `token` ni `theme`

#### Scenario: Idioma inglés
- **WHEN** se imprime `/fullstack-nest-react?lang=en`
- **THEN** la URL impresa termina en `/fullstack-nest-react?lang=en`

### Requirement: Botón Imprimir / Guardar PDF
Con el perfil resuelto, la barra superior SHALL mostrar un botón "Imprimir / Guardar PDF" ("Print / Save as PDF" en inglés) que llama a `window.print()`. En móvil SHALL quedar el icono con `aria-label`. En carga, token pendiente, 404 o error, el botón MUST NOT mostrarse. El botón MUST NOT imprimirse.

#### Scenario: Clic en el botón
- **WHEN** se pulsa el botón en `/tech-lead-dotnet`
- **THEN** se abre el diálogo de impresión del navegador con la hoja

#### Scenario: Sin perfil resuelto
- **WHEN** `/dotnet-backend` pide token
- **THEN** la barra superior no muestra el botón

### Requirement: Imprimir no registra ni pide nada
Imprimir MUST NOT hacer peticiones a la API ni registrar visitas o métricas. La hoja SHALL usar los datos ya cargados. El título del documento MUST NOT cambiar al imprimir.

#### Scenario: Sin peticiones
- **WHEN** con el perfil cargado se pulsa el botón de imprimir
- **THEN** no sale ninguna petición nueva a `/api/*` y el contador de visitas del perfil no cambia

### Requirement: Sin recursos nuevos en el borde
La hoja y el botón MUST NOT agregar scripts inline, recursos de otros orígenes ni dependencias de runtime. La CSP del sitio SHALL quedar igual y el sitio SHALL imprimir sin violaciones de CSP en la consola.

#### Scenario: Impresión en el contenedor web
- **WHEN** se abre un perfil en el contenedor `web` con la CSP activa y se usa el botón de imprimir
- **THEN** la hoja se imprime y la consola no registra violaciones de CSP

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
