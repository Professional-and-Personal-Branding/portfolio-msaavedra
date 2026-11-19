## MODIFIED Requirements

### Requirement: Texto de la vacante por 90 días
La descripción SHALL guardarse con `textPurgeAt` a 90 días de la importación y SHALL borrarse, conservando metadatos y términos, al listar, leer o importar vacantes y con `npm run job-postings:purge -- --apply`, sin depender de ningún scheduler. Sin `--apply`, el comando SHALL solo informar cuántas purgaría, sin escribir. Reimportar SHALL renovar el plazo.

#### Scenario: Purga perezosa
- **WHEN** con el reloj 91 días después de importar se lista `GET /api/admin/job-postings`
- **THEN** esa vacante tiene `description: null`, conserva título y términos, y la sugerencia sigue respondiendo

#### Scenario: Comando de purga
- **WHEN** se corre `npm run job-postings:purge -- --apply` con dos vacantes vencidas
- **THEN** imprime que purgó 2 y termina con código 0

#### Scenario: Simulación por defecto
- **WHEN** se corre `npm run job-postings:purge` sin `--apply` con dos vacantes vencidas
- **THEN** imprime que purgaría 2, termina con código 0 y las dos conservan su `description`
