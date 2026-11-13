import { budgetExhausted, ProviderFailure, transient } from '../provider-failure';

/** Topes de las pistas del tercero (revisión de seguridad M2): un valor enorme no puede congelar al proveedor. */
export const MAX_RETRY_AFTER_SECONDS = 24 * 60 * 60;
export const MAX_RESET_HORIZON_MS = 7 * 24 * 60 * 60 * 1000;

const validDate = (date: Date): boolean => Number.isFinite(date.getTime());

/**
 * Normaliza un fallo antes de usarlo: descarta pistas no finitas o fechas inválidas (pasan a `Transient`),
 * acota `RetryAfter` a 24 h y `ResetAt`/`BudgetExhausted` a 7 días, y lleva a «ahora» una fecha pasada.
 * Idempotente y pura.
 */
export function sanitizeFailure(failure: ProviderFailure, now: Date): ProviderFailure {
  const horizon = now.getTime() + MAX_RESET_HORIZON_MS;
  switch (failure.kind) {
    case 'RetryAfter':
      if (!Number.isFinite(failure.seconds)) return transient(failure.message);
      return {
        ...failure,
        seconds: Math.min(MAX_RETRY_AFTER_SECONDS, Math.max(1, Math.ceil(failure.seconds))),
      };
    case 'ResetAt':
      if (!validDate(failure.at)) return transient(failure.message);
      return {
        ...failure,
        at: new Date(Math.min(horizon, Math.max(now.getTime(), failure.at.getTime()))),
      };
    case 'BudgetExhausted':
      if (failure.resetAt === undefined) return failure;
      if (!validDate(failure.resetAt)) return budgetExhausted(failure.message);
      return budgetExhausted(
        failure.message,
        new Date(Math.min(horizon, Math.max(now.getTime(), failure.resetAt.getTime()))),
      );
    default:
      return failure;
  }
}
