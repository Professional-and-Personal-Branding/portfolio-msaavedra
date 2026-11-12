import { RuleViolationError } from '../../../../shared/domain/errors';

/**
 * Motivo interno de una importación fallida (D16). Va al log, nunca al cuerpo de la respuesta:
 * el cuerpo lleva solo el mensaje accionable, sin el cuerpo remoto ni la IP resuelta.
 */
export type ImportFailureReason =
  | 'closed-portal'
  | 'url-not-allowed'
  | 'blocked-address'
  | 'too-many-redirects'
  | 'timeout'
  | 'too-large'
  | 'unexpected-content-type'
  | 'not-found'
  | 'upstream-error'
  | 'no-posting-found'
  | 'unparseable';

/** Cierre de todo mensaje de una URL que se resuelve pegando el texto (D16). */
export const PASTE_HINT = 'Pegá el texto de la vacante.';

/**
 * Falla al obtener una vacante desde una URL (→ 422): la petición es válida de forma, pero el
 * sitio remoto o la política de red no permiten leerla. El owner siempre puede pegar el texto.
 */
export class ImportFailure extends RuleViolationError {
  readonly code = 'JOB_POSTING_IMPORT_FAILED';

  constructor(
    readonly reason: ImportFailureReason,
    message: string,
  ) {
    super(message);
  }

  /** Mensaje base + la indicación de pegar el texto (D16). */
  static withHint(reason: ImportFailureReason, base: string): ImportFailure {
    return new ImportFailure(reason, `${base}. ${PASTE_HINT}`);
  }
}
