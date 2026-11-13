import {
  budgetExhausted,
  permanent,
  ProviderFailure,
  retryAfter,
  transient,
} from '../provider-failure';

export interface AnthropicErrorInput {
  readonly status?: number;
  readonly body?: unknown;
  /** Valor de la cabecera `retry-after`, si vino. */
  readonly retryAfter?: string;
  readonly now?: Date;
}

interface ErrorBody {
  type?: string;
  message?: string;
  details?: { error_code?: string };
}

function errorOf(body: unknown): ErrorBody {
  if (typeof body !== 'object' || body === null) return {};
  const error = (body as { error?: unknown }).error;
  return typeof error === 'object' && error !== null ? error : {};
}

/** Día 1 del mes siguiente a las 00:00 UTC: cuando se reinicia el tope mensual de gasto. */
function nextMonthStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}

const SPEND_TEXT = /spend limit|usage limit/i;

/**
 * Distingue el corte de presupuesto de la API de Anthropic de un error común (D9, para 2.0).
 * El texto exacto del 400 por tope de la Console NO está confirmado (P4): se trata por
 * heurística y un 400 con otro texto queda como `Permanent`, que tampoco se reintenta.
 */
export function classifyAnthropicError(input: AnthropicErrorInput): ProviderFailure {
  const now = input.now ?? new Date();
  if (input.status === undefined) return transient('error de red o timeout');
  const { status } = input;
  const error = errorOf(input.body);

  if (
    status === 429 &&
    error.type === 'rate_limit_error' &&
    error.details?.error_code === 'enforced_spend_limit_reached'
  ) {
    return budgetExhausted('tope de gasto mensual alcanzado', nextMonthStart(now));
  }
  if (status === 402 && error.type === 'billing_error') {
    return budgetExhausted('error de facturación: sin saldo o tope alcanzado');
  }
  if (status === 400) {
    if (error.type === 'invalid_request_error' && SPEND_TEXT.test(error.message ?? '')) {
      return budgetExhausted('tope de gasto o de uso alcanzado');
    }
    return permanent('HTTP 400: solicitud inválida');
  }
  if (status === 429) {
    const hint = input.retryAfter?.trim();
    if (hint !== undefined && /^\d+$/.test(hint) && Number.isFinite(Number(hint))) {
      return retryAfter(Math.max(1, Number(hint)), 'HTTP 429: límite de peticiones');
    }
    return transient('HTTP 429: límite de peticiones sin pistas');
  }
  if (status >= 500) return transient(`HTTP ${status}`);
  return permanent(`HTTP ${status}`);
}
