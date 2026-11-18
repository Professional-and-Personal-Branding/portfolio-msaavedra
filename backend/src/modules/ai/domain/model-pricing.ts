/**
 * Tabla de precios versionada en el código (change `add-ai-foundation`, D19). Se expresa en
 * micro-USD por millón de tokens (1 USD = 1 000 000 micro-USD), todo entero. Cambiarla es un
 * cambio de código revisable; el panel muestra `PRICING_VERIFIED_AT`.
 */
export const PRICING_VERIFIED_AT = '2026-11-17';
export const PRICING_SOURCE_URL = 'https://platform.claude.com/docs/en/about-claude/pricing';

/** Modelos permitidos: un modelo fuera del registro no compila (D4). */
export const ALLOWED_MODELS = ['claude-haiku-5-5', 'claude-sonnet-5-5'] as const;
export type AiModelId = (typeof ALLOWED_MODELS)[number];

export function isAllowedModel(model: string): model is AiModelId {
  return (ALLOWED_MODELS as readonly string[]).includes(model);
}

export interface ModelRates {
  /** Entrada sin caché. */
  readonly input: number;
  /** Escritura de caché, TTL de 5 minutos. */
  readonly cacheWrite5m: number;
  readonly cacheRead: number;
  readonly output: number;
}

export const MICRO_USD_PER_USD = 1_000_000;
/** Haiku 5.5 cobra otra tarifa cuando la entrada total supera este umbral. */
export const HAIKU_LONG_PROMPT_THRESHOLD = 100_000;

const HAIKU_RATES: ModelRates = {
  input: 100_000,
  cacheWrite5m: 125_000,
  cacheRead: 10_000,
  output: 500_000,
};
const HAIKU_LONG_RATES: ModelRates = {
  input: 500_000,
  cacheWrite5m: 625_000,
  cacheRead: 50_000,
  output: 2_500_000,
};
const SONNET_RATES: ModelRates = {
  input: 2_000_000,
  cacheWrite5m: 2_500_000,
  cacheRead: 100_000,
  output: 10_000_000,
};

/**
 * Tarifa de un modelo. Para Haiku 5.5 se elige por la entrada total del prompt
 * (`input + escritura + lectura de caché`): hasta 100 000 tokens la básica, más la alta.
 */
export function ratesFor(model: AiModelId, totalInputTokens: number): ModelRates {
  if (model === 'claude-haiku-5-5') {
    return totalInputTokens > HAIKU_LONG_PROMPT_THRESHOLD ? HAIKU_LONG_RATES : HAIKU_RATES;
  }
  return SONNET_RATES;
}
