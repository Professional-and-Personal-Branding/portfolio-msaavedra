import { DomainError } from '../../../../shared/domain/errors';

/**
 * La llamada se hizo (o se intentó) y la corrida terminó mal: transitorio del proveedor, rechazo,
 * truncado, salida inválida o spend limit. La corrida ya quedó registrada con su costo.
 */
export class AiRunFailedError extends DomainError {
  readonly code = 'AI_RUN_FAILED';

  constructor(
    readonly runId: string,
    readonly status: string,
    readonly failureKind: string,
    message: string,
  ) {
    super(message);
  }
}
