import { ProviderFailure } from '../provider-failure';
import { nextRetryDelay } from '../services/next-retry-delay';

/** Cuántos `Transient` seguidos abren el breaker (D10). */
export const BREAKER_THRESHOLD = 5;
/** Horas sin una corrida exitosa para marcar el proveedor como atrasado (D17). */
export const STALE_AFTER_HOURS = 48;

export type PauseReason = 'RetryAfter' | 'ResetAt' | 'BudgetExhausted' | 'CircuitOpen';

export interface IntegrationSettingProps {
  readonly provider: string;
  readonly enabled: boolean;
  readonly pausedUntil: Date | null;
  readonly pauseReason: PauseReason | null;
  readonly consecutiveFailures: number;
  readonly lastSuccessAt: Date | null;
  readonly enabledSince: Date;
  readonly updatedAt: Date;
}

/**
 * Estado por proveedor: kill switch, pausa por pista del tercero y circuit breaker (D10).
 * Inmutable: cada operación devuelve una copia.
 */
export class IntegrationSetting {
  constructor(readonly props: IntegrationSettingProps) {}

  static initial(provider: string, now: Date): IntegrationSetting {
    return new IntegrationSetting({
      provider,
      enabled: true,
      pausedUntil: null,
      pauseReason: null,
      consecutiveFailures: 0,
      lastSuccessAt: null,
      enabledSince: now,
      updatedAt: now,
    });
  }

  get provider(): string {
    return this.props.provider;
  }
  get enabled(): boolean {
    return this.props.enabled;
  }

  private with(patch: Partial<IntegrationSettingProps>, now: Date): IntegrationSetting {
    return new IntegrationSetting({ ...this.props, ...patch, updatedAt: now });
  }

  /** ¿Se pueden reclamar trabajos de este proveedor ahora? */
  isClaimable(now: Date): boolean {
    const { enabled, pausedUntil } = this.props;
    return enabled && (pausedUntil === null || pausedUntil.getTime() <= now.getTime());
  }

  /** Pausa a mano (`enabled = false`) o reanudación; al reanudar se reinicia `enabledSince`. */
  withEnabled(enabled: boolean, now: Date): IntegrationSetting {
    if (enabled === this.props.enabled) return this;
    return this.with(
      enabled ? { enabled, enabledSince: now, pausedUntil: null, pauseReason: null } : { enabled },
      now,
    );
  }

  /** Éxito: cierra el breaker y levanta cualquier pausa. */
  recordSuccess(now: Date): IntegrationSetting {
    return this.with(
      { consecutiveFailures: 0, lastSuccessAt: now, pausedUntil: null, pauseReason: null },
      now,
    );
  }

  /**
   * Un fallo del proveedor. La pista del tercero pausa al proveedor entero; los `Transient`
   * suman al breaker, que abre al llegar a 5 y vuelve a abrir en cada fallo del semiabierto.
   */
  recordFailure(
    failure: ProviderFailure,
    now: Date,
    random: () => number = Math.random,
  ): IntegrationSetting {
    switch (failure.kind) {
      case 'RetryAfter':
        return this.with(
          {
            pausedUntil: new Date(now.getTime() + failure.seconds * 1000),
            pauseReason: 'RetryAfter',
          },
          now,
        );
      case 'ResetAt':
        return this.with({ pausedUntil: failure.at, pauseReason: 'ResetAt' }, now);
      case 'BudgetExhausted':
        return failure.resetAt === undefined
          ? this
          : this.with({ pausedUntil: failure.resetAt, pauseReason: 'BudgetExhausted' }, now);
      case 'Transient': {
        const consecutiveFailures = this.props.consecutiveFailures + 1;
        if (consecutiveFailures < BREAKER_THRESHOLD) {
          return this.with({ consecutiveFailures }, now);
        }
        return this.with(
          {
            consecutiveFailures,
            pausedUntil: new Date(now.getTime() + nextRetryDelay(consecutiveFailures, random)),
            pauseReason: 'CircuitOpen',
          },
          now,
        );
      }
      case 'Permanent':
        return this;
    }
  }
}

/**
 * Sin una corrida exitosa hace más de 48 h (D17). Un proveedor pausado a mano no se marca
 * (la pausa es intencional); uno pausado por el breaker sí. El filtro por
 * `INTEGRATIONS_ENABLED` lo aplica quien llama.
 */
export function isProviderStale(setting: IntegrationSetting, now: Date): boolean {
  const { enabled, lastSuccessAt, enabledSince } = setting.props;
  if (!enabled) return false;
  const reference = lastSuccessAt ?? enabledSince;
  return now.getTime() - reference.getTime() > STALE_AFTER_HOURS * 3_600_000;
}
