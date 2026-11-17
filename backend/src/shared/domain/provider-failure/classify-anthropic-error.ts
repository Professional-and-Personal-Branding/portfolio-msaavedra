import {
  budgetExhausted,
  permanent,
  ProviderFailure,
  retryAfter,
  transient,
} from './provider-failure';

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

// Texto confirmado del 400 del límite fijado en la Console (organización o workspace): empieza así.
const CONSOLE_LIMIT_PREFIX = /^You have reached your specified (workspace )?API usage limits/i;
// Heurística heredada para otras variantes del texto (se mantiene por si el mensaje cambia).
const SPEND_TEXT = /spend limit|usage limit/i;

/**
 * Distingue el corte de presupuesto de la API de Anthropic de un error común. Con el change
 * `add-ai-foundation` el texto del 400 de la Console quedó confirmado en la documentación oficial
 * (2026-11-17); un 429 `ramp_limit_exceeded` es un límite de rampa, nunca presupuesto, y un 400 por
 * un parámetro inválido sigue siendo `Permanent` (que tampoco se reintenta).
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
    const message = error.message ?? '';
    if (
      error.type === 'invalid_request_error' &&
      (CONSOLE_LIMIT_PREFIX.test(message) || SPEND_TEXT.test(message))
    ) {
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
