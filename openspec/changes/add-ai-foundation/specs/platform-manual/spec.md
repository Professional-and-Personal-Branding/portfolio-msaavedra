## ADDED Requirements

### Requirement: Caso TC-54 de la base de IA
El manual SHALL incluir el caso TC-54 «Ver el gasto de IA y probar la conexión» y ampliar B18 Integraciones con el bloque «Inteligencia artificial», las variables `AI_*`, la clave, el tope y el spend limit de la Console, con capturas generadas por `manual:capture` con `AI_PROVIDER=fake`, sin red ni clave real.

#### Scenario: Caso TC-54 alineado
- **WHEN** se ejecuta `npm run manual:check` con TC-54 en `MANUAL.md` e `index.html`
- **THEN** termina con código 0 y las capturas nuevas figuran en el inventario

#### Scenario: Mensajes literales
- **WHEN** se lee B18
- **THEN** lista literalmente «La IA está apagada», «Se alcanzó el tope de IA del mes» y «Anthropic cortó por el spend limit»
