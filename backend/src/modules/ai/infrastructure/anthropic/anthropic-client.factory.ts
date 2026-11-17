import Anthropic from '@anthropic-ai/sdk';

/** URL base fija de Anthropic: no se puede cambiar por variable de entorno (D3). */
export const ANTHROPIC_BASE_URL = 'https://api.anthropic.com';

export interface AnthropicClientOptions {
  readonly apiKey: string;
  readonly timeoutMs: number;
  /**
   * Solo para un test que apunta a un servidor en `127.0.0.1`. La app nunca lo pasa: el módulo
   * construye el cliente sin esta opción.
   */
  readonly baseURL?: string;
}

/** Token de inyección de la factory (los e2e la reemplazan por un espía). */
export const ANTHROPIC_CLIENT_FACTORY = Symbol('AnthropicClientFactory');
export type AnthropicClientFactory = (options: AnthropicClientOptions) => Anthropic;

/**
 * Único lugar donde se construye el cliente del SDK. La clave se pasa explícita: así el SDK no toma
 * credenciales ambientales (`ANTHROPIC_AUTH_TOKEN`, perfiles de `ant auth login`) ni un
 * `ANTHROPIC_BASE_URL` del entorno que desvíe el tráfico (D3). `maxRetries: 0`: la llamada
 * facturable nunca se reintenta sola (D9); el conteo de tokens pide sus reintentos por petición.
 */
export const createAnthropicClient: AnthropicClientFactory = (options) =>
  new Anthropic({
    apiKey: options.apiKey,
    baseURL: options.baseURL ?? ANTHROPIC_BASE_URL,
    maxRetries: 0,
    timeout: options.timeoutMs,
    // Explícito: `ANTHROPIC_LOG=debug` del entorno volcaría prompts y cuerpos a la consola (B5).
    logLevel: 'warn',
  });
