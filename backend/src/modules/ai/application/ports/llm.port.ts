import type { ZodType } from 'zod';
import { ProviderFailure } from '../../../../shared/domain/provider-failure/provider-failure';
import { Result } from '../../../../shared/domain/result';
import { LlmUsage } from '../../domain/estimate-cost';
import { AiModelId } from '../../domain/model-pricing';

/** Token de inyección del puerto hacia el modelo. */
export const LLM_PORT = Symbol('LlmPort');

export type AiEffort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';
export type AiThinking = 'off' | 'adaptive';

/**
 * Petición a un modelo (D5). No expone tipos del SDK ni `temperature`, `top_p`, `top_k`, prefill ni
 * `tool_choice`: desde la versión de API 2026-10-21 los primeros dan 400 en todos los modelos.
 */
export interface LlmRequest<T = unknown> {
  readonly task: string;
  /** Clave de caché de la corrida: no se envía; la usan los cassettes y los logs de prueba. */
  readonly cacheKey: string;
  readonly model: AiModelId;
  readonly effort: AiEffort;
  readonly thinking: AiThinking;
  readonly maxTokens: number;
  readonly system: string;
  /** Si es `true`, el system prompt va con `cache_control` efímero. */
  readonly cacheSystemPrompt: boolean;
  /** Mensaje del usuario, con la entrada delimitada como dato. */
  readonly user: string;
  readonly schema: ZodType<T>;
}

export interface LlmCompletion<T> {
  readonly output: T;
  readonly usage: LlmUsage;
  readonly stopReason: string;
  readonly requestId: string | null;
  readonly model: string;
}

/** Datos de una respuesta facturada que no sirve para el llamador. */
interface BilledResponse {
  readonly usage: LlmUsage;
  readonly requestId: string | null;
}

/**
 * Fallo de una llamada. Los del proveedor llevan `billingUnknown` cuando un timeout o un aborto
 * ocurrió después de enviar: no se sabe si Anthropic facturó, así que se imputa la reserva entera.
 */
export type ProviderLlmFailure = ProviderFailure & { readonly billingUnknown?: boolean };

export type LlmFailure =
  | ProviderLlmFailure
  | ({ readonly kind: 'Refused'; readonly category: string | null } & BilledResponse)
  | ({ readonly kind: 'Truncated' } & BilledResponse)
  | ({ readonly kind: 'InvalidOutput'; readonly issues: readonly string[] } & BilledResponse);

export interface LlmPort {
  /** Conteo de tokens de entrada (gratis y reintentable). */
  countInputTokens(
    request: LlmRequest,
    signal: AbortSignal,
  ): Promise<Result<number, ProviderLlmFailure>>;
  /** Llamada facturable: una sola vez, sin reintentos automáticos (D9). */
  complete<T>(
    request: LlmRequest<T>,
    signal: AbortSignal,
  ): Promise<Result<LlmCompletion<T>, LlmFailure>>;
}
