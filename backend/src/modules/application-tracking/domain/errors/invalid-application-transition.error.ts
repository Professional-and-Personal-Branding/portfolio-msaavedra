import { RuleViolationError } from '../../../../shared/domain/errors';
import { ApplicationStatus } from '../application-status';

/** El estado pedido no es alcanzable desde el actual (→ 422, no 400: la forma es válida). */
export class InvalidApplicationTransitionError extends RuleViolationError {
  readonly code = 'INVALID_APPLICATION_TRANSITION';

  constructor(
    readonly from: ApplicationStatus,
    readonly to: ApplicationStatus,
  ) {
    super(`Transición de estado inválida: ${from} → ${to}`);
  }
}
