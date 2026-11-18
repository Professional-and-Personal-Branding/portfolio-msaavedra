/** Configuración de la IA ya validada al arrancar (D2). */
export const AI_SETTINGS = Symbol('AiSettings');

export interface AiSettings {
  readonly enabled: boolean;
  readonly provider: 'anthropic' | 'fake';
  readonly monthlyBudgetUsd: number;
  readonly requestTimeoutMs: number;
  readonly maxConcurrency: number;
  readonly maxInputTokens: number;
  /** Secretos exactos de la configuración que jamás pueden salir (D13). */
  readonly knownSecrets: readonly string[];
}

/** Token con el que los casos de uso de IA de cada feature reciben el runner. */
export const AI_TASK_RUNNER = Symbol('AiTaskRunner');

/** Generador de ids de corrida (inyectable para los tests). */
export const AI_NEW_ID = Symbol('AiNewId');
export type AiNewId = () => string;

/** Semáforo por proceso (D14): sin lugar en `maxWaitMs`, devuelve `null` y no se encola. */
export const AI_CONCURRENCY_LIMITER = Symbol('AiConcurrencyLimiter');
export interface ConcurrencyLimiter {
  acquire(maxWaitMs: number): Promise<(() => void) | null>;
}

/** Una línea de log por corrida (D21): nunca el prompt, la entrada ni la salida. */
export const AI_RUN_LOGGER = Symbol('AiRunLogger');
export interface AiRunLogEntry {
  readonly aiRunId: string;
  readonly task: string;
  readonly promptVersion: number;
  readonly model: string;
  readonly status: string;
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
  readonly costMicroUsd: number | null;
  readonly durationMs: number | null;
  readonly requestId: string | null;
  readonly failureKind: string | null;
}
export interface AiRunLogger {
  log(entry: AiRunLogEntry): void;
}

/** Avisos del guardián del presupuesto: solo identificadores y cifras, nunca datos sensibles. */
export interface AiGuardLogger {
  warn(message: string, data: Record<string, unknown>): void;
}
export const noopGuardLogger: AiGuardLogger = { warn: () => undefined };
