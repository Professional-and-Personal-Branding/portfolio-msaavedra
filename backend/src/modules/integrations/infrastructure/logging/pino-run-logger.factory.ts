import type { Logger } from 'pino';
import {
  RunLogContext,
  RunLogger,
  RunLoggerFactory,
} from '../../application/ports/run-logger.port';

/** Logger base (de `nestjs-pino`, con la redacción configurada) que se inyecta a la fábrica. */
export const INTEGRATIONS_BASE_LOGGER = Symbol('INTEGRATIONS_BASE_LOGGER');

class PinoRunLogger implements RunLogger {
  constructor(private readonly pino: Logger) {}

  debug(message: string, data?: Record<string, unknown>): void {
    this.pino.debug(data ?? {}, message);
  }
  info(message: string, data?: Record<string, unknown>): void {
    this.pino.info(data ?? {}, message);
  }
  warn(message: string, data?: Record<string, unknown>): void {
    this.pino.warn(data ?? {}, message);
  }
  error(message: string, data?: Record<string, unknown>): void {
    this.pino.error(data ?? {}, message);
  }
}

/**
 * Logger hijo por intento con `{ syncRunId, jobId, provider }` (D16): todas las líneas del
 * trabajo llevan el mismo contexto y el `syncRunId` coincide con la fila `SyncRun`.
 */
export class PinoRunLoggerFactory implements RunLoggerFactory {
  constructor(private readonly base: Logger) {}

  forRun(context: RunLogContext): RunLogger {
    return new PinoRunLogger(
      this.base.child({
        syncRunId: context.syncRunId,
        jobId: context.jobId,
        provider: context.provider,
      }),
    );
  }

  general(): RunLogger {
    return new PinoRunLogger(this.base.child({ context: 'Integrations' }));
  }
}
