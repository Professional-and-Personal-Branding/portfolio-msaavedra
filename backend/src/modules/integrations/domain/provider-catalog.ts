/**
 * Catálogo de proveedores conocidos (D11). Cada change de proveedor suma su entrada. El conector
 * real vive en infraestructura; aquí solo lo que la validación del arranque y el dominio necesitan.
 */
export interface ProviderDescriptor {
  readonly id: string;
  /** Variables de entorno que se exigen al arrancar si el proveedor está en `INTEGRATIONS_ENABLED`. */
  readonly requiredEnv: readonly string[];
  /** Variable que, si está definida, aporta el secreto (tiene prioridad sobre la base, D14). */
  readonly secretEnv: string | null;
  readonly allowedInProduction: boolean;
}

export const PROVIDER_CATALOG: Readonly<Record<string, ProviderDescriptor>> = {
  fake: {
    id: 'fake',
    requiredEnv: ['FAKE_PROVIDER_TOKEN'],
    secretEnv: 'FAKE_PROVIDER_TOKEN',
    allowedInProduction: false,
  },
};

export function isKnownProvider(id: string): boolean {
  return Object.prototype.hasOwnProperty.call(PROVIDER_CATALOG, id);
}

/** Lista separada por comas de `INTEGRATIONS_ENABLED`, sin vacíos ni repetidos. */
export function parseEnabledProviders(raw: string | undefined): string[] {
  if (!raw) return [];
  return [
    ...new Set(
      raw
        .split(',')
        .map((id) => id.trim())
        .filter((id) => id.length > 0),
    ),
  ];
}
