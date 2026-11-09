## MODIFIED Requirements

### Requirement: Tope de tamaño del manual
Cada imagen de `docs/manual/` MUST pesar hasta 150 KB, el total de imágenes hasta 4 MB e `index.html` hasta 1 MB, para que el manual se pueda publicar como artifact con margen y un peso anómalo (por ejemplo, una imagen embebida) se detecte. `npm run manual:check` SHALL terminar con código 1 si se supera algún tope.

#### Scenario: Captura pesada
- **WHEN** una captura pesa 186 KB y se ejecuta `npm run manual:check`
- **THEN** termina con código 1 nombrando el archivo y su tamaño

#### Scenario: HTML dentro del tope
- **WHEN** `index.html` pesa 320 KB y se ejecuta `npm run manual:check`
- **THEN** no informa un error de tamaño para `index.html`

#### Scenario: HTML pesado
- **WHEN** `index.html` pesa 1,2 MB y se ejecuta `npm run manual:check`
- **THEN** termina con código 1 nombrando `index.html`, su tamaño y el tope de 1 MB
