import { AiModelId, MICRO_USD_PER_USD, ratesFor } from './model-pricing';

/** Uso informado por el proveedor (campos de `usage`). */
export interface LlmUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cacheReadTokens: number;
  readonly cacheWriteTokens: number;
}

export const ZERO_USAGE: LlmUsage = {
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
};

/** Margen sobre el conteo: es una estimación y no incluye lo que agrega el formato estructurado (D7). */
export const INPUT_MARGIN_RATIO = 1.1;
export const INPUT_MARGIN_TOKENS = 512;

/** Tokens de entrada que se reservan a partir del conteo de `count_tokens`. */
export function estimatedInputTokens(countedInputTokens: number): number {
  return Math.ceil(countedInputTokens * INPUT_MARGIN_RATIO) + INPUT_MARGIN_TOKENS;
}

export interface ReservationInput {
  readonly model: AiModelId;
  readonly countedInputTokens: number;
  readonly maxTokens: number;
  readonly cacheSystemPrompt: boolean;
}

/**
 * Peor caso de una llamada, en micro-USD enteros, redondeado hacia arriba (D7): la entrada
 * estimada al precio de entrada (o al de escritura de caché si la tarea la usa) más
 * `max_tokens` al precio de salida. El thinking cuenta dentro de `max_tokens`.
 */
export function estimateReservation(input: ReservationInput): number {
  const inputTokens = estimatedInputTokens(input.countedInputTokens);
  const rates = ratesFor(input.model, inputTokens);
  const inputRate = input.cacheSystemPrompt ? rates.cacheWrite5m : rates.input;
  return Math.ceil((inputTokens * inputRate + input.maxTokens * rates.output) / MICRO_USD_PER_USD);
}

/**
 * Costo real a partir del `usage`, en micro-USD enteros hacia arriba (D19):
 * `input × entrada + escritura × escritura5m + lectura × lectura + output × salida`.
 */
export function computeCost(model: AiModelId, usage: LlmUsage): number {
  const total = usage.inputTokens + usage.cacheWriteTokens + usage.cacheReadTokens;
  const rates = ratesFor(model, total);
  const numerator =
    usage.inputTokens * rates.input +
    usage.cacheWriteTokens * rates.cacheWrite5m +
    usage.cacheReadTokens * rates.cacheRead +
    usage.outputTokens * rates.output;
  return Math.ceil(numerator / MICRO_USD_PER_USD);
}

/** USD (número) a partir de micro-USD enteros. */
export function microToUsd(micro: number): number {
  return micro / MICRO_USD_PER_USD;
}

/** Micro-USD enteros a partir de USD (hasta 2 decimales en la configuración). */
export function usdToMicro(usd: number): number {
  return Math.round(usd * MICRO_USD_PER_USD);
}
