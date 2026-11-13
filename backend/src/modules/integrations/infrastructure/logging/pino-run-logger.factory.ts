import type { Logger } from 'pino';
import { redactSecrets } from '../../../../shared/domain/redact-secrets';
import {
  RunLogContext,
  RunLogger,
  RunLoggerFactory,
} from '../../application/ports/run-logger.port';

/** Logger base (de `nestjs-pino`, con la redacción configurada) que se inyecta a la fábrica. */
export const INTEGRATIONS_BASE_LOGGER = Symbol('INTEGRATIONS_BASE_LOGGER');

/** Redacta los secretos de un valor de `data`: cadenas, y objetos o listas hasta 4 niveles. */
function redactValue(value: unknown, secrets: readonly string[], depth = 0): unknown {
  if (typeof value === 'string') return redactSecrets(value, secrets);
  if (depth >= 4 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((item) => redactValue(item, secrets, depth + 1));
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, redactValue(item, secrets, depth + 1)]),
  );
}

class PinoRunLogger implements RunLogger {
  constructor(
    private readonly pino: Logger,
    private readonly secrets: readonly string[] = [],
  ) {}

  private clean(
    message: string,
    data?: Record<string, unknown>,
  ): [Record<string, unknown>, string] {
    if (this.secrets.length === 0) return [data ?? {}, message];
    return [
      redactValue(data ?? {}, this.secrets) as Record<string, unknown>,
      redactSecrets(message, this.secrets),
    ];
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.pino.debug(...this.clean(message, data));
  }
  info(message: string, data?: Record<string, unknown>): void {
    this.pino.info(...this.clean(message, data));
  }
  warn(message: string, data?: Record<string, unknown>): void {
    this.pino.warn(...this.clean(message, data));
  }
  error(message: string, data?: Record<string, unknown>): void {
    this.pino.error(...this.clean(message, data));
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
      context.secrets,
    );
  }

  general(): RunLogger {
    return new PinoRunLogger(this.base.child({ context: 'Integrations' }));
  }
}
