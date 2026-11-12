import { ConnectorPort, ConnectorRegistry } from '../../application/ports/connector.port';
import { isKnownProvider } from '../../domain/provider-catalog';

/**
 * Registro de los conectores **habilitados** por `INTEGRATIONS_ENABLED` (D1, D11). Un id fuera
 * del catálogo, o sin conector implementado, hace fallar el arranque.
 */
export class EnabledConnectorRegistry implements ConnectorRegistry {
  private readonly byId = new Map<string, ConnectorPort>();

  constructor(enabled: readonly string[], available: readonly ConnectorPort[]) {
    for (const id of enabled) {
      const connector = available.find((c) => c.id === id);
      if (!isKnownProvider(id) || !connector) {
        throw new Error(
          'INTEGRATIONS_ENABLED: incluye un proveedor sin conector registrado en esta versión',
        );
      }
      this.byId.set(id, connector);
    }
  }

  get(provider: string): ConnectorPort | undefined {
    return this.byId.get(provider);
  }

  ids(): readonly string[] {
    return [...this.byId.keys()];
  }
}
