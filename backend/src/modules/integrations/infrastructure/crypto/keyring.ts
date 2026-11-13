import { parseKeyring } from '../../../../config/integrations-keys';

/**
 * Llavero de las credenciales (D12): claves de 32 bytes por `kid` y la activa con la que se
 * cifra. Sin `INTEGRATIONS_KEYS` queda vacío (las integraciones están apagadas); cualquier
 * intento de cifrar falla en voz alta. Nunca expone ni loguea el material de las claves.
 */
export class Keyring {
  constructor(
    private readonly keys: ReadonlyMap<string, Buffer>,
    readonly activeKeyId: string,
  ) {}

  static fromConfig(rawKeys: string | undefined, activeKeyId: string | undefined): Keyring {
    const parsed = parseKeyring(rawKeys);
    if (parsed.issues.length > 0) {
      throw new Error(`Keyring inválido: ${parsed.issues.join('; ')}`);
    }
    if (parsed.keys.size > 0 && (!activeKeyId || !parsed.keys.has(activeKeyId))) {
      throw new Error('INTEGRATIONS_ACTIVE_KEY no figura en INTEGRATIONS_KEYS');
    }
    return new Keyring(parsed.keys, activeKeyId ?? '');
  }

  get isEmpty(): boolean {
    return this.keys.size === 0;
  }

  get(keyId: string): Buffer | undefined {
    return this.keys.get(keyId);
  }

  active(): Buffer {
    const key = this.keys.get(this.activeKeyId);
    if (!key)
      throw new Error('No hay clave activa: definí INTEGRATIONS_KEYS e INTEGRATIONS_ACTIVE_KEY');
    return key;
  }
}
