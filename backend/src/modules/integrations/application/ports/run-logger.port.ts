export interface RunLogger {
  debug(message: string, data?: Record<string, unknown>): void;
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: Record<string, unknown>): void;
}

export interface RunLogContext {
  readonly syncRunId: string;
  readonly jobId: string;
  readonly provider: string;
  /** Secretos del trabajo: el logger los redacta del mensaje y de los textos de `data` (B4). */
  readonly secrets?: readonly string[];
}

export const RUN_LOGGER_FACTORY = Symbol('RUN_LOGGER_FACTORY');

export interface RunLoggerFactory {
  /** Logger con contexto de un intento: todas sus líneas llevan `syncRunId`, `jobId` y `provider`. */
  forRun(context: RunLogContext): RunLogger;
  /** Logger sin contexto de corrida (planificador, arranque). */
  general(): RunLogger;
}
