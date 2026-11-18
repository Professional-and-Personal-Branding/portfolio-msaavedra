import { fail, Result } from '../../../../shared/domain/result';
import {
  LlmCompletion,
  LlmFailure,
  LlmPort,
  ProviderLlmFailure,
} from '../../application/ports/llm.port';

const MESSAGE = 'La IA está apagada en este servidor';

/**
 * Con `AI_ENABLED=false` el cliente del SDK no se construye: este adaptador ocupa su lugar. El
 * runner ya corta antes con `AiDisabledError`; si algo lo llamara igual, falla sin salir a la red.
 */
export class DisabledLlmAdapter implements LlmPort {
  countInputTokens(): Promise<Result<number, ProviderLlmFailure>> {
    return Promise.resolve(fail({ kind: 'Permanent', message: MESSAGE }));
  }

  complete<T>(): Promise<Result<LlmCompletion<T>, LlmFailure>> {
    return Promise.resolve(fail({ kind: 'Permanent', message: MESSAGE }));
  }
}
