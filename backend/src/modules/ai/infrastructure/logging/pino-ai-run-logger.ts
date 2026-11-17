import type { Logger } from 'pino';
import { AiRunLogEntry, AiRunLogger } from '../../application/ports/ai-support.ports';

/** Logger base de `nestjs-pino` (con la redacción configurada). */
export const AI_BASE_LOGGER = Symbol('AI_BASE_LOGGER');

/**
 * Una línea por corrida (D21): id, tarea, versión, modelo, estado, tokens, costo, duración e id de
 * la petición. Nunca el prompt, la entrada ni la salida: la entrada del logger no los tiene.
 */
export class PinoAiRunLogger implements AiRunLogger {
  constructor(private readonly pino: Logger) {}

  log(entry: AiRunLogEntry): void {
    this.pino.info({ ...entry }, `Corrida de IA ${entry.task} ${entry.status}`);
  }
}
