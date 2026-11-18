export type AiUsageState = 'DISABLED' | 'OK' | 'NEAR_LIMIT' | 'EXHAUSTED' | 'PROVIDER_BLOCKED';

/** Desde este porcentaje del tope (gastado + reservado) el panel avisa «cerca del tope» (P7). */
export const NEAR_LIMIT_RATIO = 0.8;

export interface AiUsageStateInput {
  readonly enabled: boolean;
  readonly capMicroUsd: number;
  readonly spentMicroUsd: number;
  readonly reservedMicroUsd: number;
  readonly providerBlockedUntil: Date | null;
  readonly now: Date;
}

/**
 * Estado de la IA para el panel (D18). `EXHAUSTED` incluye el tope 0 y gana sobre el bloqueo del
 * proveedor: el tope propio es el hecho local más estricto.
 */
export function computeAiUsageState(input: AiUsageStateInput): AiUsageState {
  if (!input.enabled) return 'DISABLED';
  const used = input.spentMicroUsd + input.reservedMicroUsd;
  if (input.capMicroUsd <= 0 || used >= input.capMicroUsd) return 'EXHAUSTED';
  if (input.providerBlockedUntil !== null && input.providerBlockedUntil > input.now) {
    return 'PROVIDER_BLOCKED';
  }
  if (used >= input.capMicroUsd * NEAR_LIMIT_RATIO) return 'NEAR_LIMIT';
  return 'OK';
}
